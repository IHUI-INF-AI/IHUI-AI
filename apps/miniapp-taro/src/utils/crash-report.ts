// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序全局崩溃上报(2026-08-06 新增,打通崩溃率链路)。
 *
 * Taro 小程序没有 React ErrorBoundary 全局兜底,用 Taro.onError + Taro.onUnhandledRejection
 * 捕获全局 JS 错误与未处理 Promise 拒绝,POST 到 /api/crash-reports(匿名可上报)。
 * 上报静默失败,绝不干扰业务。
 *
 * 2026-10-23 收口守门 214(check-crash-report-redaction)登记的第二处客户端发射点:
 *  ① 拒绝原因常常是**裸对象**(微信把 `showToast` 参数错误 reject 成 `{errno, errMsg}`),
 *    `String(reason)` 只会得到 `[object Object]`,而 `stack` 这一列此前**从来没发过**
 *    ⇒ 2026-10-23 查「一键登录点了没反应」时,库里两条记录等于没记,只能回到开发者工具
 *    控制台重看一遍才拿到真文案。现在按 Error / 对象 / 标量三形收成一句人话,并带 stack。
 *  ② 发射前一律过共享层唯一出口 `redactCrashText`(服务端 `recordCrash` 还会再兜一道,
 *    但端内不得因为"服务端会兜"就不脱敏 —— 原文出设备这一步本身就不可逆)。
 */

import Taro from '@tarojs/taro'
import { redactCrashText } from '@ihui/shared/utils/redact'
import { BASE_URL } from './api-config'

/** 服务端 zod 上限:`errorMessage.max(4000)` / `stack.max(20000)`,超了会被整条拒收 */
const MAX_MESSAGE = 4000
const MAX_STACK = 20000
/** 裸对象最多展开几个键 —— 再多就只是把别人的 payload 抄进日志,对定位无益 */
const MAX_OBJECT_KEYS = 8

let inited = false

/** 单个值收成一句短文本:只取"能认出是哪一格"的信息,不整份抄 payload */
function shapeValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  const t = typeof v
  if (t === 'string') return JSON.stringify((v as string).slice(0, 160))
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v)
  if (t === 'function') return 'function'
  if (t === 'symbol') return (v as symbol).toString()
  if (Array.isArray(v)) return `array(${v.length})`
  const err = v as Partial<Error>
  if (typeof err.message === 'string') return `Error(${err.message.slice(0, 160)})`
  return `object(${Object.keys(v as Record<string, unknown>)
    .slice(0, MAX_OBJECT_KEYS)
    .join(',')})`
}

/**
 * 把任意拒绝原因收成「一句 message + 可选 stack」。
 * 三条分支各有成对夹具(见 tests/crash-report-describe.test.ts),摘掉任一臂即翻红。
 */
export function describeReason(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return {
      message: reason.message || reason.name || 'Error',
      stack: typeof reason.stack === 'string' ? reason.stack : undefined,
    }
  }
  if (reason !== null && typeof reason === 'object') {
    const entries = Object.entries(reason as Record<string, unknown>)
    const parts = entries.slice(0, MAX_OBJECT_KEYS).map(([k, v]) => `${k}=${shapeValue(v)}`)
    if (entries.length > MAX_OBJECT_KEYS) parts.push(`…+${entries.length - MAX_OBJECT_KEYS}keys`)
    const stack = (reason as { stack?: unknown }).stack
    return {
      message: parts.length > 0 ? parts.join(' ') : 'object(无可枚举自有键)',
      stack: typeof stack === 'string' ? stack : undefined,
    }
  }
  return { message: String(reason) }
}

/** 当前页栈顶的 route(拿不到就留空,不编造) */
function currentRoute(): string | undefined {
  try {
    const pages = Taro.getCurrentPages()
    const top = pages.length > 0 ? pages[pages.length - 1] : undefined
    const route = top?.route
    return typeof route === 'string' && route.length > 0 ? route.slice(0, 512) : undefined
  } catch {
    return undefined
  }
}

/** 初始化全局崩溃捕获(幂等:多入口调用只注册一次)。 */
export function initCrashReport(): void {
  if (inited) return
  inited = true
  try {
    Taro.onError((error) => {
      const d = describeReason(error)
      reportCrash(d.message, d.stack)
    })
    Taro.onUnhandledRejection((res) => {
      const reason = (res as { reason?: unknown } | undefined)?.reason
      const d = describeReason(reason)
      reportCrash(`unhandled rejection: ${d.message}`, d.stack)
    })
  } catch {
    /* 小程序低版本无 onUnhandledRejection 时静默 */
  }
}

function reportCrash(rawMessage: string, rawStack?: string): void {
  try {
    // 兜底不得为假:脱敏后整句为空 ⇒ 宁可留一个占位文案,也不能上报一条空消息
    const message = redactCrashText(rawMessage || 'unknown error').slice(0, MAX_MESSAGE)
    const stack = rawStack ? redactCrashText(rawStack).slice(0, MAX_STACK) : undefined
    const task = Taro.request({
      url: `${BASE_URL}/crash-reports`,
      method: 'POST',
      data: {
        platform: 'wechat-miniapp',
        errorMessage: message || 'unknown error',
        ...(stack ? { stack } : {}),
        ...(currentRoute() ? { route: currentRoute() } : {}),
      },
      header: { 'Content-Type': 'application/json' },
      success: () => {},
      fail: () => {},
    })
    // Taro.request 在 H5 模式下返回 Promise,必须 catch 防止未处理 rejection
    // (403/网络错误等会触发 unhandledrejection → webpack overlay 弹窗)
    if (task && typeof (task as Promise<unknown>).catch === 'function') {
      ;(task as Promise<unknown>).catch(() => {})
    }
  } catch {
    /* 上报失败静默 */
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
