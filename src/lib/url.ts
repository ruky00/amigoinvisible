/** Convierte lo que escribe la gente en un enlace válido, o undefined si no lo es. */
export function normalizeUrl(input: string | undefined): string | undefined {
  const raw = input?.trim()
  if (!raw) return undefined
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (!url.hostname.includes('.')) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

/** Solo deja pasar enlaces http(s) para pintarlos en un <a>. */
export function safeHref(url: string | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined
}
