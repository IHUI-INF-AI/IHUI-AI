/**
 * UI 视觉资源 — 错误卡片 + 渐变 banner + 主题色系。
 *
 * 设计原则:
 * - 纯 chalk 实现,无新依赖
 * - truecolor 渐变(若终端支持),不支持时降级为单色
 * - 错误卡片含 ╭─╮ 边框 + 红色高亮 + stack 行号
 */

import chalk from 'chalk';

// === 错误卡片 ===

export interface ErrorCardOptions {
  /** 错误标题(默认 '错误') */
  title?: string;
  /** 错误类型(可选,如 'TypeError' 'NetworkError') */
  kind?: string;
  /** 文件路径 + 行号(可选) */
  location?: { file: string; line?: number; col?: number };
  /** 上下文代码片段(可选,数组,每个元素一行) */
  context?: string[];
  /** 是否打印 stack(默认 false) */
  stack?: string;
}

/** 渲染错误卡片:╭─ ERROR ╮ 边框 + 红色高亮 + 可选 stack */
export function renderErrorCard(message: string, opts: ErrorCardOptions = {}): string[] {
  const lines: string[] = [];
  const title = opts.title ?? '错误';
  const headerWidth = 50;
  const headerText = ` ${chalk.red.bold('✗')} ${chalk.red.bold(title)} ${opts.kind ? chalk.dim(`[${opts.kind}]`) : ''} `;
  const padLen = Math.max(0, headerWidth - headerText.length);
  lines.push(chalk.red(`╭─${headerText}${'─'.repeat(padLen)}─╮`));
  // 消息(可多行)
  const msgLines = message.split('\n');
  for (const ml of msgLines) {
    lines.push(chalk.red('│') + `  ${ml}`);
  }
  // 位置
  if (opts.location) {
    const loc = opts.location;
    const locStr = `📄 ${loc.file}${loc.line ? `:${loc.line}` : ''}${loc.col ? `:${loc.col}` : ''}`;
    lines.push(chalk.red('│') + `  ${chalk.dim(locStr)}`);
  }
  // 上下文代码
  if (opts.context && opts.context.length > 0) {
    lines.push(chalk.red('├─ 上下文 ' + '─'.repeat(40)));
    opts.context.forEach((c, i) => {
      lines.push(chalk.red('│') + `  ${chalk.dim(String(i + 1).padStart(3))} ${c}`);
    });
  }
  // stack
  if (opts.stack) {
    lines.push(chalk.red('├─ Stack ' + '─'.repeat(42)));
    const stackLines = opts.stack.split('\n').slice(0, 6);
    for (const sl of stackLines) {
      lines.push(chalk.red('│') + `  ${chalk.dim(sl.trim())}`);
    }
  }
  lines.push(chalk.red('╰' + '─'.repeat(headerWidth + 2) + '╯'));
  return lines;
}

// === 渐变 banner ===

/**
 * 检测终端是否支持 truecolor(24-bit)。
 * 检测方式:COLORTERM 环境变量含 truecolor 或 24bit。
 */
export function supportsTruecolor(): boolean {
  try {
    const ct = process.env.COLORTERM ?? '';
    return ct.includes('truecolor') || ct.includes('24bit');
  } catch {
    return false;
  }
}

/** HSL → RGB(用于生成渐变色) */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** 生成 cyan → magenta 渐变 banner(若支持 truecolor) */
export function renderBannerGradient(lines: string[]): string[] {
  if (lines.length === 0) return [];
  if (!supportsTruecolor()) {
    // 降级为单色 cyan
    return lines.map((l) => chalk.cyan(l));
  }
  const out: string[] = [];
  const total = lines.length;
  for (let i = 0; i < total; i++) {
    // hue 从 180 (cyan) 渐变到 320 (magenta)
    const hue = 180 + (i / Math.max(1, total - 1)) * 140;
    const [r, g, b] = hslToRgb(hue, 80, 65);
    const color = chalk.rgb(r, g, b);
    out.push(color(lines[i]!));
  }
  return out;
}

/** 渐变分隔条(若支持 truecolor) */
export function gradientSeparator(width = 50): string {
  if (!supportsTruecolor()) return chalk.cyan.dim('─'.repeat(width));
  let out = '';
  for (let i = 0; i < width; i++) {
    const hue = 180 + (i / width) * 140;
    const [r, g, b] = hslToRgb(hue, 80, 65);
    out += chalk.rgb(r, g, b)('─');
  }
  return out;
}

// === 主题色系 ===

export type Theme = 'mint' | 'dark' | 'cyber';

export interface ThemePalette {
  primary: (s: string) => string;
  secondary: (s: string) => string;
  accent: (s: string) => string;
  success: (s: string) => string;
  warning: (s: string) => string;
  error: (s: string) => string;
  dim: (s: string) => string;
  banner: (s: string) => string;
}

const MINT: ThemePalette = {
  primary: chalk.cyan,
  secondary: chalk.magenta,
  accent: chalk.yellow,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  dim: chalk.dim,
  banner: (s) => supportsTruecolor() && s.includes('██')
    ? renderBannerGradient(s.split('\n'))[0] ?? chalk.cyan(s)
    : chalk.cyan(s),
};

const DARK: ThemePalette = {
  primary: chalk.blue,
  secondary: chalk.magenta,
  accent: chalk.cyan,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  dim: chalk.gray,
  banner: chalk.blue,
};

const CYBER: ThemePalette = {
  primary: chalk.magenta,
  secondary: chalk.cyan,
  accent: chalk.yellow,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  dim: chalk.gray,
  banner: chalk.magenta,
};

const THEMES: Record<Theme, ThemePalette> = { mint: MINT, dark: DARK, cyber: CYBER };

/** 取当前主题(从 IHUI_THEME 环境变量读取,默认 mint) */
export function getTheme(): ThemePalette {
  try {
    const t = (process.env.IHUI_THEME ?? 'mint').toLowerCase() as Theme;
    return THEMES[t] ?? MINT;
  } catch {
    return MINT;
  }
}
