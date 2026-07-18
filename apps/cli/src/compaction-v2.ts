/**
 * Compaction V2 — 参考行业 Agent 框架上下文压缩设计理念的压缩模块。
 *
 * 平台独占:CLI 专用(不影响 API / Web / 其他端)。
 *
 * 核心策略(做减法,不引入新依赖,不扩展 ChatMessage 类型):
 *   - selectTurnsToCompact:反向遍历找 split point,tool-pair safe boundary 对齐
 *   - shouldCompact:百分比阈值触发(默认 0.85)
 *   - isDegenerateSummary:退化摘要检测(默认 < 500 字符视为退化)
 *   - reductionGuard:压缩后 token > before * 0.8 则拒绝
 *   - sampleWithRetry:瞬态错误重试(指数退避 1s/2s/4s),确定性错误不重试
 *   - CompactionSampler:host 注入的 LLM 调用接口
 *   - compressContextV2:主入口,失败时 fallback 到现有 compressContextIfNeeded
 *
 * 复用 context.ts 的 estimateTokens / estimateMessagesTokens / compressContextIfNeeded(只读 import,不修改)。
 */

import {
  estimateTokens,
  estimateMessagesTokens,
  compressContextIfNeeded,
  type ChatMessage,
  type CompressionResult,
} from './context.js';

// ==================== 类型定义 ====================

export type CompactionTrigger = 'ratio' | 'absolute' | 'none';
export type ReductionResult = 'accepted' | 'rejected' | 'fallback';

/** host 注入的 LLM 调用 callback(无则 fallback 到 compressContextIfNeeded) */
export interface CompactionSampler {
  sampleCompaction(
    messages: ChatMessage[],
    opts: { timeoutMs: number },
  ): Promise<{ response: string; thinking?: string }>;
}

/** 观察者回调(用于埋点 / 日志,可选) */
export interface CompactionObserver {
  onSuccess(opts: {
    target: string;
    tokensBefore: number;
    tokensAfter: number;
    turnsCompacted: number;
    elapsedMs: number;
  }): void;
  onError(opts: { target: string; statusLabel: string; error?: Error }): void;
}

export interface CompactionV2Options {
  /** 模型上下文窗口大小(tokens) */
  contextLimit: number;
  /** 触发压缩的占用率(0-1,默认 0.85) */
  triggerRatio?: number;
  /** 压缩后的目标占用率(0-1,默认 0.6) */
  targetRatio?: number;
  /** 尾部保留的 non-system 消息数(默认 6) */
  keepRecent?: number;
  /** 低于此消息数不压缩(默认 10) */
  minMessages?: number;
  /** 可压缩部分少于阈值不压(默认 1000 tokens) */
  minCompactableTokens?: number;
  /** 压完 token > before * ratio 则拒绝(默认 0.8) */
  maxReductionRatio?: number;
  /** 摘要 < 此长度视为退化(默认 500 字符) */
  minSummarySeedChars?: number;
  /** LLM 调用最大重试次数(默认 3) */
  maxAttempts?: number;
  /** 瞬态错误重试间隔(默认 1000ms,指数退避 1s/2s/4s) */
  retryDelayMs?: number;
  /** LLM 调用超时(默认 30000ms) */
  samplingTimeoutMs?: number;
  /** 可选 sampler,无则 fallback */
  sampler?: CompactionSampler;
  /** 可选观察者 */
  observer?: CompactionObserver;
  /** 透传给 fallback 的 compressContextIfNeeded */
  workspacePath?: string;
  sessionId?: string;
}

export interface SelectTurnsResult {
  headToCompact: ChatMessage[];
  tailToKeep: ChatMessage[];
  splitIndex: number;
}

// ==================== 常量与默认值 ====================

const DEFAULT_TRIGGER_RATIO = 0.85;
const DEFAULT_TARGET_RATIO = 0.6;
const DEFAULT_KEEP_RECENT = 6;
const DEFAULT_MIN_MESSAGES = 10;
const DEFAULT_MIN_COMPACTABLE_TOKENS = 1000;
const DEFAULT_MAX_REDUCTION_RATIO = 0.8;
const DEFAULT_MIN_SUMMARY_SEED_CHARS = 500;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_SAMPLING_TIMEOUT_MS = 30_000;

