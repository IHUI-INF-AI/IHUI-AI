// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 滚动权账目纯函数单测(2026-09-27 立)。
 *
 * 每条判据都配**成对**正反例;其中三对是同一形态只换一个来源/换一个调用时机
 * 就必须反转结论 —— 那才是本次载体替换(瞬时几何快照 → 用户意图账目)的实质:
 * - `reconcileAuthority`:同样的"距底 400px",`source:'user'` 解除跟随、
 *   `source:'programmatic'` / `'layout'` 原样保持(见 authority-source-inversion 组)。
 * - `reconcileAuthorityAtCommit`:同一份"内容被撑高、scrollTop 一动没动"的读数,
 *   喂滚动事件判据会解除跟随,喂 commit 判据必须保持(见 commit-vs-scroll 组)。
 * - `wheelScrollIntent` vs `touchScrollIntent`:同为 +120,一个是"靠近底部"、
 *   另一个是"阅读更早内容"(坐标轴方向相反,见 intent-axis 组)。
 */
import { describe, it, expect } from 'vitest'

import {
  BOTTOM_DETACH_PX,
  BOTTOM_REATTACH_PX,
  HISTORY_PREFETCH_MIN_TRIGGER_PX,
  anchorActionForContentChange,
  distanceToBottom,
  followingAtSessionStart,
  historyPrefetchTriggerPx,
  isAtBottom,
  keyboardScrollIntent,
  prependScrollAdjustment,
  reconcileAuthority,
  reconcileAuthorityAtCommit,
  resolveScrollEventSource,
  shouldTriggerHistoryLoad,
  touchScrollIntent,
  wheelScrollIntent,
  type ScrollAuthority,
  type ScrollMetrics,
} from './scroll-authority'

/** 一屏 200px、内容 1000px 的容器;`scrollTop` 决定离底多远。 */
function metricsAt(scrollTop: number, over?: Partial<ScrollMetrics>): ScrollMetrics {
  return { scrollTop, viewportHeight: 200, contentHeight: 1000, ...over }
}

const FOLLOWING: ScrollAuthority = { following: true }
const RELEASED: ScrollAuthority = { following: false }

describe('distanceToBottom / isAtBottom', () => {
  it('正例:贴到最底部时距底为 0 且判定为"在底"', () => {
    // 1000 - 200 - 800 = 0
    expect(distanceToBottom(metricsAt(800))).toBe(0)
    expect(isAtBottom(metricsAt(800))).toBe(true)
  })

  it('反例:距底 400px 不落在任何底部档位内', () => {
    expect(distanceToBottom(metricsAt(400))).toBe(400)
    expect(isAtBottom(metricsAt(400))).toBe(false)
  })

  it('内容不足一屏时距底不得为负(取 max 的意义)', () => {
    expect(distanceToBottom(metricsAt(0, { contentHeight: 120, viewportHeight: 200 }))).toBe(0)
  })
})

describe('followingAtSessionStart', () => {
  it('打开会话从跟随态起算(定位到最新消息)', () => {
    expect(followingAtSessionStart()).toEqual({ following: true })
  })
})

