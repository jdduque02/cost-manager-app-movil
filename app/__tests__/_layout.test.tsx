/**
 * Tests de RootLayout (app/_layout.tsx), acotados al guard agregado sobre
 * useRootNavigationState()?.key en el efecto que redirige a "/(auth)/login"
 * cuando isAuthenticated pasa de true a false.
 *
 * Sin el guard, ese router.replace podía dispararse antes de que el
 * <Stack>/NavigationContainer estuviera montado (mientras useFonts todavía
 * no resolvía), produciendo el crash "Couldn't find a navigation context".
 *
 * Mockea todas las dependencias externas (fonts, splash screen, netinfo,
 * share-intent, stores, database, theme) para aislar únicamente ese efecto,
 * siguiendo el patrón de mockeo total usado en
 * src/screens/__tests__/ObjectiveDetailScreen.test.tsx.
 */
import React from "react";
import { render, act } from "@testing-library/react-native";
import RootLayout from "../_layout";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineStore } from "@/store/offline.store";

// global.css es una hoja de estilos de NativeWind (directivas @tailwind), no
// JS/TS válido — Jest no puede parsearlo, así que se mockea como módulo vacío.
jest.mock("../../global.css", () => ({}));

let mockIsAuthenticated = true;

// El objeto `router` y su método `replace` se crean dentro del factory (no
// como una variable externa capturada por closure) porque jest.mock() se
// hoistea por encima de las declaraciones `const`/`let` del módulo: una
// referencia externa quedaría en TDZ / undefined al momento en que
// "../_layout" (importado más arriba) dispara el require("expo-router").
jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const StackComponent = ({ children }: { children?: React.ReactNode }) => (
    <View>{children}</View>
  );
  StackComponent.displayName = "MockStack";
  const MockScreen = () => null;
  MockScreen.displayName = "MockStack.Screen";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (StackComponent as any).Screen = MockScreen;
  return {
    Stack: StackComponent,
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
    useRootNavigationState: () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((global as any).__mockRootNavigationStateKey
        ? { key: (global as any).__mockRootNavigationStateKey }
        : undefined),
  };
});

jest.mock("expo-font", () => ({
  useFonts: () => [true],
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return { GestureHandlerRootView: View };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaProvider: View };
});

const mockResetShareIntent = jest.fn();
let mockShareIntentState: {
  hasShareIntent: boolean;
  shareIntent: { text: string } | null;
} = { hasShareIntent: false, shareIntent: null };

jest.mock("expo-share-intent", () => {
  const React = require("react");
  return {
    ShareIntentProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    useShareIntentContext: () => ({
      ...mockShareIntentState,
      resetShareIntent: mockResetShareIntent,
    }),
  };
});

jest.mock("@/store/auth.store", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/store/offline.store", () => ({
  useOfflineStore: jest.fn(),
  startPeriodicSync: jest.fn(),
  stopPeriodicSync: jest.fn(),
}));

jest.mock("@/database/database.service", () => ({
  getDatabase: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/components/ThemeProvider", () => {
  const React = require("react");
  return {
    ThemeProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    useAppTheme: () => ({ resolvedScheme: "light" }),
  };
});

jest.mock("@/components/ui/Toast", () => ({
  AppToast: () => null,
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockUseOfflineStore = useOfflineStore as unknown as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { router: mockRouter } = require("expo-router");

function setRootNavigationStateKey(key: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).__mockRootNavigationStateKey = key;
}

function setAuthenticated(value: boolean) {
  mockIsAuthenticated = value;
  mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated, initialize: jest.fn() }),
  );
}

describe("RootLayout — guard de navegación en redirect a login", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
    setRootNavigationStateKey(null);
    setAuthenticated(true);

    mockUseOfflineStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ setOnlineStatus: jest.fn() }),
    );
  });

  afterEach(() => {
    setRootNavigationStateKey(null);
  });

  it("no llama a router.replace si el navigator aún no está listo (key ausente) aunque la sesión ya haya expirado", () => {
    const { rerender } = render(<RootLayout />);

    setAuthenticated(false);
    act(() => {
      rerender(<RootLayout />);
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("redirige a /(auth)/login una vez el navigator está listo y la sesión pasa de autenticada a no-autenticada", () => {
    setRootNavigationStateKey("root");
    const { rerender } = render(<RootLayout />);

    setAuthenticated(false);
    act(() => {
      rerender(<RootLayout />);
    });

    expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("no redirige en el montaje inicial aunque el navigator ya esté listo y la sesión no esté autenticada desde el inicio", () => {
    setRootNavigationStateKey("root");
    setAuthenticated(false);

    render(<RootLayout />);

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe("RootLayout — guard de navegación en share intent", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockResetShareIntent.mockClear();
    setRootNavigationStateKey(null);
    setAuthenticated(true);
    mockShareIntentState = {
      hasShareIntent: true,
      shareIntent: { text: "Compra por $50.000 en Exito" },
    };

    mockUseOfflineStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ setOnlineStatus: jest.fn() }),
    );
  });

  afterEach(() => {
    setRootNavigationStateKey(null);
    mockShareIntentState = { hasShareIntent: false, shareIntent: null };
  });

  it("no llama a router.push ni limpia el share intent si el navigator aún no está listo (key ausente)", () => {
    render(<RootLayout />);

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockResetShareIntent).not.toHaveBeenCalled();
  });

  it("navega a /shared-transaction y limpia el share intent una vez el navigator está listo", () => {
    const { rerender } = render(<RootLayout />);

    setRootNavigationStateKey("root");
    act(() => {
      rerender(<RootLayout />);
    });

    expect(mockResetShareIntent).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/shared-transaction",
      params: { text: "Compra por $50.000 en Exito" },
    });
  });
});
