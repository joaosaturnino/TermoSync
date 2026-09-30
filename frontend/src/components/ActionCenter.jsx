/**
 * Módulo: frontend/src/components/ActionCenter.jsx
 * Responsabilidade: Implementa o componente reutilizável Action Center e seu contrato visual.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, RadioTower, Thermometer, Wrench } from 'lucide-react';
import './ActionCenter.css';

const CLOSED_STATUSES = new Set(['concluído', 'concluido', 'fechado', 'cancelado']);
const CRITICAL_ALERTS = new Set(['TEMPERATURA_CRITICA', 'FALHA', 'EMERGENCIA', 'OFFLINE']);
const roleCopy = {
  DEV: ['Fila técnica', 'Eventos prioritários, chamados e verificações que exigem atuação.'],
  ADMIN: ['Fila operacional', 'Pendências mais importantes da operação sob sua gestão.'],
  MANUTENCAO: ['Fila de manutenção', 'Intervenções e verificações técnicas aguardando atendimento.'],
  LOJA: ['Ações da loja', 'Alertas e tarefas que precisam de atenção neste turno.']
};

/**
 * Renderiza o componente is Closed e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} status - Valor de status consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const isClosed = (status) => CLOSED_STATUSES.has(String(status || '').trim().toLowerCase());

/**
 * Renderiza o componente is Offline e encapsula sua interacao visual reutilizavel.
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
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const isOffline = (equipment) => ['offline', 'sem-sinal'].includes(String(equipment.status_conexao || '').toLowerCase());


/**
 * Renderiza o componente Action Center e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.alertas - Propriedade alertas usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.equipamentos - Propriedade equipamentos usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function ActionCenter({
  api,
  alertas = [],
  chamados = [],
  equipamentos = [],
  filialAtiva,
  userRole,
  onNavigate,
  socket
}) {
  const [tarefas, setTarefas] = useState([]);

  useEffect(() => {
    let active = true;


    /**
     * Renderiza o componente load Tasks e encapsula sua interacao visual reutilizavel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const loadTasks = async () => {
      if (!api) return;
      const branchQuery = filialAtiva && filialAtiva !== 'Todas'
        ? `&filial=${encodeURIComponent(filialAtiva)}`
        : '';
      try {
        const response = await api.get(`/operacao/tarefas?tipo=checklist_turno${branchQuery}`);
        if (active) setTarefas(Array.isArray(response.data) ? response.data : []);
      } catch {
        if (active) setTarefas([]);
      }
    };

    loadTasks();
    socket?.on('operacao_atualizada', loadTasks);
    return () => {
      active = false;
      socket?.off('operacao_atualizada', loadTasks);
    };
  }, [api, filialAtiva, socket]);

  const openCalls = useMemo(
    () => chamados.filter((item) => !isClosed(item.status)),
    [chamados]
  );
  const pendingTasks = useMemo(() => tarefas.filter((item) => !item.concluida), [tarefas]);
  const offlineEquipment = useMemo(() => equipamentos.filter(isOffline), [equipamentos]);

  const items = useMemo(() => {
    const queue = [];

    alertas.forEach((alert, index) => {
      const critical = CRITICAL_ALERTS.has(String(alert.tipo_alerta || '').toUpperCase());
      queue.push({
        id: `alert-${alert.id || `${alert.equipamento_id || 'item'}-${index}`}`,
        priority: critical ? 100 : 70,
        tone: critical ? 'danger' : 'warning',
        icon: Thermometer,
        title: alert.equipamento_nome || 'Alerta operacional',
        detail: alert.mensagem || alert.tipo_alerta || 'Ocorrência aguardando análise',
        meta: critical ? 'Crítico' : 'Atenção',
        target: String(alert.tipo_alerta || '').toUpperCase() === 'UMIDADE' ? 'umidade' : 'motores'
      });
    });

    openCalls.forEach((call, index) => queue.push({
      id: `call-${call.id || index}`,
      priority: String(call.urgencia || '').toLowerCase() === 'crítica' ? 95 : 60,
      tone: String(call.urgencia || '').toLowerCase() === 'crítica' ? 'danger' : 'info',
      icon: Wrench,
      title: call.equipamento_nome || `Chamado #${call.id}`,
      detail: call.descricao || 'Ordem de serviço aguardando atendimento',
      meta: call.status || 'Aberto',
      target: 'chamados'
    }));

    if (userRole !== 'LOJA') {
      offlineEquipment.forEach((equipment, index) => queue.push({
        id: `offline-${equipment.id || index}`,
        priority: 80,
        tone: 'warning',
        icon: RadioTower,
        title: equipment.nome || `Equipamento ${equipment.id}`,
        detail: `${equipment.setor || 'Setor não informado'} sem comunicação atual`,
        meta: 'Sem sinal',
        target: userRole === 'MANUTENCAO' || userRole === 'ADMIN' || userRole === 'DEV' ? 'inventario_iot' : 'motores'
      }));
    }

    pendingTasks.forEach((task, index) => queue.push({
      id: `task-${task.id || index}`,
      priority: 50,
      tone: 'neutral',
      icon: ClipboardList,
      title: task.titulo || 'Verificação do turno',
      detail: task.descricao || 'Item do checklist ainda não concluído',
      meta: 'Pendente',
      target: 'checklist_turno'
    }));

    return queue.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [alertas, offlineEquipment, openCalls, pendingTasks, userRole]);

  const [title, description] = roleCopy[userRole] || roleCopy.LOJA;

  return (
    <section className="action-center" aria-labelledby="action-center-title">
      <header className="action-center-header">
        <div>
          <span>Central de ação</span>
          <h2 id="action-center-title">{title}</h2>
          <p>{description}</p>
        </div>
        <div className="action-center-counters" aria-label="Resumo das pendências">
          <button type="button" onClick={() => onNavigate('motores')}><AlertTriangle size={15} /><strong>{alertas.length}</strong><span>alertas</span></button>
          <button type="button" onClick={() => onNavigate('chamados')}><Wrench size={15} /><strong>{openCalls.length}</strong><span>chamados</span></button>
          <button type="button" onClick={() => onNavigate('checklist_turno')}><ClipboardList size={15} /><strong>{pendingTasks.length}</strong><span>tarefas</span></button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="action-center-empty"><CheckCircle2 size={22} /><div><strong>Nenhuma pendência prioritária</strong><span>A operação está em dia para o contexto selecionado.</span></div></div>
      ) : (
        <div className="action-center-list">
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button type="button" key={item.id} className={`action-center-item ${item.tone}`} onClick={() => onNavigate(item.target)}>
                <span className="action-center-item-icon"><ItemIcon size={18} /></span>
                <span className="action-center-item-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                <span className="action-center-item-meta">{item.meta}</span>
                <ArrowRight size={16} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
