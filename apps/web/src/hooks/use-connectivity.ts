// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 票85③ —— 连通性四态 hook(离线/边缘优先降级的用户侧地基)。
//
// 为什么是四态而不是布尔 online/offline:**四种事实互不可折叠**(与宿主 git 通道
// 三态纪律同族)——
//   device-offline   本机断网(navigator.onLine=false,本地事实,立即可判);
//   api-unreachable  本机有网但 api 探测失败(fetch 抛错=链路不通);
//   online           探测拿到 HTTP 响应(链路通;服务本身 5xx 是另一格事实,
//                    由 GlobalErrorBanner 负责,这里不冒充链路判官);
//   probing          还没拿到任何结论 —— **不等于 online**,界面据此不显示横幅
//                    但也绝不把"还没探"当成"在线"。
//
// 探测端点用 /api/health(免鉴权、不触 DB/Redis,与 /api/health/ready 分工)。

import * as React from 'react'

import { resolveApiBaseUrl } from '@/lib/api-base-url'

export type ConnectivityState =
  | 'probing'
  | 'online'
  | 'api-unreachable'
  | 'device-offline'

const PROBE_OK_INTERVAL_MS = 30_000
const PROBE_RETRY_INTERVAL_MS = 10_000
const PROBE_TIMEOUT_MS = 5_000

async function probeOnce(signal: AbortSignal): Promise<boolean> {
  const base = resolveApiBaseUrl()
  const resp = await fetch(`${base}/api/health`, {
    cache: 'no-store',
    signal,
  })
  // 拿到任何 HTTP 响应都算"链路通"(健康与否是服务层的事,这里只判链路)
  return resp.status > 0
}

export function useConnectivity(): { state: ConnectivityState; lastCheckedAt: number | null } {
  const [state, setState] = React.useState<ConnectivityState>('probing')
  const [lastCheckedAt, setLastCheckedAt] = React.useState<number | null>(null)
  const stateRef = React.useRef<ConnectivityState>('probing')
  stateRef.current = state

  const probe = React.useCallback(async () => {
    // 本机断网是本地事实,不发请求直接定格(发了也只会白等超时)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState('device-offline')
      setLastCheckedAt(Date.now())
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      await probeOnce(controller.signal)
      setState('online')
    } catch {
      // abort(超时)与 fetch 抛错同格:链路不通。不细分 —— "服务活着但 5xx"
      // 不是本 hook 的事实面。
      setState('api-unreachable')
    } finally {
      clearTimeout(timer)
      setLastCheckedAt(Date.now())
    }
  }, [])

  React.useEffect(() => {
    void probe()
    // 稳态 30s;非在线 10s(重连窗口更快收敛,但不打爆不健康的服务)
    const interval = () =>
      stateRef.current === 'online' ? PROBE_OK_INTERVAL_MS : PROBE_RETRY_INTERVAL_MS
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        void probe().then(schedule)
      }, interval())
    }
    schedule()
    // 浏览器连通性事件:立即复核(事件只是信号,结论仍由探测给出)
    const onOnline = () => void probe()
    const onOffline = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setState('device-offline')
        setLastCheckedAt(Date.now())
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void probe()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [probe])

  return { state, lastCheckedAt }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
