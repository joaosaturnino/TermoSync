const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEMO_EQUIPMENT_TEMPLATES,
  buildDemoReading,
  generateDemoTelemetry
} = require('../services/demoTrialService');

test('trial oferece um conjunto representativo de equipamentos virtuais', () => {
  assert.equal(DEMO_EQUIPMENT_TEMPLATES.length, 4);
  for (const equipment of DEMO_EQUIPMENT_TEMPLATES) {
    assert.ok(equipment.nome);
    assert.ok(equipment.tipo);
    assert.ok(equipment.setor);
    assert.ok(equipment.tempMin < equipment.tempMax);
    assert.ok(equipment.humidityMin < equipment.humidityMax);
    assert.ok(equipment.baseConsumption > 0);
  }
});

test('telemetria virtual e deterministica e permanece em uma faixa realista', () => {
  const equipment = { ...DEMO_EQUIPMENT_TEMPLATES[1], id: 42 };
  const at = new Date('2026-09-29T12:00:00.000Z');
  const first = buildDemoReading(equipment, at);
  const second = buildDemoReading(equipment, at);

  assert.deepEqual(first, second);
  assert.ok(first.temperatura >= equipment.baseTemp - 1.2);
  assert.ok(first.temperatura <= equipment.baseTemp + 1.2);
  assert.ok(first.umidade >= equipment.baseHumidity - 4.5);
  assert.ok(first.umidade <= equipment.baseHumidity + 4.5);
  assert.ok(first.consumoKwh > 0);
});

test('telemetria continua para demonstrações permanentes sem reativar trials expirados', async () => {
  const queries = [];
  const pool = {
    execute: async (sql) => {
      queries.push(sql);
      return [[]];
    }
  };

  const generated = await generateDemoTelemetry(pool, null);

  assert.equal(generated, 0);
  assert.match(queries[0], /access_mode = 'DEMO'/);
  assert.match(queries[0], /access_mode = 'TRIAL'.*trial_expires_at > NOW\(\)/s);
});
