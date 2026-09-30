/**
 * Módulo: frontend/src/pages/Privacidade/Privacidade.jsx
 * Responsabilidade: Implementa a tela Privacidade, seus estados, interações e integrações de dados.
 */

import { useMemo, useState } from 'react';
import { Activity, Check, ChevronRight, Database, Download, Eye, FileClock, HelpCircle, Info, KeyRound, LockKeyhole, Save, Settings2, ShieldCheck, SlidersHorizontal, UserCheck } from 'lucide-react';
import './Privacidade.css';

const STORAGE_KEY = 'termosync:privacy-preferences';
const DEFAULT_PREFERENCES = {
  essential: true,
  diagnostics: true,
  personalization: true,
  performance: false
};
const DATA_CATEGORIES = [
  { icon: KeyRound, title: 'Conta e acesso', data: 'Identificação, perfil, empresa, filial e sessões.', purpose: 'Autenticar o usuário e aplicar o escopo de acesso.', retention: 'Durante a vigência da conta e conforme a política de auditoria.' },
  { icon: Activity, title: 'Telemetria operacional', data: 'Leituras, eventos e estado dos equipamentos.', purpose: 'Monitorar a operação e emitir alertas técnicos.', retention: 'Conforme a janela histórica definida para a organização.' },
  { icon: ShieldCheck, title: 'Segurança e auditoria', data: 'Acessos, ações administrativas e eventos de segurança.', purpose: 'Prevenir abuso e manter rastreabilidade.', retention: 'Pelo período legal e operacional aplicável.' },
  { icon: Settings2, title: 'Preferências', data: 'Configurações de interface e escolhas armazenadas no navegador.', purpose: 'Preservar a experiência escolhida pelo usuário.', retention: 'Até a limpeza do navegador ou alteração da preferência.' }
];
/**
 * Módulo: frontend/src/pages/Privacidade/Privacidade.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: lê ou grava preferências no armazenamento do navegador
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const loadPreferences = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_PREFERENCES, ...(stored || {}), essential: true };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

/**
 * Central de transparência, direitos e preferências de privacidade do usuário.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userFilial - Propriedade userFilial usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Privacidade({ userRole, userFilial, onNavigate, showToast }) {
  const [activeSection, setActiveSection] = useState('visao-geral');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [savedPreferences, setSavedPreferences] = useState(loadPreferences);

  const hasChanges = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(savedPreferences),
    [preferences, savedPreferences]
  );

  const sections = [
    { id: 'visao-geral', label: 'Visão geral', icon: Eye },
    { id: 'dados', label: 'Dados tratados', icon: Database },
    { id: 'retencao', label: 'Retenção e direitos', icon: FileClock },
    { id: 'preferencias', label: 'Preferências', icon: SlidersHorizontal }
  ];


  /**
   * Concentra a logica de save preferences para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const savePreferences = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    setSavedPreferences(preferences);
    showToast?.('Preferências de privacidade salvas neste navegador.', 'success');
  };


  /**
   * Processa a interacao de toggle preference e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} key - Valor de key consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const togglePreference = (key) => {
    if (key === 'essential') return;
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };


  /**
   * Concentra a logica de download summary para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const downloadSummary = () => {
    const enabled = Object.entries(savedPreferences).filter(([, value]) => value).map(([key]) => key).join(', ');
    const content = [
      'THERMOSYNC - RESUMO DE PRIVACIDADE',
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      `Perfil: ${userRole || 'Não informado'}`,
      `Contexto: ${userFilial || 'Não informado'}`,
      '',
      'Categorias de dados:',
      ...DATA_CATEGORIES.map((item) => `- ${item.title}: ${item.data} Finalidade: ${item.purpose}`),
      '',
      `Preferências ativas neste navegador: ${enabled}.`,
      '',
      'Para solicitações de acesso, correção ou exclusão, utilize o módulo Suporte ao Sistema.'
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `thermosync-privacidade-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast?.('Resumo de privacidade exportado.', 'success');
  };

  return (
    <div className="privacy-page anim-fade-in">
      <section className="privacy-heading">
        <div>
          <span>Transparência e controle</span>
          <h2>Privacidade e Dados</h2>
          <p>Entenda como as informações apoiam a operação e ajuste as preferências disponíveis neste navegador.</p>
        </div>
        <div className="privacy-heading-actions">
          <span><ShieldCheck size={16} /> Proteção ativa</span>
          <button type="button" onClick={downloadSummary}><Download size={16} /> Exportar resumo</button>
        </div>
      </section>

      <section className="privacy-summary" aria-label="Resumo de privacidade">
        <div><span><Database size={18} /></span><p><small>Categorias mapeadas</small><strong>{DATA_CATEGORIES.length}</strong></p></div>
        <div><span><KeyRound size={18} /></span><p><small>Perfil de acesso</small><strong>{userRole || 'Usuário'}</strong></p></div>
        <div><span><UserCheck size={18} /></span><p><small>Contexto atual</small><strong>{userFilial || 'Global'}</strong></p></div>
        <div><span><LockKeyhole size={18} /></span><p><small>Controles essenciais</small><strong>Sempre ativos</strong></p></div>
      </section>

      <section className="privacy-workspace">
        <nav className="privacy-tabs" aria-label="Seções da central de privacidade">
          {sections.map((section) => <button type="button" key={section.id} className={activeSection === section.id ? 'active' : ''} onClick={() => setActiveSection(section.id)}><section.icon size={17} /><span>{section.label}</span><ChevronRight size={15} /></button>)}
        </nav>

        <div className="privacy-content">
          {activeSection === 'visao-geral' && <div className="privacy-overview">
            <header><span><Info size={20} /></span><div><h3>Compromisso de transparência</h3><p>O ThermoSync utiliza dados para autenticar usuários, executar processos operacionais, manter a segurança e diagnosticar o funcionamento da plataforma.</p></div></header>
            <div className="privacy-principles">
              <article><ShieldCheck size={19} /><h4>Finalidade definida</h4><p>Cada categoria deve estar vinculada a uma necessidade operacional, técnica ou de segurança.</p></article>
              <article><LockKeyhole size={19} /><h4>Acesso controlado</h4><p>Permissões por perfil limitam a visualização e as ações disponíveis em cada módulo.</p></article>
              <article><FileClock size={19} /><h4>Retenção proporcional</h4><p>Os dados devem permanecer somente pelo tempo exigido pela operação, auditoria ou obrigação aplicável.</p></article>
            </div>
            <div className="privacy-callout"><Check size={17} /><p>Preferências opcionais podem ser revistas a qualquer momento. Recursos essenciais de segurança e autenticação permanecem ativos.</p></div>
          </div>}

          {activeSection === 'dados' && <div className="privacy-data-section">
            <header><h3>Inventário de dados</h3><p>Visão resumida das informações que podem ser processadas pela plataforma.</p></header>
            <div className="privacy-data-grid">{DATA_CATEGORIES.map((item) => <article key={item.title}><div className="privacy-data-title"><span><item.icon size={18} /></span><h4>{item.title}</h4></div><dl><div><dt>Dados</dt><dd>{item.data}</dd></div><div><dt>Finalidade</dt><dd>{item.purpose}</dd></div><div><dt>Retenção</dt><dd>{item.retention}</dd></div></dl></article>)}</div>
          </div>}

          {activeSection === 'retencao' && <div className="privacy-rights">
            <header><h3>Retenção e direitos do usuário</h3><p>Solicitações devem ser validadas para proteger a identidade e evitar alterações indevidas.</p></header>
            <div className="privacy-timeline">
              <div><span>01</span><section><h4>Acesso e confirmação</h4><p>Solicite confirmação do tratamento e um resumo das informações relacionadas ao seu usuário.</p></section></div>
              <div><span>02</span><section><h4>Correção e atualização</h4><p>Peça a correção de dados incompletos ou desatualizados vinculados à conta.</p></section></div>
              <div><span>03</span><section><h4>Exclusão ou restrição</h4><p>Solicite análise de exclusão ou restrição, respeitando obrigações de segurança e auditoria.</p></section></div>
              <div><span>04</span><section><h4>Resposta rastreável</h4><p>Acompanhe a solicitação pelo chamado criado no Suporte ao Sistema.</p></section></div>
            </div>
            <button className="privacy-primary-action" type="button" onClick={() => onNavigate?.('suporte')}><HelpCircle size={16} /> Abrir solicitação de privacidade</button>
          </div>}

          {activeSection === 'preferencias' && <div className="privacy-preferences">
            <header><h3>Preferências deste navegador</h3><p>Estas opções ficam salvas localmente e podem não acompanhar sua conta em outros dispositivos.</p></header>
            <div className="privacy-preference-list">
              {[
                { key: 'essential', icon: LockKeyhole, title: 'Operação essencial', description: 'Autenticação, segurança, sessão e funcionamento básico.', locked: true },
                { key: 'diagnostics', icon: Activity, title: 'Diagnóstico técnico', description: 'Ajuda a identificar erros e indisponibilidades durante o uso.' },
                { key: 'personalization', icon: Settings2, title: 'Personalização', description: 'Mantém tema, atalhos e preferências de navegação.' },
                { key: 'performance', icon: SlidersHorizontal, title: 'Métricas de desempenho', description: 'Permite avaliar tempos de carregamento e responsividade.' }
              ].map((item) => <div key={item.key}><span className="privacy-preference-icon"><item.icon size={18} /></span><p><strong>{item.title}</strong><small>{item.description}</small></p><button type="button" role="switch" aria-checked={preferences[item.key]} disabled={item.locked} className={preferences[item.key] ? 'enabled' : ''} onClick={() => togglePreference(item.key)} title={item.locked ? 'Necessário para o funcionamento do sistema' : `Alternar ${item.title}`}><i /></button></div>)}
            </div>
            <footer><span>{hasChanges ? 'Existem alterações ainda não salvas.' : 'Preferências sincronizadas neste navegador.'}</span><button type="button" onClick={savePreferences} disabled={!hasChanges}><Save size={16} /> Salvar preferências</button></footer>
          </div>}
        </div>
      </section>

      <section className="privacy-security-link">
        <div><span><LockKeyhole size={19} /></span><p><strong>Proteja também o acesso à sua conta</strong><small>Revise senha, autenticação em dois fatores e sessões autorizadas.</small></p></div>
        <button type="button" onClick={() => onNavigate?.('seguranca_conta')}>Abrir Segurança da Conta <ChevronRight size={16} /></button>
      </section>
    </div>
  );
}
