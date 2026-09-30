/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthTelemetryExplorer.jsx
 * Responsabilidade: Implementa a tela Health Telemetry Explorer, seus estados, interações e integrações de dados.
 */

import { useEffect, useRef, useState } from 'react';
import { AreaChart } from 'lucide-react';
import { Area, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';

const dependencies = [
  { key: 'api', label: 'API' },
  { key: 'database', label: 'Banco de dados' },
  { key: 'mqtt', label: 'MQTT / IoT' },
  { key: 'whatsapp', label: 'WhatsApp' }
];
/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthTelemetryExplorer.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.active - Propriedade active usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.payload - Propriedade payload usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const LatencyTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const sample = payload[0].payload;
  return <div className="health-chart-tooltip"><strong>{sample.time}</strong><span>{sample.latency == null ? 'Sem resposta' : `${sample.latency} ms`}</span></div>;
};

/**
 * Combina a série persistida de latência com a estabilidade de cada dependência.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.checks - Propriedade checks usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.describeStatus - Propriedade describeStatus usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.warningLatency - Propriedade warningLatency usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.criticalLatency - Propriedade criticalLatency usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HealthTelemetryExplorer({ checks, describeStatus, warningLatency, criticalLatency }) {
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return undefined;

    /**
     * Atualiza update width mantendo o estado persistido em sincronia.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const updateWidth = () => setChartWidth(Math.max(0, Math.floor(container.getBoundingClientRect().width)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const chartData = [...checks].reverse().map(check => ({
    time: new Date(check.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    latency: check.responseTimeMs == null ? null : Number(check.responseTimeMs)
  }));

  const matrix = dependencies.map(({ key, label }) => {
    const tones = checks.map(check => describeStatus(check[key]).tone);
    const operational = tones.filter(tone => tone === 'good').length;
    const alerts = tones.filter(tone => tone === 'warn' || tone === 'bad').length;
    return {
      key,
      label,
      operational,
      alerts,
      reliability: checks.length ? Math.round((operational / checks.length) * 100) : null,
      current: describeStatus(checks[0]?.[key])
    };
  });

  return (
    <section className="health-section" aria-labelledby="health-telemetry-title">
      <div className="health-section-heading">
        <div><h3 id="health-telemetry-title">Telemetria técnica</h3><span>Latência e estabilidade das dependências no período carregado</span></div>
      </div>
      <div className="health-telemetry-layout">
        <div className="health-latency-chart">
          <div className="health-panel-title"><strong>Evolução da latência</strong><span>ms</span></div>
          {chartData.some(sample => sample.latency != null) ? (
            <div className="health-chart-canvas" ref={chartContainerRef}>
              {chartWidth > 0 && (
                <AreaChart width={chartWidth} height={198} data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="healthLatencyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.34} /><stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={46} />
                  <ReferenceLine y={warningLatency} stroke="var(--warning)" strokeDasharray="4 4" />
                  <ReferenceLine y={criticalLatency} stroke="var(--danger)" strokeDasharray="4 4" />
                  <Tooltip content={<LatencyTooltip />} />
                  <Area type="monotone" dataKey="latency" stroke="var(--secondary)" strokeWidth={2} fill="url(#healthLatencyFill)" connectNulls={false} isAnimationActive={false} />
                </AreaChart>
              )}
            </div>
          ) : <p className="health-chart-empty">Aguardando amostras de latência.</p>}
        </div>

        <div className="health-dependency-matrix">
          <div className="health-panel-title"><strong>Estabilidade por serviço</strong><span>{checks.length} amostras</span></div>
          <div className="health-dependency-head"><span>Serviço</span><span>Estável</span><span>Alertas</span><span>Atual</span></div>
          {matrix.map(item => (
            <div className="health-dependency-row" key={item.key}>
              <strong>{item.label}</strong>
              <span>{item.reliability == null ? '—' : `${item.reliability}%`}</span>
              <span>{item.alerts}</span>
              <span className={`health-mini-status ${item.current.tone}`}><i />{item.current.label}</span>
              <span className="health-dependency-track" aria-hidden="true"><i style={{ width: `${item.reliability || 0}%` }} /></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
