// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 宿主唤醒接线(2026-10-31 第二笔):setHookRewakeQueue 从"零调用方"变成 REPL 宿主真调用。
//
// 本册钉两格:
//  ① 形状锁 —— commands/repl.ts 必须 import 并调用 `setHookRewakeQueue(state.promptQueue)`
//     (取的是**会话自己那枚** PromptQueue,不是另造一份);"造好没装车"= 没有(§0.9)。
//  ② 行为锁 —— 按宿主姿势接线后,一条 async + blockOnError:false 的 exit 2 钩子
//     **恰好唤醒一次**:真 PromptQueue 的 snapshot 长度 = 1、kind = 'task-notification'、
//     再 drain 一轮长度不涨(claim 语义归 hooks 层,本册只量结果,不复算判据,§22c)。
//  ③ 反向锁 —— 未接线时不入队(落 stderr 审计 + droppedNoQueue),撤线同样成立;
//     非 exit 2 的 async 钩子在任何接线形态下都不叫醒模型。
// 本文件**不 mock** hooks 层:测的就是生产链本身(async 收口 → emitHookRewake → enqueue)。
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  runPostToolCall,
  setHookRewakeQueue,
  getHookRewakeStats,
  awaitPendingAsyncHooks,
  __test__,
} from '../src/hooks/index.js';
import { PromptQueue } from '../src/prompt-queue.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..');

// —— ① 形状锁:宿主接线在位,且接的是会话那枚队列 ——
const replSrc = fs.readFileSync(path.join(here, '../src/commands/repl.ts'), 'utf-8');

const nodeEval = (code: string): string => `"${process.execPath}" -e "${code.replace(/"/g, '')}"`;
const exit2Cmd = nodeEval('process.exit(2)');
const exit1Cmd = nodeEval("process.stderr.write('not-exit-2');process.exit(1)");

const TMP = fs.mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'hook-host-rewake-'));
const CONFIG = path.join(TMP, 'hooks.json');

let uniq = 0;

let origConfig: string | undefined;
let origTrust: string | undefined;
let origHome: string | undefined;
let fakeHome: string | null = null;
let stderrLines: string[] = [];
let origWrite: typeof process.stderr.write;

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  origHome = process.env.HOME;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
  // 夹具落在仓库里 ⇒ 来源判 'project';走既有的非交互放行出口(与 hook-async-rewake 同姿势)
  process.env.IHUI_TRUST_WORKSPACE = '1';
  if (process.platform !== 'win32') {
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-home-'));
    process.env.HOME = fakeHome;
  }
});

afterAll(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (fakeHome) fs.rmSync(fakeHome, { recursive: true, force: true });
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  fs.rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  stderrLines = [];
  origWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
    return true;
  }) as typeof process.stderr.write;
  __test__.resetHookRewakeState();
});

afterEach(async () => {
  await awaitPendingAsyncHooks(8000);
  process.stderr.write = origWrite;
  __test__.resetHookRewakeState();
});

function writeAsyncHook(extra: Record<string, unknown>): void {
  fs.writeFileSync(
    CONFIG,
    JSON.stringify({
      postToolCall: [
        {
          name: `hr-${++uniq}`,
          command: extra['command'],
          async: true,
          blockOnError: false,
          ...extra,
        },
      ],
    }),
    'utf-8',
  );
}

describe('① 形状锁:REPL 宿主把会话那份 PromptQueue 交给 hooks 层', () => {
  it('repl.ts import 了 setHookRewakeQueue(与 hooks 层同源)', () => {
    expect(replSrc).toMatch(
      /import\s*\{[^}]*setHookRewakeQueue[^}]*\}\s*from\s*'\.\.\/hooks\/index\.js'/,
    );
  });

  it('repl.ts 调用的是 setHookRewakeQueue(state.promptQueue) —— 接线对象是会话那枚队列', () => {
    expect(replSrc).toContain('setHookRewakeQueue(state.promptQueue)');
  });

  it('接线行位于 startREPL 的 state 构造之后、会话批钩子派发之前(接线先于任何可能转后台的钩子)', () => {
    const wireIdx = replSrc.indexOf('setHookRewakeQueue(state.promptQueue)');
    const stateIdx = replSrc.indexOf('promptQueue: new PromptQueue()');
    const startHooksIdx = replSrc.indexOf('runSessionStartHooks(');
    expect(stateIdx).toBeGreaterThanOrEqual(0);
    expect(wireIdx).toBeGreaterThan(stateIdx);
    expect(startHooksIdx).toBeGreaterThan(wireIdx);
  });
});

describe('② 行为锁:宿主接线后 async exit 2 → 队列 snapshot 恰好 1 条', () => {
  it('一条 exit2 恰好唤醒一次;再 drain 一轮不涨(claim 语义在 hooks 层)', async () => {
    // 宿主姿势:拿**本轮会话的**队列实例接线(与 repl.ts 那一行同形)
    const q = new PromptQueue();
    setHookRewakeQueue(q);
    writeAsyncHook({ command: exit2Cmd, rewakeSummary: 'host-wired-rewake-once' });

    const r = await runPostToolCall('bash', { ok: 1 });
    expect(r.proceed).toBe(true);
    const settled = await awaitPendingAsyncHooks(8000);
    expect(settled.settled).toBe(true);

    const items = q.snapshot();
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('task-notification');
    expect(items[0]?.prompt).toContain('host-wired-rewake-once');
    expect(getHookRewakeStats()).toEqual({ enqueued: 1, droppedNoQueue: 0, rejected: 0 });

    // 只醒一次:第二次 drain 后队列与计数都不许动
    await awaitPendingAsyncHooks(1000);
    expect(q.snapshot()).toHaveLength(1);
    expect(getHookRewakeStats().enqueued).toBe(1);
  });

  it('宿主撤线(setHookRewakeQueue(null))后回到未接线形态:不入队、不静默丢', async () => {
    const q = new PromptQueue();
    setHookRewakeQueue(q);
    setHookRewakeQueue(null);
    writeAsyncHook({ command: exit2Cmd });

    await runPostToolCall('bash', {});
    await awaitPendingAsyncHooks(8000);
    expect(q.snapshot()).toHaveLength(0);
    expect(getHookRewakeStats()).toEqual({ enqueued: 0, droppedNoQueue: 1, rejected: 0 });
    expect(stderrLines.join('')).toContain('rewake NOT enqueued');
  });
});

describe('③ 反向锁:非 exit 2 的 async 钩子接线后也不唤醒模型', () => {
  it('exit 1 ⇒ 队列 0 条,只有 stderr 审计行', async () => {
    const q = new PromptQueue();
    setHookRewakeQueue(q);
    writeAsyncHook({ command: exit1Cmd });

    await runPostToolCall('bash', {});
    await awaitPendingAsyncHooks(8000);
    expect(q.snapshot()).toHaveLength(0);
    expect(getHookRewakeStats().enqueued).toBe(0);
    expect(stderrLines.join('')).toContain('model NOT rewoken');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
