import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CheckCircle, Clock, Building2, Mail, Loader2, 
  Send, Search, Server, Terminal, 
  Copy, Check, Eye, X, Zap, PlusCircle, Link, RefreshCw, AlertCircle 
} from 'lucide-react';
import '../Suporte/SuporteTelas.css';
import './AprovacoesSaaS.css';

export default function AprovacoesSaaS({ showToast, isOffline, api, socket }) {
  const [pendentes, setPendentes] = useState([]);
  const [acaoProcessando, setAcaoProcessando] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [busca, setBusca] = useState('');
  
  // Modal de inspeção e Modal de Cadastro Manual
  const [modalInspecao, setModalInspecao] = useState(null);
  const [modalManual, setModalManual] = useState(false);
  const [copiado, setCopiado] = useState('');

  // Formulário de Cadastro Manual de Tenant
  const [formManual, setFormManual] = useState({
    empresa: '', cnpj: '', responsavel: '', email: '', telefone: ''
  });
  const [submetendoManual, setSubmetendoManual] = useState(false);

  // ============================================================================
  // BUSCA NA API OS PRÉ-CADASTROS PENDENTES
  // ============================================================================
  const carregarPendentes = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setIsLoadingList(true);
      const res = await api.get('/pre-cadastros');
      setPendentes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (!silencioso) showToast?.('Erro ao carregar fila de onboarding SaaS.', 'error');
    } finally {
      if (!silencioso) setIsLoadingList(false);
    }
  }, [api, showToast]);

  useEffect(() => {
    if (!isOffline) carregarPendentes();
    
    if (socket) {
      const handler = () => carregarPendentes(true);
      socket.on('novo_pre_cadastro', handler);
      return () => socket.off('novo_pre_cadastro', handler);
    }
  }, [isOffline, socket, carregarPendentes]);

  // ============================================================================
  // FILTRAGEM INSTANTÂNEA POR TERMO DE BUSCA
  // ============================================================================
  const pendentesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pendentes;
    return pendentes.filter(req => {
      const texto = `${req.empresa} ${req.cnpj} ${req.responsavel} ${req.email} ${req.telefone}`.toLowerCase();
      return texto.includes(termo);
    });
  }, [pendentes, busca]);

  // ============================================================================
  // APROVAÇÃO & DEPLOY AUTOMÁTICO DO TENANT
  // ============================================================================
  const aprovarCadastro = async (id, empresa, email) => {
    if (isOffline) return showToast?.("Ação bloqueada. Sem conexão com a rede.", "error");
    setAcaoProcessando(id);
    
    try {
      await api.post(`/pre-cadastros/${id}/aprovar`);
      setPendentes(prev => prev.filter(p => p.id !== id));
      showToast?.(`<b>Empresa Aprovada!</b><br/>E-mail de boas-vindas e credenciais enviado para <strong>${email}</strong>.`, 'success');
      if (modalInspecao?.id === id) setModalInspecao(null);
    } catch (err) {
      showToast?.("Falha ao aprovar a empresa e notificar o cliente.", "error");
    } finally {
      setAcaoProcessando(null);
    }
  };

  // ============================================================================
  // REJEIÇÃO & ARQUIVAMENTO
  // ============================================================================
  const rejeitarCadastro = async (id, empresa) => {
    if (isOffline) return showToast?.("Ação bloqueada. Sem conexão com a rede.", "error");
    if (!window.confirm(`Tem certeza que deseja rejeitar o pré-cadastro da organização "${empresa}"?`)) return;
    setAcaoProcessando(id);
    
    try {
      await api.post(`/pre-cadastros/${id}/rejeitar`);
      setPendentes(prev => prev.filter(p => p.id !== id));
      showToast?.(`O requerimento de <b>${empresa}</b> foi rejeitado e arquivado.`, 'warning');
      if (modalInspecao?.id === id) setModalInspecao(null);
    } catch (err) {
      showToast?.("Ocorreu um erro ao rejeitar o pedido.", "error");
    } finally {
      setAcaoProcessando(null);
    }
  };

  // ============================================================================
  // CADASTRO MANUAL DE TENANT (SYSADMIN PROATIVO)
  // ============================================================================
  const handleCriarManual = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast?.("Sem conexão de rede.", "error");
    
    setSubmetendoManual(true);
    try {
      await api.post('/pre-cadastros', formManual);
      showToast?.(`Requerimento de <b>${formManual.empresa}</b> adicionado à fila para aprovação.`, 'success');
      setFormManual({ empresa: '', cnpj: '', responsavel: '', email: '', telefone: '' });
      setModalManual(false);
      carregarPendentes(true);
    } catch (err) {
      showToast?.("Erro ao criar cadastro manual de Empresa.", "error");
    } finally {
      setSubmetendoManual(false);
    }
  };

  const copiarDado = (e, texto, chave) => {
    e.stopPropagation();
    navigator.clipboard.writeText(texto);
    setCopiado(chave);
    showToast?.('Copiado para a área de transferência!', 'info');
    setTimeout(() => setCopiado(''), 2000);
  };

  const copiarLinkOnboarding = () => {
    const url = `${window.location.origin}/?mode=register`;
    navigator.clipboard.writeText(url);
    showToast?.('Link do formulário público copiado para enviar ao cliente!', 'success');
  };

  return (
    <div className="support-flow-shell anim-fade-in">
      
      {/* HERO OPERACIONAL DO SYSADMIN */}
      <section className="support-flow-hero aprovacoes-hero">
        <div>
          <span className="support-flow-kicker"><Terminal size={14} /> Aprovação SaaS</span>
          <h1>Onboarding e aprovação de novas Empresas</h1>
          <p>Supervisione os requerimentos de novas empresas, valide dados fiscais e execute o deploy automático com criação de filial Matriz e usuário Root.</p>
        </div>
        <div className="support-flow-stats">
          <div className="support-flow-stat"><strong>{pendentes.length}</strong><span>Na fila de espera</span></div>
          <div className="support-flow-stat"><strong>SaaS</strong><span>Deploy Automático</span></div>
          <div className="support-flow-stat"><strong>&lt; 5s</strong><span>SLA de Aprovação</span></div>
          <div className="support-flow-stat"><strong>ROOT</strong><span>Nível de Operação</span></div>
        </div>
      </section>

      {/* BARRA DE PESQUISA & AÇÕES SUPERIORES */}
      <div className="support-flow-toolbar">
        <div className="support-flow-search">
          <Search size={18} />
          <input 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            placeholder="Buscar empresa, CNPJ, responsável técnico, e-mail ou telefone..." 
          />
        </div>
        
        <div className="aprovacoes-toolbar-actions">
          <button 
            onClick={() => setModalManual(true)} 
            className="btn btn-primary"
            style={{ padding: '10px 16px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusCircle size={16} /> Aprovar Manual
          </button>
          
          <button 
            onClick={() => carregarPendentes(false)} 
            className="btn btn-outline aprovacoes-refresh-btn"
            title="Atualizar Fila"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* TABELA DE REQUERIMENTOS OU EMPTY STATE ATIVO */}
      <div className="card aprovacoes-card">
        {isLoadingList ? (
          <div className="empty-state aprovacoes-empty-state">
            <Loader2 size={42} color="var(--primary)" className="spin" style={{ marginBottom: '1rem' }} />
            <h3>Carregando fila de Onboarding...</h3>
            <p>Buscando novas solicitações de Empresas no banco de dados.</p>
          </div>
        ) : pendentesFiltrados.length === 0 ? (
          
          /* =============================================================== */
          /* EMPTY STATE INTELIGENTE (COM AÇÕES QUANDO A FILA ESTÁ VAZIA)    */
          /* =============================================================== */
          <div className="empty-state aprovacoes-empty-state">
            <CheckCircle size={52} color="var(--success)" style={{ opacity: 0.6, marginBottom: '1rem' }} />
            <h3>{busca ? `Nenhum resultado para "${busca}"` : 'SLA Zero Inbox — Fila Limpa'}</h3>
            <p>
              {busca 
                ? 'Nenhum requerimento corresponde ao filtro digitado na pesquisa.' 
                : 'Não existem solicitações de aprovação pendentes no momento. Escolha uma das ações abaixo para agilizar novos ingressos.'}
            </p>

            {busca ? (
              <button 
                onClick={() => setBusca('')} 
                className="btn btn-outline" 
                style={{ marginTop: '1.2rem', padding: '8px 18px', fontSize: '0.82rem' }}
              >
                Limpar Filtro de Busca
              </button>
            ) : (
              /* GRID DE 3 AÇÕES RÁPIDAS QUANDO NÃO HÁ NINGUÉM NA FILA */
              <div className="aprovacoes-empty-grid anim-fade-in">
                
                <div className="aprovacoes-empty-action-card">
                  <div>
                    <div className="aprovacoes-empty-action-icon" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                      <PlusCircle size={20} />
                    </div>
                    <h4>Aprovar Nova Empresa</h4>
                    <p>Cliente ao telefone ou contrato assinado? Cadastre os dados agora e inicie o deploy.</p>
                  </div>
                  <button 
                    onClick={() => setModalManual(true)} 
                    className="btn btn-primary aprovacoes-empty-action-btn"
                  >
                    Abrir Cadastro Manual
                  </button>
                </div>

                <div className="aprovacoes-empty-action-card">
                  <div>
                    <div className="aprovacoes-empty-action-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                      <Link size={20} />
                    </div>
                    <h4>Convite Público Onboarding</h4>
                    <p>Copie a URL oficial do formulário corporativo para enviar ao WhatsApp ou E-mail do cliente.</p>
                  </div>
                  <button 
                    onClick={copiarLinkOnboarding} 
                    className="btn btn-outline aprovacoes-empty-action-btn"
                  >
                    Copiar Link de Onboarding
                  </button>
                </div>

                <div className="aprovacoes-empty-action-card">
                  <div>
                    <div className="aprovacoes-empty-action-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                      <RefreshCw size={20} />
                    </div>
                    <h4>Sincronizar Servidor</h4>
                    <p>Verifique se novos pacotes de cadastro entraram no banco de dados nos últimos segundos.</p>
                  </div>
                  <button 
                    onClick={() => carregarPendentes(false)} 
                    className="btn btn-outline aprovacoes-empty-action-btn"
                  >
                    Sincronizar Fila Agora
                  </button>
                </div>

              </div>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table aprovacoes-table">
              <thead>
                <tr>
                  <th className="aprovacoes-th"><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Organização / CNPJ</th>
                  <th className="aprovacoes-th"><Mail size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Contato Técnico</th>
                  <th className="aprovacoes-th"><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Data da Solicitação</th>
                  <th className="aprovacoes-th">Status</th>
                  <th className="aprovacoes-th" style={{ textAlign: 'right' }}>Ação SysAdmin</th>
                </tr>
              </thead>
              <tbody>
                {pendentesFiltrados.map((req) => (
                  <tr 
                    key={req.id}
                    onClick={() => setModalInspecao(req)}
                    className="aprovacoes-tr"
                  >
                    <td className="aprovacoes-td">
                      <div className="aprovacoes-org-name">{req.empresa}</div>
                      <div className="aprovacoes-org-cnpj">
                        <span>CNPJ: {req.cnpj}</span>
                        <button 
                          onClick={(e) => copiarDado(e, req.cnpj, `cnpj-${req.id}`)}
                          className="aprovacoes-copy-btn"
                          title="Copiar CNPJ"
                        >
                          {copiado === `cnpj-${req.id}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                    <td className="aprovacoes-td">
                      <div className="aprovacoes-contact-name">{req.responsavel}</div>
                      <div className="aprovacoes-contact-email">
                        <span>{req.email}</span>
                        <button 
                          onClick={(e) => copiarDado(e, req.email, `email-${req.id}`)}
                          className="aprovacoes-copy-btn"
                          title="Copiar E-mail"
                        >
                          {copiado === `email-${req.id}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        </button>
                      </div>
                      <div className="aprovacoes-contact-phone">{req.telefone}</div>
                    </td>
                    <td className="aprovacoes-td" style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      {new Date(req.data_solicitacao).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="aprovacoes-td">
                      <span className="aprovacoes-badge-pending">
                        Pendente Deploy
                      </span>
                    </td>
                    <td className="aprovacoes-td" style={{ textAlign: 'right' }}>
                      {acaoProcessando === req.id ? (
                        <span className="aprovacoes-loading-text">
                          <Loader2 size={16} className="spin" /> Provisionando...
                        </span>
                      ) : (
                        <div className="aprovacoes-actions">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setModalInspecao(req); }} 
                            className="btn btn-outline aprovacoes-btn-inspect"
                          >
                            <Eye size={14} /> Inspecionar
                          </button>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); aprovarCadastro(req.id, req.empresa, req.email); }} 
                            className="btn btn-primary aprovacoes-btn-deploy"
                          >
                            <Send size={14} /> Aprovar & Deploy
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE CADASTRO MANUAL DE TENANT (SYSADMIN PROATIVO)                */}
      {/* ===================================================================== */}
      {modalManual && (
        <div className="modal-overlay" onClick={() => setModalManual(false)}>
          <div 
            className="modal-content anim-slide-up" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '1.8rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Terminal size={14} /> Aprovação Proativa
                </span>
                <h3 style={{ margin: '4px 0 0 0', color: 'white', fontSize: '1.25rem' }}>Cadastrar Empresa no Onboarding</h3>
              </div>
              <button onClick={() => setModalManual(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCriarManual} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Razão Social / Organização *</label>
                <input 
                  type="text" 
                  placeholder="Ex: Laticínios Beta S/A" 
                  required 
                  value={formManual.empresa} 
                  onChange={e => setFormManual({...formManual, empresa: e.target.value})}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>CNPJ / NIF *</label>
                  <input 
                    type="text" 
                    placeholder="00.000.000/0001-00" 
                    required 
                    value={formManual.cnpj} 
                    onChange={e => setFormManual({...formManual, cnpj: e.target.value})}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Telefone / WhatsApp *</label>
                  <input 
                    type="text" 
                    placeholder="(11) 90000-0000" 
                    required 
                    value={formManual.telefone} 
                    onChange={e => setFormManual({...formManual, telefone: e.target.value})}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Responsável Técnico *</label>
                <input 
                  type="text" 
                  placeholder="Nome do gestor ou diretor" 
                  required 
                  value={formManual.responsavel} 
                  onChange={e => setFormManual({...formManual, responsavel: e.target.value})}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>E-mail Corporativo (Receberá credenciais Root) *</label>
                <input 
                  type="email" 
                  placeholder="contato@empresa.com.br" 
                  required 
                  value={formManual.email} 
                  onChange={e => setFormManual({...formManual, email: e.target.value})}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '0.4rem' }}>
                <button type="button" onClick={() => setModalManual(false)} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submetendoManual} style={{ padding: '8px 20px', fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {submetendoManual ? <Loader2 size={16} className="spin" /> : <PlusCircle size={16} />}
                  Adicionar à Fila SaaS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE INSPEÇÃO E PRÉ-DEPLOY DO TENANT */}
      {/* ===================================================================== */}
      {modalInspecao && (
        <div className="modal-overlay" onClick={() => setModalInspecao(null)}>
          <div 
            className="modal-content anim-slide-up aprovacoes-modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aprovacoes-modal-header">
              <div>
                <span className="aprovacoes-modal-kicker">
                  <Server size={14} /> Auditoria de Requerimento SaaS
                </span>
                <h3>{modalInspecao.empresa}</h3>
              </div>
              <button onClick={() => setModalInspecao(null)} className="aprovacoes-modal-close">
                <X size={22} />
              </button>
            </div>

            <div className="aprovacoes-modal-grid">
              <div>
                <span>CNPJ</span>
                <strong style={{ fontFamily: 'monospace' }}>{modalInspecao.cnpj}</strong>
              </div>
              <div>
                <span>Data da Submissão</span>
                <strong>{new Date(modalInspecao.data_solicitacao).toLocaleString()}</strong>
              </div>
              <div>
                <span>Responsável Técnico</span>
                <strong>{modalInspecao.responsavel}</strong>
              </div>
              <div>
                <span>Telefone de Contato</span>
                <strong>{modalInspecao.telefone}</strong>
              </div>
            </div>

            {/* PAINEL DE O QUE SERÁ EXECUTADO NO DEPLOY */}
            <div className="aprovacoes-modal-plan">
              <div className="aprovacoes-plan-title">
                <Zap size={16} /> Plano de Aprovação Automático
              </div>
              <ul className="aprovacoes-plan-list">
                <li>Registro oficial na tabela de <strong>Empresas Ativas</strong>.</li>
                <li>Criação da filial padrão <strong>"Matriz - {modalInspecao.empresa}"</strong> na tabela de Lojas.</li>
                <li>Geração do usuário Administrador Corporativo com sufixo numérico e <strong>senha aleatória forte</strong>.</li>
                <li>Disparo de <strong>e-mail de boas-vindas com credenciais</strong> via SMTP para <code>{modalInspecao.email}</code>.</li>
              </ul>
            </div>

            <div className="aprovacoes-modal-footer">
              <button 
                type="button" 
                onClick={() => rejeitarCadastro(modalInspecao.id, modalInspecao.empresa)}
                className="btn btn-outline aprovacoes-btn-reject" 
                disabled={acaoProcessando === modalInspecao.id}
              >
                Rejeitar & Arquivar
              </button>

              <button 
                type="button" 
                onClick={() => aprovarCadastro(modalInspecao.id, modalInspecao.empresa, modalInspecao.email)}
                className="btn btn-primary aprovacoes-btn-approve" 
                disabled={acaoProcessando === modalInspecao.id}
              >
                {acaoProcessando === modalInspecao.id ? <Loader2 size={16} className="spin" /> : <Send size={16} />} 
                {acaoProcessando === modalInspecao.id ? 'Aprovando...' : 'Aprovar & Aprovar Empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}