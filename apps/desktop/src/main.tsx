import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'highlight.js/styles/github.css'
import App from './App'

// 跟随系统主题 toggle .dark class（对齐 web 端 next-themes .dark 策略）
const mql = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = (isDark: boolean) => {
  document.documentElement.classList.toggle('dark', isDark)
}
applyTheme(mql.matches)
mql.addEventListener('change', (e) => applyTheme(e.matches))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
