/**
 * useSystemTheme(2026-07-26 立)
 *
 * 监听系统 prefers-color-scheme,同步到 <html> 的 .dark class。
 * 让扩展端 popup + sidepanel 跟 web 端一样支持浅/深主题切换(用同一份 .login-scope 共享 CSS),
 * 实现"样式差距一模一样"的最终对齐。
 *
 * 实现细节:
 * - 启动时立即同步一次 system 主题到 html(.dark 或 移除)
 * - 用 matchMedia('(prefers-color-scheme: dark)').addEventListener 监听变化
 * - 持久化:用户偏好写入 chrome.storage.local(扩展特定,非跨域),用 chrome.storage.sync 跨设备同步
 * - 持久化优先 > system 偏好(用户手动选过的优先)
 * - SSR 安全:typeof window === 'undefined' 时 no-op
 *
 * 用法:
 *   // main.tsx
 *   useSystemTheme()  // 仅调用一次,无返回值
 */
import { useEffect } from 'react'
import { createChromePlatform, type StorageChange } from '@ihui/browser-platform'

const platform = createChromePlatform()

const STORAGE_KEY = 'ihui.theme.preference' // 'system' | 'light' | 'dark'

function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function resolveTheme(pref: 'system' | 'light' | 'dark' | null): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref
  // 'system' or null → 查 OS 偏好
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export function useSystemTheme() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let currentPref: 'system' | 'light' | 'dark' = 'system'

    // 1. 读持久化偏好(异步,不阻塞首次渲染)
    const loadPref = async () => {
      try {
        // platform 直接调 chrome API,node/vitest 环境需 fallback 守卫
        if (typeof chrome === 'undefined') {
          applyTheme(resolveTheme('system'))
          return
        }
        const stored = await platform.storage.localGet<string>(STORAGE_KEY)
        const pref = (stored as 'system' | 'light' | 'dark' | null) ?? 'system'
        currentPref = pref
        applyTheme(resolveTheme(pref))
      } catch {
        applyTheme(resolveTheme('system'))
      }
    }
    void loadPref()

    // 2. 监听 system 主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (currentPref === 'system') {
        applyTheme(mediaQuery.matches ? 'dark' : 'light')
      }
    }
    mediaQuery.addEventListener('change', onChange)

    // 3. 监听其他标签页 / 弹窗的偏好变更(platform.storage.onStorageChanged 已过滤 area)
    let unsubscribe: (() => void) | null = null
    if (typeof chrome !== 'undefined') {
      const onStorageChange = (changes: Record<string, StorageChange>) => {
        if (!(STORAGE_KEY in changes)) return
        const newPref =
          (changes[STORAGE_KEY].newValue as 'system' | 'light' | 'dark' | undefined) ?? 'system'
        currentPref = newPref
        applyTheme(resolveTheme(newPref))
      }
      unsubscribe = platform.storage.onStorageChanged('local', onStorageChange)
    }

    return () => {
      mediaQuery.removeEventListener('change', onChange)
      unsubscribe?.()
    }
  }, [])
}
