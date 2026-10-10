// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 A + 票 B 的常驻尺子(2026-09-29)。
 *
 * 票 A —— 「非交互 ∧ 无审批面 ⇒ 拒绝」的**判定与文案**收成一处。
 *   上游对照 `zcode/apps/zcode-cli/packages/cli/src/headless-workflow.ts:31-51`:只有两个具名
 *   工作流工具自动 allow,其余**全部委托同一个 `createDenyPermissionBroker()`**,所以拒绝的语义
 *   与文案只有一份;`tui-prompt-handler.ts:78-91` 在审批面缺席时走同一个出口并带 toolName 归因。
 *   我方此前是「机制在、委托结构不在」:`requiresUserConfirmation` 的四条判据齐,但三条拒绝路径
 *   各自拼头语文案,"有没有审批面"在 `executeToolCall` 里被写了两遍。
 *
 * 票 B —— 裁剪必须自报丢了多少。
 *   上游对照 `commands-command.ts:167`、`skills-command.ts:162` 都打印 `bytesRead/sizeBytes (truncated)`。
 *   我方 `tools/clipboard.ts` 五处 `.slice(0, MAX_CLIPBOARD_CHARS)` 剪完就丢而不报 ——
 *   "被裁"与"本来就这么长"在消费方眼里同形。
 *
 * 两类判据各钉一头:
 *  · **行为面** —— 走生产入口(`executeToolCall` / 工具 `execute`),不是把判据抄进测试重跑;
 *  · **单源面** —— 句面常量在被审源码里只许出现一次,且必须**剥注释后**再数(否则门会把自己
 *    解释自己的散文判成第二份文案,守门 131 同型)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ToolContract } from '@ihui/types'
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
  type ToolResult,
} from '../src/tools/index.js'
import {
  clipToClipboardBudget,
  clipboardTruncationNote,
  isClipboardAvailable,
  readClipboard,
  writeClipboardWithOutcome,
  CLIPBOARD_TOOLS,
} from '../src/tools/clipboard.js'
import { denialErrorSuffix, toolDenialGuidance, type ToolCallDenial } from '../src/utils/tool-denial.js'
// 遮噪只引这一份权威实现(§3/§22c:同一件事在两处各算一遍必漂移,测试不得再抄一台状态机)
import { maskComments } from '../../../scripts/lib/code-mask.mjs' // arch-exempt: 判据面必须与被审门共用同一份遮罩实现,属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

/**
 * 被审源(单源判据的对象是**真文件**,不是自造夹具 —— AGENTS §22c)。
 * 票 A 审的是"拒绝的判定与文案有几份",所以除 `tools/index.ts` 那道闸之外,还必须把
 * **另两处自己拼头语的落点**(`tools/builtins.ts`、`tools/terminal.ts`)与文案映射本体
 * (`utils/tool-denial.ts`)一起取面 —— 只审 index 会把"别的文件又抄了一句"读成绿的。
 */
const TOOLS_INDEX_SRC = readFileSync(fileURLToPath(new URL('../src/tools/index.ts', import.meta.url)), 'utf8')
const CLIPBOARD_SRC = readFileSync(fileURLToPath(new URL('../src/tools/clipboard.ts', import.meta.url)), 'utf8')
const BUILTINS_SRC = readFileSync(fileURLToPath(new URL('../src/tools/builtins.ts', import.meta.url)), 'utf8')
const TERMINAL_SRC = readFileSync(fileURLToPath(new URL('../src/tools/terminal.ts', import.meta.url)), 'utf8')
const DENIAL_SRC = readFileSync(fileURLToPath(new URL('../src/utils/tool-denial.ts', import.meta.url)), 'utf8')

/**
 * 剥掉注释、**保留字符串**的那一份代码面 —— 直接调仓内唯一实现 `maskComments`
 * (行注释整段删除,块注释就地抹白:行号不漂,列位在块注释后不保证,所以结论按**站点次数**读,
 * 不按列位读)。
 *
 * 为什么必须剥:单源判据要数的是"代码里拼了几次这句话",而头注/文档注释里引用同一句是
 * **合法的自我说明**;不剥就会把解释判成违规(守门 131 第一次自跑就是被自己写的说明咬到的)。
 * 为什么必须保留字符串:URL 里的 `//`、模板串里的 `/*` 都不是注释 —— 按"看见 // 就剥"写会
 * 把代码本身吃掉,判据静默失明(守门 70 的 `'https://x/*'` 假绿态同型)。
 */
