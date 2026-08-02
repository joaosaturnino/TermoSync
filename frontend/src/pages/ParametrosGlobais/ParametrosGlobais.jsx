import React, { useState, useMemo } from 'react';
import { 
  PlusCircle, Edit, X, Thermometer, Droplets, 
  Snowflake, ShieldCheck, Sliders, Save, Search, 
  LayoutGrid, PackageOpen, Zap, AlertTriangle, Trash2,
  Lock, Shield
} from 'lucide-react';
import './ParametrosGlobais.css';

/**
 * Parâmetros Globais e Políticas de SLA
 *
 * Responsabilidades:
 * - Gerenciar catálogos de `setores` e `tipos` de refrigeração
 * - Permitir criação/edição/exclusão de políticas que afetam limites operacionais
 * - Respeitar permissões de edição por `userRole`
 */
export default function ParametrosGlobais({ 
  api, showToast, listaSetores, listaTipos, 
  carregarParametrosGerais, carregarDadosBase, setModalConfig,
  userRole // Recebido do App.jsx para injetar a segurança
}) {
  
  const [buscaSetor, setBuscaSetor] = useState('');
  const [buscaTipo, setBuscaTipo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [modalParametro, setModalParametro] = useState({ 
    isOpen: false, entidade: 'SETOR', id: '', nome: '', 
    temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', 
    intervalo_degelo: '', duracao_degelo: '' 
  });

  // ============================================================================
  // MOTOR DE SEGURANÇA E ISOLAMENTO DE ACESSO (ATUALIZADO)
  // ============================================================================
  const roleLogada = userRole || sessionStorage.getItem('userRole') || 'LOJA';
  
  // Lê o cargo exato do usuário no Session Storage
  const papelLogado = sessionStorage.getItem('papelLogado') || ''; 
  const isGestorLoja = papelLogado.toLowerCase().includes('gerente') || papelLogado.toLowerCase().includes('coordenador');

  // Permissão de Edição: ADMIN, DEV, MANUTENCAO, e GESTORES DA LOJA (Gerente/Coordenador)
  const canEdit = roleLogada === 'ADMIN' || roleLogada === 'DEV' || roleLogada === 'MANUTENCAO' || (roleLogada === 'LOJA' && isGestorLoja);

  const setoresFiltrados = useMemo(() => {
    if (!listaSetores) return [];
    return listaSetores.filter(s => s.nome.toLowerCase().includes(buscaSetor.toLowerCase()));
  }, [listaSetores, buscaSetor]);

  const tiposFiltrados = useMemo(() => {
    if (!listaTipos) return [];
    return listaTipos.filter(t => t.nome.toLowerCase().includes(buscaTipo.toLowerCase()));
  }, [listaTipos, buscaTipo]);

  const kpis = useMemo(() => {
    return {
      setores: listaSetores?.length || 0,
      tipos: listaTipos?.length || 0,
    };
  }, [listaSetores, listaTipos]);

  // ============================================================================
  // FUNÇÕES DE AÇÃO (PROTEGIDAS)
  // ============================================================================
  const abrirModalNovo = (entidade) => {
    if (!canEdit) {
      return showToast('Apenas Gestores, Manutenção e NOC possuem privilégios para forjar regras.', 'error');
    }
    setModalParametro({ 
      isOpen: true, entidade, id: '', nome: '', 
      temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', 
      intervalo_degelo: '', duracao_degelo: '' 
    });
  };

  const salvarParametro = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      setModalParametro({ ...modalParametro, isOpen: false });
      return showToast('Acesso negado. Modo de leitura ativo para o seu perfil.', 'error');
    }

    setIsProcessing(true);
    try {
      const isSetor = modalParametro.entidade === 'SETOR';
      const endpoint = isSetor ? '/setores' : '/tipos-refrigeracao';
      
      const payload = { nome: modalParametro.nome };
      
      if (!isSetor) {
        payload.temp_min = modalParametro.temp_min;
        payload.temp_max = modalParametro.temp_max;
        payload.umidade_min = modalParametro.umidade_min || 0;
        payload.umidade_max = modalParametro.umidade_max || 0;
        payload.intervalo_degelo = modalParametro.intervalo_degelo;
        payload.duracao_degelo = modalParametro.duracao_degelo;
      }

      if (modalParametro.id) {
        await api.put(`${endpoint}/${modalParametro.id}`, payload);
        showToast('Política atualizada com sucesso.', 'success');
      } else {
        await api.post(endpoint, payload);
        showToast('Nova regra consolidada no núcleo.', 'success');
      }

      setModalParametro({ ...modalParametro, isOpen: false });
      carregarParametrosGerais();
      carregarDadosBase();
    } catch (err) {
      showToast('Falha na operação. Verifique se a nomenclatura já existe.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const pedirExclusaoParametro = (id, nome, entidade) => {
    if (!canEdit) return showToast('Ação bloqueada. As políticas são protegidas contra exclusão.', 'error');

    const isSetor = entidade === 'SETOR';
    const endpoint = isSetor ? '/setores' : '/tipos-refrigeracao';
    
    setModalConfig({
      isOpen: true,
      title: `Eliminar ${isSetor ? 'Zona Operacional' : 'Matriz de SLA'}`,
      message: `Tem certeza que deseja remover a política "${nome}"? Máquinas associadas a esta regra poderão necessitar de reconfiguração técnica.`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          await api.delete(`${endpoint}/${id}`);
          showToast('Regra eliminada do sistema.', 'success');
          carregarParametrosGerais();
          carregarDadosBase();
        } catch (e) {
          showToast('Ação bloqueada. Existem máquinas dependentes desta política.', 'error');
        }
      }
    });
  };

  return (
    <div className="anim-fade-in stagger-1">
      
      <div className="flex-header parametros-header-area">
        <div className="parametros-title-box">
          <div className="icon-circle" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--info)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <Sliders size={26} />
          </div>
          <div>
            <h3 className="parametros-main-title">Políticas Base e Compliance</h3>
            <span className="parametros-subtitle">Catálogo unificado de zonas e matrizes de tolerância (RDC).</span>
          </div>
        </div>

        <div className="parametros-actions">
          {canEdit ? (
            <>
              <button className="btn btn-outline zone-btn" onClick={() => abrirModalNovo('SETOR')}>
                <LayoutGrid size={16} /> Definir Novo Setor
              </button>
              <button className="btn btn-primary sla-btn" onClick={() => abrirModalNovo('TIPO')} style={{ boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
                <ShieldCheck size={16} /> Criar Matriz SLA
              </button>
            </>
          ) : (
            <div className="read-only-banner" title="Não possui privilégios de Gestão (Gerente/Coordenador) para alterar políticas globais.">
              <Lock size={16} /> Auditoria Estrita (Somente Leitura)
            </div>
          )}
        </div>
      </div>

      <div className="policy-kpi-bar stagger-2">
        <div className="kpi-item">
          <div className="kpi-icon zone"><LayoutGrid size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.setores}</span>
            <span className="kpi-label">Topologias (Setores)</span>
          </div>
        </div>
        <div className="kpi-item">
          <div className="kpi-icon sla"><ShieldCheck size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.tipos}</span>
            <span className="kpi-label">Matrizes Normativas</span>
          </div>
        </div>
        <div className="kpi-item success">
          <div className="kpi-icon"><Zap size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">Ativo</span>
            <span className="kpi-label">Motor de Regras</span>
          </div>
        </div>
      </div>

      <div className="parametros-grid stagger-3">
        
        {/* COLUNA: SETORES */}
        <div className="card policy-card">
          <div className="policy-card-header">
            <h4 className="policy-card-title"><LayoutGrid size={18} color="var(--info)" /> Topologia de Setores</h4>
            <div className="search-box-policy">
              <Search size={14} color="var(--text-muted)" />
              <input type="text" placeholder="Filtrar zona..." value={buscaSetor} onChange={e => setBuscaSetor(e.target.value)} />
            </div>
          </div>
          
          <div className="policy-list">
            {setoresFiltrados.length === 0 ? (
               <div className="empty-policy">
                 <PackageOpen size={32} opacity={0.3} style={{ marginBottom: '10px' }} />
                 <p>Nenhuma zona definida no catálogo.</p>
               </div>
            ) : (
              setoresFiltrados.map(s => (
                <div key={s.id} className="policy-list-item">
                  <div className="policy-info">
                    <strong>{s.nome}</strong>
                    <span>ID: ZN-{s.id.toString().padStart(4, '0')}</span>
                  </div>
                  <div className="policy-actions">
                    {canEdit ? (
                      <>
                        <button className="btn-action-small edit" onClick={() => setModalParametro({ isOpen: true, entidade: 'SETOR', id: s.id, nome: s.nome })} title="Editar Nome"><Edit size={16} /></button>
                        <button className="btn-action-small delete" onClick={() => pedirExclusaoParametro(s.id, s.nome, 'SETOR')} title="Excluir Permanentemente"><Trash2 size={16} /></button>
                      </>
                    ) : (
                      <div className="lock-icon-read" title="Apenas Gerentes/Coordenadores podem editar"><Shield size={16} /></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUNA: MATRIZES SLA */}
        <div className="card policy-card border-green">
          <div className="policy-card-header">
            <h4 className="policy-card-title"><ShieldCheck size={18} color="var(--success)" /> Matrizes de Compliance (SLA)</h4>
            <div className="search-box-policy">
              <Search size={14} color="var(--text-muted)" />
              <input type="text" placeholder="Filtrar SLA..." value={buscaTipo} onChange={e => setBuscaTipo(e.target.value)} />
            </div>
          </div>
          
          <div className="policy-list">
            {tiposFiltrados.length === 0 ? (
               <div className="empty-policy">
                 <AlertTriangle size={32} opacity={0.3} style={{ marginBottom: '10px' }} />
                 <p>Nenhuma matriz de SLA configurada no núcleo.</p>
               </div>
            ) : (
              tiposFiltrados.map(t => (
                <div key={t.id} className="policy-list-item sla-item">
                  <div className="policy-info-full">
                    <div className="sla-title-row">
                      <strong>{t.nome}</strong>
                      <div className="policy-actions">
                        {canEdit ? (
                          <>
                            <button className="btn-action-small edit" onClick={() => setModalParametro({ isOpen: true, entidade: 'TIPO', ...t })} title="Ajustar Tolerâncias"><Edit size={16} /></button>
                            <button className="btn-action-small delete" onClick={() => pedirExclusaoParametro(t.id, t.nome, 'TIPO')} title="Excluir Matriz"><Trash2 size={16} /></button>
                          </>
                        ) : (
                           <div className="lock-icon-read" title="Apenas Gerentes/Coordenadores podem editar"><Shield size={16} /></div>
                        )}
                      </div>
                    </div>
                    
                    <div className="sla-limits-grid">
                      {/* O verificação !== undefined && !== null previne o bug visual na lista */}
                      <span className="sla-tag termico" title="Tolerância Térmica"><Thermometer size={12}/> {t.temp_min != null ? t.temp_min : '--'}°C a {t.temp_max != null ? t.temp_max : '--'}°C</span>
                      <span className="sla-tag higro" title="Controle Higrométrico"><Droplets size={12}/> {t.umidade_min || 0}% a {t.umidade_max || 0}%</span>
                      <span className="sla-tag degelo" title="Padrão de Degelo (Horas / Minutos)"><Snowflake size={12}/> A cada {t.intervalo_degelo || '--'}h ({t.duracao_degelo || '--'}m)</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {modalParametro.isOpen && canEdit && (
        <div className="modal-overlay anim-fade-in">
          <div className="policy-modal-content">
            
            <div className={`policy-modal-header ${modalParametro.entidade === 'SETOR' ? 'info' : 'success'}`}>
              <div className="policy-modal-icon">
                {modalParametro.entidade === 'SETOR' ? <LayoutGrid size={24} /> : <ShieldCheck size={24} />}
              </div>
              <div className="policy-modal-header-text">
                <h3>{modalParametro.id ? 'Reconfigurar' : 'Forjar Nova'} Regra</h3>
                <span>{modalParametro.entidade === 'SETOR' ? 'Topologia de Zona Operacional' : 'Matriz de Compliance (SLA)'}</span>
              </div>
            </div>

            <form onSubmit={salvarParametro} className="policy-modal-form">
              <div className="form-section-policy">
                <label>Nomenclatura Oficial da Regra *</label>
                <input 
                  type="text" 
                  value={modalParametro.nome || ''} 
                  onChange={e => setModalParametro({...modalParametro, nome: e.target.value})} 
                  placeholder={modalParametro.entidade === 'SETOR' ? "Ex: Corredor de Laticínios" : "Ex: Congelados Premium"} 
                  required autoFocus 
                />
              </div>

              {modalParametro.entidade === 'TIPO' && (
                <>
                  <div className="form-section-policy">
                    <h4 className="section-divider"><Thermometer size={14} color="var(--danger)"/> Limites Térmicos (°C)</h4>
                    <div className="form-grid-modal">
                      <div>
                        <label>Alarme Mínimo *</label>
                        <input type="number" step="0.1" value={modalParametro.temp_min ?? ''} onChange={e => setModalParametro({...modalParametro, temp_min: e.target.value})} required placeholder="-18.0" />
                      </div>
                      <div>
                        <label>Alarme Máximo *</label>
                        <input type="number" step="0.1" value={modalParametro.temp_max ?? ''} onChange={e => setModalParametro({...modalParametro, temp_max: e.target.value})} required placeholder="-12.0" />
                      </div>
                    </div>
                  </div>

                  <div className="form-section-policy">
                    <h4 className="section-divider"><Droplets size={14} color="var(--info)"/> Controle Higrométrico (%)</h4>
                    <div className="form-grid-modal">
                      <div>
                        <label>Umidade Mínima</label>
                        <input type="number" step="0.1" value={modalParametro.umidade_min ?? ''} onChange={e => setModalParametro({...modalParametro, umidade_min: e.target.value})} placeholder="0" />
                      </div>
                      <div>
                        <label>Umidade Máxima</label>
                        <input type="number" step="0.1" value={modalParametro.umidade_max ?? ''} onChange={e => setModalParametro({...modalParametro, umidade_max: e.target.value})} placeholder="100" />
                      </div>
                    </div>
                  </div>

                  <div className="form-section-policy" style={{ marginBottom: 0 }}>
                    <h4 className="section-divider"><Snowflake size={14} color="var(--secondary)"/> Padrão de Degelo</h4>
                    <div className="form-grid-modal">
                      <div>
                        <label>Frequência (Horas) *</label>
                        <input type="number" min="1" value={modalParametro.intervalo_degelo ?? ''} onChange={e => setModalParametro({...modalParametro, intervalo_degelo: e.target.value})} required placeholder="Ex: 6" />
                      </div>
                      <div>
                        <label>Duração (Minutos) *</label>
                        <input type="number" min="1" value={modalParametro.duracao_degelo ?? ''} onChange={e => setModalParametro({...modalParametro, duracao_degelo: e.target.value})} required placeholder="Ex: 30" />
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              <div className="policy-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setModalParametro({ ...modalParametro, isOpen: false })} disabled={isProcessing}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing} style={modalParametro.entidade === 'SETOR' ? { background: 'var(--info)', borderColor: 'var(--info)' } : {}}>
                  <Save size={18}/> {isProcessing ? 'Aguarde...' : 'Consolidar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}