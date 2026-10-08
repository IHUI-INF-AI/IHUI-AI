// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务注册表 + /loop 测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  registerTask,
  registerFailedTask,
  getTask,
  listTasks,
  getTaskOutput,
  waitForTask,
  killTask,
  clearAllTasks,
  settleAllInFlight,
  getRemovalGuardStats,
  startLoop,
  listLoops,
  stopLoop,
  clearAllLoops,
  formatSettledTaskNotification,
  truncateTaskNotification,
  TASK_NOTIFICATION_MAX_CHARS,
  __test__,
} from '../src/tools/background-registry.js';
import type { BackgroundTask, BackgroundTaskSnapshot } from '../src/tools/background-registry.js';
import { ledgerFilePath } from '../src/tools/background-ledger.js';
import { runSandboxedAsync } from '../src/sandbox/index.js';

const isWindows = process.platform === 'win32';
const shellTrue = isWindows ? 'cmd /c' : 'sh -c';
function makeCmd(command: string): string {
  return isWindows ? `${shellTrue} "${command}"` : `${shellTrue} "${command}"`;
}

describe('后台任务注册表', () => {
  beforeEach(() => {
    clearAllTasks();
    clearAllLoops();
  });

  afterEach(() => {
    clearAllTasks();
    clearAllLoops();
  });

  describe('registerTask', () => {
    it('注册任务并返回 id', async () => {
      const handle = runSandboxedAsync(makeCmd('echo hello'), {
        cwd: os.tmpdir(),
        timeoutMs: 5000,
      });
      const id = registerTask(handle.process, 'echo hello');
      expect(id).toMatch(/^bg_\d+_[a-f0-9]+$/);
      // 等待结束
      await waitForTask(id, 5000);
      const task = getTask(id);
      expect(task).not.toBeNull();
      expect(task!.status).toBe('exited');
      expect(task!.exitCode).toBe(0);
      expect(task!.stdoutBuf).toContain('hello');
    });

    it('任务退出后状态变为 exited', async () => {
      const handle = runSandboxedAsync(makeCmd('exit 0'), {
        cwd: os.tmpdir(),
        timeoutMs: 5000,
      });
      const id = registerTask(handle.process, 'exit 0');
      await waitForTask(id, 5000);
      const task = getTask(id)!;
      expect(task.status).toBe('exited');
      expect(task.exitCode).toBe(0);
      expect(task.exitedAt).toBeDefined();
      expect(task.process).toBeNull();
    });

    it('非零退出码正确记录', async () => {
      const handle = runSandboxedAsync(makeCmd('exit 42'), {
        cwd: os.tmpdir(),
        timeoutMs: 5000,
      });
      const id = registerTask(handle.process, 'exit 42');
      await waitForTask(id, 5000);
      const task = getTask(id)!;
      expect(task.status).toBe('exited');
      expect(task.exitCode).toBe(42);
    });

    it('stderr 输出正确收集', async () => {
      const cmd = isWindows ? 'echo error 1>&2' : 'echo error 1>&2';
      const handle = runSandboxedAsync(makeCmd(cmd), {
        cwd: os.tmpdir(),
        timeoutMs: 5000,
      });
      const id = registerTask(handle.process, cmd);
      await waitForTask(id, 5000);
      const task = getTask(id)!;
      expect(task.stderrBuf.toLowerCase()).toContain('error');
    });
  });

  describe('registerFailedTask', () => {
    it('注册失败任务并立即标记 error 状态', () => {
      const id = registerFailedTask('blocked command', '沙盒拒绝');
      const task = getTask(id)!;
      expect(task.status).toBe('error');
      expect(task.stderrBuf).toContain('沙盒拒绝');
      expect(task.exitedAt).toBeDefined();
      expect(task.process).toBeNull();
    });
  });

  describe('listTasks', () => {
    it('空时返回空数组', () => {
      expect(listTasks()).toEqual([]);
    });

    it('返回所有任务(按时间倒序)', async () => {
      const h1 = runSandboxedAsync(makeCmd('echo 1'), { cwd: os.tmpdir(), timeoutMs: 5000 });
      const id1 = registerTask(h1.process, 'echo 1');
      await waitForTask(id1, 5000);
      const h2 = runSandboxedAsync(makeCmd('echo 2'), { cwd: os.tmpdir(), timeoutMs: 5000 });
      const id2 = registerTask(h2.process, 'echo 2');
      await waitForTask(id2, 5000);

      const list = listTasks();
      expect(list).toHaveLength(2);
      // 较新的在前
      expect(list[0]!.id).toBe(id2);
      expect(list[1]!.id).toBe(id1);
    });

    it('返回元数据(不含 stdout/stderr)', async () => {
      const handle = runSandboxedAsync(makeCmd('echo test'), { cwd: os.tmpdir(), timeoutMs: 5000 });
      const id = registerTask(handle.process, 'echo test');
      await waitForTask(id, 5000);
      const meta = listTasks()[0]!;
      expect(meta.id).toBe(id);
      expect(meta.command).toBe('echo test');
      expect(meta.status).toBe('exited');
      expect(meta.startedAt).toBeDefined();
      // 元数据不应包含 stdoutBuf
      expect((meta as Record<string, unknown>).stdoutBuf).toBeUndefined();
    });
  });

  describe('getTaskOutput', () => {
    it('返回 stdout/stderr + 状态', async () => {
      const handle = runSandboxedAsync(makeCmd('echo hello'), { cwd: os.tmpdir(), timeoutMs: 5000 });
      const id = registerTask(handle.process, 'echo hello');
      await waitForTask(id, 5000);
      const output = getTaskOutput(id)!;
      expect(output.stdout).toContain('hello');
      expect(output.status).toBe('exited');
      expect(output.exitCode).toBe(0);
    });

    it('tail 参数截取最后 N 行', async () => {
      const cmd = isWindows ? 'for /L %i in (1,1,5) do @echo line%i' : 'for i in 1 2 3 4 5; do echo "line$i"; done';
      const handle = runSandboxedAsync(makeCmd(cmd), { cwd: os.tmpdir(), timeoutMs: 5000 });
      const id = registerTask(handle.process, cmd);
      await waitForTask(id, 5000);
      const output = getTaskOutput(id, 2)!;
      const lines = output.stdout.trim().split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
    });

    it('不存在返回 null', () => {
      expect(getTaskOutput('nonexistent')).toBeNull();
    });
  });

  describe('waitForTask', () => {
    it('已结束任务立即返回', async () => {
      const handle = runSandboxedAsync(makeCmd('echo done'), { cwd: os.tmpdir(), timeoutMs: 5000 });
      const id = registerTask(handle.process, 'echo done');
      await waitForTask(id, 5000);
      const start = Date.now();
      const result = await waitForTask(id, 1000);
      expect(Date.now() - start).toBeLessThan(200);
      expect(result.state).toBe('settled');
      expect(result.snapshot!.status).toBe('exited');
    });

    it('超时返回 timed-out-unknown(快照仍为 running)', async () => {
      // 启动一个长任务
      const longCmd = isWindows ? 'ping -n 10 127.0.0.1 > nul' : 'sleep 10';
      const handle = runSandboxedAsync(makeCmd(longCmd), { cwd: os.tmpdir(), timeoutMs: 30_000 });
      const id = registerTask(handle.process, longCmd);
      const start = Date.now();
      const result = await waitForTask(id, 500);
      expect(Date.now() - start).toBeGreaterThanOrEqual(400);
      // 新契约:到点不把中间状态升格成结论,状态报 timed-out-unknown,快照供参考
      expect(result.state).toBe('timed-out-unknown');
      expect(result.snapshot!.status).toBe('running');
      // 清理
      await killTask(id);
    });

    it('不存在返回 gone 态且快照为 null', async () => {
      const result = await waitForTask('nonexistent', 100);
      expect(result.state).toBe('gone');
      expect(result.snapshot).toBeNull();
    });
  });

  describe('killTask', () => {
    it('终止运行中的任务', async () => {
      const longCmd = isWindows ? 'ping -n 30 127.0.0.1 > nul' : 'sleep 30';
      const handle = runSandboxedAsync(makeCmd(longCmd), { cwd: os.tmpdir(), timeoutMs: 60_000 });
      const id = registerTask(handle.process, longCmd);
      // 确认任务在运行
      const task = getTask(id)!;
      expect(task.status).toBe('running');
      // 终止
      const result = await killTask(id);
      expect(result.killed).toBe(true);
      // CI 上进程树退出/exit 事件传播可能滞后于 killTask 返回(实测 sleep 30
      // 在 ubuntu runner 上 SIGKILL 后仍需数百 ms 才触发 close),轮询等待收敛
      const finalResult = await waitForTask(id, 10_000);
      expect(finalResult.state).toBe('settled');
      expect(['killed', 'exited']).toContain(finalResult.snapshot!.status);
    });

    it('任务不存在返回失败', async () => {
      const result = await killTask('nonexistent');
      expect(result.killed).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('已结束任务返回失败', async () => {
      const handle = runSandboxedAsync(makeCmd('echo done'), { cwd: os.tmpdir(), timeoutMs: 5000 });
      const id = registerTask(handle.process, 'echo done');
      await waitForTask(id, 5000);
      const result = await killTask(id);
      expect(result.killed).toBe(false);
      expect(result.reason).toContain('已结束');
    });
  });

  describe('clearAllTasks', () => {
    it('清空所有任务', async () => {
      const handle = runSandboxedAsync(makeCmd('echo test'), { cwd: os.tmpdir(), timeoutMs: 5000 });
      registerTask(handle.process, 'echo test');
      clearAllTasks();
      expect(listTasks()).toEqual([]);
    });

    it('清理时杀掉运行中任务', async () => {
      const longCmd = isWindows ? 'ping -n 30 127.0.0.1 > nul' : 'sleep 30';
      const handle = runSandboxedAsync(makeCmd(longCmd), { cwd: os.tmpdir(), timeoutMs: 60_000 });
      registerTask(handle.process, longCmd);
      clearAllTasks();
      // 给一点时间让进程退出
      await new Promise((r) => setTimeout(r, 500));
      expect(listTasks()).toEqual([]);
    });
  });
});

describe('终态单向门与投递 claim(G-814418)', () => {
  beforeEach(() => {
    clearAllTasks();
  });

  afterEach(() => {
    clearAllTasks();
  });

  /**
   * 假子进程:注册表对 process 只做四件事 —— `stdout?.on` / `stderr?.on` / `on('error')` /
   * `on('close')`,外加读 `pid` 落台账。EventEmitter 全覆盖,于是"第二个终态事件"能按
   * 确定的顺序喂进来,而不是靠真进程的事件竞态(真事件那一型由下面第一条用例覆盖)。
   */
  function fakeChild(): ChildProcess {
    return new EventEmitter() as unknown as ChildProcess;
  }

  it('真 close 之后再来的 close/error:状态四字段与通知次数都不许变', async () => {
    const handle = runSandboxedAsync(makeCmd('echo hi'), { cwd: os.tmpdir(), timeoutMs: 5000 });
    const id = registerTask(handle.process, 'echo hi');
    const task = getTask(id)!;
    let notices = 0;
    const off = __test__.addSettleListener(id, () => {
      notices += 1;
    });

    // 第一次:真实终态(close 由进程自己发出)
    const first = await waitForTask(id, 5000);
    expect(first.state).toBe('settled');
    expect(notices).toBe(1);
    const status0 = task.status;
    const exitCode0 = task.exitCode;
    const exitedAt0 = task.exitedAt;

    // 第二次/第三次:同一进程对象上的迟到事件(Node 在 spawn 失败时会 'error' 后 'close';
    // pruneCompleted 之后同 id 复用还会把上一轮的事件打到这一轮)
    handle.process!.emit('close', 7, 'SIGKILL');
    handle.process!.emit('error', new Error('late error'));

    // 判据②:已终态条目不许被迟到快照改写
    expect(task.status).toBe(status0); // 仍是 exited,不许被读成 killed
    expect(task.exitCode).toBe(exitCode0); // 仍是真退出码,不许被读成 7
    expect(task.exitedAt).toBe(exitedAt0); // 终态时刻不许被推后
    expect(task.timedOut).toBe(false); // 迟到的 SIGKILL 不许把它写成"超时被杀"
    // 判据①:监听者只被告知一次(投递位已经消耗)
    expect(notices).toBe(1);
    expect(task.notified).toBe(true);
    off();
  });

  it('迟到的第二个终态事件:连一个"事后才登记"的等待者也不许再收到投递', () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake late close');
    const task = getTask(id)!;
    child.emit('close', 0, null);
    expect(task.status).toBe('exited');
    // 第一次 close 时**还没有等待者**,所以位没有被消耗(那是"没有等待者时不消耗 claim"
    // 那条用例的语义)。于是这里拦下第二次投递的只能是**终态单向门** —— 归属刻意与下一条
    // (claim 单独有牙)分开:两条各去掉一个判据,红的必须是不同的用例。
    expect(task.notified).toBe(false);

    // 终态之后才挂进来的等待者:第二个 close 必须整段被拒
    let lateNotices = 0;
    const off = __test__.addSettleListener(id, () => {
      lateNotices += 1;
    });
    child.emit('close', 3, null);
    expect(lateNotices).toBe(0);
    expect(task.exitCode).toBe(0); // 门没让它改写
    off();
  });

  it('error 先落终态后,迟到的 close 不改写 status/exitCode/exitedAt,也不清空 process', () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake error then close');
    const task = getTask(id)!;
    child.emit('error', new Error('spawn failed'));
    expect(task.status).toBe('error');
    const exitedAt0 = task.exitedAt;

    child.emit('close', 0, null); // 迟到的"正常退出"快照
    expect(task.status).toBe('error'); // 不许被洗成 exited
    expect(task.exitCode).toBeUndefined(); // 不许被补上 0
    expect(task.exitedAt).toBe(exitedAt0); // 不许被推后
    expect(getTask(id)!.process).toBe(child); // 整段收尾(含 process 置空)都被拒
  });

  it('本轮已投递时,新登记的等待者也不会被二次投递(claim 单独有牙)', () => {
    const id = registerFailedTask('fake deliver twice', '沙盒拒绝');
    const task = getTask(id)!;
    let first = 0;
    const off1 = __test__.addSettleListener(id, () => {
      first += 1;
    });
    __test__.notifySettled(task);
    off1(); // 送达后自我摘除:再登记的监听者能穿过"集合非空"那一格,正面撞 claim

    let second = 0;
    const off2 = __test__.addSettleListener(id, () => {
      second += 1;
    });
    __test__.notifySettled(task);
    expect(first).toBe(1);
    expect(second).toBe(0); // 去掉判据①的 `if (task.notified) return` 这一条必红
    expect(task.notified).toBe(true);
    off2();
  });

  it('没有等待者时不消耗 claim:位保持 false,后来的等待者仍能被投递', () => {
    const id = registerFailedTask('fake no waiter', '沙盒拒绝');
    const task = getTask(id)!;
    __test__.notifySettled(task); // 集合为空 ⇒ 无东西可投递 ⇒ 不动位
    expect(task.notified).toBe(false);
    let notices = 0;
    const off = __test__.addSettleListener(id, () => {
      notices += 1;
    });
    __test__.notifySettled(task);
    expect(notices).toBe(1);
    expect(task.notified).toBe(true);
    off();
  });

  it('投递抛错 ⇒ 位回退,下一次仍能投递', () => {
    const id = registerFailedTask('fake throwing waiter', '沙盒拒绝');
    const task = getTask(id)!;
    const seen: string[] = [];
    const offBoom = __test__.addSettleListener(id, () => {
      seen.push('boom');
      throw new Error('listener exploded');
    });
    __test__.notifySettled(task);
    expect(seen).toEqual(['boom']);
    // 判据①的回退半边:抛错不等于送达
    expect(task.notified).toBe(false);
    offBoom();

    const offGood = __test__.addSettleListener(id, (snap) => {
      seen.push(`retry:${snap?.status ?? 'null'}`);
    });
    __test__.notifySettled(task);
    expect(seen).toEqual(['boom', 'retry:error']);
    expect(task.notified).toBe(true);
    offGood();
  });

  it('一个等待者抛错,不得吞掉排在它后面的等待者的终态', () => {
    const id = registerFailedTask('fake partial delivery', '沙盒拒绝');
    const task = getTask(id)!;
    const order: string[] = [];
    const offBoom = __test__.addSettleListener(id, () => {
      order.push('boom');
      throw new Error('first waiter exploded');
    });
    const offSecond = __test__.addSettleListener(id, () => {
      order.push('second');
    });
    __test__.notifySettled(task);
    // 旧实现在调用任何监听者之前就把整个 Set 摘掉,并在循环里没有 try ——
    // 第一个抛错会直接向外抛(把 close/error 处理带崩),第二个等待者永远没人回答。
    expect(order).toContain('second');
    expect(task.notified).toBe(false); // 有一位没送到 ⇒ 整轮投递不算完成
    offBoom();
    offSecond();
  });
});

