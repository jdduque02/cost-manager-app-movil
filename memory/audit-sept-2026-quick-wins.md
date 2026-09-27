---
name: audit-sept-2026-quick-wins
description: Qué se implementó de la auditoría general de sept/2026 (visuales, rendimiento, seguridad, animaciones, progress bars, confirmaciones), qué se difirió a propósito y por qué.
metadata:
  type: project
---

# Quick wins implementados de la auditoría de sept/2026

Contexto: se hizo una auditoría de diagnóstico completa (sin código) cubriendo
visuales, rendimiento, seguridad, animaciones, progress bars y modales de
confirmación. El usuario aprobó implementar los "quick wins" priorizados.
Este archivo documenta las decisiones de alcance no obvias de esa ronda —
no repetir el análisis completo, ya vive en el historial de la auditoría.

## Implementado

- **Transacciones SQLite por lote** (`src/database/local.repository.ts`):
  `saveCategories`, `saveBankAccounts`, `saveTransactions`, `saveObjectives`,
  `saveCompanies` ahora envuelven su `for` de `db.runAsync` en
  `db.withTransactionAsync(...)` — un solo commit por lote en vez de uno por
  fila. `saveSubcategories`, `saveFinancialAssets`, `saveFinancialLiabilities`
  **no se tocaron** (mismo patrón, pero no estaban en el alcance aprobado de
  esta ronda) — si se vuelve a tocar rendimiento de SQLite, aplicar el mismo
  cambio ahí también por consistencia.
- **Confirmación al registrar pago de objetivo** (`ObjectiveDetailScreen.tsx`,
  `handlePay`): `Alert.alert` con el monto formateado antes de llamar a
  `payMutation`, porque no existe endpoint ni UI para editar/eliminar un pago
  ya registrado — es irreversible desde el cliente.
- **Loading por fila en `SessionsScreen`**: se reemplazó
  `revokeMutation.isPending` (global) por un `revokingId: string | null`
  trackeado por `sessionId`. `onSettled` solo limpia `revokingId` si sigue
  siendo el de esa llamada específica (evita que revocar la sesión A apague
  el spinner de la sesión B si se dispararon casi al mismo tiempo — hallazgo
  de `code-review` sobre el fix original).
- **`StatementImportScreen`**: el estado `progress` que se calculaba y nunca
  se leía se eliminó. En su lugar, la query de `["statement-imports", userId]`
  ahora usa `refetchInterval` (3s) mientras haya algún import en
  `pending`/`processing`, así que la barra de progreso *ya existente* por
  card (`total_records_created`/`total_records_parsed`) se actualiza sola sin
  que el usuario tenga que hacer pull-to-refresh. No se agregó ningún
  endpoint nuevo — se reutilizó `getStatementImports` (ya paginado) en vez de
  pollear `getStatementImport(id)` uno por uno.
  - `key={index}` → se cambió a un `pickId` sintético generado al seleccionar
    cada archivo (no `file.uri`): `code-review` señaló que dos selecciones
    del mismo documento pueden compartir `uri` si el picker reutiliza la
    copia en caché, lo que rompería el mismo problema de key inestable que
    se quería arreglar.
- **Barras de progreso animadas** (`ObjectiveDetailScreen.tsx` y
  `app/(tabs)/objectives.tsx`, componente `ProgressBar` local a cada
  archivo — no se extrajo a `src/components/ui` en esta ronda para mantener
  el diff contenido): el ancho ahora anima con `withTiming` (500ms,
  `EASE_STANDARD`) en vez de saltar instantáneamente, respetando
  `useReducedMotion`.

## Diferido a propósito (no tocado en esta ronda)

- **H2.1 — Las queries de lista (transacciones/objetivos/cuentas/empresas)
  online nunca escriben su resultado completo en SQLite**, solo lo hacen los
  registros creados/editados desde este dispositivo vía
  `useOfflineMutations`. Es un cambio de arquitectura más grande (decidir en
  qué punto exacto enganchar el volcado — `queryFn` vs `onSuccess` de
  `useOfflineQuery` — y qué tablas priorizar) que amerita su propia ronda.
  Mientras tanto: si el usuario ve la app en línea y luego la reabre sin
  conexión tras haber sido cerrada (caché de React Query en memoria perdida),
  el fallback offline de transacciones/objetivos/cuentas puede mostrar solo
  lo creado desde ese dispositivo, no el historial completo del servidor.
- **H2.5 — `EmpresasScreen` no usa `useOfflineMutations`** (llama
  `empresasApi.*` directo para crear/editar/borrar), a diferencia del atajo
  de "+ Nueva empresa" en `transactions.tsx` que sí es offline-safe. Requiere
  agregar `updateCompany`/`deleteCompany` a `useOfflineMutations` (hoy solo
  tiene `createCompany`) antes de poder migrar la pantalla — se deja para
  otra ronda.

No se tocó `useOfflineMutations.ts` (el catch silencioso que puede enmascarar
errores 4xx de validación como "modo offline", hallazgo H2.6 de la
auditoría) ni la falta de flujo offline-first en la creación de
categoría/subcategoría desde `transactions.tsx`/`CategoriesScreen.tsx`
(H2.4) — no estaban en la lista de quick wins aprobados.
