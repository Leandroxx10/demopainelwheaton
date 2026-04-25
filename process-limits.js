// ================= LIMITES POR TIPO DE PROCESSO =================
// Arquivo: process-limits.js

/**
 * Sistema de limites predefinidos por tipo de processo
 * Tipos: SG, DG, TG, QG, PS, PD, AMOSTRA
 */

const PROCESS_LIMITS_CONFIG = {
    // Limites padrão (usados como fallback)
    DEFAULT: {
        CRITICO: 3,
        BAIXO: 5,
        NORMAL: 8
    },
    
    // Limites por tipo de processo
    PROCESS_LIMITS: {
        SG: { // Simples Gota
            name: " ",
            desc: "Processo com uma única gota",
            limits: {
                CRITICO: 2,
                BAIXO: 4,
                NORMAL: 7
            }
        },
        DG: { // Dupla Gota
            name: " ",
            desc: "Processo para duas gotas",
            limits: {
                CRITICO: 3,
                BAIXO: 5,
                NORMAL: 8
            }
        },
        TG: { // Tripla Gota
            name: " ",
            desc: "Processo para três gotas",
            limits: {
                CRITICO: 4,
                BAIXO: 6,
                NORMAL: 9
            }
        },
        QG: { // Quatro Gota
            name: " ",
            desc: "Processo para quatro gotas",
            limits: {
                CRITICO: 5,
                BAIXO: 7,
                NORMAL: 10
            }
        },
        PS: { // Prensado Simples
            name: " ",
            desc: "Processo de prensagem simples",
            limits: {
                CRITICO: 1,
                BAIXO: 3,
                NORMAL: 6
            }
        },
        PD: { // Prensado Duplo
            name: " ",
            desc: "Processo de prensagem dupla",
            limits: {
                CRITICO: 2,
                BAIXO: 4,
                NORMAL: 7
            }
        },
        AMOSTRA: {
            name: " ",
            desc: "Processo para produção de amostras",
            limits: {
                CRITICO: 1,
                BAIXO: 2,
                NORMAL: 4
            }
        }
    },
    
    // Configuração administrativa dos limites de processo
    ADMIN_CONFIG: {
        // Permite editar limites de processo? (false = visualização apenas)
        canEditProcessLimits: false,
        
        // Cor de cada processo para identificação visual
        processColors: {
            SG: '#3B82F6', // Azul
            DG: '#10B981', // Verde
            TG: '#F59E0B', // Laranja
            QG: '#8B5CF6', // Roxo
            PS: '#EF4444', // Vermelho
            PD: '#EC4899', // Cinza
            AMOSTRA: '#64748B' // Cinza escuro
        }
    }
};

// ================= FUNÇÕES DE ACESSO =================

/**
 * Obtém os limites para um tipo de processo específico
 * @param {string} processType - Tipo do processo (SG, DG, TG, etc.)
 * @returns {Object} Limites do processo ou padrão
 */
function getLimitsByProcessType(processType) {
    if (!processType) return { ...PROCESS_LIMITS_CONFIG.DEFAULT };
    
    const upperType = processType.toUpperCase();
    const process = PROCESS_LIMITS_CONFIG.PROCESS_LIMITS[upperType];
    
    if (process && process.limits) {
        return { ...process.limits };
    }
    
    return { ...PROCESS_LIMITS_CONFIG.DEFAULT };
}

/**
 * Obtém o nome amigável do tipo de processo
 * @param {string} processType - Tipo do processo
 * @returns {string} Nome amigável
 */
function getProcessTypeName(processType) {
    if (!processType) return "Não definido";
    
    const upperType = processType.toUpperCase();
    const process = PROCESS_LIMITS_CONFIG.PROCESS_LIMITS[upperType];
    
    return process ? process.name : upperType;
}

/**
 * Obtém a descrição do tipo de processo
 * @param {string} processType - Tipo do processo
 * @returns {string} Descrição
 */
function getProcessTypeDescription(processType) {
    if (!processType) return "";
    
    const upperType = processType.toUpperCase();
    const process = PROCESS_LIMITS_CONFIG.PROCESS_LIMITS[upperType];
    
    return process ? process.desc : "";
}

/**
 * Obtém a cor do tipo de processo
 * @param {string} processType - Tipo do processo
 * @returns {string} Código hexadecimal da cor
 */
