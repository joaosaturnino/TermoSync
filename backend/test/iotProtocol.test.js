/** Valida automaticamente o comportamento de iot Protocol.test. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { montarComandoMqtt, validarTelemetria } = require('../services/iotProtocol');

test('normaliza uma leitura válida', () => {
  assert.deepEqual(validarTelemetria({
    equipamento_id: '7',
    temperatura: '-18.5',
    umidade: '72.3',
    consumo_kwh: '1.25',
    temperatura_valida: true,
    umidade_valida: true
  }), { equipamentoId: 7, temperatura: -18.5, umidade: 72.3, consumo: 1.25 });
});

test('preserva falha de umidade como null', () => {
  const leitura = validarTelemetria({
    equipamento_id: 1,
    temperatura: 4,
    umidade: 0,
    umidade_valida: false
  });
  assert.equal(leitura.umidade, null);
});

test('recusa temperatura marcada como inválida', () => {
  assert.throws(
    () => validarTelemetria({ equipamento_id: 1, temperatura: 4, temperatura_valida: false }),
    /temperatura marcada como inválida/
  );
});

test('recusa identificador e faixas inseguras', () => {
  assert.throws(() => validarTelemetria({ equipamento_id: 0, temperatura: 4 }), /equipamento_id/);
  assert.throws(() => validarTelemetria({ equipamento_id: 1, temperatura: 81 }), /temperatura/);
  assert.throws(() => validarTelemetria({ equipamento_id: 1, temperatura: 4, umidade: 101 }), /umidade/);
  assert.throws(() => validarTelemetria({ equipamento_id: 1, temperatura: 4, consumo_kwh: -1 }), /consumo/);
});

test('comando MQTT recebe UUID, emissão e expira em dois minutos', () => {
  const comando = montarComandoMqtt('LIGAR', true, { origem: 'teste' }, {
    agora: 1_700_000_000,
    commandId: '550e8400-e29b-41d4-a716-446655440000'
  });
  assert.deepEqual(comando, {
    acao: 'LIGAR',
    estado: true,
    origem: 'teste',
    command_id: '550e8400-e29b-41d4-a716-446655440000',
    issued_at: 1_700_000_000,
    expires_at: 1_700_000_120
  });
});
