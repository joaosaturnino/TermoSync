import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Send, Search, Phone, Paperclip, CheckCheck, Reply, Copy, ChevronDown, 
  Smile, Mic, X, Trash2, User, MapPin, ArrowLeft, UploadCloud, Shield, Zap,
  Terminal, Radio, Activity, Navigation, ShieldAlert, MessageCircle, Globe, Crosshair, Loader2,
  Video, Camera, FileText, PhoneCall, PhoneOff
} from 'lucide-react';
import './Chat.css';

// ============================================================================
// COMPONENTE PRINCIPAL: CHAT TÁTICO
// Responsável por gerenciar todo o motor de WebSocket (Tempo Real), 
// gravação e processamento de áudios/arquivos e os modais de telemetria.
// ============================================================================
export default function Chat({ 
  contatosDb, nomeLogado, socket, userId, historicoChat, setHistoricoChat,
  contatoAtivo, setContatoAtivo, naoLidasPorContato, setNaoLidasPorContato
}) {
  
  /* --- ESTADOS GERAIS DE UI E INPUT --- */
  const [pesquisa, setPesquisa] = useState(''); // Busca na barra lateral de contatos
  const [mensagem, setMensagem] = useState(''); // Input de texto principal
  const [responderA, setResponderA] = useState(null); // Armazena a mensagem que está sendo respondida (citação)
  const [showScrollBottom, setShowScrollBottom] = useState(false); // Exibe botão flutuante para ir ao final da conversa
  const [isTyping, setIsTyping] = useState(false); // Simula o indicador "Digitando..."
  const [isHandshaking, setIsHandshaking] = useState(false); // Simula "negociação de chaves" ao abrir o contato
  
  /* --- ESTADOS DOS MENUS FLUTUANTES --- */
  const [showCommands, setShowCommands] = useState(false); // Exibe menu de comandos (iniciado por "/")
  const [showAttachMenu, setShowAttachMenu] = useState(false); // Menu de clipes (Arquivo/Localização)
  
  /* --- ESTADOS DO GRAVADOR E RÁDIO PTT (Push-To-Talk) --- */
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0); // Cronômetro de gravação
  
  /* --- ESTADOS DO VOIP (CHAMADA DE VOZ SIMULADA) --- */
  const [activeCall, setActiveCall] = useState(null); // null ou { status: 'calling'|'connected', time: 0 }
  
  /* --- ESTADOS DE PAINÉIS E SOBREPOSIÇÕES --- */
  const [showAgentModal, setShowAgentModal] = useState(false); // Modal lateral contendo a ficha/telemetria do agente
  const [previewImage, setPreviewImage] = useState(null); // Modal para zoom em fotos do chat
  const [showSearchChat, setShowSearchChat] = useState(false); // Busca *dentro* do histórico da conversa
  const [searchChat, setSearchChat] = useState('');
  const [isDragging, setIsDragging] = useState(false); // Trigger visual para o overlay de upload (Drag & Drop)

  // Respostas Rápidas NOC (Pílulas que aparecem acima do input)
  const quickReplies = [
    "Estou na posição 📍",
    "Anomalia contida ✅",
    "Aguardando luz verde ⏳",
    "Solicito contato voz 📞",
    "Apoio tático necessário 🆘"
  ];

  // Comandos de Terminal (Simulando uma CLI injetada no Chat)
  const slashCommands = [
    { cmd: '/status', label: 'Reportar Situação', icon: Activity, output: '[SYSTEM_REQ] Atualize o status operacional da intervenção de imediato.' },
    { cmd: '/loc', label: 'Ping Coordenadas GPS', icon: Navigation, output: '[SYSTEM_REQ] Transmita localização exata ou corredor de atuação no rack.' },
    { cmd: '/alerta', label: 'OVERRIDE: Alerta Crítico', icon: ShieldAlert, output: '⚠️ [ALERTA PRIORITÁRIO] Cesse operação atual. Responda neste canal.' },
    { cmd: '/wa-bridge', label: 'Ativar Bridge WhatsApp', icon: MessageCircle, output: '[SYSTEM] 🟢 Gateway WhatsApp acionado. Alertas serão espelhados via celular.' }
  ];

  /* --- REF HOOKS PARA MANIPULAÇÃO DE DOM E TIMERS --- */
  const messagesEndRef = useRef(null); // Usado para scrollar a tela até o final
  const historyContainerRef = useRef(null);
  const fileInputRef = useRef(null); // Referência oculta do input nativo de upload
  const recordIntervalRef = useRef(null); // Intervalo do cronômetro de gravação
  const callIntervalRef = useRef(null); // Intervalo da chamada VoIP
  const mediaRecorderRef = useRef(null); // API Nativa de Gravação de Áudio do navegador
  const audioChunksRef = useRef([]);

  // --- CONTROLE DO INPUT E ACIONAMENTO DE COMANDOS TÁTICOS ---
  const handleInputChange = (e) => {
    const val = e.target.value;
    setMensagem(val);
    // Se a primeira tecla for uma barra ("/"), abre a paleta de Slash Commands
    if (val === '/') setShowCommands(true);
    else setShowCommands(false);
  };

  const executarComando = (cmdObj) => {
    dispararMensagem(cmdObj.output);
    setMensagem('');
    setShowCommands(false);
  };

  // Filtra os contatos exibidos na sidebar lateral em tempo real
  const contatosFiltrados = useMemo(() => {
    if (!contatosDb) return [];
    return contatosDb.filter(c => 
      c.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
      c.cargo.toLowerCase().includes(pesquisa.toLowerCase())
    );
  }, [contatosDb, pesquisa]);

  // Canal especial emulando um grupo para Broadcast Global
  const canalGlobal = { id: 'todos', nome: 'Broadcast Global (NOC)', cargo: 'Toda a Equipe TermoSync', isGroup: true };

  /* --- FILTRAGEM DO HISTÓRICO DE MENSAGENS ---
     Restaura e filtra as mensagens do state global cruzando se o Remetente ou 
     Destinatário combinam com a aba do Contato Ativo aberto no momento.
  */
  const mensagensExibidas = useMemo(() => {
    if (!historicoChat) return [];
    let list = historicoChat.filter(m => 
      (String(m.remetenteId) === String(contatoAtivo?.id) && m.tipo === 'received') || 
      (String(m.destinoId) === String(contatoAtivo?.id) && m.tipo === 'sent') ||
      (contatoAtivo?.id === 'todos' && String(m.destinoId) === 'todos')
    );

    // Filtro ativado na lupa do header (Busca dentro da conversa)
    if (searchChat.trim()) {
      list = list.filter(m => m.texto?.toLowerCase().includes(searchChat.toLowerCase()));
    }
    return list;
  }, [historicoChat, contatoAtivo, searchChat]);

  // Efeito que garante o auto-scroll para o final da conversa quando novas mensagens entram
  useEffect(() => {
    if (!showSearchChat && messagesEndRef.current && !isHandshaking) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagensExibidas.length, isTyping, showSearchChat, isHandshaking]); 

  // Exibe o botão "Voltar ao Fundo" se o usuário scrollou a conversa para cima
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollBottom((scrollHeight - scrollTop - clientHeight) > 150);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Disparada ao clicar em um agente na barra lateral
  const handleSelecionarContato = (contato) => {
    if (contatoAtivo?.id === contato.id) return;
    
    // Inicia a animação (Lockdown/Handshake) visual
    setIsHandshaking(true);
    setContatoAtivo(contato);
    setResponderA(null);
    setShowCommands(false);
    setShowAttachMenu(false);
    setShowSearchChat(false);
    setSearchChat('');
    setShowAgentModal(false); 
    
    setTimeout(() => setIsHandshaking(false), 800);

    // Zera o contador visual de mensagens não lidas
    if (naoLidasPorContato[contato.id]) {
      setNaoLidasPorContato(prev => {
        const next = { ...prev };
        delete next[contato.id];
        return next;
      });
    }
  };

  // --- FUNÇÃO CORE DE DISPARO ---
  // Monta o objeto final e joga no socket para distribuição Real-Time
  const dispararMensagem = (textoFinal) => {
    if (!textoFinal.trim() || !contatoAtivo || !socket) return;
    const novaMsg = { 
      id: Date.now(), remetenteId: userId, remetenteNome: nomeLogado,
      destinoId: contatoAtivo.id, texto: textoFinal, data: new Date(), tipo: 'sent' 
    };
    setHistoricoChat(prev => [...prev, novaMsg]); // Atualiza estado local
    socket.emit('enviar_mensagem_chat', novaMsg); // Transmite ao Backend NodeJS
  };

  // Wrapper acionado pelo Enter no Input ou botão Send
  const enviarMensagemTexto = (e) => {
    e?.preventDefault();
    if (!mensagem.trim() || mensagem === '/') return;

    let textoFinal = mensagem;
    // Se for uma resposta a mensagem anterior (Citação) inclui a tag especial [REP:]
    if (responderA) textoFinal = `[REP:${responderA.texto}] ${mensagem}`;
    dispararMensagem(textoFinal);
    setMensagem('');
    setResponderA(null);
  };
  
  // --- LÓGICA DE ARQUIVOS E DRAG & DROP ---
  // Transforma imagens e documentos em Base64 DataURL (Simulação de anexo local)
  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { dispararMensagem(`[FILE:${file.name}|${file.type}]${reader.result}`); };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
  };

  const handleFileChange = (e) => { processFile(e.target.files[0]); e.target.value = ''; };
  const handleDragOver = (e) => { e.preventDefault(); if (contatoAtivo && !isHandshaking) setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if (!contatoAtivo || isHandshaking) return; processFile(e.dataTransfer.files[0]); };

  const enviarLocalizacao = () => {
    dispararMensagem(`[LOCATION] -23.5505, -46.6333`); // Mock coordenadas (São Paulo)
    setShowAttachMenu(false);
  };

  // --- MÓDULO DE GRAVAÇÃO DE ÁUDIO (MediaRecorder API) ---
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.isCanceled = false; 
      
      // Empacota os dados da voz em chunks
      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      // Quando parar, compila o Base64 e joga a tag customizada [AUDIO]
      recorder.onstop = () => {
        if (recorder.isCanceled) { stream.getTracks().forEach(track => track.stop()); return; }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
        const reader = new FileReader();
        reader.onloadend = () => { dispararMensagem(`[AUDIO]${reader.result}`); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start(); 
      mediaRecorderRef.current = recorder;
      setIsRecording(true); setRecordTime(0); setShowCommands(false); setShowAttachMenu(false);
      // Intervalo que atualiza a HUD tática do PTT na interface
      recordIntervalRef.current = setInterval(() => setRecordTime(prev => prev + 1), 1000);
    } catch (err) { alert('Permissão de microfone negada. Verifique as configurações do navegador.'); }
  };

  const pararEEnviarGravacao = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); 
    setIsRecording(false); clearInterval(recordIntervalRef.current);
  };

  const cancelarGravacao = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { 
      mediaRecorderRef.current.isCanceled = true; mediaRecorderRef.current.stop(); 
    }
    setIsRecording(false); clearInterval(recordIntervalRef.current);
  };

  // --- LÓGICA DE CHAMADAS VOIP (MOCK) ---
  const iniciarChamada = () => {
    setActiveCall({ status: 'calling', time: 0 });
    setTimeout(() => {
      setActiveCall({ status: 'connected', time: 0 });
      callIntervalRef.current = setInterval(() => {
        setActiveCall(prev => prev ? { ...prev, time: prev.time + 1 } : null);
      }, 1000);
    }, 2500); // Demora 2.5s para emular o atendimento do outro lado
  };

  const encerrarChamada = () => {
    clearInterval(callIntervalRef.current);
    dispararMensagem(`[CALL_END] Chamada de voz encerrada (${Math.floor(activeCall.time / 60)}:${String(activeCall.time % 60).padStart(2, '0')})`);
    setActiveCall(null);
  };

  const apagarMensagemLocal = (idParaApagar) => { setHistoricoChat(prev => prev.filter(m => m.id !== idParaApagar)); };
  
  // Abre o app externo do WhatsApp formatando a mensagem clicada
  const encaminharParaWhatsApp = (texto) => {
    const textoFormatado = encodeURIComponent(`*Alerta Tático TermoSync:*\n\n${texto.replace(/\[.*?\]\s*/, '')}`);
    window.open(`https://wa.me/?text=${textoFormatado}`, '_blank');
  };

  /* --- PARSER DE PROTOCOLOS DE MENSAGEM (O CORAÇÃO VISUAL DO CHAT) ---
     Traduz as tags em string gravadas no DB para componentes visuais avançados
     no JSX (Mapas, Áudio Players, Arquivos de PDF, e Tags de Sistema).
  */
  const renderBubbleText = (textoBruto) => {
    if (!textoBruto) return '';
    
    // Tratativa Visual para Fim de Chamada VOIP
    if (textoBruto.startsWith('[CALL_END]')) {
      return (
        <div className="system-msg-bubble" style={{background: 'rgba(56, 189, 248, 0.1)', color: 'var(--chat-secondary)', borderColor: 'rgba(56, 189, 248, 0.3)'}}>
          <PhoneOff size={16} /> {textoBruto.replace('[CALL_END]', '')}
        </div>
      );
    }
    
    // Tratativa Visual do Protocolo de Coordenadas
    if (textoBruto.startsWith('[LOCATION]')) {
      return (
        <div className="gps-location-bubble">
          <div className="gps-icon"><MapPin size={24} /></div>
          <div className="gps-details">
            <strong>Coordenadas Táticas</strong>
            <span>{textoBruto.replace('[LOCATION]', '').trim()}</span>
          </div>
        </div>
      );
    }

    // Comandos Administrativos renderizam sem formatação extra, a tag do CSS já os cobre
    if (textoBruto.startsWith('[SYSTEM_REQ]')) return textoBruto.replace('[SYSTEM_REQ]', '');
    if (textoBruto.startsWith('[SYSTEM]')) return textoBruto.replace('[SYSTEM]', '');

    // Tratativa Visual do Arquivo de Áudio Base64
    if (textoBruto.startsWith('[AUDIO]')) {
      return (
        <div className="audio-bubble-content">
          <Radio size={18} opacity={0.8} />
          <audio controls src={textoBruto.substring(7)} preload="metadata" />
        </div>
      );
    }

    // Tratativa Visual para Uploads Gerais de Arquivo
    if (textoBruto.startsWith('[FILE:')) {
      const metaEnd = textoBruto.indexOf(']');
      if (metaEnd === -1) return "Arquivo corrompido";
      const metaInfo = textoBruto.substring(6, metaEnd).split('|');
      const fileName = metaInfo[0]; const fileType = metaInfo[1] || ''; const src = textoBruto.substring(metaEnd + 1);

      if (fileType.startsWith('image/')) {
        return (
          <div className="file-img-bubble">
            <img src={src} alt={fileName} className="chat-img-thumbnail" onClick={() => setPreviewImage(src)} />
            <span style={{fontSize: '0.75rem', fontWeight: 'bold'}}>{fileName}</span>
          </div>
        );
      } else {
        return (
          <a href={src} download={fileName} className="chat-file-attachment">
            <FileText size={20} color="var(--chat-primary)" />
            <span>{fileName}</span>
          </a>
        );
      }
    }

    // Tratativa Visual para Respostas (Citando mensagem superior)
    const repMatch = textoBruto.match(/\[REP:(.*?)\]\s*(.*)/);
    if (repMatch) {
      let repliedContent = repMatch[1];
      if (repliedContent.startsWith('[AUDIO]')) repliedContent = '🎤 Transmissão de Rádio';
      else if (repliedContent.startsWith('[FILE:')) repliedContent = '📎 Pacote de Dados';
      else if (repliedContent.startsWith('[LOCATION]')) repliedContent = '📍 Localização GPS';
      return (
        <>
          <div className="msg-reply-block"><strong>Citação Direta:</strong><p>{repliedContent}</p></div>
          {repMatch[2]}
        </>
      );
    }
    
    // Motor de Highlighter na Lupa de Pesquisa Interna
    if (searchChat && textoBruto.toLowerCase().includes(searchChat.toLowerCase())) {
      const safeSearch = searchChat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = textoBruto.split(new RegExp(`(${safeSearch})`, 'gi'));
      return parts.map((part, i) => part.toLowerCase() === searchChat.toLowerCase() ? <mark key={i} className="search-highlight" style={{background: 'var(--chat-secondary)', color: '#000', borderRadius: '4px', padding: '0 4px'}}>{part}</mark> : part);
    }

    // Mensagem de Texto Normal
    return textoBruto;
  };

  return (
    <div 
      className={`anim-fade-in chat-page-container ${contatoAtivo ? 'has-active-chat' : ''}`} 
      onClick={() => { setShowCommands(false); setShowAttachMenu(false); }}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
    >
      {/* --- OVERLAY DE ARQUIVO (DRAG & DROP) --- */}
      {isDragging && contatoAtivo && !isHandshaking && (
        <div className="chat-drag-overlay">
          <div className="drag-content">
            <UploadCloud size={64} /><h2>Transmitir Pacote</h2><p>Solte para fazer upload no canal de {contatoAtivo.nome}</p>
          </div>
        </div>
      )}

      {/* --- MODAL DE IMAGEM AMPLIADA --- */}
      {previewImage && (
        <div className="lightbox-overlay" onClick={() => setPreviewImage(null)} style={{position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <button onClick={() => setPreviewImage(null)} style={{position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={32} /></button>
          <img src={previewImage} alt="Preview" style={{maxHeight: '90vh', maxWidth: '90vw', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)'}} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* --- OVERLAY DE CHAMADA TÁTICA (VOIP MOCK) --- */}
      {activeCall && contatoAtivo && (
        <div className="tactical-call-overlay">
          <div className="call-radar">
            <div className="call-wave"></div>
            <div className="call-wave"></div>
            <div className="call-avatar">{contatoAtivo.nome.charAt(0)}</div>
          </div>
          <div className="call-info">
            <h2>{contatoAtivo.nome}</h2>
            {activeCall.status === 'calling' ? (
              <p className="pulse-soft">Estabelecendo uplink de rádio...</p>
            ) : (
              <p style={{color: 'var(--chat-secondary)'}}>Conexão Segura: {Math.floor(activeCall.time / 60)}:{String(activeCall.time % 60).padStart(2, '0')}</p>
            )}
          </div>
          <div className="call-actions">
            <button className="btn-end-call" onClick={encerrarChamada}><PhoneOff size={28} /></button>
          </div>
        </div>
      )}

      {/* --- SIDEBAR DE LISTAGEM --- */}
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
              <div className="contact-avatar-wrapper">
                <div className="contact-avatar global-avatar"><Globe size={22} /></div>
              </div>
              <div className="contact-info">
                <span className="contact-name">{canalGlobal.nome}</span>
                <span className="contact-role">{canalGlobal.cargo}</span>
              </div>
            </div>
          )}

          <div className="contacts-divider">Rede de Operadores</div>

          {contatosFiltrados.length === 0 ? (
            <div className="chat-empty-contacts">
               <User size={32} />
               <p style={{fontSize: '0.8rem', marginTop: '10px'}}>Nenhum agente localizado.</p>
            </div>
          ) : (
            contatosFiltrados.map(contato => {
              const qtdNaoLidas = naoLidasPorContato[contato.id] || 0;
              const isActive = contatoAtivo?.id === contato.id;
              return (
                <div key={contato.id} className={`chat-contact-item ${isActive ? 'active' : ''} ${qtdNaoLidas > 0 && !isActive ? 'has-unread' : ''}`} onClick={() => handleSelecionarContato(contato)}>
                  <div className="contact-avatar-wrapper">
                    <div className="contact-avatar">{contato.nome.charAt(0).toUpperCase()}</div>
                    <span className="status-indicator online"></span>
                  </div>
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

      {/* --- ÁREA PRINCIPAL DO CHAT (MENSAGENS) --- */}
      <div className="chat-main-area">
        {contatoAtivo ? (
          <>
            <div className="chat-main-header">
              {showSearchChat ? (
                <div className="chat-header-search-box anim-fade-in" style={{display: 'flex', alignItems: 'center', width: '100%', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--chat-primary)'}}>
                  <Search size={18} color="var(--chat-primary)" style={{marginRight: '10px'}}/>
                  <input type="text" placeholder="Filtrar pacotes ou logs..." value={searchChat} onChange={e => setSearchChat(e.target.value)} autoFocus style={{flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono'}} />
                  <X size={20} color="var(--chat-muted)" style={{cursor: 'pointer'}} onClick={() => {setShowSearchChat(false); setSearchChat('');}} />
                </div>
              ) : (
                <div className="chat-active-user anim-fade-in" onClick={() => !contatoAtivo.isGroup && setShowAgentModal(true)} style={{cursor: contatoAtivo.isGroup ? 'default' : 'pointer'}}>
                  <button className="chat-header-btn mobile-back-btn" onClick={(e) => { e.stopPropagation(); setContatoAtivo(null); setShowAgentModal(false); }}>
                    <ArrowLeft size={20} />
                  </button>

                  <div className="contact-avatar-wrapper">
                    <div className={`contact-avatar ${contatoAtivo.isGroup ? 'global-avatar' : ''}`} style={{ width: '42px', height: '42px', fontSize: '1.1rem' }}>
                      {contatoAtivo.isGroup ? <Globe size={20}/> : contatoAtivo.nome.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="chat-user-header-details">
                    <h3>{contatoAtivo.nome}</h3>
                    {isTyping && !contatoAtivo.isGroup ? <span className="chat-status-typing">Criptografando pacote...</span> : <span className="chat-status-online"><span className="chat-status-dot"></span> Link Seguro Estabelecido</span>}
                  </div>
                </div>
              )}
              
              <div className="chat-header-actions">
                {!showSearchChat && <button className="chat-header-btn action-search-btn" onClick={() => setShowSearchChat(true)} title="Inspecionar Histórico"><Search size={18} /></button>}
                {!contatoAtivo.isGroup && (
                  <>
                    <button className="chat-header-btn" onClick={iniciarChamada} title="Uplink de Áudio"><PhoneCall size={18} /></button>
                    <button className="chat-header-btn action-panel-btn" onClick={() => setShowAgentModal(true)} title="Telemetria do Agente"><Activity size={18} /></button>
                  </>
                )}
              </div>
            </div>

            <div className="secure-channel-banner">
              <Shield size={14} /> Canal Tático (E2E AES-256)
            </div>

            <div className="chat-history-container">
              {showScrollBottom && <button className="scroll-bottom-btn" onClick={scrollToBottom} style={{position: 'absolute', bottom: '20px', right: '20px', background: 'var(--chat-panel)', border: '1px solid var(--chat-border)', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer', zIndex: 50, boxShadow: '0 5px 15px rgba(0,0,0,0.5)'}}><ChevronDown size={24} /></button>}

              {isHandshaking ? (
                <div className="handshake-overlay">
                  <ShieldAlert size={48} />
                  <div className="handshake-text">NEGOCIANDO CHAVES RSA-2048...</div>
                </div>
              ) : (
                <div className="chat-history" onScroll={handleScroll} ref={historyContainerRef}>
                  {mensagensExibidas.length === 0 && (
                    <div className="chat-secure-empty-state">
                      <Shield size={48} className="secure-icon pulse-soft" />
                      <h4 style={{color: 'white', marginBottom: '10px', fontFamily: 'JetBrains Mono'}}>UPLINK CONFIRMADO</h4>
                      <p style={{fontSize: '0.85rem', lineHeight: '1.5'}}>
                        Comunicação ponto-a-ponto estabelecida.<br/>
                        Todos os pacotes de dados roteados por esta frequência são confidenciais e auditados pelo NOC.
                      </p>
                    </div>
                  )}
                  
                  {/* LOOP DE RENDERIZAÇÃO DE BALÕES DE MENSAGENS */}
                  {mensagensExibidas.map((msg, index) => {
                    const previousMsg = mensagensExibidas[index - 1];
                    const mostrarSeparadorData = !previousMsg || (new Date(msg.data).toDateString() !== new Date(previousMsg.data).toDateString());
                    const mostrarHora = !previousMsg || (new Date(msg.data).getMinutes() !== new Date(previousMsg.data).getMinutes()) || (msg.remetenteId !== previousMsg.remetenteId);
                    
                    const isSystemMsg = msg.texto?.includes('[SYSTEM_REQ]') || msg.texto?.includes('[CALL_END]') || msg.texto?.includes('[SYSTEM]');

                    if (isSystemMsg) {
                      return (
                        <React.Fragment key={msg.id}>
                          {mostrarSeparadorData && !searchChat && <div className="chat-date-separator"><span>{new Date(msg.data).toLocaleDateString()}</span></div>}
                          {renderBubbleText(msg.texto)}
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={msg.id}>
                        {mostrarSeparadorData && !searchChat && <div className="chat-date-separator"><span>{new Date(msg.data).toLocaleDateString()}</span></div>}
                        
                        <div className={`msg-wrapper ${msg.tipo}`}>
                          <div className="msg-hover-actions">
                            <button type="button" className="msg-action-btn" onClick={() => encaminharParaWhatsApp(msg.texto)} title="Espelhar WhatsApp"><MessageCircle size={16} /></button>
                            <button type="button" className="msg-action-btn" onClick={() => setResponderA(msg)} title="Citar"><Reply size={16} /></button>
                            <button type="button" className="msg-action-btn text-danger" onClick={() => apagarMensagemLocal(msg.id)} title="Purgar"><Trash2 size={16} /></button>
                          </div>
                          <div className="msg-bubble">
                            {contatoAtivo.isGroup && msg.tipo === 'received' && <span className="msg-sender-name">{msg.remetenteNome}</span>}
                            {renderBubbleText(msg.texto)}
                          </div>
                          
                          {mostrarHora && (
                            <span className="msg-meta">
                              {new Date(msg.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              {msg.tipo === 'sent' && <CheckCheck size={14} className="read-ticks" />}
                            </span>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {isTyping && !searchChat && (
                    <div className="msg-wrapper received">
                      <div className="msg-bubble">
                        <div className="typing-dots"><span></span><span></span><span></span></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* --- CONTAINER INFERIOR (COMPOSIÇÃO DE MENSAGENS) --- */}
            <div className="chat-input-container">
              
              {isRecording ? (
                /* ESTADO: GRAVANDO ÁUDIO */
                <div className="ptt-tactical-bar anim-slide-up">
                  <div className="ptt-status">
                    <span className="ptt-dot"></span>
                    <strong className="desktop-only-inline">TRANSMISSÃO RÁDIO ATIVA</strong>
                    <span className="ptt-timer">{Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, '0')}</span>
                  </div>
                  
                  <div className="ptt-equalizer">
                    <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                  </div>

                  <div className="ptt-actions">
                    <button type="button" className="btn-ptt cancel" onClick={cancelarGravacao} title="Abortar"><X size={20}/></button>
                    <button type="button" className="btn-ptt send" onClick={pararEEnviarGravacao} title="Enviar Transmissão"><Send size={20}/></button>
                  </div>
                </div>
              ) : (
                /* ESTADO: CHAT NORMAL TEXTO */
                <>
                  {!responderA && !showCommands && !showAttachMenu && (
                    <div className="quick-replies-container anim-slide-up">
                      {quickReplies.map((reply, idx) => (
                        <button key={idx} className="quick-reply-btn" onClick={() => dispararMensagem(reply)}>{reply}</button>
                      ))}
                    </div>
                  )}

                  {showCommands && (
                    <div className="slash-command-menu anim-slide-up">
                      <div className="slash-header"><Terminal size={14}/> DIRETIVAS DE COMANDO</div>
                      {slashCommands.map((cmd, idx) => (
                        <div key={idx} className="slash-cmd-item" onClick={() => executarComando(cmd)}>
                          <div className="cmd-tag">{cmd.cmd}</div>
                          <div className="cmd-desc"><cmd.icon size={14} color="var(--chat-primary)"/> {cmd.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {showAttachMenu && (
                    <div className="attach-menu-overlay" onClick={(e) => e.stopPropagation()}>
                       <button className="attach-menu-item" onClick={() => { fileInputRef.current.click(); }}><Camera size={18} color="var(--chat-primary)"/> Câmera / Imagem</button>
                       <button className="attach-menu-item" onClick={() => { fileInputRef.current.click(); }}><FileText size={18} color="var(--chat-secondary)"/> Documento (PDF/CSV)</button>
                       <button className="attach-menu-item" onClick={enviarLocalizacao}><MapPin size={18} color="var(--warning)"/> Inserir Coordenadas (GPS)</button>
                    </div>
                  )}

                  {responderA && (
                    <div className="reply-context-box">
                      <div className="reply-info">
                        <strong>Citação de {responderA.remetenteNome.split(' ')[0]}</strong>
                        <p>{responderA.texto.replace(/\[AUDIO\].*/, '🎤 Áudio').replace(/\[FILE:.*?\].*/, '📎 Anexo').replace(/\[LOCATION\].*/, '📍 Localização').replace(/\[REP:.*?\]\s*/, '')}</p>
                      </div>
                      <button type="button" className="btn-close-reply" onClick={() => setResponderA(null)}><X size={18} /></button>
                    </div>
                  )}

                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

                  <form className="chat-type-area" onSubmit={enviarMensagemTexto}>
                    <button type="button" className={`chat-btn-icon file-attach-btn ${showAttachMenu ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); setShowCommands(false); }}><Paperclip size={20} /></button>
                    
                    <div className="chat-input-wrapper">
                      <input 
                        type="text" 
                        placeholder={showCommands ? "Selecione a diretiva..." : "Sintetize a mensagem ou '/' para comandos táticos..."}
                        value={mensagem}
                        onChange={handleInputChange}
                        onFocus={() => setShowAttachMenu(false)}
                        autoFocus={window.innerWidth > 768} 
                      />
                    </div>

                    {mensagem.trim() && !showCommands ? (
                      <button type="submit" className="btn-send"><Send size={20} style={{ marginLeft: '-2px' }} /></button>
                    ) : (
                      <button type="button" className="btn-ptt-trigger" onClick={iniciarGravacao} title="Rádio PTT"><Radio size={20} /></button>
                    )}
                  </form>
                </>
              )}
            </div>
          </>
        ) : (
          /* ESTADO VAZIO: TELA INICIAL QUANDO NÃO HÁ CONTATO SELECIONADO */
          <div className="chat-secure-empty-state" style={{border: 'none', background: 'transparent', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <div style={{margin: 'auto', textAlign: 'center'}}>
              <Shield size={64} color="var(--chat-primary)" style={{opacity: 0.8, marginBottom: '20px', filter: 'drop-shadow(0 0 15px rgba(16,185,129,0.4))'}} />
              <h3 style={{color: 'white', fontFamily: 'JetBrains Mono', letterSpacing: '1px'}}>TermoSync Uplink Node</h3>
              <p style={{fontSize: '0.85rem'}}>Aguardando seleção de agente na matriz lateral para<br/>estabelecer túnel de comunicação seguro.</p>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL DE TELEMETRIA DO AGENTE --- 
          Acionado através do ícone Activity no header do contato
      */}
      {contatoAtivo && !contatoAtivo.isGroup && showAgentModal && (
        <div className="chat-modal-overlay anim-fade-in" onClick={() => setShowAgentModal(false)}>
          <div className="agent-modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="agent-modal-header">
              <h4><Activity size={18} color="var(--chat-primary)"/> Telemetria do Agente</h4>
              <button className="btn-close-modal" onClick={() => setShowAgentModal(false)}><X size={20}/></button>
            </div>
            
            <div className="agent-modal-body">
              <div className="agent-avatar-large">{contatoAtivo.nome.charAt(0).toUpperCase()}</div>
              <h2 className="agent-name-large">{contatoAtivo.nome}</h2>
              <span className="agent-role-badge">{contatoAtivo.cargo}</span>

              <div className="agent-telemetry-metrics">
                <div className="telemetry-item">
                  <div className="t-icon-box success"><Zap size={20}/></div>
                  <div className="t-data">
                    <span className="t-label">Status Uplink</span>
                    <span className="t-value text-success">ONLINE (Criptografado)</span>
                  </div>
                </div>
                
                <div className="telemetry-item">
                  <div className="t-icon-box primary">
                    <div className="radar-icon-pulse">
                      <Crosshair size={20} />
                      <div className="radar-wave"></div>
                    </div>
                  </div>
                  <div className="t-data">
                    <span className="t-label">Sinal GPS / Setor</span>
                    <span className="t-value">{contatoAtivo.filial || 'Acesso Restrito'}</span>
                  </div>
                </div>
              </div>

              {/* Botoões de Intervenção e Slash Commands forçados pelo Gestor */}
              <div className="agent-tactical-protocols">
                <h5 className="protocol-title">Ações Operacionais de Resposta</h5>
                
                <button className="btn-protocol whatsapp-protocol" onClick={() => { 
                  const cmd = slashCommands.find(c => c.cmd === '/wa-bridge');
                  if(cmd) dispararMensagem(cmd.output); 
                  setShowAgentModal(false); 
                }}>
                  <div className="protocol-icon"><MessageCircle size={22}/></div>
                  <div className="protocol-info">
                    <span className="protocol-name">Forçar Bridge WhatsApp</span>
                    <span className="protocol-desc">Espelhar diretivas táticas no celular do agente</span>
                  </div>
                </button>

                <button className="btn-protocol danger-protocol" onClick={() => { 
                  const cmd = slashCommands.find(c => c.cmd === '/alerta');
                  if(cmd) dispararMensagem(cmd.output); 
                  setShowAgentModal(false); 
                }}>
                  <div className="protocol-icon"><ShieldAlert size={22}/></div>
                  <div className="protocol-info">
                    <span className="protocol-name">Emitir Alerta Prioritário</span>
                    <span className="protocol-desc">Sobrepor tela do agente e forçar resposta imediata</span>
                  </div>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}