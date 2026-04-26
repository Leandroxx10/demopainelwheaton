/*
 * WMoldes Dashboard - Controles forçados e filtros dos cards
 * Este arquivo roda por último e assume o controle dos botões Tema, Filtros e filtros dos cards.
 */
(function () {
  'use strict';

  const STATE = {
    fornos: new Set(),
    status: null,
    hideMaintenance: false,
    search: '',
    filtersOpen: false,
    dark: false
  };

  const STORAGE_KEYS = {
    dark: 'wmoldes_dashboard_dark_mode',
    filters: 'wmoldes_dashboard_filters_v1'
  };

  const STATUS_FROM_BUTTON = {
    critico: 'critical',
    baixo: 'warning',
    normal: 'normal',
    critical: 'critical',
    warning: 'warning',
    normal: 'normal'
  };

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/maquina|máquina|maq|forno|\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function getMachineId(card) {
    return card?.dataset?.machineId || (qs('.machine-name', card)?.textContent || '').split('-')[0].trim();
  }

  function getCardStatus(card) {
    if (!card) return '';
    if (card.dataset.maintenance === 'true' || card.classList.contains('maintenance')) return 'maintenance';
    if (card.dataset.status) return card.dataset.status;
    if (card.classList.contains('critical')) return 'critical';
    if (card.classList.contains('warning')) return 'warning';
    if (card.classList.contains('normal')) return 'normal';
    return '';
  }

  function matchesSearch(card) {
    if (!STATE.search) return true;
    const wanted = normalizeText(STATE.search);
    const machineId = getMachineId(card);
    const normalizedId = normalizeText(machineId);
    const normalizedVisibleText = normalizeText(card.textContent);
    const digitsWanted = wanted.replace(/\D/g, '');
    const digitsId = normalizedId.replace(/\D/g, '');

    return normalizedId.includes(wanted) ||
      normalizedVisibleText.includes(wanted) ||
      (!!digitsWanted && digitsId === digitsWanted) ||
      (!!digitsWanted && digitsId.endsWith(digitsWanted));
  }

  function saveFilters() {
    try {
      localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify({
        fornos: Array.from(STATE.fornos),
        status: STATE.status,
        hideMaintenance: STATE.hideMaintenance,
        search: STATE.search
      }));
    } catch (_) {}
  }

  function loadFilters() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.filters);
      if (!raw) return;
      const data = JSON.parse(raw);
      STATE.fornos = new Set(Array.isArray(data.fornos) ? data.fornos : []);
      STATE.status = data.status || null;
      STATE.hideMaintenance = data.hideMaintenance === true;
      STATE.search = data.search || '';
    } catch (_) {}
  }

  function setButtonActive(button, active) {
    if (!button) return;
    button.classList.toggle('active', !!active);
    button.setAttribute('aria-pressed', String(!!active));
  }

  function syncFilterUI() {
    qsa('[data-forno]').forEach(btn => setButtonActive(btn, STATE.fornos.has(btn.dataset.forno)));
    qsa('[data-status]').forEach(btn => setButtonActive(btn, STATUS_FROM_BUTTON[btn.dataset.status] === STATE.status));

    const clearStatus = qs('#clearStatusBtn');
    setButtonActive(clearStatus, !STATE.status);

    const maintenanceBtn = qs('#hideMaintenanceBtn');
    if (maintenanceBtn) {
      setButtonActive(maintenanceBtn, STATE.hideMaintenance);
      maintenanceBtn.innerHTML = STATE.hideMaintenance
        ? '<i class="fas fa-eye"></i> Mostrar paradas para manutenção'
        : '<i class="fas fa-eye-slash"></i> Ocultar paradas para manutenção';
    }

    const search = qs('#machineSearch');
    if (search && document.activeElement !== search && search.value !== STATE.search) search.value = STATE.search;
  }

  function setFiltersOpen(open) {
    STATE.filtersOpen = !!open;
    const bar = qs('#filtersBar');
    const btn = qs('#filtersBtn');
    if (bar) {
      bar.classList.toggle('active', STATE.filtersOpen);
      bar.hidden = false;
      bar.style.display = STATE.filtersOpen ? 'block' : 'none';
    }
    if (btn) {
      btn.classList.toggle('active', STATE.filtersOpen);
      btn.setAttribute('aria-expanded', String(STATE.filtersOpen));
    }
    document.body.classList.toggle('filters-active', STATE.filtersOpen);
  }

  function hasActiveFilter() {
    return STATE.fornos.size > 0 || !!STATE.status || STATE.hideMaintenance || !!STATE.search;
  }

  function applyFilters() {
    syncFilterUI();

    const fornoSections = qs('#fornoSections');
    const cardsContainer = qs('#cardsContainer');

    // Mantém o layout por forno como fonte principal dos cards.
    if (fornoSections) fornoSections.style.display = 'flex';
    if (cardsContainer) cardsContainer.style.display = 'none';

    const cards = qsa('#fornoSections .machine-card, #cardsContainer .machine-card');
    let visibleCards = 0;

    cards.forEach(card => {
      const forno = card.dataset.forno || '';
      const status = getCardStatus(card);
      let show = true;

      if (STATE.fornos.size > 0 && !STATE.fornos.has(forno)) show = false;
      if (STATE.hideMaintenance && status === 'maintenance') show = false;
      if (STATE.status && status !== STATE.status) show = false;
      if (!matchesSearch(card)) show = false;

      card.style.display = show ? '' : 'none';
      card.dataset.wmFilteredVisible = show ? 'true' : 'false';
      if (show) visibleCards += 1;
    });

    qsa('.forno-section').forEach(section => {
      const forno = section.id ? section.id.replace(/^forno-/, '') : (qs('.forno-badge', section)?.textContent || '').replace(/[^A-D]/gi, '').toUpperCase();
      const selectedFornoAllows = STATE.fornos.size === 0 || STATE.fornos.has(forno);
      const visibleInSection = qsa('.machine-card', section).some(card => card.dataset.wmFilteredVisible === 'true');
      section.style.display = selectedFornoAllows && visibleInSection ? '' : 'none';
    });

    updateEmptyMessage(visibleCards);
    updateCountersFromVisibleCards();
    saveFilters();
  }

  function updateEmptyMessage(totalVisible) {
    let empty = qs('#wmForceEmptyMessage');
    const root = qs('#fornoSections');
    if (!root) return;

    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'wmForceEmptyMessage';
      empty.className = 'wm-force-empty-message';
      empty.innerHTML = '<i class="fas fa-search"></i><p>Nenhuma máquina encontrada com os filtros selecionados.</p>';
      root.appendChild(empty);
    }

    empty.style.display = hasActiveFilter() && totalVisible === 0 ? 'flex' : 'none';
  }

  function updateCountersFromVisibleCards() {
    const visibleCards = qsa('#fornoSections .machine-card').filter(card => card.dataset.wmFilteredVisible !== 'false');
    const counters = {
      total: visibleCards.length,
      maintenance: 0,
      critical: 0,
      warning: 0,
      normal: 0
    };

    visibleCards.forEach(card => {
      const status = getCardStatus(card);
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

    Object.entries(map).forEach(([id, value]) => {
      const el = qs('#' + id);
      if (el) el.textContent = String(value);
    });
  }

  function resetFornos() {
    STATE.fornos.clear();
    applyFilters();
  }

  function resetStatus() {
    STATE.status = null;
    applyFilters();
  }

  function toggleTheme(force) {
    const next = typeof force === 'boolean' ? force : !document.body.classList.contains('dark-mode');
    STATE.dark = next;
    document.documentElement.classList.toggle('dark-mode', next);
    document.body.classList.toggle('dark-mode', next);
    try {
      localStorage.setItem(STORAGE_KEYS.dark, next ? 'true' : 'false');
      localStorage.setItem('modoEscuro', next ? 'true' : 'false');
    } catch (_) {}

    const btn = qs('#themeBtn');
    if (btn) {
      btn.innerHTML = next
        ? '<i class="fas fa-sun"></i> Tema Claro'
        : '<i class="fas fa-moon"></i> Tema Escuro';
      setButtonActive(btn, next);
    }
  }

  function bindForcedEvents() {
    const filtersBtn = qs('#filtersBtn');
    if (filtersBtn) {
      filtersBtn.setAttribute('type', 'button');
      filtersBtn.setAttribute('aria-controls', 'filtersBar');
      filtersBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setFiltersOpen(!STATE.filtersOpen);
      }, true);
    }

    const themeBtn = qs('#themeBtn');
    if (themeBtn) {
      themeBtn.setAttribute('type', 'button');
      themeBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleTheme();
      }, true);
    }

    qsa('[data-forno]').forEach(btn => {
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const forno = btn.dataset.forno;
        if (STATE.fornos.has(forno)) STATE.fornos.delete(forno);
        else STATE.fornos.add(forno);
        applyFilters();
      }, true);
    });

    qsa('[data-status]').forEach(btn => {
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const status = STATUS_FROM_BUTTON[btn.dataset.status] || null;
        STATE.status = STATE.status === status ? null : status;
        applyFilters();
      }, true);
    });

    const clearFornoBtn = qs('#clearFornoBtn');
    if (clearFornoBtn) {
      clearFornoBtn.setAttribute('type', 'button');
      clearFornoBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        resetFornos();
      }, true);
    }

    const clearStatusBtn = qs('#clearStatusBtn');
    if (clearStatusBtn) {
      clearStatusBtn.setAttribute('type', 'button');
      clearStatusBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        resetStatus();
      }, true);
    }

    const maintenanceBtn = qs('#hideMaintenanceBtn');
    if (maintenanceBtn) {
      maintenanceBtn.setAttribute('type', 'button');
      maintenanceBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        STATE.hideMaintenance = !STATE.hideMaintenance;
        applyFilters();
      }, true);
    }

    const search = qs('#machineSearch');
    if (search) {
      search.addEventListener('input', function (event) {
        event.stopImmediatePropagation();
        STATE.search = search.value.trim();
        applyFilters();
      }, true);
      search.addEventListener('keyup', function (event) {
        event.stopImmediatePropagation();
        STATE.search = search.value.trim();
        applyFilters();
      }, true);
      search.addEventListener('search', function (event) {
        event.stopImmediatePropagation();
        STATE.search = search.value.trim();
        applyFilters();
      }, true);
    }
  }

  function installObserver() {
    const root = qs('#fornoSections') || document.body;
    const observer = new MutationObserver(function () {
      window.clearTimeout(installObserver._timer);
      installObserver._timer = window.setTimeout(applyFilters, 80);
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function injectCss() {
    if (qs('#wmForceControlsCss')) return;
    const style = document.createElement('style');
    style.id = 'wmForceControlsCss';
    style.textContent = `
      #filtersBar.active { display: block !important; }
      #filtersBtn.active,
      #themeBtn.active,
      .filter-btn.active {
        background: var(--primary, #2563eb) !important;
        border-color: var(--primary, #2563eb) !important;
        color: #fff !important;
      }
      #hideMaintenanceBtn.active {
        background: #7c3aed !important;
        border-color: #7c3aed !important;
        color: #fff !important;
      }
      .wm-force-empty-message {
        width: 100%;
        min-height: 180px;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 12px;
        color: var(--text-secondary, #64748b);
        border: 1px dashed var(--border, #dbe3ef);
        border-radius: 16px;
        background: var(--card-bg, #fff);
      }
      .wm-force-empty-message i { font-size: 28px; }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectCss();
    loadFilters();
    bindForcedEvents();
    setFiltersOpen(false);
    toggleTheme(localStorage.getItem(STORAGE_KEYS.dark) === 'true' || localStorage.getItem('modoEscuro') === 'true');
    syncFilterUI();
    installObserver();
    window.setTimeout(applyFilters, 250);
    window.setTimeout(applyFilters, 1000);
  }

  window.WMForceControls = {
    applyFilters,
    openFilters: () => setFiltersOpen(true),
    closeFilters: () => setFiltersOpen(false),
    resetFilters: function () {
      STATE.fornos.clear();
      STATE.status = null;
      STATE.hideMaintenance = false;
      STATE.search = '';
      applyFilters();
    },
    state: STATE
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
