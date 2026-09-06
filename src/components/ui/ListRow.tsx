import { Pressable, View, Text } from "react-native";
import { IconTile } from "./IconTile";
import type { BadgeTone } from "./Badge";
import type { LucideIcon } from "./icons";
import { formatCurrency } from "@/utils/format";

interface ListRowProps {
  icon: LucideIcon;
  tone?: BadgeTone;
  title: string;
  meta?: string;
  amount?: number;
  amountPrefix?: "+" | "-" | "";
  amountClassName?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function ListRow({
  icon,
  tone = "muted",
  title,
  meta,
  amount,
  amountPrefix = "",
  amountClassName = "text-foreground",
  right,
  onPress,
  onLongPress,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row items-center gap-3 rounded-xl px-2 py-2.5"
      android_ripple={onPress ? { color: "rgba(0,0,0,0.05)" } : undefined}
    >
      <IconTile icon={icon} tone={tone} size="sm" />
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-sans-medium text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {meta && (
          <Text className="text-xs font-sans text-muted-foreground mt-0.5" numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
      {right ??
        (amount !== undefined && (
          <Text className={`text-sm font-num-semibold ${amountClassName}`} style={{ fontVariant: ["tabular-nums"] }}>
            {amountPrefix}
            {formatCurrency(amount)}
          </Text>
        ))}
    </Pressable>
  );
}
