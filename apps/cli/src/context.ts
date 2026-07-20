/**
 * 上下文管理 — token 估算与历史压缩。
 *
 * 灵感来源:参考行业 Agent 框架的 agent runtime 上下文管理机制。
 * 策略:
 *   - token 估算:gpt-tokenizer(BPE 真实分词,精确匹配 GPT-4/Cl100k 编码)
 *   - 压缩策略:保留首条 system + 尾部最近 N 条,中段用摘要替代
 *   - 阈值触发:支持绝对值(maxTokens)和百分比(triggerRatio of contextLimit)两种模式
 *   - 百分比模式:达 triggerRatio(默认 0.88 = 88%,跨端统一)触发压缩,压缩到 targetRatio(0.6)留出空间
 *
 * 跨端共享:压缩核心逻辑提取到 @ihui/context-compaction,CLI/Web/API/ai-service 共用同一套规则。
 * 本文件保留 UsageLedger + 压缩函数的 CLI 包装器(桥接 preCompact/postCompact hooks)。
 */

// 共享包 re-export(跨端统一常量 + 纯函数)
export {
  estimateTokens,
  estimateMessagesTokens,
  summarizeMessage,
  buildStructuredSummary,
  compressContext,
  type ChatMessage,
  type CompressionResult,
  type CompressionOptions,
  type RatioCompressionOptions,
  type CompactionHooks,
  DEFAULT_TRIGGER_RATIO,
  DEFAULT_TARGET_RATIO,
  DEFAULT_KEEP_RECENT,
  DEFAULT_MAX_TOKENS,
  CONTEXT_BUDGET_THRESHOLD,
} from '@ihui/context-compaction'

import {
  compressContextIfNeeded as _compressContextIfNeeded,
  type ChatMessage,
  type RatioCompressionOptions,
  type CompressionResult,
  type CompactionHooks,
} from '@ihui/context-compaction'
import { runHook } from './hooks/index.js'

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

// ==================== CLI 压缩包装器(桥接 preCompact/postCompact hooks) ====================
//
// 共享包 @ihui/context-compaction 提供纯函数版 compressContextIfNeeded(无副作用,API/Web 直接用)。
// CLI 端需要触发用户自定义 hooks(preCompact/postCompact,用于通知外部服务或执行本地命令),
// 因此用本包装器把 runHook 桥接为 CompactionHooks 回调。
//
// 阈值由共享包统一为 0.88(88%),跨端一致。

/** CLI 专用压缩选项(扩展共享包 RatioCompressionOptions,增加 workspacePath/sessionId 用于 hook 透传) */
export interface CLICompressionOptions extends RatioCompressionOptions {
  /** 工作区路径(透传给 preCompact/postCompact hook 上下文) */
  workspacePath?: string;
  /** 会话 ID(透传给 preCompact/postCompact hook 上下文) */
  sessionId?: string;
}

/**
 * CLI 百分比阈值自动压缩 — 桥接 preCompact/postCompact hooks。
 *
 * 行为与共享包 compressContextIfNeeded 完全一致(88% 触发,压缩到 60%),
 * 额外在压缩前后触发 runHook('preCompact'/'postCompact')。
 */
export function compressContextIfNeeded(
  messages: ChatMessage[],
  opts: CLICompressionOptions,
): CompressionResult {
  const hooks: CompactionHooks = {
    preCompact: ({ compactedTokensBefore }) => {
      runHook('preCompact', {
        workspacePath: opts.workspacePath,
        sessionId: opts.sessionId,
        compactedTokensBefore,
      });
    },
    postCompact: ({ compactedTokensBefore, compactedTokensAfter }) => {
      runHook('postCompact', {
        workspacePath: opts.workspacePath,
        sessionId: opts.sessionId,
        compactedTokensBefore,
        compactedTokensAfter,
      });
    },
  };
  return _compressContextIfNeeded(messages, opts, hooks);
}

