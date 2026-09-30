/**
 * Módulo: frontend/src/pages/GestaoLoja/GestaoLojas.jsx
 * Responsabilidade: Implementa a tela Gestao Lojas, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { ContactRound, Download, HardDrive, SlidersHorizontal } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Store, Edit, X, Save, MapPin, Phone, UserCheck, Users,
  RefreshCw, Search, PlusCircle,
  Briefcase, ToggleLeft, ToggleRight, Building2, CheckCircle2, AlertCircle
} from 'lucide-react';
import './GestaoLojas.css';
import logger from '../../utils/logger';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';

/**
 * Renderiza a tela Gestao Lojas e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.carregarDadosBase - Propriedade carregarDadosBase usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function GestaoLojas({ api, showToast, setModalConfig, carregarDadosBase }) {
  
  // PROTEÇÃO: Só o DEV tem permissão para ver Tenants Multi-Empresa e Alterar Status do Sistema
  const role = sessionStorage.getItem('userRole') || 'LOJA';

  const [lojasLocais, setLojasLocais] = useState([]);
  const [empresasDb, setEmpresasDb] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buscaLoja, setBuscaLoja] = usePersistentState('termosync_stores_search', '');
  const [filtroStatus, setFiltroStatus] = usePersistentState('termosync_stores_status', 'TODAS');
  const [filtroGestao, setFiltroGestao] = usePersistentState('termosync_stores_management', 'TODAS');
  const [limiteVisivel, setLimiteVisivel] = useState(12);
  
  const formInicialLoja = { id: '', nome: '', endereco_loja: '', telefone_loja: '', empresa: '', status: 'Ativa' };
  const [formLoja, setFormLoja] = useState({ ...formInicialLoja });
  const [modalLoja, setModalLoja] = useState(false);

  // Busca a lista de lojas/filiiais no backend e atualiza o estado local
  // - Mantém `isLoading` enquanto a chamada estiver em progresso
  const buscarLojasServidor = useCallback(async () => {
    if (!api) return;
    setIsLoading(true);
    try {
      const res = await api.get('/lojas');
      setLojasLocais(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      logger.error("Erro ao buscar lojas:", error);
      showToast('Aviso: Falha ao carregar a lista de filiais.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [api, showToast]);

  // Se o perfil for `DEV`, carrega a lista de empresas/tenants
  // (usada para vincular uma loja a um cliente no formulário)
  const buscarEmpresas = useCallback(async () => {
    if (role !== 'DEV') return;
    try {
      const res = await api.get('/empresas');
      setEmpresasDb(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      logger.error("Erro ao buscar clientes/empresas", error);
    }
  }, [api, role]);

  useEffect(() => {
    buscarLojasServidor();
    buscarEmpresas();
  }, [buscarLojasServidor, buscarEmpresas]);

  /**
   * Atualiza localmente a lista de lojas e, se aplicável, empresas
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await buscarLojasServidor();
    if (role === 'DEV') await buscarEmpresas();
    if (typeof carregarDadosBase === 'function') await carregarDadosBase();
    setTimeout(() => setIsRefreshing(false), 600);
    showToast('Lista de lojas atualizada.', 'success');
  };

  const lojasFiltradas = useMemo(() => {
    const termo = buscaLoja.toLowerCase().trim();
    return lojasLocais.filter(loja => {
      const correspondeBusca = !termo || [loja.nome, loja.endereco, loja.telefone, loja.empresa, loja.id]
        .filter(valor => valor != null)
        .some(valor => String(valor).toLowerCase().includes(termo));
      const statusLoja = String(loja.status || 'Ativa').toUpperCase();
      const correspondeStatus = filtroStatus === 'TODAS' || filtroStatus === statusLoja;
      const correspondeGestao = filtroGestao === 'TODAS' || (filtroGestao === 'COM_GESTOR' ? Boolean(loja.nome_gerente) : !loja.nome_gerente);
      return correspondeBusca && correspondeStatus && correspondeGestao;
    });
  }, [lojasLocais, buscaLoja, filtroStatus, filtroGestao]);

  // Mantém a tela leve em dispositivos móveis sem esconder resultados do usuário.
  useEffect(() => {
    setLimiteVisivel(12);
  }, [buscaLoja, filtroStatus, filtroGestao]);

  const lojasVisiveis = useMemo(
    () => lojasFiltradas.slice(0, limiteVisivel),
    [lojasFiltradas, limiteVisivel]
  );

  const kpis = useMemo(() => {
    let ativas = 0; let suspensas = 0; let risco = 0; let equipamentos = 0; let usuarios = 0; let completas = 0;
    lojasLocais.forEach(l => {
      if (l.status && l.status !== 'Ativa') suspensas++;
      else ativas++;
      
      // Sem gerente = Superfície de Risco Comercial
      if (!l.nome_gerente || l.nome_gerente.trim() === '') risco++;
      equipamentos += Number(l.equipamentos_total || 0);
      usuarios += Number(l.usuarios_total || 0);
      if (l.endereco && l.telefone && l.nome_gerente) completas++;
    });
    return { total: lojasLocais.length, ativas, suspensas, risco, equipamentos, usuarios, completas };
  }, [lojasLocais]);

  /**
   * Exporta a visão filtrada para apoio cadastral e conferência operacional.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportarLojasCsv = () => {
    if (!lojasFiltradas.length) return showToast('Não há lojas no recorte atual.', 'warning');

    /**
     * Concentra a logica de escapar para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {unknown} valor - Valor de valor consumido por esta rotina.
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const escapar = valor => `"${String(valor ?? '').replaceAll('"', '""')}"`;
    const linhas = lojasFiltradas.map(loja => [loja.id, loja.nome, loja.empresa, loja.status || 'Ativa', loja.nome_gerente, loja.nome_coordenador, loja.endereco, loja.telefone, loja.equipamentos_total || 0, loja.usuarios_total || 0].map(escapar).join(','));
    const csv = ['ID,Loja,Empresa,Status,Gerente,Coordenador,Endereco,Telefone,Equipamentos,Usuarios', ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lojas_TermoSync_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Cadastro de lojas exportado.', 'success');
  };

  /**
   * Salva formulário da loja: cria novo registro ou atualiza existente
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
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const salvarLoja = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nome: formLoja.nome,
        endereco: formLoja.endereco_loja,
        telefone: formLoja.telefone_loja,
        empresa: formLoja.empresa,
        status: formLoja.status
      };

      if (formLoja.id) {
        await api.put(`/lojas/${formLoja.id}`, payload);
        showToast('Cadastro da filial atualizado com sucesso.', 'success');
      } else {
        if (!formLoja.nome) return showToast('O nome comercial da loja é obrigatório.', 'error');
        await api.post('/lojas', payload);
        showToast('Nova loja cadastrada no sistema.', 'success');
      }

      setModalLoja(false);
      buscarLojasServidor();
      if (typeof carregarDadosBase === 'function') carregarDadosBase();

    } catch (err) {
      showToast('Erro. Verifique se o nome da loja já existe.', 'error');
    }
  };

  /**
   * Alterna o status operacional da loja entre 'Ativa' e 'Suspensa' (função sensível — exige
   * autorização nível DEV na UI)
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: consulta ou altera dados pela API
   *
   * @param {unknown} loja - Valor de loja consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const alternarStatusLoja = async (loja) => {
    try {
      const novoStatus = loja.status === 'Ativa' || !loja.status ? 'Suspensa' : 'Ativa';
      const payload = {
          nome: loja.nome,
          endereco: loja.endereco,
          telefone: loja.telefone,
          empresa: loja.empresa,
          status: novoStatus
      };
      await api.put(`/lojas/${loja.id}`, payload);
      showToast(`O status da loja foi alterado para: ${novoStatus}.`, 'info');
      buscarLojasServidor();
    } catch (err) {
      showToast('Erro ao alterar o status do sistema.', 'error');
    }
  };

  /**
   * Dispara modal de confirmação e, se confirmado, exclui a loja
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @param {unknown} nome - Valor de nome consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const pedirExclusaoLoja = (id, nome) => {
    setModalConfig({
      isOpen: true,
      title: 'Excluir Filial',
      message: `Atenção: A remoção da loja "${nome}" apagará todas as configurações e registros vinculados a ela. Confirma?`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(`/lojas/${id}`);
          showToast('Loja removida permanentemente do sistema.', 'success');
          buscarLojasServidor();
          if (typeof carregarDadosBase === 'function') carregarDadosBase();
        } catch (e) {
          showToast('Ação bloqueada. Remova os equipamentos desta loja primeiro.', 'error');
        }
      }
    });
  };

  return (
    <div className="gestao-lojas-page stagger-1">
      
      {/* HERO SECTION */}
      <div className="gestao-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle">
            <Building2 size={28} />
          </div>
          <div>
            <h3 className="hero-main-title">Gestão de Lojas & Filiais</h3>
            <span className="hero-subtitle">Cadastros, endereços e identificação da liderança de cada unidade.</span>
          </div>
        </div>

        <div className="hero-actions">
          <button className="btn-provision export" onClick={exportarLojasCsv} disabled={!lojasFiltradas.length} title="Exportar o recorte atual em CSV">
            <Download size={16} /> Exportar
          </button>
          <button className="btn-provision sync" onClick={handleRefresh} title="Atualizar dados">
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> Atualizar Lista
          </button>
          <button className="btn-provision add" onClick={() => { setFormLoja({ ...formInicialLoja }); setModalLoja(true); }}>
            <PlusCircle size={16} /> Cadastrar Nova Loja
          </button>
        </div>
      </div>

      <div className="stores-overview" aria-label="Resumo da rede de lojas">
        <div><Store size={18}/><span>Unidades<strong>{kpis.total}</strong></span></div>
        <div><HardDrive size={18}/><span>Equipamentos<strong>{kpis.equipamentos}</strong></span></div>
        <div><Users size={18}/><span>Identidades vinculadas<strong>{kpis.usuarios}</strong></span></div>
        <div><CheckCircle2 size={18}/><span>Cadastros completos<strong>{kpis.completas} de {kpis.total}</strong></span></div>
      </div>

      {/* PAINEL DE CONTROLE DE KPIS */}
      <div className="control-panel stagger-2">
        <div className="kpi-bar">
          <div className="kpi-item-small success">
            <span className="kpi-val">{kpis.ativas}</span>
            <span className="kpi-lbl">Lojas Ativas</span>
          </div>
          
          {role === 'DEV' && kpis.suspensas > 0 && (
            <div className="kpi-item-small danger">
              <span className="kpi-val">{kpis.suspensas}</span>
            <span className="kpi-lbl">Lojas Indisponíveis</span>
            </div>
          )}
          
          <div className={`kpi-item-small ${kpis.risco > 0 ? 'warning' : 'success'}`} title="Filiais que ainda não possuem um Gerente cadastrado.">
            <span className="kpi-val">{kpis.risco}</span>
            <span className="kpi-lbl">Lojas sem Gestor</span>
          </div>
        </div>

        <div className="search-box">
          <Search size={18} color="var(--text-muted)" />
          <input type="text" placeholder="Buscar loja por nome, endereço ou ID..." value={buscaLoja} onChange={e => setBuscaLoja(e.target.value)} />
        </div>
        <div className="store-filter-group">
          <label><SlidersHorizontal size={15}/><select value={filtroStatus} onChange={event => setFiltroStatus(event.target.value)}>
            <option value="TODAS">Todos os status</option><option value="ATIVA">Somente ativas</option><option value="SUSPENSA">Somente suspensas</option><option value="BLOQUEADA">Somente bloqueadas</option>
          </select></label>
          <label><ContactRound size={15}/><select value={filtroGestao} onChange={event => setFiltroGestao(event.target.value)}>
            <option value="TODAS">Toda gestão</option><option value="COM_GESTOR">Com gerente</option><option value="SEM_GESTOR">Sem gerente</option>
          </select></label>
        </div>
      </div>

      <div className="store-result-summary">Exibindo <strong>{lojasFiltradas.length}</strong> de {lojasLocais.length} unidades</div>

      {/* TABELA DE LOJAS */}
      <div className="table-card stagger-3">
        {isLoading ? (
          <Loader message="Carregando lojas..." />
        ) : lojasFiltradas.length === 0 ? (
          <EmptyState title="Nenhuma loja encontrada" description={lojasLocais.length ? 'Ajuste a busca ou os filtros para ampliar o resultado.' : 'O sistema ainda não possui filiais registradas.'} icon={Store} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Identificação da Loja</th>
                  {role === 'DEV' && <th>Empresa / Cliente</th>}
                  <th>Equipe de Gestão</th>
                  <th>Capacidade Operacional</th>
                  <th>Localização & Contato</th>
                  <th style={{ textAlign: 'center' }}>Status no Sistema</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lojasVisiveis.map(l => {
                  const isSuspensa = Boolean(l.status && l.status !== 'Ativa');
                  
                  return (
                    <tr key={l?.id || `${l?.empresa}-${l?.nome}`} className={`table-row ${isSuspensa ? 'row-suspensa' : 'ativo'}`}>
                      <td data-label="Loja / Filial">
                        <div className="name-box">
                          <div className="icon-wrapper">
                            <Store size={20} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{l?.nome || 'Nome não definido'}</span>
                            <span>ID da Loja: {l?.id ? String(l.id).padStart(4, '0') : '----'}</span>
                          </div>
                        </div>
                      </td>

                      {role === 'DEV' && (
                        <td data-label="Empresa / Cliente">
                          <span className="tenant-badge" title="Instância Cloud Associada">
                            <Briefcase size={14}/> {l.empresa || 'Sem Cliente'}
                          </span>
                        </td>
                      )}

                      <td data-label="Equipe de Gestão">
                        <div className="leadership-box">
                          {l?.nome_gerente ? (
                            <span className="leader-badge manager" title="Gerente Responsável">
                              <UserCheck size={14} /> <strong>Gerente:</strong> {l.nome_gerente}
                            </span>
                          ) : (
                            <span className="leader-badge missing">
                              <AlertCircle size={14} /> Sem Gerente Cadastrado
                            </span>
                          )}
                          
                          {l?.nome_coordenador && (
                            <span className="leader-badge coordinator" title="Coordenador de Turno">
                              <Users size={14} /> <strong>Coord:</strong> {l.nome_coordenador}
                            </span>
                          )}
                        </div>
                      </td>

                      <td data-label="Capacidade Operacional">
                        <div className="store-capacity">
                          <span><HardDrive size={14}/> {Number(l.equipamentos_total || 0)} equipamento(s)</span>
                          <span><Users size={14}/> {Number(l.usuarios_total || 0)} acesso(s)</span>
                        </div>
                      </td>

                      <td data-label="Localização & Contato">
                        <div className="contact-box">
                          <div className="contact-line"><MapPin size={16} /> {l?.endereco || 'Endereço não cadastrado'}</div>
                          <div className="contact-line"><Phone size={16} /> {l?.telefone || 'Telefone não cadastrado'}</div>
                        </div>
                      </td>

                      <td data-label="Status no Sistema" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <div className="status-badge-network" style={{ color: isSuspensa ? 'var(--danger)' : 'var(--success)' }}>
                            <div className={`status-dot ${isSuspensa ? 'offline' : 'online'}`}></div>
                            {isSuspensa ? l.status : 'Operante'}
                          </div>
                          
                          {/* Botão de Suspensão exclusivo para o DEV */}
                          {role === 'DEV' && (
                            <button className="btn-toggle-status" onClick={() => alternarStatusLoja(l)} title="Ativar/Suspender Loja" style={{ width: 'auto' }}>
                              {isSuspensa ? <ToggleLeft size={28} color="var(--danger)"/> : <ToggleRight size={28} color="var(--success)"/>}
                            </button>
                          )}
                        </div>
                      </td>

                      <td data-label="Ações" style={{ textAlign: 'right' }}>
                        <button className="btn-action edit" onClick={() => { setFormLoja({ id: l.id, nome: l.nome, endereco_loja: l.endereco || '', telefone_loja: l.telefone || '', empresa: l.empresa || '', status: l.status || 'Ativa' }); setModalLoja(true); }} title="Editar Loja">
                          <Edit size={18} />
                        </button>
                        <button className="btn-action delete" onClick={() => pedirExclusaoLoja(l.id, l.nome)} title="Excluir Loja">
                          <X size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lojasVisiveis.length < lojasFiltradas.length && (
        <div className="store-load-more">
          <span>Mostrando {lojasVisiveis.length} de {lojasFiltradas.length} unidades</span>
          <button type="button" onClick={() => setLimiteVisivel(limite => limite + 12)}>
            Carregar mais unidades
          </button>
        </div>
      )}

      {/* MODAL DE CADASTRO DE LOJAS */}
      {modalLoja && (
        <div className="modal-overlay">
          <div className="modal-content-custom anim-slide-up">
            
            <div className="modal-header-custom">
              <div className="modal-icon-bg">
                <Store size={28} />
              </div>
              <div>
                <h3>{formLoja.id ? 'Edição de Loja' : 'Cadastro de Nova Loja'}</h3>
                <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Informações Cadastrais da Unidade
                </span>
              </div>
            </div>

            <form onSubmit={salvarLoja} className="modal-form-custom">
              
              {!formLoja.id && (
                <div className="security-warning-box">
                  <AlertCircle size={24} style={{ flexShrink: 0 }} />
                  <span>Ao cadastrar uma nova loja, lembre-se de ir na aba "Gestão de Usuários" para criar e vincular um Gerente e um Coordenador a ela.</span>
                </div>
              )}

              <div className="form-group-custom" style={{ marginTop: formLoja.id ? '0' : '1.5rem' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                  
                  {role === 'DEV' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: 'var(--success)' }}>Vincular a uma Empresa / Cliente</label>
                      <select style={{ border: '1px solid var(--success)', background: 'rgba(16, 185, 129, 0.05)' }} value={formLoja.empresa} onChange={(e) => setFormLoja({...formLoja, empresa: e.target.value})} required>
                        <option value="">Selecione o Cliente...</option>
                        {empresasDb.map(emp => <option key={emp.id} value={emp.nome}>{emp.nome}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label>Nome Comercial da Loja / Filial</label>
                    <input type="text" value={formLoja.nome} onChange={(e) => setFormLoja({ ...formLoja, nome: e.target.value })} placeholder="Ex: Supermercado Centro - SP" required autoFocus />
                  </div>
                  
                  <div className="store-contact-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label>Endereço Completo</label>
                      <input type="text" value={formLoja.endereco_loja} onChange={(e) => setFormLoja({ ...formLoja, endereco_loja: e.target.value })} placeholder="Rua, Número, Bairro, Cidade" />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label>Telefone de Contato</label>
                      <input type="text" value={formLoja.telefone_loja} onChange={(e) => setFormLoja({ ...formLoja, telefone_loja: e.target.value })} placeholder="(XX) 9XXXX-XXXX" />
                    </div>
                  </div>

                </div>
              </div>

              <div className="modal-actions-custom">
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }} onClick={() => setModalLoja(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" style={{ backgroundColor: 'var(--success)', color: 'var(--technical-canvas)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px color-mix(in srgb, var(--success) 30%, transparent)' }}>
                  {formLoja.id ? <><CheckCircle2 size={18} /> Salvar Alterações</> : <><Save size={18} /> Cadastrar Loja</>}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
