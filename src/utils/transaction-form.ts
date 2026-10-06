import type {
  PaymentMethod,
  FixedType,
  FixedFrequency,
  PatrimonyKind,
  CreateTransactionRecordDto,
  TransactionRecordResponse,
} from "@/types/transaction.types";
import { formatCurrency, formatRate } from "@/utils/format";

/** Opciones de método de pago, mismo set y orden que TransactionDialog.tsx en la web. */
export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "debit_card", label: "Tarjeta débito" },
  { value: "credit_card", label: "Tarjeta crédito" },
  { value: "digital_wallet", label: "Billetera digital" },
  { value: "mobile_payment", label: "Pago móvil" },
];

export const FIXED_TYPE_LABELS: Record<FixedType, string> = {
  deduction: "Deducción fija",
  fixed_income: "Ingreso fijo",
};

export const FIXED_FREQUENCY_LABELS: Record<FixedFrequency, string> = {
  biweekly: "Quincenal",
  monthly: "Mensual",
};

/** Tipo de "fijo" por defecto según el tipo de transacción (igual que la web). */
export function defaultFixedType(
  type: CreateTransactionRecordDto["type"],
): FixedType {
  return type === "income" ? "fixed_income" : "deduction";
}

/**
 * "Patrimonio asociado" (cuenta / activo / pasivo) es mutuamente excluyente:
 * solo uno de account_id/asset_id/liability_id puede estar seteado a la vez.
 * Estos helpers evitan que el formulario deje dos campos seteados al cambiar
 * de tipo de patrimonio.
 */
export function patrimonyKindOf(dto: {
  account_id?: number | null;
  asset_id?: number | null;
  liability_id?: number | null;
}): PatrimonyKind | null {
  if (dto.account_id) return "account";
  if (dto.asset_id) return "asset";
  if (dto.liability_id) return "liability";
  return null;
}

export function clearPatrimonyFields<
  T extends { account_id?: number; asset_id?: number; liability_id?: number },
>(form: T): T {
  return { ...form, account_id: undefined, asset_id: undefined, liability_id: undefined };
}

export function setPatrimony<
  T extends { account_id?: number; asset_id?: number; liability_id?: number },
>(form: T, kind: PatrimonyKind, id: number): T {
  const cleared = clearPatrimonyFields(form);
  if (kind === "account") return { ...cleared, account_id: id };
  if (kind === "asset") return { ...cleared, asset_id: id };
  return { ...cleared, liability_id: id };
}

/**
 * Hoy en America/Bogota (YYYY-MM-DD). `toISOString()` daba la fecha UTC: de
 * 19:00 a 23:59 en Colombia ya era "mañana". Colombia es UTC-5 fijo (sin
 * horario de verano), así que basta restar 5 h, sin depender del Intl de Hermes.
 */
export function todayBogota(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Monedas que el API acepta en una transacción (DTO `IsIn(['COP','USD'])`). */
export const TX_CURRENCIES = ["COP", "USD"] as const;

/**
 * R7.1: la transacción hereda la moneda del producto solo si el monto está
 * vacío. Con un monto ya escrito la moneda se queda (y sale el aviso de R7.3):
 * un cambio silencioso guardaría US$200.000 donde el usuario escribió $200.000.
 */
export function inheritCurrency<T extends { amount?: number; currency?: string }>(
  form: T,
  productCurrency?: string,
): T {
  // Un producto en otra moneda (EUR) no se hereda: el API la rechazaría con su mensaje (R1.5).
  return form.amount || !TX_CURRENCIES.some((c) => c === productCurrency)
    ? form
    : { ...form, currency: productCurrency };
}

/**
 * Aviso antes de guardar cuando habrá conversión con TRM (R7.3): solo para el
 * par COP/USD (otra moneda distinta la rechaza el API con su mensaje). Sin
 * cifra a propósito: la TRM es la de la fecha y la resuelve el servidor.
 */
export function fxNotice(txCurrency?: string, productCurrency?: string): string | null {
  const pair = ["COP", "USD"];
  if (!txCurrency || !productCurrency || txCurrency === productCurrency) return null;
  if (!pair.includes(txCurrency) || !pair.includes(productCurrency)) return null;
  return `Se registrará en ${productCurrency} con la TRM oficial de la fecha`;
}

/**
 * Segunda línea de la fila cuando hubo conversión (R7.4): el convertido en la
 * moneda del producto, que es la otra del par COP/USD (solo ese par convierte).
 */
export function convertedLine(
  tx: Pick<TransactionRecordResponse, "currency" | "applied_amount" | "fx_rate">,
): string | null {
  if (tx.applied_amount == null || tx.fx_rate == null) return null;
  const productCurrency = tx.currency === "USD" ? "COP" : "USD";
  return `≈ ${formatCurrency(tx.applied_amount, productCurrency)} · TRM ${formatRate(tx.fx_rate)} (aprox.; tu banco puede usar otra tasa)`;
}

/** Ayuda de la pestaña "Pasivo": el API sube la deuda con gastos y la baja con ingresos/inversiones (R6.11). */
export const LIABILITY_LINK_HINT =
  "Un gasto ligado a un pasivo sube la deuda; un ingreso o una inversión la bajan. Para pagar la tarjeta usa «Transferir».";

export const INSTALLMENTS_MIN = 1;
export const INSTALLMENTS_MAX = 120;
export const DUE_DAY_MIN = 1;
export const DUE_DAY_MAX = 31;
export const REMINDER_DAYS_MIN = 0;
export const REMINDER_DAYS_MAX = 30;

/**
 * Valida los subcampos de transacción fija/cuotas antes de enviar el
 * formulario — replica los límites de TransactionDialog.tsx en la web.
 * Devuelve el primer mensaje de error encontrado, o `null` si todo es válido.
 */
export function validateFixedAndInstallments(dto: {
  installments?: number;
  due_day?: number;
  reminder_days?: number;
}): string | null {
  if (
    dto.installments !== undefined &&
    (dto.installments < INSTALLMENTS_MIN || dto.installments > INSTALLMENTS_MAX)
  ) {
    return `Las cuotas deben estar entre ${INSTALLMENTS_MIN} y ${INSTALLMENTS_MAX}`;
  }
  if (
    dto.due_day !== undefined &&
    (dto.due_day < DUE_DAY_MIN || dto.due_day > DUE_DAY_MAX)
  ) {
    return `El día de vencimiento debe estar entre ${DUE_DAY_MIN} y ${DUE_DAY_MAX}`;
  }
  if (
    dto.reminder_days !== undefined &&
    (dto.reminder_days < REMINDER_DAYS_MIN || dto.reminder_days > REMINDER_DAYS_MAX)
  ) {
    return `El recordatorio debe estar entre ${REMINDER_DAYS_MIN} y ${REMINDER_DAYS_MAX} días`;
  }
  return null;
}
