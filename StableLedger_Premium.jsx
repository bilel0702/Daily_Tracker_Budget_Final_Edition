import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const CATS = [
  { id:"food",       name:"Food",        icon:"🍽️",  color:"#F97316" },
  { id:"fruits",     name:"Fruits",      icon:"🍎",  color:"#22C55E" },
  { id:"diver",      name:"Diver",       icon:"🤿",  color:"#06B6D4" },
  { id:"diver_x",    name:"Diver X",     icon:"💫",  color:"#A855F7" },
  { id:"body_staff", name:"Body Staff",  icon:"💪",  color:"#06D6D6" },
  { id:"rosa_fee",   name:"Rosa Fee",    icon:"🌹",  color:"#EC4899" },
  { id:"kids_fee",   name:"Kids Fee",    icon:"🧒",  color:"#EAB308" },
  { id:"car_fee",    name:"Car Fee",     icon:"🚗",  color:"#64748B" },
  { id:"parent_fee", name:"Parent Fee",  icon:"👨‍👩‍👦", color:"#84CC16" },
  { id:"home_fee",   name:"Home Fee",    icon:"🏠",  color:"#10B981" },
  { id:"unexpected", name:"Unexpected",  icon:"⚡",  color:"#EF4444" },
  { id:"financial",  name:"Financial",   icon:"💰",  color:"#F59E0B" },
  { id:"trip_fee",   name:"Trip",        icon:"✈️",  color:"#3B82F6" },
  { id:"study_fee",  name:"Study",       icon:"📚",  color:"#8B5CF6" },
];

const MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS      = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const NAV_ORDER = ["home","calendar","history","reports","settings"];

const today  = () => new Date().toISOString().split("T")[0];
const mKey   = d  => d.toISOString().slice(0,7);
const yKey   = d  => String(d.getFullYear());
const getCat = id => CATS.find(c=>c.id===id) || CATS[0];
const total  = arr=> arr.filter(e=>e.category!=="financial").reduce((s,e)=>s+e.amount, 0);

