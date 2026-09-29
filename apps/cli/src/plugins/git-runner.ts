// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * git 派生的唯一封顶出口(G-815 / G-816)。
 *
 * 立票缘由(现读,不引用文档数字):`apps/cli/src/plugins/cache.ts` 的三处派生此前是
 * `execFileSync(gitBin, args, { stdio: 'pipe', windowsHide: true })` —— **timeout / maxBuffer / 净化 env
 * 三件套全缺**,而专管"git 派生必须封顶"的守门 80(`scripts/check-git-read-timeout.mjs`)的 `HOT` 清单
 * 不含这一族文件 ⇒ 两边都不红。失效型具体化:
 *   - 共享 gitdir 被外部锁住 / 远端挂起 ⇒ 点"安装"一直转圈(无 timeout);
 *   - clone 进度输出超过 Node 默认 1MB ⇒ ENOBUFS 抛错而目录已有内容,表现成"clone 失败但东西在"(无 maxBuffer);
 *   - 从钩子或被 clone 仓库的上下文派生 ⇒ 继承 `GIT_DIR`/`GIT_INDEX_FILE`/`GIT_CONFIG_GLOBAL`/`GIT_SSH_COMMAND`,
 *     clone 落到**错误的对象库**(无 env 净化);
 *   - 代理/CA 配置不补回 ⇒ 安装按钮卡到协议超时。
 *
 * 与上游 ZCode 的关系(G-816「抄结构、不抄文案正则」):
 *   - **抄**:有限次数 + 每轮先问取消 + 重试前复位目标目录 + 退避挂 abort 监听
 *     (上游 `marketplace.ts:1662-1688` / `:1734-1758` 的骨架,纯 Node、无文案依赖)。
 *   - **不抄**:上游 `isRetryableGitCloneError` 按 stderr 正则分类(`RPC failed|Recv failure|early EOF …`)。
 *     本仓 §"不得靠错误文本做流程判断"(AGENTS 上游同款纪律 + 守门 135/67)禁止这一型。
 *
 * 分类实测(2026-09-29 本机 Windows,取证脚本 `.ihui-agent/tmp/git-caps-probe/probe.mjs`,真实字段):
 *   - 派生层失败给**结构化 code**:`ENOENT`(git 不存在)、`ETIMEDOUT` + `signal=SIGTERM`(被本出口封顶杀掉)、
 *     `ENOBUFS` + `signal=SIGTERM`(输出超 maxBuffer)。
 *   - **git 自己的网络失败**(实测 `git clone http://127.0.0.1:9/x.git` 与 `https://…invalid/x.git`)
 *     只有 `status=128`,**没有 errno、没有可区分码**;权限/路径/仓库不存在这类确定性失败同样是 128 或 1。
 *     ⇒ 票面预设的"量不出来就降级"成立:**只认 code/errno 白名单,其余一律不重试**(宁可不重试,绝不盲目重试)。
 *     代价如实登记:GitHub 偶发 RPC/recv timeout 落在 `status=128` 这一档,本实现**不会**为它自动重试
 *     —— 要覆盖它需要结构化信号(git 侧或 Node 侧新增),而不是回到文案正则。
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
// G-786 的形状拒绝错误:它是"安全拒绝类",必须原样上抛、绝不退避(G-809 点名的面)。
import { GitCloneInputRejectedError } from './url-shape.js';

/** 默认封顶:单趟 git 派生的墙上时间上限 */
export const DEFAULT_GIT_TIMEOUT_MS = 90_000;
/** clone/fetch 比本地操作慢一个量级,给独立一档(仍可被调用方覆盖) */
export const GIT_NETWORK_TIMEOUT_MS = 120_000;
/** 输出上限:上游取 10MB,本仓同值 —— 低于 Node 默认 1MB,否则大仓 clone 进度直接 ENOBUFS */
export const DEFAULT_GIT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
/** 封顶杀进程的信号(与门 80 的"写动词不判"取向配套:SIGTERM 给 git 收尾机会)。
 *  `as const` 是必需的:Node 的 `killSignal` 类型是 `number | Signals`,宽化成 string 直接 TS2769。 */
