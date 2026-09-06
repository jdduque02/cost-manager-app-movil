import { View, Text, Image } from "react-native";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";

type SprigLogoSize = "sm" | "md" | "lg";
type SprigLogoVariant = "full" | "mark" | "wordmark";

const SIZE_CONFIG: Record<SprigLogoSize, { icon: number; text: number; gap: number }> = {
  sm: { icon: 28, text: 14, gap: 6 },
  md: { icon: 40, text: 20, gap: 8 },
  lg: { icon: 60, text: 28, gap: 10 },
};

interface SprigLogoProps {
  variant?: SprigLogoVariant;
  size?: SprigLogoSize;
  light?: boolean;
}

export function SprigLogo({
  variant = "full",
  size = "md",
  light,
}: SprigLogoProps) {
  const { resolvedScheme } = useAppTheme();
  const config = SIZE_CONFIG[size];
  // `light` sigue existiendo para forzar texto blanco sobre un fondo oscuro
  // que no es el `background` del tema (p.ej. una imagen). Sin esa prop, el
  // color se deriva del tema activo en vez de asumir siempre modo claro.
  const textColor =
    light === undefined ? PALETTE[resolvedScheme].foreground : light ? "#FFFFFF" : "#1A1A1A";

  if (variant === "mark") {
    return (
      <Image
        source={require("../../../assets/sprig/sprig_isotipo.png")}
        style={{ width: config.icon, height: config.icon, resizeMode: "contain" }}
      />
    );
  }

  if (variant === "wordmark") {
    return (
      <Text
        style={{
          fontFamily: "SpaceGrotesk-Bold",
          fontSize: config.text,
          color: textColor,
          letterSpacing: -0.5,
        }}
      >
        Sprig
      </Text>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: config.gap,
      }}
    >
      <Image
        source={require("../../../assets/sprig/sprig_isotipo.png")}
        style={{ width: config.icon, height: config.icon, resizeMode: "contain" }}
      />
      <Text
        style={{
          fontFamily: "SpaceGrotesk-Bold",
          fontSize: config.text,
          color: textColor,
          letterSpacing: -0.5,
        }}
      >
        Sprig
      </Text>
    </View>
  );
}
