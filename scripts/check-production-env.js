/**
 * Módulo: scripts/check-production-env.js
 * Responsabilidade: Automatiza a rotina operacional check production env.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, 'backend', '.env');
const fallbackEnvPath = path.join(rootDir, '.env');

/**
 * Executa a etapa parse env usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: lê ou grava arquivos locais
 *
 * @param {unknown} filePath - Valor de file path consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return acc;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      acc[key] = value;
      return acc;
    }, {});
}

const env = { ...parseEnv(fallbackEnvPath), ...parseEnv(envPath), ...process.env };
const problems = [];
const warnings = [];


/**
 * Executa a etapa require value usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} key - Valor de key consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function requireValue(key) {
  if (!env[key]) problems.push(`${key} nao configurado.`);
}


/**
 * Executa a etapa warn value usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} key - Valor de key consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function warnValue(key) {
  if (!env[key]) warnings.push(`${key} nao configurado.`);
}


/**
 * Executa a etapa require not default usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} key - Valor de key consumido por esta rotina.
 * @param {unknown} defaults - Valor de defaults consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function requireNotDefault(key, defaults) {
  requireValue(key);
  if (env[key] && defaults.includes(env[key])) problems.push(`${key} esta usando valor padrao/inseguro.`);
}

requireValue('DB_HOST');
requireValue('DB_USER');
requireValue('DB_NAME');
requireNotDefault('JWT_SECRET', ['troque-por-uma-chave-longa-e-aleatoria', 'chave_super_secreta_termosync_node']);
requireNotDefault('IOT_INGEST_TOKEN', ['troque-por-um-token-longo-para-sensores']);
requireNotDefault('MQTT_PASSWORD', ['troque-por-uma-senha-mqtt-longa']);

if (env.NODE_ENV === 'production') {
  requireValue('CORS_ORIGIN');
  if (env.CORS_ORIGIN === '*') problems.push('CORS_ORIGIN nao pode ser "*" em producao.');
  if (env.ALLOW_RAW_SQL_MUTATION === 'true') problems.push('ALLOW_RAW_SQL_MUTATION deve ficar false em producao.');
  if (env.ALLOW_DESTRUCTIVE_SQL === 'true') problems.push('ALLOW_DESTRUCTIVE_SQL deve ficar false em producao.');
  if (env.ALLOW_WEB_DEPLOY === 'true' && env.REQUIRE_DEPLOY_MFA !== 'true') {
    problems.push('REQUIRE_DEPLOY_MFA deve ficar true quando ALLOW_WEB_DEPLOY estiver habilitado em producao.');
  }
  if (env.ALLOW_WEB_DEPLOY === 'true') warnings.push('Deploy web esta habilitado em producao; prefira a esteira oficial sempre que possivel.');
  if (env.TEXTBELT_ENABLED === 'true' && !env.TEXTBELT_API_KEY) warnings.push('TEXTBELT_ENABLED=true sem TEXTBELT_API_KEY usa modo gratuito limitado.');
}

warnValue('SMTP_USER');
warnValue('SMTP_PASS');
warnValue('BACKUP_DIR');

if (env.AUTO_BACKUP_ENABLED !== 'true') warnings.push('AUTO_BACKUP_ENABLED esta desligado.');
if (!env.TWILIO_ACCOUNT_SID && !env.SMS_WEBHOOK_URL && !env.TEXTBEE_API_KEY && !env.TEXTBELT_API_KEY && env.TEXTBELT_ENABLED !== 'true') {
  warnings.push('Nenhum provedor SMS configurado.');
}

console.log('TermoSync - checagem de ambiente');
console.log(`Arquivo principal: ${fs.existsSync(envPath) ? envPath : fallbackEnvPath}`);

if (warnings.length) {
  console.log('\nAvisos:');
  warnings.forEach((item) => console.log(`- ${item}`));
}

if (problems.length) {
  console.error('\nProblemas bloqueantes:');
  problems.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('\nAmbiente aprovado para verificacoes basicas.');
