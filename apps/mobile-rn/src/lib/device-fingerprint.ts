// 平台特有:依赖 React Native API(Platform),不适合共享
import { Platform } from 'react-native'
import { createDeviceFingerprintCollector } from '@ihui/types'

/**
 * mobile-rn 端设备指纹采集器(React Native)。
 *
 * RN 环境无 DOM,仅采集 platform(Platform.OS: 'ios' | 'android')。
 * react-native-device-info 未安装,hardwareConcurrency 不采集(返回 undefined)。
 * 不引入新依赖(AGENTS.md §3 零依赖自实现)。
 */
export const mobileRnDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: () => ({
    platform: Platform.OS,
  }),
})
