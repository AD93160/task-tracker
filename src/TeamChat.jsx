import { useState, useEffect, useRef } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit } from "firebase/firestore";
import { db } from "./firebase";

const EyeIcon = () => (
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

export default function TeamChat({ team, user, theme, isMobile }) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText]       = useState("");
  const [unread, setUnread]   = useState(0);
  const bottomRef             = useRef(null);
  const lastReadRef           = useRef(parseInt(localStorage.getItem(`tt_chat_lastRead_${team?.id}`) || "0"));
  const wasOpenRef            = useRef(false);

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

  const btnBottom = isMobile ? 64 : 24;
  const btnLeft   = isMobile ? 16 : undefined;
  const btnRight  = isMobile ? undefined : 20;

  const panelW    = isMobile ? "100%" : 340;
  const panelH    = isMobile ? "70vh" : 460;
  const panelBottom = isMobile ? 0 : 86;
  const panelRight  = isMobile ? 0 : 20;
  const panelRadius = isMobile ? "20px 20px 0 0" : 16;

  return (
    <>
      {/* Bouton flottant */}
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
        <EyeIcon />
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

      {/* Panneau de chat */}
      {open && (
        <>
          {isMobile && <div style={{ position:"fixed",inset:0,zIndex:146,background:"#00000044" }} onClick={() => setOpen(false)} />}
          <div style={{
            position: "fixed",
            bottom: panelBottom,
            right: panelRight,
            left: isMobile ? 0 : undefined,
            width: panelW,
            height: panelH,
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

                // Séparateur de jour
                const msgDay  = fmtDay(msg.createdAt);
                const prevDay = prev ? fmtDay(prev.createdAt) : null;
                const showDay = msgDay && msgDay !== prevDay;

                const borderRadius = isMe
                  ? `14px 14px ${sameAuthorNext ? "4px" : "14px"} 14px`
                  : `14px 14px 14px ${sameAuthorNext ? "4px" : "14px"}`;

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
                        <div style={{
                          maxWidth: "78%",
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
                          {msg.text}
                        </div>
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

            {/* Input */}
            <div style={{
              padding: "8px 10px",
              borderTop: `1px solid ${theme.border}`,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexShrink: 0,
            }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                placeholder="Message..."
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
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim()}
                style={{
                  background: text.trim() ? theme.accent : theme.border,
                  border: "none",
                  borderRadius: "50%",
                  width: 34, height: 34,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: text.trim() ? "pointer" : "default",
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
