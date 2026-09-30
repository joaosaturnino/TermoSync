/**
 * Módulo: frontend/src/pages/Documentacao/Documentacao.jsx
 * Responsabilidade: Implementa a tela Documentacao, seus estados, interações e integrações de dados.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, FileText, LifeBuoy, Search, Settings, ShieldCheck, Wrench, X } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import './Documentacao.css';

const DOCUMENTS = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros passos',
    summary: 'Configure o escopo e confirme os principais indicadores antes de iniciar a operação.',
    category: 'Operação',
    roles: ['DEV', 'ADMIN', 'LOJA', 'MANUTENCAO'],
    icon: CheckCircle2,
    target: 'dashboard',
    steps: ['Confirme a empresa e a filial selecionadas.', 'Revise os equipamentos e alertas ativos.', 'Abra a fila operacional para tratar ocorrências pendentes.']
  },
  {
    id: 'tratamento-alertas',
    title: 'Tratamento de alertas',
    summary: 'Organize a análise, o reconhecimento e o encaminhamento de ocorrências.',
    category: 'Operação',
    roles: ['DEV', 'ADMIN', 'LOJA', 'MANUTENCAO'],
    icon: Wrench,
    target: 'central_acoes',
    steps: ['Priorize alertas críticos e confirme a leitura atual.', 'Registre a ação executada e o responsável.', 'Crie ou associe um chamado quando houver intervenção técnica.']
  },
  {
    id: 'seguranca-acesso',
    title: 'Segurança e acesso',
    summary: 'Revise sessões, autenticação e permissões dos usuários da plataforma.',
    category: 'Administração',
    roles: ['DEV', 'ADMIN'],
    icon: ShieldCheck,
    target: 'seguranca_conta',
    steps: ['Confirme o perfil e o escopo de cada usuário.', 'Revogue sessões que não sejam reconhecidas.', 'Ative MFA para contas com acesso administrativo.']
  },
  {
    id: 'parametros-globais',
    title: 'Parâmetros globais',
    summary: 'Altere configurações compartilhadas com validação de impacto e rastreabilidade.',
    category: 'Desenvolvimento',
    roles: ['DEV'],
    icon: Settings,
    target: 'parametros_globais',
    steps: ['Registre o valor atual antes da alteração.', 'Valide o impacto nos ambientes e integrações.', 'Aplique a mudança e confirme o resultado na auditoria.']
  }
];
/**
 * Módulo: frontend/src/pages/Documentacao/Documentacao.jsx
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
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Documentacao({ userRole, onNavigate, showToast }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selectedId, setSelectedId] = useState('primeiros-passos');
  const allowedDocuments = useMemo(() => DOCUMENTS.filter((document) => document.roles.includes(userRole)), [userRole]);
  const categories = useMemo(() => ['Todos', ...new Set(allowedDocuments.map((document) => document.category))], [allowedDocuments]);
  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return allowedDocuments.filter((document) => (category === 'Todos' || document.category === category) && (!term || `${document.title} ${document.summary} ${document.steps.join(' ')}`.toLocaleLowerCase('pt-BR').includes(term)));
  }, [allowedDocuments, category, search]);
  const selectedDocument = filteredDocuments.find((document) => document.id === selectedId) || filteredDocuments[0];


  /**
   * Processa a interacao de copy article e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copyArticle = async () => {
    if (!selectedDocument) return;
    const content = `${selectedDocument.title}\n\n${selectedDocument.summary}\n\n${selectedDocument.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
    try { await navigator.clipboard.writeText(content); showToast?.('Conteúdo da documentação copiado.', 'success'); }
    catch { showToast?.('Não foi possível copiar neste navegador.', 'warning'); }
  };

  return (
    <div className="docs-page anim-fade-in">
      <section className="docs-heading">
        <div><span>Base oficial da plataforma</span><h2>Documentação ThermoSync</h2><p>Guias rápidos para operar, administrar e diagnosticar o sistema com segurança.</p></div>
        <div className="docs-heading-meta"><span><FileText size={15} /><strong>{allowedDocuments.length}</strong> guias disponíveis</span><button type="button" onClick={() => onNavigate?.('suporte')}><LifeBuoy size={15} /> Suporte técnico</button></div>
      </section>

      <section className="docs-toolbar">
        <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar na documentação" />{search && <button type="button" onClick={() => setSearch('')} title="Limpar"><X size={13} /></button>}</label>
        <div className="docs-categories" role="tablist" aria-label="Categorias">{categories.map((item) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
      </section>

      {filteredDocuments.length ? <section className="docs-workspace">
        <nav className="docs-index" aria-label="Artigos encontrados">{filteredDocuments.map((document) => <button type="button" className={selectedDocument?.id === document.id ? 'active' : ''} onClick={() => setSelectedId(document.id)} key={document.id}><span><document.icon size={17} /></span><div><small>{document.category}</small><strong>{document.title}</strong><p>{document.summary}</p></div></button>)}</nav>
        <article className="docs-reader">
          <header><span className="docs-reader-icon"><selectedDocument.icon size={21} /></span><div><small>{selectedDocument.category}</small><h3>{selectedDocument.title}</h3><p>{selectedDocument.summary}</p></div><button type="button" onClick={copyArticle} title="Copiar artigo"><Clipboard size={16} /></button></header>
          <div className="docs-steps"><h4>Procedimento recomendado</h4>{selectedDocument.steps.map((step, index) => <div key={step}><span>{index + 1}</span><p>{step}</p><CheckCircle2 size={16} /></div>)}</div>
          <footer><span>Este guia considera as permissões do perfil {userRole}.</span><button type="button" onClick={() => onNavigate?.(selectedDocument.target)}>Abrir módulo relacionado</button></footer>
        </article>
      </section> : <EmptyState icon={Search} title="Nenhum guia encontrado" description="Revise o termo pesquisado ou selecione outra categoria." actionLabel="Limpar filtros" onAction={() => { setSearch(''); setCategory('Todos'); }} />}
    </div>
  );
}
