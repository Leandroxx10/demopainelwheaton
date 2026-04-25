// ================= FIX FILTRO DE MANUTENÇÃO - ARQUIVO INDEPENDENTE =================
// Nome do arquivo: fix-maintenance-filter.js
// Data: 11/02/2026
// Descrição: Este arquivo corrige o problema de máquinas em manutenção aparecerem
//            quando filtros estão ativos. Deve ser carregado APÓS cards.js

(function() {
    "use strict";
    
    console.log("🔧 [FIX-MANUTENÇÃO] Inicializando correção do filtro de manutenção...");
    
    // ================= CONFIGURAÇÕES =================
    const CONFIG = {
        DEBUG: true,              // Ativar logs detalhados
        FORCAR_FILTRO: true,      // Forçar exclusão de manutenção em TODOS os filtros
        TEMPO_VERIFICACAO: 500,   // Tempo entre verificações (ms)
        RETENTATIVAS: 3           // Número de retentativas ao aplicar filtros
    };
    
    // ================= ESTADO GLOBAL =================
    let estadoInicializado = false;
    let ultimaAplicacaoFiltros = 0;
    let maquinasManutencao = new Set();
    let intervaloMonitoramento = null;
    
    // ================= FUNÇÃO PRINCIPAL DE CORREÇÃO =================
    function inicializarCorrecaoManutencao() {
        if (estadoInicializado) {
            console.log("⚠️ [FIX-MANUTENÇÃO] Correção já inicializada");
            return;
        }
        
        console.log("🚀 [FIX-MANUTENÇÃO] Iniciando correção do filtro de manutenção...");
        
        // 1. Sobrescrever funções críticas
        sobrescreverFuncoesCriticas();
        
        // 2. Monitorar Firebase em tempo real
        monitorarStatusManutencao();
        
        // 3. Interceptar cliques em filtros
        interceptarFiltros();
        
        // 4. Patch no método applyFilters original
        patchApplyFilters();
        
        // 5. Garantir que carrosséis sejam atualizados
        patchCarrossel();
        
        estadoInicializado = true;
        console.log("✅ [FIX-MANUTENÇÃO] Correção inicializada com sucesso!");
        
        // Executar verificação inicial
        setTimeout(() => {
            verificarEForcarCorrecao();
        }, 1000);
    }
    
    // ================= 1. SOBRESCREVER FUNÇÕES CRÍTICAS =================
    function sobrescreverFuncoesCriticas() {
        console.log("📝 [FIX-MANUTENÇÃO] Sobrescrevendo funções críticas...");
        
        // Salvar referência da função original
        const originalApplyFilters = window.applyFilters;
        
        // Nova implementação com correção de manutenção
        window.applyFilters = function() {
            const args = arguments;
            logDebug("applyFilters interceptado - Removendo máquinas em manutenção");
            
            // Verificar se há filtros ativos
            const temFiltrosAtivos = verificarFiltrosAtivos();
            
            // Garantir que máquinas em manutenção sejam removidas dos filtros
            if (temFiltrosAtivos) {
                removerManutencaoDasMaquinasFiltradas();
            }
            
            // Chamar função original
            if (typeof originalApplyFilters === 'function') {
                return originalApplyFilters.apply(this, args);
            }
            
            logAviso("applyFilters original não encontrado");
            return null;
        };
        
        // Sobrescrever toggleFornoFilter
        if (window.toggleFornoFilter) {
            const originalToggleForno = window.toggleFornoFilter;
            window.toggleFornoFilter = function(forno) {
                logDebug(`Filtro de forno (${forno}) interceptado`);
                const resultado = originalToggleForno.apply(this, arguments);
                
                // Forçar exclusão de manutenção após aplicar filtro
                setTimeout(() => {
                    removerManutencaoDasMaquinasFiltradas();
                    if (typeof window.applyFilters === 'function') {
                        window.applyFilters();
                    }
                }, 50);
                
                return resultado;
            };
        }
        
        // Sobrescrever toggleStatusFilter
        if (window.toggleStatusFilter) {
            const originalToggleStatus = window.toggleStatusFilter;
            window.toggleStatusFilter = function(status) {
                logDebug(`Filtro de status (${status}) interceptado`);
                const resultado = originalToggleStatus.apply(this, arguments);
                
                setTimeout(() => {
                    removerManutencaoDasMaquinasFiltradas();
                    if (typeof window.applyFilters === 'function') {
                        window.applyFilters();
                    }
                }, 50);
                
                return resultado;
            };
        }
        
        // Sobrescrever filterMachinesBySearch
        if (window.filterMachinesBySearch) {
            const originalFilterSearch = window.filterMachinesBySearch;
            window.filterMachinesBySearch = function() {
                logDebug(`Filtro de busca interceptado`);
                const resultado = originalFilterSearch.apply(this, arguments);
                
                setTimeout(() => {
                    removerManutencaoDasMaquinasFiltradas();
                    if (typeof window.applyFilters === 'function') {
                        window.applyFilters();
                    }
                }, 50);
                
                return resultado;
            };
        }
        
        // Sobrescrever clearAllFilters
        if (window.clearAllFilters) {
            const originalClearFilters = window.clearAllFilters;
            window.clearAllFilters = function() {
                logDebug(`Limpar todos os filtros interceptado`);
                maquinasManutencao.clear();
                const resultado = originalClearFilters.apply(this, arguments);
                return resultado;
            };
        }
    }
    
    // ================= 2. MONITORAR FIREBASE EM TEMPO REAL =================
    function monitorarStatusManutencao() {
        console.log("📡 [FIX-MANUTENÇÃO] Configurando monitoramento do Firebase...");
        
        // Verificar se Firebase está disponível
        if (typeof manutencaoRef === 'undefined') {
            logErro("manutencaoRef não encontrado. Tentando novamente em 2s...");
            setTimeout(monitorarStatusManutencao, 2000);
            return;
        }
        
        // Monitorar TODAS as alterações no nó de manutenção
        manutencaoRef.on("value", function(snapshot) {
            const dados = snapshot.val() || {};
            logDebug(`📥 Atualização recebida do Firebase - ${Object.keys(dados).length} máquinas em manutenção`);
            
            // Atualizar Set de máquinas em manutenção
            maquinasManutencao.clear();
            
            Object.keys(dados).forEach(machineId => {
                const status = dados[machineId];
                if (status && status.isInMaintenance === true) {
                    maquinasManutencao.add(machineId);
                    logDebug(`➕ Máquina ${machineId} EM MANUTENÇÃO`);
                }
            });
            
            logInfo(`🛠️ ${maquinasManutencao.size} máquinas em manutenção monitoradas`);
            
            // Verificar filtros ativos e atualizar UI
            verificarEForcarCorrecao();
            
        }, function(error) {
            logErro(`Erro ao monitorar manutenção: ${error.message}`);
        });
        
        // Monitorar também o nó machineMaintenance do cards.js (se existir)
        if (typeof window.machineMaintenance !== 'undefined') {
            Object.defineProperty(window, 'machineMaintenance', {
                get: function() { return window._machineMaintenance; },
                set: function(novoValor) {
                    window._machineMaintenance = novoValor;
                    if (novoValor && typeof novoValor === 'object') {
                        atualizarMaquinasManutencaoDeObjeto(novoValor);
                    }
                }
            });
            
            if (window.machineMaintenance) {
                atualizarMaquinasManutencaoDeObjeto(window.machineMaintenance);
            }
        }
    }
    
    function atualizarMaquinasManutencaoDeObjeto(objeto) {
        if (!objeto) return;
        
        Object.keys(objeto).forEach(machineId => {
            const status = objeto[machineId];
            if (status && status.isInMaintenance === true) {
                maquinasManutencao.add(machineId);
            }
        });
    }
    
    // ================= 3. INTERCEPTAR FILTROS =================
    function interceptarFiltros() {
        console.log("🎯 [FIX-MANUTENÇÃO] Interceptando eventos de filtros...");
        
        // Interceptar TODOS os botões de filtro
        document.addEventListener('click', function(e) {
            // Verificar se clicou em botão de filtro
            const filtroBtn = e.target.closest('.filter-btn');
            
            if (filtroBtn) {
                // Delay para permitir que o evento original seja processado
                setTimeout(() => {
                    logDebug(`Botão de filtro clicado - Aplicando correção de manutenção`);
                    
                    // Forçar remoção de máquinas em manutenção
                    removerManutencaoDasMaquinasFiltradas();
                    
                    // Forçar reaplicação dos filtros
                    if (typeof window.applyFilters === 'function') {
                        window.applyFilters();
                    }
                    
                    // Atualizar carrosséis
                    atualizarCarrosseis();
                    
                }, 100);
            }
        }, true); // Usar captura para garantir que executamos DEPOIS do evento original
        
        // Interceptar busca
        const searchInput = document.getElementById('machineSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                setTimeout(() => {
                    removerManutencaoDasMaquinasFiltradas();
                    if (typeof window.applyFilters === 'function') {
                        window.applyFilters();
                    }
                }, 150);
            });
        }
    }
    
    // ================= 4. PATCH NO APPLY FILTERS ORIGINAL =================
    function patchApplyFilters() {
        // Verificar se filteredMachinesData existe
        if (typeof window.filteredMachinesData !== 'undefined') {
            const descriptor = Object.getOwnPropertyDescriptor(window, 'filteredMachinesData');
            
            if (!descriptor || descriptor.configurable) {
                let _filteredMachinesData = window.filteredMachinesData;
                
                Object.defineProperty(window, 'filteredMachinesData', {
                    get: function() { return _filteredMachinesData; },
                    set: function(novoValor) {
                        // Interceptar quando os dados filtrados são definidos
                        _filteredMachinesData = novoValor;
                        
                        // Verificar se há filtros ativos
                        const temFiltrosAtivos = verificarFiltrosAtivos();
                        
                        if (temFiltrosAtivos && maquinasManutencao.size > 0 && _filteredMachinesData) {
                            logDebug(`🧹 Removendo ${maquinasManutencao.size} máquinas em manutenção dos dados filtrados`);
                            
                            // Criar novo objeto SEM máquinas em manutenção
                            const novoFiltered = {};
                            
                            Object.keys(_filteredMachinesData).forEach(machineId => {
                                if (!maquinasManutencao.has(machineId)) {
                                    novoFiltered[machineId] = _filteredMachinesData[machineId];
                                } else {
                                    logDebug(`❌ Máquina ${machineId} removida dos filtros (em manutenção)`);
                                }
                            });
                            
                            _filteredMachinesData = novoFiltered;
                        }
                    },
                    configurable: true
                });
            }
        }
    }
    
    // ================= 5. PATCH NO CARROSSEL =================
    function patchCarrossel() {
        console.log("🔄 [FIX-MANUTENÇÃO] Aplicando patch nos carrosséis...");
        
        // Sobrescrever generateFornoSections se existir
        if (window.generateFornoSections) {
            const originalGenerate = window.generateFornoSections;
            
            window.generateFornoSections = function() {
                logDebug("generateFornoSections interceptado");
                
                // Verificar se há filtros ativos
                const temFiltrosAtivos = verificarFiltrosAtivos();
                
                if (temFiltrosAtivos) {
                    // Se há filtros ativos, NÃO devemos mostrar o carrossel com máquinas em manutenção
                    // A função original já deve ter tratado isso através do applyFilters patch
                    logInfo("Filtros ativos - carrossel não será gerado");
                    
                    // Garantir que cards container seja usado
                    const fornoSections = document.getElementById('fornoSections');
                    const cardsContainer = document.getElementById('cardsContainer');
                    
                    if (fornoSections) fornoSections.style.display = 'none';
                    if (cardsContainer) cardsContainer.style.display = 'grid';
                    
                    return;
                }
                
                // Sem filtros, gerar carrossel normalmente
                const resultado = originalGenerate.apply(this, arguments);
                
                // Pós-processamento para remover cards de manutenção se houver filtros ativos
                setTimeout(() => {
                    const temFiltrosAgora = verificarFiltrosAtivos();
                    if (temFiltrosAgora) {
                        removerManutencaoDoCarrossel();
                    }
                }, 200);
                
                return resultado;
            };
        }
        
        // Patch nas funções de scroll do carrossel
        const funcoesScroll = ['scrollFornoLeft', 'scrollFornoRight'];
        
        funcoesScroll.forEach(nomeFuncao => {
            if (window[nomeFuncao]) {
                const originalScroll = window[nomeFuncao];
                
                window[nomeFuncao] = function(forno) {
                    // Verificar filtros antes de scroll
                    const temFiltros = verificarFiltrosAtivos();
                    
                    if (temFiltros) {
                        logDebug(`Scroll bloqueado - filtros ativos`);
                        return;
                    }
                    
                    return originalScroll.apply(this, arguments);
                };
            }
        });
    }
    
    // ================= FUNÇÕES AUXILIARES =================
    function verificarFiltrosAtivos() {
        // Verificar filtros no activeFilters
        if (window.activeFilters) {
            const fornosAtivos = window.activeFilters.fornos && window.activeFilters.fornos.length > 0;
            const statusAtivo = window.activeFilters.status !== null && window.activeFilters.status !== undefined;
            const buscaAtiva = window.activeFilters.search && window.activeFilters.search.trim() !== '';
            
            return fornosAtivos || statusAtivo || buscaAtiva;
        }
        
        // Fallback: verificar DOM
        const fornoBtns = document.querySelectorAll('.filter-btn[data-forno].active');
        const statusBtns = document.querySelectorAll('.filter-btn[data-status].active');
        const searchInput = document.getElementById('machineSearch');
        const searchValue = searchInput ? searchInput.value.trim() : '';
        
        return fornoBtns.length > 0 || statusBtns.length > 0 || searchValue !== '';
    }
    
    function removerManutencaoDasMaquinasFiltradas() {
        // Verificar se filteredMachinesData existe
        if (!window.filteredMachinesData || maquinasManutencao.size === 0) {
            return;
        }
        
        const temFiltros = verificarFiltrosAtivos();
        
        if (!temFiltros && !CONFIG.FORCAR_FILTRO) {
            return;
        }
        
        logDebug(`🧹 Removendo máquinas em manutenção dos dados filtrados...`);
        let removidas = 0;
        
        // Criar novo objeto sem máquinas em manutenção
        const novoFiltered = {};
        
        Object.keys(window.filteredMachinesData).forEach(machineId => {
            if (!maquinasManutencao.has(machineId)) {
                novoFiltered[machineId] = window.filteredMachinesData[machineId];
            } else {
                removidas++;
                logDebug(`🗑️ Máquina ${machineId} removida do filtro (manutenção)`);
            }
        });
        
        if (removidas > 0) {
            window.filteredMachinesData = novoFiltered;
            logInfo(`✅ ${removidas} máquinas em manutenção removidas dos filtros`);
        }
        
        // Atualizar estatísticas
        if (typeof window.updateStatistics === 'function') {
            window.updateStatistics();
        }
    }
    
    function removerManutencaoDoCarrossel() {
        const temFiltros = verificarFiltrosAtivos();
        
        if (!temFiltros) {
            return;
        }
        
        logDebug(`🧹 Removendo cards de manutenção do carrossel...`);
        
        // Remover cards de manutenção de TODOS os carrosséis
        maquinasManutencao.forEach(machineId => {
            const cardsManutencao = document.querySelectorAll(`.machine-card.maintenance[data-machine-id="${machineId}"]`);
            
            cardsManutencao.forEach(card => {
                if (card && card.parentNode) {
                    logDebug(`🗑️ Removendo card de manutenção: Máquina ${machineId}`);
                    card.style.display = 'none';
                    card.remove();
                }
            });
        });
        
        // Verificar se algum carrossel ficou vazio
        document.querySelectorAll('.forno-cards-container').forEach(container => {
            if (container.children.length === 0) {
                const fornoSection = container.closest('.forno-section');
                if (fornoSection) {
                    const emptyMsg = fornoSection.querySelector('.forno-empty');
                    if (!emptyMsg) {
                        const forno = fornoSection.id.replace('forno-', '');
                        container.innerHTML = `
                            <div class="forno-empty" style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--card-bg); border-radius: 12px; margin: 20px 0;">
                                <i class="fas fa-industry" style="font-size: 40px; color: var(--text-light); margin-bottom: 15px;"></i>
                                <p style="color: var(--text-light);">Nenhuma máquina disponível no Forno ${forno}</p>
                                <p style="font-size: 13px; color: var(--text-light); margin-top: 5px;">Todas as máquinas estão em manutenção ou filtradas</p>
                            </div>
                        `;
                    }
                }
            }
        });
    }
    
    function atualizarCarrosseis() {
        // Atualizar controles dos carrosséis
        ['A', 'B', 'C', 'D'].forEach(forno => {
            if (typeof window.updateCarouselControls === 'function') {
                window.updateCarouselControls(forno);
            }
        });
    }
    
    function verificarEForcarCorrecao() {
        const agora = Date.now();
        
        // Evitar execução muito frequente
        if (agora - ultimaAplicacaoFiltros < CONFIG.TEMPO_VERIFICACAO) {
            return;
        }
        
        ultimaAplicacaoFiltros = agora;
        
        const temFiltros = verificarFiltrosAtivos();
        
        if (temFiltros) {
            logDebug("🔍 Verificação: Filtros ativos encontrados");
            
            // 1. Remover dos dados filtrados
            removerManutencaoDasMaquinasFiltradas();
            
            // 2. Remover do carrossel
            removerManutencaoDoCarrossel();
            
            // 3. Reaplicar filtros
            if (typeof window.applyFilters === 'function') {
                window.applyFilters();
            }
            
            // 4. Atualizar estatísticas
            if (typeof window.updateStatistics === 'function') {
                window.updateStatistics();
            }
        }
    }
    
    // ================= LOGGING =================
    function logDebug(mensagem) {
        if (CONFIG.DEBUG) {
            console.log(`🐛 [FIX-MANUTENÇÃO] ${mensagem}`);
        }
    }
    
    function logInfo(mensagem) {
        console.log(`ℹ️ [FIX-MANUTENÇÃO] ${mensagem}`);
    }
    
    function logAviso(mensagem) {
        console.warn(`⚠️ [FIX-MANUTENÇÃO] ${mensagem}`);
    }
    
    function logErro(mensagem) {
        console.error(`❌ [FIX-MANUTENÇÃO] ${mensagem}`);
    }
    
    // ================= INJEÇÃO DE CSS =================
    function injetarCSS() {
        const styleId = 'fix-maintenance-styles';
        
        if (document.getElementById(styleId)) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Garantir que cards de manutenção não apareçam quando filtros estão ativos */
            body.filters-active .machine-card.maintenance,
            .filters-bar.active ~ .forno-sections .machine-card.maintenance {
                display: none !important;
            }
            
            /* Indicador visual de filtro ativo */
            .filter-btn.active {
                position: relative;
                overflow: hidden;
            }
            
            .filter-btn.active::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.2);
                pointer-events: none;
            }
            
            /* Transição suave para remoção de cards */
            .machine-card {
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            
            .machine-card[style*="display: none"] {
                opacity: 0;
                transform: scale(0.8);
            }
        `;
        
        document.head.appendChild(style);
        logDebug("CSS injetado");
    }
    
    // ================= INICIALIZAÇÃO AUTOMÁTICA =================
    function iniciarQuandoPronto() {
        // Injetar CSS
        injetarCSS();
        
        // Verificar se Firebase e cards.js estão prontos
        if (typeof manutencaoRef !== 'undefined' && typeof window.initCardsDashboard === 'function') {
            inicializarCorrecaoManutencao();
        } else {
            logAviso("Firebase ou cards.js não disponíveis. Aguardando 1s...");
            setTimeout(iniciarQuandoPronto, 1000);
        }
        
        // Monitorar mudanças na barra de filtros
        const filtersBar = document.getElementById('filtersBar');
        if (filtersBar) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'class') {
                        const hasActive = filtersBar.classList.contains('active');
                        document.body.classList.toggle('filters-active', hasActive);
                        
                        if (hasActive) {
                            setTimeout(() => {
                                removerManutencaoDoCarrossel();
                            }, 100);
                        }
                    }
                });
            });
            
            observer.observe(filtersBar, { attributes: true });
        }
    }
    
    // Iniciar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarQuandoPronto);
    } else {
        iniciarQuandoPronto();
    }
    
    // ================= API PÚBLICA =================
    window.fixMaintenanceFilter = {
        getMaquinasManutencao: function() {
            return Array.from(maquinasManutencao);
        },
        forcarVerificacao: verificarEForcarCorrecao,
        removerManutencaoDosFiltros: removerManutencaoDasMaquinasFiltradas,
        debug: function() {
            console.log("=== [FIX-MANUTENÇÃO] DEBUG ===");
            console.log("Máquinas em manutenção:", Array.from(maquinasManutencao));
            console.log("Filtros ativos:", verificarFiltrosAtivos());
            console.log("ActiveFilters:", window.activeFilters);
            console.log("FilteredMachinesData:", window.filteredMachinesData ? Object.keys(window.filteredMachinesData).length : 'N/A');
            console.log("===============================");
        }
    };
    
})();