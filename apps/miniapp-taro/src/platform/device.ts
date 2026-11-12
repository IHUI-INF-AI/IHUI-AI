// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `@/platform/device` 的小程序腿 —— 转出口。标识取 `rn-compat/native-extras` 那一份
 * (Taro 系统信息),不新造设备指纹口径(§0.6:设备标识只能有一处取数)。
 */
import * as DeviceImpl from '../rn-compat/native-extras'

export const Device = DeviceImpl
export const modelId = DeviceImpl.modelId
export const modelName = DeviceImpl.modelName
export const osName = DeviceImpl.osName
export const osVersion = DeviceImpl.osVersion
export const getDeviceTypeAsync = DeviceImpl.getDeviceTypeAsync
