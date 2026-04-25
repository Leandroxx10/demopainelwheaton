// ================= SCRIPT DO PAINEL ADMINISTRATIVO =================

// Configurações
const IMGBB_API_KEY = "2a25342d2ee5a8abc7c249f07f874799";
let allAdminMachines = {};
let adminLimits = {};
let adminPrefixes = {};
let adminComments = {};
let adminImages = {};
let adminMaintenance = {};
let prefixDatabase = {}; // Banco de prefixos detalhados
let currentMachineLimits = {};
let currentSelectedMachine = '';
let isAdminInitialized = false;
let machinePrefixes = adminPrefixes;

// ================= FUNÇÕES AUXILIARES SEGURAS =================
function safeGetElement(id) {
    try {
        const element = document.getElementById(id);
        return element;
    } catch (error) {
        console.warn(`⚠️ Não foi possível obter elemento: ${id}`, error);
        return null;
    }
}

function safeToggleElement(id) {
    try {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`⚠️ Elemento não encontrado para toggle: ${id}`);
            return false;
        }
        
        const isVisible = element.style.display !== 'none';
        element.style.display = isVisible ? 'none' : 'block';
        return true;
    } catch (error) {
        console.error(`❌ Erro ao alternar elemento ${id}:`, error);
        return false;
    }
}

// ================= INICIALIZAÇÃO =================
function initAdminPanel() {
    console.log("🚀 Iniciando Painel Administrativo...");
    
    if (isAdminInitialized) {
        console.log("⚠️ Painel já inicializado");
        return;
    }
    
    isAdminInitialized = true;
    
    // Atualizar status de conexão
    updateAdminConnectionStatus('loading', 'Carregando dados...');
    
    // Configurar navegação
    setupNavigation();
    
    // Configurar event listeners
    setupAdminEventListeners();
    
    // Carregar todos os dados (incluindo prefixos detalhados primeiro)
    loadAllData();
    
    // Verificar URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const machineParam = urlParams.get('machine');
    
    // Se houver parâmetro de máquina, mostrar seção de máquinas
    if (machineParam) {
        setTimeout(() => {
            showSection('machines');
            setTimeout(() => {
                const machineCard = document.querySelector(`[data-machine-id="${machineParam}"]`);
                if (machineCard) {
                    machineCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    machineCard.style.boxShadow = '0 0 0 3px var(--primary)';
                    setTimeout(() => {
                        machineCard.style.boxShadow = '';
                    }, 3000);
                }
            }, 500);
        }, 1000);
    }
}

// ================= NAVEGAÇÃO =================
function setupNavigation() {
    const menuLinks = document.querySelectorAll('.admin-menu a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            showSection(target);
        });
    });
}

function showSection(sectionId) {
    console.log(`📁 Mostrando seção: ${sectionId}`);
    
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.admin-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    const section = document.getElementById(`${sectionId}-section`);
    if (section) {
        section.classList.add('active');
    }
    
    const menuLink = document.querySelector(`.admin-menu a[href="#${sectionId}"]`);
    if (menuLink) {
        menuLink.classList.add('active');
    }
    
    loadSectionData(sectionId);
}

function loadSectionData(sectionId) {
    console.log(`📂 Carregando dados da seção: ${sectionId}`);
    
    switch(sectionId) {
        case 'limits':
            // Aguarda um momento para garantir que os dados estão carregados
            setTimeout(() => {
                if (Object.keys(allAdminMachines).length > 0) {
                    const machines = Object.keys(allAdminMachines);
                    if (machines.length > 0) {
                        const firstMachine = machines[0];
                        const select = document.getElementById('limitsMachineSelect');
                        if (select) {
                            select.value = firstMachine;
                        }
                        // Carrega os limites usando o sistema de processo
                        if (typeof loadMachineLimitsByProcess === 'function') {
                            loadMachineLimitsByProcess();
                        }
                    }
                }
            }, 500);
            break;
        case 'machines':
            renderAdminMachines();
            break;
        case 'prefixes':
            renderPrefixesTable();
            break;
        case 'detailed-prefixes':
            // Inicializa o prefix manager se necessário
            if (typeof initPrefixManager === 'function') {
                initPrefixManager();
            }
            break;
        case 'comments':
            renderCommentsList();
            break;
        case 'images':
            renderImagesGrid();
            break;
    }
}

// ================= CARREGAR DADOS =================
function loadAllData() {
    console.log("📊 Carregando todos os dados...");
    
    // Inicializa as variáveis globais primeiro
    window.allAdminMachines = allAdminMachines;
    window.adminPrefixes = adminPrefixes;
    window.adminLimits = adminLimits;
    window.prefixDatabase = prefixDatabase;
    
    // Carregar máquinas
    maquinasRef.on("value", (snapshot) => {
        allAdminMachines = snapshot.val() || {};
        window.allAdminMachines = allAdminMachines;
        console.log("✅ Máquinas carregadas:", Object.keys(allAdminMachines).length);
        
        updateAdminConnectionStatus('connected', 'Conectado');
        
        // Preencher dropdowns
        populateMachineDropdowns();
        
        // Renderizar seção atual
        const activeSection = document.querySelector('.admin-section.active');
        if (activeSection) {
            const sectionId = activeSection.id.replace('-section', '');
            loadSectionData(sectionId);
        } else {
            showSection('limits');
        }
    }, (error) => {
        console.error("❌ Erro ao carregar máquinas:", error);
        updateAdminConnectionStatus('error', 'Erro de conexão');
        showAlert('erro', 'Erro ao carregar máquinas. Verifique a conexão.');
    });
    
    // Carregar limites individuais
    adminConfigRef.child("machineLimits").on("value", (snapshot) => {
        const limits = snapshot.val() || {};
        adminLimits = limits;
        window.adminLimits = adminLimits;
        console.log("✅ Limites individuais carregados:", Object.keys(adminLimits).length);
    });
    
    // Carregar prefixos (relacionamento máquina -> prefixoGrande)
    adminConfigRef.child("prefixes").on("value", (snapshot) => {
        adminPrefixes = snapshot.val() || {};
        window.adminPrefixes = adminPrefixes;
        console.log("✅ Prefixos (relacionamentos) carregados:", Object.keys(adminPrefixes).length);
    });
    
    // Carregar comentários
    comentariosRef.on("value", (snapshot) => {
        adminComments = snapshot.val() || {};
        console.log("✅ Comentários carregados:", Object.keys(adminComments).length);
    });
    
    // Carregar imagens
    imagensRef.on("value", (snapshot) => {
        adminImages = snapshot.val() || {};
        console.log("✅ Imagens carregadas:", Object.keys(adminImages).length);
    });
    
    // Carregar status de manutenção
    manutencaoRef.on("value", (snapshot) => {
        adminMaintenance = snapshot.val() || {};
        console.log("✅ Status de manutenção carregados:", Object.keys(adminMaintenance).length);
        
        if (document.querySelector('#machines-section.active')) {
            renderAdminMachines();
        }
    });
    
    // Carregar banco de prefixos detalhados (CRÍTICO - PRIMEIRO!)
    if (typeof db !== 'undefined') {
        const prefixRef = db.ref("prefixDatabase");
        prefixRef.on("value", (snapshot) => {
            prefixDatabase = snapshot.val() || {};
            window.prefixDatabase = prefixDatabase;
            console.log("✅ Banco de prefixos detalhados carregado:", Object.keys(prefixDatabase).length);
            
            // Atualiza a tabela de prefixos detalhados se a seção estiver ativa
            if (document.querySelector('#detailed-prefixes-section.active')) {
                if (typeof renderPrefixTable === 'function') {
                    setTimeout(() => renderPrefixTable(), 100);
                }
            }
            
            // Atualiza a interface de limites por processo
            if (document.querySelector('#limits-section.active')) {
                setTimeout(() => {
                    const machineSelect = document.getElementById('limitsMachineSelect');
                    if (machineSelect && machineSelect.value) {
                        if (typeof loadMachineLimitsByProcess === 'function') {
                            loadMachineLimitsByProcess();
                        }
                    }
                }, 300);
            }
            
        }, (error) => {
            console.error("❌ Erro ao carregar banco de prefixos:", error);
        });
    }
}

