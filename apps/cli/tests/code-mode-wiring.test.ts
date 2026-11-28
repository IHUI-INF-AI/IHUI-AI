// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

const { setupAgentTools } = await import('../src/commands/agent.js')
const { executeToolCall } = await import('../src/tools/index.js');

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

  it('read-only 放行真实 LSP 成员并保留检索开口', async () => {
    const r = await build('read-only')
    // 白名单此前写的是族名 `lsp`,注册表里没有这个名字,整族被静默挡掉。
    expect(r.systemPrompt).toContain('lsp_goto_definition')
    expect(r.systemPrompt).toContain('tool_search')
  })

  it('no-shell 时终端族 / git 族 / 调试期启动都不在面上', async () => {
    const r = await build('no-shell')
    expect(r.systemPrompt).not.toContain('terminal_open')
    expect(r.systemPrompt).not.toContain('terminal_exec_sandboxed')
    expect(r.systemPrompt).not.toContain('git_merge')
    expect(r.systemPrompt).not.toContain('debug_launch')
  })

  it('read-only 的执行面也拒绝写/命令(不只是提示面裁掉)', async () => {
    const r = await build('read-only')
    const write = await executeToolCall({ name: 'write_file', arguments: { path: 'blocked.txt', content: 'x' } }, r.ctx)
    expect(write.success).toBe(false)
    expect(write.errorType).toBe('permission_denied')
    expect(write.error).toContain('当前能力模式')
    // 结构化归因:与 rule-deny 分开,出路必须是"换模式"而不是改启动参数。
    expect(write.denial?.gate).toBe('code-mode')
    expect(write.denial?.decider).toBe('mode-deny')
    expect(write.denial?.guidance).toContain('capability profile')
    // 包装名先归一成注册名,再被同一道闸挡下。
    const wrapped = await executeToolCall({ name: 'functions.write_file', arguments: { path: 'blocked.txt', content: 'x' } }, r.ctx)
    expect(wrapped.success).toBe(false)
    const shell = await executeToolCall({ name: 'run_command', arguments: { command: 'echo hi' } }, r.ctx)
    expect(shell.success).toBe(false)
    // 白名单内的读类照常执行(证明不是一刀切)。
    const glob = await executeToolCall({ name: 'glob', arguments: { pattern: '*' } }, r.ctx)
    expect(glob.success).toBe(true)
  })

  it('no-shell 的执行面拒绝命令,但放行写文件', async () => {
    const r = await build('no-shell')
    const shell = await executeToolCall({ name: 'run_command', arguments: { command: 'echo hi' } }, r.ctx)
    expect(shell.success).toBe(false)
    expect(shell.errorType).toBe('permission_denied')
    const write = await executeToolCall({ name: 'write_file', arguments: { path: 'ok.txt', content: 'ok' } }, r.ctx)
    expect(write.success).toBe(true)
    expect(fs.existsSync(path.join(dir, 'ok.txt'))).toBe(true)
  })

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
