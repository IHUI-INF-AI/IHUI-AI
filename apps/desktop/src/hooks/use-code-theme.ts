import { useEffect } from 'react'
import { useTheme } from './use-theme'
import lightHljsCssUrl from 'highlight.js/styles/github.css?url'
import darkHljsCssUrl from 'highlight.js/styles/github-dark.css?url'

const LINK_ID = 'hljs-theme-link'

const STORAGE_KEY = 'ihui-theme'

/** 读取当前主题(light / dark / system)。与 use-theme.ts 的 STORAGE_KEY 对齐。 */
function readCurrentTheme(): 'light' | 'dark' | 'system' {
  if (typeof window === 'undefined') return 'system'
  const saved = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | 'system' | null
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

/** 是否应该使用 dark 主题(综合 user 偏好 + system mql)。 */
function shouldUseDark(): boolean {
  const theme = readCurrentTheme()
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function ensureLink(): HTMLLinkElement {
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  return link
}

/**
 * 初始化代码块语法高亮主题 — 在 React 渲染前调用,同步加载对应 CSS 避免首屏闪烁。
 * 仅根据 localStorage + system mql 决定加载哪个 CSS。
 */
export function initCodeTheme(): void {
  if (typeof document === 'undefined') return
  const href = shouldUseDark() ? darkHljsCssUrl : lightHljsCssUrl
  const link = ensureLink()
  if (link.href !== href) {
    link.href = href
  }
}

/**
 * 代码块语法高亮主题跟随应用主题切换 hook。
 * - light 模式:highlight.js/styles/github.css
 * - dark 模式:highlight.js/styles/github-dark.css
 *
 * 主题切换时动态修改 <link> 元素的 href,无需重新加载页面。
 */
export function useCodeTheme() {
  const { isDark } = useTheme()
  useEffect(() => {
    const href = isDark ? darkHljsCssUrl : lightHljsCssUrl
    const link = ensureLink()
    if (link.href !== href) {
      link.href = href
    }
  }, [isDark])
}
