import { useState, useRef, useEffect, Component } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:20, background:"#1a0a0a", color:"#ff6666", fontFamily:"monospace", minHeight:"100vh" }}>
          <h2 style={{ color:"#ff4444" }}>Erreur — rapport de débogage</h2>
          <pre style={{ whiteSpace:"pre-wrap", fontSize:12 }}>{String(this.state.error)}</pre>
          <pre style={{ whiteSpace:"pre-wrap", fontSize:11, color:"#ff9999" }}>{this.state.error?.stack}</pre>
          <button onClick={()=>this.setState({error:null})} style={{ marginTop:16, padding:"8px 16px", background:"#cc3030", color:"#fff", border:"none", borderRadius:8, cursor:"pointer" }}>
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Remplacer "ca-pub-XXXXXXXXXXXXXXXXX" par ton Publisher ID AdSense
// et "XXXXXXXXXX" par ton Ad Unit ID
const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXXX";
const ADSENSE_SLOT   = "XXXXXXXXXX";

function AdBanner() {
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
  }, []);
  if (ADSENSE_CLIENT.includes("XXXXX")) {
    // Placeholder tant que le compte AdSense n'est pas configuré
    return (
      <div style={{ width:"100%",height:50,display:"flex",alignItems:"center",justifyContent:"center",opacity:0.3 }}>
        <span style={{ fontSize:9,letterSpacing:2,color:"#888" }}>ESPACE PUBLICITAIRE</span>
      </div>
    );
  }
  return (
    <ins className="adsbygoogle"
      style={{ display:"block", width:"100%", height:50 }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-ad-format="horizontal"
      data-full-width-responsive="true" />
  );
}

const PRIORITIES = ["Haute", "Moyenne", "Basse"];
const STATUSES   = ["À faire", "En cours", "Terminé"];
const STATUS_DOT = { "À faire":"#4a4a8a", "En cours":"#40a040", "Terminé":"#a040a0" };
const PRIO_COLOR = { "Haute":"#ff6b6b", "Moyenne":"#ffd93d", "Basse":"#6bcb77" };

const INIT = [];

function MemberStats({ member, teamId, db, theme }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    getDoc(doc(db, "teams", teamId, "memberStats", member.uid)).then(snap => {
      if (!snap.exists()) return;
      setStats(snap.data());
    }).catch(() => {});
  }, [member.uid, teamId]);
  return (
    <div style={{ background:theme.bg, borderRadius:8, padding:"8px 12px", marginBottom:6 }}>
      <div style={{ fontSize:11, color:theme.text, fontWeight:600, marginBottom:4 }}>{member.displayName || member.email}</div>
      {stats ? (
        <div style={{ display:"flex", gap:12, fontSize:10, color:theme.textMuted }}>
          <span>📋 {stats.total} tâches</span>
          <span style={{ color:"#6bcb77" }}>✓ {stats.done} terminées</span>
          <span style={{ color:theme.accent }}>⏳ {stats.active} actives</span>
        </div>
      ) : (
        <div style={{ fontSize:10, color:theme.textMuted }}>Chargement…</div>
      )}
    </div>
  );
}

