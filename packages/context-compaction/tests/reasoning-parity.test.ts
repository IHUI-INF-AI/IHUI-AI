// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-1058650:双端压缩逐值对账夹具覆盖"消息带 reasoning 内容"这一格。
//
// 判定结论 = **分支 B:Python 镜像端"少算 reasoning"这一型不可达 ⇒ 不写投机代码**。
// 四条可重跑取证(2026-10-07 于 HEAD d07ac60ceb 现读,与 parity.json 的 reasoningCases._comment 同一份):
//   (1) 估算入口不认识 reasoning:`apps/ai-service/app/core/context_compaction.py` 全文零次出现
//       `reasoning`(可重跑 `git grep -c "reasoning" HEAD -- apps/ai-service/app/core/context_compaction.py`
//       → 无输出 rc=1,即 0 命中);`estimate_messages_tokens` 只读 content / tool_calls / role / tool_call_id。
//   (2) 写入面不带它:ai-service 内 92 处 `messages.append(...)` 无一携带 reasoning 键
//       (可重跑 `git grep -n -A8 "messages\.append(" HEAD -- apps/ai-service/app | grep -cE "reasoning|thinking"` → 0)。
//       本文件下面的 `scanPythonReasoningMessageWrites` 每次运行都重扫整棵 app 树来钉住这条事实。
//   (3) 上游发不到:唯一 in-repo 发送方 apps/api 的 `/chat/stream` zod schema 是
//       `z.object({ role, content })`(apps/api/src/routes/ai-chat-stream.ts:136-143),
//       zod 默认剥离未知键 ⇒ 客户端即使回传 reasoning 也进不了消息列表;`/api/llm/complete`
//       的 `LLMCompleteRequest.messages` 虽是 `list[dict[str, Any]]`(类型上"可能有"),
//       但找不到任何一条把 reasoning 写进消息 dict 的生产路径。
//   (4) 带 reasoning 的那些对象不是消息:`llm_gateway.py:2318-2320` 的 `result["reasoning"]`、
//       `routers/llm.py:2838` 的 `accumulated`、`agent_engine.py` 的 `thread.reasoning`(推理**配置**)
//       都是响应/事件/状态字典,从不作为消息进入上下文,也就到不了估算函数。
//
// ⇒ 按仓规「加守卫前先证明坏状态可达」,不给 Python 加它永远拿不到输入的分支;
//   这一维在夹具里以"两端不等但差值逐值钉死"的形式登记,并由按键名枚举的**可达性哨兵**守住:
//   一旦生产面出现 reasoning 消息写入点,本 spec 翻红并要求把 `pyCountsReasoning` 翻成 true
//   走同值对账(见下方 expect 的分支逻辑——断言是"可判的数值关系",不是硬编码结论)。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { estimateMessagesTokens, type ChatMessage } from '../src/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const FIXTURE_PATH = join(here, 'fixtures/parity.json')
const PY_APP_DIR = join(repoRoot, 'apps/ai-service/app')
const PY_ESTIMATOR_FILE = join(repoRoot, 'apps/ai-service/app/core/context_compaction.py')

interface ReasoningCase {
  id: string
  what: string
  input: { messages: ChatMessage[] }
  expect: {
    tokensTs: number
    tokensTsReasoningBlind: number
    tokensPyAsShipped: number
    reasoningContributionTs: number
    crossEndGap: number
    blindSkew: number
  }
  pyCountsReasoning: boolean
}

