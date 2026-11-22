// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `expo-file-system/legacy` 的测试替身(2026-11-04 立)。
 *
 * 为什么要单开一份文件:vitest.config.ts 里 `expo-file-system` 的父别名按
 * `pattern + '/'` 前缀匹配,会把 `expo-file-system/legacy` 吞成
 * `<mock>/legacy` ⇒ 收集期 "Failed to resolve import"(与配置里反复登记的
 * `@ihui/shared/utils` / `@ihui/shared/chat` 同一类事故)。所以子路径必须有
 * **显式别名排在父别名之前**,并指向这一份。
 *
 * 为什么不能直接复用 tests/__mocks__/expo-file-system.ts:那一份只有新 API
 * (File / Paths / base64),而 src/lib/apk-update.ts 用的是 legacy 面的
 * `createDownloadResumable`(带进度回调,90MB 下载要有读条)+ `getContentUriAsync`
 * (交给系统安装器的 content:// URI)。缺这两个出口 ⇒ 模块加载即失败。
 *
 * 默认实现足以跑通"下载成功"的整条链;需要逐用例指定行为的套件用 vi.mock 覆盖同一
 * specifier(vi.mock 与 import 走同一个解析器 ⇒ 命中同一模块 id,替身让位)。
 */

export const cacheDirectory: string | null = 'file:///cache/'

export interface MockDownloadProgress {
  totalBytesWritten: number
  totalBytesExpectedToWrite: number
}

export interface MockDownloadResumable {
  downloadAsync: () => Promise<{ uri: string } | null>
  pauseAsync: () => Promise<void>
}

export async function getContentUriAsync(fileUri: string): Promise<string> {
  return `content://mock.fileprovider${fileUri.replace('file://', '')}`
}

export function createDownloadResumable(
  _url: string,
  fileUri: string,
  _options?: unknown,
  callback?: (progress: MockDownloadProgress) => void,
): MockDownloadResumable {
  return {
    downloadAsync: async () => {
      callback?.({ totalBytesWritten: 1, totalBytesExpectedToWrite: 1 })
      return { uri: fileUri }
    },
    pauseAsync: async () => {},
  }
}

export async function deleteAsync(_fileUri: string): Promise<void> {}

export default {
  cacheDirectory,
  getContentUriAsync,
  createDownloadResumable,
  deleteAsync,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
