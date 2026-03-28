CREATE DATABASE IF NOT EXISTS friomonitor_db;
USE friomonitor_db;

CREATE TABLE equipamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('camara_fria', 'balcao_refrigerado') NOT NULL,
    temp_min DECIMAL(5,2) NOT NULL,
    temp_max DECIMAL(5,2) NOT NULL,
    motor_ligado BOOLEAN DEFAULT TRUE
);

select * from leituras;
select * from equipamentos;

CREATE TABLE leituras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipamento_id INT NOT NULL,
    temperatura DECIMAL(5,2) NOT NULL,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE
);

CREATE TABLE notificacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipamento_id INT NOT NULL,
    mensagem TEXT NOT NULL,
    resolvido BOOLEAN DEFAULT FALSE,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE
);

INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, motor_ligado) 
VALUES ('Câmara de Carnes', 'camara_fria', -18.00, -12.00, TRUE),
       ('Balcão de Laticínios', 'balcao_refrigerado', 2.00, 8.00, TRUE);
       
       USE friomonitor_db;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL
);

ALTER TABLE equipamentos 
ADD COLUMN intervalo_degelo INT DEFAULT 6, 
ADD COLUMN duracao_degelo INT DEFAULT 30, 
ADD COLUMN em_degelo BOOLEAN DEFAULT FALSE;

ALTER TABLE equipamentos MODIFY COLUMN tipo VARCHAR(50);

ALTER TABLE equipamentos ADD COLUMN setor VARCHAR(50) DEFAULT 'Geral';
ALTER TABLE notificacoes ADD COLUMN nota_resolucao VARCHAR(255);

ALTER TABLE equipamentos MODIFY COLUMN tipo VARCHAR(100);

ALTER TABLE equipamentos ADD COLUMN umidade_min DECIMAL(5,2) DEFAULT 40.0;
ALTER TABLE equipamentos ADD COLUMN umidade_max DECIMAL(5,2) DEFAULT 60.0;

ALTER TABLE leituras ADD COLUMN umidade DECIMAL(5,2) DEFAULT 50.0;

ALTER TABLE notificacoes ADD COLUMN tipo_alerta VARCHAR(50) DEFAULT 'GERAL';

CREATE INDEX idx_equip_data ON leituras (equipamento_id, data_hora);

ALTER TABLE equipamentos ADD COLUMN intervalo_degelo INT DEFAULT 6;
ALTER TABLE equipamentos ADD COLUMN duracao_degelo INT DEFAULT 30;

ALTER TABLE equipamentos ADD COLUMN filial VARCHAR(100) DEFAULT 'Loja Principal';

ALTER TABLE notificacoes ADD COLUMN tipo_alerta VARCHAR(50) DEFAULT 'GERAL';

ALTER TABLE usuarios ADD COLUMN role VARCHAR(20) DEFAULT 'ADMIN';
ALTER TABLE usuarios ADD COLUMN filial VARCHAR(100) DEFAULT 'Todas';

ALTER TABLE leituras ADD COLUMN consumo_kwh DECIMAL(10,2) DEFAULT 0.00;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE notificacoes;
TRUNCATE TABLE leituras;
TRUNCATE TABLE equipamentos;
TRUNCATE TABLE usuarios;
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE equipamentos ADD COLUMN data_calibracao DATE DEFAULT;

ALTER TABLE equipamentos ADD COLUMN data_calibracao DATE;

ALTER TABLE leituras ADD COLUMN consumo_kwh DECIMAL(10,2) DEFAULT 0.00;

select * from usuarios;

CREATE TABLE IF NOT EXISTS chamados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipamento_id INT,
  usuario_id INT,
  filial VARCHAR(100),
  descricao TEXT,
  urgencia ENUM('Pendente', 'Baixa', 'Média', 'Alta', 'Crítica') DEFAULT 'Pendente',
  status ENUM('Aberto', 'Em Atendimento', 'Concluído') DEFAULT 'Aberto',
  data_abertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_conclusao TIMESTAMP NULL,
  nota_resolucao TEXT,
  FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE chamados;
TRUNCATE TABLE notificacoes;
TRUNCATE TABLE leituras;
TRUNCATE TABLE equipamentos;
TRUNCATE TABLE usuarios;
SET FOREIGN_KEY_CHECKS = 1;