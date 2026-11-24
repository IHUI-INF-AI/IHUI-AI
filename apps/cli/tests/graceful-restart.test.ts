// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-05 优雅自重启契约。
 *
 * ① 更新交接只有 apply 才允许排重启；
 * ② 有在飞任务只 wait，任务清空才 restart；
 * ③ spawn 成功才 exit(0)，spawn 失败保留待重启态；
 * ④ 重启预算/标记消费可量，防重启风暴。
 */

import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import {
  consumeRestartMarker,
  MAX_RESTART_ATTEMPTS,
  RESTART_ENV,
  RestartCoordinator,
  restartEligibleFromUpdate,
  type RestartDeps,
} from '../src/daemon/graceful-restart.js';

const APPLY = {
  disposition: 'apply' as const,
  action: 'apply' as const,
  reason: 'hash-match' as const,
};

function fakeDeps(): {
  deps: RestartDeps;
  calls: Array<{ command: string; args: readonly string[]; options: Record<string, unknown> }>;
  exits: number[];
} {
  const calls: Array<{ command: string; args: readonly string[]; options: Record<string, unknown> }> = [];
  const exits: number[] = [];
  return {
    calls,
    exits,
    deps: {
      execPath: 'C:/ihui/node.exe',
      argv: ['cli.js', 'agent'],
      env: {},
      spawn: (command, args, options) => {
        calls.push({ command, args, options: options as Record<string, unknown> });
        return { pid: 999 };
      },
      exit: (code) => exits.push(code),
    },
  };
}

describe('A 更新交接准入', () => {
  it('apply 才 eligible', () => {
    expect(restartEligibleFromUpdate(APPLY)).toEqual({
      eligible: true,
      reason: 'update-handoff-applied',
    });
    expect(
      restartEligibleFromUpdate({
        disposition: 'refused',
        action: 'stay',
        reason: 'hash-mismatch',
      }),
    ).toEqual({ eligible: false, reason: 'update-handoff-refused-hash-mismatch' });
    expect(
      restartEligibleFromUpdate({
        disposition: 'unjudged',
        action: 'stay',
        reason: 'verify-unmeasured',
      }),
    ).toEqual({ eligible: false, reason: 'update-handoff-unjudged-verify-unmeasured' });
  });

  it('不 eligible 的更新计划不排重启', () => {
    const c = new RestartCoordinator();
    expect(
      c.requestAfterUpdate({
        disposition: 'refused',
        action: 'stay',
        reason: 'timed-out',
      }),
    ).toBe(false);
    expect(c.peek()).toBeNull();
  });
});

describe('B 任务排空', () => {
  it('有在飞任务只 wait，不拉新进程', async () => {
    const c = new RestartCoordinator();
    c.requestAfterUpdate(APPLY, '1.2.3');
    const fake = fakeDeps();
    const result = await c.begin(2, fake.deps);
    expect(result.action).toBe('waiting');
    expect(fake.calls).toHaveLength(0);
    expect(fake.exits).toHaveLength(0);
    expect(c.peek()?.version).toBe('1.2.3');
  });

  it('任务清空后 spawn 新进程并退出旧进程', async () => {
    const c = new RestartCoordinator();
    c.requestAfterUpdate(APPLY, '1.2.3');
    const fake = fakeDeps();
    const result = await c.begin(0, fake.deps);
    expect(result.action).toBe('spawned');
    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0];
    expect(call.command).toBe('C:/ihui/node.exe');
    expect(call.args).toEqual(['cli.js', 'agent']);
    expect(call.options.detached).toBe(true);
    expect(call.options.windowsHide).toBe(true);
    expect(call.options.stdio).toBe('ignore');
    const env = call.options.env as NodeJS.ProcessEnv;
    expect(env[RESTART_ENV.attempt]).toBe('1');
    expect(env[RESTART_ENV.reason]).toBe('update-applied');
    expect(env[RESTART_ENV.fromPid]).toBe(String(process.pid));
    expect(fake.exits).toEqual([0]);
    expect(c.peek()).toBeNull();
  });

  it('spawn 失败保留待重启态、不退出', async () => {
    const c = new RestartCoordinator();
    c.request('manual');
    const fake = fakeDeps();
    fake.deps.spawn = () => {
      throw new Error('spawn EPERM');
    };
    const result = await c.begin(0, fake.deps);
    expect(result.action).toBe('failed');
    expect(result.detail).toContain('spawn EPERM');
    expect(fake.exits).toHaveLength(0);
    expect(c.peek()?.reason).toBe('manual');
  });

  it('异步 spawn error 也不退出旧进程', async () => {
    const c = new RestartCoordinator();
    c.request('manual');
    const fake = fakeDeps();
    fake.deps.spawn = () => {
      const child = new EventEmitter();
      setTimeout(() => child.emit('error', new Error('spawn ENOENT')), 0);
      return child;
    };
    const result = await c.begin(0, fake.deps);
    expect(result.action).toBe('failed');
    expect(result.detail).toContain('spawn ENOENT');
    expect(fake.exits).toHaveLength(0);
    expect(c.peek()?.reason).toBe('manual');
  });
});

describe('C 幂等与预算', () => {
  it('同原因同版本重复排只留一条', () => {
    const c = new RestartCoordinator();
    expect(c.request('update-applied', '1.0.0')).toBe(true);
    expect(c.request('update-applied', '1.0.0')).toBe(false);
    expect(c.request('update-applied', '2.0.0')).toBe(false);
    expect(c.peek()?.version).toBe('1.0.0');
  });

  it('重启预算用尽即 refused，不再 spawn', async () => {
    const c = new RestartCoordinator();
    c.request('manual');
    const fake = fakeDeps();
    fake.deps.env = { [RESTART_ENV.attempt]: String(MAX_RESTART_ATTEMPTS) };
    const result = await c.begin(0, fake.deps);
    expect(result.action).toBe('refused');
    expect(fake.calls).toHaveLength(0);
    expect(fake.exits).toHaveLength(0);
  });

  it('consumeRestartMarker 读完即删，预算键保留', () => {
    const env: NodeJS.ProcessEnv = {
      [RESTART_ENV.fromPid]: '123',
      [RESTART_ENV.reason]: 'update-applied',
      [RESTART_ENV.attempt]: '1',
    };
    const marker = consumeRestartMarker(env);
    expect(marker?.reason).toBe('update-applied');
    expect(env[RESTART_ENV.fromPid]).toBeUndefined();
    expect(env[RESTART_ENV.reason]).toBeUndefined();
    expect(env[RESTART_ENV.attempt]).toBe('1');
    expect(consumeRestartMarker(env)).toBeNull();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