/** 识别 user 消息中嵌入的 tool 结果标记(IHUI-AI 约定) */
const TOOL_RESULT_MARKER_REGEX = /\[工具结果\s*[✓✗]\]/;

// ==================== 辅助纯函数 ====================

/** 判断消息是否为 tool 结果(IHUI-AI 中嵌入 user content) */
function isToolResultMessage(msg: ChatMessage): boolean {
  return msg.role === 'user' && TOOL_RESULT_MARKER_REGEX.test(msg.content);
}

/**
 * snapToSafeBoundary — 若 split point 落在 tool 结果上,前移到该 tool-pair run 结束。
 * 确保尾部不从 tool 结果开始(避免 orphaned tool result,其 tool_call 已被压缩)。
 */
function snapToSafeBoundary(messages: ChatMessage[], splitIndex: number): number {
  let idx = splitIndex;
  while (idx < messages.length && isToolResultMessage(messages[idx]!)) {
    idx++;
  }
  return idx;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 错误分类:瞬态(可重试)vs 确定性(不重试) */
function classifyError(err: Error): { transient: boolean; label: string } {
  const msg = err.message.toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { transient: true, label: 'timeout' };
  }
  if (
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up')
  ) {
    return { transient: true, label: 'network' };
  }
  if (/\b5\d{2}\b/.test(msg) || msg.includes('server error') || msg.includes('bad gateway') || msg.includes('service unavailable')) {
    return { transient: true, label: '5xx' };
  }
  if (/\b4\d{2}\b/.test(msg) || msg.includes('bad request') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('not found')) {
    return { transient: false, label: '4xx' };
  }
  if (msg.includes('parse') || msg.includes('json') || msg.includes('invalid response')) {
    return { transient: false, label: 'parse' };
  }
  // 默认瞬态(保守重试)
  return { transient: true, label: 'unknown' };
}

// ==================== 核心函数 ====================

/**
 * selectTurnsToCompact — 参考行业 Agent 框架的 select turns 实现。
 * 反向遍历找 split point,使尾部 token 总和 ≤ targetTokens 且至少保留 keepRecent 条。
 * split point 落在 tool 结果上时前移到该 tool-pair run 结束(snapToSafeBoundary)。
 */
export function selectTurnsToCompact(
  messages: ChatMessage[],
  targetTokens: number,
  opts: { keepRecent?: number } = {},
): SelectTurnsResult {
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT;

  // 找到 system 段终点(连续 system 消息后第一条 non-system)
  let systemEnd = 0;
  while (systemEnd < messages.length && messages[systemEnd]!.role === 'system') {
    systemEnd++;
  }

  // 只有 system 消息:全部保留,不压缩
  if (systemEnd >= messages.length) {
    return { headToCompact: [], tailToKeep: messages, splitIndex: 0 };
  }

  const nonSystemLen = messages.length - systemEnd;
  let tailTokens = 0;
  let tailStartInNonSystem = nonSystemLen; // 默认全部压缩
  const minTailStart = Math.max(0, nonSystemLen - keepRecent);

  // 反向遍历:先强制保留 keepRecent 条,再按 token 预算决定
  for (let i = nonSystemLen - 1; i >= 0; i--) {
    const msg = messages[systemEnd + i]!;
    const msgTokens = estimateTokens(msg.content) + 4;
    if (i >= minTailStart) {
      // 强制保留尾部 keepRecent 条
      tailTokens += msgTokens;
      tailStartInNonSystem = i;
      continue;
    }
    // 超出 keepRecent 后,按 token 预算决定
    if (tailTokens + msgTokens > targetTokens) {
      break;
    }
    tailTokens += msgTokens;
    tailStartInNonSystem = i;
  }

  // 转换回原数组索引
  let splitIndex = systemEnd + tailStartInNonSystem;
  // snap to safe boundary(避免尾部从 tool 结果开始)
  splitIndex = snapToSafeBoundary(messages, splitIndex);

  return {
    headToCompact: messages.slice(0, splitIndex),
    tailToKeep: messages.slice(splitIndex),
    splitIndex,
  };
}

/**
 * shouldCompact — 参考行业 Agent 框架的 trigger 实现。
 * lastPromptTokens / contextLimit > triggerRatio(默认 0.85)→ 触发。
 */
