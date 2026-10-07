// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998133(票4,拍板:要)—— kill 清理的双 deadline 夹逼 + 无信号目标不预留命令超时。
 *
 * 判据(上游 processTreeWaiter.ts:76-96 / processTreeTerminator.ts:462-467):
 *   (a) 传绝对 deadline 时,requestStop→forceKill 的实际结算时刻 ≤ min(相对预算, 绝对剩余);
 *   (b) child 已退出(目标为空)⇒ 不白等满 FORCE_EXIT 宽限,只保纯观察档
 *       CLEANUP_OBSERVATION_FLOOR_MS(750)到点 —— 不能把观察预算压得更短,
 *       把随后 code=0 的退出误报成持久残留;绝对剩余更紧时以绝对剩余为硬顶。
 *
 * 注入纪律:假计时器 + 假时钟,不派生任何真实进程、不真等墙钟。
 */
import { describe, expect, it } from 'vitest';
import {
  CLEANUP_OBSERVATION_FLOOR_MS,
  createStopMachine,
  FORCE_EXIT_GRACE_MS,
  type StopMachineDeps,
} from '../src/util/spawn-isolated.js';

/** fake 定时器:登记表形态,fireAll(ms) 手动到点,绝不真走墙钟。 */
function fakeTimers() {
  const pending = new Map<number, { ms: number; fn: () => void }>();
  let seq = 0;
  return {
    schedule: (ms: number, fn: () => void): NodeJS.Timeout => {
      const id = ++seq;
      pending.set(id, { ms, fn });
      return id as unknown as NodeJS.Timeout;
    },
    clear: (timer: NodeJS.Timeout) => {
      pending.delete(timer as unknown as number);
    },
    fireAll: (ms: number) => {
      for (const [id, entry] of [...pending]) {
        if (entry.ms === ms) {
          pending.delete(id);
          entry.fn();
        }
      }
    },
    size: () => pending.size,
    scheduledMs: () => [...pending.values()].map((e) => e.ms),
  };
}

/** fake 时钟:固定起点 + 手动推进,与 fakeTimers 配对驱动夹逼判定。 */
function fakeClock(startMs: number) {
  let now = startMs;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function makeDeps(over: Partial<StopMachineDeps> = {}) {
  const timers = fakeTimers();
  const clock = fakeClock(10_000);
  const calls = { killTree: 0, forceKill: 0, destroyStreams: 0 };
  const deps: StopMachineDeps = {
    killTree: () => {
      calls.killTree += 1;
    },
    forceKill: () => {
      calls.forceKill += 1;
    },
    destroyStreams: () => {
      calls.destroyStreams += 1;
    },
    scheduleTimer: timers.schedule,
    clearTimer: timers.clear,
    now: clock.now,
    ...over,
  };
  return { deps, timers, clock, calls };
}

describe('G-998133 kill 清理双 deadline 夹逼:(a) 结算 ≤ min(相对预算, 绝对剩余)', () => {
  it('绝对剩余 < FORCE_EXIT 宽限 ⇒ 按绝对剩余结算', () => {
    const { deps, timers } = makeDeps({ absoluteDeadlineMs: 13_000 }); // 剩余 3000
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    expect(m.requestStop()).toBe(true);
    expect(timers.scheduledMs()).toEqual([3_000]);
    expect(m.state).toBe('stopping');
    timers.fireAll(3_000);
    expect(timers.size()).toBe(0); // 结算 timer 已消费
  });

  it('绝对剩余 ≥ FORCE_EXIT 宽限 ⇒ 照旧按宽限结算(夹逼不收紧多余)', () => {
    const { deps, timers } = makeDeps({ absoluteDeadlineMs: 100_000 }); // 剩余 90000
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    m.requestStop();
    expect(timers.scheduledMs()).toEqual([FORCE_EXIT_GRACE_MS]);
  });

  it('不传绝对 deadline ⇒ 行为与旧版逐字一致(宽限 5s)', () => {
    const { deps, timers } = makeDeps();
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    m.requestStop();
    expect(timers.scheduledMs()).toEqual([FORCE_EXIT_GRACE_MS]);
  });

  it('绝对 deadline 已过(剩余 ≤ 0)⇒ 结算时刻为 0,force/毁流立即各执行一次', () => {
    const { deps, timers, calls } = makeDeps({ absoluteDeadlineMs: 9_500 }); // 已过 500ms
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    m.requestStop();
    expect(timers.scheduledMs()).toEqual([0]);
    timers.fireAll(0);
    expect(calls.forceKill).toBe(1);
    expect(calls.destroyStreams).toBe(1);
  });
});

describe('G-998133 无信号目标不预留命令超时:(b) 目标为空 ⇒ 不白等满宽限,只保观察档', () => {
  it(`目标集为空 ⇒ 结算压到观察档 ${'CLEANUP_OBSERVATION_FLOOR_MS'}(${CLEANUP_OBSERVATION_FLOOR_MS}ms)而非 5000`, () => {
    const { deps, timers, calls } = makeDeps({ signalTargetAlive: () => false });
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    m.requestStop();
    expect(timers.scheduledMs()).toEqual([CLEANUP_OBSERVATION_FLOOR_MS]);
    // 观察档到点:升级强杀 + 毁流照常执行(档位保留到点,不是直接吞掉)
    timers.fireAll(CLEANUP_OBSERVATION_FLOOR_MS);
    expect(calls.forceKill).toBe(1);
    expect(calls.destroyStreams).toBe(1);
  });

  it('目标为空且绝对剩余 < 观察档 ⇒ 绝对剩余硬顶(结算 ≤ min)', () => {
    const { deps, timers } = makeDeps({
      signalTargetAlive: () => false,
      absoluteDeadlineMs: 10_300, // 剩余 300 < 750
    });
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    m.requestStop();
    expect(timers.scheduledMs()).toEqual([300]);
  });

  it('目标存在 ⇒ 不压观察档(活目标仍走满宽限 5s)', () => {
    const { deps, timers } = makeDeps({ signalTargetAlive: () => true });
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    m.requestStop();
    expect(timers.scheduledMs()).toEqual([FORCE_EXIT_GRACE_MS]);
  });

  it('deps 缺省(无 signalTargetAlive 注入)⇒ 视同存在真实信号目标,回归不变', () => {
    const { deps, timers } = makeDeps();
    const m = createStopMachine(deps);
    m.armTimeout(30_000);
    m.requestStop();
    expect(timers.scheduledMs()).toEqual([FORCE_EXIT_GRACE_MS]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
