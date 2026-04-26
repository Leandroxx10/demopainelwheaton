/*
 * WMoldes - Sistema definitivo de filtros do Dashboard
 * Substitui os handlers anteriores dos filtros e aplica os filtros direto nos dados carregados.
 */
(function () {
    'use strict';

    const STATUS_UI_TO_INTERNAL = {
        critico: 'critical',
        critical: 'critical',
        baixa: 'critical',
        baixo: 'warning',
        warning: 'warning',
        normal: 'normal'
    };

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function ensureFilterState() {
        if (typeof activeFilters === 'undefined' || !activeFilters) return null;
        if (!Array.isArray(activeFilters.fornos)) activeFilters.fornos = [];
        if (!Object.prototype.hasOwnProperty.call(activeFilters, 'status')) activeFilters.status = null;
        if (!Object.prototype.hasOwnProperty.call(activeFilters, 'search')) activeFilters.search = '';
        if (!Object.prototype.hasOwnProperty.call(activeFilters, 'hideMaintenance')) activeFilters.hideMaintenance = false;
        return activeFilters;
    }

    function getMachineForno(machineId) {
        const id = String(machineId || '').trim().toUpperCase();
        if (!id) return null;
        if (id.startsWith('A')) return 'A';
        if (id.startsWith('B')) return 'B';
        if (id.startsWith('C')) return 'C';
        if (id.startsWith('D')) return 'D';
        const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(num) && num >= 10 && num <= 15) return 'D';
        return null;
    }

    function machineIsInMaintenance(machineId, machineData) {
        const maintenance = (typeof machineMaintenance !== 'undefined' && machineMaintenance) ? machineMaintenance[machineId] : null;
        const values = [
            maintenance && maintenance.isInMaintenance,
            maintenance && maintenance.emManutencao,
            maintenance && maintenance.maintenance,
            maintenance && maintenance.status,
            machineData && machineData.isInMaintenance,
            machineData && machineData.emManutencao,
            machineData && machineData.maintenance,
            machineData && machineData.status
        ];

        return values.some(value => {
            if (value === true) return true;
            const normalized = normalizeText(value);
            return ['maintenance', 'manutencao', 'emmanutencao', 'paradamanutencao', 'paradoparamanutencao'].includes(normalized);
        });
    }

    function getMachineStatus(machineId, machineData) {
        if (machineIsInMaintenance(machineId, machineData)) return 'maintenance';
        if (typeof getMachineStatusWithLimits === 'function') {
            const limits = (typeof machineLimits !== 'undefined' && machineLimits && machineLimits[machineId])
                ? machineLimits[machineId]
                : (typeof DEFAULT_LIMITS !== 'undefined' ? DEFAULT_LIMITS : undefined);
            return getMachineStatusWithLimits(machineData || {}, limits);
        }
        return 'normal';
    }

    function machineMatchesSearch(machineId, machineData) {
        const filters = ensureFilterState();
        const term = normalizeText(filters && filters.search);
        if (!term) return true;

        const id = String(machineId || '');
        const forno = getMachineForno(id) || '';
        const numeric = (id.match(/\d+/) || [''])[0];
        const prefix = (typeof machinePrefixes !== 'undefined' && machinePrefixes && machinePrefixes[id]) ? machinePrefixes[id] : '';
        const commentValue = (typeof machineComments !== 'undefined' && machineComments && machineComments[id]) ? machineComments[id] : '';
        const comment = typeof commentValue === 'string' ? commentValue : (commentValue.text || commentValue.comment || '');

        const candidates = [
            id,
            `maquina${id}`,
            `máquina${id}`,
            `maq${id}`,
            numeric,
            forno && numeric ? `${forno}${numeric}` : '',
            prefix,
            comment,
            machineData && machineData.prefixo,
            machineData && machineData.prefix,
            machineData && machineData.nome
        ].map(normalizeText).filter(Boolean);

        return candidates.some(candidate => candidate.includes(term));
    }

    function syncButtons() {
        const filters = ensureFilterState();
        if (!filters) return;

        document.querySelectorAll('[data-forno]').forEach(button => {
            button.classList.toggle('active', filters.fornos.includes(String(button.dataset.forno).toUpperCase()));
        });

        document.querySelectorAll('[data-status]').forEach(button => {
            const status = STATUS_UI_TO_INTERNAL[normalizeText(button.dataset.status)] || button.dataset.status;
            button.classList.toggle('active', filters.status === status);
        });

        const clearStatusBtn = document.getElementById('clearStatusBtn');
        if (clearStatusBtn) clearStatusBtn.classList.toggle('active', !filters.status);

        const maintenanceBtn = document.getElementById('hideMaintenanceBtn');
        if (maintenanceBtn) {
            maintenanceBtn.classList.toggle('active', !!filters.hideMaintenance);
            maintenanceBtn.setAttribute('aria-pressed', String(!!filters.hideMaintenance));
            maintenanceBtn.innerHTML = filters.hideMaintenance
                ? '<i class="fas fa-eye"></i> Mostrar paradas para manutenção'
                : '<i class="fas fa-eye-slash"></i> Ocultar paradas para manutenção';
        }

        const searchInput = document.getElementById('machineSearch');
        if (searchInput && document.activeElement !== searchInput) searchInput.value = filters.search || '';
    }

    function hasActiveFilters() {
        const filters = ensureFilterState();
        return !!(filters && (
            filters.fornos.length > 0 ||
            filters.status ||
            normalizeText(filters.search) ||
            filters.hideMaintenance
        ));
    }

    function getFilteredMachines() {
        const filters = ensureFilterState();
        const source = (typeof allMachinesData !== 'undefined' && allMachinesData) ? allMachinesData : {};
        const result = {};

        Object.keys(source).forEach(machineId => {
            const machineData = source[machineId] || {};
            const forno = getMachineForno(machineId);
            const status = getMachineStatus(machineId, machineData);

            if (filters.fornos.length && !filters.fornos.includes(forno)) return;
            if (filters.hideMaintenance && status === 'maintenance') return;
            if (filters.status && status !== filters.status) return;
            if (!machineMatchesSearch(machineId, machineData)) return;

            result[machineId] = machineData;
        });

        return result;
    }

    function renderFilteredEmptyState() {
        const cardsContainer = document.getElementById('cardsContainer');
        const fornoSections = document.getElementById('fornoSections');
        if (fornoSections) fornoSections.style.display = 'none';
        if (!cardsContainer) return;
        cardsContainer.style.display = 'block';
        cardsContainer.innerHTML = `
            <div class="no-data-message">
                <i class="fas fa-filter"></i>
                <h3>Nenhuma máquina encontrada</h3>
                <p>Altere os filtros ou limpe a busca para visualizar as máquinas.</p>
                <button class="details-btn" type="button" onclick="window.clearAllDashboardFilters && window.clearAllDashboardFilters()">
                    <i class="fas fa-times"></i> Limpar filtros
                </button>
            </div>
        `;
    }

    window.applyFilters = function applyFiltersDefinitive() {
        const filters = ensureFilterState();
        if (!filters) return;

        syncButtons();

        if (typeof cleanupOldGauges === 'function') cleanupOldGauges();

        if (!hasActiveFilters()) {
            filteredMachinesData = Object.assign({}, allMachinesData || {});
            if (typeof generateFornoSections === 'function') generateFornoSections();
            if (typeof updateStatistics === 'function') updateStatistics();
            return;
        }

        filteredMachinesData = getFilteredMachines();
        const fornoSections = document.getElementById('fornoSections');
        const cardsContainer = document.getElementById('cardsContainer');
        if (fornoSections) fornoSections.style.display = 'none';

        if (Object.keys(filteredMachinesData).length === 0) {
            renderFilteredEmptyState();
            if (typeof updateStatistics === 'function') updateStatistics();
            return;
        }

        if (cardsContainer) {
            cardsContainer.style.display = 'grid';
            cardsContainer.classList.remove('horizontal-view');
        }

        if (typeof generateMachineCards === 'function') {
            generateMachineCards(filteredMachinesData);
        }

        if (typeof updateStatistics === 'function') updateStatistics();
        if (typeof recreateFilteredGauges === 'function') {
            setTimeout(recreateFilteredGauges, 120);
        }
    };

    window.clearAllDashboardFilters = function clearAllDashboardFilters() {
        const filters = ensureFilterState();
        if (!filters) return;
        filters.fornos = [];
        filters.status = null;
        filters.search = '';
        filters.hideMaintenance = false;
        const searchInput = document.getElementById('machineSearch');
        if (searchInput) searchInput.value = '';
        window.applyFilters();
    };

    function cloneElementById(id) {
        const original = document.getElementById(id);
        if (!original || !original.parentNode) return null;
        const clone = original.cloneNode(true);
        original.parentNode.replaceChild(clone, original);
        return clone;
    }

    function bindFiltersDefinitive() {
        const filters = ensureFilterState();
        if (!filters) return;

        const filtersBtn = cloneElementById('filtersBtn');
        const filtersBar = document.getElementById('filtersBar');
        if (filtersBtn && filtersBar) {
            filtersBtn.addEventListener('click', event => {
                event.preventDefault();
                filtersBar.classList.toggle('active');
                filtersBtn.classList.toggle('active', filtersBar.classList.contains('active'));
            });
        }

        document.querySelectorAll('[data-forno]').forEach(button => {
            const cleanButton = button.cloneNode(true);
            button.parentNode.replaceChild(cleanButton, button);
            cleanButton.addEventListener('click', event => {
                event.preventDefault();
                const forno = String(cleanButton.dataset.forno || '').toUpperCase();
                if (!forno) return;
                const index = filters.fornos.indexOf(forno);
                if (index >= 0) filters.fornos.splice(index, 1);
                else filters.fornos.push(forno);
                window.applyFilters();
            });
        });

        document.querySelectorAll('[data-status]').forEach(button => {
            const cleanButton = button.cloneNode(true);
            button.parentNode.replaceChild(cleanButton, button);
            cleanButton.addEventListener('click', event => {
                event.preventDefault();
                const status = STATUS_UI_TO_INTERNAL[normalizeText(cleanButton.dataset.status)] || cleanButton.dataset.status;
                filters.status = filters.status === status ? null : status;
                window.applyFilters();
            });
        });

        const clearFornoBtn = cloneElementById('clearFornoBtn');
        if (clearFornoBtn) {
            clearFornoBtn.addEventListener('click', event => {
                event.preventDefault();
                filters.fornos = [];
                window.applyFilters();
            });
        }

        const clearStatusBtn = cloneElementById('clearStatusBtn');
        if (clearStatusBtn) {
            clearStatusBtn.addEventListener('click', event => {
                event.preventDefault();
                filters.status = null;
                window.applyFilters();
            });
        }

        const maintenanceBtn = cloneElementById('hideMaintenanceBtn');
        if (maintenanceBtn) {
            maintenanceBtn.addEventListener('click', event => {
                event.preventDefault();
                filters.hideMaintenance = !filters.hideMaintenance;
                window.applyFilters();
            });
        }

        const searchInput = cloneElementById('machineSearch');
        if (searchInput) {
            let timer = null;
            searchInput.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    filters.search = searchInput.value.trim();
                    window.applyFilters();
                }, 120);
            });
            searchInput.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    searchInput.value = '';
                    filters.search = '';
                    window.applyFilters();
                }
            });
        }

        syncButtons();
    }

    const originalSetupEventListeners = typeof setupEventListeners === 'function' ? setupEventListeners : null;
    if (originalSetupEventListeners) {
        window.setupEventListeners = function setupEventListenersDefinitive() {
            originalSetupEventListeners.apply(this, arguments);
            bindFiltersDefinitive();
        };
        try { setupEventListeners = window.setupEventListeners; } catch (error) { /* ignored */ }
    }

    const originalGetForno = typeof getFornoFromMachineId === 'function' ? getFornoFromMachineId : null;
    window.getFornoFromMachineId = function getFornoFromMachineIdDefinitive(machineId) {
        return getMachineForno(machineId) || (originalGetForno ? originalGetForno(machineId) : null);
    };
    try { getFornoFromMachineId = window.getFornoFromMachineId; } catch (error) { /* ignored */ }

    const originalIsMaintenance = typeof isMachineInMaintenance === 'function' ? isMachineInMaintenance : null;
    window.isMachineInMaintenance = function isMachineInMaintenanceDefinitive(machineId) {
        const data = (typeof allMachinesData !== 'undefined' && allMachinesData) ? allMachinesData[machineId] : null;
        return machineIsInMaintenance(machineId, data) || (originalIsMaintenance ? originalIsMaintenance(machineId) : false);
    };
    try { isMachineInMaintenance = window.isMachineInMaintenance; } catch (error) { /* ignored */ }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(bindFiltersDefinitive, 0);
    });
})();
