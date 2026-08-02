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

export function useSystemCore(userRole, loginAtivo, userFilial, abaAtiva, setAbaAtiva) {
  
  // =========================================================================
  // 1. ESTADO GLOBAL DO SISTEMA (SysConfig SaaS)
  // =========================================================================
  const [sysConfig, setSysConfig] = useState(() => {
    const saved = localStorage.getItem('termosync_sysconfig_saas');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { logger.error(e); }
    }
    return {
      maintenanceMode: false,
      regras: {
        'GLOBAL': { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
        'ADMIN': { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
        'LOJA': { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
        'MANUTENCAO': { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
        'DEV': { modulosOcultos: [], features: { ...DEFAULT_FEATURES } },
        'USERS': {}
      },
      planos: {}
    };
  });

  // =========================================================================
  // 2. OUVINTE DE SINCRONIZAÇÃO EM TEMPO REAL
  // =========================================================================
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'termosync_sysconfig_saas' && e.newValue) {
        try { setSysConfig(JSON.parse(e.newValue)); } catch (err) {}
      }
      if (e.key === 'termosync_force_reload') window.location.reload(); 
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

  // =========================================================================
  // 5. FUNÇÃO DE ATUALIZAÇÃO DO KERNEL
  // =========================================================================
  const updateSysConfig = useCallback((scopeType, target, category, key, value) => {
    setSysConfig(prev => {
      try {
        const newConfig = JSON.parse(JSON.stringify(prev)); 
        if (!newConfig.regras) newConfig.regras = {};
        if (!newConfig.regras.USERS) newConfig.regras.USERS = {};
        if (!newConfig.planos) newConfig.planos = {};

        // Atualização de Licenças SaaS
        if (category === 'saas_plan') {
           newConfig.planos[target] = value;
           localStorage.setItem('termosync_sysconfig_saas', JSON.stringify(newConfig));
           localStorage.setItem('sysconfig_ping', Date.now().toString()); 
           return newConfig;
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
        } 
        else if (category === 'modulosOcultos') {
          if (targetRef.modulosOcultos.includes(key)) {
            targetRef.modulosOcultos = targetRef.modulosOcultos.filter(m => m !== key);
          } else {
            targetRef.modulosOcultos.push(key);
          }
          
          if ((scopeType === 'ROLE' && (target === 'GLOBAL' || target === userRole)) || (scopeType === 'USER' && target === loginAtivo)) {
             if (targetRef.modulosOcultos.includes(abaAtiva) && abaAtiva !== 'dashboard' && abaAtiva !== 'dev_panel') {
                setTimeout(() => setAbaAtiva('dashboard'), 0);
             }
          }
        } 
        else if (category === 'features') {
          targetRef.features[key] = value;
        }

        localStorage.setItem('termosync_sysconfig_saas', JSON.stringify(newConfig));
        localStorage.setItem('sysconfig_ping', Date.now().toString()); 
        return newConfig;
      } catch (e) {
        return prev;
      }
    });
  }, [abaAtiva, userRole, loginAtivo, setAbaAtiva]);

  return { sysConfig, isFeatureEnabled, isModuloOculto, updateSysConfig, getPlanoAtual, hasPremiumAccess };
}