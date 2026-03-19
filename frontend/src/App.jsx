import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Calendar, ShieldCheck, Droplets, Wifi, Snowflake 
} from 'lucide-react';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, Brush, PieChart, Pie, Cell 
} from 'recharts'; 

const API_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

const FrioMonitorLogo = ({ size = 40, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M10 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 13.5v-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 9a5 5 0 0 1 5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 5a9 9 0 0 1 9 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [somAtivoState, setSomAtivoState] = useState(true);
  const somAtivoRef = useRef(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [latencia, setLatencia] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoAlertas, setHistoricoAlertas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);

  const [dataInicio, setDataInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 1)));
  const [dataFim, setDataFim] = useState(new Date());
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [setorFiltroMotores, setSetorFiltroMotores] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [mostrarTabelaBruta, setMostrarTabelaBruta] = useState(false);
  
  const [formEquip, setFormEquip] = useState({ nome: '', tipo: '', temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
  const [formEditEquip, setFormEditEquip] = useState({ nome: '', tipo: '', temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
  const [equipEditando, setEquipEditando] = useState(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', onConfirm: null });

  const lastAlertIdRef = useRef(-1);

  const api = useMemo(() => axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }), [token]);

  const setSomAtivo = (val) => {
    setSomAtivoState(val);
    somAtivoRef.current = val;
  };

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => showToast('Erro de ecrã inteiro.', 'error'));
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Conexão restabelecida. A sincronizar dados...', 'success');
      carregarDadosBase();
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Ligação à internet perdida. A operar em Modo Offline Seguro.', 'warning');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const tocarAlarme = useCallback(() => {
    const audioEl = document.getElementById('alerta-audio');
    if (audioEl) {
      audioEl.currentTime = 0;
      let playPromise = audioEl.play();
      if (playPromise !== undefined) playPromise.catch(() => {});
      setTimeout(() => {
        audioEl.currentTime = 0;
        let playPromise2 = audioEl.play();
        if (playPromise2 !== undefined) playPromise2.catch(() => {}); 
      }, 500);
    }
  }, []);

  const carregarDadosBase = useCallback(async () => {
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
      
      const idMaisAltoRecebido = resNotif.data.length > 0 ? Math.max(...resNotif.data.map(n => n.id)) : 0;
      if (lastAlertIdRef.current !== -1 && idMaisAltoRecebido > lastAlertIdRef.current) {
        if (somAtivoRef.current) tocarAlarme();
        const alertasNovos = resNotif.data.filter(n => n.id > lastAlertIdRef.current);
        if (alertasNovos.length > 0) {
          const isDegeloToast = alertasNovos[0].tipo_alerta === 'DEGELO' || alertasNovos[0].mensagem.includes('DEGELO');
          showToast(`${isDegeloToast ? '❄️' : '🚨'} ${alertasNovos[0].mensagem}`, isDegeloToast ? 'info' : 'error');
        }
      }
      lastAlertIdRef.current = idMaisAltoRecebido;
      setNotificacoes(resNotif.data);

      localStorage.setItem('cache_equipamentos', JSON.stringify(resEquip.data));
      localStorage.setItem('cache_notificacoes', JSON.stringify(resNotif.data));
      if (abaAtiva === 'historico') localStorage.setItem('cache_historico', JSON.stringify(resHist.data));
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) fazerLogout();
    }
  }, [token, isOffline, abaAtiva, api, historicoAlertas, tocarAlarme, showToast]);

  const carregarRelatorios = useCallback(async () => {
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
  }, [token, isOffline, api, dataInicio, dataFim]);

  useEffect(() => {
    if (!token) return;
    carregarDadosBase();
    if (isOffline) return;
    const socket = io(SOCKET_URL);
    socket.on('nova_leitura', (dadosNovaLeitura) => {
      if (abaAtiva === 'relatorios') {
        setRelatorios(prev => {
          const atualizado = [...prev, dadosNovaLeitura];
          if (atualizado.length > 20000) atualizado.shift(); 
          return atualizado;
        });
      }
      setEquipamentos(prev => {
        return prev.map(eq => eq.id === dadosNovaLeitura.equipamento_id ? { 
            ...eq, ultima_temp: dadosNovaLeitura.temperatura, ultima_umidade: dadosNovaLeitura.umidade 
        } : eq);
      });
    });
    socket.on('atualizacao_dados', () => carregarDadosBase());
    const pingInterval = setInterval(() => {
      const start = Date.now();
      socket.emit('medir_latencia', start, (enviadoEm) => { setLatencia(Date.now() - enviadoEm); });
    }, 2500);
    return () => { clearInterval(pingInterval); socket.disconnect(); };
  }, [token, abaAtiva, isOffline, carregarDadosBase]);

  useEffect(() => {
    if (token && abaAtiva === 'relatorios') carregarRelatorios();
  }, [token, abaAtiva, dataInicio, dataFim, carregarRelatorios]);

  const checkOfflineAcao = () => {
    if (isOffline) {
      showToast('Ação bloqueada. Conecte-se à rede para alterar dados.', 'warning');
      return true;
    }
    return false;
  };

  const aplicarNormaANVISA = (setor, tipo, setFormAction) => {
    let tMin = '', tMax = '', uMin = '', uMax = '';

    if (setor === 'Farmácia / Vacinas') {
      if (tipo.includes('Congelados') || tipo === 'Arca Horizontal') {
        tMin = -25; tMax = -15; uMin = 35; uMax = 60; 
      } else {
        tMin = 2; tMax = 8; uMin = 35; uMax = 65;
      }
    } else {
      if (tipo === 'Ilha de Congelados' || tipo === 'Arca Horizontal' || tipo === 'Câmara de Congelados') {
        tMin = -24; tMax = -18; uMin = 60; uMax = 80;
      } else if (tipo === 'Balcão Refrigerado Aberto' || tipo === 'Balcão Refrigerado com Porta') {
        const isAberto = tipo === 'Balcão Refrigerado Aberto';
        if (setor === 'Açougue') {
          tMin = 0; tMax = 4; uMin = 85; uMax = 95;
        } else if (setor === 'Frios' || setor === 'Rotisseria') {
          tMin = 0; tMax = isAberto ? 7 : 5; uMin = 60; uMax = isAberto ? 85 : 80;
        } else if (setor === 'FLV') {
          tMin = 8; tMax = 12; uMin = 85; uMax = 95;
        } else {
          tMin = 0; tMax = isAberto ? 8 : 5; uMin = 60; uMax = 85;
        }
      } else if (tipo === 'Câmara Frigorífica' || tipo === 'Câmara Refrigerada') {
        if (setor === 'Açougue') {
          tMin = 0; tMax = 4; uMin = 85; uMax = 95;
        } else if (setor === 'FLV') {
          tMin = 8; tMax = 10; uMin = 85; uMax = 95;
        } else {
          tMin = 0; tMax = 8; uMin = 60; uMax = 85;
        }
      } else {
        tMin = 2; tMax = 8; uMin = 60; uMax = 80;
      }
    }

    setFormAction(prev => ({ 
      ...prev, temp_min: tMin, temp_max: tMax, umidade_min: uMin, umidade_max: uMax, intervalo_degelo: 6, duracao_degelo: 30
    }));
    showToast('Limites normativos da ANVISA aplicados.', 'info');
  };

  const salvarNovoEquipamento = async (e) => {
    e.preventDefault();
    if (checkOfflineAcao()) return;
    try {
      await api.post('/equipamentos', formEquip);
      showToast('Equipamento inserido.', 'success');
      setFormEquip({ nome: '', tipo: '', temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '' });
    } catch (error) { showToast('Erro ao gravar dados.', 'error'); }
  };

  const editarEquipamento = (eq) => {
    if (checkOfflineAcao()) return;
    setEquipEditando(eq.id);
    setFormEditEquip({
      nome: eq.nome,
      tipo: eq.tipo,
      temp_min: eq.temp_min,
      temp_max: eq.temp_max,
      umidade_min: eq.umidade_min || '',
      umidade_max: eq.umidade_max || '',
      intervalo_degelo: eq.intervalo_degelo,
      duracao_degelo: eq.duracao_degelo,
      setor: eq.setor
    });
  };

  const salvarEdicaoEquipamento = async (e) => {
    e.preventDefault();
    if (checkOfflineAcao()) return;
    try {
      await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip);
      showToast('Configurações atualizadas.', 'success');
      setEquipEditando(null); 
    } catch (error) { showToast('Erro ao atualizar.', 'error'); }
  };

  const pedirExclusao = (id, nome) => {
    if (checkOfflineAcao()) return;
    setModalConfig({
      isOpen: true, title: 'Aviso de Segurança',
      message: `Isto irá remover o equipamento "${nome}". Prosseguir?`,
      isPrompt: false,
      onConfirm: async () => {
        try { await api.delete(`/equipamentos/${id}`); showToast('Removido.', 'success'); } 
        catch (error) { showToast('Falha.', 'error'); }
      }
    });
  };

  const pedirNotaResolucao = (id) => {
    if (checkOfflineAcao()) return;
    setModalConfig({
      isOpen: true, title: 'Registo de Auditoria',
      message: 'Descreva a ação técnica para arquivamento regulamentar:',
      isPrompt: true, promptValue: '',
      onConfirm: async (nota) => {
        const notaFinal = nota.trim() === '' ? 'Resolvido sem nota técnica.' : nota;
        try { await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: notaFinal }); showToast('Arquivado com sucesso.', 'success'); } 
        catch (error) { showToast('Erro ao arquivar.', 'error'); }
      }
    });
  };

  const resolverTodasNotificacoes = () => {
    if (checkOfflineAcao()) return;
    setModalConfig({
      isOpen: true, title: 'Ação em Massa', message: 'Confirma o encerramento de todos os alarmes ativos?', isPrompt: false,
      onConfirm: async () => {
        try { await api.put(`/notificacoes/resolver-todas`); showToast('Ação executada.', 'success'); } 
        catch (error) { showToast('Falha no servidor.', 'error'); }
      }
    });
  };

  const gerarExportacao = (tipo) => {
    let fonteDados = abaAtiva === 'historico' ? historicoFiltradoLista : (equipamentoFiltro ? relatorios.filter(r => r.nome === equipamentoFiltro) : relatorios);
    if (fonteDados.length === 0) return showToast("Sem dados para exportar.", "warning");

    if (tipo === 'pdf') {
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text(abaAtiva === 'historico' ? "Livro de Registo de Manutenções" : "Relatório Analítico de Telemetria", 14, 20);
      doc.setFontSize(11); doc.text(`Gerado a: ${new Date().toLocaleString()}`, 14, 28);
      
      let head, body;
      if (abaAtiva === 'historico') {
        head = [["Data/Hora", "Hardware / Setor", "Ocorrência Reportada", "Ação Técnica Tomada"]];
        body = fonteDados.map(h => [new Date(h.data_hora).toLocaleString(), `${h.equipamento_nome}\n(${h.setor})`, h.mensagem, h.nota_resolucao]);
      } else {
        head = [["Data/Hora", "Equipamento", "Setor", "Temp (°C)", "Hum (%)"]];
        body = fonteDados.map(r => [new Date(r.data_hora).toLocaleString(), r.nome, r.setor || 'Geral', `${r.temperatura} °C`, `${r.umidade || '--'} %`]);
      }

      autoTable(doc, { head, body, startY: 40, theme: 'grid', headStyles: { fillColor: [5, 150, 105] } });
      doc.save(`friomonitor_export_${new Date().getTime()}.pdf`);
    } else {
      let csvContent = abaAtiva === 'historico' 
        ? "data:text/csv;charset=utf-8,Data/Hora,Equipamento,Setor,Ocorrencia Reportada,Acao Tecnica Tomada\n"
        : "data:text/csv;charset=utf-8,Data/Hora,Equipamento,Setor,Temperatura (°C),Humidade (%)\n";
      
      fonteDados.forEach(row => {
        csvContent += abaAtiva === 'historico'
          ? `"${new Date(row.data_hora).toLocaleString()}","${row.equipamento_nome}","${row.setor}","${row.mensagem}","${row.nota_resolucao}"\n`
          : `"${new Date(row.data_hora).toLocaleString()}","${row.nome}","${row.setor || 'Geral'}","${row.temperatura}","${row.umidade || '--'}"\n`;
      });
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `friomonitor_export_${new Date().getTime()}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
    showToast('Exportação concluída.', 'success');
  };

  /* --- OTIMIZAÇÃO (MEMOIZATION) --- */
  const { qtdTotal, qtdDegelo, qtdFalha, qtdOperando } = useMemo(() => {
    const total = equipamentos.length;
    const degelo = equipamentos.filter(e => e.em_degelo).length;
    const falha = equipamentos.filter(e => !e.motor_ligado && !e.em_degelo).length;
    return { qtdTotal: total, qtdDegelo: degelo, qtdFalha: falha, qtdOperando: total - degelo - falha };
  }, [equipamentos]);

  const eqPesquisaLower = termoPesquisa.toLowerCase();
  
  const equipamentosFiltradosLista = useMemo(() => equipamentos.filter(eq => 
    eq.nome.toLowerCase().includes(eqPesquisaLower) || (eq.setor && eq.setor.toLowerCase().includes(eqPesquisaLower))
  ), [equipamentos, eqPesquisaLower]);

  const historicoFiltradoLista = useMemo(() => historicoAlertas.filter(hist => 
    hist.equipamento_nome.toLowerCase().includes(eqPesquisaLower) || (hist.setor && hist.setor.toLowerCase().includes(eqPesquisaLower))
  ), [historicoAlertas, eqPesquisaLower]);

  const equipamentosFiltradosMotores = useMemo(() => 
    setorFiltroMotores ? equipamentos.filter(eq => eq.setor === setorFiltroMotores) : equipamentos
  , [equipamentos, setorFiltroMotores]);

  const dadosRelatorioBrutos = useMemo(() => 
    relatorios.filter(r => equipamentoFiltro === '' || r.nome === equipamentoFiltro)
  , [relatorios, equipamentoFiltro]);
  
  const dadosGrafico = useMemo(() => dadosRelatorioBrutos.map(r => ({
    hora: new Date(r.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dataExata: new Date(r.data_hora).toLocaleString(),
    temperatura: parseFloat(r.temperatura),
    umidade: parseFloat(r.umidade || 0),
    nome: r.nome
  })), [dadosRelatorioBrutos]);

  // AQUI: Downsampling da Gráfica para alta performance. Limita a 200 pontos no ecrã.
  const dadosGraficoFiltrados = useMemo(() => {
     if (dadosGrafico.length <= 200) return dadosGrafico;
     const step = Math.ceil(dadosGrafico.length / 200);
     return dadosGrafico.filter((_, idx) => idx % step === 0);
  }, [dadosGrafico]);

  const ultimasLeiturasRaw = useMemo(() => [...dadosGrafico].reverse().slice(0, 150), [dadosGrafico]);

  const mktValueProcessado = useMemo(() => {
    const arrayTemperaturas = dadosRelatorioBrutos.map(d => parseFloat(d.temperatura));
    if (arrayTemperaturas.length === 0) return '--';
    
    const dH = 83.144;
    const R = 0.0083144;
    let somaExponencial = 0;
    
    arrayTemperaturas.forEach(t => {
      const kelvin = t + 273.15;
      somaExponencial += Math.exp(-dH / (R * kelvin));
    });
    
    const mediaExponencial = somaExponencial / arrayTemperaturas.length;
    const mktKelvin = (dH / R) / (-Math.log(mediaExponencial));
    return (mktKelvin - 273.15).toFixed(2);
  }, [dadosRelatorioBrutos]);

  const kpis = useMemo(() => {
    let kpiMaxT = -Infinity, kpiMinT = Infinity;
    let kpiMaxU = -Infinity, kpiMinU = Infinity, somaUmid = 0, countUmid = 0, somaTemp = 0;
    
    dadosGrafico.forEach(d => {
      if (d.temperatura > kpiMaxT) kpiMaxT = d.temperatura;
      if (d.temperatura < kpiMinT) kpiMinT = d.temperatura;
      somaTemp += d.temperatura;

      if (d.umidade > 0) {
        if (d.umidade > kpiMaxU) kpiMaxU = d.umidade;
        if (d.umidade < kpiMinU) kpiMinU = d.umidade;
        somaUmid += d.umidade;
        countUmid++;
      }
    });

    return {
      kpiMaxT: kpiMaxT === -Infinity ? '--' : kpiMaxT, kpiMinT: kpiMinT === Infinity ? '--' : kpiMinT,
      kpiMediaT: dadosGrafico.length > 0 ? (somaTemp / dadosGrafico.length).toFixed(2) : '--',
      kpiMaxU: kpiMaxU === -Infinity ? '--' : kpiMaxU,
      kpiMinU: kpiMinU === Infinity ? '--' : kpiMinU,
      kpiMediaU: countUmid > 0 ? (somaUmid / countUmid).toFixed(1) : '--'
    };
  }, [dadosGrafico]);

  const equipamentoSelecionado = useMemo(() => equipamentos.find(e => e.nome === equipamentoFiltro), [equipamentos, equipamentoFiltro]);

  const dadosDonutStatus = useMemo(() => [
    { name: 'Operacionais', value: qtdOperando, color: 'var(--success)' },
    { name: 'Em Degelo', value: qtdDegelo, color: '#38bdf8' },
    { name: 'Falha/Parado', value: qtdFalha, color: 'var(--danger)' }
  ].filter(d => d.value > 0), [qtdOperando, qtdDegelo, qtdFalha]);

  /* --- RENDERIZAÇÃO DO LOGIN --- */
  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box stagger-1">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '1.2rem', borderRadius: '50%', marginBottom: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
              <FrioMonitorLogo size={56} color="var(--primary)" />
            </div>
            <h2 style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>FrioMonitor</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)' }}>Telemetry & Audit Server</p>
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
              {isOffline ? 'Sem Ligação à Internet' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* --- COMPONENTES DAS ABAS --- */
  const renderDashboard = () => (
    <div className="anim-fade-in">
      <div className="dashboard-grid stagger-1">
        <div className="summary-cards" style={{ margin: 0 }}>
          <div className="summary-card"><span className="summary-title">Total de Equipamentos</span><span className="summary-value">{qtdTotal}</span></div>
          <div className="summary-card"><span className="summary-title">Dentro dos Parâmetros</span><span className="summary-value val-green">{qtdOperando}</span></div>
          <div className="summary-card"><span className="summary-title">Ciclo de Degelo</span><span className="summary-value val-blue">{qtdDegelo}</span></div>
          <div className="summary-card"><span className="summary-title">Anomalias Ativas</span><span className={`summary-value val-red ${notificacoes.length > 0 ? 'pulse-danger' : ''}`} style={{ borderRadius: '50%', display: 'inline-block', width: 'fit-content' }}>{qtdFalha}</span></div>
        </div>
        <div className="donut-container">
          <span className="donut-title">Estado do Hardware</span>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dadosDonutStatus} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {dadosDonutStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex-header stagger-2">
        <h3>Central de Ocorrências e Watchdog</h3>
        {notificacoes.length > 0 && (
          <div className="action-group">
            <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={resolverTodasNotificacoes} disabled={isOffline}>
              <CheckCircle size={18}/> Limpar Falsos Alarmes
            </button>
          </div>
        )}
      </div>
      
      {notificacoes.length === 0 ? (
        <div className="empty-state stagger-3">
          <CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Topologia de Rede e Temperatura Estáveis</h3>
          <p>Todos os sensores respondem ao Watchdog e operam dentro da norma ANVISA.</p>
        </div>
      ) : (
        <div className="grid-cards stagger-3">
          {notificacoes.map(notif => {
            const isNetworkFail = notif.mensagem.includes('FALHA DE REDE');
            const isDegelo = notif.tipo_alerta === 'DEGELO' || notif.mensagem.includes('DEGELO');
            let IconCmp = AlertTriangle; let colorTheme = 'var(--danger)';
            if (isNetworkFail) { IconCmp = Wifi; colorTheme = 'var(--warning)'; }
            else if (isDegelo) { IconCmp = Snowflake; colorTheme = '#38bdf8'; }

            return (
              <div key={notif.id} className={`card card-alert ${!isDegelo ? 'pulse-danger' : ''}`} style={{ animationDuration: '3s', borderColor: colorTheme }}>
                <div className="card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconCmp size={24} color={colorTheme} />
                    <span style={{ fontWeight: '800', fontSize: '1.1rem', color: colorTheme }}>{notif.equipamento_nome}</span>
                  </div>
                  <span className="time-badge" style={{ color: colorTheme, backgroundColor: isDegelo ? 'rgba(56, 189, 248, 0.1)' : undefined }}>
                    {new Date(notif.data_hora).toLocaleTimeString()}
                  </span>
                </div>
                <span className="badge-setor">{notif.setor}</span>
                <p className="alert-msg">{notif.mensagem}</p>
                <button className="btn btn-primary w-100" onClick={() => pedirNotaResolucao(notif.id)} disabled={isOffline} style={isDegelo ? { backgroundColor: colorTheme, color: '#fff', borderColor: colorTheme } : {}}>
                  {isDegelo ? 'Confirmar Fim de Ciclo' : 'Arquivar Registo de Evento'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPainelSensores = (tipoLeitura) => {
    const isTemp = tipoLeitura === 'temperatura';
    return (
      <div className="anim-fade-in stagger-1">
        <div className="flex-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isTemp ? <Thermometer size={24} color="var(--primary)"/> : <Droplets size={24} color="#38bdf8" />} 
            {isTemp ? 'Termómetros Digitais' : 'Higrómetros Digitais'}
          </h3>
          <div className="action-group">
            <select className="select-input" value={setorFiltroMotores} onChange={(e) => setSetorFiltroMotores(e.target.value)}>
              <option value="">Filtro: Todos os Setores</option>
              <option value="Farmácia / Vacinas">Farmácia / Vacinas</option>
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
            const valorAtual = isTemp ? eq.ultima_temp : eq.ultima_umidade;
            const min = isTemp ? eq.temp_min : (eq.umidade_min || 40);
            const max = isTemp ? eq.temp_max : (eq.umidade_max || 60);
            
            const isAlta = valorAtual > max;
            const isBaixa = valorAtual < min;
            const isAnomalia = (isAlta || isBaixa) && !eq.em_degelo;
            
            const range = max - min;
            const offset = (valorAtual || min) - min;
            let percentage = (offset / range) * 100;
            if (percentage > 100) percentage = 100; if (percentage < 5) percentage = 5;

            let barColor = isTemp ? 'var(--success)' : '#38bdf8';
            if (isAnomalia) barColor = isTemp ? 'var(--danger)' : 'var(--warning)';
            if (eq.em_degelo) barColor = '#38bdf8';

            return (
              <div key={eq.id} className={`card ${isAnomalia ? 'card-danger-border pulse-danger' : (eq.em_degelo ? 'card-info-border' : (isTemp && eq.motor_ligado ? 'card-success-border' : 'card-info-border'))}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem' }}>{eq.nome}</h3>
                </div>
                <span className="badge-setor">{eq.setor}</span>
                
                <div className={`status-box ${eq.em_degelo && isTemp ? 'status-defrost' : (isAnomalia && !isTemp ? '' : (isTemp && !eq.motor_ligado ? 'status-off' : 'status-on'))}`} style={{ marginTop: '15px', backgroundColor: !isTemp ? (isAnomalia ? 'var(--warning)' : '#0ea5e9') : undefined }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isTemp ? <Power size={20} /> : <Droplets size={20} />}
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '1px' }}>
                          {isTemp ? (eq.em_degelo ? 'DEGELO' : (eq.motor_ligado ? 'LIGADO' : 'PARADO')) : (isAlta ? 'MUITO HÚMIDO' : (isBaixa ? 'MUITO SECO' : 'ESTÁVEL'))}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>{min}{isTemp?'°C':'%'} a {max}{isTemp?'°C':'%'}</span>
                    </div>
                    <div className="thermal-bar-bg" style={{ backgroundColor: !isTemp ? 'rgba(0,0,0,0.2)' : undefined }}>
                      <div className="thermal-bar-fill" style={{ width: `${percentage}%`, backgroundColor: !isTemp ? '#fff' : barColor }}></div>
                    </div>
                  </div>
                  <div className="temp-display" style={{ background: !isTemp ? 'rgba(0,0,0,0.15)' : undefined }}>
                    <span>Atual</span>
                    <h2 style={{ color: (isAnomalia && isTemp) ? '#ffcccc' : 'white' }}>
                      {valorAtual ? `${valorAtual}${isTemp?' °C':'%'}` : '--'}
                    </h2>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderEquipamentos = () => (
    <div className="anim-fade-in stagger-1">
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><PlusCircle size={20} color="var(--primary)" /> Novo Equipamento</h3>
          <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderColor: '#38bdf8', color: '#38bdf8' }} onClick={() => aplicarNormaANVISA(formEquip.setor, formEquip.tipo, setFormEquip)} disabled={!formEquip.setor || !formEquip.tipo || isOffline}>
            <ShieldCheck size={16} /> Preencher Padrão RDC
          </button>
        </div>
        <form onSubmit={salvarNovoEquipamento}>
          <div className="form-grid">
            <div><label>Identificador</label><input type="text" value={formEquip.nome} onChange={(e) => setFormEquip({ ...formEquip, nome: e.target.value })} required disabled={isOffline} /></div>
            <div>
              <label>Setor</label>
              <select value={formEquip.setor} onChange={(e) => setFormEquip({ ...formEquip, setor: e.target.value })} required disabled={isOffline}>
                <option value="">Selecione...</option>
                <option value="Farmácia / Vacinas">Farmácia / Vacinas</option>
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
                <option value="Câmara Refrigerada">Câmara Refrigerada</option>
                <option value="Câmara de Congelados">Câmara de Congelados</option>
                <option value="Ilha de Congelados">Ilha de Congelados</option>
                <option value="Balcão Refrigerado Aberto">Balcão Refrigerado Aberto</option>
                <option value="Balcão Refrigerado com Porta">Balcão Refrigerado com Porta</option>
                <option value="Arca Horizontal">Arca Horizontal</option>
              </select>
            </div>
            <div><label>Temp. Min (°C)</label><input type="number" step="0.1" value={formEquip.temp_min} onChange={(e) => setFormEquip({ ...formEquip, temp_min: e.target.value })} required disabled={isOffline} /></div>
            <div><label>Temp. Max (°C)</label><input type="number" step="0.1" value={formEquip.temp_max} onChange={(e) => setFormEquip({ ...formEquip, temp_max: e.target.value })} required disabled={isOffline} /></div>
            <div><label>Hum. Min (%)</label><input type="number" step="0.1" value={formEquip.umidade_min} onChange={(e) => setFormEquip({ ...formEquip, umidade_min: e.target.value })} disabled={isOffline} /></div>
            <div><label>Hum. Max (%)</label><input type="number" step="0.1" value={formEquip.umidade_max} onChange={(e) => setFormEquip({ ...formEquip, umidade_max: e.target.value })} disabled={isOffline} /></div>
            <div><label>Intervalo de Degelo (H)</label><input type="number" min="1" value={formEquip.intervalo_degelo} onChange={(e) => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required disabled={isOffline} /></div>
            <div><label>Duração Degelo (Min)</label><input type="number" min="1" value={formEquip.duracao_degelo} onChange={(e) => setFormEquip({ ...formEquip, duracao_degelo: e.target.value })} required disabled={isOffline} /></div>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isOffline}><PlusCircle size={18} /> Adicionar ao Sistema</button>
          </div>
        </form>
      </div>

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
            <tr><th>Status</th><th>Identificação</th><th>Setor</th><th>Limites</th><th>Rotina Degelo</th><th>Gerir</th></tr>
          </thead>
          <tbody>
            {equipamentosFiltradosLista.map(eq => (
              <tr key={eq.id}>
                <td data-label="Status"><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: eq.em_degelo ? '#38bdf8' : (eq.motor_ligado ? 'var(--success)' : 'var(--danger)')}}></span></td>
                <td data-label="Identificação"><strong>{eq.nome}</strong><br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.tipo}</span></td>
                <td data-label="Setor"><span className="badge-setor">{eq.setor}</span></td>
                <td data-label="Limites">{eq.temp_min}°C a {eq.temp_max}°C <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.umidade_min || 40}% a {eq.umidade_max || 80}% (Hum)</span></td>
                <td data-label="Rotina Degelo">A cada {eq.intervalo_degelo}h<br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({eq.duracao_degelo} min)</span></td>
                <td data-label="Gerir">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-outline" style={{ padding: '0.5rem' }} onClick={() => editarEquipamento(eq)} disabled={isOffline} title="Editar"><Edit size={16} /></button>
                    <button className="btn btn-outline" style={{ padding: '0.5rem', color: isOffline ? 'gray' : 'var(--danger)', borderColor: isOffline ? 'gray' : 'var(--danger)' }} onClick={() => pedirExclusao(eq.id, eq.nome)} disabled={isOffline} title="Eliminar"><X size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRelatorios = () => (
    <div className="anim-fade-in stagger-1">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Thermometer size={16} /> Estabilidade Térmica (Regulamentar)
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mínima</div><div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>{kpis.kpiMinT}°C</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Média</div><div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{kpis.kpiMediaT}°C</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Máxima</div><div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--danger)' }}>{kpis.kpiMaxT}°C</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '5px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)' }}>Temperatura Cinética Média (MKT)</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Cálculo USP / FDA (Energia Ativação: 83.144 kJ/mol)</div>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--primary)', background: 'var(--bg-color)', padding: '5px 15px', borderRadius: '8px' }}>
                    {mktValueProcessado}°C
                  </div>
              </div>
          </div>
          
          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Droplets size={16} /> Indicadores de Humidade
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Média</div><div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{kpis.kpiMediaU}%</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mínima</div><div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--warning)' }}>{kpis.kpiMinU}%</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Máxima</div><div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0ea5e9' }}>{kpis.kpiMaxU}%</div></div>
              </div>
          </div>
      </div>

      <div className="flex-header stagger-2">
        <h3 style={{ margin: 0 }}>Correlação de Eixos</h3>
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
          <button className="btn btn-outline" onClick={() => gerarExportacao('csv')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Download size={18} /> CSV</button>
          <button className="btn btn-danger" onClick={() => gerarExportacao('pdf')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><FileText size={18} /> PDF</button>
        </div>
      </div>

      <div className="chart-container stagger-3" style={{ height: '450px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dadosGraficoFiltrados} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e5e7eb'} vertical={false} />
            <XAxis dataKey="hora" stroke={isDarkMode ? '#94a3b8' : '#6b7280'} tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" stroke="var(--primary)" tick={{ fontSize: 12 }} label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: 'var(--primary)' }} />
            <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" tick={{ fontSize: 12 }} label={{ value: 'Humidade (%)', angle: 90, position: 'insideRight', fill: '#38bdf8' }} />
            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            {equipamentoSelecionado && <ReferenceLine yAxisId="left" y={equipamentoSelecionado.temp_max} stroke="var(--danger)" strokeDasharray="4 4" label={{ position: 'top', value: 'Máx Temp', fill: 'var(--danger)', fontSize: 12 }} />}
            {equipamentoSelecionado && <ReferenceLine yAxisId="right" y={equipamentoSelecionado.umidade_max || 80} stroke="#0ea5e9" strokeDasharray="4 4" label={{ position: 'top', value: 'Máx Hum', fill: '#0ea5e9', fontSize: 12 }} />}

            {/* Gráfico otimizado sem animações pesadas */}
            <Area isAnimationActive={false} yAxisId="left" type="monotone" dataKey="temperatura" name="Temperatura (°C)" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={3} activeDot={{ r: 6 }} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="umidade" name="Humidade (%)" stroke="#38bdf8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            <Brush dataKey="hora" height={30} stroke="var(--primary)" fill={isDarkMode ? 'var(--card-bg)' : '#f8fafc'} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '1.5rem' }} className="stagger-4">
        <button className="btn btn-outline w-100" onClick={() => setMostrarTabelaBruta(!mostrarTabelaBruta)} style={{ background: 'var(--card-bg)', borderStyle: 'dashed' }}>
          <List size={18} /> {mostrarTabelaBruta ? 'Ocultar Matriz de Dados Brutos' : 'Visualizar Matriz de Dados Brutos'}
        </button>
        {mostrarTabelaBruta && (
          <div className="card table-responsive" style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table">
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-color)', zIndex: 1 }}>
                <tr><th>Data e Hora</th><th>Sensor</th><th>Termometria (°C)</th><th>Higrometria (%)</th></tr>
              </thead>
              <tbody>
                {ultimasLeiturasRaw.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Sem dados na matriz.</td></tr>
                ) : (
                  ultimasLeiturasRaw.map((dado, index) => {
                      const eqRef = equipamentos.find(e => e.nome === dado.nome);
                      const isTempAlerta = eqRef && dado.temperatura > eqRef.temp_max;
                      const isUmidAlerta = eqRef && (dado.umidade > (eqRef.umidade_max || 80) || dado.umidade < (eqRef.umidade_min || 40));
                      return (
                        <tr key={index}>
                          <td data-label="Data Exata" style={{ fontSize: '0.9rem' }}>{dado.dataExata}</td>
                          <td data-label="Equipamento" style={{ fontWeight: '600' }}>{dado.nome}</td>
                          <td data-label="Temp (°C)" style={{ fontWeight: '800', color: isTempAlerta ? 'var(--danger)' : 'var(--primary)' }}>
                            {dado.temperatura} °C {isTempAlerta && <AlertTriangle size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }}/>}
                          </td>
                          <td data-label="Humidade (%)" style={{ fontWeight: '800', color: isUmidAlerta ? 'var(--warning)' : '#38bdf8' }}>
                            {dado.umidade > 0 ? `${dado.umidade} %` : '--'} {isUmidAlerta && <AlertTriangle size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }}/>}
                          </td>
                        </tr>
                      )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistorico = () => (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0 }}>Livro de Registo de Manutenções</h3>
        <div className="action-group">
          <div className="search-bar" style={{ flex: 1, minWidth: '300px' }}>
            <Search size={18} color="var(--text-muted)" />
            <input type="text" placeholder="Pesquisar por equipamento ou setor..." value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} />
          </div>
          <button className="btn btn-outline" onClick={() => gerarExportacao('csv')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Download size={18} /> CSV</button>
          <button className="btn btn-danger" onClick={() => gerarExportacao('pdf')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><FileText size={18} /> PDF</button>
        </div>
      </div>

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
                    <span className="timeline-date"><Calendar size={16} /> {new Date(hist.data_hora).toLocaleString()}</span>
                    <span className="badge-setor" style={{ margin: 0 }}>{hist.setor}</span>
                  </div>
                  <div className="timeline-body">
                    <p style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>{hist.equipamento_nome}</p>
                    <p style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={16} /> {hist.mensagem}</p>
                  </div>
                  <div className="timeline-action">
                    <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', opacity: 0.8 }}>Ação Técnica Executada:</p>
                    <p>{hist.nota_resolucao}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* --- RENDERIZAÇÃO DO LAYOUT PRINCIPAL --- */
  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
      <audio id="alerta-audio" preload="auto">
        <source src="https://www.soundjay.com/buttons/sounds/beep-02.mp3" type="audio/mpeg" />
      </audio>

      {isOffline && (
        <div className="offline-banner" style={{ position: 'fixed', top: 0, width: '100%', zIndex: 1000 }}>
          <WifiOff size={18} />
          <span>Aviso: Ligação local interrompida. Exibindo estado em cache.</span>
        </div>
      )}

      {toast.show && (
        <div className="toast-container" style={{ bottom: isOffline ? '60px' : '20px', zIndex: 9999 }}>
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : (toast.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />)}
            {toast.message}
          </div>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <div className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '4px', display: 'flex' }}><FrioMonitorLogo size={24} color="var(--primary)" /></div>
          <h2>FrioMonitor</h2>
          <button className="mobile-close" onClick={() => setMenuAberto(false)} style={{ marginLeft: 'auto' }}><X size={24} color="white" /></button>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => { setAbaAtiva('dashboard'); setMenuAberto(false); }}>
            <Activity size={20} /> Visão Global {notificacoes.length > 0 && <span className="badge">{notificacoes.length}</span>}
          </button>
          <button className={`nav-item ${abaAtiva === 'motores' ? 'active' : ''}`} onClick={() => { setAbaAtiva('motores'); setMenuAberto(false); }}>
            <Thermometer size={20} /> Painel de Motores
          </button>
          <button className={`nav-item ${abaAtiva === 'umidade' ? 'active' : ''}`} onClick={() => { setAbaAtiva('umidade'); setMenuAberto(false); }}>
            <Droplets size={20} /> Controle de Humidade
          </button>
          <button className={`nav-item ${abaAtiva === 'equipamentos' ? 'active' : ''}`} onClick={() => { setAbaAtiva('equipamentos'); setMenuAberto(false); }}>
            <Settings size={20} /> Equipamentos
          </button>
          <button className={`nav-item ${abaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('relatorios'); setMenuAberto(false); }}>
            <Activity size={20} /> Conformidade & MKT
          </button>
          <button className={`nav-item ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => { setAbaAtiva('historico'); setMenuAberto(false); }}>
            <History size={20} /> Auditoria RDC
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}>
          <button className="btn btn-outline w-100" style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }} onClick={fazerLogout}><LogOut size={18} style={{ marginRight: '8px' }} /> Sair</button>
        </div>
      </div>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      <div className="main-content">
        {/* --- HEADER --- */}
        <header className="header" style={{ marginTop: isOffline ? '40px' : 0 }}>
          <button className="menu-btn" onClick={() => setMenuAberto(true)}><Menu size={24} /></button>
          <h2 className="page-title">
            {abaAtiva === 'dashboard' && 'Monitorização Geral'}
            {abaAtiva === 'motores' && 'Telemetria em Tempo Real (Temp)'}
            {abaAtiva === 'umidade' && 'Controle de Humidade'}
            {abaAtiva === 'equipamentos' && 'Configuração de Infraestrutura'}
            {abaAtiva === 'relatorios' && 'Análise Avançada e Cálculo MKT'}
            {abaAtiva === 'historico' && 'Registo de Manutenções e Ocorrências'}
          </h2>
          <div className="user-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-color)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              {isOffline ? (
                  <><span className="status-dot" style={{ backgroundColor: 'var(--danger)' }}></span><span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--danger)' }}>Offline</span></>
              ) : (
                  <><span className={`status-dot ${notificacoes.length > 0 ? 'pulse-danger' : ''}`} style={{ backgroundColor: latencia === 0 ? 'var(--text-muted)' : (latencia < 80 ? 'var(--success)' : (latencia < 200 ? 'var(--warning)' : 'var(--danger)')) }}></span> 
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>{latencia === 0 ? 'A Ligar...' : `Ping: ${latencia}ms`}</span></>
              )}
            </div>
            <button className="btn-icon" onClick={toggleFullScreen}><Maximize size={20} /></button>
            <button className="btn-icon" onClick={() => setSomAtivo(!somAtivoState)} style={{ color: somAtivoState ? 'var(--primary)' : 'var(--danger)' }}>
              {somAtivoState ? <Bell size={20} /> : <BellOff size={20} />}
            </button>
            <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)}><Moon size={20} /></button>
          </div>
        </header>

        {/* --- ÁREA DE CONTEÚDO DINÂMICO --- */}
        <main className="content-area">
          {abaAtiva === 'dashboard' && renderDashboard()}
          {abaAtiva === 'motores' && renderPainelSensores('temperatura')}
          {abaAtiva === 'umidade' && renderPainelSensores('umidade')}
          {abaAtiva === 'equipamentos' && renderEquipamentos()}
          {abaAtiva === 'relatorios' && renderRelatorios()}
          {abaAtiva === 'historico' && renderHistorico()}
        </main>
      </div>

      {/* --- MODAL DE EDIÇÃO DE EQUIPAMENTOS --- */}
      {equipEditando && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3><Edit size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Editar Equipamento</h3>
            <form onSubmit={salvarEdicaoEquipamento}>
              <div className="form-grid">
                <div><label>Identificador</label><input type="text" value={formEditEquip.nome} onChange={(e) => setFormEditEquip({ ...formEditEquip, nome: e.target.value })} required disabled={isOffline} /></div>
                <div>
                  <label>Setor</label>
                  <select value={formEditEquip.setor} onChange={(e) => setFormEditEquip({ ...formEditEquip, setor: e.target.value })} required disabled={isOffline}>
                    <option value="">Selecione...</option>
                    <option value="Farmácia / Vacinas">Farmácia / Vacinas</option>
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
                  <select value={formEditEquip.tipo} onChange={(e) => setFormEditEquip({ ...formEditEquip, tipo: e.target.value })} required disabled={isOffline}>
                    <option value="">Selecione...</option>
                    <option value="Câmara Frigorífica">Câmara Frigorífica</option>
                    <option value="Câmara Refrigerada">Câmara Refrigerada</option>
                    <option value="Câmara de Congelados">Câmara de Congelados</option>
                    <option value="Ilha de Congelados">Ilha de Congelados</option>
                    <option value="Balcão Refrigerado Aberto">Balcão Refrigerado Aberto</option>
                    <option value="Balcão Refrigerado com Porta">Balcão Refrigerado com Porta</option>
                    <option value="Arca Horizontal">Arca Horizontal</option>
                  </select>
                </div>
                <div><label>Temp. Min (°C)</label><input type="number" step="0.1" value={formEditEquip.temp_min} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_min: e.target.value })} required disabled={isOffline} /></div>
                <div><label>Temp. Max (°C)</label><input type="number" step="0.1" value={formEditEquip.temp_max} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_max: e.target.value })} required disabled={isOffline} /></div>
                <div><label>Hum. Min (%)</label><input type="number" step="0.1" value={formEditEquip.umidade_min} onChange={(e) => setFormEditEquip({ ...formEditEquip, umidade_min: e.target.value })} disabled={isOffline} /></div>
                <div><label>Hum. Max (%)</label><input type="number" step="0.1" value={formEditEquip.umidade_max} onChange={(e) => setFormEditEquip({ ...formEditEquip, umidade_max: e.target.value })} disabled={isOffline} /></div>
                <div><label>Intervalo de Degelo (H)</label><input type="number" min="1" value={formEditEquip.intervalo_degelo} onChange={(e) => setFormEditEquip({ ...formEditEquip, intervalo_degelo: e.target.value })} required disabled={isOffline} /></div>
                <div><label>Duração Degelo (Min)</label><input type="number" min="1" value={formEditEquip.duracao_degelo} onChange={(e) => setFormEditEquip({ ...formEditEquip, duracao_degelo: e.target.value })} required disabled={isOffline} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEquipEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isOffline}><Save size={18} /> Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL GENÉRICO --- */}
      {modalConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{modalConfig.title}</h3>
            <p>{modalConfig.message}</p>
            {modalConfig.isPrompt && (
              <input 
                type="text" 
                style={{ width: '100%', marginBottom: '1rem' }}
                value={modalConfig.promptValue} 
                onChange={(e) => setModalConfig({...modalConfig, promptValue: e.target.value})} 
                placeholder="Descreva a ação..."
                autoFocus
              />
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setModalConfig({...modalConfig, isOpen: false})}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                modalConfig.onConfirm(modalConfig.promptValue);
                setModalConfig({...modalConfig, isOpen: false});
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}