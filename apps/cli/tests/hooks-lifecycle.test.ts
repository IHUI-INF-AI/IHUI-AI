/**
 * Hooks 生命周期(sessionStart/sessionEnd)测试
 */
import { describe, it, expect } from 'vitest';
import {
  runSessionStartHooks,
  runSessionEndHooks,
  type HooksConfig,
} from '../src/hooks/index.js';

const isWindows = process.platform === 'win32';
const exit0 = isWindows ? 'cmd /c exit 0' : "sh -c 'exit 0'";
const exit1 = isWindows ? 'cmd /c exit 1' : "sh -c 'exit 1'";
const longCmd = isWindows ? 'cmd /c ping -n 10 127.0.0.1' : "sh -c 'sleep 10'";
const medCmd = isWindows ? 'cmd /c ping -n 4 127.0.0.1' : "sh -c 'sleep 3'";

describe('runSessionStartHooks', () => {
  it('config 为 null 时返回 proceed=true 且无 reason', () => {
    const result = runSessionStartHooks(null, { workspacePath: '/tmp' });
    expect(result.proceed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('config.sessionStart 为空数组时返回 proceed=true', () => {
    const config: HooksConfig = { sessionStart: [] };
    const result = runSessionStartHooks(config, { workspacePath: '/tmp' });
    expect(result.proceed).toBe(true);
  });

  it('config.sessionStart 为 undefined 时返回 proceed=true', () => {
    const config: HooksConfig = { preToolCall: [] };
    const result = runSessionStartHooks(config, { workspacePath: '/tmp' });
    expect(result.proceed).toBe(true);
  });

  it('单个 hook 成功(command 退出 0)时返回 proceed=true', () => {
    const config: HooksConfig = {
      sessionStart: [{ name: 'ok', command: exit0 }],
    };
    const result = runSessionStartHooks(config, { workspacePath: '/tmp' });
    expect(result.proceed).toBe(true);
  });

  it('单个 hook 失败(command 退出非 0)时返回 proceed=false 且 reason 含钩子名', () => {
    const config: HooksConfig = {
      sessionStart: [{ name: 'fail-hook', command: exit1 }],
    };
    const result = runSessionStartHooks(config, { workspacePath: '/tmp' });
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('fail-hook');
  });

  it('多个 hook 第一个失败时不执行第二个', () => {
    const config: HooksConfig = {
      sessionStart: [
        { name: 'first-fail', command: exit1 },
        { name: 'slow', command: medCmd },
      ],
    };
    const start = Date.now();
    const result = runSessionStartHooks(config, { workspacePath: '/tmp' });
    const elapsed = Date.now() - start;
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('first-fail');
    expect(elapsed).toBeLessThan(2000);
  });

  it('多个 hook 全部成功时返回 proceed=true', () => {
    const config: HooksConfig = {
      sessionStart: [
        { name: 'ok1', command: exit0 },
        { name: 'ok2', command: exit0 },
      ],
    };
    const result = runSessionStartHooks(config, { workspacePath: '/tmp' });
    expect(result.proceed).toBe(true);
  });

  it('HookEntry 含 timeout 字段时正确传递(超时杀掉长命令)', () => {
    const config: HooksConfig = {
      sessionStart: [{ name: 'slow', command: longCmd, timeout: 300 }],
    };
    const start = Date.now();
    const result = runSessionStartHooks(config, { workspacePath: '/tmp' });
    const elapsed = Date.now() - start;
    expect(result.proceed).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('runSessionEndHooks', () => {
  it('config 为 null 时不报错', () => {
    expect(() => runSessionEndHooks(null, { workspacePath: '/tmp' })).not.toThrow();
  });

  it('单个 hook 失败时不抛出异常(sessionEnd 失败不阻塞退出)', () => {
    const config: HooksConfig = {
      sessionEnd: [{ name: 'fail', command: exit1 }],
    };
    expect(() => runSessionEndHooks(config, { workspacePath: '/tmp' })).not.toThrow();
  });

  it('多个 hook 全部失败时不抛出异常', () => {
    const config: HooksConfig = {
      sessionEnd: [
        { name: 'fail1', command: exit1 },
        { name: 'fail2', command: exit1 },
        { name: 'fail3', command: 'nonexistent-command-xyz-12345' },
      ],
    };
    expect(() => runSessionEndHooks(config, { workspacePath: '/tmp' })).not.toThrow();
  });
});
