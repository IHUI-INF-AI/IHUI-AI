/**
 * 上下文管理 — token 估算与历史压缩。
 *
 * 灵感来源:参考行业 Agent 框架的 agent runtime 上下文管理机制。
 * 策略:
 *   - token 估算:gpt-tokenizer(BPE 真实分词,精确匹配 GPT-4/Cl100k 编码)
 *   - 压缩策略:保留首条 system + 尾部最近 N 条,中段用摘要替代
 *   - 阈值触发:支持绝对值(maxTokens)和百分比(triggerRatio of contextLimit)两种模式
 *   - 百分比模式:达 triggerRatio(如 0.85)触发压缩,压缩到 targetRatio(如 0.6)留出空间
 */

import { encode } from 'gpt-tokenizer';
import { runHook } from './hooks/index.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

// ==================== P2-5 UsageLedger:chat-state token 估算 ====================

/** 单轮 token 使用记录(用于历史诊断与成本分析) */
export interface TurnUsage {
  /** 轮次序号(1-based) */
  turnNumber: number;
  /** 本轮 prompt tokens */
  promptTokens: number;
  /** 本轮 completion tokens */
  completionTokens: number;
  /** 本轮总 tokens(prompt + completion) */
  totalTokens: number;
  /** 本轮估算成本(美元) */
  estimatedCostUsd: number;
  /** 时间戳(ms) */
  timestamp: number;
}

/** chat-state 快照(供 UI 显示当前对话状态) */
export interface ChatState {
  /** 当前轮次数 */
  turnCount: number;
  /** 累计 prompt tokens */
  promptTokens: number;
  /** 累计 completion tokens */
  completionTokens: number;
  /** 累计总 tokens */
  totalTokens: number;
  /** 累计估算成本(美元) */
  estimatedCostUsd: number;
  /** 模型上下文窗口大小(tokens) */
  contextLimit: number;
  /** 当前上下文占用率(0-1) */
  usageRatio: number;
  /** 是否超出 token 预算 */
  isOverTokenBudget: boolean;
  /** 是否超出成本预算 */
  isOverCostBudget: boolean;
}

/**
 * UsageLedger — agent 运行期间的 token 使用账本。
 *
 * 灵感来源:参考行业 Agent 框架的 usage ledger / cost tracker 设计。
 * 简化策略(做减法):
 *   - 每轮 recordTurn 记录 prompt/completion tokens + cost
 *   - 累计 totals 可直接查询(promptTokens / completionTokens / totalTokens / costUsd)
 *   - 预算追踪:budgetTokens / budgetCostUsd 达阈值时 isOver*Budget 返回 true
 *   - getChatState 生成 UI 可消费的快照(轮次 + tokens + 成本 + 占用率)
 *   - history 导出完整轮次记录(供诊断/日志)
 *   - 零依赖:纯 TypeScript class,不引入外部库
 */
export class UsageLedger {
  private readonly turns: TurnUsage[] = [];
  private cumulativePromptTokens = 0;
  private cumulativeCompletionTokens = 0;
  private cumulativeCostUsd = 0;
  private readonly budgetTokens?: number;
  private readonly budgetCostUsd?: number;

  constructor(opts?: { budgetTokens?: number; budgetCostUsd?: number }) {
    this.budgetTokens = opts?.budgetTokens;
    this.budgetCostUsd = opts?.budgetCostUsd;
  }

  /** 记录一轮 token 使用(prompt + completion + cost) */
  recordTurn(promptTokens: number, completionTokens: number, estimatedCostUsd: number): void {
    const turnNumber = this.turns.length + 1;
    const entry: TurnUsage = {
      turnNumber,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd,
      timestamp: Date.now(),
    };
    this.turns.push(entry);
    this.cumulativePromptTokens += promptTokens;
    this.cumulativeCompletionTokens += completionTokens;
    this.cumulativeCostUsd += estimatedCostUsd;
  }

  /** 累计 prompt tokens */
  get promptTokens(): number { return this.cumulativePromptTokens; }

  /** 累计 completion tokens */
  get completionTokens(): number { return this.cumulativeCompletionTokens; }

  /** 累计总 tokens(prompt + completion) */
  get totalTokens(): number { return this.cumulativePromptTokens + this.cumulativeCompletionTokens; }

