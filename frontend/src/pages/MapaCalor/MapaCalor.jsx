import React, { useState, useEffect, useRef } from 'react';
import { Map, MapPin, AlertTriangle, Snowflake, CheckCircle2, Crosshair, MousePointerClick, Trash2, UploadCloud, Image as ImageIcon, XSquare } from 'lucide-react';

export default function MapaCalor({ equipamentosDaFilial, notificacoesDaFilial }) {
  const fileInputRef = useRef(null);

  // Carrega as posições salvas com proteção
  const [posicoes, setPosicoes] = useState(() => {
    try {
      const salvas = localStorage.getItem('termosync_posicoes_mapa');
      return salvas ? JSON.parse(salvas) : {};
    } catch (e) { return {}; }
  });

  // [NOVIDADE] Carrega a imagem real da planta baixa
  const [imagemPlanta, setImagemPlanta] = useState(() => {
    try { return localStorage.getItem('termosync_planta_img') || null; } 
    catch (e) { return null; }
  });

  const [maquinaSelecionada, setMaquinaSelecionada] = useState(null);

  useEffect(() => {
    localStorage.setItem('termosync_posicoes_mapa', JSON.stringify(posicoes));
  }, [posicoes]);

  const dispararToast = (msg, tipo = 'info') => {
    window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg, type: tipo } }));
  };

  // Processa o Upload da imagem
  const handleUploadPlanta = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Limita a 3MB para não estourar a memória local
      if (file.size > 3 * 1024 * 1024) {
        dispararToast('A imagem é muito grande! Escolha um arquivo de até 3MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          setImagemPlanta(reader.result);
          localStorage.setItem('termosync_planta_img', reader.result);
          dispararToast('Planta Digital carregada com sucesso!', 'success');
        } catch(err) {
          dispararToast('Erro de armazenamento. A imagem excedeu o limite do navegador.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removerPlanta = () => {
    setImagemPlanta(null);
    localStorage.removeItem('termosync_planta_img');
    dispararToast('Planta customizada removida.', 'warning');
  };

  const handleCliqueMapa = (e) => {
    if (!maquinaSelecionada) return; 

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const xPerc = ((e.clientX - rect.left) / rect.width) * 100;
    const yPerc = ((e.clientY - rect.top) / rect.height) * 100;

    setPosicoes(prev => ({
      ...prev,
      [String(maquinaSelecionada)]: { x: xPerc, y: yPerc }
    }));
    
    setMaquinaSelecionada(null);
  };

  const removerDoMapa = (e, idEquipamento) => {
    e.stopPropagation(); 
    setPosicoes(prev => {
      const novasPosicoes = { ...prev };
      delete novasPosicoes[String(idEquipamento)];
      return novasPosicoes;
    });
    if (String(maquinaSelecionada) === String(idEquipamento)) setMaquinaSelecionada(null);
  };

  const getStatusEquipamento = (eq) => {
    const temFalha = notificacoesDaFilial?.some(n => String(n.equipamento_id) === String(eq.id));
    if (temFalha) return { cor: '#ef4444', icone: <AlertTriangle size={18} color="white" />, estado: 'alerta', pulse: true };
    if (eq.em_degelo) return { cor: '#38bdf8', icone: <Snowflake size={18} color="white" />, estado: 'degelo', pulse: false };
    if (eq.motor_ligado) return { cor: '#10b981', icone: <CheckCircle2 size={18} color="white" />, estado: 'gelando', pulse: false };
    return { cor: '#64748b', icone: <CheckCircle2 size={18} color="white" />, estado: 'repouso', pulse: false };
  };

  return (
    <div className="anim-fade-in" style={{ display: 'flex', gap: '1.5rem', minHeight: '75vh', width: '100%', alignItems: 'stretch' }}>
      
      {/* ========================================================= */}
      {/* BARRA LATERAL ESTREITA (PROPORÇÃO CORRETA) */}
      {/* ========================================================= */}
      <div style={{ width: '300px', flexShrink: 0, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
          <Map size={18} color="#3b82f6" /> Ferramentas
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>
          Clique no ativo abaixo e em seguida posicione-o na planta.
        </p>

        {/* BOTÃO DE UPLOAD DA PLANTA */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '10px' }}>
          <input type="file" accept="image/png, image/jpeg" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUploadPlanta} />
          
          {!imagemPlanta ? (
            <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#3b82f6', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
              <UploadCloud size={16} /> Importar Planta (JPG/PNG)
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
               <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid #3b82f6', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <ImageIcon size={14} /> Trocar Imagem
              </button>
              <button onClick={removerPlanta} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Remover Planta">
                <XSquare size={14} />
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.5rem' }}>
          {equipamentosDaFilial?.map(eq => {
            const eqIdStr = String(eq.id); 
            const isPosicionado = !!posicoes[eqIdStr];
            const isSelecionado = String(maquinaSelecionada) === eqIdStr;
            const status = getStatusEquipamento(eq);

            return (
              <div 
                key={eq.id}
                onClick={() => setMaquinaSelecionada(eqIdStr)}
                style={{ 
                  background: isSelecionado ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0,0,0,0.4)', 
                  border: `1px solid ${isSelecionado ? '#3b82f6' : 'rgba(255,255,255,0.05)'}`,
                  padding: '0.8rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                  borderLeft: `4px solid ${status.cor}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <strong style={{ color: 'white', fontSize: '0.85rem', display: 'block', marginBottom: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{eq.nome}</strong>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>{eq.setor}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isPosicionado && (
                      <button 
                        onClick={(e) => removerDoMapa(e, eq.id)} 
                        title="Remover do Mapa"
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {isSelecionado ? <Crosshair size={16} color="#3b82f6" className="pulse-blue-shadow" /> : (isPosicionado ? <MapPin size={16} color="#10b981" /> : <MousePointerClick size={16} color="#64748b" />)}
                  </div>
                </div>

                {isSelecionado && (
                  <div style={{ marginTop: '8px', background: '#3b82f6', color: 'white', fontSize: '0.7rem', padding: '4px', borderRadius: '4px', fontWeight: 'bold', textAlign: 'center' }}>
                    AGUARDANDO CLIQUE...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ÁREA DA PLANTA BAIXA (AMPLA E À PROVA DE COLAPSO) */}
      {/* ========================================================= */}
      <div 
        style={{ 
          flex: '1 1 auto', 
          minHeight: '650px', // <-- ISSO IMPEDE O MAPA DE SUMIR!
          position: 'relative', borderRadius: '16px', overflow: 'hidden', 
          cursor: maquinaSelecionada ? 'crosshair' : 'default',
          border: maquinaSelecionada ? '3px dashed #3b82f6' : '1px solid rgba(255,255,255,0.1)',
          
          // Se tiver imagem faz o fundo, senão exibe o grid azul da engenharia
          backgroundColor: imagemPlanta ? '#000' : '#0a3a60',
          backgroundImage: imagemPlanta ? `url(${imagemPlanta})` : `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: imagemPlanta ? 'contain' : '80px 80px, 80px 80px, 20px 20px, 20px 20px',
          backgroundPosition: imagemPlanta ? 'center' : '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
          backgroundRepeat: 'no-repeat',

          boxShadow: maquinaSelecionada ? 'inset 0 0 30px rgba(59, 130, 246, 0.4)' : 'none',
          transition: 'all 0.3s ease'
        }}
        onClick={handleCliqueMapa}
      >
        {/* RENDERIZA OS SENSORES POSICIONADOS NO MAPA */}
        {equipamentosDaFilial?.map(eq => {
          const pos = posicoes[String(eq.id)];
          if (!pos) return null; 

          const status = getStatusEquipamento(eq);
          const tAtual = parseFloat(eq.ultima_temp);

          return (
            <div 
              key={eq.id}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                zIndex: status.pulse ? 50 : 10,
                pointerEvents: 'none' 
              }}
            >
              {/* ÍCONE REDUZIDO (Proporção de planta baixa) */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', background: status.cor,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                boxShadow: status.pulse ? `0 0 0 0 ${status.cor}` : '0 4px 8px rgba(0,0,0,0.5)',
                animation: status.pulse ? 'pulse-alert-mini 1.5s infinite' : 'none',
                border: '2px solid white'
              }}>
                {status.icone}
              </div>
              
              {/* ETIQUETA COMPACTA E LEGÍVEL */}
              <div style={{ background: 'rgba(15, 23, 42, 0.95)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', minWidth: '90px', backdropFilter: 'blur(4px)', boxShadow: '0 4px 10px rgba(0,0,0,0.4)' }}>
                <div style={{ color: 'white', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{eq.nome}</div>
                <div style={{ color: status.cor, fontSize: '0.85rem', fontWeight: '900', marginTop: '1px' }}>
                  {!isNaN(tAtual) ? tAtual.toFixed(1) : '--'}°C
                </div>
              </div>
            </div>
          );
        })}

        {/* MENSAGEM SE O MAPA ESTIVER VAZIO */}
        {Object.keys(posicoes).length === 0 && !maquinaSelecionada && !imagemPlanta && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.5)', padding: '2rem', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
            <Map size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>Planta Digital Vazia</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Selecione um ativo na barra lateral ou faça o Upload da planta da loja.</p>
          </div>
        )}
        
        {/* Animação CSS para o pulso crítico */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-alert-mini {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1.15); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `}} />
      </div>

    </div>
  );
}