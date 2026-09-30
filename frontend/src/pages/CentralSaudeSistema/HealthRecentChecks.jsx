/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthRecentChecks.jsx
 * Responsabilidade: Implementa a tela Health Recent Checks, seus estados, interações e integrações de dados.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthRecentChecks.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; publica ou consome mensagens MQTT
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.checks - Propriedade checks usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onClear - Callback onClear fornecido pelo componente responsável.
 * @param {unknown} props.describeStatus - Propriedade describeStatus usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.autoRefresh - Propriedade autoRefresh usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.refreshInterval - Propriedade refreshInterval usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HealthRecentChecks({ checks, onClear, describeStatus, autoRefresh, refreshInterval }) {
  const [filter, setFilter] = useState('all');
  const answered = checks.filter(check => describeStatus(check.api).tone !== 'bad').length;
  const latencies = checks.filter(check => check.responseTimeMs != null).map(check => Number(check.responseTimeMs)).filter(Number.isFinite);
  const averageLatency = latencies.length ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length) : null;
  const visibleChecks = filter === 'issues' ? checks.filter(check => ['warn', 'bad'].includes(describeStatus(check.api).tone)) : checks;

  return (
    <section className="health-section" aria-labelledby="health-history-title">
      <div className="health-section-heading">
        <div>
          <h3 id="health-history-title">Verificações recentes</h3>
          <span>Histórico do servidor e desta sessão · {autoRefresh ? `fallback HTTP a cada ${refreshInterval} s` : 'monitoramento pausado'}</span>
        </div>
        {checks.length > 0 && <button type="button" className="health-clear" onClick={onClear} title="Limpar verificações" aria-label="Limpar verificações"><Trash2 size={16} /></button>}
      </div>
      {checks.length > 0 && (
        <div className="health-history-tools">
          <div className="health-history-summary" aria-label="Resumo das verificações desta sessão">
            <span><strong>{checks.length}</strong> verificações</span>
            <span><strong>{Math.round((answered / checks.length) * 100)}%</strong> com resposta</span>
            <span><strong>{averageLatency == null ? '—' : `${averageLatency} ms`}</strong> latência média</span>
          </div>
          <div className="health-history-filter" aria-label="Filtrar verificações">
            <button type="button" className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todas</button>
            <button type="button" className={filter === 'issues' ? 'active' : ''} aria-pressed={filter === 'issues'} onClick={() => setFilter('issues')}>Com alerta</button>
          </div>
        </div>
      )}
      {checks.length === 0 ? <p className="health-empty">A primeira verificação aparecerá aqui.</p> : (
        <div className="health-history-scroll" tabIndex="0" aria-label="Lista de verificações recentes">
          {visibleChecks.length === 0 ? <p className="health-empty">Nenhuma verificação com alerta nesta sessão.</p> : (
            <ol className="health-history">
              {visibleChecks.map(check => {
                const status = describeStatus(check.api);
                return (
                  <li key={check.id} className="health-history-row">
                    <time dateTime={new Date(check.at).toISOString()}>{new Date(check.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                    <span className={`health-service-status ${status.tone}`}><span className="health-status-dot" />{status.label}</span>
                    <span className="health-history-latency">{check.responseTimeMs == null ? 'Sem latência' : `${check.responseTimeMs} ms`}</span>
                    <span className="health-history-dependencies" title="Estado de banco, MQTT e WhatsApp">
                      <span title={`Banco: ${describeStatus(check.database).label}`} aria-label={`Banco: ${describeStatus(check.database).label}`}>Banco <i className={`health-mini-dot ${describeStatus(check.database).tone}`} aria-hidden="true" /></span>
                      <span title={`MQTT: ${describeStatus(check.mqtt).label}`} aria-label={`MQTT: ${describeStatus(check.mqtt).label}`}>MQTT <i className={`health-mini-dot ${describeStatus(check.mqtt).tone}`} aria-hidden="true" /></span>
                      <span title={`WhatsApp: ${describeStatus(check.whatsapp).label}`} aria-label={`WhatsApp: ${describeStatus(check.whatsapp).label}`}>WhatsApp <i className={`health-mini-dot ${describeStatus(check.whatsapp).tone}`} aria-hidden="true" /></span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
