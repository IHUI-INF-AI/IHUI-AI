// i18n-content-exempt-file: 本文件的中文串全部是**错误文本匹配 needles**(用于识别上游与
// 操作系统返回的本地化错误消息),不是界面文案:没有对应的语言包键可取,把它塞进 t() 反而会让
// 匹配串随用户界面语言漂移(匹配档与显示档必须解耦)。命中数逐文件可见,由守门 70 只报数不判红。

/**
 * 失败码判定出口(G-710,2026-09-30 立)。
 *
 * 现网缺陷:重试决策由**错误文本**决定。
 * - `apps/cli/src/tools/index.ts` 的 `classifyError()` 注释自述"根据错误文本启发式分类",
 *   判据含 `includes('429')` / `'rate limit'` / `'限流'`,而 `executeWithRetry()` 用它的结论
 *   决定要不要再跑一遍;
 * - `apps/cli/src/compaction-v2.ts` 的私有 `classifyError()` 是第二座同型;
 * - `apps/cli/src/commands/agent.ts` 的注释把这件事写成了行为契约:
 *   "超时…classifyError 会分类为瞬态 → sampleWithRetry 重试"。
 *
 * 为什么这是缺陷而不是"够用的启发式":文本不是契约。上游改一句措辞、把 429 写成别的说法、
 * 或者操作系统换了错误消息的语言,判定就**静默翻转**,而 typecheck / lint / 单测全都不会红 ——
 * 现象只是"该重试的没重试"或"挂死被延长成两倍预算"。更糟的是判定方与被判定方没有任何接口:
 * 抛出方知道自己是什么失败(它就是抛的那一位),却只能把这件事编码进一句中文里。
 *
 * 上游对照(逐行读到体):`apps/zcode-cli/packages/dynamic-workflow/src/engine/errors.ts` 把错误
 * 按可处理位置分档成一条判别联合,错误带结构化载荷并 `toJSON/fromJSON` 往返,原文
 * "不依赖错误文本…正是本联合类型存在的目的"。本文件落同一思路的最小版:
 *
 * 1. **抛出方给码**:{@link ToolError} 携带闭集 `code`(闭集定义在 `@ihui/types/failure-code.ts`,
 *    跨端共读一份)。
 * 2. **判定优先读码**:{@link resolveFailureCode} 先走 `structuredFailureCodeOf`(码位/HTTP 档),
 *    读到就算判完。
 * 3. **文本档降级为兜底,且每次使用都计数报名**:{@link classifyFailureText} 只在拿不到码时使用,
 *    每次使用都按 `(站点 × 码)` 计数并落一条可见记录。计数不是装饰 —— 它是"这条兜底还剩多少真实
 *    使用面"的唯一证据,也是决定"下一步该给哪一处抛错方补码"的输入(没有这一维,清账只能按文件顺序
 *    盲扫)。把没判写成判过了是本仓最高频的失效型,所以这里选择"喊出来"而不是"猜得准"。
 *
 * 判序只有一份:`packages/shared/src/utils/error-messages.ts` 已经写着
 * `errorCode → HTTP status → 文案正则` 三档(那一条决定"给用户看哪句话")。本文件复用它的
 * **前两档形状**作为"有码/无码"的分界(实现收在 `structuredFailureCodeOf` 一处),
 * 第三档(文案)在本文件只留一张数据驱动的表 —— 不得在任何调用点再写一次 `includes`。
 *
 * 行为差异如实登记(与改前的三处不同,都是把"文本巧合"改回"码的本义"):
 * - 压缩面撞上限流(`rate_limited`)从"不重试"变成"退避重试":改前它被 `/\b4\d{2}\b/` 兜进 4xx 档,
 *   那是文本表的副作用,不是判断。压缩没有副作用,指数退避正是为这种情况写的。
 * - 权限拒绝(`permission`)在压缩面从"重试三次"变成"立即失败":确定性错误重试三次只会更慢。
 * - 工具面的可重试集合 **一字未动**(`network` / `timeout` / `rate_limited`),所以读工具的重试
 *   语义与改前逐字相同;要加档(例如把 `provider_unavailable` 也纳入)属另一票。
 */

