import { View, Text, TouchableOpacity } from "react-native";

interface StaleDataBannerProps {
  onRetry: () => void;
}

/** Mismo lenguaje visual que `OfflineBanner`: barra sólida, texto blanco, acción a la derecha. */
export function StaleDataBanner({ onRetry }: StaleDataBannerProps) {
  return (
    <View className="bg-warning px-4 py-2 flex-row items-center justify-between">
      <Text className="text-xs font-semibold flex-1 font-sans text-warning-foreground">
        Mostrando datos guardados — no se pudo actualizar
      </Text>
      <TouchableOpacity onPress={onRetry}>
        <Text className="text-xs font-bold ml-3 font-sans text-warning-foreground underline">
          Reintentar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
