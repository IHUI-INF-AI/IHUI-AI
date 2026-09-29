// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * D152(2026-09-29 立)小程序端消费 `goal_updated` 的装车证明。
 *
 * 两条腿,各证一件事:
 *  A. **运行时派发**:喂**真帧字节序列**(一行完整 `data:` —— 本仓踩过把 JSON 拆两行导致
 *     假红的夹具坑,所以这里的夹具逐帧一行、行间空行分隔),经**真实共享 parseSSEChunk**
 *     解出后走真实 `chatStream` dispatch ⇒ onGoalUpdate 真被调用;同一条帧**不得**混进正文
 *     delta(那是"没认领 ⇒ 滑到泛化兜底"的表现形态);未知档那一条**不崩也不回调**
 *     (解析层丢弃,端内不猜)。
 *  B. **取词层对着真语包**:六档 × 五语言的 `chat.goal.status.*` 必须逐格取到非空文案,
 *     且取不到时 goal-line 返回空串(界面宁可不上屏,也不把裸键名摆给用户)。
 *
 * 本端**不给输入口、不给操作按钮**(票面只要求"看得见状态";手机上没有 /goal 的发起面,
 * "看得见却改不了"是假 affordance,与本端 onTerminalInteraction 拒绝代答同一口径)。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { parseSSEChunk } from '@ihui/shared/utils/sse-parse'

const { mockStreamSSE } = vi.hoisted(() => ({ mockStreamSSE: vi.fn() }))

vi.mock('@/lib/sse', () => ({ streamSSE: mockStreamSSE }))
// resolveAgentTools 与本判据无关(ui-control 预筛),桩掉以免拉进无关模块图
vi.mock('@/lib/ui-control-tools', () => ({
  resolveAgentTools: (tools: unknown) => tools,
}))
// api-bridge 在模块作用域 import Taro/i18n(node 环境下无真实实现),按仓内既有测试口径最小桩
vi.mock('@tarojs/taro', () => ({
  default: {
    getEnv: () => 'WEB',
    ENV_TYPE: { WEB: 'WEB' },
    request: vi.fn(),
    getStorageSync: () => '',
    setStorageSync: () => undefined,
  },
  getEnv: () => 'WEB',
  ENV_TYPE: { WEB: 'WEB' },
  request: vi.fn(),
  getStorageSync: () => '',
  setStorageSync: () => undefined,
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { chatStream, type StreamEventCallbacks } from '../index'
import { GOAL_STATUS_KEY_PREFIX, describeGoalNotice, goalStatusText } from '@/pkg-ai/ai/cards/goal-line'
import { GOAL_STATUSES } from '@ihui/types'

/** 正文帧 + goal_updated 帧(服务端 payload 形态,逐帧一行 data:)混流 */
const FRAMES =
  'data: {"type":"chunk","content":"正文开始"}\n\n' +
  'data: {"type":"goal_updated","sessionId":"s-9","status":"usageLimited",' +
  '"objective":"把发布链路做完","elapsedMs":61000,"updatedAt":1700000000}\n\n' +
  'data: {"type":"chunk","content":"正文结束"}\n\n'

/** 未知档:解析层必须**丢弃**该帧,既不上抛也不污染正文 */
const FRAMES_WITH_UNKNOWN = FRAMES + 'data: {"type":"goal_updated","sessionId":"s-9","status":"nope"}\n\n'

function armTransport(raw: string) {
  mockStreamSSE.mockImplementation(async (opts: { onEvent: (evt: unknown) => void }) => {
    const { events } = parseSSEChunk(raw)
    for (const evt of events) opts.onEvent(evt)
  })
}

type ChatStreamArgs = Parameters<typeof chatStream>

async function runStream(callbacks: StreamEventCallbacks, onChunk: (d: string) => void) {
  await (chatStream as unknown as (...args: unknown[]) => Promise<void>)(
    [] as ChatStreamArgs[0],
    'sess-1',
    {} as ChatStreamArgs[2],
    onChunk,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    callbacks,
  )
}

describe('D152 A. 小程序 chatStream 运行时派发(goal_updated)', () => {
  beforeEach(() => {
    mockStreamSSE.mockReset()
  })

  it('阳性:真帧经 parse→dispatch 后 onGoalUpdate 被调用,载荷含 status/objective/elapsedMs', async () => {
    armTransport(FRAMES)
    const onGoalUpdate = vi.fn()
    await runStream({ onGoalUpdate }, vi.fn())
    expect(onGoalUpdate).toHaveBeenCalledTimes(1)
    expect(onGoalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 's-9',
        status: 'usageLimited',
        objective: '把发布链路做完',
        elapsedMs: 61_000,
      }),
    )
  })

  it('反向对照:goal_updated 帧不得混进正文 delta(onChunk 只见正文帧)', async () => {
    armTransport(FRAMES)
    const onChunk = vi.fn()
    await runStream({ onGoalUpdate: vi.fn() }, onChunk)
    const body = onChunk.mock.calls.map((c) => String(c[0])).join('')
    expect(body).toBe('正文开始正文结束')
    expect(body).not.toContain('usageLimited')
    expect(body).not.toContain('把发布链路做完')
  })

  it('未知档:整帧被解析层丢弃 ⇒ 不回调、不崩、不污染正文', async () => {
    armTransport(FRAMES_WITH_UNKNOWN)
    const onGoalUpdate = vi.fn()
    const onChunk = vi.fn()
    await expect(runStream({ onGoalUpdate }, onChunk)).resolves.toBeUndefined()
    expect(onGoalUpdate).toHaveBeenCalledTimes(1) // 只有那一帧 usageLimited;nope 那帧不算
    expect(onGoalUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'nope' }))
    expect(onChunk.mock.calls.map((c) => String(c[0])).join('')).toBe('正文开始正文结束')
  })

  it('未注册 onGoalUpdate 时不炸流(dispatch 侧 callbacks?. 兜住)', async () => {
    armTransport(FRAMES)
    const onChunk = vi.fn()
    await expect(runStream({}, onChunk)).resolves.toBeUndefined()
    expect(onChunk.mock.calls.map((c) => String(c[0])).join('')).toBe('正文开始正文结束')
  })
})

