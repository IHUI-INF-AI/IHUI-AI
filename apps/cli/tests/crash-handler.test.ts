/**
 * crash-handler 单元测试 — 全局未捕获异常处理 / crash log 持久化 / LRU 保留 10 个 / install 幂等。
 * 全程 mock fs(不真实写入 ~/.ihui/crash-logs/),用 process.emit 真实触发事件。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as fsType from 'node:fs';
import * as path from 'node:path';

const state = vi.hoisted(() => ({
  dirExists: true,
  files: [] as string[],
  mtimeByNum: 0,
  pkgContent: '{"version":"1.0.0-test"}',
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof fsType;
  return {
    ...actual,
    existsSync: vi.fn((_p: unknown) => state.dirExists),
    mkdirSync: vi.fn(() => undefined as unknown as string),
    readdirSync: vi.fn(() => state.files as unknown as string[]),
    statSync: vi.fn((p: unknown) => {
      const name = path.basename(String(p));
      const num = Number(name.match(/crash-(\d+)\.log/)?.[1] ?? state.mtimeByNum);
      return { mtimeMs: num } as unknown as fsType.Stats;
    }),
    unlinkSync: vi.fn(() => undefined),
    writeFileSync: vi.fn(() => undefined),
    readFileSync: vi.fn(() => state.pkgContent),
  };
});

import * as fs from 'node:fs';
import { installCrashHandler, uninstallCrashHandler } from '../src/crash-handler.js';

describe('crash-handler', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let initialExitCode: number | undefined;
  let initialUncaughtListeners: Array<(...args: unknown[]) => void>;
  let initialUnhandledListeners: Array<(...args: unknown[]) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    state.dirExists = true;
    state.files = [];
    state.mtimeByNum = 0;
    state.pkgContent = '{"version":"1.0.0-test"}';

    initialUncaughtListeners = process.listeners('uncaughtException') as Array<(...args: unknown[]) => void>;
    initialUnhandledListeners = process.listeners('unhandledRejection') as Array<(...args: unknown[]) => void>;

    uninstallCrashHandler();
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    initialExitCode = process.exitCode;
    process.exitCode = undefined;

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    uninstallCrashHandler();
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    initialUncaughtListeners.forEach((l) => process.on('uncaughtException', l as (...args: unknown[]) => void));
    initialUnhandledListeners.forEach((l) => process.on('unhandledRejection', l as (...args: unknown[]) => void));
    process.exitCode = initialExitCode;
    consoleErrorSpy.mockRestore();
  });

  it('installCrashHandler 幂等:连续两次调用不重复注册监听器', () => {
    const before = process.listenerCount('uncaughtException');
    installCrashHandler();
    const after1 = process.listenerCount('uncaughtException');
    installCrashHandler();
    const after2 = process.listenerCount('uncaughtException');
    expect(after1).toBe(before + 1);
    expect(after2).toBe(after1);
  });

  it('installCrashHandler 注册 uncaughtException + unhandledRejection 监听器', () => {
    const beforeUncaught = process.listenerCount('uncaughtException');
    const beforeUnhandled = process.listenerCount('unhandledRejection');
    installCrashHandler();
    expect(process.listenerCount('uncaughtException')).toBe(beforeUncaught + 1);
    expect(process.listenerCount('unhandledRejection')).toBe(beforeUnhandled + 1);
  });

  it('uninstallCrashHandler 移除监听器(源码用 removeAllListeners,count 归 0)', () => {
    installCrashHandler();
    expect(process.listenerCount('uncaughtException')).toBe(1);
    expect(process.listenerCount('unhandledRejection')).toBe(1);
    uninstallCrashHandler();
    expect(process.listenerCount('uncaughtException')).toBe(0);
    expect(process.listenerCount('unhandledRejection')).toBe(0);
  });

  it('uninstallCrashHandler 未安装时安全(不抛异常)', () => {
    expect(() => uninstallCrashHandler()).not.toThrow();
  });

  it('handleCrash uncaughtException 写 crash log(路径含 crash-logs + crash-<ts>.log)', () => {
    installCrashHandler();
    process.emit('uncaughtException', new Error('test uncaught'));
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const call = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(String(call[0])).toContain('crash-logs');
    expect(String(call[0])).toMatch(/crash-\d+\.log$/);
  });

  it('handleCrash unhandledRejection 写 crash log', () => {
    installCrashHandler();
    process.emit('unhandledRejection', new Error('test rejection'));
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const call = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(String(call[0])).toContain('crash-logs');
    expect(String(call[0])).toMatch(/crash-\d+\.log$/);
  });

  it('handleCrash uncaughtException 设置 process.exitCode = 1', () => {
    installCrashHandler();
    process.emit('uncaughtException', new Error('boom'));
    expect(process.exitCode).toBe(1);
  });

  it('handleCrash unhandledRejection 不设置 exitCode', () => {
    installCrashHandler();
    process.emit('unhandledRejection', new Error('rejected'));
    expect(process.exitCode).toBeUndefined();
  });

  it('crash log LRU prune:保留最近 10 个,删除最旧的 2 个', () => {
    const files = Array.from({ length: 12 }, (_, i) => `crash-${1000 - i}.log`);
    state.files = files;

    installCrashHandler();
    process.emit('uncaughtException', new Error('prune test'));

    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    const unlinked = vi.mocked(fs.unlinkSync).mock.calls.map((c) => path.basename(String(c[0])));
    expect(unlinked).toContain('crash-989.log');
    expect(unlinked).toContain('crash-990.log');
  });

  it('crash log 内容含错误信息(message + stack)', () => {
    installCrashHandler();
    const err = new Error('my error message');
    err.stack = 'Error: my error message\n    at foo:1:1';
    process.emit('uncaughtException', err);
    const content = String(vi.mocked(fs.writeFileSync).mock.calls[0][1]);
    expect(content).toContain('my error message');
    expect(content).toContain('Error: my error message');
    expect(content).toContain('at foo:1:1');
  });

  it('crash log 目录不存在时自动创建(recursive: true)', () => {
    state.dirExists = false;
    installCrashHandler();
    process.emit('uncaughtException', new Error('mkdir test'));
    expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
    const call = vi.mocked(fs.mkdirSync).mock.calls[0];
    expect(String(call[0])).toContain('crash-logs');
    expect(call[1]).toEqual({ recursive: true });
  });

  it('handleCrash 输出友好提示(含 Crash log + GitHub issue 字样)', () => {
    installCrashHandler();
    process.emit('uncaughtException', new Error('friendly'));
    const output = consoleErrorSpy.mock.calls.flat().map(String).join('\n');
    expect(output).toContain('Crash log');
    expect(output).toContain('GitHub issue');
  });
});
