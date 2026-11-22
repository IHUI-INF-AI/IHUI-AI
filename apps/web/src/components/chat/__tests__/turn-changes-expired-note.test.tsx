// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 「检查点为什么没了」判据 + 呈现的成对用例(2026-10-29 立)。
 *
 * ## 先核实的实际行为(写文案的依据,不是推测)
 * · `GET /api/checkpoints` 只返回未过期项(`agent_checkpoint.py` 的 `list_checkpoints`
 *   过滤 `not cp.is_expired(now)`)⇒ 过期行在响应里根本不存在。
 * · `expires_at = created_at + TTL`(`save_checkpoint` 的 `expires_at=now + self._ttl`),
 *   TTL = 24h(`app/core/tunables.DEFAULT_CHECKPOINT_TTL`,TS 镜像在
 *   `packages/shared/src/constants.ts`),且**不续期**(同文件 refresh 注释)。
 * ⇒ 消息距今 ≥ TTL 时,它之前的检查点**必然**已被清理 —— 这是可证的,文案因此可以说
 *   "已到期清理",不需要"可能/或许"这类免责措辞。
 *
 * ## 摘要还在不在(决定能不能说"仍然保留")
 * 变更清单来自 `message.toolCalls`(`computeFileChanges`),与检查点表**零依赖**;
 * 检查点 TTL 到期只清 `agent_checkpoints` / Redis 键,不碰消息表。所以过期后
 * 变更清单仍然照常渲染 —— 文案说"仍然保留"是事实,不是安慰话。
 *
 * ## 成对纪律
 * 过期态 ⇒ 说明出现;未过期 ⇒ 说明**不出现**(不得常驻)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckpointMeta } from '@/api/checkpoint-api'
import type { ChatMessage } from '@/stores/chat'
import {
  judgeCheckpointExpiry,
  retentionHours,
  type CheckpointProbeOutcome,
} from '@/lib/checkpoint-expiry-note'
import { DEFAULT_CHECKPOINT_TTL } from '@ihui/shared/constants'

const PACK_REL = '../../../../../../packages/i18n/messages/web/zh-CN.json'

function readExpiredNote(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = JSON.parse(readFileSync(join(here, PACK_REL), 'utf8')) as {
    chat?: { turnChanges?: Record<string, unknown> }
  }
  const note = root.chat?.turnChanges?.expiredNote
  if (typeof note !== 'string') {
    throw new Error('web 词包缺 chat.turnChanges.expiredNote —— 本用例失去断言对象')
  }
  return note
}

const noteCopy = readExpiredNote()

const h = vi.hoisted(() => ({
  keys: [] as string[],
  listCheckpoints: vi.fn(),
  restoreCheckpoint: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('next-intl', async () => {
  const { readFileSync: rf } = await import('node:fs')
  const { dirname: dn, join: jt } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu } = await import('@ihui/i18n')
  const parsed = JSON.parse(
    rf(
      jt(dn(toPath(import.meta.url)), '../../../../../../packages/i18n/messages/web/zh-CN.json'),
      'utf8',
    ),
  ) as unknown as { chat?: Record<string, unknown>; taskStatus?: Record<string, unknown> }
  const lookupIn = (ns: unknown, key: string): string | undefined => {
    let cur: unknown = ns
    for (const seg of key.split('.')) {
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        return undefined
      }
    }
    return typeof cur === 'string' ? cur : undefined
  }
  return {
    useTranslations: (ns: string) => {
      const table = ns === 'taskStatus' ? parsed.taskStatus : parsed.chat
      const t = (key: string, values?: Record<string, string | number>): string => {
        h.keys.push(`${ns}:${key}`)
        const raw = lookupIn(table, key)
        if (raw === undefined) return key
        return formatIcu(raw, values ?? {}, { locale: 'zh-CN' })
      }
      return t
    },
  }
})

vi.mock('@/api/checkpoint-api', () => ({
  listCheckpoints: h.listCheckpoints,
  restoreCheckpoint: h.restoreCheckpoint,
  getCheckpointImpact: vi.fn(),
}))

vi.mock('@/components/common', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>()
  return { ...orig, toast: h.toast }
})

