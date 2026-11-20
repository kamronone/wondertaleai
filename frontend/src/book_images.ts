/**
 * Book artwork references are either bundled public assets, local demo SVGs,
 * or API-owned relative paths. Never treat arbitrary URL schemes as artwork.
 */
export function resolveBookImage(url: string, apiOrigin: string): string {
  const fallback = "/images/wondertale-hero.webp";
  if (!url) return fallback;
  if (/^\/images\/[a-z0-9/_-]+\.(?:svg|webp|png|jpe?g)$/i.test(url)) return url;
  if (url.startsWith("data:image/svg+xml;charset=utf-8,") && url.length <= 40000) return url;
  if (/^\/(?:api\/)?(?:books\/)?(?:media\/)[a-zA-Z0-9/_-]+(?:\.(?:svg|webp|png|jpe?g))?$/.test(url) && apiOrigin.startsWith("https://"))
    return apiOrigin.replace(/\/$/, "") + url;
  return fallback;
}
