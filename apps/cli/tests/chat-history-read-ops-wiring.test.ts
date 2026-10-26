// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 装车锁:`ihui chat history <conversationId>` 必须真调用到 history-read-ops 的导出。
 *
 * 立因(AGENTS §0.9「判据必须在真跑它的那一刻才成立」/ §0.6 单一真相源):
 * `apps/cli/src/commands/history-read-ops.ts` 是 turn 分片投影的 CLI 消费体,三个投影
 * 调用点(模块内 :327/:328)早在 HEAD,共享层那条锁(`packages/shared/src/chat/__tests__/
 * history-projection.test.ts`)也全绿 —— 但那条锁**只读文件文本**:它判得出"模块里有没有
 * 调用点",判不出"有没有入口走到这个模块"。实测(2026-10-21):全 apps/cli 内
 * `history-read-ops` 的 importer 只有测试文件与一条注释,而 `ihui chat history` 走的是
 * `/api/chat/conversations` 另一条路径 ⇒ 能力躺在库里,没有任何命令会走到它。
 *
 * 所以本文件判的是**分派**,不是文本:
 *   1. 走生产入口(`attachChatSubcommands` + `program.parseAsync`),不直接调模块;
 *   2. `readConversationHistory` / `resumeConversationHistory` 两个导出的 spy 必须被真的调用,
 *      参数就是命令行给的那份预算 ⇒ 把 chat-subcommands.ts 里那行调用摘掉,本文件立刻红
 *      (`firstRead()` 就是为这一格服务的:没人调用 ⇒ 点名抛错,不返回 undefined 让断言空转);
 *   3. spy 包的是**真实实现**,所以假传输会收到整条翻页链(newest → older×N / newer)
 *      ⇒ 证明走的是模块里的循环,而不是子命令里另写的一份;
 *   4. 打印的每一行必须逐字等于模块格式化出口的返回值 ⇒ 换成子命令自己拼字符串即红。
 *
 * 零网络 / 零 DB(§5 测试隔离铁律):`@ihui/api-client` 的 `getConversationHistory` 换成
 * 内存假服务端(复刻 limit 夹取 + limit+1 探边 + 归属先判三条护栏),并把 global fetch 钉成
 * "敢用就抛":会话列表那条腿也只打在自己的桩上,任何裸 fetch 都当场炸。
 *
 * ---------------------------------------------------------------------------
 * 前席死因(2026-10-21 定档,改动本文件前必读):
 * 上一版把生产入口写成**顶层静态 import**,并把 `encodeHistoryTurnCursor` 取自
 * `vi.mock('@ihui/api-client')` 工厂里的 `await import('@ihui/shared/chat')`。这两条合起来
 * 是 vitest **异步 mock 工厂里的模块环**:
 *   `@ihui/shared/chat`(index → render-model 运行时引回 `@ihui/api-client`)
 *     ⇢ 被 mock 的 `@ihui/api-client`(工厂在飞)
 *     ⇢ 工厂 `await import('@ihui/shared/chat')`(同一个还在飞的条目)
 * 两个 promise 互等 ⇒ 永不 resolve。因为静态 import 落在**测试文件自身求值**那一步,
 * vitest 一条用例都收不到,只留下 `[vitest-pool]: Worker forks emitted error` /
 * `Worker exited unexpectedly` + 整轮挂到超时(RC=124)——判据"安静地不跑",正是 §12f 那一型。
 *
 * 三条现测读数(2026-10-21,探针同批):
 *   ① 工厂不 await shared/chat、其余形状不变 ⇒ 1.06s 绿;
 *   ② 工厂 await shared/chat、但图里没有 chat-subcommands ⇒ 1.19s 绿(环需要两条腿才成立);
 *   ③ 工厂 await shared/chat + 图里有 chat-subcommands ⇒ 20s 测试超时(即本文件的死法)。
 * `--pool=threads --no-file-parallelism` 与默认 forks 两档同形 ⇒ **排除机器并发**,
 * 是用例自身缺陷,不是"安静窗重跑就好"。
 *
 * 因此本文件立两条纪律(不是风格偏好,是断掉那条环的器物):
 *   A. **mock 工厂里不得 `await import('@ihui/shared/chat')`** —— 要用 shared 的东西,
 *      推迟到假传输第一次被调用时再解析(那时整条静态图早已加载完)。
 *   B. **生产入口走带截止时间的惰性加载** —— 装配图一旦再挂死,失败信息点名到文件与原因,
 *      而不是把整个 worker 拖没人埋葬。惰性加载不改被调对象:拿到的仍是同一份被
 *      `vi.mock('../src/commands/history-read-ops.js')` 拦到的模块实例,判据强度不降。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Command } from 'commander'
