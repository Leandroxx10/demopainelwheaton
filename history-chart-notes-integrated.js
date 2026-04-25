/*
 * WMoldes - Anotações profissionais integradas ao gráfico
 * Versão robusta:
 * - Cria toolbar/modal se o HTML não tiver.
 * - Botão aparece quando houver máquina selecionada.
 * - Não altera loadHistoryChart().
 * - Desenha anotações e manutenção dentro do canvas por plugin Chart.js.
 */
(function () {
  'use strict';

  const ROOT = 'historyChartNotesV3';
  const state = {
    notes: [],
    chart: null,
    subscribedPath: '',
    tooltip: null,
    ready: false
  };

  function el(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function nowText() {
    const d = new Date();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }
  function safeKey(v) {
    return String(v || 'sem-maquina').replace(/[.#$/\[\]]/g, '_');
  }

  function normalizeDate(v) {
    if (!v) return todayISO();
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return todayISO();
  }

  function getMachine() {
    const s = el('historyMachineSelect');
    if (!s) return '';

    let value = String(s.value || '').trim();
    const text = s.options && s.selectedIndex >= 0
      ? String(s.options[s.selectedIndex].textContent || '').trim()
      : '';

    const lower = `${value} ${text}`.toLowerCase();

    if (lower.includes('carregando')) return '';
    if (lower.includes('selecione') && !value) return '';

    // Alguns selects customizados deixam value vazio, mas o texto tem "Máquina X".
    if (!value && text && !text.toLowerCase().includes('carregando') && !text.toLowerCase().includes('selecione')) {
      value = text;
    }

    return value;
  }

  function getDate() {
    const s = el('historyDate');
    if (!s) return todayISO();
    const optText = s.options && s.selectedIndex >= 0 ? s.options[s.selectedIndex].textContent : '';
    return normalizeDate(s.value || optText);
  }

  function timeToMin(t) {
    const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return 0;
    return Math.max(0, Math.min(1439, Number(m[1]) * 60 + Number(m[2])));
  }
  function minToHour(m) { return m / 60; }

  function extractTime(v) {
    if (!v) return '';
    if (typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const s = String(v);
    const hh = s.match(/(\d{1,2}):(\d{2})/);
    if (hh) return `${pad(hh[1])}:${hh[2]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function selectedRange() {
    const active = qs('.period-btn.active, .period-option.active, [data-period].active');
    const p = active ? String(active.getAttribute('data-period') || '').toLowerCase() : '24h';

    if (p === 'custom') {
      return {
        start: el('customStartTime')?.value || '00:00',
        end: el('customEndTime')?.value || '23:59'
      };
    }

    if (p.includes('turno1') || p.includes('shift1')) return { start: '06:00', end: '14:00' };
    if (p.includes('turno2') || p.includes('shift2')) return { start: '14:00', end: '22:00' };
    if (p.includes('turno3') || p.includes('shift3')) return { start: '22:00', end: '06:00' };

    return { start: '00:00', end: '23:59' };
  }

  function ensureUI() {
    const chartContainer = qs('#history-section .chart-container') || qs('.chart-container');
    if (chartContainer && !el('historyNotesToolbar')) {
      const toolbar = document.createElement('div');
      toolbar.className = 'history-notes-toolbar is-disabled';
      toolbar.id = 'historyNotesToolbar';
      toolbar.style.display = 'none';
      toolbar.innerHTML = `
        <button type="button" class="history-note-add-btn" id="historyNoteAddBtn">
          <i class="fas fa-sticky-note"></i>
          Nova anotação
        </button>
        <span class="history-notes-helper">Anotações e manutenção aparecem no topo do gráfico.</span>
      `;
      chartContainer.insertBefore(toolbar, chartContainer.firstChild);
    }

    if (!el('historyNoteModalBackdrop')) {
      const modal = document.createElement('div');
      modal.className = 'history-note-modal-backdrop';
      modal.id = 'historyNoteModalBackdrop';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="history-note-modal" role="dialog" aria-modal="true" aria-labelledby="historyNoteModalTitle">
          <div class="history-note-modal-header">
            <div>
              <h3 id="historyNoteModalTitle">Anotação do gráfico</h3>
              <p>A anotação fica no topo do gráfico, alinhada pelo horário escolhido.</p>
            </div>
            <button type="button" class="history-note-icon-btn" id="historyNoteCloseBtn" aria-label="Fechar">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <input type="hidden" id="historyNoteId">

          <div class="history-note-form-grid">
            <div class="history-note-field">
              <label for="historyNoteDate">Data</label>
              <input type="date" id="historyNoteDate">
            </div>
            <div class="history-note-field">
              <label for="historyNoteStart">Horário inicial</label>
              <input type="time" id="historyNoteStart">
            </div>
            <div class="history-note-field">
              <label for="historyNoteEnd">Horário final</label>
              <input type="time" id="historyNoteEnd">
            </div>
          </div>

          <div class="history-note-field">
            <label for="historyNoteMessage">Mensagem</label>
            <textarea id="historyNoteMessage" rows="4" placeholder="Digite a mensagem da anotação..."></textarea>
          </div>

          <div class="history-note-modal-actions">
            <button type="button" class="history-note-danger-btn" id="historyNoteDeleteBtn">
              <i class="fas fa-trash"></i>
              Remover
            </button>
            <div class="history-note-modal-actions-right">
              <button type="button" class="history-note-secondary-btn" id="historyNoteCancelBtn">Cancelar</button>
              <button type="button" class="history-note-primary-btn" id="historyNoteSaveBtn">
                <i class="fas fa-save"></i>
                Salvar
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }

  function getChart() {
    const canvas = el('historyChart');
    if (!canvas || !window.Chart) return null;
    return Chart.getChart(canvas) || window.historyChart || state.chart || null;
  }

  function xScale(chart) {
    if (!chart || !chart.scales) return null;
    return chart.scales.x || Object.values(chart.scales).find(s => s.axis === 'x');
  }

  function labelHour(label) {
    const m = String(label ?? '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) + Number(m[2]) / 60 : null;
  }

  function pixelForHour(chart, hour) {
    const xs = xScale(chart);
    if (!xs) return NaN;

    let px = xs.getPixelForValue(hour);
    if (Number.isFinite(px) && px >= xs.left - 80 && px <= xs.right + 80) return px;

    const labels = chart.data?.labels || [];
    if (labels.length) {
      let best = 0, diff = Infinity;
      labels.forEach((lab, i) => {
        const h = labelHour(lab);
        if (h == null) return;
        const d = Math.abs(h - hour);
        if (d < diff) {
          diff = d;
          best = i;
        }
      });
      px = xs.getPixelForValue(best);
    }

    return px;
  }

  function hasFirebase() {
    return !!(window.firebase && firebase.database);
  }

  function dbPath() {
    return `${ROOT}/${safeKey(getMachine())}/${getDate()}`;
  }

  function localKey() {
    return `wmoldes_notes_${safeKey(getMachine())}_${getDate()}`;
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(localKey()) || '[]'); } catch { return []; }
  }

  function saveLocal(rows) {
    localStorage.setItem(localKey(), JSON.stringify(rows));
  }

  function updateButton() {
    ensureUI();

    const toolbar = el('historyNotesToolbar');
    if (!toolbar) return;

    const ok = !!getMachine();

    toolbar.style.display = ok ? 'flex' : 'none';
    toolbar.classList.toggle('is-disabled', !ok);
  }

  function subscribeNotes() {
    updateButton();

    const machine = getMachine();

    if (!machine) {
      state.notes = [];
      redraw();
      return;
    }

    if (!hasFirebase()) {
      state.notes = loadLocal();
      redraw();
      return;
    }

    const path = dbPath();

    if (state.subscribedPath && state.subscribedPath !== path) {
      try { firebase.database().ref(state.subscribedPath).off(); } catch {}
    }

    state.subscribedPath = path;

    try {
      firebase.database().ref(path).off();
      firebase.database().ref(path).on('value', snap => {
        const val = snap.val() || {};
        state.notes = Object.keys(val).map(id => ({
          id,
          machine,
          date: getDate(),
          ...val[id]
        }));
        redraw();
      });
    } catch (err) {
      console.warn('Falha ao carregar anotações:', err);
    }
  }

  function fields(obj, names) {
    if (!obj) return undefined;
    for (const n of names) {
      if (obj[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n];
    }
    return undefined;
  }

  function maintenanceRowsFrom(source, machine) {
    if (!source) return [];

    const direct = source[machine] || source[String(machine)];

    if (Array.isArray(direct)) return direct;

    if (direct && typeof direct === 'object') {
      const looksRecord = fields(direct, [
        'status','isInMaintenance','emManutencao','maintenance','manutencao',
        'startTime','horaInicio','startedAt','endTime','horaFim','endedAt','createdAt'
      ]);
      return looksRecord ? [direct] : Object.values(direct);
    }

    if (Array.isArray(source)) {
      return source.filter(r => String(fields(r, ['machine','maquina','machineId','nomeMaquina']) || '') === String(machine));
    }

    return [];
  }

  function isMaintenance(row) {
    const status = String(fields(row, ['status','state','estado','tipoStatus']) || '').toLowerCase();
    const type = String(fields(row, ['type','tipo','eventType','evento']) || '').toLowerCase();
    const msg = String(fields(row, ['message','mensagem','reason','motivo','observacao','observação']) || '').toLowerCase();

    return row?.isInMaintenance === true ||
      row?.emManutencao === true ||
      row?.maintenance === true ||
      row?.manutencao === true ||
      status.includes('manut') ||
      status.includes('maintenance') ||
      status.includes('parada') ||
      type.includes('manut') ||
      type.includes('maintenance') ||
      msg.includes('manutenção') ||
      msg.includes('manutencao') ||
      msg.includes('corretiva');
  }

  function maintenanceIntervals() {
    const machine = getMachine();
    if (!machine) return [];

    const sources = [
      window.machineMaintenance,
      window.maintenanceData,
      window.allMachineMaintenance,
      window.manutencoes,
      window.maintenanceRecords,
      window.maintenanceHistory,
      window.historicoManutencao,
      window.allAdminMachines,
      window.allMachinesData
    ].filter(Boolean);

    const rows = [];
    sources.forEach(src => maintenanceRowsFrom(src, machine).forEach(r => rows.push(r)));

    const intervals = rows.filter(isMaintenance).map((r, i) => {
      const start = extractTime(fields(r, [
        'startTime','horaInicio','inicio','maintenanceStart','startedAt',
        'inicioManutencao','start','createdAt','timestamp','dataInicio'
      ]));
      const end = extractTime(fields(r, [
        'endTime','horaFim','fim','maintenanceEnd','endedAt',
        'fimManutencao','end','returnedAt','retorno','returnTime','dataFim'
      ]));
      const range = selectedRange();

      return {
        id: `maintenance_${i}_${start}_${end}`,
        machine,
        date: getDate(),
        startTime: start || range.start,
        endTime: end || range.end,
        message: `PARADA PARA MANUTENÇÃO CORRETIVA${fields(r, ['reason','motivo','message','mensagem','observacao','observação']) ? '\nMotivo: ' + fields(r, ['reason','motivo','message','mensagem','observacao','observação']) : ''}`,
        author: 'Sistema',
        updatedAtText: end ? 'Período registrado' : 'Em manutenção no momento',
        maintenance: true
      };
    });

    const seen = new Set();

    return intervals.filter(i => {
      const k = `${i.startTime}|${i.endTime}|${i.message}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function visibleNotes() {
    const machine = getMachine();
    if (!machine) return [];

    const date = getDate();
    const range = selectedRange();
    const rs = timeToMin(range.start);
    const re = timeToMin(range.end);

    const saved = state.notes.filter(n => {
      const s = timeToMin(n.startTime);
      const e = timeToMin(n.endTime || n.startTime);
      return normalizeDate(n.date || date) === date && e >= rs && s <= re;
    });

    return [...maintenanceIntervals(), ...saved];
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function forcePadding(chart) {
    if (!chart || !chart.options) return;
    chart.options.layout = chart.options.layout || {};
    chart.options.layout.padding = chart.options.layout.padding || {};
    chart.options.layout.padding.top = Math.max(Number(chart.options.layout.padding.top || 0), 72);
  }

  const notesPlugin = {
    id: 'wmoldesNotesPluginComplete',
    beforeInit(chart) {
      forcePadding(chart);
    },
    beforeUpdate(chart) {
      forcePadding(chart);
    },
    afterDatasetsDraw(chart) {
      state.chart = chart;

      const xs = xScale(chart);
      if (!xs || !chart.chartArea) return;

      const ctx = chart.ctx;
      const top = Math.max(8, chart.chartArea.top - 62);
      const notes = visibleNotes();
      const occupied = [];

      notes.forEach(note => {
        const startH = minToHour(timeToMin(note.startTime));
        const endH = minToHour(timeToMin(note.endTime || note.startTime));
        const startX = pixelForHour(chart, startH);
        const endX = pixelForHour(chart, endH);
        const midX = pixelForHour(chart, (startH + endH) / 2);

        if (!Number.isFinite(midX)) return;

        if (note.maintenance) {
          let left = Math.max(chart.chartArea.left + 4, Math.min(startX, endX));
          let right = Math.min(chart.chartArea.right - 4, Math.max(startX, endX));

          if (!Number.isFinite(left) || !Number.isFinite(right) || right - left < 12) {
            left = Math.max(chart.chartArea.left + 4, midX - 40);
            right = Math.min(chart.chartArea.right - 4, midX + 40);
          }

          const w = Math.max(18, right - left);
          const y = top;
          const h = 20;

          note.__hit = { x: left, y, w, h };

          ctx.save();

          ctx.fillStyle = 'rgba(100,116,139,.22)';
          roundRect(ctx, left, y, w, h, 9);
          ctx.fill();

          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.3;
          roundRect(ctx, left, y, w, h, 9);
          ctx.stroke();

          ctx.fillStyle = '#334155';
          ctx.font = '700 11px system-ui,-apple-system,Segoe UI,sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(w > 135 ? 'Manutenção corretiva' : 'Manutenção', left + 10, y + h / 2);

          ctx.strokeStyle = 'rgba(71,85,105,.35)';
          ctx.setLineDash([4,5]);
          ctx.beginPath();
          ctx.moveTo(left, y + h + 3);
          ctx.lineTo(left, chart.chartArea.bottom);
          ctx.moveTo(right, y + h + 3);
          ctx.lineTo(right, chart.chartArea.bottom);
          ctx.stroke();

          ctx.restore();
          return;
        }

        let row = 0;
        while (occupied.some(o => Math.abs(o.x - midX) < 38 && o.row === row)) row++;
        row = Math.min(row, 1);
        occupied.push({ x: midX, row });

        const w = 32;
        const h = 24;
        const left = Math.max(chart.chartArea.left + 4, Math.min(midX - w / 2, chart.chartArea.right - w - 4));
        const y = top + 28 + row * 28;

        note.__hit = { x: left, y, w, h };

        ctx.save();

        ctx.strokeStyle = 'rgba(245,158,11,.32)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4,5]);
        ctx.beginPath();
        ctx.moveTo(midX, y + h + 4);
        ctx.lineTo(midX, chart.chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.shadowColor = 'rgba(15,23,42,.22)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#fbbf24';
        roundRect(ctx, left, y, w, h, 7);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1;
        roundRect(ctx, left, y, w, h, 7);
        ctx.stroke();

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

        ctx.restore();
      });
    }
  };

  function registerPlugin() {
    if (!window.Chart) return;

    try {
      if (!Chart.registry.plugins.get('wmoldesNotesPluginComplete')) {
        Chart.register(notesPlugin);
      }
    } catch {
      try { Chart.register(notesPlugin); } catch {}
    }
  }

  function redraw() {
    updateButton();
    registerPlugin();

    const chart = getChart();

    if (chart) {
      state.chart = chart;
      try {
        chart.update('none');
      } catch {
        try { chart.draw(); } catch {}
      }
    }
  }

  function tooltipEl() {
    if (state.tooltip) return state.tooltip;

    const t = document.createElement('div');
    t.className = 'history-note-tooltip';
    t.style.display = 'none';
    document.body.appendChild(t);
    state.tooltip = t;

    return t;
  }

  function hitNote(evt) {
    const chart = getChart();

    if (!chart || !chart.canvas) return null;

    const rect = chart.canvas.getBoundingClientRect();
    const sx = chart.canvas.width / rect.width;
    const sy = chart.canvas.height / rect.height;
    const x = (evt.clientX - rect.left) * sx;
    const y = (evt.clientY - rect.top) * sy;
    const notes = visibleNotes();

    for (let i = notes.length - 1; i >= 0; i--) {
      const h = notes[i].__hit;
      if (!h) continue;
      if (x >= h.x - 5 && x <= h.x + h.w + 5 && y >= h.y - 5 && y <= h.y + h.h + 5) {
        return notes[i];
      }
    }

    return null;
  }

  function showTooltip(note, evt) {
    const t = tooltipEl();

    if (!note) {
      t.style.display = 'none';
      return;
    }

    t.innerHTML = `
      <div class="history-note-tooltip-time ${note.maintenance ? 'maintenance' : ''}">${esc(note.startTime)} - ${esc(note.endTime || note.startTime)}</div>
      <div class="history-note-tooltip-message">${esc(note.message)}</div>
      <div class="history-note-tooltip-meta">${esc(note.author || 'Usuário')} • ${esc(note.updatedAtText || note.createdAtText || '')}</div>
      <div class="history-note-tooltip-actions">${note.maintenance ? 'Faixa automática de manutenção' : 'Clique para editar/remover'}</div>
    `;

    t.style.display = 'block';

    let left = evt.clientX + 14;
    let top = evt.clientY + 14;
    const r = t.getBoundingClientRect();

    if (left + r.width > window.innerWidth - 12) left = evt.clientX - r.width - 14;
    if (top + r.height > window.innerHeight - 12) top = evt.clientY - r.height - 14;

    t.style.left = Math.max(12, left) + 'px';
    t.style.top = Math.max(12, top) + 'px';
  }

  function bindCanvas() {
    const canvas = el('historyChart');

    if (!canvas || canvas.__wmNotesBoundComplete) return;

    canvas.__wmNotesBoundComplete = true;

    canvas.addEventListener('mousemove', evt => {
      const n = hitNote(evt);
      canvas.style.cursor = n ? 'pointer' : '';
      showTooltip(n, evt);
    });

    canvas.addEventListener('mouseleave', () => showTooltip(null));

    canvas.addEventListener('click', evt => {
      const n = hitNote(evt);
      if (n && !n.maintenance) openModal(n);
    });
  }

  function defaultStart() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 5) * 5)}`;
  }

  function defaultEnd() {
    const d = new Date(Date.now() + 30 * 60000);
    return `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 5) * 5)}`;
  }

  function openModal(note) {
    ensureUI();

    const machine = getMachine();

    if (!machine) {
      alert('Selecione uma máquina antes de criar uma anotação.');
      updateButton();
      return;
    }

    const modal = el('historyNoteModalBackdrop');

    if (!modal) {
      alert('Modal de anotação não encontrado.');
      return;
    }

    el('historyNoteId').value = note?.id || '';
    el('historyNoteDate').value = normalizeDate(note?.date || getDate());
    el('historyNoteStart').value = note?.startTime || defaultStart();
    el('historyNoteEnd').value = note?.endTime || defaultEnd();
    el('historyNoteMessage').value = note?.message || '';

    const del = el('historyNoteDeleteBtn');
    if (del) del.style.display = note ? 'inline-flex' : 'none';

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    setTimeout(() => el('historyNoteMessage')?.focus(), 50);
  }

  function closeModal() {
    const modal = el('historyNoteModalBackdrop');
    if (!modal) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function saveNote() {
    const machine = getMachine();
    const date = normalizeDate(el('historyNoteDate')?.value || getDate());
    const startTime = el('historyNoteStart')?.value || '';
    const endTime = el('historyNoteEnd')?.value || '';
    const message = String(el('historyNoteMessage')?.value || '').trim();
    const id = el('historyNoteId')?.value || '';

    if (!machine) return alert('Selecione uma máquina.');
    if (!date) return alert('Selecione a data.');
    if (!startTime || !endTime) return alert('Informe horário inicial e final.');
    if (timeToMin(endTime) < timeToMin(startTime)) return alert('O horário final não pode ser menor que o inicial.');
    if (!message) return alert('Digite a mensagem.');

    const authorText = el('currentUserEmail')?.textContent || 'Usuário';

    const payload = {
      machine,
      date,
      startTime,
      endTime,
      message,
      author: authorText === 'Carregando...' ? 'Usuário' : authorText,
      updatedAt: Date.now(),
      updatedAtText: nowText()
    };

    if (hasFirebase()) {
      const base = firebase.database().ref(`${ROOT}/${safeKey(machine)}/${date}`);
      if (id) {
        await base.child(id).update(payload);
      } else {
        await base.push({ ...payload, createdAt: Date.now(), createdAtText: nowText() });
      }
    } else {
      const rows = loadLocal();

      if (id) {
        const ix = rows.findIndex(r => r.id === id);
        if (ix >= 0) rows[ix] = { ...rows[ix], ...payload };
      } else {
        rows.push({ id: `local_${Date.now()}`, ...payload, createdAt: Date.now(), createdAtText: nowText() });
      }

      saveLocal(rows);
      state.notes = rows;
    }

    closeModal();
    subscribeNotes();
  }

  async function deleteNote() {
    const id = el('historyNoteId')?.value || '';

    if (!id) return;
    if (!confirm('Remover esta anotação?')) return;

    const machine = getMachine();
    const date = getDate();

    if (hasFirebase()) {
      await firebase.database().ref(`${ROOT}/${safeKey(machine)}/${date}`).child(id).remove();
    } else {
      const rows = loadLocal().filter(r => r.id !== id);
      saveLocal(rows);
      state.notes = rows;
    }

    closeModal();
    subscribeNotes();
  }

  function bindUI() {
    ensureUI();

    const add = el('historyNoteAddBtn');

    if (add && !add.__wmBoundComplete) {
      add.__wmBoundComplete = true;
      add.addEventListener('click', evt => {
        evt.preventDefault();
        openModal(null);
      });
    }

    const close = el('historyNoteCloseBtn');
    if (close && !close.__wmBoundComplete) {
      close.__wmBoundComplete = true;
      close.addEventListener('click', closeModal);
    }

    const cancel = el('historyNoteCancelBtn');
    if (cancel && !cancel.__wmBoundComplete) {
      cancel.__wmBoundComplete = true;
      cancel.addEventListener('click', closeModal);
    }

    const save = el('historyNoteSaveBtn');
    if (save && !save.__wmBoundComplete) {
      save.__wmBoundComplete = true;
      save.addEventListener('click', saveNote);
    }

    const del = el('historyNoteDeleteBtn');
    if (del && !del.__wmBoundComplete) {
      del.__wmBoundComplete = true;
      del.addEventListener('click', deleteNote);
    }

    const backdrop = el('historyNoteModalBackdrop');
    if (backdrop && !backdrop.__wmBoundComplete) {
      backdrop.__wmBoundComplete = true;
      backdrop.addEventListener('click', evt => {
        if (evt.target === backdrop) closeModal();
      });
    }

    const machine = el('historyMachineSelect');
    if (machine && !machine.__wmNoteSelectBoundComplete) {
      machine.__wmNoteSelectBoundComplete = true;

      machine.addEventListener('change', () => setTimeout(subscribeNotes, 150));
      machine.addEventListener('input', () => setTimeout(subscribeNotes, 150));

      if (window.MutationObserver) {
        new MutationObserver(() => setTimeout(subscribeNotes, 150))
          .observe(machine, { childList: true, subtree: true, attributes: true });
      }
    }

    const date = el('historyDate');
    if (date && !date.__wmNoteDateBoundComplete) {
      date.__wmNoteDateBoundComplete = true;
      date.addEventListener('change', () => setTimeout(subscribeNotes, 150));
      date.addEventListener('input', () => setTimeout(subscribeNotes, 150));
    }

    const start = el('customStartTime');
    if (start && !start.__wmNoteBoundComplete) {
      start.__wmNoteBoundComplete = true;
      start.addEventListener('change', redraw);
    }

    const end = el('customEndTime');
    if (end && !end.__wmNoteBoundComplete) {
      end.__wmNoteBoundComplete = true;
      end.addEventListener('change', redraw);
    }
  }

  function init() {
    if (state.ready) return;
    state.ready = true;

    ensureUI();
    registerPlugin();
    bindUI();
    bindCanvas();
    updateButton();

    setTimeout(subscribeNotes, 500);
    setTimeout(redraw, 1200);

    setInterval(() => {
      ensureUI();
      registerPlugin();
      bindUI();
      bindCanvas();
      updateButton();

      const chart = getChart();

      if (chart && chart !== state.chart) {
        state.chart = chart;
        redraw();
      }
    }, 1000);
  }

  window.WMoldesHistoryNotes = {
    open: () => openModal(null),
    refresh: () => subscribeNotes(),
    redraw: () => redraw()
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
