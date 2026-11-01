// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 宿主身份核验测试(T12 缺口对撞表 #6 未落地半格,src/hooks/index.ts 2026-11-01 补)。
 *
 * 覆盖四格:核验通过正例 / 判不出 ⇒ 具名拒绝(HOST_IDENTITY_UNVERIFIED)/
 * 宿主进程已死 ⇒ 拒绝(真实子进程 spawn/exit 构造)/ escape env 生效。
 * 进程存活类用例全部用真实子进程构造,不 mock。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  HOOK_HOST_IDENTITY_ERROR,
  HOOK_HOST_PRODUCT_ID,
  HOOK_SKIP_HOST_IDENTITY_ENV,
  onHookRunEvent,
  registerHookHostIdentity,
  runSessionStartHooks,
  __test__,
  type HookRunEvent,
  type HooksConfig,
} from '../src/hooks/index.js';

// 与 hooks-lifecycle.test.ts 同口径:本文件断言的是宿主身份核验行为,
// command 形态的信任门本身由 tests/hooks-trust-gate.test.ts 专门验。
process.env.IHUI_TRUST_WORKSPACE = '1';

const isWindows = process.platform === 'win32';
const exit0 = isWindows ? 'cmd /c exit 0' : "sh -c 'exit 0'";

let markerFile = '';
let markerSeq = 0;

/** 写标记文件命令:钩子若真的执行,磁盘上会多出这个文件(判断"执行了没"的事实依据) */
function markerCommand(): string {
  return isWindows
    ? `cmd /c echo ran>"${markerFile}"`
    : `sh -c 'echo ran > "${markerFile}"'`;
}

function markerWritten(): boolean {
  return fs.existsSync(markerFile);
}

/** 真实子进程:跑完即退,返回其 PID(测试"宿主进程已死"格) */
function spawnShortLived(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, ['-e', 'process.exit(0)'], {
      stdio: 'ignore',
    });
    child.on('exit', () => resolve(child.pid as number));
    child.on('error', reject);
  });
}

/** 真实子进程:常驻(测试"显式登记活着的宿主"正例),用毕必须 kill */
function spawnLongLived(): Promise<{ pid: number; kill: () => void }> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      { stdio: 'ignore' },
    );
    child.on('error', reject);
    setImmediate(() => resolve({ pid: child.pid as number, kill: () => child.kill() }));
  });
}

function configWith(command: string): HooksConfig {
  return { sessionStart: [{ name: 'marker-hook', command, blockOnError: true }] };
}

beforeEach(() => {
  __test__.resetHookHostIdentity();
  markerFile = path.join(os.tmpdir(), `ihui-hook-host-id-${process.pid}-${markerSeq++}.tmp`);
  fs.rmSync(markerFile, { force: true });
});

afterEach(() => {
  fs.rmSync(markerFile, { force: true });
  delete process.env[HOOK_SKIP_HOST_IDENTITY_ENV];
});

