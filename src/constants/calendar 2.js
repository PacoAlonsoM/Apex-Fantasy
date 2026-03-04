export const FLAG = {
  "Australia": "#FFCD00", "China": "#DE2910", "Japan": "#BC002D",
  "Bahrain": "#CE1126", "Saudi Arabia": "#006C35", "USA-Miami": "#3C3B6E",
  "Canada": "#FF0000", "Monaco": "#A8062E", "Spain-BCN": "#F1BF00",
  "Austria": "#ED2939", "UK": "#012169", "Belgium": "#FDDA24",
  "Hungary": "#47704F", "Netherlands": "#FF6600", "Italy": "#009246",
  "Spain-MAD": "#AA151B", "Azerbaijan": "#0092BC", "Singapore": "#EF3340",
  "USA-TX": "#B22234", "Mexico": "#006847", "Brazil": "#FFDF00",
  "USA-LV": "#5E17EB", "Qatar": "#8D1B3D", "UAE": "#00732F",
};

export const CAL = [
  { r:1, n:"Australian GP", circuit:"Albert Park Circuit", city:"Melbourne", cc:"Australia", date:"2026-03-08", type:"Permanent", len:5.278, laps:58, rec:"1:20.235", recBy:"C. Leclerc", recY:2022, drs:4, sprint:false, turns:16, elev:0, flagKey:"Australia" },
  { r:2, n:"Chinese GP", circuit:"Shanghai International Circuit", city:"Shanghai", cc:"China", date:"2026-03-15", type:"Permanent", len:5.451, laps:56, rec:"1:32.238", recBy:"M. Schumacher", recY:2004, drs:2, sprint:true, turns:16, elev:7, flagKey:"China" },
  { r:3, n:"Japanese GP", circuit:"Suzuka International Course", city:"Suzuka", cc:"Japan", date:"2026-03-29", type:"Permanent", len:5.807, laps:53, rec:"1:30.983", recBy:"V. Bottas", recY:2019, drs:2, sprint:false, turns:18, elev:42, flagKey:"Japan" },
  { r:4, n:"Bahrain GP", circuit:"Bahrain International Circuit", city:"Sakhir", cc:"Bahrain", date:"2026-04-12", type:"Permanent", len:5.412, laps:57, rec:"1:31.447", recBy:"P. de la Rosa", recY:2005, drs:3, sprint:false, turns:15, elev:10, flagKey:"Bahrain" },
  { r:5, n:"Saudi Arabian GP", circuit:"Jeddah Corniche Circuit", city:"Jeddah", cc:"Saudi Arabia", date:"2026-04-19", type:"Street", len:6.174, laps:50, rec:"1:30.734", recBy:"L. Hamilton", recY:2021, drs:3, sprint:false, turns:27, elev:5, flagKey:"Saudi Arabia" },
  { r:6, n:"Miami GP", circuit:"Miami International Autodrome", city:"Miami", cc:"USA", date:"2026-05-03", type:"Street", len:5.412, laps:57, rec:"1:29.708", recBy:"M. Verstappen", recY:2023, drs:3, sprint:true, turns:19, elev:0, flagKey:"USA-Miami" },
  { r:7, n:"Canadian GP", circuit:"Circuit Gilles Villeneuve", city:"Montreal", cc:"Canada", date:"2026-05-24", type:"Street", len:4.361, laps:70, rec:"1:13.078", recBy:"V. Bottas", recY:2019, drs:3, sprint:true, turns:14, elev:3, flagKey:"Canada" },
  { r:8, n:"Monaco GP", circuit:"Circuit de Monaco", city:"Monte Carlo", cc:"Monaco", date:"2026-06-07", type:"Street", len:3.337, laps:78, rec:"1:12.909", recBy:"L. Norris", recY:2024, drs:1, sprint:false, turns:19, elev:42, flagKey:"Monaco" },
  { r:9, n:"Spanish GP", circuit:"Circuit de Barcelona-Catalunya", city:"Barcelona", cc:"Spain", date:"2026-06-14", type:"Permanent", len:4.657, laps:66, rec:"1:16.330", recBy:"M. Verstappen", recY:2023, drs:2, sprint:false, turns:14, elev:29, flagKey:"Spain-BCN" },
  { r:10, n:"Austrian GP", circuit:"Red Bull Ring", city:"Spielberg", cc:"Austria", date:"2026-06-28", type:"Permanent", len:4.318, laps:71, rec:"1:05.619", recBy:"C. Sainz", recY:2020, drs:3, sprint:false, turns:10, elev:65, flagKey:"Austria" },
  { r:11, n:"British GP", circuit:"Silverstone Circuit", city:"Silverstone", cc:"United Kingdom", date:"2026-07-05", type:"Permanent", len:5.891, laps:52, rec:"1:27.097", recBy:"M. Verstappen", recY:2020, drs:2, sprint:true, turns:18, elev:14, flagKey:"UK" },
  { r:12, n:"Belgian GP", circuit:"Circuit de Spa-Francorchamps", city:"Spa", cc:"Belgium", date:"2026-07-19", type:"Permanent", len:7.004, laps:44, rec:"1:46.286", recBy:"V. Bottas", recY:2018, drs:2, sprint:false, turns:19, elev:104, flagKey:"Belgium" },
  { r:13, n:"Hungarian GP", circuit:"Hungaroring", city:"Budapest", cc:"Hungary", date:"2026-07-26", type:"Permanent", len:4.381, laps:70, rec:"1:16.627", recBy:"L. Hamilton", recY:2020, drs:2, sprint:false, turns:14, elev:38, flagKey:"Hungary" },
  { r:14, n:"Dutch GP", circuit:"Circuit Zandvoort", city:"Zandvoort", cc:"Netherlands", date:"2026-08-23", type:"Permanent", len:4.259, laps:72, rec:"1:11.097", recBy:"M. Verstappen", recY:2023, drs:2, sprint:true, turns:14, elev:17, flagKey:"Netherlands" },
  { r:15, n:"Italian GP", circuit:"Autodromo Nazionale Monza", city:"Monza", cc:"Italy", date:"2026-09-06", type:"Permanent", len:5.793, laps:53, rec:"1:21.046", recBy:"R. Barrichello", recY:2004, drs:2, sprint:false, turns:11, elev:14, flagKey:"Italy" },
  { r:16, n:"Madrid GP", circuit:"Ifema Madrid Circuit", city:"Madrid", cc:"Spain", date:"2026-09-13", type:"Street", len:5.474, laps:55, rec:"—", recBy:"New Circuit", recY:2026, drs:3, sprint:false, turns:20, elev:8, flagKey:"Spain-MAD" },
  { r:17, n:"Azerbaijan GP", circuit:"Baku City Circuit", city:"Baku", cc:"Azerbaijan", date:"2026-09-26", type:"Street", len:6.003, laps:51, rec:"1:43.009", recBy:"C. Leclerc", recY:2019, drs:2, sprint:false, turns:20, elev:26, flagKey:"Azerbaijan" },
  { r:18, n:"Singapore GP", circuit:"Marina Bay Street Circuit", city:"Singapore", cc:"Singapore", date:"2026-10-11", type:"Street", len:4.940, laps:62, rec:"1:35.867", recBy:"L. Hamilton", recY:2023, drs:3, sprint:true, turns:19, elev:5, flagKey:"Singapore" },
  { r:19, n:"US GP", circuit:"Circuit of the Americas", city:"Austin", cc:"USA", date:"2026-10-25", type:"Permanent", len:5.513, laps:56, rec:"1:36.169", recBy:"C. Leclerc", recY:2019, drs:2, sprint:false, turns:20, elev:41, flagKey:"USA-TX" },
  { r:20, n:"Mexico City GP", circuit:"Autodromo Hermanos Rodriguez", city:"Mexico City", cc:"Mexico", date:"2026-11-01", type:"Permanent", len:4.304, laps:71, rec:"1:17.774", recBy:"V. Bottas", recY:2021, drs:3, sprint:false, turns:17, elev:2240, flagKey:"Mexico" },
  { r:21, n:"Sao Paulo GP", circuit:"Autodromo Jose Carlos Pace", city:"Sao Paulo", cc:"Brazil", date:"2026-11-08", type:"Permanent", len:4.309, laps:71, rec:"1:10.540", recBy:"V. Bottas", recY:2018, drs:2, sprint:false, turns:15, elev:16, flagKey:"Brazil" },
  { r:22, n:"Las Vegas GP", circuit:"Las Vegas Strip Circuit", city:"Las Vegas", cc:"USA", date:"2026-11-21", type:"Street", len:6.201, laps:50, rec:"1:35.490", recBy:"O. Piastri", recY:2024, drs:3, sprint:false, turns:17, elev:0, flagKey:"USA-LV" },
  { r:23, n:"Qatar GP", circuit:"Lusail International Circuit", city:"Lusail", cc:"Qatar", date:"2026-11-29", type:"Permanent", len:5.419, laps:57, rec:"1:24.319", recBy:"M. Verstappen", recY:2023, drs:2, sprint:false, turns:16, elev:8, flagKey:"Qatar" },
  { r:24, n:"Abu Dhabi GP", circuit:"Yas Marina Circuit", city:"Abu Dhabi", cc:"UAE", date:"2026-12-06", type:"Permanent", len:5.281, laps:58, rec:"1:26.103", recBy:"M. Verstappen", recY:2021, drs:2, sprint:false, turns:16, elev:3, flagKey:"UAE" },
];

export const rc = r => FLAG[r.flagKey] || "#6366F1";
export const nextRace = () => CAL.find(r => new Date(r.date) >= new Date()) || CAL[CAL.length - 1];
export const fmt = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const fmtFull = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
export const countdown = s => {
  const diff = new Date(s) - new Date();
  if (diff < 0) return null;
  return { d: Math.floor(diff / 86400000), h: Math.floor(diff % 86400000 / 3600000), m: Math.floor(diff % 3600000 / 60000) };
};