// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * node 环境下的 expo-file-system 最小桩。
 *
 * 背景:RN 共享屏/薄壳页在模块求值期会 `new File(Paths.document, …)`(active-tokens 的主题
 * 偏好文件)。真包已外部化,内部 `require('react-native')` 在 Node 解析下绕过本仓 vitest 的
 * 裸包 alias ⇒ 收集期 `SyntaxError: Unexpected token 'typeof'`。切到内存桩后只保留
 * 「存在性/读空/写丢弃」语义 —— 测试不依赖真实落盘,判据不变。
 */

export const Paths = {
  document: '/tmp/ihui-test/',
  cache: '/tmp/ihui-test/cache/',
  joined: (...parts: string[]) => parts.join('/'),
}

export class File {
  uri = ''
  exists = false
  constructor(..._args: unknown[]) {}
  textSync(): string {
    return ''
  }
  text(): Promise<string> {
    return Promise.resolve('')
  }
  write(_content: string): void {}
  delete(): void {}
  get size(): number {
    return 0
  }
}

export class Directory {
  uri = ''
  exists = false
  constructor(..._args: unknown[]) {}
  create(): void {}
  delete(): void {}
}

export const FileMode = { ReadOnly: 'readonly', ReadWrite: 'readwrite' } as const

export const UploadType = {
  BINARY_CONTENT: 0,
  MULTIPART: 1,
} as const

export function readAsStringAsync(_uri: string): Promise<string> {
  return Promise.resolve('')
}

export function writeAsStringAsync(_uri: string, _content: string): Promise<void> {
  return Promise.resolve()
}

export function downloadAsync(
  _url: string,
  _dest: string,
): Promise<{ uri: string; status: number }> {
  return Promise.resolve({ uri: _dest, status: 200 })
}

export function getInfoAsync(_uri: string): Promise<{ exists: boolean; uri: string }> {
  return Promise.resolve({ exists: false, uri: _uri })
}

export function makeDirectoryAsync(_uri: string, _options?: unknown): Promise<void> {
  return Promise.resolve()
}

export function deleteAsync(_uri: string, _options?: unknown): Promise<void> {
  return Promise.resolve()
}

export const documentDirectory = Paths.document
export const cacheDirectory = Paths.cache
