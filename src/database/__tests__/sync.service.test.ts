/**
 * Tests unitarios para src/database/sync.service.ts
 *
 * Verifica la lógica de sincronización de operaciones pendientes:
 * whitelist de entidades/operaciones, reintentos máximos, y manejo de handlers.
 */

import { AxiosError, AxiosHeaders } from "axios";
import { syncPendingOperations, MAX_RETRIES } from "../sync.service";
import {
  getPendingOperations,
  deletePendingOperation,
  incrementRetryCount,
  markOperationFailed,
  markEntitySynced,
} from "../local.repository";
import * as transactionsApi from "@/api/transactions.api";
import * as bankingApi from "@/api/banking.api";
import * as objectivesApi from "@/api/objectives.api";

jest.mock("@/api/transactions.api");
jest.mock("@/api/banking.api");
jest.mock("@/api/objectives.api");
jest.mock("../local.repository", () => ({
  getPendingOperations: jest.fn(),
  deletePendingOperation: jest.fn(),
  incrementRetryCount: jest.fn(),
  markOperationFailed: jest.fn(),
  markEntitySynced: jest.fn(),
}));

const mockGetPending = getPendingOperations as jest.Mock;
const mockDelete = deletePendingOperation as jest.Mock;
const mockIncRetry = incrementRetryCount as jest.Mock;
const mockMarkSynced = markEntitySynced as jest.Mock;
const mockMarkFailed = markOperationFailed as jest.Mock;
const mockCreateTransaction = transactionsApi.createTransaction as jest.Mock;
const mockCreateBankAccount = bankingApi.createBankAccount as jest.Mock;
const mockCreateObjective = objectivesApi.createObjective as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
  mockIncRetry.mockResolvedValue(undefined);
  mockMarkSynced.mockResolvedValue(undefined);
  mockMarkFailed.mockResolvedValue(undefined);
});

// ─── syncPendingOperations ────────────────────────────────────────────────────

