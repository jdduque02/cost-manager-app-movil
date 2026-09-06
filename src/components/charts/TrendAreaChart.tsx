import { useState, useCallback } from "react";
import { View, Text, type LayoutChangeEvent } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useChartColors } from "@/hooks/useChartColors";
import type { MonthlyPoint } from "@/utils/chart-data";

function kFormatter(label: string): string {
  const v = Number(label);
  if (!Number.isFinite(v)) return label;
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;
}

interface TrendAreaChartProps {
  points: MonthlyPoint[];
  height?: number;
}

/**
 * Reemplaza los dos `BarChart` anteriores (dashboard y ReportsScreen), que
 * grafican 30 barras diarias desbordando la card y cuya leyenda prometía
 * ingresos+gastos mientras solo se graficaba ingresos. Aquí la leyenda se
 * deriva del mismo arreglo que alimenta las series, así que no puede mentir.
 */
export function TrendAreaChart({ points, height = 180 }: TrendAreaChartProps) {
  const colors = useChartColors();
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const incomeData = points.map((p) => ({ value: p.income, label: p.label }));
  const expenseData = points.map((p) => ({ value: p.expenses }));

  const initialSpacing = 16;
  const endSpacing = 8;
  const spacing =
    width > 0 && points.length > 1
      ? Math.max((width - initialSpacing - endSpacing) / (points.length - 1), 24)
      : 40;

  return (
    <View>
      <View className="flex-row justify-end gap-4 mb-2">
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.chart1 }} />
          <Text className="text-xs font-sans text-muted-foreground">Ingresos</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.chart5 }} />
          <Text className="text-xs font-sans text-muted-foreground">Gastos</Text>
        </View>
      </View>
      <View onLayout={onLayout}>
        {width > 0 && (
          <LineChart
            areaChart
            curved
            data={incomeData}
            data2={expenseData}
            width={width - 20}
            height={height}
            spacing={spacing}
            initialSpacing={initialSpacing}
            endSpacing={endSpacing}
            disableScroll
            color1={colors.chart1}
            color2={colors.chart5}
            thickness1={2.5}
            thickness2={2.5}
            startFillColor1={colors.chart1}
            endFillColor1={colors.chart1}
            startOpacity1={0.16}
            endOpacity1={0.02}
            startFillColor2={colors.chart5}
            endFillColor2={colors.chart5}
            startOpacity2={0.16}
            endOpacity2={0.02}
            hideDataPoints
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={colors.border}
            rulesColor={colors.border}
            rulesType="dashed"
            noOfSections={4}
            formatYLabel={kFormatter}
            yAxisTextStyle={{ color: colors.mutedFg, fontSize: 11 }}
            xAxisLabelTextStyle={{ color: colors.mutedFg, fontSize: 11 }}
          />
        )}
      </View>
    </View>
  );
}
