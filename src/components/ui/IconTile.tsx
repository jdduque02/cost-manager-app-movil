import { View } from "react-native";
import type { LucideIcon } from "./icons";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import type { BadgeTone } from "./Badge";

interface IconTileProps {
  icon: LucideIcon;
  tone?: BadgeTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const BOX: Record<"sm" | "md" | "lg", string> = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-xl",
};

const ICON_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 18,
  md: 20,
  lg: 24,
};

const BG: Record<BadgeTone, string> = {
  muted: "bg-surface-2",
  success: "bg-success/10",
  destructive: "bg-destructive/10",
  warning: "bg-warning/10",
  primary: "bg-primary/10",
  info: "bg-info/10",
};

const ICON_COLOR_KEY: Record<BadgeTone, keyof (typeof PALETTE)["light"]> = {
  muted: "mutedForeground",
  success: "success",
  destructive: "destructive",
  warning: "warning",
  primary: "primary",
  info: "info",
};

export function IconTile({ icon: Icon, tone = "muted", size = "md", className = "" }: IconTileProps) {
  const { resolvedScheme } = useAppTheme();
  const color = PALETTE[resolvedScheme][ICON_COLOR_KEY[tone]];

  return (
    <View className={`items-center justify-center ${BOX[size]} ${BG[tone]} ${className}`}>
      <Icon size={ICON_PX[size]} color={color} strokeWidth={2} />
    </View>
  );
}
