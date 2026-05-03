import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as usersApi from "@/api/users.api";

export default function ProfileScreen() {
  const {
    user,
    userId,
    logout,
    isLoading: authLoading,
    isOfflineMode,
  } = useAuthStore();
  const { isOnline, isSyncing, pendingCount, sync, lastSyncAt } =
    useOfflineStore();
  const id = userId ?? 1;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["financial-profile", id],
    queryFn: () => usersApi.getFinancialProfile(id),
    enabled: !!id && isOnline,
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
      Alert.alert(
        "Sincronización completa",
        `✅ ${result.synced} sincronizados\n⚠️ ${result.failed} fallidos\n⏭ ${result.skipped} omitidos`,
      );
    }
  }

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-brand-50">
        <ActivityIndicator size="large" color="#1B4332" />
      </View>
    );
  }

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : "??";

  return (
    <ScrollView className="flex-1 bg-brand-50">
      {/* Avatar section */}
      <View className="items-center bg-brand-900 px-6 pt-10 pb-8">
        <View className="w-18 h-18 rounded-full bg-brand-100 justify-center items-center mb-3">
          <Text className="text-2xl font-bold text-brand-900">{initials}</Text>
        </View>
        <Text className="text-xl font-bold text-white">
          {user ? `${user.firstName} ${user.lastName}` : "Usuario"}
        </Text>
        <Text className="text-sm text-brand-100 mt-0.5">
          {user?.email ?? "—"}
        </Text>
        <Text className="text-sm text-green-300 mt-0.5">
          @{user?.username ?? "—"}
        </Text>
      </View>

      {/* Personal info */}
      <View className="bg-white mx-4 mt-5 rounded-2xl p-4 shadow-sm elevation-2">
        <Text className="text-xs font-bold text-brand-800 uppercase mb-3">
          Información personal
        </Text>
        {[
          { label: "ID de usuario", value: String(id) },
          { label: "Estado", value: user?.isActive ? "Activo" : "Inactivo" },
          {
            label: "Miembro desde",
            value: user
              ? new Date(user.createdAt).toLocaleDateString("es-CO")
              : "—",
          },
        ].map(({ label, value }) => (
          <View
            key={label}
            className="flex-row justify-between py-2 border-b border-brand-50 last:border-0"
          >
            <Text className="text-sm text-brand-800">{label}</Text>
            <Text className="text-sm font-semibold text-brand-900">
              {value}
            </Text>
          </View>
        ))}
      </View>

      {/* Financial profile */}
      {profileLoading ? (
        <ActivityIndicator className="mt-5" color="#1B4332" />
      ) : profile ? (
        <View className="bg-white mx-4 mt-5 rounded-2xl p-4 shadow-sm elevation-2">
          <Text className="text-xs font-bold text-brand-800 uppercase mb-3">
            Perfil financiero
          </Text>
          {[
            {
              label: "Ingreso mensual",
              value: new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: profile.currency,
                maximumFractionDigits: 0,
              }).format(Number(profile.monthlyIncome)),
            },
            { label: "Moneda", value: profile.currency },
            {
              label: "Meta de ahorro",
              value: `${profile.savingsGoalPercentage ?? 0}%`,
            },
            {
              label: "Tolerancia al riesgo",
              value: profile.riskTolerance ?? "—",
            },
          ].map(({ label, value }) => (
            <View
              key={label}
              className="flex-row justify-between py-2 border-b border-brand-50 last:border-0"
            >
              <Text className="text-sm text-brand-800">{label}</Text>
              <Text className="text-sm font-semibold text-brand-900">
                {value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Estado offline */}
      {(isOfflineMode || !isOnline || pendingCount > 0) && (
        <View className="bg-white mx-4 mt-5 rounded-2xl p-4 shadow-sm elevation-2">
          <Text className="text-xs font-bold text-brand-800 uppercase mb-3">
            Estado de sincronización
          </Text>
          <View className="flex-row justify-between items-center py-2 border-b border-brand-50">
            <Text className="text-sm text-brand-800">Conexión</Text>
            <Text
              className={`text-sm font-semibold ${isOnline ? "text-green-600" : "text-yellow-600"}`}
            >
              {isOnline ? "En línea" : "Sin conexión"}
            </Text>
          </View>
          {isOfflineMode && (
            <View className="flex-row justify-between items-center py-2 border-b border-brand-50">
              <Text className="text-sm text-brand-800">Modo</Text>
              <Text className="text-sm font-semibold text-yellow-600">
                Offline (caché local)
              </Text>
            </View>
          )}
          <View className="flex-row justify-between items-center py-2 border-b border-brand-50">
            <Text className="text-sm text-brand-800">Cambios pendientes</Text>
            <Text
              className={`text-sm font-semibold ${pendingCount > 0 ? "text-orange-500" : "text-brand-900"}`}
            >
              {pendingCount}
            </Text>
          </View>
          {lastSyncAt && (
            <View className="flex-row justify-between items-center py-2 border-b border-brand-50">
              <Text className="text-sm text-brand-800">
                Última sincronización
              </Text>
              <Text className="text-sm font-semibold text-brand-900">
                {new Date(lastSyncAt).toLocaleTimeString("es-CO")}
              </Text>
            </View>
          )}
          {isOnline && pendingCount > 0 && (
            <TouchableOpacity
              className={`mt-3 bg-brand-900 rounded-xl p-3 items-center${isSyncing ? " opacity-60" : ""}`}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-semibold text-sm">
                  Sincronizar ahora
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Settings */}
      <View className="bg-white mx-4 mt-5 rounded-2xl p-4 shadow-sm elevation-2">
        <Text className="text-xs font-bold text-brand-800 uppercase mb-3">
          Configuración
        </Text>
        <TouchableOpacity className="flex-row justify-between items-center py-3 border-b border-brand-50">
          <Text className="text-sm text-brand-900">Cambiar contraseña</Text>
          <Text className="text-lg text-gray-400">›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-row justify-between items-center py-3"
          onPress={() => router.push("/(auth)/forgot-password")}
        >
          <Text className="text-sm text-brand-900">Restablecer contraseña</Text>
          <Text className="text-lg text-gray-400">›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity
        className="mx-4 mt-6 mb-10 bg-red-100 rounded-2xl p-4 items-center"
        onPress={handleLogout}
      >
        <Text className="text-red-600 font-bold text-base">Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
