/*
 * history-chart-notes-integrated.js
 * Integra anotações diretamente no canvas do gráfico de histórico.
 * Requisitos: Chart.js 4.x, Firebase Database 8.x, historyChart canvas existente.
 */
(function () {
  'use strict';

  const STATE = {
    notes: [],
    noteById: new Map(),
    currentMachine: '',
    currentDate: '',
    chart: null,
    hoverNote: null,
    tooltipEl: null,
    dbReady: false,
    userEmail: '',
    pendingRender: false
  };

  const FIREBASE_ROOT = 'historyChartNotes';

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function normalizeDate(value) {
    if (!value) return todayISO();

    // input date
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    // dd/mm/yyyy
    const br = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;

    // Firebase/history keys sometimes include date text
    const iso = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    return todayISO();
  }

  function getSelectedDate() {
    const el = $('historyDate');
    if (!el) return todayISO();

    const selectedOption = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
    return normalizeDate(el.value || (selectedOption ? selectedOption.textContent : ''));
  }

  function getSelectedMachine() {
    const el = $('historyMachineSelect');
    return el && el.value ? String(el.value) : '';
  }

  function timeToMinutes(time) {
    if (!time) return 0;
    const m = String(time).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return 0;
    return Math.max(0, Math.min(1439, Number(m[1]) * 60 + Number(m[2])));
  }

  function minutesToDecimalHour(minutes) {
    return minutes / 60;
  }

  function noteMidValue(note) {
    const start = timeToMinutes(note.startTime);
    const end = timeToMinutes(note.endTime || note.startTime);
    return minutesToDecimalHour(start + Math.max(0, end - start) / 2);
  }

  function getScaleX(chart) {
    if (!chart || !chart.scales) return null;
    return chart.scales.x || chart.scales['x-axis-0'] || Object.values(chart.scales).find(s => s.axis === 'x');
  }

  function getScaleY(chart) {
    if (!chart || !chart.scales) return null;
    return chart.scales.y || chart.scales['y-axis-0'] || Object.values(chart.scales).find(s => s.axis === 'y');
  }

  function labelToDecimalHour(label) {
    if (label == null) return null;
    const text = String(label);
    const m = text.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) + Number(m[2]) / 60;
  }

  function getPixelForNote(chart, note) {
    const xScale = getScaleX(chart);
    if (!xScale) return null;

    const target = noteMidValue(note);

    // Linear/time scale
    if (typeof xScale.getPixelForValue === 'function') {
      let px = xScale.getPixelForValue(target);
      if (Number.isFinite(px) && px >= xScale.left - 80 && px <= xScale.right + 80) return px;

      // Category scale: find nearest label by HH:mm
      const labels = chart.data && chart.data.labels ? chart.data.labels : [];
      if (labels.length) {
        let bestIndex = -1;
        let bestDiff = Infinity;
        labels.forEach((label, idx) => {
          const hour = labelToDecimalHour(label);
          if (hour == null) return;
          const diff = Math.abs(hour - target);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIndex = idx;
          }
        });

        if (bestIndex >= 0) {
          px = xScale.getPixelForValue(bestIndex);
          if (Number.isFinite(px)) return px;
        }
      }
    }

    return null;
  }

  function isNoteVisibleInCurrentPeriod(note) {
    const start = timeToMinutes(note.startTime);
    const end = timeToMinutes(note.endTime || note.startTime);

    const isCustom = document.querySelector('.period-btn.active')?.dataset?.period === 'custom';
    const customContainer = $('customTimeContainer');

    if (isCustom || (customContainer && customContainer.style.display !== 'none')) {
      const s = $('customStartTime') ? timeToMinutes($('customStartTime').value || '00:00') : 0;
      const e = $('customEndTime') ? timeToMinutes($('customEndTime').value || '23:59') : 1439;
      return end >= s && start <= e;
    }

    return true;
  }

  function currentNotes() {
    STATE.currentMachine = getSelectedMachine();
    STATE.currentDate = getSelectedDate();

    if (!STATE.currentMachine) return [];

    const savedNotes = STATE.notes.filter(n =>
      n.machine === STATE.currentMachine &&
      normalizeDate(n.date) === STATE.currentDate &&
      isNoteVisibleInCurrentPeriod(n)
    );

    const maintenanceNote = getMaintenanceVirtualNote();
    if (maintenanceNote) savedNotes.unshift(maintenanceNote);

    return savedNotes;
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function forceTopPadding(chart) {
    if (!chart || !chart.options) return;
    chart.options.layout = chart.options.layout || {};
    chart.options.layout.padding = chart.options.layout.padding || {};
    const currentTop = Number(chart.options.layout.padding.top || 0);
    // Reserva uma faixa superior exclusiva para as anotações.
    // Isso evita conflito com o tooltip nativo dos pontos/quantidades.
    chart.options.layout.padding.top = Math.max(currentTop, 58);
  }

  function getGlobalValue(name) {
    try {
      return Function(`return (typeof ${name} !== "undefined") ? ${name} : undefined`)();
    } catch (_) {
      return undefined;
    }
  }

  function extractTimeFromAny(value) {
    if (!value) return '';
    if (typeof value === 'number') {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      return '';
    }

    const text = String(value);
    const hour = text.match(/(\d{1,2}):(\d{2})/);
    if (hour) return `${pad2(hour[1])}:${hour[2]}`;

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;

    return '';
  }

  function getField(obj, names) {
    if (!obj) return undefined;
    for (const name of names) {
      if (obj[name] !== undefined && obj[name] !== null && obj[name] !== '') return obj[name];
    }
    return undefined;
  }

  function getMaintenanceInfo(machine) {
    const sources = [
      window.machineMaintenance,
      window.maintenanceData,
      window.allMachineMaintenance,
      window.manutencoes,
      window.maintenanceRecords,
      getGlobalValue('machineMaintenance'),
      getGlobalValue('maintenanceData'),
      getGlobalValue('allMachineMaintenance'),
      getGlobalValue('manutencoes'),
      getGlobalValue('maintenanceRecords')
    ].filter(Boolean);

    const readItem = (item) => {
      if (!item) return null;

      // Se vier uma lista de eventos, usa o último evento ativo ou o mais recente.
      if (Array.isArray(item)) {
        const sorted = item.slice().sort((a, b) => Number(getField(b, ['createdAt','startedAt','inicioTimestamp','timestamp','updatedAt']) || 0) - Number(getField(a, ['createdAt','startedAt','inicioTimestamp','timestamp','updatedAt']) || 0));
        for (const row of sorted) {
          const info = readItem(row);
          if (info) return info;
        }
        return null;
      }

      const active =
        item.isInMaintenance === true ||
        item.emManutencao === true ||
        item.maintenance === true ||
        item.manutencao === true ||
        item.status === 'maintenance' ||
        item.status === 'manutencao' ||
        item.status === 'manutenção' ||
        item.status === 'parada' ||
        item.tipoStatus === 'manutencao';

      const hasMaintenanceTime =
        getField(item, ['startTime','horaInicio','inicio','maintenanceStart','startedAt','inicioManutencao','start']) ||
        getField(item, ['endTime','horaFim','fim','maintenanceEnd','endedAt','fimManutencao','end']);

      if (!active && !hasMaintenanceTime) return null;

      const startRaw = getField(item, ['startTime','horaInicio','inicio','maintenanceStart','startedAt','inicioManutencao','start','createdAt','timestamp']);
      const endRaw = getField(item, ['endTime','horaFim','fim','maintenanceEnd','endedAt','fimManutencao','end','returnedAt','retorno','returnTime']);

      return {
        isInMaintenance: true,
        reason: getField(item, ['reason','motivo','message','mensagem','observacao','observação','maintenanceReason']) || '',
        type: getField(item, ['type','tipo']) || 'Manutenção corretiva',
        startTime: extractTimeFromAny(startRaw),
        endTime: extractTimeFromAny(endRaw)
      };
    };

    for (const source of sources) {
      const item = source[machine] || source[String(machine)];
      const info = readItem(item);
      if (info) return info;
    }

    const allAdminMachines = window.allAdminMachines || window.allMachinesData || getGlobalValue('allAdminMachines') || getGlobalValue('allMachinesData');
    const machineData = allAdminMachines && (allAdminMachines[machine] || allAdminMachines[String(machine)]);
    const info = readItem(machineData);
    if (info) return info;

    return null;
  }

  function getVisibleRangeTimes() {
    const isCustom = document.querySelector('.period-btn.active')?.dataset?.period === 'custom';
    if (isCustom) {
      return {
        start: $('customStartTime')?.value || '00:00',
        end: $('customEndTime')?.value || '23:59'
      };
    }

    const active = document.querySelector('.period-btn.active, .period-option.active');
    const period = active ? active.getAttribute('data-period') : '24h';

    if (period === 'shift1' || period === 'turno1') return { start: '06:00', end: '14:00' };
    if (period === 'shift2' || period === 'turno2') return { start: '14:00', end: '22:00' };
    if (period === 'shift3' || period === 'turno3') return { start: '22:00', end: '06:00' };

    return { start: '00:00', end: '23:59' };
  }

  function getMaintenanceVirtualNote() {
    const machine = getSelectedMachine();
    const date = getSelectedDate();
    if (!machine || !date) return null;

    const info = getMaintenanceInfo(machine);
    if (!info || !info.isInMaintenance) return null;

    const range = getVisibleRangeTimes();
    const startTime = info.startTime || range.start || '00:00';
    const endTime = info.endTime || range.end || '23:59';

    return {
      id: `maintenance_${machine}_${date}`,
      machine,
      date,
      startTime,
      endTime,
      message: `PARADA PARA MANUTENÇÃO CORRETIVA${info.reason ? '
Motivo: ' + info.reason : ''}`,
      author: 'Sistema',
      updatedAtText: info.endTime ? 'Período registrado' : 'Em manutenção no momento',
      __maintenance: true
    };
  }

  const chartNotesPlugin = {
    id: 'wmoldesHistoryNotes',
    beforeInit(chart) {
      forceTopPadding(chart);
    },
    beforeUpdate(chart) {
      forceTopPadding(chart);
    },
    afterDatasetsDraw(chart) {
      const xScale = getScaleX(chart);
      const yScale = getScaleY(chart);
      if (!xScale || !yScale) return;

      const ctx = chart.ctx;
      const baseY = Math.max(8, chart.chartArea.top - 50);
      const notes = currentNotes();
      const occupied = [];

      STATE.chart = chart;

      notes.forEach(note => {
        const x = getPixelForNote(chart, note);
        if (!Number.isFinite(x)) return;

        const w = note.__maintenance ? 46 : 32;
        const h = 24;

        let row = 0;
        let left = Math.max(chart.chartArea.left + 4, Math.min(x - w / 2, chart.chartArea.right - w - 4));
        while (occupied.some(box => Math.abs(box.x - x) < 38 && box.row === row)) row++;
        row = Math.min(row, 1);

        const y = baseY + row * 28;
        occupied.push({ x, row });

        note.__hit = { x: left, y, w, h, cx: x };

        ctx.save();

        // Linha vertical suave até o eixo do gráfico, indicando exatamente o horário.
        // Começa abaixo do bloco para não competir com o tooltip de quantidade.
        ctx.strokeStyle = note.__maintenance ? 'rgba(100, 116, 139, 0.38)' : 'rgba(245, 158, 11, 0.34)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(x, y + h + 4);
        ctx.lineTo(x, chart.chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Bloco de notas / manutenção
        ctx.shadowColor = 'rgba(15, 23, 42, 0.20)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = note.__maintenance ? '#64748b' : '#fbbf24';
        drawRoundedRect(ctx, left, y, w, h, 7);
        ctx.fill();

        // Borda
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = note.__maintenance ? '#334155' : '#d97706';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, left, y, w, h, 7);
        ctx.stroke();

        if (note.__maintenance) {
          // Ícone de chave/manutenção simplificado
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(left + 15, y + 9, 4, 0.6, Math.PI * 1.65);
          ctx.moveTo(left + 18, y + 13);
          ctx.lineTo(left + 28, y + 18);
          ctx.moveTo(left + 25, y + 17);
          ctx.lineTo(left + 29, y + 14);
          ctx.stroke();
        } else {
          // Linhas internas estilo bloco de notas
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(left + 9, y + 8);
          ctx.lineTo(left + 23, y + 8);
          ctx.moveTo(left + 9, y + 12);
          ctx.lineTo(left + 21, y + 12);
          ctx.moveTo(left + 9, y + 16);
          ctx.lineTo(left + 18, y + 16);
          ctx.stroke();
        }

        ctx.restore();
      });
    }
  };

  function registerPlugin() {
    if (!window.Chart) return;
    const already = Chart.registry && Chart.registry.plugins && Chart.registry.plugins.get && Chart.registry.plugins.get('wmoldesHistoryNotes');
    if (!already) Chart.register(chartNotesPlugin);
  }

  function getChartInstance() {
    const canvas = $('historyChart');
    if (!canvas || !window.Chart) return null;
    return Chart.getChart(canvas) || STATE.chart || null;
  }

  function updateChart() {
    registerPlugin();
    const chart = getChartInstance();
    if (chart) {
      STATE.chart = chart;
      try { chart.update('none'); } catch (_) { chart.draw(); }
    }
  }

  function ensureTooltip() {
    if (STATE.tooltipEl) return STATE.tooltipEl;
    const el = document.createElement('div');
    el.className = 'history-note-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
    STATE.tooltipEl = el;
    return el;
  }

  function showTooltip(note, evt) {
    const el = ensureTooltip();
    if (!note) {
      el.style.display = 'none';
      STATE.hoverNote = null;
      return;
    }

    STATE.hoverNote = note;
    el.innerHTML = `
      <div class="history-note-tooltip-time ${note.__maintenance ? 'maintenance' : ''}">${escapeHtml(note.startTime)} - ${escapeHtml(note.endTime || note.startTime)}</div>
      <div class="history-note-tooltip-message">${escapeHtml(note.message || '')}</div>
      <div class="history-note-tooltip-meta">${escapeHtml(note.author || 'Usuário')} • ${escapeHtml(note.updatedAtText || note.createdAtText || '')}</div>
      <div class="history-note-tooltip-actions">${note.__maintenance ? 'Informação automática do status da máquina' : 'Clique para editar/remover'}</div>
    `;

    const offset = 14;
    let left = evt.clientX + offset;
    let top = evt.clientY + offset;

    el.style.display = 'block';
    const rect = el.getBoundingClientRect();

    if (left + rect.width > window.innerWidth - 12) left = evt.clientX - rect.width - offset;
    if (top + rect.height > window.innerHeight - 12) top = evt.clientY - rect.height - offset;

    el.style.left = `${Math.max(12, left)}px`;
    el.style.top = `${Math.max(12, top)}px`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function findNoteAtEvent(evt) {
    const chart = getChartInstance();
    if (!chart) return null;

    const canvas = chart.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;

    const notes = currentNotes();
    for (let i = notes.length - 1; i >= 0; i--) {
      const h = notes[i].__hit;
      if (!h) continue;
      if (x >= h.x - 4 && x <= h.x + h.w + 4 && y >= h.y - 4 && y <= h.y + h.h + 4) return notes[i];
    }

    // fallback: if user is close to vertical line near the top
    for (let i = notes.length - 1; i >= 0; i--) {
      const h = notes[i].__hit;
      if (!h) continue;
      if (Math.abs(x - h.cx) <= 8 && y >= chart.chartArea.top && y <= chart.chartArea.top + 60) return notes[i];
    }

    return null;
  }

  function setupCanvasEvents() {
    const canvas = $('historyChart');
    if (!canvas || canvas.__historyNotesEventsBound) return;
    canvas.__historyNotesEventsBound = true;

    canvas.addEventListener('mousemove', (evt) => {
      const note = findNoteAtEvent(evt);
      canvas.style.cursor = note ? 'pointer' : '';
      showTooltip(note, evt);
    });

    canvas.addEventListener('mouseleave', () => showTooltip(null));

    canvas.addEventListener('click', (evt) => {
      const note = findNoteAtEvent(evt);
      if (note && !note.__maintenance) openModal(note);
    });
  }

  function updateToolbarVisibility() {
    const toolbar = $('historyNotesToolbar');
    if (!toolbar) return;
    const hasMachine = !!getSelectedMachine();
    toolbar.classList.toggle('is-disabled', !hasMachine);
    toolbar.style.display = hasMachine ? 'flex' : 'none';
  }

  function destroyExistingHistoryChartBeforeReload() {
    const canvas = $('historyChart');
    if (!canvas || !window.Chart) return;

    const existing = Chart.getChart(canvas);
    if (existing) {
      try { existing.destroy(); } catch (err) { console.warn('Não foi possível destruir gráfico anterior:', err); }
    }

    // Alguns arquivos antigos guardam a instância em variáveis globais.
    // Limpar as mais comuns evita o erro "Canvas is already in use".
    try {
      if (window.historyChart && typeof window.historyChart.destroy === 'function') {
        window.historyChart.destroy();
      }
      window.historyChart = null;
    } catch (_) {}
  }

  function getDbRef() {
    if (!window.firebase || !firebase.database) return null;
    try {
      return firebase.database().ref(FIREBASE_ROOT);
    } catch (_) {
      return null;
    }
  }

  function formatNow() {
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function firebasePath(machine, date) {
    const safeMachine = String(machine || 'sem-maquina').replace(/[.#$/\[\]]/g, '_');
    const safeDate = normalizeDate(date);
    return `${FIREBASE_ROOT}/${safeMachine}/${safeDate}`;
  }

  function listenNotes() {
    const db = getDbRef();
    STATE.currentMachine = getSelectedMachine();
    STATE.currentDate = getSelectedDate();

    if (!STATE.currentMachine || !STATE.currentDate) {
      STATE.notes = [];
      updateChart();
      return;
    }

    if (!db) {
      STATE.notes = loadLocalNotes();
      updateChart();
      return;
    }

    const path = firebasePath(STATE.currentMachine, STATE.currentDate);
    firebase.database().ref(path).off();
    firebase.database().ref(path).on('value', (snap) => {
      const rows = snap.val() || {};
      STATE.notes = Object.keys(rows).map(id => ({
        id,
        machine: STATE.currentMachine,
        date: STATE.currentDate,
        ...rows[id]
      }));
      STATE.noteById = new Map(STATE.notes.map(n => [n.id, n]));
      updateChart();
    });
  }

  function localStorageKey(machine, date) {
    return `wmoldes_history_notes_${machine}_${normalizeDate(date)}`;
  }

  function loadLocalNotes() {
    const machine = getSelectedMachine();
    const date = getSelectedDate();
    try {
      return JSON.parse(localStorage.getItem(localStorageKey(machine, date)) || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveLocalNotes(notes) {
    const machine = getSelectedMachine();
    const date = getSelectedDate();
    localStorage.setItem(localStorageKey(machine, date), JSON.stringify(notes));
  }

  function openModal(note) {
    const machine = getSelectedMachine();
    const date = getSelectedDate();

    if (!machine) {
      alert('Selecione uma máquina antes de criar uma anotação.');
      return;
    }

    const modal = $('historyNoteModalBackdrop');
    if (!modal) return;

    $('historyNoteId').value = note ? note.id : '';
    $('historyNoteDate').value = normalizeDate(note ? note.date : date);
    $('historyNoteStart').value = note ? note.startTime : defaultStartTime();
    $('historyNoteEnd').value = note ? (note.endTime || note.startTime) : defaultEndTime();
    $('historyNoteMessage').value = note ? (note.message || '') : '';

    const del = $('historyNoteDeleteBtn');
    if (del) del.style.display = note ? 'inline-flex' : 'none';

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('historyNoteMessage') && $('historyNoteMessage').focus(), 50);
  }

  function closeModal() {
    const modal = $('historyNoteModalBackdrop');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function defaultStartTime() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(Math.floor(d.getMinutes() / 5) * 5)}`;
  }

  function defaultEndTime() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return `${pad2(d.getHours())}:${pad2(Math.floor(d.getMinutes() / 5) * 5)}`;
  }

  async function saveNote() {
    const machine = getSelectedMachine();
    const selectedDate = normalizeDate($('historyNoteDate').value || getSelectedDate());
    const startTime = $('historyNoteStart').value;
    const endTime = $('historyNoteEnd').value;
    const message = ($('historyNoteMessage').value || '').trim();
    const id = $('historyNoteId').value;

    if (!machine) return alert('Selecione uma máquina.');
    if (!selectedDate) return alert('Selecione a data.');
    if (!startTime || !endTime) return alert('Informe o horário inicial e final.');
    if (timeToMinutes(endTime) < timeToMinutes(startTime)) return alert('O horário final não pode ser menor que o inicial.');
    if (!message) return alert('Digite a mensagem da anotação.');

    const emailEl = $('currentUserEmail');
    const author = emailEl && emailEl.textContent && emailEl.textContent !== 'Carregando...' ? emailEl.textContent : STATE.userEmail || 'Usuário';

    const payload = {
      machine,
      date: selectedDate,
      startTime,
      endTime,
      message,
      author,
      updatedAt: Date.now(),
      updatedAtText: formatNow()
    };

    const db = getDbRef();

    if (db) {
      const baseRef = firebase.database().ref(firebasePath(machine, selectedDate));
      if (id) {
        const original = STATE.noteById.get(id);
        if (original && normalizeDate(original.date) !== selectedDate) {
          await firebase.database().ref(firebasePath(machine, original.date)).child(id).remove();
          await baseRef.push({ ...payload, createdAt: Date.now(), createdAtText: formatNow() });
        } else {
          await baseRef.child(id).update(payload);
        }
      } else {
        await baseRef.push({ ...payload, createdAt: Date.now(), createdAtText: formatNow() });
      }
    } else {
      const local = loadLocalNotes();
      if (id) {
        const idx = local.findIndex(n => n.id === id);
        if (idx >= 0) local[idx] = { ...local[idx], ...payload };
      } else {
        local.push({ id: `local_${Date.now()}`, ...payload, createdAt: Date.now(), createdAtText: formatNow() });
      }
      saveLocalNotes(local);
      STATE.notes = local;
      updateChart();
    }

    closeModal();

    // if selected different date, update select if possible
    const dateSelect = $('historyDate');
    if (dateSelect && dateSelect.value !== selectedDate) {
      const option = Array.from(dateSelect.options || []).find(o => normalizeDate(o.value || o.textContent) === selectedDate);
      if (option) {
        dateSelect.value = option.value;
      }
    }

    listenNotes();
  }

  async function deleteNote() {
    const id = $('historyNoteId').value;
    if (!id) return;
    if (!confirm('Remover esta anotação?')) return;

    const machine = getSelectedMachine();
    const note = STATE.noteById.get(id) || STATE.notes.find(n => n.id === id);
    const date = normalizeDate(note ? note.date : getSelectedDate());

    const db = getDbRef();
    if (db) {
      await firebase.database().ref(firebasePath(machine, date)).child(id).remove();
    } else {
      const local = loadLocalNotes().filter(n => n.id !== id);
      saveLocalNotes(local);
      STATE.notes = local;
      updateChart();
    }

    closeModal();
    listenNotes();
  }

  function patchHistoryLoad() {
    const original = window.loadHistoryChart;
    if (typeof original === 'function' && !original.__notesPatched) {
      const patched = function () {
        updateToolbarVisibility();
        destroyExistingHistoryChartBeforeReload();

        const result = original.apply(this, arguments);

        setTimeout(() => {
          setupCanvasEvents();
          listenNotes();
          updateToolbarVisibility();
          updateChart();
        }, 250);
        setTimeout(updateChart, 900);
        return result;
      };
      patched.__notesPatched = true;
      window.loadHistoryChart = patched;
    }

    const originalSetPeriod = window.setPeriod;
    if (typeof originalSetPeriod === 'function' && !originalSetPeriod.__notesPatched) {
      const patchedPeriod = function () {
        const result = originalSetPeriod.apply(this, arguments);
        setTimeout(updateChart, 150);
        return result;
      };
      patchedPeriod.__notesPatched = true;
      window.setPeriod = patchedPeriod;
    }

    const originalApply = window.applyCustomPeriod;
    if (typeof originalApply === 'function' && !originalApply.__notesPatched) {
      const patchedApply = function () {
        const result = originalApply.apply(this, arguments);
        setTimeout(updateChart, 150);
        return result;
      };
      patchedApply.__notesPatched = true;
      window.applyCustomPeriod = patchedApply;
    }
  }

  function bindUi() {
    $('historyNoteAddBtn')?.addEventListener('click', () => openModal(null));
    $('historyNoteCloseBtn')?.addEventListener('click', closeModal);
    $('historyNoteCancelBtn')?.addEventListener('click', closeModal);
    $('historyNoteSaveBtn')?.addEventListener('click', saveNote);
    $('historyNoteDeleteBtn')?.addEventListener('click', deleteNote);

    $('historyNoteModalBackdrop')?.addEventListener('click', (evt) => {
      if (evt.target === $('historyNoteModalBackdrop')) closeModal();
    });

    $('historyMachineSelect')?.addEventListener('change', () => {
      setTimeout(() => {
        updateToolbarVisibility();
        listenNotes();
        updateChart();
      }, 100);
    });

    $('historyDate')?.addEventListener('change', () => {
      setTimeout(() => {
        updateToolbarVisibility();
        listenNotes();
        updateChart();
      }, 100);
    });

    $('customStartTime')?.addEventListener('change', updateChart);
    $('customEndTime')?.addEventListener('change', updateChart);
  }

  function init() {
    registerPlugin();
    patchHistoryLoad();
    bindUi();
    setupCanvasEvents();

    const emailEl = $('currentUserEmail');
    STATE.userEmail = emailEl ? emailEl.textContent : '';

    setTimeout(() => {
      updateToolbarVisibility();
      listenNotes();
      updateChart();
    }, 600);

    setInterval(() => {
      patchHistoryLoad();
      setupCanvasEvents();
      const chart = getChartInstance();
      if (chart && chart !== STATE.chart) {
        STATE.chart = chart;
        updateChart();
      }
    }, 1500);
  }

  document.addEventListener('DOMContentLoaded', init);

  window.WMoldesHistoryNotes = {
    open: () => openModal(null),
    refresh: () => {
      listenNotes();
      updateChart();
    }
  };
})();