describe('settleAllInFlight 集合级出口(G-814419)', () => {
  beforeEach(() => {
    clearAllTasks();
  });

  afterEach(() => {
    clearAllTasks();
  });

  it('在飞任务到点未终态 ⇒ unknown 点名,不得报成 settled', async () => {
    const longCmd = isWindows ? 'ping -n 30 127.0.0.1 > nul' : 'sleep 30';
    const handle = runSandboxedAsync(makeCmd(longCmd), { cwd: os.tmpdir(), timeoutMs: 60_000 });
    const id = registerTask(handle.process, longCmd);

    // timeoutMs<=0 ⇒ 一次非阻塞观测:还在跑的就是 unknown,不是 settled
    const poll = await settleAllInFlight(0);
    expect(poll.settled).toBe(0);
    expect(poll.unknown).toEqual([id]);
    expect(poll.gone).toEqual([]);

    // 窗口用尽 ⇒ 同样落 unknown(到点不等于结束)
    const timed = await settleAllInFlight(500);
    expect(timed.settled).toBe(0);
    expect(timed.unknown).toEqual([id]);
    expect(timed.gone).toEqual([]);
    expect(getTask(id)!.status).toBe('running');

    await killTask(id);
  });

  it('全部在飞任务都观察到终态 ⇒ settled 计数对在飞数,unknown/gone 皆空', async () => {
    const h1 = runSandboxedAsync(makeCmd('echo a'), { cwd: os.tmpdir(), timeoutMs: 5000 });
    const id1 = registerTask(h1.process, 'echo a');
    const h2 = runSandboxedAsync(makeCmd('echo b'), { cwd: os.tmpdir(), timeoutMs: 5000 });
    const id2 = registerTask(h2.process, 'echo b');

    const result = await settleAllInFlight(10_000);
    expect(result.unknown).toEqual([]);
    expect(result.gone).toEqual([]);
    expect(result.settled).toBe(2);
    // settled 不许只是"个数对得上",必须真是这两个 id 都落了终态
    expect([getTask(id1)!.status, getTask(id2)!.status]).toEqual(['exited', 'exited']);
  });

  it('没有在飞任务 ⇒ 三个结论全为零(不是"全都结束了")', async () => {
    const result = await settleAllInFlight(1000);
    expect(result).toEqual({ settled: 0, unknown: [], gone: [] });
  });

  it('等待期间记录被清掉 ⇒ 落 gone 一档,与 unknown 可分辨', async () => {
    const longCmd = isWindows ? 'ping -n 30 127.0.0.1 > nul' : 'sleep 30';
    const handle = runSandboxedAsync(makeCmd(longCmd), { cwd: os.tmpdir(), timeoutMs: 60_000 });
    const id = registerTask(handle.process, longCmd);

    const pending = settleAllInFlight(2000);
    await new Promise((r) => setTimeout(r, 100));
    clearAllTasks(); // 等待者被以 null 结掉 ⇒ 记录消失,不是"结束了"
    const result = await pending;

    expect(result.settled).toBe(0);
    expect(result.gone).toEqual([id]);
    expect(result.unknown).toEqual([]);
  });
});