export const GIT_KILL_SIGNAL = 'SIGTERM' as const;
/** G-816:有限次数(含首轮),不是"无限重试"也不是"凡失败重试三次" */
export const GIT_CLONE_MAX_ATTEMPTS = 3;
/** 退避基数:第 n 次重试前等 base×n(线性,可被 abort 立即打断) */
export const GIT_CLONE_RETRY_BASE_DELAY_MS = 1_000;
/** 测试/非标准安装位的 git 覆盖钩子(沿用 cache.ts 既有键名,不得另立第二个) */
export const GIT_BIN_ENV = 'IHUI_GIT_BIN';

/**
 * env 白名单:只把 git 真需要的键投影过去。
 * 刻意**不在**表里的:`GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE` / `GIT_CONFIG_GLOBAL` /
 * `GIT_CONFIG_SYSTEM` / `GIT_SSH_COMMAND` / `GIT_ASKPASS` / 任何 `*_KEY`、`*_TOKEN`、`*_SECRET`。
 * 理由与上游 `sanitizeZCodeRuntimeEnv` 不同层:上游那张表住在
 * `.ihui-agent/tmp/zcode-study/zcode/packages/shared/src/runtimeEnv.ts:212`(本票已读),
 * 它是"剥黑名单"语义,而我方要的是"默认不继承"—— 剥黑名单会随上游新增键漏过,
 * 且把"我方需要的 GIT_*"一起剥掉的风险由下面显式列出的三个 GIT_* 网络档兜住。
 */
const GIT_ENV_ALLOWLIST: readonly string[] = [
  // 定位可执行文件与 DLL
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'WINDIR',
  'COMSPEC',
  'HOMEDRIVE',
  'HOMEPATH',
  'USERPROFILE',
  'USERNAME',
  'COMPUTERNAME',
  // POSIX 侧的家目录与临时目录(git 读 ~/.gitconfig 需要 HOME)
  'HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  // 字符集与时区影响 git 输出解析
  'LANG',
  'LC_ALL',
  'TZ',
  // 证书链(缺 ⇒ 内网/代理下 TLS 直接失败)
  'GIT_SSL_CAINFO',
  'GIT_SSL_CAPATH',
  'CURL_CA_BUNDLE',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
];
/** 代理族:大小写两档都要(库与 git 各自读法不同)。票面"代理配置不补回 ⇒ 卡到协议超时"就靠这一档 */
const PROXY_ENV_KEYS: readonly string[] = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY', 'FTP_PROXY'];

/** 无论调用方传什么都必须强制的档:禁止 git 交互式索要凭据(否则封顶前一直挂着) */
const FORCED_GIT_ENV: Readonly<Record<string, string>> = Object.freeze({
  GIT_TERMINAL_PROMPT: '0',
  GIT_ADVICE: '0',
});

/** 执行器错误(结构化形态,便于调用方按 `code`/`status` 分流,不读 message) */
export interface RawExecErrorLike {
  readonly code?: string | number;
  readonly errno?: string | number;
  readonly signal?: string | null;
  readonly status?: number | null;
  readonly stdout?: unknown;
  readonly stderr?: unknown;
}

/** 失败归类:`unsafe-rejection`(安全拒绝,原样上抛)/ `aborted` / `binary-missing` / `timeout` / `output-too-large` / `exit` */
export type GitFailureClass =
  | 'unsafe-rejection'
  | 'aborted'
  | 'binary-missing'
  | 'timeout'
  | 'output-too-large'
  | 'exit'
  | 'unknown';

export interface GitFailureVerdict {
  readonly class: GitFailureClass;
  /** 只有派生层给出结构化码时才有值(git 自身失败为 null —— 实测拿不到) */
  readonly code: string | null;
  /** git 退出码;被杀或没跑到 git 时为 null */
  readonly status: number | null;
  /** 是否允许退避后重试。**默认 false**,只有白名单内的传输/封顶码为 true */
  readonly retryable: boolean;
}

