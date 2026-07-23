import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTheme } from './hooks/use-theme'
import { initFontSize } from './hooks/use-font-size'
import { initCodeTheme } from './hooks/use-code-theme'

// 启动恢复主题:user 主题(localStorage)优先,system 跟随 mql
// useTheme hook 接管后续切换,initTheme 仅负责首屏避免 FOUC
initTheme()
// 启动恢复字号:从 localStorage 读取 --font-scale,避免首屏布局跳动
initFontSize()
// 启动加载代码块语法高亮主题(根据当前主题加载 github.css 或 github-dark.css)
initCodeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
