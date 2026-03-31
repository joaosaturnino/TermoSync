import React, { useState } from 'react';
import { PlusCircle, ShieldCheck, AlertTriangle, ClipboardCheck, Edit, X } from 'lucide-react';

export default function Equipamentos({ 
  api, showToast, isOffline, userRole, userFilial, filiaisDb, listaSetores, listaTipos, 
  carregarDadosBase, equipamentosFiltradosLista, editarEquipamento, pedirExclusao 
}) {
  const formInicial = { nome: '', tipo: '', temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', intervalo_degelo: '', duracao_degelo: '', setor: '', filial: userRole === 'LOJA' ? userFilial : '', data_calibracao: new Date().toISOString().split('T')[0] };
  const [formEquip, setFormEquip] = useState({ ...formInicial });

  const aplicarNormaANVISA = (tipoSelecionado) => {
    if (!tipoSelecionado) return showToast('Selecione um Tipo de Refrigeração primeiro.', 'warning');
    const tipoEncontrado = (listaTipos || []).find(t => t.nome === tipoSelecionado);
    if (tipoEncontrado) {
      setFormEquip(prev => ({ ...prev, temp_min: tipoEncontrado.temp_min, temp_max: tipoEncontrado.temp_max, umidade_min: tipoEncontrado.umidade_min, umidade_max: tipoEncontrado.umidade_max, intervalo_degelo: tipoEncontrado.intervalo_degelo, duracao_degelo: tipoEncontrado.duracao_degelo }));
      showToast('Padrão Legal (ANVISA) aplicado!', 'info');
    } else showToast('Tipo de Refrigeração não encontrado no sistema.', 'error');
  };

  const salvarNovoEquipamento = async (e) => {
    e.preventDefault(); if (isOffline) return showToast('Ação bloqueada.', 'warning');
    const dadosFinais = { ...formEquip, filial: userRole === 'LOJA' ? userFilial : formEquip.filial };
    try { await api.post('/equipamentos', dadosFinais); showToast('Equipamento registado.', 'success'); setFormEquip({ ...formInicial, filial: userRole === 'LOJA' ? userFilial : '' }); carregarDadosBase(); } 
    catch (e) { showToast('Erro ao salvar.', 'error'); }
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><PlusCircle size={20} color="var(--primary)" /> Novo Equipamento</h3>
          <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderColor: 'var(--info)', color: 'var(--info)' }} onClick={() => aplicarNormaANVISA(formEquip.tipo)} disabled={!formEquip.tipo || isOffline}><ShieldCheck size={16} /> Preencher Padrão Legal</button>
        </div>
        <form onSubmit={salvarNovoEquipamento}>
          <div className="form-grid">
            <div><label>Identificador Máquina</label><input type="text" value={formEquip.nome} onChange={(e) => setFormEquip({ ...formEquip, nome: e.target.value })} required /></div>
            <div>
                <label>Filial / Loja Física</label>
                <select className="select-input" value={formEquip.filial} onChange={(e) => setFormEquip({ ...formEquip, filial: e.target.value })} required disabled={userRole === 'LOJA'} style={{ backgroundColor: userRole === 'LOJA' ? 'var(--bg-color)' : undefined }}>
                  <option value="">Selecione...</option>{filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
            </div>
            <div>
                <label>Setor Comercial</label>
                <select className="select-input" value={formEquip.setor} onChange={(e) => setFormEquip({ ...formEquip, setor: e.target.value })} required>
                  <option value="">Selecione o Setor...</option>{listaSetores?.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                </select>
            </div>
            <div>
                <label>Tipo de Refrigeração</label>
                <select className="select-input" value={formEquip.tipo} onChange={(e) => setFormEquip({ ...formEquip, tipo: e.target.value })} required>
                  <option value="">Selecione o Tipo...</option>{listaTipos?.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
            </div>
            <div><label>Data Calibração Oficial</label><input type="date" value={formEquip.data_calibracao} onChange={(e) => setFormEquip({ ...formEquip, data_calibracao: e.target.value })} required /></div>
            <div><label>Degelo Automático (Horas)</label><input type="number" min="1" value={formEquip.intervalo_degelo} onChange={(e) => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required /></div>
            <div><label>Temperatura Mín (°C)</label><input type="number" step="0.1" value={formEquip.temp_min} onChange={(e) => setFormEquip({ ...formEquip, temp_min: e.target.value })} required /></div>
            <div><label>Temperatura Máx (°C)</label><input type="number" step="0.1" value={formEquip.temp_max} onChange={(e) => setFormEquip({ ...formEquip, temp_max: e.target.value })} required /></div>
            <div><label>Humidade Mín (%)</label><input type="number" step="0.1" value={formEquip.umidade_min} onChange={(e) => setFormEquip({ ...formEquip, umidade_min: e.target.value })} /></div>
            <div><label>Humidade Máx (%)</label><input type="number" step="0.1" value={formEquip.umidade_max} onChange={(e) => setFormEquip({ ...formEquip, umidade_max: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="btn btn-primary" disabled={isOffline}><PlusCircle size={18} /> Adicionar Máquina</button></div>
        </form>
      </div>
      <div className="card table-responsive stagger-2">
        <table className="table">
          <thead><tr><th>Loja</th><th>Identificador</th><th>Metrologia</th><th>SLA Físico (Min/Max)</th><th>Gerir</th></tr></thead>
          <tbody>
            {equipamentosFiltradosLista?.map(eq => {
               const diasCalib = eq.data_calibracao ? Math.floor((Date.now() - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 0;
               const calibCritica = diasCalib > 365;
               return (
                <tr key={eq.id}>
                  <td data-label="Loja"><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', marginRight: '5px', backgroundColor: eq.em_degelo ? '#38bdf8' : (eq.motor_ligado ? 'var(--success)' : 'var(--danger)')}}></span> <strong>{eq.filial}</strong></td>
                  <td data-label="Identificador"><strong>{eq.nome}</strong><br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.tipo} | {eq.setor}</span></td>
                  <td data-label="Calibração"><div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: calibCritica ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>{calibCritica ? <AlertTriangle size={16}/> : <ClipboardCheck size={16}/>} Certificado há {diasCalib} dias</div></td>
                  <td data-label="Limites">{eq.temp_min}°C a {eq.temp_max}°C <br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.umidade_min || 40}% a {eq.umidade_max || 80}% (Hum)</span></td>
                  <td data-label="Gerir"><button className="btn btn-outline" style={{ padding: '0.5rem', marginRight: '5px' }} onClick={() => editarEquipamento(eq)} disabled={isOffline}><Edit size={16} /></button><button className="btn btn-outline" style={{ padding: '0.5rem', color: isOffline ? 'gray' : 'var(--danger)', borderColor: isOffline ? 'gray' : 'var(--danger)' }} onClick={() => pedirExclusao(eq.id, eq.nome)} disabled={isOffline}><X size={16} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}