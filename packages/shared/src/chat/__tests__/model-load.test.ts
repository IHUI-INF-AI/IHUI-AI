// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// D59 模型负载与排队条 —— 判定层用例(G-73)。
//
// 六条主线:
//   ① 负载三级:每级独立标题键,穷尽 switch 零 default 由 tsc 守住
//      (漏一级 assertNeverLevel 处编译失败),再用 Record 钉一次编译期穷尽;
//   ② 排队条五态:每态独立文案键;缺数据返 null 不硬塞(mayQueue 无档位 /
//      slowLane 无有效排位 / waitingEstimate 分不了档一律 null);
//   ③ waitBucket 全边界(验收硬项):59s/60s/61s/9m59s/10m/10m1s 逐钉,
//      负数 / NaN / Infinity / undefined → null 不抛异常;
//   ④ 排位插值:n<=0 给 null 不显示「第 0 位」;小数向下取整不虚增排位;
//   ⑤ 「不充值可用心智」正反例(本票灵魂):免费档可用 + 非低负载 = 诱导风险;
//      低负载 / 免费档不可用 → 不判诱导;
//   ⑥ 帧 → 五态派发:优先级 recovering > fastPass > slowLane > waitingEstimate
//      > mayQueue;空帧 / 全字段无效 → null(反假数据核心负例)。

import { describe, expect, it } from 'vitest'

import {
  MODEL_LOAD_LEVELS,
  QUEUE_BAR_STATES,
  WAIT_BUCKETS,
  isLoadInducementRisk,
  isModelLoadLevel,
  loadLevelKey,
  loadLevelView,
  queueBarView,
  queuePositionView,
  queueStateFromFrame,
  waitBucket,
  waitBucketKey,
  type ModelLoadFrame,
  type ModelLoadLevel,
  type QueueBarState,
} from '../model-load'

describe('D59 负载三级', () => {
  it('三级各有标题键,loadLevelView 穷尽派发', () => {
    const all: Record<ModelLoadLevel, true> = { low: true, medium: true, high: true }
    for (const level of MODEL_LOAD_LEVELS) {
      expect(all[level], level).toBe(true)
      const view = loadLevelView(level)
      expect(view.level).toBe(level)
      expect(view.titleKey).toBe(`load.${level}`)
      expect(loadLevelKey(level)).toBe(`load.${level}`)
    }
  })

  it('isModelLoadLevel:合法档位收下,垃圾值返 false(不硬塞)', () => {
    for (const level of MODEL_LOAD_LEVELS) expect(isModelLoadLevel(level), level).toBe(true)
    for (const bad of ['', 'Low', 'critical', null, undefined, 3]) {
      expect(isModelLoadLevel(bad), String(bad)).toBe(false)
    }
  })
})

describe('D59 排队条五态', () => {
  it('五态常量对齐任务原文五段,穷尽由 Record 钉一次', () => {
    expect([...QUEUE_BAR_STATES]).toEqual([
      'mayQueue',
      'slowLane',
      'fastPass',
      'recovering',
      'waitingEstimate',
    ])
    const all: Record<QueueBarState, true> = {
      mayQueue: true,
      slowLane: true,
      fastPass: true,
      recovering: true,
      waitingEstimate: true,
    }
    for (const state of QUEUE_BAR_STATES) expect(all[state], state).toBe(true)
  })

  it('mayQueue:按档位取 load.<level> 文案;无档位 → null 不猜档', () => {
    expect(queueBarView('mayQueue', { loadLevel: 'high' })?.labelKey).toBe('load.high')
    expect(queueBarView('mayQueue', { loadLevel: 'medium' })?.labelKey).toBe('load.medium')
    expect(queueBarView('mayQueue', { loadLevel: null })).toBeNull()
    expect(queueBarView('mayQueue', {})).toBeNull()
  })

  it('slowLane:排位插值;排位无效 → null(不显示「第 0 位」)', () => {
    const view = queueBarView('slowLane', { position: 3 })
    expect(view).not.toBeNull()
    expect(view?.labelKey).toBe('slowLane')
    expect(view?.position).toBe(3)
    expect(queueBarView('slowLane', { position: 0 })).toBeNull()
    expect(queueBarView('slowLane', { position: -2 })).toBeNull()
    expect(queueBarView('slowLane', {})).toBeNull()
  })

  it('fastPass / recovering:状态陈述,恒有视图', () => {
    expect(queueBarView('fastPass', {})?.labelKey).toBe('fastPass')
    expect(queueBarView('recovering', {})?.labelKey).toBe('recovering')
  })

  it('waitingEstimate:按分档取词;分不了档 → null', () => {
    expect(queueBarView('waitingEstimate', { waitMs: 30_000 })?.labelKey).toBe('wait.under1min')
    expect(queueBarView('waitingEstimate', { waitMs: 60_000 })?.labelKey).toBe('wait.about1min')
    const nView = queueBarView('waitingEstimate', { waitMs: 300_000 })
    expect(nView?.labelKey).toBe('wait.aboutNmin')
    expect(nView?.minutes).toBe(5)
    expect(queueBarView('waitingEstimate', { waitMs: 600_000 })?.labelKey).toBe('wait.over10min')
    expect(queueBarView('waitingEstimate', { waitMs: NaN })).toBeNull()
    expect(queueBarView('waitingEstimate', {})).toBeNull()
  })
})

