import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as authApi from "@/api/auth.api";
import { SprigLogo } from "@/components/ui/SprigLogo";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/utils/toast";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Ingresa tu email");
      return;
    }

    try {
      setIsLoading(true);
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch {
      toast.error("No se pudo enviar el email de recuperacion");
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <SprigLogo variant="mark" size="lg" />
        <Text className="text-xl font-display text-foreground mt-6 mb-2">Email enviado</Text>
        <Text className="text-sm font-sans text-muted-foreground text-center mb-6">
          Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contrasena.
        </Text>
        <Button onPress={() => router.replace("/(auth)/login")}>Volver al login</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <SprigLogo variant="mark" size="lg" />
          <Text className="text-xl font-display text-foreground mt-6 mb-2">Recuperar contrasena</Text>
          <Text className="text-sm font-sans text-muted-foreground text-center">
            Ingresa tu email y te enviaremos las instrucciones
          </Text>
        </View>

        <Card>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Button size="lg" onPress={handleForgotPassword} loading={isLoading}>
            Enviar instrucciones
          </Button>

          <View className="flex-row justify-center mt-5">
            <Pressable onPress={() => router.back()}>
              <Text className="text-primary font-sans-bold text-sm">Volver al login</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
