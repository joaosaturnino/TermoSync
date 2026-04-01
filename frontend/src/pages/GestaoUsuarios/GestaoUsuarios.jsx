import React, { useState } from 'react';
import { UserPlus, Wrench, Settings, Users, Edit, X, Save, ShieldAlert, Store, UserCircle, KeyRound, MapPin, AlertCircle } from 'lucide-react';
import './GestaoUsuarios.css';

export default function GestaoUsuarios({ api, showToast, usuariosLista, carregarUsuarios, filiaisDb, setModalConfig }) {
  const formInicialUsuario = { id: '', usuario: '', senha: '', role: 'LOJA', filial: '', tipo_acesso: 'GERENTE', nome_identidade: '' };
  const [formUsuario, setFormUsuario] = useState({ ...formInicialUsuario });
  const [modalUsuario, setModalUsuario] = useState(false);

  const abrirModalUsuario = (tipoAcesso) => {
    let roleTarget = 'LOJA'; if (tipoAcesso === 'TECNICO') roleTarget = 'MANUTENCAO'; if (tipoAcesso === 'OUTROS') roleTarget = 'ADMIN';
    setFormUsuario({ id: '', usuario: '', senha: '', role: roleTarget, filial: '', tipo_acesso: tipoAcesso, nome_identidade: '' }); setModalUsuario(true);
  };

  const salvarUsuario = async (e) => {
    e.preventDefault();
    try {
      const payload = { usuario: formUsuario.usuario, senha: formUsuario.senha, role: formUsuario.role, filial: formUsuario.role !== 'LOJA' ? 'Todas' : formUsuario.filial, nome_gerente: formUsuario.tipo_acesso === 'GERENTE' ? formUsuario.nome_identidade : null, nome_coordenador: formUsuario.tipo_acesso === 'COORDENADOR' ? formUsuario.nome_identidade : null, nome_tecnico: formUsuario.tipo_acesso === 'TECNICO' ? formUsuario.nome_identidade : null };
      if (formUsuario.id) { await api.put(`/usuarios/${formUsuario.id}`, payload); showToast('Credencial de acesso atualizada.', 'success'); } 
      else { if (!formUsuario.senha) return showToast('A palavra-passe é obrigatória para novas contas.', 'error'); await api.post('/usuarios', payload); showToast('Nova identidade registada com sucesso.', 'success'); }
      setModalUsuario(false); carregarUsuarios();
    } catch (error) { showToast('Erro: Este Login já se encontra em uso.', 'error'); }
  };

  const pedirExclusaoUsuario = (id, nome) => {
    setModalConfig({ isOpen: true, title: 'Remover Credencial', message: `Remover o acesso de "${nome}" permanentemente do sistema?`, isPrompt: false, onConfirm: async () => {
      try { await api.delete(`/usuarios/${id}`); showToast('Acesso revogado.', 'success'); carregarUsuarios(); } catch (e) { showToast('Erro ao remover conta.', 'error'); }
    }});
  };

  // Função auxiliar para escolher o ícone e a cor do cabeçalho do Modal
  const getModalHeader = (tipo) => {
    if (tipo === 'GERENTE') return { icon: <UserPlus size={24} style={{ color: 'var(--primary)' }}/>, title: 'Registar Gerente', color: 'var(--primary)' };
    if (tipo === 'COORDENADOR') return { icon: <UserPlus size={24} style={{ color: 'var(--info)' }}/>, title: 'Registar Coordenador', color: 'var(--info)' };
    if (tipo === 'TECNICO') return { icon: <Wrench size={24} style={{ color: 'var(--success)' }}/>, title: 'Registar Técnico', color: 'var(--success)' };
    return { icon: <ShieldAlert size={24} style={{ color: 'var(--danger)' }}/>, title: 'Registar Administrador', color: 'var(--danger)' };
  };

  const modalHeaderInfo = getModalHeader(formUsuario.tipo_acesso);

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 className="gestao-usuarios-title">Gestão de Identidades e Acessos</h3>
        <div className="gestao-usuarios-actions">
          <button className="btn btn-outline" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={() => abrirModalUsuario('GERENTE')}><UserPlus size={16} /> Novo Gerente</button>
          <button className="btn btn-outline" style={{ color: 'var(--info)', borderColor: 'var(--info)' }} onClick={() => abrirModalUsuario('COORDENADOR')}><UserPlus size={16} /> Novo Coordenador</button>
          <button className="btn btn-outline" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => abrirModalUsuario('TECNICO')}><Wrench size={16} /> Novo Técnico</button>
          <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => abrirModalUsuario('OUTROS')}><ShieldAlert size={16} /> Novo Admin</button>
        </div>
      </div>

      {!usuariosLista || usuariosLista.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <Users size={64} color="var(--primary)" style={{ marginBottom: '1rem', opacity: 0.8 }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Nenhuma Conta Registada</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Adicione o primeiro utilizador para conceder acesso ao sistema.</p>
        </div>
      ) : (
        <div className="card table-responsive gestao-usuarios-card">
          <table className="table">
            <thead>
              <tr>
                <th>Utilizador e Credencial</th>
                <th>Nível de Permissão</th>
                <th>Âmbito / Cobertura</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosLista.map(u => {
                let displayIdentity = 'Acesso Loja Geral'; 
                let tipoAcessoReal = 'GERAL';
                let badgeClass = 'store';
                let RoleIcon = Store;
                let roleName = 'Gestor de Loja';

                if (u.role === 'ADMIN') { 
                  displayIdentity = 'Controlo Total do Sistema'; 
                  tipoAcessoReal = 'OUTROS'; 
                  badgeClass = 'admin';
                  RoleIcon = ShieldAlert;
                  roleName = 'Admin Master';
                } else if (u.role === 'MANUTENCAO') { 
                  displayIdentity = `Identidade: ${u.nome_tecnico || 'Técnico Geral'}`; 
                  tipoAcessoReal = 'TECNICO'; 
                  badgeClass = 'tech';
                  RoleIcon = Wrench;
                  roleName = 'Manutenção Global';
                } else if (u.nome_gerente) { 
                  displayIdentity = `Identidade: Gerente (${u.nome_gerente})`; 
                  tipoAcessoReal = 'GERENTE'; 
                } else if (u.nome_coordenador) { 
                  displayIdentity = `Identidade: Coordenador (${u.nome_coordenador})`; 
                  tipoAcessoReal = 'COORDENADOR'; 
                }
                
                // Gera a letra do avatar (Primeira letra do utilizador)
                const avatarLetter = u.usuario.charAt(0).toUpperCase();
                const avatarColor = u.role === 'ADMIN' ? 'var(--danger)' : (u.role === 'MANUTENCAO' ? 'var(--success)' : 'var(--primary)');

                return (
                  <tr key={u.id}>
                    <td data-label="Credencial">
                      <div className="user-profile-box">
                        <div className="user-avatar-circle" style={{ backgroundColor: avatarColor }}>
                          {avatarLetter}
                        </div>
                        <div className="user-details">
                          <span className="user-login-name">@{u.usuario}</span>
                          <span className="user-identity-label">{displayIdentity}</span>
                        </div>
                      </div>
                    </td>
                    
                    <td data-label="Permissão">
                      <span className={`role-badge ${badgeClass}`}>
                        <RoleIcon size={14} /> {roleName}
                      </span>
                    </td>
                    
                    <td data-label="Âmbito">
                      <span className="scope-badge">
                        <MapPin size={14} style={{ color: 'var(--text-muted)' }}/>
                        {u.filial}
                      </span>
                    </td>
                    
                    <td data-label="Ações">
                      <button 
                        className="btn btn-action edit" 
                        title="Editar Permissões"
                        onClick={() => { setFormUsuario({ id: u.id, usuario: u.usuario, senha: '', role: u.role, filial: u.filial, tipo_acesso: tipoAcessoReal, nome_identidade: u.nome_gerente || u.nome_coordenador || u.nome_tecnico || '' }); setModalUsuario(true); }}
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        className="btn btn-action delete" 
                        title="Revogar Acesso"
                        onClick={() => pedirExclusaoUsuario(u.id, u.usuario)}
                      >
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

      {modalUsuario && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ maxWidth: '450px', width: '100%' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: modalHeaderInfo.color, marginBottom: '1.5rem', marginTop: 0 }}>
              {modalHeaderInfo.icon}
              {formUsuario.id ? 'Editar Permissões' : modalHeaderInfo.title}
            </h3>
            
            <form onSubmit={salvarUsuario}>
              <div className="form-grid gestao-usuarios-form-grid">
                {(formUsuario.tipo_acesso === 'GERENTE' || formUsuario.tipo_acesso === 'COORDENADOR') ? (
                  <>
                    <div>
                      <label>Nome Completo do {formUsuario.tipo_acesso === 'GERENTE' ? 'Gerente' : 'Coordenador'}</label>
                      <input type="text" value={formUsuario.nome_identidade} onChange={e => setFormUsuario({...formUsuario, nome_identidade: e.target.value})} required autoFocus />
                    </div>
                    <div>
                      <label>Login (Utilizador de Acesso)</label>
                      <input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} placeholder="Ex: joao.gerente" required />
                    </div>
                    <div>
                      <label>Senha {formUsuario.id && <span className="password-hint">(Deixe em branco para manter a atual)</span>}</label>
                      <input type="password" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} />
                    </div>
                    <div>
                      <label>Vincular à Loja / Filial</label>
                      <select className="select-input w-100" value={formUsuario.filial} onChange={e => setFormUsuario({...formUsuario, filial: e.target.value})} required>
                        <option value="">Selecione a Loja associada...</option>
                        {filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </>
                ) : formUsuario.tipo_acesso === 'TECNICO' ? (
                  <>
                    <div>
                      <label>Nome do Técnico</label>
                      <input type="text" value={formUsuario.nome_identidade} onChange={e => setFormUsuario({...formUsuario, nome_identidade: e.target.value})} required autoFocus />
                    </div>
                    <div>
                      <label>Login (Utilizador de Acesso)</label>
                      <input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} placeholder="Ex: tec.roberto" required />
                    </div>
                    <div>
                      <label>Senha {formUsuario.id && <span className="password-hint">(Deixe em branco para manter)</span>}</label>
                      <input type="password" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} />
                    </div>
                    <div className="tecnico-warning-box">
                      <AlertCircle size={24} color="var(--info)" style={{ flexShrink: 0 }} />
                      <span className="tecnico-warning-text">Os Técnicos de Manutenção possuem permissão nativa para acessar e resolver chamados em <strong>todas as lojas</strong> do sistema.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label>Nível de Permissão Máxima</label>
                      <select className="select-input w-100" value={formUsuario.role} onChange={(e) => setFormUsuario({...formUsuario, role: e.target.value})} required disabled={!!formUsuario.id}>
                        <option value="ADMIN">Administrador (Controlo Total)</option>
                      </select>
                    </div>
                    <div>
                      <label>Login (Utilizador Root)</label>
                      <input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} required autoFocus />
                    </div>
                    <div>
                      <label>Senha Fortificada {formUsuario.id && <span className="password-hint">(Deixe em branco para manter)</span>}</label>
                      <input type="password" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-actions gestao-usuarios-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setModalUsuario(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: modalHeaderInfo.color, borderColor: modalHeaderInfo.color, boxShadow: `0 4px 15px color-mix(in srgb, ${modalHeaderInfo.color} 40%, transparent)` }}>
                  <Save size={18}/> Salvar Credencial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}