import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as authApi from "@/api/auth.api";
import { SprigLogo } from "@/components/ui/SprigLogo";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/utils/toast";

export default function ResetPasswordScreen() {
  const { token, email } = useLocalSearchParams<{ token?: string; email?: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleResetPassword() {
    if (!password || !confirmPassword) {
      toast.error("Campos requeridos", "Completa ambos campos");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contrasenas no coinciden");
      return;
    }

    if (password.length < 8) {
      toast.error("La contrasena debe tener al menos 8 caracteres");
      return;
    }

    if (!token || !email) {
      toast.error("Token de recuperacion no valido");
      return;
    }

    try {
      setIsLoading(true);
      await authApi.resetPassword(email, token, password);
      toast.success("Tu contrasena ha sido actualizada");
      router.replace("/(auth)/login");
    } catch {
      toast.error("No se pudo restablecer la contrasena");
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
          <Text className="text-xl font-display text-foreground mt-6 mb-2">Nueva contrasena</Text>
          <Text className="text-sm font-sans text-muted-foreground text-center">
            Elige una contrasena segura para tu cuenta
          </Text>
        </View>

        <Card>
          <Input
            label="Nueva contrasena"
            value={password}
            onChangeText={setPassword}
            placeholder="Minimo 8 caracteres"
            secureTextEntry
          />
          <Input
            label="Confirmar contrasena"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repite tu contrasena"
            secureTextEntry
          />

          <Button size="lg" onPress={handleResetPassword} loading={isLoading}>
            Guardar contrasena
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