describe("syncPendingOperations", () => {
  it("sincroniza una transacción pendiente y retorna synced=1", async () => {
    mockGetPending.mockResolvedValueOnce([
      {
        id: 1,
        entity: "transactions",
        operation: "CREATE",
        localId: "local_abc",
        retryCount: 0,
        payload: {
          userId: 1,
          localId: "local_abc",
          type: "EXPENSE",
          amount: 100,
          currency: "COP",
          transaction_date: "2024-01-01",
        },
      },
    ]);
    mockCreateTransaction.mockResolvedValueOnce({ id: 10 });

    const result = await syncPendingOperations();

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockMarkSynced).toHaveBeenCalledWith(
      "transactions",
      "local_abc",
      10,
    );
    expect(mockDelete).toHaveBeenCalledWith(1);
  });

  it("tras sincronizar una cuenta, las operaciones siguientes usan su id de servidor", async () => {
    const accountOp = {
      id: 1,
      entity: "bank_accounts",
      operation: "CREATE",
      localId: "local_acc",
      retryCount: 0,
      payload: { userId: 1, bank_name: "B", account_type: "ahorros", account_number: "1234567890", balance: 0 },
    };
    const txOp = {
      id: 2,
      entity: "transactions",
      operation: "CREATE",
      localId: "local_tx",
      retryCount: 0,
      payload: { userId: 1, type: "expense", amount: 5, account_id: -123, transaction_date: "2024-01-01" },
    };
    // 1ª lectura: cola con el id local. 2ª (tras marcar la cuenta): markEntitySynced
    // ya remapeó la cola en SQLite, así que la transacción trae el id del servidor.
    mockGetPending
      .mockResolvedValueOnce([accountOp, txOp])
      .mockResolvedValueOnce([accountOp, { ...txOp, payload: { ...txOp.payload, account_id: 500 } }]);
    mockCreateBankAccount.mockResolvedValueOnce({ id: 500 });
    mockCreateTransaction.mockResolvedValueOnce({ id: 10 });

    const result = await syncPendingOperations();

    expect(result.synced).toBe(2);
    expect(mockCreateTransaction).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ account_id: 500 }),
    );
  });

  it("omite entidades que no están en la whitelist y las elimina", async () => {
    mockGetPending.mockResolvedValueOnce([
      {
        id: 99,
        entity: "malicious_entity",
        operation: "CREATE",
        localId: "local_x",
        retryCount: 0,
        payload: {},
      },
    ]);

    const result = await syncPendingOperations();

    expect(mockDelete).toHaveBeenCalledWith(99);
    expect(result.synced).toBe(0);
  });

  it("omite operaciones no permitidas (DELETE no implementado) y las elimina", async () => {
    mockGetPending.mockResolvedValueOnce([
      {
        id: 50,
        entity: "transactions",
        operation: "PATCH", // operación no en whitelist
        localId: "local_y",
        retryCount: 0,
        payload: {},
      },
    ]);

    await syncPendingOperations();

    expect(mockDelete).toHaveBeenCalledWith(50);
  });

  it("omite operaciones que superaron MAX_RETRIES sin eliminarlas", async () => {
    mockGetPending.mockResolvedValueOnce([
      {
        id: 5,
        entity: "transactions",
        operation: "CREATE",
        localId: "local_z",
        retryCount: 3, // MAX_RETRIES = 3
        payload: {},
      },
    ]);

    const result = await syncPendingOperations();

    expect(result.skipped).toBe(1);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("incrementa retryCount y no elimina si el API falla", async () => {
    mockGetPending.mockResolvedValueOnce([
      {
        id: 2,
        entity: "bank_accounts",
        operation: "CREATE",
        localId: "local_ba",
        retryCount: 0,
        payload: {
          userId: 1,
          localId: "local_ba",
          name: "Mi cuenta",
          bank_name: "Banco",
          account_type: "SAVINGS",
          balance: 0,
          currency: "COP",
        },
      },
    ]);
    mockCreateBankAccount.mockRejectedValueOnce(new Error("API error"));

    const result = await syncPendingOperations();

    expect(result.failed).toBe(1);
    expect(mockIncRetry).toHaveBeenCalledWith(2);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  describe("rechazo 4xx vs fallo transitorio", () => {
    const op = {
      id: 7,
      entity: "bank_accounts",
      operation: "CREATE",
      localId: "-4",
      retryCount: 0,
      lastError: null,
      payload: { userId: 1, localId: "-4", bank_name: "X" },
    };
    const httpError = (status: number, data: unknown) =>
      new AxiosError(`status ${status}`, "ERR_BAD_REQUEST", undefined, null, {
        status,
        statusText: "",
        data,
        headers: {},
        config: { headers: new AxiosHeaders() },
      });

    it("un 4xx marca la operación como fallida con su motivo, sin borrarla ni sumar reintento", async () => {
      mockGetPending.mockResolvedValueOnce([op]);
      mockCreateBankAccount.mockRejectedValueOnce(
        httpError(422, { status: 422, message: "Cuenta duplicada", timestamp: "t" }),
      );

      const result = await syncPendingOperations();

      expect(mockMarkFailed).toHaveBeenCalledWith(7, "Cuenta duplicada", MAX_RETRIES);
      expect(mockIncRetry).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.failed).toBe(1);
    });

    it("sin message del API usa un motivo con el código HTTP", async () => {
      mockGetPending.mockResolvedValueOnce([op]);
      mockCreateBankAccount.mockRejectedValueOnce(httpError(404, { status: 404, timestamp: "t" }));

      await syncPendingOperations();

      expect(mockMarkFailed).toHaveBeenCalledWith(7, expect.stringContaining("404"), MAX_RETRIES);
    });

    it.each([
      ["red", new AxiosError("Network Error", "ERR_NETWORK")],
      ["5xx", httpError(503, "unavailable")],
      ["Cloud Armor", httpError(403, "<html>403</html>")],
    ])("%s cuenta un reintento y no marca fallo permanente", async (_label, err) => {
      mockGetPending.mockResolvedValueOnce([op]);
      mockCreateBankAccount.mockRejectedValueOnce(err);

      await syncPendingOperations();

      expect(mockIncRetry).toHaveBeenCalledWith(7);
      expect(mockMarkFailed).not.toHaveBeenCalled();
    });
  });

  it("retorna { synced: 0, failed: 0, skipped: 0 } si no hay operaciones", async () => {
    mockGetPending.mockResolvedValueOnce([]);

    const result = await syncPendingOperations();

    expect(result).toEqual({ synced: 0, failed: 0, skipped: 0 });
  });

  it("sincroniza un objetivo financiero", async () => {
    mockGetPending.mockResolvedValueOnce([
      {
        id: 3,
        entity: "financial_objectives",
        operation: "CREATE",
        localId: "local_obj",
        retryCount: 0,
        payload: {
          userId: 1,
          localId: "local_obj",
          name: "Vacaciones",
          target_amount: 5000,
          current_amount: 0,
        },
      },
    ]);
    mockCreateObjective.mockResolvedValueOnce({ id: 20 });

    const result = await syncPendingOperations();

    expect(result.synced).toBe(1);
    expect(mockMarkSynced).toHaveBeenCalledWith(
      "financial_objectives",
      "local_obj",
      20,
    );
  });
});
