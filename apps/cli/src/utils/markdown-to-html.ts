// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 受控子集 Markdown → HTML 渲染器(零依赖、零网络、零外链)。
 *
 * 为什么自写(而不是引库):分享页必须在离线/断网下也能读到正文。对照程序 WorkBuddy 的两份
 * 自包含报告现读 externalScripts=0 / linkTags=0 ⇒ 零外链是它的产品承诺;而本仓
 *   ① 没有 Node 侧 markdown→HTML 出口(packages/shared 只有 `artifactToMarkdown` 反向,
 *      web 侧靠 react-markdown,CLI 不可用);
 *   ② `marked` 只是 leva / mermaid / isomorphic-dompurify 的**传递依赖**,躺在
 *      `node_modules/.pnpm/` 虚拟库里,仓内无任何 package.json 声明它,`require.resolve('marked')`
 *      实测 MODULE_NOT_FOUND ⇒ 用它等于新增依赖(机主禁)。
 * 故按③自写,并明确写清支持范围与不处理的形态(不假装全支持)。
 *
 * 支持范围见 MARKDOWN_SUPPORTED_SYNTAX,不处理见 MARKDOWN_UNSUPPORTED_SYNTAX,两者与用例同源。
 *
 * 安全口径:所有文本节点必经 escapeHtml(HTML 块不解析、只转义);链接只允许 http/https/mailto
 * 与页内 `#` 锚点(javascript:/data:/file:/协议相对 `//host` 一律降级为纯文本);图片不产出
 * `<img src>`(降级为文字引用),以免分享页对外发请求而破坏"零外链"。
 */

/** 本渲染器保证支持的语法(与 apps/cli/tests/share-self-contained.test.ts 同源断言) */
export const MARKDOWN_SUPPORTED_SYNTAX: readonly string[] = [
  'ATX 标题 #..######',
  '围栏代码块 ``` / ~~~(可选语言标签,未闭合按到文末处理)',
  '引用 >(可嵌套)',
  '无序列表 - * + 与有序列表 1. / 1)(按缩进嵌套)',
  'GFM 管道表格(含 :--- / ---: / :---: 对齐)',
  '分割线 --- / *** / ___',
  '段落(空行分隔;段内换行一律输出 <br>,等价 GFM breaks:true;行尾两个空格同样 <br>)',
  '行内代码 `x`、粗体 **x**/__x__、斜体 *x*/_x_、删除线 ~~x~~',
  '链接 [t](url) 与图片 ![alt](url)(图片降级为文字引用)',
];

/** 本渲染器**不**处理的形态(遇到按纯文本转义输出,不猜语义) */
export const MARKDOWN_UNSUPPORTED_SYNTAX: readonly string[] = [
  '4 空格缩进代码块',
  'setext 标题(=== / --- 下划线式)',
  '列表项内的多段续行(空行即结束该列表)',
  '脚注 [^1] 与引用式链接 [x][1]',
  '任务列表复选框语义([ ] / [x] 按纯文本输出)',
  '裸 URL 自动链接',
  '链接标题语法 [t](url "title") 的 title 部分',
  '原生 HTML 块(一律转义为文本,不解析)',
  '图片内联(base64 与外链一律降级为文字引用)',
];

/** 图片降级后的前缀文案(单一出处,用例据此断言) */
export const IMAGE_REF_PREFIX = '[图片] ';

/** 渲染选项 */
export interface MarkdownRenderOptions {
  /** 这些语言标签的围栏代码块渲染为默认折叠的 `<details>`(如会话里的 `tool_call`) */
  readonly collapseLanguages?: readonly string[];
  /** 嵌套块(引用/列表)最大深度,超出后把更深内容折叠到当前层(保证递归终止且不丢内容) */
  readonly maxNestingDepth?: number;
}

const DEFAULT_MAX_NESTING_DEPTH = 8;

