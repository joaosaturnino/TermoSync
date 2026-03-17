/**
 * Componente Raiz: App FrioMonitor
 * Gere a interface gráfica corporativa, autenticação, conexão PWA e a camada
 * de comunicação via WebSockets e chamadas REST API via Axios.
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './App.css';
import { 
  Thermometer, AlertTriangle, Settings, Activity, Power, LogOut, Menu, X, 
  CheckCircle, Edit, Download, Moon, Sun, Bell, BellOff, History, Search, 
  Info, FileText, PlusCircle, Save, WifiOff, List, Maximize, Minimize, 
  Calendar, ShieldCheck 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, Brush, PieChart, Pie, Cell 
} from 'recharts'; 

const API_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

/**
 * Logótipo Vetorial da FrioMonitor
 */
const FrioMonitorLogo = ({ size = 40, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M10 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 13.5v-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 9a5 5 0 0 1 5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 5a9 9 0 0 1 9 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function App() {
  /* --- ESTADOS DE AUTENTICAÇÃO E NAVEGAÇÃO --- */
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);

  /* --- ESTADOS DA INTERFACE --- */
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [somAtivoState, setSomAtivoState] = useState(true);
  const somAtivoRef = useRef(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [latencia, setLatencia] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  /* --- ESTADOS DE DADOS (CACHE) --- */
  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoAlertas, setHistoricoAlertas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);

  /* --- ESTADOS DE FORMULÁRIOS E FILTROS --- */
  const [dataInicio, setDataInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 1)));
  const [dataFim, setDataFim] = useState(new Date());
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [setorFiltroMotores, setSetorFiltroMotores] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [mostrarTabelaBruta, setMostrarTabelaBruta] = useState(false);
  
  const [formEquip, setFormEquip] = useState({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
  const [formEditEquip, setFormEditEquip] = useState({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
  const [equipEditando, setEquipEditando] = useState(null);

  /* --- ESTADOS DE NOTIFICAÇÃO DO USUÁRIO --- */
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', onConfirm: null });

  // Referência para evitar múltiplos alertas para o mesmo evento
  const lastAlertIdRef = useRef(-1);

  // Cliente Axios configurado
  const api = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  /**
   * Sincroniza o ref state do alarme para acesso assíncrono.
   */
  const setSomAtivo = (val) => {
    setSomAtivoState(val);
    somAtivoRef.current = val;
  };

  /**
   * Exibe mensagens "Toast" na tela.
   */
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
  };

  /**
   * Alterna a exibição em Ecrã Inteiro (Modo TV).
   */
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        showToast('Erro ao tentar entrar em ecrã inteiro.', 'error');
      });
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  // Observador de Ecrã Inteiro Nativo
  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  // Observador de Tema Escuro
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Observador de Conectividade de Rede
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Conexão restabelecida. A sincronizar dados...', 'success');
      carregarDadosBase();
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Conexão perdida. A operar em Modo Offline Seguro.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /* =========================================
     MÉTODOS DE AÇÃO GERAIS
     ========================================= */

  const fazerLogin = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast('Necessita de internet para iniciar sessão.', 'error');
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

  const tocarAlarme = () => {
    const audioEl = document.getElementById('alerta-audio');
    if (audioEl) {
      audioEl.currentTime = 0;
      let playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => console.log('Interaja com a página primeiro para ouvir áudio.'));
      }
      
      // Bipe duplo para chamar a atenção
      setTimeout(() => {
        audioEl.currentTime = 0;
        let playPromise2 = audioEl.play();
        if (playPromise2 !== undefined) { 
          playPromise2.catch(() => {}); 
        }
      }, 500);
    }
  };

  /**
   * Requisita o panorama global de hardware, alertas e histórico.
   * Em caso de ausência de rede, consome o `localStorage`.
   */
  const carregarDadosBase = async () => {
    if (!token) return;
    
    if (isOffline) {
      const cacheEquip = localStorage.getItem('cache_equipamentos');
      const cacheNotif = localStorage.getItem('cache_notificacoes');
      const cacheHist = localStorage.getItem('cache_historico');
      
      if (cacheEquip) setEquipamentos(JSON.parse(cacheEquip));
      if (cacheNotif) setNotificacoes(JSON.parse(cacheNotif));
      if (cacheHist && abaAtiva === 'historico') setHistoricoAlertas(JSON.parse(cacheHist));
      return;
    }

    try {
      const [resEquip, resNotif, resHist] = await Promise.all([
        api.get('/equipamentos'),
        api.get('/notificacoes'),
        abaAtiva === 'historico' ? api.get('/notificacoes/historico') : Promise.resolve({ data: historicoAlertas })
      ]);
      
      setEquipamentos(resEquip.data);
      if (abaAtiva === 'historico') setHistoricoAlertas(resHist.data);
      
      // Valida existência de um novo ID crítico
      const idMaisAltoRecebido = resNotif.data.length > 0 ? Math.max(...resNotif.data.map(n => n.id)) : 0;

      if (lastAlertIdRef.current !== -1 && idMaisAltoRecebido > lastAlertIdRef.current) {
        if (somAtivoRef.current) tocarAlarme();

        const alertasNovos = resNotif.data.filter(n => n.id > lastAlertIdRef.current);
        if (alertasNovos.length > 0) {
           showToast(`🚨 ${alertasNovos[0].mensagem}`, 'error');
        }
      }
      
      lastAlertIdRef.current = idMaisAltoRecebido;
      setNotificacoes(resNotif.data);

      // Caching
      localStorage.setItem('cache_equipamentos', JSON.stringify(resEquip.data));
      localStorage.setItem('cache_notificacoes', JSON.stringify(resNotif.data));
      if (abaAtiva === 'historico') localStorage.setItem('cache_historico', JSON.stringify(resHist.data));

    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) fazerLogout();
    }
  };

  const carregarRelatorios = async () => {
    if (!token) return;
    if (isOffline) {
      const cacheRel = localStorage.getItem('cache_relatorios');
      if (cacheRel) setRelatorios(JSON.parse(cacheRel));
      return;
    }
    try {
      const res = await api.get(`/relatorios?data_inicio=${dataInicio.toISOString()}&data_fim=${dataFim.toISOString()}`);
      setRelatorios(res.data);
      localStorage.setItem('cache_relatorios', JSON.stringify(res.data));
    } catch (error) {
      console.error(error);
    }
  };

  // Conexão WebSocket e Polling de Latência
  useEffect(() => {
    if (!token) return;
    carregarDadosBase();
    
    if (isOffline) return;
    const socket = io(SOCKET_URL);
    
    socket.on('nova_leitura', (dadosNovaLeitura) => {
      if (abaAtiva === 'relatorios') {
        setRelatorios(prev => {
          const atualizado = [...prev, dadosNovaLeitura];
          localStorage.setItem('cache_relatorios', JSON.stringify(atualizado));
          return atualizado;
        });
      }
      setEquipamentos(prev => {
        const atualizado = prev.map(eq => eq.id === dadosNovaLeitura.equipamento_id ? { ...eq, ultima_temp: dadosNovaLeitura.temperatura } : eq);
        localStorage.setItem('cache_equipamentos', JSON.stringify(atualizado));
        return atualizado;
      });
    });

    socket.on('atualizacao_dados', () => carregarDadosBase());

    // Ping nativo de latência
    const pingInterval = setInterval(() => {
      const start = Date.now();
      socket.emit('medir_latencia', start, (enviadoEm) => {
        setLatencia(Date.now() - enviadoEm);
      });
    }, 2500);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, [token, abaAtiva, isOffline]);

  // Recarga baseada nos filtros dos Relatórios
  useEffect(() => {
    if (token && abaAtiva === 'relatorios') carregarRelatorios();
  }, [token, abaAtiva, dataInicio, dataFim]);

  const checkOfflineAcao = () => {
    if (isOffline) {
      showToast('Ação de escrita bloqueada. Conecte-se à rede para alterar dados.', 'warning');
      return true;
    }
    return false;
  };

  /* =========================================
     AÇÕES DE EQUIPAMENTOS E ALARMES
     ========================================= */
  const salvarNovoEquipamento = async (e) => {
    e.preventDefault();
    if (checkOfflineAcao()) return;
    try {
      await api.post('/equipamentos', formEquip);
      showToast('Novo equipamento inserido na base de dados.', 'success');
      setFormEquip({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
    } catch (error) {
      showToast('Erro ao gravar dados.', 'error');
    }
  };

  const salvarEdicaoEquipamento = async (e) => {
    e.preventDefault();
    if (checkOfflineAcao()) return;
    try {
      await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip);
      showToast('Configurações atualizadas com sucesso!', 'success');
      setEquipEditando(null); 
    } catch (error) {
      showToast('Erro ao atualizar dados.', 'error');
    }
  };

  const editarEquipamento = (eq) => {
    setEquipEditando(eq.id); 
    setFormEditEquip({
      nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max,
      intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, setor: eq.setor || ''
    });
  };

  const pedirExclusao = (id, nome) => {
    if (checkOfflineAcao()) return;
    setModalConfig({
      isOpen: true,
      title: 'Aviso de Segurança',
      message: `Isto irá remover o equipamento "${nome}" permanentemente. Deseja prosseguir?`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(`/equipamentos/${id}`);
          showToast('Equipamento removido do sistema.', 'success');
        } catch (error) {
          showToast('Falha ao remover.', 'error');
        }
      }
    });
  };

  const pedirNotaResolucao = (id) => {
    if (checkOfflineAcao()) return;
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
        } catch (error) {
          showToast('Erro ao arquivar.', 'error');
        }
      }
    });
  };

  const resolverTodasNotificacoes = () => {
    if (checkOfflineAcao()) return;
    setModalConfig({
      isOpen: true,
      title: 'Ação em Massa',
      message: 'Confirma o encerramento de todos os alarmes críticos ativos no ecrã?',
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.put(`/notificacoes/resolver-todas`);
          showToast('Ação em massa executada.', 'success');
        } catch (error) {
          showToast('Falha no servidor.', 'error');
        }
      }
    });
  };

  /* =========================================
     MÉTODOS DE EXPORTAÇÃO
     ========================================= */
  const exportarPDF = () => {
    const dadosFiltrados = equipamentoFiltro ? relatorios.filter(r => r.nome === equipamentoFiltro) : relatorios;
    if (dadosFiltrados.length === 0) return showToast("Sem dados para exportar.", "warning");

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Telemetria - FrioMonitor", 14, 20);
    doc.setFontSize(11);
    doc.text(`Período: ${dataInicio.toLocaleDateString()} a ${dataFim.toLocaleDateString()}`, 14, 28);
    doc.text(`Filtro Aplicado: ${equipamentoFiltro || 'Todos os Equipamentos'}`, 14, 34);

    const tableColumn = ["Data/Hora", "Equipamento", "Setor", "Temperatura (°C)"];
    const tableRows = dadosFiltrados.map(rel => [
      new Date(rel.data_hora).toLocaleString(), 
      rel.nome, 
      rel.setor || 'Geral', 
      `${rel.temperatura} °C`
    ]);

    autoTable(doc, { 
      head: [tableColumn], body: tableRows, startY: 40, theme: 'grid', 
      headStyles: { fillColor: [5, 150, 105] } 
    });
    doc.save(`telemetria_${new Date().getTime()}.pdf`);
    showToast('Documento PDF gerado.', 'success');
  };

  const exportarCSV = () => {
    const dadosFiltrados = equipamentoFiltro ? relatorios.filter(r => r.nome === equipamentoFiltro) : relatorios;
    if (dadosFiltrados.length === 0) return showToast("Sem dados para exportar.", "warning");

    let csvContent = "data:text/csv;charset=utf-8,Data/Hora,Equipamento,Setor,Temperatura (°C)\n";
    dadosFiltrados.forEach(rel => {
      csvContent += `"${new Date(rel.data_hora).toLocaleString()}","${rel.nome}","${rel.setor || 'Geral'}","${rel.temperatura}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `telemetria_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Tabela CSV exportada.', 'success');
  };

  const exportarAuditoriaPDF = () => {
    if (historicoFiltradoLista.length === 0) return showToast("Sem dados de auditoria para exportar.", "warning");

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Livro de Registo de Manutenções", 14, 20);
    doc.setFontSize(11);
    doc.text(`FrioMonitor - Sistema de Auditoria Interna`, 14, 28);
    doc.text(`Gerado a: ${new Date().toLocaleString()}`, 14, 34);

    const tableColumn = ["Data/Hora", "Hardware / Setor", "Ocorrência Reportada", "Ação Técnica Tomada"];
    const tableRows = historicoFiltradoLista.map(hist => [
      new Date(hist.data_hora).toLocaleString(),
      `${hist.equipamento_nome}\n(${hist.setor})`,
      hist.mensagem,
      hist.nota_resolucao
    ]);

    autoTable(doc, { 
      head: [tableColumn], body: tableRows, startY: 42, theme: 'grid', 
      headStyles: { fillColor: [5, 150, 105] }, styles: { cellPadding: 4, fontSize: 9 } 
    });
    doc.save(`auditoria_${new Date().getTime()}.pdf`);
    showToast('Livro de Registo PDF gerado.', 'success');
  };

  const exportarAuditoriaCSV = () => {
    if (historicoFiltradoLista.length === 0) return showToast("Sem dados de auditoria para exportar.", "warning");

    let csvContent = "data:text/csv;charset=utf-8,Data/Hora,Equipamento,Setor,Ocorrencia Reportada,Acao Tecnica Tomada\n";
    historicoFiltradoLista.forEach(hist => {
      csvContent += `"${new Date(hist.data_hora).toLocaleString()}","${hist.equipamento_nome}","${hist.setor}","${hist.mensagem}","${hist.nota_resolucao}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `auditoria_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Auditoria CSV exportada.', 'success');
  };

  /* =========================================
     CÁLCULOS DERIVADOS E FILTROS DE RENDER
     ========================================= */
  const qtdTotal = equipamentos.length;
  const qtdDegelo = equipamentos.filter(e => e.em_degelo).length;
  const qtdFalha = equipamentos.filter(e => !e.motor_ligado && !e.em_degelo).length;
  const qtdOperando = qtdTotal - qtdDegelo - qtdFalha;
  const eqPesquisaLower = termoPesquisa.toLowerCase();
  
  const equipamentosFiltradosLista = equipamentos.filter(eq => 
    eq.nome.toLowerCase().includes(eqPesquisaLower) || (eq.setor && eq.setor.toLowerCase().includes(eqPesquisaLower))
  );

  const historicoFiltradoLista = historicoAlertas.filter(hist => 
    hist.equipamento_nome.toLowerCase().includes(eqPesquisaLower) || (hist.setor && hist.setor.toLowerCase().includes(eqPesquisaLower))
  );

  const equipamentosFiltradosMotores = setorFiltroMotores 
    ? equipamentos.filter(eq => eq.setor === setorFiltroMotores) 
    : equipamentos;

  const dadosRelatorioBrutos = relatorios.filter(r => equipamentoFiltro === '' || r.nome === equipamentoFiltro);
  
  const dadosGrafico = dadosRelatorioBrutos.map(r => ({
    hora: new Date(r.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dataExata: new Date(r.data_hora).toLocaleString(),
    temperatura: parseFloat(r.temperatura),
    nome: r.nome
  }));

  let kpiMax = -Infinity, kpiMin = Infinity, somaTemp = 0;
  dadosGrafico.forEach(d => {
    if (d.temperatura > kpiMax) kpiMax = d.temperatura;
    if (d.temperatura < kpiMin) kpiMin = d.temperatura;
    somaTemp += d.temperatura;
  });

  const kpiMedia = dadosGrafico.length > 0 ? (somaTemp / dadosGrafico.length).toFixed(2) : '--';
  if (kpiMax === -Infinity) kpiMax = '--';
  if (kpiMin === Infinity) kpiMin = '--';

  const equipamentoSelecionado = equipamentos.find(e => e.nome === equipamentoFiltro);

  const dadosDonutStatus = [
    { name: 'Operacionais', value: qtdOperando, color: 'var(--success)' },
    { name: 'Em Degelo', value: qtdDegelo, color: '#38bdf8' },
    { name: 'Falha/Parado', value: qtdFalha, color: 'var(--danger)' }
  ].filter(d => d.value > 0);

  /* =========================================
     RENDERIZAÇÃO DA VIEW DE LOGIN
     ========================================= */
  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box stagger-1">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '1.2rem', borderRadius: '50%', marginBottom: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
              <FrioMonitorLogo size={56} color="var(--primary)" />
            </div>
            <h2 style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>FrioMonitor</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)' }}>IoT Telemetry Server</p>
          </div>
          <form onSubmit={fazerLogin}>
            <div className="login-input-group stagger-2">
              <label style={{ color: 'white' }}>Credencial de Acesso</label>
              <input type="text" placeholder="admin" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            </div>
            <div className="login-input-group stagger-3">
              <label style={{ color: 'white' }}>Palavra-passe</label>
              <input type="password" placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary w-100 login-btn stagger-4" disabled={isOffline} style={{ background: 'white', color: 'var(--primary)' }}>
              {isOffline ? 'Sem Conexão à Internet' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* =========================================
     RENDERIZAÇÃO PRINCIPAL DO APP
     ========================================= */
  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`} style={{ flexDirection: 'column' }}>
      
      {/* Elemento de Áudio Oculto */}
      <audio id="alerta-audio" preload="auto">
        <source src="https://www.soundjay.com/buttons/sounds/beep-02.mp3" type="audio/mpeg" />
      </audio>

      {/* Banner Offline Global */}
      {isOffline && (
        <div className="offline-banner">
          <WifiOff size={18} />
          <span>Aviso: Conexão interrompida. Exibindo os últimos dados em cache. Modo apenas-leitura ativado.</span>
        </div>
      )}

      {/* Container de Toasts (Notificações) */}
      {toast.show && (
        <div className="toast-container" style={{ bottom: isOffline ? '60px' : '20px', zIndex: 9999 }}>
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : (toast.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />)}
            {toast.message}
          </div>
        </div>
      )}

      {/* Modal Genérico */}
      {modalConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content stagger-1">
            <h3>{modalConfig.title}</h3>
            <p>{modalConfig.message}</p>
            {modalConfig.isPrompt && (
              <input 
                type="text" 
                placeholder="Insira detalhes da ação aqui..." 
                value={modalConfig.promptValue} 
                onChange={(e) => setModalConfig({...modalConfig, promptValue: e.target.value})} 
                autoFocus 
                style={{ width: '100%', marginBottom: '1rem' }} 
              />
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setModalConfig({...modalConfig, isOpen: false})}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => { modalConfig.onConfirm(modalConfig.isPrompt ? modalConfig.promptValue : null); setModalConfig({...modalConfig, isOpen: false}); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Específico: Editar Equipamento */}
      {equipEditando && (
        <div className="modal-overlay">
          <div className="modal-content stagger-1" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={22} color="var(--primary)" /> Atualizar Equipamento
              </h3>
              <button className="btn-icon" onClick={() => setEquipEditando(null)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={salvarEdicaoEquipamento}>
              <div className="form-grid">
                <div>
                  <label>Identificador</label>
                  <input type="text" value={formEditEquip.nome} onChange={(e) => setFormEditEquip({ ...formEditEquip, nome: e.target.value })} required disabled={isOffline} />
                </div>
                <div>
                  <label>Setor</label>
                  <select value={formEditEquip.setor} onChange={(e) => setFormEditEquip({ ...formEditEquip, setor: e.target.value })} required disabled={isOffline}>
                    <option value="">Selecione...</option>
                    <option value="Açougue">Açougue</option>
                    <option value="Padaria">Padaria</option>
                    <option value="Rotisseria">Rotisseria</option>
                    <option value="Frios">Frios</option>
                    <option value="Cooler">Cooler</option>
                    <option value="FLV">FLV</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>
                <div>
                  <label>Tipo</label>
                  <select value={formEditEquip.tipo} onChange={(e) => setFormEditEquip({ ...formEditEquip, tipo: e.target.value })} required disabled={isOffline}>
                    <option value="">Selecione...</option>
                    <option value="Câmara Frigorífica">Câmara Frigorífica</option>
                    <option value="Ilha de Congelados">Ilha de Congelados</option>
                    <option value="Balcão Refrigerado">Balcão Refrigerado</option>
                    <option value="Arca Horizontal">Arca Horizontal</option>
                  </select>
                </div>
                <div>
                  <label>Temp. Min (°C)</label>
                  <input type="number" step="0.1" value={formEditEquip.temp_min} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_min: e.target.value })} required disabled={isOffline} />
                </div>
                <div>
                  <label>Temp. Max (°C)</label>
                  <input type="number" step="0.1" value={formEditEquip.temp_max} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_max: e.target.value })} required disabled={isOffline} />
                </div>
                <div>
                  <label>Degelo (H)</label>
                  <input type="number" min="1" value={formEditEquip.intervalo_degelo} onChange={(e) => setFormEditEquip({ ...formEditEquip, intervalo_degelo: e.target.value })} required disabled={isOffline} />
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEquipEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isOffline}><Save size={18} /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Estrutura Flexível Principal --- */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Sidebar */}
        <div className={`sidebar ${menuAberto ? 'open' : ''}`}>
          <div className="sidebar-header" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: 'white', borderRadius: '8px', padding: '4px', display: 'flex' }}>
              <FrioMonitorLogo size={24} color="var(--primary)" />
            </div>
            <h2>FrioMonitor</h2>
            <button className="mobile-close" onClick={() => setMenuAberto(false)} style={{ marginLeft: 'auto' }}>
              <X size={24} color="white" />
            </button>
          </div>
          <nav className="sidebar-nav">
            <button className={`nav-item ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => { setAbaAtiva('dashboard'); setMenuAberto(false); }}>
              <Activity size={20} /> Visão Global {notificacoes.length > 0 && <span className="badge">{notificacoes.length}</span>}
            </button>
            <button className={`nav-item ${abaAtiva === 'motores' ? 'active' : ''}`} onClick={() => { setAbaAtiva('motores'); setMenuAberto(false); }}>
              <Power size={20} /> Painel de Motores
            </button>
            <button className={`nav-item ${abaAtiva === 'equipamentos' ? 'active' : ''}`} onClick={() => { setAbaAtiva('equipamentos'); setMenuAberto(false); }}>
              <Settings size={20} /> Base de Dados
            </button>
            <button className={`nav-item ${abaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('relatorios'); setMenuAberto(false); }}>
              <Thermometer size={20} /> Relatórios Avançados
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

        {/* Overlay do Sidebar em Mobile */}
        {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

        {/* Content Box */}
        <div className="main-content">
          <header className="header">
            <button className="menu-btn" onClick={() => setMenuAberto(true)}><Menu size={24} /></button>
            <h2 className="page-title">
              {abaAtiva === 'dashboard' && 'Monitorização Geral'}
              {abaAtiva === 'motores' && 'Telemetria em Tempo Real'}
              {abaAtiva === 'equipamentos' && 'Configuração de Equipamentos'}
              {abaAtiva === 'relatorios' && 'Análise e Exportação'}
              {abaAtiva === 'historico' && 'Registo de Manutenções'}
            </h2>
            <div className="user-info">
              
              {/* Indicador de Latência e Conectividade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-color)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }} title="Latência de Comunicação IoT">
                {isOffline ? (
                   <>
                    <span className="status-dot" style={{ backgroundColor: 'var(--danger)' }}></span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--danger)' }}>Offline (Cache)</span>
                   </>
                ) : (
                   <>
                    <span className={`status-dot ${notificacoes.length > 0 ? 'pulse-danger' : ''}`} style={{ backgroundColor: latencia === 0 ? 'var(--text-muted)' : (latencia < 80 ? 'var(--success)' : (latencia < 200 ? 'var(--warning)' : 'var(--danger)')) }}></span> 
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      {latencia === 0 ? 'A Ligar...' : `Ping: ${latencia}ms`}
                    </span>
                   </>
                )}
              </div>

              {/* Botões de Controles Extra (Full Screen, Som, Tema) */}
              <button className="btn-icon" onClick={toggleFullScreen} title={isFullScreen ? "Sair de Ecrã Inteiro" : "Modo TV (Ecrã Inteiro)"}>
                {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>

              <button className="btn-icon" onClick={() => setSomAtivo(!somAtivoState)} title={somAtivoState ? "Silenciar Alarmes" : "Ativar Alarmes"} style={{ color: somAtivoState ? 'var(--primary)' : 'var(--danger)' }}>
                {somAtivoState ? <Bell size={20} /> : <BellOff size={20} />}
              </button>
              
              <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)} title="Alternar Tema">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </header>

          <main className="content-area">
            
            {/* --- ABA 1: DASHBOARD GERAL --- */}
            {abaAtiva === 'dashboard' && (
              <div className="anim-fade-in">
                <div className="dashboard-grid stagger-1">
                  
                  {/* Cartões Resumo */}
                  <div className="summary-cards" style={{ margin: 0 }}>
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
                      <span className={`summary-value val-red ${notificacoes.length > 0 ? 'pulse-danger' : ''}`} style={{ borderRadius: '50%', display: 'inline-block', width: 'fit-content' }}>
                        {qtdFalha}
                      </span>
                    </div>
                  </div>

                  {/* Gráfico Donut */}
                  <div className="donut-container">
                    <span className="donut-title">Estado do Hardware</span>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={dadosDonutStatus} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {dadosDonutStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex-header stagger-2">
                  <h3>Central de Alertas Críticos</h3>
                  {notificacoes.length > 0 && (
                    <div className="action-group">
                      <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={resolverTodasNotificacoes} disabled={isOffline}>
                        <CheckCircle size={18}/> Limpar Falsos Alarmes
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Cards de Notificação */}
                {notificacoes.length === 0 ? (
                  <div className="empty-state stagger-3">
                    <CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Sistema Estabilizado</h3>
                    <p>A temperatura de todos os equipamentos está sob controlo rigoroso.</p>
                  </div>
                ) : (
                  <div className="grid-cards stagger-3">
                    {notificacoes.map(notif => (
                      <div key={notif.id} className="card card-alert pulse-danger" style={{ animationDuration: '3s' }}>
                        <div className="card-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={24} color="var(--danger)" />
                            <span style={{ fontWeight: '800', fontSize: '1.1rem' }}>{notif.equipamento_nome}</span>
                          </div>
                          <span className="time-badge">{new Date(notif.data_hora).toLocaleTimeString()}</span>
                        </div>
                        <span className="badge-setor">{notif.setor}</span>
                        <p className="alert-msg">{notif.mensagem}</p>
                        <button className="btn btn-primary w-100" onClick={() => pedirNotaResolucao(notif.id)} disabled={isOffline}>
                          Arquivar Resolução
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- ABA 2: PAINEL DE MOTORES --- */}
            {abaAtiva === 'motores' && (
              <div className="anim-fade-in stagger-1">
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

                <div className="grid-cards stagger-2">
                  {equipamentosFiltradosMotores.map(eq => {
                    const isTempAlta = eq.ultima_temp > eq.temp_max && !eq.em_degelo;
                    const tempRange = eq.temp_max - eq.temp_min;
                    const tempAtualOffset = (eq.ultima_temp || eq.temp_min) - eq.temp_min;
                    
                    let percentage = (tempAtualOffset / tempRange) * 100;
                    if (percentage > 100) percentage = 100;
                    if (percentage < 5) percentage = 5;

                    let barColor = 'var(--success)';
                    if (isTempAlta) barColor = 'var(--danger)';
                    if (eq.ultima_temp < eq.temp_min || eq.em_degelo) barColor = '#38bdf8';

                    return (
                      <div key={eq.id} className={`card ${eq.em_degelo ? 'card-info-border' : (eq.motor_ligado ? 'card-success-border' : 'card-danger-border')} ${isTempAlta ? 'pulse-danger' : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem' }}>{eq.nome}</h3>
                        </div>
                        <span className="badge-setor">{eq.setor}</span>
                        
                        <div className={`status-box ${eq.em_degelo ? 'status-defrost' : (eq.motor_ligado ? 'status-on' : 'status-off')}`} style={{ marginTop: '15px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Power size={20} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '1px' }}>
                                  {eq.em_degelo ? 'DEGELO' : (eq.motor_ligado ? 'LIGADO' : 'PARADO')}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>{eq.temp_min}°C a {eq.temp_max}°C</span>
                            </div>
                            
                            <div className="thermal-bar-bg">
                              <div className="thermal-bar-fill" style={{ width: `${percentage}%`, backgroundColor: barColor }}></div>
                            </div>
                          </div>
                          
                          <div className="temp-display">
                            <span>Atual</span>
                            <h2 style={{ color: isTempAlta ? '#ffcccc' : 'white' }}>
                              {eq.ultima_temp ? `${eq.ultima_temp} °C` : '--'}
                            </h2>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- ABA 3: CONFIGURAÇÕES DE EQUIPAMENTOS --- */}
            {abaAtiva === 'equipamentos' && (
              <div className="anim-fade-in stagger-1">
                
                {/* Form Novo Equipamento */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                  <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PlusCircle size={20} color="var(--primary)" /> Novo Equipamento
                  </h3>
                  <form onSubmit={salvarNovoEquipamento}>
                    <div className="form-grid">
                      <div>
                        <label>Identificador</label>
                        <input type="text" placeholder="Ex: Câmara Fria 01" value={formEquip.nome} onChange={(e) => setFormEquip({ ...formEquip, nome: e.target.value })} required disabled={isOffline} />
                      </div>
                      <div>
                        <label>Setor</label>
                        <select value={formEquip.setor} onChange={(e) => setFormEquip({ ...formEquip, setor: e.target.value })} required disabled={isOffline}>
                          <option value="">Selecione...</option>
                          <option value="Açougue">Açougue</option>
                          <option value="Padaria">Padaria</option>
                          <option value="Rotisseria">Rotisseria</option>
                          <option value="Frios">Frios</option>
                          <option value="Cooler">Cooler</option>
                          <option value="FLV">FLV</option>
                          <option value="Geral">Geral</option>
                        </select>
                      </div>
                      <div>
                        <label>Tipo de Equipamento</label>
                        <select value={formEquip.tipo} onChange={(e) => setFormEquip({ ...formEquip, tipo: e.target.value })} required disabled={isOffline}>
                          <option value="">Selecione...</option>
                          <option value="Câmara Frigorífica">Câmara Frigorífica</option>
                          <option value="Ilha de Congelados">Ilha de Congelados</option>
                          <option value="Balcão Refrigerado">Balcão Refrigerado</option>
                          <option value="Arca Horizontal">Arca Horizontal</option>
                        </select>
                      </div>
                      <div>
                        <label>Temp. Mínima (°C)</label>
                        <input type="number" step="0.1" value={formEquip.temp_min} onChange={(e) => setFormEquip({ ...formEquip, temp_min: e.target.value })} required disabled={isOffline} />
                      </div>
                      <div>
                        <label>Temp. Máxima (°C)</label>
                        <input type="number" step="0.1" value={formEquip.temp_max} onChange={(e) => setFormEquip({ ...formEquip, temp_max: e.target.value })} required disabled={isOffline} />
                      </div>
                      <div>
                        <label>Intervalo de Degelo (H)</label>
                        <input type="number" min="1" value={formEquip.intervalo_degelo} onChange={(e) => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required disabled={isOffline} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary" disabled={isOffline}>
                        <PlusCircle size={18} /> Adicionar ao Sistema
                      </button>
                    </div>
                  </form>
                </div>

                {/* Tabela de Equipamentos */}
                <div className="card table-responsive stagger-2">
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
                          <td data-label="Status">
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: eq.em_degelo ? '#38bdf8' : (eq.motor_ligado ? 'var(--success)' : 'var(--danger)')}}></span>
                          </td>
                          <td data-label="Identificação">
                            <strong>{eq.nome}</strong><br/>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.tipo}</span>
                          </td>
                          <td data-label="Setor">
                            <span className="badge-setor">{eq.setor}</span>
                          </td>
                          <td data-label="Limites Térmicos">{eq.temp_min}°C a {eq.temp_max}°C</td>
                          <td data-label="Rotina Degelo">A cada {eq.intervalo_degelo}h</td>
                          <td data-label="Gerir">
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn btn-outline" style={{ padding: '0.5rem' }} onClick={() => editarEquipamento(eq)} disabled={isOffline} title="Editar">
                                <Edit size={16} />
                              </button>
                              <button className="btn btn-outline" style={{ padding: '0.5rem', color: isOffline ? 'gray' : 'var(--danger)', borderColor: isOffline ? 'gray' : 'var(--danger)' }} onClick={() => pedirExclusao(eq.id, eq.nome)} disabled={isOffline} title="Eliminar">
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- ABA 4: RELATÓRIOS E GRÁFICOS --- */}
            {abaAtiva === 'relatorios' && (
              <div className="anim-fade-in stagger-1">
                
                {/* KPIs */}
                <div className="summary-cards" style={{ marginBottom: '1.5rem' }}>
                  <div className="summary-card" style={{ padding: '1rem' }}>
                    <span className="summary-title" style={{ fontSize: '0.75rem' }}>Média no Período</span>
                    <span className="summary-value val-blue" style={{ fontSize: '1.8rem' }}>{kpiMedia}°C</span>
                  </div>
                  <div className="summary-card" style={{ padding: '1rem' }}>
                    <span className="summary-title" style={{ fontSize: '0.75rem' }}>Pico Máximo</span>
                    <span className="summary-value val-red" style={{ fontSize: '1.8rem' }}>{kpiMax}°C</span>
                  </div>
                  <div className="summary-card" style={{ padding: '1rem' }}>
                    <span className="summary-title" style={{ fontSize: '0.75rem' }}>Pico Mínimo</span>
                    <span className="summary-value val-green" style={{ fontSize: '1.8rem' }}>{kpiMin}°C</span>
                  </div>
                  <div className="summary-card" style={{ padding: '1rem' }}>
                    <span className="summary-title" style={{ fontSize: '0.75rem' }}>Total de Leituras</span>
                    <span className="summary-value" style={{ fontSize: '1.8rem' }}>{dadosGrafico.length}</span>
                  </div>
                </div>

                {/* Filtros e Exportação */}
                <div className="flex-header stagger-2">
                  <h3 style={{ margin: 0 }}>Análise e Exportação</h3>
                  <div className="action-group">
                    <div className="date-filter-group">
                      <DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} selectsStart startDate={dataInicio} endDate={dataFim} disabled={isOffline} />
                      <span className="date-separator">até</span>
                      <DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} selectsEnd startDate={dataInicio} endDate={dataFim} minDate={dataInicio} disabled={isOffline} />
                    </div>
                    <select className="select-input" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)} style={{maxWidth: '250px'}}>
                      <option value="">Panorama Global</option>
                      {equipamentos.map(eq => <option key={eq.id} value={eq.nome}>{eq.nome} ({eq.setor})</option>)}
                    </select>
                    <button className="btn btn-outline" onClick={exportarCSV} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Download size={18} /> CSV
                    </button>
                    <button className="btn btn-danger" onClick={exportarPDF} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FileText size={18} /> PDF
                    </button>
                  </div>
                </div>

                {/* Gráfico Recharts */}
                <div className="chart-container stagger-3" style={{ height: '450px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dadosGrafico} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e5e7eb'} vertical={false} />
                      <XAxis dataKey="hora" stroke={isDarkMode ? '#94a3b8' : '#6b7280'} tick={{ fontSize: 12 }} />
                      <YAxis stroke={isDarkMode ? '#94a3b8' : '#6b7280'} tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      {equipamentoSelecionado && <ReferenceLine y={equipamentoSelecionado.temp_max} stroke="var(--danger)" strokeDasharray="4 4" label={{ position: 'top', value: 'Máx Permitido', fill: 'var(--danger)', fontSize: 12 }} />}
                      <Area type="monotone" dataKey="temperatura" name="Temperatura (°C)" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={3} activeDot={{ r: 6 }} />
                      <Brush dataKey="hora" height={30} stroke="var(--primary)" fill={isDarkMode ? 'var(--card-bg)' : '#f8fafc'} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabela Bruta Opcional */}
                <div style={{ marginTop: '1.5rem' }} className="stagger-4">
                  <button className="btn btn-outline w-100" onClick={() => setMostrarTabelaBruta(!mostrarTabelaBruta)} style={{ background: 'var(--card-bg)', borderStyle: 'dashed' }}>
                    <List size={18} /> {mostrarTabelaBruta ? 'Ocultar Tabela de Registos Brutos' : 'Visualizar Tabela de Registos Brutos'}
                  </button>
                  {mostrarTabelaBruta && (
                    <div className="card table-responsive" style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="table">
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-color)', zIndex: 1 }}>
                          <tr>
                            <th>Data e Hora</th>
                            <th>Equipamento</th>
                            <th>Registo (°C)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dadosGrafico.length === 0 ? (
                            <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>Sem dados no período filtrado.</td></tr>
                          ) : (
                            [...dadosGrafico].reverse().map((dado, index) => (
                              <tr key={index}>
                                <td data-label="Data Exata">{dado.dataExata}</td>
                                <td data-label="Equipamento">{dado.nome}</td>
                                <td data-label="Registo (°C)" style={{ fontWeight: '700', color: dado.temperatura > (equipamentoSelecionado?.temp_max || Infinity) ? 'var(--danger)' : 'var(--primary)' }}>
                                  {dado.temperatura} °C
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- ABA 5: HISTÓRICO E AUDITORIA --- */}
            {abaAtiva === 'historico' && (
              <div className="anim-fade-in stagger-1">
                
                <div className="flex-header">
                  <h3 style={{ margin: 0 }}>Livro de Registo de Manutenções</h3>
                  <div className="action-group">
                    <div className="search-bar" style={{ flex: 1, minWidth: '300px' }}>
                      <Search size={18} color="var(--text-muted)" />
                      <input type="text" placeholder="Pesquisar por equipamento ou setor..." value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} />
                    </div>
                    <button className="btn btn-outline" onClick={exportarAuditoriaCSV} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Download size={18} /> CSV
                    </button>
                    <button className="btn btn-danger" onClick={exportarAuditoriaPDF} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FileText size={18} /> Exportar Livro (PDF)
                    </button>
                  </div>
                </div>

                {/* Timeline de Registos */}
                <div className="card" style={{ marginTop: '1rem', padding: '2rem' }}>
                  {historicoFiltradoLista.length === 0 ? (
                    <div className="empty-state">
                      <ShieldCheck size={56} color="var(--success)" style={{ marginBottom: '1rem' }} />
                      <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Nenhuma Ocorrência</h3>
                      <p>Não existem registos de auditoria correspondentes à sua pesquisa.</p>
                    </div>
                  ) : (
                    <div className="timeline-container">
                      {historicoFiltradoLista.map((hist, index) => (
                        <div key={hist.id} className="timeline-item stagger-2" style={{ animationDelay: `${index * 0.1}s` }}>
                          <div className="timeline-marker"></div>
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <span className="timeline-date">
                                <Calendar size={16} /> {new Date(hist.data_hora).toLocaleString()}
                              </span>
                              <span className="badge-setor" style={{ margin: 0 }}>{hist.setor}</span>
                            </div>
                            <div className="timeline-body">
                              <p style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>{hist.equipamento_nome}</p>
                              <p style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <AlertTriangle size={16} /> {hist.mensagem}
                              </p>
                            </div>
                            <div className="timeline-action">
                              <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', opacity: 0.8 }}>
                                Ação Técnica Executada:
                              </p>
                              <p>{hist.nota_resolucao}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}