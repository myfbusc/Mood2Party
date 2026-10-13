import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// A soft ring pulses out from any checkbox as it gets ticked (CSS turns it off for reduced motion).
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== 'checkbox' || !el.checked) return;
  el.classList.remove('m2p-pop');
  void el.offsetWidth;
  el.classList.add('m2p-pop');
  window.setTimeout(() => el.classList.remove('m2p-pop'), 550);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
