/**
 * Módulo: frontend/src/pages/Register/Register.jsx
 * Responsabilidade: Implementa a tela Register, seus estados, interações e integrações de dados.
 */

import { useMemo } from 'react';
import { CheckCircle2, ClipboardCheck, LockKeyhole, Radio } from 'lucide-react';
import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../../config/api';
import {
  ArrowLeft, Building2, FileText, User, Mail, Phone,
  Loader2,
  Check, AlertTriangle, ArrowRight
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import LegalLink from '../../components/LegalModal';
import './Register.css';

/**
 * Formata format cnpj para exibicao segura na interface.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatCnpj = (value) => String(value || '').replace(/\D/g, '').slice(0, 14)
  .replace(/^(\d{2})(\d)/, '$1.$2')
  .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
  .replace(/\.(\d{3})(\d)/, '.$1/$2')
  .replace(/(\d{4})(\d)/, '$1-$2');

/**
 * Formata telefone nacional com DDD para facilitar revisao e correcao.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{0,2})(\d{0,4})(\d{0,4})$/, (_, ddd, first, last) => [ddd && `(${ddd})`, first, last && `-${last}`].filter(Boolean).join(' '));
  return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
};

/**
 * Valida os digitos verificadores do CNPJ antes de avancar para a revisao.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const isValidCnpj = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

  /**
   * Concentra a logica de digit para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} base - Valor de base consumido por esta rotina.
   * @param {unknown} weights - Valor de weights consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const digit = (base, weights) => {
    const sum = base.split('').reduce((total, number, index) => total + Number(number) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
};

/**
 * Fluxo público de solicitação, revisão e confirmação de um único tipo de acesso.
 * O tipo vem da rota e não pode ser alterado dentro do formulário: teste gratuito
 * e cadastro definitivo seguem contratos de API e decisões comerciais distintos.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {'TRIAL'|'COMERCIAL'} props.requestType - Origem comercial fixada pela rota pública.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Register({ onNavigate, isOffline, requestType = 'COMERCIAL' }) {
  const isTrial = requestType === 'TRIAL';
  const flow = isTrial ? {
    endpoint: '/pre-cadastros/teste-gratis',
    eyebrow: 'Teste gratuito sem instalação',
    title: 'Conheça a operação antes de instalar.',
    description: 'Use equipamentos virtuais e dados simulados para avaliar a plataforma sem hardware físico.',
    points: ['14 dias sem cobrança', 'Nenhum equipamento necessário', 'Dados isolados para sua empresa'],
    formTitle: 'Solicitar teste gratuito',
    formDescription: 'Informe os dados da organização que usará o ambiente de demonstração.',
    accessLabel: 'Teste gratuito de 14 dias, sem equipamento físico',
    alternateLabel: 'Precisa da implantação definitiva?',
    alternateAction: 'Solicitar contratação',
    alternateScreen: 'register'
  } : {
    endpoint: '/pre-cadastros/cadastro-definitivo',
    eyebrow: 'Cadastro definitivo',
    title: 'Estruture sua operação com dados reais.',
    description: 'Solicite a implantação comercial com planejamento de sensores, unidades, usuários e faturamento.',
    points: ['Escopo definido com sua equipe', 'Equipamentos e telemetria reais', 'Plano e vencimento formalizados'],
    formTitle: 'Solicitar cadastro definitivo',
    formDescription: 'Informe os dados da organização para análise comercial e planejamento da implantação.',
    accessLabel: 'Cadastro definitivo para implantação comercial',
    alternateLabel: 'Quer conhecer a plataforma primeiro?',
    alternateAction: 'Iniciar teste gratuito',
    alternateScreen: 'trial'
  };
  const [step, setStep] = useState('form');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [accepted, setAccepted] = useState(false);
  const [protocol, setProtocol] = useState('');
  const [formData, setFormData] = useState({ empresa: '', cnpj: '', responsavel: '', email: '', telefone: '' });

  const completedFields = useMemo(
    () => ['empresa', 'cnpj', 'responsavel', 'email', 'telefone'].filter((field) => String(formData[field] || '').trim()).length,
    [formData]
  );

  /**
   * Atualiza um campo e remove o erro local assim que o usuário corrige seu valor.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} field - Valor de field consumido por esta rotina.
   * @param {unknown} value - Valor de value consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setErrorMessage('');
  };

  /**
   * Valida todos os campos obrigatorios e devolve erros associados ao campo correto.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const validateForm = () => {
    const errors = {};
    if (formData.empresa.trim().length < 3) errors.empresa = 'Informe o nome completo da organização.';
    if (!isValidCnpj(formData.cnpj)) errors.cnpj = 'Informe um CNPJ válido.';
    if (formData.responsavel.trim().length < 3) errors.responsavel = 'Informe a pessoa responsável pelo contato.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errors.email = 'Informe um e-mail válido.';
    if (formData.telefone.replace(/\D/g, '').length < 10) errors.telefone = 'Informe um telefone com DDD.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Abre a etapa de revisão somente quando os dados estão completos.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const reviewRequest = (event) => {
    event.preventDefault();
    if (validateForm()) setStep('review');
  };

  /**
   * Envia uma única solicitação validada e guarda o protocolo retornado pela API.
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
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleSubmit = async () => {
    setErrorMessage('');
    if (isOffline) return setErrorMessage('Sem conexão de rede. A solicitação não pode ser enviada agora.');
    if (!accepted) return setErrorMessage('Confirme que os dados podem ser usados para análise do pré-cadastro.');
    if (!validateForm()) { setStep('form'); return; }

    setIsLoading(true);
    try {
      const response = await axios.post(`${getApiUrl()}${flow.endpoint}`, {
        ...formData,
        legalAccepted: true,
        legalVersion: '1.0'
      }, { timeout: 15000 });
      setProtocol(response.data?.protocol || 'Solicitação registrada');
      setStep('success');
    } catch (error) {
      setErrorMessage(error.response?.data?.error || (error.code === 'ECONNABORTED' ? 'O servidor demorou para responder. Tente novamente.' : 'Não foi possível enviar a solicitação. Tente novamente em instantes.'));
    } finally {
      setIsLoading(false);
    }
  };

  const fields = [
    { id: 'empresa', label: 'Organização', icon: Building2, type: 'text', placeholder: 'Ex.: Supermercados Alpha S.A.', autoComplete: 'organization' },
    { id: 'cnpj', label: 'CNPJ', icon: FileText, type: 'text', placeholder: '00.000.000/0001-00', inputMode: 'numeric' },
    { id: 'responsavel', label: 'Responsável pelo contato', icon: User, type: 'text', placeholder: 'Nome e sobrenome', autoComplete: 'name' },
    { id: 'email', label: 'E-mail corporativo', icon: Mail, type: 'email', placeholder: 'nome@empresa.com.br', autoComplete: 'email' },
    { id: 'telefone', label: 'Telefone com DDD', icon: Phone, type: 'tel', placeholder: '(11) 90000-0000', inputMode: 'tel', autoComplete: 'tel' }
  ];

  return (
    <div className="signup-page">
      <header className="signup-topbar">
        <button type="button" className="signup-topbar-back" onClick={() => onNavigate('landing')} aria-label="Voltar ao início"><ArrowLeft size={16} /><span>Voltar</span></button>
        <div><TermoSyncLogo size={32} color="var(--brand-core)" /><span><strong>ThermoSync</strong><small>Rede térmica sincronizada</small></span></div>
        <button type="button" className="signup-topbar-login" onClick={() => onNavigate('login')} aria-label="Acessar conta existente"><span>Já sou cliente</span><ArrowRight size={15} /></button>
      </header>

      <main className="signup-layout">
        <aside className="signup-context">
          <img src="/auth-refrigerated-displays-v3.png" alt="Corredor com expositores refrigerados abastecidos" />
          <div className="signup-context-shade" />
          <div className="signup-context-copy">
            <span>{isTrial ? <Radio size={15} /> : <Building2 size={15} />} {flow.eyebrow}</span>
            <h1>{flow.title}</h1>
            <p>{flow.description}</p>
            <div className="signup-context-points">
              {flow.points.map((point) => <span key={point}><Check size={15} /> {point}</span>)}
            </div>
          </div>
        </aside>

        <section className="signup-workspace">
          <div className="signup-progress" aria-label="Progresso do pré-cadastro">
            {[['form', '1', 'Dados'], ['review', '2', 'Revisão'], ['success', '3', 'Recebido']].map(([id, number, label]) => {
              const order = ['form', 'review', 'success'];
              const reached = order.indexOf(step) >= order.indexOf(id);
              return <div className={reached ? 'active' : ''} key={id}><span>{reached && step !== id ? <Check size={14} /> : number}</span><small>{label}</small></div>;
            })}
          </div>

          {isOffline && <div className="signup-alert offline"><AlertTriangle size={18} /><div><strong>Sem conexão com o servidor</strong><span>Você pode preencher os dados, mas o envio ficará indisponível até a conexão retornar.</span></div></div>}
          {errorMessage && <div className="signup-alert"><AlertTriangle size={18} /><span>{errorMessage}</span></div>}

          {step === 'form' && (
            <form className="signup-form" onSubmit={reviewRequest} noValidate>
              <header><span>Etapa 1 de 2</span><h2>{flow.formTitle}</h2><p>{flow.formDescription}</p></header>
              <div className="signup-request-type">{isTrial ? <Radio size={18} /> : <Building2 size={18} />}<span><strong>{flow.accessLabel}</strong><small>Este tipo de solicitação é definido por esta página e será preservado durante a aprovação.</small></span></div>
              <div className="signup-completion"><div><span style={{ width: `${(completedFields / fields.length) * 100}%` }} /></div><small>{completedFields} de {fields.length} campos preenchidos</small></div>
              <div className="signup-fields">
                {fields.map(({ id, label, icon: Icon, ...inputProps }) => (
                  <label className={`signup-field ${fieldErrors[id] ? 'invalid' : ''}`} key={id}>
                    <span>{label}</span>
                    <div><Icon size={17} /><input {...inputProps} value={formData[id]} disabled={isLoading} onChange={(event) => updateField(id, id === 'cnpj' ? formatCnpj(event.target.value) : id === 'telefone' ? formatPhone(event.target.value) : event.target.value)} /></div>
                    {fieldErrors[id] && <small>{fieldErrors[id]}</small>}
                  </label>
                ))}
              </div>
              <button className="signup-primary" type="submit">Revisar solicitação <ArrowRight size={17} /></button>
              <p className="signup-privacy"><LockKeyhole size={13} /> Os dados serão usados para avaliar e responder esta solicitação. <LegalLink type="privacy">Saiba como protegemos seus dados</LegalLink>.</p>
              <button className="signup-alternate-flow" type="button" onClick={() => onNavigate(flow.alternateScreen)}>{flow.alternateLabel} <strong>{flow.alternateAction}</strong></button>
            </form>
          )}

          {step === 'review' && (
            <div className="signup-review">
              <header><span>Etapa 2 de 2</span><h2>Revise antes de enviar</h2><p>Confira os dados. Após o envio, uma solicitação pendente será criada para análise.</p></header>
              <dl><div><dt>Tipo de acesso</dt><dd>{flow.accessLabel}</dd></div>{fields.map(({ id, label }) => <div key={id}><dt>{label}</dt><dd>{formData[id]}</dd></div>)}</dl>
              <div className="signup-consent"><input id="legal-consent" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span><label htmlFor="legal-consent"><strong>Confirmo que os dados estão corretos e aceito os documentos aplicáveis.</strong></label><small>Li os <LegalLink type="terms">Termos de Uso</LegalLink> e a <LegalLink type="privacy">Política de Privacidade</LegalLink>, versão 1.0, e autorizo o contato sobre esta solicitação.</small></span></div>
              <div className="signup-review-actions"><button className="signup-secondary" type="button" onClick={() => { setStep('form'); setErrorMessage(''); }}><ArrowLeft size={16} /> Corrigir dados</button><button className="signup-primary" type="button" onClick={handleSubmit} disabled={isLoading || isOffline}>{isLoading ? <Loader2 size={17} className="spin" /> : <ClipboardCheck size={17} />} {isLoading ? 'Enviando...' : 'Enviar solicitação'}</button></div>
            </div>
          )}

          {step === 'success' && (
            <div className="signup-success">
              <span className="signup-success-icon"><CheckCircle2 size={30} /></span>
              <span>Solicitação recebida</span>
              <h2>{isTrial ? 'Seu teste gratuito entrou em análise.' : 'Seu cadastro definitivo entrou em análise.'}</h2>
              <p>A equipe verificará os dados de <strong>{formData.empresa}</strong>. Se a solicitação for aprovada, as instruções serão enviadas para <strong>{formData.email}</strong>.{isTrial ? ' O ambiente será entregue com equipamentos virtuais e não exigirá instalação.' : ' A equipe entrará em contato para confirmar plano, faturamento e escopo da implantação.'}</p>
              <div className="signup-protocol"><small>Protocolo</small><strong>{protocol}</strong></div>
              <div className="signup-next-steps"><article><span>1</span><div><strong>Análise cadastral</strong><small>Validação da organização e do contato informado.</small></div></article><article><span>2</span><div><strong>Preparação do ambiente</strong><small>{isTrial ? 'Criação dos equipamentos e dados virtuais.' : 'Definição do plano, faturamento e escopo.'}</small></div></article><article><span>3</span><div><strong>Retorno por e-mail</strong><small>{isTrial ? 'Credenciais e roteiro da demonstração.' : 'Proposta e orientações para implantação.'}</small></div></article></div>
              <button className="signup-primary" type="button" onClick={() => onNavigate('landing')}>Concluir <ArrowRight size={16} /></button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