interface ParityFixtureWithReasoning {
  _comment: string
  input: { messages: ChatMessage[]; options: { contextLimit: number; keepRecent: number } }
  expectations: Record<string, unknown>
  reasoningCases: {
    cases: ReasoningCase[]
    reachabilitySentinel: {
      reasoningKeyNames: string[]
      scannedRoot: string
      pythonReasoningMessageWritePointsAtAuthoringTime: number
    }
  }
  reverseLock: {
    tokensTs: number
    tokensPyAsShipped: number
    existingMessagesCarryReasoningKeys: boolean
  }
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as ParityFixtureWithReasoning

/** 把夹具里的形状标记还原成真实值:`{$shape:'circular-self-reference'}` ⇒ 真·循环引用对象
 *  (JSON 表达不出循环引用,而"存在但形态读不出"这一格要的正是 `JSON.stringify` 抛异常那条路)。 */
function materialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(materialize)
  if (value && typeof value === 'object') {
    const bag = value as Record<string, unknown>
    if (bag['$shape'] === 'circular-self-reference') {
      const circular: Record<string, unknown> = { marker: 'circular-self-reference' }
      circular['cycle'] = circular
      return circular
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(bag)) out[k] = materialize(v)
    return out
  }
  return value
}

function messagesOf(c: ReasoningCase): ChatMessage[] {
  return c.input.messages.map((m) => materialize(m) as ChatMessage)
}

/** 摘掉 reasoning 的同一批消息(= Python 端实际看得到的信息量) */
function stripReasoning(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    const { reasoning: _dropped, ...rest } = m as ChatMessage & { reasoning?: unknown }
    return rest as ChatMessage
  })
}

// ==================== 可达性哨兵(按键名枚举,不硬编码结论) ====================

const REASONING_KEY_NAMES = [
  'reasoning',
  'reasoning_content',
  'reasoning_details',
  'thinking',
  'redacted_thinking',
] as const
const KEY_ALT = REASONING_KEY_NAMES.join('|')
/** `messages.append({... "reasoning": ... })` —— 消息 dict 构造面。
 *  判据收窄为**同一条 append 语句里既有 `role` 键又有 reasoning 键**:
 *  光有 reasoning 键不算消息写入点(已逐一核过现状唯一命中
 *  `apps/ai-service/app/services/skill_scheduler.py:240` 的 `iterations.append({"reasoning": ..., "tool_calls": ...})`
 *  ——那是 AgentLoopResult 的自评记录,无 role,也永远到不了 estimate_messages_tokens)。 */
const APPEND_KEY_RE = new RegExp(`["'](?:${KEY_ALT})["']\\s*:`)
const APPEND_ROLE_RE = /["']role["']\s*:/
const APPEND_START_RE = /\.append\(/
/** `msg["reasoning"] = ...` / `messages[-1]["reasoning"] = ...` —— 事后补键的写入面 */
const ITEM_WRITE_RE = new RegExp(
  String.raw`\b(?:msg|message|m|assistant_msg|new_msg|messages\[-1\])\s*\[\s*["'](?:${KEY_ALT})["']\s*\]\s*=(?!=)`,
)

/** 扫单份 Python 源码,返回"消息 dict 携带 reasoning 键"的写入点(`rel:line`)。
 *  append 块靠括号配平界定,12 行内不配平则不计(保守,避免把后文误判成同一条语句)。 */
export function scanSourceTextForReasoningMessageWrites(rel: string, text: string): string[] {
  const hits: string[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (ITEM_WRITE_RE.test(lines[i])) hits.push(`${rel}:${i + 1}`)
    if (!APPEND_START_RE.test(lines[i])) continue
    let depth = 0
    let started = false
    let block = ''
    for (let j = i; j < Math.min(lines.length, i + 12); j++) {
      block += `${lines[j]}\n`
      for (const ch of lines[j]) {
        if (ch === '(') {
          depth += 1
          started = true
        } else if (ch === ')') depth -= 1
      }
      if (started && depth <= 0) break
    }
    if (started && depth <= 0 && APPEND_ROLE_RE.test(block) && APPEND_KEY_RE.test(block))
      hits.push(`${rel}:${i + 1}`)
  }
  return hits
}

function listPyFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listPyFiles(full))
    else if (entry.endsWith('.py')) out.push(full)
  }
  return out
}

