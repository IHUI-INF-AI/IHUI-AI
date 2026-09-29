// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内置工具集 — 文件读取/搜索/命令执行工具。
 *
 * 复用 file-ops.ts 的本地实现(read/ls/grep/glob/bash),
 * 包装为 Tool 接口供 Agent 工具循环调用。
 * 灵感来源:参考行业 Agent 框架的 tools crate 设计(terminal/file edit/search)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSandboxed, runSandboxedAsync } from '../sandbox/index.js';
import type { SandboxResult } from '../sandbox/index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { highlightCode } from '../highlight.js';
import {
  registerTask,
  registerFailedTask,
  getTask,
  listTasks,
  getTaskOutput,
  waitForTask,
  killTask,
  formatSettledTaskNotification,
} from './background-registry.js';
import { projectTaskRoster, formatTaskRoster } from './task-roster-projection.js';
import type { Tool, ToolContext, ToolResult } from './index.js';
import { mapTerminalState, ABORTED_BEFORE_COMPLETION_NOTE } from './failure-classification.js';
import { todo_write } from './todo-write.js';
import { ask_user_question } from './ask-user.js';
import { gateCommandExecution, describeCommandBlock } from './command-safety.js';
import { tryParseJson, isRecord } from '../util/json.js';
import { withMissingFileSuggestion } from '../util/file-suggest.js';
import {
  FILE_UNCHANGED_STUB,
  createReadFileStateKey,
  getReadFileStateMap,
  isCachedReadFresh,
} from './read-file-state.js';
import {
  EMPTY_FILE_REMINDER,
  READ_MAX_OUTPUT_TOKENS,
  buildOffsetBeyondEofReminder,
  buildReadOutputTooManyTokensMessage,
  createTokenCapPartialView,
  estimateReadTokens,
} from './read-text-budget.js';
import {
  terminal_open,
  terminal_send,
  terminal_read,
  terminal_resize,
  terminal_close,
} from './terminal.js';

const MAX_READ_LINES = 500;
const MAX_GREP_RESULTS = 50;
const MAX_GLOB_RESULTS = 50;
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.output', '.wxt', 'target']);

/**
 * read_file 的**字节**上限。此前只有 `MAX_READ_LINES` 一道行数闸、没有字节闸,而那道闸
 * 在本处结构上不起作用:实现是 `fs.readFileSync(abs,'utf-8')` —— **先把整个文件读进内存**,
 * 再 `split('\n')` 切前 500 行。于是行闸既不省内存也不防"行数少而单行超长"的文件
 * (minified JS、单行 JSON、CSV 导出),峰值内存与文件实际大小同阶。
 *
 * 取值依据:500 行 × 常见源码行宽(<200 B)≈ 100 KB,给 5 倍余量到 **512 KB** ——
 * 足以容纳合法的超长行(打包产物 / data URI)而不至于让一次 read_file 把半兆字节
 * 塞进模型上下文。超限**必须如实截断并带出总量**(见 `read_file` 里的 ASCII 标注行),
 * 不得静默变短:静默变短等于伪造完整性。
 *
 * `export` 只为让回归测试引用**同一个数**,而不是在测试里再抄一份字面量 ——
 * 抄一份就是第二处真相:哪天一改,测试会安静地验一个仓库里已不存在的边界。
 */
export const MAX_READ_BYTES = 512 * 1024;

/**
 * 二进制嗅探窗口(字节)。
 *
 * 病灶:此处注释长期写着"前 1024 字节内有 NULL 视为二进制",而实现只
 * `fs.readSync(fd, buf, 0, 8, 0)` 读 **8 字节** —— 散文与实现分叉。两边都有理,
 * 就说明其中一边没被落实,所以选窗口要给依据而不是随手对齐:
 *  - magic number 判据最长 6 字节(RAR / 7Z),8 字节对它**够用**;
 *  - "通用 NULL 嗅探"却是个**采样判定**:8 字节的样本会把"前几字节是 ASCII 头、
 *    载荷从第 9 字节起才是二进制"的文件读成文本,进而整份按 utf-8 解码回灌模型。
 * 故把实现**升**到注释承诺的 1024,而不是把注释降到 8 —— 改小实现是"把文档里承诺的
 * 防护删掉",改大实现才是"把承诺的防护装上",只有后者算修 bug。
 * 成本:一次 1 KB 读,相对紧随其后的文件读取可忽略。
 *
 * `export` 同 `MAX_READ_BYTES`:回归要造"NULL 恰在窗口内 / 窗外"的成对夹具,
 * 在测试里再抄一个 1024 就成了第二处真相(窗口一改,测试安静地验一条不存在的边界)。
 */
export const BINARY_SNIFF_BYTES = 1024;

// ==================== Ripgrep 集成 ====================
//
// 引擎标识与"降级留痕"的口径对齐本仓 Python 侧的
// `apps/ai-service/app/services/rg_fallback_parity.py`(`ENGINE_RIPGREP` /
// `ENGINE_PYTHON_WALK` + `degraded_reason`),不另造一套说法。名字刻意不逐字照抄
// (`js-walk` 而非 `python-walk`):两侧确实不是同一份实现,同名会被读成同源。
// 共用的是那一条规矩:**降级必须留痕,不得用 rg 的名义报告一次纯遍历扫描**;
// 而"rg 跑了但报错"尤其不得折叠成"确实没有匹配"(那正是本票的病灶)。
const ENGINE_RIPGREP = 'ripgrep';
const ENGINE_JS_WALK = 'js-walk';

/** rg 的退出码约定(与 Python 侧同一份注释):0=有匹配,1=无匹配(合法结论),>=2=真失败。 */
const RG_EXIT_OK = 0;
const RG_EXIT_NO_MATCH = 1;

/**
 * 把外部命令的多行 stderr 压成一行并截断。
 * 两个理由:① 换行会把结论行冲散(下游按行读);② 外部内容里的换行是注入面,不进结论。
 */
function oneLine(raw: string, max = 300): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * 结论尾注:这一份答案出自**哪条通道**、**为什么走了降级**。
 * `degradedReason` 非 null = 本次不是 rg 答的,原因必须让调用方(模型)看得见 ——
 * 它决定"没有匹配"是一句可信的否定,还是一句"我没查出来"。
 * 文案用 ASCII:这一行是给模型读的事实,而本文件受守门 70(硬编码中文基线棘轮,
 * 额度 = max(基线 JSON 该文件一条, 该文件 HEAD 自身的命中数))约束 ——
 * 新增一个中文界面字面量就是凭空 +1,越过额度即拦提交。同款取舍见 `tools/index.ts`
 * 的 `execBudgetResult` 注释(它的结论与这里相同:**给模型读的事实走 ASCII**)。
 */
function engineNote(engine: string, degradedReason: string | null): string {
  const parts = [`engine=${engine}`];
  if (degradedReason) parts.push(`degraded_reason=${oneLine(degradedReason)}`);
  return `\n[${parts.join(' ')}]`;
}

interface RipgrepProbe {
  available: boolean;
  /** available=false 时的原因 —— 探测失败必须可解释,不得只留一个布尔。 */
  reason: string | null;
}

let ripgrepProbe: RipgrepProbe | null = null;

/**
 * 探测 rg 是否可用,并**把"为什么不可用"一起带出来**。
 *
 * 旧实现 `hasRipgrep(): boolean` 探测失败(rg 不在 PATH / 派生失败 / 超时)只留 false,
 * 调用方静默走 JS walk —— 于是"这台机没装 rg"与"装了 rg 且确实搜不到"在结果上同形,
 * 而后者才是模型敢下否定结论的唯一依据。
 */
