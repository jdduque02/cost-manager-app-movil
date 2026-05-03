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
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { getCachedUser } from "@/database/local.repository";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
  sanitizeInput,
  validateUsername,
} from "@/utils/security";

export default function LoginScreen() {
  const { login, loginOffline, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasCachedSession, setHasCachedSession] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    getCachedUser().then((u) => setHasCachedSession(!!u));
    // Verificar estado de bloqueo al montar
    checkLoginRateLimit().then((check) => {
      if (!check.allowed && check.retryAfterSeconds) {
        setLockoutSeconds(check.retryAfterSeconds);
      }
    });
  }, []);

  // Contador de cuenta regresiva para el lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setTimeout(() => setLockoutSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

  async function handleLogin() {
    const cleanUsername = sanitizeInput(username);
    const cleanPassword = password; // no sanitizar password para no alterar el valor real

    if (!cleanUsername || !cleanPassword) {
      Alert.alert("Campos requeridos", "Ingresa usuario y contraseña");
      return;
    }

    const usernameCheck = validateUsername(cleanUsername);
    if (!usernameCheck.valid) {
      Alert.alert("Usuario inválido", usernameCheck.message);
      return;
    }

    // Verificar rate limit antes de enviar al servidor
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
    } catch {
      // Registrar fallo para el rate limiter
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
        "Sin sesión guardada",
        "No hay datos de sesión almacenados. Inicia sesión con conexión a internet al menos una vez.",
      );
    }
  }

  const isLocked = lockoutSeconds > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-10">
          <Text className="text-6xl mb-2">💰</Text>
          <Text className="text-3xl font-bold text-brand-900">
            Cost Manager
          </Text>
          <Text className="text-sm text-brand-800 mt-1">
            Gestiona tus finanzas personales
          </Text>
        </View>

        {/* Banner sin conexión */}
        {!isConnected && (
          <View className="bg-yellow-100 rounded-xl p-3 mb-4 flex-row items-center">
            <Text className="text-yellow-800 text-sm font-semibold">
              ⚠️ Sin conexión — modo offline disponible
            </Text>
          </View>
        )}

        {/* Banner de bloqueo por intentos */}
        {isLocked && (
          <View className="bg-red-100 rounded-xl p-3 mb-4">
            <Text className="text-red-700 text-sm font-semibold text-center">
              🔒 Demasiados intentos. Espera {Math.ceil(lockoutSeconds / 60)}:{String(lockoutSeconds % 60).padStart(2, "0")} min
            </Text>
          </View>
        )}

        {/* Form */}
        <View className="bg-white rounded-2xl p-6 shadow-md elevation-3">
          {error ? (
            <View className="bg-red-100 rounded-lg p-3 mb-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-semibold text-brand-900 mb-1.5">
            Usuario
          </Text>
          <TextInput
            className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-base"
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

          <Text className="text-sm font-semibold text-brand-900 mb-1.5">
            Contraseña
          </Text>
          <TextInput
            className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-base"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            maxLength={128}
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            className="self-end mb-5"
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text className="text-brand-700 text-sm">
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`bg-brand-900 rounded-xl p-4 items-center${isLoading || isLocked ? " opacity-60" : ""}`}
            onPress={handleLogin}
            disabled={isLoading || isLocked}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">
                Iniciar Sesión
              </Text>
            )}
          </TouchableOpacity>

          {/* Botón de acceso offline (solo si hay sesión cacheada) */}
          {hasCachedSession && (
            <TouchableOpacity
              className="mt-3 border border-brand-300 rounded-xl p-4 items-center"
              onPress={handleOfflineAccess}
              disabled={isLoading}
            >
              <Text className="text-brand-900 font-semibold text-base">
                Continuar sin conexión
              </Text>
              <Text className="text-brand-600 text-xs mt-0.5">
                Usar datos guardados localmente
              </Text>
            </TouchableOpacity>
          )}

          <View className="flex-row justify-center mt-5">
            <Text className="text-brand-800 text-sm">¿No tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text className="text-brand-900 font-bold text-sm">
                Regístrate
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-10">
          <Text className="text-6xl mb-2">💰</Text>
          <Text className="text-3xl font-bold text-brand-900">
            Cost Manager
          </Text>
          <Text className="text-sm text-brand-800 mt-1">
            Gestiona tus finanzas personales
          </Text>
        </View>

        {/* Form */}
        <View className="bg-white rounded-2xl p-6 shadow-md elevation-3">
          {error ? (
            <View className="bg-red-100 rounded-lg p-3 mb-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-semibold text-brand-900 mb-1.5">
            Usuario
          </Text>
          <TextInput
            className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-base"
            value={username}
            onChangeText={setUsername}
            placeholder="tu_usuario"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text className="text-sm font-semibold text-brand-900 mb-1.5">
            Contraseña
          </Text>
          <TextInput
            className="border border-brand-100 rounded-xl p-3 text-brand-900 bg-brand-50 mb-4 text-base"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            className="self-end mb-5"
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text className="text-brand-700 text-sm">
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`bg-brand-900 rounded-xl p-4 items-center${isLoading ? " opacity-60" : ""}`}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">
                Iniciar Sesión
              </Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center mt-5">
            <Text className="text-brand-800 text-sm">¿No tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text className="text-brand-900 font-bold text-sm">
                Regístrate
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