  /** 累计估算成本(美元) */
  get costUsd(): number { return this.cumulativeCostUsd; }

  /** 已记录的轮次数 */
  get turnCount(): number { return this.turns.length; }

  /** token 预算(未设置时 undefined) */
  get tokenBudget(): number | undefined { return this.budgetTokens; }

  /** 成本预算(未设置时 undefined) */
  get costBudget(): number | undefined { return this.budgetCostUsd; }

  /** 所有轮次记录(浅拷贝) */
  get history(): TurnUsage[] { return [...this.turns]; }

  /** 是否超出 token 预算(无预算时 false) */
  isOverTokenBudget(): boolean {
    return this.budgetTokens !== undefined && this.totalTokens >= this.budgetTokens;
  }

  /** 是否超出成本预算(无预算时 false) */
  isOverCostBudget(): boolean {
    return this.budgetCostUsd !== undefined && this.cumulativeCostUsd >= this.budgetCostUsd;
  }

  /** token 预算使用率(0-1,无预算时 undefined) */
  tokenBudgetUsage(): number | undefined {
    if (this.budgetTokens === undefined) return undefined;
    return this.budgetTokens > 0 ? this.totalTokens / this.budgetTokens : 0;
  }

  /** 成本预算使用率(0-1,无预算时 undefined) */
  costBudgetUsage(): number | undefined {
    if (this.budgetCostUsd === undefined) return undefined;
    return this.budgetCostUsd > 0 ? this.cumulativeCostUsd / this.budgetCostUsd : 0;
  }

  /** 平均每轮 token 数 */
  averageTokensPerTurn(): number {
    if (this.turns.length === 0) return 0;
    return this.totalTokens / this.turns.length;
  }

  /** 最近一轮记录(无记录时 undefined) */
  lastTurn(): TurnUsage | undefined {
    return this.turns.length > 0 ? this.turns[this.turns.length - 1] : undefined;
  }

  /**
   * 生成 chat-state 快照(供 UI 显示当前对话状态)。
   * @param contextLimit 模型上下文窗口大小(tokens)
   */
  getChatState(contextLimit: number): ChatState {
    return {
      turnCount: this.turnCount,
      promptTokens: this.cumulativePromptTokens,
      completionTokens: this.cumulativeCompletionTokens,
      totalTokens: this.totalTokens,
      estimatedCostUsd: this.cumulativeCostUsd,
      contextLimit,
      usageRatio: contextLimit > 0 ? this.totalTokens / contextLimit : 0,
      isOverTokenBudget: this.isOverTokenBudget(),
      isOverCostBudget: this.isOverCostBudget(),
    };
  }

  /** 重置账本(清空所有记录) */
  reset(): void {
    this.turns.length = 0;
    this.cumulativePromptTokens = 0;
    this.cumulativeCompletionTokens = 0;
    this.cumulativeCostUsd = 0;
  }
}

export interface CompressionResult {
  messages: ChatMessage[];
  compressed: boolean;
  originalTokens: number;
  compressedTokens: number;
  removedCount: number;
  /** 触发原因(百分比模式才有值) */
  trigger?: 'ratio' | 'absolute' | 'none';
  /** 当前 token 占用率(percentage of contextLimit,百分比模式才有值) */
  usageRatio?: number;
}

export interface CompressionOptions {
  maxTokens?: number;
  keepRecent?: number;
}

const DEFAULT_MAX_TOKENS = 24_000;
const DEFAULT_KEEP_RECENT = 6;

// ==================== 结构化摘要(替代 slice(0,200) 粗暴截断)====================

