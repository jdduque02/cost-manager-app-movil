import { View, Text } from "react-native";
import { Card } from "./Card";
import { Badge, type BadgeTone } from "./Badge";
import { IconTile } from "./IconTile";
import { Money } from "./Money";
import type { LucideIcon } from "./icons";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  isCurrency?: boolean;
  badge?: { label: string; tone?: BadgeTone };
  tone?: BadgeTone;
  onPress?: () => void;
}

export function StatCard({
  icon,
  label,
  value,
  isCurrency = true,
  badge,
  tone = "primary",
  onPress,
}: StatCardProps) {
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between">
        <IconTile icon={icon} tone={tone} size="md" />
        {badge && <Badge tone={badge.tone ?? "muted"}>{badge.label}</Badge>}
      </View>
      <Text className="mt-5 text-xs font-sans-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
      {isCurrency && typeof value === "number" ? (
        <Money value={value} className="mt-1 text-2xl text-foreground" />
      ) : (
        <Text className="mt-1 font-display text-2xl text-foreground" style={{ letterSpacing: -0.4 }}>
          {value}
        </Text>
      )}
    </Card>
  );
}
