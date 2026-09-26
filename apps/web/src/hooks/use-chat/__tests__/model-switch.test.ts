// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #68 回归:「流式中切换模型 → 终止后自动带入新模型」三条判据。
// 判据实现直接从 ../model-switch 导入(AGENTS §22c:禁止在测试里复制实现)。
// 为什么测这一层而不是渲染整条 useChat:它牵 20+ 个模块(@ihui/api-client / 各 store / lib),
// 渲染式用例只会把 mock 面写大、不会把断言写强;而"终止动作"与"本轮取哪个档位"都是纯逻辑。
// 末尾另有一组"装车证明":判据必须真接在 use-chat / send-message 上,否则等于没有
// (守门 70/76/81 反复记过的同一型)。
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  resolveRoundModel,
  shouldTerminateForModelSwitch,
  terminateActiveStream,
  type TerminateStreamDeps,
} from '../model-switch'

interface Probe {
  deps: TerminateStreamDeps
  calls: {
    abort: number
    server: Array<{ conversationId: string; messageId?: string }>
    notice: string[]
    interrupted: Array<string | null>
    cleared: number
  }
}

function makeProbe(overrides: Partial<TerminateStreamDeps> = {}): Probe {
  const calls = {
    abort: 0,
    server: [] as Probe['calls']['server'],
    notice: [] as string[],
    interrupted: [] as Array<string | null>,
    cleared: 0,
  }
  // 真 AbortController:靠 signal 计数,不去伪造/强转控制器
  const controller = new AbortController()
  controller.signal.addEventListener('abort', () => {
    calls.abort += 1
  })
  const deps: TerminateStreamDeps = {
    abortRef: { current: controller },
    conversationId: 'conv-1',
    findInterruptedAssistantId: () => 'msg-a',
    setInterruptedMessage: (id) => {
      calls.interrupted.push(id)
    },
    notifyServerAbort: (payload) => {
      calls.server.push(payload)
    },
    clearCompactionPreview: () => {
      calls.cleared += 1
    },
    showNotice: (message) => {
      calls.notice.push(message)
    },
    ...overrides,
  }
  return { deps, calls }
}

describe('shouldTerminateForModelSwitch — 该不该因为换档而终止', () => {
  it('挂载首帧(模型未变)不终止,即使此刻有流在跑', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'a/x',
        currentModel: 'a/x',
        hasLiveStream: true,
      }),
    ).toBe(false)
  })

  it('无在途流时不终止:纯换档不该发一次服务端中止、也不该弹提示', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'a/x',
        currentModel: 'b/y',
        hasLiveStream: false,
      }),
    ).toBe(false)
  })

  it('模型变了且有流 → 终止(判据 1 的正例)', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'a/x',
        currentModel: 'b/y',
        hasLiveStream: true,
      }),
    ).toBe(true)
  })
})

describe('terminateActiveStream — 终止动作只允许有一份实现', () => {
  it('没有控制器时返回 false,且一处副作用都不碰(反向锁:凭空的服务端中止请求)', () => {
    const probe = makeProbe({ abortRef: { current: null } })
    expect(terminateActiveStream(probe.deps)).toBe(false)
    expect(probe.calls.server).toEqual([])
    expect(probe.calls.interrupted).toEqual([])
    expect(probe.calls.notice).toEqual([])
    expect(probe.calls.cleared).toBe(0)
  })

  it('有流时:标记中断 + 带 messageId 通知网关 + abort + 呈现理由,返回 true', () => {
    const probe = makeProbe({ notice: '已切换到 b/y' })
    expect(terminateActiveStream(probe.deps)).toBe(true)
    expect(probe.calls.interrupted).toEqual(['msg-a'])
    expect(probe.calls.server).toEqual([{ conversationId: 'conv-1', messageId: 'msg-a' }])
    expect(probe.calls.abort).toBe(1)
    expect(probe.calls.notice).toEqual(['已切换到 b/y'])
    expect(probe.calls.cleared).toBe(1)
  })

  it('用户主动 stop(不带 notice)保持既有静默行为:不弹提示,其余动作照旧', () => {
    const probe = makeProbe()
    expect(terminateActiveStream(probe.deps)).toBe(true)
    expect(probe.calls.notice).toEqual([])
    expect(probe.calls.abort).toBe(1)
  })

  it('找不到在流式的 assistant 消息时,请求体不带 messageId(沿用 stop() 原条件)', () => {
    const probe = makeProbe({ findInterruptedAssistantId: () => null })
    terminateActiveStream(probe.deps)
    expect(probe.calls.server).toEqual([{ conversationId: 'conv-1' }])
    expect(probe.calls.interrupted).toEqual([null])
  })

  it('无会话 id 时不发服务端通知,但本地流仍被 abort(与改造前 stop() 同形)', () => {
    const probe = makeProbe({ conversationId: null })
    expect(terminateActiveStream(probe.deps)).toBe(true)
    expect(probe.calls.server).toEqual([])
    expect(probe.calls.abort).toBe(1)
  })

  it('反向锁:不得把 abortRef 置空 —— 控制器由该流自己的 finally(代际守卫内)回收', () => {
    const probe = makeProbe()
    const before = probe.deps.abortRef.current
    terminateActiveStream(probe.deps)
    expect(probe.deps.abortRef.current).toBe(before)
  })
})