function getProcessTypeColor(processType) {
    if (!processType) return "#64748B";
    
    const upperType = processType.toUpperCase();
    return PROCESS_LIMITS_CONFIG.ADMIN_CONFIG.processColors[upperType] || "#64748B";
}

/**
 * Obtém todos os tipos de processo disponíveis
 * @returns {Array} Array com tipos de processo
 */
function getAllProcessTypes() {
    return Object.keys(PROCESS_LIMITS_CONFIG.PROCESS_LIMITS);
}

/**
 * Obtém informações completas de um tipo de processo
 * @param {string} processType - Tipo do processo
 * @returns {Object} Informações completas
 */
function getProcessTypeInfo(processType) {
    if (!processType) return null;
    
    const upperType = processType.toUpperCase();
    const process = PROCESS_LIMITS_CONFIG.PROCESS_LIMITS[upperType];
    
    if (!process) return null;
    
    return {
        type: upperType,
        name: process.name,
        description: process.desc,
        limits: { ...process.limits },
        color: getProcessTypeColor(upperType)
    };
}

/**
 * Verifica se o tipo de processo é válido
 * @param {string} processType - Tipo do processo
 * @returns {boolean} True se for válido
 */
function isValidProcessType(processType) {
    if (!processType) return false;
    
    const upperType = processType.toUpperCase();
    return !!PROCESS_LIMITS_CONFIG.PROCESS_LIMITS[upperType];
}

// ================= INTEGRAÇÃO COM O SISTEMA ATUAL =================

/**
 * Determina os limites de uma máquina baseado no seu tipo de processo
 * @param {string} machineId - ID da máquina
 * @param {Object} prefixDatabase - Banco de prefixos (com tipo de processo)
 * @param {Object} machinePrefixes - Prefixos das máquinas
 * @returns {Object} Limites para a máquina
 */
function getMachineLimitsByProcess(machineId, prefixDatabase, machinePrefixes) {
    // Verifica se temos os dados necessários
    if (!machinePrefixes || !prefixDatabase) {
        console.warn(`⚠️ Dados insuficientes para determinar limites por processo para máquina ${machineId}`);
        return { ...PROCESS_LIMITS_CONFIG.DEFAULT };
    }
    
    // 1. Tenta obter o prefixo da máquina
    const prefixKey = machinePrefixes[machineId];
    
    if (!prefixKey || !prefixDatabase[prefixKey]) {
        // Se não tiver prefixo ou não encontrar no banco, retorna padrão
        return { ...PROCESS_LIMITS_CONFIG.DEFAULT };
    }
    
    // 2. Obtém o tipo de processo do prefixo
    const prefixData = prefixDatabase[prefixKey];
    const processType = prefixData.processo;
    
    if (!processType) {
        // Se não tiver tipo de processo definido, retorna padrão
        return { ...PROCESS_LIMITS_CONFIG.DEFAULT };
    }
    
    // 3. Retorna os limites baseado no tipo de processo
    return getLimitsByProcessType(processType);
}

/**
 * Atualiza a interface para mostrar limites por tipo de processo
 * @param {string} machineId - ID da máquina
 * @param {string} processType - Tipo do processo
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
 * Exibe informações do tipo de processo na interface
 */
