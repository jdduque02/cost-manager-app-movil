// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite carga wa-sqlite.wasm en su worker web; sin esto Metro no
// sabe resolver el import y el bundle web falla aunque nunca se ejecute
// (getDatabase() lanza antes en web, ver src/database/database.service.ts).
config.resolver.assetExts.push("wasm");

// Resolve path alias @/ -> src/
config.resolver.alias = {
  "@": path.resolve(__dirname, "src"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
