// ================= FUNÇÕES PARA OS CARTÕES =================

// Configurações
let allMachinesData = {};
let filteredMachinesData = {};
let machinePrefixes = {};
let machineComments = {};
let machineImages = {};
let machineLimits = {};
let machineMaintenance = {};
// prefixDatabase removido aqui para evitar duplicação
let activeFilters = {
    fornos: [],
    status: null,
    search: ''
};

// Elementos DOM
let cardsContainer;
let totalMachinesEl;
let criticalMachinesEl;
let lowStockMachinesEl;
let normalMachinesEl;
let connectionStatusEl;

// ================= INICIALIZAÇÃO =================
function initCardsDashboard() {
    console.log("🔄 Inicializando Dashboard de Cartões...");
    
    // Obter elementos DOM
    cardsContainer = document.getElementById('cardsContainer');
    totalMachinesEl = document.getElementById('totalMachines');
    criticalMachinesEl = document.getElementById('criticalMachines');
    lowStockMachinesEl = document.getElementById('lowStockMachines');
    normalMachinesEl = document.getElementById('normalMachines');
    connectionStatusEl = document.getElementById('connectionStatus');
    
    // Configurar tema
    if (typeof initTheme === 'function') {
        initTheme();
    }
    
    // Inicializar dados vazios
    allMachinesData = {};
    filteredMachinesData = {};
    machinePrefixes = {};
    machineComments = {};
    machineImages = {};
    machineLimits = {};
    machineMaintenance = {};
    activeFilters = {
        fornos: [],
        status: null,
        search: ''
    };
    
    // Mostrar mensagem de carregamento
    showLoadingMessage();
    
    // Carregar dados adicionais
    loadMachinePrefixes();
    loadMachineComments();
    loadMachineImages();
    loadMachineLimits();
    loadMachineMaintenance();
    
    // Conectar ao Firebase
    connectToFirebase();
    
    // Configurar event listeners
    setupEventListeners();
    
    console.log("✅ Dashboard de cartões inicializado");
}

// ================= MENSAGEM DE CARREGAMENTO =================
function showLoadingMessage() {
    const fornoSections = document.getElementById('fornoSections');
    if (!fornoSections) return;
    
    fornoSections.innerHTML = `
        <div class="loading-message" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
            <div class="spinner"></div>
            <p>Organizando máquinas por forno...</p>
        </div>
    `;
}

// ================= CARREGAR DADOS ADICIONAIS =================
function loadMachinePrefixes() {
    if (typeof adminConfigRef === 'undefined') return;
    
    adminConfigRef.child("prefixes").on("value", (snapshot) => {
        machinePrefixes = snapshot.val() || {};
        console.log("✅ Prefixos carregados:", Object.keys(machinePrefixes).length);
        
        if (Object.keys(allMachinesData).length > 0) {
            applyFilters();
        }
    }, (error) => {
        console.error("❌ Erro ao carregar prefixos:", error);
    });
}

function loadMachineComments() {
    if (typeof comentariosRef === 'undefined') return;
    
    comentariosRef.on("value", (snapshot) => {
        machineComments = snapshot.val() || {};
        console.log("✅ Comentários carregados:", Object.keys(machineComments).length);
    }, (error) => {
        console.error("❌ Erro ao carregar comentários:", error);
    });
}

function loadMachineImages() {
    if (typeof imagensRef === 'undefined') return;
    
    imagensRef.on("value", (snapshot) => {
        machineImages = snapshot.val() || {};
        console.log("✅ Imagens carregadas:", Object.keys(machineImages).length);
    }, (error) => {
        console.error("❌ Erro ao carregar imagens:", error);
    });
}

function loadMachineLimits() {
    if (typeof adminConfigRef === 'undefined') return;
    
    adminConfigRef.child("machineLimits").on("value", (snapshot) => {
        const limitsData = snapshot.val() || {};
        
        Object.keys(limitsData).forEach(machineId => {
            machineLimits[machineId] = {
                CRITICO: limitsData[machineId].critico || DEFAULT_LIMITS.CRITICO,
                BAIXO: limitsData[machineId].baixo || DEFAULT_LIMITS.BAIXO,
                NORMAL: limitsData[machineId].normal || DEFAULT_LIMITS.NORMAL
            };
        });
        
        console.log("✅ Limites individuais carregados:", Object.keys(machineLimits).length);
        
        if (Object.keys(allMachinesData).length > 0) {
            applyFilters();
        }
    }, (error) => {
        console.error("❌ Erro ao carregar limites:", error);
    });
}

// NOVO: Carregar status de manutenção
function loadMachineMaintenance() {
    if (typeof manutencaoRef === 'undefined') return;
    
    manutencaoRef.on("value", (snapshot) => {
        const maintenanceData = snapshot.val() || {};
        machineMaintenance = maintenanceData;
        console.log("✅ Status de manutenção carregados:", Object.keys(machineMaintenance).length);
        
        if (Object.keys(allMachinesData).length > 0) {
            applyFilters();
        }
    }, (error) => {
        console.error("❌ Erro ao carregar status de manutenção:", error);
    });
}

// ================= CONEXÃO COM FIREBASE =================
function connectToFirebase() {
    updateConnectionStatus('connecting', 'Conectando...');
    
    console.log("🔗 Tentando conectar ao Firebase...");
    
    if (typeof maquinasRef === 'undefined') {
        updateConnectionStatus('error', 'Erro: Firebase não inicializado');
        showNoDataMessage("Firebase não inicializado");
        return;
    }
    
    maquinasRef.on("value", (snapshot) => {
        const newData = snapshot.val();
        
        if (newData) {
            allMachinesData = newData;
            console.log("✅ Dados carregados:", Object.keys(allMachinesData).length, "máquinas");
            
            updateConnectionStatus('connected', `Conectado (${Object.keys(allMachinesData).length} máquinas)`);
            
            applyFilters();
            updateStatistics();
            
            if (typeof updateLastUpdateTime === 'function') {
                updateLastUpdateTime();
            }
            
        } else {
            console.log("⚠️  Nenhum dado encontrado");
            updateConnectionStatus('disconnected', 'Sem dados no banco');
            showNoDataMessage("Nenhuma máquina encontrada");
        }
    }, (error) => {
        console.error("❌ Erro Firebase:", error);
        updateConnectionStatus('error', 'Erro de conexão');
        showNoDataMessage(`Erro ao conectar: ${error.message}`);
    });
}

// ================= ATUALIZAR STATUS DA CONEXÃO =================
function updateConnectionStatus(status, message) {
    if (!connectionStatusEl) return;
    
    connectionStatusEl.className = 'connection-status';
    connectionStatusEl.classList.add(status);
    
    const icon = connectionStatusEl.querySelector('i');
    const text = connectionStatusEl.querySelector('span');
    
    if (status === 'connected') {
        icon.className = 'fas fa-circle';
        icon.style.color = '#10b981';
        text.textContent = message;
    } else if (status === 'connecting') {
        icon.className = 'fas fa-sync-alt fa-spin';
        icon.style.color = '#f59e0b';
        text.textContent = message;
    } else {
        icon.className = 'fas fa-circle';
        icon.style.color = '#ef4444';
        text.textContent = message;
    }
}

