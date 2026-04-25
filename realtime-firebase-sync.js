/* =========================================================
   WMoldes - Sincronização em tempo real do painel principal
   Corrige atualização dos cards quando outro sistema altera
   os dados no Firebase em /maquinas.
   ========================================================= */
(function () {
  'use strict';

  const STATE = {
    started: false,
    lastSnapshotHash: '',
    lastActionAt: 0,
    debounceTimer: null,
    forceRefreshTimer: null,
    autoRefreshInterval: null,
    initialSnapshotReceived: false
  };

  const LOG_PREFIX = '[WMoldes realtime]';
  const DEBOUNCE_MS = 300;
  const MIN_ACTION_INTERVAL_MS = 700;
  const FALLBACK_POLL_MS = 10000;

  function log(...args) {
    try { console.log(LOG_PREFIX, ...args); } catch (_) {}
  }

  function warn(...args) {
    try { console.warn(LOG_PREFIX, ...args); } catch (_) {}
  }

  function stableHash(value) {
    try {
      return JSON.stringify(value || {});
    } catch (_) {
      return String(Date.now());
    }
  }

  function updateConnectionLabel(text, color) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  }

  function findRefreshButton() {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    return candidates.find((el) => {
      const text = (el.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return text.includes('atualizar') || text.includes('atualizado');
    });
  }

  function callKnownRenderFunctions(data) {
    const calls = [
      ['organizarMaquinasPorForno', [data]],
      ['renderizarMaquinas', [data]],
      ['renderMachines', [data]],
      ['criarPainel', [data]],
      ['atualizarCards', [data]],
      ['atualizarDashboard', [data]],
      ['carregarMaquinas', []],
      ['loadMachines', []],
      ['loadDashboard', []]
    ];

    let executed = false;
    calls.forEach(([name, args]) => {
      const fn = window[name];
      if (typeof fn === 'function') {
        try {
          fn.apply(window, args);
          executed = true;
          log('função executada:', name);
        } catch (error) {
          warn('erro ao executar', name, error);
        }
      }
    });
    return executed;
  }

  function clickRefreshButton() {
    const btn = findRefreshButton();
    if (!btn) return false;
    try {
      btn.click();
      log('botão Atualizar acionado automaticamente');
      return true;
    } catch (error) {
      warn('erro ao acionar botão Atualizar', error);
      return false;
    }
  }

  function refreshUI(data, reason) {
    const now = Date.now();
    clearTimeout(STATE.debounceTimer);

    STATE.debounceTimer = setTimeout(() => {
      if (Date.now() - STATE.lastActionAt < MIN_ACTION_INTERVAL_MS) return;
      STATE.lastActionAt = Date.now();

      window.dadosMaquinas = data || window.dadosMaquinas || {};
      window.maquinasData = data || window.maquinasData || {};
      window.__wmoldesRealtimeMachines = data || {};

      const rendered = callKnownRenderFunctions(data || {});
      if (!rendered) {
        clickRefreshButton();
      }

      updateConnectionLabel('Conectado ao servidor', '#10b981');
      log('interface sincronizada:', reason || 'alteração Firebase');
    }, DEBOUNCE_MS);
  }

  function attachFirebaseListener() {
    if (!window.firebase || !window.db) {
      warn('Firebase/db ainda não disponível. Tentando novamente...');
      setTimeout(attachFirebaseListener, 500);
      return;
    }

    if (STATE.started) return;
    STATE.started = true;

    const ref = window.maquinasRef || window.db.ref('maquinas');

    ref.on('value', (snapshot) => {
      const data = snapshot.val() || {};
      const hash = stableHash(data);

      if (hash === STATE.lastSnapshotHash && STATE.initialSnapshotReceived) return;

      STATE.lastSnapshotHash = hash;
      STATE.initialSnapshotReceived = true;
      refreshUI(data, 'snapshot /maquinas');
    }, (error) => {
      warn('erro no listener /maquinas:', error);
      updateConnectionLabel('Erro ao sincronizar dados', '#ef4444');
    });

    // Fallback: caso algum script antigo sobrescreva o listener, executa o mesmo fluxo periodicamente.
    STATE.autoRefreshInterval = setInterval(() => {
      try {
        ref.once('value').then((snapshot) => {
          const data = snapshot.val() || {};
          const hash = stableHash(data);
          if (hash !== STATE.lastSnapshotHash) {
            STATE.lastSnapshotHash = hash;
            refreshUI(data, 'fallback periódico /maquinas');
          }
        });
      } catch (error) {
        warn('erro no fallback periódico:', error);
      }
    }, FALLBACK_POLL_MS);

    // Garante carregamento inicial sem precisar clicar em Atualizar.
    setTimeout(() => {
      try {
        ref.once('value').then((snapshot) => {
          const data = snapshot.val() || {};
          STATE.lastSnapshotHash = stableHash(data);
          refreshUI(data, 'carregamento inicial forçado');
        });
      } catch (_) {
        clickRefreshButton();
      }
    }, 900);

    log('listener em tempo real ativado em /maquinas');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachFirebaseListener);
  } else {
    attachFirebaseListener();
  }

  window.WMoldesRealtimeSync = {
    start: attachFirebaseListener,
    refreshNow: () => {
      if (window.db) {
        return window.db.ref('maquinas').once('value').then((snapshot) => {
          const data = snapshot.val() || {};
          STATE.lastSnapshotHash = stableHash(data);
          refreshUI(data, 'refresh manual WMoldesRealtimeSync');
          return data;
        });
      }
      clickRefreshButton();
      return Promise.resolve(null);
    }
  };
})();
