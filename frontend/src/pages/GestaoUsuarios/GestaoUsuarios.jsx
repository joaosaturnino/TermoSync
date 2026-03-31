import React, { useState } from 'react';
import { UserPlus, Wrench, Settings, Users, Edit, X, Save } from 'lucide-react';

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
      if (formUsuario.id) { await api.put(`/usuarios/${formUsuario.id}`, payload); showToast('Credencial atualizada.', 'success'); } 
      else { if (!formUsuario.senha) return showToast('A senha é obrigatória.', 'error'); await api.post('/usuarios', payload); showToast('Nova conta registada.', 'success'); }
      setModalUsuario(false); carregarUsuarios();
    } catch (error) { showToast('Erro ao salvar (Login já existe).', 'error'); }
  };

  const pedirExclusaoUsuario = (id, nome) => {
    setModalConfig({ isOpen: true, title: 'Remover Conta', message: `Remover o acesso de "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => {
      try { await api.delete(`/usuarios/${id}`); showToast('Acesso removido.', 'success'); carregarUsuarios(); } catch (e) { showToast('Erro ao remover.', 'error'); }
    }});
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0 }}>Gestão de Acessos</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => abrirModalUsuario('GERENTE')}><UserPlus size={16} /> Novo Gerente</button>
          <button className="btn btn-info" style={{ backgroundColor: '#38bdf8', color: 'white', borderColor: '#38bdf8' }} onClick={() => abrirModalUsuario('COORDENADOR')}><UserPlus size={16} /> Novo Coordenador</button>
          <button className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={() => abrirModalUsuario('TECNICO')}><Wrench size={16} /> Novo Técnico</button>
          <button className="btn btn-outline" onClick={() => abrirModalUsuario('OUTROS')}><Settings size={16} /> Admin</button>
        </div>
      </div>

      <div className="card table-responsive" style={{ marginTop: '1.5rem' }}>
        <table className="table">
          <thead><tr><th>Credencial (Login)</th><th>Nível de Acesso</th><th>Filial / Âmbito</th><th>Ações</th></tr></thead>
          <tbody>
            {usuariosLista?.map(u => {
              let displayIdentity = 'Acesso Loja Geral'; let tipoAcessoReal = 'GERAL';
              if (u.role === 'ADMIN') { displayIdentity = ''; tipoAcessoReal = 'OUTROS'; } 
              else if (u.role === 'MANUTENCAO') { displayIdentity = `Identidade: ${u.nome_tecnico || 'Técnico Geral'}`; tipoAcessoReal = 'TECNICO'; } 
              else if (u.nome_gerente) { displayIdentity = `Identidade: Gerente (${u.nome_gerente})`; tipoAcessoReal = 'GERENTE'; } 
              else if (u.nome_coordenador) { displayIdentity = `Identidade: Coordenador (${u.nome_coordenador})`; tipoAcessoReal = 'COORDENADOR'; }
              return (
                <tr key={u.id}>
                  <td data-label="Credencial"><strong>{u.usuario}</strong><br/>{displayIdentity && <span style={{fontSize:'0.75rem', color:'gray'}}>{displayIdentity}</span>}</td>
                  <td data-label="Permissão"><span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: u.role === 'ADMIN' ? 'var(--danger)' : (u.role === 'MANUTENCAO' ? 'var(--primary)' : 'var(--info)'), color: '#fff' }}>{u.role === 'ADMIN' ? 'Admin Master' : (u.role === 'MANUTENCAO' ? 'Manutenção Global' : 'Gestor de Loja')}</span></td>
                  <td data-label="Âmbito">{u.filial}</td>
                  <td data-label="Ações">
                    <button className="btn btn-outline" style={{ padding: '0.5rem', marginRight: '5px' }} onClick={() => { setFormUsuario({ id: u.id, usuario: u.usuario, senha: '', role: u.role, filial: u.filial, tipo_acesso: tipoAcessoReal, nome_identidade: u.nome_gerente || u.nome_coordenador || u.nome_tecnico || '' }); setModalUsuario(true); }}><Edit size={16} /></button>
                    <button className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => pedirExclusaoUsuario(u.id, u.usuario)}><X size={16} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalUsuario && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ maxWidth: '450px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <Users size={22} style={{ marginRight: '10px', color: 'var(--primary)' }}/>
              <h3 style={{ margin: 0 }}>{formUsuario.id ? 'Editar Acesso' : formUsuario.tipo_acesso === 'GERENTE' ? 'Cadastrar Gerente' : formUsuario.tipo_acesso === 'COORDENADOR' ? 'Cadastrar Coordenador' : formUsuario.tipo_acesso === 'TECNICO' ? 'Cadastrar Técnico' : 'Cadastrar Acesso Admin'}</h3>
            </div>
            <form onSubmit={salvarUsuario}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                {(formUsuario.tipo_acesso === 'GERENTE' || formUsuario.tipo_acesso === 'COORDENADOR') ? (
                  <>
                    <div><label>Nome Completo do {formUsuario.tipo_acesso === 'GERENTE' ? 'Gerente' : 'Coordenador'}</label><input type="text" value={formUsuario.nome_identidade} onChange={e => setFormUsuario({...formUsuario, nome_identidade: e.target.value})} required /></div>
                    <div><label>Login (Usuário)</label><input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} required /></div>
                    <div><label>Palavra-passe {formUsuario.id && <span style={{fontSize:'0.7rem', color:'gray'}}>(Em branco manter)</span>}</label><input type="password" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} /></div>
                    <div><label>Vincular à Loja</label><select className="select-input" value={formUsuario.filial} onChange={e => setFormUsuario({...formUsuario, filial: e.target.value})} required style={{width: '100%', padding: '10px'}}><option value="">Selecione a Loja...</option>{filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  </>
                ) : formUsuario.tipo_acesso === 'TECNICO' ? (
                  <>
                    <div><label>Nome Real do Técnico</label><input type="text" value={formUsuario.nome_identidade} onChange={e => setFormUsuario({...formUsuario, nome_identidade: e.target.value})} required /></div>
                    <div><label>Login (Usuário)</label><input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} required /></div>
                    <div><label>Palavra-passe {formUsuario.id && <span style={{fontSize:'0.7rem', color:'gray'}}>(Em branco manter)</span>}</label><input type="password" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} /></div>
                    <div style={{ padding: '10px', backgroundColor: 'rgba(5, 150, 105, 0.1)', borderRadius: '8px' }}><span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Técnicos têm acesso global a todas as lojas.</span></div>
                  </>
                ) : (
                  <>
                    <div><label>Nível de Permissão</label><select className="select-input" style={{width: '100%', padding: '10px'}} value={formUsuario.role} onChange={(e) => setFormUsuario({...formUsuario, role: e.target.value})} required disabled={!!formUsuario.id}><option value="ADMIN">Administrador (Master)</option></select></div>
                    <div><label>Login (Usuário)</label><input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} required /></div>
                    <div><label>Palavra-passe {formUsuario.id && <span style={{fontSize:'0.7rem', color:'gray'}}>(Em branco manter)</span>}</label><input type="password" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} /></div>
                  </>
                )}
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}><button type="button" className="btn btn-outline" onClick={() => setModalUsuario(false)}>Cancelar</button><button type="submit" className="btn btn-primary"><Save size={18}/> Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}