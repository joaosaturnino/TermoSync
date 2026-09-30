/**
 * Módulo: frontend/src/components/GlobalSystemSettingsModal.jsx
 * Responsabilidade: Implementa o componente reutilizável Global System Settings Modal e seu contrato visual.
 */

import { useEffect, useState } from 'react';
import { BellRing, Database, LayoutGrid, Moon, Radio, Save, ShieldCheck, Sun, Volume2, VolumeX, Wifi, X } from 'lucide-react';
import { createPortal } from 'react-dom';
/**
 * Módulo: frontend/src/components/GlobalSystemSettingsModal.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const describeService = (value) => {
  const status = String(value || '').toLowerCase();
  if (['ok', 'online', 'healthy', 'connected'].includes(status)) return { label: 'Operacional', tone: 'good' };
  if (['degraded', 'warning'].includes(status)) return { label: 'Atenção', tone: 'warn' };
  if (['offline', 'error', 'disconnected'].includes(status)) return { label: 'Indisponível', tone: 'bad' };
  return { label: 'Sem leitura', tone: 'neutral' };
};

/**
 * Exibe as preferências globais acessíveis em qualquer tela autenticada. As opções alteram
 * somente comportamento visual e alertas do usuário atual; políticas administrativas continuam
 * protegidas pelo controle de permissões.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador; registra ou remove listeners de eventos; publica ou consome mensagens MQTT
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {boolean} props.isDarkMode - Sinalizador isDarkMode que controla este comportamento visual.
 * @param {unknown} props.setIsDarkMode - Propriedade setIsDarkMode usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.forceDarkMode - Propriedade forceDarkMode usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.uiDensity - Propriedade uiDensity usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setUiDensity - Propriedade setUiDensity usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.soundEnabled - Propriedade soundEnabled usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.toggleSound - Propriedade toggleSound usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.audioAllowed - Propriedade audioAllowed usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.systemHealth - Propriedade systemHealth usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.supportContext - Propriedade supportContext usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onClose - Callback onClose fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function GlobalSystemSettingsModal({
  isDarkMode,
  setIsDarkMode,
  forceDarkMode,
  uiDensity,
  setUiDensity,
  soundEnabled,
  toggleSound,
  audioAllowed,
  isOffline,
  systemHealth,
  supportContext,
  onClose
}) {
  const [draft, setDraft] = useState({
    darkMode: forceDarkMode ? true : isDarkMode,
    density: uiDensity,
    sound: soundEnabled
  });

  useEffect(() => {

    /**
     * Renderiza o componente handle Key Down e encapsula sua interacao visual reutilizavel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  /**
   * Aplica todas as preferências de uma vez para permitir cancelar alterações em rascunho.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const savePreferences = () => {
    if (!forceDarkMode) setIsDarkMode(draft.darkMode);
    setUiDensity(draft.density);
    if (audioAllowed && draft.sound !== soundEnabled) toggleSound();
    window.dispatchEvent(new CustomEvent('forceToast', {
      detail: { msg: 'Configurações do sistema atualizadas.', type: 'success' }
    }));
    onClose();
  };

  const services = [
    { label: 'API', value: isOffline ? 'offline' : systemHealth?.status, icon: Wifi },
    { label: 'Banco de dados', value: isOffline ? 'offline' : systemHealth?.database, icon: Database },
    { label: 'MQTT', value: isOffline ? 'offline' : systemHealth?.mqtt, icon: Radio }
  ];

  return createPortal(
    <div className="global-config-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="global-config-modal" role="dialog" aria-modal="true" aria-labelledby="global-config-title">
        <header className="global-config-header">
          <div>
            <span>Preferências globais</span>
            <h2 id="global-config-title">Configurações do sistema</h2>
            <p>Personalize a experiência do TermoSync neste dispositivo.</p>
          </div>
          <button type="button" className="global-config-close" onClick={onClose} title="Fechar configurações" aria-label="Fechar configurações"><X size={19} /></button>
        </header>

        <div className="global-config-body">
          <section className="global-config-section" aria-labelledby="config-appearance-title">
            <div className="global-config-section-heading">
              <LayoutGrid size={18} />
              <div><h3 id="config-appearance-title">Aparência</h3><span>Como o sistema é exibido para você</span></div>
            </div>

            <div className="global-config-row">
              <div><strong>Tema da interface</strong><small>{forceDarkMode ? 'O tema escuro foi definido pela administração.' : 'Escolha o contraste mais confortável.'}</small></div>
              <div className="global-config-segmented" aria-label="Tema da interface">
                <button type="button" className={!draft.darkMode ? 'active' : ''} onClick={() => setDraft(current => ({ ...current, darkMode: false }))} disabled={forceDarkMode}><Sun size={16} /> Claro</button>
                <button type="button" className={draft.darkMode ? 'active' : ''} onClick={() => setDraft(current => ({ ...current, darkMode: true }))}><Moon size={16} /> Escuro</button>
              </div>
            </div>

            <div className="global-config-row">
              <div><strong>Densidade das telas</strong><small>Ajuste o espaço entre informações e controles.</small></div>
              <div className="global-config-segmented" aria-label="Densidade das telas">
                <button type="button" className={draft.density === 'comfortable' ? 'active' : ''} onClick={() => setDraft(current => ({ ...current, density: 'comfortable' }))}>Confortável</button>
                <button type="button" className={draft.density === 'compact' ? 'active' : ''} onClick={() => setDraft(current => ({ ...current, density: 'compact' }))}>Compacta</button>
              </div>
            </div>
          </section>

          <section className="global-config-section" aria-labelledby="config-alerts-title">
            <div className="global-config-section-heading">
              <BellRing size={18} />
              <div><h3 id="config-alerts-title">Alertas</h3><span>Comportamento dos avisos do sistema</span></div>
            </div>
            <label className={`global-config-toggle ${!audioAllowed ? 'disabled' : ''}`}>
              <span>{draft.sound && audioAllowed ? <Volume2 size={18} /> : <VolumeX size={18} />}</span>
              <div><strong>Alertas sonoros</strong><small>{audioAllowed ? 'Reproduz um aviso quando surgir uma ocorrência importante.' : 'Este recurso foi desativado pela administração.'}</small></div>
              <input type="checkbox" checked={draft.sound && audioAllowed} onChange={event => setDraft(current => ({ ...current, sound: event.target.checked }))} disabled={!audioAllowed} />
              <i aria-hidden="true" />
            </label>
          </section>

          <section className="global-config-section" aria-labelledby="config-context-title">
            <div className="global-config-section-heading">
              <ShieldCheck size={18} />
              <div><h3 id="config-context-title">Sessão e conectividade</h3><span>Contexto atual, disponível para todos os perfis</span></div>
            </div>
            <div className="global-config-services">
              {services.map(service => {
                const status = describeService(service.value);
                const Icon = service.icon;
                return <div key={service.label}><Icon size={16} /><span>{service.label}</span><strong className={status.tone}><i />{status.label}</strong></div>;
              })}
            </div>
            <dl className="global-config-session">
              <div><dt>Perfil</dt><dd>{supportContext?.role || 'Não informado'}</dd></div>
              <div><dt>Filial</dt><dd>{supportContext?.filial || 'Não informada'}</dd></div>
            </dl>
          </section>
        </div>

        <footer className="global-config-footer">
          <span>As preferências são mantidas neste navegador.</span>
          <div>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={savePreferences}><Save size={16} /> Salvar alterações</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
