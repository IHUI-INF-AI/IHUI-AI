// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Mermaid 渲染预算(纯函数决策,零 DOM 依赖)。
 *
 * 防的是哪一型故障:对话里的 ```mermaid 块由客户端渲染
 * (`apps/web/src/components/ai/markdown-stream.tsx` → `MermaidDiagram`)。
 * 该链路上原有的两道防护都只管"多久渲一次",没有一道管"一次渲多久":
 *   - `useDebounce(code, 300)`:合并流式重解析**频率**
 *   - `MermaidErrorBoundary.componentDidCatch`:抓得到**抛错**,抓不到**挂死**
 * mermaid 的 parse + dagre layout 是主线程同步工作,并会在 native 层构造大 SVG
 * 字符串;模型若产出一张几千节点的图,一次 render 就能把主标签页钉死 —— 而事后
 * catch / 截断都来不及(工作已经在做)。所以门禁必须前置到"进入 render 之前"。
 *
 * 判据形状参考了竞品只读副本的三维预算 + 可见性档
 * (`.ihui-agent/tmp/zcode-study/zcode/packages/ui/src/lib/mermaidRenderBudget.ts`),
 * 但**未抄它的实现与数值**:下面三个上限全部由本仓实测形态推出,依据写在各常量注释里。
 *
 * 本文件刻意保持纯函数:不读 `document`、不读 `window`。页面可见性由调用方
 * 作为入参喂进来 —— 这样三条判据可以在 node 环境逐条断言,而不必起浏览器。
 */

/**
 * 三维上限 + 依据。
 *
 * 现仓实测语料(2026-09-27,`git grep '```mermaid'` 全跟踪面 + 按围栏配对提取,
 * 排除 CLI 源码里被文档注释反引号误配的两块伪样本):真实成文图只有 3 张,全在
 * `docs/enterprise-service/deployment-guide.md`,规模 739 / 775 / 785 字符、
 * 30 / 31 行、结构 token(nodes+edges)21 / 22 / 23。即**最大的一张离上限还差一个
 * 数量级** —— 预算不是用来拦正常图的,是拦模型偶尔吐出的病态尾部。
 */
export const MERMAID_RENDER_BUDGET = {
  /**
   * 源码字符上限。依据:本仓自己的流式节流已经判定"markdown 正文 >5,000 字符"
   * 就该把解析间隔拉到 400ms 才不卡标签页(`markdown-stream.tsx:684-689` 的
   * `len < 2000 / < 5000 / else` 三档)。mermaid 源码是纯图语法,同字符数的
   * parse+layout 成本严格高于 markdown,而它在流式期间每 300ms 就要重来一次。
   * 12,000 = 该"重解析拐点"的 2.4 倍,同时是仓内最大成文图(785 字符)的 ~15 倍,
   * 大致对应模型一次吐出 3,000+ token 的流程图 —— 再大就不是"渲染慢",是"渲染不完"。
   */
  maxSourceChars: 12_000,

  /**
   * 行数上限。依据:mermaid 一行最多一条语句(节点声明 / 边 / 指令),所以行数是
   * 语句数的上界。400 与字符档互洽(12,000 ÷ 30 字符/行 ≈ 400),两档不会出现
   * "其中一档永远先命中、另一档形同虚设"的静默偏置;它是仓内最大成文图(31 行)
   * 的 ~13 倍。
   */
  maxLines: 400,

  /**
   * 结构复杂度上限 = 节点声明数 + 边 token 数。依据:字符数与行数都能被注释、
   * 空行、长标签水到(12,000 个空格也能填满),而 dagre 的布局代价只随**图的真实
   * 规模**增长 —— 所以这一维才是"单次渲染成本"的直接代理。600 = 仓内最大成文图
   * (23)的 ~26 倍;按 600 条节点+边算,一张图在对话气泡的宽度里也早已不可读,
   * 继续渲染只是把主线程换成一堆用户看不清的像素。
   */
  maxStructuralComplexity: 600,
} as const

/**
 * 跳过渲染的原因。**封闭枚举,且刻意按维度分档** —— 折成一个 "too big" 就等于
 * 告诉用户"不知道哪里超限",也让单测无法证明"超字符"与"超结构"走的是不同分支。
 * 新增一档必须同时补 `MERMAID_SKIP_NOTICE_KEYS` 的取值(它是 Record<该类型, …>,
 * 少一条直接编译不过),以及三语言以上词表。
 */
export type MermaidSkipReason =
  /** 页面在后台:不是内容问题,回到前台即渲,调用方应显示占位而非降级提示 */
  | 'page-hidden'
  | 'source-too-large'
  | 'line-count-too-large'
  | 'structural-complexity-too-large'

/** 枚举全集的运行时载体:单测用它断言"提示词表没漏档",不靠人眼数。 */
export const MERMAID_SKIP_REASONS: readonly MermaidSkipReason[] = [
  'page-hidden',
  'source-too-large',
  'line-count-too-large',
  'structural-complexity-too-large',
] as const

/** 决策结论。`outcome` 而非布尔 `ok`,是为了让 skip 分支必须带 reason(类型层强制)。 */
export type MermaidRenderDecision =
  | { readonly outcome: 'render' }
  | { readonly outcome: 'skip'; readonly reason: MermaidSkipReason }

/** 三条量纲的测量结果。 */
export interface MermaidSourceMetrics {
  readonly sourceChars: number
  readonly lineCount: number
  readonly structuralComplexity: number
}

/** 决策入参:测量结果 + 页面可见性(由调用方读 DOM 后喂进来)。 */
export interface MermaidRenderBudgetInput extends MermaidSourceMetrics {
  readonly pageVisible: boolean
}

/**
 * 边 token 模式。顺序即判据:**长形态必须排在前**(JS 交替是"最左优先"而非"最长优先"),
 * 否则 `-->` 会把 `-->|label|` 之外的形态切碎、`--x` 会被 `--` 系列吞掉。
 * 覆盖 flowchart / sequence / class / state 四族常用连接符;漏掉的连接符只会让
 * 该条边不计入复杂度,即**偏向放过**,不会偏向误杀。
 */
const MERMAID_EDGE_PATTERN =
  /<-->|<-->>|<<-->|-->>|->>|-->|<->|<--|-.->|-\)\)|==>|---|~~~|--x|--o|x--|o--|->|<-/g

/**
 * 节点声明模式:`id[文字]` / `id(文字)` / `id{文字}`(`id[[文字]]` 也命中一次)。
 *
 * **两处有界都是判据的一部分,不是风格**:
 *  - 标识符长度封顶 `{0,63}`:不封顶时 `[\w-]*` 会在"一个超长无括号词元"上逐字符
 *    回溯,整条判据退化成 O(n²) —— 实测 200 KB 单行源码要 26 秒,而本函数正是要在
 *    **病态输入上先跑完**才拦得住渲染的,慢就等于没拦。封顶后同一份输入 40ms,
 *    真实图(300 节点)计数结果逐字不变。mermaid 的 id 超过 64 字符本就不再是真实图,
 *    少计只偏向"放过",不会误降级。
 *  - 方括号内容 `{0,500}`:同一条理由,防标签里塞半篇文档。
 */
const MERMAID_NODE_PATTERN =
  /[A-Za-z_][\w-]{0,63}(?:\[[^\]\n]{0,500}\]|\([^)\n]{0,500}\)|\{[^}\n]{0,500}\})/g

/**
 * 测量源码规模。纯函数:同样的入参恒得同样的结果,不做任何缓存也不需要 DOM。
 *
 * 先剥 `%%` 整行注释再量三档,理由:mermaid 自己忽略这些行,把它们算进"渲染成本"
 * 会让一条"注释很多、图很小"的源码被误降级 —— 而降级是不可逆的(用户看到的是源码)。
 */
export function measureMermaidSource(source: string): MermaidSourceMetrics {
  const lines = source.split('\n')
  let lineCount = 0
  let structuralComplexity = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('%%')) continue
    lineCount += 1
    structuralComplexity += countTokens(line, MERMAID_NODE_PATTERN)
    structuralComplexity += countTokens(line, MERMAID_EDGE_PATTERN)
  }

  return {
    // 字符档同样按剥注释后的正文量:与 lineCount / structuralComplexity 同口径,
    // 否则三档里两档量正文、一档量原文,阈值之间无法互相校验。
    sourceChars: countBodyChars(lines),
    lineCount,
    structuralComplexity,
  }
}

function countTokens(line: string, pattern: RegExp): number {
  const hits = line.match(pattern)
  return hits === null ? 0 : hits.length
}

function countBodyChars(lines: readonly string[]): number {
  let total = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('%%')) continue
    total += trimmed.length
  }
  return total
}

/**
 * 预算决策。**判序固定**:可见性 → 字符 → 行 → 结构。
 *
 * 可见性排第一是因为它的问题不是"这张图太大",而是"现在没人看":后台标签页里
 * mermaid 的同步布局照样吃主线程,而它换来的结果没有任何人正在看。
 * 三维同超时只报第一档命中 —— 病态输入会同时超三档,给一个确定的答案比给三个
 * 更强,也让单测能钉住判序不被顺手改动。
 */
export function decideMermaidRender(input: MermaidRenderBudgetInput): MermaidRenderDecision {
  if (!input.pageVisible) return { outcome: 'skip', reason: 'page-hidden' }
  if (input.sourceChars > MERMAID_RENDER_BUDGET.maxSourceChars) {
    return { outcome: 'skip', reason: 'source-too-large' }
  }
  if (input.lineCount > MERMAID_RENDER_BUDGET.maxLines) {
    return { outcome: 'skip', reason: 'line-count-too-large' }
  }
  if (input.structuralComplexity > MERMAID_RENDER_BUDGET.maxStructuralComplexity) {
    return { outcome: 'skip', reason: 'structural-complexity-too-large' }
  }
  return { outcome: 'render' }
}

/** 三档"内容超限"原因(= 需要落 `<pre>` 源码 + 提示的那些)。 */
export type MermaidContentSkipReason = Exclude<MermaidSkipReason, 'page-hidden'>

/**
 * 内容超限原因 → `a11y` 命名空间下的提示文案键。
 *
 * 刻意用 `Record<MermaidContentSkipReason, string>` 而不是 `switch`:少一档直接编译不过,
 * 而运行时 undefined 只会表现为"提示区渲染出 undefined"这种安静故障。
 * 也刻意**不给 `page-hidden` 建键** —— 后台标签页走"渲染中…"占位,回到前台即渲,
 * 把调度延迟写成"已降级"是对用户撒谎;且多一枚词包键就多一枚只会被取词器漏看的死键。
 */
export const MERMAID_SKIP_NOTICE_KEYS: Readonly<Record<MermaidContentSkipReason, string>> = {
  'source-too-large': 'mermaidSkipSourceTooLarge',
  'line-count-too-large': 'mermaidSkipLineCountTooLarge',
  'structural-complexity-too-large': 'mermaidSkipComplexityTooLarge',
}

/**
 * 是不是"内容超限"(而非"页面在后台")。
 *
 * 写成类型谓词而不是布尔工具:调用方拿到 narrowing,组件里 `t(MERMAID_SKIP_NOTICE_KEYS[reason])`
 * 因此能在类型层成立,不需要 `as` 断言(§3 类型零债)。
 */
export function isMermaidContentOverBudget(
  reason: MermaidSkipReason,
): reason is MermaidContentSkipReason {
  return reason !== 'page-hidden'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
