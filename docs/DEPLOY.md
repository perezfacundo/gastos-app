# Guía de despliegue: Supabase + Vercel

Esta guía lleva la app de tu máquina a producción. Hay pasos que solo podés hacer
vos (crear cuentas, configurar paneles); están marcados con 👤.

```
Navegador ──HTTPS──► Vercel (sirve la app Next.js, páginas estáticas)
    │
    └──HTTPS──► Supabase
                 ├─ Auth: registro, login, emails
                 └─ Postgres + RLS: cada usuario solo ve sus filas
```

> **Idea clave:** el navegador habla directo con Supabase usando una clave
> *pública*. Lo que protege los datos no es esconder esa clave, sino las
> políticas **RLS** de la migración: la base rechaza cualquier consulta sobre
> filas que no sean del usuario logueado.

---

## 1. Crear el proyecto de Supabase 👤

1. Entrá a <https://supabase.com>, creá una cuenta y un **New project**.
2. **Región:** `South America (São Paulo)` (la más cercana a Argentina = menos latencia).
3. Guardá la **contraseña de la base** en un gestor de contraseñas (la vas a necesitar para la CLI).

## 2. Crear las tablas (aplicar la migración)

El esquema completo está en `supabase/migrations/`. Dos formas de aplicarlo:

**Opción A — Panel (más simple):** 👤 *SQL Editor → New query*, pegá y ejecutá (*Run*) cada archivo de
`supabase/migrations/` **en orden** (el nombre empieza con la fecha):

1. `20261109120000_esquema_inicial.sql`
2. `20261110120000_fijos_automaticos.sql`

**Opción B — CLI (la forma profesional, repetible):**

```bash
npx supabase login                         # abre el navegador para autorizar
npx supabase link --project-ref <ref>      # <ref> = el id en la URL del proyecto
npx supabase db push                       # aplica las migraciones pendientes
```

Con la opción B, cada cambio futuro de esquema es un archivo nuevo en
`supabase/migrations/` y `db push` aplica solo lo que falta.

**Verificá:** *Table Editor* muestra 5 tablas con el candado de RLS activo, y
*Advisors → Security Advisor* no reporta errores.

## 3. Configurar la autenticación 👤

En *Authentication*:

| Dónde | Qué poner | Por qué |
|---|---|---|
| **URL Configuration → Site URL** | `http://localhost:3000` (por ahora; en el paso 6 la cambiás) | A dónde vuelven los links de los emails |
| **URL Configuration → Redirect URLs** | `http://localhost:3000/**` | Lista blanca de destinos permitidos para los links |
| **Sign In / Providers → Email** | *Confirm email*: activado. *Minimum password length*: `8` | Evita cuentas con emails ajenos; coincide con la validación de la app |

### ⚠️ Trampa 1: el email por defecto de Supabase NO sirve para usuarios reales

El servidor de email incluido **solo envía a direcciones de los miembros de tu
equipo de Supabase** y tiene un límite muy bajo por hora. Un usuario cualquiera
no recibiría el email de confirmación y no podría entrar.

