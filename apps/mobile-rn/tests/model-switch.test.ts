// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 68 RN 腿用例。判据实现直接从 `../src/lib/model-switch` 导入
// (AGENTS §22c:禁止在测试里复制一份源判据);表逐条抄自 web 参照件
// `apps/web/src/hooks/use-chat/__tests__/model-switch.test.ts` 与小程序腿
// `apps/miniapp-taro/src/pkg-ai/ai/__tests__/model-switch.test.ts` —— 三端只许同一套语义。
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveRoundModel,
  shouldTerminateForModelSwitch,
  terminateActiveStream,
} from '../src/lib/model-switch'

const SCREEN_SOURCE = readFileSync(join(__dirname, '../src/screens/ChatScreen.tsx'), 'utf8')

function makeProbe() {
  const controller = new AbortController()
  const spy = vi.spyOn(controller, 'abort')
  const reclaimed = vi.fn()
  const printed = vi.fn()
  return {
    controller,
    spy,
    reclaimed,
    printed,
    deps: {
      abortRef: { current: controller as AbortController | null },
      reclaimStreaming: reclaimed,
      showNotice: printed,
    },
  }
}

describe('shouldTerminateForModelSwitch — 该不该因为换档而终止(web 判据表 1:1)', () => {
  it('模型没变 ⇒ 不终止(挂载首帧与 fetchModels 回填都走这一支)', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'gpt-4o',
        currentModel: 'gpt-4o',
        hasLiveStream: true,
      }),
    ).toBe(false)
  })

  it('模型变了但没有在途流 ⇒ 不终止(纯换档不该打断,也不该打扰用户)', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'gpt-4o',
        currentModel: 'claude-3-5-sonnet',
        hasLiveStream: false,
      }),
    ).toBe(false)
  })

  it('模型变了且有在途流 ⇒ 终止(票面要的那一格)', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'gpt-4o',
        currentModel: 'claude-3-5-sonnet',
        hasLiveStream: true,
      }),
    ).toBe(true)
  })
})

describe('terminateActiveStream — 终止动作只允许有一份实现', () => {
  it('没有控制器 ⇒ false,且一个出口都不调(不得凭空回收在途旗)', () => {
    const probe = makeProbe()
    probe.deps.abortRef.current = null
    expect(terminateActiveStream(probe.deps)).toBe(false)
    expect(probe.spy).not.toHaveBeenCalled()
    expect(probe.reclaimed).not.toHaveBeenCalled()
    expect(probe.printed).not.toHaveBeenCalled()
  })

  it('有控制器 ⇒ abort + 回收 isStreaming,并返回 true', () => {
    const probe = makeProbe()
    expect(terminateActiveStream(probe.deps)).toBe(true)
    expect(probe.spy).toHaveBeenCalledTimes(1)
    expect(probe.reclaimed).toHaveBeenCalledTimes(1)
  })

  it('缺省不带 notice ⇒ 静默(用户自己点「停止」那条路径不解释)', () => {
    const probe = makeProbe()
    expect(terminateActiveStream(probe.deps)).toBe(true)
    expect(probe.printed).not.toHaveBeenCalled()
  })

  it('给了 notice 但没给出口 ⇒ 仍完成终止(不得因为印不出提示就不 abort)', () => {
    const probe = makeProbe()
    const silent = { ...probe.deps, notice: '已切换到 X,本轮回答已终止' }
    delete (silent as { showNotice?: (m: string) => void }).showNotice
    expect(terminateActiveStream(silent)).toBe(true)
    expect(probe.reclaimed).toHaveBeenCalledTimes(1)
  })

  it('给了 notice 且有出口 ⇒ 逐字把理由交给出口(不拼第二份中文)', () => {
    const probe = makeProbe()
    expect(
      terminateActiveStream({ ...probe.deps, notice: '已切换到 X,本轮回答已终止' })
    ).toBe(true)
    expect(probe.printed).toHaveBeenCalledWith('已切换到 X,本轮回答已终止')
  })

  it('刻意不置空 abortRef:控制器归该流自己的 onError/onDone 回收', () => {
    const probe = makeProbe()
    terminateActiveStream(probe.deps)
    expect(probe.deps.abortRef.current).toBe(probe.controller)
  })
})