function showProcessTypeInfo(processInfo, machineId = null) {
    // Remove informações anteriores
    const existingInfo = document.getElementById('processTypeInfo');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    // Cria container para informações
    const infoContainer = document.createElement('div');
    infoContainer.id = 'processTypeInfo';
    infoContainer.style.cssText = `
        background: linear-gradient(135deg, ${processInfo.color}15, transparent);
        border: 2px solid ${processInfo.color};
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 25px;
        margin-top: 15px;
        position: relative;
    `;
    
    infoContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 50px; height: 50px; background: ${processInfo.color}; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-cogs" style="color: white; font-size: 22px;"></i>
                </div>
                <div>
                    <h4 style="margin: 0; color: var(--text); font-size: 18px;">
                        ${processInfo.name} <span style="color: ${processInfo.color}; font-weight: 700;">(${processInfo.type})</span>
                    </h4>
                    <p style="margin: 5px 0 0; color: var(--text-light); font-size: 14px;">
                        ${processInfo.description}
                    </p>
                </div>
            </div>
            
            ${machineId ? `
                <button onclick="showFullProcessSelection('${machineId}', null, '${processInfo.type}')" 
                        class="btn" 
                        style="background: ${processInfo.color}; color: white; white-space: nowrap;">
                    <i class="fas fa-edit"></i> Alterar Processo
                </button>
            ` : ''}
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div style="text-align: center;">
                <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fas fa-exclamation-triangle"></i> Baixa Reserva
                </div>
                <div style="font-size: 28px; font-weight: 800; color: var(--danger);">
                    ≤ ${processInfo.limits.CRITICO}
                </div>
                <div style="font-size: 11px; color: var(--text-light); margin-top: 5px;">
                    unidades
                </div>
            </div>
            
            <div style="text-align: center;">
                <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fas fa-exclamation-circle"></i> Baixo Estoque
                </div>
                <div style="font-size: 28px; font-weight: 800; color: var(--warning);">
                    ${processInfo.limits.CRITICO + 1}-${processInfo.limits.BAIXO}
                </div>
                <div style="font-size: 11px; color: var(--text-light); margin-top: 5px;">
                    unidades
                </div>
            </div>
            
            <div style="text-align: center;">
                <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fas fa-check-circle"></i> Bem Abastecido
                </div>
                <div style="font-size: 28px; font-weight: 800; color: var(--success);">
                    ≥ ${processInfo.limits.NORMAL}
                </div>
                <div style="font-size: 11px; color: var(--text-light); margin-top: 5px;">
                    unidades
                </div>
            </div>
        </div>
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid ${processInfo.color}40; font-size: 12px; color: var(--text-light); text-align: center;">
            <i class="fas fa-info-circle"></i>
            Limites predefinidos para o tipo de processo ${processInfo.type}
            ${machineId ? `• Aplicado à máquina ${machineId}` : ''}
        </div>
    `;
    
    // Insere antes dos cards de limite
    const limitsConfig = document.querySelector('.limits-config');
    if (limitsConfig) {
        limitsConfig.parentNode.insertBefore(infoContainer, limitsConfig);
    }
}

// ================= GERENCIAMENTO DE LIMITES (ADMIN) =================

/**
 * Carrega os limites de processo na interface administrativa (SIMPLIFICADO)
 * @param {string} machineId - ID da máquina selecionada
 */
function loadProcessLimitsForMachine(machineId) {
    console.log(`🔍 Carregando limites de processo para máquina ${machineId}`);
    
    // Limpa exibição anterior
    const display = document.getElementById('processLimitsDisplay');
    if (display) {
        display.innerHTML = '';
    }
    
    // Área de seleção do processo
    const selectionArea = document.getElementById('processSelectionArea');
    if (!selectionArea) {
        console.error("❌ Área de seleção de processo não encontrada");
        return;
    }
    
    // Tenta obter o prefixo e processo atual
    let prefixKey = null;
    let currentProcess = null;
    let prefixData = null;
    
    // 1. Tenta obter do adminPrefixes
    if (typeof window.adminPrefixes !== 'undefined' && window.adminPrefixes[machineId]) {
        prefixKey = window.adminPrefixes[machineId];
        console.log(`✅ Prefixo encontrado: ${prefixKey}`);
    }
    
    // 2. Tenta obter processo do prefixDatabase
    if (prefixKey && window.prefixDatabase && window.prefixDatabase[prefixKey]) {
        prefixData = window.prefixDatabase[prefixKey];
        currentProcess = prefixData.processo;
        
        if (currentProcess) {
            console.log(`✅ Processo encontrado no prefixo: ${currentProcess}`);
        } else {
            console.log(`⚠️ Prefixo ${prefixKey} não tem tipo de processo definido`);
        }
    }
    
    // 3. Tenta obter dos limites individuais (fallback)
    if (!currentProcess && window.adminLimits && window.adminLimits[machineId]) {
        // Tenta inferir pelo valor dos limites
        const limits = window.adminLimits[machineId];
        currentProcess = inferProcessFromLimits(limits);
        if (currentProcess) {
            console.log(`✅ Processo inferido dos limites: ${currentProcess}`);
        }
    }
    
    // Exibe a interface de seleção SIMPLIFICADA
    showSimplifiedProcessSelection(machineId, prefixKey, currentProcess, prefixData);
}

/**
 * Tenta inferir o tipo de processo pelos limites
 */
function inferProcessFromLimits(limits) {
    if (!limits) return null;
    
    const allProcesses = getAllProcessTypes();
    
    for (const processType of allProcesses) {
        const processLimits = getLimitsByProcessType(processType);
        
        if (limits.critico === processLimits.CRITICO &&
            limits.baixo === processLimits.BAIXO &&
            limits.normal === processLimits.NORMAL) {
            return processType;
        }
    }
    
    return null;
}

/**
 * Mostra interface SIMPLIFICADA para selecionar/definir tipo de processo
 * @param {string} machineId - ID da máquina
 * @param {string} currentPrefix - Prefixo atual (se houver)
 * @param {string} currentProcess - Tipo de processo atual (se houver)
 * @param {Object} prefixData - Dados completos do prefixo (se houver)
 */
function showSimplifiedProcessSelection(machineId, currentPrefix = null, currentProcess = null, prefixData = null) {
    const selectionArea = document.getElementById('processSelectionArea');
    if (!selectionArea) return;
    
    // Remove seleção anterior
    selectionArea.innerHTML = '';
    
    // Se tem processo definido, mostra informações
    if (currentProcess && isValidProcessType(currentProcess)) {
        console.log(`✅ Mostrando processo ${currentProcess} para máquina ${machineId}`);
        
        const processInfo = getProcessTypeInfo(currentProcess);
        updateUIWithProcessLimits(machineId, currentProcess);
        showProcessTypeInfo(processInfo, machineId);
        
        // Apenas mostra o botão para alterar
        selectionArea.innerHTML = `
            <div style="background: rgba(14, 165, 233, 0.1); padding: 20px; border-radius: 12px; border: 2px solid var(--primary); margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: ${processInfo.color}; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-check-circle" style="color: white; font-size: 22px;"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: var(--text); font-size: 18px;">
                                Processo Configurado
                            </h4>
                            <p style="margin: 0; color: var(--text-light); font-size: 14px;">
                                A máquina <strong>${machineId}</strong> usa o processo <strong>${processInfo.name} (${processInfo.type})</strong>
                                ${currentPrefix ? `com o prefixo <strong>${currentPrefix}</strong>` : ''}
                            </p>
                        </div>
                    </div>
                    <button onclick="showFullProcessSelection('${machineId}', '${currentPrefix}', '${currentProcess}')" 
                            class="btn" style="background: var(--primary); color: white;">
                        <i class="fas fa-edit"></i> Alterar Processo
                    </button>
                </div>
            </div>
        `;
        
    } else {
        // Não tem processo definido, mostra seleção obrigatória
        console.log(`ℹ️ Mostrando seleção obrigatória para máquina ${machineId}`);
        
        selectionArea.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.1); padding: 25px; border-radius: 12px; border: 2px solid var(--danger); margin-bottom: 20px;">
                <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
                    <div style="flex-shrink: 0;">
                        <i class="fas fa-exclamation-triangle" style="color: var(--danger); font-size: 28px;"></i>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 18px;">
                            Processo Não Definido
                        </h4>
                        <p style="margin: 0 0 20px 0; color: var(--text); font-size: 14px;">
                            A máquina <strong>${machineId}</strong> não tem um tipo de processo definido.
                            ${currentPrefix ? `O prefixo <strong>${currentPrefix}</strong> não tem tipo de processo.` : 'Esta máquina não tem prefixo atribuído.'}
                        </p>
                        
                        <div class="form-group">
                            <label for="processSelect-${machineId}" style="font-weight: 600; color: var(--text); margin-bottom: 10px; display: block;">
                                <i class="fas fa-cogs"></i> Selecione o Tipo de Processo:
                            </label>
                            <select id="processSelect-${machineId}" class="search-input" style="width: 100%; padding: 12px; font-size: 16px;"
                                    onchange="saveProcessOnChange('${machineId}', this.value, '${currentPrefix}')">
                                <option value="">-- Selecione um Tipo de Processo --</option>
                                ${getAllProcessTypes().map(type => {
                                    const info = getProcessTypeInfo(type);
                                    return `<option value="${type}" ${currentProcess === type ? 'selected' : ''}>${info.name} (${type}) - Limites: ${info.limits.CRITICO}/${info.limits.BAIXO}/${info.limits.NORMAL}</option>`;
                                }).join('')}
                            </select>
                            <div style="font-size: 13px; color: var(--text-light); margin-top: 8px;">
                                <i class="fas fa-info-circle"></i> O processo será salvo automaticamente ao selecionar
                            </div>
                        </div>
                        
                        ${!currentPrefix ? `
                            <div style="margin-top: 20px; padding: 15px; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border-left: 4px solid #8b5cf6;">
                                <div style="font-size: 14px; color: var(--text); margin-bottom: 10px;">
                                    <i class="fas fa-lightbulb"></i> <strong>Recomendação:</strong> Atribua um prefixo primeiro
                                </div>
                                <button onclick="showSection('machines')" class="btn" style="background: #8b5cf6; color: white;">
                                    <i class="fas fa-tag"></i> Atribuir Prefixo à Máquina
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Se já tiver um processo (mesmo que inválido), seleciona no dropdown
        if (currentProcess) {
            setTimeout(() => {
                const select = document.getElementById(`processSelect-${machineId}`);
                if (select) {
                    select.value = currentProcess;
                }
            }, 100);
        }
    }
}

