// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// 缺陷二(2026-10-29 立):文件撤销确认必须把「连带撤销后续轮次」和「任务记录不删」说清楚。
//
// 病灶:「恢复到本轮之前」实际走的是 `restoreCheckpoint(..., 'both')` —— 它把**整个会话的
// 消息历史**替换成该 checkpoint 的快照(后端 `_sync_session_messages` 直接覆盖 session.messages),
// 于是目标时点之后的所有对话轮次都会从上下文里消失。而确认弹窗只管说"共 N 个文件改动将回退",
// 用户以为自己只丢几个文件的改动,实际连后面几轮的上下文一起没了 —— 不可撤销操作 + 信息缺一半。
//
// 本文件钉三件事:
//   ① 文案取自真实 web 词包(packages/i18n/messages/web/*.json),不写死中文;
//   ② 有涟漪 ⇒ 用带 {turns} 的键,且轮次数与消息面实际消失的 assistant 轮次一致;
//   ③ 无涟漪(单轮)⇒ 走单轮键,**不得**虚报轮数(照搬竞品多轮文案会说谎)。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckpointMeta } from '@/api/checkpoint-api'
import type { ChatMessage } from '@/stores/chat'

const PACK_REL = '../../../../../../packages/i18n/messages/web/zh-CN.json'

function readTurnChangesCopy(): Record<string, string> {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = JSON.parse(readFileSync(join(here, PACK_REL), 'utf8')) as {
    chat?: { turnChanges?: Record<string, unknown>; cancel?: string }
  }
  const tc = root.chat?.turnChanges
  if (
    !tc ||
    typeof tc.revertConfirm !== 'string' ||
    typeof tc.revertConfirmWithTurns !== 'string'
  ) {
    throw new Error('web 词包缺 chat.turnChanges.revertConfirm(WithTurns)—— 本用例失去断言对象')
  }
  return tc as Record<string, string>
}

const copy = readTurnChangesCopy()

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
  if (lookupIn(parsed.chat, 'turnChanges.revertConfirm') === undefined) {
    throw new Error('next-intl mock:web 词包没有 chat.turnChanges.revertConfirm —— 失去断言对象')
  }
  // 两个 useTranslations 命名空间各取各的(chat / taskStatus),键是点分路径
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

// 纯 mock:checkpoint-api 会拉起真实 api 客户端链(auth store / 设备指纹),jsdom 里初始化即崩
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

const CONV = 'conv-turn-count-1'

/** 一条带文件写入工具调用的 assistant 消息(让 changes.length > 0,卡片才渲染) */
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

/** 挂载卡片并点开确认弹窗,返回确认文案 */
async function openConfirmAndReadText(message: ChatMessage): Promise<string> {
  render(<TurnChangesCard message={message} conversationId={CONV} />)
  const btn = await screen.findByTestId(`turn-revert-${message.id}`)
  await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(btn)
  const el = await screen.findByTestId('turn-revert-confirm-text')
  return el.textContent ?? ''
}

/**
 * 确认文案实际用了哪个键。
 *
 * 只在这一族(revertConfirm / revertConfirmWithTurns)里取最后一次 —— 不能取整个 keys 的末位:
 * 弹窗里的确认按钮文案 `turnChanges.revert` 会在其后被取,那样断言只会看到按钮的键。
 */
function lastConfirmKey(): string | undefined {
  return [...h.keys]
    .reverse()
    .find(
      (k) =>
        k === 'chat:turnChanges.revertConfirm' || k === 'chat:turnChanges.revertConfirmWithTurns',
    )
}

