import { Stack } from "expo-router";
import StatementImportScreen from "@/screens/StatementImportScreen";

export default function StatementImportRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatementImportScreen />
    </>
  );
}