describe('D59 waitBucket 全边界(验收硬项)', () => {
  it('四档边界逐钉:59s / 60s / 61s / 9m59s / 10m / 10m1s', () => {
    expect(waitBucket(59_000)).toBe('under1min')
    expect(waitBucket(60_000)).toBe('about1min')
    expect(waitBucket(61_000)).toBe('about1min')
    expect(waitBucket(119_999)).toBe('about1min')
    expect(waitBucket(120_000)).toBe('aboutNmin')
    expect(waitBucket(599_000)).toBe('aboutNmin')
    expect(waitBucket(600_000)).toBe('over10min')
    expect(waitBucket(601_000)).toBe('over10min')
  })

  it('负数 / NaN / Infinity / undefined / null → null 且不抛异常;0 落 under1min', () => {
    expect(() => waitBucket(-1)).not.toThrow()
    expect(waitBucket(-1)).toBeNull()
    expect(waitBucket(-60_000)).toBeNull()
    expect(waitBucket(NaN)).toBeNull()
    expect(waitBucket(Infinity)).toBeNull()
    expect(waitBucket(-Infinity)).toBeNull()
    expect(waitBucket(undefined)).toBeNull()
    expect(waitBucket(null)).toBeNull()
    expect(waitBucket(0)).toBe('under1min')
  })

  it('四档常量与键名生成器对齐', () => {
    expect([...WAIT_BUCKETS]).toEqual(['under1min', 'about1min', 'aboutNmin', 'over10min'])
    for (const bucket of WAIT_BUCKETS) expect(waitBucketKey(bucket)).toBe(`wait.${bucket}`)
  })
})

describe('D59 排位插值 queuePositionView', () => {
  it('正整数原样;小数向下取整(不四舍五入虚增排位)', () => {
    expect(queuePositionView(1)).toBe(1)
    expect(queuePositionView(7)).toBe(7)
    expect(queuePositionView(2.7)).toBe(2)
    expect(queuePositionView(0.9)).toBeNull()
  })

  it('n<=0 / 非有限 → null 不显示「第 0 位」', () => {
    expect(queuePositionView(0)).toBeNull()
    expect(queuePositionView(-1)).toBeNull()
    expect(queuePositionView(NaN)).toBeNull()
    expect(queuePositionView(Infinity)).toBeNull()
    expect(queuePositionView(undefined)).toBeNull()
    expect(queuePositionView(null)).toBeNull()
  })
})

describe('D59 「不充值可用心智」判据(2026-09-21 三轮口径)', () => {
  it('正例:免费档可用 + 非低负载(含未知负载)→ 诱导风险', () => {
    expect(isLoadInducementRisk({ freeTierAvailable: true, loadLevel: 'high' })).toBe(true)
    expect(isLoadInducementRisk({ freeTierAvailable: true, loadLevel: 'medium' })).toBe(true)
    expect(isLoadInducementRisk({ freeTierAvailable: true, loadLevel: null })).toBe(true)
  })

  it('反例:低负载无排队可能;免费档不可用时付费出路是真实出路', () => {
    expect(isLoadInducementRisk({ freeTierAvailable: true, loadLevel: 'low' })).toBe(false)
    expect(isLoadInducementRisk({ freeTierAvailable: false, loadLevel: 'high' })).toBe(false)
    expect(isLoadInducementRisk({ freeTierAvailable: false, loadLevel: null })).toBe(false)
  })

  it('queueBarView 把判据带进视图:免费档可用时 inducementRisk=true', () => {
    expect(queueBarView('mayQueue', { loadLevel: 'high' })?.inducementRisk).toBe(true)
    expect(queueBarView('mayQueue', { loadLevel: 'high', freeTierAvailable: false })?.inducementRisk).toBe(false)
    expect(queueBarView('fastPass', { freeTierAvailable: true, loadLevel: 'high' })?.inducementRisk).toBe(true)
  })
})

describe('D59 帧 → 五态派发(与 D34 对接形状)', () => {
  it('优先级:recovering > fastPass > slowLane > waitingEstimate > mayQueue', () => {
    expect(queueStateFromFrame({ recovering: true })).toBe('recovering')
    expect(queueStateFromFrame({ recovering: true, lane: 'fast', queuePosition: 2 })).toBe('recovering')
    expect(queueStateFromFrame({ lane: 'fast' })).toBe('fastPass')
    expect(queueStateFromFrame({ lane: 'fast', queuePosition: 2 })).toBe('fastPass')
    expect(queueStateFromFrame({ queuePosition: 2 })).toBe('slowLane')
    expect(queueStateFromFrame({ queuePosition: 2, estimatedWaitSeconds: 45 })).toBe('slowLane')
    expect(queueStateFromFrame({ estimatedWaitSeconds: 45 })).toBe('waitingEstimate')
    expect(queueStateFromFrame({ estimatedWaitSeconds: 45, loadLevel: 'high' })).toBe('waitingEstimate')
    expect(queueStateFromFrame({ loadLevel: 'low' })).toBe('mayQueue')
  })

  it('反假数据核心负例:空帧 / 全字段无效 / 非法档位 → null', () => {
    expect(queueStateFromFrame({})).toBeNull()
    expect(queueStateFromFrame({ loadLevel: null, queuePosition: null, lane: null, estimatedWaitSeconds: null, recovering: null })).toBeNull()
    expect(queueStateFromFrame({ loadLevel: 'critical' } as unknown as ModelLoadFrame)).toBeNull()
    expect(queueStateFromFrame({ queuePosition: 0 })).toBeNull()
    expect(queueStateFromFrame({ estimatedWaitSeconds: 0 })).toBeNull()
    expect(queueStateFromFrame({ estimatedWaitSeconds: -3 })).toBeNull()
    expect(queueStateFromFrame({ recovering: false })).toBeNull()
  })

  it('组件入参链路:queueBarView 接 frame 字段可直接出视图', () => {
    const frame = { queuePosition: 4, loadLevel: 'high' as const }
    const state = queueStateFromFrame(frame)
    expect(state).toBe('slowLane')
    expect(queueBarView(state!, { loadLevel: frame.loadLevel, position: frame.queuePosition })?.position).toBe(4)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
