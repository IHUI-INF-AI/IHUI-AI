// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-015 回归钉:`ihui serve --check-credential` 写完 stdout 后不得硬切进程。
 *
 * 缺陷形态:check 分支把检查结果写进 stdout 后立刻 `process.exit(...)`,管道(agent / CI
 * 读取方)尚未 flush 就被切断 —— 机器读到半截或空输出,退出码却像是"检查完成"。
 * 修法:改用 `process.exitCode`,让事件循环自然排空。
 *
 * 本文件主体走**行为验证**(不是源码钉):serve 命令可经 `registerServeCommand` 挂到临时
 * Command 上,用 `--check-credential` 走完 check 分支即 return,全程不启动 server、不绑端口。
 * 断言点是"函数返回后 process.exit 未被调用 + process.exitCode 已被设置"。
 *
 * 只有两处退化为源码钉,标题里都写明了原因:
 *   ① 信号关停(SIGINT→130 / SIGTERM→143)必须先真启动 server 才能观测到,本文件刻意不绑端口;
 *   ② check 分支"不得再有裸 process.exit"的结构约束(行为面只能看到"这次没被调到",
 *      看不到这段代码里是否还留着一条只在特定分支才走的硬切)。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import type * as SettingsModule from '../src/commands/settings.js';

const h = vi.hoisted(() => ({
  resolveEffectiveConfig: vi.fn(),
}));

// 只替换"读盘 + 合并"的那两个出口:settings.json 是用户手写的,它里面有没有 apiKey /
// apiSecret / serve.requireApiSecret 会让退出码判定漂移 ⇒ 必须钉成确定性来源。
vi.mock('../src/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SettingsModule>();
  return {
    ...actual,
    loadSettings: () => ({}),
    resolveEffectiveConfig: h.resolveEffectiveConfig,
  };
});

import { registerServeCommand } from '../src/commands/serve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVE_SRC = readFileSync(join(HERE, '..', 'src', 'commands', 'serve.ts'), 'utf-8');

/** 这些环境变量会改变凭据预检的输入,测试期间一律清空并在结束后还原。 */
const ENV_KEYS = [
  'IHUI_API_KEY',
  'IHUI_API_SECRET',
  'IHUI_SERVE_REQUIRE_API_SECRET',
  'IHUI_CREDENTIAL_KIND',
] as const;

let savedEnv: Record<string, string | undefined> = {};
let exitCodes: Array<number | undefined> = [];
let stdoutWrites: string[] = [];
let exitSpy: { mockRestore: () => void };
let writeSpy: { mockRestore: () => void };

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.exitCode = undefined;
  exitCodes = [];
  stdoutWrites = [];
  h.resolveEffectiveConfig.mockImplementation(
    (args: { cliApiUrl?: string; cliApiKey?: string; cliApiSecret?: string; cliCredentialKind?: string }) => ({
      apiUrl: args.cliApiUrl ?? 'http://test.local',
      apiKey: args.cliApiKey ?? '',
      apiSecret: args.cliApiSecret ?? '',
      credentialKind: args.cliCredentialKind ?? 'auto',
    }),
  );
  // 不真退出:只记录调用,这样"老代码硬切"会以 exitCodes 非空的形式翻红。
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCodes.push(code);
  }) as any);
  writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    stdoutWrites.push(String(chunk));
    return true;
  }) as any);
});

afterEach(() => {
  exitSpy.mockRestore();
  writeSpy.mockRestore();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  process.exitCode = undefined;
});

async function runServeCheck(args: string[]): Promise<void> {
  const program = new Command();
  registerServeCommand(program);
  await program.parseAsync(['serve', '--check-credential', '--json', ...args], { from: 'user' });
}

function credentialCheckEvents(): Array<{ type: string; ok: boolean; errorCode?: string }> {
  const events: Array<{ type: string; ok: boolean; errorCode?: string }> = [];
  for (const raw of stdoutWrites) {
    try {
      const parsed = JSON.parse(raw) as { type?: unknown };
      if (parsed.type === 'credential-check') {
        events.push(parsed as { type: string; ok: boolean; errorCode?: string });
      }
    } catch {
      // 非 JSON 行(人读输出)不参与判定
    }
  }
  return events;
}

describe('F-015 行为钉:check 分支靠 exitCode 收尾,不硬切进程', () => {
  it('凭据可用 ⇒ 返回后 process.exit 未被调用,且 exitCode=0', async () => {
    await runServeCheck(['--api-key', 'ihui_f015_live_key', '--api-secret', 'sk_f015_live_secret']);

    expect(exitCodes).toEqual([]);
    expect(process.exitCode).toBe(0);

    const events = credentialCheckEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.ok).toBe(true);
  });

  it('凭据缺 secret ⇒ process.exit 未被调用,exitCode=1(管道下能读到完整结果)', async () => {
    await runServeCheck(['--api-key', 'ihui_f015_live_key']);

    expect(exitCodes).toEqual([]);
    expect(process.exitCode).toBe(1);

    const events = credentialCheckEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.ok).toBe(false);
    expect(events[0]?.errorCode).toBe('SECRET_REQUIRED');
  });
});

describe('F-015 源码钉(行为测需真启 server 或不可观测,故只钉形状)', () => {
  it('信号关停按 130/143 设 exitCode [源码钉:观测它必须先真启动 server 绑端口]', () => {
    expect(SERVE_SRC).toMatch(/if\s*\(\s*signal === 'SIGINT'\s*\)\s*process\.exitCode = 130/);
    expect(SERVE_SRC).toMatch(/if\s*\(\s*signal === 'SIGTERM'\s*\)\s*process\.exitCode = 143/);
    expect(SERVE_SRC).toMatch(/process\.on\('SIGINT'\s*,\s*\(\)\s*=>\s*void shutdown\('SIGINT'\)\)/);
    expect(SERVE_SRC).toMatch(/process\.on\('SIGTERM'\s*,\s*\(\)\s*=>\s*void shutdown\('SIGTERM'\)\)/);
  });

  it('check 分支只设 exitCode,分支内不得再出现裸 process.exit( [源码钉:结构约束]', () => {
    const start = SERVE_SRC.indexOf('if (opts.checkCredential === true) {');
    const end = SERVE_SRC.indexOf('if (!check.ok && check.errorCode)', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const branch = SERVE_SRC.slice(start, end);
    expect(branch).toMatch(/process\.exitCode\s*=\s*check\.ok\s*\?\s*0\s*:\s*1/);
    expect(branch).not.toMatch(/process\.exit\s*\(/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
