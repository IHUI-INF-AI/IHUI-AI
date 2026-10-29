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
 * 相邻块**达到**该长度即封块(累积式分组阈值)。
 *
 * 2026-10-29 改判据:此前是"相邻两块**都短于**该值就合并"的贪心式,那个判据**不单调** ——
 * 已合并的一块(如 11 + 511 = 522 字)在末块继续增长、越过 512 之后不再满足"两块都短",
 * 于是又被**拆回两块**。实测阳性对照:`prev=["522字"] → next=["11字","512字"]`,
 * 判据当场报边界回退。这与我修掉的那个列表标记 bug 是同一种病(块边界随内容增长而回退),
 * 只是成因不同,所以必须一并修掉 —— 只修一头,渲染层的块 key 照样会错位。
 *
 * 现判据是**累积式**:从上一个封块点起累加,累计长度够了就封,封过之后不再回看。
 * 累积长度只随内容增长 ⇒ 已封的边界永不回退(单调性由此结构性地成立,不靠约定)。
 * 这也正是"每帧只重解析最后一块"能成立的前提。
 */
export const MARKDOWN_BLOCK_MERGE_THRESHOLD = 512

/** 空行后下一行以这些模式开头时,该空行不是安全切点(列表/缩进延续)。 */
const LIST_CONTINUATION_RE = /^\s*(?:[-*+]|\d+[.)])\s/

/**
 * 「列表标记还没写完」的形态(2026-10-29 立,流式切点回退根治)。
 *
 * 立因是实测出来的,不是猜的:流式下一个列表项是**逐字符到达**的,
 * `- ` 会先到成 `-`,`1. ` 会先到成 `1`、`1.` 两拍。这些中间态**不匹配**
 * `LIST_CONTINUATION_RE`(它要求标记后跟空白),于是被当成普通非空行 ⇒
 * 前一个空行**当场落成切点**;下一拍标记写全,切点又被撤销。
 *
 * 后果不是"慢一点":`splitMarkdownBlocks` 的块 key 取序号,切点一撤数组变短、
 * 中段内容错位 ⇒ 前缀块整列按新下标复用/重挂,`StableBlock` 的 memo 全线失效
 * (每帧整段重解析),跨树重挂还会把代码块折叠态与 mermaid 渲染结果一起打回。
 * 实测样本 `# 分析结论…## 小节 A\n\n- ` 处切点集从 `[8,27,36]` 回退到 `[8,27]`。
 *
 * 判据:行**整体**只是一个可能的列表标记前缀(可带前导缩进),即
 *   `-` / `*` / `+` / `1` / `1.` / `1)` / `- `(尾随空白尚未跟正文)
 * 这类行在流式里可能是"列表项写了一半",本拍**不落地切点、也不丢弃候选**,
 * 留到下一拍再判。失效方向恒为「本拍少切一次」(更保守),不会多切一刀。
 */
const LIST_MARKER_PREFIX_RE = /^\s*(?:[-*+]|\d+[.)]?)\s*$/

/**
 * 空行后的这一行,是否足以判定"该空行是/不是切点"。
 *
 * `false` = **本拍判不了**(列表标记可能还没写完),调用方必须保留候选切点等下一拍。
 * 这一格与 `LIST_CONTINUATION_RE` 是两个不同的问题,不可互相顶替:
 *   - `LIST_CONTINUATION_RE` 答"这是列表延续 ⇒ 这里绝不能切";
 *   - 本函数答"这行还没定性 ⇒ 这里**暂时**不能下结论"。
 * 只有两者都为否,空行才是安全切点。
 */
function isUndecidableListMarker(line: string): boolean {
  return LIST_MARKER_PREFIX_RE.test(line)
}

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
        } else if (isUndecidableListMarker(line)) {
          // 列表标记可能只写了一半(流式逐字符到达)—— 本拍判不了:
          // 既不落地切点,也不丢弃候选,留给下一拍。见 isUndecidableListMarker 注记。
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

  // 先按切点原样切片(拼回必等于 content),再按累积阈值封块
  const raw: string[] = []
  let start = 0
  for (const cut of cuts) {
    raw.push(content.slice(start, cut))
    start = cut
  }
  raw.push(content.slice(start))

  // 累积式封块:封过的点不再回看 ⇒ 已封边界随内容增长永不移动(单调性由结构保证)。
  // 贪心式的"两块都短就合并"不单调:合并产生的块长大越过阈值后会被重新拆开。
  const blocks: string[] = []
  let buffer = ''
  for (const block of raw) {
    buffer += block
    if (buffer.length >= MARKDOWN_BLOCK_MERGE_THRESHOLD && buffer.trim()) {
      blocks.push(buffer)
      buffer = ''
    }
  }
  // 尾部残量**独立成块**(生长尾巴)。刻意不并回最后一块:并回去会让末块内容
  // 在下一拍被"切开重来"(末块无法以自身为前缀延伸),单调性当场破。
  if (buffer) blocks.push(buffer)

  return { blocks }
}

