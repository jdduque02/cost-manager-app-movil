/**
 * Utilidades de seguridad para la app.
 * Cubre: validación de entrada, tasa de intentos de login, sanitización.
 */
import * as SecureStore from "expo-secure-store";

// ─── Sanitización ────────────────────────────────────────────────────────────

/**
 * Elimina caracteres de control y normaliza espacios.
 * No es para prevenir XSS (React Native no interpreta HTML) sino
 * para evitar que entren caracteres nulos o de control en la DB.
 */
export function sanitizeInput(value: string): string {
   
  const noControl = value.trim().replaceAll(/[\x00-\x1F\x7F]/g, "");
  return noControl.replaceAll(/\s+/g, " ");
}

// ─── Validación ───────────────────────────────────────────────────────────────

export function validateEmail(email: string): boolean {
  // RFC 5322 simplificado — rechaza dominios sin TLD y patrones obvios
  const re = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
  return re.test(email.trim());
}

export interface PasswordValidation {
  valid: boolean;
  message?: string;
}

export function validatePassword(password: string): PasswordValidation {
  if (password.length < 8) {
    return {
      valid: false,
      message: "La contraseña debe tener al menos 8 caracteres",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Debe contener al menos una mayúscula" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Debe contener al menos una minúscula" };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: "Debe contener al menos un número" };
  }
  return { valid: true };
}

export interface UsernameValidation {
  valid: boolean;
  message?: string;
}

export function validateUsername(username: string): UsernameValidation {
  if (username.length < 3) {
    return {
      valid: false,
      message: "El usuario debe tener al menos 3 caracteres",
    };
  }
  if (username.length > 32) {
    return {
      valid: false,
      message: "El usuario no puede superar 32 caracteres",
    };
  }
  if (!/^\w+$/.test(username)) {
    return {
      valid: false,
      message: "Solo se permiten letras, números y guión bajo",
    };
  }
  return { valid: true };
}

// ─── Rate limiter de login ────────────────────────────────────────────────────

const RATE_LIMIT_KEY = "login_rate_limit";
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

interface RateLimitState {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

function defaultState(): RateLimitState {
  return { attempts: 0, firstAttemptAt: Date.now(), lockedUntil: null };
}

async function loadState(): Promise<RateLimitState> {
  try {
    const raw = await SecureStore.getItemAsync(RATE_LIMIT_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw) as RateLimitState;
  } catch {
    return defaultState();
  }
}

async function saveState(state: RateLimitState): Promise<void> {
  await SecureStore.setItemAsync(RATE_LIMIT_KEY, JSON.stringify(state));
}

export interface RateLimitCheck {
  allowed: boolean;
  /** Segundos restantes de bloqueo, si aplica */
  retryAfterSeconds?: number;
  attemptsLeft?: number;
}

/** Llama ANTES de intentar el login. Devuelve si está permitido. */
export async function checkLoginRateLimit(): Promise<RateLimitCheck> {
  const state = await loadState();
  const now = Date.now();

  // Si hay lockout activo
  if (state.lockedUntil && now < state.lockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
    };
  }

  // Si el lockout expiró, reiniciar
  if (state.lockedUntil && now >= state.lockedUntil) {
    await saveState(defaultState());
    return { allowed: true, attemptsLeft: MAX_ATTEMPTS };
  }

  // Ventana de 15 min expirada sin lockout → reiniciar
  if (now - state.firstAttemptAt > LOCKOUT_MS) {
    await saveState(defaultState());
    return { allowed: true, attemptsLeft: MAX_ATTEMPTS };
  }

  const attemptsLeft = MAX_ATTEMPTS - state.attempts;
  return { allowed: attemptsLeft > 0, attemptsLeft: Math.max(0, attemptsLeft) };
}

/** Llama cuando un intento de login FALLA. */
export async function recordLoginFailure(): Promise<void> {
  const state = await loadState();
  const now = Date.now();

  // Reiniciar ventana si expiró
  if (now - state.firstAttemptAt > LOCKOUT_MS) {
    await saveState({ attempts: 1, firstAttemptAt: now, lockedUntil: null });
    return;
  }

  const attempts = state.attempts + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null;
  await saveState({ ...state, attempts, lockedUntil });
}

/** Llama cuando el login es EXITOSO para limpiar el contador. */
export async function clearLoginAttempts(): Promise<void> {
  await SecureStore.deleteItemAsync(RATE_LIMIT_KEY);
}