describe('reconcileAuthority — 滚动事件后的滚动权裁决', () => {
  it('来源反转:同为"距底 400",用户输入解除跟随,程序化/布局一律保持', () => {
    const event = { metrics: metricsAt(400), lastObservedScrollTop: 800 }
    expect(
      reconcileAuthority({ current: FOLLOWING, event: { ...event, source: 'user' } }).authority,
    ).toEqual({ following: false })
    // 换成程序化/布局来源:同一份读数,结论必须反过来
    expect(
      reconcileAuthority({
        current: FOLLOWING,
        event: { ...event, source: 'programmatic' },
      }).authority,
    ).toEqual({ following: true })
    expect(
      reconcileAuthority({ current: FOLLOWING, event: { ...event, source: 'layout' } }).authority,
    ).toEqual({ following: true })
  })

  it('明确上翻:即使落点仍在底部档位内也必须立即解除', () => {
    const result = reconcileAuthority({
      current: FOLLOWING,
      event: { source: 'user', metrics: metricsAt(800), intent: 'awayFromBottom', lastObservedScrollTop: 800 },
    })
    expect(result.authority).toEqual({ following: false })
  })

  it('非滚动输入(intent none)不构成夺权理由,following 原样保持', () => {
    const result = reconcileAuthority({
      current: FOLLOWING,
      event: { source: 'user', metrics: metricsAt(0), intent: 'none', lastObservedScrollTop: 800 },
    })
    expect(result.authority).toEqual({ following: true })
  })

  it('明确下翻:回到底部档位才恢复跟随,半途停住仍算未恢复', () => {
    const toBottom = reconcileAuthority({
      current: RELEASED,
      event: { source: 'user', metrics: metricsAt(790), intent: 'towardBottom', lastObservedScrollTop: 400 },
    })
    expect(toBottom.authority).toEqual({ following: true })
    const stillUp = reconcileAuthority({
      current: RELEASED,
      event: { source: 'user', metrics: metricsAt(400), intent: 'towardBottom', lastObservedScrollTop: 380 },
    })
    expect(stillUp.authority).toEqual({ following: false })
  })

  it('滞回带内不翻转:距底 100px 时跟随与解除两侧各自保持当前态', () => {
    // 距底 = contentHeight - viewportHeight - scrollTop = 100px,恰在 REATTACH(70) 与 DETACH(120) 之间
    const bandMetrics = metricsAt(1000 - 200 - 100)
    expect(distanceToBottom(bandMetrics)).toBe(100)
    expect(
      reconcileAuthority({
        current: FOLLOWING,
        event: { source: 'user', metrics: bandMetrics, lastObservedScrollTop: bandMetrics.scrollTop },
      }).authority,
    ).toEqual({ following: true })
    expect(
      reconcileAuthority({
        current: RELEASED,
        event: { source: 'user', metrics: bandMetrics, lastObservedScrollTop: bandMetrics.scrollTop },
      }).authority,
    ).toEqual({ following: false })
    // 阈值本身也钉住:滞回带必须仍是 70 / 120(与改动前的 LOWER/UPPER 同值)
    expect([BOTTOM_REATTACH_PX, BOTTOM_DETACH_PX]).toEqual([70, 120])
  })

  it('归因不明的位移:scrollTop 明显回退即判上翻,亚像素抖动不判', () => {
    const regressed = reconcileAuthority({
      current: FOLLOWING,
      event: { source: 'user', metrics: metricsAt(700), lastObservedScrollTop: 800 },
    })
    expect(regressed.authority).toEqual({ following: false })
    const jitter = reconcileAuthority({
      current: FOLLOWING,
      event: { source: 'user', metrics: metricsAt(799.5), lastObservedScrollTop: 800 },
    })
    expect(jitter.authority).toEqual({ following: true })
  })

  it('几何账目:不改 following 的两类来源,observedScrollTop 仍必须更新', () => {
    const programmatic = reconcileAuthority({
      current: FOLLOWING,
      event: { source: 'programmatic', metrics: metricsAt(400), lastObservedScrollTop: 800 },
    })
    expect(programmatic.authority).toEqual({ following: true })
    expect(programmatic.observedScrollTop).toBe(400)
    const layout = reconcileAuthority({
      current: FOLLOWING,
      event: { source: 'layout', metrics: metricsAt(123), lastObservedScrollTop: 800 },
    })
    expect(layout.observedScrollTop).toBe(123)
  })
})