import { isFailureCode, normalizeFailureCode, structuredFailureCodeOf, type FailureCode } from '@ihui/types';

// 闭集定义住在 `@ihui/types/failure-code.ts`(跨端共读一份)。这里只是**再导出类型**,
// 让 CLI 内的调用点不必为一条类型再引一个包 —— 值仍只有那一处声明,没有第二份真相。
export type { FailureCode } from '@ihui/types';

// ==================== 抛出方携带的码 ====================

/** 错误类名(序列化往返时用它做身份判据,不靠 `instanceof` —— 跨 realm/跨进程时 instanceof 会假阴)。 */
export const TOOL_ERROR_NAME = 'ToolError';

/** 结构化载荷的允许值类型:只收标量,免得把请求体/凭据整块挂进错误对象(与守门 67 同一条理由)。 */
export type ToolErrorDetailValue = string | number | boolean;

/** {@link ToolError.toJSON} 的产出形状。`code` 是 `string` 而不是 `FailureCode`:它是**面上来的**值,必须重新过闸。 */
export interface SerializedToolError {
  name: string;
  code: string;
  message: string;
  detail?: Record<string, ToolErrorDetailValue>;
}

/**
 * 工具/子代理执行面的具名错误:抛出方在这里**声明**这次失败是什么,而不是让下游去猜措辞。
 *
 * 为什么带 `detail` 而不是把上下文拼进 message:拼进 message 就等于把上下文变成"可被匹配的文本",
 * 而本票的全部目的就是让判定不再读文本。`detail` 只收标量、不参与判定,只供排障时点名。
 */
export class ToolError extends Error {
  readonly code: FailureCode;
  readonly detail: Readonly<Record<string, ToolErrorDetailValue>>;

  constructor(
    code: FailureCode,
    message: string,
    init?: { detail?: Record<string, ToolErrorDetailValue>; cause?: unknown },
  ) {
    super(message, init?.cause === undefined ? undefined : { cause: init.cause });
    this.name = TOOL_ERROR_NAME;
    this.code = code;
    this.detail = Object.freeze({ ...(init?.detail ?? {}) });
  }

  /** 落日志/回灌模型/跨进程时的结构化形态:`code` 必须在,否则接收端只能回到文本档。 */
  toJSON(): SerializedToolError {
    const detail = Object.keys(this.detail).length ? { ...this.detail } : undefined;
    return detail
      ? { name: TOOL_ERROR_NAME, code: this.code, message: this.message, detail }
      : { name: TOOL_ERROR_NAME, code: this.code, message: this.message };
  }

  /**
   * 从序列化形态还原。
   *
   * 返回 `undefined` 是结论而不是失败:载荷没带码、或带的码不在闭集里 ⇒ **认不出**。
   * 刻意的窄口径:替它编一个 `unknown` 会让"码在传输中被丢掉"这一格看起来像"已经判过了",
   * 而调用方拿到 undefined 时自然会走 {@link resolveFailureCode} 的兜底档并被计数。
   */
  static fromJSON(json: unknown): ToolError | undefined {
    if (typeof json !== 'object' || json === null) return undefined;
    const raw = json as Partial<SerializedToolError>;
    if (!isFailureCode(raw.code)) return undefined;
    const detail =
      typeof raw.detail === 'object' && raw.detail !== null ? (raw.detail as Record<string, ToolErrorDetailValue>) : undefined;
    return new ToolError(raw.code, typeof raw.message === 'string' ? raw.message : '', detail ? { detail } : undefined);
  }
}

// ==================== 兜底档:唯一一张文本表 ====================

/**
 * 文本规则。**数据驱动,不在代码里写分支** —— 这是刻意的形态选择:
 * `includes(<字面量>)` 散在 `if` 条件里就是本票要消灭的那一型(每加一条判断就多一处"文本即契约"),
 * 而一张表可以逐条审计、可以整表数还剩多少条真在被用到。
 *
 * 顺序即优先级(先匹配先返回),与改前两张表的方向保持一致。
 */
