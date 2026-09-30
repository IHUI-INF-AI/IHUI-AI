// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * G-998130(票1)—— force 只打"已验证目标集",身份核不上时禁止沿裸 PID 杀进程树。
 *
 * 判据(上游 processTreeOwnership.ts:66-96,122-129 / processTreeTerminator.ts:51,
 * 59-61,190-197,260-301,439-460):
 *   (a) root 已被观察到退出 + 现测创建标识≠生前记录 ⇒ 不派生任何 taskkill/kill、
 *       返回 { childStillOwned:false } 语义;
 *   (b) 复核仍匹配 ⇒ 只对该目标集派生 /F;
 *   (c) 反向装车证明(临时件已现跑留档):现行实现喂夹具 (a) 必然派生 taskkill。
 *
 * 注入纪律:身份复核口/force 派生口/平台判定全部可注入,除标注"真机实测"的一例
 * 外不派生任何真实进程。POSIX 分支断言走注入 probe —— **本机(Windows)不可真机验证**,
 * 只钉注入形态,不得视为 POSIX 真机已证。
 */
import { describe, expect, it, vi } from 'vitest';
import { spawn as realSpawn } from 'node:child_process';
import * as os from 'node:os';
import type { ChildProcess } from 'node:child_process';
import {
  captureRootCreationIdentity,
  killProcessTree,
  killProcessTreeVerified,
} from '../src/util/spawn-isolated.js';

type SpawnFn = (command: string, args?: readonly string[], options?: Record<string, unknown>) => ChildProcess;
type ChildProcessModuleSurface = { spawn: SpawnFn; [key: string]: unknown };

const { spawnRecords } = vi.hoisted(() => ({ spawnRecords: [] as { command: string; args: string[] }[] }));

/** 记账 + 转发:断言"未派生任何 taskkill"用;真实派生照旧(本文件只有真机例会走到) */
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<ChildProcessModuleSurface>();
  const recordingSpawn: SpawnFn = (command, args, options) => {
    spawnRecords.push({ command, args: args ? Array.from(args) : [] });
    return actual.spawn(command, args, options);
  };
  return { ...actual, spawn: recordingSpawn };
});

const makeChild = (opts: {
  pid?: number | null;
  exitCode?: number | null;
  signalCode?: string | null;
  kill?: (signal?: string) => boolean;
}): ChildProcess =>
  ({
    pid: opts.pid !== undefined ? opts.pid : 424240,
    exitCode: opts.exitCode !== undefined ? opts.exitCode : null,
    signalCode: opts.signalCode !== undefined ? opts.signalCode : null,
    kill: opts.kill ?? (() => true),
    stdio: [null, null, null],
  }) as unknown as ChildProcess;

const noTaskkillSpawned = (): void => {
  expect(spawnRecords.filter((r) => r.command === 'taskkill')).toEqual([]);
};

