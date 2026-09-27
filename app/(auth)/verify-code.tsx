import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as authApi from "@/api/auth.api";
import { apiErrorMessage } from "@/api/client";
import { SprigLogo } from "@/components/ui/SprigLogo";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/utils/toast";

/** Paso 2 de la recuperación: el código de 6 dígitos del correo → reset_token. */
export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleVerify() {
    if (!email) {
      toast.error("Vuelve a pedir el código de recuperación");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast.error("El código debe tener 6 dígitos");
      return;
    }

    try {
      setIsLoading(true);
      const { reset_token } = await authApi.verifyOtp(email, code);
      // replace: el código ya se consumió, volver atrás a esta pantalla no sirve.
      router.replace({ pathname: "/(auth)/reset-password", params: { email, reset_token } });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Código inválido o vencido"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    try {
      setIsResending(true);
      await authApi.forgotPassword({ email });
      toast.success("Te enviamos un código nuevo");
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo reenviar el código"));
    } finally {
      setIsResending(false);
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
          <Text className="text-xl font-display text-foreground mt-6 mb-2">Ingresa el código</Text>
          <Text className="text-sm font-sans text-muted-foreground text-center">
            Si {email ?? "tu email"} tiene una cuenta, te enviamos un código de 6 dígitos.
          </Text>
        </View>

        <Card>
          <Input
            label="Código"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
          />

          <Button size="lg" onPress={handleVerify} loading={isLoading}>
            Verificar código
          </Button>

          <View className="flex-row justify-between mt-5">
            <Pressable onPress={handleResend} disabled={isResending}>
              <Text className="text-primary font-sans-bold text-sm">
                {isResending ? "Reenviando..." : "Reenviar código"}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text className="text-primary font-sans-bold text-sm">Volver al login</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
