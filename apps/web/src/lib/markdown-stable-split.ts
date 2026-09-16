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
 */

/** 内容短于该值不启用切分(与 MarkdownStream throttle 中档对齐)。 */
export const MARKDOWN_SPLIT_MIN_LENGTH = 1500

/** 空行后下一行以这些模式开头时,该空行不是安全切点(列表/缩进延续)。 */
const LIST_CONTINUATION_RE = /^\s*(?:[-*+]|\d+[.)])\s/

export interface MarkdownSplit {
  /** 冻结前缀(可为空串);渲染层 memo 缓存 */
  stable: string
  /** 尾部活跃段(至少包含最后一个块);每 tick 重新解析 */
  active: string
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

  let fenceOpen = false
  /** 最后一个安全空行之后的首个非空白字符索引(即 active 段起点)。 */
  let splitStart = -1

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
        splitStart = pendingBlank.end
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
          splitStart = pendingBlank.end
          pendingBlank = null
        }
      }
    } else {
      // 围栏内部:空行是代码内容,清掉候选
      pendingBlank = null
    }

    offset = lineEnd + 1
  }

  // 无安全切点 → 不切
  if (splitStart <= 0 || splitStart >= content.length) {
    return { stable: '', active: content }
  }

  return {
    stable: content.slice(0, splitStart),
    active: content.slice(splitStart),
  }
}
