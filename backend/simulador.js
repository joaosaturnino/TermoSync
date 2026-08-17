/**
 * ============================================================================
 * ROBÔ SIMULADOR IoT (DIGITAL TWIN) - TermoSync Enterprise NOC
 * Versão: 8.5 | MODO HÍBRIDO (VIGIA FÍSICO + SIMULADOR VIRTUAL)
 * ============================================================================
 */

require('dotenv').config();
const axios = require('axios');
const API_URL = 'http://127.0.0.1:3000/api';
const LOGIN_SIMULADOR = { usuario: 'dev_root', senha: 'rootdev' };

const INTERVALO_TELEMETRIA = 2000; 

// 🛑 COLOQUE AQUI OS IDs DAS SUAS MÁQUINAS REAIS (Placas ESP32)
// O robô vai apenas LER o banco para elas, sem injetar dados falsos.
const IDS_FISICOS = [1]; // <-- Ajustado para apenas 1 máquina física!

const COLORS = {
  reset: "\x1b[0m", bold: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m",
  yellow: "\x1b[33m", red: "\x1b[31m", blue: "\x1b[34m", magenta: "\x1b[35m", gray: "\x1b[90m"
};

let tokenAtivo = '';
let historicoTemperaturas = {}; 
let historicoUmidades = {}; 
let tickCount = 0;
let historicoFinanceiroGerado = false;

console.log(`${COLORS.magenta}${COLORS.bold}
=========================================================
  [ TermoSync NOC ] - MOTOR HÍBRIDO IoT & SAAS ATIVO
=========================================================${COLORS.reset}`);

// 1. LOGIN BLINDADO
async function autenticar() {
  try {
    process.stdout.write(`${COLORS.yellow}⏳ Estabelecendo handshake seguro [${LOGIN_SIMULADOR.usuario}]... ${COLORS.reset}`);
    const res = await axios.post(`${API_URL}/login`, LOGIN_SIMULADOR);
    tokenAtivo = res.data.token;
    console.log(`${COLORS.green}✅ OK! Acesso Concedido.${COLORS.reset}\n`);
    return true;
  } catch (error) {
    console.log(`${COLORS.red}❌ FALHA! Servidor offline. Nova tentativa em 5s...${COLORS.reset}`);
    return false;
  }
}

