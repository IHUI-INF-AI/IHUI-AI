// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  describeToolActivity,
  describeToolActivityByStatus,
  looksLikeUnrenderedIcu,
  toolActivityKey,
  toolActivityKeyList,
  toolActivityState,
  TOOL_GENERIC_ACTIVITY_KEY,
} from '../tool-activity'
import { __toolDisplayKeys } from '../tool-display'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../i18n/messages/shared')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const readTool = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolReadFile',
)!

/** 长尾工具码名:有功能名键、但没配惯用活动键(91 个里 24 个已配,其余走通用档) */
const longTailTool = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolApiCall',
)!

function loadTaskStatus(locale: string): Record<string, string> {
  const pack = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    taskStatus?: Record<string, string>
  }
  return pack.taskStatus ?? {}
}

/**
 * 测试用取词引擎:点号无关的扁平查表 + 缺键回显键名(与真实端内取词器同语义),
 * 并渲染 `{arg}` 与 `select` 分支(含分支内嵌套 `{name}`)。
 * 与生产 ICU 引擎的逐字符一致性由 scripts 侧跨引擎夹具看护,本处只需形状正确。
 */
function makeTranslate(status: Record<string, string>) {
  return (key: string, params?: Record<string, string | number>): string => {
    const value = status[key]
    if (value === undefined) return key
    return renderValue(value, params ?? {})
  }
}

function renderValue(pattern: string, params: Record<string, string | number>): string {
  const select = /^\{\s*(\w+)\s*,\s*select\s*,/u.exec(pattern)
  const argName = select?.[1]
  if (!select || argName === undefined) return interpolate(pattern, params)
  const cases = parseCases(pattern.slice(select[0].length))
  const branch = cases[String(params[argName])] ?? cases.other ?? ''
  return interpolate(branch, params)
}

/** 解析 `{state, select,` 之后的 `分支名 {体} …` 序列,花括号配平切分(支持体内嵌套 `{name}`) */
function parseCases(body: string): Record<string, string> {
  const cases: Record<string, string> = {}
  let i = 0
  while (i < body.length) {
    while (i < body.length && /[\s,]/u.test(body[i] as string)) i++
    const nameMatch = /^(\w+)\s*\{/u.exec(body.slice(i))
    const branchName = nameMatch?.[1]
    if (!nameMatch || branchName === undefined) break
    let j = i + nameMatch[0].length
    let depth = 1
    const start = j
    while (j < body.length && depth > 0) {
      if (body[j] === '{') depth++
      else if (body[j] === '}') depth--
      if (depth === 0) break
      j++
    }
    cases[branchName] = body.slice(start, j)
    i = j + 1
  }
  return cases
}

function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/gu, (_, k: string) => String(params[k] ?? `{${k}}`))
}

describe('工具活动行双时态措辞(D81①/D83)', () => {
  it('惯用档命中时返回对应时态文本', () => {
    const status = loadTaskStatus('zh-CN')
    const translate = makeTranslate(status)
    expect(describeToolActivity({ toolName: readTool, state: 'running', translate })).toBe(
      renderValue(status.toolReadFileActivity!, { state: 'running' }),
    )
    expect(describeToolActivity({ toolName: readTool, state: 'completed', translate })).toBe(
      renderValue(status.toolReadFileActivity!, { state: 'completed' }),
    )
  })

  it('长尾工具走通用档:两态可区分且保住功能名', () => {
    for (const locale of LOCALES) {
      const translate = makeTranslate(loadTaskStatus(locale))
      const neutral = translate('toolApiCall')
      const running = describeToolActivity({ toolName: longTailTool, state: 'running', translate })
      const completed = describeToolActivity({
        toolName: longTailTool,
        state: 'completed',
        translate,
      })
      expect(running).toContain(neutral)
      expect(completed).toContain(neutral)
      expect(running).not.toBe(completed)
      expect(looksLikeUnrenderedIcu(running)).toBe(false)
      expect(running).not.toBe(longTailTool)
    }
  })

  it('通用档漏写 {name} 时退回中性功能名(宁要名字不要空框)', () => {
    const translate = (key: string): string =>
      key === TOOL_GENERIC_ACTIVITY_KEY ? '正在执行' : key === 'toolApiCall' ? 'API 调用' : key
    expect(describeToolActivity({ toolName: longTailTool, state: 'running', translate })).toBe(
      'API 调用',
    )
  })

  it('活动键与通用键都缺失时退回中性功能名', () => {
    const status = { toolApiCall: 'API 调用' } as Record<string, string>
    const translate = makeTranslate(status)
    expect(describeToolActivity({ toolName: longTailTool, state: 'running', translate })).toBe(
      'API 调用',
    )
  })

  it('该端引擎没渲染 ICU 时绝不把语法吐到界面', () => {
    const raw = '{state, select, running {正在读取文件} other {读取文件}}'
    expect(looksLikeUnrenderedIcu(raw)).toBe(true)
    // 只查表、不渲染:模拟一个没有 ICU 能力的端取词器(会原样返回语言包里的语法)
    const flat: Record<string, string> = {
      ...loadTaskStatus('zh-CN'),
      toolReadFileActivity: raw,
      toolGenericActivity: '{state, select, running {正在执行：{name}} other {执行：{name}}}',
    }
    const translate = (key: string): string => flat[key] ?? key
    const out = describeToolActivity({ toolName: readTool, state: 'running', translate })
    expect(out).toBe(flat.toolReadFile)
    expect(out).not.toContain('select')
  })

  it('未登记工具退回码名(与 describeToolCall 兜底口径一致)', () => {
    const translate = (key: string) => key
    expect(
      describeToolActivity({ toolName: 'totally_unknown_tool', state: 'running', translate }),
    ).toBe('totally_unknown_tool')
  })

  it.each([
    ['running', 'running'],
    ['success', 'completed'],
    ['error', null],
    ['cancelled', null],
  ] as const)('状态 %s → 时态 %s', (status, expected) => {
    expect(toolActivityState(status)).toBe(expected)
  })

  it('失败/撤回的工具卡绝不显示"已完成 X"(假陈述)', () => {
    const translate = makeTranslate(loadTaskStatus('zh-CN'))
    const neutral = translate('toolReadFile')
    for (const status of ['error', 'cancelled'] as const) {
      expect(describeToolActivityByStatus({ toolName: readTool, status, translate })).toBe(neutral)
    }
    expect(
      describeToolActivityByStatus({ toolName: readTool, status: 'success', translate }),
    ).not.toBe(neutral)
  })

  it('状态入口在未知工具上仍退回码名(不吞状态)', () => {
    const translate = (key: string) => key
    expect(
      describeToolActivityByStatus({
        toolName: 'totally_unknown_tool',
        status: 'cancelled',
        translate,
      }),
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
    const status = loadTaskStatus(locale)
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
      const running = renderValue(value, { state: 'running' })
      const completed = renderValue(value, { state: 'completed' })
      expect(running.length).toBeGreaterThan(1)
      expect(completed.length).toBeGreaterThan(1)
      expect(running).not.toBe(completed)
    }
    // 中性键必须仍在(活动键缺失时的退回目标)
    expect((status.toolReadFile ?? '').length).toBeGreaterThan(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
