import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, Target, Search, ShieldCheck, ShieldAlert, 
  AlertTriangle, Calendar, Edit, Server, MapPin, Lock, Shield
} from 'lucide-react';
import './Metrologia.css';

export default function Metrologia({ equipamentosDaFilial, editarEquipamento, userRole, filialAtiva }) {
  
  const [busca, setBusca] = useState('');

  // ============================================================================
  // MOTOR DE SEGURANÇA E ISOLAMENTO DE ACESSO
  // ============================================================================
  const roleLogada = userRole || sessionStorage.getItem('userRole') || 'LOJA';
  const papelLogado = sessionStorage.getItem('papelLogado') || ''; 
  const isGestorLoja = papelLogado.toLowerCase().includes('gerente') || papelLogado.toLowerCase().includes('coordenador');
  
  // Apenas Gestores da Loja, Manutenção e NOC podem registrar aferições (alterar a data do certificado).
  const canEdit = roleLogada === 'ADMIN' || roleLogada === 'DEV' || roleLogada === 'MANUTENCAO' || (roleLogada === 'LOJA' && isGestorLoja);

  // Isolamento Rigoroso de Filial (Tenancy tolerante a dados de teste)
  const equipamentosSeguros = useMemo(() => {
    let lista = equipamentosDaFilial || [];
    if (filialAtiva && filialAtiva !== 'Todas') {
      const f = filialAtiva.trim().toLowerCase();
      lista = lista.filter(eq => (eq.filial || 'Loja Principal').trim().toLowerCase() === f);
    }
    return lista;
  }, [equipamentosDaFilial, filialAtiva]);

  // Processa o tempo e o estado da calibração baseado nos dados permitidos
  const analise = useMemo(() => {
    const hoje = new Date().getTime();
    return equipamentosSeguros.map(eq => {
      const dias = eq.data_calibracao ? Math.floor((hoje - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const status = dias > 365 ? 'VENCIDO' : (dias > 330 ? 'ALERTA' : 'OK');
      return { ...eq, dias_calibracao: dias, status_calibracao: status };
    }).sort((a, b) => b.dias_calibracao - a.dias_calibracao);
  }, [equipamentosSeguros]);

  // Motor de Pesquisa
  const equipamentosFiltrados = useMemo(() => {
    if (!busca.trim()) return analise;
    const termo = busca.toLowerCase().trim();
    return analise.filter(eq => 
      (eq.nome || '').toLowerCase().includes(termo) || 
      (eq.filial || '').toLowerCase().includes(termo) ||
      (eq.setor || '').toLowerCase().includes(termo)
    );
  }, [analise, busca]);

  // KPIs de Auditoria
  const kpis = useMemo(() => {
    const total = analise.length;
    let conforme = 0; let alerta = 0; let vencidos = 0;
    analise.forEach(eq => {
      if (eq.status_calibracao === 'OK') conforme++;
      else if (eq.status_calibracao === 'ALERTA') alerta++;
      else vencidos++;
    });
    return { total, conforme, alerta, vencidos };
  }, [analise]);

  return (
    <div className="anim-fade-in stagger-1">
      
      {/* HEADER & SEARCH */}
      <div className="metrologia-header-actions">
        <div>
          <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <Target style={{ marginRight: '10px', color: 'var(--info)' }}/> Controle Metrológico
          </h3>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
            Governança e auditoria de certificados de calibração (Normas RDC / HACCP).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box-metrologia">
            <Search size={16} color="var(--text-muted)" />
            <input type="text" placeholder="Pesquisar equipamento ou filial..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          {!canEdit && (
            <div className="read-only-banner" title="Modo de Leitura: Apenas Manutenção ou Gestores podem alterar a data da calibração.">
              <Lock size={16} /> Auditoria Estrita
            </div>
          )}
        </div>
      </div>

      {/* KPI BAR */}
      <div className="metrologia-kpi-bar stagger-2">
        <div className="kpi-item total">
          <div className="kpi-icon" style={{color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 10%, transparent)'}}><ClipboardCheck size={22}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.total}</span><span className="kpi-label">Ativos Auditados</span></div>
        </div>
        <div className="kpi-item success">
          <div className="kpi-icon"><ShieldCheck size={22}/></div>
          <div className="kpi-data"><span className="kpi-value" style={{color: 'var(--success)'}}>{kpis.conforme}</span><span className="kpi-label">Selos Conformes</span></div>
        </div>
        <div className="kpi-item warning" style={{ background: 'color-mix(in srgb, var(--warning) 5%, var(--card-bg))', borderColor: 'color-mix(in srgb, var(--warning) 20%, transparent)' }}>
          <div className="kpi-icon" style={{color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 10%, transparent)'}}><AlertTriangle size={22}/></div>
          <div className="kpi-data"><span className="kpi-value" style={{color: 'var(--warning)'}}>{kpis.alerta}</span><span className="kpi-label">Renovações Próximas</span></div>
        </div>
        <div className="kpi-item danger">
          <div className="kpi-icon"><ShieldAlert size={22}/></div>
          <div className="kpi-data"><span className="kpi-value" style={{color: 'var(--danger)'}}>{kpis.vencidos}</span><span className="kpi-label">Selos Vencidos</span></div>
        </div>
      </div>

      {/* TABELA DE AUDITORIA */}
      <div className="metrologia-table-card stagger-3">
        <table className="table metrologia-table">
          <thead>
            <tr>
              <th>Identificação do Ativo</th>
              <th>Localização</th>
              <th>Última Calibração</th>
              <th>Status (Conformidade)</th>
              <th style={{ textAlign: 'right' }}>Ações de Auditoria</th>
            </tr>
          </thead>
          <tbody>
            {equipamentosFiltrados.map(eq => (
              <tr key={eq.id} className={`metrologia-row ${eq.status_calibracao === 'VENCIDO' ? 'row-vencida' : ''}`}>
                
                <td data-label="Hardware">
                  <div className="equip-ident-box">
                    <div className="equip-icon"><Server size={18} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{eq.nome}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>{eq.setor}</span>
                    </div>
                  </div>
                </td>
                
                <td data-label="Localização">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    <MapPin size={14} /> {eq.filial || 'Matriz / Loja Principal'}
                  </div>
                </td>
                
                <td data-label="Auditoria">
                  <div className="dias-box" style={{ color: eq.status_calibracao === 'VENCIDO' ? 'var(--danger)' : 'var(--text-main)' }}>
                    <Calendar size={14} /> 
                    {eq.dias_calibracao === 999 ? 'Sem Registro' : `${eq.dias_calibracao} dias atrás`}
                  </div>
                  {eq.data_calibracao && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Aferido em: {new Date(eq.data_calibracao).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </td>
                
                <td data-label="SLA Compliance">
                  {eq.status_calibracao === 'VENCIDO' && (
                    <span className="badge-metro badge-vencido">
                      <ShieldAlert size={14}/> CERTIFICADO VENCIDO
                    </span>
                  )}
                  {eq.status_calibracao === 'ALERTA' && (
                    <span className="badge-metro badge-alerta">
                      <AlertTriangle size={14}/> RENOVAÇÃO PENDENTE
                    </span>
                  )}
                  {eq.status_calibracao === 'OK' && (
                    <span className="badge-metro badge-conforme">
                      <ShieldCheck size={14}/> CONFORME NORMAS
                    </span>
                  )}
                </td>
                
                <td data-label="Ação" style={{ textAlign: 'right' }}>
                  {canEdit ? (
                    <button 
                      className="btn btn-outline" 
                      onClick={() => editarEquipamento(eq)}
                      style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit size={14} /> REGISTRAR AFERIÇÃO
                    </button>
                  ) : (
                    <div className="lock-icon-read" title="Apenas Gestores, Manutenção ou NOC podem registrar aferições">
                      <Shield size={16} /> <span className="desktop-only-inline" style={{fontSize: '0.7rem', marginLeft: '6px'}}>Protegido</span>
                    </div>
                  )}
                </td>
                
              </tr>
            ))}
            
            {equipamentosFiltrados.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <ClipboardCheck size={40} style={{ opacity: 0.2, margin: '0 auto 1rem auto', display: 'block' }}/>
                  <p style={{ fontWeight: 'bold', fontSize: '1rem', margin: 0, color: 'var(--text-main)' }}>Nenhum ativo localizado.</p>
                  <p style={{ fontSize: '0.85rem' }}>A pesquisa não retornou resultados ou a filial atual não possui sensores.</p>
                </td>
              </tr>
            )}
            
          </tbody>
        </table>
      </div>
    </div>
  );
}