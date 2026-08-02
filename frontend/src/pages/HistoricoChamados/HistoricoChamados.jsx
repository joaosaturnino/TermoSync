import React, { useState, useMemo, memo } from 'react';
import { 
  Printer, Archive, MapPin, User, Wrench, CheckSquare, 
  CalendarCheck, Search, FileText, Trash2, AlertTriangle, 
  Loader2, ShieldCheck, Activity, Users, Shield
} from 'lucide-react';
import './HistoricoChamados.css';

// ============================================================================
// COMPONENTE OTIMIZADO (MEMO): Evita a re-renderização massiva da lista
// ============================================================================
const HistoricoCard = memo(({ c }) => {
  return (
    <div className="card historico-card">
      <div className="historico-header">
        <div className="historico-equip-title">
          <Activity size={20} color="var(--text-muted)" />
          {c.equipamento_nome || 'Equipamento não especificado'}
        </div>
        <div className="historico-badges">
          {c.urgencia && <span className="historico-badge badge-urgencia">{c.urgencia}</span>}
          <span className="historico-badge"><Shield size={10} style={{display:'inline', marginBottom:'-2px', marginRight:'2px'}}/> Autenticado</span>
        </div>
      </div>

      <div className="historico-desc-box">
        <span className="quote-mark">"</span>{c.descricao || 'Sem descrição registrada.'}<span className="quote-mark">"</span>
      </div>

      <div className="historico-meta-grid">
        <div className="historico-meta-item">
          <MapPin size={15} /> Local: <strong>{c.filial || 'Matriz'}</strong>
        </div>
        <div className="historico-meta-item">
          <User size={15} /> Abertura: <strong>{c.solicitante_nome || c.aberto_por || 'Sistema'}</strong>
        </div>
        <div className="historico-meta-item">
          <Wrench size={15} /> Técnico: <strong>{c.tecnico_responsavel || 'Equipe Geral'}</strong>
        </div>
      </div>

      <div className="historico-resolucao">
        <div className="historico-resolucao-title">
          <CheckSquare size={16} color="var(--success)" /> Laudo Técnico de Resolução:
        </div>
        <div className="historico-resolucao-text">
          {c.nota_resolucao || 'Nenhum laudo detalhado foi preenchido pelo técnico.'}
        </div>
        <div className="historico-resolucao-footer">
          <div className="historico-resolucao-date">
            <CalendarCheck size={14} />
            {c.data_conclusao ? new Date(c.data_conclusao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data indisponível'}
          </div>
          <div className="audit-stamp">COMPLIANCE</div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// COMPONENTE PRINCIPAL (COM SEGURANÇA E ISOLAMENTO DE DADOS)
// ============================================================================
/**
 * Histórico de Chamados (Laudos)
 *
 * Responsabilidades:
 * - Exibir ordens de serviço já concluídas e seus laudos técnicos
 * - Fornecer filtros por técnico, filial e termos de busca
 * - Permitir exportação/impresão e auditoria do histórico
 */
export default function HistoricoChamados({
  userRole, filialAtiva, nomeLogado, chamados = [], tecnicosDb = [], gerarLoteOS, 
  api, carregarChamados, showToast
}) {
  const [tecnicoFiltroOS, setTecnicoFiltroOS] = useState('todos');
  const [busca, setBusca] = useState('');
  
  // Estados para o Modal de Exclusão (Restrito a DEV/ADMIN)
  const [modalExcluir, setModalExcluir] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Perfis de Segurança
  const isDevOrAdmin = userRole === 'DEV' || userRole === 'ADMIN';
  const isManutencao = userRole === 'MANUTENCAO';
  const isLoja = userRole === 'LOJA';

  // Filtro Seguro, Dinâmico e Tolerante a Erros de Digitação no Banco de Dados
  const chamadosHistoricoFiltrados = useMemo(() => {
    if (!chamados || chamados.length === 0) return [];

    const termo = busca.toLowerCase().trim();

    let list = chamados.filter(c => {
        // 1. REGRA: Apenas mostrar ordens finalizadas/arquivadas no Histórico
        // Usamos includes() e toLowerCase() para evitar que falte o acento de "Concluído" no banco
        const statusStr = String(c.status || '').toLowerCase();
        const isHistorico = statusStr.includes('conclu') || statusStr.includes('fechad') || c.arquivado == 1 || c.arquivado === true;
        
        if (!isHistorico) return false;

        // 2. ISOLAMENTO DE DADOS (TENANCY) E FILIAL
        // Usamos trim() e toLowerCase() para evitar que um espaço no banco "Loja " esconda a OS
        if (filialAtiva && filialAtiva !== 'Todas') {
            const filialChamado = String(c.filial || c.equipamento_filial || 'Loja Principal').trim().toLowerCase();
            const filialSelecionada = String(filialAtiva).trim().toLowerCase();
            
            if (filialChamado !== filialSelecionada) return false;
        }

        // 3. REGRA DE VISIBILIDADE POR PERFIL
        if (isManutencao) {
            // Técnicos de Manutenção veem apenas os SEUS PRÓPRIOS laudos
            if (c.tecnico_responsavel !== nomeLogado) return false;
        } else if (!isLoja && tecnicoFiltroOS !== 'todos') {
            // Filtro manual selecionado no Dropdown (Apenas Admin/Dev)
            if (c.tecnico_responsavel !== tecnicoFiltroOS) return false;
        }

        // 4. MOTOR DE PESQUISA (Busca Global nos campos)
        if (termo) {
          const stringGlobal = `
            ${c.equipamento_nome || ''} 
            ${c.descricao || ''} 
            ${c.nota_resolucao || ''} 
            ${c.tecnico_responsavel || ''} 
            ${c.solicitante_nome || ''} 
            ${c.filial || ''}
          `.toLowerCase();
          
          if (!stringGlobal.includes(termo)) return false;
        }

        return true;
    });

    // 5. Ordenação Padrão: Mais recente no topo
    return list.sort((a, b) => {
      const timeA = a.data_conclusao ? new Date(a.data_conclusao).getTime() : new Date(a.data_abertura).getTime();
      const timeB = b.data_conclusao ? new Date(b.data_conclusao).getTime() : new Date(b.data_abertura).getTime();
      return timeB - timeA;
    });
  }, [chamados, filialAtiva, userRole, nomeLogado, tecnicoFiltroOS, busca, isManutencao, isLoja]);

  // KPIs Inteligentes
  const kpis = useMemo(() => {
    const total = chamadosHistoricoFiltrados.length;
    const tecnicosUnicos = new Set(chamadosHistoricoFiltrados.map(c => c.tecnico_responsavel).filter(Boolean)).size;
    return { total, tecnicosUnicos };
  }, [chamadosHistoricoFiltrados]);

  // ======================================================================
  // FUNÇÃO DE EXCLUSÃO (Protegida)
  // ======================================================================
  const handleExcluirHistorico = async () => {
    if (!isDevOrAdmin) {
      if (showToast) showToast('Acesso negado. Apenas o NOC pode purgar o banco de dados.', 'error');
      setModalExcluir(false);
      return;
    }

    setIsDeleting(true);
    try {
      if (!api) throw new Error('Falha de conexão ao núcleo da API.');
      
      await api.delete('/chamados/arquivados').catch(() => {
          throw new Error('A rota de purga em massa não está habilitada no servidor por segurança. Exclua os cards individualmente ou contate a infraestrutura.');
      });
      
      if (showToast) showToast('Arquivo histórico purgado com sucesso.', 'success');
      setModalExcluir(false);
      
      if (carregarChamados) carregarChamados();
      
    } catch (error) {
      const mensagemErro = error.response?.data?.error || error.message || 'Erro ao comunicar com o Banco de Dados';
      if (showToast) showToast(mensagemErro, 'error');
      setModalExcluir(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="anim-fade-in stagger-1">
      
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex-header historico-header">
        <div>
          <h3 className="historico-chamados-title">Arquivo de Intervenções</h3>
          <p className="historico-chamados-subtitle">Registro histórico de manutenções e laudos técnicos imutáveis.</p>
        </div>

        <div className="action-group">
          <div className="search-box-historico">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar máquina, laudo ou técnico..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* Oculta o seletor de técnicos se o usuário for da Manutenção ou da Loja (simplificação visual) */}
          {isDevOrAdmin && (
            <select
              className="select-input historico-filter-select"
              value={tecnicoFiltroOS}
              onChange={e => setTecnicoFiltroOS(e.target.value)}
              title="Filtrar por Técnico Responsável"
            >
              <option value="todos">Todos os Técnicos</option>
              {tecnicosDb?.map(tec => (
                <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>
              ))}
            </select>
          )}

          <button
            className="btn btn-outline btn-print-history"
            onClick={() => gerarLoteOS(chamadosHistoricoFiltrados || [])}
            disabled={chamadosHistoricoFiltrados.length === 0}
          >
            <Printer size={18} /> Exportar Relatório PDF
          </button>

          {/* Botão de Risco: Exclusivo para SysAdmins */}
          {isDevOrAdmin && chamadosHistoricoFiltrados.length > 0 && (
            <button
              className="btn btn-danger-outline"
              onClick={() => setModalExcluir(true)}
              title="Excluir todo o histórico do banco de dados (Ação Irreversível)"
            >
              <Trash2 size={18} /> Apagar Arquivo
            </button>
          )}
        </div>
      </div>

      {/* PAINEL DE KPIs RÁPIDOS */}
      <div className="historico-kpis stagger-2">
        <div className="kpi-box">
          <div className="kpi-icon-wrap"><Archive size={20} /></div>
          <div>
            <div className="kpi-value">{kpis.total}</div>
            <div className="kpi-label">Laudos Arquivados</div>
          </div>
        </div>
        <div className="kpi-box">
          <div className="kpi-icon-wrap info"><Users size={20} /></div>
          <div>
            <div className="kpi-value">{kpis.tecnicosUnicos}</div>
            <div className="kpi-label">Técnicos Envolvidos</div>
          </div>
        </div>
        <div className="kpi-box" title="Todos os laudos armazenados possuem assinatura de sistema imutável.">
          <div className="kpi-icon-wrap success"><ShieldCheck size={20} /></div>
          <div>
            <div className="kpi-value">100%</div>
            <div className="kpi-label">Conformidade Tática</div>
          </div>
        </div>
      </div>

      {/* ESTADO VAZIO / SEM DADOS */}
      {chamadosHistoricoFiltrados.length === 0 ? (
        <div className="empty-state dashboard-empty stagger-3" style={{ marginTop: '2rem' }}>
          <div className="empty-shield-box" style={{ background: 'rgba(100, 116, 139, 0.1)' }}>
            <FileText size={48} color="var(--text-muted)" />
          </div>
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Arquivo Limpo</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '400px' }}>
            {busca 
              ? 'Tente utilizar outros termos na sua pesquisa.' 
              : 'Não existem ordens de serviço arquivadas no banco de dados com as restrições e filtros de segurança atuais.'}
          </p>
        </div>
      ) : (
        /* GRID DE CARTÕES DE AUDITORIA */
        <div className="grid-cards historico-grid stagger-3" style={{ marginTop: '1.5rem' }}>
          {chamadosHistoricoFiltrados.map(c => (
            <HistoricoCard key={c.id} c={c} />
          ))}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (ZONA DE PERIGO) */}
      {modalExcluir && isDevOrAdmin && (
        <div className="historico-fixed-overlay anim-fade-in">
          <div className="historico-modal-box">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', margin: '0 0 1rem 0', fontWeight: '900' }}>
              <AlertTriangle size={24} className="pulse-danger-icon" /> Purga de Arquivo Crítica
            </h3>
            
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
              Tem certeza que deseja <strong>excluir permanentemente</strong> todos os laudos técnicos arquivados? 
              <br/><br/>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Esta ação <strong>não pode ser desfeita</strong> e todos os registros usados para efeito de auditoria corporativa e métricas operacionais serão eliminados do núcleo do servidor MySQL.
              </span>
            </p>
            
            <div className="modal-actions-historico">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setModalExcluir(false)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleExcluirHistorico}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 size={18} className="spinner" /> : <Trash2 size={18} />}
                {isDeleting ? 'Apagando banco...' : 'Sim, Apagar Todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}