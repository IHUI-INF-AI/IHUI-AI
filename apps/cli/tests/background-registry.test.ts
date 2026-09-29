// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务注册表 + /loop 测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
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
  startLoop,
  listLoops,
  stopLoop,
  clearAllLoops,
  __test__,
} from '../src/tools/background-registry.js';
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