export interface FailureTextRule {
  /** 小写化后的子串匹配(中文档原样匹配,因为中文没有大小写) */
  readonly needle?: string;
  /** 只有"数字状态码族"这种无法用子表达的形状才用正则 */
  readonly pattern?: RegExp;
  readonly code: FailureCode;
  /**
   * 历史归档标签 —— **只用于错误文案**(`[4xx] …` / `[transient-exhausted:5xx] …`),
   * 不参与任何判定。留着它是为了不静默改坏已经在断言这段文案的既有用例;
   * 判定一律读 `code`。
   */
  readonly label: string;
}

export const FAILURE_TEXT_RULES: readonly FailureTextRule[] = Object.freeze([
  // 限流档(工具面既有四串,逐字保留)
  { needle: 'rate limit', code: 'rate_limited', label: 'rate_limited' },
  { needle: '限流', code: 'rate_limited', label: 'rate_limited' },
  { needle: 'too many requests', code: 'rate_limited', label: 'rate_limited' },
  { needle: '429', code: 'rate_limited', label: 'rate_limited' },
  // 超时档
  { needle: 'timeout', code: 'timeout', label: 'timeout' },
  { needle: 'timed out', code: 'timeout', label: 'timeout' },
  { needle: 'etimedout', code: 'timeout', label: 'timeout' },
  { needle: '超时', code: 'timeout', label: 'timeout' },
  // 权限档(工具面四串 + 压缩面 4xx 里的两个具体措辞;两者都不可重试,归并进权限档更准确)
  { needle: 'permission denied', code: 'permission', label: 'permission' },
  { needle: 'access forbidden', code: 'permission', label: 'permission' },
  { needle: 'eacces', code: 'permission', label: 'permission' },
  { needle: 'eperm', code: 'permission', label: 'permission' },
  { needle: 'unauthorized', code: 'permission', label: 'permission' },
  { needle: 'forbidden', code: 'permission', label: 'permission' },
  { needle: '权限不足', code: 'permission', label: 'permission' },
  { needle: '操作被拒绝', code: 'permission', label: 'permission' },
  // 资源不存在档
  { needle: 'not found', code: 'not_found', label: 'not_found' },
  { needle: 'enoent', code: 'not_found', label: 'not_found' },
  { needle: 'no such file', code: 'not_found', label: 'not_found' },
  { needle: '不存在', code: 'not_found', label: 'not_found' },
  // 网络档
  { needle: 'network', code: 'network', label: 'network' },
  { needle: 'econnreset', code: 'network', label: 'network' },
  { needle: 'econnrefused', code: 'network', label: 'network' },
  { needle: 'fetch failed', code: 'network', label: 'network' },
  { needle: 'socket hang up', code: 'network', label: 'network' },
  { needle: 'enotfound', code: 'network', label: 'network' },
  { needle: 'epipe', code: 'network', label: 'network' },
  { needle: '连接被拒绝', code: 'network', label: 'network' },
  // 上游不可用档(压缩面的 5xx 一族)
  { pattern: /\b5\d{2}\b/, code: 'provider_unavailable', label: '5xx' },
  { needle: 'server error', code: 'provider_unavailable', label: '5xx' },
  { needle: 'bad gateway', code: 'provider_unavailable', label: '5xx' },
  { needle: 'service unavailable', code: 'provider_unavailable', label: '5xx' },
  // 请求本身有问题档(压缩面的 4xx 一族 + 解析档)
  { pattern: /\b4\d{2}\b/, code: 'invalid_arguments', label: '4xx' },
  { needle: 'bad request', code: 'invalid_arguments', label: '4xx' },
  { needle: 'parse', code: 'invalid_arguments', label: 'parse' },
  { needle: 'json', code: 'invalid_arguments', label: 'parse' },
  { needle: 'invalid response', code: 'invalid_arguments', label: 'parse' },
]);

/** 表走完还没结论 —— 显式的"判不出"档,由调用方按自己的风险偏好处置。 */
export const FAILURE_TEXT_NO_MATCH: Readonly<{ code: FailureCode; label: string }> = Object.freeze({
  code: 'unknown' as FailureCode,
  label: 'unknown',
});

