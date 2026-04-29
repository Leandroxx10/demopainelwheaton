// ================= SERVIÇO DE HISTÓRICO =================
// Registra somente alterações reais confirmadas.
// Debounce independente por máquina + campo: cada campo precisa permanecer
// 10 segundos com o mesmo valor antes de entrar no histórico.

(function () {
  'use strict';

  const DEBOUNCE_MS = 10 * 1000;
  const SAFETY_POLL_INTERVAL = 5 * 1000;
  const FIELDS = ['molde', 'blank', 'neck_ring', 'funil'];

  let confirmedValues = {};       // último estado já confirmado/salvo por máquina
  let pendingTimers = {};         // timers por máquina/campo
  let pendingValues = {};         // valor pendente por máquina/campo
  let commitTimers = {};          // agrupa campos que vencem quase juntos
  let isRunning = false;

  const checkFirebase = setInterval(() => {
    if (typeof maquinasRef !== 'undefined' && typeof historicoRef !== 'undefined') {
      clearInterval(checkFirebase);
      startService();
    }
  }, 500);

  function startService() {
    if (isRunning) return;
    isRunning = true;

    loadInitialValues().then(() => {
      monitorRealtimeChanges();
      setInterval(runSafetyPolling, SAFETY_POLL_INTERVAL);
      console.log('✅ Histórico ativo: debounce por máquina + campo, somente dados reais');
    });
  }

  function parseNum(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function extractMachineValues(machineData) {
    machineData = machineData || {};
    return {
      molde: parseNum(machineData.molde ?? machineData.new_molde),
      blank: parseNum(machineData.blank ?? machineData.new_blank),
      neck_ring: parseNum(machineData.neck_ring ?? machineData.neckRing ?? machineData.neckring ?? machineData.new_neckring),
      funil: parseNum(machineData.funil ?? machineData.new_funil)
    };
  }

  function getSaoPauloParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

    return {
      dia: parts.day,
      mes: parts.month,
      ano: parts.year,
      hora: parts.hour === '24' ? '00' : parts.hour,
      minuto: parts.minute,
      segundo: parts.second
    };
  }

  function getSaoPauloTime() {
    const now = new Date();
    const p = getSaoPauloParts(now);
    return {
      dataBR: `${p.dia}/${p.mes}/${p.ano}`,
      dataISO: `${p.ano}-${p.mes}-${p.dia}`,
      horaMinuto: `${p.hora}:${p.minuto}`,
      horaCompleta: `${p.hora}:${p.minuto}:${p.segundo}`,
      horaNum: parseInt(p.hora, 10) || 0,
      minutoNum: parseInt(p.minuto, 10) || 0,
      timestamp: now.getTime(),
      keyStamp: `${p.ano}${p.mes}${p.dia}_${p.hora}${p.minuto}${p.segundo}_${String(now.getMilliseconds()).padStart(3, '0')}`
    };
  }

  function valuesDiffer(a, b) {
    return FIELDS.some(field => parseNum(a?.[field]) !== parseNum(b?.[field]));
  }

  async function loadInitialValues() {
    try {
      const snapshot = await maquinasRef.once('value');
      const machines = snapshot.val() || {};
      Object.keys(machines).forEach(machineId => {
        confirmedValues[machineId] = extractMachineValues(machines[machineId]);
      });
      console.log('✅ Estado inicial carregado para histórico:', Object.keys(machines).length, 'máquinas');
    } catch (error) {
      console.error('❌ Erro ao carregar estado inicial do histórico:', error);
    }
  }

  function ensureMachineState(machineId) {
    if (!pendingTimers[machineId]) pendingTimers[machineId] = {};
    if (!pendingValues[machineId]) pendingValues[machineId] = {};
    if (!confirmedValues[machineId]) confirmedValues[machineId] = { molde: 0, blank: 0, neck_ring: 0, funil: 0 };
  }

  function scheduleChangedFields(machineId, currentValues, source) {
    ensureMachineState(machineId);
    const confirmed = confirmedValues[machineId];

    FIELDS.forEach(field => {
      const current = parseNum(currentValues[field]);
      const saved = parseNum(confirmed[field]);

      if (current === saved) {
        if (pendingTimers[machineId][field]) clearTimeout(pendingTimers[machineId][field]);
        delete pendingTimers[machineId][field];
        delete pendingValues[machineId][field];
        return;
      }

      if (pendingValues[machineId][field] === current && pendingTimers[machineId][field]) {
        return;
      }

      if (pendingTimers[machineId][field]) clearTimeout(pendingTimers[machineId][field]);
      pendingValues[machineId][field] = current;

      pendingTimers[machineId][field] = setTimeout(() => {
        confirmField(machineId, field, current, source);
      }, DEBOUNCE_MS);
    });
  }

  async function confirmField(machineId, field, expectedValue, source) {
    try {
      ensureMachineState(machineId);
      const snap = await maquinasRef.child(machineId).once('value');
      const currentValues = extractMachineValues(snap.val() || {});
      const currentValue = parseNum(currentValues[field]);

      delete pendingTimers[machineId][field];

      if (currentValue !== expectedValue) {
        pendingValues[machineId][field] = currentValue;
        scheduleChangedFields(machineId, currentValues, `${source}_rechecked`);
        return;
      }

      if (parseNum(confirmedValues[machineId][field]) === currentValue) {
        delete pendingValues[machineId][field];
        return;
      }

      confirmedValues[machineId][field] = currentValue;
      delete pendingValues[machineId][field];
      queueCommit(machineId, source);
    } catch (error) {
      console.error(`❌ Erro ao confirmar campo ${field} da máquina ${machineId}:`, error);
    }
  }

  function queueCommit(machineId, source) {
    if (commitTimers[machineId]) return;
    commitTimers[machineId] = setTimeout(() => {
      delete commitTimers[machineId];
      saveConfirmedSnapshot(machineId, source);
    }, 250);
  }

  async function saveConfirmedSnapshot(machineId, source) {
    try {
      const sp = getSaoPauloTime();
      const valores = { ...confirmedValues[machineId] };

      const lastSnap = await historicoRef.child(machineId).orderByChild('timestamp').limitToLast(1).once('value');
      let lastRecord = null;
      lastSnap.forEach(child => { lastRecord = child.val(); });

      const lastValues = lastRecord ? extractMachineValues(lastRecord) : null;
      if (lastValues && !valuesDiffer(lastValues, valores)) return;

      const registro = {
        machineId,
        data: sp.dataBR,
        dataISO: sp.dataISO,
        hora: sp.horaMinuto,
        horaCompleta: sp.horaCompleta,
        horaNum: sp.horaNum,
        minutoNum: sp.minutoNum,
        timestamp: sp.timestamp,
        molde: parseNum(valores.molde),
        blank: parseNum(valores.blank),
        neck_ring: parseNum(valores.neck_ring),
        funil: parseNum(valores.funil),
        mudancas: {
          molde: parseNum(valores.molde) - parseNum(lastValues?.molde),
          blank: parseNum(valores.blank) - parseNum(lastValues?.blank),
          neck_ring: parseNum(valores.neck_ring) - parseNum(lastValues?.neck_ring),
          funil: parseNum(valores.funil) - parseNum(lastValues?.funil)
        },
        tipo: 'real_time',
        source: `debounce_por_campo_${source || 'unknown'}`,
        confirmedDelayMs: DEBOUNCE_MS,
        created_at: new Date().toISOString()
      };

      await historicoRef.child(machineId).child(`rt_${sp.keyStamp}`).set(registro);
      console.log(`✅ Histórico salvo ${machineId}: M:${registro.molde} BL:${registro.blank} N:${registro.neck_ring} F:${registro.funil}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar histórico da máquina ${machineId}:`, error);
    }
  }

  function monitorRealtimeChanges() {
    maquinasRef.on('child_changed', snapshot => {
      const machineId = snapshot.key;
      const values = extractMachineValues(snapshot.val() || {});
      scheduleChangedFields(machineId, values, 'firebase_child_changed');
    });

    maquinasRef.on('child_added', snapshot => {
      const machineId = snapshot.key;
      if (!confirmedValues[machineId]) confirmedValues[machineId] = extractMachineValues(snapshot.val() || {});
    });
  }

  async function runSafetyPolling() {
    try {
      const snapshot = await maquinasRef.once('value');
      const machines = snapshot.val() || {};
      Object.keys(machines).forEach(machineId => {
        const values = extractMachineValues(machines[machineId]);
        scheduleChangedFields(machineId, values, 'safety_polling');
      });
    } catch (error) {
      console.error('❌ Erro no polling do histórico:', error);
    }
  }

  window.getHistoryByDate = async function (machineId, dataBR) {
    const snapshot = await historicoRef.child(machineId).once('value');
    const dados = snapshot.val() || {};
    return Object.values(dados)
      .filter(item => item && item.tipo === 'real_time' && item.data === dataBR)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  };

  window.getMachineHistoryByDate = async function (machineId, dateISO) {
    if (!machineId || !dateISO) return [];
    const [ano, mes, dia] = String(dateISO).split('-');
    const dataBR = `${dia}/${mes}/${ano}`;
    const lista = await window.getHistoryByDate(machineId, dataBR);
    return lista.map(item => ({
      ...item,
      hora: parseNum(item.horaNum),
      minuto: parseNum(item.minutoNum)
    }));
  };

  window.forceManualRecord = async function (machineId) {
    const id = machineId || (document.getElementById('historyMachineSelect')?.value || '').replace(/^Máquina\s+/i, '').trim();
    if (!id) return false;
    const snap = await maquinasRef.child(id).once('value');
    confirmedValues[id] = extractMachineValues(snap.val() || {});
    await saveConfirmedSnapshot(id, 'manual');
    return true;
  };
})();
