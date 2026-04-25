/* ==========================================================
   WMoldes - Anotações do Histórico
   Bloco de notas por máquina/data/intervalo, integrado ao gráfico.
   Banco: Firebase Realtime Database -> historicoAnotacoes/{maquina}/{dataISO}/{id}
   ========================================================== */
(function () {
  'use strict';

  const DB_ROOT = 'historicoAnotacoes';
  const COLORS = ['#facc15', '#60a5fa', '#a78bfa', '#fb7185', '#34d399', '#f97316'];

  let notes = [];
  let editingId = null;
  let firebaseListenerRef = null;
  let initialized = false;
  let refreshTimer = null;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeFirebaseKey(value) {
    return String(value || '')
      .trim()
      .replace(/[.#$\[\]/]/g, '_')
      .replace(/\s+/g, '_') || 'sem_maquina';
  }

  function brDateToISO(value) {
    const parts = String(value || '').split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  function getSelectedMachine() {
    return $('#historyMachineSelect')?.value || '';
  }

  function getSelectedDateBR() {
    return $('#historyDate')?.value || '';
  }

  function getSelectedDateISO() {
    return brDateToISO(getSelectedDateBR());
  }

  function toMinutes(time) {
    const [h, m] = String(time || '00:00').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  function getPeriodRangeMinutes() {
    const active = $('.period-btn.active, .period-option.active');
    const period = active?.getAttribute('data-period') || '24h';

    if (period === 'shift1' || period === 'turno1') return { start: 360, end: 840 };
    if (period === 'shift2' || period === 'turno2') return { start: 840, end: 1320 };
    if (period === 'shift3' || period === 'turno3') return { start: 1320, end: 1800 };

    if (period === 'custom') {
      const start = toMinutes($('#customStartTime')?.value || '00:00');
      const endRaw = toMinutes($('#customEndTime')?.value || '23:59');
      return { start, end: start > endRaw ? endRaw + 1440 : endRaw };
    }

    return { start: 0, end: 1439 };
  }

  function noteMidpointMinutes(note) {
    const start = toMinutes(note.horaInicio);
    let end = toMinutes(note.horaFim);
    if (end < start) end += 1440;
    return start + ((end - start) / 2);
  }

  function isNoteVisibleInPeriod(note) {
    const range = getPeriodRangeMinutes();
    let start = toMinutes(note.horaInicio);
    let end = toMinutes(note.horaFim);
    if (end < start) end += 1440;

    const noteStart = start;
    const noteEnd = end;
    return noteEnd >= range.start && noteStart <= range.end;
  }

  function getDatabaseRef() {
    if (!window.db || !getSelectedMachine() || !getSelectedDateISO()) return null;
    return window.db
      .ref(DB_ROOT)
      .child(sanitizeFirebaseKey(getSelectedMachine()))
      .child(getSelectedDateISO());
  }

  function getCurrentUserName() {
    const user = window.auth?.currentUser;
    return user?.email || localStorage.getItem('userEmail') || 'Admin';
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function showToast(type, message) {
    if (typeof window.showAlert === 'function') {
      window.showAlert(type === 'error' ? 'erro' : 'sucesso', message);
      return;
    }
    console[type === 'error' ? 'error' : 'log'](message);
  }

  function ensureUI() {
    if ($('#historyNotesPanel')) return;

    const chartContainer = $('#historyChart')?.closest('.chart-container') || $('.chart-container');
    if (!chartContainer) return;

    chartContainer.classList.add('history-notes-enabled');

    const toolbar = document.createElement('div');
    toolbar.className = 'history-notes-toolbar';
    toolbar.innerHTML = `
      <div class="history-notes-title">
        <span class="history-notes-title-icon">📝</span>
        <div>
          <strong>Bloco de notas do gráfico</strong>
          <small>Anotações por máquina, data e horário</small>
        </div>
      </div>
      <button type="button" class="history-note-add-btn" id="openHistoryNoteFormBtn">
        + Nova anotação
      </button>
    `;

    const panel = document.createElement('section');
    panel.id = 'historyNotesPanel';
    panel.className = 'history-notes-panel';
    panel.innerHTML = `
      <div class="history-notes-list" id="historyNotesList">
        <div class="history-notes-empty">Selecione uma máquina/data para visualizar as anotações.</div>
      </div>
    `;

    chartContainer.insertBefore(toolbar, chartContainer.firstChild);
    chartContainer.appendChild(panel);

    const chartInner = $('#historyChart')?.closest('.chart-inner') || $('#historyChart')?.parentElement;
    if (chartInner) {
      chartInner.classList.add('history-notes-chart-inner');
      if (!$('#historyNotesMarkersLayer')) {
        const layer = document.createElement('div');
        layer.id = 'historyNotesMarkersLayer';
        layer.className = 'history-notes-markers-layer';
        chartInner.appendChild(layer);
      }
    }

    buildModal();
    $('#openHistoryNoteFormBtn')?.addEventListener('click', () => openForm());
  }

  function buildModal() {
    if ($('#historyNoteModal')) return;
    const modal = document.createElement('div');
    modal.id = 'historyNoteModal';
    modal.className = 'history-note-modal';
    modal.innerHTML = `
      <div class="history-note-modal-card" role="dialog" aria-modal="true" aria-labelledby="historyNoteModalTitle">
        <button type="button" class="history-note-modal-close" id="closeHistoryNoteModalBtn" aria-label="Fechar">×</button>
        <div class="history-note-modal-head">
          <span class="history-note-modal-icon">📝</span>
          <div>
            <h3 id="historyNoteModalTitle">Nova anotação</h3>
            <p>Salve uma observação vinculada ao intervalo do gráfico.</p>
          </div>
        </div>
        <form id="historyNoteForm" class="history-note-form">
          <div class="history-note-form-grid">
            <label>
              <span>Hora inicial</span>
              <input type="time" id="historyNoteStart" required>
            </label>
            <label>
              <span>Hora final</span>
              <input type="time" id="historyNoteEnd" required>
            </label>
          </div>
          <label>
            <span>Mensagem</span>
            <textarea id="historyNoteMessage" rows="5" maxlength="500" placeholder="Digite a observação do período..." required></textarea>
          </label>
          <div class="history-note-form-actions">
            <button type="button" class="history-note-secondary" id="cancelHistoryNoteBtn">Cancelar</button>
            <button type="submit" class="history-note-primary">Salvar anotação</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    $('#closeHistoryNoteModalBtn')?.addEventListener('click', closeForm);
    $('#cancelHistoryNoteBtn')?.addEventListener('click', closeForm);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeForm();
    });
    $('#historyNoteForm')?.addEventListener('submit', saveNote);
  }

  function openForm(note = null) {
    const machine = getSelectedMachine();
    const date = getSelectedDateBR();
    if (!machine || !date) {
      showToast('error', 'Selecione uma máquina e uma data antes de criar a anotação.');
      return;
    }

    editingId = note?.id || null;
    $('#historyNoteModalTitle').textContent = editingId ? 'Editar anotação' : 'Nova anotação';
    $('#historyNoteStart').value = note?.horaInicio || '';
    $('#historyNoteEnd').value = note?.horaFim || '';
    $('#historyNoteMessage').value = note?.mensagem || '';
    $('#historyNoteModal').classList.add('active');
    setTimeout(() => $('#historyNoteStart')?.focus(), 50);
  }

  function closeForm() {
    editingId = null;
    $('#historyNoteForm')?.reset();
    $('#historyNoteModal')?.classList.remove('active');
  }

  async function saveNote(event) {
    event.preventDefault();
    const ref = getDatabaseRef();
    if (!ref) {
      showToast('error', 'Não foi possível localizar a máquina/data no Firebase.');
      return;
    }

    const horaInicio = $('#historyNoteStart').value;
    const horaFim = $('#historyNoteEnd').value;
    const mensagem = $('#historyNoteMessage').value.trim();

    if (!horaInicio || !horaFim || !mensagem) {
      showToast('error', 'Preencha hora inicial, hora final e mensagem.');
      return;
    }

    const now = Date.now();
    const user = getCurrentUserName();
    const payload = {
      maquina: getSelectedMachine(),
      data: getSelectedDateBR(),
      dataISO: getSelectedDateISO(),
      horaInicio,
      horaFim,
      mensagem,
      atualizadoEm: now,
      atualizadoPor: user
    };

    try {
      if (editingId) {
        await ref.child(editingId).update(payload);
        await audit('editou anotação do histórico', editingId, payload);
      } else {
        const newRef = ref.push();
        await newRef.set({
          ...payload,
          criadoEm: now,
          criadoPor: user
        });
        await audit('criou anotação do histórico', newRef.key, payload);
      }
      closeForm();
      showToast('success', 'Anotação salva com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar anotação:', error);
      showToast('error', 'Erro ao salvar anotação.');
    }
  }

  async function removeNote(noteId) {
    const note = notes.find(item => item.id === noteId);
    if (!note) return;
    const confirmed = window.confirm(`Remover a anotação de ${note.horaInicio} até ${note.horaFim}?`);
    if (!confirmed) return;

    try {
      const ref = getDatabaseRef();
      await ref.child(noteId).remove();
      await audit('removeu anotação do histórico', noteId, note);
      showToast('success', 'Anotação removida.');
    } catch (error) {
      console.error('Erro ao remover anotação:', error);
      showToast('error', 'Erro ao remover anotação.');
    }
  }

  async function audit(action, noteId, data) {
    if (typeof window.writeAuditLog !== 'function') return;
    try {
      await window.writeAuditLog({
        action,
        details: `${data.horaInicio || ''} - ${data.horaFim || ''}: ${data.mensagem || ''}`,
        targetPath: `${DB_ROOT}/${sanitizeFirebaseKey(getSelectedMachine())}/${getSelectedDateISO()}/${noteId}`,
        entityType: 'history_note',
        entityId: noteId,
        after: data,
        extra: {
          machineId: getSelectedMachine(),
          data: getSelectedDateBR(),
          origem: 'history-notes'
        }
      });
    } catch (error) {
      console.warn('Não foi possível registrar auditoria da anotação:', error);
    }
  }

  function listenNotes() {
    ensureUI();

    if (firebaseListenerRef) {
      firebaseListenerRef.off('value');
      firebaseListenerRef = null;
    }

    const ref = getDatabaseRef();
    if (!ref) {
      notes = [];
      renderNotes();
      return;
    }

    firebaseListenerRef = ref;
    ref.on('value', snapshot => {
      const data = snapshot.val() || {};
      notes = Object.keys(data).map((id, index) => ({
        id,
        color: data[id].color || COLORS[index % COLORS.length],
        ...data[id]
      })).sort((a, b) => toMinutes(a.horaInicio) - toMinutes(b.horaInicio));
      renderNotes();
    }, error => {
      console.error('Erro ao carregar anotações:', error);
      showToast('error', 'Erro ao carregar anotações do gráfico.');
    });
  }

  function renderNotes() {
    renderNotesList();
    renderMarkers();
  }

  function renderNotesList() {
    const list = $('#historyNotesList');
    if (!list) return;

    if (!getSelectedMachine() || !getSelectedDateBR()) {
      list.innerHTML = '<div class="history-notes-empty">Selecione uma máquina/data para visualizar as anotações.</div>';
      return;
    }

    if (!notes.length) {
      list.innerHTML = '<div class="history-notes-empty">Nenhuma anotação salva para este gráfico.</div>';
      return;
    }

    list.innerHTML = notes.map(note => `
      <article class="history-note-card" style="--note-color:${escapeHtml(note.color)}">
        <div class="history-note-card-icon">📝</div>
        <div class="history-note-card-time">${escapeHtml(note.horaInicio)} - ${escapeHtml(note.horaFim)}</div>
        <div class="history-note-card-message">${escapeHtml(note.mensagem)}</div>
        <div class="history-note-card-meta">${escapeHtml(note.atualizadoPor || note.criadoPor || 'Admin')} • ${escapeHtml(formatDateTime(note.atualizadoEm || note.criadoEm))}</div>
        <div class="history-note-card-actions">
          <button type="button" data-note-edit="${escapeHtml(note.id)}" title="Editar anotação">✎</button>
          <button type="button" data-note-remove="${escapeHtml(note.id)}" title="Remover anotação">🗑</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-note-edit]').forEach(button => {
      button.addEventListener('click', () => {
        const note = notes.find(item => item.id === button.dataset.noteEdit);
        if (note) openForm(note);
      });
    });

    list.querySelectorAll('[data-note-remove]').forEach(button => {
      button.addEventListener('click', () => removeNote(button.dataset.noteRemove));
    });
  }

  function renderMarkers() {
    const layer = $('#historyNotesMarkersLayer');
    const chartInner = $('#historyChart')?.closest('.chart-inner') || $('#historyChart')?.parentElement;
    if (!layer || !chartInner) return;

    const visibleNotes = notes.filter(isNoteVisibleInPeriod);
    if (!visibleNotes.length) {
      layer.innerHTML = '';
      return;
    }

    const range = getPeriodRangeMinutes();
    const span = Math.max(1, range.end - range.start);

    layer.innerHTML = visibleNotes.map(note => {
      const mid = noteMidpointMinutes(note);
      const left = Math.min(98, Math.max(2, ((mid - range.start) / span) * 100));
      return `
        <button type="button" class="history-note-marker" style="left:${left}%; --note-color:${escapeHtml(note.color)}" aria-label="Anotação de ${escapeHtml(note.horaInicio)} até ${escapeHtml(note.horaFim)}">
          <span class="history-note-marker-icon">📝</span>
          <span class="history-note-tooltip">
            <strong>${escapeHtml(note.horaInicio)} - ${escapeHtml(note.horaFim)}</strong>
            <em>${escapeHtml(note.mensagem)}</em>
            <small>${escapeHtml(note.atualizadoPor || note.criadoPor || 'Admin')} • ${escapeHtml(formatDateTime(note.atualizadoEm || note.criadoEm))}</small>
          </span>
        </button>
      `;
    }).join('');
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      listenNotes();
      renderMarkers();
    }, 250);
  }

  function bindEvents() {
    document.addEventListener('change', event => {
      if (event.target?.id === 'historyMachineSelect' || event.target?.id === 'historyDate') {
        scheduleRefresh();
      }
    });

    document.addEventListener('click', event => {
      if (event.target?.closest('.period-btn, .period-option')) {
        setTimeout(renderMarkers, 350);
      }
    });

    window.addEventListener('resize', () => setTimeout(renderMarkers, 150));

    const originalLoadHistoryChart = window.loadHistoryChart;
    if (typeof originalLoadHistoryChart === 'function' && !originalLoadHistoryChart.__historyNotesWrapped) {
      const wrapped = function (...args) {
        const result = originalLoadHistoryChart.apply(this, args);
        Promise.resolve(result).finally(() => setTimeout(() => {
          ensureUI();
          listenNotes();
          renderMarkers();
        }, 400));
        return result;
      };
      wrapped.__historyNotesWrapped = true;
      window.loadHistoryChart = wrapped;
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureUI();
    bindEvents();
    listenNotes();

    const observerTarget = $('#historyChart')?.closest('.chart-inner') || document.body;
    const observer = new MutationObserver(() => {
      ensureUI();
      renderMarkers();
    });
    observer.observe(observerTarget, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 600));
  } else {
    setTimeout(init, 600);
  }

  window.HistoryNotes = {
    init,
    reload: listenNotes,
    render: renderNotes
  };
})();