import { TurnChangesCard } from '@/components/chat/message-list/turn-changes-card'
import { useChatStore } from '@/stores/chat'

const CONV = 'conv-expired-note-1'
const HOUR = 60 * 60 * 1000

function makeTurnMessage(id: string, createdAt: number): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: 'done',
    createdAt,
    model: 'a/x',
    toolCalls: [
      {
        id: `tc-${id}`,
        toolName: 'write_file',
        args: { file_path: 'src/a.ts' },
        result: { ok: true },
        status: 'success',
      },
    ],
  } as unknown as ChatMessage
}

function cp(id: string, createdAt: number): CheckpointMeta {
  return {
    checkpoint_id: id,
    session_id: CONV,
    iteration: 1,
    status: 'completed',
    created_at: createdAt,
    expires_at: createdAt + 1000,
    message_count: 2,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.keys.length = 0
  useChatStore.setState({ messages: [] })
})

afterEach(() => {
  cleanup()
})

describe('判据层(纯函数):只有可证的情形才判 expired', () => {
  const base = {
    hasCheckpoint: false as boolean | null,
    probeOutcome: 'done' as CheckpointProbeOutcome,
    messageCreatedAtMs: 1_000_000,
    nowMs: 1_000_000 + DEFAULT_CHECKPOINT_TTL * 1000,
  }

  it('有检查点 ⇒ available(不说过期)', () => {
    expect(judgeCheckpointExpiry({ ...base, hasCheckpoint: true })).toBe('available')
  })

  it('没有检查点 ∧ 消息距今恰好 TTL ⇒ expired(边界含等号)', () => {
    expect(judgeCheckpointExpiry(base)).toBe('expired')
  })

  it('没有检查点 ∧ 消息距今 TTL-1ms ⇒ unknown(未超过保留期,原因不可知)', () => {
    expect(judgeCheckpointExpiry({ ...base, nowMs: base.nowMs - 1 })).toBe('unknown')
  })

  it('没有检查点 ∧ 距今远超 TTL ⇒ expired', () => {
    expect(judgeCheckpointExpiry({ ...base, nowMs: base.nowMs + 100 * HOUR })).toBe('expired')
  })

  it('探测还在飞(idle)⇒ unknown(不猜)', () => {
    expect(judgeCheckpointExpiry({ ...base, probeOutcome: 'idle' })).toBe('unknown')
  })

  it('探测失败(failed)⇒ unknown(catch 把 hasCheckpoint 置 false 不构成事实)', () => {
    expect(judgeCheckpointExpiry({ ...base, probeOutcome: 'failed' })).toBe('unknown')
  })

  it('无会话 id 未发起(skipped)⇒ unknown', () => {
    expect(judgeCheckpointExpiry({ ...base, probeOutcome: 'skipped' })).toBe('unknown')
  })

  it('hasCheckpoint 仍为 null ⇒ unknown', () => {
    expect(judgeCheckpointExpiry({ ...base, hasCheckpoint: null })).toBe('unknown')
  })

  it('时间戳非有限值 ⇒ unknown', () => {
    expect(judgeCheckpointExpiry({ ...base, messageCreatedAtMs: Number.NaN })).toBe('unknown')
    expect(judgeCheckpointExpiry({ ...base, nowMs: Number.POSITIVE_INFINITY })).toBe('unknown')
  })

  it('未来时间戳(时钟漂移)⇒ unknown', () => {
    expect(judgeCheckpointExpiry({ ...base, nowMs: base.messageCreatedAtMs - 1 })).toBe('unknown')
  })

  it('保留期数值与共享层唯一真源同源:retentionHours(默认)= DEFAULT_CHECKPOINT_TTL/3600', () => {
    expect(retentionHours()).toBe(Math.round(DEFAULT_CHECKPOINT_TTL / 3600))
    expect(retentionHours()).toBe(24)
  })
})

