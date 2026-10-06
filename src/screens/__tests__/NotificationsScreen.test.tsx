/**
 * NotificationsScreen (R8.2): el `reference` de las notificaciones de
 * recurrentes lleva a la pantalla correcta.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import NotificationsScreen from "../NotificationsScreen";
import type { NotificationItem } from "@/types/notification.types";

let mockItems: NotificationItem[] = [];

jest.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ userId: 7 }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: jest.fn() }),
}));
jest.mock("@/hooks/useOfflineQuery", () => ({
  useOfflineQuery: () => ({ data: mockItems, isLoading: false, refetch: jest.fn() }),
}));
jest.mock("@/api/notifications.api", () => ({
  getNotifications: jest.fn(),
  markRead: jest.fn().mockResolvedValue(undefined),
  markAllRead: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

function notification(id: number, title: string, reference: string | null): NotificationItem {
  return {
    id,
    user_id: 7,
    title,
    description: null,
    is_read: true,
    is_active: true,
    scheduled_at: null,
    reference,
    created_at: new Date().toISOString(),
    updated_at: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("recurring:validate:<txId> navega a la validación de esa transacción", () => {
  mockItems = [notification(1, "Valida el pago de Netflix", "recurring:validate:42")];
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByText("Valida el pago de Netflix"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(tabs)/transactions",
    params: { validate: "42" },
  });
});

it("created y not-adopted van a transacciones; el resto de recurring:* a recurrentes", () => {
  mockItems = [
    notification(1, "Creada", "recurring:created:5"),
    notification(2, "No adoptada", "recurring:not-adopted:6"),
    notification(3, "Aviso", "recurring:reminder:3:2026-11-01"),
    notification(4, "Fin", "recurring:finished:3"),
  ];
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByText("Creada"));
  fireEvent.press(screen.getByText("No adoptada"));
  expect(router.push).toHaveBeenNthCalledWith(1, "/(tabs)/transactions");
  expect(router.push).toHaveBeenNthCalledWith(2, "/(tabs)/transactions");
  fireEvent.press(screen.getByText("Aviso"));
  fireEvent.press(screen.getByText("Fin"));
  expect(router.push).toHaveBeenNthCalledWith(3, "/recurring");
  expect(router.push).toHaveBeenNthCalledWith(4, "/recurring");
});

it("una notificación sin reference de recurrentes no navega", () => {
  mockItems = [notification(1, "Otra", null), notification(2, "Presupuesto", "budget:9")];
  render(<NotificationsScreen />);
  fireEvent.press(screen.getByText("Otra"));
  fireEvent.press(screen.getByText("Presupuesto"));
  expect(router.push).not.toHaveBeenCalled();
});
