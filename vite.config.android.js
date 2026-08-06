import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Build web destiné à la coque Capacitor Android.
 *
 * Deux différences avec le build web :
 *   - `base: "./"` — les assets sont servis depuis le système de fichiers de
 *     la WebView, pas depuis la racine d'un domaine.
 *   - AdSense est retiré. Google interdit AdSense dans les applications
 *     Android ; la régie autorisée est AdMob, via un plugin natif. Laisser le
 *     script en place exposerait à un refus de publication sur le Play Store.
 */
function androidHtmlFix() {
  return {
    name: "android-html-fix",
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script type="module"')
        .replace(/<script[^>]*pagead2\.googlesyndication\.com[^>]*><\/script>/g, "")
        .replace(/<!--[^>]*AdSense[^>]*-->/g, "");
    },
  };
}

export default defineConfig({
  plugins: [react(), androidHtmlFix()],
  base: "./",
});
