// ================= MODAL DE SELEÇÃO DE PREFIXO =================

let currentModalField = null;
let modalSelectOptions = {};

function initModalSelect() {
    console.log("🚀 Inicializando modal de seleção");
    
    // Fechar modal com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModalSelect();
        }
    });
}

function openModalSelect(fieldId) {
    console.log(`📁 Abrindo modal para campo: ${fieldId}`);
    
    currentModalField = fieldId;
    
    const modalOverlay = document.getElementById('modalSelectOverlay');
    const modalContainer = document.getElementById('modalSelectContainer');
    const titleEl = document.getElementById('modalSelectTitle');
    const searchEl = document.getElementById('modalSelectSearch');
    const optionsEl = document.getElementById('modalSelectOptions');
    
    if (!modalOverlay || !modalContainer) return;
    
    // Definir título
    const fieldNames = {
        prefixoMolde: 'Selecionar Prefixo Molde',
        prefixoBlank: 'Selecionar Prefixo Blank',
        prefixNeckring: 'Selecionar Neckring',
        prefixAneisGuias: 'Selecionar Anéis Guias',
        prefixThimble: 'Selecionar Thimble',
        prefixMacho: 'Selecionar Macho',
        prefixCooler: 'Selecionar Cooler',
        prefixBaffle: 'Selecionar Baffle',
        prefixBafflePlug: 'Selecionar Baffle Plug',
        prefixFunil: 'Selecionar Funil',
        prefixFundo: 'Selecionar Fundo',
        prefixFundoPlug: 'Selecionar Fundo Plug',
        prefixSoprador: 'Selecionar Soprador',
        prefixPinca: 'Selecionar Pinças'
    };
    
    titleEl.textContent = fieldNames[fieldId] || 'Selecionar Opção';
    
    // Limpar busca
    searchEl.value = '';
    
    // Carregar opções
    renderModalOptions(fieldId, '');
    
    // Mostrar modal
    modalOverlay.style.display = 'block';
    modalContainer.style.display = 'block';
    
    // Focar na busca
    setTimeout(() => searchEl.focus(), 100);
}

function closeModalSelect() {
    const modalOverlay = document.getElementById('modalSelectOverlay');
    const modalContainer = document.getElementById('modalSelectContainer');
    
    if (modalOverlay) modalOverlay.style.display = 'none';
    if (modalContainer) modalContainer.style.display = 'none';
    
    currentModalField = null;
}

