// ================= MODAL SOFISTICADO PARA SELEÇÃO DE MÁQUINAS =================
// VERSÃO CORRIGIDA - ATUALIZA O SELECT CORRETAMENTE

(function() {
    "use strict";
    
    console.log("🔧 Inicializando Modal de Seleção de Máquinas...");
    
    let selectedMachine = '';
    let machinesList = [];
    let modalInitialized = false;
    
    // ===== CRIAR ESTRUTURA DO MODAL =====
    function createMachineModal() {
        if (document.getElementById('machineModalOverlay')) return;
        
        const modalHTML = `
            <div class="machine-modal-overlay" id="machineModalOverlay">
                <div class="machine-modal-container" id="machineModalContainer">
                    <div class="machine-modal-header">
                        <div class="machine-modal-title">
                            <i class="fas fa-industry"></i>
                            <h3>Selecionar Máquina</h3>
                        </div>
                        <button class="machine-modal-close" id="machineModalClose">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="machine-modal-search">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" 
                               class="machine-search-input" 
                               id="machineSearchInput" 
                               placeholder="Buscar máquina por número..."
                               autocomplete="off">
                    </div>
                    
                    <div class="machine-modal-categories">
                        <button class="category-btn active" data-category="all">Todas</button>
                        <button class="category-btn" data-category="A">Forno A</button>
                        <button class="category-btn" data-category="B">Forno B</button>
                        <button class="category-btn" data-category="C">Forno C</button>
                        <button class="category-btn" data-category="D">Forno D</button>
                    </div>
                    
                    <div class="machine-modal-list" id="machineModalList">
                        <div class="loading-machines">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Carregando máquinas...</span>
                        </div>
                    </div>
                    
                    <div class="machine-modal-footer">
                        <div class="selected-info" id="selectedMachineInfo">
                            <i class="fas fa-info-circle"></i>
                            <span>Nenhuma máquina selecionada</span>
                        </div>
                        <div class="modal-actions">
                            <button class="modal-btn cancel" id="machineModalCancel">Cancelar</button>
                            <button class="modal-btn confirm" id="machineModalConfirm">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Adicionar eventos
        document.getElementById('machineModalClose').addEventListener('click', closeMachineModal);
        document.getElementById('machineModalCancel').addEventListener('click', closeMachineModal);
        document.getElementById('machineModalConfirm').addEventListener('click', confirmMachineSelection);
        document.getElementById('machineSearchInput').addEventListener('input', filterMachines);
        
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterMachines();
            });
        });
        
        document.getElementById('machineModalOverlay').addEventListener('click', function(e) {
            if (e.target === this) {
                closeMachineModal();
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('machineModalOverlay')?.classList.contains('active')) {
                closeMachineModal();
            }
        });
        
        modalInitialized = true;
    }
    
    // ===== CARREGAR LISTA DE MÁQUINAS =====
    function loadMachinesList() {
        machinesList = [];
        
        // Tentar obter de diferentes fontes
        if (typeof window.allAdminMachines !== 'undefined' && window.allAdminMachines) {
            machinesList = Object.keys(window.allAdminMachines).map(id => ({
                id: id,
                name: `Máquina ${id}`,
                forno: getFornoFromId(id),
                prefix: window.adminPrefixes?.[id] || ''
            }));
        } else if (typeof window.allMachinesData !== 'undefined' && window.allMachinesData) {
            machinesList = Object.keys(window.allMachinesData).map(id => ({
                id: id,
                name: `Máquina ${id}`,
                forno: getFornoFromId(id),
                prefix: ''
            }));
        } else {
            // Máquinas padrão
            const maquinas = ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5',
                             'C1','C2','C3','C4','C5','D1','D2','D3','D4','D5',
                             'D6','D7','D8','D9','D10','D11','D12','D13','D14','D15'];
            
            machinesList = maquinas.map(id => ({
                id: id,
                name: `Máquina ${id}`,
                forno: getFornoFromId(id),
                prefix: ''
            }));
        }
        
        // Ordenar: primeiro por letra do forno, depois por número
        machinesList.sort((a, b) => {
            if (a.forno !== b.forno) return a.forno.localeCompare(b.forno);
            
            const aNum = parseInt(a.id.replace(/\D/g, '')) || 0;
            const bNum = parseInt(b.id.replace(/\D/g, '')) || 0;
            return aNum - bNum;
        });
        
        renderMachinesList(machinesList);
    }
    
    // ===== DETERMINAR FORNO PELO ID =====
    function getFornoFromId(id) {
        if (!id) return 'D';
        if (id.startsWith('A')) return 'A';
        if (id.startsWith('B')) return 'B';
        if (id.startsWith('C')) return 'C';
        return 'D';
    }
    
    // ===== RENDERIZAR LISTA DE MÁQUINAS =====
    function renderMachinesList(machines) {
        const listEl = document.getElementById('machineModalList');
        if (!listEl) return;
        
        if (machines.length === 0) {
            listEl.innerHTML = `
                <div class="no-machines">
                    <i class="fas fa-search"></i>
                    <span>Nenhuma máquina encontrada</span>
                </div>
            `;
            return;
        }
        
        let html = '';
        machines.forEach(machine => {
            const isSelected = machine.id === selectedMachine;
            const fornoClass = `forno-${machine.forno.toLowerCase()}`;
            
            html += `
                <div class="machine-item ${isSelected ? 'selected' : ''}" 
                     data-machine-id="${machine.id}"
                     onclick="window.selectMachineFromModal('${machine.id}')">
                    <div class="machine-item-info">
                        <div class="machine-item-name">
                            <i class="fas fa-industry"></i>
                            <span>${machine.name}</span>
                            ${machine.prefix ? `<span class="machine-prefix-badge">${machine.prefix}</span>` : ''}
                        </div>
                        <div class="machine-item-details">
                            <span class="forno-badge ${fornoClass}">Forno ${machine.forno}</span>
                        </div>
                    </div>
                    ${isSelected ? '<i class="fas fa-check-circle selected-icon"></i>' : ''}
                </div>
            `;
        });
        
        listEl.innerHTML = html;
    }
    
    // ===== FILTRAR MÁQUINAS =====
    function filterMachines() {
        const searchTerm = document.getElementById('machineSearchInput')?.value.toLowerCase() || '';
        const activeCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';
        
        let filtered = machinesList.filter(machine => {
            // Filtro por busca
            const matchesSearch = searchTerm === '' || 
                machine.id.toLowerCase().includes(searchTerm) ||
                machine.name.toLowerCase().includes(searchTerm) ||
                (machine.prefix && machine.prefix.toLowerCase().includes(searchTerm));
            
            // Filtro por categoria
            let matchesCategory = true;
            if (activeCategory === 'A') matchesCategory = machine.forno === 'A';
            else if (activeCategory === 'B') matchesCategory = machine.forno === 'B';
            else if (activeCategory === 'C') matchesCategory = machine.forno === 'C';
            else if (activeCategory === 'D') matchesCategory = machine.forno === 'D';
            
            return matchesSearch && matchesCategory;
        });
        
        renderMachinesList(filtered);
    }
    
    // ===== ABRIR MODAL =====
    window.openMachineModal = function(currentValue = '') {
        if (!modalInitialized) {
            createMachineModal();
        }
        
        const modal = document.getElementById('machineModalOverlay');
        if (!modal) return;
        
        // Pegar valor atual do select
        const machineSelect = document.getElementById('historyMachineSelect');
        if (machineSelect && machineSelect.value) {
            currentValue = machineSelect.value;
        }
        
        selectedMachine = currentValue;
        loadMachinesList();
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focar na busca
        setTimeout(() => {
            document.getElementById('machineSearchInput')?.focus();
            
            if (selectedMachine) {
                const selectedElement = document.querySelector(`.machine-item[data-machine-id="${selectedMachine}"]`);
                if (selectedElement) {
                    selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 300);
    };
    
    // ===== FECHAR MODAL =====
    function closeMachineModal() {
        const modal = document.getElementById('machineModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    // ===== SELECIONAR MÁQUINA NO MODAL =====
    window.selectMachineFromModal = function(machineId) {
        selectedMachine = machineId;
        
        // Atualizar visual
        document.querySelectorAll('.machine-item').forEach(item => {
            if (item.dataset.machineId === machineId) {
                item.classList.add('selected');
                if (!item.querySelector('.selected-icon')) {
                    item.innerHTML += '<i class="fas fa-check-circle selected-icon"></i>';
                }
            } else {
                item.classList.remove('selected');
                const icon = item.querySelector('.selected-icon');
                if (icon) icon.remove();
            }
        });
        
        // Atualizar info
        const machine = machinesList.find(m => m.id === machineId);
        const infoEl = document.getElementById('selectedMachineInfo');
        if (infoEl && machine) {
            infoEl.innerHTML = `
                <i class="fas fa-check-circle" style="color: #10b981;"></i>
                <span>${machine.name} selecionada</span>
            `;
        }
    };
    
    // ===== CONFIRMAR SELEÇÃO =====
    function confirmMachineSelection() {
        if (!selectedMachine) {
            const infoEl = document.getElementById('selectedMachineInfo');
            infoEl.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>
                <span>Selecione uma máquina</span>
            `;
            return;
        }
        
        const machineSelect = document.getElementById('historyMachineSelect');
        
        if (machineSelect) {
            // Atualizar o valor do select
            machineSelect.value = selectedMachine;
            
            // Atualizar o texto do botão
            const triggerButton = document.querySelector('.machine-select-button');
            if (triggerButton) {
                const buttonText = triggerButton.querySelector('.selected-machine-text');
                if (buttonText) {
                    buttonText.textContent = `Máquina ${selectedMachine}`;
                }
            }
            
            // Disparar evento de change
            const event = new Event('change', { bubbles: true });
            machineSelect.dispatchEvent(event);
            
            console.log(`✅ Select atualizado para: ${machineSelect.value}`);
            
            // CARREGAR DADOS AUTOMATICAMENTE APÓS SELECIONAR
            setTimeout(() => {
                if (typeof window.loadHistoryChart === 'function') {
                    window.loadHistoryChart();
                }
            }, 100);
        }
        
        closeMachineModal();
    }
    
    // ===== SUBSTITUIR SELECT PADRÃO =====
    function setupModalTrigger() {
        const selectContainer = document.querySelector('.control-group:has(#historyMachineSelect)');
        if (!selectContainer) {
            setTimeout(setupModalTrigger, 500);
            return;
        }
        
        // Verificar se já existe um botão
        if (document.querySelector('.machine-select-button')) return;
        
        const originalSelect = document.getElementById('historyMachineSelect');
        if (!originalSelect) return;
        
        // Criar botão para abrir modal
        const triggerButton = document.createElement('button');
        triggerButton.className = 'machine-select-button';
        triggerButton.type = 'button';
        triggerButton.innerHTML = `
            <span class="button-content">
                <i class="fas fa-industry"></i>
                <span class="selected-machine-text">${originalSelect.value ? `Máquina ${originalSelect.value}` : 'Selecionar máquina'}</span>
            </span>
            <i class="fas fa-chevron-down"></i>
        `;
        
        // Inserir após o select
        originalSelect.parentNode.insertBefore(triggerButton, originalSelect.nextSibling);
        
        // Esconder o select visualmente mas mantê-lo funcional
        originalSelect.style.position = 'absolute';
        originalSelect.style.opacity = '0';
        originalSelect.style.height = '0';
        originalSelect.style.width = '0';
        originalSelect.style.pointerEvents = 'none';
        
        // Evento de clique no botão
        triggerButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.openMachineModal(originalSelect.value);
        });
        
        // Atualizar texto do botão quando select mudar
        originalSelect.addEventListener('change', function() {
            const text = this.value ? `Máquina ${this.value}` : 'Selecionar máquina';
            const buttonText = triggerButton.querySelector('.selected-machine-text');
            if (buttonText) {
                buttonText.textContent = text;
            }
        });
        
        console.log("✅ Botão do modal configurado");
    }
    
    // ===== INICIALIZAR =====
    function initMachineModal() {
        if (modalInitialized) return;
        
        createMachineModal();
        // Pequeno delay para garantir que o select existe
        setTimeout(setupModalTrigger, 1000);
    }
    
    // Aguardar DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMachineModal);
    } else {
        initMachineModal();
    }
    
    // ===== ESTILOS DO MODAL =====
    if (!document.getElementById('machine-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'machine-modal-styles';
        style.textContent = `
            .machine-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .machine-modal-overlay.active {
                display: flex;
                opacity: 1;
            }
            
            .machine-modal-container {
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                background: white;
                border-radius: 20px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: scale(0.9);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid #e5e7eb;
            }
            
            .active .machine-modal-container {
                transform: scale(1);
            }
            
            .machine-modal-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: white;
            }
            
            .machine-modal-title {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .machine-modal-title i {
                font-size: 24px;
                color: #2563eb;
            }
            
            .machine-modal-title h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }
            
            .machine-modal-close {
                width: 36px;
                height: 36px;
                border-radius: 10px;
                border: 1px solid #e5e7eb;
                background: white;
                color: #6b7280;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .machine-modal-close:hover {
                background: #ef4444;
                color: white;
                border-color: #ef4444;
            }
            
            .machine-modal-search {
                padding: 20px 24px;
                position: relative;
                background: white;
            }
            
            .machine-modal-search .search-icon {
                position: absolute;
                left: 36px;
                top: 50%;
                transform: translateY(-50%);
                color: #9ca3af;
                font-size: 14px;
            }
            
            .machine-search-input {
                width: 100%;
                padding: 14px 20px 14px 45px;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                background: #f9fafb;
                color: #111827;
                font-size: 15px;
                transition: all 0.2s ease;
            }
            
            .machine-search-input:focus {
                border-color: #2563eb;
                outline: none;
                box-shadow: 0 0 0 4px rgba(37,99,235,0.1);
            }
            
            .machine-modal-categories {
                padding: 0 24px 20px 24px;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                background: white;
            }
            
            .category-btn {
                padding: 8px 16px;
                border: 1px solid #e5e7eb;
                border-radius: 20px;
                background: #f9fafb;
                color: #6b7280;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .category-btn:hover {
                background: white;
                border-color: #2563eb;
                color: #111827;
            }
            
            .category-btn.active {
                background: #2563eb;
                border-color: #2563eb;
                color: white;
            }
            
            .machine-modal-list {
                flex: 1;
                overflow-y: auto;
                padding: 0 24px 20px 24px;
                min-height: 200px;
                max-height: 400px;
                background: white;
            }
            
            .loading-machines {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 40px;
                color: #6b7280;
            }
            
            .machine-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                margin-bottom: 8px;
                background: #f9fafb;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .machine-item:hover {
                background: white;
                border-color: #2563eb;
                transform: translateX(4px);
            }
            
            .machine-item.selected {
                border-color: #2563eb;
                background: rgba(37,99,235,0.05);
            }
            
            .machine-item-info {
                flex: 1;
            }
            
            .machine-item-name {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 6px;
            }
            
            .machine-item-name i {
                color: #2563eb;
                font-size: 16px;
            }
            
            .machine-item-name span {
                font-weight: 600;
                color: #111827;
            }
            
            .machine-prefix-badge {
                background: #2563eb;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 500;
            }
            
            .machine-item-details {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-left: 26px;
            }
            
            .forno-badge {
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
            }
            
            .forno-badge.forno-a { background: #3b82f6; color: white; }
            .forno-badge.forno-b { background: #10b981; color: white; }
            .forno-badge.forno-c { background: #f59e0b; color: white; }
            .forno-badge.forno-d { background: #8b5cf6; color: white; }
            
            .selected-icon {
                color: #2563eb;
                font-size: 20px;
            }
            
            .machine-modal-footer {
                padding: 20px 24px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: white;
            }
            
            .selected-info {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #6b7280;
                font-size: 14px;
            }
            
            .modal-actions {
                display: flex;
                gap: 12px;
            }
            
            .modal-btn {
                padding: 10px 20px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid #e5e7eb;
            }
            
            .modal-btn.cancel {
                background: #f9fafb;
                color: #6b7280;
            }
            
            .modal-btn.cancel:hover {
                background: #ef4444;
                color: white;
                border-color: #ef4444;
            }
            
            .modal-btn.confirm {
                background: #2563eb;
                color: white;
                border-color: #2563eb;
            }
            
            .modal-btn.confirm:hover {
                background: #1d4ed8;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(37,99,235,0.3);
            }
            
            .machine-select-button {
                width: 100%;
                padding: 12px 16px;
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                color: #111827;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: all 0.2s ease;
                margin-top: 8px;
            }
            
            .machine-select-button:hover {
                border-color: #2563eb;
                background: #f9fafb;
            }
            
            .machine-select-button .button-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .machine-select-button i {
                color: #6b7280;
            }
            
            .no-machines {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                padding: 60px 20px;
                color: #6b7280;
            }
            
            .no-machines i {
                font-size: 40px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    console.log("✅ Machine Select Modal carregado com sucesso!");
    
})();