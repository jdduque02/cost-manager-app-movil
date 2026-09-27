import { useCallback } from "react";
import { useOfflineStore } from "@/store/offline.store";
import { useAuthStore } from "@/store/auth.store";
import * as transactionsApi from "@/api/transactions.api";
import * as bankingApi from "@/api/banking.api";
import * as objectivesApi from "@/api/objectives.api";
import * as empresasApi from "@/api/empresas.api";
import * as localRepo from "@/database/local.repository";
import { apiErrorMessage, classifyApiError, isQueueableError } from "@/api/client";
import type {
  CreateTransactionRecordDto,
  UpdateTransactionRecordDto,
  TransactionRecordResponse,
} from "@/types/transaction.types";
import type {
  CreateBankAccountDto,
  UpdateBankAccountDto,
  BankAccountResponse,
} from "@/types/banking.types";
import type {
  CreateFinancialObjectiveDto,
  UpdateFinancialObjectiveDto,
  FinancialObjectiveResponse,
} from "@/types/objective.types";
import type { CreateEmpresaDto, EmpresaResponse } from "@/types/empresa.types";
import { useQueryClient } from "@tanstack/react-query";

export const NO_SESSION_MESSAGE = "No hay una sesión activa. Inicia sesión de nuevo.";

function requireUserId(userId: number | null): number {
  if (userId == null) throw new Error(NO_SESSION_MESSAGE);
  return userId;
}

/**
 * Solo red/timeout y 5xx caen a la cola offline. Un 4xx (o el bloqueo de
 * Cloud Armor) fallaría igual al sincronizar, así que se muestra ya. Errores
 * no-HTTP (sesión expirada, fallo de SQLite tras un create exitoso) tampoco
 * se encolan: encolarlos duplicaría en el servidor lo que ya se guardó.
 */
function rethrowUnlessQueueable(err: unknown): void {
  if (isQueueableError(err)) return;
  if (classifyApiError(err) !== null) {
    throw new Error(apiErrorMessage(err, "El servidor rechazó el cambio."));
  }
  throw err;
}

/**
 * Hook que provee mutaciones con soporte offline-first.
 *
 * Estrategia:
 * 1. Si hay conexión: intenta la petición al servidor y guarda en caché local.
 * 2. Si no hay conexión, o la petición falla por red/5xx: guarda sólo en
 *    SQLite y encola la operación para sincronizarla cuando vuelva la red.
 * 3. Si el servidor la rechaza (4xx) o la red está bloqueada: lanza el error
 *    con un mensaje para el usuario, sin encolar.
 *
 * Invalida automáticamente las queries de React Query relacionadas.
 */
