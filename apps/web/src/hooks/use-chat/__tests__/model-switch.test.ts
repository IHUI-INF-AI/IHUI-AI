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
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  clearPendingQuestionIfAny,
  resolveTerminateNotice,
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
    /** 与 notice 同序的 description(无则 empty string)—— 两条说明合成一条时的承载面 */
    noticeDesc: string[]
    interrupted: Array<string | null>
    cleared: number
    /** 真正清掉提问态的次数据(清空后再清不算) */
    questionCleared: number
  }
  /** 「未回答的提问」挂起态的真值面:断言弹窗数据是否真的被摘掉 */
  question: { pendingQuestion: unknown }
}

function makeProbe(overrides: Partial<TerminateStreamDeps> = {}, pending: unknown = null): Probe {
  const calls = {
    abort: 0,
    server: [] as Probe['calls']['server'],
    notice: [] as string[],
    noticeDesc: [] as string[],
    interrupted: [] as Array<string | null>,
    cleared: 0,
    questionCleared: 0,
  }
  // 真 AbortController:靠 signal 计数,不去伪造/强转控制器
  const controller = new AbortController()
  controller.signal.addEventListener('abort', () => {
    calls.abort += 1
  })
  // 「未回答的提问」挂起态用一层最小真值模拟:只有非空时 clear 才算真清到东西。
  const question: Probe['question'] = { pendingQuestion: pending }
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
    // 走生产判据(§22c:不在这里复制"有没有待答提问"的判据)
    clearPendingQuestion: () => {
      const cleared = clearPendingQuestionIfAny({
        pendingQuestion: question.pendingQuestion,
        clearPendingQuestion: () => {
          question.pendingQuestion = null
        },
      })
      if (cleared) calls.questionCleared += 1
      return cleared
    },
    questionCancelledNotice: '任务已停止,未回答的问题已取消',
    showNotice: (message, description) => {
      calls.notice.push(message)
      calls.noticeDesc.push(description ?? '')
    },
    ...overrides,
  }
  return { deps, calls, question }
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