const TOOL_CALL_REGEX = /```tool_call\s*\n([\s\S]*?)```/g;
const TOOL_RESULT_REGEX = /\[工具结果\s*[✓✗]\]\s*(\S+)/g;
const CODE_BLOCK_REGEX = /```(\w+)?/g;
const MAX_SUMMARY_LEN = 160;

/**
 * 从单条消息内容提取结构化关键信息(智能摘要)。
 *
 * 替代 `msg.content.slice(0, 200)` 的粗暴截断,提取:
 *   - assistant:tool_call 名称列表 + 首句决策 + 代码块语言标识
 *   - user:tool_result 状态(✓/✗)+ 工具名 + 首句
 *   - 其他:首句
 *
 * 每条摘要最多 MAX_SUMMARY_LEN 字符,信息密度高于 slice(0,200)。
 */
export function summarizeMessage(msg: ChatMessage): string {
  const role = msg.role;
  const content = msg.content;
  if (!content) return `[${role}] (空)`;

  const parts: string[] = [`[${role}]`];

  // 提取 tool_call 名称(assistant 调用了哪些工具)
  if (role === 'assistant') {
    const toolNames: string[] = [];
    let m: RegExpExecArray | null;
    TOOL_CALL_REGEX.lastIndex = 0;
    while ((m = TOOL_CALL_REGEX.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(m[1]!.trim());
        if (parsed && typeof parsed.name === 'string') toolNames.push(parsed.name);
      } catch {
        // 忽略解析失败
      }
    }
    if (toolNames.length > 0) {
      parts.push(`工具调用: ${toolNames.join(', ')}`);
    }
  }

  // 提取 tool_result 状态(user 消息中嵌入的工具结果)
  if (role === 'user') {
    const results: string[] = [];
    let m: RegExpExecArray | null;
    TOOL_RESULT_REGEX.lastIndex = 0;
    while ((m = TOOL_RESULT_REGEX.exec(content)) !== null) {
      results.push(m[1]!);
    }
    if (results.length > 0) {
      parts.push(`工具结果: ${results.join(', ')}`);
    }
  }

  // 提取代码块语言标识(assistant 写了什么语言的代码)
  if (role === 'assistant') {
    const langs: string[] = [];
    let m: RegExpExecArray | null;
    CODE_BLOCK_REGEX.lastIndex = 0;
    while ((m = CODE_BLOCK_REGEX.exec(content)) !== null) {
      const lang = m[1];
      if (lang && !langs.includes(lang)) langs.push(lang);
    }
    if (langs.length > 0) {
      parts.push(`代码块: ${langs.join(', ')}`);
    }
  }

  // 提取首句(去掉 markdown 标记后的第一个句子)
  const firstSentence = content
    .replace(/```[\s\S]*?```/g, ' ') // 移除代码块
    .replace(/[#*`>_~]/g, ' ')        // 移除 markdown 标记
    .replace(/\s+/g, ' ')
    .trim()
    .split(/[。.!!\n?]/)[0] ?? '';
  if (firstSentence) {
    parts.push(firstSentence.slice(0, 80));
  }

  let summary = parts.join(' ');
  if (summary.length > MAX_SUMMARY_LEN) {
    summary = summary.slice(0, MAX_SUMMARY_LEN - 3) + '...';
  }
  return summary;
}

/** 批量生成结构化摘要(用于 compressContext / compressContextIfNeeded) */
export function buildStructuredSummary(messages: ChatMessage[]): string {
  return messages.map(summarizeMessage).join('\n');
}

export function compressContext(
  messages: ChatMessage[],
  opts: CompressionOptions = {},
): CompressionResult {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT;
  const originalTokens = estimateMessagesTokens(messages);

  if (originalTokens <= maxTokens || messages.length <= keepRecent + 1) {
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
    };
  }

  const systemMsgs = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');
  const keepCount = Math.min(keepRecent, nonSystem.length);
  const toCompress = nonSystem.slice(0, nonSystem.length - keepCount);
  const toKeep = nonSystem.slice(nonSystem.length - keepCount);

  const summaryParts: string[] = [];
  for (const msg of toCompress) {
    summaryParts.push(summarizeMessage(msg));
  }

  const summaryMsg: ChatMessage = {
    role: 'user',
    content: `[上下文摘要 — 之前 ${toCompress.length} 条消息已压缩]\n${summaryParts.join('\n')}`,
  };

  const result = [...systemMsgs, summaryMsg, ...toKeep];
  const compressedTokens = estimateMessagesTokens(result);

  return {
    messages: result,
    compressed: true,
    originalTokens,
    compressedTokens,
    removedCount: toCompress.length,
    trigger: 'absolute',
  };
}

// ==================== 百分比阈值自动压缩 ====================

