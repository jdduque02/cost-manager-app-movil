---
name: transaction-form-parity-decisions
description: Decisiones de UX/alcance al llevar el flujo de creación de transacciones de la web (TransactionDialog.tsx) al móvil.
metadata:
  type: project
---

# Paridad web→móvil del formulario de transacciones

Contexto: se llevó el flujo de creación de transacciones de
`cost-manager-web` (`TransactionDialog.tsx` + `TransferDialog.tsx`) al móvil
(`app/(tabs)/transactions.tsx`). Decisiones tomadas que no son obvias desde
el código:

## UX: secciones apiladas, no un modal denso ni un wizard

La web usa un modal único con muchas secciones visibles a la vez. En móvil
se mantuvo el mismo patrón de bottom sheet ya existente (secciones
apiladas dentro de un `ScrollView`, no colapsables) en vez de un wizard
multi-paso — la pantalla ya tenía ese patrón para categoría/subcategoría y
agregar más pasos habría sido inconsistente. Si el formulario crece más,
considerar colapsar "Transacción fija" y "Patrimonio asociado" en
`RevealSection` (ya existe ese primitivo) antes de agregar un wizard.

## Transferencias: modelo y pantalla separados

Igual que en la web, una transferencia NO es una transacción con
`type: "transfer"` — es un modelo y endpoint distintos (`POST
/users/{id}/transfers`, ver `src/api/transfers.api.ts` y
`src/types/transfer.types.ts`). Se implementó como un modal separado
(`src/components/transactions/TransferModal.tsx`) accesible desde un botón
"Transferir" junto a "Nueva" en el header. **No tiene soporte offline**:
si `isOnline` es falso, se bloquea con un `Alert` (mismo patrón que el
borrado de transacciones) — no hay tabla local ni cola de
`pending_operations` para transferencias, se dejó fuera del alcance porque
no es visualmente central al producto y añadir su propia sincronización
duplicaba buena parte de la lógica de `sync.service.ts` para un flujo
secundario.

## Patrimonio asociado (cuenta/activo/pasivo): sin agrupar por tipo de cuenta

La web agrupa las cuentas bancarias por tipo (ahorros/corriente/otro) en el
selector. En móvil se simplificó a una lista plana de chips por cuenta
(nombre del banco + últimos 4 dígitos) dentro de un sub-tab
Cuenta/Activo/Pasivo (`SegmentedControl`) — la cantidad típica de cuentas
por usuario es baja y agrupar habría agregado una jerarquía visual que no
se justifica en una pantalla táctil pequeña.

## Activos y pasivos: caché offline de solo lectura, sin creación inline

`financial_assets` y `financial_liabilities` se cachean en SQLite
(read-only) para que el selector de "patrimonio asociado" funcione sin
conexión, pero a diferencia de categoría/subcategoría/meta/empresa **no
tienen creación inline "al vuelo" desde el formulario de transacciones**
todavía — se dejó fuera del alcance de esta ronda porque el formulario de
creación de activos/pasivos en sí (tipos, rendimiento, tasa de interés) es
más grande que el resto de los "crear al vuelo" y no estaba pedido
explícitamente como prioridad. Si se agrega, seguir el mismo patrón de
`createLocalCompany`/`createCompany` en `useOfflineMutations`.

## Empresas: primera vez que se cachean en SQLite desde móvil

Antes de esta ronda, `empresas.api.ts` no cacheaba nada localmente. Se
agregó una tabla `companies` (solo CREATE offline, sin editar/borrar desde
móvil todavía) siguiendo el mismo patrón que `bank_accounts` y
`financial_objectives` — es la única entidad nueva de este cambio que
quedó con soporte de creación offline completo (cola de
`pending_operations`, colapso de CREATE pendiente, etc.).

## Duplicar/clonar: mini-formulario de 3 campos, no el formulario completo

La web reutiliza un mini-modal con fecha/monto/descripción/categoría/
empresa antes de clonar. En móvil (`CloneTransactionModal.tsx`) se dejó
solo fecha/monto/descripción — son los campos que más se ajustan al
duplicar un gasto recurrente (ej. "el mismo café pero de hoy"), y agregar
categoría/empresa ahí habría requerido repetir los selectores completos en
un modal secundario. **Duplicar requiere conexión** (llama directo a
`POST .../transactions/{id}/clone`): no tiene sentido offline porque
depende de un id de servidor ya existente.

## Migración de esquema SQLite: ALTER TABLE, no un archivo nuevo

Cuando se agregaron las columnas nuevas a `transactions` (payment_method,
is_fixed + subcampos, installments, objective_id, company_id, asset_id,
liability_id), la migración v1→v2 anterior de este repo había resuelto un
cambio de esquema simplemente renombrando el archivo `.db` (base limpia).
Para esta ronda se decidió **no** repetir ese patrón: un usuario puede
tener transacciones offline sin sincronizar en `pending_operations`, y
renombrar el archivo las habría perdido silenciosamente. En su lugar,
`migrateTransactionsTable` en `src/database/database.service.ts` usa
`PRAGMA table_info` + `ALTER TABLE ADD COLUMN` de forma idempotente. Si se
necesita otro cambio de esquema en `transactions` a futuro, seguir este
patrón (ALTER incremental) en vez de bumpear el nombre del archivo.
