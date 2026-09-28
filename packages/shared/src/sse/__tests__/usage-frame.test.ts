// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D132(2026-09-29 立):`usage` 帧在判别联合里的成员 + 「主面事件数 == 判别联合成员数」断言。
 *
 * 为什么单开一份文件,而不是往同目录 `contract.test.ts` 里加几行:
 * 那一份的对齐断言住在两张**手写表**上(`PAYLOAD_TYPE_BY_KEY` / `UNION_MEMBER_BY_NAME`)。
 * 表能管住"漏一名"(键不穷尽 ⇒ tsc 红),但它自己就是第二份真相 —— 表里写了
 * `usage: 'usage'` 而联合里根本没有那个成员时,只有当 `SSEEventPayload['type']` 的值域
 * 也恰好不含它才会红,而这正是本票立项时**已经坏着**的那一格(名字在 SSE_EVENTS 里、
 * 联合里没有,账面全绿)。本文件不新建第三张表:判据的两个输入都**从 contract.ts 源码现解析**。
 *
 * 三条纪律(照本仓既有门的口径,不是偏好):
 *  ① **不得把事件数写成常量**。票面口径给的是"现读 30",而本文件落地当天现读是 **31**
 *     (D151 的 `terminal_interaction` 于 09-29 入契约)。抄数字的断言会在下一次加帧时
 *     变成"禁止合规";解析则自动跟随。
 *  ② **空扫不记绿**:解析到 0 条一律抛错,不返回空数组继续断言(那等于把"没判到"写成"判过了")。
 *  ③ **断言必须有牙**:既给正向对照(当前真源必须过),也给"少一个成员必红"的证明
 *     —— 一条是构造夹具(不依赖真源此刻的内容),一条是把真源那一行判别名删掉。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SSE_EVENTS, SSE_EVENT_NAMES, type SSEEventPayload } from '../contract'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONTRACT_SOURCE_PATH = join(HERE, '..', 'contract.ts')

/** 主面事件名块:`export const SSE_EVENTS = { … } as const` */
const EVENT_BLOCK_RE = /export const SSE_EVENTS = \{([\s\S]*?)\n\} as const/
/** 对象字面量里的一档条目:`  KEY: 'value',`(注释行以 `//` 开头,天然不匹配) */
const EVENT_ENTRY_RE = /^\s*[A-Z][A-Z0-9_]*\s*:\s*'([^']+)'\s*,?\s*$/gm
const UNION_START_MARKER = 'export type SSEEventPayload ='
const UNION_END_MARKER = 'export const SSE_EVENT_NAMES'
/** 判别成员:联合块里每一处 `type: '<名>'`(含 form_request 那种括号求交写法) */
const UNION_DISCRIMINANT_RE = /\btype:\s*'([^']+)'/g

function readContractSource(): string {
  try {
    return readFileSync(CONTRACT_SOURCE_PATH, 'utf8')
  } catch {
    throw new Error(
      `[usage-frame] 取不到契约源文件:${CONTRACT_SOURCE_PATH}。` +
        `本文件判的是"源码里有没有那个成员",取不到既不是通过也不是失败 —— 响亮失败。`,
    )
  }
}

/** 从源码解析 `SSE_EVENTS` 的值集合(事件名)。枚举到 0 条即抛。 */
export function parseEventNamesFromSource(src: string): string[] {
  const block = EVENT_BLOCK_RE.exec(src)?.[1]
  if (block === undefined) {
    throw new Error(
      '[usage-frame] 解析失败:源码里找不到 `export const SSE_EVENTS = { … } as const` 块。' +
        '判据失明不等于通过,请核对那两行标记有没有被改写。',
    )
  }
  const names: string[] = []
  for (const match of block.matchAll(EVENT_ENTRY_RE)) {
    const value = match[1]
    if (value !== undefined) names.push(value)
  }
  if (names.length === 0) {
    throw new Error('[usage-frame] SSE_EVENTS 解析到 0 个事件名 —— 空扫不得读成"已对齐"。')
  }
  return names
}