import type { ApiResult } from '@ihui/types'
import type {
  ConversationHistoryResult,
  ConversationMessage,
  GetConversationHistoryParams,
} from '@ihui/api-client'
import type {
  HistoryReadOutcome,
  ReadConversationHistoryInput,
  ResumeConversationHistoryInput,
} from '../src/commands/history-read-ops.js'
// 模块形状一律用**被擦除的命名空间类型位**取(`typeof X`),不用 `typeof import('…')`:
// 后者被 `@typescript-eslint/consistent-type-imports` 判红(本仓 lint 是 error 档,blocking)。
// `import type * as` 不产生运行时依赖边 ⇒ 不会把文件头记的那条 mock 工厂环重新接上。
import type * as HistoryReadOpsNs from '../src/commands/history-read-ops.js'
import type * as ChatSubcommandsNs from '../src/commands/chat-subcommands.js'
import type * as ApiClientNs from '@ihui/api-client'

const CONV_ID = 'aaaaaaaa-1111-1111-1111-111111111111'
const FOREIGN_ID = 'bbbbbbbb-2222-2222-2222-222222222222'
const API_URL = 'http://127.0.0.1:1'
const TURN_COUNT = 12
/** 每轮 2 条正文, ordinal 补零到 2 位 ⇒ 单条正文恒 37 字节,账可以手算。 */
const CONTENT_BYTES = 30 + 'turn-'.length + 2

/** 纪律 B 的实现载体:两个被审模块的类型(仅类型位,不产生运行时依赖边)。 */
type HistoryReadOpsModule = typeof HistoryReadOpsNs
type ChatSubcommandsModule = typeof ChatSubcommandsNs

/**
 * 账本必须在 `vi.mock` 工厂里可见 ⇒ 用 `vi.hoisted`(工厂早于本文件体求值)。
 * 工厂里只放数据;spy 本体在工厂内用 `vi.fn` 现造后回挂,免得在 hoisted 段碰 `vi`。
 */
const harness = vi.hoisted(() => ({
  transportCalls: [] as Array<{
    id: string
    direction: string
    cursorOrdinal: number | null
    limit: number
  }>,
  readSpyCalls: [] as ReadConversationHistoryInput[],
  resumeSpyCalls: [] as ResumeConversationHistoryInput[],
  readResults: [] as HistoryReadOutcome[],
  resumeResults: [] as HistoryReadOutcome[],
  readSpy: null as null | ((input: ReadConversationHistoryInput) => Promise<HistoryReadOutcome>),
  resumeSpy: null as
    | null
    | ((input: ResumeConversationHistoryInput) => Promise<HistoryReadOutcome>),
}))

