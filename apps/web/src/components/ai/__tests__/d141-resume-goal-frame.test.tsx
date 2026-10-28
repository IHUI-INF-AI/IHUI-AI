// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 控制帧 `resume_goal`(2026-10-28 立)的 web 消费端装车证明。
//
// 这一帧在端内的价值 = **恢复要落到服务端主副本**:只改本地缓存的那一下,服务端那份
// 仍停在 paused(换浏览器/换端就看不见)。所以本用例钉住四件事,各证一件:
//   ① **接线**:点「恢复」⇒ `resumeSessionGoal(conversationId)` 真被调,且参数逐字相等;
//   ② **差额可见**:服务端回 ok 但没恢复(带 reason 码)⇒ 本地态**回滚** + 原因文案显示;
//   ③ **回退口径**:服务端同形拒绝(ok:false,不存在/非属主两种情形同形)⇒ 退回纯本地态、
//      **不弹错**(不得当成「恢复失败」);
//   ④ **失败给可见原因**:网络/接口异常 ⇒ 回滚 + 错误文案带原因。
// 文案断言走**真语包**(packages/i18n/messages/{shared,web}/<lang>.json 深合并,与
// apps/web/src/i18n/request.ts 同一口径)—— 用假 t() 只能证明「组件念了个键」,
// 证不出「那几枚新键真的在五语言里」。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → ai → components → src → web → apps → 仓库根(6 层)
const repoRoot = resolve(here, '../../../../../../')
const readPack = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(repoRoot, 'packages/i18n/messages', name), 'utf8')) as Record<
    string,
    unknown
  >
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
/** 与 @ihui/i18n mergeMessages 同语义:web 端覆盖 shared */
const mergePack = (
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = out[k]
    out[k] = isRecord(b) && isRecord(v) ? mergePack(b, v) : v
  }
  return out
}
const lookupIn = (pack: Record<string, unknown>, ns: string, key: string): unknown =>
  [...ns.split('.'), ...key.split('.')].reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' && !Array.isArray(node)
        ? (node as Record<string, unknown>)[part]
        : undefined,
    pack,
  )

const { resumeSessionGoalMock, toastMock, chatState } = vi.hoisted(() => ({
  resumeSessionGoalMock: vi.fn(),
  toastMock: { success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn() },
  chatState: { conversationId: 'conv-42' as string | null },
}))

vi.mock('@ihui/api-client', () => ({
  resumeSessionGoal: resumeSessionGoalMock,
  // MyQuestsBoard(goal 卡内嵌的跨会话目标板)也从此包取出口;本用例不测它,
  // 但模块整体被替换 ⇒ 少一个具名导出就会在默认参数求值时炸(vi.mock 的整模替换语义)。
  listMyGoals: vi.fn(async () => ({ goals: [] })),
}))
vi.mock('@/components/common', () => ({ toast: toastMock }))
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, vars?: Record<string, string | number>) =>
      key === 'resumeFailed' && vars
        ? `${key}:${String(vars.message ?? '')}`
        : key,
}))
// GoalCard 只在 handleContinue 里 setState,隔离重依赖的 chat store
vi.mock('@/stores/chat', () => ({
  useChatStore: {
    setState: vi.fn(),
    getState: () => chatState,
  },
}))

import { GoalCard } from '../goal-card'
import { useGoalStore, type Goal } from '@/stores/goal'

function makeGoal(partial: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-d141',
    text: '把报告写完',
    status: 'paused',
    progress: 40,
    blockers: [],
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    ...partial,
  }
}

