// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级 Task Workspace 集成测试。
 *
 * 这里不测“宿主能不能 clone”，那条已在 tool-host-client 覆盖。
 * 这里测的是：**同一份 workspacePath 指向副本时，Agent 的文件工具到底写到哪里**。
 * 只有文件工具、命令工具、检查点都看到同一个副本，任务结束时 publish 回源，才
 * 算真正解决了“命令写副本、文件工具读源”的假一致。
 *
 * 用 mock streamChat 产生一个真实 `write_file` 工具调用，不碰外部模型。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type * as ApiClient from '@ihui/api-client';
import { CheckpointManager } from '../src/checkpoints/index.js';
import {
  abandonTaskOnToolHost,
  prepareTaskOnToolHost,
  publishTaskOnToolHost,
  shutdownToolHost,
} from '../src/sandbox/tool-host.js';
import { runAgent } from '../src/commands/agent.js';

type StreamChatOpts = {
  model: string;
  messages: unknown[];
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  onError?: (err: string) => void;
  onDone?: () => void;
};

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<(opts: StreamChatOpts) => Promise<void>>(),
}));

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    streamChat: streamChatMock,
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
    formatSSEError: (err: unknown) => ({
      severity: 'unknown' as const,
      title: 'error',
      message: err instanceof Error ? err.message : String(err),
      rawMessage: err instanceof Error ? err.message : String(err),
      requireReauth: false,
    }),
  };
});

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

const host =
  process.env.IHUI_TOOL_HOST_EXE ??
  join(process.cwd(), '../desktop/src-tauri/resources/tool-host/ihui-tool-host.exe');
const enabled = process.platform === 'win32' && existsSync(host);
const suite = enabled ? describe : describe.skip;

suite('会话级 Task Workspace', () => {
  const oldHostExe = process.env.IHUI_TOOL_HOST_EXE;

  beforeAll(() => {
    process.env.IHUI_TOOL_HOST_EXE = host;
  });

  afterAll(() => {
    shutdownToolHost();
    if (oldHostExe === undefined) delete process.env.IHUI_TOOL_HOST_EXE;
    else process.env.IHUI_TOOL_HOST_EXE = oldHostExe;
  });

  it('Agent 文件工具写副本，publish 才落到源工作区', async () => {
    const source = mkdtempSync(join(tmpdir(), 'ihui-session-task-'));
    const taskId = `session-task-${process.pid}`;
    let taskRoot: string | null = null;
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: source });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: source });
      execFileSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: source });
      writeFileSync(join(source, 'existing.txt'), 'source-before\n');
      execFileSync('git', ['add', 'existing.txt'], { cwd: source });
      execFileSync('git', ['commit', '--quiet', '-m', 'init'], { cwd: source });

      const prep = await prepareTaskOnToolHost(source, taskId, [source]);
      expect(typeof prep.root).toBe('string');
      taskRoot = String(prep.root);

      // 关键：Agent 看到的 workspacePath 就是副本根；文件工具、检查点全部跟着它。
      const checkpoints = new CheckpointManager({
        sessionId: 'session-task-test',
        workspacePath: taskRoot,
      });
      streamChatMock
        .mockImplementationOnce(async (opts) => {
          opts.onDelta(
            '```tool_call\n{"name":"write_file","arguments":{"path":"agent-stage.txt","content":"from-stage\\n"}}\n```',
          );
        })
        .mockImplementationOnce(async (opts) => {
          opts.onDelta('完成');
        });

      const result = await runAgent({
        prompt: '写一个文件',
        modelId: 'test-model',
        workspacePath: taskRoot,
        workspaceRoots: [source],
        taskWorkspaceId: taskId,
        apiUrl: 'http://test.invalid',
        maxIterations: 3,
        jsonMode: true,
        headlessOneShot: true,
        allowDangerous: true,
        checkpoints,
      });

      expect(result.stopReason).toBe('end_turn');
      expect(existsSync(join(taskRoot, 'agent-stage.txt'))).toBe(true);
      expect(existsSync(join(source, 'agent-stage.txt'))).toBe(false);

      const published = await publishTaskOnToolHost(taskId);
      expect(published.changedFiles).toBe(1);
      expect(readFileSync(join(source, 'agent-stage.txt'), 'utf8')).toContain('from-stage');
    } finally {
      await abandonTaskOnToolHost(taskId).catch(() => {});
      rmSync(source, { recursive: true, force: true });
    }
  });

  it('任务副本里的 run_command 默认走宿主 AppContainer，写副本后再 publish', async () => {
    const source = mkdtempSync(join(tmpdir(), 'ihui-session-command-'));
    const taskId = `session-command-${process.pid}`;
    let taskRoot: string | null = null;
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: source });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: source });
      execFileSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: source });
      writeFileSync(join(source, 'keep.txt'), 'keep\n');
      execFileSync('git', ['add', 'keep.txt'], { cwd: source });
      execFileSync('git', ['commit', '--quiet', '-m', 'init'], { cwd: source });

      const prep = await prepareTaskOnToolHost(source, taskId, [source]);
      taskRoot = String(prep.root);
      const checkpoints = new CheckpointManager({
        sessionId: 'session-command-test',
        workspacePath: taskRoot,
      });
      streamChatMock
        .mockImplementationOnce(async (opts) => {
          const command = `node -e "require('fs').writeFileSync('command-stage.txt','from-command')"`;
          opts.onDelta(
            `\`\`\`tool_call\n${JSON.stringify({
              name: 'run_command',
              arguments: { command },
            })}\n\`\`\``,
          );
        })
        .mockImplementationOnce(async (opts) => {
          opts.onDelta('完成');
        });

      const result = await runAgent({
        prompt: '用命令写一个文件',
        modelId: 'test-model',
        workspacePath: taskRoot,
        workspaceRoots: [source],
        taskWorkspaceId: taskId,
        apiUrl: 'http://test.invalid',
        maxIterations: 3,
        jsonMode: true,
        headlessOneShot: true,
        allowDangerous: true,
        checkpoints,
      });

      expect(result.stopReason).toBe('end_turn');
      expect(existsSync(join(taskRoot, 'command-stage.txt'))).toBe(true);
      expect(existsSync(join(source, 'command-stage.txt'))).toBe(false);

      const published = await publishTaskOnToolHost(taskId);
      expect(published.changedFiles).toBe(1);
      expect(readFileSync(join(source, 'command-stage.txt'), 'utf8')).toContain('from-command');
    } finally {
      await abandonTaskOnToolHost(taskId).catch(() => {});
      rmSync(source, { recursive: true, force: true });
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
