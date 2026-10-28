// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-686:进程级、按 `provider/model` 分桶的 **AIMD 准入闸门**。
 *
 * 立因:一个 CLI 进程里所有 run(主会话 + 并发子代理)共用同一个 provider 配额,而
 * 对模型端点的**实际请求面**今天没有任何闸门 —— 多条 run 同时打同一个模型端点是无界的。
 *
 * ───────────────────────── 与 `subagents/concurrency-budget.ts` 的分工 ─────────────────────────
 * 本层**不是**第二台并发状态机,也不得出现第二个档位常量。两层的职责是一上一下:
 *
 * - `subagents/concurrency-budget.ts`(`ProviderAimdGovernor`)= **cap 算术的唯一权威**:
 *   cap / inflight / successStreak / epoch / lastGood / cooldown 只住在那一处;
 *   并发档位与 AIMD 常量的唯一真相源也在那一文件(裸数字由 `tests/concurrency-aimd-guard.test.ts` 钉住)。
 * - 本文件 = **准入队列与尝试生命周期**:按 run 分队的等待队列、轮转公平、ticket 回喂、
 *   冷却唤醒定时器、retry 原因分表、observer 放行。这些是治理器**没有**的能力
 *   (它的 `ask()` 只看一眼就返回拒绝,不排队、不唤醒、不记 run 身份)。
 *
 * 唯一口径分配(写死在此,防止下一次有人两处各算一遍):
 *   - 「能不能放行」= `governor.ask()`(它同时负责 inflight ±1)
 *   - 「有多少人在等」= 本层的队列(`waiterCount`),经 `governor.noteWaiters()` 递进去
 *     —— 治理器 `ask()` 放行时会把它的 waiting 归零,而放行一次不等于队列空了。
 *   - 本层的 `inFlightByRun` **只**用于扇出归属判定与观测,不参与放行判定。
 *
 * ───────────────────────── 语义要点(逐条落在代码里,不是注释) ─────────────────────────
 * 1. **闸门粒度 = 每一次尝试**:尝试前 `acquire`,尝试终结即 `settle`;**退避 sleep 期间不持槽**
 *    (调用方必须在排定退避之前 settle,见 `commands/agent.ts` 的 sampleWithRetry 接线)。
 * 2. **结果经 ticket 回喂**:ticket 是该次尝试唯一的状态事件汇;`settle()` 幂等,
 *    第二次调用返回 false —— 既不重复归还名额,也不重复上报 AIMD 信号。
 * 3. **等待者按 run 轮转**(防饿死):大 fan-out 的那个 run 不得连续吃掉名额。
 * 4. **主代理走 observer**:立即放行、不看 cap 也不看冷却,但**计入在飞**
 *    (理由见 `AimdAskMode` 头注:不计入就等于子代理侧把这部分负载看成 0 而超发)。
 * 5. **限流类 retry 与非失败 retry 分表**:`THROTTLE_RETRY_REASONS` 喂 throttled 信号(减 cap);
 *    `NON_FAILURE_RETRY_REASONS`(token 刷新、签名修复那种)**既不减 cap 也不清 streak**,只终结尝试。
 * 6. **先扇出再减在飞**:settle 时先 `fanOut` 再 `bumpInFlight(-1)` —— 撞出这次变化的请求
 *    正是本 run 的,它此刻仍算 engaged;反过来做,一个 run 唯一的在飞请求撞出的减半会漏发给它自己。
 * 7. **快路径不得插队**:`tryAcquire()` 只要有等待者就直接返回 undefined ——
 *    否则"密集方靠快路径插队"会把轮转公平变成摆设(本票验收判据)。
 *
 * ───────────────────────── 默认关(强制) ─────────────────────────
 * `isRequestAdmissionEnabled()` 默认 **false**:未显式开启时,调用方**根本不会构造本层对象**,
 * 请求路径与改动前逐字同行为。这不是偷懒而是设计前提 —— 一套从未被执行过的准入描述,
 * 直接把默认打开等于造一台运行时恒红的闸门(§12e 同型)。
 *
 * 翻「默认开」的前置条件(四条同时成立,缺一不可):
 *   ① 影子档数据先证明 cap 起点与 AIMD 常量对本仓真实 provider 组合是可信的
 *      (`snapshot()` 现读,至少覆盖一次多 run 并发 + 一次真实 429);
 *   ② 接线覆盖面收满:除 `commands/agent.ts` 的两处尝试点外,`memory/embedding.ts` 与
 *      `tools/index.ts` 里对模型端点的其他调用点也走同一出口(否则"进程级"这句话是假的);
 *   ③ 端到端实测"打开后不会把串行批处理拖成排队饿死";
 *   ④ **主代理那一路必须先接 observer**:交互式主循环的 `runToolLoop` 调用点在
 *      `commands/repl.ts`(另一次是 headless 的 `runAgent`),而本层今天的接线把每一次尝试
 *      都按 `gated` 走 —— 翻默认开而不先给主代理 observer 通道,表现是"用户自己敲的那句
 *      排在子代理后面"。observer 的机制与判据都已就位(见 `AimdAskMode` 与本文件测试),
 *      缺的只是那个调用点传 `mode: 'observer'` 的一行;它不在本票的单文件接线预算内。
 * **裁决归属**:这一维属运行时行为变更(用户可感知:响应变慢/排队),需 CLI 运行时票的持有人
 * 与机主共同拍板,不得由本层顺手翻默认值。
 */

