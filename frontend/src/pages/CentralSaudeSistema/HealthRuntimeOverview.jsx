/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthRuntimeOverview.jsx
 * Responsabilidade: Implementa a tela Health Runtime Overview, seus estados, interações e integrações de dados.
 */

import { Clock3, Cpu, Gauge, MemoryStick } from 'lucide-react';
/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthRuntimeOverview.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} used - Valor de used consumido por esta rotina.
 * @param {unknown} total - Valor de total consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const percentage = (used, total) => {
  const usedValue = Number(used);
  const totalValue = Number(total);
  if (!Number.isFinite(usedValue) || !Number.isFinite(totalValue) || totalValue <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((usedValue / totalValue) * 100)));
};

/**
 * Define uma leitura visual simples para consumo de memória e latência.
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
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const usageTone = value => value == null ? 'neutral' : value >= 90 ? 'bad' : value >= 75 ? 'warn' : 'good';

/**
 * Reúne recursos do host e do processo sem misturar indicadores da operação do cliente.
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
 * @param {unknown} props.host - Propriedade host usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.formatUptime - Propriedade formatUptime usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.warningLatency - Propriedade warningLatency usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.criticalLatency - Propriedade criticalLatency usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HealthRuntimeOverview({ health, host, formatUptime, warningLatency, criticalLatency }) {
  const hostUsedMb = host?.memory ? Number(host.memory.totalMB) - Number(host.memory.freeMB) : null;
  const hostMemoryPercent = percentage(hostUsedMb, host?.memory?.totalMB);
  const heapPercent = percentage(health?.memory?.heapUsedMb, health?.memory?.heapTotalMb);
  const latency = Number.isFinite(Number(health?.responseTimeMs)) ? Number(health.responseTimeMs) : null;
  const latencyTone = latency == null ? 'neutral' : latency > criticalLatency ? 'bad' : latency > warningLatency ? 'warn' : 'good';

  const metrics = [
    { label: 'Latência da API', value: latency == null ? 'Sem dados' : `${latency} ms`, detail: 'Consulta de integridade', icon: Gauge, tone: latencyTone },
    { label: 'Tempo ativo da API', value: formatUptime(health?.uptime), detail: 'Desde o último início', icon: Clock3, tone: 'neutral' },
    { label: 'Memória do host', value: hostMemoryPercent == null ? 'Sem dados' : `${hostMemoryPercent}%`, detail: host?.memory ? `${hostUsedMb} de ${host.memory.totalMB} MB` : 'Coleta indisponível', icon: MemoryStick, tone: usageTone(hostMemoryPercent) },
    { label: 'Heap da API', value: heapPercent == null ? 'Sem dados' : `${heapPercent}%`, detail: health?.memory?.heapTotalMb != null ? `${health.memory.heapUsedMb} de ${health.memory.heapTotalMb} MB` : 'Coleta indisponível', icon: Cpu, tone: usageTone(heapPercent) }
  ];

  return (
    <section className="health-section" aria-labelledby="health-runtime-title">
      <div className="health-section-heading">
        <div><h3 id="health-runtime-title">Recursos e desempenho</h3><span>Host e processo da API</span></div>
      </div>
      <div className="health-runtime-grid">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <div className={`health-runtime-metric ${tone}`} key={label}>
            <span className="health-runtime-icon"><Icon size={18} aria-hidden="true" /></span>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
            {(label === 'Memória do host' || label === 'Heap da API') && (
              <span className="health-resource-track" aria-hidden="true"><i style={{ width: `${label === 'Memória do host' ? hostMemoryPercent || 0 : heapPercent || 0}%` }} /></span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
