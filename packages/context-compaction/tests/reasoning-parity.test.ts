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

interface CjkCase {
  id: string
  what: string
  messageIndexInInput: number
  input: { messages: ChatMessage[] }
  expect: { tokensTs: number; tokensPyAsShipped: number; crossEndGap: number }
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
    /** TS 侧整列真值(本文件现场重算复核);字段各归各端,不许存 Python 的读数 */
    tokensTs: number
    tokensPyAsShipped: number
    existingMessagesCarryReasoningKeys: boolean
    baselineMessageCount: number
    baseline: { messageCount: number; tokensTs: number; tokensPyAsShipped: number }
    /** 整列跨端差值 = tokensTs - tokensPyAsShipped(两端不等是正确现状,按差值判不按同值判) */
    crossEndGapFullColumn: number
  }
  cjkCases: {
    cases: CjkCase[]
    aggregate: { tokensTs: number; tokensPyAsShipped: number; crossEndGap: number }
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

// ==================== 写入面形态枚举(残余③:四形,判据同一条不变式) ====================
//
// 四形的**判据完全同一条**:同一条语句内既有 `role` 键又有 reasoning 键。
// 扩的只是"语句边界怎么圈出来",不是"什么算命中"。
//
// | 形态 | 锚点(只确认这一行是候选) | 块边界怎么圈 |
// |---|---|---|
// | `append-call` | `.append(` | 从 `(` 起配平 `()` |
// | `update-call` | `.update(` | 从 `(` 起配平 `()` |
// | `spread-dict` | `= {**` | 从 `{` 起配平 `{}` |
// | `helper-kwargs` | `role=`(kwargs 写法) | 回溯到包裹它的未配平 `(`,再从那里配平 `()` |
//
// 为什么 `.update({...})` 也要求 role 键在**同一个块**里(而不是"块外某处已有 role"):
// 一旦允许跨语句追数据流,判据就退化成"这个文件里某处有 role、某处有 reasoning",
// 现状树里 603 个文件处处是 `role=`,那样的门谁都喊、等于没门(仓规:宁可漏报不可误报)。
// 代价是**已知盲区**(msg 早先构造好 role、随后单独 `msg.update({"reasoning": ...})`
// 不报),此处显式登记而不是假装覆盖。

/** `.update({...})` —— 事后往已存在的消息 dict 补键(块 = 该调用的括号配平块)。 */
const UPDATE_START_RE = /\.update\(/
/** `{**base, "reasoning": ...}` 展开形 —— 锚点直接落在 `**` 这个**展开记号**上,
 *  再回溯到包裹它的 `{`(见扫描循环形④),所以单行形(`x = {**a, ...}`)与
 *  多行形(`= {` 换行后 `**a, ...}`)走的是同一条代码路径。
 *  实测真实树里 `routers/llm.py:1514` `new_messages[0] = {**new_messages[0], "content": merged}`
 *  等 41 处就是这个形态,所以它是**在用**的写法而非假想。 */
const SPREAD_ASSIGN_RE = /\*\*/
/** helper / SDK 的间接构造:`role=` 是**关键字实参**而不是 `"role":` 字面量键。
 *  用后顾断言而非前缀字符组,是为了让 `String.search` 返回的列号**正好落在 `role` 词首**——
 *  下面的 `enclosingOpenParen` 要从那儿往回找未配平的 `(`。
 *  `(?<![\w"])` 排除两种误报:更长标识符(`my_role=`)、字符串里的 `role=`(f-string / 字面量键)。 */
const ROLE_KWARG_RE = /(?<![\w"])role\s*=\s*(?!=)/
const REASONING_KWARG_RE = new RegExp(String.raw`(?<![\w"])(?:${KEY_ALT})\s*=\s*(?!=)`)

/** 写入面形态名(变异对照与台账登记用,不是判据的一部分)。 */
export const WRITE_FORMS = [
  'append-call',
  'update-call',
  'spread-dict',
  'helper-kwargs',
] as const
export type WriteForm = (typeof WRITE_FORMS)[number]

/** 块边界扫描上限(行)。
 *  沿用 12 行,**并且对三种新形态仍然合适**——这不是拍脑袋,是在真实树上量过的
 *  (可重跑 `.ihui-agent/tmp/probe-span.py`):`.update({` 锚点 11 处,括号块最长 **8** 行;
 *  `{**` 赋值 41 处**全是 1 行**;`role=` 实参块最长 **3** 行。三者都 < 12。
 *  反过来放宽只会让哨兵多喊:append 面现有 2500+ 处锚点,行数分布里已有 44 处顶满 12 行
 *  (那些是长/未配平的追加),放宽上限会把它们纳入判断 ⇒ 误报风险上升。
 *  本门宁可漏报不可误报,故**不动**这个上限。 */
const BLOCK_SCAN_MAX_LINES = 12

/** 从 (行号, 列号) 起做括号配平,返回配平的块文本。
 *  超上限仍未配平 ⇒ 返回 null(保守不计,避免把邻门切进来)。
 *  **刻意不用 `slice(at ± N)` 那种固定字符窗口**:本仓踩过那个坑
 *  (`healUnresponsiveServices(opts = {})` 的默认值里就有 `{}`,从声明处直接找第一个 `{`
 *  会把函数体切成 2 字符)。这里一律从**确切的锚点列**起、按配平取到闭括号。 */
function balancedBlock(
  lines: string[],
  startLine: number,
  startCol: number,
  open: string,
  close: string,
): string | null {
  let depth = 0
  let opened = false
  const parts: string[] = []
  const last = Math.min(lines.length, startLine + BLOCK_SCAN_MAX_LINES)
  for (let i = startLine; i < last; i++) {
    const seg = i === startLine ? lines[i].slice(startCol) : lines[i]
    parts.push(seg)
    for (const ch of seg) {
      if (ch === open) {
        depth += 1
        opened = true
      } else if (ch === close) depth -= 1
    }
    if (opened && depth <= 0) return parts.join('\n')
  }
  return null
}

/** 从 (行号, 列号) 往回溯,找**包裹它的那对括号里尚未配平的开括号**的位置;找不到返回 null。
 *  `role=` / `**` 可能出现在多行调用的中间行
 *  (`SessionMessage(\n role=..., \n reasoning=...)`、`= {\n **base, ...}`),
 *  所以块起点必须能往回走,不能只看本行有没有开括号。 */
function enclosingOpen(
  lines: string[],
  line: number,
  col: number,
  open: string,
  close: string,
): { line: number; col: number } | null {
  let depth = 0
  for (let i = line; i >= 0; i--) {
    const seg = i === line ? lines[i].slice(0, col) : lines[i]
    for (let k = seg.length - 1; k >= 0; k--) {
      const ch = seg[k]
      if (ch === close) depth += 1
      else if (ch === open) {
        if (depth === 0) return { line: i, col: k }
        depth -= 1
      }
    }
  }
  return null
}

/** 扫单份 Python 源码,返回"消息 dict 携带 reasoning 键"的写入点(`rel:line`,已去重)。
 *
 *  判据(四形态统一,见上表):**同一条语句内既有 `role` 键又有 reasoning 键**。
 *  取块一律靠括号配平:调用形先配平 `()`、dict 字面量形先配平 `{}`;
 *  `role=`/reasoning kwarg 形则先回溯到未配平的 `(` 再配平 `()`。
 *  `BLOCK_SCAN_MAX_LINES`(=12)行内不配平则不计。 */
export function scanSourceTextForReasoningMessageWriteForms(
  rel: string,
  text: string,
): { line: number; form: WriteForm }[] {
  const found = new Map<number, WriteForm>()
  const lines = text.split(/\r?\n/)

  const claim = (lineIdx: number, form: WriteForm): void => {
    // 同一行命中多形态时保留**形态序最靠前**的那个:一行只算一个写入点,
    // 否则 `messages.append(msg.update({...}))` 这种嵌套会被重复计数。
    if (!found.has(lineIdx)) found.set(lineIdx, form)
  }

  for (let i = 0; i < lines.length; i++) {
    // 形①:事后下标补键 `msg["reasoning"] = ...`
    if (ITEM_WRITE_RE.test(lines[i])) {
      claim(i, 'append-call')
      continue
    }

    const line = lines[i]

    // 形②:`xxx.append(...)` —— 从 `(` 起配平 `()`
    const appendAt = line.search(APPEND_START_RE)
    if (appendAt >= 0) {
      const openCol = appendAt + line.slice(appendAt).indexOf('(')
      const block = balancedBlock(lines, i, openCol, '(', ')')
      if (block !== null && APPEND_ROLE_RE.test(block) && APPEND_KEY_RE.test(block)) claim(i, 'append-call')
    }

    // 形③:`xxx.update({...})` —— 同样从 `(` 起配平 `()`
    const updateAt = line.search(UPDATE_START_RE)
    if (updateAt >= 0) {
      const openCol = updateAt + line.slice(updateAt).indexOf('(')
      const block = balancedBlock(lines, i, openCol, '(', ')')
      if (block !== null && APPEND_ROLE_RE.test(block) && APPEND_KEY_RE.test(block)) claim(i, 'update-call')
    }

    // 形④:`{**base, "reasoning": ...}` 展开形 —— 锚点落在 `**` 上,再回溯到包裹它的 `{`。
    //    这样单行形(`x = {**base, ...}`)与多行形(`= {\n **base, ...}`)走的是同一条路径。
    const spreadAt = line.search(SPREAD_ASSIGN_RE)
    if (spreadAt >= 0) {
      const open = enclosingOpen(lines, i, spreadAt, '{', '}')
      if (open) {
        const block = balancedBlock(lines, open.line, open.col, '{', '}')
        if (block !== null && block.includes('**') && APPEND_ROLE_RE.test(block) && APPEND_KEY_RE.test(block))
          claim(i, 'spread-dict')
      }
    }

    // 形⑤:helper / SDK 间接构造 `SessionMessage(role=..., reasoning=...)`。
    //    role 以 **kwargs** 写法出现 ⇒ 回溯到包裹它的未配平 `(` 再配平 `()`。
    const roleAt = line.search(ROLE_KWARG_RE)
    if (roleAt >= 0) {
      const open = enclosingOpen(lines, i, roleAt, '(', ')')
      if (open) {
        const block = balancedBlock(lines, open.line, open.col, '(', ')')
        if (block !== null && REASONING_KWARG_RE.test(block)) claim(i, 'helper-kwargs')
      }
    }
  }

  return [...found.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lineIdx, form]) => ({ line: lineIdx + 1, form }))
}

/** 与 `scanSourceTextForReasoningMessageWriteForms` 同判据的 `rel:line` 视图(既有调用方不变)。 */
export function scanSourceTextForReasoningMessageWrites(rel: string, text: string): string[] {
  return scanSourceTextForReasoningMessageWriteForms(rel, text).map((h) => `${rel}:${h.line}`)
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

// ── 全树扫描**只量一次**(2026-10-09,修 CI 恒超时)──────────────────────────
// 这两把尺子扫的是同一棵 `apps/ai-service/app` 树,与"哪一条 reasoning 用例"无关,
// 但此前在每个 it() 里各调一次(哨兵那条还一次调两遍)。本地快盘 warm cache 约 1.2s/次,
// CI 实测 9.6s ⇒ vitest 默认 5000ms 直接 "Test timed out in 5000ms",main 的 CI 一红
// 就把整条 PR 通道堵住(AGENTS §9b)。提到模块顶层量一次,断言一字未改。
// 反向锁在文件末「哨兵自证」组:它验的是"改树必读红"的载体还在,不是这条缓存本身。
const PY_WRITE_POINTS = scanPythonReasoningMessageWrites()
const PY_ESTIMATOR_REASONING_KEYS = pythonEstimatorMentionsReasoningKeys()
/** 那次扫描究竟打开了多少个 .py —— 供下面的"覆盖面自证"用,空扫不得冒充"写入点为 0"。 */
const PY_SCANNED_PY_FILE_COUNT = listPyFiles(PY_APP_DIR).length

// ==================== 反向锁:不含 reasoning / 不含 CJK 的既有夹具逐值不变 ====================

describe('G-1058650 反向锁:既有 parity 夹具不含 reasoning,数值不动', () => {
  it('既有 top-level 键(_comment/input/expectations)结构未被动过', () => {
    expect(typeof fixture._comment).toBe('string')
    // 追加 CJK 用例后既有 24 条**一条没少**,CJK 只在其后追加(下标 24 起)
    expect(fixture.reverseLock.baselineMessageCount).toBe(24)
    expect(fixture.input.messages.length).toBeGreaterThanOrEqual(24)
    expect(Object.keys(fixture.expectations)).toHaveLength(7)
    expect(fixture.input.options.contextLimit).toBe(32000)
    expect(fixture.input.options.keepRecent).toBe(6)
  })

  it('既有 24 条消息里没有任何 reasoning 键(所以这一格的老数值不该有任何理由变化)', () => {
    const carriers = fixture.input.messages
      .slice(0, fixture.reverseLock.baselineMessageCount)
      .filter((m) => Object.keys(m).some((k) => (REASONING_KEY_NAMES as readonly string[]).includes(k)))
    expect(carriers).toHaveLength(0)
    expect(fixture.reverseLock.existingMessagesCarryReasoningKeys).toBe(false)
  })

  it('既有 24 条消息的估算值两端同值 = 29367(不含 reasoning 时跨端零漂移)', () => {
    const base = fixture.input.messages.slice(0, fixture.reverseLock.baselineMessageCount)
    expect(base).toHaveLength(24)
    const tsLive = estimateMessagesTokens(base)
    expect(tsLive).toBe(fixture.reverseLock.baseline.tokensTs)
    expect(fixture.reverseLock.baseline.tokensTs).toBe(fixture.reverseLock.baseline.tokensPyAsShipped)
    expect(tsLive).toBe(29367)
    // 切片锁是「追加只加在尾部」的机械保证:整列比既有 24 条**更长**,
    // 但前 24 条的估算值不受后面追加的内容影响。
    expect(fixture.input.messages.length).toBeGreaterThan(24)
  })

  it('整列(26 条,含 CJK)的估算值两端**不再相等**,各自真值逐值钉死', () => {
    const tsFull = estimateMessagesTokens(fixture.input.messages)
    // TS 侧整列真值:`tokensTs` 就是 TS 侧的值(字段各归各端,谁也不许存对方的读数)
    expect(tsFull).toBe(fixture.reverseLock.tokensTs)
    expect(tsFull).toBe(29500)
    // Python 侧整列真值(由常驻 Python 件现场重算复核)
    expect(fixture.reverseLock.tokensPyAsShipped).toBe(29558)
    // 差值方向与 ASCII 那格相反:汉字上 Python 多算
    expect(fixture.reverseLock.crossEndGapFullColumn).toBe(
      fixture.reverseLock.tokensTs - fixture.reverseLock.tokensPyAsShipped,
    )
    expect(fixture.reverseLock.crossEndGapFullColumn).toBe(-58)
  })

  it('字段语义:`tokensTs` 存 **TS** 侧读数、`tokensPyAsShipped` 存 **Python** 侧读数(不许过载)', () => {
    // 这一格原先把 `tokensTs` 写成 29558(= Python 的读数),另立 `tokensTsFullColumn` 存 TS 真值 ——
    // 那是**字段过载**:字段名叫 tokensTs、值却是 Python 端的读数。一条把真相判红的尺子
    // (Python 件当时断言「两端必须同值」,而该前提已因追加 CJK 而失效)教出来的就是谎报:
    // 上一位 agent 为了保那条断言绿,把 TS 真值挪了个字段名,而不是改判据。
    // 现已改正:`tokensTs` 回归 TS 真值 29500,Python 值归 `tokensPyAsShipped`,
    // `tokensTsFullColumn` 这个过载的产物**已删除**(不留重名影子字段)。
    // 这条断言的作用:防止有人再把两个字段写成同一个值(那正是过载的复发形态)。
    expect(fixture.reverseLock.tokensTs).not.toBe(fixture.reverseLock.tokensPyAsShipped)
    expect(fixture.reverseLock.tokensTs).toBe(29500)
    expect(fixture.reverseLock.tokensPyAsShipped).toBe(29558)
    expect(fixture.reverseLock).not.toHaveProperty('tokensTsFullColumn')
    // 整列两端不等是**正确现状**(两端不是同一套 BPE 词表),故这一格按差值判而不是按同值判
    expect(fixture.reverseLock.crossEndGapFullColumn).not.toBe(0)
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
        const writePoints = PY_WRITE_POINTS
        if (c.pyCountsReasoning) {
          // 翻 true 的唯一合法前提:生产面真出现了带 reasoning 的消息写入点,且届时两端必须同值。
          expect(writePoints.length).toBeGreaterThan(0)
          expect(c.expect.tokensTs).toBe(c.expect.tokensPyAsShipped)
        } else {
          expect(writePoints).toEqual([])
          // 源码证据:Python 估算面至今不认识任何 reasoning 键名
          expect(PY_ESTIMATOR_REASONING_KEYS).toEqual([])
          expect(PY_WRITE_POINTS.length).toBe(
            fixture.reasoningCases.reachabilitySentinel
              .pythonReasoningMessageWritePointsAtAuthoringTime,
          )
        }
      })
    })
  }
})