function probeRipgrep(): RipgrepProbe {
  if (ripgrepProbe) return ripgrepProbe;
  try {
    const result = spawnSync('rg', ['--version'], { encoding: 'utf-8', windowsHide: true, timeout: 5000 });
    if (result.status === RG_EXIT_OK) {
      ripgrepProbe = { available: true, reason: null };
    } else {
      const detail = result.error instanceof Error ? result.error.message : oneLine(String(result.stderr ?? ''));
      ripgrepProbe = {
        available: false,
        reason: `rg --version did not succeed (exit code ${result.status ?? 'null'}${detail ? `: ${detail}` : ''})`,
      };
    }
  } catch (err) {
    ripgrepProbe = { available: false, reason: `rg probe threw: ${err instanceof Error ? err.message : String(err)}` };
  }
  return ripgrepProbe;
}

interface RgMatch {
  file: string;
  line: number;
  text: string;
}

/**
 * 一次 rg 调用的**三态**结论。
 *
 * 病灶(本票修的):旧签名是 `RgMatch[] | null` —— 只有"spawn 失败 / 被杀"才回 null
 * 去走 JS walk;而 rg 退出码 **2**(正则语法错:默认引擎不支持 `(?!`、`(?<=` 等
 * lookaround,实测 15.0.0 回 `regex parse error` + 空 stdout)既不降级也不报错,
 * 空数组被下游 `if (rgMatches.length === 0) return '未找到匹配'` 当成合法答案。
 * 于是坏正则的搜索**永远**"什么都没找到",而调用方读到的是 `success:true` ——
 * 模型据此下"确实不存在"的幻觉式否定结论。
 *
 * 三态把这三件事分开:有匹配 / 确认无匹配(rg 退出码 1)/ 失败。失败**不得**折叠进无匹配。
 */
type RgOutcome =
  | { state: 'hits'; matches: RgMatch[]; warning: string | null }
  | { state: 'no-match' }
  | { state: 'failed'; reason: string };

function execRipgrep(pattern: string, opts: { cwd: string; searchPath: string; type?: string; glob?: string; max: number }): RgOutcome {
  const probe = probeRipgrep();
  if (!probe.available) return { state: 'failed', reason: probe.reason ?? 'ripgrep is unavailable' };
  const args = ['--json', '--no-heading', '-i', `--max-count=${opts.max}`];
  if (opts.type) args.push('--type', opts.type);
  if (opts.glob) args.push('-g', opts.glob);
  // `--` 收掉另一条同类入口:以 `-` 开头的 pattern 会被 rg 当成命令行选项解析而退出码 2,
  // 在旧实现里那同样表现为"没有匹配"。Python 侧 search_file_contents 也带这个分隔符。
  args.push('--', pattern, opts.searchPath);
  const result = spawnSync('rg', args, {
    cwd: opts.cwd,
    encoding: 'utf-8',
    timeout: 30_000,
    maxBuffer: 5 * 1024 * 1024,
    windowsHide: true,
  });
  const stderr = oneLine(typeof result.stderr === 'string' ? result.stderr : '');
  // 进程没正常起来(ENOENT / 超时被杀 / status=null):这是失败,不是"没有匹配"。
  if (result.error || result.status === null) {
    const why = result.error instanceof Error ? result.error.message : 'no exit code (process killed or timed out)';
    return { state: 'failed', reason: `ripgrep did not finish: ${why}` };
  }
  const status = result.status;
  if (status >= 2) {
    return {
      state: 'failed',
      reason:
        `ripgrep exit ${status}: ${stderr || '(no stderr)'} - ` +
        'most likely the pattern uses syntax the default rg engine rejects (lookaround such as (?! or (?<= needs -P/PCRE2) or is an invalid regex; use a supported pattern or simplify it',
    };
  }
  if (status === RG_EXIT_NO_MATCH) {
    // rg 报"没有匹配"却又抱怨了点别的 —— 这一份"没有"不可信,按失败处理。
    return stderr
      ? { state: 'failed', reason: `ripgrep reported no match but wrote to stderr: ${stderr}` }
      : { state: 'no-match' };
  }
  const matches: RgMatch[] = [];
  let unparsed = 0;
  for (const line of ((result.stdout as string) ?? '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = tryParseJson(line);
      if (
        isRecord(obj) &&
        obj.type === 'match' &&
        isRecord(obj.data) &&
        isRecord(obj.data.path) &&
        typeof obj.data.path.text === 'string'
      ) {
        const data = obj.data as { path: { text: string }; line_number?: unknown; lines?: unknown };
        const lines = isRecord(data.lines) && typeof data.lines.text === 'string' ? data.lines.text : '';
        matches.push({
          file: path.relative(opts.cwd, data.path.text),
          line: typeof data.line_number === 'number' ? data.line_number : 0,
          text: lines.trimEnd().slice(0, 120),
        });
        if (matches.length >= opts.max) break;
      }
      // JSON 但不是 match(begin / end / context 等):rg --json 的正常事件,不计异常。
    } catch {
      // 连 JSON 都不是 —— 输出形态与 `--json` 约定不符,是"通道坏了"的指纹。
      unparsed += 1;
    }
  }
  if (matches.length === 0) {
    // 退出码 0 而一条都没解析出来:rg 只在**有匹配**时返回 0,所以这一格只能是
    // 输出形态变了(非 JSON 行)。不得把它读成"确实没有匹配"。
    return { state: 'failed', reason: `ripgrep exited 0 but yielded 0 parsed matches (${unparsed} non-JSON output lines); an unreadable channel is not "no match"` };
  }
  // 退出码 0 且有命中,但 stderr 有内容(典型:某个路径 Permission denied 被跳过):
  // 结果是**部分**答案 ⇒ 如实带 warning,不得让它冒充完整覆盖(否则"这个文件里肯定没有"
  // 这种结论又会从一次不完整的搜索里长出来)。
  return { state: 'hits', matches, warning: stderr ? oneLine(stderr) : null };
}

function resolvePath(ctx: ToolContext, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ctx.workspacePath, filePath);
}

function relativePath(ctx: ToolContext, absPath: string): string {
  return path.relative(ctx.workspacePath, absPath);
}

const TYPE_EXT_MAP: Record<string, string[]> = {
  ts: ['.ts', '.tsx'], js: ['.js', '.jsx'], py: ['.py'],
  json: ['.json'], css: ['.css', '.scss'], md: ['.md', '.markdown'],
  go: ['.go'], rs: ['.rs'], java: ['.java'], c: ['.c', '.h'], cpp: ['.cpp', '.hpp'],
};

function matchesType(filename: string, type: string): boolean {
  const exts = TYPE_EXT_MAP[type.toLowerCase()];
  if (!exts) return true;
  return exts.includes(path.extname(filename).toLowerCase());
}

function matchesGlob(filePath: string, rootPath: string, pattern: string): boolean {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, '/');
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(rel);
}

/**
 * 只读文件头部至多 `maxBytes` 字节(而不是"整份读进内存再切行")。
 *
 * 截断落在多字节序列中间时 `toString('utf8')` 会产出一个尾部 U+FFFD —— 这里把它去掉:
 * 留着它等于让"读取边界"冒充文件内容,下一次按这份文本去改就会改错。
 * `totalBytes` 用 fstat 现取,与 `bytesRead` 同一次句柄内比对,避免与调用方的 stat 抢时序。
 */
