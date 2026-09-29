// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 终端显示宽度工具:本地化后单元格文案宽度会变(CJK 每字 2 列、拉丁 1 列),
// 表格对齐不得依赖 String.length,必须按可视宽度补位。
//
// ⚠️ 全仓**唯一**宽度出口:任何端内文件都不得再抄第二份 WIDE 表或第二个 charWidth。
// 两份实现今天真的分叉过(G-676):commands/task-status-line.ts 曾自带一份不含
// U+FE10-U+FE19 的私有表,同一个竖排字符在共享面记 2 列、在状态行面记 1 列,
// 于是状态行与表格按不同列宽截断同一句话。判据见 apps/cli/tests/g676-text-width-single-source.test.ts。
//
// 档位依据(逐段用 Unicode 派生尺子 wcwidth@1.0.1 现量,非凭感觉):
//   U+1100-U+115F Hangul Jamo 初声        → 2
//   U+2E80-U+A4CF CJK 部首/笔画/假名/兼容 → 2(注:U+303F 实为窄,罕见,未单列以免顺带改行为)
//   U+AC00-U+D7A3 Hangul 音节             → 2
//   U+F900-U+FAFF CJK 兼容表意文字        → 2
//   U+FE10-U+FE19 竖排形式 Vertical Forms → 2  ★ 保留:此族**确属全角宽**(wcwidth 逐点量得 2),
//                                          删表项会让它落回默认窄档,反而更错。
//   U+FE30-U+FE6F 兼容形式(竖排标点)     → 2
//   U+FF00-U+FF60 / U+FFE0-U+FFE6 全角形式 → 2(界外 U+FF61/U+FFE8 量得 1,故上界不放宽)
const WIDE_CHAR_RE =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u;
// 零宽字符(不占列)。原表缺这一族:变体选择符 U+FE00-U+FE0F、组合音符、ZWJ、
// 零宽空格/方向格式符此前被算成 1 列,把 emoji 修饰序列与带音标的文案整体撑宽。
// 依据:wcwidth 对 U+FE0F/U+200D/U+0301/U+2060 现量均为 0;类别 Mn/Me 即"非间距记号"
// (刻意不用 \p{M} —— 它含 Mc 间距记号,wcwidth 量得 1,套进来会把这些记号算成 0)。
const ZERO_WIDTH_RE = /[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u200B-\u200F\u202A-\u202E\u2060\uFE00-\uFE0F\p{Mn}\p{Me}]/u;
const ANSI_SEQUENCE_RE = /\u001b\[[0-9;]*m/gu;
const ANSI_SGR_RE = /\u001b\[[0-9;]*m/gu;

/**
 * 单个码位占几列:零宽 0 列、宽字符 2 列、其余 1 列。
 * 星平面(> U+FFFF)一律记 2 列 —— 与 wcwidth 自身的粗则同形,也符合终端里 emoji 占两格的
 * 实际渲染;已知不精确处:星平面的非 emoji 字符(如 U+10000 Linear B)也被记 2,
 * 这类字符不会出现在状态行/转录面,不为它另立第二份判据。
 */
export function charWidth(char: string): number {
  const cp = char.codePointAt(0);
  if (cp === undefined) return 0;
  if (ZERO_WIDTH_RE.test(char)) return 0;
  if (cp > 0xffff) return 2;
  return WIDE_CHAR_RE.test(char) ? 2 : 1;
}

/** 去掉 ANSI 序列后的可视宽度(CJK 记 2 列) */
export function visibleWidth(text: string): number {
  const plain = text.replace(ANSI_SEQUENCE_RE, '');
  let width = 0;
  for (const cluster of graphemes(plain)) {
    width += clusterWidth(cluster);
  }
  return width;
}

/**
 * 字素簇切分:代理对与 ZWJ 组合序列是一个整体,截断时不得从中间切开
 * (切开产出孤立代理 → 屏幕上是一个替换字符,而不是"少一个字")。
 * Intl.Segmenter 不可用时退化为码位迭代 —— 码位迭代仍不会拆代理对。
 */
// 结构化类型:不依赖 lib 是否带 Intl.Segmenter 声明,缺了也只是退化成码位迭代(仍不拆代理对)
interface GraphemeSegmenterLike {
  segment(input: string): Iterable<{ segment: string }>;
}
type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' | 'word' | 'sentence' },
) => GraphemeSegmenterLike;

const Segmenter: SegmenterCtor | undefined = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
const graphemeSegmenter: GraphemeSegmenterLike | null =
  typeof Segmenter === 'function' ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;

export function graphemes(text: string): string[] {
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

/** 一个字素簇占几列:ZWJ 序列融合成一个字形记 2 列,其余按码位宽度相加 */
export function clusterWidth(cluster: string): number {
  if (cluster.includes('\u200d')) return 2;
  let width = 0;
  for (const ch of cluster) width += charWidth(ch);
  return width;
}

/** 把文本拆成「ANSI 转义」与「字素簇」两类 token(转义宽度恒 0,不得被从中间切断) */
function tokens(text: string): Array<{ escape: boolean; value: string }> {
  const out: Array<{ escape: boolean; value: string }> = [];
  let last = 0;
  for (const m of text.matchAll(ANSI_SGR_RE)) {
    const at = m.index ?? 0;
    if (at > last) for (const cluster of graphemes(text.slice(last, at))) out.push({ escape: false, value: cluster });
    out.push({ escape: true, value: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) for (const cluster of graphemes(text.slice(last))) out.push({ escape: false, value: cluster });
  return out;
}

/**
 * 按**可视宽度**截断到 maxWidth 列(不是 String.length 的码元数),并保证
 * ANSI 转义不被切断、字素簇不被切开。超出即追加省略号且省略号本身计入预算;
 * 截断点之后仍出现的 ANSI 转义会原样带走 —— 否则颜色状态被留在"开着"的一面,
 * 后续整行都会带色(转义占 0 列,带出去不影响列宽)。
 */
export function clipToWidth(text: string, maxWidth: number, ellipsis = '…'): string {
  const budget = Math.max(0, Math.floor(maxWidth));
  if (visibleWidth(text) <= budget) return text;
  const markWidth = clusterWidth(ellipsis);
  const keep = budget - markWidth;
  const parts: string[] = [];
  let used = 0;
  let cut = false;
  for (const token of tokens(text)) {
    if (token.escape) {
      parts.push(token.value);
      continue;
    }
    if (cut) continue;
    const w = clusterWidth(token.value);
    if (used + w > keep) {
      cut = true;
      continue;
    }
    used += w;
    parts.push(token.value);
  }
  // 一个都放不下(maxWidth 小于省略号自身)时,宁可给空串也不产出超宽的一行
  return keep < 0 ? '' : `${parts.join('')}${ellipsis}`;
}

/** 按可视宽度补齐到 width 列;align=end 左对齐(默认),start 右对齐 */
export function padCell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const pad = ' '.repeat(Math.max(0, width - visibleWidth(text)));
  return align === 'right' ? pad + text : text + pad;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
