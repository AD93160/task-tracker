import { useEffect, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";

export default function ElectronAuthWindow() {
  const [status, setStatus] = useState("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const doAuth = async () => {
      try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        window.electronAPI.sendAuthToken({ idToken });
        setStatus("success");
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
      {status === "loading" && (
        <>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #333", borderTopColor: "#E8630A",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ margin: 0, color: "#aaa", fontSize: 14 }}>
            Connexion Google en cours…
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