function scanPythonReasoningMessageWrites(): string[] {
  const hits: string[] = []
  for (const file of listPyFiles(PY_APP_DIR)) {
    hits.push(
      ...scanSourceTextForReasoningMessageWrites(
        relative(repoRoot, file).replace(/\\/g, '/'),
        readFileSync(file, 'utf-8'),
      ),
    )
  }
  return hits.sort()
}

/** Python 估算面自身是否认识任何 reasoning 键名(= "按设计不计"这条登记的源码证据) */
function pythonEstimatorMentionsReasoningKeys(): string[] {
  const text = readFileSync(PY_ESTIMATOR_FILE, 'utf-8')
  const found: string[] = []
  for (const name of REASONING_KEY_NAMES) {
    if (new RegExp(`["']${name}["']`).test(text)) found.push(name)
  }
  return found
}

// ==================== 反向锁:不含 reasoning 的既有夹具逐值不变 ====================

describe('G-1058650 反向锁:既有 parity 夹具不含 reasoning,数值不动', () => {
  it('既有 top-level 键(_comment/input/expectations)结构未被动过', () => {
    expect(typeof fixture._comment).toBe('string')
    expect(fixture.input.messages).toHaveLength(24)
    expect(Object.keys(fixture.expectations)).toHaveLength(7)
    expect(fixture.input.options.contextLimit).toBe(32000)
    expect(fixture.input.options.keepRecent).toBe(6)
  })

  it('既有 24 条消息里没有任何 reasoning 键(所以这一格的老数值不该有任何理由变化)', () => {
    const carriers = fixture.input.messages.filter((m) =>
      Object.keys(m).some((k) => (REASONING_KEY_NAMES as readonly string[]).includes(k)),
    )
    expect(carriers).toHaveLength(0)
    expect(fixture.reverseLock.existingMessagesCarryReasoningKeys).toBe(false)
  })

  it('既有 24 条消息的估算值两端同值 = 29367(不含 reasoning 时跨端零漂移)', () => {
    const tsLive = estimateMessagesTokens(fixture.input.messages)
    expect(tsLive).toBe(fixture.reverseLock.tokensTs)
    expect(fixture.reverseLock.tokensTs).toBe(fixture.reverseLock.tokensPyAsShipped)
    expect(tsLive).toBe(29367)
  })
})

// ==================== 本格主用例:消息带 reasoning 的双端逐值对账 ====================

