/**
 * Módulo: frontend/src/components/SystemFooter.jsx
 * Responsabilidade: Implementa o componente reutilizável System Footer e seu contrato visual.
 */

import { BookOpen, CircleHelp, Clock3, Database, Info, Scale, Server, ShieldCheck } from 'lucide-react';
import LegalLink from './LegalModal';
import './SystemFooter.css';
/**
 * Módulo: frontend/src/components/SystemFooter.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} seconds - Valor de seconds consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatUptime = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`].filter(Boolean).join(' ');
};

/**
 * Rodapé operacional com versão, ambiente, saúde dos serviços e atalhos globais.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.variant - Propriedade variant usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.systemHealth - Propriedade systemHealth usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.navigation - Propriedade navigation usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function SystemFooter({ variant = 'desktop', systemHealth, isOffline, userRole, navigation = [], onNavigate }) {
  const availableIds = new Set(navigation.map((item) => item.id));
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.5';
  const mode = import.meta.env.MODE === 'production' ? 'Produção' : 'Desenvolvimento';
  const status = isOffline ? 'offline' : systemHealth?.status === 'ok' ? 'online' : systemHealth?.status === 'degraded' ? 'degraded' : 'checking';
  const statusLabel = status === 'online' ? 'Operacional' : status === 'offline' ? 'Offline' : status === 'degraded' ? 'Degradado' : 'Verificando';
  const shortcuts = [
    { id: 'suporte', label: 'Suporte', icon: CircleHelp },
    { id: 'documentacao', label: 'Documentação', icon: BookOpen },
    { id: 'privacidade', label: 'Preferências', icon: ShieldCheck },
    { id: 'sobre', label: 'Sobre', icon: Info }
  ].filter((item) => availableIds.has(item.id));

  return (
    <footer className={`system-footer system-footer-${variant}`}>
      <div className="system-footer-brand"><strong>ThermoSync</strong><span>v{appVersion}</span><small>© {new Date().getFullYear()} Plataforma operacional</small></div>

      <div className="system-footer-runtime" aria-label="Estado do sistema">
        <span className={`system-footer-status ${status}`}><i />{statusLabel}</span>
        <span><Server size={13} />{mode}</span>
        <span><Database size={13} />Banco {String(systemHealth?.database || 'verificando').toLowerCase()}</span>
        {userRole === 'DEV' && Number(systemHealth?.uptime) > 0 && <span><Clock3 size={13} />Uptime {formatUptime(systemHealth.uptime)}</span>}
      </div>

      <nav className="system-footer-links" aria-label="Links institucionais">
        {shortcuts.map((item) => <button type="button" key={item.id} onClick={() => onNavigate(item.id)}><item.icon size={13} /><span>{item.label}</span></button>)}
        <LegalLink type="terms"><Scale size={13} /><span>Termos</span></LegalLink>
        <LegalLink type="privacy"><ShieldCheck size={13} /><span>Política</span></LegalLink>
      </nav>
    </footer>
  );
}
