// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

// 平台特有:web stub,由 metro.config.cjs 在 platform=web 时 alias 到此文件。
// expo-media-library 是纯原生模块,web 端 import 即抛
// "Cannot find native module 'ExpoMediaLibraryNext'",导致整页白屏。
// web 端无系统相册写入能力,所有 API 返回安全降级值。

const denied = { granted: false, status: 'denied', canAskAgain: false, isUndetermined: false }

/** web 端无媒体库权限流程,恒返回 denied */
export async function requestPermissionsAsync() {
  return denied
}

export async function getPermissionsAsync() {
  return denied
}

/** web 端不写入相册,返回 null(调用方需判空) */
export async function createAssetAsync() {
  return null
}

/** web 端不写入相册,静默跳过 */
export async function saveToLibraryAsync() {
  return undefined
}
