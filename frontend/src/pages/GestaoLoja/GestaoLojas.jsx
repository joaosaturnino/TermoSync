import React, { useState } from 'react';
import { Store, Edit, X, Save } from 'lucide-react';

export default function GestaoLojas({ api, showToast, lojasCadastradas, carregarLojas, carregarDadosBase, setModalConfig }) {
  const formInicialLoja = { id: '', nome: '', endereco_loja: '', telefone_loja: '', senha: '', usuario_loja: '', nome_gerente: '', usuario_gerente: '', nome_coordenador: '', usuario_coordenador: '' };
  const [formLoja, setFormLoja] = useState({ ...formInicialLoja });
  const [modalLoja, setModalLoja] = useState(false);

  const salvarLoja = async (e) => {
    e.preventDefault();
    try {
      if (formLoja.id) { await api.put(`/lojas/${formLoja.id}`, { nome: formLoja.nome, endereco_loja: formLoja.endereco_loja, telefone_loja: formLoja.telefone_loja }); showToast('Loja atualizada!', 'success'); } 
      else { if (!formLoja.nome) return showToast('Nome obrigatório.', 'error'); await api.post('/lojas', { nome: formLoja.nome, endereco_loja: formLoja.endereco_loja, telefone_loja: formLoja.telefone_loja }); showToast('Loja cadastrada com sucesso!', 'success'); }
      setModalLoja(false); carregarLojas(); carregarDadosBase(); 
    } catch(err) { showToast('Erro. Verifique se o nome já existe.', 'error'); }
  };

  const pedirExclusaoLoja = (id, nome) => {
    setModalConfig({ isOpen: true, title: 'Remover Loja', message: `Remover a "${nome}" permanentemente? TODOS os utilizadores e equipamentos desta loja serão apagados.`, isPrompt: false, onConfirm: async () => {
      try { await api.delete(`/lojas/${id}`); showToast('Loja removida.', 'success'); carregarLojas(); carregarDadosBase(); } catch (e) { showToast('Erro ao remover.', 'error'); }
    }});
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header"><h3 style={{ margin: 0 }}>Informações e Cadastro de Lojas</h3><button className="btn btn-primary" onClick={() => { setFormLoja({...formInicialLoja}); setModalLoja(true); }}><Store size={18} /> Nova Loja</button></div>
      <div className="card table-responsive" style={{ marginTop: '1.5rem' }}>
        <table className="table">
          <thead><tr><th>Loja / Filial</th><th>Gerente e Coordenador</th><th>Endereço e Contato</th><th>Ações</th></tr></thead>
          <tbody>
            {lojasCadastradas?.map(l => (
              <tr key={l.id}>
                <td data-label="Loja"><strong>{l.nome}</strong></td>
                <td data-label="Gestão"><span style={{fontSize: '0.8rem', color: 'var(--primary)'}}><strong>G:</strong> {l.nome_gerente || 'Não definido'}</span><br/><span style={{fontSize: '0.8rem', color: 'var(--info)'}}><strong>C:</strong> {l.nome_coordenador || 'Não definido'}</span></td>
                <td data-label="Contato"><span style={{fontSize: '0.85rem'}}>{l.endereco || '-'}</span><br/><span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{l.telefone || '-'}</span></td>
                <td data-label="Ações">
                  <button className="btn btn-outline" style={{ padding: '0.5rem', marginRight: '5px' }} onClick={() => { setFormLoja({ id: l.id, nome: l.nome, endereco_loja: l.endereco || '', telefone_loja: l.telefone || '' }); setModalLoja(true); }}><Edit size={16} /></button>
                  <button className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => pedirExclusaoLoja(l.id, l.nome)}><X size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalLoja && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <h3><Store size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> {formLoja.id ? 'Editar Loja' : 'Cadastrar Nova Loja'}</h3>
            <form onSubmit={salvarLoja}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div><label>Nome da Loja / Filial</label><input type="text" value={formLoja.nome} onChange={(e) => setFormLoja({...formLoja, nome: e.target.value})} required /></div>
                <div><label>Endereço Completo</label><input type="text" value={formLoja.endereco_loja} onChange={(e) => setFormLoja({...formLoja, endereco_loja: e.target.value})} /></div>
                <div><label>Telefone Comercial</label><input type="text" value={formLoja.telefone_loja} onChange={(e) => setFormLoja({...formLoja, telefone_loja: e.target.value})} /></div>
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}><button type="button" className="btn btn-outline" onClick={() => setModalLoja(false)}>Cancelar</button><button type="submit" className="btn btn-primary"><Save size={18}/> Salvar Loja</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}