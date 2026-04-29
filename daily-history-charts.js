
// ================= GRÁFICOS DE HISTÓRICO DIÁRIO =================
// Visualização focada em 24 horas com scroll horizontal

// Verificar se já foi carregado
if (typeof window.DAILY_HISTORY_CHARTS_LOADED === 'undefined') {
    
    window.DAILY_HISTORY_CHARTS_LOADED = true;
    
    let dailyChart = null;
    let currentDailyData = [];
    let currentDailyMachine = '';
    let currentDailyDate = '';
    let activeDatasets = {
        molde: true,
        blank: true,
        neckring: true,
        funil: true
    };

    // Cores sólidas com gradiente
    const DAILY_CHART_STYLES = {
        molde: {
            background: 'rgba(59, 130, 246, 0.8)',
            border: '#1d4ed8',
            gradient: 'linear-gradient(180deg, #3b82f6, #1d4ed8)'
        },
        blank: {
            background: 'rgba(107, 114, 128, 0.8)',
            border: '#374151',
            gradient: 'linear-gradient(180deg, #6b7280, #374151)'
        },
        neckring: {
            background: 'rgba(245, 158, 11, 0.8)',
            border: '#b45309',
            gradient: 'linear-gradient(180deg, #f59e0b, #b45309)'
        },
        funil: {
            background: 'rgba(148, 163, 184, 0.8)',
            border: '#475569',
            gradient: 'linear-gradient(180deg, #94a3b8, #475569)'
        }
    };

    // ================= INICIALIZAR =================
    function initDailyHistorySection() {
        console.log("📊 Inicializando seção de histórico diário...");
        
        // Configurar data padrão (hoje em São Paulo)
        setDefaultDailyDate();
        
        // Preencher dropdown de máquinas
        populateDailyMachineDropdown();
        
        // Carregar último registro
        loadLastDailyRecord();
        
        console.log("✅ Seção de histórico diário inicializada");
    }

    // ================= OBTER DATA DE SÃO PAULO =================
    function getSaoPauloDate() {
        const now = new Date();
        // São Paulo é UTC-3 (menos 3 horas do UTC)
        const saoPauloTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
        return saoPauloTime;
    }

    // ================= DEFINIR DATA PADRÃO =================
    function setDefaultDailyDate() {
        const saoPauloDate = getSaoPauloDate();
        const dateStr = saoPauloDate.toISOString().split('T')[0];
        
        const dateInput = document.getElementById('historyDate');
        if (dateInput) {
            dateInput.value = dateStr;
            dateInput.max = dateStr; // Não permitir datas futuras
        }
        
        // Configurar horários padrão
        const startTime = document.getElementById('customStartTime');
        const endTime = document.getElementById('customEndTime');
        if (startTime) startTime.value = '00:00';
        if (endTime) endTime.value = '23:59';
        
        updateSelectedInfo('Nenhum período selecionado');
    }

    // ================= PREENCHER DROPDOWN =================
    function populateDailyMachineDropdown() {
        const select = document.getElementById('historyMachineSelect');
        if (!select) return;
        
        let machines = [];
        
        if (typeof allAdminMachines !== 'undefined' && allAdminMachines) {
            machines = Object.keys(allAdminMachines).sort();
        } else if (typeof allMachinesData !== 'undefined' && allMachinesData) {
            machines = Object.keys(allMachinesData).sort();
        }
        
        select.innerHTML = '<option value="">Selecione a máquina</option>';
        
        machines.forEach(machineId => {
            const option = document.createElement('option');
            option.value = machineId;
            option.textContent = `Máquina ${machineId}`;
            select.appendChild(option);
        });
        
        console.log(`✅ Dropdown preenchido com ${machines.length} máquinas`);
    }

    // ================= CARREGAR ÚLTIMO REGISTRO =================
    function loadLastDailyRecord() {
        if (typeof adminConfigRef === 'undefined') {
            console.warn("⚠️ adminConfigRef não disponível");
            return;
        }
        
        adminConfigRef.child("autoHistory").child("lastRecord").once("value", (snapshot) => {
            const data = snapshot.val();
            const lastRecordEl = document.getElementById('lastHistoryRecord');
            
            if (lastRecordEl && data) {
                const date = new Date(data.timestamp);
                const saoPauloTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
                
                lastRecordEl.textContent = `${saoPauloTime.toLocaleDateString('pt-BR')} ${saoPauloTime.toLocaleTimeString('pt-BR')}`;
            } else if (lastRecordEl) {
                lastRecordEl.textContent = 'Sem registros';
            }
        }, (error) => {
            console.error("❌ Erro ao carregar último registro:", error);
        });
    }

    // ================= GERENCIAR PERÍODOS =================
    function setPeriod(startTime, endTime) {
        document.getElementById('customStartTime').value = startTime;
        document.getElementById('customEndTime').value = endTime;
        
        // Atualizar botões
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
        
        // Esconder controles personalizados
        document.getElementById('customTimeControls').style.display = 'none';
        
        // Atualizar info
        updateSelectedInfo(`Período: ${startTime} - ${endTime}`);
    }

    function enableCustomPeriod() {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById('customPeriodBtn').classList.add('active');
        document.getElementById('customTimeControls').style.display = 'flex';
        updateSelectedInfo('Período personalizado');
    }

    function applyCustomPeriod() {
        const startTime = document.getElementById('customStartTime').value;
        const endTime = document.getElementById('customEndTime').value;
        
        if (startTime && endTime) {
            updateSelectedInfo(`Personalizado: ${startTime} - ${endTime}`);
        }
    }

    function updateSelectedInfo(text) {
        const infoEl = document.getElementById('selectedInfo');
        if (infoEl) {
            infoEl.innerHTML = `<i class="fas fa-info-circle"></i> <span>${text}</span>`;
        }
    }

   // ================= FUNÇÃO PARA CARREGAR GRÁFICO =================
async function loadDailyHistoryChart() {
    const machineId = document.getElementById('historyMachineSelect').value;
    const dataSelecionada = document.getElementById('historyDate').value;
    
    if (!machineId || !dataSelecionada) {
        alert('Selecione máquina e data');
        return;
    }
    
    currentDailyMachine = machineId;
    currentDailyDate = dataSelecionada;
    
    showDailyChartLoading();
    
    try {
        // Buscar dados usando a data ISO (YYYY-MM-DD)
        const dados = await window.getMachineHistoryByDate(machineId, dataSelecionada);
        
        if (dados.length === 0) {
            alert('Nenhum dado para esta data');
            hideDailyChartLoading();
            return;
        }
        
        currentDailyData = dados;
        
        // Filtrar por horário
        const inicio = document.getElementById('customStartTime').value;
        const fim = document.getElementById('customEndTime').value;
        
        let dadosFiltrados = dados;
        if (inicio !== '00:00' || fim !== '23:59') {
            dadosFiltrados = dados.filter(item => {
                const horaMinuto = item.hora * 60 + item.minuto;
                const inicioMin = parseInt(inicio.split(':')[0]) * 60 + parseInt(inicio.split(':')[1]);
                const fimMin = parseInt(fim.split(':')[0]) * 60 + parseInt(fim.split(':')[1]);
                
                if (inicioMin <= fimMin) {
                    return horaMinuto >= inicioMin && horaMinuto <= fimMin;
                } else {
                    return horaMinuto >= inicioMin || horaMinuto <= fimMin;
                }
            });
        }
        
        criarGrafico(dadosFiltrados);
        atualizarTabela(dadosFiltrados);
        
    } catch (error) {
        console.error("Erro:", error);
        alert('Erro ao carregar dados');
    } finally {
        hideDailyChartLoading();
    }
}

// ================= CRIAR GRÁFICO =================
function criarGrafico(dados) {
    const ctx = document.getElementById('dailyHistoryChart').getContext('2d');
    
    if (window.dailyChart) {
        window.dailyChart.destroy();
    }
    
    // Preparar labels (horas)
    const labels = [];
    const moldeData = [];
    const blankData = [];
    const neckringData = [];
    const funilData = [];
    
    // Agrupar por hora
    const porHora = {};
    for (let h = 0; h < 24; h++) {
        porHora[h] = { molde: 0, blank: 0, neckring: 0, funil: 0, count: 0 };
    }
    
    dados.forEach(item => {
        const h = item.hora;
        porHora[h].molde += item.molde || 0;
        porHora[h].blank += item.blank || 0;
        porHora[h].neckring += item.neck_ring || 0;
        porHora[h].funil += item.funil || 0;
        porHora[h].count++;
    });
    
    for (let h = 0; h < 24; h++) {
        labels.push(`${h.toString().padStart(2, '0')}:00`);
        
        if (porHora[h].count > 0) {
            moldeData.push(Math.round(porHora[h].molde / porHora[h].count));
            blankData.push(Math.round(porHora[h].blank / porHora[h].count));
            neckringData.push(Math.round(porHora[h].neckring / porHora[h].count));
            funilData.push(Math.round(porHora[h].funil / porHora[h].count));
        } else {
            moldeData.push(null);
            blankData.push(null);
            neckringData.push(null);
            funilData.push(null);
        }
    }
    
    window.dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Moldes',
                    data: moldeData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    tension: 0.1
                },
                {
                    label: 'Blanks',
                    data: blankData,
                    borderColor: '#6b7280',
                    backgroundColor: 'rgba(107, 114, 128, 0.1)',
                    borderWidth: 3,
                    tension: 0.1
                },
                {
                    label: 'Neck Rings',
                    data: neckringData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 3,
                    tension: 0.1
                },
                {
                    label: 'Funís',
                    data: funilData,
                    borderColor: '#94a3b8',
                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                    borderWidth: 3,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Horário' } },
                y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } }
            }
        }
    });
}

