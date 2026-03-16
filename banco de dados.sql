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