/**
 * Módulo: scripts/migrate-iot-schema.js
 * Responsabilidade: Automatiza a rotina operacional migrate iot schema.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'backend', '.env') });
const mysql = require('mysql2/promise');

/**
 * Executa a etapa main usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: registra informações de diagnóstico
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

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS telemetria_ingestao (
        leitura_uid VARCHAR(96) NOT NULL PRIMARY KEY,
        equipamento_id INT NOT NULL,
        recebida_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_telemetria_ingestao_equipamento (equipamento_id, recebida_em),
        CONSTRAINT telemetria_ingestao_ibfk_1
          FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'telemetria_ingestao'
        AND REFERENCED_TABLE_NAME = 'equipamentos'
      LIMIT 1
    `);
    if (constraints.length === 0) {
      await connection.execute(`
        ALTER TABLE telemetria_ingestao
        ADD CONSTRAINT telemetria_ingestao_ibfk_1
        FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE
      `);
    }
    console.log('Migração IoT concluída: telemetria_ingestao está pronta.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Migração IoT falhou: ${error.message}`);
  process.exitCode = 1;
});
