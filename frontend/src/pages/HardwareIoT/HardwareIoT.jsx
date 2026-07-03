import React, { useState, useEffect, useMemo } from 'react';
import { 
  Cpu, Activity, RefreshCw, Server, Power, Search, MapPin, 
  Loader2, Zap, ServerCrash, TerminalSquare 
} from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../../config/api.js';
import './HardwareIoT.css';

// Sub-componente: Renderiza graficamente a força do sinal Wi-Fi
const WifiBars = ({ dbm, isOffline }) => {
  let signalLevel = 'signal-offline';
  if (!isOffline) {
    if (dbm > -60) signalLevel = 'signal-excellent';
    else if (dbm > -70) signalLevel = 'signal-good';
    else if (dbm > -80) signalLevel = 'signal-weak';
    else signalLevel = 'signal-bad';
  }

  return (
    <div className={`wifi-bars-container ${signalLevel}`} title={isOffline ? 'Desconectado' : `${dbm} dBm`}>
      <div className="wifi-bar"></div>
      <div className="wifi-bar"></div>
      <div className="wifi-bar"></div>
      <div className="wifi-bar"></div>
    </div>
  );
};

export default function HardwareIoT({ equipamentos, showToast, isOffline }) {
  const [hwNodes, setHwNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // UX: Armazena o ID do nó que está a executar OTA ou Reboot
  const [actionLoading, setActionLoading] = useState({ id: null, type: null });

  const carregarHardware = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const token = sessionStorage.getItem('token');
      const resposta = await axios.get(`${getApiUrl()}/hardware`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const agora = new Date().getTime();
      
      const formatado = resposta.data.map(eq => {
        // SLA: Considera offline se sem heartbeat > 3 minutos (180.000 ms)
        const tempoDesdeUltimoSinal = eq.ultima_comunicacao ? (agora - new Date(eq.ultima_comunicacao).getTime()) : 999999999;
        const isNodeOffline = tempoDesdeUltimoSinal > 180000;
        
        return {
          ...eq,
          mac: eq.mac || '00:00:00:00:00:00',
          ip: eq.ip || '0.0.0.0',
          signal: eq.signal_dbm || -100,
          uptime: eq.uptime || '0h',
          fwVersion: eq.fwVersion || 'v1.0.0',
          isNodeOffline
        };
      });
      
      setHwNodes(formatado);
    } catch (error) {
      showToast('Erro de sincronização com os clusters Edge.', 'error');
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 500);
        showToast('Varredura de sub-rede concluída.', 'success');
      }
    }
  };

  useEffect(() => {
    if (!isOffline) {
      carregarHardware();
      const interval = setInterval(carregarHardware, 10000); // Polling (Heartbeat verification)
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isOffline]);

  const nodesFiltrados = useMemo(() => {
    if (!busca.trim()) return hwNodes;
    const termo = busca.toLowerCase();
    return hwNodes.filter(n => 
      n.nome?.toLowerCase().includes(termo) || 
      n.ip?.toLowerCase().includes(termo) ||
      n.mac?.toLowerCase().includes(termo)
    );
  }, [hwNodes, busca]);

  const kpis = useMemo(() => {
    const total = hwNodes.length;
    let online = 0; let offline = 0;
    hwNodes.forEach(n => { if (n.isNodeOffline) offline++; else online++; });
    return { total, online, offline };
  }, [hwNodes]);

  // Ações Táticas Simuladas (Reboot & Flash)
  const executarAcaoNoHardware = async (idNode, nome, tipo) => {
    if (isOffline) return showToast('Control Plane Offline. Canal MQTT inacessível.', 'error');
    
    setActionLoading({ id: idNode, type: tipo });
    showToast(`Estabelecendo handshake TCP com ${nome}...`, 'info');
    
    // Simula o tempo de latência de uma rede IoT Real
    setTimeout(() => {
      setActionLoading({ id: null, type: null });
      if (tipo === 'REBOOT') {
        showToast(`[SIGTERM] Sucesso. Nó ${nome} está reiniciando.`, 'warning');
      } else {
        showToast(`[OTA] Novo Firmware injetado na ROM de ${nome}.`, 'success');
      }
    }, 2500);
  };

  return (
    <div className="hardware-wrapper">
      
      {/* HEADER TÁTICO & SEARCH BARS */}
      <div className="edge-header-actions">
        <div>
          <h3 className="edge-title-modern">
            <div className="icon-box-primary"><Server size={24} /></div>
            Gestão de Edge Computing
          </h3>
          <p className="text-muted" style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
            Monitoramento Gêmeo Digital (Digital Twin) e envio de payloads MQTT para o hardware.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="search-modern">
            <Search size={18} color="var(--text-muted)" style={{marginRight: '8px'}} />
            <input type="text" placeholder="Filtrar IP, MAC ou Nome..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => carregarHardware(true)} disabled={isOffline} style={{padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold'}}>
            {isRefreshing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />} SCAN
          </button>
        </div>
      </div>

      {/* KPI GLASSMORPHISM BAR */}
      <div className="edge-kpi-bar">
        <div className="kpi-card-modern info">
          <div style={{color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '12px', borderRadius: '12px'}}>
            <Cpu size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.total}</span>
            <span className="kpi-label-modern">Nós End-Point</span>
          </div>
        </div>
        
        <div className="kpi-card-modern success">
          <div style={{color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px'}}>
            <Zap size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.online}</span>
            <span className="kpi-label-modern">Telemetria Ativa</span>
          </div>
        </div>
        
        <div className="kpi-card-modern danger">
          <div style={{color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px'}}>
            <ServerCrash size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.offline}</span>
            <span className="kpi-label-modern">Sinal Interrompido</span>
          </div>
        </div>
      </div>

      {/* NÓS DA REDE (DIGITAL TWINS) */}
      <div className="iot-fleet-grid">
        {loading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
             <Loader2 size={48} className="spin" style={{ opacity: 0.5, margin: '0 auto 1.5rem auto', display: 'block', color: 'var(--primary)' }} />
             <p style={{ fontWeight: 'bold', letterSpacing: '1px' }}>Sincronizando Twin Digital com Cluster MQTT...</p>
          </div>
        ) : nodesFiltrados.map(node => (
          <div key={node.id} className={`iot-node-card ${node.isNodeOffline ? 'card-offline' : 'card-online'}`}>
            
            {/* OVERLAY DE LOADING APLICADO AO CARD INDIVIDUAL */}
            {actionLoading.id === node.id && (
              <div className="node-overlay-loading">
                <Loader2 size={36} className="spin" />
                <span>{actionLoading.type === 'REBOOT' ? 'INICIANDO COLD BOOT...' : 'FLASHING ROM (OTA)...'}</span>
              </div>
            )}

            <div className="node-header">
              <div className="node-ident">
                <Cpu size={36} className="hw-icon" />
                <div>
                  <div className="node-name">{node.nome}</div>
                  <div className="node-location">
                    <MapPin size={12}/> {node.filial || 'Matriz Core'}
                  </div>
                </div>
              </div>
              <div className="node-status-box">
                 <div className={`status-led ${node.isNodeOffline ? 'led-offline' : 'led-online'}`}></div>
                 <div className={`node-status ${node.isNodeOffline ? 'status-offline' : 'status-online'}`}>
                   {node.isNodeOffline ? 'OFFLINE' : 'ONLINE'}
                 </div>
              </div>
            </div>

            <div className="node-specs">
              <div className="spec-item">
                <span className="spec-label">Endereço IPv4 (WLAN)</span>
                <span className="spec-value" style={{color: '#38bdf8'}}>{node.ip}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Endereço MAC Físico</span>
                <span className="spec-value">{node.mac}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Sinal Rádio (WIFI)</span>
                <span className="spec-value">
                  <WifiBars dbm={node.signal} isOffline={node.isNodeOffline} />
                  {node.isNodeOffline ? 'DROP' : `${node.signal} dBm`}
                </span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Tempo Ativo (Uptime)</span>
                <span className="spec-value">{node.isNodeOffline ? 'ERR_TIMEOUT' : node.uptime}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Versão ROM (OTA)</span>
                <span className="spec-value" style={{ color: '#10b981' }}>{node.fwVersion}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Último Heartbeat (PONG)</span>
                <span className="spec-value" style={{color: node.isNodeOffline ? '#ef4444' : 'inherit'}}>
                  {node.ultima_comunicacao ? new Date(node.ultima_comunicacao).toLocaleTimeString('pt-BR') : 'Sem registo'}
                </span>
              </div>
            </div>

            <div className="node-actions">
              <button 
                className="btn-node btn-reboot" 
                onClick={() => executarAcaoNoHardware(node.id, node.nome, 'REBOOT')} 
                title="Forçar reinício via MQTT"
                disabled={actionLoading.id !== null || node.isNodeOffline}
              >
                <Power size={14} /> REBOOT SIGTERM
              </button>
              <button 
                className="btn-node btn-ota" 
                onClick={() => executarAcaoNoHardware(node.id, node.nome, 'OTA')} 
                title="Descarregar novo firmware via OTA"
                disabled={actionLoading.id !== null || node.isNodeOffline}
              >
                <RefreshCw size={14} /> INJETAR OTA
              </button>
            </div>

          </div>
        ))}

        {!loading && nodesFiltrados.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
            <TerminalSquare size={56} style={{ opacity: 0.2, margin: '0 auto 1.5rem auto', display: 'block' }} />
            <p style={{ fontSize: '1.2rem', fontWeight: '900', color: 'white' }}>Nenhum Nó Edge localizado.</p>
            <p style={{ fontSize: '0.9rem' }}>Verifique as regras de Firewall ou a integridade do Broker MQTT.</p>
          </div>
        )}
      </div>
    </div>
  );
}