describe('Loop 周期任务', () => {
  beforeEach(() => {
    clearAllTasks();
    clearAllLoops();
  });

  afterEach(() => {
    clearAllLoops();
    clearAllTasks();
  });

  describe('startLoop', () => {
    it('启动 loop 并返回 id', () => {
      const spawn = (): string => 'bg_mock_task_id';
      const result = startLoop({ command: 'echo test', interval: '5s', spawn });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.id).toMatch(/^loop_\d+_/);
        expect(result.intervalMs).toBe(5000);
        // 立即停止清理
        stopLoop(result.id);
      }
    });

    it('首次启动立即执行一次', () => {
      let callCount = 0;
      const spawn = (): string => {
        callCount++;
        return 'bg_mock';
      };
      const result = startLoop({ command: 'echo test', interval: '5s', spawn });
      if (!('error' in result)) {
        expect(callCount).toBe(1);
        stopLoop(result.id);
      }
    });

    it('非法间隔格式报错', () => {
      const spawn = (): string => 'bg_mock';
      const result = startLoop({ command: 'echo test', interval: '5x', spawn });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('非法间隔');
      }
    });

    it('间隔小于 1 秒报错', () => {
      const spawn = (): string => 'bg_mock';
      const result = startLoop({ command: 'echo test', interval: '0s', spawn });
      expect('error' in result).toBe(true);
    });

    it('支持各种时间单位', () => {
      const spawn = (): string => 'bg_mock';
      const cases = [
        { input: '1s', expected: 1000 },
        { input: '5m', expected: 300_000 },
        { input: '2h', expected: 7_200_000 },
        { input: '1d', expected: 86_400_000 },
      ];
      for (const c of cases) {
        const result = startLoop({ command: 'echo test', interval: c.input, spawn });
        expect('error' in result).toBe(false);
        if (!('error' in result)) {
          expect(result.intervalMs).toBe(c.expected);
          stopLoop(result.id);
        }
      }
    });
  });

  describe('listLoops', () => {
    it('空时返回空数组', () => {
      expect(listLoops()).toEqual([]);
    });

    it('返回所有 loop', () => {
      const spawn = (): string => 'bg_mock';
      const r1 = startLoop({ command: 'cmd1', interval: '5s', spawn });
      const r2 = startLoop({ command: 'cmd2', interval: '10s', spawn });
      if (!('error' in r1) && !('error' in r2)) {
        const list = listLoops();
        expect(list).toHaveLength(2);
        stopLoop(r1.id);
        stopLoop(r2.id);
      }
    });

    it('runCount 反映执行次数', async () => {
      let count = 0;
      const spawn = (): string => {
        count++;
        return 'bg_mock';
      };
      const result = startLoop({ command: 'echo test', interval: '1s', spawn });
      if (!('error' in result)) {
        // 首次已执行一次
        expect(count).toBe(1);
        // 等 1.2 秒让第二次执行
        await new Promise((r) => setTimeout(r, 1200));
        const list = listLoops();
        expect(list[0]!.runCount).toBeGreaterThanOrEqual(2);
        stopLoop(result.id);
      }
    });
  });

  describe('stopLoop', () => {
    it('停止 loop 后不再执行', async () => {
      let count = 0;
      const spawn = (): string => {
        count++;
        return 'bg_mock';
      };
      const result = startLoop({ command: 'echo test', interval: '1s', spawn });
      if (!('error' in result)) {
        expect(count).toBe(1);
        stopLoop(result.id);
        const countAfterStop = count;
        await new Promise((r) => setTimeout(r, 1500));
        expect(count).toBe(countAfterStop);
      }
    });

    it('不存在的 loop 返回 false', () => {
      expect(stopLoop('nonexistent')).toBe(false);
    });
  });

  describe('clearAllLoops', () => {
    it('清空所有 loop', () => {
      const spawn = (): string => 'bg_mock';
      startLoop({ command: 'cmd1', interval: '5s', spawn });
      startLoop({ command: 'cmd2', interval: '10s', spawn });
      expect(listLoops()).toHaveLength(2);
      clearAllLoops();
      expect(listLoops()).toEqual([]);
    });
  });
});

