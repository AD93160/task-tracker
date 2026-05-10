import { createRoot } from "react-dom/client";
import App, { ErrorBoundary } from "./App";
import ElectronAuthWindow from "./ElectronAuthWindow";

// Fenêtre d'auth dédiée Electron — monte un composant minimal au lieu de l'app complète
const isElectronAuthWindow =
  window.electronAPI?.isElectron && window.location.hash === "#electron-auth";

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    {isElectronAuthWindow ? <ElectronAuthWindow /> : <App />}
  </ErrorBoundary>
);
