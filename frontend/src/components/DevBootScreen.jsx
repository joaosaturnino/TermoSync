import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Server, Power, Lock, Terminal, ShieldAlert, Volume2, VolumeX, Palette, Monitor, Cpu } from 'lucide-react';
import { getApiUrl } from '../config/api';

const DevBootScreen = ({ onComplete }) => {
  const [bootStarted, setBootStarted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attempts, setBlockedAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);
  
  // Telemetria real da máquina host
  const [hostInfo, setHostInfo] = useState(null);

  // Histórico de comandos (setas Cima/Baixo)
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Configurações Visuais e de Áudio
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [themeColor, setThemeColor] = useState('#10b981');
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [clockStr, setClockStr] = useState('');

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const skipRef = useRef(false);

  // Logo ASCII
  const asciiLogo = `
 ████████╗██╗  ██╗███████╗██████╗ ███╗   ███╗██████╗ ███████╗██╗   ██╗███╗   ██╗ ██████╗
 ╚══██╔══╝██║  ██║██╔════╝██╔══██╗████╗ ████║██╔═══██╗██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
    ██║   ███████║█████╗  ██████╔╝██╔████╔██║██║   ██║███████╗ ╚████╔╝ ██╔██╗ ██║██║     
    ██║   ██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██║   ██║╚════██║  ╚██╔╝  ██║╚██╗██║██║     
    ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║╚██████╔╝███████║   ██║   ██║ ╚████║╚██████╗
    ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝
`;

  // Busca dados reais do hardware ao montar o terminal
  useEffect(() => {
    const fetchHostInfo = async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/system/host-info`);
        if (res.data?.success) {
          setHostInfo(res.data);
        }
      } catch (err) {
        console.warn('⚠️ [AVISO] Mantendo fallback de hardware genérico.');
      }
    };
    fetchHostInfo();
  }, []);

  useEffect(() => { 
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showInput]);

  useEffect(() => {
    const updateClock = () => {
      setClockStr(new Date().toLocaleTimeString('pt-BR'));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const playSound = useCallback((frequency, type, duration) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }, [soundEnabled]);

  const playTyping = useCallback(() => playSound(950, 'square', 0.025), [playSound]);
  const playSuccess = useCallback(() => { 
    playSound(523.25, 'square', 0.08); 
    setTimeout(() => playSound(659.25, 'square', 0.08), 80);
    setTimeout(() => playSound(783.99, 'square', 0.15), 160);
  }, [playSound]);
  const playError = useCallback(() => playSound(130, 'sawtooth', 0.35), [playSound]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showInput && bootStarted && (e.key === 'Enter' || e.key === 'Escape')) {
        skipRef.current = true;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInput, bootStarted]);

  useEffect(() => {
    if (!bootStarted) return;

    let isMounted = true;
    const sleep = ms => new Promise(r => setTimeout(r, skipRef.current ? 0 : ms));
    const genHex = () => Math.random().toString(16).substring(2, 10).toUpperCase();

    // Textos reais da máquina host com fallbacks
    const cpuName = hostInfo ? `${hostInfo.cpu.model} (${hostInfo.cpu.cores}-Core)` : 'AMD EPYC 9754 128-Core Processor @ 3.20GHz';
    const totalRamMB = hostInfo ? `${hostInfo.memory.totalMB}M` : '32768M';
    const osType = hostInfo ? `${hostInfo.os.type} ${hostInfo.os.release} (${hostInfo.os.arch})` : 'Linux thermosync-core 6.8.0-sentinel x86_64';
    const hostName = hostInfo?.os?.hostname || 'thermosync';

    const runBootSequence = async () => {
      const sequence = [
        { text: `ThermoSync Sentinel OS [Host: ${hostName}]`, delay: 50, color: '#e2e8f0', isBold: true },
        { text: "(c) 2026 ThermoSync Enterprise Corporation. All rights reserved.\n", delay: 80, color: '#94a3b8' },
        { text: "BIOS/UEFI MEMORY CHECK: 640K Base Memory ... OK", delay: 60, color: '#475569' },
        { text: `EXTENDED SYSTEM RAM:  ${totalRamMB} System RAM ... TESTED OK`, delay: 80, color: '#475569' },
        { text: asciiLogo, delay: 90, color: themeColor, isPre: true },
        { text: "================================================================================", delay: 20, color: '#334155' },
        { text: `CPU: ${cpuName}`, delay: 50 },
        { text: `SYSTEM PLATFORM: ${osType}`, delay: 50 },
        { text: "KERNEL: Loading security modules & environmental sensor drivers...", delay: 90 },
        { text: "[  OK  ] I2C Bus Address 0x40 -> Sensor DHT22 Temp/Humi calibrated.", delay: 40, color: themeColor },
        { text: "[  OK  ] Broker MQTT Pipeline online -> TCP/1883 [SSL/TLS 1.3]", delay: 50, color: themeColor },
        { text: `[  OK  ] Connected to Data Core Cluster [ 104.28.192.12:3000 ]`, delay: 90, color: '#38bdf8' },
        { text: "--------------------------------------------------------------------------------", delay: 20, color: '#334155' }
      ];

      for (let i = 0; i < 5; i++) {
        sequence.push({ 
          text: `[ SYNC ] Synchronizing data node shard [0x${genHex()}] -> REPLICA_ACK`, 
          delay: 25 + Math.random() * 25, 
          color: '#64748b' 
        });
      }

      sequence.push(
        { text: "--------------------------------------------------------------------------------", delay: 20, color: '#334155' },
        { text: "[  OK  ] Relational Engine: MySQL Enterprise Pool connected.", delay: 60, color: themeColor },
        { text: "[  OK  ] Cryptographic Vault: AES-256-GCM Keystore unsealed.", delay: 60, color: themeColor },
        { text: "[ WARN ] NETWORK SECURITY OPERATION CENTER (SOC) ACTIVATED.", delay: 120, color: '#f59e0b', isBold: true },
        { text: "[ALERTA] PROTOCOLO ZERO-TRUST EM VIGOR — AUDITORIA ATIVA.", delay: 120, color: '#ef4444', isBold: true },
        { text: "\nACESSO RESTRITO — INSIRA A CREDENCIAL MASTER (OU DIGITE 'help'):", delay: 60, color: '#f8fafc', isBold: true }
      );

      for (let i = 0; i < sequence.length; i++) {
        if (!isMounted) return;
        await sleep(sequence[i].delay);
        if (!skipRef.current) {
          if (sequence[i].color === '#ef4444') playSound(280, 'sawtooth', 0.12); 
          else playTyping();
        }
        setLogs(prev => [...prev, sequence[i]]);
      }
      if (isMounted) setShowInput(true);
    };

    runBootSequence();
    return () => { isMounted = false; };
  }, [bootStarted, playSound, playTyping, themeColor, hostInfo]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && attempts >= 3) {
      setShowInput(true);
      setBlockedAttempts(0);
      setLogs(prev => [...prev, { text: "[ SECURITY ] Lockout suspenso. Terminal destrancado.", color: '#38bdf8' }]);
    }
  }, [countdown, attempts]);

  useEffect(() => { 
    if (showInput && inputRef.current && !isProcessing && countdown === 0) {
      inputRef.current.focus();
    }
  }, [showInput, isProcessing, countdown]);

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIdx = historyIndex + 1 < cmdHistory.length ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIdx);
        setPasscode(cmdHistory[cmdHistory.length - 1 - nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setPasscode(cmdHistory[cmdHistory.length - 1 - nextIdx] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setPasscode('');
      }
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!passcode.trim() || isProcessing || countdown > 0) return;
    
    const typed = passcode.trim();
    setPasscode('');
    setCmdHistory(prev => [...prev, typed]);
    setHistoryIndex(-1);

    const publicCommands = ['help', 'status', 'clear', 'reboot', 'whoami', 'uname -a', 'date', 'netstat'];
    const isPublicCommand = publicCommands.includes(typed.toLowerCase());

    const hostName = hostInfo?.os?.hostname || 'thermosync';
    const displayTyped = isPublicCommand ? typed : typed.replace(/./g, '●');
    setLogs(prev => [...prev, { text: `root@${hostName}:~$ ${displayTyped}`, color: themeColor }]);

    const cmd = typed.toLowerCase();
    if (cmd === 'help') {
      playTyping();
      setLogs(prev => [
        ...prev, 
        { text: "COMANDOS AUXILIARES DISPONÍVEIS:", color: '#f59e0b', isBold: true },
        { text: "  status     : Inspecionar portas de rede, serviços e daemons ativos.", color: '#cbd5e1' },
        { text: "  whoami     : Exibir o contexto de privilégios da sessão atual.", color: '#cbd5e1' },
        { text: "  netstat    : Inspecionar portas TCP/UDP e brokers MQTT.", color: '#cbd5e1' },
        { text: "  uname -a   : Informações reais do Host/OS do servidor.", color: '#cbd5e1' },
        { text: "  date       : Exibir relógio do relé de temporização do host.", color: '#cbd5e1' },
        { text: "  clear      : Limpar o histórico atual da tela do terminal.", color: '#cbd5e1' },
        { text: "  reboot     : Reiniciar a sequência de inicialização do terminal.\n", color: '#cbd5e1' },
        { text: "[ SEGURANÇA ] Para obter acesso SysAdmin, digite diretamente a sua CREDENCIAL MASTER secreta.", color: themeColor, isBold: true }
      ]);
      return;
    }

    if (cmd === 'clear') {
      playTyping();
      setLogs([]);
      return;
    }

    if (cmd === 'status') {
      playTyping();
      setLogs(prev => [
        ...prev,
        { text: "STATUS INTEGRADO DO SISTEMA:", color: themeColor, isBold: true },
        { text: `  [OK] Hostname     - ${hostName} (${hostInfo ? hostInfo.cpu.cores + ' CPUs' : 'Active'})`, color: '#cbd5e1' },
        { text: "  [OK] MQTT Broker  - TCP 1883  (Latência: 12ms)", color: '#cbd5e1' },
        { text: "  [OK] MySQL Core   - TCP 3306  (Pool: 10/10 active)", color: '#cbd5e1' },
        { text: "  [OK] Zero-Trust   - SOC IDS   (Assinatura atualizada)\n", color: '#cbd5e1' }
      ]);
      return;
    }

    if (cmd === 'whoami') {
      playTyping();
      setLogs(prev => [...prev, { text: `root (UID: 0 — Host: ${hostName})\n`, color: '#38bdf8' }]);
      return;
    }

    if (cmd === 'uname -a') {
      playTyping();
      const kernelText = hostInfo 
        ? `${hostInfo.os.kernelString} #1 SMP PREEMPT_DYNAMIC GNU/Linux` 
        : "Linux thermosync-core 6.8.0-sentinel #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux";
      setLogs(prev => [...prev, { text: `${kernelText}\n`, color: '#cbd5e1' }]);
      return;
    }

    if (cmd === 'date') {
      playTyping();
      setLogs(prev => [...prev, { text: `${new Date().toUTCString()} [America/Sao_Paulo]\n`, color: '#cbd5e1' }]);
      return;
    }

    if (cmd === 'netstat') {
      playTyping();
      setLogs(prev => [
        ...prev,
        { text: "Proto Recv-Q Send-Q Local Address           Foreign Address         State", color: '#94a3b8' },
        { text: "tcp        0      0 0.0.0.0:1883            0.0.0.0:*               LISTEN", color: '#cbd5e1' },
        { text: "tcp        0      0 0.0.0.0:3306            0.0.0.0:*               LISTEN", color: '#cbd5e1' },
        { text: "tcp        0      0 104.28.192.12:443       192.168.1.104:52844     ESTABLISHED\n", color: '#cbd5e1' }
      ]);
      return;
    }

    if (cmd === 'reboot') {
      playTyping();
      setLogs([]);
      setShowInput(false);
      skipRef.current = false;
      setTimeout(() => {
        setBootStarted(false);
        setTimeout(() => setBootStarted(true), 200);
      }, 500);
      return;
    }

    // ========================================================================
    // VALIDAÇÃO SEGURA NO BANCO DE DADOS (ZERO-TRUST COMPLIANCE)
    // ========================================================================
    setIsProcessing(true);
    setShowInput(false);
    
    await new Promise(r => setTimeout(r, 400));
    playTyping();
    
    try {
      const res = await axios.post(`${getApiUrl()}/system/verify-root-passcode`, {
        passcode: typed
      });

      if (res.data.success) {
        playSuccess();
        setLogs(prev => [...prev, { text: "AUTHENTICATION SUCCESS: ROOT PRIVILEGES GRANTED (UID: 0)", color: themeColor, isBold: true }]);
        await new Promise(r => setTimeout(r, 350));
        setLogs(prev => [...prev, { text: "Carregando ambiente operacional SysAdmin...", color: '#94a3b8' }]);
        await new Promise(r => setTimeout(r, 500));
        onComplete();
      } else {
        throw new Error('Credencial inválida');
      }
    } catch (error) {
      playError();
      const nextAttempts = attempts + 1;
      setBlockedAttempts(nextAttempts);
      
      setLogs(prev => [...prev, { text: `[  ERR  ] CREDENCIAL ROOT INVÁLIDA. INCIDENTE REGISTRADO NO HISTÓRICO DE AUDITORIA.`, color: '#ef4444', isBold: true }]);
      
      if (nextAttempts >= 3) {
        setCountdown(15);
        setLogs(prev => [...prev, { text: `[LOCKOUT] Alerta de Brute-Force acionado. Terminal suspenso por 15s.`, color: '#ef4444' }]);
        setIsProcessing(false);
      } else {
        await new Promise(r => setTimeout(r, 350));
        setShowInput(true);
        setIsProcessing(false);
      }
    }
  };

  const fontMonospace = 'Consolas, "Courier New", "JetBrains Mono", "Lucida Console", monospace';

  // BIOS POST Screen com especificações reais
  if (!bootStarted) {
    const biosCpu = hostInfo ? `${hostInfo.cpu.model} (${hostInfo.cpu.cores}-Core)` : 'AMD EPYC 9754 128-Core @ 3.20GHz';
    const biosRamKB = hostInfo ? (hostInfo.memory.totalMB * 1024) + 'K' : '33554432K';
    const biosHost = hostInfo?.os?.hostname || 'THERMOSYNC SENTINEL UEFI';

    return (
      <div style={{ 
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', 
        alignItems: 'center', background: '#000000', color: '#aaaaaa', fontFamily: fontMonospace,
        padding: '2rem'
      }}>
        <div style={{ maxWidth: '720px', width: '100%', fontSize: '0.9rem', lineHeight: '1.6' }}>
          <div style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '1rem', borderBottom: '2px solid #555555', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>AMERICAN MEGATRENDS BIOS (C) 2026</span>
            <span>{biosHost}</span>
          </div>
          <p>Main Processor : {biosCpu}</p>
          <p>Memory Testing : {biosRamKB} OK</p>
          <p>Primary Master : NVMe Multi-Tenant Array RAID-0 [OK]</p>
          <p>Security Chip  : Zero-Trust Cryptographic Keystore [LOCKED]</p>
          <br />
          <p style={{ color: themeColor }}>Press [INITIALIZE] to load Linux Kernel /dev/tty1 Console...</p>
          
          <div style={{ marginTop: '2rem' }}>
            <button 
              onClick={() => setBootStarted(true)} 
              style={{ 
                background: themeColor, 
                color: '#000000', 
                fontFamily: fontMonospace, 
                fontWeight: 'bold',
                fontSize: '0.9rem', 
                padding: '10px 24px', 
                border: 'none', 
                cursor: 'pointer',
                textTransform: 'uppercase',
                boxShadow: `0 0 15px ${themeColor}66`
              }}
            >
              &gt; BOOT THERMOSYNC SENTINEL CLI
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentHost = hostInfo?.os?.hostname || 'thermosync';

  return (
    <>
      <style>{`
        @keyframes crt-flicker {
          0% { opacity: 0.98; }
          50% { opacity: 1; }
          100% { opacity: 0.97; }
        }
        @keyframes cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .crt-scanlines {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%, 
            rgba(0, 0, 0, 0.25) 50%
          );
          background-size: 100% 4px;
          z-index: 1000;
          pointer-events: none;
        }
        .crt-glow {
          text-shadow: 0 0 3px currentColor;
        }
      `}</style>

      <div 
        onClick={() => { if (showInput && countdown === 0) inputRef.current?.focus(); }} 
        style={{ 
          position: 'fixed', inset: 0, background: '#030508', zIndex: 9999, 
          display: 'flex', flexDirection: 'column', fontFamily: fontMonospace,
          animation: crtEnabled ? 'crt-flicker 0.15s infinite' : 'none'
        }}
      >
        {crtEnabled && <div className="crt-scanlines" />}

        <div style={{ 
          background: '#0d131f', borderBottom: '1px solid #1e293b', padding: '6px 14px', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          userSelect: 'none', zIndex: 1001 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 'bold' }}>
            <Terminal size={14} color={themeColor} />
            <span>Command Prompt — root@{currentHost}:/dev/tty1 — 80x24</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#64748b', fontSize: '0.8rem' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setCrtEnabled(!crtEnabled); }}
              style={{ background: 'transparent', border: 'none', color: crtEnabled ? themeColor : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
              title="Alternar efeito Monitor CRT"
            >
              <Monitor size={13} />
              <span>CRT</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #334155', borderLeft: '1px solid #334155', padding: '0 10px' }}>
              <Palette size={13} color="#94a3b8" />
              {[
                { color: '#10b981', title: 'Verde Hacker' },
                { color: '#f59e0b', title: 'Âmbar Retro' },
                { color: '#38bdf8', title: 'Ciano Cyber' },
                { color: '#f8fafc', title: 'Branco Clássico' }
              ].map(t => (
                <button 
                  key={t.color}
                  onClick={(e) => { e.stopPropagation(); setThemeColor(t.color); }} 
                  title={t.title}
                  style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.color, border: themeColor === t.color ? '2px solid white' : 'none', cursor: 'pointer' }}
                />
              ))}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
              style={{ background: 'transparent', border: 'none', color: soundEnabled ? themeColor : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={soundEnabled ? 'Silenciar Áudio' : 'Ativar Áudio'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <span>─</span>
            <span>□</span>
            <span>✕</span>
          </div>
        </div>

        {!showInput && countdown === 0 && (
          <div style={{ position: 'absolute', top: '44px', right: '20px', color: '#475569', fontSize: '0.75rem', zIndex: 10 }}>
            [ENTER] pular inicialização
          </div>
        )}

        <div className={crtEnabled ? 'crt-glow' : ''} style={{ background: 'transparent', padding: '1.25rem', flex: 1, overflowY: 'auto', fontSize: '0.86rem', zIndex: 1001 }}>
          {logs.map((log, index) => (
            <div 
              key={index} 
              style={{ 
                color: log.color || '#cbd5e1', 
                fontWeight: log.isBold ? 'bold' : 'normal', 
                whiteSpace: 'pre-wrap', 
                lineHeight: '1.35',
                marginBottom: '2px'
              }}
            >
              {log.isPre ? <pre style={{ margin: 0, padding: 0, fontFamily: fontMonospace, lineHeight: '1.1' }}>{log.text}</pre> : log.text}
            </div>
          ))}
          
          {showInput && countdown === 0 && (
            <form onSubmit={handleAuth} style={{ display: 'flex', marginTop: '10px', alignItems: 'center' }}>
              <span style={{ color: themeColor, fontWeight: 'bold', marginRight: '8px' }}>root@{currentHost}:~$</span>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', position: 'relative' }}>
                <input 
                  ref={inputRef} 
                  type="password" 
                  value={passcode} 
                  onChange={e => setPasscode(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Digite a credencial master ou 'help'..."
                  autoComplete="off" 
                  disabled={isProcessing} 
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: '#ffffff', 
                    outline: 'none', 
                    fontFamily: fontMonospace, 
                    fontSize: '0.86rem',
                    width: '100%', 
                    caretColor: 'transparent', 
                    letterSpacing: '1px' 
                  }} 
                />
                <span 
                  style={{ 
                    display: 'inline-block', 
                    width: '9px', 
                    height: '1.1em', 
                    background: themeColor, 
                    marginLeft: '4px',
                    animation: 'cursor-blink 1s step-end infinite'
                  }}
                />
              </div>
            </form>
          )}

          {countdown > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', padding: '12px 16px', color: '#ef4444', fontSize: '0.85rem', marginTop: '16px', fontWeight: 'bold', display: 'inline-block' }}>
              <Lock size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              DISPOSITIVO BLOQUEADO (ANTI BRUTE-FORCE): AGUARDE {countdown}s PARA NOVA TENTATIVA...
            </div>
          )}
          <div ref={bottomRef} style={{ paddingBottom: '20px' }} />
        </div>

        <div style={{ background: '#090d16', borderTop: '1px solid #1e293b', padding: '4px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.72rem', zIndex: 1001 }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <span>MEM: {hostInfo ? hostInfo.memory.totalMB + 'M' : '32768M'}</span>
            <span>SEC: AES-256-GCM</span>
            <span>STATUS: ZERO-TRUST ACTIVE</span>
          </div>
          <div style={{ color: '#94a3b8', fontWeight: 'bold' }}>
            {clockStr}
          </div>
        </div>
      </div>
    </>
  );
};

export default DevBootScreen;