// ==================== G-937956 终态通知的顺序化截断 ====================

describe('G-937956 终态通知顺序化截断(上游 notification.ts 机制)', () => {
  it('< 预算的通知逐字不变(预算是安全网,不改变常规形状)', () => {
    const small = formatSettledTaskNotification({
      status: '任务 bg_1  状态: exited  exitCode: 0',
      result: '[stdout]\nhello',
      error: '[stderr]\nwarm',
    });
    expect(small).toBe('任务 bg_1  状态: exited  exitCode: 0\n[stdout]\nhello\n[stderr]\nwarm');
    expect(small.endsWith('[truncated]')).toBe(false);
  });

  it('总长恰为预算(边界)⇒ 不加标记', () => {
    // status(1) + 换行 + 主体,凑到恰好 TASK_NOTIFICATION_MAX_CHARS
    const body = 'x'.repeat(TASK_NOTIFICATION_MAX_CHARS - 2);
    const exact = formatSettledTaskNotification({ status: 's', result: body });
    expect(exact.length).toBe(TASK_NOTIFICATION_MAX_CHARS);
    expect(exact.endsWith('[truncated]')).toBe(false);
    expect(truncateTaskNotification(exact)).toBe(exact);
  });

  it('> 预算:guidance/artifacts 被整段斩、reports 只剩前缘,result/error 与状态行完整,尾部立 [truncated]', () => {
    const status = '任务 bg_1  状态: exited  exitCode: 0'; // 20 段头
    const result = `[stdout]\n${'R'.repeat(60_000)}`; // 正文
    const error = `[stderr]\n${'E'.repeat(40_000)}`; // 正文
    const reports = `<reports>${'p'.repeat(30_000)}</reports>`; // 次之被斩(这里恰好被切在中间)
    const artifacts = `<artifacts>${'a'.repeat(30_000)}</artifacts>`; // 次之被斩
    const guidance = `<guidance>${'g'.repeat(30_000)}</guidance>`; // 先斩

    const notice = formatSettledTaskNotification({ status, result, error, reports, artifacts, guidance });

    // 总预算:从头保留 TASK_NOTIFICATION_MAX_CHARS,尾部立标记
    expect(notice.length).toBe(TASK_NOTIFICATION_MAX_CHARS + '\n[truncated]'.length);
    expect(notice.endsWith('\n[truncated]')).toBe(true);
    // 段序即斩序:正文(result/error)排在前 ⇒ 完整保住
    expect(notice).toContain(status);
    expect(notice).toContain(result);
    expect(notice).toContain(error);
    // 斩序:guidance(最后段)整段消失,artifacts 整段消失,reports 被切在前缘(部分在场)
    expect(notice).not.toContain(guidance);
    expect(notice).not.toContain(artifacts);
    expect(notice).not.toContain(reports);
    // reports 的前缘确实进了通知 —— 证明切点落在 reports 段内(先于 artifacts/guidance)
    expect(notice).toContain('<reports>');
  });

  it('空段(零长度)不产生空行:缺席的节不发(上游 reports/artifacts 同规)', () => {
    const notice = formatSettledTaskNotification({ status: 's', result: '', error: undefined });
    expect(notice).toBe('s');
  });
});

