import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
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
import { Eye, EyeOff } from "@/components/ui/icons";

export default function LoginScreen() {
  const { login, loginOffline, isLoading, error, clearError } = useAuthStore();
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
      Alert.alert("Campos requeridos", "Ingresa usuario y contrasena");
      return;
    }

    const usernameCheck = validateUsername(cleanUsername);
    if (!usernameCheck.valid) {
      Alert.alert("Usuario invalido", usernameCheck.message);
      return;
    }

    const rateCheck = await checkLoginRateLimit();
    if (!rateCheck.allowed) {
      const mins = Math.ceil((rateCheck.retryAfterSeconds ?? 0) / 60);
      setLockoutSeconds(rateCheck.retryAfterSeconds ?? 0);
      Alert.alert(
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
      console.error("[Login] attempt failed:", err);
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
      Alert.alert(
        "Sin sesion guardada",
        "No hay datos de sesion almacenados. Inicia sesion con conexion a internet al menos una vez.",
      );
    }
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
        <Card>
          {error ? (
            <View className="bg-destructive/15 rounded-lg p-3 mb-4">
              <Text className="text-destructive text-sm font-sans">{error}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-sans-medium text-foreground mb-1.5">Usuario</Text>
          <TextInput
            className="h-11 border border-input rounded-md px-3 text-foreground bg-background mb-4 text-sm font-sans"
            value={username}
            onChangeText={setUsername}
            placeholder="tu_usuario"
            placeholderTextColor={c.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            maxLength={32}
          />

          <Text className="text-sm font-sans-medium text-foreground mb-1.5">Contrasena</Text>
          <View className="relative mb-4">
            <TextInput
              className="h-11 border border-input rounded-md px-3 pr-11 text-foreground bg-background text-sm font-sans"
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              placeholderTextColor={c.mutedForeground}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              maxLength={128}
              onSubmitEditing={handleLogin}
            />
            <Pressable
              className="absolute right-3 top-0 bottom-0 justify-center"
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            >
              {showPassword ? (
                <EyeOff size={20} color={c.mutedForeground} />
              ) : (
                <Eye size={20} color={c.mutedForeground} />
              )}
            </Pressable>
          </View>

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

          <View className="flex-row justify-center mt-5">
            <Text className="text-muted-foreground text-sm font-sans">No tienes cuenta? </Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text className="text-primary font-sans-bold text-sm">Registrate</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
