import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as authApi from "@/api/auth.api";
import { apiErrorMessage } from "@/api/client";
import { SprigLogo } from "@/components/ui/SprigLogo";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/utils/toast";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Ingresa tu email");
      return;
    }

    try {
      setIsLoading(true);
      // 204 aunque el email no exista (el API no revela cuentas): siempre se
      // pasa a la pantalla del código.
      await authApi.forgotPassword({ email: trimmed });
      router.push({ pathname: "/(auth)/verify-code", params: { email: trimmed } });
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo enviar el código de recuperación"));
    } finally {
      setIsLoading(false);
    }
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
            Ingresa tu email y te enviaremos un código de verificación
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
            Enviar código
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
