import React, { useState } from 'react';
import { 
  PlusCircle, MapPin, Edit, X, Thermometer, Droplets, 
  Snowflake, ShieldCheck, Sliders, Save, History, ListFilter 
} from 'lucide-react';
import './ParametrosGlobais.css';

export default function ParametrosGlobais({ 
  api, showToast, listaSetores, listaTipos, 
  carregarParametrosGerais, carregarDadosBase, setModalConfig 
}) {
  const [modalParametro, setModalParametro] = useState({ 
    isOpen: false, entidade: 'SETOR', id: '', nome: '', 
    temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', 
    intervalo_degelo: '', duracao_degelo: '' 
  });

  const aplicarPresetAnvisa = (e) => {
    const presetName = e.target.value;
    if (!presetName) return;

    const presets = {
      // --- CÂMARAS FRIAS ---
      'Câmara Fria - Congelados (-18°C)': { temp_min: -25, temp_max: -18, umidade_min: 40, umidade_max: 60, intervalo_degelo: 6, duracao_degelo: 40 },
      'Câmara Fria - Resfriados': { temp_min: 0, temp_max: 4, umidade_min: 70, umidade_max: 85, intervalo_degelo: 6, duracao_degelo: 30 },
      
      // --- BALCÕES E EXPOSITORES ---
      'Balcão Resfriado Aberto': { temp_min: 0, temp_max: 8, umidade_min: 50, umidade_max: 80, intervalo_degelo: 4, duracao_degelo: 20 },
      'Balcão Resfriado Fechado': { temp_min: 0, temp_max: 8, umidade_min: 60, umidade_max: 80, intervalo_degelo: 6, duracao_degelo: 20 },
      'Ilha de Produtos Resfriados': { temp_min: 0, temp_max: 8, umidade_min: 60, umidade_max: 85, intervalo_degelo: 6, duracao_degelo: 20 },
      
      // --- SETORES DE FRESCOS ---
      'Laticínios e Frios': { temp_min: 0, temp_max: 8, umidade_min: 60, umidade_max: 80, intervalo_degelo: 6, duracao_degelo: 20 },
      'Carnes Embaladas (Auto-serviço)': { temp_min: 0, temp_max: 4, umidade_min: 80, umidade_max: 90, intervalo_degelo: 6, duracao_degelo: 20 },
      'Peixaria e Pescados': { temp_min: 0, temp_max: 2, umidade_min: 90, umidade_max: 95, intervalo_degelo: 4, duracao_degelo: 30 },
      'Frutas e Verduras (Hortifrúti)': { temp_min: 8, temp_max: 15, umidade_min: 85, umidade_max: 95, intervalo_degelo: 12, duracao_degelo: 20 },
      
      // --- ROTISSERIA E CONVENIÊNCIA ---
      'Comidas Prontas (Resfriadas)': { temp_min: 0, temp_max: 4, umidade_min: 60, umidade_max: 80, intervalo_degelo: 6, duracao_degelo: 20 },
      'Saladas e Folhas Prontas': { temp_min: 0, temp_max: 4, umidade_min: 85, umidade_max: 95, intervalo_degelo: 6, duracao_degelo: 20 },
      'Bebidas Geladas e Cervejeiras': { temp_min: -4, temp_max: 4, umidade_min: 50, umidade_max: 80, intervalo_degelo: 8, duracao_degelo: 20 }
    };

    if (presets[presetName]) {
      setModalParametro(prev => ({
        ...prev,
        nome: prev.nome || presetName,
        ...presets[presetName]
      }));
      showToast(`Padrão para ${presetName} aplicado!`, 'success');
    }
  };

  const salvarParametro = async (e) => {
    e.preventDefault();
    const isSetor = modalParametro.entidade === 'SETOR';
    const endpoint = isSetor ? '/setores' : '/tipos-refrigeracao';
    
    const payload = isSetor 
      ? { nome: String(modalParametro.nome).trim() } 
      : { 
          nome: String(modalParametro.nome).trim(), 
          temp_min: Number(modalParametro.temp_min), 
          temp_max: Number(modalParametro.temp_max), 
          umidade_min: Number(modalParametro.umidade_min), 
          umidade_max: Number(modalParametro.umidade_max), 
          intervalo_degelo: Number(modalParametro.intervalo_degelo), 
          duracao_degelo: Number(modalParametro.duracao_degelo) 
        };
    
    try {
      if (modalParametro.id) {
        await api.put(`${endpoint}/${modalParametro.id}`, payload);
        showToast('Atualizado com sucesso!', 'success');
      } else {
        if (!payload.nome) return showToast('O nome é obrigatório.', 'error');
        await api.post(endpoint, payload);
        showToast('Criado com sucesso!', 'success');
      }
      setModalParametro({ isOpen: false, entidade: 'SETOR', id: '', nome: '', temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', intervalo_degelo: '', duracao_degelo: '' });
      carregarParametrosGerais();
      carregarDadosBase();
    } catch (err) {
      showToast('Falha ao guardar os dados.', 'error');
    }
  };

  const pedirExclusaoParametro = (id, nome, entidade) => {
    const endpoint = entidade === 'SETOR' ? `/setores/${id}` : `/tipos-refrigeracao/${id}`;
    setModalConfig({
      isOpen: true,
      title: `Remover ${entidade}`,
      message: `Tem a certeza que deseja eliminar "${nome}"? Esta regra deixará de estar disponível para novos equipamentos.`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(endpoint);
          showToast('Removido com sucesso.', 'success');
          carregarParametrosGerais();
        } catch (e) {
          showToast('Erro ao eliminar. O item pode estar em uso.', 'error');
        }
      }
    });
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 className="parametros-title">Configurações de Normas Anvisa</h3>
        <div className="parametros-actions">
          <button className="btn btn-outline" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={() => setModalParametro({ isOpen: true, entidade: 'SETOR', id: '', nome: '' })}><PlusCircle size={18}/> Novo Setor</button>
          <button className="btn btn-primary" onClick={() => setModalParametro({ isOpen: true, entidade: 'TIPO', id: '', nome: '', temp_min: 0, temp_max: 8, umidade_min: 60, umidade_max: 85, intervalo_degelo: 6, duracao_degelo: 30 })}><PlusCircle size={18}/> Nova Regra Técnica</button>
        </div>
      </div>
      
      <div className="parametros-grid">
        {/* COLUNA SETORES */}
        <div className="card">
          <h4 className="parametros-card-title"><MapPin size={20} color="var(--primary)" /> Divisões por Setor</h4>
          <div className="parametros-list-container">
            {!listaSetores?.length ? (
              <div className="empty-state"><History size={48} color="var(--border)"/><p>Nenhum setor definido.</p></div>
            ) : (
              <div className="parametros-list">
                {listaSetores.map(s => (
                  <div key={s.id} className="parametro-item setor">
                    <strong className="parametro-name">{s.nome}</strong>
                    <div className="parametro-item-actions">
                      <button className="btn btn-action edit" onClick={() => setModalParametro({ isOpen: true, entidade: 'SETOR', id: s.id, nome: s.nome })}><Edit size={18} /></button>
                      <button className="btn btn-action delete" onClick={() => pedirExclusaoParametro(s.id, s.nome, 'SETOR')}><X size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA REGRAS TÉCNICAS */}
        <div className="card">
          <h4 className="parametros-card-title"><ListFilter size={20} color="var(--secondary)" /> Padrões Térmicos e SLAs</h4>
          <div className="parametros-list-container">
            {!listaTipos?.length ? (
              <div className="empty-state"><Sliders size={48} color="var(--border)"/><p>Nenhuma regra definida.</p></div>
            ) : (
              <div className="parametros-list">
                {listaTipos.map(t => (
                  <div key={t.id} className="parametro-item">
                    <div className="parametro-item-header">
                      <strong className="parametro-name">{t.nome}</strong>
                      <div className="parametro-item-actions">
                        <button className="btn btn-action edit" onClick={() => setModalParametro({ isOpen: true, entidade: 'TIPO', id: t.id, nome: t.nome, temp_min: t.temp_min, temp_max: t.temp_max, umidade_min: t.umidade_min, umidade_max: t.umidade_max, intervalo_degelo: t.intervalo_degelo, duracao_degelo: t.duracao_degelo })}><Edit size={18} /></button>
                        <button className="btn btn-action delete" onClick={() => pedirExclusaoParametro(t.id, t.nome, 'TIPO')}><X size={18} /></button>
                      </div>
                    </div>
                    <div className="parametro-badges">
                       <span className="parametro-badge temp"><Thermometer size={14}/> {t.temp_min}°C a {t.temp_max}°C</span>
                       <span className="parametro-badge hum"><Droplets size={14}/> {t.umidade_min}% a {t.umidade_max}%</span>
                       <span className="parametro-badge defrost"><Snowflake size={14}/> Ciclo: {t.intervalo_degelo}h</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL UNIFICADO */}
      {modalParametro.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: modalParametro.entidade === 'TIPO' ? '600px' : '450px' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={24} color="var(--primary)"/> 
              {modalParametro.id ? 'Editar Configuração' : 'Nova Definição'}
            </h3>
            
            <form onSubmit={salvarParametro} style={{ marginTop: '1.5rem' }}>
              {modalParametro.entidade === 'TIPO' && (
                <div className="preset-box">
                  <label className="preset-label"><ShieldCheck size={18} /> Padrões Técnicos para Supermercados</label>
                  <select className="preset-select" onChange={aplicarPresetAnvisa}>
                    <option value="">Selecione o tipo de equipamento/alimento...</option>
                    
                    <optgroup label="Câmaras Frias">
                      <option value="Câmara Fria - Congelados (-18°C)">Congelados (-18°C)</option>
                      <option value="Câmara Fria - Resfriados">Resfriados (0° a 4°C)</option>
                    </optgroup>

                    <optgroup label="Balcões e Expositores">
                      <option value="Balcão Resfriado Aberto">Balcão Resfriado Aberto (Maior Degelo)</option>
                      <option value="Balcão Resfriado Fechado">Balcão Resfriado Fechado</option>
                      <option value="Ilha de Produtos Resfriados">Ilha de Produtos Resfriados</option>
                    </optgroup>
                    
                    <optgroup label="Setores de Frescos">
                      <option value="Laticínios e Frios">Laticínios e Frios</option>
                      <option value="Carnes Embaladas (Auto-serviço)">Carnes Embaladas (Auto-serviço)</option>
                      <option value="Peixaria e Pescados">Peixaria e Pescados (Alta Humidade)</option>
                      <option value="Frutas e Verduras (Hortifrúti)">Frutas e Verduras (Hortifrúti)</option>
                    </optgroup>
                    
                    <optgroup label="Rotisseria e Conveniência">
                      <option value="Comidas Prontas (Resfriadas)">Comidas Prontas (Resfriadas)</option>
                      <option value="Saladas e Folhas Prontas">Saladas e Folhas Prontas</option>
                      <option value="Bebidas Geladas e Cervejeiras">Bebidas Geladas e Cervejeiras</option>
                    </optgroup>
                    
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label>Nome do Parâmetro (Regra)</label>
                <input type="text" value={modalParametro.nome} onChange={e => setModalParametro({...modalParametro, nome: e.target.value})} placeholder="Ex: Ilha de Congelados" required autoFocus />
              </div>

              {modalParametro.entidade === 'TIPO' && (
                <>
                  <h4 className="section-subtitle">Limites de Tolerância (SLA)</h4>
                  <div className="form-grid">
                    <div><label>Temp. Mín (°C)</label><input type="number" step="0.1" value={modalParametro.temp_min} onChange={e => setModalParametro({...modalParametro, temp_min: e.target.value})} required /></div>
                    <div><label>Temp. Máx (°C)</label><input type="number" step="0.1" value={modalParametro.temp_max} onChange={e => setModalParametro({...modalParametro, temp_max: e.target.value})} required /></div>
                    <div><label>Hum. Mín (%)</label><input type="number" step="0.1" value={modalParametro.umidade_min} onChange={e => setModalParametro({...modalParametro, umidade_min: e.target.value})} required /></div>
                    <div><label>Hum. Máx (%)</label><input type="number" step="0.1" value={modalParametro.umidade_max} onChange={e => setModalParametro({...modalParametro, umidade_max: e.target.value})} required /></div>
                    <div><label>Intervalo Degelo (H)</label><input type="number" value={modalParametro.intervalo_degelo} onChange={e => setModalParametro({...modalParametro, intervalo_degelo: e.target.value})} required /></div>
                    <div><label>Duração Degelo (Min)</label><input type="number" value={modalParametro.duracao_degelo} onChange={e => setModalParametro({...modalParametro, duracao_degelo: e.target.value})} required /></div>
                  </div>
                </>
              )}
              
              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalParametro({ ...modalParametro, isOpen: false })}>Descartar</button>
                <button type="submit" className="btn btn-primary"><Save size={18}/> Guardar Política</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}