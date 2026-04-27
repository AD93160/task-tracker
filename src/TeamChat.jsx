import { useState, useEffect, useRef } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const ClipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

function fmtTime(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(ts) {
  if (!ts?.toDate) return null;
  return ts.toDate().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

function renderText(text) {
  if (!text) return null;
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a
        key={match.index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline", opacity: 0.85 }}
        onClick={e => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function TeamChat({ team, user, theme, isMobile }) {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState("");
  const [unread, setUnread]       = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const bottomRef   = useRef(null);
  const fileRef     = useRef(null);
  const lastReadRef = useRef(parseInt(localStorage.getItem(`tt_chat_lastRead_${team?.id}`) || "0"));
  const wasOpenRef  = useRef(false);

  useEffect(() => {
    if (!team?.id) return;
    const q = query(
      collection(db, "teams", team.id, "messages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      if (!wasOpenRef.current) {
        const count = msgs.filter(m =>
          m.authorUid !== user.uid &&
          (m.createdAt?.toMillis?.() ?? 0) > lastReadRef.current
        ).length;
        setUnread(count);
      }
    });
    return unsub;
  }, [team?.id]);

  useEffect(() => {
    wasOpenRef.current = open;
    if (open) {
      const now = Date.now();
      lastReadRef.current = now;
      localStorage.setItem(`tt_chat_lastRead_${team?.id}`, now);
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = async () => {
    if (!text.trim() || !team?.id || !user) return;
    const msg = text.trim();
    setText("");
    try {
      await addDoc(collection(db, "teams", team.id, "messages"), {
        text: msg,
        authorUid: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Anonyme",
        authorEmail: user.email || "",
        createdAt: serverTimestamp(),
      });
    } catch(e) { console.error("TeamChat send error:", e); }
  };

  const CHAT_ALLOWED_TYPES = ["image/","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","message/rfc822","application/vnd.ms-outlook"];
  const CHAT_MAX_SIZE = 10 * 1024 * 1024;

  const sendFile = async (file) => {
    if (!file || !team?.id || !user) return;
    if (file.size > CHAT_MAX_SIZE) {
      setUploadError("Fichier trop volumineux (max 10 Mo).");
      setTimeout(() => setUploadError(null), 6000);
      return;
    }
    if (!CHAT_ALLOWED_TYPES.some(t => file.type.startsWith(t))) {
      setUploadError("Type de fichier non supporté. Formats acceptés : image, PDF, Word, Excel, mail.");
      setTimeout(() => setUploadError(null), 6000);
      return;
    }
    setUploading(true);
    try {
      const path = `teams/${team.id}/chat/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await addDoc(collection(db, "teams", team.id, "messages"), {
        text: " ",
        authorUid: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Anonyme",
        authorEmail: user.email || "",
        createdAt: serverTimestamp(),
        attachment: {
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          storagePath: path,
        },
      });
    } catch(e) {
      console.error("TeamChat upload error:", e);
      setUploadError(e.message || "Erreur upload");
      setTimeout(() => setUploadError(null), 6000);
    }
    finally { setUploading(false); }
  };

  const AD_H  = 56;
  // FAB container: bottom=64, Ajouter≈46px + gap 8px + micro 44px = 98px → top at 162px
  const FAB_H = 172;

  const btnBottom = isMobile ? 64 : AD_H + 24;
  const btnLeft   = isMobile ? 16 : undefined;
  const btnRight  = isMobile ? undefined : 20;

  const panelW      = isMobile ? "100%" : 340;
  const panelTop    = isMobile ? 104 : 76;
  const panelBottom = isMobile ? FAB_H : AD_H + 86;
  const panelRight  = isMobile ? 0 : 20;
  const panelRadius = isMobile ? "20px 20px 0 0" : 16;

  return (
    <>
      {/* Bouton flottant — masqué sur mobile quand le panneau est ouvert */}
      {(!isMobile || !open) && (
        <button
          onClick={() => setOpen(s => !s)}
          style={{
            position: "fixed",
            bottom: btnBottom,
            left: btnLeft,
            right: btnRight,
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: open ? theme.accent + "cc" : theme.accent,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 20px ${theme.accent}66`,
            zIndex: 148,
            transition: "background .2s",
          }}
          title="Messagerie équipe"
        >
          <ChatIcon />
          {unread > 0 && !open && (
            <div style={{
              position: "absolute",
              top: -2, right: -2,
              background: "#cc3030",
              color: "#fff",
              borderRadius: "50%",
              minWidth: 17, height: 17,
              fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 3px",
            }}>
              {unread > 99 ? "99+" : unread}
            </div>
          )}
        </button>
      )}

      {/* Panneau de chat */}
      {open && (
        <>
          {isMobile && <div style={{ position:"fixed",inset:0,zIndex:146,background:"#00000044" }} onClick={() => setOpen(false)} />}
          <div style={{
            position: "fixed",
            top: panelTop,
            bottom: panelBottom,
            right: panelRight,
            left: isMobile ? 0 : undefined,
            width: panelW,
            background: theme.bgCard,
            border: `1px solid ${theme.accent}44`,
            borderRadius: panelRadius,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 40px #00000088",
            zIndex: 147,
            overflow: "hidden",
          }}>

            {/* Header */}
            <div style={{
              padding: "11px 14px",
              borderBottom: `1px solid ${theme.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6bcb77", boxShadow: "0 0 6px #6bcb7788" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: theme.text, letterSpacing: 1.5 }}>
                  {team.name.toUpperCase()}
                </span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:"transparent",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:16,lineHeight:1,padding:0 }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 10px 4px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}>
              {messages.length === 0 && (
                <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:theme.textMuted,fontSize:11,textAlign:"center",padding:20 }}>
                  Démarrez la conversation ! 👋
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.authorUid === user.uid;
                const prev = messages[i - 1];
                const next = messages[i + 1];
                const sameAuthorPrev = prev?.authorUid === msg.authorUid;
                const sameAuthorNext = next?.authorUid === msg.authorUid;

                const msgDay  = fmtDay(msg.createdAt);
                const prevDay = prev ? fmtDay(prev.createdAt) : null;
                const showDay = msgDay && msgDay !== prevDay;

                const borderRadius = isMe
                  ? `14px 14px ${sameAuthorNext ? "4px" : "14px"} 14px`
                  : `14px 14px 14px ${sameAuthorNext ? "4px" : "14px"}`;

                const att = msg.attachment;
                const isImage = att?.type?.startsWith("image/");

                return (
                  <div key={msg.id}>
                    {showDay && (
                      <div style={{ textAlign:"center",margin:"10px 0 6px",fontSize:9,color:theme.textMuted,letterSpacing:0.5 }}>
                        {msgDay}
                      </div>
                    )}
                    {!isMe && !sameAuthorPrev && (
                      <div style={{ fontSize:9,color:theme.textMuted,marginBottom:2,paddingLeft:4,marginTop:4 }}>
                        {msg.authorName}
                      </div>
                    )}
                    <div style={{ display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",marginBottom:sameAuthorNext?1:6 }}>
                      <div style={{ display:"flex",alignItems:"flex-end",gap:5,flexDirection:isMe?"row-reverse":"row" }}>

                        {att ? (
                          isImage ? (
                            <div style={{
                              maxWidth: "78%",
                              borderRadius,
                              overflow: "hidden",
                              background: isMe ? theme.accent : (theme.mode==="dark" ? "#1e1e3a" : "#ececf4"),
                            }}>
                              <img
                                src={att.url}
                                alt={att.name}
                                style={{ display:"block", maxWidth:"100%", maxHeight:200, objectFit:"cover", cursor:"pointer" }}
                                onClick={() => window.open(att.url, "_blank", "noopener,noreferrer")}
                              />
                            </div>
                          ) : (
                            <div style={{
                              maxWidth: "78%",
                              padding: "8px 11px",
                              borderRadius,
                              background: isMe ? theme.accent : (theme.mode==="dark" ? "#1e1e3a" : "#ececf4"),
                              color: isMe ? "#fff" : theme.text,
                              fontSize: 11,
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: 3, wordBreak:"break-all" }}>{att.name}</div>
                              {att.size > 0 && <div style={{ opacity: 0.7, fontSize: 10, marginBottom: 6 }}>{fmtSize(att.size)}</div>}
                              <div style={{ display:"flex", gap: 10 }}>
                                <a
                                  href={att.url}
                                  download={att.name}
                                  style={{ fontSize:10, color: isMe ? "#ffffffcc" : theme.accent, textDecoration:"underline" }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  Télécharger
                                </a>
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize:10, color: isMe ? "#ffffffcc" : theme.accent, textDecoration:"underline" }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  Ouvrir
                                </a>
                              </div>
                            </div>
                          )
                        ) : (
                          <div style={{
                            maxWidth: "78%",
                            width: "fit-content",
                            padding: "7px 11px",
                            borderRadius,
                            background: isMe ? theme.accent : (theme.mode==="dark" ? "#1e1e3a" : "#ececf4"),
                            color: isMe ? "#fff" : theme.text,
                            fontSize: 12,
                            lineHeight: 1.45,
                            wordBreak: "break-word",
                            userSelect: "text",
                            WebkitUserSelect: "text",
                          }}>
                            {renderText(msg.text)}
                          </div>
                        )}

                        {!sameAuthorNext && (
                          <span style={{ fontSize:8,color:theme.textMuted,flexShrink:0,marginBottom:1 }}>
                            {fmtTime(msg.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Erreur upload */}
            {uploadError && (
              <div style={{ padding:"6px 12px", background:"#2a0a0a", borderTop:`1px solid #cc303066`, color:"#ff8080", fontSize:10, flexShrink:0 }}>
                ⚠️ {uploadError}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: "8px 10px",
              borderTop: `1px solid ${theme.border}`,
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexShrink: 0,
            }}>
              <label
                style={{
                  cursor: uploading ? "default" : "pointer",
                  color: uploading ? theme.border : theme.textMuted,
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  opacity: uploading ? 0.5 : 1,
                  transition: "color .2s, opacity .2s",
                }}
                title="Joindre un fichier"
              >
                <ClipIcon />
                <input
                  ref={fileRef}
                  type="file"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) sendFile(f);
                    e.target.value = "";
                  }}
                />
              </label>

              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                placeholder={uploading ? "Envoi en cours…" : "Message..."}
                disabled={uploading}
                autoComplete="off"
                style={{
                  flex: 1,
                  background: theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 20,
                  padding: "8px 14px",
                  color: theme.text,
                  fontSize: 12,
                  outline: "none",
                  userSelect: "text",
                  WebkitUserSelect: "text",
                  opacity: uploading ? 0.6 : 1,
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim() || uploading}
                style={{
                  background: text.trim() && !uploading ? theme.accent : theme.border,
                  border: "none",
                  borderRadius: "50%",
                  width: 34, height: 34,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: text.trim() && !uploading ? "pointer" : "default",
                  flexShrink: 0,
                  transition: "background .2s",
                }}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
