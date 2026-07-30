import React from 'react'
import ReactDOM from 'react-dom/client'
import Lenis from '@studio-freight/lenis'
import App from './App'
import { envResult } from './lib/env'
import { ConfigError } from './components/ui'
import './styles/index.css'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion) {
  const lenis = new Lenis({
    lerp: 0.08,
    duration: 1.4,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 1,
  });
  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

// A misconfigured deploy renders a screen naming the missing variables rather
// than mounting an app whose every request would fail as if Supabase were down.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {envResult.ok ? <App /> : <ConfigError issues={envResult.issues} />}
  </React.StrictMode>,
)
