/** Accept same-origin absolute paths only; reject protocol-relative and backslash URLs. */
export function safeInternalRedirect(candidate: string | null | undefined, fallback: string, baseUrl: string): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(candidate, base);
    return resolved.origin === base.origin ? `${resolved.pathname}${resolved.search}${resolved.hash}` : fallback;
  } catch {
    return fallback;
  }
}
