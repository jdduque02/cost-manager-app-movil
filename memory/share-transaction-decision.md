---
name: share-transaction-decision
description: Por qué Sprig registra transacciones desde notificaciones bancarias vía "compartir manualmente" (share intent) en vez de leer SMS en background, y las convenciones de esa feature.
metadata:
  type: project
---

# Registro de transacciones desde notificaciones bancarias

## Decisión de arquitectura (no reabrir sin que el usuario lo pida explícitamente)

Se descartó **interceptar SMS en background** para detectar pagos/transferencias
de bancos colombianos. Motivos:

- **iOS**: no existe ninguna API pública para leer contenido de SMS entrantes.
- **Android**: los permisos `RECEIVE_SMS`/`READ_SMS` están prohibidos por la
  política de Google Play salvo que la app sea el manejador de SMS/teléfono
  por defecto del dispositivo. Solicitarlos arriesga rechazo o baneo de Sprig
  en Play Store.

El enfoque elegido, y el único que debe implementarse, es **"compartir
manualmente"**: el usuario comparte el texto del mensaje bancario desde su
app nativa de SMS/notificaciones (share sheet del sistema) hacia Sprig.
Sprig recibe el texto, lo parsea y muestra una pantalla de confirmación
prellenada (nunca guarda automáticamente sin que el usuario revise/edite).

No propongas de nuevo interceptar SMS/notificaciones en background para esta
feature — ya se evaluó y se descartó por las razones anteriores.

## Piezas de la implementación (referencia rápida, no repetir análisis)

- Librería: `expo-share-intent` (config plugin, compatible con Expo SDK 57 —
  ver tabla de versiones soportadas en su README: SDK 57 → 8.0+). Requiere
  dev client (no funciona en Expo Go) y `expo-linking` (ya estaba instalado).
- Config plugin en `app.config.ts`: `androidIntentFilters: ["text/*"]` +
  `iosActivationRules: { NSExtensionActivationSupportsText: true }` — solo
  texto plano, no se habilitó compartir imágenes/archivos.
- Integración: `ShareIntentProvider` envuelve todo `RootLayout` en
  `app/_layout.tsx`; `useShareIntentContext()` dentro de `RootLayoutInner`
  navega a `/shared-transaction` (`app/shared-transaction.tsx`, presentación
  modal) cuando `hasShareIntent && shareIntent.text` y hay sesión activa.
- Parser: `src/utils/bank-message-parser.ts` (`parseBankMessage`). Cubre
  Bancolombia y Nequi con reglas propias; otros bancos (Daviplata, Davivienda,
  Banco de Bogotá, BBVA) solo tienen detección de banco por nombre —
  reutilizan el parser genérico de comercio/beneficiario como mejor esfuerzo,
  no tienen reglas dedicadas todavía. Siempre tolerante a texto desconocido:
  nunca lanza, cae a `bank: "unknown"` con campos `null` para que el usuario
  complete el formulario a mano.
- Pantalla de confirmación: `src/screens/ShareTransactionConfirmScreen.tsx`,
  guarda vía `useOfflineMutations().createTransaction` (mismo flujo
  offline-first que el resto de la app, nunca un fetch directo).
- Constantes de tipo de transacción (`TYPE_LABELS`, `TYPE_ICON`, etc.) se
  extrajeron a `src/utils/transaction-labels.ts` para compartirlas entre
  `app/(tabs)/transactions.tsx` y esta pantalla — si agregas una pantalla más
  que cree/edite transacciones, reusa ese módulo en vez de duplicar de nuevo.
