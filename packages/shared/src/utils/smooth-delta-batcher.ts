// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * #16/#9 流式平滑批处理(三端单一真相源,2026-11-12 自 apps/web/src/hooks/use-chat/smooth-delta-batcher.ts 上收):
 *
 * 上收背景(AGENTS §3 共享层优先 / §0.6 单一真相源):打字机节拍此前只有 web 一份实现,
 * RN 与小程序主聊天腿逐 token 裸 setState —— 同一条回复三端两种节拍,且逐 token 全列表重渲染
 * 在小程序是 setData 风暴(卡顿主源)。web 副本此后只许 re-export(第二份实现必然漂移)。
 *
 * 行为契约(对外与 web 历史版逐参数一致,drop-in):delta 入 buffer 后,每提交节拍只追加一小段
 * 字符,落后越多追不动时靠节拍匀速消化;batch/flush/cancel/pending 语义不变,
 * onProgress 每提交报告本流累计收到(模型生成)的总字符数(供 #21 估算)。
 *
 * 宿主调度注入纪律(shared CONTEXT §3:不得把平台 API 焊进包体):
 * 帧信号优先用宿主 `requestAnimationFrame`(web/Tauri/Taro 4/RN 0.86 均有);取不到回落
 * `setTimeout` 同节拍 —— 判据只有"全局里有没有这组函数",不做平台分支。
 *
 * D1(2026-11-12 修,原 web 版遗留缺陷):旧实现在节拍内用 `pending.slice(0, room)` 按
 * UTF-16 码元硬切,切点落在代理对两半之间时,半个高代理先入正文 → 渲染成一枚 U+FFFD,
 * 下一拍才拼回(流式含 emoji/增补平面汉字时逐帧闪乱码)。本实现提交前用
 * `alignSliceToCodePointBoundary` 把切点推到码点边界(与 truncate.ts「BUG-52 不劈代理对」
 * 同一条纪律,粒度取码点级:片内不再检查内部撕裂 —— room≥2 时配对切点必落在合法边界,
 * room=1 恰为兜底补码元的那一步)。
 */

// D1b(2026-11-14):切点判据从「码点边界」升级为「字素簇边界」,复用 truncate.ts 的
// Intl.Segmenter 真相源(§0.6 单一真相源 —— D1 注释本就说与 truncate「BUG-52」同源,
// 但此前只对齐了码点、漏了 ZWJ/FE0F/肤色修饰符连接的多码点 emoji)。
import { splitGraphemes } from './truncate'

/**
 * 把候选切点挪到**字素簇边界**(绝不劈开代理对,也绝不劈开 ZWJ/FE0F/肤色修饰符连接的多码点 emoji)。
 *
 * 判据只有一条:切点前一个码元若是**高代理**(0xD800–0xDBFF),它的低代理就在切点之后
 * —— 切下去就是把一个字符劈成两半(半个高代理先入正文 ⇒ 渲染成 U+FFFD,下一拍才拼回)。
 *
 * 与 2026-11-12 早版「向后多带一个码元」的两处差别,都是实测出来的:
 * ① **末尾孤立高代理**:SSE 帧本可以在代理对中间断开(JSON 解码后的字符串以高代理结尾),
 *    此时 `end === s.length`,旧实现开头的 `end >= s.length` 直接放行,半个字符照样漏出去;
 * ② 优先**回退一格**而不是向后多带:回退只会让本片更短,`MAX_CHARS_PER_COMMIT` 预算恒成立。
 *
 * 唯一的例外是"回退到 0"——那说明 `room === 1`,回退等于本帧永不可能产出。此时改为把低代理
 * 一起带走(本片超预算 1 个码元,有界),否则 room=1 的窄窗口会在跨帧代理对上死锁。
 *
 * 返回 0 = 整个可见前缀就是一枚孤立高代理 ⇒ 调用方**必须放弃本帧**等下一批数据。
 * 旧实现在这里会 `append('')` 且 `pending` 不减,是**死循环**(不是"慢一拍")。
 */
/** 孤立高代理：单码元、落在高代理区，且后面无低代理跟（流尾残缺/SSE 帧在代理对中间断开）。 */
function isLoneHighSurrogate(seg: string): boolean {
  if (seg.length !== 1) return false
  const code = seg.charCodeAt(0)
  return code >= 0xd800 && code <= 0xdbff
}

export function alignSliceToCodePointBoundary(s: string, end: number): number {
  if (end <= 0) return 0
  const cut = Math.min(end, s.length)
  if (cut <= 0) return 0
  // D1b:对**整串 s** 做字素分段(不能先 slice 再分段 —— slice 会把代理对从中间劈开,
  // 分段看到的就成了孤立半代理,判据随之失效)。找到切点所在簇:
  //   簇终点 > 切点 ⇒ 切点落在簇中间 ⇒ 回退到簇起点(退无可退就整簇带走,超预算但有界);
  //   簇终点 === 切点 ⇒ 切点在簇边界;但若最后这枚是孤立高代理(流尾残缺)则让位下一帧。
  // 代理对是一枚字素簇的子集 ⇒ 原 D1 码点对齐被字素对齐严格覆盖,行为不退化。
  let acc = 0
  for (const seg of splitGraphemes(s)) {
    const segEnd = acc + seg.length
    if (segEnd < cut) {
      acc = segEnd
      continue
    }
    if (segEnd > cut) {
      // 切点在簇中间:回退到簇起点;起点即 0(退无可退)⇒ 整簇带走(防 room=1 死锁)
      return acc > 0 ? acc : segEnd
    }
    // segEnd === cut:切点在簇边界。孤立高代理(下一帧才补低代理 / 流尾残缺)不单独发出。
    if (isLoneHighSurrogate(seg)) return acc // acc=0 时返回 0 = 放弃本帧,绝不 append('') 自旋
    return cut
  }
  return cut
}

export interface SmoothDeltaBatcherOptions {
  /** 每提交帧回调,入参为「本流累计收到(模型生成)的总字符数」 */
  onProgress?: (charCount: number) => void
}

export interface SmoothDeltaBatcher {
  /** 喂入增量 delta(与 createDeltaBatcher.batch 同名同语义) */
  batch: (delta: string) => void
  /** 立即追加全部剩余 buffer 并停帧(错误/中止前冲刺) */
  flush: () => void
  /** 丢 buffer 并停帧 */
  cancel: () => void
}

type RafScheduler = {
  request: (cb: () => void) => number
  cancel: (id: number) => void
  /** setTimeout 兜底档用:宿主无 rAF 时以同节拍定时器代跑 */
  intervalMs: number
}

function resolveScheduler(): RafScheduler {
  const g = globalThis as {
    requestAnimationFrame?: (cb: () => void) => number
    cancelAnimationFrame?: (id: number) => void
  }
  if (
    typeof g.requestAnimationFrame === 'function' &&
    typeof g.cancelAnimationFrame === 'function'
  ) {
    return {
      request: (cb) => g.requestAnimationFrame!(cb),
      cancel: (id) => g.cancelAnimationFrame!(id),
      intervalMs: 0,
    }
  }
  const FALLBACK_TICK_MS = 16
  return {
    request: (cb) => setTimeout(cb, FALLBACK_TICK_MS) as unknown as number,
    cancel: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
    intervalMs: FALLBACK_TICK_MS,
  }
}

function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance
  if (perf && typeof perf.now === 'function') return perf.now()
  return Date.now()
}

