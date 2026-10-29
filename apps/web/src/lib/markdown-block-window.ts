// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 静态长文档的**块级虚拟化**判据(对标 Qoder §6.6,2026-10-29 立)。
 *
 * ## 缺口(现读,不是推演)
 *
 * `components/ai/markdown-stream.tsx` 的 `renderBlocks` 已经把 stable 前缀拆成有序块
 * (每块一个 `StableBlock` memo),但**流式结束之后**仍然把全部块一次性挂在树上。
 * 一条 60K 字符的答复按 `MARKDOWN_BLOCK_MERGE_THRESHOLD=512` 约切出 120 块,每块
 * 独立跑一遍 react-markdown(remark/rehype/katex),首屏要等这 120 块全部 parse 完
 * 才能稳定;滚动时这些 DOM 也一直占着。Qoder 的处理是 `STATIC_MARKDOWN_VIRTUALIZATION_THRESHOLD
 * = 16384` 字符以上、且**流式已完**时只挂可视区 + overscan(`@2556560` / `@2585250`)。
 *
 * ## 为什么判据单独一个文件、而且不用 `content-visibility`
 *
 * - `content-visibility` / `contain-intrinsic-size` 是**AGENTS 明文禁止恢复**的
 *   (G-828:浏览器跳过布局会让滚动条跳、锚点错位,实测比不优化更糟)。本模块走
 *   **真·条件挂载**:窗口外的块不进 React 树,用上下两个占位块把高度撑住。
 * - 纯函数(不读 DOM、不持 state、不碰 React)才能把"窗口算得对不对"用数值钉死;
 *   组件层只做几何量测与接线,判据零复算(AGENTS §0.6)。
 *
 * ## 与既有 `components/chat/windowing.ts` 的分工(不重复实现)
 *
 * 那个文件管的是**消息行**窗口(按行高估算 + 用户上翻时保视口行);本文件管的是
 * **同一条消息内部的 markdown 块**窗口(块高差异大、且必须撑住整篇高度以免滚动条跳)。
 * 两者的入参语义不同(行有测高 LRU,块没有),合并会逼出一堆 if 分支,故分开;
 * 但**失效方向对齐**:算不出几何时一律退化为"全部挂载"(不优化),绝不退化为
 * "挂空"(那是白屏)。
 */

/**
 * 启用块级虚拟化的字符门槛。取 Qoder 的 16384。
 *
 * 为什么是这个量级而非拍脑袋的小值:按本仓 `MARKDOWN_BLOCK_MERGE_THRESHOLD=512` 折算,
 * 16384 字符 ≈ 32 块 —— 32 块全量 parse 在中端机上仍是"可感知但可接受"的一次性
 * 开销(与 Qoder 同一档);低于此值时窗口化的收益抵不过占位块带来的布局抖动风险
 * (块数少 ⇒ 视口外的块少 ⇒ 省不下 parse,却多两次高度占位计算)。
 */
export const STATIC_BLOCK_VIRTUALIZE_MIN_CHARS = 16384

/**
 * 窗口上下各多挂的块数。取 Qoder 的 4(`overscan: 4`)。
 *
 * 4 块的缓冲足以覆盖一次惯性滚动的一帧位移(块高中位数 ~512 字符渲染高度约 200px,
 * 4 块 ≈ 800px > 一帧滚动位移),同时不会把"挂载块数"抬过可视区太多。
 */
export const STATIC_BLOCK_OVERSCAN = 4

/** 单帧挂载块数硬上限:几何退化(块高量成 0)时兜底,防"窗口圈住全部块"。 */
export const STATIC_BLOCK_MAX_MOUNTED = 64

export interface StaticBlockWindowInput {
  /** 本消息已切出的块数 */
  readonly blockCount: number
  /** 全文正文字符数(判门槛用;不是块内容长度之和的替代品,直接传原文长度) */
  readonly totalChars: number
  /** 是否仍在流式:流式期间窗口化会让 active 块反复重挂,必须关闭 */
  readonly isStreaming: boolean
  /** 每一块的累计偏移(长度 = blockCount + 1);测不到时传空数组 */
  readonly offsets: readonly number[]
  /** 滚动容器当前 scrollTop(相对本文档顶) */
  readonly scrollTop: number
  /** 可视区高度 */
  readonly viewportHeight: number
  readonly overscan?: number
  readonly maxMounted?: number
}

