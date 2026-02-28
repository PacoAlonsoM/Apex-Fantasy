import { useState, useEffect } from "react";

const TEAMS = {
  "Red Bull":{"c":"#3671C6","t":"#fff"},"Ferrari":{"c":"#E8002D","t":"#fff"},
  "Mercedes":{"c":"#00D2BE","t":"#000"},"McLaren":{"c":"#FF8000","t":"#000"},
  "Aston Martin":{"c":"#229971","t":"#fff"},"Alpine":{"c":"#0090FF","t":"#fff"},
  "Williams":{"c":"#005AFF","t":"#fff"},"Haas":{"c":"#B6BABD","t":"#000"},
  "Audi":{"c":"#888","t":"#fff"},"RB":{"c":"#6692FF","t":"#fff"},
};
const DRV=[
  {n:"Max Verstappen",s:"VER",nb:1,t:"Red Bull"},{n:"Liam Lawson",s:"LAW",nb:30,t:"Red Bull"},
  {n:"Charles Leclerc",s:"LEC",nb:16,t:"Ferrari"},{n:"Lewis Hamilton",s:"HAM",nb:44,t:"Ferrari"},
  {n:"George Russell",s:"RUS",nb:63,t:"Mercedes"},{n:"Kimi Antonelli",s:"ANT",nb:12,t:"Mercedes"},
  {n:"Lando Norris",s:"NOR",nb:4,t:"McLaren"},{n:"Oscar Piastri",s:"PIA",nb:81,t:"McLaren"},
  {n:"Fernando Alonso",s:"ALO",nb:14,t:"Aston Martin"},{n:"Lance Stroll",s:"STR",nb:18,t:"Aston Martin"},
  {n:"Pierre Gasly",s:"GAS",nb:10,t:"Alpine"},{n:"Jack Doohan",s:"DOO",nb:7,t:"Alpine"},
  {n:"Alexander Albon",s:"ALB",nb:23,t:"Williams"},{n:"Carlos Sainz",s:"SAI",nb:55,t:"Williams"},
  {n:"Esteban Ocon",s:"OCO",nb:31,t:"Haas"},{n:"Oliver Bearman",s:"BEA",nb:87,t:"Haas"},
  {n:"Nico Hulkenberg",s:"HUL",nb:27,t:"Audi"},{n:"Gabriel Bortoleto",s:"BOR",nb:5,t:"Audi"},
  {n:"Yuki Tsunoda",s:"TSU",nb:22,t:"RB"},{n:"Isack Hadjar",s:"HAD",nb:6,t:"RB"},
];
const CONSTRUCTORS=[...new Set(DRV.map(d=>d.t))];

// Flag-inspired accent colors (primary flag color of each host nation)
const FLAG = {
  "Australia":  "#FFCD00", // Gold (national sporting color)
  "China":      "#DE2910", // Chinese red
  "Japan":      "#BC002D", // Hinomaru crimson
  "Bahrain":    "#CE1126", // Bahraini red
  "Saudi Arabia":"#006C35",// Saudi green
  "USA-Miami":  "#3C3B6E", // US flag blue
  "Canada":     "#FF0000", // Canadian red
  "Monaco":     "#A8062E", // Monaco red (slightly deeper)
  "Spain-BCN":  "#F1BF00", // Spanish flag yellow (Barcelona)
  "Austria":    "#ED2939", // Austrian red
  "UK":         "#012169", // Union Jack blue
  "Belgium":    "#FDDA24", // Belgian yellow
  "Hungary":    "#47704F", // Hungarian green
  "Netherlands":"#FF6600", // Dutch orange
  "Italy":      "#009246", // Italian flag green
  "Spain-MAD":  "#AA151B", // Spanish red (Madrid – distinct from yellow/Barcelona)
  "Azerbaijan": "#0092BC", // Azerbaijani blue
  "Singapore":  "#EF3340", // Singaporean red
  "USA-TX":     "#B22234", // US flag red (Texas)
  "Mexico":     "#006847", // Mexican green
  "Brazil":     "#FFDF00", // Brazilian yellow
  "USA-LV":     "#5E17EB", // Purple (Las Vegas neon)
  "Qatar":      "#8D1B3D", // Qatari maroon
  "UAE":        "#00732F", // UAE green
};

// CORRECT 2026 F1 CALENDAR (official dates, race day)
const CAL=[
  {r:1, n:"Australian GP",     circuit:"Albert Park Circuit",            city:"Melbourne",   cc:"Australia",    date:"2026-03-08",type:"Permanent",len:5.278,laps:58,rec:"1:20.235",recBy:"C. Leclerc",    recY:2022,drs:4,sprint:false,turns:16,elev:0,   flagKey:"Australia"},
  {r:2, n:"Chinese GP",        circuit:"Shanghai International Circuit", city:"Shanghai",    cc:"China",        date:"2026-03-15",type:"Permanent",len:5.451,laps:56,rec:"1:32.238",recBy:"M. Schumacher",recY:2004,drs:2,sprint:true, turns:16,elev:7,   flagKey:"China"},
  {r:3, n:"Japanese GP",       circuit:"Suzuka International Course",    city:"Suzuka",      cc:"Japan",        date:"2026-03-29",type:"Permanent",len:5.807,laps:53,rec:"1:30.983",recBy:"V. Bottas",     recY:2019,drs:2,sprint:false,turns:18,elev:42,  flagKey:"Japan"},
  {r:4, n:"Bahrain GP",        circuit:"Bahrain International Circuit",  city:"Sakhir",      cc:"Bahrain",      date:"2026-04-12",type:"Permanent",len:5.412,laps:57,rec:"1:31.447",recBy:"P. de la Rosa", recY:2005,drs:3,sprint:false,turns:15,elev:10,  flagKey:"Bahrain"},
  {r:5, n:"Saudi Arabian GP",  circuit:"Jeddah Corniche Circuit",        city:"Jeddah",      cc:"Saudi Arabia", date:"2026-04-19",type:"Street",   len:6.174,laps:50,rec:"1:30.734",recBy:"L. Hamilton",   recY:2021,drs:3,sprint:false,turns:27,elev:5,   flagKey:"Saudi Arabia"},
  {r:6, n:"Miami GP",          circuit:"Miami International Autodrome",  city:"Miami",       cc:"USA",          date:"2026-05-03",type:"Street",   len:5.412,laps:57,rec:"1:29.708",recBy:"M. Verstappen", recY:2023,drs:3,sprint:true, turns:19,elev:0,   flagKey:"USA-Miami"},
  {r:7, n:"Canadian GP",       circuit:"Circuit Gilles Villeneuve",      city:"Montreal",    cc:"Canada",       date:"2026-05-24",type:"Street",   len:4.361,laps:70,rec:"1:13.078",recBy:"V. Bottas",     recY:2019,drs:3,sprint:true, turns:14,elev:3,   flagKey:"Canada"},
  {r:8, n:"Monaco GP",         circuit:"Circuit de Monaco",              city:"Monte Carlo", cc:"Monaco",       date:"2026-06-07",type:"Street",   len:3.337,laps:78,rec:"1:12.909",recBy:"L. Norris",     recY:2024,drs:1,sprint:false,turns:19,elev:42,  flagKey:"Monaco"},
  {r:9, n:"Spanish GP",        circuit:"Circuit de Barcelona-Catalunya", city:"Barcelona",   cc:"Spain",        date:"2026-06-14",type:"Permanent",len:4.657,laps:66,rec:"1:16.330",recBy:"M. Verstappen", recY:2023,drs:2,sprint:false,turns:14,elev:29,  flagKey:"Spain-BCN"},
  {r:10,n:"Austrian GP",       circuit:"Red Bull Ring",                  city:"Spielberg",   cc:"Austria",      date:"2026-06-28",type:"Permanent",len:4.318,laps:71,rec:"1:05.619",recBy:"C. Sainz",      recY:2020,drs:3,sprint:false,turns:10,elev:65,  flagKey:"Austria"},
  {r:11,n:"British GP",        circuit:"Silverstone Circuit",            city:"Silverstone", cc:"United Kingdom",date:"2026-07-05",type:"Permanent",len:5.891,laps:52,rec:"1:27.097",recBy:"M. Verstappen",recY:2020,drs:2,sprint:true, turns:18,elev:14,  flagKey:"UK"},
  {r:12,n:"Belgian GP",        circuit:"Circuit de Spa-Francorchamps",   city:"Spa",         cc:"Belgium",      date:"2026-07-19",type:"Permanent",len:7.004,laps:44,rec:"1:46.286",recBy:"V. Bottas",     recY:2018,drs:2,sprint:false,turns:19,elev:104, flagKey:"Belgium"},
  {r:13,n:"Hungarian GP",      circuit:"Hungaroring",                    city:"Budapest",    cc:"Hungary",      date:"2026-07-26",type:"Permanent",len:4.381,laps:70,rec:"1:16.627",recBy:"L. Hamilton",   recY:2020,drs:2,sprint:false,turns:14,elev:38,  flagKey:"Hungary"},
  {r:14,n:"Dutch GP",          circuit:"Circuit Zandvoort",              city:"Zandvoort",   cc:"Netherlands",  date:"2026-08-23",type:"Permanent",len:4.259,laps:72,rec:"1:11.097",recBy:"M. Verstappen", recY:2023,drs:2,sprint:true, turns:14,elev:17,  flagKey:"Netherlands"},
  {r:15,n:"Italian GP",        circuit:"Autodromo Nazionale Monza",      city:"Monza",       cc:"Italy",        date:"2026-09-06",type:"Permanent",len:5.793,laps:53,rec:"1:21.046",recBy:"R. Barrichello",recY:2004,drs:2,sprint:false,turns:11,elev:14,  flagKey:"Italy"},
  {r:16,n:"Madrid GP",         circuit:"Ifema Madrid Circuit",           city:"Madrid",      cc:"Spain",        date:"2026-09-13",type:"Street",   len:5.474,laps:55,rec:"—",        recBy:"New Circuit",  recY:2026,drs:3,sprint:false,turns:20,elev:8,   flagKey:"Spain-MAD"},
  {r:17,n:"Azerbaijan GP",     circuit:"Baku City Circuit",              city:"Baku",        cc:"Azerbaijan",   date:"2026-09-26",type:"Street",   len:6.003,laps:51,rec:"1:43.009",recBy:"C. Leclerc",    recY:2019,drs:2,sprint:false,turns:20,elev:26,  flagKey:"Azerbaijan"},
  {r:18,n:"Singapore GP",      circuit:"Marina Bay Street Circuit",      city:"Singapore",   cc:"Singapore",    date:"2026-10-11",type:"Street",   len:4.940,laps:62,rec:"1:35.867",recBy:"L. Hamilton",   recY:2023,drs:3,sprint:true, turns:19,elev:5,   flagKey:"Singapore"},
  {r:19,n:"US GP",             circuit:"Circuit of the Americas",        city:"Austin",      cc:"USA",          date:"2026-10-25",type:"Permanent",len:5.513,laps:56,rec:"1:36.169",recBy:"C. Leclerc",    recY:2019,drs:2,sprint:false,turns:20,elev:41,  flagKey:"USA-TX"},
  {r:20,n:"Mexico City GP",    circuit:"Autodromo Hermanos Rodriguez",   city:"Mexico City", cc:"Mexico",       date:"2026-11-01",type:"Permanent",len:4.304,laps:71,rec:"1:17.774",recBy:"V. Bottas",     recY:2021,drs:3,sprint:false,turns:17,elev:2240,flagKey:"Mexico"},
  {r:21,n:"Sao Paulo GP",      circuit:"Autodromo Jose Carlos Pace",     city:"Sao Paulo",   cc:"Brazil",       date:"2026-11-08",type:"Permanent",len:4.309,laps:71,rec:"1:10.540",recBy:"V. Bottas",     recY:2018,drs:2,sprint:false,turns:15,elev:16,  flagKey:"Brazil"},
  {r:22,n:"Las Vegas GP",      circuit:"Las Vegas Strip Circuit",        city:"Las Vegas",   cc:"USA",          date:"2026-11-21",type:"Street",   len:6.201,laps:50,rec:"1:35.490",recBy:"O. Piastri",    recY:2024,drs:3,sprint:false,turns:17,elev:0,   flagKey:"USA-LV"},
  {r:23,n:"Qatar GP",          circuit:"Lusail International Circuit",   city:"Lusail",      cc:"Qatar",        date:"2026-11-29",type:"Permanent",len:5.419,laps:57,rec:"1:24.319",recBy:"M. Verstappen", recY:2023,drs:2,sprint:false,turns:16,elev:8,   flagKey:"Qatar"},
  {r:24,n:"Abu Dhabi GP",      circuit:"Yas Marina Circuit",             city:"Abu Dhabi",   cc:"UAE",          date:"2026-12-06",type:"Permanent",len:5.281,laps:58,rec:"1:26.103",recBy:"M. Verstappen", recY:2021,drs:2,sprint:false,turns:16,elev:3,   flagKey:"UAE"},
];

