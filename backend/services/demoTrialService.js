/**
 * Provisiona e atualiza tenants de demonstração sem depender de hardware físico.
 * Todos os registros usam a empresa e a filial do trial, preservando o isolamento
 * multi-tenant aplicado pelas rotas operacionais.
 */

const DEMO_EQUIPMENT_TEMPLATES = [
  { nome: 'Câmara de Congelados', tipo: 'Câmara de Congelamento', setor: 'Congelados', tempMin: -22, tempMax: -15, humidityMin: 55, humidityMax: 75, baseTemp: -18.4, baseHumidity: 64, baseConsumption: 2.8 },
  { nome: 'Balcão de Laticínios', tipo: 'Balcão de Laticínios', setor: 'Laticínios', tempMin: 1, tempMax: 7, humidityMin: 60, humidityMax: 82, baseTemp: 4.1, baseHumidity: 71, baseConsumption: 1.35 },
  { nome: 'Expositor de Bebidas', tipo: 'Cervejeira / Bebidas', setor: 'Bebidas', tempMin: 2, tempMax: 9, humidityMin: 55, humidityMax: 80, baseTemp: 5.6, baseHumidity: 67, baseConsumption: 1.05 },
  { nome: 'Câmara de Resfriados', tipo: 'Câmara Fria (Resfriados Gerais)', setor: 'Frios', tempMin: 0, tempMax: 6, humidityMin: 60, humidityMax: 85, baseTemp: 3.2, baseHumidity: 74, baseConsumption: 2.15 }
];

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Gera uma leitura estável e variável a partir do equipamento e do instante. */
function buildDemoReading(equipment, at = new Date()) {
  const timestamp = new Date(at).getTime();
  const phase = (timestamp / 60000 + Number(equipment.id || 0) * 13) / 9;
  const cycle = Math.sin(phase);
  const secondaryCycle = Math.cos(phase / 2.7);
  const baseTemp = Number(equipment.demo_base_temp ?? equipment.baseTemp ?? 4);
  const baseHumidity = Number(equipment.demo_base_humidity ?? equipment.baseHumidity ?? 68);
  const baseConsumption = Number(equipment.demo_base_consumption ?? equipment.baseConsumption ?? 1.2);

  return {
    temperatura: round(baseTemp + cycle * 0.9 + secondaryCycle * 0.25),
    umidade: round(baseHumidity + secondaryCycle * 3.2 + cycle * 1.1),
    consumoKwh: round(Math.max(0.1, baseConsumption + cycle * 0.16)),
    dataHora: new Date(at)
  };
}

/**
 * Cria os ativos virtuais e um histórico de 48 horas dentro da transação de
 * onboarding. A função é idempotente para uma filial que já tenha ativos demo.
 */
