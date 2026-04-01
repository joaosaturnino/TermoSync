/**
 * Robô IoT Simulador (Enterprise Edition - Corrigido)
 * Lógica de Humidade ajustada para evitar alertas falsos de "Fora de Parâmetro".
 */

const axios = require('axios');
const API_URL = 'http://127.0.0.1:3000/api';

const LOGIN_SIMULADOR = { usuario: 'admin_master', senha: '123456' };

let tokenAtivo = '';
let historicoTemperaturas = {}; 
let historicoUmidades = {}; 

async function autenticar() {
  try {
    console.log(`⏳ A tentar autenticação com a credencial: ${LOGIN_SIMULADOR.usuario}...`);
    const res = await axios.post(`${API_URL}/login`, LOGIN_SIMULADOR);
    tokenAtivo = res.data.token;
    console.log(`✅ [SISTEMA] Simulador IoT Ligado com sucesso! (Logado como Master)\n`);
    return true;
  } catch (error) {
    console.error('❌ [ERRO] Falha ao fazer login. O servidor backend está ligado? Nova tentativa em 5 segundos...');
    return false;
  }
}

async function criarChamadoSimulado(eq, tipoFalha) {
  const falhas = {
    'MECANICA': 'URGENTE: O compressor parou inesperadamente e a máquina não reage aos comandos remotos.',
    'PERDA_EFICIENCIA': 'Aviso de Preditiva: A máquina está a consumir demasiada energia para manter o setpoint térmico. Possível fuga de gás.',
    'PORTA_ABERTA': 'ALERTA: A porta da câmara frigorífica encontra-se aberta ou mal vedada, causando perda térmica rápida.',
    'REDE': 'TI / INFRAESTRUTURA: O sensor IoT perdeu o sinal Wi-Fi ou encontra-se desligado da energia. Verificar Gateway.',
    'METROLOGIA': 'QUALIDADE: O sensor térmico apresenta um desvio de leitura (necessita recalibração).',
    'GENERICO': 'Manutenção de Rotina: Ruído anómalo detetado na ventoinha do evaporador pelos sensores acústicos.'
  };

  const desc = falhas[tipoFalha] || falhas['GENERICO'];
  const tecnicos = ['Roberto Almeida', 'Fernando Costa', '']; 
  const tecSorteado = tecnicos[Math.floor(Math.random() * tecnicos.length)];

  try {
    await axios.post(`${API_URL}/chamados`, {
      equipamento_id: eq.id,
      descricao: `[IA PREDITIVA] ${desc}`,
      solicitante_nome: 'Robô de Diagnóstico Automático',
      tecnico_responsavel: tecSorteado
    }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    
    console.log(`\n🚨 [NOVO CHAMADO] -> Loja: ${eq.filial} | Máquina: ${eq.nome}`);
    console.log(`   🛠️ Técnico Acionado: ${tecSorteado || 'Equipa Geral'}`);
    console.log(`   📝 Motivo: ${desc}\n`);
    
  } catch (e) {
    console.error('Erro ao gerar a Ordem de Serviço:', e.message);
  }
}

async function gerirChamadosPendentes() {
  try {
    const res = await axios.get(`${API_URL}/chamados`, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    const chamados = res.data;
    const pendentes = chamados.filter(c => c.status !== 'Concluído');

    for (let c of pendentes) {
      if (c.urgencia === 'Pendente') {
        let urgenciaCalculada = 'Baixa';
        if (c.descricao.includes('URGENTE') || c.descricao.includes('parou')) urgenciaCalculada = 'Crítica';
        else if (c.descricao.includes('Preditiva') || c.descricao.includes('energia')) urgenciaCalculada = 'Alta';
        else if (c.descricao.includes('ALERTA') || c.descricao.includes('porta') || c.descricao.includes('TI')) urgenciaCalculada = 'Média';
        else if (c.descricao.includes('Rotina') || c.descricao.includes('QUALIDADE')) urgenciaCalculada = 'Baixa';

        await axios.put(`${API_URL}/chamados/${c.id}/urgencia`, 
          { urgencia: urgenciaCalculada }, 
          { headers: { Authorization: `Bearer ${tokenAtivo}` } }
        );
      } 
      else if (Math.random() < 0.20) {
          const solucoes = [
            "Compressor substituído e sistema de gás purgado com sucesso.",
            "Detetada fuga de gás na tubagem. Solda efetuada e carga reposta.",
            "Borracha da porta substituída e fecho magnético realinhado.",
            "Sensor reiniciado e reconectado à rede Wi-Fi da loja.",
            "Auditoria metrológica realizada. Sensor devidamente calibrado.",
            "Substituição preventiva das borrachas de vedação e ventoinha lubrificada."
          ];
          const solucaoSorteada = solucoes[Math.floor(Math.random() * solucoes.length)];

          await axios.put(`${API_URL}/chamados/${c.id}/status`, { 
            status: 'Concluído', 
            nota_resolucao: `[Técnico Virtual] ${solucaoSorteada}` 
          }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });

          console.log(`✅ [OS CONCLUÍDA] -> OS #${c.id} Resolvida.`);
      }
    }
  } catch (error) {
    console.error('Erro ao gerir os chamados automáticos:', error.message);
  }
}

async function simularMaquina(eq) {
  let alertaForcado = null;
  let consumoKwh = 0.1; 
  let motorLigado = eq.motor_ligado ? 1 : 0;
  let emDegelo = eq.em_degelo ? 1 : 0;

  if (motorLigado && !emDegelo && Math.random() < 0.005) { 
      alertaForcado = 'PERDA_EFICIENCIA'; consumoKwh = 3.8; criarChamadoSimulado(eq, 'PERDA_EFICIENCIA'); 
  }
  if (motorLigado && !emDegelo && !alertaForcado && Math.random() < 0.005) { 
      alertaForcado = 'PORTA_ABERTA'; consumoKwh = 4.5; criarChamadoSimulado(eq, 'PORTA_ABERTA'); 
  }
  if (!alertaForcado && Math.random() < 0.003) { alertaForcado = 'REDE'; if (Math.random() < 0.2) criarChamadoSimulado(eq, 'REDE'); }
  if (!alertaForcado && Math.random() < 0.003) { alertaForcado = 'METROLOGIA'; criarChamadoSimulado(eq, 'METROLOGIA'); }

  if (motorLigado && !emDegelo && Math.random() < 0.01) {
    emDegelo = 1; motorLigado = 0; console.log(`❄️ [AÇÃO] Degelo em: ${eq.nome}`);
  } else if (motorLigado && !emDegelo && !alertaForcado && Math.random() < 0.01) {
    motorLigado = 0; criarChamadoSimulado(eq, 'MECANICA'); 
  } else if ((!motorLigado || emDegelo) && Math.random() < 0.08) {
    emDegelo = 0; motorLigado = 1; 
  }

  // --- CÁLCULO TÉRMICO E DE HUMIDADE CORRIGIDO ---
  let tempAtual = historicoTemperaturas[eq.id] || parseFloat(eq.temp_min) + 1;
  
  // Ajuste: Humidade inicial baseada no mínimo configurado para evitar alertas imediatos
  const umidMinConfig = parseFloat(eq.umidade_min || 40);
  let umidAtual = historicoUmidades[eq.id] || umidMinConfig + 15; 
  
  const fator = parseFloat(eq.temp_min) < 0 ? 1.5 : 0.8; 

  if (emDegelo) { 
      tempAtual += (Math.random() * 0.5 + 0.1); 
      umidAtual += (Math.random() * 1.5); // Sobe no degelo
      consumoKwh = 2.5; 
  } else if (!motorLigado) { 
      tempAtual += (Math.random() * 0.4 + 0.1); 
      umidAtual += (Math.random() * 0.5);
      consumoKwh = 0.05; 
  } else {
      const ideal = parseFloat(eq.temp_min) + ((parseFloat(eq.temp_max) - parseFloat(eq.temp_min)) / 2);
      if (alertaForcado === 'PORTA_ABERTA') { 
          tempAtual += 1.5; umidAtual += 5; 
      } else if (tempAtual > ideal) { 
          // Correção: Reduzida a velocidade de queda da humidade (era até 3.0, agora é 1.0)
          tempAtual -= (Math.random() * (fator * 1.2) + 0.1); 
          umidAtual -= (Math.random() * 0.8 + 0.2); 
          consumoKwh = (Math.random() * 0.4) + 1.4; 
      } else { 
          tempAtual += (Math.random() * 0.6 - 0.2); 
          umidAtual += (Math.random() * 1.0 - 0.4); 
          consumoKwh = (Math.random() * 0.2) + 0.5; 
      }
  }

  // --- TRAVAS DE SEGURANÇA (SAFE ZONES) ---
  if (tempAtual > 30) tempAtual = 30; 
  if (umidAtual > 95) umidAtual = 95; 

  // Correção Crítica: O "chão" da humidade agora é dinâmico 
  // e fica sempre 5% acima do alerta do frontend
  const floorSeguro = umidMinConfig + 5;
  if (umidAtual < floorSeguro) umidAtual = floorSeguro;

  historicoTemperaturas[eq.id] = tempAtual; 
  historicoUmidades[eq.id] = umidAtual;
  
  try {
    await axios.post(`${API_URL}/leituras`, { 
        equipamento_id: eq.id, temperatura: tempAtual.toFixed(2), umidade: umidAtual.toFixed(2), 
        consumo_kwh: consumoKwh.toFixed(2), alerta_forçado: alertaForcado, motor_ligado: motorLigado, em_degelo: emDegelo
    }, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
  } catch (e) {}
}

async function executarSimulacao() {
  if (!tokenAtivo) { const sucesso = await autenticar(); if (!sucesso) return; }
  try {
    const resEquip = await axios.get(`${API_URL}/equipamentos`, { headers: { Authorization: `Bearer ${tokenAtivo}` } });
    const equipamentos = resEquip.data;
    const TAMANHO_LOTE = 15;
    for (let i = 0; i < equipamentos.length; i += TAMANHO_LOTE) {
      const lote = equipamentos.slice(i, i + TAMANHO_LOTE);
      await Promise.all(lote.map(eq => simularMaquina(eq)));
    }
    await gerirChamadosPendentes();
  } catch (error) { if (error.response?.status === 401) tokenAtivo = ''; }
}

async function iniciarLoopSeguro() {
  await executarSimulacao();
  setTimeout(iniciarLoopSeguro, tokenAtivo ? 15000 : 5000);
}

iniciarLoopSeguro();