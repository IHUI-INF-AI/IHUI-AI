// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上下文有效性守卫的运行期装配(三道守卫接入主循环的那一层)。
 *
 * 被守卫的实现在 `@ihui/context-compaction`(纯函数 + 熔断器类),本文件只负责
 * **"装车"**:把 provider usage、轮次序号、空闲时间戳这三样只有调用方才有的
 * 运行时事实喂进去,并把结论翻成主循环能用的动作(压 / 不压 / 停下来喊人)。
 *
 * 为什么单独成文件而不是写进 agent.ts:
 *   `commands/agent.ts` 已 1900 行且是本仓单文件行数守门的存量重灾区,
 *   守卫的运行期状态机(熔断 latch / 真值复测缓存)是独立职责,放这里可单测。
 *
 * 三道守卫各自的动作边界:
 *   1. `reverifyContextAfterCompaction` —— 压缩**后**用 provider 真值复测,
 *      不把"摘要生成成功"当"压缩成功";真值只在上一轮请求可得上报时才有,
 *      拿不到就退回估算并如实标 source='estimate'。
 *   2. `RefillBreaker` —— 连续快速回填即 latch,此后本循环**不再自动压缩**,
 *      并把面向用户的诊断抛出去(继续压只会烧钱 + 把有用历史压光)。
 *   3. `retryAfterOverflowDrop` —— 连摘要请求都被 prompt-too-long 拒时,
 *      按完整 round 边界整组丢弃最老轮次后重试,上限由共享包常量给(6)。
 */

import {
  RefillBreaker,
  reverifyContextAfterCompaction,
  retryAfterOverflowDrop,
  findOrphanToolMessages,
  type ChatMessage,
  type CompressionResult,
  type ProviderUsage,
  type ReverifiedContext,
} from './context.js';
// OverflowDropResult 未被 context.ts 的 re-export 面覆盖,直接从共享包取类型(纯类型,无运行期依赖)
import type { OverflowDropResult } from '@ihui/context-compaction';

/** 压缩动作注入点(测试可换成假实现;生产传 decideCompaction 的部分应用) */
export type CompactAction = (
  messages: ChatMessage[],
  ctx: { turnIndex: number; lastActivityAtMs?: number },
) => Promise<CompressionResult>;

export interface ContextGuardsOptions {
  /** 模型上下文窗口(tokens) */
  contextLimit: number;
  /** 触发/目标占用率(与跨端统一常量一致,测试可覆盖) */
  triggerRatio?: number;
  targetRatio?: number;
  /** 判定时钟(默认 Date.now()) */
  now?: () => number;
  /** 复用已有熔断器(会话恢复时把上一次的 latch 带回来) */
  breaker?: RefillBreaker;
  /** 已熔断则直接沿用挂起态 */
  initiallySuspended?: boolean;
}

export interface GuardedCompaction {
  /** 本轮真正用于请求的消息列表(挂起时 === 入参) */
  messages: ChatMessage[];
  /** 是否真的发生了压缩(熔断器只在这种事件上计数) */
  compressed: boolean;
  /** 因熔断挂起而跳过自动压缩 */
  suspended: boolean;
  /** 压缩结果里的 token 观测值(未压缩为 null) */
  reverified: ReverifiedContext | null;
  /** 面向用户的诊断文案(只在**首次**熔断那一轮非空,不重复刷屏) */
  userDiagnostic: string | null;
  /** 熔断器当前连续计数(诊断/日志用) */
  consecutiveQuickRefills: number;
  /** 原始压缩结果(取 compressedTokens 做真值复测的估算基准;挂起/未压为 null) */
  compression: CompressionResult | null;
}

/**
 * 运行期守卫装配。实例与一次 runToolLoop 同生命周期。
 */
export class ContextGuards {
  private readonly breaker: RefillBreaker;
  private readonly now: () => number;
  private readonly contextLimit: number;
  private readonly triggerRatio: number | undefined;
  private readonly targetRatio: number | undefined;
  private _suspended: boolean;
  private _diagnosticEmitted: boolean;
  private _lastActivityAtMs: number;
  private _providerUsage: ProviderUsage | null = null;
  private _lastReverified: ReverifiedContext | null = null;
  /** 上一轮是否发生了压缩:只有它成立时,本轮 usage 才是"压缩后的真值" */
  private _pendingVerify = false;

