import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../../config/api';
import { 
  ArrowLeft, Building2, FileText, User, Mail, Phone, 
  Loader2, CheckCircle, ShieldAlert, Sparkles, 
  Lock, Check, AlertTriangle, ArrowRight 
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import './Register.css';

/**
 * Tela de Onboarding / Registro Público (Formulário)
 *
 * Responsabilidades:
 * - Coletar dados de organização para pré-cadastro SaaS
 * - Validar campos básicos e enviar para o endpoint de pré-cadastros
 * - Exibir estado de progresso e mensagens de erro/ sucesso
 *
 * Props:
 * - `onNavigate(target)`: callback para navegação interna
 * - `isOffline`: indica ausência de conexão de rede
 */
export default function Register({ onNavigate, isOffline }) {
  const [step, setStep] = useState(1); 
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    empresa: '', cnpj: '', responsavel: '', email: '', telefone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (isOffline) {
      setErrorMessage("Sem conexão de rede. A solicitação de onboarding foi bloqueada.");
      return;
    }

    if (!formData.empresa || !formData.cnpj || !formData.responsavel || !formData.email || !formData.telefone) {
      setErrorMessage("Todos os campos de identificação corporativa são obrigatórios.");
      return;
    }
    
    setIsLoading(true);
    try {
      await axios.post(`${getApiUrl()}/pre-cadastros`, formData);
      setStep(2); // Transição para a tela de Sucesso e Linha do Tempo
    } catch (error) {
      const serverError = error.response?.data?.error || "Não foi possível submeter o requerimento. Tente novamente em instantes.";
      setErrorMessage(serverError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-viewport">
      
      {/* BOTÃO VOLTAR AO INÍCIO */}
      <button 
        onClick={() => onNavigate('landing')}
        className="register-back-btn"
      >
        <ArrowLeft size={16} /> Voltar ao Início
      </button>

      {/* CARD PRINCIPAL DO ONBOARDING */}
      <div className="register-card anim-fade-in">
        
        {step === 1 && (
          <>
            {/* CABEÇALHO DO FORMULÁRIO */}
            <div className="register-header">
              <div className="register-logo-box">
                <div className="register-logo-inner">
                  <TermoSyncLogo size={42} color="#38bdf8" />
                </div>
              </div>
              
              <span className="register-kicker">
                <Sparkles size={13} /> Onboarding SaaS Enterprise
              </span>
              
              <h2>Provisionamento Corporativo</h2>
              <p>
                Submeta os dados da sua organização para gerar um Tenant dedicado com telemetria e SLA monitorado.
              </p>
            </div>

            {/* BANNER INLINE DE ERROS */}
            {errorMessage && (
              <div className="register-error-banner anim-fade-in">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}
            
            {/* FORMULÁRIO DE IDENTIFICAÇÃO */}
            <form onSubmit={handleSubmit} className="register-form">
              <div className="register-form-group">
                
                {/* EMPRESA */}
                <div className="register-field">
                  <label>Razão Social / Organização</label>
                  <div className="register-input-wrapper">
                    <Building2 size={18} className="register-input-icon" />
                    <input 
                      type="text" 
                      placeholder="Ex: Supermercados Alpha S/A" 
                      required 
                      value={formData.empresa} 
                      onChange={e => setFormData({...formData, empresa: e.target.value})} 
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* CNPJ / NIF E TELEFONE EM GRID */}
                <div className="register-grid-2">
                  <div className="register-field">
                    <label>CNPJ / NIF Fiscal</label>
                    <div className="register-input-wrapper">
                      <FileText size={18} className="register-input-icon" />
                      <input 
                        type="text" 
                        placeholder="00.000.000/0001-00" 
                        required 
                        value={formData.cnpj} 
                        onChange={e => setFormData({...formData, cnpj: e.target.value})} 
                        style={{ fontFamily: 'monospace' }}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="register-field">
                    <label>Telefone / Celular</label>
                    <div className="register-input-wrapper">
                      <Phone size={18} className="register-input-icon" />
                      <input 
                        type="text" 
                        placeholder="(11) 90000-0000" 
                        required 
                        value={formData.telefone} 
                        onChange={e => setFormData({...formData, telefone: e.target.value})} 
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* RESPONSÁVEL TÉCNICO */}
                <div className="register-field">
                  <label>Nome do Responsável Técnico / Operacional</label>
                  <div className="register-input-wrapper">
                    <User size={18} className="register-input-icon" />
                    <input 
                      type="text" 
                      placeholder="Ex: Eng. Roberto Carlos Silva" 
                      required 
                      value={formData.responsavel} 
                      onChange={e => setFormData({...formData, responsavel: e.target.value})} 
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* EMAIL CORPORATIVO */}
                <div className="register-field">
                  <label>
                    E-mail Corporativo <span style={{ color: '#64748b', textTransform: 'none', fontWeight: 'normal' }}>(Receberá as credenciais Root)</span>
                  </label>
                  <div className="register-input-wrapper">
                    <Mail size={18} className="register-input-icon" />
                    <input 
                      type="email" 
                      placeholder="roberto.silva@empresa.com.br" 
                      required 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      disabled={isLoading}
                    />
                  </div>
                </div>

              </div>

              {/* PERKS / BENEFÍCIOS DO TENANT INCLUSOS */}
              <div className="register-perks-box">
                <span className="register-perks-title">
                  Inclusões do Tenant Enterprise
                </span>
                <div className="register-perks-grid">
                  <div className="register-perk-item">
                    <Check size={14} color="#10b981" /> Servidor Dedicado
                  </div>
                  <div className="register-perk-item">
                    <Check size={14} color="#10b981" /> SLA de 99.98%
                  </div>
                  <div className="register-perk-item">
                    <Check size={14} color="#10b981" /> Conta Admin Root
                  </div>
                  <div className="register-perk-item">
                    <Check size={14} color="#10b981" /> Telemetria IoT
                  </div>
                </div>
              </div>

              {/* AVISO DE ANÁLISE NOC */}
              <div className="register-noc-warning">
                <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  O acesso não é liberado instantaneamente. O requerimento é submetido à <strong>Análise de Viabilidade Técnica (NOC)</strong> pela Engenharia ThermoSync.
                </span>
              </div>

              {/* BOTÃO DE SUBMISSÃO */}
              <button 
                type="submit" 
                className="register-submit-btn" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="spin" /> Processando Encriptação...
                  </>
                ) : (
                  <>
                    Submeter Requerimento SaaS <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="register-security-note">
                <Lock size={12} /> Dados protegidos com criptografia SSL/TLS 256 bits
              </div>
            </form>
          </>
        )}

        {/* ===================================================================== */}
        {/* PASSO 2: TELA DE SUCESSO & LINHA DO TEMPO DE PROVISIONAMENTO */}
        {/* ===================================================================== */}
        {step === 2 && (
          <div className="register-success-view anim-slide-up">
            <div className="register-success-icon-box">
              <CheckCircle size={40} color="#10b981" />
            </div>
            
            <span className="register-success-kicker">
              Requerimento Submetido
            </span>
            <h2>Protocolo em Triagem NOC</h2>
            <p>
              Os dados de <strong>{formData.empresa}</strong> foram autenticados e ingressaram na fila de provisionamento da nossa infraestrutura em nuvem.
            </p>

            {/* LINHA DO TEMPO DOS PRÓXIMOS PASSOS */}
            <div className="register-timeline">
              <span className="register-timeline-title">
                Próximas Etapas do Provisionamento
              </span>

              <div className="register-timeline-step">
                <div className="register-step-number">1</div>
                <div className="register-step-info">
                  <strong>Análise de Engenharia (NOC)</strong>
                  <span>
                    O SysAdmin da plataforma validará a integridade do CNPJ e autorizará a geração do Tenant.
                  </span>
                </div>
              </div>

              <div className="register-timeline-step">
                <div className="register-step-number">2</div>
                <div className="register-step-info">
                  <strong>Deploy Automático (Banco & Lojas)</strong>
                  <span>
                    O ecossistema gerará a loja "Matriz" e criará uma conta Root com senha criptografada.
                  </span>
                </div>
              </div>

              <div className="register-timeline-step">
                <div className="register-step-number green">3</div>
                <div className="register-step-info">
                  <strong>Envio de Credenciais (E-mail SMTP)</strong>
                  <span>
                    Você receberá em <strong>{formData.email}</strong> o usuário de acesso e a senha provisória.
                  </span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-outline w-100" 
              onClick={() => onNavigate('landing')} 
              style={{ 
                padding: '12px', 
                borderRadius: '12px', 
                fontWeight: '700', 
                fontSize: '0.9rem', 
                borderColor: 'rgba(255,255,255,0.18)', 
                color: 'white' 
              }}
            >
              Concluir & Retornar ao Início
            </button>
          </div>
        )}

      </div>
    </div>
  );
}