// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60「真并行多窗格」服务端分叉余格的离线回归(不连库):
//   ① linearizeForkHistory —— 与票59/64 的 sibling 版本族同口径地裁出单一线性历史;
//   ② branchConversationFrom —— 幂等重放零新行、越权零写、族标记不随行、计数回库确认。
// db 链以可控队列 mock,tx 直接执行回调;"零写"一律以 insert/update 调用计数取证,
// 不用"没抛错"冒充"没发生"。
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    COZE_API_KEY: '',
  },
}))

const { state } = vi.hoisted(() => ({
  state: {
    selectQueues: [] as unknown[][],
    insertQueues: [] as unknown[][],
    updateQueues: [] as unknown[][],
    insertArgs: [] as unknown[],
    updateArgs: [] as unknown[],
    insertCalls: 0,
    updateCalls: 0,
  },
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (resolveRows: () => unknown[]) => {
    const chain: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'innerJoin',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
      'for',
    ]) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolveRows()).then(resolve, reject)
    return chain
  }
  const tx = {
    select: vi.fn(() => makeChain(() => state.selectQueues.shift() ?? [])),
    insert: vi.fn(() => {
      state.insertCalls += 1
      const chain = makeChain(() => state.insertQueues.shift() ?? [])
      const values = vi.fn((args: unknown) => {
        state.insertArgs.push(args)
        return chain
      })
      chain.values = values
      return chain
    }),
    update: vi.fn(() => {
      state.updateCalls += 1
      const chain = makeChain(() => state.updateQueues.shift() ?? [])
      const set = vi.fn((args: unknown) => {
        state.updateArgs.push(args)
        return chain
      })
      chain.set = set
      return chain
    }),
    delete: vi.fn(() => makeChain(() => [])),
  }
  return {
    db: {
      select: vi.fn(() => makeChain(() => [])),
      insert: vi.fn(() => makeChain(() => [])),
      update: vi.fn(() => makeChain(() => [])),
      delete: vi.fn(() => makeChain(() => [])),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
    dbRead: { select: vi.fn(() => makeChain(() => [])) },
  }
})

import {
  branchConversationFrom,
  linearizeForkHistory,
  ForkIdempotencyConflictError,
  ForkSourceRejectedError,
} from '../src/db/chat-queries.js'

const CONV_ID = '11111111-1111-4111-8111-111111111111'
const NEW_CONV_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = 'user-1'
const CRID = '44444444-4444-4444-8444-444444444444'

interface ForkRow {
  id: string
  parentMessageId: string | null
  siblingIndex: number | null
}

function row(id: string, parentMessageId: string | null, siblingIndex: number | null): ForkRow {
  return { id, parentMessageId, siblingIndex }
}

function sourceConversation(owner = USER_ID) {
  return {
    id: CONV_ID,
    userId: owner,
    title: '源会话',
    model: 'auto',
    systemPrompt: null,
    metadata: { tag: 'keep-me' },
    lastMessageAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  }
}

function messageRow(input: {
  id: string
  createdAt: Date
  parentMessageId?: string | null
  siblingIndex?: number | null
  role?: string
  content?: string
  turnOrdinal?: number | null
}) {
  return {
    id: input.id,
    conversationId: CONV_ID,
    role: input.role ?? 'assistant',
    content: input.content ?? `content-${input.id}`,
    reasoning: null,
    tokens: null,
    metadata: null,
    createdAt: input.createdAt,
    turnOrdinal: input.turnOrdinal ?? 1,
    parentMessageId: input.parentMessageId ?? null,
    siblingIndex: input.siblingIndex ?? null,
    pinnedAt: null,
    bookmarkedAt: null,
  }
}

beforeEach(() => {
  state.selectQueues.length = 0
  state.insertQueues.length = 0
  state.updateQueues.length = 0
  state.insertArgs.length = 0
  state.updateArgs.length = 0
  state.insertCalls = 0
  state.updateCalls = 0
})