/** 可重试的派生层结构化码(白名单;新增前先问"这是瞬时还是确定性") */
const RETRYABLE_ERROR_CODES: readonly string[] = [
  'ETIMEDOUT', // 本出口把进程杀了 —— 挂起可能是一次瞬时网络/锁竞争,允许再来
  'ECONNRESET',
  'ECONNABORTED',
  'EPIPE',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EAGAIN',
];

export class GitBinaryUnavailableError extends Error {
  readonly class = 'binary-missing' as const;
  readonly code: string;
  readonly reasonCode = 'gitBinaryUnavailable';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GitBinaryUnavailableError';
    this.code = 'ENOENT';
  }
}

export class GitCommandTimeoutError extends Error {
  readonly class = 'timeout' as const;
  readonly code = 'ETIMEDOUT';
  readonly reasonCode = 'gitTimeout';
  readonly timeoutMs: number;
  readonly verb: string;
  constructor(verb: string, timeoutMs: number, options?: { cause?: unknown }) {
    super(`git ${verb} 超过 ${timeoutMs}ms 未返回,已被 ${GIT_KILL_SIGNAL} 终止(G-815 封顶)`, options);
    this.name = 'GitCommandTimeoutError';
    this.timeoutMs = timeoutMs;
    this.verb = verb;
  }
}

export class GitOutputTooLargeError extends Error {
  readonly class = 'output-too-large' as const;
  readonly code = 'ENOBUFS';
  readonly reasonCode = 'gitMaxBufferExceeded';
  readonly maxBufferBytes: number;
  readonly verb: string;
  constructor(verb: string, maxBufferBytes: number, options?: { cause?: unknown }) {
    super(
      `git ${verb} 的输出超过 ${maxBufferBytes}B 上限,本次结果**已作废**(不返回半截内容,G-815)`,
      options,
    );
    this.name = 'GitOutputTooLargeError';
    this.maxBufferBytes = maxBufferBytes;
    this.verb = verb;
  }
}

export class GitCommandFailedError extends Error {
  readonly class = 'exit' as const;
  readonly reasonCode = 'gitNonZeroExit';
  readonly status: number | null;
  readonly code: string | null;
  readonly verb: string;
  constructor(verb: string, status: number | null, code: string | null, printable: string, options?: { cause?: unknown }) {
    super(`git ${verb} 失败:退出码 ${status ?? '(无)'} / 错误码 ${code ?? '(无)'}${printable ? ` :: ${printable}` : ''}`, options);
    this.name = 'GitCommandFailedError';
    this.status = status;
    this.code = code;
    this.verb = verb;
  }
}

/** 取消通道:调用方 abort ⇒ 不再发起任何新一轮,也不在退避里继续等 */
export class GitOperationAbortedError extends Error {
  readonly class = 'aborted' as const;
  readonly reasonCode = 'aborted';
  constructor(message = 'git 操作已被取消(未发起/已中止下一轮)', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AbortError';
  }
}

/** 重试耗尽:诊断面必须说清"试了几轮 + 最后一轮的可打印原因"(见 redactForPrint 的凭据纪律) */
export class GitCloneRetriesExhaustedError extends Error {
  readonly reasonCode = 'gitCloneRetriesExhausted';
  readonly attempts: number;
  readonly lastClass: GitFailureClass;
  readonly lastCode: string | null;
  readonly lastStatus: number | null;
  constructor(info: {
    attempts: number;
    lastClass: GitFailureClass;
    lastCode: string | null;
    lastStatus: number | null;
    lastPrintable: string;
    cause?: unknown;
  }) {
    super(
      `git clone 在 ${info.attempts} 次尝试后仍未成功(最后一轮 ${info.lastClass}` +
        ` / 码 ${info.lastCode ?? '(无)'} / 退出码 ${info.lastStatus ?? '(无)'})` +
        `${info.lastPrintable ? ` :: ${info.lastPrintable}` : ''}`,
      { cause: info.cause },
    );
    this.name = 'GitCloneRetriesExhaustedError';
    this.attempts = info.attempts;
    this.lastClass = info.lastClass;
    this.lastCode = info.lastCode;
    this.lastStatus = info.lastStatus;
  }
}