/** 从源码解析判别联合 `SSEEventPayload` 的 `type:` 成员。枚举到 0 条即抛。 */
export function parseUnionDiscriminantsFromSource(src: string): string[] {
  const start = src.indexOf(UNION_START_MARKER)
  const end = src.indexOf(UNION_END_MARKER)
  if (start < 0) {
    throw new Error(`[usage-frame] 解析失败:源码里找不到标记「${UNION_START_MARKER}」。`)
  }
  if (end < 0 || end <= start) {
    throw new Error(
      `[usage-frame] 解析失败:联合块收口标记「${UNION_END_MARKER}」缺失或落在起点之前,` +
        '范围划不出来就不能数成员 —— 判据失明不等于通过。',
    )
  }
  const types: string[] = []
  for (const match of src.slice(start, end).matchAll(UNION_DISCRIMINANT_RE)) {
    const value = match[1]
    if (value !== undefined) types.push(value)
  }
  if (types.length === 0) {
    throw new Error('[usage-frame] 判别联合解析到 0 个 `type:` 成员 —— 空扫不得读成"已对齐"。')
  }
  return types
}

export interface UnionCoverageDiff {
  /** 事件名有、判别联合里没有成员 —— D132 这一型 */
  missingUnionMembers: string[]
  /** 联合里有、主面事件名没有 —— 反向漂移(空心成员) */
  extraUnionMembers: string[]
}

/** 双向集合差。只数个数拦不住"改名顶包"(两侧同为 31 而 usage 换成了别的),所以判集合。 */
export function diffUnionCoverage(
  eventNames: readonly string[],
  unionTypes: readonly string[],
): UnionCoverageDiff {
  const unionSet = new Set(unionTypes)
  const eventSet = new Set(eventNames)
  return {
    missingUnionMembers: eventNames.filter((name) => !unionSet.has(name)),
    extraUnionMembers: unionTypes.filter((type) => !eventSet.has(type)),
  }
}

const REAL_SOURCE = readContractSource()
const REAL_EVENT_NAMES = parseEventNamesFromSource(REAL_SOURCE)
const REAL_UNION_TYPES = parseUnionDiscriminantsFromSource(REAL_SOURCE)

/**
 * 反向对照用:把真源里 `type: 'usage'` **那一行**删掉 ⇒ 联合中不再存在该判别成员。
 * 命中不到就抛 —— 对照若空转,"少一个成员必红"这句话就是假的(本仓记过多次:
 * 判据失效的表现永远是安静,而注入式对照最容易在"改了写法没命中"时两边都报 0)。
 */
function dropUsageDiscriminantLine(src: string): string {
  const mutated = src.replace(/\n[ \t]*type:\s*'usage'[ \t]*\n/, '\n')
  if (mutated === src) {
    throw new Error(
      '[usage-frame] 反向对照失效:真源里找不到独占一行的 `type: \'usage\'` 判别名,' +
        '删除动作没命中 ⇒ 这条"少一个成员必红"的证明不成立。请核对那一行的写法。',
    )
  }
  return mutated
}

