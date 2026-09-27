import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useAuthStore } from "@/store/auth.store";
import { useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import * as notificationsApi from "@/api/notifications.api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { Bell } from "@/components/ui/icons";
import type { NotificationItem } from "@/types/notification.types";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString("es-CO");
}

export default function NotificationsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [markingAll, setMarkingAll] = useState(false);

  const {
    data: notifications,
    isLoading,
    refetch,
  } = useOfflineQuery<NotificationItem[]>(
    {
      queryKey: ["notifications", userId],
      queryFn: () => notificationsApi.getNotifications(userId as number, { is_active: true }),
      enabled: !!userId,
    },
    async () => [],
  );

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  const handleMarkRead = useCallback(
    async (id: number) => {
      if (!userId) return;
      try {
        await notificationsApi.markRead(userId, id);
        queryClient.setQueryData<NotificationItem[]>(["notifications", userId], (old) =>
          old?.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        );
      } catch {
        // ignore
      }
    },
    [userId, queryClient],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!userId) return;
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead(userId);
      queryClient.setQueryData<NotificationItem[]>(["notifications", userId], (old) =>
        old?.map((n) => ({ ...n, is_read: true })),
      );
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  }, [userId, queryClient]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6 gap-3">
        <Skeleton width={180} height={28} />
        <Skeleton height={70} />
        <Skeleton height={70} />
        <Skeleton height={70} />
        <Skeleton height={70} />
      </View>
    );
  }

  if (!userId) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <EmptyState
          icon={Bell}
          title="Sesión no disponible"
          description="Inicia sesión de nuevo para ver tus datos."
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
    >
      <View className="px-4 pt-4 pb-4">
        <PageHeader
          title="Notificaciones"
          actions={
            <>
              {unreadCount > 0 && <Badge tone="destructive">{unreadCount}</Badge>}
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={handleMarkAllRead}
                  loading={markingAll}
                >
                  Marcar todas
                </Button>
              )}
            </>
          }
        />
      </View>

      {(notifications ?? []).length === 0 ? (
        <EmptyState icon={Bell} title="Sin notificaciones" description="Aquí aparecerán tus notificaciones" />
      ) : (
        <View className="px-4 pb-6">
          <Card variant="flat" className="p-2">
            {(notifications ?? []).map((notification) => (
              <Pressable
                key={notification.id}
                onPress={() => !notification.is_read && handleMarkRead(notification.id)}
                className="flex-row items-center gap-3 rounded-xl px-2 py-2.5"
              >
                <IconTile
                  icon={Bell}
                  tone={notification.is_read ? "muted" : "primary"}
                  size="sm"
                />
                <View className="flex-1 min-w-0">
                  <View className="flex-row justify-between items-start">
                    <Text
                      className={`text-sm font-sans-medium flex-1 mr-2 ${notification.is_read ? "text-muted-foreground" : "text-foreground"}`}
                      numberOfLines={1}
                    >
                      {notification.title}
                    </Text>
                    {!notification.is_read && (
                      <View className="w-2 h-2 rounded-full bg-primary mt-1" />
                    )}
                  </View>
                  {notification.description && (
                    <Text
                      className="text-xs font-sans text-muted-foreground mt-0.5"
                      numberOfLines={2}
                    >
                      {notification.description}
                    </Text>
                  )}
                  <Text className="text-xs font-sans text-muted-foreground mt-1">
                    {timeAgo(notification.created_at)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
