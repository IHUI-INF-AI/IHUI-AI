'use client'

// 平台特有:依赖 DOM API(Canvas/WebGL/screen/navigator),不适合共享

import * as React from 'react'
import { createDeviceFingerprintCollector, type DeviceFingerprintInput } from '@ihui/types'

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

/**
 * Web 端设备指纹采集器(模块级单例)。
 * 由 api-client 注入后,所有请求自动携带 x-device-fingerprint header。
 */
export const webDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: collectWeb,
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
