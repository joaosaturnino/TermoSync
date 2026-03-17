const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const LOGIN_SIMULADOR = { usuario: 'admin', senha: 'admin123' };
let tokenAtivo = '';

async function autenticar() {
    try {
        const res = await axios.post(`${API_URL}/login`, LOGIN_SIMULADOR);
        tokenAtivo = res.data.token;
        console.log('\n[SISTEMA] Simulador autenticado com sucesso! Iniciando leituras...\n');
    } catch (error) {
        console.error('\n[ERRO] Simulador falhou ao fazer login. Verifique se o usuário/senha estão corretos.');
    }
}

function gerarTemperatura(min, max) {
    return (Math.random() * (max - min) + min).toFixed(2);
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

        // --- SIMULAÇÃO: INICIAR DEGELO (5% de chance) ---
        if (eq.motor_ligado && !eq.em_degelo && Math.random() < 0.05) {
            console.log(`\n❄️ [SISTEMA] Iniciando ciclo de DEGELO programado no equipamento "${eq.nome}"...`);
            await axios.put(`${API_URL}/equipamentos/${eq.id}/degelo`, { em_degelo: true }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, motor_ligado: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            return;
        }

        // --- SIMULAÇÃO: FALHA NO MOTOR (5% de chance) ---
        if (eq.motor_ligado && !eq.em_degelo && Math.random() < 0.05) {
            console.log(`\n🚨 [ALERTA CRÍTICO] O motor do equipamento "${eq.nome}" PAROU (FALHA INESPERADA)!`);
            await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, motor_ligado: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            return;
        }

        // --- SIMULAÇÃO: RECUPERAÇÃO (Técnico religou ou Degelo acabou) (15% de chance) ---
        if ((!eq.motor_ligado || eq.em_degelo) && Math.random() < 0.15) {
            if (eq.em_degelo) {
                console.log(`\n✅ [SISTEMA] O ciclo de DEGELO do "${eq.nome}" terminou. Motor religado!`);
                await axios.put(`${API_URL}/equipamentos/${eq.id}/degelo`, { em_degelo: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            } else {
                console.log(`\n🔧 [MANUTENÇÃO] O técnico consertou e RELIGOU o motor do "${eq.nome}"!`);
            }
            await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, motor_ligado: true }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
            return;
        }

        // --- SIMULAÇÃO: LEITURAS ---
        let tempAtual;
        if (!eq.motor_ligado) {
            tempAtual = gerarTemperatura(parseFloat(eq.temp_max) + 2, parseFloat(eq.temp_max) + 12);
            if (eq.em_degelo) {
                console.log(`[DEGELO]  ${eq.nome} | Motor parado, derretendo gelo. Temp subindo: ${tempAtual}°C`);
            } else {
                console.log(`[CRÍTICO] ${eq.nome} | MOTOR DESLIGADO! Temperatura disparou para: ${tempAtual}°C`);
            }
        } else {
            if (Math.random() < 0.15) {
                tempAtual = gerarTemperatura(parseFloat(eq.temp_max) + 0.1, parseFloat(eq.temp_max) + 3);
                console.log(`[AVISO]   ${eq.nome} | Porta Aberta? Temp. alta: ${tempAtual}°C`);
            } else {
                tempAtual = gerarTemperatura(parseFloat(eq.temp_min), parseFloat(eq.temp_max) - 0.5);
                console.log(`[OK]      ${eq.nome} | Operando normal. Temp: ${tempAtual}°C`);
            }
        }

        await axios.post(`${API_URL}/leituras`, { equipamento_id: eq.id, temperatura: parseFloat(tempAtual) });

    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('[SISTEMA] Token expirado, reconectando...');
            tokenAtivo = '';
        } else {
            console.error("Erro no ciclo de simulação:", error.message);
        }
    }
}

console.log('=========================================');
console.log('   ROBÔ SIMULADOR FRIOMONITOR INICIADO   ');
console.log('=========================================');

setInterval(executarSimulacao, 4000);