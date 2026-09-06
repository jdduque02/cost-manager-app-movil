import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListRow } from "@/components/ui/ListRow";
import {
  User,
  Wallet,
  Bell,
  Monitor,
  Lock,
  Clock,
  Sun,
  Moon,
  type LucideIcon,
} from "@/components/ui/icons";

type ThemeOption = "light" | "dark" | "system";

interface SettingsItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: string;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: "Cuenta",
    items: [
      { label: "Perfil", icon: User, href: "/(tabs)/profile" },
      { label: "Perfil Financiero", icon: Wallet, href: "/(tabs)/profile" },
    ],
  },
  {
    title: "Notificaciones",
    items: [{ label: "Notificaciones", icon: Bell, href: "/notifications" }],
  },
  {
    title: "Seguridad",
    items: [
      { label: "Sesiones activas", icon: Monitor, href: "/sessions" },
      { label: "Cambiar contraseña", icon: Lock, href: "/change-password" },
      { label: "Historial de acceso", icon: Clock, href: "/access-history" },
    ],
  },
  {
    title: "Idioma y Región",
    items: [
      { label: "Idioma", icon: Monitor, badge: "Español" },
      { label: "Moneda", icon: Wallet, badge: "COP" },
      { label: "Zona horaria", icon: Clock, badge: "COT" },
    ],
  },
];

export default function SettingsScreen() {
  const { theme, setTheme, resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];

  const themeOptions: { key: ThemeOption; label: string; icon?: LucideIcon }[] = [
    { key: "light", label: "Claro", icon: Sun },
    { key: "dark", label: "Oscuro", icon: Moon },
    { key: "system", label: "Sistema" },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 gap-7">
      <PageHeader title="Configuración" subtitle="Personaliza tu experiencia" />

      {/* Theme Toggle */}
      <Card>
        <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
          Apariencia
        </Text>
        <View className="flex-row gap-2">
          {themeOptions.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setTheme(opt.key)}
              className={`flex-1 py-3 rounded-md items-center gap-1 ${theme === opt.key ? "bg-primary" : "bg-surface border border-border"}`}
            >
              {opt.icon && (
                <opt.icon size={16} color={theme === opt.key ? c.primaryForeground : c.foreground} />
              )}
              <Text
                className={`text-xs font-sans-medium ${theme === opt.key ? "text-primary-foreground" : "text-foreground"}`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs font-sans text-muted-foreground mt-3 text-center">
          Tema actual: {resolvedScheme === "dark" ? "Oscuro" : "Claro"}
        </Text>
      </Card>

      {/* Settings Sections */}
      {SETTINGS_SECTIONS.map((section) => (
        <View key={section.title}>
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-2 px-1">
            {section.title}
          </Text>
          <Card variant="flat" className="p-2">
            {section.items.map((item) => (
              <ListRow
                key={item.label}
                icon={item.icon}
                tone="muted"
                title={item.label}
                onPress={item.href ? () => router.push(item.href as never) : undefined}
                right={item.badge ? <Badge tone="muted">{item.badge}</Badge> : undefined}
              />
            ))}
          </Card>
        </View>
      ))}

      {/* About */}
      <Card>
        <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-2">
          Acerca de
        </Text>
        <View className="flex-row justify-between py-2">
          <Text className="text-sm font-sans text-foreground">Versión</Text>
          <Text className="text-sm font-sans text-muted-foreground">1.0.0</Text>
        </View>
        <View className="flex-row justify-between py-2">
          <Text className="text-sm font-sans text-foreground">SDK</Text>
          <Text className="text-sm font-sans text-muted-foreground">Expo SDK 57</Text>
        </View>
      </Card>
    </ScrollView>
  );
}
