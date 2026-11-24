// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-710:工具面失败码判定的**唯一出口**(守门 162 `check-error-code-not-text-matching.mjs`
 * 的 OUTLET_REQUIREMENTS 点名本文件)。
 *
 * 立因:`tools/index.ts::classifyError` 与 `compaction-v2.ts::classifyError` 今天拿**错误文案**
 * 决定重试(`includes('429')` / `'rate limit'` / `'限流'`),而文案是给人看的,厂商换一句措辞
 * 判据就静默改向。本模块把三件事收进一个出口:
 *  1. **抛出方给码** —— `ToolError{code}` 把失败身份放在结构化通道上,toJSON/fromJSON 保住跨日志/IPC;
 *  2. **结构化先决** —— `resolveFailureCode` 读码不读措辞;同一段文本挂不同码 ⇒ 不同结论
 *     (测试用"文本与码互相矛盾"的夹具钉死,不是"文本恰好一致");
 *  3. **文案只兜底且必须计数报名** —— 无码时才读文案,每次读取按站点记账
 *     (`getFailureFallbackStats`),所以"兜底在被用"是台账,不是一句注释。
 *
 * 口径纪律:本票**只换判据来源,不改判据强度** —— 两张文案表的字面量逐字自改前两个
 * classifyError 移植(数据驱动:字面量住在数据里,判据读变量,守门 162 认这一型为合法兜底形态),
 * 可重试集合(network/timeout/rate_limited)与致命档(permission)逐字未变。
 */

