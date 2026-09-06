const preset = require("jest-expo/jest-preset");

module.exports = {
  ...preset,
  setupFiles: [...preset.setupFiles, "<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  // lucide-react-native ships ESM icon subpath modules (.mjs) that pnpm nests
  // under node_modules/.pnpm/lucide-react-native@.../node_modules/lucide-react-native/ —
  // include it in the transform allowlist so Jest doesn't skip it...
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native))",
  ],
  // ...and give babel-jest an explicit `.mjs` transform (the preset's default
  // pattern `\.[jt]sx?$` doesn't match `.mjs`, so those files never reach babel).
  transform: {
    ...preset.transform,
    "\\.mjs$": preset.transform["\\.[jt]sx?$"],
  },
};
