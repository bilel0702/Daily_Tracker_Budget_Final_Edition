import { useState, useEffect, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
  { id:"parent_fee", name:"Parent Fee",  icon:"👨‍👩‍👦",  color:"#84CC16" },
  { id:"unexpected", name:"Unexpected",  icon:"⚡",  color:"#EF4444" },
  { id:"financial",  name:"Financial",   icon:"💰",  color:"#F59E0B" },
  { id:"trip_fee",   name:"Trip",        icon:"✈️",  color:"#3B82F6" },
  { id:"study_fee",  name:"Study",       icon:"📚",  color:"#8B5CF6" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const today  = () => new Date().toISOString().split("T")[0];
const mKey   = d  => d.toISOString().slice(0,7);
const yKey   = d  => String(d.getFullYear());
const getCat = id => CATS.find(c=>c.id===id) || CATS[0];
const total  = arr=> arr.reduce((s,e)=>s+e.amount, 0);

// money / moneyFull are redefined inside App() as currency-aware versions

async function sheetsSync(url, action, payload) {
  if (!url) return { success: false, message: "No script URL provided" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) {
      return { success: false, message: `Network error ${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    return {
      success: data.success !== false,
      message: data.message || data.error || "",
    };
  } catch (e) {
    return { success: false, message: e.message || "Sync failed" };
  }
}

// ─────────────────────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [expenses,   setExpenses]   = useState([]);
  const [currency,   setCurrency]   = useState("DA");
  const [page,       setPage]       = useState("home");
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

  // ── Persist ──────────────────────────────────────────────
  useEffect(()=>{
    try {
      const r=localStorage.getItem("exp_v4"); if(r) setExpenses(JSON.parse(r));
      const c=localStorage.getItem("exp_cfg4"); if(c){const p=JSON.parse(c);setDark(p.dark??true);setCurrency(p.currency??"DA");}
      const u=localStorage.getItem("exp_gsurl"); if(u){setScriptUrl(u);setUrlDraft(u);setGsOn(true);}
    } catch{}
    setLoading(false);
  },[]);

  const persist = useCallback(data=>{
    try{localStorage.setItem("exp_v4",JSON.stringify(data));}catch{}
  },[]);

  const capitalizeFirst = str => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const sym = currency === "DA" ? "DA" : currency === "USD" ? "$" : "€";
  const money = n => {
    if (currency === "DA") return n >= 1000 ? `DA ${(n/1000).toFixed(1)}k` : `DA ${n.toFixed(2)}`;
    if (n >= 1000) return sym + (n/1000).toFixed(1) + "k";
    return sym + n.toFixed(2);
  };
  const moneyFull = n => {
    if (currency === "DA") return `DA ${new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0)}`;
    if (currency === "USD") return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
    return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n||0);
  };

  const toast$ = useCallback((msg,bad=false)=>{
    setToast({msg,bad}); setTimeout(()=>setToast(null),2600);
  },[]);

  // ── CRUD ─────────────────────────────────────────────────
  const saveExp = async () => {
    if (saving) return; // prevent re-entrancy
    if (!form.name.trim() || !form.amount || isNaN(+form.amount)) return;
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
        if (!sync.success) toast$("Saved locally. Sheets sync failed.", true);
        else toast$("Updated ✓");
      } else {
        toast$("Updated ✓");
      }
    } else {
      const ex = { id:Date.now().toString(), name:form.name.trim(),
        amount:+form.amount, notes:form.notes.trim(), date:form.date,
        category:selCat.id, currency, ts:new Date().toISOString(),
        day:d.getDate(), month:d.getMonth()+1, year:d.getFullYear() };
      next = [ex,...expenses];
      if (gsOn) {
        const sync = await sheetsSync(scriptUrl, "add", { expense: ex });
        if (!sync.success) toast$("Saved locally. Sheets sync failed.", true);
        else toast$("Saved ✓");
      } else {
        toast$("Saved ✓");
      }
    }
      setExpenses(next); persist(next); closeModal();
    } finally {
      setSaving(false);
    }
  };

  const delExp = id => {
    const next = expenses.filter(e=>e.id!==id);
    setExpenses(next); persist(next); setDelId(null);
    if (gsOn) sheetsSync(scriptUrl,"delete",{id});
    toast$("Deleted",true);
  };

  const closeModal = () => {
    setModal(false); setSelCat(null); setEditId(null);
    setForm({name:"",amount:"",notes:"",date:today()});
  };
  const openAdd  = (cat,date) => { setSelCat(cat); setForm({name:"",amount:"",notes:"",date:date||today()}); setModal(true); };
  const openEdit = ex => { setSelCat(getCat(ex.category)); setForm({name:ex.name,amount:String(ex.amount),notes:ex.notes||"",date:ex.date}); setEditId(ex.id); setModal(true); };

  const restoreSheets = async () => {
    if (!scriptUrl) return; setGsBusy(true);
    try {
      const r = await fetch(scriptUrl+"?v="+Date.now());
      const d = await r.json();
      if (d.expenses) { setExpenses(d.expenses); persist(d.expenses); toast$(`Restored ${d.expenses.length} ✓`); }
    } catch { toast$("Restore failed",true); }
    setGsBusy(false);
  };

  const connectGs = async () => {
    if (!urlDraft.trim()) return;
    const candidate = urlDraft.trim();
    if (!candidate.startsWith("https://")) {
      toast$("Enter a valid Apps Script URL", true);
      return;
    }
    setGsBusy(true);
    try {
      const res = await fetch(`${candidate}?v=${Date.now()}`);
      if (!res.ok) throw new Error(`Network error ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.expenses)) throw new Error(data?.error || "Invalid script URL");
      localStorage.setItem("exp_gsurl", candidate);
      setScriptUrl(candidate); setGsOn(true);
      toast$("Connected ✓");
    } catch (err) {
      toast$("Connect failed", true);
    }
    setGsBusy(false);
  };
  const disconnectGs = () => {
    localStorage.removeItem("exp_gsurl");
    setScriptUrl(""); setGsOn(false); toast$("Disconnected");
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
  const K = {
    bg:      dark ? "#07090F" : "#F0F2F8",
    card:    dark ? "#0F1520" : "#FFFFFF",
    card2:   dark ? "#18202E" : "#F5F7FC",
    border:  dark ? "#1E2A3E" : "#DDE3F0",
    text:    dark ? "#EEF2FF" : "#0C1020",
    sub:     dark ? "#6B7A99" : "#6B7A99",
    accent:  "#6366F1",
    amber:   "#F59E0B",
    green:   "#22C55E",
    red:     "#EF4444",
  };

  // ── Shared components ─────────────────────────────────────

  // Big expense row — designed for fat fingers
  const ExpRow = ({ex, onEdit, onDel}) => {
    const cat = getCat(ex.category);
    return (
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"18px 20px",borderBottom:`1px solid ${K.border}`}}>
        {/* Big icon bubble */}
        <div style={{
          width:60, height:60, borderRadius:20,
          background:cat.color+"25",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:32, flexShrink:0,
        }}>{cat.icon}</div>

        {/* Info */}
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:17,fontWeight:700,color:K.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ex.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
            <span style={{background:cat.color+"20",color:cat.color,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700}}>
              {cat.name}
            </span>
            <span style={{fontSize:13,color:K.sub}}>{ex.date}</span>
          </div>
          {ex.notes && <div style={{fontSize:13,color:K.sub,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ex.notes}</div>}
        </div>

        {/* Amount + actions stacked */}
        <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
          <div style={{fontSize:19,fontWeight:900,color:cat.color}}>{moneyFull(ex.amount)}</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onEdit} style={{
              width:44, height:44, borderRadius:14,
              border:"none", background:K.accent+"22", color:K.accent,
              cursor:"pointer", fontSize:20, display:"flex",
              alignItems:"center", justifyContent:"center",
            }}>✏️</button>
            <button onClick={onDel} style={{
              width:44, height:44, borderRadius:14,
              border:"none", background:K.red+"22", color:K.red,
              cursor:"pointer", fontSize:20, display:"flex",
              alignItems:"center", justifyContent:"center",
            }}>🗑️</button>
          </div>
        </div>
      </div>
    );
  };

  // Section header
  const SecLabel = ({children, right}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"22px 20px 12px"}}>
      <span style={{fontSize:13,fontWeight:800,color:K.sub,letterSpacing:1.2}}>{children}</span>
      {right && <span style={{fontSize:14,fontWeight:900,color:K.accent}}>{right}</span>}
    </div>
  );

  // White card wrapper
  const Card = ({children, style={}}) => (
    <div style={{background:K.card,border:`1px solid ${K.border}`,borderRadius:24,...style}}>
      {children}
    </div>
  );

  // Bottom sheet drawer
  const BottomSheet = ({show, onClose, title, sub, children}) => {
    if (!show) return null;
    return (
      <div style={{position:"absolute",inset:0,zIndex:300,display:"flex",flexDirection:"column"}}>
        <div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)"}}/>
        <div style={{
          background:K.card, borderRadius:"32px 32px 0 0",
          maxHeight:"88vh", display:"flex", flexDirection:"column",
          overflow:"hidden", boxShadow:"0 -12px 60px rgba(0,0,0,.6)",
        }}>
          {/* Pill handle */}
          <div style={{display:"flex",justifyContent:"center",padding:"16px 0 8px",flexShrink:0}}>
            <div style={{width:48,height:5,borderRadius:3,background:K.border}}/>
          </div>
          {/* Header */}
          {title && (
            <div style={{padding:"4px 24px 20px",borderBottom:`1px solid ${K.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:22,fontWeight:900,color:K.text}}>{title}</div>
                {sub && <div style={{fontSize:14,color:K.sub,marginTop:4}}>{sub}</div>}
              </div>
              <button onClick={onClose} style={{
                width:48, height:48, borderRadius:16,
                border:`1px solid ${K.border}`, background:K.card2,
                color:K.sub, cursor:"pointer", fontSize:22,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>✕</button>
            </div>
          )}
          <div style={{overflowY:"auto",WebkitOverflowScrolling:"touch",flex:1}}>
            {children}
            <div style={{height:40}}/>
          </div>
        </div>
      </div>
    );
  };

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

    return (
      <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:110}}>

        {/* ── Hero Banner ─────────────────────────── */}
        <div style={{
          margin:"16px 16px 0",
          background:"linear-gradient(145deg,#6366F1 0%,#7C3AED 100%)",
          borderRadius:30, padding:"30px 26px 26px",
          position:"relative", overflow:"hidden",
        }}>
          {/* Decorative circles */}
          <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:80,background:"rgba(255,255,255,.06)"}}/>
          <div style={{position:"absolute",bottom:-30,left:-20,width:120,height:120,borderRadius:60,background:"rgba(255,255,255,.04)"}}/>

          {gsOn && (
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
              <div style={{width:8,height:8,borderRadius:4,background:"#22C55E"}}/>
              <span style={{fontSize:12,color:"rgba(255,255,255,.65)",fontWeight:600}}>Synced with Google Sheets</span>
            </div>
          )}
          <div style={{fontSize:15,color:"rgba(255,255,255,.7)",marginBottom:10,fontWeight:600}}>Total This Month</div>
          <div style={{fontSize:48,fontWeight:900,color:"#FFF",letterSpacing:-1,lineHeight:1}}>{money(total(monthExp))}</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.55)",marginTop:8}}>{monthExp.length} transactions</div>

          <div style={{display:"flex",gap:12,marginTop:24}}>
            {[{l:"Today",v:todayExp},{l:"Year",v:yearExp}].map(({l,v})=>(
              <div key={l} style={{flex:1,background:"rgba(255,255,255,.13)",borderRadius:20,padding:"16px 18px"}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginBottom:8,fontWeight:600}}>{l}</div>
                <div style={{fontSize:22,fontWeight:900,color:"#FFF"}}>{money(total(v))}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.45)",marginTop:4}}>{v.length} items</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Period tap-cards ────────────────────── */}
        <SecLabel>TAP TO SEE EXPENSES</SecLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,padding:"0 16px"}}>
          {periods.map(p=>(
            <button key={p.label}
              onClick={()=>setDrawer({title:p.label, sub:`${p.exps.length} transactions · ${moneyFull(total(p.exps))}`, exps:p.exps})}
              style={{
                background:K.card, border:`1.5px solid ${K.border}`,
                borderRadius:24, padding:"22px 18px",
                textAlign:"left", cursor:"pointer",
              }}>
              <div style={{fontSize:40,marginBottom:14}}>{p.icon}</div>
              <div style={{fontSize:12,fontWeight:800,color:p.color,letterSpacing:.8,marginBottom:8}}>{p.label.toUpperCase()}</div>
              <div style={{fontSize:26,fontWeight:900,color:K.text,lineHeight:1}}>{money(total(p.exps))}</div>
              <div style={{fontSize:13,color:K.sub,marginTop:8}}>{p.exps.length} transactions</div>
            </button>
          ))}
        </div>

        {/* ── Quick add grid ──────────────────────── */}
        <SecLabel>QUICK ADD</SecLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,padding:"0 16px"}}>
          {CATS.map(cat=>(
            <button key={cat.id} onClick={()=>openAdd(cat)}
              style={{
                background:K.card, border:`1.5px solid ${K.border}`,
                borderRadius:22, padding:"20px 6px 16px",
                textAlign:"center", cursor:"pointer",
                display:"flex", flexDirection:"column",
                alignItems:"center", gap:10,
              }}>
              <div style={{fontSize:38}}>{cat.icon}</div>
              <div style={{fontSize:11,fontWeight:700,color:K.sub,lineHeight:1.3,textAlign:"center"}}>{cat.name}</div>
            </button>
          ))}
        </div>

        {/* ── Recent ──────────────────────────────── */}
        {expenses.length > 0 && <>
          <SecLabel right={`${expenses.length} total`}>RECENT</SecLabel>
          <Card style={{margin:"0 16px",overflow:"hidden"}}>
            {expenses.slice(0,5).map(ex=>(
              <ExpRow key={ex.id} ex={ex} onEdit={()=>openEdit(ex)} onDel={()=>setDelId(ex.id)}/>
            ))}
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

    const grouped = {};
    [...shown].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(ex=>{
      if (!grouped[ex.date]) grouped[ex.date]=[];
      grouped[ex.date].push(ex);
    });

    return (
      <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:110}}>

        {/* View switcher — big pill tabs */}
        <div style={{padding:"16px 16px 12px"}}>
          <div style={{display:"flex",background:K.card2,borderRadius:22,padding:6,gap:4,border:`1px solid ${K.border}`}}>
            {[["day","📅 Day"],["month","🗓️ Month"],["year","📊 Year"]].map(([v,l])=>(
              <button key={v} onClick={()=>setCalView(v)} style={{
                flex:1, padding:"15px 0", borderRadius:16, border:"none",
                background:calView===v ? K.accent : "transparent",
                color:calView===v ? "#FFF" : K.sub,
                cursor:"pointer", fontSize:15, fontWeight:800,
                transition:"background .2s",
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Month calendar grid */}
        {calView!=="year" && (
          <Card style={{margin:"0 16px 16px",overflow:"hidden"}}>
            {/* Nav row */}
            <div style={{padding:"20px 20px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <button onClick={prevM} style={{width:52,height:52,borderRadius:18,border:`1px solid ${K.border}`,background:K.card2,color:K.text,cursor:"pointer",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:K.text}}>{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</div>
                <div style={{fontSize:15,color:K.amber,fontWeight:700,marginTop:4}}>{moneyFull(total(monExps))}</div>
              </div>
              <button onClick={nextM} style={{width:52,height:52,borderRadius:18,border:`1px solid ${K.border}`,background:K.card2,color:K.text,cursor:"pointer",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>

            {/* Day header row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 14px 10px"}}>
              {DAYS.map(d=>(
                <div key={d} style={{textAlign:"center",fontSize:13,fontWeight:800,color:K.sub,padding:"4px 0"}}>{d}</div>
              ))}
            </div>

            {/* Day cells — large enough to tap */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px 18px",gap:4}}>
              {calGrid.map((cell,i)=>{
                if (!cell) return <div key={`e${i}`}/>;
                const isTod = cell.ds===today();
                const isSel = cell.ds===calDay;
                const has   = cell.tot > 0;
                return (
                  <button key={cell.ds}
                    onClick={()=>{setCalDay(cell.ds);setCalView("day");}}
                    style={{
                      aspectRatio:"1", borderRadius:14, border:"none",
                      background: isSel ? K.accent : isTod ? K.accent+"35" : has ? K.card2 : "transparent",
                      outline: isTod&&!isSel ? `2px solid ${K.accent}` : "none",
                      outlineOffset:"-2px",
                      cursor:"pointer",
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center", gap:2, padding:3,
                    }}>
                    <div style={{fontSize:16,fontWeight:isTod||isSel?900:500,color:isSel?"#FFF":K.text,lineHeight:1}}>{cell.day}</div>
                    {has && <div style={{fontSize:9,color:isSel?"rgba(255,255,255,.8)":K.amber,fontWeight:700,lineHeight:1}}>${cell.tot.toFixed(0)}</div>}
                    {has && !isSel && <div style={{width:5,height:5,borderRadius:3,background:K.accent}}/>}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Year view */}
        {calView==="year" && (
          <Card style={{margin:"0 16px 16px",padding:"20px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <button onClick={prevY} style={{width:52,height:52,borderRadius:18,border:`1px solid ${K.border}`,background:K.card2,color:K.text,cursor:"pointer",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:900,color:K.text}}>{calDate.getFullYear()}</div>
                <div style={{fontSize:15,color:K.amber,fontWeight:700,marginTop:4}}>Total: {moneyFull(total(yrExps))}</div>
              </div>
              <button onClick={nextY} style={{width:52,height:52,borderRadius:18,border:`1px solid ${K.border}`,background:K.card2,color:K.text,cursor:"pointer",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {yrBreak.map(({month,key,tot,count})=>{
                const isCur = key===mKey(new Date());
                return (
                  <button key={key}
                    onClick={()=>{const d=new Date(calDate);d.setMonth(MONTHS.indexOf(month));setCalDate(d);setCalView("month");}}
                    style={{
                      background:isCur?K.accent+"22":K.card2,
                      border:`2px solid ${isCur?K.accent:K.border}`,
                      borderRadius:20, padding:"18px 12px",
                      cursor:"pointer", textAlign:"left",
                    }}>
                    <div style={{fontSize:15,fontWeight:800,color:isCur?K.accent:K.text}}>{month}</div>
                    <div style={{fontSize:17,fontWeight:900,color:tot>0?K.amber:K.sub,marginTop:8}}>{tot>0?money(tot):"—"}</div>
                    <div style={{fontSize:12,color:K.sub,marginTop:4}}>{count} items</div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Jump to date */}
        <div style={{background:K.card,border:`1px solid ${K.border}`,borderRadius:22,margin:"0 16px 16px",padding:"18px 20px",display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:52,height:52,borderRadius:18,background:K.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0}}>🗓️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:800,color:K.sub,letterSpacing:.8,marginBottom:8}}>JUMP TO ANY DATE</div>
            <input type="date" defaultValue={today()}
              onChange={e=>{if(e.target.value){setCalDay(e.target.value);setCalDate(new Date(e.target.value+"T12:00:00"));setCalView("day");}}}
              style={{fontSize:16,color:K.text,background:"transparent",border:"none",outline:"none",width:"100%",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}/>
          </div>
        </div>

        {/* Period total bar */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 20px 14px"}}>
          <div style={{fontSize:13,fontWeight:800,color:K.sub,letterSpacing:.8}}>
            {calView==="day" ? calDay : calView==="month" ? `${MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}` : calDate.getFullYear()}
          </div>
          <div style={{fontSize:18,fontWeight:900,color:K.accent}}>{moneyFull(total(shown))}</div>
        </div>

        {/* Expense list */}
        {shown.length===0 ? (
          <Card style={{margin:"0 16px",padding:"52px 20px",textAlign:"center"}}>
            <div style={{fontSize:60,marginBottom:16}}>📭</div>
            <div style={{fontSize:18,fontWeight:700,color:K.sub,marginBottom:20}}>No expenses here</div>
            <button onClick={()=>openAdd(CATS[0], calView==="day"?calDay:today())}
              style={{padding:"16px 32px",borderRadius:18,border:"none",background:K.accent,color:"#FFF",cursor:"pointer",fontSize:16,fontWeight:800}}>
              + Add Expense
            </button>
          </Card>
        ) : (
          <Card style={{margin:"0 16px",overflow:"hidden"}}>
            {Object.entries(grouped).map(([date,exps])=>(
              <div key={date}>
                {calView!=="day" && (
                  <div style={{display:"flex",justifyContent:"space-between",padding:"14px 20px 10px",background:K.card2,borderBottom:`1px solid ${K.border}`}}>
                    <span style={{fontSize:14,fontWeight:800,color:K.sub}}>
                      {new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                    </span>
                    <span style={{fontSize:14,fontWeight:900,color:K.amber}}>{moneyFull(total(exps))}</span>
                  </div>
                )}
                {exps.map(ex=><ExpRow key={ex.id} ex={ex} onEdit={()=>openEdit(ex)} onDel={()=>setDelId(ex.id)}/>)}
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  //  PAGE: HISTORY / SEARCH
  // ════════════════════════════════════════════════════════
  const PageHistory = () => (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Big search bar */}
      <div style={{padding:"16px 16px 12px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",background:K.card,border:`1.5px solid ${K.border}`,borderRadius:20,padding:"0 20px",gap:14}}>
          <span style={{fontSize:26,color:K.sub}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search expenses…"
            style={{flex:1,padding:"18px 0",background:"transparent",border:"none",outline:"none",color:K.text,fontSize:17,fontFamily:"inherit"}}/>
          {search && <button onClick={()=>setSearch("")} style={{background:"none",border:"none",color:K.sub,cursor:"pointer",fontSize:22,padding:0}}>✕</button>}
        </div>
      </div>

      {/* Category filter — large chips */}
      <div style={{padding:"0 16px 14px",overflowX:"auto",display:"flex",gap:10,WebkitOverflowScrolling:"touch",flexShrink:0}}>
        {[{id:"all",name:"All",icon:"🗂️",color:K.accent},...CATS].map(c=>{
          const active = filterCat===c.id;
          const col    = c.id==="all" ? K.accent : (getCat(c.id)?.color||K.accent);
          return (
            <button key={c.id} onClick={()=>setFilterCat(c.id)} style={{
              flexShrink:0, padding:"12px 18px", borderRadius:26,
              border:`1.5px solid ${active?col:K.border}`,
              background:active ? col+"25" : K.card,
              color:active ? col : K.sub,
              cursor:"pointer", fontSize:14, fontWeight:700,
              whiteSpace:"nowrap", display:"flex", gap:8, alignItems:"center",
            }}>
              <span style={{fontSize:20}}>{c.icon}</span>{c.name}
            </button>
          );
        })}
      </div>

      {/* Count + total */}
      <div style={{padding:"0 20px 12px",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,color:K.sub,fontWeight:600}}>{filtered.length} result{filtered.length!==1?"s":""}</span>
        <span style={{fontSize:17,fontWeight:900,color:K.accent}}>{moneyFull(total(filtered))}</span>
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:110}}>
        {filtered.length===0 ? (
          <div style={{textAlign:"center",padding:"80px 20px",color:K.sub,fontSize:17}}>No expenses found</div>
        ) : (
          <Card style={{margin:"0 16px",overflow:"hidden"}}>
            {filtered.map(ex=><ExpRow key={ex.id} ex={ex} onEdit={()=>openEdit(ex)} onDel={()=>setDelId(ex.id)}/>)}
          </Card>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  PAGE: REPORTS
  // ════════════════════════════════════════════════════════
  const PageReports = () => (
    <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:110}}>
      <SecLabel>OVERVIEW</SecLabel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,padding:"0 16px"}}>
        {[
          {l:"This Month",v:total(monthExp),icon:"🗓️",c:"#6366F1"},
          {l:"This Year", v:total(yearExp), icon:"📊",c:"#22C55E"},
          {l:"Today",     v:total(todayExp),icon:"📅",c:"#F59E0B"},
          {l:"Top Cat",   v:catTotals[0]?.total||0,icon:catTotals[0]?.icon||"🏆",c:"#EF4444",sub:catTotals[0]?.name},
        ].map((s,i)=>(
          <Card key={i} style={{padding:"22px 18px"}}>
            <div style={{fontSize:40,marginBottom:14}}>{s.icon}</div>
            <div style={{fontSize:12,fontWeight:800,color:K.sub,letterSpacing:.8}}>{s.l.toUpperCase()}</div>
            <div style={{fontSize:24,fontWeight:900,color:s.c,marginTop:6,lineHeight:1}}>{money(s.v)}</div>
            {s.sub && <div style={{fontSize:12,color:K.sub,marginTop:6}}>{s.sub}</div>}
          </Card>
        ))}
      </div>

      <SecLabel>6-MONTH TREND</SecLabel>
      <Card style={{margin:"0 16px",padding:"20px 16px 12px"}}>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={monthlyBar} margin={{top:0,right:0,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={K.border} vertical={false}/>
            <XAxis dataKey="month" tick={{fill:K.sub,fontSize:13}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:K.sub,fontSize:11}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:K.card,border:`1px solid ${K.border}`,color:K.text,borderRadius:14,fontSize:14}} formatter={v=>[moneyFull(v),"Total"]}/>
            <Bar dataKey="v" fill={K.accent} radius={[8,8,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {pieData.length>0 && <>
        <SecLabel>BY CATEGORY</SecLabel>
        <Card style={{margin:"0 16px",padding:"20px 16px 8px"}}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} innerRadius={46} dataKey="total" nameKey="name">
                {pieData.map(c=><Cell key={c.id} fill={c.color}/>)}
              </Pie>
              <Tooltip formatter={v=>moneyFull(v)} contentStyle={{background:K.card,border:`1px solid ${K.border}`,color:K.text,borderRadius:14,fontSize:14}}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </>}

      <SecLabel>ALL CATEGORIES</SecLabel>
      <Card style={{margin:"0 16px",padding:"4px 20px 8px"}}>
        {catTotals.filter(c=>c.total>0).map(c=>{
          const pct = catTotals[0].total>0 ? (c.total/catTotals[0].total)*100 : 0;
          return (
            <div key={c.id} style={{padding:"16px 0",borderBottom:`1px solid ${K.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <span style={{fontSize:30}}>{c.icon}</span>
                  <div>
                    <div style={{fontSize:16,fontWeight:700,color:K.text}}>{c.name}</div>
                    <div style={{fontSize:12,color:K.sub,marginTop:3}}>{expenses.filter(e=>e.category===c.id).length} transactions</div>
                  </div>
                </div>
                <span style={{fontSize:18,fontWeight:900,color:c.color}}>{money(c.total)}</span>
              </div>
              <div style={{height:10,background:K.card2,borderRadius:5,overflow:"hidden"}}>
                <div style={{width:`${pct}%`,height:"100%",background:c.color,borderRadius:5,transition:"width .5s"}}/>
              </div>
            </div>
          );
        })}
        {catTotals.every(c=>c.total===0) && <div style={{padding:"40px 0",textAlign:"center",color:K.sub,fontSize:16}}>No data yet</div>}
      </Card>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  PAGE: SETTINGS
  // ════════════════════════════════════════════════════════
  const PageSettings = () => (
    <div style={{overflowY:"auto",height:"100%",WebkitOverflowScrolling:"touch",paddingBottom:110}}>

      {/* Google Sheets */}
      <SecLabel>GOOGLE SHEETS SYNC</SecLabel>
      <Card style={{margin:"0 16px",overflow:"hidden"}}>
        {gsOn ? (
          <>
            <div style={{padding:"22px 22px",display:"flex",alignItems:"center",gap:18,borderBottom:`1px solid ${K.border}`,background:K.green+"0E"}}>
              <div style={{width:60,height:60,borderRadius:20,background:K.green+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0}}>✅</div>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:800,color:K.green}}>Connected</div>
                <div style={{fontSize:12,color:K.sub,marginTop:4,wordBreak:"break-all",lineHeight:1.5}}>{scriptUrl.slice(0,55)}…</div>
              </div>
            </div>
            <div style={{padding:"18px 22px",display:"flex",gap:12}}>
              <button onClick={restoreSheets} disabled={gsBusy} style={{flex:1,padding:"16px",borderRadius:18,border:`1.5px solid ${K.accent}`,background:K.accent+"22",color:K.accent,cursor:"pointer",fontSize:15,fontWeight:800}}>
                {gsBusy?"Syncing…":"⬇️ Restore from Sheets"}
              </button>
              <button onClick={disconnectGs} style={{flex:1,padding:"16px",borderRadius:18,border:`1.5px solid ${K.red}`,background:K.red+"22",color:K.red,cursor:"pointer",fontSize:15,fontWeight:800}}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <div style={{padding:"22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:20}}>
              <div style={{width:60,height:60,borderRadius:20,background:K.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0}}>📊</div>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:K.text}}>Connect Google Sheets</div>
                <div style={{fontSize:13,color:K.sub,marginTop:4}}>Auto-sync every expense</div>
              </div>
            </div>
            <div style={{fontSize:12,fontWeight:800,color:K.sub,letterSpacing:.8,marginBottom:10}}>APPS SCRIPT URL</div>
            <input value={urlDraft} onChange={e=>setUrlDraft(e.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              style={{width:"100%",padding:"18px",borderRadius:18,border:`1.5px solid ${K.border}`,background:K.card2,color:K.text,fontSize:15,boxSizing:"border-box",outline:"none",fontFamily:"inherit",marginBottom:16}}/>
            <button onClick={connectGs} style={{width:"100%",padding:"18px",borderRadius:18,border:"none",background:K.accent,color:"#FFF",cursor:"pointer",fontSize:17,fontWeight:900}}>
              🔗 Connect
            </button>
          </div>
        )}
      </Card>

      {/* Preferences */}
      <SecLabel>PREFERENCES</SecLabel>
      <Card style={{margin:"0 16px",overflow:"hidden"}}>
        {/* Dark mode */}
        <div style={{padding:"22px",borderBottom:`1px solid ${K.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div style={{width:60,height:60,borderRadius:20,background:K.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>{dark?"🌙":"☀️"}</div>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:K.text}}>Dark Mode</div>
              <div style={{fontSize:13,color:K.sub,marginTop:3}}>Toggle app theme</div>
            </div>
          </div>
          <button
            onClick={()=>{const nd=!dark;setDark(nd);try{localStorage.setItem("exp_cfg4",JSON.stringify({dark:nd,currency}));}catch{}}}
            style={{width:62,height:36,borderRadius:18,border:"none",background:dark?K.accent:"#CBD5E1",cursor:"pointer",position:"relative",transition:"background .25s",flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:14,background:"#FFF",position:"absolute",top:4,left:dark?30:4,transition:"left .25s",boxShadow:"0 2px 8px rgba(0,0,0,.25)"}}/>
          </button>
        </div>
        {/* Currency */}
        <div style={{padding:"22px",borderBottom:`1px solid ${K.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div style={{width:60,height:60,borderRadius:20,background:"#F59E0B22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>💱</div>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:K.text}}>Currency</div>
              <div style={{fontSize:13,color:K.sub,marginTop:3}}>All amounts display</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {[{code:"DA",label:"DA"},{code:"USD",label:"$"},{code:"EUR",label:"€"}].map(c=>(
              <button key={c.code}
                onClick={()=>{setCurrency(c.code);try{localStorage.setItem("exp_cfg4",JSON.stringify({dark,currency:c.code}));}catch{}}}
                style={{padding:"10px 18px",borderRadius:14,border:`2px solid ${currency===c.code?K.accent:K.border}`,background:currency===c.code?K.accent+"22":"transparent",color:currency===c.code?K.accent:K.sub,cursor:"pointer",fontSize:15,fontWeight:currency===c.code?800:500,transition:"all .15s"}}>
                {c.label} {c.code}
              </button>
            ))}
          </div>
        </div>
        {/* Export */}
        <div style={{padding:"22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div style={{width:60,height:60,borderRadius:20,background:K.amber+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>📤</div>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:K.text}}>Export CSV</div>
              <div style={{fontSize:13,color:K.sub,marginTop:3}}>Download all data</div>
            </div>
          </div>
          <button
            onClick={()=>{
              const h="ID,Date,Category,Name,Amount,Notes\n";
              const r=expenses.map(e=>[e.id,e.date,getCat(e.category).name,`"${e.name}"`,e.amount,`"${e.notes||""}"`].join(",")).join("\n");
              const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([h+r],{type:"text/csv"}));a.download="expenses.csv";a.click();
              toast$("Exported ✓");
            }}
            style={{padding:"14px 24px",borderRadius:18,border:"none",background:K.amber+"22",color:K.amber,cursor:"pointer",fontSize:15,fontWeight:800}}>
            Export
          </button>
        </div>
      </Card>

      {/* Install hint */}
      <SecLabel>INSTALL AS APP</SecLabel>
      <Card style={{margin:"0 16px",padding:"22px"}}>
        <div style={{display:"flex",gap:18,alignItems:"flex-start"}}>
          <div style={{width:60,height:60,borderRadius:20,background:"#06B6D4"+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0}}>📱</div>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:K.text,marginBottom:10}}>Install on Android</div>
            <div style={{fontSize:14,color:K.sub,lineHeight:1.8}}>
              1. Open in Chrome on Android{"\n"}
              2. Tap the menu ⋮ (3 dots){"\n"}
              3. Tap <b style={{color:K.text}}>"Add to Home screen"</b>{"\n"}
              4. The app opens fullscreen, no browser bar!
            </div>
          </div>
        </div>
      </Card>

      {/* Data summary */}
      <SecLabel>YOUR DATA</SecLabel>
      <Card style={{margin:"0 16px",padding:"4px 22px"}}>
        {[
          {l:"Total expenses",   v:expenses.length+" items"},
          {l:"Total amount",     v:moneyFull(total(expenses))},
          {l:"Categories used",  v:`${catTotals.filter(c=>c.total>0).length} of ${CATS.length}`},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 0",borderBottom:i<2?`1px solid ${K.border}`:"none"}}>
            <span style={{fontSize:16,color:K.sub}}>{r.l}</span>
            <span style={{fontSize:16,fontWeight:800,color:K.text}}>{r.v}</span>
          </div>
        ))}
      </Card>
    </div>
  );

  // ── Nav ───────────────────────────────────────────────────
  const NAV = [
    {id:"home",    icon:"🏠", label:"Home"},
    {id:"calendar",icon:"📅", label:"Calendar"},
    {id:"history", icon:"🔍", label:"Search"},
    {id:"reports", icon:"📈", label:"Reports"},
    {id:"settings",icon:"⚙️", label:"Settings"},
  ];

  const titles = {home:"Expenses Tracker",calendar:"Calendar",history:"History",reports:"Reports",settings:"Settings"};

  const renderPage = () => {
    if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:K.sub,fontSize:20}}>Loading…</div>;
    switch(page) {
      case "home":     return <PageHome/>;
      case "calendar": return <PageCalendar/>;
      case "history":  return <PageHistory/>;
      case "reports":  return <PageReports/>;
      case "settings": return <PageSettings/>;
    }
  };

  // ── Expense drawer (period detail) ────────────────────────
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

      {/* ── Top bar ────────────────────────────────────────── */}
      <div style={{
        background:K.card, borderBottom:`1px solid ${K.border}`,
        padding:"18px 22px 16px",
        paddingTop:"max(18px, env(safe-area-inset-top,18px))",
        flexShrink:0,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div style={{fontSize:21,fontWeight:900,color:K.text,letterSpacing:-.3}}>{titles[page]}</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {gsOn && (
            <div style={{display:"flex",alignItems:"center",gap:6,background:K.green+"18",borderRadius:20,padding:"5px 12px"}}>
              <div style={{width:8,height:8,borderRadius:4,background:K.green}}/>
              <span style={{fontSize:12,fontWeight:700,color:K.green}}>Sheets</span>
            </div>
          )}
          <div style={{fontSize:28}}>💼</div>
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────── */}
      <div style={{flex:1,overflow:"hidden",position:"relative"}}>{renderPage()}</div>

      {/* ── FAB ────────────────────────────────────────────── */}
      {(page==="home"||page==="calendar") && (
        <button onClick={()=>openAdd(CATS[0])}
          style={{
            position:"absolute", bottom:90, right:20,
            width:68, height:68, borderRadius:34, border:"none",
            background:"linear-gradient(145deg,#6366F1,#7C3AED)",
            color:"#FFF", fontSize:36, cursor:"pointer",
            boxShadow:"0 8px 30px rgba(99,102,241,.6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            zIndex:50, lineHeight:1,
          }}>+</button>
      )}

      {/* ── Bottom navigation ─────────────────────────────── */}
      <div style={{
        background:K.card, borderTop:`1px solid ${K.border}`,
        display:"flex", flexShrink:0,
        paddingBottom:"max(12px, env(safe-area-inset-bottom,12px))",
      }}>
        {NAV.map(n=>{
          const active = page===n.id;
          return (
            <button key={n.id} onClick={()=>setPage(n.id)}
              style={{
                flex:1, padding:"14px 4px 10px",
                border:"none", background:"transparent",
                cursor:"pointer", display:"flex",
                flexDirection:"column", alignItems:"center", gap:5,
              }}>
              <div style={{fontSize:active?30:24,transition:"font-size .15s,transform .1s",transform:active?"scale(1.1)":"scale(1)"}}>{n.icon}</div>
              <div style={{fontSize:11,fontWeight:active?800:500,color:active?K.accent:K.sub}}>{n.label}</div>
              {active && <div style={{width:24,height:3,borderRadius:2,background:K.accent}}/>}
            </button>
          );
        })}
      </div>

      {/* ── ADD / EDIT MODAL ──────────────────────────────── */}
      {modal && selCat && (
        <div style={{position:"absolute",inset:0,zIndex:100,display:"flex",flexDirection:"column"}}>
          <div onClick={closeModal} style={{flex:"0 0 60px",background:"rgba(0,0,0,.7)",backdropFilter:"blur(10px)"}}/>
          <div style={{flex:1,background:K.card,borderRadius:"32px 32px 0 0",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 -12px 60px rgba(0,0,0,.7)"}}>
            {/* Handle */}
            <div style={{display:"flex",justifyContent:"center",padding:"16px 0 8px",flexShrink:0}}>
              <div style={{width:48,height:5,borderRadius:3,background:K.border}}/>
            </div>
            {/* Modal header */}
            <div style={{padding:"6px 24px 20px",borderBottom:`1px solid ${K.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:18}}>
              <div style={{width:66,height:66,borderRadius:24,background:selCat.color+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,flexShrink:0}}>{selCat.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:21,fontWeight:900,color:K.text}}>{editId?"Edit Expense":`Add ${selCat.name}`}</div>
                <div style={{fontSize:14,color:K.sub,marginTop:4}}>Category: {selCat.name}</div>
              </div>
              <button onClick={closeModal} style={{width:48,height:48,borderRadius:16,border:`1px solid ${K.border}`,background:K.card2,color:K.sub,cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
            </div>

            {/* Category scroll */}
            {!editId && (
              <div style={{padding:"14px 20px 0",overflowX:"auto",display:"flex",gap:12,WebkitOverflowScrolling:"touch",flexShrink:0}}>
                {CATS.map(c=>(
                  <button key={c.id} onClick={()=>setSelCat(c)} style={{
                    flexShrink:0, display:"flex", flexDirection:"column",
                    alignItems:"center", gap:6, padding:"14px 16px",
                    borderRadius:20, border:`2.5px solid ${c.id===selCat.id?c.color:K.border}`,
                    background:c.id===selCat.id?c.color+"22":K.card2,
                    cursor:"pointer",
                  }}>
                    <span style={{fontSize:30}}>{c.icon}</span>
                    <span style={{fontSize:11,fontWeight:700,color:c.id===selCat.id?c.color:K.sub,whiteSpace:"nowrap"}}>{c.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Fields */}
            <div style={{flex:1,overflowY:"auto",padding:"20px 24px 28px",WebkitOverflowScrolling:"touch"}}>
              {[
                {label:"EXPENSE NAME", key:"name",   type:"text",   ph:`e.g. ${selCat.id==="food"?"Lunch":"Description"}`},
                {label:`AMOUNT (${currency})`, key:"amount", type:"number", ph:"0.00"},
                {label:"DATE",         key:"date",   type:"date",   ph:""},
                {label:"NOTES",        key:"notes",  type:"text",   ph:"Optional details…"},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:800,color:K.sub,letterSpacing:.8,marginBottom:10}}>{f.label}</div>
                  <input type={f.type} value={form[f.key]} placeholder={f.ph}
                    onChange={e=>setForm({...form,[f.key]:f.key === "name" ? capitalizeFirst(e.target.value) : e.target.value})}
                    style={{
                      width:"100%", padding:"18px 18px",
                      borderRadius:18, border:`1.5px solid ${K.border}`,
                      background:K.card2, color:K.text,
                      fontSize:17, boxSizing:"border-box",
                      outline:"none", fontFamily:"inherit", fontWeight:500,
                    }}/>
                </div>
              ))}
              <button onClick={saveExp} disabled={saving} style={{
                width:"100%", padding:"20px",
                borderRadius:20, border:"none",
                background:selCat.color, color:"#FFF",
                fontSize:18, fontWeight:900, cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.6 : 1,
                marginTop:6, boxShadow:`0 6px 24px ${selCat.color}55`,
              }}>
                {saving ? "Saving…" : (editId ? "Update Expense ✓" : "Save Expense ✓")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ─────────────────────────────────── */}
      {delId && (
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.75)",zIndex:400,display:"flex",alignItems:"flex-end"}}>
          <div style={{width:"100%",background:K.card,borderRadius:"32px 32px 0 0",padding:"30px 24px 50px",boxShadow:"0 -12px 60px rgba(0,0,0,.6)"}}>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div style={{fontSize:64,marginBottom:16}}>🗑️</div>
              <div style={{fontSize:22,fontWeight:900,color:K.text}}>Delete this expense?</div>
              <div style={{fontSize:16,color:K.sub,marginTop:8}}>This cannot be undone.</div>
            </div>
            <div style={{display:"flex",gap:14}}>
              <button onClick={()=>setDelId(null)} style={{flex:1,padding:"20px",borderRadius:20,border:`1.5px solid ${K.border}`,background:K.card2,color:K.text,fontSize:17,fontWeight:800,cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>delExp(delId)} style={{flex:1,padding:"20px",borderRadius:20,border:"none",background:K.red,color:"#FFF",fontSize:17,fontWeight:900,cursor:"pointer",boxShadow:`0 6px 24px ${K.red}55`}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PERIOD DETAIL BOTTOM SHEET ─────────────────────── */}
      <BottomSheet show={!!drawer} onClose={()=>setDrawer(null)} title={drawer?.title} sub={drawer?.sub}>
        {drawer && (drawer.exps.length===0 ? (
          <div style={{textAlign:"center",padding:"60px 0",color:K.sub,fontSize:17}}>No expenses for this period</div>
        ) : Object.entries(drawerGrouped).map(([date,exps])=>(
          <div key={date}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"14px 22px 10px",background:K.card2,borderBottom:`1px solid ${K.border}`}}>
              <span style={{fontSize:14,fontWeight:800,color:K.sub}}>{new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
              <span style={{fontSize:14,fontWeight:900,color:K.amber}}>{moneyFull(total(exps))}</span>
            </div>
            {exps.map(ex=><ExpRow key={ex.id} ex={ex}
              onEdit={()=>{setDrawer(null);setTimeout(()=>openEdit(ex),250);}}
              onDel={()=>setDelId(ex.id)}/>)}
          </div>
        )))}
      </BottomSheet>

      {/* ── TOAST ──────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position:"absolute", top:90, left:"50%",
          transform:"translateX(-50%)",
          background:toast.bad?K.red:K.green,
          color:"#FFF", padding:"14px 28px",
          borderRadius:28, fontSize:16, fontWeight:800,
          zIndex:600, whiteSpace:"nowrap",
          boxShadow:"0 10px 40px rgba(0,0,0,.5)",
          animation:"popIn .25s cubic-bezier(.34,1.56,.64,1)",
        }}>{toast.msg}</div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { margin:0; overscroll-behavior:none; touch-action:pan-y; }
        input,button,select,textarea { font-family:inherit; }
        /* Prevent iOS zoom on input focus — must be 16px+ */
        input[type=text], input[type=number], input[type=date] { font-size:max(16px,1em) !important; }
        input[type=date]::-webkit-calendar-picker-indicator { filter:${dark?"invert(1)":"none"}; opacity:.7; cursor:pointer; }
        ::-webkit-scrollbar { display:none; }
        @keyframes popIn {
          from { opacity:0; transform:translateX(-50%) scale(.8); }
          to   { opacity:1; transform:translateX(-50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
