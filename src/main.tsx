import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { envResult } from './lib/env'
import { ConfigError } from './components/ui'
import './styles/index.css'

/*
 * Scrolling is deliberately native.
 *
 * This used to run Lenis (`lerp: 0.08`, plus a permanent rAF loop) to smooth the
 * wheel. Measured in Chromium, a single 600px wheel gesture left `scrollY` at 0
 * for over a second, then kept climbing past 1.6s — so the page appeared to
 * ignore you and then scroll by itself. `lerp` and `duration` are alternatives
 * rather than a pair, the instance was never destroyed, and with
 * `syncTouch: false` it fought native scrolling on the iPads staff use.
 *
 * Smooth-scroll hijacking suits a marketing page. This is a records system:
 * people scroll a table, stop, and click the row they landed on. Anything that
 * keeps moving after the wheel stops makes that a game of chance, and it also
 * broke scroll anchoring and `scrollIntoView`.
 */

// A misconfigured deploy renders a screen naming the missing variables rather
// than mounting an app whose every request would fail as if Supabase were down.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {envResult.ok ? <App /> : <ConfigError issues={envResult.issues} />}
  </React.StrictMode>,
)