async function sheetsSync(url, action, payload) {
  if (!url) return { success: false, message: "No script URL provided" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) return { success: false, message: `Network error ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { success: data.success !== false, message: data.message || data.error || "" };
  } catch (e) {
    return { success: false, message: e.message || "Sync failed" };
  }
}

// ─────────────────────────────────────────────────────────────
//  AnimatedNumber — smooth counter
// ─────────────────────────────────────────────────────────────
function AnimatedNumber({ value, format, duration = 800 }) {
  const [display, setDisplay] = useState(value);
  const rafRef     = useRef(null);
  const prevValRef = useRef(value);

  useEffect(() => {
    const from = prevValRef.current;
    const to   = value;
    prevValRef.current = to;
    if (from === to) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const tick = now => {
      const t = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - t, 4); // quartic ease-out — snappier feel
      setDisplay(from + (to - from) * e);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <>{format(display)}</>;
}

// ─────────────────────────────────────────────────────────────
//  Skeleton loader
// ─────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 20, r = 10, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.04) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.6s infinite",
      ...style
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
//  Ripple hook
// ─────────────────────────────────────────────────────────────
function useRipple() {
  const [ripples, setRipples] = useState([]);
  const addRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(r => [...r, { x, y, id }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 600);
  };
  return [ripples, addRipple];
}

function RippleButton({ children, onClick, style, className, disabled, whileHover, whileTap }) {
  const [ripples, addRipple] = useRipple();
  return (
    <motion.button
      className={className}
      disabled={disabled}
      whileHover={whileHover}
      whileTap={whileTap}
      onClick={(e) => { addRipple(e); onClick && onClick(e); }}
      style={{ position: "relative", overflow: "hidden", ...style }}
    >
      {children}
      {ripples.map(r => (
        <span key={r.id} style={{
          position:"absolute", left:r.x, top:r.y,
          width:4, height:4, borderRadius:"50%",
          background:"rgba(255,255,255,0.35)",
          transform:"translate(-50%,-50%) scale(0)",
          animation:"rippleAnim 0.6s ease-out forwards",
          pointerEvents:"none",
        }}/>
      ))}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
//  Motion variants
// ─────────────────────────────────────────────────────────────
const pageVariants = {
  enter: dir => ({ x: dir * 48, opacity: 0, scale: 0.98 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: dir => ({ x: -dir * 32, opacity: 0, scale: 0.98 }),
};
const pageTransition = { type: "spring", stiffness: 320, damping: 32 };

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
const listItem = {
  hidden: { opacity: 0, x: -22, scale: 0.96 },
  show:   { opacity: 1, x: 0, scale: 1, transition: { type: "spring", stiffness: 360, damping: 28 } },
};

const gridContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};
const gridItem = {
  hidden: { opacity: 0, scale: 0.75, y: 12 },
  show:   { opacity: 1, scale: 1,    y: 0, transition: { type: "spring", stiffness: 400, damping: 24 } },
};

const springSheet = { type: "spring", stiffness: 320, damping: 32 };
const springFast  = { type: "spring", stiffness: 460, damping: 28 };

// ─────────────────────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [expenses,   setExpenses]   = useState([]);
  const [currency,   setCurrency]   = useState("DA");
  const [page,       setPage]       = useState("home");
  const [direction,  setDirection]  = useState(0);
  const [dark,       setDark]       = useState(true);
  const [modal,      setModal]      = useState(false);
  const [selCat,     setSelCat]     = useState(null);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState({name:"",amount:"",notes:"",date:today()});
  const [delId,      setDelId]      = useState(null);
  const [toast,      setToast]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [calDate,    setCalDate]    = useState(new Date());
  const [calDay,     setCalDay]     = useState(today());
  const [calView,    setCalView]    = useState("month");
  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState("all");
  const [drawer,     setDrawer]     = useState(null);
  const [scriptUrl,  setScriptUrl]  = useState("");
  const [gsOn,       setGsOn]       = useState(false);
  const [gsBusy,     setGsBusy]     = useState(false);
  const [urlDraft,   setUrlDraft]   = useState("");
  const [focusedInput, setFocusedInput] = useState(null);

  const prevPageRef = useRef("home");

  const navigate = useCallback(to => {
    const fromIdx = NAV_ORDER.indexOf(prevPageRef.current);
    const toIdx   = NAV_ORDER.indexOf(to);
    setDirection(toIdx > fromIdx ? 1 : -1);
    prevPageRef.current = to;
    setPage(to);
  }, []);

  useEffect(()=>{
    try {
      const r=localStorage.getItem("exp_v4"); if(r) setExpenses(JSON.parse(r));
      const c=localStorage.getItem("exp_cfg4"); if(c){const p=JSON.parse(c);setDark(p.dark??true);setCurrency(p.currency??"DA");}
      const u=localStorage.getItem("exp_gsurl"); if(u){setScriptUrl(u);setUrlDraft(u);setGsOn(true);}
    } catch{}
    setTimeout(()=>setLoading(false), 600); // slight delay for skeleton effect
  },[]);

  const persist = useCallback(data=>{
    try{localStorage.setItem("exp_v4",JSON.stringify(data));}catch{}
  },[]);

  const capitalizeFirst = str => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

  const sym = currency === "DA" ? "DA" : currency === "USD" ? "$" : "€";
  const money = n => {
    if (currency === "DA") return n >= 1000 ? `DA ${(n/1000).toFixed(1)}k` : `DA ${Math.round(n)}`;
    if (n >= 1000) return sym + (n/1000).toFixed(1) + "k";
    return sym + n.toFixed(2);
  };
  const moneyFull = n => {
    if (currency === "DA") return `DA ${new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0)}`;
    if (currency === "USD") return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
    return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n||0);
  };

  const toast$ = useCallback((msg, bad=false, icon="")=>{
    setToast({msg, bad, icon}); setTimeout(()=>setToast(null), 2800);
  },[]);

  // ── CRUD ─────────────────────────────────────────────────
  const saveExp = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.amount || isNaN(+form.amount)) {
      toast$("Please fill name and amount", true, "⚠️"); return;
    }
    setSaving(true);
    try {
      const d = new Date(form.date+"T12:00:00");
      let next;
      if (editId) {
        const u = { ...expenses.find(e=>e.id===editId), ...form,
          amount:+form.amount, category:selCat.id, currency,
          ts:new Date().toISOString(), day:d.getDate(), month:d.getMonth()+1, year:d.getFullYear() };
        next = expenses.map(e=>e.id===editId?u:e);
        if (gsOn) {
          const sync = await sheetsSync(scriptUrl, "update", { expense: u });
          if (!sync.success) toast$("Saved locally. Sheets sync failed.", true, "⚠️");
          else toast$("Updated successfully", false, "✅");
        } else { toast$("Updated successfully", false, "✅"); }
      } else {
        const ex = { id:Date.now().toString(), name:form.name.trim(),
          amount:+form.amount, notes:form.notes.trim(), date:form.date,
          category:selCat.id, currency, ts:new Date().toISOString(),
          day:d.getDate(), month:d.getMonth()+1, year:d.getFullYear() };
        next = [ex,...expenses];
        if (gsOn) {
          const sync = await sheetsSync(scriptUrl, "add", { expense: ex });
          if (!sync.success) toast$("Saved locally. Sheets sync failed.", true, "⚠️");
          else toast$("Expense saved", false, "✅");
        } else { toast$("Expense saved", false, "✅"); }
      }
      setExpenses(next); persist(next); closeModal();
    } finally { setSaving(false); }
  };

  const delExp = id => {
    const next = expenses.filter(e=>e.id!==id);
    setExpenses(next); persist(next); setDelId(null);
    if (gsOn) sheetsSync(scriptUrl,"delete",{id});
    toast$("Expense removed", true, "🗑️");
  };

  const closeModal = () => {
    setModal(false); setSelCat(null); setEditId(null);
    setForm({name:"",amount:"",notes:"",date:today()});
    setFocusedInput(null);
  };
  const openAdd  = (cat, date) => { setSelCat(cat); setForm({name:"",amount:"",notes:"",date:date||today()}); setModal(true); };
  const openEdit = ex => { setSelCat(getCat(ex.category)); setForm({name:ex.name,amount:String(ex.amount),notes:ex.notes||"",date:ex.date}); setEditId(ex.id); setModal(true); };

  const restoreSheets = async () => {
    if (!scriptUrl) return; setGsBusy(true);
    try {
      const r = await fetch(scriptUrl+"?v="+Date.now());
      const d = await r.json();
      if (d.expenses) { setExpenses(d.expenses); persist(d.expenses); toast$(`Restored ${d.expenses.length} expenses`, false, "☁️"); }
    } catch { toast$("Restore failed", true, "⚠️"); }
    setGsBusy(false);
  };

  const connectGs = async () => {
    if (!urlDraft.trim()) return;
    const candidate = urlDraft.trim();
    if (!candidate.startsWith("https://")) { toast$("Enter a valid Apps Script URL", true, "⚠️"); return; }
    setGsBusy(true);
    try {
      const res  = await fetch(`${candidate}?v=${Date.now()}`);
      if (!res.ok) throw new Error(`Network error ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.expenses)) throw new Error(data?.error || "Invalid script URL");
      localStorage.setItem("exp_gsurl", candidate);
      setScriptUrl(candidate); setGsOn(true); toast$("Google Sheets connected", false, "🔗");
    } catch { toast$("Connection failed", true, "⚠️"); }
    setGsBusy(false);
  };
  const disconnectGs = () => {
    localStorage.removeItem("exp_gsurl");
    setScriptUrl(""); setGsOn(false); toast$("Disconnected from Sheets", false, "📴");
  };

  // ── Derived ───────────────────────────────────────────────
  const now      = new Date();
  const todayExp = expenses.filter(e=>e.date===today());
  const ws       = new Date(now); ws.setDate(now.getDate()-now.getDay()); ws.setHours(0,0,0,0);
  const weekExp  = expenses.filter(e=>new Date(e.date)>=ws);
  const monthExp = expenses.filter(e=>e.date.startsWith(mKey(now)));
  const yearExp  = expenses.filter(e=>e.date.startsWith(yKey(now)));

  const catTotals = useMemo(()=>
    CATS.map(c=>({...c,total:total(expenses.filter(e=>e.category===c.id))}))
        .sort((a,b)=>b.total-a.total),[expenses]);

  const monthlyBar = useMemo(()=>Array.from({length:6},(_,i)=>{
    const d=new Date(); d.setMonth(d.getMonth()-(5-i));
    return {month:MONTHS[d.getMonth()], v:+total(expenses.filter(e=>e.date.startsWith(mKey(d)))).toFixed(2)};
  }),[expenses]);

  // Weekly breakdown for area chart
  const weeklyArea = useMemo(()=>Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-6+i);
    const ds=d.toISOString().split("T")[0];
    return { day: DAYS[d.getDay()], v: +total(expenses.filter(e=>e.date===ds)).toFixed(2) };
  }),[expenses]);

  const pieData = catTotals.filter(c=>c.total>0).slice(0,6);

  const filtered = useMemo(()=>{
    let r=[...expenses];
    if (search) r=r.filter(e=>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      getCat(e.category).name.toLowerCase().includes(search.toLowerCase()) ||
      e.date.includes(search));
    if (filterCat!=="all") r=r.filter(e=>e.category===filterCat);
    return r.sort((a,b)=>new Date(b.ts||b.date)-new Date(a.ts||a.date));
  },[expenses,search,filterCat]);

  const calGrid = useMemo(()=>{
    const y=calDate.getFullYear(), m=calDate.getMonth();
    const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
    const g=Array(first).fill(null);
    for (let d=1;d<=days;d++){
      const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const ex=expenses.filter(e=>e.date===ds);
      g.push({day:d, ds, tot:total(ex), count:ex.length});
    }
    return g;
  },[expenses,calDate]);

  // ── Theme ─────────────────────────────────────────────────
  const K = dark ? {
    bg:      "#060A14",
    card:    "#0D1525",
    card2:   "#131E30",
    card3:   "#182338",
    border:  "#1C2B42",
    border2: "#243347",
    text:    "#E8EEF8",
    sub:     "#5A6A85",
    sub2:    "#3D4F68",
    accent:  "#6366F1",
    accentL: "#818CF8",
    amber:   "#F59E0B",
    green:   "#22C55E",
    red:     "#EF4444",
    teal:    "#06B6D4",
    glass:   "rgba(13,21,37,0.85)",
  } : {
    bg:      "#F0F3FA",
    card:    "#FFFFFF",
    card2:   "#F5F7FD",
    card3:   "#EDF0FA",
    border:  "#DDE4F5",
    border2: "#C8D2EC",
    text:    "#0B1022",
    sub:     "#667090",
    sub2:    "#A0AABF",
    accent:  "#5558E8",
    accentL: "#7B7EF4",
    amber:   "#D97706",
    green:   "#16A34A",
    red:     "#DC2626",
    teal:    "#0891B2",
    glass:   "rgba(255,255,255,0.9)",
  };

  // ── Shared components ─────────────────────────────────────

  // Premium expense row
  const ExpRow = ({ex, onEdit, onDel, index=0}) => {
    const cat = getCat(ex.category);
    const [expanded, setExpanded] = useState(false);
    return (
      <motion.div
        layout
        variants={listItem}
        initial="hidden"
        animate="show"
        exit={{ opacity:0, x:60, scale:0.92, transition:{duration:0.22, ease:"easeIn"} }}
        style={{borderBottom:`1px solid ${K.border}`}}
      >
        <motion.div
          whileHover={{ backgroundColor: K.card2 }}
          onClick={() => setExpanded(!expanded)}
          style={{
            display:"flex", alignItems:"center", gap:14,
            padding:"16px 18px", cursor:"pointer",
            transition:"background 0.15s",
          }}
        >
          {/* Icon bubble with shimmer */}
          <motion.div
            whileHover={{ scale: 1.12, rotate: 8 }}
            whileTap={{ scale: 0.92 }}
            transition={springFast}
            style={{
              width:52, height:52, borderRadius:18,
              background:`linear-gradient(145deg, ${cat.color}30, ${cat.color}18)`,
              border:`1.5px solid ${cat.color}40`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:28, flexShrink:0,
              boxShadow:`0 4px 16px ${cat.color}18`,
            }}
          >{cat.icon}</motion.div>

          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:16, fontWeight:700, color:K.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{ex.name}</div>
            <div style={{display:"flex", alignItems:"center", gap:8, marginTop:4}}>
              <span style={{
                background:`${cat.color}18`, color:cat.color,
                padding:"2px 9px", borderRadius:20,
                fontSize:11, fontWeight:700,
                border:`1px solid ${cat.color}30`,
              }}>{cat.name}</span>
              <span style={{fontSize:12, color:K.sub}}>{new Date(ex.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            </div>
          </div>

          <div style={{flexShrink:0, textAlign:"right"}}>
            <div style={{fontSize:18, fontWeight:900, color:cat.color}}>{moneyFull(ex.amount)}</div>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={springFast}
              style={{fontSize:12, color:K.sub, marginTop:2, display:"flex", justifyContent:"flex-end"}}
            >▾</motion.div>
          </div>
        </motion.div>

        {/* Expandable details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height:0, opacity:0 }}
              animate={{ height:"auto", opacity:1 }}
              exit={{ height:0, opacity:0 }}
              transition={{ type:"spring", stiffness:380, damping:32 }}
              style={{overflow:"hidden"}}
            >
              <div style={{padding:"0 18px 16px", display:"flex", gap:10}}>
                {ex.notes && (
                  <div style={{flex:1, background:K.card2, borderRadius:14, padding:"10px 14px", fontSize:13, color:K.sub, border:`1px solid ${K.border}`}}>
                    📝 {ex.notes}
                  </div>
                )}
                <motion.button
                  onClick={(e)=>{e.stopPropagation();onEdit();}}
                  whileHover={{ scale:1.08 }}
                  whileTap={{ scale:0.92 }}
                  style={{width:44,height:44,borderRadius:14,border:`1px solid ${K.border}`,background:K.accent+"18",color:K.accent,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                >✏️</motion.button>
                <motion.button
                  onClick={(e)=>{e.stopPropagation();onDel();}}
                  whileHover={{ scale:1.08 }}
                  whileTap={{ scale:0.92 }}
                  style={{width:44,height:44,borderRadius:14,border:`1px solid ${K.border}`,background:K.red+"18",color:K.red,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                >🗑️</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // Premium section label
  const SecLabel = ({children, right, icon}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"22px 20px 12px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {icon && <span style={{fontSize:15}}>{icon}</span>}
        <span style={{fontSize:11,fontWeight:800,color:K.sub,letterSpacing:1.5,textTransform:"uppercase"}}>{children}</span>
      </div>
      {right && <span style={{fontSize:13,fontWeight:700,color:K.accent}}>{right}</span>}
    </div>
  );

  // Glass card wrapper
  const Card = ({children, style={}, glow=""}) => (
    <div style={{
      background:K.card,
      border:`1px solid ${K.border}`,
      borderRadius:24,
      ...(glow ? { boxShadow:`0 0 32px ${glow}18, 0 4px 24px rgba(0,0,0,.2)` } : {}),
      ...style
    }}>
      {children}
    </div>
  );

  // Glass stat chip
  const StatChip = ({label, value, color, icon, onClick}) => (
    <motion.div
      whileHover={{ scale:1.03, y:-2 }}
      whileTap={{ scale:0.97 }}
      onClick={onClick}
      style={{
        background:`linear-gradient(145deg, ${color}18, ${color}0C)`,
        border:`1px solid ${color}30`,
        borderRadius:20, padding:"18px 16px",
        cursor:onClick?"pointer":"default",
        backdropFilter:"blur(8px)",
      }}
    >
      <div style={{fontSize:24,marginBottom:8}}>{icon}</div>
      <div style={{fontSize:11,fontWeight:700,color,letterSpacing:1,marginBottom:4}}>{label.toUpperCase()}</div>
      <div style={{fontSize:22,fontWeight:900,color:K.text,lineHeight:1}}>
        <AnimatedNumber value={value} format={money} />
      </div>
    </motion.div>
  );

  // Bottom sheet drawer
  const BottomSheet = ({show, onClose, title, sub, children}) => (
    <AnimatePresence>
      {show && (
        <motion.div
          key="bottom-sheet-overlay"
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          exit={{ opacity:0 }}
          style={{position:"absolute",inset:0,zIndex:300,display:"flex",flexDirection:"column"}}
        >
          <motion.div
            onClick={onClose}
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            style={{flex:1, background:"rgba(0,0,0,.72)", backdropFilter:"blur(10px)"}}
          />
          <motion.div
            initial={{ y:"100%" }}
            animate={{ y:0 }}
            exit={{ y:"100%" }}
            transition={springSheet}
            style={{
              background:K.card,
              borderRadius:"32px 32px 0 0",
              maxHeight:"88vh", display:"flex", flexDirection:"column",
              overflow:"hidden",
              boxShadow:"0 -16px 60px rgba(0,0,0,.6)",
              border:`1px solid ${K.border}`,
              borderBottom:"none",
            }}
          >
            <div style={{display:"flex",justifyContent:"center",padding:"14px 0 6px",flexShrink:0}}>
              <div style={{width:42,height:4,borderRadius:2,background:K.border2}}/>
            </div>
            {title && (
              <div style={{padding:"4px 24px 18px",borderBottom:`1px solid ${K.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:21,fontWeight:900,color:K.text}}>{title}</div>
                  {sub && <div style={{fontSize:13,color:K.sub,marginTop:4}}>{sub}</div>}
                </div>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale:1.1,rotate:90 }}
                  whileTap={{ scale:0.9 }}
                  transition={springFast}
                  style={{width:44,height:44,borderRadius:14,border:`1px solid ${K.border}`,background:K.card2,color:K.sub,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}
                >✕</motion.button>
              </div>
            )}
            <div style={{overflowY:"auto",WebkitOverflowScrolling:"touch",flex:1}}>
              {children}
              <div style={{height:40}}/>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ════════════════════════════════════════════════════════
  //  PAGE: HOME
  // ════════════════════════════════════════════════════════
  const PageHome = () => {
    const periods = [
      {label:"Today",      icon:"📅", exps:todayExp, color:"#6366F1"},
      {label:"This Week",  icon:"📆", exps:weekExp,  color:"#06B6D4"},
      {label:"This Month", icon:"🗓️", exps:monthExp, color:"#F59E0B"},
      {label:"This Year",  icon:"📊", exps:yearExp,  color:"#22C55E"},
    ];

    const topCat = catTotals[0];
    const monthGrand = total(monthExp);
    const avgDaily = monthGrand > 0 ? (monthGrand / now.getDate()).toFixed(0) : 0;

    return (
      <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:120}}>

        {/* ── Hero Banner — premium gradient card ─────── */}
        <motion.div
          initial={{ opacity:0, y:-20, scale:0.97 }}
          animate={{ opacity:1, y:0, scale:1 }}
          transition={{ type:"spring", stiffness:280, damping:26, delay:0.04 }}
          style={{
            margin:"16px 16px 0",
            background: dark
              ? "linear-gradient(145deg,#1e1b4b 0%,#312e81 40%,#1e3a5f 100%)"
              : "linear-gradient(145deg,#4338ca 0%,#5b21b6 50%,#1d4ed8 100%)",
            borderRadius:30, padding:"28px 24px 24px",
            position:"relative", overflow:"hidden",
            border:"1px solid rgba(255,255,255,.1)",
            boxShadow:"0 20px 60px rgba(99,102,241,.3), 0 8px 32px rgba(0,0,0,.3)",
          }}
        >
          {/* Animated mesh bg */}
          <div style={{position:"absolute",top:-60,right:-60,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.06)",animation:"blobMove 20s ease-in-out infinite"}}/>
          <div style={{position:"absolute",bottom:-40,left:-30,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.04)",animation:"blobMoveAlt 25s ease-in-out infinite"}}/>
          <div style={{position:"absolute",top:"40%",right:"15%",width:100,height:100,borderRadius:"50%",background:"rgba(139,92,246,.25)",filter:"blur(20px)"}}/>

          {gsOn && (
            <motion.div
              initial={{ opacity:0,x:-10 }}
              animate={{ opacity:1,x:0 }}
              style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}
            >
              <motion.div
                animate={{ scale:[1,1.4,1] }}
                transition={{ duration:2,repeat:Infinity,ease:"easeInOut" }}
                style={{width:7,height:7,borderRadius:4,background:"#4ade80"}}
              />
              <span style={{fontSize:11,color:"rgba(255,255,255,.6)",fontWeight:600,letterSpacing:.5}}>SYNCED WITH GOOGLE SHEETS</span>
            </motion.div>
          )}

          <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:8,fontWeight:600,letterSpacing:.5}}>TOTAL THIS MONTH</div>
          <div style={{fontSize:52,fontWeight:900,color:"#FFF",letterSpacing:-2,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>
            <AnimatedNumber value={monthGrand} format={money} />
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.45)",marginTop:6}}>
            {monthExp.length} transaction{monthExp.length!==1?"s":""} · avg {money(+avgDaily)}/day
          </div>

          <div style={{display:"flex",gap:10,marginTop:22}}>
            {[{l:"Today",v:todayExp,c:"rgba(255,255,255,.12)"},{l:"This Year",v:yearExp,c:"rgba(255,255,255,.12)"}].map(({l,v,c})=>(
              <div key={l} style={{flex:1,background:c,borderRadius:18,padding:"14px 16px",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.1)"}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginBottom:6,fontWeight:600,letterSpacing:.5}}>{l.toUpperCase()}</div>
                <div style={{fontSize:21,fontWeight:900,color:"#FFF"}}>
                  <AnimatedNumber value={total(v)} format={money} />
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.38)",marginTop:3}}>{v.length} items</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Quick stat chips ─────────────────────────── */}
        {topCat && topCat.total > 0 && (
          <motion.div
            initial={{ opacity:0, y:12 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay:0.12, type:"spring", stiffness:300, damping:26 }}
            style={{margin:"14px 16px 0",background:K.card,border:`1px solid ${K.border}`,borderRadius:22,padding:"16px 18px",display:"flex",alignItems:"center",gap:16}}
          >
            <div style={{width:48,height:48,borderRadius:16,background:`${topCat.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,border:`1px solid ${topCat.color}30`,flexShrink:0}}>{topCat.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:700,color:K.sub,letterSpacing:.8,marginBottom:3}}>TOP CATEGORY</div>
              <div style={{fontSize:15,fontWeight:800,color:K.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topCat.name}</div>
            </div>
            <div style={{fontSize:18,fontWeight:900,color:topCat.color}}>{money(topCat.total)}</div>
          </motion.div>
        )}

        {/* ── Period cards ─────────────────────────────── */}
        <SecLabel icon="📊">TAP TO EXPLORE</SecLabel>
        <motion.div
          variants={gridContainer}
          initial="hidden"
          animate="show"
          style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"0 16px"}}
        >
          {periods.map(p=>(
            <motion.button
              key={p.label}
              variants={gridItem}
              whileHover={{ y:-5, scale:1.02, boxShadow:`0 16px 40px ${p.color}22` }}
              whileTap={{ scale:0.95 }}
              onClick={()=>setDrawer({title:p.label, sub:`${p.exps.length} transactions · ${moneyFull(total(p.exps))}`, exps:p.exps})}
              style={{
                background:K.card,
                border:`1.5px solid ${K.border}`,
                borderRadius:24, padding:"20px 16px",
                textAlign:"left", cursor:"pointer",
                transition:"box-shadow 0.2s",
              }}
            >
              <div style={{
                width:44,height:44,borderRadius:14,
                background:`${p.color}18`,
                border:`1px solid ${p.color}30`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:22,marginBottom:12,
              }}>{p.icon}</div>
              <div style={{fontSize:11,fontWeight:800,color:K.sub,letterSpacing:1,marginBottom:6}}>{p.label.toUpperCase()}</div>
              <div style={{fontSize:24,fontWeight:900,color:p.color,lineHeight:1}}>
                <AnimatedNumber value={total(p.exps)} format={money} />
              </div>
              <div style={{fontSize:12,color:K.sub,marginTop:6}}>{p.exps.length} transactions</div>
            </motion.button>
          ))}
        </motion.div>

        {/* ── 7-day sparkline ──────────────────────────── */}
        {weeklyArea.some(d=>d.v>0) && (
          <>
            <SecLabel icon="📈">THIS WEEK</SecLabel>
            <Card style={{margin:"0 16px",padding:"18px 16px 12px"}}>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={weeklyArea} margin={{top:4,right:4,left:-30,bottom:0}}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={K.accent} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={K.accent} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{fill:K.sub,fontSize:12}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:K.sub,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip
                    contentStyle={{background:K.card2,border:`1px solid ${K.border}`,color:K.text,borderRadius:12,fontSize:13}}
                    formatter={v=>[moneyFull(v),""]}
                    cursor={{stroke:K.accent,strokeWidth:1,strokeDasharray:"4 4"}}
                  />
                  <Area type="monotone" dataKey="v" stroke={K.accent} strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill:K.accent, r:3, strokeWidth:0 }} activeDot={{ r:5, fill:K.accentL }}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {/* ── Quick add grid ───────────────────────────── */}
        <SecLabel icon="⚡">QUICK ADD</SecLabel>
        <motion.div
          variants={gridContainer}
          initial="hidden"
          animate="show"
          style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,padding:"0 16px"}}
        >
          {CATS.map(cat=>(
            <motion.button
              key={cat.id}
              variants={gridItem}
              whileHover={{ scale:1.07, y:-4, boxShadow:`0 10px 24px ${cat.color}20` }}
              whileTap={{ scale:0.88 }}
              onClick={()=>openAdd(cat)}
              style={{
                background:K.card,
                border:`1.5px solid ${K.border}`,
                borderRadius:20, padding:"18px 4px 14px",
                textAlign:"center", cursor:"pointer",
                display:"flex", flexDirection:"column",
                alignItems:"center", gap:8,
                transition:"box-shadow 0.2s",
              }}
            >
              <div style={{
                width:44,height:44,borderRadius:14,
                background:`${cat.color}18`,
                border:`1px solid ${cat.color}30`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:24,
              }}>{cat.icon}</div>
              <div style={{fontSize:10,fontWeight:700,color:K.sub,lineHeight:1.3,textAlign:"center"}}>{cat.name}</div>
            </motion.button>
          ))}
        </motion.div>

        {/* ── Recent ────────────────────────────────────── */}
        {expenses.length > 0 && <>
          <SecLabel icon="🕐" right={`${expenses.length} total`}>RECENT</SecLabel>
          <Card style={{margin:"0 16px",overflow:"hidden"}}>
            <motion.div variants={listContainer} initial="hidden" animate="show">
              <AnimatePresence initial={false}>
                {expenses.slice(0,5).map((ex,i)=>(
                  <ExpRow key={ex.id} ex={ex} index={i} onEdit={()=>openEdit(ex)} onDel={()=>setDelId(ex.id)}/>
                ))}
              </AnimatePresence>
            </motion.div>
          </Card>
        </>}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  //  PAGE: CALENDAR
  // ════════════════════════════════════════════════════════
  const PageCalendar = () => {
    const dayExps = expenses.filter(e=>e.date===calDay);
    const monExps = expenses.filter(e=>e.date.startsWith(mKey(calDate)));
    const yrExps  = expenses.filter(e=>e.date.startsWith(yKey(calDate)));
    const shown   = calView==="day" ? dayExps : calView==="month" ? monExps : yrExps;

    const prevM = ()=>{const d=new Date(calDate);d.setMonth(d.getMonth()-1);setCalDate(d);};
    const nextM = ()=>{const d=new Date(calDate);d.setMonth(d.getMonth()+1);setCalDate(d);};
    const prevY = ()=>{const d=new Date(calDate);d.setFullYear(d.getFullYear()-1);setCalDate(d);};
    const nextY = ()=>{const d=new Date(calDate);d.setFullYear(d.getFullYear()+1);setCalDate(d);};

    const yrBreak = Array.from({length:12},(_,i)=>{
      const key=`${calDate.getFullYear()}-${String(i+1).padStart(2,"0")}`;
      const ex=expenses.filter(e=>e.date.startsWith(key));
      return {month:MONTHS[i],key,tot:total(ex),count:ex.length};
    });

    const maxYr = Math.max(...yrBreak.map(b=>b.tot), 1);

    const grouped = {};
    [...shown].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(ex=>{
      if (!grouped[ex.date]) grouped[ex.date]=[];
      grouped[ex.date].push(ex);
    });

    const NavBtn = ({onClick,children}) => (
      <motion.button
        whileHover={{ scale:1.06, backgroundColor:K.card3 }}
        whileTap={{ scale:0.88 }}
        onClick={onClick}
        style={{width:48,height:48,borderRadius:16,border:`1px solid ${K.border}`,background:K.card2,color:K.text,cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s"}}
      >{children}</motion.button>
    );

    return (
      <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:120}}>

        <div style={{padding:"16px 16px 12px"}}>
          <div style={{display:"flex",background:K.card2,borderRadius:20,padding:5,gap:3,border:`1px solid ${K.border}`,position:"relative"}}>
            {[["day","Day"],["month","Month"],["year","Year"]].map(([v,l])=>(
              <motion.button
                key={v}
                onClick={()=>setCalView(v)}
                whileTap={{ scale:0.94 }}
                style={{flex:1,padding:"13px 0",borderRadius:15,border:"none",background:"transparent",color:calView===v?"#FFF":K.sub,cursor:"pointer",fontSize:14,fontWeight:700,position:"relative",zIndex:1}}
              >
                {calView===v && (
                  <motion.div
                    layoutId="cal-pill"
                    style={{position:"absolute",inset:0,borderRadius:15,background:K.accent,zIndex:-1}}
                    transition={{ type:"spring",stiffness:360,damping:30 }}
                  />
                )}
                {l}
              </motion.button>
            ))}
          </div>
        </div>

        {calView!=="year" && (
          <Card style={{margin:"0 16px 14px",overflow:"hidden"}}>
            <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${K.border}`}}>
              <NavBtn onClick={prevM}>‹</NavBtn>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:900,color:K.text}}>{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</div>
                <div style={{fontSize:14,color:K.amber,fontWeight:700,marginTop:3}}>
                  <AnimatedNumber value={total(monExps)} format={moneyFull} />
                </div>
              </div>
              <NavBtn onClick={nextM}>›</NavBtn>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"12px 12px 6px"}}>
              {DAYS.map(d=>(
                <div key={d} style={{textAlign:"center",fontSize:12,fontWeight:700,color:K.sub,padding:"3px 0"}}>{d}</div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px 16px",gap:3}}>
              {calGrid.map((cell,i)=>{
                if (!cell) return <div key={`e${i}`}/>;
                const isTod = cell.ds===today();
                const isSel = cell.ds===calDay;
                const has   = cell.tot > 0;
                return (
                  <motion.button
                    key={cell.ds}
                    whileHover={{ scale:1.12 }}
                    whileTap={{ scale:0.82 }}
                    onClick={()=>{setCalDay(cell.ds);setCalView("day");}}
                    style={{
                      aspectRatio:"1", borderRadius:12, border:"none",
                      background: isSel ? K.accent : isTod ? K.accent+"30" : "transparent",
                      outline: isTod&&!isSel ? `2px solid ${K.accent}60` : "none",
                      outlineOffset:"-2px",
                      cursor:"pointer",
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center", gap:2, padding:2,
                    }}
                  >
                    <div style={{fontSize:14,fontWeight:isTod||isSel?800:400,color:isSel?"#FFF":K.text,lineHeight:1}}>{cell.day}</div>
                    {has && <div style={{width:4,height:4,borderRadius:2,background:isSel?"rgba(255,255,255,.8)":K.amber}}/>}
                  </motion.button>
                );
              })}
            </div>
          </Card>
        )}

        {calView==="year" && (
          <Card style={{margin:"0 16px 14px",padding:"18px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <NavBtn onClick={prevY}>‹</NavBtn>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:K.text}}>{calDate.getFullYear()}</div>
                <div style={{fontSize:14,color:K.amber,fontWeight:700,marginTop:3}}>
                  <AnimatedNumber value={total(yrExps)} format={moneyFull} />
                </div>
              </div>
              <NavBtn onClick={nextY}>›</NavBtn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {yrBreak.map(({month,key,tot,count})=>{
                const isCur = key===mKey(new Date());
                const pct   = tot/maxYr*100;
                return (
                  <motion.button
                    key={key}
                    whileHover={{ scale:1.04,y:-2 }}
                    whileTap={{ scale:0.94 }}
                    onClick={()=>{const d=new Date(calDate);d.setMonth(MONTHS.indexOf(month));setCalDate(d);setCalView("month");}}
                    style={{
                      background:isCur ? K.accent+"20" : K.card2,
                      border:`1.5px solid ${isCur?K.accent:K.border}`,
                      borderRadius:18, padding:"14px 12px",
                      cursor:"pointer", textAlign:"left", overflow:"hidden", position:"relative",
                    }}
                  >
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${pct}%`,background:isCur?K.accent+"18":K.border+"60",transition:"height 0.4s",zIndex:0}}/>
                    <div style={{position:"relative",zIndex:1}}>
                      <div style={{fontSize:13,fontWeight:800,color:isCur?K.accent:K.text}}>{month}</div>
                      <div style={{fontSize:15,fontWeight:900,color:tot>0?K.amber:K.sub2,marginTop:6}}>{tot>0?money(tot):"—"}</div>
                      <div style={{fontSize:10,color:K.sub,marginTop:2}}>{count} items</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </Card>
        )}

        <div style={{background:K.card,border:`1px solid ${K.border}`,borderRadius:20,margin:"0 16px 14px",padding:"16px 18px",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:44,height:44,borderRadius:14,background:K.accent+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🗓️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:K.sub,letterSpacing:.8,marginBottom:6}}>JUMP TO DATE</div>
            <input type="date" defaultValue={today()}
              onChange={e=>{if(e.target.value){setCalDay(e.target.value);setCalDate(new Date(e.target.value+"T12:00:00"));setCalView("day");}}}
              style={{fontSize:15,color:K.text,background:"transparent",border:"none",outline:"none",width:"100%",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}/>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 20px 14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:K.sub,letterSpacing:.8}}>
            {calView==="day" ? calDay : calView==="month" ? `${MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}` : calDate.getFullYear()}
          </div>
          <div style={{fontSize:17,fontWeight:900,color:K.accent}}>
            <AnimatedNumber value={total(shown)} format={moneyFull} />
          </div>
        </div>

        {shown.length===0 ? (
          <Card style={{margin:"0 16px",padding:"48px 20px",textAlign:"center"}}>
            <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:280,damping:20}}>
              <div style={{fontSize:56,marginBottom:14}}>📭</div>
            </motion.div>
            <div style={{fontSize:17,fontWeight:700,color:K.sub,marginBottom:20}}>No expenses here</div>
            <motion.button
              whileHover={{ scale:1.04,y:-2 }}
              whileTap={{ scale:0.96 }}
              onClick={()=>openAdd(CATS[0], calView==="day"?calDay:today())}
              style={{padding:"14px 28px",borderRadius:16,border:"none",background:K.accent,color:"#FFF",cursor:"pointer",fontSize:15,fontWeight:700,boxShadow:`0 6px 20px ${K.accent}40`}}
            >+ Add Expense</motion.button>
          </Card>
        ) : (
          <Card style={{margin:"0 16px",overflow:"hidden"}}>
            <AnimatePresence initial={false}>
              {Object.entries(grouped).map(([date,exps])=>(
                <div key={date}>
                  {calView!=="day" && (
                    <div style={{display:"flex",justifyContent:"space-between",padding:"12px 18px 8px",background:K.card2,borderBottom:`1px solid ${K.border}`}}>
                      <span style={{fontSize:13,fontWeight:700,color:K.sub}}>{new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
                      <span style={{fontSize:13,fontWeight:800,color:K.amber}}>{moneyFull(total(exps))}</span>
                    </div>
                  )}
                  {exps.map((ex,i)=><ExpRow key={ex.id} ex={ex} index={i} onEdit={()=>openEdit(ex)} onDel={()=>setDelId(ex.id)}/>)}
                </div>
              ))}
            </AnimatePresence>
          </Card>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  //  PAGE: HISTORY
  // ════════════════════════════════════════════════════════
  const PageHistory = () => (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{padding:"16px 16px 10px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",background:K.card,border:`1.5px solid ${K.border}`,borderRadius:18,padding:"0 18px",gap:12}}>
          <span style={{fontSize:20,color:K.sub}}>🔍</span>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search expenses…"
            style={{flex:1,padding:"16px 0",background:"transparent",border:"none",outline:"none",color:K.text,fontSize:16,fontFamily:"inherit"}}
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ scale:0,opacity:0 }}
                animate={{ scale:1,opacity:1 }}
                exit={{ scale:0,opacity:0 }}
                transition={springFast}
                whileTap={{ scale:0.8,rotate:90 }}
                onClick={()=>setSearch("")}
                style={{background:"none",border:"none",color:K.sub,cursor:"pointer",fontSize:18,padding:0,display:"flex"}}
              >✕</motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{padding:"0 16px 12px",overflowX:"auto",display:"flex",gap:8,WebkitOverflowScrolling:"touch",flexShrink:0}}>
        {[{id:"all",name:"All",icon:"🗂️",color:K.accent},...CATS].map(c=>{
          const active = filterCat===c.id;
          const col    = c.id==="all" ? K.accent : (getCat(c.id)?.color||K.accent);
          return (
            <motion.button
              key={c.id}
              onClick={()=>setFilterCat(c.id)}
              whileHover={{ scale:1.05 }}
              whileTap={{ scale:0.9 }}
              style={{
                flexShrink:0, padding:"9px 14px", borderRadius:20,
                border:`1.5px solid ${active?col:K.border}`,
                background:active ? `${col}22` : K.card,
                color:active ? col : K.sub,
                cursor:"pointer", fontSize:13, fontWeight:700,
                whiteSpace:"nowrap", display:"flex", gap:6, alignItems:"center",
              }}
            >
              <span style={{fontSize:16}}>{c.icon}</span>{c.name}
            </motion.button>
          );
        })}
      </div>

      <div style={{padding:"0 20px 10px",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,color:K.sub,fontWeight:600}}>{filtered.length} result{filtered.length!==1?"s":""}</span>
        <span style={{fontSize:16,fontWeight:900,color:K.accent}}>
          <AnimatedNumber value={total(filtered)} format={moneyFull} />
        </span>
      </div>

      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:120}}>
        {filtered.length===0 ? (
          <div style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{fontSize:48,marginBottom:12}}>🔎</div>
            <div style={{color:K.sub,fontSize:16,fontWeight:600}}>No expenses found</div>
          </div>
        ) : (
          <Card style={{margin:"0 16px",overflow:"hidden"}}>
            <motion.div variants={listContainer} initial="hidden" animate="show">
              <AnimatePresence initial={false}>
                {filtered.map((ex,i)=><ExpRow key={ex.id} ex={ex} index={i} onEdit={()=>openEdit(ex)} onDel={()=>setDelId(ex.id)}/>)}
              </AnimatePresence>
            </motion.div>
          </Card>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  PAGE: REPORTS
  // ════════════════════════════════════════════════════════
  const PageReports = () => {
    const topCat = catTotals[0];
    const grandTotal = total(expenses);

    // Custom pie label
    const renderPieLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent,name }) => {
      if (percent < 0.06) return null;
      const RADIAN = Math.PI / 180;
      const r = innerRadius + (outerRadius - innerRadius) * 0.6;
      const x = cx + r * Math.cos(-midAngle * RADIAN);
      const y = cy + r * Math.sin(-midAngle * RADIAN);
      return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
          {`${(percent*100).toFixed(0)}%`}
        </text>
      );
    };

    return (
      <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:120}}>

        {/* KPI grid */}
        <SecLabel icon="💡">OVERVIEW</SecLabel>
        <motion.div
          variants={gridContainer}
          initial="hidden"
          animate="show"
          style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"0 16px"}}
        >
          {[
            {l:"This Month", v:total(monthExp), icon:"🗓️", c:"#6366F1"},
            {l:"This Year",  v:total(yearExp),  icon:"📊",  c:"#22C55E"},
            {l:"Today",      v:total(todayExp), icon:"📅",  c:"#F59E0B"},
            {l:"Top Cat",    v:catTotals[0]?.total||0, icon:catTotals[0]?.icon||"🏆", c:"#EF4444", sub:catTotals[0]?.name},
          ].map((s,i)=>(
            <motion.div key={i} variants={gridItem} style={{
              background:K.card, border:`1px solid ${K.border}`,
              borderRadius:22, padding:"20px 16px",
              position:"relative", overflow:"hidden",
            }}>
              <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`${s.c}10`}}/>
              <div style={{
                width:42,height:42,borderRadius:14,
                background:`${s.c}18`,border:`1px solid ${s.c}30`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:22,marginBottom:12,
              }}>{s.icon}</div>
              <div style={{fontSize:11,fontWeight:700,color:K.sub,letterSpacing:1}}>{s.l.toUpperCase()}</div>
              <div style={{fontSize:22,fontWeight:900,color:s.c,marginTop:5,lineHeight:1}}>
                <AnimatedNumber value={s.v} format={money} />
              </div>
              {s.sub && <div style={{fontSize:11,color:K.sub,marginTop:5}}>{s.sub}</div>}
            </motion.div>
          ))}
        </motion.div>

        {/* 6-month bar chart */}
        <SecLabel icon="📊">6-MONTH TREND</SecLabel>
        <Card style={{margin:"0 16px",padding:"18px 14px 12px"}}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyBar} margin={{top:0,right:0,left:-22,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={K.border} vertical={false}/>
              <XAxis dataKey="month" tick={{fill:K.sub,fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:K.sub,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip
                contentStyle={{background:K.card2,border:`1px solid ${K.border}`,color:K.text,borderRadius:12,fontSize:13}}
                formatter={v=>[moneyFull(v),"Total"]}
                cursor={{fill:K.accent+"12"}}
              />
              <Bar dataKey="v" radius={[8,8,2,2]}>
                {monthlyBar.map((entry,i)=>(
                  <Cell key={i} fill={i===monthlyBar.length-1 ? K.accent : K.accentL+"88"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie chart */}
        {pieData.length>0 && (
          <>
            <SecLabel icon="🍩">BY CATEGORY</SecLabel>
            <Card style={{margin:"0 16px",padding:"20px 16px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:"0 0 180px"}}>
                  <PieChart width={180} height={180}>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      outerRadius={82} innerRadius={42}
                      dataKey="total" nameKey="name"
                      labelLine={false}
                      label={renderPieLabel}
                      paddingAngle={2}
                    >
                      {pieData.map(c=><Cell key={c.id} fill={c.color} stroke={K.card} strokeWidth={2}/>)}
                    </Pie>
                    <Tooltip formatter={v=>moneyFull(v)} contentStyle={{background:K.card2,border:`1px solid ${K.border}`,color:K.text,borderRadius:12,fontSize:13}}/>
                  </PieChart>
                </div>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                  {pieData.map(c=>(
                    <div key={c.id} style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:10,height:10,borderRadius:3,background:c.color,flexShrink:0}}/>
                      <div style={{fontSize:12,color:K.sub,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                      <div style={{fontSize:12,fontWeight:700,color:c.color}}>{money(c.total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Category breakdown with animated bars */}
        <SecLabel icon="🏷️">ALL CATEGORIES</SecLabel>
        <Card style={{margin:"0 16px",padding:"4px 18px 8px"}}>
          {catTotals.filter(c=>c.total>0).map((c,catIdx)=>{
            const pct = grandTotal>0 ? (c.total/grandTotal)*100 : 0;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity:0,x:-16 }}
                animate={{ opacity:1,x:0 }}
                transition={{ delay:catIdx*0.04, type:"spring",stiffness:340,damping:28 }}
                style={{padding:"14px 0",borderBottom:`1px solid ${K.border}`}}
              >
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{
                      width:42,height:42,borderRadius:14,
                      background:`${c.color}18`,border:`1px solid ${c.color}28`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
                    }}>{c.icon}</div>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:K.text}}>{c.name}</div>
                      <div style={{fontSize:11,color:K.sub,marginTop:2}}>{expenses.filter(e=>e.category===c.id).length} transactions</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:17,fontWeight:900,color:c.color}}>{money(c.total)}</div>
                    <div style={{fontSize:11,color:K.sub,marginTop:1}}>{pct.toFixed(1)}%</div>
                  </div>
                </div>
                <div style={{height:6,background:K.card2,borderRadius:3,overflow:"hidden"}}>
                  <motion.div
                    initial={{ width:0 }}
                    animate={{ width:`${pct}%` }}
                    transition={{ duration:0.8, ease:[0.16,1,0.3,1], delay:catIdx*0.04 }}
                    style={{height:"100%",background:`linear-gradient(90deg,${c.color}cc,${c.color})`,borderRadius:3}}
                  />
                </div>
              </motion.div>
            );
          })}
          {catTotals.every(c=>c.total===0) && (
            <div style={{padding:"40px 0",textAlign:"center",color:K.sub,fontSize:15}}>No data yet — add your first expense!</div>
          )}
        </Card>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  //  PAGE: SETTINGS
  // ════════════════════════════════════════════════════════
  const PageSettings = () => (
    <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:120}}>

      <SecLabel icon="☁️">GOOGLE SHEETS SYNC</SecLabel>
      <Card style={{margin:"0 16px",overflow:"hidden"}}>
        {gsOn ? (
          <>
            <div style={{padding:"20px 20px",display:"flex",alignItems:"center",gap:16,borderBottom:`1px solid ${K.border}`,background:`${K.green}0C`}}>
              <div style={{width:52,height:52,borderRadius:18,background:`${K.green}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>✅</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:800,color:K.green}}>Connected</div>
                <div style={{fontSize:12,color:K.sub,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{scriptUrl.slice(0,46)}…</div>
              </div>
            </div>
            <div style={{padding:"16px 20px",display:"flex",gap:10}}>
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.96}} onClick={restoreSheets} disabled={gsBusy} style={{flex:1,padding:"14px",borderRadius:16,border:`1.5px solid ${K.accent}`,background:`${K.accent}18`,color:K.accent,cursor:"pointer",fontSize:14,fontWeight:700}}>
                {gsBusy?"Syncing…":"⬇️ Restore"}
              </motion.button>
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.96}} onClick={disconnectGs} style={{flex:1,padding:"14px",borderRadius:16,border:`1.5px solid ${K.red}`,background:`${K.red}18`,color:K.red,cursor:"pointer",fontSize:14,fontWeight:700}}>
                Disconnect
              </motion.button>
            </div>
          </>
        ) : (
          <div style={{padding:"20px"}}>
            <div style={{fontSize:12,fontWeight:700,color:K.sub,letterSpacing:.8,marginBottom:8}}>APPS SCRIPT URL</div>
            <input value={urlDraft} onChange={e=>setUrlDraft(e.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              style={{width:"100%",padding:"16px",borderRadius:16,border:`1.5px solid ${K.border}`,background:K.card2,color:K.text,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",marginBottom:14}}/>
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={connectGs} style={{width:"100%",padding:"16px",borderRadius:16,border:"none",background:K.accent,color:"#FFF",cursor:"pointer",fontSize:16,fontWeight:800,boxShadow:`0 6px 20px ${K.accent}40`}}>
              🔗 Connect
            </motion.button>
          </div>
        )}
      </Card>

      <SecLabel icon="⚙️">PREFERENCES</SecLabel>
      <Card style={{margin:"0 16px",overflow:"hidden"}}>
        {/* Dark mode */}
        <div style={{padding:"20px",borderBottom:`1px solid ${K.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:52,height:52,borderRadius:18,background:`${K.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{dark?"🌙":"☀️"}</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:K.text}}>Dark Mode</div>
              <div style={{fontSize:12,color:K.sub,marginTop:2}}>Toggle app theme</div>
            </div>
          </div>
          <motion.button
            whileTap={{ scale:0.92 }}
            onClick={()=>{const nd=!dark;setDark(nd);try{localStorage.setItem("exp_cfg4",JSON.stringify({dark:nd,currency}));}catch{}}}
            style={{width:58,height:32,borderRadius:16,border:"none",background:dark?K.accent:"#CBD5E1",cursor:"pointer",position:"relative",flexShrink:0,boxShadow:`0 2px 12px ${dark?K.accent+"50":"rgba(0,0,0,.12)"}`}}
          >
            <motion.div
              animate={{ left: dark ? 28 : 4 }}
              transition={{ type:"spring",stiffness:440,damping:28 }}
              style={{width:24,height:24,borderRadius:12,background:"#FFF",position:"absolute",top:4,boxShadow:"0 2px 8px rgba(0,0,0,.25)"}}
            />
          </motion.button>
        </div>

        {/* Currency */}
        <div style={{padding:"20px",borderBottom:`1px solid ${K.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:52,height:52,borderRadius:18,background:"#F59E0B18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>💱</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:K.text}}>Currency</div>
              <div style={{fontSize:12,color:K.sub,marginTop:2}}>Display format</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {[{code:"DA",label:"DA"},{code:"USD",label:"$"},{code:"EUR",label:"€"}].map(c=>(
              <motion.button
                key={c.code}
                whileTap={{ scale:0.88 }}
                onClick={()=>{setCurrency(c.code);try{localStorage.setItem("exp_cfg4",JSON.stringify({dark,currency:c.code}));}catch{}}}
                style={{padding:"9px 14px",borderRadius:12,border:`2px solid ${currency===c.code?K.accent:K.border}`,background:currency===c.code?`${K.accent}22`:"transparent",color:currency===c.code?K.accent:K.sub,cursor:"pointer",fontSize:13,fontWeight:currency===c.code?800:500}}
              >{c.label} {c.code}</motion.button>
            ))}
          </div>
        </div>

        {/* Export */}
        <div style={{padding:"20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:52,height:52,borderRadius:18,background:"#F59E0B18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>📤</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:K.text}}>Export CSV</div>
              <div style={{fontSize:12,color:K.sub,marginTop:2}}>Download all data</div>
            </div>
          </div>
          <motion.button
            whileHover={{ scale:1.04 }}
            whileTap={{ scale:0.93 }}
            onClick={()=>{
              const h="ID,Date,Category,Name,Amount,Notes\n";
              const r=expenses.map(e=>[e.id,e.date,getCat(e.category).name,`"${e.name}"`,e.amount,`"${e.notes||""}"`].join(",")).join("\n");
              const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([h+r],{type:"text/csv"}));a.download="expenses.csv";a.click();
              toast$("Exported successfully",false,"📊");
            }}
            style={{padding:"12px 20px",borderRadius:14,border:"none",background:"#F59E0B18",color:K.amber,cursor:"pointer",fontSize:14,fontWeight:800}}
          >Export</motion.button>
        </div>
      </Card>

      <SecLabel icon="📱">INSTALL AS APP</SecLabel>
      <Card style={{margin:"0 16px",padding:"20px"}}>
        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{width:52,height:52,borderRadius:18,background:"#06B6D418",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>📱</div>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:K.text,marginBottom:10}}>Install on Android</div>
            <div style={{fontSize:13,color:K.sub,lineHeight:1.9}}>
              1. Open in Chrome on Android{"\n"}
              2. Tap menu ⋮ → "Add to Home screen"{"\n"}
              3. App opens fullscreen, no browser bar!
            </div>
          </div>
        </div>
      </Card>

      <SecLabel icon="🗄️">YOUR DATA</SecLabel>
      <Card style={{margin:"0 16px",padding:"4px 20px"}}>
        {[
          {l:"Total expenses",   v:`${expenses.length} items`},
          {l:"Total amount",     v:moneyFull(total(expenses))},
          {l:"Categories used",  v:`${catTotals.filter(c=>c.total>0).length} of ${CATS.length}`},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 0",borderBottom:i<2?`1px solid ${K.border}`:"none"}}>
            <span style={{fontSize:14,color:K.sub}}>{r.l}</span>
            <span style={{fontSize:15,fontWeight:800,color:K.text}}>{r.v}</span>
          </div>
        ))}
      </Card>
    </div>
  );

  // ── Nav config ────────────────────────────────────────────
  const NAV = [
    {id:"home",    icon:"🏠", label:"Home"},
    {id:"calendar",icon:"📅", label:"Calendar"},
    {id:"history", icon:"🔍", label:"Search"},
    {id:"reports", icon:"📈", label:"Reports"},
    {id:"settings",icon:"⚙️", label:"Settings"},
  ];

  const titles = {
    home:"Stable Ledger", calendar:"Calendar",
    history:"History", reports:"Reports", settings:"Settings"
  };

  const renderPage = () => {
    if (loading) return (
      <div style={{padding:"20px 16px"}}>
        {[1,2,3].map(i=>(
          <div key={i} style={{marginBottom:16}}>
            <Skeleton h={28} r={14} style={{marginBottom:8,width:"60%"}}/>
            <Skeleton h={100} r={20}/>
          </div>
        ))}
      </div>
    );
    switch(page) {
      case "home":     return <PageHome/>;
      case "calendar": return <PageCalendar/>;
      case "history":  return <PageHistory/>;
      case "reports":  return <PageReports/>;
      case "settings": return <PageSettings/>;
      default: return null;
    }
  };

  // ── Expense drawer ─────────────────────────────────────────
  const drawerGrouped = {};
  if (drawer) {
    [...(drawer.exps||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(ex=>{
      if (!drawerGrouped[ex.date]) drawerGrouped[ex.date]=[];
      drawerGrouped[ex.date].push(ex);
    });
  }

  // ════════════════════════════════════════════════════════
  //  ROOT RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div style={{
      width:"100%", maxWidth:480, margin:"0 auto",
      height:"100dvh", display:"flex", flexDirection:"column",
      background:K.bg,
      fontFamily:"'DM Sans','SF Pro Display',system-ui,sans-serif",
      color:K.text, position:"relative", overflow:"hidden",
    }}>

      {/* ── Ambient background ──────────────────────────── */}
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-5%",left:"-15%",width:320,height:320,borderRadius:"50%",background:dark?"rgba(99,102,241,.14)":"rgba(99,102,241,.08)",filter:"blur(50px)",animation:"blobMove 22s ease-in-out infinite alternate"}}/>
        <div style={{position:"absolute",top:"25%",right:"-10%",width:260,height:260,borderRadius:"50%",background:dark?"rgba(16,185,129,.1)":"rgba(16,185,129,.07)",filter:"blur(50px)",animation:"blobMoveAlt 28s ease-in-out infinite alternate"}}/>
        <div style={{position:"absolute",bottom:"12%",left:"20%",width:280,height:280,borderRadius:"50%",background:dark?"rgba(236,72,153,.09)":"rgba(236,72,153,.05)",filter:"blur(55px)",animation:"blobMove 24s ease-in-out infinite alternate-reverse"}}/>
      </div>

      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%"}}>

        {/* ── Top bar ──────────────────────────────────── */}
        <div style={{
          background:dark?"rgba(13,21,37,0.88)":"rgba(255,255,255,0.9)",
          backdropFilter:"blur(20px)",
          borderBottom:`1px solid ${K.border}`,
          padding:"18px 20px 14px",
          paddingTop:"max(18px, env(safe-area-inset-top,18px))",
          flexShrink:0,
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity:0,y:-10 }}
              animate={{ opacity:1,y:0 }}
              exit={{ opacity:0,y:10 }}
              transition={{ duration:0.2 }}
              style={{fontSize:20,fontWeight:900,color:K.text,letterSpacing:-.4}}
            >
              {titles[page]}
            </motion.div>
          </AnimatePresence>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {gsOn && (
              <motion.div
                initial={{ scale:0,opacity:0 }}
                animate={{ scale:1,opacity:1 }}
                transition={springFast}
                style={{display:"flex",alignItems:"center",gap:5,background:`${K.green}18`,borderRadius:20,padding:"5px 11px",border:`1px solid ${K.green}28`}}
              >
                <motion.div
                  animate={{ scale:[1,1.5,1],opacity:[1,0.5,1] }}
                  transition={{ duration:2.4,repeat:Infinity,ease:"easeInOut" }}
                  style={{width:6,height:6,borderRadius:3,background:K.green}}
                />
                <span style={{fontSize:11,fontWeight:700,color:K.green}}>Sheets</span>
              </motion.div>
            )}
            <div style={{
              width:36,height:36,borderRadius:12,
              background:K.accent+"20",border:`1px solid ${K.accent}30`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
            }}>💼</div>
          </div>
        </div>

        {/* ── Page content ─────────────────────────────── */}
        <div style={{flex:1,overflow:"hidden",position:"relative"}}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={page}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={pageTransition}
              style={{position:"absolute",inset:0,overflow:"hidden"}}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── FAB ──────────────────────────────────────── */}
        <AnimatePresence>
          {(page==="home"||page==="calendar") && (
            <motion.div
              key="fab"
              initial={{ scale:0,rotate:-180,opacity:0 }}
              animate={{ scale:1,rotate:0,opacity:1 }}
              exit={{ scale:0,rotate:180,opacity:0 }}
              transition={{ type:"spring",stiffness:360,damping:24 }}
              style={{ position:"absolute",bottom:88,right:20,zIndex:50 }}
            >
              <motion.div
                animate={{ scale:[1,1.7,1.7],opacity:[0.5,0.12,0] }}
                transition={{ duration:2.4,repeat:Infinity,ease:"easeOut" }}
                style={{position:"absolute",inset:-10,borderRadius:"50%",background:`${K.accent}60`,pointerEvents:"none"}}
              />
              <motion.button
                onClick={()=>openAdd(CATS[0])}
                whileHover={{ scale:1.1 }}
                whileTap={{ scale:0.88,rotate:45 }}
                transition={{ type:"spring",stiffness:420,damping:20 }}
                style={{
                  width:64,height:64,borderRadius:32,border:"none",
                  background:`linear-gradient(145deg,${K.accent},#7C3AED)`,
                  color:"#FFF",fontSize:34,cursor:"pointer",
                  boxShadow:`0 10px 36px ${K.accent}60, 0 4px 12px rgba(0,0,0,.3)`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  lineHeight:1,position:"relative",
                }}>+</motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom navigation ────────────────────────── */}
        <div style={{
          background:dark?"rgba(13,21,37,0.92)":"rgba(255,255,255,0.94)",
          backdropFilter:"blur(24px)",
          borderTop:`1px solid ${K.border}`,
          display:"flex",flexShrink:0,
          paddingBottom:"max(10px, env(safe-area-inset-bottom,10px))",
        }}>
          {NAV.map(n=>{
            const active = page===n.id;
            return (
              <motion.button
                key={n.id}
                onClick={()=>navigate(n.id)}
                whileTap={{ scale:0.86 }}
                style={{
                  flex:1,padding:"12px 4px 8px",
                  border:"none",background:"transparent",
                  cursor:"pointer",display:"flex",
                  flexDirection:"column",alignItems:"center",gap:4,
                  position:"relative",
                }}
              >
                {/* Active background pill */}
                {active && (
                  <motion.div
                    layoutId="nav-bg"
                    style={{
                      position:"absolute",top:6,left:"50%",
                      width:44,height:44,borderRadius:14,
                      background:`${K.accent}18`,
                      transform:"translateX(-50%)",
                    }}
                    transition={{ type:"spring",stiffness:380,damping:30 }}
                  />
                )}
                <motion.div
                  animate={{ scale:active?1.18:1,y:active?-1:0 }}
                  transition={{ type:"spring",stiffness:420,damping:22 }}
                  style={{fontSize:22,lineHeight:1,position:"relative",zIndex:1}}
                >{n.icon}</motion.div>
                <div style={{
                  fontSize:10,fontWeight:active?800:500,
                  color:active?K.accent:K.sub,
                  letterSpacing:.3,
                  position:"relative",zIndex:1,
                }}>{n.label}</div>
                {/* Sliding underline indicator */}
                {active && (
                  <motion.div
                    layoutId="nav-line"
                    style={{width:22,height:3,borderRadius:2,background:K.accent,position:"absolute",bottom:0}}
                    transition={{ type:"spring",stiffness:400,damping:30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── ADD / EDIT MODAL ─────────────────────────── */}
        <AnimatePresence>
          {modal && selCat && (
            <motion.div
              key="modal"
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              style={{position:"absolute",inset:0,zIndex:200,display:"flex",flexDirection:"column"}}
            >
              <motion.div
                onClick={closeModal}
                style={{flex:"0 0 56px",background:"rgba(0,0,0,.72)",backdropFilter:"blur(12px)"}}
              />
              <motion.div
                initial={{ y:"100%" }}
                animate={{ y:0 }}
                exit={{ y:"100%" }}
                transition={springSheet}
                style={{
                  flex:1,background:K.card,
                  borderRadius:"32px 32px 0 0",
                  display:"flex",flexDirection:"column",
                  overflow:"hidden",
                  boxShadow:"0 -20px 80px rgba(0,0,0,.7)",
                  border:`1px solid ${K.border}`,
                  borderBottom:"none",
                }}
              >
                {/* Handle */}
                <div style={{display:"flex",justifyContent:"center",padding:"14px 0 6px",flexShrink:0}}>
                  <div style={{width:42,height:4,borderRadius:2,background:K.border2}}/>
                </div>

                {/* Modal header */}
                <div style={{padding:"4px 22px 18px",borderBottom:`1px solid ${K.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:16}}>
                  <motion.div
                    key={selCat.id}
                    initial={{ scale:0.6,rotate:-20 }}
                    animate={{ scale:1,rotate:0 }}
                    transition={{ type:"spring",stiffness:420,damping:22 }}
                    style={{
                      width:60,height:60,borderRadius:20,
                      background:`linear-gradient(145deg,${selCat.color}28,${selCat.color}14)`,
                      border:`1.5px solid ${selCat.color}40`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:32,flexShrink:0,
                      boxShadow:`0 6px 20px ${selCat.color}20`,
                    }}
                  >{selCat.icon}</motion.div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:20,fontWeight:900,color:K.text}}>{editId?"Edit Expense":`Add ${selCat.name}`}</div>
                    <div style={{fontSize:13,color:K.sub,marginTop:3}}>Category: {selCat.name}</div>
                  </div>
                  <motion.button
                    onClick={closeModal}
                    whileHover={{ scale:1.1,rotate:90 }}
                    whileTap={{ scale:0.88 }}
                    transition={springFast}
                    style={{width:44,height:44,borderRadius:14,border:`1px solid ${K.border}`,background:K.card2,color:K.sub,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                  >✕</motion.button>
                </div>

                {/* Category scroll */}
                {!editId && (
                  <div style={{padding:"12px 18px 0",overflowX:"auto",display:"flex",gap:10,WebkitOverflowScrolling:"touch",flexShrink:0}}>
                    {CATS.map(c=>(
                      <motion.button
                        key={c.id}
                        onClick={()=>setSelCat(c)}
                        whileHover={{ scale:1.06,y:-2 }}
                        whileTap={{ scale:0.88 }}
                        animate={c.id===selCat.id ? { scale:[1,1.12,1],transition:{duration:0.25} } : { scale:1 }}
                        style={{
                          flexShrink:0,display:"flex",flexDirection:"column",
                          alignItems:"center",gap:5,padding:"12px 14px",
                          borderRadius:18,
                          border:`2px solid ${c.id===selCat.id?c.color:K.border}`,
                          background:c.id===selCat.id ? `${c.color}20` : K.card2,
                          cursor:"pointer",
                        }}
                      >
                        <span style={{fontSize:26}}>{c.icon}</span>
                        <span style={{fontSize:10,fontWeight:700,color:c.id===selCat.id?c.color:K.sub,whiteSpace:"nowrap"}}>{c.name}</span>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Fields */}
                <div style={{flex:1,overflowY:"auto",padding:"18px 22px 28px",WebkitOverflowScrolling:"touch"}}>
                  {[
                    {label:"EXPENSE NAME",      key:"name",   type:"text",   ph:`e.g. ${selCat.id==="food"?"Lunch":"Description"}`},
                    {label:`AMOUNT (${currency})`, key:"amount", type:"number", ph:"0.00"},
                    {label:"DATE",               key:"date",   type:"date",   ph:""},
                    {label:"NOTES",              key:"notes",  type:"text",   ph:"Optional details…"},
                  ].map((f,fi)=>(
                    <motion.div
                      key={f.key}
                      initial={{ opacity:0,y:14 }}
                      animate={{ opacity:1,y:0 }}
                      transition={{ delay:fi*0.06,type:"spring",stiffness:340,damping:26 }}
                      style={{marginBottom:18}}
                    >
                      <div style={{fontSize:11,fontWeight:800,color:K.sub,letterSpacing:1,marginBottom:8}}>{f.label}</div>
                      <input
                        type={f.type}
                        value={form[f.key]}
                        placeholder={f.ph}
                        onFocus={()=>setFocusedInput(f.key)}
                        onBlur={()=>setFocusedInput(null)}
                        onChange={e=>setForm({...form,[f.key]:f.key==="name"?capitalizeFirst(e.target.value):e.target.value})}
                        style={{
                          width:"100%",padding:"16px 18px",
                          borderRadius:16,
                          border:`1.5px solid ${focusedInput===f.key?selCat.color:K.border}`,
                          background:K.card2,color:K.text,
                          fontSize:16,boxSizing:"border-box",
                          outline:"none",fontFamily:"inherit",fontWeight:500,
                          transition:"border-color 0.2s",
                          boxShadow:focusedInput===f.key?`0 0 0 4px ${selCat.color}18`:"none",
                        }}
                      />
                    </motion.div>
                  ))}

                  <RippleButton
                    onClick={saveExp}
                    disabled={saving}
                    whileHover={saving?{}:{scale:1.02,y:-1}}
                    whileTap={saving?{}:{scale:0.97}}
                    style={{
                      width:"100%",padding:"18px",
                      borderRadius:18,border:"none",
                      background:saving?"#888":`linear-gradient(135deg,${selCat.color},${selCat.color}dd)`,
                      color:"#FFF",fontSize:17,fontWeight:800,
                      cursor:saving?"default":"pointer",
                      marginTop:4,
                      boxShadow:saving?"none":`0 8px 28px ${selCat.color}45`,
                      transition:"background 0.2s",
                    }}
                  >
                    {saving ? "Saving…" : (editId ? "Update Expense ✓" : "Save Expense ✓")}
                  </RippleButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── DELETE CONFIRM ────────────────────────────── */}
        <AnimatePresence>
          {delId && (
            <motion.div
              key="delete-confirm"
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              style={{position:"absolute",inset:0,background:"rgba(0,0,0,.78)",zIndex:400,display:"flex",alignItems:"flex-end"}}
            >
              <motion.div
                initial={{ y:100,opacity:0 }}
                animate={{ y:0,opacity:1 }}
                exit={{ y:100,opacity:0 }}
                transition={{ type:"spring",stiffness:340,damping:30 }}
                style={{
                  width:"100%",background:K.card,
                  borderRadius:"32px 32px 0 0",
                  padding:"28px 22px 48px",
                  boxShadow:"0 -16px 60px rgba(0,0,0,.6)",
                  border:`1px solid ${K.border}`,
                  borderBottom:"none",
                }}
              >
                <div style={{textAlign:"center",marginBottom:28}}>
                  <motion.div
                    animate={{ rotate:[0,-14,14,-8,8,0] }}
                    transition={{ delay:0.18,duration:0.5 }}
                    style={{fontSize:60,marginBottom:14}}
                  >🗑️</motion.div>
                  <div style={{fontSize:22,fontWeight:900,color:K.text}}>Delete this expense?</div>
                  <div style={{fontSize:15,color:K.sub,marginTop:8}}>This action cannot be undone.</div>
                </div>
                <div style={{display:"flex",gap:12}}>
                  <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.96}} onClick={()=>setDelId(null)} style={{flex:1,padding:"18px",borderRadius:18,border:`1.5px solid ${K.border}`,background:K.card2,color:K.text,fontSize:16,fontWeight:700,cursor:"pointer"}}>Cancel</motion.button>
                  <RippleButton onClick={()=>delExp(delId)} whileHover={{scale:1.02}} whileTap={{scale:0.96}} style={{flex:1,padding:"18px",borderRadius:18,border:"none",background:K.red,color:"#FFF",fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:`0 6px 24px ${K.red}50`}}>Delete</RippleButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PERIOD DETAIL DRAWER ──────────────────────── */}
        <BottomSheet show={!!drawer} onClose={()=>setDrawer(null)} title={drawer?.title} sub={drawer?.sub}>
          {drawer && (drawer.exps.length===0 ? (
            <div style={{textAlign:"center",padding:"60px 0",color:K.sub,fontSize:16}}>No expenses for this period</div>
          ) : Object.entries(drawerGrouped).map(([date,exps])=>(
            <div key={date}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"12px 20px 8px",background:K.card2,borderBottom:`1px solid ${K.border}`}}>
                <span style={{fontSize:13,fontWeight:700,color:K.sub}}>{new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
                <span style={{fontSize:13,fontWeight:800,color:K.amber}}>{moneyFull(total(exps))}</span>
              </div>
              {exps.map((ex,i)=><ExpRow key={ex.id} ex={ex} index={i}
                onEdit={()=>{setDrawer(null);setTimeout(()=>openEdit(ex),250);}}
                onDel={()=>setDelId(ex.id)}/>)}
            </div>
          )))}
        </BottomSheet>

        {/* ── TOAST ─────────────────────────────────────── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key="toast"
              initial={{ opacity:0,y:-30,scale:0.8 }}
              animate={{ opacity:1,y:0,scale:1 }}
              exit={{ opacity:0,y:-20,scale:0.88 }}
              transition={{ type:"spring",stiffness:420,damping:26 }}
              style={{
                position:"absolute",top:88,left:"50%",
                transform:"translateX(-50%)",
                background:toast.bad
                  ? `linear-gradient(135deg,${K.red}ee,${K.red}cc)`
                  : `linear-gradient(135deg,#166534ee,#14532dcc)`,
                color:"#FFF",padding:"12px 22px",
                borderRadius:30,fontSize:15,fontWeight:700,
                zIndex:600,whiteSpace:"nowrap",
                boxShadow:toast.bad
                  ? `0 12px 40px ${K.red}50`
                  : "0 12px 40px rgba(22,101,52,.5)",
                display:"flex",alignItems:"center",gap:8,
                border:"1px solid rgba(255,255,255,.15)",
                backdropFilter:"blur(8px)",
              }}
            >
              {toast.icon && <span style={{fontSize:18}}>{toast.icon}</span>}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { margin:0; overscroll-behavior:none; touch-action:pan-y; }
        input,button,select,textarea { font-family:inherit; }
        input[type=text], input[type=number], input[type=date] { font-size:max(16px,1em) !important; }
        input[type=date]::-webkit-calendar-picker-indicator { filter:${dark?"invert(1)":"none"}; opacity:.7; cursor:pointer; }
        ::-webkit-scrollbar { display:none; }
        @keyframes blobMove {
          0% { transform: translate(0,0) scale(1); }
          50% { transform: translate(14px,-20px) scale(1.08); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes blobMoveAlt {
          0% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-22px,18px) scale(1.06); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes rippleAnim {
          to { transform: translate(-50%,-50%) scale(60); opacity: 0; }
        }
        @keyframes floatIn {
          from { opacity:0; transform: translateY(8px) scale(0.96); }
          to { opacity:1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