describe('控制帧 resume_goal 的 web 消费端', () => {
  afterEach(() => {
    cleanup()
    useGoalStore.setState({ goal: null, expanded: true })
    resumeSessionGoalMock.mockReset()
    toastMock.success.mockReset()
    toastMock.info.mockReset()
    toastMock.error.mockReset()
    chatState.conversationId = 'conv-42'
  })

  it('① 接线:点「恢复」⇒ resumeSessionGoal 被调且会话 id 逐字相等;服务端接受 ⇒ 成功提示', async () => {
    useGoalStore.setState({ goal: makeGoal({ status: 'paused' }) })
    resumeSessionGoalMock.mockResolvedValue({
      ok: true,
      accepted: true,
      resumed: true,
      status: 'active',
    })
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-resume'))

    await waitFor(() => expect(resumeSessionGoalMock).toHaveBeenCalledTimes(1))
    expect(resumeSessionGoalMock.mock.calls[0]?.[0]).toBe('conv-42')
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('resumeServerOk'))
    // 本地态进了 active
    expect(useGoalStore.getState().goal?.status).toBe('active')
  })

  it('② 差额可见:服务端说「已结束」⇒ 本地态回滚到 paused + 原因文案显示', async () => {
    useGoalStore.setState({ goal: makeGoal({ status: 'paused' }) })
    resumeSessionGoalMock.mockResolvedValue({
      ok: true,
      accepted: false,
      resumed: false,
      status: 'done',
      reason: 'terminal',
    })
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-resume'))

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('resumeTerminal'))
    // 乐观改完不回滚 = 界面停在「恢复好了」而服务端压根没这回事
    expect(useGoalStore.getState().goal?.status).toBe('paused')
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('②b 差额可见:服务端说「本来就在进行中」⇒ 提示信息而不是错误,且本地态回滚', async () => {
    useGoalStore.setState({ goal: makeGoal({ status: 'paused' }) })
    resumeSessionGoalMock.mockResolvedValue({
      ok: true,
      accepted: false,
      resumed: false,
      status: 'active',
      reason: 'already_active',
    })
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-resume'))

    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith('resumeAlreadyActive'))
    expect(useGoalStore.getState().goal?.status).toBe('paused')
  })

  it('③ 回退口径:服务端同形拒绝(ok:false)⇒ 退回纯本地态且不弹错', async () => {
    useGoalStore.setState({ goal: makeGoal({ status: 'paused' }) })
    resumeSessionGoalMock.mockResolvedValue({ ok: false, accepted: false, resumed: false })
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-resume'))

    await waitFor(() => expect(resumeSessionGoalMock).toHaveBeenCalledTimes(1))
    expect(toastMock.error).not.toHaveBeenCalled()
    expect(toastMock.success).not.toHaveBeenCalled()
    // 纯本地态:功能不中断
    expect(useGoalStore.getState().goal?.status).toBe('active')
  })

  it('④ 失败给可见原因:接口异常 ⇒ 回滚本地态 + 错误文案带原因', async () => {
    useGoalStore.setState({ goal: makeGoal({ status: 'paused' }) })
    resumeSessionGoalMock.mockRejectedValue(new Error('HTTP 502'))
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-resume'))

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('resumeFailed:HTTP 502'))
    expect(useGoalStore.getState().goal?.status).toBe('paused')
  })

  it('⑤ 真语包:新增的五枚键在五语言里都在(不是「组件念了个键」)', () => {
    const langs = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
    const keys = [
      'resumeServerOk',
      'resumeAlreadyActive',
      'resumeTerminal',
      'resumeNoGoal',
      'resumeFailed',
    ]
    for (const lang of langs) {
      const pack = mergePack(
        readPack(`shared/${lang}.json`),
        readPack(`web/${lang}.json`),
      )
      for (const key of keys) {
        const value = lookupIn(pack, 'goalCard', key)
        expect(typeof value, `${lang}/goalCard.${key}`).toBe('string')
        expect(String(value).length, `${lang}/goalCard.${key}`).toBeGreaterThan(0)
      }
    }
    // 插值占位符必须五语言都在(缺一个 ⇒ 那一语言的报错文案里 {message} 会原样露出)
    for (const lang of langs) {
      const pack = mergePack(
        readPack(`shared/${lang}.json`),
        readPack(`web/${lang}.json`),
      )
      const failed = (
        pack.goalCard as Record<string, unknown>
      ).resumeFailed as string
      expect(failed, `${lang}/goalCard.resumeFailed`).toContain('{message}')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
