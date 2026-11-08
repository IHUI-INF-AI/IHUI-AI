// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * XUI-052:MediaLibrary.createAssetAsync 旧实现返回 void,调用方读 `asset.uri` 得到 undefined,
 * 保存相册静默失败;且垫片缺 saveToLibraryAsync ⇒ 调用即 TypeError。
 * XUI-053:Linking 垫片缺 openSettings ⇒「去设置」按钮 TypeError。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(APP_ROOT, p), 'utf8')

describe('XUI-052/053:rn-compat 垫片如实回吐/补齐成员', () => {
  const platform = read('src/rn-compat/platform.tsx')
  const apis = read('src/rn-compat/apis.ts')

  it('createAssetAsync 回吐带 uri 的资产,而不是 void', () => {
    expect(platform).not.toContain('createAssetAsync: async (uri: string): Promise<void>')
    expect(platform).toContain('return { uri, width: 0, height: 0 }')
  })

  it('saveToLibraryAsync 成员与命名导出均在册', () => {
    expect(platform).toContain('saveToLibraryAsync: async (uri: string)')
    expect(platform).toContain('export const saveToLibraryAsync = MediaLibrary.saveToLibraryAsync')
  })

  it('MediaTypeOptions 别名在册(XUI-051)', () => {
    expect(platform).toContain('export const MediaTypeOptions = ImagePicker.MediaType')
  })

  it('Linking.openSettings 走 Taro.openSetting', () => {
    expect(apis).toContain('openSettings: async () =>')
    expect(apis).toContain('Taro.openSetting()')
  })
})
