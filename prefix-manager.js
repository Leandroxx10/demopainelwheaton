// ================= GERENCIADOR DE PREFIXOS DETALHADOS =================
// Versão corrigida com upload de imagens e botão limpar funcionando

if (typeof window.prefixDatabase === 'undefined') {
    window.prefixDatabase = {};
}

let selectOptions = {
    processos: ['SG', 'DG', 'TG', 'QG', 'PS', 'PD', 'AMOSTRA'],
    corredores: Array.from({length: 15}, (_, i) => (i + 1).toString()),
    neckrings: ['FE-13', 'FE-15', 'FE-15-CT', 'FE-15-CTN', '410-15-BO', '410-15-NA', 'EURO-3'],
    aneis_guias: ['AG-13', 'AG-15', 'AG-18'],
    thimbles: ['TG-DGE', 'TG-STD', 'TG-PRO'],
    machos: ['M-13', 'M-15', 'M-18'],
    coolers: ['C-1', 'C-2', 'C-3'],
    baffles: ['B-1', 'B-2', 'B-3'],
    baffle_plugs: ['BP-1', 'BP-2', 'BP-3'],
    funis: ['F-1', 'F-2', 'F-3'],
    fundos: ['FD-1', 'FD-2', 'FD-3'],
    fundo_plugs: ['FP-1', 'FP-2', 'FP-3'],
    sopradores: ['S-1', 'S-2', 'S-3'],
    pincas: ['P-1', 'P-2', 'P-3']
};

let prefixRef;
let selectOptionsRef;
let prefixImagesRef;

// REMOVIDO: const IMGBB_API_KEY = "2a25342d2ee5a8abc7c249f07f874799";

// ================= INICIALIZAÇÃO =================
function initPrefixManager() {
    console.log("🚀 Inicializando gerenciador de prefixos...");
    
    if (typeof db !== 'undefined') {
        prefixRef = db.ref("prefixDatabase");
        selectOptionsRef = db.ref("selectOptions");
        prefixImagesRef = db.ref("prefixImages");
        
        loadSelectOptions();
        loadPrefixDatabase();
        setupPrefixEventListeners();
        
        // Garantir que o botão limpar funciona
        const clearBtn = document.getElementById('clearPrefixFormBtn');
        if (clearBtn) {
            clearBtn.onclick = clearPrefixForm;
        }
    } else {
        console.error("❌ Firebase não inicializado");
        setTimeout(initPrefixManager, 1000);
    }
}

// ================= CARREGAR OPÇÕES DOS SELECTS =================
function loadSelectOptions() {
    selectOptionsRef.on("value", (snapshot) => {
        const data = snapshot.val() || {};
        
        if (data.aneis_guias) selectOptions.aneis_guias = data.aneis_guias;
        if (data.thimbles) selectOptions.thimbles = data.thimbles;
        if (data.machos) selectOptions.machos = data.machos;
        if (data.coolers) selectOptions.coolers = data.coolers;
        if (data.baffles) selectOptions.baffles = data.baffles;
        if (data.baffle_plugs) selectOptions.baffle_plugs = data.baffle_plugs;
        if (data.funis) selectOptions.funis = data.funis;
        if (data.fundos) selectOptions.fundos = data.fundos;
        if (data.fundo_plugs) selectOptions.fundo_plugs = data.fundo_plugs;
        if (data.sopradores) selectOptions.sopradores = data.sopradores;
        if (data.pincas) selectOptions.pincas = data.pincas;
        
        console.log("✅ Opções dos selects carregadas");
        updateSelectOptions();
    }, (error) => {
        console.error("❌ Erro ao carregar opções:", error);
    });
}

// ================= CARREGAR BANCO DE PREFIXOS =================
function loadPrefixDatabase() {
    prefixRef.on("value", (snapshot) => {
        const data = snapshot.val() || {};
        
        Object.keys(data).forEach(key => {
            window.prefixDatabase[key] = data[key];
        });
        
        console.log("✅ Banco de prefixos carregado:", Object.keys(window.prefixDatabase).length, "registros");
        renderPrefixTable();
    }, (error) => {
        console.error("❌ Erro ao carregar prefixos:", error);
    });
}

// ================= ATUALIZAR OPÇÕES DOS SELECTS =================
function updateSelectOptions() {
    const processoSelect = document.getElementById('prefixProcesso');
    if (processoSelect) {
        processoSelect.innerHTML = '<option value="">Selecione</option>';
        selectOptions.processos.forEach(option => {
            processoSelect.innerHTML += `<option value="${option}">${option}</option>`;
        });
    }
    
    const corredorSelect = document.getElementById('prefixCorredor');
    if (corredorSelect) {
        corredorSelect.innerHTML = '<option value="">Selecione</option>';
        selectOptions.corredores.forEach(option => {
            corredorSelect.innerHTML += `<option value="${option}">Corredor ${option}</option>`;
        });
    }
    
    // Atualizar os campos hidden com as opções para o modal
    updateModalOptions();
}

