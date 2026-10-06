/**
 * Formatea un monto en pesos colombianos sin decimales (usado en toda la app);
 * con otra moneda (código ISO de 3 letras: USD, EUR…), con centavos.
 * Nunca sumes montos de monedas distintas.
 */
export function formatCurrency(amount: number, currency: string = "COP"): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  }).format(amount);
}

/** TRM (COP por 1 USD) con dos decimales y separadores es-CO, sin símbolo: "4.100,25". */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate);
}

/**
 * Fecha+hora es-CO de un instante que llega como epoch en ms serializado
 * ("1727000000000", así manda Keycloak sesiones/eventos) o como ISO.
 * `null`/inválido → "—".
 *
 * - `hour12: false` fuerza 24 h: el marcador "a. m." de es-CO sale con espacio
 *   interno ("a. m.") y quedaba pegado al texto.
 * - Solo un string de dígitos se interpreta como epoch; `Number()` aceptaba
 *   "1e3", "0x10" o " 12 " y los pasaba como ms silenciosamente.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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
