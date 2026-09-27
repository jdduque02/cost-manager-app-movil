/** Duración (ms) de la animación de entrada compartida por los tres charts de `src/components/charts`. */
export const CHART_ANIMATION_DURATION = 700;

export interface MonthlyPoint {
  label: string;
  income: number;
  expenses: number;
}

interface TxLike {
  type: string;
  amount: number;
  transaction_date?: string | null;
  created_at?: string;
}

export function txDate(t: TxLike): Date {
  // `||` (no `??`): la base manda `transaction_date: ""` (no null) cuando no
  // hay fecha, y `??` deja caer a 1900. Divergencia de corrección adrede vs
  // Sprig-web/src/components/views/Dashboard.tsx:172-176 que usa `??`.
  const iso = t.transaction_date || t.created_at || "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Agrupa transacciones en los últimos `months` meses (por defecto 6, igual
 * que `Sprig-web/src/components/views/Dashboard.tsx:194-211`).
 * Reemplaza el bucketizador diario anterior (30 barras) que desbordaba la
 * card en pantalla de teléfono.
 */
export function groupByMonth(transactions: TxLike[], months = 6): MonthlyPoint[] {
  const now = new Date();
  const points: MonthlyPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("es-CO", { month: "short" });
    const monthTxs = transactions.filter((t) => {
      const td = txDate(t);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    points.push({
      label,
      income: monthTxs
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0),
      expenses: monthTxs
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0),
    });
  }

  return points;
}

export interface CategorySpendingPoint {
  /** `category_id` del agregador — clave estable para keys de React. */
  category_id?: number;
  category: string;
  amount: number;
}

/**
 * Top-N categorías con más gasto, igual que
 * `Sprig-web/src/components/views/Dashboard.tsx:214-226`. La web filtra
 * `currentMonthTxs` (solo el mes actual) aguas arriba; aquí el scope por mes
 * es un parámetro explícito que da la misma semántica sin callers previos.
 */
export function topCategorySpending(
  transactions: (TxLike & { category_id?: number | null })[],
  categoryMap: Record<number, string>,
  limit = 6,
  month?: string,
): CategorySpendingPoint[] {
  const map: Record<number, number> = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    if (month && !isInMonth(t, month)) continue;
    const amount = Number(t.amount);
    if (!(amount > 0)) continue; // reembolsos/negativos rompen el PieChart
    const catId = t.category_id ?? -1;
    map[catId] = (map[catId] ?? 0) + amount;
  }
  return Object.entries(map)
    .map(([catId, amount]) => ({
      category_id: Number(catId),
      category: categoryMap[Number(catId)] ?? "Por editar",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/** True si la tx cae en el mes `yyyy-mm` (mismas reglas de fecha que `groupByMonth`). */
function isInMonth(t: TxLike, month: string): boolean {
  const [y = NaN, m = NaN] = month.split("-").map(Number);
  const td = txDate(t);
  return td.getFullYear() === y && td.getMonth() === m - 1;
}