function readHeadOfFile(abs: string, maxBytes: number): {
  text: string;
  bytesRead: number;
  totalBytes: number;
  byteTruncated: boolean;
} {
  const fd = fs.openSync(abs, 'r');
  try {
    const totalBytes = fs.fstatSync(fd).size;
    const want = Math.min(maxBytes, totalBytes);
    if (want <= 0) return { text: '', bytesRead: 0, totalBytes, byteTruncated: false };
    const buf = Buffer.alloc(want);
    const bytesRead = fs.readSync(fd, buf, 0, want, 0);
    const byteTruncated = totalBytes > bytesRead;
    let text = buf.subarray(0, bytesRead).toString('utf8');
    if (byteTruncated && text.endsWith('\uFFFD')) text = text.slice(0, -1);
    return { text, bytesRead, totalBytes, byteTruncated };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // 关闭失败不改变"已经读到的这些字节"这一事实
    }
  }
}

/**
 * read_file 的 offset/limit 入参归一:非正整数一律按"未提供"处理(容错而非报错,
 * 与工具其余参数的宽松口径一致);范围语义与上游 Read 相同,offset 为 1-based 行号。
 */
function normalizeReadRangeParam(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : undefined;
}

export const read_file: Tool = {
  name: 'read_file',
  description:
    '读取文件内容(带行号,代码语法高亮)。参数:path(文件路径,相对工作区根目录),offset(可选,起始行号 1-based),limit(可选,最多读取行数)。支持文本文件;PDF/PPTX/image 等二进制文件返回类型提示。文件超 token 预算时返回带续读 offset 的部分视图;同一会话内文件未变时重复读返回 Wasted call 短路。',
  dangerLevel: 'read',
  parameters: {
    path: { type: 'string', description: '要读取的文件路径' },
    offset: { type: 'number', description: '起始行号(1-based)。缺省从第 1 行读。' },
    limit: { type: 'number', description: '最多读取的行数。缺省读到文件尾(受字节/行数/token 上限约束)。' },
  },
  required: ['path'],
  async execute(args, ctx): Promise<ToolResult> {
    const filePath = args.path as string;
    if (!filePath) return { success: false, output: '', error: '缺少 path 参数' };
    const offset = normalizeReadRangeParam(args.offset);
    const limit = normalizeReadRangeParam(args.limit);
    const abs = resolvePath(ctx, filePath);
    if (!fs.existsSync(abs)) {
      return {
        success: false,
        output: '',
        error: withMissingFileSuggestion(`文件不存在: ${filePath}`, abs),
      };
    }
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) return { success: false, output: '', error: `是目录,不是文件: ${filePath}` };

    // G-937971 file_unchanged 短路:cacheKey=(path,offset,limit),mtime+size 同 ⇒
    // 回 stub 不重发内容;partial 视图(截断过)永不短路,外部改写 ⇒ 缓存自然失效。
    const readState = getReadFileStateMap(ctx);
    const cacheKey = createReadFileStateKey(abs, offset, limit);
    const cached = readState.get(cacheKey);
    if (cached && isCachedReadFresh(cached, stat)) {
      return { success: true, output: FILE_UNCHANGED_STUB };
    }

    // P0-8 二进制文件检测:PDF/PPTX/image 等不强制解析,返回类型化提示(做减法:不引入重依赖)
    const ext = path.extname(abs).toLowerCase();
    const binaryHint = detectBinaryFile(abs, ext, stat.size);
    if (binaryHint) return { success: true, output: binaryHint };

    // 字节闸在**读取处**生效(旧写法是 readFileSync 整份进内存再切 500 行,行闸形同虚设)。
    const { text, bytesRead, totalBytes, byteTruncated } = readHeadOfFile(abs, MAX_READ_BYTES);

    // G-937972:空文件给 system-reminder 警示而非空输出/报错(沉默会被读成"没内容可读")。
    if (text === '') return { success: true, output: EMPTY_FILE_REMINDER };

    const allLines = text.split('\n');
    const isRangeRead = offset !== undefined || limit !== undefined;
    // G-937972:offset 越过文件末尾给 system-reminder 警示(真实行数是续读坐标,不是错误)。
    if (offset !== undefined && offset > allLines.length) {
      return { success: true, output: buildOffsetBeyondEofReminder(offset, allLines.length) };
    }

    // 视图选择:range 读按点名窗口;整读先过行数闸(既有行为,保持不变)。
    const startIdx = offset === undefined ? 0 : offset - 1;
    let viewLines: string[];
    let lineTruncated = false;
    if (isRangeRead) {
      const endIdx = limit === undefined ? allLines.length : Math.min(startIdx + limit, allLines.length);
      viewLines = allLines.slice(startIdx, endIdx);
    } else if (allLines.length > MAX_READ_LINES) {
      viewLines = allLines.slice(0, MAX_READ_LINES);
      lineTruncated = true;
    } else {
      viewLines = allLines;
    }
    const viewText = viewLines.join('\n');
    const startLine = startIdx + 1;

    /** 记一条已读缓存(partial 标记决定它能否被下次短路复用) */
    const recordReadState = (isPartialView: boolean): void => {
      readState.set(cacheKey, {
        path: abs,
        offset,
        limit,
        isPartialView,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
        recordedAt: Date.now(),
      });
    };

    // 字节闸优先:截断过的视图已如实标注"后面没读",token 部分视图不再叠加第二种截断故事
    // (两条截断说明同屏会让模型不知道该信哪一条)。此路径保持既有输出逐字不变。
    if (byteTruncated) {
      const highlighted = highlightCode(viewLines.join('\n'), filePath);
      const output = highlighted.split('\n').map((l, i) => `${String(startLine + i).padStart(4)}  ${l}`).join('\n');
      const notes: string[] = [];
      // 诚实标注(ASCII,理由见 `engineNote` 上方注释):总量 + 实读量都报出来,
      // 否则"只看到前一半"会被读成"文件就这么多"。行数在这一维**不可知**(尾部还没读),
      // 所以只报字节量,不报"共 N 行" —— 报一个算不出来的数比不报更糟。
      notes.push(`...(truncated: file is ${totalBytes} bytes, only the first ${bytesRead} bytes were read; content beyond this point was NOT inspected)`);
      if (allLines.length > MAX_READ_LINES) {
        notes.push(`\n...(仅显示前 ${MAX_READ_LINES} 行)`);
      }
      recordReadState(true);
      return { success: true, output: output + notes.join('') };
    }

    // G-937972:token 预算。range 读超限 ⇒ 硬错(点名窗口被静默改小等于改答);
    // 整读超限 ⇒ 降级 0.85 预算内的部分视图 + partialViewNotice(带续读 offset)。
    const tokenCount = estimateReadTokens(viewText);
    if (tokenCount > READ_MAX_OUTPUT_TOKENS) {
      if (isRangeRead) {
        return {
          success: false,
          output: '',
          error: buildReadOutputTooManyTokensMessage(tokenCount, filePath),
          errorType: 'read_output_too_many_tokens',
        };
      }
      const partial = createTokenCapPartialView({
        content: viewText,
        startLine,
        totalLines: allLines.length,
        tokenCount,
      });
      if (partial) {
        const highlighted = highlightCode(partial.content, filePath);
        const numbered = highlighted.split('\n').map((l, i) => `${String(partial.startLine + i).padStart(4)}  ${l}`).join('\n');
        const output = `<system-reminder>${partial.partialViewNotice}</system-reminder>\n\n${numbered}`;
        recordReadState(true);
        return { success: true, output };
      }
      return {
        success: false,
        output: '',
        error: buildReadOutputTooManyTokensMessage(tokenCount, filePath),
        errorType: 'read_output_too_many_tokens',
      };
    }

    const highlighted = highlightCode(viewText, filePath);
    const output = highlighted.split('\n').map((l, i) => `${String(startLine + i).padStart(4)}  ${l}`).join('\n');
    const notes: string[] = [];
    if (lineTruncated) {
      notes.push(`\n...(仅显示前 ${MAX_READ_LINES} 行)`);
    }
    // 记缓存。isPartialView 只指被工具截断的视图(line cap 切过);range view 是点名
    // 的那一窗,不算 partial,可被下次同参读取短路复用(G-937971)。
    recordReadState(lineTruncated);
    return { success: true, output: output + notes.join('') };
  },
};