// ==================== 残余⑤:CJK 用例 —— 两端分词器对汉字的分歧逐值钉死 ====================
//
// 读数口径(必须随读数一起看):TS 侧走 `gpt-tokenizer` 默认 `o200k_base`,
// Python 侧走 `tiktoken` `cl100k_base` —— **词表分歧未修(残余②另票负责归因),两端不等是预期**。
// 本段只负责把差值**逐值钉死**,不许折成「待人工核」,更不许为了两端相等去改基线数值。
//
// 实测方向与 ASCII 相反:既有 24 条纯 ASCII 两端**零漂移**,而汉字上 **Python 反而比 TS 多**
// (短 -3 / 长 -55,合并 -58)。即 CJK 不是"精度误差",是系统性方向相反的词表差异。

const CJK_RE = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/

describe('G-1058650 残余⑤:CJK 消息在双端夹具里逐值钉死分词分歧', () => {
  const cases = fixture.cjkCases.cases

  it('夹具里这一格至少两条 CJK 用例,且一条短中文、一条长中文', () => {
    expect(cases.length).toBeGreaterThanOrEqual(2)
    const ids = cases.map((c) => c.id)
    expect(ids).toContain('cjk-short-text-cross-end-split-gap')
    expect(ids).toContain('cjk-long-text-accumulated-split-gap')
    // 长文本必须显著长于短文本 —— 否则"累积分歧"这一格没东西可累积
    const short = cases.find((c) => c.id === 'cjk-short-text-cross-end-split-gap')!
    const long = cases.find((c) => c.id === 'cjk-long-text-accumulated-split-gap')!
    expect(long.input.messages[0].content.length).toBeGreaterThan(
      short.input.messages[0].content.length * 10,
    )
  })

  it('CJK 用例确实含汉字,且只出现在夹具尾部(既有 24 条仍零 CJK)', () => {
    for (const c of cases) {
      for (const m of c.input.messages) {
        expect(CJK_RE.test(String(m.content))).toBe(true)
      }
    }
    // 反向锁的这一半:既有 24 条一条 CJK 都不许有
    const base = fixture.input.messages.slice(0, fixture.reverseLock.baselineMessageCount)
    expect(base.filter((m) => CJK_RE.test(String(m.content)))).toHaveLength(0)
  })

  it('CJK 用例就是 input.messages 尾部那两条(不是另造一份脱离夹具的消息)', () => {
    for (const c of cases) {
      const inInput = fixture.input.messages[c.messageIndexInInput]
      expect(inInput).toEqual(c.input.messages[0])
    }
    expect(cases.map((c) => c.messageIndexInInput)).toEqual([24, 25])
  })

  for (const c of cases) {
    describe(c.id, () => {
      const messages = c.input.messages as ChatMessage[]

      it('TS 实时估算 == 夹具钉住的 tokensTs', () => {
        expect(estimateMessagesTokens(messages)).toBe(c.expect.tokensTs)
      })

      it('跨端差值逐值钉死(不许写成"待人工核",也不许折成绝对值掩盖方向)', () => {
        // 算式方向固定为 tokensTs - tokensPyAsShipped;CJK 上它为**负**(Python 多算)
        expect(c.expect.crossEndGap).toBe(c.expect.tokensTs - c.expect.tokensPyAsShipped)
        expect(typeof c.expect.crossEndGap).toBe('number')
        expect(c.expect.crossEndGap).not.toBe(0)
      })

      it('两端不等是**已知现状**(词表分歧未修),故必须显式登记为不等而不是被抹平', () => {
        expect(c.expect.tokensTs).not.toBe(c.expect.tokensPyAsShipped)
      })
    })
  }

  it('分词分歧随文本变长而**累积放大**(长中文差值绝对值 > 短中文)', () => {
    const short = cases.find((c) => c.id === 'cjk-short-text-cross-end-split-gap')!
    const long = cases.find((c) => c.id === 'cjk-long-text-accumulated-split-gap')!
    expect(Math.abs(long.expect.crossEndGap)).toBeGreaterThan(Math.abs(short.expect.crossEndGap))
  })

  it('两条 CJK 合并的现场值 == 逐值之和的登记值(证明逐值锁不是各自独立凑出来的)', () => {
    const both = fixture.cjkCases.cases.flatMap((c) => c.input.messages) as ChatMessage[]
    expect(estimateMessagesTokens(both)).toBe(fixture.cjkCases.aggregate.tokensTs)
    expect(fixture.cjkCases.aggregate.crossEndGap).toBe(
      fixture.cjkCases.aggregate.tokensTs - fixture.cjkCases.aggregate.tokensPyAsShipped,
    )
    const sumTs = cases.reduce((a, c) => a + c.expect.tokensTs, 0)
    expect(fixture.cjkCases.aggregate.tokensTs).toBe(sumTs)
  })

  it('CJK 两端差异**不来自 reasoning 维度**(本段消息一律不带 reasoning 键)', () => {
    // 与 reasoningCases 那一格区分开:那边差在"Python 不计 reasoning",这边差在分词器词表。
    const both = fixture.cjkCases.cases.flatMap((c) => c.input.messages) as ChatMessage[]
    const carriers = both.filter((m) =>
      Object.keys(m).some((k) => (REASONING_KEY_NAMES as readonly string[]).includes(k)),
    )
    expect(carriers).toHaveLength(0)
  })
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
    expect(PY_WRITE_POINTS).toEqual([])
    expect(PY_WRITE_POINTS.length).toBe(0)
  })

  // 缓存不能变成"恒空的自证":上面三条全部读 PY_WRITE_POINTS,如果那次扫描其实一个文件
  // 都没打开,它们会一起绿而什么都没说(本仓"空扫不记绿"同一条禁令)。所以把**扫描面本身**
  // 也钉一条:树里真读到过 .py 文件,且数量与哨兵登记的量纲同侧(只下限,不钉死具体值)。
  it('覆盖面自证:顶层那次扫描真的打开了 app 树里的 .py(不是空扫冒充"写入点为 0")', () => {
    expect(PY_SCANNED_PY_FILE_COUNT).toBeGreaterThan(500)
  })
})

