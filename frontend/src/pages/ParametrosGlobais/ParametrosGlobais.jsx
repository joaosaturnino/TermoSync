/**
 * Módulo: frontend/src/pages/ParametrosGlobais/ParametrosGlobais.jsx
 * Responsabilidade: Implementa a tela Parametros Globais, seus estados, interações e integrações de dados.
 */

import { Database, Gauge } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import {
  Edit, Thermometer, Droplets,
  Snowflake, ShieldCheck, Sliders, Save, Search,
  LayoutGrid, PackageOpen, Zap, AlertTriangle, Trash2,
  Lock, Shield
} from 'lucide-react';
import './ParametrosGlobais.css';

/**
 * Renderiza a tela Parametros Globais e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.listaSetores - Propriedade listaSetores usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.listaTipos - Propriedade listaTipos usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.carregarParametrosGerais - Propriedade carregarParametrosGerais usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.carregarDadosBase - Propriedade carregarDadosBase usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
  // MOTOR DE SEGURANÇA E ISOLAMENTO DE ACESSO
  // ============================================================================
  const roleLogada = userRole || sessionStorage.getItem('userRole') || 'LOJA';

  // Parâmetros globais alteram regras de todas as unidades e seguem a API administrativa.
  const canEdit = roleLogada === 'ADMIN' || roleLogada === 'DEV';

  const setoresFiltrados = useMemo(() => {
    if (!listaSetores) return [];
    return listaSetores.filter(s => s.nome.toLowerCase().includes(buscaSetor.toLowerCase()));
  }, [listaSetores, buscaSetor]);

  const tiposFiltrados = useMemo(() => {
    if (!listaTipos) return [];
    return listaTipos.filter(t => t.nome.toLowerCase().includes(buscaTipo.toLowerCase()));
  }, [listaTipos, buscaTipo]);

  const kpis = useMemo(() => {
    const tiposValidos = (listaTipos || []).filter(t => (
      t.temp_min != null && t.temp_max != null &&
      Number(t.temp_min) < Number(t.temp_max) &&
      Number(t.intervalo_degelo) > 0 && Number(t.duracao_degelo) > 0
    )).length;
    return {
      setores: listaSetores?.length || 0,
      tipos: listaTipos?.length || 0,
      tiposValidos,
      pendencias: Math.max(0, (listaTipos?.length || 0) - tiposValidos)
    };
  }, [listaSetores, listaTipos]);

  /**
   * ============================================================================ FUNÇÕES DE AÇÃO
   * (PROTEGIDAS) ============================================================================
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} entidade - Valor de entidade consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const abrirModalNovo = (entidade) => {
    if (!canEdit) {
      return showToast('Apenas administradores e desenvolvedores podem alterar parâmetros globais.', 'error');
    }
    setModalParametro({ 
      isOpen: true, entidade, id: '', nome: '', 
      temp_min: '', temp_max: '', umidade_min: '', umidade_max: '', 
      intervalo_degelo: '', duracao_degelo: '' 
    });
  };


  /**
   * Concentra a logica de salvar parametro para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const salvarParametro = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      setModalParametro({ ...modalParametro, isOpen: false });
      return showToast('Acesso negado. Modo de leitura ativo para o seu perfil.', 'error');
    }

    const nome = String(modalParametro.nome || '').trim();
    if (!nome) return showToast('Informe um nome para a regra.', 'warning');

    const isSetor = modalParametro.entidade === 'SETOR';
    if (!isSetor) {
      const tempMin = Number(modalParametro.temp_min);
      const tempMax = Number(modalParametro.temp_max);
      const umidadeMin = Number(modalParametro.umidade_min || 0);
      const umidadeMax = Number(modalParametro.umidade_max || 0);
      const intervalo = Number(modalParametro.intervalo_degelo);
      const duracao = Number(modalParametro.duracao_degelo);
      if (![tempMin, tempMax, umidadeMin, umidadeMax, intervalo, duracao].every(Number.isFinite)) return showToast('Revise os valores numéricos da matriz.', 'warning');
      if (tempMin >= tempMax) return showToast('A temperatura mínima deve ser menor que a máxima.', 'warning');
      if (umidadeMin < 0 || umidadeMax > 100 || umidadeMin > umidadeMax) return showToast('A faixa de umidade deve estar entre 0% e 100%.', 'warning');
      if (intervalo <= 0 || duracao <= 0) return showToast('O ciclo de degelo deve possuir intervalo e duração positivos.', 'warning');
    }

    setIsProcessing(true);
    try {
      const payload = { nome };
      
      if (!isSetor) {
        payload.temp_min = modalParametro.temp_min;
        payload.temp_max = modalParametro.temp_max;
        payload.umidade_min = modalParametro.umidade_min || 0;
        payload.umidade_max = modalParametro.umidade_max || 0;
        payload.intervalo_degelo = modalParametro.intervalo_degelo;
        payload.duracao_degelo = modalParametro.duracao_degelo;
      }

      if (modalParametro.id) {
        if (isSetor) await api.put(`/setores/${modalParametro.id}`, payload);
        else await api.put(`/tipos-refrigeracao/${modalParametro.id}`, payload);
        showToast('Política atualizada com sucesso.', 'success');
      } else {
        if (isSetor) await api.post('/setores', payload);
        else await api.post('/tipos-refrigeracao', payload);
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


  /**
   * Processa a interacao de pedir exclusao parametro e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @param {unknown} nome - Valor de nome consumido por esta rotina.
   * @param {unknown} entidade - Valor de entidade consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const pedirExclusaoParametro = (id, nome, entidade) => {
    if (!canEdit) return showToast('Ação bloqueada. As políticas são protegidas contra exclusão.', 'error');

    const isSetor = entidade === 'SETOR';
    setModalConfig({
      isOpen: true,
      title: `Eliminar ${isSetor ? 'Zona Operacional' : 'Matriz de SLA'}`,
      message: `Tem certeza que deseja remover a política "${nome}"? Máquinas associadas a esta regra poderão necessitar de reconfiguração técnica.`,
      isPrompt: false,
      onConfirm: async () => {
        try {
          if (isSetor) await api.delete(`/setores/${id}`);
          else await api.delete(`/tipos-refrigeracao/${id}`);
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
          <div className="icon-circle" style={{ background: 'color-mix(in srgb, var(--info) 15%, transparent)', color: 'var(--info)', border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)' }}>
            <Sliders size={26} />
          </div>
          <div>
            <h3 className="parametros-main-title">Parâmetros Globais</h3>
            <span className="parametros-subtitle">Catálogos e limites que orientam alertas, equipamentos e rotinas de todas as unidades.</span>
          </div>
        </div>

        <div className="parametros-actions">
          {canEdit ? (
            <>
              <button className="btn btn-outline zone-btn" onClick={() => abrirModalNovo('SETOR')}>
                <LayoutGrid size={16} /> Definir Novo Setor
              </button>
              <button className="btn btn-primary sla-btn" onClick={() => abrirModalNovo('TIPO')} style={{ boxShadow: '0 4px 15px color-mix(in srgb, var(--success) 30%, transparent)' }}>
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
        <div className={`kpi-item ${kpis.pendencias ? 'warning' : 'success'}`}>
          <div className="kpi-icon"><Gauge size={20}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.tiposValidos}/{kpis.tipos}</span><span className="kpi-label">Matrizes Completas</span></div>
        </div>
        <div className="kpi-item">
          <div className="kpi-icon zone"><Database size={20}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.pendencias}</span><span className="kpi-label">Regras com Pendência</span></div>
        </div>
      </div>

      <div className="parametros-grid stagger-3">
        
        {/* COLUNA: SETORES */}
        <div className="card policy-card">
          <div className="policy-card-header">
            <h4 className="policy-card-title"><LayoutGrid size={18} color="var(--info)" /> Topologia de Setores <small>{setoresFiltrados.length}</small></h4>
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
            <h4 className="policy-card-title"><ShieldCheck size={18} color="var(--success)" /> Matrizes de Compliance (SLA) <small>{tiposFiltrados.length}</small></h4>
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
                <div key={t.id} className={`policy-list-item sla-item ${!(t.temp_min != null && t.temp_max != null && Number(t.temp_min) < Number(t.temp_max) && Number(t.intervalo_degelo) > 0 && Number(t.duracao_degelo) > 0) ? 'policy-incomplete' : ''}`}>
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
                    {!(t.temp_min != null && t.temp_max != null && Number(t.temp_min) < Number(t.temp_max) && Number(t.intervalo_degelo) > 0 && Number(t.duracao_degelo) > 0) && (
                      <span className="policy-validation-warning"><AlertTriangle size={13}/> Revise limites térmicos e ciclo de degelo.</span>
                    )}
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

              {modalParametro.entidade === 'TIPO' && (
                <div className="policy-live-preview">
                  <span>Prévia da matriz</span>
                  <strong>{modalParametro.nome || 'Nova matriz'}</strong>
                  <div><span><Thermometer size={13}/> {modalParametro.temp_min || '--'}°C a {modalParametro.temp_max || '--'}°C</span><span><Droplets size={13}/> {modalParametro.umidade_min || 0}% a {modalParametro.umidade_max || 0}%</span><span><Snowflake size={13}/> {modalParametro.intervalo_degelo || '--'}h / {modalParametro.duracao_degelo || '--'}min</span></div>
                </div>
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
