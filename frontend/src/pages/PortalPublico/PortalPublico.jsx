import React, { useState, useEffect } from 'react';
import { Thermometer, Snowflake, Power, AlertTriangle, CheckCircle2, Activity, MapPin } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../../config/api'; 
import '../Monitoramento/Monitoramento.css';

export default function PortalPublico({ filialUrl }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  const carregarDados = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/public/live/${encodeURIComponent(filialUrl)}`);
      if (res.data && res.data.success) {
        setDados(res.data);
        setErro(false);
      } else {
        setErro(true);
      }
    } catch (err) {
      console.error(err);
      setErro(true);
    }
  };

  useEffect(() => {
    carregarDados();
    const intervalo = setInterval(carregarDados, 10000);
    return () => clearInterval(intervalo);
  }, [filialUrl]);

  if (erro) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
        <h2><AlertTriangle color="#ef4444" /> Erro de Conexão. Tentando novamente...</h2>
      </div>
    );
  }

  if (!dados) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
        <h2 className="piscar-alerta">Carregando Painel TermoSync...</h2>
      </div>
    );
  }

  // =======================================================================
  // [NOVIDADE] AGRUPA OS EQUIPAMENTOS PELO NOME DA FILIAL
  // =======================================================================
  const equipamentosAgrupados = dados.equipamentos.reduce((grupos, eq) => {
    const nomeFilial = eq.filial || 'Filial Não Identificada';
    if (!grupos[nomeFilial]) {
      grupos[nomeFilial] = [];
    }
    grupos[nomeFilial].push(eq);
    return grupos;
  }, {});

  return (
    // [NOVIDADE] height: 100vh e overflowY: auto forçam a rolagem funcionar na TV
    <div style={{ 
      background: '#0f172a', 
      height: '100vh', 
      overflowY: 'auto', 
      padding: '2rem', 
      color: '#f8fafc', 
      fontFamily: 'system-ui, sans-serif' 
    }}>
      
      {/* CABEÇALHO DO PAINEL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#38bdf8' }}>
            {dados.unidade.toLowerCase() === 'todas' ? 'Visão Geral (Rede Completa)' : dados.unidade}
          </h1>
          <p style={{ margin: 0, fontSize: '1.2rem', color: '#94a3b8' }}>Monitoramento Operacional e Metrológico</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
            <span className="live-indicator-dot" style={{ width: '15px', height: '15px' }}></span> AO VIVO
          </div>
          <p style={{ margin: 0, color: '#64748b' }}>Atualizado a cada 10s</p>
        </div>
      </div>

      {/* AVISO SE A LISTA DE MÁQUINAS ESTIVER VAZIA */}
      {dados.equipamentos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#1e293b', borderRadius: '24px', border: '1px dashed #334155' }}>
          <Activity size={64} color="#64748b" style={{marginBottom: '1rem', opacity: 0.5}} />
          <h2 style={{color: '#cbd5e1', margin: '0 0 10px 0'}}>Nenhuma máquina encontrada.</h2>
          <p style={{color: '#94a3b8', fontSize: '1.1rem'}}>Verifique se o nome <b>"{dados.unidade}"</b> está escrito exatamente como foi cadastrado no sistema.<br/>Dica: Acesse <b>/live/Todas</b> para ver todos os equipamentos da rede.</p>
        </div>
      ) : (
        /* ======================================================================= */
        /* DESENHA OS BLOCOS POR FILIAL E OS CARDS DENTRO DE CADA UMA */
        /* ======================================================================= */
        Object.entries(equipamentosAgrupados).map(([nomeFilial, maquinasDaFilial], index) => (
          <div key={index} style={{ marginBottom: '3.5rem' }}>
            
            {/* TÍTULO DA FILIAL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', paddingBottom: '10px', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
              <MapPin size={28} color="#3b82f6" />
              <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f1f5f9' }}>{nomeFilial}</h2>
              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '10px' }}>
                {maquinasDaFilial.length} ativo(s)
              </span>
            </div>

            {/* GRID DAS MÁQUINAS DAQUELA FILIAL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
              {maquinasDaFilial.map((eq, idx) => {
                const t = parseFloat(eq.ultima_temp);
                const min = parseFloat(eq.temp_min);
                const max = parseFloat(eq.temp_max);
                const temDados = !isNaN(t);
                
                const isAcima = temDados && t > max;
                const isAbaixo = temDados && t < min;
                const isFalhaMecanica = !eq.motor_ligado && temDados && t >= (max + 10.0) && !eq.em_degelo;

                let corCard = '#1e293b'; 
                let corTexto = '#10b981'; 
                let icone = <CheckCircle2 size={36} />;
                let status = 'DENTRO DA NORMA';

                if (!temDados) {
                  corTexto = '#f59e0b'; icone = <AlertTriangle size={36} />; status = 'SEM SINAL';
                } else if (eq.em_degelo) {
                  corTexto = '#0ea5e9'; icone = <Snowflake size={36} />; status = 'EM DEGELO';
                } else if (isFalhaMecanica) {
                  corTexto = '#ef4444'; corCard = '#450a0a'; icone = <Power size={36} />; status = 'MOTOR PARADO';
                } else if (isAcima) {
                  corTexto = '#ef4444'; icone = <AlertTriangle size={36} />; status = 'ALTA TEMPERATURA';
                } else if (isAbaixo) {
                  corTexto = '#38bdf8'; icone = <Thermometer size={36} />; status = 'BAIXA TEMPERATURA';
                } else if (!eq.motor_ligado) {
                  status = 'EM REPOUSO (IDEAL)';
                }

                return (
                  <div key={idx} style={{ background: corCard, border: `2px solid ${corTexto}`, borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: `0 8px 20px ${corTexto}15` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{eq.nome}</h3>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>{eq.setor}</span>
                      </div>
                      <div style={{ color: corTexto }}>{icone}</div>
                    </div>

                    <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                      <span style={{ fontSize: '4.5rem', fontWeight: '900', color: corTexto, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                        {temDados ? t.toFixed(1) : '--'}°C
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                      <span style={{ fontSize: '1rem', color: '#cbd5e1' }}>Mín: <b>{min.toFixed(1)}°C</b></span>
                      <span style={{ fontSize: '1rem', fontWeight: '900', color: corTexto }}>{status}</span>
                      <span style={{ fontSize: '1rem', color: '#cbd5e1' }}>Máx: <b>{max.toFixed(1)}°C</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      
      {/* Estilização elegante para a barra de rolagem */}
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}