import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { apiClient } from "@/api/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ListRow } from "@/components/ui/ListRow";
import { TrendAreaChart } from "@/components/charts/TrendAreaChart";
import { Wallet, TrendingUp, TrendingDown, ChartColumn, ReceiptText } from "@/components/ui/icons";

type DatePreset = "this_month" | "last_month" | "last_7_days" | "last_30_days" | "this_year" | "custom";
type GroupBy = "day" | "week" | "month";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "this_month", label: "Este mes" },
  { key: "last_month", label: "Mes pasado" },
  { key: "last_7_days", label: "Últimos 7 días" },
  { key: "last_30_days", label: "Últimos 30 días" },
  { key: "this_year", label: "Este año" },
  { key: "custom", label: "Personalizado" },
];

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

function getDateRange(preset: DatePreset): { date_from: string; date_to: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  switch (preset) {
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { date_from: first.toISOString().split("T")[0], date_to: today };
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { date_from: first.toISOString().split("T")[0], date_to: last.toISOString().split("T")[0] };
    }
    case "last_7_days": {
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { date_from: from.toISOString().split("T")[0], date_to: today };
    }
    case "last_30_days": {
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { date_from: from.toISOString().split("T")[0], date_to: today };
    }
    case "this_year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { date_from: first.toISOString().split("T")[0], date_to: today };
    }
    default:
      return {
        date_from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        date_to: today,
      };
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface TransactionSummaryTotals {
  income: number;
  expenses: number;
  investments: number;
  count: number;
}

interface TransactionSummarySeriesItem {
  key: string;
  label: string;
  income: number;
  expenses: number;
  investments: number;
  count: number;
}

interface TransactionSummary {
  group_by: GroupBy;
  totals: TransactionSummaryTotals;
  series: TransactionSummarySeriesItem[];
}

interface TransactionItem {
  id: number;
  description: string | null;
  amount: number;
  type: string;
  transaction_date: string;
}

export default function ReportsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");

  const dateRange = useMemo(() => getDateRange(preset), [preset]);

  const { data: summary, isLoading: summaryLoading } = useOfflineQuery<TransactionSummary>(
    {
      queryKey: ["reports-summary", userId, preset, groupBy, dateRange],
      queryFn: async () => {
        const { data } = await apiClient.get<TransactionSummary>(
          `/users/${userId}/transactions/summary`,
          {
            params: {
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              group_by: groupBy,
            },
          },
        );
        return {
          ...data,
          totals: {
            income: Number(data.totals?.income ?? 0),
            expenses: Number(data.totals?.expenses ?? 0),
            investments: Number(data.totals?.investments ?? 0),
            count: Number(data.totals?.count ?? 0),
          },
          series: (data.series ?? []).map((s) => ({
            ...s,
            income: Number(s.income ?? 0),
            expenses: Number(s.expenses ?? 0),
            investments: Number(s.investments ?? 0),
            count: Number(s.count ?? 0),
          })),
        };
      },
      enabled: !!userId,
    },
    async () => ({
      group_by: groupBy,
      totals: { income: 0, expenses: 0, investments: 0, count: 0 },
      series: [],
    }),
  );

  const { data: transactions, isLoading: txLoading } = useOfflineQuery<{ data: TransactionItem[] }>(
    {
      queryKey: ["reports-transactions", userId, dateRange],
      queryFn: async () => {
        const { data } = await apiClient.get<{ data: TransactionItem[]; total: number }>(
          `/users/${userId}/transactions`,
          {
            params: { date_from: dateRange.date_from, date_to: dateRange.date_to, limit: 100 },
            preservePaginated: true,
          },
        );
        return data;
      },
      enabled: !!userId,
    },
    async () => ({ data: [] }),
  );

  const isLoading = summaryLoading || txLoading;

  const chartPoints = useMemo(() => {
    if (!summary?.series?.length) return [];
    return summary.series.map((s) => ({ label: s.label, income: s.income, expenses: s.expenses }));
  }, [summary]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6 gap-3">
        <Skeleton width={200} height={28} />
        <Skeleton height={80} />
        <Skeleton height={80} />
        <Skeleton height={80} />
        <Skeleton height={250} />
      </View>
    );
  }

  const balance = (summary?.totals.income ?? 0) - (summary?.totals.expenses ?? 0);

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 pt-4 gap-7 pb-6">
        <PageHeader title="Reportes" subtitle="Análisis financiero" />

        {/* Date Presets */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {DATE_PRESETS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => setPreset(p.key)}
                  className={`px-4 py-2 rounded-full ${preset === p.key ? "bg-primary" : "bg-card border border-border"}`}
                >
                  <Text
                    className={`text-sm font-sans-medium ${preset === p.key ? "text-primary-foreground" : "text-foreground"}`}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Group By */}
          <View className="flex-row gap-2 mt-3">
            {GROUP_OPTIONS.map((g) => (
              <Pressable
                key={g.key}
                onPress={() => setGroupBy(g.key)}
                className={`flex-1 py-2 rounded-md items-center ${groupBy === g.key ? "bg-primary" : "bg-card border border-border"}`}
              >
                <Text
                  className={`text-sm font-sans-medium ${groupBy === g.key ? "text-primary-foreground" : "text-foreground"}`}
                >
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary Cards */}
        <View className="flex-row flex-wrap gap-4">
          <View className="flex-1 min-w-[45%]">
            <StatCard icon={TrendingUp} label="Ingresos" value={summary?.totals.income ?? 0} tone="success" />
          </View>
          <View className="flex-1 min-w-[45%]">
            <StatCard icon={TrendingDown} label="Gastos" value={summary?.totals.expenses ?? 0} tone="destructive" />
          </View>
          <View className="flex-1 min-w-[45%]">
            <StatCard icon={Wallet} label="Balance" value={balance} tone={balance >= 0 ? "success" : "destructive"} />
          </View>
        </View>

        {/* Chart */}
        {chartPoints.length > 0 && (
          <Card>
            <Text className="text-sm font-display text-foreground mb-4">Ingresos vs Gastos</Text>
            <TrendAreaChart points={chartPoints} />
          </Card>
        )}

        {/* Transactions */}
        <View>
          <Text className="text-sm font-sans-bold text-foreground mb-3">Transacciones</Text>
          {(transactions?.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={ChartColumn}
                title="Sin transacciones"
                description="No hay transacciones en el período seleccionado"
              />
            </Card>
          ) : (
            <Card variant="flat" className="p-2">
              {(transactions?.data ?? []).map((tx) => (
                <ListRow
                  key={tx.id}
                  icon={ReceiptText}
                  tone={tx.type === "income" ? "success" : "destructive"}
                  title={tx.description ?? `Transacción #${tx.id}`}
                  meta={new Date(tx.transaction_date).toLocaleDateString("es-CO")}
                  right={
                    <View className="items-end gap-1">
                      <Text
                        className={`text-sm font-num-semibold ${tx.type === "income" ? "text-success" : "text-destructive"}`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatCurrency(Number(tx.amount))}
                      </Text>
                      <Badge tone={tx.type === "income" ? "success" : "destructive"}>
                        {tx.type === "income" ? "Ingreso" : "Gasto"}
                      </Badge>
                    </View>
                  }
                />
              ))}
            </Card>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
