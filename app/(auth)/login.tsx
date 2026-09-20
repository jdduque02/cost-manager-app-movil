import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAppTheme } from "@/components/ThemeProvider";
import { PALETTE } from "@/theme/palette";
import { getCachedUser } from "@/database/local.repository";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
  sanitizeInput,
  validateUsername,
} from "@/utils/security";
import { SprigLogo } from "@/components/ui/SprigLogo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RevealSection } from "@/components/ui/RevealSection";
import { Eye, EyeOff } from "@/components/ui/icons";
import { toast } from "@/utils/toast";

export default function LoginScreen() {
  const { login, loginOffline, continueAsGuest, isLoading, error, clearError } =
    useAuthStore();
  const { resolvedScheme } = useAppTheme();
  const c = PALETTE[resolvedScheme];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasCachedSession, setHasCachedSession] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    getCachedUser().then((u) => setHasCachedSession(!!u));
    checkLoginRateLimit().then((check) => {
      if (!check.allowed && check.retryAfterSeconds) {
        setLockoutSeconds(check.retryAfterSeconds);
      }
    });
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setTimeout(() => setLockoutSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

  async function handleLogin() {
    const cleanUsername = sanitizeInput(username);
    const cleanPassword = password;

    if (!cleanUsername || !cleanPassword) {
      toast.error("Campos requeridos", "Ingresa usuario y contrasena");
      return;
    }

    const usernameCheck = validateUsername(cleanUsername);
    if (!usernameCheck.valid) {
      toast.error("Usuario invalido", usernameCheck.message);
      return;
    }

    const rateCheck = await checkLoginRateLimit();
    if (!rateCheck.allowed) {
      const mins = Math.ceil((rateCheck.retryAfterSeconds ?? 0) / 60);
      setLockoutSeconds(rateCheck.retryAfterSeconds ?? 0);
      toast.warning(
        "Demasiados intentos",
        `Cuenta bloqueada temporalmente. Intenta de nuevo en ${mins} min.`,
      );
      return;
    }

    try {
      clearError();
      await login({ username: cleanUsername, password: cleanPassword });
      await clearLoginAttempts();
      router.replace("/(tabs)");
    } catch (err) {
      console.error(
        "[Login] attempt failed:",
        err instanceof Error ? err.message : String(err),
      );
      await recordLoginFailure();
      const newCheck = await checkLoginRateLimit();
      if (!newCheck.allowed && newCheck.retryAfterSeconds) {
        setLockoutSeconds(newCheck.retryAfterSeconds);
      }
    }
  }

  async function handleOfflineAccess() {
    const success = await loginOffline();
    if (success) {
      router.replace("/(tabs)");
    } else {
      toast.warning(
        "Sin sesion guardada",
        "No hay datos de sesion almacenados. Inicia sesion con conexion a internet al menos una vez.",
      );
    }
  }

  async function handleContinueAsGuest() {
    await continueAsGuest();
    router.replace("/(tabs)");
  }

  const isLocked = lockoutSeconds > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-10">
          <SprigLogo variant="full" size="lg" />
          <Text className="text-sm font-sans text-muted-foreground mt-2">
            Gestiona tus finanzas personales
          </Text>
        </View>

        {!isConnected && (
          <View className="bg-warning/15 rounded-xl p-3 mb-4 flex-row items-center">
            <Text className="text-warning-foreground text-sm font-sans-semibold">
              Sin conexion - modo offline disponible
            </Text>
          </View>
        )}

        {isLocked && (
          <View className="bg-destructive/15 rounded-xl p-3 mb-4">
            <Text className="text-destructive text-sm font-sans-semibold text-center">
              Demasiados intentos. Espera {Math.ceil(lockoutSeconds / 60)}:
              {String(lockoutSeconds % 60).padStart(2, "0")} min
            </Text>
          </View>
        )}

        {/* Form */}
        <RevealSection>
          <Card>
            {error ? (
              <View className="bg-destructive/15 rounded-lg p-3 mb-4">
                <Text className="text-destructive text-sm font-sans">{error}</Text>
              </View>
            ) : null}

            <Input
              label="Usuario"
              value={username}
              onChangeText={setUsername}
              placeholder="tu_usuario"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              maxLength={32}
            />

            <Input
              label="Contrasena"
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              maxLength={128}
              onSubmitEditing={handleLogin}
              rightElement={
                <Pressable
                  className="h-11 w-11 items-center justify-center"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={c.mutedForeground} />
                  ) : (
                    <Eye size={20} color={c.mutedForeground} />
                  )}
                </Pressable>
              }
            />

            <Pressable className="self-end mb-5" onPress={() => router.push("/(auth)/forgot-password")}>
              <Text className="text-primary text-sm font-sans">Olvidaste tu contrasena?</Text>
            </Pressable>

            <Button size="lg" onPress={handleLogin} loading={isLoading} disabled={isLocked}>
              Iniciar Sesion
            </Button>

            {hasCachedSession && (
              <Button
                variant="outline"
                size="lg"
                onPress={handleOfflineAccess}
                disabled={isLoading}
                className="mt-3"
              >
                Continuar sin conexion
              </Button>
            )}

            <Button
              variant="ghost"
              size="lg"
              onPress={handleContinueAsGuest}
              disabled={isLoading}
              className="mt-3"
            >
              Continuar sin cuenta
            </Button>

            <View className="flex-row justify-center mt-5">
              <Text className="text-muted-foreground text-sm font-sans">No tienes cuenta? </Text>
              <Pressable onPress={() => router.push("/(auth)/register")}>
                <Text className="text-primary font-sans-bold text-sm">Registrate</Text>
              </Pressable>
            </View>
          </Card>
        </RevealSection>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
