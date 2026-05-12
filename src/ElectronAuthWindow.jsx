import { useEffect, useState } from "react";
import { signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "firebase/auth";
import { auth, provider } from "./firebase";

export default function ElectronAuthWindow() {
  const [status, setStatus] = useState("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const doAuth = async () => {
      try {
        // Vérifie si on revient d'un redirect Google (2e passage)
        const result = await getRedirectResult(auth);
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const idToken = credential?.idToken || null;
          const accessToken = credential?.accessToken || null;
          window.electronAPI.sendAuthToken({ idToken, accessToken });
          setStatus("success");
          return;
        }
        // Pas de résultat → initie le redirect (navigue cette fenêtre vers Google)
        setStatus("redirecting");
        await signInWithRedirect(auth, provider);
      } catch (e) {
        const isCancel =
          e.code === "auth/popup-closed-by-user" ||
          e.code === "auth/cancelled-popup-request";
        window.electronAPI.sendAuthToken({ error: e.code || e.message });
        if (!isCancel) {
          setMsg(e.message);
          setStatus("error");
        }
      }
    };
    doAuth();
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#1a1a2e", color: "#fff",
      flexDirection: "column", fontFamily: "sans-serif", gap: 16,
    }}>
      {(status === "loading" || status === "redirecting") && (
        <>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #333",
            borderTopColor: status === "redirecting" ? "#4285F4" : "#E8630A",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ margin: 0, color: "#aaa", fontSize: 14 }}>
            {status === "redirecting"
              ? "Redirection vers Google…"
              : "Connexion Google en cours…"}
          </p>
        </>
      )}
      {status === "success" && (
        <p style={{ margin: 0, color: "#6bcb77", fontSize: 14 }}>
          Connecté ! Fermeture en cours…
        </p>
      )}
      {status === "error" && (
        <p style={{ margin: 0, color: "#ff6b6b", fontSize: 13, maxWidth: 320, textAlign: "center" }}>
          {msg}
        </p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
