/**
 * ============================================================================
 * ROBÔ SIMULADOR IoT (DIGITAL TWIN) - TermoSync Enterprise NOC
 * Versão: 7.5 | ANTI-CRASH, CAOS CONTROLADO E FINOPS AVANÇADO (HISTÓRICO)
 * ============================================================================
 */

require('dotenv').config();
const axios = require('axios');
const API_URL = 'http://127.0.0.1:3000/api';
const LOGIN_SIMULADOR = { usuario: 'dev_root', senha: 'rootdev' };

const INTERVALO_TELEMETRIA = 2000; 

const COLORS = {
  reset: "\x1b[0m", bold: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m",
  yellow: "\x1b[33m", red: "\x1b[31m", blue: "\x1b[34m", magenta: "\x1b[35m", gray: "\x1b[90m"
};

let tokenAtivo = '';
let historicoTemperaturas = {}; 
let historicoUmidades = {}; 
let tickCount = 0;
let historicoFinanceiroGerado = false; // Flag para garantir que injetamos histórico apenas 1x

console.log(`${COLORS.magenta}${COLORS.bold}
=========================================================
  [ TermoSync NOC ] - MOTOR DE TELEMETRIA E SAAS ATIVO
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

// 4. MOTOR TERMODINÂMICO
async function simularMaquina(eq) {
  let alertaForcado = null;
  let consumoKwh = 0.1; 
  let motorLigado = eq.motor_ligado ? 1 : 0;
  let emDegelo = eq.em_degelo ? 1 : 0;

  if (motorLigado && !emDegelo && Math.random() < 0.005) { alertaForcado = 'PERDA_EFICIENCIA'; criarChamadoSimulado(eq, 'PERDA_EFICIENCIA'); }
  if (motorLigado && !emDegelo && !alertaForcado && Math.random() < 0.005) { alertaForcado = 'PORTA_ABERTA'; criarChamadoSimulado(eq, 'PORTA_ABERTA'); }
  if (!alertaForcado && Math.random() < 0.005) { alertaForcado = 'REDE'; criarChamadoSimulado(eq, 'REDE'); }
  
  if (motorLigado && !emDegelo && Math.random() < 0.015) { emDegelo = 1; motorLigado = 0; } 
  else if (motorLigado && !emDegelo && !alertaForcado && Math.random() < 0.01) { motorLigado = 0; criarChamadoSimulado(eq, 'MECANICA'); } 
  else if ((!motorLigado || emDegelo) && Math.random() < 0.15) { emDegelo = 0; motorLigado = 1; }

  let tempAtual = historicoTemperaturas[eq.id] || parseFloat(eq.temp_min) + 1;
  const umidMinConfig = parseFloat(eq.umidade_min || 40);
  let umidAtual = historicoUmidades[eq.id] || umidMinConfig + 15; 
  const fator = parseFloat(eq.temp_min) < 0 ? 1.5 : 0.8; 
  const ideal = parseFloat(eq.temp_min) + ((parseFloat(eq.temp_max) - parseFloat(eq.temp_min)) / 2);

  if (emDegelo) { tempAtual += (Math.random() * 0.2 + 0.05); umidAtual += (Math.random() * 1.5); consumoKwh = 2.8; } 
  else if (!motorLigado) { tempAtual += (Math.random() * 0.3 + 0.1); umidAtual += (Math.random() * 0.8); consumoKwh = 0.08; } 
  else {
      if (alertaForcado === 'PORTA_ABERTA') { tempAtual += (Math.random() * 0.4 + 0.1); umidAtual += (Math.random() * 2.5); consumoKwh = 5.8; } 
      else if (alertaForcado === 'PERDA_EFICIENCIA') { tempAtual += (Math.random() * 0.1); consumoKwh = 4.9; } 
      else if (tempAtual > ideal) { tempAtual -= (Math.random() * (fator * 0.25) + 0.05); umidAtual -= (Math.random() * 0.5 + 0.1); consumoKwh = (Math.random() * 0.5) + 1.6; } 
      else { tempAtual += (Math.random() * 0.15 - 0.05); umidAtual += (Math.random() * 0.4 - 0.2); consumoKwh = (Math.random() * 0.3) + 0.6; }
  }

  if (tempAtual > 35) tempAtual = 35; if (tempAtual < -35) tempAtual = -35;
  if (umidAtual > 98) umidAtual = 98; const floorSeguro = umidMinConfig + 2; if (umidAtual < floorSeguro) umidAtual = floorSeguro;

  historicoTemperaturas[eq.id] = tempAtual; historicoUmidades[eq.id] = umidAtual;
  
  let statusColor = tempAtual > eq.temp_max ? COLORS.red : COLORS.cyan;
  console.log(`${COLORS.gray}  ↳ [${eq.filial}] ${eq.nome.padEnd(20)} | ${statusColor}T: ${tempAtual.toFixed(2).padStart(6)}°C${COLORS.gray} | ${COLORS.cyan}U: ${umidAtual.toFixed(1).padStart(5)}%${COLORS.gray} | ${COLORS.yellow}Pwr: ${consumoKwh.toFixed(2).padStart(5)} kW${COLORS.reset}`);

  try {
    await axios.post(`${API_URL}/leituras`, { 
        equipamento_id: eq.id, temperatura: tempAtual.toFixed(2), umidade: umidAtual.toFixed(2), 
        consumo_kwh: consumoKwh.toFixed(2), alerta_forcado: alertaForcado, motor_ligado: motorLigado, em_degelo: emDegelo
    }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
  } catch (e) {}
}

// 5. MÓDULO FINOPS AVANÇADO - GERA HISTÓRICO, FATURAS, PAGAMENTOS E ATRASOS
async function simularFaturamentoSaaS() {
  try {
    console.log(`\n${COLORS.magenta}${COLORS.bold}💸 [FINOPS] Processando motores de faturamento SaaS...${COLORS.reset}`);

    const resLojas = await axios.get(`${API_URL}/lojas`, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    const lojas = Array.isArray(resLojas.data) ? resLojas.data : [];

    // ========================================================================
    // 5.1 GERAR HISTÓRICO (Roda apenas uma vez) para popular gráficos
    // ========================================================================
    if (!historicoFinanceiroGerado && lojas.length > 0) {
      console.log(`${COLORS.gray}  ↳ Populando banco de dados com histórico dos últimos 6 meses...${COLORS.reset}`);
      const hoje = new Date();
      
      for (let i = 5; i >= 1; i--) {
        let dataRef = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        let mes = dataRef.getMonth() + 1;
        let ano = dataRef.getFullYear();
        let vencimento = `${ano}-${mes.toString().padStart(2, '0')}-10`;

        for (let loja of lojas) {
          // 85% de chance de ter pago nos meses anteriores, 15% de chance de calote
          let pagou = Math.random() < 0.85;
          let status = pagou ? 'PAGO' : 'PENDENTE'; // Sendo do passado, PENDENTE será considerado VENCIDA pelo React
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

    // ========================================================================
    // 5.2 LOTE DO MÊS ATUAL (Gera as faturas do ciclo vigente)
    // ========================================================================
    await axios.post(`${API_URL}/financeiro/cobranca-lote`, {}, { headers: { Authorization: `Bearer ${tokenAtivo}` } });

    // ========================================================================
    // 5.3 COMPORTAMENTO DE PAGAMENTO (Quem paga, quem aguarda, quem atrasa)
    // ========================================================================
    for (let loja of lojas) {
      const probabilidade = Math.random();

      if (probabilidade < 0.30) {
        // 30% DE CHANCE: Cliente PAGA a fatura do mês atual na hora
        try {
          await axios.post(`${API_URL}/financeiro/faturas/${encodeURIComponent(loja.nome)}/pagar`, {}, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
          console.log(`${COLORS.green}  ↳ [PAGO] Transferência efetuada pela organização: ${loja.nome}${COLORS.reset}`);
        } catch (err) {}

      } else if (probabilidade < 0.70) {
        // 40% DE CHANCE: Cliente AGUARDA / fatura recém emitida, ainda dentro do prazo
        console.log(`${COLORS.cyan}  ↳ [PENDENTE] A organização ${loja.nome} recebeu a fatura e está dentro do prazo.${COLORS.reset}`);
      
      } else {
        // 30% DE CHANCE: Força INADIMPLÊNCIA gerando uma fatura de mês anterior como "PENDENTE"
        // (O seu frontend identifica que a data já passou e marca como "ATRASADA" ou "VENCIDA")
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
    const equipamentos = Array.isArray(resEquip.data) ? resEquip.data : [];
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

    // A CADA 15 CICLOS (aprox. 30 segundos), CHAMA O MÓDULO FINANCEIRO
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