/**
 * 从候选里挑一个**存在**的绝对路径,拿不到才回退 `'git'`(交给 PATH)。
 * 刻意不做"跑一次 --version"的探活:那是真派生,会污染既有"拒绝路径根本不派生 git"的断言
 * (apps/cli/tests/plugin-git-url-shape.test.ts 按 execFileSync 调用次数记账)。
 */
export function resolveGitBinary(sourceEnv: NodeJS.ProcessEnv = process.env): string {
  const override = (sourceEnv[GIT_BIN_ENV] ?? sourceEnv.GIT_BIN ?? '').trim();
  // 测试钩子优先:用例常把它指向**不存在**的路径来模拟 git 缺失 ⇒ 这里不得存在性过滤掉它
  if (override) return override;
  const candidates: readonly string[] =
    process.platform === 'win32'
      ? ['C:/Program Files/Git/cmd/git.exe', 'C:/Program Files (x86)/Git/cmd/git.exe']
      : ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* 存在性判不了就当没有,继续下一候选 */
    }
  }
  return 'git';
}

/** 把调用方 env **投影**成白名单(默认不继承 ⇒ 新增的危险键不会自动透传) */
export function buildGitEnv(sourceEnv: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of [...GIT_ENV_ALLOWLIST, ...PROXY_ENV_KEYS]) {
    const value = sourceEnv[key];
    if (typeof value === 'string' && value.length > 0) env[key] = value;
    const lower = key.toLowerCase();
    const lowerValue = sourceEnv[lower];
    if (typeof lowerValue === 'string' && lowerValue.length > 0) env[lower] = lowerValue;
  }
  return { ...env, ...FORCED_GIT_ENV };
}

export interface GitSpawnOptions {
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
  /** 投影源 env(默认 process.env)。**永不是**"整份传给子进程" —— 见 buildGitEnv */
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  /** 测试/注入位:生产调用方不传,交给 resolveGitBinary */
  readonly binary?: string;
}

export interface ResolvedGitSpawnOptions {
  readonly binary: string;
  readonly timeoutMs: number;
  readonly maxBufferBytes: number;
  readonly env: Record<string, string>;
  readonly cwd?: string;
  readonly windowsHide: true;
  readonly killSignal: typeof GIT_KILL_SIGNAL;

  readonly stdio: 'pipe';
  readonly encoding: 'utf8';
}

/** 默认值收敛在这一处(三个参数都必须有默认值),便于用例断言"没传也不等于没封顶" */
export function resolveGitSpawnOptions(
  opts: GitSpawnOptions = {},
  defaultTimeoutMs: number = DEFAULT_GIT_TIMEOUT_MS,
): ResolvedGitSpawnOptions {
  return {
    binary: opts.binary ?? resolveGitBinary(opts.env ?? process.env),
    timeoutMs: opts.timeoutMs ?? defaultTimeoutMs,
    maxBufferBytes: opts.maxBufferBytes ?? DEFAULT_GIT_MAX_BUFFER_BYTES,
    env: buildGitEnv(opts.env ?? process.env),
    cwd: opts.cwd,
    windowsHide: true,
    killSignal: GIT_KILL_SIGNAL,
    stdio: 'pipe',
    encoding: 'utf8',
  };
}

/** 从 argv 里取 git 子命令动词(只为错误文案可读;分类不依赖它) */
export function gitVerbOf(args: readonly string[]): string {
  for (const a of args) {
    if (typeof a !== 'string' || !a) continue;
    if (a.startsWith('-')) break; // 全局选项在动词之前 ⇒ 认不出就返回 git
    if (/^[a-z][a-z0-9-]*$/.test(a)) return a;
    break;
  }
  return 'git';
}

