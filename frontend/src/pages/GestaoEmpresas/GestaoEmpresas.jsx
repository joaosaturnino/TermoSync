import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, Edit, X, Save, Phone, Mail, PlusCircle, RefreshCw, 
  Search, Briefcase, ToggleLeft, ToggleRight, 
  ShieldAlert, ShieldCheck, Globe, Trash2, Calendar, Loader2, 
  CheckCircle2, AlertOctagon, DownloadCloud, Activity
} from 'lucide-react';
import './GestaoEmpresas.css';

export default function GestaoEmpresas({ api, showToast, setModalConfig }) {
  const [empresas, setEmpresas] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todas');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const formInicial = { id: '', nome: '', cnpj: '', contato: '', email: '', status: 'Ativa' };
  const [form, setForm] = useState({ ...formInicial });
  
  // Controle do Painel Lateral
  const [modalAberto, setModalAberto] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  const fecharModal = () => {
    setModalClosing(true);
    setTimeout(() => {
      setModalAberto(false);
      setModalClosing(false);
    }, 280); // Tempo da animação no CSS
  };

  // ==========================================================================
  // COMUNICAÇÃO COM API
  // ==========================================================================
  const carregarEmpresas = useCallback(async () => {
    try {
      const res = await api.get('/empresas');
      setEmpresas(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast('Falha na comunicação com o Hub de Organizações.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [api, showToast]);

  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await carregarEmpresas();
    setTimeout(() => setIsRefreshing(false), 800);
    showToast('Sincronização da malha SaaS concluída.', 'success');
  };

  // ==========================================================================
  // PROCESSAMENTO DE DADOS (FILTROS E KPIs)
  // ==========================================================================
  const empresasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return empresas.filter(e => {
      const matchBusca = e.nome?.toLowerCase().includes(termo) || e.cnpj?.toLowerCase().includes(termo);
      const matchStatus = filtroStatus === 'Todas' ? true : e.status === filtroStatus;
      return matchBusca && matchStatus;
    });
  }, [empresas, busca, filtroStatus]);

  const kpis = useMemo(() => {
    const total = empresas.length;
    const ativas = empresas.filter(e => e.status === 'Ativa').length;
    return { total, ativas, suspensas: total - ativas };
  }, [empresas]);

  // ==========================================================================
  // FUNÇÕES DE EXPORTAÇÃO E CRUD
  // ==========================================================================
  const exportarParaCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      if (empresasFiltradas.length === 0) {
        showToast('Nenhum dado disponível na grid atual.', 'warning');
        setIsExporting(false);
        return;
      }
      
      let csvContent = "ID_TENANT,RAZAO_SOCIAL,CNPJ,TELEFONE,EMAIL_CORP,STATUS_OPERACIONAL,DATA_PROVISIONAMENTO\n";
      empresasFiltradas.forEach(e => {
        const dataFormatada = e.data_cadastro ? new Date(e.data_cadastro).toLocaleDateString('pt-BR') : 'N/A';
        csvContent += `"${e.id}","${e.nome}","${e.cnpj || ''}","${e.contato || ''}","${e.email || ''}","${e.status}","${dataFormatada}"\n`;
      });

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `SaaS_Tenants_Dump_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Dump CSV extraído com sucesso.', 'success');
      setIsExporting(false);
    }, 800);
  };

  const salvarEmpresa = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (form.id) {
        await api.put(`/empresas/${form.id}`, form);
        showToast(`Tenant "${form.nome}" atualizado.`, 'success');
      } else {
        await api.post('/empresas', form);
        showToast('Novo Tenant provisionado no Cluster!', 'success');
      }
      fecharModal();
      await carregarEmpresas();
    } catch (err) {
      showToast('Erro ao gravar parâmetros no BD.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const alternarStatus = async (empresa) => {
    const novoStatus = empresa.status === 'Ativa' ? 'Suspensa' : 'Ativa';
    try {
      await api.put(`/empresas/${empresa.id}`, { ...empresa, status: novoStatus });
      showToast(`Lockdown do Tenant "${empresa.nome}" alterado para: ${novoStatus.toUpperCase()}.`, 'info');
      carregarEmpresas();
    } catch (err) {
      showToast('Erro de permissão no IAM.', 'error');
    }
  };

  const pedirExclusao = (id, nome) => {
    setModalConfig({
      isOpen: true,
      title: 'Forçar Destruição de Tenant (DROP)',
      message: `CUIDADO: A purga do tenant "${nome}" invocará a remoção em cascata (CASCADE) no banco de dados. Todas as lojas, sensores e usuários vinculados serão deletados. Confirmar?`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(`/empresas/${id}`);
          showToast('Tenant purgado da base de dados.', 'success');
          carregarEmpresas();
        } catch (e) {
          showToast('Erro restritivo (Foreign Key). Remova os nós IoT primeiro.', 'error');
        }
      }
    });
  };

  // Gera alturas aleatórias para o gráfico de fundo dos KPIs
  const renderMiniGraph = () => (
    <div className="kpi-bg-graph">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="kpi-bg-bar" style={{ height: `${Math.floor(Math.random() * 80) + 20}%` }}></div>
      ))}
    </div>
  );

  return (
    <div className="gestao-container">
      
      {/* HEADER TÁTICO */}
      <div className="gestao-header-bar">
        <div>
          <h3 className="gestao-title-modern">
            <Globe size={28} color="var(--primary)" />
            Gestão de Organizações (Tenants)
          </h3>
          <p style={{margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600'}}>
            Administração do escopo Multi-Tenant SaaS e parametrização de infraestrutura.
          </p>
        </div>
        
        <div className="gestao-toolbar">
          <div className="search-modern">
            <Search size={18} color="var(--text-muted)" style={{marginRight: '8px'}} />
            <input type="text" placeholder="Procurar Tenant ou CNPJ..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <select className="filter-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="Todas">TIPO: TODOS</option>
            <option value="Ativa">🟢 ONLINE (ATIVOS)</option>
            <option value="Suspensa">🔴 OFFLINE (LOCKDOWN)</option>
          </select>

          <button className="btn btn-outline" onClick={exportarParaCSV} disabled={isExporting} title="Extrair Dump CSV" style={{padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)'}}>
            {isExporting ? <Loader2 size={18} className="spin" color="var(--primary)" /> : <DownloadCloud size={18} />}
          </button>

          <button className="btn btn-outline" onClick={handleRefresh} title="Sincronizar Cluster" style={{padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)'}}>
            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
          </button>
          
          <button className="btn btn-primary" onClick={() => { setForm({ ...formInicial }); setModalAberto(true); }} style={{padding: '10px 20px', borderRadius: '10px', display: 'flex', gap: '8px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase'}}>
            <PlusCircle size={18} /> Provisionar
          </button>
        </div>
      </div>

      {/* KPI DASHBOARD (HUD V3) */}
      <div className="kpi-grid-modern">
        <div className="kpi-card-modern info">
          {renderMiniGraph()}
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{isLoading ? '-' : kpis.total}</span>
            <span className="kpi-label-modern">Tenants Alocados</span>
          </div>
          <div className="kpi-icon-glow"><Briefcase size={28}/></div>
        </div>
        <div className="kpi-card-modern success">
          {renderMiniGraph()}
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{isLoading ? '-' : kpis.ativas}</span>
            <span className="kpi-label-modern">Sessões OK (Online)</span>
          </div>
          <div className="kpi-icon-glow"><ShieldCheck size={28}/></div>
        </div>
        <div className="kpi-card-modern danger">
          {renderMiniGraph()}
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{isLoading ? '-' : kpis.suspensas}</span>
            <span className="kpi-label-modern">Lockdown Ativo</span>
          </div>
          <div className="kpi-icon-glow"><ShieldAlert size={28}/></div>
        </div>
      </div>

      {/* DATAGRID ENTERPRISE (FLOATING ROWS V2) */}
      <div className="table-container-modern">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Identificação do Tenant</th>
              <th>Registro Legal (DB Key)</th>
              <th>Canais de Comunicação</th>
              <th style={{ textAlign: 'center' }}>IAM & Firewall</th>
              <th style={{ textAlign: 'right' }}>Painel de Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <tr><td colSpan="5" style={{padding: '0 0 10px 0', border: 'none', background: 'transparent'}}><div className="skeleton-box"></div></td></tr>
                <tr><td colSpan="5" style={{padding: '0 0 10px 0', border: 'none', background: 'transparent'}}><div className="skeleton-box"></div></td></tr>
                <tr><td colSpan="5" style={{padding: '0 0 10px 0', border: 'none', background: 'transparent'}}><div className="skeleton-box"></div></td></tr>
              </>
            ) : empresasFiltradas.length > 0 ? (
              empresasFiltradas.map(emp => (
                <tr key={emp.id} className={emp.status === 'Suspensa' ? 'row-suspensa' : ''}>
                  <td>
                    <div className="empresa-name-box">
                      <div className="empresa-icon-wrapper"><Building2 size={20} /></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{fontSize: '0.95rem', color: 'white', fontWeight: '800'}}>{emp.nome}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', textTransform: 'uppercase' }}>
                          <Calendar size={12}/> Deploy: {emp.data_cadastro ? new Date(emp.data_cadastro).toLocaleDateString('pt-BR') : 'Data Indisponível'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="legal-info">{emp.cnpj || 'KEY: ISENTA_ESTRANGEIRA'}</span>
                  </td>
                  <td>
                    <div className="contact-box-org">
                      <div className="contact-item"><Phone size={12} color="var(--primary)"/> {emp.contato || 'Telefone offline'}</div>
                      <div className="contact-item"><Mail size={12} color="var(--primary)"/> {emp.email || 'Email offline'}</div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                     <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <span className={`badge-modern ${emp.status === 'Ativa' ? 'active' : 'suspended'}`}>
                          <span className={`status-led ${emp.status === 'Ativa' ? 'active' : 'suspended'}`}></span>
                          {emp.status}
                        </span>
                        <div className="sla-indicator">{emp.status === 'Ativa' ? '99.98% SLA' : 'SLA FAILED'}</div>
                     </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center'}}>
                      <button style={{background:'transparent', border:'none', cursor:'pointer', transition: 'transform 0.2s'}} onClick={() => alternarStatus(emp)} title="Alterar Políticas de Acesso (IAM)" onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                        {emp.status === 'Ativa' ? <ToggleRight size={32} color="var(--success)"/> : <ToggleLeft size={32} color="var(--danger)"/>}
                      </button>
                      <button className="action-btn-modern" onClick={() => { setForm(emp); setModalAberto(true); }} title="Parametrizar Organização"><Edit size={16} /></button>
                      <button className="action-btn-modern delete" onClick={() => pedirExclusao(emp.id, emp.nome)} title="Forçar DROP no Banco de Dados"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{background: 'transparent', border: 'none'}}>
                  <div style={{padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)'}}>
                    <Activity size={56} style={{opacity: 0.2}} />
                    <div>
                      <h4 style={{margin: '0 0 8px 0', color: 'white', fontSize: '1.2rem', fontWeight: '900', letterSpacing: '1px'}}>QUERY VAZIA</h4>
                      <p style={{margin: 0, fontSize: '0.85rem', fontWeight: '600'}}>O filtro ({filtroStatus}) não retornou resultados no cluster.</p>
                    </div>
                    {busca || filtroStatus !== 'Todas' ? (
                      <button className="btn btn-outline" onClick={() => { setBusca(''); setFiltroStatus('Todas'); }} style={{borderRadius: '10px', fontWeight: 'bold'}}>
                        Resetar Query de Busca
                      </button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => { setForm({ ...formInicial }); setModalAberto(true); }} style={{borderRadius: '10px', fontWeight: 'bold'}}>
                        <PlusCircle size={16} style={{marginRight: '8px'}}/> Provisionar Host
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAINEL LATERAL (SLIDE-OVER) PARA PROVISIONAMENTO/EDIÇÃO */}
      {modalAberto && (
        <>
          <div className="side-panel-overlay" onClick={fecharModal}></div>
          <div className={`side-panel-container ${modalClosing ? 'closing' : ''}`}>
            
            <div className="side-panel-header">
               <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem', fontWeight: '900', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>
                 {form.id ? <Edit size={22} color="var(--primary)"/> : <PlusCircle size={22} color="var(--primary)"/>}
                 {form.id ? 'Parametrizar Tenant' : 'Provisionar Novo Tenant'}
               </h3>
               <button style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-muted)', cursor:'pointer', padding:'6px', borderRadius: '8px', transition: '0.2s'}} onClick={fecharModal} onMouseOver={e => {e.currentTarget.style.color='white'; e.currentTarget.style.background='var(--danger)'; e.currentTarget.style.borderColor='var(--danger)';}} onMouseOut={e => {e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';}}>
                 <X size={18}/>
               </button>
            </div>
            
            <form onSubmit={salvarEmpresa} style={{display: 'flex', flexDirection: 'column', flex: 1}}>
              <div className="modern-modal-body">
                <div className="input-group-modern">
                  <label>Razão Social / Nome de Operação *</label>
                  <input type="text" className="modern-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus placeholder="Ex: TermoSync AWS S/A" />
                </div>
                
                <div className="input-group-modern">
                  <label>Identificador Fiscal (CNPJ)</label>
                  <input type="text" className="modern-input" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                </div>
                
                <div className="input-group-modern">
                  <label>Hotline (Telefone)</label>
                  <input type="text" className="modern-input" value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                
                <div className="input-group-modern">
                  <label>E-mail de Serviço (Admin)</label>
                  <input type="email" className="modern-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@host.com" />
                </div>
              </div>

              <div className="modern-modal-footer">
                <button type="button" className="btn btn-outline" style={{flex: 1, padding: '16px', borderRadius: '10px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase'}} onClick={fecharModal} disabled={isSubmitting}>Abortar</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2, padding: '16px', borderRadius: '10px', display: 'flex', gap: '10px', justifyContent: 'center', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase'}} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={20} className="spin" /> : <Save size={20} />} 
                  {isSubmitting ? 'Injetando Query...' : (form.id ? 'Commit (UPDATE)' : 'Commit (INSERT)')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}