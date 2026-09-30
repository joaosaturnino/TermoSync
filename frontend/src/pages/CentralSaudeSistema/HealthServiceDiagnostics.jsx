/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthServiceDiagnostics.jsx
 * Responsabilidade: Implementa a tela Health Service Diagnostics, seus estados, interações e integrações de dados.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

const guidance = {
  API: {
    warn: 'A API respondeu com degradação. Consulte a latência e os logs antes de executar ações administrativas.',
    bad: 'A API está indisponível. Verifique o processo do backend, a rede e o proxy reverso.'
  },
  'Banco de dados': {
    warn: 'O banco respondeu com ressalvas. Verifique conexões, bloqueios e consultas lentas.',
    bad: 'A conexão com o banco falhou. Confirme as credenciais, o serviço e a conectividade.'
  },
  'MQTT / IoT': {
    warn: 'O broker está degradado. Confirme a estabilidade da sessão e o fluxo de mensagens.',
    bad: 'O broker MQTT está desconectado. Verifique endereço, credenciais e disponibilidade.'
  },
  WhatsApp: {
    warn: 'A integração requer atenção. Confira autenticação, fila e estado da sessão.',
    bad: 'A integração está indisponível. Revalide a sessão e os dados de conexão.'
  },
  'Tempo real': {
    warn: 'A conexão em tempo real está instável. Verifique transporte e reconexões.',
    bad: 'O painel perdeu a conexão em tempo real. Verifique Socket.IO, proxy e rede do cliente.'
  }
};
/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthServiceDiagnostics.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.services - Propriedade services usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.describeStatus - Propriedade describeStatus usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HealthServiceDiagnostics({ services, describeStatus }) {
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const visible = onlyIssues
    ? services.filter(service => ['warn', 'bad'].includes(describeStatus(service.value).tone))
    : services;

  return (
    <section className="health-section" aria-labelledby="health-services-title">
      <div className="health-section-heading">
        <h3 id="health-services-title">Serviços</h3>
        <button type="button" className={`health-filter ${onlyIssues ? 'active' : ''}`} aria-pressed={onlyIssues} onClick={() => setOnlyIssues(value => !value)}>
          <Filter size={15} aria-hidden="true" /> Só problemas
        </button>
      </div>
      {visible.length === 0 ? <p className="health-empty">Nenhum serviço com alerta nesta verificação.</p> : (
        <div className="health-service-grid">
          {visible.map(({ label, value, detail, icon: Icon }) => {
            const status = describeStatus(value);
            const isExpanded = expanded === label;
            const advice = guidance[label]?.[status.tone] || (status.tone === 'neutral'
              ? 'Ainda não há leitura suficiente para avaliar este serviço.'
              : 'Nenhuma ação necessária nesta verificação.');
            return (
              <div className={`health-service ${status.tone}`} key={label}>
                <button type="button" className="health-service-trigger" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : label)}>
                  <span className="health-service-icon"><Icon size={19} aria-hidden="true" /></span>
                  <span className="health-service-copy"><strong>{label}</strong><span>{detail}</span></span>
                  <span className={`health-service-status ${status.tone}`}><span className="health-status-dot" />{status.label}</span>
                  {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                </button>
                {isExpanded && <p className="health-service-advice">{advice}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
