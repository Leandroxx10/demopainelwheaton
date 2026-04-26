/* WMoldes Dashboard - correções de tema, filtros e modo compacto */
(function () {
  'use strict';

  const COMPACT_KEY = 'wmoldes_compact_mode';
  const DARK_KEY = 'wmoldes_dashboard_dark_mode';

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function setButtonState(button, active) {
    if (!button) return;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark-mode', isDark);
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem(DARK_KEY, isDark ? 'true' : 'false');

    const btn = qs('#themeBtn');
    if (btn) {
      btn.innerHTML = isDark
        ? '<i class="fas fa-sun"></i> Tema Claro'
        : '<i class="fas fa-moon"></i> Tema Escuro';
      setButtonState(btn, isDark);
    }

    setTimeout(redrawVisibleGauges, 80);
  }

  function initThemeButton() {
    const btn = qs('#themeBtn');
    if (!btn || btn.dataset.wmFixed) return;
    btn.dataset.wmFixed = 'true';

    const isDark = localStorage.getItem(DARK_KEY) === 'true' || localStorage.getItem('modoEscuro') === 'true';
    applyTheme(isDark);

    btn.addEventListener('click', function () {
      applyTheme(!document.body.classList.contains('dark-mode'));
    });
  }

  function metricValue(card, label) {
    const items = qsa('.status-item', card);
    for (const item of items) {
      const itemLabel = (qs('.status-label', item)?.textContent || '').trim().toLowerCase();
      if (itemLabel.includes(label)) return (qs('.status-value', item)?.textContent || '0').trim();
    }
    return '0';
  }

  function ensureCompactMetrics(card) {
    if (!card || card.dataset.compactReady === 'true') return;

    if (card.dataset.maintenance === 'true' || card.classList.contains('maintenance')) {
      card.dataset.compactReady = 'true';
      return;
    }

    const gaugeValues = qsa('.gauge-value', card).map(el => (el.textContent || '0').trim());
    const molde = gaugeValues[0] || '0';
    const blank = gaugeValues[1] || '0';
    const neck = metricValue(card, 'neck');
    const funil = metricValue(card, 'fun');

    const compact = document.createElement('div');
    compact.className = 'compact-metrics';
    compact.innerHTML = `
      <div class="compact-metric"><span>Moldes</span><strong>${molde}</strong></div>
      <div class="compact-metric"><span>Blanks</span><strong>${blank}</strong></div>
      <div class="compact-metric"><span>Neck Rings</span><strong>${neck}</strong></div>
      <div class="compact-metric"><span>Funís</span><strong>${funil}</strong></div>
    `;

    const action = qs('.card-action', card);
    if (action) card.insertBefore(compact, action);
    else card.appendChild(compact);
    card.dataset.compactReady = 'true';
  }

  function updateCompactCards() {
    qsa('.machine-card').forEach(ensureCompactMetrics);
  }
  window.__wmUpdateCompactCards = updateCompactCards;

  function applyCompactMode(active) {
    document.body.classList.toggle('compact-mode', active);
    localStorage.setItem(COMPACT_KEY, active ? 'true' : 'false');
    const btn = qs('#compactModeBtn');
    if (btn) {
      btn.innerHTML = active
        ? '<i class="fas fa-expand-alt"></i> Modo Completo'
        : '<i class="fas fa-compress-alt"></i> Modo Compacto';
      setButtonState(btn, active);
    }
    updateCompactCards();
  }

  function initCompactButton() {
    const btn = qs('#compactModeBtn');
    if (!btn || btn.dataset.wmFixed) return;
    btn.dataset.wmFixed = 'true';

    applyCompactMode(localStorage.getItem(COMPACT_KEY) === 'true');
    btn.addEventListener('click', function () {
      applyCompactMode(!document.body.classList.contains('compact-mode'));
    });
  }

  function redrawVisibleGauges() {
    if (typeof window.createCircularGauge !== 'function') return;
    qsa('canvas[id^="gauge-"]').forEach(canvas => {
      const valueEl = canvas.parentElement ? qs('.gauge-value', canvas.parentElement) : null;
      const value = Number((valueEl?.textContent || '0').replace(',', '.')) || 0;
      const label = canvas.closest('.gauge') ? qs('.gauge-label', canvas.closest('.gauge')) : null;
      const color = label ? getComputedStyle(label).color : '#10b981';
      window.createCircularGauge(canvas.id, value, color);
    });
  }

  function observeCards() {
    const root = qs('#fornoSections') || document.body;
    const observer = new MutationObserver(function () {
      updateCompactCards();
    });
    observer.observe(root, { childList: true, subtree: true });
    updateCompactCards();
  }


  function initFilterToggleFallback() {
    const btn = qs('#filtersBtn');
    const bar = qs('#filtersBar');
    if (!btn || !bar) return;

    function toggleFilters(force) {
      const shouldOpen = typeof force === 'boolean' ? force : !bar.classList.contains('active');
      bar.classList.toggle('active', shouldOpen);
      bar.style.display = shouldOpen ? 'block' : 'none';
      btn.classList.toggle('active', shouldOpen);
      btn.setAttribute('aria-expanded', String(shouldOpen));
      document.body.classList.toggle('filters-active', shouldOpen);
    }

    window.WMDashboardFilters = { toggle: toggleFilters, open: () => toggleFilters(true), close: () => toggleFilters(false) };

    if (!btn.dataset.wmFilterFixed) {
      btn.dataset.wmFilterFixed = 'true';
      btn.setAttribute('aria-controls', 'filtersBar');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleFilters();
      }, true);
    }

    if (!bar.classList.contains('active')) bar.style.display = 'none';
  }

  function init() {
    // Filtros controlados pelo cards.js para evitar conflito de eventos.
    initFilterToggleFallback();
    initCompactButton();
    observeCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