/** 失败码闭集 —— 工具面身份判定的唯一词表(票面五档 + 工具面既有六档 + 压缩面既有标签档)。 */
export const FAILURE_CODES = [
  'rate_limited',
  'timeout',
  'permission',
  'not_found',
  'network',
  'cancelled',
  'driver',
  'context_limit',
  'client_error',
  'parse',
  'unknown',
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

export function isFailureCode(value: unknown): value is FailureCode {
  return typeof value === 'string' && (FAILURE_CODES as readonly string[]).includes(value);
}

/** 工具面同请求重试档(逐字 = 改前 `isRetryableErrorType` 的三档:只换读法,不改强度)。 */
export const RETRYABLE_FAILURE_CODES: ReadonlySet<FailureCode> = new Set<FailureCode>([
  'network',
  'timeout',
  'rate_limited',
]);

/** 致命档(逐字 = 改前 `isFatalErrorType`:仅 permission)。 */
const FATAL_FAILURE_CODES: ReadonlySet<FailureCode> = new Set<FailureCode>(['permission']);

export function isRetryableFailureCode(code: FailureCode): boolean {
  return RETRYABLE_FAILURE_CODES.has(code);
}

export function isFatalFailureCode(code: FailureCode): boolean {
  return FATAL_FAILURE_CODES.has(code);
}

/**
 * 压缩面的瞬态档(逐字 = 改前 compaction classifyError 的结论表:timeout/network/5xx 瞬态、
 * 4xx/parse 确定性、默认瞬态 —— rate_limited 沿改前行为落瞬态;码位不在表内 ⇒ 确定性不重试)。
 * 抛出方给码后 `cancelled`/`context_limit` 由此档拿到"不重试"的正确结论(改前被默认档误判成瞬态)。
 */
export const COMPACTION_TRANSIENT_FAILURE_CODES: ReadonlySet<FailureCode> = new Set<FailureCode>([
  'rate_limited',
  'timeout',
  'network',
  'driver',
  'unknown',
]);

export function isTransientFailureCode(code: FailureCode): boolean {
  return COMPACTION_TRANSIENT_FAILURE_CODES.has(code);
}

/** 压缩面 `[label]` 文案的既有词汇:5xx/4xx 是历史标签,其余标签 = 码名本身。 */
const COMPACTION_LEGACY_LABELS: Readonly<Partial<Record<FailureCode, string>>> = Object.freeze({
  driver: '5xx',
  client_error: '4xx',
});

export function compactionLabelOf(code: FailureCode): string {
  return COMPACTION_LEGACY_LABELS[code] ?? code;
}

// ───────────────────────── 文案档(数据驱动,只兜底) ─────────────────────────

/** 文案档的一条规则:needles 任一子串命中(小写包含)或 patterns 任一正则命中。 */
export interface FailureTextRule {
  /** 改前标签(压缩面进 `[label]` 文案;工具面 = 码名) */
  label: string;
  code: FailureCode;
  /** 任一命中即可(与改前 `||` 链逐字对应) */
  needles?: readonly string[];
  patterns?: readonly RegExp[];
}

/**
 * 工具面文案表 —— 字面量**逐字**自改前 `tools/index.ts::classifyError` 移植(判序也是逐字的:
 * rate_limited → timeout → permission → not_found → network)。
 */
export const FAILURE_TEXT_RULES: readonly FailureTextRule[] = Object.freeze([
  { label: 'rate_limited', code: 'rate_limited', needles: ['rate limit', '限流', 'too many requests', '429'] },
  { label: 'timeout', code: 'timeout', needles: ['timeout', 'timed out', '超时', 'etimedout'] },
  { label: 'permission', code: 'permission', needles: ['permission denied', 'access forbidden', '权限不足', '操作被拒绝', 'eacces', 'eperm'] },
  { label: 'not_found', code: 'not_found', needles: ['not found', 'enoent', '不存在', 'no such file'] },
  { label: 'network', code: 'network', needles: ['network error', 'econnreset', 'econnrefused', 'fetch failed', '连接被拒绝', 'enotfound', 'epipe'] },
]);

/**
 * 压缩面文案表 —— 字面量与判序**逐字**自改前 `compaction-v2.ts::classifyError` 移植,
 * 只在 'compaction-sampling' 站点生效(两faces词表不同,跨站串表会改判据强度)。
 */
export const COMPACTION_TEXT_RULES: readonly FailureTextRule[] = Object.freeze([
  { label: 'timeout', code: 'timeout', needles: ['timeout', 'timed out'] },
  { label: 'network', code: 'network', needles: ['network', 'econnreset', 'econnrefused', 'fetch failed', 'socket hang up'] },
  { label: '5xx', code: 'driver', patterns: [/\b5\d{2}\b/] },
  { label: '5xx', code: 'driver', needles: ['server error', 'bad gateway', 'service unavailable'] },
  { label: '4xx', code: 'client_error', patterns: [/\b4\d{2}\b/] },
  { label: '4xx', code: 'client_error', needles: ['bad request', 'unauthorized', 'forbidden', 'not found'] },
  { label: 'parse', code: 'parse', needles: ['parse', 'json', 'invalid response'] },
]);

/** 站点 → 文案表。未登记站点用工具面表(工具面是本出口的主场)。 */
const SITE_RULE_TABLES: Readonly<Record<string, readonly FailureTextRule[]>> = Object.freeze({
  'compaction-sampling': COMPACTION_TEXT_RULES,
});

function rulesForSite(site: string): readonly FailureTextRule[] {
  return SITE_RULE_TABLES[site] ?? FAILURE_TEXT_RULES;
}

// ───────────────────────── 抛出方给码 ─────────────────────────

export type ToolErrorDetail = Record<string, string | number | boolean>;

const sanitizeDetail = (detail: Record<string, unknown>): ToolErrorDetail => {
  const out: ToolErrorDetail = {};
  for (const [k, v] of Object.entries(detail)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
};

/**
 * 抛出方给码的具名错误(G-710):码在结构化通道上一路可见,接收端 `resolveFailureCode`
 * 读码不读措辞。detail 只收标量 —— 凭据面不得被顺手带进错误载荷。
 */
export class ToolError extends Error {
  readonly code: FailureCode;
  readonly detail?: ToolErrorDetail;

  constructor(code: FailureCode, message: string, opts?: { detail?: Record<string, unknown>; cause?: unknown }) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    if (opts?.detail !== undefined) this.detail = sanitizeDetail(opts.detail);
    if (opts?.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }

  toJSON(): { name: string; code: FailureCode; message: string; detail?: ToolErrorDetail } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.detail !== undefined ? { detail: this.detail } : {}),
    };
  }

  /** 认不出(缺码 / 码不在闭集 / 非对象)一律 undefined,绝不替载荷编一个码。 */
  static fromJSON(value: unknown): ToolError | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const v = value as { code?: unknown; message?: unknown; detail?: unknown };
    if (typeof v.code !== 'string' || !isFailureCode(v.code)) return undefined;
    const message = typeof v.message === 'string' ? v.message : '';
    const detail =
      typeof v.detail === 'object' && v.detail !== null
        ? sanitizeDetail(v.detail as Record<string, unknown>)
        : undefined;
    return new ToolError(v.code, message, ...(detail !== undefined ? [{ detail }] : []));
  }
}

// ───────────────────────── 结构化码位 ─────────────────────────

