# Constitución — Sprig-movil

Principios no negociables de este repo (SDD, ADR-020 del brain). Cada línea ≤200 caracteres.

1. Solo pnpm (con el override de react-native-svg).
2. Offline-first: toda pantalla de datos funciona sin conexión con caché SQLite y cola pending_operations.
3. Toda respuesta del backend pasa por unwrapEnvelope/unwrapList; nunca se asume arreglo desnudo.
4. El refresh token vive en expo-secure-store.
5. Paridad de tokens: global.css ↔ src/theme/palette.ts ↔ Sprig-web/src/styles.css, con test en palette.parity.test.ts.
6. Iconos solo por subpath profundo desde src/components/ui/icons.ts.
7. Gráficas solo con react-native-gifted-charts vía src/components/charts.
8. Gate de cierre en verde: pnpm type-check && pnpm lint && pnpm test.
9. security-review antes de cerrar cambios en auth, SecureStore o el interceptor de refresh.
10. Cierre: ponytail-review → code-review; en lógica offline-first ponytail solo advierte (ADR-007).