describe('reconcileAuthorityAtCommit — 贴底动作前的对账', () => {
  it('commit-vs-scroll 反转:流式撑高(scrollTop 未动、距底 400)在 commit 判据下不得夺权', () => {
    const grown = metricsAt(800, { contentHeight: 1200 }) // 距底 1200-200-800 = 200 > DETACH(120)
    expect(distanceToBottom(grown)).toBe(200)
    expect(
      reconcileAuthorityAtCommit({
        current: FOLLOWING,
        metrics: grown,
        intent: null,
        lastObservedScrollTop: 800,
      }).authority,
    ).toEqual({ following: true })
    // 同一份读数喂滚动事件判据(落点即证据)就会解除跟随 —— 两把尺子的分工不是重复实现
    expect(
      reconcileAuthority({
        current: FOLLOWING,
        event: { source: 'user', metrics: grown, lastObservedScrollTop: 800 },
      }).authority,
    ).toEqual({ following: false })
  })

  it('事件层已记到上滚:scroll 事件尚未派发,同一次 commit 也必须让位', () => {
    const result = reconcileAuthorityAtCommit({
      current: FOLLOWING,
      metrics: metricsAt(800),
      intent: 'awayFromBottom',
      lastObservedScrollTop: 800,
    })
    expect(result.authority).toEqual({ following: false })
  })

  it('intent 为 none / null 时保持;unknown 只承认 scrollTop 回退这一种证据', () => {
    const farFromBottom = metricsAt(800, { contentHeight: 2000 })
    expect(
      reconcileAuthorityAtCommit({
        current: FOLLOWING,
        metrics: farFromBottom,
        intent: 'none',
        lastObservedScrollTop: 800,
      }).authority,
    ).toEqual({ following: true })
    expect(
      reconcileAuthorityAtCommit({
        current: FOLLOWING,
        metrics: metricsAt(760),
        intent: 'unknown',
        lastObservedScrollTop: 800,
      }).authority,
    ).toEqual({ following: false })
    expect(
      reconcileAuthorityAtCommit({
        current: FOLLOWING,
        metrics: metricsAt(800),
        intent: 'unknown',
        lastObservedScrollTop: 800,
      }).authority,
    ).toEqual({ following: true })
  })

  it('commit 对账同样更新几何账目', () => {
    const result = reconcileAuthorityAtCommit({
      current: FOLLOWING,
      metrics: metricsAt(640),
      intent: null,
      lastObservedScrollTop: 800,
    })
    expect(result.observedScrollTop).toBe(640)
  })
})

describe('anchorActionForContentChange — 内容变化后的动作(行为变更登记点)', () => {
  it('行为变更正证:用户已解除跟随时,新消息也不得拉回底部', () => {
    expect(
      anchorActionForContentChange({ authority: RELEASED, isNewMessage: true, isStreaming: false }),
    ).toBe('hold')
    expect(
      anchorActionForContentChange({ authority: RELEASED, isNewMessage: true, isStreaming: true }),
    ).toBe('hold')
    expect(
      anchorActionForContentChange({ authority: RELEASED, isNewMessage: false, isStreaming: true }),
    ).toBe('hold')
  })

  it('主路径不受影响:用户本来就在底部时,新消息与流式增量照常贴底', () => {
    expect(
      anchorActionForContentChange({ authority: FOLLOWING, isNewMessage: true, isStreaming: false }),
    ).toBe('stickToBottom')
    expect(
      anchorActionForContentChange({ authority: FOLLOWING, isNewMessage: false, isStreaming: true }),
    ).toBe('stickToBottom')
    expect(
      anchorActionForContentChange({
        authority: FOLLOWING,
        isNewMessage: false,
        isStreaming: false,
      }),
    ).toBe('stickToBottom')
  })
})

