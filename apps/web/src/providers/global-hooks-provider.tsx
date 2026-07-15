'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useRouteAnalytics } from '@/hooks/use-route-analytics'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'

const SHORTCUT_ROUTES: Record<string, string> = {
  'global-shortcut:open-chat': '/chat',
  'global-shortcut:search': '/search',
  'global-shortcut:new-chat': '/chat',
  'global-shortcut:open-drama': '/drama',
}

/**
 * 全局 Hooks Provider：在根 Layout 挂载全局副作用 hooks。
 *
 * - useRouteAnalytics：路由变化自动埋点（page_view / page_time / route_change）
 * - useGlobalShortcuts：全局快捷键监听（Ctrl+K / Ctrl+P / Ctrl+Shift+N / Ctrl+/ 等）
 *
 * 帮助面板（Ctrl+/ 触发）以最简 overlay 呈现，避免引入额外依赖。
 */
export function GlobalHooksProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { currentPath } = useRouteAnalytics()
  const { showHelpPanel, toggleHelpPanel, shortcuts } = useGlobalShortcuts()

  React.useEffect(() => {
    const handlers: Array<[string, () => void]> = Object.entries(SHORTCUT_ROUTES).map(
      ([event, path]) => {
        const handler = () => {
          if (window.location.pathname === path) return
          router.push(path)
        }
        window.addEventListener(event, handler)
        return [event, handler]
      },
    )
    return () => {
      for (const [event, handler] of handlers) {
        window.removeEventListener(event, handler)
      }
    }
  }, [router])

  return (
    <>
      {children}
      {showHelpPanel && (
        <div
          role="button"
          aria-label="快捷键帮助"
          tabIndex={0}
          onClick={toggleHelpPanel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleHelpPanel()
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            style={{
              background: 'var(--background, #fff)',
              color: 'var(--foreground, #000)',
              borderRadius: 12,
              padding: '24px 32px',
              minWidth: 320,
              maxWidth: 480,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>键盘快捷键</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {shortcuts
                .filter((s) => s.active)
                .map((s) => (
                  <li
                    key={s.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 24,
                      fontSize: 14,
                    }}
                  >
                    <span style={{ opacity: 0.7 }}>{s.description ?? s.key}</span>
                    <code style={{ fontSize: 12, opacity: 0.9 }}>{s.key}</code>
                  </li>
                ))}
            </ul>
            <p style={{ margin: '16px 0 0', fontSize: 12, opacity: 0.5, textAlign: 'center' }}>
              按 Esc 或点击外部关闭
            </p>
          </div>
        </div>
      )}
      <span aria-hidden style={{ display: 'none' }} data-current-path={currentPath} />
    </>
  )
}
