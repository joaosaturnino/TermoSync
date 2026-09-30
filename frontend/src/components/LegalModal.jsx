/**
 * Modal reutilizável para consulta dos documentos jurídicos sem abandonar a
 * tela em uso. O link preserva um href real para acessibilidade e contingência,
 * enquanto o clique normal abre o conteúdo dentro da própria aplicação.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, Scale, ShieldCheck, X } from 'lucide-react';
import './LegalModal.css';

const LegalDocument = lazy(() => import('../pages/Legal/LegalDocument'));

const DOCUMENTS = {
  terms: {
    path: '/termos-de-uso',
    title: 'Termos de Uso',
    eyebrow: 'Documento jurídico',
    icon: Scale
  },
  privacy: {
    path: '/politica-de-privacidade',
    title: 'Política de Privacidade',
    eyebrow: 'Proteção de dados',
    icon: ShieldCheck
  }
};

/**
 * Exibe o documento selecionado sobre a interface atual e restaura o foco ao
 * fechar. A rolagem da página é bloqueada somente durante a abertura do modal.
 */
export function LegalModal({ initialType = 'terms', onClose }) {
  const [type, setType] = useState(initialType);
  const closeButtonRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const documentInfo = DOCUMENTS[type] || DOCUMENTS.terms;
  const DocumentIcon = documentInfo.icon;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [type]);

  const switchDocument = (screen) => {
    setType(screen === 'privacyPolicy' ? 'privacy' : 'terms');
  };

  return createPortal(
    <div className="legal-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
        <header className="legal-modal-header">
          <div className="legal-modal-heading">
            <span><DocumentIcon size={19} /></span>
            <div><small>{documentInfo.eyebrow}</small><strong id="legal-modal-title">{documentInfo.title}</strong></div>
          </div>
          <div className="legal-modal-actions">
            <button type="button" onClick={() => window.print()} title="Imprimir documento" aria-label="Imprimir documento"><Printer size={18} /></button>
            <button ref={closeButtonRef} type="button" onClick={onClose} title="Fechar documento" aria-label="Fechar documento"><X size={20} /></button>
          </div>
        </header>

        <div ref={scrollContainerRef} className="legal-modal-scroll">
          <Suspense fallback={<div className="legal-modal-loading"><Loader2 className="spin" size={24} /><span>Carregando documento...</span></div>}>
            <LegalDocument type={type} embedded onNavigate={switchDocument} />
          </Suspense>
        </div>
      </section>
    </div>,
    document.body
  );
}

/**
 * Link jurídico que conserva sua URL pública, mas evita a navegação quando o
 * JavaScript está disponível. `asButton` atende locais já estilizados como ação.
 */
export default function LegalLink({ type = 'terms', asButton = false, className, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const documentInfo = DOCUMENTS[type] || DOCUMENTS.terms;
  const commonProps = {
    className,
    onClick: (event) => {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <>
      {asButton
        ? <button type="button" {...commonProps}>{children}</button>
        : <a href={documentInfo.path} {...commonProps}>{children}</a>}
      {isOpen && <LegalModal initialType={type} onClose={() => setIsOpen(false)} />}
    </>
  );
}