const BINARY_FILE_KINDS: Record<string, { kind: string; hint: string }> = {
  '.pdf': { kind: 'PDF 文档', hint: '使用 /bash pdftotext "<path>" - 提取文本,或 /bash pdfinfo "<path>" 查看元数据' },
  '.docx': { kind: 'Word 文档', hint: '使用 /bash pandoc -t plain "<path>" 提取文本,或 /bash unzip -p "<path>" word/document.xml 查看 XML' },
  '.doc': { kind: 'Word 文档(旧格式)', hint: '使用 /bash antiword "<path>" 或 /bash catdoc "<path>" 提取文本' },
  '.pptx': { kind: 'PowerPoint 文档', hint: '使用 /bash unzip -p "<path>" ppt/slides/slide*.xml 提取文本' },
  '.ppt': { kind: 'PowerPoint 文档(旧格式)', hint: '使用 /bash catppt "<path>" 提取文本' },
  '.xlsx': { kind: 'Excel 文档', hint: '使用 /bash unzip -p "<path>" xl/sharedStrings.xml 提取文本' },
  '.xls': { kind: 'Excel 文档(旧格式)', hint: '使用 /bash xls2csv "<path>" 提取文本' },
  '.png': { kind: 'PNG 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据,或 /bash identify "<path>" (ImageMagick)' },
  '.jpg': { kind: 'JPEG 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.jpeg': { kind: 'JPEG 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.gif': { kind: 'GIF 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.webp': { kind: 'WebP 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.bmp': { kind: 'BMP 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.svg': { kind: 'SVG 矢量图', hint: 'SVG 是 XML 文本,可改为 .xml 后缀读取;或 /bash rsvg-convert "<path>" 转图片' },
  '.mp3': { kind: 'MP3 音频', hint: '音频无法读取;使用 /bash ffprobe "<path>" 查看元数据' },
  '.mp4': { kind: 'MP4 视频', hint: '视频无法读取;使用 /bash ffprobe "<path>" 查看元数据' },
  '.mov': { kind: 'MOV 视频', hint: '视频无法读取;使用 /bash ffprobe "<path>" 查看元数据' },
  '.zip': { kind: 'ZIP 压缩包', hint: '使用 /bash unzip -l "<path>" 列出内容,或 /bash unzip -p "<path>" <file> 提取单个文件' },
  '.tar': { kind: 'TAR 压缩包', hint: '使用 /bash tar -tvf "<path>" 列出内容' },
  '.gz': { kind: 'GZip 压缩文件', hint: '使用 /bash gunzip -c "<path>" 解压输出' },
  '.rar': { kind: 'RAR 压缩包', hint: '使用 /bash unrar l "<path>" 列出内容' },
  '.7z': { kind: '7Z 压缩包', hint: '使用 /bash 7z l "<path>" 列出内容' },
  '.exe': { kind: '可执行文件', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.dll': { kind: '动态链接库', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.so': { kind: '共享对象', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.dylib': { kind: '动态库', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.class': { kind: 'Java 类文件', hint: '使用 /bash javap -p "<path>" 反汇编' },
  '.jar': { kind: 'Java JAR 包', hint: '使用 /bash unzip -l "<path>" 列出内容' },
  '.pyc': { kind: 'Python 字节码', hint: '使用 /bash python -m dis "<path>" 反汇编' },
};

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]; // \x89PNG
const JPG_MAGIC = [0xff, 0xd8, 0xff];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38]; // GIF8
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 (zip/docx/pptx/xlsx/jar)
const RAR_MAGIC = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]; // Rar!\x1a\x07
const SEVENZ_MAGIC = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]; // 7z\xbc\xaf\x27\x1c

function detectBinaryFile(absPath: string, ext: string, size: number): string | null {
  // 扩展名优先(快速路径)
  const byExt = BINARY_FILE_KINDS[ext];
  if (byExt) {
    return formatBinaryHint(byExt.kind, absPath, size, byExt.hint);
  }
  // Magic number 兜底(无扩展名或扩展名异常)
  if (size < 4) return null;
  let fd: number | undefined;
  try {
    fd = fs.openSync(absPath, 'r');
    // 窗口 = BINARY_SNIFF_BYTES(1024),与下方 NULL 判据的承诺同值。
    // 此前这里分配并只读 8 字节,而注释写的是"前 1024 字节"—— 散文与实现分叉;
    // 取值依据与"为什么把实现升到注释、而不是把注释降到实现"写在 BINARY_SNIFF_BYTES 上方。
    const buf = Buffer.alloc(BINARY_SNIFF_BYTES);
    const bytesRead = fs.readSync(fd, buf, 0, BINARY_SNIFF_BYTES, 0);
    if (bytesRead >= 4 && PDF_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('PDF 文档(magic)', absPath, size, BINARY_FILE_KINDS['.pdf']!.hint);
    }
    if (bytesRead >= 4 && PNG_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('PNG 图片(magic)', absPath, size, BINARY_FILE_KINDS['.png']!.hint);
    }
    if (bytesRead >= 3 && JPG_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('JPEG 图片(magic)', absPath, size, BINARY_FILE_KINDS['.jpg']!.hint);
    }
    if (bytesRead >= 4 && GIF_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('GIF 图片(magic)', absPath, size, BINARY_FILE_KINDS['.gif']!.hint);
    }
    if (bytesRead >= 4 && ZIP_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('ZIP/Office 文档(magic)', absPath, size, BINARY_FILE_KINDS['.zip']!.hint);
    }
    if (bytesRead >= 6 && RAR_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('RAR 压缩包(magic)', absPath, size, BINARY_FILE_KINDS['.rar']!.hint);
    }
    if (bytesRead >= 6 && SEVENZ_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('7Z 压缩包(magic)', absPath, size, BINARY_FILE_KINDS['.7z']!.hint);
    }
    // 检测 NULL 字节(通用二进制检测:前 BINARY_SNIFF_BYTES 字节内有 NULL 视为二进制)。
    // 这一行刻意引**常量名**而不是数字 —— 上一次就是注释写死 1024、实现写死 8,
    // 两处谁都没被机器问过,于是分叉一直活着。
    if (bytesRead >= 1 && buf.subarray(0, bytesRead).includes(0)) {
      return formatBinaryHint('二进制文件(检测到 NULL 字节)', absPath, size, '使用 /bash file "<path>" 查看类型');
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

function formatBinaryHint(kind: string, absPath: string, size: number, hint: string): string {
  const sizeStr = size < 1024 ? `${size}B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)}KB` : `${(size / (1024 * 1024)).toFixed(1)}MB`;
  return `[${kind}] ${path.basename(absPath)} (${sizeStr})\n该文件类型当前不支持直接解析(避免引入重依赖)。\n提示:${hint.replace(/<path>/g, absPath)}`;
}

export const list_dir: Tool = {
  name: 'list_dir',
  description: '列出目录内容。参数:path(目录路径,默认工作区根目录)。',
  parameters: {
    path: { type: 'string', description: '要列出的目录路径(默认 .)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const dirPath = (args.path as string) || '.';
    const abs = resolvePath(ctx, dirPath);
    if (!fs.existsSync(abs)) return { success: false, output: '', error: `路径不存在: ${dirPath}` };
    const stat = fs.statSync(abs);
    if (!stat.isDirectory()) return { success: false, output: '', error: `是文件,不是目录: ${dirPath}` };
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));
    const lines: string[] = [];
    for (const d of dirs) lines.push(`${d.name}/`);
    for (const f of files) {
      const fstat = fs.statSync(path.join(abs, f.name));
      const size = fstat.size < 1024 ? `${fstat.size}B` : `${(fstat.size / 1024).toFixed(1)}K`;
      lines.push(`${f.name} (${size})`);
    }
    return { success: true, output: lines.join('\n') };
  },
};

/**
 * 降级通道:纯 JS 递归遍历搜索(rg 不可用 / rg 失败时走这里)。
 *
 * 与 `execRipgrep` 同构地返回三态 —— 特别是**模式编译不了要判 failed**,不得回落到
 * "没有匹配":那正是本票要消灭的那一型,换条通道不能把它重新引入。
 *
 * 一处如实登记的覆盖面缺口:本函数对每个候选文件走 `fs.readFileSync` 整读,
 * **没有**字节上限(与 `read_file` 的 `MAX_READ_BYTES` 不同一码事)。刻意不在这里加:
 * 搜索通道一旦"只读前 N 字节"就必须承认尾部没查,那等于用一条性能闸换来一个
 * **静默的假否定** —— 比本票修的病灶更难查。要收这一格,得连"未扫完"的计数一起回传,
 * 属另一票的范围(已登记)。
 */
function execJsWalkGrep(
  pattern: string,
  opts: { cwd: string; searchPath: string; type?: string; glob?: string; max: number },
): { state: 'hits'; results: string[] } | { state: 'no-match' } | { state: 'failed'; reason: string } {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'i');
  } catch (err) {
    return { state: 'failed', reason: `JS RegExp cannot compile this pattern: ${err instanceof Error ? err.message : String(err)}` };
  }
  const results: string[] = [];
  function walk(dir: string): void {
    if (results.length >= opts.max) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= opts.max) return;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(entryPath);
      } else if (entry.isFile()) {
        if (opts.glob && !matchesGlob(entryPath, opts.cwd, opts.glob)) continue;
        if (opts.type && !matchesType(entry.name, opts.type)) continue;
        try {
          const content = fs.readFileSync(entryPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i]!)) {
              const rel = path.relative(opts.cwd, entryPath);
              results.push(`${rel}:${i + 1} ${lines[i]!.trim().slice(0, 120)}`);
              if (results.length >= opts.max) break;
            }
          }
        } catch { /* skip binary */ }
      }
    }
  }
  walk(opts.searchPath);
  return results.length === 0 ? { state: 'no-match' } : { state: 'hits', results };
}

