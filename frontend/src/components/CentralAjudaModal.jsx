/**
 * Módulo: frontend/src/components/CentralAjudaModal.jsx
 * Responsabilidade: Implementa o componente reutilizável Central Ajuda Modal e seu contrato visual.
 */

import { useMemo } from 'react';
import { CalendarDays, FileText, Loader, UserRound } from 'lucide-react';
import EmptyState from './EmptyState';
import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, X, Search } from 'lucide-react';
import './CentralAjudaModal.css';

/**
 * Renderiza o componente Central Ajuda Modal e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; registra ou remove listeners de eventos
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {boolean} props.isOpen - Sinalizador isOpen que controla este comportamento visual.
 * @param {Function} props.onClose - Callback onClose fornecido pelo componente responsável.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function CentralAjudaModal({ isOpen, onClose, api }) {
  const [tab, setTab] = useState('articles');
  const [articles, setArticles] = useState([]);
  const [changelog, setChangelog] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    const requestTimer = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        api.get('/suporte/artigos').catch(() => ({ data: [] })),
        api.get('/system/changelog').catch(() => ({ data: [] }))
      ]).then(([articleResponse, changelogResponse]) => {
        if (!active) return;
        setArticles(Array.isArray(articleResponse.data) ? articleResponse.data : []);
        setChangelog(Array.isArray(changelogResponse.data) ? changelogResponse.data : []);
      }).finally(() => { if (active) setLoading(false); });
    }, 0);


    /**
     * Renderiza o componente handle Escape e encapsula sua interacao visual reutilizavel.
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
    const handleEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => { active = false; window.clearTimeout(requestTimer); window.removeEventListener('keydown', handleEscape); };
  }, [api, isOpen, onClose]);

  const filteredArticles = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return articles;
    return articles.filter((article) => `${article.titulo || ''} ${article.conteudo || ''} ${article.categoria || ''}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [articles, search]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay help-center-overlay" onClick={onClose}>
      <section className="help-center-modal" role="dialog" aria-modal="true" aria-labelledby="help-center-title" onClick={(event) => event.stopPropagation()}>
        <header className="help-center-header">
          <span className="help-center-heading-icon"><BookOpen size={20} /></span>
          <div><span>Suporte e documentação</span><h2 id="help-center-title">Central de Conhecimento</h2><p>Procedimentos operacionais e histórico de evolução da plataforma.</p></div>
          <button type="button" onClick={onClose} title="Fechar central" aria-label="Fechar central"><X size={18} /></button>
        </header>

        <div className="help-center-controls">
          <div className="help-center-tabs" role="tablist" aria-label="Conteúdo da central">
            <button type="button" role="tab" aria-selected={tab === 'articles'} className={tab === 'articles' ? 'active' : ''} onClick={() => setTab('articles')}><FileText size={15} /><span>Artigos</span><small>{articles.length}</small></button>
            <button type="button" role="tab" aria-selected={tab === 'changelog'} className={tab === 'changelog' ? 'active' : ''} onClick={() => setTab('changelog')}><History size={15} /><span>Notas de versão</span><small>{changelog.length}</small></button>
          </div>
          {tab === 'articles' && <label className="help-center-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar título, categoria ou conteúdo" />{search && <button type="button" onClick={() => setSearch('')} title="Limpar pesquisa"><X size={13} /></button>}</label>}
        </div>

        <div className="help-center-body">
          {loading ? <Loader message="Carregando base de conhecimento..." size={42} /> : tab === 'articles' ? (
            filteredArticles.length ? <div className="help-article-list">{filteredArticles.map((article) => <article className="help-article" key={article.id}><header><span><FileText size={15} /></span><div><small>{article.categoria || 'Geral'}</small><h3>{article.titulo || 'Artigo sem título'}</h3></div></header><p>{article.conteudo || 'Conteúdo não informado.'}</p></article>)}</div> : <EmptyState icon={Search} title="Nenhum artigo encontrado" description="Revise os termos da pesquisa ou consulte outra categoria da central." actionLabel={search ? 'Limpar pesquisa' : ''} onAction={() => setSearch('')} />
          ) : (
            changelog.length ? <div className="help-release-list">{changelog.map((release, index) => <article className="help-release" key={release.id}><span className="help-release-track"><i />{index < changelog.length - 1 && <b />}</span><div><header><span><Sparkles size={13} />{release.version || 'Versão'}</span><time><CalendarDays size={13} />{release.date ? new Date(release.date).toLocaleDateString('pt-BR') : 'Data não informada'}</time></header><h3>{release.title || 'Atualização da plataforma'}</h3><p>{release.desc_text || 'Sem detalhes adicionais.'}</p><small><UserRound size={12} />{release.author || 'Equipe ThermoSync'}</small></div></article>)}</div> : <EmptyState icon={History} title="Histórico ainda vazio" description="As próximas publicações de versão aparecerão neste espaço." />
          )}
        </div>

        <footer className="help-center-footer"><span>{tab === 'articles' ? `${filteredArticles.length} artigo(s) disponível(is)` : `${changelog.length} versão(ões) publicada(s)`}</span><button type="button" onClick={onClose}>Fechar</button></footer>
      </section>
    </div>
  );
}
