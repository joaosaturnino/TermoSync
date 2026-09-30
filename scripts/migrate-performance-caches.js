/**
 * Modulo: scripts/migrate-performance-caches.js
 * Responsabilidade: instala e valida as estruturas derivadas usadas pelas
 * consultas operacionais de alta frequencia.
 *
 * A tabela `leituras` permanece como fonte oficial e historica. O cache criado
 * aqui guarda somente a leitura mais recente de cada equipamento, reduzindo
 * consultas que antes percorriam milhoes de registros para poucas centenas de
 * acessos por chave primaria.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'backend', '.env'), quiet: true });
const mysql = require('mysql2/promise');

const MIGRATION_LOCK = 'termosync:migrate-performance-caches';

/**
 * Confirma que as tabelas de origem existem antes de executar qualquer DDL.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {unknown} connection - Valor de connection consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function assertSourceTables(connection) {
  const [rows] = await connection.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('equipamentos', 'leituras')
  `);

  const existing = new Set(rows.map((row) => row.TABLE_NAME));
  const missing = ['equipamentos', 'leituras'].filter((table) => !existing.has(table));
  if (missing.length > 0) {
    throw new Error(`Tabelas de origem ausentes: ${missing.join(', ')}`);
  }
}

/**
 * Cria o cache sem chaves estrangeiras intencionalmente: rotinas de retencao
 * podem apagar leituras historicas, e uma cascata removeria o estado atual antes
 * de a procedure conseguir selecionar a leitura anterior disponivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {unknown} connection - Valor de connection consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function createCacheTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS equipamento_ultima_leitura (
      equipamento_id INT NOT NULL,
      leitura_id INT NOT NULL,
      temperatura DECIMAL(5,2) NULL,
      umidade DECIMAL(5,2) NULL,
      consumo_kwh DECIMAL(8,2) NULL,
      data_hora TIMESTAMP NULL,
      atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (equipamento_id),
      UNIQUE KEY uk_equipamento_ultima_leitura_id (leitura_id),
      KEY idx_equipamento_ultima_leitura_data (data_hora)
    ) ENGINE=InnoDB
  `);
}

/**
 * Remove apenas indices cujo conjunto e ordem de colunas ja estao cobertos por
 * outro indice da mesma tabela. Isso reduz espaco e trabalho em INSERT/UPDATE
 * sem eliminar caminhos de acesso disponiveis para o otimizador.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {unknown} connection - Valor de connection consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function dropRedundantIndexes(connection) {
  const redundantIndexes = [
    ['chamados', 'idx_chamados_status_data']
  ];

  for (const [tableName, indexName] of redundantIndexes) {
    const [rows] = await connection.query(`
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `, [tableName, indexName]);

    if (rows.length > 0) {
      // Nomes sao constantes definidos acima; nenhum identificador vem de entrada externa.
      await connection.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
    }
  }
}

/**
 * Recria a procedure de reconciliacao. Ela pode ser executada manualmente apos
 * importacoes, restauracoes ou manutencoes que alterem leituras em lote. O
 * upsert somente substitui o cache quando o ID encontrado e mais novo, evitando
 * que uma insercao concorrente seja sobrescrita pelo retrato temporario.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {unknown} connection - Valor de connection consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function createRebuildProcedure(connection) {
  await connection.query('DROP PROCEDURE IF EXISTS sp_reconstruir_ultimas_leituras');
  await connection.query(`
    CREATE PROCEDURE sp_reconstruir_ultimas_leituras()
    BEGIN
      CREATE TEMPORARY TABLE tmp_ultimas_leituras (
        equipamento_id INT NOT NULL PRIMARY KEY,
        leitura_id INT NOT NULL
      ) ENGINE=InnoDB;

      INSERT INTO tmp_ultimas_leituras (equipamento_id, leitura_id)
      SELECT equipamento_id, MAX(id)
      FROM leituras
      WHERE equipamento_id IS NOT NULL
      GROUP BY equipamento_id;

      DELETE cache
      FROM equipamento_ultima_leitura cache
      LEFT JOIN leituras origem
        ON origem.equipamento_id = cache.equipamento_id
      WHERE origem.id IS NULL;

      INSERT INTO equipamento_ultima_leitura (
        equipamento_id,
        leitura_id,
        temperatura,
        umidade,
        consumo_kwh,
        data_hora
      )
      SELECT
        leitura.equipamento_id,
        leitura.id,
        leitura.temperatura,
        leitura.umidade,
        leitura.consumo_kwh,
        leitura.data_hora
      FROM tmp_ultimas_leituras ultima
      INNER JOIN leituras leitura ON leitura.id = ultima.leitura_id
      ON DUPLICATE KEY UPDATE
        temperatura = IF(
          VALUES(leitura_id) >= equipamento_ultima_leitura.leitura_id,
          VALUES(temperatura),
          equipamento_ultima_leitura.temperatura
        ),
        umidade = IF(
          VALUES(leitura_id) >= equipamento_ultima_leitura.leitura_id,
          VALUES(umidade),
          equipamento_ultima_leitura.umidade
        ),
        consumo_kwh = IF(
          VALUES(leitura_id) >= equipamento_ultima_leitura.leitura_id,
          VALUES(consumo_kwh),
          equipamento_ultima_leitura.consumo_kwh
        ),
        data_hora = IF(
          VALUES(leitura_id) >= equipamento_ultima_leitura.leitura_id,
          VALUES(data_hora),
          equipamento_ultima_leitura.data_hora
        ),
        leitura_id = GREATEST(
          equipamento_ultima_leitura.leitura_id,
          VALUES(leitura_id)
        );

      DROP TEMPORARY TABLE tmp_ultimas_leituras;
    END
  `);
}

/**
 * Mantem o cache em tempo constante a cada nova telemetria. A comparacao pelo
 * ID protege contra cargas atrasadas e permite que a procedure rode em paralelo
 * sem regredir o ponteiro da leitura mais recente.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {unknown} connection - Valor de connection consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function createIncrementalTrigger(connection) {
  await connection.query('DROP TRIGGER IF EXISTS tg_cache_ultima_leitura');
  await connection.query(`
    CREATE TRIGGER tg_cache_ultima_leitura
    AFTER INSERT ON leituras
    FOR EACH ROW
    BEGIN
      IF NEW.equipamento_id IS NOT NULL THEN
        INSERT INTO equipamento_ultima_leitura (
          equipamento_id,
          leitura_id,
          temperatura,
          umidade,
          consumo_kwh,
          data_hora
        ) VALUES (
          NEW.equipamento_id,
          NEW.id,
          NEW.temperatura,
          NEW.umidade,
          NEW.consumo_kwh,
          NEW.data_hora
        )
        ON DUPLICATE KEY UPDATE
          temperatura = IF(NEW.id >= leitura_id, NEW.temperatura, temperatura),
          umidade = IF(NEW.id >= leitura_id, NEW.umidade, umidade),
          consumo_kwh = IF(NEW.id >= leitura_id, NEW.consumo_kwh, consumo_kwh),
          data_hora = IF(NEW.id >= leitura_id, NEW.data_hora, data_hora),
          leitura_id = GREATEST(leitura_id, NEW.id);
      END IF;
    END
  `);
}

/**
 * Confere quantidade e ponteiros para impedir uma ativacao silenciosamente parcial.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {unknown} connection - Valor de connection consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function validateCache(connection) {
  const [rows] = await connection.query(`
    SELECT
      (SELECT COUNT(DISTINCT equipamento_id) FROM leituras WHERE equipamento_id IS NOT NULL) AS esperados,
      (SELECT COUNT(*) FROM equipamento_ultima_leitura) AS armazenados,
      (
        SELECT COUNT(*)
        FROM equipamento_ultima_leitura cache
        INNER JOIN (
          SELECT equipamento_id, MAX(id) AS leitura_id
          FROM leituras
          WHERE equipamento_id IS NOT NULL
          GROUP BY equipamento_id
        ) origem ON origem.equipamento_id = cache.equipamento_id
        WHERE origem.leitura_id <> cache.leitura_id
      ) AS divergentes
  `);

  const result = rows[0];
  if (Number(result.esperados) !== Number(result.armazenados) || Number(result.divergentes) !== 0) {
    throw new Error(`Cache inconsistente: ${JSON.stringify(result)}`);
  }
  return result;
}

/**
 * Coordena a migracao com lock nomeado para evitar duas instalacoes simultaneas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  let lockAcquired = false;
  try {
    const [[lock]] = await connection.query('SELECT GET_LOCK(?, 30) AS acquired', [MIGRATION_LOCK]);
    lockAcquired = Number(lock.acquired) === 1;
    if (!lockAcquired) throw new Error('Nao foi possivel obter o lock da migracao em 30 segundos.');

    await assertSourceTables(connection);
    await createCacheTable(connection);
    await dropRedundantIndexes(connection);
    await createRebuildProcedure(connection);
    await createIncrementalTrigger(connection);
    await connection.query('CALL sp_reconstruir_ultimas_leituras()');
    const validation = await validateCache(connection);

    console.log(`Migracao concluida: ${validation.armazenados} equipamentos em cache, sem divergencias.`);
  } finally {
    if (lockAcquired) await connection.query('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK]);
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Migracao de desempenho falhou: ${error.message}`);
  process.exitCode = 1;
});
