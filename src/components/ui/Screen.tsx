import { ScrollView, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps extends Omit<ScrollViewProps, "children"> {
  children: React.ReactNode;
  /** Desactiva el ScrollView cuando la pantalla ya maneja su propio scroll (p.ej. FlatList). */
  scroll?: boolean;
  contentClassName?: string;
}

/**
 * Shell de página compartido: `gap-7` reproduce el `space-y-7` de la web
 * (NativeWind no implementa `space-y-*`).
 */
export function Screen({
  children,
  scroll = true,
  contentClassName = "",
  ...scrollViewProps
}: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className={`flex-1 gap-7 ${contentClassName}`}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName={`px-4 py-6 gap-7 ${contentClassName}`}
        showsVerticalScrollIndicator={false}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