const rc = r => FLAG[r.flagKey] || "#6366F1";

const PTS={pole:10,winner:25,p2:18,p3:15,dnf:12,sc:5,rf:8,fl:7,dotd:6,ctor:8,perfectPodium:15,sp_pole:5,sp_winner:12,sp_p2:9,sp_p3:7};

const MOCK_LB=[
  {name:"SpeedDemon94",pts:847,country:"DE",preds:18},{name:"ApexHunter",pts:823,country:"GB",preds:17},
  {name:"GridMaster",pts:791,country:"ES",preds:16},{name:"TurboWizard",pts:765,country:"NL",preds:18},
  {name:"PitLanePro",pts:742,country:"IT",preds:17},{name:"DRSActivated",pts:718,country:"BR",preds:16},
  {name:"SafetyCarKing",pts:695,country:"FR",preds:18},{name:"OvercutQueen",pts:671,country:"AU",preds:15},
  {name:"BrakingBad",pts:648,country:"CA",preds:15},{name:"FlatOutFrank",pts:624,country:"US",preds:14},
];

const SEED_COMMENTS={
  1:[{id:101,author:"TurboWizard",time:"1h ago",text:"Norris has been on fire in testing. McLaren's setup suits Albert Park perfectly.",likes:12},{id:102,author:"GridMaster",time:"45m ago",text:"Don't sleep on Hamilton in the Ferrari. New car, new motivation — he'll want to start strong.",likes:8}],
  2:[{id:201,author:"PitLanePro",time:"4h ago",text:"The sidepods look insane. Red Bull always find something clever in the regs.",likes:15},{id:202,author:"SpeedDemon94",time:"3h ago",text:"Aero concept looks similar to 2022 Ferrari. Will be fascinating to see in race trim.",likes:6}],
  3:[{id:301,author:"DRSActivated",time:"20h ago",text:"Genuinely the best tip on this forum. SC on Monaco is practically guaranteed every year.",likes:34},{id:302,author:"ApexHunter",time:"18h ago",text:"Baku too. And the red flag points on streets are free money if you pick them right.",likes:22}],
  4:[{id:401,author:"OvercutQueen",time:"22h ago",text:"Hamilton at Monaco in red would be iconic. That's my pole pick for Round 8.",likes:47},{id:402,author:"BrakingBad",time:"20h ago",text:"The wet weather factor at Silverstone too — Hamilton in rain is unmatched still.",likes:31}],
  5:[{id:501,author:"FlatOutFrank",time:"1d ago",text:"Stroll DNF is basically free points every other race. Don't overthink it.",likes:19},{id:502,author:"SafetyCarKing",time:"23h ago",text:"Doohan is the rookie wildcard — high ceiling but high floor of mistakes.",likes:11}],
};
const INIT_POSTS=[
  {id:1,author:"SpeedDemon94",time:"2h ago",title:"Who wins Australia?",body:"With new 2026 regs, anything can happen. I'm putting my money on Norris to take it. The McLaren looked rapid in testing and Albert Park seems to suit their car's characteristics.",likes:45,replies:2},
  {id:2,author:"GridMaster",time:"5h ago",title:"Red Bull 2026 car reveal thoughts",body:"Stunning livery but the aero package looks very different from rivals. The sidepods are a total departure from anything we've seen. Curious how it performs in low-speed corners.",likes:38,replies:2},
  {id:3,author:"TurboWizard",time:"1d ago",title:"Best strategy for street circuit picks",body:"Safety car probability is way up on streets. Always pick Yes for SC on Monaco and Baku — easy points. Red flag is also very possible at Monaco given how tight the barriers are.",likes:62,replies:2},
  {id:4,author:"PitLanePro",time:"1d ago",title:"Hamilton to Ferrari — your predictions?",body:"A new era begins. Hamilton in red. Pole at Monaco is absolutely on the cards for Lewis in 2026 — he knows that circuit better than almost anyone.",likes:89,replies:2},
  {id:5,author:"ApexHunter",time:"2d ago",title:"DNF prediction is the hidden gem",body:"12 points for a correct DNF is huge value. Statistically riskier drivers are worth targeting every race. It's one of the most underrated picks in the scoring system.",likes:27,replies:2},
];
const FALLBACK_NEWS=[
  {id:1,title:"Hamilton Completes First Ferrari Test at Fiorano",summary:"Lewis Hamilton completed 87 laps on his Ferrari debut at Fiorano, posting times that impressed the Scuderia's engineers.",fullBody:"Lewis Hamilton arrived at Fiorano in a red racing suit for the first time in his career, completing 87 laps across two days of private testing. Engineers described the session as highly productive, with Hamilton showing immediate comfort in the SF-26's cockpit. His feedback on the car's aerodynamic balance led to several setup changes on day two. Hamilton is expected to contest the full 2026 season as Ferrari's lead driver, alongside Charles Leclerc, with title ambitions firmly stated at the team's season launch.",category:"Driver News",date:"Feb 14, 2026",tag:"Breaking"},
  {id:2,title:"2026 Regulations: The Biggest Shake-Up Since 2022",summary:"F1's new technical era arrives with radically different aerodynamics, a 50/50 power split, and smaller, lighter cars. Engineers call it the most complex challenge in modern F1.",fullBody:"The 2026 regulations represent a fundamental rethink of what a Formula 1 car looks like. Active aerodynamic systems replace traditional fixed wings, with flaps that open on straights and close in corners. The new power unit mandates a 50/50 split between combustion and electric motor. Cars are also 22kg lighter on average, improving mechanical grip. Teams have spent over two years developing their interpretations, with some making radically different aerodynamic bets.",category:"Technical",date:"Feb 10, 2026",tag:"Deep Dive"},
  {id:3,title:"McLaren Confident of Championship Defence in 2026",summary:"After their Constructors' title in 2024, McLaren enter 2026 with renewed ambition. Norris says the MCL60 feels like the best car he has ever driven.",fullBody:"McLaren's journey from midfield obscurity to championship challenger is one of F1's great modern stories. With Lando Norris maturing into a genuine title contender and Oscar Piastri providing consistent support, the team believes their 2026 concept is built on solid foundations. CEO Zak Brown stated that both drivers have the tools to fight for the title — a statement that would have seemed unthinkable just four years ago.",category:"Team News",date:"Feb 8, 2026",tag:"Team News"},
  {id:4,title:"Rookie Class of 2026: Antonelli, Hadjar and Bortoleto Assessed",summary:"Three rookies join the grid — Kimi Antonelli at Mercedes, Isack Hadjar at RB, and Gabriel Bortoleto at Audi. Pre-season testing suggests all three are ready for the step up.",fullBody:"The 2026 rookie class is arguably the most talented in a generation. Kimi Antonelli, at just 19, carries the weight of replacing a seven-time champion at Mercedes. Isack Hadjar impressed enormously in F2 and arrives at RB with technical feedback engineers describe as veteran-level. Gabriel Bortoleto, the reigning F2 champion, brings a smooth, calculated style to Audi's project — timing his arrival perfectly.",category:"Driver News",date:"Feb 5, 2026",tag:"Rookies"},
  {id:5,title:"Red Bull vs Ferrari: Who Has the Faster 2026 Car?",summary:"Analysis of pre-season testing data suggests the 2026 title fight could come down to Red Bull's aero innovation vs Ferrari's refined power unit.",fullBody:"Pre-season testing at Bahrain produced more questions than answers — which is exactly what the top teams intended. Red Bull's RB26 showed exceptional high-speed stability. Ferrari appeared stronger in low-speed sectors. Most independent analysts agree the 2026 championship will be decided by development pace rather than the base cars.",category:"Season Preview",date:"Feb 3, 2026",tag:"Analysis"},
  {id:6,title:"Madrid Joins the Calendar: Everything You Need to Know",summary:"The new Ifema Madrid Circuit makes its Formula 1 debut in Round 16 of 2026. The semi-street track winds through the Spanish capital's exhibition district.",fullBody:"Madrid returns to Formula 1 for the first time since 1981, this time on a brand new purpose-designed semi-street circuit in the Ifema exhibition district. The layout features 20 corners, three DRS zones, and a mix of high-speed and technical sections that engineers expect to produce competitive racing. The circuit replaces Imola on the calendar and joins Barcelona to give Spain two Grands Prix in 2026.",category:"Season Preview",date:"Jan 29, 2026",tag:"New Track"},
];
const CAT_COLORS={"Driver News":"#F97316","Technical":"#06B6D4","Team News":"#8B5CF6","Season Preview":"#E8002D","Race Results":"#10B981","Breaking":"#EF4444","Analysis":"#3B82F6","Feature":"#F59E0B","Rookies":"#EC4899","Deep Dive":"#14B8A6","New Track":"#FDDA24"};