async function provisionDemoTenantData(connection, { empresa, filial }) {
  const [existing] = await connection.execute(
    'SELECT id FROM equipamentos WHERE empresa = ? AND filial = ? AND is_virtual = TRUE LIMIT 1',
    [empresa, filial]
  );
  if (existing.length) return { equipmentCount: 0, readingCount: 0 };

  let readingCount = 0;
  const equipmentIds = [];

  for (const template of DEMO_EQUIPMENT_TEMPLATES) {
    const [result] = await connection.execute(
      `INSERT INTO equipamentos
        (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, motor_ligado,
         intervalo_degelo, duracao_degelo, em_degelo, setor, filial, data_calibracao,
         empresa, is_virtual, demo_base_temp, demo_base_humidity, demo_base_consumption)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, 6, 30, FALSE, ?, ?, CURDATE(), ?, TRUE, ?, ?, ?)`,
      [template.nome, template.tipo, template.tempMin, template.tempMax, template.humidityMin, template.humidityMax, template.setor, filial, empresa, template.baseTemp, template.baseHumidity, template.baseConsumption]
    );
    const equipmentId = Number(result.insertId);
    equipmentIds.push(equipmentId);

    await connection.execute(
      `INSERT INTO hardware_iot
        (equipamento_id, mac_address, ip_local, sinal_wifi, uptime, firmware_version, ultima_comunicacao)
       VALUES (?, ?, '127.0.0.1', -48, 'DEMO', 'demo-1.0', NOW())
       ON DUPLICATE KEY UPDATE mac_address = VALUES(mac_address), ip_local = VALUES(ip_local),
         sinal_wifi = VALUES(sinal_wifi), uptime = VALUES(uptime),
         firmware_version = VALUES(firmware_version), ultima_comunicacao = VALUES(ultima_comunicacao)`,
      [equipmentId, `DE:AD:${equipmentId.toString(16).toUpperCase().padStart(2, '0').slice(-2)}:00:00:01`]
    );

    const historyRows = [];
    for (let point = 96; point >= 0; point -= 1) {
      const at = new Date(Date.now() - point * 30 * 60 * 1000);
      const reading = buildDemoReading({ ...template, id: equipmentId }, at);
      historyRows.push([equipmentId, reading.temperatura, reading.umidade, reading.consumoKwh, reading.dataHora]);
      readingCount += 1;
    }
    await connection.query(
      'INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh, data_hora) VALUES ?',
      [historyRows]
    );
  }

  const demoAlerts = [
    [equipmentIds[1], 'Temperatura acima da faixa por abertura prolongada da porta (demonstração).', 'TEMPERATURA', 18],
    [equipmentIds[2], 'Porta permaneceu aberta além do tempo recomendado (demonstração).', 'PORTA', 42],
    [equipmentIds[3], 'Oscilação de conectividade identificada e normalizada (demonstração).', 'REDE', 75],
    [equipmentIds[0], 'Tendência de consumo sugere inspeção preventiva do conjunto frigorífico (demonstração).', 'MECANICA', 130]
  ];
  for (const [equipmentId, message, alertType, minutesAgo] of demoAlerts) {
    await connection.execute(
      `INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido, data_hora)
       VALUES (?, ?, ?, FALSE, DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
      [equipmentId, message, alertType, minutesAgo]
    );
  }

  return { equipmentCount: equipmentIds.length, readingCount };
}

/** Insere uma nova leitura para cada ativo virtual de trials ainda válidos. */
async function generateDemoTelemetry(pool, io) {
  const [equipment] = await pool.execute(`
    SELECT eq.id, eq.nome, eq.setor, eq.filial, eq.empresa,
           eq.demo_base_temp, eq.demo_base_humidity, eq.demo_base_consumption
    FROM equipamentos eq
    JOIN empresas company ON company.nome = eq.empresa
    WHERE eq.is_virtual = TRUE
      AND company.status = 'Ativa'
      AND (
        company.access_mode = 'DEMO'
        OR (company.access_mode = 'TRIAL' AND company.trial_expires_at > NOW())
      )
  `);

  for (const item of equipment) {
    const reading = buildDemoReading(item);
    const [result] = await pool.execute(
      'INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh, data_hora) VALUES (?, ?, ?, ?, ?)',
      [item.id, reading.temperatura, reading.umidade, reading.consumoKwh, reading.dataHora]
    );
    await pool.execute(
      "UPDATE hardware_iot SET sinal_wifi = -48, uptime = 'DEMO', firmware_version = 'demo-1.0', ultima_comunicacao = ? WHERE equipamento_id = ?",
      [reading.dataHora, item.id]
    );

    if (io) {
      io.emit('nova_leitura', {
        id: result.insertId,
        equipamento_id: item.id,
        temperatura: reading.temperatura,
        umidade: reading.umidade,
        consumo_kwh: reading.consumoKwh,
        motor_ligado: true,
        em_degelo: false,
        ultima_comunicacao: reading.dataHora,
        status_conexao: 'online',
        data_hora: reading.dataHora,
        nome: item.nome,
        setor: item.setor,
        filial: item.filial,
        empresa: item.empresa,
        origem: 'trial_virtual'
      });
    }
  }

  if (equipment.length && io) io.emit('atualizacao_dados', { tipo: 'trial_virtual' });
  return equipment.length;
}

module.exports = {
  DEMO_EQUIPMENT_TEMPLATES,
  buildDemoReading,
  generateDemoTelemetry,
  provisionDemoTenantData
};
