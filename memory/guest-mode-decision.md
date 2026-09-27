---
name: guest-mode-decision
description: Decisión de alcance y mecanismo del modo invitado local (offline sin login) — sentinel de user_id, migración de datos al loguearse/registrarse, y qué pantallas quedan excluidas.
metadata:
  type: project
---

# Modo invitado (offline sin login)

Confirmado con el usuario (sept/2026): "el modo offline debe funcionar sin
login" se resolvió como **modo invitado local completo**, no solo como
"offline con sesión previa cacheada" (eso ya existía en `auth.store.ts` antes
de esta decisión).

## Mecanismo elegido

- Sentinel `GUEST_USER_ID = -1` (`src/database/local.repository.ts`) usado
  como `user_id` en SQLite para todo dato creado en modo invitado. Se eligió
  sobre una tabla de "owner local" aparte porque todas las queries
  `getLocal*(userId)` / `createLocal*(userId, dto)` ya reciben `userId` como
  parámetro — reusar la misma columna evitó tocar el esquema o duplicar
  lógica de lectura/escritura.
- `auth.store.ts` gana un tercer estado `isGuest`, explícitamente distinto de
  `isOfflineMode` (que sigue significando "sesión real cacheada, sin red").
  Persiste con la clave `guest_mode_active_v1` en `expo-secure-store` (no en
  SQLite) para sobrevivir a un reinicio de la app.
- `continueAsGuest()` nunca "degrada" una sesión real cacheada existente: si
  `getCachedUser()` devuelve algo, se prioriza esa sesión offline en vez de
  entrar en modo invitado.
- **Migración**: al hacer `login()` exitoso viniendo de modo invitado,
  `migrateGuestDataToUser(newUserId)` hace `UPDATE ... SET user_id = ?` en
  todas las tablas de datos de usuario (transacciones, cuentas, objetivos,
  empresas, activos/pasivos, subcategorías, pagos de objetivo) y remapea el
  campo `userId` dentro de los payloads JSON de `pending_operations` que
  pertenecían al invitado. La marca `guest_mode_active_v1` sólo se borra si
  la migración corrió sin lanzar — si falla, se reintenta en el próximo login
  exitoso en vez de perder el rastro de esos datos.
- El registro (`app/(auth)/register.tsx`) NO migra nada por sí solo — solo
  crea la cuenta en el backend y vuelve a `/login`; la migración ocurre
  cuando el usuario efectivamente inicia sesión con esa cuenta nueva.

## Qué queda explícitamente fuera de alcance de esta ronda

- `useOfflineQuery`/`useOfflineMutations` tratan `isGuest` como "siempre
  offline" (nunca intentan la petición de red, aunque haya conexión) — evita
  mandarle al backend un `userId` negativo. Pantallas que llaman a la API
  directamente por fuera de estos hooks compartidos (p. ej. flujos de sesión,
  reportes, inteligencia) no se tocaron: no son pantallas de "datos del
  usuario" offline-first en el sentido del producto, y de todos modos un
  invitado no debería tener sesión real de Keycloak para llamarlas.
- No se implementó un banner específico de "modo invitado" en el dashboard —
  solo en `profile.tsx` (banner con CTA a "Crear cuenta" / "Iniciar sesión") y
  el botón "Continuar sin cuenta" en `login.tsx`. Si se pide reforzar la
  visibilidad del modo invitado en otras pantallas, agregarlo ahí sin duplicar
  la lógica de `isGuest` (ya expuesta por `useAuthStore`).
