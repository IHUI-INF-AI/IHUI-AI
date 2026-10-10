// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D113 CLI 接线的**装车证明**(行为级,不是源码字符串断言)。
 *
 * 判据在 `tools/file-edit-preview.ts` 里有 15 条单测,派生与服务端的等值另有两把尺子;
 * 但本仓最高频的失效型是"函数在、判据对、**主循环一次都没调过它**"(守门 64/70/76/81/115
 * 全是同一课的复发)。所以这里直接驱动 `runToolLoop`,问三个只有跑起来才答得出的问题:
 *   ① 预览帧确实在**执行之前**到达(执行之后到达就等于没有预览,只有事后报告);
 *   ② 只有写类工具出帧 —— 非写类工具 0 帧(不是"发了空帧");
 *   ③ 没有消费方时(ACP / agent-core 那两条面尚未接线)主循环照跑、执行次数不变,
 *      即"发帧是旁路",摘掉渲染端不会改变执行语义。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ToolDeltaEvent } from '@ihui/api-client';

const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn() }));

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  // [调和 2026-10-11] G-916940③(e0f1e578ca)起 runToolLoop 无条件引用容量出口
  // (src/commands/agent.ts:1586 `opts.contextLimit ?? getModelContextCapacity(opts.modelId)`),
  // 而本 mock 工厂只给了网络边界四个导出 —— 缺这一项时本用例三条都在 runToolLoop
  // 启动行(102/127/145/159)崩于 "No \"getModelContextCapacity\" export is defined on
  // the \"@ihui/api-client\" mock",与 CI 红点逐行吻合。桩值 128_000 与真实出口对未知
  // modelId('test')的回落档等值(model-context-capacity.ts: DEFAULT_CONTEXT_CAPACITY
  // = 128_000),复用既有缺省语义而非新造档位;判据本体(帧时序/载荷/seq)一字未放宽。
  getModelContextCapacity: () => 128_000,
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
}));

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

import { runToolLoop } from '../src/commands/agent.js';
import type { ChatMessage } from '../src/context.js';
import { registerTools, clearTools, disableToolHub, type Tool } from '../src/tools/index.js';

const FIXTURE_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..', '.ihui-agent/tmp');
const CONTENT = 'line-1\nline-2\n';

function writeTool(name: string, onExecute: () => void): Tool {
  return {
    name,
    description: 'd113 wiring probe',
    parameters: {
      path: { type: 'string', description: 'p' },
      content: { type: 'string', description: 'c' },
    },
    required: ['path'],
    dangerLevel: 'write',
    execute: async () => {
      onExecute();
      return { success: true, output: 'ok' };
    },
  } as Tool;
}

describe('D113 runToolLoop 预览帧接线(执行前派生、旁路不发空帧)', () => {
  let workspace = '';
  let execOrder = 0;
  let order = 0;

  beforeEach(() => {
    disableToolHub();
    clearTools();
    streamChatMock.mockReset();
    execOrder = 0;
    order = 0;
    fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
    workspace = fs.mkdtempSync(path.join(FIXTURE_ROOT, 'd113-wire-'));
  });

  afterEach(() => {
    clearTools();
    if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
  });

  /** 让模型"发起一次工具调用":走原生 tool-call 事件面(与 prompt 模式共用同一条预派发循环) */
  function emitToolCall(toolName: string) {
    streamChatMock.mockImplementation(async (o: {
      onToolCall?: (e: { type: string; toolCallId: string; toolName: string; args?: Record<string, unknown> }) => void;
      onDelta: (d: string) => void;
    }) => {
      o.onToolCall?.({
        type: 'tool-call-start',
        toolCallId: 'call-1',
        toolName,
        args: { path: 'a.txt', content: CONTENT },
      });
      o.onDelta('done');
    });
  }

  async function run(opts?: { withPreviewSink?: boolean }) {
    const frames: Array<{ events: ToolDeltaEvent[]; execOrderAtEmit: number }> = [];
    await runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'go' } as ChatMessage],
      // confirmDangerous=true:写类工具在 default 档要走确认,这里放行以覆盖"真执行"那一条路径
      ctx: { workspacePath: workspace, confirmDangerous: async () => true },
      sessionId: 'd113-wire',
      maxIterations: 1,
      ...(opts?.withPreviewSink === false
        ? {}
        : {
            onToolDeltaFrames: (events: ToolDeltaEvent[]) => {
              frames.push({ events, execOrderAtEmit: execOrder });
            },
          }),
    });
    return frames;
  }

  it('写类工具:帧在 execute 之前到达,载荷是累积文本且 seq 从 1 起', async () => {
    emitToolCall('write_file');
    registerTools([
      writeTool('write_file', () => {
        execOrder = ++order;
      }),
    ]);
    const frames = await run();

    expect(frames).toHaveLength(1);
    const [{ events, execOrderAtEmit }] = frames;
    expect(execOrderAtEmit).toBe(0); // 发帧时 execute 还没跑过
    expect(execOrder).toBe(1); // 确实跑了,且只有一次
    expect(events?.map((e) => e.seq)).toEqual([1]);
    expect(events?.[0]?.partialText).toBe('line-1\nline-2'); // 行尾分隔符不产出空段
    expect(events?.[0]?.toolCallId).toMatch(/^cli-preview-/);
  });

  it('非写类工具:0 帧(不发空帧),执行不受影响', async () => {
    emitToolCall('read_file_probe');
    registerTools([
      writeTool('read_file_probe', () => {
        execOrder = ++order;
      }),
    ]);
    const frames = await run();

    // 0 帧 = 回调根本不被告知这一条(而不是"收到一批空帧"),与三端"空 id 丢弃"同取向
    expect(frames).toHaveLength(0);
    expect(execOrder).toBe(1);
  });

  it('没有消费方时(ACP / agent-core 尚未接线):主循环照跑,执行次数不变', async () => {
    emitToolCall('write_file');
    registerTools([
      writeTool('write_file', () => {
        execOrder = ++order;
      }),
    ]);
    await run({ withPreviewSink: false });
    expect(execOrder).toBe(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
