// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * expo-media-library 的 web 平台 stub(由 metro.config.cjs resolveRequest 注入,
 * 仅 platform === 'web' 时把 'expo-media-library' 重定向到本文件)。
 *
 * 平台特有:expo-media-library 的 TS 入口在模块顶层 requireNativeModule
 * ('ExpoMediaLibraryNext'),web 平台无该原生模块,import 即抛
 * "Cannot find native module" 导致整个 bundle 白屏。
 * web 上用占位实现降级:保存相册相关调用返回失败,由调用方 Alert 兜底。
 */

export class Asset {
  uri: string
  filename?: string

  constructor(uri: string, filename?: string) {
    this.uri = uri
    this.filename = filename
  }
}

export interface MediaLibraryPermissionResponse {
  granted: boolean
  canAskAgain: boolean
  status: string
}

async function requestPermissionsAsync(): Promise<MediaLibraryPermissionResponse> {
  console.warn('[web-stub] expo-media-library 在 web 平台不可用,权限请求返回拒绝')
  return { granted: false, canAskAgain: false, status: 'denied' }
}

async function createAssetAsync(_uri: string): Promise<Asset | null> {
  console.warn('[web-stub] expo-media-library 在 web 平台不可用,createAssetAsync 返回 null')
  return null
}

async function saveToLibraryAsync(_localUri: string): Promise<void> {
  console.warn('[web-stub] expo-media-library 在 web 平台不可用,saveToLibraryAsync 静默跳过')
}

export { requestPermissionsAsync, createAssetAsync, saveToLibraryAsync }
