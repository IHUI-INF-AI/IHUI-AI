// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * XUI-054:小程序端没有原生文件系统。旧垫片缺 `FileMode` / `UploadType` / `cacheDirectory` /
 * `createDownloadResumable` / `getContentUriAsync` / `File.open` / `File.createUploadTask`,
 * 调用方拿到 `undefined` 后把失败点推到很远的地方;二进制 write 还会"写空串假装成功"。
 *
 * 新口径:不支持的 API **显式** not-supported —— 抛 `NotSupportedError`(`code=ERR_NOT_SUPPORTED`)
 * 或显式 `null` 常量,调用方能当场判;绝不允许静默返回空值/默认值。
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(() => ''),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}))

import * as fs from './native-extras'

function thrown(fn: () => unknown): unknown {
  try {
    fn()
  } catch (e) {
    return e
  }
  return undefined
}

describe('XUI-054 小程序 FS 能力显式 not-supported', () => {
  it('能力探测出口为 false,目录常量是显式 null(不是空串)', () => {
    expect(fs.fileSystemSupport?.supported).toBe(false)
    expect(fs.cacheDirectory).toBeNull()
    expect(fs.documentDirectory).toBeNull()
    expect(fs.NOT_SUPPORTED_CODE).toBe('ERR_NOT_SUPPORTED')
  })

  it('createDownloadResumable 抛 NotSupportedError 且带错误码', () => {
    const err = thrown(() => fs.createDownloadResumable())
    expect(err).toBeInstanceOf(fs.NotSupportedError)
    expect((err as fs.NotSupportedError).code).toBe('ERR_NOT_SUPPORTED')
  })

  it('getContentUriAsync 以同一错误码 reject', async () => {
    const err = await fs.getContentUriAsync().then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(fs.NotSupportedError)
    expect((err as fs.NotSupportedError).code).toBe('ERR_NOT_SUPPORTED')
  })

  it('File 的句柄/上传/二进制写入都显式抛错,不写空值', () => {
    const file = new fs.File('wxfile://usr', 'x.bin')
    expect((thrown(() => file.open()) as fs.NotSupportedError).code).toBe('ERR_NOT_SUPPORTED')
    expect((thrown(() => file.createUploadTask()) as fs.NotSupportedError).code).toBe(
      'ERR_NOT_SUPPORTED',
    )
    expect(
      (thrown(() => file.write(new Uint8Array([1, 2, 3]))) as fs.NotSupportedError).code,
    ).toBe('ERR_NOT_SUPPORTED')
  })

  it('枚举常量取值即抛,不会把 undefined 当参数传下去', () => {
    expect(
      (thrown(() => (fs.FileMode as unknown as Record<string, string>).Truncate) as fs.NotSupportedError)
        .code,
    ).toBe('ERR_NOT_SUPPORTED')
    expect(
      (thrown(() => (fs.UploadType as unknown as Record<string, string>).MULTIPART) as fs.NotSupportedError)
        .code,
    ).toBe('ERR_NOT_SUPPORTED')
  })
})
