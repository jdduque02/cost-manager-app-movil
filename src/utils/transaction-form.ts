import type {
  PaymentMethod,
  FixedType,
  FixedFrequency,
  PatrimonyKind,
  CreateTransactionRecordDto,
} from "@/types/transaction.types";

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
