/**
 * Markdown 流式渲染器 — 纯 chalk 实现,无新依赖。
 *
 * 支持:
 * - 标题 H1-H6:色带 + 下划线 + 加粗
 * - 代码块 ```lang ... ```:带语言标签的外框 + 行号 + 内联语法高亮
 * - 行内代码 `code`:反色背景样式
 * - 列表 -/* + 缩进树形
 * - 引用 > :左侧色带
 * - 表格 | a | b |:列宽对齐
 * - 分隔线 ---:全宽分隔条
 * - 链接 [text](url):text 高亮 + url dim
 * - 加粗 ** / 斜体 * / 删除线 ~~:对应 chalk 装饰
 *
 * 灵感来源:marked / cliui / cli-highlight,但做减法 — 只保留高频语法,不引入新依赖。
 * 设计原则:流式友好(每行独立渲染),失败静默(不抛错,降级到原文本)。
 */

import chalk from 'chalk';

export interface RenderOptions {
  /** 终端宽度(默认 process.stdout.columns 或 80) */
  width?: number;
  /** 是否启用语法高亮(默认 true) */
  highlight?: boolean;
}

const DEFAULT_WIDTH = 80;

/** 取终端宽度,失败回退 80 */
function getWidth(opts?: RenderOptions): number {
  if (opts?.width && opts.width > 0) return opts.width;
  try {
    const w = process.stdout.columns;
    if (w && w > 0) return w;
  } catch {
    // 静默
  }
  return DEFAULT_WIDTH;
}

// === 代码块语法高亮(简化版,关键字/字符串/注释/数字) ===

const KEYWORD_SET = new Set([
  // JS/TS
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'break', 'continue', 'switch', 'case', 'default', 'try', 'catch', 'finally',
  'throw', 'new', 'class', 'extends', 'implements', 'interface', 'type', 'enum',
  'import', 'export', 'from', 'as', 'async', 'await', 'yield', 'typeof',
  'instanceof', 'in', 'of', 'void', 'null', 'undefined', 'true', 'false',
  'this', 'super', 'static', 'public', 'private', 'protected', 'readonly',
  'abstract', 'declare', 'namespace', 'module', 'require', 'console',
  // Python
  'def', 'elif', 'lambda', 'pass', 'with', 'raise', 'except', 'None', 'True',
  'False', 'and', 'or', 'not', 'is', 'in', 'self', 'cls', 'print',
  // Go
  'package', 'func', 'go', 'chan', 'defer', 'select', 'struct', 'map', 'range',
  // Rust
  'fn', 'let', 'mut', 'pub', 'use', 'mod', 'crate', 'impl', 'trait', 'match',
  // Shell
  'echo', 'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'find',
  'sudo', 'apt', 'brew', 'npm', 'pnpm', 'yarn', 'git', 'docker',
]);

/** 单行代码语法高亮(关键字/字符串/注释/数字/函数名) */
function highlightCodeLine(line: string, _lang: string): string {
  if (!line) return '';
  // 注释(// ... 或 # ...)
  let comment = '';
  const commentMatch = line.match(/(\/\/.*$|#.*$)/);
  if (commentMatch) {
    comment = chalk.dim.green(commentMatch[1]!);
    line = line.slice(0, commentMatch.index);
  }
  // 字符串("..." '...' `...`)
  const parts: string[] = [];
  let lastIdx = 0;
  const strRegex = /(["'`])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = strRegex.exec(line)) !== null) {
    parts.push(line.slice(lastIdx, m.index));
    parts.push(chalk.green(m[0]));
    lastIdx = m.index + m[0].length;
  }
  parts.push(line.slice(lastIdx));
  let highlighted = parts.join('');
  // 关键字
  highlighted = highlighted.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
    (word) => (KEYWORD_SET.has(word) ? chalk.cyan(word) : word),
  );
  // 数字
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, (n) => chalk.yellow(n));
  // 函数调用 name(
  highlighted = highlighted.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    (_, fn: string) => `${chalk.blue(fn)}(`,
  );
  return highlighted + comment;
}

// === 渲染单个代码块 ===

function renderCodeBlock(lines: string[], lang: string, opts?: RenderOptions): string[] {
  const width = getWidth(opts);
  const innerWidth = Math.min(width - 6, 100);
  const out: string[] = [];
  const label = lang || 'code';
  const headerBar = `─ ${label} ${'─'.repeat(Math.max(0, innerWidth - label.length - 3))}`;
  out.push(chalk.cyan(`  ┌${headerBar}┐`));
  lines.forEach((line, i) => {
    const num = chalk.dim(String(i + 1).padStart(3, ' '));
    const code = opts?.highlight === false ? line : highlightCodeLine(line, lang);
    // 超长截断
    const truncated = line.length > innerWidth ? line.slice(0, innerWidth - 1) + '…' : null;
    const display = truncated !== null ? chalk.dim(truncated) : code;
    out.push(chalk.cyan('  │') + ` ${num} ${display}`);
  });
  out.push(chalk.cyan(`  └${'─'.repeat(innerWidth + 2)}┘`));
  return out;
}

// === 表格对齐 ===