/**
 * 可打印原因:**只用结构码 + 脱敏后的 stderr 尾部**。
 * 脱敏是硬要求(票面:不得把凭据/URL 查询串带进错误文本)—— 实测 git 会把完整 URL 打进 stderr
 * (`fatal: unable to access 'http://…'`),URL 里可能带 user:pass 或 ?token=。
 * 分类判据**从不**读这段文本(见 classifyGitFailure),所以它只影响可读性、不影响流程。
 */
export function redactForPrint(text: string, max = 300): string {
  if (!text) return '';
  const scrubbed = text
    .replace(/[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s'"<>]+/g, '<url-redacted>') // scheme://…(含 userinfo/query)
    .replace(/\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|authorization)[=:\s]+[^\s,;]+/gi, (m) => {
      const sep = m.search(/[=:\s]/);
      return `${m.slice(0, sep)}=<redacted>`;
    })
    .replace(/\s+/g, ' ')
    .trim();
  return scrubbed.length > max ? `${scrubbed.slice(0, max)}…` : scrubbed;
}

/** 结构化字段读取(不 import child_process 的类型,避免把 Node 错误形态钉成公共类型) */
function readRaw(raw: unknown): RawExecErrorLike {
  if (!raw || typeof raw !== 'object') return {};
  const e = raw as Record<string, unknown>;
  return {
    code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : undefined,
    errno: typeof e.errno === 'string' || typeof e.errno === 'number' ? e.errno : undefined,
    signal: typeof e.signal === 'string' || e.signal === null ? (e.signal as string | null) : undefined,
    status: typeof e.status === 'number' || e.status === null ? (e.status as number | null) : undefined,
    stdout: e.stdout,
    stderr: e.stderr,
  };
}

function codeString(code: string | number | undefined): string | null {
  return typeof code === 'string' ? code : null;
}

/**
 * 分类:安全拒绝 > 取消 > 派生层结构化码 > 退出码。
 * 三条不可漂的写法:
 *   1. 带 `reasonCode` 的错误(G-786 形状拒绝、G-705 符号链接不安全、G-809 那一族)**一律原样上抛、绝不退避** ——
 *      拒绝是一次判定,不是瞬时故障;退避后重跑只会把"被拒"读成"刷新失败"。
 *   2. 只有 RETRYABLE_ERROR_CODES 白名单内的码才 retryable。实测 git 自身网络失败只有 status=128 ⇒
 *      落到 non-retryable(见文件头实测段),这是**有意的降级**,不是漏判。
 *   3. ENOBUFS / ENOENT 不重试:同一输入重跑必然复现(确定性),重试只是把失败拖成三倍时长。
 */
export function classifyGitFailure(raw: unknown): GitFailureVerdict {
  const code = codeString(readRaw(raw).code) ?? codeString(readRaw(raw).errno);
  const status = typeof readRaw(raw).status === 'number' ? (readRaw(raw).status as number) : null;
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  // 取消必须排在安全拒绝**之前**判:GitOperationAbortedError 自己也带 reasonCode('aborted'),
  // 先查 reasonCode 会把"用户按了取消"读成"被安全闸拒绝" —— 两者处置动作不同(一个什么都不必改,
  // 一个必须改输入),归错类的错误文本会把人指向错误的修复方向(实测由本轮用例抓到)。
  if ((raw instanceof Error && raw.name === 'AbortError') || record.class === 'aborted' || record.reasonCode === 'aborted') {
    return { class: 'aborted', code, status, retryable: false };
  }
  if (typeof record.reasonCode === 'string' && record.reasonCode !== 'gitTimeout') {
    return { class: 'unsafe-rejection', code, status, retryable: false };
  }
  if (code === 'ENOENT') return { class: 'binary-missing', code, status, retryable: false };
  if (code === 'ENOBUFS') return { class: 'output-too-large', code, status, retryable: false };
  if (code === 'ETIMEDOUT') return { class: 'timeout', code, status, retryable: true };
  if (code && RETRYABLE_ERROR_CODES.includes(code)) return { class: 'unknown', code, status, retryable: true };
  if (status !== null) return { class: 'exit', code, status, retryable: false };
  return { class: 'unknown', code, status, retryable: false };
}

/** 把 Node 的派生错误归一成结构化错误类型(调用方只认类型与 code/status) */
export function toGitError(raw: unknown, verb: string, opts: { timeoutMs: number; maxBufferBytes: number }): Error {
  const verdict = classifyGitFailure(raw);
  const cause = raw instanceof Error ? raw : undefined;
  if (verdict.class === 'unsafe-rejection' || verdict.class === 'aborted') {
    return raw instanceof Error ? raw : new Error(String(raw), { cause });
  }
  const stderrText = typeof readRaw(raw).stderr === 'string' ? (readRaw(raw).stderr as string) : '';
  const printable = redactForPrint(stderrText);
  if (verdict.class === 'binary-missing') {
    return new GitBinaryUnavailableError(
      `找不到可用的 git(派生 ${verb} 时 ENOENT)。可用 IHUI_GIT_BIN 指定绝对路径;当前候选解析见 apps/cli/src/plugins/git-runner.ts::resolveGitBinary`,
      { cause },
    );
  }
  if (verdict.class === 'timeout') {
    return new GitCommandTimeoutError(verb, opts.timeoutMs, { cause });
  }
  if (verdict.class === 'output-too-large') {
    return new GitOutputTooLargeError(verb, opts.maxBufferBytes, { cause });
  }
  return new GitCommandFailedError(verb, verdict.status, verdict.code, printable, { cause });
}

/**
 * 唯一出口:任何 cli 插件域的 git 派生都必须经这里。
 * 返回 stdout;`ENOBUFS` 一律抛结构化错误,**绝不返回半截内容**(票面验收点之一)。
 */

/**
 * G-814424：输出超上限时**降级到更便宜的查询模式并记住、喊出来**，而不是直接作废整份结论。
 *
 * 上游的做法（repo 层 collapsedUntrackedRepoRoots）是「大仓 status 超上限 ⇒ 切目录折叠、
 * 把折叠记在 repoRoot 上、再 warn 说明」。我方此前只有一档 output-too-large ⇒ 抛
 * GitOutputTooLargeError（「本次结果已作废」），表现是大仓里状态查询永远失败，而调用方
 * 拿不到任何「我知道你少了什么」的信号。
 *
 * 四条不可漂的写法：
 *  1. **只在 output-too-large 这一类上降级** —— 超时/中断/安全拒绝/普通失败一律原样上抛
 *     （把别的失败也重跑一次，等于给「命令本身有问题」发第二次机会，那是掩盖不是降级）；
 *  2. 折叠档 = git 自带的 --untracked-files=normal（含未跟踪文件的目录整目录成一条 dir/），
 *     它是 git 的正式档，不是自造的「截断前 N 行」——半截输出会被读成「文件不存在」；
 *  3. 降级必须**留痕且可问**：degraded 字段 + 按 cwd 记忆的 lastStatusDegradation(cwd) + 一行 warn。
 *     第二档仍超限就照旧抛 ⇒ 宁可失败，绝不返回一份看起来完整的空结论；
 *  4. 同 key(cwd)记过降级后，**后续请求直接走折叠档**，不再先用全档撞一次上限
 *     （撞一次 = 白付一次注定作废的全量派生 + 一次 ENOBUFS，上游把折叠记在 repoRoot 上是同一取向）。
 *     warn 只在首次降级时喊，之后不重复刷屏：降级事实由每次结论上的 degraded 字段如实留痕，
 *     消费方必须先看 degraded 再决定能不能把这份清单当完整结论用。
 */
export interface GitStatusOutcome {
  readonly lines: string[];
  /** true ⇒ 这份列表是折叠过的，不得当「完整未跟踪清单」用。 */
  readonly degraded: boolean;
  /** 折叠档下形如 dir/ 的条目（即被并成一条的未跟踪目录根）。 */
  readonly collapsedUntrackedRoots: string[];
}

export interface GitStatusOptions extends GitSpawnOptions {
  /** warn 出口，默认写 stderr；测试传一个收集器。 */
  readonly warn?: (msg: string) => void
}

interface DegradationMemo {
  readonly at: number
  readonly collapsedRoots: number
  readonly maxBufferBytes: number
}

const statusDegrations = new Map<string, DegradationMemo>()

/** 问某个工作目录最近一次状态查询是不是被折叠过（没有 ⇒ null，不猜）。 */
export function lastStatusDegradation(cwd: string): DegradationMemo | null {
  return statusDegrations.get(cwd) ?? null
}

/** 记账面在长跑进程里也必须有界 ⇒ 只留最近 64 个工作目录。 */
function rememberDegradation(cwd: string, memo: DegradationMemo): void {
  statusDegrations.set(cwd, memo)
  if (statusDegrations.size <= 64) return
  const oldest = statusDegrations.keys().next()
  if (!oldest.done) statusDegrations.delete(oldest.value)
}

const STATUS_FULL_ARGS = ['status', '--porcelain', '-uall'] as const
const STATUS_COLLAPSED_ARGS = ['status', '--porcelain', '--untracked-files=normal'] as const

/** 折叠档一档:跑 --untracked-files=normal,把 `dir/` 形条目认成被并拢的未跟踪目录根(结论恒带 degraded=true) */
function runCollapsedStatus(cwd: string, opts: GitStatusOptions, split: (out: string) => string[]): GitStatusOutcome {
  const lines = split(execGitCapped([...STATUS_COLLAPSED_ARGS], { ...opts, cwd }))
  return { lines, degraded: true, collapsedUntrackedRoots: lines.filter((l) => l.endsWith('/')) }
}

export function execGitStatus(cwd: string, opts: GitStatusOptions = {}): GitStatusOutcome {
  const warn = opts.warn ?? ((m: string): void => { process.stderr.write(m + '\n') })
  const split = (out: string): string[] => out.split('\n').filter((l) => l.length > 0)
  // 同 key(cwd)已记过降级 ⇒ 直奔折叠档,不再先用全档撞一次上限(撞一次 = 白付一次注定作废的全量派生)。
  // warn 不重复喊:降级事实由每次结论上的 degraded 字段留痕,刷屏不产生新信息。
  if (statusDegrations.has(cwd)) return runCollapsedStatus(cwd, opts, split)
  try {
    const out = execGitCapped([...STATUS_FULL_ARGS], { ...opts, cwd })
    return { lines: split(out), degraded: false, collapsedUntrackedRoots: [] }
  } catch (raw) {
    if (!(raw instanceof GitOutputTooLargeError)) throw raw
    const collapsed = runCollapsedStatus(cwd, opts, split)
    rememberDegradation(cwd, { at: Date.now(), collapsedRoots: collapsed.collapsedUntrackedRoots.length, maxBufferBytes: raw.maxBufferBytes })
    warn(
      '[git-runner] ' + cwd + ' 的 git status 输出超过 ' + raw.maxBufferBytes + 'B ⇒ 已降级为按目录折叠未跟踪项' +
        '(' + collapsed.collapsedUntrackedRoots.length + ' 个目录根被并成一条)。这份清单**不是完整未跟踪列表**，不得据此判「某文件不存在」。',
    )
    return collapsed
  }
}

export function execGitCapped(args: readonly string[], opts: GitSpawnOptions = {}): string {
  const resolved = resolveGitSpawnOptions(opts);
  const verb = gitVerbOf(args);
  try {
    return execFileSync(resolved.binary, [...args], {
      cwd: resolved.cwd,
      env: resolved.env,
      encoding: resolved.encoding,
      maxBuffer: resolved.maxBufferBytes,
      timeout: resolved.timeoutMs,
      killSignal: resolved.killSignal,
      windowsHide: resolved.windowsHide,
      stdio: resolved.stdio,
    });
  } catch (raw) {
    throw toGitError(raw, verb, { timeoutMs: resolved.timeoutMs, maxBufferBytes: resolved.maxBufferBytes });
  }
}

export interface GitCloneRetryOptions extends GitSpawnOptions {
  /** 含首轮的总尝试数上限 */
  readonly attempts?: number;
  readonly baseDelayMs?: number;
  readonly signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new GitOperationAbortedError();
}

/**
 * 重试前复位目标目录(上游骨架 `:1671-1674`,不抄它的文案正则)。
 * 为什么必须复位:git 拒绝 clone 进**非空目录**,不复位则第二轮必然撞上第一轮的残骸,
 * 表现成"重试永远失败" —— 而真正的瞬时原因早已消失。
 */
function resetTargetDirectory(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 复位失败不掩盖原始错误:仍按原样继续重试判定 */
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* 同上 */
  }
}

