-- Registra a versão jurídica aceita no autoatendimento público.
-- Pode ser executado novamente: cada coluna é criada somente quando estiver ausente.
-- Solicitações lançadas manualmente por um desenvolvedor permanecem com ambos
-- os campos nulos, pois o consentimento pode ter sido obtido em outro canal.

USE termosync;

DROP PROCEDURE IF EXISTS ensure_termosync_column;

DELIMITER $$

CREATE PROCEDURE ensure_termosync_column(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_definition VARCHAR(255)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table_name
       AND COLUMN_NAME = p_column_name
  ) THEN
    SET @column_sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'), '` ', p_definition
    );
    PREPARE column_statement FROM @column_sql;
    EXECUTE column_statement;
    DEALLOCATE PREPARE column_statement;
  END IF;
END$$

DELIMITER ;

CALL ensure_termosync_column('pre_cadastros', 'legal_version', 'VARCHAR(20) DEFAULT NULL AFTER `tipo_acesso`');
CALL ensure_termosync_column('pre_cadastros', 'legal_accepted_at', 'DATETIME DEFAULT NULL AFTER `legal_version`');

DROP PROCEDURE ensure_termosync_column;