describe('G-998130 killProcessTreeVerified:force 只打已验证目标集(注入 fake child + 假身份复核口)', () => {
  it('票1(a) root 已观察到退出且现测创建标识≠生前记录 ⇒ 不派生任何 taskkill/kill,childStillOwned:false', async () => {
    const derive = vi.fn();
    const kill = vi.fn(() => true);
    const out = await killProcessTreeVerified(makeChild({ pid: 424240, exitCode: 0, kill }), {
      preMortemCreationIdentity: '20260930100000.000000+480',
      queryCreationIdentity: async () => '19970101000000.000000+480',
      deriveForceKill: derive,
      platform: () => 'win32',
    });
    expect(out.childStillOwned).toBe(false);
    expect(out.action).toBe('skipped-already-exited');
    expect(derive).not.toHaveBeenCalled();
    expect(kill).not.toHaveBeenCalled();
    noTaskkillSpawned();
  });

  it('未退出但现测创建标识≠生前记录 ⇒ 原 PID 已复用:目标集为空,childStillOwned:false,不派生', async () => {
    const derive = vi.fn();
    const kill = vi.fn(() => true);
    const out = await killProcessTreeVerified(makeChild({ pid: 424240, kill }), {
      preMortemCreationIdentity: '20260930100000.000000+480',
      queryCreationIdentity: async () => '19970101000000.000000+480',
      deriveForceKill: derive,
      platform: () => 'win32',
    });
    expect(out.childStillOwned).toBe(false);
    expect(out.action).toBe('identity-mismatch-target-set-empty');
    expect(derive).not.toHaveBeenCalled();
    expect(kill).not.toHaveBeenCalled();
    noTaskkillSpawned();
  });

  it('票1(b) 复核仍匹配 ⇒ 只对该已验证目标集派生恰好一次 /F', async () => {
    const derive = vi.fn();
    const kill = vi.fn(() => true);
    const out = await killProcessTreeVerified(makeChild({ pid: 424240, kill }), {
      preMortemCreationIdentity: '20260930100000.000000+480',
      queryCreationIdentity: async () => '20260930100000.000000+480',
      deriveForceKill: derive,
      platform: () => 'win32',
    });
    expect(out.childStillOwned).toBe(true);
    expect(out.action).toBe('force-kill-derived');
    expect(derive).toHaveBeenCalledTimes(1);
    expect(derive).toHaveBeenCalledWith(424240);
    expect(kill).not.toHaveBeenCalled();
  });

  it('无生前固定 root 身份(deps/登记表均缺位)⇒ unverifiedRootOnly:只观察,不派生', async () => {
    const derive = vi.fn();
    const out = await killProcessTreeVerified(makeChild({ pid: 424240 }), {
      queryCreationIdentity: async () => 'whatever',
      deriveForceKill: derive,
      platform: () => 'win32',
    });
    expect(out.childStillOwned).toBe(true);
    expect(out.action).toBe('unverified-root-only');
    expect(derive).not.toHaveBeenCalled();
    noTaskkillSpawned();
  });

  it('身份查询整体失败(现测取不到 / 抛错 / 超 750ms 预算)⇒ 一律 unverifiedRootOnly,不派生', async () => {
    const derive = vi.fn();
    for (const queryCreationIdentity of [
      async () => null,
      async (): Promise<string | null> => {
        throw new Error('cim down');
      },
      () => new Promise<string | null>(() => {}), // 永不落定 ⇒ 预算耗尽
    ]) {
      const out = await killProcessTreeVerified(makeChild({ pid: 424240 }), {
        preMortemCreationIdentity: '20260930100000.000000+480',
        queryCreationIdentity,
        deriveForceKill: derive,
        platform: () => 'win32',
        recheckBudgetMs: 30,
      });
      expect(out.childStillOwned).toBe(true);
      expect(out.action).toBe('unverified-root-only');
    }
    expect(derive).not.toHaveBeenCalled();
    noTaskkillSpawned();
  });

  it('POSIX 分支(注入 probe,本机不可真机验证):创建标识仍匹配 ⇒ 组信号派生一次;不匹配 ⇒ 零信号', async () => {
    const derive = vi.fn();
    const matched = await killProcessTreeVerified(makeChild({ pid: 424240 }), {
      preMortemCreationIdentity: 'linux-starttick:1234567',
      queryCreationIdentity: async () => 'linux-starttick:1234567',
      deriveForceKill: derive,
      platform: () => 'linux',
    });
    expect(matched.childStillOwned).toBe(true);
    expect(matched.action).toBe('force-kill-derived');
    expect(derive).toHaveBeenCalledTimes(1);
    const mismatched = await killProcessTreeVerified(makeChild({ pid: 424240 }), {
      preMortemCreationIdentity: 'linux-starttick:1234567',
      queryCreationIdentity: async () => 'linux-starttick:9999999',
      deriveForceKill: derive,
      platform: () => 'linux',
    });
    expect(mismatched.childStillOwned).toBe(false);
    expect(mismatched.action).toBe('identity-mismatch-target-set-empty');
    expect(derive).toHaveBeenCalledTimes(1); // 仍只有匹配那一次
  });

  it('生前快照登记表:captureRootCreationIdentity 成功 ⇒ 无显式 deps 也能对账通过', async () => {
    const child = makeChild({ pid: 424240 });
    const identity = await captureRootCreationIdentity(child, async () => '20260930100000.000000+480');
    expect(identity).toBe('20260930100000.000000+480');
    const derive = vi.fn();
    const out = await killProcessTreeVerified(child, {
      queryCreationIdentity: async () => '20260930100000.000000+480',
      deriveForceKill: derive,
      platform: () => 'win32',
    });
    expect(out.action).toBe('force-kill-derived');
    expect(derive).toHaveBeenCalledTimes(1);
  });

  it('killProcessTree(现行同步出口)对已观察到退出的 child 直接空转:零派生、零 child.kill', () => {
    const kill = vi.fn(() => true);
    expect(() => killProcessTree(makeChild({ pid: 424244, exitCode: 1, kill }))).not.toThrow();
    expect(() => killProcessTree(makeChild({ pid: 424244, signalCode: 'SIGTERM', kill }))).not.toThrow();
    expect(kill).not.toHaveBeenCalled();
    noTaskkillSpawned();
  });
});

describe('G-998130 win32 真机实测(本机 Windows,可全量验证)', () => {
  const itWin32 = os.platform() === 'win32' ? it : it.skip;

  itWin32('真进程:生前快照 → CIM 复核匹配 → taskkill /T /F 派生且目标真退;退出后复核 ⇒ 空目标集', async () => {
    const child = realSpawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    expect(child.pid).toBeTruthy();
    // 生前快照(真实 CIM,数百 ms)
    const identity = await captureRootCreationIdentity(child);
    expect(identity).toBeTruthy();
    // 复核仍匹配 ⇒ 派生真 taskkill(杀的是本用例自己的子进程)。
    // 预算显式放宽到 5s:默认 750ms 是上游 force 轮的预留值,本机 PowerShell 单次
    // CIM 查询实测 ~800ms(冷 793ms/热 835ms),低于该地板的机器一律 fail closed
    // (unverifiedRootOnly)——这正是判据的保守方向,不私改票面常量。
    const out = await killProcessTreeVerified(child, { recheckBudgetMs: 5_000 });
    expect(out.action).toBe('force-kill-derived');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    // 退出后再复核 ⇒ 已观察到退出,空目标集,零派生
    const after = await killProcessTreeVerified(child);
    expect(after.childStillOwned).toBe(false);
    expect(after.action).toBe('skipped-already-exited');
  }, 15_000);
});
