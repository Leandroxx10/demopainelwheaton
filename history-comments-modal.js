// WMoldes - Modal moderno de comentários do painel
(function () {
  'use strict';

  const state = { comments: [], filtered: [], loading: false };

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }
  function getMachine() {
    const s = $('historyMachineSelect');
    return s && s.value ? String(s.value) : '';
  }
  function formatDate(value) {
    if (!value) return '';
    if (typeof value === 'number') return new Date(value).toLocaleString('pt-BR');
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('pt-BR');
    return String(value);
  }

  function ensureUI() {
    const historyControls = document.querySelector('#history-section .history-controls') || document.querySelector('#history-section .history-header') || document.querySelector('#history-section');

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
              <p>Visualize comentários por máquina ou todos os registros.</p>
            </div>
            <button type="button" id="historyCommentsClose" class="history-comments-close">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="history-comments-filters">
            <div class="history-comments-field">
              <label>Máquina</label>
              <select id="historyCommentsMachineFilter">
                <option value="all">Todas as máquinas</option>
                <option value="current">Máquina selecionada</option>
              </select>
            </div>
            <div class="history-comments-field">
              <label>Buscar</label>
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
      $('historyCommentsModal').addEventListener('click', e => {
        if (e.target === $('historyCommentsModal')) closeModal();
      });
      $('historyCommentsMachineFilter').addEventListener('change', applyFilters);
      $('historyCommentsSearch').addEventListener('input', applyFilters);
      $('historyCommentsReload').addEventListener('click', loadComments);
    }
  }

  function openModal() {
    ensureUI();
    $('historyCommentsModal').classList.add('active');
    loadComments();
  }

  function closeModal() {
    $('historyCommentsModal')?.classList.remove('active');
  }

  async function loadComments() {
    ensureUI();
    state.loading = true;
    renderLoading();

    try {
      const comments = [];

      if (window.firebase && firebase.database) {
        const paths = ['comments', 'comentarios', 'machineComments', 'comentariosMaquinas'];

        for (const path of paths) {
          try {
            const snap = await firebase.database().ref(path).once('value');
            const val = snap.val();
            if (val) collectComments(val, comments, path);
          } catch (err) {
            console.warn('Falha ao ler comentários em', path, err);
          }
        }
      }

      const seen = new Set();
      state.comments = comments.filter(c => {
        const key = `${c.machine}|${c.author}|${c.text}|${c.createdAtText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

      applyFilters();
    } catch (error) {
      console.error(error);
      $('historyCommentsList').innerHTML = `<div class="history-comments-empty">Erro ao carregar comentários: ${esc(error.message || error)}</div>`;
    } finally {
      state.loading = false;
    }
  }

  function collectComments(node, out, source, parentMachine = '') {
    if (!node || typeof node !== 'object') return;

    Object.entries(node).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;

      const looksComment = value.commentText || value.text || value.comment || value.mensagem || value.message || value.comentario;

      if (looksComment) {
        const machine = value.machine || value.maquina || value.machineId || value.nomeMaquina || parentMachine || key;
        const timestamp = value.timestamp || value.createdAt || value.dataCriacao || value.date || value.updatedAt || 0;

        out.push({
          id: key,
          source,
          machine,
          author: value.author || value.autor || value.user || value.usuario || value.email || 'Usuário',
          text: value.commentText || value.text || value.comment || value.mensagem || value.message || value.comentario || '',
          timestamp,
          createdAtText: value.createdAtText || value.data || value.dateText || formatDate(timestamp)
        });
      } else {
        collectComments(value, out, source, parentMachine || key);
      }
    });
  }

  function applyFilters() {
    const filter = $('historyCommentsMachineFilter')?.value || 'all';
    const q = String($('historyCommentsSearch')?.value || '').toLowerCase().trim();
    const currentMachine = getMachine();

    state.filtered = state.comments.filter(c => {
      if (filter === 'current' && currentMachine && String(c.machine) !== String(currentMachine)) return false;

      if (q) {
        const hay = `${c.machine} ${c.author} ${c.text} ${c.createdAtText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    render();
  }

  function renderLoading() {
    $('historyCommentsSummary').innerHTML = '';
    $('historyCommentsList').innerHTML = `
      <div class="history-comments-loading">
        <div class="history-comments-spinner"></div>
        <span>Carregando comentários...</span>
      </div>
    `;
  }

  function render() {
    const list = $('historyCommentsList');
    const summary = $('historyCommentsSummary');

    summary.innerHTML = `
      <div><strong>${state.filtered.length}</strong> comentário(s) exibido(s)</div>
      <div><strong>${state.comments.length}</strong> comentário(s) encontrado(s)</div>
    `;

    if (!state.filtered.length) {
      list.innerHTML = '<div class="history-comments-empty">Nenhum comentário encontrado para os filtros selecionados.</div>';
      return;
    }

    list.innerHTML = state.filtered.map(c => `
      <article class="history-comment-card">
        <div class="history-comment-card-top">
          <div class="history-comment-machine">
            <i class="fas fa-industry"></i>
            Máquina ${esc(c.machine || '-')}
          </div>
          <div class="history-comment-date">${esc(c.createdAtText || '')}</div>
        </div>
        <div class="history-comment-text">${esc(c.text)}</div>
        <div class="history-comment-footer">
          <span><i class="fas fa-user"></i> ${esc(c.author || 'Usuário')}</span>
          <span>${esc(c.source || '')}</span>
        </div>
      </article>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', ensureUI);

  window.WMoldesCommentsModal = { open: openModal, reload: loadComments };
})();
