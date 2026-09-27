import type { TransactionType } from "@/types/transaction.types";
import type { GroupType } from "@/types/catalog.types";
import { type BadgeTone } from "@/components/ui/Badge";
import {
  TrendingUp,
  ShoppingBag,
  PiggyBank,
  ArrowLeftRight,
  type LucideIcon,
} from "@/components/ui/icons";

/**
 * Constantes de presentación de `TransactionType` compartidas entre pantallas
 * que crean/editan transacciones (lista de transacciones, confirmación de
 * transacción compartida desde notificación bancaria) — un solo lugar para
 * no divergir en etiquetas/colores/iconos entre esos flujos.
 */
export const TRANSACTION_TYPES: TransactionType[] = [
  "income",
  "expense",
  "investment",
  "transfer",
];

export const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  investment: "Inversión",
  transfer: "Transferencia",
};

export const TYPE_TONE: Record<TransactionType, BadgeTone> = {
  income: "success",
  expense: "destructive",
  investment: "primary",
  transfer: "info",
};

export const TYPE_ICON: Record<TransactionType, LucideIcon> = {
  income: TrendingUp,
  expense: ShoppingBag,
  investment: PiggyBank,
  transfer: ArrowLeftRight,
};

export const TYPE_AMOUNT_CLASS: Record<TransactionType, string> = {
  income: "text-success",
  expense: "text-destructive",
  investment: "text-primary",
  transfer: "text-info",
};

// GroupType (catálogo) no tiene equivalente para "transfer" — se agrupa como gasto.
export const TYPE_TO_GROUP_TYPE: Record<TransactionType, GroupType> = {
  income: "income",
  expense: "expense",
  investment: "investment",
  transfer: "expense",
};