export function shouldCompact(
  lastPromptTokens: number,
  contextLimit: number,
  _currentStep?: number,
  opts: { triggerRatio?: number } = {},
): { shouldCompact: boolean; trigger: CompactionTrigger; percent: number } {
  const triggerRatio = opts.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
  if (contextLimit <= 0) {
    return { shouldCompact: false, trigger: 'none', percent: 0 };
  }
  const percent = lastPromptTokens / contextLimit;
  if (percent > triggerRatio) {
    return { shouldCompact: true, trigger: 'ratio', percent };
  }
  return { shouldCompact: false, trigger: 'none', percent };
}

/** isDegenerateSummary — 摘要 trim 后长度 < minSummarySeedChars(默认 500)视为退化 */
export function isDegenerateSummary(summary: string, minSeedChars?: number): boolean {
  const threshold = minSeedChars ?? DEFAULT_MIN_SUMMARY_SEED_CHARS;
  return summary.trim().length < threshold;
}

/** formatCompactSummary — 清理 <analysis>/<summary>/<thinking> 等控制标签,归一化 whitespace */
export function formatCompactSummary(rawSummary: string): string {
  return rawSummary
    .replace(/<\/?(?:analysis|summary|thinking|reflect|reasoning|scratchpad)[\s\S]*?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** reductionGuard — tokensAfter > tokensBefore * maxReductionRatio(默认 0.8)则拒绝 */
export function reductionGuard(
  tokensBefore: number,
  tokensAfter: number,
  maxReductionRatio?: number,
): { accepted: boolean; ratio: number } {
  const ratio = maxReductionRatio ?? DEFAULT_MAX_REDUCTION_RATIO;
  if (tokensBefore <= 0) {
    return { accepted: true, ratio: 0 };
  }
  const afterRatio = tokensAfter / tokensBefore;
  return { accepted: afterRatio <= ratio, ratio: afterRatio };
}

/**
 * sampleWithRetry — 参考行业 Agent 框架的 sampler 实现。
 * 瞬态错误(Timeout/网络/5xx)→ 重试;确定性错误(4xx/解析错误)→ 不重试。
 * 指数退避:1s/2s/4s。最多 maxAttempts 次。
 */
export async function sampleWithRetry(
  messages: ChatMessage[],
  sampler: CompactionSampler,
  opts: { maxAttempts?: number; retryDelayMs?: number; samplingTimeoutMs?: number },
): Promise<{ response: string; attempts: number; statusLabel: string }> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const samplingTimeoutMs = opts.samplingTimeoutMs ?? DEFAULT_SAMPLING_TIMEOUT_MS;

  let lastError: Error | null = null;
  let lastLabel = 'unknown';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await sampler.sampleCompaction(messages, { timeoutMs: samplingTimeoutMs });
      return { response: result.response, attempts: attempt, statusLabel: 'ok' };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const classification = classifyError(lastError);
      lastLabel = classification.label;
      if (!classification.transient) {
        throw new Error(`[${classification.label}] ${lastError.message}`);
      }
      if (attempt < maxAttempts) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        await sleep(delay);
      }
    }
  }
  throw new Error(`[transient-exhausted:${lastLabel}] ${maxAttempts} attempts failed: ${lastError?.message ?? 'unknown'}`);
}

// ==================== 主入口 ====================

/** fallback 到现有 compressContextIfNeeded(只读复用 context.ts) */
function fallbackToV1(messages: ChatMessage[], opts: CompactionV2Options): CompressionResult {
  return compressContextIfNeeded(messages, {
    contextLimit: opts.contextLimit,
    triggerRatio: opts.triggerRatio,
    targetRatio: opts.targetRatio,
    keepRecent: opts.keepRecent,
    minMessages: opts.minMessages,
    workspacePath: opts.workspacePath,
    sessionId: opts.sessionId,
  });
}

/**
 * compressContextV2 — 主入口。
 * 流程:shouldCompact → selectTurnsToCompact → sampler → isDegenerateSummary →
 *       formatCompactSummary → reductionGuard,任一步失败 fallback 到 compressContextIfNeeded。
 */