// ================= GERAR SEÇÕES POR FORNO =================
function generateFornoSections() {
    const fornoSections = document.getElementById('fornoSections');
    if (!fornoSections) return;
    
    // Esconder container tradicional
    const cardsContainer = document.getElementById('cardsContainer');
    if (cardsContainer) {
        cardsContainer.style.display = 'none';
    }
    
    // Mostrar seções por forno
    fornoSections.style.display = 'flex';
    
    const fornos = ['A', 'B', 'C', 'D'];
    
    let html = '';
    
    fornos.forEach(forno => {
        const machinesInForno = getMachinesByForno(forno);
        
        // Estatísticas
        let criticalCount = 0;
        let warningCount = 0;
        let normalCount = 0;
        let maintenanceCount = 0;
        
        machinesInForno.forEach(machineId => {
            const machineData = allMachinesData[machineId];
            const limits = machineLimits[machineId] || DEFAULT_LIMITS;
            const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
            
            if (isInMaintenance) {
                maintenanceCount++;
            } else {
                const status = getMachineStatusWithLimits(machineData, limits);
                
                if (status === 'critical') criticalCount++;
                else if (status === 'warning') warningCount++;
                else if (status === 'normal') normalCount++;
            }
        });
        
        html += `
            <div class="forno-section" id="forno-${forno}">
                <div class="forno-header">
                    <div class="forno-title">
                        <span class="forno-badge ${forno}">${forno}</span>
                        <div class="forno-name">
                            <h3>Forno ${forno}</h3>
                            <div class="forno-stats">
                                <span>
                                    <i class="fas fa-industry"></i>
                                    ${machinesInForno.length} máquinas
                                </span>
                                ${maintenanceCount > 0 ? `
                                    <span>
                                        <i class="fas fa-tools" style="color: var(--secondary);"></i>
                                        <span class="maintenance-count">${maintenanceCount}</span> em manutenção
                                    </span>
                                ` : ''}
                                <span>
                                    <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                                    <span class="critical-count">${criticalCount}</span> críticas
                                </span>
                                <span>
                                    <i class="fas fa-exclamation-circle" style="color: var(--warning);"></i>
                                    <span class="warning-count">${warningCount}</span> baixas
                                </span>
                                <span>
                                    <i class="fas fa-check-circle" style="color: var(--success);"></i>
                                    <span class="normal-count">${normalCount}</span> normais
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="carousel-controls">
                        <button class="carousel-btn" onclick="scrollFornoLeft('${forno}')" id="scrollLeft-${forno}">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="carousel-btn" onclick="scrollFornoRight('${forno}')" id="scrollRight-${forno}">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                
                ${machinesInForno.length > 0 ? `
                    <div class="forno-cards-container" id="cards-${forno}">
                        ${machinesInForno.map(machineId => {
                            const machineData = allMachinesData[machineId];
                            return createMachineCardHTML(machineId, machineData);
                        }).join('')}
                    </div>
                    <div class="scroll-indicator">
                        <i class="fas fa-arrow-right"></i>
                        Arraste para ver mais máquinas
                    </div>
                ` : `
                    <div class="forno-empty">
                        <i class="fas fa-industry"></i>
                        <p>Nenhuma máquina encontrada no Forno ${forno}</p>
                    </div>
                `}
            </div>
        `;
    });
    
    fornoSections.innerHTML = html;
    
    // Criar medidores circulares
    setTimeout(() => {
        fornos.forEach(forno => {
            const machinesInForno = getMachinesByForno(forno);
            machinesInForno.forEach(machineId => {
                const machineData = allMachinesData[machineId];
                const limits = machineLimits[machineId] || DEFAULT_LIMITS;
                const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
                
                if (!isInMaintenance) {
                    const moldeValue = machineData.molde || 0;
                    const blankValue = machineData.blank || 0;
                    
                    const moldeColor = getGaugeColorWithLimits(moldeValue, limits);
                    const blankColor = getGaugeColorWithLimits(blankValue, limits);
                    
                    if (typeof createCircularGauge === 'function') {
                        createCircularGauge(`gauge-molde-${machineId}`, moldeValue, moldeColor);
                        createCircularGauge(`gauge-blank-${machineId}`, blankValue, blankColor);
                    }
                }
            });
            
            updateCarouselControls(forno);
        });
    }, 100);
}

// ================= FUNÇÕES AUXILIARES PARA FORNOS =================
function getMachinesByForno(forno) {
    return Object.keys(allMachinesData)
        .filter(machineId => {
            const machineForno = getFornoFromMachineId(machineId);
            return machineForno === forno;
        })
        .sort();
}

