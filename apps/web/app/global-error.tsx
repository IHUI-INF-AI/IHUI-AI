'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * 全局错误边界(Next.js 要求)。
 *
 * 兜底 root layout 抛出的错误(app/error.tsx 无法捕获 root layout 错误)。
 * 必须自带 <html>/<body>,因为 root layout 在错误时不会渲染。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '24px',
            padding: '16px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <AlertCircle size={48} color="#ef4444" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
              应用发生严重错误
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              {error.message || '请刷新页面或联系管理员'}
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <RefreshCw size={16} />
            重试
          </button>
        </div>
      </body>
    </html>
  )
}