export interface StaticBlockWindow {
  /** 是否启用窗口化。false ⇒ 调用方必须全量挂载(与优化前逐字节同形) */
  readonly enabled: boolean
  /** 挂载区间(闭区间);未启用时为 [0, blockCount-1] */
  readonly start: number
  readonly end: number
  /** 上方占位高度(px);0 = 不占位 */
  readonly paddingTop: number
  /** 下方占位高度(px) */
  readonly paddingBottom: number
  /**
   * 未启用的原因(诊断用)。`enabled: true` 时为 null。
   * 这个字段是判据诚实性的一部分:调用方与测试都能分清"不需要"与"算不出"。
   */
  readonly reason: string | null
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function firstIndexCovering(offsets: readonly number[], position: number): number {
  // offsets 单调递增(块按顺序累加);找最后一个 offsets[i] <= position 的 i
  let lo = 0
  let hi = offsets.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((offsets[mid] ?? 0) <= position) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/**
 * 算静态长文档该挂哪几块。
 *
 * 六条让位判据(任一成立 ⇒ `enabled: false` 且**全量挂载**,失效方向恒为"不优化"):
 *  ① 仍在流式 —— 窗口化会让 active 块在窗口进出时反复重挂,代码块折叠态/mermaid
 *     渲染结果都会被打回(与 `markdown-stream.tsx` 档⑦ 修掉的是同一型);
 *  ② 总字符 < `STATIC_BLOCK_VIRTUALIZE_MIN_CHARS`;
 *  ③ 块数 ≤ 1 —— 没有可窗口的对象;
 *  ④ 偏移表长度不足(`blockCount + 1`)—— 没量过几何,不许猜;
 *  ⑤ 总高量成 0 或非有限 —— 与 `windowing.ts` 同一档处理,但**此处退化为全量**:
 *     块级窗口没有"从顶部挂满上限"这一档可用(那会把正文中段藏起来);
 *  ⑥ 可视区高度非有限/为 0 —— 同上。
 */
export function resolveStaticBlockWindow(input: StaticBlockWindowInput): StaticBlockWindow {
  const { blockCount, totalChars, isStreaming, offsets, scrollTop } = input
  const all: StaticBlockWindow = {
    enabled: false,
    start: 0,
    end: Math.max(0, blockCount - 1),
    paddingTop: 0,
    paddingBottom: 0,
    reason: null,
  }

  if (isStreaming) return { ...all, reason: 'streaming' }
  if (!isFiniteNumber(totalChars) || totalChars < STATIC_BLOCK_VIRTUALIZE_MIN_CHARS) {
    return { ...all, reason: 'below-threshold' }
  }
  if (blockCount <= 1) return { ...all, reason: 'single-block' }
  if (offsets.length < blockCount + 1) return { ...all, reason: 'offsets-unmeasured' }

  const totalHeight = offsets[blockCount]
  if (!isFiniteNumber(totalHeight) || totalHeight <= 0) {
    return { ...all, reason: 'total-height-unknown' }
  }
  const viewportHeight = input.viewportHeight
  if (!isFiniteNumber(viewportHeight) || viewportHeight <= 0) {
    return { ...all, reason: 'viewport-unknown' }
  }

  const overscan = isFiniteNumber(input.overscan ?? STATIC_BLOCK_OVERSCAN)
    ? (input.overscan ?? STATIC_BLOCK_OVERSCAN)
    : STATIC_BLOCK_OVERSCAN
  const maxMounted = isFiniteNumber(input.maxMounted ?? STATIC_BLOCK_MAX_MOUNTED)
    ? (input.maxMounted ?? STATIC_BLOCK_MAX_MOUNTED)
    : STATIC_BLOCK_MAX_MOUNTED

  const position = Math.max(0, isFiniteNumber(scrollTop) ? scrollTop : 0)
  const bottom = position + viewportHeight
  const last = blockCount - 1

  // 可视区内首块:最后一个 offsets[i] <= position 的 i;末块:最后一个 offsets[i] < bottom
  const coreStart = Math.min(last, firstIndexCovering(offsets, position))
  let coreEnd = coreStart
  for (let i = coreStart; i <= last; i += 1) {
    if ((offsets[i] ?? 0) >= bottom) break
    coreEnd = i
  }

  let start = Math.max(0, coreStart - overscan)
  let end = Math.min(last, coreEnd + overscan)

  // 上限兜底:先砍 overscan、绝不砍可视区内的块(与 windowing.ts 同一条让位顺序)
  if (end - start + 1 > maxMounted) {
    const coreSpan = coreEnd - coreStart + 1
    start =
      coreSpan >= maxMounted
        ? coreStart
        : Math.max(0, coreStart - Math.floor((maxMounted - coreSpan) / 2))
    end = Math.min(last, start + maxMounted - 1)
  }

  const paddingTop = Math.max(0, offsets[start] ?? 0)
  const paddingBottom = Math.max(0, totalHeight - (offsets[end + 1] ?? totalHeight))

  return { enabled: true, start, end, paddingTop, paddingBottom, reason: null }
}

/** 把 `renderBlocks` 按窗口切成 "上占位 / 挂载区 / 下占位" 三段(纯函数,可单测)。 */
export function sliceBlocksForWindow<T>(
  blocks: readonly T[],
  window: StaticBlockWindow,
): { readonly above: number; readonly mounted: readonly T[]; readonly below: number } {
  if (!window.enabled) return { above: 0, mounted: blocks, below: 0 }
  const start = Math.max(0, Math.min(blocks.length, window.start))
  const end = Math.min(blocks.length, window.end + 1)
  return {
    above: start,
    mounted: blocks.slice(start, end),
    below: Math.max(0, blocks.length - end),
  }
}

/**
 * 未测高块的估计高度(px)。
 *
 * 取 160 —— 与 `components/chat/windowing.ts::ESTIMATED_ITEM_HEIGHT` 同值同理由:
 * 一段正文(200~400 字符渲染成 3~6 行)在 15px/1.6 行高下约 120~190px,160 是这一族的
 * 中位。**它只用于未挂载过的块**;挂载过的块一律用实测值覆盖(见 `buildStaticBlockOffsets`)。
 */
export const STATIC_BLOCK_ESTIMATED_HEIGHT = 160

/**
 * 把"实测高度 + 未测估计"拼成累计偏移表(长度 = blockCount + 1)。
 *
 * 为什么必须允许"部分实测":窗口化天生只挂一部分块,其余块**永远量不到**。
 * 若要求全量实测才能算窗口,判据就永远不成立(死锁:不挂就量不到,量不到就不挂)。
 * 这也是 Qoder 用 `estimateSize` + 测量回填同一套的原因(`@8298850`)。
 *
 * 估计值动态取"已测块的平均高",没有实测样本时用 `STATIC_BLOCK_ESTIMATED_HEIGHT`:
 * 同一份文档里块高分布相对集中,用已测均值会比一个全局常量更贴近本消息的排版。
 */
export function buildStaticBlockOffsets(input: {
  readonly blockCount: number
  /** 逐块实测高度;`undefined`/非有限值按"未测"处理 */
  readonly measured: readonly (number | undefined)[]
  readonly fallback?: number
}): { readonly offsets: number[]; readonly measuredCount: number } {
  const { blockCount } = input
  const measured = input.measured
  const fallback = isFiniteNumber(input.fallback ?? STATIC_BLOCK_ESTIMATED_HEIGHT)
    ? (input.fallback ?? STATIC_BLOCK_ESTIMATED_HEIGHT)
    : STATIC_BLOCK_ESTIMATED_HEIGHT

  let sum = 0
  let count = 0
  for (let i = 0; i < blockCount; i += 1) {
    const h = measured[i]
    if (isFiniteNumber(h) && h > 0) {
      sum += h
      count += 1
    }
  }
  const estimate = count > 0 ? sum / count : fallback

  const offsets: number[] = [0]
  let acc = 0
  for (let i = 0; i < blockCount; i += 1) {
    const h = measured[i]
    acc += isFiniteNumber(h) && h > 0 ? h : estimate
    offsets.push(acc)
  }
  return { offsets, measuredCount: count }
}

export const __test__ = { firstIndexCovering }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