export function createSmoothDeltaBatcher(
  append: (text: string) => void,
  opts?: SmoothDeltaBatcherOptions,
): SmoothDeltaBatcher {
  let pending = ''
  let totalReceived = 0
  const scheduler = resolveScheduler()
  let rafId: number | null = null

  const emitProgress = (): void => {
    opts?.onProgress?.(totalReceived)
  }

  /**
   * H20 ②(2026-11-04 收口)+ D1(2026-11-12 码点边界):提交节拍 + 帧预算切批。
   *
   * 第一版只做「每帧 ≤24 字 + 8ms 预算」,CI 首跑仍有 148ms/56ms 两枚长任务:
   * 帧预算压住了单次追加字数,但**提交频率仍是一帧一次**(60 次/秒),
   * 流式消息的 markdown 活跃块与列表容器被反复提交,总渲染工作量没有下降。
   *
   * 收口版把「消费积压」与「提交 DOM」拆开:
   * - 每 COMMIT_INTERVAL_MS 才提交一次(≈25fps),其余帧只保留积压、不触发 React 更新;
   * - 单次提交仍受 8ms 硬预算与 MAX_CHARS_PER_COMMIT 约束,积压大也不放大单帧;
   * - 首帧立即提交(lastCommitAt 从 0 起算),可见延迟上限≈一个提交间隔,不牺牲首字观感;
   * - D1:每次切批的切点先经 alignSliceToCodePointBoundary 推到码点边界,代理对永不劈开。
   */
  const RENDER_BUDGET_MS = 8
  const COMMIT_INTERVAL_MS = 40
  const MAX_CHARS_PER_COMMIT = 120
  let lastCommitAt = 0

  const tick = (): void => {
    rafId = null
    if (pending.length === 0) {
      emitProgress()
      return
    }
    const now = nowMs()
    // 未到提交节拍:本帧只等待,不制造一次 React/setData 提交(积压留在 pending)
    if (now - lastCommitAt < COMMIT_INTERVAL_MS) {
      rafId = scheduler.request(tick)
      return
    }
    const startedAt = now
    let taken = 0
    let deferredOnLoneSurrogate = false
    while (pending.length > 0 && taken < MAX_CHARS_PER_COMMIT) {
      const room = MAX_CHARS_PER_COMMIT - taken
      const rawCut = Math.min(room, pending.length)
      // D1:切点对齐码点边界;返回 0 = 可见前缀只有一枚孤立高代理(SSE 帧在代理对中间断开)
      const cut = alignSliceToCodePointBoundary(pending, rawCut)
      if (cut === 0) {
        // 本帧无从产出:**不追加空串、不排下一帧**(旧实现在这里 append('') 且 pending 不减,
        // 是自旋死循环)。等下一次 batch() 把低代理带进来再续帧。
        deferredOnLoneSurrogate = true
        break
      }
      const take = pending.slice(0, cut)
      pending = pending.slice(cut)
      append(take)
      taken += take.length
      // 硬预算:本帧已花满 8ms 就停手,剩余积压顺延到下一帧
      if (nowMs() - startedAt >= RENDER_BUDGET_MS) break
    }
    if (taken > 0) {
      lastCommitAt = nowMs()
      emitProgress()
    }
    // 只有"被动让位给孤立高代理"这一档不续帧;其余有积压就继续消化
    if (pending.length > 0 && !deferredOnLoneSurrogate) {
      rafId = scheduler.request(tick)
    }
  }

  const batch = (delta: string): void => {
    if (delta.length === 0) return
    pending += delta
    totalReceived += delta.length
    if (rafId === null) {
      rafId = scheduler.request(tick)
    }
  }

  const flush = (): void => {
    if (rafId !== null) {
      scheduler.cancel(rafId)
      rafId = null
    }
    if (pending) {
      const d = pending
      pending = ''
      append(d)
      emitProgress()
    }
  }

  const cancel = (): void => {
    if (rafId !== null) {
      scheduler.cancel(rafId)
      rafId = null
    }
    pending = ''
  }

  return { batch, flush, cancel }
}

export const __test__ = { alignSliceToCodePointBoundary, resolveScheduler }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
