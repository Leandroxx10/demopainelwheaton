/*
 * WMoldes Dashboard - correção final dos controles e filtros
 * Carregar este arquivo por último no index.html.
 * Ele neutraliza conflitos de eventos antigos e aplica os filtros diretamente nos cards renderizados.
 */
(function () {
  'use strict';

  const SELECTORS = {
    filtersBtn: '#filtersBtn',
    filtersBar: '#filtersBar',
    themeBtn: '#themeBtn',
    compactBtn: '#compactModeBtn',
    search: '#machineSearch',
    fornoButton: '[data-forno]',
    statusButton: '[data-status]',
    clearForno: '#clearFornoBtn',
    clearStatus: '#clearStatusBtn',
    maintenance: '#hideMaintenanceBtn',
    sectionsRoot: '#fornoSections',
    cardsRoot: '#cardsContainer'
  };

  const STORAGE = {
    dark: 'wmoldes_dashboard_dark_mode',
    compact: 'wmoldes_compact_mode',
    filters: 'wmoldes_dashboard_filters_final_v3'
  };

  const state = {
    filtersOpen: false,
    fornos: new Set(),
    status: null,
    hideMaintenance: false,
    search: ''
  };

  const statusMap = {
    critico: 'critical',
    critical: 'critical',
    baixa: 'critical',
    baixo: 'warning',
    warning: 'warning',
    normal: 'normal'
  };

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/maquina|máquina|maq\.?|forno/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE.filters, JSON.stringify({
        fornos: Array.from(state.fornos),
        status: state.status,
        hideMaintenance: state.hideMaintenance,
        search: state.search
      }));
    } catch (_) {}
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.filters) || '{}');
      state.fornos = new Set(Array.isArray(saved.fornos) ? saved.fornos.map(String) : []);
      state.status = saved.status || null;
      state.hideMaintenance = saved.hideMaintenance === true;
      state.search = saved.search || '';
    } catch (_) {}
  }

  function setActive(el, active) {
    if (!el) return;
    el.classList.toggle('active', !!active);
    el.setAttribute('aria-pressed', String(!!active));
  }

  function getMachineId(card) {
    const dataId = card.getAttribute('data-machine-id');
    if (dataId) return dataId.trim();
    const name = qs('.machine-name', card)?.textContent || card.textContent || '';
    const match = name.match(/\b[A-D]\s*\d+\b|\b\d+\b/i);
    return match ? match[0].replace(/\s+/g, '') : name.trim();
  }

  function getForno(card) {
    const data = card.getAttribute('data-forno');
    if (data) return data.toUpperCase();
    const id = getMachineId(card).toUpperCase();
    const match = id.match(/^([A-D])/);
    return match ? match[1] : '';
  }

  function getStatus(card) {
    if (card.getAttribute('data-maintenance') === 'true' || card.classList.contains('maintenance')) return 'maintenance';
    if (card.getAttribute('data-status')) return card.getAttribute('data-status');
    if (card.classList.contains('critical')) return 'critical';
    if (card.classList.contains('warning')) return 'warning';
    if (card.classList.contains('normal')) return 'normal';

    const text = normalize(card.textContent);
    if (text.includes('paradaparamanutencao') || text.includes('manutencao')) return 'maintenance';
    if (text.includes('baixareserva') || text.includes('critica')) return 'critical';
    if (text.includes('baixoestoque')) return 'warning';
    if (text.includes('bemabastecido') || text.includes('normal')) return 'normal';
    return '';
  }

  function cardMatchesSearch(card) {
    if (!state.search) return true;
    const term = normalize(state.search);
    const machineId = normalize(getMachineId(card));
    const fullText = normalize(card.textContent);
    const termDigits = term.replace(/\D/g, '');
    const idDigits = machineId.replace(/\D/g, '');

    return machineId.includes(term) ||
      fullText.includes(term) ||
      (!!termDigits && idDigits === termDigits) ||
      (!!termDigits && idDigits.endsWith(termDigits));
  }

  function ensureCardDataset(card) {
    if (!card.getAttribute('data-machine-id')) card.setAttribute('data-machine-id', getMachineId(card));
    if (!card.getAttribute('data-forno')) card.setAttribute('data-forno', getForno(card));
    if (!card.getAttribute('data-status')) card.setAttribute('data-status', getStatus(card));
    if (!card.getAttribute('data-maintenance')) card.setAttribute('data-maintenance', getStatus(card) === 'maintenance' ? 'true' : 'false');
  }

  function hasActiveFilters() {
    return state.fornos.size > 0 || !!state.status || state.hideMaintenance || !!state.search;
  }

  function syncUi() {
    qsa(SELECTORS.fornoButton).forEach(btn => setActive(btn, state.fornos.has(String(btn.dataset.forno || '').toUpperCase())));
    qsa(SELECTORS.statusButton).forEach(btn => setActive(btn, statusMap[btn.dataset.status] === state.status));
    setActive(qs(SELECTORS.clearStatus), !state.status);

    const maintenanceBtn = qs(SELECTORS.maintenance);
    if (maintenanceBtn) {
      setActive(maintenanceBtn, state.hideMaintenance);
      maintenanceBtn.innerHTML = state.hideMaintenance
        ? '<i class="fas fa-eye"></i> Mostrar paradas para manutenção'
        : '<i class="fas fa-eye-slash"></i> Ocultar paradas para manutenção';
    }

    const search = qs(SELECTORS.search);
    if (search && document.activeElement !== search && search.value !== state.search) search.value = state.search;
  }

  function setFiltersOpen(open) {
    state.filtersOpen = !!open;
    const bar = qs(SELECTORS.filtersBar);
    const btn = qs(SELECTORS.filtersBtn);
    if (bar) {
      bar.hidden = false;
      bar.classList.toggle('active', state.filtersOpen);
      bar.style.setProperty('display', state.filtersOpen ? 'block' : 'none', 'important');
    }
    if (btn) {
      btn.classList.toggle('active', state.filtersOpen);
      btn.setAttribute('aria-expanded', String(state.filtersOpen));
      btn.setAttribute('aria-controls', 'filtersBar');
      btn.setAttribute('type', 'button');
    }
    document.body.classList.toggle('filters-active', state.filtersOpen);
  }

  function updateSectionStats(section) {
    const cards = qsa('.machine-card', section).filter(card => card.dataset.wmFilterVisible !== 'false');
    const counters = { total: cards.length, maintenance: 0, critical: 0, warning: 0, normal: 0 };
    cards.forEach(card => {
      const status = getStatus(card);
      if (status === 'maintenance') counters.maintenance += 1;
      if (status === 'critical') counters.critical += 1;
      if (status === 'warning') counters.warning += 1;
      if (status === 'normal') counters.normal += 1;
    });

    const totalText = qsa('.forno-stats span', section).find(el => /máquinas/i.test(el.textContent));
    if (totalText) totalText.innerHTML = `<i class="fas fa-industry"></i> ${counters.total} máquinas`;
    const maintenance = qs('.maintenance-count', section); if (maintenance) maintenance.textContent = counters.maintenance;
    const critical = qs('.critical-count', section); if (critical) critical.textContent = counters.critical;
    const warning = qs('.warning-count', section); if (warning) warning.textContent = counters.warning;
    const normal = qs('.normal-count', section); if (normal) normal.textContent = counters.normal;
  }

  function updateTopStats(visibleCards) {
    const counters = { total: visibleCards.length, maintenance: 0, critical: 0, warning: 0, normal: 0 };
    visibleCards.forEach(card => {
      const status = getStatus(card);
      if (status === 'maintenance') counters.maintenance += 1;
      if (status === 'critical') counters.critical += 1;
      if (status === 'warning') counters.warning += 1;
      if (status === 'normal') counters.normal += 1;
    });
    const map = {
      totalMachines: counters.total,
      maintenanceMachines: counters.maintenance,
      criticalMachines: counters.critical,
      lowStockMachines: counters.warning,
      normalMachines: counters.normal
    };
    Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) el.textContent = map[id]; });
  }

  function updateEmptyMessage(visibleCount) {
    const root = qs(SELECTORS.sectionsRoot) || qs(SELECTORS.cardsRoot);
    if (!root) return;
    let empty = qs('#wmNoFilteredMachines');
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'wmNoFilteredMachines';
      empty.className = 'wm-no-filtered-machines';
      empty.innerHTML = '<i class="fas fa-search"></i><strong>Nenhuma máquina encontrada</strong><span>Altere os filtros para visualizar outros cards.</span>';
      root.appendChild(empty);
    }
    empty.style.display = hasActiveFilters() && visibleCount === 0 ? 'flex' : 'none';
  }

  function applyFilters() {
    syncUi();

    const allCards = qsa('.machine-card');
    const visibleCards = [];

    allCards.forEach(card => {
      ensureCardDataset(card);
      const forno = getForno(card);
      const status = getStatus(card);
      let visible = true;

      if (state.fornos.size > 0 && !state.fornos.has(forno)) visible = false;
      if (state.status && status !== state.status) visible = false;
      if (state.hideMaintenance && status === 'maintenance') visible = false;
      if (!cardMatchesSearch(card)) visible = false;

      card.dataset.wmFilterVisible = visible ? 'true' : 'false';
      card.style.setProperty('display', visible ? '' : 'none', visible ? '' : 'important');
      if (visible) visibleCards.push(card);
    });

    qsa('.forno-section').forEach(section => {
      const sectionForno = (section.id || '').replace(/^forno-/i, '').toUpperCase() || (qs('.forno-badge', section)?.textContent || '').replace(/[^A-D]/gi, '').toUpperCase();
      const fornoAllowed = state.fornos.size === 0 || state.fornos.has(sectionForno);
      const visibleInside = qsa('.machine-card', section).some(card => card.dataset.wmFilterVisible === 'true');
      const show = fornoAllowed && visibleInside;
      section.style.setProperty('display', show ? '' : 'none', show ? '' : 'important');
      if (show) updateSectionStats(section);
    });

    updateTopStats(visibleCards.filter(card => card.closest('#fornoSections') || !qs('#fornoSections .machine-card')));
    updateEmptyMessage(visibleCards.length);
    saveState();
  }

  function toggleTheme() {
    const dark = !document.body.classList.contains('dark-mode');
    document.documentElement.classList.toggle('dark-mode', dark);
    document.body.classList.toggle('dark-mode', dark);
    try {
      localStorage.setItem(STORAGE.dark, dark ? 'true' : 'false');
      localStorage.setItem('modoEscuro', dark ? 'true' : 'false');
    } catch (_) {}
    const btn = qs(SELECTORS.themeBtn);
    if (btn) {
      btn.innerHTML = dark ? '<i class="fas fa-sun"></i> Tema Claro' : '<i class="fas fa-moon"></i> Tema Escuro';
      setActive(btn, dark);
    }
  }

  function applyInitialTheme() {
    const dark = localStorage.getItem(STORAGE.dark) === 'true' || localStorage.getItem('modoEscuro') === 'true';
    document.documentElement.classList.toggle('dark-mode', dark);
    document.body.classList.toggle('dark-mode', dark);
    const btn = qs(SELECTORS.themeBtn);
    if (btn) {
      btn.innerHTML = dark ? '<i class="fas fa-sun"></i> Tema Claro' : '<i class="fas fa-moon"></i> Tema Escuro';
      setActive(btn, dark);
    }
  }

  function metricValue(card, label) {
    const item = qsa('.status-item', card).find(el => normalize(el.textContent).includes(label));
    return qs('.status-value', item)?.textContent?.trim() || '0';
  }

  function ensureCompactMetrics(card) {
    if (!card || card.dataset.compactReady === 'true' || getStatus(card) === 'maintenance') return;
    const values = qsa('.gauge-value', card).map(el => el.textContent.trim());
    const box = document.createElement('div');
    box.className = 'compact-metrics';
    box.innerHTML = `
      <div class="compact-metric"><span>Moldes</span><strong>${values[0] || '0'}</strong></div>
      <div class="compact-metric"><span>Blanks</span><strong>${values[1] || '0'}</strong></div>
      <div class="compact-metric"><span>Neck Rings</span><strong>${metricValue(card, 'neck')}</strong></div>
      <div class="compact-metric"><span>Funís</span><strong>${metricValue(card, 'fun')}</strong></div>`;
    const action = qs('.card-action', card);
    if (action) card.insertBefore(box, action); else card.appendChild(box);
    card.dataset.compactReady = 'true';
  }

  function applyCompact(force) {
    const active = typeof force === 'boolean' ? force : !document.body.classList.contains('compact-mode');
    qsa('.machine-card').forEach(ensureCompactMetrics);
    document.body.classList.toggle('compact-mode', active);
    try { localStorage.setItem(STORAGE.compact, active ? 'true' : 'false'); } catch (_) {}
    const btn = qs(SELECTORS.compactBtn);
    if (btn) {
      btn.innerHTML = active ? '<i class="fas fa-expand-alt"></i> Modo Completo' : '<i class="fas fa-compress-alt"></i> Modo Compacto';
      setActive(btn, active);
    }
  }

  function handleForcedClick(event) {
    const target = event.target;
    if (!target || !target.closest) return;

    const filtersBtn = target.closest(SELECTORS.filtersBtn);
    const themeBtn = target.closest(SELECTORS.themeBtn);
    const compactBtn = target.closest(SELECTORS.compactBtn);
    const clearForno = target.closest(SELECTORS.clearForno);
    const clearStatus = target.closest(SELECTORS.clearStatus);
    const maintenanceBtn = target.closest(SELECTORS.maintenance);
    const fornoBtn = target.closest(SELECTORS.fornoButton);
    const statusBtn = target.closest(SELECTORS.statusButton);

    const handled = filtersBtn || themeBtn || compactBtn || clearForno || clearStatus || maintenanceBtn || fornoBtn || statusBtn;
    if (!handled) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (filtersBtn) setFiltersOpen(!state.filtersOpen);
    else if (themeBtn) toggleTheme();
    else if (compactBtn) applyCompact();
    else if (clearForno) { state.fornos.clear(); applyFilters(); }
    else if (clearStatus) { state.status = null; applyFilters(); }
    else if (maintenanceBtn) { state.hideMaintenance = !state.hideMaintenance; applyFilters(); }
    else if (fornoBtn) {
      const forno = String(fornoBtn.dataset.forno || '').toUpperCase();
      if (state.fornos.has(forno)) state.fornos.delete(forno); else state.fornos.add(forno);
      applyFilters();
    } else if (statusBtn) {
      const next = statusMap[statusBtn.dataset.status] || null;
      state.status = state.status === next ? null : next;
      applyFilters();
    }
  }

  function bindSearch() {
    const input = qs(SELECTORS.search);
    if (!input || input.dataset.wmHardSearch === 'true') return;
    input.dataset.wmHardSearch = 'true';
    input.value = state.search;
    input.addEventListener('input', function (event) {
      event.stopImmediatePropagation();
      state.search = input.value.trim();
      applyFilters();
    }, true);
  }

  function injectCss() {
    if (qs('#wmHardControlsCss')) return;
    const style = document.createElement('style');
    style.id = 'wmHardControlsCss';
    style.textContent = `
      #filtersBar.active { display: block !important; }
      #filtersBtn.active, #themeBtn.active, #compactModeBtn.active, .filter-btn.active {
        background: var(--primary, #2563eb) !important;
        border-color: var(--primary, #2563eb) !important;
        color: #fff !important;
      }
      #hideMaintenanceBtn.active { background: #7c3aed !important; border-color: #7c3aed !important; color: #fff !important; }
      .wm-no-filtered-machines {
        width: 100%; min-height: 190px; align-items: center; justify-content: center; flex-direction: column;
        gap: 8px; color: var(--text-light, #64748b); background: var(--card-bg, #fff);
        border: 1px dashed var(--border, #dbe3ef); border-radius: 16px; margin: 14px 0; text-align: center;
      }
      .wm-no-filtered-machines i { font-size: 28px; }
      .wm-no-filtered-machines strong { color: var(--text, #0f172a); }
      .compact-metrics { display: none; }
      body.compact-mode .machine-card:not(.maintenance) .gauges-container,
      body.compact-mode .machine-card:not(.maintenance) .status-indicators,
      body.compact-mode .machine-card:not(.maintenance) .machine-comment-preview,
      body.compact-mode .machine-card:not(.maintenance) .card-action { display: none !important; }
      body.compact-mode .compact-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      body.compact-mode .machine-card { width: 240px; min-width: 240px; min-height: 0; padding: 16px; }
      .compact-metric { border: 1px solid var(--border, #dbe3ef); border-radius: 12px; padding: 10px; background: rgba(37,99,235,.06); }
      .compact-metric span { display:block; font-size:11px; font-weight:700; color:var(--text-light,#64748b); text-transform:uppercase; margin-bottom:4px; }
      .compact-metric strong { font-size:22px; color:var(--text,#0f172a); }
    `;
    document.head.appendChild(style);
  }

  function installObserver() {
    const root = qs(SELECTORS.sectionsRoot) || document.body;
    const observer = new MutationObserver(function () {
      clearTimeout(installObserver.timer);
      installObserver.timer = setTimeout(function () {
        bindSearch();
        qsa('.machine-card').forEach(ensureCardDataset);
        if (document.body.classList.contains('compact-mode')) qsa('.machine-card').forEach(ensureCompactMetrics);
        applyFilters();
      }, 120);
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function init() {
    injectCss();
    loadState();
    document.addEventListener('click', handleForcedClick, true);
    bindSearch();
    setFiltersOpen(false);
    applyInitialTheme();
    applyCompact(localStorage.getItem(STORAGE.compact) === 'true');
    installObserver();
    syncUi();
    setTimeout(applyFilters, 200);
    setTimeout(applyFilters, 800);
    setTimeout(applyFilters, 1600);
  }

  window.WMHardControls = {
    state,
    applyFilters,
    openFilters: () => setFiltersOpen(true),
    closeFilters: () => setFiltersOpen(false),
    resetFilters: () => {
      state.fornos.clear();
      state.status = null;
      state.hideMaintenance = false;
      state.search = '';
      applyFilters();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