  constructor(opts: ContextGuardsOptions) {
    this.contextLimit = opts.contextLimit;
    this.triggerRatio = opts.triggerRatio;
    this.targetRatio = opts.targetRatio;
    this.now = opts.now ?? (() => Date.now());
    this.breaker = opts.breaker ?? new RefillBreaker();
    this._suspended = opts.initiallySuspended === true || this.breaker.tripped;
    this._diagnosticEmitted = false;
    this._lastActivityAtMs = this.now();
  }

  get isSuspended(): boolean {
    return this._suspended;
  }

  get lastActivityAtMs(): number {
    return this._lastActivityAtMs;
  }

  /** 会话有任何真实进展(新结果进 messages / 用户新输入)时调用,重置空闲计时 */
  touchActivity(): void {
    this._lastActivityAtMs = this.now();
  }

  /** provider 回来的 usage(可得处喂真值复测;不可得传 null) */
  recordProviderUsage(usage: ProviderUsage | null): void {
    if (usage && typeof usage === 'object') this._providerUsage = usage;
  }

  get providerUsageAvailable(): boolean {
    return this._providerUsage !== null;
  }

  get lastReverified(): ReverifiedContext | null {
    return this._lastReverified;
  }

  get consecutiveQuickRefills(): number {
    return this.breaker.consecutiveQuickRefills;
  }

  /** 熔断诊断(未熔断为 null) */
  get diagnosticMessage(): string | null {
    return this.breaker.diagnosticMessage();
  }

  /** 手动解除挂起(用户显式 /compact 或新会话后由调用方触发) */
  resume(): void {
    this._suspended = false;
    this._diagnosticEmitted = false;
    this.breaker.reset();
  }

  /**
   * 守卫一 + 守卫二的接地点:压缩前问一句"该不该压",压缩后登记一次事件。
   *
   * 挂起时**直接返回原消息**并且不再请求模型 —— 这是"停止自动压缩"的实际形态,
   * 而不是"压了但把警告打在日志里"。
   */
  async compactIfNeeded(messages: ChatMessage[], turnIndex: number, compact: CompactAction): Promise<GuardedCompaction> {
    if (this._suspended) {
      return {
        messages,
        compressed: false,
        suspended: true,
        reverified: null,
        // 挂起期间每轮都要让用户知道"为什么不再压了",否则表现为静默不响应
        userDiagnostic: this.diagnosticMessage,
        consecutiveQuickRefills: this.breaker.consecutiveQuickRefills,
        compression: null,
      };
    }

    const result = await compact(messages, { turnIndex, lastActivityAtMs: this._lastActivityAtMs });
    const out: GuardedCompaction = {
      messages: result.messages,
      compressed: result.compressed === true,
      suspended: false,
      reverified: null,
      userDiagnostic: null,
      consecutiveQuickRefills: 0,
      compression: result,
    };

    if (out.compressed) {
      // 登记压缩事件用的是"下一次压缩"的轮距:本轮先记账,真值复测留给 verifyAfterRequest
      const observation = this.breaker.observeCompaction(turnIndex);
      out.consecutiveQuickRefills = observation.consecutive;
      if (observation.tripped && !this._diagnosticEmitted) {
        this._suspended = true;
        this._diagnosticEmitted = true;
        out.suspended = true;
        out.userDiagnostic = observation.diagnostic ?? this.breaker.diagnosticMessage();
      }
      this._pendingVerify = true;
    }
    return out;
  }