export const grep: Tool = {
  name: 'grep',
  description: '在文件中递归搜索正则匹配(优先用 ripgrep,遵循 .gitignore;rg 不存在或报错时降级 JS walk 并在结果里说明降级原因)。参数:pattern(正则),path(搜索路径,默认工作区根目录),type(文件类型如 ts/py),glob(路径通配如 src/**/*.ts)。',
  parameters: {
    pattern: { type: 'string', description: '正则表达式' },
    path: { type: 'string', description: '搜索路径(默认工作区根目录)' },
    type: { type: 'string', description: '文件类型过滤(如 ts/py/js,传给 rg --type)' },
    glob: { type: 'string', description: '路径通配过滤(如 src/**/*.ts,传给 rg -g)' },
  },
  required: ['pattern'],
  async execute(args, ctx): Promise<ToolResult> {
    const pattern = args.pattern as string;
    if (!pattern) return { success: false, output: '', error: '缺少 pattern 参数' };
    const searchPath = (args.path as string) || '.';
    const abs = resolvePath(ctx, searchPath);
    if (!fs.existsSync(abs)) return { success: false, output: '', error: `路径不存在: ${searchPath}` };

    const rgOpts = {
      cwd: ctx.workspacePath,
      searchPath: abs,
      type: args.type as string | undefined,
      glob: args.glob as string | undefined,
      max: MAX_GREP_RESULTS,
    };

    const rg = execRipgrep(pattern, rgOpts);
    if (rg.state !== 'failed') {
      const note = engineNote(ENGINE_RIPGREP, null) + (rg.state === 'hits' && rg.warning ? `\n[ripgrep warning] ${rg.warning}` : '');
      if (rg.state === 'no-match') return { success: true, output: `未找到匹配${note}` };
      const results = rg.matches.map((m) => `${m.file}:${m.line} ${m.text}`);
      const truncated = results.length >= MAX_GREP_RESULTS ? `\n...(仅显示前 ${MAX_GREP_RESULTS} 条,用 rg)` : '';
      return { success: true, output: results.join('\n') + truncated + note };
    }

    // rg 失败 ⇒ **带原因降级**到 JS walk。两条处置里为什么选这条:
    //   JS 的 RegExp **支持** rg 默认引擎拒绝的那一类语法(`(?!` / `(?<=` 等 lookaround
    //   是 ES2018 特性),所以对最常见的那一型失败(rg 退出码 2 = 语法不支持)降级是
    //   真能给出正确答案的;直接 success:false 会把一个本可服务的需求推回给用户。
    // 但降级不是无条件出路 —— 两条通道都答不上来时**必须如实失败**(见下面 failed 分支),
    // 否则就是"谁都没答,却回一句没有匹配",与本票立门的原病同形。
    const walk = execJsWalkGrep(pattern, rgOpts);
    if (walk.state === 'failed') {
      return {
        success: false,
        output: '',
        error:
          `grep got no answer from either channel, so this is NOT "no match":\n` +
          `[${ENGINE_RIPGREP}] ${rg.reason}\n` +
          `[${ENGINE_JS_WALK}] ${walk.reason}`,
      };
    }
    const degradedNote = engineNote(ENGINE_JS_WALK, rg.reason);
    if (walk.state === 'no-match') return { success: true, output: `未找到匹配${degradedNote}` };
    const truncated = walk.results.length >= MAX_GREP_RESULTS ? `\n...(仅显示前 ${MAX_GREP_RESULTS} 条)` : '';
    return { success: true, output: walk.results.join('\n') + truncated + degradedNote };
  },
};

export const glob: Tool = {
  name: 'glob',
  description: '按文件名通配匹配文件。参数:pattern(如 *.ts, src/**/*.js)。',
  parameters: {
    pattern: { type: 'string', description: '文件名通配符(* 和 ?)' },
  },
  required: ['pattern'],
  async execute(args, ctx): Promise<ToolResult> {
    const pattern = args.pattern as string;
    if (!pattern) return { success: false, output: '', error: '缺少 pattern 参数' };
    // 展开 {a,b,c} 大括号(支持单层嵌套,常见 glob 扩展语法)
    const expandBraces = (p: string): string[] => {
      const match = p.match(/\{([^{}]+)\}/)
      if (!match) return [p]
      const prefix = p.slice(0, match.index)
      const suffix = p.slice(match.index! + match[0].length)
      const options = match[1]!.split(',')
      return options.flatMap((opt) => expandBraces(prefix + opt + suffix))
    }
    const patterns = expandBraces(pattern)
    // 2026-09-03 修复: 原 impl 只用纯文件名匹配 pattern,导致 **/stats.mjs 这类含路径的 pattern 永远失配。
    // 新语义: pattern 含 '/' → 按相对路径匹配(**/ 可匹配零目录, * 不跨目录段); 不含 '/' → 沿用任意深度文件名匹配。
    const matchers = patterns.map((p) => {
      if (!p.includes('/')) {
        const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        return (_relPath: string, fileName: string) => re.test(fileName);
      }
      const re = new RegExp(
        '^' +
          p
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*\//g, '(?:.*/)?') // **/ 可匹配零目录(**/stats.mjs 命中根目录 stats.mjs)
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]') +
          '$',
      );
      return (relPath: string, _fileName: string) => re.test(relPath);
    });
    const results: string[] = [];
    function walk(dir: string): void {
      if (results.length >= MAX_GLOB_RESULTS) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (results.length >= MAX_GLOB_RESULTS) return;
        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          walk(path.join(dir, entry.name));
        } else if (matchers.some((m) => m(relativePath(ctx, path.join(dir, entry.name)).replace(/\\/g, '/'), entry.name))) {
          results.push(relativePath(ctx, path.join(dir, entry.name)));
        }
      }
    }
    walk(ctx.workspacePath);
    if (results.length === 0) return { success: true, output: '未找到匹配文件' };
    results.sort();
    const truncated = results.length >= MAX_GLOB_RESULTS ? `\n...(仅显示前 ${MAX_GLOB_RESULTS} 个)` : '';
    return { success: true, output: results.join('\n') + truncated };
  },
};

