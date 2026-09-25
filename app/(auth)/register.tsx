import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as usersApi from "@/api/users.api";
import { SprigLogo } from "@/components/ui/SprigLogo";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/utils/toast";
import { LEGAL_VERSION, openLegal } from "@/utils/legal";
import {
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/utils/security";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (isLoading) return;

    if (!fullName || !email || !username || !password) {
      toast.error("Campos requeridos", "Completa todos los campos");
      return;
    }

    const cleanEmail = sanitizeInput(email);
    if (!validateEmail(cleanEmail)) {
      toast.error("Email invalido", "Ingresa un correo electronico valido");
      return;
    }

    const cleanUsername = sanitizeInput(username);
    const usernameCheck = validateUsername(cleanUsername);
    if (!usernameCheck.valid) {
      toast.error("Usuario invalido", usernameCheck.message);
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      toast.error("Contrasena invalida", passwordCheck.message);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contrasenas no coinciden");
      return;
    }

    if (!accepted) {
      toast.error(
        "Aceptacion requerida",
        "Debes aceptar los terminos y la politica de privacidad, y confirmar que eres mayor de 18 anos",
      );
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await usersApi.createUser({
        username: cleanUsername,
        email: cleanEmail,
        password,
        full_name: fullName,
        accepted_terms_version: LEGAL_VERSION,
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
            placeholder="Minimo 12 caracteres"
            secureTextEntry
          />
          <Input
            label="Confirmar contrasena"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repite tu contrasena"
            secureTextEntry
          />

          <Pressable
            onPress={() => setAccepted((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            accessibilityLabel="Soy mayor de 18 años, acepto los términos y condiciones y autorizo el tratamiento de mis datos personales"
            className="flex-row items-start mb-4"
          >
            <View
              className={`w-6 h-6 rounded border items-center justify-center mr-3 ${
                accepted ? "bg-primary border-primary" : "border-input"
              }`}
            >
              {accepted ? (
                <Text className="text-primary-foreground text-sm font-sans-bold">✓</Text>
              ) : null}
            </View>
            <Text className="flex-1 text-sm font-sans text-foreground">
              Soy mayor de 18 años, acepto los{" "}
              <Text
                accessibilityRole="link"
                className="text-primary font-sans-bold"
                onPress={() => openLegal("terminos")}
              >
                Términos y Condiciones
              </Text>{" "}
              y autorizo el tratamiento de mis datos personales conforme a la{" "}
              <Text
                accessibilityRole="link"
                className="text-primary font-sans-bold"
                onPress={() => openLegal("privacidad")}
              >
                Política de Privacidad
              </Text>
              .
            </Text>
          </Pressable>

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
