/**
 * Componente Raiz: TermoSync Enterprise (Web Completa)
 * ATUALIZADO: Filtros de Tela para Técnicos e Períodos ligados visualmente aos cartões de OS.
 */

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
  Info, FileText, PlusCircle, Save, WifiOff, List, Maximize, Calendar, 
  ShieldCheck, Droplets, Wifi, Snowflake, DoorOpen, Clock, ActivitySquare, MapPin,
  ClipboardCheck, Percent, UserCheck, Zap, Leaf, Volume2, VolumeX, Users, UserPlus,
  Wrench, MessageSquarePlus, Store, Wrench as WrenchIcon, Printer, Archive
} from 'lucide-react';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell 
} from 'recharts'; 

const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

const CUSTO_KWH_REAIS = 0.72; 
const FATOR_EMISSAO_CO2 = 0.25; 

const TermoSyncLogo = ({ size = 40, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M10 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 13.5v-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 9a5 5 0 0 1 5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 5a9 9 0 0 1 9 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'LOJA');
  const [userFilial, setUserFilial] = useState(localStorage.getItem('userFilial') || 'Todas');
  
  const [nomeLogado, setNomeLogado] = useState(localStorage.getItem('nomeLogado') || '');
  const [papelLogado, setPapelLogado] = useState(localStorage.getItem('papelLogado') || '');
  const [loginAtivo, setLoginAtivo] = useState(localStorage.getItem('loginAtivo') || '');
  
  const [nomeGerente, setNomeGerente] = useState(localStorage.getItem('nome_gerente') || '');
  const [nomeCoordenador, setNomeCoordenador] = useState(localStorage.getItem('nome_coordenador') || '');
  
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
  
  const [permPush, setPermPush] = useState(Notification.permission);

  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoAlertas, setHistoricoAlertas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);

  const [chamados, setChamados] = useState([]);
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [lojasCadastradas, setLojasCadastradas] = useState([]); 
  const [filiaisDb, setFiliaisDb] = useState([]);
  const [setoresDb, setSetoresDb] = useState([]);
  const [tecnicosDb, setTecnicosDb] = useState([]); 
  
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalLoja, setModalLoja] = useState(false); 
  const [modalChamado, setModalChamado] = useState(false);
  
  const formInicialUsuario = { 
    id: '', usuario: '', senha: '', role: 'LOJA', filial: '', 
    tipo_acesso: 'GERENTE', nome_identidade: ''
  };
  const [formUsuario, setFormUsuario] = useState({ ...formInicialUsuario });

  const formInicialLoja = {
    id: '', nome: '', endereco_loja: '', telefone_loja: '',
    senha: '', usuario_loja: '',
    nome_gerente: '', usuario_gerente: '',
    nome_coordenador: '', usuario_coordenador: ''
  };
  const [formLoja, setFormLoja] = useState({ ...formInicialLoja });

  const [formChamado, setFormChamado] = useState({ equipamento_id: '', descricao: '', solicitante_nome: '', tecnico_responsavel: '' });

  const [filialAtiva, setFilialAtiva] = useState(userRole !== 'LOJA' ? 'Todas' : userFilial);
  const [dataInicio, setDataInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 1)));
  const [dataFim, setDataFim] = useState(new Date());
  
  const [filtroTempoOS, setFiltroTempoOS] = useState('todos');
  const [tecnicoFiltroOS, setTecnicoFiltroOS] = useState('todos'); 

  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [setorFiltroMotores, setSetorFiltroMotores] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [mostrarTabelaBruta, setMostrarTabelaBruta] = useState(false);
  
  const formInicial = { nome: '', tipo: '', temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '', filial: userRole === 'LOJA' ? userFilial : '', data_calibracao: new Date().toISOString().split('T')[0] };
  const [formEquip, setFormEquip] = useState({ ...formInicial });
  const [formEditEquip, setFormEditEquip] = useState({ ...formInicial });
  const [equipEditando, setEquipEditando] = useState(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', onConfirm: null });

  const lastAlertIdRef = useRef(-1);
  const abaAtivaRef = useRef(abaAtiva);

  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);

  const api = useMemo(() => axios.create({ baseURL: API_URL, headers: token ? { Authorization: `Bearer ${token}` } : {} }), [token]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 7000);
  }, []);

  const alternarSom = useCallback(() => {
    const novoEstado = !somAtivoState; setSomAtivoState(novoEstado); somAtivoRef.current = novoEstado;
    if (novoEstado) {
      try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); showToast('Alarmes sonoros ativados.', 'success'); } catch (e) { }
    } else { showToast('Alarmes sonoros silenciados.', 'info'); }
  }, [somAtivoState, showToast]);

  const solicitarPermissaoPush = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(perm => { setPermPush(perm); if (perm === "granted") showToast("Notificações OS ativadas!", "success"); });
    }
  };

  const enviarPushNotificationOS = useCallback((titulo, corpo) => {
    if ("Notification" in window && Notification.permission === "granted") { new Notification(titulo, { body: corpo, icon: '/favicon.ico' }); }
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>null); setIsFullScreen(true); } 
    else { if (document.exitFullscreen) { document.exitFullscreen(); setIsFullScreen(false); } }
  };

  useEffect(() => {
    if (isDarkMode) { document.body.classList.add('dark-theme'); localStorage.setItem('theme', 'dark'); } 
    else { document.body.classList.remove('dark-theme'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); showToast('Ligação restabelecida.', 'success'); carregarDadosBase(); };
    const handleOffline = () => { setIsOffline(true); showToast('Operando offline.', 'warning'); };
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const fazerLogin = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast('Sem ligação à rede.', 'error');
    try {
      const res = await axios.post(`${API_URL}/login`, { usuario, senha });
      setToken(res.data.token); setUserRole(res.data.role); setUserFilial(res.data.filial); setFilialAtiva(res.data.role !== 'LOJA' ? 'Todas' : res.data.filial);
      
      setNomeGerente(res.data.nome_gerente || '');
      setNomeCoordenador(res.data.nome_coordenador || '');
      
      let identityName = usuario;
      let roleTitle = 'Gestor de Loja';

      if (res.data.role === 'ADMIN') { 
        identityName = 'Administrador'; 
        roleTitle = 'Acesso Master'; 
      }
      else if (res.data.role === 'MANUTENCAO') { 
        identityName = res.data.nome_tecnico || 'Técnico'; 
        roleTitle = 'Manutenção Global'; 
      }
      else if (res.data.role === 'LOJA') {
          if (res.data.nome_gerente) { 
            identityName = res.data.nome_gerente; 
            roleTitle = 'Gerente da Loja'; 
          }
          else if (res.data.nome_coordenador) { 
            identityName = res.data.nome_coordenador; 
            roleTitle = 'Coordenador da Loja'; 
          }
          else { 
            identityName = 'Equipa Geral'; 
            roleTitle = 'Acesso da Loja'; 
          }
      }

      setNomeLogado(identityName);
      setPapelLogado(roleTitle);
      setLoginAtivo(usuario);

      localStorage.setItem('token', res.data.token); 
      localStorage.setItem('userRole', res.data.role); 
      localStorage.setItem('userFilial', res.data.filial);
      localStorage.setItem('nome_gerente', res.data.nome_gerente || '');
      localStorage.setItem('nome_coordenador', res.data.nome_coordenador || '');
      localStorage.setItem('nomeLogado', identityName);
      localStorage.setItem('papelLogado', roleTitle);
      localStorage.setItem('loginAtivo', usuario);

      showToast(`Bem-vindo! Acesso: ${identityName}`, 'success');
      
      try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch(e){}
    } catch (error) { showToast('Credenciais incorretas.', 'error'); }
  };

  const fazerLogout = () => { 
    setToken(''); localStorage.clear(); setUserRole('LOJA'); setUserFilial(''); setFilialAtiva('Todas'); 
    setNomeGerente(''); setNomeCoordenador('');
    setNomeLogado(''); setPapelLogado(''); setLoginAtivo('');
  };

  const tocarAlarme = useCallback(() => {
    if (!somAtivoRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const dispararBeep = (atraso) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(800, ctx.currentTime + atraso); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime + atraso); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + atraso + 0.3);
        osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime + atraso); osc.stop(ctx.currentTime + atraso + 0.3);
      };
      dispararBeep(0); dispararBeep(0.2); 
    } catch (e) { }
  }, []);

  const carregarChamados = useCallback(async () => {
    if (!token || isOffline) return;
    try { const res = await api.get('/chamados'); setChamados(res.data); } catch (e) { }
  }, [token, isOffline, api]);

  const carregarUsuarios = useCallback(async () => {
    if (userRole !== 'ADMIN' || !token || isOffline) return;
    try { const res = await api.get('/usuarios'); setUsuariosLista(res.data); } catch (e) {}
  }, [api, userRole, token, isOffline]);

  const carregarLojas = useCallback(async () => {
    if (userRole !== 'ADMIN' || !token || isOffline) return;
    try { const res = await api.get('/lojas'); setLojasCadastradas(res.data); } catch (e) {}
  }, [api, userRole, token, isOffline]);

  const carregarTecnicos = useCallback(async () => {
    if (!token || isOffline) return;
    try { const res = await api.get('/tecnicos'); setTecnicosDb(res.data); } catch (e) {}
  }, [api, token, isOffline]);

  const carregarDadosBase = useCallback(async () => {
    if (!token) return;
    if (isOffline) {
      const cE = localStorage.getItem('cache_equipamentos'); const cN = localStorage.getItem('cache_notificacoes'); const cH = localStorage.getItem('cache_historico');
      if (cE) setEquipamentos(JSON.parse(cE)); if (cN) setNotificacoes(JSON.parse(cN)); if (cH && abaAtiva === 'historico') setHistoricoAlertas(JSON.parse(cH));
      return;
    }
    try {
      const isHistorico = abaAtivaRef.current === 'historico';
      const [resEquip, resNotif, resHist, resFiliais, resSetores] = await Promise.all([
        api.get('/equipamentos'), 
        api.get('/notificacoes'), 
        isHistorico ? api.get('/notificacoes/historico') : Promise.resolve({ data: historicoAlertas }),
        api.get('/auxiliares/filiais').catch(() => ({ data: [] })),
        api.get('/auxiliares/setores').catch(() => ({ data: [] }))
      ]);
      
      setEquipamentos(resEquip.data); 
      setFiliaisDb(resFiliais.data); 
      setSetoresDb(resSetores.data);
      
      if (isHistorico) setHistoricoAlertas(resHist.data);
      
      const idMaisAlto = resNotif.data.length > 0 ? Math.max(...resNotif.data.map(n => n.id)) : 0;
      if (lastAlertIdRef.current !== -1 && idMaisAlto > lastAlertIdRef.current) {
        const novos = resNotif.data.filter(n => n.id > lastAlertIdRef.current);
        if (novos.length > 0) {
          const isDegelo = novos[0].tipo_alerta === 'DEGELO';
          if (somAtivoRef.current && !isDegelo) tocarAlarme();
          showToast(`${isDegelo ? '❄️' : '🚨'} ${novos[0].mensagem}`, isDegelo ? 'info' : 'error');
          if (!isDegelo && somAtivoRef.current) enviarPushNotificationOS('Alerta TermoSync', novos[0].mensagem);
        }
      }
      lastAlertIdRef.current = idMaisAlto; setNotificacoes(resNotif.data);
      localStorage.setItem('cache_equipamentos', JSON.stringify(resEquip.data)); localStorage.setItem('cache_notificacoes', JSON.stringify(resNotif.data));
    } catch (error) { if (error.response?.status === 401) fazerLogout(); }
  }, [token, isOffline, api, tocarAlarme, showToast, enviarPushNotificationOS]); 

  const carregarRelatorios = useCallback(async () => {
    if (!token || isOffline) return;
    try { const res = await api.get(`/relatorios?data_inicio=${dataInicio.toISOString()}&data_fim=${dataFim.toISOString()}`); setRelatorios(res.data); } catch (error) {}
  }, [token, isOffline, api, dataInicio, dataFim]);

  useEffect(() => { if (token) carregarDadosBase(); }, [token, carregarDadosBase]);
  useEffect(() => { if (abaAtiva === 'usuarios' && userRole === 'ADMIN') carregarUsuarios(); }, [abaAtiva, carregarUsuarios, userRole]);
  useEffect(() => { if (abaAtiva === 'lojas' && userRole === 'ADMIN') carregarLojas(); }, [abaAtiva, carregarLojas, userRole]);
  useEffect(() => { if (abaAtiva === 'chamados' || abaAtiva === 'historico_chamados') { carregarChamados(); carregarTecnicos(); } }, [abaAtiva, carregarChamados, carregarTecnicos]); 

  useEffect(() => {
    if (!token || isOffline) return;
    const socket = io(SOCKET_URL);
    socket.on('nova_leitura', (dadosNovaLeitura) => {
      if (abaAtivaRef.current === 'relatorios') { setRelatorios(prev => { const att = [...prev, dadosNovaLeitura]; if (att.length > 20000) att.shift(); return att; }); }
      setEquipamentos(prev => prev.map(eq => String(eq.id) === String(dadosNovaLeitura.equipamento_id) ? { ...eq, ultima_temp: dadosNovaLeitura.temperatura, ultima_umidade: dadosNovaLeitura.umidade, motor_ligado: dadosNovaLeitura.motor_ligado === true || dadosNovaLeitura.motor_ligado == 1, em_degelo: dadosNovaLeitura.em_degelo === true || dadosNovaLeitura.em_degelo == 1 } : eq));
    });
    socket.on('atualizacao_dados', () => { carregarDadosBase(); carregarChamados(); });
    const pingInterval = setInterval(() => { socket.emit('medir_latencia', Date.now(), (e) => setLatencia(Date.now() - e)); }, 2500);
    return () => { clearInterval(pingInterval); socket.disconnect(); };
  }, [token, isOffline, carregarDadosBase, carregarChamados]);

  useEffect(() => { if (token && abaAtiva === 'relatorios') carregarRelatorios(); }, [token, abaAtiva, dataInicio, dataFim, carregarRelatorios]);

  // 🔴 LÓGICA DE FILTRAGEM VISUAL DIRETA PARA OS CARTÕES E PDF
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const chamadosAtivosBrutos = useMemo(() => {
     return chamados.filter(c => c.status !== 'Concluído' || new Date(c.data_conclusao) >= trintaDiasAtras);
  }, [chamados, trintaDiasAtras]);

  const chamadosHistoricoBrutos = useMemo(() => {
     return chamados.filter(c => c.status === 'Concluído' && new Date(c.data_conclusao) < trintaDiasAtras);
  }, [chamados, trintaDiasAtras]);

  // Processa a lista ATIVA
  const chamadosAtivosFiltrados = useMemo(() => {
    let list = chamadosAtivosBrutos;

    // Filtro de Loja/Filial (Apenas para o ADMIN que usar o filtro global da barra lateral)
    if (userRole === 'ADMIN' && filialAtiva !== 'Todas') {
       list = list.filter(c => c.filial === filialAtiva);
    }

    // Filtro do Técnico selecionado no dropdown da página
    if (userRole === 'MANUTENCAO') {
       list = list.filter(c => c.tecnico_responsavel === nomeLogado);
    } else if (tecnicoFiltroOS !== 'todos') {
       list = list.filter(c => c.tecnico_responsavel === tecnicoFiltroOS);
    }

    // Filtro de Tempo selecionado no dropdown da página
    const hoje = new Date();
    if (filtroTempoOS === 'dia') {
       list = list.filter(c => new Date(c.data_abertura).toDateString() === hoje.toDateString() || (c.data_conclusao && new Date(c.data_conclusao).toDateString() === hoje.toDateString()));
    } else if (filtroTempoOS === 'semana') {
       const seteDias = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
       list = list.filter(c => new Date(c.data_abertura) >= seteDias || (c.data_conclusao && new Date(c.data_conclusao) >= seteDias));
    } else if (filtroTempoOS === 'mes') {
       const mesAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
       list = list.filter(c => new Date(c.data_abertura) >= mesAtras || (c.data_conclusao && new Date(c.data_conclusao) >= mesAtras));
    }

    return list;
  }, [chamadosAtivosBrutos, filialAtiva, userRole, nomeLogado, tecnicoFiltroOS, filtroTempoOS]);

  // Processa a lista HISTÓRICA
  const chamadosHistoricoFiltrados = useMemo(() => {
    let list = chamadosHistoricoBrutos;

    // Filtro de Loja/Filial
    if (userRole === 'ADMIN' && filialAtiva !== 'Todas') {
       list = list.filter(c => c.filial === filialAtiva);
    }

    // Filtro do Técnico
    if (userRole === 'MANUTENCAO') {
       list = list.filter(c => c.tecnico_responsavel === nomeLogado);
    } else if (tecnicoFiltroOS !== 'todos') {
       list = list.filter(c => c.tecnico_responsavel === tecnicoFiltroOS);
    }

    return list;
  }, [chamadosHistoricoBrutos, filialAtiva, userRole, nomeLogado, tecnicoFiltroOS]);


  const gerarLoteOS = (listaParaImprimir) => {
    if (listaParaImprimir.length === 0) {
      return showToast("Não há Ordens de Serviço concluídas para os filtros selecionados.", "warning");
    }

    const doc = new jsPDF();
    let currentY = 20;

    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text("LIVRO DE ORDENS DE SERVIÇO (OS) - ARQUIVO", 105, currentY, { align: "center" });
    currentY += 15;
    
    listaParaImprimir.forEach((chamado) => {
      if (currentY > 210) { doc.addPage(); currentY = 20; }

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`OS #${chamado.id} - ${chamado.filial} | ${chamado.equipamento_nome}`, 14, currentY);
      currentY += 6;
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(`Endereço: ${chamado.loja_endereco || 'N/A'}  |  Tel: ${chamado.loja_telefone || 'N/A'}`, 14, currentY);
      currentY += 5;
      
      doc.text(`Abertura: ${new Date(chamado.data_abertura).toLocaleDateString()}  |  Conclusão: ${new Date(chamado.data_conclusao).toLocaleDateString()}`, 14, currentY);
      currentY += 5;

      doc.text(`Solicitante: ${chamado.solicitante_nome}  |  Técnico: ${chamado.tecnico_responsavel || 'N/A'}`, 14, currentY);
      currentY += 7;

      doc.setFont(undefined, 'bold');
      doc.text("Problema:", 14, currentY);
      doc.setFont(undefined, 'normal');
      const splitDesc = doc.splitTextToSize(chamado.descricao, 180);
      doc.text(splitDesc, 14, currentY + 5);
      currentY += 5 + (splitDesc.length * 4) + 2;
      
      doc.setFont(undefined, 'bold');
      doc.text("Relatório Técnico:", 14, currentY);
      doc.setFont(undefined, 'normal');
      const splitRes = doc.splitTextToSize(chamado.nota_resolucao, 180);
      doc.text(splitRes, 14, currentY + 5);
      currentY += 5 + (splitRes.length * 4) + 12; 
      
      doc.line(20, currentY, 80, currentY);
      doc.text(`Assinatura (${chamado.tecnico_responsavel || 'Técnico'})`, 25, currentY + 5);
      
      doc.line(110, currentY, 190, currentY);
      doc.text("Assinatura (Gerência / Responsável)", 115, currentY + 5);
      
      currentY += 15;
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, currentY, 196, currentY);
      doc.setDrawColor(0, 0, 0);
      currentY += 10;
    });
    
    const prefixo = userRole === 'MANUTENCAO' ? `OS_${nomeLogado.replace(/\s+/g, '')}` : `OS_Lote_Global`;
    doc.save(`${prefixo}_Arquivo.pdf`);
    
    showToast(`Livro PDF gerado contendo ${listaParaImprimir.length} Ordens de Serviço!`, 'success');
  };

  const salvarLoja = async (e) => {
    e.preventDefault();
    try {
      if (formLoja.id) {
        await api.put(`/lojas/${formLoja.id}`, { nome: formLoja.nome, endereco_loja: formLoja.endereco_loja, telefone_loja: formLoja.telefone_loja });
        showToast('Loja atualizada (Efeito Dominó aplicado aos acessos e equipamentos!)', 'success');
      } else {
        if (!formLoja.nome) return showToast('O nome da loja é obrigatório.', 'error');
        await api.post('/lojas', { nome: formLoja.nome, endereco_loja: formLoja.endereco_loja, telefone_loja: formLoja.telefone_loja });
        showToast('Loja cadastrada com sucesso!', 'success');
      }
      setModalLoja(false);
      carregarLojas();
      carregarDadosBase(); 
    } catch(err) { showToast('Erro. Verifique se o nome da loja já existe.', 'error'); }
  };

  const pedirExclusaoLoja = (id, nome) => {
    setModalConfig({ isOpen: true, title: 'Remover Loja', message: `Remover a "${nome}" permanentemente? TODOS os utilizadores e equipamentos desta loja serão apagados.`, isPrompt: false, onConfirm: async () => {
      try { await api.delete(`/lojas/${id}`); showToast('Loja removida.', 'success'); carregarLojas(); carregarDadosBase(); } catch (e) { showToast('Erro ao remover.', 'error'); }
    }});
  };

  const abrirModalUsuario = (tipoAcesso) => {
    let roleTarget = 'LOJA';
    if (tipoAcesso === 'TECNICO') roleTarget = 'MANUTENCAO';
    if (tipoAcesso === 'OUTROS') roleTarget = 'ADMIN';

    setFormUsuario({ 
      id: '', usuario: '', senha: '', 
      role: roleTarget, filial: '', 
      tipo_acesso: tipoAcesso, nome_identidade: '' 
    });
    setModalUsuario(true);
  };

  const salvarUsuario = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        usuario: formUsuario.usuario,
        senha: formUsuario.senha,
        role: formUsuario.role,
        filial: formUsuario.role !== 'LOJA' ? 'Todas' : formUsuario.filial,
        nome_gerente: formUsuario.tipo_acesso === 'GERENTE' ? formUsuario.nome_identidade : null,
        nome_coordenador: formUsuario.tipo_acesso === 'COORDENADOR' ? formUsuario.nome_identidade : null,
        nome_tecnico: formUsuario.tipo_acesso === 'TECNICO' ? formUsuario.nome_identidade : null
      };

      if (formUsuario.id) {
        await api.put(`/usuarios/${formUsuario.id}`, payload); 
        showToast('Credencial atualizada.', 'success'); 
      } else { 
        if (!formUsuario.senha) return showToast('A palavra-passe é obrigatória.', 'error'); 
        await api.post('/usuarios', payload); 
        showToast('Nova conta registada.', 'success'); 
      }
      setModalUsuario(false); 
      carregarUsuarios();
    } catch (error) { 
      showToast('Erro ao guardar (Login já existe).', 'error'); 
    }
  };

  const pedirExclusaoUsuario = (id, nome) => {
    setModalConfig({ isOpen: true, title: 'Remover Conta', message: `Remover o acesso de "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => {
      try { await api.delete(`/usuarios/${id}`); showToast('Acesso removido.', 'success'); carregarUsuarios(); } catch (e) { showToast('Erro ao remover.', 'error'); }
    }});
  };

  const aplicarFiltroRapido = (horas) => { const agora = new Date(); setDataFim(agora); setDataInicio(new Date(agora.getTime() - (horas * 60 * 60 * 1000))); };

  const aplicarNormaANVISA = (setor, tipo, setFormAction) => {
    let tMin = '', tMax = '', uMin = '', uMax = '';
    if (setor === 'Farmácia / Vacinas' || setor === 'Farmácia') {
      if (tipo.includes('Congelados')) { tMin = -25; tMax = -15; uMin = 35; uMax = 60; } else { tMin = 2; tMax = 8; uMin = 35; uMax = 65; }
    } else {
      if (tipo.includes('Congelados') || tipo.includes('Arca')) { tMin = -24; tMax = -18; uMin = 60; uMax = 80; } 
      else if (setor === 'Açougue') { tMin = 0; tMax = 4; uMin = 85; uMax = 95; } 
      else if (setor === 'FLV') { tMin = 8; tMax = 12; uMin = 85; uMax = 95; } 
      else { tMin = 0; tMax = 8; uMin = 60; uMax = 85; }
    }
    setFormAction(prev => ({ ...prev, temp_min: tMin, temp_max: tMax, umidade_min: uMin, umidade_max: uMax, intervalo_degelo: 6, duracao_degelo: 30 }));
    showToast('Regulamentação Aplicada.', 'info');
  };

  const salvarNovoEquipamento = async (e) => {
    e.preventDefault(); if (isOffline) return showToast('Ação bloqueada.', 'warning');
    const dadosFinais = { ...formEquip, filial: userRole === 'LOJA' ? userFilial : formEquip.filial };
    try { await api.post('/equipamentos', dadosFinais); showToast('Hardware registado.', 'success'); setFormEquip({ ...formInicial, filial: userRole === 'LOJA' ? userFilial : '' }); carregarDadosBase(); } 
    catch (e) { showToast('Erro de gravação.', 'error'); }
  };

  const editarEquipamento = (eq) => {
    if (isOffline) return showToast('Ação bloqueada.', 'warning');
    setEquipEditando(eq.id);
    setFormEditEquip({ 
        nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min || '', 
        umidade_max: eq.umidade_max || '', intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, 
        setor: eq.setor, filial: eq.filial, data_calibracao: eq.data_calibracao ? new Date(eq.data_calibracao).toISOString().split('T')[0] : ''
    });
  };

  const salvarEdicaoEquipamento = async (e) => {
    e.preventDefault(); if (isOffline) return;
    try { await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip); showToast('Atualizado.', 'success'); setEquipEditando(null); carregarDadosBase(); } 
    catch (e) { showToast('Erro.', 'error'); }
  };

  const pedirExclusao = (id, nome) => {
    setModalConfig({ isOpen: true, title: 'Remover Máquina', message: `Remover "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => {
      try { await api.delete(`/equipamentos/${id}`); showToast('Removido.', 'success'); carregarDadosBase(); } catch (e) { showToast('Ação não autorizada.', 'error'); }
    }});
  };

  const pedirNotaResolucao = (id) => {
    setModalConfig({ isOpen: true, title: 'Registo de Manutenção', message: 'Descreva a intervenção técnica:', isPrompt: true, promptValue: '', onConfirm: async (nota) => {
      try { await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: nota.trim() === '' ? 'Verificado e limpo.' : nota }); showToast('Arquivado no log.', 'success'); } 
      catch (e) { showToast('Erro.', 'error'); }
    }});
  };

  const resolverTodasNotificacoes = () => {
    setModalConfig({ isOpen: true, title: 'Limpeza do Painel', message: 'Arquivar todos os alarmes pendentes?', isPrompt: false, onConfirm: async () => {
      try { await api.put(`/notificacoes/resolver-todas`); showToast('Painel Limpo.', 'success'); } catch (e) { showToast('Erro.', 'error'); }
    }});
  };

  const gerarExportacao = (tipo) => {
    let fd = abaAtiva === 'historico' ? historicoFiltradoLista : (equipamentoFiltro ? relatorios.filter(r => r.nome === equipamentoFiltro) : relatorios);
    if (fd.length === 0) return showToast("Sem dados.", "warning");

    if (tipo === 'pdf') {
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text(abaAtiva === 'historico' ? "Auditoria de Ocorrências" : "Auditoria de Qualidade e ESG", 14, 20);
      doc.setFontSize(11); doc.text(`Emitido: ${new Date().toLocaleString()} | Âmbito: ${filialAtiva}`, 14, 28);
      
      let head = abaAtiva === 'historico' ? [["Data", "Equipamento", "Ocorrência", "Técnico Responsável"]] : [["Data", "Local / Eq.", "Temp", "Hum", "Consumo"]];
      let body = abaAtiva === 'historico' 
            ? fd.map(h => [new Date(h.data_hora).toLocaleString(), `${h.equipamento_nome}`, h.mensagem, h.nota_resolucao]) 
            : fd.map(r => [new Date(r.data_hora).toLocaleString(), `${r.filial} - ${r.nome}`, `${r.temperatura}°C`, `${r.umidade}%`, `${r.consumo_kwh}kWh`]);
      
      autoTable(doc, { head, body, startY: 40, theme: 'grid', headStyles: { fillColor: [5, 150, 105] } });
      const finalY = doc.lastAutoTable.finalY || 40; doc.text("__________________________________________", 14, finalY + 30); doc.text(`Assinatura do Auditor - (${userRole})`, 14, finalY + 38);
      doc.save(`Auditoria_${new Date().getTime()}.pdf`);
    } else {
      let csv = abaAtiva === 'historico' ? "Data,Equipamento,Setor,Ocorrencia,Tecnico\n" : "Data,Filial,Equipamento,Temp,Hum,Consumo(kWh)\n";
      fd.forEach(row => { csv += abaAtiva === 'historico' ? `"${new Date(row.data_hora).toLocaleString()}","${row.equipamento_nome}","${row.setor}","${row.mensagem}","${row.nota_resolucao}"\n` : `"${new Date(row.data_hora).toLocaleString()}","${row.filial}","${row.nome}","${row.temperatura}","${row.umidade}","${row.consumo_kwh}"\n`; });
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv' }));
      link.download = `Dados_${new Date().getTime()}.csv`; link.click();
    }
    showToast('Documento Gerado.', 'success');
  };

  const listaFiliais = useMemo(() => {
    if (userRole === 'LOJA') return [userFilial];
    return ['Todas', ...filiaisDb];
  }, [filiaisDb, userRole, userFilial]);

  const equipamentosDaFilial = useMemo(() => filialAtiva === 'Todas' ? equipamentos : equipamentos.filter(eq => (eq.filial || 'Loja Principal') === filialAtiva), [equipamentos, filialAtiva]);
  const notificacoesDaFilial = useMemo(() => filialAtiva === 'Todas' ? notificacoes : notificacoes.filter(n => (n.filial || 'Loja Principal') === filialAtiva), [notificacoes, filialAtiva]);

  const { qtdTotal, qtdDegelo, qtdFalha, qtdOperando } = useMemo(() => {
    const total = equipamentosDaFilial.length; const degelo = equipamentosDaFilial.filter(e => e.em_degelo).length; const falha = equipamentosDaFilial.filter(e => !e.motor_ligado && !e.em_degelo).length;
    return { qtdTotal: total, qtdDegelo: degelo, qtdFalha: falha, qtdOperando: total - degelo - falha };
  }, [equipamentosDaFilial]);

  const eqPesquisaLower = termoPesquisa.toLowerCase();
  const equipamentosFiltradosLista = useMemo(() => equipamentosDaFilial.filter(eq => eq.nome.toLowerCase().includes(eqPesquisaLower) || (eq.setor && eq.setor.toLowerCase().includes(eqPesquisaLower))), [equipamentosDaFilial, eqPesquisaLower]);
  
  const historicoFiltradoLista = useMemo(() => {
    let hist = filialAtiva === 'Todas' ? historicoAlertas : historicoAlertas.filter(h => (h.filial || 'Loja Principal') === filialAtiva);
    return hist.filter(h => h.equipamento_nome.toLowerCase().includes(eqPesquisaLower) || (h.setor && h.setor.toLowerCase().includes(eqPesquisaLower)));
  }, [historicoAlertas, filialAtiva, eqPesquisaLower]);

  const equipamentosFiltradosMotores = useMemo(() => setorFiltroMotores ? equipamentosDaFilial.filter(eq => eq.setor === setorFiltroMotores) : equipamentosDaFilial, [equipamentosDaFilial, setorFiltroMotores]);
  
  const dadosRelatorioBrutos = useMemo(() => {
    let r = filialAtiva === 'Todas' ? relatorios : relatorios.filter(x => (x.filial || 'Loja Principal') === filialAtiva);
    return r.filter(x => equipamentoFiltro === '' || x.nome === equipamentoFiltro);
  }, [relatorios, filialAtiva, equipamentoFiltro]);
  
  const dadosGrafico = useMemo(() => dadosRelatorioBrutos.map(r => ({ hora: new Date(r.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dataExata: new Date(r.data_hora).toLocaleString(), temperatura: parseFloat(r.temperatura), umidade: parseFloat(r.umidade || 0), consumo_kwh: parseFloat(r.consumo_kwh || 0), nome: r.nome, filial: r.filial || 'Loja Principal' })), [dadosRelatorioBrutos]);
  const dadosGraficoFiltrados = useMemo(() => { if (dadosGrafico.length <= 200) return dadosGrafico; return dadosGrafico.filter((_, idx) => idx % Math.ceil(dadosGrafico.length / 200) === 0); }, [dadosGrafico]);
  const ultimasLeiturasRaw = useMemo(() => [...dadosGrafico].reverse().slice(0, 150), [dadosGrafico]);

  const { kpis, slaCompliance, totalEnergia } = useMemo(() => {
    let kpiMaxT = -Infinity, kpiMinT = Infinity, kpiMaxU = -Infinity, kpiMinU = Infinity, somaUmid = 0, countUmid = 0, somaTemp = 0, leiturasNoLimite = 0, somaKwh = 0;
    
    dadosGrafico.forEach(d => {
      if (d.temperatura > kpiMaxT) kpiMaxT = d.temperatura; if (d.temperatura < kpiMinT) kpiMinT = d.temperatura; somaTemp += d.temperatura;
      if (d.umidade > 0) { if (d.umidade > kpiMaxU) kpiMaxU = d.umidade; if (d.umidade < kpiMinU) kpiMinU = d.umidade; somaUmid += d.umidade; countUmid++; }
      somaKwh += d.consumo_kwh;
      const eqRef = equipamentos.find(e => e.nome === d.nome);
      if (eqRef && d.temperatura >= eqRef.temp_min && d.temperatura <= eqRef.temp_max) leiturasNoLimite++;
    });

    const sla = dadosGrafico.length > 0 ? ((leiturasNoLimite / dadosGrafico.length) * 100).toFixed(1) : '--';
    return {
      kpis: {
        kpiMaxT: kpiMaxT === -Infinity ? '--' : kpiMaxT, kpiMinT: kpiMinT === Infinity ? '--' : kpiMinT, kpiMediaT: dadosGrafico.length > 0 ? (somaTemp / dadosGrafico.length).toFixed(2) : '--',
        kpiMaxU: kpiMaxU === -Infinity ? '--' : kpiMaxU, kpiMinU: kpiMinU === Infinity ? '--' : kpiMinU, kpiMediaU: countUmid > 0 ? (somaUmid / countUmid).toFixed(1) : '--'
      }, 
      slaCompliance: sla,
      totalEnergia: somaKwh
    };
  }, [dadosGrafico, equipamentos]);

  const mktValueProcessado = useMemo(() => {
    const arr = dadosRelatorioBrutos.map(d => parseFloat(d.temperatura));
    if (arr.length === 0) return '--';
    let soma = 0; arr.forEach(t => soma += Math.exp(-83.144 / (0.0083144 * (t + 273.15))));
    return ((83.144 / 0.0083144) / (-Math.log(soma / arr.length)) - 273.15).toFixed(2);
  }, [dadosRelatorioBrutos]);

  const equipamentoSelecionado = useMemo(() => equipamentosDaFilial.find(e => e.nome === equipamentoFiltro), [equipamentosDaFilial, equipamentoFiltro]);

  const dadosDonutStatus = useMemo(() => [
    { name: 'Ok', value: qtdOperando, color: 'var(--success)' }, { name: 'Degelo', value: qtdDegelo, color: '#38bdf8' }, { name: 'Falha', value: qtdFalha, color: 'var(--danger)' }
  ].filter(d => d.value > 0), [qtdOperando, qtdDegelo, qtdFalha]);

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box stagger-1">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}><div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '1.2rem', borderRadius: '50%', marginBottom: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}><TermoSyncLogo size={56} color="var(--primary)" /></div><h2 style={{ color: 'white' }}>TermoSync</h2><p style={{ color: 'rgba(255,255,255,0.8)' }}>Corporate Platform ESG</p></div>
          <form onSubmit={fazerLogin}>
            <div className="login-input-group stagger-2"><label style={{ color: 'white' }}>Credencial de Acesso</label><input type="text" placeholder="Ex: admin_master ou gerente" value={usuario} onChange={(e) => setUsuario(e.target.value)} required /></div>
            <div className="login-input-group stagger-3"><label style={{ color: 'white' }}>Palavra-passe</label><input type="password" placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
            <button type="submit" className="btn btn-primary w-100 login-btn stagger-4" disabled={isOffline} style={{ background: 'white', color: 'var(--primary)' }}>{isOffline ? 'Gateway Offline' : 'Autenticar'}</button>
          </form>
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="anim-fade-in">
      <div className="dashboard-grid stagger-1">
        <div className="summary-cards" style={{ margin: 0 }}>
          <div className="summary-card"><span className="summary-title">Parque IoT</span><span className="summary-value">{qtdTotal}</span></div>
          <div className="summary-card"><span className="summary-title">Operação Segura</span><span className="summary-value val-green">{qtdOperando}</span></div>
          <div className="summary-card"><span className="summary-title">Modo Degelo</span><span className="summary-value val-blue">{qtdDegelo}</span></div>
          <div className="summary-card"><span className="summary-title">Anomalias Ativas</span><span className={`summary-value val-red ${notificacoesDaFilial.length > 0 ? 'pulse-danger' : ''}`} style={{ borderRadius: '50%', display: 'inline-block', width: 'fit-content' }}>{qtdFalha}</span></div>
        </div>
        <div className="donut-container">
          <span className="donut-title">Eficiência e Saúde do Frio</span>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={dadosDonutStatus} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{dadosDonutStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none' }} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex-header stagger-2">
        <h3>Painel Operacional e Triagem</h3>
        {notificacoesDaFilial.length > 0 && (<div className="action-group"><button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={resolverTodasNotificacoes} disabled={isOffline}><CheckCircle size={18}/> Arquivar Todos</button></div>)}
      </div>
      
      {notificacoesDaFilial.length === 0 ? (
        <div className="empty-state stagger-3"><CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} /><h3 style={{ margin: 0, color: 'var(--text-main)' }}>Plataforma Limpa</h3><p>Temperatura, rede e metrologia dentro dos conformes legais.</p></div>
      ) : (
        <div className="grid-cards stagger-3">
          {notificacoesDaFilial.map(notif => {
            const isRede = notif.tipo_alerta === 'REDE'; const isDegelo = notif.tipo_alerta === 'DEGELO'; const isMecanica = notif.tipo_alerta === 'MECANICA'; const isPorta = notif.tipo_alerta === 'PORTA'; const isPreditivo = notif.tipo_alerta === 'PREDITIVO'; const isMetrologia = notif.tipo_alerta === 'METROLOGIA';
            let IconCmp = AlertTriangle; let colorTheme = 'var(--danger)';
            if (isRede) { IconCmp = Wifi; colorTheme = 'var(--warning)'; } 
            else if (isDegelo) { IconCmp = Snowflake; colorTheme = 'var(--info)'; } 
            else if (isMecanica) { IconCmp = Power; colorTheme = '#f97316'; }
            else if (isPorta) { IconCmp = DoorOpen; colorTheme = '#e11d48'; }
            else if (isPreditivo) { IconCmp = ActivitySquare; colorTheme = '#8b5cf6'; } 
            else if (isMetrologia) { IconCmp = ClipboardCheck; colorTheme = '#6366f1'; } 

            return (
              <div key={notif.id} className={`card card-alert ${!isDegelo && !isRede && !isPreditivo && !isMetrologia ? 'pulse-danger' : ''}`} style={{ borderColor: colorTheme, backgroundColor: (isPreditivo || isMetrologia) ? 'rgba(139, 92, 246, 0.05)' : undefined }}>
                <div className="card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IconCmp size={24} color={colorTheme} /><span style={{ fontWeight: '800', fontSize: '1.1rem', color: colorTheme }}>{notif.equipamento_nome}</span></div>
                  <span className="time-badge" style={{ color: colorTheme, backgroundColor: isDegelo ? 'rgba(56, 189, 248, 0.1)' : undefined }}>{new Date(notif.data_hora).toLocaleTimeString()}</span>
                </div>
                <span className="badge-setor">{notif.filial} | {notif.setor}</span>
                <p className="alert-msg">{notif.mensagem}</p>
                <button className="btn btn-primary w-100" onClick={() => pedirNotaResolucao(notif.id)} disabled={isOffline} style={(isDegelo || isMecanica || isPorta || isPreditivo || isMetrologia) ? { backgroundColor: colorTheme, color: '#fff', borderColor: colorTheme } : {}}>
                  {isDegelo ? 'Ocultar Degelo' : (isMecanica ? 'Assinalar Manutenção' : (isPorta ? 'Fechar Porta Física' : (isMetrologia ? 'Arquivar Notificação' : 'Resolver Anomalia')))}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderSensores = (isTemp) => (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isTemp ? <Thermometer size={24} color="var(--primary)"/> : <Droplets size={24} color="var(--info)" />} 
          {isTemp ? 'Câmaras e Ilhas Frigoríficas' : 'Gestão de Humidade (HACCP)'}
        </h3>
        <div className="action-group">
          <select className="select-input" value={setorFiltroMotores} onChange={(e) => setSetorFiltroMotores(e.target.value)}>
            <option value="">Setores (Todos)</option>
            {setoresDb.map(setor => <option key={setor} value={setor}>{setor}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-cards stagger-2">
        {equipamentosFiltradosMotores.map(eq => {
          const valor = isTemp ? eq.ultima_temp : eq.ultima_umidade; const min = isTemp ? eq.temp_min : (eq.umidade_min || 40); const max = isTemp ? eq.temp_max : (eq.umidade_max || 60);
          const isAlta = valor > max; const isBaixa = valor < min; const isAnomalia = (isAlta || isBaixa) && !eq.em_degelo;
          let percent = ((valor || min) - min) / (max - min) * 100; if(percent > 100) percent=100; if(percent<5) percent=5;
          let barColor = isTemp ? 'var(--success)' : 'var(--info)'; if (isAnomalia) barColor = isTemp ? 'var(--danger)' : 'var(--warning)'; if (eq.em_degelo) barColor = 'var(--info)';

          return (
            <div key={eq.id} className={`card ${isAnomalia ? 'card-danger-border pulse-danger' : (eq.em_degelo ? 'card-info-border' : (isTemp && eq.motor_ligado ? 'card-success-border' : 'card-info-border'))}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem' }}>{eq.nome}</h3></div>
              <span className="badge-setor">{userRole !== 'LOJA' ? `${eq.filial} | ` : ''}{eq.setor}</span>
              <div className={`status-box ${eq.em_degelo && isTemp ? 'status-defrost' : (isAnomalia && !isTemp ? '' : (isTemp && !eq.motor_ligado ? 'status-off' : 'status-on'))}`} style={{ marginTop: '15px', backgroundColor: !isTemp ? (isAnomalia ? 'var(--warning)' : 'var(--info)') : undefined }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {isTemp ? <Power size={20} /> : <Droplets size={20} />}
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '1px' }}>{isTemp ? (eq.em_degelo ? 'DEGELO' : (eq.motor_ligado ? 'LIGADO' : 'PARADO')) : (isAlta ? 'HÚMIDO' : (isBaixa ? 'SECO' : 'ESTÁVEL'))}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>{min}{isTemp?'°C':'%'} a {max}{isTemp?'°C':'%'}</span>
                  </div>
                  <div className="thermal-bar-bg" style={{ backgroundColor: !isTemp ? 'rgba(0,0,0,0.2)' : undefined }}><div className="thermal-bar-fill" style={{ width: `${percent}%`, backgroundColor: !isTemp ? '#fff' : barColor }}></div></div>
                </div>
                <div className="temp-display" style={{ background: !isTemp ? 'rgba(0,0,0,0.15)' : undefined }}>
                  <span>Sensor</span><h2 style={{ color: (isAnomalia && isTemp) ? '#ffcccc' : 'white' }}>{valor ? `${valor}${isTemp?' °C':'%'}` : '--'}</h2>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
      
      <datalist id="filiais-db">{filiaisDb.map(f => <option key={f} value={f} />)}</datalist>
      <datalist id="setores-db">{setoresDb.map(s => <option key={s} value={s} />)}</datalist>

      {toast.show && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 99999, backgroundColor: toast.type === 'error' ? '#ef4444' : (toast.type === 'info' ? '#38bdf8' : '#10b981'), color: '#ffffff', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '400px', borderLeft: '4px solid rgba(255,255,255,0.5)', animation: 'slideIn 0.4s ease-out' }}>
          {toast.type === 'success' ? <CheckCircle size={26} /> : (toast.type === 'error' ? <AlertTriangle size={26} /> : <Info size={26} />)}
          <span style={{ fontWeight: '600', fontSize: '0.95rem', lineHeight: '1.4' }}>{toast.message}</span>
        </div>
      )}

      <div className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '4px', display: 'flex' }}>
            <TermoSyncLogo size={24} color="var(--primary)" />
          </div>
          <h2>TermoSync</h2>
          <button className="mobile-close" onClick={() => setMenuAberto(false)}><X size={24} color="white" /></button>
        </div>
        
        <div style={{ padding: '0 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>
            {nomeLogado ? nomeLogado.charAt(0) : (loginAtivo ? loginAtivo.charAt(0) : 'U')}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nomeLogado || loginAtivo || 'Utilizador'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: '600' }}>
              @{loginAtivo} • {papelLogado}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '5px', textTransform: 'uppercase' }}>
              {userRole !== 'LOJA' ? <><MapPin size={14}/> Rede de Lojas</> : <><UserCheck size={14}/> Acesso Local</>}
            </div>
            {userRole !== 'LOJA' ? (
              <select className="select-input" value={filialAtiva} onChange={(e) => setFilialAtiva(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                  {listaFiliais.map(f => <option key={f} value={f} style={{ color: 'black' }}>{f === 'Todas' ? 'Visão Global Integrada' : f}</option>)}
              </select>
            ) : (
              <div style={{ width: '100%', padding: '8px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: '0.9rem' }}>
                {userFilial}
              </div>
            )}
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => { setAbaAtiva('dashboard'); setMenuAberto(false); }}><Activity size={20} /> Painel Central {notificacoesDaFilial.length > 0 && <span className="badge">{notificacoesDaFilial.length}</span>}</button>
          <button className={`nav-item ${abaAtiva === 'motores' ? 'active' : ''}`} onClick={() => { setAbaAtiva('motores'); setMenuAberto(false); }}><Thermometer size={20} /> Monitorização Térmica</button>
          <button className={`nav-item ${abaAtiva === 'umidade' ? 'active' : ''}`} onClick={() => { setAbaAtiva('umidade'); setMenuAberto(false); }}><Droplets size={20} /> Monitorização Humidade</button>
          <button className={`nav-item ${abaAtiva === 'equipamentos' ? 'active' : ''}`} onClick={() => { setAbaAtiva('equipamentos'); setMenuAberto(false); }}><Settings size={20} /> Metrologia & Instalações</button>
          <button className={`nav-item ${abaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('relatorios'); setMenuAberto(false); }}><Leaf size={20} /> Sustentabilidade e ESG</button>
          <button className={`nav-item ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => { setAbaAtiva('historico'); setMenuAberto(false); }}><History size={20} /> Auditoria RDC (Logs)</button>
          
          <button className={`nav-item ${abaAtiva === 'chamados' ? 'active' : ''}`} onClick={() => { setAbaAtiva('chamados'); setMenuAberto(false); }}><Wrench size={20} /> Chamados Técnicos</button>
          <button className={`nav-item ${abaAtiva === 'historico_chamados' ? 'active' : ''}`} onClick={() => { setAbaAtiva('historico_chamados'); setMenuAberto(false); }}><Archive size={20} /> Histórico de Chamados</button>

          {userRole === 'ADMIN' && (
             <>
               <button className={`nav-item ${abaAtiva === 'lojas' ? 'active' : ''}`} onClick={() => { setAbaAtiva('lojas'); setMenuAberto(false); }}><Store size={20} /> Informações da Loja</button>
               <button className={`nav-item ${abaAtiva === 'usuarios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('usuarios'); setMenuAberto(false); }}><Users size={20} /> Gestão de Acessos</button>
             </>
          )}
        </nav>
        <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}><button className="btn btn-outline w-100" style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }} onClick={fazerLogout}><LogOut size={18} style={{ marginRight: '8px' }} /> Encerrar Sessão</button></div>
      </div>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      <div className="main-content">
        <header className="header">
          <button className="menu-btn" onClick={() => setMenuAberto(true)}><Menu size={24} /></button>
          <h2 className="page-title">
             {abaAtiva === 'dashboard' ? 'Centro de Operações' : 
              abaAtiva === 'relatorios' ? 'Inteligência e Sustentabilidade' : 
              abaAtiva === 'usuarios' ? 'Administração de Acessos' : 
              abaAtiva === 'lojas' ? 'Cadastro de Lojas' :
              abaAtiva === 'chamados' ? 'Manutenção Corretiva' : 
              abaAtiva === 'historico_chamados' ? 'Histórico de Manutenções Antigas' : 'Gestão Comercial'}
          </h2>
          <div className="user-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-color)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              {isOffline ? <><span className="status-dot" style={{ backgroundColor: 'var(--danger)' }}></span><span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--danger)' }}>Offline</span></> : <><span className={`status-dot ${notificacoesDaFilial.length > 0 ? 'pulse-danger' : ''}`} style={{ backgroundColor: latencia === 0 ? 'var(--text-muted)' : (latencia < 80 ? 'var(--success)' : 'var(--warning)') }}></span><span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>{latencia === 0 ? 'Ligando...' : `Latência: ${latencia}ms`}</span></>}
            </div>
            <button className="btn-icon" onClick={alternarSom} title="Ligar/Desligar Alarmes" style={{ color: somAtivoState ? 'var(--primary)' : 'var(--text-muted)' }}>{somAtivoState ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
            <button className="btn-icon" onClick={solicitarPermissaoPush} title="Permitir Push Nativos" style={{ color: permPush === 'granted' ? 'var(--success)' : 'var(--warning)' }}>{permPush === 'granted' ? <Bell size={20} /> : <BellOff size={20} />}</button>
            <button className="btn-icon" onClick={toggleFullScreen}><Maximize size={20} /></button>
            <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)}><Moon size={20} /></button>
          </div>
        </header>

        <main className="content-area">
          {abaAtiva === 'dashboard' && renderDashboard()}
          {abaAtiva === 'motores' && renderSensores(true)}
          {abaAtiva === 'umidade' && renderSensores(false)}
          
          {abaAtiva === 'chamados' && (
            <div className="anim-fade-in stagger-1">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Central de Chamados Técnicos</h3>
                <div className="action-group">
                  
                  {userRole !== 'MANUTENCAO' && (
                    <select 
                      className="select-input" 
                      value={tecnicoFiltroOS} 
                      onChange={e => setTecnicoFiltroOS(e.target.value)}
                      style={{ minWidth: '150px' }}
                    >
                      <option value="todos">Todos os Técnicos</option>
                      {tecnicosDb.map(tec => (
                        <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>
                      ))}
                    </select>
                  )}

                  <select 
                    className="select-input" 
                    value={filtroTempoOS} 
                    onChange={e => setFiltroTempoOS(e.target.value)}
                    style={{ minWidth: '150px' }}
                  >
                    <option value="todos">Todo o Período</option>
                    <option value="dia">Apenas de Hoje</option>
                    <option value="semana">Últimos 7 dias</option>
                    <option value="mes">Últimos 30 dias</option>
                  </select>

                  <button 
                    className="btn btn-outline" 
                    style={{ borderColor: '#3b82f6', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.05)' }} 
                    onClick={() => gerarLoteOS(chamadosAtivosFiltrados.filter(c => c.status === 'Concluído'))}
                  >
                    <Printer size={18} /> Imprimir OS ({chamadosAtivosFiltrados.filter(c => c.status === 'Concluído').length})
                  </button>

                  {userRole !== 'MANUTENCAO' && (
                    <button className="btn btn-primary" onClick={() => {
                      if (equipamentosDaFilial.length === 0) {
                        return showToast("Não existem equipamentos nesta unidade para abrir um chamado.", "warning");
                      }
                      
                      let solicitanteAuto = 'Equipa da Loja';
                      if (userRole === 'ADMIN') solicitanteAuto = 'Administração Central';
                      else if (nomeGerente) solicitanteAuto = `Gerente - ${nomeGerente}`;
                      else if (nomeCoordenador) solicitanteAuto = `Coordenador - ${nomeCoordenador}`;
                      
                      setFormChamado({ equipamento_id: equipamentosDaFilial[0].id, descricao: '', solicitante_nome: solicitanteAuto, tecnico_responsavel: '' });
                      setModalChamado(true);
                    }}>
                      <MessageSquarePlus size={18} /> Abrir Solicitação
                    </button>
                  )}
                </div>
              </div>

              {chamadosAtivosFiltrados.length === 0 ? (
                <div className="empty-state" style={{ marginTop: '2rem' }}>
                  <CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Sem Ocorrências Encontradas</h3>
                  <p>Não há chamados técnicos pendentes para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
                  {chamadosAtivosFiltrados.map(c => (
                    <div key={c.id} className="card" style={{ borderLeft: `6px solid ${
                      c.status === 'Concluído' ? 'var(--success)' : 
                      (c.urgencia === 'Crítica' || c.urgencia === 'Alta' ? 'var(--danger)' : 'var(--warning)')
                    }` }}>
                      <div className="card-top">
                        <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{c.equipamento_nome}</div>
                        <span className="badge-setor">{c.status}</span>
                      </div>
                      <p style={{ fontSize: '0.95rem', margin: '15px 0', fontWeight: '500' }}>"{c.descricao}"</p>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Loja: <strong>{c.filial}</strong> | Solicitante: <strong>{c.solicitante_nome || c.aberto_por}</strong>
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: 5, fontWeight: 'bold' }}>
                        Técnico Acionado: {c.tecnico_responsavel || 'Manutenção Geral'}
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 5 }}>
                        Urgência definida: <strong style={{ color: c.urgencia === 'Crítica' || c.urgencia === 'Alta' ? 'var(--danger)' : 'var(--warning)' }}>{c.urgencia}</strong>
                      </div>
                      
                      {c.status === 'Concluído' && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}>
                          <strong>Nota de Resolução:</strong> {c.nota_resolucao}
                          <div style={{ fontSize: '0.7rem', color: 'gray', marginTop: '4px' }}>Concluído em: {new Date(c.data_conclusao).toLocaleDateString()}</div>
                        </div>
                      )}

                      {userRole === 'ADMIN' && c.status !== 'Concluído' && (
                        <div style={{ marginTop: '15px' }}>
                          <select 
                            className="select-input" 
                            style={{ fontSize: '0.8rem', padding: '8px', width: '100%' }}
                            value={c.urgencia}
                            onChange={(e) => api.put(`/chamados/${c.id}/urgencia`, { urgencia: e.target.value }).then(carregarChamados)}
                          >
                            <option value="Pendente">Urgência: Pendente...</option>
                            <option value="Baixa">Baixa</option>
                            <option value="Média">Média</option>
                            <option value="Alta">Alta</option>
                            <option value="Crítica">Crítica (Imediato)</option>
                          </select>
                        </div>
                      )}

                      {(userRole === 'ADMIN' || userRole === 'MANUTENCAO') && c.status !== 'Concluído' && (
                        <button 
                          className="btn btn-outline w-100" 
                          style={{ marginTop: '10px', borderColor: 'var(--success)', color: 'var(--success)' }}
                          onClick={() => {
                            const nota = prompt("Escreva a Nota de Resolução do reparo:");
                            if (nota) {
                              api.put(`/chamados/${c.id}/status`, { status: 'Concluído', nota_resolucao: nota })
                                .then(() => { showToast('Chamado concluído!', 'success'); carregarChamados(); });
                            }
                          }}
                        >
                          <CheckCircle size={16} /> Marcar como Corrigido
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'historico_chamados' && (
            <div className="anim-fade-in stagger-1">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Histórico de OS Antigas (+30 dias)</h3>
                <div className="action-group">
                  
                  {userRole !== 'MANUTENCAO' && (
                    <select 
                      className="select-input" 
                      value={tecnicoFiltroOS} 
                      onChange={e => setTecnicoFiltroOS(e.target.value)}
                      style={{ minWidth: '150px' }}
                    >
                      <option value="todos">Todos os Técnicos</option>
                      {tecnicosDb.map(tec => (
                        <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>
                      ))}
                    </select>
                  )}

                  <button 
                    className="btn btn-outline" 
                    style={{ borderColor: '#3b82f6', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.05)' }} 
                    onClick={() => gerarLoteOS(chamadosHistoricoFiltrados)}
                  >
                    <Printer size={18} /> Imprimir OS Antigas ({chamadosHistoricoFiltrados.length})
                  </button>

                </div>
              </div>

              {chamadosHistoricoFiltrados.length === 0 ? (
                <div className="empty-state" style={{ marginTop: '2rem' }}>
                  <Archive size={56} color="gray" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Histórico Vazio</h3>
                  <p>Não há Ordens de Serviço antigas com estes filtros.</p>
                </div>
              ) : (
                <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
                  {chamadosHistoricoFiltrados.map(c => (
                    <div key={c.id} className="card" style={{ borderLeft: '6px solid gray', opacity: 0.85 }}>
                      <div className="card-top">
                        <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{c.equipamento_nome}</div>
                        <span className="badge-setor" style={{ background: 'gray', color: 'white' }}>Arquivado</span>
                      </div>
                      <p style={{ fontSize: '0.95rem', margin: '15px 0', fontWeight: '500' }}>"{c.descricao}"</p>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Loja: <strong>{c.filial}</strong> | Solicitante: <strong>{c.solicitante_nome || c.aberto_por}</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 5, fontWeight: 'bold' }}>
                        Técnico: {c.tecnico_responsavel || 'Manutenção Geral'}
                      </div>
                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <strong>Resolução Histórica:</strong> {c.nota_resolucao}
                        <div style={{ fontSize: '0.7rem', color: 'gray', marginTop: '4px' }}>Data: {new Date(c.data_conclusao).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {abaAtiva === 'equipamentos' && (
            <div className="anim-fade-in stagger-1">
              <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><PlusCircle size={20} color="var(--primary)" /> Registo de Sensor IoT</h3>
                  <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderColor: 'var(--info)', color: 'var(--info)' }} onClick={() => aplicarNormaANVISA(formEquip.setor, formEquip.tipo, setFormEquip)} disabled={!formEquip.setor || !formEquip.tipo || isOffline}><ShieldCheck size={16} /> Preencher Padrão Legal</button>
                </div>
                <form onSubmit={salvarNovoEquipamento}>
                  <div className="form-grid">
                    <div><label>Identificador Máquina</label><input type="text" value={formEquip.nome} onChange={(e) => setFormEquip({ ...formEquip, nome: e.target.value })} required /></div>
                    
                    <div>
                        <label>Filial / Loja Física</label>
                        <select 
                           className="select-input"
                           value={formEquip.filial} 
                           onChange={(e) => setFormEquip({ ...formEquip, filial: e.target.value })} 
                           required 
                           disabled={userRole === 'LOJA'} 
                           style={{ backgroundColor: userRole === 'LOJA' ? 'var(--bg-color)' : undefined }} 
                        >
                          <option value="">Selecione...</option>
                          {filiaisDb.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>

                    <div>
                        <label>Setor Comercial</label>
                        <input 
                           list="setores-db"
                           type="text" 
                           placeholder="Selecione ou digite novo..." 
                           value={formEquip.setor} 
                           onChange={(e) => setFormEquip({ ...formEquip, setor: e.target.value })} 
                           required 
                        />
                    </div>
                    
                    <div><label>Tipo de Refrigeração</label><select value={formEquip.tipo} onChange={(e) => setFormEquip({ ...formEquip, tipo: e.target.value })} required><option value="">Selecione...</option><option value="Câmara Frigorífica">Câmara</option><option value="Ilha de Congelados">Ilha (-18°C)</option><option value="Balcão Refrigerado Aberto">Balcão Aberto</option></select></div>
                    <div><label>Data Calibração Oficial</label><input type="date" value={formEquip.data_calibracao} onChange={(e) => setFormEquip({ ...formEquip, data_calibracao: e.target.value })} required /></div>
                    <div><label>Degelo Automático (Horas)</label><input type="number" min="1" value={formEquip.intervalo_degelo} onChange={(e) => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required /></div>
                    <div><label>Temperatura Mín (°C)</label><input type="number" step="0.1" value={formEquip.temp_min} onChange={(e) => setFormEquip({ ...formEquip, temp_min: e.target.value })} required /></div>
                    <div><label>Temperatura Máx (°C)</label><input type="number" step="0.1" value={formEquip.temp_max} onChange={(e) => setFormEquip({ ...formEquip, temp_max: e.target.value })} required /></div>
                    <div><label>Humidade Mín (%)</label><input type="number" step="0.1" value={formEquip.umidade_min} onChange={(e) => setFormEquip({ ...formEquip, umidade_min: e.target.value })} /></div>
                    <div><label>Humidade Máx (%)</label><input type="number" step="0.1" value={formEquip.umidade_max} onChange={(e) => setFormEquip({ ...formEquip, umidade_max: e.target.value })} /></div>
                  </div>
                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="btn btn-primary" disabled={isOffline}><PlusCircle size={18} /> Adicionar Máquina</button></div>
                </form>
              </div>
              <div className="card table-responsive stagger-2">
                <table className="table">
                  <thead><tr><th>Loja</th><th>Identificador</th><th>Metrologia</th><th>SLA Físico (Min/Max)</th><th>Gerir</th></tr></thead>
                  <tbody>
                    {equipamentosFiltradosLista.map(eq => {
                       const diasCalib = eq.data_calibracao ? Math.floor((Date.now() - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                       const calibCritica = diasCalib > 365;
                       return (
                        <tr key={eq.id}>
                          <td data-label="Loja"><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', marginRight: '5px', backgroundColor: eq.em_degelo ? '#38bdf8' : (eq.motor_ligado ? 'var(--success)' : 'var(--danger)')}}></span> <strong>{eq.filial}</strong></td>
                          <td data-label="Identificador"><strong>{eq.nome}</strong><br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.tipo} | {eq.setor}</span></td>
                          <td data-label="Calibração"><div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: calibCritica ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>{calibCritica ? <AlertTriangle size={16}/> : <ClipboardCheck size={16}/>} Certificado há {diasCalib} dias</div></td>
                          <td data-label="Limites">{eq.temp_min}°C a {eq.temp_max}°C <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.umidade_min || 40}% a {eq.umidade_max || 80}% (Hum)</span></td>
                          <td data-label="Gerir"><button className="btn btn-outline" style={{ padding: '0.5rem', marginRight: '5px' }} onClick={() => editarEquipamento(eq)} disabled={isOffline}><Edit size={16} /></button><button className="btn btn-outline" style={{ padding: '0.5rem', color: isOffline ? 'gray' : 'var(--danger)', borderColor: isOffline ? 'gray' : 'var(--danger)' }} onClick={() => pedirExclusao(eq.id, eq.nome)} disabled={isOffline}><X size={16} /></button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {abaAtiva === 'relatorios' && (
            <div className="anim-fade-in stagger-1">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="card pulse-danger" style={{ padding: '1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', animationDuration: '4s' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Leaf size={18} /> Métrica ESG: Pegada de Carbono</h4>
                      <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#10b981' }}>{(totalEnergia * FATOR_EMISSAO_CO2).toFixed(1)} <span style={{fontSize: '1rem', color:'var(--text-muted)'}}>kg CO2</span></div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Impacto ambiental derivado do consumo elétrico.</div>
                  </div>

                  <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Zap size={18} /> Custo Estimado (ESG)</h4>
                      <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#f59e0b' }}>
                          <span style={{fontSize: '1.5rem'}}>R$ </span>{(totalEnergia * CUSTO_KWH_REAIS).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Baseado em {(totalEnergia).toFixed(0)} kWh medidos.</div>
                  </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Percent size={18} /> Compliance Score (SLA)</h4>
                      <div style={{ fontSize: '3.5rem', fontWeight: '900', color: parseFloat(slaCompliance) >= 99 ? 'var(--success)' : (parseFloat(slaCompliance) > 90 ? 'var(--warning)' : 'var(--danger)') }}>
                        {slaCompliance}%
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tempo de operação dentro da norma ideal.</div>
                  </div>

                  <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Thermometer size={16} /> Fator Térmico / MKT</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
                          <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mínima</div><div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--success)' }}>{kpis.kpiMinT}°C</div></div>
                          <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Média</div><div style={{ fontSize: '1.2rem', fontWeight: '800' }}>{kpis.kpiMediaT}°C</div></div>
                          <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Máxima</div><div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--danger)' }}>{kpis.kpiMaxT}°C</div></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '5px' }}>
                          <div style={{ textAlign: 'left' }}><div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)' }}>Temp. Cinética Média</div></div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)', background: 'var(--bg-color)', padding: '5px 15px', borderRadius: '8px' }}>{mktValueProcessado}°C</div>
                      </div>
                  </div>
              </div>

              <div className="flex-header stagger-2">
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => aplicarFiltroRapido(1)}><Clock size={14}/> 1h</button>
                  <button className="btn btn-outline" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => aplicarFiltroRapido(12)}><Clock size={14}/> 12h</button>
                  <button className="btn btn-outline" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => aplicarFiltroRapido(24)}><Clock size={14}/> 24h</button>
                </div>
                <div className="action-group">
                  <div className="date-filter-group"><DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} selectsStart startDate={dataInicio} endDate={dataFim} disabled={isOffline} /><span className="date-separator">até</span><DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} selectsEnd startDate={dataInicio} endDate={dataFim} minDate={dataInicio} disabled={isOffline} /></div>
                  <select className="select-input" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)} style={{maxWidth: '200px'}}><option value="">Geral da Loja</option>{equipamentosDaFilial.map(eq => <option key={eq.id} value={eq.nome}>{eq.nome}</option>)}</select>
                  <button className="btn btn-outline" onClick={() => gerarExportacao('csv')}><Download size={18} /></button>
                  <button className="btn btn-danger" onClick={() => gerarExportacao('pdf')}><FileText size={18} /></button>
                </div>
              </div>

              <div className="chart-container stagger-3" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosGraficoFiltrados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e5e7eb'} vertical={false} />
                    <XAxis dataKey="hora" stroke={isDarkMode ? '#94a3b8' : '#6b7280'} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" stroke="var(--primary)" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} label={{ value: 'Consumo kWh', angle: 90, position: 'insideRight', fill: '#f59e0b' }} />
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
                    {equipamentoSelecionado && <ReferenceLine yAxisId="left" y={equipamentoSelecionado.temp_max} stroke="var(--danger)" strokeDasharray="4 4" />}
                    <Area isAnimationActive={false} yAxisId="left" type="monotone" dataKey="temperatura" name="Temp (°C)" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} activeDot={{ r: 4 }} />
                    <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="consumo_kwh" name="Consumo (kWh)" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              <div style={{ marginTop: '1.5rem' }} className="stagger-4">
                  <button className="btn btn-outline w-100" onClick={() => setMostrarTabelaBruta(!mostrarTabelaBruta)} style={{ background: 'var(--card-bg)', borderStyle: 'dashed' }}>
                    <List size={18} /> {mostrarTabelaBruta ? 'Esconder Matriz Bruta' : 'Ver Matriz de Dados p/ Auditores (Telemetria + ESG)'}
                  </button>
                  {mostrarTabelaBruta && (
                    <div className="card table-responsive" style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="table">
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-color)', zIndex: 1 }}>
                          <tr><th>Data/Hora</th><th>Localização / Máquina</th><th>Sensor Térmico (°C)</th><th>Energia Injetada (kWh)</th></tr>
                        </thead>
                        <tbody>
                          {ultimasLeiturasRaw.map((dado, index) => {
                              const eqRef = equipamentosDaFilial.find(e => e.nome === dado.nome);
                              const isTempAlerta = eqRef && dado.temperatura > eqRef.temp_max;
                              return (
                                <tr key={index}>
                                  <td data-label="Data/Hora" style={{ fontSize: '0.9rem' }}>{dado.dataExata}</td>
                                  <td data-label="Localização" style={{ fontWeight: '600' }}>{dado.filial} - {dado.nome}</td>
                                  <td data-label="Temp (°C)" style={{ fontWeight: '800', color: isTempAlerta ? 'var(--danger)' : 'var(--primary)' }}>{dado.temperatura} °C</td>
                                  <td data-label="Consumo kWh" style={{ fontWeight: '800', color: '#f59e0b' }}>{dado.consumo_kwh} kWh <Zap size={14} style={{ verticalAlign: 'middle' }}/></td>
                                </tr>
                              )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </div>
          )}

          {abaAtiva === 'historico' && (
            <div className="anim-fade-in stagger-1">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Livro de Registo Oficial</h3>
                <div className="action-group">
                  <button className="btn btn-danger" onClick={() => gerarExportacao('pdf')}><FileText size={18} /> Exportar Log Auditável</button>
                </div>
              </div>
              <div className="card" style={{ marginTop: '1rem', padding: '2rem' }}>
                <div className="timeline-container">
                  {historicoFiltradoLista.map((hist, index) => (
                    <div key={hist.id} className="timeline-item stagger-2" style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="timeline-marker"></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-date"><Calendar size={16} /> {new Date(hist.data_hora).toLocaleString()}</span>
                          <span className="badge-setor" style={{ margin: 0 }}>{hist.filial} | {hist.setor}</span>
                        </div>
                        <div className="timeline-body">
                          <p style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>{hist.equipamento_nome}</p>
                          <p style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={16} /> {hist.mensagem}</p>
                        </div>
                        <div className="timeline-action">
                          <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', opacity: 0.8 }}>Relatório Técnico Assinado:</p>
                          <p>{hist.nota_resolucao}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'lojas' && userRole === 'ADMIN' && (
            <div className="anim-fade-in stagger-1">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Informações e Cadastro de Lojas</h3>
                <button className="btn btn-primary" onClick={() => { setFormLoja({...formInicialLoja}); setModalLoja(true); }}>
                  <Store size={18} /> Nova Loja
                </button>
              </div>

              <div className="card table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="table">
                  <thead>
                    <tr><th>Loja / Filial</th><th>Gerente e Coordenador</th><th>Endereço e Contato</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {lojasCadastradas.map(l => (
                      <tr key={l.id}>
                        <td data-label="Loja"><strong>{l.nome}</strong></td>
                        <td data-label="Gestão">
                          <span style={{fontSize: '0.8rem', color: 'var(--primary)'}}><strong>G:</strong> {l.nome_gerente || 'Não definido'}</span><br/>
                          <span style={{fontSize: '0.8rem', color: 'var(--info)'}}><strong>C:</strong> {l.nome_coordenador || 'Não definido'}</span>
                        </td>
                        <td data-label="Contato">
                          <span style={{fontSize: '0.85rem'}}>{l.endereco || '-'}</span><br/>
                          <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{l.telefone || '-'}</span>
                        </td>
                        <td data-label="Ações">
                          <button className="btn btn-outline" style={{ padding: '0.5rem', marginRight: '5px' }} onClick={() => { 
                            setFormLoja({ 
                              id: l.id, nome: l.nome, endereco_loja: l.endereco || '', telefone_loja: l.telefone || ''
                            }); 
                            setModalLoja(true); 
                          }}>
                            <Edit size={16} />
                          </button>
                          <button className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => pedirExclusaoLoja(l.id, l.nome)}>
                            <X size={16} />
                          </button>
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
                        <div>
                          <label>Nome da Loja / Filial</label>
                          <input type="text" placeholder="Ex: Loja Marília Sul" value={formLoja.nome} onChange={(e) => setFormLoja({...formLoja, nome: e.target.value})} required />
                        </div>
                        <div>
                          <label>Endereço Completo</label>
                          <input type="text" placeholder="Ex: Rua Direita, 123" value={formLoja.endereco_loja} onChange={(e) => setFormLoja({...formLoja, endereco_loja: e.target.value})} />
                        </div>
                        <div>
                          <label>Telefone Comercial</label>
                          <input type="text" placeholder="Ex: (14) 99999-9999" value={formLoja.telefone_loja} onChange={(e) => setFormLoja({...formLoja, telefone_loja: e.target.value})} />
                        </div>
                      </div>
                      <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                        <button type="button" className="btn btn-outline" onClick={() => setModalLoja(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary"><Save size={18}/> Salvar Loja</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'usuarios' && userRole === 'ADMIN' && (
            <div className="anim-fade-in stagger-1">
              <div className="flex-header">
                <h3 style={{ margin: 0 }}>Gestão de Acessos</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => abrirModalUsuario('GERENTE')}>
                    <UserPlus size={16} /> Novo Gerente
                  </button>
                  <button className="btn btn-info" style={{ backgroundColor: '#38bdf8', color: 'white', borderColor: '#38bdf8' }} onClick={() => abrirModalUsuario('COORDENADOR')}>
                    <UserPlus size={16} /> Novo Coordenador
                  </button>
                  <button className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={() => abrirModalUsuario('TECNICO')}>
                    <WrenchIcon size={16} /> Novo Técnico
                  </button>
                  <button className="btn btn-outline" onClick={() => abrirModalUsuario('OUTROS')}>
                    <Settings size={16} /> Admin
                  </button>
                </div>
              </div>

              <div className="card table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="table">
                  <thead>
                    <tr><th>Credencial (Login)</th><th>Nível de Acesso</th><th>Filial / Âmbito</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {usuariosLista.map(u => {
                      let displayIdentity = 'Acesso Loja Geral';
                      let tipoAcessoReal = 'GERAL';
                      
                      if (u.role === 'ADMIN') {
                        displayIdentity = '';
                        tipoAcessoReal = 'OUTROS';
                      } else if (u.role === 'MANUTENCAO') {
                        displayIdentity = `Identidade: ${u.nome_tecnico || 'Técnico Geral'}`;
                        tipoAcessoReal = 'TECNICO';
                      } else if (u.nome_gerente) {
                        displayIdentity = `Identidade: Gerente (${u.nome_gerente})`;
                        tipoAcessoReal = 'GERENTE';
                      } else if (u.nome_coordenador) {
                        displayIdentity = `Identidade: Coordenador (${u.nome_coordenador})`;
                        tipoAcessoReal = 'COORDENADOR';
                      }

                      return (
                        <tr key={u.id}>
                          <td data-label="Credencial">
                            <strong>{u.usuario}</strong><br/>
                            {displayIdentity && <span style={{fontSize:'0.75rem', color:'gray'}}>{displayIdentity}</span>}
                          </td>
                          <td data-label="Permissão">
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: u.role === 'ADMIN' ? 'var(--danger)' : (u.role === 'MANUTENCAO' ? 'var(--primary)' : 'var(--info)'), color: '#fff' }}>
                              {u.role === 'ADMIN' ? 'Admin Master' : (u.role === 'MANUTENCAO' ? 'Manutenção Global' : 'Gestor de Loja')}
                            </span>
                          </td>
                          <td data-label="Âmbito">{u.filial}</td>
                          <td data-label="Ações">
                            <button className="btn btn-outline" style={{ padding: '0.5rem', marginRight: '5px' }} onClick={() => { 
                              setFormUsuario({ 
                                id: u.id, usuario: u.usuario, senha: '', role: u.role, filial: u.filial, 
                                tipo_acesso: tipoAcessoReal,
                                nome_identidade: u.nome_gerente || u.nome_coordenador || u.nome_tecnico || '' 
                              }); 
                              setModalUsuario(true); 
                            }}>
                              <Edit size={16} />
                            </button>
                            <button className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => pedirExclusaoUsuario(u.id, u.usuario)}>
                              <X size={16} />
                            </button>
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
                      <h3 style={{ margin: 0 }}>
                        {formUsuario.id ? 'Editar Acesso' : 
                         formUsuario.tipo_acesso === 'GERENTE' ? 'Cadastrar Gerente' : 
                         formUsuario.tipo_acesso === 'COORDENADOR' ? 'Cadastrar Coordenador' : 
                         formUsuario.tipo_acesso === 'TECNICO' ? 'Cadastrar Técnico' : 'Cadastrar Acesso Admin'}
                      </h3>
                    </div>

                    <form onSubmit={salvarUsuario}>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        
                        {(formUsuario.tipo_acesso === 'GERENTE' || formUsuario.tipo_acesso === 'COORDENADOR') ? (
                          <>
                            <div>
                              <label>Nome Completo do {formUsuario.tipo_acesso === 'GERENTE' ? 'Gerente' : 'Coordenador'}</label>
                              <input type="text" placeholder="Ex: João Silva" value={formUsuario.nome_identidade} onChange={e => setFormUsuario({...formUsuario, nome_identidade: e.target.value})} required />
                            </div>
                            <div>
                              <label>Login (Usuário)</label>
                              <input type="text" placeholder={`Ex: ${formUsuario.tipo_acesso === 'GERENTE' ? 'gerente' : 'coord'}_loja`} value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} required />
                            </div>
                            <div>
                              <label>Palavra-passe {formUsuario.id && <span style={{fontSize:'0.7rem', color:'gray'}}>(Em branco para manter)</span>}</label>
                              <input type="password" placeholder="••••••••" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} />
                            </div>
                            <div>
                              <label>Vincular à Loja</label>
                              <select className="select-input" value={formUsuario.filial} onChange={e => setFormUsuario({...formUsuario, filial: e.target.value})} required style={{width: '100%', padding: '10px'}}>
                                <option value="">Selecione a Loja...</option>
                                {filiaisDb.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>
                          </>
                        ) : formUsuario.tipo_acesso === 'TECNICO' ? (
                          <>
                            <div>
                              <label>Nome Real do Técnico</label>
                              <input type="text" placeholder="Ex: Roberto Almeida" value={formUsuario.nome_identidade} onChange={e => setFormUsuario({...formUsuario, nome_identidade: e.target.value})} required />
                            </div>
                            <div>
                              <label>Login (Usuário)</label>
                              <input type="text" placeholder="Ex: tecnico_roberto" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} required />
                            </div>
                            <div>
                              <label>Palavra-passe {formUsuario.id && <span style={{fontSize:'0.7rem', color:'gray'}}>(Em branco para manter)</span>}</label>
                              <input type="password" placeholder="••••••••" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} />
                            </div>
                            <div style={{ padding: '10px', backgroundColor: 'rgba(5, 150, 105, 0.1)', borderRadius: '8px' }}>
                               <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Técnicos têm acesso global a todas as lojas.</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label>Nível de Permissão</label>
                              <select className="select-input" style={{width: '100%', padding: '10px'}} value={formUsuario.role} onChange={(e) => setFormUsuario({...formUsuario, role: e.target.value})} required disabled={!!formUsuario.id}>
                                <option value="ADMIN">Administrador (Master)</option>
                              </select>
                            </div>
                            <div>
                              <label>Login (Usuário)</label>
                              <input type="text" value={formUsuario.usuario} onChange={e => setFormUsuario({...formUsuario, usuario: e.target.value})} required />
                            </div>
                            <div>
                              <label>Palavra-passe {formUsuario.id && <span style={{fontSize:'0.7rem', color:'gray'}}>(Em branco para manter)</span>}</label>
                              <input type="password" placeholder="••••••••" value={formUsuario.senha} onChange={e => setFormUsuario({...formUsuario, senha: e.target.value})} required={!formUsuario.id} />
                            </div>
                          </>
                        )}
                      </div>
                      <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                        <button type="button" className="btn btn-outline" onClick={() => setModalUsuario(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary"><Save size={18}/> Salvar</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🔴 MODAL PARA ABRIR O CHAMADO TÉCNICO */}
          {modalChamado && (
            <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
              <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
                <h3><WrenchIcon size={20} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--primary)' }}/> Nova Ordem de Serviço</h3>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (isOffline) return showToast('Ação bloqueada enquanto estiver offline.', 'warning');
                  if (!formChamado.equipamento_id) return showToast('Selecione um equipamento.', 'error');
                  
                  try {
                    await api.post('/chamados', formChamado);
                    showToast('Chamado técnico aberto com sucesso!', 'success');
                    setModalChamado(false);
                    carregarChamados();
                  } catch (err) {
                    showToast('Erro ao abrir o chamado.', 'error');
                  }
                }}>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div>
                      <label>Máquina / Equipamento com Avaria</label>
                      <select className="select-input" value={formChamado.equipamento_id} onChange={e => setFormChamado({...formChamado, equipamento_id: e.target.value})} required style={{ width: '100%' }}>
                        <option value="">Selecione o equipamento...</option>
                        {equipamentosDaFilial.map(eq => (
                          <option key={eq.id} value={eq.id}>
                            {userRole === 'ADMIN' ? `[${eq.filial}] ` : ''}{eq.nome} - {eq.setor}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label>Descrição do Problema Encontrado</label>
                      <textarea 
                         className="input" 
                         rows="4" 
                         placeholder="Ex: O compressor está a fazer um ruído estranho e a temperatura não baixa..." 
                         value={formChamado.descricao} 
                         onChange={e => setFormChamado({...formChamado, descricao: e.target.value})} 
                         required 
                         style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', resize: 'vertical' }} 
                      />
                    </div>

                    <div>
                      <label>Nome do Solicitante (Automático)</label>
                      <input 
                         type="text" 
                         value={formChamado.solicitante_nome} 
                         readOnly 
                         style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }} 
                      />
                    </div>
                    
                    <div>
                      <label>Atribuir a um Técnico Específico (Opcional)</label>
                      <select className="select-input" value={formChamado.tecnico_responsavel} onChange={e => setFormChamado({...formChamado, tecnico_responsavel: e.target.value})} style={{ width: '100%' }}>
                        <option value="">Deixar em aberto para qualquer técnico</option>
                        {tecnicosDb.map(t => <option key={t.id} value={t.nome_tecnico}>{t.nome_tecnico}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setModalChamado(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary"><Save size={18}/> Submeter OS</button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>

      {equipEditando && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%' }}>
            <h3><Edit size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Editar Ativo IoT</h3>
            <form onSubmit={salvarEdicaoEquipamento}>
              <div className="form-grid">
                <div><label>Identificador Máquina</label><input type="text" value={formEditEquip.nome} onChange={(e) => setFormEditEquip({ ...formEditEquip, nome: e.target.value })} required disabled={isOffline} /></div>
                
                <div>
                  <label>Filial Física</label>
                  <select 
                     className="select-input"
                     value={formEditEquip.filial} 
                     onChange={(e) => setFormEditEquip({ ...formEditEquip, filial: e.target.value })} 
                     required 
                     disabled={userRole === 'LOJA' || isOffline} 
                     style={{ backgroundColor: userRole === 'LOJA' ? 'var(--bg-color)' : undefined }} 
                  >
                    <option value="">Selecione...</option>
                    {filiaisDb.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label>Setor Comercial</label>
                  <input 
                     list="setores-db"
                     type="text" 
                     value={formEditEquip.setor} 
                     onChange={(e) => setFormEditEquip({ ...formEditEquip, setor: e.target.value })} 
                     required 
                     disabled={isOffline} 
                  />
                </div>

                <div><label>Tipo</label><select value={formEditEquip.tipo} onChange={(e) => setFormEditEquip({ ...formEditEquip, tipo: e.target.value })} required disabled={isOffline}><option value="Câmara Frigorífica">Câmara Frigorífica</option><option value="Ilha de Congelados">Ilha de Congelados</option><option value="Balcão Refrigerado Aberto">Balcão Refrigerado Aberto</option></select></div>
                <div><label>Data Calibração Oficial</label><input type="date" value={formEditEquip.data_calibracao} onChange={(e) => setFormEditEquip({ ...formEditEquip, data_calibracao: e.target.value })} required disabled={isOffline} /></div>
                <div><label>Degelo Automático (H)</label><input type="number" min="1" value={formEditEquip.intervalo_degelo} onChange={(e) => setFormEditEquip({ ...formEditEquip, intervalo_degelo: e.target.value })} required disabled={isOffline} /></div>
                <div><label>Temp. Min (°C)</label><input type="number" step="0.1" value={formEditEquip.temp_min} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_min: e.target.value })} required disabled={isOffline} /></div>
                <div><label>Temp. Max (°C)</label><input type="number" step="0.1" value={formEditEquip.temp_max} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_max: e.target.value })} required disabled={isOffline} /></div>
              </div>
              <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setEquipEditando(null)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={isOffline}><Save size={18} /> Guardar Perfil</button></div>
            </form>
          </div>
        </div>
      )}

      {modalConfig.isOpen && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '400px' }}>
            <h3>{modalConfig.title}</h3><p>{modalConfig.message}</p>
            {modalConfig.isPrompt && (<input type="text" style={{ width: '100%', marginBottom: '1rem' }} value={modalConfig.promptValue} onChange={(e) => setModalConfig({...modalConfig, promptValue: e.target.value})} placeholder="Insira o relatório da intervenção..." autoFocus />)}
            <div className="modal-actions"><button className="btn btn-outline" onClick={() => setModalConfig({...modalConfig, isOpen: false})}>Cancelar</button><button className="btn btn-primary" onClick={() => { modalConfig.onConfirm(modalConfig.promptValue); setModalConfig({...modalConfig, isOpen: false}); }}>Confirmar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}