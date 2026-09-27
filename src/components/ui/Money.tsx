import { Text, type TextProps } from "react-native";
import { formatCurrency } from "@/utils/format";

interface MoneyProps extends Omit<TextProps, "children"> {
  value: number;
  className?: string;
}

/**
 * Cifra monetaria. `tabular-nums` es un no-op en NativeWind (no soporta
 * font-variant-numeric), así que se aplica `fontVariant` directamente.
 */
export function Money({ value, className = "", style, ...rest }: MoneyProps) {
  return (
    <Text
      className={`font-num-semibold ${className}`}
      style={[{ fontVariant: ["tabular-nums"] }, style]}
      {...rest}
    >
      {formatCurrency(value)}
    </Text>
  );
}