import {
  ProviderAimdGovernor,
  type AimdAskMode,
  type ConcurrencyChange,
} from '../subagents/concurrency-budget.js';

// ───────────────────────── 开关与分桶标识 ─────────────────────────

/** 显式开启本闸门的环境变量名(默认不设 ⇒ 关闭)。 */
export const REQUEST_ADMISSION_ENV = 'IHUI_CLI_REQUEST_ADMISSION';

/** provider/model 缺段时的占位段名(不得把空串当合法段:空段会让两个不同端点并进同一桶)。 */
export const UNKNOWN_BUCKET_SEGMENT = 'unknown';

const ENV_TRUTHY = new Set(['1', 'true', 'on', 'yes']);

/**
 * 闸门是否启用。缺省 false ⇒ 调用方不构造准入对象,请求路径逐字不变。
 * `env` 形参是测试注入通道(生产调用方一律不传)。
 */
export function isRequestAdmissionEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env[REQUEST_ADMISSION_ENV];
  if (typeof raw !== 'string') return false;
  return ENV_TRUTHY.has(raw.trim().toLowerCase());
}

/**
 * 桶标识:`${providerId}/${modelId}`。
 * 一个 provider 下不同模型的配额是两件事,所以必须分桶;而同 provider 同模型的多个 run
 * 共享一个桶 —— 这正是"进程级"这句话的落点。
 */
export function admissionBucketKey(providerId: string, modelId: string): string {
  const p = providerId.trim() === '' ? UNKNOWN_BUCKET_SEGMENT : providerId.trim();
  const m = modelId.trim() === '' ? UNKNOWN_BUCKET_SEGMENT : modelId.trim();
  return `${p}/${m}`;
}

/** 主代理(observer)的 run 身份:不排队、不进轮转,只在扇出的 engaged 集合里出现。 */
export const OBSERVER_RUN_ID = '\u0000observer';

/** 排队期间被 abort 时抛出的错误码(调用方据此走既有 'aborted' 语义,不得靠文案判)。 */
export const ADMISSION_ABORTED_CODE = 'REQUEST_ADMISSION_ABORTED';

export function isAdmissionAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === ADMISSION_ABORTED_CODE
  );
}

// ───────────────────────── 两张 retry 原因表(分表) ─────────────────────────

/**
 * 限流类 retry 原因 ⇒ 喂控制器的 throttled 信号(会减 cap)。
 * 名单来源:本仓现读的两套书写 —— `SSEErrorSeverity` 的 `'ratelimit'`
 * (packages/api-client/src/client.ts:2138)与 SSE 契约 failureKind 的 `'rate_limited'`
 * (packages/shared/src/sse/contract.ts:908),再加上游治理器的两档别名(对端可能直接送原因名)。
 */
