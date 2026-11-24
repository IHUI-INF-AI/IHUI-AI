// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 票85③/④ —— web 端连通性 hook:**只做 adapter,不做判据、不做排期**。
//
// 判据只有一份,住在 `packages/shared/src/utils/connectivity.ts`
// (`classifyRound` / `createConnectivityTracker` / `bannerKindFor`);
// 排期也只有一份,住在 `packages/shared/src/hooks/use-connectivity.ts`
// (`createUseConnectivity`:持有 tracker + 按档位自适应复探 + 响应式暴露)。
// RN 端消费同两份(`apps/mobile-rn/src/context/NetworkContext.tsx`)。
//
// 本文件剩下的职责被刻意压到两条:
//   ① 怎么探(fetch /api/health + AbortController 计时,web 端唯一形态);
//   ② web 独有的浏览器事件(online/offline/visibilitychange)触发一次立即复核。
//
// 2026-10-19 二次纠偏:初版在 web 端自造四态(第二份判据),改 adapter 后仍自己写了一套
// 轮询/排期(第三份)。现在连排期也交回共享层 —— 各端只许注入"怎么探"。
//
// 语义要点(沿用共享层,不得本地改写):
// - 拿到任何 HTTP 响应(含 5xx)= 传输路径存在 ⇒ online/slow,**不是离线**;
// - 设备信号报无网但探测有应答 ⇒ 按应答为准(交叉反证优先于单一信号);
// - 探测全失败 + 设备在线 ⇒ unknown(只报"连不上服务器"),连续 3 轮才落 offline;
// - 一次都没探过 ⇒ unknown(no-sample),**不等于在线**。

import * as React from 'react'
import { createUseConnectivity } from '@ihui/shared/hooks/use-connectivity'
import type { ProbeRound, ProbeSample } from '@ihui/shared/utils/connectivity'

import { resolveApiBaseUrl } from '@/lib/api-base-url'

const PROBE_TIMEOUT_MS = 5_000

/** web 端唯一的探测形态:HTTP GET /api/health,任何响应都算"答了"。 */
async function probeSample(target: string): Promise<ProbeSample> {
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const resp = await fetch(target, { cache: 'no-store', signal: controller.signal })
    // 拿到响应(任何状态码)即 L7 应答 —— 服务健康度不是本判据的事实面
    return {
      target,
      kind: 'response',
      httpStatus: resp.status,
      latencyMs: Math.round(performance.now() - started),
    }
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    // AbortError=超时(慢网/断网共同形状,单独不足以判离线);其余=链路层失败
    return isAbort
      ? { target, kind: 'timeout', latencyMs: Math.round(performance.now() - started) }
      : { target, kind: 'unreachable', detail: String(err) }
  } finally {
    clearTimeout(timer)
  }
}

/** 一轮探测:设备信号 + 目标样本,纯数据,交给共享层判。 */
async function probeWebRound(): Promise<ProbeRound> {
  // 平台信号:web 只有 navigator.onLine(只报有网/无网),拿不到时必须 unknown ——
  // 用"探测失败"反推设备无网正是共享层要消除的并档。
  const deviceSignal: ProbeRound['deviceSignal'] =
    typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean'
      ? 'unknown'
      : navigator.onLine
        ? 'online'
        : 'offline'
  const sample = await probeSample(`${resolveApiBaseUrl()}/api/health`)
  return { deviceSignal, samples: [sample] }
}

const useSharedConnectivity = createUseConnectivity({
  probeRound: probeWebRound,
  // 与 RN 端同档:常规 30s 轮询;非 online 档 10s 复探(web 端有真实 online 事件兜底,
  // 不必比 RN 的 8s 更激进)。
  intervalMs: 30_000,
  retryIntervalMs: 10_000,
})

/**
 * web 端连通性结论。返回值形状与 RN `useNetwork()` 同构(status/reason/latencyMs/
 * detail/banner/isOnline/refresh),端上只许消费不许重判。
 */
export function useConnectivity() {
  const value = useSharedConnectivity()
  const { refresh } = value

  // 浏览器事件只是"催一次复核"的信号,结论仍由探测给出 —— 事件本身不进判据。
  React.useEffect(() => {
    const onEvent = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('online', onEvent)
    window.addEventListener('offline', onEvent)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onEvent)
      window.removeEventListener('offline', onEvent)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  return value
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
