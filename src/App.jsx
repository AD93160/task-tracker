import { useState, useRef, useEffect, useMemo, Component } from "react";
import { auth, provider, db, storage, getMessagingInstance } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import TeamChat from "./TeamChat";
import { doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, query, where, getDocs, writeBatch } from "firebase/firestore";

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

function MemberStats({ member, teamTasks, theme }) {
  const mt     = (teamTasks || []).filter(t => t.createdBy === member.uid);
  const total  = mt.length;
  const done   = mt.filter(t => t.status === "Terminé").length;
  const active = mt.filter(t => t.status !== "Terminé").length;
  return (
    <div style={{ background:theme.bg, borderRadius:8, padding:"8px 12px", marginBottom:6 }}>
      <div style={{ fontSize:11, color:theme.text, fontWeight:600, marginBottom:4 }}>{member.displayName || member.email}</div>
      {total === 0 ? (
        <div style={{ fontSize:10, color:theme.textMuted }}>Aucune tâche créée dans l'équipe</div>
      ) : (
        <div style={{ display:"flex", gap:12, fontSize:10, color:theme.textMuted }}>
          <span>📋 {total} tâche{total>1?"s":""}</span>
          <span style={{ color:"#6bcb77" }}>✓ {done} terminée{done>1?"s":""}</span>
          <span style={{ color:theme.accent }}>⏳ {active} active{active>1?"s":""}</span>
        </div>
      )}
    </div>
  );
}