/** 允许成为可点击链接的目标协议(其余按纯文本输出) */
const SAFE_LINK_TARGET_RE = /^(?:https?:\/\/|mailto:|#)/i;

// 语言标签后的附加说明允许出现,但**不得**再含围栏字符:同行成对的 ```x``` 不认作开栏,
// 否则会把后文整段吞进代码块(比"少识别一个 info string"严重得多的失效方向)。
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*([A-Za-z0-9_+\-.]*)(?:[ \t]+[^`~]*)?$/;
const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/;
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE_RE = /^ {0,3}>[ \t]?(.*)$/;
const LIST_RE = /^([ \t]*)([-*+]|\d+[.)])[ \t]+(.*)$/;
const TABLE_SEP_RE = /^ {0,3}\|?[ \t]*:?-{1,}:?[ \t]*(?:\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;
const HARD_BREAK_RE = /(?:[ \t]{2,}|\\)[ \t]*$/;

/** HTML 实体转义 —— markdown→HTML 链路上唯一的转义出口(share.ts 亦 import 它,不得另有第二份) */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** markdown → HTML 主体(不含 `<html>` 外壳);输出保证不含 `<script src=` 与 `<link ` */
export function renderMarkdownToHtml(markdown: string, options: MarkdownRenderOptions = {}): string {
  const normalized = markdown.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  const state: RenderState = {
    collapseLanguages: (options.collapseLanguages ?? []).map((l) => l.toLowerCase()),
    maxDepth: options.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH,
  };
  return renderBlocks(normalized.split('\n'), state, 0);
}

interface RenderState {
  readonly collapseLanguages: readonly string[];
  readonly maxDepth: number;
}

/** 行内规则:每条都在"剩余原文"上找最早命中,先命中的规则优先输出 */
interface InlineRule {
  readonly re: RegExp;
  readonly render: (match: RegExpMatchArray) => string;
}

const INLINE_RULES: readonly InlineRule[] = [
  { re: /`([^`\n]+)`/, render: (m) => `<code>${escapeHtml(m[1] ?? '')}</code>` },
  { re: /!\[([^\]\n]*)\]\(\s*([^)\s]*)\s*\)/, render: (m) => renderMediaRef(m[1] ?? '', m[2] ?? '') },
  { re: /\[([^\]\n]*)\]\(\s*([^)\s]*)\s*\)/, render: (m) => renderLink(m[1] ?? '', m[2] ?? '') },
  { re: /~~([^~\n]+)~~/, render: (m) => `<del>${renderInline(m[1] ?? '')}</del>` },
  { re: /\*\*([^\s*][^*\n]*?)\*\*/, render: (m) => `<strong>${renderInline(m[1] ?? '')}</strong>` },
  { re: /__([^_\n]+)__(?![A-Za-z0-9_])/, render: (m) => `<strong>${renderInline(m[1] ?? '')}</strong>` },
  { re: /\*([^*\n]+)\*/, render: (m) => `<em>${renderInline(m[1] ?? '')}</em>` },
  {
    re: /(^|[^A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/,
    render: (m) => `${m[1] ?? ''}<em>${renderInline(m[2] ?? '')}</em>`,
  },
];

/** 行内渲染:命中规则的片段交规则处理,其余片段整体转义(故原文里的 `<script>` 只会变成文本) */
export function renderInline(raw: string): string {
  let out = '';
  let rest = raw;
  while (rest.length > 0) {
    let hitIndex = -1;
    let hit: InlineRule | null = null;
    let hitMatch: RegExpMatchArray | null = null;
    for (const rule of INLINE_RULES) {
      const m = rule.re.exec(rest);
      if (m && m[0].length > 0 && (hitIndex === -1 || m.index < hitIndex)) {
        hitIndex = m.index;
        hit = rule;
        hitMatch = m;
      }
    }
    if (!hit || !hitMatch || hitIndex < 0) {
      out += escapeHtml(rest);
      break;
    }
    out += escapeHtml(rest.slice(0, hitIndex));
    out += hit.render(hitMatch);
    rest = rest.slice(hitIndex + hitMatch[0].length);
  }
  return out;
}

function isSafeLinkTarget(target: string): boolean {
  if (/\s/.test(target)) return false;
  if (target.includes('&#')) return false; // 阻断实体混淆的伪协议
  return SAFE_LINK_TARGET_RE.test(target);
}

function renderLink(text: string, target: string): string {
  if (!isSafeLinkTarget(target)) {
    return escapeHtml(`[${text}](${target})`);
  }
  return `<a class="md-link" href="${escapeHtml(target)}" rel="noopener noreferrer">${renderInline(text)}</a>`;
}

/** 图片 → 文字引用:不产出 `<img src>`,分享页因此对外零请求 */
function renderMediaRef(alt: string, target: string): string {
  const label = alt || target;
  const inner = isSafeLinkTarget(target)
    ? `<a class="md-link" href="${escapeHtml(target)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    : escapeHtml(label);
  return `<span class="md-media-ref">${IMAGE_REF_PREFIX}${inner}</span>`;
}

interface ListItem {
  readonly indent: number;
  readonly ordered: boolean;
  readonly text: string;
}

function renderBlocks(lines: readonly string[], state: RenderState, depth: number): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    if (FENCE_RE.test(line)) {
      const block = renderFenced(lines, i, state);
      out.push(block.html);
      i = block.next;
      continue;
    }
    if (HR_RE.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = (heading[1] ?? '#').length;
      out.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
      i += 1;
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length) {
        const quoted = QUOTE_RE.exec(lines[i] ?? '');
        if (!quoted) break;
        inner.push(quoted[1] ?? '');
        i += 1;
      }
      const body = depth < state.maxDepth ? renderBlocks(inner, state, depth + 1) : inner.map((l) => `<p>${renderInline(l)}</p>`).join('\n');
      out.push(`<blockquote class="md-quote">${body}</blockquote>`);
      continue;
    }
    if (LIST_RE.test(line)) {
      const block = renderListGroup(lines, i, state, depth);
      out.push(block.html);
      i = block.next;
      continue;
    }
    if (isTableStart(lines, i)) {
      const block = renderTable(lines, i);
      out.push(block.html);
      i = block.next;
      continue;
    }
    const para = renderParagraph(lines, i);
    out.push(para.html);
    i = para.next;
  }
  return out.join('\n');
}

function isBlockStart(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? '';
  return (
    line.trim() === '' ||
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableStart(lines, index)
  );
}

function renderParagraph(lines: readonly string[], start: number): { html: string; next: number } {
  const parts: string[] = [];
  let i = start;
  while (i < lines.length && !isBlockStart(lines, i)) {
    parts.push(renderInline((lines[i] ?? '').replace(HARD_BREAK_RE, '')));
    i += 1;
  }
  // 段内换行一律 <br>:会话文本按行读,软换行折成空格会把中文挤在一起(等价 GFM breaks:true)
  return { html: `<p>${parts.join('<br>')}</p>`, next: i };
}

function renderFenced(lines: readonly string[], start: number, state: RenderState): { html: string; next: number } {
  const opener = FENCE_RE.exec(lines[start] ?? '') ?? ['', '```', ''];
  const fence = opener[1] ?? '```';
  const lang = (opener[2] ?? '').trim();
  const closer = new RegExp(`^ {0,3}${fence}[ \t]*$`);
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !closer.test(lines[i] ?? '')) {
    body.push(lines[i] ?? '');
    i += 1;
  }
  const consumed = i < lines.length ? i + 1 : i; // 未闭合围栏:到文末即止,不吞下一枚开栏
  const code = `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`;
  if (lang && state.collapseLanguages.includes(lang.toLowerCase())) {
    return {
      html: `<details class="md-collapse"><summary>折叠内容(${escapeHtml(lang)})</summary>${code}</details>`,
      next: consumed,
    };
  }
  return { html: code, next: consumed };
}

