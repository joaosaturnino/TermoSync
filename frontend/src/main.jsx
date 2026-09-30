/** Centraliza as responsabilidades do módulo main. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.jsx';
import './index.css';

import App from './App.jsx';
import logger from './utils/logger';
import ErrorBoundary from './components/ErrorBoundary';

// ==========================================
// CYBER-NOC: SEQUÊNCIA DE BOOT DO TERMINAL
// ==========================================
logger.info('%c[ThermoSync NOC] %cInicializando Núcleo de Telemetria e Sistemas de Segurança...', 'color: var(--success); font-weight: 900; font-size: 14px; text-shadow: 0 0 5px var(--success);', 'color: #38bdf8; font-size: 12px;');

// ADICIONE ESTE BLOCO ABAIXO
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary forceError={import.meta.env.DEV && new URLSearchParams(window.location.search).get('previewError') === 'app'}>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