describe('resolveScrollEventSource — 来源归类(只管 DOM scroll 事件)', () => {
  // 程序化贴底的位移只能"朝前"(把位置推向底部),所以正例的 scrollTop 必须大于上次记账值
  const forward = { metrics: metricsAt(400), lastObservedScrollTop: 200 }

  it('用户输入凭据优先于程序化窗口(窗口不得吞掉用户)', () => {
    expect(
      resolveScrollEventSource({ ...forward, userIntent: 'awayFromBottom', programmaticWindowActive: true }),
    ).toBe('user')
  })

  it('无用户凭据 + 程序化窗口在用 + 位移朝前 ⇒ programmatic', () => {
    expect(resolveScrollEventSource({ ...forward, userIntent: null, programmaticWindowActive: true })).toBe(
      'programmatic',
    )
  })

  it('反转例:窗口在用但位移并未前进 ⇒ 判用户(窗口不是"一段时间内一律不算数")', () => {
    // 原地(scrollTop 与上次记账值相同):真实浏览器里我方贴底不会产生这种位移
    expect(
      resolveScrollEventSource({
        metrics: metricsAt(400),
        lastObservedScrollTop: 400,
        userIntent: null,
        programmaticWindowActive: true,
      }),
    ).toBe('user')
    // 回退:同样是"不可能是我方贴底造成的"
    expect(
      resolveScrollEventSource({
        metrics: metricsAt(400),
        lastObservedScrollTop: 800,
        userIntent: null,
        programmaticWindowActive: true,
      }),
    ).toBe('user')
  })

  it('intent none 不算用户凭据(不得据此把布局位移洗成用户滚动)', () => {
    expect(
      resolveScrollEventSource({ ...forward, userIntent: 'none', programmaticWindowActive: true }),
    ).toBe('programmatic')
  })

  it('既无凭据也无窗口 ⇒ 归给用户(按落点判定,保住"滚动条拖动也能解除跟随")', () => {
    expect(resolveScrollEventSource({ ...forward, userIntent: null, programmaticWindowActive: false })).toBe(
      'user',
    )
  })
})

describe('事件层意图:wheel / touch / 按键', () => {
  it('intent-axis 反转:同为 +120,wheel 是"靠近底部",touch 是"阅读更早内容"', () => {
    expect(wheelScrollIntent(120)).toBe('towardBottom')
    expect(touchScrollIntent(300, 420)).toBe('awayFromBottom')
  })

  it('wheel:负值上翻、正值下翻、零位移不构成意图', () => {
    expect(wheelScrollIntent(-120)).toBe('awayFromBottom')
    expect(wheelScrollIntent(0)).toBe('none')
  })

  it('touch:手指上移下翻、位移为零不构成意图', () => {
    expect(touchScrollIntent(420, 300)).toBe('towardBottom')
    expect(touchScrollIntent(300, 300)).toBe('none')
  })

  it('按键:PageUp/PageDown/Space 计入,自有导航拦下的 ArrowUp 不计入(它不产生原生滚动)', () => {
    expect(keyboardScrollIntent({ key: 'PageUp', shiftKey: false, editableTarget: false })).toBe(
      'awayFromBottom',
    )
    expect(keyboardScrollIntent({ key: 'PageDown', shiftKey: false, editableTarget: false })).toBe(
      'towardBottom',
    )
    expect(keyboardScrollIntent({ key: ' ', shiftKey: false, editableTarget: false })).toBe(
      'towardBottom',
    )
    expect(keyboardScrollIntent({ key: ' ', shiftKey: true, editableTarget: false })).toBe(
      'awayFromBottom',
    )
    expect(keyboardScrollIntent({ key: 'ArrowUp', shiftKey: false, editableTarget: false })).toBe(
      'none',
    )
  })

  it('按键:输入控件内的空格属于打字,不构成列表滚动意图', () => {
    expect(keyboardScrollIntent({ key: ' ', shiftKey: false, editableTarget: true })).toBe('none')
  })
})

