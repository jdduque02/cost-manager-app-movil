import { formatCurrency } from "@/utils/format";
import type { Trm } from "@/api/banking.api";

/** Saldos sumados por moneda y su total en COP (R6.1–R6.4); misma regla que `consolidate` de la web. */
export interface Consolidated {
  /** COP + USD×TRM; otras monedas fuera. null si hay saldo en USD y no hay TRM: solo desglose (R6.4). */
  total: number | null;
  /** Desglose por moneda ("$ 1.000 · US$ 250"), sin las monedas en 0. */
  breakdown: string;
  /** Bajo el total: el desglose si hay alguna moneda distinta de COP y "USD a TRM del {fecha}"; null sin total. */
  note: string | null;
}

/** `items`: [moneda, saldo] con los pasivos en negativo. */
export function consolidate(items: [string, number][], trm: Trm | null | undefined): Consolidated {
  const byCurrency: Record<string, number> = {};
  for (const [currency, n] of items) {
    const c = currency || "COP";
    byCurrency[c] = (byCurrency[c] ?? 0) + n;
  }
  const currencies = Object.keys(byCurrency)
    .filter((c) => byCurrency[c] !== 0)
    .sort();
  const breakdown = currencies.map((c) => formatCurrency(byCurrency[c], c)).join(" · ");
  const usd = byCurrency.USD ?? 0;
  // Sin saldo en USD el total no necesita TRM.
  if (usd !== 0 && !trm) return { total: null, breakdown, note: null };

  const total = Math.round(((byCurrency.COP ?? 0) + usd * (trm?.value ?? 0)) * 100) / 100;
  const trmDate =
    usd !== 0 && trm
      ? `USD a TRM del ${new Date(`${trm.valid_from.slice(0, 10)}T00:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}`
      : "";
  // Con solo EUR (o solo USD) el total no lo dice todo: el desglose muestra qué quedó fuera o se convirtió.
  const note = [currencies.some((c) => c !== "COP") ? breakdown : "", trmDate]
    .filter(Boolean)
    .join(" · ");
  return { total, breakdown, note: note || null };
}
