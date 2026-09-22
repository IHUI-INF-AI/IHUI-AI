// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D55(G-66)步骤决策词汇表:两侧都要钉住 ——
// ① 词表必须覆盖后端字面量全集(少一条就等于界面上多一条英文码);
// ② 后端不得出现词表外的新字面量(多一条 = 静默回退原样显示);
// ③ 取词失败/未知取值**绝不编造**,也绝不把键名喷到界面上。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  STEP_DECISIONS,
  isStepDecision,
  stateLabel,
  stepDecisionLabel,
  stepDecisionState,
} from '../../src/chat/step-decision'

const here = dirname(fileURLToPath(import.meta.url))
const packPath = (lang: string) =>
  join(here, '../../../../packages/i18n/messages/shared', `${lang}.json`)
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 词包真实取词:绑定到 stepDecision 命名空间(组件侧是 useTranslations('stepDecision')),
 *  路径不存在时返回键名(与 next-intl 的失败形态一致) */
function realT(lang: string): (key: string) => string {
  const pack = JSON.parse(readFileSync(packPath(lang), 'utf8')) as Record<string, unknown>
  const root = pack.stepDecision
  return (key: string) => {
    let cur: unknown = root
    for (const seg of key.split('.')) {
      if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        return key
      }
    }
    return typeof cur === 'string' ? cur : key
  }
}

const PY_SOURCE = join(here, '../../../../apps/ai-service/app/services/agent_loop_v2.py')

const collectFromPython = (): Set<string> => {
  const src = readFileSync(PY_SOURCE, 'utf8')
  const found = new Set<string>()
  // 只在 _derive_step_decision 函数体内扫 return(全文件扫会把无关的 `return "xx", ` 收进来)
  const start = src.indexOf('def _derive_step_decision')
  const end = src.indexOf('\ndef ', start + 10)
  if (start < 0 || end <= start) throw new Error('_derive_step_decision 定位失败,判据失效')
  const body = src.slice(start, end)
  const scans: ReadonlyArray<[string, RegExp]> = [
    [body, /return "([a-z_]+)",\s/g],
    [src, /_decision_hints\[[^\]]*\] = \(\s*"([a-z_]+)"/g],
    [src, /_emit_permission_mode_event\([^()]*?"([a-z_]+)"/g],
  ]
  for (const [text, re] of scans) {
    for (const m of text.matchAll(re)) found.add(m[1])
  }
  return found
}

describe('step-decision 词汇表(D55/G-66)', () => {
  it('15 个字面量,无重复', () => {
    expect(STEP_DECISIONS).toHaveLength(15)
    expect(new Set(STEP_DECISIONS).size).toBe(15)
  })

  it('与后端字面量双向一致(既不缺 also 不多)', () => {
    const py = collectFromPython()
    const missing = STEP_DECISIONS.filter((d) => !py.has(d))
    const extra = [...py].filter((d) => !isStepDecision(d))
    expect({ missing, extra }).toEqual({ missing: [], extra: [] })
  })

  it('五种语言:15 个决策词 + 4 个态词全部命中,且不等于英文码', () => {
    for (const lang of LOCALES) {
      const t = realT(lang)
      for (const d of STEP_DECISIONS) {
        const { text } = stepDecisionLabel(d, t)
        expect(text, `${lang}/${d}`).not.toBe(d)
        expect(text, `${lang}/${d}`).not.toContain('decision.')
        expect(text.trim().length, `${lang}/${d}`).toBeGreaterThan(0)
      }
      for (const s of ['approved', 'rejected', 'needsUser', 'unknown'] as const) {
        const word = stateLabel(s, t)
        expect(word, `${lang}/${s}`).not.toBe(s)
        expect(word, `${lang}/${s}`).not.toContain('state.')
      }
    }
  })

  it('归并态是事实分类,不是猜', () => {
    expect(stepDecisionState('auto_skip_approval')).toBe('approved')
    expect(stepDecisionState('security_blocked')).toBe('rejected')
    expect(stepDecisionState('approval_timeout')).toBe('needsUser')
    expect(stepDecisionState('mcp_annotations_require_approval')).toBe('needsUser')
    expect(stepDecisionState('whatever_new_code')).toBe('unknown')
    expect(stepDecisionState(undefined)).toBe('unknown')
  })

  it('未知取值原样显示(绝不编造文案)', () => {
    const view = stepDecisionLabel('brand_new_decision', realT('zh-CN'))
    expect(view).toEqual({ text: 'brand_new_decision', state: 'unknown' })
  })

  it('词包缺键时退回原始码,而不是把键名喷到界面', () => {
    const view = stepDecisionLabel('execute_tool', (key) => key)
    expect(view.text).toBe('execute_tool')
    expect(view.text).not.toContain('decision.')
    expect(view.state).toBe('approved')
  })

  it('缺失/空串走态词兜底', () => {
    const view = stepDecisionLabel(undefined, realT('zh-CN'))
    expect(view.state).toBe('unknown')
    expect(view.text).toBe('决策未知')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
