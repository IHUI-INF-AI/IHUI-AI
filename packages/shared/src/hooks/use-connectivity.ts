// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 在线状态 hook 的工厂(AGENTS §3:跨端 hook 用「共享实现 + 各端注入 adapter」)。
 *
 * 判据(档位、阈值语义、横幅映射)全部住在 `../utils/connectivity`,本文件只做三件事:
 * ① 持有 tracker;② 按档位自适应地排下一次探测(非 online 时更快重试 ⇒ **自动恢复**,
 * 不靠用户手动刷新);③ 把结论暴露成响应式状态。
 *
 * 各端只写 adapter(怎么发请求、怎么拿设备信号),**禁止**在端内再抄一份 `if (失败) 离线`。
 */
import * as React from 'react'
import {
  bannerKindFor,
  createConnectivityTracker,
  DEFAULT_CONNECTIVITY_THRESHOLDS,
  type ConnectivityBannerKind,
  type ConnectivityReason,
  type ConnectivitySnapshot,
  type ConnectivityStatus,
  type ConnectivityThresholds,
  type ProbeRound,
} from '../utils/connectivity'

export interface ConnectivityAdapter {
  /** 跑一轮探测并返回纯数据样本;抛错等于本轮"没有样本",由实现自行兜底成 not-probed。 */
  readonly probeRound: () => Promise<ProbeRound>
  readonly thresholds?: ConnectivityThresholds
  /** online 档的常规轮询间隔。 */
  readonly intervalMs?: number
  /** 非 online 档(慢 / 未判定 / 离线)的重试间隔 —— 必须显著短于 intervalMs,否则恢复要等一整轮。 */
  readonly retryIntervalMs?: number
  /** 探测自身异常时的出口(端上打日志用;不得据此判离线)。 */
  readonly onProbeError?: (error: unknown) => void
}

export interface UseConnectivityReturn extends ConnectivitySnapshot {
  readonly banner: ConnectivityBannerKind
  /** 严格在线(= status==='online');慢网与未判定都是 false,消费方别拿它当"没网"渲染红色。 */
  readonly isOnline: boolean
  readonly reason: ConnectivityReason
  /** 立即重探一次(在途则复用同一次探测,不并发打服务器)。 */
  readonly refresh: () => void
}

export function createUseConnectivity(adapter: ConnectivityAdapter): () => UseConnectivityReturn {
  const thresholds = adapter.thresholds ?? DEFAULT_CONNECTIVITY_THRESHOLDS
  const intervalMs = adapter.intervalMs ?? 30_000
  const retryIntervalMs = adapter.retryIntervalMs ?? 10_000

  return function useConnectivity(): UseConnectivityReturn {
    const trackerRef = React.useRef(createConnectivityTracker(thresholds))
    const [snapshot, setSnapshot] = React.useState<ConnectivitySnapshot>(() =>
      trackerRef.current.peek(),
    )
    const inFlightRef = React.useRef(false)
    const mountedRef = React.useRef(true)
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const runProbe = React.useCallback(async (): Promise<void> => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      let next: ConnectivitySnapshot
      try {
        const round = await adapter.probeRound()
        next = trackerRef.current.observe(round)
      } catch (error) {
        // 探测机制本身坏了 ⇒ 未判定(逐条报名),绝不冒红、也不冻结上一次的"离线"结论。
        adapter.onProbeError?.(error)
        next = trackerRef.current.observe({
          deviceSignal: 'unknown',
          samples: [
            {
              target: 'connectivity-probe',
              kind: 'not-probed',
              reason: `探测抛出异常:${String(error)}`,
            },
          ],
        })
      } finally {
        inFlightRef.current = false
      }
      if (mountedRef.current) setSnapshot(next)
    }, [adapter])

    // 自适应排期:非 online 档用更短的间隔复探 ⇒ 网络一通,横幅一次成功即解除。
    React.useEffect(() => {
      mountedRef.current = true
      void runProbe()
      return () => {
        mountedRef.current = false
      }
    }, [runProbe])

    React.useEffect(() => {
      const delay = snapshot.status === 'online' ? intervalMs : retryIntervalMs
      timerRef.current = setTimeout(() => {
        void runProbe()
      }, delay)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }, [snapshot.status, runProbe, intervalMs, retryIntervalMs])

    const refresh = React.useCallback(() => {
      void runProbe()
    }, [runProbe])

    return {
      ...snapshot,
      banner: bannerKindFor(snapshot),
      isOnline: snapshot.status === 'online',
      refresh,
    }
  }
}

export type { ConnectivityStatus }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
