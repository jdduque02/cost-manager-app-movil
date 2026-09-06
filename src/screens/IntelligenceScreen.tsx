import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { apiClient } from "@/api/client";
import * as catalogApi from "@/api/catalog.api";
import * as usersApi from "@/api/users.api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";
import { Shield, TrendingUp, GraduationCap, Rocket, House, Sunset, type LucideIcon } from "@/components/ui/icons";
import { PROFILE_BUCKET_LABELS, type ProfileBucket } from "@/types/catalog.types";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface TaxSummary {
  fiscal_year: number;
  total_income: number;
  total_assets: number;
  total_liabilities: number;
  patrimony: number | null;
  income_in_uvt: number | null;
  assets_in_uvt: number | null;
  uvt_value: number;
  must_declare: boolean;
  estimated_tax: number | null;
  created_at: string;
}

interface TransactionSummaryByCategory {
  category_id: number;
  income: number;
  expenses: number;
  investments: number;
  count: number;
}

interface TransactionSummary {
  totals: { income: number; expenses: number; investments: number; count: number };
  by_category: TransactionSummaryByCategory[];
}

const EDUCATION_SECTIONS: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Regla 50-20-30",
    description:
      "Destina el 50% de tus ingresos a necesidades básicas, 20% a ahorro e inversiones, y 30% a gastos personales.",
    icon: TrendingUp,
  },
  {
    title: "Fondo de emergencia",
    description: "Mantén entre 3 y 6 meses de gastos fijos en una cuenta de fácil acceso.",
    icon: Shield,
  },
  {
    title: "Diversificación",
    description: "No pongas todos tus huevos en la misma canasta. Diversifica tus inversiones según tu tolerancia al riesgo.",
    icon: TrendingUp,
  },
];

const LIFE_STAGES: { stage: string; icon: LucideIcon; tips: string[] }[] = [
  {
    stage: "Inicio de carrera",
    icon: GraduationCap,
    tips: ["Enfócate en crear hábitos de ahorro", "Evita deudas de consumo", "Invierte en tu educación"],
  },
  {
    stage: "Crecimiento",
    icon: Rocket,
    tips: ["Aumenta tu tasa de ahorro", "Considera inversiones a mediano plazo", "Protege tu ingreso con seguros"],
  },
  {
    stage: "Consolidación",
    icon: House,
    tips: ["Planifica el retiro", "Diversifica inversiones", "Reduce deudas"],
  },
  {
    stage: "Retiro",
    icon: Sunset,
    tips: ["Vive de tus rendimientos", "Mantén gastos bajo control", "Goza del fruto de tu esfuerzo"],
  },
];

