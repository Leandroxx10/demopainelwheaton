// ================= GRÁFICOS DE HISTÓRICO =================
// WMoldes - versão profissional segura
// Corrige definitivamente "Canvas is already in use" destruindo qualquer instância do Chart.js antes de recriar.

(function () {
  'use strict';

  let historyChartInstance = null;
  let currentData = [];
  let displayedData = [];
  let currentMachine = '';
  let currentDate = '';
  let chartType = 'line';
  let isLoadingHistory = false;
  let historyListenerRef = null;
  let historyListenerHandlers = [];
  let knownHistoryEntries = {};

  const CORES = {
    molde: '#2563eb',
    blank: '#4b5563',
    neckring: '#b45309',
    funil: '#6b7280'
  };

  const datasetVisibility = {
    molde: true,
    blank: true,
    neckring: false,
    funil: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function parseBRDate(dataBR) {
    const [dia, mes, ano] = String(dataBR || '').split('/').map(Number);
    if (!dia || !mes || !ano) return null;
    return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  }

  function formatBRDate(date) {
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function formatISODate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function getDateISOFromBR(dataBR) {
    const date = parseBRDate(dataBR);
    return date ? formatISODate(date) : '';
  }

  function addDays(dataBR, days) {
    const date = parseBRDate(dataBR);
    if (!date) return dataBR;
    date.setDate(date.getDate() + days);
    return formatBRDate(date);
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
    switch (period) {
      case 'shift1':
      case 'turno1':
        return { start: '06:00', end: '14:00', includeNextDate: false };
      case 'shift2':
      case 'turno2':
        return { start: '14:00', end: '22:00', includeNextDate: false };
      case 'shift3':
      case 'turno3':
        return { start: '22:00', end: '06:00', includeNextDate: true };
      case 'custom': {
        const startTime = $('customStartTime')?.value || '00:00';
        const endTime = $('customEndTime')?.value || '23:59';
        return { start: startTime, end: endTime, includeNextDate: toMinutes(startTime) > toMinutes(endTime) };
      }
      case '24h':
      default:
        return { start: '00:00', end: '23:59', includeNextDate: false };
    }
  }

  function recordDateBR(record) {
    if (record.data) return record.data;
    if (record.dataISO) {
      const [ano, mes, dia] = String(record.dataISO).split('-');
      if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
    }
    if (record.timestamp) return formatBRDate(new Date(record.timestamp));
    return '';
  }

  function normalizeRecord(key, record) {
    const date = new Date(record.timestamp || Date.now());
    const hora = Number.isFinite(record.horaNum) ? Number(record.horaNum) : date.getHours();
    const minuto = Number.isFinite(record.minutoNum) ? Number(record.minutoNum) : date.getMinutes();

    return {
      id: key,
      timestamp: Number(record.timestamp || 0),
      data: recordDateBR(record),
      dataISO: record.dataISO || getDateISOFromBR(recordDateBR(record)),
      hora: record.hora || `${pad2(hora)}:${pad2(minuto)}`,
      horaNum: hora,
      minutoNum: minuto,
      molde: record.molde !== undefined ? Number(record.molde || 0) : Number(record.new_molde || 0),
      blank: record.blank !== undefined ? Number(record.blank || 0) : Number(record.new_blank || 0),
      neck_ring: record.neck_ring !== undefined ? Number(record.neck_ring || 0) : Number(record.new_neckring || 0),
      funil: record.funil !== undefined ? Number(record.funil || 0) : Number(record.new_funil || 0),
      tipo: record.tipo || 'hourly'
    };
  }

  function getChronologicalOrder(record, period = getActivePeriod()) {
    const minutes = (Number(record.horaNum) || 0) * 60 + (Number(record.minutoNum) || 0);
    const range = getPeriodRange(period);
    const startMinutes = toMinutes(range.start);
    const endMinutes = toMinutes(range.end);
    const recordDate = record.data || record.dataISO || '';
    const nextBR = addDays(currentDate, 1);
    const nextISO = getDateISOFromBR(nextBR);

    if (startMinutes > endMinutes) {
      if (recordDate === nextBR || recordDate === nextISO) return 1440 + minutes;
      return minutes;
    }

    return minutes;
  }

  function sortHistoryRecords(records, period = getActivePeriod()) {
    return [...(records || [])].sort((a, b) => {
      const ao = getChronologicalOrder(a, period);
      const bo = getChronologicalOrder(b, period);
      if (ao !== bo) return ao - bo;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }

  function buildRecordSignature(record) {
    return [
      record.timestamp || 0,
      record.data || '',
      record.hora || '',
      record.horaNum || 0,
      record.minutoNum || 0,
      record.molde || 0,
      record.blank || 0,
      record.neck_ring || 0,
      record.funil || 0,
      record.tipo || ''
    ].join('|');
  }

  function filtrarPorPeriodo(dados, period) {
    const range = getPeriodRange(period);

    if (period === '24h') {
      return dados.filter(item => item.data === currentDate || item.dataISO === getDateISOFromBR(currentDate));
    }

    const startMinutes = toMinutes(range.start);
    const endMinutes = toMinutes(range.end);
    const currentISO = getDateISOFromBR(currentDate);
    const nextDate = addDays(currentDate, 1);
    const nextISO = getDateISOFromBR(nextDate);

    return dados.filter(item => {
      const itemMinutes = (item.horaNum || 0) * 60 + (item.minutoNum || 0);
      const isCurrentDate = item.data === currentDate || item.dataISO === currentISO;
      const isNextDate = item.data === nextDate || item.dataISO === nextISO;

      if (startMinutes <= endMinutes) {
        return isCurrentDate && itemMinutes >= startMinutes && itemMinutes <= endMinutes;
      }

      return (isCurrentDate && itemMinutes >= startMinutes) || (isNextDate && itemMinutes <= endMinutes);
    });
  }

  function destroyChart(canvas) {
    try {
      if (historyChartInstance && typeof historyChartInstance.destroy === 'function') {
        historyChartInstance.destroy();
      }
    } catch (err) {
      console.warn('Erro ao destruir gráfico local:', err);
    }

    try {
      if (window.Chart && canvas) {
        const existing = Chart.getChart(canvas);
        if (existing && typeof existing.destroy === 'function') {
          existing.destroy();
        }
      }
    } catch (err) {
      console.warn('Erro ao destruir gráfico do canvas:', err);
    }

    try {
      if (window.historyChart && typeof window.historyChart.destroy === 'function') {
        window.historyChart.destroy();
      }
    } catch (err) {
      console.warn('Erro ao destruir window.historyChart:', err);
    }

    historyChartInstance = null;
    window.historyChart = null;
  }

  function preencherSelectData() {
    const select = $('historyDate');
    if (!select) return;

    select.innerHTML = '';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - i);

      const dataBR = formatBRDate(data);
      const option = document.createElement('option');

      option.value = dataBR;
      option.textContent = dataBR + (i === 0 ? ' (Hoje)' : '');
      select.appendChild(option);
    }

    currentDate = select.value || formatBRDate(hoje);
  }

  function preencherSelectMaquina() {
    const select = $('historyMachineSelect');
    if (!select) return;

    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione uma máquina';
    select.appendChild(placeholder);

    let maquinas = [];

    if (window.allAdminMachines) maquinas = Object.keys(window.allAdminMachines).sort();
    else if (window.allMachinesData) maquinas = Object.keys(window.allMachinesData).sort();

    maquinas.forEach(maquina => {
      const option = document.createElement('option');
      option.value = maquina;
      option.textContent = `Máquina ${maquina}`;
      select.appendChild(option);
    });
  }

  async function getHistoryFromFirebase(machineId, dataBR, period) {
    if (!machineId) return [];

    if (typeof historicoRef === 'undefined' || !historicoRef) {
      console.error('historicoRef não está definido');
      return [];
    }

    const range = getPeriodRange(period);
    const acceptedBRDates = new Set([dataBR]);
    const acceptedISODates = new Set([getDateISOFromBR(dataBR)]);

    if (range.includeNextDate) {
      const nextBR = addDays(dataBR, 1);
      acceptedBRDates.add(nextBR);
      acceptedISODates.add(getDateISOFromBR(nextBR));
    }

    try {
      const snapshot = await historicoRef.child(machineId).once('value');
      const records = snapshot.val() || {};
      const resultados = [];

      Object.keys(records).forEach(key => {
        const normalized = normalizeRecord(key, records[key] || {});
        if (acceptedBRDates.has(normalized.data) || acceptedISODates.has(normalized.dataISO)) {
          resultados.push(normalized);
        }
      });

      return sortHistoryRecords(resultados, period);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return [];
    }
  }

  function ajustarLarguraGrafico(pointCount) {
    const inner = document.querySelector('.chart-inner');
    const scroll = document.querySelector('.chart-scroll');
    if (!inner) return;

    const calculatedWidth = Math.max(1100, pointCount * (chartType === 'bar' ? 80 : 95));
    inner.style.minWidth = `${calculatedWidth}px`;
    inner.style.width = `${calculatedWidth}px`;

    if (scroll) scroll.scrollLeft = 0;
  }

  function criarGrafico(dados) {
    esconderEmptyStateGrafico();

    const canvas = $('historyChart');
    if (!canvas || !window.Chart) return;

    destroyChart(canvas);

    const ctx = canvas.getContext('2d');

    const pontos = sortHistoryRecords(dados).map(item => ({
      label: item.data && item.data !== currentDate ? `${item.hora} (${item.data.slice(0, 5)})` : item.hora,
      timestamp: item.timestamp || 0,
      horaNum: item.horaNum,
      minutoNum: item.minutoNum,
      molde: item.molde || 0,
      blank: item.blank || 0,
      neckring: item.neck_ring || 0,
      funil: item.funil || 0
    }));

    ajustarLarguraGrafico(pontos.length);

    const datasets = [];

    const addDataset = (key, label, field) => {
      if (!datasetVisibility[key]) return;

      datasets.push({
        label,
        data: pontos.map(p => p[field]),
        borderColor: CORES[key],
        backgroundColor: chartType === 'bar' ? `${CORES[key]}80` : 'transparent',
        borderWidth: 2,
        pointRadius: chartType === 'line' ? 3 : 0,
        tension: 0.12
      });
    };

    addDataset('molde', 'Moldes', 'molde');
    addDataset('blank', 'Blanks', 'blank');
    addDataset('neckring', 'Neck Rings', 'neckring');
    addDataset('funil', 'Funís', 'funil');

    historyChartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels: pontos.map(p => p.label),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: {
            top: 76
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: datasets.length > 0,
            position: 'top',
            labels: {
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          },
          title: {
            display: datasets.length === 0,
            text: 'Selecione Moldes, Blanks, Neck Rings ou Funís para visualizar'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          },
          x: {
            ticks: {
              autoSkip: false,
              maxRotation: 0
            }
          }
        }
      }
    });

    window.historyChart = historyChartInstance;

    setTimeout(() => {
      if (window.WMoldesHistoryNotes && typeof window.WMoldesHistoryNotes.refresh === 'function') {
        window.WMoldesHistoryNotes.refresh();
      }
    }, 100);
  }

  function criarGraficoVazio() {
    const canvas = $('historyChart');
    if (!canvas || !window.Chart) return;

    destroyChart(canvas);
    ajustarLarguraGrafico(0);

    const ctx = canvas.getContext('2d');

    historyChartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: {
            top: 76
          }
        },
        plugins: {
          legend: { display: false },
          title: { display: false }
        },
        scales: {
          y: { display: false },
          x: { display: false }
        }
      }
    });

    window.historyChart = historyChartInstance;

    setTimeout(() => {
      if (window.WMoldesHistoryNotes && typeof window.WMoldesHistoryNotes.refresh === 'function') {
        window.WMoldesHistoryNotes.refresh();
      }
    }, 100);
  }

  function atualizarTabela(dados) {
    const tbody = $('historyTableBody');
    if (!tbody) return;

    if (!dados.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">Nenhum registro encontrado</td></tr>';
      return;
    }

    const ordenados = sortHistoryRecords(dados);

    tbody.innerHTML = ordenados.map(item => {
      const tipoIcon = item.tipo === 'real_time' ? '⚡' : '⏰';
      const hora = item.data && item.data !== currentDate ? `${item.hora} (${item.data.slice(0, 5)})` : item.hora;

      return `
        <tr>
          <td>${hora} ${tipoIcon}</td>
          <td>${item.molde || 0}</td>
          <td>${item.blank || 0}</td>
          <td>${item.neck_ring || 0}</td>
          <td>${item.funil || 0}</td>
        </tr>
      `;
    }).join('');
  }

  function atualizarInsights(dados) {
    const container = $('chartInsights');
    if (!container) return;

    if (!dados.length) {
      container.innerHTML = '';
      return;
    }

    const totals = dados.reduce((acc, item) => {
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
      <div class="insight-card"><span>Registros</span><strong>${dados.length}</strong></div>
    `;
  }

  function setupRealtimeHistoryListener(machineId, dataBR) {
    if (typeof historicoRef === 'undefined' || !historicoRef) return;

    if (historyListenerRef && historyListenerHandlers.length) {
      historyListenerHandlers.forEach(handler => {
        try {
          historyListenerRef.off('child_added', handler);
          historyListenerRef.off('child_changed', handler);
        } catch (err) {
          console.warn('Erro ao remover listeners antigos:', err);
        }
      });
    }

    const handler = function (snapshot) {
      const normalizedRecord = normalizeRecord(snapshot.key, snapshot.val() || {});
      const period = getActivePeriod();
      const range = getPeriodRange(period);
      const acceptedDates = new Set([dataBR, getDateISOFromBR(dataBR)]);

      if (range.includeNextDate) {
        const next = addDays(dataBR, 1);
        acceptedDates.add(next);
        acceptedDates.add(getDateISOFromBR(next));
      }

      if (acceptedDates.has(normalizedRecord.data) || acceptedDates.has(normalizedRecord.dataISO)) {
        const newSignature = buildRecordSignature(normalizedRecord);
        const oldSignature = knownHistoryEntries[normalizedRecord.id];

        if (!oldSignature || oldSignature !== newSignature) {
          knownHistoryEntries[normalizedRecord.id] = newSignature;

          setTimeout(() => {
            if ($('historyMachineSelect')?.value === machineId && $('historyDate')?.value === dataBR) {
              carregarDados();
            }
          }, 250);
        }
      }
    };

    const ref = historicoRef.child(machineId);
    ref.on('child_added', handler);
    ref.on('child_changed', handler);

    historyListenerRef = ref;
    historyListenerHandlers = [handler];
  }

  async function carregarDados() {
    if (isLoadingHistory) return;

    const machine = $('historyMachineSelect')?.value || '';
    const data = $('historyDate')?.value || '';

    if (!machine) {
      showAlertSafe('erro', 'Selecione uma máquina');
      return;
    }

    if (!data) {
      showAlertSafe('erro', 'Selecione uma data');
      return;
    }

    currentMachine = machine;
    currentDate = data;

    const period = getActivePeriod();

    isLoadingHistory = true;
    mostrarLoading();

    try {
      const dados = await getHistoryFromFirebase(machine, data, period);

      currentData = dados;
      knownHistoryEntries = {};

      dados.forEach(item => {
        knownHistoryEntries[item.id] = buildRecordSignature(item);
      });

      displayedData = sortHistoryRecords(filtrarPorPeriodo(dados, period), period);

      if (displayedData.length === 0) {
        mostrarEmptyStateGrafico(machine, data, period);
        criarGraficoVazio();
        atualizarTabela([]);
        atualizarInsights([]);
      } else {
        esconderEmptyStateGrafico();
        criarGrafico(displayedData);
        atualizarTabela(displayedData);
        atualizarInsights(displayedData);
      }

      setupRealtimeHistoryListener(machine, data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showAlertSafe('erro', 'Erro ao carregar dados: ' + (error.message || error));
    } finally {
      esconderLoading();
      isLoadingHistory = false;
    }
  }

  function injectShiftButtons() {
    const periodContainer = document.querySelector('.period-selector, .period-options, .period-buttons');
    if (!periodContainer || document.querySelector('[data-period="shift1"]')) return;

    const custom = periodContainer.querySelector('[data-period="custom"]');

    const buttons = [
      { period: 'shift1', label: 'Turno 1<br><small>06:00 - 14:00</small>' },
      { period: 'shift2', label: 'Turno 2<br><small>14:00 - 22:00</small>' },
      { period: 'shift3', label: 'Turno 3<br><small>22:00 - 06:00</small>' }
    ];

    buttons.forEach(cfg => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'period-btn period-option';
      button.setAttribute('data-period', cfg.period);
      button.innerHTML = cfg.label;

      if (custom) periodContainer.insertBefore(button, custom);
      else periodContainer.appendChild(button);
    });
  }

  function configurarPeriodButtons() {
    injectShiftButtons();

    document.querySelectorAll('.period-btn, .period-option').forEach(btn => {
      const novo = btn.cloneNode(true);
      btn.parentNode.replaceChild(novo, btn);

      if (!novo.getAttribute('data-period') && /24/.test(novo.textContent || '')) {
        novo.setAttribute('data-period', '24h');
      }

      novo.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelectorAll('.period-btn, .period-option').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const periodo = this.getAttribute('data-period') || '24h';
        const customContainer = $('customTimeContainer');

        if (customContainer) {
          customContainer.style.display = periodo === 'custom' ? 'block' : 'none';
        }

        if (currentMachine && currentDate) carregarDados();
      });
    });
  }

  function configurarToggleButtons() {
    const config = [
      ['toggleMolde', 'molde'],
      ['toggleBlank', 'blank'],
      ['toggleNeckring', 'neckring'],
      ['toggleFunil', 'funil']
    ];

    config.forEach(([id, key]) => {
      const btn = $(id);
      if (!btn) return;

      const novo = btn.cloneNode(true);
      btn.parentNode.replaceChild(novo, btn);

      novo.classList.toggle('active', datasetVisibility[key]);
      novo.setAttribute('aria-pressed', datasetVisibility[key] ? 'true' : 'false');

      novo.addEventListener('click', function (e) {
        e.preventDefault();

        datasetVisibility[key] = !datasetVisibility[key];

        this.classList.toggle('active', datasetVisibility[key]);
        this.setAttribute('aria-pressed', datasetVisibility[key] ? 'true' : 'false');

        criarGrafico(displayedData.length ? displayedData : currentData);
      });
    });
  }

  function configurarEventos() {
    const machineSelect = $('historyMachineSelect');
    if (machineSelect && !machineSelect.__historyBound) {
      machineSelect.__historyBound = true;
      machineSelect.addEventListener('change', function () {
        currentMachine = this.value;

        const triggerButton = document.querySelector('.machine-select-button');
        const buttonText = triggerButton?.querySelector('.selected-machine-text');

        if (buttonText) {
          buttonText.textContent = this.value ? `Máquina ${this.value}` : 'Selecionar máquina';
        }

        if (this.value && currentDate) carregarDados();
      });
    }

    const dateSelect = $('historyDate');
    if (dateSelect && !dateSelect.__historyBound) {
      dateSelect.__historyBound = true;
      dateSelect.addEventListener('change', function () {
        currentDate = this.value;
        const machine = $('historyMachineSelect')?.value;
        if (machine) carregarDados();
      });
    }

    const customStart = $('customStartTime');
    if (customStart && !customStart.__historyBound) {
      customStart.__historyBound = true;
      customStart.addEventListener('change', () => {
        if (currentMachine && currentDate) carregarDados();
      });
    }

    const customEnd = $('customEndTime');
    if (customEnd && !customEnd.__historyBound) {
      customEnd.__historyBound = true;
      customEnd.addEventListener('change', () => {
        if (currentMachine && currentDate) carregarDados();
      });
    }

    document.querySelectorAll('.btn-generate, #toggleChartBtn').forEach(btn => {
      const wrapper = btn.closest('.history-action, .action-button-wrapper, .chart-action') || btn;
      wrapper.style.display = 'none';
      wrapper.setAttribute('aria-hidden', 'true');
    });
  }

  function getChartWrapper() {
    const canvas = $('historyChart');
    if (!canvas) return null;

    const inner = canvas.closest('.chart-inner') || canvas.parentElement;

    if (inner && getComputedStyle(inner).position === 'static') {
      inner.style.position = 'relative';
    }

    return inner;
  }

  function getPeriodoLabel(period) {
    const labels = {
      '24h': '24 horas',
      'day': '24 horas',
      'shift1': 'Turno 1 - 06:00 às 14:00',
      'turno1': 'Turno 1 - 06:00 às 14:00',
      'shift2': 'Turno 2 - 14:00 às 22:00',
      'turno2': 'Turno 2 - 14:00 às 22:00',
      'shift3': 'Turno 3 - 22:00 às 06:00',
      'turno3': 'Turno 3 - 22:00 às 06:00',
      'custom': 'Período personalizado'
    };

    return labels[period] || 'Período selecionado';
  }

  function mostrarEmptyStateGrafico(machine, data, period) {
    const wrapper = getChartWrapper();
    if (!wrapper) return;

    esconderEmptyStateGrafico();

    const state = document.createElement('div');
    state.id = 'historyChartEmptyState';
    state.className = 'history-chart-empty-state';
    state.innerHTML = `
      <div style="text-align:center;padding:30px;color:#64748b;">
        <strong>Nenhum dado encontrado para este período</strong><br>
        Máquina ${machine || '-'} · ${data || '-'} · ${getPeriodoLabel(period)}
      </div>
    `;

    wrapper.appendChild(state);
  }

  function esconderEmptyStateGrafico() {
    const state = $('historyChartEmptyState');
    if (state) state.remove();
  }

  function mostrarLoading() {
    const container = document.querySelector('.chart-container');
    if (container) container.style.opacity = '0.6';
  }

  function esconderLoading() {
    const container = document.querySelector('.chart-container');
    if (container) container.style.opacity = '1';
  }

  function showAlertSafe(type, message) {
    if (typeof window.showAlert === 'function') window.showAlert(type, message);
    else console.log(`${type}: ${message}`);
  }

  function toggleChartType() {
    chartType = chartType === 'line' ? 'bar' : 'line';
    criarGrafico(displayedData.length ? displayedData : currentData);
  }

  async function exportHistoryPdf() {
    showAlertSafe('info', 'Exportação em PDF mantida pelo módulo original do painel.');
  }

  function initHistorySection() {
    preencherSelectData();
    preencherSelectMaquina();
    configurarPeriodButtons();
    configurarEventos();
    configurarToggleButtons();
    criarGraficoVazio();
  }

  window.initHistorySection = initHistorySection;
  window.loadHistoryChart = carregarDados;
  window.toggleChartType = toggleChartType;
  window.exportHistoryPdf = exportHistoryPdf;
  window.WMoldesHistoryDebug = {
    destroyChart,
    get chart() { return historyChartInstance; },
    reload: carregarDados
  };
})();