vi.mock('../src/commands/history-read-ops.js', async (importOriginal) => {
  const actual = await importOriginal<typeof HistoryReadOpsNs>()
  // 包一层 spy 但**仍跑真实实现**:摘掉接线 ⇒ spy 记 0 次 ⇒ 红;在子命令里另写一份投影
  // ⇒ spy 同样记 0 次 ⇒ 红(把 spy 换成假实现做不到这两条,所以不这么做)。
  harness.readSpy = vi.fn(async (input: ReadConversationHistoryInput) => {
    harness.readSpyCalls.push(input)
    const outcome = await actual.readConversationHistory(input)
    harness.readResults.push(outcome)
    return outcome
  })
  harness.resumeSpy = vi.fn(async (input: ResumeConversationHistoryInput) => {
    harness.resumeSpyCalls.push(input)
    const outcome = await actual.resumeConversationHistory(input)
    harness.resumeResults.push(outcome)
    return outcome
  })
  return {
    ...actual,
    readConversationHistory: harness.readSpy,
    resumeConversationHistory: harness.resumeSpy,
  }
})

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientNs>()

  // 纪律 A:工厂里**一个 `await import('@ihui/shared/chat')` 都不许有**(死因见文件头)。
  // shared 的游标编码器推迟到假传输首次被调用时解析,并只解析一次。
  let cursorEncoder: ((params: { turnOrdinal: number }) => string) | null = null
  async function sharedCursorEncoder(): Promise<(params: { turnOrdinal: number }) => string> {
    if (!cursorEncoder) {
      const shared = await import('@ihui/shared/chat')
      cursorEncoder = shared.encodeHistoryTurnCursor
    }
    return cursorEncoder
  }

  // 工厂**早于本文件体求值**(vi.mock 被提到 import 之前),所以工厂作用域里不许直接读
  // 顶部的 const(TDZ)。凡引用测试文件常量的地方,一律包进函数体,在调用时才解析。
  const ordinals = () => Array.from({ length: TURN_COUNT }, (_, i) => i + 1)
  /** 与写入侧同规则:最大轮未收口 ⇒ 断点取次大轮(12 轮 ⇒ 断点 = 10)。 */
  const breakpointOrdinal = () => TURN_COUNT - 2

  function turnMessages(ordinal: number): ConversationMessage[] {
    const tag = `turn-${String(ordinal).padStart(2, '0')}`
    return [0, 1].map((seq) => ({
      id: `t${ordinal}-${seq}`,
      conversationId: CONV_ID,
      role: seq === 0 ? 'user' : 'assistant',
      content: `${'x'.repeat(30)}${tag}`,
      tokens: null,
      metadata: null,
      createdAt: `2026-10-21T00:00:${String(ordinal).padStart(2, '0')}Z`,
    }))
  }

  function decodeCursor(raw: string | undefined): number | null {
    if (!raw) return null
    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
        turnOrdinal?: unknown
      }
      return typeof parsed.turnOrdinal === 'number' ? parsed.turnOrdinal : null
    } catch {
      return null
    }
  }

  function projectionState(): ConversationHistoryResult['projectionState'] {
    return {
      nextRolloutByteOffset: breakpointOrdinal() * 2 * CONTENT_BYTES,
      nextRolloutOrdinal: breakpointOrdinal(),
      lastRolledAt: '2026-10-21T00:00:00.000Z',
    }
  }

  async function fakeFetch(
    id: string,
    params: GetConversationHistoryParams = {},
  ): Promise<ApiResult<ConversationHistoryResult>> {
    const direction = params.direction ?? 'newest'
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? 20) || 1, 1), 100)
    const cursorOrdinal = decodeCursor(params.cursor)
    // 记账在归属判定**之前**:这张账量的是"消费体发出了几次请求",403 那次也在账上。
    harness.transportCalls.push({ id, direction, cursorOrdinal, limit })
    if (id !== CONV_ID) return { success: false, error: '无权访问该对话', status: 403 }

    const all = ordinals()
    let window: number[]
    let hasMore: boolean
    if (direction === 'newer') {
      const ahead = all.filter((o) => (cursorOrdinal === null ? true : o > cursorOrdinal))
      hasMore = ahead.length > limit
      window = ahead.slice(0, limit)
    } else {
      const behind =
        direction === 'older' && cursorOrdinal !== null
          ? all.filter((o) => o < cursorOrdinal)
          : all
      const desc = behind.slice(-limit - 1).reverse()
      hasMore = desc.length > limit
      window = desc.slice(0, limit).reverse()
    }
    const edge = direction === 'newer' ? window[window.length - 1] : window[0]
    let nextCursor: string | null = null
    if (hasMore && edge !== undefined) {
      nextCursor = (await sharedCursorEncoder())({ turnOrdinal: edge })
    }
    return {
      success: true,
      data: {
        turns: window.map((ordinal) => ({
          turnOrdinal: ordinal,
          messages: turnMessages(ordinal),
        })),
        limit,
        hasMore,
        nextCursor,
        projectionState: projectionState(),
        cursorState: { status: 'ok' },
      },
    }
  }

  return { ...actual, getConversationHistory: fakeFetch }
})

// ==================== 纪律 B:带截止时间的生产入口惰性加载 ====================

