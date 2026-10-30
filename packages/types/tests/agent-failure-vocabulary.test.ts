// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 失败结局二分 + 停摆位置词表的常驻尺(2026-10-31 立,§30 状态词汇一等契约)。
//
// 三条钉子各钉一格失效型,缺一格就是"造好没装车"(§0.9):
//  ① 形状与第三档不可并桶 —— 对照程序只把失败二分成可重试/终局,本仓多了 undetermined;
//     它必须**既不在** retryable 集**也不在** terminal 集里,否则"没判"会被下游读成"判过"(§0.3);
//  ② 每档停摆位置都必须指到本仓一处真实现场(文件在 ∧ 锚点标识符在),凭空造词即红;
//  ③ 跨语言等值 + 五语言词条齐备 —— 对账判据**只在本文件这一份**(pytest 侧不重复解析 TS,§0.6)。

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  AGENT_FAILURE_OUTCOME_LABEL_KEYS,
  AGENT_FAILURE_OUTCOMES,
  AGENT_RETRYABLE_ERROR_FAMILIES,
  AGENT_STALL_STAGE_LABEL_KEYS,
  AGENT_STALL_STAGE_SITES,
  AGENT_STALL_STAGES,
  AGENT_TERMINAL_ERROR_FAMILIES,
  AGENT_FAILURE_NOTICE_KEY,
  agentFailureOutcomeLabelKey,
  agentFailureOutcomeOf,
  agentStallStageLabelKey,
  agentStallStageSite,
  isAgentFailureOutcomeJudged,
  normalizeAgentFailureOutcome,
  normalizeAgentStallStage,
} from '../src/agent-failure-vocabulary.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')
const PY_MIRROR = join(
  REPO_ROOT,
  'apps',
  'ai-service',
  'app',
  'core',
  'agent_failure_vocabulary.py',
)
const CLI_MESSAGES_DIR = join(REPO_ROOT, 'packages', 'i18n', 'messages', 'cli')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 解析 Python 侧 `NAME: Final[tuple[str, ...]] = ( "a", "b" )` 的字面量总表(取不到即抛,不猜空表)。 */
function pyTuple(name: string): string[] {
  const src = readFileSync(PY_MIRROR, 'utf8')
  const re = new RegExp(`${name}: Final\\[tuple\\[str, \\.\\.\\.\\]\\] = \\(([\\s\\S]*?)\\)`, 'm')
  const m = re.exec(src)
  if (!m) throw new Error(`解析不到 Python 侧 ${name} 字面量总表(改名/改形态即失锚,不猜)`)
  const values = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
  if (values.length === 0) throw new Error(`Python 侧 ${name} 枚举到 0 个成员 ⇒ 判死`)
  return values
}

describe('① 形状与第三档不可并桶', () => {
  it('成员集按声明顺序封闭,无重复', () => {
    expect(AGENT_FAILURE_OUTCOMES).toEqual(['retryable', 'terminal', 'undetermined'])
    expect(new Set(AGENT_FAILURE_OUTCOMES).size).toBe(AGENT_FAILURE_OUTCOMES.length)
    expect(new Set(AGENT_STALL_STAGES).size).toBe(AGENT_STALL_STAGES.length)
  })

  it('可重试族与终局族交集为空(两桶并了就等于又折回一档)', () => {
    const overlap = AGENT_RETRYABLE_ERROR_FAMILIES.filter((f) =>
      (AGENT_TERMINAL_ERROR_FAMILIES as readonly string[]).includes(f),
    )
    expect(overlap).toEqual([])
  })

  it('undetermined 不属于任何一桶,也不被判定谓词放行', () => {
    expect(AGENT_FAILURE_OUTCOMES).toContain('undetermined')
    expect(isAgentFailureOutcomeJudged('undetermined')).toBe(false)
    expect(isAgentFailureOutcomeJudged('retryable')).toBe(true)
    expect(isAgentFailureOutcomeJudged('terminal')).toBe(true)
    // 反向锁:未知值不许被读成"已判定"
    expect(isAgentFailureOutcomeJudged('probably_retryable')).toBe(false)
    expect(isAgentFailureOutcomeJudged(undefined)).toBe(false)
  })

  it('认不出的错误族落 undetermined,绝不当作 terminal(超越对照程序的那一格)', () => {
    expect(agentFailureOutcomeOf('unknown')).toBe('undetermined')
    expect(agentFailureOutcomeOf('provider_pipe_broken')).toBe('undetermined')
    expect(agentFailureOutcomeOf('')).toBe('undetermined')
    expect(agentFailureOutcomeOf(null)).toBe('undetermined')
    expect(agentFailureOutcomeOf(undefined)).toBe('undetermined')
    expect(agentFailureOutcomeOf(42)).toBe('undetermined')
  })

  it('成对正向对照:登记过的族各判自己那一档', () => {
    for (const f of AGENT_RETRYABLE_ERROR_FAMILIES)
      expect(agentFailureOutcomeOf(f)).toBe('retryable')
    for (const f of AGENT_TERMINAL_ERROR_FAMILIES) expect(agentFailureOutcomeOf(f)).toBe('terminal')
  })

  it('归一化只认封闭集成员,认不出回 null(不回退任一档)', () => {
    expect(normalizeAgentFailureOutcome('retryable')).toBe('retryable')
    expect(normalizeAgentFailureOutcome('RETRYABLE')).toBe(null)
    expect(normalizeAgentFailureOutcome('failed')).toBe(null)
    expect(normalizeAgentStallStage('llm_request')).toBe('llm_request')
    expect(normalizeAgentStallStage('somewhere_else')).toBe(null)
    expect(normalizeAgentStallStage(undefined)).toBe(null)
  })
})

