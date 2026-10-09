import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { detectDevice } from '@/lib/platform';

const device = detectDevice();
if (device.isMobile) {
  document.documentElement.classList.add('is-mobile');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
