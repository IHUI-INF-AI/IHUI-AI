// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { refreshAccessTokenOnce } from '@ihui/api-client'

/** 与 insights 页面 useQuery 共用的缓存键(单一事实源,防 key 漂移)。 */
export const ADMIN_INSIGHTS_QUERY_KEY = ['admin', 'relay', 'insights'] as const

/** 洞察流地址(EventSource 只能靠同源 cookie 鉴权,不支持自定义 Authorization 头)。 */
const INSIGHTS_STREAM_PATH = '/api/admin/relay/insights/stream'

/**
 * admin 运营洞察 SSE 实时订阅(2026-09-19:parity 收尾——服务端每 60s 推送
 * 最新洞察,经 queryClient.setQueryData 直写 react-query 缓存,替代页面 60s 轮询)。
 *
 * 鉴权:EventSource 无法携带 Authorization 头,依赖 auth_token cookie
 * (api 端 authenticate() 对无 Bearer 头请求的 cookie 回退;GET 不受 CSRF 校验限制)。
 * 断连时 onerror 置 live=false,页面保留最后一次数据,"重新分析"按钮可手动兜底。
 * SSE 帧格式:连接帧 `data: {"type":"connected"}`(onmessage,忽略)、
 * 数据帧 `event: insights` + `data: <InsightsResult>`(直推,无包裹)。
 *
 * 2026-10-26 修「cookie 里那枚 15 分钟 JWT 过期后功能永久哑掉且不报错」:
 * EventSource 的 onerror 有**两种互斥**成因,旧实现把它们混成一桶(一律交给内置重连):
 *   - `readyState === CONNECTING` ⇒ 瞬态网络抖动,浏览器**正在**自动重连,这里不许续期、
 *     不许报错(错了就把抖动当成会话失效,违反"判不出不得把人登出"红线);
 *   - `readyState === CLOSED`     ⇒ 致命失败(HTTP 401/403/410 或内容类型不对),浏览器
 *     **不会再**自动重连,而旧代码以为它还在重连 ⇒ 于是静默地死透。
 * 致命档的唯一出路是换新凭据(cookie 随续期一起重写)后**重建**一条流;只重建一次,
 * 续期失败或重建仍致命 ⇒ 置 error 并大声记一行,绝不"看起来还在连"。
 * 同一条分档口径另见 use-agent-runtime.ts / tool-approval-dialog.tsx / useAgentSSE.ts。
 */
export function useAdminInsightsStream(): { live: boolean; error: string | null } {
  const queryClient = useQueryClient()
  const [live, setLive] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) {
      return
    }
    let disposed = false
    let source: EventSource | null = null
    // 一次挂载只续期+重建一次:新凭据仍被拒 = 会话真死,再循环只会刷同一枚过期 cookie
    let authRetried = false

    const onInsights = (e: MessageEvent): void => {
      try {
        const result = JSON.parse(e.data) as unknown
        if (
          result &&
          typeof result === 'object' &&
          'insights' in result &&
          Array.isArray((result as { insights?: unknown }).insights)
        ) {
          queryClient.setQueryData(ADMIN_INSIGHTS_QUERY_KEY, result)
        }
      } catch {
        /* 忽略非 JSON 帧 */
      }
    }

    const giveUp = (reason: string): void => {
      setLive(false)
      setError(reason)
      // 界面文案要补 i18n 五语言,不属本批范围 ⇒ 这里先保证"响"(与 use-agent-stream
      // 尾帧账目同一口径:走 console 而不是造一句端内硬编码中文)。
      console.error(`[use-admin-insights-stream] insights stream dead: ${reason}`)
    }

    const connect = (): void => {
      if (disposed) return
      const es = new EventSource(INSIGHTS_STREAM_PATH)
      source = es
      es.onopen = () => {
        if (disposed) return
        setLive(true)
        setError(null)
      }
      es.onerror = () => {
        if (disposed) return
        setLive(false)
        if (es.readyState !== EventSource.CLOSED) return
        void (async () => {
          if (authRetried) {
            giveUp('unauthorized-after-refresh')
            return
          }
          authRetried = true
          const fresh = await refreshAccessTokenOnce()
          if (disposed) return
          if (fresh) {
            connect()
            return
          }
          giveUp('refresh-failed')
        })()
      }
      es.addEventListener('insights', onInsights)
    }

    connect()

    return () => {
      disposed = true
      source?.close()
      setLive(false)
    }
  }, [queryClient])

  return { live, error }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
