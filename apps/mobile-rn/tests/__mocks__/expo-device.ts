/**
 * expo-device 测试替身。
 *
 * 为什么必须有:真包 build/Device.js 链式 import 'expo-modules-core',pnpm 严格布局下它的
 * 兄弟面没有该依赖 ⇒ vite 在**收集期**解析失败,凡经 src/platform/device.ts 的套件整体
 * 加载不了("Test Files N failed",一条断言都没跑)。收口在配置层(vitest.config.ts alias),
 * 与 expo-blur / expo-file-system / expo-audio 同型;逐套件加局部 vi.mock 正是要根治的反模式。
 *
 * 覆盖面按 src 里实际用到的成员给(不是全量 API):
 *   Device.isDevice(src/hooks/use-push.ts)
 *   modelId(src/lib/device-fingerprint.ts,iOS 机型段)
 * 其余常量按真包的常见字段给静态值,测试态不依赖真机能力。
 */

export const isDevice = true
export const modelId = 'iPhone16,2'
export const modelName = 'iPhone 16'
export const deviceName = 'Test Device'
export const brand = 'Apple'
export const manufacturer = 'Apple'
export const osName = 'iOS'
export const osVersion = '18.0'
export const platformApiLevel = 34

export enum DeviceType {
  Unknown = 0,
  Phone = 1,
  Tablet = 2,
  Desktop = 3,
  TV = 4,
}

export async function getDeviceTypeAsync(): Promise<DeviceType> {
  return DeviceType.Phone
}

export async function getUptimeAsync(): Promise<number> {
  return 0
}

export async function getMaxMemoryAsync(): Promise<number> {
  return 0
}

export async function getPlatformApiLevelAsync(): Promise<number> {
  return platformApiLevel
}
