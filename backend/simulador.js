const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const LOGIN_SIMULADOR = { usuario: 'admin', senha: 'admin123' };
let tokenAtivo = '';

// NOVO: Memória térmica para simular a física de refrigeração realista
let historicoTemperaturas = {}; 

async function autenticar() {
    try {
        const res = await axios.post(`${API_URL}/login`, LOGIN_SIMULADOR);
        tokenAtivo = res.data.token;
        console.log('\n[SISTEMA] Simulador autenticado com sucesso! Iniciando telemetria...\n');
    } catch (error) {
        console.error('\n[ERRO] Simulador falhou ao fazer login.');
    }
}

async function executarSimulacao() {
    if (!tokenAtivo) {
        await autenticar();
        if (!tokenAtivo) return;
    }

    try {
        const resEquip = await axios.get(`${API_URL}/equipamentos`, {
            headers: { Authorization: `Bearer ${tokenAtivo}` }
        });
        const equipamentos = resEquip.data;

        if (equipamentos.length === 0) return;

        const eq = equipamentos[Math.floor(Math.random() * equipamentos.length)];

        // --- SIMULAÇÃO DE ACONTECIMENTOS ---
        if (eq.motor_ligado && !eq.em_degelo && Math.random() < 0.05) {
            console.log(`\n❄️ [AÇÃO] Iniciando ciclo de DEGELO no equipamento "${eq.nome}"...`);
            await axios.put(`${API_URL}/equipamentos/${eq.id}/degelo`, { em_degelo: true }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, motor_ligado: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            return;
        }

        if (eq.motor_ligado && !eq.em_degelo && Math.random() < 0.05) {
            console.log(`\n🚨 [FALHA] O motor do equipamento "${eq.nome}" PAROU!`);
            await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, motor_ligado: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            return;
        }

        if ((!eq.motor_ligado || eq.em_degelo) && Math.random() < 0.15) {
            if (eq.em_degelo) {
                console.log(`\n✅ [FIM] O ciclo de DEGELO do "${eq.nome}" terminou. Arrefecimento retomado.`);
                await axios.put(`${API_URL}/equipamentos/${eq.id}/degelo`, { em_degelo: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            } else {
                console.log(`\n🔧 [MANUTENÇÃO] Técnico resolveu a falha do "${eq.nome}" e ligou o motor.`);
            }
            await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, motor_ligado: true }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            return;
        }

        // --- NOVA FÍSICA TERMODINÂMICA ---
        let tempAtual = historicoTemperaturas[eq.id];
        const tempIdeal = parseFloat(eq.temp_min) + ((parseFloat(eq.temp_max) - parseFloat(eq.temp_min)) / 2); // Meio termo ideal
        
        // Se nunca foi lido, começa perto da temperatura ideal
        if (tempAtual === undefined) tempAtual = tempIdeal;

        if (!eq.motor_ligado) {
            // AQUECIMENTO GRADUAL (A câmara está desligada ou em degelo)
            tempAtual += (Math.random() * 0.8 + 0.2); // Sobe entre +0.2 a +1.0 °C
            if (tempAtual > 25) tempAtual = 25; // Limite da temperatura ambiente
            
            if (eq.em_degelo) console.log(`[DEGELO]  ${eq.nome} | Temp a subir suavemente: ${tempAtual.toFixed(2)}°C`);
            else console.log(`[CRÍTICO] ${eq.nome} | MOTOR PARADO! Temp a subir: ${tempAtual.toFixed(2)}°C`);
            
        } else {
            // ARREFECIMENTO OU MANUTENÇÃO (Motor a funcionar)
            if (tempAtual > tempIdeal + 0.5) {
                // Motor força o arrefecimento rápido para voltar ao normal
                tempAtual -= (Math.random() * 1.0 + 0.3); // Desce entre -0.3 e -1.3 °C
            } else {
                // Flutuação normal de manutenção (Compressor liga e desliga)
                tempAtual += (Math.random() * 0.6 - 0.3); // Varia suavemente entre -0.3 e +0.3 °C
            }
            console.log(`[OK]      ${eq.nome} | Operação normal. Temp: ${tempAtual.toFixed(2)}°C`);
        }

        // Guarda em memória e envia
        historicoTemperaturas[eq.id] = tempAtual;
        await axios.post(`${API_URL}/leituras`, { equipamento_id: eq.id, temperatura: tempAtual.toFixed(2) });

    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('[SISTEMA] Token expirado, a reconectar...');
            tokenAtivo = '';
        } else {
            console.error("Erro de simulação:", error.message);
        }
    }
}

console.log('=========================================');
console.log('   ROBÔ TERMOMÉTRICO IoT INICIADO        ');
console.log('=========================================');

setInterval(executarSimulacao, 4000);