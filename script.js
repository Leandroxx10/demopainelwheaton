// ====================================================
// CONFIGURAÇÃO PRINCIPAL
// ====================================================

// Dados das máquinas
let dadosMaquinas = {};
let machineMaintenance = {};

// Prefixos pré-definidos - AGORA CARREGADOS DO FIREBASE
let prefixos = [];

// Configurações do sistema (agora sincronizadas com Firebase)
let config = {
    mostrarReserva: true,
    mostrarFunil: true,
    mostrarNeckring: true,
    mostrarBlank: true,
    mostrarMolde: true,
    mostrarPrefixo: true,
    alertasAtivos: true,
    animacoesAtivas: true,
    autoAtualizar: true,
    mostrarTotais: true,
    mostrarGraficos: true,
    tema: 'ciano',
    estoqueMinimo: 3
};

// Configuração de filtro por forno
let fornoAtivo = 'todos';
let clicksTitulo = 0;
let timeoutClicks = null;

// Controle para mostrar apenas máquinas críticas
let mostrarCriticos = false;

// Evita gravações duplicadas quando o usuário clica rapidamente ou o navegador dispara o mesmo evento novamente.
const pendingMachineWrites = new Set();

// Estado do modo escuro
let modoEscuroAtivo = localStorage.getItem('modoEscuro') === 'true';

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');
const preloader = document.getElementById('preloader');
const tituloPrincipal = document.getElementById('tituloPrincipal');

// Gráficos
let graficoProducao = null;
let graficoTotal = null;

// ====================================================
// INICIALIZAÇÃO
// ====================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 Inicializando sistema...");
    
    // Aplicar modo escuro se estiver ativo
    if (modoEscuroAtivo) {
        document.body.classList.add('dark-mode');
        document.querySelector('.dark-mode-toggle').innerHTML = '<i class="fas fa-sun"></i> Modo Claro';
    }
    
    // Ocultar preloader após 1.5 segundos
    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    }, 1500);
    
    // Verificar autenticação
    const user = await checkAuth();
    
    if (user) {
        // Usuário autenticado
        loginScreen.style.display = 'none';
        mainContent.style.display = 'block';
        
        // Carregar configurações
        carregarConfiguracoes();
        
        // Carregar prefixos
        carregarPrefixos();
        
        // Inicializar listeners do Firebase
        inicializarFirebaseListeners();

        // Carregar dados imediatamente, sem depender do clique em Atualizar
        inicializarCarregamentoAutomaticoMaquinas();
        
        // Inicializar gráficos
        inicializarGraficos();
        
        // Configurar evento do título
        configurarEventoTitulo();
        
        console.log("✅ Sistema inicializado para:", user.email);
    } else {
        // Mostrar tela de login
        loginScreen.style.display = 'block';
        mainContent.style.display = 'none';
        
        // Configurar formulário de login
        configurarLogin();
    }
});

// ====================================================
// SISTEMA DE LOGIN
// ====================================================

function configurarLogin() {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!email || !password) {
            mostrarErroLogin("Preencha todos os campos");
            return;
        }
        
        const resultado = await login(email, password);
        
        if (resultado.success) {
            // Login bem-sucedido
            mostrarNotificacao("Login realizado com sucesso!", "success");
            
            // Recarregar a página para inicializar o sistema
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            // Login falhou
            mostrarErroLogin(resultado.error);
        }
    });
}

function mostrarErroLogin(mensagem) {
    errorMessage.textContent = mensagem;
    errorMessage.style.display = 'block';
    passwordInput.classList.add('error');
    
    setTimeout(() => {
        passwordInput.classList.remove('error');
    }, 1000);
}

// ====================================================
// CARREGAR CONFIGURAÇÕES
// ====================================================

function carregarConfiguracoes() {
    db.ref("configuracoes").once("value").then(snapshot => {
        const configSalva = snapshot.val();
        if (configSalva) {
            config = configSalva;
            
            // Aplicar configurações aos checkboxes (se o painel admin existir)
            if (document.getElementById('toggleReserva')) {
                document.getElementById('toggleReserva').checked = config.mostrarReserva;
                document.getElementById('toggleFunil').checked = config.mostrarFunil;
                document.getElementById('toggleNeckring').checked = config.mostrarNeckring;
                document.getElementById('toggleBlank').checked = config.mostrarBlank;
                document.getElementById('toggleMolde').checked = config.mostrarMolde;
                document.getElementById('togglePrefixo').checked = config.mostrarPrefixo;
                document.getElementById('toggleAlertas').checked = config.alertasAtivos;
                document.getElementById('toggleAnimacoes').checked = config.animacoesAtivas;
                document.getElementById('autoAtualizar').checked = config.autoAtualizar;
                document.getElementById('mostrarTotais').checked = config.mostrarTotais;
                document.getElementById('mostrarGraficos').checked = config.mostrarGraficos;
                document.getElementById('estoqueMinimo').value = config.estoqueMinimo;
            }
            
            // Atualizar label do estoque mínimo
            document.getElementById('estoqueMinimoLabel').textContent = config.estoqueMinimo;
            
            // Aplicar tema
            aplicarTema(config.tema);
            
            // Aplicar visibilidade dos totais
            const totaisElement = document.getElementById('totais');
            if (totaisElement) {
                totaisElement.style.display = config.mostrarTotais ? 'grid' : 'none';
            }
            
            // Aplicar visibilidade dos gráficos
            const graficosElement = document.querySelector('.graficos-container');
            if (graficosElement) {
                graficosElement.style.display = config.mostrarGraficos ? 'grid' : 'none';
            }
            
            console.log("✅ Configurações carregadas");
        }
    }).catch(error => {
        console.error("❌ Erro ao carregar configurações:", error);
    });
}

// ====================================================
// CARREGAR PREFIXOS
// ====================================================

function carregarPrefixos() {
    try {
        if (typeof db === 'undefined') {
            console.warn("⚠️ Firebase ainda não inicializado para carregar prefixos");
            prefixos = [];
            return;
        }

        // Listener em tempo real: quando um prefixo detalhado for criado/editado/removido
        // em qualquer um dos dois projetos, os selects e os cards são atualizados sem refresh.
        db.ref("prefixDatabase").on("value", snapshot => {
            try {
                prefixos = buildPrefixList(snapshot.val() || {});
                console.log("✅ Prefixos detalhados sincronizados:", prefixos.length);

                if (typeof dadosMaquinas !== 'undefined' && Object.keys(dadosMaquinas || {}).length > 0) {
                    criarPainel(dadosMaquinas);
                }
            } catch (innerError) {
                console.error("❌ Erro ao processar prefixos:", innerError);
                prefixos = [];
            }
        }, error => {
            console.error("❌ Erro ao sincronizar prefixos:", error);
            prefixos = [];
        });
    } catch (error) {
        console.error("❌ Erro ao iniciar sincronização de prefixos:", error);
        prefixos = [];
    }
}

// ====================================================
// INICIALIZAR LISTENERS DO FIREBASE
// ====================================================

function inicializarFirebaseListeners() {
    // Listener em tempo real para dados das máquinas.
    // Qualquer alteração feita em outra tela/usuário atualiza o dashboard sem precisar clicar em Atualizar.
    db.ref("maquinas").on("value", snapshot => {
        const dados = snapshot.val();
        if (dados) {
            window.__wmoldesUltimoSnapshotMaquinas = dados;
            window.__wmoldesUltimaMudancaMaquinas = Date.now();
            aplicarDadosMaquinas(dados);
            agendarAtualizacaoTempoRealMaquinas(dados);
        }
    });
    
    // Listener para manutenção (compartilhado entre os dois sites)
    db.ref("manutencao").on("value", snapshot => {
        machineMaintenance = snapshot.val() || {};
        window.machineMaintenance = machineMaintenance;
        if (Object.keys(dadosMaquinas).length > 0) {
            criarPainel(dadosMaquinas);
        }
    });

    // Listener para configurações (sincroniza entre todos os usuários)
    db.ref("configuracoes").on("value", snapshot => {
        const configSalva = snapshot.val();
        if (configSalva) {
            config = configSalva;
            
            // Aplicar configurações imediatamente
            document.getElementById('estoqueMinimoLabel').textContent = config.estoqueMinimo;
            
            const totaisElement = document.getElementById('totais');
            if (totaisElement) {
                totaisElement.style.display = config.mostrarTotais ? 'grid' : 'none';
            }
            
            const graficosElement = document.querySelector('.graficos-container');
            if (graficosElement) {
                graficosElement.style.display = config.mostrarGraficos ? 'grid' : 'none';
            }
            
            aplicarTema(config.tema);
            
            // Atualizar painel se necessário
            if (Object.keys(dadosMaquinas).length > 0) {
                criarPainel(dadosMaquinas);
            }
        }
    });
}

