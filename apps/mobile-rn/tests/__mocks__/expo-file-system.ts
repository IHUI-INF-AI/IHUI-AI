// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * expo-file-system 测试替身。
 *
 * 为什么必须有:真包入口 `import { requireNativeModule } from 'expo-modules-core'` 在
 * vitest(node/jsdom)下**解析不到**,于是任何 transitively import 它的测试文件
 * 整体加载失败 —— 表现为 `Test Files N failed`,而失败的是"文件没跑起来"而不是断言,
 * 极易被当成无关噪音放过(2026-09-23 实测:12 个文件的测试因此从未执行)。
 *
 * 覆盖面按 src 里实际用到的成员给(不是全量 API):
 *   File 类:exists / textSync() / write() / create() / delete() / uri / base64()
 *   Paths:document / cache / downloads / join()
 * 语义取"内存假文件":写过的才 exists,读回同一串;不碰真实磁盘,避免用例间串味。
 */

const store = new Map<string, string>()

export class File {
  readonly uri: string

  constructor(dir: string | { uri?: string } | unknown, name?: string) {
    const base = typeof dir === 'string' ? dir : ((dir as { uri?: string })?.uri ?? '')
    this.uri = `${base}/${name ?? ''}`
  }

  get exists(): boolean {
    return store.has(this.uri)
  }

  textSync(): string {
    const v = store.get(this.uri)
    if (v === undefined) throw new Error(`expo-file-system mock: 文件不存在 ${this.uri}`)
    return v
  }

  write(value: string): void {
    store.set(this.uri, value)
  }

  create(options?: { overwrite?: boolean }): void {
    if (options?.overwrite !== false) store.set(this.uri, '')
  }

  delete(): void {
    store.delete(this.uri)
  }

  base64(): string {
    return Buffer.from(store.get(this.uri) ?? '', 'utf8').toString('base64')
  }
}

export const Paths = {
  document: 'mock://document',
  cache: 'mock://cache',
  downloads: 'mock://downloads',
  bundle: 'mock://bundle',
  join: (...parts: string[]): string => parts.join('/'),
}

export const base64 = {
  toBytes: (b64: string): Uint8Array => new Uint8Array(Buffer.from(b64, 'base64')),
  fromBytes: (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64'),
  toDataUri: (bytes: Uint8Array, mime = 'application/octet-stream'): string =>
    `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
}

export default { File, Paths, base64 }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
