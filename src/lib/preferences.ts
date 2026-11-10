/**
 * Preferencias de UI por dispositivo (no son datos del usuario: no van a la nube).
 * Todo envuelto en try/catch: el almacenamiento puede estar bloqueado.
 */
const PREFIX = "gastos-app:pref:"

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* sin almacenamiento: la preferencia simplemente no se recuerda */
  }
}
