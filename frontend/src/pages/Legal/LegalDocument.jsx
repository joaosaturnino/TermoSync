/**
 * Módulo: documentos jurídicos públicos do ThermoSync.
 *
 * Mantém Termos de Uso e Política de Privacidade em uma única estrutura visual,
 * mas com conteúdo independente. O texto diferencia o papel do ThermoSync como
 * controlador dos seus próprios cadastros e como operador dos dados inseridos
 * pelas organizações clientes, uma distinção importante para serviços SaaS B2B.
 */
import {
  ArrowLeft, BookOpenCheck, Building2, Database, FileCheck2,
  LockKeyhole, Printer, Scale, ShieldCheck
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import './LegalDocument.css';

const LAST_UPDATED = '30 de setembro de 2026';
// O canal pode ser substituído por ambiente sem exigir alteração no documento.
const LEGAL_EMAIL = import.meta.env.VITE_LEGAL_CONTACT_EMAIL || 'privacidade@thermosync.com.br';

const termsSections = [
  {
    id: 'aceitacao',
    title: '1. Aceitação e documentos aplicáveis',
    body: <><p>Estes Termos regulam o acesso e o uso da plataforma ThermoSync, incluindo seus painéis, aplicativos, APIs, recursos de telemetria, alertas, chamados, relatórios, ambientes de demonstração e integrações.</p><p>Ao criar uma conta, solicitar um teste, acessar a plataforma ou utilizá-la em nome de uma organização, o usuário declara ter capacidade para aceitar estes Termos. Proposta comercial, pedido, plano contratado, política de privacidade e acordo específico integram a relação. Em caso de divergência, prevalece o documento específico assinado entre as partes.</p></>
  },
  {
    id: 'servico',
    title: '2. Serviço e finalidade',
    body: <><p>O ThermoSync auxilia no acompanhamento de ambientes refrigerados, equipamentos, telemetria e fluxos operacionais. Os recursos disponíveis dependem do perfil, plano, escopo contratado, integrações habilitadas e infraestrutura instalada.</p><div className="legal-callout warning"><strong>Limite operacional importante</strong><span>A plataforma é uma ferramenta de apoio. Ela não substitui inspeções presenciais, procedimentos de segurança, equipamentos certificados, calibração metrológica nem sistemas locais obrigatórios de alarme e contingência.</span></div></>
  },
  {
    id: 'contas',
    title: '3. Contas, perfis e credenciais',
    body: <ul><li>A organização deve manter usuários, filiais, funções e permissões atualizados.</li><li>Cada credencial é individual e não deve ser compartilhada.</li><li>O usuário deve adotar senha forte, proteger os dispositivos utilizados e comunicar suspeitas de acesso indevido.</li><li>Ações realizadas por uma sessão autenticada poderão ser registradas para segurança e auditoria.</li><li>O administrador da organização é responsável por autorizar, revisar e revogar os acessos da sua equipe.</li></ul>
  },
  {
    id: 'teste',
    title: '4. Teste gratuito e demonstração',
    body: <><p>O teste gratuito é separado do cadastro definitivo. Seu prazo, limites e funcionalidades são informados na aprovação. O ambiente pode utilizar equipamentos, alertas e telemetria virtuais, sem instalação física.</p><p>Contas de teste podem ser pausadas, encerradas ou convertidas em contratação definitiva ao final do período. Salvo indicação expressa, o teste não cria cobrança automática. Dados demonstrativos podem ser restaurados ou removidos durante a manutenção do ambiente.</p></>
  },
  {
    id: 'uso-aceitavel',
    title: '5. Uso aceitável',
    body: <><p>É proibido utilizar o serviço para:</p><ul><li>violar leis, direitos de terceiros ou regras de segurança;</li><li>acessar contas, empresas, filiais, APIs ou dispositivos sem autorização;</li><li>interferir na disponibilidade, testar vulnerabilidades sem permissão ou contornar controles de acesso;</li><li>enviar código malicioso, telemetria fraudulenta ou carga incompatível com o plano;</li><li>copiar, desmontar, explorar ou revender a plataforma fora do que estiver contratado;</li><li>inserir conteúdo ilícito ou dados pessoais sem base legal e necessidade operacional.</li></ul></>
  },
  {
    id: 'responsabilidades',
    title: '6. Responsabilidades da organização',
    body: <><p>A organização contratante responde pela legitimidade dos dados e comandos inseridos por seus usuários, pela configuração das faixas operacionais, pela conectividade local, pela manutenção dos equipamentos físicos e pela execução dos procedimentos indicados para incidentes.</p><p>Também deve informar seus usuários sobre o tratamento de dados realizado no contexto de trabalho e definir as bases legais, prazos e autorizações aplicáveis às informações que controla.</p></>
  },
  {
    id: 'disponibilidade',
    title: '7. Disponibilidade, manutenção e integrações',
    body: <><p>O ThermoSync busca manter o serviço disponível e seguro, mas poderá realizar manutenções, correções emergenciais e atualizações. Condições específicas de suporte, disponibilidade e atendimento constarão do plano ou contrato.</p><p>Falhas de internet, energia, sensores, gateways, serviços de terceiros ou configurações locais podem atrasar leituras e alertas. Integrações externas seguem também os termos dos respectivos fornecedores.</p></>
  },
  {
    id: 'propriedade',
    title: '8. Propriedade intelectual',
    body: <><p>A plataforma, sua marca, código, documentação, interfaces e componentes são protegidos pela legislação aplicável. O acesso concede somente uma licença limitada, revogável, não exclusiva e intransferível durante a vigência autorizada.</p><p>A organização permanece titular dos dados operacionais que inserir ou gerar por meio de seus equipamentos, sem prejuízo dos tratamentos técnicos necessários para prestar, proteger e melhorar o serviço.</p></>
  },
  {
    id: 'dados',
    title: '9. Privacidade, segurança e confidencialidade',
    body: <><p>O tratamento de dados pessoais segue a Política de Privacidade. As partes devem preservar informações confidenciais e adotar controles compatíveis com seu papel, incluindo gestão de acesso, atualização de sistemas e resposta a incidentes.</p><p>O ThermoSync poderá produzir métricas agregadas ou anonimizadas que não permitam identificar pessoa natural ou organização, para segurança, capacidade e evolução do produto.</p></>
  },
  {
    id: 'pagamento',
    title: '10. Planos, pagamento e renovação',
    body: <><p>Valores, impostos, vencimentos, franquias, reajustes e regras de renovação são definidos na proposta, fatura ou contrato. A inadimplência pode resultar em limitação ou suspensão, após os avisos e prazos aplicáveis.</p><p>Recursos adicionais, equipamentos, instalação, deslocamento e serviços profissionais somente serão cobrados quando previstos na contratação.</p></>
  },
  {
    id: 'suspensao',
    title: '11. Suspensão e encerramento',
    body: <><p>O acesso pode ser suspenso por risco de segurança, uso proibido, determinação legal, término do teste ou descumprimento contratual. Quando possível, a organização será informada e terá oportunidade de corrigir a situação.</p><p>Após o encerramento, a exportação e a eliminação dos dados seguirão o contrato, a Política de Privacidade e os prazos necessários ao cumprimento de obrigações legais, exercício de direitos e segurança.</p></>
  },
  {
    id: 'responsabilidade',
    title: '12. Garantias e responsabilidade',
    body: <><p>As partes respondem nos limites da legislação e do contrato aplicável. O ThermoSync não garante que conectividade, sensores ou serviços de terceiros funcionarão sem interrupções, nem responde por decisões tomadas sem a validação operacional adequada.</p><p>Nada nestes Termos exclui responsabilidade que não possa ser limitada por lei, direitos do consumidor quando aplicáveis, deveres de proteção de dados ou obrigações expressamente assumidas em contrato.</p></>
  },
  {
    id: 'alteracoes-foro',
    title: '13. Alterações, legislação e contato',
    body: <><p>Estes Termos podem ser atualizados para refletir mudanças legais, técnicas ou comerciais. Alterações relevantes serão comunicadas pelos canais disponíveis. O uso continuado após a vigência da nova versão observará os requisitos legais aplicáveis.</p><p>Aplica-se a legislação brasileira. O foro e o procedimento de solução de conflitos serão os definidos no contrato ou, na ausência dele, aqueles estabelecidos pela legislação aplicável.</p><p>Dúvidas jurídicas ou de privacidade podem ser encaminhadas para <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.</p></>
  }
];

const privacySections = [
  {
    id: 'escopo',
    title: '1. Escopo e agentes de tratamento',
    body: <><p>Esta Política explica como dados pessoais são tratados no site, no pré-cadastro, no teste gratuito, na plataforma ThermoSync e nos canais de suporte.</p><p>Para cadastro comercial, faturamento, segurança da própria plataforma e relacionamento, o fornecedor ThermoSync atua como controlador. Para dados de usuários, colaboradores e contatos inseridos pela organização cliente durante a operação, a organização normalmente atua como controladora e o ThermoSync como operador, conforme suas instruções e o contrato.</p><div className="legal-callout"><strong>Identificação contratual</strong><span>A razão social, o CNPJ e o endereço do fornecedor responsável constam da proposta, pedido, fatura ou contrato aplicável à organização.</span></div></>
  },
  {
    id: 'dados-coletados',
    title: '2. Dados pessoais tratados',
    body: <div className="legal-data-grid"><article><strong>Cadastro e contato</strong><span>Nome, empresa, CNPJ, e-mail, telefone, cargo e dados do responsável.</span></article><article><strong>Conta e segurança</strong><span>Usuário, perfil, filial, credenciais protegidas, MFA, IP, sessões e registros de acesso.</span></article><article><strong>Uso e suporte</strong><span>Telas acessadas, ações, preferências, chamados, mensagens e evidências enviadas.</span></article><article><strong>Operação IoT</strong><span>Identificadores dos ativos, localização operacional, telemetria, alertas e histórico técnico.</span></article><article><strong>Comercial e financeiro</strong><span>Plano, cobrança, vencimentos, status contratual e registros de atendimento.</span></article><article><strong>Dados técnicos</strong><span>Navegador, dispositivo, versão, desempenho, erros, disponibilidade e eventos de segurança.</span></article></div>
  },
  {
    id: 'fontes',
    title: '3. Como os dados são obtidos',
    body: <ul><li>diretamente do titular ou do responsável pela organização;</li><li>por administradores que cadastram usuários e unidades;</li><li>automaticamente durante o uso, autenticação e diagnóstico;</li><li>por sensores, gateways, controladores e integrações autorizadas;</li><li>por canais de atendimento, fornecedores e fontes legítimas necessárias à contratação.</li></ul>
  },
  {
    id: 'finalidades',
    title: '4. Finalidades e bases legais',
    body: <><p>Os dados podem ser tratados para executar contrato e procedimentos preliminares; autenticar usuários; entregar telemetria, alertas e suporte; cumprir obrigações legais; exercer direitos; prevenir fraude; proteger a plataforma; e atender interesses legítimos após avaliação de necessidade e impacto.</p><p>Quando o consentimento for a base adequada, ele será solicitado de forma específica e poderá ser revogado. A revogação não invalida tratamentos anteriores nem impede atividades sustentadas por outra base legal.</p></>
  },
  {
    id: 'compartilhamento',
    title: '5. Compartilhamento e operadores',
    body: <><p>Dados podem ser compartilhados, no limite necessário, com provedores de hospedagem e banco de dados, envio de e-mail e mensagens, monitoramento de segurança, suporte técnico, cobrança, consultoria profissional e autoridades legalmente competentes.</p><p>Fornecedores devem receber apenas os dados necessários e estar sujeitos a obrigações de segurança e confidencialidade. A lista ou as categorias de operadores poderão ser atualizadas conforme a arquitetura do serviço evoluir.</p></>
  },
  {
    id: 'transferencia',
    title: '6. Transferência e localização',
    body: <p>Alguns fornecedores podem processar dados fora do Brasil. Nessas situações, serão adotados mecanismos permitidos pela LGPD e medidas contratuais e técnicas compatíveis com o risco. Informações sobre operações específicas podem ser solicitadas pelo canal de privacidade.</p>
  },
  {
    id: 'retencao',
    title: '7. Retenção e eliminação',
    body: <><p>Os dados permanecem pelo tempo necessário às finalidades informadas, à vigência da conta ou do contrato e aos prazos legais, de auditoria, segurança e exercício de direitos. Os prazos podem variar por categoria e configuração contratual.</p><div className="legal-retention"><span><strong>Pré-cadastro</strong><small>Até a conclusão da análise e pelo período necessário para registrar o relacionamento.</small></span><span><strong>Conta e contrato</strong><small>Durante a relação e pelos prazos legais aplicáveis após seu término.</small></span><span><strong>Telemetria e auditoria</strong><small>Conforme a janela contratada, requisitos técnicos e obrigações de rastreabilidade.</small></span><span><strong>Backups</strong><small>Eliminados de acordo com o ciclo seguro de retenção e substituição.</small></span></div></>
  },
  {
    id: 'seguranca',
    title: '8. Segurança e incidentes',
    body: <><p>São adotados controles administrativos e técnicos, como segregação por organização, perfis de acesso, proteção de credenciais, registros de auditoria, monitoramento, backups e comunicação protegida. Nenhum ambiente é isento de risco, por isso os controles são revistos continuamente.</p><p>Incidentes relevantes serão avaliados e comunicados aos envolvidos e à ANPD quando exigido pela legislação e pela regulamentação aplicável.</p></>
  },
  {
    id: 'direitos',
    title: '9. Direitos do titular',
    body: <><p>Nos termos da LGPD, o titular pode solicitar confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação quando cabível, portabilidade conforme regulamentação, informação sobre compartilhamentos, revisão de decisões automatizadas e revogação do consentimento.</p><p>Antes de responder, poderá ser necessário confirmar a identidade e o vínculo com a organização. Alguns pedidos podem ser limitados por obrigação legal, segurança, segredo comercial ou necessidade de preservar direitos de terceiros. Quando a organização cliente for a controladora, o pedido poderá ser direcionado a ela.</p></>
  },
  {
    id: 'cookies',
    title: '10. Cookies e armazenamento local',
    body: <><p>A plataforma utiliza armazenamento do navegador e tecnologias semelhantes para autenticação, segurança, preferências de interface, continuidade de sessão e diagnóstico. Recursos estritamente necessários permanecem ativos porque sustentam o funcionamento e a proteção da conta.</p><p>Preferências opcionais podem ser revistas na Central de Privacidade da plataforma. O bloqueio pelo navegador pode impedir login, personalização ou outras funcionalidades.</p></>
  },
  {
    id: 'menores',
    title: '11. Crianças e adolescentes',
    body: <p>O ThermoSync é uma solução empresarial e não é direcionado a crianças ou adolescentes. A organização não deve cadastrar menores nem inserir seus dados, salvo quando houver necessidade legítima, base legal adequada e salvaguardas específicas.</p>
  },
  {
    id: 'contato',
    title: '12. Contato, reclamações e atualizações',
    body: <><p>Para exercer direitos ou esclarecer dúvidas, utilize <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. Usuários autenticados também podem abrir uma solicitação no módulo Suporte. O pedido deve informar apenas o necessário para localização e validação segura do cadastro.</p><p>Esta Política pode ser atualizada para refletir alterações legais, técnicas ou operacionais. A versão vigente ficará disponível nesta página com a data da última atualização.</p><p>Se uma solicitação não for solucionada, o titular poderá recorrer aos canais da Autoridade Nacional de Proteção de Dados, observados os procedimentos aplicáveis.</p></>
  }
];

const documents = {
  terms: {
    eyebrow: 'Contrato de uso da plataforma',
    title: 'Termos de Uso',
    description: 'Regras para acesso, operação, teste gratuito e contratação do ThermoSync.',
    icon: Scale,
    sections: termsSections,
    alternate: { label: 'Política de Privacidade', screen: 'privacyPolicy', icon: ShieldCheck }
  },
  privacy: {
    eyebrow: 'Transparência e proteção de dados',
    title: 'Política de Privacidade',
    description: 'Como coletamos, usamos, compartilhamos, protegemos e eliminamos dados pessoais.',
    icon: ShieldCheck,
    sections: privacySections,
    alternate: { label: 'Termos de Uso', screen: 'terms', icon: Scale }
  }
};

/**
 * Renderiza um documento público e mantém navegação, impressão e alternância
 * entre os textos sem duplicar a estrutura. A página não exige autenticação.
 */
export default function LegalDocument({ type = 'terms', onNavigate, embedded = false }) {
  const document = documents[type] || documents.terms;
  const DocumentIcon = document.icon;
  const AlternateIcon = document.alternate.icon;

  return (
    <div className={`legal-page ${embedded ? 'legal-page-embedded' : ''}`}>
      {!embedded && <header className="legal-topbar">
        <button type="button" onClick={() => onNavigate?.('landing')}><ArrowLeft size={16} /> Voltar</button>
        <button className="legal-brand" type="button" onClick={() => onNavigate?.('landing')} aria-label="Ir para a página inicial"><TermoSyncLogo size={34} color="var(--brand-core)" /><span><strong>ThermoSync</strong><small>Rede térmica sincronizada</small></span></button>
        <button type="button" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
      </header>}

      <main className="legal-shell">
        <section className="legal-hero">
          <div className="legal-hero-icon"><DocumentIcon size={28} /></div>
          <div><span>{document.eyebrow}</span><h1>{document.title}</h1><p>{document.description}</p></div>
          <dl><div><dt>Versão</dt><dd>1.0</dd></div><div><dt>Atualização</dt><dd>{LAST_UPDATED}</dd></div><div><dt>Aplicação</dt><dd>Site, teste e plataforma</dd></div></dl>
        </section>

        <section className="legal-layout">
          <aside className="legal-summary">
            <div><BookOpenCheck size={18} /><span><strong>Neste documento</strong><small>Navegue diretamente para uma seção.</small></span></div>
            <nav aria-label={`Sumário de ${document.title}`}>{document.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>
            <button type="button" onClick={() => onNavigate?.(document.alternate.screen)}><AlternateIcon size={16} /> {document.alternate.label}</button>
          </aside>

          <article className="legal-document">
            <div className="legal-intro">
              <span><FileCheck2 size={18} /> Leitura importante</span>
              <p>Leia este documento em conjunto com a proposta, o plano e o contrato da sua organização. Condições específicas formalizadas prevalecem sobre as disposições gerais.</p>
            </div>
            {document.sections.map((section) => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.body}</section>)}
            <footer className="legal-document-footer">
              <div><LockKeyhole size={18} /><span><strong>Canal de privacidade</strong><a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a></span></div>
              <div><Building2 size={18} /><span><strong>Relação empresarial</strong><small>Identificação completa no instrumento contratual.</small></span></div>
              <div><Database size={18} /><span><strong>Dados operacionais</strong><small>Tratados conforme escopo e instruções da organização.</small></span></div>
            </footer>
          </article>
        </section>
      </main>
    </div>
  );
}
