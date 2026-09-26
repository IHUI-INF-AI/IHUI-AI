// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * In-flight 台账单测 —— 对应 ZCode 第十轮 A10A-7 的四条验收判据。
 *
 * 覆盖面刻意做成"机制级"而不是"token-manager 级":台账是通用件,
 * 它与真实 HTTP 超时的关系由 token-refresh-ledger.test.ts 那一对用例负责。
 */
import { describe, it, expect } from 'vitest';
import {
  InflightLedger,
  LedgerFailure,
  LEDGER_FAILURE_CODES,
  isLedgerFailureCode,
  toLedgerFailure,
  DEFAULT_LEDGER_FAILURE_MEMO_MS,
} from '../src/util/inflight-ledger.js';

/** 可推进的假时钟:失败保留窗口的到期判定不得依赖真实流逝时间。 */
function makeClock(startMs = 1_000_000): { now: () => number; advance: (ms: number) => void } {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err
  }
  return null;
}
describe('InflightLedger — 失败固化台账', () => {
  it('A 在途复用:并发两次 run 只执行一次 task', async () => {
    const ledger = new InflightLedger<string>();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const task = async (): Promise<string> => {
      calls += 1;
      await gate;
      return 'v';
    };
    const p1 = ledger.run('k', task);
    const p2 = ledger.run('k', task);
    expect(ledger.hasPending('k')).toBe(true);
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(r1).toBe('v');
    expect(r2).toBe('v');
    expect(ledger.hasPending('k')).toBe(false);
  });

  it('B 失败固化:第一个失败后,迟到者立刻拿到同一份带原因的结果(不经任何定时器)', async () => {
    const clock = makeClock();
    const ledger = new InflightLedger<string>({ now: clock.now, failureMemoMs: 60_000 });
    let calls = 0;
    const failing = async (): Promise<string> => {
      calls += 1;
      throw new LedgerFailure('timeout', '上游 10s 没回');
    };

    const first = await rejectionOf(ledger.run('k', failing));
    expect(first).toBeInstanceOf(LedgerFailure);
    expect((first as LedgerFailure).code).toBe('timeout');
    expect(calls).toBe(1);

    // 迟到提问的人:不得重新发起、不得再挂一个超时
    const late = await rejectionOf(ledger.run('k', failing));
    expect(late).toBe(first); // 同一实例 —— "同一份结果"而不是"又一个同类错误"
    expect(calls).toBe(1); // 一次都没重跑:这就是"不依赖超时"的可证形式
  });

  it('B′ 取消必须改写被等待的事实,而不是只结掉当前等待者', async () => {
    const clock = makeClock();
    const ledger = new InflightLedger<string>({ now: clock.now, failureMemoMs: 60_000 });
    const ac = new AbortController();
    let calls = 0;
    let releaseInner!: () => void;
    const inner = new Promise<string>((resolve) => {
      releaseInner = resolve;
    });

    const p1 = ledger.run(
      'k',
      async () => {
        calls += 1;
        return inner;
      },
      { signal: ac.signal },
    );
    // 任务本身还在飞(没有任何东西 settle),只取消等待侧
    ac.abort(new Error('用户取消'));
    const cancelled = await rejectionOf(p1);
    expect(cancelled).toBeInstanceOf(LedgerFailure);
    expect((cancelled as LedgerFailure).code).toBe('cancelled');

    // 关键判据:任务此刻**仍然没有 settle**,所以第二个等待者拿到的 cancelled
    // 只可能来自台账,不可能来自"它自己也等到了什么"。
    releaseInner();
    const late = await rejectionOf(ledger.run('k', async () => inner));
    expect((late as LedgerFailure).code).toBe('cancelled');
    expect(calls).toBe(1);
    // 反向锁:被取消的事后另一件事不受影响(不得越界改写)
    expect(ledger.peekFailure('other')).toBeNull();
  });

  it('原因码是封闭集,且 cancelled 与 timeout/network/auth 互不相同', async () => {
    const clock = makeClock();
    const ledger = new InflightLedger<string>({ now: clock.now, failureMemoMs: 60_000 });
    const seen: string[] = [];
    for (const code of LEDGER_FAILURE_CODES) {
      const err = await rejectionOf(
        ledger.run(`k-${code}`, async () => {
          throw new LedgerFailure(code, `故意失败:${code}`);
        }),
      );
      expect(err).toBeInstanceOf(LedgerFailure);
      seen.push((err as LedgerFailure).code);
    }
    // 四档各命中一次 ⇒ 既证明封闭集成员真能被读出(不是死表),也证明没有互相折叠
    expect(new Set(seen).size).toBe(LEDGER_FAILURE_CODES.length);
    expect(seen).toEqual([...LEDGER_FAILURE_CODES]);
    expect(isLedgerFailureCode('cancelled')).toBe(true);
    expect(isLedgerFailureCode('刷新失败')).toBe(false);
    // 超时与失败不得同码:timeout 与 auth 是两个不同答案
    expect(ledger.peekFailure('k-timeout')!.code).toBe('timeout');
    expect(ledger.peekFailure('k-auth')!.code).toBe('auth');
    expect(ledger.peekFailure('k-timeout')).not.toBe(ledger.peekFailure('k-auth'));
  });

  it('C 成功不固化:成功后再问必须重新执行(新鲜度由调用方判据决定)', async () => {
    const clock = makeClock();
    const ledger = new InflightLedger<string>({ now: clock.now, failureMemoMs: 60_000 });
    let calls = 0;
    const task = async (): Promise<string> => {
      calls += 1;
      return `v${calls}`;
    };
    expect(await ledger.run('k', task)).toBe('v1');
    expect(await ledger.run('k', task)).toBe('v2');
    expect(calls).toBe(2);
    expect(ledger.peekFailure('k')).toBeNull();
  });

  it('失败窗口到期后允许重试:失败固化不是永久封禁', async () => {
    const clock = makeClock();
    const ledger = new InflightLedger<string>({ now: clock.now, failureMemoMs: 5_000 });
    let calls = 0;
    const task = async (): Promise<string> => {
      calls += 1;
      if (calls === 1) throw new LedgerFailure('network', '瞬时抖动');
      return 'recovered';
    };
    expect(await rejectionOf(ledger.run('k', task))).toBeInstanceOf(LedgerFailure);
    // 窗口内:还是那个答案
    expect((await rejectionOf(ledger.run('k', task)) as LedgerFailure).code).toBe('network');
    expect(calls).toBe(1);
    // 窗口外:再试一次
    clock.advance(5_001);
    expect(await ledger.run('k', task)).toBe('recovered');
    expect(calls).toBe(2);
  });

  it('invalidate:凭据更换后旧失败不得继续拦截', async () => {
    const clock = makeClock();
    const ledger = new InflightLedger<string>({ now: clock.now, failureMemoMs: 60_000 });
    let calls = 0;
    const failing = async (): Promise<string> => {
      calls += 1;
      throw new LedgerFailure('auth', 'refresh token 已失效');
    };
    await rejectionOf(ledger.run('k', failing));
    expect(calls).toBe(1);
    ledger.invalidate('k');
    await rejectionOf(ledger.run('k', failing));
    expect(calls).toBe(2);
  });

  it('有界内存:只淘汰已结算记录,在途记录不得被摘(摘了等于让人重发)', async () => {
    const clock = makeClock();
    const ledger = new InflightLedger<string>({ now: clock.now, failureMemoMs: 60_000, maxEntries: 3 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // 先塞 3 条已结算的失败
    for (const key of ['a', 'b', 'c']) {
      await rejectionOf(
        ledger.run(key, async () => {
          throw new LedgerFailure('network', key);
        }),
      );
    }
    // 再来一条在途 —— 淘汰只能动已结算的,不能让在途那条失去身份
    const pendingPromise = ledger.run('busy', async () => {
      await gate;
      return 'done';
    });
    expect(ledger.hasPending('busy')).toBe(true);
    release();
    expect(await pendingPromise).toBe('done');
    expect(ledger.hasPending('busy')).toBe(false);
  });

  it('toLedgerFailure:非台账错误保守标 network,且保留原始 cause', () => {
    const raw = new Error('ECONNREFUSED');
    const wrapped = toLedgerFailure(raw);
    expect(wrapped.code).toBe('network');
    expect(wrapped.cause).toBe(raw);
    // 已经是 LedgerFailure 时原样返回(同一实例 = "同一份结果"的前提)
    const original = new LedgerFailure('auth', 'x');
    expect(toLedgerFailure(original)).toBe(original);
    expect(isLedgerFailureCode(original.code)).toBe(true);
  });

  it('默认保留窗口必须大于一次真实请求超时的量级说明(常量对账,防漂成 0)', () => {
    expect(DEFAULT_LEDGER_FAILURE_MEMO_MS).toBeGreaterThan(0);
    expect(LEDGER_FAILURE_CODES).toContain('cancelled');
    expect(LEDGER_FAILURE_CODES).toContain('timeout');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
