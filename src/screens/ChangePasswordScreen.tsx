import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as authApi from "@/api/auth.api";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Check } from "@/components/ui/icons";
import { toast } from "@/utils/toast";

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8) errors.push("Mínimo 8 caracteres");
  if (!/[A-Z]/.test(pw)) errors.push("Requiere una mayúscula");
  if (!/[a-z]/.test(pw)) errors.push("Requiere una minúscula");
  if (!/[0-9]/.test(pw)) errors.push("Requiere un número");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) errors.push("Requiere un carácter especial");
  return errors;
}

export default function ChangePasswordScreen() {
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const pwErrors = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isFormValid =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    pwErrors.length === 0 &&
    passwordsMatch;

  async function handleChangePassword() {
    if (!isFormValid) {
      toast.error("Formulario incompleto", "Corrige los errores antes de continuar");
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success("Contraseña cambiada", "Tu contraseña ha sido actualizada correctamente.");
      router.back();
    } catch {
      toast.error("No se pudo cambiar la contraseña", "Verifica tu contraseña actual.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable className="flex-row items-center gap-2 mb-6" onPress={() => router.back()}>
          <ArrowLeft size={18} color={c.primary} />
          <Text className="text-primary text-base font-sans-semibold">Volver</Text>
        </Pressable>

        <Text className="text-2xl font-display text-foreground mb-2">Cambiar contraseña</Text>
        <Text className="text-sm font-sans text-muted-foreground mb-8 leading-5">
          Actualiza tu contraseña para mantener tu cuenta segura.
        </Text>

        <Card>
          <Input
            label="Contraseña actual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />

          <Input
            label="Nueva contraseña"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />

          {newPassword.length > 0 && (
            <View className="mb-3 gap-1">
              {[
                { label: "8+ caracteres", ok: newPassword.length >= 8 },
                { label: "Una mayúscula", ok: /[A-Z]/.test(newPassword) },
                { label: "Una minúscula", ok: /[a-z]/.test(newPassword) },
                { label: "Un número", ok: /[0-9]/.test(newPassword) },
                { label: "Carácter especial", ok: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
              ].map(({ label, ok }) => (
                <View key={label} className="flex-row items-center gap-1.5">
                  {ok ? (
                    <Check size={12} color={c.success} />
                  ) : (
                    <View className="w-3 h-3 rounded-full border border-muted-foreground" />
                  )}
                  <Text className={`text-xs font-sans ${ok ? "text-success" : "text-muted-foreground"}`}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Input
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            error={
              confirmPassword.length > 0 && !passwordsMatch
                ? "Las contraseñas no coinciden"
                : undefined
            }
          />

          <Button onPress={handleChangePassword} loading={loading} disabled={!isFormValid} className="mt-2">
            Cambiar contraseña
          </Button>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