export async function compressContextV2(
  messages: ChatMessage[],
  opts: CompactionV2Options,
): Promise<CompressionResult> {
  const contextLimit = opts.contextLimit;
  const triggerRatio = opts.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
  const targetRatio = opts.targetRatio ?? DEFAULT_TARGET_RATIO;
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT;
  const minMessages = opts.minMessages ?? DEFAULT_MIN_MESSAGES;
  const minCompactableTokens = opts.minCompactableTokens ?? DEFAULT_MIN_COMPACTABLE_TOKENS;
  const maxReductionRatio = opts.maxReductionRatio ?? DEFAULT_MAX_REDUCTION_RATIO;
  const minSummarySeedChars = opts.minSummarySeedChars ?? DEFAULT_MIN_SUMMARY_SEED_CHARS;
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const samplingTimeoutMs = opts.samplingTimeoutMs ?? DEFAULT_SAMPLING_TIMEOUT_MS;

  const originalTokens = estimateMessagesTokens(messages);

  // 1. 检查触发条件
  const trigger = shouldCompact(originalTokens, contextLimit, undefined, { triggerRatio });
  if (!trigger.shouldCompact) {
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
      usageRatio: contextLimit > 0 ? originalTokens / contextLimit : 0,
    };
  }

  // 2. 消息数过少 → fallback
  if (messages.length < minMessages) {
    return fallbackToV1(messages, opts);
  }

  // 3. sampler 未提供 → fallback
  if (!opts.sampler) {
    return fallbackToV1(messages, opts);
  }

  // 4. 分割 head/tail
  const targetTokens = Math.floor(contextLimit * targetRatio);
  const { headToCompact, tailToKeep } = selectTurnsToCompact(messages, targetTokens, { keepRecent });

  // 5. head 过小 → fallback
  const headNonSystem = headToCompact.filter((m) => m.role !== 'system');
  const headTokens = estimateMessagesTokens(headNonSystem);
  if (headNonSystem.length < minMessages || headTokens < minCompactableTokens) {
    return fallbackToV1(messages, opts);
  }

  const startTime = Date.now();

  // 6. 调用 sampler(带重试)
  let sampleResult: { response: string; attempts: number; statusLabel: string };
  try {
    sampleResult = await sampleWithRetry(headNonSystem, opts.sampler, {
      maxAttempts,
      retryDelayMs,
      samplingTimeoutMs,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    opts.observer?.onError({ target: 'compaction-v2', statusLabel: 'sampler-failed', error });
    return fallbackToV1(messages, opts);
  }

  // 7. 退化检测
  if (isDegenerateSummary(sampleResult.response, minSummarySeedChars)) {
    opts.observer?.onError({ target: 'compaction-v2', statusLabel: 'degenerate-summary' });
    return fallbackToV1(messages, opts);
  }

  // 8. 清理控制标签
  const cleaned = formatCompactSummary(sampleResult.response);

  // 9. 拼装 [systemMsgs, summaryMsg, ...tail(non-system)]
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const tailNonSystem = tailToKeep.filter((m) => m.role !== 'system');
  const summaryMsg: ChatMessage = {
    role: 'user',
    content: `[上下文摘要 — 之前 ${headNonSystem.length} 条消息已压缩]\n${cleaned}`,
  };
  const result = [...systemMsgs, summaryMsg, ...tailNonSystem];
  const compressedTokens = estimateMessagesTokens(result);

  // 10. reduction guard
  const guard = reductionGuard(originalTokens, compressedTokens, maxReductionRatio);
  if (!guard.accepted) {
    opts.observer?.onError({ target: 'compaction-v2', statusLabel: 'reduction-rejected' });
    return fallbackToV1(messages, opts);
  }

  // 11. 成功
  const elapsedMs = Date.now() - startTime;
  opts.observer?.onSuccess({
    target: 'compaction-v2',
    tokensBefore: originalTokens,
    tokensAfter: compressedTokens,
    turnsCompacted: headNonSystem.length,
    elapsedMs,
  });

  return {
    messages: result,
    compressed: true,
    originalTokens,
    compressedTokens,
    removedCount: headNonSystem.length,
    trigger: trigger.trigger,
    usageRatio: contextLimit > 0 ? originalTokens / contextLimit : 0,
  };
}
