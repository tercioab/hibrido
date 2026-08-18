import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ProvedorApp } from './hooks/useApp';
import './estilos.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <ProvedorApp>
        <App />
      </ProvedorApp>
    </BrowserRouter>
  </StrictMode>,
);
