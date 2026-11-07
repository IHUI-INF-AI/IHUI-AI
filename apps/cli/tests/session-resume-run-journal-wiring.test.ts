// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会话断点续跑 × runToolLoop 的**装车证明**(不是日志模块单测)。
//
// 判的是接线关系:
//   1) 恢复首轮重发"中断前已结算"的同一调用 ⇒ 工具 execute 一次都不许跑,
//      结果从日志回灌(不重复副作用、不丢已完成步骤);
//   2) started 但没结算的调用 ⇒ 一律按"副作用未知"拒绝重放,并落 errorType;
//   3) 恢复上下文确实以一条 user 消息喂进模型(否则模型只看到半截历史);
//   4) 反向对照:同一套桩不传 resumePlan ⇒ 工具照常执行一次,证明 1) 测的是接线不是恒真。

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type StreamChatOpts = {
  onDelta: (delta: string) => void;
  onError?: (err: string, info?: unknown) => void;
  onToolCall?: (event: {
    type: string;
    toolCallId: string;
    toolName: string;
    args?: Record<string, unknown>;
  }) => void;
};

const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn() }));

import type * as ApiClient from '@ihui/api-client';
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    streamChat: streamChatMock,
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
    fetchApi: vi.fn(async () => ({ success: true, data: { recorded: 0, failed: 0 } })),
    getToken: () => null,
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

import { runToolLoop } from '../src/commands/agent.js';
import type { ChatMessage } from '../src/context.js';
import {
  clearTools,
  disableToolHub,
  registerTools,
  type Tool,
} from '../src/tools/index.js';
import {
  createRunJournal,
  loadRunJournal,
  planResume,
  recordPlanned,
  recordSettled,
  recordStarted,
  recoverInterruptedJournal,
  type RunJournal,
} from '../src/sessions/run-journal.js';

const TOOL_NAME = 'resume_wire_probe';
const CALL_ARGS = { path: 'a.txt' };
const SESSION_ID = 'wire-session-resume';
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function toolCallEvent() {
  return { type: 'tool-call-start', toolCallId: 'call-1', toolName: TOOL_NAME, args: { ...CALL_ARGS } };
}