describe('② 每档停摆位置都有一处真实现场', () => {
  it('undetermined 之外每档都登记现场,且文件与锚点现读存在', () => {
    for (const stage of AGENT_STALL_STAGES) {
      if (stage === 'undetermined') {
        expect(agentStallStageSite(stage)).toBeNull()
        continue
      }
      const site = AGENT_STALL_STAGE_SITES[stage]
      expect(site, `${stage} 没有登记现场 —— 凭空造词`).toBeDefined()
      let src = ''
      try {
        src = readFileSync(join(REPO_ROOT, site!.file), 'utf8')
      } catch {
        throw new Error(`${stage} 的现场文件读不到:${site!.file}(现场搬家须同批改表)`)
      }
      expect(
        src.includes(site!.anchor),
        `${stage} 的锚点 ${site!.anchor} 不在 ${site!.file} 里 —— 该环节已无人产出`,
      ).toBe(true)
    }
  })

  it('登记表之外的值一律取不到现场(不替未知值编一处)', () => {
    expect(agentStallStageSite('no_such_stage')).toBeNull()
    expect(agentStallStageSite(null)).toBeNull()
  })
})

describe('③ 跨语言镜像与五语言词条', () => {
  it('TS 成员表 ≡ Python 字面量总表(逐字同序)', () => {
    expect(pyTuple('AGENT_FAILURE_OUTCOME_VALUES')).toEqual([...AGENT_FAILURE_OUTCOMES])
    expect(pyTuple('AGENT_STALL_STAGE_VALUES')).toEqual([...AGENT_STALL_STAGES])
    expect(pyTuple('AGENT_RETRYABLE_ERROR_FAMILIES')).toEqual([...AGENT_RETRYABLE_ERROR_FAMILIES])
    expect(pyTuple('AGENT_TERMINAL_ERROR_FAMILIES')).toEqual([...AGENT_TERMINAL_ERROR_FAMILIES])
  })

  it('词条键由成员推导,五语言逐条齐备且不回显键名', () => {
    expect(Object.keys(AGENT_FAILURE_OUTCOME_LABEL_KEYS)).toEqual([...AGENT_FAILURE_OUTCOMES])
    expect(Object.keys(AGENT_STALL_STAGE_LABEL_KEYS)).toEqual([...AGENT_STALL_STAGES])
    expect(agentFailureOutcomeLabelKey('undetermined')).toBe('cli.failureOutcomeUndetermined')
    expect(agentFailureOutcomeLabelKey('nope')).toBeNull()
    expect(agentStallStageLabelKey('llm_request')).toBe('cli.agentStallLlmRequest')
    expect(agentStallStageLabelKey('nope')).toBeNull()

    const allKeys = [
      AGENT_FAILURE_NOTICE_KEY,
      ...Object.values(AGENT_FAILURE_OUTCOME_LABEL_KEYS),
      ...Object.values(AGENT_STALL_STAGE_LABEL_KEYS),
    ]
    for (const lang of LANGS) {
      const pack = JSON.parse(
        readFileSync(join(CLI_MESSAGES_DIR, `${lang}.json`), 'utf8'),
      ) as Record<string, Record<string, unknown>>
      expect(pack.cli, `${lang} 缺 cli 命名空间`).toBeDefined()
      for (const key of allKeys) {
        const shortKey = key.replace(/^cli\./, '')
        const value = pack.cli?.[shortKey]
        expect(typeof value === 'string' && value.trim().length > 0, `${lang} 缺词条 ${key}`).toBe(
          true,
        )
        // 词条被原样回显给用户就是"翻译没落地";值不许等于键名
        expect(value).not.toBe(shortKey)
      }
      // 播报行必须带两个槽,否则端上拿不到结局/环节
      const notice = String(pack.cli?.[AGENT_FAILURE_NOTICE_KEY.replace(/^cli\./, '')])
      expect(notice).toContain('{outcome}')
      expect(notice).toContain('{stage}')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
