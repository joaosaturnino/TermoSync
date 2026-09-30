-- TermoSync - indices identificados na auditoria posterior das relacoes.
-- Pode ser executado mais de uma vez: cada indice e criado somente se faltar.

USE termosync;

DROP PROCEDURE IF EXISTS ensure_termosync_index;

DELIMITER $$

CREATE PROCEDURE ensure_termosync_index(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table_name
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table_name
       AND INDEX_NAME = p_index_name
  ) THEN
    SET @index_sql = CONCAT(
      'CREATE INDEX `', REPLACE(p_index_name, '`', '``'),
      '` ON `', REPLACE(p_table_name, '`', '``'), '` (', p_columns, ')'
    );
    PREPARE index_statement FROM @index_sql;
    EXECUTE index_statement;
    DEALLOCATE PREPARE index_statement;
  END IF;
END$$

DELIMITER ;

CALL ensure_termosync_index(
  'scanner_jobs',
  'idx_scanner_jobs_queue',
  '`filial`, `status`, `data_criacao`'
);
CALL ensure_termosync_index(
  'rede_scans',
  'idx_rede_scans_filial_data',
  '`filial`, `data_scan`'
);
CALL ensure_termosync_index(
  'rede_scans',
  'idx_rede_scans_agent_data',
  '`agent_id`, `data_scan`'
);

DROP PROCEDURE ensure_termosync_index;

SELECT TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND INDEX_NAME IN (
     'idx_scanner_jobs_queue',
     'idx_rede_scans_filial_data',
     'idx_rede_scans_agent_data'
   )
 ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
