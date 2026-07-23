import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'highlight.js/styles/github.css'
import App from './App'
import { initTheme } from './hooks/use-theme'
import { initFontSize } from './hooks/use-font-size'

// 启动恢复主题:user 主题(localStorage)优先,system 跟随 mql
// useTheme hook 接管后续切换,initTheme 仅负责首屏避免 FOUC
initTheme()
// 启动恢复字号:从 localStorage 读取 --font-scale,避免首屏布局跳动
initFontSize()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
