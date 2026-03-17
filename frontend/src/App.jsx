import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import { Thermometer, AlertTriangle, Settings, Activity, Power, LogOut, Menu, X, CheckCircle, Edit, Download, Moon, Sun, Bell, BellOff, History, Search, Info, Printer } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [somAtivo, setSomAtivo] = useState(true);

  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoAlertas, setHistoricoAlertas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  
  const [periodoRelatorio, setPeriodoRelatorio] = useState('diario');
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [setorFiltroMotores, setSetorFiltroMotores] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');

  const [formEquip, setFormEquip] = useState({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
  const [equipEditando, setEquipEditando] = useState(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', onConfirm: null });

  const countNotificacoesRef = useRef(0);

  const api = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    if (isDarkMode) document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
  }, [isDarkMode]);

  const fazerLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, { usuario, senha });
      setToken(res.data.token);
      localStorage.setItem('token', res.data.token);
      showToast('Acesso Autorizado.', 'success');
    } catch (error) {
      showToast('Credenciais incorretas.', 'error');
    }
  };

  const fazerLogout = () => {
    setToken('');
    localStorage.removeItem('token');
  };

  const carregarDados = async () => {
    if (!token) return;
    try {
      const [resEquip, resNotif, resHist] = await Promise.all([
        api.get('/equipamentos'),
        api.get('/notificacoes'),
        abaAtiva === 'historico' ? api.get('/notificacoes/historico') : Promise.resolve({ data: historicoAlertas })
      ]);
      
      setEquipamentos(resEquip.data);
      if (abaAtiva === 'historico') setHistoricoAlertas(resHist.data);
      
      if (somAtivo && resNotif.data.length > countNotificacoesRef.current && countNotificacoesRef.current !== 0) {
        tocarAlarme();
      }
      countNotificacoesRef.current = resNotif.data.length;
      setNotificacoes(resNotif.data);

    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) fazerLogout();
    }
  };

  const tocarAlarme = () => {
    const audio = new Audio('https://www.soundjay.com/buttons/sounds/beep-07a.mp3');
    audio.play().catch(() => console.log('Áudio bloqueado.'));
  };

  const carregarRelatorios = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/relatorios?periodo=${periodoRelatorio}`);
      setRelatorios(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const salvarEquipamento = async (e) => {
    e.preventDefault();
    try {
      if (equipEditando) {
        await api.put(`/equipamentos/${equipEditando}/edit`, formEquip);
        showToast('Configurações guardadas com sucesso!', 'success');
      } else {
        await api.post('/equipamentos', formEquip);
        showToast('Novo equipamento inserido na base de dados.', 'success');
      }
      setFormEquip({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
      setEquipEditando(null);
      carregarDados();
    } catch (error) {
      showToast('Erro ao gravar dados no servidor.', 'error');
    }
  };

  const editarEquipamento = (eq) => {
    setEquipEditando(eq.id);
    setFormEquip({
      nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max,
      intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, setor: eq.setor || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setEquipEditando(null);
    setFormEquip({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
  };

  const pedirExclusao = (id, nome) => {
    setModalConfig({
      isOpen: true,
      title: 'Aviso de Segurança',
      message: `Isto irá remover o equipamento "${nome}" e o seu histórico permanentemente. Deseja prosseguir?`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(`/equipamentos/${id}`);
          showToast('Equipamento removido do sistema.', 'success');
          carregarDados();
        } catch (error) {
          showToast('Falha ao remover.', 'error');
        }
      }
    });
  };

  const pedirNotaResolucao = (id) => {
    setModalConfig({
      isOpen: true,
      title: 'Registo de Manutenção',
      message: 'Descreva resumidamente a ação técnica que resolveu esta falha térmica:',
      isPrompt: true,
      promptValue: '',
      onConfirm: async (nota) => {
        const notaFinal = nota.trim() === '' ? 'Anomalia resolvida sem observações' : nota;
        try {
          await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: notaFinal });
          showToast('Relatório arquivado com sucesso.', 'success');
          carregarDados();
        } catch (error) {
          showToast('Erro ao processar auditoria.', 'error');
        }
      }
    });
  };

  const resolverTodasNotificacoes = () => {
    setModalConfig({
      isOpen: true,
      title: 'Ação em Massa',
      message: 'Confirma o encerramento de todos os alarmes críticos ativos no ecrã?',
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.put(`/notificacoes/resolver-todas`);
          showToast('Ação em massa executada.', 'success');
          carregarDados();
        } catch (error) {
          showToast('Falha na comunicação com servidor.', 'error');
        }
      }
    });
  };

  const exportarCSV = () => {
    const dadosFiltrados = equipamentoFiltro ? relatorios.filter(r => r.nome === equipamentoFiltro) : relatorios;
    if (dadosFiltrados.length === 0) return showToast("Filtro vazio. Não há dados para exportar.", "warning");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data/Hora,Equipamento,Setor,Temperatura (°C)\n";

    dadosFiltrados.forEach(rel => {
      const dataFormatada = new Date(rel.data_hora).toLocaleString().replace(',', '');
      csvContent += `${dataFormatada},${rel.nome},${rel.setor || 'Geral'},${rel.temperatura}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `telemetria_${periodoRelatorio}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const imprimirRelatorio = () => {
    window.print();
  };

  useEffect(() => {
    if (token) {
      carregarDados();
      const interval = setInterval(carregarDados, 5000);
      return () => clearInterval(interval);
    }
  }, [token, abaAtiva]); 

  useEffect(() => {
    if (token && abaAtiva === 'relatorios') carregarRelatorios();
  }, [token, abaAtiva, periodoRelatorio]);

  const qtdTotal = equipamentos.length;
  const qtdDegelo = equipamentos.filter(e => e.em_degelo).length;
  const qtdFalha = equipamentos.filter(e => !e.motor_ligado && !e.em_degelo).length;
  const qtdOperando = qtdTotal - qtdDegelo - qtdFalha;

  const eqPesquisaLower = termoPesquisa.toLowerCase();
  
  const equipamentosFiltradosLista = equipamentos.filter(eq => 
    eq.nome.toLowerCase().includes(eqPesquisaLower) || eq.setor.toLowerCase().includes(eqPesquisaLower)
  );

  const historicoFiltradoLista = historicoAlertas.filter(hist => 
    hist.equipamento_nome.toLowerCase().includes(eqPesquisaLower) || hist.setor.toLowerCase().includes(eqPesquisaLower)
  );

  const equipamentosFiltradosMotores = setorFiltroMotores 
    ? equipamentos.filter(eq => eq.setor === setorFiltroMotores)
    : equipamentos;

  const dadosGrafico = relatorios
    .filter(r => equipamentoFiltro === '' || r.nome === equipamentoFiltro)
    .map(r => ({
      hora: new Date(r.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temperatura: parseFloat(r.temperatura),
      nome: r.nome
    })).reverse();

  const equipamentoSelecionado = equipamentos.find(e => e.nome === equipamentoFiltro);

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>FrioMonitor</h2>
          <p>IoT Telemetry Server</p>
          <form onSubmit={fazerLogin}>
            <div className="login-input-group">
              <label>Credencial de Acesso</label>
              <input type="text" placeholder="admin" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            </div>
            <div className="login-input-group">
              <label>Palavra-passe</label>
              <input type="password" placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary w-100 login-btn">Entrar no Sistema</button>
          </form>
        </div>
        
        {toast.show && (
          <div className="toast-container">
            <div className={`toast ${toast.type}`}>
              {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              {toast.message}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
      
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : (toast.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />)}
            {toast.message}
          </div>
        </div>
      )}

      {modalConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{modalConfig.title}</h3>
            <p>{modalConfig.message}</p>
            {modalConfig.isPrompt && (
              <input 
                type="text" 
                placeholder="Insira detalhes da ação aqui..." 
                value={modalConfig.promptValue} 
                onChange={(e) => setModalConfig({...modalConfig, promptValue: e.target.value})}
                autoFocus
              />
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setModalConfig({...modalConfig, isOpen: false})}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                modalConfig.onConfirm(modalConfig.isPrompt ? modalConfig.promptValue : null);
                setModalConfig({...modalConfig, isOpen: false});
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <div className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>FrioMonitor</h2>
          <button className="mobile-close" onClick={() => setMenuAberto(false)}><X size={24} color="white" /></button>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => { setAbaAtiva('dashboard'); setMenuAberto(false); }}>
            <Activity size={20} /> Visão Global
            {notificacoes.length > 0 && <span className="badge">{notificacoes.length}</span>}
          </button>
          <button className={`nav-item ${abaAtiva === 'motores' ? 'active' : ''}`} onClick={() => { setAbaAtiva('motores'); setMenuAberto(false); }}>
            <Power size={20} /> Painel de Motores
          </button>
          <button className={`nav-item ${abaAtiva === 'equipamentos' ? 'active' : ''}`} onClick={() => { setAbaAtiva('equipamentos'); setMenuAberto(false); }}>
            <Settings size={20} /> Base de Dados
          </button>
          <button className={`nav-item ${abaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('relatorios'); setMenuAberto(false); }}>
            <Thermometer size={20} /> Gráficos de Temperatura
          </button>
          <button className={`nav-item ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => { setAbaAtiva('historico'); setMenuAberto(false); }}>
            <History size={20} /> Auditoria
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}>
          <button className="btn btn-outline w-100" style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }} onClick={fazerLogout}>
            <LogOut size={18} style={{ marginRight: '8px' }} /> Sair
          </button>
        </div>
      </div>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      <div className="main-content">
        <header className="header">
          <button className="menu-btn" onClick={() => setMenuAberto(true)}><Menu size={24} /></button>
          <h2 className="page-title">
            {abaAtiva === 'dashboard' && 'Monitorização Geral'}
            {abaAtiva === 'motores' && 'Telemetria em Tempo Real'}
            {abaAtiva === 'equipamentos' && 'Configuração de Equipamentos'}
            {abaAtiva === 'relatorios' && 'Análise de Relatórios'}
            {abaAtiva === 'historico' && 'Registo de Manutenções'}
          </h2>
          <div className="user-info">
            <button className="btn-icon" onClick={() => setSomAtivo(!somAtivo)} title={somAtivo ? "Silenciar Alarmes" : "Ativar Alarmes"} style={{ color: somAtivo ? 'var(--primary)' : 'var(--danger)' }}>
              {somAtivo ? <Bell size={20} /> : <BellOff size={20} />}
            </button>
            <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)} title="Alternar Tema">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <span className="status-dot"></span> <span className="status-text">IoT Conectado</span>
          </div>
        </header>

        <main className="content-area">
          {abaAtiva === 'dashboard' && (
            <div className="anim-fade-in">
              <div className="summary-cards">
                <div className="summary-card">
                  <span className="summary-title">Parque Total</span>
                  <span className="summary-value">{qtdTotal}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-title">Dentro dos Parâmetros</span>
                  <span className="summary-value val-green">{qtdOperando}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-title">Ciclo de Degelo</span>
                  <span className="summary-value val-blue">{qtdDegelo}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-title">Anomalias Ativas</span>
                  <span className="summary-value val-red">{qtdFalha}</span>
                </div>
              </div>

              <div className="flex-header">
                <h3>Central de Alertas Críticos</h3>
                {notificacoes.length > 0 && (
                  <div className="action-group">
                    <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={resolverTodasNotificacoes}>
                      <CheckCircle size={18}/> Limpar Falsos Alarmes
                    </button>
                  </div>
                )}
              </div>
              
              {notificacoes.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Sistema Estabilizado</h3>
                  <p>A temperatura de todos os equipamentos está sob controlo rigoroso.</p>
                </div>
              ) : (
                <div className="grid-cards">
                  {notificacoes.map(notif => (
                    <div key={notif.id} className="card card-alert">
                      <div className="card-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertTriangle size={24} color="var(--danger)" />
                          <span style={{ fontWeight: '800', fontSize: '1.1rem' }}>{notif.equipamento_nome}</span>
                        </div>
                        <span className="time-badge">{new Date(notif.data_hora).toLocaleTimeString()}</span>
                      </div>
                      <span className="badge-setor">{notif.setor}</span>
                      <p className="alert-msg">{notif.mensagem}</p>
                      <button className="btn btn-primary w-100" onClick={() => pedirNotaResolucao(notif.id)}>
                        Arquivar Resolução
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'motores' && (
            <div className="anim-fade-in">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Termómetros Digitais</h3>
                <div className="action-group">
                  <select className="select-input" value={setorFiltroMotores} onChange={(e) => setSetorFiltroMotores(e.target.value)}>
                    <option value="">Filtro: Todos os Setores</option>
                    <option value="Açougue">Açougue</option>
                    <option value="Padaria">Padaria</option>
                    <option value="Rotisseria">Rotisseria</option>
                    <option value="Frios">Frios</option>
                    <option value="Cooler">Cooler</option>
                    <option value="FLV">FLV</option>
                  </select>
                </div>
              </div>

              <div className="grid-cards">
                {equipamentosFiltradosMotores.map(eq => {
                  const isTempAlta = eq.ultima_temp > eq.temp_max && !eq.em_degelo;
                  return (
                  <div key={eq.id} className={`card ${eq.em_degelo ? 'card-info-border' : (eq.motor_ligado ? 'card-success-border' : 'card-danger-border')}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem' }}>{eq.nome}</h3>
                    </div>
                    <span className="badge-setor">{eq.setor}</span>
                    
                    <div className={`status-box ${eq.em_degelo ? 'status-defrost' : (eq.motor_ligado ? 'status-on' : 'status-off')}`} style={{ marginTop: '15px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                           <Power size={20} />
                           <span style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '1px' }}>
                             {eq.em_degelo ? 'DEGELO' : (eq.motor_ligado ? 'LIGADO' : 'PARADO')}
                           </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Limites: {eq.temp_min} a {eq.temp_max}°C</span>
                      </div>
                      
                      <div className="temp-display">
                         <span>Atual</span>
                         <h2 style={{ color: isTempAlta ? '#ffcccc' : 'white' }}>
                           {eq.ultima_temp ? `${eq.ultima_temp} °C` : '--'}
                         </h2>
                      </div>
                    </div>
                  </div>
                )})}
                {equipamentosFiltradosMotores.length === 0 && (
                   <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <p>Nenhuma máquina encontrada nos critérios selecionados.</p>
                   </div>
                )}
              </div>
            </div>
          )}

          {abaAtiva === 'equipamentos' && (
            <div className="anim-fade-in">
              <div className="card" style={{ marginBottom: '2.5rem', borderLeft: equipEditando ? '5px solid var(--warning)' : 'none' }}>
                <h3 style={{ marginBottom: '1.5rem', color: equipEditando ? 'var(--warning)' : 'var(--text-main)' }}>
                  {equipEditando ? '✏️ Alterar Configurações Técnicas' : 'Novo Equipamento'}
                </h3>
                <form className="form-grid" onSubmit={salvarEquipamento}>
                  <div className="login-input-group">
                    <label>Código / Nome</label>
                    <input type="text" placeholder="Ex: Ilha Central 01" value={formEquip.nome} onChange={e => setFormEquip({ ...formEquip, nome: e.target.value })} required />
                  </div>
                  
                  <div className="login-input-group">
                    <label>Tipo (Formato Físico)</label>
                    <select value={formEquip.tipo} onChange={e => setFormEquip({ ...formEquip, tipo: e.target.value })} required>
                      <option value="">Selecione...</option>
                      <option value="Camara Fria Resfriada">Câmara Fria Resfriada</option>
                      <option value="Camara Fria Congelados">Câmara Fria Congelados</option>
                      <option value="Balcão de Atendimento Padaria">Balcão de Atendimento Padaria</option>
                      <option value="Balcão de Atendimento Frios">Balcão de Atendimento Frios</option>
                      <option value="Balcão Auto-Atendimento Frios">Balcão Auto-Atendimento Frios</option>
                      <option value="Balcão Auto-Atendimento Fatiados">Balcão Auto-Atendimento Fatiados</option>
                      <option value="Balcão Laticinio">Balcão Laticínio</option>
                      <option value="Balcão Frutas">Balcão Frutas</option>
                      <option value="Balcão Verduras">Balcão Verduras</option>
                      <option value="Boleira">Boleira</option>
                      <option value="Balcão Auto-Atendimento Rotisseria">Balcão A.A. Rotisseria</option>
                      <option value="Balcão Margarina">Balcão Margarina</option>
                      <option value="Ilha Congelados Direita">Ilha Congelados Direita</option>
                      <option value="Ilha Congelados Esquerda">Ilha Congelados Esquerda</option>
                      <option value="Ilha Congelados Superior">Ilha Congelados Superior</option>
                      <option value="Ilha Congelados Inferior">Ilha Congelados Inferior</option>
                      <option value="Cooler">Cooler</option>
                    </select>
                  </div>
                  
                  <div className="login-input-group">
                    <label>Zona da Loja</label>
                    <select value={formEquip.setor} onChange={e => setFormEquip({ ...formEquip, setor: e.target.value })} required>
                      <option value="">Localização...</option>
                      <option value="Açougue">Açougue</option>
                      <option value="Padaria">Padaria</option>
                      <option value="Rotisseria">Rotisseria</option>
                      <option value="Frios">Frios</option>
                      <option value="Cooler">Cooler</option>
                      <option value="FLV">FLV</option>
                    </select>
                  </div>

                  <div className="login-input-group">
                    <label>Temperatura Base (°C)</label>
                    <input type="number" step="0.1" placeholder="-18.0" value={formEquip.temp_min} onChange={e => setFormEquip({ ...formEquip, temp_min: e.target.value })} required />
                  </div>
                  <div className="login-input-group">
                    <label>Limite Alarme (°C)</label>
                    <input type="number" step="0.1" placeholder="-12.0" value={formEquip.temp_max} onChange={e => setFormEquip({ ...formEquip, temp_max: e.target.value })} required />
                  </div>
                  <div className="login-input-group">
                    <label>Frequência Degelo (h)</label>
                    <input type="number" placeholder="Ex: 6" value={formEquip.intervalo_degelo} onChange={e => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required />
                  </div>
                  <div className="login-input-group">
                    <label>Tempo Ativo Degelo (m)</label>
                    <input type="number" placeholder="Ex: 30" value={formEquip.duracao_degelo} onChange={e => setFormEquip({ ...formEquip, duracao_degelo: e.target.value })} required />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', gridColumn: '1 / -1', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button type="submit" className={`btn ${equipEditando ? 'btn-warning' : 'btn-primary'}`} style={{ flex: '1 1 200px' }}>
                      {equipEditando ? 'Aplicar Definições' : 'Registar Equipamento'}
                    </button>
                    {equipEditando && (
                      <button type="button" className="btn btn-outline" onClick={cancelarEdicao} style={{ flex: '1 1 200px' }}>Cancelar</button>
                    )}
                  </div>
                </form>
              </div>

              <div className="card table-responsive">
                <div className="flex-header">
                   <h3 style={{ margin: 0 }}>Grelha do Hardware</h3>
                   <div className="search-bar">
                     <Search size={18} color="var(--text-muted)" />
                     <input type="text" placeholder="Pesquisar ID ou setor..." value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} />
                   </div>
                </div>
                
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Identificação</th>
                      <th>Setor</th>
                      <th>Limites Térmicos</th>
                      <th>Rotina Degelo</th>
                      <th>Gerir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipamentosFiltradosLista.map(eq => (
                      <tr key={eq.id}>
                        <td>
                          <span style={{
                            display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
                            backgroundColor: eq.em_degelo ? '#38bdf8' : (eq.motor_ligado ? 'var(--success)' : 'var(--danger)')
                          }} title={eq.em_degelo ? 'Em Degelo' : (eq.motor_ligado ? 'Operacional' : 'Falha')}></span>
                        </td>
                        <td><strong>{eq.nome}</strong><br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.tipo}</span></td>
                        <td><span className="badge-setor">{eq.setor}</span></td>
                        <td>{eq.temp_min}°C a {eq.temp_max}°C</td>
                        <td>A cada {eq.intervalo_degelo}h ({eq.duracao_degelo}m)</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline" style={{ padding: '0.5rem' }} onClick={() => editarEquipamento(eq)} title="Editar">
                              <Edit size={16} />
                            </button>
                            <button className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => pedirExclusao(eq.id, eq.nome)} title="Eliminar">
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {equipamentosFiltradosLista.length === 0 && (
                   <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>O equipamento não foi encontrado.</div>
                )}
              </div>
            </div>
          )}

          {abaAtiva === 'historico' && (
            <div className="anim-fade-in card table-responsive" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Registo de Ocorrências Técnicas</h3>
                <div className="search-bar">
                     <Search size={18} color="var(--text-muted)" />
                     <input type="text" placeholder="Procurar relatórios..." value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} />
                </div>
              </div>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                  <tr>
                    <th>Data Emitida</th>
                    <th>Origem (Equip.)</th>
                    <th>Zona</th>
                    <th>Diagnóstico (AI)</th>
                    <th>Fecho Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoFiltradoLista.length > 0 ? historicoFiltradoLista.map((hist) => (
                    <tr key={hist.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(hist.data_hora).toLocaleString()}</td>
                      <td style={{ fontWeight: 'bold' }}>{hist.equipamento_nome}</td>
                      <td><span className="badge-setor">{hist.setor}</span></td>
                      <td style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{hist.mensagem}</td>
                      <td style={{ color: 'var(--primary)', fontStyle: 'italic', fontWeight: '500' }}>"{hist.nota_resolucao}"</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="empty-state">As auditorias passadas não contêm registos.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {abaAtiva === 'relatorios' && (
            <div className="anim-fade-in">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Relatórios Analíticos</h3>
                <div className="action-group">
                  <select className="select-input" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)}>
                    <option value="">Panorama (Média Global)</option>
                    {equipamentos.map(eq => <option key={eq.id} value={eq.nome}>{eq.nome} ({eq.setor})</option>)}
                  </select>
                  <select className="select-input" value={periodoRelatorio} onChange={(e) => setPeriodoRelatorio(e.target.value)}>
                    <option value="diario">Janela: 24 Horas</option>
                    <option value="semanal">Janela: 7 Dias</option>
                    <option value="mensal">Janela: 30 Dias</option>
                  </select>
                  <button className="btn btn-outline" onClick={imprimirRelatorio}>
                    <Printer size={18} /> Imprimir / PDF
                  </button>
                  <button className="btn btn-success" onClick={exportarCSV}>
                    <Download size={18} /> Planilha
                  </button>
                </div>
              </div>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGrafico} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e5e7eb'} vertical={false} />
                    <XAxis dataKey="hora" stroke={isDarkMode ? '#94a3b8' : '#6b7280'} tick={{ fontSize: 12 }} tickMargin={10} />
                    <YAxis stroke={isDarkMode ? '#94a3b8' : '#6b7280'} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderColor: isDarkMode ? '#334155' : '#e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {equipamentoSelecionado && <ReferenceLine y={equipamentoSelecionado.temp_max} label={{ position: 'top', value: 'Limite Máx', fill: 'var(--danger)', fontSize: 12 }} stroke="var(--danger)" strokeDasharray="4 4" />}
                    {equipamentoSelecionado && <ReferenceLine y={equipamentoSelecionado.temp_min} label={{ position: 'bottom', value: 'Limite Mín', fill: '#38bdf8', fontSize: 12 }} stroke="#38bdf8" strokeDasharray="4 4" />}
                    <Line type="monotone" dataKey="temperatura" name="Temperatura (°C)" stroke="var(--primary)" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--primary)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card table-responsive" style={{ maxHeight: '35vh', overflowY: 'auto' }}>
                <table className="table">
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                    <tr>
                      <th>Telemetria de Tempo</th>
                      <th>Identificação</th>
                      <th>Registo (°C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosGrafico.length > 0 ? dadosGrafico.map((rel, index) => (
                      <tr key={index}>
                        <td>{rel.hora}</td>
                        <td>{rel.nome}</td>
                        <td style={{ fontWeight: '800', color: 'var(--primary)' }}>{rel.temperatura}°C</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="3" className="empty-state">Sem dados de telemetria no período especificado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}