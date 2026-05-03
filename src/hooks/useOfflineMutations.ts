import { useCallback } from "react";
import { useOfflineStore } from "@/store/offline.store";
import { useAuthStore } from "@/store/auth.store";
import * as transactionsApi from "@/api/transactions.api";
import * as bankingApi from "@/api/banking.api";
import * as objectivesApi from "@/api/objectives.api";
import * as localRepo from "@/database/local.repository";
import type {
  CreateTransactionRecordDto,
  TransactionRecordResponse,
} from "@/types/transaction.types";
import type {
  CreateBankAccountDto,
  BankAccountResponse,
} from "@/types/banking.types";
import type {
  CreateFinancialObjectiveDto,
  FinancialObjectiveResponse,
} from "@/types/objective.types";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook que provee mutaciones con soporte offline-first.
 *
 * Estrategia:
 * 1. Si hay conexión: intenta la petición al servidor y guarda en caché local.
 * 2. Si no hay conexión (o la petición falla): guarda sólo en SQLite y
 *    encola la operación para sincronizarla cuando vuelva la red.
 *
 * Invalida automáticamente las queries de React Query relacionadas.
 */
export function useOfflineMutations() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const refreshPendingCount = useOfflineStore((s) => s.refreshPendingCount);
  const userId = useAuthStore((s) => s.userId) ?? 1;
  const queryClient = useQueryClient();

  const createTransaction = useCallback(
    async (
      dto: CreateTransactionRecordDto,
    ): Promise<TransactionRecordResponse> => {
      if (isOnline) {
        try {
          const result = await transactionsApi.createTransaction(userId, dto);
          // Guardar en local también para caché
          await localRepo.saveTransactions([result]);
          queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
          return result;
        } catch {
          // Caer a offline si falla
        }
      }
      // Modo offline: guardar localmente y encolar
      const result = await localRepo.createLocalTransaction(userId, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      return result;
    },
    [isOnline, userId, queryClient, refreshPendingCount],
  );

  const createBankAccount = useCallback(
    async (dto: CreateBankAccountDto): Promise<BankAccountResponse> => {
      if (isOnline) {
        try {
          const result = await bankingApi.createBankAccount(userId, dto);
          await localRepo.saveBankAccounts([result]);
          queryClient.invalidateQueries({
            queryKey: ["bank-accounts", userId],
          });
          return result;
        } catch {
          // Caer a offline si falla
        }
      }
      const result = await localRepo.createLocalBankAccount(userId, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", userId] });
      return result;
    },
    [isOnline, userId, queryClient, refreshPendingCount],
  );

  const createObjective = useCallback(
    async (
      dto: CreateFinancialObjectiveDto,
    ): Promise<FinancialObjectiveResponse> => {
      if (isOnline) {
        try {
          const result = await objectivesApi.createObjective(userId, dto);
          await localRepo.saveObjectives([result]);
          queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
          return result;
        } catch {
          // Caer a offline si falla
        }
      }
      const result = await localRepo.createLocalObjective(userId, dto);
      await refreshPendingCount();
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      return result;
    },
    [isOnline, userId, queryClient, refreshPendingCount],
  );

  return { createTransaction, createBankAccount, createObjective };
}
