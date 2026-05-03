import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as authApi from "@/api/auth.api";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert("Campo requerido", "Ingresa tu correo electrónico");
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      Alert.alert(
        "Correo enviado",
        "Revisa tu bandeja de entrada para restablecer tu contraseña",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      Alert.alert("Error", "No se pudo enviar el correo. Verifica tu email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-16">
        <TouchableOpacity className="mb-6" onPress={() => router.back()}>
          <Text className="text-brand-700 text-base">← Volver</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-brand-900 mb-2">
          Restablecer contraseña
        </Text>
        <Text className="text-sm text-brand-800 mb-8 leading-5">
          Ingresa tu email y te enviaremos un enlace para restablecer tu
          contraseña.
        </Text>

        <Text className="text-sm font-semibold text-brand-900 mb-1.5">
          Email
        </Text>
        <TextInput
          className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-white mb-5 text-base"
          value={email}
          onChangeText={setEmail}
          placeholder="juan@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          className={`bg-brand-900 rounded-xl p-4 items-center${loading ? " opacity-60" : ""}`}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">
              Enviar enlace
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
