import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Server, Power, Lock } from 'lucide-react';

const DevBootScreen = ({ onComplete }) => {
  const [bootStarted, setBootStarted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attempts, setBlockedAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);
  
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const skipRef = useRef(false);

  const asciiLogo = `
  ______                           _____                  
 /_  __/___  _________ ___  ____  / ___/__  ______  _____ 
  / / / __ \\/ ___/ __ \`__ \\/ __ \\ \\__ \\/ / / / __ \\/ ___/ 
 / / / /_/ / /  / / / / / / /_/ /___/ / /_/ / / / / /__   
/_/  \\____/_/  /_/ /_/ /_/\\____//____/\\__, /_/ /_/\\___/   
                                     /____/               
`;

  useEffect(() => { 
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); 
  }, [logs, showInput]);

  // Sons Sintetizados via AudioContext API
  const playSound = useCallback((frequency, type, duration) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }, []);

  const playTyping = useCallback(() => playSound(800, 'sine', 0.05), [playSound]);
  const playSuccess = useCallback(() => { playSound(600, 'sine', 0.1); setTimeout(() => playSound(1200, 'sine', 0.3), 100); }, [playSound]);
  const playError = useCallback(() => playSound(150, 'sawtooth', 0.4), [playSound]);

  // Detetar Teclas para "Skip Boot"
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
    const genHex = () => Math.random().toString(16).substring(2, 12).toUpperCase();

    const runBootSequence = async () => {
      const sequence = [
        { text: asciiLogo, delay: 100, color: '#10b981', isPre: true },
        { text: "⚡ TERMOSYNC CORE SYSTEM v13.1.SENTINEL", delay: 200, color: '#10b981', isBold: true },
        { text: "INITIALIZING FIRMWARE HARDWARE INTERFACE...", delay: 100, color: '#94a3b8' },
        { text: "------------------------------------------------------------", delay: 50, color: '#475569' },
        { text: "CPU: AMD EPYC 9754 Core @ 3.20GHz (Hyper-Threading: ACTIVE)", delay: 80 },
        { text: "STORAGE: Multi-Tenant NVMe Array Partition mounted on /dev/sda1", delay: 80 },
        { text: "I2C BUS CORES: Scanning for physical environmental sensors...", delay: 200 },
        { text: "[  OK  ] Sensor Temp/Humi DHT22 detected on Address 0x40", delay: 50, color: '#10b981' },
        { text: "[  OK  ] Broker MQTT Pipeline mapped on port 1883", delay: 120, color: '#10b981' },
        { text: "NETWORK: Initializing TLS 1.3 socket negotiation...", delay: 150 },
        { text: `CONNECTING TO MASTER REPLICA [ 104.28.192.12:3000 ]...`, delay: 300, color: '#38bdf8' }
      ];

      for (let i = 0; i < 6; i++) {
        sequence.push({ 
          text: `[ STAGE_${i} ] Syncing data node index [0x${genHex().substring(0,4)}]... CONNECTED`, 
          delay: 40 + Math.random() * 40, 
          color: '#475569' 
        });
      }

      sequence.push(
        { text: "------------------------------------------------------------", delay: 50, color: '#475569' },
        { text: "[  OK  ] Relational Engine: MySQL Connection Pool established.", delay: 150, color: '#10b981' },
        { text: "[  OK  ] Cryptographic Core: AES-256 Vault unsealed.", delay: 100, color: '#10b981' },
        { text: "[ WARN ] NETWORK SECURITY OPERATION CENTER ACTIVATED.", delay: 250, color: '#eab308', isBold: true },
        { text: "[ ALERTA ] PROTOCOLO ZERO-TRUST EM VIGOR.", delay: 200, color: '#ef4444', isBold: true },
        { text: "ACESSO RESTRITO - INTRODUZA A CREDENCIAL MASTER ROOT", delay: 100, color: '#cbd5e1', isBold: true }
      );

      for (let i = 0; i < sequence.length; i++) {
        if (!isMounted) return;
        await sleep(sequence[i].delay);
        if (!skipRef.current) {
            if (sequence[i].color === '#ef4444') playSound(300, 'sawtooth', 0.15); 
            else playTyping();
        }
        setLogs(prev => [...prev, sequence[i]]);
      }
      if (isMounted) setShowInput(true);
    };

    runBootSequence();
    return () => { isMounted = false; };
  }, [bootStarted, playSound, playTyping]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && attempts >= 3) {
      setShowInput(true);
      setBlockedAttempts(0);
      setLogs(prev => [...prev, { text: "[ SECURITY ] Terminal destrancado. Tente novamente.", color: '#38bdf8' }]);
    }
  }, [countdown, attempts]);

  useEffect(() => { 
    if (showInput && inputRef.current && !isProcessing && countdown === 0) inputRef.current.focus(); 
  }, [showInput, isProcessing, countdown]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!passcode.trim() || isProcessing || countdown > 0) return;
    setIsProcessing(true);
    setShowInput(false);
    
    const typed = passcode;
    setPasscode('');
    setLogs(prev => [...prev, { text: `root@termosync:~$ ${typed.replace(/./g, '●')}`, color: '#10b981' }]);
    
    await new Promise(r => setTimeout(r, 600));
    playTyping();
    
    // ATENÇÃO: Aqui você pode colocar a palavra-passe que desejar (está "root" ou "dev")
    if (typed.toLowerCase() === 'root' || typed.toLowerCase() === 'dev') {
      playSuccess();
      setLogs(prev => [...prev, { text: "SIGNATURE CHECK: VALID ROOT Privileges Conceded.", color: '#10b981', isBold: true }]);
      await new Promise(r => setTimeout(r, 400));
      setLogs(prev => [...prev, { text: "A injetar daemons na consola de controlo...", color: '#94a3b8' }]);
      await new Promise(r => setTimeout(r, 600));
      onComplete();
    } else {
      playError();
      const nextAttempts = attempts + 1;
      setBlockedAttempts(nextAttempts);
      
      setLogs(prev => [...prev, { text: `[ FALHA ] IDENTIFICAÇÃO INCORRETA. INCIDENTE REGISTADO NO NOC.`, color: '#ef4444', isBold: true }]);
      
      if (nextAttempts >= 3) {
        setCountdown(15);
        setLogs(prev => [...prev, { text: `[ LOCKOUT ] Alerta contra Brute-Force acionado. Terminal suspenso por 15s.`, color: '#ef4444' }]);
        setIsProcessing(false);
      } else {
        await new Promise(r => setTimeout(r, 400));
        setShowInput(true);
        setIsProcessing(false);
      }
    }
  };

  if (!bootStarted) {
    return (
      <div className="root-boot-screen crt" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#010409', flexDirection: 'column' }}>
          <div className="noc-scanlines"></div>
          <div style={{ textAlign: 'center', zIndex: 10 }}>
            <Server size={64} color="#10b981" style={{ marginBottom: '20px', opacity: 0.8 }} className="pulse-icon" />
            <h1 style={{ color: 'white', fontFamily: 'JetBrains Mono', fontSize: '1.5rem', marginBottom: '10px' }}>TermoSync Core System</h1>
            <p style={{ color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: '0.85rem', marginBottom: '30px' }}>Aguardando inicialização do Operador de Rede.</p>
            <button 
              onClick={() => setBootStarted(true)} 
              className="btn btn-outline" 
              style={{ borderColor: '#10b981', color: '#10b981', fontFamily: 'JetBrains Mono', fontSize: '1rem', padding: '12px 24px', borderWidth: '2px', background: 'rgba(16, 185, 129, 0.1)' }}
            >
              <Power size={18} style={{ marginRight: '10px', display: 'inline-block' }} />
              INICIAR TERMINAL
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className={`root-boot-screen crt ${countdown > 0 ? 'red-alert-mode' : ''}`} onClick={() => { if (showInput && countdown === 0) inputRef.current?.focus(); }} style={{ position: 'fixed', inset: 0, background: '#010409', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div className="noc-scanlines"></div>
      
      {!showInput && countdown === 0 && (
          <div style={{ position: 'absolute', top: '20px', right: '30px', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: '0.75rem', zIndex: 10 }}>
            [ENTER] para saltar o boot
          </div>
      )}

      <div className="boot-terminal-box" style={{ background: 'transparent', boxShadow: 'none', position: 'relative', zIndex: 5, padding: '2rem', flex: 1, overflowY: 'auto' }}>
        {logs.map((log, index) => (
          <div key={index} className="boot-log" style={{ color: log.color || '#cbd5e1', fontWeight: log.isBold ? 'bold' : 'normal', textShadow: log.color === '#10b981' ? '0 0 4px rgba(16,185,129,0.4)' : 'none', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
            {log.isPre ? <pre style={{ margin: 0, padding: 0, fontFamily: 'inherit' }}>{log.text}</pre> : log.text}
          </div>
        ))}
        
        {showInput && countdown === 0 && (
          <form onSubmit={handleAuth} className="boot-form" style={{ display: 'flex', marginTop: '15px', position: 'relative', alignItems: 'center' }}>
            <span className="boot-prompt" style={{ color: '#10b981', fontWeight: 900, fontFamily: 'JetBrains Mono' }}>root@termosync:~$</span>
            <div className="boot-input-wrapper" style={{ display: 'flex', flex: 1, minWidth: '250px', position: 'relative', alignItems: 'center' }}>
              <input ref={inputRef} type="password" value={passcode} onChange={e => setPasscode(e.target.value)} className="boot-input" autoComplete="off" disabled={isProcessing} style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono', width: '100%', caretColor: 'transparent', letterSpacing: '2px', textShadow: '0 0 5px #fff' }} />
              <span className="boot-cursor-blink" style={{ display: 'inline-block', width: '10px', height: '1.2em', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'blink 1s step-end infinite', marginLeft: '4px' }}></span>
            </div>
          </form>
        )}

        {countdown > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '15px', color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.9rem', marginTop: '15px', fontWeight: 'bold', display: 'inline-block' }} className="pulse-icon">
            <Lock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
            DISPOSITIVO BLOQUEADO PROTOCOLO ANTI-BRUTE-FORCE: AGUARDE {countdown}s...
          </div>
        )}
        <div ref={bottomRef} style={{ paddingBottom: '20px' }} />
      </div>
    </div>
  );
};

export default DevBootScreen;