function createMachineCardHTML(machineId, machineData) {
    const limits = machineLimits[machineId] || DEFAULT_LIMITS;
    const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
    const maintenanceReason = machineMaintenance[machineId]?.reason || "";
    const status = isInMaintenance ? 'maintenance' : getMachineStatusWithLimits(machineData, limits);
    const forno = getFornoFromMachineId(machineId);
    const prefixKey = machinePrefixes[machineId] || '';
    const comment = machineComments[machineId] || {};
    
    // Se estiver em manutenção, mostrar card especial
    if (isInMaintenance) {
        return `
            <div class="machine-card maintenance" data-machine-id="${machineId}" data-forno="${forno}" data-maintenance="true">
                <div class="maintenance-overlay"></div>
                <div class="maintenance-content">
                    <div class="card-header">
                        <div class="machine-name">
                            <i class="fas fa-industry"></i>
                            ${machineId}
                            ${prefixKey ? `<span class="machine-prefix" title="${prefixKey}"> - ${prefixKey}</span>` : ''}
                        </div>
                        <span class="forno-badge ${forno}">Forno ${forno}</span>
                    </div>
                    
                    <div class="maintenance-indicator">
                        <div class="maintenance-icon">
                            <i class="fas fa-tools"></i>
                        </div>
                        <div class="maintenance-text">
                            <h4>PARADA PARA MANUTENÇÃO</h4>
                            ${maintenanceReason ? `<p>Motivo: ${maintenanceReason}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="card-action">
                        <button class="details-btn" onclick="openMachineDetails('${machineId}')">
                            <i class="fas fa-info-circle"></i> Ver Detalhes
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Card normal (não em manutenção)
    const urgentIndicator = status === 'critical' 
        ? '<div class="urgent-indicator" title="Necessita atenção urgente!"></div>' 
        : '';
    
    const fornoBadge = forno ? 
        `<span class="forno-badge ${forno}">Forno ${forno}</span>` : 
        '<span class="forno-badge" style="background: var(--secondary)">Sem Forno</span>';
    
    const moldeValue = machineData.molde || 0;
    const blankValue = machineData.blank || 0;
    const neckringValue = machineData.neck_ring || 0;
    const funilValue = machineData.funil || 0;
    
    const moldeColor = getGaugeColorWithLimits(moldeValue, limits);
    const blankColor = getGaugeColorWithLimits(blankValue, limits);
    
    const statusText = getStatusTextByValueWithLimits(moldeValue, limits);
    
    // Adicionar ícone de comentário se houver
    const commentIcon = comment.text ? 
        `<i class="fas fa-comment" style="margin-left: 5px; color: var(--primary); font-size: 12px;" title="Possui comentário"></i>` : '';
    
    return `
        <div class="machine-card ${status}" data-machine-id="${machineId}" data-forno="${forno}" data-maintenance="false">
            ${urgentIndicator}
            
            <div class="card-header">
                <div class="machine-name">
                    <i class="fas fa-industry"></i>
                    ${machineId}
                    ${prefixKey ? `<span class="machine-prefix" title="${prefixKey}"> - ${prefixKey}</span>` : ''}
                    ${commentIcon}
                </div>
                
            </div>
            
            ${comment.text ? `
                <div class="machine-comment-preview" style="background: rgba(14, 165, 233, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid var(--primary); font-size: 12px; color: var(--text);">
                    <i class="fas fa-comment" style="margin-right: 5px; color: var(--primary);"></i>
                    ${comment.text.substring(0, 50)}${comment.text.length > 50 ? '...' : ''}
                </div>
            ` : ''}
            
            <div class="gauges-container">
                <div class="gauge">
                    <div class="gauge-title">Moldes</div>
                    <div class="gauge-canvas">
                        <canvas id="gauge-molde-${machineId}" width="100" height="100"></canvas>
                        <div class="gauge-value">${moldeValue}</div>
                    </div>
                    <div class="gauge-label" style="color: ${moldeColor}">${statusText}</div>
                </div>
                
                <div class="gauge">
                    <div class="gauge-title">Blanks</div>
                    <div class="gauge-canvas">
                        <canvas id="gauge-blank-${machineId}" width="100" height="100"></canvas>
                        <div class="gauge-value">${blankValue}</div>
                    </div>
                    <div class="gauge-label" style="color: ${blankColor}">${getStatusTextByValueWithLimits(blankValue, limits)}</div>
                </div>
            </div>
            
            <div class="status-indicators">
                <div class="status-item">
                    <span class="status-value">${neckringValue}</span>
                    <span class="status-label">Neck Rings</span>
                </div>
                <div class="status-item">
                    <span class="status-value">${funilValue}</span>
                    <span class="status-label">Funís</span>
                </div>
            </div>
            
            <div class="card-action">
                <button class="details-btn" onclick="openMachineDetails('${machineId}')">
                    <i class="fas fa-info-circle"></i> Ver Detalhes
                </button>
            </div>
        </div>
    `;
}

// ================= CONTROLES DO CARROSSEL =================
function scrollFornoLeft(forno) {
    const container = document.getElementById(`cards-${forno}`);
    if (!container) return;
    
    container.scrollBy({
        left: -300,
        behavior: 'smooth'
    });
    
    setTimeout(() => updateCarouselControls(forno), 300);
}

function scrollFornoRight(forno) {
    const container = document.getElementById(`cards-${forno}`);
    if (!container) return;
    
    container.scrollBy({
        left: 300,
        behavior: 'smooth'
    });
    
    setTimeout(() => updateCarouselControls(forno), 300);
}

function updateCarouselControls(forno) {
    const container = document.getElementById(`cards-${forno}`);
    const leftBtn = document.getElementById(`scrollLeft-${forno}`);
    const rightBtn = document.getElementById(`scrollRight-${forno}`);
    
    if (!container || !leftBtn || !rightBtn) return;
    
    const isAtStart = container.scrollLeft === 0;
    const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
    
    leftBtn.disabled = isAtStart;
    rightBtn.disabled = isAtEnd;
    
    leftBtn.style.opacity = isAtStart ? '0.5' : '1';
    rightBtn.style.opacity = isAtEnd ? '0.5' : '1';
}

// ================= GERAR CARTÕES (modo tradicional) =================
function generateMachineCards(machinesData) {
    if (!cardsContainer) return;
    
    cardsContainer.innerHTML = '';
    
    const machines = Object.keys(machinesData).sort();
    
    if (machines.length === 0) {
        showNoDataMessage();
        return;
    }
    
    console.log(`🖨️  Gerando ${machines.length} cartões...`);
    
    machines.forEach(machineId => {
        const machineData = machinesData[machineId];
        const card = createMachineCard(machineId, machineData);
        cardsContainer.appendChild(card);
    });
    
    console.log("✅ Cartões gerados");
}

// ================= CRIAR CARTÃO INDIVIDUAL =================
function createMachineCard(machineId, machineData) {
    const limits = machineLimits[machineId] || DEFAULT_LIMITS;
    const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
    const maintenanceReason = machineMaintenance[machineId]?.reason || "";
    const status = isInMaintenance ? 'maintenance' : getMachineStatusWithLimits(machineData, limits);
    const forno = getFornoFromMachineId(machineId);
    const prefixKey = machinePrefixes[machineId] || '';
    const comment = machineComments[machineId] || {};
    
    // Se estiver em manutenção, criar card especial
    if (isInMaintenance) {
        const card = document.createElement('div');
        card.className = 'machine-card maintenance';
        card.dataset.machineId = machineId;
        card.dataset.forno = forno;
        card.dataset.maintenance = 'true';
        
        card.innerHTML = `
            <div class="maintenance-overlay"></div>
            <div class="maintenance-content">
                <div class="card-header">
                    <div class="machine-name">
                        <i class="fas fa-industry"></i>
                        Máquina ${machineId}
                        ${prefixKey ? `<span class="machine-prefix" title="${prefixKey}"> - ${prefixKey}</span>` : ''}
                    </div>
                    <span class="forno-badge ${forno}">Forno ${forno}</span>
                </div>
                
                <div class="maintenance-indicator">
                    <div class="maintenance-icon">
                        <i class="fas fa-tools"></i>
                    </div>
                    <div class="maintenance-text">
                        <h4>PARADA PARA MANUTENÇÃO</h4>
                        ${maintenanceReason ? `<p>Motivo: ${maintenanceReason}</p>` : ''}
                    </div>
                </div>
                
                <div class="card-action">
                    <button class="details-btn" onclick="openMachineDetails('${machineId}')">
                        <i class="fas fa-info-circle"></i> Ver Detalhes
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    // Card normal (não em manutenção)
    const moldeCanvasId = `gauge-molde-${machineId}-${Date.now()}`;
    const blankCanvasId = `gauge-blank-${machineId}-${Date.now()}`;
    
    const card = document.createElement('div');
    card.className = `machine-card ${status}`;
    card.dataset.machineId = machineId;
    card.dataset.forno = forno;
    card.dataset.status = status;
    card.dataset.maintenance = 'false';
    
    const urgentIndicator = status === 'critical' 
        ? '<div class="urgent-indicator" title="Necessita atenção urgente!"></div>' 
        : '';
    
    const fornoBadge = forno ? 
        `<span class="forno-badge ${forno}">Forno ${forno}</span>` : 
        '<span class="forno-badge" style="background: var(--secondary)">Sem Forno</span>';
    
    const moldeValue = machineData.molde || 0;
    const blankValue = machineData.blank || 0;
    const neckringValue = machineData.neck_ring || 0;
    const funilValue = machineData.funil || 0;
    
    const moldeColor = getGaugeColorWithLimits(moldeValue, limits);
    const blankColor = getGaugeColorWithLimits(blankValue, limits);
    
    const statusText = getStatusTextByValueWithLimits(moldeValue, limits);
    
    // Adicionar ícone de comentário se houver
    const commentIcon = comment.text ? 
        `<i class="fas fa-comment" style="margin-left: 5px; color: var(--primary); font-size: 12px;" title="Possui comentário"></i>` : '';
    
    card.innerHTML = `
        ${urgentIndicator}
        
        <div class="card-header">
            <div class="machine-name">
                <i class="fas fa-industry"></i>
                Máquina ${machineId}
                ${prefixKey ? `<span class="machine-prefix" title="${prefixKey}"> - ${prefixKey}</span>` : ''}
                ${commentIcon}
            </div>
            
        </div>
        
        ${comment.text ? `
            <div class="machine-comment-preview" style="background: rgba(14, 165, 233, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid var(--primary); font-size: 12px; color: var(--text);">
                <i class="fas fa-comment" style="margin-right: 5px; color: var(--primary);"></i>
                ${comment.text.substring(0, 50)}${comment.text.length > 50 ? '...' : ''}
            </div>
        ` : ''}
        
        <div class="gauges-container">
            <div class="gauge">
                <div class="gauge-title">Moldes</div>
                <div class="gauge-canvas">
                    <canvas id="${moldeCanvasId}" width="100" height="100"></canvas>
                    <div class="gauge-value">${moldeValue}</div>
                </div>
                <div class="gauge-label" style="color: ${moldeColor}">${statusText}</div>
            </div>
            
            <div class="gauge">
                <div class="gauge-title">Blanks</div>
                <div class="gauge-canvas">
                    <canvas id="${blankCanvasId}" width="100" height="100"></canvas>
                    <div class="gauge-value">${blankValue}</div>
                </div>
                <div class="gauge-label" style="color: ${blankColor}">${getStatusTextByValueWithLimits(blankValue, limits)}</div>
            </div>
        </div>
        
        <div class="status-indicators">
            <div class="status-item">
                <span class="status-value">${neckringValue}</span>
                <span class="status-label">Neck Rings</span>
            </div>
            <div class="status-item">
                <span class="status-value">${funilValue}</span>
                <span class="status-label">Funís</span>
            </div>
        </div>
        
        <div class="card-action">
            <button class="details-btn" onclick="openMachineDetails('${machineId}')">
                <i class="fas fa-info-circle"></i> Ver Detalhes
            </button>
        </div>
    `;
    
    // Criar medidores após um pequeno delay para garantir que o DOM foi atualizado
    if (!isInMaintenance) {
        setTimeout(() => {
            createCircularGauge(moldeCanvasId, moldeValue, moldeColor);
            createCircularGauge(blankCanvasId, blankValue, blankColor);
        }, 50);
    }
    
    return card;
}

// ================= FUNÇÕES DE STATUS =================
function getMachineStatusWithLimits(machineData, limits) {
    const moldeValue = machineData.molde || 0;
    const blankValue = machineData.blank || 0;
    
    const moldeStatus = getValueStatusWithLimits(moldeValue, limits);
    const blankStatus = getValueStatusWithLimits(blankValue, limits);
    
    if (moldeStatus === 'critical' || blankStatus === 'critical') {
        return 'critical';
    } else if (moldeStatus === 'warning' || blankStatus === 'warning') {
        return 'warning';
    } else {
        return 'normal';
    }
}

function getValueStatusWithLimits(value, limits) {
    if (value <= limits.CRITICO) {
        return 'critical';
    } else if (value <= limits.BAIXO) {
        return 'warning';
    } else {
        return 'normal';
    }
}

function getStatusTextByValueWithLimits(value, limits) {
    if (value <= limits.CRITICO) {
        return 'BAIXA RESERVA';
    } else if (value <= limits.BAIXO) {
        return 'BAIXO ESTOQUE';
    } else {
        return 'BEM ABASTECIDO';
    }
}

// ================= DETERMINAR FORNO =================
function getFornoFromMachineId(machineId) {
    console.log(`🔍 Determinando forno para máquina: ${machineId}`);
    
    // Verificar se a máquina começa com A, B, C
    if (machineId.startsWith('A')) return 'A';
    if (machineId.startsWith('B')) return 'B';
    if (machineId.startsWith('C')) return 'C';
    
    // Verificar se é um número entre 10-15
    if (/^\d+$/.test(machineId)) {
        const num = parseInt(machineId);
        if (num >= 10 && num <= 15) return 'D';
    }
    
    // Verificar se é um dos números especificados
    if (['10','11','12','13','14','15'].includes(machineId)) return 'D';
    
    console.log(`❌ Não foi possível determinar forno para: ${machineId}`);
    return null;
}

// ================= APLICAR FILTROS (CORRIGIDO) =================
function applyFilters() {
    console.log("🔍 Aplicando filtros...", activeFilters);
    
    // Limpar medidores antigos
    cleanupOldGauges();
    
    let filtered = {};
    
    Object.keys(allMachinesData).forEach(machineId => {
        const machineData = allMachinesData[machineId];
        let shouldInclude = true;
        
        // Filtrar por forno - VERIFICAR SE O FORNO EXISTE
        if (activeFilters.fornos.length > 0) {
            const forno = getFornoFromMachineId(machineId);
            
            // Debug: verificar forno encontrado
            console.log(`Máquina ${machineId}: Forno encontrado=${forno}, Filtros ativos=${JSON.stringify(activeFilters.fornos)}`);
            
            // Se não tem forno ou não está na lista, excluir
            if (!forno || !activeFilters.fornos.includes(forno)) {
                shouldInclude = false;
                console.log(`❌ Máquina ${machineId} excluída por filtro de forno`);
            }
        }
        
        // Filtrar por status
        if (activeFilters.status) {
            const limits = machineLimits[machineId] || DEFAULT_LIMITS;
            const status = getMachineStatusWithLimits(machineData, limits);
            
            console.log(`Máquina ${machineId}: Status=${status}, Filtro=${activeFilters.status}`);
            
            if (status !== activeFilters.status) {
                shouldInclude = false;
                console.log(`❌ Máquina ${machineId} excluída por filtro de status`);
            }
        }
        
        // Filtrar por busca
        if (activeFilters.search) {
            const searchTerm = activeFilters.search.toLowerCase();
            const prefixKey = machinePrefixes[machineId] || '';
            const comment = machineComments[machineId]?.text || '';
            const searchIn = `${machineId} ${prefixKey} ${comment}`.toLowerCase();
            
            if (!searchIn.includes(searchTerm)) {
                shouldInclude = false;
                console.log(`❌ Máquina ${machineId} excluída por filtro de busca`);
            }
        }
        
        if (shouldInclude) {
            filtered[machineId] = machineData;
        }
    });
    
    filteredMachinesData = filtered;
    
    console.log(`✅ Filtro aplicado: ${Object.keys(filtered).length} de ${Object.keys(allMachinesData).length}`);
    console.log("Filtros ativos:", activeFilters);
    
    // Verificar se há filtros ativos
    const hasFilters = activeFilters.fornos.length > 0 || 
                      activeFilters.status !== null || 
                      activeFilters.search !== '';
    
    if (hasFilters) {
        // Usar modo tradicional com filtros
        const fornoSections = document.getElementById('fornoSections');
        const cardsContainer = document.getElementById('cardsContainer');
        
        if (fornoSections) fornoSections.style.display = 'none';
        if (cardsContainer) {
            cardsContainer.style.display = 'grid';
            cardsContainer.classList.remove('horizontal-view');
            generateMachineCards(filtered);
            
            // CHAMADA CRÍTICA: Recriar medidores após um delay
            setTimeout(() => {
                recreateFilteredGauges();
            }, 100);
        }
    } else {
        // Usar modo seções por forno (sem filtros)
        generateFornoSections();
    }
    
    updateStatistics();
}

// ================= FUNÇÃO PARA RECRIAR MEDIDORES COM FILTRO =================
function recreateFilteredGauges() {
    console.log("🎯 Recriando medidores para máquinas filtradas...");
    
    const machines = Object.keys(filteredMachinesData);
    
    if (machines.length === 0) {
        console.log("⚠️ Nenhuma máquina para criar medidores");
        return;
    }
    
    console.log(`🔄 Criando medidores para ${machines.length} máquinas`);
    
    machines.forEach(machineId => {
        const machineData = filteredMachinesData[machineId];
        const limits = machineLimits[machineId] || DEFAULT_LIMITS;
        const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
        
        if (!isInMaintenance) {
            const moldeValue = machineData.molde || 0;
            const blankValue = machineData.blank || 0;
            
            const moldeColor = getGaugeColorWithLimits(moldeValue, limits);
            const blankColor = getGaugeColorWithLimits(blankValue, limits);
            
            // Tentar encontrar os canvas
            setTimeout(() => {
                // Procurar por canvas que contenham o ID da máquina
                const canvases = document.querySelectorAll(`canvas[id*="${machineId}"]`);
                
                canvases.forEach(canvas => {
                    if (canvas.id.includes('molde')) {
                        createCircularGauge(canvas.id, moldeValue, moldeColor);
                    } else if (canvas.id.includes('blank')) {
                        createCircularGauge(canvas.id, blankValue, blankColor);
                    }
                });
            }, 150);
        }
    });
    
    console.log("✅ Medidores recriados");
}

// ================= LIMPAR MEDIDORES ANTIGOS =================
function cleanupOldGauges() {
    const canvases = document.querySelectorAll('canvas[id^="gauge-"]');
    canvases.forEach(canvas => {
        if (canvas._chart) {
            canvas._chart.destroy();
        }
    });
}

// ================= ESTATÍSTICAS =================
function updateStatistics() {
    const machines = Object.keys(filteredMachinesData);
    const total = machines.length;
    
    let critical = 0;
    let warning = 0;
    let normal = 0;
    let maintenance = 0;
    
    machines.forEach(machineId => {
        const machineData = filteredMachinesData[machineId];
        const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
        
        if (isInMaintenance) {
            maintenance++;
        } else {
            const limits = machineLimits[machineId] || DEFAULT_LIMITS;
            const status = getMachineStatusWithLimits(machineData, limits);
            
            if (status === 'critical') critical++;
            else if (status === 'warning') warning++;
            else if (status === 'normal') normal++;
        }
    });
    
    if (totalMachinesEl) totalMachinesEl.textContent = total;
    if (criticalMachinesEl) criticalMachinesEl.textContent = critical;
    if (lowStockMachinesEl) lowStockMachinesEl.textContent = warning;
    if (normalMachinesEl) normalMachinesEl.textContent = normal;
    
    // Atualizar contador de manutenção se o elemento existir
    const maintenanceEl = document.getElementById('maintenanceMachines');
    if (maintenanceEl) {
        maintenanceEl.textContent = maintenance;
    }
    
    console.log(`📊 Estatísticas: Total=${total}, Críticas=${critical}, Baixo=${warning}, Normal=${normal}, Manutenção=${maintenance}`);
}

// ================= MENSAGENS =================
function showNoDataMessage(customMessage = null) {
    const fornoSections = document.getElementById('fornoSections');
    const cardsContainer = document.getElementById('cardsContainer');
    
    const message = customMessage || "Nenhuma máquina encontrada. Verifique os filtros.";
    
    if (fornoSections) {
        fornoSections.innerHTML = `
            <div class="no-data-message" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-database" style="font-size: 60px; color: var(--text-light); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text); margin-bottom: 10px;">${message}</h3>
                <p style="color: var(--text-light); margin-bottom: 20px;">Tente atualizar a página ou verificar sua conexão</p>
                <button class="btn" onclick="clearAllFilters()" style="background: var(--primary); color: white; margin-right: 10px;">
                    <i class="fas fa-filter"></i> Limpar Filtros
                </button>
                <button class="btn" onclick="refreshData()" style="background: var(--warning); color: white;">
                    <i class="fas fa-sync-alt"></i> Tentar Novamente
                </button>
            </div>
        `;
    }
    
    if (cardsContainer) {
        cardsContainer.innerHTML = `
            <div class="no-data-message" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-database" style="font-size: 60px; color: var(--text-light); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text); margin-bottom: 10px;">${message}</h3>
                <p style="color: var(--text-light); margin-bottom: 20px;">Tente atualizar a página ou verificar sua conexão</p>
                <button class="btn" onclick="clearAllFilters()" style="background: var(--primary); color: white; margin-right: 10px;">
                    <i class="fas fa-filter"></i> Limpar Filtros
                </button>
                <button class="btn" onclick="refreshData()" style="background: var(--warning); color: white;">
                    <i class="fas fa-sync-alt"></i> Tentar Novamente
                </button>
            </div>
        `;
    }
}

// ================= MODAL DE DETALHES (CORRIGIDO COM PREFIXOS DETALHADOS) =================
async function openMachineDetails(machineId) {
    console.log(`📋 Abrindo detalhes da máquina ${machineId}`);
    
    const machineData = allMachinesData[machineId];
    if (!machineData) return;
    
    const modal = document.getElementById('machineModal');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) return;
    
    const limits = machineLimits[machineId] || DEFAULT_LIMITS;
    const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
    const maintenanceReason = machineMaintenance[machineId]?.reason || "";
    const status = isInMaintenance ? 'maintenance' : getMachineStatusWithLimits(machineData, limits);
    const forno = getFornoFromMachineId(machineId);
    const prefixKey = machinePrefixes[machineId] || '';
    const comment = machineComments[machineId] || {};
    const imageUrl = machineImages[machineId]?.url || '';
    
    // NOVO: Obter dados do prefixo detalhado
    let prefixData = null;
    let prefixHTML = '';
    
    if (prefixKey && typeof window.prefixDatabase !== 'undefined' && window.prefixDatabase[prefixKey]) {
        prefixData = window.prefixDatabase[prefixKey];
        
        prefixHTML = `
            <div style="background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px;">
                <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-tags"></i> Informações do Prefixo Detalhado
                </h4>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Prefixo</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--text);">${prefixData.prefixGrande}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Tipo de Processo</div>
                        <div style="font-size: 16px; font-weight: 600; color: var(--primary);">${prefixData.processo || 'Não informado'}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Localização no Almoxarifado</div>
                    <div style="font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-map-marker-alt" style="color: var(--warning);"></i>
                        <span>
                            ${prefixData.localizacao?.corredor ? `Corredor ${prefixData.localizacao.corredor}` : 'Corredor não informado'}
                            ${prefixData.localizacao?.prateleira ? `, Prateleira ${prefixData.localizacao.prateleira}` : ''}
                        </span>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Terminações Específicas</div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                        ${prefixData.terminacoes?.prefixoMolde ? `
                            <div style="background: rgba(14, 165, 233, 0.1); padding: 10px; border-radius: 6px;">
                                <div style="font-size: 11px; color: var(--primary); margin-bottom: 3px;">Prefixo Molde</div>
                                <div style="font-size: 14px; font-weight: 600; color: var(--text);">${prefixData.terminacoes.prefixoMolde}</div>
                            </div>
                        ` : ''}
                        
                        ${prefixData.terminacoes?.prefixoBlank ? `
                            <div style="background: rgba(14, 165, 233, 0.1); padding: 10px; border-radius: 6px;">
                                <div style="font-size: 11px; color: var(--primary); margin-bottom: 3px;">Prefixo Blank</div>
                                <div style="font-size: 14px; font-weight: 600; color: var(--text);">${prefixData.terminacoes.prefixoBlank}</div>
                            </div>
                        ` : ''}
                        
                        ${prefixData.terminacoes?.neckring ? `
                            <div style="background: rgba(139, 92, 246, 0.1); padding: 10px; border-radius: 6px;">
                                <div style="font-size: 11px; color: #8b5cf6; margin-bottom: 3px;">Neckring</div>
                                <div style="font-size: 14px; font-weight: 600; color: var(--text);">${prefixData.terminacoes.neckring}</div>
                            </div>
                        ` : ''}
                        
                        ${prefixData.terminacoes?.aneisGuias ? `
                            <div style="background: rgba(139, 92, 246, 0.1); padding: 10px; border-radius: 6px;">
                                <div style="font-size: 11px; color: #8b5cf6; margin-bottom: 3px;">Anéis Guias</div>
                                <div style="font-size: 14px; font-weight: 600; color: var(--text);">${prefixData.terminacoes.aneisGuias}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Outras terminações -->
                <div style="margin-top: 15px;">
                    <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Outros Componentes</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px;">
                        ${['thimble', 'macho', 'cooler', 'baffle', 'bafflePlug', 'funil', 'fundo', 'fundoPlug', 'soprador', 'pinca'].map(field => 
                            prefixData.terminacoes?.[field] ? `
                                <div style="text-align: center; background: var(--card-bg); padding: 8px; border-radius: 4px; border: 1px solid var(--border);">
                                    <div style="color: var(--text-light); margin-bottom: 2px;">${field.replace(/([A-Z])/g, ' $1').toUpperCase()}</div>
                                    <div style="font-weight: 600; color: var(--text);">${prefixData.terminacoes[field]}</div>
                                </div>
                            ` : ''
                        ).join('')}
                    </div>
                </div>
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-light);">
                    <div style="display: flex; justify-content: space-between;">
                        <span>
                            <i class="fas fa-calendar"></i> Criado em: ${prefixData.criadoEm ? new Date(prefixData.criadoEm).toLocaleDateString('pt-BR') : 'N/A'}
                        </span>
                        <span>
                            <i class="fas fa-sync-alt"></i> Atualizado em: ${prefixData.atualizadoEm ? new Date(prefixData.atualizadoEm).toLocaleDateString('pt-BR') : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    } else if (prefixKey) {
        // Se tiver prefixKey mas não encontrou no banco
        prefixHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid var(--warning); margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i>
                    <div>
                        <div style="font-weight: 600; color: var(--text);">Prefixo "${prefixKey}" não encontrado</div>
                        <div style="font-size: 13px; color: var(--text-light); margin-top: 5px;">
                            O prefixo atribuído a esta máquina não foi encontrado no banco de dados.
                            Verifique na seção "Prefixos Detalhados" do painel administrativo.
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    let history = [];
    if (typeof loadMachineHistory === 'function') {
        history = await loadMachineHistory(machineId);
    }
    
    let statusText = '';
    let statusColor = '';
    
    if (isInMaintenance) {
        statusText = 'EM MANUTENÇÃO - Parada para manutenção';
        statusColor = '#64748b';
    } else {
        switch(status) {
            case 'critical':
                statusText = 'BAIXA RESERVA - Necessita atenção urgente!';
                statusColor = '#ef4444';
                break;
            case 'warning':
                statusText = 'BAIXO ESTOQUE - Fique atento!';
                statusColor = '#f59e0b';
                break;
            case 'normal':
                statusText = 'BEM ABASTECIDO - Em condições adequadas';
                statusColor = '#10b981';
                break;
        }
    }
    
    const moldeValue = machineData.molde || 0;
    const blankValue = machineData.blank || 0;
    const neckringValue = machineData.neck_ring || 0;
    const funilValue = machineData.funil || 0;
    
    modalBody.innerHTML = `
        <div class="machine-info">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 18px; color: var(--text); display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-industry"></i>
                    Máquina ${machineId}
                    ${prefixKey ? `<span style="color: var(--primary); font-weight: 600;"> - ${prefixKey}</span>` : ''}
                </h3>
                <span class="forno-badge ${forno}" style="font-size: 14px;">Forno ${forno || 'N/A'}</span>
            </div>
            
            <div style="background: ${statusColor}20; padding: 15px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${isInMaintenance ? 'fa-tools' : 'fa-exclamation-circle'}" style="color: ${statusColor}; font-size: 20px;"></i>
                    <div>
                        <div style="font-weight: 700; color: ${statusColor};">Status: ${statusText}</div>
                        ${maintenanceReason ? `<div style="font-size: 13px; color: var(--text); margin-top: 5px;">Motivo: ${maintenanceReason}</div>` : ''}
                        <div style="font-size: 12px; color: var(--text-light); margin-top: 5px;">
                            ${isInMaintenance ? 'Máquina parada para manutenção' : 'Baseado nos valores de moldes e blanks'}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- NOVO: Seção de prefixo detalhado -->
            ${prefixHTML}
            
            ${imageUrl ? `
                <div style="margin-bottom: 20px; text-align: center;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; justify-content: center;">
                        <i class="fas fa-camera"></i> Equipamento
                    </div>
                    <img src="${imageUrl}" alt="Máquina ${machineId}" 
                         style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 2px solid var(--border);">
                </div>
            ` : ''}
            
            ${comment.text ? `
                <div style="background: var(--card-bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-comment"></i> Comentários
                    </div>
                    <div style="font-size: 14px; color: var(--text); line-height: 1.5; margin-bottom: 10px;">
                        ${comment.text}
                    </div>
                    ${comment.author ? `
                        <div style="font-size: 12px; color: var(--text-light); text-align: right; font-style: italic;">
                            — ${comment.author}, ${comment.date ? new Date(comment.date).toLocaleDateString('pt-BR') : ''}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            ${!isInMaintenance ? `
                <div style="margin-bottom: 25px;">
                    <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-list"></i> Valores Atuais
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span style="font-weight: 600; color: var(--text);">Moldes</span>
                                <span style="font-size: 24px; font-weight: 800; color: ${getGaugeColorWithLimits(moldeValue, limits)}">${moldeValue}</span>
                            </div>
                            <div style="font-size: 12px; color: var(--text-light);">
                                Status: <span style="color: ${getGaugeColorWithLimits(moldeValue, limits)}; font-weight: 600;">${getStatusTextByValueWithLimits(moldeValue, limits)}</span>
                            </div>
                            <div style="margin-top: 10px;">
                                <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${(moldeValue / 20) * 100}%; background: ${getGaugeColorWithLimits(moldeValue, limits)};"></div>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-light); margin-top: 5px;">
                                    <span>0</span>
                                    <span>10</span>
                                    <span>20</span>
                                    <span>30</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span style="font-weight: 600; color: var(--text);">Blanks</span>
                                <span style="font-size: 24px; font-weight: 800; color: ${getGaugeColorWithLimits(blankValue, limits)}">${blankValue}</span>
                            </div>
                            <div style="font-size: 12px; color: var(--text-light);">
                                Status: <span style="color: ${getGaugeColorWithLimits(blankValue, limits)}; font-weight: 600;">${getStatusTextByValueWithLimits(blankValue, limits)}</span>
                            </div>
                            <div style="margin-top: 10px;">
                                <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${(blankValue / 20) * 100}%; background: ${getGaugeColorWithLimits(blankValue, limits)};"></div>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-light); margin-top: 5px;">
                                    <span>0</span>
                                    <span>10</span>
                                    <span>20</span>
                                    <span>30</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; color: var(--text);">Neck Rings</span>
                                <span style="font-size: 24px; font-weight: 800; color: var(--neckring)">${neckringValue}</span>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; color: var(--text);">Funís</span>
                                <span style="font-size: 24px; font-weight: 800; color: var(--funil)">${funilValue}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px;">
                    <h4 style="font-size: 14px; margin-bottom: 10px; color: var(--text); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-sliders-h"></i> Limites de Estoque
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px;">
                        <div style="text-align: center;">
                            <div style="font-weight: 600; color: var(--danger);">Baixa Reserva</div>
                            <div style="font-size: 16px; font-weight: 800;">≤ ${limits.CRITICO}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-weight: 600; color: var(--warning);">Baixo Estoque</div>
                            <div style="font-size: 16px; font-weight: 800;">${limits.CRITICO + 1}-${limits.BAIXO}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-weight: 600; color: var(--success);">Bem Abastecido</div>
                            <div style="font-size: 16px; font-weight: 800;">≥ ${limits.NORMAL}</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 10px; margin-top: 25px;">
                <button class="btn" onclick="closeMachineModal()" style="flex: 1;">
                    <i class="fas fa-times"></i> Fechar
                </button>
                <button class="btn" onclick="refreshMachineData('${machineId}')" style="flex: 1; background: var(--primary); color: white;">
                    <i class="fas fa-sync-alt"></i> Atualizar
                </button>
                ${!isInMaintenance ? `
                    <button class="btn" onclick="window.location.href='admin.html?machine=${machineId}'" style="flex: 1; background: var(--secondary); color: white;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

// ================= CARREGAR HISTÓRICO =================
async function loadMachineHistory(machineId) {
    try {
        if (typeof historicoRef === 'undefined') return [];
        
        const snapshot = await historicoRef.child(machineId).orderByChild('timestamp').limitToLast(10).once('value');
        const historyData = snapshot.val();
        
        if (!historyData) return [];
        
        return Object.values(historyData)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);
    } catch (error) {
        console.error("❌ Erro ao carregar histórico:", error);
        return [];
    }
}

// ================= FUNÇÃO getFornoFromMachineId CORRIGIDA =================
function getFornoFromMachineId(machineId) {
    if (!machineId) return null;
    
    // Verificar se começa com letra
    const firstChar = machineId.charAt(0);
    
    if (firstChar === 'A' || firstChar === 'B' || firstChar === 'C') {
        return firstChar;
    }
    
    // Verificar se é número entre 10-15
    const num = parseInt(machineId);
    if (!isNaN(num) && num >= 10 && num <= 15) {
        return 'D';
    }
    
    // Verificar se é string dos números 10-15
    if (['10','11','12','13','14','15'].includes(machineId)) {
        return 'D';
    }
    
    return null;
}

// ================= DEBUG DOS FILTROS =================
window.debugFilters = function() {
    console.log("=== DEBUG DOS FILTROS ===");
    console.log("activeFilters:", activeFilters);
    console.log("Total máquinas:", Object.keys(allMachinesData).length);
    console.log("Máquinas filtradas:", Object.keys(filteredMachinesData).length);
    
    // Testar algumas máquinas
    const testMachines = ['A1', 'B2', 'C3', '10', '11', '15'];
    testMachines.forEach(machineId => {
        const forno = getFornoFromMachineId(machineId);
        console.log(`Máquina ${machineId} → Forno: ${forno}`);
    });
    
    // Verificar botões ativos
    const fornoButtons = document.querySelectorAll('.filter-btn[data-forno]');
    fornoButtons.forEach(btn => {
        console.log(`Botão Forno ${btn.getAttribute('data-forno')}: ${btn.classList.contains('active') ? 'ATIVO' : 'inativo'}`);
    });
};

// ================= FECHAR MODAL =================
function closeMachineModal() {
    const modal = document.getElementById('machineModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function refreshMachineData(machineId) {
    console.log(`🔄 Atualizando dados da máquina ${machineId}`);
    
    if (typeof maquinasRef === 'undefined') return;
    
    maquinasRef.child(machineId).once("value").then(snapshot => {
        const data = snapshot.val();
        if (data) {
            allMachinesData[machineId] = data;
            
            applyFilters();
            openMachineDetails(machineId);
            
            const modalBody = document.getElementById('modalBody');
            if (modalBody) {
                const feedback = document.createElement('div');
                feedback.innerHTML = `
                    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 6px; border-left: 4px solid var(--success); margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                            <i class="fas fa-check-circle" style="color: var(--success);"></i>
                            Dados atualizados com sucesso!
                        </div>
                    </div>
                `;
                modalBody.insertBefore(feedback, modalBody.firstChild);
                
                setTimeout(() => {
                    if (feedback.parentNode) {
                        feedback.parentNode.removeChild(feedback);
                    }
                }, 3000);
            }
        }
    });
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
    console.log("🔧 Configurando event listeners...");
    
    setInterval(() => {
        if (Object.keys(allMachinesData).length > 0) {
            if (typeof updateLastUpdateTime === 'function') {
                updateLastUpdateTime();
            }
        }
    }, 30000);
    
    const modal = document.getElementById('machineModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeMachineModal();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMachineModal();
        }
    });
    
    // Configurar redimensionamento para atualizar medidores
    window.addEventListener('resize', function() {
        if (Object.keys(allMachinesData).length > 0) {
            setTimeout(() => {
                Object.keys(allMachinesData).forEach(machineId => {
                    const machineData = allMachinesData[machineId];
                    const limits = machineLimits[machineId] || DEFAULT_LIMITS;
                    const isInMaintenance = machineMaintenance[machineId]?.isInMaintenance || false;
                    
                    if (!isInMaintenance) {
                        const moldeValue = machineData.molde || 0;
                        const blankValue = machineData.blank || 0;
                        
                        const moldeColor = getGaugeColorWithLimits(moldeValue, limits);
                        const blankColor = getGaugeColorWithLimits(blankValue, limits);
                        
                        if (typeof createCircularGauge === 'function') {
                            createCircularGauge(`gauge-molde-${machineId}`, moldeValue, moldeColor);
                            createCircularGauge(`gauge-blank-${machineId}`, blankValue, blankColor);
                        }
                    }
                });
            }, 100);
        }
    });
    
    console.log("✅ Event listeners configurados");
}

// ================= FUNÇÕES AUXILIARES =================
function getGaugeColorWithLimits(value, limits) {
    if (!limits) return '#10b981';
    
    if (value <= limits.CRITICO) {
        return '#ef4444';
    } else if (value <= limits.BAIXO) {
        return '#f59e0b';
    } else {
        return '#10b981';
    }
}

function createCircularGauge(canvasId, value, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`⚠️ Canvas não encontrado: ${canvasId}`);
        return;
    }
    
    // Verificar se já existe um contexto para este canvas
    if (canvas._chart) {
        canvas._chart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 45;
    const maxValue = 20;
    
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar fundo do medidor - CORRIGIDO para modo escuro
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    
    // Definir cor do contorno baseada no tema
    let borderColor;
    if (document.body.classList.contains('dark-mode')) {
        borderColor = '#1e293b'; // Cinza escuro para modo dark
    } else {
        borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    }
    
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Calcular ângulo baseado no valor
    const progress = Math.min(value / maxValue, 1);
    const startAngle = Math.PI / 2; // 18:00
    const endAngle = Math.PI * 2 * progress + startAngle;
    
    // Desenhar progresso
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Adicionar ponto no final do progresso
    const pointAngle = endAngle;
    const pointX = centerX + radius * Math.cos(pointAngle);
    const pointY = centerY + radius * Math.sin(pointAngle);
    
    ctx.beginPath();
    ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Também corrigir a borda do ponto para modo escuro
    let pointBorderColor = 'white';
    if (document.body.classList.contains('dark-mode')) {
        pointBorderColor = '#e2e8f0'; // Cinza claro para o ponto no modo escuro
    }
    
    ctx.strokeStyle = pointBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Armazenar referência para limpeza posterior
    canvas._chart = { destroy: () => {} };
}

