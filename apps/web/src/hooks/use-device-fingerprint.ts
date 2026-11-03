// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 平台特有:依赖 DOM API(Canvas/WebGL/screen/navigator),不适合共享

import * as React from 'react'
import { createDeviceFingerprintCollector, type DeviceFingerprintInput } from '@ihui/types'
import { isTauriRuntime } from '@/lib/api-base-url'

/* -------------------------------------------------------------------------- */
/* Hash 工具(djb2,内联实现,零依赖)                                          */
/* -------------------------------------------------------------------------- */

/**
 * djb2 字符串 hash,输出 8 字符 16 进制。
 * 跨端兼容:不依赖 node:crypto(RN/Taro 环境无此模块)。
 */
function djb2Hash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + charCode,等价于 ((hash << 5) + hash) + c
    hash = (hash << 5) + hash + input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * 生成 16 字符 hash(2 段 djb2 拼接 + slice,降低碰撞率)。
 */
function hash16(input: string): string {
  return (djb2Hash(input) + djb2Hash(`salt::${input}`)).slice(0, 16)
}

/* -------------------------------------------------------------------------- */
/* Canvas / WebGL 指纹采集                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Canvas 渲染指纹:渲染特定文本+图形,toDataURL 后 hash。
 * Canvas 不可用(无 getContext)时返回 undefined。
 */
function collectCanvasFingerprint(): string | undefined {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    canvas.width = 280
    canvas.height = 60
    ctx.textBaseline = 'top'
    ctx.font = "14px 'Arial'"
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('IHUI-AI 设备指纹 🛡', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('IHUI-AI 设备指纹 🛡', 4, 17)
    return hash16(canvas.toDataURL())
  } catch {
    return undefined
  }
}

/**
 * WebGL 渲染器指纹:获取 RENDERER/VENDOR 参数拼接后 hash。
 * WebGL 不可用(无 getContext)时返回 undefined;
 * UNMASKED 扩展缺失时降级到普通 RENDERER/VENDOR。
 */
function collectWebglFingerprint(): string | undefined {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return undefined
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    )
    const vendor = String(
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    )
    return hash16(`${vendor}::${renderer}`)
  } catch {
    return undefined
  }
}

/* -------------------------------------------------------------------------- */
/* Web adapter 实现                                                           */
/* -------------------------------------------------------------------------- */

/**
 * 安全取值:try-catch 包裹单个字段,缺失/异常返回 undefined。
 * 对应 AGENTS.md §3 要求"用 try-catch 包裹每个字段"。
 */
function safe<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

/**
 * Web 端设备特征采集:各字段独立 try-catch,缺失字段跳过(返回 undefined)。
 * SSR 兜底:typeof window === 'undefined' 时返回空对象(注入仅在客户端,但防御性检查)。
 */
async function collectWeb(): Promise<DeviceFingerprintInput> {
  if (typeof window === 'undefined') return {}
  return {
    userAgent: safe(() => navigator.userAgent),
    screen: safe(() => ({
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    })),
    timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    language: safe(() => navigator.language),
    platform: safe(() => navigator.platform),
    // Canvas/Webgl 内部已 try-catch,缺失返回 undefined
    canvas: collectCanvasFingerprint(),
    webgl: collectWebglFingerprint(),
    hardwareConcurrency: safe(() => navigator.hardwareConcurrency),
    // navigator.deviceMemory 无标准 TS 类型声明,Chrome 专属 API,非 Chrome 浏览器为 undefined
    deviceMemory: safe(() => (navigator as unknown as { deviceMemory?: number }).deviceMemory),
  }
}

/* -------------------------------------------------------------------------- */
/* Desktop(Tauri 2 WebView)adapter 实现                                       */
/* -------------------------------------------------------------------------- */

/**
 * Desktop 端设备特征采集(同型对齐 RN 端 2026-10 修复的采集契约)。
 *
 * 与浏览器口径的差异(刻意保持不同源,契约允许各端字段集不同):
 * - `platform` 用 `tauri-desktop-<navigator.platform>`(Win32/MacIntel 的闭集),把桌面端
 *   与同 UA 的普通浏览器区分开 —— 旧实现(已删除的 apps/desktop/src/lib/device-fingerprint.ts)
 *   只喂常量 'tauri-desktop',与 RN 端修复前"全网一个 hash"同型失效,不重蹈。
 * - 不采集 canvas/webgl(沿用旧 desktop adapter 的登记理由:渲染开销,desktop 端暂不需要;
 *   WebView2 与浏览器共用 GPU 栈,两端口径本就不承诺等值)。
 * - 其余字段(UA/screen/timezone/language/CPU/内存)与浏览器同款 safe 采集。
 */
