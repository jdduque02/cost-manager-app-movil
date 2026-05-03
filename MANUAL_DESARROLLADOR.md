# Manual de Consumo de API — Cost Manager Mobile

> Para desarrolladores · Versión 1.0.0 · Fecha: 2026-04-28

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Configuración del cliente HTTP](#2-configuración-del-cliente-http)
3. [Autenticación](#3-autenticación)
4. [Módulos de API disponibles](#4-módulos-de-api-disponibles)
5. [Gestión de estado (Stores)](#5-gestión-de-estado-stores)
6. [Patrón Offline-First](#6-patrón-offline-first)
7. [Hooks de alto nivel](#7-hooks-de-alto-nivel)
8. [Base de datos local (SQLite)](#8-base-de-datos-local-sqlite)
9. [Sincronización](#9-sincronización)
10. [Seguridad](#10-seguridad)
11. [Testing](#11-testing)
12. [Variables de entorno](#12-variables-de-entorno)

---

## 1. Arquitectura general

```
App (Expo Router)
│
├── Screens / Pages       ← presentación
│    └── usan Hooks
│
├── Hooks                 ← lógica de negocio (useOfflineQuery, useOfflineMutations)
│    └── usan Stores + API + LocalRepo
│
├── Stores (Zustand)      ← estado global (auth.store, offline.store)
│    └── usan API + LocalRepo
│
├── API Layer             ← comunicación con el servidor (axios + interceptores)
│    └── client.ts, *.api.ts
│
└── Database Layer        ← persistencia local (SQLite)
     └── database.service.ts, local.repository.ts, sync.service.ts
```

---

## 2. Configuración del cliente HTTP

### Archivo: `src/api/client.ts`

El cliente Axios se configura con:

- **Base URL**: leída desde `Constants.expoConfig.extra.API_BASE_URL` (ver [Variables de entorno](#12-variables-de-entorno)).
- **Timeout**: 15 000 ms.
- **Interceptor de request**: adjunta el `Bearer` token desde `SecureStore` y un `X-Request-ID` único por petición.
- **Interceptor de response**: si recibe `401`, intenta renovar el token automáticamente con el `refresh_token` y reintenta la petición original **una sola vez** (`_retry` flag).

```typescript
import { apiClient } from "@/api/client";

// Petición simple (el token se adjunta automáticamente)
const response = await apiClient.get("/users/1/profile");
```

### Funciones utilitarias exportadas

| Función                       | Descripción                                       |
| ----------------------------- | ------------------------------------------------- |
| `saveTokens(access, refresh)` | Persiste tokens en `SecureStore`                  |
| `clearTokens()`               | Elimina ambos tokens del almacén seguro           |
| `getStoredTokens()`           | Lee los tokens sin petición al servidor           |
| `redactSensitive(obj)`        | Elimina campos sensibles de un objeto (para logs) |

---

## 3. Autenticación

### Archivo: `src/api/auth.api.ts`

#### `login(dto: LoginDto)`

```typescript
import { login } from "@/api/auth.api";

const response = await login({
  username: "usuario",
  password: "Passw0rd",
});
// response.data[0].access_token → token de acceso
```

**Flujo interno:**

1. `POST /auth/login` con `{ username, password }`.
2. Extrae `access_token` y `refresh_token` de la respuesta.
3. Llama a `saveTokens()` para persistirlos.

#### `logout(refreshToken: string)`

```typescript
import { logout } from "@/api/auth.api";

await logout(storedRefreshToken);
// POST /auth/logout → invalida la sesión en Keycloak → clearTokens()
```

#### `refresh(dto: RefreshTokenDto)`

```typescript
import { refresh } from "@/api/auth.api";

await refresh({ refresh_token: storedRefreshToken });
// POST /auth/refresh → guarda nuevos tokens
```

> Normalmente **no necesitas llamar a `refresh` manualmente**. El interceptor de respuesta lo hace automáticamente al recibir un `401`.

#### `forgotPassword(dto: ForgotPasswordDto)`

```typescript
import { forgotPassword } from "@/api/auth.api";

await forgotPassword({ email: "usuario@ejemplo.com" });
// POST /auth/forgot-password → servidor envía correo de recuperación
```

---

## 4. Módulos de API disponibles

Todos los módulos siguen el mismo patrón: reciben el `userId` como primer argumento cuando la ruta lo requiere.

### 4.1 Transacciones — `src/api/transactions.api.ts`

```typescript
import * as transactionsApi from "@/api/transactions.api";

// Listar con filtros opcionales
const { data, total } = await transactionsApi.getTransactions(userId, {
  date_from: "2024-01-01",
  date_to: "2024-12-31",
  type: "EXPENSE",
  page: 1,
  limit: 20,
});

// Crear
const tx = await transactionsApi.createTransaction(userId, {
  categoryId: 3,
  type: "EXPENSE",
  amount: 15000,
  currency: "COP",
  transactionDate: "2024-06-15",
  description: "Almuerzo",
});

// Actualizar
await transactionsApi.updateTransaction(userId, tx.id, { amount: 16000 });

// Eliminar
await transactionsApi.deleteTransaction(userId, tx.id);
```

#### Tipos relevantes

```typescript
// CreateTransactionRecordDto
{
  categoryId: number;        // requerido
  subcategoryId?: number;
  bankAccountId?: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";  // requerido
  amount: number;            // requerido, positivo
  currency: string;          // requerido, ej. "COP"
  description?: string;
  transactionDate: string;   // requerido, ISO 8601
}
```

### 4.2 Cuentas bancarias — `src/api/banking.api.ts`

```typescript
import * as bankingApi from "@/api/banking.api";

// Listar cuentas del usuario
const accounts = await bankingApi.getBankAccounts(userId);

// Crear cuenta
const account = await bankingApi.createBankAccount(userId, {
  name: "Cuenta de ahorros",
  bankName: "Bancolombia",
  accountType: "SAVINGS",
  balance: 1000000,
  currency: "COP",
});

// Actualizar
await bankingApi.updateBankAccount(userId, account.id, { balance: 1500000 });
```

### 4.3 Objetivos financieros — `src/api/objectives.api.ts`

```typescript
import * as objectivesApi from "@/api/objectives.api";

// Listar objetivos
const objectives = await objectivesApi.getObjectives(userId);

// Crear objetivo
const obj = await objectivesApi.createObjective(userId, {
  name: "Fondo de emergencia",
  targetAmount: 10000000,
  currency: "COP",
});
```

### 4.4 Catálogo — `src/api/catalog.api.ts`

```typescript
import * as catalogApi from "@/api/catalog.api";

// Categorías disponibles (globales, no dependen de userId)
const categories = await catalogApi.getCategories();
const subcategories = await catalogApi.getSubcategories(categoryId);
```

### 4.5 Usuarios — `src/api/users.api.ts`

```typescript
import * as usersApi from "@/api/users.api";

const profile = await usersApi.getUserProfile(userId);
await usersApi.updateUserProfile(userId, { firstName: "Nuevo" });
```

---

## 5. Gestión de estado (Stores)

### 5.1 Auth Store — `src/store/auth.store.ts`

```typescript
import { useAuthStore } from "@/store/auth.store";

// Leer estado
const { isAuthenticated, user, userId, isOfflineMode } = useAuthStore();

// Inicializar (llamar una vez al arrancar la app)
await useAuthStore.getState().initialize();

// Login
await useAuthStore.getState().login({ username, password });

// Login offline (sin red)
const success = await useAuthStore.getState().loginOffline();

// Logout
await useAuthStore.getState().logout();

// Actualizar perfil en el store
useAuthStore.getState().setUser(userResponse);
```

#### Estado disponible

| Campo             | Tipo                   | Descripción                                 |
| ----------------- | ---------------------- | ------------------------------------------- |
| `isAuthenticated` | `boolean`              | `true` si hay sesión activa                 |
| `isOfflineMode`   | `boolean`              | `true` si la sesión es solo con caché local |
| `isLoading`       | `boolean`              | `true` durante operaciones asíncronas       |
| `user`            | `UserResponse \| null` | Perfil del usuario                          |
| `userId`          | `number \| null`       | ID del usuario autenticado                  |
| `error`           | `string \| null`       | Mensaje del último error                    |

### 5.2 Offline Store — `src/store/offline.store.ts`

```typescript
import { useOfflineStore } from "@/store/offline.store";

const { isOnline, isSyncing, pendingCount, lastSyncResult } = useOfflineStore();

// Actualizar estado de red (lo llama OfflineBanner automáticamente)
await useOfflineStore.getState().setOnlineStatus(true);

// Sincronización manual
const result = await useOfflineStore.getState().sync();
// result: { synced: number, failed: number, skipped: number }

// Refrescar contador de pendientes
await useOfflineStore.getState().refreshPendingCount();
```

---

## 6. Patrón Offline-First

### `useOfflineQuery` — `src/hooks/useOfflineQuery.ts`

Envuelve `useQuery` de React Query con un fallback local automático.

```typescript
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import * as transactionsApi from "@/api/transactions.api";
import { getLocalTransactions } from "@/database/local.repository";

function useTransactions(userId: number) {
  return useOfflineQuery(
    {
      queryKey: ["transactions", userId],
      queryFn: () => transactionsApi.getTransactions(userId),
    },
    // Fallback: datos locales si no hay red o la petición falla
    () => getLocalTransactions(userId),
  );
}
```

**Comportamiento:**

- **Online**: ejecuta `queryFn`. Si falla, cae al fallback.
- **Offline**: ejecuta directamente el fallback sin intentar la red.
- **Retry**: deshabilitado automáticamente en modo offline.

### `useOfflineMutations` — `src/hooks/useOfflineMutations.ts`

```typescript
import { useOfflineMutations } from "@/hooks/useOfflineMutations";

function MyComponent() {
  const { createTransaction, createBankAccount, createObjective } =
    useOfflineMutations();

  const handleSubmit = async () => {
    // Funciona igual en online y offline
    const tx = await createTransaction({
      type: "EXPENSE",
      amount: 50000,
      currency: "COP",
      categoryId: 1,
      transactionDate: new Date().toISOString(),
    });
    console.log(tx.id); // ID del servidor (online) o ID local (offline)
  };
}
```

---

## 7. Hooks de alto nivel

### `useNetworkStatus` — `src/hooks/useNetworkStatus.ts`

```typescript
import { useNetworkStatus, checkConnectivity } from "@/hooks/useNetworkStatus";

// Hook reactivo (se actualiza solo)
const { isConnected, isInternetReachable } = useNetworkStatus();

// Verificación puntual (async, para usar fuera de componentes)
const hasInternet = await checkConnectivity();
```

---

## 8. Base de datos local (SQLite)

### Esquema de tablas

| Tabla                  | Descripción                                           |
| ---------------------- | ----------------------------------------------------- |
| `local_user`           | Perfil del usuario en caché                           |
| `categories`           | Catálogo de categorías sincronizado                   |
| `subcategories`        | Subcategorías por categoría                           |
| `bank_accounts`        | Cuentas bancarias (incluye pendientes de sync)        |
| `transactions`         | Transacciones (incluye pendientes de sync)            |
| `financial_objectives` | Objetivos financieros                                 |
| `pending_operations`   | Cola de operaciones offline pendientes de sincronizar |

### Funciones del repositorio — `src/database/local.repository.ts`

```typescript
import * as localRepo from "@/database/local.repository";

// Usuario
await localRepo.cacheUser(userResponse);
const user = await localRepo.getCachedUser(); // null si no hay caché
await localRepo.clearCachedUser();

// Transacciones
await localRepo.saveTransactions(txList);
const txs = await localRepo.getLocalTransactions(userId);
const newTx = await localRepo.createLocalTransaction(userId, dto);
// → genera local_id y añade is_pending_sync = 1

// Cuentas bancarias
await localRepo.saveBankAccounts(accountList);
const accounts = await localRepo.getLocalBankAccounts(userId);
const newAcc = await localRepo.createLocalBankAccount(userId, dto);

// Objetivos
await localRepo.saveObjectives(objectiveList);
const objs = await localRepo.getLocalObjectives(userId);
const newObj = await localRepo.createLocalObjective(userId, dto);

// Operaciones pendientes
const pending = await localRepo.getPendingOperations();
await localRepo.deletePendingOperation(opId);
await localRepo.incrementRetryCount(opId);
await localRepo.markEntitySynced(entity, localId, serverId);
```

---

## 9. Sincronización

### Archivo: `src/database/sync.service.ts`

```typescript
import { syncPendingOperations } from "@/database/sync.service";

const result = await syncPendingOperations();
// result: { synced: 2, failed: 0, skipped: 0 }
```

### Flujo de sincronización

```
getPendingOperations()
    │
    ▼ por cada operación:
┌───────────────────────────────────────┐
│ ¿entidad en whitelist?                │ NO → deletePendingOperation() → skip
│ ¿operación en whitelist?              │ NO → deletePendingOperation() → skip
│ retryCount >= MAX_RETRIES (3)?        │ SÍ → skipped++                → skip
│ ¿hay handler para entity+operation?   │ NO → deletePendingOperation() → skip
│                                       │
│ Ejecutar handler (llamada al API)     │
│   ├── OK → markEntitySynced()         │
│   │         deletePendingOperation()  │
│   │         synced++                  │
│   └── ERR→ incrementRetryCount()      │
│             failed++                  │
└───────────────────────────────────────┘
```

### Entidades y operaciones soportadas

| Entidad                | Operaciones |
| ---------------------- | ----------- |
| `transactions`         | `CREATE`    |
| `bank_accounts`        | `CREATE`    |
| `financial_objectives` | `CREATE`    |

> `UPDATE` y `DELETE` están en la whitelist de operaciones pero los handlers no están implementados todavía.

---

## 10. Seguridad

### Almacenamiento de tokens

Los tokens JWT se almacenan en `expo-secure-store`, que usa:

- **iOS**: Keychain Services.
- **Android**: Keystore System.

Nunca se almacenan en `AsyncStorage` ni en el estado de React.

### Utilidades — `src/utils/security.ts`

```typescript
import {
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateUsername,
  checkLoginRateLimit,
  recordFailedAttempt,
  resetRateLimit,
} from "@/utils/security";

// Sanitizar inputs antes de enviarlos
const clean = sanitizeInput(rawInput);

// Validar email
if (!validateEmail(email)) {
  /* error */
}

// Validar contraseña
const { valid, message } = validatePassword(password);
if (!valid) {
  /* mostrar message al usuario */
}

// Rate limiting de login
const check = await checkLoginRateLimit();
if (!check.allowed) {
  console.log(`Bloqueado. Intenta en ${check.retryAfterSeconds}s`);
  return;
}
// ... intento de login ...
// Si falla:
await recordFailedAttempt();
// Si tiene éxito:
await resetRateLimit();
```

### Logging seguro

```typescript
import { redactSensitive } from "@/api/client";

// NUNCA loguear objetos con tokens directamente:
// console.log(requestBody); // ❌

// Siempre usar redactSensitive:
console.log(redactSensitive(requestBody)); // ✅
// → { username: "user", password: "[REDACTED]" }
```

---

## 11. Testing

### Ejecutar tests

```bash
# Todos los tests
npm test

# Modo watch (durante desarrollo)
npm run test:watch

# Con cobertura
npm run test:coverage
```

### Estructura de tests

```
src/
├── api/__tests__/
│   ├── client.test.ts       # redactSensitive
│   └── auth.api.test.ts     # login, logout, forgotPassword
├── store/__tests__/
│   ├── auth.store.test.ts   # initialize, login, logout, loginOffline, setUser
│   └── offline.store.test.ts # setOnlineStatus, sync, refreshPendingCount
├── hooks/__tests__/
│   ├── useNetworkStatus.test.ts  # hook reactivo + checkConnectivity
│   └── useOfflineQuery.test.tsx  # online, offline, fallback
├── database/__tests__/
│   └── sync.service.test.ts # whitelist, reintentos, handlers
├── components/__tests__/
│   └── OfflineBanner.test.tsx # render condicional, botón sincronizar
└── utils/__tests__/
    └── security.test.ts     # sanitize, validate, rate limiting
```

### Convenciones de mocking

```typescript
// Mockear módulos completos al inicio del archivo
jest.mock("@/api/auth.api");
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Limpiar mocks entre tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

## 12. Variables de entorno

Copia `.env.example` como `.env` y completa los valores:

```bash
cp .env.example .env
```

### Variables disponibles

| Variable       | Descripción           | Ejemplo                              |
| -------------- | --------------------- | ------------------------------------ |
| `API_BASE_URL` | URL base del servidor | `https://api.costmanager.com/api/v1` |

Las variables se exponen a la app mediante `app.json` → `expo.extra`:

```json
// app.json
{
  "expo": {
    "extra": {
      "API_BASE_URL": "https://api.costmanager.com/api/v1"
    }
  }
}
```

Y se leen en `src/api/client.ts`:

```typescript
const API_BASE_URL =
  Constants.expoConfig?.extra?.API_BASE_URL ?? "http://localhost:3000/api/v1";
```

> **Importante:** Usa siempre `https://` en producción. La app mostrará un `console.warn` si la URL no usa HTTPS (excepto para `localhost` y el emulador Android `10.0.2.2`).