// ==================== G-896416 超时自动转后台 ====================

/**
 * 收编任务的后台预算(毫秒):与显式后台分支同款 600s,不另立第二处真相。
 * 上游 ZCode 没有这个数 —— 它的 `bash.ts:178-184` 只把执行模式切到
 * `auto_on_timeout`,后续预算由它自己的 background lifecycle 管;我方的预算
 * 统一落在注册表调用方,显式后台是 600s,收编任务沿用同一预算。
 */
const ADOPTED_BACKGROUND_BUDGET_MS = 600_000;

/** 收编任务的预算定时器记账:正常结算路径 clearTimeout + 摘除,不留悬挂句柄。 */
const adoptedDeadlineTimers = new Set<NodeJS.Timeout>();

/**
 * 前台超时钳制:默认 30s(与历史行为同值),下界 1s(防 0/负数把 race 变成
 * "还没跑就转后台"),上界 600s(与后台预算同一条天花板)。非有限数回默认。
 * `export` 只为让回归测试引用同一份实现,不在测试里抄第二处判据。
 */
export function clampForegroundTimeout(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 30_000;
  return Math.min(Math.max(Math.round(n), 1_000), 600_000);
}

/**
 * 可收编判据 —— 形状照上游 ZCode `tool/handlers/bash-background-policy.ts:3-9`
 * (`isBashAutoBackgroundEligible`):trim 后非空、首 token ≠ 'sleep'(sleep 类
 * 纯等待命令转后台毫无意义,等于把无输出原样押后)。
 * 偏离如实登记:上游还有第二维"闲时 turn 才允许自动后台"(`bash.ts:138-152`
 * 的 offPeakTurn,闲时连显式后台一起拒),我方 HEAD 没有"闲时 turn"概念
 * (git grep offPeak 0 命中),该维无落点;重开条件=未来引入闲时 turn 调度。
 * `export` 同 clampForegroundTimeout:回归直接引同一份判据,不抄第二处。
 */
export function isAutoBackgroundEligible(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  const first = (trimmed.split(/\s+/)[0] ?? '').toLowerCase();
  return first !== 'sleep';
}

/**
 * 前台结算:原 run_command 同步路径的 parts 拼装原样抽成一处,收编路径
 * (" race 输给了正常结束")与原路径共用,保证两条路对同一结果的输出逐字节同形。
 *
 * G-937951 接线:timedOut 的 SandboxResult 经 {@link mapTerminalState} 归档成
 * `terminalState: 'timed_out'` + `interrupted: true`,并在模型面输出追加
 * "完成前被中止"尾注 —— 强杀现场不得被读成干净终态。cancelled 档在我方
 * 落在执行链边界(index.ts `execBudgetResult`),沙箱结果层没有 cancelled 形状。
 */
function settleForegroundResult(result: SandboxResult): ToolResult {
  const terminal = mapTerminalState({ timedOut: result.timedOut });
  const parts: string[] = [];
  if (result.stdout.trim()) parts.push(result.stdout.trimEnd());
  if (result.stderr.trim()) parts.push(`[stderr] ${result.stderr.trimEnd()}`);
  if (result.timedOut) {
    parts.push('[超时]');
    parts.push(ABORTED_BEFORE_COMPLETION_NOTE);
  }
  if (result.exitCode !== null && result.exitCode !== 0) parts.push(`[exit: ${result.exitCode}]`);
  return {
    success: result.exitCode === 0,
    output: parts.join('\n') || '(无输出)',
    error: result.exitCode !== 0 ? `退出码 ${result.exitCode}` : undefined,
    ...(terminal
      ? { terminalState: terminal.status, interrupted: terminal.interrupted }
      : {}),
  };
}

// ==================== G-937954 gh rate limit 提示(命令形状 + 输出匹配 + per-context 冷却) ====================

/** 二次提示的最短间隔:60s 内同一个 ctx 只提示一次(上游 GH_RATE_LIMIT_HINT_COOLDOWN_MS 同值)。 */
const GH_RATE_LIMIT_HINT_COOLDOWN_MS = 60_000;

/**
 * 命令形状:要真发 GitHub API 的 gh 子命令才值得提示。排除不发 API 调用的本地档
 * (auth/help/version/alias/completion/config)—— `gh auth status` 打的是认证端点,
 * 撞到同串文案也该按别的病处置,不能被这条提示带偏。形状与上游
 * `bash-gh-rate-limit.ts` 的 GH_COMMAND_RE 同形。
 */
export const GH_COMMAND_RE =
  /(?:^|[;&|]|\b(?:then|do)\b)\s*gh\s+(?!auth\b|help\b|version\b|alias\b|completion\b|config\b)/;

/** 输出匹配:主限流与次限流两种官方文案(+ GraphQL 的 RATE_LIMITED),大小写不敏感。 */
export const GH_RATE_LIMIT_RE =
  /API rate limit (?:already )?exceeded|exceeded a secondary rate limit|\bRATE_LIMITED\b/i;

const GH_RATE_LIMIT_HINT =
  '<system-reminder>GitHub API rate limit exceeded (5,000/hr shared across all tools and agents). ' +
  'Run `gh api rate_limit --jq .resources` and wait until the reset window before further gh calls; ' +
  'do not retry in a tight loop.</system-reminder>';

/**
 * 冷却账本:**WeakMap 按 ctx 记账**,刻意不做模块级可变标量 —— 模块级全局会让
 * 多 runtime / 多会话互相压制冷却(上游否证过的形态:一个会话的提示把别家 60s 窗口
 * 一起吃掉)。ctx 每会话一份(agent.ts setupAgentTools 构造一次并贯穿工具循环),
 * 冷却天然 per-context;ctx 被回收后账本条目随 GC 走,无泄漏无清扫代码。
 */
const ghRateLimitHintCooldownAt = new WeakMap<object, number>();

/**
 * gh 限流提示的唯一出口(上游 `bash-gh-rate-limit.ts` `getGhRateLimitHint` 的机制等价版):
 * 命中命令形状 + 输出文案 ⇒ 返回提示(调用方附加到模型面输出);同一 ctx 60s 冷却内二发不附。
 * `export` 只为让回归测试引用同一份判据(与 clampForegroundTimeout 同一先例)。
 */
export function getGhRateLimitHint(command: string, output: string, ctx: object): string | undefined {
  if (!GH_COMMAND_RE.test(command) || !GH_RATE_LIMIT_RE.test(output)) return undefined;
  const now = Date.now();
  if (now < (ghRateLimitHintCooldownAt.get(ctx) ?? 0)) return undefined;
  ghRateLimitHintCooldownAt.set(ctx, now + GH_RATE_LIMIT_HINT_COOLDOWN_MS);
  return GH_RATE_LIMIT_HINT;
}

/**
 * 前台结算出口,两条前台路径(收编 race 输了 / 纯同步)共用的**唯一**收口:
 * 终态映射(G-937951)在 settleForegroundResult 里,这里再叠 gh 限流提示(G-937954)
 * —— 输出(stdout+stderr 都进匹配面,gh 的限流文案经常走 stderr)命中且不在
 * 冷却窗 ⇒ 把 system-reminder 提示附加到模型面输出尾部。
 * `export` 只为让回归测试引用同一份实现,不在测试里抄第二处拼装。
 */