/**
 * 装配图冷加载的**挂死检测**预算 —— 它不是性能闸,只判"永不解算"。
 *
 * 两件事必须分清:
 *   · 它防的是 2026-10-21 那型**永久**死锁(mock 工厂里的模块环):那时文件一条用例都收不到,
 *     只留下 `Worker exited unexpectedly`。有这条截止时间,至少落一条点名到原因的失败。
 *   · 它**不判**"加载有多快"。实测(2026-10-26)同一文件冷加载:空载 3.4s;24 个 CPU burner
 *     把 20 核打满后 transform 10.65s(3.1×);主席那次 turbo 全量(8 包并发,同批日志里连
 *     `--help` 这种子进程都要 5–17s)直接越过旧值 10s ⇒ 10 例一起红,而根因只有一条:
 *     **旧值把"慢"读成了"挂死"(§12f 失效方向:判据自己假报),再被下面的粘性错误
 *     放大成 9 条 1ms 的连带失败**(判据在真跑它的那一刻不成立)。
 * 因此定值的判据是"远大于任何可解释的慢加载 ∧ 严格小于用例自身超时":
 *   120_000 = 空载实测的 35×、饱和负载实测的 11×;`WIRING_TIMEOUT_MS` 再垫 30s
 *   ⇒ 真挂死时先落本文件的点名失败,而不是 vitest 那句无信息的 "Test timed out"。
 * 收紧这个数值不会加强判据,只会把负载噪声重新变回红(§12e);本文件末尾有回归锁。
 */
const ENTRY_DEADLINE_MS = 120_000
/** 用例自身超时:必须 > `ENTRY_DEADLINE_MS`(否则先落 vitest 那句无信息的超时,判据绕开本文件)。 */
const WIRING_TIMEOUT_MS = ENTRY_DEADLINE_MS + 30_000

const DEADLOCK_HINT =
  `装配图在 ${ENTRY_DEADLINE_MS}ms 内没有 resolve:本文件加载的是 ` +
  'src/commands/chat-subcommands.js + src/commands/history-read-ops.js。' +
  '真死锁永不 resolve(重跑无用),而单纯慢加载会在这条线之前完成 —— 先看两个 mock 工厂里的 ' +
  'import:2026-10-21 那型环(实测 @ihui/shared/chat → render-model → @ihui/api-client → ' +
  '工厂 → shared/chat)是这条路径上唯一被测出过的死因。'

let loadedGraph: { ops: HistoryReadOpsModule; chat: ChatSubcommandsModule } | null = null
/** 粘性失败:一次挂死就足够定性,其余用例立刻复用同一条信息,不再各烧一整份截止时间(× retry 更久)。 */
let graphLoadError: Error | null = null

/** 给一次模块加载套上截止时间;计时器必清(不留句柄 ⇒ 不会把下一轮用例拖成假挂死)。 */
function withDeadline<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(DEADLOCK_HINT)), ENTRY_DEADLINE_MS)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * 两个被审模块**先后**取,不用 `Promise.all`:实测(2026-10-21)`Promise.all` 里两条
 * 动态 import 并发起跑时,`vi.mock('../src/commands/history-read-ops.js')` 的替身只发给了
 * 本文件自己,`chat-subcommands.js` 拿到的是**未包 spy 的原实现** ⇒ spy 恒 0 次、
 * 装车锁判不出装车。串行取模块(先替身、后生产入口)与顶层静态 import 同形,spying 正常。
 */
async function loadGraph(): Promise<{ ops: HistoryReadOpsModule; chat: ChatSubcommandsModule }> {
  if (loadedGraph) return loadedGraph
  if (graphLoadError) throw graphLoadError
  try {
    const opsMod = await withDeadline(import('../src/commands/history-read-ops.js'))
    const chatMod = await withDeadline(import('../src/commands/chat-subcommands.js'))
    loadedGraph = { ops: opsMod, chat: chatMod }
    return loadedGraph
  } catch (err) {
    graphLoadError = err instanceof Error ? err : new Error(String(err))
    throw graphLoadError
  }
}

/** 模块格式化出口(与子命令用的是同一份实例);纪律 B 之后仍是被审对象本体。 */
async function ops(): Promise<HistoryReadOpsModule> {
  return (await loadGraph()).ops
}

