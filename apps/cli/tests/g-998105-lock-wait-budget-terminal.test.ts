// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998105(票4,拍板选②)—— 等待预算耗尽不得升级为抢占(镜像锁测试,不改 acquire 判据)。
 *
 * 语义对照上游 zcode-cli core/utils/atomicFileLock.ts createFileLockTimeoutError(:159-174):
 * 上游把"触到 maxWait"当**终态**——只抛带持有者信息的超时错;等待者绝不会在预算耗尽
 * 那一刻变成立即回收者;回收只发生在环内正常轮询且持有者已死(89-158 轮询判活)。
 * 本文件(mcp-oauth.ts acquireLock)同判据,本测试把它钉死为镜像,防被"顺手统一"进
 * scripts/git-lock.mjs acquire 档那套「刻意允许最后时刻抢占」的取舍里。
 *
 * 注入纪律:锁路径走 tmp 目录(不碰真实 ~/.ihui);活持有者用本测试进程自身 pid,
 * 死持有者用"真实派生并已退出"的子进程 pid —— 全程不派生长命进程。
 */
import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn as realSpawn, type ChildProcess } from 'node:child_process';
import { acquireLock, isProcessAlive, McpLockTimeoutError } from '../src/tools/mcp-oauth.js';

interface LockInfoShape {
  pid: number;
  startedAt: number;
  serverUrl?: string;
}

/** 造一个"已确认死亡"的 pid:真实派生立即退出的子进程,并等 isProcessAlive 证伪。 */
async function makeConfirmedDeadPid(): Promise<number> {
  const child: ChildProcess = realSpawn(process.execPath, ['-e', 'process.exit(0)'], {
    stdio: 'ignore',
  });
  const pid = child.pid as number;
  await new Promise<void>((resolve) => child.once('exit', () => resolve()));
  // Windows 上 exit 事件后进程句柄可能还有一瞬未放干净;轮询到判活口确实证伪为止。
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!(await isProcessAlive(pid))) return pid;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`子进程 pid=${pid} 已退出但 10s 内未被 isProcessAlive 证伪(环境异常)`);
}

async function withTmpLock(
  fn: (lockPath: string) => Promise<void>,
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'g-998105-'));
  try {
    await fn(path.join(dir, 'mirror.lock'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('G-998105 等待预算耗尽不得升级为抢占(镜像锁测试)', () => {
  it('活持有者等满预算 ⇒ 终态抛 McpLockTimeoutError,锁文件原样保留(等待者不变回收者)', async () => {
    await withTmpLock(async (lockPath) => {
      // 活持有者 = 本测试进程自身;锁龄拉到 10s(远超任何 stale 档)。
      // 镜像断言点:锁龄再老,只要持有者活着,等待预算耗尽也**不得抢占**。
      const holder: LockInfoShape = {
        pid: process.pid,
        startedAt: Date.now() - 10_000,
        serverUrl: 'https://holder.example',
      };
      await fs.writeFile(lockPath, JSON.stringify(holder), 'utf-8');

      await expect(
        acquireLock('https://waiter.example', { lockPath, timeoutMs: 100 }),
      ).rejects.toBeInstanceOf(McpLockTimeoutError);

      // 锁文件原样:持有者信息未删未改 —— 预算耗尽那一刻没有发生"抢过来"。
      const after = JSON.parse(await fs.readFile(lockPath, 'utf-8')) as LockInfoShape;
      expect(after.pid).toBe(process.pid);
      expect(after.startedAt).toBe(holder.startedAt);
      expect(after.serverUrl).toBe('https://holder.example');
    });
  }, 20_000);

  it('死持有者 ⇒ 回收只发生在环内轮询且经判活证伪:删旧锁并取得锁', async () => {
    await withTmpLock(async (lockPath) => {
      const deadPid = await makeConfirmedDeadPid();
      const staleHolder: LockInfoShape = {
        pid: deadPid,
        startedAt: Date.now() - 60_000, // 超龄残留
        serverUrl: 'https://dead-holder.example',
      };
      await fs.writeFile(lockPath, JSON.stringify(staleHolder), 'utf-8');

      // 预算给足:回收应发生在第一轮轮询(判活证伪 ⇒ unlink ⇒ 下一轮取得)。
      await expect(
        acquireLock('https://waiter.example', { lockPath, timeoutMs: 5_000 }),
      ).resolves.toBeUndefined();

      // 锁内容 = 本进程(新持有者),且持有者切换经由"持有者已死"的判据,不是按龄抢占。
      const now = JSON.parse(await fs.readFile(lockPath, 'utf-8')) as LockInfoShape;
      expect(now.pid).toBe(process.pid);
      expect(now.serverUrl).toBe('https://waiter.example');
    });
  }, 30_000);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
