import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as usersApi from "@/api/users.api";
import { SprigLogo } from "@/components/ui/SprigLogo";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/utils/toast";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!fullName || !email || !username || !password) {
      toast.error("Campos requeridos", "Completa todos los campos");
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

    try {
      setError(null);
      setIsLoading(true);
      await usersApi.createUser({
        username,
        email,
        password,
        full_name: fullName,
        locale: "es",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/Bogota",
        metadata: { prefered_theme: "dark", notifications: true },
      });
      router.replace("/(auth)/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
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
          <SprigLogo variant="full" size="md" />
          <Text className="text-sm font-sans text-muted-foreground mt-2">Crea tu cuenta</Text>
        </View>

        <Card>
          {error ? (
            <View className="bg-destructive/15 rounded-lg p-3 mb-4">
              <Text className="text-destructive text-sm font-sans">{error}</Text>
            </View>
          ) : null}

          <Input label="Nombre completo" value={fullName} onChangeText={setFullName} placeholder="Juan Perez" />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="juan@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            placeholder="juan_perez"
            autoCapitalize="none"
          />
          <Input
            label="Contrasena"
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

          <Button size="lg" onPress={handleRegister} loading={isLoading}>
            Crear cuenta
          </Button>

          <View className="flex-row justify-center mt-5">
            <Text className="text-muted-foreground text-sm font-sans">Ya tienes cuenta? </Text>
            <Pressable onPress={() => router.back()}>
              <Text className="text-primary font-sans-bold text-sm">Inicia sesion</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