// ==================== 兜底计数(不得静默) ====================

/**
 * 兜底使用点。分档的理由:一条兜底被"谁"踩到决定了修法 ——
 * `tool-retry` 踩到意味着某个 handler 没给码;`compaction-sampling` 踩到意味着 sampler 边界没包好;
 * 全落在 `direct-call` 则是有人绕过出口自己调了文本档。
 */
export const FAILURE_FALLBACK_SITES = [
  'tool-retry',
  'tool-result-tagging',
  'compaction-sampling',
  'direct-call',
] as const;

export type FailureFallbackSite = (typeof FAILURE_FALLBACK_SITES)[number];

/** 每站点首次必报,之后每这么多条再报一次:既不能静默,也不能把 TUI 刷满(与 137 行那条 announce-once 同族)。 */
const FALLBACK_RE_REPORT_EVERY = 25;
/** 内存里留最近这么多条使用记录供排障;再多没意义(台账看计数,不是看流水)。 */
const FALLBACK_RECENT_LIMIT = 32;

interface FallbackRecord {
  readonly site: FailureFallbackSite;
  readonly code: FailureCode;
}

let fallbackTotal = 0;
const fallbackBySite = new Map<FailureFallbackSite, number>();
const fallbackBySiteAndCode = new Map<string, number>();
const fallbackRecent: FallbackRecord[] = [];
/** 已经报过的站点(控制"首次必报 + 每 N 条再报"的节奏)。 */
const fallbackAnnounced = new Map<FailureFallbackSite, number>();

function recordFallbackUse(site: FailureFallbackSite, code: FailureCode): void {
  fallbackTotal += 1;
  fallbackBySite.set(site, (fallbackBySite.get(site) ?? 0) + 1);
  const key = `${site}|${code}`;
  fallbackBySiteAndCode.set(key, (fallbackBySiteAndCode.get(key) ?? 0) + 1);
  fallbackRecent.push({ site, code });
  if (fallbackRecent.length > FALLBACK_RECENT_LIMIT) fallbackRecent.shift();
  const siteCount = fallbackBySite.get(site) ?? 1;
  const announced = fallbackAnnounced.get(site) ?? 0;
  if (announced === 0 || siteCount - announced >= FALLBACK_RE_REPORT_EVERY) {
    fallbackAnnounced.set(site, siteCount);
    // 播报走 console.warn(与 tool-arg enforce 那条同一条出口习惯),ASCII:界面文案面另有守门 70。
    console.warn(
      `[IHUI CLI] failure-code text fallback used at site=${site} code=${code} count=${siteCount} ` +
        `(total=${fallbackTotal}). Text matching is a FALLBACK only - the throwing side should carry a FailureCode ` +
        `(new ToolError(code, message)). This line repeats once per site, then every ${FALLBACK_RE_REPORT_EVERY} uses.`,
    );
  }
}

export interface FailureFallbackStats {
  /** 兜底被使用的总次数(结构化判定一次都不计进来)。 */
  total: number;
  bySite: Record<string, number>;
  bySiteAndCode: Record<string, number>;
  /** 最近若干条使用记录(有界,只用于定位"是哪一处在读文本")。 */
  recent: FailureRecordView[];
}

export interface FailureRecordView {
  site: FailureFallbackSite;
  code: FailureCode;
}

/** 只读快照:测试与诊断出口都读这一份,不许各自再算一遍。 */
export function getFailureFallbackStats(): FailureFallbackStats {
  const bySite: Record<string, number> = {};
  for (const [k, v] of fallbackBySite) bySite[k] = v;
  const bySiteAndCode: Record<string, number> = {};
  for (const [k, v] of fallbackBySiteAndCode) bySiteAndCode[k] = v;
  return {
    total: fallbackTotal,
    bySite,
    bySiteAndCode,
    recent: fallbackRecent.map((r) => ({ site: r.site, code: r.code })),
  };
}

export function resetFailureFallbackStats(): void {
  fallbackTotal = 0;
  fallbackBySite.clear();
  fallbackBySiteAndCode.clear();
  fallbackRecent.length = 0;
  fallbackAnnounced.clear();
}

