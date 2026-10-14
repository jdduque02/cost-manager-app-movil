const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hoy (YYYY-MM-DD) en la zona del usuario. `toISOString()` da la fecha UTC y de
 * 19:00 a 23:59 en Colombia ya sería "mañana". Sin zona, con zona inválida o si
 * `Intl` falla (Hermes), respaldo fijo UTC-5: Colombia no tiene horario de verano.
 */
export function todayInTimeZone(timezone?: string, now: Date = new Date()): string {
  if (timezone) {
    try {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
      if (ISO_DAY.test(day)) return day;
    } catch {
      // zona inválida o Intl no disponible: cae al respaldo
    }
  }
  return new Date(now.getTime() - FIVE_HOURS_MS).toISOString().slice(0, 10);
}

/** Suma `n` días (puede ser negativo) a una cadena YYYY-MM-DD, sin `Date` local. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Días enteros de `from` a `to` (YYYY-MM-DD), negativo si `to` es anterior. */
export function daysBetween(from: string, to: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Primer día del mes de `day`. */
export function monthStart(day: string): string {
  return `${day.slice(0, 8)}01`;
}

/** Último día del mes anterior al de `day`. */
export function lastDayOfPreviousMonth(day: string): string {
  return addDays(monthStart(day), -1);
}
