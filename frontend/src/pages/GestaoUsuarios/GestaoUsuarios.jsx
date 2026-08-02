import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Wrench, Edit, X, Save, ShieldAlert, Store, 
  UserCircle, MapPin, Search, Shield, ShieldCheck, 
  Lock, Briefcase, Eye, EyeOff, Users, Settings
} from 'lucide-react';
import './GestaoUsuarios.css';
import logger from '../../utils/logger';

/**
 * Página de Gestão de Usuários e Acessos (IAM)
 *
 * Responsabilidades:
 * - Listar, criar, editar e excluir contas de usuário
 * - Prover UI para definição de roles, MFA e bloqueios
 * - Integrar com endpoints auxiliares para filiais e empresas
 */
export default function GestaoUsuarios({ api, showToast, setModalConfig }) {

  const roleLogada = sessionStorage.getItem('userRole') || 'LOJA';

  const formInicialUsuario = {
    id: '', usuario: '', senha: '', role: 'LOJA', filial: '', tipo_acesso: 'GERENTE', nome: '', empresa: ''
  };

  const [usuariosLocais, setUsuariosLocais] = useState([]);
  const [filiaisDb, setFiliaisDb] = useState([]);
  const [empresasDb, setEmpresasDb] = useState([]);
  
  const [formUsuario, setFormUsuario] = useState({ ...formInicialUsuario });
  const [modalUsuario, setModalUsuario] = useState(false);
  
  const [busca, setBusca] = useState('');
  const [filtroPrivilegio, setFiltroPrivilegio] = useState('TODOS');
  
  // Segurança UX
  const [showPassword, setShowPassword] = useState(false);

  const carregarUsuarios = useCallback(async () => {
    try {
      const res = await api.get('/usuarios');
      setUsuariosLocais(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast('Erro ao carregar a lista de usuários do sistema.', 'error');
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

  const abrirModalUsuario = (tipoAcesso) => {
    let roleTarget = 'LOJA';
    if (tipoAcesso === 'TECNICO') roleTarget = 'MANUTENCAO';
    if (tipoAcesso === 'OUTROS') roleTarget = 'ADMIN';

    setFormUsuario({ ...formInicialUsuario, role: roleTarget, tipo_acesso: tipoAcesso });
    setShowPassword(false);
    setModalUsuario(true);
  };

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

  const usuariosExibidos = useMemo(() => {
    if (!usuariosLocais) return [];
    
    return usuariosLocais.filter(u => {
      const displayNome = u.nome || u.nome_tecnico || u.nome_gerente || u.nome_coordenador || u.usuario || '';
      
      const matchBusca = 
        displayNome.toLowerCase().includes(busca.toLowerCase()) ||
        (u.usuario && u.usuario.toLowerCase().includes(busca.toLowerCase())) ||
        (u.filial && u.filial.toLowerCase().includes(busca.toLowerCase()));
      
      const matchFiltro = filtroPrivilegio === 'TODOS' || u.role === filtroPrivilegio;
      
      return matchBusca && matchFiltro;
    }).sort((a, b) => {
      const roleWeight = { 'ADMIN': 3, 'MANUTENCAO': 2, 'LOJA': 1 };
      return (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0);
    });
  }, [usuariosLocais, busca, filtroPrivilegio]);

  const kpis = useMemo(() => {
    if (!usuariosLocais) return { total: 0, admin: 0, tech: 0, loja: 0 };
    let admin = 0; let tech = 0; let loja = 0;
    
    usuariosLocais.forEach(u => {
      if (u.role === 'ADMIN') admin++;
      else if (u.role === 'MANUTENCAO') tech++;
      else if (u.role === 'LOJA') loja++;
    });

    return { total: usuariosLocais.length, admin, tech, loja };
  }, [usuariosLocais]);

  const modalHeaderInfo = useMemo(() => {
    if (formUsuario.role === 'ADMIN') return { icon: ShieldAlert, color: '#ef4444', title: 'Acesso Administrativo (Total)' };
    if (formUsuario.role === 'MANUTENCAO') return { icon: Wrench, color: '#38bdf8', title: 'Acesso Técnico (Manutenção)' };
    return { icon: Store, color: '#10b981', title: 'Acesso Operacional (Loja)' };
  }, [formUsuario.role]);

  // Cálculo de Força da Senha
  const passwordStrength = useMemo(() => {
    const p = formUsuario.senha;
    if (!p) return { score: 0, text: '', color: 'transparent' };
    let score = 0;
    if (p.length > 5) score += 1;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;

    if (score <= 2) return { score: 1, text: 'Senha Fraca', color: '#ef4444' };
    if (score === 3 || score === 4) return { score: 2, text: 'Segurança Média', color: '#f59e0b' };
    return { score: 3, text: 'Senha Forte', color: '#10b981' };
  }, [formUsuario.senha]);

  return (
    <div className="anim-fade-in stagger-1">
      
      {/* HERO SECTION */}
      <div className="usuarios-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle">
            <Users size={28} />
          </div>
          <div>
            <h3 className="hero-main-title">Gestão de Usuários & Acessos</h3>
            <span className="hero-subtitle">Controle de senhas, permissões e perfis de operação do sistema.</span>
          </div>
        </div>

        <div className="hero-actions">
          <button className="btn-provision tech" onClick={() => abrirModalUsuario('TECNICO')}>
            <Wrench size={16} /> Cadastrar Técnico
          </button>
          <button className="btn-provision store" onClick={() => abrirModalUsuario('GERENTE')}>
            <Store size={16} /> Cadastrar Funcionário
          </button>

          {roleLogada === 'DEV' && (
            <button className="btn-provision master" onClick={() => abrirModalUsuario('OUTROS')}>
              <ShieldAlert size={16} /> Cadastrar Administrador
            </button>
          )}
        </div>
      </div>

      {/* CONTROLES E KPIS */}
      <div className="control-panel stagger-2">
        <div className="kpi-bar">
          <div className={`kpi-item-small ${filtroPrivilegio === 'TODOS' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('TODOS')}>
            <span className="kpi-val">{kpis.total}</span>
            <span className="kpi-lbl">Todos os Usuários</span>
          </div>
          <div className={`kpi-item-small danger ${filtroPrivilegio === 'ADMIN' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('ADMIN')}>
            <span className="kpi-val">{kpis.admin}</span>
            <span className="kpi-lbl">Administradores</span>
          </div>
          <div className={`kpi-item-small info ${filtroPrivilegio === 'MANUTENCAO' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('MANUTENCAO')}>
            <span className="kpi-val">{kpis.tech}</span>
            <span className="kpi-lbl">Equipe Técnica</span>
          </div>
          <div className={`kpi-item-small success ${filtroPrivilegio === 'LOJA' ? 'active' : ''}`} onClick={() => setFiltroPrivilegio('LOJA')}>
            <span className="kpi-val">{kpis.loja}</span>
            <span className="kpi-lbl">Usuários de Loja</span>
          </div>
        </div>

        <div className="search-box">
          <Search size={18} color="#94a3b8" />
          <input type="text" placeholder="Buscar usuário por nome, login ou loja..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* TABELA DE USUÁRIOS */}
      <div className="table-card stagger-3">
        {(!usuariosExibidos || usuariosExibidos.length === 0) ? (
           <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
             <Users size={48} style={{ opacity: 0.25, marginBottom: '1rem' }} />
             <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Nenhum usuário localizado</h3>
             <p>Ajuste os filtros acima ou tente pesquisar outro nome.</p>
           </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Login no Sistema</th>
                  {roleLogada === 'DEV' && <th>Empresa / Cliente</th>}
                  <th>Nível de Acesso</th>
                  <th>Loja Vinculada</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuariosExibidos.map(u => {
                  
                  const displayNome = u.nome || u.nome_tecnico || u.nome_gerente || u.nome_coordenador || u.usuario || 'Sem Nome';
                  
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

                  let roleColor = '#10b981'; let roleBg = 'rgba(16, 185, 129, 0.1)'; let roleLabel = 'Operação de Loja'; let IconLevel = Store;
                  if (u.role === 'ADMIN') { roleColor = '#ef4444'; roleBg = 'rgba(239, 68, 68, 0.1)'; roleLabel = 'Administrador Master'; IconLevel = ShieldAlert; } 
                  else if (u.role === 'MANUTENCAO') { roleColor = '#38bdf8'; roleBg = 'rgba(56, 189, 248, 0.1)'; roleLabel = 'Equipe Técnica'; IconLevel = Wrench; }

                  return (
                    <tr key={u.id} className="table-row">
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
                        <div className="login-badge"><UserCircle size={14} color="#38bdf8"/> @{u.usuario}</div>
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
                      
                      <td data-label="Loja Vinculada">
                        {u.role === 'LOJA' ? (
                          <span className="location-tag"><MapPin size={14} color="#f59e0b"/> {u.filial || 'Sem loja'}</span>
                        ) : (
                          <span className="location-tag global"><Globe2 size={14}/> Acesso Livre (Todas)</span>
                        )}
                      </td>
                      
                      <td data-label="Ações" style={{ textAlign: 'right' }}>
                        <button className="btn-action edit" onClick={() => { 
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
                        </button>
                        <button className="btn-action delete" onClick={() => pedirExclusaoUsuario(u.id, displayNome)} title="Excluir Usuário">
                          <Lock size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO DE USUÁRIO */}
      {modalUsuario && (
        <div className="modal-overlay">
          <div className="modal-content-custom anim-slide-up">
            
            <div className="modal-header-custom" style={{ borderBottomColor: modalHeaderInfo.color }}>
              <div className="modal-icon-bg" style={{ color: modalHeaderInfo.color, background: `color-mix(in srgb, ${modalHeaderInfo.color} 15%, transparent)`, boxShadow: `inset 0 0 12px color-mix(in srgb, ${modalHeaderInfo.color} 30%, transparent)` }}>
                <modalHeaderInfo.icon size={28} />
              </div>
              <div>
                <h3>{formUsuario.id ? 'Edição de Usuário' : 'Cadastro de Usuário'}</h3>
                <span style={{ color: modalHeaderInfo.color, fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {modalHeaderInfo.title}
                </span>
              </div>
            </div>

            <form onSubmit={salvarUsuario} className="modal-form-custom">
              
              <div className="form-group-custom">
                <div className="form-grid">
                  
                  {roleLogada === 'DEV' && (
                    <div style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                      <label style={{ color: '#10b981' }}>Vincular a uma Empresa / Cliente</label>
                      <select style={{ border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.05)', '--focus-color': '#10b981' }} value={formUsuario.empresa} onChange={e => setFormUsuario({ ...formUsuario, empresa: e.target.value })} required>
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
                    <div className="security-warning-box" style={{ gridColumn: '1 / -1', margin: '0' }}>
                      <ShieldCheck size={20} style={{ flexShrink: 0 }} /> 
                      <span>Atenção: Este perfil terá acesso total e poderá visualizar os dados de <strong>todas as lojas</strong> do sistema.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group-custom" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <div className="form-grid">
                  <div>
                    <label>Login (Usuário)</label>
                    <input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({ ...formUsuario, usuario: e.target.value })} placeholder="Ex: carlos.almeida" required style={{ '--focus-color': modalHeaderInfo.color }} />
                  </div>
                  <div>
                    <label>
                      Senha de Acesso 
                      {formUsuario.id && <span style={{color:'#64748b', fontSize:'0.7rem'}}> (Deixe em branco para não alterar)</span>}
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

              <div className="modal-actions-custom">
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} onClick={() => setModalUsuario(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" style={{ backgroundColor: modalHeaderInfo.color, color: modalHeaderInfo.color === '#ef4444' ? 'white' : '#020617', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: `0 4px 15px color-mix(in srgb, ${modalHeaderInfo.color} 30%, transparent)` }}>
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

const Globe2 = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);