// ====================================================
// FUNÇÃO: CRIAR PAINEL DE MÁQUINAS
// ====================================================

function criarPainel(maquinas) {
    dadosMaquinas = maquinas;
    const filtro = document.getElementById("filtro").value.toLowerCase();
    const painel = document.getElementById("painel");
    
    if (!painel) return;
    
    painel.innerHTML = "";
    
    // Inicializar totais
    let totalMolde = 0;
    let totalBlank = 0;
    let totalNeckRing = 0;
    let totalFunil = 0;
    let totalCriticos = 0;

    // Filtrar máquinas (todas ou apenas críticas)
    let maquinasFiltradas = Object.entries(maquinas);
    
    if (mostrarCriticos) {
        maquinasFiltradas = maquinasFiltradas
            .filter(([_, m]) => 
                (m.molde || 0) <= config.estoqueMinimo || 
                (m.blank || 0) <= config.estoqueMinimo ||
                (m.funil || 0) <= config.estoqueMinimo
            );
    }

    // Filtrar por forno
    if (fornoAtivo !== 'todos') {
        // Array de IDs esperados para cada forno
        const idsEsperados = {
            'A': ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
            'B': ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
            'C': ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
            'D': ['10', '11', '12', '13', '14', '15']
        };
        
        if (idsEsperados[fornoAtivo]) {
            maquinasFiltradas = maquinasFiltradas.filter(([id, _]) => 
                idsEsperados[fornoAtivo].includes(id)
            );
        }
    }

    // Ordenar máquinas por ID
    maquinasFiltradas.sort((a, b) => a[0].localeCompare(b[0]));

    // Criar cartão para cada máquina
    for (let [id, m] of maquinasFiltradas) {
        // Pular máquinas que não correspondem ao filtro
        if (filtro && !id.toLowerCase().includes(filtro)) continue;
        
        // Calcular totais
        totalMolde += m.molde || 0;
        totalBlank += m.blank || 0;
        totalNeckRing += m.neck_ring || 0;
        totalFunil += m.funil || 0;
        
        // Verificar se a máquina está em estado crítico
        const alerta = config.alertasAtivos && (
            (m.molde || 0) <= config.estoqueMinimo || 
            (m.blank || 0) <= config.estoqueMinimo ||
            (m.funil || 0) <= config.estoqueMinimo
        );
        
        if (alerta) totalCriticos++;

        const isInMaintenance = isMachineInMaintenance(id);
        const maintenanceReason = machineMaintenance[id]?.reason || machineMaintenance[id]?.motivo || '';
        
        // Construir o HTML do cartão da máquina
        let maquinaHTML = `
            <div class="maquina ${alerta ? 'alerta' : ''} ${isInMaintenance ? 'maintenance' : ''}">
                <div class="maquina-header">
                    <div class="maquina-id"><i class="fas fa-industry"></i> Máquina ${id}</div>`;
        
        // Adicionar prefixo se estiver ativado
        if (config.mostrarPrefixo) {
            const currentPrefixo = m.prefixo || '';
            const currentPrefixDisplay = getMachinePrefixDisplay(m, prefixos);
            const currentPrefixRecord =
                findPrefixRecord(prefixos, currentPrefixo) ||
                findPrefixRecord(prefixos, currentPrefixDisplay);

            maquinaHTML += `
                <div class="prefixo-container">
                    <div class="prefixo-actions">
                        <div class="custom-select">
                            <div class="select-selected" onclick="toggleCustomSelect('${id}')">
                                ${currentPrefixDisplay || currentPrefixo || 'Selecione um prefixo'}
                            </div>
                            <div class="select-items" id="select-${id}">
                                <div class="select-search-container prefix-create-row">
                                    <input type="text" id="prefix-search-${id}" class="select-search" placeholder="Pesquisar prefixo..." 
                                           oninput="filtrarOpcoes('${id}', this.value)" onkeydown="criarPrefixoComEnter(event, '${id}')">
                                    <button type="button" class="prefix-add-btn" onclick="criarPrefixoPeloFiltro('${id}', event)" title="Criar prefixo principal e vincular à máquina">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                                ${prefixos.map(pref => `
                                    <div onclick="selecionarPrefixo('${id}', '${pref.id}')" 
                                         ${pref.id === currentPrefixo || pref.displayName === currentPrefixDisplay ? 'class="selected"' : ''}>
                                        <strong>${pref.displayName || pref.nome}</strong>
                                        ${pref.id !== (pref.displayName || pref.nome) ? `<small style="display:block; opacity:.7; margin-top:2px;">${pref.id}</small>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <button
                            type="button"
                            class="prefixo-view-btn ${currentPrefixRecord ? '' : 'disabled'}"
                            onclick="abrirDetalhesPrefixo('${id}')"
                            title="Visualizar informações do prefixo detalhado"
                            ${currentPrefixRecord ? '' : 'disabled'}>
                            <i class="fas fa-eye"></i>
                        </button>
                        <button
                            type="button"
                            class="maintenance-toggle-btn ${isMachineInMaintenance(id) ? 'active' : ''}"
                            onclick="toggleMachineMaintenance('${id}')"
                            title="${isMachineInMaintenance(id) ? 'Retirar da manutenção' : 'Colocar em parada para manutenção'}"
                            aria-pressed="${isMachineInMaintenance(id)}">
                            <i class="fas fa-tools"></i>
                        </button>
                    </div>
                </div>`;
        }
        
        maquinaHTML += `</div>`;

        if (isInMaintenance) {
            maquinaHTML += `
                <div class="maintenance-message">
                    <i class="fas fa-tools"></i> Parada para manutenção${maintenanceReason ? `: ${maintenanceReason}` : ''}
                </div>`;
        }
        
        // Molde
if (config.mostrarMolde) {
    maquinaHTML += `
        <div class="linha">
            <span class="molde-label"><i class="fas fa-cube"></i> Molde:</span>
            <div class="controles">
                <div class="btn-group">
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', -10)">-10</button>
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', -5)">-5</button>
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', -2)">-2</button>
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', -1)">-1</button>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <span id="${id}-molde">${m.molde || 0}</span>
                    <input type="number" 
                           class="input-digitado" 
                           id="input-${id}-molde" 
                           value="${m.molde || 0}"
                           style="width: 60px; padding: 2px; text-align: center; margin-top: 5px; display: none;"
                           onblur="atualizarPorInput('${id}', 'molde', this.value)"
                           onkeypress="if(event.key === 'Enter') { atualizarPorInput('${id}', 'molde', this.value); this.blur(); }">
                </div>
                <div class="btn-group">
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', 1)">+1</button>
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', 2)">+2</button>
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', 5)">+5</button>
                    <button class="molde-bg" onclick="alterar('${id}', 'molde', 10)">+10</button>
                </div>
                <button class="btn-digitado" onclick="toggleModoDigitado('${id}', 'molde')">
                    <i class="fas fa-keyboard"></i>
                </button>
            </div>
        </div>`;
            
            // Molde Reserva
            if (config.mostrarReserva) {
                maquinaHTML += `
                    <div class="linha reserva">
                        <span class="molde-label reserva-label"><i class="fas fa-warehouse"></i> Reserva:</span>
                        <div class="controles">
                            <div class="btn-group">
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', -10)">-10</button>
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', -5)">-5</button>
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', -2)">-2</button>
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', -1)">-1</button>
                            </div>
                            <span id="${id}-molde_reserva">${m.molde_reserva || 0}</span>
                            <div class="btn-group">
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', 1)">+1</button>
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', 2)">+2</button>
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', 5)">+5</button>
                                <button class="molde-bg" onclick="alterar('${id}', 'molde_reserva', 10)">+10</button>
                            </div>
                        </div>
                    </div>`;
            }
        }
        
        // Blank
if (config.mostrarBlank) {
    maquinaHTML += `
        <div class="linha">
            <span class="blank-label"><i class="fas fa-cube"></i> Blank:</span>
            <div class="controles">
                <div class="btn-group">
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', -10)">-10</button>
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', -5)">-5</button>
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', -2)">-2</button>
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', -1)">-1</button>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <span id="${id}-blank">${m.blank || 0}</span>
                    <input type="number" 
                           class="input-digitado" 
                           id="input-${id}-blank" 
                           value="${m.blank || 0}"
                           style="width: 60px; padding: 2px; text-align: center; margin-top: 5px; display: none;"
                           onblur="atualizarPorInput('${id}', 'blank', this.value)"
                           onkeypress="if(event.key === 'Enter') { atualizarPorInput('${id}', 'blank', this.value); this.blur(); }">
                </div>
                <div class="btn-group">
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', 1)">+1</button>
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', 2)">+2</button>
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', 5)">+5</button>
                    <button class="blank-bg" onclick="alterar('${id}', 'blank', 10)">+10</button>
                </div>
                <button class="btn-digitado" onclick="toggleModoDigitado('${id}', 'blank')">
                    <i class="fas fa-keyboard"></i>
                </button>
            </div>
        </div>`;
            
            // Blank Reserva
            if (config.mostrarReserva) {
                maquinaHTML += `
                    <div class="linha reserva">
                        <span class="blank-label reserva-label"><i class="fas fa-warehouse"></i> Reserva:</span>
                        <div class="controles">
                            <div class="btn-group">
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', -10)">-10</button>
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', -5)">-5</button>
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', -2)">-2</button>
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', -1)">-1</button>
                            </div>
                            <span id="${id}-blank_reserva">${m.blank_reserva || 0}</span>
                            <div class="btn-group">
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', 1)">+1</button>
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', 2)">+2</button>
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', 5)">+5</button>
                                <button class="blank-bg" onclick="alterar('${id}', 'blank_reserva', 10)">+10</button>
                            </div>
                        </div>
                    </div>`;
            }
        }
        
        // Neck Ring
        if (config.mostrarNeckring) {
            maquinaHTML += `
                <div class="linha">
                    <span class="neckring-label"><i class="fas fa-ring"></i> Neck Ring:</span>
                    <div class="controles">
                        <div class="btn-group">
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', -10)">-10</button>
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', -5)">-5</button>
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', -2)">-2</button>
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', -1)">-1</button>
                        </div>
                        <span id="${id}-neck_ring">${m.neck_ring || 0}</span>
                        <div class="btn-group">
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', 1)">+1</button>
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', 2)">+2</button>
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', 5)">+5</button>
                            <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring', 10)">+10</button>
                        </div>
                    </div>
                </div>`;
            
            // Neck Ring Reserva
            if (config.mostrarReserva) {
                maquinaHTML += `
                    <div class="linha reserva">
                        <span class="neckring-label reserva-label"><i class="fas fa-warehouse"></i> Reserva:</span>
                        <div class="controles">
                            <div class="btn-group">
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', -10)">-10</button>
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', -5)">-5</button>
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', -2)">-2</button>
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', -1)">-1</button>
                            </div>
                            <span id="${id}-neck_ring_reserva">${m.neck_ring_reserva || 0}</span>
                            <div class="btn-group">
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', 1)">+1</button>
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', 2)">+2</button>
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', 5)">+5</button>
                                <button class="neckring-bg" onclick="alterar('${id}', 'neck_ring_reserva', 10)">+10</button>
                            </div>
                        </div>
                    </div>`;
            }
        }
        
        // Funil
        if (config.mostrarFunil) {
            maquinaHTML += `
                <div class="linha">
                    <span class="funil-label"><i class="fas fa-filter"></i> Funil:</span>
                    <div class="controles">
                        <div class="btn-group">
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', -10)">-10</button>
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', -5)">-5</button>
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', -2)">-2</button>
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', -1)">-1</button>
                        </div>
                        <span id="${id}-funil">${m.funil || 0}</span>
                        <div class="btn-group">
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', 1)">+1</button>
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', 2)">+2</button>
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', 5)">+5</button>
                            <button class="funil-bg" onclick="alterar('${id}', 'funil', 10)">+10</button>
                        </div>
                    </div>
                </div>`;
            
            // Funil Reserva
            if (config.mostrarReserva) {
                maquinaHTML += `
                    <div class="linha reserva">
                        <span class="funil-label reserva-label"><i class="fas fa-warehouse"></i> Reserva:</span>
                        <div class="controles">
                            <div class="btn-group">
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', -10)">-10</button>
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', -5)">-5</button>
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', -2)">-2</button>
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', -1)">-1</button>
                            </div>
                            <span id="${id}-funil_reserva">${m.funil_reserva || 0}</span>
                            <div class="btn-group">
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', 1)">+1</button>
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', 2)">+2</button>
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', 5)">+5</button>
                                <button class="funil-bg" onclick="alterar('${id}', 'funil_reserva', 10)">+10</button>
                            </div>
                        </div>
                    </div>`;
            }
        }
        
        // Mensagem de alerta se necessário
        if (alerta) {
            maquinaHTML += `
                <div class="alert-message">
                    <i class="fas fa-exclamation-triangle"></i> Estoque em nível crítico (≤ ${config.estoqueMinimo} peças)
                </div>`;
        }
        
        maquinaHTML += `</div>`;
        painel.innerHTML += maquinaHTML;
    }

    // Atualizar totais no painel
    atualizarTotais(totalMolde, totalBlank, totalNeckRing, totalFunil, totalCriticos);
}

// ====================================================
// FUNÇÕES AUXILIARES
// ====================================================

function atualizarTotais(totalMolde, totalBlank, totalNeckRing, totalFunil, totalCriticos) {
    const totalMoldeElement = document.getElementById("total-molde");
    const totalBlankElement = document.getElementById("total-blank");
    const totalNeckringElement = document.getElementById("total-neckring");
    const totalFunilElement = document.getElementById("total-funil");
    const totalCriticosElement = document.getElementById("total-criticos");
    
    if (totalMoldeElement) totalMoldeElement.textContent = totalMolde;
    if (totalBlankElement) totalBlankElement.textContent = totalBlank;
    if (totalNeckringElement) totalNeckringElement.textContent = totalNeckRing;
    if (totalFunilElement) totalFunilElement.textContent = totalFunil;
    if (totalCriticosElement) totalCriticosElement.textContent = totalCriticos;
    
    // Atualizar o botão de críticos
    const btn = document.getElementById("btnCriticos");
    if (btn) {
        btn.innerHTML = mostrarCriticos ? 
            `<i class="fas fa-check-circle"></i> Exibindo Críticos (${totalCriticos})` : 
            `<i class="fas fa-exclamation-triangle"></i> Ver Críticos`;
            
        if (mostrarCriticos) {
            btn.classList.add("criticos");
        } else {
            btn.classList.remove("criticos");
        }
    }
}

// ====================================================
// FUNÇÕES PARA O SELECT PESQUISÁVEL
// ====================================================

function toggleCustomSelect(maquinaId) {
    const select = document.getElementById(`select-${maquinaId}`);
    const btn = document.querySelector(`#select-${maquinaId}`).previousElementSibling;
    
    // Fechar todos os outros selects abertos
    document.querySelectorAll('.select-items').forEach(el => {
        if (el.id !== `select-${maquinaId}`) {
            el.style.display = 'none';
            el.previousElementSibling.classList.remove('select-arrow-active');
        }
    });
    
    if (select.style.display === 'block') {
        select.style.display = 'none';
        btn.classList.remove('select-arrow-active');
    } else {
        select.style.display = 'block';
        btn.classList.add('select-arrow-active');
    }
}

function filtrarOpcoes(maquinaId, termo) {
    const select = document.getElementById(`select-${maquinaId}`);
    if (!select) return;
    const itens = select.querySelectorAll(':scope > div:not(.select-search-container)');
    const busca = String(termo || '').toLowerCase();
    
    itens.forEach(item => {
        if (item.textContent.toLowerCase().includes(busca)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function normalizarNovoPrefixo(valor) {
    return String(valor || '').trim().replace(/\s+/g, ' ');
}

function validarChaveFirebasePrefixo(prefixo) {
    return prefixo && !/[.#$\[\]\/]/.test(prefixo);
}

function criarPrefixoComEnter(event, maquinaId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        criarPrefixoPeloFiltro(maquinaId, event);
    }
}

async function criarPrefixoPeloFiltro(maquinaId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const input = document.getElementById(`prefix-search-${maquinaId}`);
    const prefixoId = normalizarNovoPrefixo(input ? input.value : '');

    if (!prefixoId) {
        mostrarNotificacao('Digite o prefixo no campo de pesquisa para criar.', 'warning');
        return;
    }

    if (!validarChaveFirebasePrefixo(prefixoId)) {
        mostrarNotificacao('O prefixo não pode conter os caracteres . # $ [ ] /', 'error');
        return;
    }

    try {
        const ref = db.ref(`prefixDatabase/${prefixoId}`);
        const snap = await ref.once('value');

        if (!snap.exists()) {
            await ref.set({
                nome: prefixoId,
                displayName: prefixoId,
                prefixoDetalhado: prefixoId,
                criadoEm: Date.now(),
                origem: 'atalho_card_maquina'
            });
        }

        if (!prefixos.some(pref => pref.id === prefixoId)) {
            prefixos.push({
                id: prefixoId,
                nome: prefixoId,
                displayName: prefixoId,
                prefixoDetalhado: prefixoId
            });
        }

        selecionarPrefixo(maquinaId, prefixoId);
        mostrarNotificacao(snap.exists() ? `Prefixo vinculado: ${prefixoId}` : `Prefixo criado e vinculado: ${prefixoId}`, 'success');
    } catch (error) {
        console.error('❌ Erro ao criar prefixo:', error);
        mostrarNotificacao('Erro ao criar/vincular prefixo.', 'error');
    }
}

function selecionarPrefixo(maquinaId, prefixoId) {
    // Atualizar o texto exibido
    const btn = document.querySelector(`#select-${maquinaId}`).previousElementSibling;
    btn.textContent = prefixoId;
    btn.classList.remove('select-arrow-active');
    
    // Fechar o dropdown
    document.getElementById(`select-${maquinaId}`).style.display = 'none';
    
    // Atualizar no banco de dados
    atualizarPrefixo(maquinaId, prefixoId);
}

// Fechar selects ao clicar fora
document.addEventListener('click', function(event) {
    if (!event.target.matches('.select-selected') && !event.target.matches('.select-items *')) {
        document.querySelectorAll('.select-items').forEach(el => {
            el.style.display = 'none';
            el.previousElementSibling.classList.remove('select-arrow-active');
        });
    }
});

// ====================================================
// FUNÇÃO: ALTERAR QUANTIDADE DE PEÇAS
// ====================================================

async function alterar(maquinaId, tipo, delta) {
    if (isMachineInMaintenance(maquinaId)) {
        mostrarNotificacao('Máquina em parada para manutenção.', 'warning');
        return;
    }
    const writeKey = `${maquinaId}:${tipo}`;
    if (pendingMachineWrites.has(writeKey)) {
        return;
    }

    const element = document.getElementById(`${maquinaId}-${tipo}`);
    if (!element) return;

    const currentValue = parseInt(element.textContent) || 0;
    const newValue = Math.max(0, currentValue + delta);

    if (newValue === currentValue) return;
    pendingMachineWrites.add(writeKey);

    // Atualização imediata na tela
    element.textContent = newValue;
    element.style.transform = 'scale(1.1)';
    element.style.color = '#0ea5e9';
    setTimeout(() => {
        element.style.transform = '';
        element.style.color = '';
    }, 200);

    try {
        if (typeof setWithAudit === 'function') {
            await setWithAudit(`maquinas/${maquinaId}/${tipo}`, newValue, {
                action: `${delta > 0 ? 'adicionou' : 'removeu'} ${Math.abs(delta)} em ${tipo} da máquina ${maquinaId}`,
                details: `Alteração rápida no painel principal: ${currentValue} → ${newValue}.`,
                entityType: 'machine_change',
                entityId: maquinaId,
                extra: {
                    machineId: maquinaId,
                    field: tipo,
                    origem: 'botao_rapido',
                    delta,
                    before: currentValue,
                    after: newValue
                }
            });
        } else {
            await db.ref(`maquinas/${maquinaId}/${tipo}`).set(newValue);
        }
    } catch (error) {
        console.error('❌ Erro ao alterar quantidade:', error);
        element.textContent = currentValue;
        mostrarNotificacao(`Erro ao salvar alteração da máquina ${maquinaId}.`, 'error');
    } finally {
        pendingMachineWrites.delete(writeKey);
    }
}

// ====================================================
// FUNÇÃO: ATUALIZAR PREFIXO DA MÁQUINA
// ====================================================

async function atualizarPrefixo(maquinaId, prefixoId) {
    const machine = dadosMaquinas?.[maquinaId] || {};
    const before = machine.prefixo || '';
    const after = String(prefixoId || '').trim();

    if (before === after) return;

    try {
        if (typeof setWithAudit === 'function') {
            await setWithAudit(`maquinas/${maquinaId}/prefixo`, after, {
                action: `atualizou prefixo da máquina ${maquinaId}`,
                details: `Prefixo alterado de ${before || 'vazio'} para ${after || 'vazio'}.`,
                entityType: 'machine_prefix',
                entityId: maquinaId,
                extra: {
                    machineId: maquinaId,
                    field: 'prefixo',
                    origem: 'seletor_prefixo'
                }
            });
        } else {
            await db.ref(`maquinas/${maquinaId}/prefixo`).set(after);
        }

        if (dadosMaquinas?.[maquinaId]) {
            dadosMaquinas[maquinaId].prefixo = after;
        }

        mostrarNotificacao(`Prefixo atualizado para: ${after}`, 'info');
    } catch (error) {
        console.error('❌ Erro ao atualizar prefixo:', error);
        mostrarNotificacao(`Erro ao atualizar prefixo da máquina ${maquinaId}.`, 'error');
    }
}

// ====================================================
// FUNÇÃO: FILTRAR MÁQUINAS
// ====================================================

function filtrar() {
    criarPainel(dadosMaquinas);
}

// ====================================================
// FUNÇÃO: FILTRAR POR FORNO
// ====================================================

function filtrarPorForno(forno) {
    fornoAtivo = forno;
    
    // Atualizar botões ativos
    document.getElementById('btnTodos').classList.remove('active');
    document.getElementById('btnFornoA').classList.remove('active');
    document.getElementById('btnFornoB').classList.remove('active');
    document.getElementById('btnFornoC').classList.remove('active');
    document.getElementById('btnFornoD').classList.remove('active');
    
    document.getElementById(`btnForno${forno === 'todos' ? 'Todos' : forno}`).classList.add('active');
    
    // Aplicar filtro
    filtrar();
}

// ====================================================
// FUNÇÃO: ALTERNAR VISUALIZAÇÃO DE CRÍTICOS
// ====================================================

function alternarCriticos() {
    mostrarCriticos = !mostrarCriticos;
    criarPainel(dadosMaquinas);
}

// ====================================================
// FUNÇÃO: ALTERNAR MODO ESCURO
// ====================================================

function alternarModoEscuro() {
    const body = document.body;
    const btn = document.querySelector('.dark-mode-toggle');
    
    body.classList.toggle('dark-mode');
    modoEscuroAtivo = body.classList.contains('dark-mode');
    
    // Salvar preferência no localStorage
    localStorage.setItem('modoEscuro', modoEscuroAtivo);
    
    // Atualizar texto do botão
    if (modoEscuroAtivo) {
        btn.innerHTML = '<i class="fas fa-sun"></i> Modo Claro';
        mostrarNotificacao("Modo escuro ativado", "info");
    } else {
        btn.innerHTML = '<i class="fas fa-moon"></i> Modo Escuro';
        mostrarNotificacao("Modo claro ativado", "info");
    }
}

// ====================================================
// FUNÇÃO: RECARREGAR DADOS
// ====================================================

function aplicarDadosMaquinas(dados) {
    if (!dados || typeof dados !== 'object') return false;

    dadosMaquinas = dados;
    criarPainel(dados);

    if (config.mostrarGraficos) {
        atualizarGrafico(dados);
        atualizarGraficoTotal(dados);
    }

    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    if (ultimaAtualizacao) {
        ultimaAtualizacao.textContent = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    return true;
}


// ====================================================
// V19 - SINCRONIZAÇÃO EM TEMPO REAL DOS CARDS
// ====================================================
function encontrarBotaoAtualizarDashboard() {
    const candidates = Array.from(document.querySelectorAll('button, a'));
    return candidates.find(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        const onclick = String(el.getAttribute('onclick') || '').toLowerCase();
        const id = String(el.id || '').toLowerCase();
        return onclick.includes('recarregardados') || text.includes('atualizar') || id.includes('atualizar') || id.includes('refresh');
    });
}

function agendarAtualizacaoTempoRealMaquinas(dados) {
    // Renderiza imediatamente com os dados recebidos pelo Firebase.
    if (dados && typeof dados === 'object') {
        dadosMaquinas = dados;
    }

    // Debounce curto para quando o Firebase envia vários eventos em sequência.
    clearTimeout(window.__wmoldesRealtimeRefreshTimer);
    window.__wmoldesRealtimeRefreshTimer = setTimeout(() => {
        try {
            const dadosAtuais = window.__wmoldesUltimoSnapshotMaquinas || dadosMaquinas;
            if (dadosAtuais && typeof dadosAtuais === 'object') {
                aplicarDadosMaquinas(dadosAtuais);
            }

            // Alguns layouts só atualizam contadores/carrossel por meio da rotina do botão Atualizar.
            // Aqui disparamos essa rotina automaticamente, mas com trava para não criar loop.
            if (!window.__wmoldesRealtimeClickingAtualizar) {
                const btnAtualizar = encontrarBotaoAtualizarDashboard();
                if (btnAtualizar) {
                    window.__wmoldesRealtimeClickingAtualizar = true;
                    btnAtualizar.click();
                    setTimeout(() => {
                        window.__wmoldesRealtimeClickingAtualizar = false;
                    }, 900);
                } else if (typeof window.recarregarDados === 'function') {
                    window.recarregarDados(true);
                }
            }
        } catch (error) {
            console.warn('Não foi possível atualizar os cards em tempo real:', error);
        }
    }, 250);
}

function recarregarDados(silent = false) {
    if (typeof db === 'undefined' || !db) {
        console.warn("Firebase Database ainda não está disponível para carregar máquinas.");
        return Promise.resolve(false);
    }

    return db.ref("maquinas").once("value").then(snapshot => {
        const dados = snapshot.val();
        const carregou = aplicarDadosMaquinas(dados);

        if (carregou) {
            window.__wmoldesMaquinasCarregadas = true;
            window.__wmoldesUltimoCarregamentoMaquinas = Date.now();
            if (!silent) {
                mostrarNotificacao("Dados atualizados com sucesso!", "info");
            }
            return true;
        }

        if (!silent) {
            mostrarNotificacao("Nenhuma máquina encontrada no Firebase.", "warning");
        }
        return false;
    }).catch(error => {
        console.error("❌ Erro ao recarregar máquinas:", error);
        if (!silent) {
            mostrarNotificacao("Erro ao carregar máquinas do Firebase.", "error");
        }
        return false;
    });
}

function inicializarCarregamentoAutomaticoMaquinas() {
    // Carregamento resiliente de abertura.
    // O botão Atualizar funcionava porque era acionado depois da tela estabilizar;
    // esta rotina faz tentativas automáticas curtas até o Firebase devolver as máquinas.
    if (window.__wmoldesAutoLoadStarted) return;
    window.__wmoldesAutoLoadStarted = true;

    let tentativas = 0;
    const maxTentativas = 24; // aproximadamente 12 segundos

    const tentarCarregar = () => {
        tentativas += 1;

        recarregarDados(true).then(carregou => {
            const total = dadosMaquinas && typeof dadosMaquinas === 'object' ? Object.keys(dadosMaquinas).length : 0;

            if (carregou || total > 0) {
                window.__wmoldesMaquinasCarregadas = true;
                return;
            }

            if (tentativas < maxTentativas) {
                setTimeout(tentarCarregar, 500);
            }
        });
    };

    // Dispara em vários momentos seguros da abertura.
    tentarCarregar();
    setTimeout(tentarCarregar, 300);
    window.addEventListener('load', () => setTimeout(tentarCarregar, 100));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !window.__wmoldesMaquinasCarregadas) {
            tentarCarregar();
        }
    });

    if (typeof auth !== 'undefined' && auth && typeof auth.onAuthStateChanged === 'function') {
        auth.onAuthStateChanged(user => {
            if (user && !window.__wmoldesMaquinasCarregadas) {
                tentarCarregar();
            }
        });
    }

    // Atualização periódica leve quando a opção do sistema estiver ativa.
    if (!window.__wmoldesAutoReloadInterval) {
        window.__wmoldesAutoReloadInterval = setInterval(() => {
            if (config.autoAtualizar !== false && typeof auth !== 'undefined' && auth && auth.currentUser) {
                recarregarDados(true);
            }
        }, 30000);
    }
}

// ====================================================
// FUNÇÃO: TROCAR DE ABA
// ====================================================

function openTab(tabId) {
    // Esconder todas as abas
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remover classe ativa de todos os botões
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Mostrar aba selecionada
    document.getElementById(tabId).classList.add('active');
    
    // Ativar botão da aba selecionada
    event.currentTarget.classList.add('active');
    
    // Atualizar gráficos se necessário
    if (tabId === 'dashboard' && Object.keys(dadosMaquinas).length > 0) {
        atualizarGrafico(dadosMaquinas);
        atualizarGraficoTotal(dadosMaquinas);
    }
}

// ====================================================
// FUNÇÃO: MOSTRAR NOTIFICAÇÃO
// ====================================================

function mostrarNotificacao(msg, tipo = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    
    let icon = "fas fa-check-circle";
    if (tipo === "error") icon = "fas fa-exclamation-circle";
    if (tipo === "warning") icon = "fas fa-exclamation-triangle";
    if (tipo === "info") icon = "fas fa-info-circle";
    
    toast.innerHTML = `<i class="${icon}"></i> ${msg}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "fadeout 0.4s forwards";
        setTimeout(() => { toast.remove(); }, 400);
    }, 3000);
}

// ====================================================
// FUNÇÃO: GERAR PDF
// ====================================================

async function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const dataAtual = new Date();
    const dataStr = dataAtual.toLocaleDateString('pt-BR');
    const horaStr = dataAtual.toLocaleTimeString('pt-BR');
    const dataISO = dataAtual.toISOString().split("T")[0];

    // Configurações do relatório
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(`Relatório de Produção - WMoldes`, doc.internal.pageSize.width / 2, 15, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Data: ${dataStr} | Hora: ${horaStr}`, doc.internal.pageSize.width / 2, 22, { align: "center" });

    // Preparar dados para a tabela
    const body = Object.keys(dadosMaquinas).map(id => {
        const m = dadosMaquinas[id];
        
        return [
            id, 
            m.prefixo || 'N/A',
            m.molde || 0,
            m.molde_reserva || 0,
            m.blank || 0,
            m.blank_reserva || 0,
            m.neck_ring || 0,
            m.neck_ring_reserva || 0,
            m.funil || 0,
            m.funil_reserva || 0
        ];
    });

    // Criar tabela no PDF
    doc.autoTable({
        startY: 30,
        head: [
            ['Máquina', 'Prefixo', 'Molde', 'Molde Reserva', 'Blank', 'Blank Reserva', 'Neck Ring', 'Neck Ring Reserva', 'Funil', 'Funil Reserva']
        ],
        body: body,
        theme: 'grid',
        headStyles: {
            fillColor: [14, 165, 233],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 22 },
            2: { cellWidth: 15 },
            3: { cellWidth: 20 },
            4: { cellWidth: 15 },
            5: { cellWidth: 20 },
            6: { cellWidth: 18 },
            7: { cellWidth: 22 },
            8: { cellWidth: 15 },
            9: { cellWidth: 20 }
        }
    });

    // Adicionar rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        doc.text(`© WMoldes ${new Date().getFullYear()}`, 20, doc.internal.pageSize.height - 10);
    }

    // Salvar o PDF
    const nomeArquivo = `relatorio_producao_${dataISO}.pdf`;
    doc.save(nomeArquivo);
    
    // Notificar o usuário
    mostrarNotificacao(`PDF gerado: ${nomeArquivo}`, "info");
}

