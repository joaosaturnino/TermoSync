/**
 * Módulo: scripts/setup-firmware-secrets.js
 * Responsabilidade: Automatiza a rotina operacional setup firmware secrets.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', 'backend', '.env');
const outputPath = path.resolve(__dirname, '..', 'backend', 'arduino', 'sensor', 'secrets.h');

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
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).reduce((result, line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) return result;
    result[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    return result;
  }, {});
}


/**
 * Executa a etapa cpp string usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function cppString(value) {
  return JSON.stringify(String(value ?? ''));
}


/**
 * Executa a etapa random secret usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function randomSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

const env = parseEnv(envPath);
if (!env.MQTT_USERNAME || !env.MQTT_PASSWORD) {
  console.error('Configure MQTT_USERNAME e MQTT_PASSWORD em backend/.env antes de gerar secrets.h.');
  process.exit(1);
}
if (fs.existsSync(outputPath) && !process.argv.includes('--force')) {
  console.error('secrets.h já existe. Use --force somente se quiser trocar as credenciais locais.');
  process.exit(1);
}

const mqttUrl = new URL(env.MQTT_URL || 'mqtt://localhost:1883');
const useTls = mqttUrl.protocol === 'mqtts:';
const corsOrigin = String(env.CORS_ORIGIN || '').split(',')[0].trim();
const content = `#pragma once

// Gerado localmente por npm run firmware:setup. Este arquivo não é versionado.
#define TERMOSYNC_MQTT_USER ${cppString(env.MQTT_USERNAME)}
#define TERMOSYNC_MQTT_PASS ${cppString(env.MQTT_PASSWORD)}
#define TERMOSYNC_PORTAL_PASSWORD ${cppString(randomSecret())}
#define TERMOSYNC_OTA_PASSWORD ${cppString(randomSecret())}
#define TERMOSYNC_WEB_USER "tecnico"
#define TERMOSYNC_WEB_PASSWORD ${cppString(randomSecret())}
#define TERMOSYNC_WEB_CORS_ORIGIN ${cppString(corsOrigin)}

#define TERMOSYNC_PHYSICAL_ACTUATOR 0
#define TERMOSYNC_USE_TLS ${useTls ? 1 : 0}
#define TERMOSYNC_MQTT_PORT ${Number(mqttUrl.port || (useTls ? 8883 : 1883))}
#define TERMOSYNC_MQTT_CA_CERT ""
#define TERMOSYNC_REQUIRE_FRESH_COMMANDS 1
`;

fs.writeFileSync(outputPath, content, { encoding: 'utf8', mode: 0o600 });
console.log('secrets.h gerado sem exibir credenciais. Atuador físico permanece desabilitado.');
if (useTls) console.log('MQTT TLS detectado: preencha TERMOSYNC_MQTT_CA_CERT com a CA do broker antes da gravação.');
