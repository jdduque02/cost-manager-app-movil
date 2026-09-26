/** Formatea un monto como pesos colombianos, sin decimales — usado en toda la app. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Fecha+hora es-CO de un instante que llega como epoch en ms serializado
 * ("1727000000000", así manda Keycloak sesiones/eventos) o como ISO.
 * `null`/inválido → "—".
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const asNumber = Number(value);
  const d = new Date(Number.isFinite(asNumber) ? asNumber : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
