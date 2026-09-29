// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-4#6 执行适配器停止状态机 + b75-4#9 进程组存活探针测试。
 *
 * Windows 硬约束(票面):单测用可注入 fake,**不真杀任何进程、不真派生子进程** ——
 *   - 定时器走 fakeTimers(毫秒→回调登记表),不真等;
 *   - isPosixProcessGroupAlive 走注入 probe,不真 process.kill;
 *   - destroyChildOutputStreams 吃 fake 流,只断言 destroy 被调。
 */
import { describe, expect, it } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import {
  createStopMachine,
  destroyChildOutputStreams,
  FORCE_EXIT_GRACE_MS,
  isPosixProcessGroupAlive,
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

function makeDeps(over: Partial<StopMachineDeps> = {}) {
  const timers = fakeTimers();
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
    ...over,
  };
  return { deps, timers, calls };
}

describe('停止状态机(b75-4#6)', () => {
  it('armTimeout 前零个 timer(spawn 前卡顿不消耗超时预算),武装后恰好一个', () => {
    const { deps, timers } = makeDeps();
    const m = createStopMachine(deps);
    expect(m.state).toBe('idle');
    expect(timers.size()).toBe(0); // spawn/retry 期间的等待不占预算
    m.armTimeout(30_000);
    expect(timers.size()).toBe(1);
  });

  it('超时到点:onFire 先行、killTree 随之、FORCE_EXIT 宽限定格在 5s', () => {
    const { deps, timers, calls } = makeDeps();
    const m = createStopMachine(deps);
    let fired = false;
    m.armTimeout(100, () => {
      fired = true;
    });
    timers.fireAll(100);
    expect(fired).toBe(true);
    expect(calls.killTree).toBe(1);
    expect(m.state).toBe('stopping');
    expect(timers.scheduledMs()).toEqual([FORCE_EXIT_GRACE_MS]);
  });

  it('requestStop 幂等:重复调用只杀一次,宽限 timer 只武装一次', () => {
    const { deps, timers, calls } = makeDeps();
    const m = createStopMachine(deps);
    m.armTimeout(100);
    timers.fireAll(100);
    expect(m.requestStop()).toBe(false);
    expect(m.requestStop()).toBe(false);
    expect(calls.killTree).toBe(1);
    expect(timers.scheduledMs()).toEqual([FORCE_EXIT_GRACE_MS]);
  });

  it('FORCE_EXIT 到点:升级强杀 + 毁流释放 pipe 读端,且各只执行一次', () => {
    const { deps, timers, calls } = makeDeps();
    const m = createStopMachine(deps);
    m.armTimeout(100);
    timers.fireAll(100);
    timers.fireAll(FORCE_EXIT_GRACE_MS);
    expect(calls.forceKill).toBe(1);
    expect(calls.destroyStreams).toBe(1);
    expect(timers.size()).toBe(0); // 宽限 timer 已消费
  });

  it('前台完成也 finalize:未决超时 timer 被清,onFire/kill 永不发生', () => {
    const { deps, timers, calls } = makeDeps();
    const m = createStopMachine(deps);
    m.armTimeout(30_000, () => {
      throw new Error('onFire must not run after finalize');
    });
    expect(m.finalize()).toBe(true);
    expect(m.state).toBe('finalized');
    expect(timers.size()).toBe(0);
    timers.fireAll(30_000); // 无 pending ⇒ 不触发(旧实现这里会把事件循环挂满 30s)
    expect(calls.killTree).toBe(0);
    expect(m.finalize()).toBe(false); // finalize 幂等
  });

  it('FORCE_EXIT 宽限中 finalize 同样有效:终态收掉强杀 timer,升级不再发生', () => {
    const { deps, timers, calls } = makeDeps();
    const m = createStopMachine(deps);
    m.armTimeout(100);
    timers.fireAll(100); // 进入 stopping,宽限在途
    expect(m.finalize()).toBe(true);
    timers.fireAll(FORCE_EXIT_GRACE_MS);
    expect(calls.forceKill).toBe(0); // 宽限被清,不再升级
    expect(calls.destroyStreams).toBe(0);
  });
});

describe('进程组存活探针(b75-4#9,注入 probe 不真杀)', () => {
  const errWithCode = (code: string): (p: number) => void => () => {
    throw Object.assign(new Error(code), { code });
  };

  it('probe 通过 = 组存活', () => {
    expect(isPosixProcessGroupAlive(123, () => undefined)).toBe(true);
  });

  it('ESRCH = 组已消亡(不补刀)', () => {
    expect(isPosixProcessGroupAlive(123, errWithCode('ESRCH'))).toBe(false);
  });

  it('EPERM = 组存活(无权发信号 ≠ 组已死),照常升级 SIGKILL', () => {
    expect(isPosixProcessGroupAlive(123, errWithCode('EPERM'))).toBe(true);
  });

  it('其余错误码拿不准 = 按存活兜底(fail-safe:宁可补刀,不可漏杀)', () => {
    expect(isPosixProcessGroupAlive(123, errWithCode('EINVAL'))).toBe(true);
  });
});

describe('毁流(destroyChildOutputStreams)', () => {
  it('stdio 数组里每个非空流都被 destroy,null 档跳过', () => {
    const destroyed: number[] = [];
    const mk = (id: number) => ({
      destroy: () => {
        destroyed.push(id);
      },
    });
    const fake = { stdio: [null, mk(1), mk(2), mk(3)] } as unknown as ChildProcess;
    destroyChildOutputStreams(fake);
    expect(destroyed).toEqual([1, 2, 3]);
  });

  it('已毁流再 destroy 抛错也被吞掉(不因诊断路径二次炸流)', () => {
    let calls = 0;
    const grumpy = {
      destroy: () => {
        calls += 1;
        throw new Error('already destroyed');
      },
    };
    const fake = { stdio: [grumpy] } as unknown as ChildProcess;
    expect(() => destroyChildOutputStreams(fake)).not.toThrow();
    expect(calls).toBe(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
