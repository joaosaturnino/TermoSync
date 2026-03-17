import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import { Thermometer, AlertTriangle, Settings, Activity, Power, LogOut, Menu, X, CheckCircle, Edit, Download, Moon, Sun, Bell, BellOff, History, Search, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  // Autenticação e Navegação
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [somAtivo, setSomAtivo] = useState(true);

  // Dados
  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoAlertas, setHistoricoAlertas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  
  // Filtros e Pesquisa
  const [periodoRelatorio, setPeriodoRelatorio] = useState('diario');
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [setorFiltroMotores, setSetorFiltroMotores] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');

  // Formulário CRUD
  const [formEquip, setFormEquip] = useState({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
  const [equipEditando, setEquipEditando] = useState(null);

  // Custom UI States (Toasts e Modais)
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
      showToast('Login efetuado com sucesso!', 'success');
    } catch (error) {
      showToast('Utilizador ou palavra-passe incorretos.', 'error');
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
    audio.play().catch(() => console.log('Áudio bloqueado pelo navegador.'));
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
        showToast('Equipamento atualizado com sucesso!', 'success');
      } else {
        await api.post('/equipamentos', formEquip);
        showToast('Novo equipamento adicionado!', 'success');
      }
      setFormEquip({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
      setEquipEditando(null);
      carregarDados();
    } catch (error) {
      showToast('Erro ao guardar equipamento.', 'error');
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
      title: 'Confirmar Exclusão',
      message: `Tem a certeza de que deseja eliminar definitivamente o equipamento "${nome}"?`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(`/equipamentos/${id}`);
          showToast('Equipamento excluído.', 'success');
          carregarDados();
        } catch (error) {
          showToast('Erro ao excluir.', 'error');
        }
      }
    });
  };

  const pedirNotaResolucao = (id) => {
    setModalConfig({
      isOpen: true,
      title: 'Registar Resolução',
      message: 'Descreva a intervenção técnica realizada para resolver este alerta:',
      isPrompt: true,
      promptValue: '',
      onConfirm: async (nota) => {
        const notaFinal = nota.trim() === '' ? 'Sem observações' : nota;
        try {
          await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: notaFinal });
          showToast('Alerta resolvido e registado.', 'success');
          carregarDados();
        } catch (error) {
          showToast('Erro ao resolver notificação.', 'error');
        }
      }
    });
  };

  const resolverTodasNotificacoes = () => {
    setModalConfig({
      isOpen: true,
      title: 'Resolver Todos',
      message: 'Tem a certeza de que deseja marcar TODOS os alertas ativos como resolvidos pelo sistema?',
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.put(`/notificacoes/resolver-todas`);
          showToast('Todos os alertas foram limpos.', 'success');
          carregarDados();
        } catch (error) {
          showToast('Erro ao limpar alertas.', 'error');
        }
      }
    });
  };

  const exportarCSV = () => {
    const dadosFiltrados = equipamentoFiltro ? relatorios.filter(r => r.nome === equipamentoFiltro) : relatorios;
    if (dadosFiltrados.length === 0) return showToast("Nenhum dado para exportar.", "warning");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data/Hora,Equipamento,Setor,Temperatura (°C)\n";

    dadosFiltrados.forEach(rel => {
      const dataFormatada = new Date(rel.data_hora).toLocaleString().replace(',', '');
      csvContent += `${dataFormatada},${rel.nome},${rel.setor || 'Geral'},${rel.temperatura}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${periodoRelatorio}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <p>Acesso ao Sistema de Monitorização</p>
          <form onSubmit={fazerLogin}>
            <div className="login-input-group">
              <label>ID de Utilizador</label>
              <input type="text" placeholder="admin" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            </div>
            <div className="login-input-group">
              <label>Palavra-passe de Acesso</label>
              <input type="password" placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary w-100 login-btn">Entrar Seguramente</button>
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
      
      {/* TOAST DE NOTIFICAÇÃO GLOBAL */}
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : (toast.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />)}
            {toast.message}
          </div>
        </div>
      )}

      {/* MODAL GLOBAL */}
      {modalConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{modalConfig.title}</h3>
            <p>{modalConfig.message}</p>
            {modalConfig.isPrompt && (
              <input 
                type="text" 
                placeholder="Escreva aqui a intervenção..." 
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
            <Activity size={20} /> Dashboard Operacional
            {notificacoes.length > 0 && <span className="badge">{notificacoes.length}</span>}
          </button>
          <button className={`nav-item ${abaAtiva === 'motores' ? 'active' : ''}`} onClick={() => { setAbaAtiva('motores'); setMenuAberto(false); }}>
            <Power size={20} /> Painel de Motores
          </button>
          <button className={`nav-item ${abaAtiva === 'equipamentos' ? 'active' : ''}`} onClick={() => { setAbaAtiva('equipamentos'); setMenuAberto(false); }}>
            <Settings size={20} /> Gestão de Frota
          </button>
          <button className={`nav-item ${abaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('relatorios'); setMenuAberto(false); }}>
            <Thermometer size={20} /> Gráficos de Temperatura
          </button>
          <button className={`nav-item ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => { setAbaAtiva('historico'); setMenuAberto(false); }}>
            <History size={20} /> Auditoria e Histórico
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}>
          <button className="btn btn-outline w-100" style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }} onClick={fazerLogout}>
            <LogOut size={18} style={{ marginRight: '8px' }} /> Terminar Sessão
          </button>
        </div>
      </div>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      <div className="main-content">
        <header className="header">
          <button className="menu-btn" onClick={() => setMenuAberto(true)}><Menu size={24} /></button>
          <h2 className="page-title">
            {abaAtiva === 'dashboard' && 'Dashboard e Alertas'}
            {abaAtiva === 'motores' && 'Acompanhamento de Motores'}
            {abaAtiva === 'equipamentos' && 'Inventário de Equipamentos'}
            {abaAtiva === 'relatorios' && 'Monitorização Analítica'}
            {abaAtiva === 'historico' && 'Diário de Intervenções'}
          </h2>
          <div className="user-info">
            <button className="btn-icon" onClick={() => setSomAtivo(!somAtivo)} title={somAtivo ? "Silenciar Alarmes" : "Ativar Alarmes"} style={{ color: somAtivo ? 'var(--primary)' : 'var(--danger)' }}>
              {somAtivo ? <Bell size={20} /> : <BellOff size={20} />}
            </button>
            <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)} title="Alternar Tema">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <span className="status-dot"></span> <span style={{display: 'none', '@media(minWidth: 600px)': {display: 'inline'}}}>Sistema Operacional</span>
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
                  <span className="summary-title">A Operar Normalmente</span>
                  <span className="summary-value val-green">{qtdOperando}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-title">Em Ciclo de Degelo</span>
                  <span className="summary-value val-blue">{qtdDegelo}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-title">Falha Crítica (Ação Necessária)</span>
                  <span className="summary-value val-red">{qtdFalha}</span>
                </div>
              </div>

              <div className="flex-header">
                <h3>Incidentes Ativos</h3>
                {notificacoes.length > 0 && (
                  <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={resolverTodasNotificacoes}>
                    Resolver Todos os Alarmes
                  </button>
                )}
              </div>
              
              {notificacoes.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Nenhuma anomalia detetada</h3>
                  <p>Todos os equipamentos encontram-se dentro dos parâmetros estipulados.</p>
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
                        Assumir Intervenção
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
                <h3 style={{ margin: 0 }}>Vista de Planta por Setor</h3>
                <select className="select-input" value={setorFiltroMotores} onChange={(e) => setSetorFiltroMotores(e.target.value)} style={{ width: '250px' }}>
                  <option value="">Ver Toda a Loja</option>
                  <option value="Açougue">Açougue</option>
                  <option value="Padaria">Padaria</option>
                  <option value="Rotisseria">Rotisseria</option>
                  <option value="Frios">Frios</option>
                  <option value="Cooler">Cooler</option>
                  <option value="FLV">FLV</option>
                </select>
              </div>

              <div className="grid-cards">
                {equipamentosFiltradosMotores.map(eq => (
                  <div key={eq.id} className={`card ${eq.em_degelo ? 'card-info-border' : (eq.motor_ligado ? 'card-success-border' : 'card-danger-border')}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem' }}>{eq.nome}</h3>
                    </div>
                    <span className="badge-setor">{eq.setor}</span>
                    <div className={`status-box ${eq.em_degelo ? 'status-defrost' : (eq.motor_ligado ? 'status-on' : 'status-off')}`} style={{ marginTop: '15px' }}>
                      <Power size={36} />
                      <span style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '1px' }}>
                        {eq.em_degelo ? 'CICLO DE DEGELO' : (eq.motor_ligado ? 'EM OPERAÇÃO' : 'FALHA DE MOTOR')}
                      </span>
                    </div>
                  </div>
                ))}
                {equipamentosFiltradosMotores.length === 0 && (
                   <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <p>Nenhum equipamento registado neste setor.</p>
                   </div>
                )}
              </div>
            </div>
          )}

          {abaAtiva === 'equipamentos' && (
            <div className="anim-fade-in">
              <div className="card" style={{ marginBottom: '2.5rem', borderLeft: equipEditando ? '5px solid var(--warning)' : 'none' }}>
                <h3 style={{ marginBottom: '1.5rem', color: equipEditando ? 'var(--warning)' : 'var(--text-main)' }}>
                  {equipEditando ? '✏️ A Atualizar Dados do Equipamento' : 'Adicionar Novo Equipamento ao Inventário'}
                </h3>
                <form className="form-grid" onSubmit={salvarEquipamento}>
                  <div className="login-input-group">
                    <label>Identificação Única (Nome)</label>
                    <input type="text" placeholder="Ex: Ilha Central 01" value={formEquip.nome} onChange={e => setFormEquip({ ...formEquip, nome: e.target.value })} required />
                  </div>
                  
                  <div className="login-input-group">
                    <label>Modelo / Categoria</label>
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
                    <label>Setor da Loja</label>
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
                    <label>Temperatura Mínima (°C)</label>
                    <input type="number" step="0.1" placeholder="-18.0" value={formEquip.temp_min} onChange={e => setFormEquip({ ...formEquip, temp_min: e.target.value })} required />
                  </div>
                  <div className="login-input-group">
                    <label>Temperatura Máxima (°C)</label>
                    <input type="number" step="0.1" placeholder="-12.0" value={formEquip.temp_max} onChange={e => setFormEquip({ ...formEquip, temp_max: e.target.value })} required />
                  </div>
                  <div className="login-input-group">
                    <label>Intervalo de Degelo (Horas)</label>
                    <input type="number" placeholder="Ex: 6" value={formEquip.intervalo_degelo} onChange={e => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required />
                  </div>
                  <div className="login-input-group">
                    <label>Duração do Degelo (Minutos)</label>
                    <input type="number" placeholder="Ex: 30" value={formEquip.duracao_degelo} onChange={e => setFormEquip({ ...formEquip, duracao_degelo: e.target.value })} required />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', gridColumn: '1 / -1', marginTop: '1rem' }}>
                    <button type="submit" className={`btn ${equipEditando ? 'btn-warning' : 'btn-primary'}`} style={{ minWidth: '200px' }}>
                      {equipEditando ? 'Guardar Modificações' : 'Confirmar Registo'}
                    </button>
                    {equipEditando && (
                      <button type="button" className="btn btn-outline" onClick={cancelarEdicao}>Cancelar</button>
                    )}
                  </div>
                </form>
              </div>

              <div className="card table-responsive">
                <div className="flex-header">
                   <h3 style={{ margin: 0 }}>Listagem do Parque</h3>
                   <div className="search-bar">
                     <Search size={18} color="var(--text-muted)" />
                     <input 
                       type="text" 
                       placeholder="Pesquisar por nome ou setor..." 
                       value={termoPesquisa} 
                       onChange={(e) => setTermoPesquisa(e.target.value)} 
                     />
                   </div>
                </div>
                
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Identificação</th>
                      <th>Setor</th>
                      <th>Configuração Térmica</th>
                      <th>Ciclo Degelo</th>
                      <th>Ações de Gestão</th>
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
                            <button className="btn btn-outline" style={{ padding: '0.5rem' }} onClick={() => editarEquipamento(eq)} title="Editar Configurações">
                              <Edit size={16} />
                            </button>
                            <button className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => pedirExclusao(eq.id, eq.nome)} title="Remover do Sistema">
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {equipamentosFiltradosLista.length === 0 && (
                   <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum equipamento corresponde à pesquisa.</div>
                )}
              </div>
            </div>
          )}

          {abaAtiva === 'historico' && (
            <div className="anim-fade-in card table-responsive" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Livro de Registo de Manutenção</h3>
                <div className="search-bar">
                     <Search size={18} color="var(--text-muted)" />
                     <input 
                       type="text" 
                       placeholder="Procurar ocorrências..." 
                       value={termoPesquisa} 
                       onChange={(e) => setTermoPesquisa(e.target.value)} 
                     />
                </div>
              </div>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Equipamento Afetado</th>
                    <th>Localização</th>
                    <th>Relatório do Sistema</th>
                    <th>Nota do Técnico</th>
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
                    <tr><td colSpan="5" className="empty-state">Nenhum registo de intervenção encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {abaAtiva === 'relatorios' && (
            <div className="anim-fade-in">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Análise Térmica</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <select className="select-input" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)}>
                    <option value="">Visão Global (Todos)</option>
                    {equipamentos.map(eq => <option key={eq.id} value={eq.nome}>{eq.nome} ({eq.setor})</option>)}
                  </select>
                  <select className="select-input" value={periodoRelatorio} onChange={(e) => setPeriodoRelatorio(e.target.value)}>
                    <option value="diario">Últimas 24 Horas</option>
                    <option value="semanal">Últimos 7 Dias</option>
                    <option value="mensal">Últimos 30 Dias</option>
                  </select>
                  <button className="btn btn-success" onClick={exportarCSV}>
                    <Download size={18} /> Folha de Excel
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
                      <th>Ponto de Registo (Data/Hora)</th>
                      <th>Câmara / Equipamento</th>
                      <th>Leitura Térmica</th>
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