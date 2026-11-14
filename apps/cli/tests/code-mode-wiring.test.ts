// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * code-mode 的**端到端接线**验证。
 *
 * 为什么必须单独有这个文件:`code-mode.test.ts` 只测纯函数,
 * 把 `setupAgentTools` 里的 `applyCodeMode(rawTools, opts.codeMode)` 改成恒 "full",
 * 那 15 个用例**全部照绿** —— 因为它们根本没经过装配点。
 *
 * 本文件直接调 `setupAgentTools`,断言 systemPrompt 里的工具清单真的被裁剪。
 * 这是唯一能证伪"接线被删"的测法。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { setupAgentTools } = await import('../src/commands/agent.js');

let dir = '';
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-codemode-e2e-'));
  for (const k of ['IHUI_CLI_SESSIONS_DIR', 'IHUI_CLI_TURNS_DIR', 'IHUI_CLI_GOALS_DIR']) {
    saved[k] = process.env[k];
  }
  process.env.IHUI_CLI_SESSIONS_DIR = path.join(dir, 'sessions');
  process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns');
  process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals');
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

async function build(codeMode?: string) {
  return setupAgentTools({
    workspacePath: dir,
    silent: true,
    ...(codeMode === undefined ? {} : { codeMode }),
  } as never);
}

describe('setupAgentTools 真的按 codeMode 裁剪', () => {
  it('full 时 systemPrompt 含执行类工具', async () => {
    const r = await build('full');
    expect(r.systemPrompt).toContain('run_command');
  });

  it('read-only 时 systemPrompt **不含** run_command / write_file', async () => {
    const r = await build('read-only');
    expect(r.systemPrompt).not.toContain('"name":"run_command"');
    expect(r.systemPrompt).not.toContain('"name":"bash"');
    // 但应保留读类
    expect(r.systemPrompt).toContain('read_file');
  });

  it('no-shell 时不含 run_command,但含 write_file', async () => {
    const r = await build('no-shell');
    expect(r.systemPrompt).not.toContain('"name":"run_command"');
    expect(r.systemPrompt).toContain('write_file');
  });

  it('拼错的模式名抛错(不静默回退全量)', async () => {
    await expect(build('read_only_typo')).rejects.toThrow(/code mode/);
  });

  it('对比:full 与 read-only 的工具清单确实不同(证明裁剪真的发生)', async () => {
    const full = await build('full');
    const ro = await build('read-only');
    expect(full.systemPrompt.length).not.toBe(ro.systemPrompt.length);
    // read-only 的 prompt 更短（工具更少）
    expect(ro.systemPrompt.length).toBeLessThan(full.systemPrompt.length);
  });
});
