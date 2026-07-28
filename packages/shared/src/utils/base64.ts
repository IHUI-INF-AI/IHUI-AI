/**
 * 跨端 Base64 工具(自动检测原生 btoa,不存在时回退到 polyfill)。
 *
 * 背景:web 端有原生 btoa,mobile-rn Hermes 引擎无 btoa,miniapp-taro 需自定义 polyfill。
 * 统一为单一来源,消除跨端实现差异。
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * 原生 btoa 引用(模块加载时一次性捕获,避免函数内递归)。
 * web 端(DOM lib)存在原生 btoa;mobile-rn Hermes / miniapp-taro 无。
 */
const nativeBtoa: ((s: string) => string) | undefined =
  typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function'
    ? globalThis.btoa
    : undefined

/**
 * Base64 编码(自动检测原生 btoa,不存在时回退到 polyfill)。
 *
 * - web 端:使用浏览器原生 btoa
 * - mobile-rn(Hermes)/ miniapp-taro:使用 polyfill
 */
export function btoa(input: string): string {
  if (nativeBtoa) {
    return nativeBtoa(input)
  }
  // polyfill 回退(原 miniapp-taro/streaming-recognizer.ts 自定义实现)
  let output = ''
  let i = 0
  while (i < input.length) {
    const a = input.charCodeAt(i++)
    const b = i < input.length ? input.charCodeAt(i++) : NaN
    const c = i < input.length ? input.charCodeAt(i++) : NaN
    const enc1 = a >> 2
    const enc2 = ((a & 3) << 4) | (b >> 4)
    const enc3 = isNaN(b) ? 64 : ((b & 15) << 2) | (c >> 6)
    const enc4 = isNaN(c) ? 64 : c & 63
    output +=
      (BASE64_CHARS[enc1] || '') +
      (BASE64_CHARS[enc2] || '') +
      (enc3 === 64 ? '=' : BASE64_CHARS[enc3] || '') +
      (enc4 === 64 ? '=' : BASE64_CHARS[enc4] || '')
  }
  return output
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串。
 * 跨端统一实现(原 miniapp-taro/streaming-recognizer.ts 自定义实现)。
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] || 0)
  }
  return btoa(binary)
}
