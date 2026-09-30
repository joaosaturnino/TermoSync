/**
 * Módulo: frontend/src/utils/logger.js
 * Responsabilidade: Centraliza as responsabilidades do módulo logger.
 */

const isProd = process.env.NODE_ENV === 'production';

/**
 * Concentra a logica de info para manter o restante do utilitario mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} args - Valor de args consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function info(...args) {
  if (!isProd) console.info(...args);
}


/**
 * Concentra a logica de warn para manter o restante do utilitario mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: registra informações de diagnóstico
 *
 * @param {unknown} args - Valor de args consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function warn(...args) {
  if (!isProd) console.warn(...args);
}


/**
 * Concentra a logica de error para manter o restante do utilitario mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: registra informações de diagnóstico
 *
 * @param {unknown} args - Valor de args consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function error(...args) {
  // always log errors to console to help debugging even in prod
  console.error(...args);
}

export default { info, warn, error };
