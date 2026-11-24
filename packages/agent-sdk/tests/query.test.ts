// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AgentSdkError,
  query,
  type AgentEvent,
  type PermissionDecision,
  type QueryOptions,
  type QueryResult,
  type ToolPermissionRequest,
} from '../src/index.js';

const fixture = fileURLToPath(new URL('./fixtures/fake-agent.mjs', import.meta.url));

function optionsFor(scenario: string, extra: Partial<QueryOptions> = {}): QueryOptions {
  return {
    command: process.execPath,
    args: [fixture, scenario],
    cwd: process.cwd(),
    prompt: 'run echo',
    ...extra,
  };
}

async function collect(
  options: QueryOptions,
): Promise<{ events: AgentEvent[]; result: QueryResult }> {
  const generator = query(options);
  const events: AgentEvent[] = [];
  for (;;) {
    const step = await generator.next();
    if (step.done) return { events, result: step.value };
    events.push(step.value);
  }
}

function texts(events: AgentEvent[]): string[] {
  return events.flatMap((event) => (event.type === 'message' ? [event.text] : []));
}

describe('query()', () => {
  it('成功回合：事件流完整，审批带 toolUseId 且批准回写为 allow', async () => {
    const seen: ToolPermissionRequest[] = [];
    const { events, result } = await collect(
      optionsFor('success', {
        canUseTool: async (request) => {
          seen.push(request);
          return { behavior: 'allow' };
        },
      }),
    );

    expect(seen).toHaveLength(1);
    const request = seen[0];
    if (!request) throw new Error('missing permission request');
    expect(request.toolUseId).toBe('tc1');
    expect(request.toolName).toBe('shell');
    expect(request.input).toEqual({ command: 'echo hi' });
    expect(request.options.map((option) => option.kind)).toEqual(['allow_once', 'reject_once']);

    expect(texts(events)).toEqual(['hello', 'final:approved']);
    expect(events.some((event) => event.type === 'tool_call' && event.toolCallId === 'tc1')).toBe(
      true,
    );
    expect(
      events.some(
        (event) =>
          event.type === 'tool_update' && event.toolCallId === 'tc1' && event.status === 'completed',
      ),
    ).toBe(true);
    expect(result.sessionId).toBe('s1');
    expect(result.stopReason).toBe('end_turn');
    expect(result.exitCode).toBe(0);
  });

  it('拒绝审批：回写 reject 选项', async () => {
    const { events, result } = await collect(
      optionsFor('success', {
        canUseTool: async () => ({ behavior: 'deny', message: 'not allowed' }),
      }),
    );
    expect(texts(events)).toEqual(['hello', 'final:denied']);
    expect(result.stopReason).toBe('end_turn');
  });

  it('没有 canUseTool：审批按取消降级，不挂起', async () => {
    const { events, result } = await collect(optionsFor('success'));
    expect(texts(events)).toEqual(['hello', 'final:cancelled']);
    expect(result.stopReason).toBe('end_turn');
  });

  it('审批超时：按取消回写', async () => {
    const { events, result } = await collect(
      optionsFor('success', {
        permissionTimeoutMs: 50,
        canUseTool: () => new Promise<PermissionDecision>(() => {}),
      }),
    );
    expect(texts(events)).toEqual(['hello', 'final:cancelled']);
    expect(result.stopReason).toBe('end_turn');
  });

  it('坏行产出 protocol_error 后会话仍能完成', async () => {
    const { events, result } = await collect(
      optionsFor('bad-line', {
        canUseTool: async () => ({ behavior: 'allow' }),
      }),
    );
    const protocolError = events.find((event) => event.type === 'protocol_error');
    if (!protocolError || protocolError.type !== 'protocol_error') {
      throw new Error('expected a protocol_error event');
    }
    expect(protocolError.message).toContain('invalid JSON');
    expect(texts(events)).toEqual(['hello', 'final:approved']);
    expect(result.stopReason).toBe('end_turn');
  });

  it('非零退出：抛 AGENT_EXIT，带退出码与 stderr', async () => {
    let caught: unknown = null;
    try {
      await collect(optionsFor('exit-nonzero'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AgentSdkError);
    const sdkError = caught as AgentSdkError;
    expect(sdkError.code).toBe('AGENT_EXIT');
    expect(sdkError.exitCode).toBe(3);
    expect(sdkError.stderr).toContain('fixture exploded');
  });

  it('abort：取消在飞回合并在宽限后杀掉子进程', async () => {
    const controller = new AbortController();
    let child: ChildProcess | undefined;
    const generator = query(
      optionsFor('hang', {
        signal: controller.signal,
        abortGraceMs: 100,
        killGraceMs: 100,
        onSpawn: (spawned) => {
          child = spawned;
        },
      }),
    );

    const first = await generator.next();
    expect(first.done).toBe(false);
    expect(child).toBeDefined();

    controller.abort();
    let step: IteratorResult<AgentEvent, QueryResult> = await generator.next();
    while (!step.done) step = await generator.next();

    expect(step.value.stopReason).toBe('cancelled');
    expect(child?.exitCode !== null || child?.signalCode !== null).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
