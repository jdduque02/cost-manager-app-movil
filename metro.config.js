// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Resolve path alias @/ -> src/
config.resolver.alias = {
  "@": path.resolve(__dirname, "src"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
