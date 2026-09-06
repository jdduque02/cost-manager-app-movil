import { apiClient, unwrapList } from "./client";
import type {
  NotificationItem,
  NotificationQuery,
} from "@/types/notification.types";

export async function getNotifications(
  userId: number,
  query?: NotificationQuery,
): Promise<NotificationItem[]> {
  const { data } = await apiClient.get<
    NotificationItem[] | { data: NotificationItem[]; total?: number }
  >(`/users/${userId}/notifications`, { params: query });
  return unwrapList(data);
}

export async function markRead(
  userId: number,
  id: number,
): Promise<NotificationItem> {
  const { data } = await apiClient.patch<
    NotificationItem | NotificationItem[]
  >(`/users/${userId}/notifications/${id}/read`, {});
  return Array.isArray(data) ? data[0] : data;
}

export async function markAllRead(userId: number): Promise<void> {
  await apiClient.patch(`/users/${userId}/notifications/read-all`, {});
}
