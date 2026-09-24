// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「最近已读文件」状态与压缩后重建。
 *
 * 问题:摘要压缩会把"我读过 src/foo.ts"这件事整条压掉,模型下一轮只能重读一遍
 * (实测表现是同一个文件读两次,白烧一次工具往返 + 一次窗口)。
 * 因此**压缩完成后必须重建一段提醒**,把已读事实留在窗口里。
 *
 * 两级上限(这是本模块的全部难度):
 *   - **单文件上限** `maxCharsPerEntry`:一条提醒能给这个文件花多少字符。
 *     放不下就**降级**成"读过但体积过大,需要时重新分块读"的引用,而不是截断半句路径 ——
 *     半截路径会让模型去读一个不存在的文件,比不提醒更糟。
 *   - **总量上限** `maxTotalChars`:提醒本身也是上下文,不能为省一次重读而长期占几千字符。
 *     超上限就只留最近若干条,其余如实计数("另有 N 项略"),不静默丢。
 *
 * 注:本仓 `apps/cli/src/context.ts` 只记 UsageLedger 与压缩包装,**没有**已读文件状态,
 * 所以这里自建;跨会话恢复时通过 `collectFromMessages()` 从残留信封里回捞,不依赖内存。
 */

import { parseEnvelope, type ParsedEnvelope } from './envelope.js';

/** 一条已读记录 */
export interface ReadStateEntry {
  /** 相对工作区根的路径(工具参数原样),信封化时是产物文件路径 */
  path: string;
  /** 记录来源:真实文件 / 落盘产物 */
  kind: 'file' | 'artifact';
  tool: string;
  chars: number;
  lines: number;
  /** 正文是否被信封化(即从没完整进过上下文) */
  enveloped: boolean;
  /** 首行摘录(判"这是什么文件"用),已去行号前缀 */
  excerpt: string;
  turn: number;
}

/** 提醒段的预算档位 */
export interface ReadStateLimits {
  /** 最多列几条 */
  maxEntries: number;
  /** 单文件上限:一条提醒允许给这个文件花多少字符 */
  maxCharsPerEntry: number;
  /** 整段提醒的总量上限 */
  maxTotalChars: number;
}

export const READ_STATE_DEFAULT_LIMITS: ReadStateLimits = {
  maxEntries: 12,
  maxCharsPerEntry: 200,
  maxTotalChars: 1_600,
};

/** 提醒段标题(测试与幂等判定按它识别) */
export const READ_STATE_REMINDER_HEADER = '[最近已读文件 · 压缩后重建]';
/** 超限降级文案(单文件超预算时用它替代摘录) */
export const READ_STATE_OVERSIZED_HINT = '读过但体积过大,需要时重新分块读';

/** 各工具"文件路径参数"的键名(read_file 用 path,list_dir 用 path/glob 用 pattern…) */
const PATH_ARG_KEYS = ['path', 'file', 'file_path', 'filePath', 'filename'] as const;

/** 去掉 read_file 输出的 4 位行号前缀,拿到可读首行 */
function stripLineNumberPrefix(line: string): string {
  return line.replace(/^\s*\d{1,6}[ \t]/, '').trim();
}

/** 从结果正文取第一行有效内容作摘录(跳过空行与信封标记行) */
function firstMeaningfulLine(output: string, cap: number): string {
  for (const raw of output.split('\n')) {
    const line = stripLineNumberPrefix(raw);
    if (!line) continue;
    if (line.startsWith('[[')) continue;
    return line.length > cap ? `${line.slice(0, cap)}…` : line;
  }
  return '';
}

