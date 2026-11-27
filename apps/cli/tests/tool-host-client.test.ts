// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  abandonTaskOnToolHost,
  diffTaskOnToolHost,
  isToolHostAvailable,
  prepareTaskOnToolHost,
  publishTaskOnToolHost,
  runOnToolHost,
  shutdownToolHost,
} from '../src/sandbox/tool-host.js';
import { run_command } from '../src/tools/builtins.js';

const host =
  process.env.IHUI_TOOL_HOST_EXE ??
  resolve(process.cwd(), '../desktop/src-tauri/resources/tool-host/ihui-tool-host.exe');
const enabled = process.platform === 'win32' && existsSync(host);
const suite = enabled ? describe : describe.skip;

suite('tool-host CLI 消费方', () => {
  const oldHostExe = process.env.IHUI_TOOL_HOST_EXE;
  beforeAll(() => {
    process.env.IHUI_TOOL_HOST_EXE = host;
  });
  afterAll(() => {
    shutdownToolHost();
    if (oldHostExe === undefined) delete process.env.IHUI_TOOL_HOST_EXE;
    else process.env.IHUI_TOOL_HOST_EXE = oldHostExe;
  });

  it('经独立宿主执行并写工作区、中文输出不被解码坏', async () => {
    const target = `C:\\IHUI-AI\\toolhost-client-test-${process.pid}.txt`;
    try {
      const result = await runOnToolHost({
        command: `echo host-client-ok > "${target}" && echo 中文输出`,
        cwd: 'C:\\IHUI-AI',
        timeoutMs: 15_000,
        blockedEnvVars: [],
        integrity: 'inherit',
      });
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain('中文输出');
      expect(existsSync(target)).toBe(true);
      expect(readFileSync(target, 'utf8')).toContain('host-client-ok');
    } finally {
      if (existsSync(target)) unlinkSync(target);
    }
  });

  it('同一 turnId|toolCallId 重试命中宿主缓存，不再产生第二次副作用', async () => {
    const target = `C:\\IHUI-AI\\toolhost-idem-test-${process.pid}.txt`;
    const turnId = `cli-turn-${process.pid}`;
    const callId = `cli-call-${process.pid}-idem`;
    try {
      const opts = {
        command: `echo tick >> "${target}"`,
        cwd: 'C:\\IHUI-AI',
        timeoutMs: 15_000,
        blockedEnvVars: [],
        integrity: 'inherit' as const,
        turnId,
        toolCallId: callId,
      };
      await runOnToolHost(opts);
      await runOnToolHost(opts);
      expect(readFileSync(target, 'utf8').trim().split(/\r?\n/)).toHaveLength(1);

      await runOnToolHost({ ...opts, toolCallId: `${callId}-second` });
      expect(readFileSync(target, 'utf8').trim().split(/\r?\n/)).toHaveLength(2);
    } finally {
      if (existsSync(target)) unlinkSync(target);
    }
  });

  it('run_command 把 ToolContext 的 turnId/toolCallId 贯通到宿主缓存', async () => {
    const target = `C:\\IHUI-AI\\toolhost-context-idem-${process.pid}.txt`;
    const ctx = {
      workspacePath: 'C:\\IHUI-AI',
      turnId: `ctx-turn-${process.pid}`,
      toolCallId: `ctx-call-${process.pid}`,
      confirmDangerous: async () => true,
    };
    try {
      process.env.IHUI_TOOL_HOST_FOREGROUND = '1';
      const command = `echo ctx-tick >> "${target}"`;
      const first = await run_command.execute({ command }, ctx as never);
      expect(first.success, JSON.stringify(first)).toBe(true);
      const second = await run_command.execute({ command }, ctx as never);
      expect(second.success, JSON.stringify(second)).toBe(true);
      expect(readFileSync(target, 'utf8').trim().split(/\r?\n/)).toHaveLength(1);
    } finally {
      delete process.env.IHUI_TOOL_HOST_FOREGROUND;
      if (existsSync(target)) unlinkSync(target);
    }
  });

  it('run_command 前台只读命令走宿主，不是 Node spawn', async () => {
    process.env.IHUI_TOOL_HOST_FOREGROUND = '1';
    try {
      const result = await run_command.execute(
        { command: 'dir' },
        { workspacePath: 'C:\\IHUI-AI', confirmDangerous: async () => true } as never,
      );
      expect(result.success, JSON.stringify(result)).toBe(true);
      expect(result.output.length).toBeGreaterThan(0);
    } finally {
      delete process.env.IHUI_TOOL_HOST_FOREGROUND;
    }
  });

  it('appcontainer 档真断网：ping 非零退出且无 TTL', async () => {
    const result = await runOnToolHost({
      command: 'ping -n 1 8.8.8.8',
      cwd: '',
      timeoutMs: 8_000,
      blockedEnvVars: [],
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).not.toContain('TTL=');
  });

  it('TaskPrepare → AppContainer 写副本 → diff → publish 回源工作区', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ihui-cli-task-'));
    const taskId = `cli-task-${process.pid}`;
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: root });
      writeFileSync(join(root, 'a.txt'), 'before\n');
      execFileSync('git', ['add', 'a.txt'], { cwd: root });
      execFileSync('git', ['commit', '--quiet', '-m', 'init'], { cwd: root });

      const prep = await prepareTaskOnToolHost(root, taskId, [root]);
      expect(typeof prep.root).toBe('string');
      const stage = String(prep.root);

      // 走真实 ToolContext：workspacePath 是副本，workspaceRoots 仍是源。
      // 宿主连接键按源根复用；若这里错误地用副本当 root，会重建宿主并把任务丢掉。
      process.env.IHUI_TOOL_HOST_FOREGROUND = '1';
      try {
        const result = await run_command.execute(
          { command: 'echo stage-after> a.txt' },
          {
            workspacePath: stage,
            workspaceRoots: [root],
            confirmDangerous: async () => true,
          } as never,
        );
        expect(result.success, JSON.stringify(result)).toBe(true);
      } finally {
        delete process.env.IHUI_TOOL_HOST_FOREGROUND;
      }

      const diff = await diffTaskOnToolHost(taskId);
      expect(String(diff.patch)).toContain('a.txt');
      const published = await publishTaskOnToolHost(taskId);
      expect(published.changedFiles).toBe(1);
      expect(readFileSync(join(root, 'a.txt'), 'utf8')).toContain('stage-after');
    } finally {
      await abandonTaskOnToolHost(taskId).catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('TaskPrepare 支持非 Git 源，发布时拒绝覆盖源改动', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ihui-cli-nongit-task-'));
    const taskId = `cli-nongit-${process.pid}`;
    try {
      mkdirSync(join(root, 'docs'));
      writeFileSync(join(root, 'a.txt'), 'before\n');
      writeFileSync(join(root, 'docs', 'b.txt'), 'keep\n');

      const prep = await prepareTaskOnToolHost(root, taskId, [root]);
      const stage = String(prep.root);
      expect(readFileSync(join(stage, 'a.txt'), 'utf8')).toBe('before\n');

      writeFileSync(join(stage, 'a.txt'), 'after\n');
      writeFileSync(join(stage, 'docs', 'c.txt'), 'new\n');
      const diff = await diffTaskOnToolHost(taskId);
      expect(String(diff.patch)).toContain('a.txt');
      expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('before\n');

      // 源在任务期间被用户改动：宿主必须显式拒绝，而不是静默覆盖。
      writeFileSync(join(root, 'a.txt'), 'user-change\n');
      await expect(publishTaskOnToolHost(taskId)).rejects.toThrow(/被改动/);
      expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('user-change\n');

      writeFileSync(join(root, 'a.txt'), 'before\n');
      const published = await publishTaskOnToolHost(taskId);
      expect(published.changedFiles).toBe(2);
      expect(readFileSync(join(root, 'a.txt'), 'utf8').replace(/\r\n/g, '\n')).toBe('after\n');
      expect(readFileSync(join(root, 'docs', 'c.txt'), 'utf8').replace(/\r\n/g, '\n')).toBe('new\n');
    } finally {
      await abandonTaskOnToolHost(taskId).catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('不可用时明确抛错，不假装执行', async () => {
    const old = process.env.IHUI_TOOL_HOST_EXE;
    process.env.IHUI_TOOL_HOST_EXE = 'C:\\definitely-not-exist\\ihui-tool-host.exe';
    try {
      expect(isToolHostAvailable()).toBe(false);
      await expect(
        runOnToolHost({ command: 'echo nope', cwd: process.cwd(), timeoutMs: 5_000, blockedEnvVars: [] }),
      ).rejects.toThrow(/tool-host 不可用/);
    } finally {
      if (old === undefined) delete process.env.IHUI_TOOL_HOST_EXE;
      else process.env.IHUI_TOOL_HOST_EXE = old;
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
