import { View, Text } from "react-native";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    <View className={`gap-4 ${className}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-display text-2xl text-foreground" style={{ letterSpacing: -0.4 }}>
            {title}
          </Text>
          {subtitle && (
            <Text className="mt-1 text-sm font-sans text-muted-foreground">{subtitle}</Text>
          )}
        </View>
      </View>
      {actions && <View className="flex-row items-center gap-2">{actions}</View>}
    </View>
  );
}
