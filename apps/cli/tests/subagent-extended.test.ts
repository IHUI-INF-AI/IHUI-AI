/**
 * Subagent 扩展能力测试 — isolation/resumeFrom/capabilityMode/hook 埋点。
 *
 * 覆盖范围:
 *   - applyCapabilityMode 4 档工具白名单(read-only/read-write/execute/all)
 *   - CAPABILITY_WHITELISTS 常量完整性
 *   - dispatch_subagent 工具 schema 含新参数
 *   - isolation='worktree' 生命周期(create/remove/keepWorktree)
 *   - resumeFrom 断点续跑(成功加载 / 失败报错)
 *   - SubagentStart/SubagentStop hook 埋点(reason=completed/failed)
 *   - state-store 持久化往返
 *   - 向后兼容(不传新参数时行为不变)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: vi.fn(async () => ({
    systemPrompt: '',
    ctx: { workspacePath: '/test-ws' },
    skills: [],
    memory: [],
  })),
  runToolLoop: vi.fn(async () => ({
    stopReason: 'end_turn',
    assistantText: 'task done',
    iterations: 1,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
  })),
}));

vi.mock('../src/hooks/index.js', () => ({
  runHook: vi.fn(() => ({ proceed: true })),
}));

vi.mock('../src/subagents/worktree.js', () => ({
  createWorktree: vi.fn(() => ({
    path: '/fake-wt/sub-id',
    branch: 'subagent/sub-id',
    parentId: 'parent-1',
    subagentId: 'sub-id',
    createdAt: '2026-07-17T00:00:00.000Z',
  })),
  removeWorktree: vi.fn(() => true),
  worktreeBranchName: vi.fn((id: string) => `subagent/${id}`),
  getDefaultWorktreeRoot: vi.fn(() => '/fake/.worktrees'),
  listWorktrees: vi.fn(() => []),
  pruneWorktrees: vi.fn(() => 0),
}));

import {
  createSubagentTool,
  applyCapabilityMode,
  CAPABILITY_WHITELISTS,
  type SubagentParentOptions,
} from '../src/tools/subagent.js';
import { setupAgentTools, runToolLoop } from '../src/commands/agent.js';
import { runHook } from '../src/hooks/index.js';
import { createWorktree, removeWorktree } from '../src/subagents/worktree.js';
import {
  saveSubagentState,
  loadSubagentState,
  deleteSubagentState,
  listSubagentStates,
  getSubagentStateDir,
  type SubagentState,
} from '../src/subagents/state-store.js';
import { clearTools, registerTools, type Tool } from '../src/tools/index.js';

function makeTool(name: string): Tool {
  return {
    name,
    description: `${name} tool`,
    parameters: {},
    required: [],
    execute: async () => ({ success: true, output: '' }),
  };
}

const ALL_TOOL_NAMES = [
  'read_file', 'list_dir', 'grep', 'glob', 'codegraph', 'goto_definition', 'find_references',
  'fetch_url', 'web_search', 'get_diagnostics', 'run_tests', 'write_file', 'edit_file',
  'delete_file', 'git_commit', 'git_add', 'git_status', 'git_diff', 'run_command',
  'dispatch_subagent',
];
const allTools = ALL_TOOL_NAMES.map(makeTool);

const baseParentOpts: SubagentParentOptions = {
  modelId: 'test-model',
  apiUrl: 'http://localhost:3000',
  apiKey: 'test-key',
  workspacePath: '/test-ws',
  sessionId: 'parent-1',
};

let tmpStateDir: string;

beforeEach(() => {
  tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-sub-test-'));
  process.env.IHUI_SUBAGENT_STATE_DIR = tmpStateDir;

  vi.mocked(setupAgentTools).mockClear();
  vi.mocked(runToolLoop).mockClear();
  vi.mocked(runHook).mockClear();
  vi.mocked(createWorktree).mockClear();
  vi.mocked(removeWorktree).mockClear();

  vi.mocked(runToolLoop).mockResolvedValue({
    stopReason: 'end_turn',
    assistantText: 'task done',
    iterations: 1,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
  });

  clearTools();
  registerTools(allTools);
});

afterEach(() => {
  clearTools();
  delete process.env.IHUI_SUBAGENT_STATE_DIR;
  if (tmpStateDir && fs.existsSync(tmpStateDir)) {
    fs.rmSync(tmpStateDir, { recursive: true, force: true });
  }
});

describe('applyCapabilityMode — 4 档工具白名单', () => {
  it('read-only:仅允许只读工具,排除写/执行/git', () => {
    const filtered = applyCapabilityMode(allTools, 'read-only');
    const names = filtered.map((t) => t.name);
    expect(names).toContain('read_file');
    expect(names).toContain('list_dir');
    expect(names).toContain('grep');
    expect(names).toContain('glob');
    expect(names).toContain('codegraph');
    expect(names).toContain('goto_definition');
    expect(names).toContain('find_references');
    expect(names).toContain('fetch_url');
    expect(names).toContain('web_search');
    expect(names).toContain('get_diagnostics');
    expect(names).not.toContain('write_file');
    expect(names).not.toContain('edit_file');
    expect(names).not.toContain('delete_file');
    expect(names).not.toContain('run_command');
    expect(names).not.toContain('run_tests');
    expect(names).not.toContain('git_commit');
    expect(names).not.toContain('git_add');
    expect(names).not.toContain('git_status');
  });

  it('read-write:read-only + edit_file/write_file/apply_patch/delete_file', () => {
    const filtered = applyCapabilityMode(allTools, 'read-write');
    const names = filtered.map((t) => t.name);
    expect(names).toContain('read_file');
    expect(names).toContain('edit_file');
    expect(names).toContain('write_file');
    expect(names).toContain('delete_file');
    expect(names).not.toContain('run_command');
    expect(names).not.toContain('run_tests');
    expect(names).not.toContain('git_commit');
  });

  it('execute:read-write + run_command/run_tests + 所有 git_*', () => {
    const filtered = applyCapabilityMode(allTools, 'execute');
    const names = filtered.map((t) => t.name);
    expect(names).toContain('read_file');
    expect(names).toContain('edit_file');
    expect(names).toContain('write_file');
    expect(names).toContain('run_command');
    expect(names).toContain('run_tests');
    expect(names).toContain('git_commit');
    expect(names).toContain('git_add');
    expect(names).toContain('git_status');
    expect(names).toContain('git_diff');
  });

  it('all:返回全部工具(无过滤)', () => {
    const filtered = applyCapabilityMode(allTools, 'all');
    expect(filtered).toHaveLength(allTools.length);
    expect(filtered.map((t) => t.name).sort()).toEqual(ALL_TOOL_NAMES.slice().sort());
  });

  it('undefined:返回全部工具(向后兼容)', () => {
    const filtered = applyCapabilityMode(allTools, undefined);
    expect(filtered).toHaveLength(allTools.length);
  });

  it('read-only 不包含 dispatch_subagent(防止递归)', () => {
    const filtered = applyCapabilityMode(allTools, 'read-only');
    expect(filtered.map((t) => t.name)).not.toContain('dispatch_subagent');
  });

  it('read-write 不包含 dispatch_subagent(防止递归)', () => {
    const filtered = applyCapabilityMode(allTools, 'read-write');
    expect(filtered.map((t) => t.name)).not.toContain('dispatch_subagent');
  });
});

describe('CAPABILITY_WHITELISTS 常量', () => {
  it('包含 3 个非 all 模式', () => {
    expect(Object.keys(CAPABILITY_WHITELISTS).sort()).toEqual(['execute', 'read-only', 'read-write']);
  });

  it('read-only 列表长度为 10', () => {
    expect(CAPABILITY_WHITELISTS['read-only']).toHaveLength(10);
  });

  it('read-write 是 read-only 超集', () => {
    const ro = CAPABILITY_WHITELISTS['read-only'];
    const rw = CAPABILITY_WHITELISTS['read-write'];
    for (const t of ro) {
      expect(rw).toContain(t);
    }
    expect(rw.length).toBeGreaterThan(ro.length);
  });

  it('execute 是 read-write 超集', () => {
    const rw = CAPABILITY_WHITELISTS['read-write'];
    const ex = CAPABILITY_WHITELISTS['execute'];
    for (const t of rw) {
      expect(ex).toContain(t);
    }
    expect(ex.length).toBeGreaterThan(rw.length);
  });
});

describe('createSubagentTool — schema 含新参数', () => {
  it('parameters 含 isolation/resumeFrom/capabilityMode/keepWorktree', () => {
    const tool = createSubagentTool(baseParentOpts);
    expect(tool.parameters.isolation).toBeDefined();
    expect(tool.parameters.isolation?.enum).toEqual(['none', 'worktree']);
    expect(tool.parameters.resumeFrom).toBeDefined();
    expect(tool.parameters.capabilityMode).toBeDefined();
    expect(tool.parameters.capabilityMode?.enum).toEqual(['read-only', 'read-write', 'execute', 'all']);
    expect(tool.parameters.keepWorktree).toBeDefined();
    expect(tool.parameters.keepWorktree?.type).toBe('boolean');
  });

  it('description 提及 isolation/resumeFrom/capabilityMode', () => {
    const tool = createSubagentTool(baseParentOpts);
    expect(tool.description).toContain('isolation');
    expect(tool.description).toContain('resumeFrom');
    expect(tool.description).toContain('capabilityMode');
  });
});

describe('向后兼容 — 不传新参数时行为不变', () => {
  it('不传 isolation/resumeFrom/capabilityMode 时,正常执行并返回成功', async () => {
    const tool = createSubagentTool(baseParentOpts);
    const result = await tool.execute({ task: 'test task' }, { workspacePath: '/test-ws' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('子 agent 完成');
    expect(result.output).toContain('task done');
  });

  it('不传新参数时,不创建 worktree', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'test' }, { workspacePath: '/test-ws' });
    expect(createWorktree).not.toHaveBeenCalled();
  });

  it('不传新参数时,仍调用 SubagentStart/SubagentStop hook', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'test' }, { workspacePath: '/test-ws' });
    const events = vi.mocked(runHook).mock.calls.map((c) => c[0]);
    expect(events).toContain('subagentStart');
    expect(events).toContain('subagentStop');
  });

  it('不传新参数时,持久化 state 到 state-store', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'test' }, { workspacePath: '/test-ws' });
    const states = listSubagentStates('parent-1');
    expect(states.length).toBeGreaterThanOrEqual(1);
    const last = states[states.length - 1]!;
    expect(last.status).toBe('completed');
    expect(last.parentId).toBe('parent-1');
    expect(last.persona).toBe('general');
  });
});

describe('isolation=worktree — git worktree 隔离生命周期', () => {
  it('worktree 模式调用 createWorktree', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'wt task', isolation: 'worktree' }, { workspacePath: '/test-ws' });
    expect(createWorktree).toHaveBeenCalledTimes(1);
    const args = vi.mocked(createWorktree).mock.calls[0]!;
    expect(args[0]).toBe('parent-1');
    expect(args[2]).toBe('/test-ws');
  });

  it('worktree 路径传给 setupAgentTools 作为 workspacePath', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'wt task', isolation: 'worktree' }, { workspacePath: '/test-ws' });
    const callArgs = vi.mocked(setupAgentTools).mock.calls[0]![0];
    expect(callArgs.workspacePath).toBe('/fake-wt/sub-id');
  });

  it('成功 + keepWorktree=false(默认)→ 调用 removeWorktree', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'wt task', isolation: 'worktree' }, { workspacePath: '/test-ws' });
    expect(removeWorktree).toHaveBeenCalledTimes(1);
    const args = vi.mocked(removeWorktree).mock.calls[0]!;
    expect(args[0]).toBe('/fake-wt/sub-id');
  });

  it('成功 + keepWorktree=true → 不调用 removeWorktree', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute(
      { task: 'wt task', isolation: 'worktree', keepWorktree: true },
      { workspacePath: '/test-ws' },
    );
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it('失败时保留 worktree(不调用 removeWorktree)', async () => {
    vi.mocked(runToolLoop).mockResolvedValueOnce({
      stopReason: 'error',
      assistantText: '',
      iterations: 1,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    });
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'wt fail', isolation: 'worktree' }, { workspacePath: '/test-ws' });
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it('worktree 创建失败 → 返回错误,不执行 subagent', async () => {
    vi.mocked(createWorktree).mockImplementationOnce(() => {
      throw new Error('git worktree add 失败: 分支已存在');
    });
    const tool = createSubagentTool(baseParentOpts);
    const result = await tool.execute(
      { task: 'wt fail', isolation: 'worktree' },
      { workspacePath: '/test-ws' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('worktree 创建失败');
    expect(runToolLoop).not.toHaveBeenCalled();
  });

  it('父级 isolation=worktree + 调用级不传 → 继承父级', async () => {
    const tool = createSubagentTool({ ...baseParentOpts, isolation: 'worktree' });
    await tool.execute({ task: 'inherit' }, { workspacePath: '/test-ws' });
    expect(createWorktree).toHaveBeenCalledTimes(1);
  });
});

describe('resumeFrom — 断点续跑', () => {
  it('resumeFrom 不存在的 id → 返回错误', async () => {
    const tool = createSubagentTool(baseParentOpts);
    const result = await tool.execute(
      { task: 'resume', resumeFrom: 'non-existent-id' },
      { workspacePath: '/test-ws' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('resumeFrom 失败');
    expect(result.error).toContain('non-existent-id');
    expect(runToolLoop).not.toHaveBeenCalled();
  });

  it('resumeFrom 有效 id → 加载状态并执行', async () => {
    const prevState: SubagentState = {
      id: 'resume-id-1',
      parentId: 'parent-1',
      persona: 'coder',
      capabilityMode: 'all',
      isolation: 'none',
      transcript: [{ role: 'user', content: 'previous task' }],
      model: 'prev-model',
      status: 'failed',
      startedAt: '2026-07-16T10:00:00.000Z',
    };
    saveSubagentState(prevState);

    const tool = createSubagentTool(baseParentOpts);
    const result = await tool.execute(
      { task: 'resume task', resumeFrom: 'resume-id-1' },
      { workspacePath: '/test-ws' },
    );
    expect(result.success).toBe(true);
    expect(runToolLoop).toHaveBeenCalledTimes(1);

    const finalState = loadSubagentState('resume-id-1');
    expect(finalState).not.toBeNull();
    expect(finalState!.status).toBe('completed');
    expect(finalState!.endedAt).toBeDefined();
    expect(finalState!.model).toBe('prev-model');
  });

  it('resumeFrom 有效 id + worktree 隔离 → 复用上次 worktreePath', async () => {
    const prevState: SubagentState = {
      id: 'resume-wt-1',
      parentId: 'parent-1',
      persona: 'general',
      capabilityMode: 'all',
      isolation: 'worktree',
      worktreePath: '/prev-wt/path',
      transcript: [],
      model: 'test-model',
      status: 'failed',
      startedAt: '2026-07-16T10:00:00.000Z',
    };
    saveSubagentState(prevState);

    const tool = createSubagentTool(baseParentOpts);
    await tool.execute(
      { task: 'resume wt', resumeFrom: 'resume-wt-1', isolation: 'worktree' },
      { workspacePath: '/test-ws' },
    );
    expect(createWorktree).not.toHaveBeenCalled();
    const callArgs = vi.mocked(setupAgentTools).mock.calls[0]![0];
    expect(callArgs.workspacePath).toBe('/prev-wt/path');
  });
});

describe('SubagentStart/SubagentStop hook 埋点', () => {
  it('SubagentStart 在 runToolLoop 之前调用', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'hook order' }, { workspacePath: '/test-ws' });

    const startCall = vi.mocked(runHook).mock.calls.find((c) => c[0] === 'subagentStart');
    const stopCall = vi.mocked(runHook).mock.calls.find((c) => c[0] === 'subagentStop');
    expect(startCall).toBeDefined();
    expect(stopCall).toBeDefined();
    expect(runToolLoop).toHaveBeenCalled();
  });

  it('SubagentStart 传递 subagentId + subagentType', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute(
      { task: 'hook ctx', persona: 'researcher' },
      { workspacePath: '/test-ws' },
    );
    const startCall = vi.mocked(runHook).mock.calls.find((c) => c[0] === 'subagentStart');
    const ctx = startCall![1];
    expect(ctx.subagentId).toBeDefined();
    expect(typeof ctx.subagentId).toBe('string');
    expect(ctx.subagentType).toBe('researcher');
    expect(ctx.workspacePath).toBe('/test-ws');
    expect(ctx.sessionId).toBe('parent-1');
  });

  it('SubagentStop reason=completed on 成功', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'success' }, { workspacePath: '/test-ws' });
    const stopCall = vi.mocked(runHook).mock.calls.find((c) => c[0] === 'subagentStop');
    expect(stopCall).toBeDefined();
    expect(stopCall![1].reason).toBe('completed');
    expect(stopCall![1].error).toBeUndefined();
  });

  it('SubagentStop reason=failed on runToolLoop 异常', async () => {
    vi.mocked(runToolLoop).mockRejectedValueOnce(new Error('LLM 不可用'));
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'fail' }, { workspacePath: '/test-ws' });
    const stopCall = vi.mocked(runHook).mock.calls.find((c) => c[0] === 'subagentStop');
    expect(stopCall).toBeDefined();
    expect(stopCall![1].reason).toBe('failed');
    expect(stopCall![1].error).toContain('LLM 不可用');
  });

  it('SubagentStop reason=failed on 空响应', async () => {
    vi.mocked(runToolLoop).mockResolvedValueOnce({
      stopReason: 'error',
      assistantText: '',
      iterations: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    });
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'empty' }, { workspacePath: '/test-ws' });
    const stopCall = vi.mocked(runHook).mock.calls.find((c) => c[0] === 'subagentStop');
    expect(stopCall![1].reason).toBe('failed');
  });
});

describe('capabilityMode 在 execute() 中应用', () => {
  it('capabilityMode=read-only 过滤传给 runToolLoop 的工具集', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute(
      { task: 'cap test', capabilityMode: 'read-only' },
      { workspacePath: '/test-ws' },
    );
    expect(setupAgentTools).toHaveBeenCalled();
    expect(runToolLoop).toHaveBeenCalled();
    const states = listSubagentStates('parent-1');
    const last = states[states.length - 1]!;
    expect(last.capabilityMode).toBe('read-only');
  });

  it('capabilityMode 优先级高于 persona(覆写 persona.allowedTools)', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute(
      { task: 'cap override', persona: 'researcher', capabilityMode: 'all' },
      { workspacePath: '/test-ws' },
    );
    const states = listSubagentStates('parent-1');
    const last = states[states.length - 1]!;
    expect(last.capabilityMode).toBe('all');
    expect(last.persona).toBe('researcher');
  });

  it('父级 capabilityMode + 调用级不传 → 继承父级', async () => {
    const tool = createSubagentTool({ ...baseParentOpts, capabilityMode: 'execute' });
    await tool.execute({ task: 'inherit cap' }, { workspacePath: '/test-ws' });
    const states = listSubagentStates('parent-1');
    const last = states[states.length - 1]!;
    expect(last.capabilityMode).toBe('execute');
  });
});

describe('state-store 持久化往返', () => {
  it('save → load → 字段完整', () => {
    const state: SubagentState = {
      id: 'rt-1',
      parentId: 'p-1',
      persona: 'coder',
      capabilityMode: 'read-write',
      isolation: 'worktree',
      worktreePath: '/wt/rt-1',
      transcript: [{ role: 'user', content: 'hi' }],
      toolState: { offset: 5 },
      model: 'gpt-4o',
      status: 'running',
      startedAt: '2026-07-17T00:00:00.000Z',
    };
    saveSubagentState(state);
    const loaded = loadSubagentState('rt-1');
    expect(loaded).toEqual(state);
  });

  it('load 不存在 → null', () => {
    expect(loadSubagentState('nope')).toBeNull();
  });

  it('list 按 parentId 过滤', () => {
    saveSubagentState({
      id: 'a', parentId: 'p1', persona: 'general', capabilityMode: 'all', isolation: 'none',
      transcript: [], status: 'completed', startedAt: '2026-07-17T00:00:00.000Z',
    });
    saveSubagentState({
      id: 'b', parentId: 'p2', persona: 'general', capabilityMode: 'all', isolation: 'none',
      transcript: [], status: 'completed', startedAt: '2026-07-17T00:00:00.000Z',
    });
    expect(listSubagentStates('p1')).toHaveLength(1);
    expect(listSubagentStates('p1')[0]!.id).toBe('a');
    expect(listSubagentStates('p2')).toHaveLength(1);
    expect(listSubagentStates().length).toBeGreaterThanOrEqual(2);
  });

  it('delete 已存在 → true,再删 → false', () => {
    saveSubagentState({
      id: 'del-1', parentId: 'p', persona: 'general', capabilityMode: 'all', isolation: 'none',
      transcript: [], status: 'completed', startedAt: '2026-07-17T00:00:00.000Z',
    });
    expect(deleteSubagentState('del-1')).toBe(true);
    expect(loadSubagentState('del-1')).toBeNull();
    expect(deleteSubagentState('del-1')).toBe(false);
  });

  it('getSubagentStateDir 优先读取 IHUI_SUBAGENT_STATE_DIR', () => {
    process.env.IHUI_SUBAGENT_STATE_DIR = '/custom/dir';
    expect(getSubagentStateDir()).toBe('/custom/dir');
    delete process.env.IHUI_SUBAGENT_STATE_DIR;
  });

  it('execute 完成后 state.status=completed', async () => {
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'state check' }, { workspacePath: '/test-ws' });
    const states = listSubagentStates('parent-1');
    const running = states.filter((s) => s.status === 'running');
    const completed = states.filter((s) => s.status === 'completed');
    expect(running).toHaveLength(0);
    expect(completed.length).toBeGreaterThanOrEqual(1);
  });

  it('execute 失败后 state.status=failed + error 字段', async () => {
    vi.mocked(runToolLoop).mockRejectedValueOnce(new Error('boom'));
    const tool = createSubagentTool(baseParentOpts);
    await tool.execute({ task: 'fail state' }, { workspacePath: '/test-ws' });
    const states = listSubagentStates('parent-1');
    const failed = states.find((s) => s.status === 'failed');
    expect(failed).toBeDefined();
    expect(failed!.error).toContain('boom');
  });
});
