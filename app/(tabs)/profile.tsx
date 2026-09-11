import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as usersApi from "@/api/users.api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Money } from "@/components/ui/Money";
import { ListRow } from "@/components/ui/ListRow";
import {
  Lock,
  Monitor,
  Clock,
  Bell,
  ChartColumn,
  Sparkles,
  Building2,
  Settings,
  Tag,
  Newspaper,
  Sun,
  Moon,
  ChevronRight,
  type LucideIcon,
} from "@/components/ui/icons";
import { toast } from "@/utils/toast";

type ThemeOption = "light" | "dark" | "system";

export default function ProfileScreen() {
  const { user, userId, logout, isLoading: authLoading, isOfflineMode } = useAuthStore();
  const { isOnline, isSyncing, pendingCount, sync, lastSyncAt } = useOfflineStore();
  const { theme, setTheme, resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["financial-profile", userId],
    queryFn: () => usersApi.getFinancialProfile(userId as number),
    enabled: !!userId && isOnline,
    retry: false,
    networkMode: "always",
  });

  async function handleLogout() {
    Alert.alert("Cerrar sesión", "¿Deseas salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  async function handleSync() {
    const result = await sync();
    if (result) {
      const summary = `${result.synced} sincronizados, ${result.failed} fallidos, ${result.skipped} omitidos`;
      if (result.failed > 0) {
        toast.warning("Sincronización con errores", summary);
      } else {
        toast.success("Sincronización completa", summary);
      }
    }
  }

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const displayName = user?.full_name?.trim() || user?.username || "Usuario";
  const nameParts = displayName.trim().split(/\s+/);
  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
      : displayName.slice(0, 2).toUpperCase();

  const themeOptions: { key: ThemeOption; label: string; icon?: LucideIcon }[] = [
    { key: "light", label: "Claro", icon: Sun },
    { key: "dark", label: "Oscuro", icon: Moon },
    { key: "system", label: "Sistema" },
  ];

  const settingsLinks: { label: string; icon: LucideIcon; href: string }[] = [
    { label: "Cambiar contraseña", icon: Lock, href: "/change-password" },
    { label: "Sesiones activas", icon: Monitor, href: "/sessions" },
    { label: "Historial de accesos", icon: Clock, href: "/access-history" },
    { label: "Notificaciones", icon: Bell, href: "/notifications" },
    { label: "Reportes", icon: ChartColumn, href: "/reports" },
    { label: "Inteligencia", icon: Sparkles, href: "/intelligence" },
    { label: "Categorías", icon: Tag, href: "/categories" },
    { label: "Empresas", icon: Building2, href: "/empresas" },
    { label: "Noticias", icon: Newspaper, href: "/news" },
    { label: "Configuración", icon: Settings, href: "/settings" },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 gap-7">
      {/* Avatar Header */}
      <View className="items-center">
        <View className="w-20 h-20 rounded-full bg-primary justify-center items-center mb-3">
          <Text className="text-2xl font-display text-primary-foreground">{initials}</Text>
        </View>
        <Text className="text-xl font-display text-foreground">{displayName}</Text>
        <Text className="text-sm font-sans text-muted-foreground mt-0.5">
          {user?.email ?? "—"}
        </Text>
        <Text className="text-sm font-sans text-primary mt-0.5">@{user?.username ?? "—"}</Text>
      </View>

      {/* User Info */}
      <Card>
        <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
          Información personal
        </Text>
        {[
          { label: "ID de usuario", value: userId != null ? String(userId) : "—" },
          { label: "Estado", value: user?.is_active ? "Activo" : "Inactivo" },
          {
            label: "Miembro desde",
            value: user ? new Date(user.created_at).toLocaleDateString("es-CO") : "—",
          },
        ].map(({ label, value }, index, arr) => (
          <View
            key={label}
            className={`flex-row justify-between py-2.5 ${index < arr.length - 1 ? "border-b border-border" : ""}`}
          >
            <Text className="text-sm font-sans text-muted-foreground">{label}</Text>
            <Text className="text-sm font-sans-semibold text-foreground">{value}</Text>
          </View>
        ))}
      </Card>

      {/* Financial Profile */}
      {profileLoading ? (
        <Skeleton height={120} />
      ) : profile ? (
        <Card>
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
            Perfil financiero
          </Text>
          <View className="flex-row justify-between py-2.5 border-b border-border">
            <Text className="text-sm font-sans text-muted-foreground">Ingreso mensual</Text>
            {profile.monthly_income != null ? (
              <Money value={Number(profile.monthly_income)} className="text-sm text-foreground" />
            ) : (
              <Text className="text-sm font-sans-semibold text-foreground">—</Text>
            )}
          </View>
          {[
            { label: "Necesidades", value: profile.needs_ratio },
            { label: "Deseos", value: profile.wants_ratio },
            { label: "Ahorro", value: profile.savings_ratio },
            { label: "Inversión", value: profile.investment_ratio },
            { label: "Deuda máxima", value: profile.max_debt_ratio },
          ].map(({ label, value }, index, arr) => (
            <View
              key={label}
              className={`flex-row justify-between py-2.5 ${index < arr.length - 1 ? "border-b border-border" : ""}`}
            >
              <Text className="text-sm font-sans text-muted-foreground">{label}</Text>
              <Text className="text-sm font-sans-semibold text-foreground">
                {Math.round(value * 100)}%
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Sync Status Panel */}
      {(isOfflineMode || !isOnline || pendingCount > 0) && (
        <Card>
          <Text className="text-xs font-sans-medium uppercase tracking-widest text-muted-foreground mb-3">
            Estado de sincronización
          </Text>
          <View className="flex-row justify-between items-center py-2.5 border-b border-border">
            <Text className="text-sm font-sans text-muted-foreground">Conexión</Text>
            <Badge tone={isOnline ? "success" : "warning"}>
              {isOnline ? "En línea" : "Sin conexión"}
            </Badge>
          </View>
          {isOfflineMode && (
            <View className="flex-row justify-between items-center py-2.5 border-b border-border">
              <Text className="text-sm font-sans text-muted-foreground">Modo</Text>
              <Badge tone="warning">Offline</Badge>
            </View>
          )}
          <View className="flex-row justify-between items-center py-2.5 border-b border-border">
            <Text className="text-sm font-sans text-muted-foreground">Cambios pendientes</Text>
            <Badge tone={pendingCount > 0 ? "warning" : "muted"}>{pendingCount}</Badge>
          </View>
          {lastSyncAt && (
            <View className="flex-row justify-between items-center py-2.5 border-b border-border">
              <Text className="text-sm font-sans text-muted-foreground">Última sincronización</Text>
              <Text className="text-sm font-num-semibold text-foreground">
                {new Date(lastSyncAt).toLocaleTimeString("es-CO")}
              </Text>
            </View>
          )}
          {isOnline && pendingCount > 0 && (
            <Button variant="secondary" size="sm" onPress={handleSync} loading={isSyncing} className="mt-3">
              Sincronizar ahora
            </Button>
          )}
        </Card>
      )}

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
                <opt.icon
                  size={16}
                  color={theme === opt.key ? c.primaryForeground : c.foreground}
                />
              )}
              <Text
                className={`text-xs font-sans-medium ${theme === opt.key ? "text-primary-foreground" : "text-foreground"}`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Settings Links */}
      <Card variant="flat" className="p-2">
        {settingsLinks.map((item) => (
          <ListRow
            key={item.label}
            icon={item.icon}
            tone="muted"
            title={item.label}
            onPress={() => router.push(item.href as never)}
            right={<ChevronRight size={16} color={c.mutedForeground} />}
          />
        ))}
      </Card>

      {/* Logout */}
      <Button variant="destructive" size="lg" onPress={handleLogout}>
        Cerrar sesión
      </Button>
    </ScrollView>
  );
}
