// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 改动后自动复审(auto-review)。
 *
 * ## 为什么需要独立的「触发策略」层
 *
 * 直接"每次编辑后都跑诊断"有两个问题:
 *   ① 每改一个文件就跑一次 tsc/eslint,大仓里会把编辑变成分钟级;
 *   ② 连续编辑 N 个文件会产生 N 次重复诊断,且前 N-1 次结果立刻过期。
 *
 * 所以本模块把「**什么时候跑**」与「**跑完怎么判**」拆成两个纯函数:
 *   · `shouldReview` —— 触发策略(节流 + 批量 + 只读工具不触发);
 *   · `judgeReview`  —— 结论判定(新引入的问题才算,存量不阻断)。
 *
 * 两者都是纯函数,零 IO,可单测穷尽。真正的诊断执行由调用方注入。
 *
 * ## 默认关闭(重要)
 *
 * `enabled` 默认 false。理由:打开它会让所有编辑变慢,而"变慢"是用户立刻
 * 能感知的回归。要么由用户显式开启,要么由配置声明 —— 不允许默认打开后
 * 用"这是为了你好"来解释性能退化。
 *
 * ## 只报新增,不报存量
 *
 * 这与仓内既有纪律一致(差值棘轮:只拦新增,存量只报数)。
 * 一个 500 处历史告警的仓库,全量报告等于没有报告。
 */
import { createHash } from 'node:crypto';

/** 触发时机。三档互斥。 */
export type ReviewTrigger =
  /** 每次成功的写操作后立即跑(最严格,也最慢)。 */
  | 'every-write'
  /** 累积到 N 次写或距上次审查超过 T 毫秒后跑一次(默认)。 */
  | 'batched'
  /** 只在显式调用(提交前/用户要求)时跑。 */
  | 'manual';

export interface ReviewPolicy {
  /** 总开关。**默认 false** —— 见头注。 */
  readonly enabled: boolean;
  readonly trigger: ReviewTrigger;
  /** batched 模式:累积多少次写触发一次。 */
  readonly batchSize: number;
  /** batched 模式:距上次审查多少毫秒后允许再跑。 */
  readonly minIntervalMs: number;
  /**
   * 哪些工具算"写操作"。
   * 只读工具(读文件/搜索)绝不能触发 —— 否则一次探索式读取就引发全量诊断。
   */
  readonly writeTools: readonly string[];
}

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
  enabled: false,
  trigger: 'batched',
  batchSize: 5,
  minIntervalMs: 30_000,
  writeTools: ['write_file', 'edit_file', 'multi_edit', 'apply_patch', 'delete_file', 'file_batch_edit'],
};

/** 复审状态:由调用方持有并跨次传递(本模块不存)。 */
export interface ReviewState {
  /** 距上次审查累积的写次数。 */
  readonly pendingWrites: number;
  /** 上次审查时刻(ms);0 = 从未跑过。 */
  readonly lastReviewAt: number;
}

export const INITIAL_REVIEW_STATE: ReviewState = { pendingWrites: 0, lastReviewAt: 0 };

export interface ShouldReviewInput {
  readonly policy: ReviewPolicy;
  readonly state: ReviewState;
  /** 刚执行完的工具名。 */
  readonly toolName: string;
  /** 该工具是否成功。失败的写不应触发审查(文件没变)。 */
  readonly succeeded: boolean;
  readonly now: number;
  /** 显式请求审查(manual 模式下唯一触发途径)。 */
  readonly explicit?: boolean;
}

export interface ShouldReviewResult {
  readonly review: boolean;
  /** 下一步状态(无论是否触发,都要把 pendingWrites 维护对)。 */
  readonly nextState: ReviewState;
  /** 不触发的原因(便于排查"为什么没审")。 */
  readonly reason?: string;
}

/**
 * 判断是否该跑一次复审。
 *
 * 五条判据(每条都对应一个真实的性能/正确性问题):
 *   ① 总开关关闭 ⇒ 不跑,且**不累积** pendingWrites(关着就不该记);
 *   ② 非写工具/写失败 ⇒ 不跑、不累积;
 *   ③ manual ⇒ 只有 explicit 才跑;
 *   ④ every-write ⇒ 立即跑;
 *   ⑤ batched ⇒ 攒够 batchSize **或** 距上次超过 minIntervalMs 才跑。
 */