/** 可取消退避(上游 `:1734-1758` 的写法,纯 Node、零文案依赖) */
export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new GitOperationAbortedError());
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = (): void => {
      if (timer) clearTimeout(timer);
      reject(new GitOperationAbortedError());
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * clone 的封顶重试:**有限次数 + 只对可重试类别退避 + 重试前复位目录**。
 * 安全拒绝类(GitCloneInputRejectedError / 任何带 reasonCode 的判定)与取消**原样上抛、绝不退避**。
 * 只用于 clone:`fetch` 的复位语义不同(删掉已 clone 的仓库等于把可用状态毁掉),故不走这里。
 */
export async function execGitCloneWithRetry(
  cloneArgs: readonly string[],
  targetDir: string,
  opts: GitCloneRetryOptions = {},
): Promise<void> {
  const maxAttempts = Math.max(1, opts.attempts ?? GIT_CLONE_MAX_ATTEMPTS);
  const baseDelayMs = opts.baseDelayMs ?? GIT_CLONE_RETRY_BASE_DELAY_MS;
  const spawnOpts: GitSpawnOptions = { ...opts, timeoutMs: opts.timeoutMs ?? GIT_NETWORK_TIMEOUT_MS };
  let lastError: Error | null = null;
  let lastVerdict: GitFailureVerdict = { class: 'unknown', code: null, status: null, retryable: false };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfAborted(opts.signal);
    if (attempt > 1) resetTargetDirectory(targetDir);
    try {
      execGitCapped(cloneArgs, spawnOpts);
      return;
    } catch (raw) {
      if (raw instanceof GitCloneInputRejectedError) throw raw;
      const verdict = classifyGitFailure(raw);
      lastVerdict = verdict;
      lastError = raw instanceof Error ? raw : new Error(String(raw));
      // 确定性错误(安全拒绝 / git 不存在 / 输出超限 / 普通非零退出)⇒ 立即抛,不掩盖真实原因
      if (verdict.class === 'unsafe-rejection' || verdict.class === 'aborted' || !verdict.retryable) {
        throw raw;
      }
      if (attempt >= maxAttempts) break;
      await sleepAbortable(baseDelayMs * attempt, opts.signal);
    }
  }

  const printable =
    lastError && lastError instanceof GitCommandFailedError
      ? redactForPrint(lastError.message)
      : lastError
        ? redactForPrint(lastError.message)
        : '';
  throw new GitCloneRetriesExhaustedError({
    attempts: maxAttempts,
    lastClass: lastVerdict.class,
    lastCode: lastVerdict.code,
    lastStatus: lastVerdict.status,
    lastPrintable: printable,
    cause: lastError ?? undefined,
  });
}

/** 供诊断输出:当前解析到的 git 绝对路径(不含任何 env 值) */
export function describeGitRuntime(): { binary: string; timeoutMs: number; maxBufferBytes: number } {
  return {
    binary: resolveGitBinary(),
    timeoutMs: DEFAULT_GIT_TIMEOUT_MS,
    maxBufferBytes: DEFAULT_GIT_MAX_BUFFER_BYTES,
  };
}

/** 只在测试与诊断里用到的路径拼接守卫(确保 target 一定在 cwd 之下可由调用方给出) */
export function isAbsoluteTarget(target: string): boolean {
  return path.isAbsolute(target);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
