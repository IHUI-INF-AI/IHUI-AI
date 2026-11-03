// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账票 68 小程序腿回归:「流式中切换模型 → 终止后自动带入新模型」判据表。
//
// 判据实现直接从 `../model-switch` 导入(AGENTS §22c:禁止在测试里复制一份判据)。
// 判据表逐条抄自 web 参照件 `apps/web/src/hooks/use-chat/__tests__/model-switch.test.ts`,
// 只去掉本端不存在的三条腿(服务端 abort / #21 中断态 / 压缩预告)—— 那三样在本端没有对应链路,
// 照搬等于给移动端凭空造一条服务端腿;其余每一条断言与 web 同值。
//
// 末两组是"装车证明 + 可达性锁"(守门 70/76/81 反复记过的同一型:机制齐但界面够不到 = 没交付)。
// 端内 vitest 为 `environment: 'node'`(无 jsdom,`@tarojs/components` 渲染级测不到),
// 故接线层用源码结构断言钉住,而不是渲染整页(chat.tsx 1.9k 行,牵 api-client / Taro 存储)。
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  resolveRoundModel,
  shouldTerminateForModelSwitch,
  terminateActiveStream,
  type TerminateStreamDeps,
} from '../model-switch'

interface Probe {
  deps: TerminateStreamDeps
  calls: { abort: number; notice: string[]; cleared: number }
}

function makeProbe(overrides: Partial<TerminateStreamDeps> = {}): Probe {
  const calls = { abort: 0, notice: [] as string[], cleared: 0 }
  // 真 AbortController:靠 signal 计数,不去伪造/强转控制器
  const controller = new AbortController()
  controller.signal.addEventListener('abort', () => {
    calls.abort += 1
  })
  const deps: TerminateStreamDeps = {
    abortRef: { current: controller },
    clearThinkingProgress: () => {
      calls.cleared += 1
    },
    showNotice: (message) => {
      calls.notice.push(message)
    },
    ...overrides,
  }
  return { deps, calls }
}

describe('shouldTerminateForModelSwitch — 该不该因为换档而终止(web 判据表 1:1)', () => {
  it('挂载首帧 / 持久化回填(模型未变)不终止,即使此刻有流在跑', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'a/x',
        currentModel: 'a/x',
        hasLiveStream: true,
      }),
    ).toBe(false)
  })

  it('无在途流时不终止:纯换档不该打断任何东西、也不该弹提示', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: 'a/x',
        currentModel: 'b/y',
        hasLiveStream: false,
      }),
    ).toBe(false)
  })

  it('模型变了且有流 → 终止(票面正例)', () => {
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
  it('没有控制器时返回 false,且一处副作用都不碰(反向锁:凭空打断 + 常驻的"思考中")', () => {
    const probe = makeProbe({ abortRef: { current: null } })
    expect(terminateActiveStream(probe.deps)).toBe(false)
    expect(probe.calls.abort).toBe(0)
    expect(probe.calls.cleared).toBe(0)
    expect(probe.calls.notice).toEqual([])
  })

  it('有流时:abort 一次 + 回收思考中态,返回 true', () => {
    const probe = makeProbe({ notice: 'switched' })
    expect(terminateActiveStream(probe.deps)).toBe(true)
    expect(probe.calls.abort).toBe(1)
    expect(probe.calls.cleared).toBe(1)
    expect(probe.calls.notice).toEqual(['switched'])
  })

  it('只给 notice 不给出口 / 只给出口不给 notice 时都不弹提示(静默 = 用户自己点停止的既有行为)', () => {
    const silent = makeProbe({ notice: undefined })
    expect(terminateActiveStream(silent.deps)).toBe(true)
    expect(silent.calls.notice).toEqual([])

    const noPrinter = makeProbe({ notice: 'switched', showNotice: undefined })
    expect(terminateActiveStream(noPrinter.deps)).toBe(true)
    expect(noPrinter.calls.abort).toBe(1)
  })

  it('反向锁:不得把 abortRef 置空 —— 控制器由该流自己的 finally 回收', () => {
    const probe = makeProbe()
    const before = probe.deps.abortRef.current
    terminateActiveStream(probe.deps)
    expect(probe.deps.abortRef.current).toBe(before)
  })
})