function collectDesktop(): DeviceFingerprintInput {
  if (typeof window === 'undefined') return {}
  return {
    userAgent: safe(() => navigator.userAgent),
    screen: safe(() => ({
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    })),
    timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    language: safe(() => navigator.language),
    platform: safe(() => `tauri-desktop-${navigator.platform}`),
    hardwareConcurrency: safe(() => navigator.hardwareConcurrency),
    deviceMemory: safe(() => (navigator as unknown as { deviceMemory?: number }).deviceMemory),
  }
}

/**
 * Tauri 运行时的**一次性后台补判**(非 hook 语境,语义对齐 useTauriIpcReady 的轮询参数)。
 *
 * `__TAURI_INTERNALS__` 由 webview 在页面加载后异步注入(Windows 上通常 100-500ms,
 * 见 tauri-bridge.ts / use-desktop.ts 的真机取证)—— 桌面端首采撞上未注入的窗口期时,
 * 同步判一次会把桌面端误判成浏览器。这里在按浏览器口径采完之后补一轮 50ms/3s 轮询,
 * 确认 Tauri 后置位;collectDesktopAware 在**下一次**采集(指纹缓存 TTL 60s 过期后)
 * 自动切换桌面口径。浏览器端永远探测不到,flag 恒 false,零副作用。
 */
const TAURI_IPC_POLL_INTERVAL_MS = 50
const TAURI_IPC_POLL_TIMEOUT_MS = 3000

let tauriProbeStarted = false
let tauriRuntimeConfirmed = false

function scheduleTauriRuntimeProbe(): void {
  if (tauriProbeStarted || typeof window === 'undefined') return
  tauriProbeStarted = true
  const start = Date.now()
  const check = (): void => {
    if (tauriRuntimeConfirmed) return
    if (isTauriRuntime()) {
      tauriRuntimeConfirmed = true
      return
    }
    if (Date.now() - start > TAURI_IPC_POLL_TIMEOUT_MS) return
    setTimeout(check, TAURI_IPC_POLL_INTERVAL_MS)
  }
  setTimeout(check, TAURI_IPC_POLL_INTERVAL_MS)
}

/**
 * 按运行时选采集口径:Tauri(含 IPC 晚注入补判)走 desktop,否则走浏览器。
 * 判定发生在**采集时**而非模块求值时 —— 模块求值早于 IPC 注入,在那里判一次
 * 正是 useTauriIpcReady 注释里钉死的失效型。
 */
async function collectDesktopAware(): Promise<DeviceFingerprintInput> {
  if (typeof window === 'undefined') return {}
  if (isTauriRuntime() || tauriRuntimeConfirmed) return collectDesktop()
  scheduleTauriRuntimeProbe()
  return collectWeb()
}

/**
 * Web/Desktop 端设备指纹采集器(模块级单例)。
 * 由 api-client 注入后,所有请求自动携带 x-device-fingerprint header。
 * 采集口径按运行时自动分档:浏览器走 web 字段集(canvas/webgl 在内),
 * Tauri WebView 走 desktop 字段集(platform 带 tauri-desktop- 前缀,无 canvas/webgl)。
 */
export const webDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: collectDesktopAware,
})

/* -------------------------------------------------------------------------- */
/* React Hook                                                                 */
/* -------------------------------------------------------------------------- */

export interface UseDeviceFingerprintReturn {
  /** 设备指纹(32 字符 hash),首次挂载完成前为 null */
  fingerprint: string | null
  /** 是否正在采集(首次挂载时为 true,采集完成后置 false) */
  loading: boolean
}

/**
 * 设备指纹 Hook:首次挂载时调 collector.get(),返回 { fingerprint, loading }。
 * 用于需要在组件内读取指纹的场景(如展示设备标识、调试)。
 * 指纹本身由 api-client 全局注入到 x-device-fingerprint header,无需调用此 hook。
 */
export function useDeviceFingerprint(): UseDeviceFingerprintReturn {
  const [fingerprint, setFingerprint] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    webDeviceFingerprintCollector
      .get()
      .then((result) => {
        if (cancelled) return
        setFingerprint(result.fingerprint)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { fingerprint, loading }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
