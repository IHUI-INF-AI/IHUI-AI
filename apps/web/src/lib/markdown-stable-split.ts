// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式 markdown 稳定段/活跃段切分(P3 #35 流式 markdown 增量解析缓存,2026-09-16 立)。
 *
 * 痛点:流式回答每次 tick 都把**全部** content 交给 react-markdown 重新 parse,
 * 长回答(>5k 字符)在低端设备上锯齿卡顿。但流式是纯追加——前面的块一旦后面
 * 出现了新的块边界就**永远不会再变**,重复解析它们是纯浪费。
 *
 * 方案:把 content 切成 `stable`(前缀,内容冻结)+ `active`(尾部,继续生长)两段。
 * 渲染层对 stable 用 React.memo 缓存——字符串引用不变 → 整段跳过 parse;
 * 每 tick 只重新解析 active。这是"稳定块 AST 缓存"的务实等价实现:
 * memo 命中时连 parse 都不进,比缓存 AST 更彻底。
 *
 * **切分安全规则**(错切比慢更糟,宁可不切):
 *  1. 代码围栏(``` 行首)内部不切——围栏内空行是代码内容
 *  2. 空行后下一行以列表标记/缩进开头不切——会把一个有序列表切成两个
 *     (编号从 1 重置,视觉 bug)
 *  3. 内容短于阈值不切——短回答全量解析足够快,双容器无收益
 *  4. 只在**最后一个安全空行**处切一刀(active 保留尽量多,stable 命中率最高)
 *
 * 2026-10-30 块级增量渲染:`stable` 这一段此前是"一整块 memo",块内任何一处变化
 * (切点只追加,但 active 晋升进 stable 时尾部仍在长)都要整段重 parse。现按**全部**
 * 安全切点(`collectSafeCutPoints`,与单刀同一把尺子)拆成有序块,渲染层每块一个
 * memo 容器 ⇒ 每帧只重解析最后一块。切点扫描器仍是同一份 —— `splitMarkdownStable`
 * 继续消费同一份切点表,只取最后一个。跨空行的链接定义 / 数学块两把尺子一起放弃切分。
 */

/** 内容短于该值不启用切分(与 MarkdownStream throttle 中档对齐)。 */
export const MARKDOWN_SPLIT_MIN_LENGTH = 1500

/**
 * 相邻块**都短于**该值时合并(碎片化阈值)。
 * 每块各自一次 parse 有固定开销(插件链 + AST 构建);几十字符的小块单独成容器
 * 比合并后一起解析更慢,也更容易把段间距压没。512 是经验档:正常段落/列表段
 * 体量,低于它两块合起来仍是一次轻量 parse。
 */
export const MARKDOWN_BLOCK_MERGE_THRESHOLD = 512

/** 空行后下一行以这些模式开头时,该空行不是安全切点(列表/缩进延续)。 */
const LIST_CONTINUATION_RE = /^\s*(?:[-*+]|\d+[.)])\s/

/**
 * 跨空行生效、且解析作用域是**单次 parse** 的构造。
 * 单刀(stable/active 两棵 ReactMarkdown)与块级切分共用这一闸:
 *  - 引用式链接定义 `[label]: url` —— 定义与 `[text][label]` 落到两棵树,
 *    引用退化成字面量,流结束结构不变,链接永久失效;
 *  - `$$` 数学块 —— 块内空行被当切点,公式被切成两半。
 *
 * 错切比慢更糟:命中即整段不切,失效方向零劣化。
 */
const LINK_REFERENCE_DEFINITION_RE = /^\s{0,3}\[[^\]\n]+\]:/m
const DISPLAY_MATH_OPEN_RE = /^\s{0,3}\$\$/m

function mustNotSplitAcrossParses(content: string): boolean {
  return LINK_REFERENCE_DEFINITION_RE.test(content) || DISPLAY_MATH_OPEN_RE.test(content)
}

export interface MarkdownSplit {
  /** 冻结前缀(可为空串);渲染层 memo 缓存 */
  stable: string
  /** 尾部活跃段(至少包含最后一个块);每 tick 重新解析 */
  active: string
}

/**
 * 收集全文所有安全切点(升序;每值 = 切点后首字符的索引,即下一块起点)。
 *
 * 判据与 P3 #35 单刀时代逐字一致:
 *  - 围栏(``` / ~~~,行首缩进 ≤3)内部不切——围栏内空行是代码内容;
 *  - 切点只落在空行之后,且其后首个非空行**不是**列表标记/缩进延续
 *    (否则有序列表会被切成两段、编号从 1 重置);
 *  - 空行后紧跟围栏行属安全(围栏是独立块,围栏前的空行可切)。
 *
 * 单一真相源:splitMarkdownStable 取最后一个切点、splitMarkdownBlocks 取全部,
 * 两者不许各写一份扫描器(§0.6)。
 */
