import { View, Text, type ViewProps } from "react-native";

export type BadgeTone = "muted" | "success" | "destructive" | "warning" | "primary" | "info";
// Alias retrocompatibles de la variante vieja.
type LegacyBadgeVariant = "default" | "investment";
export type BadgeVariant = BadgeTone | LegacyBadgeVariant;

interface BadgeProps extends ViewProps {
  tone?: BadgeVariant;
  /** @deprecated usar `tone` */
  variant?: BadgeVariant;
  children: React.ReactNode;
}

function normalizeTone(tone: BadgeVariant): BadgeTone {
  if (tone === "default") return "muted";
  if (tone === "investment") return "primary";
  return tone;
}

const boxStyles: Record<BadgeTone, string> = {
  muted: "bg-surface-2 border-border",
  success: "bg-success/10 border-success/20",
  destructive: "bg-destructive/10 border-destructive/20",
  warning: "bg-warning/10 border-warning/20",
  primary: "bg-primary/10 border-primary/20",
  info: "bg-info/10 border-info/20",
};

const textStyles: Record<BadgeTone, string> = {
  muted: "text-muted-foreground",
  success: "text-success",
  destructive: "text-destructive",
  warning: "text-warning",
  primary: "text-primary",
  info: "text-info",
};

export function Badge({ tone, variant, children, className = "", ...props }: BadgeProps) {
  const t = normalizeTone(tone ?? variant ?? "muted");
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 self-start ${boxStyles[t]} ${className}`}
      {...props}
    >
      <Text className={`text-xs font-sans-medium ${textStyles[t]}`}>{children}</Text>
    </View>
  );
}
