# Cost Manager Mobile

Aplicación móvil en **Expo / React Native** para consumir la API de [cost-manager](../cost-manager).

## Tecnologías

| Librería          | Propósito                                    |
| ----------------- | -------------------------------------------- |
| Expo Router       | Navegación basada en archivos (Stack + Tabs) |
| Zustand           | Estado global (autenticación)                |
| TanStack Query    | Caché y fetching de datos                    |
| Axios             | Cliente HTTP con interceptores               |
| expo-secure-store | Almacenamiento seguro de tokens              |

## Estructura

```
app/
  _layout.tsx            ← Root layout + QueryClientProvider
  index.tsx              ← Redirección auth/tabs
  (auth)/
    login.tsx
    register.tsx
    forgot-password.tsx
  (tabs)/
    index.tsx            ← Dashboard
    transactions.tsx     ← Transacciones
    banking.tsx          ← Cuentas bancarias
    objectives.tsx       ← Objetivos financieros
    profile.tsx          ← Perfil de usuario

src/
  api/
    client.ts            ← Axios + interceptores + token refresh
    auth.api.ts
    users.api.ts
    transactions.api.ts
    banking.api.ts
    objectives.api.ts
    catalog.api.ts
  store/
    auth.store.ts        ← Zustand store de autenticación
  types/
    auth.types.ts
    user.types.ts
    transaction.types.ts
    banking.types.ts
    objective.types.ts
    catalog.types.ts
```

## Configuración

1. Copia `.env.example` a `.env` y ajusta la URL del API:

   ```
   API_BASE_URL=http://192.168.x.x:3000/api/v1
   ```

   > Usa la IP local de tu máquina (no `localhost`) al probar en dispositivo físico o emulador Android.

2. Instala dependencias:

   ```bash
   npm install
   ```

3. Inicia la app:
   ```bash
   npx expo start
   ```

## Módulos consumidos

| Módulo API                                   | Pantalla                  |
| -------------------------------------------- | ------------------------- |
| `POST /auth/login`                           | Login                     |
| `POST /auth/logout`                          | Perfil                    |
| `POST /auth/refresh`                         | Interceptor automático    |
| `POST /auth/forgot-password`                 | Forgot Password           |
| `POST /user`                                 | Registro                  |
| `GET /users/:id/transactions`                | Dashboard + Transacciones |
| `POST /users/:id/transactions`               | Transacciones             |
| `DELETE /users/:id/transactions/:id`         | Transacciones             |
| `GET /users/:id/bank-accounts`               | Dashboard + Cuentas       |
| `POST /users/:id/bank-accounts`              | Cuentas                   |
| `DELETE /users/:id/bank-accounts/:id`        | Cuentas                   |
| `GET /users/:id/financial-objectives`        | Objetivos                 |
| `POST /users/:id/financial-objectives`       | Objetivos                 |
| `DELETE /users/:id/financial-objectives/:id` | Objetivos                 |
| `GET /catalog/categories`                    | Selector categorías       |
| `GET /user/:id/financial-profile`            | Perfil                    |

# correr el back por un tunel
C:\Users\jdduq\AppData\Local\ngrok-cli\ngrok.exe" http 3000