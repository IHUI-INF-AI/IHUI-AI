// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D55(G-66)步骤决策词汇表:两侧都要钉住 ——
// ① 词表必须覆盖后端字面量全集(少一条就等于界面上多一条英文码);
// ② 后端不得出现词表外的新字面量(多一条 = 静默回退原样显示);
// ③ 取词失败/未知取值**绝不编造**,也绝不把键名喷到界面上。
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  isStepDecision,
  permissionDecisionWord,
  stateLabel,
  stepDecisionLabel,
  stepDecisionState,
  STEP_DECISIONS,
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
const PY_DIR = dirname(PY_SOURCE)

/** 三条 harvest 判据的唯一实现。测试与阳性对照共用它 —— 对照若另抄一份正则,
 *  漂移的正是本该被发现的缺口本身。 */
const HARVEST_PATTERNS = {
  // 词码允许大小写/数字/下划线:只认 [a-z_] 会让 `block_v2` 这类码**静默不匹配**
  // (不报错、不判红,是假绿里最坏的一种)。
  derived: /return\s+\(?\s*["']([A-Za-z][\w]*)["']\s*,/g,
  hint: /_decision_hints(?:\[[^\]]*\])?\s*=\s*\(\s*["']([A-Za-z][\w]*)["']/g,
  permission: /_emit_permission_mode_event\([^()]*?["']([A-Za-z][\w]*)["']/g,
  // 刻意**不**加 `_decision_hints.update({...})` 形态的判据:那种写法的第一个字符串字面量
  // 是 dict 的键(tool_call_id),不是决策码,配上就是假红。同理"经 helper 函数写入"
  // (`_set_hint(tc.id, "x", r)`)结构上看不见 —— 只能靠纪律,不装成有判据。
} as const

function harvest(pyText: string, extraTexts: string[] = []): Set<string> {
  const found = new Set<string>()
  // 只在 _derive_step_decision 函数体内扫 return(全文件扫会把无关的 `return "xx", ` 收进来)
  const start = pyText.indexOf('def _derive_step_decision')
  const end = pyText.indexOf('\ndef ', start + 10)
  if (start < 0 || end <= start) throw new Error('_derive_step_decision 定位失败,判据失效')
  const derived = pyText.slice(start, end)
  const all = [pyText, ...extraTexts]
  for (const [name, re] of Object.entries(HARVEST_PATTERNS)) {
    const sources = name === 'derived' ? [derived] : all
    for (const text of sources) {
      for (const m of text.matchAll(new RegExp(re.source, 'g'))) found.add(m[1])
    }
  }
  return found
}

/** 后端可能产出决策码的全部文件(此前只扫 agent_loop_v2.py 一个 ⇒ 别的模块造 step 全盲) */
const collectFromPython = (): Set<string> => {
  const main = readFileSync(PY_SOURCE, 'utf8')
  const siblings = readdirSync(PY_DIR)
    .filter((f) => f.endsWith('.py') && f !== 'agent_loop_v2.py')
    .map((f) => join(PY_DIR, f))
  const extra: string[] = []
  for (const p of siblings) {
    try {
      const t = readFileSync(p, 'utf8')
      if (t.includes('_decision_hints') || t.includes('_emit_permission_mode_event')) extra.push(t)
    } catch {
      // 读不到就少扫一个文件 —— 但必须让这件事可见,不得静默
      throw new Error(`无法读取 ${p},提取面不完整`)
    }
  }
  return harvest(main, extra)
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

  // 阳性对照:一条"扫不到东西"的判据和一条"没有违规"的判据长得一模一样,
  // 而后者会让上面那个用例**全绿通过**。所以必须先证明过滤器能命中每种已知写法。
  it('提取式对每种 emit 形态都要命中(否则双向一致是假绿)', () => {
    const fixture = [
      'def _derive_step_decision(tr):',
      '    if a:',
      '        return "old_style_ok", "r"',
      '    if b:',
      '    if c:',
      "        return ('single_quoted_ok', 'r')",
      '    if d:',
      '        return ("parenthesized_ok", "r")',
      '    if e:',
      '        return "block_v2", "r"',
      '',
      'def _other():',
      '    self._decision_hints[tc.id] = ("oneline_hint", r)',
      '    self._decision_hints[tc.id] = (',
      "        'multiline_single_quoted_hint',",
      '        r,',
      '    )',
      '    self._decision_hints[tc.id] = (_RUNTIME_CONST, r)',
      '    _set_hint(tc.id, "helper_written", r)',
      '    self._emit_permission_mode_event(tool_name, "perm_evt_ok")',
      '',
    ].join('\n')
    const got = harvest(fixture)
    for (const shape of [
      'old_style_ok',
      'single_quoted_ok',
      'parenthesized_ok',
      'block_v2',
      'oneline_hint',
      'multiline_single_quoted_hint',
      'perm_evt_ok',
    ]) {
      expect(got.has(shape), `形态 ${shape} 未被提取式看见`).toBe(true)
    }
    // 反向诚实:变量与 helper 两种形态结构上判不了,写在用例里而不是写在注释里 ——
    // 哪天有人给它们配了判据,这条会红,那时再决定收不收(收了就改这条)。
    expect([...got].filter((x) => x.includes('helper') || x.includes('RUNTIME'))).toEqual([])
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

  it('permissionDecisionWord 覆盖两条生产者:15 值步骤决策 + allow/ask/deny 权限矩阵', () => {
    for (const lang of LOCALES) {
      const t = realT(lang)
      const stepWord = permissionDecisionWord('auto_skip_approval', t)
      expect(stepWord).not.toBe('auto_skip_approval')
      expect(stepWord).not.toContain('decision.')
      expect(stepWord).toBe(stepDecisionLabel('auto_skip_approval', t).text)
      expect(permissionDecisionWord('deny', t)).not.toBe('deny')
      expect(permissionDecisionWord('deny', t)).not.toContain('perm.')
      expect(permissionDecisionWord('allow', t)).not.toBe('allow')
      expect(permissionDecisionWord('ask', t)).not.toBe('ask')
    }
    // 认不出的一律原样(审批语境下猜错语义 = 误导用户授权)
    expect(permissionDecisionWord('maybe_allowed', realT('zh-CN'))).toBe('maybe_allowed')
    expect(permissionDecisionWord(undefined, realT('zh-CN'))).toBe('')
    // 缺词包时退回原始码,绝不把 perm.deny 这种键名喷到界面
    expect(permissionDecisionWord('deny', (k) => k)).toBe('deny')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
