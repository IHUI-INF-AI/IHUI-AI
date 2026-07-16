/**
 * 后台任务注册表 + /loop 测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import {
  registerTask,
  registerFailedTask,
  getTask,
  listTasks,
  getTaskOutput,
  waitForTask,
  killTask,
  clearAllTasks,
  startLoop,
  listLoops,
  stopLoop,
  clearAllLoops,
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
      expect(result!.status).toBe('exited');
    });

    it('超时返回当前状态(running)', async () => {
      // 启动一个长任务
      const longCmd = isWindows ? 'ping -n 10 127.0.0.1 > nul' : 'sleep 10';
      const handle = runSandboxedAsync(makeCmd(longCmd), { cwd: os.tmpdir(), timeoutMs: 30_000 });
      const id = registerTask(handle.process, longCmd);
      const start = Date.now();
      const result = await waitForTask(id, 500);
      expect(Date.now() - start).toBeGreaterThanOrEqual(400);
      expect(result!.status).toBe('running');
      // 清理
      await killTask(id);
    });

    it('不存在返回 null', async () => {
      expect(await waitForTask('nonexistent', 100)).toBeNull();
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
      const finalTask = getTask(id)!;
      expect(['killed', 'exited']).toContain(finalTask.status);
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