export function useOfflineMutations() {
  const isGuest = useAuthStore((s) => s.isGuest);
  // En modo invitado nunca hay una cuenta real en el backend que pueda
  // recibir estas peticiones (el "userId" es el sentinel local
  // GUEST_USER_ID) — forzar siempre la ruta local evita peticiones de red
  // condenadas a fallar (o, peor, aceptadas por error contra un id ajeno).
  const isOnline = useOfflineStore((s) => s.isOnline) && !isGuest;
  const refreshPendingCount = useOfflineStore((s) => s.refreshPendingCount);
  // Sin fallback: un userId inventado mandaba (o encolaba) datos contra una
  // cuenta ajena. Sin sesión, cada mutación falla antes de tocar API o SQLite.
  const sessionUserId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const createTransaction = useCallback(
    async (
      dto: CreateTransactionRecordDto,
    ): Promise<TransactionRecordResponse> => {
      const userId = requireUserId(sessionUserId);
      if (isOnline) {
        try {
          const result = await transactionsApi.createTransaction(userId, dto);
          // Guardar en local también para caché
          await localRepo.saveTransactions([result]);
          queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
          return result;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      // Modo offline: guardar localmente y encolar
      const result = await localRepo.createLocalTransaction(userId, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      return result;
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const createBankAccount = useCallback(
    async (dto: CreateBankAccountDto): Promise<BankAccountResponse> => {
      const userId = requireUserId(sessionUserId);
      if (isOnline) {
        try {
          const result = await bankingApi.createBankAccount(userId, dto);
          await localRepo.saveBankAccounts([result]);
          queryClient.invalidateQueries({
            queryKey: ["bank-accounts", userId],
          });
          return result;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      const result = await localRepo.createLocalBankAccount(userId, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
      return result;
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const createObjective = useCallback(
    async (
      dto: CreateFinancialObjectiveDto,
    ): Promise<FinancialObjectiveResponse> => {
      const userId = requireUserId(sessionUserId);
      if (isOnline) {
        try {
          const result = await objectivesApi.createObjective(userId, dto);
          await localRepo.saveObjectives([result]);
          queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
          return result;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      const result = await localRepo.createLocalObjective(userId, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      return result;
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const createCompany = useCallback(
    async (dto: CreateEmpresaDto): Promise<EmpresaResponse> => {
      const userId = requireUserId(sessionUserId);
      if (isOnline) {
        try {
          const result = await empresasApi.createEmpresa(userId, dto);
          await localRepo.saveCompanies([result]);
          queryClient.invalidateQueries({ queryKey: ["companies", userId] });
          return result;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      const result = await localRepo.createLocalCompany(userId, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["companies", userId] });
      return result;
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const updateTransaction = useCallback(
    async (
      id: number,
      dto: UpdateTransactionRecordDto,
    ): Promise<void> => {
      const userId = requireUserId(sessionUserId);
      // id <= 0: fila que solo existe en local (CREATE pendiente); el servidor no la conoce.
      if (isOnline && id > 0) {
        try {
          const result = await transactionsApi.updateTransaction(userId, id, dto);
          await localRepo.saveTransactions([result]);
          queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
          return;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      await localRepo.updateLocalTransaction(userId, id, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const deleteTransaction = useCallback(
    async (id: number): Promise<void> => {
      const userId = requireUserId(sessionUserId);
      // id <= 0: fila que solo existe en local (CREATE pendiente); el servidor no la conoce.
      if (isOnline && id > 0) {
        try {
          await transactionsApi.deleteTransaction(userId, id);
          await localRepo.removeCachedTransaction(id);
          queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
          return;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      await localRepo.deleteLocalTransaction(userId, id);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const updateBankAccount = useCallback(
    async (id: number, dto: UpdateBankAccountDto): Promise<void> => {
      const userId = requireUserId(sessionUserId);
      // id <= 0: fila que solo existe en local (CREATE pendiente); el servidor no la conoce.
      if (isOnline && id > 0) {
        try {
          const result = await bankingApi.updateBankAccount(userId, id, dto);
          await localRepo.saveBankAccounts([result]);
          queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
          return;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      await localRepo.updateLocalBankAccount(userId, id, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const deleteBankAccount = useCallback(
    async (id: number): Promise<void> => {
      const userId = requireUserId(sessionUserId);
      // id <= 0: fila que solo existe en local (CREATE pendiente); el servidor no la conoce.
      if (isOnline && id > 0) {
        try {
          await bankingApi.deleteBankAccount(userId, id);
          await localRepo.removeCachedBankAccount(id);
          queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
          return;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      await localRepo.deleteLocalBankAccount(userId, id);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const updateObjective = useCallback(
    async (id: number, dto: UpdateFinancialObjectiveDto): Promise<void> => {
      const userId = requireUserId(sessionUserId);
      // id <= 0: fila que solo existe en local (CREATE pendiente); el servidor no la conoce.
      if (isOnline && id > 0) {
        try {
          const result = await objectivesApi.updateObjective(userId, id, dto);
          await localRepo.saveObjectives([result]);
          queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
          return;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      await localRepo.updateLocalObjective(userId, id, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  const deleteObjective = useCallback(
    async (id: number): Promise<void> => {
      const userId = requireUserId(sessionUserId);
      // id <= 0: fila que solo existe en local (CREATE pendiente); el servidor no la conoce.
      if (isOnline && id > 0) {
        try {
          await objectivesApi.deleteObjective(userId, id);
          await localRepo.removeCachedObjective(id);
          queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
          return;
        } catch (err) {
          rethrowUnlessQueueable(err);
        }
      }
      await localRepo.deleteLocalObjective(userId, id);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
    },
    [isOnline, sessionUserId, queryClient, refreshPendingCount],
  );

  return {
    createTransaction,
    updateTransaction,
    deleteTransaction,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    createObjective,
    updateObjective,
    deleteObjective,
    createCompany,
  };
}
