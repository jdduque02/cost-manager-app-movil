import { Text, type TextProps } from "react-native";
import { formatCurrency } from "@/utils/format";

interface MoneyProps extends Omit<TextProps, "children"> {
  value: number;
  /** COP por defecto; USD con centavos (ver `formatCurrency`). */
  currency?: "COP" | "USD";
  className?: string;
}

/**
 * Cifra monetaria. `tabular-nums` es un no-op en NativeWind (no soporta
 * font-variant-numeric), así que se aplica `fontVariant` directamente.
 */
export function Money({ value, currency, className = "", style, ...rest }: MoneyProps) {
  return (
    <Text
      className={`font-num-semibold ${className}`}
      style={[{ fontVariant: ["tabular-nums"] }, style]}
      {...rest}
    >
      {formatCurrency(value, currency)}
    </Text>
  );
}