**Solución:** configurá un **SMTP propio** en *Authentication → Emails → SMTP Settings*.
Recomendado: [Resend](https://resend.com) (plan gratuito suficiente para empezar):

1. Creá cuenta en Resend y verificá un dominio propio (te pide agregar registros DNS).
2. Creá una API key.
3. En Supabase SMTP: host `smtp.resend.com`, puerto `465`, usuario `resend`,
   contraseña = la API key, remitente `no-reply@tudominio.com`.

Sin dominio propio podés probar con tu propio email (como miembro del equipo),
pero no lanzar.

### (Opcional) Emails en castellano

*Authentication → Emails → Templates*. Ejemplo para **Confirm signup**:

```html
<h2>Confirmá tu cuenta</h2>
<p>Hacé clic para activar tu cuenta de Plan Financiero:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar mi email</a></p>
<p>Si no creaste una cuenta, ignorá este mensaje.</p>
```

Y para **Reset password**:

```html
<h2>Recuperar contraseña</h2>
<p><a href="{{ .ConfirmationURL }}">Crear una nueva contraseña</a></p>
<p>Si no lo pediste, ignorá este mensaje: tu contraseña no cambia.</p>
```

## 4. Probar en local con tu proyecto real

👤 *Project Settings → API Keys*: copiá la **Publishable key** (`sb_publishable_...`).
*Project Settings → Data API*: copiá la **Project URL**.

```bash
cp .env.example .env.local   # y completá los dos valores
npm run dev
```

Probá: crear cuenta → confirmar desde el email → ingresar → cargar datos de
ejemplo → abrir en otra ventana privada con la misma cuenta (deberías ver lo mismo).

> ❗ Nunca uses la **Secret key** (ex `service_role`) en el frontend ni en una
> variable `NEXT_PUBLIC_*`: saltea RLS y daría acceso a TODOS los datos.

## 5. Publicar en Vercel 👤

1. <https://vercel.com> → *Add New → Project* → importá el repo `gastos-app` de GitHub.
2. Framework: lo detecta solo (Next.js). No cambies los comandos.
3. **Environment Variables** (antes de desplegar):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   Marcalas para *Production*, *Preview* y *Development*.
4. *Deploy*. En ~1 minuto tenés una URL tipo `https://gastos-app-xxxx.vercel.app`.

> Las variables `NEXT_PUBLIC_*` se **incrustan en el build**. Si las cambiás
> después, tenés que hacer *Redeploy* para que tomen efecto.

Desde ahora, cada `git push` a `main` despliega producción, y cada Pull Request
genera una URL de *preview* para probar antes de mergear.

## 6. Conectar Supabase con la URL de producción 👤

De vuelta en Supabase → *Authentication → URL Configuration*:

- **Site URL:** `https://gastos-app-xxxx.vercel.app` (o tu dominio propio).
- **Redirect URLs:** dejá `http://localhost:3000/**` y agregá `https://gastos-app-xxxx.vercel.app/**`.
  Para que funcionen los previews de Vercel: `https://*-<tu-usuario>.vercel.app/**`.

Si te olvidás de este paso, los links de confirmación te llevan a localhost.

### Probar la app instalada (PWA)

El service worker solo se activa en producción, así que esto se prueba con la URL de Vercel:

- **Android (Chrome):** abrí la URL → aparece "Instalar app" (o menú ⋮ → *Instalar*). Mantené apretado el
  ícono: el acceso directo "Nuevo movimiento" abre la carga rápida.
- **iPhone (Safari):** botón Compartir → *Agregar a inicio*.
- **Sin conexión:** con la app abierta una vez, activá modo avión y abrila: tiene que mostrar tus datos y
  dejarte cargar un gasto ("Sin conexión · 1 cambio pendiente"). Al desactivar el modo avión se sincroniza.

Si cambiás `public/sw.js`, subí su `VERSION` para que los dispositivos descarten la caché vieja.

## 7. Checklist antes de invitar gente

- [ ] Completaste la página `/privacidad` (`src/app/privacidad/page.tsx`): todo lo que está [entre corchetes].
- [ ] SMTP propio configurado (trampa 1).
- [ ] Probaste en producción: registro, confirmación, login, recuperar contraseña, exportar datos, eliminar cuenta.
- [ ] Probaste en el celular: instalar, cargar un gasto en modo avión y verlo sincronizar.
- [ ] *Security Advisor* de Supabase sin errores.
- [ ] (Argentina) Evaluaste la inscripción de la base ante la AAIP — Ley 25.326.

### ⚠️ Trampa 2: límites del plan gratuito

- **Supabase Free pausa el proyecto tras 7 días sin actividad.** Para una app con
  usuarios reales, eso significa que un día deja de responder. Con usuarios
  activos no pasa, pero conviene pasar al plan *Pro* cuando haya gente usándola
  (además incluye backups diarios; el gratuito no).
- **Vercel Hobby** es solo para uso **no comercial**. Si cobrás, necesitás *Pro*.

## 8. Cambios futuros en la base de datos

1. Creá un archivo nuevo: `npx supabase migration new nombre_del_cambio`.
2. Escribí el SQL (y su test en `supabase/tests/`).
3. `npm run test:db` → `npx supabase db push`.
4. Regenerá los tipos: `npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts`.

Nunca edites una migración que ya se aplicó en producción: siempre una nueva.
