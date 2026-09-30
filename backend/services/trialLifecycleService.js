/**
 * Regras transacionais compartilhadas pela gestão de demonstrações.
 * Mantém limpeza, restauração e limites fora da rota HTTP para que tarefas
 * automáticas e ações manuais produzam exatamente o mesmo resultado.
 */

const { provisionDemoTenantData } = require('./demoTrialService');

const TRIAL_LIMITS = Object.freeze({ users: 3, stores: 1, equipment: 10 });

function placeholders(values) {
  return values.map(() => '?').join(', ');
}

async function loadTrialCompany(connection, empresa, lock = false) {
  const [[company]] = await connection.execute(
    `SELECT id, nome, access_mode, status, trial_max_users, trial_max_stores,
            trial_max_equipment, trial_expires_at, trial_delete_at
       FROM empresas
      WHERE nome = ? AND access_mode IN ('TRIAL', 'DEMO')
      ${lock ? 'FOR UPDATE' : ''}`,
    [empresa]
  );
  return company || null;
}

async function enforceTrialLimit(connection, empresa, resource) {
  if (!empresa || !Object.hasOwn(TRIAL_LIMITS, resource)) return;
  const company = await loadTrialCompany(connection, empresa);
  if (!company) return;

  const definitions = {
    users: ['usuarios', 'empresa', 'trial_max_users', 'usuários'],
    stores: ['loja', 'empresa', 'trial_max_stores', 'lojas'],
    equipment: ['equipamentos', 'empresa', 'trial_max_equipment', 'equipamentos']
  };
  const [table, column, limitColumn, label] = definitions[resource];
  const [[countRow]] = await connection.execute(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column} = ?`, [empresa]);
  const limit = Math.max(1, Number(company[limitColumn] || TRIAL_LIMITS[resource]));
  if (Number(countRow.total || 0) >= limit) {
    const error = new Error(`O ambiente de demonstração atingiu o limite de ${limit} ${label}.`);
    error.statusCode = 409;
    throw error;
  }
}

async function clearTrialOperationalData(connection, empresa) {
  const [equipment] = await connection.execute('SELECT id FROM equipamentos WHERE empresa = ?', [empresa]);
  const equipmentIds = equipment.map(({ id }) => id);
  if (equipmentIds.length) {
    const slots = placeholders(equipmentIds);
    await connection.query(
      `DELETE FROM chamados_comentarios WHERE chamado_id IN (SELECT id FROM chamados WHERE equipamento_id IN (${slots}))`,
      equipmentIds
    );
    await connection.query(`DELETE FROM equipamento_ultima_leitura WHERE equipamento_id IN (${slots})`, equipmentIds);
    await connection.query(`DELETE FROM rede_scans WHERE equipamento_id IN (${slots})`, equipmentIds);
  }
  await connection.execute(
    'DELETE FROM chamados_comentarios WHERE chamado_id IN (SELECT id FROM chamados WHERE empresa = ?)',
    [empresa]
  );
  await connection.execute('DELETE FROM operacao_tarefas WHERE empresa = ?', [empresa]);
  await connection.execute('DELETE FROM suporte_chamados WHERE empresa = ?', [empresa]);
  await connection.execute('DELETE FROM equipamentos WHERE empresa = ?', [empresa]);
}

async function resetTrialTenantData(connection, empresa) {
  const company = await loadTrialCompany(connection, empresa, true);
  if (!company) {
    const error = new Error('Ambiente de demonstração não encontrado.');
    error.statusCode = 404;
    throw error;
  }
  const [[store]] = await connection.execute('SELECT nome FROM loja WHERE empresa = ? ORDER BY id LIMIT 1', [empresa]);
  if (!store) {
    const error = new Error('O ambiente não possui uma filial para receber os dados virtuais.');
    error.statusCode = 409;
    throw error;
  }
  await clearTrialOperationalData(connection, empresa);
  const provisioned = await provisionDemoTenantData(connection, { empresa, filial: store.nome });
  return { company, store: store.nome, ...provisioned };
}

async function deleteTrialTenantData(connection, empresa) {
  const company = await loadTrialCompany(connection, empresa, true);
  if (!company || company.access_mode !== 'TRIAL') {
    const error = new Error('Trial temporário não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const [stores] = await connection.execute('SELECT nome FROM loja WHERE empresa = ?', [empresa]);
  const storeNames = stores.map(({ nome }) => nome);
  const [users] = await connection.execute('SELECT id, usuario FROM usuarios WHERE empresa = ?', [empresa]);
  const userIds = users.map(({ id }) => id);

  await clearTrialOperationalData(connection, empresa);
  if (userIds.length) {
    const slots = placeholders(userIds);
    await connection.query(`DELETE FROM user_preferences WHERE usuario_id IN (${slots})`, userIds);
    await connection.query(
      `DELETE FROM chat_mensagens WHERE remetente_id IN (${slots}) OR destino_id IN (${slots})`,
      [...userIds, ...userIds]
    );
  }
  await connection.execute('DELETE FROM usuarios WHERE empresa = ?', [empresa]);

  if (storeNames.length) {
    const slots = placeholders(storeNames);
    await connection.query(`DELETE FROM rede_scans WHERE filial IN (${slots})`, storeNames);
    await connection.query(`DELETE FROM scanner_jobs WHERE filial IN (${slots})`, storeNames);
    await connection.query(`DELETE FROM network_probe_agents WHERE filial IN (${slots})`, storeNames);
    await connection.query(`DELETE FROM operacao_tarefas WHERE filial IN (${slots})`, storeNames);
    await connection.query(`DELETE FROM saas_tenant_settings WHERE filial IN (${slots})`, storeNames);
    await connection.query(`DELETE FROM loja WHERE nome IN (${slots})`, storeNames);
  }
  await connection.execute('DELETE FROM saas_trial_notifications WHERE empresa = ?', [empresa]);
  await connection.execute('DELETE FROM trial_usage_events WHERE empresa = ?', [empresa]);
  await connection.execute('DELETE FROM saas_trial_events WHERE empresa = ?', [empresa]);
  await connection.execute('DELETE FROM pre_cadastros WHERE empresa = ?', [empresa]);
  await connection.execute('DELETE FROM empresas WHERE nome = ? AND access_mode = \'TRIAL\'', [empresa]);
  return { company, userIds };
}

module.exports = {
  TRIAL_LIMITS,
  deleteTrialTenantData,
  enforceTrialLimit,
  loadTrialCompany,
  resetTrialTenantData
};
