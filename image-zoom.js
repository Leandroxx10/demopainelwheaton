// ================= ZOOM DE IMAGENS =================
// Sistema independente para ampliar fotos dos cards das máquinas

// Configurações
let imageZoomEnabled = true;
let currentZoomedImage = null;
let zoomLevel = 1;
const ZOOM_STEP = 0.3;
let rotation = 0;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;
let zoomObserver = null;

// ================= INICIALIZAÇÃO =================
function initImageZoom() {
    console.log("🔍 Inicializando sistema de zoom de imagens...");
    
    // Criar estrutura HTML para o zoom
    createZoomStructure();
    
    // Configurar event listeners
    setupZoomEventListeners();
    
    // Observar mudanças no DOM para adicionar event listeners dinamicamente
    setupImageObservers();
    
    console.log("✅ Sistema de zoom inicializado");
}

// ================= CRIAR ESTRUTURA HTML =================
function createZoomStructure() {
    // Verificar se já existe
    if (document.getElementById('imageZoomOverlay')) return;
    
    const zoomHTML = `
        <div id="imageZoomOverlay" class="image-zoom-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        ">
            <!-- Controles FIXOS no topo -->
            <div class="zoom-controls-top" style="
                position: fixed;
                top: 20px;
                left: 0;
                right: 0;
                display: flex;
                justify-content: center;
                gap: 15px;
                padding: 15px;
                z-index: 10001;
                pointer-events: none;
            ">
                <button class="zoom-btn zoom-out" title="Reduzir zoom" style="
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                ">
                    <i class="fas fa-search-minus"></i>
                </button>
                
                <button class="zoom-btn zoom-reset" title="Resetar zoom" style="
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                ">
                    <i class="fas fa-search"></i>
                </button>
                
                <button class="zoom-btn zoom-in" title="Aumentar zoom" style="
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                ">
                    <i class="fas fa-search-plus"></i>
                </button>
                
                <button class="zoom-btn rotate" title="Rotacionar" style="
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                ">
                    <i class="fas fa-redo"></i>
                </button>
                
                <button class="zoom-btn download" title="Download" style="
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                ">
                    <i class="fas fa-download"></i>
                </button>
            </div>
            
            <!-- Container da imagem -->
            <div class="zoom-image-container" style="
                position: relative;
                max-width: 90%;
                max-height: 80%;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: grab;
            ">
                <img id="zoomedImage" src="" alt="Imagem ampliada" style="
                    display: block;
                    max-width: 100%;
                    max-height: 80vh;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                    user-select: none;
                    transform-origin: center center;
                    transition: transform 0.1s ease;
                ">
            </div>
            
            <!-- Controles FIXOS na parte inferior -->
            <div class="zoom-controls-bottom" style="
                position: fixed;
                bottom: 20px;
                left: 0;
                right: 0;
                display: flex;
                justify-content: center;
                gap: 15px;
                padding: 15px;
                z-index: 10001;
                pointer-events: none;
            ">
                <!-- Indicador de zoom -->
                <div class="zoom-level-indicator" style="
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 25px;
                    font-size: 16px;
                    font-weight: 600;
                    backdrop-filter: blur(10px);
                    pointer-events: auto;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    min-width: 100px;
                    text-align: center;
                ">
                    <i class="fas fa-search" style="margin-right: 8px;"></i>
                    <span id="zoomLevelText">100%</span>
                </div>
                
                <!-- Botão fechar -->
                <button class="zoom-close" title="Fechar (ESC)" style="
                    background: rgba(220, 38, 38, 0.8);
                    border: none;
                    color: white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <!-- Instruções para mobile -->
            <div class="zoom-instructions" style="
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px 20px;
                border-radius: 10px;
                font-size: 12px;
                backdrop-filter: blur(10px);
                text-align: center;
                max-width: 90%;
                opacity: 0.8;
                display: none;
            ">
                <i class="fas fa-hand-pointer" style="margin-right: 5px;"></i>
                Toque com dois dedos para ampliar/reduzir • Arraste para mover
            </div>
        </div>
    `;
    
    // Adicionar ao body
    document.body.insertAdjacentHTML('beforeend', zoomHTML);
    
    // Adicionar estilos
    const style = document.createElement('style');
    style.textContent = `
        .zoom-btn:hover, .zoom-close:hover {
            background: rgba(255, 255, 255, 0.3) !important;
            transform: scale(1.1);
        }
        
        .zoom-btn:active, .zoom-close:active {
            transform: scale(0.95);
        }
        
        .image-zoom-overlay.active {
            opacity: 1 !important;
        }
        
        /* Responsivo */
        @media (max-width: 768px) {
            .zoom-controls-top, .zoom-controls-bottom {
                gap: 10px !important;
                padding: 10px !important;
            }
            
            .zoom-btn, .zoom-close {
                width: 44px !important;
                height: 44px !important;
                font-size: 18px !important;
            }
            
            .zoom-level-indicator {
                font-size: 14px !important;
                padding: 8px 16px !important;
            }
            
            .zoom-instructions {
                display: block !important;
                bottom: 90px !important;
            }
        }
        
        @media (max-width: 480px) {
            .zoom-controls-top {
                top: 10px !important;
                flex-wrap: wrap;
                justify-content: center !important;
            }
            
            .zoom-controls-bottom {
                bottom: 10px !important;
                flex-direction: column;
                align-items: center;
                gap: 8px !important;
            }
            
            .zoom-btn, .zoom-close {
                width: 40px !important;
                height: 40px !important;
                font-size: 16px !important;
            }
            
            .zoom-level-indicator {
                font-size: 13px !important;
                padding: 6px 12px !important;
                width: 90%;
                max-width: 300px;
                text-align: center;
            }
            
            .zoom-instructions {
                font-size: 11px !important;
                bottom: 120px !important;
            }
        }
        
        /* Para telas muito pequenas */
        @media (max-height: 600px) {
            .zoom-controls-top {
                top: 5px !important;
            }
            
            .zoom-controls-bottom {
                bottom: 5px !important;
            }
            
            .zoom-instructions {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// ================= CONFIGURAR EVENT LISTENERS =================
function setupZoomEventListeners() {
    const overlay = document.getElementById('imageZoomOverlay');
    const zoomedImage = document.getElementById('zoomedImage');
    const zoomClose = document.querySelector('.zoom-close');
    const zoomInBtn = document.querySelector('.zoom-btn.zoom-in');
    const zoomOutBtn = document.querySelector('.zoom-btn.zoom-out');
    const zoomResetBtn = document.querySelector('.zoom-btn.zoom-reset');
    const rotateBtn = document.querySelector('.zoom-btn.rotate');
    const downloadBtn = document.querySelector('.zoom-btn.download');
    
    // Fechar ao clicar no overlay ou botão fechar
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === this || e.target.closest('.zoom-close')) {
                closeImageZoom();
            }
        });
    }
    
    // Controles de zoom
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            zoomImage('in');
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            zoomImage('out');
        });
    }
    
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            resetImageZoom();
        });
    }
    
    if (rotateBtn) {
        rotateBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            rotateImage();
        });
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            downloadZoomedImage();
        });
    }
    
    // Zoom com roda do mouse (CORRIGIDO: usando passive: false)
    if (zoomedImage) {
        // Adicionar listener não-passivo para wheel
        zoomedImage.addEventListener('wheel', handleWheelZoom, { passive: false });
    }
    
    // Fechar com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') {
            closeImageZoom();
        }
    });
    
    // Sistema de arraste da imagem (CORRIGIDO: usando passive: false para touch)
    if (zoomedImage) {
        // Mouse events
        zoomedImage.addEventListener('mousedown', startDrag, { passive: true });
        
        // Touch events - usando passive: false onde necessário
        zoomedImage.addEventListener('touchstart', handleTouchStart, { passive: false });
    }
}

// ================= MANIPULAÇÃO DE EVENTOS (CORRIGIDOS) =================
function handleWheelZoom(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.deltaY < 0) {
        zoomImage('in');
    } else {
        zoomImage('out');
    }
}

function handleTouchStart(e) {
    if (e.touches.length === 2) {
        e.preventDefault(); // Agora permitido porque usamos { passive: false }
        startPinchZoom(e);
    } else if (e.touches.length === 1 && zoomLevel > 1) {
        startDrag(e.touches[0]);
    }
}

function startPinchZoom(e) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const initialDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
    );
    
    let lastDistance = initialDistance;
    let lastTimestamp = Date.now();
    
    function handlePinchMove(e) {
        if (e.touches.length !== 2) return;
        
        e.preventDefault();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
        );
        
        const now = Date.now();
        const timeDiff = now - lastTimestamp;
        
        // Só atualizar a cada 50ms para melhor performance
        if (timeDiff > 50) {
            const scaleChange = currentDistance / lastDistance;
            
            if (scaleChange > 1.05) {
                zoomImage('in');
            } else if (scaleChange < 0.95) {
                zoomImage('out');
            }
            
            lastDistance = currentDistance;
            lastTimestamp = now;
        }
    }
    
    function handlePinchEnd() {
        document.removeEventListener('touchmove', handlePinchMove);
        document.removeEventListener('touchend', handlePinchEnd);
        document.removeEventListener('touchcancel', handlePinchEnd);
    }
    
    document.addEventListener('touchmove', handlePinchMove, { passive: false });
    document.addEventListener('touchend', handlePinchEnd);
    document.addEventListener('touchcancel', handlePinchEnd);
}

// ================= FUNÇÕES DE ARRASTE =================
function startDrag(e) {
    if (zoomLevel > 1) {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        
        const zoomedImage = document.getElementById('zoomedImage');
        if (zoomedImage) {
            zoomedImage.style.cursor = 'grabbing';
        }
        
        // Adicionar listeners para movimento (com passive: true para melhor performance)
        document.addEventListener('mousemove', dragImage, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('mouseup', stopDrag, { passive: true });
        document.addEventListener('touchend', stopDrag, { passive: true });
    }
}

function dragImage(e) {
    if (!isDragging || zoomLevel <= 1) return;
    
    // Para mouse events
    if (e.type === 'mousemove') {
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateImageTransform();
    }
}

function handleTouchMove(e) {
    if (!isDragging || zoomLevel <= 1 || e.touches.length !== 1) return;
    
    e.preventDefault(); // Permitido porque usamos { passive: false }
    
    // Para touch events
    const touch = e.touches[0];
    translateX = touch.clientX - startX;
    translateY = touch.clientY - startY;
    updateImageTransform();
}

function stopDrag() {
    isDragging = false;
    
    const zoomedImage = document.getElementById('zoomedImage');
    if (zoomedImage && zoomLevel > 1) {
        zoomedImage.style.cursor = 'grab';
    }
    
    // Remover listeners
    document.removeEventListener('mousemove', dragImage);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
}

function updateImageTransform() {
    const zoomedImage = document.getElementById('zoomedImage');
    if (zoomedImage) {
        zoomedImage.style.transform = `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg) scale(${zoomLevel})`;
    }
}

// ================= OBSERVAR MUDANÇAS NO DOM (CORRIGIDO) =================
function setupImageObservers() {
    // Primeiro, remover observer anterior se existir
    if (zoomObserver) {
        zoomObserver.disconnect();
    }
    
    // Função segura para adicionar listeners
    function addImageListenersSafely() {
        try {
            // Selecionar imagens de forma mais específica para evitar conflitos
            const selectors = [
                '.machine-card:not(.maintenance) img',
                '.machine-edit-card img',
                '#modalBody .machine-info img'
            ];
            
            selectors.forEach(selector => {
                const images = document.querySelectorAll(selector);
                images.forEach(img => {
                    // Verificar se é uma imagem válida (não placeholder)
                    if (img.src && !img.src.includes('placeholder') && 
                        !img.hasAttribute('data-zoom-listener') &&
                        !img.closest('.no-zoom')) {
                        
                        // Clonar a função para evitar problemas de closure
                        const clickHandler = function(e) {
                            e.stopPropagation();
                            e.preventDefault();
                            
                            // Pequeno delay para evitar cliques acidentais durante redraws
                            if (Date.now() - (img.lastClickTime || 0) < 300) return;
                            img.lastClickTime = Date.now();
                            
                            openImageZoom(this.src, this.alt || 'Imagem');
                        };
                        
                        img.addEventListener('click', clickHandler);
                        img.style.cursor = 'pointer';
                        img.setAttribute('data-zoom-listener', 'true');
                        
                        // Armazenar referência para remover depois
                        img._zoomClickHandler = clickHandler;
                    }
                });
            });
        } catch (error) {
            console.warn("⚠️ Erro ao adicionar listeners de zoom:", error);
        }
    }
    
    // Executar inicialmente com delay para evitar conflitos
    setTimeout(addImageListenersSafely, 500);
    
    // Configurar observer com opções mais específicas
    zoomObserver = new MutationObserver(function(mutations) {
        let hasRelevantChanges = false;
        
        mutations.forEach(function(mutation) {
            // Só processar se houver nodes adicionados e eles estiverem em containers relevantes
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Verificar se as mudanças são em containers de máquinas
                const target = mutation.target;
                if (target.classList && 
                    (target.classList.contains('machine-card') || 
                     target.classList.contains('machine-edit-card') ||
                     target.id === 'modalBody' ||
                     target.closest('.machine-card') ||
                     target.closest('.machine-edit-card'))) {
                    hasRelevantChanges = true;
                }
            }
        });
        
        if (hasRelevantChanges) {
            // Usar debounce para evitar múltiplas execuções
            clearTimeout(window.zoomDebounceTimer);
            window.zoomDebounceTimer = setTimeout(addImageListenersSafely, 300);
        }
    });
    
    // Observar apenas containers específicos
    const observeContainers = [
        document.getElementById('cardsContainer'),
        document.getElementById('fornoSections'),
        document.getElementById('machinesGrid'),
        document.getElementById('modalBody')
    ].filter(Boolean);
    
    observeContainers.forEach(container => {
        if (container) {
            zoomObserver.observe(container, {
                childList: true,
                subtree: true
            });
        }
    });
    
    // Também observar o body para containers dinâmicos
    zoomObserver.observe(document.body, {
        childList: true,
        subtree: false
    });
}

// ================= FUNÇÕES PRINCIPAIS =================
function openImageZoom(imageSrc, altText = 'Imagem') {
    if (!imageZoomEnabled) return;
    
    const overlay = document.getElementById('imageZoomOverlay');
    const zoomedImage = document.getElementById('zoomedImage');
    
    if (!overlay || !zoomedImage) {
        console.error("❌ Elementos do zoom não encontrados");
        return;
    }
    
    // Validar URL da imagem
    if (!imageSrc || imageSrc.includes('placeholder')) {
        console.warn("⚠️ Imagem inválida para zoom:", imageSrc);
        return;
    }
    
    // Resetar estado
    zoomLevel = 1;
    rotation = 0;
    translateX = 0;
    translateY = 0;
    currentZoomedImage = imageSrc;
    
    // Configurar imagem
    zoomedImage.src = imageSrc;
    zoomedImage.alt = altText;
    
    // Resetar transformações
    zoomedImage.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
    zoomedImage.style.cursor = 'grab';
    
    // Atualizar indicador de zoom
    updateZoomIndicator();
    
    // Mostrar overlay
    overlay.style.display = 'flex';
    
    // Animar entrada
    setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.classList.add('active');
    }, 10);
    
    // Bloquear scroll da página
    document.body.style.overflow = 'hidden';
    
    console.log("🔍 Zoom aberto para:", imageSrc);
}

function closeImageZoom() {
    const overlay = document.getElementById('imageZoomOverlay');
    
    if (!overlay) return;
    
    // Animar saída
    overlay.style.opacity = '0';
    overlay.classList.remove('active');
    
    setTimeout(() => {
        overlay.style.display = 'none';
        currentZoomedImage = null;
        zoomLevel = 1;
        rotation = 0;
        translateX = 0;
        translateY = 0;
        
        // Restaurar scroll da página
        document.body.style.overflow = '';
    }, 300);
    
    console.log("🔍 Zoom fechado");
}

function zoomImage(direction) {
    if (!currentZoomedImage) return;
    
    const zoomedImage = document.getElementById('zoomedImage');
    if (!zoomedImage) return;
    
    if (direction === 'in') {
        zoomLevel += ZOOM_STEP;
    } else if (direction === 'out') {
        // Permitir zoom até 0.1 (10%)
        zoomLevel = Math.max(0.1, zoomLevel - ZOOM_STEP);
    }
    
    updateImageTransform();
    
    // Atualizar cursor
    zoomedImage.style.cursor = zoomLevel > 1 ? 'grab' : 'default';
    
    // Atualizar indicador
    updateZoomIndicator();
}

function resetImageZoom() {
    if (!currentZoomedImage) return;
    
    const zoomedImage = document.getElementById('zoomedImage');
    if (!zoomedImage) return;
    
    zoomLevel = 1;
    rotation = 0;
    translateX = 0;
    translateY = 0;
    
    zoomedImage.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
    zoomedImage.style.cursor = 'grab';
    
    updateZoomIndicator();
}

function rotateImage() {
    const zoomedImage = document.getElementById('zoomedImage');
    if (!zoomedImage) return;
    
    rotation += 90;
    if (rotation >= 360) rotation = 0;
    
    updateImageTransform();
}

function downloadZoomedImage() {
    if (!currentZoomedImage) return;
    
    const zoomedImage = document.getElementById('zoomedImage');
    if (!zoomedImage) return;
    
    try {
        const link = document.createElement('a');
        link.href = zoomedImage.src;
        link.download = `imagem_${Date.now()}.jpg`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("❌ Erro ao fazer download:", error);
        window.open(zoomedImage.src, '_blank');
    }
}

function updateZoomIndicator() {
    const zoomLevelText = document.getElementById('zoomLevelText');
    if (zoomLevelText) {
        zoomLevelText.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
}

// ================= LIMPEZA E DESTRUIÇÃO =================
function cleanupImageZoom() {
    // Remover todos os event listeners
    const images = document.querySelectorAll('img[data-zoom-listener="true"]');
    images.forEach(img => {
        if (img._zoomClickHandler) {
            img.removeEventListener('click', img._zoomClickHandler);
            delete img._zoomClickHandler;
        }
        img.removeAttribute('data-zoom-listener');
    });
    
    // Remover overlay se existir
    const overlay = document.getElementById('imageZoomOverlay');
    if (overlay) {
        overlay.remove();
    }
    
    // Parar observer
    if (zoomObserver) {
        zoomObserver.disconnect();
        zoomObserver = null;
    }
    
    console.log("🧹 Sistema de zoom limpo");
}

// ================= INTEGRAÇÃO SEGURA =================
function setupImageZoomForCard(cardElement) {
    if (!cardElement || !imageZoomEnabled) return;
    
    // Pequeno delay para evitar conflitos
    setTimeout(() => {
        try {
            const images = cardElement.querySelectorAll('img');
            images.forEach(img => {
                if (!img.hasAttribute('data-zoom-listener') && 
                    img.src && !img.src.includes('placeholder')) {
                    
                    const clickHandler = function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        if (Date.now() - (img.lastClickTime || 0) < 300) return;
                        img.lastClickTime = Date.now();
                        
                        openImageZoom(this.src, 'Imagem');
                    };
                    
                    img.addEventListener('click', clickHandler);
                    img.style.cursor = 'pointer';
                    img.setAttribute('data-zoom-listener', 'true');
                    img._zoomClickHandler = clickHandler;
                }
            });
        } catch (error) {
            console.warn("⚠️ Erro ao configurar zoom para card:", error);
        }
    }, 100);
}

// ================= INICIALIZAÇÃO SEGURA =================
document.addEventListener('DOMContentLoaded', function() {
    // Esperar um pouco mais para garantir que tudo está carregado
    setTimeout(() => {
        try {
            initImageZoom();
        } catch (error) {
            console.error("❌ Erro ao inicializar zoom:", error);
        }
    }, 1500);
    
    // Limpar na navegação
    window.addEventListener('beforeunload', function() {
        cleanupImageZoom();
    });
});

// ================= EXPORTAR FUNÇÕES =================
window.initImageZoom = initImageZoom;
window.openImageZoom = openImageZoom;
window.closeImageZoom = closeImageZoom;
window.cleanupImageZoom = cleanupImageZoom;
window.setupImageZoomForCard = setupImageZoomForCard;