// ====================================================
// GRÁFICOS
// ====================================================

function inicializarGraficos() {
    // Inicializar gráficos vazios
    const ctxProducao = document.getElementById("graficoProducao");
    const ctxTotal = document.getElementById("graficoTotal");
    
    if (ctxProducao) {
        graficoProducao = new Chart(ctxProducao, {
            type: "bar",
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.9)' }
                }
            }
        });
    }
    
    if (ctxTotal) {
        graficoTotal = new Chart(ctxTotal, {
            type: "bar",
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.9)' }
                }
            }
        });
    }
}

function atualizarGrafico(dados) {
    if (!config.mostrarGraficos || !graficoProducao) return;
    
    const maquinas = Object.keys(dados);
    const moldes = maquinas.map(id => dados[id].molde || 0);
    const blanks = maquinas.map(id => dados[id].blank || 0);
    const neckrings = maquinas.map(id => dados[id].neck_ring || 0);
    const funis = maquinas.map(id => dados[id].funil || 0);

    graficoProducao.data.labels = maquinas;
    graficoProducao.data.datasets = [
        {
            label: "Molde",
            data: moldes,
            backgroundColor: "rgba(14, 165, 233, 0.8)",
            borderColor: "rgba(14, 165, 233, 1)",
            borderWidth: 1
        },
        {
            label: "Blank",
            data: blanks,
            backgroundColor: "rgba(12, 74, 110, 0.8)",
            borderColor: "rgba(12, 74, 110, 1)",
            borderWidth: 1
        },
        {
            label: "Neck Ring",
            data: neckrings,
            backgroundColor: "rgba(79, 70, 229, 0.8)",
            borderColor: "rgba(79, 70, 229, 1)",
            borderWidth: 1
        },
        {
            label: "Funil",
            data: funis,
            backgroundColor: "rgba(245, 158, 11, 0.8)",
            borderColor: "rgba(245, 158, 11, 1)",
            borderWidth: 1
        }
    ];
    
    graficoProducao.update();
}

