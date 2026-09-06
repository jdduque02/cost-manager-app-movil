import { View, Text } from "react-native";
import { IconTile } from "./IconTile";
import type { LucideIcon } from "./icons";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Estado vacío "dentro de card", como el de la web: tile + título + descripción + acción. */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <View className={`items-center gap-3 py-8 ${className}`}>
      <IconTile icon={icon} tone="muted" size="lg" />
      <View className="items-center gap-1">
        <Text className="text-sm font-sans-medium text-foreground text-center">{title}</Text>
        {description && (
          <Text className="text-xs font-sans text-muted-foreground text-center">
            {description}
          </Text>
        )}
      </View>
      {action}
    </View>
  );
}