/** 与 apps/miniapp-taro/src/i18n/index.tsx 同一口径:shared 作 base(本用例只需 shared 那一层) */
function readShared(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL(`../../../../../packages/i18n/messages/shared/${locale}.json`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>
}

function pick(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

describe('D152 B. 取词层对着真语包(六档 × 五语言)', () => {
  const locales = ['zh-CN', 'zh-TW', 'ko', 'ja', 'en'] as const

  it('六档在五语言里逐格非空 —— 少一格,小程序界面就会念出裸键名(本票实测的失效形态)', () => {
    for (const locale of locales) {
      const pack = readShared(locale)
      for (const status of GOAL_STATUSES) {
        const value = pick(pack, `${GOAL_STATUS_KEY_PREFIX}${status}`)
        expect(typeof value === 'string' && value !== '', `${locale}/${status}`).toBe(true)
      }
    }
  })

  it('goalStatusText 用真词包取到「额度受限」/「预算受限」', () => {
    const pack = readShared('zh-CN')
    const t = (key: string) => {
      const v = pick(pack, key)
      return typeof v === 'string' ? v : key
    }
    expect(goalStatusText('usageLimited', t)).toBe('额度受限')
    expect(goalStatusText('budgetLimited', t)).toBe('预算受限')
  })

  it('缺键 ⇒ 空串(宁可不上屏,也不把 chat.goal.status.xxx 摆进界面)', () => {
    const t = (key: string) => key // 模拟语包没这条:t() 原样回显键名
    expect(goalStatusText('usageLimited', t)).toBe('')
    expect(describeGoalNotice({ sessionId: 's', status: 'usageLimited' }, t)).toBeNull()
  })

  it('cleared ⇒ describeGoalNotice 返回 null(单帧承载清除,胶囊整体消失)', () => {
    const pack = readShared('zh-CN')
    const t = (key: string) => {
      const v = pick(pack, key)
      return typeof v === 'string' ? v : key
    }
    expect(describeGoalNotice({ sessionId: 's', status: 'cleared' }, t)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