function atualizarGraficoTotal(dados) {
    if (!config.mostrarGraficos || !graficoTotal) return;
    
    const maquinas = Object.keys(dados);
    
    // Calcular totais (máquina + reserva)
    const moldesTotal = maquinas.map(id => 
        (dados[id].molde || 0) + (dados[id].molde_reserva || 0)
    );
    
    const blanksTotal = maquinas.map(id => 
        (dados[id].blank || 0) + (dados[id].blank_reserva || 0)
    );
    
    const neckringsTotal = maquinas.map(id => 
        (dados[id].neck_ring || 0) + (dados[id].neck_ring_reserva || 0)
    );
    
    const funisTotal = maquinas.map(id => 
        (dados[id].funil || 0) + (dados[id].funil_reserva || 0)
    );

    graficoTotal.data.labels = maquinas;
    graficoTotal.data.datasets = [
        {
            label: "Molde Total",
            data: moldesTotal,
            backgroundColor: "rgba(14, 165, 233, 0.6)",
            borderColor: "rgba(14, 165, 233, 1)",
            borderWidth: 1
        },
        {
            label: "Blank Total",
            data: blanksTotal,
            backgroundColor: "rgba(12, 74, 110, 0.6)",
            borderColor: "rgba(12, 74, 110, 1)",
            borderWidth: 1
        },
        {
            label: "Neck Ring Total",
            data: neckringsTotal,
            backgroundColor: "rgba(79, 70, 229, 0.6)",
            borderColor: "rgba(79, 70, 229, 1)",
            borderWidth: 1
        },
        {
            label: "Funil Total",
            data: funisTotal,
            backgroundColor: "rgba(245, 158, 11, 0.6)",
            borderColor: "rgba(245, 158, 11, 1)",
            borderWidth: 1
        }
    ];
    
    graficoTotal.update();
}

