import { useMemo } from "react";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";

/**
 * Mismas llaves que `cost-manager-web/src/lib/hooks/use-chart-colors.ts`, así
 * que la configuración de gráficas porta línea a línea. RN no tiene
 * `getComputedStyle`; la fuente es el tema resuelto indexando `PALETTE`.
 */
export function useChartColors() {
  const { resolvedScheme } = useAppTheme();

  return useMemo(() => {
    const c = PALETTE[resolvedScheme];
    return {
      chart1: c.chart1,
      chart2: c.chart2,
      chart3: c.chart3,
      chart4: c.chart4,
      chart5: c.chart5,
      border: c.border,
      mutedFg: c.mutedForeground,
      card: c.card,
      cardBorder: c.border,
      foreground: c.foreground,
      destructive: c.destructive,
      primary: c.primary,
      success: c.success,
      surface2: c.surface2,
      isDark: resolvedScheme === "dark",
    };
  }, [resolvedScheme]);
}