// ==================== G-937958 notified claim 时序 ====================

describe('G-937958 notified claim 时序(读已完成任务不预支 claim)', () => {
  function fakeChild(): ChildProcess {
    return new EventEmitter() as unknown as ChildProcess;
  }

  it('block=false 读已完成任务:claim 不被消耗,投影首程抛错后 output 仍可再取、通知不吞', async () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake settled read');
    const task = getTask(id)!;
    child.emit('close', 0, null); // 终态先落,再做非阻塞读(wait_command 的 block=false 形态)
    expect(task.notified).toBe(false); // close 时无等待者 ⇒ 不消耗 claim(既有判据)

    const first = await waitForTask(id, 0);
    expect(first.state).toBe('settled');
    expect(first.snapshot!.exitCode).toBe(0);
    // 关键判据(上游 task-output.ts:56-66 的机制等价):读已完成任务**不预支 claim** ——
    // 投影发生在拿到快照之后,它抛错不得把"通知已送达"写成事实。
    expect(task.notified).toBe(false);

    // 投影首程抛错(wait_command 拿到快照后的格式化一步失败)
    const projectionFailure = (): string => {
      const snap = first.snapshot!;
      if (snap.status !== 'running') throw new Error('projection exploded');
      return snap.status;
    };
    expect(projectionFailure).toThrow('projection exploded');

    // 通知不吞:再次非阻塞读仍拿到同一份终态(成功路径幂等),output 面也仍在
    const second = await waitForTask(id, 0);
    expect(second.state).toBe('settled');
    expect(second.snapshot!.exitCode).toBe(0);
    expect(getTaskOutput(id)!.status).toBe('exited');
    expect(task.notified).toBe(false);
  });

  it('真事件路径的对照:claim 只由投递消耗,且送达成功后幂等(第二次通知不再投)', async () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake claim via delivery');
    const task = getTask(id)!;
    let notices = 0;
    const off = __test__.addSettleListener(id, () => {
      notices += 1;
    });
    child.emit('close', 0, null);
    expect(notices).toBe(1);
    expect(task.notified).toBe(true);
    // 成功路径第二次幂等:位已立,重放通知不重投
    __test__.notifySettled(task);
    expect(notices).toBe(1);
    off();
  });
});

// ==================== G-937959 输出投影:运行中头窗 / 终态尾窗 ====================

describe('G-937959 输出投影(运行中读头、终态读尾、省略量入账)', () => {
  function fakeChild(): ChildProcess {
    // 与注册表的捕获面同形:process.stdout?.on('data') / stderr 同 —— 流也得是 EventEmitter
    const child = new EventEmitter() as unknown as ChildProcess & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
  }
  const TAIL_CAP = 1024 * 1024;
  const HEAD_CAP = 30_000;

  it('运行中读 ⇒ 含第 1 行;超头窗 ⇒ 带省略前缀且主体 ≤ 头窗上限', () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake running head view');
    child.stdout.emit('data', Buffer.from(`HEAD-MARK first line\n${'x'.repeat(50_000)}`, 'utf-8'));
    const out = getTaskOutput(id)!;
    expect(out.status).toBe('running');
    expect(out.stdout).toContain('HEAD-MARK first line'); // 含第 1 行
    expect(out.stdout.startsWith('[运行中预览:仅保留前 30000 字符')).toBe(true);
    // 主体(去前缀一行)≤ 头窗上限
    const body = out.stdout.slice(out.stdout.indexOf('\n') + 1);
    expect(body.length).toBeLessThanOrEqual(HEAD_CAP);
    expect(out.truncated).toBe(true);
    clearAllTasks();
  });

  it('结束后读 ⇒ 含末尾;超尾窗 ⇒ omitted 前缀且总长 ≤ 尾窗上限+前缀;头部确实被斩', () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake terminal tail view');
    child.stdout.emit('data', Buffer.from(`HEAD-MARK\n${'x'.repeat(50_000)}`, 'utf-8'));
    child.stdout.emit('data', Buffer.from(`${'y'.repeat(TAIL_CAP)}\nTAIL-MARK the end\n`, 'utf-8'));
    child.emit('close', 0, null);
    const task = getTask(id)!;
    const total = task.totalStdoutChars;
    const out = getTaskOutput(id)!;
    expect(out.status).toBe('exited');
    expect(out.stdout).toContain('TAIL-MARK the end'); // 含末尾
    expect(out.stdout).not.toContain('HEAD-MARK'); // 头部已被尾窗挤掉
    expect(out.stdout.startsWith('[1KB of earlier output omitted]') || out.stdout.includes('of earlier output omitted')).toBe(true);
    // 总长 ≤ 尾窗上限 + 前缀一行(上游同形:尾读 ≤ 8MiB,前缀另计)
    const body = out.stdout.slice(out.stdout.indexOf('\n') + 1);
    expect(body.length).toBeLessThanOrEqual(TAIL_CAP);
    // G-816028 记账律不变:dropped = total − 尾窗保留量
    expect(out.droppedStdoutBytes).toBe(total - Math.min(total, TAIL_CAP));
    expect(out.truncated).toBe(true);
    clearAllTasks();
  });

  it('小输出(未越任何窗口)⇒ 无前缀逐字保真,truncated=false、dropped=0', async () => {
    const handle = runSandboxedAsync(makeCmd('echo tiny-view'), { cwd: os.tmpdir(), timeoutMs: 5000 });
    const id = registerTask(handle.process, 'echo tiny-view');
    await waitForTask(id, 5000);
    const out = getTaskOutput(id)!;
    // Windows 上 echo 产出 CRLF:归一后再逐字比对(保真判据不受换行符形态干扰)
    expect(out.stdout.replace(/\r\n/g, '\n')).toBe('tiny-view\n');
    expect(out.stdout.startsWith('[')).toBe(false);
    expect(out.truncated).toBe(false);
    expect(out.droppedStdoutBytes).toBe(0);
  });

  it('读不存在 ⇒ 返回 null(available:false),绝不抛', () => {
    expect(getTaskOutput('no-such-task')).toBeNull();
  });
});