// ====================================================
// PAINEL ADMINISTRATIVO
// ====================================================

function configurarEventoTitulo() {
    tituloPrincipal.addEventListener('click', function() {
        clicksTitulo++;
        
        if (timeoutClicks) {
            clearTimeout(timeoutClicks);
        }
        
        timeoutClicks = setTimeout(() => {
            clicksTitulo = 0;
        }, 2000);
        
        if (clicksTitulo === 5) {
            abrirPainelAdmin();
            clicksTitulo = 0;
        }
    });
}

// Aplicar tema selecionado
function aplicarTema(tema) {
    // Remover todos os temas
    document.body.classList.remove('tema-verde', 'tema-roxo', 'tema-vermelho', 'tema-laranja');
    
    // Aplicar novo tema
    if (tema !== 'ciano') {
        document.body.classList.add(`tema-${tema}`);
    }
    
    // Atualizar seleção visual
    document.querySelectorAll('.tema-option').forEach(el => {
        el.classList.remove('active');
    });
    const temaElement = document.querySelector(`.tema-${tema}`);
    if (temaElement) {
        temaElement.classList.add('active');
    }
}

// Selecionar tema
function selecionarTema(tema) {
    aplicarTema(tema);
    config.tema = tema;
}

// Painel administrativo
function abrirPainelAdmin() {
    document.getElementById('painelAdmin').classList.add('active');
    document.getElementById('adminOverlay').classList.add('active');
}

