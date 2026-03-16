import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 
import { Thermometer, AlertTriangle, Settings, Activity, Power, LogOut, Menu, X, CheckCircle } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);

  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  const [periodoRelatorio, setPeriodoRelatorio] = useState('diario');

  // NOVO: Adicionado intervalo_degelo e duracao_degelo no estado
  const [formEquip, setFormEquip] = useState({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '' });

  const api = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  const fazerLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, { usuario, senha });
      const newToken = res.data.token;
      setToken(newToken);
      localStorage.setItem('token', newToken);
    } catch (error) {
      alert('Usuário ou senha incorretos!');
    }
  };

  const fazerLogout = () => {
    setToken('');
    localStorage.removeItem('token');
  };

  const carregarDados = async () => {
    if (!token) return;
    try {
      const [resEquip, resNotif] = await Promise.all([
        api.get('/equipamentos'),
        api.get('/notificacoes')
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
      const res = await api.get(`/relatorios?periodo=${periodoRelatorio}`);
      setRelatorios(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const adicionarEquipamento = async (e) => {
    e.preventDefault();
    try {
      await api.post('/equipamentos', formEquip);
      setFormEquip({ nome: '', tipo: '', temp_min: '', temp_max: '', intervalo_degelo: '', duracao_degelo: '' });
      carregarDados();
      alert('Equipamento adicionado!');
    } catch (error) {
      alert('Erro ao adicionar equipamento.');
    }
  };

  const excluirEquipamento = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir?')) {
      try {
        await api.delete(`/equipamentos/${id}`);
        carregarDados();
      } catch (error) {
        alert('Erro ao excluir.');
      }
    }
  };

  const resolverNotificacao = async (id) => {
    try {
      await api.put(`/notificacoes/${id}/resolver`);
      carregarDados();
    } catch (error) {
      alert('Erro ao resolver notificação.');
    }
  };

  useEffect(() => {
    if (token) {
      carregarDados();
      const interval = setInterval(carregarDados, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  useEffect(() => {
    if (token && abaAtiva === 'relatorios') {
      carregarRelatorios();
    }
  }, [token, abaAtiva, periodoRelatorio]);

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>FrioMonitor</h2>
          <p>Acesso ao Sistema</p>
          <form onSubmit={fazerLogin}>
            <input type="text" placeholder="Usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <button type="submit" className="btn btn-primary w-100">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>FrioMonitor</h2>
          <button className="mobile-close" onClick={() => setMenuAberto(false)}><X size={24} color="white" /></button>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => { setAbaAtiva('dashboard'); setMenuAberto(false); }}>
            <AlertTriangle size={20} /> Alertas
            {notificacoes.length > 0 && <span className="badge">{notificacoes.length}</span>}
          </button>
          <button className={`nav-item ${abaAtiva === 'motores' ? 'active' : ''}`} onClick={() => { setAbaAtiva('motores'); setMenuAberto(false); }}>
            <Power size={20} /> Status dos Motores
          </button>
          <button className={`nav-item ${abaAtiva === 'equipamentos' ? 'active' : ''}`} onClick={() => { setAbaAtiva('equipamentos'); setMenuAberto(false); }}>
            <Settings size={20} /> Equipamentos
          </button>
          <button className={`nav-item ${abaAtiva === 'relatorios' ? 'active' : ''}`} onClick={() => { setAbaAtiva('relatorios'); setMenuAberto(false); }}>
            <Activity size={20} /> Relatórios
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <button className="btn btn-outline w-100" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} onClick={fazerLogout}>
            <LogOut size={18} style={{ marginRight: '8px' }}/> Sair
          </button>
        </div>
      </div>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      <div className="main-content">
        <header className="header">
          <button className="menu-btn" onClick={() => setMenuAberto(true)}>
            <Menu size={24} />
          </button>
          <h2 className="page-title">
            {abaAtiva === 'dashboard' && 'Painel de Alertas'}
            {abaAtiva === 'motores' && 'Status dos Motores'}
            {abaAtiva === 'equipamentos' && 'Gestão de Equipamentos'}
            {abaAtiva === 'relatorios' && 'Histórico de Leituras'}
          </h2>
          <div className="user-info">
            <span className="status-dot"></span> Sistema Online
          </div>
        </header>

        <main className="content-area">
          {abaAtiva === 'dashboard' && (
            <div className="anim-fade-in">
              <div className="card-header">
                <h3>Avisos e Anomalias Ativas</h3>
              </div>
              {notificacoes.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={48} color="var(--success)" />
                  <p>Tudo tranquilo! Nenhum alerta crítico no momento.</p>
                </div>
              ) : (
                <div className="grid-cards">
                  {notificacoes.map(notif => (
                    <div key={notif.id} className="card card-alert">
                      <div className="card-top">
                        <AlertTriangle size={24} color="var(--danger)" />
                        <span className="time-badge">{new Date(notif.data_hora).toLocaleTimeString()}</span>
                      </div>
                      <p className="alert-msg">{notif.mensagem}</p>
                      <button className="btn btn-primary w-100" onClick={() => resolverNotificacao(notif.id)}>
                        Marcar como Resolvido
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOVA ABA MOTORES: Tratamento para cor Azul no Degelo */}
          {abaAtiva === 'motores' && (
            <div className="anim-fade-in grid-cards">
              {equipamentos.map(eq => (
                <div key={eq.id} className={`card ${eq.em_degelo ? 'card-info-border' : (eq.motor_ligado ? 'card-success-border' : 'card-danger-border')}`}>
                  <h3 style={{ marginTop: 0 }}>{eq.nome}</h3>
                  <div className={`status-box ${eq.em_degelo ? 'status-defrost' : (eq.motor_ligado ? 'status-on' : 'status-off')}`}>
                    <Power size={32} />
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                      {eq.em_degelo ? '❄️ EM DEGELO (NORMAL)' : (eq.motor_ligado ? 'MOTOR LIGADO' : 'MOTOR DESLIGADO / FALHA')}
                    </span>
                  </div>
                  {!eq.motor_ligado && !eq.em_degelo && (
                    <p style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>
                      Atenção: Verifique o equipamento fisicamente.
                    </p>
                  )}
                </div>
              ))}
              {equipamentos.length === 0 && <p>Nenhum equipamento cadastrado.</p>}
            </div>
          )}

          {/* ABA EQUIPAMENTOS: Inserção dos campos de Degelo */}
          {abaAtiva === 'equipamentos' && (
            <div className="anim-fade-in">
              <div className="card" style={{ marginBottom: '2rem' }}>
                <h3>Cadastrar Novo Equipamento</h3>
                <form className="form-grid" onSubmit={adicionarEquipamento}>
                  <input type="text" placeholder="Nome (Ex: Freezer 1)" value={formEquip.nome} onChange={e => setFormEquip({...formEquip, nome: e.target.value})} required />
                  <select value={formEquip.tipo} onChange={e => setFormEquip({...formEquip, tipo: e.target.value})} required>
                    <option value="">Selecione o Tipo...</option>
                    <option value="Geladeira">Geladeira</option>
                    <option value="Freezer">Freezer</option>
                    <option value="Câmara Fria">Câmara Fria</option>
                  </select>
                  <input type="number" step="0.1" placeholder="Temp. Mín. (°C)" value={formEquip.temp_min} onChange={e => setFormEquip({...formEquip, temp_min: e.target.value})} required />
                  <input type="number" step="0.1" placeholder="Temp. Máx. (°C)" value={formEquip.temp_max} onChange={e => setFormEquip({...formEquip, temp_max: e.target.value})} required />
                  
                  {/* NOVOS CAMPOS AQUI */}
                  <input type="number" placeholder="Int. Degelo (Horas)" value={formEquip.intervalo_degelo} onChange={e => setFormEquip({...formEquip, intervalo_degelo: e.target.value})} required />
                  <input type="number" placeholder="Duração Degelo (Minutos)" value={formEquip.duracao_degelo} onChange={e => setFormEquip({...formEquip, duracao_degelo: e.target.value})} required />

                  <button type="submit" className="btn btn-primary">Adicionar</button>
                </form>
              </div>

              <div className="card table-responsive">
                <h3>Equipamentos Monitorados</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Tipo</th>
                      <th>Faixa Ideal</th>
                      <th>Degelo</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipamentos.map(eq => (
                      <tr key={eq.id}>
                        <td><strong>{eq.nome}</strong></td>
                        <td>{eq.tipo}</td>
                        <td>{eq.temp_min}°C a {eq.temp_max}°C</td>
                        {/* EXIBIÇÃO DA INFO */}
                        <td>A cada {eq.intervalo_degelo}h (por {eq.duracao_degelo} min)</td>
                        <td>
                          <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem' }} onClick={() => excluirEquipamento(eq.id)}>
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {abaAtiva === 'relatorios' && (
            <div className="anim-fade-in card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Histórico de Temperaturas</h3>
                <select className="select-input" value={periodoRelatorio} onChange={(e) => setPeriodoRelatorio(e.target.value)}>
                  <option value="diario">Últimas 24 Horas</option>
                  <option value="semanal">Últimos 7 Dias</option>
                  <option value="mensal">Últimos 30 Dias</option>
                </select>
              </div>
              <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="table">
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)' }}>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Equipamento</th>
                      <th>Temperatura Lida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorios.length > 0 ? relatorios.map(rel => (
                      <tr key={rel.id}>
                        <td>{new Date(rel.data_hora).toLocaleString()}</td>
                        <td>{rel.nome}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{rel.temperatura}°C</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nenhum dado encontrado no período.</td></tr>
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