/** 从工具参数里尽力提取文件路径(取不到返回 null,不猜目录) */
export function extractPathArg(args: Record<string, unknown> | undefined): string | null {
  if (!args || typeof args !== 'object') return null;
  for (const key of PATH_ARG_KEYS) {
    const v = (args as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

/**
 * 已读文件跟踪器。
 * 状态挂在 runToolLoop 的一次运行上(与 UsageLedger 同生命周期);
 * 会话恢复场景由 `collectFromMessages()` 从历史消息里的信封回捞。
 */
export class ReadStateTracker {
  private readonly byPath = new Map<string, ReadStateEntry>();

  /** 记录一条已读(同路径后写覆盖前写:体积/行数以最近一次为准) */
  record(entry: ReadStateEntry): void {
    if (!entry.path) return;
    this.byPath.set(entry.path, { ...entry });
  }

  /** 从一次工具调用+结果记录(read_file/list_dir 这类带路径参数的只读工具) */
  recordToolCall(opts: {
    toolName: string;
    args?: Record<string, unknown>;
    output: string;
    turn: number;
    enveloped: boolean;
    /** 信封化后的产物路径(有则同时记一条 artifact) */
    artifactPath?: string;
    /** 原始正文总字符数(信封化时 output 只是信封,体积要用这个值) */
    originalChars?: number;
    originalLines?: number;
  }): ReadStateEntry | null {
    const filePath = extractPathArg(opts.args);
    const lines = opts.output ? opts.output.split('\n').length : 0;
    const entry: ReadStateEntry = {
      path: filePath ?? opts.artifactPath ?? opts.toolName,
      kind: filePath ? 'file' : 'artifact',
      tool: opts.toolName,
      chars: opts.originalChars ?? opts.output.length,
      lines: opts.originalLines ?? lines,
      enveloped: opts.enveloped,
      excerpt: firstMeaningfulLine(opts.output, 80),
      turn: opts.turn,
    };
    this.record(entry);
    // 文件本体之外,信封指向的产物也要单独记一条:恢复后模型能直接分块读那个路径
    if (filePath && opts.artifactPath) {
      this.record({
        ...entry,
        path: opts.artifactPath,
        kind: 'artifact',
        excerpt: `${filePath} 的完整输出`,
      });
    }
    return entry;
  }

  /**
   * 从解析好的信封登记两条事实:
   *   - 源文件被读过(有 `源文件:` 行时)—— 这才是"别重复读同一个文件"的依据;
   *   - 完整正文在哪个产物路径 —— 需要时按它分块读。
   */
  recordFromEnvelope(env: ParsedEnvelope, turn: number): void {
    const excerpt = firstMeaningfulLine(env.preview, 80);
    if (env.sourcePath) {
      this.record({
        path: env.sourcePath,
        kind: 'file',
        tool: env.toolName,
        chars: env.totalChars,
        lines: env.totalLines,
        enveloped: true,
        excerpt,
        turn,
      });
    }
    this.record({
      path: env.artifactPath,
      kind: 'artifact',
      tool: env.toolName,
      chars: env.totalChars,
      lines: env.totalLines,
      enveloped: true,
      excerpt: env.sourcePath ? `${env.sourcePath} 的完整输出` : excerpt,
      turn,
    });
  }

  /**
   * 从消息历史回捞已读事实(会话恢复 / tracker 冷启动)。
   * 只认信封里的结构化字段,不对正文做启发式猜测。
   */
  collectFromMessages(messages: Array<{ role: string; content: string }>): number {
    let recovered = 0;
    for (const msg of messages) {
      if (typeof msg?.content !== 'string' || msg.content.length === 0) continue;
      const envelope = parseEnvelope(msg.content);
      if (!envelope) continue;
      this.recordFromEnvelope(envelope, 0);
      recovered += 1;
    }
    return recovered;
  }

  /** 全部记录(按最后被读轮次升序,提醒段取"最近的在末尾") */
  entries(): ReadStateEntry[] {
    return [...this.byPath.values()].sort((a, b) => a.turn - b.turn);
  }

  get size(): number {
    return this.byPath.size;
  }

  reset(): void {
    this.byPath.clear();
  }

  /**
   * 重建提醒段。
   * @returns 无任何记录时返回 null(不注入空段,避免每轮多一条噪音消息)
   */
  buildReminder(limits: Partial<ReadStateLimits> = {}): string | null {
    const opts: ReadStateLimits = { ...READ_STATE_DEFAULT_LIMITS, ...limits };
    const all = this.entries();
    if (all.length === 0) return null;

    const recent = all.slice(-Math.max(1, opts.maxEntries));
    const lines: string[] = [`${READ_STATE_REMINDER_HEADER} 以下文件本轮之前已读过,不要重复整文件读取:`];
    let used = lines[0]!.length;
    let omitted = all.length - recent.length;

    // 从最近的往回填:预算不够时先牺牲"更早的",而不是"最近的读过的忘了"
    const rendered: string[] = [];
    for (let i = recent.length - 1; i >= 0; i--) {
      const line = renderEntry(recent[i]!, opts.maxCharsPerEntry);
      if (used + line.length > opts.maxTotalChars) {
        omitted += 1;
        continue;
      }
      used += line.length;
      rendered.unshift(line);
    }
    if (rendered.length === 0) return null;
    lines.push(...rendered);
    if (omitted > 0) lines.push(`- (另有 ${omitted} 项因提醒预算上限略去,需要时按路径直接读)`);
    return lines.join('\n');
  }
}

/** 单条渲染:放不下摘录就降级成"体积过大"引用,绝不截半截路径 */
function renderEntry(entry: ReadStateEntry, maxCharsPerEntry: number): string {
  const size = `${entry.chars.toLocaleString('en-US')} 字符/${entry.lines} 行`;
  const full = `- ${entry.path} (${size}${entry.enveloped ? ',正文未进上下文' : ''}) ${entry.excerpt}`.trimEnd();
  if (full.length <= maxCharsPerEntry) return full;
  // 降级档:只留路径 + 体积 + 出路,保证不超过单文件上限(路径本身超长时无解,如实长)
  const degraded = `- ${entry.path} (${size}) ${READ_STATE_OVERSIZED_HINT}`;
  return degraded.length <= maxCharsPerEntry ? degraded : `- ${entry.path} ${READ_STATE_OVERSIZED_HINT}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