function fecharPainelAdmin() {
    document.getElementById('painelAdmin').classList.remove('active');
    document.getElementById('adminOverlay').classList.remove('active');
}

// Salvar configurações no Firebase
function salvarConfiguracoes() {
    config.mostrarReserva = document.getElementById('toggleReserva').checked;
    config.mostrarFunil = document.getElementById('toggleFunil').checked;
    config.mostrarNeckring = document.getElementById('toggleNeckring').checked;
    config.mostrarBlank = document.getElementById('toggleBlank').checked;
    config.mostrarMolde = document.getElementById('toggleMolde').checked;
    config.mostrarPrefixo = document.getElementById('togglePrefixo').checked;
    config.alertasAtivos = document.getElementById('toggleAlertas').checked;
    config.animacoesAtivas = document.getElementById('toggleAnimacoes').checked;
    config.autoAtualizar = document.getElementById('autoAtualizar').checked;
    config.mostrarTotais = document.getElementById('mostrarTotais').checked;
    config.mostrarGraficos = document.getElementById('mostrarGraficos').checked;
    config.estoqueMinimo = parseInt(document.getElementById('estoqueMinimo').value) || 3;
    
    // Salvar no Firebase
    setWithAudit("configuracoes", config, {
        action: 'atualizou configurações do painel principal',
        details: 'Configurações visuais e operacionais do painel foram alteradas.',
        entityType: 'configuracao',
        entityId: 'painel-principal'
    }).then(() => {
        // Aplicar configurações imediatamente
        const totaisElement = document.getElementById('totais');
        if (totaisElement) {
            totaisElement.style.display = config.mostrarTotais ? 'grid' : 'none';
        }
        
        const graficosElement = document.querySelector('.graficos-container');
        if (graficosElement) {
            graficosElement.style.display = config.mostrarGraficos ? 'grid' : 'none';
        }
        
        document.getElementById('estoqueMinimoLabel').textContent = config.estoqueMinimo;
        
        if (Object.keys(dadosMaquinas).length > 0) {
            criarPainel(dadosMaquinas);
        }
        
        mostrarNotificacao("Configurações salvas no servidor!", "success");
        fecharPainelAdmin();
    }).catch(error => {
        mostrarNotificacao("Erro ao salvar configurações: " + error.message, "error");
    });
}


// ====================================================
// DETALHES DO PREFIXO
// ====================================================

function getPrefixRecordByMachine(maquinaId) {
    const machine = dadosMaquinas?.[maquinaId];
    if (!machine) return null;

    return (
        findPrefixRecord(prefixos, machine.prefixo) ||
        findPrefixRecord(prefixos, machine.prefixoDetalhado) ||
        findPrefixRecord(prefixos, machine.prefixo_detalhado) ||
        null
    );
}

function normalizePrefixValue(value) {
    if (Array.isArray(value)) {
        return value.join(', ');
    }

    return String(value);
}

function collectPrefixEntries(obj, hiddenKeys) {
    const entries = [];

    Object.entries(obj || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        if (hiddenKeys.has(key)) return;

        if (Array.isArray(value)) {
            if (!value.length) return;
            entries.push({ label: formatPrefixFieldLabel(key), value: value.join(', ') });
            return;
        }

        if (typeof value === 'object') {
            const nestedEntries = collectPrefixEntries(value, hiddenKeys);
            if (nestedEntries.length) {
                entries.push({
                    label: formatPrefixFieldLabel(key),
                    value: nestedEntries,
                    isGroup: true
                });
            }
            return;
        }

        entries.push({ label: formatPrefixFieldLabel(key), value: normalizePrefixValue(value) });
    });

    return entries;
}

function renderPrefixEntry(entry) {
    if (entry.isGroup) {
        const groupItems = entry.value.map(item => renderPrefixEntry(item)).join('');
        return `
            <section class="prefixo-detail-section">
                <div class="prefixo-detail-section-title">${entry.label}</div>
                <div class="prefixo-detail-section-grid">${groupItems}</div>
            </section>
        `;
    }

    const normalizedValue = String(entry.value).startsWith('http')
        ? `<a href="${entry.value}" target="_blank" rel="noopener noreferrer">${entry.value}</a>`
        : `${entry.value}`;

    return `
        <div class="prefixo-detail-item">
            <div class="prefixo-detail-label">${entry.label}</div>
            <div class="prefixo-detail-value">${normalizedValue}</div>
        </div>
    `;
}

