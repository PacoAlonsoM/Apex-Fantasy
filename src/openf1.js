const BASE = "https://api.openf1.org/v1";

// Busca la session_key de una carrera específica por año y número de ronda
export async function getSessionKey(year, round) {
  try {
    const res = await fetch(`${BASE}/meetings?year=${year}`);
    const meetings = await res.json();
    const meeting = meetings[round - 1];
    if (!meeting) return null;

    const sRes = await fetch(`${BASE}/sessions?meeting_key=${meeting.meeting_key}&session_name=Race`);
    const sessions = await sRes.json();
    if (!sessions.length) return null;
    return sessions[0].session_key;
  } catch (e) {
    console.error("getSessionKey error:", e);
    return null;
  }
}

// Trae los resultados finales de una carrera
export async function getRaceResults(sessionKey) {
  try {
    const res = await fetch(`${BASE}/session_result?session_key=${sessionKey}`);
    const data = await res.json();
    return data.sort((a, b) => (a.position || 99) - (b.position || 99));
  } catch (e) {
    console.error("getRaceResults error:", e);
    return [];
  }
}

// Trae mensajes de race control (safety car, red flag)
export async function getRaceControl(sessionKey) {
  try {
    const res = await fetch(`${BASE}/race_control?session_key=${sessionKey}`);
    return await res.json();
  } catch (e) {
    console.error("getRaceControl error:", e);
    return [];
  }
}

// Trae el fastest lap de la carrera
export async function getFastestLap(sessionKey) {
  try {
    const res = await fetch(`${BASE}/laps?session_key=${sessionKey}&is_pit_out_lap=false`);
    const laps = await res.json();
    if (!laps.length) return null;
    const fastest = laps.reduce((min, l) => 
      l.lap_duration && (!min || l.lap_duration < min.lap_duration) ? l : min, null
    );
    return fastest;
  } catch (e) {
    console.error("getFastestLap error:", e);
    return null;
  }
}

// Trae los drivers de una sesión (para mapear número → nombre)
export async function getDrivers(sessionKey) {
  try {
    const res = await fetch(`${BASE}/drivers?session_key=${sessionKey}`);
    return await res.json();
  } catch (e) {
    console.error("getDrivers error:", e);
    return [];
  }
}

// Función principal: trae todos los datos de una carrera y los formatea
export async function fetchRaceData(year, round) {
  const sessionKey = await getSessionKey(year, round);
  if (!sessionKey) return null;

  const [results, raceControl, drivers] = await Promise.all([
    getRaceResults(sessionKey),
    getRaceControl(sessionKey),
    getDrivers(sessionKey),
  ]);

  // Mapa número de driver → nombre completo
  const driverMap = {};
  drivers.forEach(d => {
    driverMap[d.driver_number] = d.full_name;
  });

  // Resultados ordenados por posición
  const sorted = results
    .filter(r => r.position)
    .sort((a, b) => a.position - b.position);

  const winner = driverMap[sorted[0]?.driver_number] || null;
  const p2 = driverMap[sorted[1]?.driver_number] || null;
  const p3 = driverMap[sorted[2]?.driver_number] || null;

  // DNF = clasificados en posición mayor a los finishers normales o con status de abandono
  const dnf = results.find(r => r.position === null || r.classified_position === null);
  const dnfName = dnf ? driverMap[dnf.driver_number] : null;

  // Safety car y red flag desde race control
  const safetyCar = raceControl.some(m =>
    m.category === "SafetyCar" && (m.flag === "YELLOW" || m.message?.includes("SAFETY CAR"))
  );
  const redFlag = raceControl.some(m =>
    m.flag === "RED" || m.message?.includes("RED FLAG")
  );

  // Fastest lap
  const flData = await getFastestLap(sessionKey);
  const fastestLap = flData ? driverMap[flData.driver_number] : null;

  return {
    winner,
    p2,
    p3,
    dnf: dnfName,
    fastest_lap: fastestLap,
    safety_car: safetyCar,
    red_flag: redFlag,
    raw_results: sorted.map(r => ({
      position: r.position,
      driver: driverMap[r.driver_number],
      driver_number: r.driver_number,
    }))
  };
}