/** 给人看的一行汇总(诊断命令与测试都可以用它,不必各自再拼一次)。 */
export function formatFailureFallbackStats(): string {
  if (fallbackTotal === 0) return 'failure-code text fallback: 0 uses (every decision read a code)';
  const sites = [...fallbackBySite.entries()].sort((a, b) => b[1] - a[1]);
  const parts = sites.map(([site, n]) => `${site}=${n}`);
  const codes = [...fallbackBySiteAndCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `failure-code text fallback: total=${fallbackTotal} · ${parts.join(' ')} · top ${codes.map(([k, n]) => `${k}:${n}`).join(', ')}`;
}

// ==================== 判定入口 ====================

/** 一次判定的完整结论。`via` 是**判据来源**,它决定了这条结论今天可信、明天是否还会可信。 */
export interface FailureResolution {
  readonly code: FailureCode;
  readonly via: 'structured' | 'text-fallback';
  /** 便捷位:与 `via === 'text-fallback'` 同值。读代码的人不应该去反推枚举比较。 */
  readonly fallbackUsed: boolean;
  /** 只用于文案的历史标签(见 {@link FailureTextRule.label})。判定不得读它。 */
  readonly label: string;
}

function textOf(source: unknown): string {
  if (typeof source === 'string') return source;
  if (typeof source !== 'object' || source === null) return '';
  try {
    const rec = source as Record<string, unknown>;
    for (const key of ['message', 'error'] as const) {
      const v = rec[key];
      if (typeof v === 'string' && v) return v;
    }
  } catch {
    return '';
  }
  return '';
}

/**
 * **文本兜底档**:只在拿不到任何结构化码时使用,每次使用都计数并报名。
 *
 * 为什么不干脆删掉它:今天仍有大量发射点没给码(hub/MCP 的外部错误、第三方 handler、
 * `String(err)` 转出来的散文)。删掉它等于把"判得不准"换成"什么都不判",而重试与退避
 * 需要一个大于零的结论。本函数是**降级**而不是维持原状:它的每次使用都是一条可清的账,
 * 计数归零就是可以摘掉它的时刻(那也是守门把"文本决定分支"升成零容忍的前置条件)。
 */
export function classifyFailureText(
  text: string | null | undefined,
  site: FailureFallbackSite = 'direct-call',
): { code: FailureCode; label: string } {
  const haystack = (text ?? '').toLowerCase();
  let out = FAILURE_TEXT_NO_MATCH;
  for (const rule of FAILURE_TEXT_RULES) {
    if (rule.needle !== undefined ? haystack.includes(rule.needle) : rule.pattern !== undefined && rule.pattern.test(haystack)) {
      out = rule;
      break;
    }
  }
  recordFallbackUse(site, out.code);
  return { code: out.code, label: out.label };
}

/**
 * 判定入口:**先读码,读不到才走被计数的文本档**。
 *
 * @param source ToolError / Error / `ToolResult` / ApiResult 失败分支 / 携带 code|errorType|errorCode|status 的任意对象;
 *                 传字符串按"无码"处理(文本里没有身份)。
 * @param site   使用点标签,决定计数落在哪一档。**必填**:让它有默认值,就等于允许调用点不署名,
 *                而"哪一处在读文本"正是这份台账唯一要回答的问题。
 */
export function resolveFailureCode(source: unknown, site: FailureFallbackSite): FailureResolution {
  const structured = structuredFailureCodeOf(source);
  if (structured !== undefined) {
    return { code: structured, via: 'structured', fallbackUsed: false, label: structured };
  }
  const { code, label } = classifyFailureText(textOf(source), site);
  return { code, via: 'text-fallback', fallbackUsed: true, label };
}

// ==================== 策略档(读码,不读文本) ====================

/**
 * 工具面可重试集合。与改前 `isRetryableErrorType` 的字面集合**逐字同形**(network/timeout/rate_limited)。
 * 刻意不含 `provider_unavailable` / `unknown`:把它们纳进来是行为变更,要另立一票逐处复核。
 */
export const RETRYABLE_FAILURE_CODES: readonly FailureCode[] = Object.freeze(['network', 'timeout', 'rate_limited']);

/** 致命档:与改前同集合(仅 permission)。`cancelled` 不是"致命",是"别自作主张地重来"。 */
export const FATAL_FAILURE_CODES: readonly FailureCode[] = Object.freeze(['permission']);

/**
 * 压缩面"瞬态"集合。与工具面**不同**是有意为之,不是漂移:
 * - 压缩调用没有任何副作用,重试的代价只是 tokens;所以 `unknown` 留在集合里(改前那句
 *   "默认瞬态(保守重试)"就是这条),`provider_unavailable` 也留(上游抖动 1s/2s/4s 退避正是为它写的)。
 * - `cancelled` 与 `permission` / `not_found` / `invalid_arguments` / `context_limit` 不在集合里:
 *   重试它们不会改变结论,只会把一次失败拖成三次。
 */
export const COMPACTION_TRANSIENT_FAILURE_CODES: readonly FailureCode[] = Object.freeze([
  'network',
  'timeout',
  'rate_limited',
  'provider_unavailable',
  'unknown',
]);

export function isRetryableFailureCode(code: FailureCode): boolean {
  return RETRYABLE_FAILURE_CODES.includes(code);
}

export function isFatalFailureCode(code: FailureCode): boolean {
  return FATAL_FAILURE_CODES.includes(code);
}

export function isTransientFailureCode(code: FailureCode): boolean {
  return COMPACTION_TRANSIENT_FAILURE_CODES.includes(code);
}

/**
 * 把一个面上来的字符串(既有的 `ToolResult.errorType`、别人的库的 tag)归一成闭集码。
 * 认不出返回 undefined —— 调用方因此知道"这里没有身份",而不是拿一个假的 `unknown` 当结论。
 */
export function failureCodeFromTag(value: unknown): FailureCode | undefined {
  return normalizeFailureCode(value);
}

// ==================== 前台 bash 终态映射(吸收 G-937951) ====================

/**
 * 被打断的终态闭集(与上游 ZCode `BashOutput.status` 的 `timed_out`/`cancelled` 同义)。
 * 归档唯一出口在 {@link mapTerminalState};消费方读结构化字段,不得从 `[超时]`
 * 一类输出文案反推 —— 那正是本文件立门要拦的"文本即契约"。
 */
export type ToolTerminalState = 'timed_out' | 'cancelled';

export interface TerminalStateMapping {
  readonly status: ToolTerminalState;
  /** 恒 true:该闭集只在"执行在完成前被打断"时产生,不存在干净的打断终态 */
  readonly interrupted: true;
  /** returnCodeInterpretation 等价物:给模型/日志的一句归因(ASCII,模型面字面量) */
  readonly interpretation: string;
}

/**
 * 终态映射的唯一出口。上游出处:`bash-output.ts` 的 `resolveBashCommandStatus`
 * (timedOut ⇒ timed_out,cancelled ⇒ cancelled)+ `bash-semantics.ts:105-106`
 * `interpretBashReturnCode` 的 "Command timed out"/"Command was cancelled" 两档,
 * 合体成这里的一个最小判据。两者都不是 ⇒ undefined(自然终态,不归这里管)。
 */
export function mapTerminalState(input: {
  timedOut?: boolean;
  cancelled?: boolean;
}): TerminalStateMapping | undefined {
  if (input.timedOut) {
    return { status: 'timed_out', interrupted: true, interpretation: 'Command timed out' };
  }
  if (input.cancelled) {
    return { status: 'cancelled', interrupted: true, interpretation: 'Command was cancelled' };
  }
  return undefined;
}

/**
 * 模型面 stderr 尾注(上游 `bash-model-content.ts:105-112` `formatStderrForModel`
 * 的 interrupted 档:`<error>Command was aborted before completion</error>`)。
 * 打断的现场不得被读成干净终态 —— 这一句就是"别假装完成"的模型可见形态。
 */
export const ABORTED_BEFORE_COMPLETION_NOTE = '<error>Command was aborted before completion</error>';
