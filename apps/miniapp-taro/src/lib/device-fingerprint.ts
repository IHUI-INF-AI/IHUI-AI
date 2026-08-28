// 平台特有:依赖 Taro API(getDeviceInfo/getWindowInfo/getAppBaseInfo),不适合共享
import { getSystemInfoCompat } from '../utils/system-info'
import { createDeviceFingerprintCollector } from '@ihui/types'

/**
 * miniapp-taro 端设备指纹采集器(Taro 4 小程序)。
 *
 * 通过 getSystemInfoCompat()(封装新 API getDeviceInfo/getWindowInfo/getAppBaseInfo)采集设备信息:
 * - platform: `${brand}-${platform}`(如 "iPhone-ios" / "devtools-devtools")
 * - screen: screenWidth / screenHeight / pixelRatio * 8(色深估算)
 * - language: systemInfo.language
 * hardwareConcurrency 小程序不暴露,返回 undefined。
 */
export const taroDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: () => {
    const info = getSystemInfoCompat()
    return {
      platform: `${info.brand}-${info.platform}`,
      screen: {
        width: info.screenWidth,
        height: info.screenHeight,
        colorDepth: info.pixelRatio * 8,
      },
      language: info.language,
    }
  },
})
