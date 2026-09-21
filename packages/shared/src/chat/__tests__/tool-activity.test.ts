// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  describeToolActivity,
  looksLikeUnrenderedIcu,
  toolActivityKey,
  toolActivityKeyList,
} from '../tool-activity'
import { __toolDisplayKeys } from '../tool-display'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../i18n/messages/shared')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const readTool = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolReadFile',
)!

/** 最小 select 解释器:测试里用它模拟"该端引擎已渲染 ICU" */
function renderSelect(pattern: string, state: string): string {
  const hit = new RegExp(`\\b${state}\\s*\\{([^{}]*)\\}`, 'u').exec(pattern)
  if (hit) return hit[1] ?? ''
  const other = /\bother\s*\{([^{}]*)\}/u.exec(pattern)
  return other?.[1] ?? ''
}

describe('工具活动行双时态措辞(D81①/D83)', () => {
  it('活动键命中时返回对应时态文本', () => {
    const translate = (key: string, params?: Record<string, string | number>) =>
      key === 'toolReadFileActivity'
        ? params?.state === 'running'
          ? '正在读取文件'
          : '已读取文件'
        : '读取文件内容'
    expect(describeToolActivity({ toolName: readTool, state: 'running', translate })).toBe(
      '正在读取文件',
    )
    expect(describeToolActivity({ toolName: readTool, state: 'completed', translate })).toBe(
      '已读取文件',
    )
  })

  it('活动键缺失(取词器回显键名)时退回中性功能名', () => {
    const translate = (key: string) => (key === 'toolReadFileActivity' ? key : '读取文件内容')
    expect(describeToolActivity({ toolName: readTool, state: 'running', translate })).toBe(
      '读取文件内容',
    )
  })

  it('该端引擎没渲染 ICU 时绝不把语法吐到界面', () => {
    const raw = '{state, select, running {正在读取文件} other {读取文件}}'
    expect(looksLikeUnrenderedIcu(raw)).toBe(true)
    const translate = (key: string) => (key === 'toolReadFileActivity' ? raw : '读取文件内容')
    const out = describeToolActivity({ toolName: readTool, state: 'running', translate })
    expect(out).toBe('读取文件内容')
    expect(out).not.toContain('select')
  })

  it('未登记工具退回码名(与 describeToolCall 兜底口径一致)', () => {
    const translate = (key: string) => key
    expect(
      describeToolActivity({ toolName: 'totally_unknown_tool', state: 'running', translate }),
    ).toBe('totally_unknown_tool')
  })

  it('活动键清单由功能名词表派生', () => {
    const list = toolActivityKeyList()
    expect(list).toContain('toolReadFileActivity')
    expect(list.every((k) => k.endsWith('Activity'))).toBe(true)
    expect(list.length).toBe(new Set(Object.values(__toolDisplayKeys)).size)
    expect(toolActivityKey(readTool)).toBe('toolReadFileActivity')
  })

  it.each(LOCALES)('%s 语言包:首批六工具活动键齐全且两时态可渲染', (locale) => {
    const pack = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
      taskStatus?: Record<string, string>
    }
    const status = pack.taskStatus ?? {}
    const six = [
      'toolReadFileActivity',
      'toolEditFileActivity',
      'toolWriteFileActivity',
      'toolSearchCodebaseActivity',
      'toolWebSearchActivity',
      'toolParseDocumentActivity',
    ]
    for (const key of six) {
      const value = status[key] ?? ''
      expect(typeof value).toBe('string')
      expect(value).toContain('select')
      const running = renderSelect(value, 'running')
      const completed = renderSelect(value, 'completed')
      expect(running.length).toBeGreaterThan(1)
      expect(completed.length).toBeGreaterThan(1)
      expect(running).not.toBe(completed)
    }
    // 中性键必须仍在(活动键缺失时的退回目标)
    expect((status.toolReadFile ?? '').length).toBeGreaterThan(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