/**
 * 生产入口:照 index.ts 的形状建根 program(--api-url / --api-key 是全局旗标),
 * 再 `attachChatSubcommands` —— 这一步就是"装车"本身,不是对本文件的复述。
 */
async function runCli(argv: readonly string[]): Promise<void> {
  const { chat } = await loadGraph()
  const program = new Command('ihui')
  program.option('--api-url <url>', 'API base URL').option('--api-key <key>', 'API key')
  const chatCmd = program.command('chat').description('chat')
  chat.attachChatSubcommands(chatCmd)
  await program.parseAsync(['node', 'ihui', ...argv])
}

let logs: string[] = []
let errs: string[] = []
/** 形状跟着 Node 走(它是 `string | number | undefined` 的并集),不自扩成 `number` 了事后再报 TS2322。 */
let savedExitCode: typeof process.exitCode

function textOf(): string {
  return [...logs, ...errs].join('\n')
}

/** 反证的落点:模块没被调用 ⇒ 点名抛错,绝不让后面的断言在 undefined 上空转成绿。 */
function firstRead(): HistoryReadOutcome {
  const outcome = harness.readResults[0]
  if (!outcome) throw new Error('readConversationHistory 没有被调用 —— chat history 的接线被摘掉了')
  return outcome
}

function firstResume(): HistoryReadOutcome {
  const outcome = harness.resumeResults[0]
  if (!outcome) {
    throw new Error('resumeConversationHistory 没有被调用 —— --replay-check 的接线被摘掉了')
  }
  return outcome
}

beforeEach(() => {
  savedExitCode = process.exitCode
  process.exitCode = 0
  logs = []
  errs = []
  harness.transportCalls.length = 0
  harness.readSpyCalls.length = 0
  harness.resumeSpyCalls.length = 0
  harness.readResults.length = 0
  harness.resumeResults.length = 0
  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  })
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errs.push(args.map(String).join(' '))
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('network access is forbidden in this wiring test')
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  process.exitCode = savedExitCode
})

