# Plan Financiero

App de **planificación financiera personal**: definí a dónde va tu dinero *antes* de gastarlo
(presupuestos por categoría, metas de ahorro y gastos/ingresos fijos) y contrastalo con lo real.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · Lucide React
- **Persistencia:** `localStorage` del navegador (sin backend). Carga datos de ejemplo en la primera visita.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de producción (página estática)
```

## Secciones

| Pestaña | Qué resuelve |
|---|---|
| **Planificación** | Ingresos previstos vs. gastos proyectados, ahorro reservado y **saldo libre**. Barra de *flujo previsto* (base cero), fijos del mes (pagar/cobrar con un clic) y presupuesto por categoría con alertas. |
| **Límites** | Topes mensuales por categoría, editables en línea, con el promedio de los últimos 3 meses como referencia (✨ "usar promedio"). Resumen de cuánto del ingreso quedó asignado. |
| **Metas** | Metas con objetivo, fecha límite y aporte mensual. Abonar/retirar fondos y **simulador** (slider) que calcula cuándo llegás y cuánto necesitás aportar. |
| **Movimientos** | Registro de lo real, agrupado por día, con filtros y comparación real vs. planificado. |

## Cómo se calcula el plan del mes

```
gastos proyectados = gastos reales + fijos aún no registrados
saldo libre        = ingresos previstos − gastos proyectados − ahorro reservado
sin asignar        = ingresos previstos − (gastado + fijos por pagar + presupuesto disponible + ahorro)
```

- Un **fijo** (alquiler, sueldo, suscripción) se proyecta automáticamente en el mes actual y los futuros hasta que
  lo registrás; al registrarlo se crea un movimiento vinculado (`recurringId`) y deja de proyectarse.
- **Estados de presupuesto:** `En camino` (< 90 %), `Cerca del límite` (≥ 90 %), `Excedido` (> 100 %).
  Siempre con ícono + texto, nunca solo color. El umbral está en `src/lib/finance/config.ts`.

## Estructura

```
src/
├── app/
│   ├── layout.tsx              # Fuentes, ThemeProvider, TooltipProvider, Toaster
│   ├── page.tsx                # Server Component → <FinanceApp />
│   └── globals.css             # Tokens shadcn + paleta de categorías + colores de estado
├── components/
│   ├── ui/                     # Componentes shadcn/ui (Progress extendido con indicatorClassName)
│   ├── theme-provider.tsx
│   └── finance/
│       ├── finance-app.tsx     # Shell: header, selector de mes, Tabs, esqueleto de carga
│       ├── shared/             # IconChip, StatusBadge, BudgetBar, campos de formulario, StatCard…
│       ├── planning/           # Vista principal: flujo previsto, fijos, presupuestos, alertas
│       ├── budgets/            # Gestor de categorías y límites
│       ├── goals/              # Metas: tarjetas, abonar/retirar, simulador
│       └── transactions/       # Movimientos + diálogo de alta
├── hooks/
│   └── use-finance.ts          # useSyncExternalStore + selectores memoizados
└── lib/finance/                # Dominio (sin React)
    ├── types.ts                # Modelo: Category, Transaction, RecurringItem, SavingsGoal…
    ├── config.ts               # Moneda/locale, umbrales, paleta
    ├── format.ts               # Dinero, porcentajes y fechas locales (YYYY-MM-DD)
    ├── calculations.ts         # Motor de planificación (funciones puras)
    ├── reducer.ts              # Todas las mutaciones (acciones tipadas)
    ├── store.ts                # Store externo + localStorage + sincronización entre pestañas
    ├── actions.ts              # Casos de uso (ids, redondeos, deshacer)
    └── mock-data.ts            # Datos de ejemplo relativos a la fecha actual
```

### Decisiones de arquitectura

- **`useSyncExternalStore` en lugar de `useReducer` + `useEffect`:** el store vive fuera de React y el reducer es
  puro. En el servidor el snapshot es `null`, así que no hay desajustes de hidratación ni lecturas de `localStorage`
  durante el prerender. Los cambios en otra pestaña se sincronizan con el evento `storage`.
- **Cálculos puros y separados de la UI** (`calculations.ts`): se pueden testear sin React y se memoizan en los hooks.
- **Fechas solo en el cliente:** Next 16 no permite leer la hora durante el prerender; por eso el mes actual se
  calcula dentro de `<PlannerApp />`, que solo se monta con el estado ya cargado.
- **Moneda configurable:** `es-AR` / `ARS` en `src/lib/finance/config.ts`.
- **Validación al cargar:** los datos de `localStorage` se sanean; si son ilegibles, se cargan los de ejemplo.

## Datos

El menú 🗄️ del encabezado permite **restaurar los datos de ejemplo** o **empezar de cero**
(conserva las categorías, sin límites). La versión anterior (HTML único) quedó en `legacy/index.html`.
