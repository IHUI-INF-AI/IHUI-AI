// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-121 回归钉:`playground compare` 全部模型失败时,--json 分支也必须退非零。
 * 语义保持"个别失败仍算成功"(票面只要求全失败),部分成功不得被误判为失败。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import type * as AuthRefreshModule from '../src/lib/auth-refresh.js';
import type * as TokenManagerModule from '../src/commands/token-manager.js';

const h = vi.hoisted(() => ({
  fetchCli: vi.fn(),
  failing: new Set<string>(),
}));

vi.mock('../src/lib/auth-refresh.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthRefreshModule>();
  return { ...actual, fetchWithCliAuthRefresh: h.fetchCli };
});

// 根命令不要再声明 --api-key:commander 会让父子同名选项互相遮蔽,子命令的显式 key 会丢。
// JWT 由 token-manager 的 mock 提供,只管放行到 comparePlayground。
vi.mock('../src/commands/token-manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof TokenManagerModule>();
  return {
    ...actual,
    ensureFreshAccessToken: vi.fn(async () => 'jwt-test'),
    missingTokenHint: () => 'missing-token',
  };
});

import { registerPlaygroundCommand } from '../src/commands/developer.js';

let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.exitCode = undefined;
  h.failing.clear();
  h.fetchCli.mockReset();
  h.fetchCli.mockImplementation(async (_url: string, init?: RequestInit) => {
    const model = String(JSON.parse(String(init?.body ?? '{}')).model ?? '');
    if (h.failing.has(model)) {
      return new Response(JSON.stringify({ message: `boom:${model}` }), {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }
    return new Response(
      JSON.stringify({
        model,
        choices: [{ message: { role: 'assistant', content: `ok:${model}` } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200 },
    );
  });
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
  process.exitCode = undefined;
});

async function runCompare(models: string, json = true): Promise<void> {
  const program = new Command();
  program.option('--api-url <u>');
  registerPlaygroundCommand(program);
  const argv = [
    '--api-url',
    'http://test.local',
    'playground',
    'compare',
    '--prompt',
    'hi',
    '--models',
    models,
    '--api-key',
    'key-test',
  ];
  if (json) argv.push('--json');
  await program.parseAsync(argv, { from: 'user' });
}

function lastJson(): Array<{ model: string; error: string | null }> {
  const raw = infoSpy.mock.calls.at(-1)?.[0];
  return JSON.parse(String(raw)) as Array<{ model: string; error: string | null }>;
}

describe('F-121 playground compare 失败退出码', () => {
  it('全部失败 + --json ⇒ exitCode 1', async () => {
    h.failing.add('model-a');
    h.failing.add('model-b');

    await runCompare('model-a,model-b');

    expect(process.exitCode).toBe(1);
    const results = lastJson();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.error !== null)).toBe(true);
  });

  it('部分成功 + --json ⇒ 不退非零(个别失败由正文点名)', async () => {
    h.failing.add('model-b');

    await runCompare('model-a,model-b');

    expect(process.exitCode).toBeUndefined();
    const results = lastJson();
    expect(results[0]?.error).toBeNull();
    expect(results[1]?.error).not.toBeNull();
  });

  it('全部失败 + 人读输出 ⇒ exitCode 1', async () => {
    h.failing.add('model-a');
    h.failing.add('model-b');

    await runCompare('model-a,model-b', false);

    expect(process.exitCode).toBe(1);
  });

  it('全部成功 + --json ⇒ 不退非零', async () => {
    await runCompare('model-a,model-b');

    expect(process.exitCode).toBeUndefined();
    expect(lastJson().every((r) => r.error === null)).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
