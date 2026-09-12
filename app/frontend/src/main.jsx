import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import TrayMenu from './components/TrayMenu.jsx';
import { LocaleProvider } from './contexts/LocaleContext.jsx';
import './index.css';

// The Electron tray popup loads this same bundle with a `#tray` hash so we can
// reuse the single Vite build. Render only the compact tray menu in that case.
const isTray = window.location.hash.replace('#', '') === 'tray';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Both windows, not just the main one: the tray popup shows text too, and
        it carries its own palette but not its own language. */}
    <LocaleProvider>
      {isTray ? <TrayMenu /> : <App />}
    </LocaleProvider>
  </React.StrictMode>
);