describe('resolveRoundModel — 本轮到底用哪个模型', () => {
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
  it('流式中换模型 → 终止 → 下一轮带新模型:全程只 abort 一次', () => {
    const state = { model: 'a/x' }
    const probe = makeProbe()

    // ① 用户改档,此刻确有流在跑
    const nextModel = 'b/y'
    expect(
      shouldTerminateForModelSwitch({
        previousModel: state.model,
        currentModel: nextModel,
        hasLiveStream: Boolean(probe.deps.abortRef.current),
      }),
    ).toBe(true)
    terminateActiveStream(probe.deps)
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
    expect(resolveRoundModel('a/x', state.model)).toBe('b/y')
    expect(probe.calls.abort).toBe(1)
  })
})

describe('装车证明:判据必须真接在 chat.tsx 主链路上', () => {
  const src = readFileSync(path.resolve(__dirname, '../chat.tsx'), 'utf8').replace(/\r\n/g, '\n')

  it('换档 effect 与停止按钮共用同一个终止出口(端内不得再写第二套 abort)', () => {
    expect(src).toContain("from './model-switch'")
    expect(src).toContain('terminateActiveStream({')
    expect(src).toContain('shouldTerminateForModelSwitch({')
    // 「停止」按钮走 terminateStream,而不是自己摸控制器
    expect(src).toContain('const stopGeneration = useCallback(() => {\n    terminateStream()')
    // 直连 abort 只允许出现在 model-switch 里;chat.tsx 出现第二次 = 有人又写了一套终止逻辑
    expect(src.match(/abortRef\.current\?\.abort\(\)/g) ?? []).toHaveLength(0)
  })

  it('发起前复核档位,且 payload 用的是复核后的值(不是入口快照)', () => {
    expect(src).toContain(
      'const roundModel = resolveRoundModel(currentModel, currentModelRef.current)',
    )
    expect(src).toContain('model: roundModel || undefined')
    expect(src).toContain('contextLimit: roundModel ? getModelContextCapacity(roundModel) : 0')
  })

  it('换档入口在流式中必须真的可达(否则三判据只在单测里成立)', () => {
    const start = src.indexOf('const openModelDrawer = useCallback')
    expect(start).toBeGreaterThan(-1)
    // 只切 openModelDrawer 自己的函数体(到下一个顶层声明为止),不看别人的 thinking 守卫
    const body = src.slice(start, src.indexOf('const ', start + 10))
    expect(body).not.toMatch(/\bthinking\b/)
    expect(src).toContain('onSelect={selectModel}')
  })

  it('model-switch.ts 是纯模块:零 import(不把 Taro / React / i18n 第二份真相写进来)', () => {
    const mod = readFileSync(path.resolve(__dirname, '../model-switch.ts'), 'utf8')
    expect(mod).not.toMatch(/^import\s/m)
    expect(mod).not.toMatch(/@tarojs\/taro|from '@\/i18n'/)
  })

  it('notice 通道现已接通:换档终止必须给得出看得见的理由,而停止按钮仍静默', () => {
    const probe = makeProbe()
    expect(terminateActiveStream(probe.deps)).toBe(true)
    expect(probe.calls.notice).toEqual([])
    // 接线侧锁语义而非字节形(prettier 一折行,字面量锁就变成与正确性无关的假红):
    // 换档 effect 走 t() 取键,不塞自造中文;停止按钮不传 notice。
    expect(src).toMatch(/terminateStream\(\s*\n?\s*t\(\s*'chat\.modelSwitchStopped',\s*\{\s*model:\s*currentModel\s*\}\s*\)\s*\n?\s*\)/)
    expect(src).toMatch(/const stopGeneration = useCallback\(\(\) => \{\s*\n\s*terminateStream\(\)/)
    expect(src).not.toMatch(/terminateStream\(\s*'[^']*已终止/)
  })

  it('chat.modelSwitchStopped 在五语言词包里齐备(§19:新增状态词必须同批补齐五语言)', () => {
    for (const l of ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']) {
      const pack = JSON.parse(
        readFileSync(
          path.resolve(__dirname, '../../../../../../packages/i18n/messages/miniapp-taro', `${l}.json`),
          'utf8',
        ),
      )
      expect(typeof pack.chat?.modelSwitchStopped, l).toBe('string')
      expect(pack.chat.modelSwitchStopped, l).toContain('{model}')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
