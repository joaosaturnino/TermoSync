import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clipboard, Database, Download, Loader2, Radio, RefreshCw, Server, ShieldCheck, Wifi, Zap } from 'lucide-react';
import './CentralSaudeSistema.css';

/**
 * Concentra a logica de status tone para manter o restante do tela mais legivel.
 */
const statusTone = (value) => {
  const text = String(value || '').toLowerCase();
  if (['ok', 'online', 'healthy', 'connected'].some(item => text.includes(item))) return 'good';
  if (['degraded', 'warning', 'unknown', 'checking'].some(item => text.includes(item))) return 'warn';
  return 'bad';
};

/**
 * Formata format date para exibicao segura na interface.
 */
const formatDate = (value) => {
  if (!value) return 'Sem registro';
  try { return new Date(value).toLocaleString('pt-BR'); } catch { return 'Sem registro'; }
};

/**
 * Renderiza a tela Central Saude Sistema e concentra as regras de apresentacao desse modulo.
 */
export default function CentralSaudeSistema({ api, systemHealth, isOffline, equipamentos = [], chamados = [], notificacoes = [], showToast, userRole }) {
  const [health, setHealth] = useState(systemHealth || null);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(false);

  const carregarSaude = useCallback(async () => {
    if (!api || isOffline) return;
    setLoading(true);
    try {
      const [healthRes, hostRes] = await Promise.all([
        api.get('/health').catch(() => ({ data: null })),
        api.get('/system/host-info').catch(() => ({ data: null }))
      ]);
      if (healthRes.data) setHealth(healthRes.data);
      if (hostRes.data?.success) setHost(hostRes.data);
    } catch (error) {
      showToast?.(error.userMessage || 'Falha ao atualizar saúde do sistema.', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, isOffline, showToast]);

  useEffect(() => {
    carregarSaude();
  }, [carregarSaude]);

  const resumo = useMemo(() => {
    const totalEquip = equipamentos.length;
    const ativos = equipamentos.filter(eq => eq.motor_ligado || eq.ultima_temp !== undefined || eq.ultima_leitura).length;
    const chamadosAbertos = chamados.filter(c => !['concluído', 'concluido', 'fechado', 'cancelado', 'resolvido'].includes(String(c.status || '').trim().toLowerCase())).length;
    return { totalEquip, ativos, chamadosAbertos, alertas: notificacoes.length };
  }, [equipamentos, chamados, notificacoes]);

  /**
   * Processa a interacao de copiar diagnostico e atualiza a interface conforme o resultado.
   */
  const copiarDiagnostico = async () => {
    const payload = [
      'TermoSync - Saude do Sistema',
      `Status: ${health?.status || 'N/A'}`,
      `Banco: ${health?.database || 'N/A'}`,
      `MQTT: ${health?.mqtt || 'N/A'}`,
      `Offline: ${isOffline ? 'sim' : 'nao'}`,
      `Equipamentos: ${resumo.totalEquip}`,
      `Alertas ativos: ${resumo.alertas}`,
      `Chamados abertos: ${resumo.chamadosAbertos}`,
      `Host: ${host?.os?.hostname || 'N/A'}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      showToast?.('Diagnóstico copiado.', 'success');
    } catch {
      showToast?.('Não foi possível copiar o diagnóstico.', 'warning');
    }
  };

  /**
   * Concentra a logica de baixar backup para manter o restante do tela mais legivel.
   */
  const baixarBackup = async () => {
    if (!api || userRole !== 'DEV') return;
    try {
      const response = await api.get('/system/backup-json', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `termosync-backup-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      showToast?.('Backup exportado com sucesso.', 'success');
    } catch (error) {
      showToast?.(error.userMessage || 'Falha ao gerar backup.', 'error');
    }
  };

  const cards = [
    { label: 'API', value: isOffline ? 'offline' : (health?.status || 'checking'), icon: Server },
    { label: 'Banco de Dados', value: health?.database || 'checking', icon: Database },
    { label: 'MQTT / IoT', value: health?.mqtt || 'checking', icon: Radio },
    { label: 'Tempo Real', value: isOffline ? 'offline' : 'online', icon: Wifi }
  ];

  return (
    <div className="health-page anim-fade-in">
      <section className="health-hero">
        <div>
          <span className="health-kicker"><ShieldCheck size={14} /> Central Operacional</span>
          <h2>Saúde do Sistema</h2>
          <p>Visão executiva do backend, integrações, sensores e carga operacional.</p>
        </div>
        <div className="health-actions">
          <button className="btn btn-outline" onClick={copiarDiagnostico}><Clipboard size={16} /> Copiar diagnóstico</button>
          {userRole === 'DEV' && <button className="btn btn-outline" onClick={baixarBackup} disabled={isOffline}><Download size={16} /> Backup JSON</button>}
          <button className="btn btn-primary" onClick={carregarSaude} disabled={loading || isOffline}>
            {loading ? <Loader2 className="spinner" size={16} /> : <RefreshCw size={16} />}
            Atualizar
          </button>
        </div>
      </section>

      <div className="health-status-grid">
        {cards.map((item) => {
          const Icon = item.icon;
          const tone = statusTone(item.value);
          return (
            <article className={`health-status-card ${tone}`} key={item.label}>
              <div className="health-status-icon"><Icon size={22} /></div>
              <span>{item.label}</span>
              <strong>{String(item.value || 'N/A').toUpperCase()}</strong>
            </article>
          );
        })}
      </div>

      <div className="health-kpi-grid">
        <article><Activity size={20} /><strong>{resumo.totalEquip}</strong><span>Equipamentos</span></article>
        <article><Zap size={20} /><strong>{resumo.ativos}</strong><span>Com sinal recente</span></article>
        <article><AlertTriangle size={20} /><strong>{resumo.alertas}</strong><span>Alertas ativos</span></article>
        <article><CheckCircle2 size={20} /><strong>{resumo.chamadosAbertos}</strong><span>OS em aberto</span></article>
      </div>

      <section className="health-detail-grid">
        <article className="health-detail-card">
          <h3>Infraestrutura</h3>
          <div><span>Host</span><strong>{host?.os?.hostname || 'Indisponível'}</strong></div>
          <div><span>Sistema</span><strong>{host?.os ? `${host.os.platform} ${host.os.release}` : 'Indisponível'}</strong></div>
          <div><span>CPU</span><strong>{host?.cpu ? `${host.cpu.cores} núcleos` : 'Indisponível'}</strong></div>
          <div><span>Memória livre</span><strong>{host?.memory ? `${host.memory.freeMB} MB de ${host.memory.totalMB} MB` : 'Indisponível'}</strong></div>
        </article>

        <article className="health-detail-card">
          <h3>Última leitura da API</h3>
          <div><span>Atualizado em</span><strong>{formatDate(health?.timestamp || health?.generatedAt || new Date())}</strong></div>
          <div><span>WhatsApp</span><strong>{health?.whatsapp || 'N/A'}</strong></div>
          <div><span>Modo offline</span><strong>{isOffline ? 'Ativo' : 'Inativo'}</strong></div>
          <div><span>Recomendação</span><strong>{isOffline ? 'Verificar backend/rede' : 'Operação liberada'}</strong></div>
        </article>
      </section>
    </div>
  );
}