function renderPrefixDetails(prefixRecord) {
    if (!prefixRecord) {
        return '<div class="prefixo-detail-empty">Nenhuma informação detalhada encontrada para este prefixo.</div>';
    }

    const hiddenKeys = new Set([
        'image', 'img', 'imageUrl', 'imageURL', 'imagem', 'imagemUrl', 'imagemURL', 'linkImagem', 'imgbb', 'url',
        'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'createdEm', 'atualizadoEm', 'criadoEm', 'criadoPor',
        'nome', 'displayName', 'prefixoDetalhado', 'prefixo_detalhado', 'id', 'prefixGrande'
    ]);

    const imageUrl = getPrefixImageUrl(prefixRecord);
    const entries = collectPrefixEntries(prefixRecord, hiddenKeys);
    const entriesHtml = entries.map(renderPrefixEntry).join('');

    return `
        <div class="prefixo-detail-layout ${imageUrl ? 'has-image' : 'no-image'}">
            ${imageUrl ? `
                <div class="prefixo-detail-image-wrap">
                    <img src="${imageUrl}" alt="Imagem do prefixo" class="prefixo-detail-image" onclick="viewPrefixImageFull('${imageUrl}')" />
                    <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="prefixo-detail-link">
                        <i class="fas fa-up-right-from-square"></i> Abrir imagem
                    </a>
                </div>` : ''}
            <div class="prefixo-detail-grid">${entriesHtml || '<div class="prefixo-detail-empty">Nenhum campo adicional encontrado.</div>'}</div>
        </div>
    `;
}

function fecharModalPrefixo() {
    const overlay = document.getElementById('prefixoModalOverlay');
    if (overlay) overlay.remove();
}

function abrirDetalhesPrefixo(maquinaId) {
    const machine = dadosMaquinas?.[maquinaId];
    const prefixRecord = getPrefixRecordByMachine(maquinaId);

    if (!machine || !prefixRecord) {
        mostrarNotificacao('Nenhum prefixo detalhado disponível para esta máquina.', 'warning');
        return;
    }

    fecharModalPrefixo();

    const overlay = document.createElement('div');
    overlay.id = 'prefixoModalOverlay';
    overlay.className = 'prefixo-modal-overlay';
    overlay.innerHTML = `
        <div class="prefixo-modal-card">
            <button type="button" class="prefixo-modal-close" onclick="fecharModalPrefixo()">
                <i class="fas fa-times"></i>
            </button>
            <div class="prefixo-modal-header">
                <div>
                    <div class="prefixo-modal-subtitle">Máquina ${maquinaId}</div>
                    <h3>${prefixRecord.displayName || prefixRecord.nome || prefixRecord.id}</h3>
                </div>
            </div>
            ${renderPrefixDetails(prefixRecord)}
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) fecharModalPrefixo();
    });

    document.body.appendChild(overlay);
}

// ====================================================
// EXPORTAR FUNÇÕES PARA USO GLOBAL
// ====================================================

// Exportar funções principais
window.filtrar = filtrar;
window.filtrarPorForno = filtrarPorForno;
window.alternarCriticos = alternarCriticos;
window.alternarModoEscuro = alternarModoEscuro;
window.recarregarDados = recarregarDados;
window.openTab = openTab;
window.gerarPDF = gerarPDF;
window.logout = logout;

// Exportar funções de controle
window.alterar = alterar;
window.toggleCustomSelect = toggleCustomSelect;
window.filtrarOpcoes = filtrarOpcoes;
window.selecionarPrefixo = selecionarPrefixo;
window.atualizarPrefixo = atualizarPrefixo;
window.abrirDetalhesPrefixo = abrirDetalhesPrefixo;
window.fecharModalPrefixo = fecharModalPrefixo;

// Exportar funções do painel admin
window.selecionarTema = selecionarTema;
window.abrirPainelAdmin = abrirPainelAdmin;
window.fecharPainelAdmin = fecharPainelAdmin;
window.salvarConfiguracoes = salvarConfiguracoes;

// Exportar função de notificação
window.mostrarNotificacao = mostrarNotificacao;

// ====================================================
// FUNÇÕES PARA MODO DIGITADO
// ====================================================

function toggleModoDigitado(maquinaId, tipo) {
    const spanElement = document.getElementById(`${maquinaId}-${tipo}`);
    const inputElement = document.getElementById(`input-${maquinaId}-${tipo}`);
    const btnElement = event.currentTarget;
    
    if (inputElement.style.display === 'none' || inputElement.style.display === '') {
        // Mostrar input, esconder span
        spanElement.style.display = 'none';
        inputElement.style.display = 'block';
        inputElement.focus();
        inputElement.select();
        btnElement.innerHTML = '<i class="fas fa-check"></i>';
        btnElement.classList.add('ativo-digitacao');
    } else {
        // Mostrar span, esconder input
        atualizarPorInput(maquinaId, tipo, inputElement.value);
    }
}

async function atualizarPorInput(maquinaId, tipo, valor) {
    const writeKey = `${maquinaId}:${tipo}`;
    if (pendingMachineWrites.has(writeKey)) {
        return;
    }

    const spanElement = document.getElementById(`${maquinaId}-${tipo}`);
    const inputElement = document.getElementById(`input-${maquinaId}-${tipo}`);
    const btnElement = inputElement.closest('.controles').querySelector('.btn-digitado');

    const valorAtual = parseInt(spanElement.textContent) || 0;
    const novoValor = Math.max(0, parseInt(valor) || 0);

    // Atualizar visualmente
    spanElement.textContent = novoValor;
    inputElement.value = novoValor;

    // Voltar para modo visual
    spanElement.style.display = 'block';
    inputElement.style.display = 'none';
    btnElement.innerHTML = '<i class="fas fa-keyboard"></i>';
    btnElement.classList.remove('ativo-digitacao');

    if (novoValor === valorAtual) {
        return;
    }

    pendingMachineWrites.add(writeKey);

    try {
        if (typeof setWithAudit === 'function') {
            await setWithAudit(`maquinas/${maquinaId}/${tipo}`, novoValor, {
                action: `digitou valor em ${tipo} da máquina ${maquinaId}`,
                details: `Valor ajustado manualmente de ${valorAtual} para ${novoValor}.`,
                entityType: 'machine_change',
                entityId: maquinaId,
                extra: {
                    machineId: maquinaId,
                    field: tipo,
                    origem: 'digitacao_manual',
                    before: valorAtual,
                    after: novoValor
                }
            });
        } else {
            await db.ref(`maquinas/${maquinaId}/${tipo}`).set(novoValor);
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar valor digitado:', error);
        spanElement.textContent = valorAtual;
        inputElement.value = valorAtual;
        mostrarNotificacao(`Erro ao salvar ${tipo} da máquina ${maquinaId}.`, 'error');
        return;
    } finally {
        pendingMachineWrites.delete(writeKey);
    }

    // Feedback
    spanElement.style.transform = 'scale(1.1)';
    spanElement.style.color = '#0ea5e9';
    setTimeout(() => {
        spanElement.style.transform = '';
        spanElement.style.color = '';
    }, 200);

    mostrarNotificacao(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} da máquina ${maquinaId} atualizado para ${novoValor}`, 'info');
}

// Exportar as novas funções
window.toggleModoDigitado = toggleModoDigitado;
window.atualizarPorInput = atualizarPorInput;

// Exportar função de notificação
window.mostrarNotificacao = mostrarNotificacao;

console.log("✅ Script principal carregado");


