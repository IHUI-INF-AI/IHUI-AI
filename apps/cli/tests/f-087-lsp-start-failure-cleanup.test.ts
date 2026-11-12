// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-087(P1):LSP start() 失败路径必须回收资源。
 *
 * 病灶:initialize 超时 / spawn error 两条失败路径既不 kill 子进程也不 dispose 连接,
 * 下一次 start 覆盖 this.child 后孤儿彻底失去引用;exit 兜底只杀"当前" child。
 * 本文件断言:两条失败路径都 kill 了 child、清了 this.child/this.conn 引用,
 * 且重复 start 不累加 process 'exit' 监听。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as childProcess from 'node:child_process';

// mock child_process.spawn + spawnSync(hoist),用假 LSP server 子进程
vi.mock('node:child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof childProcess;
  return { ...actual, spawn: vi.fn(), spawnSync: vi.fn() };
});

// 与 lsp.test.ts 同:绕过 tools 目录的循环依赖,先完整加载 index.js
vi.mock('../src/tools/git-advanced.js', () => ({ GIT_ADVANCED_TOOLS: [] }));
vi.mock('../src/tools/github-pr.js', () => ({ GITHUB_PR_TOOLS: [] }));
import '../src/tools/index.js';

import { spawn, spawnSync } from 'node:child_process';
import { LspClient, LspUnavailableError } from '../src/tools/lsp.js';
import type { LspServerConfig } from '../src/lsp/language-table.js';

interface FakeChild {
  stdout: PassThrough;
  stdin: PassThrough;
  stderr: PassThrough;
  pid: number;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  killed: boolean;
  kill: ReturnType<typeof vi.fn>;
}

/** 假 language server 子进程:stdout/stdin 用 PassThrough,RAL 可正常挂载 */
function makeFakeChild(): EventEmitter & FakeChild {
  const child = new EventEmitter() as EventEmitter & FakeChild;
  child.stdout = new PassThrough();
  child.stdin = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 43210;
  // killProcessTreeSync 以 exitCode/signalCode === null 判定"仍在生",须显式置 null
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.kill = vi.fn((_signal?: NodeJS.Signals) => {
    child.killed = true;
    return true;
  });
  return child;
}

const config: LspServerConfig = {
  language: 'fake-f087',
  displayName: 'Fake F087 Server',
  fileExtensions: ['.f087'],
  languageIds: { '.f087': 'plaintext' },
  candidates: [
    {
      binary: 'fake-lsp-f087',
      args: ['--stdio'],
      versionArgs: ['--version'],
      installHint: '无需安装:这是测试用假服务器',
      capabilities: ['definition'],
    },
  ],
};

let workspace: string;

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f087-'));
  vi.mocked(spawn).mockReset();
  vi.mocked(spawnSync).mockReset();
  // 让候选探测判定为 ready:where/which 命中 + 版本可测
  vi.mocked(spawnSync).mockImplementation(((cmd: string, args?: string[]) => {
    if (cmd === 'where' || cmd === 'which') {
      return { status: 0, stdout: `C:\\fake\\${args?.[0] ?? ''}`, stderr: '' };
    }
    return { status: 0, stdout: '1.2.3', stderr: '' };
  }) as never);
});

afterEach(() => {
  vi.mocked(spawn).mockReset();
  vi.mocked(spawnSync).mockReset();
  fs.rmSync(workspace, { recursive: true, force: true });
});

describe('F-087 LSP start 失败路径资源回收', () => {
  it('initialize 超时 → kill child + 清 this.child/this.conn + 摘掉 exit 监听', async () => {
    const baselineListeners = process.listenerCount('exit');
    const child = makeFakeChild(); // 永远不回 initialize
    vi.mocked(spawn).mockImplementation((() => child) as never);

    const client = new LspClient(workspace, config);
    const err = await client.ensureStarted().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(LspUnavailableError);
    expect((err as LspUnavailableError).kind).toBe('init-timeout');

    // ① 进程被 kill(killProcessTreeSync → child.kill('SIGKILL'))
    expect(child.kill).toHaveBeenCalled();
    // ② 引用已清:下一次 start 不会覆盖成一个失去引用的孤儿
    expect((client as unknown as { child?: unknown }).child).toBeUndefined();
    // ③ 连接已 dispose(引用被清,旧连接不会继续写 diagnostics)
    expect((client as unknown as { conn?: unknown }).conn).toBeUndefined();
    // ④ process 'exit' 监听回到基线
    expect(process.listenerCount('exit')).toBe(baselineListeners);
  }, 30_000);

  it('spawn error → kill child + 清引用;重复 start 不累加 exit 监听', async () => {
    const baselineListeners = process.listenerCount('exit');
    const children: Array<EventEmitter & FakeChild> = [];
    vi.mocked(spawn).mockImplementation((() => {
      const child = makeFakeChild();
      children.push(child);
      setImmediate(() => child.emit('error', new Error('spawn fake-lsp-f087 ENOENT')));
      return child;
    }) as never);

    const client = new LspClient(workspace, config);

    for (let attempt = 0; attempt < 2; attempt++) {
      const err = await client.ensureStarted().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LspUnavailableError);
      expect((err as LspUnavailableError).kind).toBe('spawn-failed');

      expect(children[attempt]!.kill).toHaveBeenCalled();
      expect((client as unknown as { child?: unknown }).child).toBeUndefined();
      expect((client as unknown as { conn?: unknown }).conn).toBeUndefined();
      expect(process.listenerCount('exit')).toBe(baselineListeners);
    }

    // 两次失败各自起了一个新 child(旧的已回收,不是复用同一个悬空句柄)
    expect(children).toHaveLength(2);
  });
});
