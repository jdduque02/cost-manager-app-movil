---
name: animations-ux-decisions
description: Decisiones de UX/diseño y una nota técnica de testing tomadas al agregar animaciones al tab bar, chips/segmented control, toggle Lista/Calendario e inputs numéricos de Sprig móvil.
metadata:
  type: project
---

# Animaciones — decisiones de la ronda de sept/2026

## Tab bar (`app/(tabs)/_layout.tsx`)

- Se agregó "pop" de escala sutil en el ícono activo (spring `SPRING_SPRIG`,
  escala 1 → 1.12) y un indicador (pill de 3x28px) que se desliza con
  `translateX` detrás del tab activo (ease-out fuerte, 200ms).
- **Se decidió NO animar la entrada del contenido de cada pantalla** (fade+
  translateY vía `useIsFocused`) al cambiar de tab. Gate de la skill
  `animate`: es una acción "tens de veces/día" — el costo de un fade
  perceptible en cada swipe/tap de tab (por breve que sea) supera el
  beneficio, y arriesga sentirse repetitivo/gimmick en uso diario. Si en el
  futuro se pide esto, no es un olvido: fue una decisión explícita.
- El indicador se implementó como un `Animated.View` overlay posicionado por
  `screenWidth / tabs.length` (vía `useWindowDimensions`), NO reemplazando
  el `tabBar` de `@react-navigation/bottom-tabs` con un render prop custom.
  Motivo técnico: `@react-navigation/bottom-tabs` no es una dependencia
  directa del proyecto (solo transitiva a través de `expo-router`) y pnpm no
  la hoistea a `node_modules/@react-navigation` — importar sus tipos
  (`BottomTabBarProps`) desde código de la app es fràgil bajo esta
  instalación. El overlay evita esa dependencia por completo.

## Chip / SegmentedControl (`src/components/ui/Chip.tsx`, `SegmentedControl.tsx`)

- Se consolidaron los `Pressable` sin feedback de transactions.tsx,
  banking.tsx y objectives.tsx (filtros, selectores de tipo, chips de
  categoría) en un único primitivo `Chip` (press scale + `interpolateColor`
  activo/inactivo) — no crear otro `Pressable` a mano para este patrón.
- El toggle "Lista/Calendario" es el único caso con indicador deslizante
  (`SegmentedControl`) en vez de repintar cada botón, tal como pidió el
  usuario explícitamente para ese par específico.
- Unificación de estilo: los selectores de tipo en los 3 modales ahora usan
  `font-sans-semibold` vía `Chip` en vez de la mezcla previa de
  `font-sans-medium`/`font-sans-semibold` que tenía cada pantalla — cambio
  visual menor, intencional, no un bug.

## Cross-fade Lista/Calendario (`app/(tabs)/transactions.tsx`)

- Implementado como **fade-in de una sola dirección** (opacity 0→1 al
  montar, ease-in-out fuerte, 180ms), NO un cross-fade simétrico de dos
  capas superpuestas. `FlatList` y `ScrollView` son árboles distintos: al
  cambiar `activeTab`, React desmonta uno y monta el otro (no hay
  superposición real). Un cross-fade de dos capas requeriría mantener ambas
  ramas montadas simultáneamente, arriesgando duplicar `refreshControl`/
  scroll — justo lo que se pidió evitar. El fade-in de entrada ya resuelve
  el salto brusco sin ese riesgo.

## CurrencyInput — placeholder de muestra (`src/components/ui/CurrencyInput.tsx`)

- Montos de muestra elegidos: `["150.000", "45.900", "1.200.000"]`
  (constante exportada `SAMPLE_AMOUNTS`) — representan magnitudes típicas de
  gasto/ingreso/objetivo en COP. Si se cambian, mantenerlos en formato es-CO
  sin decimales para no confundir con el propósito real (mostrar el
  separador de miles, no enseñar decimales).
- El prop `placeholder` que le pasaban las pantallas (`placeholder="0"`) ya
  **no se reenvía** al `TextInput` nativo — el overlay de muestra cicla en
  su lugar y se congela/oculta según foco/valor. Si una pantalla nueva le
  pasa `placeholder`, se ignora a propósito (ver comentario en el código).

## Nota técnica: testear componentes con `react-native-reanimated` en este repo

`react-native-reanimated` 4.x delega en `react-native-worklets`, cuyo
binding nativo no existe bajo Jest — importar el paquete real (incluso su
propio `react-native-reanimated/mock`) revienta con
`Cannot read properties of undefined (reading 'loadUnpackers')`. Se agregó
`__mocks__/react-native-reanimated.js` (mock manual de Jest a nivel de
`node_modules`, mismo patrón que `__mocks__/error-guard.js`) — síncrono y
no-reactivo (`withTiming`/`withSpring` resuelven de inmediato,
`useAnimatedStyle` ejecuta el factory una vez por render). Esto es
suficiente para probar el contrato observable de un componente animado
(texto, `accessibilityState`, callbacks) pero **no sirve para asegurar
valores de una animación en curso** — eso se sigue verificando visualmente
(skill `run`/`dataviz` o revisión manual en dispositivo/emulador), no con
Jest. Si se borra este mock pensando que ya no hace falta, cualquier test
que renderice `Button`, `AnimatedListItem`, `Chip`, `SegmentedControl`,
`Input` o `CurrencyInput` va a volver a fallar con el mismo error.