export interface RatioCompressionOptions {
  /** 模型上下文窗口大小(tokens,如 8000 / 32000 / 128000) */
  contextLimit: number;
  /** 触发压缩的占用率(0-1,默认 0.85 = 85%) */
  triggerRatio?: number;
  /** 压缩后的目标占用率(0-1,默认 0.6 = 60%,留出空间继续对话) */
  targetRatio?: number;
  /** 保留最近 N 条消息(默认 6) */
  keepRecent?: number;
  /** 最少消息数(消息数不足时不压缩,默认 keepRecent + 1) */
  minMessages?: number;
  /** 工作区路径(透传给 preCompact/postCompact hook 上下文) */
  workspacePath?: string;
  /** 会话 ID(透传给 preCompact/postCompact hook 上下文) */
  sessionId?: string;
}

const DEFAULT_TRIGGER_RATIO = 0.85;
const DEFAULT_TARGET_RATIO = 0.6;

/**
 * 百分比阈值自动压缩 — 当 token 占用率达到 triggerRatio 时自动压缩到 targetRatio。
 *
 * 与 compressContext 的区别:
 *   - compressContext 用绝对 maxTokens 阈值(固定 24000)
 *   - compressContextIfNeeded 用百分比阈值(动态适配不同模型的 contextLimit)
 *
 * 行为:
 *   - tokens / contextLimit < triggerRatio → 不压缩,返回原 messages
 *   - tokens / contextLimit >= triggerRatio → 压缩,目标压缩到 targetRatio * contextLimit 以下
 *   - 通过逐步增加 keepRecent 的压缩量,找到第一个使 compressedTokens < targetRatio * contextLimit 的方案
 *
 * @returns CompressionResult(含 trigger: 'ratio'|'none' 和 usageRatio)
 */
export function compressContextIfNeeded(
  messages: ChatMessage[],
  opts: RatioCompressionOptions,
): CompressionResult {
  const contextLimit = opts.contextLimit;
  const triggerRatio = opts.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
  const targetRatio = opts.targetRatio ?? DEFAULT_TARGET_RATIO;
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT;
  const minMessages = opts.minMessages ?? keepRecent + 1;
  const triggerThreshold = Math.floor(contextLimit * triggerRatio);
  const targetThreshold = Math.floor(contextLimit * targetRatio);

  const originalTokens = estimateMessagesTokens(messages);
  const usageRatio = originalTokens / contextLimit;

  // 未达触发阈值,不压缩
  if (originalTokens < triggerThreshold || messages.length <= minMessages) {
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
      usageRatio,
    };
  }

  runHook('preCompact', {
    workspacePath: opts.workspacePath,
    sessionId: opts.sessionId,
    compactedTokensBefore: originalTokens,
  });

  const systemMsgs = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  // 逐步减少 keepRecent,直到 compressedTokens < targetThreshold 或 keepRecent=1
  let bestResult: CompressionResult | null = null;
  for (let kr = Math.min(keepRecent, nonSystem.length - 1); kr >= 1; kr--) {
    if (nonSystem.length <= kr) continue;
    const toCompress = nonSystem.slice(0, nonSystem.length - kr);
    const toKeep = nonSystem.slice(nonSystem.length - kr);

    const summaryParts: string[] = [];
    for (const msg of toCompress) {
      summaryParts.push(summarizeMessage(msg));
    }
    const summaryMsg: ChatMessage = {
      role: 'user',
      content: `[上下文摘要 — 之前 ${toCompress.length} 条消息已压缩]\n${summaryParts.join('\n')}`,
    };
    const candidate = [...systemMsgs, summaryMsg, ...toKeep];
    const candidateTokens = estimateMessagesTokens(candidate);

    if (candidateTokens <= targetThreshold) {
      bestResult = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        trigger: 'ratio',
        usageRatio,
      };
      break;
    }
    // 记录最后一个候选(即使超过 target,也比不压缩好)
    if (!bestResult) {
      bestResult = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        trigger: 'ratio',
        usageRatio,
      };
    }
  }

  // bestResult 一定不为 null(因为 nonSystem.length > minMessages >= 2,至少有 1 条可压缩)
  const result = bestResult ?? {
    messages,
    compressed: false,
    originalTokens,
    compressedTokens: originalTokens,
    removedCount: 0,
    trigger: 'none' as const,
    usageRatio,
  };
  runHook('postCompact', {
    workspacePath: opts.workspacePath,
    sessionId: opts.sessionId,
    compactedTokensBefore: originalTokens,
    compactedTokensAfter: result.compressedTokens,
  });
  return result;
}