const fmt=d=>new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const fmtFull=d=>new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
const countdown=s=>{const diff=new Date(s)-new Date();if(diff<0)return null;return{d:Math.floor(diff/86400000),h:Math.floor(diff%86400000/3600000),m:Math.floor(diff%3600000/60000)};};
const nextRace=()=>CAL.find(r=>new Date(r.date)>=new Date())||CAL[CAL.length-1];

// ── BG ─────────────────────────────────────────────────────────────────────
function BgCanvas(){return(
  <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,background:"#08081A"}}/>
    <div style={{position:"absolute",top:"-20%",left:"-10%",width:"60%",height:"70%",background:"radial-gradient(ellipse,rgba(232,0,45,0.1) 0%,transparent 65%)",borderRadius:"50%"}}/>
    <div style={{position:"absolute",top:"30%",right:"-15%",width:"55%",height:"60%",background:"radial-gradient(ellipse,rgba(99,102,241,0.11) 0%,transparent 65%)",borderRadius:"50%"}}/>
    <div style={{position:"absolute",bottom:"-10%",left:"20%",width:"50%",height:"55%",background:"radial-gradient(ellipse,rgba(6,182,212,0.08) 0%,transparent 65%)",borderRadius:"50%"}}/>
    <div style={{position:"absolute",top:"60%",left:"5%",width:"35%",height:"40%",background:"radial-gradient(ellipse,rgba(245,158,11,0.06) 0%,transparent 65%)",borderRadius:"50%"}}/>
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.025}} xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>
  </div>
);}

