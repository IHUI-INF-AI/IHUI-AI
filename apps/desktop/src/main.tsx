import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'highlight.js/styles/github.css'
import App from './App'
import { initTheme } from './hooks/use-theme'

// 启动恢复主题:user 主题(localStorage)优先,system 跟随 mql
// useTheme hook 接管后续切换,initTheme 仅负责首屏避免 FOUC
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
