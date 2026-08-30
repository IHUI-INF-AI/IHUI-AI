import * as React from 'react'
import type { ChatMessage } from '@/stores/chat'
import { useChatStore } from '@/stores/chat'

// #7 虚拟滚动配置(2026-07-25 立):消息数超过阈值时启用窗口化渲染
// - ESTIMATED_ITEM_HEIGHT:消息平均高度估计值,用于初始 padding 计算
// - VIRTUAL_THRESHOLD:超过此条数启用虚拟滚动(60 条以下全量渲染,保留流畅性)
// - BUFFER:上下各多渲染的缓冲条数,减少快速滚动时的白屏
// - heightMap:ResizeObserver 测量的真实高度映射,滚动时用真实累积高度精确定位
const ESTIMATED_ITEM_HEIGHT = 160
const VIRTUAL_THRESHOLD = 60
const BUFFER = 6
const TOP_LOAD_MORE_THRESHOLD = 60 // scrollTop < 60px 触发加载更多历史

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
  handleScroll: () => void
  scrollToBottom: () => void
  handleJumpToLatest: () => void
  /** 2026-08-29 立:标记真实用户滚动意图(wheel/touch),程序自动滚底不触发 */
  markUserIntent: () => void
  userScrolledUp: boolean
  userScrolledToTop: boolean
  setUserScrolledToTop: (v: boolean) => void
  focusedIndex: number
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
  // 是否在用户手动向上滚动(暂停自动滚动到底部,直到新消息到达或用户滚到底)
  const userScrolledUpRef = React.useRef(false)
  const userScrolledToTopRef = React.useRef(false)
  // 2026-07-28 立:userScrolledUp 状态镜像(用于驱动 jump-to-latest 浮动按钮显隐)
  // - ref 用于在 scroll callback 高频更新时避免整个组件重渲染
  // - state 镜像驱动浮动按钮条件渲染(ref 变化不会触发重渲染)
  // - 用 rAF 节流合并多次 ref 更新 → state 一次,避免抖动
  const userScrolledUp = useChatStore((s) => s.userScrolledUp)
  const userScrolledToTop = useChatStore((s) => s.userScrolledToTop)
  const setUserScrolledUp = useChatStore((s) => s.setUserScrolledUp)
  const setUserScrolledToTop = useChatStore((s) => s.setUserScrolledToTop)
  // 防御性 null check(测试环境 mock 可能未完整注入 setter)
  // 2026-08-25 useMemo 稳定化:原条件表达式在 setter 缺失时每次渲染新建 () => {},
  // 导致依赖它的 useCallback deps 每帧变化(exhaustive-deps 警告 + 无谓重渲染)。
  const safeSetUserScrolledUp = React.useMemo(
    () => (typeof setUserScrolledUp === 'function' ? setUserScrolledUp : () => {}),
    [setUserScrolledUp],
  )
  const safeSetUserScrolledToTop = React.useMemo(
    () => (typeof setUserScrolledToTop === 'function' ? setUserScrolledToTop : () => {}),
    [setUserScrolledToTop],
  )
  // 2026-07-28 立:键盘导航的 focused message index(-1 = 无聚焦)
  // - ↑/↓ 切换时设置,Enter 展开/折叠 reasoning,Esc 取消聚焦
  // - focused 消息添加 ring 视觉 + data-message-focused 属性
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1)
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

  // 2026-08-29 修复:真实用户滚动意图标记(wheel/touch)。
  // 根因:自动滚底用 scrollIntoView({behavior:'smooth'}),smooth 动画持续触发 scroll 事件,
  // 而 handleScroll 原先用 distanceFromBottom > 120 推断"用户上翻"——流式输出内容持续增长、
  // smooth 动画追不上时 distanceFromBottom 变大,程序滚动被误判为手动上翻,
  // userScrolledUpRef 被置 true → 后续 token 不再自动滚底(用户看到"内容在生成但列表不跟滚")。
  // 修复:仅当用户真实交互(wheel/touchmove)后才允许更新上翻判定,程序滚动不参与。
  // 标记 800ms 自动过期(连续滚动会持续刷新),避免一次轻滑长期影响。
  const userIntentScrollRef = React.useRef(false)
  const clearIntentTimerRef = React.useRef<number | null>(null)
  const markUserIntent = React.useCallback(() => {
    userIntentScrollRef.current = true
    if (clearIntentTimerRef.current !== null) {
      window.clearTimeout(clearIntentTimerRef.current)
    }
    clearIntentTimerRef.current = window.setTimeout(() => {
      userIntentScrollRef.current = false
      clearIntentTimerRef.current = null
    }, 800)
  }, [])

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

  const handleScroll = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return

    // 标记用户是否向上滚动(远离底部)
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    // 2026-08-29 修复:维护贴底跟随状态(程序滚动动画期间冻结,防动画中距离暂时变大被误判)
    if (Date.now() >= programmaticScrollUntilRef.current) {
      pinnedToBottomRef.current = distanceFromBottom <= 120
    }
    // 2026-08-29 修复:上翻判定仅对真实用户滚动意图(wheel/touch)生效。
    // 程序自动滚底(smooth 动画)触发的 scroll 事件不参与,避免流式期间
    // userScrolledUpRef 被误置 true 导致自动滚动中断。
    if (userIntentScrollRef.current) {
      // P0 修复(2026-08-02):hysteresis 滞后 50px,避免边界抖动
      // - 未显示按钮时:distanceFromBottom > 120(UPPER)才显示(向上滚超过 120px)
      // - 已显示按钮时:distanceFromBottom > 70(LOWER)才保持显示,否则隐藏(向下滚低于 70px)
      // - 70~120px 之间保持当前状态,用户在边界附近微小滚动不会触发按钮频繁显隐
      const UPPER_THRESHOLD = 120
      const LOWER_THRESHOLD = 70
      const currentlyScrolledUp = userScrolledUp
      const scrolledUp = currentlyScrolledUp
        ? distanceFromBottom > LOWER_THRESHOLD
        : distanceFromBottom > UPPER_THRESHOLD
      userScrolledUpRef.current = scrolledUp
      // 同步到 store(2026-07-28 立),驱动 jump-to-latest 按钮条件渲染
      // 2026-08-25:统一走 safe 包装(与顶部按钮一致),消除对原始 setter 的依赖
      // 同时修复 exhaustive-deps 缺失依赖警告(setter 缺失时原代码此处会直接抛错)
      if (scrolledUp !== userScrolledUp) {
        safeSetUserScrolledUp(scrolledUp)
      }
    }

    // 顶部返回按钮:scrollTop > 200px 时显示
    const TOP_BACK_THRESHOLD = 200
    const scrolledAwayFromTop = el.scrollTop > TOP_BACK_THRESHOLD
    userScrolledToTopRef.current = scrolledAwayFromTop
    if (scrolledAwayFromTop !== userScrolledToTop) {
      safeSetUserScrolledToTop(scrolledAwayFromTop)
    }

    // #8 滚动到顶部触发加载更多历史
    if (
      el.scrollTop < TOP_LOAD_MORE_THRESHOLD &&
      onLoadMoreHistory &&
      hasMoreHistory &&
      !loadingMoreHistory
    ) {
      // 记录当前 scrollHeight,prepend 后恢复相对位置(保持视觉不跳动)
      const prevScrollHeight = el.scrollHeight
      const prevScrollTop = el.scrollTop
      onLoadMoreHistory()
      // 2026-08-02 修复: Bug 1 — onLoadMoreHistory 是 void(非 Promise),异步加载未完成时
      // 单次 rAF 调整 scrollTop 无效(scrollHeight 还没变)。改用轮询:持续 rAF 检查 scrollHeight
      // 显著变化(>50px,跳过 loading 指示器 ~30px 的小幅增长),prepend 完成后立即调整 scrollTop,
      // 5s 超时防泄漏(网络失败等场景)。
      const startTime = Date.now()
      const checkScroll = () => {
        if (!containerRef.current) return
        const newScrollHeight = containerRef.current.scrollHeight
        if (newScrollHeight > prevScrollHeight + 50) {
          containerRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight)
          return
        }
        if (Date.now() - startTime > 5000) return
        requestAnimationFrame(checkScroll)
      }
      requestAnimationFrame(checkScroll)
    }

    // #7 虚拟滚动:计算可见范围
    if (!enableVirtual) return
    const { offsets, total } = computeCumulative()
    if (total === 0) return

    // 二分查找找到 startIndex(第一个 offset > scrollTop - buffer*ESTIMATED)
    const scrollPos = el.scrollTop
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
    userScrolledToTop,
    safeSetUserScrolledToTop,
    userScrolledUp,
    safeSetUserScrolledUp,
  ])

  // 2026-08-29 修复:自动滚底"差一脚"(最后一条消息停不到底,需手动再滑)
  // 根因:scrollIntoView 的动画目标在调用瞬间一次性计算,此后内容高度再增长
  // (流结束瞬间操作按钮行 msg-hover-reveal 才挂载 / Markdown 收尾重排 / 图片解码等),
  // 终点即过期 → 停在离底部一小段处。
  // 修复方案:贴底跟随(pinned-to-bottom)状态机 + ResizeObserver 自校正网
  // - pinnedToBottomRef:最近已知位置是否处于贴底区(距底 ≤ 120px,与 userScrolledUp 滞后阈值一致)
  // - programmaticScrollUntilRef:程序滚动动画期间冻结 pinned 判定(动画中距离暂时变大属正常,
  //   不能误判为"用户离开底部");期间用户真实滚轮/触摸由 userIntentScrollRef + userScrolledUpRef 拦截
  // - 内容高度一变且 pinned → 瞬时贴底,兜住一切"事后长高"(图片解码晚于流结束也能跟随)
  const pinnedToBottomRef = React.useRef(false)
  const programmaticScrollUntilRef = React.useRef(0)

  // 自动滚动到底部(流式 token 到达 + 新消息)
  // - 流式输出时强制滚到底(保持最新内容可见)
  // - 新消息到达时强制滚到底
  // - 非流式 + 用户向上滚动时暂停自动滚动(避免打断阅读)
  // - #9 50ms throttle(2026-07-25 立):leading + trailing,避免每个 token 触发 scrollIntoView
  React.useEffect(() => {
    const newLen = messages.length
    const prevLen = prevMessagesLenRef.current
    const isNewMessage = newLen > prevLen
    prevMessagesLenRef.current = newLen
    // 2026-08-16 修复:流式输出也尊重用户上翻——此前 isStreaming 恒强制滚底,
    // 用户在流式生成时翻看历史会被拉回底部(打断阅读)。
    // 新消息到达仍强制滚底;流式 token 仅在用户未上翻时跟随滚底。
    const shouldForceScroll = isNewMessage || (!userScrolledUpRef.current && isStreaming)
    if (!shouldForceScroll && userScrolledUpRef.current) return

    const doScroll = () => {
      const el = bottomRef.current
      if (!el) return
      pinnedToBottomRef.current = true
      programmaticScrollUntilRef.current = Date.now() + 700
      // 批量加载(切换会话/首次加载,prev=0 且 newLen>1):auto 无动画直接跳底
      // 逐条追加/streaming:smooth 平滑跟随新消息
      const behavior = prevLen === 0 && newLen > 1 ? 'auto' : 'smooth'
      el.scrollIntoView({ behavior, block: 'end' })
      // 2026-08-29 修复:程序滚底后重置用户上翻标记。
      // 此前 isNewMessage 强制滚动后 userScrolledUpRef 残留 true,导致后续
      // 流式 token 不再跟随滚动(内容增长后用户看不到最新一行)。
      userScrolledUpRef.current = false
      safeSetUserScrolledUp(false)
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
  }, [messages.length, lastContent, isStreaming])

  // 2026-08-29 修复(2):贴底自校正网 — 内容容器高度一变,若处于贴底跟随态则瞬时校正。
  // 触发条件(全满足才校正,避免打扰用户阅读):
  // - 用户无上翻动作(userScrolledUpRef)且无进行中的滚轮/触摸手势(userIntentScrollRef)
  // - 最近已知位置处于贴底区(pinnedToBottomRef,与流式状态无关 → 图片解码等晚到长高也能跟随)
  // 用 scrollTop = scrollHeight 瞬时贴底(小校正不可感知;smooth 动画不会重新瞄准已过期的终点)
  const hasMessages = messages.length > 0
  React.useEffect(() => {
    if (!hasMessages) return
    const container = containerRef.current
    const content = container?.firstElementChild
    if (!container || !content || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (userScrolledUpRef.current || userIntentScrollRef.current) return
      if (!pinnedToBottomRef.current) return
      const el = containerRef.current
      if (!el) return
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distance <= 0) return
      el.scrollTop = el.scrollHeight
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [hasMessages])

  // #9 卸载时清理 pending throttle timer(2026-07-25 立)
  // 2026-08-29 扩展:同时清理用户滚动意图标记的过期 timer
  React.useEffect(() => {
    const st = scrollThrottleRef.current
    return () => {
      if (st.timer !== null) {
        clearTimeout(st.timer)
        st.timer = null
      }
      if (clearIntentTimerRef.current !== null) {
        clearTimeout(clearIntentTimerRef.current)
        clearIntentTimerRef.current = null
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
      handleScroll()
    })
  }, [handleScroll])

  // #8 加载更多历史时保持滚动位置(handleScroll 内已处理)
  // #7 ResizeObserver 测量真实高度并触发重算可见范围
  const measureItem = React.useCallback(
    (id: string) => (el: HTMLElement | null) => {
      const map = heightMapRef.current
      if (!el) {
        // P1-3 修复:删除条目时版本号 +1,强制下次 computeCumulative 重算缓存
        if (map.has(id)) {
          map.delete(id)
          heightMapVersionRef.current++
        }
        return
      }
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
    [scheduleScrollUpdate],
  )

  // 消息列表重置(切换会话)时清空高度映射 + 重置可见范围
  React.useEffect(() => {
    if (messages.length === 0) {
      heightMapRef.current.clear()
      setVisibleRange({ start: 0, end: VIRTUAL_THRESHOLD - 1 })
      userScrolledToTopRef.current = false
      safeSetUserScrolledToTop(false)
      userScrolledUpRef.current = false
      safeSetUserScrolledUp(false)
    } else if (messages.length <= VIRTUAL_THRESHOLD) {
      setVisibleRange({ start: 0, end: messages.length - 1 })
    }
    // setUserScrolledUp 是 zustand store 稳定引用,无需列入依赖
     
  }, [messages.length])

  // 2026-07-28 立:Jump-to-latest 浮动按钮点击处理(深度对标 Trae Work)
  // - scrollIntoView 到 bottomRef(平滑)
  // - 重置 userScrolledUp 标记,触发自动滚动继续工作
  // - 派发自定义事件,允许其他监听组件(如 timeline tab)同步滚动到底
  const scrollToBottom = React.useCallback(() => {
    const el = bottomRef.current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' })
    pinnedToBottomRef.current = true
    programmaticScrollUntilRef.current = Date.now() + 700
    userScrolledUpRef.current = false
    safeSetUserScrolledUp(false)
  }, [safeSetUserScrolledUp])

  const handleJumpToLatest = React.useCallback(() => {
    scrollToBottom()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ihui:jump-to-latest'))
    }
  }, [scrollToBottom])

  // 2026-08-16 立:监听外部 jump-to-latest 请求(由 MessageInput 中的按钮触发)
  // 注意:外部监听器只调用 scrollToBottom(不派发事件),避免按钮点击→dispatch→监听→dispatch 无限递归
  React.useEffect(() => {
    window.addEventListener('ihui:jump-to-latest', scrollToBottom)
    return () => window.removeEventListener('ihui:jump-to-latest', scrollToBottom)
  }, [scrollToBottom])

  // 2026-07-28 立(深度对标 Trae Work):键盘导航 ↑/↓ 切换消息聚焦
  // - 焦点不在 input/textarea/contenteditable 时生效(避免与输入冲突)
  // - ArrowDown / ArrowUp:切换 focused message index
  // - Enter:聚焦消息若含 reasoning → 派发切换事件(由 MessageItem 内部响应)
  // - Escape:清除聚焦
  // - Home/End:跳到首/末条
  // 用 window keydown 监听确保焦点在 message 容器内任意子元素都能响应
  React.useEffect(() => {
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
        // 2026-07-28 立:用 focusedIndexRef 读最新值,避免 stale closure
        // (键盘事件连续触发时 listener 闭包内的 focusedIndex 可能滞后)
        if (focusedIndexRef.current >= 0) {
          e.preventDefault()
          setFocusedIndexBoth(-1)
        }
      } else if (e.key === 'Enter') {
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
    return () => window.removeEventListener('keydown', onKey)
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
    handleJumpToLatest,
    markUserIntent,
    userScrolledUp,
    userScrolledToTop,
    setUserScrolledToTop,
    focusedIndex,
  }
}