describe('撤销确认必须说清"连撤后面几轮 + 任务记录不删"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.keys.length = 0
    useChatStore.setState({ messages: [] })
  })
  afterEach(() => {
    cleanup()
  })

  it('① 有涟漪:文案带轮次数,且轮次数 = 目标 checkpoint 之后会消失的 assistant 轮次', async () => {
    // 会话里 3 轮 assistant 回答;本轮是第 2 轮(createdAt=2000)
    const t1 = 1000
    const t2 = 2000
    const t3 = 3000
    const messages = [
      makeTurnMessage('m1', t1),
      makeTurnMessage('m2', t2),
      makeTurnMessage('m3', t3),
    ]
    useChatStore.setState({ messages })
    // 真实场景:每轮开始前各落一个 checkpoint。目标 = 严格早于本轮(2000)的**最晚**一个
    // = cp1(1900,即第 1 轮之后、第 2 轮之前)⇒ 会消失的是第 2、3 两轮的上下文。
    // (若只有更早的那个 cp0(900),恢复它本就会连第 1 轮一起抹掉 = 3 轮,那也如实报 3 —
    //  这里特意给两个,同时钉住"取最晚那个"这条判据。)
    h.listCheckpoints.mockResolvedValue({
      session_id: CONV,
      total: 2,
      checkpoints: [cp('cp0', t1 - 100), cp('cp1', t2 - 100)],
    })

    const text = await openConfirmAndReadText(messages[1]!)

    // 轮次数如实 = 2(取最晚的 cp1;若误取更早的 cp0 会算成 3)
    expect(text).toContain('2 轮')
    expect(text).not.toContain('3 轮')
    // 三个要素齐:文件数 / 轮次数 / 任务记录不删
    expect(text).toContain('1 个文件改动')
    expect(text).toContain('任务记录不会删除')
    // 而且用的确实是带 turns 的那个键(变异对照:去掉 turns 插值就会找不到这句)
    // 注:首帧 turnCount 还是 null(异步取 checkpoint 中),会先走单轮键;异步落地后
    // 才切到带轮数的键 —— 所以看的是"确认文案这一族里**最后**取的那个键"。
    expect(h.keys).toContain('chat:turnChanges.revertConfirmWithTurns')
    expect(lastConfirmKey()).toBe('chat:turnChanges.revertConfirmWithTurns')
    // 与真实词包逐字一致(不是硬编码中文)
    const expected = copy.revertConfirmWithTurns!.replace('{count}', '1').replace('{turns}', '2')
    expect(text).toBe(expected)
  })

  it('② 无涟漪(只有本轮会消失):走单轮键,不得虚报轮数', async () => {
    const messages = [makeTurnMessage('m1', 1000), makeTurnMessage('m2', 2000)]
    useChatStore.setState({ messages })
    // 目标 checkpoint 落在第 1 轮之后、第 2 轮之前 ⇒ 只有本轮(1 轮)受影响
    h.listCheckpoints.mockResolvedValue({
      session_id: CONV,
      total: 1,
      checkpoints: [cp('cp1', 1500)],
    })

    const text = await openConfirmAndReadText(messages[1]!)

    expect(h.keys).toContain('chat:turnChanges.revertConfirm')
    expect(h.keys).not.toContain('chat:turnChanges.revertConfirmWithTurns')
    // 单轮档的判据也看"确认文案这一族最后一次取键":异步落地后仍停在单轮键
    expect(lastConfirmKey()).toBe('chat:turnChanges.revertConfirm')
    // 文案里不得出现"轮"字样的连带声明 —— 单轮时说多轮就是撒谎
    expect(text).not.toContain('轮修改')
    expect(text).toBe(copy.revertConfirm!.replace('{count}', '1'))
    // 但"任务记录不会删除"这一句在单轮档也必须说(它同样是一次不可撤销操作)
    expect(text).toContain('任务记录不会删除')
  })

  it('③ 消息面一条带时间戳的 assistant 都没有(算不出)⇒ 退单轮档,不用 0 冒充"没有涟漪"', async () => {
    // 卡片自己有 toolCalls,但 store 里消息面为空 = 读数不可得
    useChatStore.setState({ messages: [] })
    h.listCheckpoints.mockResolvedValue({
      session_id: CONV,
      total: 1,
      checkpoints: [cp('cp0', 100)],
    })
    const message = makeTurnMessage('m9', 5000)

    const text = await openConfirmAndReadText(message)

    expect(h.keys).not.toContain('chat:turnChanges.revertConfirmWithTurns')
    expect(text).toBe(copy.revertConfirm!.replace('{count}', '1'))
    // 算不出来时也走单轮键(不是 0 轮、也不是虚报 1 轮之后的数字)
    expect(lastConfirmKey()).toBe('chat:turnChanges.revertConfirm')
  })

  it('④ 无可用 checkpoint ⇒ 入口禁用(不可达),不发恢复请求', async () => {
    useChatStore.setState({ messages: [makeTurnMessage('m1', 1000)] })
    h.listCheckpoints.mockResolvedValue({ session_id: CONV, total: 0, checkpoints: [] })
    const message = makeTurnMessage('m1', 1000)

    render(<TurnChangesCard message={message} conversationId={CONV} />)
    const btn = await screen.findByTestId(`turn-revert-${message.id}`)
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true))
    // 入口禁用了 ⇒ 点不出确认弹窗,更不会发出恢复请求(副作用没发生)
    fireEvent.click(btn)
    expect(screen.queryByTestId('turn-revert-confirm-text')).toBeNull()
    expect(h.restoreCheckpoint).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
