import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as usersApi from "@/api/users.api";
import {
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/utils/security";

export default function RegisterScreen() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleRegister() {
    const cleanFirst = sanitizeInput(form.firstName);
    const cleanLast = sanitizeInput(form.lastName);
    const cleanUsername = sanitizeInput(form.username);
    const cleanEmail = sanitizeInput(form.email);

    if (
      !cleanFirst ||
      !cleanLast ||
      !cleanUsername ||
      !cleanEmail ||
      !form.password
    ) {
      Alert.alert("Campos requeridos", "Completa todos los campos");
      return;
    }

    const usernameCheck = validateUsername(cleanUsername);
    if (!usernameCheck.valid) {
      Alert.alert("Usuario inválido", usernameCheck.message);
      return;
    }

    if (!validateEmail(cleanEmail)) {
      Alert.alert("Email inválido", "Ingresa un correo electrónico válido");
      return;
    }

    const pwdCheck = validatePassword(form.password);
    if (!pwdCheck.valid) {
      Alert.alert("Contraseña débil", pwdCheck.message);
      return;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await usersApi.createUser({
        username: cleanUsername,
        email: cleanEmail,
        firstName: cleanFirst,
        lastName: cleanLast,
        password: form.password,
      });
      Alert.alert("¡Cuenta creada!", "Ya puedes iniciar sesión", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: unknown) {
      // No exponer detalles internos del servidor al usuario
      const msg =
        err instanceof Error && err.message.length < 200
          ? err.message
          : "Error al registrar. Intenta nuevamente.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity className="mb-4" onPress={() => router.back()}>
          <Text className="text-brand-700 text-base">← Volver</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-brand-900">Crear cuenta</Text>
        <Text className="text-sm text-brand-800 mb-6">
          Únete a Cost Manager
        </Text>

        <View className="bg-white rounded-2xl p-6 shadow-md elevation-3">
          {(
            [
              { field: "firstName", label: "Nombre", placeholder: "Juan" },
              { field: "lastName", label: "Apellido", placeholder: "Pérez" },
              {
                field: "username",
                label: "Usuario",
                placeholder: "juan_perez",
                autoCapitalize: "none" as const,
              },
              {
                field: "email",
                label: "Email",
                placeholder: "juan@email.com",
                keyboardType: "email-address" as const,
              },
              {
                field: "password",
                label: "Contraseña",
                placeholder: "••••••••",
                secure: true,
              },
              {
                field: "confirmPassword",
                label: "Confirmar contraseña",
                placeholder: "••••••••",
                secure: true,
              },
            ] as const
          ).map(
            ({
              field,
              label,
              placeholder,
              autoCapitalize,
              keyboardType,
              secure,
            }) => (
              <View key={field}>
                <Text className="text-sm font-semibold text-brand-900 mb-1.5">
                  {label}
                </Text>
                <TextInput
                  className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-base"
                  value={form[field]}
                  onChangeText={(v) => update(field, v)}
                  placeholder={placeholder}
                  autoCapitalize={autoCapitalize ?? "words"}
                  keyboardType={keyboardType}
                  secureTextEntry={secure}
                />
              </View>
            ),
          )}

          <TouchableOpacity
            className={`bg-brand-900 rounded-xl p-4 items-center mt-2${loading ? " opacity-60" : ""}`}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">
                Registrarse
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
