// 平台特有:依赖 DOM API(Tauri WebView),不适合共享
import { createDeviceFingerprintCollector } from '@ihui/types'

/**
 * desktop 端设备指纹采集器(Tauri 2 WebView)。
 *
 * Tauri WebView 提供 DOM API(navigator / window.screen / Intl),
 * 采集 userAgent / screen / timezone / language / hardwareConcurrency。
 * 不采集 canvas/webgl(性能开销,desktop 端暂不需要)。
 *
 * 注意:desktop 当前为纯 Tauri Rust shell,前端入口待接入。
 * 本 adapter 在前端入口就绪后通过 setDeviceFingerprintProvider 注入。
 */
export const desktopDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: () => ({
    platform: 'tauri-desktop',
    userAgent: navigator.userAgent,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency,
  }),
})
