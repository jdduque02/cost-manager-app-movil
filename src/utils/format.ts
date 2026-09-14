/** Formatea un monto como pesos colombianos, sin decimales — usado en toda la app. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formato compacto del eje Y de las gráficas de área — replica al pie la
 * `kFormatter` de `Sprig-web/src/components/views/Dashboard.tsx:39-42` para
 * paridad visual: símbolo `$` pegado, `k` para miles, sin separadores.
 */
export function formatCompactCurrency(label: string): string {
  const v = Number(label);
  if (!Number.isFinite(v)) return label;
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;
}
