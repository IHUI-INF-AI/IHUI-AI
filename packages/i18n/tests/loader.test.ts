// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D101 loader 集成:translate() 经 ICU 路径渲染四形,无 params 也进 ICU(不吐语法原文)。

import { describe, expect, it } from 'vitest'

import {
  getMessagesForLocale,
  getValueByPath,
  mergeMessages,
  resolveList,
  translate,
} from '../src/loader'
import type { Messages } from '../src/types'

const MESSAGES: Messages = {
  taskStatus: {
    syncState: '{state, select, running {RUN} completed {DONE} other {PEND}}',
  },
  plain: '你好{name}',
  list: ['a', 'b'],
}

describe('translate', () => {
  it('select 经 ICU 渲染', () => {
    expect(translate(MESSAGES, 'taskStatus.syncState', { params: { state: 'running' } })).toBe(
      'RUN',
    )
    expect(
      translate(MESSAGES, 'taskStatus.syncState', {
        params: { state: 'completed' },
        locale: 'en',
      }),
    ).toBe('DONE')
  })

  it('无 params 也走 ICU:不把语法原文吐给用户', () => {
    expect(translate(MESSAGES, 'taskStatus.syncState')).toBe('PEND')
  })

  it('普通插值保持旧行为', () => {
    expect(translate(MESSAGES, 'plain', { params: { name: 'IHUI' } })).toBe('你好IHUI')
    expect(translate(MESSAGES, 'plain')).toBe('你好{name}')
  })

  it('缺键回 key;fallback 生效', () => {
    expect(translate(MESSAGES, 'no.such.key')).toBe('no.such.key')
    expect(translate(MESSAGES, 'no.such.key', { fallback: MESSAGES })).toBe('no.such.key')
    expect(
      translate({}, 'taskStatus.syncState', {
        fallback: MESSAGES,
        params: { state: 'running' },
      }),
    ).toBe('RUN')
  })
})

describe('loader 工具函数', () => {
  it('getValueByPath 点分查找', () => {
    expect(getValueByPath(MESSAGES, 'taskStatus.syncState')).toContain('select')
    expect(getValueByPath(MESSAGES, 'no.key')).toBeUndefined()
    expect(getValueByPath(null, 'a')).toBeUndefined()
  })

  it('mergeMessages 深合并,端 override 优先', () => {
    const merged = mergeMessages(
      { a: { x: '1', y: '2' }, keep: 'k' },
      { a: { y: 'override' } },
    )
    expect(merged).toEqual({ a: { x: '1', y: 'override' }, keep: 'k' })
  })

  it('getMessagesForLocale 缺语言回 zh-CN;resolveList 只收字符串数组', () => {
    const packs = { 'zh-CN': MESSAGES, en: {} } as Record<'zh-CN' | 'en', Messages>
    expect(getMessagesForLocale('zh-CN', packs)).toBe(MESSAGES)
    expect(resolveList(MESSAGES, 'list')).toEqual(['a', 'b'])
    expect(resolveList(MESSAGES, 'plain')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
