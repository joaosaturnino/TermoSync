/**
 * Módulo: frontend/src/pages/HistoricoLogs/HistoricoLogs.jsx
 * Responsabilidade: Implementa a tela Historico Logs, seus estados, interações e integrações de dados.
 */

import React, { useDeferredValue, useMemo, useState } from 'react';
import {
  Activity, CheckCircle2, CircleAlert, Clock3, Cpu, Download,
  FileCode2, FileText, Filter, Fingerprint, KeyRound, Power,
  Search, ShieldAlert, Terminal, Thermometer, UserCheck, WifiOff
} from 'lucide-react';
import usePersistentState from '../../hooks/usePersistentState';
import './HistoricoLogs.css';

const PAGE_SIZE = 80;

/**
 * Busca ou monta os dados de get log inteligencia usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: publica ou consome mensagens MQTT
 *
 * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getLogInteligencia(mensagem) {
  const msg = mensagem?.toLowerCase() || '';
  if (['acesso', 'senha', 'credencial', 'bloqueado', 'porta', 'revogado', 'login'].some(termo => msg.includes(termo))) {
    return { type: 'SECURITY', label: 'Acesso / IAM', icon: ShieldAlert, color: 'var(--accent-violet)', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)' };
  }
  if (['temperatura', 'térmica', 'excursão', 'frio', 'umidade', 'degelo'].some(termo => msg.includes(termo))) {
    return { type: 'THERMAL', label: 'Evento térmico', icon: Thermometer, color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: 'color-mix(in srgb, var(--warning) 30%, transparent)' };
  }
  if (['parada', 'mecânica', 'compressor', 'motor', 'energia', 'tensão'].some(termo => msg.includes(termo))) {
    return { type: 'POWER', label: 'Elétrico / mecânico', icon: Power, color: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: 'color-mix(in srgb, var(--danger) 30%, transparent)' };
  }
  if (['rede', 'offline', 'conexão', 'wi-fi', 'mqtt', 'sensor'].some(termo => msg.includes(termo))) {
    return { type: 'NETWORK', label: 'Rede / conectividade', icon: WifiOff, color: 'var(--info)', bg: 'color-mix(in srgb, var(--info) 10%, transparent)', border: 'color-mix(in srgb, var(--info) 30%, transparent)' };
  }
  return { type: 'OTHER', label: 'Auditoria geral', icon: FileCode2, color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 10%, transparent)', border: 'color-mix(in srgb, var(--success) 30%, transparent)' };
}

/**
 * Gera um identificador visual reproduzível, sem alegar assinatura criptográfica.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {string|number} id - Identificador do registro ou recurso processado.
 * @param {unknown} dateStr - Valor de date str consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function generateEventId(id, dateStr) {
  const raw = `${id}-${dateStr}-thermosync-log`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash) + raw.charCodeAt(i);
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Visualizador de histórico operacional com triagem, busca, resumo e exportação.
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
 * @param {unknown} props.historicoFiltradoLista - Propriedade historicoFiltradoLista usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.gerarExportacao - Propriedade gerarExportacao usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HistoricoLogs({ historicoFiltradoLista = [], gerarExportacao }) {
  const [buscaLog, setBuscaLog] = usePersistentState('termosync_logs_search', '');
  const [filtroTipo, setFiltroTipo] = usePersistentState('termosync_logs_type', 'ALL');
  const [filtroPeriodo, setFiltroPeriodo] = usePersistentState('termosync_logs_period', 'ALL');
  const [filtroResolucao, setFiltroResolucao] = usePersistentState('termosync_logs_resolution', 'ALL');
  const [limiteVisivel, setLimiteVisivel] = useState(PAGE_SIZE);
  const [referenciaTempo] = useState(Date.now);
  const buscaAdiada = useDeferredValue(buscaLog.trim().toLowerCase());

  // Todos os controles atuam sobre a mesma coleção antes da paginação visual.
  const logsExibidos = useMemo(() => {
    const horasPeriodo = { '24H': 24, '7D': 168, '30D': 720 };
    return historicoFiltradoLista
      .filter((log) => {
        const texto = [log.equipamento_nome, log.mensagem, log.nota_resolucao, log.setor]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (buscaAdiada && !texto.includes(buscaAdiada)) return false;
        if (filtroTipo !== 'ALL' && getLogInteligencia(log.mensagem).type !== filtroTipo) return false;
        if (filtroResolucao === 'RESOLVED' && !log.nota_resolucao) return false;
        if (filtroResolucao === 'PENDING' && log.nota_resolucao) return false;
        if (filtroPeriodo !== 'ALL') {
          const instante = new Date(log.data_hora).getTime();
          if (Number.isNaN(instante) || referenciaTempo - instante > horasPeriodo[filtroPeriodo] * 60 * 60 * 1000) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
  }, [historicoFiltradoLista, buscaAdiada, filtroTipo, filtroPeriodo, filtroResolucao, referenciaTempo]);

  const kpis = useMemo(() => logsExibidos.reduce((totals, log) => {
    const type = getLogInteligencia(log.mensagem).type.toLowerCase();
    totals[type] = (totals[type] || 0) + 1;
    totals[log.nota_resolucao ? 'resolved' : 'pending'] += 1;
    return totals;
  }, { thermal: 0, power: 0, network: 0, security: 0, other: 0, resolved: 0, pending: 0 }), [logsExibidos]);

  const logsVisiveis = logsExibidos.slice(0, limiteVisivel);
  /**
   * Atualiza atualizar filtro mantendo o estado persistido em sincronia.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} setter - Valor de setter consumido por esta rotina.
   * @param {unknown} valor - Valor de valor consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const atualizarFiltro = (setter, valor) => {
    setter(valor);
    setLimiteVisivel(PAGE_SIZE);
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="siem-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle"><Fingerprint size={28} /></div>
          <div>
            <h2 className="hero-main-title">Histórico de Logs</h2>
            <span className="hero-subtitle">Investigação de eventos, acessos, falhas técnicas e ações corretivas.</span>
          </div>
        </div>
        <div className="audit-export-actions">
          <button className="btn-export-log pdf" onClick={() => gerarExportacao('pdf', logsExibidos)} disabled={!logsExibidos.length} title="Exportar o recorte filtrado em PDF">
            <FileText size={16} /> Exportar PDF
          </button>
          <button className="btn-export-log csv" onClick={() => gerarExportacao('csv', logsExibidos)} disabled={!logsExibidos.length} title="Exportar o recorte filtrado em CSV">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="log-kpi-grid stagger-2">
        <div><Activity size={18}/><span>Eventos filtrados<strong>{logsExibidos.length}</strong></span></div>
        <div><CheckCircle2 size={18}/><span>Resolvidos<strong>{kpis.resolved}</strong></span></div>
        <div><CircleAlert size={18}/><span>Sem resolução<strong>{kpis.pending}</strong></span></div>
        <div><ShieldAlert size={18}/><span>Segurança e rede<strong>{kpis.security + kpis.network}</strong></span></div>
      </div>

      <div className="audit-triage-panel stagger-2">
        <div className="triage-search">
          <Search size={18} color="var(--text-muted)" />
          <input type="search" placeholder="Buscar por mensagem, equipamento, setor ou resolução" value={buscaLog} onChange={event => atualizarFiltro(setBuscaLog, event.target.value)} />
        </div>
        <div className="log-select-filters">
          <label><Clock3 size={14}/><select value={filtroPeriodo} onChange={event => atualizarFiltro(setFiltroPeriodo, event.target.value)}>
            <option value="ALL">Todo o período</option><option value="24H">Últimas 24 horas</option><option value="7D">Últimos 7 dias</option><option value="30D">Últimos 30 dias</option>
          </select></label>
          <label><CheckCircle2 size={14}/><select value={filtroResolucao} onChange={event => atualizarFiltro(setFiltroResolucao, event.target.value)}>
            <option value="ALL">Todas as resoluções</option><option value="RESOLVED">Com resolução</option><option value="PENDING">Sem resolução</option>
          </select></label>
        </div>
        <div className="triage-filters-group">
          {[
            ['ALL', 'Visão global', Filter, historicoFiltradoLista.length],
            ['THERMAL', 'Térmico', Thermometer, kpis.thermal],
            ['POWER', 'Energia', Power, kpis.power],
            ['NETWORK', 'Rede', WifiOff, kpis.network],
            ['SECURITY', 'IAM', KeyRound, kpis.security]
          ].map(([tipo, rotulo, Icon, total]) => (
            <button key={tipo} className={`triage-chip ${filtroTipo === tipo ? `active ${tipo.toLowerCase()}` : ''}`} onClick={() => atualizarFiltro(setFiltroTipo, tipo)}>
              <Icon size={14}/> {rotulo}<span className="chip-count">{total}</span>
            </button>
          ))}
        </div>
      </div>

      {!logsExibidos.length ? (
        <div className="log-empty-state stagger-3">
          <div className="empty-shield-box"><Search size={40} /></div>
          <h3>Nenhum log encontrado</h3>
          <p>Nenhum evento corresponde à combinação atual de busca, período, categoria e resolução.</p>
        </div>
      ) : (
        <>
          <div className="log-result-count">Exibindo {Math.min(limiteVisivel, logsExibidos.length)} de {logsExibidos.length} eventos</div>
          <div className="timeline-container stagger-3">
            {logsVisiveis.map((hist, index) => {
              const intel = getLogInteligencia(hist.mensagem);
              const Icon = intel.icon;
              const eventId = generateEventId(hist.id || index, hist.data_hora);
              return (
                <div key={hist.id || `${hist.data_hora}-${index}`} className="timeline-event">
                  <div className="timeline-connector">
                    <div className="timeline-dot" style={{ background: intel.bg, borderColor: intel.color, color: intel.color }}><Icon size={14} /></div>
                    {index < logsVisiveis.length - 1 && <div className="timeline-line" />}
                  </div>
                  <article className="log-card" style={{ '--log-color': intel.color }}>
                    <div className="log-card-header">
                      <div className="log-card-identifiers">
                        <div className="log-type-badge" style={{ background: intel.bg, color: intel.color, border: `1px solid ${intel.border}` }}>{intel.label}</div>
                        <div className="log-crypto-hash" title="Identificador visual derivado do registro"><FileCode2 size={14}/><span className="hash-string">ID {eventId}</span></div>
                      </div>
                      <div className="log-datetime"><Clock3 size={14}/>{new Date(hist.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}</div>
                    </div>
                    <div className="log-card-body">
                      <h4 className="log-equip-title"><Cpu size={18}/> {hist.equipamento_nome || 'Sistema'}<span className="equip-setor-tag">{hist.setor || 'Sem setor'}</span></h4>
                      <div className="log-issue-box"><Terminal size={16} className="terminal-icon"/><span className="log-issue-text"><strong>Evento:</strong> {hist.mensagem}</span></div>
                    </div>
                    {hist.nota_resolucao ? (
                      <div className="log-card-resolution">
                        <div className="resolution-header"><CheckCircle2 size={16}/> Ação corretiva registrada</div>
                        <div className="resolution-text">{hist.nota_resolucao}</div>
                        <div className="resolution-stamp">
                          <div className="operator-id"><UserCheck size={14}/> Resolução vinculada ao evento</div>
                          <div className="stamp-watermark"><CheckCircle2 size={14}/> COM RESOLUÇÃO</div>
                        </div>
                      </div>
                    ) : <div className="log-pending-resolution"><CircleAlert size={15}/> Evento sem nota de resolução</div>}
                  </article>
                </div>
              );
            })}
          </div>
          {limiteVisivel < logsExibidos.length && <button className="load-more-logs" type="button" onClick={() => setLimiteVisivel(valor => valor + PAGE_SIZE)}>Carregar mais {Math.min(PAGE_SIZE, logsExibidos.length - limiteVisivel)} eventos</button>}
        </>
      )}
    </div>
  );
}
