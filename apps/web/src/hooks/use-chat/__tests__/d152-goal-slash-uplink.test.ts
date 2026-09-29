// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D152(2026-09-29 立)`/goal` 斜杠命令的**上行**装车证明。
//
// 这一票把 `/goal` 从"只改这台浏览器"升成 **乐观更新 + 写服务端主副本**,所以两条各证一件事:
//   ① 本地缓存先变(slash 命中即写 store,不等网络)—— 表现与改前逐字同形;
//   ② 上行出口真的被调用,且 **第二参数逐字段**等于 { action, objective }
//      (多一维少一维都算红:`objective` 拼错就等于服务端落了一条空目标)。
// 反向对照:把 pushGoalToServer 的调用点摘掉 ⇒ ② 必红(只测 store 证不出"打上去了")。
//
// 三条刻意登记的边界(不是遗漏,是端点今天给不了的面,写在 missing 台账与交付报告里):
//  · `done` 不上行 —— 端点只有 set/pause/resume/clear 四个动作,没有把状态写成 done 的口;
//  · 拿不到 conversationId 不发 —— 猜地址的表现是"点了没反应且不报错"(D151 同一课);
//  · accepted:false 不弹错 —— 服务端对"没这条会话"与"不是你的"刻意同形回包。
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { postSessionGoalMock, runCommandMock } = vi.hoisted(() => ({
  postSessionGoalMock: vi.fn(),
  runCommandMock: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({ runCommand: runCommandMock, postSessionGoal: postSessionGoalMock }))
vi.mock('@/components/common', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('@/components/ai/full-access-confirm-dialog', () => ({
  isFullAccessConfirmSuppressed: () => true,
}))
vi.mock('@/stores/agent-hooks', () => ({ emitAgentHook: vi.fn() }))
vi.mock('@/api/best-of-api', () => ({ runBestOfN: vi.fn() }))
vi.mock('@/stores/mode', () => ({
  useModeStore: { getState: () => ({ currentMode: 'build', setMode: vi.fn() }) },
}))
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: {
    getState: () => ({
      activeWorkspace: null,
      pendingPermissionMode: null,
      setPendingFullAccess: vi.fn(),
    }),
  },
}))
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: {
    getState: () => ({ workspacePath: null, fetchGitLog: vi.fn(), fetchDiffFiles: vi.fn() }),
  },
}))
vi.mock('@/stores/best-of', () => ({ useBestOfStore: { getState: () => ({ setResult: vi.fn() }) } }))

import { tryHandleGoalSlash } from '../slash-commands'
import { useChatStore } from '@/stores/chat'
import { useGoalStore } from '@/stores/goal'

const t = (key: string) => key

/** 让 fire-and-forget 那一跳落地(void promise 不进 await 链,靠微任务队列冲刷) */
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await Promise.resolve()
}

beforeEach(() => {
  postSessionGoalMock.mockReset()
  postSessionGoalMock.mockResolvedValue({ ok: true, accepted: true, status: 'active' })
  useGoalStore.setState({ goal: null, expanded: true })
  useChatStore.setState({ conversationId: 'conv-42' })
})

describe('D152 /goal 乐观更新 + 上行主副本', () => {
  it('/goal <目标> ⇒ 本地缓存先变 active,随后 postSessionGoal 被调且第二参数逐字段相等', async () => {
    expect(tryHandleGoalSlash('/goal 把发布链路做完', t)).toBe(true)
    // 乐观:网络往返之前界面就有目标(这是"命中即吞掉输入、不进 LLM 流"的体验底线)
    expect(useGoalStore.getState().goal?.text).toBe('把发布链路做完')
    expect(useGoalStore.getState().goal?.status).toBe('active')
    await flush()
    expect(postSessionGoalMock).toHaveBeenCalledTimes(1)
    expect(postSessionGoalMock.mock.calls[0]?.[0]).toBe('conv-42')
    expect(postSessionGoalMock.mock.calls[0]?.[1]).toEqual({ action: 'set', objective: '把发布链路做完' })
  })

  it('/goal clear ⇒ 清本地 + 上行 clear(cleared 由 status 承载,端内不建第二帧)', async () => {
    useGoalStore.getState().setGoal('待清除')
    expect(tryHandleGoalSlash('/goal clear', t)).toBe(true)
    expect(useGoalStore.getState().goal).toBeNull()
    await flush()
    expect(postSessionGoalMock.mock.calls[0]?.[1]).toEqual({ action: 'clear' })
  })

  it('没有 conversationId ⇒ 一律不发请求(不把一行字 POST 到猜出来的地址)', async () => {
    useChatStore.setState({ conversationId: null })
    expect(tryHandleGoalSlash('/goal 无会话也要能设', t)).toBe(true)
    expect(useGoalStore.getState().goal?.text).toBe('无会话也要能设')
    await flush()
    expect(postSessionGoalMock).not.toHaveBeenCalled()
  })

  it('/goal done 不上行(端点四个动作里没有 done 档 —— 登记为敞口,不冒充已接)', async () => {
    useGoalStore.getState().setGoal('做完了')
    expect(tryHandleGoalSlash('/goal done', t)).toBe(true)
    expect(useGoalStore.getState().goal?.status).toBe('done')
    await flush()
    expect(postSessionGoalMock).not.toHaveBeenCalled()
  })

  it('/goal(无参)只查看,不写不发', async () => {
    expect(tryHandleGoalSlash('/goal', t)).toBe(true)
    await flush()
    expect(postSessionGoalMock).not.toHaveBeenCalled()
  })

  it('上行 reject ⇒ 不抛给调用方、本地乐观态保留(票第 8 栏的回退口径)', async () => {
    postSessionGoalMock.mockRejectedValueOnce(new Error('postSessionGoal failed: HTTP 500'))
    expect(() => tryHandleGoalSlash('/goal 网络会红', t)).not.toThrow()
    await flush()
    expect(useGoalStore.getState().goal?.text).toBe('网络会红')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
