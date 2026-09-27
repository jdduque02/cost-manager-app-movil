import { View, Text, TouchableOpacity } from "react-native";

interface StaleDataBannerProps {
  onRetry: () => void;
  /** La red responde pero Cloud Armor la bloquea (ver `classifyApiError`). */
  blocked?: boolean;
}

/** Mismo lenguaje visual que `OfflineBanner`: barra sólida, texto blanco, acción a la derecha. */
export function StaleDataBanner({ onRetry, blocked = false }: StaleDataBannerProps) {
  return (
    <View className="bg-warning px-4 py-2 flex-row items-center justify-between">
      <Text className="text-xs font-sans-semibold flex-1 text-warning-foreground">
        {blocked
          ? "Red no autorizada — mostrando datos guardados. Prueba con otra red."
          : "Mostrando datos guardados — no se pudo actualizar"}
      </Text>
      <TouchableOpacity onPress={onRetry}>
        <Text className="text-xs font-sans-bold ml-3 text-warning-foreground underline">
          Reintentar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