describe('SSE 契约:主面事件数与判别联合成员数对账(D132)', () => {
  it('两个输入都是从 contract.ts 现解析的,且都不是空扫', () => {
    // 解析器自检:文本解析出来的事件名必须与运行时真值逐名同序。
    // 没有这一条,"解析"就可能是少配/多配(缩进、注释、跨行写法都会让它静默偏掉),
    // 而后面的相等断言会对着一个错的分母自洽地绿 —— 本仓最贵的一型是"把没判到写成判过了"。
    expect(REAL_EVENT_NAMES).toEqual([...SSE_EVENT_NAMES])
    expect(REAL_EVENT_NAMES.length).toBeGreaterThan(0)
    expect(REAL_UNION_TYPES.length).toBeGreaterThan(0)
    // 判重:联合里同名判别出现两次是 TS 错误,但主面对象字面量的重复键只被最后一档遮蔽
    expect(new Set(REAL_EVENT_NAMES).size).toBe(REAL_EVENT_NAMES.length)
    expect(new Set(REAL_UNION_TYPES).size).toBe(REAL_UNION_TYPES.length)
  })

  it('主面事件数 == 判别联合成员数(正向对照:当前真源必须过)', () => {
    expect(REAL_UNION_TYPES.length).toBe(REAL_EVENT_NAMES.length)
    // 个数相等还不够 —— 逐个名字也要相等,否则"删一个 + 加一个"能顶过纯计数断言
    expect([...REAL_UNION_TYPES].sort()).toEqual([...REAL_EVENT_NAMES].sort())
    expect(diffUnionCoverage(REAL_EVENT_NAMES, REAL_UNION_TYPES)).toEqual({
      missingUnionMembers: [],
      extraUnionMembers: [],
    })
  })

  it('usage 既在主面事件名里,也在判别联合里(D132 的缺陷本体)', () => {
    expect(SSE_EVENTS.USAGE).toBe('usage')
    expect(REAL_EVENT_NAMES).toContain('usage')
    expect(REAL_UNION_TYPES).toContain('usage')
  })

  it('牙①:构造夹具里少一个成员 ⇒ 同一判据必红(不依赖真源此刻的内容)', () => {
    const fixture = [
      'export const SSE_EVENTS = {',
      "  CHUNK: 'chunk',",
      "  USAGE: 'usage',",
      '} as const',
      '',
      'export type SSEEventPayload =',
      "  | SSEEventWithMeta<{ type: 'chunk'; content: string }>",
      '',
      'export const SSE_EVENT_NAMES = 0',
      '',
    ].join('\n')

    const eventNames = parseEventNamesFromSource(fixture)
    const unionTypes = parseUnionDiscriminantsFromSource(fixture)

    expect(eventNames).toEqual(['chunk', 'usage'])
    expect(unionTypes).toEqual(['chunk'])
    expect(unionTypes.length).not.toBe(eventNames.length)
    expect(diffUnionCoverage(eventNames, unionTypes).missingUnionMembers).toEqual(['usage'])
  })

  it('牙②:把真源里那一行判别名删掉 ⇒ 判据点名 usage;不删 ⇒ 点名空集', () => {
    const mutated = dropUsageDiscriminantLine(REAL_SOURCE)
    const mutatedEvents = parseEventNamesFromSource(mutated)
    const mutatedUnion = parseUnionDiscriminantsFromSource(mutated)

    expect(mutatedUnion.length).toBe(mutatedEvents.length - 1)
    // 头条断言本体在这里翻红:同一份判据喂"少一个成员"的输入 ⇒ 两数不等
    expect(mutatedUnion.length).not.toBe(mutatedEvents.length)
    expect(diffUnionCoverage(mutatedEvents, mutatedUnion).missingUnionMembers).toEqual(['usage'])
    expect([...mutatedUnion].sort()).not.toEqual([...mutatedEvents].sort())

    // 同一条判据喂真源本身 ⇒ 必须什么都点不出来(证明红的来源是那一行,不是判据过宽)
    expect(diffUnionCoverage(REAL_EVENT_NAMES, REAL_UNION_TYPES).missingUnionMembers).toEqual([])
  })

  it('空枚举不得被读成通过:缺收口标记 ⇒ 抛,而不是返回空数组', () => {
    expect(() => parseUnionDiscriminantsFromSource('export const SSE_EVENTS = {} as const')).toThrow(
      /找不到标记/,
    )
    const truncated = REAL_SOURCE.replace(UNION_END_MARKER, 'export const RENAMED_AWAY =')
    expect(() => parseUnionDiscriminantsFromSource(truncated)).toThrow(/收口标记/)
  })
})

