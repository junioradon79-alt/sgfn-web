// Helpers pour l'app native Capacitor (APK).
//
// En natif, l'app est servie depuis https://localhost par interception native, et
// Capacitor NE résout PAS les URL en dossier : /dashboard/x/ ne renvoie pas
// dashboard/x/index.html, il retombe sur index.html racine (cf. écran blanc résolu
// dans android-webdir.mjs). Les liens sortants doivent donc viser le FICHIER PLAT
// correspondant (/dashboard/x.html), en restant dans la WebView — même origine
// https://localhost, donc **session Supabase conservée**, et le bouton retour
// Android revient à l'app.

/** Vrai dans l'APK Capacitor (le bridge natif injecte `window.Capacitor`). */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : Boolean(cap);
}

/**
 * Convertit une route en fichier plat servi par Capacitor.
 * '/dashboard/saisie/' → '/dashboard/saisie.html' ; '/verifier/' → '/verifier.html'.
 * Conserve la query et le hash. '/' ou vide → '/app.html' (garde-fou).
 */
export function toFlatHtmlPath(path: string): string {
  const cut = path.search(/[?#]/);
  const suffix = cut >= 0 ? path.slice(cut) : "";
  let p = cut >= 0 ? path.slice(0, cut) : path;
  p = p.replace(/\/+$/, ""); // retire la/les barres finales
  if (p === "" || p === "/") return `/app.html${suffix}`;
  return `${p}.html${suffix}`;
}
