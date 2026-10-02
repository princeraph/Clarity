import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import TrayMenu from './components/TrayMenu.jsx';
import { LocaleProvider } from './contexts/LocaleContext.jsx';
// Fonts ship inside the app. They used to come from fonts.googleapis.com, so
// every launch sent the user's IP address to Google — while the first screen
// promises "no cloud, no spying". Same families, weights and subsets as before
// (latin + latin-ext covers English and French); nothing leaves the machine.
// tools/verifier-paquet.mjs refuses any external resource in dist/index.html.
import '@fontsource/geist/latin-300.css';
import '@fontsource/geist/latin-ext-300.css';
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-ext-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-ext-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/geist/latin-ext-600.css';
import '@fontsource/geist/latin-700.css';
import '@fontsource/geist/latin-ext-700.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-ext-400.css';
import '@fontsource/geist-mono/latin-500.css';
import '@fontsource/geist-mono/latin-ext-500.css';
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