export const THROTTLE_RETRY_REASONS: ReadonlySet<string> = new Set<string>([
  'ratelimit',
  'rate_limited',
  'provider_overloaded',
  'offpeak_queued',
]);

/**
 * **不是** provider 失败的 retry 原因 ⇒ 既不减 cap 也不清 streak,只当尝试终结。
 * 语义出处:上游 workflow-concurrency-governor.ts:78-82。
 * 这一族是"自家修复后重发"(换 token、修推理签名),把它喂进减档分支等于
 * 因为一次本地动作把并发上限砍一刀。
 */
export const NON_FAILURE_RETRY_REASONS: ReadonlySet<string> = new Set<string>([
  'reasoning_signature_repair',
  'auth_refresh',
]);

/** HTTP Retry-After 的单位是秒,治理器要 ms —— 换算系数只写这一处。 */
const MS_PER_SECOND = 1000;

/** 429 的唯一字面量落点(HTTP 状态码是协议常量,不是并发档位)。 */
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

/** 尝试结局档位(与治理器的 release 出口一一对应,'ended' 走 releaseCounted)。 */
type AttemptOutcome = 'success' | 'throttled' | 'timeout' | 'ended';

export interface AttemptSignal {
  outcome: AttemptOutcome;
  /** 对端 Retry-After(ms):带 ⇒ 即便 cap 减无可减也排定一次冷却 */
  retryAfterMs?: number;
}

export interface AttemptSignalInput {
  /** 本次尝试是否成功拿到补全 */
  ok: boolean;
  /** 本仓 formatSSEError 的 severity(结构化分类结果,不得由文案再推) */
  severity?: string;
  /** retry 原因名(与 severity 同视,便于接上游/契约侧的原因) */
  reason?: string;
  /** HTTP 状态码(结构化) */
  status?: number;
  /** 流 idle 超时(= MODEL_STREAM_IDLE_CODE 那一族) */
  isStreamIdleTimeout?: boolean;
  /** 重试是否可能改变结果(false = 终结性失败,不是并发信号) */
  retryable?: boolean;
  /** 对端 Retry-After(秒,HTTP 头原单位) */
  retryAfterSeconds?: number;
}

/**
 * 结构化分类:输入全是字段,不做任何文案匹配。
 *
 * 判序不可调换(每一档都对应一次真实的误判代价):
 *  ① 非失败 retry 先判 —— 它连"失败"都不是,后面任何分支都不该碰它;
 *  ② 成功 ⇒ success;
 *  ③ 限流 ⇒ throttled(带 retryAfter);
 *  ④ 不可重试且非限流 ⇒ ended(终结性失败:auth/forbidden/配额耗尽 —— 只还名额,不动 cap);
 *     **例外**:流 idle 超时(isStreamIdleTimeout)不走这一支 —— 慢到超时本身就是并发信号。
 *  ⑤ 其余瞬态失败 ⇒ timeout 档(治理器只有 throttled/timeout 两个减档出口,
 *     两者的减档算术相同,差别只在 change.reason —— 所以 network/server/idle 归此档是
 *     **口径合并**而不是丢信息,原始 severity 由调用方自己的日志负责)。
 */
export function classifyAttemptOutcome(input: AttemptSignalInput): AttemptSignal {
  const retryAfterMs =
    typeof input.retryAfterSeconds === 'number' &&
    Number.isFinite(input.retryAfterSeconds) &&
    input.retryAfterSeconds > 0
      ? Math.floor(input.retryAfterSeconds * MS_PER_SECOND)
      : undefined;
  const reason = input.reason?.trim().toLowerCase();
  const severity = input.severity?.trim().toLowerCase();

  if (reason !== undefined && NON_FAILURE_RETRY_REASONS.has(reason)) {
    return { outcome: 'ended' };
  }
  if (input.ok) return { outcome: 'success', ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) };

  const isThrottle =
    (reason !== undefined && THROTTLE_RETRY_REASONS.has(reason)) ||
    (severity !== undefined && THROTTLE_RETRY_REASONS.has(severity)) ||
    input.status === HTTP_STATUS_TOO_MANY_REQUESTS;
  if (isThrottle) return { outcome: 'throttled', ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) };

  if (input.retryable === false && !input.isStreamIdleTimeout) return { outcome: 'ended' };
  // 流 idle 超时例外:慢到超时本身就是"这个端点扛不住当前并发"的直接证据,
  // 即使上层决定不再重试它(如耗尽重试次数),它也仍然是一次并发信号 ⇒ 归 timeout 档。
  return { outcome: 'timeout', ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) };
}

