import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

import App from './App.jsx';
import logger from './utils/logger';
import ErrorBoundary from './components/ErrorBoundary';

// ==========================================
// CYBER-NOC: SEQUÊNCIA DE BOOT DO TERMINAL
// ==========================================
logger.info('%c[TermoSync NOC] %cInicializando Núcleo de Telemetria e Sistemas de Segurança...', 'color: #10b981; font-weight: 900; font-size: 14px; text-shadow: 0 0 5px #10b981;', 'color: #38bdf8; font-size: 12px;');

// ADICIONE ESTE BLOCO ABAIXO
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);