// WMoldes - Atalho do modal de comentários para o gráfico
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function normalizeMachine(value) {
    return String(value || '').replace(/^Máquina\s+/i, '').trim();
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function normalizeDateToBR(value) {
    const text = String(value || '').trim();

    if (!text) return '';

    const br = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[1]}/${br[2]}/${br[3]}`;

    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
    }

    return '';
  }

  function timeToMinutes(time) {
    const match = String(time || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function choosePeriodForTime(startTime) {
    const minutes = timeToMinutes(startTime);
    if (minutes === null) return '24h';

    if (minutes >= 6 * 60 && minutes < 14 * 60) return 'shift1';
    if (minutes >= 14 * 60 && minutes < 22 * 60) return 'shift2';
    return 'shift3';
  }

  function setSelectValueByMachine(machine) {
    const select = $('historyMachineSelect');
    if (!select) return false;

    const normalized = normalizeMachine(machine);
    let matched = false;

    Array.from(select.options || []).forEach((option, index) => {
      const value = normalizeMachine(option.value);
      const text = normalizeMachine(option.textContent);

      if (value === normalized || text === normalized || text === `Máquina ${normalized}`) {
        select.selectedIndex = index;
        select.value = option.value;
        matched = true;
      }
    });

    if (!matched) {
      const option = document.createElement('option');
      option.value = normalized;
      option.textContent = `Máquina ${normalized}`;
      select.appendChild(option);
      select.value = normalized;
      matched = true;
    }

    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));

    return matched;
  }

  function setDateValue(dateValue) {
    const br = normalizeDateToBR(dateValue);
    if (!br) return false;

    const select = $('historyDate');
    if (!select) return false;

    let matched = false;

    Array.from(select.options || []).forEach((option, index) => {
      const optionBR = normalizeDateToBR(option.value || option.textContent);
      if (optionBR === br) {
        select.selectedIndex = index;
        select.value = option.value;
        matched = true;
      }
    });

    if (!matched) {
      const option = document.createElement('option');
      option.value = br;
      option.textContent = br;
      select.appendChild(option);
      select.value = br;
      matched = true;
    }

    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));

    return matched;
  }

  function setPeriodForTime(startTime) {
    const period = choosePeriodForTime(startTime);
    const candidates = Array.from(document.querySelectorAll('.period-btn, .period-option, [data-period]'));

    let target = candidates.find(btn => String(btn.getAttribute('data-period') || '').toLowerCase() === period);

    if (!target && period === 'shift1') target = candidates.find(btn => /turno\s*1/i.test(btn.textContent || ''));
    if (!target && period === 'shift2') target = candidates.find(btn => /turno\s*2/i.test(btn.textContent || ''));
    if (!target && period === 'shift3') target = candidates.find(btn => /turno\s*3/i.test(btn.textContent || ''));

    if (!target) target = candidates.find(btn => String(btn.getAttribute('data-period') || '').toLowerCase() === '24h');

    if (target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  }

  function closeCommentsModal() {
    const modal = $('historyCommentsModal');
    if (modal) modal.classList.remove('active');
  }

  function scrollToHistoryChart() {
    const canvas = $('historyChart');
    if (!canvas) return;

    canvas.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  function hourFromLabel(label) {
    const match = String(label || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) + Number(match[2]) / 60;
  }

  function scrollChartToTime(startTime) {
    const canvas = $('historyChart');
    const scroll = document.querySelector('.chart-scroll');
    const chart = window.Chart && canvas ? Chart.getChart(canvas) : null;

    if (!canvas || !scroll || !chart || !chart.scales) return;

    const minutes = timeToMinutes(startTime);
    if (minutes === null) return;

    const targetHour = minutes / 60;
    const labels = chart.data && chart.data.labels ? chart.data.labels : [];

    if (!labels.length) return;

    let bestIndex = 0;
    let bestDiff = Infinity;

    labels.forEach((label, index) => {
      const hour = hourFromLabel(label);
      if (hour === null) return;

      let diff = Math.abs(hour - targetHour);
      if (diff > 12) diff = Math.abs((hour + 24) - targetHour);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });

    const scale = chart.scales.x || Object.values(chart.scales).find(item => item.axis === 'x');
    if (!scale || typeof scale.getPixelForValue !== 'function') return;

    const pixel = scale.getPixelForValue(bestIndex);
    const canvasRect = canvas.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();

    const relativeX = pixel * (canvasRect.width / canvas.width);
    const desiredLeft = Math.max(0, relativeX - scrollRect.width / 2);

    scroll.scrollTo({ left: desiredLeft, behavior: 'smooth' });
  }

  function highlightShortcut(startTime) {
    const canvas = $('historyChart');
    const host = canvas ? (canvas.closest('.chart-container') || canvas.parentElement) : null;
    if (!host) return;

    const old = document.querySelector('.wm-shortcut-highlight');
    if (old) old.remove();

    const badge = document.createElement('div');
    badge.className = 'wm-shortcut-highlight';
    badge.innerHTML = `<i class="fas fa-crosshairs"></i> Anotação ${startTime || ''}`;
    host.appendChild(badge);

    setTimeout(() => badge.remove(), 4500);
  }

  function loadGraphAfterSelection(startTime) {
    setTimeout(() => {
      if (typeof window.loadHistoryChart === 'function') {
        try { window.loadHistoryChart(); } catch (error) { console.warn(error); }
      }

      setTimeout(() => {
        scrollToHistoryChart();
        scrollChartToTime(startTime);

        if (window.WMoldesHistoryNotes && typeof window.WMoldesHistoryNotes.refresh === 'function') {
          try { window.WMoldesHistoryNotes.refresh(); } catch {}
        }

        highlightShortcut(startTime);
      }, 900);
    }, 250);
  }

  function handleClick(event) {
    const button = event.target.closest('[data-history-comment-goto]');
    if (!button) return;

    const card = button.closest('.history-comment-card');
    if (!card) return;

    const machine = card.dataset.machine || '';
    const date = card.dataset.date || '';
    const startTime = card.dataset.startTime || '';

    if (!machine) {
      alert('Não foi possível identificar a máquina deste comentário.');
      return;
    }

    setSelectValueByMachine(machine);
    setDateValue(date);
    setPeriodForTime(startTime);
    closeCommentsModal();
    loadGraphAfterSelection(startTime);
  }

  document.addEventListener('click', handleClick);

  window.WMoldesCommentShortcut = {
    goTo: function (machine, date, startTime) {
      setSelectValueByMachine(machine);
      setDateValue(date);
      setPeriodForTime(startTime);
      closeCommentsModal();
      loadGraphAfterSelection(startTime);
    }
  };
})();