/**
 * usage 帧字段的**读取面**。
 *
 * 字段形状的唯一权威是生产端 `apps/ai-service/app/routers/llm.py` 流收尾处的 `_usage_frame`
 * (现读 4708-4721)与 `app/core/sse_contract.py:205` 的
 * `SSEEventContract("usage", ("messageId","usage","timing","model","costUsd"))`:
 *   messageId ← `_resolve_message_id()`(可空)、
 *   usage.{promptTokens,completionTokens,totalTokens,reasoningTokens} ← 逐档 `.get()`,可空,
 *   timing.{firstTokenMs(可空),durationMs(恒有)}、model ← `accumulated.get()`(可空)、
 *   costUsd ← 发射处恒 None(真成本走 D33 的 usageDetail 持久化通道,不在这条线上)。
 *
 * 这个函数**不数类型、不 `as`**:它只是把 `frame.type === 'usage'` 当编译期探针用 ——
 * 判别联合里没有该成员时,这条比较两侧值域无交集 ⇒ TS2367,`typecheck` 直接红。
 * 这才是"名字有、结构没有"在端上的真实后果(各端此前只能各自 `as`,上游改名六端不红)。
 */
interface UsageFieldProbe {
  messageId: string
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  /** 可选:不支持该档的模型不下发,老帧缺席读作"未知"而非 0 */
  reasoningTokens: number | null | undefined
  firstTokenMs: number | null
  durationMs: number
  model: string | null
  costUsd: number | null
  agentId: string | undefined
}

function readUsageFrame(frame: SSEEventPayload): UsageFieldProbe | null {
  if (frame.type !== 'usage') return null
  return {
    messageId: frame.messageId,
    promptTokens: frame.usage.promptTokens,
    completionTokens: frame.usage.completionTokens,
    totalTokens: frame.usage.totalTokens,
    reasoningTokens: frame.usage.reasoningTokens,
    firstTokenMs: frame.timing.firstTokenMs,
    durationMs: frame.timing.durationMs,
    model: frame.model,
    costUsd: frame.costUsd,
    agentId: frame.agentId,
  }
}

describe('usage 帧:按 type 收窄出字段类型(D132 的可消费性)', () => {
  it('命名帧逐字段可读,且推理档缺席仍然合法(可选位没被写成必填)', () => {
    // 生产端最小帧:reasoningTokens 与 agentId 都不写
    const minimal = {
      type: 'usage',
      messageId: 'msg-1',
      usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
      timing: { firstTokenMs: null, durationMs: 240 },
      model: null,
      costUsd: null,
    } satisfies SSEEventPayload

    expect(readUsageFrame(minimal)).toEqual({
      messageId: 'msg-1',
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
      reasoningTokens: undefined,
      firstTokenMs: null,
      durationMs: 240,
      model: null,
      costUsd: null,
      agentId: undefined,
    })

    // 满帧:推理档有值、首 token 已计时、网关注入了 agentId
    const full = {
      type: 'usage',
      messageId: 'msg-2',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        reasoningTokens: 20,
      },
      timing: { firstTokenMs: 320, durationMs: 1_200 },
      model: 'step-router-v1',
      costUsd: 0.0042,
      agentId: 'agent-9',
    } satisfies SSEEventPayload

    const probe = readUsageFrame(full)
    if (probe === null) {
      throw new Error('[usage-frame] 收窄失败:type 为 usage 的帧没有被识别成联合成员')
    }
    expect(probe).toEqual({
      messageId: 'msg-2',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      reasoningTokens: 20,
      firstTokenMs: 320,
      durationMs: 1_200,
      model: 'step-router-v1',
      costUsd: 0.0042,
      agentId: 'agent-9',
    })
  })

  it('非 usage 帧走不到这条分支(收窄不是"逢帧都当 usage")', () => {
    const chunk = { type: 'chunk', content: 'hi' } satisfies SSEEventPayload
    expect(readUsageFrame(chunk)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
