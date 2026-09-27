import { ExpoConfig } from "expo/config";

// API_BASE_URL viene de .env (Expo CLI lo carga automáticamente a process.env
// antes de evaluar este archivo). Así .env es la única fuente de verdad:
// ya no hace falta copiar el valor a mano en un app.json estático.
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/api/v1";

// URL pública de Sprig-web: ahí viven la política de privacidad, los términos y las cookies.
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3100";

// Lo fija `eas init` (vía env/EAS secret EAS_PROJECT_ID). Sin él, EAS Build
// falla con un mensaje claro en vez de apuntar a un proyecto inventado.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "Sprig",
  slug: "sprig",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/sprig/sprig_app_icon.png",
  scheme: "sprig",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "fans.sprig.app",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/sprig/sprig_app_icon_light.png",
      backgroundColor: "#1E5C3A",
    },
    package: "fans.sprig.app",
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/sprig/sprig_app_icon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-secure-store",
    "expo-sqlite",
    [
      "expo-splash-screen",
      {
        image: "./assets/sprig/sprig_app_icon.png",
        resizeMode: "contain",
        backgroundColor: "#1E5C3A",
      },
    ],
    [
      "expo-share-intent",
      {
        // Solo texto plano: forwarding de SMS/notificaciones bancarias.
        // No se habilita imágenes/archivos — ver memory/share-transaction-decision.md.
        iosActivationRules: {
          NSExtensionActivationSupportsText: true,
        },
        androidIntentFilters: ["text/*"],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    API_BASE_URL,
    WEB_URL,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
};

export default config;