/**
 * Salva o processo automaticamente quando o usuário seleciona no dropdown
 */
async function saveProcessOnChange(machineId, processType, currentPrefix = null) {
    if (!processType) {
        return; // Não faz nada se for seleção vazia
    }
    
    console.log(`💾 Salvando processo ${processType} para máquina ${machineId} (salvamento automático)`);
    
    try {
        // Obtém os limites do processo selecionado
        const processLimits = getLimitsByProcessType(processType);
        
        // 1. PRIMEIRO: Salva os limites diretamente na máquina
        console.log(`📝 Aplicando limites: ${processLimits.CRITICO}/${processLimits.BAIXO}/${processLimits.NORMAL}`);
        
        const success = await saveMachineLimits(machineId, {
            critico: processLimits.CRITICO,
            baixo: processLimits.BAIXO,
            normal: processLimits.NORMAL
        });
        
        if (!success) {
            showAlert('erro', 'Erro ao salvar limites da máquina');
            return;
        }
        
        // Atualiza localmente
        if (window.adminLimits) {
            window.adminLimits[machineId] = {
                critico: processLimits.CRITICO,
                baixo: processLimits.BAIXO,
                normal: processLimits.NORMAL
            };
        }
        
        // 2. DEPOIS: Atualiza o tipo de processo no prefixo (se existir)
        let prefixKey = currentPrefix || (window.adminPrefixes && window.adminPrefixes[machineId]);
        
        if (prefixKey && window.prefixDatabase && window.prefixDatabase[prefixKey]) {
            console.log(`🏷️ Atualizando processo no prefixo ${prefixKey}`);
            
            const updates = {
                processo: processType,
                atualizadoEm: Date.now(),
                atualizadoPor: 'Administrador (Painel)'
            };
            
            // Atualiza no Firebase se estiver disponível
            if (typeof db !== 'undefined') {
                const prefixRef = db.ref("prefixDatabase").child(prefixKey);
                await prefixRef.update(updates);
            }
            
            // Atualiza localmente
            window.prefixDatabase[prefixKey] = {
                ...window.prefixDatabase[prefixKey],
                ...updates
            };
        }
        
        // 3. Atualiza a interface imediatamente
        updateUIWithProcessLimits(machineId, processType);
        
        // Mostra mensagem de sucesso
        showAlert('sucesso', 
            `Processo <strong>${processType}</strong> salvo para máquina ${machineId}!<br>
             • Limites aplicados: ${processLimits.CRITICO}/${processLimits.BAIXO}/${processLimits.NORMAL}`);
        
        // Recarrega a interface para mostrar as informações atualizadas
        setTimeout(() => {
            loadProcessLimitsForMachine(machineId);
        }, 500);
        
    } catch (error) {
        console.error("❌ Erro ao salvar processo:", error);
        showAlert('erro', `Erro ao salvar processo: ${error.message}`);
        
        // Reseta o select em caso de erro
        const select = document.getElementById(`processSelect-${machineId}`);
        if (select) {
            select.value = '';
        }
    }
}

