// AsyncStorage's native module isn't available in the Jest environment.
// Use the package's own official mock (any component under ThemeProvider needs this).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