describe('装车锁:子命令分派真调用到 history-read-ops 的导出', () => {
  it(
    'chat history <id> --turns-per-page 5 ⇒ 模块被调用一次,预算原样传下去',
    async () => {
      await runCli([
        '--api-url',
        API_URL,
        '--api-key',
        'k',
        'chat',
        'history',
        CONV_ID,
        '--turns-per-page',
        '5',
      ])

      expect(harness.readSpy).not.toBeNull()
      expect(harness.readSpyCalls).toEqual([{ conversationId: CONV_ID, turnsPerPage: 5 }])
      expect(harness.resumeSpyCalls).toEqual([])
      expect(process.exitCode).toBe(0)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '默认档预算交模块自己拍(子命令不替它编默认值),翻页链由模块循环发出',
    async () => {
      await runCli(['--api-url', API_URL, '--api-key', 'k', 'chat', 'history', CONV_ID])

      expect(harness.readSpyCalls).toEqual([{ conversationId: CONV_ID }])
      // 默认档 = 服务端上限 100 轮/页 ⇒ 12 轮一页到底,只发一次
      expect(harness.transportCalls).toEqual([
        { id: CONV_ID, direction: 'newest', cursorOrdinal: null, limit: 100 },
      ])
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '5 轮/页 ⇒ newest 起手、其后一律 older + 服务端游标(没有第二份循环)',
    async () => {
      await runCli([
        '--api-url',
        API_URL,
        '--api-key',
        'k',
        'chat',
        'history',
        CONV_ID,
        '--turns-per-page',
        '5',
      ])

      expect(harness.transportCalls.length).toBe(3)
      expect(harness.transportCalls.map((c) => c.direction)).toEqual(['newest', 'older', 'older'])
      expect(harness.transportCalls.slice(1).every((c) => c.cursorOrdinal !== null)).toBe(true)
      expect(harness.transportCalls.every((c) => c.limit === 5 && c.id === CONV_ID)).toBe(true)
      // 首屏只收 5 轮,不是一次倒给 12 轮
      expect(harness.transportCalls[0]).toEqual({
        id: CONV_ID,
        direction: 'newest',
        cursorOrdinal: null,
        limit: 5,
      })
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '时间线是整条区间:12 轮连贯、逐轮唯一,汇总行判 span=1..12',
    async () => {
      await runCli([
        '--api-url',
        API_URL,
        '--api-key',
        'k',
        'chat',
        'history',
        CONV_ID,
        '--turns-per-page',
        '5',
      ])

      const outcome = firstRead()
      expect(outcome.projection.turns.map((t) => t.turnOrdinal)).toEqual(
        Array.from({ length: TURN_COUNT }, (_, i) => i + 1),
      )
      expect(outcome.stop).toBe('exhausted')
      expect(textOf()).toContain('span=1..12')
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '打印的每一行逐字来自模块的格式化出口(子命令自己拼字符串即红)',
    async () => {
      await runCli([
        '--api-url',
        API_URL,
        '--api-key',
        'k',
        'chat',
        'history',
        CONV_ID,
        '--turns-per-page',
        '5',
      ])

      const {
        formatHistoryPageLine,
        formatHistorySummaryLine,
        formatHistoryTallyLine,
      } = await ops()
      const outcome = firstRead()
      for (let i = 0; i < outcome.perPage.length; i += 1) {
        const page = outcome.perPage[i]
        if (page) expect(textOf()).toContain(formatHistoryPageLine(i, page))
      }
      expect(textOf()).toContain(formatHistoryTallyLine('initial', outcome.tally))
      expect(textOf()).toContain(formatHistorySummaryLine(outcome))
      // 计量行的数字必须是真量出来的:12 轮 × 每轮 2 条 × 定长 37 字节正文
      expect(outcome.tally.requests).toBe(3)
      expect(outcome.tally.receivedTurns).toBe(TURN_COUNT)
      expect(outcome.tally.receivedMessages).toBe(TURN_COUNT * 2)
      expect(outcome.tally.receivedBytes).toBe(TURN_COUNT * 2 * CONTENT_BYTES)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '--json:载荷带投影与 resumeCursor,游标取自模块唯一出口(命令侧不得自己拼 base64url)',
    async () => {
      await runCli(['--api-url', API_URL, '--api-key', 'k', 'chat', 'history', CONV_ID, '--json'])

      const { historyResumeCursor } = await ops()
      const outcome = firstRead()
      const raw = logs.find((l) => l.trimStart().startsWith('{'))
      expect(raw).toBeDefined()
      const payload = JSON.parse(raw as string) as {
        conversationId: string
        initial: {
          turns: unknown[]
          resumeCursor: string | null
          boundary: { oldestTurnOrdinal: number | null }
          tally: { requests: number }
        }
      }
      expect(payload.conversationId).toBe(CONV_ID)
      expect(payload.initial.turns.length).toBe(TURN_COUNT)
      expect(payload.initial.resumeCursor).toBe(historyResumeCursor(outcome.projectionState))
      expect(payload.initial.boundary.oldestTurnOrdinal).toBe(1)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '--replay-check:续读也被真调用,previous 就是刚拿到的那一份,并打印对账行',
    async () => {
      await runCli([
        '--api-url',
        API_URL,
        '--api-key',
        'k',
        'chat',
        'history',
        CONV_ID,
        '--turns-per-page',
        '5',
        '--replay-check',
      ])

      const { formatHistoryReplayCheckLine } = await ops()
      expect(harness.resumeSpyCalls.length).toBe(1)
      const resumeInput = harness.resumeSpyCalls[0]
      expect(resumeInput?.conversationId).toBe(CONV_ID)
      expect(resumeInput?.previous).toBe(firstRead())

      const afterFullRead = 3
      expect(harness.transportCalls.slice(afterFullRead).map((c) => c.direction)).toEqual([
        'newer',
      ])
      // 续读起点 = 服务端 rollout 断点(次大轮 12-2=10),由模块经 resolveHistoryRolloutSeed 推
      expect(harness.transportCalls[afterFullRead]?.cursorOrdinal).toBe(TURN_COUNT - 2)

      const resumed = firstResume()
      // 续读新收断点之后的 2 轮(11、12);这两轮首屏已有 ⇒ 整轮替换后时间线仍是 12 轮(重放幂等)
      expect(resumed.tally.receivedTurns).toBe(2)
      expect(resumed.projection.turns.length).toBe(TURN_COUNT)
      expect(resumed.projection.replacedTurns).toBe(2)
      // 对账行的分母是**首屏那批请求的收流量**(tally,不是整个 outcome)。前稿在这里把
      // HistoryReadOutcome 当 HistoryTally 传进格式化出口 ⇒ 期望串自己算成
      // `fullRefetchBytes=undefined saved=0%`,而生产码打的是真值 888/83.3% —— 该格判红
      // 的从来不是接线,是这条拼错了的期望。vitest 用 esbuild 转译**不做类型检查**,
      // 所以这处形参类型错要等 `tsc -p tsconfig.tests.json` 才现形(见交付报告)。
      expect(textOf()).toContain(formatHistoryReplayCheckLine(resumed.tally, firstRead().tally).line)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '别人的会话 ⇒ 只发一次请求就停,ok=false 且 exitCode 1(不许继续翻页撞墙)',
    async () => {
      await runCli(['--api-url', API_URL, '--api-key', 'k', 'chat', 'history', FOREIGN_ID])

      const outcome = firstRead()
      expect(harness.transportCalls.length).toBe(1)
      expect(outcome.ok).toBe(false)
      expect(outcome.stop).toBe('denied')
      expect(outcome.status).toBe(403)
      expect(textOf()).toContain('ok=false stop=denied')
      expect(process.exitCode).toBe(1)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '非法旗标值 ⇒ 报错走 handleError,一个请求都不发',
    async () => {
      await runCli([
        '--api-url',
        API_URL,
        '--api-key',
        'k',
        'chat',
        'history',
        CONV_ID,
        '--turns-per-page',
        '0',
      ])

      expect(harness.readSpyCalls).toEqual([])
      expect(harness.transportCalls).toEqual([])
      expect(textOf()).toContain('--turns-per-page must be a positive integer')
      expect(process.exitCode).toBe(1)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '未给 id ⇒ 仍是会话列表,--page 语义不变,零调用 history-read-ops',
    async () => {
      // 桩必须**声明它接得住什么**:`vi.fn(async () => …)` 推出来的 calls 是 `[]`,
      // 下面 `calls[0]` 取实参就成了 TS2493('[]' 没有 0 位)—— 而那一条正是本用例唯一
      // 判"会话列表这条腿打到哪个 URL"的断言。参数用 `_` 前缀(不去用它,只登记它)。
      const fetchStub = vi.fn(async (_url: string | URL, _init?: unknown) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () =>
          JSON.stringify({
            code: 0,
            message: 'ok',
            data: {
              conversations: [{ id: CONV_ID, title: 't', model: 'm', lastMessageAt: null }],
              page: 3,
              pageSize: 20,
              total: 41,
            },
          }),
      }))
      vi.stubGlobal('fetch', fetchStub as unknown as typeof fetch)

      await runCli(['--api-url', API_URL, '--api-key', 'k', 'chat', 'history', '--page', '3'])

      const call = fetchStub.mock.calls[0]
      expect(call).toBeDefined()
      expect(String(call?.[0])).toContain('/api/chat/conversations?page=3&pageSize=20')
      expect(harness.readSpyCalls).toEqual([])
      expect(harness.transportCalls).toEqual([])
      expect(textOf()).toContain(CONV_ID.slice(0, 8))
      expect(process.exitCode).toBe(0)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '补充锁(不是本文件的主判据):子命令面不得出现第二份投影算术',
    async () => {
      const { readFileSync } = await import('node:fs')
      const here = new URL('.', import.meta.url)
      const src = readFileSync(new URL('../src/commands/chat-subcommands.ts', here), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
      // 算术只有两个合法住处:@ihui/shared/chat(判据)与 history-read-ops(CLI 消费体)。
      expect(code).not.toMatch(/from '@ihui\/shared\/chat'/)
      for (const forbidden of [
        /mergeHistoryTurnPages\s*\(/,
        /deriveHistoryBoundary\s*\(/,
        /projectHistoryPage\s*\(/,
        /foldHistoryPageIntoProjection\s*\(/,
        /clampHistoryLimit\s*\(/,
      ]) {
        expect(forbidden.test(code)).toBe(false)
      }
      // 而挂载点必须在**去注释后的代码面**上真实存在(注释式引用不算装车)
      expect(code).toMatch(/readConversationHistory\s*\(\s*\{/)
      expect(code).toMatch(/resumeConversationHistory\s*\(\s*\{/)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '死因回归锁:shared/chat 只许在惰性编码器里解析,不得由 mock 工厂直接 await',
    async () => {
      const { readFileSync } = await import('node:fs')
      const here = new URL('.', import.meta.url)
      const src = readFileSync(new URL('./chat-history-read-ops-wiring.test.ts', here), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
      const sharedImport = /import\(\s*'@ihui\/shared\/chat'\s*\)/g
      const hits = [...code.matchAll(sharedImport)]
      // 枚举到 0 判死(§0.3):没有这一处解析 ⇒ 假服务端拼不出游标,上面所有用例都会在空转上冒绿。
      expect(hits.length).toBeGreaterThanOrEqual(1)

      const encoderAt = code.search(/async function sharedCursorEncoder\s*\(/)
      expect(encoderAt).toBeGreaterThan(-1)
      // 死锁位 = 工厂**顶层**直接 await shared/chat。它必然排在编码器定义**之前**
      // (工厂先于编码器函数出现);凡解析都排在编码器之后 ⇒ 都被惰性函数包着,环不成立。
      for (const hit of hits) {
        expect(hit.index ?? -1).toBeGreaterThan(encoderAt)
      }
      // 同一个形状对自己也得成立:工厂里不许直接 await 回指本就被 mock 的那个包。
      expect(code).not.toMatch(/async \(importOriginal\)[\s\S]{0,400}?await import\(\s*'@ihui\/api-client'\s*\)/)

      // 反向锁:两个 spy 包的仍是**真实现**。摘掉这条 ⇒ "装车锁"退化成"调用了个假东西"。
      expect(code).toMatch(/actual\.readConversationHistory\(/)
      expect(code).toMatch(/actual\.resumeConversationHistory\(/)
    },
    WIRING_TIMEOUT_MS,
  )

  it(
    '预算回归锁:挂死检测的截止时间不得退回负载噪声档,且用例超时必须比它长',
    async () => {
      const { readFileSync } = await import('node:fs')
      const here = new URL('.', import.meta.url)
      const src = readFileSync(new URL('./chat-history-read-ops-wiring.test.ts', here), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')

      // ① 地板:实测饱和负载下冷加载已用掉 10.65s(turbo 8 包并发更慢),60s 是"远大于慢加载"。
      //    退回 10_000 那档 ⇒ 本用例红,原缺陷(把慢读成挂死、再放大成 10 例)立刻回来。
      const deadline = Number(
        /const ENTRY_DEADLINE_MS = ([\d_]+)/.exec(code)?.[1]?.replace(/_/g, '') ?? Number.NaN,
      )
      expect(Number.isFinite(deadline)).toBe(true)
      expect(deadline).toBeGreaterThanOrEqual(60_000)

      // ② 用例超时必须以截止时间为基数再加垫,不许写死绝对值:写死的绝对值和截止时间各自被
      //    改一次就会翻成"超时 < 截止时间" ⇒ 真挂死时先落 vitest 那句无信息的超时,判据绕开本文件。
      const addend = Number(
        /const WIRING_TIMEOUT_MS = ENTRY_DEADLINE_MS \+ ([\d_]+)/.exec(code)?.[1]?.replace(/_/g, '') ??
          Number.NaN,
      )
      expect(Number.isFinite(addend)).toBe(true)
      // 垫至少 10s:保证"点名到原因的失败"永远先于 vitest 的泛化超时落地。
      expect(addend).toBeGreaterThanOrEqual(10_000)

      // ③ 每个用例都吃同一档超时(枚举到 0 判死,§0.3):裸数字一律不许再出现 ——
      //    本文件这次红的直接成因就是一个写死的 30_000 坐着等加载,比加载成本还小。
      const cases = [...code.matchAll(/\bit\(/g)].length
      const budgeted = [...code.matchAll(/\bWIRING_TIMEOUT_MS,/g)].length
      expect(cases).toBeGreaterThan(0)
      expect(budgeted).toBe(cases)
    },
    WIRING_TIMEOUT_MS,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
