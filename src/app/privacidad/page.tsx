import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacidad y términos · Plan Financiero",
}

/*
 * ⚠️ PLANTILLA. Antes de publicar:
 *   1. Reemplazá todo lo que está [entre corchetes].
 *   2. Hacela revisar por un profesional: es orientativa, no asesoramiento legal.
 *   3. Si vas a tener usuarios en Argentina, evaluá la inscripción de la base de
 *      datos ante la AAIP (Ley 25.326).
 */
const RESPONSABLE = "[Nombre y apellido o razón social]"
const CONTACTO = "[email de contacto]"
const ACTUALIZADO = "[fecha de última actualización]"

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground underline underline-offset-3 hover:text-foreground">
        ← Volver
      </Link>

      <article className="mt-6 space-y-6 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Privacidad y términos de uso</h1>
          <p className="text-muted-foreground">Última actualización: {ACTUALIZADO}</p>
        </header>

        <h2>1. Quién es responsable de tus datos</h2>
        <p>
          {RESPONSABLE} es responsable de la base de datos de Plan Financiero. Podés escribir a {CONTACTO} por cualquier
          consulta sobre tus datos.
        </p>

        <h2>2. Qué datos guardamos</h2>
        <ul>
          <li>Tu email y una contraseña cifrada (nunca vemos tu contraseña).</li>
          <li>
            La información financiera que vos cargás: movimientos, gastos e ingresos fijos, límites por categoría y metas de
            ahorro.
          </li>
        </ul>
        <p>No pedimos ni guardamos datos bancarios, números de tarjeta ni documentos de identidad.</p>

        <h2>3. Para qué los usamos</h2>
        <p>
          Solo para prestarte el servicio: mostrarte tu plan y sincronizarlo entre tus dispositivos. No vendemos ni
          compartimos tus datos con terceros con fines comerciales, ni los usamos para publicidad.
        </p>

        <h2>4. Dónde se guardan</h2>
        <p>
          En servidores de Supabase (base de datos y autenticación) en la región [región de tu proyecto, ej. São Paulo,
          Brasil], y el sitio se sirve desde Vercel. Ambos proveedores actúan como encargados del tratamiento. La conexión
          siempre viaja cifrada (HTTPS) y cada cuenta solo puede acceder a sus propios datos.
        </p>

        <h2>5. Tus derechos</h2>
        <ul>
          <li>
            <strong>Acceso y portabilidad:</strong> desde el menú de tu cuenta podés descargar todos tus datos (“Exportar mis
            datos”).
          </li>
          <li>
            <strong>Rectificación:</strong> podés editar cualquier dato desde la aplicación.
          </li>
          <li>
            <strong>Supresión:</strong> desde el menú de tu cuenta podés eliminar tu cuenta y todos tus datos de forma
            permanente (“Eliminar mi cuenta”).
          </li>
        </ul>
        <p>
          Conforme a la Ley 25.326 de Protección de Datos Personales, la Agencia de Acceso a la Información Pública (AAIP),
          en su carácter de órgano de control, atiende denuncias y reclamos por incumplimiento de la normativa.
        </p>

        <h2>6. Almacenamiento en tu navegador</h2>
        <p>
          Usamos el almacenamiento local del navegador solo para mantener tu sesión iniciada y tu preferencia de tema. No
          usamos cookies de seguimiento ni de publicidad.
        </p>

        <h2>7. Términos de uso</h2>
        <ul>
          <li>Plan Financiero es una herramienta de organización personal; no brinda asesoramiento financiero.</li>
          <li>El servicio se ofrece “tal cual”. Recomendamos exportar tus datos periódicamente como respaldo.</li>
          <li>Sos responsable de mantener segura tu contraseña.</li>
          <li>Podemos actualizar estos términos; los cambios relevantes se informarán en la aplicación.</li>
        </ul>
      </article>
    </main>
  )
}
