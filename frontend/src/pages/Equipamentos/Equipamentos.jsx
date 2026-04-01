import React, { useState } from 'react';
import { PlusCircle, ShieldCheck, AlertTriangle, ClipboardCheck, Edit, X, Thermometer, Droplets } from 'lucide-react';
import './Equipamentos.css';

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
      showToast('Padrão Legal (ANVISA) aplicado!', 'success');
    } else showToast('Tipo de Refrigeração não encontrado no sistema.', 'error');
  };

  const salvarNovoEquipamento = async (e) => {
    e.preventDefault(); if (isOffline) return showToast('Ação bloqueada.', 'warning');
    const dadosFinais = { ...formEquip, filial: userRole === 'LOJA' ? userFilial : formEquip.filial };
    try { await api.post('/equipamentos', dadosFinais); showToast('Equipamento registado com sucesso.', 'success'); setFormEquip({ ...formInicial, filial: userRole === 'LOJA' ? userFilial : '' }); carregarDadosBase(); } 
    catch (e) { showToast('Erro ao salvar.', 'error'); }
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="card equipamentos-card">
        <div className="equipamentos-card-header">
          <h3 className="equipamentos-card-title">
            <PlusCircle size={22} color="var(--primary)" /> Novo Equipamento
          </h3>
          <button 
            type="button" 
            className="btn btn-anvisa" 
            onClick={() => aplicarNormaANVISA(formEquip.tipo)} 
            disabled={!formEquip.tipo || isOffline}
          >
            <ShieldCheck size={18} /> Preencher Norma ANVISA
          </button>
        </div>
        <form onSubmit={salvarNovoEquipamento}>
          <div className="form-grid">
            <div>
                <label>Identificador da Máquina</label>
                <input type="text" value={formEquip.nome} onChange={(e) => setFormEquip({ ...formEquip, nome: e.target.value })} placeholder="Ex: Balcão 01" required />
            </div>
            <div>
                <label>Filial / Loja Física</label>
                <select className="select-input" value={formEquip.filial} onChange={(e) => setFormEquip({ ...formEquip, filial: e.target.value })} required disabled={userRole === 'LOJA'} style={{ backgroundColor: userRole === 'LOJA' ? 'var(--bg-color)' : undefined }}>
                  <option value="">Selecione a Filial...</option>{filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}
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
          <div className="equipamentos-form-actions">
            <button type="submit" className="btn btn-primary" disabled={isOffline} style={{ boxShadow: '0 4px 15px rgba(5, 150, 105, 0.3)' }}>
              <PlusCircle size={18} /> Salvar no Sistema
            </button>
          </div>
        </form>
      </div>
      
      <div className="card table-responsive stagger-2">
        <table className="table">
          <thead><tr><th>Localização</th><th>Identificador e Setor</th><th>Status de Metrologia</th><th>SLA Operacional (Limites)</th><th>Ações</th></tr></thead>
          <tbody>
            {equipamentosFiltradosLista?.map(eq => {
               const diasCalib = eq.data_calibracao ? Math.floor((Date.now() - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 0;
               const calibCritica = diasCalib > 365;
               
               // Definir Cor Dinâmica do Ring
               let ringColor = 'var(--success)';
               let isPulse = false;
               if (eq.em_degelo) ringColor = 'var(--secondary)';
               else if (!eq.motor_ligado) { ringColor = 'var(--danger)'; isPulse = true; }

               return (
                <tr key={eq.id}>
                  <td data-label="Loja">
                    <span 
                      className={`status-ring ${isPulse ? 'pulse' : ''}`} 
                      style={{ color: ringColor }}
                    ></span> 
                    <strong>{eq.filial}</strong>
                  </td>
                  
                  <td data-label="Identificador">
                    <div className="equipamento-nome-box">
                      <span style={{ fontWeight: '800', fontSize: '1.05rem' }}>{eq.nome}</span>
                      <span className="equipamento-subtitle">{eq.tipo} • {eq.setor}</span>
                    </div>
                  </td>
                  
                  <td data-label="Calibração">
                    <div className={`calib-badge ${calibCritica ? 'critical' : 'ok'}`}>
                      {calibCritica ? <AlertTriangle size={14}/> : <ClipboardCheck size={14}/>} 
                      Aferido há {diasCalib} dias
                    </div>
                  </td>
                  
                  <td data-label="Limites">
                    <div className="limites-box">
                      <span className="limit-tag">
                        <Thermometer size={14} style={{ color: 'var(--danger)' }}/> 
                        {eq.temp_min}°C a {eq.temp_max}°C
                      </span>
                      <span className="limit-tag">
                        <Droplets size={14} style={{ color: 'var(--info)' }}/> 
                        {eq.umidade_min || 40}% a {eq.umidade_max || 80}%
                      </span>
                    </div>
                  </td>
                  
                  <td data-label="Ações">
                    <button className="btn btn-action edit" onClick={() => editarEquipamento(eq)} disabled={isOffline} title="Editar Equipamento">
                      <Edit size={18} />
                    </button>
                    <button 
                      className="btn btn-action delete" 
                      style={isOffline ? { color: 'var(--text-muted)', background: 'transparent' } : {}}
                      onClick={() => pedirExclusao(eq.id, eq.nome)} 
                      disabled={isOffline}
                      title="Remover Equipamento"
                    >
                      <X size={18} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}