// ───────────────────────── 对外契约 ─────────────────────────

type AdmissionMode = AimdAskMode;

/** 一次已准入尝试的状态事件汇:结果的唯一回喂通道,幂等。 */
export interface AdmissionTicket {
  readonly runId: string;
  readonly key: string;
  readonly mode: AdmissionMode;
  /** 准入时刻的 epoch 代次(settle 时回带,治理器据此判 stale) */
  readonly epoch: number;
  readonly settled: boolean;
  /** 回喂结果;返回 true = 本次调用是那个结算者。第二次调用是 no-op。 */
  settle(signal: AttemptSignal): boolean;
  /** 便捷出口:先按结构化输入分类再回喂。 */
  settleFromInput(input: AttemptSignalInput): boolean;
}

interface AdmissionBucketSnapshot {
  key: string;
  /** cap 由治理器给(唯一权威) */
  cap: number;
  /** inflight 由治理器给(唯一权威) */
  inflight: number;
  /** 本层队列里的等待者数 = 递进治理器的那个口径 */
  queuedWaiters: number;
  /** 各 run 此刻的在飞数(仅用于扇出归属与观测,不参与放行判定) */
  inFlightByRun: Record<string, number>;
  lastGrantedRun?: string;
  cooldownUntilMs: number;
}

interface AcquireOptions {
  mode?: AdmissionMode;
  signal?: AbortSignal;
}

export interface RequestAdmission {
  /** 快路径:有等待者或闸门关着 ⇒ 直接返回 undefined(不得插队)。 */
  tryAcquire(runId: string, key: string, mode?: AdmissionMode): AdmissionTicket | undefined;
  /** 排队准入:同 run 内 FIFO,run 之间轮转。signal abort ⇒ reject(码 ADMISSION_ABORTED_CODE)。 */
  acquire(runId: string, key: string, opts?: AcquireOptions): Promise<AdmissionTicket>;
  /** run 级订阅:只收本 run 在该 key 上有在飞/排队时产生的 change。 */
  subscribe(runId: string, listener: (change: ConcurrencyChange) => void): () => void;
  snapshot(key: string): AdmissionBucketSnapshot | undefined;
  /** 测试/进程退出通道:撤掉所有冷却闹钟,并让排队者立刻拿到 abort 结论而不是永远等。 */
  dispose(): void;
}

export interface RequestAdmissionDeps {
  /** 时钟注入(测试用假时钟;本仓有主机时钟漂移的史故,判据不得吃墙钟) */
  now?: () => number;
  /** 定时器注入(测试用手动触发的假调度器) */
  schedule?: (callback: () => void, delayMs: number) => () => void;
  /** 治理器注入(测试用独立实例;生产用进程级单例) */
  governor?: ProviderAimdGovernor;
}

// ───────────────────────── 实现 ─────────────────────────

interface Waiter {
  runId: string;
  mode: AdmissionMode;
  resolve: (ticket: AdmissionTicket) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

interface Bucket {
  readonly key: string;
  /** 每个 run 在飞(已准入未结算)的尝试数 —— 扇出归属的唯一依据 */
  readonly inFlightByRun: Map<string, number>;
  /** 等待者按 run 分队列(run 内 FIFO,run 间轮转) */
  readonly queues: Map<string, Waiter[]>;
  /** 轮转游标:上一次放行的 run,下一次从它之后开始找 */
  lastGrantedRun?: string;
  cancelCooldownWake?: () => void;
}

const defaultSchedule = (callback: () => void, delayMs: number): (() => void) => {
  const timer = setTimeout(callback, delayMs);
  // 不让一个等冷却的定时器把进程钉住:run 结束、进程要退出时它不该有投票权。
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    (timer as { unref: () => void }).unref();
  }
  return () => clearTimeout(timer);
};

