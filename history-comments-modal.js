// WMoldes - Modal profissional de comentários com filtro por máquina direto do Firebase
(function () {
  'use strict';

  const COMMENT_PATHS = ['comments', 'comentarios', 'machineComments', 'comentariosMaquinas'];

  const OFFICIAL_MACHINES = [
    'A1','A2','A3','A4','A5','A6',
    'B1','B2','B3','B4','B5','B6','B7','B8',
    'C1','C2','C3','C4','C5','C6','C7','C8',
    '10','11','12','13','14','15'
  ];

  const state = {
    comments: [],
    filtered: [],
    loading: false
  };

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, s => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[s]));
  }

  function normalizeMachine(value) {
    let text = String(value ?? '').trim();
    text = text.replace(/^Máquina\s+/i, '').trim();
    return text;
  }

  function getCurrentMachine() {
    const select = $('historyMachineSelect');
    if (!select) return '';

    const value = normalizeMachine(select.value);
    const label = select.options && select.selectedIndex >= 0
      ? normalizeMachine(select.options[select.selectedIndex].textContent)
      : '';

    const machine = value || label;

    if (!machine || /carregando|selecione/i.test(machine)) return '';
    return machine;
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

  function timestampValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function getMachinesForFilter() {
    const machines = new Set(OFFICIAL_MACHINES);

    const historySelect = $('historyMachineSelect');
    if (historySelect) {
      Array.from(historySelect.options || []).forEach(opt => {
        const machine = normalizeMachine(opt.value || opt.textContent);
        if (machine && !/carregando|selecione/i.test(machine)) machines.add(machine);
      });
    }

    if (window.allAdminMachines && typeof window.allAdminMachines === 'object') {
      Object.keys(window.allAdminMachines).forEach(m => machines.add(normalizeMachine(m)));
    }

    if (window.allMachinesData && typeof window.allMachinesData === 'object') {
      Object.keys(window.allMachinesData).forEach(m => machines.add(normalizeMachine(m)));
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
              <h3><i class="fas fa-comments"></i> Comentários</h3>
              <p>Comentários salvos no Firebase, filtrados por máquina.</p>
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
              <input type="text" id="historyCommentsSearch" placeholder="Buscar por texto, autor ou máquina...">
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
    modal.classList.add('active');

    loadComments();
  }

  function closeModal() {
    $('historyCommentsModal')?.classList.remove('active');
  }

  async function readCommentsFromFirebase() {
    const comments = [];

    if (!window.firebase || !firebase.database) {
      return comments;
    }

    for (const path of COMMENT_PATHS) {
      try {
        const snapshot = await firebase.database().ref(path).once('value');
        const value = snapshot.val();

        if (value) collectComments(value, comments, path);
      } catch (error) {
        console.warn('Falha ao ler comentários em', path, error);
      }
    }

    return comments;
  }

  function collectComments(node, output, source, parentMachine = '') {
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

      const looksLikeComment = !!message;

      if (looksLikeComment) {
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
          timestamp: timestampValue(rawTimestamp),
          createdAtText:
            value.createdAtText ||
            value.data ||
            value.dateText ||
            value.dataTexto ||
            formatDate(rawTimestamp)
        });
      } else {
        collectComments(value, output, source, parentMachine || key);
      }
    });
  }

  async function loadComments() {
    ensureUI();
    populateMachineFilter();

    state.loading = true;
    renderLoading();

    try {
      const comments = await readCommentsFromFirebase();

      const seen = new Set();
      state.comments = comments
        .filter(comment => comment.text)
        .filter(comment => {
          const key = `${comment.machine}|${comment.author}|${comment.text}|${comment.createdAtText}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

      applyFilters();
    } catch (error) {
      console.error(error);
      $('historyCommentsList').innerHTML = `<div class="history-comments-empty">Erro ao carregar comentários: ${esc(error.message || error)}</div>`;
    } finally {
      state.loading = false;
    }
  }

  function applyFilters() {
    const filter = $('historyCommentsMachineFilter')?.value || 'all';
    const query = String($('historyCommentsSearch')?.value || '').toLowerCase().trim();
    const currentMachine = getCurrentMachine();

    state.filtered = state.comments.filter(comment => {
      const commentMachine = normalizeMachine(comment.machine);

      if (filter === 'current') {
        if (!currentMachine) return false;
        if (String(commentMachine) !== String(currentMachine)) return false;
      }

      if (filter !== 'all' && filter !== 'current') {
        if (String(commentMachine) !== String(filter)) return false;
      }

      if (query) {
        const haystack = `${commentMachine} ${comment.author} ${comment.text} ${comment.createdAtText}`.toLowerCase();
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
          <span>Carregando comentários do Firebase...</span>
        </div>
      `;
    }
  }

  function render() {
    const list = $('historyCommentsList');
    const summary = $('historyCommentsSummary');

    if (!list || !summary) return;

    summary.innerHTML = `
      <div><strong>${state.filtered.length}</strong> comentário(s) exibido(s)</div>
      <div><strong>${state.comments.length}</strong> comentário(s) encontrado(s)</div>
    `;

    if (!state.filtered.length) {
      list.innerHTML = '<div class="history-comments-empty">Nenhum comentário encontrado para os filtros selecionados.</div>';
      return;
    }

    list.innerHTML = state.filtered.map(comment => `
      <article class="history-comment-card">
        <div class="history-comment-card-top">
          <div class="history-comment-machine">
            <i class="fas fa-industry"></i>
            Máquina ${esc(comment.machine || '-')}
          </div>
          <div class="history-comment-date">${esc(comment.createdAtText || '')}</div>
        </div>
        <div class="history-comment-text">${esc(comment.text)}</div>
        <div class="history-comment-footer">
          <span><i class="fas fa-user"></i> ${esc(comment.author || 'Usuário')}</span>
          <span>${esc(comment.source || '')}</span>
        </div>
      </article>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureUI();
    setInterval(populateMachineFilter, 2500);
  });

  window.WMoldesCommentsModal = {
    open: openModal,
    reload: loadComments,
    getAll: async () => {
      const comments = await readCommentsFromFirebase();
      return comments.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    },
    getByMachine: async machine => {
      const normalized = normalizeMachine(machine);
      const comments = await readCommentsFromFirebase();
      return comments
        .filter(comment => normalizeMachine(comment.machine) === normalized)
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    }
  };
})();