describe('会话断点续跑接线(runToolLoop 真的在按日志去重/回灌/拒绝重放)', () => {
  let workspace = '';
  let homeDir = '';
  let execCount = 0;

  function probeTool(): Tool {
    return {
      name: TOOL_NAME,
      description: 'resume wiring probe',
      parameters: { path: { type: 'string', description: 'p' } },
      required: ['path'],
      dangerLevel: 'read',
      execute: async () => {
        execCount += 1;
        return { success: true, output: 'FRESH_OUTPUT' };
      },
    };
  }

  /** 造一份"中断前"日志:turn 1 的第 1 步要么已结算,要么 started 未结算。 */
  function makePriorJournal(kind: 'settled' | 'unknown'): RunJournal {
    const journal = createRunJournal(SESSION_ID, workspace);
    const planned = recordPlanned(journal, 1, {
      toolCallId: 'prior-call-1',
      toolName: TOOL_NAME,
      args: { ...CALL_ARGS },
    });
    recordStarted(journal, 1, planned.seq);
    if (kind === 'settled') {
      recordSettled(journal, 1, planned.seq, { ok: true, output: 'PRIOR_OUTPUT' });
    }
    // settled 调用保留;started 未结算会被收敛成 unknown —— 这正是"副作用是否落地未知"的来源。
    return recoverInterruptedJournal(journal);
  }

  function mockTwoTurns() {
    let turn = 0;
    streamChatMock.mockImplementation(async (o: StreamChatOpts) => {
      turn += 1;
      if (turn === 1) {
        o.onToolCall?.(toolCallEvent());
        await tick();
        return;
      }
      o.onDelta('完成。');
    });
  }

  beforeEach(() => {
    disableToolHub();
    clearTools();
    streamChatMock.mockReset();
    execCount = 0;
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-resume-journal-'));
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-resume-wire-'));
    // 日志默认落在 ~/.ihui/sessions:把 home 指到临时目录,避免测试污染真实会话目录。
    process.env.USERPROFILE = homeDir;
    process.env.HOME = homeDir;
    registerTools([probeTool()]);
  });

  afterEach(() => {
    clearTools();
    fs.rmSync(homeDir, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('已结算调用在恢复首轮被重发 ⇒ 不执行、回灌原结果、模型收到恢复上下文', async () => {
    const journal = makePriorJournal('settled');
    const plan = planResume(journal);
    expect(plan.completedCount).toBe(1);
    expect(plan.unknownCount).toBe(0);
    expect(plan.canAutoResume).toBe(true);

    const messages: ChatMessage[] = [{ role: 'user', content: 'go' }];
    const toolOutcomes: Array<{ ok: boolean; output: string }> = [];
    mockTwoTurns();

    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: workspace },
      sessionId: SESSION_ID,
      maxIterations: 3,
      runJournal: journal,
      resumePlan: plan,
      onToolResult: (_name, ok, output) => {
        toolOutcomes.push({ ok, output });
      },
    });

    expect(result.stopReason).toBe('end_turn');
    expect(execCount).toBe(0); // ← 核心:已结算步骤没有被重复执行
    expect(toolOutcomes[0]?.ok).toBe(true);
    expect(toolOutcomes[0]?.output).toContain('[resume]');
    expect(toolOutcomes[0]?.output).toContain('PRIOR_OUTPUT');
    // 恢复上下文真的喂进模型(否则模型只看到中断前历史)
    expect(messages.some((m) => m.role === 'user' && String(m.content).includes('[resume]'))).toBe(true);

    // 日志终局:completion 落盘,恢复首轮的这条调用按"回灌"结算
    const persisted = loadRunJournal(SESSION_ID);
    expect(persisted?.status).toBe('completed');
    const replay = persisted?.turns.flatMap((t) => t.calls).at(-1);
    expect(replay?.status).toBe('settled');
    expect(replay?.outputExcerpt).toContain('[resume]');
  });

  it('started 未结算 ⇒ 恢复首轮拒绝重放(不猜副作用是否落地)并落 resume_unknown_effect', async () => {
    const journal = makePriorJournal('unknown');
    const plan = planResume(journal);
    expect(plan.unknownCount).toBe(1);
    expect(plan.canAutoResume).toBe(false);
    expect(plan.summaryLines.join('\n')).toContain('状态未知');

    const messages: ChatMessage[] = [{ role: 'user', content: 'go' }];
    const toolOutcomes: Array<{ ok: boolean; output: string }> = [];
    mockTwoTurns();

    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: workspace },
      sessionId: SESSION_ID,
      maxIterations: 3,
      runJournal: journal,
      resumePlan: plan,
      onToolResult: (_name, ok, output) => {
        toolOutcomes.push({ ok, output });
      },
    });

    expect(result.stopReason).toBe('end_turn');
    expect(execCount).toBe(0); // ← 未知副作用的调用绝不再跑一次
    expect(toolOutcomes[0]?.ok).toBe(false);
    const persisted = loadRunJournal(SESSION_ID);
    const replay = persisted?.turns.flatMap((t) => t.calls).at(-1);
    expect(replay?.errorType).toBe('resume_unknown_effect');
  });

  it('反向对照:同一套桩不传 resumePlan ⇒ 工具照常执行(去重不是恒真)', async () => {
    const journal = createRunJournal(SESSION_ID, workspace);
    const messages: ChatMessage[] = [{ role: 'user', content: 'go' }];
    mockTwoTurns();

    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: workspace },
      sessionId: SESSION_ID,
      maxIterations: 3,
      runJournal: journal,
    });

    expect(result.stopReason).toBe('end_turn');
    expect(execCount).toBe(1); // ← 没有 resumePlan 时必须真的跑
    expect(messages.some((m) => String(m.content).includes('[resume]'))).toBe(false);
  });
});