function admissionAbortError(): Error {
  const err = new Error('provider request admission aborted');
  (err as Error & { code: string }).code = ADMISSION_ABORTED_CODE;
  return err;
}

export function createRequestAdmission(deps: RequestAdmissionDeps = {}): RequestAdmission {
  const now = deps.now ?? Date.now;
  const schedule = deps.schedule ?? defaultSchedule;
  const governor = deps.governor ?? new ProviderAimdGovernor(now);
  const buckets = new Map<string, Bucket>();
  /** run 级订阅(按 runId 而非按 key:扇出时再按桶的 engaged 集合过滤) */
  const listeners = new Map<string, Set<(change: ConcurrencyChange) => void>>();

  const bucketFor = (key: string): Bucket => {
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      // 惰性建桶,初值 = 天花板(由治理器给);此后 run 来来去去都不重置它(只有空闲惰性重置会)。
      bucket = { key, inFlightByRun: new Map(), queues: new Map() };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  const waiterCount = (bucket: Bucket): number => {
    let total = 0;
    for (const queue of bucket.queues.values()) total += queue.length;
    return total;
  };

  /** 把"有多少人在等"这个事实递给治理器 —— 每次队列或 ask 之后都要跑它。 */
  const syncWaiters = (bucket: Bucket): void => {
    governor.noteWaiters(bucket.key, waiterCount(bucket));
  };

  const bumpInFlight = (bucket: Bucket, runId: string, delta: number): void => {
    const next = (bucket.inFlightByRun.get(runId) ?? 0) + delta;
    if (next <= 0) bucket.inFlightByRun.delete(runId);
    else bucket.inFlightByRun.set(runId, next);
  };

  /**
   * 扇出:只给此刻在该 key 上有在飞或排队请求的 run。
   * 进程级遥测由治理器自己的 `onConcurrencyChanged` 负责,本函数只做 run 级投递 ——
   * 同一条 change 不得既经这里又经进程级订阅各喂一次给同一个消费者。
   */
  const fanOut = (bucket: Bucket, changes: ConcurrencyChange[]): void => {
    if (changes.length === 0) return;
    for (const [runId, set] of listeners) {
      const engaged =
        (bucket.inFlightByRun.get(runId) ?? 0) > 0 || (bucket.queues.get(runId)?.length ?? 0) > 0;
      if (!engaged) continue;
      for (const change of changes) {
        for (const listener of set) listener(change);
      }
    }
  };

  const mintTicket = (
    bucket: Bucket,
    runId: string,
    epoch: number,
    mode: AdmissionMode,
  ): AdmissionTicket => {
    let settled = false;
    const doSettle = (signal: AttemptSignal): boolean => {
      if (settled) return false;
      settled = true;
      // 'ended'(非失败 retry / 终结性失败)**只归还名额**,不上报任何 AIMD 信号 ——
      // 少了这一句 releaseCounted,名额就永久悬着:闸门会因为一次 token 刷新而把自己锁死。
      let changes: ConcurrencyChange[] = [];
      if (signal.outcome === 'ended') {
        governor.releaseCounted(bucket.key);
      } else {
        changes = governor.release(bucket.key, {
          outcome: signal.outcome,
          eventEpoch: epoch,
          ...(signal.retryAfterMs !== undefined ? { retryAfterMs: signal.retryAfterMs } : {}),
        });
      }
      // 先扇出再减在飞(头注语义要点 6):反过来做会把本 run 自己撞出的减半漏发给自己。
      fanOut(bucket, changes);
      bumpInFlight(bucket, runId, -1);
      // 结算改了 inflight/waiting,排队者可能可以放行。
      syncWaiters(bucket);
      drain(bucket);
      return true;
    };
    return {
      runId,
      key: bucket.key,
      mode,
      epoch,
      get settled() {
        return settled;
      },
      settle: doSettle,
      settleFromInput: (input: AttemptSignalInput) => doSettle(classifyAttemptOutcome(input)),
    };
  };

  /**
   * 放行一次尝试:`governor.ask()` 是"能不能放行"的唯一判据(它同时把 inflight +1)。
   * 返回 undefined ⇒ 闸门关着,调用方必须去排队,不得自己找别的口径再判一次。
   */
  const grant = (bucket: Bucket, runId: string, mode: AdmissionMode): AdmissionTicket | undefined => {
    const admitted = governor.ask(bucket.key, mode);
    // ask() 在拒绝时会给 waiting +1、在放行时归零 —— 两个都不是队列的真实等待数,立刻覆盖。
    syncWaiters(bucket);
    if (!admitted.ok) return undefined;
    // epoch 在 ask 之后现取:同一轮同步代码里不会有人翻代,取它等价于"准入时刻的代次"。
    const epoch = governor.snapshot(bucket.key).epoch;
    bumpInFlight(bucket, runId, 1);
    bucket.lastGrantedRun = runId;
    return mintTicket(bucket, runId, epoch, mode);
  };

  /** 按轮转挑下一个有等待者的 run(大 fan-out 不得饿死后来的小 run)。 */
  const nextWaiter = (bucket: Bucket): { runId: string; waiter: Waiter } | undefined => {
    const runs: string[] = [];
    for (const [runId, queue] of bucket.queues) {
      if (queue.length > 0) runs.push(runId);
    }
    if (runs.length === 0) return undefined;
    const last = bucket.lastGrantedRun;
    const lastIndex = last === undefined ? -1 : runs.indexOf(last);
    // lastIndex = -1 时 (−1+1)%n = 0 ⇒ 从队首开始;last 不在 runs 里(它已排空)同理从 0 起。
    const pick = runs[((lastIndex + 1) % runs.length + runs.length) % runs.length] as string;
    const queue = bucket.queues.get(pick);
    const waiter = queue?.shift();
    if (waiter === undefined) return undefined;
    if (queue !== undefined && queue.length === 0) bucket.queues.delete(pick);
    return { runId: pick, waiter };
  };

  /** 冷却闹钟:冷却未到期 ⇒ 到点唤醒等待者;已到期或没有冷却 ⇒ 撤掉在途闹钟。 */
  const armCooldownWake = (bucket: Bucket): void => {
    const snap = governor.snapshot(bucket.key);
    const t = now();
    if (snap.cooldownUntilMs <= t) {
      if (bucket.cancelCooldownWake) {
        bucket.cancelCooldownWake();
        bucket.cancelCooldownWake = undefined;
      }
      return;
    }
    // 重排前必先撤旧的:否则一次冷却内多个 settle 会攒出多把闹钟,同一时刻反复 drain。
    if (bucket.cancelCooldownWake) bucket.cancelCooldownWake();
    bucket.cancelCooldownWake = schedule(() => {
      bucket.cancelCooldownWake = undefined;
      drain(bucket);
    }, snap.cooldownUntilMs - t);
  };

  /** 放行尽可能多的等待者(闸门:governor 放行得了 且 不在冷却)。 */
  function drain(bucket: Bucket): void {
    for (;;) {
      const picked = nextWaiter(bucket);
      if (picked === undefined) break;
      const ticket = grant(bucket, picked.runId, picked.waiter.mode);
      if (ticket === undefined) {
        // 闸门还关着:把这个 run 的 waiter 放回队首(不得丢,也不得排到别人后面)。
        const back = bucket.queues.get(picked.runId);
        if (back) back.unshift(picked.waiter);
        else bucket.queues.set(picked.runId, [picked.waiter]);
        break;
      }
      detachWaiter(picked.waiter);
      picked.waiter.resolve(ticket);
    }
    syncWaiters(bucket);
    armCooldownWake(bucket);
  }

  const removeWaiter = (bucket: Bucket, waiter: Waiter): void => {
    const queue = bucket.queues.get(waiter.runId);
    if (queue === undefined) return;
    const idx = queue.indexOf(waiter);
    if (idx >= 0) queue.splice(idx, 1);
    if (queue.length === 0) bucket.queues.delete(waiter.runId);
  };

  /**
   * 摘掉 abort 监听。
   * signal/onAbort 都是可选的(observer 与无 signal 的调用方不会挂监听),
   * 直接把 `waiter.onAbort` 交给 removeEventListener 会让 tsc 在两个重载上都判
   * "undefined 不是 listener" —— 这里显式收口成一条,而不是用非空断言糊过去。
   */
  const detachWaiter = (waiter: Waiter): void => {
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener('abort', waiter.onAbort);
    }
  };

  const tryAcquire = (
    runId: string,
    key: string,
    mode: AdmissionMode = 'gated',
  ): AdmissionTicket | undefined => {
    const bucket = bucketFor(key);
    if (mode === 'observer') return grant(bucket, runId, mode);
    // 快路径的插队禁令:只要有等待者就不许"看一眼闸门有空位就自己进去"。
    if (waiterCount(bucket) > 0) return undefined;
    return grant(bucket, runId, mode);
  };

  const acquire = (
    runId: string,
    key: string,
    opts: AcquireOptions = {},
  ): Promise<AdmissionTicket> => {
    const bucket = bucketFor(key);
    const mode = opts.mode ?? 'gated';
    const signal = opts.signal;
    if (signal?.aborted) return Promise.reject(admissionAbortError());
    if (mode === 'observer') {
      // observer 不排队、不看冷却:快路径总命中,所以调用方永远不会为主代理发"排队中"。
      const ticket = grant(bucket, runId, mode);
      if (ticket !== undefined) return Promise.resolve(ticket);
      return Promise.reject(new Error('observer admission must always be granted'));
    }
    return new Promise<AdmissionTicket>((resolve, reject) => {
      const waiter: Waiter = { runId, mode, resolve, reject, ...(signal ? { signal } : {}) };
      if (signal) {
        waiter.onAbort = () => {
          removeWaiter(bucket, waiter);
          reject(admissionAbortError());
          syncWaiters(bucket);
          drain(bucket);
        };
        signal.addEventListener('abort', waiter.onAbort, { once: true });
      }
      const queue = bucket.queues.get(runId) ?? [];
      queue.push(waiter);
      bucket.queues.set(runId, queue);
      // 排队之后立刻试一次:容量本就空着时这一跑就是"零等待准入",不额外加一帧。
      drain(bucket);
    });
  };

  const subscribe = (runId: string, listener: (change: ConcurrencyChange) => void): (() => void) => {
    const set = listeners.get(runId) ?? new Set();
    set.add(listener);
    listeners.set(runId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) listeners.delete(runId);
    };
  };

  const snapshot = (key: string): AdmissionBucketSnapshot | undefined => {
    const bucket = buckets.get(key);
    if (bucket === undefined) return undefined;
    const gov = governor.snapshot(key);
    const byRun: Record<string, number> = {};
    for (const [runId, n] of bucket.inFlightByRun) byRun[runId] = n;
    return {
      key,
      cap: gov.cap,
      inflight: gov.inflight,
      queuedWaiters: waiterCount(bucket),
      inFlightByRun: byRun,
      ...(bucket.lastGrantedRun !== undefined ? { lastGrantedRun: bucket.lastGrantedRun } : {}),
      cooldownUntilMs: gov.cooldownUntilMs,
    };
  };

  const dispose = (): void => {
    for (const bucket of buckets.values()) {
      if (bucket.cancelCooldownWake) {
        bucket.cancelCooldownWake();
        bucket.cancelCooldownWake = undefined;
      }
      for (const queue of bucket.queues.values()) {
        for (const waiter of queue) {
          detachWaiter(waiter);
          waiter.reject(admissionAbortError());
        }
      }
      bucket.queues.clear();
      syncWaiters(bucket);
    }
  };

  return { tryAcquire, acquire, subscribe, snapshot, dispose };
}

// ───────────────────────── 进程级单例 ─────────────────────────
// 桶要跨 run 存活才有意义(每次 new 一个准入对象 = 每 run 一台私有闸门 = 没有进程级闸门),
// 所以这里给一个进程级出口;测试要隔离就自己调 createRequestAdmission()。

let processAdmission: RequestAdmission | undefined;

export function getRequestAdmission(): RequestAdmission {
  processAdmission ??= createRequestAdmission();
  return processAdmission;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
