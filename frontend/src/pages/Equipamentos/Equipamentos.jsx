/**
 * Módulo: frontend/src/pages/Equipamentos/Equipamentos.jsx
 * Responsabilidade: Implementa a tela Equipamentos, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { Activity, Snowflake } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import {
  PlusCircle, ShieldCheck, AlertTriangle, ClipboardCheck, Edit, X,
  Thermometer, Droplets, PackageSearch, Settings, MapPin,
  Server, Search, Zap, Trash2, QrCode, History,
  Lock, Shield
} from 'lucide-react';
import jsPDF from 'jspdf';
import './Equipamentos.css';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';

/**
 * Renderiza a tela Equipamentos e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userFilial - Propriedade userFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filiaisDb - Propriedade filiaisDb usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.listaSetores - Propriedade listaSetores usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.listaTipos - Propriedade listaTipos usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.carregarDadosBase - Propriedade carregarDadosBase usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.equipamentosFiltradosLista - Propriedade equipamentosFiltradosLista usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.editarEquipamento - Propriedade editarEquipamento usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.pedirExclusao - Propriedade pedirExclusao usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Equipamentos({ 
  api, showToast, isOffline, userRole, userFilial, filiaisDb, listaSetores, listaTipos, 
  carregarDadosBase, equipamentosFiltradosLista, editarEquipamento, pedirExclusao 
}) {
  
  // ============================================================================
  // MOTOR DE SEGURANÇA E ISOLAMENTO DE ACESSO
  // ============================================================================
  const roleLogada = userRole || sessionStorage.getItem('userRole') || 'LOJA';
  
  // Cadastros e exclusões de ativos alteram a estrutura da operação e ficam com ADMIN/DEV.
  const canEdit = roleLogada === 'ADMIN' || roleLogada === 'DEV';

  const formInicial = { 
    nome: '', tipo: '', temp_min: '', temp_max: '', 
    umidade_min: '', umidade_max: '', intervalo_degelo: '', 
    duracao_degelo: '', setor: '', filial: roleLogada === 'LOJA' ? userFilial : '', 
    data_calibracao: new Date().toISOString().split('T')[0] 
  };
  
  const [formEquip, setFormEquip] = useState({ ...formInicial });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [buscaAtivo, setBuscaAtivo] = useState('');
  const [filtroAtivo, setFiltroAtivo] = usePersistentState('termosync_equipment_status', 'TODOS');
  const [instanteReferencia] = useState(Date.now);
  
  const [modalHistorico, setModalHistorico] = useState(null);


  /**
   * Concentra a logica de aplicar norma anvisa para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} tipoSelecionado - Valor de tipo selecionado consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
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


    /**
     * Verifica a condicao has valid val e retorna um valor booleano.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {unknown} val - Valor de val consumido por esta rotina.
     * @returns {boolean} Indica se a condição avaliada foi atendida.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
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


  /**
   * Concentra a logica de salvar novo equipamento para manter o restante do tela mais legivel.
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
  const salvarNovoEquipamento = async (e) => {
    e.preventDefault(); 
    if (!canEdit) return showToast('Acesso negado. Modo de leitura ativo para o seu perfil.', 'error');
    if (isOffline) return showToast('Ação bloqueada. Sem conexão com a rede.', 'warning');
    
    const dadosFinais = { ...formEquip, filial: roleLogada === 'LOJA' ? userFilial : formEquip.filial };
    try { 
      await api.post('/equipamentos', dadosFinais); 
      showToast('Máquina registrada no Inventário IoT.', 'success'); 
      setFormEquip({ ...formInicial, filial: roleLogada === 'LOJA' ? userFilial : '' }); 
      setIsFormOpen(false);
      carregarDadosBase(); 
    } catch (e) { showToast('Ocorreu um erro ao gravar a máquina.', 'error'); }
  };


  /**
   * Gera gerar etiqueta qr com os dados necessarios para o proximo passo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} eq - Valor de eq consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
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
      doc.text(`ID Interno: ${eq.id} | Validado: ${new Date().toLocaleDateString('pt-BR')}`, 50, 140, { align: "center" });

      doc.save(`Etiqueta_QR_${eq.nome}.pdf`);
      showToast('Download do PDF concluído.', 'success');
    } catch(err) {
      showToast('Erro ao desenhar PDF do QR Code.', 'error');
    }
  };

  /** Classifica o estado operacional sem confundir ciclo de degelo com falha do motor. */
  const ativosAnalisados = useMemo(() => (equipamentosFiltradosLista || []).map((eq) => {
    const estado = eq.em_degelo ? 'DEGELO' : (eq.motor_ligado === false || eq.motor_ligado === 0 ? 'INATIVO' : 'OPERANDO');
    return { ...eq, estado_operacional: estado };
  }), [equipamentosFiltradosLista]);

  /** Combina pesquisa e situação operacional para reduzir a lista sem alterar o inventário original. */
  const ativosExibidos = useMemo(() => {
    const termo = buscaAtivo.toLowerCase().trim();
    return ativosAnalisados.filter((eq) => {
      const correspondeEstado = filtroAtivo === 'TODOS' || eq.estado_operacional === filtroAtivo;
      const correspondeBusca = !termo || [eq.nome, eq.setor, eq.filial, eq.tipo]
        .some((valor) => String(valor || '').toLowerCase().includes(termo));
      return correspondeEstado && correspondeBusca;
    });
  }, [ativosAnalisados, buscaAtivo, filtroAtivo]);

  const kpis = useMemo(() => {
    if (!ativosAnalisados) return { total: 0, riscoCalib: 0, offlines: 0, degelo: 0, operando: 0 };
    let riscoCalib = 0; let offlines = 0; let degelo = 0;

    ativosAnalisados.forEach(eq => {
      const dataCalibracao = eq.data_calibracao ? new Date(eq.data_calibracao) : null;
      const diasCalib = dataCalibracao && !Number.isNaN(dataCalibracao.getTime())
        ? Math.floor((instanteReferencia - dataCalibracao.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      if (diasCalib === null || diasCalib > 330) riscoCalib++;
      if (eq.estado_operacional === 'INATIVO') offlines++;
      if (eq.estado_operacional === 'DEGELO') degelo++;
    });

    return { total: ativosAnalisados.length, riscoCalib, offlines, degelo, operando: ativosAnalisados.length - offlines - degelo };
  }, [ativosAnalisados, instanteReferencia]);

  if (!equipamentosFiltradosLista) return <Loader message="Carregando inventário de equipamentos..." />;

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
              <h4 style={{margin: '0 0 5px 0', color: 'var(--text-main)'}}>{modalHistorico.nome}</h4>
              <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px'}}><MapPin size={14}/> {modalHistorico.filial || 'Filial'} • {modalHistorico.setor}</p>
            </div>

            <div className="equipment-snapshot">
              <div><span>Estado operacional</span><strong>{modalHistorico.em_degelo ? 'Em degelo' : (modalHistorico.motor_ligado === false || modalHistorico.motor_ligado === 0 ? 'Inativo' : 'Operando')}</strong></div>
              <div><span>Última calibração</span><strong>{modalHistorico.data_calibracao ? new Date(modalHistorico.data_calibracao).toLocaleDateString('pt-BR') : 'Não registrada'}</strong></div>
              <div><span>Faixa térmica</span><strong>{modalHistorico.temp_min ?? '--'}°C a {modalHistorico.temp_max ?? '--'}°C</strong></div>
              <div><span>Ciclo de degelo</span><strong>{modalHistorico.intervalo_degelo ? `A cada ${modalHistorico.intervalo_degelo}h por ${modalHistorico.duracao_degelo || '--'} min` : 'Não configurado'}</strong></div>
            </div>
            <p className="equipment-snapshot-note">Este painel apresenta a configuração e o estado atual recebido do equipamento. Eventos históricos dependem de registros de manutenção vinculados ao ativo.</p>
            
            <button className="btn btn-primary w-100" onClick={() => setModalHistorico(null)} style={{marginTop: '20px'}}>Fechar Relatório</button>
          </div>
        </div>
      )}

      <div className="flex-header equipamentos-header">
        <div>
          <h3 className="equipamentos-title">Inventário de Equipamentos</h3>
          <p className="equipamentos-subtitle">Cadastro técnico, disponibilidade e configuração do parque instalado.</p>
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
          
          {canEdit ? (
            <button 
              className={`btn ${isFormOpen ? 'btn-outline' : 'btn-primary'} btn-toggle-form`} 
              onClick={() => setIsFormOpen(!isFormOpen)}
            >
              {isFormOpen ? <X size={18}/> : <PlusCircle size={18}/>}
              {isFormOpen ? 'Cancelar' : 'Adicionar Equipamento'}
            </button>
          ) : (
            <div className="read-only-banner" title="Não possui privilégios de Gestão (Gerente/Coordenador) para adicionar ou alterar hardware.">
              <Lock size={16} /> Auditoria Estrita (Somente Leitura)
            </div>
          )}
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
        <div className="kpi-item ok">
          <div className="kpi-icon"><Activity size={20}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.operando}</span><span className="kpi-label">Operando Agora</span></div>
        </div>
        <div className="kpi-item total">
          <div className="kpi-icon"><Snowflake size={20}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.degelo}</span><span className="kpi-label">Em Ciclo de Degelo</span></div>
        </div>
      </div>

      <div className="equipment-status-filters" aria-label="Filtrar equipamentos por estado">
        {[
          ['TODOS', 'Todos', kpis.total],
          ['OPERANDO', 'Operando', kpis.operando],
          ['DEGELO', 'Em degelo', kpis.degelo],
          ['INATIVO', 'Inativos', kpis.offlines]
        ].map(([valor, label, total]) => (
          <button type="button" key={valor} className={filtroAtivo === valor ? 'active' : ''} onClick={() => setFiltroAtivo(valor)}>
            {label} <span>{total}</span>
          </button>
        ))}
      </div>

      {isFormOpen && canEdit && (
        <div className="smart-form-panel open">
          <div className="card equipamentos-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
            <div className="equipamentos-card-header">
              <h3 className="equipamentos-card-title"><Settings size={20} color="var(--primary)" /> Perfil do Novo Ativo</h3>
            </div>
            
            <form onSubmit={salvarNovoEquipamento}>
              <div className="form-section">
                <div className="form-section-header"><h4 className="form-section-title"><MapPin size={16} color="var(--text-muted)"/> Identificação Física</h4></div>
                <div className="form-grid">
                  <div><label>Identificador na Rede *</label><input type="text" value={formEquip.nome} onChange={(e) => setFormEquip({ ...formEquip, nome: e.target.value })} placeholder="Ex: CONG-01 Corredor Frios" required /></div>
                  <div><label>Filial Designada *</label><select className="select-input" value={formEquip.filial} onChange={(e) => setFormEquip({ ...formEquip, filial: e.target.value })} required disabled={roleLogada === 'LOJA'} style={{ backgroundColor: roleLogada === 'LOJA' ? 'var(--bg-color)' : undefined }}><option value="">Selecione a Filial...</option>{filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div><label>Setor Operacional *</label><select className="select-input" value={formEquip.setor} onChange={(e) => setFormEquip({ ...formEquip, setor: e.target.value })} required><option value="">Selecione o Setor...</option>{listaSetores?.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}</select></div>
                  <div><label>Padrão Técnico (Tipo) *</label><select className="select-input" value={formEquip.tipo} onChange={(e) => setFormEquip({ ...formEquip, tipo: e.target.value })} required><option value="">Selecione o Tipo...</option>{listaTipos?.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}</select></div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-header">
                  <h4 className="form-section-title"><ShieldCheck size={16} color="var(--success)"/> Parâmetros de SLA & Alertas</h4>
                  <button type="button" className="btn btn-anvisa" onClick={() => aplicarNormaANVISA(formEquip.tipo)} disabled={!formEquip.tipo || isOffline} title="Carregar configuração RDC/ANVISA automaticamente"><Zap size={14} /> Aplicar Perfil Normativo</button>
                </div>
                <div className="form-grid">
                  <div><label>Temp. Mínima Crítica (°C) *</label><input type="number" step="0.1" value={formEquip.temp_min} onChange={(e) => setFormEquip({ ...formEquip, temp_min: e.target.value })} required /></div>
                  <div><label>Temp. Máxima Crítica (°C) *</label><input type="number" step="0.1" value={formEquip.temp_max} onChange={(e) => setFormEquip({ ...formEquip, temp_max: e.target.value })} required /></div>
                  <div><label>Umidade Mínima (%)</label><input type="number" step="0.1" value={formEquip.umidade_min} onChange={(e) => setFormEquip({ ...formEquip, umidade_min: e.target.value })} /></div>
                  <div><label>Umidade Máxima (%)</label><input type="number" step="0.1" value={formEquip.umidade_max} onChange={(e) => setFormEquip({ ...formEquip, umidade_max: e.target.value })} /></div>
                </div>
              </div>

              <div className="form-section" style={{ marginBottom: 0 }}>
                <div className="form-section-header"><h4 className="form-section-title"><Thermometer size={16} color="var(--warning)"/> Metrologia Oficial e Ciclos</h4></div>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                  <div><label>Data do Certificado de Calibração *</label><input type="date" value={formEquip.data_calibracao} onChange={(e) => setFormEquip({ ...formEquip, data_calibracao: e.target.value })} required /></div>
                  <div><label>Intervalo de Ciclo de Degelo (Horas) *</label><input type="number" min="1" value={formEquip.intervalo_degelo} onChange={(e) => setFormEquip({ ...formEquip, intervalo_degelo: e.target.value })} required /></div>
                  <div><label>Duração do Ciclo de Degelo (Min) *</label><input type="number" min="1" value={formEquip.duracao_degelo} onChange={(e) => setFormEquip({ ...formEquip, duracao_degelo: e.target.value })} required /></div>
                </div>
              </div>
              
              <div className="equipamentos-form-actions">
                <button type="submit" className="btn btn-primary" disabled={isOffline}><PlusCircle size={18} /> Salvar Equipamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="card table-responsive stagger-3">
        {(!ativosExibidos || ativosExibidos.length === 0) ? (
          <EmptyState title="Nenhum ativo localizado" description="A pesquisa não retornou resultados ou esta filial ainda não tem sensores integrados." icon={PackageSearch} />
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
                 const diasCalib = eq.data_calibracao ? Math.floor((instanteReferencia - new Date(eq.data_calibracao).getTime()) / (1000 * 60 * 60 * 24)) : 365;
                 const calibPercent = Math.min(100, Math.max(0, (diasCalib / 365) * 100));
                 const isCritico = !eq.data_calibracao || diasCalib > 330;
                 const isExpirado = diasCalib > 365;
                 
                 let ringColor = 'var(--success)';
                 let isPulse = false;
                 if (eq.em_degelo) ringColor = 'var(--secondary)';
                 else if (!eq.motor_ligado) { ringColor = 'var(--danger)'; isPulse = true; }

                 return (
                  <tr key={eq.id} className="iot-table-row">
                    <td data-label="Loja/Filial"><div className="node-location"><span className={`status-ring ${isPulse ? 'pulse' : ''}`} style={{ color: ringColor }} title={eq.em_degelo ? 'Em Degelo' : (!eq.motor_ligado ? 'Motor Parado/Falha' : 'Operando Normalmente')}></span> <strong>{eq.filial || 'Matriz'}</strong></div></td>
                    <td data-label="Hardware"><div className="equipamento-nome-box"><span className="hw-name">{eq.nome}</span><span className="equipamento-subtitle">{eq.tipo} • {eq.setor}</span></div></td>
                    <td data-label="Metrologia">
                      <div className="metrology-box">
                        <div className="metrology-labels"><span style={{ color: isExpirado ? 'var(--danger)' : (isCritico ? 'var(--warning)' : 'var(--text-muted)') }}>{!eq.data_calibracao ? 'Sem certificado' : (isExpirado ? 'Certificado expirado' : (isCritico ? 'Renovação próxima' : 'Dentro da validade'))}</span><strong>{eq.data_calibracao ? `${diasCalib} dias` : '--'}</strong></div>
                        <div className="metrology-track"><div className={`metrology-fill ${isExpirado ? 'expired' : (isCritico ? 'warning' : 'ok')}`} style={{ width: `${calibPercent}%` }}></div></div>
                      </div>
                    </td>
                    <td data-label="SLA Operacional">
                      <div className="limites-box">
                        <span className="limit-tag termico"><Thermometer size={14} /> {eq.temp_min}°C a {eq.temp_max}°C</span>
                        {(eq.umidade_min != null || eq.umidade_max != null) && (<span className="limit-tag higro"><Droplets size={14} /> {eq.umidade_min || 0}% a {eq.umidade_max || 80}%</span>)}
                      </div>
                    </td>
                    <td data-label="Ações" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="btn-action" style={{color: 'var(--secondary)', background: 'color-mix(in srgb, var(--info) 10%, transparent)', border: 'transparent'}} onClick={() => setModalHistorico(eq)} title="Auditoria de Intervenções"><History size={18} /></button>
                        <button className="btn-action" style={{color: 'var(--primary)', background: 'color-mix(in srgb, var(--success) 10%, transparent)', border: 'transparent'}} onClick={() => gerarEtiquetaQR(eq)} title="Imprimir Etiqueta QR"><QrCode size={18} /></button>
                        
                        {canEdit ? (
                          <>
                            <button className="btn-action edit" onClick={() => editarEquipamento(eq)} disabled={isOffline} title="Editar Equipamento"><Edit size={18} /></button>
                            <button className="btn-action delete" style={isOffline ? { color: 'var(--text-muted)', background: 'transparent' } : {}} onClick={() => pedirExclusao(eq.id, eq.nome)} disabled={isOffline} title="Excluir Equipamento"><Trash2 size={18} /></button>
                          </>
                        ) : (
                          <div className="lock-icon-read" title="Cadastro disponível apenas para administradores e desenvolvedores"><Shield size={16} /></div>
                        )}
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
