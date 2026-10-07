import {
  createRecurring,
  listRecurring,
  processRecurring,
  updateRecurring,
  validateRecurringTransaction,
} from "../recurring.api";
import { apiClient } from "../client";

jest.mock("../client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  unwrapList: jest.requireActual("../client").unwrapList,
  isListPayload: jest.requireActual("../client").isListPayload,
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPatch = apiClient.patch as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("recurring.api", () => {
  it("desenvuelve la lista (desnuda o paginada) y filtra por estado", async () => {
    const rule = { id: 1, name: "Arriendo" };
    mockGet.mockResolvedValueOnce({ data: { data: [rule], total: 1 } });
    await expect(listRecurring(7, "active")).resolves.toEqual([rule]);
    expect(mockGet).toHaveBeenCalledWith("/users/7/recurring-transactions", {
      params: { status: "active" },
    });

    mockGet.mockResolvedValueOnce({ data: [rule] });
    await expect(listRecurring(7)).resolves.toEqual([rule]);
    expect(mockGet).toHaveBeenLastCalledWith("/users/7/recurring-transactions", {
      params: undefined,
    });
  });

  it("una respuesta que no es lista lanza en vez de devolver [] (no vacía el caché)", async () => {
    mockGet.mockResolvedValueOnce({ data: "<html>portal cautivo</html>" });
    await expect(listRecurring(7)).rejects.toThrow();
  });

  it("create y update mandan currency tal cual y devuelven la moneda de la respuesta", async () => {
    mockPost.mockResolvedValueOnce({ data: [{ id: 5, currency: "USD" }] });
    const dto = {
      name: "Nómina",
      type: "income" as const,
      amount: 1000,
      currency: "USD" as const,
      account_id: 3,
      frequency: "monthly" as const,
      start_date: "2026-10-01",
      mode: "auto" as const,
    };
    await expect(createRecurring(7, dto)).resolves.toMatchObject({ currency: "USD" });
    expect(mockPost).toHaveBeenCalledWith("/users/7/recurring-transactions", dto);

    mockPatch.mockResolvedValueOnce({ data: [{ id: 5, currency: "COP" }] });
    await expect(updateRecurring(7, 5, { currency: "COP" })).resolves.toMatchObject({ currency: "COP" });
    expect(mockPatch).toHaveBeenCalledWith("/users/7/recurring-transactions/5", { currency: "COP" });
  });

  it("process toma el item único del envelope", async () => {
    mockPost.mockResolvedValueOnce({ data: [{ created: 1, reminders: 0, adopted: 2 }] });
    await expect(processRecurring(7)).resolves.toEqual({ created: 1, reminders: 0, adopted: 2 });
  });

  it("validate normaliza la transacción cruda (bigint y numeric como string)", async () => {
    mockPost.mockResolvedValueOnce({
      data: [{ id: "9", amount: "1520000.00", recurring_id: "3", needs_validation: false }],
    });
    const tx = await validateRecurringTransaction(7, 9, {
      transaction_date: "2026-10-04",
      amount: 1520000,
    });
    expect(mockPost).toHaveBeenCalledWith("/users/7/recurring-transactions/validate/9", {
      transaction_date: "2026-10-04",
      amount: 1520000,
    });
    expect(tx).toMatchObject({ amount: 1520000, recurring_id: 3, needs_validation: false });
  });
});