export function shouldReview(input: ShouldReviewInput): ShouldReviewResult {
  const { policy, state, toolName, succeeded, now, explicit } = input;

  if (!policy.enabled) {
    return { review: false, nextState: state, reason: 'policy disabled' };
  }
  if (explicit) {
    return { review: true, nextState: { pendingWrites: 0, lastReviewAt: now }, reason: 'explicit' };
  }
  if (policy.trigger === 'manual') {
    return { review: false, nextState: state, reason: 'manual mode requires explicit' };
  }
  if (!policy.writeTools.includes(toolName)) {
    return { review: false, nextState: state, reason: `not a write tool: ${toolName}` };
  }
  if (!succeeded) {
    return { review: false, nextState: state, reason: 'write failed, file unchanged' };
  }

  const pending = state.pendingWrites + 1;

  if (policy.trigger === 'every-write') {
    return { review: true, nextState: { pendingWrites: 0, lastReviewAt: now }, reason: 'every-write' };
  }

  // batched
  const dueByCount = pending >= policy.batchSize;
  const dueByTime = state.lastReviewAt > 0 && now - state.lastReviewAt >= policy.minIntervalMs;
  if (dueByCount || dueByTime) {
    return {
      review: true,
      nextState: { pendingWrites: 0, lastReviewAt: now },
      reason: dueByCount ? `batch size ${pending} reached` : 'min interval elapsed',
    };
  }
  return {
    review: false,
    nextState: { pendingWrites: pending, lastReviewAt: state.lastReviewAt },
    reason: `pending ${pending}/${policy.batchSize}`,
  };
}

/** 一条诊断问题。 */
export interface DiagnosticIssue {
  readonly file: string;
  /** 稳定标识:同一问题在两次运行中应产生同一 key(用于做差值)。 */
  readonly key: string;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
}

export interface ReviewVerdict {
  /** 是否新引入了问题。 */
  readonly regressed: boolean;
  /** 本次新增的问题(存量里没有的)。 */
  readonly introduced: readonly DiagnosticIssue[];
  /** 存量问题数(只报数,不阻断)。 */
  readonly preexistingCount: number;
  /** 消失的问题数(修好了)。 */
  readonly resolvedCount: number;
}

/**
 * 对比两次诊断,只报**新增**。
 *
 * 为什么按 key 而不按 message:同一条错误在不同行号上 message 会变,
 * 但 key(文件+规则+符号)稳定。按 message 比会把"行号漂移"误判成"新问题"。
 */
export function judgeReview(
  baseline: readonly DiagnosticIssue[],
  current: readonly DiagnosticIssue[],
): ReviewVerdict {
  const baseKeys = new Set(baseline.map((i) => i.key));
  const curKeys = new Set(current.map((i) => i.key));

  const introduced = current.filter((i) => !baseKeys.has(i.key));
  const resolved = baseline.filter((i) => !curKeys.has(i.key));

  return {
    regressed: introduced.some((i) => i.severity === 'error'),
    introduced,
    preexistingCount: current.length - introduced.length,
    resolvedCount: resolved.length,
  };
}

/** 生成稳定的问题 key(供调用方构造 DiagnosticIssue.key 用)。 */
export function issueKey(file: string, rule: string, symbol: string): string {
  return createHash('sha1').update(`${file}\u0000${rule}\u0000${symbol}`).digest('hex').slice(0, 16);
}

/** 把结论压成一句人读摘要。 */
export function describeVerdict(v: ReviewVerdict): string {
  if (v.introduced.length === 0) {
    return `无新增问题(存量 ${v.preexistingCount}${v.resolvedCount > 0 ? `,已修 ${v.resolvedCount}` : ''})`;
  }
  const errs = v.introduced.filter((i) => i.severity === 'error').length;
  return `新增 ${v.introduced.length} 个问题(其中 error ${errs}),存量 ${v.preexistingCount}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
