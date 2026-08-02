import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Cpu, Zap, Flame, WifiOff, AlertOctagon, Terminal as TerminalIcon,
  ShieldCheck, Siren, Sliders, Activity, Crosshair, Network, DoorOpen, ShieldAlert
} from 'lucide-react';
import './Simulador.css';

/**
 * Simulador de Telemetria
 *
 * Responsabilidades:
 * - Injetar leituras sintéticas no backend para testes e validação
 * - Permitir modos SINGLE/CLUSTER e simular falhas (degelo, rede, mecânica)
 * - Fornecer logs e mecanismos de restauração automática
 */
export default function Simulador({ api, equipamentos, showToast }) {
  const [targetMode, setTargetMode] = useState('SINGLE');
  const [eqId, setEqId] = useState('');
  const [temp, setTemp] = useState('5.0');
  const [umidade, setUmidade] = useState('60');
  const [alerta, setAlerta] = useState('NENHUM');
  const [isEnviando, setIsEnviando] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [wafActive, setWafActive] = useState(false); // NOVO: Estado do WAF

  const terminalEndRef = useRef(null);

  // Auto-scroll do terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // CORREÇÃO: Prevenção de Memory Leak na Sequência de Boot
  useEffect(() => {
    let isMounted = true;
    const timeouts = [];

    const bootSequence = [
      "[SYS] Inicializando KERNEL de Engenharia de Caos v10.5...",
      "[NET] Estabelecendo uplink criptografado com servidores NOC...",
      "[SEC] Contornando protocolos de segurança WAF/IDS...",
      "[OK]  Canal estabelecido. Aguardando comandos de injeção de payloads..."
    ];
    
    let delay = 0;
    bootSequence.forEach((msg) => {
      const t = setTimeout(() => {
        if (isMounted) {
          setTerminalLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
            payload: msg,
            tipoLog: 'SYS'
          }]);
        }
      }, delay);
      timeouts.push(t);
      delay += 500;
    });

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const adicionarLog = (payload, tipoLog = 'POST') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setTerminalLogs(prev => [...prev, {
      time: timestamp,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      tipoLog
    }]);
  };

  const limparTerminal = () => setTerminalLogs([]);

  const { defcon, threatColor, threatLabel, slaDrop } = useMemo(() => {
    if (alerta === 'NENHUM') return { defcon: 5, threatColor: 'threat-low', threatLabel: 'OPERAÇÃO NORMAL', slaDrop: '-0.00%' };
    if (alerta === 'DEGELO' || alerta === 'UMIDADE') return { defcon: 3, threatColor: 'threat-med', threatLabel: 'ANOMALIA MODERADA', slaDrop: '-0.15%' };

    const dropBase = alerta === 'REDE' ? 1.2 : 2.5;
    const dropFinal = targetMode === 'CLUSTER' ? (dropBase * (equipamentos?.length || 1)).toFixed(2) : dropBase.toFixed(2);

    return { defcon: 1, threatColor: 'threat-high', threatLabel: 'FALHA CRÍTICA', slaDrop: `-${dropFinal}%` };
  }, [alerta, targetMode, equipamentos]);

  const injetarDados = async (e) => {
    if (e) e.preventDefault();
    if (targetMode === 'SINGLE' && !eqId) return showToast('Selecione uma máquina-alvo na lista.', 'warning');

    setIsEnviando(true);
    adicionarLog(`[INIT] Iniciando ataque tipo ${alerta} em modo ${targetMode}...`, 'SYS');
    
    const dispararParaMaquina = async (idMaquina) => {
      const payload = {
        equipamento_id: idMaquina, temperatura: temp, umidade: umidade, alerta_forcado: alerta,
        consumo_kwh: (Math.random() * 2 + 1).toFixed(2), motor_ligado: alerta !== 'MECANICA',
        em_degelo: alerta === 'DEGELO', mac_address: 'CA:OS:00:FF:AA:BB', sinal_wifi: alerta === 'REDE' ? -99 : -50
      };
      await api.post('/leituras', payload);
      adicionarLog(payload, 'POST');
    };
    
    try {
      if (targetMode === 'SINGLE') {
        await dispararParaMaquina(eqId);
      } else {
        for (const eq of equipamentos) {
          await dispararParaMaquina(eq.id);
          await new Promise(r => setTimeout(r, 200));
        }
      }
      showToast(`Payload anômalo injetado com sucesso (${targetMode}).`, 'error');
    } catch (err) {
      showToast('Falha ao injetar pacote no Node principal.', 'error');
    }
    setIsEnviando(false);
  };

  const recuperarSistema = async () => {
    setIsEnviando(true);
    adicionarLog(`[RECOVERY] Inicializando protocolo de cura global...`, 'SYS');
    try {
      await api.put('/notificacoes/resolver-todas');

      const alvos = targetMode === 'SINGLE' && eqId ? [equipamentos.find(e => String(e.id) === String(eqId))] : equipamentos;
      for (const eq of alvos) {
        if (!eq) continue;
        const tempIdeal = ((parseFloat(eq.temp_max) + parseFloat(eq.temp_min)) / 2).toFixed(1);
        const payloadCura = {
          equipamento_id: eq.id, temperatura: tempIdeal || '4.0', umidade: '50', alerta_forcado: 'NENHUM',
          consumo_kwh: '0.85', motor_ligado: true, em_degelo: false, mac_address: 'RE:CO:VE:RY:00:11', sinal_wifi: -45
        };
        await api.post('/leituras', payloadCura);
        adicionarLog(payloadCura, 'PATCH');
      }

      setTemp('5.0'); setUmidade('60'); setAlerta('NENHUM');
      setWafActive(false); // Reseta o WAF na cura
      showToast('Protocolo de Restauração aplicado. Sistema normalizado.', 'success');
    } catch (err) {
      showToast('Falha ao restaurar o sistema.', 'error');
    }
    setIsEnviando(false);
  };

  const aplicarCenario = (tipo) => {
    let novaTemp = temp; let novaUmid = umidade; let novoAlerta = alerta;
    switch (tipo) {
      case 'INCENDIO': novaTemp = '85.5'; novaUmid = '20'; novoAlerta = 'TEMPERATURA'; break;
      case 'INVASAO': novoAlerta = 'PORTA_ABERTA'; break;
      case 'APAGAO': novoAlerta = 'MECANICA'; novaTemp = '12.0'; break;
      case 'OFFLINE': novoAlerta = 'REDE'; break;
      default: break;
    }
    setTemp(novaTemp); setUmidade(novaUmid); setAlerta(novoAlerta);
    showToast(`Cenário [${tipo}] carregado no buffer tático. Pressione Executar Payload.`, 'info');
  };

  // NOVA FUNÇÃO: Ativar WAF Visualmente
  const aplicarDefesaWAF = () => {
    setWafActive(true);
    adicionarLog("[WAF] Firewall de Aplicação Web Ativado. Bloqueando injeções externas.", "PATCH");
    showToast("Escudos Erguidos. Tráfego anômalo será mitigado.", "success");
  };

  return (
    <div className="simulador-wrapper anim-fade-in stagger-1">
      <div className="caos-header">
        <div className="caos-icon-box">
          <Cpu size={56} color="var(--danger)" />
        </div>
        <div style={{ zIndex: 3 }}>
          <h2 className="caos-title">Engenharia de Caos & Stress Test</h2>
          <p className="caos-subtitle">
            Ambiente de auditoria destrutiva. Utilize este terminal para forçar comportamentos anômalos,
            validar aberturas de Ordens de Serviço automáticas e testar disparos do gateway de WhatsApp do NOC.
          </p>
        </div>
      </div>
      
      <div className="caos-grid stagger-2">
        <div className="caos-panel">
          <div className="defcon-container">
            <div className="defcon-status">
              <span className={`defcon-level ${threatColor}`}>0{defcon}</span>
              <div className="defcon-desc">
                <span className="defcon-label">Nível de Ameaça (DEFCON)</span>
                <span className={`defcon-text ${threatColor}`}>{threatLabel}</span>
              </div>
            </div>
            <div className="sla-impact">
              <span className={`sla-value ${threatColor}`}>{slaDrop}</span>
              <div className="sla-label">Impacto SLA (Est.)</div>
            </div>
          </div>
          
          <h3 className="caos-panel-title"><Sliders size={20} color="var(--primary)" /> Vetor de Ataque</h3>

          <div className="target-mode-selector">
            <button className={`target-btn ${targetMode === 'SINGLE' ? 'active' : ''}`} onClick={() => setTargetMode('SINGLE')}>
              <Crosshair size={18} /> Nó Único
            </button>
            <button className={`target-btn ${targetMode === 'CLUSTER' ? 'active' : ''}`} onClick={() => setTargetMode('CLUSTER')}>
              <Network size={18} /> Ataque em Cluster
            </button>
          </div>
          
          <form onSubmit={injetarDados} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="caos-form-group anim-slide-up" style={{ display: targetMode === 'SINGLE' ? 'block' : 'none' }}>
              <label>Máquina Alvo (Target Node)</label>
              <select className="caos-input" value={eqId} onChange={e => setEqId(e.target.value)} required={targetMode === 'SINGLE'}>
                <option value="">-- Selecione o Nó IoT na Rede --</option>
                {equipamentos?.map(eq => (
                  <option key={eq.id} value={eq.id}>[{eq.id}] {eq.nome} ({eq.filial || 'Base'})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="caos-form-group" style={{ flex: 1 }}>
                <label>Modificar Temperatura (°C)</label>
                <input type="number" step="0.1" className="caos-input" value={temp} onChange={e => setTemp(e.target.value)} required />
              </div>
              <div className="caos-form-group" style={{ flex: 1 }}>
                <label>Modificar Umidade (%)</label>
                <input type="number" step="0.1" className="caos-input" value={umidade} onChange={e => setUmidade(e.target.value)} required />
              </div>
            </div>
            <div className="caos-form-group">
              <label>Payload Crítico (Flag de Alerta)</label>
              <select className="caos-input" value={alerta} onChange={e => setAlerta(e.target.value)} style={{ color: alerta !== 'NENHUM' ? 'var(--danger)' : 'var(--text-main)', fontWeight: alerta !== 'NENHUM' ? 'bold' : 'normal' }}>
                <option value="NENHUM">Operação Normal (Standby)</option>
                <option value="PORTA_ABERTA">Violação Física: Porta Aberta</option>
                <option value="REDE">Forçar Queda de Sinal (Offline)</option>
                <option value="MECANICA">Forçar Parada Abrupta (Compressor)</option>
                <option value="DEGELO">Disparar Ciclo de Degelo Falso</option>
              </select>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="submit" className="caos-btn-submit" disabled={isEnviando || (targetMode === 'SINGLE' && !eqId) || wafActive}>
                <Siren size={20} /> {isEnviando ? 'PROCESSANDO...' : 'EXECUTAR PAYLOAD'}
              </button>
              <button type="button" className="caos-btn-recovery" disabled={isEnviando} onClick={recuperarSistema}>
                <ShieldCheck size={20} /> INICIAR PROTOCOLO DE CURA
              </button>
              <button type="button" className="btn btn-outline" onClick={aplicarDefesaWAF} disabled={wafActive} style={{ borderColor: '#3b82f6', color: '#3b82f6', padding: '14px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} /> {wafActive ? 'WAF ATIVADO (BLOQUEANDO)' : 'ERGUER ESCUDOS WAF'}
              </button>
            </div>
          </form>
        </div>
        
        <div className="caos-panel">
          <h3 className="caos-panel-title"><Activity size={20} color="var(--info)" /> Operações Táticas & Logs</h3>
          <div className="cenarios-grid">
            <button type="button" className="btn-cenario" onClick={() => aplicarCenario('INCENDIO')}>
              <Flame size={20} color="#f97316" /> Sobreaquecimento
            </button>
            <button type="button" className="btn-cenario" onClick={() => aplicarCenario('APAGAO')}>
              <Zap size={20} color="#eab308" /> Parada do Motor
            </button>
            <button type="button" className="btn-cenario" onClick={() => aplicarCenario('INVASAO')}>
              <DoorOpen size={20} color="#ef4444" /> Violação (Porta)
            </button>
            <button type="button" className="btn-cenario" onClick={() => aplicarCenario('OFFLINE')}>
              <WifiOff size={20} color="#94a3b8" /> Queda de Rede
            </button>
          </div>
          
          <div className={`terminal-caos ${wafActive ? 'waf-protected' : ''}`} style={{ border: wafActive ? '2px solid #3b82f6' : '2px solid #334155', transition: '0.3s' }}>
            <div className="terminal-header">
              <span className="terminal-title"><TerminalIcon size={12} style={{marginBottom: '-2px'}}/> KERNEL_STDOUT // MATRIZ</span>
              <button onClick={limparTerminal} style={{background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold'}}>PURGE</button>
            </div>
            
            {terminalLogs.map((log, index) => (
              <div key={index} className="log-entry">
                <span className="log-time">[{log.time}]</span>
                {log.tipoLog === 'SYS' ? (
                  <span style={{ color: '#94a3b8' }}>{log.payload}</span>
                ) : (
                  <>
                    <span className={`log-status ${log.tipoLog === 'PATCH' ? 'success' : ''} ${log.tipoLog === 'SYS' ? 'log-critical' : ''}`}>
                      {log.tipoLog === 'POST' ? 'POST 201' : log.tipoLog === 'PATCH' ? 'PATCH 200' : 'SYSLOG'}
                    </span>
                    <span className="log-payload" style={{ color: log.tipoLog === 'PATCH' ? '#10b981' : log.tipoLog === 'SYS' ? '#f8fafc' : '#38bdf8' }}>
                      {log.payload}
                    </span>
                  </>
                )}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}