# Plan Financiero

App de **planificación financiera personal** con cuentas de usuario: definí a dónde va tu dinero *antes*
de gastarlo (presupuestos por categoría, metas de ahorro y gastos/ingresos fijos) y contrastalo con lo real,
sincronizado en todos tus dispositivos.

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Lucide
- **Backend:** Supabase (Postgres + Auth) con Row Level Security
- **Hosting:** Vercel (ver [`docs/DEPLOY.md`](docs/DEPLOY.md))

```bash
npm install
cp .env.example .env.local   # completar con los datos de tu proyecto Supabase
npm run dev                  # http://localhost:3000
npm run check                # tipos + lint + tests unitarios (Vitest) + tests de la base (PGlite)
npm run build
```

## Secciones

| Pestaña | Qué resuelve |
|---|---|
| **Planificación** | Ingresos previstos vs. gastos proyectados, ahorro reservado y **saldo libre**. Flujo previsto (base cero), fijos del mes (pagar/cobrar con un clic) y presupuesto por categoría con alertas. |
| **Límites** | Topes mensuales por categoría, editables en línea, con el promedio de los últimos 3 meses como referencia. |
| **Metas** | Objetivo, fecha límite y aporte mensual. Abonar/retirar fondos y simulador de aporte. |
| **Movimientos** | Registro de lo real, agrupado por día, con filtros y comparación real vs. planificado. |

**Dos módulos que funcionan solos y se complementan** (no hay "modos": la app se adapta a lo que usás):

| Si solo… | Ves | Si sumás el otro |
|---|---|---|
| **anotás gastos** | Cuánto llevás gastado, en qué, y cómo venís contra el mes pasado | Cargando tu ingreso → "cuánto podés gastar por día" con tus gastos reales; con límites → avisos antes de pasarte (sugeridos según tu promedio) |
| **planificás** | Presupuesto diario, a dónde va tu ingreso, fijos que se registran solos | Anotando gastos → el diario se ajusta a la realidad y los límites muestran lo gastado |

Navegación: **Inicio** (combina lo que usás) · **Movimientos** (registro) · **Plan** (ingreso, fijos, límites) · **Metas**.

Pensada para usarse todos los días:

- **Número principal:** "Podés gastar $X por día" (saldo libre ÷ días que quedan, calculado al inicio del día).
- **Carga rápida:** botón `+` flotante en el celular (o tecla `N`), monto primero, categorías a un toque
  ordenadas por uso, descripción opcional con autocompletado del historial, "Hoy / Ayer".
- **Sin conexión:** abre al instante con la copia local; los cambios se guardan en una cola (IndexedDB) y se
  sincronizan solos al volver la red. Instalable como app (PWA).
- **Configuración inicial guiada** (≈2 min): ingreso → fijos típicos → límites sugeridos → plan listo.
- **Fijos automáticos** (débitos automáticos): se registran solos en su fecha; si borrás uno (ese mes no se
  cobró), no se vuelve a crear. Los manuales se confirman con el monto real; si aumentó, se puede actualizar
  el fijo y su límite.
- **Alertas sin ruido:** "cerca del límite" mira el margen para gastos variables (una categoría que es 100%
  alquiler no está "en alerta").

Cuenta: registro con confirmación por email, recuperación de contraseña, exportar datos (JSON), eliminar
cuenta, importar datos de la versión local anterior y datos de ejemplo para explorar.

## Arquitectura

```
UI (componentes) ──► financeActions ──► financeStore ──► reducer (en memoria, optimista)
                                              │
                                              └──► remote.ts ──► Supabase (PostgREST / RPC)
                                                                    └─ RLS: user_id = auth.uid()
```

- **Seguridad en la base, no en el frontend.** El navegador usa una clave pública; las políticas RLS
  (`supabase/migrations/`) garantizan que cada usuario solo lea y escriba sus filas. Probado en
  `supabase/tests/database.test.mjs` (PGlite, sin Docker).
- **Offline-first (patrón outbox):** la UI cambia al instante y cada cambio entra a una cola persistida en
  IndexedDB que se envía en orden. Sin red: queda en la cola y se reintenta (al volver la red, al enfocar la
  pestaña, con backoff). Rechazo del servidor: se descarta y se reconstruye desde el servidor. Todas las
  operaciones son idempotentes (upsert/delete), así que reintentar nunca duplica datos.
- **Stale-while-revalidate:** si hay copia local, la app abre con ella al instante y luego trae lo fresco.
- **Service worker** (`public/sw.js`, solo en producción): red primero para HTML, caché para `/_next/static`.
- **Operaciones atómicas en SQL:** borrar categoría (reasigna + borra), reemplazar todos los datos y
  eliminar la cuenta son funciones de Postgres: o se hace todo, o nada.
- **Cálculos puros** (`calculations.ts`) separados de la UI y del almacenamiento.
- **`useSyncExternalStore`** para sesión y datos: sin desajustes de hidratación; en el servidor el estado
  es `null` y se muestra un esqueleto.

### Cómo se calcula el plan del mes

```
gastos proyectados = gastos reales + fijos aún no registrados
saldo libre        = ingresos previstos − gastos proyectados − ahorro reservado
sin asignar        = ingresos previstos − (gastado + fijos por pagar + presupuesto disponible + ahorro)
```

## Estructura

```
supabase/
├── config.toml                      # Config local de Supabase (CLI)
├── migrations/                      # Esquema versionado: tablas, RLS, funciones
└── tests/database.test.mjs          # Tests de RLS y funciones (npm run test:db)
docs/DEPLOY.md                       # Paso a paso: Supabase + Vercel
src/
├── app/
│   ├── page.tsx                     # App protegida (requiere sesión)
│   ├── login/                       # Ingresar / crear cuenta / recuperar contraseña
│   ├── actualizar-clave/            # Destino del link de recuperación
│   ├── privacidad/                  # Política de privacidad y términos (plantilla)
│   └── layout.tsx · globals.css
├── components/
│   ├── auth/                        # AuthGate, formularios de autenticación
│   ├── finance/                     # Shell, menú de cuenta, bienvenida y vistas por pestaña
│   └── ui/                          # shadcn/ui
├── hooks/                           # useAuth, useFinanceState, useFinanceMeta…
└── lib/
    ├── supabase/                    # Cliente y tipos de la base
    ├── auth/                        # Store de sesión, traducción de errores
    └── finance/
        ├── store.ts                 # Estado + outbox offline + resincronización (store.test.ts)
        ├── offline-cache.ts         # Copia local y cola en IndexedDB
        ├── suggestions.ts           # Ranking de categorías y autocompletado
        ├── onboarding.ts            # Límites sugeridos y plan inicial
        ├── insights.ts              # Perfil de uso y resumen de gastos (sin plan)
        ├── remote.ts                # Mapeo filas ↔ dominio y acción → SQL
        ├── reducer.ts · actions.ts  # Mutaciones tipadas
        ├── calculations.ts          # Motor de planificación (puro)
        ├── legacy.ts                # Importación de la versión local anterior
        └── types.ts · config.ts · format.ts · mock-data.ts
```

La primera versión (HTML único con localStorage) quedó en `legacy/index.html`.
