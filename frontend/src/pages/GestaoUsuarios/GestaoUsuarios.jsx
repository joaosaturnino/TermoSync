/**
 * Módulo: frontend/src/pages/GestaoUsuarios/GestaoUsuarios.jsx
 * Responsabilidade: Implementa a tela Gestao Usuarios, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { BadgeCheck, Globe2, KeyRound, RefreshCw, ShieldX, SlidersHorizontal } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Wrench, Save, ShieldAlert, Store,
  UserCircle, MapPin, Search, ShieldCheck,
  Lock, Briefcase, Eye, EyeOff, Users, Settings
} from 'lucide-react';
import './GestaoUsuarios.css';
import logger from '../../utils/logger';
import { PASSWORD_RULES, isStrongPassword } from '../../utils/passwordPolicy.js';

/**
 * Renderiza a tela Gestao Usuarios e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function GestaoUsuarios({ api, showToast, setModalConfig }) {

  const roleLogada = sessionStorage.getItem('userRole') || 'LOJA';
  const usuarioLogadoId = sessionStorage.getItem('userId') || '';

  const formInicialUsuario = {
    id: '', usuario: '', senha: '', role: 'LOJA', filial: '', tipo_acesso: 'GERENTE', nome: '', empresa: ''
  };

  const [usuariosLocais, setUsuariosLocais] = useState([]);
  const [filiaisDb, setFiliaisDb] = useState([]);
  const [empresasDb, setEmpresasDb] = useState([]);
  
  const [formUsuario, setFormUsuario] = useState({ ...formInicialUsuario });
  const [modalUsuario, setModalUsuario] = useState(false);
  
  const [busca, setBusca] = usePersistentState('termosync_users_search', '');
  const [filtroPrivilegio, setFiltroPrivilegio] = usePersistentState('termosync_users_privilege', 'TODOS');
  const [filtroSeguranca, setFiltroSeguranca] = usePersistentState('termosync_users_security', 'TODOS');
  const [filtroMfa, setFiltroMfa] = usePersistentState('termosync_users_mfa', 'TODOS');
  const [limiteVisivel, setLimiteVisivel] = useState(12);
  const [isLoading, setIsLoading] = useState(false);
  
  // Segurança UX
  const [showPassword, setShowPassword] = useState(false);

  const carregarUsuarios = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/usuarios');
      setUsuariosLocais(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast('Erro ao carregar a lista de usuários do sistema.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [api, showToast]);

  const carregarDependencias = useCallback(async () => {
    try {
      const resF = await api.get('/auxiliares/filiais');
      setFiliaisDb(Array.isArray(resF.data) ? resF.data : []);
      
      if (roleLogada === 'DEV') {
        const resE = await api.get('/empresas');
        setEmpresasDb(Array.isArray(resE.data) ? resE.data : []);
      }
    } catch (e) {
      logger.error(e);
    }
  }, [api, roleLogada]);

  useEffect(() => {
    carregarUsuarios();
    carregarDependencias();
  }, [carregarUsuarios, carregarDependencias]);


  /**
   * Processa a interacao de abrir modal usuario e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} tipoAcesso - Valor de tipo acesso consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const abrirModalUsuario = (tipoAcesso) => {
    let roleTarget = 'LOJA';
    if (tipoAcesso === 'TECNICO') roleTarget = 'MANUTENCAO';
    if (tipoAcesso === 'OUTROS') roleTarget = 'ADMIN';

    setFormUsuario({ ...formInicialUsuario, role: roleTarget, tipo_acesso: tipoAcesso });
    setShowPassword(false);
    setModalUsuario(true);
  };


  /**
   * Concentra a logica de salvar usuario para manter o restante do tela mais legivel.
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
  const salvarUsuario = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        usuario: formUsuario.usuario,
        role: formUsuario.role,
        nome: formUsuario.nome,
        empresa: formUsuario.empresa
      };
      
      if (formUsuario.role === 'LOJA') payload.filial = formUsuario.filial;
      else payload.filial = null;

      if (formUsuario.senha) payload.senha = formUsuario.senha;
      if (formUsuario.senha && !isStrongPassword(formUsuario.senha)) {
        return showToast('A senha precisa ter 10+ caracteres, maiúscula, minúscula, número e símbolo.', 'warning');
      }

      if (formUsuario.role === 'MANUTENCAO') {
        payload.nome_tecnico = formUsuario.nome;
      } else if (formUsuario.role === 'LOJA') {
        if (formUsuario.tipo_acesso === 'GERENTE') payload.nome_gerente = formUsuario.nome;
        else if (formUsuario.tipo_acesso === 'COORDENADOR') payload.nome_coordenador = formUsuario.nome;
        else payload.nome = formUsuario.nome; 
      }

      if (formUsuario.id) {
        await api.put(`/usuarios/${formUsuario.id}`, payload);
        showToast('Perfil de acesso atualizado com sucesso.', 'success');
      } else {
        if (!payload.senha) return showToast('A senha inicial é obrigatória para o cadastro.', 'error');
        await api.post('/usuarios', payload);
        showToast('Novo usuário cadastrado no sistema.', 'success');
      }

      setModalUsuario(false);
      carregarUsuarios();
    } catch (err) {
      showToast('Falha no cadastro. Verifique se o login já existe.', 'error');
    }
  };


  /**
   * Processa a interacao de pedir exclusao usuario e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @param {unknown} nome - Valor de nome consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const pedirExclusaoUsuario = (id, nome) => {
    setModalConfig({
      isOpen: true,
      title: 'Excluir Usuário',
      message: `Tem certeza que deseja excluir o acesso de "${nome}"? Esta ação removerá os privilégios dele imediatamente.`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(`/usuarios/${id}`);
          showToast('Acesso removido com sucesso.', 'success');
          carregarUsuarios();
        } catch (e) {
          showToast('Erro ao tentar excluir o usuário.', 'error');
        }
      }
    });
  };

  /**
   * Bloqueia ou libera uma identidade pelo controle SOC e atualiza a listagem.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {object} usuario - Usuário autenticado ou candidato à autenticação processado por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const alternarBloqueioUsuario = (usuario) => {
    const bloquear = !usuario.security_blocked;
    setModalConfig({
      isOpen: true,
      title: bloquear ? 'Bloquear Identidade' : 'Liberar Identidade',
      message: bloquear
        ? `Bloquear o acesso de "${usuario.usuario}"? Todas as sessões ativas serão encerradas.`
        : `Liberar novamente o acesso de "${usuario.usuario}"?`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          const resposta = await api.patch(`/soc/users/${usuario.id}/security`, { blocked: bloquear });
          showToast(bloquear ? `Identidade bloqueada e ${resposta.data?.revoked || 0} sessão(ões) encerrada(s).` : 'Identidade liberada.', bloquear ? 'warning' : 'success');
          carregarUsuarios();
        } catch (erro) {
          showToast(erro.response?.data?.error || 'Não foi possível atualizar o bloqueio.', 'error');
        }
      }
    });
  };

  const usuariosExibidos = useMemo(() => {
    if (!usuariosLocais) return [];
    
    return usuariosLocais.filter(u => {
      const displayNome = u.nome || u.nome_tecnico || u.nome_gerente || u.nome_coordenador || u.usuario || '';
      
      const matchBusca = 
        displayNome.toLowerCase().includes(busca.toLowerCase()) ||
        (u.usuario && u.usuario.toLowerCase().includes(busca.toLowerCase())) ||
        (u.filial && u.filial.toLowerCase().includes(busca.toLowerCase())) ||
        (u.empresa && u.empresa.toLowerCase().includes(busca.toLowerCase()));
      
      const matchFiltro = filtroPrivilegio === 'TODOS' || u.role === filtroPrivilegio;
      const matchSeguranca = filtroSeguranca === 'TODOS' || (filtroSeguranca === 'BLOQUEADOS' ? Boolean(u.security_blocked) : !u.security_blocked);
      const matchMfa = filtroMfa === 'TODOS' || (filtroMfa === 'ATIVO' ? Boolean(u.mfa_enabled) : !u.mfa_enabled);
      return matchBusca && matchFiltro && matchSeguranca && matchMfa;
    }).sort((a, b) => {
      const roleWeight = { 'DEV': 4, 'ADMIN': 3, 'MANUTENCAO': 2, 'LOJA': 1 };
      return (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0);
    });
  }, [usuariosLocais, busca, filtroPrivilegio, filtroSeguranca, filtroMfa]);

  // Reduz o custo de renderização das fichas móveis e libera mais itens sob demanda.
  useEffect(() => {
    setLimiteVisivel(12);
  }, [busca, filtroPrivilegio, filtroSeguranca, filtroMfa]);

  const usuariosVisiveis = useMemo(
    () => usuariosExibidos.slice(0, limiteVisivel),
    [usuariosExibidos, limiteVisivel]
  );

  const kpis = useMemo(() => {
    if (!usuariosLocais) return { total: 0, admin: 0, tech: 0, loja: 0, mfa: 0, blocked: 0, semLoja: 0, privileged: 0 };
    let admin = 0; let tech = 0; let loja = 0; let mfa = 0; let blocked = 0; let semLoja = 0; let privileged = 0;
    
    usuariosLocais.forEach(u => {
      if (u.role === 'ADMIN') admin++;
      else if (u.role === 'MANUTENCAO') tech++;
      else if (u.role === 'LOJA') loja++;
      if (u.mfa_enabled) mfa++;
      if (u.security_blocked) blocked++;
      if (u.role === 'LOJA' && !u.filial) semLoja++;
      if (u.role === 'ADMIN' || u.role === 'DEV') privileged++;
    });

    return { total: usuariosLocais.length, admin, tech, loja, mfa, blocked, semLoja, privileged };
  }, [usuariosLocais]);

  const modalHeaderInfo = useMemo(() => {
    if (formUsuario.role === 'ADMIN') return { icon: ShieldAlert, color: 'var(--danger)', title: 'Acesso Administrativo (Total)' };
    if (formUsuario.role === 'MANUTENCAO') return { icon: Wrench, color: 'var(--info)', title: 'Acesso Técnico (Manutenção)' };
    return { icon: Store, color: 'var(--success)', title: 'Acesso Operacional (Loja)' };
  }, [formUsuario.role]);

  // Cálculo de Força da Senha
  const passwordStrength = useMemo(() => {
    const p = formUsuario.senha;
    if (!p) return { score: 0, text: '', color: 'transparent' };
    let score = 0;
    score = PASSWORD_RULES.filter((rule) => rule.test(p)).length;

    if (score <= 2) return { score: 1, text: 'Senha Fraca', color: 'var(--danger)' };
    if (score < 5) return { score: 2, text: 'Segurança Média', color: 'var(--warning)' };
    return { score: 3, text: 'Senha Forte', color: 'var(--success)' };
  }, [formUsuario.senha]);

  return (
    <div className="gestao-usuarios-page stagger-1">
      
      {/* HERO SECTION */}
      <div className="usuarios-hero">
        <div className="identity-hero-title-box">
          <div className="identity-hero-icon-circle">
            <Users size={28} />
          </div>
          <div>
            <h3 className="identity-hero-main-title">Gestão de Usuários & Acessos</h3>
            <span className="identity-hero-subtitle">Controle de senhas, permissões e perfis de operação do sistema.</span>
          </div>
        </div>

        <div className="identity-hero-actions">
          <button className="identity-btn-provision refresh" onClick={carregarUsuarios} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Atualizar
          </button>
          <button className="identity-btn-provision tech" onClick={() => abrirModalUsuario('TECNICO')}>
            <Wrench size={16} /> Cadastrar Técnico
          </button>
          <button className="identity-btn-provision store" onClick={() => abrirModalUsuario('GERENTE')}>
            <Store size={16} /> Cadastrar Funcionário
          </button>

          {roleLogada === 'DEV' && (
            <button className="identity-btn-provision master" onClick={() => abrirModalUsuario('OUTROS')}>
              <ShieldAlert size={16} /> Cadastrar Administrador
            </button>
          )}
        </div>
      </div>

      <div className="identity-security-overview" aria-label="Resumo de segurança das identidades">
        <div><Users size={18}/><span>Identidades<strong>{kpis.total}</strong></span></div>
        <div><KeyRound size={18}/><span>MFA habilitado<strong>{kpis.mfa} de {kpis.total}</strong></span></div>
        <div className={kpis.blocked ? 'overview-danger' : ''}><ShieldX size={18}/><span>Bloqueadas<strong>{kpis.blocked}</strong></span></div>
        <div><BadgeCheck size={18}/><span>Acessos privilegiados<strong>{kpis.privileged}</strong></span></div>
      </div>

      {/* CONTROLES E KPIS */}
      <div className="identity-control-panel stagger-2">
        <div className="identity-kpi-bar">
          <div className={`identity-kpi-item-small ${filtroPrivilegio === 'TODOS' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('TODOS')}>
            <span className="identity-kpi-val">{kpis.total}</span>
            <span className="identity-kpi-lbl">Todos os Usuários</span>
          </div>
          <div className={`identity-kpi-item-small danger ${filtroPrivilegio === 'ADMIN' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('ADMIN')}>
            <span className="identity-kpi-val">{kpis.admin}</span>
            <span className="identity-kpi-lbl">Administradores</span>
          </div>
          <div className={`identity-kpi-item-small info ${filtroPrivilegio === 'MANUTENCAO' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('MANUTENCAO')}>
            <span className="identity-kpi-val">{kpis.tech}</span>
            <span className="identity-kpi-lbl">Equipe Técnica</span>
          </div>
          <div className={`identity-kpi-item-small success ${filtroPrivilegio === 'LOJA' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('LOJA')}>
            <span className="identity-kpi-val">{kpis.loja}</span>
            <span className="identity-kpi-lbl">Usuários de Loja</span>
          </div>
        </div>

        <div className="identity-search-box">
          <Search size={18} color="var(--text-muted)" />
          <input type="text" placeholder="Buscar usuário por nome, login ou loja..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="identity-filter-group">
          <label><ShieldCheck size={15}/><select value={filtroSeguranca} onChange={event => setFiltroSeguranca(event.target.value)}>
            <option value="TODOS">Todos os estados</option><option value="ATIVOS">Acessos liberados</option><option value="BLOQUEADOS">Acessos bloqueados</option>
          </select></label>
          <label><SlidersHorizontal size={15}/><select value={filtroMfa} onChange={event => setFiltroMfa(event.target.value)}>
            <option value="TODOS">Qualquer MFA</option><option value="ATIVO">MFA habilitado</option><option value="INATIVO">MFA não habilitado</option>
          </select></label>
        </div>
      </div>

      <div className="identity-result-summary">Exibindo <strong>{usuariosExibidos.length}</strong> de {usuariosLocais.length} identidades{kpis.semLoja ? ` · ${kpis.semLoja} sem loja vinculada` : ''}</div>

      {/* TABELA DE USUÁRIOS */}
      <div className="identity-table-card stagger-3">
        {isLoading ? (
          <div className="identity-loading"><RefreshCw size={28} className="spin"/> Carregando identidades...</div>
        ) : (!usuariosExibidos || usuariosExibidos.length === 0) ? (
           <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
             <Users size={48} style={{ opacity: 0.25, marginBottom: '1rem' }} />
             <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Nenhum usuário localizado</h3>
             <p>Ajuste os filtros acima ou tente pesquisar outro nome.</p>
           </div>
        ) : (
          <div className="identity-table-wrapper">
            <table className="identity-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Login no Sistema</th>
                  {roleLogada === 'DEV' && <th>Empresa / Cliente</th>}
                  <th>Nível de Acesso</th>
                  <th>Postura de Segurança</th>
                  <th>Loja Vinculada</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuariosVisiveis.map(u => {
                  
                  const displayNome = u.nome || u.nome_tecnico || u.nome_gerente || u.nome_coordenador || u.usuario || 'Sem Nome';
                  const podeGerenciar = roleLogada === 'DEV' || u.role !== 'DEV';
                  const isSelf = String(u.id) === String(usuarioLogadoId);
                  
                  let displayCargo = u.cargo;
                  if (!displayCargo) {
                    if (u.role === 'ADMIN') displayCargo = 'Administrador do Sistema';
                    else if (u.role === 'MANUTENCAO') displayCargo = 'Técnico de Manutenção';
                    else if (u.role === 'LOJA') {
                      if (u.nome_gerente) displayCargo = 'Gerente de Loja';
                      else if (u.nome_coordenador) displayCargo = 'Coordenador / Subgerente';
                      else displayCargo = 'Operador de Loja';
                    } else { displayCargo = 'Acesso Restrito'; }
                  }

                  let roleColor = 'var(--success)'; let roleBg = 'color-mix(in srgb, var(--success) 10%, transparent)'; let roleLabel = 'Operação de Loja'; let IconLevel = Store;
                  if (u.role === 'ADMIN') { roleColor = 'var(--danger)'; roleBg = 'color-mix(in srgb, var(--danger) 10%, transparent)'; roleLabel = 'Administrador Master'; IconLevel = ShieldAlert; }
                  else if (u.role === 'MANUTENCAO') { roleColor = 'var(--info)'; roleBg = 'color-mix(in srgb, var(--info) 10%, transparent)'; roleLabel = 'Equipe Técnica'; IconLevel = Wrench; }
                  else if (u.role === 'DEV') { roleColor = 'var(--accent-violet)'; roleBg = 'rgba(168, 85, 247, 0.1)'; roleLabel = 'Desenvolvedor'; IconLevel = ShieldCheck; }

                  return (
                    <tr key={u.id} className="identity-table-row">
                      <td data-label="Usuário">
                        <div className="user-profile-box">
                          <div className="user-avatar-circle" style={{ background: `linear-gradient(135deg, ${roleColor} 0%, color-mix(in srgb, ${roleColor} 20%, black) 100%)`, border: `1px solid color-mix(in srgb, ${roleColor} 50%, transparent)` }}>
                            {displayNome.charAt(0).toUpperCase()}
                          </div>
                          <div className="user-details">
                            <span className="user-name-table">{displayNome}</span>
                            <span className="user-role-table">{displayCargo}</span>
                          </div>
                        </div>
                      </td>
                      
                      <td data-label="Login">
                        <div className="login-badge"><UserCircle size={14} color="var(--info)"/> @{u.usuario}</div>
                      </td>

                      {roleLogada === 'DEV' && (
                        <td data-label="Empresa / Cliente">
                          <span className="tenant-badge" title="Empresa vinculada">
                            <Briefcase size={14}/> {u.empresa || 'Sem Empresa'}
                          </span>
                        </td>
                      )}
                      
                      <td data-label="Nível de Acesso">
                        <div className="role-security-badge" style={{ color: roleColor, background: roleBg, border: `1px solid color-mix(in srgb, ${roleColor} 30%, transparent)` }}>
                          <IconLevel size={14} /> {roleLabel}
                        </div>
                      </td>

                      <td data-label="Postura de Segurança">
                        <div className="identity-security-state">
                          <span className={u.security_blocked ? 'security-state blocked' : 'security-state active'}>{u.security_blocked ? <ShieldX size={13}/> : <ShieldCheck size={13}/>} {u.security_blocked ? 'Bloqueado' : 'Liberado'}</span>
                          <span className={u.mfa_enabled ? 'security-state mfa-on' : 'security-state mfa-off'}><KeyRound size={13}/> {u.mfa_enabled ? 'MFA ativo' : (u.mfa_required ? 'MFA pendente' : 'Sem MFA')}</span>
                        </div>
                      </td>
                      
                      <td data-label="Loja Vinculada">
                        {u.role === 'LOJA' ? (
                          <span className="location-tag"><MapPin size={14} color="var(--warning)"/> {u.filial || 'Sem loja'}</span>
                        ) : (
                          <span className="location-tag global"><Globe2 size={14}/> Acesso Livre (Todas)</span>
                        )}
                      </td>
                      
                      <td data-label="Ações" style={{ textAlign: 'right' }}>
                        {roleLogada === 'DEV' && !isSelf && <button className={`identity-btn-action ${u.security_blocked ? 'unlock' : 'block'}`} onClick={() => alternarBloqueioUsuario(u)} title={u.security_blocked ? 'Liberar identidade' : 'Bloquear identidade'}>
                          {u.security_blocked ? <ShieldCheck size={18}/> : <ShieldX size={18}/>}
                        </button>}
                        {podeGerenciar && <button className="identity-btn-action edit" onClick={() => {
                            let editTipoAcesso = 'OUTROS';
                            if (u.role === 'LOJA') {
                              if (u.nome_gerente) editTipoAcesso = 'GERENTE';
                              else if (u.nome_coordenador) editTipoAcesso = 'COORDENADOR';
                            } else if (u.role === 'MANUTENCAO') {
                              editTipoAcesso = 'TECNICO';
                            }
                            setFormUsuario({ ...u, nome: displayNome, senha: '', tipo_acesso: editTipoAcesso }); 
                            setShowPassword(false);
                            setModalUsuario(true); 
                          }} title="Editar Usuário">
                          <Settings size={18} />
                        </button>}
                        {podeGerenciar && !isSelf && <button className="identity-btn-action delete" onClick={() => pedirExclusaoUsuario(u.id, displayNome)} title="Excluir Usuário">
                          <Lock size={18} />
                        </button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {usuariosVisiveis.length < usuariosExibidos.length && (
        <div className="identity-load-more">
          <span>Mostrando {usuariosVisiveis.length} de {usuariosExibidos.length} identidades</span>
          <button type="button" onClick={() => setLimiteVisivel(limite => limite + 12)}>
            Carregar mais identidades
          </button>
        </div>
      )}

      {/* MODAL DE CADASTRO DE USUÁRIO */}
      {modalUsuario && (
        <div className="modal-overlay">
          <div className="identity-modal-content-custom anim-slide-up">
            
            <div className="identity-modal-header-custom" style={{ borderBottomColor: modalHeaderInfo.color }}>
              <div className="identity-modal-icon-bg" style={{ color: modalHeaderInfo.color, background: `color-mix(in srgb, ${modalHeaderInfo.color} 15%, transparent)`, boxShadow: `inset 0 0 12px color-mix(in srgb, ${modalHeaderInfo.color} 30%, transparent)` }}>
                <modalHeaderInfo.icon size={28} />
              </div>
              <div>
                <h3>{formUsuario.id ? 'Edição de Usuário' : 'Cadastro de Usuário'}</h3>
                <span style={{ color: modalHeaderInfo.color, fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {modalHeaderInfo.title}
                </span>
              </div>
            </div>

            <form onSubmit={salvarUsuario} className="identity-modal-form-custom">
              
              <div className="identity-form-group-custom">
                <div className="identity-form-grid">
                  
                  {roleLogada === 'DEV' && (
                    <div style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                      <label style={{ color: 'var(--success)' }}>Vincular a uma Empresa / Cliente</label>
                      <select style={{ border: '1px solid var(--success)', background: 'rgba(16, 185, 129, 0.05)', '--focus-color': 'var(--success)' }} value={formUsuario.empresa} onChange={e => setFormUsuario({ ...formUsuario, empresa: e.target.value })} required>
                        <option value="">Selecione o cliente...</option>
                        {empresasDb.map(emp => <option key={emp.id} value={emp.nome}>{emp.nome}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>Nome Completo do Usuário</label>
                    <input type="text" value={formUsuario.nome} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} placeholder="Ex: Carlos Almeida" required autoFocus style={{ '--focus-color': modalHeaderInfo.color }} />
                  </div>
                  
                  {formUsuario.role === 'LOJA' && (
                    <div>
                      <label>Cargo na Loja</label>
                      <select value={formUsuario.tipo_acesso} onChange={e => setFormUsuario({ ...formUsuario, tipo_acesso: e.target.value })} required style={{ '--focus-color': modalHeaderInfo.color }}>
                        <option value="GERENTE">Gerente de Loja</option>
                        <option value="COORDENADOR">Coordenador / Subgerente</option>
                        <option value="OUTROS">Operador / Funcionário</option>
                      </select>
                    </div>
                  )}

                  {formUsuario.role === 'LOJA' && (
                    <div>
                      <label>Loja Vinculada</label>
                      <select value={formUsuario.filial} onChange={e => setFormUsuario({ ...formUsuario, filial: e.target.value })} required style={{ '--focus-color': modalHeaderInfo.color }}>
                        <option value="">Selecione a loja...</option>
                        {filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  )}

                  {formUsuario.role !== 'LOJA' && (
                    <div className="identity-security-warning-box" style={{ gridColumn: '1 / -1', margin: '0' }}>
                      <ShieldCheck size={20} style={{ flexShrink: 0 }} /> 
                      <span>Atenção: Este perfil terá acesso total e poderá visualizar os dados de <strong>todas as lojas</strong> do sistema.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="identity-form-group-custom" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <div className="identity-form-grid">
                  <div>
                    <label>Login (Usuário)</label>
                    <input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({ ...formUsuario, usuario: e.target.value })} placeholder="Ex: carlos.almeida" required style={{ '--focus-color': modalHeaderInfo.color }} />
                  </div>
                  <div>
                    <label>
                      Senha de Acesso 
                      {formUsuario.id && <span style={{color:'var(--text-muted)', fontSize:'0.7rem'}}> (Deixe em branco para não alterar)</span>}
                    </label>
                    <div className="password-input-wrapper">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={formUsuario.senha} 
                        onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })} 
                        placeholder="••••••••" 
                        required={!formUsuario.id} 
                        style={{ '--focus-color': modalHeaderInfo.color }}
                      />
                      <button type="button" className="btn-toggle-view" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {/* Validador de Segurança da Senha */}
                    {(formUsuario.senha || !formUsuario.id) && (
                      <div className="password-strength-container">
                        <div className="strength-bars">
                          <div className="str-bar" style={{ background: passwordStrength.score >= 1 ? passwordStrength.color : '' }}></div>
                          <div className="str-bar" style={{ background: passwordStrength.score >= 2 ? passwordStrength.color : '' }}></div>
                          <div className="str-bar" style={{ background: passwordStrength.score >= 3 ? passwordStrength.color : '' }}></div>
                        </div>
                        <span className="str-text" style={{ color: passwordStrength.color }}>{passwordStrength.text || 'Obrigatória'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="identity-modal-actions-custom">
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} onClick={() => setModalUsuario(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" style={{ backgroundColor: modalHeaderInfo.color, color: modalHeaderInfo.color === 'var(--danger)' ? 'white' : 'var(--technical-canvas)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: `0 4px 15px color-mix(in srgb, ${modalHeaderInfo.color} 30%, transparent)` }}>
                  <Save size={18} /> Salvar Usuário
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