export default function IntelligenceScreen() {
  const userId = useAuthStore((s) => s.userId);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: taxSummary, isLoading: taxLoading } = useOfflineQuery<TaxSummary | null>(
    {
      queryKey: ["intelligence-tax", userId, selectedYear],
      queryFn: async () => {
        const { data } = await apiClient.get<TaxSummary | TaxSummary[]>(
          `/users/${userId}/intelligence/tax-summary`,
          { params: { year: selectedYear } },
        );
        return Array.isArray(data) ? data[0] : data;
      },
      enabled: !!userId,
    },
    async () => null,
  );

  const monthStart = useMemo(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    [],
  );
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: monthSummary, isLoading: summaryLoading } = useOfflineQuery<TransactionSummary>(
    {
      queryKey: ["intelligence-month-summary", userId, monthStart, today],
      queryFn: async () => {
        const { data } = await apiClient.get<TransactionSummary>(
          `/users/${userId}/transactions/summary`,
          { params: { date_from: monthStart, date_to: today, group_by: "month" } },
        );
        return {
          totals: {
            income: Number(data.totals?.income ?? 0),
            expenses: Number(data.totals?.expenses ?? 0),
            investments: Number(data.totals?.investments ?? 0),
            count: Number(data.totals?.count ?? 0),
          },
          by_category: (data.by_category ?? []).map((c) => ({
            ...c,
            income: Number(c.income ?? 0),
            expenses: Number(c.expenses ?? 0),
            investments: Number(c.investments ?? 0),
          })),
        };
      },
      enabled: !!userId,
    },
    async () => ({ totals: { income: 0, expenses: 0, investments: 0, count: 0 }, by_category: [] }),
  );

  const { data: categories, isLoading: catLoading } = useOfflineQuery(
    { queryKey: ["categories"], queryFn: catalogApi.getCategories },
    async () => [],
  );

  const { data: profile, isLoading: profileLoading } = useOfflineQuery(
    {
      queryKey: ["financial-profile", userId],
      queryFn: () => usersApi.getFinancialProfile(userId as number),
      enabled: !!userId,
    },
    async () => null,
  );

  const isLoading = taxLoading || summaryLoading || catLoading || profileLoading;

  const savingsRate =
    monthSummary && monthSummary.totals.income > 0
      ? ((monthSummary.totals.income - monthSummary.totals.expenses) / monthSummary.totals.income) * 100
      : 0;

  const topExpenseCategory = useMemo(() => {
    if (!monthSummary?.by_category.length) return null;
    const top = [...monthSummary.by_category].sort((a, b) => b.expenses - a.expenses)[0];
    return categories?.find((c) => c.id === top.category_id)?.name ?? null;
  }, [monthSummary, categories]);

  const budgetBuckets = useMemo(() => {
    if (!profile || !categories || !monthSummary) return [];
    const income = profile.monthly_income ?? 0;
    const ratioByBucket: Record<ProfileBucket, number> = {
      needs: profile.needs_ratio,
      wants: profile.wants_ratio,
      savings: profile.savings_ratio,
      investment: profile.investment_ratio,
      debt: profile.max_debt_ratio,
    };
    return (Object.keys(PROFILE_BUCKET_LABELS) as ProfileBucket[]).map((bucket) => {
      const categoryIds = new Set(
        categories.filter((c) => c.profile_bucket === bucket).map((c) => c.id),
      );
      const spent = monthSummary.by_category
        .filter((c) => categoryIds.has(c.category_id))
        .reduce((s, c) => s + c.expenses, 0);
      return {
        bucket,
        label: PROFILE_BUCKET_LABELS[bucket],
        // Los ratios del perfil vienen en escala 0-100 (porcentaje, ver
        // constraint `<= 100.00` en financial-profile.entity.ts del backend),
        // no 0-1 — sin el /100 esto multiplicaba el ingreso por hasta 100.
        allocated: income * ((ratioByBucket[bucket] ?? 0) / 100),
        spent,
      };
    });
  }, [profile, categories, monthSummary]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6 gap-3">
        <Skeleton width={200} height={28} />
        <Skeleton height={120} />
        <Skeleton height={120} />
        <Skeleton height={100} />
        <Skeleton height={100} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 pt-4 gap-7 pb-6">
        <PageHeader title="Inteligencia" subtitle="Resumen financiero y fiscal" />

        {/* Financial Summary (mes actual) */}
        <Card>
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
            Resumen del mes
          </Text>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-sm font-sans text-foreground">Ingresos</Text>
              <Text className="text-sm font-num-semibold text-success">
                {formatCurrency(monthSummary?.totals.income ?? 0)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm font-sans text-foreground">Gastos</Text>
              <Text className="text-sm font-num-semibold text-destructive">
                {formatCurrency(monthSummary?.totals.expenses ?? 0)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm font-sans text-foreground">Tasa de ahorro</Text>
              <Text className="text-sm font-num-semibold text-primary">{savingsRate.toFixed(1)}%</Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-sans text-foreground">Mayor gasto</Text>
              <Badge tone="warning">{topExpenseCategory ?? "N/A"}</Badge>
            </View>
          </View>
        </Card>

        {/* Tax Summary */}
        <Card>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground">
              Resumen Fiscal
            </Text>
            <View className="flex-row gap-1">
              {[currentYear - 1, currentYear].map((y) => (
                <Pressable key={y} onPress={() => setSelectedYear(y)}>
                  <Badge tone={selectedYear === y ? "primary" : "muted"}>{String(y)}</Badge>
                </Pressable>
              ))}
            </View>
          </View>
          {taxSummary ? (
            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-sm font-sans text-foreground">Ingresos del año</Text>
                <Text className="text-sm font-num-semibold text-foreground">
                  {formatCurrency(taxSummary.total_income)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm font-sans text-foreground">Patrimonio</Text>
                <Text className="text-sm font-num-semibold text-foreground">
                  {taxSummary.patrimony != null ? formatCurrency(taxSummary.patrimony) : "—"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm font-sans text-foreground">Valor UVT {taxSummary.fiscal_year}</Text>
                <Text className="text-sm font-num-semibold text-info">
                  {formatCurrency(taxSummary.uvt_value)}
                </Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-sans text-foreground">Obligado a declarar renta</Text>
                <Badge tone={taxSummary.must_declare ? "destructive" : "success"}>
                  {taxSummary.must_declare ? "Sí" : "No"}
                </Badge>
              </View>
              {taxSummary.estimated_tax != null && (
                <View className="flex-row justify-between">
                  <Text className="text-sm font-sans text-foreground">Impuesto estimado</Text>
                  <Text className="text-sm font-num-semibold text-destructive">
                    {formatCurrency(taxSummary.estimated_tax)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text className="text-sm font-sans text-muted-foreground">
              Sin datos fiscales para {selectedYear}.
            </Text>
          )}
        </Card>

        {/* Budget Bars */}
        {budgetBuckets.length > 0 && (
          <Card>
            <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
              Presupuesto por perfil (mes actual)
            </Text>
            <View className="gap-4">
              {budgetBuckets.map((bucket) => {
                const progress = bucket.allocated > 0 ? (bucket.spent / bucket.allocated) * 100 : 0;
                const isOver = progress > 100;
                return (
                  <View key={bucket.bucket}>
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-sm font-sans-medium text-foreground">{bucket.label}</Text>
                      <Text
                        className={`text-xs font-sans-semibold ${isOver ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {formatCurrency(bucket.spent)} / {formatCurrency(bucket.allocated)}
                      </Text>
                    </View>
                    <View className="h-2 bg-muted rounded-full overflow-hidden">
                      <View
                        className={`h-full rounded-full ${isOver ? "bg-destructive" : progress > 80 ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Financial Education */}
        <Card>
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
            Educación Financiera
          </Text>
          <View className="gap-3">
            {EDUCATION_SECTIONS.map((section) => (
              <View key={section.title} className="flex-row gap-3">
                <IconTile icon={section.icon} tone="primary" size="sm" />
                <View className="flex-1">
                  <Text className="text-sm font-sans-semibold text-foreground">{section.title}</Text>
                  <Text className="text-xs font-sans text-muted-foreground mt-0.5">
                    {section.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Life Stage Guide */}
        <Card>
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
            Guía por Etapa de Vida
          </Text>
          <View className="gap-4">
            {LIFE_STAGES.map((stage) => (
              <View key={stage.stage}>
                <View className="flex-row items-center gap-2 mb-1">
                  <IconTile icon={stage.icon} tone="muted" size="sm" />
                  <Text className="text-sm font-sans-semibold text-foreground">{stage.stage}</Text>
                </View>
                <View className="ml-11 gap-0.5">
                  {stage.tips.map((tip, i) => (
                    <Text key={i} className="text-xs font-sans text-muted-foreground">
                      • {tip}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
