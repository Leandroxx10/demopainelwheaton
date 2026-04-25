/* WMoldes - Anotações profissionais dentro do gráfico do histórico
   - Salva por máquina + data escolhida
   - Desenha o bloco de notas no topo do gráfico, alinhado ao horário escolhido
   - Hover: tooltip moderno
   - Clique: editar/remover
*/
(function () {
  'use strict';

  const STATE = {
    notes: [],
    markerRects: [],
    unsubscribe: null,
    hoverNoteId: null,
    editingId: null,
    initialized: false,
  };

  const COLORS = ['#facc15', '#60a5fa', '#a78bfa', '#fb7185', '#34d399', '#f97316'];

  function pad2(v) { return String(v).padStart(2, '0'); }
  function nowTs() { return Date.now(); }
  function getCanvas() { return document.getElementById('historyChart'); }
  function getChart() { const canvas = getCanvas(); return canvas && window.Chart ? Chart.getChart(canvas) : null; }
  function getMachine() { return document.getElementById('historyMachineSelect')?.value || ''; }
  function getDateBR() { return document.getElementById('historyDate')?.value || ''; }
  function brToISO(br) { const [d,m,y] = String(br || '').split('/'); return y && m && d ? `${y}-${m}-${d}` : ''; }
  function isoToBR(iso) { const [y,m,d] = String(iso || '').split('-'); return y && m && d ? `${d}/${m}/${y}` : ''; }
  function dateForInput() { return brToISO(getDateBR()) || new Date().toISOString().slice(0,10); }
  function sanitizeKey(value) { return String(value || '').replace(/[.#$\[\]/]/g, '_'); }
  function toMin(time) { const [h,m] = String(time || '00:00').split(':').map(Number); return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0); }
  function timeLabelToMin(label) { const match = String(label || '').match(/(\d{1,2}):(\d{2})/); return match ? Number(match[1]) * 60 + Number(match[2]) : null; }
  function currentUserEmail() { return window.firebase?.auth?.().currentUser?.email || window.currentUser?.email || 'Admin'; }

  function refBase() {
    if (window.firebase && firebase.database) return firebase.database().ref('historicoAnotacoesGrafico');
    if (window.database && database.ref) return database.ref('historicoAnotacoesGrafico');
    return null;
  }

  function notesRef(machine = getMachine(), dateISO = brToISO(getDateBR())) {
    const base = refBase();
    if (!base || !machine || !dateISO) return null;
    return base.child(sanitizeKey(machine)).child(dateISO);
  }

  function ensureCss() {
    if (document.getElementById('wmChartNotesInlineCss')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'history-chart-notes-pro.css?v=20260424-3';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.id = 'wmChartNotesInlineCss';
    style.textContent = `
      .chart-container,.chart-scroll,.chart-inner{position:relative!important}.chart-container{overflow:visible!important}.wm-chart-notes-toolbar{position:absolute!important;top:10px!important;right:14px!important;z-index:30!important}.wm-chart-notes-add{border:0!important;border-radius:999px!important;background:#2563eb!important;color:#fff!important;padding:9px 14px!important;font-size:13px!important;font-weight:800!important;box-shadow:0 10px 25px rgba(37,99,235,.28)!important;cursor:pointer!important}#historyNotesPanel,#historyNotesList,.history-notes-panel,.history-notes-list,.history-note-card,.history-graph-notes-panel,.graph-notes-list,.chart-notes-list{display:none!important}.wm-chart-note-tooltip{position:fixed!important;z-index:999999!important;width:min(320px,calc(100vw - 28px))!important;border:1px solid rgba(148,163,184,.28)!important;border-radius:16px!important;background:rgba(15,23,42,.96)!important;color:#e5e7eb!important;box-shadow:0 24px 70px rgba(15,23,42,.35)!important;padding:12px 14px!important;pointer-events:none!important;opacity:0!important;transform:translateY(8px) scale(.98)!important;transition:opacity .14s ease,transform .14s ease!important}.wm-chart-note-tooltip.show{opacity:1!important;transform:translateY(0) scale(1)!important}.wm-chart-note-tooltip .wm-note-time{color:#fde68a!important;font-weight:800!important;font-size:13px!important;margin-bottom:6px!important}.wm-chart-note-tooltip .wm-note-message{color:#f8fafc!important;font-size:14px!important;line-height:1.4!important;white-space:pre-wrap!important}.wm-chart-note-tooltip .wm-note-meta{color:#94a3b8!important;font-size:12px!important;margin-top:9px!important}.wm-note-modal-backdrop{position:fixed!important;inset:0!important;background:rgba(15,23,42,.58)!important;z-index:999998!important;display:none!important;align-items:center!important;justify-content:center!important;padding:18px!important}.wm-note-modal-backdrop.show{display:flex!important}.wm-note-modal{width:min(560px,100%)!important;background:#fff!important;color:#0f172a!important;border-radius:22px!important;box-shadow:0 30px 90px rgba(15,23,42,.35)!important;overflow:hidden!important}.wm-note-modal-header{padding:18px 20px!important;border-bottom:1px solid #e5e7eb!important;display:flex!important;justify-content:space-between!important}.wm-note-modal-title{margin:0!important;font-size:18px!important;font-weight:800!important}.wm-note-modal-close{border:0!important;background:#f1f5f9!important;color:#334155!important;width:36px!important;height:36px!important;border-radius:999px!important;cursor:pointer!important}.wm-note-modal-body{padding:18px 20px!important;display:grid!important;gap:14px!important}.wm-note-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important}.wm-note-field label{display:block!important;font-size:12px!important;font-weight:800!important;color:#475569!important;margin-bottom:6px!important;text-transform:uppercase!important}.wm-note-field input,.wm-note-field textarea{width:100%!important;box-sizing:border-box!important;border:1px solid #cbd5e1!important;border-radius:12px!important;padding:10px 12px!important;font-size:14px!important;color:#0f172a!important;background:#fff!important;outline:none!important}.wm-note-field textarea{min-height:112px!important;resize:vertical!important}.wm-note-modal-footer{padding:14px 20px 20px!important;display:flex!important;justify-content:space-between!important;gap:10px!important;border-top:1px solid #e5e7eb!important}.wm-note-actions-left,.wm-note-actions-right{display:flex!important;gap:10px!important}.wm-note-btn{border:0!important;border-radius:12px!important;padding:10px 14px!important;font-weight:800!important;cursor:pointer!important;font-size:14px!important}.wm-note-btn-primary{background:#2563eb!important;color:#fff!important}.wm-note-btn-secondary{background:#e2e8f0!important;color:#0f172a!important}.wm-note-btn-danger{background:#fee2e2!important;color:#dc2626!important}@media(max-width:768px){.wm-note-grid{grid-template-columns:1fr!important}.wm-note-modal-footer{flex-direction:column-reverse!important}.wm-note-btn{flex:1!important}}
    `;
    document.head.appendChild(style);
  }

  function removeOldBrokenNotesUi() {
    document.querySelectorAll('section,div,article').forEach(el => {
      const text = (el.textContent || '').trim();
      if (/Bloco de notas do gráfico/i.test(text) && !el.classList.contains('chart-container')) {
        el.style.display = 'none';
        el.setAttribute('data-wm-old-notes-hidden', 'true');
      }
    });
  }

  function ensureToolbar() {
    const canvas = getCanvas();
    if (!canvas) return;
    const container = canvas.closest('.chart-container') || canvas.closest('.chart-inner') || canvas.parentElement;
    if (!container) return;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    if (container.querySelector('.wm-chart-notes-toolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'wm-chart-notes-toolbar';
    toolbar.innerHTML = `<button type="button" class="wm-chart-notes-add">+ Anotação</button>`;
    container.appendChild(toolbar);
    toolbar.querySelector('button').addEventListener('click', () => openModal());
  }

  function ensureTooltip() {
    let tip = document.getElementById('wmChartNoteTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'wmChartNoteTooltip';
      tip.className = 'wm-chart-note-tooltip';
      document.body.appendChild(tip);
    }
    return tip;
  }

  function ensureModal() {
    let modal = document.getElementById('wmNoteModalBackdrop');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wmNoteModalBackdrop';
    modal.className = 'wm-note-modal-backdrop';
    modal.innerHTML = `
      <div class="wm-note-modal" role="dialog" aria-modal="true" aria-labelledby="wmNoteModalTitle">
        <div class="wm-note-modal-header">
          <h3 class="wm-note-modal-title" id="wmNoteModalTitle">Anotação no gráfico</h3>
          <button type="button" class="wm-note-modal-close" data-note-close>×</button>
        </div>
        <form id="wmNoteForm">
          <div class="wm-note-modal-body">
            <div class="wm-note-grid">
              <div class="wm-note-field"><label>Data em que aparece</label><input type="date" id="wmNoteDate" required></div>
              <div class="wm-note-field"><label>Hora inicial</label><input type="time" id="wmNoteStart" required></div>
              <div class="wm-note-field"><label>Hora final</label><input type="time" id="wmNoteEnd" required></div>
            </div>
            <div class="wm-note-field"><label>Mensagem</label><textarea id="wmNoteMessage" placeholder="Digite a anotação que aparecerá ao passar o mouse..." required></textarea></div>
          </div>
          <div class="wm-note-modal-footer">
            <div class="wm-note-actions-left"><button type="button" class="wm-note-btn wm-note-btn-danger" id="wmNoteDelete" style="display:none">Remover</button></div>
            <div class="wm-note-actions-right"><button type="button" class="wm-note-btn wm-note-btn-secondary" data-note-close>Cancelar</button><button type="submit" class="wm-note-btn wm-note-btn-primary">Salvar</button></div>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.hasAttribute('data-note-close')) closeModal(); });
    modal.querySelector('#wmNoteForm').addEventListener('submit', saveFromModal);
    modal.querySelector('#wmNoteDelete').addEventListener('click', deleteCurrentNote);
    return modal;
  }

  function openModal(note) {
    const machine = getMachine();
    if (!machine) { alert('Selecione uma máquina antes de criar a anotação.'); return; }
    const modal = ensureModal();
    STATE.editingId = note?.id || null;
    modal.querySelector('#wmNoteDate').value = note?.dateISO || dateForInput();
    modal.querySelector('#wmNoteStart').value = note?.startTime || '';
    modal.querySelector('#wmNoteEnd').value = note?.endTime || note?.startTime || '';
    modal.querySelector('#wmNoteMessage').value = note?.message || '';
    modal.querySelector('#wmNoteDelete').style.display = note?.id ? '' : 'none';
    modal.classList.add('show');
    setTimeout(() => modal.querySelector('#wmNoteStart')?.focus(), 40);
  }
  function closeModal() { document.getElementById('wmNoteModalBackdrop')?.classList.remove('show'); STATE.editingId = null; }

  async function saveFromModal(e) {
    e.preventDefault();
    const machine = getMachine();
    const dateISO = document.getElementById('wmNoteDate').value;
    const startTime = document.getElementById('wmNoteStart').value;
    const endTime = document.getElementById('wmNoteEnd').value;
    const message = document.getElementById('wmNoteMessage').value.trim();
    if (!machine || !dateISO || !startTime || !endTime || !message) return;
    const ref = notesRef(machine, dateISO);
    if (!ref) { alert('Firebase não disponível para salvar a anotação.'); return; }
    const payload = { machine, dateISO, dateBR: isoToBR(dateISO), startTime, endTime, message, updatedAt: nowTs(), updatedBy: currentUserEmail() };
    if (STATE.editingId) await ref.child(STATE.editingId).update(payload);
    else await ref.push({ ...payload, createdAt: nowTs(), createdBy: currentUserEmail() });
    closeModal();
    const selectedISO = brToISO(getDateBR());
    if (dateISO !== selectedISO) alert('Anotação salva. Ela aparecerá quando você selecionar essa data no histórico.');
    subscribeNotes();
  }

  async function deleteCurrentNote() {
    if (!STATE.editingId) return;
    const note = STATE.notes.find(n => n.id === STATE.editingId);
    if (!note || !confirm('Remover esta anotação?')) return;
    const ref = notesRef(note.machine || getMachine(), note.dateISO || brToISO(getDateBR()));
    if (ref) await ref.child(note.id).remove();
    closeModal();
    subscribeNotes();
  }

  function subscribeNotes() {
    const ref = notesRef();
    if (STATE.unsubscribe) { try { STATE.unsubscribe(); } catch (_) {} STATE.unsubscribe = null; }
    STATE.notes = [];
    if (!ref) { redraw(); return; }
    const callback = (snap) => {
      const data = snap.val() || {};
      STATE.notes = Object.keys(data).map((id, index) => ({ id, color: COLORS[index % COLORS.length], ...(data[id] || {}) }))
        .sort((a,b) => toMin(a.startTime) - toMin(b.startTime));
      redraw();
    };
    ref.on('value', callback);
    STATE.unsubscribe = () => ref.off('value', callback);
  }

  function getXForMinute(chart, minute) {
    const scale = chart.scales.x;
    if (!scale) return null;
    const labels = chart.data.labels || [];
    if (!labels.length) return null;
    const mins = labels.map(timeLabelToMin);
    for (let i=0; i<mins.length; i++) {
      if (mins[i] === null) continue;
      if (minute === mins[i]) return scale.getPixelForValue(i);
      const next = mins[i+1];
      if (next === null || next === undefined) continue;
      if (minute > mins[i] && minute < next) {
        const x1 = scale.getPixelForValue(i);
        const x2 = scale.getPixelForValue(i+1);
        return x1 + ((minute - mins[i]) / (next - mins[i])) * (x2 - x1);
      }
    }
    const valid = mins.map((m,i) => ({m,i})).filter(o => o.m !== null);
    if (!valid.length) return null;
    if (minute < valid[0].m) return scale.getPixelForValue(valid[0].i);
    return scale.getPixelForValue(valid[valid.length-1].i);
  }

  const notesPlugin = {
    id: 'wmoldesChartNotesPlugin',
    afterDatasetsDraw(chart) {
      if (chart.canvas?.id !== 'historyChart') return;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      STATE.markerRects = [];
      const y = chartArea.top + 18; // área marcada em verde: topo interno do gráfico
      STATE.notes.forEach((note, idx) => {
        const x = getXForMinute(chart, toMin(note.startTime));
        if (x == null) return;
        const color = note.color || COLORS[idx % COLORS.length];
        const w = 22, h = 22, r = 6;
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, .22)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = color;
        roundRect(ctx, x - w/2, y - h/2, w, h, r);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(15,23,42,.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.globalAlpha = .78;
        ctx.fillRect(x - 5, y - 5, 10, 1.8);
        ctx.fillRect(x - 5, y - 1, 8, 1.8);
        ctx.fillRect(x - 5, y + 3, 6, 1.8);
        ctx.globalAlpha = 1;
        // Linha vertical sutil conectando o horário ao topo
        ctx.strokeStyle = color;
        ctx.globalAlpha = .35;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, y + h/2 + 4);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
        STATE.markerRects.push({ id: note.id, note, x: x - w/2 - 5, y: y - h/2 - 5, w: w + 10, h: h + 10 });
      });
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function findMarkerAtEvent(evt) {
    const canvas = getCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    return STATE.markerRects.find(m => x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) || null;
  }

  function showTooltip(marker, evt) {
    const tip = ensureTooltip();
    const n = marker.note;
    tip.innerHTML = `<div class="wm-note-time">${n.startTime} - ${n.endTime}</div><div class="wm-note-message"></div><div class="wm-note-meta">${n.updatedBy || n.createdBy || 'Admin'} • ${n.dateBR || isoToBR(n.dateISO)}</div>`;
    tip.querySelector('.wm-note-message').textContent = n.message || '';
    const left = Math.min(window.innerWidth - 340, Math.max(14, evt.clientX + 16));
    const top = Math.min(window.innerHeight - 170, Math.max(14, evt.clientY + 16));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.classList.add('show');
  }
  function hideTooltip() { document.getElementById('wmChartNoteTooltip')?.classList.remove('show'); }

  function setupCanvasEvents() {
    const canvas = getCanvas();
    if (!canvas || canvas.dataset.wmNotesEvents === '1') return;
    canvas.dataset.wmNotesEvents = '1';
    canvas.addEventListener('mousemove', (evt) => {
      const marker = findMarkerAtEvent(evt);
      if (marker) { canvas.style.cursor = 'pointer'; showTooltip(marker, evt); }
      else { canvas.style.cursor = ''; hideTooltip(); }
    });
    canvas.addEventListener('mouseleave', hideTooltip);
    canvas.addEventListener('click', (evt) => {
      const marker = findMarkerAtEvent(evt);
      if (marker) openModal(marker.note);
    });
  }

  function redraw() {
    const chart = getChart();
    if (chart) chart.draw();
  }

  function hookChanges() {
    ['historyMachineSelect', 'historyDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.dataset.wmNotesChange !== '1') {
        el.dataset.wmNotesChange = '1';
        el.addEventListener('change', () => setTimeout(subscribeNotes, 150));
      }
    });
  }

  function init() {
    ensureCss();
    removeOldBrokenNotesUi();
    ensureToolbar();
    ensureTooltip();
    ensureModal();
    setupCanvasEvents();
    hookChanges();
    subscribeNotes();
    STATE.initialized = true;
  }

  function waitForReady() {
    if (window.Chart && !Chart.registry.plugins.get('wmoldesChartNotesPlugin')) Chart.register(notesPlugin);
    if (getCanvas()) init();
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(waitForReady, 500));
  window.addEventListener('load', () => setTimeout(waitForReady, 1000));
  setInterval(() => {
    if (!getCanvas()) return;
    if (!STATE.initialized) waitForReady();
    removeOldBrokenNotesUi();
    ensureToolbar();
    setupCanvasEvents();
    hookChanges();
    redraw();
  }, 1500);
})();
