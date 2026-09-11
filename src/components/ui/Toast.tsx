import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RNToast, { type ToastConfig, type ToastConfigParams } from "react-native-toast-message";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "./icons";
import type { BadgeTone } from "./Badge";

/**
 * Wrapper de estilo de Sprig sobre `react-native-toast-message`. Sigue el
 * mismo patrón de los demás primitivos (Card, Badge, IconTile): tokens de
 * `PALETTE`, tipografía Schibsted Grotesk (`font-sans*`) y tonos de `Badge`.
 *
 * Uso: importar `toast` de `@/utils/toast` y llamar `toast.success(...)`,
 * `toast.error(...)`, `toast.info(...)` o `toast.warning(...)` — nunca
 * `RNToast.show` directo, para mantener un solo punto de estilo/copy.
 */

type ToastKind = "success" | "error" | "info" | "warning";

const KIND_TONE: Record<ToastKind, BadgeTone> = {
  success: "success",
  error: "destructive",
  info: "info",
  warning: "warning",
};

const KIND_ICON: Record<ToastKind, LucideIcon> = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
  warning: TriangleAlert,
};

const TONE_COLOR_KEY: Record<BadgeTone, keyof (typeof PALETTE)["light"]> = {
  muted: "mutedForeground",
  success: "success",
  destructive: "destructive",
  warning: "warning",
  primary: "primary",
  info: "info",
};

function AppToastCard({ type, text1, text2 }: ToastConfigParams<unknown>) {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const kindKey = String(type);
  const kind: ToastKind =
    kindKey === "success" || kindKey === "error" || kindKey === "info" || kindKey === "warning"
      ? (kindKey as ToastKind)
      : "info";
  const tone = KIND_TONE[kind];
  const Icon = KIND_ICON[kind];
  const accent = c[TONE_COLOR_KEY[tone]];

  return (
    <View className="w-full px-4">
      <View
        className="flex-row items-start gap-3 rounded-2xl border border-border p-4"
        style={{
          backgroundColor: c.card,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: resolvedScheme === "dark" ? 0.4 : 0.12,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}1A` }}
        >
          <Icon size={20} color={accent} strokeWidth={2} />
        </View>
        <View className="flex-1 gap-0.5">
          {!!text1 && (
            <Text className="font-sans-semibold text-sm text-foreground" numberOfLines={2}>
              {text1}
            </Text>
          )}
          {!!text2 && (
            <Text className="font-sans text-xs text-muted-foreground" numberOfLines={3}>
              {text2}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const toastConfig: ToastConfig = {
  success: (params) => <AppToastCard {...params} />,
  error: (params) => <AppToastCard {...params} />,
  info: (params) => <AppToastCard {...params} />,
  warning: (params) => <AppToastCard {...params} />,
};

/** Monta el contenedor de toasts una sola vez, cerca de la raíz de la app. */
export function AppToast() {
  const insets = useSafeAreaInsets();

  return (
    <RNToast
      config={toastConfig}
      position="top"
      topOffset={insets.top + 8}
      visibilityTime={3500}
    />
  );
}
