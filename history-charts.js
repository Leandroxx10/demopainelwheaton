// ================= GRÁFICOS DE HISTÓRICO =================
// WMoldes - versão estável sem recursão.
// Corrige o canvas reutilizado e preserva o gráfico/tabela/insights.
(function () {
  'use strict';

  let chart = null;
  let currentData = [];
  let displayedData = [];
  let currentMachine = '';
  let currentDate = '';
  let chartType = 'line';
  let isLoading = false;

  const datasetVisibility = {
    molde: true,
    blank: true,
    neckring: false,
    funil: false
  };

  const CORES = {
    molde: '#2563eb',
    blank: '#4b5563',
    neckring: '#b45309',
    funil: '#6b7280'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getSelectedMachineSafe() {
    const select = $('historyMachineSelect');
    if (!select) return '';

    const value = String(select.value || '').trim();
    const text = select.options && select.selectedIndex >= 0
      ? String(select.options[select.selectedIndex].textContent || '').trim()
      : '';

    let machine = value || text;
    machine = machine.replace(/^Máquina\s+/i, '').trim();

    if (!machine || /selecione|selecionar|carregando/i.test(machine)) {
      return '';
    }

    return machine;
  }


  function pad2(v) {
    return String(v).padStart(2, '0');
  }

  function parseBRDate(value) {
    const [d, m, y] = String(value || '').split('/').map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
  }

  function formatBRDate(date) {
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function formatISODate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function getDateISOFromBR(value) {
    const d = parseBRDate(value);
    return d ? formatISODate(d) : '';
  }

  function addDays(value, days) {
    const d = parseBRDate(value);
    if (!d) return value;
    d.setDate(d.getDate() + days);
    return formatBRDate(d);
  }

  function toMinutes(time) {
    const [h, m] = String(time || '00:00').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  function getActivePeriod() {
    const active = document.querySelector('.period-btn.active, .period-option.active');
    return active ? (active.getAttribute('data-period') || '24h') : '24h';
  }

  function getPeriodRange(period) {
    if (period === 'custom') {
      const start = $('customStartTime')?.value || '00:00';
      const end = $('customEndTime')?.value || '23:59';
      return { start, end, includeNextDate: toMinutes(start) > toMinutes(end) };
    }

    if (period === 'shift1' || period === 'turno1') return { start: '06:00', end: '14:00', includeNextDate: false };
    if (period === 'shift2' || period === 'turno2') return { start: '14:00', end: '22:00', includeNextDate: false };
    if (period === 'shift3' || period === 'turno3') return { start: '22:00', end: '06:00', includeNextDate: true };

    return { start: '00:00', end: '23:59', includeNextDate: false };
  }

  function recordDateBR(record) {
    if (record.data) return record.data;

    if (record.dataISO) {
      const [y, m, d] = String(record.dataISO).split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
    }

    if (record.timestamp) return formatBRDate(new Date(record.timestamp));

    return '';
  }

  function normalizeRecord(key, record) {
    const ts = Number(record.timestamp || Date.now());
    const date = new Date(ts);
    const horaNum = Number.isFinite(record.horaNum) ? Number(record.horaNum) : date.getHours();
    const minutoNum = Number.isFinite(record.minutoNum) ? Number(record.minutoNum) : date.getMinutes();
    const data = recordDateBR(record);

    return {
      id: key,
      timestamp: ts,
      data,
      dataISO: record.dataISO || getDateISOFromBR(data),
      hora: record.hora || `${pad2(horaNum)}:${pad2(minutoNum)}`,
      horaNum,
      minutoNum,
      molde: Number(record.molde !== undefined ? record.molde : (record.new_molde || 0)),
      blank: Number(record.blank !== undefined ? record.blank : (record.new_blank || 0)),
      neck_ring: Number(record.neck_ring !== undefined ? record.neck_ring : (record.new_neckring || 0)),
      funil: Number(record.funil !== undefined ? record.funil : (record.new_funil || 0)),
      tipo: record.tipo || 'hourly'
    };
  }

  function chronologicalOrder(record, period = getActivePeriod()) {
    const minutes = (Number(record.horaNum) || 0) * 60 + (Number(record.minutoNum) || 0);
    const range = getPeriodRange(period);
    const start = toMinutes(range.start);
    const end = toMinutes(range.end);
    const nextBR = addDays(currentDate, 1);
    const nextISO = getDateISOFromBR(nextBR);
    const recordDate = record.data || record.dataISO || '';

    if (start > end) {
      if (recordDate === nextBR || recordDate === nextISO) return 1440 + minutes;
      return minutes;
    }

    return minutes;
  }

  function sortRecords(records, period = getActivePeriod()) {
    return [...(records || [])].sort((a, b) => {
      const ao = chronologicalOrder(a, period);
      const bo = chronologicalOrder(b, period);
      if (ao !== bo) return ao - bo;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }

  async function getHistoryFromFirebase(machine, dateBR, period) {
    if (!machine) return [];

    if (typeof historicoRef === 'undefined' || !historicoRef) {
      console.warn('historicoRef não definido');
      return [];
    }

    const range = getPeriodRange(period);
    const acceptedBR = new Set([dateBR]);
    const acceptedISO = new Set([getDateISOFromBR(dateBR)]);

    if (range.includeNextDate) {
      const next = addDays(dateBR, 1);
      acceptedBR.add(next);
      acceptedISO.add(getDateISOFromBR(next));
    }

    const snapshot = await historicoRef.child(machine).once('value');
    const rows = snapshot.val() || {};
    const result = [];

    Object.keys(rows).forEach(key => {
      const normalized = normalizeRecord(key, rows[key] || {});
      if (acceptedBR.has(normalized.data) || acceptedISO.has(normalized.dataISO)) {
        result.push(normalized);
      }
    });

    return sortRecords(result, period);
  }

  function filterByPeriod(rows, period) {
    const range = getPeriodRange(period);

    if (period === '24h') {
      const iso = getDateISOFromBR(currentDate);
      return rows.filter(r => r.data === currentDate || r.dataISO === iso);
    }

    const start = toMinutes(range.start);
    const end = toMinutes(range.end);
    const currentISO = getDateISOFromBR(currentDate);
    const nextBR = addDays(currentDate, 1);
    const nextISO = getDateISOFromBR(nextBR);

    return rows.filter(r => {
      const minutes = (r.horaNum || 0) * 60 + (r.minutoNum || 0);
      const isCurrent = r.data === currentDate || r.dataISO === currentISO;
      const isNext = r.data === nextBR || r.dataISO === nextISO;

      if (start <= end) return isCurrent && minutes >= start && minutes <= end;

      return (isCurrent && minutes >= start) || (isNext && minutes <= end);
    });
  }

  function safeDestroyChart() {
    const canvas = $('historyChart');

    try {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    } catch (err) {
      console.warn('Erro ao destruir chart local', err);
    }

    try {
      if (window.Chart && canvas) {
        const existing = Chart.getChart(canvas);
        if (existing && typeof existing.destroy === 'function') existing.destroy();
      }
    } catch (err) {
      console.warn('Erro ao destruir chart do canvas', err);
    }

    chart = null;
    window.historyChart = null;
  }

  function setChartWidth(count) {
    const inner = document.querySelector('.chart-inner');
    const scroll = document.querySelector('.chart-scroll');

    if (!inner) return;

    const width = Math.max(1100, count * (chartType === 'bar' ? 80 : 95));
    inner.style.minWidth = `${width}px`;
    inner.style.width = `${width}px`;

    if (scroll) scroll.scrollLeft = 0;
  }

  function getChartBoundaryLabels(period) {
    const range = getPeriodRange(period);
    const startLabel = range.start;
    const endLabel = range.includeNextDate ? `${range.end} (${addDays(currentDate, 1).slice(0, 5)})` : range.end;
    return { startLabel, endLabel };
  }

  function normalizePointLabel(item) {
    return item.data && item.data !== currentDate ? `${item.hora} (${item.data.slice(0, 5)})` : item.hora;
  }

  function buildChart(rows) {
    const canvas = $('historyChart');
    if (!canvas || !window.Chart) return;

    safeDestroyChart();

    const period = getActivePeriod();
    const sortedRows = sortRecords(rows || [], period);
    const boundary = getChartBoundaryLabels(period);
    const pointMap = new Map();

    sortedRows.forEach(item => {
      const label = normalizePointLabel(item);
      pointMap.set(label, {
        label,
        isBoundary: false,
        molde: item.molde || 0,
        blank: item.blank || 0,
        neckring: item.neck_ring || 0,
        funil: item.funil || 0
      });
    });

    const points = [];

    // Mantém o eixo começando exatamente no início do período/turno, mas sem desenhar linha falsa.
    points.push({ label: boundary.startLabel, isBoundary: true, molde: null, blank: null, neckring: null, funil: null });

    pointMap.forEach(point => {
      if (point.label !== boundary.startLabel && point.label !== boundary.endLabel) points.push(point);
      else if (point.label === boundary.startLabel) points[0] = point;
    });

    // Mantém espaço visual à direita até o final do período/turno, sem prolongar a linha até esse horário.
    if (!pointMap.has(boundary.endLabel)) {
      points.push({ label: boundary.endLabel, isBoundary: true, molde: null, blank: null, neckring: null, funil: null });
    } else if (!points.some(p => p.label === boundary.endLabel)) {
      points.push(pointMap.get(boundary.endLabel));
    }

    setChartWidth(Math.max(points.length + 1, 8));

    const datasets = [];

    function addDataset(key, label, field) {
      if (!datasetVisibility[key]) return;

      datasets.push({
        label,
        data: points.map(p => p[field]),
        borderColor: CORES[key],
        backgroundColor: chartType === 'bar' ? `${CORES[key]}80` : 'transparent',
        borderWidth: 2,
        pointRadius: ctx => points[ctx.dataIndex]?.isBoundary ? 0 : (chartType === 'line' ? 3 : 0),
        pointHoverRadius: ctx => points[ctx.dataIndex]?.isBoundary ? 0 : 5,
        tension: 0.12,
        spanGaps: false
      });
    }

    addDataset('molde', 'Moldes', 'molde');
    addDataset('blank', 'Blanks', 'blank');
    addDataset('neckring', 'Neck Rings', 'neckring');
    addDataset('funil', 'Funís', 'funil');

    const endLabelsPlugin = {
      id: 'wmEndLabels',
      afterDatasetsDraw(chartInstance) {
        if (chartType !== 'line') return;

        const { ctx, chartArea } = chartInstance;
        const labelInfo = [];

        chartInstance.data.datasets.forEach((dataset, datasetIndex) => {
          if (!['Moldes', 'Blanks'].includes(dataset.label)) return;
          if (!chartInstance.isDatasetVisible(datasetIndex)) return;

          const data = dataset.data || [];
          let lastIndex = -1;
          for (let i = data.length - 1; i >= 0; i--) {
            if (data[i] !== null && data[i] !== undefined && Number.isFinite(Number(data[i]))) {
              lastIndex = i;
              break;
            }
          }
          if (lastIndex < 0) return;

          const point = chartInstance.getDatasetMeta(datasetIndex).data[lastIndex];
          if (!point) return;

          labelInfo.push({
            key: dataset.label === 'Moldes' ? 'M' : 'BL',
            value: Number(data[lastIndex]),
            color: dataset.borderColor,
            x: point.x,
            y: point.y
          });
        });

        if (!labelInfo.length) return;

        const hasTie = labelInfo.length >= 2 && labelInfo.every(item => item.value === labelInfo[0].value);
        const baseX = Math.max(...labelInfo.map(item => item.x)) + 28;

        ctx.save();
        ctx.font = 'bold 13px Arial';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        labelInfo.forEach((item, index) => {
          ctx.fillStyle = item.color;
          const x = hasTie ? baseX + (index * 28) : item.x + 28;
          const y = Math.min(Math.max(item.y, chartArea.top + 8), chartArea.bottom - 8);
          ctx.fillText(item.key, x, y);
        });

        ctx.restore();
      }
    };

    chart = new Chart(canvas.getContext('2d'), {
      type: chartType,
      data: {
        labels: points.map(p => p.label),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: { top: 78, right: 80 }
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: datasets.length > 0,
            position: 'top',
            labels: { usePointStyle: true, boxWidth: 8 }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            filter: ctx => ctx.raw !== null && ctx.raw !== undefined
          },
          title: {
            display: datasets.length === 0,
            text: 'Selecione Moldes, Blanks, Neck Rings ou Funís para visualizar'
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { ticks: { autoSkip: false, maxRotation: 0 } }
        }
      },
      plugins: [endLabelsPlugin]
    });

    window.historyChart = chart;

    setTimeout(() => {
      if (window.WMoldesHistoryNotes?.refresh) window.WMoldesHistoryNotes.refresh();
    }, 120);
  }

  function updateTable(rows) {
    const tbody = $('historyTableBody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">Nenhum registro encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = sortRecords(rows).map(item => {
      const icon = item.tipo === 'real_time' ? '⚡' : '⏰';
      const hora = item.data && item.data !== currentDate ? `${item.hora} (${item.data.slice(0, 5)})` : item.hora;

      return `
        <tr>
          <td>${hora} ${icon}</td>
          <td>${item.molde || 0}</td>
          <td>${item.blank || 0}</td>
          <td>${item.neck_ring || 0}</td>
          <td>${item.funil || 0}</td>
        </tr>
      `;
    }).join('');
  }

  function updateInsights(rows) {
    const container = $('chartInsights');
    if (!container) return;

    if (!rows.length) {
      container.innerHTML = '';
      return;
    }

    const totals = rows.reduce((acc, item) => {
      acc.molde += item.molde || 0;
      acc.blank += item.blank || 0;
      acc.neck += item.neck_ring || 0;
      acc.funil += item.funil || 0;
      return acc;
    }, { molde: 0, blank: 0, neck: 0, funil: 0 });

    container.innerHTML = `
      <div class="insight-card"><span>Total Moldes</span><strong>${totals.molde}</strong></div>
      <div class="insight-card"><span>Total Blanks</span><strong>${totals.blank}</strong></div>
      <div class="insight-card"><span>Total Neck Rings</span><strong>${totals.neck}</strong></div>
      <div class="insight-card"><span>Total Funís</span><strong>${totals.funil}</strong></div>
      <div class="insight-card"><span>Registros</span><strong>${rows.length}</strong></div>
    `;
  }

  function showEmpty(machine, date, period) {
    hideEmpty();

    const canvas = $('historyChart');
    const wrapper = canvas ? (canvas.closest('.chart-inner') || canvas.parentElement) : null;
    if (!wrapper) return;

    if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';

    const div = document.createElement('div');
    div.id = 'historyChartEmptyState';
    div.className = 'history-chart-empty-state';
    div.innerHTML = `
      <div style="text-align:center;padding:30px;color:#64748b;">
        <strong>Nenhum dado encontrado para este período</strong><br>
        Máquina ${machine || '-'} · ${date || '-'} · ${period || '24h'}
      </div>
    `;
    wrapper.appendChild(div);
  }

  function hideEmpty() {
    const e = $('historyChartEmptyState');
    if (e) e.remove();
  }

  async function loadHistoryChart() {
    if (isLoading) return;

    const machine = getSelectedMachineSafe();
    const date = $('historyDate')?.value || '';

    if (!machine) {
      safeAlert('erro', 'Selecione uma máquina válida');
      return;
    }

    if (!date) {
      safeAlert('erro', 'Selecione uma data');
      return;
    }

    currentMachine = machine;
    currentDate = date;
    isLoading = true;

    const container = document.querySelector('.chart-container');
    if (container) container.style.opacity = '0.6';

    try {
      const period = getActivePeriod();
      const data = await getHistoryFromFirebase(machine, date, period);
      currentData = data;
      displayedData = sortRecords(filterByPeriod(data, period), period);

      if (!displayedData.length) {
        showEmpty(machine, date, period);
        buildChart([]);
        updateTable([]);
        updateInsights([]);
      } else {
        hideEmpty();
        buildChart(displayedData);
        updateTable(displayedData);
        updateInsights(displayedData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      safeAlert('erro', 'Erro ao carregar dados: ' + (err.message || err));
    } finally {
      isLoading = false;
      if (container) container.style.opacity = '1';
    }
  }

  function safeAlert(type, message) {
    const alertFn = window.showAlert;
    if (typeof alertFn === 'function' && alertFn !== safeAlert) {
      try {
        alertFn(type, message);
        return;
      } catch {}
    }
    console.log(type, message);
  }

  function fillDates() {
    const select = $('historyDate');
    if (!select) return;

    select.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const value = formatBRDate(d);
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value + (i === 0 ? ' (Hoje)' : '');
      select.appendChild(option);
    }

    currentDate = select.value;
  }

  function fillMachines() {
    const select = $('historyMachineSelect');
    if (!select) return;

    if (select.options && select.options.length > 1 && select.value) return;

    select.innerHTML = '<option value="">Selecione uma máquina</option>';

    let machines = [];

    if (window.allAdminMachines) machines = Object.keys(window.allAdminMachines).sort();
    else if (window.allMachinesData) machines = Object.keys(window.allMachinesData).sort();

    machines.forEach(machine => {
      const option = document.createElement('option');
      option.value = machine;
      option.textContent = `Máquina ${machine}`;
      select.appendChild(option);
    });
  }

  function injectShiftButtons() {
    const container = document.querySelector('.period-selector, .period-options, .period-buttons');
    if (!container || document.querySelector('[data-period="shift1"]')) return;

    const custom = container.querySelector('[data-period="custom"]');

    [
      ['shift1', 'Turno 1<br><small>06:00 - 14:00</small>'],
      ['shift2', 'Turno 2<br><small>14:00 - 22:00</small>'],
      ['shift3', 'Turno 3<br><small>22:00 - 06:00</small>']
    ].forEach(([period, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'period-btn period-option';
      button.dataset.period = period;
      button.innerHTML = label;

      if (custom) container.insertBefore(button, custom);
      else container.appendChild(button);
    });
  }

  function bindEvents() {
    const machine = $('historyMachineSelect');
    if (machine && !machine.__historyStableBound) {
      machine.__historyStableBound = true;
      machine.addEventListener('change', () => {
        currentMachine = machine.value;
        if (machine.value && currentDate) loadHistoryChart();
      });
    }

    const date = $('historyDate');
    if (date && !date.__historyStableBound) {
      date.__historyStableBound = true;
      date.addEventListener('change', () => {
        currentDate = date.value;
        if ($('historyMachineSelect')?.value) loadHistoryChart();
      });
    }

    const customStart = $('customStartTime');
    if (customStart && !customStart.__historyStableBound) {
      customStart.__historyStableBound = true;
      customStart.addEventListener('change', () => {
        if (currentMachine && currentDate) loadHistoryChart();
      });
    }

    const customEnd = $('customEndTime');
    if (customEnd && !customEnd.__historyStableBound) {
      customEnd.__historyStableBound = true;
      customEnd.addEventListener('change', () => {
        if (currentMachine && currentDate) loadHistoryChart();
      });
    }

    document.querySelectorAll('.period-btn, .period-option').forEach(btn => {
      if (btn.__historyStableBound) return;
      btn.__historyStableBound = true;

      if (!btn.dataset.period && /24/.test(btn.textContent || '')) btn.dataset.period = '24h';

      btn.addEventListener('click', e => {
        e.preventDefault();

        document.querySelectorAll('.period-btn, .period-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const period = btn.dataset.period || '24h';
        const custom = $('customTimeContainer');
        if (custom) custom.style.display = period === 'custom' ? 'block' : 'none';

        if (currentMachine && currentDate) loadHistoryChart();
      });
    });

    [
      ['toggleMolde', 'molde'],
      ['toggleBlank', 'blank'],
      ['toggleNeckring', 'neckring'],
      ['toggleFunil', 'funil']
    ].forEach(([id, key]) => {
      const btn = $(id);
      if (!btn || btn.__historyStableBound) return;
      btn.__historyStableBound = true;

      btn.classList.toggle('active', datasetVisibility[key]);

      btn.addEventListener('click', e => {
        e.preventDefault();
        datasetVisibility[key] = !datasetVisibility[key];
        btn.classList.toggle('active', datasetVisibility[key]);
        buildChart(displayedData.length ? displayedData : currentData);
      });
    });

    document.querySelectorAll('.btn-generate, #toggleChartBtn').forEach(btn => {
      const wrapper = btn.closest('.history-action, .action-button-wrapper, .chart-action') || btn;
      wrapper.style.display = 'none';
      wrapper.setAttribute('aria-hidden', 'true');
    });
  }

  function initHistorySection() {
    fillDates();
    fillMachines();
    injectShiftButtons();
    bindEvents();
    buildChart([]);
  }

  window.initHistorySection = initHistorySection;
  window.loadHistoryChart = loadHistoryChart;
  window.toggleChartType = function () {
    chartType = chartType === 'line' ? 'bar' : 'line';
    buildChart(displayedData.length ? displayedData : currentData);
  };
  window.exportHistoryPdf = async function () {
    try {
      const selectedMachineForExport = typeof getSelectedMachineSafe === 'function'
        ? getSelectedMachineSafe()
        : ($('historyMachineSelect')?.value || currentMachine || '');

      if (!selectedMachineForExport) {
        alert('Selecione uma máquina antes de exportar.');
        return;
      }

      const machine = selectedMachineForExport;
      const date = $('historyDate')?.value || currentDate || '-';
      const period = getActivePeriod();

      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('Biblioteca PDF não carregada. Atualize a página com Ctrl + F5 e tente novamente.');
        return;
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      let y = 14;

      function resetPage() {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      }

      function addPageIfNeeded(requiredHeight) {
        if (y + requiredHeight > pageHeight - 12) {
          pdf.addPage();
          resetPage();
          y = 14;
        }
      }

      resetPage();

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(16);
      pdf.text('Histórico de Produção', margin, y);

      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`Máquina: ${machine}`, margin, y);
      pdf.text(`Data: ${date}`, margin + 65, y);
      pdf.text(`Período: ${period}`, margin + 125, y);

      y += 7;
      pdf.setDrawColor(220, 226, 235);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      const canvas = $('historyChart');
      if (canvas) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);

        const imgData = tempCanvas.toDataURL('image/png', 1.0);
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = Math.min(92, (tempCanvas.height * imgWidth) / tempCanvas.width);

        pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
        y += imgHeight + 10;
      }

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Quantidade por horário', margin, y);
      y += 8;

      const headers = ['Horário', 'Moldes', 'Blanks', 'Neck Rings', 'Funís'];
      const colX = [margin, margin + 42, margin + 72, margin + 102, margin + 142];
      const tableRight = pageWidth - margin;

      const sourceRows = (displayedData && displayedData.length ? displayedData : currentData) || [];
      const rows = sortRecords(sourceRows).map(item => [
        item.data && item.data !== currentDate ? `${item.hora} (${item.data.slice(0, 5)})` : item.hora,
        String(item.molde ?? 0),
        String(item.blank ?? 0),
        String(item.neck_ring ?? 0),
        String(item.funil ?? 0)
      ]);

      function drawHeader() {
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, y, tableRight - margin, 8, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);

        headers.forEach((header, index) => {
          pdf.text(header, colX[index] + 2, y + 5.2);
        });

        y += 8;
        pdf.setDrawColor(226, 232, 240);
        pdf.setTextColor(15, 23, 42);
      }

      drawHeader();

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);

      if (!rows.length) {
        pdf.setTextColor(100, 116, 139);
        pdf.text('Nenhum registro encontrado.', margin + 2, y + 5);
        y += 8;
      } else {
        rows.forEach((row, rowIndex) => {
          addPageIfNeeded(9);

          // Fundo branco/levemente cinza só na linha, sem blocos grandes.
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y, tableRight - margin, 7, 'F');
          }

          pdf.setDrawColor(226, 232, 240);
          pdf.line(margin, y + 7, tableRight, y + 7);

          pdf.setTextColor(15, 23, 42);
          row.forEach((text, index) => {
            pdf.text(String(text || '').slice(0, 24), colX[index] + 2, y + 4.8);
          });

          y += 7;
        });
      }

      y += 10;

      let pdfItems = [];
      if (window.WMoldesCommentsModal && typeof window.WMoldesCommentsModal.getByMachine === 'function') {
        pdfItems = await window.WMoldesCommentsModal.getByMachine(machine);
      }

      addPageIfNeeded(25);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Comentários e anotações da máquina', margin, y);
      y += 7;

      if (!pdfItems.length) {
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, y, pageWidth - margin * 2, 16, 3, 3, 'FD');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Nenhum comentário ou anotação encontrado para esta máquina.', margin + 4, y + 9.5);
        y += 20;
      } else {
        pdfItems.slice(0, 40).forEach(item => {
          const timeText = item.startTime
            ? `${item.startTime}${item.endTime ? ' - ' + item.endTime : ''}`
            : (item.createdAtText || '-');

          const author = item.author || 'Usuário';
          const message = item.text || '';
          const label = item.type === 'note' ? 'Anotação do gráfico' : 'Comentário';
          const messageLines = pdf.splitTextToSize(message, pageWidth - margin * 2 - 8);
          const boxHeight = Math.max(24, 19 + messageLines.length * 4);

          addPageIfNeeded(boxHeight + 5);

          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(226, 232, 240);
          pdf.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 3, 3, 'FD');

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8.5);
          pdf.setTextColor(37, 99, 235);
          pdf.text(`${label} • ${timeText}`, margin + 4, y + 6);

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(71, 85, 105);
          pdf.text(`Autor: ${author}`, margin + 4, y + 11);

          pdf.setTextColor(15, 23, 42);
          pdf.text(messageLines, margin + 4, y + 17);

          y += boxHeight + 5;
        });
      }

      const filename = `historico_${String(machine).replace(/\s+/g, '_')}_${String(date).replaceAll('/', '-')}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Erro ao exportar PDF: ' + (error.message || error));
    }
  };
})();