function readListItems(lines: readonly string[], start: number): { items: ListItem[]; next: number } {
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length && LIST_RE.test(lines[i] ?? '')) {
    const m = LIST_RE.exec(lines[i] ?? '');
    if (!m) break;
    const indentText = (m[1] ?? '').replace(/\t/g, '  ');
    const marker = m[2] ?? '-';
    items.push({ indent: indentText.length, ordered: /^\d/.test(marker), text: m[3] ?? '' });
    i += 1;
  }
  return { items, next: i };
}

function renderListGroup(
  lines: readonly string[],
  start: number,
  state: RenderState,
  depth: number,
): { html: string; next: number } {
  const read = readListItems(lines, start);
  const parts: string[] = [];
  let i = 0;
  while (i < read.items.length) {
    const item = read.items[i];
    if (!item) break;
    const level = renderListLevel(read.items, i, item.indent, item.ordered, state, depth);
    parts.push(level.html);
    // 兜底:某层没消费任何条目就前进一步,保证循环必然终止
    i = level.next > i ? level.next : i + 1;
  }
  return { html: parts.join('\n'), next: read.next };
}

function renderListLevel(
  items: readonly ListItem[],
  start: number,
  indent: number,
  ordered: boolean,
  state: RenderState,
  depth: number,
): { html: string; next: number } {
  const tag = ordered ? 'ol' : 'ul';
  const rendered: string[] = [];
  let i = start;
  while (i < items.length) {
    const item = items[i];
    if (!item || item.indent < indent || item.ordered !== ordered) break;
    if (item.indent > indent) {
      const child = renderListLevel(items, i, item.indent, item.ordered, state, depth + 1);
      rendered.push(`<li>${child.html}</li>`);
      i = child.next;
      continue;
    }
    let inner = renderInline(item.text);
    i += 1;
    const peek = items[i];
    if (peek && peek.indent > indent) {
      // 深度封顶时把更深缩进折回当前层 ⇒ 既不丢内容也保证递归终止
      const childIndent = depth < state.maxDepth ? peek.indent : indent;
      const child = renderListLevel(items, i, childIndent, peek.ordered, state, depth + 1);
      inner += child.html;
      i = child.next;
    }
    rendered.push(`<li>${inner}</li>`);
  }
  return { html: `<${tag} class="md-list">${rendered.join('')}</${tag}>`, next: i };
}

