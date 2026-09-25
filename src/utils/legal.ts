import Constants from "expo-constants";
import { Linking } from "react-native";

/** Debe coincidir con LEGAL_VERSION de Sprig-web (src/content/legal.ts). */
export const LEGAL_VERSION = "2026-09-24";

const WEB_URL: string = Constants.expoConfig?.extra?.WEB_URL ?? "http://localhost:3100";

export function openLegal(slug: "privacidad" | "terminos" | "cookies") {
  return Linking.openURL(`${WEB_URL}/${slug}`);
}