export function settleForegroundCommand(result: SandboxResult, command: string, ctx: ToolContext): ToolResult {
  const settled = settleForegroundResult(result);
  const hint = getGhRateLimitHint(command, `${result.stdout}\n${result.stderr}`, ctx);
  return hint ? { ...settled, output: `${settled.output}\n${hint}` } : settled;
}

export const run_command: Tool = {
  name: 'run_command',
  description:
    '在沙盒中执行 shell 命令(带超时和路径限制)。参数:command(shell 命令),background(可选 true=后台执行立即返回 task_id),timeout_ms(可选前台超时,默认 30000)。前台命令超时且可收编时自动转入后台继续执行并返回 task_id(sleep 等纯等待命令除外)。',
  dangerLevel: 'dangerous',
  parameters: {
    command: { type: 'string', description: '要执行的 shell 命令' },
    background: { type: 'boolean', description: '后台执行,立即返回 task_id(用 list_background_tasks/get_command_output/wait_command 查询)' },
    timeout_ms: { type: 'number', description: '前台超时毫秒(可选,默认 30000,范围 1000~600000);超时且命令可收编时自动转后台' },
  },
  required: ['command'],
  async execute(args, ctx): Promise<ToolResult> {
    const command = args.command as string;
    if (!command) return { success: false, output: '', error: '缺少 command 参数' };
    const background = args.background === true;
    // 安全闸门:危险档(可被 IHUI_YOLO 越)+ alwaysConfirm 档(逃生舱也拦)
    // + 只读免确认档,三档一次算完 —— 判据在 command-safety 的 gateCommandExecution 里,
    // 本文件与 tools/terminal.ts 共用同一份,不各写一遍。
    const gate = gateCommandExecution(command);
    const blockMessage = describeCommandBlock(gate, !!process.env.IHUI_YOLO);
    if (blockMessage) {
      return { success: false, output: blockMessage };
    }
    // 只读命令自动批准(trusted profile 默认):免 confirmDangerous 提示
    if (!gate.autoApprovable) {
      // 默认拒绝策略:未提供 confirmDangerous 回调时,dangerous 工具直接拒绝(安全优先)
      if (run_command.dangerLevel === 'dangerous' && !ctx.confirmDangerous) {
        return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${run_command.name}` };
      }
      if (ctx.confirmDangerous && !(await ctx.confirmDangerous(run_command, args))) {
        return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${run_command.name}` };
      }
    }
    const preResult = runPreToolCall('bash', { command, cwd: ctx.workspacePath, background });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    if (background) {
      // 后台执行:启动异步沙盒,注册任务,立即返回 task_id
      const handle = runSandboxedAsync(command, {
        cwd: ctx.workspacePath,
        timeoutMs: 600_000, // 后台任务 10 分钟超时
        allowedPaths: [ctx.workspacePath, ...(ctx.sandbox?.allowedPaths ?? [])],
        commandAllowlist: ctx.sandbox?.commandAllowlist,
        blockedEnvVars: ctx.sandbox?.blockedEnvVars,
      });
      if (!handle.process) {
        // 预检失败
        const failedId = registerFailedTask(command, '沙盒预检失败');
        return {
          success: false,
          output: `任务 ${failedId} 注册但启动失败(沙盒拒绝)`,
          error: '沙盒预检失败',
        };
      }
      const taskId = registerTask(handle.process, command);
      // 异步等待结果,完成后触发 post hook
      handle.result.then((result) => {
        runPostToolCall('bash', { exitCode: result.exitCode, timedOut: result.timedOut, background: true, taskId });
      }).catch(() => { /* ignore */ });
      return {
        success: true,
        output: `后台任务已启动\n  task_id: ${taskId}\n  command: ${command}\n  用 list_background_tasks 查看,get_command_output ${taskId} 获取输出,wait_command ${taskId} 等待结束,kill_command ${taskId} 终止`,
      };
    }

    // 同步执行。可收编的命令(G-896416)走"到点不杀、收编进后台"变体;其余命令保持
    // runSandboxed 同步原路径逐字不变(失败现场诊断 failureKind/fsExhaustion 只在
    // 同步结算里,不给非收编路径降级)。
    const timeoutMs = clampForegroundTimeout(args.timeout_ms);
    const sandboxOpts = {
      cwd: ctx.workspacePath,
      timeoutMs,
      allowedPaths: [ctx.workspacePath, ...(ctx.sandbox?.allowedPaths ?? [])],
      commandAllowlist: ctx.sandbox?.commandAllowlist,
      blockedEnvVars: ctx.sandbox?.blockedEnvVars,
    };
    if (isAutoBackgroundEligible(command)) {
      // G-896416 超时自动转后台 —— 上游 ZCode `tool/handlers/bash.ts:178-184`:
      // `eligibleForAutoBackground && backgroundLifecyclePort ⇒ runBashWithBackgroundLifecycle(request,{mode:"auto_on_timeout"})`。
      // 到点是分叉点不是终点:先回一句"已转后台 bg_xxx",进程不死,由注册表接管。
      let fireDeadline: () => void = () => {};
      const deadlineHit = new Promise<void>((resolve) => {
        fireDeadline = resolve;
      });
      const handle = runSandboxedAsync(command, { ...sandboxOpts, onDeadline: () => fireDeadline() });
      const winner = await Promise.race([
        deadlineHit.then(() => 'deadline' as const),
        handle.result.then(() => 'done' as const),
      ]);
      if (winner === 'deadline') {
        const taskId = registerTask(handle.process, command);
        // 收编后的后台预算:与显式后台同款 600s。到点杀,且必须留 `timedOut` 档
        // (killTask 的 deadline 持有者形态)而不是 user/model —— 与 G-816026 三态互斥。
        const bgDeadline = setTimeout(() => {
          adoptedDeadlineTimers.delete(bgDeadline);
          void killTask(taskId, undefined, { timedOut: true });
        }, ADOPTED_BACKGROUND_BUDGET_MS);
        adoptedDeadlineTimers.add(bgDeadline);
        handle.result
          .then((result) => {
            clearTimeout(bgDeadline);
            adoptedDeadlineTimers.delete(bgDeadline);
            runPostToolCall('bash', { exitCode: result.exitCode, timedOut: result.timedOut, background: true, taskId });
          })
          .catch(() => {
            /* ignore */
          });
        return {
          success: true,
          output:
            `[前台等待超时(${timeoutMs}ms),已自动转入后台继续执行(进程未被终止)]\n` +
            `  task_id: ${taskId}\n` +
            `  command: ${command}\n` +
            `  收编前的输出不进后台缓冲;用 get_command_output ${taskId} 看输出,wait_command ${taskId} 等结束,kill_command ${taskId} 终止。` +
            `后台预算 ${Math.round(ADOPTED_BACKGROUND_BUDGET_MS / 1000)}s,到点会被终止并标为超时(不要当作用户/模型手停)`,
        };
      }
      const result = await handle.result;
      return settleForegroundCommand(result, command, ctx);
    }
    const result = runSandboxed(command, sandboxOpts);
    runPostToolCall('bash', { exitCode: result.exitCode, timedOut: result.timedOut });
    return settleForegroundCommand(result, command, ctx);
  },
};