describe('宿主身份核验(dispatchHookEntry 单点)', () => {
  it('正例:未显式登记(现网默认形态,自登记基线)⇒ 核验通过,钩子正常派发', async () => {
    const result = await runSessionStartHooks(
      { sessionStart: [{ name: 'ok', command: exit0 }] },
      { workspacePath: '/tmp' },
    );
    expect(result.proceed).toBe(true);
    expect(result.terminal).toBe('succeeded');
  });

  it('正例:显式登记活着的宿主进程 + 匹配产品身份 ⇒ 核验通过', async () => {
    const host = await spawnLongLived();
    try {
      registerHookHostIdentity({ pid: host.pid, productId: HOOK_HOST_PRODUCT_ID });
      const result = await runSessionStartHooks(configWith(exit0), { workspacePath: '/tmp' });
      expect(result.proceed).toBe(true);
      expect(result.terminal).toBe('succeeded');
    } finally {
      host.kill();
    }
  });

  it('判不出 ⇒ 具名拒绝:产品身份不匹配 ⇒ HOST_IDENTITY_UNVERIFIED,钩子未执行', async () => {
    registerHookHostIdentity({ pid: process.pid, productId: 'not-ihui' });
    const result = await runSessionStartHooks(configWith(markerCommand()), { workspacePath: '/tmp' });
    // deny-by-default 拒绝派发,但不改写既有阻断语义(exitCode 0 ⇒ 不阻断,与 skipped 同形)
    expect(result.proceed).toBe(true);
    expect(result.terminal).toBe('skipped');
    expect(result.feedback).toContain(HOOK_HOST_IDENTITY_ERROR);
    expect(result.feedback).toContain('host-product-mismatch');
    expect(markerWritten()).toBe(false);
  });

  it('判不出 ⇒ 具名拒绝:PID 形状非法 ⇒ host-pid-invalid', async () => {
    registerHookHostIdentity({ pid: -1, productId: HOOK_HOST_PRODUCT_ID });
    const result = await runSessionStartHooks(configWith(markerCommand()), { workspacePath: '/tmp' });
    expect(result.terminal).toBe('skipped');
    expect(result.feedback).toContain(HOOK_HOST_IDENTITY_ERROR);
    expect(result.feedback).toContain('host-pid-invalid');
    expect(markerWritten()).toBe(false);
  });

  it('宿主进程已死 ⇒ 具名拒绝 host-process-dead,钩子未执行(真实子进程构造)', async () => {
    const deadPid = await spawnShortLived();
    registerHookHostIdentity({ pid: deadPid, productId: HOOK_HOST_PRODUCT_ID });
    const result = await runSessionStartHooks(configWith(markerCommand()), { workspacePath: '/tmp' });
    expect(result.proceed).toBe(true);
    expect(result.terminal).toBe('skipped');
    expect(result.feedback).toContain(HOOK_HOST_IDENTITY_ERROR);
    expect(result.feedback).toContain('host-process-dead');
    expect(markerWritten()).toBe(false);
  });

  it(`escape env ${HOOK_SKIP_HOST_IDENTITY_ENV}=1 生效:必拒配置下钩子照常执行`, async () => {
    const deadPid = await spawnShortLived();
    registerHookHostIdentity({ pid: deadPid, productId: HOOK_HOST_PRODUCT_ID });
    process.env[HOOK_SKIP_HOST_IDENTITY_ENV] = '1';
    try {
      const result = await runSessionStartHooks(configWith(markerCommand()), { workspacePath: '/tmp' });
      expect(result.terminal).toBe('succeeded');
      expect(markerWritten()).toBe(true);
    } finally {
      delete process.env[HOOK_SKIP_HOST_IDENTITY_ENV];
    }
  });

  it('核验通过后宿主身份 stamp 进钩子子进程 env(IHUI_HOST_PID / IHUI_HOST_PRODUCT)', async () => {
    const echoHost = isWindows
      ? 'cmd /c echo %IHUI_HOST_PID% %IHUI_HOST_PRODUCT%'
      : "sh -c 'echo $IHUI_HOST_PID $IHUI_HOST_PRODUCT'";
    const result = await runSessionStartHooks(
      { sessionStart: [{ name: 'echo-host', command: echoHost }] },
      { workspacePath: '/tmp' },
    );
    expect(result.terminal).toBe('succeeded');
    expect(result.additionalContext).toContain(String(process.pid));
    expect(result.additionalContext).toContain(HOOK_HOST_PRODUCT_ID);
  });

  it('async 条目经同一收口:同样被核验拒绝且未在后台执行', async () => {
    const deadPid = await spawnShortLived();
    registerHookHostIdentity({ pid: deadPid, productId: HOOK_HOST_PRODUCT_ID });
    const config: HooksConfig = {
      sessionStart: [{ name: 'bg', command: markerCommand(), async: true, blockOnError: false }],
    };
    const result = await runSessionStartHooks(config, { workspacePath: '/tmp' });
    await __test__.awaitPendingAsyncHooks();
    // async 转后台 ⇒ 本轮如实记 result_unknown(§30),但钩子本体必须没跑
    expect(result.terminal).toBe('result_unknown');
    expect(markerWritten()).toBe(false);
  });

  it('事件流不变式:拒绝路径 started/terminal 仍成对,终档 Skipped', async () => {
    registerHookHostIdentity({ pid: -1, productId: HOOK_HOST_PRODUCT_ID });
    const events: HookRunEvent[] = [];
    const off = onHookRunEvent((e) => events.push(e));
    try {
      await runSessionStartHooks(configWith(exit0), { workspacePath: '/tmp' });
    } finally {
      off();
    }
    expect(events.filter((e) => e.type === 'started')).toHaveLength(1);
    const terminal = events.find(
      (e): e is Extract<HookRunEvent, { type: 'terminal' }> => e.type === 'terminal',
    );
    expect(terminal?.outcome).toBe('Skipped');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
