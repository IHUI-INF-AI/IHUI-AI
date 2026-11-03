// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  sanitizeGeneratedTitle,
  TITLE_MAX_CHARS,
  DEFAULT_CONVERSATION_TITLE,
} from '../src/utils/conversation-title.js'

describe('sanitizeGeneratedTitle(四竞品对标 V2 #15 会话标题自动生成)', () => {
  it('普通标题原样保留(去首尾空白)', () => {
    expect(sanitizeGeneratedTitle('帮我修复登录 bug')).toBe('帮我修复登录 bug')
    expect(sanitizeGeneratedTitle('  SQLite 迁移方案  ')).toBe('SQLite 迁移方案')
  })

  it('去除成对包裹引号(中英文引号)', () => {
    expect(sanitizeGeneratedTitle('"登录页修复"')).toBe('登录页修复')
    expect(sanitizeGeneratedTitle('“SQLite 迁移”')).toBe('SQLite 迁移')
    expect(sanitizeGeneratedTitle('「标题清洗」')).toBe('标题清洗')
    expect(sanitizeGeneratedTitle("'API 重构'")).toBe('API 重构')
  })

  it('去除「标题:」类前缀', () => {
    expect(sanitizeGeneratedTitle('标题:登录修复')).toBe('登录修复')
    expect(sanitizeGeneratedTitle('Title: Login fix')).toBe('Login fix')
    expect(sanitizeGeneratedTitle('标题：会话标题')).toBe('会话标题')
  })

  it('多行输出只取首行', () => {
    expect(sanitizeGeneratedTitle('登录修复\n这是解释\n第二行')).toBe('登录修复')
  })

  it('超长标题硬截断到 TITLE_MAX_CHARS', () => {
    const long = '这是一个非常长的标题超过了二十四个字符的限制需要被截断处理才行啊朋友'
    const result = sanitizeGeneratedTitle(long)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(TITLE_MAX_CHARS)
  })

  it('空/纯空白输入返回 null(调用方静默保持默认标题)', () => {
    expect(sanitizeGeneratedTitle('')).toBeNull()
    expect(sanitizeGeneratedTitle('   \n  ')).toBeNull()
    expect(sanitizeGeneratedTitle('""')).toBeNull() // 仅引号包裹空串
  })

  it('DEFAULT_CONVERSATION_TITLE 与 DB schema 默认值一致(仅默认标题才被覆盖)', () => {
    expect(DEFAULT_CONVERSATION_TITLE).toBe('新对话')
  })
})