function renderModalOptions(fieldId, searchTerm) {
    const optionsEl = document.getElementById('modalSelectOptions');
    if (!optionsEl) return;
    
    let options = [];
    
    // Para TODOS os campos, buscar valores existentes no banco de prefixos
    const fieldMapping = {
        prefixoMolde: 'prefixoMolde',
        prefixoBlank: 'prefixoBlank',
        prefixNeckring: 'neckring',
        prefixAneisGuias: 'aneisGuias',
        prefixThimble: 'thimble',
        prefixMacho: 'macho',
        prefixCooler: 'cooler',
        prefixBaffle: 'baffle',
        prefixBafflePlug: 'bafflePlug',
        prefixFunil: 'funil',
        prefixFundo: 'fundo',
        prefixFundoPlug: 'fundoPlug',
        prefixSoprador: 'soprador',
        prefixPinca: 'pinca'
    };
    
    const termKey = fieldMapping[fieldId];
    
    // Buscar valores existentes em todos os prefixos
    let existingValues = [];
    if (termKey && window.prefixDatabase) {
        existingValues = Object.values(window.prefixDatabase)
            .map(item => {
                if (fieldId === 'prefixoMolde') return item.terminacoes?.prefixoMolde;
                if (fieldId === 'prefixoBlank') return item.terminacoes?.prefixoBlank;
                return item.terminacoes?.[termKey];
            })
            .filter(v => v && v.trim() !== '')
            .filter((v, i, a) => a.indexOf(v) === i); // Remover duplicados
    }
    
    // Opções padrão do selectOptions
    const defaultOptions = modalSelectOptions[fieldId] || [];
    
    // Combinar todas as opções
    options = [...new Set([...defaultOptions, ...existingValues])];
    
    // Ordenar alfabeticamente
    options.sort();
    
    // Aplicar filtro de busca
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        options = options.filter(opt => opt.toLowerCase().includes(term));
    }
    
    // Renderizar
    if (options.length === 0) {
        optionsEl.innerHTML = `
            <div class="modal-select-empty">
                <i class="fas fa-search"></i>
                <p>Nenhuma opção encontrada</p>
                <p style="font-size: 13px; margin-top: 5px;">Digite uma nova opção abaixo e clique em "Adicionar"</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    options.forEach(option => {
        // Escapar aspas simples para não quebrar o HTML
        const escapedOption = option.replace(/'/g, "\\'");
        html += `
            <div class="modal-select-option" onclick="selectModalOption('${fieldId}', '${escapedOption}')">
                ${option}
            </div>
        `;
    });
    
    optionsEl.innerHTML = html;
}

function filterModalOptions() {
    if (!currentModalField) return;
    
    const searchTerm = document.getElementById('modalSelectSearch').value.trim();
    renderModalOptions(currentModalField, searchTerm);
}

function selectModalOption(fieldId, value) {
    console.log(`✅ Selecionado: ${fieldId} = ${value}`);
    
    const hiddenInput = document.getElementById(fieldId);
    const displayEl = document.getElementById(`display-${fieldId}`);
    
    if (hiddenInput) hiddenInput.value = value;
    if (displayEl) displayEl.textContent = value;
    
    closeModalSelect();
}

async function addNewOptionFromModal() {
    if (!currentModalField) return;
    
    const input = document.getElementById('modalSelectNewOption');
    const value = input.value.trim();
    
    if (!value) {
        showAlert('erro', 'Digite um valor para adicionar');
        return;
    }
    
    // Mapear campo para categoria no selectOptions
    const fieldToCategory = {
        prefixoMolde: 'prefixosMolde',
        prefixoBlank: 'prefixosBlank',
        prefixNeckring: 'neckrings',
        prefixAneisGuias: 'aneis_guias',
        prefixThimble: 'thimbles',
        prefixMacho: 'machos',
        prefixCooler: 'coolers',
        prefixBaffle: 'baffles',
        prefixBafflePlug: 'baffle_plugs',
        prefixFunil: 'funis',
        prefixFundo: 'fundos',
        prefixFundoPlug: 'fundo_plugs',
        prefixSoprador: 'sopradores',
        prefixPinca: 'pincas'
    };
    
    const category = fieldToCategory[currentModalField];
    
    try {
        // Para TODOS os campos, incluindo molde e blank, vamos adicionar à lista de opções
        if (category) {
            // Se tem categoria no selectOptions, salvar lá
            const currentOptions = selectOptions[category] || [];
            
            if (!currentOptions.includes(value)) {
                const newOptions = [...currentOptions, value];
                await selectOptionsRef.child(category).set(newOptions);
                
                // Atualizar selectOptions
                selectOptions[category] = newOptions;
            }
        }
        
        // Para campos de molde e blank, também adicionar às opções do modal
        if (!modalSelectOptions[currentModalField]) {
            modalSelectOptions[currentModalField] = [];
        }
        
        if (!modalSelectOptions[currentModalField].includes(value)) {
            modalSelectOptions[currentModalField] = [...modalSelectOptions[currentModalField], value];
        }
        
        // Selecionar a nova opção
        selectModalOption(currentModalField, value);
        
        input.value = '';
        
        showAlert('sucesso', `Opção "${value}" adicionada!`);
        
    } catch (error) {
        console.error("❌ Erro ao adicionar opção:", error);
        showAlert('erro', `Erro ao adicionar opção: ${error.message}`);
    }
}

// ================= EXPORTAÇÃO =================
window.initModalSelect = initModalSelect;
window.openModalSelect = openModalSelect;
window.closeModalSelect = closeModalSelect;
window.filterModalOptions = filterModalOptions;
window.selectModalOption = selectModalOption;
window.addNewOptionFromModal = addNewOptionFromModal;

console.log("✅ Modal Select carregado");