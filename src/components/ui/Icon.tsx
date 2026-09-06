import { View } from "react-native";

type IconSize = "xs" | "sm" | "md" | "lg";

const SIZE_MAP: Record<IconSize, number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
};

interface IconProps {
  name: string;
  size?: IconSize;
  color?: string;
  strokeWidth?: number;
}

function SvgPath({ d, color, sw }: { d: string; color: string; sw: number }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
      }}
    >
      {/* SVG path rendered via native Image or Text fallback */}
    </View>
  );
}

const ICON_CHARS: Record<string, string> = {
  lock: "\uD83D\uDD12",
  monitor: "\uD83D\uDCBB",
  list: "\uD83D\uDCCB",
  bell: "\uD83D\uDD14",
  brain: "\uD83E\uDDE0",
  building: "\uD83C\uDFE2",
  gear: "\u2699\uFE0F",
  sun: "\u2600\uFE0F",
  moon: "\uD83C\uDF19",
  phone: "\uD83D\uDCF1",
  bolt: "\u26A1",
  chevronRight: "\u203A",
  chevronDown: "\u2039",
  arrowRight: "\u2192",
  arrowLeft: "\u2190",
  check: "\u2713",
  x: "\u2715",
  plus: "\u002B",
  minus: "\u2212",
  search: "\uD83D\uDD0D",
  filter: "\uD83D\uDD0C",
  calendar: "\uD83D\uDCC5",
  clock: "\uD83D\uDD50",
  star: "\u2B50",
  heart: "\u2764\uFE0F",
  eye: "\uD83D\uDC41",
  eyeOff: "\uD83D\uDE48",
  trash: "\uD83D\uDDD1\uFE0F",
  edit: "\u270E",
  download: "\uD83D\uDCE5",
  upload: "\uD83D\uDCE4",
  refresh: "\uD83D\uDD04",
  link: "\uD83D\uDD17",
  copy: "\uD83D\uDCCB",
  share: "\uD83D\uDCE4",
  camera: "\uD83D\uDCF7",
  image: "\uD83D\uDDBC\uFE0F",
  map: "\uD83D\uDDFA\uFE0F",
  tag: "\uD83C\uDFF7\uFE0F",
  globe: "\uD83C\uDF10",
  mail: "\u2709\uFE0F",
  phoneCall: "\uD83D\uDCDE",
  shield: "\uD83D\uDEE1\uFE0F",
  zap: "\u26A1",
  award: "\uD83C\uDFC6",
  trendingUp: "\uD83D\uDCC8",
  trendingDown: "\uD83D\uDCC9",
  barChart: "\uD83D\uDCCA",
  pieChart: "\uD83D\uDCCA",
  wallet: "\uD83D\uDCB0",
  creditCard: "\uD83D\uDCB3",
  piggyBank: "\uD83D\uDC37",
  target: "\uD83C\uDFAF",
  home: "\uD83C\uDFE0",
  user: "\uD83D\uDC64",
  users: "\uD83D\uDC65",
  settings: "\u2699\uFE0F",
  help: "\u2753",
  info: "\u2139\uFE0F",
  alertTriangle: "\u26A0\uFE0F",
  checkCircle: "\u2705",
  xCircle: "\u274C",
  clockOutline: "\u23F0",
};

export function Icon({ name, size = "md", color = "#1A1A1A" }: IconProps) {
  const px = SIZE_MAP[size];
  const char = ICON_CHARS[name] || "\u25CF";

  return (
    <View
      style={{
        width: px,
        height: px,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: px,
          height: px,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Using a styled text character as icon fallback for React Native */}
        <View
          style={{
            width: px * 0.6,
            height: px * 0.6,
            borderRadius: px * 0.15,
            backgroundColor: color,
            opacity: 0.15,
            position: "absolute",
          }}
        />
      </View>
    </View>
  );
}

export { ICON_CHARS };
export type { IconProps };
