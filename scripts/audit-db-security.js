/** Audita estruturas de isolamento e desempenho sem alterar dados do banco. */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'backend', '.env'), quiet: true });
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [indexes] = await connection.query(`
      SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND INDEX_NAME IN ('idx_chamados_tenant_fila', 'idx_suporte_tenant_fila')
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY TABLE_NAME
    `);
    const [[legacyRows]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM chamados WHERE empresa IS NULL OR empresa = '') AS chamadosSemEmpresa,
        (SELECT COUNT(*) FROM suporte_chamados WHERE empresa IS NULL OR empresa = '') AS suporteSemEmpresa,
        (SELECT COUNT(*) FROM operacao_tarefas WHERE empresa IS NULL OR empresa = '') AS tarefasSemEmpresa
    `);

    const expectedIndexes = new Set(['idx_chamados_tenant_fila', 'idx_suporte_tenant_fila']);
    const missingIndexes = [...expectedIndexes].filter(
      (indexName) => !indexes.some((index) => index.indexName === indexName)
    );
    const result = { indexes, missingIndexes, legacyRows };
    console.log(JSON.stringify(result, null, 2));
    if (missingIndexes.length > 0) process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Auditoria do banco falhou: ${error.message}`);
  process.exit(1);
});
