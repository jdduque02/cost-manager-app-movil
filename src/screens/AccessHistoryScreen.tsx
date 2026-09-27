import { View, Text, FlatList, RefreshControl, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as authApi from "@/api/auth.api";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeft, Clock } from "@/components/ui/icons";
import { router } from "expo-router";
import { formatDateTime } from "@/utils/format";

/**
 * `details` es un objeto libre de Keycloak (p. ej. `{ username, auth_method }`);
 * un objeto como child de <Text> revienta el render, así que se aplana a texto.
 */
export function formatEventDetails(details: Record<string, unknown> | null | undefined): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

const TYPE_TONE: Record<string, BadgeTone> = {
  LOGIN: "success",
  LOGOUT: "muted",
  FAILED_LOGIN: "destructive",
  PASSWORD_CHANGE: "warning",
  TOKEN_REFRESH: "muted",
};

export default function AccessHistoryScreen() {
  const { resolvedScheme } = useAppTheme();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["access-history"],
    queryFn: () => authApi.getAccessHistory(),
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <Skeleton width={180} height={28} className="mb-4" />
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="mb-3">
            <Skeleton width="50%" height={16} className="mb-2" />
            <Skeleton width="35%" height={14} className="mb-1" />
            <Skeleton width="45%" height={14} />
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
        <Text className="text-xl font-display text-foreground">Historial</Text>
      </View>

      <FlatList
        data={data ?? []}
        // Los eventos no traen id: la key combina tiempo+tipo+IP y el índice
        // (dos eventos pueden coincidir en el mismo ms).
        keyExtractor={(item, index) => `${item.time}-${item.type}-${item.ipAddress}-${index}`}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState icon={Clock} title="Sin historial" description="No hay registros de acceso aún." />
        }
        renderItem={({ item }) => {
          const details = formatEventDetails(item.details);
          return (
            <Card className="mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Badge tone={TYPE_TONE[item.type] ?? "muted"}>{item.type}</Badge>
                <Text className="text-xs font-sans text-muted-foreground">
                  {formatDateTime(item.time)}
                </Text>
              </View>
              <Text className="text-sm font-sans text-foreground mb-1">IP: {item.ipAddress}</Text>
              {item.error ? (
                <Text className="text-sm font-sans text-destructive mb-1">Error: {item.error}</Text>
              ) : null}
              {details ? (
                <Text className="text-xs font-sans text-muted-foreground">{details}</Text>
              ) : null}
            </Card>
          );
        }}
      />
    </View>
  );
}
