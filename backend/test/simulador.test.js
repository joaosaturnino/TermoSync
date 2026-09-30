/** Garante que a configuração necessária ao simulador exista antes de iniciar seus loops. */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COLORS,
  IDS_FISICOS,
  INTERVALO_TELEMETRIA,
  getIotHeaders
} = require('../simulador');

test('carrega a configuração básica do simulador sem iniciar tarefas', () => {
  assert.equal(typeof COLORS.reset, 'string');
  assert.equal(typeof COLORS.magenta, 'string');
  assert.ok(Number.isFinite(INTERVALO_TELEMETRIA));
  assert.ok(INTERVALO_TELEMETRIA > 0);
  assert.ok(Array.isArray(IDS_FISICOS));
  assert.equal(typeof getIotHeaders(), 'object');
});

