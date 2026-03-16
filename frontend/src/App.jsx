import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  AlertTriangle, Power, Activity, LogOut, Lock, 
  LayoutDashboard, BarChart2, ThermometerSnowflake, 
  Settings, Server, Grid, Zap, AlertOctagon, Plus, X, Edit, Trash2 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('tokenFrioMonitor') || '');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');

  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('principal');
  const [periodoRelatorio, setPeriodoRelatorio] = useState('diario');

  // Modais de CRUD
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoNovoEquipamento, setTipoNovoEquipamento] = useState('camara_fria');
  const [novoNome, setNovoNome] = useState('');
  const [novaTempMin, setNovaTempMin] = useState('');
  const [novaTempMax, setNovaTempMax] = useState('');

  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [idEditando, setIdEditando] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editTempMin, setEditTempMin] = useState('');
  const [editTempMax, setEditTempMax] = useState('');

  // Notificações flutuantes
  const [alertasFlutuantes, setAlertasFlutuantes] = useState([]);
  const idsConhecidosNotificacao = useRef(new Set());

  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  const tocarAlarme = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime); 
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.3);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { console.error("Erro áudio:", e); }
  };

  const removerAlertaFlutuante = (id) => {
    setAlertasFlutuantes(prev => prev.filter(alerta => alerta.id !== id));
  };

  const fazerLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, { usuario, senha });
      setToken(res.data.token);
      localStorage.setItem('tokenFrioMonitor', res.data.token);
      setErroLogin('');
    } catch (error) { setErroLogin('Usuário ou senha incorretos.'); }
  };

  const fazerLogout = () => {
    setToken('');
    localStorage.removeItem('tokenFrioMonitor');
    delete axios.defaults.headers.common['Authorization'];
  };

  const carregarDados = async () => {
    if (!token) return;
    try {
      const [resEquip, resNotif] = await Promise.all([
        axios.get(`${API_URL}/equipamentos`),
        axios.get(`${API_URL}/notificacoes`)
      ]);
      setEquipamentos(resEquip.data);
      setNotificacoes(resNotif.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) fazerLogout();
    }
  };

  const carregarRelatorios = async () => {
    if (!token) return;
    try {
      const resRel = await axios.get(`${API_URL}/relatorios?periodo=${periodoRelatorio}`);
      const dadosFormatados = resRel.data.map(item => ({
        ...item,
        hora_formatada: new Date(item.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }));
      setRelatorios(dadosFormatados);
    } catch (error) { console.error(error); }
  };

  // --- LÓGICA DE ALERTA BASEADA EXCLUSIVAMENTE NO BANCO DE DADOS ---
  useEffect(() => {
    let dispararSom = false;
    let novasMensagens = [];

    notificacoes.forEach(notif => {
      if (!idsConhecidosNotificacao.current.has(notif.id)) {
        idsConhecidosNotificacao.current.add(notif.id);
        dispararSom = true;
        
        // Identifica se a notificação é de motor ou temperatura pelo texto
        const isMotor = notif.mensagem.toLowerCase().includes('motor');
        
        novasMensagens.push({ 
          id: `t_${notif.id}_${Date.now()}`, 
          tipo: isMotor ? 'motor' : 'temp', 
          msg: notif.mensagem 
        });
      }
    });

    if (dispararSom) {
      tocarAlarme();
      setAlertasFlutuantes(prev => [...prev, ...novasMensagens]);

      // Apaga a janela flutuante sozinha após 8 segundos
      novasMensagens.forEach(msg => {
        setTimeout(() => { removerAlertaFlutuante(msg.id); }, 8000);
      });
    }
  }, [notificacoes]); // Fica observando as notificações oficiais do banco

  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (abaAtiva === 'relatorios') carregarRelatorios();
  }, [abaAtiva, periodoRelatorio, token]);

  const atualizarConfiguracao = async (id, temp_min, temp_max, motor_ligado) => {
    await axios.put(`${API_URL}/equipamentos/${id}`, { temp_min, temp_max, motor_ligado });
    carregarDados();
  };

  const resolverNotificacao = async (id) => {
    await axios.put(`${API_URL}/notificacoes/${id}/resolver`);
    carregarDados(); 
  };

  // Funções de Modal
  const abrirModalNovo = (tipo) => {
    setTipoNovoEquipamento(tipo);
    setNovoNome(''); setNovaTempMin(''); setNovaTempMax('');
    setModalAberto(true);
  };

  const salvarNovoEquipamento = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/equipamentos`, {
        nome: novoNome, tipo: tipoNovoEquipamento,
        temp_min: parseFloat(novaTempMin), temp_max: parseFloat(novaTempMax)
      });
      setModalAberto(false);
      carregarDados();
    } catch (error) { alert("Erro ao adicionar equipamento."); }
  };

  const abrirModalEdicao = (eq) => {
    setIdEditando(eq.id);
    setEditNome(eq.nome); setEditTipo(eq.tipo);
    setEditTempMin(eq.temp_min); setEditTempMax(eq.temp_max);
    setModalEdicaoAberto(true);
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/equipamentos/${idEditando}/edit`, {
        nome: editNome, tipo: editTipo,
        temp_min: parseFloat(editTempMin), temp_max: parseFloat(editTempMax)
      });
      setModalEdicaoAberto(false);
      carregarDados();
    } catch (error) { alert("Erro ao editar equipamento."); }
  };

  const excluirEquipamento = async (id) => {
    if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir este equipamento? Todo o histórico dele será apagado.")) {
      try {
        await axios.delete(`${API_URL}/equipamentos/${id}`);
        carregarDados();
      } catch (error) { alert("Erro ao excluir equipamento."); }
    }
  };

  const camarasFrias = equipamentos.filter(eq => eq.tipo === 'camara_fria');
  const balcoes = equipamentos.filter(eq => eq.tipo === 'balcao_refrigerado');
  const motoresDesligados = equipamentos.filter(eq => !eq.motor_ligado);

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'system-ui' }}>
        <form onSubmit={fazerLogin} style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '350px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: '#2563eb' }}><Lock size={48} /></div>
          <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>FrioMonitor Login</h2>
          {erroLogin && <p style={{ color: 'red', fontSize: '14px', marginBottom: '15px' }}>{erroLogin}</p>}
          <input type="text" placeholder="Usuário" value={usuario} onChange={e => setUsuario(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} required />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} required />
          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Entrar</button>
        </form>
      </div>
    );
  }

  const menuStyle = (abaNome) => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 20px', cursor: 'pointer',
    backgroundColor: abaAtiva === abaNome ? '#3b82f6' : 'transparent',
    color: abaAtiva === abaNome ? 'white' : '#cbd5e1',
    borderLeft: abaAtiva === abaNome ? '4px solid #60a5fa' : '4px solid transparent',
    transition: 'all 0.2s', fontWeight: abaAtiva === abaNome ? 'bold' : 'normal', fontSize: '15px'
  });

  const cardStyle = { backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px', borderRadius: '12px', width: '300px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' };
  
  const BotoesAcao = ({ eq }) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => abrirModalEdicao(eq)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Editar"><Edit size={18} /></button>
      <button onClick={() => excluirEquipamento(eq.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Excluir"><Trash2 size={18} /></button>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9fafb', margin: 0, padding: 0, overflow: 'hidden' }}>
      
      {/* --- NOTIFICAÇÕES FLUTUANTES COM AUTO-FECHAMENTO --- */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alertasFlutuantes.map(alerta => (
          <div 
            key={alerta.id} 
            onClick={() => removerAlertaFlutuante(alerta.id)}
            style={{
              backgroundColor: alerta.tipo === 'motor' ? '#f59e0b' : '#ef4444',
              color: 'white', padding: '15px 20px', borderRadius: '8px', 
              boxShadow: '0 10px 20px rgba(0,0,0,0.2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '15px', width: '350px'
            }}
          >
            {alerta.tipo === 'motor' ? <AlertOctagon size={28} /> : <AlertTriangle size={28} />}
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', fontSize: '15px', marginBottom: '5px' }}>
                {alerta.tipo === 'motor' ? 'ATENÇÃO: MOTOR PAROU!' : 'ALERTA: TEMPERATURA ALTA!'}
              </strong>
              <span style={{ fontSize: '14px', lineHeight: '1.4' }}>{alerta.msg}</span>
            </div>
            <X size={20} style={{ opacity: 0.8 }} />
          </div>
        ))}
      </div>

      {/* --- MODAIS DE NOVO / EDIÇÃO --- */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>Adicionar Equipamento</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            <form onSubmit={salvarNovoEquipamento}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Tipo de Equipamento</label>
                <select value={tipoNovoEquipamento} onChange={e => setTipoNovoEquipamento(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box', backgroundColor: 'white' }}>
                  <option value="camara_fria">Câmara Fria</option>
                  <option value="balcao_refrigerado">Balcão Refrigerado</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Nome do Equipamento</label>
                <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Temp. Mínima (°C)</label>
                  <input type="number" step="0.1" value={novaTempMin} onChange={e => setNovaTempMin(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Temp. Máxima (°C)</label>
                  <input type="number" step="0.1" value={novaTempMax} onChange={e => setNovaTempMax(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Salvar</button>
            </form>
          </div>
        </div>
      )}

      {modalEdicaoAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>Editar Equipamento</h2>
              <button onClick={() => setModalEdicaoAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            <form onSubmit={salvarEdicao}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Tipo de Equipamento</label>
                <select value={editTipo} onChange={e => setEditTipo(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box', backgroundColor: 'white' }}>
                  <option value="camara_fria">Câmara Fria</option>
                  <option value="balcao_refrigerado">Balcão Refrigerado</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Nome do Equipamento</label>
                <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Temp. Mínima (°C)</label>
                  <input type="number" step="0.1" value={editTempMin} onChange={e => setEditTempMin(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Temp. Máxima (°C)</label>
                  <input type="number" step="0.1" value={editTempMax} onChange={e => setEditTempMax(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {/* MENU LATERAL */}
      <div style={{ width: '260px', backgroundColor: '#1e293b', display: 'flex', flexDirection: 'column', color: 'white', boxShadow: '2px 0 5px rgba(0,0,0,0.1)', zIndex: 10 }}>
        <div style={{ padding: '20px', fontSize: '1.4rem', fontWeight: 'bold', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThermometerSnowflake size={28} color="#60a5fa" /> FrioMonitor
        </div>
        <nav style={{ flex: 1, padding: '15px 0', overflowY: 'auto' }}>
          <div style={menuStyle('principal')} onClick={() => setAbaAtiva('principal')}><LayoutDashboard size={20} /> Tela Principal</div>
          <div style={menuStyle('camaras')} onClick={() => setAbaAtiva('camaras')}><Server size={20} /> Câmaras Frias</div>
          <div style={menuStyle('balcoes')} onClick={() => setAbaAtiva('balcoes')}><Grid size={20} /> Balcões</div>
          <div style={menuStyle('motores')} onClick={() => setAbaAtiva('motores')}><Zap size={20} /> Status dos Motores</div>
          <div style={menuStyle('configuracoes')} onClick={() => setAbaAtiva('configuracoes')}><Settings size={20} /> Configurar Temp.</div>
          <div style={menuStyle('relatorios')} onClick={() => setAbaAtiva('relatorios')}><BarChart2 size={20} /> Relatórios</div>
        </nav>
        <div style={{ padding: '20px', borderTop: '1px solid #334155' }}>
          <button onClick={fazerLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            <LogOut size={18} /> Sair
          </button>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
        
        {/* ABA 1: TELA PRINCIPAL */}
        {abaAtiva === 'principal' && (
          <div>
            <h2 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>Visão Geral do Sistema</h2>

            {/* A lista de motor parado continua visível como lembrete, se ele estiver desligado */}
            {motoresDesligados.length > 0 && (
              <div style={{ backgroundColor: '#fffbeb', padding: '15px', border: '1px solid #f59e0b', marginBottom: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(245,158,11,0.1)' }}>
                <h3 style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><AlertOctagon /> MOTORES DESLIGADOS NESTE MOMENTO</h3>
                <p style={{ margin: '10px 0 0 0', color: '#92400e', fontWeight: 'bold' }}>Equipamentos parados: {motoresDesligados.map(m => m.nome).join(', ')}.</p>
              </div>
            )}

            {/* As notificações que vieram do BD vão aparecer aqui para você dar baixa (resolver) */}
            {notificacoes.length > 0 && (
              <div style={{ backgroundColor: '#fee2e2', padding: '15px', border: '1px solid #ef4444', marginBottom: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(239,68,68,0.1)' }}>
                <h3 style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px 0' }}><AlertTriangle /> Alertas Pendentes ({notificacoes.length})</h3>
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {notificacoes.map(n => (
                    <li key={n.id} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #ef4444' }}>
                      <span><strong style={{ color: '#ef4444' }}>{new Date(n.data_hora).toLocaleTimeString()}:</strong> {n.mensagem}</span>
                      <button onClick={() => resolverNotificacao(n.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Resolver</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ ...cardStyle, borderTop: '4px solid #3b82f6', textAlign: 'center' }}>
                <Server size={40} color="#3b82f6" style={{ marginBottom: '10px' }}/>
                <h3 style={{ margin: 0, fontSize: '2rem' }}>{camarasFrias.length}</h3>
                <p style={{ color: '#6b7280', margin: 0 }}>Câmaras Frias</p>
              </div>
              <div style={{ ...cardStyle, borderTop: '4px solid #10b981', textAlign: 'center' }}>
                <Grid size={40} color="#10b981" style={{ marginBottom: '10px' }}/>
                <h3 style={{ margin: 0, fontSize: '2rem' }}>{balcoes.length}</h3>
                <p style={{ color: '#6b7280', margin: 0 }}>Balcões Operando</p>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CÂMARAS FRIAS */}
        {abaAtiva === 'camaras' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>Câmaras Frias</h2>
              <button onClick={() => abrirModalNovo('camara_fria')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                <Plus size={18} /> Novo Equipamento
              </button>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {camarasFrias.map(eq => (
                <div key={eq.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>{eq.nome}</h3>
                    <BotoesAcao eq={eq} />
                  </div>
                  <p><strong>Temp. Ideal:</strong> {eq.temp_min}°C a {eq.temp_max}°C</p>
                  <p><strong>Status do Motor:</strong> {eq.motor_ligado ? <span style={{color: '#10b981', fontWeight: 'bold'}}>Ligado</span> : <span style={{color: '#ef4444', fontWeight: 'bold'}}>Desligado</span>}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 3: BALCÕES REFRIGERADOS */}
        {abaAtiva === 'balcoes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>Balcões Refrigerados</h2>
              <button onClick={() => abrirModalNovo('balcao_refrigerado')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                <Plus size={18} /> Novo Equipamento
              </button>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {balcoes.map(eq => (
                <div key={eq.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>{eq.nome}</h3>
                    <BotoesAcao eq={eq} />
                  </div>
                  <p><strong>Temp. Ideal:</strong> {eq.temp_min}°C a {eq.temp_max}°C</p>
                  <p><strong>Status do Motor:</strong> {eq.motor_ligado ? <span style={{color: '#10b981', fontWeight: 'bold'}}>Ligado</span> : <span style={{color: '#ef4444', fontWeight: 'bold'}}>Desligado</span>}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 4: STATUS DOS MOTORES */}
        {abaAtiva === 'motores' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>Acompanhamento de Motores</h2>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {equipamentos.map(eq => (
                <div key={eq.id} style={{ ...cardStyle, textAlign: 'center', border: eq.motor_ligado ? '1px solid #e5e7eb' : '2px solid #ef4444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>{eq.nome}</h3>
                  </div>
                  <div style={{ backgroundColor: eq.motor_ligado ? '#10b981' : '#ef4444', color: 'white', padding: '15px', width: '100%', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '16px', boxSizing: 'border-box' }}>
                    <Power size={24} /> {eq.motor_ligado ? 'MOTOR LIGADO' : 'MOTOR DESLIGADO'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 5: CONFIGURAÇÕES DE TEMPERATURA */}
        {abaAtiva === 'configuracoes' && (
          <div>
            <h2 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>Configuração de Temperaturas</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {equipamentos.map(eq => (
                <div key={eq.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>{eq.nome}</h3>
                    <BotoesAcao eq={eq} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', fontWeight: 'bold', marginBottom: '8px' }}>MÍNIMA (°C)</label>
                      <input type="number" defaultValue={eq.temp_min} onBlur={(e) => atualizarConfiguracao(eq.id, e.target.value, eq.temp_max, eq.motor_ligado)} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', textAlign: 'center', fontSize: '16px' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', fontWeight: 'bold', marginBottom: '8px' }}>MÁXIMA (°C)</label>
                      <input type="number" defaultValue={eq.temp_max} onBlur={(e) => atualizarConfiguracao(eq.id, eq.temp_min, e.target.value, eq.motor_ligado)} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', textAlign: 'center', fontSize: '16px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 6: RELATÓRIOS */}
        {abaAtiva === 'relatorios' && (
          <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '25px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ margin: 0, color: '#1f2937' }}>Histórico de Temperaturas</h3>
              <select value={periodoRelatorio} onChange={(e) => setPeriodoRelatorio(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}>
                <option value="diario">Diário (24h)</option>
                <option value="semanal">Semanal (7 dias)</option>
              </select>
            </div>
            <div style={{ height: '350px', marginBottom: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={relatorios}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="hora_formatada" stroke="#6b7280" fontSize={12} />
                  <YAxis domain={['auto', 'auto']} stroke="#6b7280" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="temperatura" stroke="#3b82f6" name="Temperatura (°C)" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}