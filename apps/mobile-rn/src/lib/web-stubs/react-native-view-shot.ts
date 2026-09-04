// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * react-native-view-shot 的 web 平台 stub(由 metro.config.cjs resolveRequest 注入,
 * 仅 platform === 'web' 时把 'react-native-view-shot' 重定向到本文件)。
 *
 * 平台特有:view-shot 依赖原生截图能力(requireNativeComponent),web 无对应实现,
 * captureRef 返回空字符串,调用方(截图保存到相册链路)在 web 上静默降级。
 */

/** 与 react-native-view-shot CaptureOptions 兼容的宽松类型(web 无需精确约束) */
export interface CaptureOptions {
  format?: 'png' | 'jpg' | 'jpeg' | 'webm'
  quality?: number
  result?: 'file' | 'base64' | 'tmpfile' | 'zip' | 'raw'
  [key: string]: unknown
}

export async function captureRef(_viewRef: unknown, _options?: CaptureOptions): Promise<string> {
  console.warn('[web-stub] react-native-view-shot 在 web 平台不可用,captureRef 返回空')
  return ''
}

export async function captureScreen(_options?: CaptureOptions): Promise<string> {
  console.warn('[web-stub] react-native-view-shot 在 web 平台不可用,captureScreen 返回空')
  return ''
}

export default { captureRef, captureScreen }
