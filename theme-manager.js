
// ================= SISTEMA DE TEMAS =================
// CORREÇÃO COMPLETA: Todos os elementos agora ficam escuros

(function() {
    "use strict";
    
    console.log("🎨 Inicializando Theme Manager...");
    
    const THEME_STORAGE_KEY = 'wmoldes_admin_theme';
    const TRANSITION_DURATION = 300;
    
    // ===== CORES DO TEMA DARK =====
    const DARK_THEME = {
        bg: '#0f172a',
        cardBg: '#1e293b',
        surface: '#334155',
        text: '#f1f5f9',
        textLight: '#94a3b8',
        border: '#334155',
        
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#06b6d4',
        
        primaryHover: '#2563eb',
        secondaryHover: '#7c3aed',
        successHover: '#059669',
        warningHover: '#d97706',
        dangerHover: '#dc2626',
        
        // Cores específicas para inputs
        input: {
            bg: '#1e293b',
            border: '#334155',
            text: '#f1f5f9',
            placeholder: '#64748b',
            focus: '#3b82f6'
        },
        
        // Cores para selects
        select: {
            bg: '#1e293b',
            border: '#334155',
            text: '#f1f5f9',
            optionBg: '#1e293b',
            optionHover: '#334155'
        },
        
        chart: {
            bg: '#1e293b',
            text: '#e2e8f0',
            grid: '#334155',
            tooltip: '#0f172a'
        },
        
        gradient: {
            primary: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            secondary: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            dark: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
        },
        
        shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        shadowHover: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
        
        scrollbar: {
            track: '#1e293b',
            thumb: '#475569',
            thumbHover: '#64748b'
        }
    };
    
    // ===== CORES DO TEMA CLARO =====
    const LIGHT_THEME = {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        surface: '#f1f5f9',
        text: '#0f172a',
        textLight: '#475569',
        border: '#e2e8f0',
        
        primary: '#2563eb',
        secondary: '#7c3aed',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#0891b2',
        
        primaryHover: '#1d4ed8',
        secondaryHover: '#6d28d9',
        successHover: '#047857',
        warningHover: '#b45309',
        dangerHover: '#b91c1c',
        
        input: {
            bg: '#ffffff',
            border: '#d1d5db',
            text: '#111827',
            placeholder: '#9ca3af',
            focus: '#2563eb'
        },
        
        select: {
            bg: '#ffffff',
            border: '#d1d5db',
            text: '#111827',
            optionBg: '#ffffff',
            optionHover: '#f3f4f6'
        },
        
        chart: {
            bg: '#ffffff',
            text: '#334155',
            grid: '#e2e8f0',
            tooltip: '#1e293b'
        },
        
        gradient: {
            primary: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            secondary: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            dark: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
        },
        
        shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        shadowHover: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        
        scrollbar: {
            track: '#f1f5f9',
            thumb: '#cbd5e1',
            thumbHover: '#94a3b8'
        }
    };
    
    let isDarkMode = false;
    let transitionTimer = null;
    
    // ===== INICIALIZAR =====
    function initThemeManager() {
        console.log("🎨 Inicializando Theme Manager...");
        
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        
        if (savedTheme === 'dark') {
            enableDarkMode(false);
        } else {
            enableLightMode(false);
        }
        
        addThemeButton();
        observeDOMChanges();
        fixSelects();
        
        console.log("✅ Theme Manager inicializado");
    }
    
    // ===== CORRIGIR SELECTS =====
    function fixSelects() {
        // Forçar todos os selects a usarem cores corretas
        const style = document.createElement('style');
        style.id = 'select-fix';
        style.textContent = `
            /* ===== ESTILOS GLOBAIS PARA SELECTS ===== */
            select, .styled-select, .control-group select, #historyMachineSelect, #historyDate {
                background-color: ${isDarkMode ? '#1e293b !important' : '#ffffff !important'};
                border-color: ${isDarkMode ? '#334155 !important' : '#d1d5db !important'};
                color: ${isDarkMode ? '#f1f5f9 !important' : '#111827 !important'};
            }
            
            select option, .styled-select option {
                background-color: ${isDarkMode ? '#1e293b !important' : '#ffffff !important'};
                color: ${isDarkMode ? '#f1f5f9 !important' : '#111827 !important'};
            }
            
            select:focus, .styled-select:focus {
                border-color: ${isDarkMode ? '#3b82f6 !important' : '#2563eb !important'};
                box-shadow: 0 0 0 3px ${isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : 'rgba(37, 99, 235, 0.1) !important'};
            }
            
            /* Firefox */
            select option:hover,
            select option:checked,
            select option:focus {
                background: ${isDarkMode ? '#334155 !important' : '#f3f4f6 !important'};
            }
            
            /* Para quando o select está aberto */
            select:active, select:focus-within {
                background-color: ${isDarkMode ? '#1e293b !important' : '#ffffff !important'};
            }
        `;
        
        // Remover estilo anterior se existir
        const oldStyle = document.getElementById('select-fix');
        if (oldStyle) oldStyle.remove();
        
        document.head.appendChild(style);
    }
    
    // ===== ADICIONAR BOTÃO DE TEMA =====
    function addThemeButton() {
        const header = document.querySelector('.admin-header');
        if (!header) {
            setTimeout(addThemeButton, 1000);
            return;
        }
        
        if (document.getElementById('themeToggleBtn')) return;
        
        const themeBtn = document.createElement('button');
        themeBtn.id = 'themeToggleBtn';
        themeBtn.className = 'theme-toggle-btn';
        themeBtn.innerHTML = `
            <i class="fas fa-sun"></i>
            <i class="fas fa-moon"></i>
            <span class="theme-toggle-track"></span>
        `;
        
        const adminNav = header.querySelector('.admin-nav');
        if (adminNav) {
            adminNav.insertBefore(themeBtn, adminNav.firstChild);
        }
        
        themeBtn.addEventListener('click', toggleTheme);
        updateThemeButtonIcon();
    }
    
    // ===== ATUALIZAR ÍCONE =====
    function updateThemeButtonIcon() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        
        if (isDarkMode) {
            btn.classList.add('dark');
            btn.querySelector('.fa-sun').style.opacity = '0.5';
            btn.querySelector('.fa-moon').style.opacity = '1';
        } else {
            btn.classList.remove('dark');
            btn.querySelector('.fa-sun').style.opacity = '1';
            btn.querySelector('.fa-moon').style.opacity = '0.5';
        }
    }
    
    // ===== ALTERNAR TEMA =====
    function toggleTheme() {
        applyTransition();
        
        if (isDarkMode) {
            enableLightMode(true);
        } else {
            enableDarkMode(true);
        }
    }
    
    // ===== APLICAR TRANSIÇÃO =====
    function applyTransition() {
        document.body.classList.add('theme-transition');
        
        const transitionElements = document.querySelectorAll(
            '*, *::before, *::after, ' +
            '.admin-container, .admin-sidebar, .admin-header, .admin-content, ' +
            '.machine-card, .limit-card, .btn, input, select, textarea, ' +
            '.table-container, .chart-container, .insights-container, ' +
            '.history-controls, .toggle-dataset, .modal-content, ' +
            '.history-table, .history-table th, .history-table td, ' +
            '.period-btn, .chart-type-toggle, .btn-generate, ' +
            '.control-group select, .control-group input, ' +
            '.chart-scroll, .chart-inner, canvas, ' +
            '.scroll-hint, .history-header, .history-header *, ' +
            'option, .styled-select, #historyMachineSelect, #historyDate, ' +
            '#customStartTime, #customEndTime, .date-select'
        );
        
        transitionElements.forEach(el => {
            if (el) {
                el.style.transition = `all ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            }
        });
        
        if (transitionTimer) clearTimeout(transitionTimer);
        
        transitionTimer = setTimeout(() => {
            document.body.classList.remove('theme-transition');
            
            transitionElements.forEach(el => {
                if (el) {
                    el.style.transition = '';
                }
            });
        }, TRANSITION_DURATION + 50);
    }
    
    // ===== ATIVAR MODO ESCURO =====
    function enableDarkMode(animate = true) {
        console.log("🌙 Ativando modo escuro...");
        
        isDarkMode = true;
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        
        applyThemeVariables(DARK_THEME);
        document.body.classList.add('dark-mode');
        
        applyAllStyles(true);
        fixSelects();
        updateThemeButtonIcon();
        updateChartTheme();
        
        document.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: 'dark' } 
        }));
        
        console.log("✅ Modo escuro ativado");
    }
    
    // ===== ATIVAR MODO CLARO =====
    function enableLightMode(animate = true) {
        console.log("☀️ Ativando modo claro...");
        
        isDarkMode = false;
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        
        applyThemeVariables(LIGHT_THEME);
        document.body.classList.remove('dark-mode');
        
        applyAllStyles(false);
        fixSelects();
        updateThemeButtonIcon();
        updateChartTheme();
        
        document.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: 'light' } 
        }));
        
        console.log("✅ Modo claro ativado");
    }
    
    // ===== APLICAR TODOS OS ESTILOS =====
    function applyAllStyles(isDark) {
        // Selects
        document.querySelectorAll('select, .styled-select, #historyMachineSelect, #historyDate, .date-select').forEach(el => {
            if (el) {
                el.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
                el.style.borderColor = isDark ? '#334155' : '#d1d5db';
                el.style.color = isDark ? '#f1f5f9' : '#111827';
            }
        });
        
        // Inputs
        document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea').forEach(el => {
            if (el) {
                el.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
                el.style.borderColor = isDark ? '#334155' : '#d1d5db';
                el.style.color = isDark ? '#f1f5f9' : '#111827';
            }
        });
        
        // Container do gráfico
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
            chartContainer.style.borderColor = isDark ? '#334155' : '#e2e8f0';
        }
        
        // Canvas
        const canvas = document.getElementById('historyChart');
        if (canvas) {
            canvas.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
        }
        
        // Insights
        const insights = document.getElementById('chartInsights');
        if (insights) {
            insights.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
            insights.style.borderColor = isDark ? '#334155' : '#e2e8f0';
        }
        
        // Cards de insight
        document.querySelectorAll('.insight-card').forEach(card => {
            card.style.backgroundColor = isDark ? '#334155' : '#f9fafb';
        });
        
        // Tabela
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
            tableContainer.style.borderColor = isDark ? '#334155' : '#e2e8f0';
        }
        
        // Cabeçalho da tabela
        document.querySelectorAll('.history-table th').forEach(th => {
            th.style.backgroundColor = isDark ? '#334155' : '#f9fafb';
            th.style.color = isDark ? '#e2e8f0' : '#475569';
            th.style.borderBottomColor = isDark ? '#334155' : '#e2e8f0';
        });
        
        // Linhas da tabela
        document.querySelectorAll('.history-table td').forEach(td => {
            td.style.borderBottomColor = isDark ? '#334155' : '#f3f4f6';
            td.style.color = isDark ? '#e2e8f0' : '#111827';
        });
        
        // Controles
        const controls = document.querySelector('.history-controls');
        if (controls) {
            controls.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
            controls.style.borderColor = isDark ? '#334155' : '#e2e8f0';
        }
        
        // Botões de período
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.style.backgroundColor = isDark ? '#334155' : '#f9fafb';
            btn.style.color = isDark ? '#94a3b8' : '#475569';
            btn.style.borderColor = isDark ? '#334155' : '#e2e8f0';
            
            if (btn.classList.contains('active')) {
                btn.style.backgroundColor = isDark ? '#3b82f6' : '#2563eb';
                btn.style.color = '#ffffff';
            }
        });
        
        // Botão de alternância
        const toggleBtn = document.getElementById('toggleChartBtn');
        if (toggleBtn) {
            toggleBtn.style.backgroundColor = isDark ? '#334155' : '#f9fafb';
            toggleBtn.style.borderColor = isDark ? '#334155' : '#e2e8f0';
            toggleBtn.style.color = isDark ? '#e2e8f0' : '#374151';
        }
        
        // Botão gerar
        const generateBtn = document.querySelector('.btn-generate');
        if (generateBtn) {
            generateBtn.style.backgroundColor = isDark ? '#3b82f6' : '#111827';
            generateBtn.style.color = '#ffffff';
        }
        
        // Inputs de horário personalizado
        document.querySelectorAll('#customStartTime, #customEndTime').forEach(el => {
            if (el) {
                el.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
                el.style.borderColor = isDark ? '#334155' : '#d1d5db';
                el.style.color = isDark ? '#f1f5f9' : '#111827';
            }
        });
        
        // Container de horário personalizado
        const customContainer = document.getElementById('customTimeContainer');
        if (customContainer) {
            customContainer.style.backgroundColor = isDark ? '#334155' : '#f9fafb';
            customContainer.style.borderColor = isDark ? '#334155' : '#e5e7eb';
        }
        
        // Scroll hint
        const scrollHint = document.querySelector('.scroll-hint');
        if (scrollHint) {
            scrollHint.style.color = isDark ? '#64748b' : '#9ca3af';
        }
        
        // Títulos
        const historyTitle = document.querySelector('.history-header h2');
        if (historyTitle) {
            historyTitle.style.color = isDark ? '#f1f5f9' : '#111827';
        }
        
        const historySubtitle = document.querySelector('.history-header p');
        if (historySubtitle) {
            historySubtitle.style.color = isDark ? '#94a3b8' : '#6b7280';
        }
        
        // Labels
        document.querySelectorAll('.control-group label').forEach(label => {
            label.style.color = isDark ? '#94a3b8' : '#4b5563';
        });
        
        // Toggle datasets
        document.querySelectorAll('.toggle-dataset').forEach(btn => {
            btn.style.backgroundColor = isDark ? '#334155' : '#f9fafb';
            btn.style.borderColor = isDark ? '#334155' : '#e5e7eb';
            btn.style.color = isDark ? '#e2e8f0' : '#374151';
        });
    }
    
    // ===== APLICAR VARIÁVEIS CSS =====
    function applyThemeVariables(theme) {
        const root = document.documentElement;
        
        root.style.setProperty('--bg', theme.bg);
        root.style.setProperty('--card-bg', theme.cardBg);
        root.style.setProperty('--surface', theme.surface);
        root.style.setProperty('--text', theme.text);
        root.style.setProperty('--text-light', theme.textLight);
        root.style.setProperty('--border', theme.border);
        
        root.style.setProperty('--primary', theme.primary);
        root.style.setProperty('--secondary', theme.secondary);
        root.style.setProperty('--success', theme.success);
        root.style.setProperty('--warning', theme.warning);
        root.style.setProperty('--danger', theme.danger);
        root.style.setProperty('--info', theme.info);
        
        root.style.setProperty('--primary-hover', theme.primaryHover);
        root.style.setProperty('--secondary-hover', theme.secondaryHover);
        root.style.setProperty('--success-hover', theme.successHover);
        root.style.setProperty('--warning-hover', theme.warningHover);
        root.style.setProperty('--danger-hover', theme.dangerHover);
        
        root.style.setProperty('--gradient-primary', theme.gradient.primary);
        root.style.setProperty('--gradient-secondary', theme.gradient.secondary);
        root.style.setProperty('--gradient-dark', theme.gradient.dark);
        
        root.style.setProperty('--shadow', theme.shadow);
        root.style.setProperty('--shadow-hover', theme.shadowHover);
        
        root.style.setProperty('--input-bg', theme.input.bg);
        root.style.setProperty('--input-border', theme.input.border);
        root.style.setProperty('--input-text', theme.input.text);
        root.style.setProperty('--input-placeholder', theme.input.placeholder);
        root.style.setProperty('--input-focus', theme.input.focus);
        
        root.style.setProperty('--select-bg', theme.select.bg);
        root.style.setProperty('--select-border', theme.select.border);
        root.style.setProperty('--select-text', theme.select.text);
        root.style.setProperty('--select-option-bg', theme.select.optionBg);
        root.style.setProperty('--select-option-hover', theme.select.optionHover);
        
        root.style.setProperty('--chart-bg', theme.chart.bg);
        root.style.setProperty('--chart-text', theme.chart.text);
        root.style.setProperty('--chart-grid', theme.chart.grid);
        root.style.setProperty('--chart-tooltip', theme.chart.tooltip);
        
        root.style.setProperty('--scrollbar-track', theme.scrollbar.track);
        root.style.setProperty('--scrollbar-thumb', theme.scrollbar.thumb);
        root.style.setProperty('--scrollbar-thumb-hover', theme.scrollbar.thumbHover);
    }
    
    // ===== ATUALIZAR GRÁFICO =====
    function updateChartTheme() {
        if (typeof window.dailyChart !== 'undefined' && window.dailyChart) {
            const chart = window.dailyChart;
            
            if (chart.options.scales && chart.options.scales.y) {
                chart.options.scales.y.grid.color = isDarkMode ? '#334155' : '#e2e8f0';
            }
            
            if (chart.options.scales && chart.options.scales.x) {
                chart.options.scales.x.ticks.color = isDarkMode ? '#94a3b8' : '#475569';
            }
            
            if (chart.options.scales && chart.options.scales.y) {
                chart.options.scales.y.ticks.color = isDarkMode ? '#94a3b8' : '#475569';
            }
            
            chart.update();
        }
    }
    
    // ===== OBSERVAR MUDANÇAS =====
    function observeDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    setTimeout(() => {
                        applyAllStyles(isDarkMode);
                        fixSelects();
                    }, 10);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // ===== EXPORTAR =====
    window.getCurrentTheme = function() {
        return isDarkMode ? 'dark' : 'light';
    };
    
    window.toggleTheme = toggleTheme;
    
    // ===== INICIALIZAR =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeManager);
    } else {
        initThemeManager();
    }
    
    // ===== ESTILOS GLOBAIS =====
    const style = document.createElement('style');
    style.textContent = `
        /* ===== BOTÃO DE TEMA ===== */
        .theme-toggle-btn {
            position: relative;
            width: 56px;
            height: 32px;
            border: none;
            border-radius: 32px;
            background: var(--surface);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 6px;
            margin: 0 12px;
            transition: all 0.3s ease;
            border: 1px solid var(--border);
            overflow: hidden;
        }
        
        .theme-toggle-btn i {
            font-size: 14px;
            z-index: 2;
            transition: all 0.3s ease;
            color: var(--text);
        }
        
        .theme-toggle-btn .fa-sun {
            color: #f59e0b;
        }
        
        .theme-toggle-btn .fa-moon {
            color: #6366f1;
        }
        
        .theme-toggle-track {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 28px;
            height: 28px;
            border-radius: 28px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            z-index: 1;
        }
        
        .dark-mode .theme-toggle-track {
            transform: translateX(24px);
            background: #1e293b;
        }
        
        .theme-toggle-btn:hover .theme-toggle-track {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        /* ===== ESTILOS GLOBAIS PARA SELECTS ===== */
        select, .styled-select, #historyMachineSelect, #historyDate, .date-select,
        .control-group select, .filters select, .admin-select {
            background-color: var(--select-bg) !important;
            border-color: var(--select-border) !important;
            color: var(--select-text) !important;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 14px;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 36px;
        }
        
        .dark-mode select, .dark-mode .styled-select,
        .dark-mode #historyMachineSelect, .dark-mode #historyDate {
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
        }
        
        select option {
            background-color: var(--select-option-bg) !important;
            color: var(--select-text) !important;
            padding: 10px;
        }
        
        select option:hover,
        select option:checked,
        select option:focus {
            background-color: var(--select-option-hover) !important;
        }
        
        select:focus, .styled-select:focus {
            border-color: var(--input-focus) !important;
            box-shadow: 0 0 0 3px ${isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.1)'} !important;
            outline: none;
        }
        
        /* ===== INPUTS ===== */
        input:not([type="checkbox"]):not([type="radio"]), textarea {
            background-color: var(--input-bg) !important;
            border-color: var(--input-border) !important;
            color: var(--input-text) !important;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 14px;
        }
        
        input::placeholder, textarea::placeholder {
            color: var(--input-placeholder) !important;
        }
        
        input:focus, textarea:focus {
            border-color: var(--input-focus) !important;
            box-shadow: 0 0 0 3px ${isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.1)'} !important;
            outline: none;
        }
        
        /* ===== CONTAINERS ===== */
        .dark-mode .chart-container {
            background: #1e293b !important;
            border-color: #334155 !important;
        }
        
        .dark-mode .insights-container {
            background: #1e293b !important;
            border-color: #334155 !important;
        }
        
        .dark-mode .insight-card {
            background: #334155 !important;
        }
        
        .dark-mode .table-container {
            background: #1e293b !important;
            border-color: #334155 !important;
        }
        
        .dark-mode .history-table th {
            background: #334155 !important;
            color: #e2e8f0 !important;
            border-bottom-color: #334155 !important;
        }
        
        .dark-mode .history-table td {
            border-bottom-color: #334155 !important;
            color: #e2e8f0 !important;
        }
        
        .dark-mode .history-controls {
            background: #1e293b !important;
            border-color: #334155 !important;
        }
        
        .dark-mode .period-btn {
            background: #334155 !important;
            color: #94a3b8 !important;
            border-color: #334155 !important;
        }
        
        .dark-mode .period-btn.active {
            background: #3b82f6 !important;
            color: white !important;
        }
        
        .dark-mode .chart-type-toggle {
            background: #334155 !important;
            border-color: #334155 !important;
            color: #e2e8f0 !important;
        }
        
        .dark-mode .btn-generate {
            background: #3b82f6 !important;
        }
        
        .dark-mode #customStartTime,
        .dark-mode #customEndTime {
            background: #1e293b !important;
            border-color: #334155 !important;
            color: #f1f5f9 !important;
        }
        
        .dark-mode #customTimeContainer {
            background: #334155 !important;
            border-color: #334155 !important;
        }
        
        .dark-mode .scroll-hint {
            color: #64748b !important;
        }
        
        .dark-mode .history-header h2 {
            color: #f1f5f9 !important;
        }
        
        .dark-mode .history-header p {
            color: #94a3b8 !important;
        }
        
        .dark-mode .control-group label {
            color: #94a3b8 !important;
        }
        
        .dark-mode .toggle-dataset {
            background: #334155 !important;
            border-color: #334155 !important;
            color: #e2e8f0 !important;
        }
        
        .dark-mode .toggle-dataset.active {
            border-color: var(--cor) !important;
        }
        
        /* ===== TRANSIÇÕES ===== */
        .theme-transition,
        .theme-transition *,
        .theme-transition *::before,
        .theme-transition *::after {
            transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        
        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 5px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 5px;
            transition: background 0.3s ease;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }
        
        /* ===== ANIMAÇÕES ===== */
        @keyframes themePulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .theme-toggle-btn:active .theme-toggle-track {
            animation: themePulse 0.3s ease;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .admin-section.active {
            animation: fadeInUp 0.4s ease-out;
        }
    `;
    
    document.head.appendChild(style);
    
    console.log("🎨 Theme Manager carregado com sucesso!");
    
})();