// ==================== G-816002 同一 key 重开(重臂):结算面 / 身份面分域 ====================

/**
 * 票面 G-816002 要求"重臂复位按**结算面/身份面**分域,非重臂重挂载不得复位"。
 * 现读 HEAD(blob `a9756461`,工作区与索引与之逐字相同)的结论是三态里的 **(A)** ——
 * 票面那台"复位机"已被更强的机制取代,字面对象在本文件里不存在:
 *
 *  - **我方没有"重挂载"这条路径**:登记只有两处写 `tasks` —— `registerTask`(源码 499 行)
 *    与 `registerFailedTask`(638 行),两处写的都是**全新对象字面量**(`identity: genIdentity()`
 *    与 `notified: false` 当场新生,见 478-498 / 613-637 行),没有任何字段从上一世带过来;
 *    `id` 由 `genId()` 自造(142-144 行 = `Date.now()` + 3 随机字节),**没有任何入口接受外部
 *    传入的 id** ⇒ 票面①"重臂后旧 `notified` 必须为假"由构造成立;
 *  - 票面②"重臂后 `turnId`/`agentId` 逐字不变"**在我方没有对应物**:本文件的结构里跨世代
 *    逐字保持的只有**对外的 `id` 这枚键**,而**对内代际号 `identity` 必换**(57-59 行的字段注释
 *    明写它"不外传、不进快照、每次登记新生成")。新世的 `command`/`startedAt` 是新世自己的;
 *  - 于是票面③"非重臂重挂载不得复位"改写成它在我方结构上的等价形:**凡是带着"不是在任那一代"
 *    的身份来的收尾,一律整块不动**(逐字段回读 + 不投递 + 不消耗 claim + 计数)。
 *    消费那枚世代号的四处:403-407(投递的代际归属门)、409-411(桶按身份认领)、
 *    1292-1295(`tasks.delete` 的唯一出口)、1309-1318(带身份删除)。
 *
 * 与 `g-654-identity-guarded-removal.test.ts` 的分工:那份锁的是**拒绝档与计数**
 * (以及"两次登记的 identity 必不相同"),本块锁的是**被拒之后新那一世还完整吗** ——
 * 结算面逐字段不动、投递权不被别人家用掉、代际号不外传。同一件事不在两处各算一遍。
 *
 * 变异自证(六发,每发只红它该红的那条,已全部摘除;源码现与 HEAD 逐字相同):
 *  1. `notifySettled` 代际归属门短路(403-407) ⇒ ② 与 ③ 红在"被拒计数"档;
 *  2. 再把桶的身份认领短路(409-411,= 退化成"key 相等就当归属成立"的旧写法) ⇒ ② 与 ③ 红在
 *     "在任那一世的等待者被喂了别人家的快照";
 *  3. 门改成"把在任条目的结算面复位成迟到那一发的结局" ⇒ ③ 红在逐字段回读、② 红在
 *     "claim 被旧世预支 ⇒ 本世再也投不出去"(= 票面点名的第一种失效);
 *  4. `genIdentity()` 恒成一枚 ⇒ ① 红在"代际号必换";
 *  5. `registerFailedTask` 的 `notified` 起在 true ⇒ ① 红在票面① 的字面要求;
 *  6. 代际号外传进对外快照 ⇒ ② 红在 `not.toHaveProperty('identity')`。
 *
 * 台账隔离照 `g-654-identity-guarded-removal.test.ts` 的做法(§26 唯一落点 + `IHUI_HOME` 出口):
 * 本块每一步登记都会写台账,不许落到真实 `~/.ihui`。
 */

/** 结算面(票面点名、且我方真实存在的那一半):终态与结果本身。票面的 `resultText`→`stdoutBuf`、`pid`→`process`。 */
const SETTLEMENT_FACE = [
  'status',
  'exitCode',
  'exitedAt',
  'timedOut',
  'stopInitiator',
  'notified',
  'stdoutBuf',
  'stderrBuf',
  'stdoutHead',
  'stderrHead',
  'totalStdoutChars',
  'totalStderrChars',
  'truncated',
  'droppedStdoutBytes',
  'droppedStderrBytes',
  'process',
] as const;

/** 身份面(我方真实存在的那一半):键与登记自身的属性。票面的 agentId/parentToolCallId/turnId/description **我方无此字段**,故不参与分域。 */
const IDENTITY_FACE = ['id', 'identity', 'command', 'startedAt', 'worktreePath', 'worktreeSourcePath'] as const;

