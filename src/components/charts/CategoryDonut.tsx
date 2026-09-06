import { useState, useCallback } from "react";
import { View, Text, type LayoutChangeEvent } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { useChartColors } from "@/hooks/useChartColors";
import { formatCurrency } from "@/utils/format";
import type { CategorySpendingPoint } from "@/utils/chart-data";

interface CategoryDonutProps {
  points: CategorySpendingPoint[];
}

/**
 * Dona de gasto por categoría, orden de colores idéntico al de
 * `cost-manager-web/src/components/views/Dashboard.tsx:229-236`. Las
 * etiquetas van en una leyenda debajo (no como `dataLabels` externos del
 * donut web) — a ancho de teléfono son ilegibles pegadas a la dona.
 */
export function CategoryDonut({ points }: CategoryDonutProps) {
  const colors = useChartColors();
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const paletteOrder = [
    colors.chart1,
    colors.chart5,
    colors.chart2,
    colors.chart3,
    colors.chart4,
    colors.destructive,
  ];

  const data = points.map((p, i) => ({
    value: p.amount,
    color: paletteOrder[i % paletteOrder.length],
    text: p.category,
  }));

  const radius = width > 0 ? Math.min(width, 220) / 2.6 : 70;

  if (points.length === 0) {
    return (
      <View className="items-center justify-center py-10">
        <Text className="text-sm font-sans text-muted-foreground">
          No hay datos de gastos para mostrar.
        </Text>
      </View>
    );
  }

  return (
    <View onLayout={onLayout}>
      <View className="items-center py-2">
        {width > 0 && (
          <PieChart
            data={data}
            donut
            radius={radius}
            innerRadius={radius * 0.6}
            innerCircleColor={colors.card}
            strokeWidth={3}
            strokeColor={colors.card}
          />
        )}
      </View>
      <View className="gap-2 mt-3">
        {points.map((p, i) => (
          <View key={p.category} className="flex-row items-center gap-2">
            <View
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: paletteOrder[i % paletteOrder.length] }}
            />
            <Text className="flex-1 text-xs font-sans text-muted-foreground" numberOfLines={1}>
              {p.category}
            </Text>
            <Text className="text-xs font-num-semibold text-foreground">
              {formatCurrency(p.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
