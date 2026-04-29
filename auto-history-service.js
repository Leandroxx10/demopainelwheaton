// ================= SERVIÇO DE HISTÓRICO =================
// REGISTRA ALTERAÇÕES REAIS + SNAPSHOT HORÁRIO FIXO (HH:00)
// COM FALLBACK DE VERIFICAÇÃO PERIÓDICA PARA CAPTAR ALTERAÇÕES
// VINDAS DE OUTROS SITES/APLICAÇÕES NO MESMO FIREBASE.

(function() {
    "use strict";
    
    console.log("🔄 Inicializando serviço de histórico...");
    
    // Últimos valores conhecidos por máquina
    let lastValues = {};
    
    // Controle do último snapshot horário salvo por máquina
    let lastHourlyRecord = {};
    
    // Controle do último registro em tempo real salvo por máquina
    let lastRealTimeRecord = {};
    
    // Alterações pendentes por máquina: confirma após 10s antes de gravar no histórico
    let pendingRealtimeChanges = {};
    
    // Evita inicialização duplicada
    let isRunning = false;
    
    // Intervalo mínimo entre registros em tempo real
    // Como você quer registrar toda mudança real, mantemos 0.
    const MIN_REAL_TIME_INTERVAL = 0;
    
    // Aguarda estabilidade antes de enviar para o gráfico
    const CHANGE_CONFIRMATION_DELAY = 10 * 1000;
    
    // Verificação de snapshot horário
    const HOURLY_CHECK_INTERVAL = 60 * 1000; // 1 minuto
    
    // Polling de segurança:
    // mesmo que o child_changed falhe por qualquer motivo,
    // essa rotina compara o estado atual do Firebase com o último estado conhecido.
    const SAFETY_POLL_INTERVAL = 10 * 1000; // 10 segundos
    
    // Aguarda Firebase
    const checkFirebase = setInterval(() => {
        if (typeof maquinasRef !== 'undefined' && typeof historicoRef !== 'undefined') {
            clearInterval(checkFirebase);
            startService();
        }
    }, 1000);
    
    function startService() {
        if (isRunning) return;
        isRunning = true;
        
        console.log("✅ Serviço de histórico ativo");
        
        // Carrega valores iniciais primeiro
        loadInitialValues().then(() => {
            // Listener em tempo real do Firebase
            monitorRealtimeChanges();
            
            // Polling de segurança
            setInterval(runSafetyPolling, SAFETY_POLL_INTERVAL);
            
            // Snapshot horário
            setInterval(checkAndRecordHourly, HOURLY_CHECK_INTERVAL);
            
            // Disparo inicial
            setTimeout(checkAndRecordHourly, 5000);
        });
    }
    
    // ===== HORÁRIO DE SÃO PAULO =====
    function getSaoPauloTime() {
        const now = new Date();
        
        // São Paulo UTC-3
        const sp = new Date(now.getTime() - (3 * 60 * 60 * 1000));
        
        return {
            data: {
                dia: String(sp.getUTCDate()).padStart(2, '0'),
                mes: String(sp.getUTCMonth() + 1).padStart(2, '0'),
                ano: sp.getUTCFullYear()
            },
            hora: {
                hora: String(sp.getUTCHours()).padStart(2, '0'),
                minuto: String(sp.getUTCMinutes()).padStart(2, '0'),
                segundo: String(sp.getUTCSeconds()).padStart(2, '0')
            },
            timestamp: sp.getTime(),
            dataBR: `${String(sp.getUTCDate()).padStart(2, '0')}/${String(sp.getUTCMonth() + 1).padStart(2, '0')}/${sp.getUTCFullYear()}`,
            horaCompleta: `${String(sp.getUTCHours()).padStart(2, '0')}:${String(sp.getUTCMinutes()).padStart(2, '0')}:${String(sp.getUTCSeconds()).padStart(2, '0')}`,
            horaMinuto: `${String(sp.getUTCHours()).padStart(2, '0')}:${String(sp.getUTCMinutes()).padStart(2, '0')}`,
            horaInt: sp.getUTCHours(),
            minutoInt: sp.getUTCMinutes()
        };
    }
    
    // ===== AUXILIARES =====
    function parseNum(val) {
        const num = parseInt(val, 10);
        return isNaN(num) ? 0 : num;
    }
    
    function extractMachineValues(machineData) {
        if (!machineData) {
            return {
                molde: 0,
                blank: 0,
                neck_ring: 0,
                funil: 0
            };
        }
        
        return {
            molde: parseNum(machineData.molde ?? machineData.new_molde),
            blank: parseNum(machineData.blank ?? machineData.new_blank),
            neck_ring: parseNum(
                machineData.neck_ring ??
                machineData.neckRing ??
                machineData.neckring ??
                machineData.new_neckring
            ),
            funil: parseNum(machineData.funil ?? machineData.new_funil)
        };
    }
    
    function valuesChanged(oldValues, newValues) {
        return (
            (newValues.molde ?? 0) !== (oldValues?.molde ?? 0) ||
            (newValues.blank ?? 0) !== (oldValues?.blank ?? 0) ||
            (newValues.neck_ring ?? 0) !== (oldValues?.neck_ring ?? 0) ||
            (newValues.funil ?? 0) !== (oldValues?.funil ?? 0)
        );
    }
    
    // ===== CARREGAR ESTADO INICIAL =====
    async function loadInitialValues() {
        try {
            const snapshot = await maquinasRef.once("value");
            const machines = snapshot.val() || {};
            
            Object.keys(machines).forEach(machineId => {
                const valores = extractMachineValues(machines[machineId]);
                
                lastValues[machineId] = {
                    ...valores,
                    timestamp: Date.now()
                };
                
                lastHourlyRecord[machineId] = {
                    hora: -1,
                    data: '',
                    valores: { ...valores }
                };
                
                lastRealTimeRecord[machineId] = {
                    timestamp: 0,
                    valores: { ...valores }
                };
            });
            
            console.log("✅ Estado inicial carregado:", Object.keys(machines).length, "máquinas");
        } catch (error) {
            console.error("❌ Erro ao carregar estado inicial:", error);
        }
    }
        // ===== REGISTRAR ALTERAÇÃO REAL =====
    // Debounce independente por máquina e por campo.
    // Corrige o caso em que molde + blank mudam juntos: cada campo confirma sozinho,
    // sem cancelar o outro e sem bloquear a gravação do histórico.
    const HISTORY_FIELDS = ['molde', 'blank', 'neck_ring', 'funil'];

    function changedFieldsBetween(baseValues, currentValues) {
        return HISTORY_FIELDS.filter(field => (currentValues?.[field] ?? 0) !== (baseValues?.[field] ?? 0));
    }

    function ensurePendingMachine(machineId) {
        if (!pendingRealtimeChanges[machineId]) pendingRealtimeChanges[machineId] = { fields: {} };
        if (!pendingRealtimeChanges[machineId].fields) pendingRealtimeChanges[machineId].fields = {};
        return pendingRealtimeChanges[machineId];
    }

    function clearPendingField(machineId, field) {
        const bucket = pendingRealtimeChanges[machineId];
        if (!bucket?.fields?.[field]) return;
        if (bucket.fields[field].timer) clearTimeout(bucket.fields[field].timer);
        delete bucket.fields[field];
        if (!Object.keys(bucket.fields).length) delete pendingRealtimeChanges[machineId];
    }

    function buildSparseFieldValues(fullValues, changedFields) {
        // Para o gráfico: campo que não mudou fica null no registro real_time.
        // Assim, alterar blank não cria ponto novo em molde, e vice-versa.
        const output = {};
        HISTORY_FIELDS.forEach(field => {
            output[field] = changedFields.includes(field) ? (fullValues[field] ?? 0) : null;
        });
        return output;
    }

    async function saveRealtimeChangeNow(machineId, valoresAtuais, baseValues, changedFields, source = 'unknown') {
        try {
            const agora = Date.now();
            const sp = getSaoPauloTime();
            const sparseValues = buildSparseFieldValues(valoresAtuais, changedFields);
            const mudancas = {};

            HISTORY_FIELDS.forEach(field => {
                mudancas[field] = changedFields.includes(field)
                    ? ((valoresAtuais[field] ?? 0) - (baseValues?.[field] ?? 0))
                    : 0;
            });

            const registro = {
                machineId: machineId,
                data: sp.dataBR,
                dataISO: `${sp.data.ano}-${sp.data.mes}-${sp.data.dia}`,
                hora: sp.horaMinuto,
                horaCompleta: sp.horaCompleta,
                horaNum: sp.horaInt,
                minutoNum: sp.minutoInt,
                timestamp: sp.timestamp,

                // Valores para o gráfico. Só o campo confirmado recebe ponto.
                molde: sparseValues.molde,
                blank: sparseValues.blank,
                neck_ring: sparseValues.neck_ring,
                funil: sparseValues.funil,

                // Snapshot completo para auditoria/tabela/debug sem perder contexto.
                snapshot: {
                    molde: valoresAtuais.molde,
                    blank: valoresAtuais.blank,
                    neck_ring: valoresAtuais.neck_ring,
                    funil: valoresAtuais.funil
                },

                changedFields: changedFields,
                mudancas: mudancas,
                tipo: 'real_time',
                source: source,
                debounce_mode: 'per_machine_per_field',
                confirmed_after_ms: CHANGE_CONFIRMATION_DELAY,
                created_at: new Date().toISOString()
            };

            const chave = `rt_${sp.data.ano}${sp.data.mes}${sp.data.dia}_${sp.hora.hora}${sp.hora.minuto}${sp.hora.segundo}_${String(sp.timestamp).slice(-3)}`;
            await historicoRef.child(machineId).child(chave).set(registro);

            // Atualiza apenas os campos confirmados. Os outros continuam com sua base própria.
            const previous = lastValues[machineId] || {};
            const nextLast = { ...previous };
            changedFields.forEach(field => { nextLast[field] = valoresAtuais[field] ?? 0; });
            lastValues[machineId] = { ...nextLast, timestamp: agora };
            lastRealTimeRecord[machineId] = { timestamp: agora, valores: { ...lastValues[machineId] } };

            console.log(`✅ Histórico salvo após debounce por campo: ${machineId} [${changedFields.join(', ')}]`);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao registrar alteração em ${machineId}:`, error);
            return false;
        }
    }

    async function confirmAndSavePendingField(machineId, field) {
        const pendingField = pendingRealtimeChanges[machineId]?.fields?.[field];
        if (!pendingField) return false;

        try {
            const snapshot = await maquinasRef.child(machineId).once("value");
            const machineData = snapshot.val() || {};
            const valoresConfirmados = extractMachineValues(machineData);
            const currentFieldValue = valoresConfirmados[field] ?? 0;

            // Descarta se voltou para o valor antigo ou se mudou de novo durante os 10s.
            if (currentFieldValue === (pendingField.baseValue ?? 0)) {
                clearPendingField(machineId, field);
                console.log(`⏳ Alteração descartada em ${machineId}.${field}: voltou ao valor anterior.`);
                return false;
            }

            if (currentFieldValue !== (pendingField.observedValue ?? 0)) {
                // Valor mudou novamente. Reinicia o debounce desse campo, sem afetar os outros.
                pendingField.baseValue = pendingField.baseValue ?? 0;
                pendingField.observedValue = currentFieldValue;
                pendingField.createdAt = Date.now();
                pendingField.timer = setTimeout(() => confirmAndSavePendingField(machineId, field), CHANGE_CONFIRMATION_DELAY);
                console.log(`⏳ ${machineId}.${field} mudou durante o debounce. Aguardando mais ${CHANGE_CONFIRMATION_DELAY / 1000}s.`);
                return true;
            }

            // Agrupa outros campos da mesma máquina que também já estabilizaram.
            const bucket = pendingRealtimeChanges[machineId];
            const fieldsToSave = [];
            const baseValues = { ...(lastValues[machineId] || {}) };
            const now = Date.now();
            let source = pendingField.source || 'confirmed_field_change';

            Object.keys(bucket.fields).forEach(candidateField => {
                const item = bucket.fields[candidateField];
                const candidateValue = valoresConfirmados[candidateField] ?? 0;
                const stableLongEnough = now - (item.createdAt || 0) >= CHANGE_CONFIRMATION_DELAY - 50;

                if (
                    stableLongEnough &&
                    candidateValue === (item.observedValue ?? 0) &&
                    candidateValue !== (item.baseValue ?? 0)
                ) {
                    fieldsToSave.push(candidateField);
                    baseValues[candidateField] = item.baseValue ?? 0;
                    source = item.source || source;
                }
            });

            fieldsToSave.forEach(candidateField => clearPendingField(machineId, candidateField));

            if (!fieldsToSave.length) return false;
            return await saveRealtimeChangeNow(machineId, valoresConfirmados, baseValues, fieldsToSave, source);
        } catch (error) {
            clearPendingField(machineId, field);
            console.error(`❌ Erro ao confirmar alteração pendente em ${machineId}.${field}:`, error);
            return false;
        }
    }

    async function registerRealtimeChange(machineId, valoresAtuais, source = 'unknown') {
        try {
            const ultimos = lastValues[machineId] || {};
            const camposAlterados = changedFieldsBetween(ultimos, valoresAtuais);

            // Cancela timers de campos que voltaram para o valor base.
            HISTORY_FIELDS.forEach(field => {
                if (!camposAlterados.includes(field) && pendingRealtimeChanges[machineId]?.fields?.[field]) {
                    clearPendingField(machineId, field);
                }
            });

            if (!camposAlterados.length) return false;

            const bucket = ensurePendingMachine(machineId);

            camposAlterados.forEach(field => {
                const currentValue = valoresAtuais[field] ?? 0;
                const existing = bucket.fields[field];

                // Se o mesmo valor já está aguardando, não reinicia o timer.
                if (existing && existing.observedValue === currentValue) return;

                if (existing?.timer) clearTimeout(existing.timer);

                bucket.fields[field] = {
                    baseValue: existing ? existing.baseValue : (ultimos[field] ?? 0),
                    observedValue: currentValue,
                    source,
                    createdAt: Date.now(),
                    timer: setTimeout(() => confirmAndSavePendingField(machineId, field), CHANGE_CONFIRMATION_DELAY)
                };

                console.log(`⏳ Aguardando ${CHANGE_CONFIRMATION_DELAY / 1000}s para confirmar ${machineId}.${field}: ${bucket.fields[field].baseValue} → ${currentValue}`);
            });

            return true;
        } catch (error) {
            console.error(`❌ Erro ao agendar alteração em ${machineId}:`, error);
            return false;
        }
    }

    // ===== LISTENER REALTIME DO FIREBASE =====
    function monitorRealtimeChanges() {
        console.log("👀 Monitorando child_changed em maquinas...");
        
        maquinasRef.on("child_changed", async (snapshot) => {
            const machineId = snapshot.key;
            const machineData = snapshot.val() || {};
            const valoresAtuais = extractMachineValues(machineData);
            
            await registerRealtimeChange(machineId, valoresAtuais, 'firebase_child_changed');
        });
        
        // Se uma máquina aparecer depois
        maquinasRef.on("child_added", (snapshot) => {
            const machineId = snapshot.key;
            const machineData = snapshot.val() || {};
            const valores = extractMachineValues(machineData);
            
            if (!lastValues[machineId]) {
                lastValues[machineId] = {
                    ...valores,
                    timestamp: Date.now()
                };
            }
            
            if (!lastHourlyRecord[machineId]) {
                lastHourlyRecord[machineId] = {
                    hora: -1,
                    data: '',
                    valores: { ...valores }
                };
            }
            
            if (!lastRealTimeRecord[machineId]) {
                lastRealTimeRecord[machineId] = {
                    timestamp: 0,
                    valores: { ...valores }
                };
            }
        });
    }
        // ===== POLLING DE SEGURANÇA =====
    async function runSafetyPolling() {
        try {
            const snapshot = await maquinasRef.once("value");
            const machines = snapshot.val() || {};
            
            for (const machineId of Object.keys(machines)) {
                const valoresAtuais = extractMachineValues(machines[machineId]);
                const ultimos = lastValues[machineId] || null;
                
                if (valuesChanged(ultimos, valoresAtuais)) {
                    console.log(`🛡️ Polling detectou mudança que ainda não estava no histórico: ${machineId}`);
                    await registerRealtimeChange(machineId, valoresAtuais, 'safety_polling');
                }
            }
        } catch (error) {
            console.error("❌ Erro no safety polling:", error);
        }
    }
    
    // ===== SNAPSHOT HORÁRIO =====
    async function checkAndRecordHourly() {
        try {
            const sp = getSaoPauloTime();
            const horaAtual = sp.horaInt;
            const minutoAtual = sp.minutoInt;
            const dataAtual = sp.dataBR;
            
            // Só registra entre XX:00 e XX:05
            if (minutoAtual > 5) {
                return;
            }
            
            console.log(`⏰ Verificando snapshot horário: ${sp.horaMinuto}`);
            
            const snapshot = await maquinasRef.once("value");
            const machines = snapshot.val() || {};
            
            let count = 0;
            const updates = {};
            
            for (const machineId in machines) {
                const valoresAtuais = extractMachineValues(machines[machineId]);
                
                const ultimoRegistro = lastHourlyRecord[machineId];
                const mesmaHora = ultimoRegistro &&
                    ultimoRegistro.hora === horaAtual &&
                    ultimoRegistro.data === dataAtual;
                
                if (!mesmaHora) {
                    const horaFormatada = `${String(horaAtual).padStart(2, '0')}:00`;
                    
                    const registro = {
                        machineId: machineId,
                        data: sp.dataBR,
                        dataISO: `${sp.data.ano}-${sp.data.mes}-${sp.data.dia}`,
                        hora: horaFormatada,
                        horaCompleta: `${horaFormatada}:00`,
                        horaNum: horaAtual,
                        minutoNum: 0,
                        timestamp: sp.timestamp,
                        
                        molde: valoresAtuais.molde,
                        blank: valoresAtuais.blank,
                        neck_ring: valoresAtuais.neck_ring,
                        funil: valoresAtuais.funil,
                        
                        tipo: 'hourly',
                        source: 'hourly_snapshot',
                        created_at: new Date().toISOString()
                    };
                    
                    const chave = `${sp.data.ano}${sp.data.mes}${sp.data.dia}_${String(horaAtual).padStart(2, '0')}00`;
                    
                    if (!updates[machineId]) updates[machineId] = {};
                    updates[machineId][chave] = registro;
                    
                    lastHourlyRecord[machineId] = {
                        hora: horaAtual,
                        data: dataAtual,
                        valores: { ...valoresAtuais }
                    };
                    
                    count++;
                    console.log(`📝 Snapshot horário preparado: ${machineId} ${horaFormatada}`);
                }
            }
            
            if (count > 0) {
                for (const machineId in updates) {
                    await historicoRef.child(machineId).update(updates[machineId]);
                }
                console.log(`✅ Snapshot horário salvo para ${count} máquinas`);
            }
            
        } catch (error) {
            console.error("❌ Erro no snapshot horário:", error);
        }
    }
        // ===== CONSULTAS =====
    window.getHistoryByDate = async function(machineId, dataBR) {
        return new Promise((resolve, reject) => {
            historicoRef.child(machineId)
                .orderByChild('data')
                .equalTo(dataBR)
                .once("value", (snapshot) => {
                    const dados = snapshot.val() || {};
                    
                    const lista = Object.values(dados)
                        .filter(item => item.data === dataBR)
                        .sort((a, b) => a.timestamp - b.timestamp);
                    
                    resolve(lista);
                }, reject);
        });
    };
    
    window.getMachineHistoryByDate = async function(machineId, dateISO) {
        try {
            if (!machineId || !dateISO) return [];
            
            const partes = dateISO.split('-');
            if (partes.length !== 3) return [];
            
            const [ano, mes, dia] = partes;
            const dataBR = `${dia}/${mes}/${ano}`;
            const lista = await window.getHistoryByDate(machineId, dataBR);
            
            return lista.map(item => {
                let horaNum = 0;
                let minutoNum = 0;
                
                if (item.horaNum !== undefined && item.minutoNum !== undefined) {
                    horaNum = item.horaNum;
                    minutoNum = item.minutoNum;
                } else if (item.hora && typeof item.hora === 'string' && item.hora.includes(':')) {
                    const [hStr, mStr] = item.hora.split(':');
                    horaNum = parseInt(hStr, 10) || 0;
                    minutoNum = parseInt(mStr, 10) || 0;
                }
                
                return {
                    ...item,
                    hora: horaNum,
                    minuto: minutoNum
                };
            });
        } catch (error) {
            console.error('❌ Erro em getMachineHistoryByDate:', error);
            return [];
        }
    };
    
    window.getHistoryByDateRange = async function(machineId, dataInicio, dataFim) {
        return new Promise((resolve, reject) => {
            historicoRef.child(machineId).once("value", (snapshot) => {
                const dados = snapshot.val() || {};
                
                const lista = Object.values(dados)
                    .filter(item => item.data >= dataInicio && item.data <= dataFim)
                    .sort((a, b) => a.timestamp - b.timestamp);
                
                resolve(lista);
            }, reject);
        });
    };
    
    // ===== LIMPEZA DE DUPLICADOS =====
    window.cleanupDuplicateHistory = async function() {
        console.log("🧹 Iniciando limpeza de duplicados...");
        
        try {
            const snapshot = await historicoRef.once("value");
            const allData = snapshot.val() || {};
            let totalRemovidos = 0;
            
            for (const machineId in allData) {
                const registros = allData[machineId];
                const vistos = new Set();
                const paraManter = {};
                
                Object.keys(registros).forEach(key => {
                    const registro = registros[key];
                    
                    if (registro.tipo === 'hourly') {
                        const horaKey = `${registro.data}_${registro.horaNum}`;
                        
                        if (!vistos.has(horaKey)) {
                            vistos.add(horaKey);
                            paraManter[key] = registro;
                        } else {
                            totalRemovidos++;
                        }
                    } else {
                        paraManter[key] = registro;
                    }
                });
                
                if (Object.keys(paraManter).length !== Object.keys(registros).length) {
                    await historicoRef.child(machineId).set(paraManter);
                }
            }
            
            console.log(`✅ Limpeza concluída: ${totalRemovidos} removidos`);
            return totalRemovidos;
        } catch (error) {
            console.error("❌ Erro na limpeza:", error);
        }
    };
    
    // ===== FORÇAR SNAPSHOT HORÁRIO =====
    window.forceManualRecord = async function() {
        return await checkAndRecordHourly();
    };
    
})();
