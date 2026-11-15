// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { fileMentionBasename, resolveFileMention } from '../file-mention'

/**
 * 行内文件名引用解析(语义对标 DSH producedFileMentions):
 * 精确命中 / basename 唯一命中才可点;歧义与未知一律惰性;路径归一正反斜杠。
 */

describe('resolveFileMention', () => {
  it('精确路径命中:返回原写法与文件名标签', () => {
    expect(resolveFileMention('src/a.ts', ['src/a.ts', 'src/b.ts'])).toEqual({
      path: 'src/a.ts',
      label: 'a.ts',
    })
  })

  it('basename 唯一命中:只写文件名也可点', () => {
    expect(resolveFileMention('a.ts', ['src/a.ts', 'src/b.ts'])).toEqual({
      path: 'src/a.ts',
      label: 'a.ts',
    })
  })

  it('basename 歧义:同名多目标 ⇒ 不可点', () => {
    expect(resolveFileMention('a.ts', ['src/a.ts', 'lib/a.ts'])).toBeUndefined()
  })

  it('未知 token ⇒ 不可点(不按后缀或 cwd 猜)', () => {
    expect(resolveFileMention('other.ts', ['src/a.ts'])).toBeUndefined()
    expect(resolveFileMention('', ['src/a.ts'])).toBeUndefined()
  })

  it('正反斜杠归一:Windows 写法与模型写法可互相命中', () => {
    expect(resolveFileMention('src\\a.ts', ['src/a.ts'])).toEqual({
      path: 'src/a.ts',
      label: 'a.ts',
    })
    expect(resolveFileMention('a.ts', ['src\\a.ts'])).toEqual({
      path: 'src\\a.ts',
      label: 'a.ts',
    })
  })

  it('重复路径去重后仍视为唯一命中', () => {
    expect(resolveFileMention('a.ts', ['src/a.ts', 'src\\a.ts', 'src/a.ts'])).toEqual({
      path: 'src/a.ts',
      label: 'a.ts',
    })
  })

  it('末段提取:正反斜杠通吃,无分隔符返回整串', () => {
    expect(fileMentionBasename('a/b/c.ts')).toBe('c.ts')
    expect(fileMentionBasename('a\\b\\c.ts')).toBe('c.ts')
    expect(fileMentionBasename('c.ts')).toBe('c.ts')
  })
})
