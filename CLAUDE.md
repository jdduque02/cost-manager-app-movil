# CLAUDE.md — cost-manager-app-movil (Sprig mobile)

Buenas prácticas de este repo (cada línea ≤200 caracteres):

- Usa siempre pnpm (nunca npm/yarn) — el repo usa pnpm-lock.yaml y pnpm-workspace.yaml, con overrides para forzar versión única de react-native-svg.
- Tokens de diseño en dos archivos que deben mantenerse sincronizados: global.css (canales rgb "r g b", no hex) y src/theme/palette.ts (espejo en JS) — hay test de paridad en src/theme/__tests__.
- Reusa los primitivos de src/components/ui antes de crear uno nuevo: Card, Button, Badge, Input, EmptyState, Skeleton, IconTile, ListRow, StatCard, PageHeader, Screen, Money, RevealSection.
- Iconos: lucide-react-native, siempre por subpath profundo desde src/components/ui/icons.ts (`lucide-react-native/icons/<kebab-case>`) — el barrel infla el bundle con ~1500 módulos.
- Fuentes: Space Grotesk (font-display/font-num) y Schibsted Grotesk (font-sans), el peso va en la familia (-Medium/-SemiBold/-Bold) — no combines esas clases con font-medium/semibold/bold.
- Gráficas: react-native-gifted-charts vía src/components/charts (TrendAreaChart, CategoryDonut, CategoryBars) + colores de src/hooks/useChartColors — no agregues otra librería de charts.
- Offline-first: SQLite en src/database + cola pending_operations + hooks useOfflineQuery/useOfflineMutations — toda pantalla de datos debe andar sin conexión con caché local.
- Backend envuelve todo en {status, data, timestamp} y a veces {data:[...], total} anidado; usa unwrapEnvelope/unwrapList de src/api/client.ts en las funciones de la API, nunca asumas arreglo desnudo.
- Verificación antes de reportar terminado: `pnpm exec tsc --noEmit && pnpm exec eslint . && pnpm exec jest` en verde (config real en jest.config.js, no en el campo "jest" de package.json).
- Invoca la skill security-review antes de cerrar cambios en auth, SecureStore, o el interceptor de refresh de tokens en src/api/client.ts.
- Invoca la skill code-review antes de reportar cualquier feature como terminada.
- No uses las skills finance:* (GAAP/SOX) — no aplican a esta app de finanzas personales colombiana.
- Backend local expuesto por túnel (ngrok/Dev Tunnels) para probar en dispositivo físico — la URL cambia cada reinicio: actualiza .env (API_BASE_URL) y reinicia Metro con `--clear`.
- Usa el agente cost-manager-movil-developer (.claude/agents/) como orquestador de este repo: clasifica la tarea y delega en los sub-agentes por capa (.claude/agents/ cost-manager-movil-{ui,charts,data,auth,testing}). Usa memoria persistente (MEMORY.md + memory/) para decisiones de UX/negocio no derivables del código.
- Punto de entrada de Sprig: `sprig-brain-orchestrator` en C:\DLLO\brain-sprig (ADR-003); este repo vive en `brain-sprig\DLLO\Sprig-movil`.
- Los aprendizajes no obvios NO se escriben en el brain desde aquí: el orquestador los entrega en un bloque "Reporte para el brain" y el brain los registra.
- Commits de este repo: sub-agente `sprig-movil-commit-writer`, solo con aprobación explícita del usuario.
