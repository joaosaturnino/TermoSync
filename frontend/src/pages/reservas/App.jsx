/**
 * O ORQUESTRADOR: App.jsx (Pós-Refatoração)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';

import { Activity, Thermometer, Droplets, Settings, Leaf, History, Wrench, Archive, Store, Sliders, Users, LogOut, Menu, X, Volume2, VolumeX, Bell, BellOff, Maximize, Moon, MapPin, UserCheck, CheckCircle, AlertTriangle, Info, Edit, Save } from 'lucide-react';

import TermoSyncLogo from './components/TermoSyncLogo';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Monitoramento from './pages/Monitoramento';
import Equipamentos from './pages/Equipamentos';
import Relatorios from './pages/Relatorios';
import HistoricoLogs from './pages/HistoricoLogs';
import Chamados from './pages/Chamados';
import HistoricoChamados from './pages/HistoricoChamados';
import GestaoLojas from './pages/GestaoLojas';
import GestaoUsuarios from './pages/GestaoUsuarios';
import ParametrosGlobais from './pages/ParametrosGlobais';

const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'LOJA');
  const [userFilial, setUserFilial] = useState(localStorage.getItem('userFilial') || 'Todas');
  const [nomeLogado, setNomeLogado] = useState(localStorage.getItem('nomeLogado') || '');
  const [papelLogado, setPapelLogado] = useState(localStorage.getItem('papelLogado') || '');
  const [loginAtivo, setLoginAtivo] = useState(localStorage.getItem('loginAtivo') || '');
  const [nomeGerente, setNomeGerente] = useState(localStorage.getItem('nome_gerente') || '');
  const [nomeCoordenador, setNomeCoordenador] = useState(localStorage.getItem('nome_coordenador') || '');
  
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false); 
  const [loginErro, setLoginErro] = useState(''); 
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
  const [tecnicosDb, setTecnicosDb] = useState([]); 
  const [listaSetores, setListaSetores] = useState([]);
  const [listaTipos, setListaTipos] = useState([]);

  const [filialAtiva, setFilialAtiva] = useState(userRole !== 'LOJA' ? 'Todas' : userFilial);
  const [dataInicio, setDataInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 1)));
  const [dataFim, setDataFim] = useState(new Date());
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  
  const [formEditEquip, setFormEditEquip] = useState({});
  const [equipEditando, setEquipEditando] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', onConfirm: null });

  const lastAlertIdRef = useRef(-1);
  const abaAtivaRef = useRef(abaAtiva);
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);

  const api = useMemo(() => axios.create({ baseURL: API_URL, headers: token ? { Authorization: `Bearer ${token}` } : {} }), [token]);

  const showToast = useCallback((message, type = 'success') => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 7000); }, []);

  const alternarSom = useCallback(() => {
    const novoEstado = !somAtivoState; setSomAtivoState(novoEstado); somAtivoRef.current = novoEstado;
    if (novoEstado) { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); showToast('Alarmes sonoros ativados.', 'success'); } catch (e) { } } 
    else { showToast('Alarmes sonoros silenciados.', 'info'); }
  }, [somAtivoState, showToast]);

  const tocarAlarme = useCallback(() => {
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) { }
  }, []);

  const solicitarPermissaoPush = () => { if ("Notification" in window) { Notification.requestPermission().then(perm => { setPermPush(perm); if (perm === "granted") showToast("Notificações OS ativadas!", "success"); }); } };
  const enviarPushNotificationOS = useCallback((titulo, corpo) => { if ("Notification" in window && Notification.permission === "granted") { new Notification(titulo, { body: corpo, icon: '/favicon.ico' }); } }, []);

  const toggleFullScreen = () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>null); setIsFullScreen(true); } else { if (document.exitFullscreen) { document.exitFullscreen(); setIsFullScreen(false); } } };

  useEffect(() => { if (isDarkMode) { document.body.classList.add('dark-theme'); localStorage.setItem('theme', 'dark'); } else { document.body.classList.remove('dark-theme'); localStorage.setItem('theme', 'light'); } }, [isDarkMode]);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); showToast('Ligação restabelecida.', 'success'); carregarDadosBase(); };
    const handleOffline = () => { setIsOffline(true); showToast('Operando offline.', 'warning'); };
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const fazerLogin = async (usuarioInput, senhaInput) => {
    if (isOffline) return showToast('Sem ligação à rede.', 'error');
    setLoginErro(''); setIsLoginLoading(true); 
    try {
      const res = await axios.post(`${API_URL}/login`, { usuario: usuarioInput, senha: senhaInput });
      setToken(res.data.token); setUserRole(res.data.role); setUserFilial(res.data.filial); setFilialAtiva(res.data.role !== 'LOJA' ? 'Todas' : res.data.filial);
      
      setAbaAtiva('dashboard'); setMenuAberto(false);
      setNomeGerente(res.data.nome_gerente || ''); setNomeCoordenador(res.data.nome_coordenador || '');
      
      let identityName = usuarioInput; let roleTitle = 'Gestor de Loja';
      if (res.data.role === 'ADMIN') { identityName = 'Administrador'; roleTitle = 'Acesso Master'; }
      else if (res.data.role === 'MANUTENCAO') { identityName = res.data.nome_tecnico || 'Técnico'; roleTitle = 'Manutenção Global'; }
      else if (res.data.role === 'LOJA') { if (res.data.nome_gerente) { identityName = res.data.nome_gerente; roleTitle = 'Gerente da Loja'; } else if (res.data.nome_coordenador) { identityName = res.data.nome_coordenador; roleTitle = 'Coordenador da Loja'; } else { identityName = 'Equipe Geral'; roleTitle = 'Acesso da Loja'; } }

      setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(usuarioInput);
      localStorage.setItem('token', res.data.token); localStorage.setItem('userRole', res.data.role); localStorage.setItem('userFilial', res.data.filial); localStorage.setItem('nome_gerente', res.data.nome_gerente || ''); localStorage.setItem('nome_coordenador', res.data.nome_coordenador || ''); localStorage.setItem('nomeLogado', identityName); localStorage.setItem('papelLogado', roleTitle); localStorage.setItem('loginAtivo', usuarioInput);

      showToast(`Bem-vindo! Acesso: ${identityName}`, 'success');
      try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch(e){}
    } catch (error) { setLoginErro('Credenciais inválidas.'); showToast('Acesso Negado.', 'error'); } finally { setIsLoginLoading(false); }
  };

  const fazerLogout = () => { 
    setToken(''); localStorage.clear(); setUserRole('LOJA'); setUserFilial(''); setFilialAtiva('Todas'); setNomeGerente(''); setNomeCoordenador(''); setNomeLogado(''); setPapelLogado(''); setLoginAtivo('');
    setAbaAtiva('dashboard'); setMenuAberto(false);
  };

  const carregarChamados = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/chamados'); setChamados(Array.isArray(res.data) ? res.data : []); } catch (e) { } }, [token, isOffline, api]);
  const carregarUsuarios = useCallback(async () => { if (userRole !== 'ADMIN' || !token || isOffline) return; try { const res = await api.get('/usuarios'); setUsuariosLista(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, userRole, token, isOffline]);
  const carregarLojas = useCallback(async () => { if (userRole !== 'ADMIN' || !token || isOffline) return; try { const res = await api.get('/lojas'); setLojasCadastradas(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, userRole, token, isOffline]);
  const carregarTecnicos = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/tecnicos'); setTecnicosDb(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, token, isOffline]);
  const carregarParametrosGerais = useCallback(async () => { if (!token || isOffline) return; try { const [resSetores, resTipos] = await Promise.all([ api.get('/setores').catch(() => ({ data: [] })), api.get('/tipos-refrigeracao').catch(() => ({ data: [] })) ]); setListaSetores(Array.isArray(resSetores.data) ? resSetores.data : []); setListaTipos(Array.isArray(resTipos.data) ? resTipos.data : []); } catch (e) {} }, [api, token, isOffline]);

  const carregarDadosBase = useCallback(async () => {
    if (!token) return;
    if (isOffline) { const cE = localStorage.getItem('cache_equipamentos'); const cN = localStorage.getItem('cache_notificacoes'); const cH = localStorage.getItem('cache_historico'); if (cE) setEquipamentos(JSON.parse(cE)); if (cN) setNotificacoes(JSON.parse(cN)); if (cH && abaAtiva === 'historico') setHistoricoAlertas(JSON.parse(cH)); return; }
    try {
      const isHistorico = abaAtivaRef.current === 'historico';
      const [resEquip, resNotif, resHist, resFiliais] = await Promise.all([ api.get('/equipamentos').catch(() => ({ data: [] })), api.get('/notificacoes').catch(() => ({ data: [] })), isHistorico ? api.get('/notificacoes/historico').catch(() => ({ data: [] })) : Promise.resolve({ data: historicoAlertas }), api.get('/auxiliares/filiais').catch(() => ({ data: [] })) ]);
      setEquipamentos(Array.isArray(resEquip.data) ? resEquip.data : []); setFiliaisDb(Array.isArray(resFiliais.data) ? resFiliais.data : []); carregarParametrosGerais();
      if (isHistorico) setHistoricoAlertas(Array.isArray(resHist.data) ? resHist.data : []);
      const dadosNotificacoes = Array.isArray(resNotif.data) ? resNotif.data : [];
      const idMaisAlto = dadosNotificacoes.length > 0 ? Math.max(...dadosNotificacoes.map(n => n.id)) : 0;
      if (lastAlertIdRef.current !== -1 && idMaisAlto > lastAlertIdRef.current) { const novos = dadosNotificacoes.filter(n => n.id > lastAlertIdRef.current); if (novos.length > 0) { const isDegelo = novos[0].tipo_alerta === 'DEGELO'; if (somAtivoRef.current && !isDegelo) tocarAlarme(); showToast(`${isDegelo ? '❄️' : '🚨'} ${novos[0].mensagem}`, isDegelo ? 'info' : 'error'); if (!isDegelo && somAtivoRef.current) enviarPushNotificationOS('Alerta TermoSync', novos[0].mensagem); } }
      lastAlertIdRef.current = idMaisAlto; setNotificacoes(dadosNotificacoes); localStorage.setItem('cache_equipamentos', JSON.stringify(resEquip.data)); localStorage.setItem('cache_notificacoes', JSON.stringify(dadosNotificacoes));
    } catch (error) { if (error.response?.status === 401) fazerLogout(); }
  }, [token, isOffline, api, tocarAlarme, showToast, enviarPushNotificationOS, carregarParametrosGerais]); 

  const carregarRelatorios = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get(`/relatorios?data_inicio=${dataInicio.toISOString()}&data_fim=${dataFim.toISOString()}`); setRelatorios(Array.isArray(res.data) ? res.data : []); } catch (error) {} }, [token, isOffline, api, dataInicio, dataFim]);

  useEffect(() => { if (token) carregarDadosBase(); }, [token, carregarDadosBase]);
  useEffect(() => { if (abaAtiva === 'usuarios' && userRole === 'ADMIN') carregarUsuarios(); }, [abaAtiva, carregarUsuarios, userRole]);
  useEffect(() => { if (abaAtiva === 'lojas' && userRole === 'ADMIN') carregarLojas(); }, [abaAtiva, carregarLojas, userRole]);
  useEffect(() => { if (abaAtiva === 'chamados' || abaAtiva === 'historico_chamados') { carregarChamados(); carregarTecnicos(); } }, [abaAtiva, carregarChamados, carregarTecnicos]); 
  useEffect(() => { if (abaAtiva === 'parametros' && userRole === 'ADMIN') carregarParametrosGerais(); }, [abaAtiva, carregarParametrosGerais, userRole]); 

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

  const editarEquipamento = (eq) => {
    if (isOffline) return showToast('Ação bloqueada.', 'warning');
    setEquipEditando(eq.id); setFormEditEquip({ nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min || '', umidade_max: eq.umidade_max || '', intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, setor: eq.setor, filial: eq.filial, data_calibracao: eq.data_calibracao ? new Date(eq.data_calibracao).toISOString().split('T')[0] : '' });
  };
  const salvarEdicaoEquipamento = async (e) => { e.preventDefault(); if (isOffline) return; try { await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip); showToast('Atualizado.', 'success'); setEquipEditando(null); carregarDadosBase(); } catch (e) { showToast('Erro.', 'error'); } };
  const pedirExclusao = (id, nome) => { setModalConfig({ isOpen: true, title: 'Remover Máquina', message: `Remover "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => { try { await api.delete(`/equipamentos/${id}`); showToast('Removido.', 'success'); carregarDadosBase(); } catch (e) { showToast('Ação não autorizada.', 'error'); } }}); };
  const pedirNotaResolucao = (id) => { setModalConfig({ isOpen: true, title: 'Registro de Manutenção', message: 'Descreva a intervenção técnica:', isPrompt: true, promptValue: '', onConfirm: async (nota) => { try { await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: nota.trim() === '' ? 'Verificado e limpo.' : nota }); showToast('Arquivado no log.', 'success'); } catch (e) { showToast('Erro.', 'error'); } }}); };
  const resolverTodasNotificacoes = () => { setModalConfig({ isOpen: true, title: 'Limpeza do Painel', message: 'Arquivar todos os alarmes pendentes?', isPrompt: false, onConfirm: async () => { try { await api.put(`/notificacoes/resolver-todas`); showToast('Painel Limpo.', 'success'); } catch (e) { showToast('Erro.', 'error'); } }}); };

  const listaFiliais = useMemo(() => { if (userRole === 'LOJA') return [userFilial]; return ['Todas', ...(filiaisDb || [])]; }, [filiaisDb, userRole, userFilial]);
  const equipamentosDaFilial = useMemo(() => filialAtiva === 'Todas' ? equipamentos : equipamentos.filter(eq => (eq.filial || 'Loja Principal') === filialAtiva), [equipamentos, filialAtiva]);
  const notificacoesDaFilial = useMemo(() => filialAtiva === 'Todas' ? notificacoes : notificacoes.filter(n => (n.filial || 'Loja Principal') === filialAtiva), [notificacoes, filialAtiva]);

  const { qtdTotal, qtdDegelo, qtdFalha, qtdOperando } = useMemo(() => {
    const total = equipamentosDaFilial?.length || 0; const degelo = equipamentosDaFilial?.filter(e => e.em_degelo).length || 0; const falha = equipamentosDaFilial?.filter(e => !e.motor_ligado && !e.em_degelo).length || 0;
    return { qtdTotal: total, qtdDegelo: degelo, qtdFalha: falha, qtdOperando: total - degelo - falha };
  }, [equipamentosDaFilial]);

  const eqPesquisaLower = termoPesquisa.toLowerCase();
  const equipamentosFiltradosLista = useMemo(() => equipamentosDaFilial?.filter(eq => eq.nome?.toLowerCase().includes(eqPesquisaLower) || (eq.setor && eq.setor.toLowerCase().includes(eqPesquisaLower))), [equipamentosDaFilial, eqPesquisaLower]);
  const historicoFiltradoLista = useMemo(() => { let hist = filialAtiva === 'Todas' ? historicoAlertas : historicoAlertas?.filter(h => (h.filial || 'Loja Principal') === filialAtiva); return hist?.filter(h => h.equipamento_nome?.toLowerCase().includes(eqPesquisaLower) || (h.setor && h.setor.toLowerCase().includes(eqPesquisaLower))); }, [historicoAlertas, filialAtiva, eqPesquisaLower]);
  const dadosRelatorioBrutos = useMemo(() => { let r = filialAtiva === 'Todas' ? relatorios : relatorios?.filter(x => (x.filial || 'Loja Principal') === filialAtiva); return r?.filter(x => equipamentoFiltro === '' || x.nome === equipamentoFiltro); }, [relatorios, filialAtiva, equipamentoFiltro]);
  const dadosGrafico = useMemo(() => dadosRelatorioBrutos?.map(r => ({ hora: new Date(r.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dataExata: new Date(r.data_hora).toLocaleString(), temperatura: parseFloat(r.temperatura), umidade: parseFloat(r.umidade || 0), consumo_kwh: parseFloat(r.consumo_kwh || 0), nome: r.nome, filial: r.filial || 'Loja Principal' })), [dadosRelatorioBrutos]);
  const dadosGraficoFiltrados = useMemo(() => { if (dadosGrafico?.length <= 200) return dadosGrafico; return dadosGrafico?.filter((_, idx) => idx % Math.ceil(dadosGrafico.length / 200) === 0); }, [dadosGrafico]);
  const ultimasLeiturasRaw = useMemo(() => [...(dadosGrafico || [])].reverse().slice(0, 150), [dadosGrafico]);

  const { kpis, slaCompliance, totalEnergia } = useMemo(() => {
    let kpiMaxT = -Infinity, kpiMinT = Infinity, kpiMaxU = -Infinity, kpiMinU = Infinity, somaUmid = 0, countUmid = 0, somaTemp = 0, leiturasNoLimite = 0, somaKwh = 0;
    dadosGrafico?.forEach(d => {
      if (d.temperatura > kpiMaxT) kpiMaxT = d.temperatura; if (d.temperatura < kpiMinT) kpiMinT = d.temperatura; somaTemp += d.temperatura;
      if (d.umidade > 0) { if (d.umidade > kpiMaxU) kpiMaxU = d.umidade; if (d.umidade < kpiMinU) kpiMinU = d.umidade; somaUmid += d.umidade; countUmid++; }
      somaKwh += d.consumo_kwh; const eqRef = equipamentos?.find(e => e.nome === d.nome); if (eqRef && d.temperatura >= eqRef.temp_min && d.temperatura <= eqRef.temp_max) leiturasNoLimite++;
    });
    const sla = dadosGrafico?.length > 0 ? ((leiturasNoLimite / dadosGrafico.length) * 100).toFixed(1) : '--';
    return { kpis: { kpiMaxT: kpiMaxT === -Infinity ? '--' : kpiMaxT, kpiMinT: kpiMinT === Infinity ? '--' : kpiMinT, kpiMediaT: dadosGrafico?.length > 0 ? (somaTemp / dadosGrafico.length).toFixed(2) : '--', kpiMaxU: kpiMaxU === -Infinity ? '--' : kpiMaxU, kpiMinU: kpiMinU === Infinity ? '--' : kpiMinU, kpiMediaU: countUmid > 0 ? (somaUmid / countUmid).toFixed(1) : '--' }, slaCompliance: sla, totalEnergia: somaKwh };
  }, [dadosGrafico, equipamentos]);

  const mktValueProcessado = useMemo(() => {
    const arr = dadosRelatorioBrutos?.map(d => parseFloat(d.temperatura)) || []; if (arr.length === 0) return '--';
    let soma = 0; arr.forEach(t => soma += Math.exp(-83.144 / (0.0083144 * (t + 273.15))));
    return ((83.144 / 0.0083144) / (-Math.log(soma / arr.length)) - 273.15).toFixed(2);
  }, [dadosRelatorioBrutos]);

  const equipamentoSelecionado = useMemo(() => equipamentosDaFilial?.find(e => e.nome === equipamentoFiltro), [equipamentosDaFilial, equipamentoFiltro]);
  const dadosDonutStatus = useMemo(() => [ { name: 'Ok', value: qtdOperando, color: 'var(--success)' }, { name: 'Degelo', value: qtdDegelo, color: '#38bdf8' }, { name: 'Falha', value: qtdFalha, color: 'var(--danger)' } ].filter(d => d.value > 0), [qtdOperando, qtdDegelo, qtdFalha]);

  if (!token) return <Login isOffline={isOffline} isLoginLoading={isLoginLoading} fazerLogin={fazerLogin} loginErro={loginErro} />;

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
      <datalist id="filiais-db">{filiaisDb?.map(f => <option key={f} value={f} />)}</datalist><datalist id="setores-db">{listaSetores?.map(s => <option key={s.id} value={s.nome} />)}</datalist>

      {toast.show && ( <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 99999, backgroundColor: toast.type === 'error' ? '#ef4444' : (toast.type === 'info' ? '#38bdf8' : '#10b981'), color: '#ffffff', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '400px', borderLeft: '4px solid rgba(255,255,255,0.5)', animation: 'slideIn 0.4s ease-out' }}> {toast.type === 'success' ? <CheckCircle size={26} /> : (toast.type === 'error' ? <AlertTriangle size={26} /> : <Info size={26} />)} <span style={{ fontWeight: '600', fontSize: '0.95rem', lineHeight: '1.4' }}>{toast.message}</span> </div> )}

      <div className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '4px', display: 'flex' }}><TermoSyncLogo size={24} color="var(--primary)" /></div>
          <h2>TermoSync</h2><button className="mobile-close" onClick={() => setMenuAberto(false)}><X size={24} color="white" /></button>
        </div>
        <div style={{ padding: '0 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>{nomeLogado ? nomeLogado.charAt(0) : (loginAtivo ? loginAtivo.charAt(0) : 'U')}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}><div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeLogado || loginAtivo || 'Utilizador'}</div><div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: '600' }}>@{loginAtivo} • {papelLogado}</div></div>
        </div>
        <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '5px', textTransform: 'uppercase' }}>{userRole !== 'LOJA' ? <><MapPin size={14}/> Rede de Lojas</> : <><UserCheck size={14}/> Acesso Local</>}</div>
            {userRole !== 'LOJA' ? (<select className="select-input" value={filialAtiva} onChange={(e) => setFilialAtiva(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>{listaFiliais?.map(f => <option key={f} value={f} style={{ color: 'black' }}>{f === 'Todas' ? 'Visão Global Integrada' : f}</option>)}</select>) : (<div style={{ width: '100%', padding: '8px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: '0.9rem' }}>{userFilial}</div>)}
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => { setAbaAtiva('dashboard'); setMenuAberto(false); }}><Activity size={20} /> Painel Central {notificacoesDaFilial?.length > 0 && <span className="badge">{notificacoesDaFilial.length}</span>}</button>
          <button className={`nav-item ${abaAtiva === 'motores' ? 'active' : ''}`} onClick={() => { setAbaAtiva('motores'); setMenuAberto(false); }}><Thermometer size={20} /> Monitorização Térmica</button>
          <button className={`nav-item ${abaAtiva === 'umidade' ? 'active' : ''}`} onClick={() => { setAbaAtiva('umidade'); setMenuAberto(false); }}><Droplets size={20} /> Monitorização Humidade</button>
          <button className={`nav-item ${abaAtiva === 'equipamentos' ? 'active' : ''}`} onClick={() => { setAbaAtiva('equipamentos'); setMenuAberto(false); }}><Settings size={20} /> Metrologia & Instalações</button>
          <button className={`nav-item ${abaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('relatorios'); setMenuAberto(false); }}><Leaf size={20} /> Sustentabilidade e ESG</button>
          <button className={`nav-item ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => { setAbaAtiva('historico'); setMenuAberto(false); }}><History size={20} /> Auditoria RDC (Logs)</button>
          <button className={`nav-item ${abaAtiva === 'chamados' ? 'active' : ''}`} onClick={() => { setAbaAtiva('chamados'); setMenuAberto(false); }}><Wrench size={20} /> Chamados Técnicos</button>
          <button className={`nav-item ${abaAtiva === 'historico_chamados' ? 'active' : ''}`} onClick={() => { setAbaAtiva('historico_chamados'); setMenuAberto(false); }}><Archive size={20} /> Histórico de Chamados</button>
          {userRole === 'ADMIN' && (<><div style={{ marginTop: '1rem', marginBottom: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Sistema</div><button className={`nav-item ${abaAtiva === 'lojas' ? 'active' : ''}`} onClick={() => { setAbaAtiva('lojas'); setMenuAberto(false); }}><Store size={20} /> Gestão de Lojas</button><button className={`nav-item ${abaAtiva === 'parametros' ? 'active' : ''}`} onClick={() => { setAbaAtiva('parametros'); setMenuAberto(false); }}><Sliders size={20} /> Parâmetros Globais</button><button className={`nav-item ${abaAtiva === 'usuarios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('usuarios'); setMenuAberto(false); }}><Users size={20} /> Gestão de Acessos</button></>)}
        </nav>
        <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}><button className="btn btn-outline w-100" style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }} onClick={fazerLogout}><LogOut size={18} style={{ marginRight: '8px' }} /> Encerrar Sessão</button></div>
      </div>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      <div className="main-content">
        <header className="header">
          <button className="menu-btn" onClick={() => setMenuAberto(true)}><Menu size={24} /></button>
          <h2 className="page-title"> {abaAtiva === 'dashboard' ? 'Central de Operações' : abaAtiva === 'relatorios' ? 'Inteligência e Sustentabilidade' : abaAtiva === 'usuarios' ? 'Administração de Acessos' : abaAtiva === 'parametros' ? 'Configurações do Sistema' : abaAtiva === 'lojas' ? 'Cadastro de Lojas' : abaAtiva === 'chamados' ? 'Manutenção Corretiva' : abaAtiva === 'historico_chamados' ? 'Histórico de Manutenções Antigas' : 'Gestão de Máquinas'} </h2>
          <div className="user-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-color)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>{isOffline ? <><span className="status-dot" style={{ backgroundColor: 'var(--danger)' }}></span><span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--danger)' }}>Offline</span></> : <><span className={`status-dot ${notificacoesDaFilial?.length > 0 ? 'pulse-danger' : ''}`} style={{ backgroundColor: latencia === 0 ? 'var(--text-muted)' : (latencia < 80 ? 'var(--success)' : 'var(--warning)') }}></span><span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>{latencia === 0 ? 'Ligando...' : `Latência: ${latencia}ms`}</span></>}</div>
            <button className="btn-icon" onClick={alternarSom} title="Ligar/Desligar Alarmes" style={{ color: somAtivoState ? 'var(--primary)' : 'var(--text-muted)' }}>{somAtivoState ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
            <button className="btn-icon" onClick={solicitarPermissaoPush} title="Permitir Push Nativos" style={{ color: permPush === 'granted' ? 'var(--success)' : 'var(--warning)' }}>{permPush === 'granted' ? <Bell size={20} /> : <BellOff size={20} />}</button>
            <button className="btn-icon" onClick={toggleFullScreen}><Maximize size={20} /></button>
            <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)}><Moon size={20} /></button>
          </div>
        </header>

        <main className="content-area">
          {abaAtiva === 'dashboard' && ( <Dashboard qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} qtdFalha={qtdFalha} dadosDonutStatus={dadosDonutStatus} notificacoesDaFilial={notificacoesDaFilial} resolverTodasNotificacoes={resolverTodasNotificacoes} isOffline={isOffline} pedirNotaResolucao={pedirNotaResolucao} isDarkMode={isDarkMode} /> )}
          {abaAtiva === 'motores' && ( <Monitoramento isTemp={true} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} userRole={userRole} /> )}
          {abaAtiva === 'umidade' && ( <Monitoramento isTemp={false} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} userRole={userRole} /> )}
          {abaAtiva === 'equipamentos' && ( <Equipamentos api={api} showToast={showToast} isOffline={isOffline} userRole={userRole} userFilial={userFilial} filiaisDb={filiaisDb} listaSetores={listaSetores} listaTipos={listaTipos} carregarDadosBase={carregarDadosBase} equipamentosFiltradosLista={equipamentosFiltradosLista} editarEquipamento={editarEquipamento} pedirExclusao={pedirExclusao} /> )}
          {abaAtiva === 'relatorios' && ( <Relatorios totalEnergia={totalEnergia} slaCompliance={slaCompliance} kpis={kpis} mktValueProcessado={mktValueProcessado} dataInicio={dataInicio} setDataInicio={setDataInicio} dataFim={dataFim} setDataFim={setDataFim} isOffline={isOffline} equipamentoFiltro={equipamentoFiltro} setEquipamentoFiltro={setEquipamentoFiltro} equipamentosDaFilial={equipamentosDaFilial} gerarExportacao={gerarExportacao} dadosGraficoFiltrados={dadosGraficoFiltrados} isDarkMode={isDarkMode} equipamentoSelecionado={equipamentoSelecionado} ultimasLeiturasRaw={ultimasLeiturasRaw} /> )}
          {abaAtiva === 'historico' && ( <HistoricoLogs historicoFiltradoLista={historicoFiltradoLista} gerarExportacao={gerarExportacao} /> )}
          {abaAtiva === 'chamados' && ( <Chamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} equipamentosDaFilial={equipamentosDaFilial} nomeGerente={nomeGerente} nomeCoordenador={nomeCoordenador} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} /> )}
          {abaAtiva === 'historico_chamados' && ( <HistoricoChamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} /> )}
          {abaAtiva === 'lojas' && userRole === 'ADMIN' && ( <GestaoLojas api={api} showToast={showToast} lojasCadastradas={lojasCadastradas} carregarLojas={carregarLojas} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}
          {abaAtiva === 'usuarios' && userRole === 'ADMIN' && ( <GestaoUsuarios api={api} showToast={showToast} usuariosLista={usuariosLista} carregarUsuarios={carregarUsuarios} filiaisDb={filiaisDb} setModalConfig={setModalConfig} /> )}
          {abaAtiva === 'parametros' && userRole === 'ADMIN' && ( <ParametrosGlobais api={api} showToast={showToast} listaSetores={listaSetores} listaTipos={listaTipos} carregarParametrosGerais={carregarParametrosGerais} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}
        </main>
      </div>

      {equipEditando && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%' }}>
            <h3><Edit size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Editar Ativo IoT</h3>
            <form onSubmit={salvarEdicaoEquipamento}>
              <div className="form-grid">
                <div><label>Identificador Máquina</label><input type="text" value={formEditEquip.nome} onChange={(e) => setFormEditEquip({ ...formEditEquip, nome: e.target.value })} required disabled={isOffline} /></div>
                <div><label>Filial Física</label><select className="select-input" value={formEditEquip.filial} onChange={(e) => setFormEditEquip({ ...formEditEquip, filial: e.target.value })} required disabled={userRole === 'LOJA' || isOffline} style={{ backgroundColor: userRole === 'LOJA' ? 'var(--bg-color)' : undefined }}><option value="">Selecione...</option>{filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                <div><label>Setor Comercial</label><select className="select-input" value={formEditEquip.setor} onChange={(e) => setFormEditEquip({ ...formEditEquip, setor: e.target.value })} required disabled={isOffline}><option value="">Selecione o Setor...</option>{listaSetores?.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}</select></div>
                <div><label>Tipo</label><select className="select-input" value={formEditEquip.tipo} onChange={(e) => setFormEditEquip({ ...formEditEquip, tipo: e.target.value })} required disabled={isOffline}><option value="">Selecione o Tipo...</option>{listaTipos?.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}</select></div>
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