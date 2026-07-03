import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, ShieldCheck, AlertTriangle, ClipboardCheck, Edit, X, 
  Thermometer, Droplets, PackageSearch, Settings, MapPin, 
  Server, Search, Activity, Zap, Trash2, QrCode, History, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import './Equipamentos.css';

export default function Equipamentos({ 
  api, showToast, isOffline, userRole, userFilial, filiaisDb, listaSetores, listaTipos, 
  carregarDadosBase, equipamentosFiltradosLista, editarEquipamento, pedirExclusao 
}) {
  
  const formInicial = { 
    nome: '', tipo: '', temp_min: '', temp_max: '', 
    umidade_min: '', umidade_max: '', intervalo_degelo: '', 
    duracao_degelo: '', setor: '', filial: userRole === 'LOJA' ? userFilial : '', 
    data_calibracao: new Date().toISOString().split('T')[0] 
  };
  
  const [formEquip, setFormEquip] = useState({ ...formInicial });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [buscaAtivo, setBuscaAtivo] = useState('');
  
  // --- NOVO: ESTADO PARA O MODAL DE HISTÓRICO RÁPIDO ---
  const [modalHistorico, setModalHistorico] = useState(null);

  const aplicarNormaANVISA = (tipoSelecionado) => {
    if (!tipoSelecionado) return showToast('Selecione um Tipo de Refrigeração na seção acima primeiro.', 'warning');
    
    const tipoEncontrado = (listaTipos || []).find(t => t.nome === tipoSelecionado);
    const nomeLower = tipoSelecionado.toLowerCase();

    let tMin = 2, tMax = 8, uMin = 40, uMax = 80, iDeg = 12, dDeg = 20;

    if (nomeLower.includes('congel') || nomeLower.includes('ilha')) {
      tMin = -22; tMax = -18; uMin = 0; uMax = 0; iDeg = 6; dDeg = 30;
    } else if (nomeLower.includes('balcão') || nomeLower.includes('balcao') || nomeLower.includes('expositor')) {
      tMin = 0; tMax = 5; uMin = 40; uMax = 80; iDeg = 8; dDeg = 25;
    } else if (nomeLower.includes('vacina') || nomeLower.includes('medicamento')) {
      tMin = 2; tMax = 8; uMin = 0; uMax = 0; iDeg = 24; dDeg = 15;
    } else if (nomeLower.includes('câmara') || nomeLower.includes('camara') || nomeLower.includes('fria')) {
      tMin = 2; tMax = 8; uMin = 50; uMax = 85; iDeg = 12; dDeg = 30;
    }

    const hasValidVal = (val) => val !== undefined && val !== null && val !== '';

    if (tipoEncontrado) {
      if (hasValidVal(tipoEncontrado.temp_min)) tMin = tipoEncontrado.temp_min;
      if (hasValidVal(tipoEncontrado.temp_max)) tMax = tipoEncontrado.temp_max;
      if (hasValidVal(tipoEncontrado.umidade_min)) uMin = tipoEncontrado.umidade_min;
      if (hasValidVal(tipoEncontrado.umidade_max)) uMax = tipoEncontrado.umidade_max;
      if (hasValidVal(tipoEncontrado.intervalo_degelo)) iDeg = tipoEncontrado.intervalo_degelo;
      if (hasValidVal(tipoEncontrado.duracao_degelo)) dDeg = tipoEncontrado.duracao_degelo;
    }

    setFormEquip(prev => ({ ...prev, temp_min: tMin, temp_max: tMax, umidade_min: uMin, umidade_max: uMax, intervalo_degelo: iDeg, duracao_degelo: dDeg }));
    showToast(`Padrão ANVISA/RDC aplicado para: ${tipoSelecionado}`, 'success');
  };

  const salvarNovoEquipamento = async (e) => {
    e.preventDefault(); 
    if (isOffline) return showToast('Ação bloqueada. Sem conexão com a rede.', 'warning');
    
    const dadosFinais = { ...formEquip, filial: userRole === 'LOJA' ? userFilial : formEquip.filial };
    try { 
      await api.post('/equipamentos', dadosFinais); 
      showToast('Máquina registrada no Inventário IoT.', 'success'); 
      setFormEquip({ ...formInicial, filial: userRole === 'LOJA' ? userFilial : '' }); 
      setIsFormOpen(false);
      carregarDadosBase(); 
    } catch (e) { showToast('Ocorreu um erro ao gravar a máquina.', 'error'); }
  };

  // --- NOVA FUNÇÃO: GERADOR DE ETIQUETA QR (PDF) ---
  const gerarEtiquetaQR = (eq) => {
    showToast(`A gerar Etiqueta Inteligente para ${eq.nome}...`, 'info');
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] }); 
      
      doc.setFillColor(16, 185, 129); 
      doc.rect(0, 0, 100, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("TERMOSYNC - ATIVO IOT", 50, 13, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Patrimônio: ${eq.nome}`, 50, 30, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Local: ${eq.filial} - ${eq.setor}`, 50, 36, { align: "center" });
      doc.text(`Limites Térmicos: ${eq.temp_min}°C a ${eq.temp_max}°C`, 50, 42, { align: "center" });

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=termosync_ativo_${eq.id}`;
      doc.addImage(qrUrl, 'PNG', 20, 50, 60, 60);

      doc.setFontSize(8);
      doc.text("Em caso de avaria, aponte a câmara do", 50, 120, { align: "center" });
      doc.text("telemóvel para abrir a Ordem de Serviço.", 50, 125, { align: "center" });
      doc.text(`ID Interno: ${eq.id} | Validado: ${new Date().toLocaleDateString()}`, 50, 140, { align: "center" });

      doc.save(`Etiqueta_QR_${eq.nome}.pdf`);
      showToast('Download do PDF concluído.', 'success');
    } catch(err) {
      showToast('Erro ao desenhar PDF do QR Code.', 'error');
    }
  };

  const ativosExibidos = useMemo(() => {
    if (!equipamentosFiltradosLista) return [];
    if (!buscaAtivo.trim()) return equipamentosFiltradosLista;
    
    const termo = buscaAtivo.toLowerCase();
    return equipamentosFiltradosLista.filter(eq => 
      eq.nome.toLowerCase().includes(termo) || 
      eq.setor.toLowerCase().includes(termo) ||
      (eq.filial && eq.filial.toLowerCase().includes(termo)) ||
      (eq.tipo && eq.tipo.toLowerCase().includes(termo))
    );
  }, [equipamentosFiltradosLista, buscaAtivo]);

  const kpis = useMemo(() => {
    if (!ativosExibidos) return { total: 0, riscoCalib: 0, offlines: 0, degelo: 0 };
    let riscoCalib = 0; let offlines = 0; let degelo = 0;

    ativosExibidos.forEach(eq => {
      const diasCalib = eq.data_calibracao ? Math.floor((Date.now() - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      if (diasCalib > 330) riscoCalib++; 
      if (!eq.motor_ligado) offlines++;
      if (eq.em_degelo) degelo++;
    });

    return { total: ativosExibidos.length, riscoCalib, offlines, degelo };
  }, [ativosExibidos]);

  return (
    <div className="anim-fade-in stagger-1">
      
      {/* MODAL DE HISTÓRICO RÁPIDO */}
      {modalHistorico && (
        <div className="modal-overlay" onClick={() => setModalHistorico(null)} style={{zIndex: 9999}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px'}}>
              <h3 style={{margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px'}}><History size={22}/> Auditoria de Manutenção</h3>
              <button className="btn-icon" onClick={() => setModalHistorico(null)}><X size={20}/></button>
            </div>
            
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', marginBottom: '20px'}}>
              <h4 style={{margin: '0 0 5px 0', color: 'white'}}>{modalHistorico.nome}</h4>
              <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem'}}><MapPin size={12}/> {modalHistorico.filial} • {modalHistorico.setor}</p>
            </div>

            <div style={{maxHeight: '300px', overflowY: 'auto', paddingRight: '5px'}}>
              {/* Mock visual das últimas intervenções para o TCC */}
              <div style={{borderLeft: '2px solid var(--border)', paddingLeft: '15px', marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                <div style={{position: 'relative'}}>
                  <span style={{position: 'absolute', left: '-22px', top: '2px', background: 'var(--success)', width: '12px', height: '12px', borderRadius: '50%'}}></span>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold'}}>{new Date().toLocaleDateString()} (Recente)</div>
                  <div style={{color: 'white', fontSize: '0.9rem', marginTop: '4px'}}>OS-1045: Troca preventiva de gás R410A concluída.</div>
                </div>
                <div style={{position: 'relative'}}>
                  <span style={{position: 'absolute', left: '-22px', top: '2px', background: 'var(--border)', width: '12px', height: '12px', borderRadius: '50%'}}></span>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold'}}>12/03/2026</div>
                  <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px'}}>OS-0892: Limpeza do dreno e verificação da porta.</div>
                </div>
              </div>
            </div>
            
            <button className="btn btn-primary w-100" onClick={() => setModalHistorico(null)} style={{marginTop: '20px'}}>Fechar Relatório</button>
          </div>
        </div>
      )}

      <div className="flex-header equipamentos-header">
        <div>
          <h3 className="equipamentos-title">Inventário de Equipamentos & Metrologia</h3>
          <p className="equipamentos-subtitle">Gestão de ativos, calibração de sensores e SLA.</p>
        </div>

        <div className="action-group">
          <div className="search-box-iot">
            <Search size={16} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Pesquisar ativo, setor ou tipo..." 
              value={buscaAtivo}
              onChange={(e) => setBuscaAtivo(e.target.value)}
            />
          </div>
          
          <button 
            className={`btn ${isFormOpen ? 'btn-outline' : 'btn-primary'} btn-toggle-form`} 
            onClick={() => setIsFormOpen(!isFormOpen)}
          >
            {isFormOpen ? <X size={18}/> : <PlusCircle size={18}/>}
            {isFormOpen ? 'Cancelar' : 'Adicionar Equipamento'}
          </button>
        </div>
      </div>

      <div className="iot-kpi-bar stagger-2">
        <div className="kpi-item total">
          <div className="kpi-icon"><Server size={20}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.total}</span><span className="kpi-label">Equipamentos Instalados</span></div>
        </div>
        <div className={`kpi-item ${kpis.riscoCalib > 0 ? 'danger pulse-danger-border' : 'success'}`}>
          <div className="kpi-icon"><ClipboardCheck size={20}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.riscoCalib}</span><span className="kpi-label">Risco de Calibração</span></div>
        </div>
        <div className={`kpi-item ${kpis.offlines > 0 ? 'warning' : 'ok'}`}>
          <div className="kpi-icon"><AlertTriangle size={20}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.offlines}</span><span className="kpi-label">Sensores Inativos</span></div>
        </div>
      </div>

      <div className={`smart-form-panel ${isFormOpen ? 'open' : ''}`}>
        <div className="card equipamentos-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="equipamentos-card-header">
            <h3 className="equipamentos-card-title"><Settings size={20} color="var(--primary)" /> Perfil do Novo Ativo</h3>
          </div>
          
          <form onSubmit={salvarNovoEquipamento}>
            <div className="form-section">
              <div className="form-section-header"><h4 className="form-section-title"><MapPin size={16} color="var(--text-muted)"/> Identificação Física</h4></div>
              <div className="form-grid">
                <div><label>Identificador na Rede</label><input type="text" value={formEquip.nome} onChange={(e) => setFormEquip({ ...formEquip, nome: e.target.value })} placeholder="Ex: CONG-01 Corredor Frios" required /></div>
                <div><label>Filial Designada</label><select className="select-input" value={formEquip.filial} onChange={(e) => setFormEquip({ ...formEquip, filial: e.target.value })} required disabled={userRole === 'LOJA'} style={{ backgroundColor: userRole === 'LOJA' ? 'var(--bg-color)' : undefined }}><option value="">Selecione a Filial...</option>{filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                <div><label>Setor Operacional</label><select className="select-input" value={formEquip.setor} onChange={(e) => setFormEquip({ ...formEquip, setor: e.target.value })} required><option value="">Selecione o Setor...</option>{listaSetores?.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}</select></div>
                <div><label>Padrão Técnico (Tipo)</label><select className="select-input" value={formEquip.tipo} onChange={(e) => setFormEquip({ ...formEquip, tipo: e.target.value })} required><option value="">Selecione o Tipo...</option>{listaTipos?.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}</select></div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-header">
                <h4 className="form-section-title"><ShieldCheck size={16} color="var(--success)"/> Parâmetros de SLA & Alertas</h4>
                <button type="button" className="btn btn-anvisa" onClick={() => aplicarNormaANVISA(formEquip.tipo)} disabled={!formEquip.tipo || isOffline} title="Carregar configuração RDC/ANVISA automaticamente"><Zap size={14} /> Aplicar Perfil Normativo</button>
              </div>
              <div className="form-grid">
                <div><label>Temp. Mínima Crítica (°C)</label><input type="number" step="0.1" value={formEquip.temp_min} onChange={(e) => setFormEquip({ ...formEquip, temp_min: e.target.value })} required /></div>
                <div><label>Temp. Máxima Crítica (°C)</label><input type="number" step="0.1" value={formEquip.temp_max} onChange={(e) => setFormEquip({ ...formEquip, temp_max: e.target.value })} required /></div>
                <div><label>Umidade Mínima (%)</label><input type="number" step="0.1" value={formEquip.umidade_min} onChange={(e) => setFormEquip({ ...formEquip, umidade_min: e.target.value })} /></div>
                <div><label>Umidade Máxima (%)</label><input type="number" step="0.1" value={formEquip.umidade_max} onChange={(e) => setFormEquip({ ...formEquip, umidade_max: e.target.value })} /></div>
              </div>
            </div>

            <div className="form-section" style={{ marginBottom: 0 }}>
              <div className="form-section-header"><h4 className="form-section-title"><Thermometer size={16} color="var(--warning)"/> Metrologia Oficial e Ciclos</h4></div>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div><label>Data do Certificado de Calibração</label><input type="date" value={formEquip.data_calibracao} onChange={(e) => setFormEquip({ ...formEquip, data_calibracao: e.target.value })} required /></div>
                <div><label>Intervalo de Ciclo de Degelo (Horas)</label><input type="number" min="1" value={formEquip.intervalo_degelo} onChange={(e) => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required /></div>
                <div><label>Duração do Ciclo de Degelo (Min)</label><input type="number" min="1" value={formEquip.duracao_degelo} onChange={(e) => setFormEquip({ ...formEquip, duracao_degelo: e.target.value })} required /></div>
              </div>
            </div>
            
            <div className="equipamentos-form-actions">
              <button type="submit" className="btn btn-primary" disabled={isOffline}><PlusCircle size={18} /> Salvar Equipamento</button>
            </div>
          </form>
        </div>
      </div>
      
      <div className="card table-responsive stagger-3">
        {(!ativosExibidos || ativosExibidos.length === 0) ? (
          <div className="empty-state dashboard-empty">
             <PackageSearch size={56} style={{ opacity: 0.3, marginBottom: '1rem', color: 'var(--text-main)' }} />
             <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Nenhum ativo localizado.</h3>
             <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>A pesquisa não retornou resultados ou esta filial ainda não tem sensores integrados.</p>
          </div>
        ) : (
          <table className="table iot-table">
            <thead>
              <tr>
                <th>Topologia (Local)</th>
                <th>Identificação do Hardware</th>
                <th style={{ width: '250px' }}>Metrologia (Saúde da Aferição)</th>
                <th>SLA Térmico Configurado</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ativosExibidos.map(eq => {
                 const diasCalib = eq.data_calibracao ? Math.floor((Date.now() - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                 const calibPercent = Math.min(100, Math.max(0, (diasCalib / 365) * 100));
                 const isCritico = diasCalib > 330;
                 const isExpirado = diasCalib > 365;
                 
                 let ringColor = 'var(--success)';
                 let isPulse = false;
                 if (eq.em_degelo) ringColor = 'var(--secondary)';
                 else if (!eq.motor_ligado) { ringColor = 'var(--danger)'; isPulse = true; }

                 return (
                  <tr key={eq.id} className="iot-table-row">
                    <td data-label="Loja/Filial"><div className="node-location"><span className={`status-ring ${isPulse ? 'pulse' : ''}`} style={{ color: ringColor }} title={eq.em_degelo ? 'Em Degelo' : (!eq.motor_ligado ? 'Motor Parado/Falha' : 'Operando Normalmente')}></span> <strong>{eq.filial}</strong></div></td>
                    <td data-label="Hardware"><div className="equipamento-nome-box"><span className="hw-name">{eq.nome}</span><span className="equipamento-subtitle">{eq.tipo} • {eq.setor}</span></div></td>
                    <td data-label="Metrologia">
                      <div className="metrology-box">
                        <div className="metrology-labels"><span style={{ color: isExpirado ? 'var(--danger)' : (isCritico ? 'var(--warning)' : 'var(--text-muted)') }}>{isExpirado ? '⚠️ Certificado Expirado' : (isCritico ? 'Atenção: Prestes a expirar' : 'Dentro da Validade')}</span><strong>{diasCalib} dias</strong></div>
                        <div className="metrology-track"><div className={`metrology-fill ${isExpirado ? 'expired' : (isCritico ? 'warning' : 'ok')}`} style={{ width: `${calibPercent}%` }}></div></div>
                      </div>
                    </td>
                    <td data-label="SLA Operacional">
                      <div className="limites-box">
                        <span className="limit-tag termico"><Thermometer size={14} /> {eq.temp_min}°C a {eq.temp_max}°C</span>
                        {(eq.umidade_min || eq.umidade_max) && (<span className="limit-tag higro"><Droplets size={14} /> {eq.umidade_min || 40}% a {eq.umidade_max || 80}%</span>)}
                      </div>
                    </td>
                    <td data-label="Ações" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {/* --- NOVOS BOTÕES: QR CODE E HISTÓRICO --- */}
                        <button className="btn btn-action" style={{color: 'var(--secondary)', background: 'rgba(56,189,248,0.1)'}} onClick={() => setModalHistorico(eq)} title="Auditoria de Intervenções"><History size={18} /></button>
                        <button className="btn btn-action" style={{color: 'var(--primary)', background: 'rgba(16,185,129,0.1)'}} onClick={() => gerarEtiquetaQR(eq)} title="Imprimir Etiqueta QR"><QrCode size={18} /></button>
                        <button className="btn btn-action edit" onClick={() => editarEquipamento(eq)} disabled={isOffline} title="Editar Equipamento"><Edit size={18} /></button>
                        <button className="btn btn-action delete" style={isOffline ? { color: 'var(--text-muted)', background: 'transparent' } : {}} onClick={() => pedirExclusao(eq.id, eq.nome)} disabled={isOffline} title="Excluir Equipamento"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}