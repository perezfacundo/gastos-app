import { AuthError, isAuthRetryableFetchError } from "@supabase/supabase-js"

/**
 * Traduce los errores de Supabase Auth a mensajes en castellano.
 * Se usa el `code` del error (estable), no el texto en inglés (puede cambiar).
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed: "Tenés que confirmar tu email antes de ingresar. Revisá tu bandeja de entrada (y spam).",
  user_already_exists: "Ya existe una cuenta con ese email.",
  email_exists: "Ya existe una cuenta con ese email.",
  weak_password: "La contraseña es muy débil. Usá al menos 8 caracteres combinando letras y números.",
  same_password: "La nueva contraseña tiene que ser distinta de la anterior.",
  over_email_send_rate_limit: "Se enviaron demasiados emails. Esperá unos minutos y volvé a intentar.",
  over_request_rate_limit: "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
  email_address_invalid: "El email no es válido.",
  signup_disabled: "El registro de nuevas cuentas está deshabilitado.",
  session_not_found: "Tu sesión expiró. Volvé a ingresar.",
}

export function authErrorMessage(error: unknown): string {
  // Fallo de red: Supabase lo envuelve en AuthRetryableFetchError (no es un TypeError).
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return "No pudimos conectarnos. Revisá tu internet e intentá de nuevo."
  }
  if (error instanceof AuthError && error.code && MESSAGES[error.code]) return MESSAGES[error.code]
  return "Ocurrió un error inesperado. Intentá de nuevo."
}