function codeFace(src: string): string {
  return maskComments(src)
}

const TOOLS_CODE = codeFace(TOOLS_INDEX_SRC)
const CLIPBOARD_CODE = codeFace(CLIPBOARD_SRC)
const BUILTINS_CODE = codeFace(BUILTINS_SRC)
const TERMINAL_CODE = codeFace(TERMINAL_SRC)
const DENIAL_CODE = codeFace(DENIAL_SRC)

/** 数一份代码面上某个串出现几次(不用正则 —— 待数的句子本身含括号与正则元字符)。 */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0
  let n = 0
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) n++
  return n
}

// ==================== 钩子与夹具 ====================

beforeEach(() => {
  clearTools()
  resetRateLimiter()
})

afterEach(() => {
  // 票 A 有一枚用例要把时钟拨过限流窗(见"限流不是拒绝的成因"),用完必须还原真实时钟,
  // 否则同一 worker 里后跑的测试会继承 fake timers;注册表也逐个用例清干净。
  vi.useRealTimers()
  clearTools()
})

/**
 * 最小可用契约:结果预算刻意放到 1 MiB,免得本票顺带把测试工具的输出裁掉
 * (执行器边界按 `contract.resultBudget` 截断 —— 那是另一件事,不在这里验)。
 */
function contractWith(permissionOverrides: Partial<ToolContract['permission']> = {}): ToolContract {
  return {
    shape: { visibleToProvider: true, input: { type: 'object', properties: {} } },
    permission: {
      permissionKey: 'test.surface',
      reason: 'fixture contract (ASCII on purpose)',
      riskLevel: 'read',
      effectScope: 'none',
      requiresApproval: false,
      ...permissionOverrides,
    },
    resultBudget: {
      inlineLimitBytes: 1_048_576,
      providerVisibleLimitBytes: 1_048_576,
      policy: 'inline',
      preview: { bytes: 4096, lines: 40, from: 'head' },
    },
  }
}

function makeTool(opts: {
  name: string
  dangerLevel?: 'read' | 'write' | 'dangerous'
  contract?: ToolContract
  approvalExemption?: { readonly readonlyAxis: boolean; readonly closedWorldAxis: boolean }
}): Tool {
  return {
    name: opts.name,
    description: `fixture ${opts.name}`,
    parameters: {},
    required: [],
    dangerLevel: opts.dangerLevel,
    contract: opts.contract,
    approvalExemption: opts.approvalExemption,
    execute: vi.fn(async () => ({ success: true, output: 'ran' })),
  }
}

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspacePath: '.', ...overrides }
}

const OVER = 1_234

// ==================== 票 A:行为面 —— 拒绝只从生产入口那一道出口给出 ====================

/** 取返回体里的结构化 denial;取不到就当场判红(缺字段不得被读成"这一条没测")。 */
function denialOf(r: ToolResult): ToolCallDenial {
  const d = r.denial
  if (!d) throw new Error(`返回体缺结构化 denial 字段: error=${String(r.error)}`)
  return d
}

/** 错误串的第一行 = 拒绝头语。 */
function headOf(error: string): string {
  return error.split('\n')[0] ?? ''
}

/**
 * 头语形状:把句尾那个工具名换成占位符,剩下的是"这段文案本身的形状"。
 * 刻意用 `lastIndexOf(' ')` 而不是正则 —— 本票唯一的尺子是"剥注释后数站点",
 * 测试里再写一台模式匹配就又成了第二份实现。
 */
function headShape(error: string): string {
  const head = headOf(error)
  const at = head.lastIndexOf(' ')
  return at < 0 ? head : `${head.slice(0, at + 1)}<tool>`
}

