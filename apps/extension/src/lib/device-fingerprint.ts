// 平台特有:依赖 Chrome Extension API(DOM),不适合共享
import { createDeviceFingerprintCollector } from '@ihui/types'

/**
 * extension 端设备指纹采集器(Chrome Extension)。
 *
 * Chrome Extension 环境(background SW / popup / sidepanel)提供 DOM API,
 * 采集 userAgent / screen / timezone / language / hardwareConcurrency。
 * 不采集 canvas/webgl(性能开销,extension 端暂不需要)。
 */
export const extensionDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: () => ({
    platform: 'chrome-extension',
    userAgent: navigator.userAgent,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency,
  }),
})