function updateAdminConnectionStatus(status, message) {
    const statusEl = document.getElementById('adminConnectionStatus');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    
    switch(status) {
        case 'connected':
            statusEl.style.color = 'var(--success)';
            break;
        case 'loading':
            statusEl.style.color = 'var(--warning)';
            break;
        case 'error':
            statusEl.style.color = 'var(--danger)';
            break;
        default:
            statusEl.style.color = 'var(--text)';
    }
}

// ================= PREENCHER DROPDOWNS =================
function populateMachineDropdowns() {
    const machines = Object.keys(allAdminMachines).sort();
    console.log("📝 Preenchendo dropdowns com", machines.length, "máquinas");
    
    const dropdownIds = [
        'limitsMachineSelect',
        'prefixMachine',
        'commentMachine',
        'imageMachine'
    ];
    
    dropdownIds.forEach(dropdownId => {
        const select = document.getElementById(dropdownId);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione uma máquina</option>';
        
        machines.forEach(machineId => {
            const option = document.createElement('option');
            option.value = machineId;
            option.textContent = `Máquina ${machineId}`;
            select.appendChild(option);
        });
        
        if (currentValue && machines.includes(currentValue)) {
            select.value = currentValue;
        }
        
        if (dropdownId === 'limitsMachineSelect' && !currentValue && machines.length > 0) {
            select.value = machines[0];
            setTimeout(() => {
                if (typeof loadMachineLimitsByProcess === 'function') {
                    loadMachineLimitsByProcess();
                }
            }, 100);
        }
    });
}

// ================= NOVAS FUNÇÕES PARA LIMITES POR PROCESSO =================

/**
 * Carrega limites baseados no tipo de processo da máquina (SIMPLIFICADO)
 */
function loadMachineLimitsByProcess() {
    const machineSelect = document.getElementById('limitsMachineSelect');
    const selectedMachine = machineSelect ? machineSelect.value : '';
    
    console.log(`⚙️ Carregando limites por processo para máquina: ${selectedMachine}`);
    console.log(`📊 Dados disponíveis:`, {
        prefixDatabase: prefixDatabase ? Object.keys(prefixDatabase).length : 0,
        adminPrefixes: adminPrefixes ? Object.keys(adminPrefixes).length : 0,
        allAdminMachines: allAdminMachines ? Object.keys(allAdminMachines).length : 0
    });
    
    if (!selectedMachine) {
        showNoMachineSelectedMessage();
        return;
    }
    
    // Limpa exibição anterior
    const display = document.getElementById('processLimitsDisplay');
    if (display) {
        display.innerHTML = '';
    }
    
    // Atualiza a tabela de referência
    if (typeof updateProcessLimitsReferenceTable === 'function') {
        updateProcessLimitsReferenceTable();
    }
    
    // Usa a nova função do process-limits.js
    if (typeof loadProcessLimitsForMachine === 'function') {
        console.log(`📤 Chamando loadProcessLimitsForMachine para ${selectedMachine}`);
        loadProcessLimitsForMachine(selectedMachine);
    } else {
        console.error("❌ loadProcessLimitsForMachine não está definido");
        // Fallback: mostra mensagem de erro
        showNoMachineSelectedMessage();
    }
}

/**
 * Mostra mensagem quando nenhuma máquina está selecionada
 */
function showNoMachineSelectedMessage() {
    const display = document.getElementById('processLimitsDisplay');
    if (!display) return;
    
    display.innerHTML = `
        <div style="background: rgba(100, 116, 139, 0.1); padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 25px; border: 2px dashed var(--border);">
            <i class="fas fa-industry" style="font-size: 48px; color: var(--text-light); margin-bottom: 15px;"></i>
            <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 18px;">
                Selecione uma Máquina
            </h4>
            <p style="margin: 0; color: var(--text-light); font-size: 14px;">
                Selecione uma máquina na lista acima para visualizar seus limites de processo.
            </p>
        </div>
    `;
}

/**
 * Redefine para os limites padrão (DG)
 */
function resetToDefaultProcessLimits() {
    if (confirm('Redefinir limites para os valores padrão (DG - Vidro Duplo)?')) {
        const defaultLimits = getLimitsByProcessType('DG');
        
        document.getElementById('limitCritico').value = defaultLimits.CRITICO;
        document.getElementById('limitBaixo').value = defaultLimits.BAIXO;
        document.getElementById('limitNormal').value = defaultLimits.NORMAL;
        
        updateLimitPreviews();
        showAlert('info', 'Limites redefinidos para padrão (DG)');
    }
}

/**
 * Atualiza a tabela de referência de limites por processo
 */