describe('linearizeForkHistory:版本族裁成单一线性历史(票59 sibling 语义)', () => {
  it('无族消息逐行原样保留,顺序不变', () => {
    const rows = [row('a', null, null), row('b', null, null), row('c', null, null)]
    expect(linearizeForkHistory(rows, 'c').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('分叉点是最新版本 ⇒ 族只留该版,同族其它版本不随行', () => {
    // root 是族根(siblingIndex=0),v1/v2 是它的两个再生版本
    const rows = [row('root', null, 0), row('v1', 'root', 1), row('v2', 'root', 2)]
    expect(linearizeForkHistory(rows, 'v2').map((r) => r.id)).toEqual(['v2'])
  })

  it('分叉点是旧版本 ⇒ 用户点哪版分哪版(不被后来的版本顶替)', () => {
    // 模拟 createdAt 过滤后只剩 root + v1(v2 比 v1 晚,不在入参里)
    const rows = [row('root', null, 0), row('v1', 'root', 1)]
    expect(linearizeForkHistory(rows, 'v1').map((r) => r.id)).toEqual(['v1'])
  })

  it('分叉点在族之后 ⇒ 该族保留最新版本,族根位置不变', () => {
    const rows = [
      row('u1', null, null),
      row('root', null, 0),
      row('v1', 'root', 1),
      row('v2', 'root', 2),
      row('u2', null, null),
    ]
    expect(linearizeForkHistory(rows, 'u2').map((r) => r.id)).toEqual(['u1', 'v2', 'u2'])
  })

  it('纯函数:不改写入参(源会话的历史不被"顺手"改动)', () => {
    const rows = [row('root', null, 0), row('v1', 'root', 1)]
    const snapshot = JSON.stringify(rows)
    linearizeForkHistory(rows, 'v1')
    expect(JSON.stringify(rows)).toBe(snapshot)
  })
})

describe('branchConversationFrom:幂等 / 归属 / 族复制 / 计数诚实', () => {
  it('正常分叉:复制线性历史、族标记不随行、条数来自回库确认', async () => {
    const root = messageRow({
      id: '33330000-0000-4000-8000-000000000001',
      createdAt: new Date('2026-10-01T00:00:01Z'),
      role: 'user',
      turnOrdinal: 1,
      siblingIndex: 0, // 族根:首次 regenerate 时被补 0(票59 语义)
    })
    const v1 = messageRow({
      id: '33330000-0000-4000-8000-000000000002',
      createdAt: new Date('2026-10-01T00:00:02Z'),
      parentMessageId: root.id,
      siblingIndex: 1,
      turnOrdinal: 1,
    })
    const v2 = messageRow({
      id: '33330000-0000-4000-8000-000000000003',
      createdAt: new Date('2026-10-01T00:00:03Z'),
      parentMessageId: root.id,
      siblingIndex: 2,
      turnOrdinal: 1,
    })

    state.selectQueues.push([sourceConversation()]) // 锁源会话
    state.selectQueues.push([v2]) // 事务内读分叉点
    state.selectQueues.push([root, v1, v2]) // 分叉点及之前的行
    state.insertQueues.push([{ ...sourceConversation(), id: NEW_CONV_ID }]) // 新会话
    state.insertQueues.push([{ id: 'x1' }]) // 复制消息回库确认 1 行(族只剩 v2)
    state.updateQueues.push([{ ...sourceConversation(), id: NEW_CONV_ID }])

    const result = await branchConversationFrom(CONV_ID, v2.id, { userId: USER_ID })

    expect(result.replayed).toBe(false)
    expect(result.conversation.id).toBe(NEW_CONV_ID)
    expect(result.copiedMessageCount).toBe(1) // root/v1 被 v2 顶替 ⇒ 只复制 1 条
    expect(result.sourceRootId).toBe(root.id)
    expect(result.sourceSiblingIndex).toBe(2)

    // 复制行不带族标记(新会话是线性历史,版本树留在源会话)
    const copiedValues = state.insertArgs[1] as Array<Record<string, unknown>>
    expect(copiedValues).toHaveLength(1)
    for (const v of copiedValues) {
      expect(v).not.toHaveProperty('parentMessageId')
      expect(v).not.toHaveProperty('siblingIndex')
    }
    // forkedFromMessageCount 写的是回库确认值
    const updatePayload = state.updateArgs[0] as { metadata: Record<string, unknown> }
    expect(updatePayload.metadata.forkedFromMessageCount).toBe(1)
  })

  it('幂等重放:同一 clientRequestId 二次提交返回首建会话,零新行', async () => {
    const target = messageRow({
      id: '33330000-0000-4000-8000-000000000009',
      createdAt: new Date('2026-10-01T00:00:01Z'),
    })
    const firstConv = {
      ...sourceConversation(),
      id: NEW_CONV_ID,
      metadata: {
        originalConversationId: CONV_ID,
        forkedFromMessageId: target.id,
        forkedFromMessageCount: 1,
        forkClientRequestId: CRID,
      },
    }

    // 第一次:无幂等命中 ⇒ 新建
    state.selectQueues.push([sourceConversation()])
    state.selectQueues.push([target])
    state.selectQueues.push([]) // 幂等查询:未命中
    state.selectQueues.push([target]) // 历史
    state.insertQueues.push([{ ...sourceConversation(), id: NEW_CONV_ID }])
    state.insertQueues.push([{ id: 'x1' }])
    state.updateQueues.push([firstConv])
    const first = await branchConversationFrom(CONV_ID, target.id, {
      userId: USER_ID,
      clientRequestId: CRID,
    })
    expect(first.replayed).toBe(false)
    expect(first.copiedMessageCount).toBe(1)
    const insertCallsAfterFirst = state.insertCalls

    // 第二次:同键命中 ⇒ 直接返回首建那条,零 insert / 零 update
    state.selectQueues.push([sourceConversation()])
    state.selectQueues.push([target])
    state.selectQueues.push([firstConv]) // 幂等查询命中
    const second = await branchConversationFrom(CONV_ID, target.id, {
      userId: USER_ID,
      clientRequestId: CRID,
    })

    expect(second.replayed).toBe(true)
    expect(second.conversation.id).toBe(NEW_CONV_ID)
    expect(second.copiedMessageCount).toBe(1)
    expect(state.insertCalls).toBe(insertCallsAfterFirst) // 没有第二条分叉落库
    expect(state.updateCalls).toBe(1) // 只有第一次的那一次 update
  })

  it('幂等键绑在别的分叉点上 ⇒ 409 身份的冲突错误,零写', async () => {
    const target = messageRow({
      id: '33330000-0000-4000-8000-00000000000a',
      createdAt: new Date('2026-10-01T00:00:01Z'),
    })
    state.selectQueues.push([sourceConversation()])
    state.selectQueues.push([target])
    state.selectQueues.push([
      {
        ...sourceConversation(),
        id: NEW_CONV_ID,
        metadata: {
          originalConversationId: CONV_ID,
          forkedFromMessageId: '33330000-0000-4000-8000-00000000dead',
          forkClientRequestId: CRID,
        },
      },
    ])

    await expect(
      branchConversationFrom(CONV_ID, target.id, { userId: USER_ID, clientRequestId: CRID }),
    ).rejects.toBeInstanceOf(ForkIdempotencyConflictError)
    expect(state.insertCalls).toBe(0)
    expect(state.updateCalls).toBe(0)
  })

  it('越权:源会话属于他人 ⇒ 拒绝且库零写(副作用没发生)', async () => {
    state.selectQueues.push([sourceConversation('someone-else')])

    await expect(
      branchConversationFrom(CONV_ID, '33330000-0000-4000-8000-00000000000b', {
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(ForkSourceRejectedError)
    expect(state.insertCalls).toBe(0)
    expect(state.updateCalls).toBe(0)
  })

  it('分叉点不属于该会话 ⇒ 拒绝且库零写', async () => {
    const foreign = {
      ...messageRow({
        id: '33330000-0000-4000-8000-00000000000c',
        createdAt: new Date('2026-10-01T00:00:01Z'),
      }),
      conversationId: '99999999-9999-4999-8999-999999999999',
    }
    state.selectQueues.push([sourceConversation()])
    state.selectQueues.push([foreign])

    await expect(
      branchConversationFrom(CONV_ID, foreign.id, { userId: USER_ID }),
    ).rejects.toBeInstanceOf(ForkSourceRejectedError)
    expect(state.insertCalls).toBe(0)
    expect(state.updateCalls).toBe(0)
  })

  it('复制条数与回库确认不符 ⇒ 整批失败(不留半截分叉)', async () => {
    const t1 = messageRow({
      id: '33330000-0000-4000-8000-00000000000d',
      createdAt: new Date('2026-10-01T00:00:01Z'),
      role: 'user',
    })
    const t2 = messageRow({
      id: '33330000-0000-4000-8000-00000000000e',
      createdAt: new Date('2026-10-01T00:00:02Z'),
    })
    state.selectQueues.push([sourceConversation()])
    state.selectQueues.push([t2])
    state.selectQueues.push([t1, t2])
    state.insertQueues.push([{ ...sourceConversation(), id: NEW_CONV_ID }])
    state.insertQueues.push([{ id: 'x1' }]) // 期望 2 条,回库只有 1 条

    await expect(branchConversationFrom(CONV_ID, t2.id, { userId: USER_ID })).rejects.toThrow(
      /复制不完整/,
    )
    // 复制段失败后不得再写 metadata(事务回滚由 DB 保证,这里钉住"失败即不再推进")
    expect(state.updateCalls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