function TeamPanel({ allUserTeams, activeTeamId, teamPending, teamTasks, theme, isMobile, onClose, onActivateTeam, onCreateTeam, onInvite, onRemoveMember, onPromote, onDemote, isOwner, onDissolve, onRenameTeam, teamError, teamInfo, setTeamError, setTeamInfo }) {
  const [view,         setView]        = useState("list"); // "list" | "detail" | "create"
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamName,     setTeamName]    = useState("");
  const [invite,       setInvite]      = useState("");
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [newTeamNameVal,  setNewTeamNameVal]  = useState("");

  const bg   = theme.mode === "dark" ? "#12122a" : theme.bgCard;
  const w    = isMobile ? Math.min(360, window.innerWidth - 16) : 380;
  // sel se met à jour automatiquement quand allUserTeams change (plus de snapshot figé)
  const sel  = allUserTeams.find(t => t.id === selectedTeamId) || null;

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:70,paddingRight:isMobile?8:16 }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:bg,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:20,width:w,boxShadow:"0 8px 40px #00000099",maxHeight:"75vh",overflowY:"auto" }}>

        {teamError && <div style={{ fontSize:10,color:"#cc3030",background:"#cc303022",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamError}</span><button onClick={()=>setTeamError(null)} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer" }}>✕</button></div>}
        {teamInfo  && <div style={{ fontSize:10,color:"#3aaa3a",background:"#3aaa3a22",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamInfo}</span><button onClick={()=>setTeamInfo(null)} style={{ background:"transparent",border:"none",color:"#3aaa3a",cursor:"pointer" }}>✕</button></div>}

        {/* ── VUE LISTE ── */}
        {view === "list" && (
          <>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
              <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>MES ÉQUIPES</div>
              <button onClick={()=>{setTeamName("");setView("create");}} style={{ background:theme.accent,border:"none",borderRadius:7,padding:"4px 10px",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700 }}>+ Nouvelle</button>
            </div>
            {allUserTeams.length === 0 ? (
              <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"20px 0" }}>
                Aucune équipe pour l'instant.<br/>
                <span style={{ fontSize:10,color:theme.accent,cursor:"pointer" }} onClick={()=>{setTeamName("");setView("create");}}>Créer une équipe →</span>
              </div>
            ) : (
              allUserTeams.map(t => (
                <div key={t.id} onClick={()=>{setSelectedTeamId(t.id);setView("detail");}}
                  style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:theme.bg,borderRadius:10,cursor:"pointer",border:`1px solid ${t.id===activeTeamId?theme.accent:theme.border}`,marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13,fontWeight:700,color:theme.text }}>{t.name}</div>
                    <div style={{ fontSize:10,color:theme.textMuted,marginTop:2 }}>
                      {t.myRole==="admin"?"👑 Admin":t.myRole==="co-admin"?"⭐ Co-admin":`👤 ${(t.members||[]).length} membre(s)`}
                      {t.id===activeTeamId && <span style={{ marginLeft:6,color:theme.accent,fontSize:9 }}>● actif</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    {(t.myRole==="admin"||t.myRole==="co-admin") && t.id===activeTeamId && teamPending.length > 0 && (
                      <span style={{ background:"#cc3030",color:"#fff",borderRadius:"50%",minWidth:18,height:18,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px" }}>{teamPending.length}</span>
                    )}
                    <span style={{ color:theme.textMuted,fontSize:18 }}>›</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── VUE CRÉER ── */}
        {view === "create" && (
          <>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16 }}>
              <button onClick={()=>setView("list")} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:20,cursor:"pointer",padding:0,lineHeight:1 }}>‹</button>
              <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>NOUVELLE ÉQUIPE</div>
            </div>
            <input value={teamName} onChange={e=>setTeamName(e.target.value.slice(0,50))} placeholder="Nom de l'équipe"
              autoFocus onKeyDown={e=>{ if(e.key==="Enter" && teamName.trim()) { onCreateTeam(teamName.trim()); setView("detail"); } }}
              style={{ width:"100%",background:theme.bg,border:`1px solid ${teamName.length>=50?"#cc3030":theme.border}`,borderRadius:8,padding:"10px 12px",color:theme.text,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:4 }}/>
            <div style={{ fontSize:9,color:teamName.length>=45?"#cc3030":theme.textMuted,textAlign:"right",marginBottom:10 }}>{teamName.length}/50</div>
            <button onClick={()=>{ if(teamName.trim()) { onCreateTeam(teamName.trim()); setView("detail"); } }}
              style={{ width:"100%",background:theme.accent,border:"none",borderRadius:8,padding:"10px",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:700 }}>
              Créer l'équipe
            </button>
          </>
        )}

        {/* ── VUE DÉTAIL ── */}
        {view === "detail" && sel && (
          <>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
              <button onClick={()=>{setView("list");setEditingTeamName(false);}} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:20,cursor:"pointer",padding:0,lineHeight:1 }}>‹</button>
              {editingTeamName ? (
                <div style={{ display:"flex",alignItems:"center",gap:6,flex:1 }}>
                  <input value={newTeamNameVal} onChange={e=>setNewTeamNameVal(e.target.value)}
                    autoFocus onKeyDown={e=>{ if(e.key==="Enter"&&newTeamNameVal.trim()){onRenameTeam(sel.id,newTeamNameVal);setEditingTeamName(false);} if(e.key==="Escape")setEditingTeamName(false); }}
                    style={{ flex:1,background:theme.bg,border:`1px solid ${theme.accent}`,borderRadius:7,padding:"4px 8px",color:theme.text,fontSize:13,outline:"none" }}/>
                  <button onClick={()=>{if(newTeamNameVal.trim()){onRenameTeam(sel.id,newTeamNameVal);setEditingTeamName(false);}}} style={{ background:theme.accent,border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",fontSize:11,cursor:"pointer" }}>✓</button>
                  <button onClick={()=>setEditingTeamName(false)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:13,cursor:"pointer" }}>✕</button>
                </div>
              ) : (
                <div style={{ display:"flex",alignItems:"center",gap:8,flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:800,color:theme.text }}>{sel.name}</div>
                  {isOwner && <button onClick={()=>{setNewTeamNameVal(sel.name);setEditingTeamName(true);}} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:13,cursor:"pointer",padding:0 }} title="Renommer">✎</button>}
                </div>
              )}
            </div>
            <div style={{ fontSize:10,color:theme.textMuted,marginBottom:14,paddingLeft:24 }}>
              {sel.myRole==="admin" ? "👑 Vous êtes admin" : sel.myRole==="co-admin" ? "⭐ Vous êtes co-admin" : `Admin : ${sel.adminEmail}`}
            </div>

            <button onClick={()=>onActivateTeam(sel)} style={{ width:"100%",background:theme.accent,border:"none",borderRadius:10,padding:"11px",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
              📋 {sel.id===activeTeamId ? "Ouvrir l'espace tâches" : "Activer et ouvrir"}
              {sel.myRole==="admin" && sel.id===activeTeamId && teamPending.length > 0 && (
                <span style={{ background:"#fff",color:theme.accent,borderRadius:"50%",minWidth:18,height:18,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px" }}>{teamPending.length}</span>
              )}
            </button>

            <div style={{ fontSize:9,color:"#666688",marginBottom:8,letterSpacing:1 }}>MEMBRES ({(sel.members||[]).length})</div>
            {(sel.members||[]).length === 0 && <div style={{ fontSize:11,color:theme.textMuted,marginBottom:12 }}>Aucun membre pour l'instant.</div>}
            {(sel.members||[]).map(m => {
              const mIsCoAdmin = (sel.coAdminUids||[]).includes(m.uid);
              return (
                <div key={m.uid} style={{ background:theme.bg,borderRadius:10,marginBottom:8,overflow:"hidden",border:`1px solid ${theme.border}` }}>
                  {/* Ligne infos */}
                  <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px" }}>
                    <div style={{ width:32,height:32,borderRadius:"50%",background:mIsCoAdmin?"#f0c04022":"#66688822",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0 }}>
                      {mIsCoAdmin ? "⭐" : "👤"}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:600,color:theme.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{m.displayName || m.email}</div>
                      <div style={{ fontSize:10,color:theme.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{m.email}</div>
                    </div>
                    {mIsCoAdmin && <span style={{ marginLeft:"auto",flexShrink:0,fontSize:9,fontWeight:700,color:"#f0c040",background:"#f0c04015",padding:"2px 7px",borderRadius:12,border:"1px solid #f0c04044",letterSpacing:0.5 }}>CO-ADMIN</span>}
                  </div>
                  {/* Ligne actions (admin owner seulement) */}
                  {isOwner && (
                    <div style={{ display:"flex",borderTop:`1px solid ${theme.border}` }}>
                      {mIsCoAdmin
                        ? <button onClick={()=>onDemote(m, sel.id)}
                            style={{ flex:1,background:"transparent",border:"none",borderRight:`1px solid ${theme.border}`,padding:"7px 0",color:theme.textMuted,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
                            <span style={{ fontSize:13 }}>👤</span> Rétrograder
                          </button>
                        : <button onClick={()=>onPromote(m, sel.id)}
                            style={{ flex:1,background:"transparent",border:"none",borderRight:`1px solid ${theme.border}`,padding:"7px 0",color:"#c8a000",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
                            <span style={{ fontSize:13 }}>⭐</span> Co-admin
                          </button>
                      }
                      <button onClick={()=>onRemoveMember(m)}
                        style={{ flex:1,background:"transparent",border:"none",padding:"7px 0",color:"#cc3030",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
                        <span style={{ fontSize:13 }}>✕</span> Retirer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {sel.myRole==="admin" && (sel.members||[]).length > 0 && (
              <>
                <div style={{ fontSize:9,color:"#666688",marginBottom:8,marginTop:8,letterSpacing:1 }}>STATS MEMBRES</div>
                {(sel.members||[]).map(m => <MemberStats key={m.uid} member={m} teamTasks={teamTasks} theme={theme} />)}
              </>
            )}

            {sel.myRole==="admin" && (
              <>
                <div style={{ fontSize:9,color:"#666688",marginBottom:6,marginTop:12,letterSpacing:1 }}>INVITER PAR EMAIL</div>
                <div style={{ display:"flex",gap:6,marginBottom:16 }}>
                  <input value={invite} onChange={e=>setInvite(e.target.value)} placeholder="email@exemple.com"
                    onKeyDown={e=>{ if(e.key==="Enter") { onInvite(invite, sel); setInvite(""); } }}
                    style={{ flex:1,background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:8,padding:"7px 10px",color:theme.text,fontSize:11,outline:"none" }}/>
                  <button onClick={()=>{ onInvite(invite, sel); setInvite(""); }} style={{ background:theme.accent,border:"none",borderRadius:8,padding:"7px 12px",color:"#fff",fontSize:11,cursor:"pointer" }}>Envoyer</button>
                </div>
              </>
            )}

            <div style={{ borderTop:`1px solid ${theme.border}44`,paddingTop:12 }}>
              {sel.myRole==="admin" && (
                <button onClick={()=>onDissolve(sel)} style={{ width:"100%",background:"transparent",border:"1px solid #5a1a1a",borderRadius:8,padding:"8px",color:"#cc3030",fontSize:11,cursor:"pointer" }}>Dissoudre l'équipe</button>
              )}
            </div>
          </>
        )}
      </div>
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
  const [manuallyRemovedIds, setManuallyRemovedIds] = useState(() => load("tt_manuallyRemovedIds", []));
  const [modal,        setModal]        = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [formStep,     setFormStep]     = useState(1);
  const [pendingTask,  setPendingTask]  = useState(null);
  const [customDate,   setCustomDate]   = useState("");
  const [recurDay,     setRecurDay]     = useState(""); // jour fixe du mois (1-31)
  const [recurMonthDay,setRecurMonthDay]= useState(""); // date fixe année "MM-DD"
  const [editingId,    setEditingId]    = useState(null);
  const [form,         setForm]         = useState({ title:"", priority:"Moyenne", status:"À faire", due:"", notes:"", notify:true, recurrence:"none", memberVisible:true });
  const [showTheme,    setShowTheme]    = useState(false);
  const [showStats,    setShowStats]    = useState(false);
  const [ghost,        setGhost]        = useState(null);
  const [dropZone,     setDropZone]     = useState(null);
  const [listening,    setListening]    = useState(false);
  const [voiceError,   setVoiceError]   = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [user,         setUser]         = useState(null);
  const [syncing,      setSyncing]      = useState(false);
  const [syncError,    setSyncError]    = useState(null);
  const [toastMsg,     setToastMsg]     = useState(null); // { text, isError }
  const [inviteLoading, setInviteLoading] = useState(false);
  const [openDrop,     setOpenDrop]     = useState(null); // 'priority' | 'status' | null
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [emailMode,    setEmailMode]    = useState("login"); // "login" | "register"
  const [emailForm,    setEmailForm]    = useState({ email:"", password:"" });
  const [showPassword, setShowPassword] = useState(false);
  const [authError,    setAuthError]    = useState(null);
  const [authInfo,     setAuthInfo]     = useState(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [locale,           setLocale]          = useState(() => load("tt_locale", navigator.language || "fr-FR"));
  const [dailyNotifEnabled,setDailyNotifEnabled]= useState(() => load("tt_dailyNotif", true));
  const [dailyNotifTime,   setDailyNotifTime]   = useState(() => load("tt_dailyNotifTime", "08:00"));
  const [showQuickAdd,     setShowQuickAdd]     = useState(false);
  const [quickTitle,       setQuickTitle]       = useState("");
  const [quickPriority,    setQuickPriority]    = useState("Moyenne");
  const [quickSchedule,    setQuickSchedule]    = useState(null); // "today"|"tomorrow"|"none"
  const [showAddMenu,      setShowAddMenu]      = useState(false);
  const [team,             setTeam]             = useState(null);
  const [teamRole,         setTeamRole]         = useState(null);   // "admin"|"member"|null
  const [teamSpace,        setTeamSpace]        = useState(false);  // false=perso true=équipe
  const [adminTeams,       setAdminTeams]       = useState([]);      // toutes les équipes où l'user est admin
  const [showTeam,         setShowTeam]         = useState(false);
  const [teamPanelView,    setTeamPanelView]    = useState("list"); // "list"|"detail"|"create"
  const [teamForm,         setTeamForm]         = useState({ name:"" });
  const [inviteEmail,      setInviteEmail]      = useState("");
  const [pendingInvite,    setPendingInvite]    = useState(null);
  const [teamError,        setTeamError]        = useState(null);
  const [teamInfo,         setTeamInfo]         = useState(null);
  const [pendingTeamTaskId,setPendingTeamTaskId]= useState(null);
  const [pendingMemberProposal,setPendingMemberProposal]= useState(null);
  const [statsView,        setStatsView]        = useState("perso");
  const [teamSortBy,       setTeamSortBy]       = useState(null);
  const [teamSortDir,      setTeamSortDir]       = useState("asc");
  const [showTeamDone,     setShowTeamDone]      = useState(false);
  const [teamTasks,        setTeamTasks]        = useState([]);
  const [teamPending,      setTeamPending]      = useState([]);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [myPendingProposals, setMyPendingProposals] = useState([]);
  const [showMyPendingPanel, setShowMyPendingPanel] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachPopup,          setAttachPopup]          = useState(null); // task.id ou null
  const [filePopup,            setFilePopup]            = useState(null); // objet attachment
  const [userPhotoURL, setUserPhotoURL] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userPseudo, setUserPseudo] = useState(() => load("tt_userPseudo", ""));
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [pseudoInput, setPseudoInput] = useState("");
  const [teamModal,        setTeamModal]        = useState(null); // firestoreId tâche ouverte
  const [commentPopup,     setCommentPopup]     = useState(null); // firestoreId tâche équipe (popup commentaires)
  const [pjPopup,          setPjPopup]          = useState(null); // {id, isTeam} (popup PJ)
  const [teamComments,     setTeamComments]     = useState([]);
  const [commentInput,     setCommentInput]     = useState("");
  const checkMobile = () => screen.width <= 768 || window.innerWidth <= 768;
  const [isMobile,     setIsMobile]     = useState(checkMobile);
  const [showDone,     setShowDone]     = useState(false);
  const [showBin,      setShowBin]      = useState(false);
  const [showTeamBin,  setShowTeamBin]  = useState(false);
  const [visibleTaskCount, setVisibleTaskCount] = useState(100);
  const [sortBy,       setSortBy]       = useState(null);
  const [sortDir,      setSortDir]      = useState("asc");
  const [taskCounter,  setTaskCounter]  = useState(() => load("tt_counter", 0));
  const [deletedTasks, setDeletedTasks] = useState(() => load("tt_deleted", []));
  const [deletedTeamTasks, setDeletedTeamTasks] = useState([]);
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
      { name:"Nuit",       bg:"#0d0d1a", bgLeft:"#0a0a18", bgCard:"#0f0f22", accent:"#5050dd", text:"#e0e0f0", textMuted:"#8888aa", border:"#1a1a3a" },
      { name:"Forêt",      bg:"#0a120a", bgLeft:"#081008", bgCard:"#0d180d", accent:"#40a040", text:"#e0f0e0", textMuted:"#6a9a6a", border:"#1a3a1a" },
      { name:"Braise",     bg:"#1a0d0d", bgLeft:"#180a0a", bgCard:"#220d0d", accent:"#dd5020", text:"#f0e0e0", textMuted:"#9a7878", border:"#3a1a1a" },
      { name:"Océan",      bg:"#0a0d1a", bgLeft:"#080a18", bgCard:"#0d1022", accent:"#2080cc", text:"#e0e8f8", textMuted:"#6a8aaa", border:"#1a2a3a" },
      { name:"Encre",      bg:"#111111", bgLeft:"#0a0a0a", bgCard:"#181818", accent:"#888888", text:"#dddddd", textMuted:"#888888", border:"#222222" },
      { name:"Améthyste",  bg:"#120a1a", bgLeft:"#0e0814", bgCard:"#180d22", accent:"#9040cc", text:"#f0e0ff", textMuted:"#8870aa", border:"#2a1a3a" },
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
  const firestoreLoaded  = useRef(false);
  const lastSavedSnapshot = useRef(null);
  const longPressTimer   = useRef(null);
  const onTouchEndRef    = useRef(null);
  const tasksRef         = useRef(tasks);
  const todayIdsRef         = useRef(todayIds);
  const teamTasksRef        = useRef([]);
  const sendDailyNotifCb    = useRef(null);
  const teamPendingPrevCount = useRef(-1); // -1 = pas encore initialisé (évite notif au 1er chargement)
  const teamTasksPrevIds    = useRef(null); // null = pas encore initialisé

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

  // Variante pour les tâches équipe : utilise scheduledFor au lieu de todayIds/tomorrowIds
  const teamTaskColor = (task) => {
    if (!task || task.status === "Terminé") return null;
    const today = todayStr();
    const tom = new Date(); tom.setDate(tom.getDate()+1);
    const tomorrow = tom.toISOString().split("T")[0];
    const sfDate = task.scheduledFor && task.scheduledFor !== "today" && task.scheduledFor !== "tomorrow" ? task.scheduledFor : null;
    const refDate = task.due || sfDate;
    if (refDate) {
      if (refDate < today) return RED;
      if (refDate === today || task.scheduledFor === "today") return GOLD;
      if (refDate === tomorrow || task.scheduledFor === "tomorrow") return ORANGE;
      return GREEN;
    }
    if (task.scheduledFor === "today")    return GOLD;
    if (task.scheduledFor === "tomorrow") return ORANGE;
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
  useEffect(() => { localStorage.setItem("tt_scheduledIds",      JSON.stringify(scheduledIds));      }, [scheduledIds]);
  useEffect(() => { localStorage.setItem("tt_highlighted",       JSON.stringify(highlighted));       }, [highlighted]);
  useEffect(() => { localStorage.setItem("tt_manuallyRemovedIds",JSON.stringify(manuallyRemovedIds));}, [manuallyRemovedIds]);
  useEffect(() => { localStorage.setItem("tt_counter",      JSON.stringify(taskCounter));   }, [taskCounter]);
  useEffect(() => { localStorage.setItem("tt_deleted",      JSON.stringify(deletedTasks));  }, [deletedTasks]);
  useEffect(() => { localStorage.setItem("tt_locale",       JSON.stringify(locale));         }, [locale]);
  useEffect(() => { localStorage.setItem("tt_dailyNotif",   JSON.stringify(dailyNotifEnabled)); }, [dailyNotifEnabled]);
  useEffect(() => { localStorage.setItem("tt_dailyNotifTime",JSON.stringify(dailyNotifTime)); }, [dailyNotifTime]);
  useEffect(() => { localStorage.setItem("tt_userPseudo", JSON.stringify(userPseudo)); }, [userPseudo]);
  useEffect(() => { tasksRef.current    = tasks;     }, [tasks]);
  useEffect(() => { todayIdsRef.current = todayIds;  }, [todayIds]);
  useEffect(() => { teamTasksRef.current = teamTasks;}, [teamTasks]);

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

  // ── Push notifications en arrière-plan (FCM) ──
  useEffect(() => {
    if (!user || !import.meta.env.VITE_FIREBASE_VAPID_KEY) return;
    let unsubMsg = null;
    const setup = async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope:"/" });
        // Transmet la config au SW pour qu'il initialise Firebase côté worker
        const config = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        (swReg.installing || swReg.waiting || swReg.active)?.postMessage({ type:"FIREBASE_CONFIG", config });
        const messaging = await getMessagingInstance();
        if (!messaging) return;
        if (Notification.permission !== "granted") return;
        const fcmToken = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: swReg });
        if (fcmToken) await setDoc(doc(db, "users", user.uid), { fcmToken }, { merge:true });
        // Notif reçue quand l'app est au premier plan
        unsubMsg = onMessage(messaging, payload => {
          const { title, body } = payload.notification || {};
          if (title) sendNotif(title, body||"", payload.data?.tag||"fcm");
        });
      } catch(e) { console.warn("FCM setup:", e); }
    };
    setup();
    return () => { unsubMsg?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Mise à jour du callback quotidien à chaque render (évite les closures périmées)
  sendDailyNotifCb.current = () => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = todayStr();
    if (localStorage.getItem("tt_lastDailyNotif") === today) return;
    localStorage.setItem("tt_lastDailyNotif", today);
    const personalActive = tasksRef.current.filter(t => todayIdsRef.current.includes(t.id) && t.status !== "Terminé");
    const teamActive     = teamTasksRef.current.filter(t => t.scheduledFor === "today" && t.status !== "Terminé");
    const allActive = [...personalActive, ...teamActive];
    const count = allActive.length;
    const body = count > 0
      ? `${count} tâche${count>1?"s":""} : ${allActive.slice(0,3).map(t=>t.title).join(" • ")}${count>3?" …":""}`
      : "Pas de tâches planifiées aujourd'hui.";
    playChime();
    const n = new Notification("Hey, on fait quoi aujourd'hui ? 👋", {
      body, tag:"daily-reminder", icon:"/favicon.ico", requireInteraction:false
    });
    // Les membres d'équipe n'ont pas le quick add
    n.onclick = () => { window.focus(); if (personalActive.length > 0) setShowQuickAdd(true); n.close(); };
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
          // Réinitialiser les refs de sync pour ne pas sauvegarder des données vides
          firestoreLoaded.current = false;
          lastSavedSnapshot.current = null;
          ['tt_tasks','tt_todayIds','tt_todayDates','tt_tomorrowIds','tt_scheduledIds','tt_highlighted','tt_counter','tt_manuallyRemovedIds'].forEach(k => localStorage.removeItem(k));
          setManuallyRemovedIds([]);
          setTasks(INIT);
          setTodayIds([]); setTodayDates({}); setTomorrowIds([]);
          setScheduledIds([]); setHighlighted([]); setTaskCounter(0);
          setTeamSpace(false);
        }
        return u;
      });
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Sync Firestore → local quand connecté
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data();
        // Marquer ce snapshot comme "déjà en Firestore" pour ne pas le re-sauvegarder
        const snapStr = JSON.stringify({
          tasks: data.tasks || [],
          todayIds: data.todayIds || [],
          todayDates: data.todayDates || {},
          tomorrowIds: data.tomorrowIds || [],
          scheduledIds: data.scheduledIds || [],
          highlighted: data.highlighted || [],
          taskCounter: data.taskCounter ?? 0,
          locale: data.locale || navigator.language || "fr-FR",
        });
        lastSavedSnapshot.current = snapStr;
        firestoreLoaded.current = true;
        if (data.tasks)        setTasks(data.tasks);
        if (data.todayIds)     setTodayIds(data.todayIds);
        if (data.todayDates)   setTodayDates(data.todayDates);
        if (data.tomorrowIds)  setTomorrowIds(data.tomorrowIds);
        if (data.scheduledIds) setScheduledIds(data.scheduledIds);
        if (data.highlighted)  setHighlighted(data.highlighted);
        if (data.theme)        setTheme(t => ({...t, ...data.theme}));
        if (data.taskCounter !== undefined) setTaskCounter(data.taskCounter);
        if (data.locale)       setLocale(data.locale);
        if (data.customPhotoURL) setUserPhotoURL(data.customPhotoURL);
        if (data.pseudo !== undefined) setUserPseudo(data.pseudo || "");
      }
    });
    return unsub;
  }, [user]);

  // Sync local → Firestore à chaque changement
  useEffect(() => {
    if (!user || !firestoreLoaded.current) return; // Attendre le 1er chargement Firestore
    const currentSnapshot = JSON.stringify({ tasks, todayIds, todayDates, tomorrowIds, scheduledIds, highlighted, taskCounter, locale });
    if (currentSnapshot === lastSavedSnapshot.current) return; // Déjà à jour (écho ou pas de changement)
    lastSavedSnapshot.current = currentSnapshot; // Marquer avant la sauvegarde async
    setSyncing(true);
    const ref = doc(db, "users", user.uid);
    const clean = obj => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));
    const saves = [setDoc(ref, clean({ tasks, todayIds, todayDates, tomorrowIds, scheduledIds, highlighted, taskCounter, locale }), { merge: true })];
    if (team && teamRole) {
      const total  = tasks.length;
      const done   = tasks.filter(t => t.status === "Terminé").length;
      const active = tasks.filter(t => t.status !== "Terminé").length;
      saves.push(setDoc(doc(db, "teams", team.id, "memberStats", user.uid), { total, done, active, displayName: userPseudo || user.displayName || null, email: user.email || null }, { merge: true }));
    }
    Promise.all(saves)
      .catch(err => { console.error("Save to Firestore failed:", err); setSyncError("Erreur de synchronisation — vos données n'ont pas été sauvegardées."); setTimeout(() => setSyncError(null), 6000); })
      .finally(() => setSyncing(false));
  }, [tasks, todayIds, todayDates, tomorrowIds, scheduledIds, highlighted, taskCounter]);

  const toast = (text, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loginGoogle = async () => {
    try { await signInWithPopup(auth, provider); setShowAuthMenu(false); setAuthError(null); }
    catch(e) { setAuthError(e.code==="auth/popup-closed-by-user"?"Annulé.":e.message); }
  };
  const sendPasswordReset = async () => {
    if (!emailForm.email) { setAuthError("Entrez votre email pour réinitialiser votre mot de passe."); return; }
    try {
      await sendPasswordResetEmail(auth, emailForm.email);
      setAuthInfo("Email de réinitialisation envoyé ! Vérifiez votre boîte mail.");
      setAuthError(null);
    } catch(e) { setAuthError(e.code === "auth/user-not-found" ? "Aucun compte associé à cet email." : e.message); }
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
    if (!user) { setTeam(null); setTeamRole(null); setPendingInvite(null); setTeamSpace(false); setAdminTeams([]); return; }

    // Subscriptions dynamiques sur chaque équipe listée dans allTeamIds
    const teamUnsubs = new Map(); // teamId → unsub fn

    const subscribeToTeam = (teamId) => {
      if (teamUnsubs.has(teamId)) return;
      const unsub = onSnapshot(doc(db, "teams", teamId), tSnap => {
        if (!tSnap.exists()) {
          setAdminTeams(prev => prev.filter(t => t.id !== teamId));
          // Nettoyer la référence obsolète dans allTeamIds
          setDoc(doc(db, "users", user.uid), { allTeamIds: arrayRemove(teamId) }, { merge:true }).catch(()=>{});
          return;
        }
        const tData = tSnap.data();
        // Vérifier que l'utilisateur est réellement dans cette équipe
        const isInTeam = tData.adminUid === user.uid
          || (tData.coAdminUids||[]).includes(user.uid)
          || (tData.members||[]).some(m => m.uid === user.uid);
        if (!isInTeam) {
          // Référence périmée dans allTeamIds → nettoyage silencieux
          setAdminTeams(prev => prev.filter(t => t.id !== teamId));
          setDoc(doc(db, "users", user.uid), { allTeamIds: arrayRemove(teamId) }, { merge:true }).catch(()=>{});
          return;
        }
        const myRole = tData.adminUid === user.uid ? "admin"
          : (tData.coAdminUids||[]).includes(user.uid) ? "co-admin"
          : "member";
        const t = { id:tSnap.id, ...tData, myRole };
        setAdminTeams(prev => {
          const idx = prev.findIndex(x => x.id === teamId);
          if (idx >= 0) { const next=[...prev]; next[idx]=t; return next; }
          return [...prev, t];
        });
      });
      teamUnsubs.set(teamId, unsub);
    };

    let currentActiveId = null;
    let prevTeamRole = null;

    const userUnsub = onSnapshot(doc(db, "users", user.uid), snap => {
      const data = snap.data() || {};
      // teamRole est dérivé depuis le document équipe dans activeUnsub

      // Équipe active (teamId principal) — re-subscribe uniquement si l'ID change
      const activeId = data.teamId || null;
      if (activeId !== currentActiveId) {
        if (teamUnsubs.has("__active__")) {
          teamUnsubs.get("__active__")();
          teamUnsubs.delete("__active__");
        }
        currentActiveId = activeId;
        if (activeId) {
          const activeUnsub = onSnapshot(doc(db, "teams", activeId), tSnap => {
            if (tSnap.exists()) {
              const tData = { id:tSnap.id, ...tSnap.data() };
              // Vérifier que l'utilisateur est réellement dans cette équipe
              const isInTeam = tData.adminUid === user.uid
                || (tData.coAdminUids||[]).includes(user.uid)
                || (tData.members||[]).some(m => m.uid === user.uid);
              if (!isInTeam) {
                // teamId pointe vers une équipe dont l'utilisateur ne fait pas partie → nettoyage
                setDoc(doc(db, "users", user.uid), { teamId:null, teamRole:null, allTeamIds: arrayRemove(activeId) }, { merge:true }).catch(()=>{});
                setTeam(null); setTeamSpace(false); setTeamRole(null);
                return;
              }
              setTeam(tData);
              const derived = tData.adminUid === user.uid ? "admin"
                : (tData.coAdminUids||[]).includes(user.uid) ? "co-admin"
                : "member";
              if (prevTeamRole !== null && prevTeamRole !== "co-admin" && derived === "co-admin") {
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Task Tracker — Félicitations ! ⭐", { body:"Vous avez été nommé co-admin de l'équipe.", icon:"/favicon.ico" });
                }
              }
              prevTeamRole = derived;
              setTeamRole(derived);
            } else {
              // L'équipe n'existe plus → nettoyer la référence obsolète
              setDoc(doc(db, "users", user.uid), { teamId:null, teamRole:null, allTeamIds: arrayRemove(activeId) }, { merge:true }).catch(()=>{});
              setTeam(null); setTeamSpace(false); setTeamRole(null);
            }
          });
          teamUnsubs.set("__active__", activeUnsub);
        } else { setTeam(null); setTeamSpace(false); }
      }

      // Toutes les équipes (allTeamIds + teamId actuel)
      const allIds = Array.from(new Set([
        ...(data.allTeamIds || []),
        ...(activeId ? [activeId] : [])
      ]));
      allIds.forEach(id => subscribeToTeam(id));
    });

    if (user.email) {
      getDoc(doc(db, "invitations", user.email.toLowerCase())).then(s => {
        setPendingInvite(s.exists() ? { id:s.id, ...s.data() } : null);
      });
    }
    return () => {
      userUnsub();
      teamUnsubs.forEach(fn => fn());
    };
  }, [user?.uid]);

  // Activer une équipe (met à jour teamId dans Firestore → déclenche le listener existant)
  const switchActiveTeam = async (t) => {
    if (!user) return;
    const role = t.adminUid === user.uid ? "admin" : "member";
    try { await setDoc(doc(db, "users", user.uid), { teamId:t.id, teamRole:role, allTeamIds:arrayUnion(t.id) }, { merge:true }); }
    catch(e) { setTeamError(e.message); }
  };

  const renameTeam = async (teamId, newName) => {
    const trimmedName = newName?.trim();
    if (!teamId || !trimmedName) return;
    if (trimmedName.length > 50) { setTeamError("Le nom ne peut pas dépasser 50 caractères"); return; }
    try {
      await updateDoc(doc(db, "teams", teamId), { name: trimmedName });
      setTeamInfo("Nom mis à jour !");
    } catch(e) { setTeamError(e.message); }
  };

  const createTeam = async (name) => {
    const trimmedName = name?.trim();
    if (!user || !trimmedName) return;
    if (trimmedName.length > 50) { setTeamError("Le nom de l'équipe ne peut pas dépasser 50 caractères"); return; }
    try {
      const ref = await addDoc(collection(db, "teams"), { name:trimmedName, adminUid:user.uid, adminEmail:user.email||"", members:[], createdAt:serverTimestamp() });
      await setDoc(doc(db, "users", user.uid), { teamId:ref.id, teamRole:"admin", allTeamIds:arrayUnion(ref.id) }, { merge:true });
      setTeamInfo("Équipe créée !");
    } catch(e) { setTeamError(e.message); }
  };

  const sendInviteEmail = async (toEmail, teamName, invitedBy) => {
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
  };

  const inviteMember = async (emailArg, targetTeam) => {
    const raw = (emailArg || inviteEmail).trim().toLowerCase();
    const t   = targetTeam || team;
    if (!t || !raw) return;
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(raw)) { setTeamError("Adresse email invalide"); return; }
    if ((t.members || []).some(m => m.email?.toLowerCase() === raw)) { setTeamError("Cette personne est déjà membre de l'équipe"); return; }
    try {
      await setDoc(doc(db, "invitations", raw), { teamId:t.id, teamName:t.name, invitedBy:user.email||"", createdAt:serverTimestamp() });
      try {
        await sendInviteEmail(raw, t.name, user.email||"");
        setTeamInfo(`Invitation envoyée à ${raw}`);
      } catch(emailErr) {
        console.error("EmailJS:", emailErr);
        setTeamInfo(`Invitation créée pour ${raw}. L'email de notification n'a pas pu être envoyé.`);
      }
      setInviteEmail("");
    } catch(e) { setTeamError(e.message); }
  };

  const acceptInvite = async () => {
    if (!pendingInvite || !user || inviteLoading) return;
    setInviteLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "teams", pendingInvite.teamId), { members: arrayUnion({ uid:user.uid, email:user.email||"", displayName:user.displayName||user.email||"" }) });
      batch.set(doc(db, "users", user.uid), { teamId:pendingInvite.teamId, teamRole:"member", allTeamIds:arrayUnion(pendingInvite.teamId) }, { merge:true });
      batch.delete(doc(db, "invitations", (user.email||"").toLowerCase()));
      await batch.commit();
      setPendingInvite(null);
      setTeamSpace(true); // bascule directement sur l'espace équipe
    } catch(e) { setTeamError(e.message); }
    finally { setInviteLoading(false); }
  };

  const rejectInvite = async () => {
    if (!user || inviteLoading) return;
    setInviteLoading(true);
    try { await deleteDoc(doc(db, "invitations", (user.email||"").toLowerCase())); setPendingInvite(null); }
    catch(e) { setTeamError(e.message); }
    finally { setInviteLoading(false); }
  };

  const isAdminRole = (role) => role === "admin" || role === "co-admin";

  const promoteToCoAdmin = async (member, teamId) => {
    const tid = teamId || team?.id;
    if (!tid || !user) return;
    try {
      await updateDoc(doc(db, "teams", tid), { coAdminUids: arrayUnion(member.uid) });
    } catch(e) { setTeamError(e.message); }
  };

  const demoteToMember = async (member, teamId) => {
    const tid = teamId || team?.id;
    if (!tid || !user) return;
    try {
      await updateDoc(doc(db, "teams", tid), { coAdminUids: arrayRemove(member.uid) });
    } catch(e) { setTeamError(e.message); }
  };

  const removeMember = async (member) => {
    if (!team || !isAdminRole(teamRole)) return;
    try {
      await updateDoc(doc(db, "teams", team.id), { members: arrayRemove(member) });
      await setDoc(doc(db, "users", member.uid), { teamId:null, teamRole:null }, { merge:true });
    } catch(e) { setTeamError(e.message); }
  };

  const leaveTeam = async () => {
    if (!user || !team || isAdminRole(teamRole)) return;
    if (!window.confirm("Quitter l'équipe ?")) return;
    try {
      const me = team.members.find(m => m.uid === user.uid);
      if (me) await updateDoc(doc(db, "teams", team.id), { members: arrayRemove(me) });
      await setDoc(doc(db, "users", user.uid), { teamId:null, teamRole:null }, { merge:true });
      setTeamSpace(false);
    } catch(e) { setTeamError(e.message); }
  };

  const dissolveTeam = async (targetTeam) => {
    const t = targetTeam || team;
    if (!t || !user) return;
    if (!window.confirm(`Dissoudre "${t.name}" ? Tous les membres seront retirés.`)) return;
    try {
      // Les règles Firestore n'autorisent pas l'admin à écrire les documents des autres users.
      // On supprime l'équipe ; les membres seront nettoyés automatiquement à leur prochaine connexion.
      await setDoc(doc(db, "users", user.uid), { teamId:null, teamRole:null, allTeamIds: arrayRemove(t.id) }, { merge:true });
      await deleteDoc(doc(db, "teams", t.id));
      setTeamSpace(false);
    } catch(e) { setTeamError(e.message); }
  };

  useEffect(() => {
    if (!team) {
      setTeamTasks([]); setTeamPending([]); setDeletedTeamTasks([]);
      teamTasksPrevIds.current = null; teamPendingPrevCount.current = -1;
      return;
    }
    const teamId = team.id;
    teamTasksPrevIds.current = null; // reset à chaque changement d'équipe
    teamPendingPrevCount.current = -1;
    const unsubTasks = onSnapshot(
      collection(db, "teams", teamId, "tasks"),
      snap => {
        const t = snap.docs.map(d => ({ ...d.data(), id:d.id }));
        t.sort((a,b) => (a.num||0)-(b.num||0));
        // Notification membre : nouvelle tâche ajoutée ou modifiée
        if (teamTasksPrevIds.current !== null && !isAdminRole(teamRole)) {
          const newTasks = t.filter(task => !teamTasksPrevIds.current.has(task.id));
          if (newTasks.length > 0 && Notification.permission === "granted") {
            new Notification("Task Tracker — Nouvelle tâche équipe 📋", {
              body: newTasks.map(tk => tk.title).join(" • "),
              icon: "/favicon.ico", tag: "team-task-added"
            });
          }
        }
        teamTasksPrevIds.current = new Set(t.map(tk => tk.id));
        setTeamTasks(t);
      },
      err => console.error("team tasks subscription error:", err.message)
    );
    let unsubPending = () => {};
    if (teamRole === "admin") {
      unsubPending = onSnapshot(collection(db, "teams", teamId, "pendingChanges"), snap => {
        const items = snap.docs.map(d => ({ ...d.data(), id:d.id }));
        // Notification admin : nouvelle proposition d'un membre
        if (teamPendingPrevCount.current >= 0 && items.length > teamPendingPrevCount.current) {
          if (Notification.permission === "granted") {
            const newest = items[items.length - 1];
            const typeLabel = newest?.type === "add" ? "propose une tâche" : newest?.type === "edit" ? "propose une modif" : "propose une suppression";
            new Notification("Task Tracker — Modification proposée 🔔", {
              body: `${newest?.proposedByEmail || "Un membre"} ${typeLabel}`,
              icon: "/favicon.ico", tag: "team-pending"
            });
          }
        }
        teamPendingPrevCount.current = items.length;
        setTeamPending(items);
      });
    } else {
      setTeamPending([]);
      // Members subscribe to their own proposals
      unsubPending = onSnapshot(
        query(collection(db, "teams", teamId, "pendingChanges"), where("proposedBy", "==", user.uid)),
        snap => { setMyPendingProposals(snap.docs.map(d => ({ ...d.data(), id:d.id }))); }
      );
    }
    const unsubDeleted = onSnapshot(collection(db, "teams", teamId, "deletedTasks"), snap => {
      setDeletedTeamTasks(snap.docs.map(d => ({ ...d.data(), id:d.id })));
    });
    return () => { unsubTasks(); unsubPending(); unsubDeleted(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, teamRole]);

  // commentTaskId = ID Firestore de la tâche dont on charge les commentaires
  // Peut venir du popup commentaires OU du formulaire de modification d'une tâche équipe
  const commentTaskId = commentPopup || (teamSpace && editingId && typeof editingId === "string" ? editingId : null);

  useEffect(() => {
    if (!commentTaskId || !team) { setTeamComments([]); return; }
    const unsub = onSnapshot(collection(db, "teams", team.id, "tasks", commentTaskId, "comments"), snap => {
      const c = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      c.sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
      setTeamComments(c);
    });
    return unsub;
  }, [commentTaskId, team]);

  const addComment = async () => {
    if (!commentInput.trim() || !commentTaskId || !team || !user) return;
    try {
      await addDoc(collection(db, "teams", team.id, "tasks", commentTaskId, "comments"), {
        text: commentInput.trim(),
        authorUid: user.uid,
        authorEmail: user.email || "",
        authorName: user.displayName || user.email || "?",
        createdAt: Date.now()
      });
      setCommentInput("");
    } catch(e) { setTeamError(e.message); }
  };

  const deleteComment = async (commentId, authorUid) => {
    if (!commentTaskId || !team || !user) return;
    if (!isAdminRole(teamRole) && authorUid !== user.uid) return;
    try { await deleteDoc(doc(db, "teams", team.id, "tasks", commentTaskId, "comments", commentId)); }
    catch(e) { setTeamError(e.message); }
  };

  const cycleTeamStatus = async (firestoreId, currentStatus) => {
    if (!team || !isAdminRole(teamRole)) return;
    const next = STATUSES[(STATUSES.indexOf(currentStatus) + 1) % STATUSES.length];
    try { await updateDoc(doc(db, "teams", team.id, "tasks", firestoreId), { status: next }); }
    catch(e) { setTeamError(e.message); }
  };

  const deleteTeamTask = async (taskId) => {
    if (!team) return;
    if (isAdminRole(teamRole)) {
      try {
        const taskData = teamTasks.find(t => t.id === taskId);
        if (taskData) await setDoc(doc(db, "teams", team.id, "deletedTasks", taskId), { ...taskData, deletedAt: serverTimestamp() });
        await deleteDoc(doc(db, "teams", team.id, "tasks", taskId));
        setTeamTasks(t => t.filter(task => task.id !== taskId));
        if (taskData) setDeletedTeamTasks(p => [...p, { ...taskData, deletedAt: Date.now() }]);
      } catch(e) { setTeamError(e.message); }
    } else {
      if (!window.confirm("Proposer la suppression à l'admin ?")) return;
      try {
        await addDoc(collection(db, "teams", team.id, "pendingChanges"), { type:"delete", taskId, proposedBy:user.uid, proposedByEmail:user.email||"", data:null, createdAt:serverTimestamp(), status:"pending" });
        setTeamInfo("Suppression proposée à l'admin.");
      } catch(e) { setTeamError(e.message); }
    }
  };

  const approveChange = async (change) => {
    if (!isAdminRole(teamRole)) return;
    try {
      if (change.type === "edit") {
        const taskExists = teamTasks.some(t => t.id === change.taskId);
        if (!taskExists) { await deleteDoc(doc(db, "teams", team.id, "pendingChanges", change.id)); setTeamError("La tâche a été supprimée, modification annulée."); return; }
        await setDoc(doc(db, "teams", team.id, "tasks", change.taskId), change.data, { merge:true });
      }
      if (change.type === "delete") await deleteDoc(doc(db, "teams", team.id, "tasks", change.taskId));
      if (change.type === "add") {
        const newNum = (team.taskCounter || 0) + 1;
        await updateDoc(doc(db, "teams", team.id), { taskCounter: newNum });
        await addDoc(collection(db, "teams", team.id, "tasks"), { ...change.data, id:Date.now(), num:newNum, createdBy:change.proposedBy, createdAt:serverTimestamp() });
      }
      if (change.type === "deleteAttachment" && change.data?.attachment) {
        try { await deleteObject(storageRef(storage, change.data.attachment.storagePath)); } catch(e) {}
        await updateDoc(doc(db, "teams", team.id, "tasks", change.taskId), { attachments: arrayRemove(change.data.attachment) });
      }
      if (change.type === "addAttachment" && change.data?.attachment) {
        await updateDoc(doc(db, "teams", team.id, "tasks", change.taskId), { attachments: arrayUnion(change.data.attachment) });
      }
      await deleteDoc(doc(db, "teams", team.id, "pendingChanges", change.id));
    } catch(e) { setTeamError(e.message); }
  };

  const rejectChange = async (changeId, change) => {
    if (!isAdminRole(teamRole)) return;
    try {
      if (change?.type === "addAttachment" && change?.data?.attachment?.storagePath) {
        try { await deleteObject(storageRef(storage, change.data.attachment.storagePath)); } catch(e) {}
      }
      await deleteDoc(doc(db, "teams", team.id, "pendingChanges", changeId));
    }
    catch(e) { setTeamError(e.message); }
  };

  const restoreTeamTask = async (task) => {
    if (!team || !isAdminRole(teamRole)) return;
    try {
      const newNum = (team.taskCounter || 0) + 1;
      await updateDoc(doc(db, "teams", team.id), { taskCounter: newNum });
      const { deletedAt, id, ...rest } = task;
      await addDoc(collection(db, "teams", team.id, "tasks"), { ...rest, num:newNum, status:"À faire" });
      await deleteDoc(doc(db, "teams", team.id, "deletedTasks", task.id));
    } catch(e) { setTeamError(e.message); }
  };

  const permanentDeleteTeamTask = async (taskId) => {
    if (!team || !isAdminRole(teamRole)) return;
    try { await deleteDoc(doc(db, "teams", team.id, "deletedTasks", taskId)); }
    catch(e) { setTeamError(e.message); }
  };

  const uploadAttachment = async (taskId, file, isTeam = false) => {
    if (!file) return;
    if (!user) { toast("Connectez-vous pour ajouter des pièces jointes.", true); return; }
    const ALLOWED_TYPES = ["image/jpeg","image/png","image/gif","image/webp","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","message/rfc822","application/vnd.ms-outlook"];
    if (!ALLOWED_TYPES.some(t => file.type.startsWith("image/") || file.type === t)) {
      toast("Type de fichier non supporté. Formats acceptés : image, PDF, Word, Excel, mail.", true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) { toast("Fichier trop volumineux (max 10 Mo).", true); return; }
    setUploadingAttachment(true);
    try {
      const path = isTeam
        ? `teams/${team.id}/attachments/${taskId}/${Date.now()}_${file.name}`
        : `users/${user.uid}/attachments/${taskId}/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      const attachment = { name:file.name, url, type:file.type, size:file.size, uploadedBy:user.uid, uploadedByEmail:user.email||"", uploadedAt:Date.now(), storagePath:path };
      if (isTeam) {
        if (isAdminRole(teamRole)) {
          await updateDoc(doc(db, "teams", team.id, "tasks", taskId), { attachments: arrayUnion(attachment) });
        } else {
          // Membre : l'ajout de PJ doit être validé par l'admin
          await addDoc(collection(db, "teams", team.id, "pendingChanges"), {
            type: "addAttachment", taskId, proposedBy: user.uid, proposedByEmail: user.email||"",
            data: { attachment }, createdAt: serverTimestamp(), status: "pending"
          });
          setTeamInfo("Pièce jointe soumise à validation de l'admin.");
        }
      } else {
        setTasks(prev => prev.map(t => t.id === taskId ? {...t, attachments:[...(t.attachments||[]),attachment]} : t));
      }
    } catch(e) { toast(e.message || "Erreur lors de l'envoi du fichier.", true); }
    setUploadingAttachment(false);
  };

  const deleteAttachment = async (taskId, attachment, isTeam = false) => {
    if (!user) return;
    const isOwner = attachment.uploadedBy === user.uid;
    if (isTeam && !isAdminRole(teamRole) && !isOwner) {
      try {
        await addDoc(collection(db, "teams", team.id, "pendingChanges"), { type:"deleteAttachment", proposedBy:user.uid, proposedByEmail:user.email||"", taskId, data:{attachment}, createdAt:serverTimestamp(), status:"pending" });
        setTeamInfo("Demande de suppression envoyée à l'admin.");
      } catch(e) { setTeamError(e.message); }
      return;
    }
    if (!window.confirm(`Supprimer "${attachment.name}" ?`)) return;
    try {
      await deleteObject(storageRef(storage, attachment.storagePath));
      if (isTeam) {
        await updateDoc(doc(db, "teams", team.id, "tasks", taskId), { attachments: arrayRemove(attachment) });
      } else {
        setTasks(prev => prev.map(t => t.id === taskId ? {...t, attachments:(t.attachments||[]).filter(a=>a.storagePath!==attachment.storagePath)} : t));
      }
    } catch(e) { setTeamError(e.message); }
  };

  const savePseudo = async (pseudo) => {
    const trimmed = pseudo.trim();
    setUserPseudo(trimmed);
    setEditingPseudo(false);
    setPseudoInput("");
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), { pseudo: trimmed }, { merge: true });
      if (team) {
        const newMembers = (team.members || []).map(m =>
          m.uid === user.uid ? { ...m, displayName: trimmed || m.email || "" } : m
        );
        await updateDoc(doc(db, "teams", team.id), { members: newMembers });
      }
    } catch(e) { console.error("savePseudo:", e); }
  };

  const uploadAvatar = async (file) => {
    if (!user || !file) return;
    if (!file.type.startsWith("image/")) { toast("Seules les images sont acceptées pour l'avatar.", true); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Image trop volumineuse (max 5 Mo).", true); return; }
    setUploadingAvatar(true);
    try {
      const path = `users/${user.uid}/avatar`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await setDoc(doc(db, "users", user.uid), { customPhotoURL: url }, { merge: true });
      setUserPhotoURL(url);
    } catch(e) { console.error("Avatar upload:", e); setAuthError("Échec du téléchargement de l'avatar. Vérifiez votre connexion."); }
    setUploadingAvatar(false);
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
      const toToday    = prev.filter(e => e.dueDate <= today    && !manuallyRemovedIds.includes(e.id));
      const toTomorrow = prev.filter(e => e.dueDate === tomorrowStr && !manuallyRemovedIds.includes(e.id));
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
      if (t.due === tomorrowStr && !tomorrowIds.find(e=>e.id===t.id) && !todayIds.includes(t.id) && !manuallyRemovedIds.includes(t.id)) {
        setTomorrowIds(p => p.find(e=>e.id===t.id) ? p : [...p, {id:t.id,addedDate:today}]);
      }
    });
  }, [tasks, manuallyRemovedIds]);

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
              const newId = Date.now();
              const todayDate = todayStr();
              const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate()+1);
              const tomorrowDateStr = tomorrowDate.toISOString().split("T")[0];
              setTasks(p => [...p, { ...t, id:newId, status:"À faire", due:newDue, completion:null, num:newNum }]);
              if (newDue === todayDate) {
                setTodayIds(p => p.includes(newId) ? p : [...p, newId]);
                setTodayDates(d => ({...d, [newId]: todayDate}));
                setHighlighted(p => p.includes(newId) ? p : [...p, newId]);
              } else if (newDue === tomorrowDateStr) {
                setTomorrowIds(p => p.find(e=>e.id===newId) ? p : [...p, {id:newId, addedDate:todayDate}]);
                setHighlighted(p => p.includes(newId) ? p : [...p, newId]);
              }
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
    setManuallyRemovedIds(p => p.filter(i => i!==id));
    setTodayDates(d => ({...d, [id]:todayStr()}));
    setTodayIds(p => p.includes(id) ? p : [...p, id]);
    setHighlighted(p => p.includes(id) ? p : [...p, id]);
    setTasks(p => p.map(t => t.id===id&&t.status==="Terminé" ? {...t,status:"À faire"} : t));
  };
  const removeFromToday = (id) => {
    setManuallyRemovedIds(p => p.includes(id) ? p : [...p, id]);
    setTodayDates(d => { const n={...d}; delete n[id]; return n; });
    setTodayIds(p => p.filter(i => i!==id));
    setModal(null);
  };
  const addToTomorrow = (id) => {
    setManuallyRemovedIds(p => p.filter(i => i!==id));
    setTomorrowIds(p => p.find(e=>e.id===id) ? p : [...p, {id, addedDate:todayStr()}]);
    setHighlighted(p => p.includes(id) ? p : [...p, id]);
    setTasks(p => p.map(t => t.id===id&&t.status==="Terminé" ? {...t,status:"À faire"} : t));
    setTodayIds(p => p.filter(i => i!==id));
  };
  const removeFromTomorrow = (id) => {
    setManuallyRemovedIds(p => p.includes(id) ? p : [...p, id]);
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
    const task = tasks.find(t => t.id === id);
    if (task) setDeletedTasks(p => [...p, { ...task, deletedAt: Date.now() }]);
    setTasks(p=>p.filter(t=>t.id!==id));
    setTodayIds(p=>p.filter(i=>i!==id));
    setTodayDates(d=>{const n={...d};delete n[id];return n;});
    setTomorrowIds(p=>p.filter(e=>e.id!==id));
    setScheduledIds(p=>p.filter(e=>e.id!==id));
    setHighlighted(p=>p.filter(i=>i!==id));
    setManuallyRemovedIds(p=>p.filter(i=>i!==id));
  };

  const restoreTask = (task) => {
    const newNum = taskCounter + 1;
    setTaskCounter(c => c + 1);
    const { deletedAt, ...rest } = task;
    setTasks(p => [...p, { ...rest, id:Date.now(), num:newNum, status:"À faire", completion:null }]);
    setDeletedTasks(p => p.filter(t => t.id !== task.id));
  };

  const permanentDeleteTask = (id) => {
    setDeletedTasks(p => p.filter(t => t.id !== id));
  };

  const duplicateTask = (task) => {
    const newNum = taskCounter + 1;
    setTaskCounter(c => c + 1);
    setTasks(p => [...p, {...task, id:Date.now(), status:"À faire", completion:null, num:newNum}]);
  };

  const toggleMemberVisible = async (taskId, currentValue) => {
    if (!team || !isAdminRole(teamRole)) return;
    const newValue = currentValue !== false ? false : true;
    const hiddenBy = newValue === false ? user.uid : null;
    try {
      await updateDoc(doc(db, "teams", team.id, "tasks", taskId), { memberVisible: newValue, hiddenBy });
      setTeamTasks(p => p.map(t => t.id === taskId ? {...t, memberVisible: newValue, hiddenBy} : t));
    } catch(e) { setTeamError(e.message); }
  };

  const duplicateTeamTask = async (task) => {
    if (!team || !isAdminRole(teamRole)) return;
    try {
      const newNum = (team.taskCounter || 0) + 1;
      await updateDoc(doc(db, "teams", team.id), { taskCounter: newNum });
      await addDoc(collection(db, "teams", team.id, "tasks"), {
        title: task.title, priority: task.priority||"Moyenne", status:"À faire",
        due: task.due||"", notes: task.notes||"", notify: task.notify!==false,
        recurrence: task.recurrence||"none", completion: null,
        id: Date.now(), num: newNum, createdBy: user.uid,
        createdAt: serverTimestamp(), scheduledFor: null,
        memberVisible: task.memberVisible !== false,
      });
      toast("Tâche dupliquée !");
    } catch(e) { setTeamError(e.message); }
  };

  const cancelStep2 = async () => {
    // Perso : la tâche a déjà été ajoutée à tasks → la retirer
    if (!teamSpace && pendingTask && !pendingMemberProposal) {
      setTasks(p => p.filter(t => t.id !== pendingTask.id));
      setTaskCounter(c => c - 1);
      setTodayIds(p => p.filter(i => i !== pendingTask.id));
      setTodayDates(d => { const n={...d}; delete n[pendingTask.id]; return n; });
      setTomorrowIds(p => p.filter(e => e.id !== pendingTask.id));
      setScheduledIds(p => p.filter(e => e.id !== pendingTask.id));
    }
    // Équipe admin : le doc Firestore a déjà été créé → le supprimer
    if (teamSpace && pendingTeamTaskId && team) {
      try { await deleteDoc(doc(db, "teams", team.id, "tasks", pendingTeamTaskId)); } catch(e) {}
    }
    setPendingMemberProposal(null);
    setPendingTeamTaskId(null);
    setPendingTask(null);
    setFormStep(1);
    setShowForm(false);
  };

  const openEdit = (task) => {
    setForm({title:task.title,priority:task.priority,status:task.status,due:task.due||"",notes:task.notes||"",notify:task.notify!==false,recurrence:task.recurrence||"none",memberVisible:task.memberVisible!==false});
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
          if (isAdminRole(teamRole)) {
            await updateDoc(doc(db, "teams", team.id, "tasks", editingId), cleanForm);
          } else {
            await addDoc(collection(db, "teams", team.id, "pendingChanges"), { type:"edit", taskId:editingId, proposedBy:user.uid, proposedByEmail:user.email||"", data:cleanForm, createdAt:serverTimestamp(), status:"pending" });
            setTeamInfo("Modification proposée à l'admin.");
          }
          setEditingId(null); setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none",memberVisible:true}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false);
        } else if (!isAdminRole(teamRole)) {
          setPendingMemberProposal(cleanForm);
          setPendingTask({ id: Date.now(), title: form.title });
          setFormStep(2);
        } else {
          const newNum = (team.taskCounter || 0) + 1;
          await updateDoc(doc(db, "teams", team.id), { taskCounter: newNum });
          const docRef = await addDoc(collection(db, "teams", team.id, "tasks"), { ...cleanForm, id:Date.now(), num:newNum, createdBy:user.uid, createdByEmail:user.email||"", createdAt:serverTimestamp(), memberVisible: form.memberVisible !== false, hiddenBy: form.memberVisible !== false ? null : user.uid });
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
        const updated = {...form, id:editingId, num:t.num, recurrence:form.recurrence||"none", attachments:t.attachments||[]};
        if (becomingDone) updated.completion = buildCompletion({...t, ...form});
        else if (form.status !== "Terminé") updated.completion = null;
        return updated;
      }));
      if (form.status==="Terminé") {
        setHighlighted(h=>h.filter(i=>i!==editingId));
        setTomorrowIds(p=>p.filter(e=>e.id!==editingId));
        setTodayIds(p=>p.filter(i=>i!==editingId));
      }
      setEditingId(null); setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none",memberVisible:true}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false);
    } else {
      const newNum = taskCounter + 1;
      setTaskCounter(c => c + 1);
      const newTask = {...form, id:Date.now(), num:newNum, attachments:[]};
      setTasks(prev=>[...prev,newTask]);
      if (quickSchedule) {
        const id = newTask.id;
        const today = todayStr();
        if (quickSchedule === "today")    setTodayIds(p => p.includes(id) ? p : [...p, id]);
        if (quickSchedule === "tomorrow") setTomorrowIds(p => p.find(e=>e.id===id) ? p : [...p, {id, addedDate:today}]);
        setQuickSchedule(null);
        setPendingTask(null); setFormStep(1);
        setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none",memberVisible:true}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false);
      } else {
        setPendingTask(newTask); setFormStep(2); setCustomDate("");
      }
    }
  };

  const applySchedule = async (choice, date) => {
    if (!pendingTask) return;

    const resetForm = () => { setPendingTask(null); setFormStep(1); setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none",memberVisible:true}); setRecurDay(""); setRecurMonthDay(""); setShowForm(false); };

    // ── Proposition membre équipe ──
    if (pendingMemberProposal && team) {
      const scheduled = choice === "today" ? "today" : choice === "tomorrow" ? "tomorrow" : (choice === "date" && date) ? date : null;
      try {
        await addDoc(collection(db, "teams", team.id, "pendingChanges"), { type:"add", proposedBy:user.uid, proposedByEmail:user.email||"", data:{...pendingMemberProposal, scheduledFor:scheduled}, createdAt:serverTimestamp(), status:"pending" });
        setTeamInfo("Tâche proposée à l'admin pour validation.");
      } catch(e) { setTeamError(e.message); }
      setPendingMemberProposal(null);
      resetForm();
      return;
    }

    // ── Tâche équipe (admin) ──
    if (pendingTeamTaskId && team) {
      const scheduled = choice === "today" ? "today" : choice === "tomorrow" ? "tomorrow" : (choice === "date" && date) ? date : null;
      try { await updateDoc(doc(db, "teams", team.id, "tasks", pendingTeamTaskId), { scheduledFor: scheduled }); } catch(e) {}
      setPendingTeamTaskId(null);
      resetForm();
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
    resetForm();
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
  const moveTeamTask = (firestoreId, scheduledFor) => {
    if (!team) return;
    updateDoc(doc(db, "teams", team.id, "tasks", firestoreId), { scheduledFor: scheduledFor ?? null }).catch(()=>{});
  };
  const onDragStartTeam = (e, taskId, src) => {
    dragRef.current = { id:taskId, src, isTeam:true };
    e.dataTransfer.effectAllowed = "move";
    const task = teamTasks.find(t => t.id === taskId);
    const dot  = STATUS_DOT[task?.status || "À faire"];
    const el   = document.createElement("div");
    el.style.cssText = `width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 35% 35%,${dot}cc,${dot});display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:#fff;position:fixed;top:-100px;left:-100px;`;
    el.textContent = String(task?.num || "?");
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 27, 27);
    setTimeout(()=>{ if(document.body.contains(el)) document.body.removeChild(el); }, 0);
  };
  const onDragEndTeam = (e) => {
    const {id, src} = dragRef.current; dragRef.current={}; setDropZone(null); if (!id||!team) return;
    if (leftRef.current) {
      const rect = leftRef.current.getBoundingClientRect();
      if (e.clientX > rect.right) { if(src==="team-today"||src==="team-tomorrow") moveTeamTask(id, null); return; }
      if (src==="team-today"    && e.clientY > rect.top+rect.height/2) { moveTeamTask(id,"tomorrow"); return; }
      if (src==="team-tomorrow" && e.clientY < rect.top+rect.height/2) { moveTeamTask(id,"today");    return; }
    }
  };
  const onDropToday    = (e) => { e.preventDefault(); const {id,src,isTeam}=dragRef.current; if(isTeam&&id)moveTeamTask(id,"today"); else { if(src==="list"&&id)addToToday(id); if(src==="bubble-tomorrow"&&id){removeFromTomorrow(id);addToToday(id);} } setDropZone(null); };
  const onDropTomorrow = (e) => { e.preventDefault(); const {id,src,isTeam}=dragRef.current; if(isTeam&&id)moveTeamTask(id,"tomorrow"); else { if((src==="list"||src==="bubble")&&id)addToTomorrow(id); } setDropZone(null); };
  const onDropBubble   = (e, targetId) => { e.preventDefault(); e.stopPropagation(); const {id,src}=dragRef.current; if(src==="bubble"&&id)reorderBubbles(id,targetId); setDropZone(null); };

  const DRAG_DELAY     = 250;  // ms — long press uniforme toutes sources
  const DRAG_THRESHOLD = 14;   // px — mouvement max avant activation (scroll sinon)
  const SCROLL_AXIS_THRESHOLD = 10; // px — si mouvement vertical dominant → scroll natif

  const onTouchStart = (e, id, src) => {
    const t = e.touches[0];
    dragRef.current = { id, src, startX:t.clientX, startY:t.clientY, curX:t.clientX, curY:t.clientY, moved:false, dragging:false };
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      const d = dragRef.current;
      if (d.id !== id) return;
      // Annuler si le doigt a trop bougé → intention de scroll
      if (Math.abs(d.curX - d.startX) > DRAG_THRESHOLD || Math.abs(d.curY - d.startY) > DRAG_THRESHOLD) return;
      d.dragging = true;
      setGhost({ id, src, x:d.curX, y:d.curY });
      if (navigator.vibrate) navigator.vibrate(18); // retour haptique
    }, DRAG_DELAY);
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    const d = dragRef.current;
    if (!d.id) return;
    d.curX = t.clientX; d.curY = t.clientY;
    if (!d.dragging) {
      // Si le doigt bouge trop avant l'activation → scroll natif, annuler drag
      const dx = Math.abs(t.clientX - d.startX);
      const dy = Math.abs(t.clientY - d.startY);
      // Scroll vertical dominant → intention de scroll, annuler immédiatement
      if (dy > SCROLL_AXIS_THRESHOLD && dy > dx) {
        clearTimeout(longPressTimer.current);
        dragRef.current = {};
        return;
      }
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        clearTimeout(longPressTimer.current);
        dragRef.current = {};
      }
      return; // laisser le scroll se faire
    }
    // En mode drag actif : bloquer le scroll et déplacer le ghost
    d.moved = true;
    setGhost({ id:d.id, src:d.src, x:t.clientX, y:t.clientY });
    setDropZone(getZoneAtPoint(t.clientX, t.clientY));
    e.preventDefault();
  };

  const onTouchEnd = (e) => {
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
    if (src==="team-today"&&zone==="tomorrow")    { moveTeamTask(id,"tomorrow"); return; }
    if (src==="team-today"&&zone==="list")         { moveTeamTask(id,null); return; }
    if (src==="team-tomorrow"&&zone==="today")     { moveTeamTask(id,"today"); return; }
    if (src==="team-tomorrow"&&zone==="list")      { moveTeamTask(id,null); return; }
    if (src==="team-list"&&zone==="today")         { moveTeamTask(id,"today"); return; }
    if (src==="team-list"&&zone==="tomorrow")      { moveTeamTask(id,"tomorrow"); return; }
  };
  onTouchEndRef.current = onTouchEnd;
  useEffect(() => {
    const h = (e) => { if (dragRef.current?.id) onTouchMove(e); };
    document.addEventListener("touchmove",h,{passive:false}); return () => document.removeEventListener("touchmove",h);
  }, []);
  useEffect(() => {
    const h = (e) => { if (dragRef.current?.id) onTouchEndRef.current(e); };
    document.addEventListener("touchend",h); return () => document.removeEventListener("touchend",h);
  }, []);

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
            <button onClick={()=>{setModal(null);setPjPopup({id:task.id,isTeam:false});}} style={{ background:(task.attachments||[]).length>0?theme.accent+"11":"transparent",border:`1px solid ${(task.attachments||[]).length>0?theme.accent+"33":theme.border}`,borderRadius:8,padding:"8px",color:(task.attachments||[]).length>0?theme.accent:theme.textMuted,fontSize:11,cursor:"pointer" }}>
              📎 {(task.attachments||[]).length>0?`Pièces jointes (${task.attachments.length})`:"Ajouter une pièce jointe"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFilePopup = () => {
    if (!filePopup) return null;
    const isImage = filePopup.type?.startsWith("image/");
    const isPdf   = filePopup.type === "application/pdf";
    return (
      <div onClick={() => setFilePopup(null)} style={{ position:"fixed",inset:0,background:"#000000cc",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400 }}>
        <div onClick={e => e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:14,padding:16,maxWidth:"92vw",maxHeight:"92vh",display:"flex",flexDirection:"column",gap:10,boxShadow:"0 0 40px #000000aa" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:16 }}>
            <span style={{ fontSize:11,color:theme.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{filePopup.name}</span>
            <div style={{ display:"flex",gap:8,flexShrink:0 }}>
              <a href={filePopup.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10,color:theme.accent,textDecoration:"none",border:`1px solid ${theme.accent}44`,borderRadius:5,padding:"3px 8px" }}>↗ Nouvel onglet</a>
              <button onClick={() => setFilePopup(null)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer",padding:0 }}>✕</button>
            </div>
          </div>
          {isImage && <img src={filePopup.url} alt={filePopup.name} style={{ maxWidth:"85vw",maxHeight:"80vh",objectFit:"contain",borderRadius:8 }} />}
          {isPdf   && <iframe src={filePopup.url} title={filePopup.name} style={{ width:"75vw",height:"75vh",border:"none",borderRadius:8 }} />}
          {!isImage && !isPdf && (
            <div style={{ fontSize:12,color:theme.textMuted,textAlign:"center",padding:"24px 0" }}>
              <div style={{ fontSize:28,marginBottom:8 }}>📄</div>
              <div style={{ marginBottom:12 }}>Prévisualisation non disponible pour ce type de fichier.</div>
              <a href={filePopup.url} target="_blank" rel="noopener noreferrer" style={{ color:theme.accent,fontSize:12,border:`1px solid ${theme.accent}44`,borderRadius:7,padding:"6px 16px",textDecoration:"none" }}>Télécharger / Ouvrir</a>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper: icône selon type MIME
  const attIcon = (type) => type?.startsWith("image/")?"🖼️":type==="application/pdf"?"📄":type?.includes("word")?"📝":type?.includes("excel")||type?.includes("spreadsheet")?"📊":"📎";

  // ── Popup PJ (perso et équipe) ────────────────────────────────────────────
  const renderPJPopup = () => {
    if (!pjPopup) return null;
    const { id: taskId, isTeam } = pjPopup;
    const task = isTeam ? teamTasks.find(t => t.id === taskId) : getTask(taskId);
    if (!task) return null;
    const canDeleteAny = !isTeam || isAdminRole(teamRole);
    return (
      <div onClick={()=>setPjPopup(null)} style={{ position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400 }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:22,width:320,maxHeight:"75vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <div style={{ fontSize:10,color:theme.accent,letterSpacing:2,fontWeight:700 }}>PIÈCES JOINTES ({(task.attachments||[]).length})</div>
            <button onClick={()=>setPjPopup(null)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer" }}>✕</button>
          </div>
          <div style={{ fontSize:11,color:theme.textMuted,marginBottom:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{task.title}</div>
          {(task.attachments||[]).length===0 && (
            <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"12px 0" }}>Aucune pièce jointe.</div>
          )}
          {(task.attachments||[]).map((att,i) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:8,background:theme.bg,borderRadius:7,padding:"7px 9px",marginBottom:5 }}>
              <span style={{ fontSize:14,flexShrink:0 }}>{attIcon(att.type)}</span>
              <span style={{ fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:theme.text }}>{att.name}</span>
              {isTeam && <span style={{ fontSize:9,color:theme.textMuted,flexShrink:0 }}>{att.uploadedByEmail?.split("@")[0]}</span>}
              <button onClick={()=>setFilePopup(att)} style={{ background:"transparent",border:`1px solid ${theme.accent}44`,borderRadius:5,padding:"2px 6px",color:theme.accent,fontSize:10,cursor:"pointer",flexShrink:0 }}>Ouvrir</button>
              {(canDeleteAny || att.uploadedBy===user?.uid) && (
                <button onClick={()=>deleteAttachment(taskId,att,isTeam)} style={{ background:"transparent",border:"none",color:"#aa3030",fontSize:11,cursor:"pointer",flexShrink:0 }}>✕</button>
              )}
            </div>
          ))}
          <label style={{ display:"flex",alignItems:"center",gap:6,background:theme.accent+"22",border:`1px solid ${theme.accent}44`,borderRadius:7,padding:"7px 10px",cursor:"pointer",fontSize:11,color:theme.accent,marginTop:8 }}>
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.eml,.msg" style={{ display:"none" }}
              onChange={e=>{ Array.from(e.target.files).forEach(f=>uploadAttachment(taskId,f,isTeam)); e.target.value=""; }}/>
            {uploadingAttachment?"⏳ Envoi…":"📎 Ajouter une pièce jointe"}
          </label>
          {isTeam && !isAdminRole(teamRole) && (
            <div style={{ fontSize:9,color:theme.textMuted,marginTop:6,textAlign:"center" }}>Les ajouts sont soumis à validation de l'admin.</div>
          )}
        </div>
      </div>
    );
  };

  // ── Popup Commentaires (équipe uniquement) ────────────────────────────────
  const renderCommentPopup = () => {
    if (!commentPopup || !team) return null;
    const task = teamTasks.find(t => t.id === commentPopup);
    if (!task) return null;
    const close = () => { setCommentPopup(null); setCommentInput(""); };
    return (
      <div onClick={close} style={{ position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400 }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:22,width:330,maxHeight:"78vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099",display:"flex",flexDirection:"column" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ fontSize:10,color:theme.accent,letterSpacing:2,fontWeight:700 }}>COMMENTAIRES ({teamComments.length})</div>
            <button onClick={close} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer" }}>✕</button>
          </div>
          <div style={{ fontSize:11,color:theme.textMuted,marginBottom:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{task.title}</div>
          <div style={{ display:"flex",flexDirection:"column",gap:7,marginBottom:12,flex:1 }}>
            {teamComments.length===0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"12px 0" }}>Pas encore de commentaire.</div>}
            {teamComments.map(c => (
              <div key={c.id} style={{ background:theme.bg,borderRadius:8,padding:"8px 10px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3 }}>
                  <span style={{ fontSize:10,color:theme.accent,fontWeight:600 }}>{c.authorName}</span>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <span style={{ fontSize:9,color:theme.textMuted }}>{new Date(c.createdAt).toLocaleString(locale,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                    {(isAdminRole(teamRole) || c.authorUid===user?.uid) && (
                      <button onClick={()=>deleteComment(c.id,c.authorUid)} style={{ background:"transparent",border:"none",color:"#aa3030",fontSize:10,cursor:"pointer",padding:0,lineHeight:1 }}>✕</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize:11,color:theme.text,lineHeight:1.5 }}>{c.text}</div>
              </div>
            ))}
          </div>
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
    const isTeam = ghost.src?.startsWith("team-");
    const task = isTeam ? teamTasks.find(t=>t.id===ghost.id) : getTask(ghost.id);
    if (!task) return null;
    const col = STATUS_DOT[task.status];
    const num = isTeam ? task.num : taskNum(ghost.id);
    return (
      <div ref={ghostRef} style={{ position:"fixed",left:ghost.x-29,top:ghost.y-29,width:58,height:58,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${col}cc,${col})`,boxShadow:`0 0 24px ${col}99`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#fff",zIndex:999,pointerEvents:"none",opacity:0.85,transform:"scale(1.15)" }}>
        {num}
      </div>
    );
  };

  const renderTeamStats = () => {
    const total     = teamTasks.length;
    const doneCount = teamTasks.filter(t => t.status === "Terminé").length;
    const active    = teamTasks.filter(t => t.status !== "Terminé").length;
    const rate      = total > 0 ? Math.round((doneCount/total)*100) : 0;
    const scheduled = teamTasks.filter(t => t.scheduledFor === "today").length;
    const SR = ({ emoji, label, value, color, onClick }) => (
      <div onClick={onClick} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${theme.border}44`,cursor:onClick?"pointer":"default" }}>
        <span style={{ fontSize:11,color:theme.textMuted }}>{emoji} {label}{onClick?" →":""}</span>
        <span style={{ fontSize:13,fontWeight:700,color:color||theme.text }}>{value}</span>
      </div>
    );
    return (
      <div>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:2 }}>AVANCEMENT ÉQUIPE</div>
          <div style={{ height:8,background:theme.border,borderRadius:4,overflow:"hidden" }}>
            <div style={{ height:"100%",width:rate+"%",background:rate>70?"#3aaa3a":rate>40?"#ccaa00":"#cc3030",borderRadius:4,transition:"width .5s" }}/>
          </div>
          <div style={{ fontSize:11,color:theme.text,marginTop:4,textAlign:"right",fontWeight:700 }}>{rate}%</div>
        </div>
        <SR emoji="📋" label="Total tâches"     value={total} />
        <SR emoji="✅" label="Terminées"         value={`${doneCount}/${total}`} color="#3aaa3a" onClick={()=>{setShowTeamDone(true);setShowStats(false);}} />
        <SR emoji="⏳" label="En cours / À faire" value={active} color={theme.accent} />
        {scheduled > 0 && <SR emoji="☀️" label="Planif. aujourd'hui" value={scheduled} />}
        {(team?.members||[]).length > 0 && <SR emoji="👥" label="Membres" value={(team?.members||[]).length} />}
        {total === 0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"20px 0" }}>Aucune tâche dans l'équipe</div>}
        {isAdminRole(teamRole) && deletedTeamTasks.length > 0 && <SR emoji="🗑️" label="Corbeille équipe" value={deletedTeamTasks.length} color="#cc3030" onClick={()=>{setShowTeamBin(true);setShowStats(false);}} />}
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
        {deletedTasks.length > 0 && <StatRow emoji="🗑️" label="Corbeille" value={deletedTasks.length} color="#cc3030" onClick={()=>{setShowBin(true);setShowStats(false);}} />}
      </>
    );
  };

  // ─── JSX Return ────────────────────────────────────────────────────

  if (authLoading) return (
    <div style={{ height:"100vh", background:"#0e0e1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
      <img src="/favicon.svg" alt="logo" style={{ width:48, height:48, opacity:0.5, animation:"pulse 1.5s infinite" }} />
    </div>
  );

  if (!user) return (
    <div style={{ height:"100vh", background:"#0e0e1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono','Courier New',monospace", color:"#c8c8e8" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
      <img src="/favicon.svg" alt="logo" style={{ width:56, height:56, marginBottom:24 }} />
      <div style={{ fontSize:20, fontWeight:800, letterSpacing:3, color:"#E8630A", marginBottom:8 }}>TASK TRACKER PRO</div>
      <div style={{ fontSize:12, color:"#666688", marginBottom:32 }}>Connectez-vous pour accéder à vos tâches</div>
      {authError && <div style={{ color:"#ff6b6b", fontSize:11, marginBottom:12, maxWidth:280, textAlign:"center" }}>{authError}</div>}
      {authInfo  && <div style={{ color:"#6bcb77", fontSize:11, marginBottom:12, maxWidth:280, textAlign:"center" }}>{authInfo}</div>}
      <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:16, padding:"28px 32px", width:"100%", maxWidth:320 }}>
        <div style={{ display:"flex", marginBottom:20, borderRadius:8, overflow:"hidden", border:"1px solid #2a2a4a" }}>
          <button onClick={()=>{setEmailMode("login");setAuthError(null);}} style={{ flex:1, padding:"8px 0", background:emailMode==="login"?"#E8630A":"transparent", border:"none", color:emailMode==="login"?"#fff":"#666688", fontSize:12, cursor:"pointer" }}>Connexion</button>
          <button onClick={()=>{setEmailMode("register");setAuthError(null);}} style={{ flex:1, padding:"8px 0", background:emailMode==="register"?"#E8630A":"transparent", border:"none", color:emailMode==="register"?"#fff":"#666688", fontSize:12, cursor:"pointer" }}>Inscription</button>
        </div>
        <input type="email" placeholder="Email" value={emailForm.email} onChange={e=>setEmailForm(f=>({...f,email:e.target.value}))} style={{ width:"100%", padding:"10px 12px", background:"#0e0e1a", border:"1px solid #2a2a4a", borderRadius:8, color:"#c8c8e8", fontSize:13, marginBottom:10, boxSizing:"border-box" }} />
        <div style={{ position:"relative", marginBottom:16 }}>
          <input type={showPassword?"text":"password"} placeholder="Mot de passe" value={emailForm.password} onChange={e=>setEmailForm(f=>({...f,password:e.target.value}))}
            onKeyDown={e=>{ if(e.key==="Enter") loginEmail(); }}
            style={{ width:"100%", padding:"10px 12px", paddingRight:42, background:"#0e0e1a", border:"1px solid #2a2a4a", borderRadius:8, color:"#c8c8e8", fontSize:13, boxSizing:"border-box" }} />
          <button onClick={()=>setShowPassword(s=>!s)} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#666688",cursor:"pointer",padding:0,lineHeight:1 }}>
            {showPassword
              ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>
        {emailMode==="login" && <div style={{ textAlign:"right",marginTop:-10,marginBottom:14 }}><span onClick={sendPasswordReset} style={{ fontSize:11,color:"#E8630A",cursor:"pointer" }}>Mot de passe oublié ?</span></div>}
        <button onClick={loginEmail} style={{ width:"100%", padding:"11px 0", background:"#E8630A", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
          {emailMode==="login"?"Se connecter":"Créer un compte"}
        </button>
        <button onClick={loginGoogle} style={{ width:"100%", padding:"10px 12px", background:"#fff", border:"1px solid #dadce0", borderRadius:8, color:"#3c4043", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuer avec Google
        </button>
        {unverifiedEmail && (
          <button onClick={resendVerification} style={{ width:"100%", marginTop:10, padding:"8px 0", background:"transparent", border:"1px solid #E8630A44", borderRadius:8, color:"#E8630A", fontSize:11, cursor:"pointer" }}>
            Renvoyer l'email de vérification
          </button>
        )}
      </div>
    </div>
  );

  const renderTodayStr = todayStr();
  const renderTomDate = new Date(); renderTomDate.setDate(renderTomDate.getDate()+1);
  const renderTomorrowStr = renderTomDate.toISOString().split("T")[0];

  return (
    <div onContextMenu={e=>e.preventDefault()} style={{ height:"100vh", overflow:"hidden", background:theme.bg, fontFamily:`'${theme.font}','Courier New',monospace`, color:theme.text, display:"flex", flexDirection:"column", userSelect:"none", WebkitUserSelect:"none", "--date-icon-invert": theme.mode==="dark"?"1":"0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&family=Space+Mono:wght@400;700&family=Inter:wght@400;500&family=Roboto+Mono:wght@400;500&family=Bebas+Neue&family=Oswald:wght@600;700&family=Rajdhani:wght@600;700&family=Orbitron:wght@700;800&family=Playfair+Display:wght@400;600;700&family=Cormorant+Garamond:wght@400;600;700&display=swap');
        * { box-sizing:border-box; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; -webkit-user-select:none; user-select:none; }
        html, body { height:100%; overflow:hidden; margin:0; padding:0; }
        #root { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
        ::placeholder { color:#444466; }
        input,textarea,select { outline:none; user-select:text; -webkit-touch-callout:default; }
        button { touch-action:manipulation; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(var(--date-icon-invert, 0)); cursor:pointer; }
        @media (hover: hover) { .row:hover { box-shadow: inset 0 0 0 9999px rgba(0,0,0,0.07); } }
        .bubble { transition:transform .12s; cursor:grab; touch-action:none; }
        .bubble:hover { transform:scale(1.08); }
        .bubble.over { transform:scale(1.18); box-shadow:0 0 20px #5050dd88 !important; }
        .delbtn:hover { background:#3a1a1a !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        body { overflow-x:hidden; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: isMobile ? "8px 12px 0" : "20px 28px 14px",
        borderBottom:`1px solid ${theme.border}`,
        display:"flex",
        flexDirection: "column",
        position: "relative",
      }}>
        {isMobile ? (
          <>
            {/* Mobile ligne 1 : logo + titre + avatar */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
              <img src="/favicon.svg" alt="logo" style={{ width:22, height:22, flexShrink:0 }} />
              <div style={{ fontFamily:`'${theme.titleFont}',sans-serif`, fontSize:14, fontWeight:800, color:theme.accent, letterSpacing:1, flex:1 }}>TASK TRACKER PRO</div>
              {syncing && <span style={{ fontSize:9, color:theme.textMuted }}>↑</span>}
              {syncError && <span style={{ fontSize:9, color:"#cc3030", background:"#cc303022", borderRadius:4, padding:"2px 6px" }}>⚠ sync</span>}
              {/* Avatar / login */}
              {user ? (
                <div style={{ position:"relative" }}>
                  {showUserMenu && <div style={{ position:"fixed",inset:0,zIndex:299 }} onClick={()=>setShowUserMenu(false)}/>}
                  <div onClick={()=>setShowUserMenu(s=>!s)} style={{ cursor:"pointer" }}>
                    {(userPhotoURL||user.photoURL)
                      ? <img src={userPhotoURL||user.photoURL} alt="" style={{ width:28, height:28, borderRadius:"50%", border:`2px solid ${theme.accent}55`, display:"block", objectFit:"cover" }} />
                      : <div style={{ width:28,height:28,borderRadius:"50%",background:theme.accent+"33",border:`2px solid ${theme.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:theme.accent }}>
                          {(user.displayName||user.email||"?")[0].toUpperCase()}
                        </div>
                    }
                  </div>
                  {showUserMenu && (
                    <div style={{ position:"absolute",top:"calc(100% + 8px)",right:0,background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:12,padding:8,zIndex:300,minWidth:190,boxShadow:"0 8px 40px #00000099" }}>
                      <div style={{ fontSize:11,color:theme.textMuted,padding:"6px 10px",borderBottom:`1px solid ${theme.border}44`,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180 }}>{userPseudo || user.displayName || user.email}</div>
                      {editingPseudo ? (
                        <div style={{ display:"flex",gap:4,padding:"4px 6px",borderBottom:`1px solid ${theme.border}22`,marginBottom:2 }}>
                          <input autoFocus value={pseudoInput} onChange={e=>setPseudoInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")savePseudo(pseudoInput);if(e.key==="Escape"){setEditingPseudo(false);setPseudoInput("");}}} placeholder="Ton pseudo…" style={{ flex:1,background:theme.bg,border:`1px solid ${theme.accent}66`,borderRadius:6,padding:"5px 8px",color:theme.text,fontSize:12,outline:"none" }} />
                          <button onClick={()=>savePseudo(pseudoInput)} style={{ background:theme.accent,border:"none",borderRadius:6,padding:"5px 8px",color:"#fff",fontSize:11,cursor:"pointer" }}>✓</button>
                          <button onClick={()=>{setEditingPseudo(false);setPseudoInput("");}} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:6,padding:"5px 7px",color:theme.textMuted,fontSize:11,cursor:"pointer" }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={()=>{setPseudoInput(userPseudo);setEditingPseudo(true);}} style={{ display:"block",width:"100%",background:"transparent",borderBottom:`1px solid ${theme.border}22`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:12,cursor:"pointer",textAlign:"left" }}>✏️ {userPseudo?"Modifier le pseudo":"Définir un pseudo"}</button>
                      )}
                      <label style={{ display:"block",width:"100%",background:"transparent",borderBottom:`1px solid ${theme.border}22`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:12,cursor:"pointer",textAlign:"left",boxSizing:"border-box" }}>
                        <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) uploadAvatar(e.target.files[0]); e.target.value=""; }}/>
                        {uploadingAvatar?"⏳ Envoi…":"🖼️ Changer l'avatar"}
                      </label>
                      <button onClick={logout} style={{ width:"100%",background:"transparent",border:"none",borderRadius:7,padding:"7px 10px",color:"#cc3030",fontSize:12,cursor:"pointer",textAlign:"left" }}>Se déconnecter</button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ position:"relative" }}>
                  {showAuthMenu && <div style={{ position:"fixed",inset:0,zIndex:299 }} onClick={()=>setShowAuthMenu(false)}/>}
                  <button onClick={()=>setShowAuthMenu(s=>!s)} style={{ background:theme.accent,border:"none",borderRadius:8,padding:"5px 9px",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                  </button>
                  {showAuthMenu && (
                    <div style={{ position:"absolute",top:"calc(100% + 8px)",right:0,background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:14,padding:14,zIndex:300,width:250,boxShadow:"0 8px 40px #00000099" }}>
                      {authInfo && <div style={{ fontSize:10,color:"#2a7a2a",marginBottom:10,padding:"6px 10px",background:"#2a7a2a22",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center" }}><span>{authInfo}</span><button onClick={()=>setAuthInfo(null)} style={{ background:"transparent",border:"none",color:"#2a7a2a",cursor:"pointer",fontSize:12 }}>✕</button></div>}
                      {authError && <div style={{ fontSize:10,color:"#cc3030",marginBottom:6,padding:"6px 10px",background:"#cc303022",borderRadius:8 }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}><span>{authError}</span><button onClick={()=>{setAuthError(null);setUnverifiedEmail(null);}} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer",fontSize:12 }}>✕</button></div>{unverifiedEmail&&emailForm.password&&<button onClick={resendVerification} style={{ marginTop:6,fontSize:10,color:"#cc3030",background:"transparent",border:"1px solid #cc303066",borderRadius:6,padding:"3px 8px",cursor:"pointer" }}>Renvoyer l'email de vérification</button>}</div>}
                      <button onClick={loginGoogle} style={{ width:"100%",background:theme.mode==="dark"?"#1a1a2e":"#fff",border:`1px solid ${theme.border}`,borderRadius:9,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,marginBottom:7,color:theme.text,fontSize:12 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Continuer avec Google
                      </button>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}><div style={{ flex:1,height:1,background:theme.border }}/><span style={{ fontSize:10,color:theme.textMuted }}>ou</span><div style={{ flex:1,height:1,background:theme.border }}/></div>
                      <div style={{ display:"flex",gap:4,marginBottom:8 }}>{[{v:"login",l:"Connexion"},{v:"register",l:"Inscription"}].map(({v,l})=>(<button key={v} onClick={()=>setEmailMode(v)} style={{ flex:1,background:emailMode===v?theme.accent+"22":"transparent",border:`1px solid ${emailMode===v?theme.accent:theme.border}`,borderRadius:7,padding:"5px",color:emailMode===v?theme.accent:theme.textMuted,fontSize:10,cursor:"pointer" }}>{l}</button>))}</div>
                      <input type="email" placeholder="Email" value={emailForm.email} onChange={e=>setEmailForm(f=>({...f,email:e.target.value}))} style={{ width:"100%",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:13,marginBottom:6 }} />
                      <div style={{ display:"flex",gap:6 }}>
                        <div style={{ position:"relative",flex:1 }}>
                          <input type={showPassword?"text":"password"} placeholder="Mot de passe" value={emailForm.password} onChange={e=>setEmailForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&loginEmail()} style={{ width:"100%",paddingRight:32,background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"7px 10px",paddingRight:30,color:theme.text,fontSize:13 }} />
                          <button onClick={()=>setShowPassword(s=>!s)} style={{ position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:theme.textMuted,cursor:"pointer",padding:0,lineHeight:1 }}>
                            {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                          </button>
                        </div>
                        <button onClick={loginEmail} style={{ background:theme.accent,border:"none",borderRadius:7,padding:"7px 12px",color:"#fff",fontSize:12,cursor:"pointer" }}>→</button>
                      </div>
                      {emailMode==="login" && <div style={{ textAlign:"right",marginTop:5 }}><span onClick={sendPasswordReset} style={{ fontSize:10,color:theme.accent,cursor:"pointer" }}>Mot de passe oublié ?</span></div>}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Mobile ligne 2 : switcher + boutons d'action */}
            <div style={{ display:"flex", alignItems:"center", gap:6, paddingBottom:8 }}>
              {user && team ? (
                <div style={{ display:"flex", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:20, overflow:"hidden", fontSize:11, flex:1 }}>
                  <button onClick={()=>setTeamSpace(false)} style={{ flex:1,padding:"5px 10px", background:!teamSpace?theme.accent:"transparent", border:"none", color:!teamSpace?"#fff":theme.textMuted, cursor:"pointer", borderRadius:20, fontWeight:!teamSpace?700:400 }}>Perso</button>
                  <button onClick={()=>setTeamSpace(true)}  style={{ flex:1,padding:"5px 10px", background:teamSpace?theme.accent:"transparent", border:"none", color:teamSpace?"#fff":theme.textMuted, cursor:"pointer", borderRadius:20, fontWeight:teamSpace?700:400 }}>👥 {team.name.length > 8 ? team.name.slice(0,8)+"…" : team.name}</button>
                </div>
              ) : <div style={{ flex:1 }}/>}
              {/* Boutons icône */}
              {user && (
                <button onClick={()=>{setTeamPanelView("list");setShowTeam(s=>!s);setShowTheme(false);setShowStats(false);}} style={{ background:showTeam?theme.accent+"33":"transparent", border:`1px solid ${showTeam?theme.accent:theme.border}`, borderRadius:10, padding:"5px 10px", color:showTeam?theme.accent:theme.textMuted, fontSize:14, cursor:"pointer", position:"relative", flexShrink:0 }}>
                  👥
                  {isAdminRole(teamRole) && teamPending.length > 0 && (
                    <span style={{ position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:"50%",background:"#cc3030",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px" }}>{teamPending.length}</span>
                  )}
                </button>
              )}
              <button onClick={()=>{setShowStats(s=>!s);setShowTheme(false);if(teamSpace&&team)setStatsView("team");else setStatsView("perso");}} style={{ background:showStats?theme.accent+"33":"transparent", border:`1px solid ${showStats?theme.accent:theme.border}`, borderRadius:10, padding:"5px 10px", color:showStats?theme.accent:theme.textMuted, fontSize:14, cursor:"pointer", flexShrink:0 }}>📊</button>
              <button onClick={()=>{setShowTheme(s=>!s);setShowStats(false);}} style={{ background:showTheme?theme.accent+"33":"transparent", border:`1px solid ${showTheme?theme.accent:theme.border}`, borderRadius:10, padding:"5px 10px", color:showTheme?theme.accent:theme.textMuted, fontSize:14, cursor:"pointer", flexShrink:0 }}>⚙️</button>
            </div>
          </>
        ) : (
          /* Desktop : ligne unique inchangée */
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:14 }}>
            <div style={{ fontFamily:`'${theme.titleFont}',sans-serif`, fontSize:18, fontWeight:800, color:theme.accent, letterSpacing:3, whiteSpace:"nowrap" }}>TASK TRACKER PRO</div>
            <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none" }}>
              <img src="/favicon.svg" alt="logo" style={{ width:34, height:34, display:"block" }} />
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {syncing && <span style={{ fontSize:9, color:theme.textMuted }}>↑</span>}
              {syncError && <span style={{ fontSize:9, color:"#cc3030", background:"#cc303022", borderRadius:4, padding:"2px 6px" }}>⚠ sync</span>}
              {user && team && (
                <div style={{ display:"flex", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:8, overflow:"hidden", fontSize:10 }}>
                  <button onClick={()=>setTeamSpace(false)} style={{ padding:"5px 10px", background:!teamSpace?theme.accent:"transparent", border:"none", color:!teamSpace?"#fff":theme.textMuted, cursor:"pointer" }}>Perso</button>
                  <button onClick={()=>setTeamSpace(true)}  style={{ padding:"5px 10px", background:teamSpace?theme.accent:"transparent", border:"none", color:teamSpace?"#fff":theme.textMuted, cursor:"pointer" }}>👥 {team.name}</button>
                </div>
              )}
              {user && (
                <button onClick={()=>{setTeamPanelView("list");setShowTeam(s=>!s);setShowTheme(false);setShowStats(false);}} style={{ background:showTeam?theme.accent+"33":"transparent", border:`1px solid ${showTeam?theme.accent:theme.border}`, borderRadius:8, padding:"5px 10px", color:showTeam?theme.accent:theme.textMuted, fontSize:13, cursor:"pointer", position:"relative" }}>
                  👥
                  {isAdminRole(teamRole) && teamPending.length > 0 && (
                    <span style={{ position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:"50%",background:"#cc3030",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px" }}>{teamPending.length}</span>
                  )}
                </button>
              )}
              {user ? (
                <div style={{ position:"relative" }}>
                  {showUserMenu && <div style={{ position:"fixed",inset:0,zIndex:299 }} onClick={()=>setShowUserMenu(false)}/>}
                  <div onClick={()=>setShowUserMenu(s=>!s)} style={{ cursor:"pointer" }}>
                    {(userPhotoURL||user.photoURL)
                      ? <img src={userPhotoURL||user.photoURL} alt="" style={{ width:30, height:30, borderRadius:"50%", border:`2px solid ${theme.accent}55`, display:"block", objectFit:"cover" }} />
                      : <div style={{ width:30,height:30,borderRadius:"50%",background:theme.accent+"33",border:`2px solid ${theme.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:theme.accent }}>
                          {(user.displayName||user.email||"?")[0].toUpperCase()}
                        </div>
                    }
                  </div>
                  {showUserMenu && (
                    <div style={{ position:"absolute",top:"calc(100% + 8px)",right:0,background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:12,padding:8,zIndex:300,minWidth:190,boxShadow:"0 8px 40px #00000099" }}>
                      <div style={{ fontSize:11,color:theme.textMuted,padding:"6px 10px",borderBottom:`1px solid ${theme.border}44`,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180 }}>{userPseudo || user.displayName || user.email}</div>
                      {editingPseudo ? (
                        <div style={{ display:"flex",gap:4,padding:"4px 6px",borderBottom:`1px solid ${theme.border}22`,marginBottom:2 }}>
                          <input autoFocus value={pseudoInput} onChange={e=>setPseudoInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")savePseudo(pseudoInput);if(e.key==="Escape"){setEditingPseudo(false);setPseudoInput("");}}} placeholder="Ton pseudo…" style={{ flex:1,background:theme.bg,border:`1px solid ${theme.accent}66`,borderRadius:6,padding:"5px 8px",color:theme.text,fontSize:12,outline:"none" }} />
                          <button onClick={()=>savePseudo(pseudoInput)} style={{ background:theme.accent,border:"none",borderRadius:6,padding:"5px 8px",color:"#fff",fontSize:11,cursor:"pointer" }}>✓</button>
                          <button onClick={()=>{setEditingPseudo(false);setPseudoInput("");}} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:6,padding:"5px 7px",color:theme.textMuted,fontSize:11,cursor:"pointer" }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={()=>{setPseudoInput(userPseudo);setEditingPseudo(true);}} style={{ display:"block",width:"100%",background:"transparent",borderBottom:`1px solid ${theme.border}22`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:12,cursor:"pointer",textAlign:"left" }}>✏️ {userPseudo?"Modifier le pseudo":"Définir un pseudo"}</button>
                      )}
                      <label style={{ display:"block",width:"100%",background:"transparent",borderBottom:`1px solid ${theme.border}22`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:12,cursor:"pointer",textAlign:"left",boxSizing:"border-box" }}>
                        <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) uploadAvatar(e.target.files[0]); e.target.value=""; }}/>
                        {uploadingAvatar?"⏳ Envoi…":"🖼️ Changer l'avatar"}
                      </label>
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
                      {authInfo && <div style={{ fontSize:10,color:"#2a7a2a",marginBottom:10,padding:"6px 10px",background:"#2a7a2a22",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center" }}><span>{authInfo}</span><button onClick={()=>setAuthInfo(null)} style={{ background:"transparent",border:"none",color:"#2a7a2a",cursor:"pointer",fontSize:12 }}>✕</button></div>}
                      {authError && <div style={{ fontSize:10,color:"#cc3030",marginBottom:6,padding:"6px 10px",background:"#cc303022",borderRadius:8 }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}><span>{authError}</span><button onClick={()=>{setAuthError(null);setUnverifiedEmail(null);}} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer",fontSize:12 }}>✕</button></div>{unverifiedEmail&&emailForm.password&&<button onClick={resendVerification} style={{ marginTop:6,fontSize:10,color:"#cc3030",background:"transparent",border:"1px solid #cc303066",borderRadius:6,padding:"3px 8px",cursor:"pointer" }}>Renvoyer l'email de vérification</button>}</div>}
                      <button onClick={loginGoogle} style={{ width:"100%",background:theme.mode==="dark"?"#1a1a2e":"#fff",border:`1px solid ${theme.border}`,borderRadius:9,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,marginBottom:7,color:theme.text,fontSize:12 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Continuer avec Google
                      </button>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}><div style={{ flex:1,height:1,background:theme.border }}/><span style={{ fontSize:10,color:theme.textMuted }}>ou</span><div style={{ flex:1,height:1,background:theme.border }}/></div>
                      <div style={{ display:"flex",gap:4,marginBottom:8 }}>{[{v:"login",l:"Connexion"},{v:"register",l:"Inscription"}].map(({v,l})=>(<button key={v} onClick={()=>setEmailMode(v)} style={{ flex:1,background:emailMode===v?theme.accent+"22":"transparent",border:`1px solid ${emailMode===v?theme.accent:theme.border}`,borderRadius:7,padding:"5px",color:emailMode===v?theme.accent:theme.textMuted,fontSize:10,cursor:"pointer" }}>{l}</button>))}</div>
                      <input type="email" placeholder="Email" value={emailForm.email} onChange={e=>setEmailForm(f=>({...f,email:e.target.value}))} style={{ width:"100%",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"7px 10px",color:theme.text,fontSize:13,marginBottom:6 }} />
                      <div style={{ display:"flex",gap:6 }}>
                        <div style={{ position:"relative",flex:1 }}>
                          <input type={showPassword?"text":"password"} placeholder="Mot de passe" value={emailForm.password} onChange={e=>setEmailForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&loginEmail()} style={{ width:"100%",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"7px 10px",paddingRight:30,color:theme.text,fontSize:13 }} />
                          <button onClick={()=>setShowPassword(s=>!s)} style={{ position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:theme.textMuted,cursor:"pointer",padding:0,lineHeight:1 }}>
                            {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                          </button>
                        </div>
                        <button onClick={loginEmail} style={{ background:theme.accent,border:"none",borderRadius:7,padding:"7px 12px",color:"#fff",fontSize:12,cursor:"pointer" }}>→</button>
                      </div>
                      {emailMode==="login" && <div style={{ textAlign:"right",marginTop:5 }}><span onClick={sendPasswordReset} style={{ fontSize:10,color:theme.accent,cursor:"pointer" }}>Mot de passe oublié ?</span></div>}
                    </div>
                  )}
                </div>
              )}
              <button onClick={()=>{setShowStats(s=>!s);setShowTheme(false);if(teamSpace&&team)setStatsView("team");else setStatsView("perso");}} style={{ background:showStats?theme.accent+"33":"transparent", border:`1px solid ${showStats?theme.accent:theme.border}`, borderRadius:8, padding:"5px 12px", color:showStats?theme.accent:theme.textMuted, fontSize:13, cursor:"pointer", flexShrink:0 }}>📊</button>
              <button onClick={()=>{setShowTheme(s=>!s);setShowStats(false);}} style={{ background:showTheme?theme.accent+"33":"transparent", border:`1px solid ${showTheme?theme.accent:theme.border}`, borderRadius:8, padding:"5px 12px", color:showTheme?theme.accent:theme.textMuted, fontSize:13, cursor:"pointer", flexShrink:0 }}>⚙️</button>
            </div>
          </div>
        )}
      </div>

      {/* Ghost drag */}
      {renderGhost()}

      {/* Bannière invitation en attente */}
      {pendingInvite && (
        <div style={{ background:"#1a3a1a", borderBottom:`1px solid #2a6a2a`, padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <span style={{ fontSize:12, color:"#6bcb77" }}>📨 Invitation à rejoindre l'équipe <strong>{pendingInvite.teamName}</strong> (de {pendingInvite.invitedBy})</span>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={acceptInvite} disabled={inviteLoading} style={{ background:"#2a7a2a", border:"none", borderRadius:7, padding:"5px 14px", color:"#fff", fontSize:11, cursor:inviteLoading?"default":"pointer", opacity:inviteLoading?0.6:1 }}>{inviteLoading?"…":"Accepter"}</button>
            <button onClick={rejectInvite} disabled={inviteLoading} style={{ background:"transparent", border:"1px solid #2a6a2a", borderRadius:7, padding:"5px 14px", color:"#6bcb77", fontSize:11, cursor:inviteLoading?"default":"pointer", opacity:inviteLoading?0.6:1 }}>{inviteLoading?"…":"Refuser"}</button>
          </div>
        </div>
      )}

      {/* Split layout */}
      <div style={{ display:"flex", flex:1, flexDirection: isMobile ? "column" : "row", height:"calc(100vh - 61px)", overflow: "hidden" }}>

        {/* ── LEFT — masqué en mode équipe ── */}
        <div ref={leftRef} style={{ position: isMobile ? "sticky" : undefined, top: isMobile ? 0 : undefined, zIndex: isMobile ? 5 : undefined, background: isMobile ? theme.bgLeft : undefined, width: isMobile ? "100%" : "38%", borderRight: isMobile ? "none" : `1px solid ${theme.border}`, borderBottom: isMobile ? `1px solid ${theme.border}` : "none", display:"flex", flexDirection:"column", overflowY: isMobile ? "visible" : "auto", flexShrink:0 }}>

          {teamSpace && team ? (<>
            {/* TODAY — équipe */}
            <div onDragOver={e=>{e.preventDefault();setDropZone("today");}} onDrop={onDropToday}
              style={{ flex:1, padding:"18px 16px", background:isOverToday?theme.accent+"22":theme.bgLeft, borderBottom:`1px solid ${theme.border}`, display:"flex", flexDirection:"column", transition:"background .2s", minHeight: isMobile ? 0 : "45%", overflow: "visible" }}>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontFamily:`'${theme.titleFont}',sans-serif`, fontSize:12, fontWeight:900, color:theme.accent, letterSpacing:3 }}>AUJOURD'HUI</div>
                <div style={{ fontSize:10, color:theme.textMuted, marginTop:3 }}>
                  {teamTasks.filter(t=>(t.scheduledFor==="today"||t.due===renderTodayStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length===0 ? (isAdminRole(teamRole)?"Glisse des tâches ici":"Aucune tâche planifiée") : `${teamTasks.filter(t=>(t.scheduledFor==="today"||t.due===renderTodayStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length} tâche${teamTasks.filter(t=>(t.scheduledFor==="today"||t.due===renderTodayStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length>1?"s":""}`}
                </div>
              </div>
              {teamTasks.filter(t=>(t.scheduledFor==="today"||t.due===renderTodayStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length===0 ? (
                <div style={{ flex:1, border:`2px dashed ${theme.border}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:5, color:theme.textMuted, fontSize:11 }}>
                  {isAdminRole(teamRole) && <><div style={{ fontSize:20 }}>←</div><div>glisse ici</div></>}
                </div>
              ) : (
                <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignContent:"flex-start", flex:1, padding:"6px 4px 6px 4px" }}>
                  {teamTasks.filter(t=>(t.scheduledFor==="today"||t.due===renderTodayStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).map(task => {
                    const tc = teamTaskColor(task);
                    const bCol = task.status==="Terminé"&&task.completion ? task.completion.color : (tc?tc.light:STATUS_DOT[task.status]||"#888");
                    return (
                      <div key={task.id} className="bubble"
                        draggable={isAdminRole(teamRole)}
                        onDragStart={isAdminRole(teamRole)?e=>onDragStartTeam(e,task.id,"team-today"):undefined}
                        onDragEnd={isAdminRole(teamRole)?onDragEndTeam:undefined}
                        onTouchStart={isAdminRole(teamRole)?e=>onTouchStart(e,task.id,"team-today"):undefined}
                        onClick={()=>setCommentPopup(task.id)}
                        style={{ width:54,height:54,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${bCol}cc,${bCol})`,boxShadow:`0 0 16px ${bCol}55`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:`'${theme.titleFont}',sans-serif`,fontWeight:800,fontSize:16,color:"#fff",cursor:"pointer",touchAction:"none",opacity:ghost?.id===task.id?0.2:1 }}>
                        {task.num}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TOMORROW — équipe */}
            <div data-zone="tomorrow" onDragOver={e=>{e.preventDefault();setDropZone("tomorrow");}} onDrop={onDropTomorrow}
              style={{ flex:1, padding:"18px 16px", background:dropZone==="tomorrow"?theme.accent+"11":theme.bgLeft+"cc", display:"flex", flexDirection:"column", transition:"background .2s", minHeight: isMobile ? 0 : "45%", overflow: "visible" }}>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontFamily:`'${theme.titleFont}',sans-serif`, fontSize:12, fontWeight:900, color:theme.accent, letterSpacing:3 }}>DEMAIN</div>
                <div style={{ fontSize:10, color:theme.textMuted, marginTop:3 }}>
                  {teamTasks.filter(t=>(t.scheduledFor==="tomorrow"||t.due===renderTomorrowStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length===0 ? (isAdminRole(teamRole)?"Glisse des tâches ici":"Aucune tâche planifiée") : `${teamTasks.filter(t=>(t.scheduledFor==="tomorrow"||t.due===renderTomorrowStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length} tâche${teamTasks.filter(t=>(t.scheduledFor==="tomorrow"||t.due===renderTomorrowStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length>1?"s":""}`}
                </div>
              </div>
              {teamTasks.filter(t=>(t.scheduledFor==="tomorrow"||t.due===renderTomorrowStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).length===0 ? (
                <div style={{ flex:1, border:`2px dashed ${theme.border}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:5, color:theme.textMuted, fontSize:11 }}>
                  {isAdminRole(teamRole) && <><div style={{ fontSize:20 }}>←</div><div>glisse ici</div></>}
                </div>
              ) : (
                <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignContent:"flex-start", flex:1, padding:"6px 4px 6px 4px" }}>
                  {teamTasks.filter(t=>(t.scheduledFor==="tomorrow"||t.due===renderTomorrowStr)&&t.status!=="Terminé"&&(t.memberVisible!==false||t.hiddenBy===user.uid)).map(task => {
                    const tc = teamTaskColor(task);
                    const bCol = task.status==="Terminé"&&task.completion ? task.completion.color : (tc?tc.light:STATUS_DOT[task.status]||"#888");
                    return (
                      <div key={task.id} className="bubble"
                        draggable={isAdminRole(teamRole)}
                        onDragStart={isAdminRole(teamRole)?e=>onDragStartTeam(e,task.id,"team-tomorrow"):undefined}
                        onDragEnd={isAdminRole(teamRole)?onDragEndTeam:undefined}
                        onTouchStart={isAdminRole(teamRole)?e=>onTouchStart(e,task.id,"team-tomorrow"):undefined}
                        onClick={()=>setCommentPopup(task.id)}
                        style={{ width:54,height:54,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${bCol}55,${bCol}77)`,boxShadow:`0 0 10px ${bCol}33`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:`'${theme.titleFont}',sans-serif`,fontWeight:800,fontSize:16,color:"#ffffff99",opacity:ghost?.id===task.id?0.2:0.7,border:`2px dashed ${bCol}66`,cursor:"pointer",touchAction:"none" }}>
                        {task.num}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </>) : (<>
            {/* TODAY — perso */}
            <div onDragOver={e=>{e.preventDefault();setDropZone("today");}} onDrop={onDropToday}
              style={{ flex:1, padding:"18px 16px", background:isOverToday?theme.accent+"22":theme.bgLeft, borderBottom:`1px solid ${theme.border}`, display:"flex", flexDirection:"column", transition:"background .2s", minHeight: isMobile ? 0 : "45%", overflow: "visible" }}>
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
                <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignContent:"flex-start", flex:1, padding:"6px 4px 6px 4px" }}>
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
                        style={{ width:54,height:54,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${bCol}cc,${bCol})`,boxShadow:`0 0 16px ${bCol}55`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:`'${theme.titleFont}',sans-serif`,fontWeight:800,fontSize:16,color:"#fff",opacity:ghost?.id===id?0.2:1,touchAction:"none" }}>
                        {taskNum(id)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TOMORROW — perso */}
            <div data-zone="tomorrow" onDragOver={e=>{e.preventDefault();setDropZone("tomorrow");}} onDrop={onDropTomorrow}
              style={{ flex:1, padding:"18px 16px", background:dropZone==="tomorrow"?theme.accent+"11":theme.bgLeft+"cc", display:"flex", flexDirection:"column", transition:"background .2s", minHeight: isMobile ? 0 : "45%", overflow: "visible" }}>
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
                <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignContent:"flex-start", flex:1, padding:"6px 4px 6px 4px" }}>
                  {tomorrowIds.map(({id}) => {
                    const task = getTask(id); if (!task) return null;
                    const tc2  = taskColor(task);
                    const bCol2 = task.status==="Terminé"&&task.completion ? task.completion.color : (tc2?tc2.light:STATUS_DOT[task.status]);
                    return (
                      <div key={id} className="bubble" draggable
                        onDragStart={e=>onDragStart(e,id,"bubble-tomorrow")} onDragEnd={onDragEnd}
                        onTouchStart={e=>onTouchStart(e,id,"bubble-tomorrow")}
                        onClick={()=>!dragRef.current?.moved&&setModal(id)}
                        style={{ width:54,height:54,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${bCol2}55,${bCol2}77)`,boxShadow:`0 0 10px ${bCol2}33`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:`'${theme.titleFont}',sans-serif`,fontWeight:800,fontSize:16,color:"#ffffff99",opacity:ghost?.id===id?0.2:0.7,border:`2px dashed ${bCol2}66`,touchAction:"none" }}>
                        {taskNum(id)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </>)}

        </div>{/* end LEFT */}

        {/* ── RIGHT ── */}
        <div onDragOver={e=>{e.preventDefault();setDropZone("list");}}
          style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* ── Contrôles fixes (desktop/tablet uniquement) ── */}
          {!isMobile && (
            <div style={{ flexShrink:0, background:theme.bg, padding:"20px 16px 0", zIndex:10 }}>

              {/* Top bar */}
              <div style={{ display:"flex", alignItems:"center", marginBottom:14, gap:8 }}>
                <button onClick={()=>{setShowForm(true);setEditingId(null);setFormStep(1);setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none",memberVisible:true}); setRecurDay(""); setRecurMonthDay("");}}
                  style={{ flex:1,background:theme.accent,border:"none",borderRadius:8,padding:"9px 16px",color:"#fff",fontSize:12,cursor:"pointer" }}>
                  {teamSpace && !isAdminRole(teamRole) ? "+ Proposer" : "+ Ajouter"}
                </button>
                <div style={{ position:"relative" }}>
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
                </div>
              </div>

              {/* Sort bar perso */}
              {!teamSpace && (
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
              )}

              {/* Header + Sort bar équipe */}
              {teamSpace && team && (
                <>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8 }}>
                    <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>TÂCHES — {team.name.toUpperCase()}</div>
                    <div style={{ display:"flex",gap:8 }}>
                      {isAdminRole(teamRole) && teamPending.length>0 && (
                        <button onClick={()=>setShowPendingPanel(true)}
                          style={{ background:"#f0c04022",border:"1px solid #f0c04066",borderRadius:8,padding:"5px 12px",color:"#f0c040",fontSize:11,cursor:"pointer",fontWeight:700 }}>
                          ⏳ En attente ({teamPending.length})
                        </button>
                      )}
                      {teamRole==="member" && (
                        <button onClick={()=>setShowMyPendingPanel(true)}
                          style={{ background:"#4a4a8a22",border:"1px solid #4a4a8a66",borderRadius:8,padding:"5px 12px",color:"#8888cc",fontSize:11,cursor:"pointer",fontWeight:700 }}>
                          📋 Mes propositions{myPendingProposals.length>0?` (${myPendingProposals.length})`:""}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10,flexWrap:"wrap" }}>
                    <span style={{ fontSize:9,color:theme.textMuted,letterSpacing:1 }}>TRIER :</span>
                    {[{v:"num",l:"N°"},{v:"priority",l:"Priorité"},{v:"due",l:"Échéance"},{v:"status",l:"Statut"}].map(({v,l})=>(
                      <button key={v} onClick={()=>{ if(teamSortBy===v){setTeamSortDir(d=>d==="asc"?"desc":"asc");}else{setTeamSortBy(v);setTeamSortDir("asc");} }}
                        style={{ background:teamSortBy===v?theme.accent+"33":"transparent",border:`1px solid ${teamSortBy===v?theme.accent:theme.border}`,borderRadius:5,padding:"3px 8px",color:teamSortBy===v?theme.accent:theme.textMuted,fontSize:10,cursor:"pointer" }}>
                        {l}{teamSortBy===v?(teamSortDir==="asc"?" ↑":" ↓"):""}
                      </button>
                    ))}
                    {teamSortBy && <button onClick={()=>setTeamSortBy(null)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:10,cursor:"pointer" }}>✕</button>}
                  </div>
                </>
              )}

            </div>
          )}

          {/* ── Zone scrollable (tâches uniquement) ── */}
          <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding: isMobile ? "12px 14px 180px" : `8px 16px ${teamSpace ? "100px" : "20px"}`, background:isOverList?"#0f1a0f":"transparent", transition:"background .2s" }}>

          {/* Form */}
          {showForm && (
            <div style={{ position:"fixed",inset:0,zIndex:320,background:"#000000bb",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}
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
                    <textarea placeholder="Notes..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value.slice(0,2000)})} rows={2} maxLength={2000}
                      style={{ background:theme.bg,border:`1px solid ${form.notes.length>=1900?"#cc3030":theme.border}`,borderRadius:7,padding:"7px 11px",color:theme.text,fontSize:16,resize:"none",width:"100%" }} />
                    {form.notes.length > 0 && <div style={{ fontSize:9,color:form.notes.length>=1900?"#cc3030":theme.textMuted,textAlign:"right",marginTop:2 }}>{form.notes.length}/2000</div>}
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
                            {recurDay && parseInt(recurDay) > 28 && <span style={{ fontSize:9,color:"#cc9900" }}>⚠ Certains mois n'ont pas ce jour — la tâche sautera ces mois-là.</span>}
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
                    {teamSpace && isAdminRole(teamRole) && (
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div onClick={()=>setForm(f=>({...f,memberVisible:f.memberVisible===false?true:false}))}
                          style={{ width:32,height:18,borderRadius:9,background:form.memberVisible!==false?theme.accent:theme.border,position:"relative",transition:"background .2s",cursor:"pointer" }}>
                          <div style={{ position:"absolute",top:2,left:form.memberVisible!==false?16:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px #0006" }}/>
                        </div>
                        <span style={{ fontSize:10,color:form.memberVisible!==false?theme.text:theme.textMuted }}>👁️ Visible par les membres</span>
                      </div>
                    )}
                    {/* ── PJ dans le formulaire de modification ── */}
                    {editingId !== null && (() => {
                      const editTask = teamSpace ? teamTasks.find(t=>t.id===editingId) : getTask(editingId);
                      if (!editTask) return null;
                      return (
                        <div style={{ borderTop:`1px solid ${theme.border}44`,paddingTop:10,marginTop:4 }}>
                          <div style={{ fontSize:9,color:"#444466",letterSpacing:1,marginBottom:6 }}>PIÈCES JOINTES ({(editTask.attachments||[]).length})</div>
                          {(editTask.attachments||[]).map((att,i) => (
                            <div key={i} style={{ display:"flex",alignItems:"center",gap:6,background:theme.bg,borderRadius:6,padding:"5px 8px",marginBottom:4 }}>
                              <span style={{ fontSize:12,flexShrink:0 }}>{attIcon(att.type)}</span>
                              <span style={{ fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:theme.text }}>{att.name}</span>
                              <button onClick={()=>setFilePopup(att)} style={{ background:"transparent",border:`1px solid ${theme.accent}44`,borderRadius:5,padding:"2px 6px",color:theme.accent,fontSize:9,cursor:"pointer",flexShrink:0 }}>Ouvrir</button>
                              {((!teamSpace)||isAdminRole(teamRole)||att.uploadedBy===user?.uid) && (
                                <button onClick={()=>deleteAttachment(editingId,att,teamSpace)} style={{ background:"transparent",border:"none",color:"#aa3030",fontSize:10,cursor:"pointer",flexShrink:0,padding:0 }}>✕</button>
                              )}
                            </div>
                          ))}
                          <label style={{ display:"flex",alignItems:"center",gap:5,background:theme.accent+"22",border:`1px solid ${theme.accent}44`,borderRadius:6,padding:"5px 9px",cursor:"pointer",fontSize:10,color:theme.accent }}>
                            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.eml,.msg" style={{ display:"none" }}
                              onChange={e=>{ Array.from(e.target.files).forEach(f=>uploadAttachment(editingId,f,teamSpace)); e.target.value=""; }}/>
                            {uploadingAttachment?"⏳ Envoi…":"📎 Ajouter une PJ"}
                          </label>
                        </div>
                      );
                    })()}
                    {/* ── Commentaires dans le formulaire de modification (équipe uniquement) ── */}
                    {editingId !== null && teamSpace && (() => {
                      return (
                        <div style={{ borderTop:`1px solid ${theme.border}44`,paddingTop:10,marginTop:4 }}>
                          <div style={{ fontSize:9,color:"#444466",letterSpacing:1,marginBottom:6 }}>COMMENTAIRES ({teamComments.length})</div>
                          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:8,maxHeight:140,overflowY:"auto" }}>
                            {teamComments.length===0 && <div style={{ fontSize:10,color:theme.textMuted,textAlign:"center",padding:"6px 0" }}>Pas encore de commentaire.</div>}
                            {teamComments.map(c => (
                              <div key={c.id} style={{ background:theme.bg,borderRadius:7,padding:"6px 8px" }}>
                                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2 }}>
                                  <span style={{ fontSize:9,color:theme.accent,fontWeight:600 }}>{c.authorName}</span>
                                  <div style={{ display:"flex",gap:5,alignItems:"center" }}>
                                    <span style={{ fontSize:8,color:theme.textMuted }}>{new Date(c.createdAt).toLocaleString(locale,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                                    {(isAdminRole(teamRole)||c.authorUid===user?.uid) && (
                                      <button onClick={()=>deleteComment(c.id,c.authorUid)} style={{ background:"transparent",border:"none",color:"#aa3030",fontSize:9,cursor:"pointer",padding:0,lineHeight:1 }}>✕</button>
                                    )}
                                  </div>
                                </div>
                                <div style={{ fontSize:10,color:theme.text,lineHeight:1.4 }}>{c.text}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display:"flex",gap:6 }}>
                            <input value={commentInput} onChange={e=>setCommentInput(e.target.value)} placeholder="Ajouter un commentaire…"
                              onKeyDown={e=>e.key==="Enter"&&addComment()}
                              style={{ flex:1,background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:7,padding:"6px 8px",color:theme.text,fontSize:10,outline:"none" }}/>
                            <button onClick={addComment} style={{ background:theme.accent,border:"none",borderRadius:7,padding:"6px 10px",color:"#fff",fontSize:12,cursor:"pointer" }}>↑</button>
                          </div>
                        </div>
                      );
                    })()}
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
                  <div style={{ fontSize:11,color:theme.textMuted,marginBottom:4 }}>"{pendingTask?.title}"</div>
                  {pendingMemberProposal && <div style={{ fontSize:10,color:theme.textMuted,marginBottom:12,fontStyle:"italic" }}>Cette proposition sera envoyée à l'admin après la planification.</div>}
                  {/* Pièces jointes — perso ou admin équipe uniquement */}
                  {(!teamSpace || pendingTeamTaskId) && (
                    <div style={{ marginBottom:12 }}>
                      {((teamSpace ? teamTasks.find(t=>t.id===pendingTask.id) : getTask(pendingTask.id))?.attachments||[]).map((att,i) => (
                        <div key={i} style={{ display:"flex",alignItems:"center",gap:6,fontSize:10,color:theme.textMuted,marginBottom:3 }}>
                          <span style={{ flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>📎 {att.name}</span>
                          <button onClick={()=>deleteAttachment(pendingTask.id,att,teamSpace)} style={{ background:"transparent",border:"none",color:"#aa3030",fontSize:11,cursor:"pointer",flexShrink:0 }}>✕</button>
                        </div>
                      ))}
                      <label style={{ display:"flex",alignItems:"center",gap:6,background:theme.accent+"22",border:`1px solid ${theme.accent}44`,borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:11,color:theme.accent }}>
                        <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.eml,.msg" style={{ display:"none" }}
                          onChange={e=>{
                            Array.from(e.target.files).forEach(f=>uploadAttachment(pendingTask.id,f,teamSpace));
                            e.target.value="";
                          }}/>
                        {uploadingAttachment?"⏳ Envoi…":"📎 Ajouter des pièces jointes"}
                      </label>
                    </div>
                  )}
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
                  <div style={{ display:"flex",justifyContent:"flex-end",marginTop:10 }}>
                    <button onClick={cancelStep2}
                      style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:7,padding:"5px 13px",color:theme.textMuted,fontSize:11,cursor:"pointer" }}>Annuler</button>
                  </div>
                </>
              )}

            </div>
            </div>
          )}

          {/* ── ESPACE ÉQUIPE ── */}
          {teamSpace && team && (
            <div style={{ marginBottom:16 }}>
              {isMobile && (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8 }}>
                <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>TÂCHES — {team.name.toUpperCase()}</div>
                <div style={{ display:"flex",gap:8,flex:isMobile&&teamRole==="member"?1:undefined,justifyContent:isMobile&&teamRole==="member"?"center":undefined }}>
                  {isAdminRole(teamRole) && teamPending.length>0 && (
                    <button onClick={()=>setShowPendingPanel(true)}
                      style={{ background:"#f0c04022",border:"1px solid #f0c04066",borderRadius:8,padding:"5px 12px",color:"#f0c040",fontSize:11,cursor:"pointer",fontWeight:700 }}>
                      ⏳ En attente ({teamPending.length})
                    </button>
                  )}
                  {teamRole==="member" && (
                    <button onClick={()=>setShowMyPendingPanel(true)}
                      style={{ background:"#4a4a8a22",border:"1px solid #4a4a8a66",borderRadius:8,padding:"5px 12px",color:"#8888cc",fontSize:11,cursor:"pointer",fontWeight:700 }}>
                      📋 Mes propositions{myPendingProposals.length>0?` (${myPendingProposals.length})`:""}
                    </button>
                  )}
                </div>
              </div>
              )}
              {teamError && <div style={{ fontSize:10,color:"#cc3030",background:"#cc303022",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamError}</span><button onClick={()=>setTeamError(null)} style={{ background:"transparent",border:"none",color:"#cc3030",cursor:"pointer" }}>✕</button></div>}
              {teamInfo  && <div style={{ fontSize:10,color:"#3aaa3a",background:"#3aaa3a22",borderRadius:8,padding:"6px 10px",marginBottom:10,display:"flex",justifyContent:"space-between" }}><span>{teamInfo}</span><button onClick={()=>setTeamInfo(null)} style={{ background:"transparent",border:"none",color:"#3aaa3a",cursor:"pointer" }}>✕</button></div>}
              {teamTasks.filter(t=>t.status!=="Terminé").length === 0 && teamTasks.length === 0 && <div style={{ color:theme.textMuted,fontSize:12,textAlign:"center",padding:30 }}>{isAdminRole(teamRole)?"Aucune tâche — créez la première ci-dessus.":"Aucune tâche pour l'instant."}</div>}
              {/* Sort bar équipe */}
              {isMobile && <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10,flexWrap:"wrap" }}>
                <span style={{ fontSize:9,color:theme.textMuted,letterSpacing:1 }}>TRIER :</span>
                {[{v:"num",l:"N°"},{v:"priority",l:"Priorité"},{v:"due",l:"Échéance"},{v:"status",l:"Statut"}].map(({v,l})=>(
                  <button key={v} onClick={()=>{ if(teamSortBy===v){setTeamSortDir(d=>d==="asc"?"desc":"asc");}else{setTeamSortBy(v);setTeamSortDir("asc");} }}
                    style={{ background:teamSortBy===v?theme.accent+"33":"transparent",border:`1px solid ${teamSortBy===v?theme.accent:theme.border}`,borderRadius:5,padding:"3px 8px",color:teamSortBy===v?theme.accent:theme.textMuted,fontSize:10,cursor:"pointer" }}>
                    {l}{teamSortBy===v?(teamSortDir==="asc"?" ↑":" ↓"):""}
                  </button>
                ))}
                {teamSortBy && <button onClick={()=>setTeamSortBy(null)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:10,cursor:"pointer" }}>✕</button>}
              </div>}
              <div style={{ display:"grid",gap:5 }}>
                {[...teamTasks].filter(t=>t.status!=="Terminé" && (t.memberVisible!==false||t.hiddenBy===user.uid)).sort((a,b)=>{
                  if (!teamSortBy) return (a.num||0)-(b.num||0);
                  const dir = teamSortDir==="asc"?1:-1;
                  if (teamSortBy==="num")      return ((a.num||0)-(b.num||0))*dir;
                  if (teamSortBy==="priority") return (["Haute","Moyenne","Basse"].indexOf(a.priority||"Basse")-["Haute","Moyenne","Basse"].indexOf(b.priority||"Basse"))*dir;
                  if (teamSortBy==="due")      return ((a.due||"9999")>(b.due||"9999")?1:-1)*dir;
                  if (teamSortBy==="status")   return ((STATUSES.indexOf(a.status))-(STATUSES.indexOf(b.status)))*dir;
                  return 0;
                }).map(task => {
                  const tc  = teamTaskColor(task);
                  const bgC = tc ? tc.base+"33" : theme.bgCard;
                  const bdC = tc ? `1px solid ${tc.light}66` : `1px solid ${theme.border}`;
                  const blC = tc ? `3px solid ${tc.light}` : `1px solid ${theme.border}`;
                  const dot = STATUS_DOT[task.status]||"#888";
                  const isTeamGhost = ghost?.id===task.id;
                  const hasPending = isAdminRole(teamRole) ? teamPending.some(p=>p.taskId===task.id) : myPendingProposals.some(p=>p.taskId===task.id);
                  const notified   = (task.notifyUsers||{})[user.uid] !== false;
                  const toggleNotify = e => { e.stopPropagation(); const nv=!notified; updateDoc(doc(db,"teams",team.id,"tasks",task.id),{[`notifyUsers.${user.uid}`]:nv}); setTeamTasks(p=>p.map(t=>t.id===task.id?{...t,notifyUsers:{...(t.notifyUsers||{}), [user.uid]:nv}}:t)); };
                  return (
                    <div key={task.id} className="row"
                      draggable={isAdminRole(teamRole)}
                      onDragStart={isAdminRole(teamRole)?e=>onDragStartTeam(e,task.id,"team-list"):undefined}
                      onDragEnd={isAdminRole(teamRole)?onDragEndTeam:undefined}
                      onTouchStart={isAdminRole(teamRole)?e=>onTouchStart(e,task.id,"team-list"):undefined}
                      onClick={()=>openEdit(task)}
                      style={{ background:bgC,border:bdC,borderLeft:blC,borderRadius:9,padding:"10px 13px",cursor:"pointer",transition:"background .15s",touchAction:"pan-y",opacity:isTeamGhost?0.3:1 }}>

                      {/* ── Ligne principale (commune desktop + mobile) ── */}
                      <div style={{ display:"flex",alignItems:"center",gap:9 }}>
                        <div style={{ fontSize:10,color:theme.textMuted,fontFamily:"'Syne',sans-serif",fontWeight:700,minWidth:22,textAlign:"right",flexShrink:0 }}>#{task.num}</div>
                        <button onClick={e=>{e.stopPropagation();if(isAdminRole(teamRole))cycleTeamStatus(task.id,task.status);}} style={{ width:11,height:11,borderRadius:"50%",background:dot,border:"none",cursor:isAdminRole(teamRole)?"pointer":"default",flexShrink:0,boxShadow:`0 0 5px ${dot}99` }} title={isAdminRole(teamRole)?"Changer statut":task.status}/>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                            <span style={{ fontSize:12,color:task.status==="Terminé"?theme.textMuted:theme.text,textDecoration:task.status==="Terminé"?"line-through":"none" }}>{task.title}</span>
                            <span style={{ fontSize:9,padding:"1px 5px",borderRadius:3,background:(PRIO_COLOR[task.priority]||"#888")+"22",color:PRIO_COLOR[task.priority]||"#888",border:`1px solid ${(PRIO_COLOR[task.priority]||"#888")}44`,flexShrink:0 }}>{(task.priority||"?").toUpperCase()}</span>
                            {!isMobile && <span style={{ fontSize:9,padding:"1px 5px",borderRadius:3,background:STATUS_DOT[task.status]+"22",color:STATUS_DOT[task.status] }}>{task.status}</span>}
                            {hasPending && <span style={{ fontSize:9,padding:"1px 5px",borderRadius:3,background:"#cc303022",color:"#cc3030",border:"1px solid #cc303044",flexShrink:0 }}>⏳</span>}
                          </div>
                          {!isMobile && <>
                            {task.due && <div style={{ fontSize:9,color:theme.accent+"aa",marginTop:2 }}>📅 {formatDate(task.due)}</div>}
                            {task.scheduledFor==="today" && <div style={{ fontSize:9,color:theme.accent,marginTop:2 }}>☀️ Aujourd'hui</div>}
                            {task.scheduledFor==="tomorrow" && <div style={{ fontSize:9,color:theme.accent,marginTop:2 }}>🌙 Demain</div>}
                            {task.scheduledFor && task.scheduledFor!=="today" && task.scheduledFor!=="tomorrow" && !task.due && <div style={{ fontSize:9,color:theme.accent+"aa",marginTop:2 }}>📅 {formatDate(task.scheduledFor)}</div>}
                            {task.notes && <div style={{ fontSize:9,color:theme.textMuted,marginTop:1 }}>{task.notes}</div>}
                            <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:2,flexWrap:"wrap" }}>
                              <span style={{ fontSize:9,color:theme.textMuted+"88" }}>par {task.createdByEmail||(team?.members||[]).find(m=>m.uid===task.createdBy)?.email||team.adminEmail}</span>
                              <span onClick={e=>{e.stopPropagation();setCommentPopup(task.id);}} style={{ fontSize:9,color:theme.textMuted,cursor:"pointer",padding:"1px 5px",border:`1px solid ${theme.border}`,borderRadius:4 }}>💬</span>
                              <span onClick={e=>{e.stopPropagation();setPjPopup({id:task.id,isTeam:true});}} style={{ fontSize:9,color:(task.attachments||[]).length>0?theme.accent:theme.textMuted,cursor:"pointer",padding:"1px 5px",border:`1px solid ${(task.attachments||[]).length>0?theme.accent+"44":theme.border}`,borderRadius:4 }}>📎{(task.attachments||[]).length>0?` ${task.attachments.length}`:""}</span>
                              <span onClick={toggleNotify} style={{ fontSize:10,cursor:"pointer",opacity:notified?1:0.4 }}>{notified?"🔔":"🔕"}</span>
                            </div>
                          </>}
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0 }}>
                          {isAdminRole(teamRole) && <button onClick={e=>{e.stopPropagation();duplicateTeamTask(task);}} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:"2px 6px",color:theme.textMuted,fontSize:10,cursor:"pointer" }} title="Dupliquer">📋</button>}
                          {!isMobile && isAdminRole(teamRole) && <button onClick={e=>{e.stopPropagation();toggleMemberVisible(task.id,task.memberVisible);}} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:"2px 6px",color:task.memberVisible!==false?theme.textMuted:"#cc9900",fontSize:10,cursor:"pointer" }} title={task.memberVisible!==false?"Masquer aux membres":"Rendre visible aux membres"}>{task.memberVisible!==false?"👁️":"🚫"}</button>}
                          <button className="delbtn" onClick={e=>{e.stopPropagation();deleteTeamTask(task.id);}} style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:"2px 7px",color:"#aa3030",fontSize:10,cursor:"pointer" }}>✕</button>
                          {!isAdminRole(teamRole) && !isMobile && <span style={{ fontSize:9,color:theme.textMuted,padding:"2px 6px",border:`1px solid ${theme.border}`,borderRadius:5 }}>proposer</span>}
                        </div>
                      </div>

                      {/* ── Ligne secondaire mobile uniquement ── */}
                      {isMobile && (
                        <div style={{ paddingLeft:40,marginTop:6 }}>
                          <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:3 }}>
                            <span style={{ fontSize:9,padding:"1px 5px",borderRadius:3,background:STATUS_DOT[task.status]+"22",color:STATUS_DOT[task.status] }}>{task.status}</span>
                            {task.due && <span style={{ fontSize:9,color:theme.accent+"aa" }}>📅 {formatDate(task.due)}</span>}
                            {task.scheduledFor==="today" && <span style={{ fontSize:9,color:theme.accent }}>☀️ Aujourd'hui</span>}
                            {task.scheduledFor==="tomorrow" && <span style={{ fontSize:9,color:theme.accent }}>🌙 Demain</span>}
                            {task.scheduledFor && task.scheduledFor!=="today" && task.scheduledFor!=="tomorrow" && !task.due && <span style={{ fontSize:9,color:theme.accent+"aa" }}>📅 {formatDate(task.scheduledFor)}</span>}
                          </div>
                          {task.notes && <div style={{ fontSize:9,color:theme.textMuted,marginBottom:4,lineHeight:1.4 }}>{task.notes}</div>}
                          <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",borderTop:`1px solid ${theme.border}44`,paddingTop:5 }}>
                            <span style={{ fontSize:9,color:theme.textMuted+"88",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>par {(task.createdByEmail||(team?.members||[]).find(m=>m.uid===task.createdBy)?.email||team.adminEmail)?.split("@")[0]}</span>
                            <button onClick={e=>{e.stopPropagation();setCommentPopup(task.id);}} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:"3px 8px",color:theme.textMuted,fontSize:12,cursor:"pointer" }}>💬</button>
                            <button onClick={e=>{e.stopPropagation();setPjPopup({id:task.id,isTeam:true});}} style={{ background:"transparent",border:`1px solid ${(task.attachments||[]).length>0?theme.accent+"44":theme.border}`,borderRadius:5,padding:"3px 8px",color:(task.attachments||[]).length>0?theme.accent:theme.textMuted,fontSize:12,cursor:"pointer" }}>📎{(task.attachments||[]).length>0?` ${task.attachments.length}`:""}</button>
                            <button onClick={toggleNotify} style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:"3px 8px",fontSize:12,cursor:"pointer",opacity:notified?1:0.4 }}>{notified?"🔔":"🔕"}</button>
                            {isAdminRole(teamRole) && <button onClick={e=>{e.stopPropagation();toggleMemberVisible(task.id,task.memberVisible);}} style={{ background:"transparent",border:`1px solid ${task.memberVisible!==false?theme.border:"#cc990044"}`,borderRadius:5,padding:"3px 8px",color:task.memberVisible!==false?theme.textMuted:"#cc9900",fontSize:12,cursor:"pointer" }} title={task.memberVisible!==false?"Masquer aux membres":"Rendre visible aux membres"}>{task.memberVisible!==false?"👁️":"🚫"}</button>}
                            {!isAdminRole(teamRole) && <button onClick={e=>{e.stopPropagation();openEdit(task);}} style={{ background:theme.accent+"22",border:`1px solid ${theme.accent}44`,borderRadius:5,padding:"3px 8px",color:theme.accent,fontSize:10,cursor:"pointer" }}>✏️ Proposer</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Tâches terminées : accessibles via les stats (même comportement que page perso) */}
            </div>
          )}

          {/* Sort bar + Task rows — espace perso uniquement */}
          {!teamSpace && (<>
          {isMobile && <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:9,color:theme.textMuted,letterSpacing:1 }}>TRIER :</span>
            {[{v:"added",l:"Ajout"},{v:"priority",l:"Priorité"},{v:"due",l:"Échéance"},{v:"delay",l:"Retard"},{v:"status",l:"Statut"}].map(({v,l})=>(
              <button key={v} onClick={()=>{ if(sortBy===v){setSortDir(d=>d==="asc"?"desc":"asc");}else{setSortBy(v);setSortDir("asc");} }}
                style={{ background:sortBy===v?theme.accent+"33":"transparent",border:`1px solid ${sortBy===v?theme.accent:theme.border}`,borderRadius:5,padding:"3px 8px",color:sortBy===v?theme.accent:theme.textMuted,fontSize:10,cursor:"pointer" }}>
                {l}{sortBy===v?(sortDir==="asc"?" ↑":" ↓"):""}
              </button>
            ))}
            {sortBy && <button onClick={()=>setSortBy(null)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:10,cursor:"pointer" }}>✕</button>}
          </div>}

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
            })().slice(0, visibleTaskCount).map((task, idx) => {
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
                            ? new Date(task.completion.doneAt).toLocaleString(locale,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})
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
                    <button title="Pièces jointes" onClick={e=>{e.stopPropagation();setPjPopup({id:task.id,isTeam:false});}} style={{ background:"transparent",border:`1px solid ${(task.attachments||[]).length>0?theme.accent+"44":theme.border}`,borderRadius:5,padding:isMobile?"6px 10px":"2px 7px",color:(task.attachments||[]).length>0?theme.accent:theme.textMuted,fontSize:isMobile?14:10,cursor:"pointer" }}>📎{(task.attachments||[]).length>0?` ${task.attachments.length}`:""}</button>
                    <button className="delbtn" onClick={e=>{e.stopPropagation();deleteTask(task.id);}} style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:isMobile?"6px 10px":"2px 7px",color:"#aa3030",fontSize:isMobile?14:10,cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              );
            })}
            {(() => {
              const total = tasks.filter(t => t.status !== "Terminé").length;
              if (total <= visibleTaskCount) return null;
              return (
                <button onClick={()=>setVisibleTaskCount(c=>c+100)}
                  style={{ width:"100%",background:"transparent",border:`1px solid ${theme.border}`,borderRadius:8,padding:"8px",color:theme.textMuted,fontSize:11,cursor:"pointer",marginTop:6 }}>
                  Voir {Math.min(100, total-visibleTaskCount)} tâche{total-visibleTaskCount>1?"s":""} de plus ({visibleTaskCount}/{total})
                </button>
              );
            })()}
            </div>
          </>)}

          </div>{/* end scroller */}
        </div>{/* end RIGHT */}

      </div>{/* end split */}

      {/* Modal perso */}
      {renderModal()}

      {/* Popup PJ (perso + équipe) */}
      {renderPJPopup()}

      {/* Popup Commentaires (équipe) */}
      {renderCommentPopup()}

      {/* Popup prévisualisation fichier */}
      {renderFilePopup()}

      {/* Stats */}
      {showStats && (
        <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:70,paddingRight:16 }}
          onClick={()=>setShowStats(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:320,boxShadow:"0 8px 40px #00000099",maxHeight:"80vh",overflowY:"auto" }}>
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

      {/* Corbeille — perso */}
      {showBin && (
        <div style={{ position:"fixed",inset:0,zIndex:250,background:"#000000bb",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"60px 16px 16px" }}
          onClick={()=>setShowBin(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:20,width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>🗑️ CORBEILLE ({deletedTasks.length})</div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                {deletedTasks.length > 0 && <button onClick={()=>setDeletedTasks([])} style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:"3px 8px",color:"#aa3030",fontSize:10,cursor:"pointer" }}>Vider</button>}
                <button onClick={()=>setShowBin(false)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer" }}>✕</button>
              </div>
            </div>
            {deletedTasks.length === 0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"20px 0" }}>Corbeille vide</div>}
            {deletedTasks.map(task => (
              <div key={task.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:`1px solid ${theme.border}44` }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,color:theme.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>#{task.num} {task.title}</div>
                  {task.due && <div style={{ fontSize:9,color:theme.textMuted,marginTop:2 }}>📅 {formatDate(task.due)}</div>}
                </div>
                <button onClick={()=>restoreTask(task)} style={{ background:theme.accent+"22",border:`1px solid ${theme.accent}44`,borderRadius:5,padding:"3px 8px",color:theme.accent,fontSize:10,cursor:"pointer",flexShrink:0 }}>↩ Restaurer</button>
                <button onClick={()=>permanentDeleteTask(task.id)} style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:"3px 8px",color:"#aa3030",fontSize:10,cursor:"pointer",flexShrink:0 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corbeille — équipe */}
      {showTeamBin && (
        <div style={{ position:"fixed",inset:0,zIndex:250,background:"#000000bb",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"60px 16px 16px" }}
          onClick={()=>setShowTeamBin(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:20,width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>🗑️ CORBEILLE — {team?.name?.toUpperCase()} ({deletedTeamTasks.length})</div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                {deletedTeamTasks.length > 0 && <button onClick={async()=>{ for(const t of deletedTeamTasks) await deleteDoc(doc(db,"teams",team.id,"deletedTasks",t.id)); setDeletedTeamTasks([]); }} style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:"3px 8px",color:"#aa3030",fontSize:10,cursor:"pointer" }}>Vider</button>}
                <button onClick={()=>setShowTeamBin(false)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer" }}>✕</button>
              </div>
            </div>
            {deletedTeamTasks.length === 0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"20px 0" }}>Corbeille vide</div>}
            {deletedTeamTasks.map(task => (
              <div key={task.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:`1px solid ${theme.border}44` }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,color:theme.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>#{task.num} {task.title}</div>
                  {task.due && <div style={{ fontSize:9,color:theme.textMuted,marginTop:2 }}>📅 {formatDate(task.due)}</div>}
                </div>
                <button onClick={()=>restoreTeamTask(task)} style={{ background:theme.accent+"22",border:`1px solid ${theme.accent}44`,borderRadius:5,padding:"3px 8px",color:theme.accent,fontSize:10,cursor:"pointer",flexShrink:0 }}>↩ Restaurer</button>
                <button onClick={()=>permanentDeleteTeamTask(task.id)} style={{ background:"transparent",border:"1px solid #5a1a1a",borderRadius:5,padding:"3px 8px",color:"#aa3030",fontSize:10,cursor:"pointer",flexShrink:0 }}>✕</button>
              </div>
            ))}
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

      {/* Tâches terminées — équipe */}
      {showTeamDone && (
        <div style={{ position:"fixed",inset:0,zIndex:250,background:"#000000bb",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"60px 16px 16px" }}
          onClick={()=>setShowTeamDone(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:20,width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700 }}>TÂCHES TERMINÉES — {team?.name?.toUpperCase()}</div>
              <button onClick={()=>setShowTeamDone(false)} style={{ background:"transparent",border:"none",color:theme.textMuted,fontSize:16,cursor:"pointer" }}>✕</button>
            </div>
            {[...teamTasks.filter(t=>t.status==="Terminé")].sort((a,b)=>(a.num||0)-(b.num||0)).map(t=>(
              <div key={t.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${theme.border}44` }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,color:theme.textMuted,textDecoration:"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>#{t.num} {t.title}</div>
                  {t.completion && (
                    <div style={{ fontSize:9,color:theme.textMuted,marginTop:2 }}>
                      🏆 {t.completion.doneDate}
                      {t.completion.deltaLabel && <span style={{ marginLeft:6,color:t.completion.deltaMin<0?"#3aaa3a":"#cc3030" }}>{t.completion.deltaMin<0?"⚡ ":"⚠ "}{t.completion.deltaLabel}</span>}
                    </div>
                  )}
                </div>
                {isAdminRole(teamRole) && (
                  <button onClick={()=>cycleTeamStatus(t.id,"Terminé")}
                    style={{ background:"transparent",border:`1px solid ${theme.border}`,borderRadius:5,padding:"3px 8px",color:theme.textMuted,fontSize:10,cursor:"pointer",marginLeft:10,flexShrink:0 }}>↩</button>
                )}
              </div>
            ))}
            {teamTasks.filter(t=>t.status==="Terminé").length===0 && <div style={{ fontSize:11,color:theme.textMuted,textAlign:"center",padding:"20px 0" }}>Aucune tâche terminée</div>}
          </div>
        </div>
      )}

      {/* Theme */}
      {showTheme && (
        <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:70,paddingRight:16 }}
          onClick={()=>setShowTheme(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:280,boxShadow:"0 8px 40px #00000099",maxHeight:"80vh",overflowY:"auto" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:16 }}>APPARENCE</div>

            <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>MODE</div>
            <div style={{ display:"flex",gap:8,marginBottom:18 }}>
              {["dark","light"].map(m=>(
                <button key={m} onClick={()=>{ const p=PRESETS[m][0]; setTheme(t=>({...t,mode:m,bg:p.bg,bgLeft:p.bgLeft,bgCard:p.bgCard,accent:p.accent,text:p.text,textMuted:p.textMuted,border:p.border})); }}
                  style={{ flex:1,background:theme.mode===m?theme.accent:"transparent",border:`1px solid ${theme.accent}66`,borderRadius:8,padding:"7px",color:theme.mode===m?"#fff":theme.textMuted,fontSize:11,cursor:"pointer" }}>
                  {m==="dark"?"🌙 Sombre":"☀️ Clair"}
                </button>
              ))}
            </div>

            <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>PALETTE</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:18 }}>
              {PRESETS[theme.mode].map(p=>(
                <button key={p.name} onClick={()=>setTheme(t=>({...t,...p,font:t.font,titleFont:t.titleFont,mode:t.mode}))}
                  style={{ background:p.bg,border:`2px solid ${theme.bg===p.bg?theme.accent:"transparent"}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",color:theme.bg===p.bg?theme.accent:theme.textMuted,fontSize:11,display:"flex",alignItems:"center",gap:6 }}>
                  <span style={{ width:8,height:8,borderRadius:"50%",background:p.accent,display:"inline-block" }}/>
                  {p.name}
                </button>
              ))}
            </div>

            <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>ACCENT</div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
              <input type="color" value={theme.accent} onChange={e=>setTheme(t=>({...t,accent:e.target.value}))}
                style={{ width:40,height:32,border:"none",borderRadius:6,cursor:"pointer" }} />
              <span style={{ fontSize:11,color:theme.textMuted }}>{theme.accent}</span>
            </div>

            <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>POLICE TEXTE</div>
            <div style={{ display:"grid",gap:5,marginBottom:18 }}>
              {FONTS.map(f=>(
                <button key={f.value} onClick={()=>setTheme(t=>({...t,font:f.value}))}
                  style={{ background:theme.font===f.value?theme.accent+"33":"transparent",border:`1px solid ${theme.font===f.value?theme.accent:theme.border}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",color:theme.font===f.value?theme.accent:theme.textMuted,fontSize:12,fontFamily:`'${f.value}',monospace`,textAlign:"left" }}>
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>POLICE TITRE</div>
            <div style={{ display:"grid",gap:5,marginBottom:18 }}>
              {TITLE_FONTS.map(f=>(
                <button key={f.value} onClick={()=>setTheme(t=>({...t,titleFont:f.value}))}
                  style={{ background:theme.titleFont===f.value?theme.accent+"33":"transparent",border:`1px solid ${theme.titleFont===f.value?theme.accent:theme.border}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",color:theme.titleFont===f.value?theme.accent:theme.textMuted,fontSize:14,fontFamily:`'${f.value}',sans-serif`,textAlign:"left",fontWeight:700 }}>
                  {f.label}
                </button>
              ))}
            </div>


            <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>LANGUE / FORMAT DATE</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:18 }}>
              {[{v:"fr-FR",l:"Français"},{v:"en-US",l:"English (US)"},{v:"en-GB",l:"English (UK)"},{v:"de-DE",l:"Deutsch"},{v:"es-ES",l:"Español"},{v:"it-IT",l:"Italiano"},{v:"zh-CN",l:"中文"},{v:"ja-JP",l:"日本語"},{v:"ko-KR",l:"한국어"}].map(({v,l})=>(
                <button key={v} onClick={()=>setLocale(v)} style={{ background:locale===v?theme.accent+"33":"transparent",border:`1px solid ${locale===v?theme.accent:theme.border}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",color:locale===v?theme.accent:theme.textMuted,fontSize:10 }}>{l}</button>
              ))}
            </div>

            <div style={{ fontSize:9,color:theme.textMuted,marginBottom:6,letterSpacing:1 }}>RAPPEL QUOTIDIEN</div>
            {/* Statut permission */}
            {(() => {
              const perm = "Notification" in window ? Notification.permission : "unsupported";
              const cfg = {
                granted:     { bg:"#2a7a2a22", border:"#2a7a2a66", color:"#3aaa3a", label:"✓ Notifications autorisées" },
                denied:      { bg:"#cc303022", border:"#cc303066", color:"#cc3030", label:"✕ Notifications bloquées — à débloquer dans les réglages du navigateur" },
                default:     { bg:"#f0c04022", border:"#f0c04066", color:"#c8a000", label:"⚠ Permission non accordée" },
                unsupported: { bg:"#44444422", border:"#44444466", color:"#888",    label:"✕ Notifications non supportées sur cet appareil/navigateur" },
              }[perm];
              return (
                <div style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:8, padding:"7px 10px", marginBottom:10, fontSize:10, color:cfg.color, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <span>{cfg.label}</span>
                  {perm === "default" && (
                    <button onClick={()=>Notification.requestPermission().then(()=>{})}
                      style={{ background:theme.accent, border:"none", borderRadius:6, padding:"3px 8px", color:"#fff", fontSize:10, cursor:"pointer", flexShrink:0 }}>
                      Autoriser
                    </button>
                  )}
                </div>
              );
            })()}
            {/* Bouton test */}
            <button onClick={async () => {
              if (!("Notification" in window)) { toast("Notifications non supportées sur ce navigateur.", true); return; }
              if (Notification.permission === "denied") { toast("Les notifications sont bloquées. Débloque-les dans les réglages de ton navigateur.", true); return; }
              if (Notification.permission !== "granted") {
                const p = await Notification.requestPermission();
                if (p !== "granted") { toast("Permission refusée.", true); return; }
              }
              new Notification("Task Tracker Pro 🔔", {
                body: "Test de notification — tout fonctionne !",
                icon: "/favicon.ico",
                tag: "test-notif",
              });
            }} style={{ width:"100%", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:8, padding:"8px", color:theme.textMuted, fontSize:11, cursor:"pointer", marginBottom:12 }}>
              🔔 Envoyer une notification test
            </button>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <span style={{ fontSize:11,color:theme.textMuted }}>Rappel quotidien activé</span>
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
              if(!user){toast("Connecte-toi pour sauvegarder le thème.", true);return;}
              const ref=doc(db,"users",user.uid);
              await setDoc(ref,{theme},{merge:true});
              toast("Thème sauvegardé ✓");
            }} style={{ width:"100%",background:theme.accent,border:"none",borderRadius:8,padding:"9px",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700,marginBottom:8 }}>
              💾 Sauvegarder le thème
            </button>

            <button onClick={async()=>{
              if(!window.confirm("Effacer toutes tes tâches personnelles ? Tes données d'équipe ne seront pas affectées. Cette action est irréversible.")) return;
              ["tt_tasks","tt_todayIds","tt_todayDates","tt_tomorrowIds","tt_scheduledIds","tt_highlighted","tt_numMode","tt_counter","tt_manuallyRemovedIds"].forEach(k=>localStorage.removeItem(k));
              setManuallyRemovedIds([]);
              if(user){ try{ await setDoc(doc(db,"users",user.uid),{tasks:[],todayIds:[],todayDates:[],tomorrowIds:[],scheduledIds:[],highlighted:[],taskCounter:0},{merge:true}); }catch(e){} }
              window.location.reload();
            }} style={{ width:"100%",background:"transparent",border:"1px solid #5a1a1a",borderRadius:8,padding:"9px",color:"#aa3030",fontSize:11,cursor:"pointer",fontWeight:700,marginBottom:8 }}>
              🗑️ Réinitialiser les tâches personnelles
            </button>

            {team && isAdminRole(teamRole) && (
              <button onClick={async()=>{
                if(!window.confirm(`Effacer toutes les tâches de l'équipe "${team.name}" ? Les tâches en attente seront aussi supprimées. Cette action est irréversible.`)) return;
                try {
                  const batch = writeBatch(db);
                  const tasksSnap = await getDocs(collection(db,"teams",team.id,"tasks"));
                  tasksSnap.forEach(d => batch.delete(d.ref));
                  const pendingSnap = await getDocs(collection(db,"teams",team.id,"pendingChanges"));
                  pendingSnap.forEach(d => batch.delete(d.ref));
                  batch.update(doc(db,"teams",team.id),{ taskCounter:0 });
                  await batch.commit();
                } catch(e) { toast("Erreur : "+e.message, true); }
              }} style={{ width:"100%",background:"transparent",border:"1px solid #5a1a1a",borderRadius:8,padding:"9px",color:"#aa3030",fontSize:11,cursor:"pointer",fontWeight:700,marginBottom:8 }}>
                🗑️ Réinitialiser les tâches de l'équipe
              </button>
            )}

          </div>
        </div>
      )}

      {/* Panneau changements en attente */}
      {showPendingPanel && isAdminRole(teamRole) && (
        <div style={{ position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",background:"#00000088" }}
          onClick={()=>setShowPendingPanel(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#12122a",border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:340,maxHeight:"75vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:16 }}>MODIFICATIONS EN ATTENTE</div>
            {teamPending.length===0 && <div style={{ color:theme.textMuted,fontSize:12,textAlign:"center",padding:20 }}>Aucune modification en attente.</div>}
            {teamPending.map(change => {
              const task = teamTasks.find(t=>t.id===change.taskId);
              // Compute field-level diff for edits
              const diffFields = [];
              if (change.type==="edit" && change.data && task) {
                const fields = [
                  { key:"title",    label:"Titre" },
                  { key:"priority", label:"Priorité" },
                  { key:"status",   label:"Statut" },
                  { key:"due",      label:"Échéance", fmt: v => v ? formatDate(v) : "—" },
                  { key:"notes",    label:"Notes" },
                ];
                for (const f of fields) {
                  const oldVal = task[f.key] ?? "";
                  const newVal = change.data[f.key] ?? "";
                  if (String(oldVal) !== String(newVal)) {
                    diffFields.push({ label:f.label, old: f.fmt?f.fmt(oldVal):oldVal||"—", new: f.fmt?f.fmt(newVal):newVal||"—" });
                  }
                }
              }
              // Fields to display for new task
              const addFields = change.type==="add" && change.data ? [
                { label:"Titre",    val: change.data.title },
                { label:"Priorité", val: change.data.priority },
                { label:"Statut",   val: change.data.status },
                { label:"Échéance", val: change.data.due ? formatDate(change.data.due) : null },
                { label:"Notes",    val: change.data.notes },
              ].filter(f=>f.val) : [];
              return (
                <div key={change.id} style={{ background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginBottom:10 }}>
                  <div style={{ fontSize:10,color:theme.textMuted,marginBottom:6 }}>
                    {change.type==="add"?"➕ Nouvelle tâche":change.type==="edit"?"✏️ Modification":change.type==="addAttachment"?"📎 Ajout PJ":change.type==="deleteAttachment"?"🗑️ Suppression PJ":"🗑️ Suppression"} · <strong style={{ color:theme.text }}>{change.proposedByEmail}</strong>
                  </div>
                  {/* addAttachment */}
                  {change.type==="addAttachment" && change.data?.attachment && (
                    <div style={{ fontSize:11,marginBottom:8 }}>
                      <div style={{ color:theme.textMuted,marginBottom:2 }}>Tâche : <strong style={{ color:theme.text }}>{task?.title||"#"+change.taskId}</strong></div>
                      <div style={{ display:"flex",alignItems:"center",gap:6,background:theme.bg,borderRadius:6,padding:"5px 8px" }}>
                        <span style={{ fontSize:12 }}>{attIcon(change.data.attachment.type)}</span>
                        <span style={{ fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:theme.text }}>{change.data.attachment.name}</span>
                        <a href={change.data.attachment.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:9,color:theme.accent,textDecoration:"none",flexShrink:0 }}>Voir</a>
                      </div>
                    </div>
                  )}
                  {/* deleteAttachment */}
                  {change.type==="deleteAttachment" && change.data?.attachment && (
                    <div style={{ fontSize:11,marginBottom:8 }}>
                      <div style={{ color:theme.textMuted,marginBottom:2 }}>Tâche : <strong style={{ color:theme.text }}>{task?.title||"#"+change.taskId}</strong></div>
                      <div style={{ fontSize:10,color:"#cc6060" }}>Supprimer : {change.data.attachment.name}</div>
                    </div>
                  )}
                  {/* delete */}
                  {change.type==="delete" && (
                    <div style={{ fontSize:11,color:theme.text,marginBottom:8 }}>Supprimer : <strong>{task?.title||"#"+change.taskId}</strong></div>
                  )}
                  {/* add — show all proposed fields */}
                  {change.type==="add" && (
                    <div style={{ fontSize:11,marginBottom:8 }}>
                      <div style={{ color:theme.text,fontWeight:700,marginBottom:4 }}>{change.data?.title}</div>
                      {addFields.filter(f=>f.label!=="Titre").map(f=>(
                        <div key={f.label} style={{ color:theme.textMuted,fontSize:10,marginBottom:2 }}>{f.label} : <span style={{ color:theme.text }}>{f.val}</span></div>
                      ))}
                    </div>
                  )}
                  {/* edit — show only changed fields with old→new */}
                  {change.type==="edit" && (
                    <div style={{ fontSize:11,marginBottom:8 }}>
                      <div style={{ color:theme.text,fontWeight:700,marginBottom:4 }}>{task?.title||change.data?.title}</div>
                      {diffFields.length===0
                        ? <div style={{ color:theme.textMuted,fontSize:10 }}>Aucun champ modifié détecté.</div>
                        : diffFields.map(f=>(
                          <div key={f.label} style={{ color:theme.textMuted,fontSize:10,marginBottom:3 }}>
                            {f.label} : <span style={{ color:"#cc6060",textDecoration:"line-through" }}>{f.old}</span> → <span style={{ color:"#6bcb77" }}>{f.new}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>approveChange(change)} style={{ flex:1,background:"#2a7a2a",border:"none",borderRadius:7,padding:"7px",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700 }}>✓ Approuver</button>
                    <button onClick={()=>rejectChange(change.id, change)} style={{ flex:1,background:"transparent",border:"1px solid #5a1a1a",borderRadius:7,padding:"7px",color:"#cc3030",fontSize:11,cursor:"pointer" }}>✕ Refuser</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Panneau proposals du membre */}
      {showMyPendingPanel && !isAdminRole(teamRole) && (
        <div style={{ position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",background:"#00000088" }}
          onClick={()=>setShowMyPendingPanel(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.accent}44`,borderRadius:16,padding:24,width:340,maxHeight:"75vh",overflowY:"auto",boxShadow:"0 8px 40px #00000099" }}>
            <div style={{ fontSize:11,color:theme.accent,letterSpacing:2,fontWeight:700,marginBottom:16 }}>MES PROPOSITIONS EN ATTENTE</div>
            {myPendingProposals.length===0 && <div style={{ color:theme.textMuted,fontSize:12,textAlign:"center",padding:20 }}>Aucune proposition en attente.</div>}
            {myPendingProposals.map(change => (
              <div key={change.id} style={{ background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginBottom:10 }}>
                <div style={{ fontSize:10,color:theme.textMuted,marginBottom:6 }}>
                  {change.type==="add"?"➕ Nouvelle tâche":change.type==="edit"?"✏️ Modification":change.type==="addAttachment"?"📎 Ajout PJ":change.type==="deleteAttachment"?"🗑️ Suppression PJ":"🗑️ Suppression"} · <span style={{ color:"#f0c040" }}>En attente de validation</span>
                </div>
                <div style={{ fontSize:11,color:theme.text }}><strong>{change.data?.title||"—"}</strong></div>
              </div>
            ))}
            <button onClick={()=>setShowMyPendingPanel(false)} style={{ width:"100%",background:theme.accent,border:"none",borderRadius:8,padding:"9px",color:"#fff",fontSize:11,cursor:"pointer",marginTop:8 }}>Fermer</button>
          </div>
        </div>
      )}

      {/* Panneau Équipe */}
      {showTeam && (
        <TeamPanel
          allUserTeams={adminTeams}
          activeTeamId={team?.id}
          teamPending={teamPending}
          teamTasks={teamTasks}
          theme={theme} isMobile={isMobile}
          onClose={()=>setShowTeam(false)}
          onActivateTeam={t=>{ switchActiveTeam(t); setTeamSpace(true); setShowTeam(false); }}
          onCreateTeam={createTeam}
          onInvite={inviteMember}
          onRemoveMember={m=>{ if(window.confirm(`Retirer ${m.email} ?`)) removeMember(m); }}
          onPromote={(m, teamId)=>promoteToCoAdmin(m, teamId)}
          onDemote={(m, teamId)=>demoteToMember(m, teamId)}
          isOwner={team?.adminUid === user?.uid}
          onDissolve={dissolveTeam}
          onRenameTeam={renameTeam}
          teamError={teamError} teamInfo={teamInfo}
          setTeamError={setTeamError} setTeamInfo={setTeamInfo}
        />
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

      {/* FAB fixe — mobile page perso (au-dessus du bandeau pub) */}
      {!teamSpace && isMobile && !showForm && (
        <div style={{ position:"fixed",bottom:64,right:16,zIndex:150,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
          <div style={{ position:"relative" }}>
            <button onClick={listening?stopVoice:startVoice}
              style={{ background:listening?"#cc3030":theme.bgCard,border:`1px solid ${listening?"#cc3030":theme.accent+"66"}`,borderRadius:50,width:44,height:44,fontSize:16,cursor:"pointer",position:"relative",boxShadow:listening?"0 0 12px #cc303088":"0 2px 12px #00000066",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center" }}>
              {listening?"⏹":"🎙️"}
              {listening && <span style={{ position:"absolute",top:-2,right:-2,width:7,height:7,borderRadius:"50%",background:"#ff4444",animation:"pulse 1s infinite" }}/>}
            </button>
            {voiceError && <div style={{ position:"absolute",bottom:50,right:0,background:"#2a0a0a",border:"1px solid #aa3030",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#ff8080",zIndex:50,minWidth:180,whiteSpace:"normal" }}>{voiceError}<button onClick={()=>setVoiceError(null)} style={{ marginLeft:8,background:"transparent",border:"none",color:"#ff8080",cursor:"pointer" }}>✕</button></div>}
            {listening && <div style={{ position:"absolute",bottom:50,right:0,background:theme.bgCard,border:"1px solid #cc303066",borderRadius:10,padding:"8px 12px",fontSize:11,color:"#ff8080",zIndex:50,display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap" }}><span style={{ width:7,height:7,borderRadius:"50%",background:"#ff4444",display:"inline-block",animation:"pulse 1s infinite" }}/>En écoute…</div>}
          </div>
          <button
            onClick={()=>{setShowForm(true);setEditingId(null);setFormStep(1);setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none",memberVisible:true});setRecurDay("");setRecurMonthDay("");}}
            style={{ background:theme.accent,border:"none",borderRadius:50,padding:"13px 18px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px #00000099",letterSpacing:0.5 }}>
            + Ajouter
          </button>
        </div>
      )}

      {/* FAB fixe — mobile équipe (au-dessus du bandeau pub) */}
      {teamSpace && isMobile && team && !showForm && (
        <div style={{ position:"fixed",bottom:64,right:16,zIndex:150,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
          <div style={{ position:"relative" }}>
            <button onClick={listening?stopVoice:startVoice}
              style={{ background:listening?"#cc3030":theme.bgCard,border:`1px solid ${listening?"#cc3030":theme.accent+"66"}`,borderRadius:50,width:44,height:44,fontSize:16,cursor:"pointer",position:"relative",boxShadow:listening?"0 0 12px #cc303088":"0 2px 12px #00000066",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center" }}>
              {listening?"⏹":"🎙️"}
              {listening && <span style={{ position:"absolute",top:-2,right:-2,width:7,height:7,borderRadius:"50%",background:"#ff4444",animation:"pulse 1s infinite" }}/>}
            </button>
            {voiceError && <div style={{ position:"absolute",bottom:50,right:0,background:"#2a0a0a",border:"1px solid #aa3030",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#ff8080",zIndex:50,minWidth:180,whiteSpace:"normal" }}>{voiceError}<button onClick={()=>setVoiceError(null)} style={{ marginLeft:8,background:"transparent",border:"none",color:"#ff8080",cursor:"pointer" }}>✕</button></div>}
            {listening && <div style={{ position:"absolute",bottom:50,right:0,background:theme.bgCard,border:"1px solid #cc303066",borderRadius:10,padding:"8px 12px",fontSize:11,color:"#ff8080",zIndex:50,display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap" }}><span style={{ width:7,height:7,borderRadius:"50%",background:"#ff4444",display:"inline-block",animation:"pulse 1s infinite" }}/>En écoute…</div>}
          </div>
          <button
            onClick={()=>{setShowForm(true);setEditingId(null);setFormStep(1);setForm({title:"",priority:"Moyenne",status:"À faire",due:"",notes:"",notify:true,recurrence:"none",memberVisible:true});setRecurDay("");setRecurMonthDay("");}}
            style={{ background:theme.accent,border:"none",borderRadius:50,padding:"13px 18px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px #00000099",letterSpacing:0.5 }}>
            {isAdminRole(teamRole)?"+ Ajouter":"+ Proposer"}
          </button>
        </div>
      )}

      {/* Messagerie équipe */}
      {teamSpace && team && user && <TeamChat team={team} user={user} theme={theme} isMobile={isMobile} />}

      {/* Toast notifications */}
      {toastMsg && (
        <div style={{ position:"fixed", bottom:72, left:"50%", transform:"translateX(-50%)", background:toastMsg.isError?"#2a0a0a":"#0a2a0a", border:`1px solid ${toastMsg.isError?"#cc3030":"#3aaa3a"}`, borderRadius:10, padding:"10px 18px", color:toastMsg.isError?"#ff8080":"#6bcb77", fontSize:12, zIndex:1000, boxShadow:"0 4px 20px #00000088", maxWidth:"90vw", textAlign:"center" }}>
          {toastMsg.text}
        </div>
      )}

    </div>
  );
}
