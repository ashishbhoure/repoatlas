/**
 * Only same-site relative paths are accepted as post-login destinations, which prevents
 * open redirects through `?next=`. Anything else falls back to "/".
 */
export function safeNextPath(value: string | string[] | undefined | null): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || typeof v !== "string") return "/";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(v)) return "/";
  try {
    const u = new URL(v, "http://repoatlas.invalid");
    if (u.origin !== "http://repoatlas.invalid") return "/";
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return "/";
  }
}