// 编译期半边:"分域"必须是一句有牙齿的话 —— 两域不相交且合起来覆盖 `BackgroundTask` 每一个键。
// 新增字段没归面,下面两行就类型报错,而不是让"逐字段"悄悄变窄。
type FaceGap = Exclude<keyof BackgroundTask, (typeof SETTLEMENT_FACE)[number] | (typeof IDENTITY_FACE)[number]>;
type FacesOverlap = Extract<(typeof SETTLEMENT_FACE)[number], (typeof IDENTITY_FACE)[number]>;
const FACE_COVERAGE: FaceGap extends never ? (FacesOverlap extends never ? true : false) : false = true;

describe('G-816002 同一 key 重开(重臂)的结算面/身份面分域', () => {
  let scratch: string | null = null;
  let previousHome: string | undefined;

  /** 假子进程:注册表对 process 只做四件事(stdout?.on / stderr?.on / on('error') / on('close'))。 */
  function fakeChild(): ChildProcess {
    return new EventEmitter() as unknown as ChildProcess;
  }

  /** 结算面逐字段回读 —— 票面③"一个字段都不许变"只能这样问,判"没抛错"问不出颜色。 */
  function settlementFace(task: BackgroundTask): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of SETTLEMENT_FACE) out[key] = task[key];
    return out;
  }

  /**
   * 重臂场景里"上一世迟到的收尾"载体:**同一枚 key** + 旧的那一枚世代号 + 自己已经落过终态。
   * 我方没有任何入口能把 key 交给第二次登记(见块头),所以这一型沿用文件内既有夹具的写法
   * (`g-654-identity-guarded-removal.test.ts:55-58` 同名同形),投递入口 `__test__.notifySettled`
   * 就是它的真实现场:handlers 携带的正是"登记那一刻抓的活对象"。
   */
  function staleTerminalOf(live: BackgroundTask): BackgroundTask {
    return { ...live, identity: 'gen_previous_life', status: 'lost', exitCode: 9, notified: false };
  }

  beforeEach(() => {
    const dir: string = mkScratch('g816002-'); // §26 唯一落点(夹具模块无类型声明,按 string 取用)
    scratch = dir;
    previousHome = process.env.IHUI_HOME;
    process.env.IHUI_HOME = path.join(dir, 'home');
    clearAllTasks();
    clearAllLoops();
    __test__.setTerminalNoticeSink(null);
  });

  afterEach(() => {
    __test__.setTerminalNoticeSink(null);
    clearAllTasks();
    clearAllLoops();
    if (previousHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = previousHome;
    if (scratch) rmScratch(scratch);
    scratch = null;
  });

  it('字段清单先自证:两域互斥且穷尽(否则下面"逐字段"的判据是空的)', () => {
    expect(FACE_COVERAGE).toBe(true);
    // 归类本身也要能被问出颜色:claim 位在结算面(票面① 要复位的正是它),代际号在身份面(只活在注册表内部)。
    expect(SETTLEMENT_FACE).toContain('notified');
    expect(IDENTITY_FACE).toContain('identity');
    expect(new Set([...SETTLEMENT_FACE, ...IDENTITY_FACE]).size).toBe(
      SETTLEMENT_FACE.length + IDENTITY_FACE.length,
    );
  });

  it('① 新登记的条目从不继承任何结算面(票面①"旧 notified 必须为假"由整枚对象换掉满足)', () => {
    const firstChild = fakeChild();
    const firstId = registerTask(firstChild, 'g816002 上一世');
    const first = getTask(firstId)!;
    __test__.addSettleListener(firstId, () => undefined); // 有当场接得住的等待者,claim 位才会真被消耗
    firstChild.emit('close', 3, null);
    // 先确认上一世确实"脏"了 —— 否则后半段的断言可以靠"本来就没东西"蒙过去
    expect(first.notified).toBe(true);
    expect(first.status).toBe('exited');
    expect(first.exitCode).toBe(3);
    const firstFaceBeforeRearm = settlementFace(first);

    // 重臂的两条真实登记路径都要判:一条生下来在跑,一条生下来就是终态(沙盒预检失败)。
    const runningId = registerTask(fakeChild(), 'g816002 新一世(在跑)');
    const failedId = registerFailedTask('g816002 新一世(生下来即终态)', 'sandbox denied');
    const running = getTask(runningId)!;
    const failed = getTask(failedId)!;
    for (const life of [running, failed]) {
      expect(life.notified).toBe(false); // ← 票面① 的字面要求
      expect(life.exitCode ?? null).not.toBe(3); // 上一世的退出码没有跟过来
      expect(life.exitedAt ?? null).not.toBe(first.exitedAt);
      expect(life.stdoutBuf).toBe('');
      expect(life.totalStdoutChars).toBe(0); // 上一世的产出量(两窗记账的分母)不得跟过来
      expect(life.droppedStdoutBytes).toBe(0);
      expect(life.timedOut).toBe(false);
      expect(life.stopInitiator ?? null).toBeNull(); // 我方无 resultText/pid 位,发起方只有 stopInitiator
    }
    // "生下来就是终态"与"已经投递过"是两件事:位标的是有没有交出去过,不是是不是终态。
    expect(failed.status).toBe('error');
    expect(running.status).toBe('running');
    // 代际号必换(每世一枚),对外的键也各是一枚 —— 复位只发生在"新"这一侧。
    expect(running.identity).not.toBe(first.identity);
    expect(failed.identity).not.toBe(first.identity);
    // 反向半边:新登记不许回头改写上一世已经落定的结算面。
    expect(settlementFace(first)).toEqual(firstFaceBeforeRearm);
  });

  it('② 迟到的上一世代不得替在任那一世把投递权用掉:等待者收到的必须是自己那一世的那一份', () => {
    const child = fakeChild();
    const id = registerTask(child, 'g816002 在任的一世');
    const live = getTask(id)!;
    const received: Array<BackgroundTaskSnapshot | null> = [];
    __test__.addSettleListener(id, (snap) => received.push(snap));
    const notices: string[] = [];
    __test__.setTerminalNoticeSink((notice) => notices.push(notice));
    const rejectedBefore = getRemovalGuardStats().staleTerminalRejected;

    __test__.notifySettled(staleTerminalOf(live)); // 同一枚 key、旧世代号、已经落终态的一发
    expect(received).toEqual([]); // 别人家的快照没喂进来(桶还在,没被整块摘掉)
    expect(getRemovalGuardStats().staleTerminalRejected - rejectedBefore).toBe(1); // 计数只做旁证
    expect(notices).toEqual([]); // 也不许从播报出口漏出去

    child.emit('close', 0, null); // 本世自己的终态
    expect(received.length).toBe(1);
    expect(received[0]!.status).toBe('exited'); // 收到的正是在任这一世
    expect(received[0]!.id).toBe(id); // 跨世代逐字保持的是这枚对外的键
    expect(live.notified).toBe(true); // claim 由本世自己消耗,不是被上一世预支
    expect(received[0]!).not.toHaveProperty('identity'); // 代际号不外传:不进快照
  });

  it('③ 反向锁:非重臂的同 key 收尾一律整块不动(结算面逐字段与调用前等值,条目原位存活)', () => {
    const child = fakeChild();
    const id = registerTask(child, 'g816002 在册条目');
    const live = getTask(id)!;
    const received: Array<BackgroundTaskSnapshot | null> = [];
    __test__.addSettleListener(id, (snap) => received.push(snap));
    const before = settlementFace(live);
    const rejectedBefore = getRemovalGuardStats().staleTerminalRejected;

    // 两型迟到都试:没 claim 过的(若被当成归属成立,它会去喂这一世的桶)与已经 claim 过的
    // (票面① 的载体,若被当成归属成立,它会把这一世的 claim 预支掉)。
    __test__.notifySettled(staleTerminalOf(live));
    __test__.notifySettled({ ...staleTerminalOf(live), status: 'exited', exitCode: null, notified: true });

    expect(settlementFace(live)).toEqual(before); // ← 票面③ 的字面要求:一个字段都不许变
    expect(getTask(id)).toBe(live); // 条目没被换掉、没被摘掉:被拒就是"整块没动"
    expect(received).toEqual([]); // 该代的等待者一口都没被别人家的快照喂到
    expect(live.notified).toBe(false); // 旧世的位不许写到新世头上(claim 不被预支)
    expect(getRemovalGuardStats().staleTerminalRejected - rejectedBefore).toBe(2);

    // 存活证据:本世代随后照常落自己的终态 —— 上面两发是被拒,不是流程坏了
    child.emit('error', new Error('本世 spawn error'));
    expect(live.status).toBe('error');
    expect(received.length).toBe(1);
    expect(received[0]!.status).toBe('error');
    expect(live.notified).toBe(true); // claim 由本世自己(带着当场接得住的等待者)消耗
    // 迟到的第二发终态:单向门拦下,一帧都不许多发、一个字段都不许多写
    child.emit('close', 0, null);
    expect(received.length).toBe(1);
    expect(live.exitCode ?? null).toBeNull(); // error 一支不落退出码:迟到快照不得改写它
  });
});

