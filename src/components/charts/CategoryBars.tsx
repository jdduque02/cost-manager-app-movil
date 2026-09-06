import { View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useChartColors } from "@/hooks/useChartColors";
import type { CategorySpendingPoint } from "@/utils/chart-data";

interface CategoryBarsProps {
  points: CategorySpendingPoint[];
  height?: number;
}

/**
 * Barras horizontales — los nombres de categoría en español ("Alimentación",
 * "Entretenimiento") no se leen rotados en un eje X de 390pt, que es como
 * los renderiza el `column` chart de la web.
 */
export function CategoryBars({ points, height = 220 }: CategoryBarsProps) {
  const colors = useChartColors();

  if (points.length === 0) {
    return (
      <View className="items-center justify-center py-10">
        <Text className="text-sm font-sans text-muted-foreground">
          No hay datos de gastos para mostrar.
        </Text>
      </View>
    );
  }

  const data = points.map((p) => ({
    value: p.amount,
    label: p.category,
    frontColor: colors.chart1,
  }));

  return (
    <BarChart
      data={data}
      horizontal
      barBorderRadius={8}
      height={height}
      frontColor={colors.chart1}
      yAxisThickness={0}
      xAxisThickness={1}
      xAxisColor={colors.border}
      yAxisTextStyle={{ color: colors.mutedFg, fontSize: 11 }}
      labelWidth={90}
    />
  );
}