describe('resolveRoundModel — 本轮到底用哪个模型(判据 2 + 判据 3)', () => {
  it('入口取到旧档、发起前已换成新档 → 用新档(用户不必重选第二次)', () => {
    expect(resolveRoundModel('a/x', 'b/y')).toBe('b/y')
  })

  it('最新档为空时退回入口档,不把空串送进 provider(对抗例:持久化回填中间态)', () => {
    expect(resolveRoundModel('a/x', '')).toBe('a/x')
  })

  it('两者相同则原样返回', () => {
    expect(resolveRoundModel('auto', 'auto')).toBe('auto')
  })
})

describe('完整交错时序(不是只测最顺的那一条)', () => {
  it('流式中换模型 → 终止 → 下一轮带新模型:全程只发一次服务端中止、只 abort 一次', () => {
    const state = { model: 'a/x' }
    const notify = vi.fn()
    const probe = makeProbe({
      findInterruptedAssistantId: () => 'msg-1',
      notifyServerAbort: notify,
    })

    // ① 用户改档,此刻确有流在跑
    const nextModel = 'b/y'
    expect(
      shouldTerminateForModelSwitch({
        previousModel: state.model,
        currentModel: nextModel,
        hasLiveStream: Boolean(probe.deps.abortRef.current),
      }),
    ).toBe(true)
    terminateActiveStream({ ...probe.deps, notice: 'switched' })
    state.model = nextModel

    // ② 同一档位被 effect 再跑一遍(t / 组件重渲染都会重跑)不得二次中止
    expect(
      shouldTerminateForModelSwitch({
        previousModel: state.model,
        currentModel: state.model,
        hasLiveStream: Boolean(probe.deps.abortRef.current),
      }),
    ).toBe(false)

    // ③ 下一轮:入口先取到"上一轮"的值,发起前被复核 ⇒ provider 只收到新档
    expect(resolveRoundModel('a/x', state.model)).toBe('b/y')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(probe.calls.abort).toBe(1)
  })
})

describe('装车证明:判据必须真接在主链路上', () => {
  const read = (rel: string): string =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

  it('use-chat.ts:stop 与切换 effect 共用一个出口,切换路径带用户可见理由', () => {
    const src = read('../../use-chat.ts')
    expect(src).toContain("from './use-chat/model-switch'")
    expect(src).toContain('terminateActiveStream({')
    expect(src).toContain('shouldTerminateForModelSwitch({')
    expect(src).toContain("t('modelSwitchStopped'")
    // 服务端中止端点在 use-chat.ts 只允许出现一次(= 那个唯一出口里);
    // 出现两次就意味着有人又写了一套终止逻辑。
    expect(src.match(/\/api\/ai\/chat\/abort/g)).toHaveLength(1)
  })

  it('send-message.ts:入口档位在发起前必须被复核两次(建消息前 + 进 provider 前)', () => {
    const src = read('../send-message.ts')
    expect(src).toContain("import { resolveRoundModel } from './model-switch'")
    expect(src).toContain(
      'const roundModel = resolveRoundModel(model, useChatStore.getState().currentModel)',
    )
    expect(src).toContain(
      'const effectiveModel = resolveRoundModel(roundModel, useChatStore.getState().currentModel)',
    )
    // 空气泡防线:流必须取复核后的档位,而不是入口那个旧 model
    expect(src).toContain('model: effectiveModel')
  })

  it('model-switch.ts 不自带 toast / store 依赖(DI 出口,别把第二份真相写进纯模块)', () => {
    const src = read('../model-switch.ts')
    expect(src).not.toContain("from 'sonner'")
    expect(src).not.toContain("from '@/components/common'")
    expect(src).not.toContain("from '@/stores/chat'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