function updateModalOptions() {
    const allOptions = {
        prefixoMolde: [],
        prefixoBlank: [],
        prefixNeckring: [...selectOptions.neckrings, ...selectOptions.aneis_guias],
        prefixAneisGuias: [...selectOptions.neckrings, ...selectOptions.aneis_guias],
        prefixThimble: selectOptions.thimbles,
        prefixMacho: selectOptions.machos,
        prefixCooler: selectOptions.coolers,
        prefixBaffle: selectOptions.baffles,
        prefixBafflePlug: selectOptions.baffle_plugs,
        prefixFunil: selectOptions.funis,
        prefixFundo: selectOptions.fundos,
        prefixFundoPlug: selectOptions.fundo_plugs,
        prefixSoprador: selectOptions.sopradores,
        prefixPinca: selectOptions.pincas
    };
    
    window.modalSelectOptions = allOptions;
}

// ================= FUNÇÕES DE IMAGEM =================
function previewPrefixImage() {
    const fileInput = document.getElementById('prefixImageFile');
    const preview = document.getElementById('prefixImagePreview');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Pré-visualização" style="max-width: 100%; max-height: 200px; object-fit: contain;">`;
        }
        
        reader.readAsDataURL(fileInput.files[0]);
    }
}

async function uploadPrefixImage() {
    const fileInput = document.getElementById('prefixImageFile');
    const prefixGrande = document.getElementById('prefixGrande').value.trim();
    
    if (!prefixGrande) {
        showAlert('erro', 'Salve o prefixo primeiro antes de fazer upload da imagem');
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
    
    const uploadBtn = document.querySelector('[onclick="uploadPrefixImage()"]');
    const originalText = uploadBtn ? uploadBtn.innerHTML : 'Upload';
    if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        uploadBtn.disabled = true;
    }
    
    try {
        const base64Image = await fileToBase64(file);
        
        // Usar a constante global definida em admin.js
        const imgbbUrl = `https://api.imgbb.com/1/upload?key=${window.IMGBB_API_KEY || "2a25342d2ee5a8abc7c249f07f874799"}`;
        
        const formData = new FormData();
        formData.append('image', base64Image.split(',')[1]);
        
        const response = await fetch(imgbbUrl, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            const imageUrl = result.data.url;
            
            document.getElementById('prefixImageUrl').value = imageUrl;
            
            document.getElementById('currentPrefixImage').src = imageUrl;
            document.getElementById('currentPrefixImageContainer').style.display = 'block';
            
            document.getElementById('prefixImagePreview').innerHTML = '<p>Imagem enviada com sucesso!</p>';
            
            showAlert('sucesso', 'Imagem enviada com sucesso!');
            
            if (window.prefixDatabase[prefixGrande]) {
                await prefixRef.child(prefixGrande).child('imagem').set({
                    url: imageUrl,
                    dataUpload: Date.now()
                });
                
                window.prefixDatabase[prefixGrande].imagem = {
                    url: imageUrl,
                    dataUpload: Date.now()
                };
            }
        } else {
            throw new Error(result.error?.message || 'Erro ao enviar imagem');
        }
    } catch (error) {
        console.error("❌ Erro no upload:", error);
        showAlert('erro', `Erro ao enviar imagem: ${error.message}`);
    } finally {
        if (uploadBtn) {
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        }
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

function clearPrefixImage() {
    document.getElementById('prefixImageFile').value = '';
    document.getElementById('prefixImagePreview').innerHTML = '<p>Nenhuma imagem selecionada</p>';
}

async function deletePrefixImage() {
    const prefixGrande = document.getElementById('prefixGrande').value.trim();
    
    if (!prefixGrande) return;
    
    if (!confirm('Remover a imagem deste prefixo?')) return;
    
    try {
        document.getElementById('prefixImageUrl').value = '';
        document.getElementById('currentPrefixImageContainer').style.display = 'none';
        
        if (window.prefixDatabase[prefixGrande]) {
            await prefixRef.child(prefixGrande).child('imagem').remove();
            
            if (window.prefixDatabase[prefixGrande]) {
                delete window.prefixDatabase[prefixGrande].imagem;
            }
        }
        
        showAlert('sucesso', 'Imagem removida com sucesso!');
    } catch (error) {
        console.error("❌ Erro ao remover imagem:", error);
        showAlert('erro', `Erro ao remover imagem: ${error.message}`);
    }
}

// ================= SALVAR PREFIXO DETALHADO =================
async function saveDetailedPrefix() {
    const prefixGrande = document.getElementById('prefixGrande').value.trim();
    const processo = document.getElementById('prefixProcesso').value;
    const corredor = document.getElementById('prefixCorredor').value;
    const prateleira = document.getElementById('prefixPrateleira').value.trim();
    const imageUrl = document.getElementById('prefixImageUrl').value;
    
    const prefixoMolde = document.getElementById('prefixoMolde').value;
    const prefixoBlank = document.getElementById('prefixoBlank').value;
    const neckring = document.getElementById('prefixNeckring').value;
    const aneisGuias = document.getElementById('prefixAneisGuias').value;
    const thimble = document.getElementById('prefixThimble').value;
    const macho = document.getElementById('prefixMacho').value;
    const cooler = document.getElementById('prefixCooler').value;
    const baffle = document.getElementById('prefixBaffle').value;
    const bafflePlug = document.getElementById('prefixBafflePlug').value;
    const funil = document.getElementById('prefixFunil').value;
    const fundo = document.getElementById('prefixFundo').value;
    const fundoPlug = document.getElementById('prefixFundoPlug').value;
    const soprador = document.getElementById('prefixSoprador').value;
    const pinca = document.getElementById('prefixPinca').value;
    
    if (!prefixGrande) {
        showAlert('erro', 'O campo "Prefixo" é obrigatório');
        return;
    }
    
    if (!processo) {
        showAlert('erro', 'Selecione o Tipo de Processo');
        return;
    }
    
    const prefixData = {
        prefixGrande: prefixGrande,
        processo: processo,
        localizacao: {
            corredor: corredor,
            prateleira: prateleira
        },
        terminacoes: {
            prefixoMolde: prefixoMolde,
            prefixoBlank: prefixoBlank,
            neckring: neckring,
            aneisGuias: aneisGuias,
            thimble: thimble,
            macho: macho,
            cooler: cooler,
            baffle: baffle,
            bafflePlug: bafflePlug,
            funil: funil,
            fundo: fundo,
            fundoPlug: fundoPlug,
            soprador: soprador,
            pinca: pinca
        },
        criadoEm: Date.now(),
        atualizadoEm: Date.now(),
        criadoPor: 'Administrador'
    };
    
    if (imageUrl) {
        prefixData.imagem = {
            url: imageUrl,
            dataUpload: Date.now()
        };
    }
    
    try {
        await prefixRef.child(prefixGrande).set(prefixData);
        
        showAlert('sucesso', `Prefixo "${prefixGrande}" salvo com sucesso!`);
        
        checkForDuplicates(prefixGrande, prefixoMolde, prefixoBlank);
        
        clearPrefixForm();
        
    } catch (error) {
        console.error("❌ Erro ao salvar prefixo:", error);
        showAlert('erro', `Erro ao salvar prefixo: ${error.message}`);
    }
}

// ================= LIMPAR FORMULÁRIO (CORRIGIDO) =================
function clearPrefixForm() {
    console.log("🧹 Limpando formulário de prefixo");
    
    document.getElementById('prefixGrande').value = '';
    document.getElementById('prefixProcesso').value = '';
    document.getElementById('prefixCorredor').value = '';
    document.getElementById('prefixPrateleira').value = '';
    document.getElementById('prefixImageUrl').value = '';
    document.getElementById('currentPrefixImageContainer').style.display = 'none';
    document.getElementById('prefixImagePreview').innerHTML = '<p>Nenhuma imagem selecionada</p>';
    document.getElementById('prefixImageFile').value = '';
    
    // Limpar todos os campos hidden dos modais
    const fieldIds = [
        'prefixoMolde', 'prefixoBlank', 'prefixNeckring', 'prefixAneisGuias',
        'prefixThimble', 'prefixMacho', 'prefixCooler', 'prefixBaffle',
        'prefixBafflePlug', 'prefixFunil', 'prefixFundo', 'prefixFundoPlug',
        'prefixSoprador', 'prefixPinca'
    ];
    
    fieldIds.forEach(id => {
        document.getElementById(id).value = '';
        const displayEl = document.getElementById(`display-${id}`);
        if (displayEl) {
            displayEl.textContent = 'Selecione';
        }
    });
    
    // Resetar botão de salvar
    const saveBtn = document.querySelector('#detailedPrefixForm .btn-primary');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Prefixo';
        saveBtn.onclick = saveDetailedPrefix;
    }
    
    showAlert('info', 'Formulário limpo');
}

// ================= RENDERIZAR TABELA DE PREFIXOS =================
function renderPrefixTable() {
    const tableBody = document.getElementById('detailedPrefixTable');
    if (!tableBody) return;
    
    const items = Object.keys(window.prefixDatabase)
        .sort()
        .map(key => ({ ...window.prefixDatabase[key], key }));
    
    if (items.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-light);">
                    <i class="fas fa-database" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                    Nenhum prefixo cadastrado
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    items.forEach(item => {
        const createdDate = new Date(item.criadoEm).toLocaleDateString('pt-BR');
        
        html += `
            <tr data-prefix="${item.key}" style="cursor: pointer;" onclick="viewPrefixDetails('${item.key}')">
                <td>
                    <strong>${item.prefixGrande}</strong>
                </td>
                <td>
                    <span style="background: var(--primary-light); color: var(--primary); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        ${item.processo}
                    </span>
                </td>
                <td>
                    ${item.localizacao?.corredor ? `C${item.localizacao.corredor}` : '-'}
                    ${item.localizacao?.prateleira ? `/ P${item.localizacao.prateleira}` : ''}
                </td>
                <td>${item.terminacoes?.prefixoMolde || '-'}</td>
                <td>${item.terminacoes?.prefixoBlank || '-'}</td>
                <td>${item.terminacoes?.neckring || '-'}</td>
                <td>
                    ${item.imagem ? 
                        `<div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 2px solid var(--border);">
                            <img src="${item.imagem.url}" alt="Imagem" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" 
                                 onclick="event.stopPropagation(); viewPrefixImageFull('${item.imagem.url}')">
                        </div>` : 
                        `<div style="width: 60px; height: 60px; background: var(--bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-light); border: 1px dashed var(--border);">
                            <i class="fas fa-image" style="font-size: 20px; opacity: 0.5;"></i>
                        </div>`
                    }
                </td>
                <td>${createdDate}</td>
                <td onclick="event.stopPropagation();">
                    <div class="action-buttons" style="display: flex; gap: 5px;">
                        <button class="btn-small" onclick="editDetailedPrefix('${item.key}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-small" onclick="viewPrefixDetails('${item.key}')" title="Visualizar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-small btn-danger" onclick="deleteDetailedPrefix('${item.key}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

function viewPrefixImage(url) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        cursor: pointer;
    `;
    modal.onclick = function() { this.remove(); };
    
    modal.innerHTML = `
        <img src="${url}" style="max-width: 90%; max-height: 90%; object-fit: contain;" onclick="event.stopPropagation()">
    `;
    
    document.body.appendChild(modal);
}

// ================= EDITAR PREFIXO =================
function editDetailedPrefix(prefixKey) {
    const item = window.prefixDatabase[prefixKey];
    if (!item) return;
    
    clearPrefixForm();
    
    document.getElementById('prefixGrande').value = item.prefixGrande || '';
    document.getElementById('prefixProcesso').value = item.processo || '';
    document.getElementById('prefixCorredor').value = item.localizacao?.corredor || '';
    document.getElementById('prefixPrateleira').value = item.localizacao?.prateleira || '';
    
    const fieldMappings = {
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
    
    Object.keys(fieldMappings).forEach(fieldId => {
        const termKey = fieldMappings[fieldId];
        const value = item.terminacoes?.[termKey] || '';
        document.getElementById(fieldId).value = value;
        
        const displayEl = document.getElementById(`display-${fieldId}`);
        if (displayEl) {
            displayEl.textContent = value || 'Selecione';
        }
    });
    
    if (item.imagem && item.imagem.url) {
        document.getElementById('prefixImageUrl').value = item.imagem.url;
        document.getElementById('currentPrefixImage').src = item.imagem.url;
        document.getElementById('currentPrefixImageContainer').style.display = 'block';
    }
    
    document.getElementById('prefixGrande').scrollIntoView({ behavior: 'smooth' });
    
    const saveBtn = document.querySelector('#detailedPrefixForm .btn-primary');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Prefixo';
        saveBtn.onclick = function() { updateDetailedPrefix(prefixKey); };
    }
    
    showAlert('info', `Editando prefixo "${prefixKey}".`);
}

async function updateDetailedPrefix(prefixKey) {
    const prefixGrande = document.getElementById('prefixGrande').value.trim();
    
    if (prefixGrande !== prefixKey) {
        await movePrefixData(prefixKey, prefixGrande);
    } else {
        await saveUpdatedPrefix(prefixKey);
    }
}

async function movePrefixData(oldKey, newKey) {
    if (!confirm(`Alterar nome do prefixo de "${oldKey}" para "${newKey}"?`)) {
        return;
    }
    
    try {
        const oldData = window.prefixDatabase[oldKey];
        
        const newData = {
            ...oldData,
            prefixGrande: newKey,
            atualizadoEm: Date.now()
        };
        
        await prefixRef.child(newKey).set(newData);
        await prefixRef.child(oldKey).remove();
        
        showAlert('sucesso', `Prefixo renomeado de "${oldKey}" para "${newKey}"`);
        clearPrefixForm();
        
    } catch (error) {
        console.error("❌ Erro ao renomear prefixo:", error);
        showAlert('erro', `Erro ao renomear prefixo: ${error.message}`);
    }
}

async function saveUpdatedPrefix(prefixKey) {
    const item = window.prefixDatabase[prefixKey];
    if (!item) return;
    
    const prefixGrande = document.getElementById('prefixGrande').value.trim();
    const processo = document.getElementById('prefixProcesso').value;
    const corredor = document.getElementById('prefixCorredor').value;
    const prateleira = document.getElementById('prefixPrateleira').value.trim();
    const imageUrl = document.getElementById('prefixImageUrl').value;
    
    const prefixoMolde = document.getElementById('prefixoMolde').value;
    const prefixoBlank = document.getElementById('prefixoBlank').value;
    const neckring = document.getElementById('prefixNeckring').value;
    const aneisGuias = document.getElementById('prefixAneisGuias').value;
    const thimble = document.getElementById('prefixThimble').value;
    const macho = document.getElementById('prefixMacho').value;
    const cooler = document.getElementById('prefixCooler').value;
    const baffle = document.getElementById('prefixBaffle').value;
    const bafflePlug = document.getElementById('prefixBafflePlug').value;
    const funil = document.getElementById('prefixFunil').value;
    const fundo = document.getElementById('prefixFundo').value;
    const fundoPlug = document.getElementById('prefixFundoPlug').value;
    const soprador = document.getElementById('prefixSoprador').value;
    const pinca = document.getElementById('prefixPinca').value;
    
    const updatedData = {
        ...item,
        prefixGrande: prefixGrande,
        processo: processo,
        localizacao: {
            corredor: corredor,
            prateleira: prateleira
        },
        terminacoes: {
            prefixoMolde: prefixoMolde,
            prefixoBlank: prefixoBlank,
            neckring: neckring,
            aneisGuias: aneisGuias,
            thimble: thimble,
            macho: macho,
            cooler: cooler,
            baffle: baffle,
            bafflePlug: bafflePlug,
            funil: funil,
            fundo: fundo,
            fundoPlug: fundoPlug,
            soprador: soprador,
            pinca: pinca
        },
        atualizadoEm: Date.now()
    };
    
    if (imageUrl) {
        updatedData.imagem = {
            url: imageUrl,
            dataUpload: Date.now()
        };
    } else if (item.imagem) {
        updatedData.imagem = item.imagem;
    }
    
    try {
        await prefixRef.child(prefixKey).set(updatedData);
        showAlert('sucesso', `Prefixo "${prefixKey}" atualizado com sucesso!`);
        clearPrefixForm();
        
    } catch (error) {
        console.error("❌ Erro ao atualizar prefixo:", error);
        showAlert('erro', `Erro ao atualizar prefixo: ${error.message}`);
    }
}

// ================= VISUALIZAR PREFIXO =================
function viewDetailedPrefix(prefixKey) {
    const item = window.prefixDatabase[prefixKey];
    if (!item) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    const createdDate = new Date(item.criadoEm).toLocaleDateString('pt-BR');
    
    let imageHTML = '';
    if (item.imagem && item.imagem.url) {
        imageHTML = `
            <div style="margin-top: 20px; text-align: center;">
                <img src="${item.imagem.url}" style="max-width: 100%; max-height: 200px; border-radius: 8px; cursor: pointer;" onclick="viewPrefixImage('${item.imagem.url}')">
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div style="background: var(--card-bg); border-radius: 12px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border);">
            <div style="padding: 25px; position: relative;">
                <button onclick="this.closest('.modal-overlay').remove()" 
                        style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: var(--text-light); font-size: 20px; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
                
                <h3 style="font-size: 20px; margin-bottom: 20px; color: var(--text); display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-tag"></i> Detalhes do Prefixo
                </h3>
                
                ${imageHTML}
                
                <div style="display: grid; gap: 20px; margin-top: 20px;">
                    <div style="background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
                        <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text);">Informações Básicas</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div>
                                <div style="font-size: 12px; color: var(--text-light);">Prefixo</div>
                                <div style="font-size: 18px; font-weight: 700;">${item.prefixGrande}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: var(--text-light);">Processo</div>
                                <div style="font-size: 18px; font-weight: 700; color: var(--primary);">${item.processo}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
                        <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text);">Localização</h4>
                        <div>
                            <div>Corredor: ${item.localizacao?.corredor || 'Não informado'}</div>
                            <div>Prateleira: ${item.localizacao?.prateleira || 'Não informado'}</div>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
                        <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text);">Terminações</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            ${Object.entries(item.terminacoes || {}).map(([key, value]) => 
                                value ? `<div><strong>${key}:</strong> ${value}</div>` : ''
                            ).join('')}
                        </div>
                    </div>
                    
                    <div>
                        <div>Criado em: ${createdDate}</div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button onclick="editDetailedPrefix('${prefixKey}'); this.closest('.modal-overlay').remove()" 
                                class="btn" style="flex: 1; background: var(--primary); color: white;">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                class="btn" style="flex: 1;">
                            <i class="fas fa-times"></i> Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ================= EXCLUIR PREFIXO =================
async function deleteDetailedPrefix(prefixKey) {
    if (!confirm(`Tem certeza que deseja excluir o prefixo "${prefixKey}"? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        await prefixRef.child(prefixKey).remove();
        showAlert('sucesso', `Prefixo "${prefixKey}" excluído com sucesso!`);
    } catch (error) {
        console.error("❌ Erro ao excluir prefixo:", error);
        showAlert('erro', `Erro ao excluir prefixo: ${error.message}`);
    }
}

// ================= VERIFICAR DUPLICATAS =================
function checkForDuplicates(prefixGrande, prefixoMolde, prefixoBlank) {
    let duplicates = [];
    
    Object.keys(window.prefixDatabase).forEach(key => {
        if (key !== prefixGrande) {
            const item = window.prefixDatabase[key];
            
            if (item.terminacoes?.prefixoMolde === prefixoMolde && prefixoMolde) {
                duplicates.push({prefixo: key, campo: 'Prefixos Molde', valor: prefixoMolde});
            }
            
            if (item.terminacoes?.prefixoBlank === prefixoBlank && prefixoBlank) {
                duplicates.push({prefixo: key, campo: 'Prefixos Blank', valor: prefixoBlank});
            }
        }
    });
    
    if (duplicates.length > 0) {
        let message = "Atenção! Foram encontrados valores duplicados:\n\n";
        duplicates.forEach(dup => {
            message += `• ${dup.campo}: "${dup.valor}" já existe no prefixo "${dup.prefixo}"\n`;
        });
        
        setTimeout(() => {
            alert(message);
        }, 500);
    }
}

// ================= BUSCAR PREFIXOS =================
function searchPrefixes() {
    const searchTerm = document.getElementById('prefixSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#detailedPrefixTable tr[data-prefix]');
    
    rows.forEach(row => {
        const prefixKey = row.getAttribute('data-prefix');
        const item = window.prefixDatabase[prefixKey];
        
        if (!item) return;
        
        const searchIn = `
            ${item.prefixGrande} 
            ${item.processo} 
            ${item.localizacao?.corredor || ''} 
            ${item.localizacao?.prateleira || ''} 
            ${item.terminacoes?.prefixoMolde || ''} 
            ${item.terminacoes?.prefixoBlank || ''}
        `.toLowerCase();
        
        row.style.display = searchTerm === '' || searchIn.includes(searchTerm) ? '' : 'none';
    });
}

// ================= GERENCIAR OPÇÕES DOS SELECTS =================
function openSelectOptionsManager() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    const categories = [
        { id: 'aneis_guias', name: 'Anéis Guias', icon: 'fa-circle' },
        { id: 'thimbles', name: 'Thimbles', icon: 'fa-bullseye' },
        { id: 'machos', name: 'Machos', icon: 'fa-cube' },
        { id: 'coolers', name: 'Coolers', icon: 'fa-snowflake' },
        { id: 'baffles', name: 'Baffles', icon: 'fa-filter' },
        { id: 'baffle_plugs', name: 'Baffle Plugs', icon: 'fa-plug' },
        { id: 'funis', name: 'Funís', icon: 'fa-funnel' },
        { id: 'fundos', name: 'Fundos', icon: 'fa-circle-notch' },
        { id: 'fundo_plugs', name: 'Fundo Plugs', icon: 'fa-plug' },
        { id: 'sopradores', name: 'Sopradores', icon: 'fa-wind' },
        { id: 'pincas', name: 'Pinças', icon: 'fa-hand-paper' }
    ];
    
    let tabsHTML = '';
    let contentHTML = '';
    
    categories.forEach((cat, index) => {
        const isActive = index === 0 ? 'active' : '';
        const items = selectOptions[cat.id] || [];
        
        tabsHTML += `
            <button class="tab-btn ${isActive}" onclick="switchSelectTab('${cat.id}')">
                <i class="fas ${cat.icon}"></i> ${cat.name}
            </button>
        `;
        
        contentHTML += `
            <div class="tab-content ${isActive}" id="tab-${cat.id}">
                <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text);">
                    <i class="fas ${cat.icon}"></i> ${cat.name}
                </h4>
                
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <input type="text" id="new-${cat.id}" placeholder="Nova opção" 
                               style="flex: 1; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
                        <button class="btn" onclick="addSelectOption('${cat.id}')" style="background: var(--primary); color: white;">
                            <i class="fas fa-plus"></i> Adicionar
                        </button>
                    </div>
                </div>
                
                <div style="background: var(--bg); border-radius: 8px; border: 1px solid var(--border); max-height: 300px; overflow-y: auto;">
                    ${items.length > 0 ? 
                        items.map((item, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid var(--border);">
                                <span style="color: var(--text);">${item}</span>
                                <button class="btn-small btn-danger" onclick="removeSelectOption('${cat.id}', ${idx})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `).join('') : 
                        '<div style="padding: 40px; text-align: center; color: var(--text-light);">Nenhuma opção cadastrada</div>'
                    }
                </div>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div style="background: var(--card-bg); border-radius: 12px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border);">
            <div style="padding: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h3 style="font-size: 20px; color: var(--text); display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-list-ul"></i> Gerenciar Opções dos Selects
                    </h3>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="background: none; border: none; color: var(--text-light); font-size: 20px; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="margin-bottom: 20px; display: flex; gap: 5px; flex-wrap: wrap; border-bottom: 1px solid var(--border);">
                    ${tabsHTML}
                </div>
                
                ${contentHTML}
                
                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="btn" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function switchSelectTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`.tab-btn[onclick*="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

async function addSelectOption(category) {
    const input = document.getElementById(`new-${category}`);
    const value = input.value.trim();
    
    if (!value) {
        showAlert('erro', 'Digite um valor para adicionar');
        return;
    }
    
    if (selectOptions[category].includes(value)) {
        showAlert('erro', 'Esta opção já existe');
        return;
    }
    
    try {
        const newOptions = [...selectOptions[category], value];
        await selectOptionsRef.child(category).set(newOptions);
        
        selectOptions[category] = newOptions;
        input.value = '';
        
        switchSelectTab(category);
        updateModalOptions();
        
        showAlert('sucesso', `Opção "${value}" adicionada`);
        
    } catch (error) {
        console.error("❌ Erro ao adicionar opção:", error);
        showAlert('erro', `Erro ao adicionar opção: ${error.message}`);
    }
}

async function removeSelectOption(category, index) {
    const option = selectOptions[category][index];
    
    if (!confirm(`Remover a opção "${option}"?`)) return;
    
    try {
        const newOptions = selectOptions[category].filter((_, i) => i !== index);
        await selectOptionsRef.child(category).set(newOptions);
        
        selectOptions[category] = newOptions;
        
        switchSelectTab(category);
        updateModalOptions();
        
        showAlert('sucesso', `Opção "${option}" removida`);
        
    } catch (error) {
        console.error("❌ Erro ao remover opção:", error);
        showAlert('erro', `Erro ao remover opção: ${error.message}`);
    }
}

// ================= EXPORTAR DADOS =================
function exportPrefixData() {
    const data = {
        exportDate: new Date().toISOString(),
        totalPrefixes: Object.keys(window.prefixDatabase).length,
        prefixes: window.prefixDatabase,
        selectOptions: selectOptions
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `prefixos_${new Date().getTime()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('sucesso', 'Dados exportados com sucesso!');
}

// ================= MODAL DE VISUALIZAÇÃO COMPLETA DO PREFIXO =================
function viewPrefixDetails(prefixKey) {
    const item = window.prefixDatabase[prefixKey];
    if (!item) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        backdrop-filter: blur(5px);
    `;
    
    const createdDate = new Date(item.criadoEm).toLocaleDateString('pt-BR');
    const updatedDate = item.atualizadoEm ? new Date(item.atualizadoEm).toLocaleDateString('pt-BR') : createdDate;
    
    // Construir HTML das terminações
    let terminationsHTML = '';
    const termKeys = {
        'prefixoMolde': 'Prefixo Molde',
        'prefixoBlank': 'Prefixo Blank',
        'neckring': 'Neckring',
        'aneisGuias': 'Anéis Guias',
        'thimble': 'Thimble',
        'macho': 'Macho',
        'cooler': 'Cooler',
        'baffle': 'Baffle',
        'bafflePlug': 'Baffle Plug',
        'funil': 'Funil',
        'fundo': 'Fundo',
        'fundoPlug': 'Fundo Plug',
        'soprador': 'Soprador',
        'pinca': 'Pinças'
    };
    
    Object.keys(termKeys).forEach(key => {
        const value = item.terminacoes?.[key];
        if (value && value.trim() !== '') {
            terminationsHTML += `
                <div style="background: var(--bg); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--primary);">
                    <div style="font-size: 11px; color: var(--text-light); margin-bottom: 2px;">${termKeys[key]}</div>
                    <div style="font-size: 14px; font-weight: 600; color: var(--text);">${value}</div>
                </div>
            `;
        }
    });
    
    modal.innerHTML = `
        <div style="background: var(--card-bg); border-radius: 16px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="padding: 30px; position: relative;">
                <!-- Botão fechar -->
                <button onclick="this.closest('.modal-overlay').remove()" 
                        style="position: absolute; top: 20px; right: 20px; background: var(--bg); border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text); border: 1px solid var(--border); z-index: 10;">
                    <i class="fas fa-times"></i>
                </button>
                
                <!-- Cabeçalho -->
                <div style="display: flex; gap: 30px; margin-bottom: 30px; flex-wrap: wrap;">
                    <!-- Imagem -->
                    <div style="flex: 1; min-width: 200px;">
                        ${item.imagem ? 
                            `<img src="${item.imagem.url}" alt="${item.prefixGrande}" 
                                  style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; border: 2px solid var(--border); cursor: pointer;"
                                  onclick="viewPrefixImageFull('${item.imagem.url}')">` : 
                            `<div style="width: 100%; height: 200px; background: var(--bg); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--text-light); border: 2px dashed var(--border);">
                                <i class="fas fa-image" style="font-size: 40px; opacity: 0.5;"></i>
                            </div>`
                        }
                    </div>
                    
                    <!-- Informações principais -->
                    <div style="flex: 2;">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
                            <h2 style="font-size: 28px; margin: 0; color: var(--text);">${item.prefixGrande}</h2>
                            <span style="background: var(--primary); color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                ${item.processo}
                            </span>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; background: var(--bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
                            <div>
                                <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Localização</div>
                                <div style="font-size: 16px; font-weight: 600;">
                                    ${item.localizacao?.corredor ? `Corredor ${item.localizacao.corredor}` : 'Não definido'}
                                    ${item.localizacao?.prateleira ? ` / Prateleira ${item.localizacao.prateleira}` : ''}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Criado em</div>
                                <div style="font-size: 16px; font-weight: 600;">${createdDate}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Última atualização</div>
                                <div style="font-size: 16px; font-weight: 600;">${updatedDate}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Criado por</div>
                                <div style="font-size: 16px; font-weight: 600;">${item.criadoPor || 'Administrador'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Terminações -->
                <div style="margin-top: 30px;">
                    <h3 style="font-size: 20px; margin-bottom: 20px; color: var(--text); display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-cogs"></i> Terminações
                    </h3>
                    
                    ${terminationsHTML ? 
                        `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                            ${terminationsHTML}
                        </div>` : 
                        `<div style="text-align: center; padding: 40px; background: var(--bg); border-radius: 12px; color: var(--text-light);">
                            <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <p>Nenhuma terminação cadastrada para este prefixo</p>
                        </div>`
                    }
                </div>
                
                <!-- Botões de ação -->
                <div style="display: flex; gap: 15px; margin-top: 30px; justify-content: flex-end;">
                    <button onclick="editDetailedPrefix('${prefixKey}'); this.closest('.modal-overlay').remove()" 
                            class="btn" style="background: var(--primary); color: white; padding: 12px 25px;">
                        <i class="fas fa-edit"></i> Editar Prefixo
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            class="btn" style="padding: 12px 25px;">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Função para visualizar imagem em tela cheia
function viewPrefixImageFull(url) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        cursor: pointer;
    `;
    modal.onclick = function() { this.remove(); };
    
    modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${url}" style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 8px;" onclick="event.stopPropagation()">
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="position: absolute; top: -40px; right: 0; background: var(--bg); border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text); border: 1px solid var(--border);">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ================= CONFIGURAR EVENT LISTENERS =================
function setupPrefixEventListeners() {
    const searchInput = document.getElementById('prefixSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchPrefixes, 300);
        });
    }
    
    console.log("✅ Event listeners do prefix manager configurados");
}


// ================= EXPORTAÇÃO =================
window.initPrefixManager = initPrefixManager;
window.saveDetailedPrefix = saveDetailedPrefix;
window.editDetailedPrefix = editDetailedPrefix;
window.viewDetailedPrefix = viewDetailedPrefix;
window.deleteDetailedPrefix = deleteDetailedPrefix;
window.clearPrefixForm = clearPrefixForm;
window.openSelectOptionsManager = openSelectOptionsManager;
window.switchSelectTab = switchSelectTab;
window.addSelectOption = addSelectOption;
window.removeSelectOption = removeSelectOption;
window.searchPrefixes = searchPrefixes;
window.exportPrefixData = exportPrefixData;
window.updateSelectOptions = updateSelectOptions;
window.previewPrefixImage = previewPrefixImage;
window.uploadPrefixImage = uploadPrefixImage;
window.clearPrefixImage = clearPrefixImage;
window.deletePrefixImage = deletePrefixImage;
window.viewPrefixImage = viewPrefixImage;
window.viewPrefixDetails = viewPrefixDetails;
window.viewPrefixImageFull = viewPrefixImageFull;

console.log("✅ Prefix Manager carregado");