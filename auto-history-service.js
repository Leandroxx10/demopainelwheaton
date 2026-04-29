// ================= SERVIÇO DE HISTÓRICO =================
// Registra SOMENTE alterações reais, com debounce independente por máquina e por campo.
// Não cria snapshots horários automáticos para evitar dados falsos no gráfico.
(function() {
  "use strict";

  const DEBOUNCE_MS = 10000;
  const SAFETY_POLL_INTERVAL = 10000;
  const FIELDS = ["molde", "blank", "neck_ring", "funil"];

  let confirmedValues = {};
  let pendingTimers = {};
  let pendingExpected = {};
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
    console.log("✅ Histórico real ativo: debounce por máquina/campo, sem snapshot falso");
    loadInitialValues().then(() => {
      monitorRealtimeChanges();
      setInterval(runSafetyPolling, SAFETY_POLL_INTERVAL);
    });
  }

  function getSaoPauloTime() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
    const ano = parts.year, mes = parts.month, dia = parts.day;
    const hh = parts.hour === '24' ? '00' : parts.hour;
    const mm = parts.minute, ss = parts.second;
    return {
      data: { dia, mes, ano },
      dataBR: `${dia}/${mes}/${ano}`,
      dataISO: `${ano}-${mes}-${dia}`,
      hora: { hora: hh, minuto: mm, segundo: ss },
      horaMinuto: `${hh}:${mm}`,
      horaCompleta: `${hh}:${mm}:${ss}`,
      horaInt: parseInt(hh, 10),
      minutoInt: parseInt(mm, 10),
      // Timestamp real absoluto; data/hora exibidas ficam em São Paulo pelos campos acima.
      timestamp: Date.now()
    };
  }

  function parseNum(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function extractMachineValues(d) {
    d = d || {};
    return {
      molde: parseNum(d.molde ?? d.new_molde),
      blank: parseNum(d.blank ?? d.new_blank),
      neck_ring: parseNum(d.neck_ring ?? d.neckRing ?? d.neckring ?? d.new_neckring),
      funil: parseNum(d.funil ?? d.new_funil)
    };
  }

  async function getCurrentValues(machineId) {
    const snap = await maquinasRef.child(machineId).once("value");
    return extractMachineValues(snap.val() || {});
  }

  async function loadInitialValues() {
    try {
      const snap = await maquinasRef.once("value");
      const machines = snap.val() || {};
      Object.keys(machines).forEach(machineId => {
        confirmedValues[machineId] = extractMachineValues(machines[machineId]);
      });
      console.log("✅ Histórico: estado base carregado", Object.keys(machines).length, "máquinas");
    } catch (e) {
      console.error("❌ Erro ao carregar estado base do histórico:", e);
    }
  }

  function ensureMachine(machineId, current) {
    if (!confirmedValues[machineId]) confirmedValues[machineId] = { ...current };
    if (!pendingTimers[machineId]) pendingTimers[machineId] = {};
    if (!pendingExpected[machineId]) pendingExpected[machineId] = {};
  }

  function scheduleField(machineId, field, expectedValue, source) {
    ensureMachine(machineId, confirmedValues[machineId] || {});
    pendingExpected[machineId][field] = expectedValue;
    if (pendingTimers[machineId][field]) clearTimeout(pendingTimers[machineId][field]);
    pendingTimers[machineId][field] = setTimeout(() => {
      confirmAndSaveField(machineId, field, expectedValue, source);
    }, DEBOUNCE_MS);
    console.log(`⏳ ${machineId}.${field}: aguardando 10s para confirmar valor ${expectedValue}`);
  }

  async function handleMachineChange(machineId, current, source) {
    ensureMachine(machineId, current);
    const base = confirmedValues[machineId];

    FIELDS.forEach(field => {
      const nowValue = current[field] ?? 0;
      const confirmed = base[field] ?? 0;
      const pending = pendingExpected[machineId]?.[field];

      // Campo voltou ao valor confirmado: cancela pendência desse campo.
      if (nowValue === confirmed) {
        if (pendingTimers[machineId]?.[field]) clearTimeout(pendingTimers[machineId][field]);
        if (pendingExpected[machineId]) delete pendingExpected[machineId][field];
        return;
      }

      // Campo mudou ou mudou novamente enquanto estava pendente.
      if (pending === undefined || pending !== nowValue) {
        scheduleField(machineId, field, nowValue, source);
      }
    });
  }

  async function confirmAndSaveField(machineId, field, expectedValue, source) {
    try {
      const current = await getCurrentValues(machineId);
      ensureMachine(machineId, current);

      const actual = current[field] ?? 0;
      const previousSnapshot = confirmedValues[machineId] || { ...current };
      const previousValue = previousSnapshot[field] ?? 0;

      // Se mudou de novo durante os 10s, reinicia a contagem para o novo valor real.
      if (actual !== expectedValue) {
        scheduleField(machineId, field, actual, `${source}_rescheduled`);
        return false;
      }

      // Se voltou ao valor anterior, não registra nada.
      if (actual === previousValue) {
        if (pendingExpected[machineId]) delete pendingExpected[machineId][field];
        return false;
      }

      const sp = getSaoPauloTime();
      const fullValues = { ...current };
      const updatedSnapshot = { ...previousSnapshot, [field]: actual };

      const registro = {
        machineId,
        data: sp.dataBR,
        dataISO: sp.dataISO,
        hora: sp.horaMinuto,
        horaCompleta: sp.horaCompleta,
        horaNum: sp.horaInt,
        minutoNum: sp.minutoInt,
        timestamp: sp.timestamp,

        // Valores reais completos no momento confirmado.
        molde: fullValues.molde,
        blank: fullValues.blank,
        neck_ring: fullValues.neck_ring,
        funil: fullValues.funil,
        valoresCompletos: fullValues,

        campo,
        camposAlterados: [field],
        valorAnterior: previousValue,
        valorNovo: actual,
        mudancas: { [field]: actual - previousValue },
        tipo: "real_time_field",
        source,
        created_at: new Date().toISOString()
      };

      const chave = `rtf_${field}_${sp.data.ano}${sp.data.mes}${sp.data.dia}_${sp.hora.hora}${sp.hora.minuto}${sp.hora.segundo}_${String(Date.now()).slice(-6)}`;
      await historicoRef.child(machineId).child(chave).set(registro);

      confirmedValues[machineId] = updatedSnapshot;
      if (pendingExpected[machineId]) delete pendingExpected[machineId][field];
      console.log(`✅ Histórico real salvo: ${machineId}.${field} ${previousValue} -> ${actual}`);
      return true;
    } catch (e) {
      console.error(`❌ Erro ao salvar histórico real ${machineId}.${field}:`, e);
      return false;
    }
  }

  function monitorRealtimeChanges() {
    maquinasRef.on("child_changed", snap => {
      handleMachineChange(snap.key, extractMachineValues(snap.val() || {}), "firebase_child_changed");
    });

    maquinasRef.on("child_added", snap => {
      const machineId = snap.key;
      const current = extractMachineValues(snap.val() || {});
      ensureMachine(machineId, current);
    });
  }

  async function runSafetyPolling() {
    try {
      const snap = await maquinasRef.once("value");
      const machines = snap.val() || {};
      for (const machineId of Object.keys(machines)) {
        const current = extractMachineValues(machines[machineId]);
        await handleMachineChange(machineId, current, "safety_polling");
      }
    } catch (e) {
      console.error("❌ Erro no polling de histórico:", e);
    }
  }

  // Mantido apenas para compatibilidade com botões antigos. Não cria snapshot falso.
  window.forceManualRecord = async function() {
    console.warn("forceManualRecord desativado: o histórico agora grava somente alterações reais confirmadas.");
    return false;
  };

  window.getHistoryByDate = async function(machineId, dataBR) {
    return new Promise((resolve, reject) => {
      historicoRef.child(machineId).orderByChild("data").equalTo(dataBR).once("value", snap => {
        const rows = snap.val() || {};
        resolve(Object.values(rows)
          .filter(item => item.data === dataBR && /^real_time/.test(String(item.tipo || '')))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
      }, reject);
    });
  };

  window.getMachineHistoryByDate = async function(machineId, dateISO) {
    try {
      if (!machineId || !dateISO) return [];
      const [ano, mes, dia] = dateISO.split("-");
      const dataBR = `${dia}/${mes}/${ano}`;
      const lista = await window.getHistoryByDate(machineId, dataBR);
      return lista.map(item => ({ ...item, hora: item.horaNum ?? 0, minuto: item.minutoNum ?? 0 }));
    } catch (e) {
      console.error("❌ Erro em getMachineHistoryByDate:", e);
      return [];
    }
  };
})();
