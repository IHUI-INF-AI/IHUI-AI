// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-013 回归:非 TTY(CI/管道)下 `ihui login` 无参数不得进 inquirer。
 *
 * 缺陷形态:login.ts 直接 `await inquirer.prompt(...)`,没有 first-run 那样的
 * `!process.stdin.isTTY` 判定 ⇒ 管道里抛错(叠加 F-002 后退出码 0)或挂死。
 * 修法:非 TTY 且缺显式凭据时 usage + exit 2,且不调用 prompt。
 *
 * 反向牙:摘掉守卫 ⇒ 第 1 例 prompt 被调用/exitCode 非 2 翻红。
 * 不进真实网络与凭据存储:fetch 一律 mock,失败分支不落盘。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
// vi.mock 工厂被提升,共享 mock 实例必须走 vi.hoisted。
const { promptMock } = vi.hoisted(() => ({
  promptMock: vi.fn<(questions: unknown) => Promise<Record<string, string>>>(),
}));
vi.mock('inquirer', () => ({ default: { prompt: promptMock } }));

import { Command } from 'commander';
import { runLogin, registerLoginCommand } from '../src/commands/login.js';

function setStdinTTY(v: boolean | undefined): void {
  Object.defineProperty(process.stdin, 'isTTY', { value: v, configurable: true });
}

const savedExitCode = process.exitCode;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  promptMock.mockReset();
  process.exitCode = savedExitCode;
  setStdinTTY(undefined);
});

function captureStderr(): () => string {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(' '));
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  return () => lines.join('\n');
}

describe('F-013 非 TTY 下 login 不得进 inquirer', () => {
  it('管道 stdin + 无参数:2 秒内结束、exitCode 2、stderr 给 usage、不调 prompt', async () => {
    setStdinTTY(undefined);
    promptMock.mockRejectedValue(new Error('F-013:非 TTY 不应调用 inquirer.prompt'));
    const stderr = captureStderr();
    process.exitCode = undefined;

    const started = Date.now();
    const ok = await runLogin({});
    const elapsed = Date.now() - started;

    expect(ok).toBe(false);
    expect(elapsed).toBeLessThan(2000);
    expect(promptMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    const text = stderr();
    expect(text).toContain('--account');
    expect(text).toContain('--password');
  });

  it('CLI action 不把用法错误的 2 覆盖成 1(F-002 叠加面)', async () => {
    setStdinTTY(undefined);
    promptMock.mockRejectedValue(new Error('F-013:非 TTY 不应调用 inquirer.prompt'));
    captureStderr();
    process.exitCode = undefined;

    const program = new Command();
    registerLoginCommand(program);
    const started = Date.now();
    await program.parseAsync(['node', 'ihui', 'login']);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(2000);
    expect(promptMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it('显式 --account/--password 不被守卫拦(走到网络请求)', async () => {
    setStdinTTY(undefined);
    const fetchMock = vi.fn().mockRejectedValue(new Error('mock network down'));
    vi.stubGlobal('fetch', fetchMock);
    captureStderr();
    process.exitCode = undefined;

    const ok = await runLogin({
      account: 'ci-user',
      password: 'ci-secret',
      apiUrl: 'https://example.invalid',
    });

    expect(ok).toBe(false);
    expect(promptMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://example.invalid/api/auth/login');
    expect(process.exitCode).not.toBe(2);
  });

  it('TTY 交互流程不变:仍逐个询问账号与密码', async () => {
    setStdinTTY(true);
    promptMock
      .mockResolvedValueOnce({ account: '  tty-user  ' })
      .mockResolvedValueOnce({ password: 'tty-secret' });
    const fetchMock = vi.fn().mockRejectedValue(new Error('mock network down'));
    vi.stubGlobal('fetch', fetchMock);
    captureStderr();
    process.exitCode = undefined;

    const ok = await runLogin({ apiUrl: 'https://example.invalid' });

    expect(ok).toBe(false);
    expect(promptMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as { body: string }).body));
    expect(body).toEqual({ account: 'tty-user', password: 'tty-secret' });
  });
});
