import React, { useState } from 'react';
import { Store, Edit, X, Save, MapPin, Phone, UserCheck, Users, Building2 } from 'lucide-react';
import './GestaoLojas.css';

export default function GestaoLojas({ api, showToast, lojasCadastradas, carregarLojas, carregarDadosBase, setModalConfig }) {
  const formInicialLoja = { id: '', nome: '', endereco_loja: '', telefone_loja: '', senha: '', usuario_loja: '', nome_gerente: '', usuario_gerente: '', nome_coordenador: '', usuario_coordenador: '' };
  const [formLoja, setFormLoja] = useState({ ...formInicialLoja });
  const [modalLoja, setModalLoja] = useState(false);

  const salvarLoja = async (e) => {
    e.preventDefault();
    try {
      if (formLoja.id) { 
        await api.put(`/lojas/${formLoja.id}`, { nome: formLoja.nome, endereco_loja: formLoja.endereco_loja, telefone_loja: formLoja.telefone_loja }); 
        showToast('Loja atualizada com sucesso!', 'success'); 
      } else { 
        if (!formLoja.nome) return showToast('Nome obrigatório.', 'error'); 
        await api.post('/lojas', { nome: formLoja.nome, endereco_loja: formLoja.endereco_loja, telefone_loja: formLoja.telefone_loja }); 
        showToast('Nova loja cadastrada no sistema!', 'success'); 
      }
      setModalLoja(false); 
      carregarLojas(); 
      carregarDadosBase(); 
    } catch(err) { 
      showToast('Erro. Verifique se a loja já existe.', 'error'); 
    }
  };

  const pedirExclusaoLoja = (id, nome) => {
    setModalConfig({ 
      isOpen: true, 
      title: 'Remover Loja do Sistema', 
      message: `Remover a loja "${nome}" permanentemente? ATENÇÃO: Todos os equipamentos e acessos associados a esta loja serão apagados.`, 
      isPrompt: false, 
      onConfirm: async () => {
        try { 
          await api.delete(`/lojas/${id}`); 
          showToast('Loja removida.', 'success'); 
          carregarLojas(); 
          carregarDadosBase(); 
        } catch (e) { 
          showToast('Erro ao remover a loja.', 'error'); 
        }
      }
    });
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 className="gestao-lojas-title">Informações e Cadastro de Lojas</h3>
        <button className="btn btn-primary" onClick={() => { setFormLoja({...formInicialLoja}); setModalLoja(true); }}>
          <Store size={18} /> Cadastrar Nova Loja
        </button>
      </div>

      {!lojasCadastradas || lojasCadastradas.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <Building2 size={64} color="var(--primary)" style={{ marginBottom: '1rem', opacity: 0.8 }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Nenhuma Loja Registada</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Comece por adicionar a primeira filial ao sistema TermoSync.</p>
        </div>
      ) : (
        <div className="card table-responsive gestao-lojas-card">
          <table className="table">
            <thead>
              <tr>
                <th>Identificação da Loja</th>
                <th>Equipe de Liderança</th>
                <th>Localização e Contato</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lojasCadastradas.map(l => (
                <tr key={l.id}>
                  <td data-label="Loja">
                    <div className="loja-name-box">
                      <div className="loja-icon-wrapper">
                        <Building2 size={18} />
                      </div>
                      {l.nome}
                    </div>
                  </td>
                  
                  <td data-label="Gestão">
                    <div className="leadership-box">
                      {l.nome_gerente ? (
                        <span className="leader-badge manager" title="Gerente da Loja"><UserCheck size={14}/> {l.nome_gerente}</span>
                      ) : (
                        <span className="leader-badge missing"><UserCheck size={14}/> Sem Gerente</span>
                      )}
                      
                      {l.nome_coordenador ? (
                        <span className="leader-badge coordinator" title="Coordenador da Loja"><Users size={14}/> {l.nome_coordenador}</span>
                      ) : (
                        <span className="leader-badge missing"><Users size={14}/> Sem Coordenador</span>
                      )}
                    </div>
                  </td>
                  
                  <td data-label="Contato">
                    <div className="contact-box">
                      <div className="contact-line">
                        <MapPin size={14} /> {l.endereco || 'Endereço não preenchido'}
                      </div>
                      <div className="contact-line">
                        <Phone size={14} /> {l.telefone || 'Telefone não preenchido'}
                      </div>
                    </div>
                  </td>
                  
                  <td data-label="Ações">
                    <button 
                      className="btn btn-action edit" 
                      title="Editar Loja"
                      onClick={() => { setFormLoja({ id: l.id, nome: l.nome, endereco_loja: l.endereco || '', telefone_loja: l.telefone || '' }); setModalLoja(true); }}
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      className="btn btn-action delete" 
                      title="Apagar Loja"
                      onClick={() => pedirExclusaoLoja(l.id, l.nome)}
                    >
                      <X size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalLoja && (
        <div className="modal-overlay gestao-lojas-modal">
          <div className="modal-content gestao-lojas-modal-content">
            <h3>
              <Store size={22} style={{ color: 'var(--primary)', marginRight: '8px', verticalAlign: 'middle' }}/> 
              {formLoja.id ? 'Atualizar Dados da Loja' : 'Registar Nova Filial'}
            </h3>
            
            <form onSubmit={salvarLoja} style={{ marginTop: '1.5rem' }}>
              <div className="form-grid gestao-lojas-form-grid">
                <div>
                  <label>Nome Comercial da Filial</label>
                  <input type="text" value={formLoja.nome} onChange={(e) => setFormLoja({...formLoja, nome: e.target.value})} placeholder="Ex: Supermercado Central" required autoFocus />
                </div>
                <div>
                  <label>Endereço Completo</label>
                  <input type="text" value={formLoja.endereco_loja} onChange={(e) => setFormLoja({...formLoja, endereco_loja: e.target.value})} placeholder="Rua, Número" />
                </div>
                <div>
                  <label>Contato Telefônico Direto</label>
                  <input type="text" value={formLoja.telefone_loja} onChange={(e) => setFormLoja({...formLoja, telefone_loja: e.target.value})} placeholder="Ex: 210 000 000" />
                </div>
              </div>
              <div className="modal-actions gestao-lojas-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setModalLoja(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ boxShadow: '0 4px 15px rgba(5, 150, 105, 0.3)' }}>
                  <Save size={18}/> Cadastrar Filial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}