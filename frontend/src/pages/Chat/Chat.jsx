import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Search, MessageSquare, MoreVertical, Phone, PhoneCall, PhoneOff, Paperclip, CheckCheck, Check, Reply, Copy, ChevronDown, Smile, Mic, X, Square, Trash2, User, MapPin, CheckCircle } from 'lucide-react';
import './Chat.css';

export default function Chat({ 
  contatosDb, nomeLogado, socket, userId, historicoChat, setHistoricoChat,
  contatoAtivo, setContatoAtivo, naoLidasPorContato, setNaoLidasPorContato
}) {
  const [pesquisa, setPesquisa] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [responderA, setResponderA] = useState(null); 
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isTyping, setIsTyping] = useState(false); 
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  
  const [callState, setCallState] = useState('idle'); // 'idle', 'calling', 'incoming', 'active'
  const [callPeer, setCallPeer] = useState(null); 
  const [callTime, setCallTime] = useState(0);
  
  const [showOptions, setShowOptions] = useState(false);
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showSearchChat, setShowSearchChat] = useState(false);
  const [searchChat, setSearchChat] = useState('');

  const callIntervalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const historyContainerRef = useRef(null);
  const fileInputRef = useRef(null); 
  const recordIntervalRef = useRef(null); 
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 🔴 REFERÊNCIA PARA O MOTOR DE ÁUDIO DO TOQUE
  const activeOscillatorRef = useRef(null);

  const emojisWhatsApp = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🫣','🤗','🤔','🫢','🤭','🤫','🤥','😶','😶‍🌫️','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😮‍💨','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','👽','👾','🤖','🎃',
    '👍','👎','✌️','🤞','🫰','🤟','🤘','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤙','💪','🦾','🖕','✍️','🙏','🤝','👏','🙌','👐','🤲',
    '🔧','⚙️','🔨','⚒️','🛠️','⛏️','🔩','🪛','🧰','🧲','🪜','🧱','🚧','🚨','🚥','🛑','❄️','🔥','💧','💦','🧊','🌡️','⚡','💡','🔋','🔌','💻','🖥️','🖨️','⌨️','🖱️','🖲️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⏳','⌛','📡','🔍','🔎','🕯️','🔦'
  ];

  // ==========================================
  // LÓGICA DE SOM DA CHAMADA (RingTone Dinâmico)
  // ==========================================
  const stopRingtone = useCallback(() => {
    if (activeOscillatorRef.current) {
      try { activeOscillatorRef.current.stop(); } catch (e) {}
      activeOscillatorRef.current = null;
    }
  }, []);

  const playRingtone = useCallback((isIncoming) => {
    stopRingtone();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();

      // Gerador de dois tons para soar como um telefone real
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.type = 'sine';
      osc1.frequency.value = 425;
      osc2.type = 'sine';
      osc2.frequency.value = 475;

      gainNode.gain.setValueAtTime(0, ctx.currentTime);

      // Padrão em Loop
      const now = ctx.currentTime;
      for (let i = 0; i < 20; i++) { // Toca durante 60 segundos
        const start = now + (i * 3); // A cada 3 segundos
        if (isIncoming) {
          // Padrão de quem recebe (Toca 1.5s, pausa 1.5s)
          gainNode.gain.setTargetAtTime(0.15, start, 0.05);
          gainNode.gain.setTargetAtTime(0, start + 1.5, 0.05);
        } else {
          // Padrão de quem liga (Toca 1s, pausa 2s)
          gainNode.gain.setTargetAtTime(0.1, start, 0.05);
          gainNode.gain.setTargetAtTime(0, start + 1, 0.05);
        }
      }

      osc1.start();
      osc2.start();

      activeOscillatorRef.current = {
        stop: () => {
          try {
            osc1.stop();
            osc2.stop();
            gainNode.disconnect();
          } catch(e) {}
        }
      };
    } catch(e) { console.error("Erro no som", e); }
  }, [stopRingtone]);

  // Gere a ligação e desligamento do som consoante o CallState
  useEffect(() => {
    if (callState === 'incoming') {
      playRingtone(true);
    } else if (callState === 'calling') {
      playRingtone(false);
    } else {
      stopRingtone(); // Pára assim que atende, recusa ou desliga
    }
    return stopRingtone;
  }, [callState, playRingtone, stopRingtone]);


  // ==========================================
  // WEBSOCKETS DA CHAMADA
  // ==========================================
  useEffect(() => {
    if (!socket) return;

    const onChamadaRecebida = (data) => {
      setCallState('incoming');
      setCallPeer({ id: data.remetenteId, nome: data.remetenteNome });
    };

    const onChamadaAtendida = () => {
      setCallState('active');
      setCallTime(0);
      callIntervalRef.current = setInterval(() => setCallTime(prev => prev + 1), 1000);
    };

    const onChamadaRecusada = () => {
      setCallState('idle');
      setCallPeer(null);
    };

    const onChamadaTerminada = () => {
      setCallState('idle');
      clearInterval(callIntervalRef.current);
      setCallPeer(null);
    };

    socket.on('chamada_recebida', onChamadaRecebida);
    socket.on('chamada_atendida', onChamadaAtendida);
    socket.on('chamada_recusada', onChamadaRecusada);
    socket.on('chamada_terminada', onChamadaTerminada);

    return () => {
      socket.off('chamada_recebida', onChamadaRecebida);
      socket.off('chamada_atendida', onChamadaAtendida);
      socket.off('chamada_recusada', onChamadaRecusada);
      socket.off('chamada_terminada', onChamadaTerminada);
    };
  }, [socket]);

  useEffect(() => {
    if (!showSearchChat) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historicoChat, contatoAtivo, isTyping]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollBottom((scrollHeight - scrollTop - clientHeight) > 150);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (contatoAtivo) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [contatoAtivo]);

  const contatosFiltrados = contatosDb?.filter(c => 
    c.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
    c.cargo.toLowerCase().includes(pesquisa.toLowerCase())
  ) || [];

  const handleSelecionarContato = (contato) => {
    setContatoAtivo(contato);
    setResponderA(null);
    setShowEmojiPicker(false);
    setShowOptions(false);
    setShowSearchChat(false);
    setSearchChat('');
    
    if (naoLidasPorContato[contato.id]) {
      setNaoLidasPorContato(prev => {
        const next = { ...prev };
        delete next[contato.id];
        return next;
      });
    }
  };

  const dispararMensagem = (textoFinal) => {
    if (!textoFinal.trim() || !contatoAtivo || !socket) return;
    const novaMsg = { 
      id: Date.now(), 
      remetenteId: userId, 
      remetenteNome: nomeLogado,
      destinoId: contatoAtivo.id, 
      texto: textoFinal, 
      data: new Date(), 
      tipo: 'sent' 
    };
    setHistoricoChat(prev => [...prev, novaMsg]);
    socket.emit('enviar_mensagem_chat', novaMsg);
  };

  const enviarMensagemTexto = (e) => {
    e?.preventDefault();
    if (!mensagem.trim()) return;
    let textoFinal = mensagem;
    if (responderA) textoFinal = `[REP:${responderA.texto}] ${mensagem}`;
    dispararMensagem(textoFinal);
    setMensagem('');
    setResponderA(null);
    setShowEmojiPicker(false);
  };

  const adicionarEmoji = (emoji) => { setMensagem(prev => prev + emoji); };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("O ficheiro excede o limite seguro de 10MB para este modo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => { dispararMensagem(`[FILE:${file.name}|${file.type}]${reader.result}`); };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.isCanceled = false; 
      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (recorder.isCanceled) { stream.getTracks().forEach(track => track.stop()); return; }
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => { dispararMensagem(`[AUDIO]${reader.result}`); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start(); 
      mediaRecorderRef.current = recorder;
      setIsRecording(true); setRecordTime(0); setShowEmojiPicker(false);
      recordIntervalRef.current = setInterval(() => setRecordTime(prev => prev + 1), 1000);
    } catch (err) { alert('⚠️ Permissão de microfone negada. Certifique-se que o seu navegador tem acesso ao microfone.'); }
  };

  const pararEEnviarGravacao = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); 
    setIsRecording(false); clearInterval(recordIntervalRef.current);
  };

  const cancelarGravacao = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.isCanceled = true; mediaRecorderRef.current.stop(); }
    setIsRecording(false); clearInterval(recordIntervalRef.current);
  };

  // 🔴 AÇÕES DE LIGAÇÃO
  const ligarParaContato = () => {
    setCallState('calling');
    setCallPeer(contatoAtivo);
    socket.emit('chamada_iniciar', {
      remetenteId: userId,
      remetenteNome: nomeLogado,
      destinoId: contatoAtivo.id
    });
  };

  const aceitarChamada = () => {
    setCallState('active');
    setCallTime(0);
    callIntervalRef.current = setInterval(() => setCallTime(prev => prev + 1), 1000);
    socket.emit('chamada_aceita', { destinoId: callPeer.id });
  };

  const recusarChamada = () => {
    socket.emit('chamada_rejeitada', { destinoId: callPeer.id });
    setCallState('idle');
    setCallPeer(null);
  };

  const encerrarChamada = () => {
    clearInterval(callIntervalRef.current);
    socket.emit('chamada_encerrar', { destinoId: callPeer.id });
    
    if (callState === 'active') {
      const mins = Math.floor(callTime / 60); const secs = String(callTime % 60).padStart(2, '0');
      
      // Envia uma mensagem limpa a dizer que a chamada terminou
      const msgFim = { 
        id: Date.now(), remetenteId: userId, remetenteNome: nomeLogado,
        destinoId: callPeer.id, texto: `📞 Chamada de voz terminada (${mins}:${secs})`, 
        data: new Date(), tipo: 'sent' 
      };
      setHistoricoChat(prev => [...prev, msgFim]);
      socket.emit('enviar_mensagem_chat', msgFim);
    }

    setCallState('idle');
    setCallPeer(null);
  };

  const limparHistoricoLocal = () => {
    if (window.confirm(`Tem a certeza que deseja limpar a conversa com ${contatoAtivo.nome}?`)) {
      setHistoricoChat(prev => prev.filter(m => !((String(m.remetenteId) === String(contatoAtivo.id) && String(m.destinoId) === String(userId)) || (String(m.remetenteId) === String(userId) && String(m.destinoId) === String(contatoAtivo.id)))));
      setShowOptions(false);
    }
  };

  const apagarMensagemLocal = (idParaApagar) => {
    setHistoricoChat(prev => prev.filter(m => m.id !== idParaApagar));
  };

  const verPerfil = () => { setShowPerfilModal(true); setShowOptions(false); };

  const copiarTexto = (textoBase) => {
    const textoLimpo = textoBase.replace(/\[REP:.*?\]\s*/, '').replace(/\[AUDIO\].*/, 'Mensagem de voz').replace(/\[FILE:.*?\].*/, 'Ficheiro anexado');
    navigator.clipboard.writeText(textoLimpo);
  };

  const renderBubbleText = (textoBruto) => {
    if (!textoBruto) return '';

    if (textoBruto.startsWith('[AUDIO]')) {
      const src = textoBruto.substring(7); 
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mic size={18} opacity={0.8} />
          <audio controls src={src} preload="metadata" style={{ height: '35px', maxWidth: '220px', outline: 'none' }} />
        </div>
      );
    }

    if (textoBruto.startsWith('[FILE:')) {
      const metaEnd = textoBruto.indexOf(']');
      const metaInfo = textoBruto.substring(6, metaEnd).split('|');
      const fileName = metaInfo[0];
      const fileType = metaInfo[1] || '';
      const src = textoBruto.substring(metaEnd + 1);

      if (fileType.startsWith('image/')) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <img src={src} alt={fileName} className="chat-img-thumbnail" onClick={() => setPreviewImage(src)} />
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{fileName}</span>
          </div>
        );
      } else {
        return (
          <a href={src} download={fileName} className="chat-file-attachment">
            <Paperclip size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{fileName}</span>
          </a>
        );
      }
    }

    const repMatch = textoBruto.match(/\[REP:(.*?)\]\s*(.*)/);
    if (repMatch) {
      let repliedContent = repMatch[1];
      if (repliedContent.startsWith('[AUDIO]')) repliedContent = '🎤 Mensagem de Voz';
      else if (repliedContent.startsWith('[FILE:')) repliedContent = '📎 Ficheiro Anexado';

      return (
        <>
          <div className="msg-reply-block">
            <strong>A responder a:</strong>
            <p>{repliedContent}</p>
          </div>
          {repMatch[2]}
        </>
      );
    }
    
    if (searchChat && textoBruto.toLowerCase().includes(searchChat.toLowerCase())) {
      const parts = textoBruto.split(new RegExp(`(${searchChat})`, 'gi'));
      return parts.map((part, i) => part.toLowerCase() === searchChat.toLowerCase() ? <mark key={i} className="search-highlight">{part}</mark> : part);
    }

    return textoBruto;
  };

  let mensagensExibidas = historicoChat.filter(m => 
    (String(m.remetenteId) === String(contatoAtivo?.id) && m.tipo === 'received') || 
    (String(m.destinoId) === String(contatoAtivo?.id) && m.tipo === 'sent') ||
    (String(m.destinoId) === 'todos')
  );

  if (searchChat.trim()) {
    mensagensExibidas = mensagensExibidas.filter(m => m.texto.toLowerCase().includes(searchChat.toLowerCase()));
  }

  const formatarDataSeparador = (data) => {
    const hoje = new Date(); const dataMsg = new Date(data);
    if (dataMsg.toDateString() === hoje.toDateString()) return 'Hoje';
    const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
    if (dataMsg.toDateString() === ontem.toDateString()) return 'Ontem';
    return dataMsg.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const obterTextoLimpo = (textoBase) => {
    if (!textoBase) return '';
    if (textoBase.startsWith('[AUDIO]')) return '🎤 Mensagem de Voz';
    if (textoBase.startsWith('[FILE:')) return '📎 ' + textoBase.substring(6, textoBase.indexOf('|'));
    return textoBase.replace(/\[REP:.*?\]\s*/, '');
  }

  return (
    <div className="anim-fade-in chat-page-container" onClick={() => setShowOptions(false)}>
      
      {showPerfilModal && contatoAtivo && (
        <div className="lightbox-overlay" onClick={() => setShowPerfilModal(false)}>
          <div className="perfil-modal-card anim-fade-in" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-perfil" onClick={() => setShowPerfilModal(false)}><X size={20} /></button>
            <div className="perfil-modal-header">
              <div className="perfil-avatar-large">{contatoAtivo.nome.charAt(0).toUpperCase()}</div>
              <h2>{contatoAtivo.nome}</h2>
              <span className="perfil-role">{contatoAtivo.cargo}</span>
            </div>
            <div className="perfil-modal-body">
              <div className="perfil-info-item">
                <MapPin size={22} />
                <div><small>Localização / Filial</small><p>{contatoAtivo.filial}</p></div>
              </div>
              <div className="perfil-info-item">
                <CheckCircle size={22} color="var(--success)" />
                <div><small>Status de Operação</small><p>Ligado ao TermoSync</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="lightbox-overlay" onClick={() => setPreviewImage(null)}>
          <button className="lightbox-close" onClick={() => setPreviewImage(null)}><X size={28} /></button>
          <img src={previewImage} className="lightbox-img" alt="Pré-visualização do Anexo" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* 🔴 OVERLAY DE CHAMADA DINÂMICO */}
      {callState !== 'idle' && callPeer && (
        <div className="call-active-overlay">
          <div className="call-active-box">
            
            <div className={`call-active-avatar ${callState !== 'active' ? 'pulse-calling' : ''}`}>
              {callPeer.nome.charAt(0).toUpperCase()}
            </div>
            
            <h2>{callPeer.nome}</h2>
            
            {callState === 'calling' && <p className="call-status">A chamar...</p>}
            {callState === 'incoming' && <p className="call-status pulse-text">A receber chamada VoIP...</p>}
            
            {callState === 'active' && (
              <p className="call-status">
                A decorrer... {Math.floor(callTime / 60)}:{String(callTime % 60).padStart(2, '0')}
              </p>
            )}

            <div className="call-actions-group">
              {callState === 'incoming' && (
                <button className="btn-accept-call" onClick={aceitarChamada} title="Atender">
                  <PhoneCall size={28} />
                </button>
              )}
              <button className="btn-end-call" onClick={callState === 'incoming' ? recusarChamada : encerrarChamada} title="Desligar/Recusar">
                <PhoneOff size={28} />
              </button>
            </div>
            
          </div>
        </div>
      )}

      <div className="chat-sidebar">
        <div className="chat-search-header">
          <div className="chat-search-box">
            <Search size={18} color="var(--text-muted)" />
            <input type="text" placeholder="Procurar colega ou função..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
          </div>
        </div>
        
        <div className="chat-contacts-list">
          {contatosFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2rem' }}>Nenhum contacto encontrado.</p>
          ) : (
            contatosFiltrados.map(contato => {
              const qtdNaoLidas = naoLidasPorContato[contato.id] || 0;
              const isActive = contatoAtivo?.id === contato.id;
              return (
                <div key={contato.id} className={`chat-contact-item ${isActive ? 'active' : ''} ${qtdNaoLidas > 0 && !isActive ? 'has-unread' : ''}`} onClick={() => handleSelecionarContato(contato)}>
                  <div className="contact-avatar">{contato.nome.charAt(0).toUpperCase()}</div>
                  <div className="contact-info">
                    <span className="contact-name">{contato.nome}</span>
                    <span className="contact-role">{contato.cargo}</span>
                  </div>
                  {qtdNaoLidas > 0 && !isActive && <div className="contact-unread-badge">{qtdNaoLidas > 9 ? '9+' : qtdNaoLidas}</div>}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="chat-main-area">
        {contatoAtivo ? (
          <>
            <div className="chat-main-header">
              {showSearchChat ? (
                <div className="chat-header-search-box anim-fade-in">
                  <Search size={18} color="var(--text-muted)" style={{marginRight: '8px'}}/>
                  <input type="text" placeholder="Procurar nesta conversa..." value={searchChat} onChange={e => setSearchChat(e.target.value)} autoFocus />
                  <X size={20} color="var(--text-muted)" style={{cursor: 'pointer'}} onClick={() => {setShowSearchChat(false); setSearchChat('');}} />
                </div>
              ) : (
                <div className="chat-active-user anim-fade-in" onClick={verPerfil} style={{cursor: 'pointer'}}>
                  <div className="contact-avatar" style={{ width: '46px', height: '46px', fontSize: '1.2rem' }}>{contatoAtivo.nome.charAt(0).toUpperCase()}</div>
                  <div>
                    <h3>{contatoAtivo.nome}</h3>
                    {isTyping ? <span className="chat-status-typing">A escrever...</span> : <span className="chat-status-online"><span className="chat-status-dot"></span> {contatoAtivo.cargo}</span>}
                  </div>
                </div>
              )}
              
              <div className="chat-header-actions" style={{ position: 'relative' }}>
                {!showSearchChat && <button className="chat-header-btn" onClick={() => setShowSearchChat(true)} title="Pesquisar na conversa"><Search size={20} /></button>}
                <button className="chat-header-btn" onClick={ligarParaContato} title="Chamada de Voz"><Phone size={20} /></button>
                <button className="chat-header-btn" onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }} title="Opções do Contacto"><MoreVertical size={20} /></button>
                
                {showOptions && (
                  <div className="chat-options-dropdown" onClick={(e) => e.stopPropagation()}>
                    <button className="dropdown-item" onClick={verPerfil}><User size={16} /> Ver Perfil</button>
                    <button className="dropdown-item text-danger" onClick={limparHistoricoLocal}><Trash2 size={16} /> Limpar Conversa</button>
                  </div>
                )}
              </div>
            </div>

            <div className="chat-history-container">
              {showScrollBottom && <button className="scroll-bottom-btn" onClick={scrollToBottom}><ChevronDown size={24} /></button>}

              <div className="chat-history" onScroll={handleScroll} ref={historyContainerRef}>
                {mensagensExibidas.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', background: 'var(--card-bg)', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px dashed var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    {searchChat ? (<>Nenhuma mensagem encontrada com "<strong>{searchChat}</strong>".</>) : (
                      <>Comunicação cifrada iniciada com <strong>{contatoAtivo.nome.split(' ')[0]}</strong>.<br/><small style={{display: 'block', marginTop: '8px'}}>As mensagens são gravadas centralmente.</small></>
                    )}
                  </div>
                )}
                
                {mensagensExibidas.map((msg, index) => {
                  const previousMsg = mensagensExibidas[index - 1];
                  const mostrarSeparadorData = !previousMsg || (new Date(msg.data).toDateString() !== new Date(previousMsg.data).toDateString());
                  const mostrarHora = !previousMsg || (new Date(msg.data).getMinutes() !== new Date(previousMsg.data).getMinutes()) || (msg.remetenteId !== previousMsg.remetenteId) || mostrarSeparadorData;
                  const isRead = new Date(msg.data).toDateString() !== new Date().toDateString() || index < mensagensExibidas.length - 1;
                  const isSystemMsg = msg.texto.startsWith('📞 Chamada');

                  if (isSystemMsg) {
                    return (
                      <React.Fragment key={msg.id}>
                        {mostrarSeparadorData && !searchChat && <div className="chat-date-separator"><span>{formatarDataSeparador(msg.data)}</span></div>}
                        <div className="system-msg-bubble">{msg.texto}</div>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={msg.id}>
                      {mostrarSeparadorData && !searchChat && <div className="chat-date-separator"><span>{formatarDataSeparador(msg.data)}</span></div>}
                      
                      <div className={`msg-wrapper ${msg.tipo}`}>
                        <div className="msg-hover-actions">
                          <button type="button" className="msg-action-btn" onClick={() => setResponderA(msg)} title="Responder"><Reply size={16} /></button>
                          <button type="button" className="msg-action-btn" onClick={() => copiarTexto(msg.texto)} title="Copiar"><Copy size={16} /></button>
                          <button type="button" className="msg-action-btn text-danger" onClick={() => apagarMensagemLocal(msg.id)} title="Apagar mensagem"><Trash2 size={16} /></button>
                        </div>
                        <div className="msg-bubble">{renderBubbleText(msg.texto)}</div>
                        
                        {mostrarHora && (
                          <span className="msg-meta">
                            {new Date(msg.data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {msg.tipo === 'sent' && (isRead ? <CheckCheck size={14} className="read-ticks" /> : <Check size={14} className="sent-ticks" />)}
                          </span>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                {isTyping && !searchChat && <div className="msg-wrapper received"><div className="typing-indicator"><span></span><span></span><span></span></div></div>}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="chat-input-container">
              {responderA && (
                <div className="reply-context-box">
                  <div className="reply-info">
                    <strong>A responder a {responderA.remetenteNome.split(' ')[0]}</strong>
                    <p>{obterTextoLimpo(responderA.texto)}</p>
                  </div>
                  <button type="button" className="btn-close-reply" onClick={() => setResponderA(null)}><X size={18} /></button>
                </div>
              )}

              {showEmojiPicker && (
                <div className="emoji-picker-popover">
                  <div className="emoji-grid">
                    {emojisWhatsApp.map(emoji => <span key={emoji} onClick={() => adicionarEmoji(emoji)}>{emoji}</span>)}
                  </div>
                </div>
              )}

              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx" />

              <form className="chat-type-area" onSubmit={enviarMensagemTexto}>
                {!isRecording && (
                  <button type="button" className="chat-btn-icon" onClick={() => fileInputRef.current.click()} title="Adicionar Imagem / Documento">
                    <Paperclip size={22} />
                  </button>
                )}
                
                <div className="chat-input-wrapper" style={{ padding: isRecording ? '0.4rem 0.6rem' : '0.3rem 0.5rem' }}>
                  {!isRecording ? (
                    <>
                      <button type="button" className="chat-btn-icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emojis" style={{ padding: '8px' }}>
                        <Smile size={20} color={showEmojiPicker ? "var(--primary)" : "var(--text-muted)"} />
                      </button>
                      <input 
                        type="text" 
                        placeholder={`Mensagem para ${contatoAtivo.nome.split(' ')[0]}...`}
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        autoFocus
                      />
                    </>
                  ) : (
                    <div className="recording-active-container">
                      <button type="button" className="btn-cancel-record" onClick={cancelarGravacao} title="Eliminar Gravação"><Trash2 size={20} /></button>
                      <div className="recording-indicator-area">
                        <div className="recording-pulse"></div>
                        <span className="recording-time">{Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, '0')}</span>
                      </div>
                      <button type="button" className="btn-send-record" onClick={pararEEnviarGravacao} title="Enviar Áudio"><Send size={18} style={{ marginLeft: '-2px' }} /></button>
                    </div>
                  )}
                </div>

                {!isRecording && (
                  mensagem.trim() ? (
                    <button type="submit" className="btn-send" title="Enviar Mensagem"><Send size={20} style={{ marginLeft: '-2px' }} /></button>
                  ) : (
                    <button type="button" className="btn-send" onClick={iniciarGravacao} title="Gravar Mensagem de Voz"><Mic size={20} /></button>
                  )
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="chat-empty-state">
            <div className="chat-empty-icon-wrapper"><MessageSquare size={48} color="var(--primary)" /></div>
            <h3>Central de Colaboração</h3>
            <p>Selecione um membro da equipa na lateral para <br/>iniciar a comunicação com áudios e imagens.</p>
          </div>
        )}
      </div>
    </div>
  );
}