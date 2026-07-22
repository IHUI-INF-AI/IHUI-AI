'use client'

import * as React from 'react'

/**
 * 网络状态 Context(2026-07-22 P0 Round 5 鲁棒性加固)。
 *
 * 不引入 @react-native-community/netinfo 原生依赖,用轻量 fetch 探测:
 * - 每 30s 探测一次 /api/health 端点
 * - 失败 → isOnline=false,成功 → isOnline=true
 * - 探测超时 5s(短于 fetchApi 默认 30s,快速感知断网)
 */
const PROBE_INTERVAL_MS = 30_000
const PROBE_TIMEOUT_MS = 5_000
const PROBE_URL = '/api/health'

interface NetworkContextValue {
  isOnline: boolean
}

const NetworkContext = React.createContext<NetworkContextValue>({ isOnline: true })

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const probe = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
        // 用原生 fetch,避免依赖 @ihui/api-client 的 token 注入(health 端点无需鉴权)
        const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001'
        const resp = await fetch(`${baseUrl}${PROBE_URL}`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!cancelled) setIsOnline(resp.ok)
      } catch {
        if (!cancelled) setIsOnline(false)
      }
    }

    // 启动时立即探测一次
    void probe()
    timer = setInterval(probe, PROBE_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  const value = React.useMemo(() => ({ isOnline }), [isOnline])
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork(): NetworkContextValue {
  return React.useContext(NetworkContext)
}