export const list_background_tasks: Tool = {
  name: 'list_background_tasks',
  description: '列出后台任务(running/exited/killed/error 状态)。无参数。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(_args, _ctx): Promise<ToolResult> {
    // G-937976:花名册走投影层(逐字段搬/缺键不补 0/「不知道」与 0 可分辨/截断说出口),
    // 不在这里内联拼行 —— 投影纪律写死在 task-roster-projection 一处,数据面演进不改变模型面。
    const roster = projectTaskRoster(listTasks());
    if (roster.tasks.length === 0) {
      return { success: true, output: '当前无后台任务' };
    }
    // 头部只说「显示多少个」,不说总数:总数是尾部说明行的事(截断时「共 N 个」是一句假话)。
    return {
      success: true,
      output: `后台任务列表(显示 ${roster.tasks.length} 个):\n${formatTaskRoster(roster)}`,
    };
  },
};

export const get_command_output: Tool = {
  name: 'get_command_output',
  description: '获取后台任务的累计输出(stdout/stderr + 状态)。参数:task_id,tail(可选,最后 N 行)。',
  dangerLevel: 'read',
  parameters: {
    task_id: { type: 'string', description: '后台任务 ID(bg_xxx)' },
    tail: { type: 'number', description: '仅返回最后 N 行(可选,默认全部)' },
  },
  required: ['task_id'],
  async execute(args, _ctx): Promise<ToolResult> {
    const taskId = args.task_id as string;
    const tail = args.tail as number | undefined;
    if (!taskId) return { success: false, output: '', error: '缺少 task_id 参数' };
    const output = getTaskOutput(taskId, tail);
    if (!output) {
      return { success: false, output: '', error: `任务 ${taskId} 不存在` };
    }
    const parts: string[] = [
      // G-816026:模型必须读得出"谁停的"—— 你停的是决定不该被重跑,用户停的更不许被模型续上。
      `任务 ${output.id}  状态: ${output.status}  exitCode: ${output.exitCode ?? '-'}${
        output.status === 'killed'
          ? output.stopInitiator === 'model'
            ? '  停止方: 你(model),这是你的决定,不要重跑'
            : output.stopInitiator === 'user'
              ? '  停止方: 用户,这是用户的决定,不要 resume'
              : '  停止方: 外部/未知'
            : ''
      }`,
    ];
    if (output.stdout.trim()) parts.push(`[stdout]\n${output.stdout.trimEnd()}`);
    if (output.stderr.trim()) parts.push(`[stderr]\n${output.stderr.trimEnd()}`);
    // G-816028 + G-937959:截断注记已由 getTaskOutput 的视图感知投影嵌入内容头部
    // (终态 `[NKB of earlier output omitted]` / 运行中"仅保留前 30k"),此处不再追加第二份注记
    // —— 两份注记会说两个数,读侧无法对账。
    return {
      success: output.status !== 'error',
      output: parts.join('\n') || '(无输出)',
      error: output.status === 'error' ? '任务出错' : undefined,
    };
  },
};

export const wait_command: Tool = {
  name: 'wait_command',
  description: '等待后台任务结束(不杀进程)。返回三态可分辨:观察到终态则报该终态;等待窗口用尽仍未终态则明确报"未等到终态/状态未知",不会把超时当作结论。参数:task_id,timeout_ms(默认 30000;<=0 为一次非阻塞探询)。',
  dangerLevel: 'read',
  parameters: {
    task_id: { type: 'string', description: '后台任务 ID' },
    timeout_ms: { type: 'number', description: '等待超时(毫秒,默认 30000)' },
  },
  required: ['task_id'],
  async execute(args, _ctx): Promise<ToolResult> {
    const taskId = args.task_id as string;
    const timeoutMs = (args.timeout_ms as number | undefined) ?? 30_000;
    if (!taskId) return { success: false, output: '', error: '缺少 task_id 参数' };
    const task = getTask(taskId);
    if (!task) return { success: false, output: '', error: `任务 ${taskId} 不存在` };

    const result = await waitForTask(taskId, timeoutMs);
    // 三态必须逐支处理:`timed-out-unknown` 不是"结束了且还在跑",
    // 拿它的快照当结论报给模型,就等于把"我没等到"说成"它现在这样"。
    if (result.state === 'gone' || !result.snapshot) {
      return { success: false, output: '', error: `任务 ${taskId} 已被清理或不存在,无终态可报` };
    }
    const snap = result.snapshot;

    // G-937959 视图感知:终态读**尾部**(结论/报错在末尾),未终态的观测读**头部**(含第 1 行)。
    const settledView = result.state === 'settled';
    const stdoutView = settledView ? snap.stdoutBuf : snap.stdoutHead;
    const stderrView = settledView ? snap.stderrBuf : snap.stderrHead;

    // G-937956:终态通知走注册表的顺序化截断组装 —— 状态事实(含结论限定语)是通知的头,
    // stdout/stderr 是 result/error 正文(保住),120k 总预算由 formatSettledTaskNotification 统一执行。
    const statusLines = [
      `任务 ${snap.id}  状态: ${snap.status}  exitCode: ${snap.exitCode ?? '-'}`,
    ];
    if (snap.timedOut) statusLines.push('[任务超时]');
    if (result.state === 'timed-out-unknown') {
      // 如实说明"下面的输出是等待窗口用尽时的观测",而不是结论
      statusLines.push(
        `[未等到终态] 本次等待 ${timeoutMs}ms 已用尽,下面的输出是**该时刻的观测**而非最终结果;请再次调用 wait_command 或改用 get_command_output`,
      );
    } else if (result.state === 'still-running') {
      statusLines.push(`[仍在运行] 未做等待(timeoutMs=${timeoutMs})`);
    }
    const output = formatSettledTaskNotification({
      status: statusLines.join('\n'),
      result: stdoutView.trim() ? `[stdout]\n${stdoutView.trimEnd()}` : undefined,
      error: stderrView.trim() ? `[stderr]\n${stderrView.trimEnd()}` : undefined,
    });

    if (result.state === 'timed-out-unknown') {
      return {
        success: false,
        output,
        error: `等待超时,任务终态未知(此刻状态: ${snap.status})`,
      };
    }
    if (result.state === 'still-running') {
      return { success: false, output, error: `任务仍在运行(此刻状态: ${snap.status})` };
    }
    return {
      success: snap.status === 'exited' && snap.exitCode === 0,
      output,
      error: snap.status !== 'exited' ? `状态: ${snap.status}` : (snap.exitCode !== 0 ? `退出码 ${snap.exitCode}` : undefined),
    };
  },
};

export const kill_command: Tool = {
  name: 'kill_command',
  description: '终止后台任务(SIGTERM,5 秒后强杀 SIGKILL)。参数:task_id。',
  dangerLevel: 'dangerous',
  parameters: {
    task_id: { type: 'string', description: '后台任务 ID' },
  },
  required: ['task_id'],
  async execute(args, ctx): Promise<ToolResult> {
    const taskId = args.task_id as string;
    if (!taskId) return { success: false, output: '', error: '缺少 task_id 参数' };
    if (kill_command.dangerLevel === 'dangerous' && !ctx.confirmDangerous) {
      return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${kill_command.name}` };
    }
    if (ctx.confirmDangerous && !(await ctx.confirmDangerous(kill_command, args))) {
      return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${kill_command.name}` };
    }
    const result = await killTask(taskId, 'model');
    return {
      success: result.killed,
      output: result.killed ? `任务 ${taskId} 已终止` : `任务 ${taskId} 终止失败: ${result.reason ?? '未知原因'}`,
      error: result.killed ? undefined : result.reason,
    };
  },
};

export const BUILTIN_TOOLS: Tool[] = [
  read_file,
  list_dir,
  grep,
  glob,
  run_command,
  list_background_tasks,
  get_command_output,
  wait_command,
  kill_command,
  terminal_open,
  terminal_send,
  terminal_read,
  terminal_resize,
  terminal_close,
  todo_write,
  ask_user_question,
];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