// 2. GERA CHAMADOS (ANOMALIAS FÍSICAS REAIS)
async function criarChamadoSimulado(eq, tipoFalha) {
  const falhas = {
    'MECANICA': 'URGENTE: O compressor parou inesperadamente e a máquina perdeu pressão de fluido refrigerante.',
    'PERDA_EFICIENCIA': 'Aviso de IA Preditiva: A máquina está consumindo muita energia para manter a temperatura. Vazamento de gás provável.',
    'PORTA_ABERTA': 'ALERTA: A porta da câmara frigorífica encontra-se aberta ou com a vedação comprometida.',
    'REDE': 'TI / INFRA: O sensor IoT perdeu o sinal de rede e está operando na memória local.',
    'METROLOGIA': 'QUALIDADE: O sensor térmico apresenta um desvio de leitura (necessita de recalibração urgente).'
  };
  const desc = falhas[tipoFalha] || 'Manutenção Preventiva Requisitada pelo Sistema Autônomo.';
  
  try {
    await axios.post(`${API_URL}/chamados`, {
      equipamento_id: eq.id,
      descricao: `[DIAGNÓSTICO AUTÔNOMO] ${desc}`,
      solicitante_nome: 'Robô TermoSync',
      tecnico_responsavel: null
    }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    
    console.log(`\n${COLORS.red}${COLORS.bold}🚨 [INCIDENTE DETECTADO] -> ${eq.filial} | ${eq.nome}${COLORS.reset}`);
  } catch (e) {}
}

// 3. TÉCNICO VIRTUAL (RESOLVE OS CHAMADOS)
async function gerirChamadosPendentes() {
  try {
    const res = await axios.get(`${API_URL}/chamados`, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    const dados = Array.isArray(res.data) ? res.data : [];
    const chamados = dados.filter(c => c.status !== 'Concluído');

    for (let c of chamados) {
      if (c.urgencia === 'Pendente') {
        let urgenciaCalculada = 'Baixa';
        if (c.descricao.includes('URGENTE') || c.descricao.includes('parou')) urgenciaCalculada = 'Crítica';
        else if (c.descricao.includes('Preditiva') || c.descricao.includes('energia')) urgenciaCalculada = 'Alta';
        else if (c.descricao.includes('ALERTA') || c.descricao.includes('TI')) urgenciaCalculada = 'Média';
        await axios.put(`${API_URL}/chamados/${c.id}/urgencia`, { urgencia: urgenciaCalculada }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
      } 
      else if (Math.random() < 0.20) {
          const solucoes = [
            "Compressor substituído, vácuo realizado e sistema de gás purgado com sucesso.",
            "Detectado microvazamento de gás. Solda efetuada.",
            "Borracha da porta substituída e fecho magnético ajustado.",
            "Módulo ESP32 reiniciado.",
            "Sensor calibrado e limpo."
          ];
          const solucaoSorteada = solucoes[Math.floor(Math.random() * solucoes.length)];

          await axios.put(`${API_URL}/chamados/${c.id}/status`, { 
            status: 'Concluído', 
            nota_resolucao: `[Auto-Fix IA] ${solucaoSorteada}`,
            arquivado: false 
          }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });

          console.log(`${COLORS.green}✅ [OS RESOLVIDA] Ordem de Serviço #${c.id} resolvida pela IA (Aguardando arquivamento manual).${COLORS.reset}`);
      }
    }
  } catch (error) {}
}

// 4. MOTOR TERMODINÂMICO & VIGIA FÍSICO
async function simularMaquina(eq) {
  
  // ========================================================================
  // 🛑 MODO OBSERVADOR (APENAS PARA MÁQUINAS REAIS - ESP32)
  // ========================================================================
  if (IDS_FISICOS.includes(eq.id)) {
      let tempReal = parseFloat(eq.ultima_temp) || 0.0;
      let umidReal = parseFloat(eq.ultima_umidade) || 0.0;
      let motorReal = eq.motor_ligado ? 1 : 0;
      let degeloReal = eq.em_degelo ? 1 : 0;

      // A Regra de Ouro aplicada ao hardware real
      if (!motorReal && !degeloReal && tempReal > parseFloat(eq.temp_max) + 1.0) {
          if (Math.random() < 0.1) criarChamadoSimulado(eq, 'MECANICA');
      }

      let statusColor = tempReal > eq.temp_max ? COLORS.red : COLORS.green;
      console.log(`${COLORS.bold}${COLORS.green}  ↳ [FÍSICA] ${eq.filial.substring(0,8).padEnd(8)} | ${eq.nome.padEnd(17)} | ${statusColor}T: ${tempReal.toFixed(2).padStart(6)}°C${COLORS.reset} | ${COLORS.cyan}U: ${umidReal.toFixed(1)}%${COLORS.reset} | Pwr: -- kW`);
      
      return; // Para a execução aqui! NÃO envia leituras falsas para o BD.
  }

  // ========================================================================
  // ⚙️ MODO SIMULAÇÃO (PARA MÁQUINAS VIRTUAIS)
  // ========================================================================
  let alertaForcado = null;
  let consumoKwh = 0.1; 
  let motorLigado = eq.motor_ligado ? 1 : 0;
  let emDegelo = eq.em_degelo ? 1 : 0;

  let tempAtual = historicoTemperaturas[eq.id] || parseFloat(eq.temp_min) + 1;
  const umidMinConfig = parseFloat(eq.umidade_min || 40);
  let umidAtual = historicoUmidades[eq.id] || umidMinConfig + 15; 
  const ideal = parseFloat(eq.temp_min) + ((parseFloat(eq.temp_max) - parseFloat(eq.temp_min)) / 2);

  if (motorLigado && !emDegelo && Math.random() < 0.005) { alertaForcado = 'PORTA_ABERTA'; criarChamadoSimulado(eq, 'PORTA_ABERTA'); }
  if (motorLigado && !emDegelo && Math.random() < 0.015) { emDegelo = 1; motorLigado = 0; } 
  else if (emDegelo && Math.random() < 0.15) { emDegelo = 0; motorLigado = 1; }

  // A MÁQUINA VIRTUAL QUEBRA
  if (motorLigado && !emDegelo && !alertaForcado && Math.random() < 0.005) { motorLigado = 0; } 
  
  // A Regra de Ouro aplicada ao robô virtual
  if (!motorLigado && !emDegelo) {
      if (tempAtual > parseFloat(eq.temp_max) + 1.0) {
          alertaForcado = 'MECANICA';
          if (Math.random() < 0.1) criarChamadoSimulado(eq, 'MECANICA');
      } else if (tempAtual > ideal && Math.random() < 0.05) {
          motorLigado = 1; // Auto-conserto virtual antes de esquentar demais
      }
  }

  // Dinâmica de Temperatura Física (O Cálculo do Calor Virtual)
  if (emDegelo) { 
      tempAtual += (Math.random() * 0.2 + 0.05); umidAtual += (Math.random() * 1.5); consumoKwh = 2.8; 
  } else if (!motorLigado) { 
      tempAtual += (Math.random() * 0.3 + 0.1); umidAtual += (Math.random() * 0.8); consumoKwh = 0.08; 
  } else {
      if (alertaForcado === 'PORTA_ABERTA') { 
          tempAtual += (Math.random() * 0.4 + 0.1); umidAtual += (Math.random() * 2.5); consumoKwh = 5.8; 
      } else if (tempAtual > ideal) { 
          tempAtual -= (Math.random() * 0.25 + 0.05); umidAtual -= (Math.random() * 0.5 + 0.1); consumoKwh = (Math.random() * 0.5) + 1.6; 
      } else { 
          tempAtual += (Math.random() * 0.15 - 0.05); umidAtual += (Math.random() * 0.4 - 0.2); consumoKwh = (Math.random() * 0.3) + 0.6; 
      }
  }

  if (tempAtual > 35) tempAtual = 35; if (tempAtual < -35) tempAtual = -35;
  if (umidAtual > 98) umidAtual = 98; const floorSeguro = umidMinConfig + 2; if (umidAtual < floorSeguro) umidAtual = floorSeguro;

  historicoTemperaturas[eq.id] = tempAtual; historicoUmidades[eq.id] = umidAtual;
  
  let statusColor = tempAtual > eq.temp_max ? COLORS.red : COLORS.cyan;
  console.log(`${COLORS.gray}  ↳ [VIRTUAL] ${eq.filial.substring(0,8).padEnd(8)} | ${eq.nome.padEnd(17)} | ${statusColor}T: ${tempAtual.toFixed(2).padStart(6)}°C${COLORS.gray} | ${COLORS.cyan}U: ${umidAtual.toFixed(1).padStart(5)}%${COLORS.gray} | ${COLORS.yellow}Pwr: ${consumoKwh.toFixed(2).padStart(5)} kW${COLORS.reset}`);

  // Injeta os dados da máquina virtual na API
  try {
    await axios.post(`${API_URL}/leituras`, { 
        equipamento_id: eq.id, temperatura: tempAtual.toFixed(2), umidade: umidAtual.toFixed(2), 
        consumo_kwh: consumoKwh.toFixed(2), alerta_forcado: alertaForcado, motor_ligado: motorLigado, em_degelo: emDegelo
    }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
  } catch (e) {}
}

// 5. MÓDULO FINOPS AVANÇADO
async function simularFaturamentoSaaS() {
  try {
    console.log(`\n${COLORS.magenta}${COLORS.bold}💸 [FINOPS] Processando motores de faturamento SaaS...${COLORS.reset}`);

    const resLojas = await axios.get(`${API_URL}/lojas`, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    const lojas = Array.isArray(resLojas.data) ? resLojas.data : [];

    if (!historicoFinanceiroGerado && lojas.length > 0) {
      console.log(`${COLORS.gray}  ↳ Populando banco de dados com histórico dos últimos 6 meses...${COLORS.reset}`);
      const hoje = new Date();
      
      for (let i = 5; i >= 1; i--) {
        let dataRef = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        let mes = dataRef.getMonth() + 1;
        let ano = dataRef.getFullYear();
        let vencimento = `${ano}-${mes.toString().padStart(2, '0')}-10`;

        for (let loja of lojas) {
          let pagou = Math.random() < 0.85;
          let status = pagou ? 'PAGO' : 'PENDENTE'; 
          let dataPgto = pagou ? `'${ano}-${mes.toString().padStart(2, '0')}-12 14:00:00'` : 'NULL';

          let sql = `
            INSERT IGNORE INTO faturas_saas 
            (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status, data_pagamento) 
            VALUES ('${loja.nome}', 'PRO', 299.90, 299.90, '${vencimento}', ${mes}, ${ano}, '${status}', ${dataPgto})
          `;
          await axios.post(`${API_URL}/system/query-raw`, { sql }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
        }
      }
      historicoFinanceiroGerado = true;
      console.log(`${COLORS.green}  ↳ Histórico de faturamento gerado com sucesso! Gráficos alimentados.${COLORS.reset}`);
    }

    await axios.post(`${API_URL}/financeiro/cobranca-lote`, {}, { headers: { Authorization: `Bearer ${tokenAtivo}` } });

    for (let loja of lojas) {
      const probabilidade = Math.random();

      if (probabilidade < 0.30) {
        try {
          await axios.post(`${API_URL}/financeiro/faturas/${encodeURIComponent(loja.nome)}/pagar`, {}, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
          console.log(`${COLORS.green}  ↳ [PAGO] Transferência efetuada pela organização: ${loja.nome}${COLORS.reset}`);
        } catch (err) {}

      } else if (probabilidade < 0.70) {
        console.log(`${COLORS.cyan}  ↳ [PENDENTE] A organização ${loja.nome} recebeu a fatura e está dentro do prazo.${COLORS.reset}`);
      
      } else {
        let dataAtraso = new Date();
        dataAtraso.setMonth(dataAtraso.getMonth() - 1);
        let mesAtraso = dataAtraso.getMonth() + 1;
        let anoAtraso = dataAtraso.getFullYear();
        let vencAtraso = `${anoAtraso}-${mesAtraso.toString().padStart(2, '0')}-10`;

        let sqlInadimplente = `
            INSERT IGNORE INTO faturas_saas 
            (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status, data_pagamento) 
            VALUES ('${loja.nome}', 'PRO', 299.90, 299.90, '${vencAtraso}', ${mesAtraso}, ${anoAtraso}, 'PENDENTE', NULL)
        `;
        await axios.post(`${API_URL}/system/query-raw`, { sql: sqlInadimplente }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
        console.log(`${COLORS.yellow}  ↳ [INADIMPLENTE] Fatura em atraso mantida/injetada para: ${loja.nome}${COLORS.reset}`);
      }
    }
  } catch (error) {
    console.log(`${COLORS.red}❌ [FINOPS ERROR] Falha ao executar simulador de faturamento: ${error.message}${COLORS.reset}`);
  }
}

// 6. LOOP BATCH PRINCIPAL
async function executarSimulacao() {
  if (!tokenAtivo) { const sucesso = await autenticar(); if (!sucesso) return; }
  try {
    const resEquip = await axios.get(`${API_URL}/equipamentos`, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    let equipamentos = Array.isArray(resEquip.data) ? resEquip.data : [];
    
    if(equipamentos.length === 0) return;

    tickCount++;
    console.log(`\n${COLORS.blue}${COLORS.bold}[CYCLE #${tickCount}] ⚡ DATA STREAM ACTIVE${COLORS.reset}`);
    
    const TAMANHO_LOTE = 10;
    for (let i = 0; i < equipamentos.length; i += TAMANHO_LOTE) {
      await Promise.all(equipamentos.slice(i, i + TAMANHO_LOTE).map(eq => simularMaquina(eq)));
      await new Promise(r => setTimeout(r, 50));
    }
    
    if(tickCount % 20 === 0) console.clear();
    await gerirChamadosPendentes();

    if (tickCount % 15 === 0) {
      await simularFaturamentoSaaS();
    }

  } catch (error) { if (error.response?.status === 401) tokenAtivo = ''; }
}

async function iniciarLoopSeguro() {
  await executarSimulacao();
  setTimeout(iniciarLoopSeguro, tokenAtivo ? INTERVALO_TELEMETRIA : 60000);
}

iniciarLoopSeguro();