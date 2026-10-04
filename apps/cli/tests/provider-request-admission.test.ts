// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterEach } from 'vitest';
import {
  ADMISSION_ABORTED_CODE,
  NON_FAILURE_RETRY_REASONS,
  OBSERVER_RUN_ID,
  THROTTLE_RETRY_REASONS,
  REQUEST_ADMISSION_ENV,
  UNKNOWN_BUCKET_SEGMENT,
  admissionBucketKey,
  classifyAttemptOutcome,
  createRequestAdmission,
  isAdmissionAbortError,
  isRequestAdmissionEnabled,
  type AdmissionTicket,
  type RequestAdmission,
} from '../src/provider/request-admission.js';
import { MAX_CONCURRENCY, ProviderAimdGovernor } from '../src/subagents/concurrency-budget.js';

/**
 * G-686 provider 请求准入闸门的回归。
 *
 * **全程假时钟 + 假调度器**:本仓有主机时区/时钟漂移的史故(见守门「主机时区漂移对账」),
 * 任何一条断言都不许吃墙钟或真 sleep。
 *
 * 每条判据成对写(既有"密集方插不了队",也有"正常两方各得名额")——只留前者的话,
 * 判据可能只是把功能改坏了。
 */

const KEY = admissionBucketKey('test-provider', 'test-model');