describe('prependScrollAdjustment — 确定性前插锚点', () => {
  it('正例:首行 key 变小 ⇒ 按绝对视口偏移给出正平移', () => {
    const outcome = prependScrollAdjustment<string>({
      firstRowKeyBefore: 'm5',
      firstRowKeyAfter: 'm1',
      savedOffset: 8,
      anchorOffsetAfter: 2408,
      currentScrollTop: 100,
    })
    expect(outcome).toEqual({ kind: 'adjust', delta: 2300 })
  })

  it('中间位移不得重复计入:触发到提交之间 scrollTop 已被改写过,平移量不变', () => {
    // 同一份前插,virtualizer 抢先把 scrollTop 从 100 抬到 300 ⇒ 锚点在内容中的偏移也 +200
    const before = prependScrollAdjustment<string>({
      firstRowKeyBefore: 'm5',
      firstRowKeyAfter: 'm1',
      savedOffset: 8,
      anchorOffsetAfter: 2408,
      currentScrollTop: 100,
    })
    const after = prependScrollAdjustment<string>({
      firstRowKeyBefore: 'm5',
      firstRowKeyAfter: 'm1',
      savedOffset: 8,
      anchorOffsetAfter: 2608,
      currentScrollTop: 300,
    })
    expect(before).toEqual(after)
  })

  it('反例(追加):首行 key 未变 ⇒ 一律不动', () => {
    expect(
      prependScrollAdjustment<string>({
        firstRowKeyBefore: 'm5',
        firstRowKeyAfter: 'm5',
        savedOffset: 8,
        anchorOffsetAfter: 2408,
        currentScrollTop: 100,
      }),
    ).toEqual({ kind: 'hold', reason: 'first-row-unchanged' })
  })

  it('反例(清空 / 首帧):任一侧没有行 ⇒ 不动', () => {
    expect(
      prependScrollAdjustment<string>({
        firstRowKeyBefore: 'm5',
        firstRowKeyAfter: null,
        savedOffset: 8,
        anchorOffsetAfter: 2408,
        currentScrollTop: 100,
      }),
    ).toEqual({ kind: 'hold', reason: 'no-rows' })
    expect(
      prependScrollAdjustment<string>({
        firstRowKeyBefore: null,
        firstRowKeyAfter: 'm1',
        savedOffset: 8,
        anchorOffsetAfter: 2408,
        currentScrollTop: 100,
      }),
    ).toEqual({ kind: 'hold', reason: 'no-rows' })
  })

  it('反例(替换 / 锚点量不到)与反例(窗口上方的行被删掉 ⇒ 非正平移)', () => {
    expect(
      prependScrollAdjustment<string>({
        firstRowKeyBefore: 'm5',
        firstRowKeyAfter: 'x1',
        savedOffset: 8,
        anchorOffsetAfter: null,
        currentScrollTop: 100,
      }),
    ).toEqual({ kind: 'hold', reason: 'anchor-unmeasurable' })
    expect(
      prependScrollAdjustment<string>({
        firstRowKeyBefore: 'm5',
        firstRowKeyAfter: 'm9',
        savedOffset: 8,
        anchorOffsetAfter: 208,
        currentScrollTop: 300,
      }),
    ).toEqual({ kind: 'hold', reason: 'not-a-prepend' })
  })

  it('非有限读数 ⇒ 判不出,不动滚动位置(绝不用 NaN 去写 scrollTop)', () => {
    expect(
      prependScrollAdjustment<string>({
        firstRowKeyBefore: 'm5',
        firstRowKeyAfter: 'm1',
        savedOffset: Number.NaN,
        anchorOffsetAfter: 2408,
        currentScrollTop: 100,
      }),
    ).toEqual({ kind: 'hold', reason: 'non-finite' })
  })
})

describe('历史补页阈值', () => {
  it('正例:阈值按视口高推(两个视口),不再固定 60px', () => {
    expect(historyPrefetchTriggerPx(800)).toBe(1600)
    expect(shouldTriggerHistoryLoad({ scrollTop: 1500, triggerPx: 1600, canLoad: true, loading: false })).toBe(true)
  })

  it('反例:视口量不到时退化为下限档而非 0;在途 / 无可拉 / 未达阈值都不触发', () => {
    expect(historyPrefetchTriggerPx(0)).toBe(HISTORY_PREFETCH_MIN_TRIGGER_PX)
    expect(historyPrefetchTriggerPx(Number.NaN)).toBe(HISTORY_PREFETCH_MIN_TRIGGER_PX)
    expect(historyPrefetchTriggerPx(20)).toBe(HISTORY_PREFETCH_MIN_TRIGGER_PX)
    expect(shouldTriggerHistoryLoad({ scrollTop: 10, triggerPx: 1600, canLoad: false, loading: false })).toBe(false)
    expect(shouldTriggerHistoryLoad({ scrollTop: 10, triggerPx: 1600, canLoad: true, loading: true })).toBe(false)
    expect(shouldTriggerHistoryLoad({ scrollTop: 1700, triggerPx: 1600, canLoad: true, loading: false })).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
