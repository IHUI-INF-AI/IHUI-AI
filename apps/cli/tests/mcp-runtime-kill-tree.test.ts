// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-690 —— MCP stdio 子进程的**进程树回收接线**对账。
 *
 * 判的两型:
 *  ① `disconnectMcpServer` 走 `killProcessTree`(Unix 打进程组 / Windows `taskkill /T`),
 *     而不是 `conn.process.kill()` —— 后者只杀得掉 npx/cmd 那层壳,壳派生的 node 永留;
 *  ② spawn 侧的分档在位(Unix `detached: true` 才有进程组可打;Windows 刻意不 detached,
 *     因为它没有进程组概念,detached 只会多分配一个控制台窗口)。
 *
 * 为什么单独立一个文件:这条用例要把 `killProcessTree` 换成 spy 才能断言"走的是它"。
 * `vi.mock` 是模块级的,放进 `mcp-runtime.test.ts` 会让那边所有用例失去真实回收能力
 * (留下一堆活子进程)⇒ 这里 mock 的替身在**记完一笔之后照旧真杀**,用例之间不留活口。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { connectMcpServer, disconnectMcpConnection, callMcpServer } from '../src/tools/mcp-runtime.js';
import { fakeMcpServer, isPidAlive } from './helpers/fake-mcp-server.js';

type SpawnRecord = { command: string; args: string[]; options: Record<string, unknown> };

/**
 * 只声明本用例要转发的那一个成员。
 * (刻意**不写** `typeof import('node:child_process')` —— 本仓 eslint `consistent-type-imports`
 * 禁类型位的内联 `import()`;而手抄一份完整模块类型又会与真实模块漂开,所以只取用到的那一格。)
 */
type SpawnFn = (command: string, args?: readonly string[], options?: Record<string, unknown>) => ChildProcess;
type ChildProcessModuleSurface = { spawn: SpawnFn; [key: string]: unknown };
type SpawnIsolatedModuleSurface = {
  killProcessTree: (child: ChildProcess) => void;
  [key: string]: unknown;
};

const { killTreeSpy, spawnRecords } = vi.hoisted(() => ({
  killTreeSpy: vi.fn(),
  spawnRecords: [] as SpawnRecord[],
}));

/** 记录 spawn 的选项(判 ②),但**照旧派生真进程**(判 ① 需要真实进程树) */
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<ChildProcessModuleSurface>();
  const recordingSpawn: SpawnFn = (command, args, options) => {
    spawnRecords.push({ command, args: args ? Array.from(args) : [], options: { ...options } });
    return actual.spawn(command, args, options);
  };
  return { ...actual, spawn: recordingSpawn };
});

/** spy + 转发:先记账,再跑那一份**真实**的进程树回收(否则用例之间留活口) */
vi.mock('../src/util/spawn-isolated.js', async (importOriginal) => {
  const actual = await importOriginal<SpawnIsolatedModuleSurface>();
  const spyingKill = (child: ChildProcess): void => {
    killTreeSpy(child);
    actual.killProcessTree(child);
  };
  return { ...actual, killProcessTree: spyingKill };
});

async function waitForExit(child: ChildProcess, timeoutMs = 8_000): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once('close', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function waitUntilGone(pid: number, timeoutMs = 8_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isPidAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !isPidAlive(pid);
}

describe('G-690 进程树回收接线(killProcessTree,而不是 process.kill)', () => {
  // 替身是模块级的:vitest 的 retry 与同文件后续用例都会让它继续累计 ⇒ 逐用例清零,
  // 否则 "toHaveBeenCalledTimes(1)" 判的是"整个文件跑了几次",不是"这次断连走没走它"
  beforeEach(() => {
    killTreeSpy.mockClear();
    spawnRecords.length = 0;
  });

  it('断连调用 killProcessTree 且**没有**走 child.kill();子进程确实退出', async () => {
    const conn = await connectMcpServer(fakeMcpServer('ok'));
    const child = conn.process;
    if (!child) throw new Error('stdio 连接没带上子进程(夹具失效)');
    expect(child.killed).toBe(false);

    disconnectMcpConnection(conn);

    expect(killTreeSpy).toHaveBeenCalledTimes(1);
    expect(killTreeSpy.mock.calls[0]?.[0]).toBe(child);
    // 反向锁:换成进程树回收之后,`conn.process.kill()` 那一条**一次都没被走过**
    // (ChildProcess.killed 只由 child.kill() 置真)
    expect(child.killed).toBe(false);
    expect(await waitForExit(child)).toBe(true);
  });

  it('spawn 分档在位:Windows 不 detached(靠 taskkill /T)、Unix detached(才有进程组可打),两档都带 windowsHide', async () => {
    const conn = await connectMcpServer(fakeMcpServer('ok'));
    const child = conn.process;
    disconnectMcpConnection(conn);
    if (child) await waitForExit(child);

    const record = spawnRecords.find((r) => r.command === process.execPath && r.args.includes('ok'));
    expect(record).toBeDefined();
    expect(record?.options['windowsHide']).toBe(true);
    expect(record?.options['detached']).toBe(process.platform !== 'win32');
  });

  it('断连后查不到残留**孙**进程(旧写法只杀壳,node 子进程永留)', async () => {
    const conn = await connectMcpServer(fakeMcpServer('withChild'));
    const child = conn.process;
    if (!child) throw new Error('stdio 连接没带上子进程(夹具失效)');

    const out = (await callMcpServer(conn, 'tools/call', { name: 'echo', arguments: {} })) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const raw = out?.content?.[0]?.text;
    if (typeof raw !== 'string') throw new Error('夹具没回孙进程 pid');
    const grandchildPid = Number(raw.slice('grandchild:'.length));
    expect(Number.isFinite(grandchildPid)).toBe(true);
    // 阳性对照:孙进程此刻**真的在**(否则这条用例只是在证明"没东西可杀")
    expect(isPidAlive(grandchildPid)).toBe(true);

    disconnectMcpConnection(conn);
    expect(killTreeSpy).toHaveBeenCalledTimes(1);
    expect(await waitForExit(child)).toBe(true);

    // 本票的落点:整棵树回收 —— 壳没了,派生的也没了
    expect(await waitUntilGone(grandchildPid)).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
