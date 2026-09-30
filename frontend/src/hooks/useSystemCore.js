/**
 * Módulo: frontend/src/hooks/useSystemCore.js
 * Responsabilidade: Centraliza estado e efeitos compartilhados pelo hook use System Core.
 */

import { getApiUrl } from '../config/api';
import { useState, useEffect, useCallback } from 'react';
import logger from '../utils/logger';

const DEFAULT_FEATURES = {
  allowExports: true,
  enableAudioAlerts: true,
  telemetryStream: true,
  enableToasts: true,
  forceDarkMode: false,
  enableChat: true,
  readOnlyMode: false
};

/**
 * Expõe o hook create Default Config com estado e acoes compartilhadas pela aplicacao.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const createDefaultConfig = () => ({
  maintenanceMode: false,
  maintenanceNoticeActive: false,
  maintenanceMessage: '',
  regras: {
    GLOBAL: { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
    ADMIN: { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
    LOJA: { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
    MANUTENCAO: { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
    DEV: { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
    USERS: {}
  },
  planos: {},
  billing: { pro: 299.90, ent: 899.90, diaVencimento: 10, multa: 2.0, juros: 1.0 }
});

/**
 * Kernel de configuração global do SaaS. Este hook controla quais módulos/features aparecem
 * para cada papel ou usuário, além do plano da filial. As alterações são persistidas no
 * backend para que todos os usuários recebam a mesma configuração.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; registra ou remove listeners de eventos; troca eventos em tempo real
 *
 * @param {unknown} userRole - Valor de user role consumido por esta rotina.
 * @param {unknown} loginAtivo - Valor de login ativo consumido por esta rotina.
 * @param {unknown} userFilial - Valor de user filial consumido por esta rotina.
 * @param {unknown} abaAtiva - Valor de aba ativa consumido por esta rotina.
 * @param {unknown} setAbaAtiva - Valor de set aba ativa consumido por esta rotina.
 * @param {string} token - Código de verificação ou credencial temporária recebida pelo fluxo.
 * @param {unknown} socket - Valor de socket consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function useSystemCore(userRole, loginAtivo, userFilial, abaAtiva, setAbaAtiva, token, socket) {
  
  // =========================================================================
  // 1. ESTADO GLOBAL DO SISTEMA (SysConfig SaaS)
  // =========================================================================
  const [sysConfig, setSysConfig] = useState(createDefaultConfig);

  // =========================================================================
  // 2. SINCRONIZAÇÃO COM A CONFIGURAÇÃO PERSISTIDA
  // =========================================================================
  useEffect(() => {
    let active = true;

    /**
     * Expõe o hook load Config com estado e acoes compartilhadas pela aplicacao.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const loadConfig = async () => {
      try {
        const endpoint = token ? '/system-config' : '/system-config/public';
        const options = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
        const response = await fetch(`${getApiUrl()}${endpoint}`, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const persisted = await response.json();
        if (!active) return;
        const defaults = createDefaultConfig();
        setSysConfig((current) => token ? ({
            ...defaults,
            ...persisted,
            regras: { ...defaults.regras, ...(persisted.regras || {}) },
            planos: persisted.planos || {}
          }) : ({
            ...current,
            maintenanceMode: persisted.maintenanceMode === true,
            maintenanceNoticeActive: persisted.maintenanceNoticeActive === true || persisted.maintenanceMode === true,
            maintenanceMessage: persisted.maintenanceMessage || defaults.maintenanceMessage
          }));
      } catch (error) {
        logger.warn('Não foi possível sincronizar a configuração global.', error);
      }
    };
    loadConfig();
    const interval = window.setInterval(loadConfig, token ? 30000 : 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token]);

  useEffect(() => {
    if (!socket) return undefined;

    /**
     * Expõe o hook handle Config Update com estado e acoes compartilhadas pela aplicacao.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleConfigUpdate = (payload = {}) => {
      setSysConfig((current) => ({
        ...current,
        regras: payload.regras ? { ...current.regras, ...payload.regras } : current.regras,
        maintenanceMode: payload.maintenanceMode === true,
        maintenanceNoticeActive: payload.maintenanceNoticeActive === true || payload.maintenanceMode === true,
        maintenanceMessage: payload.maintenanceMessage || ''
      }));
    };
    socket.on('system_config_updated', handleConfigUpdate);
    return () => socket.off('system_config_updated', handleConfigUpdate);
  }, [socket]);

  useEffect(() => {

    /**
     * Expõe o hook handle Storage Change com estado e acoes compartilhadas pela aplicacao.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: interage com APIs do navegador
     *
     * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleStorageChange = (event) => {
      if (event.key === 'termosync_force_reload') window.location.reload();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // =========================================================================
  // 3. MOTOR DE VALIDAÇÃO DE PLANOS (PAYWALL)
  // =========================================================================
  const getPlanoAtual = useCallback(() => {
    if (userRole === 'DEV' || userRole === 'ADMIN') return 'ENTERPRISE';
    return sysConfig.planos?.[userFilial] || 'FREE'; 
  }, [sysConfig.planos, userFilial, userRole]);

  const hasPremiumAccess = useCallback((requiredPlan) => {
    if (userRole === 'DEV') return true; // 🛡️ BLINDAGEM: DEV sempre tem acesso premium

    const planoAtual = getPlanoAtual();
    if (planoAtual === 'ENTERPRISE') return true;
    if (planoAtual === 'PRO' && (requiredPlan === 'FREE' || requiredPlan === 'PRO')) return true;
    if (planoAtual === 'FREE' && requiredPlan === 'FREE') return true;
    return false;
  }, [getPlanoAtual, userRole]);

  // =========================================================================
  // 4. MOTOR DE VALIDAÇÃO DE FEATURES E MÓDULOS
  // =========================================================================
  const isFeatureEnabled = useCallback((featureKey) => {
    // 🛡️ BLINDAGEM DO DESENVOLVEDOR (GOD MODE)
    if (userRole === 'DEV') {
      if (featureKey === 'readOnlyMode') return false; // DEV nunca fica bloqueado em modo Leitura
      if (featureKey === 'forceDarkMode') return sysConfig?.regras?.['GLOBAL']?.features?.forceDarkMode ?? false; // Acompanha a escolha global do dark mode para testar
      return true; // TODAS as outras features (exports, som, chat) estão sempre ON para o DEV
    } 
    
    // Regras normais para o resto dos usuários
    try {
      const globalFlag = sysConfig?.regras?.['GLOBAL']?.features?.[featureKey] ?? true;
      const roleFlag = sysConfig?.regras?.[userRole]?.features?.[featureKey] ?? true;
      const userFlag = sysConfig?.regras?.USERS?.[loginAtivo]?.features?.[featureKey] ?? true;
      
      if (featureKey === 'readOnlyMode' || featureKey === 'forceDarkMode') {
         return (sysConfig?.regras?.['GLOBAL']?.features?.[featureKey] === true) || 
                (sysConfig?.regras?.[userRole]?.features?.[featureKey] === true) || 
                (sysConfig?.regras?.USERS?.[loginAtivo]?.features?.[featureKey] === true);
      }
      return globalFlag && roleFlag && userFlag;
    } catch (e) { return true; }
  }, [sysConfig, userRole, loginAtivo]);

  const isModuloOculto = useCallback((moduleId) => {
    // 🛡️ BLINDAGEM DO DESENVOLVEDOR: DEV VÊ TODAS AS ABAS, SEMPRE.
    if (userRole === 'DEV') return false; 
    
    // SaaS Paywall Hardcode (Relatórios e Histórico exigem plano PRO)
    if ((moduleId === 'relatorios' || moduleId === 'historico') && !hasPremiumAccess('PRO')) {
        return true; 
    }

    try {
      const globalHidden = sysConfig?.regras?.['GLOBAL']?.modulosOcultos?.includes(moduleId) || false;
      const roleHidden = sysConfig?.regras?.[userRole]?.modulosOcultos?.includes(moduleId) || false;
      const userHidden = sysConfig?.regras?.USERS?.[loginAtivo]?.modulosOcultos?.includes(moduleId) || false;
      return globalHidden || roleHidden || userHidden;
    } catch (e) { return false; }
  }, [sysConfig, userRole, loginAtivo, hasPremiumAccess]);

  /** Envia uma fotografia completa da configuração para persistência atômica. */
  const persistConfig = useCallback(async (nextConfig) => {
    if (!token) return;
    try {
      const response = await fetch(`${getApiUrl()}/system-config`, {
        method: 'PUT',
        keepalive: true,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      logger.error('Falha ao persistir a configuração global.', error);
      window.dispatchEvent(new CustomEvent('forceToast', {
        detail: { msg: 'A configuração não pôde ser salva no servidor.', type: 'error' }
      }));
    }
  }, [token]);

  /** Persiste um único bloqueio de tela de forma idempotente e resistente ao reload. */
  const persistUiRule = useCallback(async (scopeType, target, moduleId, hidden) => {
    if (!token) return;
    try {
      const response = await fetch(`${getApiUrl()}/system-config/ui-rule`, {
        method: 'PATCH',
        keepalive: true,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeType, target, moduleId, hidden })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      logger.error('Falha ao persistir regra da Matriz de UI.', error);
      window.dispatchEvent(new CustomEvent('forceToast', {
        detail: { msg: 'O bloqueio da tela não pôde ser salvo no servidor.', type: 'error' }
      }));
    }
  }, [token]);

  // =========================================================================
  // 5. FUNÇÃO DE ATUALIZAÇÃO DO KERNEL
  // =========================================================================
  const updateSysConfig = useCallback((scopeType, target, category, key, value) => {
    // Atualizações são feitas em cópia profunda para evitar mutação direta do
    // estado React e manter o banco sincronizado com a UI.
    setSysConfig(prev => {
      try {
        const newConfig = JSON.parse(JSON.stringify(prev)); 
        if (!newConfig.regras) newConfig.regras = {};
        if (!newConfig.regras.USERS) newConfig.regras.USERS = {};
        if (!newConfig.planos) newConfig.planos = {};

        // Atualização de Licenças SaaS
        if (category === 'saas_plan') {
           newConfig.planos[target] = value;
           persistConfig(newConfig);
           return newConfig;
        }

        if (category === 'billing') {
          newConfig.billing = { ...(newConfig.billing || {}), [key]: value };
          persistConfig(newConfig);
          return newConfig;
        }

        if (scopeType === 'ROLE' && target === 'DEV' && (category === 'modulosOcultos' || category === 'features')) {
          return prev;
        }

        let targetRef;
        if (scopeType === 'USER') {
            if (!target) return prev; 
            if (!newConfig.regras.USERS[target]) newConfig.regras.USERS[target] = { modulosOcultos: [], features: {...DEFAULT_FEATURES} };
            targetRef = newConfig.regras.USERS[target];
        } else {
            if (!target) target = 'GLOBAL';
            if (!newConfig.regras[target]) newConfig.regras[target] = { modulosOcultos: [], features: {...DEFAULT_FEATURES} };
            targetRef = newConfig.regras[target];
        }
        
        if (!targetRef.modulosOcultos) targetRef.modulosOcultos = [];
        if (!targetRef.features) targetRef.features = {...DEFAULT_FEATURES};

        if (category === 'maintenanceMode') {
          newConfig.maintenanceMode = value;
          newConfig.maintenanceNoticeActive = value;
          newConfig.maintenanceMessage = value ? String(key || '').trim().slice(0, 280) : '';
        }
        else if (category === 'maintenanceNotice') {
          newConfig.maintenanceNoticeActive = value;
          newConfig.maintenanceMessage = value ? String(key || '').trim().slice(0, 280) : '';
        } 
        else if (category === 'modulosOcultos') {
          const wasHidden = targetRef.modulosOcultos.includes(key);
          if (wasHidden) {
            targetRef.modulosOcultos = targetRef.modulosOcultos.filter(m => m !== key);
          } else {
            targetRef.modulosOcultos.push(key);
          }
          persistUiRule(scopeType, target, key, !wasHidden);
          
          if ((scopeType === 'ROLE' && (target === 'GLOBAL' || target === userRole)) || (scopeType === 'USER' && target === loginAtivo)) {
             if (targetRef.modulosOcultos.includes(abaAtiva) && abaAtiva !== 'dashboard' && abaAtiva !== 'dev_panel') {
                setTimeout(() => setAbaAtiva('dashboard'), 0);
             }
          }
        } 
        else if (category === 'features') {
          targetRef.features[key] = value;
        }

        if (category !== 'modulosOcultos') persistConfig(newConfig);
        return newConfig;
      } catch (e) {
        return prev;
      }
    });
  }, [abaAtiva, userRole, loginAtivo, setAbaAtiva, persistConfig, persistUiRule]);

  return { sysConfig, isFeatureEnabled, isModuloOculto, updateSysConfig, getPlanoAtual, hasPremiumAccess };
}