describe('G-1058645 写账侧世代围栏(ledgerSettle)', () => {
  let scratch: string | null = null;
  let previousHome: string | undefined;

  /** 假子进程(同文件既有夹具同形:注册表对 process 只做 stdout?.on / stderr?.on / on('error') / on('close'))。 */
  function fakeChild(): ChildProcess {
    return new EventEmitter() as unknown as ChildProcess;
  }

  function ledgerText(): string | null {
    try {
      return fs.readFileSync(ledgerFilePath(), 'utf-8');
    } catch {
      return null;
    }
  }

  function lastLineIdentity(): string | undefined {
    const lines = (ledgerText() ?? '').trim().split('\n');
    const last = lines[lines.length - 1];
    if (!last) return undefined;
    return (JSON.parse(last) as { identity?: string }).identity;
  }

  /**
   * 迟到载体:同一枚 key + 旧世代号 + 已落终态(构造论证同 G-816002 块头:key 换代没有
   * 公开入口,handlers 携带的正是登记那一刻抓的活对象)。face 选一支:spawn error 支
   * (status error,不落退出码)与 close 支(status exited,落退出码)。
   */
  function staleTerminalOf(live: BackgroundTask, face: 'spawn-error' | 'close'): BackgroundTask {
    const base: BackgroundTask = { ...live, identity: 'gen_previous_life' };
    if (face === 'spawn-error') return { ...base, status: 'error', exitCode: null };
    return { ...base, status: 'exited', exitCode: 3 };
  }

  beforeEach(() => {
    const dir: string = mkScratch('g1058645-'); // §26 唯一落点;台账隔离走 IHUI_HOME 出口
    scratch = dir;
    previousHome = process.env.IHUI_HOME;
    process.env.IHUI_HOME = path.join(dir, 'home');
    clearAllTasks();
    clearAllLoops();
  });

  afterEach(() => {
    clearAllTasks();
    clearAllLoops();
    if (previousHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = previousHome;
    if (scratch) rmScratch(scratch);
    scratch = null;
  });

  it("『spawn error』支:迟到的旧世代结算不写账 —— 账面一字不动,守卫账计一次", () => {
    const child = fakeChild();
    const id = registerTask(child, 'g1058645 在任的一世');
    const live = getTask(id)!;
    child.emit('close', 0, null); // 本世先正常收尾:台账里有本世的 start + settled
    const before = ledgerText();
    const rejectedBefore = getRemovalGuardStats().staleTerminalRejected;

    __test__.ledgerSettle(staleTerminalOf(live, 'spawn-error'), 'spawn error');

    expect(ledgerText()).toBe(before); // ← 一行都没多:旧世代的迟到结算没写进账
    expect(getRemovalGuardStats().staleTerminalRejected - rejectedBefore).toBe(1);
    // 正向对照:在任那一代自己的结算照写 —— 被拒的是冒名的那一发,不是写账流程坏了
    __test__.ledgerSettle(live, '本世自己的结算(身份匹配,照写)');
    expect(ledgerText()).not.toBe(before);
    expect(lastLineIdentity()).toBe(live.identity);
  });

  it('close 支:同判据 —— 迟到的旧世代 close 不写账,身份匹配的照写', () => {
    const child = fakeChild();
    const id = registerTask(child, 'g1058645 close 支');
    const live = getTask(id)!;
    child.emit('error', new Error('g1058645 spawn error')); // 本世先走 error 支
    const before = ledgerText();
    const rejectedBefore = getRemovalGuardStats().staleTerminalRejected;

    __test__.ledgerSettle(staleTerminalOf(live, 'close'), 'closed by signal SIGTERM');

    expect(ledgerText()).toBe(before);
    expect(getRemovalGuardStats().staleTerminalRejected - rejectedBefore).toBe(1);
    __test__.ledgerSettle(live, '本世自己的结算(身份匹配,照写)');
    expect(ledgerText()).not.toBe(before);
    expect(lastLineIdentity()).toBe(live.identity);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
