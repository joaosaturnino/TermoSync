/**
 * Módulo: frontend/src/pages/Dashboard/Dashboard.jsx
 * Responsabilidade: Implementa a tela Dashboard, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { Gauge, Signal } from 'lucide-react';
import ActionCenter from '../../components/ActionCenter';
import React, { useCallback, memo, useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  AlertTriangle, Wifi, Snowflake, Power, DoorOpen, Droplets, 
  ActivitySquare, ClipboardCheck, CheckCircle, Server, 
  Activity, ThermometerSnowflake, AlertOctagon, MessageSquare, Send, X, Clock, Radio, Zap, DownloadCloud, Tv, Search
} from 'lucide-react';
import './Dashboard.css';
import EmptyState from '../../components/EmptyState';

const TELEMETRY_STALE_AFTER_MS = 3 * 60 * 1000;
const TICKER_EVENT_LIMIT = 12;
const INCIDENTS_PAGE_SIZE = 12;

/**
 * Busca ou monta os dados de get alert config usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} tipo_alerta - Valor de tipo alerta consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getAlertConfig = (tipo_alerta) => {
  const configs = {
    'REDE': { icon: Wifi, color: 'var(--warning)', action: 'Analisar Rede', critical: true },
    'DEGELO': { icon: Snowflake, color: 'var(--secondary)', action: 'Finalizar Degelo', critical: false },
    'MECANICA': { icon: Power, color: 'var(--warning)', action: 'Acionar Manutenção', critical: true },
    'PORTA': { icon: DoorOpen, color: 'var(--danger)', action: 'Verificar Porta', critical: true },
    'TEMPERATURA': { icon: ThermometerSnowflake, color: 'var(--danger)', action: 'Normalizar Temp.', critical: true },
    'UMIDADE': { icon: Droplets, color: 'var(--info)', action: 'Ajustar Umidade', critical: false },
    'METROLOGIA': { icon: ClipboardCheck, color: 'var(--accent-violet)', action: 'Agendar Calibração', critical: true },
    'PREDITIVO': { icon: ActivitySquare, color: 'var(--accent-violet)', action: 'Prevenção', critical: false }
  };
  return configs[tipo_alerta] || { icon: AlertTriangle, color: 'var(--danger)', action: 'Investigar', critical: true };
};

/**
 * Converte leituras numéricas sem interpretar valor ausente como zero.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; troca eventos em tempo real
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const parseMeasurement = (value) => { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }; /* Normaliza flags booleanas recebidas como boolean, número ou texto pelo MySQL/socket. */ const parseTelemetryFlag = (value) => value === true || value === 1 || value === '1'; /* Verifica se a temperatura pertence a uma comunicação recente do equipamento. */ const hasCurrentTelemetry = (equipment, temperature) => { if (temperature == null) return false; const connection = String(equipment.status_conexao || '').toLowerCase(); if (connection === 'offline' || connection === 'sem-sinal') return false; const timestamp = equipment.atualizado_em || equipment.ultima_comunicacao; if (!timestamp) return connection === 'online'; const readingAt = new Date(timestamp).getTime(); return Number.isFinite(readingAt) && Date.now() - readingAt <= TELEMETRY_STALE_AFTER_MS; };  const StatCard = memo(({ title, value, detail, icon: Icon, iconBg, valClass = '', isPulsing = false }) => ( <div className={`summary-card ${isPulsing ? 'pulsing-card' : ''}`}> <div className="summary-header"><span className="summary-title">{title}</span><div className={`summary-icon-wrapper ${iconBg}`}><Icon size={22} className="kpi-icon" /></div></div> <div className="summary-body"><span className={`summary-value ${valClass} ${isPulsing ? 'pulse-danger-text' : ''}`}>{value ?? 0}</span>{isPulsing && <span className="live-pulse-dot bg-danger"></span>}</div> {detail && <span className="summary-detail">{detail}</span>} </div> )); /* Classifica o estado atual sem misturar ocorrências históricas com a última leitura. */ const classifyEquipment = (equipment) => { const temperature = parseMeasurement(equipment.ultima_temp); const minimum = parseMeasurement(equipment.temp_min); const maximum = parseMeasurement(equipment.temp_max); const hasTelemetry = hasCurrentTelemetry(equipment, temperature); if (!hasTelemetry) return { key: 'offline', label: 'Sem telemetria', tone: 'neutral', priority: 5 }; if (parseTelemetryFlag(equipment.em_degelo)) return { key: 'defrost', label: 'Em degelo', tone: 'info', priority: 2 }; const motorOn = parseTelemetryFlag(equipment.motor_ligado); const aboveMaximum = maximum != null && temperature > maximum; const belowMinimum = minimum != null && temperature < minimum; if (!motorOn && maximum != null && temperature >= maximum + 10) return { key: 'critical', label: 'Falha mecânica', tone: 'bad', priority: 6 }; if (aboveMaximum || belowMinimum) return { key: 'warning', label: 'Fora da faixa', tone: 'warn', priority: 4 }; if (!motorOn) return { key: 'resting', label: 'Em repouso', tone: 'neutral', priority: 1 }; return { key: 'healthy', label: 'Operação normal', tone: 'good', priority: 0 }; }; /* Exibe uma fila compacta para localizar rapidamente equipamentos que exigem atenção. */ const EquipmentStatusTable = memo(({ rows, filter, setFilter, query, setQuery }) => { const visibleRows = rows.filter(row => { const matchesFilter = filter === 'all' || row.status.key === filter || (filter === 'attention' && ['critical', 'warning'].includes(row.status.key)); const search = query.trim().toLowerCase(); const matchesQuery = !search || `${row.name} ${row.location}`.toLowerCase().includes(search); return matchesFilter && matchesQuery; }).slice(0, 18);
  return (
    <section className="dashboard-section dashboard-fleet-section" aria-labelledby="fleet-title">
      <div className="dashboard-section-heading">
        <div><h3 id="fleet-title">Fila operacional da frota</h3><span>Equipamentos priorizados por risco e desvio térmico</span></div>
        <div className="fleet-tools">
          <label className="fleet-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar equipamento" aria-label="Buscar equipamento" /></label>
          <div className="fleet-filter" aria-label="Filtrar equipamentos">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button>
            <button type="button" className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Atenção</button>
            <button type="button" className={filter === 'offline' ? 'active' : ''} onClick={() => setFilter('offline')}>Sem sinal</button>
          </div>
        </div>
      </div>
      {visibleRows.length === 0 ? <p className="dashboard-table-empty">Nenhum equipamento corresponde aos filtros.</p> : (
        <div className="fleet-table-scroll" tabIndex="0">
          <div className="fleet-table-head"><span>Equipamento</span><span>Temperatura</span><span>Faixa</span><span>Motor</span><span>Estado</span></div>
          {visibleRows.map((row) => (
            <div className="fleet-table-row" key={row.id}>
              <span><strong>{row.name}</strong><small>{row.location}</small></span>
              <span>{row.temperature == null ? '—' : `${row.temperature.toFixed(1)}°C`}</span>
              <span>{row.minimum == null || row.maximum == null ? 'Não definida' : `${row.minimum.toFixed(1)}° a ${row.maximum.toFixed(1)}°`}</span>
              <span>{row.motorOn ? 'Ligado' : 'Desligado'}</span>
              <span className={`fleet-status ${row.status.tone}`}><i />{row.status.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

const AlertBreakdown = memo(({ alerts = [] }) => {
  const grouped = Object.values(alerts.reduce((accumulator, alert) => {
    const type = String(alert.tipo_alerta || 'OUTROS').toUpperCase();
    if (!accumulator[type]) accumulator[type] = { type, count: 0, color: getAlertConfig(type).color };
    accumulator[type].count += 1;
    return accumulator;
  }, {})).sort((a, b) => b.count - a.count).slice(0, 6);
  const maximum = Math.max(1, ...grouped.map((item) => item.count));

  return (
    <section className="dashboard-section" aria-labelledby="alert-breakdown-title">
      <div className="dashboard-section-heading"><div><h3 id="alert-breakdown-title">Alertas por tipo</h3><span>Distribuição das ocorrências no escopo atual</span></div></div>
      {grouped.length ? <div className="alert-breakdown-list">{grouped.map((item) => (
        <div key={item.type}><span style={{ color: item.color }}>●</span><span>{item.type}</span><div><i style={{ width: `${(item.count / maximum) * 100}%`, background: item.color }} /></div><strong>{item.count}</strong></div>
      ))}</div> : <p className="dashboard-table-empty">Nenhum alerta ativo.</p>}
    </section>
  );
});

/**
 * Concentra a logica de custom tooltip para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.active - Propriedade active usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.payload - Propriedade payload usada para configurar dados ou comportamento do componente.
 * @param {boolean} options.isDarkMode - Sinalizador isDarkMode que controla este comportamento visual.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const CustomTooltip = ({ active, payload, isDarkMode }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid var(--border)', color: isDarkMode ? '#f8fafc' : '#0f172a', padding: '10px' }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{payload[0].name}</p>
        <p style={{ margin: 0, fontWeight: '700', color: payload[0].payload.fill || 'var(--info)' }}>Quantidade: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};


/**
 * Concentra a logica de empty tooltip para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const EmptyTooltip = () => (<div style={{ padding: '8px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>Aguardando telemetria...</div>);

// [NOVIDADE] Gráfico Isolado. Ele causava a lentidão por recarregar a cada temperatura.
const MemoizedDonut = memo(({ temDadosDonut, dadosDonutReativos, dadosPlaceholder, isDarkMode }) => {
  const DONUT_COLORS = { 'Ok': 'var(--success)', 'Degelo': 'var(--info)', 'Falha': 'var(--danger)', 'Sem sinal': 'var(--text-muted)' };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        {temDadosDonut ? (
          <>
            <Pie data={dadosDonutReativos} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name" stroke="none" isAnimationActive={false}>
              {dadosDonutReativos.map((entry, index) => (<Cell key={`cell-${index}`} fill={DONUT_COLORS[entry.name] || 'var(--text-muted)'} />))}
            </Pie>
            <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} isAnimationActive={false} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.85rem', fontWeight: '600', paddingBottom: '10px' }}/>
          </>
        ) : (
          <>
            <Pie data={dadosPlaceholder} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" nameKey="name" stroke="none" fill={isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} isAnimationActive={false} />
            <Tooltip content={<EmptyTooltip />} isAnimationActive={false} />
          </>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
});

// [NOVIDADE] Ticker Isolado
const NocTicker = memo(({ localAlertas }) => (
  <div className="noc-ticker-wrap stagger-4">
    <div className="noc-ticker-label">LATEST EVENTS</div>
    <div className="noc-ticker">
      <div className="ticker-content">
        {localAlertas.length > 0 ? (
          localAlertas.slice(0, TICKER_EVENT_LIMIT).map((n, i) => (
            <span key={`ticker-${n.id || i}`} className={`ticker-item ${n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA' ? 'ticker-critical' : 'ticker-warning'}`}>
              [{new Date(n.data_hora).toLocaleTimeString()}] {String(n.filial || 'MATRIZ').toUpperCase()} - {String(n.equipamento_nome || 'EQUIPAMENTO').toUpperCase()}: {String(n.mensagem || '').toUpperCase()}
            </span>
          ))
        ) : (
          <span className="ticker-item ticker-success">SISTEMA 100% OPERACIONAL - NENHUMA OCORRÊNCIA REGISTRADA NA REDE - MONITORAMENTO DE SENSOR ATIVO</span>
        )}
      </div>
    </div>
  </div>
));

const AlertCard = memo(({ notif, onResolve, onAbrirChat, isOffline }) => {
  const tipo = getAlertConfig(notif.tipo_alerta);
  const IconCmp = tipo.icon;

  return (
    <div className={`card card-alert ${tipo.critical ? 'critical-alert' : ''}`} style={{ '--alert-color': tipo.color }}>
      <div className="card-top">
        <div className="alert-title-group">
          <div className="alert-icon-box"><IconCmp size={20} color={tipo.color} /></div>
          <div className="alert-equip-info">
            <span className="alert-equip-name">{notif.equipamento_nome || 'Equipamento'}</span>
            <div className="badges-container">
              <span className="badge-setor">{notif.setor || 'Geral'}</span>
              <span className="badge-setor">{notif.filial || 'Matriz'}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="alert-body">
        <p className="alert-msg">{notif.mensagem}</p>
        <span className="time-badge"><Clock size={12} />{new Date(notif.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      <div className="alert-actions">
        <button className="btn btn-alert-action flex-1" onClick={() => onResolve(notif.id)} disabled={isOffline} style={{ backgroundColor: tipo.color }}>{tipo.action}</button>
        {tipo.critical && (<button className="btn btn-chat-internal" onClick={() => onAbrirChat(notif)} title="Escalar problema para a Equipe Técnica"><MessageSquare size={18} /></button>)}
      </div>
    </div>
  );
});


/**
 * Concentra a logica de chat drawer para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; troca eventos em tempo real
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.notif - Propriedade notif usada para configurar dados ou comportamento do componente.
 * @param {Function} options.onClose - Callback onClose fornecido pelo componente responsável.
 * @param {unknown} options.contatosDb - Propriedade contatosDb usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.irParaChat - Propriedade irParaChat usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.userId - Propriedade userId usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.nomeLogado - Propriedade nomeLogado usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.setHistoricoChat - Propriedade setHistoricoChat usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const ChatDrawer = ({ notif, onClose, contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat }) => {
  const [contatoSelecionado, setContatoSelecionado] = useState('');
  const [novaMensagem, setNovaMensagem] = useState(`[ALERTA CRÍTICO] A máquina ${notif.equipamento_nome || 'Desconhecida'} (${notif.filial || 'Matriz'}) registrou uma anomalia grave. Ocorrência: ${notif.mensagem}. Solicito verificação técnica imediata.`);


  /**
   * Processa a interacao de handle enviar e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; troca eventos em tempo real
   *
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleEnviar = (e) => {
    e.preventDefault();
    if (!contatoSelecionado) return showToast('Selecione um destinatário.', 'warning');
    if (!novaMensagem.trim()) return;

    const msg = { id: Date.now(), remetenteId: userId, remetenteNome: nomeLogado, destinoId: contatoSelecionado, texto: novaMensagem, data: new Date(), tipo: 'sent' };
    setHistoricoChat(prev => [...prev, msg]);
    if (socket) socket.emit('enviar_mensagem_chat', msg);

    showToast('Alerta transmitido à equipe com sucesso!', 'success');
    onClose();
    setTimeout(() => { irParaChat(contatoSelecionado === 'todos' ? null : contatoSelecionado); }, 400); 
  };

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="chat-drawer-header"><div className="chat-header-info"><h4>Escalar Emergência</h4><p>{notif.equipamento_nome || 'Equipamento'} • {notif.filial || 'Matriz'}</p></div><button className="btn-close-drawer" onClick={onClose}><X size={24} /></button></div>
        <div className="chat-drawer-body">
          <div className="form-group"><label>1. Direcionar alerta para:</label><select className="select-input w-100" value={contatoSelecionado} onChange={(e) => setContatoSelecionado(e.target.value)}><option value="">-- Escolha a equipe de intervenção --</option>{contatosDb?.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}<option value="todos">Toda a Rede (Broadcast de Emergência)</option></select></div>
          <div className="form-group"><label>2. Relatório do Incidente:</label><textarea className="textarea-input" value={novaMensagem} onChange={(e) => setNovaMensagem(e.target.value)} rows="6" /></div>
        </div>
        <div className="chat-drawer-footer"><button className="btn btn-outline w-100" onClick={onClose} style={{ marginBottom: '10px' }}>Cancelar</button><button className="btn btn-primary w-100 btn-escalar" onClick={handleEnviar}><Send size={18} /> Transmitir Alerta</button></div>
      </div>
    </div>
  );
};


/**
 * ===================================================================== Dashboard Principal
 * =====================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.qtdTotal - Propriedade qtdTotal usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.dadosDonutStatus - Propriedade dadosDonutStatus usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.notificacoesDaFilial - Propriedade notificacoesDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.resolverTodasNotificacoes - Propriedade resolverTodasNotificacoes usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.pedirNotaResolucao - Propriedade pedirNotaResolucao usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isDarkMode - Sinalizador isDarkMode que controla este comportamento visual.
 * @param {unknown} props.contatosDb - Propriedade contatosDb usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.irParaChat - Propriedade irParaChat usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userId - Propriedade userId usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.nomeLogado - Propriedade nomeLogado usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setHistoricoChat - Propriedade setHistoricoChat usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Dashboard({
  qtdTotal,
  dadosDonutStatus: _dadosDonutStatus = [],
  notificacoesDaFilial = [], resolverTodasNotificacoes, isOffline, pedirNotaResolucao, isDarkMode,
  contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat,
  filialAtiva, equipamentosDaFilial, chamados = [], api, userRole = 'LOJA', onNavigate
}) {
  
  const [chatAtivo, setChatAtivo] = useState(null);
  const [filtroRisco, setFiltroRisco] = usePersistentState('termosync_dashboard_risk_filter', 'TODOS');
  const [fleetFilter, setFleetFilter] = usePersistentState('termosync_dashboard_fleet_filter', 'all');
  const [fleetQuery, setFleetQuery] = useState('');
  const [incidentLimit, setIncidentLimit] = useState(INCIDENTS_PAGE_SIZE);
  const [lastUpdateAt, setLastUpdateAt] = useState(() => Date.now());

  const latestTelemetryAt = useMemo(() => {
     /**
      * Concentra a logica de timestamps para manter o restante do tela mais legivel.
      *
      * Responsabilidade: mantém este comportamento isolado para que validação,
      * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
      *
      * Fluxo principal:
      * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
      *
      * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
      *
      * @returns {unknown} Resultado calculado para consumo do chamador.
      * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
      */

    /**
     * Concentra a logica de timestamps para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const timestamps = (equipamentosDaFilial || [])
      .map(equipment => new Date(equipment.atualizado_em || equipment.ultima_comunicacao || 0).getTime())
      .filter(timestamp => Number.isFinite(timestamp) && timestamp > 0);
    return timestamps.length ? Math.max(...timestamps) : lastUpdateAt;
  }, [equipamentosDaFilial, lastUpdateAt]);

  const [localAlertas, setLocalAlertas] = useState(notificacoesDaFilial || []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setLocalAlertas(notificacoesDaFilial || []);
      setLastUpdateAt(Date.now());
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [notificacoesDaFilial]);

  useEffect(() => {
    if (!socket) return;
    

    /**
     * Processa a interacao de handle alerta removido e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @param {object|Array} data - Dados de entrada que serão validados e transformados pelo fluxo.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleAlertaRemovido = (data) => {
      setLocalAlertas(prev => prev.filter(n => !(n.equipamento_id === data.equipamento_id && n.tipo_alerta === data.tipo_alerta)));
    };


    /**
     * Processa a interacao de handle alerta removido id e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @param {object|Array} data - Dados de entrada que serão validados e transformados pelo fluxo.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleAlertaRemovidoId = (data) => {
      setLocalAlertas(prev => prev.filter(n => String(n.id) !== String(data.id)));
    };


    /**
     * Processa a interacao de handle alertas limpos e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleAlertasLimpos = () => {
      setLocalAlertas([]);
    };

    socket.on('alerta_removido', handleAlertaRemovido);
    socket.on('alerta_removido_id', handleAlertaRemovidoId);
    socket.on('alertas_limpos', handleAlertasLimpos);
    
    return () => {
      socket.off('alerta_removido', handleAlertaRemovido);
      socket.off('alerta_removido_id', handleAlertaRemovidoId);
      socket.off('alertas_limpos', handleAlertasLimpos);
    };
  }, [socket]);

  const { operandoReal, falhaReal, maquinasEmFalha, maquinasDegelo, maquinasSemSinal } = useMemo(() => {
    const qtAlertas = localAlertas.length;

    /**
     * Concentra a logica de states para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const states = (equipamentosDaFilial || []).map(equipment => classifyEquipment(equipment));
    const qtDegeloFinal = states.filter(state => state.key === 'defrost').length;
    const qtOperando = states.filter(state => state.key === 'healthy' || state.key === 'resting').length;
    const qtMaquinasComFalha = states.filter(state => state.key === 'critical' || state.key === 'warning').length;
    const qtSemSinal = states.filter(state => state.key === 'offline').length;

    return { 
        operandoReal: qtOperando, 
        falhaReal: qtAlertas, 
        maquinasEmFalha: qtMaquinasComFalha,
        maquinasDegelo: qtDegeloFinal,
        maquinasSemSinal: qtSemSinal
    };
  }, [localAlertas, equipamentosDaFilial]);

  const dadosDonutReativos = useMemo(() => [ 
    { name: 'Ok', value: operandoReal, color: 'var(--success)' }, 
    { name: 'Degelo', value: maquinasDegelo, color: 'var(--info)' },
    { name: 'Falha', value: maquinasEmFalha, color: 'var(--danger)' },
    { name: 'Sem sinal', value: maquinasSemSinal, color: 'var(--text-muted)' }
  ].filter(d => d.value > 0), [operandoReal, maquinasDegelo, maquinasEmFalha, maquinasSemSinal]);

  const abrirChatInterno = useCallback((notif) => { setChatAtivo(notif); }, []);
  const handleResolve = useCallback((id) => { pedirNotaResolucao(id); }, [pedirNotaResolucao]);

  const saudeRede = useMemo(() => {
    if (!qtdTotal || qtdTotal === 0) return { score: 0, status: 'SEM TELEMETRIA', class: 'warning' };
    const score = Math.round((operandoReal / qtdTotal) * 100);
    if (score < 80) return { score, status: 'CRÍTICO', class: 'critical' };
    if (score < 95) return { score, status: 'ATENÇÃO', class: 'warning' };
    return { score, status: 'ESTÁVEL', class: 'stable' };
  }, [qtdTotal, operandoReal]);

  const fleetRows = useMemo(() => {
    return (equipamentosDaFilial || []).map(equipment => {
      const temperature = parseMeasurement(equipment.ultima_temp);
      const minimum = parseMeasurement(equipment.temp_min);
      const maximum = parseMeasurement(equipment.temp_max);
      const status = classifyEquipment(equipment);
      return {
        id: equipment.id,
        name: equipment.nome || `Equipamento ${equipment.id}`,
        location: [equipment.setor, equipment.filial].filter(Boolean).join(' · ') || 'Local não informado',
        temperature,
        minimum,
        maximum,
        motor: parseTelemetryFlag(equipment.motor_ligado),
        defrost: parseTelemetryFlag(equipment.em_degelo),
        hasTelemetry: hasCurrentTelemetry(equipment, temperature),
        status
      };
    }).sort((a, b) => b.status.priority - a.status.priority || a.name.localeCompare(b.name, 'pt-BR'));
  }, [equipamentosDaFilial]);

  const fleetInsights = useMemo(() => {
    const temperatures = fleetRows.map(row => row.temperature).filter(Number.isFinite);
    const withTelemetry = fleetRows.filter(row => row.hasTelemetry).length;
    const attention = fleetRows.filter(row => row.status.key === 'critical' || row.status.key === 'warning').length;
    const offline = fleetRows.filter(row => row.status.key === 'offline').length;
    return {
      coverage: fleetRows.length ? Math.round((withTelemetry / fleetRows.length) * 100) : 0,
      averageTemperature: temperatures.length ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : null,
      attention,
      offline
    };
  }, [fleetRows]);

  const alertasExibidos = useMemo(() => {
    if (!localAlertas) return [];
    if (filtroRisco === 'TODOS') return localAlertas;
    return localAlertas.filter(n => {
      const isCritical = n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA';
      return filtroRisco === 'CRITICO' ? isCritical : !isCritical;
    });
  }, [localAlertas, filtroRisco]);

  const alertasVisiveis = useMemo(
    () => alertasExibidos.slice(0, incidentLimit),
    [alertasExibidos, incidentLimit]
  );

  const changeRiskFilter = useCallback((filter) => {
    setFiltroRisco(filter);
    setIncidentLimit(INCIDENTS_PAGE_SIZE);
  }, [setFiltroRisco]);


  /**
   * Gera gerar snapshot pdf com os dados necessarios para o proximo passo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const gerarSnapshotPDF = () => {
    showToast('A compilar Snapshot Operacional...', 'info');
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("TermoSync - Snapshot Executivo do Turno", 14, 20);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Status da Rede: ${saudeRede.status} (${saudeRede.score}%)`, 14, 34);
    
    autoTable(doc, {
      startY: 45,
      head: [['Métrica Operacional', 'Valor Atual']],
      body: [
        ['Total de Máquinas na Rede', qtdTotal],
        ['Operação Normal (Dentro do SLA)', operandoReal],
        ['Máquinas em Ciclo de Degelo', maquinasDegelo],
        ['Máquinas em Alerta/Falha', maquinasEmFalha],
        ['Máquinas sem sinal atual', maquinasSemSinal],
        ['Total de Ocorrências Individuais', falhaReal]
      ]
    });

    if (localAlertas.length > 0) {
      doc.text("Listagem de Alarmes Ativos:", 14, doc.lastAutoTable.finalY + 15);
      const alarmesBody = localAlertas.map(n => [n.equipamento_nome || 'N/A', n.tipo_alerta, n.mensagem || '']);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Equipamento', 'Tipo', 'Descrição']],
        body: alarmesBody,
        theme: 'grid'
      });
    }

    doc.save(`Snapshot_TermoSync_${Date.now()}.pdf`);
    showToast('Download do Relatório concluído.', 'success');
  };

  const temDadosDonut = Boolean(qtdTotal > 0 && dadosDonutReativos?.length);
  const dadosPlaceholder = [{ name: 'Aguardando Dados', value: 1 }];
  /** Abre o Painel TV em uma nova aba preservando a sessão autenticada atual. */
  const openTvPanel = useCallback(() => {
    const authToken = sessionStorage.getItem('token');
    if (!authToken) {
      showToast('Sua sessão expirou. Entre novamente para abrir o Painel TV.', 'warning');
      return;
    }

    const branch = filialAtiva || 'Todas';
    const panelUrl = `/painel-tv/${encodeURIComponent(branch)}#panel_token=${encodeURIComponent(authToken)}`;
    const panelWindow = window.open(panelUrl, '_blank', 'noopener,noreferrer');
    if (!panelWindow) {
      showToast('O navegador bloqueou a abertura do Painel TV.', 'warning');
      return;
    }
  }, [filialAtiva, showToast]);

  return (
    <>
      {(!temDadosDonut && (!localAlertas || localAlertas.length === 0) && (!qtdTotal || qtdTotal === 0)) ? (
        <EmptyState title="Sem telemetria" description="Nenhuma telemetria disponível no momento. Verifique a conexão com os gateways ou aguarde novos dados." />
      ) : (
        <div className="anim-fade-in dashboard-container">

          <section className={`dashboard-command-strip ${saudeRede.class} stagger-1`} aria-label="Resumo operacional">
            <div className="dashboard-command-status">
              <span className="dashboard-command-icon"><Zap size={21} /></span>
              <div><span>Integridade operacional</span><strong>{saudeRede.status}</strong></div>
            </div>
            <div className="dashboard-command-context">
              <div><span>Escopo</span><strong>{filialAtiva || 'Todas as unidades'}</strong></div>
              <div><span>Última atualização</span><strong>{new Date(latestTelemetryAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></div>
              <div><span>Conectividade</span><strong className={isOffline ? 'bad' : 'good'}><i />{isOffline ? 'Offline' : 'Tempo real'}</strong></div>
            </div>
            <div className="dashboard-command-actions">
              <button type="button" className="btn btn-outline" onClick={gerarSnapshotPDF}><DownloadCloud size={16} /> Snapshot PDF</button>
              <button type="button" className="btn btn-primary" onClick={openTvPanel} title="Abrir painel TV em uma nova aba"><Tv size={16} /> Painel TV</button>
            </div>
            <div className="dashboard-command-score">
              <strong>{saudeRede.score}%</strong><span>da frota em operação segura</span>
              <div><i style={{ width: `${saudeRede.score}%` }} /></div>
            </div>
          </section>

          <div className="summary-cards dashboard-kpi-grid stagger-2">
            <StatCard title="Frota monitorada" value={qtdTotal} detail={`${fleetInsights.coverage}% com telemetria`} icon={Server} iconBg="icon-bg-gray" />
            <StatCard title="Operação segura" value={operandoReal} detail={`${saudeRede.score}% do total`} icon={Activity} iconBg="icon-bg-green" valClass="val-green" />
            <StatCard title="Exigem atenção" value={fleetInsights.attention} detail={`${falhaReal} ocorrências abertas`} icon={AlertOctagon} iconBg="icon-bg-red" valClass="val-red" isPulsing={fleetInsights.attention > 0} />
            <StatCard title="Sem telemetria" value={fleetInsights.offline} detail="Equipamentos sem leitura atual" icon={Signal} iconBg="icon-bg-warning" valClass={fleetInsights.offline ? 'val-warning' : ''} />
            <StatCard title="Temperatura média" value={fleetInsights.averageTemperature == null ? '—' : `${fleetInsights.averageTemperature.toFixed(1)}°`} detail="Média das leituras disponíveis" icon={Gauge} iconBg="icon-bg-blue" valClass="val-blue" />
          </div>

          <div className="dashboard-insight-grid stagger-2">
            <section className="donut-container" aria-labelledby="fleet-state-title">
              <div className="dashboard-section-heading"><div><h3 id="fleet-state-title">Estado da frota</h3><span>Distribuição atual dos equipamentos</span></div></div>
              <div className="donut-chart-wrap">
                <MemoizedDonut temDadosDonut={temDadosDonut} dadosDonutReativos={dadosDonutReativos} dadosPlaceholder={dadosPlaceholder} isDarkMode={isDarkMode} />
                <div className="donut-center" aria-hidden="true"><strong>{qtdTotal || 0}</strong><span>equipamentos</span></div>
              </div>
            </section>
            <AlertBreakdown alerts={localAlertas} />
          </div>

          <div className="dashboard-operations-hub stagger-3" aria-label="Central de ações e fila operacional">
            <ActionCenter
              api={api}
              alertas={localAlertas}
              chamados={chamados}
              equipamentos={equipamentosDaFilial}
              filialAtiva={filialAtiva}
              userRole={userRole}
              onNavigate={onNavigate}
              socket={socket}
            />
            <EquipmentStatusTable rows={fleetRows} filter={fleetFilter} setFilter={setFleetFilter} query={fleetQuery} setQuery={setFleetQuery} />
          </div>

          <div className="flex-header stagger-3" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <h3 className="section-title">Monitor de Incidentes Ativos</h3>
            
            <div className="triage-actions">
              {localAlertas?.length > 0 && (
                <div className="triage-filters">
                  <button className={`btn-filter ${filtroRisco === 'TODOS' ? 'active' : ''}`} onClick={() => changeRiskFilter('TODOS')}>Todos</button>
                  <button className={`btn-filter critical ${filtroRisco === 'CRITICO' ? 'active' : ''}`} onClick={() => changeRiskFilter('CRITICO')}>Críticos</button>
                  <button className={`btn-filter warning ${filtroRisco === 'AVISO' ? 'active' : ''}`} onClick={() => changeRiskFilter('AVISO')}>Avisos</button>
                </div>
              )}
              {localAlertas?.length > 0 && (
                <button className="btn btn-outline btn-archive" onClick={resolverTodasNotificacoes} disabled={isOffline}>
                  <CheckCircle size={18} /> Normalizar Todos
                </button>
              )}
            </div>
          </div>
          
          {!alertasExibidos?.length ? (
            <div className="empty-state dashboard-empty stagger-3">
              <div className="radar-box">
                 <div className="radar-scanner"></div><div className="radar-blip blip-1"></div><div className="radar-blip blip-2"></div><div className="radar-blip blip-3"></div>
                 <Radio size={40} className="radar-icon" color="var(--success)" />
              </div>
              <h3 className="empty-title">Nenhuma Ocorrência Detectada</h3>
              <p className="empty-subtitle">{filtroRisco === 'TODOS' ? 'O radar não detecta anomalias térmicas ou mecânicas. A infraestrutura encontra-se operacional e dentro das métricas.' : 'Não existem ocorrências ativas para o filtro de risco selecionado.'}</p>
            </div>
          ) : (
            <div className="grid-cards stagger-3">
              {alertasVisiveis.map(notif => (<AlertCard key={`alert-${notif.id}`} notif={notif} onResolve={handleResolve} onAbrirChat={abrirChatInterno} isOffline={isOffline} />))}
            </div>
          )}

          {alertasExibidos.length > alertasVisiveis.length && (
            <button type="button" className="dashboard-load-more" onClick={() => setIncidentLimit(limit => limit + INCIDENTS_PAGE_SIZE)}>
              Mostrar mais incidentes ({alertasExibidos.length - alertasVisiveis.length})
            </button>
          )}

          <NocTicker localAlertas={localAlertas} />

          {chatAtivo && (
            <ChatDrawer notif={chatAtivo} onClose={() => setChatAtivo(null)} contatosDb={contatosDb} irParaChat={irParaChat} showToast={showToast} socket={socket} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat} />
          )}
        </div>
      )}
    </>
  );
}
