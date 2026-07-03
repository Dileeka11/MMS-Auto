import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App'
import { NotifyProvider } from './components/Notify'

// Apply the saved theme + accent before first paint (avoids a flash of the wrong theme).
// Theme defaults to dark; falls back to the OS preference only when nothing was saved.
;(() => {
  const el = document.documentElement
  const saved = localStorage.getItem('mms-theme')
  el.dataset.theme = saved ?? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  const accent = localStorage.getItem('mms-accent')
  if (accent && accent !== 'blue') el.dataset.accent = accent
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotifyProvider>
      <App />
    </NotifyProvider>
  </StrictMode>,
)
