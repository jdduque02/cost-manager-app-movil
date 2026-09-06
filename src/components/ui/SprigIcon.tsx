import { Image, type ImageSourcePropType, type StyleProp, type ImageStyle } from "react-native";

const SPRIG_ICONS = {
  appIcon: require("../../../assets/sprig/sprig_app_icon.png"),
  appIconLight: require("../../../assets/sprig/sprig_app_icon_light.png"),
  appIconInverted: require("../../../assets/sprig/sprig_app_icon_inverted.png"),
  appIconMonochrome: require("../../../assets/sprig/sprig_app_icon_monochrome.png"),
  isotipo: require("../../../assets/sprig/sprig_isotipo.png"),
  budgetWallet: require("../../../assets/sprig/sprig_icon_budget_wallet.png"),
  receipt: require("../../../assets/sprig/sprig_icon_receipt.png"),
  reportsBars: require("../../../assets/sprig/sprig_icon_reports_bars.png"),
  reportsPie: require("../../../assets/sprig/sprig_icon_reports_pie.png"),
  moneyBag: require("../../../assets/sprig/sprig_icon_money_bag.png"),
} as const;

export type SprigIconName = keyof typeof SPRIG_ICONS;

type SprigIconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<SprigIconSize, number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 40,
  xl: 60,
};

interface SprigIconProps {
  name: SprigIconName;
  size?: SprigIconSize;
  color?: string;
  style?: StyleProp<ImageStyle>;
}

export function SprigIcon({ name, size = "md", color, style }: SprigIconProps) {
  const px = SIZE_MAP[size];

  return (
    <Image
      source={SPRIG_ICONS[name]}
      style={[
        { width: px, height: px, resizeMode: "contain" },
        color ? { tintColor: color } : undefined,
        style,
      ]}
    />
  );
}

export { SPRIG_ICONS };
export type { SprigIconProps };