/**
 * 流式切分的**单调性判据**(2026-10-29 立)。
 *
 * ── 为什么必须单独有这个出口 ──
 * `splitMarkdownBlocks` 只保证"拼回等于原文"这一条**静态**不变量。流式真正依赖的是
 * 另一条**跨拍**不变量:**内容纯追加时,已落地的块边界不得移动**。渲染层用序号做块 key,
 * 边界一退,数组当场变短、中段内容错位,前缀块的 memo 按新下标全部失效(等于每帧整段
 * 重解析),跨树重挂还会把代码块折叠态、mermaid 渲染结果一起打回。
 *
 * 这条不变量此前**没有任何机器判据**,而实测它真的会破:列表标记逐字符到达时
 * (`- ` 先到成 `-`),前一拍的空行被误判成安全切点、下一拍又撤销 —— 实测样本
 * `# 分析结论…## 小节 A\n\n- ` 处块边界从 `[8,27,36]` 退到 `[8,27]`。
 *
 * ── 「已落地」的口径(这一条写错就会假阴性)──
 * 第一版把末块整体排除比较,结果**漏掉了 bug 本体**:原始失效型正是「末切点撤销」——
 * 上一拍 `[a, b, c]`(c 之前那一刀已落地),这一拍 c 的切点消失 ⇒ `[a, b]`,
 * c 被并回 active。若末块不参与比较,这一型判成 stable、判据形同虚设。
 *
 * 正确口径:**每一块都要在场**,但末块允许「生长」而不允许「被动」——
 *  - `next[i]` 缺席 ⇒ 块消失(切点被撤销 / 数组变短)⇒ 错位;
 *  - 非末块:必须逐字节等值(已落地块的内容不许再变);
 *  - 末块:必须**以自己为前缀延伸**(`next[i].startsWith(prev[i])`),即内容可以继续长,
 *    但不许换成别的内容、也不许被前面吞掉。
 *
 * ── 判据本身 ──
 *  1. 内容必须**以上次内容为前缀**(纯追加)。不是 ⇒ `appendOnly: false`,
 *     **这一型不可判**(上游改写/重载属合法的非追加路径),调用方必须按"不可复用"处理,
 *     不得读成"边界稳定"。
 *  2. 是纯追加 ⇒ 按上面口径逐块核对。
 *  3. 全过 ⇒ `stable: true` 并报出新增块数。
 *
 * 失效方向固定:**判不出就说判不出**(`appendOnly: false`),绝不默认稳定。
 */
export interface BlockStabilityInput {
  /** 上一拍参与渲染的块(顺序即当时的下标次序;末项是生长尾巴) */
  readonly previousBlocks: readonly string[]
  /** 上一拍的完整内容(用于判纯追加) */
  readonly previousSource: string
  /** 这一拍的完整内容 */
  readonly source: string
  /** 这一拍的有序块序列 */
  readonly nextBlocks: readonly string[]
}

export interface BlockStability {
  /** 这一拍是否纯追加(内容以上一拍为前缀)。false ⇒ 其余字段无意义,不得当稳定读 */
  readonly appendOnly: boolean
  /** 已落地的块边界是否全部保持原位(仅 appendOnly 为真时才有意义) */
  readonly stable: boolean
  /** 第一个错位的块下标;`stable` 为真或不可判时 `null` */
  readonly firstDriftIndex: number | null
  /**
   * 本拍新增的块数(纯追加且稳定时 = nextBlocks.length - previousBlocks.length)。
   * 不可判时为 `null` —— 与"没有新增"是两件事。
   */
  readonly appendedBlocks: number | null
  /**
   * 本拍是否属**首次开启切分**:上一拍还是"单块 = 全文"的未切分态,这一拍因跨过
   * `minLength` 门槛才开始分块。
   *
   * 这是可预期的**一次性**转变(不是边界回退),但它确实会让前缀块当场全部重建,
   * 所以必须显式归类而不是默默按 stable 放过 —— 否则"每帧只重解析最后一块"的证据链上
   * 就留了一格说不清的东西。此时内容刚过门槛(长度约等于 minLength),重建代价可忽略。
   */
  readonly splitEnabled: boolean
}

export function judgeBlockStability(input: BlockStabilityInput): BlockStability {
  const { previousBlocks, previousSource, source, nextBlocks } = input

  if (previousSource.length > 0 && !source.startsWith(previousSource)) {
    return {
      appendOnly: false,
      stable: false,
      firstDriftIndex: null,
      appendedBlocks: null,
      splitEnabled: false,
    }
  }

  // 上一拍是"未切分态"(单块即全文)且这一拍开始分块 ⇒ 首次开启切分,单独归类
  const previousWasUnsplit =
    previousBlocks.length === 1 &&
    previousSource.length > 0 &&
    previousBlocks[0] === previousSource &&
    nextBlocks.length > 1
  if (previousWasUnsplit) {
    return {
      appendOnly: true,
      stable: false,
      firstDriftIndex: null,
      appendedBlocks: nextBlocks.length - previousBlocks.length,
      splitEnabled: true,
    }
  }

  const lastIndex = previousBlocks.length - 1
  for (let i = 0; i < previousBlocks.length; i += 1) {
    const prev = previousBlocks[i] ?? ''
    const next = nextBlocks[i]
    // 块消失 = 切点被撤销 / 数组变短,一律错位(末块也不例外)
    if (next === undefined) {
      return {
        appendOnly: true,
        stable: false,
        firstDriftIndex: i,
        appendedBlocks: null,
        splitEnabled: false,
      }
    }
    const ok = i === lastIndex ? next.startsWith(prev) : next === prev
    if (!ok) {
      return {
        appendOnly: true,
        stable: false,
        firstDriftIndex: i,
        appendedBlocks: null,
        splitEnabled: false,
      }
    }
  }

  return {
    appendOnly: true,
    stable: true,
    firstDriftIndex: null,
    appendedBlocks: nextBlocks.length - previousBlocks.length,
    splitEnabled: false,
  }
}