function collectSafeCutPoints(content: string): number[] {
  const cuts: number[] = []
  let fenceOpen = false
  const lines = content.split('\n')
  let offset = 0
  /** 上一个空行(行首到行尾)的 [start, end) 信息;遇到"下一行安全"时才落地切点。 */
  let pendingBlank: { end: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const lineEnd = offset + line.length

    // 代码围栏状态机(行首 ``` 或 ~~~;容错缩进 ≤3 空格)
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      // 落围栏边界:先看这个围栏前的空行是否可作切点(围栏是独立块,前面空行安全)
      if (!fenceOpen && pendingBlank) {
        cuts.push(pendingBlank.end)
        pendingBlank = null
      }
      fenceOpen = !fenceOpen
      offset = lineEnd + 1
      continue
    }

    if (!fenceOpen) {
      if (line.trim() === '') {
        // 空行:暂记为候选切点,等"下一行安全"确认
        pendingBlank = { end: lineEnd + 1 }
      } else if (pendingBlank) {
        // 空行后的第一个非空行:列表/缩进延续 → 该空行不安全,弃用
        if (LIST_CONTINUATION_RE.test(line) || /^\s/.test(line)) {
          pendingBlank = null
        } else {
          cuts.push(pendingBlank.end)
          pendingBlank = null
        }
      }
    } else {
      // 围栏内部:空行是代码内容,清掉候选
      pendingBlank = null
    }

    offset = lineEnd + 1
  }

  return cuts
}

/**
 * 把流式 markdown 文本切分为 [stable, active] 两段。
 *
 * @returns stable 为空串 = 不切分(内容过短/无安全切点),active 为全文。
 *          纯函数无副作用,调用方用 useMemo 包裹。
 */
export function splitMarkdownStable(content: string): MarkdownSplit {
  if (content.length < MARKDOWN_SPLIT_MIN_LENGTH) {
    return { stable: '', active: content }
  }

  // 与块级同一闸:切开后 stable/active 是两棵独立 parse,链接定义与公式都会坏
  if (mustNotSplitAcrossParses(content)) {
    return { stable: '', active: content }
  }

  const cuts = collectSafeCutPoints(content)
  // 最后一个安全切点(active 保留尽量多,stable 命中率最高)
  const splitStart = cuts.length > 0 ? cuts[cuts.length - 1] : undefined

  // 无安全切点 → 不切
  if (splitStart === undefined || splitStart <= 0 || splitStart >= content.length) {
    return { stable: '', active: content }
  }

  return {
    stable: content.slice(0, splitStart),
    active: content.slice(splitStart),
  }
}

/**
 * 块级增量切分(2026-10-30 立):按全部安全切点把 content 拆成**有序块**。
 *
 * 渲染层对每块各挂一个 memo 容器 ⇒ 流式追加时前缀块字符串不变、memo 命中,
 * 每帧只重解析最后一块(active 侧另算)。
 *
 * 不变量(测试写成断言型):
 *  - `blocks.join('') === content` 逐字节等值;
 *  - 除最后一块外每块都以切点处的换行结尾(切点恒在空行之后、围栏之外);
 *  - 内容短于 `minLength` 或无安全切点 ⇒ `[content]`(不切);
 *  - 碎片合并:相邻两块都短于 `MARKDOWN_BLOCK_MERGE_THRESHOLD` 时合并
 *    (贪心从左到右,合并结果参与下一次"是否够长"判断)。
 *
 * 纯函数,零副作用;`minLength` 可注入以便测试与上层复用。
 */
export function splitMarkdownBlocks(
  content: string,
  minLength: number = MARKDOWN_SPLIT_MIN_LENGTH,
): { blocks: string[] } {
  if (content.length < minLength) {
    return { blocks: [content] }
  }

  const cuts = collectSafeCutPoints(content)
  if (cuts.length === 0) {
    return { blocks: [content] }
  }

  // 跨空行生效的构造(链接定义 / 数学块)被切开即改变语义 ⇒ 整段不切
  if (mustNotSplitAcrossParses(content)) {
    return { blocks: [content] }
  }

  // 先按切点原样切片(拼回必等于 content),再按碎片阈值做相邻合并
  const raw: string[] = []
  let start = 0
  for (const cut of cuts) {
    raw.push(content.slice(start, cut))
    start = cut
  }
  raw.push(content.slice(start))

  const blocks: string[] = []
  for (const block of raw) {
    const prev = blocks[blocks.length - 1]
    if (
      prev !== undefined &&
      prev.length < MARKDOWN_BLOCK_MERGE_THRESHOLD &&
      block.length < MARKDOWN_BLOCK_MERGE_THRESHOLD
    ) {
      blocks[blocks.length - 1] = prev + block
    } else {
      blocks.push(block)
    }
  }

  return { blocks }
}
