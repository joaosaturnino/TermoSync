/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthRealtimeStream.jsx
 * Responsabilidade: Implementa a tela Health Realtime Stream, seus estados, interações e integrações de dados.
 */

import { Activity, Cpu, Database, Radio, Timer, Users } from 'lucide-react';
/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthRealtimeStream.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @param {unknown} suffix - Valor de suffix consumido por esta rotina.
 * @param {unknown} digits - Valor de digits consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const metric = (value, suffix, digits = 0) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}${suffix}` : '—';

/**
 * Classifica limites técnicos para destacar saturação sem esconder o valor bruto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @param {unknown} warning - Valor de warning consumido por esta rotina.
 * @param {unknown} critical - Valor de critical consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const thresholdTone = (value, warning, critical) => {
  if (!Number.isFinite(Number(value))) return 'neutral';
  if (Number(value) >= critical) return 'bad';
  if (Number(value) >= warning) return 'warn';
  return 'good';
};

/**
 * Mostra o estado instantâneo do runtime e o fluxo mais recente recebido pelo Socket.IO.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.health - Propriedade health usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.checks - Propriedade checks usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.connected - Propriedade connected usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.lastEventAt - Propriedade lastEventAt usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.historyMeta - Propriedade historyMeta usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.describeStatus - Propriedade describeStatus usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HealthRealtimeStream({ health, checks, connected, lastEventAt, historyMeta, describeStatus }) {
  const metrics = [
    { label: 'CPU do processo', value: metric(health?.cpuPercent, '%', 1), raw: health?.cpuPercent, warning: 70, critical: 90, icon: Cpu },
    { label: 'Event loop ocupado', value: metric(health?.eventLoopUtilization, '%', 1), raw: health?.eventLoopUtilization, warning: 70, critical: 90, icon: Activity },
    { label: 'Consulta ao banco', value: metric(health?.databaseLatencyMs, ' ms'), raw: health?.databaseLatencyMs, warning: 100, critical: 400, icon: Database },
    { label: 'Clientes Socket', value: metric(health?.runtime?.socketClients, ''), raw: 0, warning: 500, critical: 1000, icon: Users },
    { label: 'Handles ativos', value: metric(health?.runtime?.activeHandles, ''), raw: 0, warning: 1000, critical: 2000, icon: Radio },
    { label: 'Memória externa', value: metric(health?.memory?.externalMb, ' MB', 1), raw: 0, warning: 1024, critical: 2048, icon: Timer }
  ];
  const liveChecks = checks.filter(check => check.source === 'realtime').slice(0, 8);

  return (
    <section className="health-section health-live-section" aria-labelledby="health-live-title">
      <div className="health-section-heading health-live-heading">
        <div><h3 id="health-live-title">Runtime em tempo real</h3><span>Métricas emitidas pelo backend sem recarregar a página</span></div>
        <span className={`health-live-connection ${connected ? 'good' : 'bad'}`}><i />{connected ? 'Stream conectado' : 'Usando contingência HTTP'}</span>
      </div>

      <div className="health-live-metrics">
        {metrics.map(item => {
          const Icon = item.icon;
          const tone = thresholdTone(item.raw, item.warning, item.critical);
          return <div className={`health-live-metric ${tone}`} key={item.label}><Icon size={17} /><span>{item.label}</span><strong>{item.value}</strong></div>;
        })}
      </div>

      <div className="health-live-lower">
        <div className="health-live-meta">
          <div><span>Último evento</span><strong>{lastEventAt ? new Date(lastEventAt).toLocaleTimeString('pt-BR') : 'Aguardando'}</strong></div>
          <div><span>Intervalo do servidor</span><strong>{historyMeta?.sampleIntervalSeconds ? `${historyMeta.sampleIntervalSeconds} s` : 'Padrão do servidor'}</strong></div>
          <div><span>Retenção</span><strong>{historyMeta?.retentionDays ? `${historyMeta.retentionDays} dias` : 'Não informada'}</strong></div>
          <div><span>Amostras carregadas</span><strong>{checks.length}</strong></div>
        </div>
        <div className="health-live-feed" aria-label="Últimos eventos de saúde recebidos">
          <div className="health-panel-title"><strong>Feed ao vivo</strong><span>{liveChecks.length ? 'eventos recebidos' : 'aguardando evento'}</span></div>
          {liveChecks.length ? liveChecks.map(check => {
            const status = describeStatus(check.api);
            return <div className="health-live-event" key={check.id}><time>{new Date(check.at).toLocaleTimeString('pt-BR')}</time><span className={status.tone}><i />{status.label}</span><code>API {check.responseTimeMs ?? '—'} ms · DB {check.databaseLatencyMs ?? '—'} ms</code></div>;
          }) : <p>A primeira emissão aparecerá aqui automaticamente.</p>}
        </div>
      </div>
    </section>
  );
}
