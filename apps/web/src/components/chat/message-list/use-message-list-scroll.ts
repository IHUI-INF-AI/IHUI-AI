// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import type { ChatMessage } from '@/stores/chat'
import { useChatStore } from '@/stores/chat'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import {
  BOTTOM_REATTACH_PX,
  anchorActionForContentChange,
  followingAtSessionStart,
  historyPrefetchTriggerPx,
  prependScrollAdjustment,
  reconcileAuthority,
  reconcileAuthorityAtCommit,
  resolveScrollEventSource,
  shouldTriggerHistoryLoad,
  wheelScrollIntent,
  touchScrollIntent,
  keyboardScrollIntent,
  distanceToBottom,
  type ScrollAuthority,
  type ScrollEventSource,
  type ScrollMetrics,
  type UserScrollIntent,
} from './scroll-authority'

// #7 虚拟滚动配置(2026-07-25 立):消息数超过阈值时启用窗口化渲染
// - ESTIMATED_ITEM_HEIGHT:消息平均高度估计值,用于初始 padding 计算
// - VIRTUAL_THRESHOLD:超过此条数启用虚拟滚动(60 条以下全量渲染,保留流畅性)
// - BUFFER:上下各多渲染的缓冲条数,减少快速滚动时的白屏
// - heightMap:ResizeObserver 测量的真实高度映射,滚动时用真实累积高度精确定位
const ESTIMATED_ITEM_HEIGHT = 160
const VIRTUAL_THRESHOLD = 60
const BUFFER = 6
// 2026-09-27 改:补页触发不再写死 60px —— 见 scroll-authority.historyPrefetchTriggerPx
// (按视口高推两屏,网络与渲染应在用户抵达窗口边界前完成;60px 那一档用户必然先撞到边界)

/**
 * 已脱离窗口的测量值保留上限(LRU 淘汰只从"已卸载"的那批里逐)。
 * 量级依据:一屏 ≈ 视口高 / ESTIMATED_ITEM_HEIGHT(160px) ≈ 5 行,加上下各 BUFFER=6
 * 即一帧渲染约 17 行;600 条 ≈ 35 个窗口的滚动历史,滚回去那么远仍不会掉档。
 * 每条 Map 槽 ≈ 一个字符串键 + 一个 number(约 80–120 B)⇒ 上限占 ~50–70 KB,
 * 而上限存在的理由正是"会话可以无限长":不设上限就是按消息数线性长内存。
 */
const MEASURED_HEIGHT_CACHE_MAX = 600

/**
 * 程序化滚动窗口时长:一次 scrollIntoView({behavior:'smooth'}) 的动画期间派发的
 * scroll 事件必须归为 programmatic(否则自己产生的位移被读成"用户上翻")。
 * 取 600ms 覆盖 smooth 动画 + 一帧回读;窗口只在"没有用户输入凭据"时才生效,
 * 且 scrollTop 一旦回退就立刻判用户(scroll-authority.resolveScrollEventSource),
 * 所以它的失效方向是"少吞掉一次用户意图",不是"多吞一次"。
 */
const PROGRAMMATIC_SCROLL_WINDOW_MS = 600

/**
 * 事件层意图的有效窗:一次滚轮/触摸会派发多枚 scroll 事件(惯性、smooth 中间帧),
 * 窗口须覆盖到最后一枚;超出窗口就按"归因不明"处理,不会把布局位移误判成用户。
 */
const USER_INTENT_TTL_MS = 400

/** 待补偿的前插锚点最多跨几次 commit(超过即视为已失效,不再拿旧锚点动 scrollTop)。 */
const PENDING_ANCHOR_MAX_COMMITS = 8

/** 层栈 id(见 @/lib/overlay-stack):消息键盘导航焦点层,挂载即为一层、卸载即出栈 */
const MESSAGE_LIST_KEYBOARD_NAV_OVERLAY_ID = 'message-list-keyboard-nav'

export interface MessageListScrollOptions {
  messages: ChatMessage[]
  isStreaming: boolean
  hasMoreHistory?: boolean
  loadingMoreHistory?: boolean
  onLoadMoreHistory?: () => void
}

export interface MessageListScrollResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  bottomRef: React.RefObject<HTMLDivElement | null>
  enableVirtual: boolean
  visibleRange: { start: number; end: number }
  computeCumulative: () => { offsets: number[]; total: number }
  measureItem: (id: string) => (el: HTMLElement | null) => void
  /**
   * 滚动记账入口。DOM 的 scroll 事件按零参调用(来源由事件层的用户输入记账 +
   * 程序化滚动窗口现场归类);测高/布局引起的重算必须显式传 `'layout'`,
   * 否则布局位移会被读成用户滚动。
   */
  handleScroll: (source?: ScrollEventSource) => void
  scrollToBottom: () => void
  userScrolledUp: boolean
  focusedIndex: number
  isFarFromTop: boolean
  isFarFromBottom: boolean
}