function renderTable(rows: string[][]): string[] {
  if (rows.length === 0) return [];
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    widths[c] = Math.max(...rows.map((r) => (r[c] ?? '').length));
  }
  const out: string[] = [];
  rows.forEach((row, i) => {
    const cells = row.map((cell, c) => {
      const text = (cell ?? '').trim();
      return c === 0 ? chalk.bold(text.padEnd(widths[c]!)) : text.padEnd(widths[c]!);
    });
    out.push(`  ${cells.join(chalk.dim(' │ '))}`);
    // 分隔行(表头之后)
    if (i === 0 && rows.length > 1) {
      const sep = widths.map((w) => '─'.repeat(w));
      out.push(`  ${chalk.dim(sep.join('─┼─'))}`);
    }
  });
  return out;
}

// === 主渲染函数 ===

export interface MarkdownRenderer {
  /** 处理一行,返回要打印的字符串数组(可空) */
  pushLine(line: string): string[];
  /** 流式结束后 flush 残留(代码块等) */
  flush(): string[];
}

export function createMarkdownRenderer(opts?: RenderOptions): MarkdownRenderer {
  const width = getWidth(opts);
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];

  return {
    pushLine(line: string): string[] {
      // 代码块边界
      const fenceMatch = line.match(/^```(\w*)/);
      if (fenceMatch) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLang = fenceMatch[1] || '';
          codeBuffer = [];
          return [];
        }
        // 结束代码块
        const out = renderCodeBlock(codeBuffer, codeLang, opts);
        inCodeBlock = false;
        codeLang = '';
        codeBuffer = [];
        return out;
      }
      if (inCodeBlock) {
        codeBuffer.push(line);
        return [];
      }
      // 分隔线 ---
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        return [chalk.cyan.dim('─'.repeat(Math.min(width, 80)))];
      }
      // 标题
      const h = line.match(/^(#{1,6})\s+(.+)$/);
      if (h) {
        const level = h[1]!.length;
        const text = h[2]!;
        const colors = [
          chalk.cyan.bold, chalk.cyan, chalk.magenta.bold,
          chalk.magenta, chalk.blue.bold, chalk.blue,
        ];
        const color = colors[level - 1] ?? chalk.dim;
        const prefix = '═'.repeat(Math.min(text.length * 2, width - 4));
        return ['', color(`  ${text}`), chalk.dim(`  ${prefix}`), ''];
      }
      // 引用
      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        return [`  ${chalk.cyan('│')} ${chalk.dim(quote[1]!)}`];
      }
      // 表格行(包含 |)
      if (line.includes('|') && line.trim().startsWith('|')) {
        // 简单实现:把后续连续 | 行收集起来一次性渲染
        // 这里只处理单行(流式友好),连续表格行需调用方累积
        const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
        return renderTable([cells]);
      }
      // 列表项
      const ul = line.match(/^(\s*)([-*+])\s+(.+)$/);
      if (ul) {
        const indent = ul[1]!.length;
        const marker = ul[2]!;
        const text = ul[3]!;
        const indentStr = '  '.repeat(indent);
        const markerColor = marker === '*' ? chalk.magenta : chalk.cyan;
        return [`${indentStr}${markerColor(`${marker} `)}${renderInline(text)}`];
      }
      // 有序列表
      const ol = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (ol) {
        const indent = ol[1]!.length;
        const num = ol[2]!;
        const text = ol[3]!;
        const indentStr = '  '.repeat(indent);
        return [`${indentStr}${chalk.cyan(`${num}.`)} ${renderInline(text)}`];
      }
      // 普通段落
      return [renderInline(line)];
    },
    flush(): string[] {
      if (inCodeBlock && codeBuffer.length > 0) {
        return renderCodeBlock(codeBuffer, codeLang, opts);
      }
      return [];
    },
  };
}

// === 行内 markdown 渲染 ===

export function renderInline(text: string): string {
  if (!text) return '';
  let out = text;
  // 链接 [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label: string, url: string) => `${chalk.cyan.underline(label)} ${chalk.dim(`(${url})`)}`,
  );
  // 行内代码 `code`
  out = out.replace(
    /`([^`]+)`/g,
    (_, code: string) => chalk.bgBlack.cyan(` ${code} `),
  );
  // 加粗 **text** 或 __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, t: string) => chalk.bold(t));
  out = out.replace(/__([^_]+)__/g, (_, t: string) => chalk.bold(t));
  // 斜体 *text* 或 _text_(避免与加粗冲突,要求前后非空白)
  out = out.replace(/(^|[^*])\*([^*\s][^*]*[^*\s]|[^*\s])\*(?!\*)/g, (_m, pre: string, t: string) => `${pre}${chalk.italic(t)}`);
  out = out.replace(/(^|[^_\w])_([^_\s][^_]*[^_\s]|[^_\s])_(?!_)/g, (_m, pre: string, t: string) => `${pre}${chalk.italic(t)}`);
  // 删除线 ~~text~~
  out = out.replace(/~~([^~]+)~~/g, (_, t: string) => chalk.dim.strikethrough(t));
  return out;
}
