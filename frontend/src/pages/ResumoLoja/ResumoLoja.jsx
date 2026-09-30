/**
 * Módulo: frontend/src/pages/ResumoLoja/ResumoLoja.jsx
 * Responsabilidade: Implementa a tela Resumo Loja, seus estados, interações e integrações de dados.
 */

import { ArrowRight, ClipboardList, Gauge, MapPin, Radio, WifiOff } from 'lucide-react';
import React, { useMemo } from 'react';
import {
  AlertTriangle, Building2, CheckCircle2, Droplets,
  Thermometer, Wrench
} from 'lucide-react';
import './ResumoLoja.css';

/**
 * Concentra a logica de analyze equipment para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} equipment - Valor de equipment consumido por esta rotina.
 * @param {unknown} hasNotification - Valor de has notification consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function analyzeEquipment(equipment, hasNotification) {
  const temperature = Number.parseFloat(equipment.ultima_temp);
  const humidity = Number.parseFloat(equipment.ultima_umidade);
  const min = Number.parseFloat(equipment.temp_min);
  const max = Number.parseFloat(equipment.temp_max);
  const hasReading = Number.isFinite(temperature);
  const outOfRange = hasReading && ((Number.isFinite(min) && temperature < min) || (Number.isFinite(max) && temperature > max));
  return { ...equipment, temperature, humidity, hasReading, outOfRange, issue: hasNotification || outOfRange };
}

/**
 * Visão operacional instantânea da filial, orientada a decisões da equipe local.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.notificacoesDaFilial - Propriedade notificacoesDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function ResumoLoja({ equipamentosDaFilial = [], notificacoesDaFilial = [], chamados = [], filialAtiva = 'Todas', userRole = 'LOJA', onNavigate }) {
  const data = useMemo(() => {
    const notifiedIds = new Set(notificacoesDaFilial.map((item) => String(item.equipamento_id)));
    const equipment = equipamentosDaFilial.map((item) => analyzeEquipment(item, notifiedIds.has(String(item.id))));
    const withReading = equipment.filter((item) => item.hasReading);
    const compliant = equipment.filter((item) => item.hasReading && !item.issue);
    const openTickets = chamados.filter((item) => !['concluido', 'concluído', 'fechado'].includes(String(item.status || '').toLowerCase()));
    const sectors = new Map();
    equipment.forEach((item) => {
      const name = item.setor || 'Sem setor';
      const current = sectors.get(name) || { name, total: 0, issues: 0, temperatures: [] };
      current.total += 1;
      if (item.issue || !item.hasReading) current.issues += 1;
      if (item.hasReading) current.temperatures.push(item.temperature);
      sectors.set(name, current);
    });
    const sectorList = [...sectors.values()].map((sector) => ({
      ...sector,
      average: sector.temperatures.length ? sector.temperatures.reduce((sum, value) => sum + value, 0) / sector.temperatures.length : null
    })).sort((a, b) => b.issues - a.issues || a.name.localeCompare(b.name));
    const priorityEquipment = equipment.filter((item) => item.issue || !item.hasReading).sort((a, b) => Number(b.issue) - Number(a.issue)).slice(0, 5);
    return {
      equipment,
      withReading: withReading.length,
      compliant: compliant.length,
      compliance: equipment.length ? Math.round((compliant.length / equipment.length) * 100) : 0,
      openTickets,
      sectorList,
      priorityEquipment,
      averageTemp: withReading.length ? withReading.reduce((sum, item) => sum + item.temperature, 0) / withReading.length : null,
      averageHumidity: equipment.filter((item) => Number.isFinite(item.humidity)).length
        ? equipment.filter((item) => Number.isFinite(item.humidity)).reduce((sum, item) => sum + item.humidity, 0) / equipment.filter((item) => Number.isFinite(item.humidity)).length
        : null
    };
  }, [equipamentosDaFilial, notificacoesDaFilial, chamados]);

  const state = data.compliance >= 95 && !notificacoesDaFilial.length ? { label: 'Operação estável', tone: 'healthy' } : data.compliance >= 75 ? { label: 'Operação em atenção', tone: 'attention' } : { label: 'Intervenção necessária', tone: 'critical' };

  return (
    <main className="store-summary anim-fade-in">
      <header className="store-summary-header">
        <div><span className="store-eyebrow"><Building2 size={15} /> Visão da unidade</span><h2>Resumo da loja</h2><p>{filialAtiva === 'Todas' ? 'Visão consolidada das filiais' : filialAtiva} · perfil {userRole}</p></div>
        <div className={`store-state ${state.tone}`}><span><Radio size={16} /></span><div><strong>{state.label}</strong><small>{notificacoesDaFilial.length} ocorrências ativas</small></div></div>
      </header>

      <section className="store-kpis">
        <article><span><Gauge size={16} /> Conformidade térmica</span><strong>{data.compliance}<small>%</small></strong><p>{data.compliant} de {data.equipment.length} ativos conformes</p><i><b style={{ width: `${data.compliance}%` }} /></i></article>
        <article><span><Thermometer size={16} /> Temperatura média</span><strong>{data.averageTemp === null ? '--' : data.averageTemp.toFixed(1)}<small>°C</small></strong><p>Leituras válidas da unidade</p></article>
        <article><span><Droplets size={16} /> Umidade média</span><strong>{data.averageHumidity === null ? '--' : data.averageHumidity.toFixed(1)}<small>%</small></strong><p>Condição higrométrica atual</p></article>
        <article className={notificacoesDaFilial.length ? 'danger' : ''}><span><AlertTriangle size={16} /> Ocorrências</span><strong>{notificacoesDaFilial.length}</strong><p>Alertas aguardando tratamento</p></article>
        <article><span><Wrench size={16} /> Chamados abertos</span><strong>{data.openTickets.length}</strong><p>Demandas em acompanhamento</p></article>
      </section>

      <section className="store-summary-layout">
        <article className="store-panel priority-panel">
          <div className="store-panel-heading"><div><span>Triagem imediata</span><h3>Prioridades da unidade</h3></div><button type="button" onClick={() => onNavigate?.('motores')}>Monitor térmico <ArrowRight size={14} /></button></div>
          <div className="store-priority-list">
            {data.priorityEquipment.length ? data.priorityEquipment.map((item) => <button key={item.id} type="button" onClick={() => onNavigate?.('motores')}>
              <span className={item.hasReading ? 'priority-icon alert' : 'priority-icon offline'}>{item.hasReading ? <AlertTriangle size={16} /> : <WifiOff size={16} />}</span>
              <span><strong>{item.nome}</strong><small>{item.setor || 'Sem setor'} · {item.hasReading ? 'Fora do parâmetro ou com alerta' : 'Sem telemetria'}</small></span>
              <strong>{item.hasReading ? `${item.temperature.toFixed(1)}°C` : '--'}</strong><ArrowRight size={15} />
            </button>) : <div className="store-empty"><CheckCircle2 size={27} /><strong>Nenhuma prioridade crítica</strong><span>Os ativos estão dentro dos parâmetros atuais.</span></div>}
          </div>
        </article>

        <article className="store-panel sector-panel">
          <div className="store-panel-heading"><div><span>Distribuição operacional</span><h3>Setores da loja</h3></div><MapPin size={17} /></div>
          <div className="store-sector-list">
            {data.sectorList.map((sector) => <div key={sector.name}><span><strong>{sector.name}</strong><small>{sector.total} ativos</small></span><span className={sector.issues ? 'with-issue' : ''}><strong>{sector.average === null ? '--' : `${sector.average.toFixed(1)}°C`}</strong><small>{sector.issues ? `${sector.issues} pendência(s)` : 'Conforme'}</small></span></div>)}
          </div>
        </article>

        <article className="store-panel coverage-panel">
          <div className="store-panel-heading"><div><span>Qualidade da visão</span><h3>Cobertura de dados</h3></div><Radio size={17} /></div>
          <div className="coverage-summary"><strong>{data.equipment.length ? Math.round((data.withReading / data.equipment.length) * 100) : 0}%</strong><span>dos ativos enviando telemetria</span></div>
          <div className="coverage-row"><span>Com leitura</span><strong>{data.withReading}</strong></div><div className="coverage-row"><span>Sem leitura</span><strong>{data.equipment.length - data.withReading}</strong></div>
          <button type="button" onClick={() => onNavigate?.('mapa')}><MapPin size={15} /> Abrir planta digital <ArrowRight size={14} /></button>
        </article>

        <article className="store-panel action-panel">
          <div className="store-panel-heading"><div><span>Rotina local</span><h3>Ações recomendadas</h3></div><ClipboardList size={17} /></div>
          <button type="button" onClick={() => onNavigate?.('plano_dia')}><span><strong>Executar plano do dia</strong><small>Prioridades e horários da equipe</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={() => onNavigate?.('checklist_turno')}><span><strong>Validar checklist</strong><small>Abertura, operação e fechamento</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={() => onNavigate?.('chamados')}><span><strong>Tratar chamados</strong><small>{data.openTickets.length} demandas ainda abertas</small></span><ArrowRight size={15} /></button>
        </article>
      </section>
    </main>
  );
}
