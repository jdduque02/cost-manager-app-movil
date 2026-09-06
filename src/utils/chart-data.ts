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

function txDate(t: TxLike): Date {
  const iso = t.transaction_date ?? t.created_at ?? "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Agrupa transacciones en los últimos `months` meses (por defecto 6, igual
 * que `cost-manager-web/src/components/views/Dashboard.tsx:194-211`).
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
  category: string;
  amount: number;
}

/** Top-N categorías con más gasto, igual que `Dashboard.tsx:214-226`. */
export function topCategorySpending(
  transactions: (TxLike & { category_id?: number | null })[],
  categoryMap: Record<number, string>,
  limit = 6,
): CategorySpendingPoint[] {
  const map: Record<number, number> = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const catId = t.category_id ?? -1;
    map[catId] = (map[catId] ?? 0) + Number(t.amount);
  }
  return Object.entries(map)
    .map(([catId, amount]) => ({
      category: categoryMap[Number(catId)] ?? "Por editar",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
