import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Store, Edit, X, Save, MapPin, Phone, UserCheck, Users, 
  RefreshCw, Search, ShieldAlert, PlusCircle, 
  Briefcase, ToggleLeft, ToggleRight, Building2, CheckCircle2, AlertCircle
} from 'lucide-react';
import './GestaoLojas.css';

export default function GestaoLojas({ api, showToast, setModalConfig, carregarDadosBase }) {
  
  // PROTEÇÃO: Só o DEV tem permissão para ver Tenants Multi-Empresa e Alterar Status do Sistema
  const role = sessionStorage.getItem('userRole') || 'LOJA';

  const [lojasLocais, setLojasLocais] = useState([]);
  const [empresasDb, setEmpresasDb] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [buscaLoja, setBuscaLoja] = useState('');
  
  const formInicialLoja = { id: '', nome: '', endereco_loja: '', telefone_loja: '', empresa: '', status: 'Ativa' };
  const [formLoja, setFormLoja] = useState({ ...formInicialLoja });
  const [modalLoja, setModalLoja] = useState(false);

  // Busca a Tabela de Lojas do Servidor
  const buscarLojasServidor = useCallback(async () => {
    try {
      const res = await api.get('/lojas');
      setLojasLocais(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Erro ao buscar lojas:", error);
      showToast('Aviso: Falha ao carregar a lista de filiais.', 'error');
    }
  }, [api, showToast]);

  // Se o usuário for DEV, busca a Tabela de Empresas
  const buscarEmpresas = useCallback(async () => {
    if (role !== 'DEV') return;
    try {
      const res = await api.get('/empresas');
      setEmpresasDb(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Erro ao buscar clientes/empresas", error);
    }
  }, [api, role]);

  useEffect(() => {
    buscarLojasServidor();
    buscarEmpresas();
  }, [buscarLojasServidor, buscarEmpresas]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await buscarLojasServidor();
    if (role === 'DEV') await buscarEmpresas();
    if (typeof carregarDadosBase === 'function') await carregarDadosBase();
    setTimeout(() => setIsRefreshing(false), 600);
    showToast('Lista de lojas atualizada.', 'success');
  };

  const lojasFiltradas = useMemo(() => {
    if (!buscaLoja.trim()) return lojasLocais;
    const termo = buscaLoja.toLowerCase().trim();
    return lojasLocais.filter(l =>
      (l?.nome && l.nome.toLowerCase().includes(termo)) ||
      (l?.endereco && l.endereco.toLowerCase().includes(termo)) ||
      (l?.id && String(l.id).includes(termo))
    );
  }, [lojasLocais, buscaLoja]);

  const kpis = useMemo(() => {
    let ativas = 0; let suspensas = 0; let risco = 0;
    lojasLocais.forEach(l => {
      if (l.status === 'Suspensa') suspensas++;
      else ativas++;
      
      // Sem gerente = Superfície de Risco Comercial
      if (!l.nome_gerente || l.nome_gerente.trim() === '') risco++;
    });
    return { total: lojasLocais.length, ativas, suspensas, risco };
  }, [lojasLocais]);

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
    <div className="anim-fade-in stagger-1">
      
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
          <button className="btn-provision sync" onClick={handleRefresh} title="Atualizar dados">
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> Atualizar Lista
          </button>
          <button className="btn-provision add" onClick={() => { setFormLoja({ ...formInicialLoja }); setModalLoja(true); }}>
            <PlusCircle size={16} /> Cadastrar Nova Loja
          </button>
        </div>
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
              <span className="kpi-lbl">Lojas Suspensas</span>
            </div>
          )}
          
          <div className={`kpi-item-small ${kpis.risco > 0 ? 'warning' : 'success'}`} title="Filiais que ainda não possuem um Gerente cadastrado.">
            <span className="kpi-val">{kpis.risco}</span>
            <span className="kpi-lbl">Lojas sem Gestor</span>
          </div>
        </div>

        <div className="search-box">
          <Search size={18} color="#94a3b8" />
          <input type="text" placeholder="Buscar loja por nome, endereço ou ID..." value={buscaLoja} onChange={e => setBuscaLoja(e.target.value)} />
        </div>
      </div>

      {/* TABELA DE LOJAS */}
      <div className="table-card stagger-3">
        {lojasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
            <Store size={56} style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
            <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>Nenhuma Loja Cadastrada</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>O sistema não possui filiais registradas. Clique em "Cadastrar Nova Loja".</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Identificação da Loja</th>
                  {role === 'DEV' && <th>Empresa / Cliente</th>}
                  <th>Equipe de Gestão</th>
                  <th>Localização & Contato</th>
                  <th style={{ textAlign: 'center' }}>Status no Sistema</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lojasFiltradas.map(l => {
                  const isSuspensa = l.status === 'Suspensa';
                  
                  return (
                    <tr key={l?.id || Math.random()} className={`table-row ${isSuspensa ? 'row-suspensa' : 'ativo'}`}>
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

                      <td data-label="Localização & Contato">
                        <div className="contact-box">
                          <div className="contact-line"><MapPin size={16} /> {l?.endereco || 'Endereço não cadastrado'}</div>
                          <div className="contact-line"><Phone size={16} /> {l?.telefone || 'Telefone não cadastrado'}</div>
                        </div>
                      </td>

                      <td data-label="Status no Sistema" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <div className="status-badge-network" style={{ color: isSuspensa ? '#ef4444' : '#10b981' }}>
                            <div className={`status-dot ${isSuspensa ? 'offline' : 'online'}`}></div>
                            {isSuspensa ? 'Suspensa' : 'Operante'}
                          </div>
                          
                          {/* Botão de Suspensão exclusivo para o DEV */}
                          {role === 'DEV' && (
                            <button className="btn-toggle-status" onClick={() => alternarStatusLoja(l)} title="Ativar/Suspender Loja" style={{ width: 'auto' }}>
                              {isSuspensa ? <ToggleLeft size={28} color="#ef4444"/> : <ToggleRight size={28} color="#10b981"/>}
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
                <span style={{ color: '#10b981', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                      <label style={{ color: '#10b981' }}>Vincular a uma Empresa / Cliente</label>
                      <select style={{ border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }} value={formLoja.empresa} onChange={(e) => setFormLoja({...formLoja, empresa: e.target.value})} required>
                        <option value="">Selecione o Cliente...</option>
                        {empresasDb.map(emp => <option key={emp.id} value={emp.nome}>{emp.nome}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label>Nome Comercial da Loja / Filial</label>
                    <input type="text" value={formLoja.nome} onChange={(e) => setFormLoja({ ...formLoja, nome: e.target.value })} placeholder="Ex: Supermercado Centro - SP" required autoFocus />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
                <button type="submit" className="btn" style={{ backgroundColor: '#10b981', color: '#020617', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
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