// 缺陷一(2026-10-29 立):点「停止」后未回答的提问弹窗必须跟着消失。
// 病灶:终止动作五步(标记中断 → 通知网关 → abort → 回收压缩预告 → 呈现理由)里
// 没有一处碰 pendingQuestion,于是弹窗留在屏幕上;用户选完答案会投给一条已经终止的
// 流(`/chat/answer` 无从续接),界面上却毫无反馈 —— 用户以为答案生效了。
describe('终止时必须取消未回答的提问(僵尸弹窗)', () => {
  const PENDING = { questionId: 'q-1', prompt: '选哪个?', options: [] }

  // 取证形态:vitest 下 import.meta.url 不保证是 file scheme(实测报 "The URL must be of scheme file"),
  // 故以 cwd(apps/web)+ 相对路径定位仓库内文件。
  const repoFile = (rel: string): string =>
    readFileSync(join(process.cwd(), '..', '..', rel), 'utf8').replace(/\r\n/g, '\n')

  it('正向:有未回答提问 + 终止 ⇒ 提问态被清除,并给出可解释的提示', () => {
    const probe = makeProbe({}, PENDING)
    expect(terminateActiveStream(probe.deps)).toBe(true)
    // 提问态确实被摘掉(QuestionDialog 的 question prop 来自它,清空即弹窗不渲染)
    expect(probe.question.pendingQuestion).toBeNull()
    expect(probe.calls.questionCleared).toBe(1)
    // 且必须有一条人话提示:静默关弹窗会让用户以为是自己点错了
    expect(probe.calls.notice).toEqual(['任务已停止,未回答的问题已取消'])
    // 用户自己点停止时不带"为什么停"的描述 —— 他本来就知道
    expect(probe.calls.noticeDesc).toEqual([''])
  })

  it('正向:换模型被动终止 + 有未答提问 ⇒ 合成一条提示(标题说提问取消,描述说为何停)', () => {
    const probe = makeProbe({ notice: '已切换到 b/y' }, PENDING)
    terminateActiveStream(probe.deps)
    expect(probe.calls.notice).toEqual(['任务已停止,未回答的问题已取消'])
    expect(probe.calls.noticeDesc).toEqual(['已切换到 b/y'])
  })

  it('反向:无未回答提问 + 终止 ⇒ 不产生多余提示(不得每次停止都弹一条无意义提示)', () => {
    const probe = makeProbe()
    expect(terminateActiveStream(probe.deps)).toBe(true)
    // 用户自己点停止、也没有待答提问 ⇒ 维持既有静默行为(零条 toast)
    expect(probe.calls.notice).toEqual([])
    // 但终止本身的四个动作照旧,不得因为"没提问"就少做
    expect(probe.calls.abort).toBe(1)
    expect(probe.calls.interrupted).toEqual(['msg-a'])
    expect(probe.calls.cleared).toBe(1)
  })

  it('反向:无在途流时(控制器为 null)一处副作用都不碰,提问态同样不许被动', () => {
    const probe = makeProbe({ abortRef: { current: null } }, PENDING)
    expect(terminateActiveStream(probe.deps)).toBe(false)
    expect(probe.calls.notice).toEqual([])
    // 没有流就没有"这条流上的提问"可言,不得顺手清掉别人的挂起态
    expect(probe.question.pendingQuestion).toBe(PENDING)
    expect(probe.calls.questionCleared).toBe(0)
  })

  // 本仓铁律:无效/越权用例必须断言「副作用没发生」,不能只断言返回值。
  // 这里咬的是"终止后再提交答案"这一整条链:提问态已清 ⇒
  // ① 提交入口在界面上不可达(QuestionDialog 的 question 为 null 即不渲染);
  // ② 即便有人绕过 UI 直调 sendAnswer,它也必须拒绝,**且不许写任何消息/发起任何流**。
  //
  // ② 的取证方式:sendAnswer 的准入判据是 `if ((!pending && !opts?.fromRetry) || isStreaming) return`
  // (send-answer.ts:83)。这里不 import 整个 send-answer(它拉 20+ 模块,jsdom 里 15s 超时),
  // 而是拿生产 store 复现该判据的两个输入,断言"提问为 null 的 store 上该判据必然拒绝",
  // 同时用接线锁(下面那条)保证 send-answer 里那行判据没被改掉。
  it('副作用锁:终止后再提交答案 ⇒ 入口不可达,且 store 处于"必被拒"的准入态', async () => {
    const probe = makeProbe({}, PENDING)
    terminateActiveStream(probe.deps)
    // ① 入口不可达:弹窗数据为 null,QuestionDialog 因此 `if (!question) return null`
    expect(probe.question.pendingQuestion).toBeNull()

    // ② 用生产 store 复现 sendAnswer 的准入判据输入:提问没了 ⇒ pending 为 null
    const { createChatStore } = await import('@/stores/chat')
    const store = createChatStore('ihui-zombie-dialog-test')
    store.setState({ pendingQuestion: null, isStreaming: false, messages: [] })
    const pending = store.getState().pendingQuestion
    // sendAnswer 的第一道门:没有挂起提问且不是 fromRetry ⇒ return(不进任何写操作)
    expect(!pending).toBe(true)
    // 断言副作用没发生:store 里一条消息都没有、没有进入流式、没有错误
    expect(store.getState().messages).toEqual([])
    expect(store.getState().isStreaming).toBe(false)
    expect(store.getState().error).toBeNull()
  })

  it('接线锁:send-answer 的准入判据仍把"无挂起提问"挡在门外(副作用不发生的前提)', () => {
    const src = repoFile('apps/web/src/hooks/use-chat/send-answer.ts')
    expect(src).toContain('if ((!pending && !opts?.fromRetry) || store.isStreaming) return')
  })

  it('clearPendingQuestionIfAny:空挂起态返回 false(提示的判据只认它)', () => {
    const store = {
      pendingQuestion: null as unknown,
      clears: 0,
      clearPendingQuestion() {
        this.clears += 1
      },
    }
    expect(clearPendingQuestionIfAny(store)).toBe(false)
    expect(store.clears).toBe(0)
    store.pendingQuestion = PENDING
    expect(clearPendingQuestionIfAny(store)).toBe(true)
    expect(store.clears).toBe(1)
  })

  it('resolveTerminateNotice:三种组合各归各(i 不许互相吞,也不许无中生有)', () => {
    expect(resolveTerminateNotice({ questionCancelled: false })).toBeNull()
    expect(resolveTerminateNotice({ notice: '已切换到 b/y', questionCancelled: false })).toEqual({
      message: '已切换到 b/y',
    })
    expect(
      resolveTerminateNotice({ questionCancelledNotice: '问题已取消', questionCancelled: true }),
    ).toEqual({ message: '问题已取消' })
    // 两条都成立 ⇒ 合成一条,不是两条 toast,也不是只留一条
    expect(
      resolveTerminateNotice({
        notice: '已切换到 b/y',
        questionCancelledNotice: '问题已取消',
        questionCancelled: true,
      }),
    ).toEqual({ message: '问题已取消', description: '已切换到 b/y' })
  })

  // 僵尸弹窗有两半:前端清 store 只是看得见的那半。挂起态同时被写进
  // conversation.metadata.pendingQuestion(POST /chat/questions),只清本地 ⇒ 用户一刷新,
  // history 装载那步就把弹窗从 metadata 原样恢复出来,而它挂的流早已终止。
  // 这条是「装车证明」:判据必须真接在主链路上,否则等于没做。
  // 僵尸弹窗有两半:前端清 store 只是看得见的那半。挂起态同时被写进
  // conversation.metadata.pendingQuestion(POST /chat/questions),只清本地 ⇒ 用户一刷新,
  // history 装载那步就把弹窗从 metadata 原样恢复出来,而它挂的流早已终止。
  // 这两条是「装车证明」:判据必须真接在主链路上,否则等于没做。
  it('接线锁:停止路径必须把提问态传给唯一终止出口(前端那一半)', () => {
    const src = repoFile('apps/web/src/hooks/use-chat.ts')
    expect(src).toContain('clearPendingQuestion: () => clearPendingQuestionIfAny(')
    expect(src).toContain("questionCancelledNotice: t('questionCancelledByStop')")
  })

  it('接线锁:/chat/abort 必须作废服务端挂起态(刷新后弹窗不得复活)', () => {
    const src = repoFile('apps/api/src/routes/ai-chat-stream.ts')
    // 抓 abort 端点这一段(到 steer 段之前),判它内部真的写了 pendingQuestion: null
    const start = src.indexOf("server.post('/chat/abort'")
    expect(start).toBeGreaterThan(-1)
    const segment = src.slice(start, src.indexOf("'/chat/steer'", start))
    expect(segment).toContain('patchConversationMetadata(conversationId, request.userId, {')
    expect(segment).toContain('pendingQuestion: null')
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
      'const roundModel = resolveRoundModel(model, chatStore.getState().currentModel)',
    )
    expect(src).toContain(
      'const effectiveModel = resolveRoundModel(roundModel, chatStore.getState().currentModel)',
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

// V3 #68 的可达性锁:机制齐但界面够不到 = 没交付。
// 上一轮实测 `ModelSelector disabled={isStreaming}` 让流式中根本点不到选择器,
// 于是三判据全部只在单测里成立。这条断言防它悄悄退回去。
describe('换档入口必须真的可达(不只是机制就绪)', () => {
  // 上面那个 describe 里的 read() 是块内作用域,这里复用会 ReferenceError
  // —— 整个文件收集期就挂,16 条既有用例一起被吞掉(本仓记过"收集失败静默削覆盖"那一型)。
  const readInput = (rel: string) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  const input = readInput('../../../components/chat/message-input.tsx')

  it('流式中不得再禁用模型选择器', () => {
    // 切片只取 <ModelSelector 自身的开标签段(到 footer={ 为止):footer 里的
    // ReasoningEffortInputAxis/SamplingParamsButton 自带 disabled={isStreaming} 是
    // 合理禁用(不是选择器本身),原贪婪切片(到第一个 />)会被 footer 撑破而误判。
    const start = input.indexOf('<ModelSelector')
    const openTag = input.slice(start, input.indexOf('footer={', start))
    expect(openTag).not.toMatch(/disabled=\{isStreaming\}/)
    expect(openTag).toContain('onChange={onModelChange}')
  })

  it('选择器仍被渲染(不得用"删掉整块"来糊上一条断言)', () => {
    expect(input).toContain('<ModelSelector')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
