// WMoldes - Layout forçado do cabeçalho do Histórico
(function () {
  'use strict';

  function q(sel, root = document) { return root.querySelector(sel); }
  function qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function findHistoryRoot() {
    return q('#history-section') || q('[id*="history"]') || document;
  }

  function findControlCard(root) {
    const machine = q('#historyMachineSelect');
    if (!machine) return null;

    return machine.closest('.history-controls, .history-filter-card, .history-filters, .history-toolbar, .history-header-controls, .card, .section-card')
      || machine.closest('div');
  }

  function fieldWrapper(selectId, fallbackClass) {
    const select = document.getElementById(selectId);
    if (!select) return null;

    let wrapper = select.closest('.form-group, .filter-group, .select-group, .history-field, .input-group, .field-group, .machine-field, .date-field');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = fallbackClass;
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);
    }

    wrapper.classList.add(fallbackClass, 'wm-history-field');
    return wrapper;
  }

  function findActionButton(textIncludes, onclickIncludes) {
    const buttons = qa('button, a').filter(el => {
      const text = (el.textContent || '').toLowerCase();
      const onclick = String(el.getAttribute('onclick') || '').toLowerCase();
      return text.includes(textIncludes) || onclick.includes(onclickIncludes);
    });
    return buttons[0] || null;
  }

  function findPeriodBox(root) {
    const active = q('.period-btn, .period-option, [data-period]', root);
    if (!active) return null;

    return active.closest('.period-selector, .period-options, .period-buttons')
      || active.parentElement;
  }

  function ensurePeriodOptions(periodBox) {
    if (!periodBox) return;

    const buttons = qa('.period-btn, .period-option, [data-period]', periodBox);
    buttons.forEach(btn => btn.classList.add('wm-period-item'));

    const custom = buttons.find(btn => {
      const p = String(btn.getAttribute('data-period') || '').toLowerCase();
      const t = String(btn.textContent || '').toLowerCase();
      return p === 'custom' || t.includes('personalizar');
    });

    if (custom) custom.classList.add('wm-period-custom');
  }

  function build() {
    const root = findHistoryRoot();
    const card = findControlCard(root);
    if (!card || card.__wmForcedLayoutApplied) return;

    const machineField = fieldWrapper('historyMachineSelect', 'wm-machine-field');
    const dateField = fieldWrapper('historyDate', 'wm-date-field');
    const periodBox = findPeriodBox(root);
    const tutorialBtn = findActionButton('tutorial', 'tutorial');
    const pdfBtn = findActionButton('exportar pdf', 'exporthistorypdf');
    const commentsBtn = document.getElementById('historyCommentsBtn');

    if (!machineField || !dateField || !periodBox) return;

    card.__wmForcedLayoutApplied = true;
    card.classList.add('wm-history-forced-card');

    let layout = document.getElementById('wmHistoryForcedLayout');
    if (!layout) {
      layout = document.createElement('div');
      layout.id = 'wmHistoryForcedLayout';
      layout.className = 'wm-history-forced-layout';
      card.insertBefore(layout, card.firstChild);
    }

    let actions = document.getElementById('wmHistoryForcedActions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'wmHistoryForcedActions';
      actions.className = 'wm-history-actions-row';
    }

    let fields = document.getElementById('wmHistoryForcedFields');
    if (!fields) {
      fields = document.createElement('div');
      fields.id = 'wmHistoryForcedFields';
      fields.className = 'wm-history-fields-row';
    }

    let periodWrap = document.getElementById('wmHistoryForcedPeriod');
    if (!periodWrap) {
      periodWrap = document.createElement('div');
      periodWrap.id = 'wmHistoryForcedPeriod';
      periodWrap.className = 'wm-history-period-row';
    }

    let bottom = document.getElementById('wmHistoryForcedBottom');
    if (!bottom) {
      bottom = document.createElement('div');
      bottom.id = 'wmHistoryForcedBottom';
      bottom.className = 'wm-history-bottom-row';
    }

    layout.appendChild(actions);
    layout.appendChild(fields);
    layout.appendChild(periodWrap);
    layout.appendChild(bottom);

    if (tutorialBtn) actions.appendChild(tutorialBtn);
    if (pdfBtn) actions.appendChild(pdfBtn);

    fields.appendChild(machineField);
    fields.appendChild(dateField);

    periodWrap.appendChild(periodBox);
    periodBox.classList.add('wm-period-box');
    ensurePeriodOptions(periodBox);

    if (commentsBtn) bottom.appendChild(commentsBtn);
  }

  function init() {
    build();

    const timer = setInterval(() => {
      const card = findControlCard(findHistoryRoot());
      if (card && !card.__wmForcedLayoutApplied) build();

      const commentsBtn = document.getElementById('historyCommentsBtn');
      const bottom = document.getElementById('wmHistoryForcedBottom');
      if (commentsBtn && bottom && commentsBtn.parentElement !== bottom) {
        bottom.appendChild(commentsBtn);
      }
    }, 500);

    setTimeout(() => clearInterval(timer), 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