function isTableStart(lines: readonly string[], index: number): boolean {
  const header = lines[index];
  const separator = lines[index + 1];
  if (!header || !separator) return false;
  return header.includes('|') && TABLE_SEP_RE.test(separator) && separator.includes('-');
}

function splitRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  for (const ch of trimmed) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (ch === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.replace(/\\\|/g, '|').trim());
}

function alignmentClassOf(separatorCell: string | undefined): string {
  const cell = (separatorCell ?? '').trim();
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return ' class="md-cell-center"';
  if (right) return ' class="md-cell-right"';
  return '';
}

function renderTable(lines: readonly string[], start: number): { html: string; next: number } {
  const headerCells = splitRow(lines[start] ?? '');
  const separators = splitRow(lines[start + 1] ?? '');
  const aligns = headerCells.map((_, idx) => alignmentClassOf(separators[idx]));
  const bodyRows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim() !== '') {
    bodyRows.push(splitRow(lines[i] ?? ''));
    i += 1;
  }
  const head = headerCells.map((cell, idx) => `<th${aligns[idx] ?? ''}>${renderInline(cell)}</th>`).join('');
  const rows = bodyRows
    .map((row) => `<tr>${row.map((cell, idx) => `<td${aligns[idx] ?? ''}>${renderInline(cell)}</td>`).join('')}</tr>`)
    .join('');
  return {
    html: `<table class="md-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`,
    next: i,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
