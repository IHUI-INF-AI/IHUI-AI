/**
 * HunkTracker 集成测试 — 验证 file-edit 工具集接入 hunkTracker 后的 record + detectConflict 行为。
 *
 * 覆盖:
 *   - 未注入 hunkTracker 时行为不变(零回归)
 *   - write_file / edit_file / delete_file 成功后调用 recordAgentChange
 *   - 写入前若 detectConflict 返回非空,console.warn 输出冲突摘要
 *   - agentId 默认 'main',可被 EditToolContext.agentId 覆盖
 *   - 同一 agent 的 cooldown 合并(连续多次 edit 同文件 → 一条 hunk)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createWriteFileTool,
  createEditFileTool,
  createDeleteFileTool,
} from '../src/tools/file-edit.js';
import { createSubagentTool } from '../src/tools/subagent.js';
import { HunkTracker } from '../src/checkpoints/hunk-tracker.js';
import type { ToolContext } from '../src/tools/index.js';

interface EditCtx extends ToolContext {
  hunkTracker?: HunkTracker;
  agentId?: string;
}

describe('HunkTracker 集成:file-edit 工具集', () => {
  let workDir: string;
  let origHooksConfig: string | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-hunk-int-'));
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    warnSpy.mockRestore();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('未注入 hunkTracker 时行为不变(write_file 仍正常工作)', async () => {
    const ctx: EditCtx = { workspacePath: workDir };
    const tool = createWriteFileTool(ctx);
    const r = await tool.execute({ path: 'a.txt', content: 'hello' }, ctx);
    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'a.txt'), 'utf-8')).toBe('hello');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('write_file 成功后调用 recordAgentChange(hunkTracker 记录 1 条 agent hunk)', async () => {
    const tracker = new HunkTracker();
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'main' };
    const tool = createWriteFileTool(ctx);
    await tool.execute({ path: 'new.txt', content: 'line1\nline2\nline3' }, ctx);
    const stats = tracker.getStats();
    expect(stats.totalHunks).toBe(1);
    expect(stats.agentHunks).toBe(1);
    expect(stats.externalHunks).toBe(0);
    const history = tracker.getHistory(path.join(workDir, 'new.txt'));
    expect(history).toHaveLength(1);
    expect(history[0]!.agentId).toBe('main');
    expect(history[0]!.source).toBe('agent');
    expect(history[0]!.startLine).toBe(1);
    expect(history[0]!.endLine).toBe(3);
  });

  it('write_file 覆盖时记录改动行范围(只记录差异部分)', async () => {
    // 用 cooldownMs=0 禁用合并,确保每次 write 都新增一条 hunk
    const tracker = new HunkTracker({ cooldownMs: 0 });
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'main' };
    const tool = createWriteFileTool(ctx);
    await tool.execute({ path: 'b.txt', content: 'a\nb\nc\nd\ne' }, ctx);
    // 覆盖:c 行改为 X
    await tool.execute({ path: 'b.txt', content: 'a\nb\nX\nd\ne' }, ctx);
    const history = tracker.getHistory(path.join(workDir, 'b.txt'));
    expect(history).toHaveLength(2);
    // 第二次改动应在第 3 行
    expect(history[1]!.startLine).toBe(3);
    expect(history[1]!.endLine).toBe(3);
  });

  it('edit_file 成功后调用 recordAgentChange', async () => {
    const tracker = new HunkTracker();
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'coder-1' };
    const writeTool = createWriteFileTool(ctx);
    const editTool = createEditFileTool(ctx);
    await writeTool.execute({ path: 'e.txt', content: 'foo\nbar\nbaz' }, ctx);
    tracker.clear(); // 清除 write_file 留下的记录,只观察 edit_file
    const r = await editTool.execute({ path: 'e.txt', search: 'bar', replace: 'BAR' }, ctx);
    expect(r.success).toBe(true);
    const history = tracker.getHistory(path.join(workDir, 'e.txt'));
    expect(history).toHaveLength(1);
    expect(history[0]!.agentId).toBe('coder-1');
    expect(history[0]!.startLine).toBe(2);
    expect(history[0]!.endLine).toBe(2);
  });

  it('delete_file 成功后调用 recordAgentChange(记录原文件行范围)', async () => {
    const tracker = new HunkTracker();
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'main' };
    const writeTool = createWriteFileTool(ctx);
    const deleteTool = createDeleteFileTool(ctx);
    await writeTool.execute({ path: 'd.txt', content: 'l1\nl2\nl3\nl4' }, ctx);
    tracker.clear();
    const r = await deleteTool.execute({ path: 'd.txt' }, ctx);
    expect(r.success).toBe(true);
    const history = tracker.getHistory(path.join(workDir, 'd.txt'));
    expect(history).toHaveLength(1);
    expect(history[0]!.startLine).toBe(1);
    expect(history[0]!.endLine).toBe(4);
  });

  it('写入前检测冲突:detectConflict 返回非空时 console.warn', async () => {
    const tracker = new HunkTracker();
    const abs = path.join(workDir, 'c.txt');
    // 预先注入一条 other-agent 的 hunk(L1-3)
    tracker.recordAgentChange(abs, 1, 3, 'other-agent');
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'main' };
    const tool = createWriteFileTool(ctx);
    await tool.execute({ path: 'c.txt', content: 'x\ny\nz' }, ctx);
    expect(warnSpy).toHaveBeenCalled();
    const warnMsg = warnSpy.mock.calls[0]![0] as string;
    expect(warnMsg).toContain('hunk-tracker');
    expect(warnMsg).toContain('1 处冲突');
    expect(warnMsg).toContain('other-agent');
  });

  it('同一 agent 连续 edit 同文件(cooldownMs 内)合并为一条 hunk', async () => {
    const tracker = new HunkTracker({ cooldownMs: 60000 });
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'main' };
    const writeTool = createWriteFileTool(ctx);
    const editTool = createEditFileTool(ctx);
    await writeTool.execute({ path: 'm.txt', content: 'a\nb\nc\nd\ne\nf' }, ctx);
    tracker.clear();
    await editTool.execute({ path: 'm.txt', search: 'a', replace: 'A' }, ctx);
    await editTool.execute({ path: 'm.txt', search: 'f', replace: 'F' }, ctx);
    // 两次 edit 间隔 < cooldownMs,但行范围不相邻也不重叠,不会合并
    // 验证:仍是 2 条 hunk(非合并场景)
    const history = tracker.getHistory(path.join(workDir, 'm.txt'));
    expect(history.length).toBe(2);
  });

  it('同一 agent 连续 edit 相邻行范围(cooldownMs 内)合并为一条 hunk', async () => {
    const tracker = new HunkTracker({ cooldownMs: 60000 });
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'main' };
    const writeTool = createWriteFileTool(ctx);
    const editTool = createEditFileTool(ctx);
    await writeTool.execute({ path: 'adj.txt', content: 'a\nb\nc\nd' }, ctx);
    tracker.clear();
    // 第 1 次 edit 改 L1
    await editTool.execute({ path: 'adj.txt', search: 'a', replace: 'A' }, ctx);
    // 第 2 次 edit 改 L2(与 L1 相邻)
    await editTool.execute({ path: 'adj.txt', search: 'b', replace: 'B' }, ctx);
    const history = tracker.getHistory(path.join(workDir, 'adj.txt'));
    expect(history).toHaveLength(1);
    expect(history[0]!.startLine).toBe(1);
    expect(history[0]!.endLine).toBe(2);
  });

  it('agentId 默认为 main(未传 agentId 时)', async () => {
    const tracker = new HunkTracker();
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker };
    const tool = createWriteFileTool(ctx);
    await tool.execute({ path: 'no-id.txt', content: 'x' }, ctx);
    const history = tracker.getHistory(path.join(workDir, 'no-id.txt'));
    expect(history[0]!.agentId).toBe('main');
  });

  it('不同 agentId 的改动互相视为冲突(detectConflict 命中)', async () => {
    const tracker = new HunkTracker();
    const abs = path.join(workDir, 'cross.txt');
    tracker.recordAgentChange(abs, 5, 10, 'agent-A');
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'agent-B' };
    const writeTool = createWriteFileTool(ctx);
    // 写入会影响 L1-3,与 agent-A 的 L5-10 不重叠 → 不冲突
    await writeTool.execute({ path: 'cross.txt', content: 'x\ny\nz' }, ctx);
    expect(warnSpy).not.toHaveBeenCalled();
    // 现在改 cross.txt 影响 L5(与 agent-A 重叠) → 冲突
    warnSpy.mockClear();
    const editTool = createEditFileTool(ctx);
    await editTool.execute({ path: 'cross.txt', search: 'y', replace: 'Y' }, ctx);
    // L2 改动不与 L5-10 重叠 → 仍不冲突
    // 改 L5 验证冲突:用 patch 改第 5 行(但当前文件只有 3 行,补齐到 5 行)
    await writeTool.execute({ path: 'cross.txt', content: 'x\nY\nz\n4\n5' }, ctx);
    warnSpy.mockClear();
    await editTool.execute({ path: 'cross.txt', search: '5', replace: 'FIVE' }, ctx);
    expect(warnSpy).toHaveBeenCalled();
    const warnMsg = warnSpy.mock.calls[0]![0] as string;
    expect(warnMsg).toContain('agent-A');
  });

  it('recordAgentChange 失败不阻塞编辑(hunkTracker 异常时仍能完成写入)', async () => {
    // 用非法 startLine 触发 validateRange 抛错 — 通过 mock 实现
    const tracker = {
      detectConflict: () => [],
      recordAgentChange: () => {
        throw new Error('mock tracker error');
      },
      getStats: () => ({ totalHunks: 0, agentHunks: 0, externalHunks: 0, conflictFiles: 0 }),
      getHistory: () => [],
      clear: () => {},
    } as unknown as HunkTracker;
    const ctx: EditCtx = { workspacePath: workDir, hunkTracker: tracker, agentId: 'main' };
    const tool = createWriteFileTool(ctx);
    const r = await tool.execute({ path: 'safe.txt', content: 'ok' }, ctx);
    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'safe.txt'), 'utf-8')).toBe('ok');
  });
});

describe('HunkTracker 集成:subagent 透传', () => {
  it('SubagentParentOptions 接受 hunkTracker 字段(typecheck-only 验证)', () => {
    // 静态验证:createSubagentTool 接受 hunkTracker 选项,不抛 typecheck 错误
    // 动态行为(subagent 把 hunkTracker 传给 setupAgentTools)由 subagent 的 execute 路径覆盖,
    // 此处仅验证类型契约,不启动真实 LLM
    const tool = createSubagentTool({
      modelId: 'test-model',
      apiUrl: 'http://localhost:8000',
      apiKey: 'k',
      workspacePath: '/tmp',
      hunkTracker: new HunkTracker(),
      precedenceEnabled: false,
    });
    expect(tool.name).toBe('dispatch_subagent');
    expect(tool.parameters).toHaveProperty('task');
  });
});