describe('票 A:无审批面 ⇒ 生产入口真的拒,三条"必须问"的入口汇成同一个出口', () => {
  it('dangerous 档 / 显式 alwaysAsk / 声明了免批两轴却没同时成立 ⇒ 同一道闸、同一段头语、同一个出路出口', async () => {
    const fixtures = [
      makeTool({ name: 'a_exit_dangerous', dangerLevel: 'dangerous' }),
      makeTool({ name: 'a_exit_alwaysask', dangerLevel: 'read', contract: contractWith({ alwaysAsk: true }) }),
      makeTool({
        name: 'a_exit_halfaxes',
        dangerLevel: 'read',
        approvalExemption: { readonlyAxis: true, closedWorldAxis: false },
      }),
    ]
    registerTools(fixtures)
    const gates: string[] = []
    const deciders: string[] = []
    const shapes: string[] = []
    for (const tool of fixtures) {
      // 无审批面 = ctx 里根本没有 confirmDangerous(非交互/无头宿主的事实形态)
      const r = await executeToolCall({ name: tool.name, arguments: { target: 'x' } }, makeCtx())
      expect(r.success).toBe(false)
      expect(r.errorType).toBe('permission_denied')
      expect(tool.execute).not.toHaveBeenCalled()
      const denial = denialOf(r)
      gates.push(denial.gate)
      deciders.push(denial.decider)
      shapes.push(headShape(r.error ?? ''))
      // 出路那一行必须是**对返回体里那份结构化 denial 现算**的后缀,不是各路径手搓的第二份文案
      const lines = (r.error ?? '').split('\n')
      expect(lines).toHaveLength(2)
      expect(lines[1]).toBe(denialErrorSuffix(denial))
      expect(denial.guidance).toBe(toolDenialGuidance(denial.gate, denial.decider))
    }
    expect(gates).toEqual(['dangerous-gate', 'dangerous-gate', 'dangerous-gate'])
    expect(deciders).toEqual([
      'no-confirmation-channel',
      'no-confirmation-channel',
      'no-confirmation-channel',
    ])
    expect(shapes).toEqual([
      '危险操作被拒绝(需用户确认): <tool>',
      '危险操作被拒绝(需用户确认): <tool>',
      '危险操作被拒绝(需用户确认): <tool>',
    ])
  })

  it('成对的那一半:审批面在场、人当面说不 ⇒ 同一道闸但归因翻成 user-declined(handler 仍零调用)', async () => {
    const tool = makeTool({ name: 'a_exit_declined', dangerLevel: 'dangerous' })
    registerTools([tool])
    const seen: string[] = []
    const confirm = vi.fn(async (t: Tool) => {
      seen.push(t.name)
      return false
    })
    const r = await executeToolCall(
      { name: tool.name, arguments: { target: 'x' } },
      makeCtx({ confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['a_exit_declined'])
    expect(r.success).toBe(false)
    const denial = denialOf(r)
    expect(denial.gate).toBe('dangerous-gate')
    expect(denial.decider).toBe('user-declined')
    expect(denial.guidance).toBe(toolDenialGuidance('dangerous-gate', 'user-declined'))
    expect(headShape(r.error ?? '')).toBe('危险操作被拒绝(需用户确认): <tool>')
    expect(tool.execute).not.toHaveBeenCalled()
  })

  it('阳性对照:审批面在场且点头 ⇒ 放行执行(本票没把门改成恒拒)', async () => {
    const tool = makeTool({ name: 'a_exit_approved', dangerLevel: 'dangerous' })
    registerTools([tool])
    const seen: string[] = []
    const confirm = vi.fn(async (t: Tool) => {
      seen.push(t.name)
      return true
    })
    const r = await executeToolCall(
      { name: tool.name, arguments: { target: 'x' } },
      makeCtx({ confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['a_exit_approved'])
    expect(r.success).toBe(true)
    expect(r.output).toBe('ran')
    expect(r.denial).toBeUndefined()
  })

  it('fail-closed 不变:会话级 allowDangerous=true 但没有审批面 ⇒ 仍然拒(面缺席不等于放行)', async () => {
    const tool = makeTool({ name: 'a_failclose_flagonly', dangerLevel: 'dangerous' })
    registerTools([tool])
    const r = await executeToolCall(
      { name: tool.name, arguments: { target: 'x' } },
      makeCtx({ allowDangerous: true }),
    )
    expect(r.success).toBe(false)
    expect(denialOf(r).decider).toBe('no-confirmation-channel')
    expect(tool.execute).not.toHaveBeenCalled()
  })

  it('两道闸两份头语、一份出路:规则 deny 先拒且不问人,出路行与确认闸共用同一个出口', async () => {
    const tool = makeTool({ name: 'a_rule_gate', dangerLevel: 'dangerous' })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: tool.name, arguments: { target: 'x' } },
      makeCtx({ permissions: { deny: [tool.name] }, confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.errorType).toBe('permission_denied')
    const denial = denialOf(r)
    expect(denial.gate).toBe('permission-rule')
    expect(denial.decider).toBe('rule-deny')
    // 规则闸的头语与确认闸的头语是**两段不同文案**(现状:两闸各一份),但出路行走同一份映射
    const head = headOf(r.error ?? '')
    expect(headShape(r.error ?? '')).not.toBe('危险操作被拒绝(需用户确认): <tool>')
    expect(head).toContain(tool.name)
    const lines = (r.error ?? '').split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe(denialErrorSuffix(denial))
    expect(denial.guidance).toBe(toolDenialGuidance('permission-rule', 'rule-deny'))
  })

  it('限流不是拒绝的成因:窗内前 5 次由确认闸拒、第 6 次才由限流拦,拨过窗口后仍由确认闸拒', async () => {
    // 假时钟只拿来拨限流窗(不把 30 分钟墙钟预算一起掐掉),所以 toFake 只点名定时器与 Date
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    const tool = makeTool({ name: 'a_rate_vs_gate', dangerLevel: 'dangerous' })
    registerTools([tool])
    const ctx = makeCtx()
    const errorTypes: string[] = []
    const deciders: string[] = []
    for (let i = 0; i < 6; i++) {
      const r = await executeToolCall({ name: tool.name, arguments: {} }, ctx)
      errorTypes.push(r.errorType ?? 'ok')
      deciders.push(r.denial?.decider ?? '-')
    }
    expect(errorTypes).toEqual([
      'permission_denied',
      'permission_denied',
      'permission_denied',
      'permission_denied',
      'permission_denied',
      'rate_limited',
    ])
    // 第 6 次那一条**没有** denial ⇒ 限流不冒充拒绝出口(两闸的归因各查各的)
    expect(deciders).toEqual([
      'no-confirmation-channel',
      'no-confirmation-channel',
      'no-confirmation-channel',
      'no-confirmation-channel',
      'no-confirmation-channel',
      '-',
    ])
    expect(tool.execute).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_001)
    const after = await executeToolCall({ name: tool.name, arguments: {} }, ctx)
    expect(after.errorType).toBe('permission_denied')
    expect(denialOf(after).gate).toBe('dangerous-gate')
  })
})

// ==================== 票 A:单源面 —— 剥注释后数真文件里有几份 ====================

/** 判据 ① 的原文(index.ts:763 那一行)与本票要数的头语句面。 */
const DANGER_JUDGMENT = "tool.dangerLevel === 'dangerous'"
const DENY_HEAD = '危险操作被拒绝(需用户确认)'

/**
 * 夹具(尺子的有牙/不咬自己两半,都靠构造面而不是真文件):
 * 同一句判据抄两遍 ⇒ 必读数 2;只写在注释里 ⇒ 未剥 3、剥后 1。
 */
const JUDGE_TWICE = [
  'export function requiresUserConfirmation(tool: Tool): boolean {',
  `  if (${DANGER_JUDGMENT}) return true;`,
  '  return false;',
  '}',
  'function legacyAsk(tool: Tool): boolean {',
  `  if (${DANGER_JUDGMENT}) return true;`,
  '  return false;',
  '}',
].join('\n')

const JUDGE_ONCE = [
  'export function requiresUserConfirmation(tool: Tool): boolean {',
  `  if (${DANGER_JUDGMENT}) return true;`,
  '  return false;',
  '}',
  `// 文档注释里再引用同一句: ${DANGER_JUDGMENT} 是唯一判据`,
  `/* 块注释里也引用一次: ${DANGER_JUDGMENT} */`,
].join('\n')

describe('票 A:单源面 —— 尺子先要有牙,才轮得到数真文件', () => {
  it('有牙(成对的第一半):同一判据写两遍 ⇒ 读数 2(目标 1 时必红)', () => {
    expect(countOccurrences(JUDGE_TWICE, DANGER_JUDGMENT)).toBe(2)
  })

  it('不咬自己(成对的第二半):同一句只出现在注释里 ⇒ 未剥 3、剥注释后 1(目标 1 时必绿)', () => {
    expect(countOccurrences(JUDGE_ONCE, DANGER_JUDGMENT)).toBe(3)
    expect(countOccurrences(codeFace(JUDGE_ONCE), DANGER_JUDGMENT)).toBe(1)
  })

  it('跨文件加总同样有牙(成对的第三半):两份夹具面各 1 处 ⇒ 合计 2,不是各看各的 1', () => {
    const faceA = `const e = \`${DENY_HEAD}: a\``
    const faceB = `const e = \`${DENY_HEAD}: b\``
    expect(countOccurrences(faceA, DENY_HEAD)).toBe(1)
    expect(countOccurrences(`${faceA}\n${faceB}`, DENY_HEAD)).toBe(2)
  })
})

describe('票 A:单源面 —— 在 HEAD 已成立的那几条判据(精确数)', () => {
  it('判定「危险档」在整个 index 源码面只有 1 处 ⇒ executeToolCall 里没有再抄一遍判据', () => {
    expect(countOccurrences(TOOLS_CODE, DANGER_JUDGMENT)).toBe(1)
  })

  it('批准判定唯一定义;闸谓词在钩子咨询入口与改后人工窗两阶段求值(合计 3 = 定义 1 + 两处闸 2)', () => {
    // G-424 钩子改写重判:同一 requiresUserConfirmation 谓词先在钩子咨询入口求值一次,
    // 改后内容重判权限漂移后在人工窗再求值一次 —— 两处是同一谓词的两个流程阶段,
    // 不是把判据抄第二遍(定义唯一性由上一行继续钉死,判据本体仍单源)。
    expect(countOccurrences(TOOLS_CODE, 'export function requiresUserConfirmation(')).toBe(1)
    expect(countOccurrences(TOOLS_CODE, 'if (requiresUserConfirmation(')).toBe(2)
    expect(countOccurrences(TOOLS_CODE, 'requiresUserConfirmation(')).toBe(3)
  })

  it('闸名与归因串各归其位:每态出现次数必须等于其语义档位数 ⇒ 拒绝路径不能各自新造一态', () => {
    // G-424 钩子改写后的重判拒绝与首过规则拒绝同形(注释原话"gate/decider 与首过同形"),
    // 复用同一 buildToolDenial 形态 ⇒ 'permission-rule'/'rule-deny' 各 +1 是复用而非新造;
    // 其余四态仍各只有一份(新拒绝路径没有引入新档位)。
    for (const [lit, want] of [
      ["'permission-rule'", 2],
      ["'dangerous-gate'", 1],
      ["'lease-digest-drift'", 1],
      ["'rule-deny'", 2],
      ["'no-confirmation-channel'", 1],
      ["'user-declined'", 1],
    ] as const) {
      expect(countOccurrences(TOOLS_CODE, lit)).toBe(want)
    }
    // 头语在 index 内只拼一遍;审计出口被两处调用(规则闸 + 确认闸)覆盖三道闸
    expect(countOccurrences(TOOLS_CODE, DENY_HEAD)).toBe(1)
    // G-424 钩子改写重判路径的规则拒绝复用同一句 ruleMsg(与首过逐字同形),故 +1
    expect(countOccurrences(TOOLS_CODE, '被权限规则拒绝')).toBe(2)
    expect(countOccurrences(TOOLS_CODE, '摘要漂移')).toBe(1)
    // 审计出口三处调用:规则闸 + 钩子改写重判规则闸 + 确认闸,覆盖全部拒绝路径
    expect(countOccurrences(TOOLS_CODE, 'auditToolDenial(')).toBe(3)
  })

  it('出路文案只有一份映射:toolDenialGuidance 定义 1/合计 2、后缀格式串 1、四条 GUIDANCE_* 各 2(声明 + 使用)', () => {
    expect(countOccurrences(DENIAL_CODE, 'export function toolDenialGuidance(')).toBe(1)
    expect(countOccurrences(DENIAL_CODE, 'toolDenialGuidance(')).toBe(2)
    expect(countOccurrences(DENIAL_CODE, '[ihui-denial gate=')).toBe(1)
    for (const name of [
      'GUIDANCE_PERMISSION_RULE_DENY',
      'GUIDANCE_LEASE_DRIFT',
      'GUIDANCE_DANGEROUS_NO_CHANNEL',
      'GUIDANCE_USER_DECLINED',
    ]) {
      expect(countOccurrences(DENIAL_CODE, name)).toBe(2)
    }
  })
})

describe('票 A:单源面 —— HEAD 尚未成立的两条(如实点名,按棘轮只封存量上界)', () => {
  /**
   * 票 A 的承诺是"判定与文案收成一处"。现读(剥注释后的代码面):
   *  · "有没有审批面"在 `executeToolCall` 里被读了两遍(`:889` 判放/不放、`:911` 判归因),
   *    目标是 1 处 —— 未达成;
   *  · 拒绝头语 `危险操作被拒绝(需用户确认)` 在 3 个文件里共 7 处(index 1 + builtins 4 +
   *    terminal 2),而且 builtins/terminal 那两处还各自 re-test 审批面、**不带** denial 结构
   *    (`buildToolDenial(` 与 `denialErrorSuffix(` 在两份文件面上都是 0)—— 目标是 1 处,未达成。
   * 按本仓的棘轮口径,存量不当场判红(那是与任何提交无关的恒红门),但**新增一处必红**;
   * 上面两条用例名里就写着目标值,谁把它们改成 `toBe(1)` 谁就是在宣布票 A 做完了。
   */
  it('「有没有审批面」在 index 面上仍有 2 个站点(目标 1,HEAD 未达成 ⇒ 封上界 2)', () => {
    expect(countOccurrences(TOOLS_CODE, 'ctx.confirmDangerous ?')).toBeLessThanOrEqual(2)
  })

  it('拒绝头语跨 3 份文件共 7 处(目标 1,HEAD 未达成 ⇒ 封上界 7 处 / 3 份文件)', () => {
    const faces = [TOOLS_CODE, BUILTINS_CODE, TERMINAL_CODE]
    const sites = faces.reduce((acc, face) => acc + countOccurrences(face, DENY_HEAD), 0)
    const filesWithHead = faces.filter((face) => countOccurrences(face, DENY_HEAD) > 0).length
    expect(sites).toBeLessThanOrEqual(7)
    expect(filesWithHead).toBeLessThanOrEqual(3)
  })

  it('builtins/terminal 两支仍在自己 re-test 审批面且不带拒绝结构(现状封上界 ⇒ 接线后本条应改成 0)', () => {
    expect(countOccurrences(BUILTINS_CODE, 'ctx.confirmDangerous')).toBeLessThanOrEqual(6)
    expect(countOccurrences(TERMINAL_CODE, 'ctx.confirmDangerous')).toBeLessThanOrEqual(2)
    expect(countOccurrences(BUILTINS_CODE, 'buildToolDenial(')).toBe(0)
    expect(countOccurrences(TERMINAL_CODE, 'buildToolDenial(')).toBe(0)
  })
})

describe('票 B:clipToClipboardBudget 把丢弃量随结果一起带出来', () => {
  it('未溢出 ⇒ droppedChars=0、文本逐字不变、truncated=false(不报)', () => {
    const short = 'a'.repeat(100)
    const clip = clipToClipboardBudget(short)
    expect(clip.text).toBe(short)
    expect(clip.droppedChars).toBe(0)
    expect(clip.truncated).toBe(false)
  })

  it('恰好等于上限 ⇒ 不算溢出(边界不得多报一笔)', () => {
    const exact = 'b'.repeat(32_000)
    const clip = clipToClipboardBudget(exact)
    expect(clip.text.length).toBe(32_000)
    expect(clip.droppedChars).toBe(0)
    expect(clip.truncated).toBe(false)
  })

  it('溢出 ⇒ 截到上限并给出**精确**丢弃数(上限值未被顺手改动)', () => {
    const long = 'c'.repeat(32_000 + OVER)
    const clip = clipToClipboardBudget(long)
    expect(clip.text.length).toBe(32_000)
    expect(clip.droppedChars).toBe(OVER)
    expect(clip.truncated).toBe(true)
  })

  it('空串 ⇒ 零丢弃(不得把"没有内容"读成"被裁过")', () => {
    const clip = clipToClipboardBudget('')
    expect(clip.text).toBe('')
    expect(clip.droppedChars).toBe(0)
    expect(clip.truncated).toBe(false)
  })
})

describe('票 B:提示语未溢出不报、溢出必点名丢弃字数', () => {
  it('droppedChars=0 ⇒ 返回空串(成对的那一半:不裁就一个字都不报)', () => {
    expect(clipboardTruncationNote(100, 0)).toBe('')
  })

  it('溢出 ⇒ 报出原始长度、保留数与**具体丢弃字数**', () => {
    const note = clipboardTruncationNote(32_000 + OVER, OVER)
    expect(note).toContain(`丢弃 ${OVER} 字`)
    expect(note).toContain(`原始长度 ${32_000 + OVER} 字符`)
    expect(note).toContain('保留 32000 字符')
  })
})

describe('票 B:五个裁剪站点全部委托同一个出口', () => {
  it('代码面上 .slice(0, MAX_CLIPBOARD_CHARS) 只许出现在唯一出口里(1 次)', () => {
    expect(countOccurrences(CLIPBOARD_CODE, 'slice(0, MAX_CLIPBOARD_CHARS)')).toBe(1)
  })

  it('裁剪出口被调用 5 处(读 4 + 写 1),不得有站点退回手搓 slice', () => {
    // 代码面上该标识符出现 6 次 = 定义 1 + 调用 5;注释里"原有 5 处 slice"那句已被遮罩剥掉
    expect(countOccurrences(CLIPBOARD_CODE, 'clipToClipboardBudget(')).toBe(6)
  })

  it('提示语模板只有一份常量,且两个工具站点都调它', () => {
    expect(countOccurrences(CLIPBOARD_CODE, '[已截断,原始长度')).toBe(1)
    expect(countOccurrences(CLIPBOARD_CODE, 'clipboardTruncationNote(')).toBe(3) // 定义 1 + 调用 2
  })

  it('上限常量仍是那一个 32_000(本票不得顺手改值)', () => {
    expect(countOccurrences(CLIPBOARD_CODE, 'MAX_CLIPBOARD_CHARS = 32_000')).toBe(1)
  })

  it('readClipboard 的对外签名未变(返回字符串),细节走带丢弃量的出口', () => {
    expect(typeof readClipboard()).toBe('string')
    expect(countOccurrences(CLIPBOARD_CODE, 'return readClipboardExcerpt().text')).toBe(1)
  })
})

describe('票 B:丢弃数经生产入口(注册表 + executeToolCall)交到消费方手里', () => {
  it('clipboard_write 走 executeToolCall:被裁就点名丢弃字数,没被裁一个字都不报', async () => {
    expect(CLIPBOARD_TOOLS.map((t) => t.name)).toEqual(['clipboard_read', 'clipboard_write'])
    registerTools([...CLIPBOARD_TOOLS])

    // 与平台可用性无关的那一半(无条件断言):裁剪量在探测剪贴板通道**之前**就算出来了,
    // 所以"报不报得出丢弃数"不取决于这台机器有没有 PowerShell。
    const short = writeClipboardWithOutcome('e'.repeat(200))
    expect(short.droppedChars).toBe(0)
    expect(short.truncated).toBe(false)
    const long = writeClipboardWithOutcome('f'.repeat(32_000 + OVER))
    expect(long.droppedChars).toBe(OVER)
    expect(long.truncated).toBe(true)

    const text = 'g'.repeat(32_000 + OVER)
    const r = await executeToolCall({ name: 'clipboard_write', arguments: { text } }, makeCtx())
    // 通道在位性由被测代码自己那一份出口给(`isClipboardAvailable`),测试不另判平台:
    // 无通道 ⇒ 必须点名"无可用剪贴板工具"(不得静默成功);有通道 ⇒ 必须把丢弃字数报进 output。
    if (!isClipboardAvailable()) {
      expect(r.success).toBe(false)
      expect(r.error).toContain('无可用剪贴板工具')
    } else {
      // 全量并发时 PowerShell 偶发失败(与 clipboard.test.ts 同一已知环境档),容忍"这一次没写成",
      // 但写成时必须报出丢弃数 —— 上面两条无条件断言才是本票的牙。
      expect(r.success ? r.output : r.error).toBeTruthy()
      if (r.success) {
        expect(r.output).toContain(`丢弃 ${OVER} 字`)
        expect(r.output).toContain(`原始长度 ${text.length} 字符`)
      }
    }
  })
})

// 说明:原第 4 段"工具层真的把丢弃数报出去"已随票 A 一起移出 —— 它断言的是 tools/index.ts 里
// 尚未入库的执行器接线(见 PROJECT_PLAN G-816101/G-814407)。留下的是只依赖已入库 clipboard.ts 的三段。
// 2026-09-29 补:上面那段以"注册 CLIPBOARD_TOOLS + executeToolCall 驱动 clipboard_write"的形态回来了
// (见最后一个 describe),因为它现在只依赖已入库的那一份接线;票 A 的两类判据(行为面 / 单源面)
// 也已在本文件里补齐。**如实记着**:票 A 的"文案收成一处 / 审批面判定只写一遍"在 HEAD 尚未成立,
// 对应判据按棘轮只封存量上界,用例名里点名了目标值。
