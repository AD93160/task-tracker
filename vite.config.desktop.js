import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plugin qui nettoie le HTML généré pour la compatibilité Electron (file:// protocol)
function electronHtmlFix() {
  return {
    name: "electron-html-fix",
    transformIndexHtml(html) {
      return html
        // Supprime crossorigin sur les scripts modules (bloque le chargement depuis file://)
        .replace(/<script type="module" crossorigin/g, '<script type="module"')
        // Supprime le script AdSense (inutile en desktop, peut bloquer le rendu)
        .replace(/<script[^>]*pagead2\.googlesyndication\.com[^>]*><\/script>/g, "");
    },
  };
}

export default defineConfig({
  plugins: [react(), electronHtmlFix()],
  base: "./",
});
