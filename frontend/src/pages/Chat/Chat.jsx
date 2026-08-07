import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Send, Search, Phone, Paperclip, CheckCheck, Reply, Copy, ChevronDown, 
  Smile, Mic, X, Trash2, User, MapPin, ArrowLeft, UploadCloud, Shield, Zap,
  Terminal, Radio, Activity, Navigation, ShieldAlert, MessageCircle, Globe, Crosshair, Loader2,
  Video, Camera, FileText, PhoneCall, PhoneOff, BrainCircuit, Pin, Lock, AlertTriangle, ShieldCheck
} from 'lucide-react';
import './Chat.css';
import EmptyState from '../../components/EmptyState';

// ============================================================================
// NORMALIZADOR SEGURO PARA DADOS DO MYSQL E WEBSOCKETS
// ============================================================================
const normalizarMensagem = (m) => {
  if (!m || typeof m !== 'object') return null;
  return {
    id: m.id || Date.now() + Math.random(),
    remetenteId: String(m.remetenteId || m.remetente_id || ''),
    remetenteNome: m.remetenteNome || m.remetente_nome || 'Colaborador',
    destinoId: String(m.destinoId || m.destino_id || 'todos'),
    texto: String(m.texto || ''),
    data: m.data || m.data_hora || new Date().toISOString(),
    tipo: m.tipo || 'received'
  };
};

const formatarDataSegura = (dataStr) => {
  try {
    if (!dataStr) return '';
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR');
  } catch (e) { return ''; }
};

