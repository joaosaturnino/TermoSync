/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthSessionAnalytics.jsx
 * Responsabilidade: Implementa a tela Health Session Analytics, seus estados, interações e integrações de dados.
 */

import { Activity, Gauge, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthSessionAnalytics.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} values - Valor de values consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const average = values => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

/**
 * Resume estabilidade, latência e distribuição do histórico carregado pelo painel.
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
 * @param {unknown} props.checks - Propriedade checks usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.describeStatus - Propriedade describeStatus usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HealthSessionAnalytics({ checks, describeStatus }) {
  const tones = checks.map(check => describeStatus(check.api).tone);
  const distribution = ['good', 'warn', 'bad', 'neutral'].reduce((result, tone) => ({ ...result, [tone]: tones.filter(value => value === tone).length }), {});
  const answered = checks.filter(check => describeStatus(check.api).tone !== 'bad').length;
  const availability = checks.length ? Math.round((answered / checks.length) * 100) : null;
  const latencies = checks.filter(check => check.responseTimeMs != null).map(check => Number(check.responseTimeMs)).filter(Number.isFinite);
  const averageLatency = average(latencies);
  const minimumLatency = latencies.length ? Math.min(...latencies) : null;
  const maximumLatency = latencies.length ? Math.max(...latencies) : null;
  const currentWindow = checks.slice(0, 3).filter(check => check.responseTimeMs != null).map(check => Number(check.responseTimeMs)).filter(Number.isFinite);
  const previousWindow = checks.slice(3, 6).filter(check => check.responseTimeMs != null).map(check => Number(check.responseTimeMs)).filter(Number.isFinite);
  const currentAverage = average(currentWindow);
  const previousAverage = average(previousWindow);
  const trendRatio = currentAverage != null && previousAverage ? (currentAverage - previousAverage) / previousAverage : null;
  const trend = trendRatio == null ? { label: 'Aguardando dados', tone: 'neutral', icon: Activity }
    : trendRatio > 0.1 ? { label: 'Latência subindo', tone: 'warn', icon: TrendingUp }
      : trendRatio < -0.1 ? { label: 'Latência melhorando', tone: 'good', icon: TrendingDown }
        : { label: 'Latência estável', tone: 'good', icon: Activity };
  const TrendIcon = trend.icon;

  return (
    <section className="health-section" aria-labelledby="health-session-title">
      <div className="health-section-heading">
        <div><h3 id="health-session-title">Observabilidade histórica</h3><span>Análise das últimas {checks.length || 0} amostras disponíveis</span></div>
      </div>
      <div className="health-session-layout">
        <div className="health-session-metrics">
          <div><ShieldCheck size={17} aria-hidden="true" /><span>Disponibilidade observada</span><strong>{availability == null ? '—' : `${availability}%`}</strong></div>
          <div><Gauge size={17} aria-hidden="true" /><span>Latência média</span><strong>{averageLatency == null ? '—' : `${Math.round(averageLatency)} ms`}</strong></div>
          <div><Activity size={17} aria-hidden="true" /><span>Faixa de latência</span><strong>{minimumLatency == null ? '—' : `${minimumLatency}–${maximumLatency} ms`}</strong></div>
          <div className={trend.tone}><TrendIcon size={17} aria-hidden="true" /><span>Tendência recente</span><strong>{trend.label}</strong></div>
        </div>
        <div className="health-distribution">
          <div className="health-distribution-heading"><strong>Distribuição dos estados</strong><span>{checks.length ? `${checks.length} amostras` : 'Sem amostras'}</span></div>
          <div className="health-distribution-bar" aria-label="Distribuição dos estados das verificações">
            {checks.length > 0 && ['good', 'warn', 'bad', 'neutral'].map(tone => distribution[tone] > 0 && <i key={tone} className={tone} style={{ width: `${(distribution[tone] / checks.length) * 100}%` }} />)}
          </div>
          <div className="health-distribution-legend">
            <span><i className="good" />Operacional <strong>{distribution.good}</strong></span>
            <span><i className="warn" />Atenção <strong>{distribution.warn}</strong></span>
            <span><i className="bad" />Indisponível <strong>{distribution.bad}</strong></span>
            <span><i className="neutral" />Sem dados <strong>{distribution.neutral}</strong></span>
          </div>
        </div>
      </div>
    </section>
  );
}