describe('呈现层(组件):过期态显示原因说明,未过期不显示', () => {
  it('过期态 ⇒ 出现说明,并且文案说清"为什么"+"什么还留着"', async () => {
    // 25 小时前的消息,列表里没有任何(未过期)检查点
    const message = makeTurnMessage('m-old', Date.now() - 25 * HOUR)
    useChatStore.setState({ messages: [message] })
    h.listCheckpoints.mockResolvedValue({ session_id: CONV, total: 0, checkpoints: [] })

    render(<TurnChangesCard message={message} conversationId={CONV} />)

    const note = await screen.findByTestId(`turn-expired-note-${message.id}`)
    // 与真实词包逐字一致(不是硬编码中文),{hours} 已按共享层 TTL 插值
    const expected = noteCopy.replace('{hours}', String(retentionHours()))
    expect(note.textContent).toBe(expected)
    // 三要素:磁盘/保留期原因、变更清单仍在、回退不再可用
    expect(note.textContent).toContain('磁盘')
    expect(note.textContent).toContain(`${retentionHours()} 小时`)
    expect(note.textContent).toContain('仍然保留')
    expect(note.textContent).toContain('无法从这里回退')
    // 按钮仍按既有逻辑置灰 + 说"无可用检查点"(不改既有渲染)
    expect((screen.getByTestId(`turn-revert-${message.id}`) as HTMLButtonElement).disabled).toBe(
      true,
    )
    // 变更清单照常渲染(这就是"摘要还在"的事实来源)
    expect(screen.getByTestId('turn-changes-file-count').textContent).not.toBe('')
  })

  it('未过期(消息很新且确实没有检查点)⇒ 说明**不显示**,不得常驻', async () => {
    const message = makeTurnMessage('m-new', Date.now() - 1 * HOUR)
    useChatStore.setState({ messages: [message] })
    h.listCheckpoints.mockResolvedValue({ session_id: CONV, total: 0, checkpoints: [] })

    render(<TurnChangesCard message={message} conversationId={CONV} />)
    const btn = await screen.findByTestId(`turn-revert-${message.id}`)
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true))

    expect(screen.queryByTestId(`turn-expired-note-${message.id}`)).toBeNull()
    // 也没有取过这条文案的键(证明不是"取了但条件渲染掉了"的巧合)
    expect(h.keys).not.toContain('chat:turnChanges.expiredNote')
  })

  it('未过期(有可用检查点)⇒ 说明不显示,回退入口可用', async () => {
    const message = makeTurnMessage('m-avail', Date.now() - 30 * HOUR)
    useChatStore.setState({ messages: [message] })
    // 即便消息很旧,只要真有可用检查点就不能说过期
    h.listCheckpoints.mockResolvedValue({
      session_id: CONV,
      total: 1,
      checkpoints: [cp('cp1', message.createdAt - HOUR)],
    })

    render(<TurnChangesCard message={message} conversationId={CONV} />)
    const btn = await screen.findByTestId(`turn-revert-${message.id}`)
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))

    expect(screen.queryByTestId(`turn-expired-note-${message.id}`)).toBeNull()
    expect(h.keys).not.toContain('chat:turnChanges.expiredNote')
  })

  it('探测失败 ⇒ 不显示说明(问不到 ≠ 过期了)', async () => {
    const message = makeTurnMessage('m-failed', Date.now() - 25 * HOUR)
    useChatStore.setState({ messages: [message] })
    h.listCheckpoints.mockRejectedValue(new Error('network down'))

    render(<TurnChangesCard message={message} conversationId={CONV} />)
    const btn = await screen.findByTestId(`turn-revert-${message.id}`)
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true))

    expect(screen.queryByTestId(`turn-expired-note-${message.id}`)).toBeNull()
  })
})

describe('五语言同批:expiredNote 在五个词包里都在,且都带 {hours} 插值', () => {
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

  for (const loc of LOCALES) {
    it(`${loc}.json 有 chat.turnChanges.expiredNote 且含 {hours}`, () => {
      const here = dirname(fileURLToPath(import.meta.url))
      const pack = JSON.parse(
        readFileSync(
          join(here, `../../../../../../packages/i18n/messages/web/${loc}.json`),
          'utf8',
        ),
      ) as { chat?: { turnChanges?: Record<string, unknown> } }
      const note = pack.chat?.turnChanges?.expiredNote
      expect(typeof note).toBe('string')
      expect(note as string).toContain('{hours}')
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
