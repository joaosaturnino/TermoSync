/**
 * Módulo: frontend/src/pages/Metrologia/Metrologia.jsx
 * Responsabilidade: Implementa a tela Metrologia, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { CalendarClock, CheckCircle2, Download, Edit3, Gauge } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, Search, ShieldAlert, 
  AlertTriangle, Server, MapPin, Lock, Shield
} from 'lucide-react';
import './Metrologia.css';

/**
 * Extrai parse data de uma entrada externa ou configuracao local.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object|Array} data - Dados de entrada que serão validados e transformados pelo fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function parseData(data) {
  if (!data) return null;
  const valor = new Date(data);
  return Number.isNaN(valor.getTime()) ? null : valor;
}

/**
 * Formata datas de certificado para o padrao utilizado nas telas operacionais.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object|Array} data - Dados de entrada que serão validados e transformados pelo fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function formatarData(data) {
  const valor = parseData(data);
  return valor ? valor.toLocaleDateString('pt-BR') : 'Nao informada';
}

/**
 * Controle de validade, vencimentos e acoes de afericao dos ativos da filial.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.editarEquipamento - Propriedade editarEquipamento usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Metrologia({ equipamentosDaFilial = [], editarEquipamento, userRole, filialAtiva }) {
  const [busca, setBusca] = usePersistentState('termosync_metrology_search', '');
  const [filtro, setFiltro] = usePersistentState('termosync_metrology_filter', 'TODOS');
  const [instanteReferencia] = useState(Date.now);

  const roleLogada = userRole || sessionStorage.getItem('userRole') || 'LOJA';
  const papelLogado = sessionStorage.getItem('papelLogado') || '';
  const isGestorLoja = /gerente|coordenador/i.test(papelLogado);
  const canEdit = ['ADMIN', 'DEV', 'MANUTENCAO'].includes(roleLogada) || (roleLogada === 'LOJA' && isGestorLoja);

  // Restringe a analise a filial ativa, mesmo quando a lista recebida contem varias unidades.
  const equipamentosSeguros = useMemo(() => {
    if (!filialAtiva || filialAtiva === 'Todas') return equipamentosDaFilial;
    const filial = filialAtiva.trim().toLowerCase();
    return equipamentosDaFilial.filter((eq) => String(eq.filial || 'Loja Principal').trim().toLowerCase() === filial);
  }, [equipamentosDaFilial, filialAtiva]);
  /**
   * Concentra a logica de exportar csv para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportarCsv = () => {
    const cabecalho = ['Ativo', 'Tipo', 'Setor', 'Filial', 'Ultima calibracao', 'Vencimento', 'Status', 'Dias restantes'];
    const linhas = equipamentosFiltrados.map((eq) => [
      eq.nome, eq.tipo, eq.setor, eq.filial, formatarData(eq.data_calibracao),
      eq.vencimento ? formatarData(eq.vencimento) : '', eq.status_calibracao, eq.dias_restantes ?? ''
    ]);
    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map((valor) => `"${String(valor ?? '').replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `controle-metrologico-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const statusConfig = {
    OK: { label: 'Conforme', icon: CheckCircle2 },
    ALERTA: { label: 'Renovar em breve', icon: AlertTriangle },
    VENCIDO: { label: 'Vencido', icon: ShieldAlert },
    SEM_REGISTRO: { label: 'Sem certificado', icon: ClipboardCheck }
  };

  const analise = useMemo(() => {
    const hoje = instanteReferencia;
    return equipamentosSeguros.map((eq) => {
      const dias = eq.data_calibracao ? Math.floor((hoje - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const status = dias > 365 ? 'VENCIDO' : (dias > 330 ? 'ALERTA' : 'OK');
      return { ...eq, dias_calibracao: dias, status_calibracao: status };
    }).sort((a, b) => b.dias_calibracao - a.dias_calibracao);
  }, [equipamentosSeguros, instanteReferencia]);

  const equipamentosFiltrados = (() => {
    const termo = busca.toLowerCase().trim();
    return analise.filter((eq) => {
      const matchesSearch = !termo || [eq.nome, eq.filial, eq.setor].some((value) => String(value || '').toLowerCase().includes(termo));
      return matchesSearch && (filtro === 'TODOS' || eq.status_calibracao === filtro);
    });
  })();

  const kpis = useMemo(() => {
    const total = analise.length;
    const conforme = analise.filter((eq) => eq.status_calibracao === 'OK').length;
    const alerta = analise.filter((eq) => eq.status_calibracao === 'ALERTA').length;
    return { total, conforme, alerta, vencidos: total - conforme - alerta };
  }, [analise]);

return (
    <div className="metrologia-page anim-fade-in">
      <header className="metrologia-header">
        <div>
          <span className="metrologia-eyebrow"><Gauge size={14} /> Qualidade e conformidade</span>
          <h2>Controle metrologico</h2>
          <p>Validade dos certificados, agenda de afericao e rastreabilidade dos sensores.</p>
        </div>
        <div className="metrologia-header-actions">
          {!canEdit && <span className="metrologia-readonly"><Lock size={15} /> Somente leitura</span>}
          <button className="btn btn-outline" type="button" onClick={exportarCsv} disabled={!equipamentosFiltrados.length}>
            <Download size={17} /> Exportar CSV
          </button>
        </div>
      </header>

      <section className="metrologia-overview" aria-label="Resumo metrologico">
        <article className="metrologia-score">
          <div className="metrologia-score-ring" style={{ '--score': `${kpis.taxa * 3.6}deg` }}><strong>{kpis.taxa}%</strong></div>
          <div><span>Indice de conformidade</span><small>{kpis.conforme} de {kpis.total} ativos dentro da validade</small></div>
        </article>
        <article><ShieldAlert /><strong>{kpis.vencidos}</strong><span>Certificados vencidos</span></article>
        <article><AlertTriangle /><strong>{kpis.alerta}</strong><span>Renovacoes proximas</span></article>
        <article><ClipboardCheck /><strong>{kpis.semRegistro}</strong><span>Sem certificado</span></article>
        <article className="metrologia-next"><CalendarClock /><div><span>Proximo vencimento</span><strong>{kpis.proximo ? `${kpis.proximo.nome} - ${kpis.proximo.dias_restantes} dias` : 'Sem vencimentos programados'}</strong></div></article>
      </section>

      <section className="metrologia-toolbar">
        <div className="metrologia-search"><Search size={17} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ativo, setor, tipo ou filial" /></div>
        <div className="metrologia-filters" aria-label="Filtrar certificados">
          {[
            ['TODOS', `Todos (${kpis.total})`], ['VENCIDO', `Vencidos (${kpis.vencidos})`],
            ['ALERTA', `A vencer (${kpis.alerta})`], ['SEM_REGISTRO', `Sem registro (${kpis.semRegistro})`], ['OK', `Conformes (${kpis.conforme})`]
          ].map(([valor, label]) => <button type="button" key={valor} className={filtro === valor ? 'active' : ''} onClick={() => setFiltro(valor)}>{label}</button>)}
        </div>
      </section>

      <section className="metrologia-table-wrap">
        <div className="metrologia-table-heading"><div><h3>Agenda de certificados</h3><p>{equipamentosFiltrados.length} registro(s) na visao atual</p></div><Shield size={20} /></div>
        <div className="table-responsive">
          <table className="table metrologia-table">
            <thead><tr><th>Ativo</th><th>Localizacao</th><th>Ultima afericao</th><th>Validade</th><th>Situacao</th><th aria-label="Acoes" /></tr></thead>
            <tbody>
              {equipamentosFiltrados.map((eq) => {
                const config = statusConfig[eq.status_calibracao];
                const StatusIcon = config.icon;
                return (
                  <tr key={eq.id}>
                    <td data-label="Ativo"><div className="metrologia-asset"><span><Server size={18} /></span><div><strong>{eq.nome || 'Ativo sem nome'}</strong><small>{eq.tipo || 'Tipo nao informado'}</small></div></div></td>
                    <td data-label="Localizacao"><span className="metrologia-location"><MapPin size={14} /> {eq.setor || 'Sem setor'} - {eq.filial || 'Sem filial'}</span></td>
                    <td data-label="Ultima afericao">{formatarData(eq.data_calibracao)}</td>
                    <td data-label="Validade"><strong>{eq.vencimento ? formatarData(eq.vencimento) : 'Pendente'}</strong>{eq.dias_restantes !== null && <small className="metrologia-days">{eq.dias_restantes < 0 ? `${Math.abs(eq.dias_restantes)} dias em atraso` : `${eq.dias_restantes} dias restantes`}</small>}</td>
                    <td data-label="Situacao"><span className={`metrologia-status ${eq.status_calibracao.toLowerCase()}`}><StatusIcon size={14} /> {config.label}</span></td>
                    <td data-label="Acao">{canEdit ? <button className="metrologia-edit" type="button" onClick={() => editarEquipamento(eq)} title="Registrar nova afericao"><Edit3 size={16} /><span>Registrar</span></button> : <Shield size={16} className="metrologia-locked" />}</td>
                  </tr>
                );
              })}
              {!equipamentosFiltrados.length && <tr><td colSpan="6" className="metrologia-empty"><ClipboardCheck size={34} /><strong>Nenhum certificado encontrado</strong><span>Ajuste os filtros ou cadastre a calibracao no equipamento.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