/**
 * errno → 失败码(`Error.code` 的现读码名,与改前文案表里的同名小写形态一一对应 ——
 * 改前在文本里嗅探 `eacces`/`enoent`/`econnreset`…,现在直接读 `Error.code` 这条结构化通道)。
 */
const ERRNO_TO_FAILURE_CODE: Readonly<Record<string, FailureCode>> = Object.freeze({
  ETIMEDOUT: 'timeout',
  ECONNRESET: 'network',
  ECONNREFUSED: 'network',
  ENOTFOUND: 'network',
  EPIPE: 'network',
  EHOSTUNREACH: 'network',
  ENETUNREACH: 'network',
  EACCES: 'permission',
  EPERM: 'permission',
  ENOENT: 'not_found',
});

/** HTTP 状态 → 失败码(协议常量,不是文案;5xx 落 driver = 下游故障档)。 */
function statusCodeToFailureCode(status: number): FailureCode | undefined {
  if (status === 429) return 'rate_limited';
  if (status === 408) return 'timeout';
  if (status === 404) return 'not_found';
  if (status === 401 || status === 403) return 'permission';
  if (status >= 500 && status <= 599) return 'driver';
  return undefined;
}

/**
 * 结构化面的码位读取:只读结构化字段,**一次文本都不读**。字段读取全程防 getter 抛错 ——
 * 坏 getter 不得把判定升级成二次故障。
 */
export function structuredFailureCodeOf(input: unknown): FailureCode | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const read = (key: string): unknown => {
    try {
      return (input as Record<string, unknown>)[key];
    } catch {
      return undefined;
    }
  };
  // ① 抛出方显式给的码(ToolError)或 errno(`Error.code`)
  const own = read('code');
  if (typeof own === 'string') {
    if (isFailureCode(own)) return own;
    const errno = ERRNO_TO_FAILURE_CODE[own.toUpperCase()];
    if (errno !== undefined) return errno;
  }
  // ② HTTP 状态
  const status = read('status') ?? read('statusCode');
  if (typeof status === 'number') {
    const mapped = statusCodeToFailureCode(status);
    if (mapped !== undefined) return mapped;
  }
  // ③ 上游已归档的错误类型
  const errorType = read('errorType');
  if (typeof errorType === 'string' && isFailureCode(errorType)) return errorType;
  return undefined;
}

// ───────────────────────── 兜底台账(可观测性) ─────────────────────────

export interface FailureFallbackStats {
  /** 兜底被读的总次数(未命中也计 —— "兜底在硬扛"的证据) */
  total: number;
  /** 站点 → 读次 */
  bySite: Record<string, number>;
  /** `site|code` → 读次(回答"是哪一处在读哪一类文本") */
  bySiteAndCode: Record<string, number>;
}

/**
 * 进程级台账。为什么用模块级可变状态而不是返回值里带一个 id:
 * 测试要断言的是"这次改动之后,兜底被走了几次",那是一个**计数**,不是一行日志;
 * 日志可以吞,计数吞不掉。
 */
const fallbackLedger = {
  total: 0,
  bySite: {} as Record<string, number>,
  bySiteAndCode: {} as Record<string, number>,
};

function noteFallbackRead(site: string, code: FailureCode): void {
  fallbackLedger.total += 1;
  fallbackLedger.bySite[site] = (fallbackLedger.bySite[site] ?? 0) + 1;
  const key = `${site}|${code}`;
  fallbackLedger.bySiteAndCode[key] = (fallbackLedger.bySiteAndCode[key] ?? 0) + 1;
}

export function getFailureFallbackStats(): FailureFallbackStats {
  return {
    total: fallbackLedger.total,
    bySite: { ...fallbackLedger.bySite },
    bySiteAndCode: { ...fallbackLedger.bySiteAndCode },
  };
}

export function resetFailureFallbackStats(): void {
  fallbackLedger.total = 0;
  fallbackLedger.bySite = {};
  fallbackLedger.bySiteAndCode = {};
}

/** 一行式摘要,给遥测/`--debug` 用(不参与判据)。 */
export function formatFailureFallbackStats(): string {
  const s = getFailureFallbackStats();
  const sites = Object.entries(s.bySite)
    .map(([site, n]) => `${site}=${n}`)
    .join(', ');
  return `failure-text-fallback: total=${s.total}${sites.length > 0 ? ` [${sites}]` : ''}`;
}

// ───────────────────────── 判定 ─────────────────────────

