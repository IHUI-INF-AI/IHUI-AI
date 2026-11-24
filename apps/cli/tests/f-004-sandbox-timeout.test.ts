// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-004 回归:POSIX 沙箱超时必须真的"团灭"并让 Promise 收敛。
 *
 * 病灶:旧实现不 detached、只 `child.kill('SIGKILL')` 杀 shell;孙子进程继承 stdio 后
 * 'close' 永不触发 ⇒ 超时 Promise 悬挂。现实现把三件事收进 `killProcessGroup`:
 *   ① 有 pid 时按进程组杀(`process.kill(-pid, 'SIGKILL')`,shell 是 detached leader);
 *   ② 无论组杀成败都再直接 `child.kill('SIGKILL')` 兜底;
 *   ③ 主动 destroy stdout/stderr,让 close 得以触发(超时分支随后 `finish(null,'SIGKILL')`)。
 *
 * Windows 上起不了 POSIX 进程组,故用对象替身 + 注入 killGroup 钉语义;不读源码字符串。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { killProcessGroup, type ProcessGroupChild } from '../src/tools/sandbox/platform/unix.js';

type Calls = { kill: string[]; stdoutDestroyed: number; stderrDestroyed: number };

function fakeChild(pid: number | undefined): { child: ProcessGroupChild; calls: Calls } {
  const calls: Calls = { kill: [], stdoutDestroyed: 0, stderrDestroyed: 0 };
  const child: ProcessGroupChild = {
    pid,
    kill: (signal: string) => {
      calls.kill.push(signal);
      return true;
    },
    stdout: { destroy: () => { calls.stdoutDestroyed += 1; } },
    stderr: { destroy: () => { calls.stderrDestroyed += 1; } },
  };
  return { child, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('F-004 killProcessGroup:组杀 + 直接杀 + 关管道', () => {
  it('有 pid:注入的 killGroup 收到正 pid(负号由默认实现补,即 -pid 组杀),且直接杀与两条管道销毁都执行', () => {
    const { child, calls } = fakeChild(4321);
    const killGroup = vi.fn();

    killProcessGroup(child, killGroup);

    // 注入点收到的是正 pid:组语义(取负)由默认实现负责,调用方不自己拼 -
    expect(killGroup).toHaveBeenCalledTimes(1);
    expect(killGroup).toHaveBeenCalledWith(4321);
    expect(calls.kill).toEqual(['SIGKILL']);
    expect(calls.stdoutDestroyed).toBe(1);
    expect(calls.stderrDestroyed).toBe(1);
  });

  it('默认实现把 -pid 交给 process.kill(证明真走进程组而不是单进程)', () => {
    const { child } = fakeChild(4321);
    const processKill = vi.spyOn(process, 'kill').mockImplementation(() => true);

    killProcessGroup(child);

    expect(processKill).toHaveBeenCalledTimes(1);
    expect(processKill).toHaveBeenCalledWith(-4321, 'SIGKILL');
  });

  it('无 pid:不调用 killGroup,但仍直接 kill 并销毁管道(不让 close 被管道卡住)', () => {
    for (const pid of [undefined, 0]) {
      const { child, calls } = fakeChild(pid);
      const killGroup = vi.fn();

      killProcessGroup(child, killGroup);

      expect(killGroup).not.toHaveBeenCalled();
      expect(calls.kill).toEqual(['SIGKILL']);
      expect(calls.stdoutDestroyed).toBe(1);
      expect(calls.stderrDestroyed).toBe(1);
    }
  });

  it('killGroup 抛异常被吞:不影响后续直接 kill 与管道销毁(组可能已退出)', () => {
    const { child, calls } = fakeChild(777);
    const killGroup = vi.fn(() => {
      throw new Error('ESRCH');
    });

    expect(() => killProcessGroup(child, killGroup)).not.toThrow();
    expect(calls.kill).toEqual(['SIGKILL']);
    expect(calls.stdoutDestroyed).toBe(1);
    expect(calls.stderrDestroyed).toBe(1);
  });

  it('重复调用幂等:第二次仍不抛,且仍然杀一次、销毁一次(超时与超量可能先后触发)', () => {
    const { child, calls } = fakeChild(999);
    const killGroup = vi.fn();

    expect(() => {
      killProcessGroup(child, killGroup);
      killProcessGroup(child, killGroup);
    }).not.toThrow();

    expect(killGroup).toHaveBeenCalledTimes(2);
    expect(calls.kill).toEqual(['SIGKILL', 'SIGKILL']);
    expect(calls.stdoutDestroyed).toBe(2);
    expect(calls.stderrDestroyed).toBe(2);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