function updateProcessLimitsReferenceTable() {
    const tableBody = document.getElementById('processLimitsTable');
    if (!tableBody) return;
    
    const processTypes = getAllProcessTypes();
    
    let html = '';
    processTypes.forEach(processType => {
        const processInfo = getProcessTypeInfo(processType);
        if (!processInfo) return;
        
        html += `
            <tr>
                <td style="font-weight: 700; color: ${processInfo.color};">${processInfo.type}</td>
                <td>${processInfo.name}</td>
                <td style="font-weight: 600; color: var(--danger);">≤ ${processInfo.limits.CRITICO}</td>
                <td style="font-weight: 600; color: var(--warning);">${processInfo.limits.CRITICO + 1}-${processInfo.limits.BAIXO}</td>
                <td style="font-weight: 600; color: var(--success);">≥ ${processInfo.limits.NORMAL}</td>
                <td style="font-size: 13px; color: var(--text-light);">${processInfo.description}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// ================= INICIALIZAÇÃO DO SISTEMA DE PROCESSOS =================

function initProcessLimitsSystem() {
    console.log("🔧 Inicializando sistema de limites por processo...");
    
    // Garante que as variáveis globais estão disponíveis
    window.adminPrefixes = adminPrefixes;
    window.adminLimits = adminLimits;
    window.allAdminMachines = allAdminMachines;
    window.prefixDatabase = prefixDatabase;
    
    // Atualiza a tabela de referência
    if (typeof updateProcessLimitsReferenceTable === 'function') {
        updateProcessLimitsReferenceTable();
    }
    
    // Verifica se há uma máquina selecionada e carrega seus limites
    const machineSelect = document.getElementById('limitsMachineSelect');
    if (machineSelect && machineSelect.value) {
        setTimeout(() => {
            if (typeof loadMachineLimitsByProcess === 'function') {
                loadMachineLimitsByProcess();
            }
        }, 1000);
    }
    
    console.log("✅ Sistema de limites por processo inicializado");
}

// ================= GERENCIAR MÁQUINAS =================
function renderAdminMachines(filteredMachines = null) {
    const machinesGrid = document.getElementById('machinesGrid');
    if (!machinesGrid) {
        console.error("❌ Container de máquinas não encontrado");
        return;
    }
    
    const machinesToRender = filteredMachines || allAdminMachines;
    const machines = Object.keys(machinesToRender).sort();
    
    console.log(`🖨️  Renderizando ${machines.length} máquinas`);
    console.log(`📊 Prefixos disponíveis:`, Object.keys(adminPrefixes).length);
    
    if (machines.length === 0) {
        machinesGrid.innerHTML = `
            <div class="no-data-message" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-industry" style="font-size: 60px; color: var(--text-light); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text); margin-bottom: 10px;">Nenhuma máquina encontrada</h3>
                <p style="color: var(--text-light); margin-bottom: 20px;">Verifique os filtros ou a conexão</p>
                <button class="btn" onclick="refreshAdminData()" style="background: var(--primary); color: white;">
                    <i class="fas fa-sync-alt"></i> Recarregar Dados
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    machines.forEach(machineId => {
        const machineData = machinesToRender[machineId];
        const limits = adminLimits[machineId] || DEFAULT_LIMITS;
        const isInMaintenance = adminMaintenance[machineId]?.isInMaintenance || false;
        const maintenanceReason = adminMaintenance[machineId]?.reason || "";
        const status = isInMaintenance ? 'maintenance' : getMachineStatusWithLimits(machineData, limits);
        const forno = getFornoFromMachineId(machineId);
        const prefixKey = adminPrefixes[machineId] || '';
        const comment = adminComments[machineId] || {};
        
        // Obter dados completos do prefixo se existir
        let prefixData = null;
        let prefixDisplay = '';
        if (prefixKey && prefixDatabase && prefixDatabase[prefixKey]) {
            prefixData = prefixDatabase[prefixKey];
            prefixDisplay = `${prefixKey} (${prefixData.processo || 'Sem processo'})`;
        }
        
        const statusText = isInMaintenance ? 'Em Manutenção' : 
                          status === 'critical' ? 'Baixa Reserva' :
                          status === 'warning' ? 'Baixo Estoque' : 'Bem Abastecido';
        
        html += `
            <div class="machine-edit-card" data-machine-id="${machineId}">
                <div class="machine-edit-header">
                    <h3>
                        <i class="fas fa-industry"></i>
                         ${machineId}
                        ${prefixKey ? `<span class="machine-prefix">${prefixKey}</span>` : ''}
                        ${isInMaintenance ? `<span class="maintenance-badge"><i class="fas fa-tools"></i> Manutenção</span>` : ''}
                    </h3>
                    <span class="status-badge ${status}">${statusText}</span>
                </div>
                
                ${isInMaintenance ? `
                    <div class="maintenance-info" style="background: rgba(100, 116, 139, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid var(--secondary);">
                        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">
                            <i class="fas fa-tools"></i> Status de Manutenção:
                        </div>
                        <div style="font-size: 13px; color: var(--text); line-height: 1.4;">
                            ${maintenanceReason ? `<strong>Motivo:</strong> ${maintenanceReason}` : 'Máquina em manutenção'}
                        </div>
                    </div>
                ` : ''}
                
                ${comment.text ? `
                    <div class="quick-comment" style="background: rgba(14, 165, 233, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid var(--primary);">
                        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">
                            <i class="fas fa-comment"></i> Comentário:
                        </div>
                        <div style="font-size: 13px; color: var(--text); line-height: 1.4;">
                            "${comment.text.substring(0, 60)}${comment.text.length > 60 ? '...' : ''}"
                        </div>
                        ${comment.author ? `<div style="font-size: 11px; color: var(--text-light); text-align: right; margin-top: 5px;">— ${comment.author}</div>` : ''}
                    </div>
                ` : ''}
                
                ${prefixData ? `
                    <div class="prefix-info" style="background: rgba(139, 92, 246, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid #8b5cf6;">
                        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">
                            <i class="fas fa-tag"></i> Prefixo Detalhado:
                        </div>
                        <div style="font-size: 13px; color: var(--text); line-height: 1.4;">
                            <strong>${prefixKey}</strong> - ${prefixData.processo || 'Sem processo'}
                            ${prefixData.localizacao?.corredor ? `<br>Local: Corredor ${prefixData.localizacao.corredor}, Prateleira ${prefixData.localizacao.prateleira || 'N/A'}` : ''}
                            ${prefixData.terminacoes?.prefixoMolde ? `<br>Molde: ${prefixData.terminacoes.prefixoMolde}` : ''}
                            ${prefixData.terminacoes?.prefixoBlank ? `<br>Blank: ${prefixData.terminacoes.prefixoBlank}` : ''}
                        </div>
                    </div>
                ` : ''}
                
                ${!isInMaintenance ? `
                    <div class="equipment-inputs">
                        <div class="input-group">
                            <label>Moldes:</label>
                            <input type="number" id="molde-${machineId}" 
                                   value="${machineData.molde || 0}" min="0" max="50"
                                   onchange="updateMachineValue('${machineId}', 'molde', this.value)">
                        </div>
                        
                        <div class="input-group">
                            <label>Blanks:</label>
                            <input type="number" id="blank-${machineId}" 
                                   value="${machineData.blank || 0}" min="0" max="50"
                                   onchange="updateMachineValue('${machineId}', 'blank', this.value)">
                        </div>
                        
                        <div class="input-group">
                            <label>Neck Rings:</label>
                            <input type="number" id="neckring-${machineId}" 
                                   value="${machineData.neck_ring || 0}" min="0" max="50"
                                   onchange="updateMachineValue('${machineId}', 'neck_ring', this.value)">
                        </div>
                        
                        <div class="input-group">
                            <label>Funís:</label>
                            <input type="number" id="funil-${machineId}" 
                                   value="${machineData.funil || 0}" min="0" max="50"
                                   onchange="updateMachineValue('${machineId}', 'funil', this.value)">
                        </div>
                    </div>
                ` : ''}
                
                <!-- Formulário de manutenção -->
                <div class="quick-edit-form" id="quickMaintenance-${machineId}" style="display: none;">
                    <div class="form-group">
                        <label>Motivo da Manutenção (opcional):</label>
                        <textarea id="quickMaintenanceReason-${machineId}" rows="3" 
                                  placeholder="Descreva o motivo da manutenção...">${maintenanceReason}</textarea>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-small btn-success" onclick="saveQuickMaintenance('${machineId}', true)">
                            <i class="fas fa-tools"></i> Colocar em Manutenção
                        </button>
                        <button class="btn btn-small" onclick="toggleQuickMaintenance('${machineId}')">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
                
                <!-- Formulário de prefixo COM SELECT -->
                <div class="quick-edit-form" id="quickPrefix-${machineId}" style="display: none;">
                    <div class="form-group">
                        <label>Selecionar Prefixo Detalhado:</label>
                        <select id="quickPrefixSelect-${machineId}" class="search-input">
                            <!-- Opções serão preenchidas dinamicamente -->
                        </select>
                        <div style="font-size: 11px; color: var(--text-light); margin-top: 5px;">
                            <i class="fas fa-info-circle"></i> Os prefixos são carregados da seção "Prefixos Detalhados"
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-small btn-success" onclick="saveQuickPrefix('${machineId}')">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                        <button class="btn btn-small" onclick="removeMachinePrefix('${machineId}')">
                            <i class="fas fa-trash"></i> Remover
                        </button>
                        <button class="btn btn-small" onclick="toggleQuickPrefix('${machineId}')">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
                
                <!-- Formulário de comentário -->
                <div class="quick-edit-form" id="quickComment-${machineId}" style="display: none;">
                    <div class="form-group">
                        <label>Adicionar Comentário:</label>
                        <textarea id="quickCommentInput-${machineId}" rows="3" 
                                  placeholder="Digite um comentário...">${comment.text || ''}</textarea>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-small btn-success" onclick="saveQuickComment('${machineId}')">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                        <button class="btn btn-small" onclick="toggleQuickComment('${machineId}')">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
                
                <div class="machine-edit-actions">
                    ${!isInMaintenance ? `
                        <button class="btn btn-success" onclick="saveMachineChanges('${machineId}')">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                        <button class="btn" onclick="resetMachineValues('${machineId}')">
                            <i class="fas fa-undo"></i> Redefinir
                        </button>
                    ` : ''}
                    
                    <button class="btn" onclick="showMachineDetails('${machineId}')">
                        <i class="fas fa-info-circle"></i> Detalhes
                    </button>
                    
                    ${!isInMaintenance ? `
                        <button class="btn btn-warning" onclick="configureMachineLimits('${machineId}')">
                            <i class="fas fa-sliders-h"></i> Limites
                        </button>
                        <button class="btn" onclick="toggleQuickPrefix('${machineId}')">
                            <i class="fas fa-tag"></i> Prefixo
                        </button>
                        <button class="btn" onclick="toggleQuickComment('${machineId}')">
                            <i class="fas fa-comment"></i> Comentário
                        </button>
                    ` : ''}
                    
                    ${isInMaintenance ? `
                        <button class="btn btn-success" onclick="setMaintenanceStatus('${machineId}', false)">
                            <i class="fas fa-play-circle"></i> Retomar
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="toggleQuickMaintenance('${machineId}')">
                            <i class="fas fa-tools"></i> Manutenção
                        </button>
                    `}
                </div>
            </div>
        `;
    });
    
    machinesGrid.innerHTML = html;
}

// ================= FUNÇÕES DE PREFIXO COM SELECT =================
function toggleQuickPrefix(machineId) {
    console.log(`🏷️ Alternando formulário de prefixo para máquina ${machineId}`);
    
    const formId = `quickPrefix-${machineId}`;
    const form = document.getElementById(formId);
    
    if (!form) {
        console.log(`⚠️ Formulário ${formId} não encontrado`);
        return;
    }
    
    const isCurrentlyVisible = form.style.display !== 'none';
    form.style.display = isCurrentlyVisible ? 'none' : 'block';
    
    if (!isCurrentlyVisible) {
        loadPrefixSelect(machineId);
    }
    
    document.querySelectorAll('.quick-edit-form').forEach(otherForm => {
        if (otherForm.id !== formId) {
            otherForm.style.display = 'none';
        }
    });
}

function loadPrefixSelect(machineId) {
    console.log(`📋 Carregando select de prefixos para máquina ${machineId}`);
    console.log(`📊 PrefixDatabase disponível:`, prefixDatabase ? Object.keys(prefixDatabase).length : 0);
    
    const prefixSelect = document.getElementById(`quickPrefixSelect-${machineId}`);
    if (!prefixSelect) return;
    
    prefixSelect.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Selecione um prefixo...';
    prefixSelect.appendChild(defaultOption);
    
    if (prefixDatabase && Object.keys(prefixDatabase).length > 0) {
        const sortedPrefixes = Object.keys(prefixDatabase).sort();
        
        sortedPrefixes.forEach(prefixKey => {
            const option = document.createElement('option');
            option.value = prefixKey;
            const prefixData = prefixDatabase[prefixKey];
            const processInfo = prefixData.processo ? ` (${prefixData.processo})` : '';
            const locationInfo = prefixData.localizacao?.corredor ? ` - C${prefixData.localizacao.corredor}` : '';
            option.textContent = `${prefixKey}${processInfo}${locationInfo}`;
            prefixSelect.appendChild(option);
        });
        
        const currentPrefix = adminPrefixes[machineId];
        if (currentPrefix && prefixDatabase[currentPrefix]) {
            prefixSelect.value = currentPrefix;
        }
        
        console.log(`✅ ${sortedPrefixes.length} prefixos carregados no select`);
    } else {
        const noOption = document.createElement('option');
        noOption.value = '';
        noOption.textContent = 'Nenhum prefixo cadastrado. Use a seção "Prefixos Detalhados"';
        prefixSelect.appendChild(noOption);
        prefixSelect.disabled = true;
        console.log(`⚠️ prefixDatabase vazio ou não disponível`);
    }
}

function saveQuickPrefix(machineId) {
    console.log(`🏷️ Salvando prefixo rápido para máquina ${machineId}`);
    
    const prefixSelect = document.getElementById(`quickPrefixSelect-${machineId}`);
    if (!prefixSelect) return;
    
    const prefixKey = prefixSelect.value;
    
    if (!prefixKey) {
        showAlert('erro', 'Selecione um prefixo');
        return;
    }
    
    if (!prefixDatabase || !prefixDatabase[prefixKey]) {
        showAlert('erro', 'Prefixo não encontrado no banco de dados. Verifique a seção "Prefixos Detalhados"');
        return;
    }
    
    adminConfigRef.child("prefixes").child(machineId).set(prefixKey)
        .then(() => {
            adminPrefixes[machineId] = prefixKey;
            showAlert('sucesso', `Prefixo "${prefixKey}" atribuído à máquina ${machineId}!`);
            toggleQuickPrefix(machineId);
            
            // Atualiza a máquina para mostrar o novo prefixo
            setTimeout(() => {
                renderAdminMachines();
            }, 500);
        })
        .catch(error => {
            console.error("❌ Erro ao salvar prefixo rápido:", error);
            showAlert('erro', `Erro ao salvar prefixo: ${error.message}`);
        });
}

function removeMachinePrefix(machineId) {
    console.log(`🗑️ Removendo prefixo da máquina ${machineId}`);
    
    if (!adminPrefixes[machineId]) {
        showAlert('info', 'Esta máquina não tem prefixo atribuído');
        return;
    }
    
    if (!confirm(`Remover prefixo "${adminPrefixes[machineId]}" da máquina ${machineId}?`)) {
        return;
    }
    
    adminConfigRef.child("prefixes").child(machineId).remove()
        .then(() => {
            delete adminPrefixes[machineId];
            showAlert('sucesso', `Prefixo removido da máquina ${machineId}!`);
            toggleQuickPrefix(machineId);
            
            setTimeout(() => {
                renderAdminMachines();
            }, 500);
        })
        .catch(error => {
            console.error("❌ Erro ao remover prefixo:", error);
            showAlert('erro', `Erro ao remover prefixo: ${error.message}`);
        });
}

// ================= FUNÇÕES DE MANUTENÇÃO =================
function toggleQuickMaintenance(machineId) {
    console.log(`🔧 Alternando formulário de manutenção para máquina ${machineId}`);
    
    const formId = `quickMaintenance-${machineId}`;
    const form = document.getElementById(formId);
    
    if (!form) {
        console.log(`⚠️ Formulário ${formId} não encontrado`);
        return;
    }
    
    const isCurrentlyVisible = form.style.display !== 'none';
    form.style.display = isCurrentlyVisible ? 'none' : 'block';
    
    document.querySelectorAll('.quick-edit-form').forEach(otherForm => {
        if (otherForm.id !== formId) {
            otherForm.style.display = 'none';
        }
    });
}

async function saveQuickMaintenance(machineId, startMaintenance) {
    console.log(`🔧 Salvando status de manutenção para máquina ${machineId}: ${startMaintenance ? 'Manutenção' : 'Produção'}`);
    
    let reason = "";
    try {
        const reasonElement = document.querySelector(`#quickMaintenanceReason-${machineId}`);
        if (reasonElement) {
            reason = reasonElement.value.trim();
        }
    } catch (error) {
        console.warn(`⚠️ Não foi possível obter motivo da manutenção:`, error);
        reason = "";
    }
    
    if (startMaintenance && reason.trim() === "") {
        const confirmMessage = "Você não informou um motivo. Deseja colocar em manutenção sem motivo?";
        if (!confirm(confirmMessage)) {
            return;
        }
    }
    
    try {
        console.log(`📝 Enviando dados para Firebase:`, { machineId, startMaintenance, reason });
        
        const success = await setMachineMaintenance(machineId, startMaintenance, reason);
        
        if (success) {
            const action = startMaintenance ? 'colocada em manutenção' : 'retomada da produção';
            const message = `Máquina ${machineId} ${action} com sucesso!`;
            
            console.log(`✅ ${message}`);
            
            adminMaintenance[machineId] = {
                isInMaintenance: startMaintenance,
                reason: reason,
                startedAt: startMaintenance ? Date.now() : null,
                startedBy: 'Administrador',
                updatedAt: Date.now()
            };
            
            try {
                const form = document.querySelector(`#quickMaintenance-${machineId}`);
                if (form) {
                    form.style.display = 'none';
                }
            } catch (formError) {
                console.warn(`⚠️ Não foi possível fechar formulário:`, formError);
            }
            
            showAlert('sucesso', message);
            
            setTimeout(() => {
                renderAdminMachines();
            }, 500);
            
        } else {
            showAlert('erro', 'Erro ao atualizar status de manutenção no banco de dados');
        }
    } catch (error) {
        console.error("❌ Erro ao atualizar manutenção:", error);
        showAlert('erro', `Erro ao atualizar manutenção: ${error.message || 'Erro desconhecido'}`);
    }
}

async function setMaintenanceStatus(machineId, isInMaintenance) {
    console.log(`⚙️ Configurando status de manutenção para ${machineId}: ${isInMaintenance}`);
    
    if (isInMaintenance) {
        toggleQuickMaintenance(machineId);
    } else {
        const confirmMessage = `Retomar produção da máquina ${machineId}?`;
        if (confirm(confirmMessage)) {
            try {
                await saveQuickMaintenance(machineId, false);
            } catch (error) {
                console.error("❌ Erro ao retomar produção:", error);
                showAlert('erro', `Erro ao retomar produção: ${error.message}`);
            }
        }
    }
}

// ================= FUNÇÕES DE COMENTÁRIO =================
function toggleQuickComment(machineId) {
    console.log(`💬 Alternando formulário de comentário para máquina ${machineId}`);
    
    const formId = `quickComment-${machineId}`;
    const form = document.getElementById(formId);
    
    if (!form) {
        console.log(`⚠️ Formulário ${formId} não encontrado`);
        return;
    }
    
    const isCurrentlyVisible = form.style.display !== 'none';
    form.style.display = isCurrentlyVisible ? 'none' : 'block';
    
    document.querySelectorAll('.quick-edit-form').forEach(otherForm => {
        if (otherForm.id !== formId) {
            otherForm.style.display = 'none';
        }
    });
}

function saveQuickComment(machineId) {
    console.log(`💬 Salvando comentário rápido para máquina ${machineId}`);
    
    const commentInput = document.getElementById(`quickCommentInput-${machineId}`);
    if (!commentInput) return;
    
    const text = commentInput.value.trim();
    
    if (!text) {
        showAlert('erro', 'Digite um comentário');
        return;
    }
    
    const comment = {
        author: 'Administrador',
        text: text,
        date: Date.now(),
        last_updated: Date.now()
    };
    
    comentariosRef.child(machineId).set(comment)
        .then(() => {
            adminComments[machineId] = comment;
            showAlert('sucesso', `Comentário salvo para máquina ${machineId}`);
            toggleQuickComment(machineId);
            
            renderAdminMachines();
        })
        .catch(error => {
            console.error("❌ Erro ao salvar comentário rápido:", error);
            showAlert('erro', `Erro ao salvar comentário: ${error.message}`);
        });
}

// ================= FUNÇÕES FALTANTES QUE DEVEM SER ADICIONADAS =================
function resetMachineValues(machineId) {
    console.log(`🔄 Redefinindo valores da máquina ${machineId}`);
    
    const isInMaintenance = adminMaintenance[machineId]?.isInMaintenance || false;
    if (isInMaintenance) {
        showAlert('erro', 'Não é possível redefinir valores em máquina em manutenção');
        return;
    }
    
    if (confirm(`Redefinir valores da máquina ${machineId} para os atuais?`)) {
        document.getElementById(`molde-${machineId}`).value = allAdminMachines[machineId].molde || 0;
        document.getElementById(`blank-${machineId}`).value = allAdminMachines[machineId].blank || 0;
        document.getElementById(`neckring-${machineId}`).value = allAdminMachines[machineId].neck_ring || 0;
        document.getElementById(`funil-${machineId}`).value = allAdminMachines[machineId].funil || 0;
        
        showAlert('info', `Valores da máquina ${machineId} redefinidos`);
    }
}

function configureMachineLimits(machineId) {
    console.log(`⚙️ Configurando limites para máquina ${machineId}`);
    
    showSection('limits');
    
    const machineSelect = document.getElementById('limitsMachineSelect');
    if (machineSelect) {
        machineSelect.value = machineId;
        
        setTimeout(() => {
            loadMachineLimitsByProcess();
            
            const limitsSection = document.getElementById('limits-section');
            if (limitsSection) {
                limitsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            showAlert('info', `Configurando limites para Máquina ${machineId}.`);
        }, 100);
    } else {
        console.error("❌ Dropdown de máquinas não encontrado");
        showAlert('erro', 'Erro ao configurar limites. Tente novamente.');
    }
}

function showMachineDetails(machineId) {
    window.open(`index.html?details=${machineId}`, '_blank');
}

// ================= FILTROS =================
function filterAdminMachines() {
    const searchTerm = document.getElementById('adminMachineSearch').value.toLowerCase();
    const fornoFilter = document.getElementById('fornoFilter').value;
    
    console.log(`🔍 Filtrando: busca="${searchTerm}", forno="${fornoFilter}"`);
    
    let filtered = {};
    
    Object.keys(allAdminMachines).forEach(machineId => {
        const machineData = allAdminMachines[machineId];
        let shouldInclude = true;
        
        if (searchTerm) {
            const prefixKey = adminPrefixes[machineId] || '';
            const prefixData = (prefixKey && prefixDatabase) ? prefixDatabase[prefixKey] : null;
            const prefixInfo = prefixData ? 
                `${prefixKey} ${prefixData.processo || ''} ${prefixData.localizacao?.corredor || ''} ${prefixData.localizacao?.prateleira || ''} ${prefixData.terminacoes?.prefixoMolde || ''} ${prefixData.terminacoes?.prefixoBlank || ''}` : '';
            
            const comment = adminComments[machineId]?.text || '';
            const maintenanceReason = adminMaintenance[machineId]?.reason || '';
            const searchIn = `${machineId} ${prefixInfo} ${comment} ${maintenanceReason}`.toLowerCase();
            
            if (!searchIn.includes(searchTerm)) {
                shouldInclude = false;
            }
        }
        
        if (fornoFilter) {
            const forno = getFornoFromMachineId(machineId);
            if (forno !== fornoFilter) {
                shouldInclude = false;
            }
        }
        
        if (shouldInclude) {
            filtered[machineId] = machineData;
        }
    });
    
    console.log(`✅ Filtrados: ${Object.keys(filtered).length} máquinas`);
    renderAdminMachines(filtered);
}

function updateMachineValue(machineId, field, value) {
    const numValue = parseInt(value) || 0;
    
    const isInMaintenance = adminMaintenance[machineId]?.isInMaintenance || false;
    if (isInMaintenance) return;
    
    const card = document.querySelector(`[data-machine-id="${machineId}"]`);
    if (card) {
        const tempData = { ...allAdminMachines[machineId], [field]: numValue };
        const limits = adminLimits[machineId] || DEFAULT_LIMITS;
        const status = getMachineStatusWithLimits(tempData, limits);
        const statusText = status === 'critical' ? 'Baixa Reserva' :
                          status === 'warning' ? 'Baixo Estoque' : 'Bem Abastecido';
        
        const badge = card.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${status}`;
            badge.textContent = statusText;
        }
    }
}

async function saveMachineChanges(machineId) {
    const isInMaintenance = adminMaintenance[machineId]?.isInMaintenance || false;
    if (isInMaintenance) {
        showAlert('erro', 'Não é possível salvar alterações em máquina em manutenção');
        return;
    }
    
    try {
        const molde = parseInt(document.getElementById(`molde-${machineId}`).value) || 0;
        const blank = parseInt(document.getElementById(`blank-${machineId}`).value) || 0;
        const neckring = parseInt(document.getElementById(`neckring-${machineId}`).value) || 0;
        const funil = parseInt(document.getElementById(`funil-${machineId}`).value) || 0;
        
        const updates = {
            molde: molde,
            blank: blank,
            neck_ring: neckring,
            funil: funil,
            last_updated: Date.now(),
            updated_by: 'Administrador'
        };
        
        await maquinasRef.child(machineId).update(updates);
        
        allAdminMachines[machineId] = { ...allAdminMachines[machineId], ...updates };
        
        saveImmediateHistory(machineId, allAdminMachines[machineId], updates);
        
        showAlert('sucesso', `Máquina ${machineId} atualizada com sucesso!`);
        
        const limits = adminLimits[machineId] || DEFAULT_LIMITS;
        const status = getMachineStatusWithLimits(updates, limits);
        const statusText = status === 'critical' ? 'Baixa Reserva' :
                          status === 'warning' ? 'Baixo Estoque' : 'Bem Abastecido';
        
        const card = document.querySelector(`[data-machine-id="${machineId}"]`);
        if (card) {
            const badge = card.querySelector('.status-badge');
            if (badge) {
                badge.className = `status-badge ${status}`;
                badge.textContent = statusText;
            }
        }
        
    } catch (error) {
        console.error("❌ Erro ao atualizar máquina:", error);
        showAlert('erro', `Erro ao atualizar máquina ${machineId}: ${error.message}`);
    }
}

function saveImmediateHistory(machineId, oldValues, newValues) {
    const timestamp = Date.now();
    const historyEntry = {
        machineId: machineId,
        timestamp: timestamp,
        date: new Date(timestamp).toISOString(),
        old_molde: oldValues.molde || 0,
        new_molde: newValues.molde || 0,
        old_blank: oldValues.blank || 0,
        new_blank: newValues.blank || 0,
        old_neckring: oldValues.neck_ring || 0,
        new_neckring: newValues.neck_ring || 0,
        old_funil: oldValues.funil || 0,
        new_funil: newValues.funil || 0,
        molde_change: (newValues.molde || 0) - (oldValues.molde || 0),
        blank_change: (newValues.blank || 0) - (oldValues.blank || 0),
        user: 'Administrador (Painel Admin)'
    };
    
    historicoRef.child(machineId).push(historyEntry)
        .then(() => {
            console.log(`✅ Histórico salvo para máquina ${machineId}`);
        })
        .catch(error => {
            console.error("❌ Erro ao salvar histórico:", error);
        });
}

// ================= PREFIXOS (SEÇÃO ANTIGA) =================
function renderPrefixesTable() {
    const tableBody = document.getElementById('prefixesTable');
    if (!tableBody) return;
    
    const machines = Object.keys(allAdminMachines).sort();
    
    let html = '';
    machines.forEach(machineId => {
        const prefixKey = adminPrefixes[machineId] || '';
        
        let prefixInfo = '';
        if (prefixKey && prefixDatabase && prefixDatabase[prefixKey]) {
            const prefixData = prefixDatabase[prefixKey];
            prefixInfo = `${prefixKey} (${prefixData.processo || 'Sem processo'})`;
        } else if (prefixKey) {
            prefixInfo = `${prefixKey} (Não encontrado no banco)`;
        }
        
        html += `
            <tr>
                <td><strong>Máquina ${machineId}</strong></td>
                <td>${prefixInfo || '<span style="color: var(--text-light); font-style: italic;">Sem prefixo</span>'}</td>
                <td>
                    <button class="btn btn-small" onclick="editOldPrefix('${machineId}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-small" onclick="deleteOldPrefix('${machineId}')" ${!prefixKey ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

function editOldPrefix(machineId) {
    showSection('machines');
    
    setTimeout(() => {
        const machineCard = document.querySelector(`[data-machine-id="${machineId}"]`);
        if (machineCard) {
            machineCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            toggleQuickPrefix(machineId);
        }
    }, 500);
}

function deleteOldPrefix(machineId) {
    removeMachinePrefix(machineId);
}

// ================= COMENTÁRIOS =================
function renderCommentsList() {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    const allComments = [];
    
    Object.keys(adminComments).forEach(machineId => {
        const comment = adminComments[machineId];
        if (comment && comment.text) {
            allComments.push({
                machineId: machineId,
                ...comment
            });
        }
    });
    
    allComments.sort((a, b) => {
        const dateA = a.date || 0;
        const dateB = b.date || 0;
        return dateB - dateA;
    });
    
    if (allComments.length === 0) {
        commentsList.innerHTML = `
            <div class="no-data-message" style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-comments" style="font-size: 40px; color: var(--text-light); margin-bottom: 15px;"></i>
                <p style="color: var(--text-light);">Nenhum comentário cadastrado</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    allComments.slice(0, 10).forEach(item => {
        const date = item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'Data desconhecida';
        
        html += `
            <div class="comment-card">
                <div class="comment-header">
                    <div class="comment-machine">Máquina ${item.machineId}</div>
                    <div class="comment-date">${date}</div>
                </div>
                <div class="comment-text">${item.text}</div>
                <div class="comment-author">— ${item.author || 'Anônimo'}</div>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-small" onclick="editComment('${item.machineId}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-small" onclick="deleteComment('${item.machineId}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </div>
        `;
    });
    
    commentsList.innerHTML = html;
}

function saveComment() {
    const machineId = document.getElementById('commentMachine').value;
    const author = document.getElementById('commentAuthor').value.trim();
    const text = document.getElementById('commentText').value.trim();
    
    if (!machineId) {
        showAlert('erro', 'Selecione uma máquina');
        return;
    }
    
    if (!text) {
        showAlert('erro', 'Digite um comentário');
        return;
    }
    
    const comment = {
        author: author || 'Administrador',
        text: text,
        date: Date.now(),
        last_updated: Date.now()
    };
    
    comentariosRef.child(machineId).set(comment)
        .then(() => {
            adminComments[machineId] = comment;
            showAlert('sucesso', `Comentário salvo para máquina ${machineId}`);
            clearCommentForm();
            renderCommentsList();
        })
        .catch(error => {
            console.error("❌ Erro ao salvar comentário:", error);
            showAlert('erro', `Erro ao salvar comentário: ${error.message}`);
        });
}

function editComment(machineId) {
    const comment = adminComments[machineId];
    if (!comment) return;
    
    document.getElementById('commentMachine').value = machineId;
    document.getElementById('commentAuthor').value = comment.author || '';
    document.getElementById('commentText').value = comment.text || '';
}

function deleteComment(machineId) {
    if (confirm(`Remover comentário da máquina ${machineId}?`)) {
        comentariosRef.child(machineId).remove()
            .then(() => {
                delete adminComments[machineId];
                showAlert('sucesso', `Comentário removido da máquina ${machineId}`);
                renderCommentsList();
            })
            .catch(error => {
                console.error("❌ Erro ao remover comentário:", error);
                showAlert('erro', `Erro ao remover comentário: ${error.message}`);
            });
    }
}

function clearCommentForm() {
    document.getElementById('commentAuthor').value = '';
    document.getElementById('commentText').value = '';
}

// ================= IMAGENS =================
function renderImagesGrid() {
    const imagesGrid = document.getElementById('imagesGrid');
    if (!imagesGrid) return;
    
    const machinesWithImages = Object.keys(adminImages)
        .filter(machineId => adminImages[machineId] && adminImages[machineId].url)
        .sort((a, b) => {
            const dateA = adminImages[a]?.date || 0;
            const dateB = adminImages[b]?.date || 0;
            return dateB - dateA;
        });
    
    if (machinesWithImages.length === 0) {
        imagesGrid.innerHTML = `
            <div class="no-data-message" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
                <i class="fas fa-images" style="font-size: 40px; color: var(--text-light); margin-bottom: 15px;"></i>
                <p style="color: var(--text-light);">Nenhuma imagem cadastrada</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    machinesWithImages.forEach(machineId => {
        const image = adminImages[machineId];
        const date = image.date ? new Date(image.date).toLocaleDateString('pt-BR') : 'Data desconhecida';
        
        html += `
            <div class="image-card">
                <img src="${image.url}" alt="Máquina ${machineId}" 
                     onerror="this.src='https://via.placeholder.com/200x150?text=Imagem+Não+Carregada'">
                <div class="image-card-info">
                    <div class="image-card-machine">Máquina ${machineId}</div>
                    <div class="image-card-date">${date}</div>
                    <div style="margin-top: 10px; display: flex; gap: 5px;">
                        <button class="btn btn-small" onclick="deleteImage('${machineId}')">
                            <i class="fas fa-trash"></i> Remover
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    imagesGrid.innerHTML = html;
}

function previewImage() {
    const fileInput = document.getElementById('imageFile');
    const preview = document.getElementById('imagePreview');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Pré-visualização" style="max-width: 100%; max-height: 200px; object-fit: contain;">`;
        }
        
        reader.readAsDataURL(fileInput.files[0]);
    }
}

async function uploadImage() {
    const machineId = document.getElementById('imageMachine').value;
    const fileInput = document.getElementById('imageFile');
    
    if (!machineId) {
        showAlert('erro', 'Selecione uma máquina');
        return;
    }
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showAlert('erro', 'Selecione uma imagem');
        return;
    }
    
    const file = fileInput.files[0];
    const maxSize = 5 * 1024 * 1024;
    
    if (file.size > maxSize) {
        showAlert('erro', 'A imagem deve ter no máximo 5MB');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    uploadBtn.disabled = true;
    
    try {
        const base64Image = await fileToBase64(file);
        
        const imgbbUrl = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
        
        const formData = new FormData();
        formData.append('image', base64Image.split(',')[1]);
        
        const response = await fetch(imgbbUrl, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            const imageData = {
                url: result.data.url,
                thumb: result.data.thumb.url,
                date: Date.now(),
                uploaded_by: 'Administrador'
            };
            
            await imagensRef.child(machineId).set(imageData);
            
            adminImages[machineId] = imageData;
            
            showAlert('sucesso', 'Imagem enviada com sucesso!');
            clearImageForm();
            renderImagesGrid();
        } else {
            throw new Error(result.error?.message || 'Erro ao enviar imagem');
        }
    } catch (error) {
        console.error("❌ Erro no upload:", error);
        showAlert('erro', `Erro ao enviar imagem: ${error.message}`);
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function deleteImage(machineId) {
    if (confirm(`Remover imagem da máquina ${machineId}?`)) {
        imagensRef.child(machineId).remove()
            .then(() => {
                delete adminImages[machineId];
                showAlert('sucesso', `Imagem removida da máquina ${machineId}`);
                renderImagesGrid();
            })
            .catch(error => {
                console.error("❌ Erro ao remover imagem:", error);
            });
    }
}

function clearImageForm() {
    document.getElementById('imageFile').value = '';
    document.getElementById('imagePreview').innerHTML = '<p>Nenhuma imagem selecionada</p>';
}


// ================= FUNÇÕES AUXILIARES =================
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

function getFornoFromMachineId(machineId) {
    if (machineId.match(/^A\d+$/)) return 'A';
    if (machineId.match(/^B\d+$/)) return 'B';
    if (machineId.match(/^C\d+$/)) return 'C';
    if (machineId.match(/^1[0-5]$/) || ['10','11','12','13','14','15'].includes(machineId)) return 'D';
    return null;
}

// ================= EVENT LISTENERS =================
function setupAdminEventListeners() {
    console.log("🔧 Configurando event listeners do admin");
    
    document.getElementById('limitCritico')?.addEventListener('input', updateLimitPreviews);
    document.getElementById('limitBaixo')?.addEventListener('input', updateLimitPreviews);
    document.getElementById('limitNormal')?.addEventListener('input', updateLimitPreviews);
    
    const searchInput = document.getElementById('adminMachineSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(filterAdminMachines, 300);
        });
    }
    
    const fornoFilter = document.getElementById('fornoFilter');
    if (fornoFilter) {
        fornoFilter.addEventListener('change', filterAdminMachines);
    }
    
    console.log("✅ Event listeners configurados");
}

function refreshAdminData() {
    console.log("🔄 Recarregando dados do admin");
    showAlert('info', 'Recarregando dados...');
    loadAllData();
}

// ================= FUNÇÕES DE ALERTAS E TOASTS GLOBAIS =================
function showAlert(type, message) {
    // Verifica se a nova função formatada está disponível
    if (typeof showFormattedAlert !== 'undefined') {
        // Usa a nova função formatada
        const titles = {
            'sucesso': 'Sucesso!',
            'erro': 'Erro!',
            'info': 'Informação',
            'warning': 'Aviso'
        };
        
        // Se a mensagem já contém HTML (tags), extrai apenas o texto para o título
        let title = titles[type] || 'Alerta';
        let cleanMessage = message;
        
        // Verifica se a mensagem contém HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = message;
        const hasHTML = tempDiv.children.length > 0 || tempDiv.childNodes.length > 1;
        
        if (hasHTML) {
            // Extrai o texto sem as tags para o título
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            const firstLine = textContent.split('\n')[0].substring(0, 50);
            title = firstLine + (textContent.length > 50 ? '...' : '');
        }
        
        showFormattedAlert(type, title, message);
    } else {
        // Usa o método antigo (fallback)
        const existingAlert = document.querySelector('.custom-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        const alert = document.createElement('div');
        alert.className = `custom-alert ${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <i class="fas fa-${type === 'sucesso' ? 'check-circle' : 
                                 type === 'erro' ? 'exclamation-circle' : 
                                 type === 'info' ? 'info-circle' : 'exclamation-triangle'}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'sucesso' ? 'var(--success)' : 
                         type === 'erro' ? 'var(--danger)' : 
                         type === 'info' ? 'var(--primary)' : 'var(--warning)'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
            min-width: 300px;
            max-width: 400px;
        `;
        
        alert.querySelector('.alert-content').style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        alert.querySelector('button').style.cssText = `
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            margin-left: auto;
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// ================= ANIMAÇÕES PARA ALERTAS =================
if (!document.querySelector('#alert-animations')) {
    const style = document.createElement('style');
    style.id = 'alert-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(style);
}

// ================= EXPORTAÇÃO =================
function exportAllData() {
    const data = {
        timestamp: new Date().toISOString(),
        machines: allAdminMachines,
        prefixes: adminPrefixes,
        comments: adminComments,
        images: adminImages,
        limits: adminLimits,
        maintenance: adminMaintenance,
        prefixDatabase: prefixDatabase, // NOVO: Incluir banco de prefixos detalhados
        total_machines: Object.keys(allAdminMachines).length
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `backup_wmoldes_${new Date().getTime()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('sucesso', 'Backup exportado com sucesso!');
}

// ================= EXPORTAÇÃO PARA ESCOPO GLOBAL =================
window.initAdminPanel = initAdminPanel;
window.showSection = showSection;
window.filterAdminMachines = filterAdminMachines;
window.loadMachineLimits = loadMachineLimits;
window.loadMachineLimitsByProcess = loadMachineLimitsByProcess;
window.resetToDefaultProcessLimits = resetToDefaultProcessLimits;
window.updateProcessLimitsReferenceTable = updateProcessLimitsReferenceTable;
window.saveMachineChanges = saveMachineChanges;
window.resetMachineValues = resetMachineValues;
window.configureMachineLimits = configureMachineLimits;
window.toggleQuickPrefix = toggleQuickPrefix;
window.saveQuickPrefix = saveQuickPrefix;
window.removeMachinePrefix = removeMachinePrefix;
window.toggleQuickComment = toggleQuickComment;
window.saveQuickComment = saveQuickComment;
window.toggleQuickMaintenance = toggleQuickMaintenance;
window.saveQuickMaintenance = saveQuickMaintenance;
window.setMaintenanceStatus = setMaintenanceStatus;
window.showMachineDetails = showMachineDetails;
window.savePrefix = saveQuickPrefix;
window.deletePrefix = removeMachinePrefix;
window.clearPrefixForm = function() { 
    console.log("clearPrefixForm chamada (não é mais necessária com select)");
};
window.saveComment = saveComment;
window.editComment = editComment;
window.deleteComment = deleteComment;
window.clearCommentForm = clearCommentForm;
window.previewImage = previewImage;
window.uploadImage = uploadImage;
window.deleteImage = deleteImage;
window.clearImageForm = clearImageForm;
window.exportAllData = exportAllData;
window.updateMachineValue = updateMachineValue;
window.refreshAdminData = refreshAdminData;
window.prefixDatabase = prefixDatabase;

// NOVAS EXPORTAÇÕES PARA PROCESS-LIMITS.JS
window.initProcessLimitsSystem = initProcessLimitsSystem;
window.adminPrefixes = adminPrefixes;
window.adminLimits = adminLimits;
window.allAdminMachines = allAdminMachines;
window.prefixDatabase = prefixDatabase;

// ================= LIMITES INDIVIDUAIS (MANTIDAS PARA COMPATIBILIDADE) =================
async function loadMachineLimits() {
    const machineSelect = document.getElementById('limitsMachineSelect');
    const selectedMachine = machineSelect.value;
    
    console.log(`⚙️ Carregando limites da máquina: ${selectedMachine}`);
    
    if (!selectedMachine) {
        currentMachineLimits = { ...DEFAULT_LIMITS };
        currentSelectedMachine = '';
        updateLimitFields();
        return;
    }
    
    currentSelectedMachine = selectedMachine;
    
    try {
        const limits = await getLimitsForMachine(selectedMachine);
        currentMachineLimits = limits;
        updateLimitFields();
    } catch (error) {
        console.error("❌ Erro ao carregar limites:", error);
        showAlert('erro', 'Erro ao carregar limites da máquina');
    }
}

function updateLimitFields() {
    document.getElementById('limitCritico').value = currentMachineLimits.CRITICO;
    document.getElementById('limitBaixo').value = currentMachineLimits.BAIXO;
    document.getElementById('limitNormal').value = currentMachineLimits.NORMAL;
    
    updateLimitPreviews();
}

function updateLimitPreviews() {
    const critico = parseInt(document.getElementById('limitCritico').value) || 3;
    const baixo = parseInt(document.getElementById('limitBaixo').value) || 5;
    const normal = parseInt(document.getElementById('limitNormal').value) || 6;
    
    document.getElementById('previewCritico').textContent = critico;
    document.getElementById('previewBaixoMin').textContent = critico + 1;
    document.getElementById('previewBaixoMax').textContent = baixo;
    document.getElementById('previewNormal').textContent = normal;
}

// ================= FUNÇÃO DE ALERTA FORMATADA =================
function showFormattedAlert(type, title, message) {
    const existingAlert = document.querySelector('.formatted-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `formatted-alert alert-${type}`;
    
    const icons = {
        'sucesso': 'check-circle',
        'erro': 'exclamation-circle',
        'info': 'info-circle',
        'warning': 'exclamation-triangle'
    };
    
    alert.innerHTML = `
        <div class="alert-header">
            <div class="alert-icon">
                <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            </div>
            <div class="alert-title">${title}</div>
            <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="alert-body">${message}</div>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// ================= ESTILOS PARA ALERTAS FORMATADAS =================
if (!document.querySelector('#formatted-alert-styles')) {
    const style = document.createElement('style');
    style.id = 'formatted-alert-styles';
    style.textContent = `
        .formatted-alert {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            background: var(--card-bg);
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            overflow: hidden;
            animation: slideInRight 0.3s ease-out;
            border: 1px solid var(--border);
        }
        
        .alert-sucesso {
            border-left: 4px solid var(--success);
        }
        
        .alert-erro {
            border-left: 4px solid var(--danger);
        }
        
        .alert-info {
            border-left: 4px solid var(--primary);
        }
        
        .alert-warning {
            border-left: 4px solid var(--warning);
        }
        
        .alert-header {
            display: flex;
            align-items: center;
            padding: 15px 20px;
            background: rgba(255,255,255,0.05);
            border-bottom: 1px solid var(--border);
        }
        
        .alert-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
        }
        
        .alert-sucesso .alert-icon {
            background: rgba(16, 185, 129, 0.15);
            color: var(--success);
        }
        
        .alert-erro .alert-icon {
            background: rgba(239, 68, 68, 0.15);
            color: var(--danger);
        }
        
        .alert-info .alert-icon {
            background: rgba(14, 165, 233, 0.15);
            color: var(--primary);
        }
        
        .alert-warning .alert-icon {
            background: rgba(245, 158, 11, 0.15);
            color: var(--warning);
        }
        
        .alert-icon i {
            font-size: 18px;
        }
        
        .alert-title {
            font-weight: 700;
            font-size: 15px;
            color: var(--text);
            flex: 1;
        }
        
        .alert-close {
            background: none;
            border: none;
            color: var(--text-light);
            cursor: pointer;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .alert-close:hover {
            background: rgba(255,255,255,0.1);
            color: var(--text);
        }
        
        .alert-body {
            padding: 20px;
            color: var(--text);
            font-size: 14px;
            line-height: 1.5;
        }
        
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(style);
}

// ================= FUNÇÕES ADICIONAIS PARA COMPATIBILIDADE =================

/**
 * Atualiza a interface com os limites de processo (para uso em process-limits.js)
 */
function updateUIWithProcessLimits(machineId, processType) {
    const processInfo = getProcessTypeInfo(processType);
    
    if (!processInfo) {
        console.warn(`Tipo de processo não encontrado: ${processType}`);
        return;
    }
    
    // Atualiza os campos da interface
    document.getElementById('limitCritico').value = processInfo.limits.CRITICO;
    document.getElementById('limitBaixo').value = processInfo.limits.BAIXO;
    document.getElementById('limitNormal').value = processInfo.limits.NORMAL;
    
    // Desabilita os campos (só visualização)
    document.getElementById('limitCritico').disabled = true;
    document.getElementById('limitBaixo').disabled = true;
    document.getElementById('limitNormal').disabled = true;
    
    // Atualiza visualizações
    updateLimitPreviews();
}

/**
 * Função para compatibilidade com o HTML antigo
 */
function saveLimits() {
    const machineSelect = document.getElementById('limitsMachineSelect');
    const selectedMachine = machineSelect.value;
    
    if (!selectedMachine) {
        showAlert('erro', 'Selecione uma máquina para salvar os limites');
        return;
    }
    
    const critico = parseInt(document.getElementById('limitCritico').value) || 3;
    const baixo = parseInt(document.getElementById('limitBaixo').value) || 5;
    const normal = parseInt(document.getElementById('limitNormal').value) || 6;
    
    if (critico >= baixo || baixo >= normal) {
        showAlert('erro', 'Os valores devem ser: Baixa Reserva < Baixo Estoque < Bem Abastecido');
        return;
    }
    
    const limits = {
        critico: critico,
        baixo: baixo,
        normal: normal
    };
    
    saveMachineLimits(selectedMachine, limits)
        .then(() => {
            showAlert('sucesso', `Limites salvos para máquina ${selectedMachine}!`);
        })
        .catch(error => {
            console.error("❌ Erro ao salvar limites:", error);
            showAlert('erro', `Erro ao salvar limites: ${error.message}`);
        });
}

// ================= ADICIONAR FUNÇÕES FALTANTES AO ESCOPO GLOBAL =================
window.loadMachineLimits = loadMachineLimits;
window.updateLimitFields = updateLimitFields;
window.updateLimitPreviews = updateLimitPreviews;
window.saveLimits = saveLimits;
window.updateUIWithProcessLimits = updateUIWithProcessLimits;
window.showFormattedAlert = showFormattedAlert;


function addHistoryToMenu() {
    const menu = document.querySelector('.admin-menu');
    if (!menu) return;
    
    // Verificar se já existe
    if (document.querySelector('.admin-menu a[href="#history"]')) return;
    
    const item = document.createElement('li');
    item.innerHTML = `<a href="#history" onclick="showSection('history'); setTimeout(initHistorySection, 100);">
        <i class="fas fa-chart-line"></i> Histórico
    </a>`;
    menu.appendChild(item);
}

// Chamar após carregar
setTimeout(addHistoryToMenu, 2000);

// ===== INICIALIZAR SEÇÃO DE HISTÓRICO =====
function initHistorySection() {
    console.log("📊 Inicializando seção de histórico...");
    
    // Verificar se a função do history-charts.js existe
    if (typeof window.initHistorySection === 'function') {
        window.initHistorySection();
    } else {
        console.error("❌ Função initHistorySection não encontrada em history-charts.js");
        // Tentar novamente após um tempo
        setTimeout(() => {
            if (typeof window.initHistorySection === 'function') {
                window.initHistorySection();
            }
        }, 1000);
    }
}

// Adicionar à função showSection
const originalShowSection = window.showSection;
window.showSection = function(sectionId) {
    console.log(`📁 Mostrando seção: ${sectionId}`);
    
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.admin-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    const section = document.getElementById(`${sectionId}-section`);
    if (section) {
        section.classList.add('active');
    }
    
    const menuLink = document.querySelector(`.admin-menu a[href="#${sectionId}"]`);
    if (menuLink) {
        menuLink.classList.add('active');
    }
    
    // Carregar dados específicos da seção
    setTimeout(() => {
        switch(sectionId) {
            case 'limits':
                if (Object.keys(allAdminMachines).length > 0) {
                    const machines = Object.keys(allAdminMachines);
                    if (machines.length > 0) {
                        const select = document.getElementById('limitsMachineSelect');
                        if (select) {
                            select.value = machines[0];
                        }
                        if (typeof loadMachineLimitsByProcess === 'function') {
                            loadMachineLimitsByProcess();
                        }
                    }
                }
                break;
            case 'machines':
                renderAdminMachines();
                break;
            case 'prefixes':
                renderPrefixesTable();
                break;
            case 'detailed-prefixes':
                if (typeof initPrefixManager === 'function') {
                    initPrefixManager();
                }
                break;
            case 'comments':
                renderCommentsList();
                break;
            case 'images':
                renderImagesGrid();
                break;
            case 'history':
                // Inicializar histórico
                if (typeof initHistorySection === 'function') {
                    initHistorySection();
                }
                break;
        }
    }, 100);
};

// Exportar função
window.initHistorySection = initHistorySection;

console.log("✅ Funções de compatibilidade adicionadas");

console.log("✅ Funções do admin.js exportadas para escopo global");
