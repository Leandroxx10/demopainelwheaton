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
    
    // Evita inicialização duplicada
    let isRunning = false;
    
    // Intervalo mínimo entre registros em tempo real
    // Como você quer registrar toda mudança real, mantemos 0.
    const MIN_REAL_TIME_INTERVAL = 0;
    
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
        const parts = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).formatToParts(now).reduce((acc, part) => {
            if (part.type !== 'literal') acc[part.type] = part.value;
            return acc;
        }, {});

        const dia = parts.day;
        const mes = parts.month;
        const ano = Number(parts.year);
        const hora = parts.hour === '24' ? '00' : parts.hour;
        const minuto = parts.minute;
        const segundo = parts.second;

        return {
            data: { dia, mes, ano },
            hora: { hora, minuto, segundo },
            timestamp: now.getTime(),
            dataBR: `${dia}/${mes}/${ano}`,
            horaCompleta: `${hora}:${minuto}:${segundo}`,
            horaMinuto: `${hora}:${minuto}`,
            horaInt: Number(hora),
            minutoInt: Number(minuto)
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
    async function registerRealtimeChange(machineId, valoresAtuais, source = 'unknown') {
        try {
            const ultimos = lastValues[machineId] || {};
            const agora = Date.now();
            
            // Se não mudou nada, não registra
            if (!valuesChanged(ultimos, valoresAtuais)) {
                return false;
            }
            
            const ultimoRealTime = lastRealTimeRecord[machineId]?.timestamp || 0;
            const tempoDesdeUltimo = agora - ultimoRealTime;
            
            if (tempoDesdeUltimo < MIN_REAL_TIME_INTERVAL) {
                lastValues[machineId] = {
                    ...valoresAtuais,
                    timestamp: agora
                };
                return false;
            }
            
            const sp = getSaoPauloTime();
            
            console.log(`⚡ Alteração real detectada (${source}) em ${machineId} às ${sp.horaCompleta}`);
            console.log(`   Antes: M:${ultimos.molde ?? 0} B:${ultimos.blank ?? 0} N:${ultimos.neck_ring ?? 0} F:${ultimos.funil ?? 0}`);
            console.log(`   Agora: M:${valoresAtuais.molde} B:${valoresAtuais.blank} N:${valoresAtuais.neck_ring} F:${valoresAtuais.funil}`);
            
            const registro = {
                machineId: machineId,
                data: sp.dataBR,
                dataISO: `${sp.data.ano}-${sp.data.mes}-${sp.data.dia}`,
                hora: sp.horaMinuto,
                horaCompleta: sp.horaCompleta,
                horaNum: sp.horaInt,
                minutoNum: sp.minutoInt,
                timestamp: sp.timestamp,
                
                molde: valoresAtuais.molde,
                blank: valoresAtuais.blank,
                neck_ring: valoresAtuais.neck_ring,
                funil: valoresAtuais.funil,
                
                mudancas: {
                    molde: valoresAtuais.molde - (ultimos.molde ?? 0),
                    blank: valoresAtuais.blank - (ultimos.blank ?? 0),
                    neck_ring: valoresAtuais.neck_ring - (ultimos.neck_ring ?? 0),
                    funil: valoresAtuais.funil - (ultimos.funil ?? 0)
                },
                
                tipo: 'real_time',
                source: source,
                created_at: new Date().toISOString()
            };
            
            // Chave única por instante
            const chave = `rt_${sp.data.ano}${sp.data.mes}${sp.data.dia}_${sp.hora.hora}${sp.hora.minuto}${sp.hora.segundo}_${String(sp.timestamp).slice(-3)}`;
            
            await historicoRef.child(machineId).child(chave).set(registro);
            
            lastValues[machineId] = {
                ...valoresAtuais,
                timestamp: agora
            };
            
            lastRealTimeRecord[machineId] = {
                timestamp: agora,
                valores: { ...valoresAtuais }
            };
            
            console.log(`✅ Histórico em tempo real salvo: ${machineId}`);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao registrar alteração em ${machineId}:`, error);
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