function matchTextRule(lowered: string, rule: FailureTextRule): boolean {
  for (const needle of rule.needles ?? []) {
    if (lowered.includes(needle)) return true;
  }
  for (const pattern of rule.patterns ?? []) {
    if (pattern.test(lowered)) return true;
  }
  return false;
}

/**
 * 文案兜底(被计数)。只有 `resolveFailureCode` 在结构化面读不出码时才会走到它;
 * 未命中也记一次 read —— "兜底读了但读不懂"正是"该给上游补码"的工单依据。
 */
export function classifyFailureText(
  text: string | null | undefined,
  site: string,
): { code: FailureCode; rule?: string } {
  const lowered = typeof text === 'string' ? text.toLowerCase() : '';
  if (lowered.length > 0) {
    for (const rule of rulesForSite(site)) {
      if (matchTextRule(lowered, rule)) {
        noteFallbackRead(site, rule.code);
        return { code: rule.code, rule: rule.label };
      }
    }
  }
  noteFallbackRead(site, 'unknown');
  return { code: 'unknown' };
}

export interface ResolvedFailureCode {
  code: FailureCode;
  /** structured = 码位说了算;text-fallback = 无码,读的是被计数的文案档 */
  via: 'structured' | 'text-fallback';
  fallbackUsed: boolean;
}

/** 身份判定(唯一出口):结构化字段先决;全空 ⇒ 走被计数的文案兜底。 */
export function resolveFailureCode(err: unknown, site: string): ResolvedFailureCode {
  const structured = structuredFailureCodeOf(err);
  if (structured !== undefined) {
    return { code: structured, via: 'structured', fallbackUsed: false };
  }
  const text = err instanceof Error ? err.message : typeof err === 'string' ? err : undefined;
  const fallback = classifyFailureText(text, site);
  return { code: fallback.code, via: 'text-fallback', fallbackUsed: true };
}

// ───────────────────────── 沙箱终态投影(HEAD 既有载体,本票逐字恢复) ─────────────────────────

/**
 * 以下四枚导出是 HEAD 版本文件的原住民(`builtins.ts:32` 自落库起就 import 它们,
 * `tests/gh-rate-limit.test.ts:129-138` 逐字断言其行为),G-710 重写本文件时必须原样保留:
 * 语义设计权属于沙箱终态投影那格,不归失败码票代答 —— 与上方失败码出口互不侵犯。
 */

/** 沙箱一层能自证的终态:只有"被超时中止"。正常跑完(哪怕非零退出)不产出终态标记。 */
export type SandboxTerminalStatus = 'timed_out';

/**
 * 投影输入。刻意收成"调用方手上真有的那一个字段"(`SandboxResult.timedOut`),
 * 而不是接收整个 SandboxResult:那样本模块会顺手依赖 stdout/exitCode 的形状,
 * 而那两个字段归沙箱层演进,不属于终态词汇。
 */
export interface SandboxTerminalInput {
  timedOut?: boolean;
}

/** 归档结果:写进 `ToolResult` 的两个字段(`terminalState` / `interrupted`)。 */
export interface SandboxTerminalState {
  status: SandboxTerminalStatus;
  /** 副作用不确定:调用方/模型不得把这一档读成"干净终态"。 */
  interrupted: true;
}

/**
 * `timedOut` ⇒ 终态;其余一切 ⇒ `null`。
 *
 * 失效方向刻意是"少标一个终态",不是"多标一个":非零退出、空输出、被 maxBuffer 截断都**不**算中止,
 * 因为那些情形下命令自己跑完了(归因见 `sandbox/index.ts::classifySpawnSyncFailure` 的归因序
 * `spawn_error > timed_out > cancelled > output_limit`)。把"跑完但失败"标成 interrupted,
 * 等于让重试逻辑与状态行都读到假的中止 —— 那比少标严重。
 */
export function mapTerminalState(input: SandboxTerminalInput): SandboxTerminalState | null {
  return input.timedOut ? { status: 'timed_out', interrupted: true } : null;
}

/**
 * 模型面尾注:超时那一档在 `[超时]` 之后追加的一行。
 *
 * 文案里 `'aborted before completion'` 这个短语**是用例逐字断言的**
 * (`tests/gh-rate-limit.test.ts:137`),所以它是契约的一部分,不是可随意润色的措辞。
 */
export const ABORTED_BEFORE_COMPLETION_NOTE =
  '[中止] 命令在完成前被中止(aborted before completion):输出与副作用均不确定,不得读成干净终态;重试前先核对盘上/远端现场。';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
