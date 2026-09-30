/** Valida os catálogos usados para popular as rotinas e os procedimentos operacionais. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { checklistTurno, planoDia, procedimentos } = require('../data/operationalDefaults');

test('disponibiliza os catálogos exigidos pelo bootstrap do banco', () => {
  assert.ok(Array.isArray(checklistTurno) && checklistTurno.length > 0);
  assert.ok(Array.isArray(planoDia) && planoDia.length > 0);
  assert.ok(Array.isArray(procedimentos) && procedimentos.length > 0);

  for (const procedimento of procedimentos) {
    assert.ok(procedimento.chave);
    assert.ok(procedimento.titulo);
    assert.ok(Array.isArray(procedimento.etapas));
    assert.ok(Array.isArray(procedimento.evidencias));
  }
});