describe('resolveRoundModel — 把 payload 交出去之前的档位复核', () => {
  it('最新档非空 ⇒ 跟到新档(入口快照被作废)', () => {
    expect(resolveRoundModel('gpt-4o', 'claude-3-5-sonnet')).toBe('claude-3-5-sonnet')
  })

  it('最新档为空(回填中间态)⇒ 退回入口档,不把空串送进 provider', () => {
    expect(resolveRoundModel('gpt-4o', '')).toBe('gpt-4o')
  })
})

describe('完整交错时序(两臂,不是只测最顺的那一条)', () => {
  it('流式中换模型 → 终止 → 下一轮带新模型:全程只 abort 一次', () => {
    const state = { model: 'gpt-4o' }
    const probe = makeProbe()

    // ① 用户改档,此刻确有流在跑 ⇒ 判据成立并终止
    const nextModel = 'claude-3-5-sonnet'
    expect(
      shouldTerminateForModelSwitch({
        previousModel: state.model,
        currentModel: nextModel,
        hasLiveStream: Boolean(probe.deps.abortRef.current),
      }),
    ).toBe(true)
    terminateActiveStream({ ...probe.deps, notice: 'switched' })
    state.model = nextModel

    // ② 同一档位被 effect 再跑一遍(重渲染 / 依赖变动都会重跑)不得二次打断
    expect(
      shouldTerminateForModelSwitch({
        previousModel: state.model,
        currentModel: state.model,
        hasLiveStream: Boolean(probe.deps.abortRef.current),
      }),
    ).toBe(false)

    // ③ 下一轮:入口先取到"上一轮"的值,发起前被复核 ⇒ provider 只收到新档
    expect(resolveRoundModel('gpt-4o', state.model)).toBe('claude-3-5-sonnet')
    expect(probe.spy).toHaveBeenCalledTimes(1)
    expect(probe.reclaimed).toHaveBeenCalledTimes(1)
  })

  it('非流式换模型 ⇒ 判据不成立,终止出口零副作用(不误终止)', () => {
    const probe = makeProbe()
    probe.deps.abortRef.current = null
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'gpt-4o',
        currentModel: 'claude-3-5-sonnet',
        hasLiveStream: Boolean(probe.deps.abortRef.current),
      }),
    ).toBe(false)
    expect(terminateActiveStream(probe.deps)).toBe(false)
    expect(probe.spy).not.toHaveBeenCalled()
    expect(probe.reclaimed).not.toHaveBeenCalled()
    expect(probe.printed).not.toHaveBeenCalled()
  })
})

describe('ChatScreen 接线锁(判据在位 ≠ 链路可用,这两组按结构配平判)', () => {
  it('入口快照必须被复核,且 model 与 contextLimit 同取一个 roundModel', () => {
    expect(SCREEN_SOURCE).toMatch(/const roundModel = resolveRoundModel\(model, modelRef\.current\)/)
    expect(SCREEN_SOURCE).toMatch(/await streamChat\(\{\s*\n\s*model: roundModel,/)
    expect(SCREEN_SOURCE).toMatch(/contextLimit: getModelContextCapacity\(roundModel\)/)
    // 反向:发出去的那条 payload 里不得再残留入口快照
    expect(SCREEN_SOURCE).not.toMatch(/contextLimit: getModelContextCapacity\(model\)/)
  })

  it('「停止」按钮与换档 effect 共用同一个终止出口(不得有第二份 abort 实现)', () => {
    expect(SCREEN_SOURCE).toMatch(/const stop = \(\): void => \{\s*\n\s*terminateStream\(\)/)
    expect(SCREEN_SOURCE.match(/abortRef\.current\?\.abort\(\)/g) ?? []).toHaveLength(0)
    expect(SCREEN_SOURCE).toMatch(/terminateActiveStream\(\{/)
    // 「清空对话」此前把 abort + 置空 + 落旗三件事 inline 再写一遍,现同走一个出口
    expect(SCREEN_SOURCE).toMatch(/setPrompt\(''\)\s*\n\s*terminateStream\(\)\s*\n\s*abortRef\.current = null/)
  })

  it('换档 effect 必须过同一张判据表,并带 i18n 键的终止理由(不硬编码中文)', () => {
    expect(SCREEN_SOURCE).toMatch(/shouldTerminateForModelSwitch\(\{/)
    expect(SCREEN_SOURCE).toMatch(/terminateStream\(t\('chat\.modelSwitchStopped', \{ model \}\)\)/)
    expect(SCREEN_SOURCE).toMatch(/modelRef\.current = model/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
