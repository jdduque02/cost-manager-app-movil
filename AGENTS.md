# AGENTS.md — Sprig-movil

Cada línea ≤200 caracteres.

## Proyecto

- App móvil de Sprig (finanzas personales colombianas): Expo SDK 57 / React Native 0.86, offline-first con SQLite, NativeWind; consume la API de Sprig.
- Principios no negociables en [docs/constitution.md](docs/constitution.md).

## Comandos

- Gestor: pnpm (hay pnpm-lock.yaml y pnpm-workspace.yaml con override de react-native-svg); nunca npm/yarn.
- `pnpm start`, `pnpm android`, `pnpm ios`, `pnpm web`: servidor de desarrollo Expo.
- `pnpm lint` (eslint), `pnpm type-check` (tsc --noEmit), `pnpm test` (jest), `pnpm test:watch`, `pnpm test:coverage`.
- La config real de Jest está en jest.config.js, no en el campo "jest" de package.json.
- Backend local por túnel (ngrok/Dev Tunnels) en dispositivo físico: la URL cambia en cada reinicio; actualiza API_BASE_URL en .env y reinicia Metro con `--clear`.

## Estilo y convenciones

- TypeScript ^6 estricto.
- Fuentes: Space Grotesk (font-display/font-num) y Schibsted Grotesk (font-sans); el peso va en la familia (-Medium/-SemiBold/-Bold), sin font-medium/semibold/bold.
- Reusa los primitivos de src/components/ui antes de crear uno nuevo: Card, Button, Badge, Input, EmptyState, Skeleton, IconTile, ListRow, StatCard, PageHeader, Screen, Money, RevealSection.
- Tokens de diseño: canales rgb "r g b" (no hex) en global.css, espejo en src/theme/palette.ts y duplicado en Sprig-web/src/styles.css; cambia los tres.
- Un `--chart-N` debe contrastar ≥3:1 contra `--card`/`--background` en light y dark; `--card`/`--surface`/`--muted`/`--border` no son colores de serie.
- Donut con borde de 1 px `--border`, nunca `colors.card`.
- Iconos: lucide-react-native por subpath profundo desde src/components/ui/icons.ts (`lucide-react-native/icons/<kebab-case>`); el barrel infla el bundle con ~1500 módulos.
- Gráficas: react-native-gifted-charts vía src/components/charts (TrendAreaChart, CategoryDonut, CategoryBars) + src/hooks/useChartColors; no agregues otra librería de charts.

## Reglas

- Lee docs/constitution.md y la spec activa en brain-sprig/specs/<feature>/ antes de tocar código.
- Offline-first: SQLite en src/database + cola pending_operations + hooks useOfflineQuery/useOfflineMutations; toda pantalla de datos anda sin conexión con caché local.
- El backend envuelve todo en {status, data, timestamp} y a veces {data:[...], total} anidado; usa unwrapEnvelope/unwrapList de src/api/client.ts, nunca asumas arreglo desnudo.

## Al terminar

- `pnpm type-check && pnpm lint && pnpm test` en verde.
- Suites offline en verde: src/database/__tests__, useOfflineQuery y useOfflineMutations en src/hooks/__tests__.
- `ponytail:ponytail-review` y luego `code-review`; en lógica offline-first ponytail solo advierte (ADR-007).
- `security-review` antes de cerrar cambios en auth, SecureStore o el interceptor de refresh en src/api/client.ts.