// ==================== 残余③:四形态双向用例(证明扩出来的判据有牙) ====================
//
// 每形态两条:**阳性**(该形态真的携带 reasoning ⇒ 必须报出写入点)+ **阴性**(形态像但不含
// reasoning ⇒ 必须不报)。缺任一条即"证明不了有牙",故成对写死。
// 变异对照见本文件末尾「变异对照」段的记录与台账。

describe('G-1058650 残余③ 形态扩形:四形态各配阳性/阴性双向用例', () => {
  const formsOf = (lines: string[]): string[] =>
    scanSourceTextForReasoningMessageWriteForms('fake/x.py', lines.join('\n')).map((h) => h.form)

  // ---- 形态③-1 `.update({...})`:同块内既有 role 键又有 reasoning 键 ----
  it('.update 阳性:更新块内带 role + reasoning ⇒ 必须报出写入点', () => {
    const lines = [
      'def _patch(messages: list[dict[str, Any]], thinking: str) -> None:',
      '    msg = messages[-1]',
      '    msg.update({',
      '        "role": "assistant",',
      '        "content": text,',
      '        "reasoning_content": thinking,',
      '    })',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/up.py', lines.join('\n'))).toEqual([
      { line: 3, form: 'update-call' },
    ])
  })

  it('.update 阴性:同样的 update 块但只有 role、无 reasoning ⇒ 必须不报', () => {
    const lines = [
      '    msg.update({',
      '        "role": "assistant",',
      '        "content": text,',
      '    })',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/up2.py', lines.join('\n'))).toEqual([])
  })

  it('.update 阴性:块内有 reasoning 但无 role ⇒ 必须不报(不变式要求 role 与 reasoning 同块)', () => {
    // ⚠️ 键名用**逐名**匹配的 `reasoning`,不是 `reasoning_effort` 这类更长标识符:
    // 后者压根不在 reasoningKeyNames 里,拿它当阴性样例的话,这条用例在 reasoning
    // 键正则整个坏掉时照样绿 —— 证明不了有牙。
    const lines = [
      '    cfg.update({',
      '        "model": name,',
      '        "reasoning": effort,',
      '    })',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/up3.py', lines.join('\n'))).toEqual([])
  })

  it('阴性:更长标识符 `reasoning_effort` 不是 reasoning 键(键名逐名匹配,非前缀匹配)', () => {
    const lines = [
      '    cfg.update({',
      '        "role": "assistant",',
      '        "reasoning_effort": "high",',
      '    })',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/up4.py', lines.join('\n'))).toEqual([])
  })

  // ---- 形态③-2 `{**base, "reasoning": ...}` 展开形 ----
  it('展开形 阳性:** 展开后同块内出现 role 键 + reasoning 键 ⇒ 必须报出写入点', () => {
    const lines = [
      'def _merge_reasoning(base: dict[str, Any], thinking: str) -> dict[str, Any]:',
      '    return {**base, "role": "assistant", "reasoning": thinking}',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/spread.py', lines.join('\n'))).toEqual([
      { line: 2, form: 'spread-dict' },
    ])
  })

  it('展开形 阳性:多行展开 + role 键在展开之后 ⇒ 必须报出写入点', () => {
    const lines = [
      '    new_messages[0] = {',
      '        **new_messages[0],',
      '        "role": "assistant",',
      '        "reasoning_content": block,',
      '    }',
    ]
    // 报出行号 = `**` 锚点所在行(=2),不是 `{` 所在行:锚点落在展开记号上,定位更精确。
    expect(scanSourceTextForReasoningMessageWriteForms('fake/spread2.py', lines.join('\n'))).toEqual([
      { line: 2, form: 'spread-dict' },
    ])
  })

  it('展开形 阴性:展开块里只有 content、没有 role 与 reasoning ⇒ 必须不报', () => {
    // 这正是真实树里 `routers/llm.py:1514` `new_messages[0] = {**new_messages[0], "content": merged}` 的形态
    const lines = ['    new_messages[0] = {**new_messages[0], "content": merged}']
    expect(scanSourceTextForReasoningMessageWriteForms('fake/spread3.py', lines.join('\n'))).toEqual([])
  })

  it('展开形 阴性:展开块里有 role 但 reasoning 在**另一个块** ⇒ 必须不报(同块不变式)', () => {
    const lines = ['    msg = {**base, "role": "assistant"}', '    other = {"reasoning": t}']
    expect(scanSourceTextForReasoningMessageWriteForms('fake/spread4.py', lines.join('\n'))).toEqual([])
  })

  // ---- 形态③-3 第三方 helper / SDK 间接构造(kwargs 写法) ----
  it('helper 阳性:构造消息对象的调用里 role= 与 reasoning= 同现 ⇒ 必须报出写入点', () => {
    const lines = [
      'from openai.types.chat import ChatCompletionMessage',
      'msg = ChatCompletionMessage(role="assistant", content=c, reasoning=thinking)',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/helper.py', lines.join('\n'))).toEqual([
      { line: 2, form: 'helper-kwargs' },
    ])
  })

  it('helper 阳性:多行 kwargs 调用,reasoning= 落在后续行 ⇒ 必须报出写入点(须能回溯到未配平的 `(`)', () => {
    const lines = [
      '    messages.append(',
      '        SessionMessage(',
      '            role="assistant",',
      '            content=c,',
      '            reasoning=thinking,',
      '        )',
      '    )',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/helper2.py', lines.join('\n'))).toEqual([
      { line: 3, form: 'helper-kwargs' },
    ])
  })

  it('helper 阴性:同一个 helper 调用但没有 reasoning= ⇒ 必须不报', () => {
    const lines = ['msg = SessionMessage(role="assistant", content=c)']
    expect(scanSourceTextForReasoningMessageWriteForms('fake/helper3.py', lines.join('\n'))).toEqual([])
  })

  it('helper 阴性:f-string 里的 role={role} 与别处的 reasoning 不构成同一条语句 ⇒ 必须不报', () => {
    const lines = [
      '    reasons.append(f"移除空 content(role={role})")',
      '    reasoning = getattr(resp.choices[0].message, "reasoning_content", None)',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/helper4.py', lines.join('\n'))).toEqual([])
  })

  it('helper 阴性:role= 出现在 f-string 文本里、reasoning= 也在 f-string 文本里 ⇒ 必须不报', () => {
    const lines = ['    log.info(f"role={role} reasoning={reasoning}")']
    expect(scanSourceTextForReasoningMessageWriteForms('fake/helper5.py', lines.join('\n'))).toEqual([])
  })

  // ---- 取块正确性:禁固定字符窗口(本仓踩过的坑) ----
  it('取块 阳性:形参默认值里的空 {} 不得把函数体切成 2 字符(必须从锚点列起配平)', () => {
    // 若用「从声明处找第一个 {」的老写法,这里会切到 `{}` 而漏报;正解是从 `.append(` 的 `(` 起配平。
    const lines = [
      'def healUnresponsiveServices(opts = {}, messages = []) -> None:',
      '    messages.append({',
      '        "role": "assistant",',
      '        "reasoning": t,',
      '    })',
    ]
    expect(scanSourceTextForReasoningMessageWriteForms('fake/trap.py', lines.join('\n'))).toEqual([
      { line: 2, form: 'append-call' },
    ])
  })

  it('取块:同一行只算一个写入点(嵌套调用不重复计数)', () => {
    const lines = ['    messages.append(msg.update({"role": "a", "reasoning": t}))']
    expect(formsOf(lines)).toEqual(['append-call'])
  })

  it('四形态互不串味:每种形态只认自己那一条语句', () => {
    // 一次性给齐四种形态,逐行核对判到的形态名
    const lines = [
      'a.update({"role": "assistant", "thinking": t})', // 形③-1 update
      'b = {**base, "role": "assistant", "reasoning": t}', // 形③-2 spread
      'c = SessionMessage(role="assistant", reasoning=t)', // 形③-3 helper
      'd.append({"role": "assistant", "reasoning": t})', // 形③-0 append
    ]
    const hits = scanSourceTextForReasoningMessageWriteForms('fake/mix.py', lines.join('\n'))
    expect(hits).toEqual([
      { line: 1, form: 'update-call' },
      { line: 2, form: 'spread-dict' },
      { line: 3, form: 'helper-kwargs' },
      { line: 4, form: 'append-call' },
    ])
  })

  it('形态枚举本身被登记(四形态都在册,新增形态必须同时改这里和台账)', () => {
    expect([...WRITE_FORMS]).toEqual(['append-call', 'update-call', 'spread-dict', 'helper-kwargs'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
