# Memoria persistente — cost-manager-app-movil

Índice de decisiones de producto/UX no derivables directamente del código.
Antes de tocar una pantalla o sistema listado aquí, revisa el archivo
correspondiente en `memory/`.

- [`memory/animations-ux-decisions.md`](memory/animations-ux-decisions.md) —
  decisiones de la ronda de animaciones (tab bar, chips/segmented control,
  cross-fade Lista/Calendario, inputs numéricos) y una nota técnica sobre
  cómo testear componentes que usan `react-native-reanimated` en este repo.
- [`memory/share-transaction-decision.md`](memory/share-transaction-decision.md) —
  por qué el registro de transacciones desde notificaciones bancarias usa
  "compartir manualmente" (share intent) en vez de leer SMS en background,
  y las piezas de esa implementación (`expo-share-intent`, parser, pantalla).
- [`memory/transaction-form-parity-decisions.md`](memory/transaction-form-parity-decisions.md) —
  decisiones de alcance/UX al llevar el flujo de creación de transacciones
  de la web (método de pago, transacción fija, cuotas, meta/empresa/
  patrimonio asociados, transferencias, duplicar) al móvil, y por qué la
  migración de esquema SQLite de esta ronda usó `ALTER TABLE` en vez de
  renombrar el archivo `.db`.
