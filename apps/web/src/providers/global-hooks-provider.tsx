'use client'

import * as React from 'react'
import { useRouteAnalytics } from '@/hooks/use-route-analytics'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'

/**
 * 全局 Hooks Provider：在根 Layout 挂载全局副作用 hooks。
 *
 * - useRouteAnalytics：路由变化自动埋点（page_view / page_time / route_change）
 * - useGlobalShortcuts：全局快捷键监听（Ctrl+K / Ctrl+P / Ctrl+Shift+N / Ctrl+/ 等）
 *
 * 帮助面板（Ctrl+/ 触发）以最简 overlay 呈现，避免引入额外依赖。
 */
export function GlobalHooksProvider({ children }: { children: React.ReactNode }) {
  const { currentPath } = useRouteAnalytics()
  const { showHelpPanel, toggleHelpPanel, shortcuts } = useGlobalShortcuts()

  return (
    <>
      {children}
      {showHelpPanel && (
        <div
          role="dialog"
          aria-label="快捷键帮助"
          onClick={toggleHelpPanel}
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
            onClick={(e) => e.stopPropagation()}
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