export function useMessageListScroll({
  messages,
  isStreaming,
  hasMoreHistory,
  loadingMoreHistory,
  onLoadMoreHistory,
}: MessageListScrollOptions): MessageListScrollResult {
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const lastContent = messages[messages.length - 1]?.content

  // #7 虚拟滚动状态
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: VIRTUAL_THRESHOLD - 1 })
  // heightMap:messageId → 真实高度(px)。ResizeObserver 持续更新,用于精确计算累积 offset
  const heightMapRef = React.useRef<Map<string, number>>(new Map())
  // 2026-09-27 改:卸载不再删测量值(删了重挂就回落 ESTIMATED_ITEM_HEIGHT 重测 ⇒ 滚动条逐帧跳),
  // 改为把该 id 挂进"已脱离窗口"的 LRU 队列;队列按"最近脱离"排序,超上限时从最久的那端淘汰。
  const detachedIdsRef = React.useRef<Set<string>>(new Set())
  // 滚动权账目(2026-09-27 立,取代原 `userScrolledUpRef: boolean`)。
  // following = 用户是否把滚动权交给列表;只有用户输入能改它(判据见 scroll-authority.ts)。
  const authorityRef = React.useRef<ScrollAuthority>(followingAtSessionStart())
  // 几何账目:上一次记账读到的 scrollTop。程序化/布局位移照样更新它,但不碰 following。
  const observedScrollTopRef = React.useRef(0)
  // 事件层提前记账的用户方向意图(wheel/touch/key),用于补 scroll 事件的"晚一帧"窗口
  const userIntentRef = React.useRef<{ intent: UserScrollIntent; at: number } | null>(null)
  // 本 hook 自己发起的滚动落到哪一档为止(用于把随后几枚 scroll 事件判为 programmatic)
  const programmaticUntilRef = React.useRef(0)
  // 前插历史的位置锚点:触发瞬间存,commit 时刻用(替代原先的 rAF 轮询 scrollHeight)
  const pendingAnchorRef = React.useRef<{
    /** 触发瞬间的首行 key —— 既是"首行 key 是否变小"的比较基准,也是平移量的锚点 */
    anchorKey: string
    /** 触发瞬间该锚点相对视口顶部的偏移(px),即要恢复到的绝对位置 */
    savedOffset: number
    commitsLeft: number
  } | null>(null)
  // 2026-07-28 立:userScrolledUp 状态镜像(用于驱动 jump-to-latest 浮动按钮显隐)
  // - ref 用于在 scroll callback 高频更新时避免整个组件重渲染
  // - state 镜像驱动浮动按钮条件渲染(ref 变化不会触发重渲染)
  // - 用 rAF 节流合并多次 ref 更新 → state 一次,避免抖动
  const userScrolledUp = useChatStore((s) => s.userScrolledUp)
  const setUserScrolledUp = useChatStore((s) => s.setUserScrolledUp)
  // 防御性 null check(测试环境 mock 可能未完整注入 setter)
  // 2026-08-25 useMemo 稳定化:原条件表达式在 setter 缺失时每次渲染新建 () => {},
  // 导致依赖它的 useCallback deps 每帧变化(exhaustive-deps 警告 + 无谓重渲染)。
  const safeSetUserScrolledUp = React.useMemo(
    () => (typeof setUserScrolledUp === 'function' ? setUserScrolledUp : () => {}),
    [setUserScrolledUp],
  )
  // ── 滚动权出口(2026-09-27 立)──────────────────────────────────────────
  // 本 hook 内**唯一**能改滚动权的地方:原先散在 :174 / :367 / :389 三处的
  // `userScrolledUpRef.current = …` 全部改走这里,判据本身住在 scroll-authority.ts。
  // store 镜像(userScrolledUp)由同一出口顺带同步,不再由调用点各写一次。
  const mirroredScrolledUpRef = React.useRef(userScrolledUp)
  const applyAuthority = React.useCallback(
    (next: ScrollAuthority) => {
      authorityRef.current = next
      const mirrored = !next.following
      if (mirrored !== mirroredScrolledUpRef.current) {
        mirroredScrolledUpRef.current = mirrored
        safeSetUserScrolledUp(mirrored)
      }
    },
    [safeSetUserScrolledUp],
  )
  /** 从 DOM 读一份几何量(只在 impure 层做,判据拿到的永远是这个结构的纯数据)。 */
  const readScrollMetrics = React.useCallback((el: HTMLElement): ScrollMetrics => {
    return {
      scrollTop: el.scrollTop,
      viewportHeight: el.clientHeight,
      contentHeight: el.scrollHeight,
    }
  }, [])
  /** 事件层记账:滚动真的发生前就把方向记下来(scroll 事件要到下一帧才派发)。 */
  const recordUserIntent = React.useCallback((intent: UserScrollIntent) => {
    if (intent === 'none') return
    userIntentRef.current = { intent, at: Date.now() }
  }, [])
  const takeUserIntent = React.useCallback((): UserScrollIntent | null => {
    const record = userIntentRef.current
    if (!record) return null
    if (Date.now() - record.at > USER_INTENT_TTL_MS) {
      userIntentRef.current = null
      return null
    }
    return record.intent
  }, [])
  /**
   * 标一段程序化滚动:此后 PROGRAMMATIC_SCROLL_WINDOW_MS 内派发的 scroll 事件
   * 归为 programmatic(只更新几何账目)。落到底部档位即提前收窗。
   */
  const markProgrammaticScroll = React.useCallback(() => {
    programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_WINDOW_MS
  }, [])
  // 2026-07-28 立:键盘导航的 focused message index(-1 = 无聚焦)
  // - ↑/↓ 切换时设置,Enter 展开/折叠 reasoning,Esc 取消聚焦
  // - focused 消息添加 ring 视觉 + data-message-focused 属性
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1)
  // D3(2026-09-18 立):跳顶/跳底按钮显隐所需"距顶/距底是否够远"状态。
  // - 阈值 800px(与 ScrollJumpButtons.JUMP_FAR_THRESHOLD 对齐)
  // - ref 镜像 + 仅在跨阈值时 setState,避免高频 scroll 触发整树重渲染
  const FAR_THRESHOLD = 800
  const isFarFromTopRef = React.useRef(false)
  const isFarFromBottomRef = React.useRef(false)
  const [isFarFromTop, setIsFarFromTop] = React.useState(false)
  const [isFarFromBottom, setIsFarFromBottom] = React.useState(false)
  // 镜像 ref(2026-07-28 立):解决键盘事件连续触发时的 stale closure 问题
  // - useEffect 重装 listener 之前可能多次 keyboard event 排队(测试 act 批量 / 用户狂按)
  // - ref 在键盘 handler 内同步更新,避免 ↑/↓ 后的 Enter/Escape 看不到新 focusedIndex
  // - state 仍用于驱动 UI re-render(focused ring / data-message-focused)
  const focusedIndexRef = React.useRef<number>(-1)

  // 2026-08-02 修复 P1(问题 6-1/6-2):messages 镜像 ref。
  // 原键盘 useEffect 依赖 [messages],每个 token 触发 listener 拆卸/重装,
  // 高频流下每秒数十次 DOM 监听器抖动 + 微秒窗口内按键可能丢失。
  // 改用 ref 镜像后 effect 依赖可去掉 messages,listener 仅挂载一次。
  const messagesRef = React.useRef(messages)
  messagesRef.current = messages
  const setFocusedIndexBoth = React.useCallback((next: number) => {
    focusedIndexRef.current = next
    setFocusedIndex(next)
  }, [])
  const prevMessagesLenRef = React.useRef(0)
  // #9 自动滚动 50ms throttle(2026-07-25 立):
  // 用 setTimeout + timestamp 实现 leading + trailing 节流,避免每个 token 触发 scrollIntoView。
  // - leading:第一次立即滚(新消息到达时视觉跟手)
  // - trailing:50ms 内后续 token 忽略,50ms 边缘补滚一次(保证最后 token 也能滚到底)
  const scrollThrottleRef = React.useRef<{ last: number; timer: number | null }>({
    last: 0,
    timer: null,
  })

  const enableVirtual = messages.length > VIRTUAL_THRESHOLD

  // P1-3 修复(2026-07-28):缓存 offsets/total,仅在 messages.length 或 heightMap 版本变化时重算,
  // 避免每次 scroll 都 O(n) 全量计算(虚拟滚动下 handleScroll 高频触发)。
  // heightMap 版本由 measureItem 递增(新增/删除/高度变化都 +1),
  // 覆盖 size 检测不到的"已有条目高度变化"场景(同 id 消息高度从 200px 变 300px 时 size 不变)。
  const offsetsCacheRef = React.useRef<number[]>([])
  const totalCacheRef = React.useRef<number>(0)
  const lastMessagesLengthRef = React.useRef<number>(0)
  const lastHeightMapVersionRef = React.useRef<number>(0)
  const heightMapVersionRef = React.useRef<number>(0)

  // 计算累积高度数组(用于精确定位可见范围 + padding)
  const computeCumulative = React.useCallback(() => {
    // 缓存命中:messages 数量和 heightMap 版本均未变化,直接返回缓存(避免 O(n) 重算)
    if (
      lastMessagesLengthRef.current === messages.length &&
      lastHeightMapVersionRef.current === heightMapVersionRef.current
    ) {
      return { offsets: offsetsCacheRef.current, total: totalCacheRef.current }
    }
    const map = heightMapRef.current
    let total = 0
    const offsets = new Array(messages.length + 1)
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (!msg) continue
      offsets[i] = total
      total += map.get(msg.id) ?? ESTIMATED_ITEM_HEIGHT
    }
    offsets[messages.length] = total
    // 写入缓存,供下次 scroll 命中
    offsetsCacheRef.current = offsets
    totalCacheRef.current = total
    lastMessagesLengthRef.current = messages.length
    lastHeightMapVersionRef.current = heightMapVersionRef.current
    return { offsets, total }
  }, [messages])

  /**
   * 滚动记账的唯一入口(2026-09-27 改版)。
   *
   * @param source 调用方已知来源时显式传入(测高/布局重算传 `'layout'`);DOM 的 scroll
   *   事件不传,由 `resolveScrollEventSource` 现场按"事件层用户意图 + 程序化窗口 + 位移方向"
   *   归类。滚动权(`following`)只能由用户输入改 —— 判据在 scroll-authority.ts,这里不散写。
   */
  const handleScroll = React.useCallback((source?: ScrollEventSource) => {
    const el = containerRef.current
    if (!el) return

    const metrics = readScrollMetrics(el)
    const distanceFromBottom = distanceToBottom(metrics)
    const userIntent = takeUserIntent()
    const resolvedSource: ScrollEventSource =
      source ??
      resolveScrollEventSource({
        userIntent,
        programmaticWindowActive: Date.now() <= programmaticUntilRef.current,
        metrics,
        lastObservedScrollTop: observedScrollTopRef.current,
      })
    // 滞回两档(120 / 70)是 P0 修复(2026-08-02)定下的防抖契约,数值一字未改,
    // 只是从本文件的 UPPER/LOWER 两个局部量搬进判据层的具名常量。
    const reconciliation = reconcileAuthority({
      current: authorityRef.current,
      event: {
        source: resolvedSource,
        metrics,
        intent: userIntent ?? 'unknown',
        lastObservedScrollTop: observedScrollTopRef.current,
      },
    })
    applyAuthority(reconciliation.authority)
    // 几何账目:**任何**来源都更新(含不改 following 的 programmatic / layout)
    observedScrollTopRef.current = reconciliation.observedScrollTop
    if (resolvedSource === 'programmatic' && distanceFromBottom <= BOTTOM_REATTACH_PX) {
      // 自己发起的贴底已经落地 ⇒ 窗口提前收,后续位移不再被自我豁免
      programmaticUntilRef.current = 0
    }

    // D3(2026-09-18 立):跳顶/跳底按钮显隐阈值(距顶/距底 > 800px)。
    // 用 ref 镜像比对,仅在跨阈值时 setState(避免每次 scroll 都重渲染)
    const farTop = metrics.scrollTop > FAR_THRESHOLD
    const farBottom = distanceFromBottom > FAR_THRESHOLD
    if (farTop !== isFarFromTopRef.current) {
      isFarFromTopRef.current = farTop
      setIsFarFromTop(farTop)
    }
    if (farBottom !== isFarFromBottomRef.current) {
      isFarFromBottomRef.current = farBottom
      setIsFarFromBottom(farBottom)
    }

    // #8 滚到窗口顶部时补页。2026-09-27 改两件事:
    // ① 触发阈值不再写死 60px,改按视口高推两屏(网络与渲染应在用户抵达窗口边界前完成;
    //    60px 那一档用户必然先撞到边界,看到的就是"滚到顶卡一下再跳")。
    // ② 位置恢复改为**确定性锚点**:这里只在触发瞬间存下"首行 key + 它相对视口顶部的偏移",
    //    真正的平移由下面的 useLayoutEffect 在 commit 时刻算(见 prependScrollAdjustment)。
    //    删掉的是原先那套 rAF 轮询 scrollHeight 的写法,它有三处结构性缺陷:
    //    要求高度差 >50px 才补偿(前插不足 50px 永不补偿)、拿触发瞬间的 prevScrollTop 加差值
    //    (触发到提交之间 scrollTop 被改写就把中间位移重复计入)、还带 5s 超时的定时器要管泄漏。
    if (
      !pendingAnchorRef.current &&
      shouldTriggerHistoryLoad({
        scrollTop: metrics.scrollTop,
        triggerPx: historyPrefetchTriggerPx(el.clientHeight),
        canLoad: Boolean(onLoadMoreHistory && hasMoreHistory),
        loading: Boolean(loadingMoreHistory),
      })
    ) {
      const anchorKey = messagesRef.current[0]?.id
      const anchorEl = anchorKey
        ? (el.querySelector(`[data-message-id="${anchorKey}"]`) as HTMLElement | null)
        : null
      if (anchorKey && anchorEl) {
        pendingAnchorRef.current = {
          anchorKey,
          savedOffset: anchorEl.getBoundingClientRect().top - el.getBoundingClientRect().top,
          commitsLeft: PENDING_ANCHOR_MAX_COMMITS,
        }
      }
      onLoadMoreHistory?.()
    }

    // #7 虚拟滚动:计算可见范围
    if (!enableVirtual) return
    const { offsets, total } = computeCumulative()
    if (total === 0) return

    // 二分查找找到 startIndex(第一个 offset > scrollTop - buffer*ESTIMATED)
    const scrollPos = metrics.scrollTop
    const viewportBottom = scrollPos + el.clientHeight
    let start = 0
    let lo = 0,
      hi = messages.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid + 1] < scrollPos - BUFFER * ESTIMATED_ITEM_HEIGHT) lo = mid + 1
      else if (offsets[mid] > scrollPos) hi = mid - 1
      else {
        start = mid
        if (offsets[mid + 1] < scrollPos) lo = mid + 1
        else hi = mid - 1
      }
    }
    start = Math.max(0, start - BUFFER)

    // 找到 endIndex(第一个 offset > viewportBottom + buffer*ESTIMATED)
    let end = start
    while (
      end < messages.length - 1 &&
      offsets[end + 1] < viewportBottom + BUFFER * ESTIMATED_ITEM_HEIGHT
    ) {
      end++
    }
    end = Math.min(messages.length - 1, end + BUFFER)

    setVisibleRange((prev) => {
      if (prev.start === start && prev.end === end) return prev
      return { start, end }
    })
  }, [
    enableVirtual,
    computeCumulative,
    messages.length,
    onLoadMoreHistory,
    hasMoreHistory,
    loadingMoreHistory,
    applyAuthority,
    readScrollMetrics,
    takeUserIntent,
  ])

  // 自动滚动到底部(流式 token 到达 + 新消息)。
  // 2026-09-27 改版:这里不再读"上一次 scroll 事件留下的布尔",而是先做一次
  // **commit 时刻的对账**(reconcileAuthorityAtCommit),再决定动不动 ——
  // scroll 事件在滚动发生后的下一帧才派发,原实现在那一格里拿着过期快照把用户拽回底部。
  // 判据(anchorActionForContentChange)与行为变更登记都在 scroll-authority.ts:
  // **已解除跟随时,新消息也不得拉回**(用户可感知的有意变更;在底部时照常跟随)。
  // #9 50ms throttle(2026-07-25 立)沿用:leading + trailing,避免每个 token 触发 scrollIntoView。
  React.useEffect(() => {
    const newLen = messages.length
    const prevLen = prevMessagesLenRef.current
    const isNewMessage = newLen > prevLen
    prevMessagesLenRef.current = newLen

    const scroller = containerRef.current
    if (scroller) {
      const commitReconciliation = reconcileAuthorityAtCommit({
        current: authorityRef.current,
        metrics: readScrollMetrics(scroller),
        intent: takeUserIntent(),
        lastObservedScrollTop: observedScrollTopRef.current,
      })
      applyAuthority(commitReconciliation.authority)
      observedScrollTopRef.current = commitReconciliation.observedScrollTop
    }

    if (
      anchorActionForContentChange({
        authority: authorityRef.current,
        isNewMessage,
        isStreaming,
      }) === 'hold'
    ) {
      return
    }

    const doScroll = () => {
      const el = bottomRef.current
      if (!el) return
      // 批量加载(切换会话/首次加载,prev=0 且 newLen>1):auto 无动画直接跳底
      // 逐条追加/streaming:smooth 平滑跟随新消息
      const behavior = prevLen === 0 && newLen > 1 ? 'auto' : 'smooth'
      // 来源标记:这一程自己产生的 scroll 事件属于 programmatic,不得被读成"用户上翻"
      markProgrammaticScroll()
      el.scrollIntoView({ behavior, block: 'end' })
    }
    const st = scrollThrottleRef.current
    const now = Date.now()
    const remaining = 50 - (now - st.last)
    if (remaining <= 0) {
      // leading:超过 50ms 未滚,立即滚
      st.last = now
      if (st.timer !== null) {
        clearTimeout(st.timer)
        st.timer = null
      }
      doScroll()
    } else if (st.timer === null) {
      // trailing:50ms 内首次触发,安排 trailing 滚动(后续触发忽略,保证最后 token 也滚)
      st.timer = window.setTimeout(() => {
        st.last = Date.now()
        st.timer = null
        doScroll()
      }, remaining)
    }
  }, [
    messages.length,
    lastContent,
    isStreaming,
    applyAuthority,
    markProgrammaticScroll,
    readScrollMetrics,
    takeUserIntent,
  ])

  // #9 卸载时清理 pending throttle timer(2026-07-25 立)
  React.useEffect(() => {
    const st = scrollThrottleRef.current
    return () => {
      if (st.timer !== null) {
        clearTimeout(st.timer)
        st.timer = null
      }
    }
  }, [])

  // P3 修复:用 dirty 标记合并 rAF,多个消息同时进入视区时一帧只跑一次 handleScroll,
  // 避免每个 measureItem 高度变化都排队独立 rAF(每个 rAF 内 handleScroll 调 computeCumulative O(n))
  const scrollDirtyRef = React.useRef(false)
  const scheduleScrollUpdate = React.useCallback(() => {
    if (scrollDirtyRef.current) return // 已有 pending
    scrollDirtyRef.current = true
    requestAnimationFrame(() => {
      scrollDirtyRef.current = false
      // 显式带来源:这是测高/布局引起的重算,不是用户滚动 ⇒ 只更新几何账目
      handleScroll('layout')
    })
  }, [handleScroll])

  // #8 加载更多历史时保持滚动位置(handleScroll 内已处理)
  // #7 ResizeObserver 测量真实高度并触发重算可见范围
  /**
   * 只在"已脱离窗口"的那批测量里按 LRU 淘汰,绝不逐出正在渲染的行 ——
   * 逐出会立刻改变 computeCumulative 的偏移(那些行还在 messages 里,只是没渲染),
   * 所以版本号和一次重算都要跟着走。
   */
  const evictDetachedMeasurements = React.useCallback(() => {
    const map = heightMapRef.current
    const detached = detachedIdsRef.current
    if (map.size <= MEASURED_HEIGHT_CACHE_MAX) return
    let evicted = false
    for (const id of detached) {
      if (map.size <= MEASURED_HEIGHT_CACHE_MAX) break
      detached.delete(id)
      map.delete(id)
      evicted = true
    }
    if (evicted) heightMapVersionRef.current++
  }, [])

  const measureItem = React.useCallback(
    (id: string) => (el: HTMLElement | null) => {
      const map = heightMapRef.current
      const detached = detachedIdsRef.current
      if (!el) {
        // 2026-09-27 改:卸载不再 map.delete(id)。窗口化列表里"卸载即弃测量"等于
        // 把该行打回 ESTIMATED_ITEM_HEIGHT=160 重测,滚回去时累积高度逐帧变 ⇒
        // 滚动条跳动、可见范围抖动。改为保留测量值 + 挂进脱离队列(按最近脱离排序),
        // 只有超过 MEASURED_HEIGHT_CACHE_MAX 才淘汰。会话切换的清点位在下面(唯一清口)。
        if (map.has(id)) {
          detached.delete(id)
          detached.add(id)
          evictDetachedMeasurements()
        }
        return
      }
      // 重新挂上 ⇒ 它不再是淘汰候选(测量值本身沿用,首帧就能给出正确高度)
      detached.delete(id)
      const h = el.getBoundingClientRect().height
      const prev = map.get(id)
      if (prev !== h) {
        map.set(id, h)
        // P1-3 修复:heightMap 变化时版本号 +1,强制下次 computeCumulative 重算缓存
        // 高度变化后重算可见范围(下一帧,避免布局抖动);用 scheduleScrollUpdate 合并多消息同时变化
        heightMapVersionRef.current++
        scheduleScrollUpdate()
      }
    },
    [evictDetachedMeasurements, scheduleScrollUpdate],
  )

  // 消息列表重置(切换会话)时清空高度映射 + 重置可见范围
  // 2026-09-27:这里是**唯一**的清口 —— 测量缓存/脱离队列/前插锚点/几何与滚动权账目
  // 一并归零,不留"换了会话还拿着上一份账"的第二形态。
  React.useEffect(() => {
    if (messages.length === 0) {
      heightMapRef.current.clear()
      detachedIdsRef.current.clear()
      pendingAnchorRef.current = null
      programmaticUntilRef.current = 0
      userIntentRef.current = null
      observedScrollTopRef.current = 0
      applyAuthority(followingAtSessionStart())
      isFarFromTopRef.current = false
      isFarFromBottomRef.current = false
      setIsFarFromTop(false)
      setIsFarFromBottom(false)
      setVisibleRange({ start: 0, end: VIRTUAL_THRESHOLD - 1 })
    } else if (messages.length <= VIRTUAL_THRESHOLD) {
      setVisibleRange({ start: 0, end: messages.length - 1 })
    }
    // setUserScrolledUp 是 zustand store 稳定引用,无需列入依赖
  }, [messages.length, applyAuthority])

  // 前插历史的位置恢复(2026-09-27 立,取代原先的 rAF 轮询 scrollHeight)。
  // 用 useLayoutEffect:补偿必须发生在这一帧画出来之前,否则用户先看到跳一下。
  React.useLayoutEffect(() => {
    const pending = pendingAnchorRef.current
    if (!pending) return
    const el = containerRef.current
    if (!el) {
      pendingAnchorRef.current = null
      return
    }
    const anchorEl = el.querySelector(
      `[data-message-id="${pending.anchorKey}"]`,
    ) as HTMLElement | null
    const containerTop = el.getBoundingClientRect().top
    // 锚点在**内容**中的偏移 = 视口偏移 + 实时 scrollTop(两者都是此刻现读,
    // 所以触发到提交之间 scrollTop 被谁改写过都不会被重复计入 —— 判据只认绝对目标)
    const anchorOffsetAfter = anchorEl
      ? anchorEl.getBoundingClientRect().top - containerTop + el.scrollTop
      : null
    const outcome = prependScrollAdjustment<string>({
      firstRowKeyBefore: pending.anchorKey,
      firstRowKeyAfter: messages[0]?.id ?? null,
      savedOffset: pending.savedOffset,
      anchorOffsetAfter,
      currentScrollTop: el.scrollTop,
    })
    if (outcome.kind === 'adjust') {
      markProgrammaticScroll()
      el.scrollTop = el.scrollTop + outcome.delta
      observedScrollTopRef.current = el.scrollTop
      pendingAnchorRef.current = null
      return
    }
    // 行被清空 / 锚点已不在 DOM(换会话那种整表替换)⇒ 这个锚点永久失效,立刻丢弃;
    // 其余原因(首行未变 / 非前插 / 读数非有限)只是"这一枚 commit 不是前插",留着等下一次,
    // 但用 commitsLeft 设上界,不让一枚旧锚点在很久以后的 commit 上突然把页面弹一下。
    if (outcome.reason === 'no-rows' || outcome.reason === 'anchor-unmeasurable') {
      pendingAnchorRef.current = null
      return
    }
    pending.commitsLeft -= 1
    if (pending.commitsLeft <= 0) pendingAnchorRef.current = null
  }, [messages, markProgrammaticScroll])

  // 用户输入的事件层记账(2026-09-27 立)。
  // 为什么必须挂在事件层而不是 effect 里:scroll 事件在滚动发生后的**下一帧**才派发,
  // 而贴底判断发生在 React commit 时刻 —— 中间那格只有事件层留下的方向能证明"用户在滚"。
  // 三个 listener 全部 passive(只记账,不拦截、不 preventDefault),且刻意挂在 window 上:
  // 容器节点会随 MessageList 的早退分支挂载/卸载,挂 window + 命中判定比"等节点出现再挂"
  // 少一套重挂逻辑,也不会漏掉首次挂载的那一屏。
  React.useEffect(() => {
    const inContainer = (target: EventTarget | null): boolean => {
      const el = containerRef.current
      if (!el || !(target instanceof Node)) return false
      return el.contains(target)
    }
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
    }
    /**
     * 从一枚 touch 事件里取第一指的纵向坐标。
     * 刻意不写成 `event instanceof TouchEvent`:jsdom/happy-dom 下构造函数可能缺失,
     * 而这里的调用面只关心"有没有一个 clientY"这一件事(结构化取值,不做 instanceof 猜测)。
     */
    const firstTouchClientY = (event: Event): number | null => {
      if (!('touches' in event)) return null
      const touches: unknown = event.touches
      if (typeof touches !== 'object' || touches === null) return null
      const list = touches as ArrayLike<unknown>
      if (list.length === 0) return null
      const first: unknown = list[0]
      if (typeof first !== 'object' || first === null) return null
      const clientY: unknown = (first as { clientY?: unknown }).clientY
      return typeof clientY === 'number' ? clientY : null
    }
    let lastTouchClientY: number | null = null
    const onWheel = (event: Event): void => {
      if (!inContainer(event.target)) return
      if (!('deltaY' in event) || typeof event.deltaY !== 'number') return
      recordUserIntent(wheelScrollIntent(event.deltaY))
    }
    const onTouchStart = (event: Event): void => {
      if (!inContainer(event.target)) return
      lastTouchClientY = firstTouchClientY(event)
    }
    const onTouchMove = (event: Event): void => {
      if (!inContainer(event.target)) return
      const clientY = firstTouchClientY(event)
      if (clientY === null || lastTouchClientY === null) return
      recordUserIntent(touchScrollIntent(lastTouchClientY, clientY))
      lastTouchClientY = clientY
    }
    const onKeyDown = (event: Event): void => {
      if (!('key' in event) || typeof event.key !== 'string') return
      const editableTarget = isEditableTarget(event.target)
      // 键盘滚动作用在"焦点所在的滚动容器"上;焦点不在本容器就不是本列表的滚动意图。
      // 输入控件内的按键要交给 keyboardScrollIntent 判成 none(那是打字,不是滚动)。
      if (!editableTarget && !inContainer(document.activeElement)) return
      recordUserIntent(
        keyboardScrollIntent({
          key: event.key,
          shiftKey: 'shiftKey' in event ? event.shiftKey === true : false,
          editableTarget,
        }),
      )
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKeyDown, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [recordUserIntent])

  // 2026-07-28 立:Jump-to-latest 浮动按钮点击处理(深度对标 AI 工作台)
  // - scrollIntoView 到 bottomRef(平滑)
  // - 重置 userScrolledUp 标记,触发自动滚动继续工作
  // 2026-09-22 收口:此前此处另派发 'ihui:jump-to-latest' 且本 hook 又自行 addEventListener
  // 消费同一事件 ⇒ 每次点击 scrollToBottom 跑两遍;注释声称"由 MessageInput 中的按钮触发",
  // 但全仓 grep 该事件名除本文件自派发外无任何外部生产者/消费者(含 8 端 + packages),
  // 属"生产了没人消费"的孤儿通道,连同重复执行一并删除。
  const scrollToBottom = React.useCallback(() => {
    const el = bottomRef.current
    markProgrammaticScroll()
    // 点「跳到最新」本身就是一次**用户输入**(方向是"靠近底部"),所以这里把滚动权交还给跟随。
    // 几何账目不在此处改写:随后派发的 scroll 事件会自己把落点记进去。
    //
    // **必须先作废上一条用户凭据**:平滑动画会派发消息中间的 scroll 事件,而
    // `resolveScrollEventSource` 的判序是"用户凭据优先于程序化窗口"。上一条
    // `awayFromBottom` 若还在 400ms TTL 里,动画自己的第一帧就会当场把 following 再解除一次
    // —— 真实 Chromium 实测(G-252):流式中上滚后 150ms 内点按钮,列表永久停在距底
    // 244–366px 且不再跟随(用户看到的是"点了没反应、按钮又冒出来");>400ms 点则正常。
    // 方向已经被这次点击改写了,旧凭据不该继续有效,所以清它不是掩盖判据而是修正输入。
    userIntentRef.current = null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' })
    applyAuthority({ following: true })
  }, [applyAuthority, markProgrammaticScroll])

  // 2026-07-28 立(深度对标 AI 工作台):键盘导航 ↑/↓ 切换消息聚焦
  // - 焦点不在 input/textarea/contenteditable 时生效(避免与输入冲突)
  // - ArrowDown / ArrowUp:切换 focused message index
  // - Enter:聚焦消息若含 reasoning → 派发切换事件(由 MessageItem 内部响应)
  // - Escape:清除聚焦
  // - Home/End:跳到首/末条
  // 用 window keydown 监听确保焦点在 message 容器内任意子元素都能响应
  // 2026-09-22 键位归属:↑/↓/Home/End 的唯一持有者是本 hook。首页整屏翻页
  // (use-full-page-scroll)曾同时监听这组键,在 /chat 上双触发,现已让出,只保留 PageUp/PageDown。
  React.useEffect(() => {
    pushOverlay(MESSAGE_LIST_KEYBOARD_NAV_OVERLAY_ID)
    const onKey = (e: KeyboardEvent) => {
      // 2026-08-02 修复 P1(问题 6-1):用 messagesRef.current 读最新 messages,
      // effect 依赖仅 [setFocusedIndexBoth](稳定引用),listener 仅挂载一次,
      // 避免每个 token 触发拆卸/重装造成 DOM 监听器抖动 + 按键丢失。
      const msgs = messagesRef.current
      if (msgs.length === 0) return
      const target = e.target as HTMLElement | null
      // 焦点在输入控件时不拦截(避免与用户输入冲突)
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return
        }
      }
      // 已有焦点但被 Modifier 修饰 → 不拦截(保留浏览器原生行为:Cmd+ArrowUp = scroll to top)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next =
          focusedIndexRef.current < 0 ? 0 : Math.min(msgs.length - 1, focusedIndexRef.current + 1)
        setFocusedIndexBoth(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next =
          focusedIndexRef.current < 0 ? msgs.length - 1 : Math.max(0, focusedIndexRef.current - 1)
        setFocusedIndexBoth(next)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setFocusedIndexBoth(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setFocusedIndexBoth(msgs.length - 1)
      } else if (e.key === 'Escape') {
        if (!isTopOverlay(MESSAGE_LIST_KEYBOARD_NAV_OVERLAY_ID)) return
        // 2026-07-28 立:用 focusedIndexRef 读最新值,避免 stale closure
        // (键盘事件连续触发时 listener 闭包内的 focusedIndex 可能滞后)
        if (focusedIndexRef.current >= 0) {
          e.preventDefault()
          setFocusedIndexBoth(-1)
        }
      } else if (e.key === 'Enter') {
        // 2026-09-22 补:焦点落在原生会响应 Enter 的可交互元素上时一律让位。
        // 上面只挡了 INPUT/TEXTAREA/contenteditable,而 button / a / [role=menuitem|tab]
        // 被 Tab 聚焦后按 Enter 原本应当激活自身 —— 此前会被这里 preventDefault 吞掉
        // (如右下角"跳到最新"钮聚焦后按 Enter 既不激活按钮,又翻动消息 reasoning)。
        // 用 instanceof Element 兜住:测试里在 window 上派发的事件 target 非元素,行为不变;
        // 同时覆盖 SVG 焦点态(SVGElement 不是 HTMLElement 但有 closest)。
        if (e.target instanceof Element) {
          const interactive = e.target.closest(
            'button, a[href], select, [role="button"], [role="menuitem"], [role="tab"]',
          )
          if (interactive) return
        }
        // 2026-07-28 立:同上,用 ref 读最新 focusedIndex
        const idx = focusedIndexRef.current
        if (idx >= 0) {
          const m = msgs[idx]
          if (m?.reasoning) {
            e.preventDefault()
            window.dispatchEvent(
              new CustomEvent('ihui:toggle-reasoning', { detail: { messageId: m.id } }),
            )
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      popOverlay(MESSAGE_LIST_KEYBOARD_NAV_OVERLAY_ID)
      window.removeEventListener('keydown', onKey)
    }
  }, [setFocusedIndexBoth])

  // 2026-07-28 立:focused message 变更后自动 scrollIntoView(确保可见)
  // 配合键盘 ↑/↓ 用,避免焦点切到屏幕外时用户看不到
  // 2026-08-02 修复 P2(问题 6-2):依赖去掉 messages,改用 messagesRef.current 读最新。
  // 原 [focusedIndex, messages] 每个 token 触发 effect 重跑,即使 focusedIndex 未变
  // 仍执行 querySelector + scrollIntoView,造成不必要的 DOM 查询和滚动。
  React.useEffect(() => {
    const msgs = messagesRef.current
    if (focusedIndex < 0 || focusedIndex >= msgs.length) return
    const id = msgs[focusedIndex]?.id
    if (!id) return
    const el = containerRef.current?.querySelector(
      `[data-message-id="${id}"]`,
    ) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])

  // 2026-07-28 立:focusedIndex 越界保护(messages 删除时索引可能失效)
  React.useEffect(() => {
    if (focusedIndex >= messages.length) {
      setFocusedIndex(messages.length > 0 ? messages.length - 1 : -1)
    }
  }, [focusedIndex, messages.length])

  return {
    containerRef,
    bottomRef,
    enableVirtual,
    visibleRange,
    computeCumulative,
    measureItem,
    handleScroll,
    scrollToBottom,
    userScrolledUp,
    focusedIndex,
    isFarFromTop,
    isFarFromBottom,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
