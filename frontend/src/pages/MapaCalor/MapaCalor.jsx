/**
 * Módulo: frontend/src/pages/MapaCalor/MapaCalor.jsx
 * Responsabilidade: Implementa a tela Mapa Calor, seus estados, interações e integrações de dados.
 */

import { Check, ChevronRight, Edit3, Layers3, Minus, Plus, Search, Thermometer, WifiOff, X } from 'lucide-react';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Map, MapPin, AlertTriangle, Snowflake, CheckCircle2, Crosshair, Trash2, UploadCloud, Image as ImageIcon } from 'lucide-react';
import './MapaCalor.css';

/**
 * Busca ou monta os dados de get equipment status usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} equipment - Valor de equipment consumido por esta rotina.
 * @param {unknown} notifications - Valor de notifications consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getEquipmentStatus(equipment, notifications = []) {
  const value = Number.parseFloat(equipment.ultima_temp);
  const min = Number.parseFloat(equipment.temp_min);
  const max = Number.parseFloat(equipment.temp_max);
  const hasData = Number.isFinite(value);
  const hasNotification = notifications.some((notification) => String(notification.equipamento_id) === String(equipment.id));
  if (!hasData) return { key: 'offline', label: 'Sem telemetria', icon: WifiOff };
  if (hasNotification || (Number.isFinite(max) && value > max) || (Number.isFinite(min) && value < min)) return { key: 'alert', label: 'Em alerta', icon: AlertTriangle };
  if (equipment.em_degelo) return { key: 'defrost', label: 'Em degelo', icon: Snowflake };
  if (equipment.motor_ligado) return { key: 'cooling', label: 'Refrigerando', icon: Thermometer };
  return { key: 'rest', label: 'Em repouso', icon: CheckCircle2 };
}

/**
 * Remonta o estado local quando a filial muda, evitando misturar plantas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function MapaCalor(props) {
  const branchKey = String(props.filialAtiva || 'Matriz').replaceAll(/[^a-zA-Z0-9_-]/g, '_');
  return <MapaCalorFilial key={branchKey} {...props} branchKey={branchKey} />;
}

/**
 * Planta interativa que posiciona e acompanha os ativos da filial em tempo real.
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
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.notificacoesDaFilial - Propriedade notificacoesDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {Function} options.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {unknown} options.branchKey - Propriedade branchKey usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function MapaCalorFilial({ equipamentosDaFilial = [], notificacoesDaFilial = [], filialAtiva, showToast, onNavigate, branchKey }) {
  const positionsKey = `termosync_floor_positions_${branchKey}`;
  const imageKey = `termosync_floor_image_${branchKey}`;
  const fileInputRef = useRef(null);
  const [positions, setPositions] = useState(() => {
    try {
      const stored = localStorage.getItem(positionsKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  });
  const [floorImage, setFloorImage] = useState(() => {
    try {
      return localStorage.getItem(imageKey) || null;
    } catch (error) {
      return null;
    }
  });
  const [placementId, setPlacementId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoom, setZoom] = useState(1);
  const equipment = useMemo(() => equipamentosDaFilial.map((item) => ({ ...item, mapStatus: getEquipmentStatus(item, notificacoesDaFilial) })), [equipamentosDaFilial, notificacoesDaFilial]);
  const positionedCount = equipment.filter((item) => positions[String(item.id)]).length;
  const alertCount = equipment.filter((item) => item.mapStatus.key === 'alert').length;
  const offlineCount = equipment.filter((item) => item.mapStatus.key === 'offline').length;
  const filtered = equipment.filter((item) => (statusFilter === 'all' || item.mapStatus.key === statusFilter) && `${item.nome} ${item.setor}`.toLowerCase().includes(search.toLowerCase()));
  const selected = equipment.find((item) => String(item.id) === String(selectedId)) || null;

  /**
   * Exibe feedback usando o toast principal da aplicação.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @param {unknown} message - Valor de message consumido por esta rotina.
   * @param {unknown} type - Valor de type consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const notify = (message, type = 'info') => {
    if (showToast) showToast(message, type);
    else window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: message, type } }));
  };

  // Cada filial mantém sua própria disposição dos equipamentos na planta.
  useEffect(() => {
    try {
      localStorage.setItem(positionsKey, JSON.stringify(positions));
    } catch (_error) {
      // O mapa continua funcionando na sessão quando o armazenamento está indisponível.
    }
  }, [positions, positionsKey]);
  /**
   * Concentra a logica de upload floor para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const uploadFloor = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      notify('Use uma imagem JPG ou PNG de até 2,5 MB.', 'error');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(imageKey, reader.result);
        setFloorImage(reader.result);
        notify('Planta da filial atualizada.', 'success');
      } catch (error) { notify('Não há espaço local suficiente para esta imagem.', 'error'); }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  /**
   * Posiciona no ponto clicado o ativo selecionado na fila de edição.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const placeEquipment = (event) => {
    if (!editMode || !placementId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(1, Math.min(99, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(1, Math.min(99, ((event.clientY - rect.top) / rect.height) * 100));
    setPositions((current) => ({ ...current, [String(placementId)]: { x, y } }));
    setSelectedId(placementId);
    setPlacementId(null);
    notify('Ativo posicionado na planta.', 'success');
  };

  /**
   * Remove apenas a posição do ativo, preservando seu cadastro.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const removePosition = (event, id) => {
    event.stopPropagation();
    setPositions((current) => {
      const next = { ...current };
      delete next[String(id)];
      return next;
    });
    if (String(selectedId) === String(id)) setSelectedId(null);
  };

  /**
   * Limpa a imagem atual após confirmação, mantendo as posições cadastradas.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const removeFloorImage = () => {
    if (!window.confirm('Remover a imagem da planta desta filial?')) return;
    localStorage.removeItem(imageKey);
    setFloorImage(null);
    notify('Imagem da planta removida.', 'success');
  };

  return (
    <main className="digital-floor anim-fade-in">
      <header className="digital-floor-header">
        <div className="floor-title"><span><Map size={21} /></span><div><small>{filialAtiva || 'Filial atual'}</small><h2>Planta digital</h2><p>Localização física e condição térmica dos ativos.</p></div></div>
        <div className="floor-header-actions">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={uploadFloor} hidden />
          <button type="button" onClick={() => fileInputRef.current?.click()}><UploadCloud size={16} /> {floorImage ? 'Trocar planta' : 'Importar planta'}</button>
          {floorImage && <button type="button" className="icon-button danger" onClick={removeFloorImage} title="Remover imagem"><Trash2 size={16} /></button>}
          <button type="button" className={editMode ? 'active' : ''} onClick={() => { setEditMode((current) => !current); setPlacementId(null); }}><Edit3 size={16} /> {editMode ? 'Concluir edição' : 'Editar posições'}</button>
        </div>
      </header>

      <section className="floor-kpis">
        <div><Layers3 size={17} /><span><strong>{equipment.length}</strong> ativos</span></div>
        <div><MapPin size={17} /><span><strong>{positionedCount}</strong> posicionados</span></div>
        <div className={alertCount ? 'danger' : ''}><AlertTriangle size={17} /><span><strong>{alertCount}</strong> alertas</span></div>
        <div className={offlineCount ? 'warning' : ''}><WifiOff size={17} /><span><strong>{offlineCount}</strong> sem dados</span></div>
        <div className="coverage"><span>Cobertura da planta</span><strong>{equipment.length ? Math.round((positionedCount / equipment.length) * 100) : 0}%</strong><i><b style={{ width: `${equipment.length ? (positionedCount / equipment.length) * 100 : 0}%` }} /></i></div>
      </section>

      <section className="floor-workspace">
        <aside className="floor-sidebar">
          <div className="floor-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ativo" />{search && <button type="button" onClick={() => setSearch('')}><X size={14} /></button>}</div>
          <div className="floor-filter">{[['all', 'Todos'], ['alert', 'Alertas'], ['offline', 'Sem dados']].map(([value, label]) => <button key={value} type="button" className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>{label}</button>)}</div>
          {editMode && <div className="placement-help"><Crosshair size={16} /><span>{placementId ? 'Clique na planta para posicionar o ativo selecionado.' : 'Selecione um ativo para posicionar ou mover.'}</span></div>}
          <div className="floor-assets">
            {filtered.map((item) => {
              const id = String(item.id);
              const StatusIcon = item.mapStatus.icon;
              const isPositioned = Boolean(positions[id]);
              return <button key={item.id} type="button" className={`floor-asset status-${item.mapStatus.key} ${String(placementId) === id ? 'placing' : ''}`} onClick={() => editMode ? setPlacementId(id) : setSelectedId(id)}>
                <span className="asset-status"><StatusIcon size={15} /></span><span className="asset-name"><strong>{item.nome}</strong><small>{item.setor || 'Sem setor'} · {isPositioned ? 'Na planta' : 'Não posicionado'}</small></span>
                {editMode && isPositioned ? <span className="remove-position" role="button" tabIndex={0} onClick={(event) => removePosition(event, item.id)} title="Remover posição"><Trash2 size={14} /></span> : isPositioned ? <Check size={15} /> : <ChevronRight size={15} />}
              </button>;
            })}
          </div>
        </aside>

        <div className="floor-stage">
          <div className="floor-stage-toolbar"><span><span className="legend-dot alert" /> Alerta</span><span><span className="legend-dot cooling" /> Refrigerando</span><span><span className="legend-dot defrost" /> Degelo</span><span><span className="legend-dot rest" /> Repouso</span><div><button type="button" onClick={() => setZoom((value) => Math.max(.75, value - .25))} title="Reduzir zoom"><Minus size={15} /></button><strong>{Math.round(zoom * 100)}%</strong><button type="button" onClick={() => setZoom((value) => Math.min(1.75, value + .25))} title="Aumentar zoom"><Plus size={15} /></button></div></div>
          <div className="floor-viewport">
            <div className={`floor-canvas ${editMode && placementId ? 'placement-active' : ''}`} style={{ width: `${zoom * 100}%`, backgroundImage: floorImage ? `url("${floorImage}")` : undefined }} onClick={placeEquipment}>
              {!floorImage && <div className="floor-grid-label"><ImageIcon size={34} /><strong>Área de implantação</strong><span>Importe a planta baixa ou use a grade para posicionar os ativos.</span></div>}
              {equipment.map((item) => {
                const position = positions[String(item.id)];
                if (!position) return null;
                const StatusIcon = item.mapStatus.icon;
                const temperature = Number.parseFloat(item.ultima_temp);
                return <button type="button" key={item.id} className={`floor-marker status-${item.mapStatus.key} ${String(selectedId) === String(item.id) ? 'selected' : ''}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={(event) => { event.stopPropagation(); if (editMode) setPlacementId(String(item.id)); else setSelectedId(item.id); }}>
                  <span><StatusIcon size={15} /></span><strong>{item.nome}</strong><small>{Number.isFinite(temperature) ? temperature.toFixed(1) : '--'}°C</small>
                </button>;
              })}
            </div>
          </div>
        </div>

        {selected && <aside className="floor-detail">
          <button type="button" className="detail-close" onClick={() => setSelectedId(null)}><X size={17} /></button>
          <span className={`detail-state status-${selected.mapStatus.key}`}>{React.createElement(selected.mapStatus.icon, { size: 15 })} {selected.mapStatus.label}</span>
          <h3>{selected.nome}</h3><p><MapPin size={13} /> {selected.setor || 'Sem setor'}</p>
          <div className="detail-temperature"><span>Temperatura atual</span><strong>{Number.isFinite(Number.parseFloat(selected.ultima_temp)) ? Number.parseFloat(selected.ultima_temp).toFixed(1) : '--'}<small>°C</small></strong></div>
          <div className="detail-specs"><div><span>Faixa mínima</span><strong>{selected.temp_min ?? '--'}°C</strong></div><div><span>Faixa máxima</span><strong>{selected.temp_max ?? '--'}°C</strong></div><div><span>Motor</span><strong>{selected.motor_ligado ? 'Ligado' : 'Repouso'}</strong></div><div><span>Posição</span><strong>{positions[String(selected.id)] ? 'Mapeada' : 'Pendente'}</strong></div></div>
          <button type="button" className="detail-action" onClick={() => onNavigate?.('motores')}>Abrir monitor térmico <ChevronRight size={15} /></button>
        </aside>}
      </section>
    </main>
  );
}