describe('G-1058650:带 reasoning 的消息在双端夹具里逐值钉死(判定=Python 不计)', () => {
  const cases = fixture.reasoningCases.cases

  it('夹具里这一格至少两条用例,且一条 reasoning 有可读文本、一条形态读不出', () => {
    expect(cases.length).toBeGreaterThanOrEqual(2)
    const ids = cases.map((c) => c.id)
    expect(ids).toContain('reasoning-string-text-counted-by-ts-only')
    expect(ids).toContain('reasoning-present-but-unreadable-shape')
  })

  for (const c of cases) {
    describe(c.id, () => {
      const messages = messagesOf(c)
      const blind = stripReasoning(messages)

      it('用例确实携带 reasoning 键(不许这一格静默退化成"不含 reasoning"的普通用例)', () => {
        const carriers = messages.filter((m) =>
          Object.keys(m).some((k) => (REASONING_KEY_NAMES as readonly string[]).includes(k)),
        )
        expect(carriers.length).toBeGreaterThan(0)
        // "存在但读不出"这条:reasoning 既不是 undefined/null,也不是空数组/空串
        for (const m of carriers) {
          const r = (m as { reasoning?: unknown }).reasoning
          expect(r === undefined || r === null).toBe(false)
        }
      })

      it('TS 实时估算 == 夹具钉住的 tokensTs(reasoning 计入估算面)', () => {
        expect(estimateMessagesTokens(messages)).toBe(c.expect.tokensTs)
      })

      it('阳性对照锚:摘掉 reasoning 后 TS 落回 reasoning-blind 值,且 reasoning 贡献严格 > 0', () => {
        const blindLive = estimateMessagesTokens(blind)
        expect(blindLive).toBe(c.expect.tokensTsReasoningBlind)
        expect(c.expect.reasoningContributionTs).toBe(
          c.expect.tokensTs - c.expect.tokensTsReasoningBlind,
        )
        expect(c.expect.reasoningContributionTs).toBeGreaterThan(0)
      })

      it('跨端差值逐值钉死:tokensTs - tokensPyAsShipped == crossEndGap > 0(不许写成"待人工核")', () => {
        expect(c.expect.crossEndGap).toBe(c.expect.tokensTs - c.expect.tokensPyAsShipped)
        expect(c.expect.crossEndGap).toBeGreaterThan(0)
      })

      it('Python 现跑值与 TS reasoning-blind 值的差被单独钉住(blindSkew 属 BPE 分歧,与 reasoning 无关)', () => {
        expect(c.expect.blindSkew).toBe(
          c.expect.tokensTsReasoningBlind - c.expect.tokensPyAsShipped,
        )
      })

      it('登记项 pyCountsReasoning 与可达性证据必须自洽(哨兵)', () => {
        const writePoints = scanPythonReasoningMessageWrites()
        if (c.pyCountsReasoning) {
          // 翻 true 的唯一合法前提:生产面真出现了带 reasoning 的消息写入点,且届时两端必须同值。
          expect(writePoints.length).toBeGreaterThan(0)
          expect(c.expect.tokensTs).toBe(c.expect.tokensPyAsShipped)
        } else {
          expect(writePoints).toEqual([])
          // 源码证据:Python 估算面至今不认识任何 reasoning 键名
          expect(pythonEstimatorMentionsReasoningKeys()).toEqual([])
          expect(scanPythonReasoningMessageWrites().length).toBe(
            fixture.reasoningCases.reachabilitySentinel
              .pythonReasoningMessageWritePointsAtAuthoringTime,
          )
        }
      })
    })
  }
})

// ==================== 哨兵自证:证明这条门喊得出来 ====================

describe('G-1058650 可达性哨兵自证(变异样例,不碰生产源码)', () => {
  it('样例:messages.append 里出现 reasoning 键 ⇒ 哨兵必须报出写入点', () => {
    const snippet = [
      'def _append_assistant(messages: list[dict[str, Any]], content: str, thinking: str) -> None:',
      '    messages.append({',
      '        "role": "assistant",',
      '        "content": content,',
      '        "reasoning": thinking,',
      '    })',
    ].join('\n')
    expect(scanSourceTextForReasoningMessageWrites('fake/writer.py', snippet)).toEqual([
      'fake/writer.py:2',
    ])
  })

  it('样例:事后往消息 dict 补 reasoning 键 ⇒ 哨兵必须报出写入点', () => {
    const snippet = [
      'msg = {"role": "assistant", "content": text}',
      'msg["reasoning_content"] = thinking',
    ].join('\n')
    expect(scanSourceTextForReasoningMessageWrites('fake/writer2.py', snippet)).toEqual([
      'fake/writer2.py:2',
    ])
  })

  it('样例:响应/事件字典带 reasoning(现状)⇒ 哨兵不许误报', () => {
    const snippet = [
      'result: dict[str, Any] = {"content": c, "model": m}',
      'reasoning = getattr(response.choices[0].message, "reasoning_content", None)',
      'if reasoning:',
      '    result["reasoning"] = reasoning',
      'accumulated: dict[str, Any] = {"content": "", "reasoning": ""}',
    ].join('\n')
    expect(scanSourceTextForReasoningMessageWrites('fake/current-shape.py', snippet)).toEqual([])
  })

  it('真实 app 树当前的写入点数 = 0(与夹具登记一致;若将来非 0,上面各用例翻红)', () => {
    expect(scanPythonReasoningMessageWrites()).toEqual([])
    expect(scanPythonReasoningMessageWrites().length).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
