/**
 * Módulo: frontend/src/pages/LandingPage/LandingPage.jsx
 * Responsabilidade: Implementa a tela Landing Page, seus estados, interações e integrações de dados.
 */

import React from 'react';
import {
  ShieldCheck, Activity, Server, LogIn, UserPlus, Building2,
  ArrowRight, CheckCircle2, BarChart3, Database, Network, Radio,
  PlayCircle, Volume2, Captions, MonitorDot
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import LegalLink from '../../components/LegalModal';
import './LandingPage.css';

const capabilities = [
  { icon: Activity, title: 'Telemetria operacional', text: 'Acompanhe temperatura, umidade e estado dos equipamentos em tempo real.' },
  { icon: ShieldCheck, title: 'Resposta coordenada', text: 'Transforme desvios em alertas, chamados e ações rastreáveis.' },
  { icon: Server, title: 'Gestão centralizada', text: 'Organize empresas, lojas e ativos em uma única visão operacional.' },
  { icon: BarChart3, title: 'Histórico confiável', text: 'Consulte tendências, ocorrências e evidências para orientar cada decisão.' }
];

const institutionalChapters = [
  { time: '00:00', title: 'Visão geral', text: 'O propósito da plataforma e o fluxo completo da operação.' },
  { time: '00:16', title: 'Painel operacional', text: 'Indicadores e fila de equipamentos organizados por prioridade.' },
  { time: '00:26', title: 'Monitoramento', text: 'Leitura atual, faixa configurada e tendência de cada ativo.' },
  { time: '00:35', title: 'Alertas e chamados', text: 'Do desvio detectado até a ação registrada pela equipe.' },
  { time: '00:45', title: 'Relatórios', text: 'Histórico, conformidade e evidências para gestão e auditoria.' }
];

/**
 * Player institucional hospedado no próprio produto.
 * O vídeo usa telas demonstrativas dos módulos reais e dados fictícios, evitando
 * que informações de clientes sejam incorporadas a um material público. A faixa
 * WebVTT permite acompanhar toda a explicação mesmo com o áudio desativado.
 */
function InstitutionalVideo({ onStartTrial }) {
  return (
    <section className="public-institutional" id="demonstracao" aria-labelledby="institutional-title">
      <header className="public-section-head">
        <span>Vídeo institucional</span>
        <h2 id="institutional-title">Entenda o sistema e veja as telas em funcionamento</h2>
        <p>Em pouco mais de um minuto, acompanhe o caminho entre a leitura do equipamento, a resposta da equipe e os relatórios da operação.</p>
      </header>

      <div className="public-video-layout">
        <div className="public-video-player">
          <video controls playsInline preload="metadata" poster="/thermosync-video-poster.png" aria-label="Vídeo institucional: como funciona o ThermoSync">
            <source src="/thermosync-institucional.mp4" type="video/mp4" />
            <track default kind="captions" src="/thermosync-institucional.vtt" srcLang="pt-BR" label="Português" />
            Seu navegador não oferece suporte à reprodução deste vídeo.
          </video>
          <div className="public-video-meta" aria-label="Recursos do vídeo">
            <span><PlayCircle size={15} /> 1 minuto</span>
            <span><Volume2 size={15} /> Narração em português</span>
            <span><Captions size={15} /> Legendas disponíveis</span>
            <span><MonitorDot size={15} /> Telas demonstrativas</span>
          </div>
        </div>
        <aside className="public-video-guide" aria-label="Conteúdo do vídeo">
          <div>
            <span>O que você verá</span>
            <h3>Do sensor à decisão</h3>
            <p>As telas usam dados fictícios e preservam o fluxo real dos módulos.</p>
          </div>
          <ol>{institutionalChapters.map((chapter) => <li key={chapter.time}><time>{chapter.time}</time><div><strong>{chapter.title}</strong><small>{chapter.text}</small></div></li>)}</ol>
          <button className="public-video-cta" type="button" onClick={onStartTrial}>Explorar no teste gratuito <ArrowRight size={15} /></button>
        </aside>
      </div>
    </section>
  );
}

/**
 * Renderiza a tela Landing Page e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function LandingPage({ onNavigate }) {
  return (
    <div className="public-landing">
      <header className="public-nav">
        <button className="public-brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao início">
          <TermoSyncLogo size={36} color="var(--brand-core)" />
          <span><strong>ThermoSync</strong><small>Rede térmica sincronizada</small></span>
        </button>
        <nav aria-label="Navegação principal">
          <a href="#plataforma">Plataforma</a>
          <a href="#demonstracao">Demonstração</a>
          <a href="#fluxo">Como funciona</a>
          <button className="public-login" type="button" onClick={() => onNavigate('login')}><LogIn size={16} /> Entrar</button>
        </nav>
      </header>

      <main>
        <section className="public-hero">
          <img src="/landing-refrigerated-displays-v4.png" alt="Corredor de supermercado com expositores e ilhas refrigeradas" />
          <div className="public-hero-shade" />
          <div className="public-hero-content">
            <span className="public-eyebrow"><Radio size={15} /> Monitoramento IoT para cadeia fria</span>
            <h1>ThermoSync</h1>
            <p>Transforme leituras de temperatura, umidade e equipamentos em uma operação refrigerada mais previsível, rastreável e rápida para responder.</p>
            <div className="public-hero-actions">
              <button className="public-primary" type="button" onClick={() => onNavigate('trial')}><UserPlus size={18} /> Iniciar teste gratuito <ArrowRight size={16} /></button>
              <button className="public-secondary" type="button" onClick={() => onNavigate('register')}><Building2 size={18} /> Contratar o sistema</button>
            </div>
            <div className="public-hero-proof">
              <span><CheckCircle2 size={15} /> Telemetria em tempo real</span>
              <span><CheckCircle2 size={15} /> Histórico operacional</span>
              <span><CheckCircle2 size={15} /> Gestão por organização e loja</span>
            </div>
          </div>
        </section>

        <section className="public-capabilities" id="plataforma">
          <header className="public-section-head">
            <span>Operação conectada</span>
            <h2>Do sensor à decisão, sem perder o contexto</h2>
            <p>A plataforma reúne monitoramento, resposta e gestão para equipes que precisam acompanhar muitos ativos e unidades.</p>
          </header>
          <div className="public-capability-grid">
            {capabilities.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={20} /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </section>

        <InstitutionalVideo onStartTrial={() => onNavigate('trial')} />

        <section className="public-flow" id="fluxo">
          <div className="public-flow-copy">
            <span className="public-section-kicker">Arquitetura operacional</span>
            <h2>Uma linha contínua entre campo e central</h2>
            <p>As leituras saem da infraestrutura refrigerada, passam pela camada de ingestão e chegam às equipes com histórico, alertas e contexto para investigação.</p>
            <button type="button" className="public-text-action" onClick={() => onNavigate('register')}>Solicitar implantação definitiva <ArrowRight size={16} /></button>
          </div>
          <div className="public-flow-steps">
            <article><span>01</span><Network size={21} /><div><strong>Coleta na borda</strong><small>Sensores e controladores enviam as leituras dos ativos.</small></div></article>
            <article><span>02</span><Database size={21} /><div><strong>Ingestão e histórico</strong><small>Os dados são organizados por empresa, loja e equipamento.</small></div></article>
            <article><span>03</span><Activity size={21} /><div><strong>Monitoramento</strong><small>Painéis e alertas mostram mudanças que exigem atenção.</small></div></article>
            <article><span>04</span><ShieldCheck size={21} /><div><strong>Resposta rastreável</strong><small>Chamados, checklists e relatórios registram a atuação.</small></div></article>
          </div>
        </section>

        <section className="public-final-cta">
          <div><span>Pronto para estruturar o monitoramento?</span><h2>Solicite uma avaliação para sua operação.</h2><p>Informe os dados essenciais da organização. A equipe analisará o cenário antes de liberar o acesso.</p></div>
          <div className="public-final-actions"><button className="public-primary" type="button" onClick={() => onNavigate('register')}>Solicitar contratação <ArrowRight size={17} /></button><button className="public-secondary" type="button" onClick={() => onNavigate('trial')}>Conhecer com teste gratuito</button></div>
        </section>
      </main>

      <footer className="public-footer">
        <span>© 2026 ThermoSync</span>
        <span>Monitoramento operacional para ambientes refrigerados</span>
        <nav aria-label="Links legais e acesso"><LegalLink type="terms" asButton>Termos de Uso</LegalLink><LegalLink type="privacy" asButton>Política de Privacidade</LegalLink><button type="button" onClick={() => onNavigate('login')}>Acesso de clientes</button></nav>
      </footer>
    </div>
  );
}
