import { Stack, useLocalSearchParams } from "expo-router";
import ShareTransactionConfirmScreen from "@/screens/ShareTransactionConfirmScreen";

export default function SharedTransactionRoute() {
  const { text } = useLocalSearchParams<{ text?: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />
      <ShareTransactionConfirmScreen sharedText={text ?? ""} />
    </>
  );
}
