// WMoldes - Comentários + Anotações do gráfico vindos direto do Firebase
(function () {
  'use strict';

  const COMMENT_PATHS = [
    'comments',
    'comentarios',
    'machineComments',
    'comentariosMaquinas'
  ];

  const NOTE_PATHS = [
    'historyChartNotesStable',
    'historyChartNotesV4',
    'historyChartNotesV3',
    'historyChartNotesV2',
    'historyChartNotes'
  ];

  const OFFICIAL_MACHINES = [
    'A1','A2','A3','A4','A5','A6',
    'B1','B2','B3','B4','B5','B6','B7','B8',
    'C1','C2','C3','C4','C5','C6','C7','C8',
    '10','11','12','13','14','15'
  ];

  const state = {
    comments: [],
    filtered: []
  };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  function normalizeMachine(value) {
    return String(value ?? '').replace(/^Máquina\s+/i, '').trim();
  }

  function getCurrentMachine() {
    const select = $('historyMachineSelect');
    if (!select) return '';

    const value = normalizeMachine(select.value);
    const label = select.options && select.selectedIndex >= 0
      ? normalizeMachine(select.options[select.selectedIndex].textContent)
      : '';

    const machine = value || label;

    if (!machine || /carregando|selecione|selecionar/i.test(machine)) return '';
    return machine;
  }

  function timestampValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function formatDate(value) {
    if (!value) return '';
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR');
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('pt-BR');
    return String(value);
  }

  function getMachinesForFilter() {
    const machines = new Set(OFFICIAL_MACHINES);

    const historySelect = $('historyMachineSelect');
    if (historySelect) {
      Array.from(historySelect.options || []).forEach(opt => {
        const machine = normalizeMachine(opt.value || opt.textContent);
        if (machine && !/carregando|selecione|selecionar/i.test(machine)) {
          machines.add(machine);
        }
      });
    }

    if (window.allAdminMachines && typeof window.allAdminMachines === 'object') {
      Object.keys(window.allAdminMachines).forEach(machine => machines.add(normalizeMachine(machine)));
    }

    if (window.allMachinesData && typeof window.allMachinesData === 'object') {
      Object.keys(window.allMachinesData).forEach(machine => machines.add(normalizeMachine(machine)));
    }

    return Array.from(machines).filter(Boolean).sort((a, b) => {
      const ia = OFFICIAL_MACHINES.indexOf(a);
      const ib = OFFICIAL_MACHINES.indexOf(b);

      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;

      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
    });
  }

  function populateMachineFilter() {
    const select = $('historyCommentsMachineFilter');
    if (!select) return;

    const selected = select.value || 'all';
    const machines = getMachinesForFilter();

    select.innerHTML = [
      '<option value="all">Todas as máquinas</option>',
      '<option value="current">Máquina selecionada</option>',
      '<option value="" disabled>──────────</option>',
      ...machines.map(machine => `<option value="${esc(machine)}">Máquina ${esc(machine)}</option>`)
    ].join('');

    if (Array.from(select.options).some(opt => opt.value === selected)) {
      select.value = selected;
    }
  }

  function ensureUI() {
    const historyControls =
      document.querySelector('#history-section .history-controls') ||
      document.querySelector('#history-section .history-header') ||
      document.querySelector('#history-section');

    if (historyControls && !$('historyCommentsBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'historyCommentsBtn';
      btn.className = 'history-comments-open-btn';
      btn.innerHTML = '<i class="fas fa-comments"></i><span>Ver comentários</span>';
      btn.addEventListener('click', openModal);
      historyControls.appendChild(btn);
    }

    if (!$('historyCommentsModal')) {
      const modal = document.createElement('div');
      modal.id = 'historyCommentsModal';
      modal.className = 'history-comments-backdrop';
      modal.innerHTML = `
        <div class="history-comments-modal">
          <div class="history-comments-header">
            <div>
              <h3><i class="fas fa-comments"></i> Comentários e anotações</h3>
              <p>Comentários salvos no Firebase e anotações criadas pelo botão Nova anotação.</p>
            </div>
            <button type="button" id="historyCommentsClose" class="history-comments-close" aria-label="Fechar">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="history-comments-filters">
            <div class="history-comments-field">
              <label for="historyCommentsMachineFilter">Máquina</label>
              <select id="historyCommentsMachineFilter"></select>
            </div>
            <div class="history-comments-field">
              <label for="historyCommentsSearch">Buscar</label>
              <input type="text" id="historyCommentsSearch" placeholder="Buscar por texto, autor, horário ou máquina...">
            </div>
            <button type="button" id="historyCommentsReload" class="history-comments-reload">
              <i class="fas fa-rotate"></i>
              Atualizar
            </button>
          </div>

          <div class="history-comments-summary" id="historyCommentsSummary"></div>
          <div class="history-comments-list" id="historyCommentsList"></div>
        </div>
      `;

      document.body.appendChild(modal);

      $('historyCommentsClose').addEventListener('click', closeModal);
      $('historyCommentsModal').addEventListener('click', event => {
        if (event.target === $('historyCommentsModal')) closeModal();
      });
      $('historyCommentsMachineFilter').addEventListener('change', applyFilters);
      $('historyCommentsSearch').addEventListener('input', applyFilters);
      $('historyCommentsReload').addEventListener('click', loadComments);
    }

    populateMachineFilter();
  }

  function openModal() {
    ensureUI();
    populateMachineFilter();

    const modal = $('historyCommentsModal');
    if (modal) modal.classList.add('active');

    setTimeout(() => {
      populateMachineFilter();
      loadComments();
    }, 200);
  }

  function closeModal() {
    $('historyCommentsModal')?.classList.remove('active');
  }

  async function readFirebasePath(path) {
    if (!window.firebase || !firebase.database) return null;
    const snap = await firebase.database().ref(path).once('value');
    return snap.val();
  }

  async function readCommentsFromFirebase() {
    const items = [];

    if (!window.firebase || !firebase.database) return items;

    for (const path of COMMENT_PATHS) {
      try {
        const value = await readFirebasePath(path);
        if (value) collectRegularComments(value, items, path);
      } catch (error) {
        console.warn('Falha ao ler comentários em', path, error);
      }
    }

    for (const path of NOTE_PATHS) {
      try {
        const value = await readFirebasePath(path);
        if (value) collectHistoryNotes(value, items, path);
      } catch (error) {
        console.warn('Falha ao ler anotações em', path, error);
      }
    }

    const seen = new Set();

    return items
      .filter(item => item.text)
      .filter(item => {
        const key = `${item.type}|${item.machine}|${item.startTime}|${item.endTime}|${item.author}|${item.text}|${item.createdAtText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  }

  function collectRegularComments(node, output, source, parentMachine = '') {
    if (!node || typeof node !== 'object') return;

    Object.entries(node).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;

      const message =
        value.commentText ||
        value.text ||
        value.comment ||
        value.mensagem ||
        value.message ||
        value.comentario ||
        '';

      if (message) {
        const machine = normalizeMachine(
          value.machine ||
          value.maquina ||
          value.machineId ||
          value.idMaquina ||
          value.nomeMaquina ||
          parentMachine ||
          key
        );

        const rawTimestamp =
          value.timestamp ||
          value.createdAt ||
          value.dataCriacao ||
          value.date ||
          value.updatedAt ||
          value.created_at ||
          0;

        output.push({
          id: key,
          type: 'comment',
          source,
          machine,
          author:
            value.author ||
            value.autor ||
            value.user ||
            value.usuario ||
            value.email ||
            value.createdBy ||
            'Usuário',
          text: message,
          startTime: value.startTime || value.hora || value.time || '',
          endTime: value.endTime || '',
          timestamp: timestampValue(rawTimestamp),
          createdAtText:
            value.createdAtText ||
            value.data ||
            value.dateText ||
            value.dataTexto ||
            formatDate(rawTimestamp)
        });
      } else {
        collectRegularComments(value, output, source, parentMachine || key);
      }
    });
  }

  function collectHistoryNotes(root, output, source) {
    if (!root || typeof root !== 'object') return;

    // Estrutura esperada: root/{machine}/{date}/{noteId}
    Object.entries(root).forEach(([machineKey, machineNode]) => {
      if (!machineNode || typeof machineNode !== 'object') return;

      Object.entries(machineNode).forEach(([dateKey, dateNode]) => {
        if (!dateNode || typeof dateNode !== 'object') return;

        Object.entries(dateNode).forEach(([noteId, note]) => {
          if (!note || typeof note !== 'object') return;

          const message = note.message || note.mensagem || note.text || note.comentario || '';
          if (!message) return;

          const rawTimestamp = note.updatedAt || note.createdAt || note.timestamp || 0;
          const startTime = note.startTime || note.horaInicio || note.start || '';
          const endTime = note.endTime || note.horaFim || note.end || '';

          output.push({
            id: noteId,
            type: 'note',
            source,
            machine: normalizeMachine(note.machine || machineKey),
            author: note.author || note.autor || note.email || 'Usuário',
            text: message,
            startTime,
            endTime,
            timestamp: timestampValue(rawTimestamp),
            createdAtText: note.updatedAtText || note.createdAtText || `${dateKey}${startTime ? ' ' + startTime : ''}`
          });
        });
      });
    });
  }

  async function loadComments() {
    ensureUI();
    populateMachineFilter();
    renderLoading();

    try {
      state.comments = await readCommentsFromFirebase();
      applyFilters();
    } catch (error) {
      console.error(error);
      $('historyCommentsList').innerHTML = `<div class="history-comments-empty">Erro ao carregar comentários: ${esc(error.message || error)}</div>`;
    }
  }

  function applyFilters() {
    const filter = $('historyCommentsMachineFilter')?.value || 'all';
    const query = String($('historyCommentsSearch')?.value || '').toLowerCase().trim();
    const currentMachine = getCurrentMachine();

    state.filtered = state.comments.filter(item => {
      const machine = normalizeMachine(item.machine);

      if (filter === 'current') {
        if (!currentMachine) return false;
        if (String(machine) !== String(currentMachine)) return false;
      }

      if (filter !== 'all' && filter !== 'current') {
        if (String(machine) !== String(filter)) return false;
      }

      if (query) {
        const haystack = `${machine} ${item.author} ${item.text} ${item.startTime} ${item.endTime} ${item.createdAtText}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    render();
  }

  function renderLoading() {
    const summary = $('historyCommentsSummary');
    const list = $('historyCommentsList');

    if (summary) summary.innerHTML = '';
    if (list) {
      list.innerHTML = `
        <div class="history-comments-loading">
          <div class="history-comments-spinner"></div>
          <span>Carregando comentários e anotações do Firebase...</span>
        </div>
      `;
    }
  }

  function render() {
    const list = $('historyCommentsList');
    const summary = $('historyCommentsSummary');

    if (!list || !summary) return;

    summary.innerHTML = `
      <div><strong>${state.filtered.length}</strong> item(ns) exibido(s)</div>
      <div><strong>${state.comments.length}</strong> item(ns) encontrado(s)</div>
    `;

    if (!state.filtered.length) {
      list.innerHTML = '<div class="history-comments-empty">Nenhum comentário ou anotação encontrado para os filtros selecionados.</div>';
      return;
    }

    list.innerHTML = state.filtered.map(item => {
      const timeLabel = item.startTime
        ? `${esc(item.startTime)}${item.endTime ? ' - ' + esc(item.endTime) : ''}`
        : '';

      return `
        <article class="history-comment-card ${item.type === 'note' ? 'is-note' : ''}">
          <div class="history-comment-card-top">
            <div class="history-comment-machine">
              <i class="fas ${item.type === 'note' ? 'fa-sticky-note' : 'fa-industry'}"></i>
              Máquina ${esc(item.machine || '-')}
              <span class="history-comment-type">${item.type === 'note' ? 'Anotação do gráfico' : 'Comentário'}</span>
            </div>
            <div class="history-comment-date">${esc(item.createdAtText || '')}</div>
          </div>
          ${timeLabel ? `<div class="history-comment-time">${timeLabel}</div>` : ''}
          <div class="history-comment-text">${esc(item.text)}</div>
          <div class="history-comment-footer">
            <span><i class="fas fa-user"></i> ${esc(item.author || 'Usuário')}</span>
            <span>${esc(item.source || '')}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureUI();
    populateMachineFilter();
    setInterval(populateMachineFilter, 2500);
  });

  window.WMoldesCommentsModal = {
    open: openModal,
    reload: loadComments,
    getAll: async () => readCommentsFromFirebase(),
    getByMachine: async machine => {
      const normalized = normalizeMachine(machine);
      const items = await readCommentsFromFirebase();
      return items
        .filter(item => normalizeMachine(item.machine) === normalized)
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    }
  };
})();
