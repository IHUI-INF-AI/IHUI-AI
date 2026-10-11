// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { createUseConnectivity } from '@ihui/shared/hooks/use-connectivity'
import type {
  ConnectivityBannerKind,
  ConnectivityReason,
  ConnectivityStatus,
} from '@ihui/shared/utils/connectivity'
import { probeConnectivityRound } from '../lib/network-probe'

/**
 * 网络状态 Context(台账 G-1113920 重写,2026-10-11)。
 *
 * 旧实现是一份布尔状态机:`fetch('/api/health')` 超时 5s、`setIsOnline(resp.ok)`、一次失败即
 * 离线、30s 才复探。它把三件不同的事压成同一个 `false`:
 * ① 服务器答了但业务失败(4xx/5xx)→ 路径其实是通的;
 * ② 探测目标本身不可达(开发构建指向 `http://localhost:8802`,真机上那就是手机自己);
 * ③ 设备真没网。
 * 三档都渲染成红色「网络已断开」,而票面同屏的 `ping` 与 `dumpsys connectivity` 证明是 ①/②。
 *
 * 现形态:判据(档位 / 阈值 / 横幅映射)在 `@ihui/shared/utils/connectivity` 那一份,端内只注入
 * 「怎么探」的 adapter(见 `src/lib/network-probe.ts`),排期与自适应复探在
 * `@ihui/shared/hooks/use-connectivity`。恢复路径不需要用户动手:非 online 档按 `retryIntervalMs`
 * 复探,**一次收到应答即解除横幅**。
 */
const useConnectivity = createUseConnectivity({
  probeRound: probeConnectivityRound,
  // 常规 30s 轮询保持不变(省流量);判不出/慢/离线时 8s 复探,保证恢复及时且不放松判据。
  intervalMs: 30_000,
  retryIntervalMs: 8_000,
})

export interface NetworkContextValue {
  status: ConnectivityStatus
  reason: ConnectivityReason
  /** 本轮最快一次应答耗时;未判到时是 null(不是 0)。 */
  latencyMs: number | null
  consecutiveFailedRounds: number
  /** 逐条点名"哪一格没判到 / 探的是哪个目标",写日志用。 */
  detail: string[]
  banner: ConnectivityBannerKind
  /** 严格在线。慢网与未判定都是 false —— 消费方不得拿它当"设备没网"渲染红色。 */
  isOnline: boolean
  refresh: () => void
}

const NetworkContext = React.createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const value = useConnectivity()
  // detail 每次结论变化时留一行可归因的日志:横幅不再只说"断网",而是说得清是哪一格。
  React.useEffect(() => {
    if (value.status === 'unknown' || value.status === 'slow') {
      console.log(`[network] status=${value.status} reason=${value.reason}`, value.detail)
    }
  }, [value.status, value.reason, value.detail])
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork(): NetworkContextValue {
  const ctx = React.useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider')
  return ctx
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
