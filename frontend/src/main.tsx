import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { PrivacyModeProvider } from './context/PrivacyModeContext';
import './index.css';
import './pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DarkModeProvider>
        <PrivacyModeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </PrivacyModeProvider>
      </DarkModeProvider>
    </BrowserRouter>
  </StrictMode>,
);