// ====================================================
// V18 - CARREGAMENTO AUTOMÁTICO REAL NA ABERTURA
// ====================================================
// Algumas versões do dashboard só renderizam os cartões depois que o botão
// "Atualizar" executa a rotina completa de refresh. Esta camada replica esse
// comportamento automaticamente na abertura, sem depender de clique manual.
(function setupAutoRefreshOnPageOpen() {
    if (window.__wmoldesAutoRefreshV18Started) return;
    window.__wmoldesAutoRefreshV18Started = true;

    function getMachineCardCount() {
        const selectors = [
            '#painel .maquina-card',
            '#painel .machine-card',
            '#painel .card-maquina',
            '.maquinas-grid .maquina-card',
            '.maquinas-grid .machine-card',
            '.maquinas-grid .card-maquina',
            '[data-machine-id]',
            '[data-maquina-id]'
        ];

        for (const selector of selectors) {
            const count = document.querySelectorAll(selector).length;
            if (count > 0) return count;
        }

        const painel = document.getElementById('painel') || document.querySelector('.maquinas-grid');
        if (painel && painel.children && painel.children.length > 0) return painel.children.length;

        return 0;
    }

    function findUpdateButton() {
        const candidates = Array.from(document.querySelectorAll('button, a'));
        return candidates.find(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            const onclick = String(el.getAttribute('onclick') || '').toLowerCase();
            const id = String(el.id || '').toLowerCase();
            return onclick.includes('recarregardados') || text.includes('atualizar') || id.includes('atualizar') || id.includes('refresh');
        });
    }

    async function runRefreshAttempt(source) {
        try {
            if (getMachineCardCount() > 0) {
                window.__wmoldesAutoRefreshV18Done = true;
                return true;
            }

            if (typeof window.recarregarDados === 'function') {
                const result = await window.recarregarDados(true);
                if (result || getMachineCardCount() > 0) {
                    window.__wmoldesAutoRefreshV18Done = true;
                    return true;
                }
            }

            // Fallback: executa exatamente a mesma ação do botão que funciona manualmente.
            const updateButton = findUpdateButton();
            if (updateButton && !window.__wmoldesAutoRefreshV18Clicking) {
                window.__wmoldesAutoRefreshV18Clicking = true;
                updateButton.click();
                setTimeout(() => { window.__wmoldesAutoRefreshV18Clicking = false; }, 700);
            }

            setTimeout(() => {
                if (getMachineCardCount() > 0) {
                    window.__wmoldesAutoRefreshV18Done = true;
                }
            }, 500);

            return getMachineCardCount() > 0;
        } catch (error) {
            console.warn('Auto refresh V18 não conseguiu carregar nesta tentativa:', source, error);
            return false;
        }
    }

    function scheduleAttempts() {
        const delays = [150, 500, 1000, 1800, 3000, 5000, 8000, 12000, 18000];
        delays.forEach(delay => {
            setTimeout(() => {
                if (!window.__wmoldesAutoRefreshV18Done) {
                    runRefreshAttempt(`delay-${delay}`);
                }
            }, delay);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleAttempts, { once: true });
    } else {
        scheduleAttempts();
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            if (!window.__wmoldesAutoRefreshV18Done) runRefreshAttempt('window-load');
        }, 300);
    });

    if (typeof auth !== 'undefined' && auth && typeof auth.onAuthStateChanged === 'function') {
        auth.onAuthStateChanged(user => {
            if (user) {
                setTimeout(() => runRefreshAttempt('auth-ready'), 300);
                setTimeout(() => runRefreshAttempt('auth-ready-late'), 1500);
            }
        });
    }
})();


// V19 - Exposição segura para rotinas automáticas e botões inline
try {
    window.recarregarDados = recarregarDados;
    window.aplicarDadosMaquinas = aplicarDadosMaquinas;
} catch (error) {
    console.warn('Não foi possível expor funções de atualização:', error);
}

// ====================================================
// V20 - SINCRONIZAÇÃO REAL COM O BANCO DE DADOS
// ====================================================
// Este bloco garante que alterações feitas por outro site diretamente no
// Firebase Realtime Database sejam refletidas no painel sem clicar em Atualizar.
// Usa listeners em /maquinas e, como redundância, uma verificação curta por
// polling enquanto a página está aberta.
(function setupSincronizacaoBancoTempoRealV20() {
    if (window.__wmoldesRealtimeDBV20Started) return;
    window.__wmoldesRealtimeDBV20Started = true;

    let lastSignature = '';
    let isRefreshing = false;
    let debounceTimer = null;

    function assinatura(dados) {
        try {
            return JSON.stringify(dados || {});
        } catch (error) {
            return String(Date.now());
        }
    }

    async function atualizarDoBanco(origem = 'tempo-real') {
        if (isRefreshing) return false;
        if (typeof db === 'undefined' || !db) return false;

        isRefreshing = true;
        try {
            const snapshot = await db.ref('maquinas').once('value');
            const dados = snapshot.val() || {};
            const sig = assinatura(dados);

            if (sig !== lastSignature || origem === 'forcar') {
                lastSignature = sig;
                window.__wmoldesUltimoSnapshotMaquinas = dados;
                dadosMaquinas = dados;

                if (typeof aplicarDadosMaquinas === 'function') {
                    aplicarDadosMaquinas(dados);
                } else if (typeof criarPainel === 'function') {
                    criarPainel(dados);
                }

                if (typeof atualizarEstatisticasDashboard === 'function') {
                    try { atualizarEstatisticasDashboard(dados); } catch (_) {}
                }

                const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
                if (ultimaAtualizacao) {
                    ultimaAtualizacao.textContent = new Date().toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                }
            }

            return true;
        } catch (error) {
            console.warn('V20: não foi possível sincronizar máquinas em tempo real:', origem, error);
            return false;
        } finally {
            isRefreshing = false;
        }
    }

    function agendarAtualizacao(origem) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => atualizarDoBanco(origem), 120);
    }

    function iniciarListeners() {
        if (typeof db === 'undefined' || !db) {
            setTimeout(iniciarListeners, 400);
            return;
        }

        if (window.__wmoldesRealtimeDBV20ListenersAttached) return;
        window.__wmoldesRealtimeDBV20ListenersAttached = true;

        const ref = db.ref('maquinas');

        ref.on('value', snapshot => {
            const dados = snapshot.val() || {};
            const sig = assinatura(dados);
            if (sig !== lastSignature) {
                lastSignature = sig;
                window.__wmoldesUltimoSnapshotMaquinas = dados;
                dadosMaquinas = dados;
                if (typeof aplicarDadosMaquinas === 'function') {
                    aplicarDadosMaquinas(dados);
                } else if (typeof criarPainel === 'function') {
                    criarPainel(dados);
                }
            }
        }, error => {
            console.warn('V20: listener /maquinas/value falhou:', error);
        });

        ref.on('child_added', () => agendarAtualizacao('child_added'));
        ref.on('child_changed', () => agendarAtualizacao('child_changed'));
        ref.on('child_removed', () => agendarAtualizacao('child_removed'));

        // Primeira sincronização imediata.
        atualizarDoBanco('forcar');
    }

    function iniciarPollingRedundante() {
        if (window.__wmoldesRealtimeDBV20Polling) return;
        window.__wmoldesRealtimeDBV20Polling = setInterval(() => {
            if (!document.hidden) atualizarDoBanco('polling');
        }, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            iniciarListeners();
            iniciarPollingRedundante();
        }, { once: true });
    } else {
        iniciarListeners();
        iniciarPollingRedundante();
    }

    window.addEventListener('focus', () => atualizarDoBanco('forcar'));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) atualizarDoBanco('forcar');
    });

    if (typeof auth !== 'undefined' && auth && typeof auth.onAuthStateChanged === 'function') {
        auth.onAuthStateChanged(user => {
            if (user) {
                iniciarListeners();
                atualizarDoBanco('auth');
            }
        });
    }

    // Deixa disponível para teste no console: window.sincronizarMaquinasAgora()
    window.sincronizarMaquinasAgora = () => atualizarDoBanco('forcar');
})();


// ====================================================
// MANUTENÇÃO COMPARTILHADA ENTRE PAINEL E ABASTECEDOR
// ====================================================
function isMachineInMaintenance(machineId) {
    const status = machineMaintenance?.[machineId];
    return !!(status && (status.isInMaintenance === true || status.status === 'maintenance' || status.status === 'manutencao'));
}

async function toggleMachineMaintenance(machineId) {
    const current = isMachineInMaintenance(machineId);
    const action = current ? 'retirar esta máquina da manutenção' : 'colocar esta máquina em parada para manutenção';
    if (!confirm(`Deseja ${action}?`)) return;

    try {
        if (current) {
            await db.ref(`manutencao/${machineId}`).remove();
            mostrarNotificacao(`Máquina ${machineId} retomada da produção.`, 'success');
        } else {
            const reason = prompt('Motivo da manutenção (opcional):') || '';
            await db.ref(`manutencao/${machineId}`).set({
                isInMaintenance: true,
                status: 'maintenance',
                reason: reason.trim(),
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'controle-por-maquina'
            });
            mostrarNotificacao(`Máquina ${machineId} em parada para manutenção.`, 'success');
        }
    } catch (error) {
        console.error('Erro ao atualizar manutenção:', error);
        mostrarNotificacao('Erro ao atualizar manutenção.', 'error');
    }
}
