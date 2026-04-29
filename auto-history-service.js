// ================= SERVIÇO DE HISTÓRICO =================
// Debounce por máquina + por campo (10s) e registros parciais seguros.
(function() {
  "use strict";
  const DEBOUNCE_MS = 10000;
  const FIELDS = ["molde", "blank", "neck_ring", "funil"];
  const HOURLY_CHECK_INTERVAL = 60000;
  const SAFETY_POLL_INTERVAL = 10000;
  let lastConfirmedValues = {};
  let pendingTimers = {};
  let pendingTargets = {};
  let lastHourlyRecord = {};
  let isRunning = false;

  const checkFirebase = setInterval(() => {
    if (typeof maquinasRef !== "undefined" && typeof historicoRef !== "undefined") {
      clearInterval(checkFirebase);
      startService();
    }
  }, 1000);

  function startService() {
    if (isRunning) return;
    isRunning = true;
    console.log("✅ Histórico: debounce por campo ativo");
    loadInitialValues().then(() => {
      monitorRealtimeChanges();
      setInterval(runSafetyPolling, SAFETY_POLL_INTERVAL);
      setInterval(checkAndRecordHourly, HOURLY_CHECK_INTERVAL);
      setTimeout(checkAndRecordHourly, 5000);
    });
  }

  function getSaoPauloTime() {
    const now = new Date();
    const sp = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const dia = String(sp.getUTCDate()).padStart(2, "0");
    const mes = String(sp.getUTCMonth() + 1).padStart(2, "0");
    const ano = sp.getUTCFullYear();
    const hh = String(sp.getUTCHours()).padStart(2, "0");
    const mm = String(sp.getUTCMinutes()).padStart(2, "0");
    const ss = String(sp.getUTCSeconds()).padStart(2, "0");
    return { data:{dia,mes,ano}, dataBR:`${dia}/${mes}/${ano}`, dataISO:`${ano}-${mes}-${dia}`, hora:{hora:hh,minuto:mm,segundo:ss}, horaMinuto:`${hh}:${mm}`, horaCompleta:`${hh}:${mm}:${ss}`, horaInt:sp.getUTCHours(), minutoInt:sp.getUTCMinutes(), timestamp:sp.getTime() };
  }

  function parseNum(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
  function extractMachineValues(d) { d = d || {}; return { molde:parseNum(d.molde ?? d.new_molde), blank:parseNum(d.blank ?? d.new_blank), neck_ring:parseNum(d.neck_ring ?? d.neckRing ?? d.neckring ?? d.new_neckring), funil:parseNum(d.funil ?? d.new_funil) }; }
  function valuesChanged(a,b) { if (!a || !b) return true; return FIELDS.some(f => (a[f] ?? 0) !== (b[f] ?? 0)); }
  async function getCurrentValues(machineId) { const snap = await maquinasRef.child(machineId).once("value"); return extractMachineValues(snap.val() || {}); }

  async function loadInitialValues() {
    const snap = await maquinasRef.once("value");
    const machines = snap.val() || {};
    Object.keys(machines).forEach(id => {
      const v = extractMachineValues(machines[id]);
      lastConfirmedValues[id] = { ...v };
      lastHourlyRecord[id] = { hora:-1, data:"", valores:{...v} };
    });
  }

  function scheduleField(machineId, field, value, source) {
    pendingTimers[machineId] = pendingTimers[machineId] || {};
    pendingTargets[machineId] = pendingTargets[machineId] || {};
    pendingTargets[machineId][field] = value;
    if (pendingTimers[machineId][field]) clearTimeout(pendingTimers[machineId][field]);
    pendingTimers[machineId][field] = setTimeout(() => confirmAndSaveField(machineId, field, value, source), DEBOUNCE_MS);
    console.log(`⏳ ${machineId}.${field}: aguardando 10s para confirmar ${value}`);
  }

  async function handleMachineChange(machineId, current, source) {
    const base = lastConfirmedValues[machineId] || current;
    FIELDS.forEach(field => {
      const value = current[field] ?? 0;
      const confirmed = base[field] ?? 0;
      const pending = pendingTargets[machineId]?.[field];
      if (value !== confirmed || (pending !== undefined && value !== pending)) scheduleField(machineId, field, value, source);
    });
  }

  async function confirmAndSaveField(machineId, field, expected, source) {
    try {
      const current = await getCurrentValues(machineId);
      const actual = current[field] ?? 0;
      const confirmed = lastConfirmedValues[machineId] || { ...current };
      const previous = confirmed[field] ?? 0;
      if (actual !== expected) { scheduleField(machineId, field, actual, source + "_rescheduled"); return false; }
      if (actual === previous) { if (pendingTargets[machineId]) delete pendingTargets[machineId][field]; return false; }
      const sp = getSaoPauloTime();
      const registro = { machineId, data:sp.dataBR, dataISO:sp.dataISO, hora:sp.horaMinuto, horaCompleta:sp.horaCompleta, horaNum:sp.horaInt, minutoNum:sp.minutoInt, timestamp:sp.timestamp, campo:field, camposAlterados:[field], valoresCompletos:{...current}, valorAnterior:previous, valorNovo:actual, mudancas:{[field]: actual - previous}, tipo:"real_time_field", source, created_at:new Date().toISOString() };
      registro[field] = actual;
      const chave = `rtf_${field}_${sp.data.ano}${sp.data.mes}${sp.data.dia}_${sp.hora.hora}${sp.hora.minuto}${sp.hora.segundo}_${String(Date.now()).slice(-5)}`;
      await historicoRef.child(machineId).child(chave).set(registro);
      lastConfirmedValues[machineId] = { ...confirmed, [field]: actual };
      if (pendingTargets[machineId]) delete pendingTargets[machineId][field];
      console.log(`✅ Histórico salvo: ${machineId}.${field} ${previous} -> ${actual}`);
      return true;
    } catch (e) { console.error(`❌ Erro ao salvar ${machineId}.${field}:`, e); return false; }
  }

  function monitorRealtimeChanges() {
    maquinasRef.on("child_changed", snap => handleMachineChange(snap.key, extractMachineValues(snap.val() || {}), "firebase_child_changed"));
    maquinasRef.on("child_added", snap => { const id=snap.key, v=extractMachineValues(snap.val() || {}); if (!lastConfirmedValues[id]) lastConfirmedValues[id]={...v}; if (!lastHourlyRecord[id]) lastHourlyRecord[id]={hora:-1,data:"",valores:{...v}}; });
  }

  async function runSafetyPolling() {
    try { const snap = await maquinasRef.once("value"); const machines = snap.val() || {}; for (const id of Object.keys(machines)) { const v = extractMachineValues(machines[id]); if (valuesChanged(lastConfirmedValues[id], v)) await handleMachineChange(id, v, "safety_polling"); } } catch(e) { console.error("❌ Erro no polling:", e); }
  }

  async function checkAndRecordHourly() {
    try {
      const sp = getSaoPauloTime(); if (sp.minutoInt > 5) return;
      const snap = await maquinasRef.once("value"); const machines = snap.val() || {};
      for (const id in machines) {
        const v = extractMachineValues(machines[id]); const last = lastHourlyRecord[id];
        if (last && last.hora === sp.horaInt && last.data === sp.dataBR) continue;
        const horaFormatada = `${String(sp.horaInt).padStart(2,"0")}:00`;
        const registro = { machineId:id, data:sp.dataBR, dataISO:sp.dataISO, hora:horaFormatada, horaCompleta:`${horaFormatada}:00`, horaNum:sp.horaInt, minutoNum:0, timestamp:sp.timestamp, ...v, tipo:"hourly", source:"hourly_snapshot", created_at:new Date().toISOString() };
        const chave = `${sp.data.ano}${sp.data.mes}${sp.data.dia}_${String(sp.horaInt).padStart(2,"0")}00`;
        await historicoRef.child(id).child(chave).set(registro);
        lastHourlyRecord[id] = { hora:sp.horaInt, data:sp.dataBR, valores:{...v} };
        lastConfirmedValues[id] = { ...v };
      }
    } catch(e) { console.error("❌ Erro no snapshot horário:", e); }
  }

  window.getHistoryByDate = async function(machineId, dataBR) { return new Promise((resolve, reject) => { historicoRef.child(machineId).orderByChild("data").equalTo(dataBR).once("value", s => { const d=s.val() || {}; resolve(Object.values(d).filter(x => x.data === dataBR).sort((a,b)=>(a.timestamp||0)-(b.timestamp||0))); }, reject); }); };
  window.getMachineHistoryByDate = async function(machineId, dateISO) { try { if (!machineId || !dateISO) return []; const [ano,mes,dia] = dateISO.split("-"); const dataBR = `${dia}/${mes}/${ano}`; const lista = await window.getHistoryByDate(machineId, dataBR); return lista.map(x => ({...x, hora:x.horaNum ?? 0, minuto:x.minutoNum ?? 0})); } catch(e) { console.error("❌ Erro em getMachineHistoryByDate:", e); return []; } };
  window.forceManualRecord = async function() { return await checkAndRecordHourly(); };
})();