  /**
   * 守卫一:请求回来后做真值复测。
   *
   * 时序说明:本轮请求携带的正是"压缩后的消息",所以这次返回的 usage
   * 才是压缩效果的真值 —— 在请求**之后**复测才有意义,在压缩当场只能拿估算。
   * 未发生压缩的轮次不复测(那是在给无关数字打分)。
   */
  verifyAfterRequest(input: { messages: ChatMessage[]; tokensAfterCompaction?: number }): ReverifiedContext | null {
    if (!this._pendingVerify) return null;
    this._pendingVerify = false;
    const reverified = reverifyContextAfterCompaction({
      messages: input.messages,
      ...(typeof input.tokensAfterCompaction === 'number' ? { tokensAfterCompaction: input.tokensAfterCompaction } : {}),
      usage: this._providerUsage,
      contextLimit: this.contextLimit,
      ...(this.triggerRatio !== undefined ? { triggerRatio: this.triggerRatio } : {}),
      ...(this.targetRatio !== undefined ? { targetRatio: this.targetRatio } : {}),
    });
    this._lastReverified = reverified;
    return reverified;
  }
}

// ==================== 守卫三:prompt-too-long 的溢出恢复 ====================

/**
 * 判定"这次失败是上下文超长"。
 *
 * 不依赖错误文本做流程判断是本仓的通则,但 provider 侧**没有**结构化错误码可依赖
 * (SSE 错误被压成 message 字符串),因此这里只认各家文档里稳定的短语,
 * 并且**只用于决定是否丢轮重试**这一条低风险动作;判错的代价是多丢一次最老轮,
 * 判漏的代价是本轮直接报错 —— 两者都不会静默损坏历史。
 */
const OVERFLOW_PATTERNS: readonly RegExp[] = [
  /prompt is too long/i,
  /context_length_exceeded/i,
  /context length/i,
  /maximum context/i,
  /too many tokens/i,
  /input is too long/i,
  /exceeds (?:the )?(?:model'?s )?context/i,
  /token limit/i,
  /请求.*(过长|超长|过大)/,
  /(上下文|context).*(超长|过长|超出|exceeded)/i,
];

export function isPromptTooLongErrorMessage(text: string | undefined | null): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  return OVERFLOW_PATTERNS.some((re) => re.test(text));
}

export interface OverflowRecovery {
  messages: ChatMessage[];
  /** 是否已降到触发线以下(仍超则应停止重试并把诊断交给用户) */
  resolved: boolean;
  droppedRounds: number;
  reason: OverflowDropResult['reason'];
  beforeTokens: number;
  afterTokens: number;
  /** 丢弃后仍存在的孤儿 tool 消息数(必须恒为 0,>0 说明配对被切断,调用方应放弃这份结果) */
  orphanToolMessages: number;
}

/**
 * 按完整 round 边界整组丢弃后重算消息,并用 `findOrphanToolMessages` 自证
 * 没有把 tool_calls ↔ tool 配对切断 —— 配出一对孤儿消息去请求,换来的会是
 * OpenAI 兼容端点的 400,比原错误更难诊断。
 *
 * @returns 判定为有孤儿时**不返回改写后的消息**(原样退回 + resolved=false),
 *          宁可不恢复也不发一份结构坏掉的请求。
 */
export function recoverAfterOverflow(
  messages: ChatMessage[],
  opts: { contextLimit: number; triggerRatio?: number; targetRatio?: number; maxDropRounds?: number },
): OverflowRecovery {
  const dropped = retryAfterOverflowDrop(messages, {
    contextLimit: opts.contextLimit,
    ...(opts.triggerRatio !== undefined ? { triggerRatio: opts.triggerRatio } : {}),
    ...(opts.targetRatio !== undefined ? { targetRatio: opts.targetRatio } : {}),
    ...(opts.maxDropRounds !== undefined ? { maxDropRounds: opts.maxDropRounds } : {}),
  });
  const orphans = findOrphanToolMessages(dropped.messages).length;
  const safe = orphans === 0;
  return {
    messages: safe ? dropped.messages : messages,
    resolved: safe && dropped.resolved,
    droppedRounds: safe ? dropped.droppedRounds : 0,
    reason: safe ? dropped.reason : 'nothing-to-drop',
    beforeTokens: dropped.beforeTokens,
    afterTokens: safe ? dropped.afterTokens : dropped.beforeTokens,
    orphanToolMessages: orphans,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
