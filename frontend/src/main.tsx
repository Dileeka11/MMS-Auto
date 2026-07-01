import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App'

// Apply the saved colour theme before first paint (avoids a flash of the wrong theme).
// Defaults to dark; falls back to the OS preference only when nothing was saved.
;(() => {
  const saved = localStorage.getItem('mms-theme')
  const theme = saved ?? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  document.documentElement.dataset.theme = theme
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
