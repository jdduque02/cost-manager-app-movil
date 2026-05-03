import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useAuthStore } from "@/store/auth.store";
import * as transactionsApi from "@/api/transactions.api";
import * as bankingApi from "@/api/banking.api";
import * as localRepo from "@/database/local.repository";
import type { TransactionRecordResponse } from "@/types/transaction.types";
import type { BankAccountResponse } from "@/types/banking.types";
import { router } from "expo-router";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";

const TYPE_COLORS: Record<string, string> = {
  INCOME: "#059669",
  EXPENSE: "#DC2626",
  TRANSFER: "#2563EB",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardScreen() {
  const userId = useAuthStore((s) => s.userId) ?? 1;

  const {
    data: transactions,
    isLoading: loadingTx,
    refetch: refetchTx,
  } = useOfflineQuery(
    {
      queryKey: ["transactions", userId],
      queryFn: () =>
        transactionsApi.getTransactions(userId, {
          date_from: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          limit: 5,
        }),
      enabled: !!userId,
    },
    async () => {
      const data = await localRepo.getLocalTransactions(userId);
      return { data: data.slice(0, 5), total: data.length };
    },
  );

  const {
    data: accounts,
    isLoading: loadingAcc,
    refetch: refetchAcc,
  } = useOfflineQuery(
    {
      queryKey: ["bank-accounts", userId],
      queryFn: () => bankingApi.getBankAccounts(userId),
      enabled: !!userId,
    },
    () => localRepo.getLocalBankAccounts(userId),
  );

  const isLoading = loadingTx || loadingAcc;

  const income = (transactions?.data ?? [])
    .filter((t: TransactionRecordResponse) => t.type === "INCOME")
    .reduce(
      (s: number, t: TransactionRecordResponse) => s + Number(t.amount),
      0,
    );

  const expenses = (transactions?.data ?? [])
    .filter((t: TransactionRecordResponse) => t.type === "EXPENSE")
    .reduce(
      (s: number, t: TransactionRecordResponse) => s + Number(t.amount),
      0,
    );

  const totalBalance = (accounts ?? []).reduce(
    (s: number, a: BankAccountResponse) => s + Number(a.balance),
    0,
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-brand-50">
        <ActivityIndicator size="large" color="#1B4332" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-brand-50"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => {
            refetchTx();
            refetchAcc();
          }}
        />
      }
    >
      {/* Header */}
      <View className="px-5 pt-6 pb-2">
        <Text className="text-xl font-bold text-brand-900">
          Resumen del mes
        </Text>
        <Text className="text-sm text-brand-800 mt-0.5">Últimos 30 días</Text>
      </View>

      {/* Summary Cards */}
      <View className="px-4 gap-y-2.5 mt-2">
        {[
          {
            label: "Balance total",
            value: formatCurrency(totalBalance),
            border: "border-l-brand-900",
          },
          {
            label: "Ingresos",
            value: formatCurrency(income),
            border: "border-l-brand-600",
          },
          {
            label: "Gastos",
            value: formatCurrency(expenses),
            border: "border-l-red-600",
          },
        ].map(({ label, value, border }) => (
          <View
            key={label}
            className={`bg-white rounded-xl p-4 border-l-4 ${border} shadow-sm elevation-1`}
          >
            <Text className="text-xs font-semibold text-brand-800 uppercase mb-1">
              {label}
            </Text>
            <Text className="text-xl font-bold text-brand-900">{value}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <Text className="text-base font-bold text-brand-900 px-4 pt-6 pb-2.5">
        Acciones rápidas
      </Text>
      <View className="flex-row px-4 gap-x-2.5">
        {[
          { label: "+ Transacción", href: "/(tabs)/transactions" as const },
          { label: "+ Cuenta", href: "/(tabs)/banking" as const },
          { label: "+ Objetivo", href: "/(tabs)/objectives" as const },
        ].map(({ label, href }) => (
          <TouchableOpacity
            key={label}
            className="flex-1 bg-brand-900 rounded-xl p-3 items-center"
            onPress={() => router.push(href)}
          >
            <Text className="text-white font-semibold text-xs">{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Transactions */}
      <Text className="text-base font-bold text-brand-900 px-4 pt-6 pb-2.5">
        Transacciones recientes
      </Text>
      {(transactions?.data ?? []).length === 0 ? (
        <Text className="px-4 text-gray-400 italic text-sm">
          Sin transacciones este mes
        </Text>
      ) : (
        (transactions?.data ?? []).map((tx: TransactionRecordResponse) => (
          <View
            key={tx.id}
            className="flex-row justify-between items-center bg-white mx-4 mb-2 p-3.5 rounded-xl shadow-sm elevation-1"
          >
            <View>
              <Text className="text-sm font-semibold text-brand-900">
                {tx.description ?? `Transacción #${tx.id}`}
              </Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                {new Date(tx.transactionDate).toLocaleDateString("es-CO")}
              </Text>
            </View>
            <Text
              className="text-sm font-bold"
              style={{ color: TYPE_COLORS[tx.type] }}
            >
              {tx.type === "INCOME" ? "+" : "-"}
              {formatCurrency(Number(tx.amount))}
            </Text>
          </View>
        ))
      )}

      {/* Bank Accounts */}
      <Text className="text-base font-bold text-brand-900 px-4 pt-6 pb-2.5">
        Cuentas bancarias
      </Text>
      {(accounts ?? []).length === 0 ? (
        <Text className="px-4 text-gray-400 italic text-sm">
          Sin cuentas registradas
        </Text>
      ) : (
        (accounts ?? []).map((acc: BankAccountResponse) => (
          <View
            key={acc.id}
            className="flex-row justify-between items-center bg-white mx-4 mb-2 p-3.5 rounded-xl shadow-sm elevation-1"
          >
            <View>
              <Text className="text-sm font-semibold text-brand-900">
                {acc.name}
              </Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                {acc.bankName}
              </Text>
            </View>
            <Text className="text-sm font-bold text-brand-900">
              {formatCurrency(Number(acc.balance))}
            </Text>
          </View>
        ))
      )}

      <View className="h-6" />
    </ScrollView>
  );
}
