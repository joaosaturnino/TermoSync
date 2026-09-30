/**
 * Módulo: frontend/src/pages/Sobre/Sobre.jsx
 * Responsabilidade: Implementa a tela Sobre, seus estados, interações e integrações de dados.
 */

import { useMemo } from 'react';
import { BookOpen, Boxes, CloudCog, Code2, ExternalLink, Layers3, LifeBuoy, LockKeyhole } from 'lucide-react';
import React, { useState } from 'react';
import {
  ShieldCheck, Database, Server, GraduationCap,
  Github, Layers, Activity,
  Fingerprint, Cpu, Network, Radio, TerminalSquare,
  ArrowRight, Wifi, Zap
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import './Sobre.css';

const ARCHITECTURE_STEPS = [
  { icon: Cpu, label: 'Sensores', detail: 'Leituras em campo' },
  { icon: Wifi, label: 'Conectividade', detail: 'Wi-Fi e MQTT' },
  { icon: Server, label: 'Serviços', detail: 'API e processamento' },
  { icon: Database, label: 'Dados', detail: 'Histórico e auditoria' },
  { icon: Activity, label: 'Operação', detail: 'Painéis e alertas' }
];

const PLATFORM_AREAS = {
  operacao: {
    label: 'Operação',
    description: 'Acompanhe o parque refrigerado e transforme eventos de campo em ações rastreáveis.',
    modules: [
      { icon: Activity, title: 'Monitoramento', text: 'Indicadores, leituras e estado dos equipamentos em tempo real.' },
      { icon: Zap, title: 'Fila operacional', text: 'Priorização de alertas, tarefas e ocorrências que exigem resposta.' },
      { icon: LifeBuoy, title: 'Suporte', text: 'Abertura e acompanhamento de chamados técnicos.' }
    ]
  },
  gestao: {
    label: 'Gestão',
    description: 'Consolide dados de unidades, ativos e consumo para apoiar decisões operacionais.',
    modules: [
      { icon: Layers, title: 'Visão consolidada', text: 'Comparação de unidades e acompanhamento do desempenho da frota.' },
      { icon: CloudCog, title: 'Configuração', text: 'Parâmetros e integrações organizados pelo escopo correto.' },
      { icon: ShieldCheck, title: 'Governança', text: 'Permissões, auditoria e histórico das ações executadas.' }
    ]
  },
  tecnologia: {
    label: 'Tecnologia',
    description: 'Ferramentas de diagnóstico preservam a disponibilidade e aceleram a investigação de falhas.',
    modules: [
      { icon: Network, title: 'Rede e dispositivos', text: 'Diagnóstico de conectividade entre sensores, gateways e serviços.' },
      { icon: TerminalSquare, title: 'Observabilidade', text: 'Saúde, logs e contexto técnico para manutenção do ambiente.' },
      { icon: Fingerprint, title: 'Segurança', text: 'Controles de acesso e rastreabilidade para operações privilegiadas.' }
    ]
  }
};

/**
 * Renderiza a tela Sobre e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; publica ou consome mensagens MQTT
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Sobre({ onNavigate, isOffline = false, userRole = 'LOJA' }) {
  const [activeArea, setActiveArea] = useState('operacao');
  const area = PLATFORM_AREAS[activeArea];
  const version = import.meta.env.VITE_APP_VERSION || '1.5';
  const environment = import.meta.env.MODE === 'production' ? 'Produção' : 'Desenvolvimento';

  const availableActions = useMemo(() => [
    { label: 'Abrir suporte', description: 'Criar e acompanhar solicitações.', icon: LifeBuoy, target: 'suporte' },
    { label: 'Segurança da conta', description: 'Revisar MFA, senha e sessões.', icon: LockKeyhole, target: 'seguranca_conta' },
    ...(userRole === 'DEV' ? [{ label: 'Saúde do sistema', description: 'Inspecionar serviços e runtime.', icon: Activity, target: 'central_saude' }] : [])
  ], [userRole]);

  return (
    <div className="about-platform anim-fade-in">
      <section className="about-overview">
        <div className="about-brand-mark"><TermoSyncLogo size={64} color="var(--primary)" /></div>
        <div className="about-overview-copy">
          <span className="about-kicker">Plataforma de monitoramento IoT</span>
          <h2>ThermoSync</h2>
          <p>Uma plataforma para observar ambientes refrigerados, coordenar a operação e conectar telemetria de campo às decisões da equipe.</p>
          <div className="about-badges">
            <span><Code2 size={14} /> Versão {version}</span>
            <span><CloudCog size={14} /> {environment}</span>
            <span className={isOffline ? 'offline' : 'online'}><Radio size={14} /> {isOffline ? 'Sem conexão' : 'Conectado'}</span>
          </div>
        </div>
        <div className="about-overview-actions">
          <button className="btn btn-primary" onClick={() => onNavigate?.('dashboard')}><Activity size={16} /> Abrir dashboard</button>
          <button className="btn btn-outline" onClick={() => onNavigate?.('suporte')}><LifeBuoy size={16} /> Obter suporte</button>
        </div>
      </section>

      <section className="about-principles" aria-label="Pilares da plataforma">
        <article><Radio size={19} /><div><strong>Tempo real</strong><span>Eventos e telemetria distribuídos para as telas operacionais.</span></div></article>
        <article><Layers3 size={19} /><div><strong>Contexto único</strong><span>Ativos, lojas, chamados e auditoria conectados no mesmo fluxo.</span></div></article>
        <article><ShieldCheck size={19} /><div><strong>Rastreabilidade</strong><span>Histórico para investigar eventos e acompanhar intervenções.</span></div></article>
        <article><Boxes size={19} /><div><strong>Multiempresa</strong><span>Escopos separados por organização, filial e perfil de acesso.</span></div></article>
      </section>

      <section className="about-panel">
        <header className="about-section-head"><div><span>Arquitetura</span><h3>Como os dados percorrem o sistema</h3><p>Da leitura física até a visualização e resposta operacional.</p></div></header>
        <div className="about-architecture">
          {ARCHITECTURE_STEPS.map(({ icon: Icon, label, detail }, index) => (
            <React.Fragment key={label}>
              <article><span><Icon size={20} /></span><strong>{label}</strong><small>{detail}</small></article>
              {index < ARCHITECTURE_STEPS.length - 1 && <ArrowRight className="about-flow-arrow" size={18} />}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="about-capabilities">
        <div className="about-capability-nav">
          <div className="about-section-head"><span>Capacidades</span><h3>Uma plataforma, três frentes</h3><p>Selecione uma área para conhecer o papel de cada conjunto de ferramentas.</p></div>
          <div className="about-tabs" role="tablist">
            {Object.entries(PLATFORM_AREAS).map(([key, item]) => <button key={key} role="tab" aria-selected={activeArea === key} className={activeArea === key ? 'active' : ''} onClick={() => setActiveArea(key)}>{item.label}</button>)}
          </div>
        </div>
        <div className="about-capability-content">
          <p>{area.description}</p>
          <div className="about-module-grid">
            {area.modules.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={19} /></span><div><strong>{title}</strong><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <div className="about-lower-grid">
        <section className="about-panel">
          <header className="about-section-head"><div><span>Tecnologia</span><h3>Base técnica</h3><p>Componentes principais que sustentam a aplicação.</p></div></header>
          <div className="about-stack-list">
            <div><span>Interface</span><strong>React + Vite</strong><small>Aplicação responsiva web e Capacitor</small></div>
            <div><span>Serviços</span><strong>Node.js + Express</strong><small>APIs, autenticação e integrações</small></div>
            <div><span>Dados</span><strong>MySQL</strong><small>Persistência transacional e histórica</small></div>
            <div><span>Tempo real</span><strong>Socket.IO + MQTT</strong><small>Eventos do sistema e ingestão IoT</small></div>
          </div>
        </section>

        <section className="about-panel">
          <header className="about-section-head"><div><span>Próximos passos</span><h3>Encontre o lugar certo</h3><p>Acesse diretamente controles relacionados à plataforma.</p></div></header>
          <div className="about-action-list">
            {availableActions.map(({ label, description, icon: Icon, target }) => <button key={target} onClick={() => onNavigate?.(target)}><span><Icon size={18} /></span><div><strong>{label}</strong><small>{description}</small></div><ArrowRight size={15} /></button>)}
          </div>
        </section>
      </div>

      <section className="about-authorship">
        <div className="about-author-icon"><GraduationCap size={23} /></div>
        <div><span className="about-kicker">Engenharia e autoria</span><h3>João Henrique</h3><p>Projeto desenvolvido a partir de uma necessidade operacional e evoluído como Trabalho de Conclusão de Curso em Redes de Computadores.</p></div>
        <div className="about-socials">
          <a href="https://github.com/joaosaturnino" target="_blank" rel="noopener noreferrer"><Github size={16} /> GitHub <ExternalLink size={13} /></a>
          <a href="https://www.linkedin.com/in/jo%C3%A3o-henrique-00288621a/" target="_blank" rel="noopener noreferrer"><BookOpen size={16} /> LinkedIn <ExternalLink size={13} /></a>
        </div>
      </section>
    </div>
  );
}
