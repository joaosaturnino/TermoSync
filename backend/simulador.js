/**
 * Robô IoT de Simulação Física e de Redes
 * Simula a degradação térmica e falhas de infraestrutura de rede (Perda de Pacotes).
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const LOGIN_SIMULADOR = { usuario: 'admin', senha: 'admin123' };

let tokenAtivo = '';
let historicoTemperaturas = {}; 
let historicoUmidades = {}; 

async function autenticar() {
  try {
    const res = await axios.post(`${API_URL}/login`, LOGIN_SIMULADOR);
    tokenAtivo = res.data.token;
    console.log('\n[SISTEMA] Simulador IoT autenticado. Conectado ao Core PharmaX.\n');
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
    
    // Simulação de Quebra de Rede IoT
    if (Math.random() < 0.04) { 
      console.log(`\n📡 [REDE] DROP DE PACOTE: O sensor do equipamento "${eq.nome}" perdeu conexão momentânea. Carga ignorada.`);
      return; 
    }

    if (eq.motor_ligado && !eq.em_degelo && Math.random() < 0.05) {
      console.log(`\n❄️ [AÇÃO] A iniciar ciclo de DEGELO no equipamento "${eq.nome}"...`);
      await axios.put(`${API_URL}/equipamentos/${eq.id}/degelo`, { em_degelo: true }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
      await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min, umidade_max: eq.umidade_max, motor_ligado: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
      return;
    }

    if (eq.motor_ligado && !eq.em_degelo && Math.random() < 0.03) {
      console.log(`\n🚨 [FALHA] O motor do equipamento "${eq.nome}" PAROU!`);
      await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min, umidade_max: eq.umidade_max, motor_ligado: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
      return;
    }

    if ((!eq.motor_ligado || eq.em_degelo) && Math.random() < 0.15) {
      if (eq.em_degelo) {
        console.log(`\n✅ [FIM] O ciclo de DEGELO do "${eq.nome}" terminou. Arrefecimento retomado.`);
        await axios.put(`${API_URL}/equipamentos/${eq.id}/degelo`, { em_degelo: false }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
      } else {
        console.log(`\n🔧 [MANUTENÇÃO] Técnico resolveu a falha mecânica do "${eq.nome}".`);
      }
      await axios.put(`${API_URL}/equipamentos/${eq.id}`, { temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min, umidade_max: eq.umidade_max, motor_ligado: true }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
      return;
    }

    let tempAtual = historicoTemperaturas[eq.id];
    let umidAtual = historicoUmidades[eq.id];
    
    const tMin = parseFloat(eq.temp_min);
    const tMax = parseFloat(eq.temp_max);
    const uMin = parseFloat(eq.umidade_min || 60);
    const uMax = parseFloat(eq.umidade_max || 80);
    
    const tempIdeal = tMin + ((tMax - tMin) / 2);
    const umidIdeal = uMin + ((uMax - uMin) / 2);

    if (tempAtual === undefined) tempAtual = tempIdeal;
    if (umidAtual === undefined) umidAtual = umidIdeal;

    const fatorAquecimento = tMin < 0 ? 1.5 : 0.8; 

    if (!eq.motor_ligado) {
      tempAtual += (Math.random() * fatorAquecimento + 0.2); 
      if (tempAtual > 25) tempAtual = 25; 
      
      umidAtual += (Math.random() * 2.0 + 0.5);
      if (umidAtual > 98) umidAtual = 98; 
      
      if (eq.em_degelo) {
        console.log(`[DEGELO]  ${eq.nome} | Temp: ${tempAtual.toFixed(2)}°C | Hum: ${umidAtual.toFixed(2)}%`);
      } else {
        console.log(`[CRÍTICO] ${eq.nome} | MOTOR PARADO! Temp: ${tempAtual.toFixed(2)}°C | Hum: ${umidAtual.toFixed(2)}%`);
      }
    } else {
      if (tempAtual > tempIdeal) {
        tempAtual -= (Math.random() * (fatorAquecimento * 1.2) + 0.3); 
        umidAtual -= (Math.random() * 2.5 + 0.5); 
      } else {
        tempAtual += (Math.random() * 0.6 - 0.3); 
        umidAtual += (Math.random() * 1.5 - 0.7);
      }
      if (umidAtual < 20) umidAtual = 20; 
      console.log(`[OK]      ${eq.nome} | Temp: ${tempAtual.toFixed(2)}°C | Hum: ${umidAtual.toFixed(2)}%`);
    }

    historicoTemperaturas[eq.id] = tempAtual;
    historicoUmidades[eq.id] = umidAtual;
    
    await axios.post(`${API_URL}/leituras`, { 
        equipamento_id: eq.id, 
        temperatura: tempAtual.toFixed(2),
        umidade: umidAtual.toFixed(2)
    });

  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('[SISTEMA] Token expirado, a reconectar...');
      tokenAtivo = ''; 
    }
  }
}

console.log('=========================================');
console.log('   ROBÔ TERMOMÉTRICO IoT INICIADO        ');
console.log('=========================================');

setInterval(executarSimulacao, 3500);