const test = require('node:test');
const assert = require('node:assert/strict');

const { enforceTrialLimit, TRIAL_LIMITS } = require('../services/trialLifecycleService');

test('limites padrão de trial cobrem usuários, lojas e equipamentos', () => {
  assert.deepEqual(TRIAL_LIMITS, { users: 3, stores: 1, equipment: 10 });
});

test('limite é aplicado somente dentro da empresa recebida', async () => {
  const calls = [];
  const connection = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (/FROM empresas/.test(sql)) return [[{ nome: 'Trial A', trial_max_users: 2 }]];
      return [[{ total: 1 }]];
    }
  };

  await enforceTrialLimit(connection, 'Trial A', 'users');

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].params, ['Trial A']);
  assert.deepEqual(calls[1].params, ['Trial A']);
  assert.match(calls[1].sql, /FROM usuarios WHERE empresa = \?/);
});

test('cadastro é recusado ao alcançar o limite configurado', async () => {
  const connection = {
    execute: async (sql) => /FROM empresas/.test(sql)
      ? [[{ nome: 'Trial A', trial_max_equipment: 4 }]]
      : [[{ total: 4 }]]
  };

  await assert.rejects(
    enforceTrialLimit(connection, 'Trial A', 'equipment'),
    (error) => error.statusCode === 409 && /limite de 4 equipamentos/.test(error.message)
  );
});

test('clientes comerciais não recebem limites de demonstração', async () => {
  let calls = 0;
  const connection = { execute: async () => { calls += 1; return [[]]; } };
  await enforceTrialLimit(connection, 'Cliente Comercial', 'stores');
  assert.equal(calls, 1);
});
