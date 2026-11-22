// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface AnalyticsEvent {
  name: string
  category?: string
  label?: string
  value?: number
  props?: Record<string, unknown>
}

export interface UseAnalyticsReturn {
  track: (event: AnalyticsEvent) => void
  trackPageView: (path: string, title?: string) => void
  trackClick: (label: string, category?: string) => void
  flush: () => Promise<void>
  /** 使用 sendBeacon 同步发送(页面卸载场景,fetch 不可靠) */
  flushBeacon: () => void
}

// =============================================================================
// 埋点 opt-out(2026-10-03 数据出域合规整改)
// =============================================================================
// 整改前:web 埋点无任何 opt-out,用户关不掉、也读不到自己的选择。
// 整改后判定链(短路优先级从高到低):
//   1. DNT 开启 → 不发。浏览器 navigator.doNotTrack / window.doNotTrack === '1'。
//      最高优先级:用户已在浏览器侧表达过全局拒绝,不该被应用内偏好覆盖。
//   2. 应用内偏好 /settings/privacy 的 analyticsEnabled === 'false' → 不发。
//   3. 其余一切情况(含偏好缺省、读取失败、SSR)→ 发。
// 第 3 条的取向是刻意的:缺省等于现状行为,不静默改变既有采集口径。
//
// 缓存策略:模块级内存变量 + in-flight promise 去重,避免多个组件挂载时并发拉同一个偏好。
// 生命周期跟 SPA 会话一致(刷新即失效,登录/登出后由调用方再拉一次)。

/** 应用内偏好是否允许埋点。null = 尚未拉取或拉取失败,按「允许」处理 */
let analyticsEnabled: boolean | null = null
/** in-flight 去重:并发调用共享同一次网络请求 */
let consentRequest: Promise<void> | null = null

/**
 * 浏览器 Do Not Track。
 * 规范里 navigator.doNotTrack 是主位置,window.doNotTrack 是旧版遗留,两者都读。
 * 注意 DNT 的取值语义:规范允许 '1' / '0' / 'unspecified' 等多种形式,
 * 这里只认明确的 '1'(明确拒绝),其余(含 undefined)一律视为未开启。
 */
export function isDoNotTrackEnabled(): boolean {
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return true
  if (typeof window !== 'undefined' && (window as { doNotTrack?: string }).doNotTrack === '1') {
    return true
  }
  return false
}

/** 当前是否允许发送埋点。判定链见上方注释 */
export function isAnalyticsEnabled(): boolean {
  if (isDoNotTrackEnabled()) return false
  return analyticsEnabled !== false
}

/**
 * 拉取一次用户埋点偏好并写入模块级缓存。供登录后 / 根组件挂载时调用。
 * 失败(含未登录导致 401、网络异常)时保持默认开启 —— 与整改前行为一致。
 * @returns 拉取结束后是否允许埋点(便于调用方直接判断)
 */
export async function refreshAnalyticsConsent(): Promise<boolean> {
  if (!consentRequest) {
    consentRequest = (async () => {
      try {
        const res = await fetchApi<{ settings?: Record<string, string> }>('/settings/privacy')
        if (res.success) {
          // 缺省 'true'(开启)。只认显式字符串 'false' —— 后端 PUT 把值统一 String() 落库。
          analyticsEnabled = res.data?.settings?.analyticsEnabled !== 'false'
        }
      } catch {
        // 拉取失败按默认开启,不阻塞主流程
      }
    })().finally(() => {
      consentRequest = null
    })
  }
  await consentRequest
  return isAnalyticsEnabled()
}

/** 单测用:重置模块级 consent 缓存(避免用例间串味) */
export function __resetAnalyticsConsentForTests(): void {
  analyticsEnabled = null
  consentRequest = null
}

/** 分析追踪 Hook，本地缓冲事件批量上报，卸载时自动 flush */
export function useAnalytics(): UseAnalyticsReturn {
  const bufferRef = React.useRef<AnalyticsEvent[]>([])
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = React.useCallback(async () => {
    if (bufferRef.current.length === 0) return
    // 已 opt-out:把缓冲区**丢弃**而不是照常发送。
    // 埋点是有时效的,等用户下次打开页面再补发既无意义,也违背"关掉就别再送"的语义。
    if (!isAnalyticsEnabled()) {
      bufferRef.current.length = 0
      return
    }
    const batch = bufferRef.current.splice(0, bufferRef.current.length)
    const res = await fetchApi('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ events: batch }),
    })
    // 2026-08-02 修复:fetch 失败时把事件放回 buffer 头部,下次 flush 重试
    if (!res.success) {
      bufferRef.current.unshift(...batch)
    }
  }, [])

  const scheduleFlush = React.useCallback(() => {
    // 2026-08-02 修复:已有 timer 时不重置,保证持续事件流最终会 flush
    if (flushTimerRef.current) return
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      void flush()
    }, 5000)
  }, [flush])

  const track = React.useCallback(
    (event: AnalyticsEvent) => {
      // opt-out 闸门:不发网络请求,也不入队。
      // 放在入队前而非 flush 时,是为了让关闭后不再累积无意义的待发数据。
      if (!isAnalyticsEnabled()) return
      bufferRef.current.push({ ...event, props: { ...event.props, ts: Date.now() } })
      if (bufferRef.current.length >= 20) {
        void flush()
      } else {
        scheduleFlush()
      }
    },
    [flush, scheduleFlush],
  )

  const trackPageView = React.useCallback(
    (path: string, title?: string) => {
      track({ name: 'page_view', category: 'navigation', label: title ?? path, props: { path } })
    },
    [track],
  )

  const trackClick = React.useCallback(
    (label: string, category = 'ui') => {
      track({ name: 'click', category, label })
    },
    [track],
  )

  React.useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      void flush()
    }
  }, [flush])

  // 2026-08-02 修复:beforeunload 中 async fetch 不可靠,用 sendBeacon 同步发送
  const flushBeacon = React.useCallback(() => {
    if (bufferRef.current.length === 0) return
    // 与 flush 同一道闸:opt-out 后连 sendBeacon 也不发(它是真实网络请求,不是本地队列)
    if (!isAnalyticsEnabled()) {
      bufferRef.current.length = 0
      return
    }
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      void flush()
      return
    }
    const batch = bufferRef.current.splice(0, bufferRef.current.length)
    const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' })
    const ok = navigator.sendBeacon('/api/analytics/track', blob)
    // sendBeacon 失败(队列满),放回 buffer
    if (!ok) bufferRef.current.unshift(...batch)
  }, [flush])

  return { track, trackPageView, trackClick, flush, flushBeacon }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