// ================= FUNÇÕES AUXILIARES PARA FILTROS =================
function clearAllFilters() {
    console.log("🧹 Limpando todos os filtros");
    
    const searchInput = document.getElementById('machineSearch');
    if (searchInput) searchInput.value = '';
    
    if (typeof activeFilters !== 'undefined') {
        activeFilters.fornos = [];
        activeFilters.status = null;
        activeFilters.search = '';
    }
    
    // Remover active de todos os botões de filtro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (typeof applyFilters === 'function') {
        applyFilters();
    }
}

// ================= FUNÇÕES DE REFRESH =================
function refreshData() {
    console.log("🔄 Atualizando dados manualmente...");
    
    const btn = document.getElementById('refreshBtn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    
    // Feedback visual
    btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Atualizando...';
    btn.disabled = true;
    
    // Forçar atualização do Firebase
    if (typeof maquinasRef !== 'undefined') {
        maquinasRef.once("value").then(snapshot => {
            const data = snapshot.val();
            if (data) {
                allMachinesData = data;
                
                applyFilters();
                updateStatistics();
                
                if (typeof updateLastUpdateTime === 'function') {
                    updateLastUpdateTime();
                }
                
                // Feedback de sucesso
                btn.innerHTML = '<i class="fas fa-check"></i> Atualizado!';
                btn.style.background = 'var(--success)';
                btn.style.color = 'white';
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = '';
                    btn.style.color = '';
                    btn.disabled = false;
                }, 1500);
                
                console.log("✅ Dados atualizados manualmente");
            }
        }).catch(error => {
            console.error("❌ Erro ao atualizar dados:", error);
            
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro!';
            btn.style.background = 'var(--danger)';
            btn.style.color = 'white';
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
                btn.style.color = '';
                btn.disabled = false;
            }, 2000);
        });
    } else {
        console.error("❌ maquinasRef não está definido");
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// ================= FUNÇÃO ATUALIZADA PARA OBTER LIMITES =================

/**
 * Obtém os limites de uma máquina considerando seu tipo de processo
 */
function getMachineLimitsWithProcess(machineId) {
    // 1. Tenta obter limites individuais salvos
    if (machineLimits[machineId]) {
        return machineLimits[machineId];
    }
    
    // 2. Tenta obter limites pelo tipo de processo
    if (typeof window.getMachineLimitsByProcess === 'function' && 
        window.prefixDatabase && machinePrefixes) {
        
        const processLimits = window.getMachineLimitsByProcess(
            machineId, 
            window.prefixDatabase, 
            machinePrefixes
        );
        
        if (processLimits) {
            return processLimits;
        }
    }
    
    // 3. Retorna limites padrão
    return DEFAULT_LIMITS;
}

// Substitua todas as chamadas para machineLimits[machineId] por:
// getMachineLimitsWithProcess(machineId)

// ================= EXPORTAR FUNÇÕES PARA USO GLOBAL =================
window.initCardsDashboard = initCardsDashboard;
window.generateFornoSections = generateFornoSections;
window.scrollFornoLeft = scrollFornoLeft;
window.scrollFornoRight = scrollFornoRight;
window.updateCarouselControls = updateCarouselControls;
window.getMachinesByForno = getMachinesByForno;
window.openMachineDetails = openMachineDetails;
window.closeMachineModal = closeMachineModal;
window.refreshMachineData = refreshMachineData;
window.refreshData = refreshData;
window.clearAllFilters = clearAllFilters;
window.getGaugeColorWithLimits = getGaugeColorWithLimits;
window.createCircularGauge = createCircularGauge;
window.applyFilters = applyFilters;
window.loadMachineMaintenance = loadMachineMaintenance;

// ================= DEBUG =================
function debugFilters() {
    console.log("=== DEBUG DOS FILTROS ===");
    console.log("activeFilters:", activeFilters);
    console.log("Todas máquinas:", Object.keys(allMachinesData).length);
    console.log("Máquinas filtradas:", Object.keys(filteredMachinesData).length);
    
    // Verificar algumas máquinas
    const sampleMachines = Object.keys(allMachinesData).slice(0, 3);
    sampleMachines.forEach(machineId => {
        const forno = getFornoFromMachineId(machineId);
        console.log(`Máquina ${machineId}: Forno=${forno}`);
    });
}

// Exportar para depuração
window.debugFilters = debugFilters;