/**
 * Mostra interface completa para seleção de processo (para edição)
 */
function showFullProcessSelection(machineId, currentPrefix = null, currentProcess = null) {
    const selectionArea = document.getElementById('processSelectionArea');
    if (!selectionArea) return;
    
    selectionArea.innerHTML = '';
    
    // Cria uma interface mais completa para edição
    const processOptions = getAllProcessTypes().map(type => {
        const info = getProcessTypeInfo(type);
        const isSelected = currentProcess === type;
        
        return `
            <label class="process-option ${isSelected ? 'selected' : ''}" 
                   onclick="selectProcessOption('${type}', '${machineId}', '${currentPrefix}')"
                   style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: ${isSelected ? info.color + '20' : 'var(--card-bg)'}; border: 2px solid ${isSelected ? info.color : 'var(--border)'}; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: all 0.2s;">
                <div style="width: 24px; height: 24px; background: ${info.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 12px;">
                    ${type.charAt(0)}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: ${isSelected ? info.color : 'var(--text)'};">${info.name}</div>
                    <div style="font-size: 12px; color: var(--text-light);">${info.description}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 14px; font-weight: 700; color: ${info.color};">${type}</div>
                    <div style="font-size: 11px; color: var(--text-light);">
                        ${info.limits.CRITICO}/${info.limits.BAIXO}/${info.limits.NORMAL}
                    </div>
                </div>
                ${isSelected ? '<i class="fas fa-check-circle" style="color: var(--success); font-size: 18px;"></i>' : ''}
            </label>
        `;
    }).join('');
    
    selectionArea.innerHTML = `
        <div style="background: rgba(14, 165, 233, 0.1); padding: 25px; border-radius: 12px; border: 2px solid var(--primary); margin-bottom: 20px;">
            <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
                <div style="flex-shrink: 0;">
                    <i class="fas fa-cogs" style="color: var(--primary); font-size: 28px;"></i>
                </div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 10px 0; color: var(--text); font-size: 18px;">
                        Alterar Tipo de Processo
                    </h4>
                    <p style="margin: 0 0 20px 0; color: var(--text); font-size: 14px;">
                        Selecione um novo tipo de processo para a máquina <strong>${machineId}</strong>:
                    </p>
                    
                    ${currentPrefix ? `
                        <div style="background: rgba(139, 92, 246, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin-bottom: 15px;">
                            <div style="font-size: 13px; color: var(--text-light); margin-bottom: 5px;">Prefixo Atual</div>
                            <div style="font-weight: 600; color: var(--text);">${currentPrefix}</div>
                        </div>
                    ` : ''}
                    
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 13px; color: var(--text-light); margin-bottom: 10px;">
                            <i class="fas fa-list"></i> Tipos de Processo Disponíveis:
                        </div>
                        <div id="processOptionsList" style="max-height: 250px; overflow-y: auto; padding-right: 5px;">
                            ${processOptions}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="cancelProcessSelection('${machineId}', '${currentPrefix}', '${currentProcess}')" class="btn">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                    
                    <div id="selectedProcessInfo" style="margin-top: 15px; padding: 15px; background: var(--bg); border-radius: 8px; border: 1px solid var(--border); display: none;">
                        <!-- Será preenchido dinamicamente -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Se já tiver processo selecionado, mostra informações
    if (currentProcess) {
        selectProcessOption(currentProcess, machineId, currentPrefix);
    }
}

/**
 * Seleciona uma opção de processo na interface completa
 */
function selectProcessOption(processType, machineId, currentPrefix = null) {
    const processInfo = getProcessTypeInfo(processType);
    
    // Remove seleção anterior
    document.querySelectorAll('.process-option').forEach(option => {
        option.classList.remove('selected');
        option.style.background = 'var(--card-bg)';
        option.style.borderColor = 'var(--border)';
    });
    
    // Adiciona seleção atual
    const selectedOption = document.querySelector(`label[onclick*="${processType}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
        selectedOption.style.background = processInfo.color + '20';
        selectedOption.style.borderColor = processInfo.color;
    }
    
    // Mostra informações do processo selecionado
    const infoContainer = document.getElementById('selectedProcessInfo');
    if (infoContainer) {
        infoContainer.style.display = 'block';
        infoContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                <div style="width: 40px; height: 40px; background: ${processInfo.color}; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-cogs" style="color: white; font-size: 20px;"></i>
                </div>
                <div style="flex: 1;">
                    <h5 style="margin: 0; color: var(--text); font-size: 16px;">
                        ${processInfo.name} <span style="color: ${processInfo.color}; font-weight: 700;">(${processInfo.type})</span>
                    </h5>
                    <p style="margin: 5px 0 0; color: var(--text-light); font-size: 13px;">
                        ${processInfo.description}
                    </p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px;">
                <div style="text-align: center; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; color: var(--danger); margin-bottom: 5px;">
                        <i class="fas fa-exclamation-triangle"></i> Baixa Reserva
                    </div>
                    <div style="font-size: 18px; font-weight: 800; color: var(--danger);">
                        ≤ ${processInfo.limits.CRITICO}
                    </div>
                </div>
                
                <div style="text-align: center; background: rgba(245, 158, 11, 0.1); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; color: var(--warning); margin-bottom: 5px;">
                        <i class="fas fa-exclamation-circle"></i> Baixo Estoque
                    </div>
                    <div style="font-size: 18px; font-weight: 800; color: var(--warning);">
                        ${processInfo.limits.CRITICO + 1}-${processInfo.limits.BAIXO}
                    </div>
                </div>
                
                <div style="text-align: center; background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; color: var(--success); margin-bottom: 5px;">
                        <i class="fas fa-check-circle"></i> Bem Abastecido
                    </div>
                    <div style="font-size: 18px; font-weight: 800; color: var(--success);">
                        ≥ ${processInfo.limits.NORMAL}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 15px; text-align: center; font-size: 12px; color: var(--text-light);">
                <i class="fas fa-info-circle"></i> Estes limites serão aplicados à máquina ${machineId}
            </div>
            
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="saveProcessOnChange('${machineId}', '${processType}', '${currentPrefix}')" 
                        class="btn" style="background: var(--success); color: white; width: 100%;">
                    <i class="fas fa-save"></i> Salvar Processo ${processType}
                </button>
            </div>
        `;
    }
}

/**
 * Cancela a seleção de processo e volta à visualização normal
 */
function cancelProcessSelection(machineId, currentPrefix = null, currentProcess = null) {
    // Recarrega a interface simplificada
    showSimplifiedProcessSelection(machineId, currentPrefix, currentProcess);
}

/**
 * Exporta configurações de limites por processo
 */
function exportProcessLimits() {
    const exportData = {
        exportedAt: new Date().toISOString(),
        config: PROCESS_LIMITS_CONFIG,
        note: "Limites predefinidos por tipo de processo"
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `process_limits_config_${new Date().getTime()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('sucesso', 'Configuração de limites exportada com sucesso!');
}

// ================= FUNÇÕES AUXILIARES =================

/**
 * Atualiza os previews dos limites na interface
 */
function updateLimitPreviews() {
    const critico = parseInt(document.getElementById('limitCritico').value) || 3;
    const baixo = parseInt(document.getElementById('limitBaixo').value) || 5;
    const normal = parseInt(document.getElementById('limitNormal').value) || 6;
    
    document.getElementById('previewCritico').textContent = critico;
    document.getElementById('previewBaixoMin').textContent = critico + 1;
    document.getElementById('previewBaixoMax').textContent = baixo;
    document.getElementById('previewNormal').textContent = normal;
}

// ================= EXPORTAÇÃO PARA ESCOPO GLOBAL =================
window.PROCESS_LIMITS_CONFIG = PROCESS_LIMITS_CONFIG;
window.getLimitsByProcessType = getLimitsByProcessType;
window.getProcessTypeName = getProcessTypeName;
window.getProcessTypeDescription = getProcessTypeDescription;
window.getProcessTypeColor = getProcessTypeColor;
window.getAllProcessTypes = getAllProcessTypes;
window.getProcessTypeInfo = getProcessTypeInfo;
window.isValidProcessType = isValidProcessType;
window.getMachineLimitsByProcess = getMachineLimitsByProcess;
window.loadProcessLimitsForMachine = loadProcessLimitsForMachine;
window.updateUIWithProcessLimits = updateUIWithProcessLimits;
window.showProcessTypeInfo = showProcessTypeInfo;
window.exportProcessLimits = exportProcessLimits;

// NOVAS FUNÇÕES PARA O SISTEMA SIMPLIFICADO
window.showSimplifiedProcessSelection = showSimplifiedProcessSelection;
window.saveProcessOnChange = saveProcessOnChange;
window.showFullProcessSelection = showFullProcessSelection;
window.selectProcessOption = selectProcessOption;
window.cancelProcessSelection = cancelProcessSelection;
window.updateLimitPreviews = updateLimitPreviews;

console.log("✅ Sistema de limites por tipo de processo carregado (versão simplificada)");

// ================= INICIALIZAÇÃO AUTOMÁTICA =================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🔧 Sistema de limites por processo pronto");
});