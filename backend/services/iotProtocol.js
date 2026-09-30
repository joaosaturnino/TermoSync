/**
 * Módulo: backend/services/iotProtocol.js
 * Responsabilidade: Encapsula integrações e regras de serviço de iot Protocol.
 */

const crypto = require('crypto');

/**
 * Executa a rotina de servico validar Telemetria e devolve os dados para quem chamou.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function validarTelemetria(payload) {
  const equipamentoId = Number(payload.equipamento_id);
  const temperatura = Number(payload.temperatura);
  const temperaturaValida = payload.temperatura_valida !== false && payload.temperatura_valida !== 0;
  const umidadeDeclaradaValida = payload.umidade_valida !== false && payload.umidade_valida !== 0;
  const umidadeAusente = payload.umidade === undefined || payload.umidade === null || payload.umidade === '';
  const umidade = umidadeAusente ? null : Number(payload.umidade);
  const consumo = payload.consumo_kwh === undefined || payload.consumo_kwh === null || payload.consumo_kwh === ''
    ? 0
    : Number(payload.consumo_kwh);

  if (!Number.isInteger(equipamentoId) || equipamentoId <= 0) throw new Error('equipamento_id inválido.');
  if (!temperaturaValida) throw new Error('temperatura marcada como inválida pelo sensor.');
  if (!Number.isFinite(temperatura) || temperatura < -80 || temperatura > 80) throw new Error('temperatura fora da faixa segura.');
  if (umidadeDeclaradaValida && umidade !== null && (!Number.isFinite(umidade) || umidade < 0 || umidade > 100)) {
    throw new Error('umidade fora da faixa segura.');
  }
  if (!Number.isFinite(consumo) || consumo < 0 || consumo > 100000) throw new Error('consumo_kwh inválido.');

  return { equipamentoId, temperatura, umidade: umidadeDeclaradaValida ? umidade : null, consumo };
}

/**
 * Monta um comando rastreável e com validade curta para impedir replay tardio.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} acao - Valor de acao consumido por esta rotina.
 * @param {unknown} estado - Valor de estado consumido por esta rotina.
 * @param {unknown} camposExtras - Valor de campos extras consumido por esta rotina.
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function montarComandoMqtt(acao, estado, camposExtras = {}, options = {}) {
  const agora = options.agora ?? Math.floor(Date.now() / 1000);
  const commandId = options.commandId ?? crypto.randomUUID();
  return {
    acao,
    estado,
    ...camposExtras,
    command_id: commandId,
    issued_at: agora,
    expires_at: agora + 120
  };
}

module.exports = { montarComandoMqtt, validarTelemetria };
