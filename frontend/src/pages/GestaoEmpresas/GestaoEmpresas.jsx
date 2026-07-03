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
  
  const [modalAberto, setModalAberto] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  // --- NOVA FUNÇÃO: MÁSCARA DE CNPJ AUTOMÁTICA ---
  const maskCNPJ = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  const fecharModal = () => {
    setModalClosing(true);
    setTimeout(() => { setModalAberto(false); setModalClosing(false); setForm({ ...formInicial }); }, 300);
  };

  const carregarEmpresas = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await api.get('/empresas');
      setEmpresas(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast('Falha na comunicação com o Core SaaS.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api, showToast]);

  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  const salvarEmpresa = async (e) => {
    e.preventDefault();
    if (!form.nome) return showToast('A designação da empresa é obrigatória.', 'error');
    
    setIsSubmitting(true);
    try {
      if (form.id) {
        await api.put(`/empresas/${form.id}`, form);
        showToast(`Tenant ${form.nome} atualizado.`, 'success');
      } else {
        await api.post('/empresas', form);
        showToast(`Tenant ${form.nome} provisionado no sistema.`, 'success');
      }
      fecharModal();
      carregarEmpresas(true);
    } catch (e) {
      showToast('Erro ao alocar o Tenant na base de dados.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const empresasFiltradas = useMemo(() => {
    return empresas.filter(emp => {
      const matchBusca = emp.nome.toLowerCase().includes(busca.toLowerCase()) || 
                         (emp.cnpj && emp.cnpj.includes(busca)) || 
                         (emp.email && emp.email.toLowerCase().includes(busca.toLowerCase()));
      const matchStatus = filtroStatus === 'Todas' || emp.status === filtroStatus;
      return matchBusca && matchStatus;
    });
  }, [empresas, busca, filtroStatus]);

  const kpis = useMemo(() => {
    return {
      total: empresas.length,
      ativas: empresas.filter(e => e.status === 'Ativa').length,
      bloqueadas: empresas.filter(e => e.status === 'Bloqueada').length
    };
  }, [empresas]);

  // --- NOVA FUNÇÃO: EXPORTAR PARA CSV ---
  const exportarEmpresasCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      if (empresasFiltradas.length === 0) {
        showToast('Não há dados para exportar.', 'warning');
        setIsExporting(false);
        return;
      }
      let csvContent = "ID,Organizacao,CNPJ,Contato,Email,Status\n";
      empresasFiltradas.forEach(emp => {
        csvContent += `"${emp.id}","${emp.nome}","${emp.cnpj || ''}","${emp.contato || ''}","${emp.email || ''}","${emp.status}"\n`;
      });
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Audit_Tenants_TermoSync_${Date.now()}.csv`;
      link.click();
      showToast('Auditoria exportada com sucesso.', 'success');
      setIsExporting(false);
    }, 800);
  };

  return (
    <div className="gestao-container anim-fade-in">
      <div className="gestao-header-bar stagger-1">
        <div className="gestao-header-copy">
          <div className="icon-box-primary">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="gestao-title-modern">Gestão de Organizações</h2>
            <p className="gestao-subtitle">Provisionamento, status e comunicação das organizações do ecossistema multi-tenant.</p>
          </div>
        </div>

        <div className="gestao-toolbar">
          <button className="btn btn-outline" onClick={() => carregarEmpresas(true)} disabled={isRefreshing} title="Sincronizar tenants">
            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
          </button>
          <button className="btn btn-outline" onClick={exportarEmpresasCSV} disabled={isExporting} title="Exportar para CSV">
            {isExporting ? <Loader2 size={18} className="spin" /> : <DownloadCloud size={18} />}
            <span className="desktop-only-inline" style={{ marginLeft: '8px' }}>Exportar</span>
          </button>
          <button className="btn btn-primary" onClick={() => { setForm({ ...formInicial }); setModalAberto(true); }}>
            <PlusCircle size={18} style={{ marginRight: '8px' }} /> Nova Organização
          </button>
        </div>
      </div>

      <div className="kpi-grid-modern stagger-2">
        <div className="kpi-card-modern info">
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.total}</span>
            <span className="kpi-label-modern">Tenants registrados</span>
          </div>
          <div className="kpi-bg-graph">
            {[34, 62, 41, 76, 58].map((height, index) => <div key={index} className="kpi-bg-bar" style={{ height: `${height}%` }} />)}
          </div>
        </div>
        <div className="kpi-card-modern success">
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.ativas}</span>
            <span className="kpi-label-modern">Organizações ativas</span>
          </div>
          <div className="kpi-bg-graph">
            {[28, 52, 68, 81, 74].map((height, index) => <div key={index} className="kpi-bg-bar" style={{ height: `${height}%` }} />)}
          </div>
        </div>
        <div className="kpi-card-modern danger">
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.bloqueadas}</span>
            <span className="kpi-label-modern">Acessos bloqueados</span>
          </div>
          <div className="kpi-bg-graph">
            {[18, 24, 16, 22, 20].map((height, index) => <div key={index} className="kpi-bg-bar" style={{ height: `${height}%` }} />)}
          </div>
        </div>
      </div>

      <div className="gestao-toolbar filters-bar stagger-3">
        <div className="search-modern">
          <Search size={18} color="var(--text-muted)" />
          <input type="text" placeholder="Localizar pelo nome, CNPJ ou e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className="filter-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="Todas">Todas</option>
          <option value="Ativa">Ativas</option>
          <option value="Bloqueada">Bloqueadas</option>
        </select>
      </div>

      <div className="tenant-grid-modern stagger-4">
        {isLoading ? (
          <div className="gestao-empty-state">
            <Loader2 size={48} className="spin" color="var(--primary)" />
            <p>Sincronizando as partições da base de dados...</p>
          </div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="gestao-empty-state">
            <Globe size={64} style={{ opacity: 0.2 }} />
            <p>Nenhuma organização encontrada para os critérios atuais.</p>
          </div>
        ) : (
          empresasFiltradas.map((emp) => (
            <article key={emp.id} className={`tenant-card-modern ${emp.status === 'Bloqueada' ? 'blocked' : ''}`}>
              <div className="tenant-card-head">
                <div className="tenant-logo">
                  {emp.status === 'Ativa' ? <Activity size={20} color="var(--success)" /> : <ShieldAlert size={20} color="var(--danger)" />}
                </div>
                <div className="tenant-card-title">
                  <h3>{emp.nome}</h3>
                  <span className={`tenant-badge ${emp.status === 'Ativa' ? 'success' : 'danger'}`}>
                    {emp.status.toUpperCase()}
                  </span>
                </div>
                <button className="btn-icon" onClick={() => { setForm(emp); setModalAberto(true); }} title="Editar organização">
                  <Edit size={18} />
                </button>
              </div>

              <div className="tenant-card-body">
                <div className="tenant-info-row" title="Registro legal">
                  <Briefcase size={14} />
                  <span>{emp.cnpj || 'Sem registro CNPJ'}</span>
                </div>
                <div className="tenant-info-row" title="Telefone de contato">
                  <Phone size={14} />
                  <span>{emp.contato || 'Sem contato'}</span>
                </div>
                <div className="tenant-info-row" title="E-mail de serviço">
                  <Mail size={14} />
                  <span>{emp.email || 'Sem e-mail'}</span>
                </div>
              </div>

              <div className="tenant-card-footer">
                <span className="tenant-id">ID: {String(emp.id).padStart(4, '0')}</span>
              </div>
            </article>
          ))
        )}
      </div>

      {modalAberto && (
        <div className="side-panel-overlay" onClick={fecharModal}>
          <div className={`side-panel-container ${modalClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="side-panel-header">
              <h3 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'white'}}><Building2 size={24} color="var(--primary)"/> {form.id ? 'Atualizar Organização' : 'Novo Provisionamento'}</h3>
              <button className="btn-icon" onClick={fecharModal}><X size={24} /></button>
            </div>
            
            <form onSubmit={salvarEmpresa} className="modern-modal-body">
              <div className="form-group-card">
                <h4 style={{color: 'var(--primary)', marginBottom: '15px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Identidade Corporativa</h4>
                
                <div className="input-group-modern">
                  <label>Organização (Tenant Name) *</label>
                  <input type="text" className="modern-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Supermercados Alpha" required autoFocus />
                </div>
                
                <div className="input-group-modern">
                  <label>CNPJ (Identificação Legal)</label>
                  <input 
                    type="text" 
                    className="modern-input" 
                    value={form.cnpj} 
                    onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} 
                    placeholder="00.000.000/0000-00" 
                    maxLength="18"
                  />
                </div>

                <div className="input-group-modern">
                  <label>Status Operacional</label>
                  <div className="status-toggle-wrapper" onClick={() => setForm({ ...form, status: form.status === 'Ativa' ? 'Bloqueada' : 'Ativa' })}>
                    {form.status === 'Ativa' ? <ToggleRight size={36} color="var(--success)" /> : <ToggleLeft size={36} color="var(--danger)" />}
                    <span style={{ fontWeight: 'bold', color: form.status === 'Ativa' ? 'var(--success)' : 'var(--danger)' }}>
                      {form.status === 'Ativa' ? 'CONTRATO ATIVO' : 'SISTEMA SUSPENSO'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-group-card">
                <h4 style={{color: 'var(--secondary)', marginBottom: '15px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Canais de Comunicação</h4>
                
                <div className="input-group-modern">
                  <label>Contato de Emergência (Telefone)</label>
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
                  {isSubmitting ? 'Injetando Query...' : (form.id ? 'Commit (UPDATE)' : 'Provisionar (INSERT)')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}