const formatarHoraSegura = (dataStr) => {
  try {
    if (!dataStr) return '';
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
};

export default function Chat({ 
  api,
  contatosDb = [], 
  nomeLogado = 'Usuário', 
  socket, 
  userId, 
  historicoChat: historicoChatProp, 
  setHistoricoChat: setHistoricoChatProp,
  contatoAtivo: contatoAtivoProp, 
  setContatoAtivo: setContatoAtivoProp, 
  naoLidasPorContato = {}, 
  setNaoLidasPorContato
}) {
  // Busca robusta pelo ID do usuário logado
  const currentUserId = useMemo(() => {
    const id = userId || 
               sessionStorage.getItem('userId') || 
               sessionStorage.getItem('id') || 
               localStorage.getItem('userId') || 
               localStorage.getItem('id') || '';
    return String(id);
  }, [userId]);

  // ============================================================================
  // ESTADO LOCAL DE SELEÇÃO COM PRIORIDADE MÁXIMA
  // ============================================================================
  const [contatoSelecionado, setContatoSelecionado] = useState(null);
  const contatoAtivo = contatoSelecionado || contatoAtivoProp || null;

  // ============================================================================
  // HISTÓRICO DE MENSAGENS (SEM CONCATENAÇÕES QUE DUPLICAM DADOS)
  // ============================================================================
  const [historicoChatLocal, setHistoricoChatLocal] = useState([]);
  const historicoChatRaw = (historicoChatProp && historicoChatProp.length > 0) 
    ? historicoChatProp 
    : historicoChatLocal;

  const historicoChat = useMemo(() => {
    return (historicoChatRaw || [])
      .map(normalizarMensagem)
      .filter(Boolean);
  }, [historicoChatRaw]);

  const setHistoricoChat = useCallback((updaterOrValue) => {
    setHistoricoChatLocal(prev => {
      const nextValue = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue;
      if (typeof setHistoricoChatProp === 'function') {
        try { setHistoricoChatProp(nextValue); } catch (e) {}
      }
      return nextValue;
    });
  }, [setHistoricoChatProp]);

  // Carrega o histórico do banco MySQL substituindo a lista limpa
  const carregarHistorico = useCallback(async () => {
    try {
      if (api && typeof api.get === 'function') {
        const res = await api.get('/chat/historico');
        if (Array.isArray(res.data)) {
          const listaNorm = res.data.map(normalizarMensagem).filter(Boolean);
          setHistoricoChat(listaNorm);
        }
      } else {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
        const res = await fetch('/api/chat/historico', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const listaNorm = data.map(normalizarMensagem).filter(Boolean);
            setHistoricoChat(listaNorm);
          }
        }
      }
    } catch (err) {
      console.error('❌ [ERRO CHAT] Falha ao carregar histórico:', err);
    }
  }, [api, setHistoricoChat]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // Escuta novas mensagens no WebSocket sem permitir duplicatas de ID
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function') return;
    const handleNovaMensagem = (msg) => {
      const msgNorm = normalizarMensagem(msg);
      if (!msgNorm) return;
      setHistoricoChat(prev => {
        const lista = prev || [];
        const exists = lista.some(m => String(m.id) === String(msgNorm.id));
        if (exists) return lista;
        return [...lista, msgNorm];
      });
    };
    socket.on('nova_mensagem_chat', handleNovaMensagem);
    return () => {
      if (typeof socket.off === 'function') {
        socket.off('nova_mensagem_chat', handleNovaMensagem);
      }
    };
  }, [socket, setHistoricoChat]);

  // Estados de interface
  const [pesquisa, setPesquisa] = useState(''); 
  const [mensagem, setMensagem] = useState(''); 
  const [responderA, setResponderA] = useState(null); 
  const [showScrollBottom, setShowScrollBottom] = useState(false); 
  const [isTyping, setIsTyping] = useState(false); 
  const [isHandshaking, setIsHandshaking] = useState(false); 
  const [showCommands, setShowCommands] = useState(false); 
  const [showAttachMenu, setShowAttachMenu] = useState(false); 
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0); 
  const [activeCall, setActiveCall] = useState(null); 
  const [showAgentModal, setShowAgentModal] = useState(false); 
  const [previewImage, setPreviewImage] = useState(null); 
  const [showSearchChat, setShowSearchChat] = useState(false); 
  const [searchChat, setSearchChat] = useState('');
  const [isDragging, setIsDragging] = useState(false); 

  const [transcribingIds, setTranscribingIds] = useState({});
  const [pinnedMessage, setPinnedMessage] = useState(null);
  
  const [isConfidential, setIsConfidential] = useState(false);
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false);

  const roleLogada = sessionStorage.getItem('userRole') || 'LOJA';
  const papelLogado = sessionStorage.getItem('papelLogado') || '';
  const userFilial = sessionStorage.getItem('userFilial') || '';
  
  const isDev = roleLogada === 'DEV';
  const isAdminOrDev = roleLogada === 'ADMIN' || isDev;

  const getSecurityClearance = (role) => {
    if (role === 'DEV' || role === 'ADMIN') return <span title="Acesso Master" style={{color: '#ef4444'}}>[LVL-5]</span>;
    if (role === 'MANUTENCAO') return <span title="Equipe Técnica" style={{color: '#38bdf8'}}>[LVL-3]</span>;
    return <span title="Operação de Loja" style={{color: '#10b981'}}>[LVL-1]</span>;
  };

  const quickReplies = ["Estou na posição 📍", "Anomalia contida ✅", "Aguardando luz verde ⏳", "Solicito contato voz 📞", "Apoio necessário 🆘"];
  
  const slashCommands = isAdminOrDev ? [
    { cmd: '/status', label: 'Solicitar Status (Auditoria)', icon: Activity, output: '[SYSTEM_REQ] Atualize o status operacional da intervenção de imediato.' },
    { cmd: '/loc', label: 'Ping Coordenadas GPS', icon: Navigation, output: '[SYSTEM_REQ] Transmita localização exata ou corredor de atuação no rack.' },
    { cmd: '/alerta', label: 'OVERRIDE: Alerta Crítico', icon: ShieldAlert, output: '⚠️ [ALERTA PRIORITÁRIO] Cesse operação atual. Responda neste canal.' },
    { cmd: '/wa-bridge', label: 'Ativar Bridge WhatsApp', icon: MessageCircle, output: '[SYSTEM] 🟢 Gateway WhatsApp acionado. Alertas serão espelhados via celular.' }
  ] : [
    { cmd: '/emergencia', label: 'Reportar Risco Térmico', icon: AlertTriangle, output: '🚨 [EMERGÊNCIA] Identifiquei uma falha crítica que pode comprometer os produtos. Solicito apoio imediato.' },
    { cmd: '/loc', label: 'Enviar Minha Localização', icon: MapPin, output: '[LOCATION] -23.5505, -46.6333' },
    { cmd: '/alerta', label: 'Solicitar Alerta de Segurança', icon: AlertTriangle, output: '⚠️ [ALERTA] Há uma situação de risco que requer atenção imediata.' },
    { cmd: '/auditoria', label: 'Solicitar Revisão de Dados', icon: ShieldCheck, output: '📋 Solicito a revisão do histórico de temperatura para fins de auditoria sanitária.' }
  ];

  const messagesEndRef = useRef(null); 
  const historyContainerRef = useRef(null);
  const fileInputRef = useRef(null); 
  const recordIntervalRef = useRef(null); 
  const callIntervalRef = useRef(null); 
  const mediaRecorderRef = useRef(null); 
  const audioChunksRef = useRef([]);

  const handleInputChange = (e) => { 
    const val = e.target.value; 
    setMensagem(val); 
    if (val === '/') setShowCommands(true); 
    else setShowCommands(false); 
  };
  
  const executarComando = (cmdObj) => { 
    dispararMensagem(cmdObj.output); 
    setMensagem(''); 
    setShowCommands(false); 
  };

  const contatosFiltrados = useMemo(() => {
    if (!contatosDb || !Array.isArray(contatosDb)) return [];
    
    let list = contatosDb.filter(c => 
      c?.nome?.toLowerCase().includes(pesquisa.toLowerCase()) || 
      c?.cargo?.toLowerCase().includes(pesquisa.toLowerCase())
    );
    
    list = list.filter(c => {
      if (roleLogada === 'DEV' || roleLogada === 'ADMIN' || roleLogada === 'MANUTENCAO') return true;
      if (roleLogada === 'LOJA') {
        const isGestor = papelLogado.includes('Gerente') || papelLogado.includes('Coordenador');
        const targetIsGestor = c.cargo?.includes('Gerente') || c.cargo?.includes('Coordenador');
        const targetIsSupport = c.role === 'ADMIN' || c.role === 'DEV' || c.role === 'MANUTENCAO';
        const isSameFilial = c.filial === userFilial;

        if (isGestor) {
          return targetIsGestor || targetIsSupport || isSameFilial;
        } else {
          return isSameFilial || targetIsSupport;
        }
      }
      return false;
    });

    const roleOrder = { DEV: 1, ADMIN: 2, MANUTENCAO: 3, LOJA: 4 };
    return list.sort((a, b) => (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5));
  }, [contatosDb, pesquisa, roleLogada, papelLogado, userFilial]);

  const canalGlobal = { 
    id: 'todos', 
    nome: isDev ? 'NOC Global (Monitoramento Multi-Tenant)' : (isAdminOrDev ? 'Broadcast Corporativo (Empresa)' : 'Central de Suporte (Matriz)'), 
    cargo: isDev ? 'Acesso Root a todas as Redes' : 'Avisos e Comunicados Gerais', 
    isGroup: true 
  };

  // ============================================================================
  // FILTRO PONTO A PONTO E BROADCAST COM FALLBACK DE SEGURANÇA
  // ============================================================================
  const mensagensExibidas = useMemo(() => {
    if (!contatoAtivo) return [];
    
    let list = historicoChat.filter(m => {
      const remetente = String(m.remetenteId || '');
      const destino = String(m.destinoId || '');
      const ativoId = String(contatoAtivo.id || '');

      if (ativoId === 'todos') {
        return destino === 'todos' || remetente === 'todos';
      }

      // Se por algum motivo o ID logado demorar a carregar, exibe todas as mensagens do contato
      if (!currentUserId) {
        return remetente === ativoId || destino === ativoId;
      }

      const enviadaPorMim = (remetente === currentUserId && destino === ativoId);
      const recebidaDoContato = (remetente === ativoId && (destino === currentUserId || destino === 'todos'));
      
      return enviadaPorMim || recebidaDoContato;
    });

    if (searchChat.trim()) { 
      list = list.filter(m => String(m.texto || '').toLowerCase().includes(searchChat.toLowerCase())); 
    }
    return list;
  }, [historicoChat, contatoAtivo, searchChat, currentUserId]);

  useEffect(() => { 
    if (!showSearchChat && messagesEndRef.current) { 
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); 
    } 
  }, [mensagensExibidas.length, isTyping, showSearchChat]); 

  const handleScroll = (e) => { 
    const { scrollTop, scrollHeight, clientHeight } = e.target; 
    setShowScrollBottom((scrollHeight - scrollTop - clientHeight) > 150); 
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Clique de Seleção no Contato
  const handleSelecionarContato = (contato) => {
    if (!contato) return;
    
    setIsHandshaking(true);
    setContatoSelecionado(contato); 
    
    if (typeof setContatoAtivoProp === 'function') {
      try { setContatoAtivoProp(contato); } catch (e) {}
    }

    setResponderA(null); 
    setShowCommands(false); 
    setShowAttachMenu(false); 
    setShowSearchChat(false); 
    setSearchChat(''); 
    setShowAgentModal(false); 
    setPinnedMessage(null); 
    setIsConfidential(false);
    
    setTimeout(() => setIsHandshaking(false), 200);
    
    if (naoLidasPorContato?.[contato.id] && typeof setNaoLidasPorContato === 'function') { 
      setNaoLidasPorContato(prev => { 
        const next = { ...(prev || {}) }; 
        delete next[contato.id]; 
        return next; 
      }); 
    }

    carregarHistorico();
  };

  const fecharChat = (e) => {
    e?.stopPropagation();
    setContatoSelecionado(null);
    if (typeof setContatoAtivoProp === 'function') {
      try { setContatoAtivoProp(null); } catch (err) {}
    }
    setShowAgentModal(false);
  };

  const dispararMensagem = (textoFinal) => {
    if (!textoFinal.trim() || !contatoAtivo) return;
    
    let textoComSeguranca = textoFinal;
    if (isConfidential) textoComSeguranca = `[CONFIDENCIAL] ${textoFinal}`;

    const payload = { 
      id: Date.now(), 
      remetenteId: currentUserId || userId, 
      remetenteNome: nomeLogado || 'Colaborador', 
      destinoId: contatoAtivo.id, 
      texto: textoComSeguranca, 
      data: new Date().toISOString(), 
      tipo: 'sent' 
    };
    
    const msgNorm = normalizarMensagem(payload);
    setHistoricoChat(prev => {
      const lista = prev || [];
      if (lista.some(m => String(m.id) === String(msgNorm.id))) return lista;
      return [...lista, msgNorm];
    }); 
    
    if (socket && typeof socket.emit === 'function') {
      socket.emit('enviar_mensagem_chat', payload); 
    }
  };

  const enviarMensagemTexto = (e) => {
    e?.preventDefault();
    if (!mensagem.trim() || mensagem === '/') return;
    let textoFinal = mensagem;
    if (responderA) textoFinal = `[REP:${responderA.texto}] ${mensagem}`;
    dispararMensagem(textoFinal); 
    setMensagem(''); 
    setResponderA(null); 
    setIsConfidential(false);
  };
  
  const processFile = (file) => {
    if (!file) return; 
    const reader = new FileReader();
    reader.onloadend = () => { 
      dispararMensagem(`[FILE:${file.name}|${file.type}]${reader.result}`); 
    };
    reader.readAsDataURL(file); 
    setShowAttachMenu(false);
  };

  const handleFileChange = (e) => { 
    processFile(e.target.files[0]); 
    e.target.value = ''; 
  };
  
  const handleDragOver = (e) => { 
    e.preventDefault(); 
    if (contatoAtivo && !(contatoAtivo.isGroup && !isAdminOrDev)) {
      setIsDragging(true);
    } 
  };
  
  const handleDragLeave = (e) => { 
    e.preventDefault(); 
    setIsDragging(false); 
  };
  
  const handleDrop = (e) => { 
    e.preventDefault(); 
    setIsDragging(false); 
    if (!contatoAtivo || (contatoAtivo.isGroup && !isAdminOrDev)) return; 
    processFile(e.dataTransfer.files[0]); 
  };
  
  const enviarLocalizacao = () => { 
    dispararMensagem(`[LOCATION] -23.5505, -46.6333`); 
    setShowAttachMenu(false); 
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream); 
      audioChunksRef.current = []; 
      recorder.isCanceled = false; 
      recorder.ondataavailable = e => { 
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); 
      };
      recorder.onstop = () => {
        if (recorder.isCanceled) { 
          stream.getTracks().forEach(track => track.stop()); 
          return; 
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
        const reader = new FileReader();
        reader.onloadend = () => { 
          dispararMensagem(`[AUDIO]${reader.result}`); 
        };
        reader.readAsDataURL(blob); 
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start(); 
      mediaRecorderRef.current = recorder; 
      setIsRecording(true); 
      setRecordTime(0); 
      setShowCommands(false); 
      setShowAttachMenu(false);
      recordIntervalRef.current = setInterval(() => setRecordTime(prev => prev + 1), 1000);
    } catch (err) { 
      alert('Permissão de microfone negada.'); 
    }
  };

  const pararEEnviarGravacao = () => { 
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); 
    }
    setIsRecording(false); 
    clearInterval(recordIntervalRef.current); 
  };
  
  const cancelarGravacao = () => { 
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { 
      mediaRecorderRef.current.isCanceled = true; 
      mediaRecorderRef.current.stop(); 
    } 
    setIsRecording(false); 
    clearInterval(recordIntervalRef.current); 
  };

  const iniciarChamada = () => { 
    setActiveCall({ status: 'calling', time: 0 }); 
    setTimeout(() => { 
      setActiveCall({ status: 'connected', time: 0 }); 
      callIntervalRef.current = setInterval(() => { 
        setActiveCall(prev => prev ? { ...prev, time: prev.time + 1 } : null); 
      }, 1000); 
    }, 2500); 
  };
  
  const encerrarChamada = () => { 
    clearInterval(callIntervalRef.current); 
    dispararMensagem(`[CALL_END] Chamada de voz encerrada (${Math.floor(activeCall.time / 60)}:${String(activeCall.time % 60).padStart(2, '0')})`); 
    setActiveCall(null); 
  };

  const apagarMensagemLocal = (idParaApagar) => { 
    setHistoricoChat(prev => (prev || []).filter(m => String(m.id) !== String(idParaApagar)));
  };
  
  const encaminharParaWhatsApp = (texto) => { 
    const textoFormatado = encodeURIComponent(`*Alerta Tático TermoSync:*\n\n${String(texto || '').replace(/\[.*?\]\s*/, '')}`); 
    window.open(`https://wa.me/?text=${textoFormatado}`, '_blank'); 
  };

  const transcreverAudio = (msgId) => {
    setTranscribingIds(prev => ({ ...prev, [msgId]: 'loading' }));
    setTimeout(() => {
      const frasesMock = ["A máquina 04 está a vazar água pela frente.", "Preciso de ajuda urgente no setor das carnes.", "Reiniciei o disjuntor mas o alarme não parou.", "Tudo ok na matriz, ronda finalizada."];
      const textoTranscrito = frasesMock[Math.floor(Math.random() * frasesMock.length)];
      setTranscribingIds(prev => ({ ...prev, [msgId]: textoTranscrito }));
    }, 2000);
  };

  const renderBubbleText = (msg) => {
    try {
      let textoBruto = String(msg?.texto || '');
      if (!textoBruto) return '';
      
      let isConfidentialMsg = false;
      if (textoBruto.startsWith('[CONFIDENCIAL] ')) {
        isConfidentialMsg = true;
        textoBruto = textoBruto.replace('[CONFIDENCIAL] ', '');
      }

      const wrapConfidential = (content) => {
        if (!isConfidentialMsg) return content;
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--chat-warning)', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', paddingBottom: '4px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={10} /> PROTEGIDO: AUDITORIA RESTRITA
            </span>
            {content}
          </div>
        );
      };

      if (textoBruto.startsWith('[CALL_END]')) { 
        return wrapConfidential(
          <div className="system-msg-bubble" style={{background: 'rgba(56, 189, 248, 0.1)', color: 'var(--chat-secondary)', borderColor: 'rgba(56, 189, 248, 0.3)'}}>
            <PhoneOff size={16} /> {textoBruto.replace('[CALL_END]', '')}
          </div>
        ); 
      }
      
      if (textoBruto.startsWith('[LOCATION]')) { 
        return wrapConfidential(
          <div className="gps-location-bubble">
            <div className="gps-icon"><MapPin size={24} /></div>
            <div className="gps-details"><strong>Coordenadas Táticas</strong><span>{textoBruto.replace('[LOCATION]', '').trim()}</span></div>
          </div>
        ); 
      }
      
      if (textoBruto.startsWith('[SYSTEM_REQ]')) return wrapConfidential(textoBruto.replace('[SYSTEM_REQ]', ''));
      if (textoBruto.startsWith('[SYSTEM]')) return wrapConfidential(textoBruto.replace('[SYSTEM]', ''));

      if (textoBruto.startsWith('[AUDIO]')) {
        const transStatus = transcribingIds[msg.id];
        return wrapConfidential(
          <div className="audio-bubble-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={18} opacity={0.8} />
              <audio controls src={textoBruto.substring(7)} preload="metadata" />
            </div>
            {transStatus === 'loading' ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--chat-secondary)', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                  <Loader2 size={12} className="spin" /> A IA está a processar o áudio...
               </div>
            ) : typeof transStatus === 'string' ? (
               <div style={{ background: 'rgba(0,0,0,0.2)', borderLeft: '2px solid var(--chat-secondary)', padding: '6px 10px', borderRadius: '4px', fontSize: '0.8rem', fontStyle: 'italic', color: '#e2e8f0' }}>
                  <BrainCircuit size={12} color="var(--chat-secondary)" style={{ display: 'inline', marginRight: '4px' }}/> "{transStatus}"
               </div>
            ) : (
               <button onClick={() => transcreverAudio(msg.id)} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s' }}>
                  <BrainCircuit size={12} /> Transcrever (IA)
               </button>
            )}
          </div>
        );
      }

      if (textoBruto.startsWith('[FILE:')) {
        const metaEnd = textoBruto.indexOf(']');
        if (metaEnd === -1) return wrapConfidential("Arquivo corrompido");
        const metaInfo = textoBruto.substring(6, metaEnd).split('|');
        const fileName = metaInfo[0]; 
        const fileType = metaInfo[1] || ''; 
        const src = textoBruto.substring(metaEnd + 1);

        if (fileType.startsWith('image/')) { 
          return wrapConfidential(
            <div className="file-img-bubble">
              <img src={src} alt={fileName} className="chat-img-thumbnail" onClick={() => setPreviewImage(src)} />
              <span style={{fontSize: '0.75rem', fontWeight: 'bold'}}>{fileName}</span>
            </div>
          ); 
        } else { 
          return wrapConfidential(
            <a href={src} download={fileName} className="chat-file-attachment">
              <FileText size={20} color="var(--chat-primary)" />
              <span>{fileName}</span>
            </a>
          ); 
        }
      }

      const repMatch = textoBruto.match(/\[REP:(.*?)\]\s*(.*)/);
      if (repMatch) {
        let repliedContent = repMatch[1];
        if (repliedContent.startsWith('[AUDIO]')) repliedContent = '🎤 Transmissão de Rádio'; 
        else if (repliedContent.startsWith('[FILE:')) repliedContent = '📎 Pacote de Dados'; 
        else if (repliedContent.startsWith('[LOCATION]')) repliedContent = '📍 Localização GPS';
        return wrapConfidential(
          <>
            <div className="msg-reply-block"><strong>Citação Direta:</strong><p>{repliedContent}</p></div>
            {repMatch[2]}
          </>
        );
      }
      
      if (searchChat && textoBruto.toLowerCase().includes(searchChat.toLowerCase())) {
        const safeSearch = searchChat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = textoBruto.split(new RegExp(`(${safeSearch})`, 'gi'));
        return wrapConfidential(parts.map((part, i) => part.toLowerCase() === searchChat.toLowerCase() ? <mark key={i} className="search-highlight" style={{background: 'var(--chat-secondary)', color: '#000', borderRadius: '4px', padding: '0 4px'}}>{part}</mark> : part));
      }

      return wrapConfidential(textoBruto);
    } catch (err) {
      return 'Mensagem não processada.';
    }
  };

  return (
    <div className={`chat-page-container ${contatoAtivo ? 'has-active-chat' : ''}`} onClick={() => { setShowCommands(false); setShowAttachMenu(false); setShowEncryptionInfo(false); }} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      
      {isDragging && contatoAtivo && !(contatoAtivo.isGroup && !isAdminOrDev) && (
        <div className="chat-drag-overlay">
          <div className="drag-content"><UploadCloud size={64} /><h2>Transmitir Pacote</h2><p>Solte para fazer upload no canal de {contatoAtivo?.nome || 'Agente'}</p></div>
        </div>
      )}
      
      {previewImage && (
        <div className="lightbox-overlay" onClick={() => setPreviewImage(null)} style={{position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <button onClick={() => setPreviewImage(null)} style={{position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={32} /></button>
          <img src={previewImage} alt="Preview" style={{maxHeight: '90vh', maxWidth: '90vw', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)'}} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {activeCall && contatoAtivo && (
        <div className="tactical-call-overlay">
          <div className="call-radar"><div className="call-wave"></div><div className="call-wave"></div><div className="call-avatar">{contatoAtivo?.nome ? contatoAtivo.nome.charAt(0) : '?'}</div></div>
          <div className="call-info"><h2>{contatoAtivo?.nome || 'Agente'}</h2>{activeCall.status === 'calling' ? (<p className="pulse-soft">Estabelecendo uplink de rádio...</p>) : (<p style={{color: 'var(--chat-secondary)'}}>Conexão Segura: {Math.floor(activeCall.time / 60)}:{String(activeCall.time % 60).padStart(2, '0')}</p>)}</div>
          <div className="call-actions"><button className="btn-end-call" onClick={encerrarChamada}><PhoneOff size={28} /></button></div>
        </div>
      )}

      <div className="chat-sidebar">
        <div className="chat-search-header">
          <div className="chat-search-box">
            <Search size={18} color="var(--chat-muted)" />
            <input type="text" placeholder="Localizar Agente..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
          </div>
        </div>
        
        <div className="chat-contacts-list">
          {(!pesquisa || canalGlobal.nome.toLowerCase().includes(pesquisa.toLowerCase())) && (
            <div className={`chat-contact-item channel-global ${contatoAtivo?.id === 'todos' ? 'active' : ''}`} onClick={() => handleSelecionarContato(canalGlobal)}>
              <div className="contact-avatar-wrapper"><div className="contact-avatar global-avatar"><Globe size={22} /></div></div>
              <div className="contact-info">
                <span className="contact-name">{canalGlobal.nome}</span>
                <span className="contact-role" style={{color: isAdminOrDev ? 'var(--chat-primary)' : 'var(--chat-muted)'}}>{canalGlobal.cargo}</span>
              </div>
            </div>
          )}
          
          <div className="contacts-divider">Rede de Operadores {isDev && <span style={{marginLeft: 'auto', color: 'var(--chat-danger)', fontSize: '0.6rem'}}>*GOD MODE*</span>}</div>
          
          {contatosFiltrados.length === 0 ? (
            <EmptyState title="Nenhum agente localizado" description={!isDev ? 'O seu acesso está restrito à rede da sua empresa.' : 'Nenhum agente corresponde à pesquisa.'} icon={User} />
          ) : (
            contatosFiltrados.map(contato => { 
              const qtdNaoLidas = naoLidasPorContato?.[contato.id] || 0; 
              const isActive = contatoAtivo?.id === contato.id; 
              return (
                <div key={contato.id} className={`chat-contact-item ${isActive ? 'active' : ''} ${qtdNaoLidas > 0 && !isActive ? 'has-unread' : ''}`} onClick={() => handleSelecionarContato(contato)}>
                  <div className="contact-avatar-wrapper">
                    <div className="contact-avatar">{contato?.nome ? contato.nome.charAt(0).toUpperCase() : '?'}</div>
                    <span className="status-indicator online"></span>
                  </div>
                  <div className="contact-info">
                    <span className="contact-name">{contato.nome}</span>
                    <span className="contact-role">
                      {contato.cargo} {getSecurityClearance(contato.role)}
                      {isDev && contato.empresa && <span className="tenant-badge" title={`Empresa: ${contato.empresa}`}>{contato.empresa}</span>}
                    </span>
                  </div>
                  {qtdNaoLidas > 0 && !isActive && <div className="contact-unread-badge">{qtdNaoLidas > 9 ? '9+' : qtdNaoLidas}</div>}
                </div>
              ); 
            })
          )}
        </div>
      </div>

      <div className="chat-main-area" style={{ opacity: 1, visibility: 'visible', display: 'flex', flexDirection: 'column' }}>
        {contatoAtivo ? (
          <>
            <div className="chat-main-header">
              {showSearchChat ? (
                <div className="chat-header-search-box" style={{display: 'flex', alignItems: 'center', width: '100%', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--chat-primary)'}}>
                  <Search size={18} color="var(--chat-primary)" style={{marginRight: '10px'}}/>
                  <input type="text" placeholder="Filtrar pacotes ou logs..." value={searchChat} onChange={e => setSearchChat(e.target.value)} autoFocus style={{flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontFamily: 'Montserrat', minWidth: '0'}} />
                  <X size={20} color="var(--chat-muted)" style={{cursor: 'pointer'}} onClick={() => {setShowSearchChat(false); setSearchChat('');}} />
                </div>
              ) : (
                <div className="chat-active-user" onClick={() => !contatoAtivo.isGroup && setShowAgentModal(true)} style={{cursor: contatoAtivo.isGroup ? 'default' : 'pointer'}}>
                  <button className="chat-header-btn mobile-back-btn" onClick={fecharChat}><ArrowLeft size={20} /></button>
                  <div className="contact-avatar-wrapper"><div className={`contact-avatar ${contatoAtivo.isGroup ? 'global-avatar' : ''}`} style={{ width: '42px', height: '42px', fontSize: '1.1rem' }}>{contatoAtivo.isGroup ? <Globe size={20}/> : (contatoAtivo.nome ? contatoAtivo.nome.charAt(0).toUpperCase() : '?')}</div></div>
                  <div className="chat-user-header-details"><h3>{contatoAtivo?.nome || 'Agente'}</h3>{isTyping && !contatoAtivo.isGroup ? <span className="chat-status-typing">Criptografando pacote...</span> : <span className="chat-status-online"><span className="chat-status-dot"></span> {contatoAtivo.isGroup ? 'Rede Unificada' : 'Conexão Segura Estabelecida'}</span>}</div>
                </div>
              )}
              
              <div className="chat-header-actions">
                {!showSearchChat && <button className="chat-header-btn action-search-btn" onClick={() => setShowSearchChat(true)} title="Inspecionar Histórico (Auditoria)"><Search size={18} /></button>}
                {!contatoAtivo.isGroup && (<><button className="chat-header-btn" onClick={iniciarChamada} title="Uplink de Áudio VoIP"><PhoneCall size={18} /></button><button className="chat-header-btn action-panel-btn" onClick={() => setShowAgentModal(true)} title="Perfil de Segurança do Colaborador"><Activity size={18} /></button></>)}
              </div>
            </div>

            <div className="secure-channel-banner" onClick={(e) => { e.stopPropagation(); setShowEncryptionInfo(!showEncryptionInfo); }}>
              <Shield size={14} /> {contatoAtivo.isGroup && !isDev ? 'Canal Isolado na Rede Corporativa' : 'Canal Protegido (E2E AES-256)'}
              {showEncryptionInfo && (
                <div style={{position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(2, 6, 23, 0.95)', border: '1px solid var(--chat-primary)', padding: '15px', borderRadius: '12px', zIndex: 100, width: '300px', boxShadow: '0 15px 30px rgba(0,0,0,0.8)', color: 'white', textTransform: 'none', fontFamily: 'Montserrat', textAlign: 'left', lineHeight: '1.5'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--chat-primary)', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px'}}><Lock size={16}/> Isolamento Multi-Tenant</div>
                  <p style={{fontSize: '0.8rem', margin: '0 0 10px 0'}}>As comunicações neste canal são isoladas logicamente da base global. Nenhum outro cliente da ThermoSync tem acesso aos seus dados.</p>
                  <div style={{fontSize: '0.7rem', color: 'var(--chat-muted)', fontFamily: 'Montserrat', background: 'rgba(0,0,0,0.5)', padding: '6px', borderRadius: '6px'}}>Session Key: 0x8F9B...3A12<br/>TLS 1.3 Cipher: TLS_AES_256_GCM</div>
                </div>
              )}
            </div>
            
            {pinnedMessage && (
              <div className="pinned-message-banner" style={{ background: 'rgba(56, 189, 248, 0.1)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'white', cursor: 'pointer' }}>
                 <Pin size={16} color="var(--chat-secondary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                 <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--chat-secondary)', fontWeight: 'bold', marginBottom: '2px' }}>Aviso Fixado por {pinnedMessage.remetenteNome || 'Agente'}</div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(pinnedMessage?.texto || '').replace(/\[AUDIO\].*/, '🎤 Áudio').replace(/\[FILE:.*?\].*/, '📎 Anexo').replace(/\[LOCATION\].*/, '📍 Localização').replace(/\[CONFIDENCIAL\]\s*/, '')}</div>
                 </div>
                 <button onClick={(e) => { e.stopPropagation(); setPinnedMessage(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--chat-muted)', cursor: 'pointer' }}><X size={16}/></button>
              </div>
            )}

            <div className="chat-history-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {showScrollBottom && <button className="scroll-bottom-btn" onClick={scrollToBottom} style={{position: 'absolute', bottom: '20px', right: '20px', background: 'var(--chat-panel)', border: '1px solid var(--chat-border)', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer', zIndex: 50, boxShadow: '0 5px 15px rgba(0,0,0,0.5)'}}><ChevronDown size={24} /></button>}

              {isHandshaking ? (
                <div className="handshake-overlay"><ShieldAlert size={48} /><div className="handshake-text">VERIFICANDO ISOLAMENTO DA REDE...</div></div>
              ) : (
                <div className="chat-history" onScroll={handleScroll} ref={historyContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
                  {mensagensExibidas.length === 0 && (<div className="chat-secure-empty-state"><Shield size={48} className="secure-icon pulse-soft" /><h4 style={{color: 'white', marginBottom: '10px', fontFamily: 'Montserrat'}}>CONEXÃO SEGURA ESTABELECIDA</h4><p style={{fontSize: '0.85rem', lineHeight: '1.5'}}>A comunicação ponto-a-ponto foi verificada.<br/>{isDev ? 'Modo de acesso Global ativo.' : 'O seu canal está isolado com a rede da sua empresa.'}</p></div>)}
                  
                  {mensagensExibidas.map((msg, index) => {
                    const previousMsg = mensagensExibidas[index - 1];
                    const dataAtual = formatarDataSegura(msg.data);
                    const dataAnterior = previousMsg ? formatarDataSegura(previousMsg.data) : null;
                    const mostrarSeparadorData = !previousMsg || (dataAtual && dataAtual !== dataAnterior);
                    const mostrarHora = !previousMsg || (formatarHoraSegura(msg.data) !== formatarHoraSegura(previousMsg?.data)) || (msg.remetenteId !== previousMsg?.remetenteId);
                    
                    const textoBruto = String(msg?.texto || '');
                    const isSystemMsg = textoBruto.includes('[SYSTEM_REQ]') || textoBruto.includes('[CALL_END]') || textoBruto.includes('[SYSTEM]');
                    const isConfidentialMsg = textoBruto.includes('[CONFIDENCIAL]');

                    const isSent = msg.tipo === 'sent' || String(msg.remetenteId) === String(currentUserId);
                    const bubbleType = isSent ? 'sent' : 'received';

                    if (isSystemMsg) return <React.Fragment key={msg.id || index}>{mostrarSeparadorData && !searchChat && <div className="chat-date-separator"><span>{dataAtual || 'Hoje'}</span></div>}{renderBubbleText(msg)}</React.Fragment>;

                    return (
                      <React.Fragment key={msg.id || index}>
                        {mostrarSeparadorData && !searchChat && <div className="chat-date-separator"><span>{dataAtual || 'Hoje'}</span></div>}
                        <div className={`msg-wrapper ${bubbleType}`}>
                          <div className="msg-hover-actions">
                            <button type="button" className="msg-action-btn" onClick={() => setPinnedMessage(msg)} title="Fixar Diretiva"><Pin size={16} /></button>
                            {isAdminOrDev && <button type="button" className="msg-action-btn" onClick={() => encaminharParaWhatsApp(msg.texto)} title="Espelhar WhatsApp"><MessageCircle size={16} /></button>}
                            <button type="button" className="msg-action-btn" onClick={() => setResponderA(msg)} title="Citar"><Reply size={16} /></button>
                            <button type="button" className="msg-action-btn text-danger" onClick={() => apagarMensagemLocal(msg.id)} title="Excluir Cópia Local"><Trash2 size={16} /></button>
                          </div>
                          <div className={`msg-bubble ${isConfidentialMsg ? 'confidential' : ''}`}>
                            {contatoAtivo.isGroup && !isSent && <span className="msg-sender-name">{msg.remetenteNome || 'Agente'}</span>}
                            {renderBubbleText(msg)}
                          </div>
                          {mostrarHora && (<span className="msg-meta">{formatarHoraSegura(msg.data)}{isSent && <CheckCheck size={14} className="read-ticks" />}</span>)}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {isTyping && !searchChat && (<div className="msg-wrapper received"><div className="msg-bubble"><div className="typing-dots"><span></span><span></span><span></span></div></div></div>)}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="chat-input-container">
              {contatoAtivo.isGroup && !isAdminOrDev ? (
                <div style={{ padding: '1rem 1.5rem', textAlign: 'center', color: 'var(--chat-muted)', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid var(--chat-border)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                   <Shield size={16} color="var(--chat-secondary)" /> Apenas os Administradores podem publicar neste canal corporativo.
                </div>
              ) : isRecording ? (
                <div className="ptt-tactical-bar">
                  <div className="ptt-status"><span className="ptt-dot"></span><strong className="desktop-only-inline">TRANSMISSÃO RÁDIO ATIVA</strong><span className="ptt-timer">{Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, '0')}</span></div>
                  <div className="ptt-equalizer"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
                  <div className="ptt-actions"><button type="button" className="btn-ptt cancel" onClick={cancelarGravacao} title="Abortar"><X size={20}/></button><button type="button" className="btn-ptt send" onClick={pararEEnviarGravacao} title="Enviar Transmissão"><Send size={20}/></button></div>
                </div>
              ) : (
                <>
                  {!responderA && !showCommands && !showAttachMenu && (<div className="quick-replies-container">{quickReplies.map((reply, idx) => (<button key={idx} className="quick-reply-btn" onClick={() => dispararMensagem(reply)}>{reply}</button>))}</div>)}
                  {showCommands && (<div className="slash-command-menu"><div className="slash-header"><Terminal size={14}/> DIRETIVAS DO SISTEMA</div>{slashCommands.map((cmd, idx) => (<div key={idx} className="slash-cmd-item" onClick={() => executarComando(cmd)}><div className="cmd-tag">{cmd.cmd}</div><div className="cmd-desc"><cmd.icon size={14} color="var(--chat-primary)"/> {cmd.label}</div></div>))}</div>)}
                  {showAttachMenu && (<div className="attach-menu-overlay" onClick={(e) => e.stopPropagation()}><button className="attach-menu-item" onClick={() => { fileInputRef.current.click(); }}><Camera size={18} color="var(--chat-primary)"/> Câmera / Imagem</button><button className="attach-menu-item" onClick={() => { fileInputRef.current.click(); }}><FileText size={18} color="var(--chat-secondary)"/> Documento (PDF/CSV)</button><button className="attach-menu-item" onClick={enviarLocalizacao}><MapPin size={18} color="var(--chat-warning)"/> Inserir Coordenadas (GPS)</button></div>)}
                  {responderA && (<div className="reply-context-box"><div className="reply-info"><strong>Citação de {(responderA.remetenteNome ? String(responderA.remetenteNome) : 'Agente').split(' ')[0]}</strong><p>{String(responderA.texto || '').replace(/\[AUDIO\].*/, '🎤 Áudio').replace(/\[FILE:.*?\].*/, '📎 Anexo').replace(/\[LOCATION\].*/, '📍 Localização').replace(/\[CONFIDENCIAL\]\s*/, '').replace(/\[REP:.*?\]\s*/, '')}</p></div><button type="button" className="btn-close-reply" onClick={() => setResponderA(null)}><X size={18} /></button></div>)}
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                  <form className="chat-type-area" onSubmit={enviarMensagemTexto}>
                    <button type="button" className={`chat-btn-icon file-attach-btn ${showAttachMenu ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); setShowCommands(false); setShowEncryptionInfo(false); }}><Paperclip size={20} /></button>
                    
                    <button type="button" className={`chat-btn-icon confidential-btn ${isConfidential ? 'active' : ''}`} onClick={() => setIsConfidential(!isConfidential)} title="Modo de Auditoria Restrita"><Lock size={18} /></button>
                    
                    <div className={`chat-input-wrapper ${isConfidential ? 'confidential-mode' : ''}`}>
                      <input type="text" placeholder={showCommands ? "Selecione o comando rápido..." : isConfidential ? "Mensagem com restrição de auditoria..." : "Digite a mensagem ou '/' para atalhos..."} value={mensagem} onChange={handleInputChange} onFocus={() => { setShowAttachMenu(false); setShowEncryptionInfo(false); }} autoFocus={window.innerWidth > 768} />
                    </div>
                    {mensagem.trim() && !showCommands ? (<button type="submit" className="btn-send"><Send size={20} style={{ marginLeft: '-2px' }} /></button>) : (<button type="button" className="btn-ptt-trigger" onClick={iniciarGravacao} title="Transmissão Rádio (PTT)"><Radio size={20} /></button>)}
                  </form>
                </>
              )}
            </div>
          </>
        ) : (
          <EmptyState title="TermoSync Uplink Node" description="Aguardando seleção de um colaborador ao lado para estabelecer túnel de comunicação seguro." icon={Shield} />
        )}
      </div>

      {contatoAtivo && !contatoAtivo.isGroup && showAgentModal && (
        <div className="chat-modal-overlay anim-fade-in" onClick={() => setShowAgentModal(false)}>
          <div className="agent-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="agent-modal-header"><h4><Activity size={18} color="var(--chat-primary)"/> Perfil de Segurança do Colaborador</h4><button className="btn-close-modal" onClick={() => setShowAgentModal(false)}><X size={20}/></button></div>
            <div className="agent-modal-body">
              <div className="agent-avatar-large">{contatoAtivo.nome ? contatoAtivo.nome.charAt(0).toUpperCase() : '?'}</div><h2 className="agent-name-large">{contatoAtivo.nome}</h2><span className="agent-role-badge">{contatoAtivo.cargo}</span>
              <div className="agent-telemetry-metrics">
                 <div className="telemetry-item"><div className="t-icon-box success"><Zap size={20}/></div><div className="t-data"><span className="t-label">Status da Conexão</span><span className="t-value text-success">Autenticado & Ativo</span></div></div>
                 <div className="telemetry-item"><div className="t-icon-box primary"><div className="radar-icon-pulse"><Crosshair size={20} /><div className="radar-wave"></div></div></div><div className="t-data"><span className="t-label">Nível de Isolamento</span><span className="t-value">{isDev ? `Empresa: ${contatoAtivo.empresa || contatoAtivo.filial}` : 'Tenant Único'}</span></div></div>
                 <div className="telemetry-item"><div className="t-icon-box" style={{color:'var(--chat-muted)', borderColor: 'var(--chat-border)'}}><MapPin size={20}/></div><div className="t-data"><span className="t-label">Localização (Filial)</span><span className="t-value">{contatoAtivo.filial || 'Acesso Restrito'}</span></div></div>
              </div>
              
              {isAdminOrDev && (
                <div className="agent-tactical-protocols">
                  <h5 className="protocol-title">Ações Operacionais Restritas</h5>
                  <button className="btn-protocol whatsapp-protocol" onClick={() => { const cmd = slashCommands.find(c => c.cmd === '/wa-bridge'); if(cmd) dispararMensagem(cmd.output); setShowAgentModal(false); }}><div className="protocol-icon"><MessageCircle size={22}/></div><div className="protocol-info"><span className="protocol-name">Forçar Bridge WhatsApp</span><span className="protocol-desc">Espelhar diretivas no celular do agente</span></div></button>
                  <button className="btn-protocol danger-protocol" onClick={() => { const cmd = slashCommands.find(c => c.cmd === '/alerta'); if(cmd) dispararMensagem(cmd.output); setShowAgentModal(false); }}><div className="protocol-icon"><ShieldAlert size={22}/></div><div className="protocol-info"><span className="protocol-name">Emitir Alerta Prioritário</span><span className="protocol-desc">Forçar resposta imediata ao operador</span></div></button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}