// ── NAVBAR ─────────────────────────────────────────────────────────────────
function Navbar({page,setPage,user,openAuth,onLogout}){
  const tabs=[["home","Home"],["calendar","Calendar"],["predictions","Predictions"],["news","News"],["community","Community"]];
  return(
    <nav style={{position:"sticky",top:0,zIndex:200,background:"rgba(8,8,26,0.8)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.07)",height:58,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setPage("home")}>
        <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#E8002D,#FF6B35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <span style={{fontWeight:900,fontSize:16,letterSpacing:-0.5}}>APEX<span style={{color:"rgba(255,255,255,0.35)",fontWeight:400,marginLeft:3}}>FANTASY</span></span>
      </div>
      <div style={{display:"flex"}}>
        {tabs.map(([id,lb])=>(
          <button key={id} onClick={()=>setPage(id)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px 14px",fontSize:13,fontWeight:page===id?700:400,color:page===id?"#fff":"rgba(255,255,255,0.4)",position:"relative",transition:"color 0.15s"}}>
            {lb}
            {page===id&&<div style={{position:"absolute",bottom:-1,left:"15%",right:"15%",height:2,background:"linear-gradient(90deg,#E8002D,#FF6B35)",borderRadius:1}}/>}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {user?(
          <>
            <div style={{padding:"5px 14px",borderRadius:20,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",fontSize:13,fontWeight:700}}>{user.name} <span style={{color:"#E8002D",fontWeight:900}}>{user.pts||0}pt</span></div>
            <button onClick={onLogout} style={{background:"none",border:"1px solid rgba(255,255,255,0.13)",borderRadius:20,color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12,padding:"5px 13px"}}>Out</button>
          </>
        ):(
          <>
            <button onClick={()=>openAuth("login")} style={{background:"none",border:"1px solid rgba(255,255,255,0.13)",borderRadius:20,color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:13,padding:"6px 15px"}}>Login</button>
            <button onClick={()=>openAuth("register")} style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:20,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,padding:"6px 16px"}}>Sign Up</button>
          </>
        )}
      </div>
    </nav>
  );
}

// ── AUTH ───────────────────────────────────────────────────────────────────
function AuthModal({mode,setMode,onClose,onAuth}){
  const [f,setF]=useState({name:"",email:"",pass:""});
  const [err,setErr]=useState("");
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const inp={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:8,color:"#fff",padding:"11px 14px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"};
  const lbl={fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",display:"block",marginBottom:6};
  const submit=async()=>{
    if(!f.email||!f.pass){setErr("Fill all fields.");return;}
    if(mode==="register"&&!f.name){setErr("Enter a username.");return;}
    try{
      if(mode==="register"){
        let ex=null;try{ex=await window.storage.get(`u:${f.email}`);}catch{}
        if(ex){setErr("Email already registered.");return;}
        const u={name:f.name,email:f.email,pass:f.pass,pts:0,joined:new Date().toISOString()};
        await window.storage.set(`u:${f.email}`,JSON.stringify(u));
        await window.storage.set("cu",JSON.stringify(u));
        onAuth(u);onClose();
      }else{
        let res=null;try{res=await window.storage.get(`u:${f.email}`);}catch{setErr("Account not found.");return;}
        if(!res){setErr("Account not found.");return;}
        const u=JSON.parse(res.value);
        if(u.pass!==f.pass){setErr("Wrong password.");return;}
        await window.storage.set("cu",JSON.stringify(u));
        onAuth(u);onClose();
      }
    }catch{setErr("Something went wrong.");}
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"rgba(10,10,28,0.98)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:16,padding:32,width:380,backdropFilter:"blur(20px)"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:44,height:4,background:"linear-gradient(90deg,#E8002D,#FF6B35)",borderRadius:2,marginBottom:20}}/>
        <h2 style={{margin:"0 0 4px",fontWeight:900,fontSize:22}}>{mode==="login"?"Welcome back":"Join Apex Fantasy"}</h2>
        <p style={{margin:"0 0 24px",color:"rgba(255,255,255,0.38)",fontSize:13}}>{mode==="login"?"Sign in to your account":"Free forever. No credits."}</p>
        {mode==="register"&&<><label style={lbl}>Username</label><input style={{...inp,marginBottom:14}} placeholder="YourUsername" value={f.name} onChange={e=>upd("name",e.target.value)}/></>}
        <label style={lbl}>Email</label>
        <input style={{...inp,marginBottom:14}} type="email" placeholder="you@email.com" value={f.email} onChange={e=>upd("email",e.target.value)}/>
        <label style={lbl}>Password</label>
        <input style={{...inp,marginBottom:20}} type="password" placeholder="••••••••" value={f.pass} onChange={e=>upd("pass",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        {err&&<p style={{color:"#F87171",fontSize:12,margin:"0 0 14px"}}>{err}</p>}
        <button style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontWeight:700,width:"100%",padding:13,fontSize:14}} onClick={submit}>{mode==="login"?"Sign In":"Create Account"}</button>
        <p style={{textAlign:"center",marginTop:14,fontSize:12,color:"rgba(255,255,255,0.3)"}}>
          {mode==="login"?"No account? ":"Have one? "}
          <span style={{color:"#FF6B35",cursor:"pointer",fontWeight:700}} onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="login"?"Sign up":"Sign in"}</span>
        </p>
      </div>
    </div>
  );
}

// ── HOME ───────────────────────────────────────────────────────────────────
function HomePage({user,setPage,openAuth}){
  const next=nextRace(),cd=next?countdown(next.date):null;
  const scoring=[
    ["Race Winner","25","#E8002D"],["2nd Place","18","#9CA3AF"],["3rd Place","15","#B87333"],
    ["Pole Position","10","#A78BFA"],["DNF Driver","12","#F97316"],["Red Flag Y/N","8","#EF4444"],
    ["Best Constructor","8","#34D399"],["Fastest Lap","7","#06B6D4"],["Driver of the Day","6","#F472B6"],
    ["Safety Car Y/N","5","#FBBF24"],["Perfect Podium Bonus","+15","#FF6B35"],
  ];
  return(
    <div style={{maxWidth:1160,margin:"0 auto",padding:"52px 28px",position:"relative",zIndex:1}}>
      <div style={{marginBottom:56}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:20,background:"rgba(232,0,45,0.14)",border:"1px solid rgba(232,0,45,0.28)",marginBottom:22}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#E8002D"}}/>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#FF6B6B"}}>2026 Season — Open for Predictions</span>
        </div>
        <h1 style={{fontSize:66,fontWeight:900,lineHeight:0.95,margin:"0 0 22px",letterSpacing:-3,maxWidth:600}}>
          The F1<br/>
          <span style={{background:"linear-gradient(135deg,#E8002D 0%,#FF6B35 50%,#FBBF24 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Fantasy</span><br/>
          Platform.
        </h1>
        <p style={{fontSize:16,color:"rgba(255,255,255,0.48)",lineHeight:1.7,margin:"0 0 28px",maxWidth:420}}>Make race predictions, earn points for every correct call, and battle your friends across all 24 rounds of 2026.</p>
        <div style={{display:"flex",gap:10}}>
          {user
            ?<button style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:10,color:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,padding:"13px 30px"}} onClick={()=>setPage("predictions")}>Make Your Picks</button>
            :<button style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:10,color:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,padding:"13px 30px"}} onClick={()=>openAuth("register")}>Get Started</button>
          }
          <button style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.11)",borderRadius:10,color:"#fff",cursor:"pointer",fontSize:14,padding:"13px 30px"}} onClick={()=>setPage("calendar")}>View Calendar</button>
        </div>
      </div>
      {next&&cd&&(
        <div style={{borderRadius:16,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",padding:"22px 26px",marginBottom:26,display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,flexWrap:"wrap",backdropFilter:"blur(10px)"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:8}}>Next Race — Round {next.r} / 24</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <div style={{width:4,height:22,borderRadius:2,background:rc(next)}}/>
              <div style={{fontSize:23,fontWeight:900,letterSpacing:-0.5}}>{next.n}</div>
              {next.sprint&&<span style={{fontSize:9,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",color:"#FF8700",padding:"2px 8px",borderRadius:10,background:"rgba(255,135,0,0.12)",border:"1px solid rgba(255,135,0,0.28)"}}>Sprint</span>}
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.38)"}}>{next.circuit} · {fmtFull(next.date)}</div>
          </div>
          <div style={{display:"flex",gap:3}}>
            {[["Days",cd.d],["Hrs",cd.h],["Min",cd.m]].map(([l,v])=>(
              <div key={l} style={{textAlign:"center",padding:"12px 18px",borderRadius:11,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div style={{fontSize:36,fontWeight:900,lineHeight:1,background:"linear-gradient(180deg,#fff,rgba(255,255,255,0.5))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{String(v).padStart(2,"0")}</div>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",marginTop:4}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(10px)",background:"rgba(255,255,255,0.03)"}}>
          <div style={{background:"linear-gradient(135deg,rgba(232,0,45,0.18),rgba(255,107,53,0.08))",padding:"15px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:"#FF8080"}}>Points System</div>
          </div>
          {scoring.map(([l,p,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 20px",borderBottom:i<scoring.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:2,height:12,background:c,borderRadius:1}}/>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.62)"}}>{l}</span>
              </div>
              <span style={{fontSize:14,fontWeight:900,color:c}}>{p}</span>
            </div>
          ))}
          <div style={{padding:"12px 20px",borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,135,0,0.04)"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,135,0,0.65)",marginBottom:7}}>Sprint (Reduced)</div>
            {[["Sprint Pole","5"],["Sprint Winner","12"],["Sprint P2","9"],["Sprint P3","7"]].map(([l,p])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>{l}</span>
                <span style={{fontSize:12,fontWeight:700,color:"rgba(255,135,0,0.55)"}}>{p} pts</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(10px)",background:"rgba(255,255,255,0.03)"}}>
          <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.22),rgba(6,182,212,0.08))",padding:"15px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:"#A5B4FC"}}>Global Leaderboard</div>
            <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:20,color:"rgba(255,255,255,0.45)",cursor:"pointer",fontSize:11,padding:"3px 10px"}} onClick={()=>setPage("community")}>See all</button>
          </div>
          {MOCK_LB.slice(0,10).map((p,i)=>(
            <div key={p.name} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",borderBottom:i<9?"1px solid rgba(255,255,255,0.04)":"none",background:i===0?"rgba(232,0,45,0.05)":"transparent"}}>
              <div style={{width:22,textAlign:"center",fontSize:i<3?13:11,fontWeight:900,color:i===0?"#E8002D":i===1?"#9CA3AF":i===2?"#B87333":"rgba(255,255,255,0.16)",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700}}>{p.name}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.28)"}}>{p.country} · {p.preds} picks</div>
              </div>
              <div style={{fontSize:15,fontWeight:900,color:i===0?"#E8002D":"rgba(255,255,255,0.85)"}}>{p.pts}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CALENDAR ───────────────────────────────────────────────────────────────
function CalendarPage(){
  const [sel,setSel]=useState(null);
  const [filt,setFilt]=useState("all");
  const filtered=filt==="all"?CAL:filt==="sprint"?CAL.filter(r=>r.sprint):CAL.filter(r=>r.type.toLowerCase()===filt.toLowerCase());
  const months=filtered.reduce((acc,r)=>{const m=new Date(r.date).toLocaleString("en-GB",{month:"long",year:"numeric"});if(!acc[m])acc[m]=[];acc[m].push(r);return acc;},{});

  return(
    <div style={{maxWidth:1160,margin:"0 auto",padding:"52px 28px",position:"relative",zIndex:1}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:34,fontWeight:900,margin:"0 0 6px",letterSpacing:-1}}>2026 F1 Calendar</h1>
        <p style={{color:"rgba(255,255,255,0.38)",margin:0,fontSize:13}}>24 Grands Prix · 6 Sprint Weekends · NEW: Madrid GP debuts · March–December 2026</p>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:26,flexWrap:"wrap"}}>
        {[["all","All Races"],["sprint","Sprint Weekends"],["Street","Street Circuits"],["Permanent","Permanent Circuits"]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilt(f)} style={{background:filt===f?"linear-gradient(135deg,#E8002D,#FF6B35)":"rgba(255,255,255,0.05)",border:filt===f?"none":"1px solid rgba(255,255,255,0.09)",borderRadius:20,color:filt===f?"#fff":"rgba(255,255,255,0.48)",cursor:"pointer",fontWeight:600,padding:"6px 15px",fontSize:12,transition:"all 0.15s"}}>{l}</button>
        ))}
        <span style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,0.28)",alignSelf:"center"}}>{filtered.length} races</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:sel?"1fr 360px":"1fr",gap:20,alignItems:"start"}}>
        <div>
          {Object.entries(months).map(([month,races])=>(
            <div key={month} style={{marginBottom:26}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.22)",marginBottom:8,paddingLeft:2}}>{month}</div>
              <div style={{borderRadius:11,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)"}}>
                {races.map((race,i)=>(
                  <div key={race.r} onClick={()=>setSel(sel?.r===race.r?null:race)} style={{display:"flex",alignItems:"center",borderBottom:i<races.length-1?"1px solid rgba(255,255,255,0.05)":"none",cursor:"pointer",background:sel?.r===race.r?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.02)",transition:"background 0.12s"}}>
                    <div style={{width:4,alignSelf:"stretch",background:rc(race),flexShrink:0}}/>
                    <div style={{width:44,textAlign:"center",fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.18)",flexShrink:0}}>R{race.r}</div>
                    <div style={{flex:1,padding:"13px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:14,fontWeight:700}}>{race.n}</span>
                        {race.sprint&&<span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",color:"#FF8700",padding:"1px 6px",borderRadius:8,background:"rgba(255,135,0,0.11)",border:"1px solid rgba(255,135,0,0.22)"}}>Sprint</span>}
                        {race.r===16&&<span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",color:"#FBBF24",padding:"1px 6px",borderRadius:8,background:"rgba(251,191,36,0.11)",border:"1px solid rgba(251,191,36,0.22)"}}>New</span>}
                      </div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.32)",marginTop:2}}>{race.circuit}</div>
                    </div>
                    <div style={{width:80,textAlign:"right",padding:"0 14px",fontSize:12,color:"rgba(255,255,255,0.35)",flexShrink:0}}>{fmt(race.date)}</div>
                    <div style={{width:90,padding:"0 10px",flexShrink:0}}>
                      <span style={{fontSize:10,fontWeight:700,color:race.type==="Street"?"#FBBF24":"#34D399",background:race.type==="Street"?"rgba(251,191,36,0.1)":"rgba(52,211,153,0.1)",border:`1px solid ${race.type==="Street"?"rgba(251,191,36,0.22)":"rgba(52,211,153,0.22)"}`,borderRadius:10,padding:"2px 8px"}}>{race.type}</span>
                    </div>
                    <div style={{width:32,textAlign:"center",color:"rgba(255,255,255,0.18)",fontSize:12,transform:sel?.r===race.r?"rotate(90deg)":"none",transition:"transform 0.2s",flexShrink:0}}>›</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {sel&&(
          <div style={{position:"sticky",top:70}}>
            <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",backdropFilter:"blur(16px)",background:"rgba(10,10,28,0.92)"}}>
              <div style={{height:4,background:`linear-gradient(90deg,${rc(sel)},${rc(sel)}66)`}}/>
              <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",marginBottom:7}}>Round {sel.r} of 24</div>
                    <h2 style={{margin:"0 0 3px",fontWeight:900,fontSize:19,letterSpacing:-0.5}}>{sel.n}</h2>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.38)"}}>{sel.city}, {sel.cc}</div>
                    <div style={{display:"flex",gap:5,marginTop:9,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,fontWeight:700,color:sel.type==="Street"?"#FBBF24":"#34D399",background:sel.type==="Street"?"rgba(251,191,36,0.1)":"rgba(52,211,153,0.1)",border:`1px solid ${sel.type==="Street"?"rgba(251,191,36,0.22)":"rgba(52,211,153,0.22)"}`,borderRadius:10,padding:"2px 8px"}}>{sel.type}</span>
                      {sel.sprint&&<span style={{fontSize:9,fontWeight:700,color:"#FF8700",background:"rgba(255,135,0,0.1)",border:"1px solid rgba(255,135,0,0.22)",borderRadius:10,padding:"2px 8px"}}>Sprint Weekend</span>}
                      {sel.r===16&&<span style={{fontSize:9,fontWeight:700,color:"#FBBF24",background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.22)",borderRadius:10,padding:"2px 8px"}}>New Circuit 2026</span>}
                    </div>
                  </div>
                  <button onClick={()=>setSel(null)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,color:"rgba(255,255,255,0.38)",cursor:"pointer",width:27,height:27,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12}}>✕</button>
                </div>
              </div>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.07)",background:`linear-gradient(135deg,${rc(sel)}10,transparent)`}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:rc(sel),marginBottom:5}}>Lap Record</div>
                <div style={{fontSize:26,fontWeight:900,letterSpacing:-0.5}}>{sel.rec}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.38)",marginTop:2}}>{sel.recBy} · {sel.recY}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"rgba(255,255,255,0.04)"}}>
                {[["Race Date",fmtFull(sel.date)],["Length",`${sel.len} km`],["Laps",sel.laps],["Race Dist.",`${(sel.len*sel.laps).toFixed(1)} km`],["Turns",sel.turns],["DRS Zones",sel.drs],["Elevation",`${sel.elev} m`],["Type",sel.type]].map(([l,v],i)=>(
                  <div key={l} style={{padding:"12px 15px",background:"rgba(8,8,26,0.72)",margin:"1px 0 0 "+(i%2===1?"1px":"0")}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.22)",marginBottom:3}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:700}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PREDICTIONS ────────────────────────────────────────────────────────────
function PredictionsPage({user,openAuth}){
  const [race,setRace]=useState(nextRace()||CAL[0]);
  const [picks,setPicks]=useState({});
  const [allPicks,setAllPicks]=useState({});
  const [tab,setTab]=useState("race");
  const [saved,setSaved]=useState(false);

  useEffect(()=>{loadPicks();},[user]);
  const loadPicks=async()=>{if(!user)return;try{const r=await window.storage.get(`pk:${user.email}`).catch(()=>null);if(r){const p=JSON.parse(r.value);setAllPicks(p);if(p[race.r])setPicks(p[race.r]);}}catch{}};
  const selRace=r=>{setRace(r);setSaved(false);setPicks(allPicks[r.r]||{});setTab("race");};
  const set=(k,v)=>{setPicks(p=>({...p,[k]:v}));setSaved(false);};
  const save=async()=>{
    if(!user)return openAuth("login");
    try{const u={...allPicks,[race.r]:picks};await window.storage.set(`pk:${user.email}`,JSON.stringify(u));setAllPicks(u);setSaved(true);setTimeout(()=>setSaved(false),3000);}catch{}
  };

  const SH=(label,pts,c="#E8002D")=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
      <div style={{fontSize:10,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)"}}>{label}</div>
      <span style={{fontSize:10,fontWeight:800,color:c,background:`${c}14`,border:`1px solid ${c}28`,borderRadius:10,padding:"2px 7px"}}>{pts} pts</span>
    </div>
  );

  const DriverPicker=({label,field,pts})=>(
    <div style={{marginBottom:20}}>
      {SH(label,pts)}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {DRV.map(d=>{const tm=TEAMS[d.t],sel=picks[field]===d.n;return(
          <button key={d.n} onClick={()=>set(field,sel?null:d.n)} style={{background:sel?tm.c:`${tm.c}18`,color:sel?tm.t:tm.c,border:`1px solid ${sel?tm.c:tm.c+"38"}`,borderRadius:7,padding:"5px 9px",cursor:"pointer",fontWeight:sel?800:500,fontSize:11,transition:"all 0.12s"}}>
            <span style={{opacity:0.55,fontSize:9}}>#{d.nb} </span>{d.s}
          </button>
        );})}
      </div>
      {picks[field]&&<div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,0.38)"}}>→ <span style={{color:"#fff",fontWeight:700}}>{picks[field]}</span></div>}
    </div>
  );

  const CtorPicker=()=>(
    <div style={{marginBottom:20}}>
      {SH("Constructor with Most Points",PTS.ctor,"#34D399")}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {CONSTRUCTORS.map(c=>{const tm=TEAMS[c],sel=picks.ctor===c;return(
          <button key={c} onClick={()=>set("ctor",sel?null:c)} style={{background:sel?tm.c:`${tm.c}18`,color:sel?tm.t:tm.c,border:`1px solid ${sel?tm.c:tm.c+"38"}`,borderRadius:7,padding:"6px 12px",cursor:"pointer",fontWeight:sel?800:500,fontSize:12,transition:"all 0.12s"}}>{c}</button>
        );})}
      </div>
    </div>
  );

  const YNPicker=({field,label,pts})=>(
    <div style={{marginBottom:20}}>
      {SH(label,pts,"#FBBF24")}
      <div style={{display:"flex",gap:8}}>
        {["Yes","No"].map(v=>{const sel=picks[field]===v,c=v==="Yes"?"#34D399":"#F87171";return(
          <button key={v} onClick={()=>set(field,sel?null:v)} style={{background:sel?`${c}16`:"rgba(255,255,255,0.04)",color:sel?c:"rgba(255,255,255,0.5)",border:`1px solid ${sel?c:"rgba(255,255,255,0.09)"}`,borderRadius:7,padding:"8px 28px",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all 0.12s"}}>{v}</button>
        );})}
      </div>
    </div>
  );

  const savedPicks=Object.keys(allPicks);
  const done=Object.values(picks).filter(Boolean).length;
  const color=rc(race);

  return(
    <div style={{maxWidth:1160,margin:"0 auto",padding:"52px 28px",display:"grid",gridTemplateColumns:"215px 1fr",gap:16,position:"relative",zIndex:1}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",marginBottom:9}}>Select Race</div>
        <div style={{borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)",maxHeight:"calc(100vh - 150px)",overflowY:"auto"}}>
          {CAL.map((r,i)=>{
            const isSaved=!!allPicks[r.r];
            return(
              <div key={r.r} onClick={()=>selRace(r)} style={{padding:"9px 11px",borderBottom:i<CAL.length-1?"1px solid rgba(255,255,255,0.05)":"none",cursor:"pointer",background:race.r===r.r?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.02)",display:"flex",alignItems:"center",gap:8,transition:"background 0.1s"}}>
                <div style={{width:3,alignSelf:"stretch",minHeight:16,borderRadius:1,background:rc(r),flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:race.r===r.r?"#fff":"rgba(255,255,255,0.55)"}}>{r.n}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.27)"}}>R{r.r} · {fmt(r.date)}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end",flexShrink:0}}>
                  {isSaved&&<span style={{fontSize:8,fontWeight:800,color:"#34D399",background:"rgba(52,211,153,0.14)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:4,padding:"1px 5px",letterSpacing:"0.04em"}}>SAVED</span>}
                  {r.sprint&&<span style={{fontSize:8,fontWeight:800,color:"#FF8700",background:"rgba(255,135,0,0.14)",border:"1px solid rgba(255,135,0,0.3)",borderRadius:4,padding:"1px 5px",letterSpacing:"0.04em"}}>SPRINT</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",backdropFilter:"blur(10px)"}}>
          <div style={{height:3,background:`linear-gradient(90deg,${color},${color}55)`}}/>
          <div style={{padding:"17px 22px",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
                <div style={{width:4,height:20,borderRadius:2,background:color,flexShrink:0}}/>
                <h2 style={{margin:0,fontWeight:900,fontSize:20,letterSpacing:-0.5}}>{race.n}</h2>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.38)",paddingLeft:14}}>{race.circuit} · {fmtFull(race.date)}</div>
              <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap",paddingLeft:14}}>
                <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:race.type==="Street"?"#FBBF24":"#34D399",padding:"2px 8px",borderRadius:10,background:race.type==="Street"?"rgba(251,191,36,0.09)":"rgba(52,211,153,0.09)",border:`1px solid ${race.type==="Street"?"rgba(251,191,36,0.22)":"rgba(52,211,153,0.22)"}`}}>{race.type}</span>
                {race.sprint&&<span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:"#FF8700",padding:"2px 8px",borderRadius:10,background:"rgba(255,135,0,0.09)",border:"1px solid rgba(255,135,0,0.22)"}}>Sprint</span>}
                {done>0&&<span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:"#A78BFA",padding:"2px 8px",borderRadius:10,background:"rgba(167,139,250,0.09)",border:"1px solid rgba(167,139,250,0.22)"}}>{done} picks</span>}
              </div>
            </div>
            {!user&&<div style={{padding:"10px 14px",borderRadius:9,border:"1px solid rgba(255,255,255,0.09)",background:"rgba(255,255,255,0.04)"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.38)",marginBottom:7}}>Login to save picks</div>
              <button style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:7,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,padding:"6px 14px"}} onClick={()=>openAuth("login")}>Login</button>
            </div>}
          </div>
          {race.sprint&&(
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(0,0,0,0.18)"}}>
              {[["race","Race"],["sprint","Sprint"]].map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t?color:"transparent"}`,cursor:"pointer",padding:"11px 18px",fontSize:13,fontWeight:tab===t?700:400,color:tab===t?"#fff":"rgba(255,255,255,0.38)"}}>{l}</button>
              ))}
            </div>
          )}
          <div style={{padding:"22px"}}>
            {(!race.sprint||tab==="race")?(
              <>
                <DriverPicker label="Pole Position" field="pole" pts={PTS.pole}/>
                <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"0 0 20px"}}/>
                <DriverPicker label="Race Winner" field="winner" pts={PTS.winner}/>
                <DriverPicker label="2nd Place" field="p2" pts={PTS.p2}/>
                <DriverPicker label="3rd Place" field="p3" pts={PTS.p3}/>
                {picks.winner&&picks.p2&&picks.p3&&(
                  <div style={{padding:"10px 13px",borderRadius:8,border:"1px solid rgba(167,139,250,0.22)",background:"rgba(167,139,250,0.05)",marginBottom:20,fontSize:12}}>
                    <span style={{fontWeight:800,color:"#A78BFA"}}>Perfect Podium Bonus +15 pts — </span>
                    <span style={{color:"rgba(255,255,255,0.45)"}}>{picks.winner} · {picks.p2} · {picks.p3} in exact order</span>
                  </div>
                )}
                <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"0 0 20px"}}/>
                <DriverPicker label="DNF Driver" field="dnf" pts={PTS.dnf}/>
                <DriverPicker label="Fastest Lap" field="fl" pts={PTS.fl}/>
                <DriverPicker label="Driver of the Day" field="dotd" pts={PTS.dotd}/>
                <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"0 0 20px"}}/>
                <CtorPicker/>
                <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"0 0 20px"}}/>
                <YNPicker field="sc" label="Safety Car?" pts={PTS.sc}/>
                <YNPicker field="rf" label="Red Flag?" pts={PTS.rf}/>
              </>
            ):(
              <>
                <div style={{padding:"7px 12px",borderRadius:7,border:"1px solid rgba(255,135,0,0.2)",background:"rgba(255,135,0,0.05)",marginBottom:20,fontSize:11,fontWeight:700,color:"#FF8700",letterSpacing:"0.06em",textTransform:"uppercase"}}>Sprint Race — Reduced Points</div>
                <DriverPicker label="Sprint Pole" field="sp_pole" pts={PTS.sp_pole}/>
                <DriverPicker label="Sprint Winner" field="sp_winner" pts={PTS.sp_winner}/>
                <DriverPicker label="Sprint 2nd" field="sp_p2" pts={PTS.sp_p2}/>
                <DriverPicker label="Sprint 3rd" field="sp_p3" pts={PTS.sp_p3}/>
              </>
            )}
            <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"0 0 17px"}}/>
            <button onClick={save} style={{background:saved?"linear-gradient(135deg,#10B981,#059669)":"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:9,color:"#fff",cursor:"pointer",fontWeight:700,width:"100%",padding:13,fontSize:14,transition:"background 0.2s"}}>
              {saved?"Predictions Saved!":"Save Predictions"}
            </button>
            <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:9}}>Locks when qualifying begins</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NEWS ───────────────────────────────────────────────────────────────────
function NewsPage(){
  const [articles,setArticles]=useState(FALLBACK_NEWS);
  const [loading,setLoading]=useState(false);
  const [sel,setSel]=useState(null);

  const fetchNews=async()=>{
    setLoading(true);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:1200,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:"Search for the 6 most recent Formula 1 news stories in 2026. Return ONLY a raw JSON array (no markdown, no code blocks, no backticks). Each object: id(1-6), title(string), summary(2 sentence string), fullBody(4-5 sentence paragraph), category(one of: Driver News, Team News, Technical, Season Preview, Race Results), date(string like 'Feb 2026'), tag(one short word)."}]
        })
      });
      const data=await res.json();
      const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const clean=text.replace(/```json|```/g,"").trim();
      const idx=clean.indexOf("[");
      if(idx>=0){const p=JSON.parse(clean.slice(idx));if(Array.isArray(p)&&p.length>0)setArticles(p);}
    }catch{}
    setLoading(false);
  };

  const featured=articles[0],rest=articles.slice(1);
  return(
    <div style={{maxWidth:1160,margin:"0 auto",padding:"52px 28px",position:"relative",zIndex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:30}}>
        <div>
          <h1 style={{fontSize:34,fontWeight:900,margin:"0 0 6px",letterSpacing:-1}}>F1 News</h1>
          <p style={{color:"rgba(255,255,255,0.38)",margin:0,fontSize:13}}>Latest from the 2026 paddock</p>
        </div>
        <button onClick={fetchNews} disabled={loading} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:20,color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:12,padding:"7px 15px",fontWeight:600}}>{loading?"Loading…":"Refresh"}</button>
      </div>
      {featured&&(
        <div onClick={()=>setSel(featured)} style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",cursor:"pointer",marginBottom:18,display:"grid",gridTemplateColumns:"1fr 0.6fr",backdropFilter:"blur(10px)"}}>
          <div style={{background:`linear-gradient(135deg,${CAT_COLORS[featured.category]||"#E8002D"}20,${CAT_COLORS[featured.category]||"#E8002D"}06)`,padding:"30px 28px"}}>
            <div style={{marginBottom:12}}>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:CAT_COLORS[featured.category]||"#E8002D",background:`${CAT_COLORS[featured.category]||"#E8002D"}16`,border:`1px solid ${CAT_COLORS[featured.category]||"#E8002D"}28`,borderRadius:10,padding:"2px 9px"}}>{featured.tag||featured.category}</span>
            </div>
            <h2 style={{margin:"0 0 11px",fontWeight:900,fontSize:22,lineHeight:1.22,letterSpacing:-0.5}}>{featured.title}</h2>
            <p style={{margin:"0 0 14px",color:"rgba(255,255,255,0.52)",fontSize:14,lineHeight:1.62}}>{featured.summary}</p>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.22)"}}>{featured.date}</div>
          </div>
          <div style={{background:`linear-gradient(135deg,${CAT_COLORS[featured.category]||"#E8002D"}14,transparent)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:68,opacity:0.1,color:CAT_COLORS[featured.category]||"#E8002D",fontWeight:900,letterSpacing:-3}}>{(featured.category||"F1").toUpperCase().slice(0,3)}</div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:13}}>
        {rest.map((a,i)=>(
          <div key={a.id||i} onClick={()=>setSel(a)} style={{borderRadius:11,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",cursor:"pointer",backdropFilter:"blur(10px)"}}>
            <div style={{height:2,background:CAT_COLORS[a.category]||"#E8002D"}}/>
            <div style={{padding:"17px 19px"}}>
              <div style={{marginBottom:9}}>
                <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:CAT_COLORS[a.category]||"#E8002D",background:`${CAT_COLORS[a.category]||"#E8002D"}14`,border:`1px solid ${CAT_COLORS[a.category]||"#E8002D"}28`,borderRadius:10,padding:"2px 7px"}}>{a.tag||a.category}</span>
              </div>
              <h3 style={{margin:"0 0 8px",fontWeight:800,fontSize:14,lineHeight:1.32}}>{a.title}</h3>
              <p style={{margin:"0 0 13px",color:"rgba(255,255,255,0.42)",fontSize:12,lineHeight:1.58}}>{a.summary}</p>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,0.2)"}}>
                <span>{a.date}</span>
                <span style={{color:CAT_COLORS[a.category]||"#E8002D",fontWeight:700}}>Read →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {sel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setSel(null)}>
          <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.11)",background:"rgba(10,10,26,0.97)",maxWidth:560,width:"100%",backdropFilter:"blur(20px)"}} onClick={e=>e.stopPropagation()}>
            <div style={{height:3,background:CAT_COLORS[sel.category]||"#E8002D"}}/>
            <div style={{padding:"26px 28px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:15}}>
                <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:CAT_COLORS[sel.category]||"#E8002D",background:`${CAT_COLORS[sel.category]||"#E8002D"}14`,border:`1px solid ${CAT_COLORS[sel.category]||"#E8002D"}28`,borderRadius:10,padding:"2px 9px"}}>{sel.tag||sel.category}</span>
                <button onClick={()=>setSel(null)} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:6,color:"rgba(255,255,255,0.38)",cursor:"pointer",width:26,height:26,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
              <h2 style={{margin:"0 0 11px",fontWeight:900,fontSize:20,lineHeight:1.2,letterSpacing:-0.5}}>{sel.title}</h2>
              <p style={{color:"rgba(255,255,255,0.65)",lineHeight:1.75,margin:"0 0 13px",fontSize:14}}>{sel.fullBody||sel.summary}</p>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>{sel.date}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMMUNITY ──────────────────────────────────────────────────────────────
function CommunityPage({user,openAuth}){
  const [tab,setTab]=useState("leaderboard");
  const [posts,setPosts]=useState(INIT_POSTS);
  const [comments,setComments]=useState(SEED_COMMENTS);
  const [leagues,setLeagues]=useState([]);
  const [expanded,setExpanded]=useState(null);
  const [viewLeague,setViewLeague]=useState(null);
  const [np,setNp]=useState({title:"",body:""});
  const [nlg,setNlg]=useState("");
  const [jc,setJc]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [replyText,setReplyText]=useState({});
  const [liked,setLiked]=useState({});

  useEffect(()=>{loadLeagues();},[user]);
  const loadLeagues=async()=>{if(!user)return;try{const r=await window.storage.get(`lg:${user.email}`).catch(()=>null);if(r)setLeagues(JSON.parse(r.value));}catch{}};
  const saveLg=async(list)=>{if(user){setLeagues(list);await window.storage.set(`lg:${user.email}`,JSON.stringify(list)).catch(()=>{}); }};

  const createLeague=async()=>{
    if(!nlg.trim()||!user)return;
    const code=Math.random().toString(36).slice(2,8).toUpperCase();
    const lg={name:nlg,code,members:[{name:user.name,pts:user.pts||0,role:"owner"}],owner:user.name,createdAt:new Date().toISOString()};
    const updated=[...leagues,lg];
    await saveLg(updated);
    try{await window.storage.set(`league:${code}`,JSON.stringify(lg),true);}catch{}
    setNlg("");
  };

  const joinLeague=async()=>{
    if(!jc.trim()||!user)return;
    try{
      const r=await window.storage.get(`league:${jc.toUpperCase()}`).catch(()=>null);
      if(!r){alert("League not found.");return;}
      const lg=JSON.parse(r.value);
      if(leagues.find(l=>l.code===lg.code)){alert("Already in this league.");return;}
      // Add user to league shared data
      const updatedLg={...lg,members:[...lg.members,{name:user.name,pts:user.pts||0,role:"member"}]};
      try{await window.storage.set(`league:${lg.code}`,JSON.stringify(updatedLg),true);}catch{}
      await saveLg([...leagues,updatedLg]);
      setJc("");
    }catch{alert("Invalid code.");}
  };

  const leaveLeague=async(code)=>{
    if(!user||!window.confirm("Leave this league?"))return;
    const updated=leagues.filter(l=>l.code!==code);
    await saveLg(updated);
    if(viewLeague?.code===code)setViewLeague(null);
  };

  const deleteLeague=async(code)=>{
    if(!user||!window.confirm("Delete this league permanently?"))return;
    const updated=leagues.filter(l=>l.code!==code);
    await saveLg(updated);
    try{await window.storage.delete(`league:${code}`,true);}catch{}
    if(viewLeague?.code===code)setViewLeague(null);
  };

  const refreshLeague=async(code)=>{
    try{
      const r=await window.storage.get(`league:${code}`).catch(()=>null);
      if(r){
        const fresh=JSON.parse(r.value);
        const updated=leagues.map(l=>l.code===code?fresh:l);
        await saveLg(updated);
        setViewLeague(fresh);
      }
    }catch{}
  };

  const submitPost=()=>{
    if(!np.title.trim()||!np.body.trim()||!user)return;
    const id=Date.now();
    setPosts(p=>[{id,author:user.name,time:"Just now",...np,likes:0,replies:0},...p]);
    setComments(c=>({...c,[id]:[]}));
    setNp({title:"",body:""});setShowForm(false);
  };

  const likePost=(id)=>{
    if(!user)return openAuth("login");
    if(liked[`p_${id}`])return;
    setPosts(ps=>ps.map(p=>p.id===id?{...p,likes:p.likes+1}:p));
    setLiked(l=>({...l,[`p_${id}`]:true}));
  };

  const likeComment=(postId,cid)=>{
    if(!user)return openAuth("login");
    if(liked[`c_${cid}`])return;
    setComments(cs=>({...cs,[postId]:cs[postId].map(c=>c.id===cid?{...c,likes:c.likes+1}:c)}));
    setLiked(l=>({...l,[`c_${cid}`]:true}));
  };

  const submitReply=(postId)=>{
    if(!user||!replyText[postId]?.trim())return;
    const newC={id:Date.now(),author:user.name,time:"Just now",text:replyText[postId],likes:0};
    setComments(cs=>({...cs,[postId]:[...(cs[postId]||[]),newC]}));
    setPosts(ps=>ps.map(p=>p.id===postId?{...p,replies:p.replies+1}:p));
    setReplyText(r=>({...r,[postId]:""}));
  };

  const inp={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#fff",padding:"10px 13px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"};

  // League detail modal
  const LeagueModal=({lg,onClose})=>{
    const isOwner=user&&lg.owner===user.name;
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
        <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.11)",background:"rgba(10,10,26,0.97)",width:460,backdropFilter:"blur(20px)"}} onClick={e=>e.stopPropagation()}>
          <div style={{height:3,background:"linear-gradient(90deg,#E8002D,#FF6B35)"}}/>
          <div style={{padding:"22px 24px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h2 style={{margin:"0 0 4px",fontWeight:900,fontSize:20}}>{lg.name}</h2>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Owner: {lg.owner} · Created {lg.createdAt?new Date(lg.createdAt).toLocaleDateString("en-GB",{month:"short",year:"numeric"}):"2026"}</div>
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontFamily:"monospace",fontWeight:900,fontSize:20,letterSpacing:4,color:"#E8002D"}}>{lg.code}</div>
                <button onClick={()=>navigator.clipboard?.writeText(lg.code)} style={{background:"rgba(232,0,45,0.1)",border:"1px solid rgba(232,0,45,0.25)",borderRadius:6,color:"#E8002D",cursor:"pointer",fontSize:10,fontWeight:700,padding:"3px 8px"}}>COPY</button>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,color:"rgba(255,255,255,0.4)",cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>✕</button>
          </div>
          {/* Members */}
          <div style={{padding:"16px 24px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",marginBottom:12}}>Members ({lg.members.length})</div>
            {lg.members.map((m,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<lg.members.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,#E8002D,#FF6B35)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0}}>{m.name.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1}}>
                  <span style={{fontSize:13,fontWeight:700}}>{m.name}</span>
                  {m.role==="owner"&&<span style={{marginLeft:7,fontSize:9,fontWeight:800,color:"#FBBF24",background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.22)",borderRadius:8,padding:"1px 6px",textTransform:"uppercase"}}>Owner</span>}
                </div>
                <div style={{fontSize:13,fontWeight:800,color:"rgba(255,255,255,0.75)"}}>{m.pts||0} pts</div>
              </div>
            ))}
          </div>
          <div style={{padding:"14px 24px",display:"flex",gap:8}}>
            <button onClick={()=>refreshLeague(lg.code)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:12,fontWeight:600,padding:"8px 14px",flex:1}}>Refresh Members</button>
            {isOwner
              ?<button onClick={()=>deleteLeague(lg.code)} style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.28)",borderRadius:7,color:"#F87171",cursor:"pointer",fontSize:12,fontWeight:700,padding:"8px 14px",flex:1}}>Delete League</button>
              :<button onClick={()=>leaveLeague(lg.code)} style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.28)",borderRadius:7,color:"#F87171",cursor:"pointer",fontSize:12,fontWeight:700,padding:"8px 14px",flex:1}}>Leave League</button>
            }
          </div>
        </div>
      </div>
    );
  };

  return(
    <div style={{maxWidth:1160,margin:"0 auto",padding:"52px 28px",position:"relative",zIndex:1}}>
      {viewLeague&&<LeagueModal lg={viewLeague} onClose={()=>setViewLeague(null)}/>}
      <div style={{marginBottom:26}}>
        <h1 style={{fontSize:34,fontWeight:900,margin:"0 0 6px",letterSpacing:-1}}>Community</h1>
        <p style={{color:"rgba(255,255,255,0.38)",margin:0,fontSize:13}}>Compete globally, build private leagues, and discuss every race</p>
      </div>
      <div style={{display:"flex",gap:1,marginBottom:22,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        {[["leaderboard","Leaderboard"],["leagues","Leagues"],["forum","Forum"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t?"#E8002D":"transparent"}`,cursor:"pointer",padding:"11px 18px",fontSize:13,fontWeight:tab===t?700:400,color:tab===t?"#fff":"rgba(255,255,255,0.38)",marginBottom:-1,transition:"color 0.15s"}}>{l}</button>
        ))}
      </div>

      {tab==="leaderboard"&&(
        <div style={{borderRadius:11,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{display:"grid",gridTemplateColumns:"50px 1fr 70px 100px 80px",background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            {["#","Player","Country","Picks","Points"].map((h,i)=>(
              <div key={h} style={{padding:"10px 14px",fontSize:9,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.22)",borderRight:i<4?"1px solid rgba(255,255,255,0.05)":"none",textAlign:i>=2?"center":"left"}}>{h}</div>
            ))}
          </div>
          {MOCK_LB.map((p,i)=>(
            <div key={p.name} style={{display:"grid",gridTemplateColumns:"50px 1fr 70px 100px 80px",borderBottom:i<MOCK_LB.length-1?"1px solid rgba(255,255,255,0.05)":"none",background:i===0?"rgba(232,0,45,0.05)":i%2===0?"rgba(255,255,255,0.02)":"transparent"}}>
              <div style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?14:11,fontWeight:900,color:i===0?"#E8002D":i===1?"#9CA3AF":i===2?"#B87333":"rgba(255,255,255,0.15)",borderRight:"1px solid rgba(255,255,255,0.05)"}}>{i+1}</div>
              <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderRight:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,#E8002D,#FF6B35)`,opacity:0.6+i*0.04,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",flexShrink:0}}>{p.name.slice(0,2).toUpperCase()}</div>
                <span style={{fontSize:13,fontWeight:700}}>{p.name}</span>
              </div>
              <div style={{padding:"12px 14px",fontSize:12,color:"rgba(255,255,255,0.32)",textAlign:"center",borderRight:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.country}</div>
              <div style={{padding:"12px 14px",fontSize:12,color:"rgba(255,255,255,0.32)",textAlign:"center",borderRight:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.preds}</div>
              <div style={{padding:"12px 14px",fontSize:15,fontWeight:900,textAlign:"center",color:i===0?"#E8002D":"rgba(255,255,255,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.pts}</div>
            </div>
          ))}
        </div>
      )}

      {tab==="leagues"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:22}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",marginBottom:11}}>Create a League</div>
            <div style={{borderRadius:11,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:18,marginBottom:18,backdropFilter:"blur(10px)"}}>
              <input style={{...inp,marginBottom:11}} placeholder="League name..." value={nlg} onChange={e=>setNlg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(user?createLeague():openAuth("login"))}/>
              <button style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontWeight:700,width:"100%",padding:11,fontSize:13}} onClick={user?createLeague:()=>openAuth("login")}>{user?"Create League":"Login to Create"}</button>
            </div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",marginBottom:11}}>Join with Code</div>
            <div style={{borderRadius:11,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:18,backdropFilter:"blur(10px)"}}>
              <input style={{...inp,marginBottom:11,fontFamily:"monospace",fontSize:20,textTransform:"uppercase",letterSpacing:6,textAlign:"center"}} placeholder="XXXXXX" value={jc} onChange={e=>setJc(e.target.value.toUpperCase())} maxLength={6} onKeyDown={e=>e.key==="Enter"&&(user?joinLeague():openAuth("login"))}/>
              <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#fff",cursor:"pointer",fontWeight:700,width:"100%",padding:11,fontSize:13}} onClick={user?joinLeague:()=>openAuth("login")}>{user?"Join League":"Login to Join"}</button>
            </div>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",marginBottom:11}}>Your Leagues {leagues.length>0&&`(${leagues.length})`}</div>
            {leagues.length===0
              ?<div style={{borderRadius:11,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:32,textAlign:"center",color:"rgba(255,255,255,0.22)",fontSize:13,backdropFilter:"blur(10px)"}}>Create or join a league to compete with friends</div>
              :<div style={{display:"flex",flexDirection:"column",gap:9}}>
                {leagues.map(l=>{
                  const isOwner=user&&l.owner===user.name;
                  return(
                    <div key={l.code} style={{borderRadius:11,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",padding:16,backdropFilter:"blur(10px)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:800,marginBottom:3}}>{l.name}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>
                            {isOwner?"You own this league":"Member"} · {l.members.length} member{l.members.length!==1?"s":""}
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:18,letterSpacing:3,color:"#E8002D"}}>{l.code}</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:"0.05em"}}>invite code</div>
                        </div>
                      </div>
                      {/* Member preview */}
                      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
                        {l.members.slice(0,5).map((m,i)=>(
                          <div key={i} title={m.name} style={{width:26,height:26,borderRadius:6,background:"linear-gradient(135deg,rgba(232,0,45,0.4),rgba(255,107,53,0.4))",border:"1px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff"}}>{m.name.slice(0,2).toUpperCase()}</div>
                        ))}
                        {l.members.length>5&&<div style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,0.5)"}}>+{l.members.length-5}</div>}
                      </div>
                      <div style={{display:"flex",gap:7}}>
                        <button onClick={()=>setViewLeague(l)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,color:"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:12,fontWeight:600,padding:"7px 0",flex:1}}>View League</button>
                        {isOwner
                          ?<button onClick={()=>deleteLeague(l.code)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:7,color:"#F87171",cursor:"pointer",fontSize:12,fontWeight:600,padding:"7px 0",flex:1}}>Delete</button>
                          :<button onClick={()=>leaveLeague(l.code)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:7,color:"#F87171",cursor:"pointer",fontSize:12,fontWeight:600,padding:"7px 0",flex:1}}>Leave</button>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        </div>
      )}

      {tab==="forum"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.28)"}}>{posts.length} discussions</div>
            {user
              ?<button style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:20,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,padding:"7px 15px"}} onClick={()=>setShowForm(!showForm)}>{showForm?"Cancel":"+ New Post"}</button>
              :<button style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:12,fontWeight:600,padding:"7px 15px"}} onClick={()=>openAuth("login")}>Login to Post</button>
            }
          </div>
          {showForm&&(
            <div style={{borderRadius:11,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",padding:18,marginBottom:14,backdropFilter:"blur(10px)"}}>
              <input style={{...inp,marginBottom:10}} placeholder="Post title..." value={np.title} onChange={e=>setNp(p=>({...p,title:e.target.value}))}/>
              <textarea style={{...inp,height:80,resize:"vertical",marginBottom:10}} placeholder="Share your thoughts..." value={np.body} onChange={e=>setNp(p=>({...p,body:e.target.value}))}/>
              <button style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,padding:"9px 20px"}} onClick={submitPost}>Post</button>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {posts.map(p=>{
              const isOpen=expanded===p.id;
              const postComments=comments[p.id]||[];
              return(
                <div key={p.id} style={{borderRadius:11,border:`1px solid ${isOpen?"rgba(232,0,45,0.28)":"rgba(255,255,255,0.07)"}`,background:isOpen?"rgba(232,0,45,0.035)":"rgba(255,255,255,0.03)",overflow:"hidden",backdropFilter:"blur(10px)",transition:"border-color 0.15s"}}>
                  <div style={{padding:"15px 19px",cursor:"pointer"}} onClick={()=>setExpanded(isOpen?null:p.id)}>
                    <div style={{display:"flex",gap:11,alignItems:"flex-start"}}>
                      <div style={{width:35,height:35,borderRadius:8,background:"linear-gradient(135deg,#E8002D,#FF6B35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0}}>{p.author.slice(0,2).toUpperCase()}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontSize:13,fontWeight:700}}>{p.author}</span>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.28)"}}>{p.time}</span>
                          </div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",transition:"transform 0.2s",transform:isOpen?"rotate(180deg)":"none"}}>▾</div>
                        </div>
                        <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{p.title}</div>
                        <p style={{margin:"0 0 9px",fontSize:13,color:"rgba(255,255,255,0.47)",lineHeight:1.53}}>{p.body}</p>
                        <div style={{display:"flex",gap:11,alignItems:"center"}}>
                          <button onClick={e=>{e.stopPropagation();likePost(p.id);}} style={{background:liked[`p_${p.id}`]?"rgba(232,0,45,0.14)":"rgba(255,255,255,0.04)",border:`1px solid ${liked[`p_${p.id}`]?"rgba(232,0,45,0.38)":"rgba(255,255,255,0.08)"}`,borderRadius:20,color:liked[`p_${p.id}`]?"#E8002D":"rgba(255,255,255,0.33)",cursor:"pointer",fontSize:11,padding:"3px 10px",fontWeight:600,transition:"all 0.12s"}}>♥ {p.likes}</button>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.22)"}}>{postComments.length} comment{postComments.length!==1?"s":""}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {isOpen&&(
                    <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.18)"}}>
                      {postComments.length>0&&(
                        <div style={{padding:"12px 19px 0"}}>
                          {postComments.map((c,ci)=>(
                            <div key={c.id} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:ci<postComments.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                              <div style={{width:27,height:27,borderRadius:6,background:"rgba(99,102,241,0.28)",border:"1px solid rgba(99,102,241,0.38)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#A5B4FC",flexShrink:0}}>{c.author.slice(0,2).toUpperCase()}</div>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:3}}>
                                  <span style={{fontSize:12,fontWeight:700}}>{c.author}</span>
                                  <span style={{fontSize:10,color:"rgba(255,255,255,0.22)"}}>{c.time}</span>
                                </div>
                                <p style={{margin:"0 0 5px",fontSize:12,color:"rgba(255,255,255,0.57)",lineHeight:1.5}}>{c.text}</p>
                                <button onClick={()=>likeComment(p.id,c.id)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:10,color:liked[`c_${c.id}`]?"#E8002D":"rgba(255,255,255,0.22)",padding:0,fontWeight:600}}>♥ {c.likes}</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{padding:"11px 19px 14px",display:"flex",gap:8,alignItems:"center"}}>
                        {user?(
                          <>
                            <input style={{...inp,padding:"8px 12px",fontSize:12,flex:1}} placeholder={`Reply to ${p.author}...`} value={replyText[p.id]||""} onChange={e=>setReplyText(r=>({...r,[p.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitReply(p.id)}/>
                            <button onClick={()=>submitReply(p.id)} style={{background:"linear-gradient(135deg,#E8002D,#FF6B35)",border:"none",borderRadius:7,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12,padding:"8px 13px",flexShrink:0,whiteSpace:"nowrap"}}>Reply</button>
                          </>
                        ):(
                          <div style={{fontSize:12,color:"rgba(255,255,255,0.28)",padding:"3px 0"}}>
                            <span style={{color:"#E8002D",cursor:"pointer",fontWeight:700}} onClick={()=>openAuth("login")}>Login</span> to join the discussion
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────
export default function ApexFantasy(){
  const [page,setPage]=useState("home");
  const [user,setUser]=useState(null);
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  useEffect(()=>{(async()=>{try{const r=await window.storage.get("cu").catch(()=>null);if(r)setUser(JSON.parse(r.value));}catch{}})();},[]);
  const openAuth=m=>{setAuthMode(m||"login");setAuthOpen(true);};
  const logout=async()=>{try{await window.storage.delete("cu");}catch{}setUser(null);};
  return(
    <div style={{background:"#08081A",minHeight:"100vh",color:"#fff",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(232,0,45,0.28);border-radius:2px;}input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.16);}button:hover{opacity:0.84;}textarea{font-family:inherit;}`}</style>
      <BgCanvas/>
      <div style={{position:"relative",zIndex:1}}>
        <Navbar page={page} setPage={setPage} user={user} openAuth={openAuth} onLogout={logout}/>
        {authOpen&&<AuthModal mode={authMode} setMode={setAuthMode} onClose={()=>setAuthOpen(false)} onAuth={u=>{setUser(u);setAuthOpen(false);}}/>}
        {page==="home"&&<HomePage user={user} setPage={setPage} openAuth={openAuth}/>}
        {page==="calendar"&&<CalendarPage/>}
        {page==="predictions"&&<PredictionsPage user={user} openAuth={openAuth}/>}
        {page==="news"&&<NewsPage/>}
        {page==="community"&&<CommunityPage user={user} openAuth={openAuth}/>}
      </div>
    </div>
  );
}