// ================= ATUALIZAR TABELA =================
function atualizarTabela(dados) {
    const tbody = document.getElementById('dailyTableBody');
    if (!tbody) return;
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center">Sem dados</td></tr>';
        return;
    }
    
    let html = '';
    dados.forEach(item => {
        const horaStr = `${item.hora.toString().padStart(2, '0')}:${item.minuto.toString().padStart(2, '0')}`;
        const tipo = item.tipo === 'manual' ? '👤' : 
                    item.tipo === 'inicio' ? '🚀' : '⏰';
        
        html += `
            <tr>
                <td>${horaStr}</td>
                <td style="background: #3b82f6; color: white;">${item.molde}</td>
                <td style="background: #6b7280; color: white;">${item.blank}</td>
                <td style="background: #f59e0b; color: white;">${item.neck_ring}</td>
                <td style="background: #94a3b8; color: white;">${item.funil}</td>
                <td>${tipo}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

    // ================= FILTRAR POR HORÁRIO USANDO HORAS DO REGISTRO =================
function filterDataByTimeRange(data, startTime, endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    return data.filter(item => {
        // Usar os campos hour e minute que salvamos
        const hour = item.hour;
        const minute = item.minute;
        
        const itemMinutes = hour * 60 + minute;
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (startMinutes <= endMinutes) {
            return itemMinutes >= startMinutes && itemMinutes <= endMinutes;
        } else {
            // Período que cruza meia-noite
            return itemMinutes >= startMinutes || itemMinutes <= endMinutes;
        }
    });
}

    // ================= CRIAR GRÁFICO DIÁRIO =================
    function createDailyChart(data, machineId, date) {
        const canvas = document.getElementById('dailyHistoryChart');
        if (!canvas) {
            console.error("❌ Canvas dailyHistoryChart não encontrado");
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const chartTypeSelect = document.getElementById('chartTypeSelect');
        const chartType = chartTypeSelect ? chartTypeSelect.value : 'line';
        
        // Destruir gráfico anterior
        if (dailyChart) {
            dailyChart.destroy();
        }
        
        // Preparar labels (24 horas do dia)
        const allHours = [];
        for (let hour = 0; hour < 24; hour++) {
            allHours.push(`${hour.toString().padStart(2, '0')}:00`);
        }
        
        // Criar mapa de dados por hora
        const dataByHour = {};
        data.forEach(item => {
            const date = new Date(item.timestamp);
            const saoPauloTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
            const hour = saoPauloTime.getHours();
            
            if (!dataByHour[hour]) {
                dataByHour[hour] = {
                    molde: 0,
                    blank: 0,
                    neck_ring: 0,
                    funil: 0,
                    count: 0
                };
            }
            
            // Acumular valores
            dataByHour[hour].molde += item.molde || 0;
            dataByHour[hour].blank += item.blank || 0;
            dataByHour[hour].neck_ring += item.neck_ring || 0;
            dataByHour[hour].funil += item.funil || 0;
            dataByHour[hour].count++;
        });
        
        // Calcular médias e preencher horas sem dados
        const moldeData = [];
        const blankData = [];
        const neckringData = [];
        const funilData = [];
        
        for (let hour = 0; hour < 24; hour++) {
            if (dataByHour[hour] && dataByHour[hour].count > 0) {
                const avg = dataByHour[hour];
                moldeData.push(Math.round(avg.molde / avg.count));
                blankData.push(Math.round(avg.blank / avg.count));
                neckringData.push(Math.round(avg.neck_ring / avg.count));
                funilData.push(Math.round(avg.funil / avg.count));
            } else {
                moldeData.push(null);
                blankData.push(null);
                neckringData.push(null);
                funilData.push(null);
            }
        }
        
        // Criar datasets baseado nos ativos
        const datasets = [];
        
        if (activeDatasets.molde) {
            datasets.push({
                label: 'Moldes',
                data: moldeData,
                borderColor: DAILY_CHART_STYLES.molde.border,
                backgroundColor: DAILY_CHART_STYLES.molde.background,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointBackgroundColor: DAILY_CHART_STYLES.molde.border,
                tension: 0.1,
                fill: chartType === 'line' ? false : true,
                spanGaps: true
            });
        }
        
        if (activeDatasets.blank) {
            datasets.push({
                label: 'Blanks',
                data: blankData,
                borderColor: DAILY_CHART_STYLES.blank.border,
                backgroundColor: DAILY_CHART_STYLES.blank.background,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointBackgroundColor: DAILY_CHART_STYLES.blank.border,
                tension: 0.1,
                fill: chartType === 'line' ? false : true,
                spanGaps: true
            });
        }
        
        if (activeDatasets.neckring) {
            datasets.push({
                label: 'Neck Rings',
                data: neckringData,
                borderColor: DAILY_CHART_STYLES.neckring.border,
                backgroundColor: DAILY_CHART_STYLES.neckring.background,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointBackgroundColor: DAILY_CHART_STYLES.neckring.border,
                tension: 0.1,
                fill: chartType === 'line' ? false : true,
                spanGaps: true
            });
        }
        
        if (activeDatasets.funil) {
            datasets.push({
                label: 'Funís',
                data: funilData,
                borderColor: DAILY_CHART_STYLES.funil.border,
                backgroundColor: DAILY_CHART_STYLES.funil.background,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointBackgroundColor: DAILY_CHART_STYLES.funil.border,
                tension: 0.1,
                fill: chartType === 'line' ? false : true,
                spanGaps: true
            });
        }
        
        // Configurar gráfico
        const chartConfig = {
            type: chartType,
            data: {
                labels: allHours,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw || 0}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Horário (São Paulo)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        title: {
                            display: true,
                            text: 'Quantidade',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                return Number.isInteger(value) ? value : null;
                            }
                        }
                    }
                }
            }
        };
        
        // Criar gráfico
        try {
            dailyChart = new Chart(ctx, chartConfig);
            console.log("✅ Gráfico diário criado com sucesso");
        } catch (error) {
            console.error("❌ Erro ao criar gráfico:", error);
        }
        
        // Ajustar scroll para mostrar período selecionado
        setTimeout(() => {
            adjustScrollToPeriod();
        }, 100);
    }

    // ================= AJUSTAR SCROLL =================
    function adjustScrollToPeriod() {
        const startTime = document.getElementById('customStartTime') ? document.getElementById('customStartTime').value : '00:00';
        const [startHour] = startTime.split(':').map(Number);
        
        const container = document.querySelector('.chart-scroll-container');
        if (!container) return;
        
        // Cada hora tem aproximadamente 80px no gráfico
        const scrollPosition = startHour * 80;
        container.scrollLeft = scrollPosition;
    }

    // ================= ATUALIZAR LEGENDA =================
    function updateDailyLegend(data) {
        const legendEl = document.getElementById('chartLegend');
        if (!legendEl) return;
        
        // Calcular totais
        let totalMolde = 0, totalBlank = 0, totalNeckring = 0, totalFunil = 0;
        data.forEach(item => {
            totalMolde += item.molde || 0;
            totalBlank += item.blank || 0;
            totalNeckring += item.neck_ring || 0;
            totalFunil += item.funil || 0;
        });
        
        const html = `
            <div class="legend-item-modern ${!activeDatasets.molde ? 'hidden' : ''}" onclick="window.toggleDataset('molde')">
                <div class="legend-color" style="background: linear-gradient(180deg, #3b82f6, #1d4ed8);"></div>
                <span class="legend-label">Moldes</span>
                <span class="legend-value">${totalMolde}</span>
            </div>
            <div class="legend-item-modern ${!activeDatasets.blank ? 'hidden' : ''}" onclick="window.toggleDataset('blank')">
                <div class="legend-color" style="background: linear-gradient(180deg, #6b7280, #374151);"></div>
                <span class="legend-label">Blanks</span>
                <span class="legend-value">${totalBlank}</span>
            </div>
            <div class="legend-item-modern ${!activeDatasets.neckring ? 'hidden' : ''}" onclick="window.toggleDataset('neckring')">
                <div class="legend-color" style="background: linear-gradient(180deg, #f59e0b, #b45309);"></div>
                <span class="legend-label">Neck Rings</span>
                <span class="legend-value">${totalNeckring}</span>
            </div>
            <div class="legend-item-modern ${!activeDatasets.funil ? 'hidden' : ''}" onclick="window.toggleDataset('funil')">
                <div class="legend-color" style="background: linear-gradient(180deg, #94a3b8, #475569);"></div>
                <span class="legend-label">Funís</span>
                <span class="legend-value">${totalFunil}</span>
            </div>
        `;
        
        legendEl.innerHTML = html;
    }

    // ================= TOGGLE DATASET =================
    function toggleDataset(dataset) {
        activeDatasets[dataset] = !activeDatasets[dataset];
        
        // Recarregar gráfico com dados atuais
        if (currentDailyData.length > 0) {
            const startTime = document.getElementById('customStartTime') ? document.getElementById('customStartTime').value : '00:00';
            const endTime = document.getElementById('customEndTime') ? document.getElementById('customEndTime').value : '23:59';
            
            let filteredData = currentDailyData;
            if (startTime !== '00:00' || endTime !== '23:59') {
                filteredData = filterDataByTimeRange(currentDailyData, startTime, endTime);
            }
            
            createDailyChart(filteredData, currentDailyMachine, currentDailyDate);
            updateDailyLegend(filteredData);
        }
    }

    // ================= ATUALIZAR TABELA =================
function updateDailyTable(data) {
    const tbody = document.getElementById('dailyTableBody');
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="6">
                    <i class="fas fa-database"></i>
                    <p>Nenhum dado encontrado</p>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    // Ordenar por hora
    const sortedData = [...data].sort((a, b) => {
        if (a.hour !== b.hour) return a.hour - b.hour;
        return a.minute - b.minute;
    });
    
    sortedData.forEach(item => {
        const timeStr = `${item.hour.toString().padStart(2, '0')}:${item.minute.toString().padStart(2, '0')}`;
        
        const typeStr = item.recordType === 'intervalo_1h' ? '⏰ Automático' :
                       item.recordType === 'manual' ? '👤 Manual' :
                       item.recordType === 'inicializacao' ? '🚀 Inicial' : '📝 Registro';
        
        html += `
            <tr>
                <td><strong>${timeStr}</strong></td>
                <td style="background: linear-gradient(180deg, #3b82f6, #1d4ed8); color: white; font-weight: bold;">${item.molde || 0}</td>
                <td style="background: linear-gradient(180deg, #6b7280, #374151); color: white; font-weight: bold;">${item.blank || 0}</td>
                <td style="background: linear-gradient(180deg, #f59e0b, #b45309); color: white; font-weight: bold;">${item.neck_ring || 0}</td>
                <td style="background: linear-gradient(180deg, #94a3b8, #475569); color: white; font-weight: bold;">${item.funil || 0}</td>
                <td>${typeStr}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

    // ================= LIMPAR TABELA =================
    function clearDailyTable() {
        const tbody = document.getElementById('dailyTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">
                        <i class="fas fa-chart-line"></i>
                        <p>Selecione uma máquina e data</p>
                    </td>
                </tr>
            `;
        }
    }

    // ================= MOSTRAR HINT DE SCROLL =================
    function showScrollHint() {
        const hint = document.getElementById('scrollHint');
        if (hint) {
            hint.style.display = 'flex';
            setTimeout(() => {
                hint.style.opacity = '0.5';
            }, 5000);
        }
    }

    // ================= LOADING =================
    function showDailyChartLoading() {
        const canvas = document.getElementById('dailyHistoryChart');
        if (!canvas) return;
        
        canvas.style.opacity = '0.5';
        
        const oldLoading = document.getElementById('chartDailyLoading');
        if (oldLoading) oldLoading.remove();
        
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'chartDailyLoading';
        loadingDiv.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div class="spinner" style="width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 10px;"></div>
                <p style="color: var(--text);">Carregando dados diários...</p>
            </div>
        `;
        
        loadingDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.1);
            backdrop-filter: blur(3px);
            z-index: 1000;
            border-radius: 15px;
        `;
        
        const container = document.querySelector('.chart-wrapper');
        if (container) {
            container.style.position = 'relative';
            container.appendChild(loadingDiv);
        }
    }

    function hideDailyChartLoading() {
        const canvas = document.getElementById('dailyHistoryChart');
        if (canvas) {
            canvas.style.opacity = '1';
        }
        
        const loadingDiv = document.getElementById('chartDailyLoading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    // ================= EXPORTAR CSV =================
    function exportDailyData() {
        if (!currentDailyData || currentDailyData.length === 0) {
            showDailyNotification('erro', 'Não há dados para exportar');
            return;
        }
        
        const machineId = currentDailyMachine;
        const date = currentDailyDate;
        
        let csv = 'Horário (São Paulo),Moldes,Blanks,Neck Rings,Funís,Tipo\n';
        
        // Agrupar por hora
        const dataByHour = {};
        currentDailyData.forEach(item => {
            const date = new Date(item.timestamp);
            const saoPauloTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
            const hour = saoPauloTime.getHours();
            
            if (!dataByHour[hour]) {
                dataByHour[hour] = {
                    molde: 0,
                    blank: 0,
                    neckring: 0,
                    funil: 0,
                    count: 0,
                    type: item.recordType
                };
            }
            
            dataByHour[hour].molde += item.molde || 0;
            dataByHour[hour].blank += item.blank || 0;
            dataByHour[hour].neckring += item.neck_ring || 0;
            dataByHour[hour].funil += item.funil || 0;
            dataByHour[hour].count++;
        });
        
        for (let hour = 0; hour < 24; hour++) {
            if (dataByHour[hour]) {
                const d = dataByHour[hour];
                const avgMolde = Math.round(d.molde / d.count);
                const avgBlank = Math.round(d.blank / d.count);
                const avgNeckring = Math.round(d.neckring / d.count);
                const avgFunil = Math.round(d.funil / d.count);
                
                csv += `${hour.toString().padStart(2, '0')}:00,${avgMolde},${avgBlank},${avgNeckring},${avgFunil},"${d.type || 'auto'}"\n`;
            } else {
                csv += `${hour.toString().padStart(2, '0')}:00,0,0,0,0,"sem dados"\n`;
            }
        }
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `historico_diario_${machineId}_${date}.csv`);
        link.click();
        
        showDailyNotification('sucesso', 'Dados exportados com sucesso!');
    }

    // ================= COPIAR DADOS =================
    function copyDailyData() {
        if (!currentDailyData || currentDailyData.length === 0) {
            showDailyNotification('erro', 'Não há dados para copiar');
            return;
        }
        
        let text = 'Horário\tMoldes\tBlanks\tNeck Rings\tFunís\n';
        
        const dataByHour = {};
        currentDailyData.forEach(item => {
            const date = new Date(item.timestamp);
            const saoPauloTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
            const hour = saoPauloTime.getHours();
            
            if (!dataByHour[hour]) {
                dataByHour[hour] = {
                    molde: 0,
                    blank: 0,
                    neckring: 0,
                    funil: 0,
                    count: 0
                };
            }
            
            dataByHour[hour].molde += item.molde || 0;
            dataByHour[hour].blank += item.blank || 0;
            dataByHour[hour].neckring += item.neck_ring || 0;
            dataByHour[hour].funil += item.funil || 0;
            dataByHour[hour].count++;
        });
        
        for (let hour = 0; hour < 24; hour++) {
            if (dataByHour[hour]) {
                const d = dataByHour[hour];
                const avgMolde = Math.round(d.molde / d.count);
                const avgBlank = Math.round(d.blank / d.count);
                const avgNeckring = Math.round(d.neckring / d.count);
                const avgFunil = Math.round(d.funil / d.count);
                
                text += `${hour}:00\t${avgMolde}\t${avgBlank}\t${avgNeckring}\t${avgFunil}\n`;
            } else {
                text += `${hour}:00\t0\t0\t0\t0\n`;
            }
        }
        
        navigator.clipboard.writeText(text).then(() => {
            showDailyNotification('sucesso', 'Dados copiados!');
        }).catch(() => {
            showDailyNotification('erro', 'Erro ao copiar dados');
        });
    }

    // ================= NOTIFICAÇÃO =================
    function showDailyNotification(type, message) {
        const titles = {
            'sucesso': 'Sucesso!',
            'erro': 'Erro!',
            'info': 'Informação'
        };
        
        if (typeof showFormattedAlert === 'function') {
            showFormattedAlert(type, titles[type], message);
        } else {
            alert(message);
        }
    }

    // ================= FILTRAR TABELA =================
    function filterDailyTable() {
        const searchTerm = document.getElementById('tableSearch') ? document.getElementById('tableSearch').value.toLowerCase() : '';
        const rows = document.querySelectorAll('#dailyTableBody tr');
        
        rows.forEach(row => {
            if (row.classList.contains('no-data')) return;
            
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm) || searchTerm === '') {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // ================= REGISTRO MANUAL =================
    function forceManualHistoryRecord() {
        console.log("📝 Forçando registro manual...");
        
        // Verificar se a função existe no escopo global
        if (typeof window.forceManualHistoryRecord === 'function') {
            window.forceManualHistoryRecord().then(success => {
                if (success) {
                    showDailyNotification('sucesso', 'Registro manual realizado com sucesso!');
                    loadLastDailyRecord();
                    
                    // Recarregar gráfico se houver máquina selecionada
                    if (currentDailyMachine) {
                        setTimeout(() => {
                            loadDailyHistoryChart();
                        }, 1000);
                    }
                } else {
                    showDailyNotification('erro', 'Falha ao registrar histórico');
                }
            }).catch(error => {
                console.error("❌ Erro no registro manual:", error);
                showDailyNotification('erro', `Erro: ${error.message}`);
            });
        } else {
            console.error("❌ Função forceManualHistoryRecord não encontrada");
            showDailyNotification('erro', 'Serviço de histórico não disponível');
            
            // Tentar chamar diretamente do auto-history-service
            if (typeof window.recordAutoHistory === 'function') {
                window.recordAutoHistory('manual').then(success => {
                    if (success) {
                        showDailyNotification('sucesso', 'Registro manual realizado com sucesso!');
                        loadLastDailyRecord();
                    }
                });
            }
        }
    }

    // ================= ADICIONAR AO MENU =================
    function addDailyHistoryToMenu() {
        const menu = document.querySelector('.admin-menu');
        if (!menu) {
            setTimeout(addDailyHistoryToMenu, 1000);
            return;
        }
        
        if (document.querySelector('.admin-menu a[href="#history"]')) {
            return;
        }
        
        const historyItem = document.createElement('li');
        historyItem.innerHTML = `<a href="#history" onclick="showSection('history'); closeMobileMenu(); setTimeout(initDailyHistorySection, 500);">
            <i class="fas fa-chart-line"></i> Histórico Diário
        </a>`;
        
        menu.appendChild(historyItem);
        console.log("✅ Item de histórico diário adicionado ao menu");
    }

    // ================= INICIALIZAR =================
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(addDailyHistoryToMenu, 2000);
        
        // Configurar busca na tabela
        const searchInput = document.getElementById('tableSearch');
        if (searchInput) {
            searchInput.addEventListener('input', filterDailyTable);
        }
    });

    // ================= EXPORTAR FUNÇÕES =================
    window.initDailyHistorySection = initDailyHistorySection;
    window.loadDailyHistoryChart = loadDailyHistoryChart;
    window.setPeriod = setPeriod;
    window.enableCustomPeriod = enableCustomPeriod;
    window.applyCustomPeriod = applyCustomPeriod;
    window.toggleDataset = toggleDataset;
    window.exportDailyData = exportDailyData;
    window.copyDailyData = copyDailyData;
    window.filterDailyTable = filterDailyTable;
    window.forceManualHistoryRecord = forceManualHistoryRecord; // IMPORTANTE: Exportar a função

    console.log("✅ daily-history-charts.js carregado");
    
} else {
    console.log("ℹ️ daily-history-charts.js já estava carregado, ignorando duplicação");
}
