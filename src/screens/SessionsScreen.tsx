import { View, Text, FlatList, Pressable, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as authApi from "@/api/auth.api";
import type { SessionResponse } from "@/api/auth.api";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeft, Monitor } from "@/components/ui/icons";
import { router } from "expo-router";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsScreen() {
  const queryClient = useQueryClient();
  const { resolvedScheme } = useAppTheme();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => authApi.getSessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      Alert.alert("Sesión revocada", "La sesión ha sido cerrada correctamente.");
    },
    onError: () => {
      Alert.alert("Error", "No se pudo revocar la sesión.");
    },
  });

  function handleRevoke(session: SessionResponse) {
    Alert.alert("Revocar sesión", `¿Cerrar la sesión de ${session.browser} (${session.ip})?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Revocar",
        style: "destructive",
        onPress: () => revokeMutation.mutate(session.sessionId),
      },
    ]);
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <Skeleton width={200} height={28} className="mb-4" />
        {[1, 2, 3].map((i) => (
          <Card key={i} className="mb-3">
            <Skeleton width="60%" height={16} className="mb-2" />
            <Skeleton width="40%" height={14} className="mb-1" />
            <Skeleton width="50%" height={14} />
          </Card>
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={20} color={PALETTE[resolvedScheme].foreground} />
        </Pressable>
        <Text className="text-xl font-display text-foreground">Sesiones</Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.sessionId}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState icon={Monitor} title="Sin sesiones activas" description="No hay sesiones registradas." />
        }
        renderItem={({ item }) => (
          <Card className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-sans-semibold text-foreground">{item.browser}</Text>
              <Badge tone="primary">Activa</Badge>
            </View>
            <Text className="text-sm font-sans text-muted-foreground mb-1">IP: {item.ip}</Text>
            <Text className="text-sm font-sans text-muted-foreground mb-1">
              Inicio: {formatDate(item.start)}
            </Text>
            <Text className="text-sm font-sans text-muted-foreground mb-3">
              Último acceso: {formatDate(item.lastAccess)}
            </Text>
            <Button
              variant="destructive"
              size="sm"
              onPress={() => handleRevoke(item)}
              loading={revokeMutation.isPending}
            >
              Revocar sesión
            </Button>
          </Card>
        )}
      />
    </View>
  );
}