/** 注入式时钟:测试自己拨表,绝不 Date.now()。 */
class FakeClock {
  ms = 1_000_000;
  readonly timers: Array<{ at: number; cb: () => void; cancelled: boolean }> = [];
  now = (): number => this.ms;
  schedule = (cb: () => void, delayMs: number): (() => void) => {
    const entry = { at: this.ms + delayMs, cb, cancelled: false };
    this.timers.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  /** 拨到 ms 并触发所有到期闹钟(等价于时间真的走过去,但没有真定时器)。 */
  advanceTo(ms: number): void {
    this.ms = ms;
    const due = this.timers.filter((t) => !t.cancelled && t.at <= ms);
    for (const t of due) {
      t.cancelled = true;
      t.cb();
    }
  }
  pendingTimers(): number {
    return this.timers.filter((t) => !t.cancelled).length;
  }
}

/** 观察 promise 是否已完成(不 await 一个永不 resolve 的 promise;同时避免 unhandled rejection)。 */
function track<T>(p: Promise<T>) {
  const state = { done: false, value: undefined as T | undefined, error: undefined as unknown };
  p.then(
    (v) => {
      state.done = true;
      state.value = v;
    },
    (e) => {
      state.done = true;
      state.error = e;
    },
  );
  return state;
}

async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

let clock: FakeClock;
let governor: ProviderAimdGovernor;
let admission: RequestAdmission;
const disposables: Array<() => void> = [];

function setUp(cap: number, seedRunId = 'seed-run'): void {
  clock = new FakeClock();
  governor = new ProviderAimdGovernor(clock.now);
  admission = createRequestAdmission({ now: clock.now, schedule: clock.schedule, governor });
  disposables.push(() => admission.dispose());
  // cap 用治理器自己的 run 级命令设 —— 本层不开第二条改 cap 的路(那是"两处算同一件事")
  governor.applyRunCapCommand(seedRunId, KEY, cap);
}

afterEach(() => {
  while (disposables.length > 0) {
    const fn = disposables.pop();
    if (fn) fn();
  }
});

describe('开关与分桶标识', () => {
  it('默认关:未设环境变量 ⇒ 不启用(调用方因此不构造准入对象,请求路径逐字不变)', () => {
    expect(isRequestAdmissionEnabled({})).toBe(false);
    expect(isRequestAdmissionEnabled({ [REQUEST_ADMISSION_ENV]: '' })).toBe(false);
    expect(isRequestAdmissionEnabled({ [REQUEST_ADMISSION_ENV]: 'off' })).toBe(false);
    expect(isRequestAdmissionEnabled({ [REQUEST_ADMISSION_ENV]: '0' })).toBe(false);
    expect(isRequestAdmissionEnabled({ [REQUEST_ADMISSION_ENV]: '1' })).toBe(true);
    expect(isRequestAdmissionEnabled({ [REQUEST_ADMISSION_ENV]: 'on' })).toBe(true);
    expect(isRequestAdmissionEnabled({ [REQUEST_ADMISSION_ENV]: ' TRUE ' })).toBe(true);
  });

  it('空 provider/model 段不得并进同一个合法桶', () => {
    expect(admissionBucketKey('', '')).toBe(`${UNKNOWN_BUCKET_SEGMENT}/${UNKNOWN_BUCKET_SEGMENT}`);
    expect(admissionBucketKey('a', 'b')).toBe('a/b');
    expect(admissionBucketKey('  a ', ' b ')).toBe('a/b');
    // 阳性对照:同 provider 不同模型必须分桶,否则"按 provider/model 分桶"这句话是空的
    expect(admissionBucketKey('a', 'b')).not.toBe(admissionBucketKey('a', 'c'));
  });
});

describe('验收判据:两条并发 run 共享 cap=2 ⇒ 各得名额,密集方不得靠快路径插队', () => {
  it('正向对照:cap=2 时两条 run 各拿一个名额(闸门没有把功能改坏)', async () => {
    setUp(2);
    const a = await admission.acquire('run-A', KEY);
    const b = await admission.acquire('run-B', KEY);
    expect(a.runId).toBe('run-A');
    expect(b.runId).toBe('run-B');
    const snap = admission.snapshot(KEY);
    expect(snap?.cap).toBe(2);
    expect(snap?.inflight).toBe(2);
    expect(snap?.queuedWaiters).toBe(0);
    expect(snap?.inFlightByRun).toEqual({ 'run-A': 1, 'run-B': 1 });
  });

  it('反向对照:cap 用满时同一 run 的下一条拿不到名额(证明 cap 真的在拦)', async () => {
    setUp(2);
    await admission.acquire('run-A', KEY);
    await admission.acquire('run-B', KEY);
    expect(admission.tryAcquire('run-A', KEY)).toBeUndefined();
  });

  it('插队禁令 + 轮转:密集方(run-A 排 3 个)不得吃掉连续两个名额', async () => {
    setUp(2);
    const a1 = await admission.acquire('run-A', KEY); // lastGrantedRun = run-A
    const b1 = await admission.acquire('run-B', KEY); // lastGrantedRun = run-B

    // 记录放行**顺序**:轮转失效(退化成全局 FIFO)时,前两格都会是 run-A
    const grantOrder: string[] = [];
    const pending: Array<Promise<AdmissionTicket>> = [];
    const enqueue = (runId: string): void => {
      const p = admission.acquire(runId, KEY);
      p.then(
        (t) => grantOrder.push(t.runId),
        () => undefined,
      );
      pending.push(p);
    };
    enqueue('run-A');
    enqueue('run-A');
    enqueue('run-A');
    enqueue('run-B');
    await flush();
    expect(grantOrder).toEqual([]);
    expect(admission.snapshot(KEY)?.queuedWaiters).toBe(4);

    // ① 插队禁令:A 手里刚结算出一个名额,但队列里有人 ⇒ 快路径必须让位
    expect(a1.settle({ outcome: 'success' })).toBe(true);
    await flush();
    expect(admission.tryAcquire('run-A', KEY)).toBeUndefined();
    expect(admission.tryAcquire('run-C', KEY)).toBeUndefined();

    // ② 连续释放两个名额必须分给两个不同的 run —— 这条断言与 Map 插入顺序无关
    expect(b1.settle({ outcome: 'success' })).toBe(true);
    await flush();
    expect(grantOrder).toHaveLength(2);
    expect(new Set(grantOrder.slice(0, 2))).toEqual(new Set(['run-A', 'run-B']));
    // 且密集方没有把名额全吃掉:仍有等待者排在后面
    expect(admission.snapshot(KEY)?.queuedWaiters).toBeGreaterThan(0);

    admission.dispose();
    await flush();
  });

  it('同 run 内保持 FIFO:第二个等待者不得越过第一个', async () => {
    setUp(1);
    const first = await admission.acquire('run-A', KEY);
    const second = track(admission.acquire('run-A', KEY));
    const third = track(admission.acquire('run-A', KEY));
    await flush();
    expect(second.done).toBe(false);
    expect(third.done).toBe(false);

    first.settle({ outcome: 'success' });
    await flush();
    expect(second.done).toBe(true);
    expect(third.done).toBe(false); // 越过队首 = 插队,即使同 run 也不允许

    (second.value as AdmissionTicket).settle({ outcome: 'success' });
    await flush();
    expect(third.done).toBe(true);
  });
});

describe('ticket:结果经 ticket 回喂且幂等', () => {
  it('第二次 settle 返回 false,不重复归还名额、不重复上报信号', async () => {
    setUp(2);
    const t = await admission.acquire('run-A', KEY);
    expect(t.epoch).toBe(governor.snapshot(KEY).epoch);
    expect(t.mode).toBe('gated');
    expect(t.settled).toBe(false);
    expect(t.settle({ outcome: 'success' })).toBe(true);
    expect(t.settled).toBe(true);
    expect(t.settle({ outcome: 'throttled', retryAfterMs: 5000 })).toBe(false);
    // inflight 只减了一次(若重复结算会把它压成负/多还一个)
    expect(governor.snapshot(KEY).inflight).toBe(0);
    expect(governor.snapshot(KEY).successStreak).toBe(1);
    // 被忽略的那次也没有把冷却排上
    expect(governor.snapshot(KEY).cooldownUntilMs).toBe(0);
  });

  it('settleFromInput 与 settle 走同一个结算口:ratelimit ⇒ 排定冷却', async () => {
    setUp(2);
    const t = await admission.acquire('run-A', KEY);
    expect(t.settleFromInput({ ok: false, severity: 'ratelimit', retryAfterSeconds: 2 })).toBe(true);
    expect(governor.snapshot(KEY).cooldownUntilMs).toBe(clock.ms + 2000);
  });
});

describe('退避期不持槽', () => {
  it('冷却中的等待者不进 inflight,闹钟到点后才拿到名额', async () => {
    setUp(2);
    const t = await admission.acquire('run-A', KEY);
    t.settleFromInput({ ok: false, reason: 'rate_limited', retryAfterSeconds: 2 });
    const deadline = governor.snapshot(KEY).cooldownUntilMs;
    expect(governor.snapshot(KEY).inflight).toBe(0);

    const waiter = track(admission.acquire('run-B', KEY));
    await flush();
    expect(waiter.done).toBe(false);
    // 关键读数:冷却期间它只是"排队",一个名额都不占
    expect(governor.snapshot(KEY).inflight).toBe(0);
    expect(admission.snapshot(KEY)?.queuedWaiters).toBe(1);
    expect(clock.pendingTimers()).toBe(1);

    clock.advanceTo(deadline);
    await flush();
    expect(waiter.done).toBe(true);
    expect(governor.snapshot(KEY).inflight).toBe(1);
    expect(admission.snapshot(KEY)?.queuedWaiters).toBe(0);
  });

  it('冷却未到点时不得提前放行(闹钟不是装饰)', async () => {
    setUp(2);
    const t = await admission.acquire('run-A', KEY);
    t.settleFromInput({ ok: false, reason: 'rate_limited', retryAfterSeconds: 2 });
    const deadline = governor.snapshot(KEY).cooldownUntilMs;
    const waiter = track(admission.acquire('run-B', KEY));
    await flush();

    clock.advanceTo(deadline - 1);
    await flush();
    expect(waiter.done).toBe(false);

    clock.advanceTo(deadline);
    await flush();
    expect(waiter.done).toBe(true);
  });

  it('同一桶内多次结算不得攒出多把冷却闹钟(否则同一时刻反复 drain)', async () => {
    setUp(4);
    const t1 = await admission.acquire('run-A', KEY);
    const t2 = await admission.acquire('run-A', KEY);
    t1.settleFromInput({ ok: false, reason: 'rate_limited', retryAfterSeconds: 2 });
    t2.settleFromInput({ ok: false, reason: 'rate_limited', retryAfterSeconds: 2 });
    expect(clock.pendingTimers()).toBe(1);
  });
});

describe('observer(主代理):立即放行但计入在飞', () => {
  it('cap 已满时 observer 仍立即放行,且 inflight 计入(后续 gated 因此被拦)', async () => {
    setUp(1);
    const gated = await admission.acquire('run-A', KEY);
    expect(gated.mode).toBe('gated');

    const obs = track(admission.acquire(OBSERVER_RUN_ID, KEY, { mode: 'observer' }));
    await flush();
    expect(obs.done).toBe(true); // 不排队、不看 cap
    const obsTicket = obs.value as AdmissionTicket;
    expect(admission.snapshot(KEY)?.inflight).toBe(2); // 两条都在飞
    expect(admission.snapshot(KEY)?.cap).toBe(1);
    expect(admission.tryAcquire('run-B', KEY)).toBeUndefined();

    // 关键一格:gated 那条结算完了,observer 那条还在飞 —— 若 observer 不计量,
    // 这里闸门就会开,run-B 就能插进一个"其实已经超载"的桶。
    gated.settle({ outcome: 'success' });
    expect(admission.snapshot(KEY)?.inflight).toBe(1);
    expect(admission.tryAcquire('run-B', KEY)).toBeUndefined();

    // observer 结算后名额才真的空出来
    obsTicket.settle({ outcome: 'success' });
    expect(admission.snapshot(KEY)?.inflight).toBe(0);
    expect(admission.tryAcquire('run-B', KEY)).toBeDefined();
  });

  it('observer 的放行不得擦掉"还有人在等"(additive-increase 的唯一触发条件)', async () => {
    setUp(2);
    const t = await admission.acquire('run-A', KEY);
    t.settleFromInput({ ok: false, reason: 'rate_limited', retryAfterSeconds: 2 });
    const obs = track(admission.acquire(OBSERVER_RUN_ID, KEY, { mode: 'observer' }));
    await flush();
    expect(obs.done).toBe(true);

    const waiter = track(admission.acquire('run-B', KEY));
    await flush();
    expect(waiter.done).toBe(false);
    expect(governor.snapshot(KEY).waiting).toBe(1);
  });

  it('observer 不进轮转队列(它永远没有等待者)', async () => {
    setUp(4);
    await admission.acquire(OBSERVER_RUN_ID, KEY, { mode: 'observer' });
    const snap = admission.snapshot(KEY);
    expect(snap?.inFlightByRun[OBSERVER_RUN_ID]).toBe(1);
    expect(snap?.queuedWaiters).toBe(0);
  });
});

describe('两张 retry 表分表(限流类 vs 非失败)', () => {
  it('限流类 retry ⇒ 减 cap', async () => {
    setUp(4);
    const t = await admission.acquire('run-A', KEY);
    expect(governor.snapshot(KEY).cap).toBe(4);
    t.settle({ outcome: 'throttled' });
    expect(governor.snapshot(KEY).cap).toBe(3);
    expect(governor.snapshot(KEY).successStreak).toBe(0);
  });

  it('非失败 retry ⇒ 既不减 cap 也不清 streak,但名额必须归还', async () => {
    setUp(4);
    const warm = await admission.acquire('run-A', KEY);
    warm.settle({ outcome: 'success' });
    expect(governor.snapshot(KEY).successStreak).toBe(1);

    const t = await admission.acquire('run-A', KEY);
    expect(governor.snapshot(KEY).inflight).toBe(1);
    t.settleFromInput({ ok: false, reason: 'auth_refresh' });
    expect(governor.snapshot(KEY).cap).toBe(4); // 没减
    expect(governor.snapshot(KEY).successStreak).toBe(1); // 没清
    expect(governor.snapshot(KEY).inflight).toBe(0); // 名额还了
  });

  it('终结性失败(不可重试且非限流)⇒ 同样不动 cap', async () => {
    setUp(4);
    const t = await admission.acquire('run-A', KEY);
    t.settleFromInput({ ok: false, severity: 'server', retryable: false });
    expect(governor.snapshot(KEY).cap).toBe(4);
    expect(governor.snapshot(KEY).inflight).toBe(0);
  });

  it('两表互斥:同一个原因不得既算限流又算非失败', () => {
    for (const reason of NON_FAILURE_RETRY_REASONS) {
      expect(THROTTLE_RETRY_REASONS.has(reason)).toBe(false);
    }
    for (const reason of THROTTLE_RETRY_REASONS) {
      expect(NON_FAILURE_RETRY_REASONS.has(reason)).toBe(false);
    }
  });

  it('分类表判序:非失败 retry 先判,限流其次,终结失败只还名额,其余瞬态归 timeout 档', () => {
    // ① 非失败 retry 即便带 429 形状也不该被判成限流(它是自家修复,不是端点扛不住)
    expect(classifyAttemptOutcome({ ok: false, reason: 'auth_refresh', status: 429 }).outcome).toBe(
      'ended',
    );
    // ② 成功 ⇒ success
    expect(classifyAttemptOutcome({ ok: true }).outcome).toBe('success');
    // ③ 限流 ⇒ throttled(retryAfter 秒 → ms)
    expect(
      classifyAttemptOutcome({ ok: false, severity: 'ratelimit', retryAfterSeconds: 3 }),
    ).toEqual({ outcome: 'throttled', retryAfterMs: 3000 });
    expect(classifyAttemptOutcome({ ok: false, status: 429 }).outcome).toBe('throttled');
    // ④ 不可重试且非限流 ⇒ ended(不构成本端点的并发信号)
    expect(classifyAttemptOutcome({ ok: false, severity: 'auth', retryable: false }).outcome).toBe(
      'ended',
    );
    // ④b 例外成对:流 idle 超时即使不可重试也算并发信号(慢到超时 = 端点扛不住当前并发)
    expect(
      classifyAttemptOutcome({ ok: false, severity: 'network', retryable: false }).outcome,
    ).toBe('ended');
    expect(
      classifyAttemptOutcome({
        ok: false,
        severity: 'network',
        retryable: false,
        isStreamIdleTimeout: true,
      }).outcome,
    ).toBe('timeout');
    // ⑤ 可重试的 network/server ⇒ timeout 档
    expect(classifyAttemptOutcome({ ok: false, severity: 'network' }).outcome).toBe('timeout');
    expect(classifyAttemptOutcome({ ok: false, severity: 'server' }).outcome).toBe('timeout');
    // 非法 retryAfter 不得变成 NaN 或负数塞进信号
    expect(
      classifyAttemptOutcome({ ok: false, severity: 'ratelimit', retryAfterSeconds: -1 }),
    ).toEqual({ outcome: 'throttled' });
  });
});

describe('先扇出再减在飞', () => {
  it('撞出减半的那个 run 自己必须收到这条 change(顺序反过来就漏发给自己)', async () => {
    setUp(4);
    const received: string[] = [];
    disposables.push(admission.subscribe('run-A', (c) => received.push(`${c.reason}:${c.to}`)));

    const t = await admission.acquire('run-A', KEY);
    t.settle({ outcome: 'throttled' });
    // run-A 只有这一个在飞:若先减在飞再扇出,它就不算 engaged ⇒ 收不到自己撞出的减半
    expect(received).toEqual(['throttle-429:3']);
  });

  it('与该 key 无关的 run 不得收到扇出(否则订阅会变成全站噪音)', async () => {
    setUp(2);
    const other: string[] = [];
    disposables.push(admission.subscribe('run-Z', (c) => other.push(c.reason)));
    const t = await admission.acquire('run-A', KEY);
    t.settle({ outcome: 'throttled' });
    expect(other).toEqual([]);
  });

  it('非失败 retry 不产生 change,因此不扇出(但名额照还)', async () => {
    setUp(4);
    const other: string[] = [];
    disposables.push(admission.subscribe('run-A', (c) => other.push(c.reason)));
    const t = await admission.acquire('run-A', KEY);
    t.settleFromInput({ ok: false, reason: 'auth_refresh' });
    expect(other).toEqual([]);
    expect(governor.snapshot(KEY).inflight).toBe(0);
  });
});

describe('排队期间 abort', () => {
  it('被取消的等待者不得永远悬着,也不得留下幽灵名额', async () => {
    setUp(1);
    const holder = await admission.acquire('run-A', KEY);
    const controller = new AbortController();
    const waiter = track(admission.acquire('run-B', KEY, { signal: controller.signal }));
    await flush();
    expect(waiter.done).toBe(false);

    controller.abort();
    await flush();
    expect(waiter.done).toBe(true);
    expect(isAdmissionAbortError(waiter.error)).toBe(true);
    expect((waiter.error as Error).code).toBe(ADMISSION_ABORTED_CODE);
    expect(admission.snapshot(KEY)?.queuedWaiters).toBe(0);

    // 名额结算后闸门仍能用,没被幽灵等待者卡住
    holder.settle({ outcome: 'success' });
    await flush();
    const next = await admission.acquire('run-B', KEY);
    expect(next.runId).toBe('run-B');
  });

  it('已 abort 的 signal 不进队列,直接给结论', async () => {
    setUp(1);
    const controller = new AbortController();
    controller.abort();
    const immediate = track(admission.acquire('run-B', KEY, { signal: controller.signal }));
    await flush();
    expect(immediate.done).toBe(true);
    expect(isAdmissionAbortError(immediate.error)).toBe(true);
    expect(admission.snapshot(KEY)?.queuedWaiters).toBe(0);
  });
});

describe('单一 cap 权威与档位来源(不得有第二台状态机)', () => {
  it('等待者口径由队列递进治理器:放行一次不得把别人的排队擦成 0', async () => {
    setUp(2);
    const a1 = await admission.acquire('run-A', KEY);
    await admission.acquire('run-B', KEY);
    const aPending = track(admission.acquire('run-A', KEY));
    await flush();
    expect(governor.snapshot(KEY).waiting).toBe(1);
    a1.settle({ outcome: 'success' });
    await flush();
    expect(aPending.done).toBe(true);
    // 队列真的空了才算 0 —— 这个 0 是同步出来的,不是 ask() 顺手归零的
    expect(governor.snapshot(KEY).waiting).toBe(0);
  });

  it('未显式设 cap 时起点是治理器天花板(本层不写第二个档位字面量)', () => {
    const c = new FakeClock();
    const g = new ProviderAimdGovernor(c.now);
    const a = createRequestAdmission({ now: c.now, schedule: c.schedule, governor: g });
    disposables.push(() => a.dispose());
    const probeKey = admissionBucketKey('p2', 'm2');
    expect(a.snapshot(probeKey)).toBeUndefined(); // 没建桶就是没判,不得伪装成 0
    expect(g.capOf(probeKey)).toBe(MAX_CONCURRENCY);
  });

  it('dispose 让所有排队者拿到 abort 结论并撤干净闹钟', async () => {
    setUp(1);
    await admission.acquire('run-A', KEY);
    const w = track(admission.acquire('run-B', KEY));
    await flush();
    expect(w.done).toBe(false);
    admission.dispose();
    await flush();
    expect(w.done).toBe(true);
    expect(isAdmissionAbortError(w.error)).toBe(true);
    expect(admission.snapshot(KEY)?.queuedWaiters).toBe(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