export default function App() {
  const load = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const [tasks,        setTasks]        = useState(() => load("tt_tasks", INIT));
  const [todayIds,     setTodayIds]     = useState(() => load("tt_todayIds", []));
  const [todayDates,   setTodayDates]   = useState(() => load("tt_todayDates", {}));
  const [tomorrowIds,  setTomorrowIds]  = useState(() => load("tt_tomorrowIds", []));
  const [scheduledIds, setScheduledIds] = useState(() => load("tt_scheduledIds", []));
  const [highlighted,  setHighlighted]  = useState(() => load("tt_highlighted", []));
  const [modal,        setModal]        = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [formStep,     setFormStep]     = useState(1);
  const [pendingTask,  setPendingTask]  = useState(null);
  const [customDate,   setCustomDate]   = useState("");
  const [recurDay,     setRecurDay]     = useState(""); // jour fixe du mois (1-31)
  const [recurMonthDay,setRecurMonthDay]= useState(""); // date fixe année "MM-DD"
  const [editingId,    setEditingId]    = useState(null);
  const [form,         setForm]         = useState({ title:"", priority:"Moyenne", status:"À faire", due:"", notes:"", notify:true, recurrence:"none" });
  const [showTheme,    setShowTheme]    = useState(false);
  const [showStats,    setShowStats]    = useState(false);
  const [ghost,        setGhost]        = useState(null);
  const [dropZone,     setDropZone]     = useState(null);
  const [listening,    setListening]    = useState(false);
  const [voiceError,   setVoiceError]   = useState(null);
  const [user,         setUser]         = useState(null);
  const [syncing,      setSyncing]      = useState(false);
  const [openDrop,     setOpenDrop]     = useState(null); // 'priority' | 'status' | null
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [emailMode,    setEmailMode]    = useState("login"); // "login" | "register"
  const [emailForm,    setEmailForm]    = useState({ email:"", password:"" });
  const [authError,    setAuthError]    = useState(null);
  const [authInfo,     setAuthInfo]     = useState(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [locale,           setLocale]          = useState(() => load("tt_locale", navigator.language || "fr-FR"));
  const [dailyNotifEnabled,setDailyNotifEnabled]= useState(() => load("tt_dailyNotif", true));
  const [dailyNotifTime,   setDailyNotifTime]   = useState(() => load("tt_dailyNotifTime", "08:00"));
  const [showQuickAdd,     setShowQuickAdd]     = useState(false);
  const [quickTitle,       setQuickTitle]       = useState("");
  const [quickPriority,    setQuickPriority]    = useState("Moyenne");
  const [team,             setTeam]             = useState(null);
  const [teamRole,         setTeamRole]         = useState(null);   // "admin"|"member"|null
  const [teamSpace,        setTeamSpace]        = useState(false);  // false=perso true=équipe
  const [showTeam,         setShowTeam]         = useState(false);
  const [teamForm,         setTeamForm]         = useState({ name:"" });
  const [inviteEmail,      setInviteEmail]      = useState("");
  const [pendingInvite,    setPendingInvite]    = useState(null);
  const [teamError,        setTeamError]        = useState(null);
  const [teamInfo,         setTeamInfo]         = useState(null);
  const [pendingTeamTaskId,setPendingTeamTaskId]= useState(null); // Firestore ID tâche équipe en attente de planif
  const [statsView,        setStatsView]        = useState("perso"); // "perso" | "team"
  const [teamTasks,        setTeamTasks]        = useState([]);
  const [teamPending,      setTeamPending]      = useState([]);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [teamModal,        setTeamModal]        = useState(null); // firestoreId tâche ouverte
  const [teamComments,     setTeamComments]     = useState([]);
  const [commentInput,     setCommentInput]     = useState("");
  const checkMobile = () => screen.width <= 768 || window.innerWidth <= 768;
  const [isMobile,     setIsMobile]     = useState(checkMobile);
  const [showDone,     setShowDone]     = useState(false);
  const [sortBy,       setSortBy]       = useState(null);
  const [sortDir,      setSortDir]      = useState("asc");
  const [taskCounter,  setTaskCounter]  = useState(() => load("tt_counter", 0));
  const [recurError,   setRecurError]   = useState(null);

  useEffect(() => {
    const handler = () => setIsMobile(checkMobile());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [theme, setTheme] = useState({
    bg:"#FDF6EC", bgLeft:"#F5EDD8", bgCard:"#FFFFFF",
    accent:"#E8630A", text:"#2C1A0E", textMuted:"#9C7B5A",
    border:"#E8D5B0", font:"Inter", titleFont:"Playfair Display", mode:"light",
  });

  const FONTS = [
    { label:"Inter",       value:"Inter" },
    { label:"DM Mono",     value:"DM Mono" },
    { label:"Space Mono",  value:"Space Mono" },
    { label:"Courier",     value:"Courier New" },
    { label:"Roboto Mono", value:"Roboto Mono" },
  ];
  const TITLE_FONTS = [
    { label:"Playfair Display", value:"Playfair Display" },
    { label:"Cormorant",        value:"Cormorant Garamond" },
    { label:"Syne",             value:"Syne" },
    { label:"Bebas Neue",       value:"Bebas Neue" },
    { label:"Oswald",           value:"Oswald" },
    { label:"Rajdhani",         value:"Rajdhani" },
    { label:"Orbitron",         value:"Orbitron" },
  ];
  const PRESETS = {
    dark: [
      { name:"Nuit",       bg:"#0d0d1a", bgLeft:"#0a0a18", bgCard:"#0f0f22", accent:"#5050dd", text:"#e0e0f0", textMuted:"#444466", border:"#1a1a3a" },
      { name:"Forêt",      bg:"#0a120a", bgLeft:"#081008", bgCard:"#0d180d", accent:"#40a040", text:"#e0f0e0", textMuted:"#2a442a", border:"#1a3a1a" },
      { name:"Braise",     bg:"#1a0d0d", bgLeft:"#180a0a", bgCard:"#220d0d", accent:"#dd5020", text:"#f0e0e0", textMuted:"#442a2a", border:"#3a1a1a" },
      { name:"Océan",      bg:"#0a0d1a", bgLeft:"#080a18", bgCard:"#0d1022", accent:"#2080cc", text:"#e0e8f8", textMuted:"#2a3a55", border:"#1a2a3a" },
      { name:"Encre",      bg:"#111111", bgLeft:"#0a0a0a", bgCard:"#181818", accent:"#888888", text:"#dddddd", textMuted:"#444444", border:"#222222" },
      { name:"Améthyste",  bg:"#120a1a", bgLeft:"#0e0814", bgCard:"#180d22", accent:"#9040cc", text:"#f0e0ff", textMuted:"#3a2a55", border:"#2a1a3a" },
    ],
    light: [
      { name:"Cognac",     bg:"#FDF6EC", bgLeft:"#F5EDD8", bgCard:"#FFFFFF", accent:"#E8630A", text:"#2C1A0E", textMuted:"#9C7B5A", border:"#E8D5B0" },
      { name:"Papier",     bg:"#f8f8f4", bgLeft:"#f0f0ea", bgCard:"#ffffff", accent:"#5050dd", text:"#1a1a2e", textMuted:"#9090a0", border:"#e0e0e8" },
      { name:"Sauge",      bg:"#f4f8f4", bgLeft:"#ebf2eb", bgCard:"#ffffff", accent:"#2a8a2a", text:"#0a1a0a", textMuted:"#7a9a7a", border:"#d0e8d0" },
      { name:"Terracotta", bg:"#faf5f2", bgLeft:"#f5ede8", bgCard:"#ffffff", accent:"#cc4820", text:"#1a0a08", textMuted:"#aa8878", border:"#e8d5cc" },
      { name:"Ciel",       bg:"#f2f6fc", bgLeft:"#e8f0f8", bgCard:"#ffffff", accent:"#1a70cc", text:"#08102a", textMuted:"#6080aa", border:"#ccdaee" },
      { name:"Craie",      bg:"#f8f8f8", bgLeft:"#f0f0f0", bgCard:"#ffffff", accent:"#555555", text:"#111111", textMuted:"#999999", border:"#dddddd" },
      { name:"Lavande",    bg:"#f6f4fc", bgLeft:"#eeebf8", bgCard:"#ffffff", accent:"#7040bb", text:"#180a2a", textMuted:"#9080aa", border:"#ddd0ee" },
    ],
  };

  const dragRef          = useRef({});
  const leftRef          = useRef(null);
  const ghostRef         = useRef(null);
  const recognitionRef   = useRef(null);
  const fromFirestore    = useRef(false);
  const longPressTimer   = useRef(null);
  const tasksRef         = useRef(tasks);
  const todayIdsRef      = useRef(todayIds);
  const sendDailyNotifCb = useRef(null);

  const todayStr = () => new Date().toISOString().split("T")[0];

  const GREEN  = { base:"#2a7a2a", light:"#3aaa3a" };
  const GOLD   = { base:"#8a6a00", light:"#ccaa00" };
  const ORANGE = { base:"#8a4a00", light:"#cc7700" };
  const RED    = { base:"#8a1a1a", light:"#cc3030" };

  const taskColor = (task) => {
    if (!task || task.status === "Terminé") return null;
    const today = todayStr();
    const tom = new Date(); tom.setDate(tom.getDate()+1);
    const tomorrow = tom.toISOString().split("T")[0];
    const inTom = tomorrowIds.map(e => e.id).includes(task.id);
    if (task.due) {
      if (task.due < today) return RED;
      if (task.due === today) return GOLD;
      if (todayIds.includes(task.id)) return GOLD;
      if (task.due === tomorrow || inTom) return ORANGE;
      return GREEN;
    }
    if (inTom) return ORANGE;
    if (todayIds.includes(task.id)) {
      const added = todayDates[task.id];
      return (!added || added === today) ? GOLD : RED;
    }
    return null;
  };

  const exportIcs = (task) => {
    if (!task.due) return;
    const d = task.due.replace(/-/g,"");
    const stamp = new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Task Tracker//FR",
      "BEGIN:VEVENT",
      `UID:${task.id}@tasktracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${d}`,
      `SUMMARY:${task.title}`,
      task.notes ? `DESCRIPTION:${task.notes}` : "",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], {type:"text/calendar"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${task.title.replace(/\s+/g,"-")}.ics`; a.click();
    URL.revokeObjectURL(url);
  };

  const getTask = (id) => tasks.find(t => t.id === id);
  // Numérotation permanente : chaque tâche garde son numéro à vie
  const numMap = (() => {
    const m = {};
    tasks.forEach(t => { m[t.id] = t.num != null ? t.num : "?"; });
    return m;
  })();
  const taskNum = (id) => numMap[id] ?? "?";
  const isHL    = (id) => highlighted.includes(id) && getTask(id)?.status !== "Terminé";

  // Persistance localStorage
  useEffect(() => { localStorage.setItem("tt_tasks",        JSON.stringify(tasks));        }, [tasks]);
  useEffect(() => { localStorage.setItem("tt_todayIds",     JSON.stringify(todayIds));     }, [todayIds]);
  useEffect(() => { localStorage.setItem("tt_todayDates",   JSON.stringify(todayDates));   }, [todayDates]);
  useEffect(() => { localStorage.setItem("tt_tomorrowIds",  JSON.stringify(tomorrowIds));  }, [tomorrowIds]);
  useEffect(() => { localStorage.setItem("tt_scheduledIds", JSON.stringify(scheduledIds)); }, [scheduledIds]);
  useEffect(() => { localStorage.setItem("tt_highlighted",  JSON.stringify(highlighted));  }, [highlighted]);
  useEffect(() => { localStorage.setItem("tt_counter",      JSON.stringify(taskCounter));   }, [taskCounter]);
  useEffect(() => { localStorage.setItem("tt_locale",       JSON.stringify(locale));         }, [locale]);
  useEffect(() => { localStorage.setItem("tt_dailyNotif",   JSON.stringify(dailyNotifEnabled)); }, [dailyNotifEnabled]);
  useEffect(() => { localStorage.setItem("tt_dailyNotifTime",JSON.stringify(dailyNotifTime)); }, [dailyNotifTime]);
  useEffect(() => { tasksRef.current = tasks; },    [tasks]);
  useEffect(() => { todayIdsRef.current = todayIds; }, [todayIds]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    try { return new Date(y, m-1, d).toLocaleDateString(locale, { day:"numeric", month:"short", year:"numeric" }); }
    catch { return dateStr; }
  };

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523.25,0],[659.25,.18],[783.99,.36]].forEach(([freq,t]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime+t);
        g.gain.linearRampToValueAtTime(0.22, ctx.currentTime+t+0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+0.7);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime+t); osc.stop(ctx.currentTime+t+0.7);
      });
      setTimeout(() => ctx.close(), 2000);
    } catch(e) {}
  };

  const sendNotif = (title, body, tag) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, tag, icon:"/favicon.ico", requireInteraction:true });
    n.onclick = () => { window.focus(); n.close(); };
  };
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  // Mise à jour du callback quotidien à chaque render (évite les closures périmées)
  sendDailyNotifCb.current = () => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = todayStr();
    if (localStorage.getItem("tt_lastDailyNotif") === today) return;
    localStorage.setItem("tt_lastDailyNotif", today);
    const active = tasksRef.current.filter(t => todayIdsRef.current.includes(t.id) && t.status !== "Terminé");
    const count = active.length;
    const body = count > 0
      ? `${count} tâche${count>1?"s":""} : ${active.slice(0,3).map(t=>t.title).join(" • ")}${count>3?" …":""}`
      : "Pas de tâches planifiées aujourd'hui.";
    playChime();
    const n = new Notification("Hey, on fait quoi aujourd'hui ? 👋", {
      body, tag:"daily-reminder", icon:"/favicon.ico", requireInteraction:false
    });
    n.onclick = () => { window.focus(); setShowQuickAdd(true); n.close(); };
  };

  useEffect(() => {
    if (!dailyNotifEnabled) return;
    let tid;
    const schedule = () => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const [h, m] = dailyNotifTime.split(":").map(Number);
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      if (now >= target && localStorage.getItem("tt_lastDailyNotif") !== today) {
        sendDailyNotifCb.current();
      }
      const next = new Date(target);
      if (now >= target) next.setDate(next.getDate()+1);
      tid = setTimeout(() => { sendDailyNotifCb.current(); schedule(); }, next - now);
    };
    schedule();
    return () => clearTimeout(tid);
  }, [dailyNotifEnabled, dailyNotifTime]);

  // Détection ?join=true dans l'URL (lien d'invitation email)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("join") === "true") {
      window.history.replaceState({}, "", window.location.pathname); // nettoie l'URL
      onAuthStateChanged(auth, u => {
        if (!u) {
          // Pas connecté → ouvre le panel auth
          setShowAuthMenu(true);
          setEmailMode("register");
        }
        // Si connecté → la bannière d'invitation apparaît automatiquement
        // et l'effet pendingInvite + team switche vers l'espace équipe ci-dessous
      }, { once: true });
    }
  }, []);

  // Auth listener — réinitialise les données perso quand l'utilisateur change
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(prev => {
        const prevUid = prev?.uid ?? null;
        const newUid  = u?.uid   ?? null;
        if (prevUid !== newUid && newUid !== null) {
          // Utilisateur différent (ou premier login) → vider les données du user précédent
          ['tt_tasks','tt_todayIds','tt_todayDates','tt_tomorrowIds','tt_scheduledIds','tt_highlighted','tt_counter'].forEach(k => localStorage.removeItem(k));
          setTasks(INIT);
          setTodayIds([]); setTodayDates({}); setTomorrowIds([]);
          setScheduledIds([]); setHighlighted([]); setTaskCounter(0);
          setTeamSpace(false);
        }
        return u;
      });
    });
    return unsub;
  }, []);

  // Sync Firestore → local quand connecté
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        fromFirestore.current = true;
        const data = snap.data();
        if (data.tasks)        setTasks(data.tasks);
        if (data.todayIds)     setTodayIds(data.todayIds);
        if (data.todayDates)   setTodayDates(data.todayDates);
        if (data.tomorrowIds)  setTomorrowIds(data.tomorrowIds);
        if (data.scheduledIds) setScheduledIds(data.scheduledIds);
        if (data.highlighted)  setHighlighted(data.highlighted);
        if (data.theme)        setTheme(t => ({...t, ...data.theme}));
        if (data.taskCounter !== undefined) setTaskCounter(data.taskCounter);
      }
    });
    return unsub;
  }, [user]);

  // Sync local → Firestore à chaque changement (sauf si la mise à jour vient de Firestore)
  useEffect(() => {
    if (!user) return;
    if (fromFirestore.current) { fromFirestore.current = false; return; }
    setSyncing(true);
    const ref = doc(db, "users", user.uid);
    const clean = obj => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));
    const saveUser = setDoc(ref, clean({ tasks, todayIds, todayDates, tomorrowIds, scheduledIds, highlighted, taskCounter }), { merge: true });
    const saves = [saveUser];
    if (team && teamRole) {
      const total  = tasks.length;
      const done   = tasks.filter(t => t.status === "Terminé").length;
      const active = tasks.filter(t => t.status !== "Terminé").length;
      const statsRef = doc(db, "teams", team.id, "memberStats", user.uid);
      saves.push(setDoc(statsRef, { total, done, active, displayName: user.displayName || null, email: user.email || null }, { merge: true }));
    }
    Promise.all(saves).finally(() => setSyncing(false));
  }, [tasks, todayIds, todayDates, tomorrowIds, scheduledIds, highlighted, taskCounter]);

  const loginGoogle = async () => {
    try { await signInWithPopup(auth, provider); setShowAuthMenu(false); setAuthError(null); }
    catch(e) { setAuthError(e.code==="auth/popup-closed-by-user"?"Annulé.":e.message); }
  };
  const loginEmail = async () => {
    if (!emailForm.email||!emailForm.password) return;
    try {
      if (emailMode==="register") {
        const cred = await createUserWithEmailAndPassword(auth, emailForm.email, emailForm.password);
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setAuthError(null); setEmailForm({email:"",password:""});
        setEmailMode("login");
        setAuthInfo("Compte créé ! Vérifiez votre email avant de vous connecter.");
      } else {
        const cred = await signInWithEmailAndPassword(auth, emailForm.email, emailForm.password);
        if (!cred.user.emailVerified) {
          await signOut(auth);
          setAuthError("Email non vérifié. Consultez votre boîte mail.");
          setUnverifiedEmail(emailForm.email);
          return;
        }
        setShowAuthMenu(false); setAuthError(null); setAuthInfo(null); setUnverifiedEmail(null); setEmailForm({email:"",password:""});
      }
    } catch(e) { setAuthError(e.message); }
  };
  const resendVerification = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, unverifiedEmail, emailForm.password);
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setAuthError(null); setAuthInfo("Email de vérification renvoyé !");
    } catch(e) { setAuthError(e.message); }
  };
  useEffect(() => {
    if (!user) { setTeam(null); setTeamRole(null); setPendingInvite(null); setTeamSpace(false); return; }
    let teamUnsub = () => {};
    const userUnsub = onSnapshot(doc(db, "users", user.uid), snap => {
      const data = snap.data() || {};
      setTeamRole(data.teamRole || null);
      teamUnsub();
      if (data.teamId) {
        teamUnsub = onSnapshot(doc(db, "teams", data.teamId), tSnap => {
          if (tSnap.exists()) setTeam({ id:tSnap.id, ...tSnap.data() });
          else { setTeam(null); setTeamSpace(false); }
        });
      } else { setTeam(null); setTeamSpace(false); }
    });
    if (user.email) {
      getDoc(doc(db, "invitations", user.email.toLowerCase())).then(s => {
        setPendingInvite(s.exists() ? { id:s.id, ...s.data() } : null);
      });
    }
    return () => { userUnsub(); teamUnsub(); };
  }, [user]);

  const createTeam = async () => {
    if (!user || !teamForm.name.trim()) return;
    try {
      const ref = await addDoc(collection(db, "teams"), { name:teamForm.name.trim(), adminUid:user.uid, adminEmail:user.email||"", members:[], createdAt:serverTimestamp() });
      await setDoc(doc(db, "users", user.uid), { teamId:ref.id, teamRole:"admin" }, { merge:true });
      setTeamForm({ name:"" }); setTeamInfo("Équipe créée !");
    } catch(e) { setTeamError(e.message); }
  };

  const sendInviteEmail = async (toEmail, teamName, invitedBy) => {
    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id:   import.meta.env.VITE_EMAILJS_SERVICE_ID,
          template_id:  import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
          user_id:      import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email:   toEmail,
            team_name:  teamName,
            invited_by: invitedBy,
            app_url:    window.location.origin + "/?join=true"
          }
        })
      });
    } catch(e) { console.error("EmailJS:", e); }
  };

  const inviteMember = async () => {
    if (!team || !inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();
    try {
      await setDoc(doc(db, "invitations", email), { teamId:team.id, teamName:team.name, invitedBy:user.email||"", createdAt:serverTimestamp() });
      await sendInviteEmail(email, team.name, user.email||"");
      setTeamInfo(`Invitation envoyée à ${email}`); setInviteEmail("");
    } catch(e) { setTeamError(e.message); }
  };

  const acceptInvite = async () => {
    if (!pendingInvite || !user) return;
    try {
      await updateDoc(doc(db, "teams", pendingInvite.teamId), { members: arrayUnion({ uid:user.uid, email:user.email||"", displayName:user.displayName||user.email||"" }) });
      await setDoc(doc(db, "users", user.uid), { teamId:pendingInvite.teamId, teamRole:"member" }, { merge:true });
      await deleteDoc(doc(db, "invitations", (user.email||"").toLowerCase()));
      setPendingInvite(null);
      setTeamSpace(true); // bascule directement sur l'espace équipe
    } catch(e) { setTeamError(e.message); }
  };

  const rejectInvite = async () => {
    if (!user) return;
    try { await deleteDoc(doc(db, "invitations", (user.email||"").toLowerCase())); setPendingInvite(null); }
    catch(e) { setTeamError(e.message); }
  };

  const removeMember = async (member) => {
    if (!team || teamRole !== "admin") return;
    try {
      await updateDoc(doc(db, "teams", team.id), { members: arrayRemove(member) });
      await setDoc(doc(db, "users", member.uid), { teamId:null, teamRole:null }, { merge:true });
    } catch(e) { setTeamError(e.message); }
  };

  const leaveTeam = async () => {
    if (!user || !team || teamRole === "admin") return;
    if (!window.confirm("Quitter l'équipe ?")) return;
    try {
      const me = team.members.find(m => m.uid === user.uid);
      if (me) await updateDoc(doc(db, "teams", team.id), { members: arrayRemove(me) });
      await setDoc(doc(db, "users", user.uid), { teamId:null, teamRole:null }, { merge:true });
      setTeamSpace(false);
    } catch(e) { setTeamError(e.message); }
  };

  const dissolveTeam = async () => {
    if (!team || teamRole !== "admin") return;
    if (!window.confirm("Dissoudre l'équipe ? Tous les membres seront retirés.")) return;
    try {
      for (const m of team.members) await setDoc(doc(db, "users", m.uid), { teamId:null, teamRole:null }, { merge:true });
      await setDoc(doc(db, "users", user.uid), { teamId:null, teamRole:null }, { merge:true });
      await deleteDoc(doc(db, "teams", team.id));
      setTeamSpace(false);
    } catch(e) { setTeamError(e.message); }
  };

  useEffect(() => {
    if (!teamSpace || !team) { setTeamTasks([]); setTeamPending([]); return; }
    const unsubTasks = onSnapshot(collection(db, "teams", team.id, "tasks"), snap => {
      const t = snap.docs.map(d => ({ ...d.data(), id:d.id }));
      t.sort((a,b) => (a.num||0)-(b.num||0));
      setTeamTasks(t);
    });
    const unsubPending = onSnapshot(collection(db, "teams", team.id, "pendingChanges"), snap => {
      setTeamPending(snap.docs.map(d => ({ ...d.data(), id:d.id })));
    });
    return () => { unsubTasks(); unsubPending(); };
  }, [teamSpace, team]);

  useEffect(() => {
    if (!teamModal || !team) { setTeamComments([]); return; }
    const unsub = onSnapshot(collection(db, "teams", team.id, "tasks", teamModal, "comments"), snap => {
      const c = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      c.sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
      setTeamComments(c);
    });
    return unsub;
  }, [teamModal, team]);

  const addComment = async () => {
    if (!commentInput.trim() || !teamModal || !team || !user) return;
    try {
      await addDoc(collection(db, "teams", team.id, "tasks", teamModal, "comments"), {
        text: commentInput.trim(),
        authorUid: user.uid,
        authorEmail: user.email || "",
        authorName: user.displayName || user.email || "?",
        createdAt: Date.now()
      });
      setCommentInput("");
    } catch(e) { setTeamError(e.message); }
  };

  const deleteTeamTask = async (taskId) => {
    if (!team) return;
    if (teamRole === "admin") {
      try { await deleteDoc(doc(db, "teams", team.id, "tasks", taskId)); } catch(e) { setTeamError(e.message); }
    } else {
      if (!window.confirm("Proposer la suppression à l'admin ?")) return;
      try {
        await addDoc(collection(db, "teams", team.id, "pendingChanges"), { type:"delete", taskId, proposedBy:user.uid, proposedByEmail:user.email||"", data:null, createdAt:serverTimestamp(), status:"pending" });
        setTeamInfo("Suppression proposée à l'admin.");
      } catch(e) { setTeamError(e.message); }
    }
  };

  const approveChange = async (change) => {
    if (teamRole !== "admin") return;
    try {
      if (change.type === "edit")   await setDoc(doc(db, "teams", team.id, "tasks", change.taskId), change.data, { merge:true });
      if (change.type === "delete") await deleteDoc(doc(db, "teams", team.id, "tasks", change.taskId));
      await deleteDoc(doc(db, "teams", team.id, "pendingChanges", change.id));
    } catch(e) { setTeamError(e.message); }
  };

  const rejectChange = async (changeId) => {
    if (teamRole !== "admin") return;
    try { await deleteDoc(doc(db, "teams", team.id, "pendingChanges", changeId)); }
    catch(e) { setTeamError(e.message); }
  };

  const logout = () => { signOut(auth); setShowAuthMenu(false); };

  const submitQuickAdd = () => {
    if (!quickTitle.trim()) return;
    const newNum = taskCounter + 1;
    const today = todayStr();
    const newTask = { id:Date.now(), title:quickTitle.trim(), priority:quickPriority, status:"À faire", due:today, notes:"", notify:true, recurrence:"none", completion:null, num:newNum };
    setTaskCounter(c => c+1);
    setTasks(p => [...p, newTask]);
    setTodayIds(p => [...p, newTask.id]);
    setTodayDates(d => ({...d, [newTask.id]:today}));
    setQuickTitle(""); setQuickPriority("Moyenne"); setShowQuickAdd(false);
  };

  useEffect(() => {
    const today = todayStr();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    setTomorrowIds(prev => {
      const promoted = prev.filter(e => e.addedDate < today).map(e => e.id);
      if (promoted.length > 0) {
        setTodayIds(t => [...t, ...promoted.filter(id => !t.includes(id))]);
        setTodayDates(d => { const n={...d}; promoted.forEach(id => { if (!n[id]) n[id]=today; }); return n; });
        setHighlighted(h => [...h, ...promoted.filter(id => !h.includes(id))]);
        const notifTasks = tasks.filter(t => promoted.includes(t.id) && t.notify !== false);
        if (notifTasks.length > 0) {
          sendNotif("📅 C'est pour aujourd'hui !", `${notifTasks.length} tâche${notifTasks.length>1?"s":""} à traiter`, "promote-today");
        }
        return prev.filter(e => e.addedDate >= today);
      }
      return prev;
    });
    setScheduledIds(prev => {
      const toToday    = prev.filter(e => e.dueDate <= today);
      const toTomorrow = prev.filter(e => e.dueDate === tomorrowStr);
      const keep       = prev.filter(e => e.dueDate > tomorrowStr);
      if (toToday.length > 0) {
        setTodayIds(t => [...t, ...toToday.map(e=>e.id).filter(id=>!t.includes(id))]);
        setTodayDates(d => { const n={...d}; toToday.forEach(e=>{if(!n[e.id])n[e.id]=today;}); return n; });
      }
      if (toTomorrow.length > 0) {
        setTomorrowIds(t => [...t, ...toTomorrow.filter(e=>!t.find(x=>x.id===e.id)).map(e=>({id:e.id,addedDate:today}))]);
      }
      return keep;
    });
    tasks.forEach(t => {
      if (t.due === tomorrowStr && !tomorrowIds.find(e=>e.id===t.id) && !todayIds.includes(t.id)) {
        setTomorrowIds(p => p.find(e=>e.id===t.id) ? p : [...p, {id:t.id,addedDate:today}]);
      }
    });
  }, [tasks]);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceError("Non supporté sur ce navigateur."); return; }
    setVoiceError(null);
    const rec = new SR(); rec.lang="fr-FR"; rec.continuous=false; rec.interimResults=false;
    recognitionRef.current = rec;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = (e) => { setListening(false); setVoiceError(e.error==="not-allowed"?"Microphone refusé.":"Erreur: "+e.error); };
    rec.onresult = (e) => { setForm(f=>({...f,title:e.results[0][0].transcript})); setShowForm(true); setFormStep(1); setEditingId(null); };
    rec.start();
  };
  const stopVoice = () => { recognitionRef.current?.stop(); setListening(false); };

  const buildCompletion = (task) => {
    const now   = new Date();
    const tc    = taskColor(task);
    const color = tc ? tc.light : STATUS_DOT["Terminé"];
    let deltaMin=null, deltaLabel=null;
    if (task.due) {
      const dueMs = new Date(task.due+"T23:59:59").getTime();
      deltaMin = Math.round((now.getTime()-dueMs)/60000);
      const abs=Math.abs(deltaMin), d=Math.floor(abs/1440), h=Math.floor((abs%1440)/60), m=abs%60;
      const parts=[]; if(d)parts.push(d+"j"); if(h)parts.push(h+"h"); if(m||!parts.length)parts.push(m+"min");
      deltaLabel = (deltaMin<0?"−":"+")+parts.join(" ");
    }
    return { doneAt:now.toISOString(), doneDate:now.toISOString().split("T")[0], color, deltaMin, deltaLabel };
  };

  const cycleStatus = (id) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next = STATUSES[(STATUSES.indexOf(t.status)+1)%STATUSES.length];
      if (next === "Terminé") {
        setHighlighted(h => h.filter(i => i!==id));
        setTodayIds(p => p.filter(i => i!==id));
        setTodayDates(d => { const n={...d}; delete n[id]; return n; });
        setTomorrowIds(p => p.filter(e => e.id!==id));
        const completed = { ...t, status:next, completion:buildCompletion(t) };
        // Récurrence : recrée une tâche si nécessaire
        if (t.recurrence && t.recurrence !== "none") {
          const newDue = (() => {
            if (!t.due) return "";
            const d = new Date(t.due);
            if (t.recurrence === "daily")   d.setDate(d.getDate()+1);
            if (t.recurrence === "monthly") d.setMonth(d.getMonth()+1);
            if (t.recurrence && /^weekly-\d+$/.test(t.recurrence)) {
              const targetDay=parseInt(t.recurrence.split("-")[1]); // 1=Mon..7=Sun
              d.setDate(d.getDate()+1);
              while((d.getDay()||7)!==targetDay) d.setDate(d.getDate()+1);
            }
            if (t.recurrence === "weekly") d.setDate(d.getDate()+7);
            if (t.recurrence && t.recurrence.startsWith("monthly-day-")) {
              const day = parseInt(t.recurrence.split("-")[2]);
              d.setMonth(d.getMonth()+1); d.setDate(day);
            }
            if (t.recurrence && t.recurrence.startsWith("monthly-ordinal-")) {
              const parts=t.recurrence.split("-"); const ord=parseInt(parts[2]); const dow=parseInt(parts[3]);
              d.setMonth(d.getMonth()+1); d.setDate(1);
              let count=0; while(count<ord){ if((d.getDay()||7)===dow)count++; if(count<ord)d.setDate(d.getDate()+1); }
            }
            return d.toISOString().split("T")[0];
          })();
          setTaskCounter(c => {
            const newNum = c + 1;
            setTimeout(() => {
              setTasks(p => [...p, { ...t, id:Date.now(), status:"À faire", due:newDue, completion:null, num:newNum }]);
            }, 100);
            return newNum;
          });
        }
        return completed;
      }
      // Retour depuis Terminé : conserver num d'origine (jamais en réassigner un nouveau)
      return { ...t, status:next, completion:null, num:t.num };
    }));
  };

  const addToToday = (id) => {
    setTodayDates(d => ({...d, [id]:todayStr()}));
    setTodayIds(p => p.includes(id) ? p : [...p, id]);
    setHighlighted(p => p.includes(id) ? p : [...p, id]);
    setTasks(p => p.map(t => t.id===id&&t.status==="Terminé" ? {...t,status:"À faire"} : t));
  };
  const removeFromToday = (id) => {
    setTodayDates(d => { const n={...d}; delete n[id]; return n; });
    setTodayIds(p => p.filter(i => i!==id));
    setModal(null);
  };
  const addToTomorrow = (id) => {
    setTomorrowIds(p => p.find(e=>e.id===id) ? p : [...p, {id, addedDate:todayStr()}]);
    setHighlighted(p => p.includes(id) ? p : [...p, id]);
    setTasks(p => p.map(t => t.id===id&&t.status==="Terminé" ? {...t,status:"À faire"} : t));
    setTodayIds(p => p.filter(i => i!==id));
  };
  const removeFromTomorrow = (id) => {
    setTomorrowIds(p => p.filter(e => e.id!==id));
    setScheduledIds(p => p.filter(e => e.id!==id));
    setModal(null);
  };

  const reorderBubbles = (fromId, toId) => {
    if (fromId===toId) return;
    setTodayIds(prev => {
      const a=[...prev], fi=a.indexOf(fromId), ti=a.indexOf(toId);
      if (fi<0||ti<0) return a;
      a.splice(fi,1); a.splice(ti,0,fromId); return a;
    });
  };

  const deleteTask = (id) => {
    setTasks(p=>p.filter(t=>t.id!==id));
    setTodayIds(p=>p.filter(i=>i!==id));
    setTodayDates(d=>{const n={...d};delete n[id];return n;});
    setTomorrowIds(p=>p.filter(e=>e.id!==id));
    setScheduledIds(p=>p.filter(e=>e.id!==id));
    setHighlighted(p=>p.filter(i=>i!==id));
  };

  const duplicateTask = (task) => {
    const newNum = taskCounter + 1;
    setTaskCounter(c => c + 1);
    setTasks(p => [...p, {...task, id:Date.now(), status:"À faire", completion:null, num:newNum}]);
  };

  const openEdit = (task) => {
    setForm({title:task.title,priority:task.priority,status:task.status,due:task.due||"",notes:task.notes||"",notify:task.notify!==false,recurrence:task.recurrence||"none"});
    setEditingId(task.id); setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.title.trim()) return;
    if (form.recurrence === "weekly")  { setRecurError("Choisis un jour de la semaine"); return; }
    if (form.recurrence === "monthly") { setRecurError("Choisis une date ou un jour du mois"); return; }
    setRecurError(null);
    // ── ESPACE ÉQUIPE ──
    if (teamSpace && team) {
      const cleanForm = { ...form, recurrence:form.recurrence||"none" };
      try {
        if (editingId !== null) {
          if (teamRole === "admin") {
            await updateDoc(doc(db, "teams", team.id, "tasks", editingId), cleanForm);
          } else {
            await addDoc(collection(db, "teams", team.id, "pendingChanges"), { type:"edit", taskId:editingId, proposedBy:user.uid, proposedByEmail:user.email||"", data:cleanForm, createdAt:serverTimestamp(), status:"pending" });
            setTeamInfo("Modification proposée à l'admin.");
          }
          setEditingId(null); setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none"}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false);
        } else if (teamRole === "admin") {
          const newNum = teamTasks.length + 1;
          const docRef = await addDoc(collection(db, "teams", team.id, "tasks"), { ...cleanForm, id:Date.now(), num:newNum, createdBy:user.uid, createdAt:serverTimestamp() });
          // Étape 2 : planification (même flow que les tâches perso)
          setPendingTask({ id: docRef.id, title: form.title });
          setPendingTeamTaskId(docRef.id);
          setFormStep(2);
        }
      } catch(e) { setTeamError(e.message); }
      return;
    }
    // ── ESPACE PERSO ──
    if (editingId !== null) {
      const prevTask = getTask(editingId);
      const becomingDone = form.status==="Terminé" && prevTask?.status !== "Terminé";
      setTasks(prev => prev.map(t => {
        if (t.id !== editingId) return t;
        const updated = {...form, id:editingId, num:t.num, recurrence:form.recurrence||"none"};
        if (becomingDone) updated.completion = buildCompletion({...t, ...form});
        else if (form.status !== "Terminé") updated.completion = null;
        return updated;
      }));
      if (form.status==="Terminé") {
        setHighlighted(h=>h.filter(i=>i!==editingId));
        setTomorrowIds(p=>p.filter(e=>e.id!==editingId));
        setTodayIds(p=>p.filter(i=>i!==editingId));
      }
      setEditingId(null); setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none"}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false);
    } else {
      const newNum = taskCounter + 1;
      setTaskCounter(c => c + 1);
      const newTask = {...form, id:Date.now(), num:newNum};
      setTasks(prev=>[...prev,newTask]); setPendingTask(newTask); setFormStep(2); setCustomDate("");
    }
  };

  const applySchedule = async (choice, date) => {
    if (!pendingTask) return;

    // ── Tâche équipe (admin) ──
    if (pendingTeamTaskId && team) {
      const scheduled = choice === "today" ? "today" : choice === "tomorrow" ? "tomorrow" : (choice === "date" && date) ? date : null;
      try { await updateDoc(doc(db, "teams", team.id, "tasks", pendingTeamTaskId), { scheduledFor: scheduled }); } catch(e) {}
      setPendingTeamTaskId(null);
      setPendingTask(null); setFormStep(1);
      setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none"}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false);
      return;
    }

    // ── Tâche perso ──
    const id = pendingTask.id;
    const today = todayStr();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    if (choice==="date"&&date) setTasks(p=>p.map(t=>t.id===id?{...t,due:date,recurrence:form.recurrence||"none"}:t));
    else setTasks(p=>p.map(t=>t.id===id?{...t,recurrence:form.recurrence||"none"}:t));
    if (choice==="today")   addToToday(id);
    if (choice==="tomorrow") addToTomorrow(id);
    if (choice==="date"&&date) {
      if (date===today) addToToday(id);
      else if (date===tomorrowStr) addToTomorrow(id);
      else setScheduledIds(p=>[...p,{id,dueDate:date}]);
    }
    setPendingTask(null); setFormStep(1);
    setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none"}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false);
  };

  const getZoneAtPoint = (x, y) => {
    if (!leftRef.current) return null;
    const rect = leftRef.current.getBoundingClientRect();
    if (x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom) {
      const els = document.elementsFromPoint(x,y);
      for (const el of els) {
        const bid = el.dataset?.bubbleid; if (bid) return parseInt(bid);
        if (el.dataset?.zone==="tomorrow") return "tomorrow";
      }
      return y < rect.top+rect.height/2 ? "today" : "tomorrow";
    }
    return "list";
  };

  const onDragStart = (e, id, src) => {
    dragRef.current={id,src}; e.dataTransfer.effectAllowed="move";
    const task = getTask(id);
    const col = STATUS_DOT[task?.status||"À faire"];
    const num = tasks.findIndex(t=>t.id===id)+1;
    const el = document.createElement("div");
    el.style.cssText = `width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 35% 35%,${col}cc,${col});display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:#fff;position:fixed;top:-100px;left:-100px;`;
    el.textContent = String(num);
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 27, 27);
    setTimeout(()=>{ if(document.body.contains(el)) document.body.removeChild(el); }, 0);
  };
  const onDragEnd   = (e) => {
    const {id,src} = dragRef.current; dragRef.current={}; setDropZone(null); if (!id) return;
    if (leftRef.current) {
      const rect = leftRef.current.getBoundingClientRect();
      if (e.clientX>rect.right) { if(src==="bubble")removeFromToday(id); if(src==="bubble-tomorrow")removeFromTomorrow(id); return; }
      if (src==="bubble"&&e.clientY>rect.top+rect.height/2) { removeFromToday(id); addToTomorrow(id); return; }
      if (src==="bubble-tomorrow"&&e.clientY<rect.top+rect.height/2) { removeFromTomorrow(id); addToToday(id); return; }
    }
  };
  const onDropToday    = (e) => { e.preventDefault(); const {id,src}=dragRef.current; if(src==="list"&&id)addToToday(id); if(src==="bubble-tomorrow"&&id){removeFromTomorrow(id);addToToday(id);} setDropZone(null); };
  const onDropTomorrow = (e) => { e.preventDefault(); const {id,src}=dragRef.current; if((src==="list"||src==="bubble")&&id)addToTomorrow(id); setDropZone(null); };
  const onDropBubble   = (e, targetId) => { e.preventDefault(); e.stopPropagation(); const {id,src}=dragRef.current; if(src==="bubble"&&id)reorderBubbles(id,targetId); setDropZone(null); };

  const onTouchStart = (e, id, src) => {
    const t=e.touches[0];
    dragRef.current={id,src,startX:t.clientX,startY:t.clientY,curX:t.clientX,curY:t.clientY,moved:false,dragging:false};
    const isBubble = src==="bubble"||src==="bubble-tomorrow";
    const delay = isBubble ? 80 : 500;
    longPressTimer.current = setTimeout(() => {
      if (dragRef.current.id===id) {
        dragRef.current.dragging=true;
        setGhost({id,src,x:dragRef.current.curX,y:dragRef.current.curY});
      }
    }, delay);
  };
  const onTouchMove  = (e) => {
    const t=e.touches[0]; const {id,src,dragging,startX,startY}=dragRef.current; if(!id)return;
    dragRef.current.curX=t.clientX; dragRef.current.curY=t.clientY;
    if (!dragging) {
      if (src==="list" && (Math.abs(t.clientX-startX)>8||Math.abs(t.clientY-startY)>8)) { clearTimeout(longPressTimer.current); dragRef.current={}; }
      return;
    }
    dragRef.current.moved=true; setGhost({id,src,x:t.clientX,y:t.clientY}); setDropZone(getZoneAtPoint(t.clientX,t.clientY)); e.preventDefault();
  };
  const onTouchEnd   = (e) => {
    clearTimeout(longPressTimer.current);
    const t=e.changedTouches[0]; const {id,src,moved,dragging}=dragRef.current; dragRef.current={}; setGhost(null); setDropZone(null);
    if (!id||!moved||!dragging) return;
    const zone=getZoneAtPoint(t.clientX,t.clientY);
    if (src==="list"&&zone==="today")         { addToToday(id); return; }
    if (src==="list"&&zone==="tomorrow")      { addToTomorrow(id); return; }
    if (src==="bubble"&&zone==="list")        { removeFromToday(id); return; }
    if (src==="bubble-tomorrow"&&zone==="list")   { removeFromTomorrow(id); return; }
    if (src==="bubble-tomorrow"&&zone==="today")  { removeFromTomorrow(id); addToToday(id); return; }
    if (src==="bubble"&&zone==="tomorrow")    { addToTomorrow(id); return; }
    if (src==="bubble"&&typeof zone==="number"&&zone!==id) { reorderBubbles(id,zone); return; }
  };
  useEffect(() => {
    const h = (e) => { if (dragRef.current?.id) onTouchMove(e); };
    document.addEventListener("touchmove",h,{passive:false}); return () => document.removeEventListener("touchmove",h);
  }, []);
  useEffect(() => {
    const h = (e) => { if (dragRef.current?.id) onTouchEnd(e); };
    document.addEventListener("touchend",h); return () => document.removeEventListener("touchend",h);
  }, [todayIds, highlighted]);

  const isOverBubble = (id) => dropZone===id;
  const isOverToday  = dropZone==="today";
  const isOverList   = dropZone==="list";

  // ─── Render helpers ────────────────────────────────────────────────

  const renderModal = () => {
    if (!modal) return null;
    const task = getTask(modal); if (!task) return null;
    const col  = STATUS_DOT[task.status];
    const tc   = taskColor(task);
    const bCol = task.status==="Terminé"&&task.completion ? task.completion.color : (tc?tc.light:col);
    const inT   = todayIds.includes(modal);
    const inTom = tomorrowIds.map(e=>e.id).includes(modal);
    return (
      <div onClick={()=>setModal(null)} style={{ position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:26,width:310,boxShadow:"0 0 40px #0000008a" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:42,height:42,borderRadius:"50%",background:bCol,boxShadow:`0 0 16px ${bCol}88`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#fff" }}>
                {taskNum(modal)}
              </div>
              <div>
                <div style={{ fontSize:13,color:theme.text }}>{task.title}</div>
                <div style={{ fontSize:9,color:col,marginTop:2 }}>{task.status.toUpperCase()}</div>
              </div>
            </div>
            <button onClick={()=>setModal(null)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer" }}>✕</button>
          </div>
          {task.notes && (
            <div style={{ fontSize:11,color:theme.textMuted,marginBottom:14,padding:"8px 10px",background:theme.bg,borderRadius:8 }}>{task.notes}</div>
          )}
          {task.status==="Terminé"&&task.completion && (
            <div style={{ fontSize:10,color:theme.textMuted,marginBottom:14,textAlign:"center" }}>
              🏆 Terminé le {task.completion.doneDate}
              {task.completion.deltaLabel && (
                <span style={{ marginLeft:8,color:task.completion.deltaMin<0?"#3aaa3a":"#cc3030",fontWeight:700 }}>
                  {task.completion.deltaMin<0?"⚡":"⚠"} {task.completion.deltaLabel}
                </span>
              )}
            </div>
          )}
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            <button onClick={()=>cycleStatus(modal)} style={{ background:col+"22",border:`1px solid ${col}66`,borderRadius:8,padding:"8px",color:col,fontSize:11,cursor:"pointer" }}>
              Changer statut → {STATUSES[(STATUSES.indexOf(task.status)+1)%STATUSES.length]}
            </button>
            {inT && (
              <button onClick={()=>removeFromToday(modal)} style={{ background:theme.accent+"11",border:`1px solid ${theme.accent}44`,borderRadius:8,padding:"8px",color:theme.accent,fontSize:11,cursor:"pointer" }}>
                ↩ Remettre dans les tâches
              </button>
            )}
            {inTom && (
              <button onClick={()=>removeFromTomorrow(modal)} style={{ background:theme.accent+"11",border:`1px solid ${theme.accent}44`,borderRadius:8,padding:"8px",color:theme.accent,fontSize:11,cursor:"pointer" }}>
                ↩ Remettre dans les tâches
              </button>
            )}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0" }}>
              <span style={{ fontSize:11,color:theme.textMuted }}>Notifications</span>
              <span onClick={()=>setTasks(p=>p.map(t=>t.id===modal?{...t,notify:t.notify===false}:t))} style={{ fontSize:16,cursor:"pointer",opacity:task.notify!==false?1:0.4 }}>
                {task.notify!==false?"🔔":"🔕"}
              </span>
            </div>
            <button onClick={()=>{openEdit(task);setModal(null);}} style={{ background:theme.accent+"22",border:`1px solid ${theme.accent}66`,borderRadius:8,padding:"8px",color:theme.accent,fontSize:11,cursor:"pointer" }}>
              ✎ Modifier
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTeamModal = () => {
    if (!teamModal || !team) return null;
    const task = teamTasks.find(t => t.id === teamModal);
    if (!task) return null;
    const tc  = taskColor(task);
    const dot = STATUS_DOT[task.status] || "#888";
    const closeModal = () => { setTeamModal(null); setCommentInput(""); };
    return (
      <div onClick={closeModal} style={{ position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300 }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:340,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099",display:"flex",flexDirection:"column",gap:0 }}>
          {/* En-tête */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:13,fontWeight:700,color:theme.text,marginBottom:6 }}>{task.title}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                <span style={{ fontSize:9,padding:"2px 7px",borderRadius:4,background:(PRIO_COLOR[task.priority]||"#888")+"22",color:PRIO_COLOR[task.priority]||"#888",border:`1px solid ${(PRIO_COLOR[task.priority]||"#888")}44` }}>{task.priority||"?"}</span>
                <span style={{ fontSize:9,padding:"2px 7px",borderRadius:4,background:dot+"22",color:dot }}>{task.status}</span>
                {task.due && <span style={{ fontSize:9,color:theme.accent+"aa" }}>📅 {formatDate(task.due)}</span>}
              </div>
            </div>
            <button onClick={closeModal} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer",marginLeft:8 }}>✕</button>
          </div>
          {task.notes && <div style={{ fontSize:11,color:theme.textMuted,marginBottom:14,padding:"8px 10px",background:theme.bg,borderRadius:8 }}>{task.notes}</div>}
          <button onClick={()=>{ openEdit(task); closeModal(); }}
            style={{ width:"100%",background:theme.accent+"22",border:`1px solid ${theme.accent}66`,borderRadius:8,padding:"7px",color:theme.accent,fontSize:11,cursor:"pointer",marginBottom:18 }}>
            {teamRole==="admin" ? "✎ Modifier" : "✎ Proposer une modification"}
          </button>
          {/* Commentaires */}
          <div style={{ fontSize:9,color:"#444466",letterSpacing:1,marginBottom:10 }}>COMMENTAIRES ({teamComments.length})</div>
          <div style={{ display:"flex",flexDirection:"column",gap:7,marginBottom:12 }}>
            {teamComments.length===0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"10px 0" }}>Pas encore de commentaire.</div>}
            {teamComments.map(c => (
              <div key={c.id} style={{ background:theme.bg,borderRadius:8,padding:"8px 10px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:10,color:theme.accent,fontWeight:600 }}>{c.authorName}</span>
                  <span style={{ fontSize:9,color:theme.textMuted }}>{new Date(c.createdAt).toLocaleString(locale,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <div style={{ fontSize:11,color:theme.text,lineHeight:1.5 }}>{c.text}</div>
              </div>
            ))}
          </div>
          {/* Saisie commentaire */}
          <div style={{ display:"flex",gap:8 }}>
            <input value={commentInput} onChange={e=>setCommentInput(e.target.value)} placeholder="Ajouter un commentaire…"
              onKeyDown={e=>e.key==="Enter"&&addComment()}
              style={{ flex:1,background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:8,padding:"8px 10px",color:theme.text,fontSize:11,outline:"none" }}/>
            <button onClick={addComment} style={{ background:theme.accent,border:"none",borderRadius:8,padding:"8px 13px",color:"#fff",fontSize:14,cursor:"pointer" }}>↑</button>
          </div>
        </div>
      </div>
    );
  };

  const renderGhost = () => {
    if (!ghost) return null;
    const task = getTask(ghost.id); if (!task) return null;
    const col = STATUS_DOT[task.status];
    return (
      <div ref={ghostRef} style={{ position:"fixed",left:ghost.x-29,top:ghost.y-29,width:58,height:58,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${col}cc,${col})`,boxShadow:`0 0 24px ${col}99`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#fff",zIndex:999,pointerEvents:"none",opacity:0.85,transform:"scale(1.15)" }}>
        {taskNum(ghost.id)}
      </div>
    );
  };

  const renderTeamStats = () => {
    const total  = teamTasks.length;
    const done   = teamTasks.filter(t => t.status === "Terminé").length;
    const active = teamTasks.filter(t => t.status !== "Terminé").length;
    const rate   = total > 0 ? Math.round((done/total)*100) : 0;
    const scheduled = teamTasks.filter(t => t.scheduledFor === "today").length;
    return (
      <div>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:2 }}>AVANCEMENT ÉQUIPE</div>
          <div style={{ height:8,background:theme.border,borderRadius:4,overflow:"hidden" }}>
            <div style={{ height:"100%",width:rate+"%",background:rate>70?"#3aaa3a":rate>40?"#ccaa00":"#cc3030",borderRadius:4,transition:"width .5s" }}/>
          </div>
          <div style={{ fontSize:11,color:theme.text,marginTop:4,textAlign:"right",fontWeight:700 }}>{rate}%</div>
        </div>
        <StatRow emoji="📋" label="Total tâches"   value={total} />
        <StatRow emoji="✅" label="Terminées"       value={done+"/"+total} color="#3aaa3a" />
        <StatRow emoji="⏳" label="En cours/À faire" value={active} color={theme.accent} />
        {scheduled > 0 && <StatRow emoji="☀️" label="Planif. aujourd'hui" value={scheduled} />}
        {total === 0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"20px 0" }}>Aucune tâche dans l'équipe</div>}
      </div>
    );
  };

  const renderStats = () => {
    const done     = tasks.filter(t => t.status==="Terminé");
    const total    = tasks.length;
    const withComp = done.filter(t => t.completion);
    const early    = withComp.filter(t => t.completion.deltaMin!==null&&t.completion.deltaMin<0);
    const onTime   = withComp.filter(t => t.completion.deltaMin!==null&&t.completion.deltaMin===0);
    const late     = withComp.filter(t => t.completion.deltaMin!==null&&t.completion.deltaMin>0);
    const noDue    = done.filter(t => !t.completion?.deltaLabel);
    const rate     = total>0 ? Math.round((done.length/total)*100) : 0;
    const sumDelta = early.concat(late).reduce((s,t)=>s+t.completion.deltaMin,0);
    const avgDelta = early.concat(late).length>0 ? Math.round(sumDelta/early.concat(late).length) : null;

    const fmtDelta = (min) => {
      const abs=Math.abs(min), d=Math.floor(abs/1440), h=Math.floor((abs%1440)/60), m=abs%60;
      const p=[]; if(d)p.push(d+"j"); if(h)p.push(h+"h"); if(m||!p.length)p.push(m+"min");
      return (min<0?"−":"+")+p.join(" ");
    };

    const StatRow = ({ emoji, label, value, color, onClick }) => (
      <div onClick={onClick} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${theme.border}44`,cursor:onClick?"pointer":"default" }}>
        <span style={{ fontSize:11,color:theme.textMuted }}>{emoji} {label}{onClick?" →":""}</span>
        <span style={{ fontSize:13,fontWeight:700,color:color||theme.text }}>{value}</span>
      </div>
    );

    return (
      <>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:20,background:theme.accent+"11",borderRadius:12,padding:"14px 0" }}>
          <span style={{ fontSize:28 }}>🏆</span>
          <div>
            <div style={{ fontSize:24,fontWeight:800,color:theme.accent,fontFamily:"'Syne',sans-serif" }}>{done.length}</div>
            <div style={{ fontSize:10,color:theme.textMuted }}>tâche{done.length!==1?"s":""} terminée{done.length!==1?"s":""}</div>
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:2 }}>EFFICACITÉ</div>
          <div style={{ height:8,background:theme.border,borderRadius:4,overflow:"hidden" }}>
            <div style={{ height:"100%",width:rate+"%",background:rate>70?"#3aaa3a":rate>40?"#ccaa00":"#cc3030",borderRadius:4,transition:"width .5s" }}/>
          </div>
          <div style={{ fontSize:11,color:theme.text,marginTop:4,textAlign:"right",fontWeight:700 }}>{rate}%</div>
        </div>
        <StatRow emoji="✅" label="Terminées" value={done.length+"/"+total} onClick={()=>setShowDone(true)} />
        <StatRow emoji="⚡" label="En avance"  value={early.length} color="#3aaa3a" />
        <StatRow emoji="🎯" label="À temps"     value={onTime.length} color="#ccaa00" />
        <StatRow emoji="⚠"  label="En retard"  value={late.length}  color="#cc3030" />
        {noDue.length>0 && <StatRow emoji="📋" label="Sans échéance" value={noDue.length} />}
        {avgDelta!==null && <StatRow emoji="⏱" label="Delta moyen" value={fmtDelta(avgDelta)} color={avgDelta<0?"#3aaa3a":"#cc3030"} />}
        {early.length>0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:9,color:theme.textMuted,letterSpacing:2,marginBottom:8 }}>MEILLEURES RÉALISATIONS</div>
            {[...early].sort((a,b)=>a.completion.deltaMin-b.completion.deltaMin).slice(0,3).map(t=>(
              <div key={t.id} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${theme.border}44` }}>
                <span style={{ fontSize:10,color:theme.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>⚡ {t.title}</span>
                <span style={{ fontSize:10,color:"#3aaa3a",marginLeft:8,flexShrink:0 }}>{t.completion.deltaLabel}</span>
              </div>
            ))}
          </div>
        )}
        {late.length>0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:9,color:theme.textMuted,letterSpacing:2,marginBottom:8 }}>PLUS GRANDS RETARDS</div>
            {[...late].sort((a,b)=>b.completion.deltaMin-a.completion.deltaMin).slice(0,3).map(t=>(
              <div key={t.id} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${theme.border}44` }}>
                <span style={{ fontSize:10,color:theme.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>⚠ {t.title}</span>
                <span style={{ fontSize:10,color:"#cc3030",marginLeft:8,flexShrink:0 }}>{t.completion.deltaLabel}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // ─── JSX Return ────────────────────────────────────────────────────

  return (
    <div style={{ height:"100vh", overflow:"hidden", background:theme.bg, fontFamily:"'DM Mono','Courier New',monospace", color:theme.text, display:"flex", flexDirection:"column", userSelect:"none", "--date-icon-invert": theme.mode==="dark"?"1":"0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&family=Space+Mono:wght@400;700&family=Inter:wght@400;500&family=Roboto+Mono:wght@400;500&family=Bebas+Neue&family=Oswald:wght@600;700&family=Rajdhani:wght@600;700&family=Orbitron:wght@700;800&family=Playfair+Display:wght@400;600;700&family=Cormorant+Garamond:wght@400;600;700&display=swap');
        * { box-sizing:border-box; -webkit-touch-callout:none; }
        html, body { height:100%; overflow:hidden; margin:0; }
        ::placeholder { color:#444466; }
        input,textarea,select { outline:none; user-select:text; -webkit-touch-callout:default; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(var(--date-icon-invert, 0)); cursor:pointer; }
        .row:hover { background:#16162e !important; }
        .bubble { transition:transform .12s; cursor:grab; touch-action:none; }
        .bubble:hover { transform:scale(1.08); }
        .bubble.over { transform:scale(1.18); box-shadow:0 0 20px #5050dd88 !important; }
        .delbtn:hover { background:#3a1a1a !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        body { overflow-x:hidden; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: isMobile ? "10px 12px 8px" : "20px 28px 14px",
        borderBottom:`1px solid ${theme.border}`,
        display:"flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        position: "relative",
      }}>
        <div style={{ fontFamily:`'${theme.titleFont}',sans-serif`, fontSize: isMobile ? 15 : 18, fontWeight:800, color:theme.accent, letterSpacing: isMobile ? 1 : 3, whiteSpace:"nowrap" }}>TASK TRACKER PRO</div>
        <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none" }}>
          <img src="/favicon.svg" alt="logo" style={{ width: isMobile ? 28 : 34, height: isMobile ? 28 : 34, display:"block" }} />
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          {syncing && <span style={{ fontSize:9, color:theme.textMuted }}>↑</span>}
          {user && team && (
            <div style={{ display:"flex", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:8, overflow:"hidden", fontSize:10 }}>
              <button onClick={()=>setTeamSpace(false)} style={{ padding:"5px 10px", background:!teamSpace?theme.accent:"transparent", border:"none", color:!teamSpace?"#fff":theme.textMuted, cursor:"pointer" }}>Perso</button>
              <button onClick={()=>setTeamSpace(true)}  style={{ padding:"5px 10px", background:teamSpace?theme.accent:"transparent", border:"none", color:teamSpace?"#fff":theme.textMuted, cursor:"pointer" }}>👥 {isMobile?"":team.name}</button>
            </div>
          )}
          {user && (
            <button onClick={()=>{setShowTeam(s=>!s);setShowTheme(false);setShowStats(false);}} style={{ background:showTeam?theme.accent+"33":"transparent", border:`1px solid ${showTeam?theme.accent:theme.border}`, borderRadius:8, padding:"5px 10px", color:showTeam?theme.accent:theme.textMuted, fontSize:13, cursor:"pointer", position:"relative" }}>
              👥
              {teamRole==="admin" && teamPending.length > 0 && (
                <span style={{ position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:"50%",background:"#cc3030",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px" }}>{teamPending.length}</span>
              )}
            </button>
          )}
          {user ? (
            <div style={{ position:"relative" }}>
              {showUserMenu && <div style={{ position:"fixed",inset:0,zIndex:299 }} onClick={()=>setShowUserMenu(false)}/>}
              <div onClick={()=>setShowUserMenu(s=>!s)} style={{ cursor:"pointer" }}>
                {user.photoURL
                  ? <img src={user.photoURL} alt="" style={{ width:30, height:30, borderRadius:"50%", border:`2px solid ${theme.accent}55`, display:"block" }} />
                  : <div style={{ width:30,height:30,borderRadius:"50%",background:theme.accent+"33",border:`2px solid ${theme.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:theme.accent }}>
                      {(user.displayName||user.email||"?")[0].toUpperCase()}
                    </div>
                }
              </div>
              {showUserMenu && (
                <div style={{ position:"absolute",top:"calc(100% + 8px)",right:0,background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:12,padding:8,zIndex:300,minWidth:170,boxShadow:"0 8px 40px #00000099" }}>
                  <div style={{ fontSize:11,color:theme.textMuted,padding:"6px 10px",borderBottom:`1px solid ${theme.border}44`,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160 }}>{user.displayName||user.email}</div>
                  <button onClick={logout} style={{ width:"100%",background:"transparent",border:"none",borderRadius:7,padding:"7px 10px",color:"#cc3030",fontSize:12,cursor:"pointer",textAlign:"left" }}>Se déconnecter</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ position:"relative" }}>
              {showAuthMenu && <div style={{ position:"fixed",inset:0,zIndex:299 }} onClick={()=>setShowAuthMenu(false)}/>}
              <button onClick={()=>setShowAuthMenu(s=>!s)} style={{ background:theme.accent,border:"none",borderRadius:8,padding:"6px 10px",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              </button>
              {showAuthMenu && (
                <div style={{ position:"absolute",top:"calc(100% + 8px)",right:0,background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:14,padding:14,zIndex:300,width:250,boxShadow:"0 8px 40px #00000099" }}>
                  {authInfo && (
                    <div style={{ fontSize:10,color:"#2a7a2a",marginBottom:10,padding:"6px 10px",background:"#2a7a2a22",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span>{authInfo}</span>
                      <button onClick={()=>setAuthInfo(null)} style={{ background:"transparent",border:"none",color:"#2a7a2a",cursor:"pointer",fontSize:12 }}>✕</button>
                    </div>
                  )}
                  {authError && (
                    <div style={{ fontSize:10,color:"#cc3030",marginBottom:6,padding:"6px 10px",background:"#cc303022",borderRadius:8 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <span>{authError}</span>
                        <button onClick={()=>{setAuthError(null);setUnverifiedEmail(null);}} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer",fontSize:12 }}>✕</button>
                      </div>
                      {unverifiedEmail && emailForm.password && (
                        <button onClick={resendVerification} style={{ marginTop:6,fontSize:10,color:"#cc3030",background:"transparent",border:"1px solid #cc303066",borderRadius:6,padding:"3px 8px",cursor:"pointer" }}>
                          Renvoyer l'email de vérification
                        </button>
                      )}
                    </div>
                  )}
                  {/* Google */}
                  <button onClick={loginGoogle} style={{ width:"100%",background:theme.mode==="dark"?"#1a1a2e":"#fff",border:`1px solid ${theme.border}`,borderRadius:9,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,marginBottom:7,color:theme.text,fontSize:12 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continuer avec Google
                  </button>
                  {/* Divider */}
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                    <div style={{ flex:1,height:1,background:theme.border }}/>
                    <span style={{ fontSize:10,color:theme.textMuted }}>ou</span>
                    <div style={{ flex:1,height:1,background:theme.border }}/>
                  </div>
                  {/* Email tabs */}
                  <div style={{ display:"flex",gap:4,marginBottom:8 }}>
                    {[{v:"login",l:"Connexion"},{v:"register",l:"Inscription"}].map(({v,l})=>(
                      <button key={v} onClick={()=>setEmailMode(v)} style={{ flex:1,background:emailMode===v?theme.accent+"22":"transparent",border:`1px solid ${emailMode===v?theme.accent:theme.border}`,borderRadius:7,padding:"5px",color:emailMode===v?theme.accent:theme.textMuted,fontSize:10,cursor:"pointer" }}>{l}</button>
                    ))}
                  </div>
                  <input type="email" placeholder="Email" value={emailForm.email} onChange={e=>setEmailForm(f=>({...f,email:e.target.value}))}
                    style={{ width:"100%",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:13,marginBottom:6 }} />
                  <div style={{ display:"flex",gap:6 }}>
                    <input type="password" placeholder="Mot de passe" value={emailForm.password} onChange={e=>setEmailForm(f=>({...f,password:e.target.value}))}
                      onKeyDown={e=>e.key==="Enter"&&loginEmail()}
                      style={{ flex:1,background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:13 }} />
                    <button onClick={loginEmail} style={{ background:theme.accent,border:"none",borderRadius:7,padding:"7px 12px",color:"#fff",fontSize:12,cursor:"pointer" }}>→</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button onClick={()=>{setShowStats(s=>!s);setShowTheme(false);}} style={{ background:showStats?theme.accent+"33":"transparent", border:`1px solid ${showStats?theme.accent:theme.border}`, borderRadius:8, padding:"5px 12px", color:showStats?theme.accent:theme.textMuted, fontSize:13, cursor:"pointer" }}>📊</button>
          <button onClick={()=>{setShowTheme(s=>!s);setShowStats(false);}} style={{ background:showTheme?theme.accent+"33":"transparent", border:`1px solid ${showTheme?theme.accent:theme.border}`, borderRadius:8, padding:"5px 12px", color:showTheme?theme.accent:theme.textMuted, fontSize:13, cursor:"pointer" }}>⚙️</button>
        </div>
      </div>

      {/* Ghost drag */}
      {renderGhost()}

      {/* Bannière invitation en attente */}
      {pendingInvite && (
        <div style={{ background:"#1a3a1a", borderBottom:`1px solid #2a6a2a`, padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <span style={{ fontSize:12, color:"#6bcb77" }}>📨 Invitation à rejoindre l'équipe <strong>{pendingInvite.teamName}</strong> (de {pendingInvite.invitedBy})</span>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={acceptInvite} style={{ background:"#2a7a2a", border:"none", borderRadius:7, padding:"5px 14px", color:"#fff", fontSize:11, cursor:"pointer" }}>Accepter</button>
            <button onClick={rejectInvite} style={{ background:"transparent", border:"1px solid #2a6a2a", borderRadius:7, padding:"5px 14px", color:"#6bcb77", fontSize:11, cursor:"pointer" }}>Refuser</button>
          </div>
        </div>
      )}

      {/* Split layout */}
      <div style={{ display:"flex", flex:1, flexDirection: isMobile ? "column" : "row", height:"calc(100vh - 61px)", overflow: "hidden" }}>

        {/* ── LEFT — masqué en mode équipe ── */}
        {!teamSpace && <div ref={leftRef} style={{ position: isMobile ? "sticky" : undefined, top: isMobile ? 0 : undefined, zIndex: isMobile ? 5 : undefined, background: isMobile ? theme.bgLeft : undefined, width: isMobile ? "100%" : "38%", borderRight: isMobile ? "none" : `1px solid ${theme.border}`, borderBottom: isMobile ? `1px solid ${theme.border}` : "none", display:"flex", flexDirection:"column", overflowY: isMobile ? "visible" : "auto", flexShrink:0 }}>

          {/* TODAY */}
          <div onDragOver={e=>{e.preventDefault();setDropZone("today");}} onDrop={onDropToday}
            style={{ flex:1, padding:"18px 16px", background:isOverToday?theme.accent+"22":theme.bgLeft, borderBottom:`1px solid ${theme.border}`, display:"flex", flexDirection:"column", transition:"background .2s", minHeight: isMobile ? 0 : "45%" }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontFamily:`'${theme.titleFont}',sans-serif`, fontSize:12, fontWeight:900, color:theme.accent, letterSpacing:3 }}>AUJOURD'HUI</div>
              <div style={{ fontSize:10, color:theme.textMuted, marginTop:3 }}>
                {todayIds.length===0 ? "Glisse des tâches ici" : `${todayIds.length} tâche${todayIds.length>1?"s":""}  ·  glisse pour réorganiser`}
              </div>
            </div>
            {todayIds.length===0 ? (
              <div style={{ flex:1, border:`2px dashed ${theme.border}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:5, color:theme.textMuted, fontSize:11 }}>
                <div style={{ fontSize:20 }}>←</div>
                <div>glisse ici</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignContent:"flex-start" }}>
                {todayIds.map(id => {
                  const task = getTask(id); if (!task) return null;
                  const tc   = taskColor(task);
                  const bCol = task.status==="Terminé"&&task.completion ? task.completion.color : (tc?tc.light:STATUS_DOT[task.status]);
                  return (
                    <div key={id} data-bubbleid={id} className={`bubble${isOverBubble(id)?" over":""}`}
                      draggable onDragStart={e=>onDragStart(e,id,"bubble")} onDragEnd={onDragEnd}
                      onDragOver={e=>{e.preventDefault();e.stopPropagation();setDropZone(id);}} onDrop={e=>onDropBubble(e,id)}
                      onTouchStart={e=>onTouchStart(e,id,"bubble")}
                      onClick={()=>!dragRef.current?.moved&&setModal(id)}
                      style={{ width:54,height:54,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${bCol}cc,${bCol})`,boxShadow:`0 0 16px ${bCol}55`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:`'${theme.titleFont}',sans-serif`,fontWeight:800,fontSize:16,color:"#fff",opacity:ghost?.id===id?0.2:1 }}>
                      {taskNum(id)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TOMORROW */}
          <div data-zone="tomorrow" onDragOver={e=>{e.preventDefault();setDropZone("tomorrow");}} onDrop={onDropTomorrow}
            style={{ flex:1, padding:"18px 16px", background:dropZone==="tomorrow"?theme.accent+"11":theme.bgLeft+"cc", display:"flex", flexDirection:"column", transition:"background .2s", minHeight: isMobile ? 0 : "45%" }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontFamily:`'${theme.titleFont}',sans-serif`, fontSize:12, fontWeight:900, color:theme.accent, letterSpacing:3 }}>DEMAIN</div>
              <div style={{ fontSize:10, color:theme.textMuted, marginTop:3 }}>
                {tomorrowIds.length===0 ? "Glisse des tâches ici" : `${tomorrowIds.length} tâche${tomorrowIds.length>1?"s":""}`}
              </div>
            </div>
            {tomorrowIds.length===0 ? (
              <div style={{ flex:1, border:`2px dashed ${theme.border}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:5, color:theme.textMuted, fontSize:11 }}>
                <div style={{ fontSize:20 }}>←</div>
                <div>glisse ici</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignContent:"flex-start" }}>
                {tomorrowIds.map(({id}) => {
                  const task = getTask(id); if (!task) return null;
                  const tc2  = taskColor(task);
                  const bCol2 = task.status==="Terminé"&&task.completion ? task.completion.color : (tc2?tc2.light:STATUS_DOT[task.status]);
                  return (
                    <div key={id} className="bubble" draggable
                      onDragStart={e=>onDragStart(e,id,"bubble-tomorrow")} onDragEnd={onDragEnd}
                      onTouchStart={e=>onTouchStart(e,id,"bubble-tomorrow")}
                      onClick={()=>!dragRef.current?.moved&&setModal(id)}
                      style={{ width:54,height:54,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${bCol2}55,${bCol2}77)`,boxShadow:`0 0 10px ${bCol2}33`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:`'${theme.titleFont}',sans-serif`,fontWeight:800,fontSize:16,color:"#ffffff99",opacity:ghost?.id===id?0.2:0.7,border:`2px dashed ${bCol2}66` }}>
                      {taskNum(id)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isMobile && (
            <div style={{ padding:"10px 16px 14px", display:"flex", gap:8 }}>
              <button onClick={()=>{setShowForm(true);setEditingId(null);setFormStep(1);setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none"}); setRecurDay(""); setRecurMonthDay("");}}
                style={{ flex:1,background:theme.accent,border:"none",borderRadius:8,padding:"10px 16px",color:"#fff",fontSize:12,cursor:"pointer" }}>
                + Ajouter
              </button>
              <div style={{ position:"relative" }}>
                <button onClick={listening?stopVoice:startVoice}
                  style={{ height:"100%",background:listening?"#cc3030":"transparent",border:`1px solid ${listening?"#cc3030":theme.accent+"66"}`,borderRadius:8,padding:"10px 14px",fontSize:15,cursor:"pointer",position:"relative",boxShadow:listening?"0 0 12px #cc303088":"none",transition:"all .2s" }}>
                  {listening?"⏹":"🎙️"}
                  {listening && <span style={{ position:"absolute",top:-3,right:-3,width:8,height:8,borderRadius:"50%",background:"#ff4444",animation:"pulse 1s infinite" }}/>}
                </button>
                {voiceError && (
                  <div style={{ position:"absolute",bottom:52,right:0,background:"#2a0a0a",border:"1px solid #aa3030",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#ff8080",zIndex:50,minWidth:200,whiteSpace:"normal" }}>
                    {voiceError}
                    <button onClick={()=>setVoiceError(null)} style={{ marginLeft:8,background:"transparent",border:"none",color:"#ff8080",cursor:"pointer",fontSize:11 }}>✕</button>
                  </div>
                )}
                {listening && (
                  <div style={{ position:"absolute",bottom:52,right:0,background:theme.bgCard,border:"1px solid #cc303066",borderRadius:10,padding:"8px 14px",fontSize:11,color:"#ff8080",zIndex:50,display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap" }}>
                    <span style={{ width:8,height:8,borderRadius:"50%",background:"#ff4444",display:"inline-block",animation:"pulse 1s infinite" }}/>
                    En écoute…
                  </div>
                )}
              </div>
            </div>
          )}

        </div>}{/* end LEFT */}

        {/* ── RIGHT ── */}
        <div onDragOver={e=>{e.preventDefault();setDropZone("list");}}
          style={{ flex:1, minWidth:0, padding: isMobile ? "12px 14px" : "20px 16px", overflowY:"auto", overflowX:"hidden", background:isOverList?"#0f1a0f":"transparent", transition:"background .2s" }}>

          {/* Top bar (desktop only — on mobile the button is in the left panel) */}
          <div style={{ display:"flex", alignItems:"center", marginBottom:14, gap:8, position:"sticky", top:0, zIndex:10, background:theme.bg, paddingTop:4, paddingBottom:8, width:"100%" }}>
            {!isMobile && <button onClick={()=>{setShowForm(true);setEditingId(null);setFormStep(1);setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none"}); setRecurDay(""); setRecurMonthDay("");}}
              style={{ flex:1,background:theme.accent,border:"none",borderRadius:8,padding:"9px 16px",color:"#fff",fontSize:12,cursor:"pointer" }}>
              + Ajouter
            </button>}
            {!isMobile && <div style={{ position:"relative" }}>
              <button onClick={listening?stopVoice:startVoice}
                style={{ background:listening?"#cc3030":"transparent",border:`1px solid ${listening?"#cc3030":theme.accent+"66"}`,borderRadius:8,padding:"6px 10px",fontSize:15,cursor:"pointer",position:"relative",boxShadow:listening?"0 0 12px #cc303088":"none",transition:"all .2s" }}>
                {listening?"⏹":"🎙️"}
                {listening && <span style={{ position:"absolute",top:-3,right:-3,width:8,height:8,borderRadius:"50%",background:"#ff4444",animation:"pulse 1s infinite" }}/>}
              </button>
              {voiceError && (
                <div style={{ position:"absolute",top:42,right:0,background:"#2a0a0a",border:"1px solid #aa3030",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#ff8080",zIndex:50,minWidth:200,whiteSpace:"normal" }}>
                  {voiceError}
                  <button onClick={()=>setVoiceError(null)} style={{ marginLeft:8,background:"transparent",border:"none",color:"#ff8080",cursor:"pointer",fontSize:11 }}>✕</button>
                </div>
              )}
              {listening && (
                <div style={{ position:"absolute",top:42,right:0,background:theme.bgCard,border:"1px solid #cc303066",borderRadius:10,padding:"8px 14px",fontSize:11,color:"#ff8080",zIndex:50,display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap" }}>
                  <span style={{ width:8,height:8,borderRadius:"50%",background:"#ff4444",display:"inline-block",animation:"pulse 1s infinite" }}/>
                  En écoute…
                </div>
              )}
            </div>}
          </div>

          {/* Form */}
          {showForm && (
            <div style={{ position:"fixed",inset:0,zIndex:150,background:"#000000bb",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}
              onClick={()=>{setShowForm(false);setEditingId(null);}}>
            <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:"16px",padding:20,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto" }}>

              {formStep===1 && (
                <>
                  <div style={{ fontSize:10,color:theme.accent,letterSpacing:2,marginBottom:12 }}>{editingId?"MODIFIER":"NOUVELLE TÂCHE"}</div>
                  <div style={{ display:"grid",gap:9 }}>
                    <input placeholder="Titre..." value={form.title} onChange={e=>setForm({...form,title:e.target.value})}
                      onKeyDown={e=>e.key==="Enter"&&submitForm()} autoFocus
                      style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"8px 11px",color:theme.text,fontSize:16,width:"100%" }} />
                    <div style={{ display:"grid",gridTemplateColumns:editingId!==null?"1fr 1fr 1fr":"1fr 1fr",gap:7 }}>
                      {/* Priorité custom dropdown */}
                      <div style={{ position:"relative" }}>
                          <div style={{ fontSize:9,color:theme.textMuted,marginBottom:4 }}>PRIORITÉ</div>
                          <div onClick={()=>setOpenDrop(openDrop==="priority"?null:"priority")}
                            style={{ background:theme.bg,border:`1px solid ${openDrop==="priority"?theme.accent:theme.border}`,borderRadius:6,padding:"6px 7px",color:theme.text,fontSize:11,width:"100%",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                            <span style={{ fontWeight:700 }}>{{ "Haute":"H", "Moyenne":"M", "Basse":"B" }[form.priority]}</span>
                            <span style={{ fontSize:8,color:theme.textMuted }}>▾</span>
                          </div>
                          {openDrop==="priority" && (
                            <div style={{ position:"absolute",top:"100%",left:0,right:0,background:theme.bgCard,border:`1px solid ${theme.accent}66`,borderRadius:6,zIndex:50,marginTop:2,overflow:"hidden" }}>
                              {[{v:"Haute",a:"H"},{v:"Moyenne",a:"M"},{v:"Basse",a:"B"}].map(({v,a})=>(
                                <div key={v} onClick={()=>{setForm({...form,priority:v});setOpenDrop(null);}}
                                  style={{ padding:"7px 10px",cursor:"pointer",display:"flex",gap:10,alignItems:"center",background:form.priority===v?theme.accent+"22":"transparent",borderBottom:`1px solid ${theme.border}44` }}>
                                  <span style={{ fontWeight:700,minWidth:16,color:theme.accent }}>{a}</span>
                                  <span style={{ fontSize:11,color:theme.text }}>{v}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Statut custom dropdown */}
                        <div style={{ position:"relative" }}>
                          <div style={{ fontSize:9,color:theme.textMuted,marginBottom:4 }}>STATUT</div>
                          <div onClick={()=>setOpenDrop(openDrop==="status"?null:"status")}
                            style={{ background:theme.bg,border:`1px solid ${openDrop==="status"?theme.accent:theme.border}`,borderRadius:6,padding:"6px 7px",color:theme.text,fontSize:11,width:"100%",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                            <span style={{ fontWeight:700 }}>{{ "À faire":"AF", "En cours":"EC", "Terminé":"T" }[form.status]}</span>
                            <span style={{ fontSize:8,color:theme.textMuted }}>▾</span>
                          </div>
                          {openDrop==="status" && (
                            <div style={{ position:"absolute",top:"100%",left:0,right:0,background:theme.bgCard,border:`1px solid ${theme.accent}66`,borderRadius:6,zIndex:50,marginTop:2,overflow:"hidden" }}>
                              {[{v:"À faire",a:"AF"},{v:"En cours",a:"EC"},{v:"Terminé",a:"T"}].map(({v,a})=>(
                                <div key={v} onClick={()=>{setForm({...form,status:v});setOpenDrop(null);}}
                                  style={{ padding:"7px 10px",cursor:"pointer",display:"flex",gap:10,alignItems:"center",background:form.status===v?theme.accent+"22":"transparent",borderBottom:`1px solid ${theme.border}44` }}>
                                  <span style={{ fontWeight:700,minWidth:20,color:theme.accent }}>{a}</span>
                                  <span style={{ fontSize:11,color:theme.text }}>{v}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      {editingId!==null && (
                        <div>
                          <div style={{ fontSize:9,color:theme.textMuted,marginBottom:4 }}>ÉCHÉANCE</div>
                          <input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}
                            style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,padding:"6px 7px",color:theme.text,fontSize:16,width:"100%" }} />
                        </div>
                      )}
                    </div>
                    <textarea placeholder="Notes..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}
                      style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"7px 11px",color:theme.text,fontSize:16,resize:"none",width:"100%" }} />
                    <div>
                      <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>RÉCURRENCE</div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                        {[{v:"daily",l:"Quotidien"},{v:"weekly",l:"Hebdo"}].map(({v,l})=>(
                          <button key={v} onClick={()=>setForm(f=>({...f,recurrence:f.recurrence===v?"none":v}))}
                            style={{ background:String(form.recurrence).startsWith(v)&&form.recurrence!=="none"?theme.accent+"33":"transparent",border:`1px solid ${String(form.recurrence).startsWith(v)&&form.recurrence!=="none"?theme.accent:theme.border}`,borderRadius:6,padding:"5px 10px",color:String(form.recurrence).startsWith(v)&&form.recurrence!=="none"?theme.accent:theme.textMuted,fontSize:11,cursor:"pointer" }}>
                            {l}
                          </button>
                        ))}
                        <button onClick={()=>{ if(String(form.recurrence).startsWith("monthly")){setForm(f=>({...f,recurrence:"none"}));setRecurDay("");setRecurMonthDay("");}else{setForm(f=>({...f,recurrence:"monthly-ordinal-1-1"}));setRecurMonthDay("1-1");setRecurDay("");} }}
                          style={{ background:String(form.recurrence).startsWith("monthly")&&form.recurrence!=="none"?theme.accent+"33":"transparent",border:`1px solid ${String(form.recurrence).startsWith("monthly")&&form.recurrence!=="none"?theme.accent:theme.border}`,borderRadius:6,padding:"5px 10px",color:String(form.recurrence).startsWith("monthly")&&form.recurrence!=="none"?theme.accent:theme.textMuted,fontSize:11,cursor:"pointer" }}>
                          Mensuel
                        </button>
                        {form.recurrence&&form.recurrence!=="none" && <button onClick={()=>{setForm(f=>({...f,recurrence:"none"}));setRecurDay("");setRecurMonthDay("");}} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:10,cursor:"pointer" }}>✕</button>}
                      </div>
                      {/* Hebdo : choix du jour */}
                      {String(form.recurrence).startsWith("weekly") && (
                        <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:8 }}>
                          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d,i)=>{
                            const dayVal=`weekly-${i+1}`;
                            return (
                              <button key={i} onClick={()=>setForm(f=>({...f,recurrence:dayVal}))}
                                style={{ background:form.recurrence===dayVal?theme.accent+"44":"transparent",border:`1px solid ${form.recurrence===dayVal?theme.accent:theme.border}`,borderRadius:5,padding:"4px 8px",color:form.recurrence===dayVal?theme.accent:theme.textMuted,fontSize:11,cursor:"pointer" }}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Mensuel : date du mois ET/OU Xe jour de semaine */}
                      {String(form.recurrence).startsWith("monthly") && (
                        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                            <span style={{ fontSize:10,color:theme.textMuted,minWidth:40 }}>Date</span>
                            <input type="number" min="1" max="31" placeholder="1-31" value={recurDay}
                              onChange={e=>{setRecurDay(e.target.value);setRecurMonthDay("");setForm(f=>({...f,recurrence:e.target.value?`monthly-day-${e.target.value}`:"monthly"}));}}
                              style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,padding:"5px 8px",color:theme.text,fontSize:14,width:65 }} />
                            {recurDay&&<button onClick={()=>{setRecurDay("");setForm(f=>({...f,recurrence:"monthly"}));setRecurMonthDay("");}} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:11,cursor:"pointer" }}>✕</button>}
                          </div>
                          <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                            <select value={recurMonthDay.split("-")[0]||""} onChange={e=>{const o=e.target.value,d=recurMonthDay.split("-")[1]||"1";setRecurMonthDay(o?`${o}-${d}`:"");setRecurDay("");setForm(f=>({...f,recurrence:o?`monthly-ordinal-${o}-${d}`:"monthly"}));}}
                              style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,padding:"5px 8px",color:theme.text,fontSize:12 }}>
                              <option value="">–</option>
                              {["1er","2e","3e","4e","5e"].map((l,i)=><option key={i} value={i+1}>{l}</option>)}
                            </select>
                            <select value={recurMonthDay.split("-")[1]||""} onChange={e=>{const d=e.target.value,o=recurMonthDay.split("-")[0]||"1";setRecurMonthDay(d?`${o}-${d}`:"");setRecurDay("");setForm(f=>({...f,recurrence:d?`monthly-ordinal-${o}-${d}`:"monthly"}));}}
                              style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,padding:"5px 8px",color:theme.text,fontSize:12 }}>
                              <option value="">–</option>
                              {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((l,i)=><option key={i} value={i+1}>{l}</option>)}
                            </select>
                            {recurMonthDay&&<button onClick={()=>{setRecurMonthDay("");setForm(f=>({...f,recurrence:"monthly"}));}} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:11,cursor:"pointer" }}>✕</button>}
                          </div>
                        </div>
                      )}
                    </div>
                    {recurError && (
                      <div style={{ fontSize:10,color:"#cc3030",background:"#cc303022",border:"1px solid #cc303044",borderRadius:6,padding:"6px 10px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <span>⚠ {recurError}</span>
                        <button onClick={()=>setRecurError(null)} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer",fontSize:11 }}>✕</button>
                      </div>
                    )}
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div onClick={()=>setForm(f=>({...f,notify:!f.notify}))}
                          style={{ width:32,height:18,borderRadius:9,background:form.notify?theme.accent:theme.border,position:"relative",transition:"background .2s",cursor:"pointer" }}>
                          <div style={{ position:"absolute",top:2,left:form.notify?16:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px #0006" }}/>
                        </div>
                        <span style={{ fontSize:10,color:form.notify?theme.text:theme.textMuted }}>🔔 Notifications</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",gap:7,justifyContent:"flex-end" }}>
                      <button onClick={()=>{setShowForm(false);setEditingId(null);}}
                        style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:7,padding:"5px 13px",color:theme.textMuted,fontSize:11,cursor:"pointer" }}>Annuler</button>
                      <button onClick={submitForm}
                        style={{ background:theme.accent,border:"none",borderRadius:7,padding:"5px 13px",color:"#fff",fontSize:11,cursor:"pointer" }}>{editingId?"Modifier":"Suivant →"}</button>
                    </div>
                  </div>
                </>
              )}

              {formStep===2 && (
                <>
                  <div style={{ fontSize:10,color:theme.accent,letterSpacing:2,marginBottom:4 }}>QUAND PLANIFIER ?</div>
                  <div style={{ fontSize:11,color:theme.textMuted,marginBottom:16 }}>"{pendingTask?.title}"</div>
                  <div style={{ display:"grid",gap:8 }}>
                    <button onClick={()=>applySchedule("today")} style={{ background:theme.accent+"22",border:`1px solid ${theme.accent}66`,borderRadius:10,padding:"12px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12 }}>
                      <span style={{ fontSize:20 }}>☀️</span>
                      <div>
                        <div style={{ fontSize:12,color:theme.text,fontWeight:500 }}>Aujourd'hui</div>
                        <div style={{ fontSize:10,color:theme.textMuted }}>Ajoutée dans la zone du jour</div>
                      </div>
                    </button>
                    <button onClick={()=>applySchedule("tomorrow")} style={{ background:theme.accent+"11",border:`1px solid ${theme.accent}33`,borderRadius:10,padding:"12px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12 }}>
                      <span style={{ fontSize:20 }}>🌙</span>
                      <div>
                        <div style={{ fontSize:12,color:theme.text,fontWeight:500 }}>Demain</div>
                        <div style={{ fontSize:10,color:theme.textMuted }}>Glissera automatiquement demain matin</div>
                      </div>
                    </button>
                    <div style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12 }}>
                      <span style={{ fontSize:20 }}>📅</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12,color:theme.text,fontWeight:500,marginBottom:6 }}>Choisir une date</div>
                        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                          <input type="date" value={customDate} onChange={e=>setCustomDate(e.target.value)}
                            style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,padding:"5px 8px",color:theme.text,fontSize:16,flex:1 }} />
                          <button onClick={()=>customDate&&applySchedule("date",customDate)}
                            style={{ background:customDate?theme.accent:"#333",border:"none",borderRadius:6,padding:"5px 10px",color:"#fff",fontSize:11,cursor:customDate?"pointer":"default" }}>OK</button>
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>applySchedule("none")} style={{ background:"transparent",border:`1px solid ${theme.border}44`,borderRadius:10,padding:"12px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12 }}>
                      <span style={{ fontSize:20 }}>📋</span>
                      <div>
                        <div style={{ fontSize:12,color:theme.textMuted,fontWeight:500 }}>Ne pas planifier</div>
                        <div style={{ fontSize:10,color:theme.textMuted }}>Reste en attente dans la liste</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

            </div>
            </div>
          )}

          {/* ── ESPACE ÉQUIPE ── */}
          {teamSpace && team && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8 }}>
                <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>TÂCHES — {team.name.toUpperCase()}</div>
                <div style={{ display:"flex",gap:8 }}>
                  {teamRole==="admin" && teamPending.length > 0 && (
                    <button onClick={()=>setShowPendingPanel(true)} style={{ background:"#cc303022",border:"1px solid #cc303066",borderRadius:8,padding:"5px 12px",color:"#cc3030",fontSize:11,cursor:"pointer",fontWeight:700 }}>
                      🔔 {teamPending.length} en attente
                    </button>
                  )}
                  {teamRole==="admin" && (
                    <button onClick={()=>{setShowForm(true);setEditingId(null);setFormStep(1);setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none"});setRecurDay("");setRecurMonthDay("");}}
                      style={{ background:theme.accent,border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontSize:11,cursor:"pointer" }}>
                      + Ajouter
                    </button>
                  )}
                </div>
              </div>
              {teamError && <div style={{ fontSize:10,color:"#cc3030",background:"#cc303022",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamError}</span><button onClick={()=>setTeamError(null)} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer" }}>✕</button></div>}
              {teamInfo  && <div style={{ fontSize:10,color:"#3aaa3a",background:"#3aaa3a22",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamInfo}</span><button onClick={()=>setTeamInfo(null)} style={{ background:"transparent",border:"none",color:"#3aaa3a",cursor:"pointer" }}>✕</button></div>}
              {teamTasks.length === 0 && <div style={{ color:theme.textMuted,fontSize:12,textAlign:"center",padding:30 }}>{teamRole==="admin"?"Aucune tâche — créez la première ci-dessus.":"Aucune tâche pour l'instant."}</div>}
              <div style={{ display:"grid",gap:5 }}>
                {teamTasks.map(task => {
                  const tc  = taskColor(task);
                  const bgC = tc ? tc.base+"33" : theme.bgCard;
                  const bdC = tc ? `1px solid ${tc.light}66` : `1px solid ${theme.border}`;
                  const blC = tc ? `3px solid ${tc.light}` : `1px solid ${theme.border}`;
                  const dot = STATUS_DOT[task.status]||"#888";
                  return (
                    <div key={task.id} className="row"
                      onClick={()=>setTeamModal(task.id)}
                      style={{ background:bgC,border:bdC,borderLeft:blC,borderRadius:9,padding:"10px 13px",display:"flex",alignItems:"center",gap:9,cursor:"pointer",transition:"background .15s" }}>
                      <div style={{ fontSize:10,color:theme.textMuted,fontFamily:"'Syne',sans-serif",fontWeight:700,minWidth:22,textAlign:"right" }}>#{task.num}</div>
                      <button onClick={e=>{e.stopPropagation();}} style={{ width:11,height:11,borderRadius:"50%",background:dot,border:"none",cursor:"default",flexShrink:0,boxShadow:`0 0 5px ${dot}99` }}/>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
                          <span style={{ fontSize:12,color:task.status==="Terminé"?theme.textMuted:theme.text,textDecoration:task.status==="Terminé"?"line-through":"none" }}>{task.title}</span>
                          <span style={{ fontSize:9,padding:"1px 5px",borderRadius:3,background:(PRIO_COLOR[task.priority]||"#888")+"22",color:PRIO_COLOR[task.priority]||"#888",border:`1px solid ${(PRIO_COLOR[task.priority]||"#888")}44` }}>{(task.priority||"?").toUpperCase()}</span>
                          <span style={{ fontSize:9,padding:"1px 5px",borderRadius:3,background:STATUS_DOT[task.status]+"22",color:STATUS_DOT[task.status] }}>{task.status}</span>
                        </div>
                        {task.due && <div style={{ fontSize:9,color:theme.accent+"aa",marginTop:2 }}>📅 {formatDate(task.due)}</div>}
                        {task.scheduledFor && task.scheduledFor !== null && (
                          <div style={{ fontSize:9,color:theme.accent,marginTop:2 }}>
                            {task.scheduledFor==="today"?"☀️ Aujourd'hui":task.scheduledFor==="tomorrow"?"🌙 Demain":"📅 "+formatDate(task.scheduledFor)}
                          </div>
                        )}
                        {task.notes && <div style={{ fontSize:9,color:theme.textMuted,marginTop:1 }}>{task.notes}</div>}
                        <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:2 }}>
                          <span style={{ fontSize:9,color:theme.textMuted+"88" }}>par {task.createdByEmail||team.adminEmail}</span>
                          <span style={{ fontSize:9,color:theme.textMuted }}>💬 commentaires</span>
                        </div>
                      </div>
                      <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                        {teamRole==="member" && <span style={{ fontSize:9,color:theme.textMuted,padding:"2px 6px",border:`1px solid ${theme.border}`,borderRadius:5 }}>proposer</span>}
                        <button className="delbtn" onClick={e=>{e.stopPropagation();deleteTeamTask(task.id);}}
                          style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:isMobile?"6px 10px":"2px 7px",color:"#aa3030",fontSize:isMobile?14:10,cursor:"pointer" }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sort bar + Task rows — espace perso uniquement */}
          {!teamSpace && (<>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:9,color:theme.textMuted,letterSpacing:1 }}>TRIER :</span>
            {[{v:"added",l:"Ajout"},{v:"priority",l:"Priorité"},{v:"due",l:"Échéance"},{v:"delay",l:"Retard"},{v:"status",l:"Statut"}].map(({v,l})=>(
              <button key={v} onClick={()=>{ if(sortBy===v){setSortDir(d=>d==="asc"?"desc":"asc");}else{setSortBy(v);setSortDir("asc");} }}
                style={{ background:sortBy===v?theme.accent+"33":"transparent",border:`1px solid ${sortBy===v?theme.accent:theme.border}`,borderRadius:5,padding:"3px 8px",color:sortBy===v?theme.accent:theme.textMuted,fontSize:10,cursor:"pointer" }}>
                {l}{sortBy===v?(sortDir==="asc"?" ↑":" ↓"):""}
              </button>
            ))}
            {sortBy && <button onClick={()=>setSortBy(null)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:10,cursor:"pointer" }}>✕</button>}
          </div>

          <div style={{ display:"grid", gap:5 }}>
            {(() => {
              const PRIO_ORDER = { "Haute":0, "Moyenne":1, "Basse":2 };
              const STATUS_ORDER = { "En cours":0, "À faire":1, "Terminé":2 };
              const today = todayStr();
              let visible = tasks.filter(t => t.status !== "Terminé");
              if (sortBy) {
                visible = [...visible].sort((a,b) => {
                  let va, vb;
                  if (sortBy==="added")    { va=tasks.indexOf(a); vb=tasks.indexOf(b); }
                  if (sortBy==="priority") { va=PRIO_ORDER[a.priority]??9; vb=PRIO_ORDER[b.priority]??9; }
                  if (sortBy==="due") {
                    const getEff = t => t.due ? t.due : (todayIds.includes(t.id)?today:(tomorrowIds.find(e=>e.id===t.id)?"9999-12-31":"9999-12-32"));
                    va=getEff(a); vb=getEff(b);
                  }
                  if (sortBy==="delay") {
                    va=a.due&&a.due<today?(new Date(today)-new Date(a.due)):0;
                    vb=b.due&&b.due<today?(new Date(today)-new Date(b.due)):0;
                  }
                  if (sortBy==="status") { va=STATUS_ORDER[a.status]??9; vb=STATUS_ORDER[b.status]??9; }
                  return sortDir==="asc" ? (va>vb?1:va<vb?-1:0) : (va<vb?1:va>vb?-1:0);
                });
              }
              return visible;
            })().map((task, idx) => {
              const inToday = todayIds.includes(task.id);
              const inTom   = tomorrowIds.map(e=>e.id).includes(task.id);
              const hl      = isHL(task.id);
              const dot     = STATUS_DOT[task.status];
              const isGhost = ghost?.id===task.id;
              const tc      = taskColor(task);
              const bgC = task.status==="Terminé"&&task.completion ? task.completion.color+"22" : (tc?tc.base+"33":hl?theme.accent+"22":theme.bgCard);
              const bdC = task.status==="Terminé"&&task.completion ? `1px solid ${task.completion.color}55` : (tc?`1px solid ${tc.light}66`:hl?`1px solid ${theme.accent}66`:`1px solid ${theme.border}`);
              const blC = task.status==="Terminé"&&task.completion ? `3px solid ${task.completion.color}` : (tc?`3px solid ${tc.light}`:hl?`3px solid ${theme.accent}`:`1px solid ${theme.border}`);
              return (
                <div key={task.id} className="row"
                  draggable={!inToday&&!inTom}
                  onDragStart={e=>!inToday&&!inTom&&onDragStart(e,task.id,"list")}
                  onDragEnd={onDragEnd}
                  onTouchStart={e=>!inToday&&!inTom&&onTouchStart(e,task.id,"list")}
                  onClick={()=>!dragRef.current?.moved&&openEdit(task)}
                  style={{ background:bgC,border:bdC,borderLeft:blC,borderRadius:9,padding:"10px 13px",display:"flex",alignItems:"center",gap:9,opacity:isGhost?0.3:1,cursor:"pointer",transition:"background .15s, border .15s",touchAction:(inToday||inTom)?"auto":"pan-y" }}>
                  <div style={{ fontSize:10,color:hl?theme.accent:theme.textMuted,fontFamily:"'Syne',sans-serif",fontWeight:700,minWidth:22,textAlign:"right" }}>#{taskNum(task.id)}</div>
                  <button onClick={e=>{e.stopPropagation();cycleStatus(task.id);}} style={{ width:11,height:11,borderRadius:"50%",background:dot,border:"none",cursor:"pointer",flexShrink:0,boxShadow:`0 0 5px ${dot}99` }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
                      <span style={{ fontSize:12,color:task.status==="Terminé"?theme.textMuted:hl?theme.accent+"cc":theme.text,textDecoration:task.status==="Terminé"?"line-through":"none" }}>
                        {task.title}
                      </span>
                      <span style={{ fontSize:9,padding:"1px 5px",borderRadius:3,background:(PRIO_COLOR[task.priority]||"#888888")+"22",color:PRIO_COLOR[task.priority]||"#888888",border:`1px solid ${(PRIO_COLOR[task.priority]||"#888888")}44` }}>
                        {(task.priority||"?").toUpperCase()}
                      </span>
                      {inToday && <span style={{ fontSize:9,color:theme.accent,padding:"1px 5px",background:theme.accent+"22",borderRadius:3 }}>● aujourd'hui</span>}
                      {inTom   && <span style={{ fontSize:9,color:theme.accent+"88",padding:"1px 5px",background:theme.accent+"11",borderRadius:3 }}>○ demain</span>}
                      {task.recurrence&&task.recurrence!=="none" && <span style={{ fontSize:9,color:"#ccaa00",padding:"1px 5px",background:"#ccaa0022",borderRadius:3 }}>🔁 {(()=>{const r=task.recurrence;if(r==="daily")return"quotidien";if(r==="monthly")return"mensuel";if(r==="weekly")return"hebdo";if(/^weekly-\d+$/.test(r))return["","Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][parseInt(r.split("-")[1])]||"hebdo";if(r.startsWith("monthly-day-"))return"le "+r.split("-")[2]+"/mois";if(r.startsWith("monthly-ordinal-")){const p=r.split("-");return["","1er","2e","3e","4e","5e"][p[2]]+" "+["","Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][p[3]];}return r;})()}</span>}
                    </div>
                    {task.status==="Terminé"&&task.completion ? (
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap" }}>
                        <span style={{ fontSize:11 }}>🏆</span>
                        <span style={{ fontSize:9,color:task.completion.color,fontWeight:600 }}>
                          {task.completion.doneAt
                            ? new Date(task.completion.doneAt).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})
                            : task.completion.doneDate}
                        </span>
                        {task.completion.deltaLabel && (
                          <span style={{ fontSize:9,fontWeight:700,color:task.completion.deltaMin<0?"#3aaa3a":"#cc3030",background:task.completion.deltaMin<0?"#3aaa3a22":"#cc303022",padding:"1px 5px",borderRadius:3 }}>
                            {task.completion.deltaMin<0?"⚡ ":"⚠ "}{task.completion.deltaLabel}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap" }}>
                        {task.due && (
                          <>
                            <span style={{ fontSize:9,color:theme.accent+"aa" }}>📅 {formatDate(task.due)}</span>
                            <button onClick={e=>{e.stopPropagation();setTasks(p=>p.map(t=>t.id===task.id?{...t,due:""}:t));}}
                              style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:9,cursor:"pointer",padding:"0 2px",lineHeight:1 }}>✕</button>
                          </>
                        )}
                        <span onClick={e=>{e.stopPropagation();setTasks(p=>p.map(t=>t.id===task.id?{...t,notify:t.notify===false}:t));}}
                          style={{ fontSize:10,cursor:"pointer",opacity:task.notify!==false?1:0.4 }}>
                          {task.notify!==false?"🔔":"🔕"}
                        </span>
                      </div>
                    )}
                    {task.notes && <div style={{ fontSize:9,color:theme.textMuted,marginTop:1 }}>{task.notes}</div>}
                  </div>
                  <div style={{ display:"flex",gap:isMobile?6:4,flexShrink:0 }}>
                    <button title="Dupliquer" onClick={e=>{e.stopPropagation();duplicateTask(task);}} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:isMobile?"6px 10px":"2px 7px",color:theme.textMuted,fontSize:isMobile?14:10,cursor:"pointer" }}>⧉</button>
                    {task.due && <button title="Ajouter à l'agenda" onClick={e=>{e.stopPropagation();exportIcs(task);}} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:isMobile?"6px 10px":"2px 7px",color:theme.textMuted,fontSize:isMobile?14:10,cursor:"pointer" }}>📅</button>}
                    <button className="delbtn" onClick={e=>{e.stopPropagation();deleteTask(task.id);}} style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:isMobile?"6px 10px":"2px 7px",color:"#aa3030",fontSize:isMobile?14:10,cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              );
            })}
            </div>
          </>)}

        </div>{/* end RIGHT */}

      </div>{/* end split */}

      {/* Modal perso */}
      {renderModal()}

      {/* Modal équipe + commentaires */}
      {renderTeamModal()}

      {/* Stats */}
      {showStats && (
        <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:70,paddingRight:16 }}
          onClick={()=>setShowStats(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.mode==="dark"?"#12122a":theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:320,boxShadow:"0 8px 40px #00000099",maxHeight:"80vh",overflowY:"auto" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:team?12:20 }}>STATISTIQUES</div>
            {team && (
              <div style={{ display:"flex",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:8,overflow:"hidden",fontSize:10,marginBottom:20 }}>
                <button onClick={()=>setStatsView("perso")} style={{ flex:1,padding:"6px 10px",background:statsView==="perso"?theme.accent:"transparent",border:"none",color:statsView==="perso"?"#fff":theme.textMuted,cursor:"pointer" }}>Mes tâches</button>
                <button onClick={()=>setStatsView("team")}  style={{ flex:1,padding:"6px 10px",background:statsView==="team"?theme.accent:"transparent",border:"none",color:statsView==="team"?"#fff":theme.textMuted,cursor:"pointer" }}>👥 {team.name}</button>
              </div>
            )}
            {(!team || statsView === "perso") ? renderStats() : renderTeamStats()}
          </div>
        </div>
      )}

      {/* Tâches terminées */}
      {showDone && (
        <div style={{ position:"fixed",inset:0,zIndex:250,background:"#000000bb",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:60,padding:"60px 16px 16px" }}
          onClick={()=>setShowDone(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:20,width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>TÂCHES TERMINÉES</div>
              <button onClick={()=>setShowDone(false)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer" }}>✕</button>
            </div>
            {[...tasks.filter(t=>t.status==="Terminé")].sort((a,b)=>tasks.indexOf(a)-tasks.indexOf(b)).map(t=>(
              <div key={t.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${theme.border}44` }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,color:theme.textMuted,textDecoration:"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>#{taskNum(t.id)} {t.title}</div>
                  {t.completion && (
                    <div style={{ fontSize:9,color:theme.textMuted,marginTop:2 }}>
                      🏆 {t.completion.doneDate}
                      {t.completion.deltaLabel && <span style={{ marginLeft:6,color:t.completion.deltaMin<0?"#3aaa3a":"#cc3030" }}>{t.completion.deltaMin<0?"⚡ ":"⚠ "}{t.completion.deltaLabel}</span>}
                    </div>
                  )}
                </div>
                <button onClick={()=>{
                  if (t.num != null) {
                    setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"À faire",completion:null}:x));
                  } else {
                    setTaskCounter(c => {
                      const n = c + 1;
                      setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"À faire",completion:null,num:n}:x));
                      return n;
                    });
                  }
                }} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:"3px 8px",color:theme.textMuted,fontSize:10,cursor:"pointer",marginLeft:10,flexShrink:0 }}>↩</button>
              </div>
            ))}
            {tasks.filter(t=>t.status==="Terminé").length===0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"20px 0" }}>Aucune tâche terminée</div>}
          </div>
        </div>
      )}

      {/* Theme */}
      {showTheme && (
        <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:70,paddingRight:16 }}
          onClick={()=>setShowTheme(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#12122a",border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:280,boxShadow:"0 8px 40px #00000099",maxHeight:"80vh",overflowY:"auto" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:16 }}>APPARENCE</div>

            <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>MODE</div>
            <div style={{ display:"flex",gap:8,marginBottom:18 }}>
              {["dark","light"].map(m=>(
                <button key={m} onClick={()=>{ const p=PRESETS[m][0]; setTheme(t=>({...t,mode:m,bg:p.bg,bgLeft:p.bgLeft,bgCard:p.bgCard,accent:p.accent,text:p.text,textMuted:p.textMuted,border:p.border})); }}
                  style={{ flex:1,background:theme.mode===m?theme.accent:"transparent",border:`1px solid ${theme.accent}66`,borderRadius:8,padding:"7px",color:theme.mode===m?"#fff":theme.textMuted,fontSize:11,cursor:"pointer" }}>
                  {m==="dark"?"🌙 Sombre":"☀️ Clair"}
                </button>
              ))}
            </div>

            <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>PALETTE</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:18 }}>
              {PRESETS[theme.mode].map(p=>(
                <button key={p.name} onClick={()=>setTheme(t=>({...t,...p,font:t.font,titleFont:t.titleFont,mode:t.mode}))}
                  style={{ background:p.bg,border:`2px solid ${theme.bg===p.bg?theme.accent:"transparent"}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",color:theme.bg===p.bg?theme.accent:theme.textMuted,fontSize:11,display:"flex",alignItems:"center",gap:6 }}>
                  <span style={{ width:8,height:8,borderRadius:"50%",background:p.accent,display:"inline-block" }}/>
                  {p.name}
                </button>
              ))}
            </div>

            <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>ACCENT</div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
              <input type="color" value={theme.accent} onChange={e=>setTheme(t=>({...t,accent:e.target.value}))}
                style={{ width:40,height:32,border:"none",borderRadius:6,cursor:"pointer" }} />
              <span style={{ fontSize:11,color:"#666688" }}>{theme.accent}</span>
            </div>

            <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>POLICE TEXTE</div>
            <div style={{ display:"grid",gap:5,marginBottom:18 }}>
              {FONTS.map(f=>(
                <button key={f.value} onClick={()=>setTheme(t=>({...t,font:f.value}))}
                  style={{ background:theme.font===f.value?theme.accent+"33":"transparent",border:`1px solid ${theme.font===f.value?theme.accent:"#2a2a5a"}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",color:theme.font===f.value?"#fff":"#666688",fontSize:12,fontFamily:`'${f.value}',monospace`,textAlign:"left" }}>
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>POLICE TITRE</div>
            <div style={{ display:"grid",gap:5,marginBottom:18 }}>
              {TITLE_FONTS.map(f=>(
                <button key={f.value} onClick={()=>setTheme(t=>({...t,titleFont:f.value}))}
                  style={{ background:theme.titleFont===f.value?theme.accent+"33":"transparent",border:`1px solid ${theme.titleFont===f.value?theme.accent:"#2a2a5a"}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",color:theme.titleFont===f.value?"#fff":"#666688",fontSize:14,fontFamily:`'${f.value}',sans-serif`,textAlign:"left",fontWeight:700 }}>
                  {f.label}
                </button>
              ))}
            </div>


            <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>LANGUE / FORMAT DATE</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:18 }}>
              {[{v:"fr-FR",l:"Français"},{v:"en-US",l:"English (US)"},{v:"en-GB",l:"English (UK)"},{v:"de-DE",l:"Deutsch"},{v:"es-ES",l:"Español"},{v:"it-IT",l:"Italiano"}].map(({v,l})=>(
                <button key={v} onClick={()=>setLocale(v)} style={{ background:locale===v?theme.accent+"33":"transparent",border:`1px solid ${locale===v?theme.accent:"#2a2a5a"}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",color:locale===v?"#fff":"#666688",fontSize:10 }}>{l}</button>
              ))}
            </div>

            <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>RAPPEL QUOTIDIEN</div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <span style={{ fontSize:11,color:theme.textMuted }}>Activé</span>
              <div onClick={()=>setDailyNotifEnabled(v=>!v)} style={{ width:32,height:18,borderRadius:9,background:dailyNotifEnabled?theme.accent:theme.border,position:"relative",transition:"background .2s",cursor:"pointer" }}>
                <div style={{ position:"absolute",top:2,left:dailyNotifEnabled?16:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px #0006" }}/>
              </div>
            </div>
            {dailyNotifEnabled && (
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
                <span style={{ fontSize:11,color:theme.textMuted }}>Heure</span>
                <input type="time" value={dailyNotifTime} onChange={e=>setDailyNotifTime(e.target.value)} style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"4px 8px",color:theme.text,fontSize:11,outline:"none" }}/>
              </div>
            )}
            {!dailyNotifEnabled && <div style={{ marginBottom:18 }}/>}

            <button onClick={async()=>{
              if(!user){alert("Connecte-toi pour sauvegarder le thème.");return;}
              const ref=doc(db,"users",user.uid);
              await setDoc(ref,{theme},{merge:true});
              alert("Thème sauvegardé ✓");
            }} style={{ width:"100%",background:theme.accent,border:"none",borderRadius:8,padding:"9px",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700,marginBottom:8 }}>
              💾 Sauvegarder le thème
            </button>

            <button onClick={async()=>{
              if(!window.confirm("Effacer TOUTES les tâches et réinitialiser l'appli ? Cette action est irréversible.")) return;
              ["tt_tasks","tt_todayIds","tt_todayDates","tt_tomorrowIds","tt_scheduledIds","tt_highlighted","tt_numMode","tt_counter"].forEach(k=>localStorage.removeItem(k));
              if(user){ try{ await setDoc(doc(db,"users",user.uid),{tasks:[],todayIds:[],todayDates:[],tomorrowIds:[],scheduledIds:[],highlighted:[],taskCounter:0},{merge:false}); }catch(e){} }
              window.location.reload();
            }} style={{ width:"100%",background:"transparent",border:"1px solid #5a1a1a",borderRadius:8,padding:"9px",color:"#aa3030",fontSize:11,cursor:"pointer",fontWeight:700,marginBottom:8 }}>
              🗑️ Réinitialiser toutes les données
            </button>

          </div>
        </div>
      )}

      {/* Panneau changements en attente */}
      {showPendingPanel && teamRole==="admin" && (
        <div style={{ position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",background:"#00000088" }}
          onClick={()=>setShowPendingPanel(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#12122a",border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:340,maxHeight:"75vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:16 }}>MODIFICATIONS EN ATTENTE</div>
            {teamPending.length===0 && <div style={{ color:theme.textMuted,fontSize:12,textAlign:"center",padding:20 }}>Aucune modification en attente.</div>}
            {teamPending.map(change => {
              const task = teamTasks.find(t=>t.id===change.taskId);
              return (
                <div key={change.id} style={{ background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginBottom:10 }}>
                  <div style={{ fontSize:10,color:theme.textMuted,marginBottom:6 }}>
                    {change.type==="edit"?"✏️ Modification":"🗑️ Suppression"} · <strong style={{ color:theme.text }}>{change.proposedByEmail}</strong>
                  </div>
                  <div style={{ fontSize:11,color:theme.text,marginBottom:4 }}>
                    Tâche : <strong>{change.type==="delete" ? (task?.title||"#"+change.taskId) : change.data?.title}</strong>
                  </div>
                  {change.type==="edit" && change.data && (
                    <div style={{ fontSize:10,color:theme.textMuted,marginBottom:8 }}>
                      {change.data.priority && <span style={{ marginRight:8 }}>Priorité : {change.data.priority}</span>}
                      {change.data.status   && <span style={{ marginRight:8 }}>Statut : {change.data.status}</span>}
                      {change.data.due      && <span>Échéance : {formatDate(change.data.due)}</span>}
                      {change.data.notes    && <div style={{ marginTop:4,fontStyle:"italic" }}>Notes : {change.data.notes}</div>}
                    </div>
                  )}
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>approveChange(change)} style={{ flex:1,background:"#2a7a2a",border:"none",borderRadius:7,padding:"7px",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700 }}>✓ Approuver</button>
                    <button onClick={()=>rejectChange(change.id)} style={{ flex:1,background:"transparent",border:"1px solid #5a1a1a",borderRadius:7,padding:"7px",color:"#cc3030",fontSize:11,cursor:"pointer" }}>✕ Refuser</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Panneau Équipe */}
      {showTeam && (
        <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:70,paddingRight:16 }}
          onClick={()=>setShowTeam(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#12122a",border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:300,boxShadow:"0 8px 40px #00000099",maxHeight:"80vh",overflowY:"auto" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:16 }}>ÉQUIPE</div>

            {teamError && <div style={{ fontSize:10,color:"#cc3030",background:"#cc303022",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamError}</span><button onClick={()=>setTeamError(null)} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer" }}>✕</button></div>}
            {teamInfo  && <div style={{ fontSize:10,color:"#3aaa3a",background:"#3aaa3a22",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamInfo}</span><button onClick={()=>setTeamInfo(null)} style={{ background:"transparent",border:"none",color:"#3aaa3a",cursor:"pointer" }}>✕</button></div>}

            {!team ? (
              /* Pas encore dans une équipe → créer */
              <>
                <div style={{ fontSize:9,color:"#444466",marginBottom:6,letterSpacing:1 }}>CRÉER UNE ÉQUIPE</div>
                <input value={teamForm.name} onChange={e=>setTeamForm({name:e.target.value})} placeholder="Nom de l'équipe"
                  onKeyDown={e=>e.key==="Enter"&&createTeam()}
                  style={{ width:"100%",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:8,padding:"8px 12px",color:theme.text,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:10 }}/>
                <button onClick={createTeam} style={{ width:"100%",background:theme.accent,border:"none",borderRadius:8,padding:"9px",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700 }}>Créer</button>
              </>
            ) : (
              /* Dans une équipe */
              <>
                <div style={{ fontSize:13,fontWeight:700,color:theme.text,marginBottom:4 }}>{team.name}</div>
                <div style={{ fontSize:10,color:theme.textMuted,marginBottom:16 }}>
                  {teamRole==="admin" ? "👑 Vous êtes admin" : `Admin : ${team.adminEmail}`}
                </div>

                {/* Membres */}
                <div style={{ fontSize:9,color:"#444466",marginBottom:8,letterSpacing:1 }}>MEMBRES ({team.members?.length||0})</div>
                {(team.members||[]).length === 0 && <div style={{ fontSize:11,color:theme.textMuted,marginBottom:12 }}>Aucun membre pour l'instant.</div>}
                {(team.members||[]).map(m => (
                  <div key={m.uid} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",background:theme.bg,borderRadius:8,marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:11,color:theme.text }}>{m.displayName}</div>
                      <div style={{ fontSize:9,color:theme.textMuted }}>{m.email}</div>
                    </div>
                    {teamRole==="admin" && (
                      <button onClick={()=>{ if(window.confirm(`Retirer ${m.email} ?`)) removeMember(m); }}
                        style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:6,padding:"3px 8px",color:"#cc3030",fontSize:10,cursor:"pointer" }}>Retirer</button>
                    )}
                  </div>
                ))}

                {/* Stats membres (admin seulement) */}
                {teamRole==="admin" && (team.members||[]).length > 0 && (
                  <>
                    <div style={{ fontSize:9,color:"#444466",marginBottom:8,marginTop:8,letterSpacing:1 }}>STATS MEMBRES</div>
                    {(team.members||[]).map(m => (
                      <MemberStats key={m.uid} member={m} teamId={team.id} db={db} theme={theme} />
                    ))}
                  </>
                )}

                {/* Inviter (admin seulement) */}
                {teamRole==="admin" && (
                  <>
                    <div style={{ fontSize:9,color:"#444466",marginBottom:6,marginTop:8,letterSpacing:1 }}>INVITER PAR EMAIL</div>
                    <div style={{ display:"flex",gap:6,marginBottom:16 }}>
                      <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="email@exemple.com"
                        onKeyDown={e=>e.key==="Enter"&&inviteMember()}
                        style={{ flex:1,background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:8,padding:"7px 10px",color:theme.text,fontSize:11,outline:"none" }}/>
                      <button onClick={inviteMember} style={{ background:theme.accent,border:"none",borderRadius:8,padding:"7px 12px",color:"#fff",fontSize:11,cursor:"pointer" }}>Envoyer</button>
                    </div>
                  </>
                )}

                <div style={{ borderTop:`1px solid ${theme.border}44`,paddingTop:12,display:"flex",gap:8,flexDirection:"column" }}>
                  {teamRole==="member" && (
                    <button onClick={leaveTeam} style={{ width:"100%",background:"transparent",border:"1px solid #5a3a1a",borderRadius:8,padding:"8px",color:"#cc7700",fontSize:11,cursor:"pointer" }}>Quitter l'équipe</button>
                  )}
                  {teamRole==="admin" && (
                    <button onClick={dissolveTeam} style={{ width:"100%",background:"transparent",border:"1px solid #5a1a1a",borderRadius:8,padding:"8px",color:"#cc3030",fontSize:11,cursor:"pointer" }}>Dissoudre l'équipe</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Quick Add depuis notif */}
      {showQuickAdd && (
        <div style={{ position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",background:"#00000088" }}
          onClick={()=>setShowQuickAdd(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:290,boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:14 }}>➕ AJOUTER RAPIDEMENT</div>
            <input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} placeholder="Titre de la tâche…"
              autoFocus onKeyDown={e=>e.key==="Enter"&&submitQuickAdd()}
              style={{ width:"100%",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:8,padding:"9px 12px",color:theme.text,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:10 }}/>
            <div style={{ display:"flex",gap:6,marginBottom:14 }}>
              {PRIORITIES.map(p=>(
                <button key={p} onClick={()=>setQuickPriority(p)}
                  style={{ flex:1,background:quickPriority===p?PRIO_COLOR[p]+"33":"transparent",border:`1px solid ${quickPriority===p?PRIO_COLOR[p]:theme.border}`,borderRadius:7,padding:"5px",color:quickPriority===p?PRIO_COLOR[p]:theme.textMuted,fontSize:10,cursor:"pointer" }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setShowQuickAdd(false)} style={{ flex:1,background:"transparent",border:`1px solid ${theme.border}`,borderRadius:8,padding:"9px",color:theme.textMuted,fontSize:11,cursor:"pointer" }}>Annuler</button>
              <button onClick={submitQuickAdd} style={{ flex:2,background:theme.accent,border:"none",borderRadius:8,padding:"9px",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700 }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Bandeau publicitaire AdSense */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:theme.mode==="dark"?"#0a0a18":"#f0f0ea", borderTop:`1px solid ${theme.border}`, display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, minHeight:56 }}>
        <AdBanner />
      </div>

      {/* Spacer pour le bandeau pub */}
      <div style={{ height:56 }} />

    </div>
  );
}
