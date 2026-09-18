import { describe, it, expect } from 'vitest';
import { requestPermissionFromEditor } from '../src/acp/server.js';
import type { AgentContext } from '@agentclientprotocol/sdk';

/** 构造最小 mock cx:request 可注入行为,notify 记录调用 */
function makeCx(requestImpl: (method: string, params: unknown) => Promise<unknown>) {
  const notified: Array<{ method: string; params: unknown }> = [];
  const cx = {
    request: requestImpl,
    notify: async (method: string, params: unknown) => {
      notified.push({ method, params });
    },
  } as unknown as AgentContext;
  return { cx, notified };
}

const baseInput = {
  toolCallId: 'dangerous-test-1',
  kind: 'execute' as const,
  title: '危险操作审批:bash',
  contentText: '{"command":"rm -rf /"}',
  options: [
    { optionId: 'allow', name: '允许本次执行', kind: 'allow_once' as const },
    { optionId: 'deny', name: '拒绝', kind: 'reject_once' as const },
  ],
};

describe('requestPermissionFromEditor(D5 工具级审批统一通道)', () => {
  it('编辑器选中 allow → 返回 allow', async () => {
    const { cx } = makeCx(async () => ({
      outcome: { outcome: 'selected', optionId: 'allow' },
    }));
    expect(await requestPermissionFromEditor(cx, 'sess-1', baseInput)).toBe('allow');
  });

  it('编辑器选中 reject → 返回 reject(非 allow 即拒绝由调用方判定)', async () => {
    const { cx } = makeCx(async () => ({
      outcome: { outcome: 'selected', optionId: 'reject' },
    }));
    expect(await requestPermissionFromEditor(cx, 'sess-1', baseInput)).toBe('reject');
  });

  it('编辑器取消(cancelled)→ 返回 null', async () => {
    const { cx } = makeCx(async () => ({
      outcome: { outcome: 'cancelled' },
    }));
    expect(await requestPermissionFromEditor(cx, 'sess-1', baseInput)).toBeNull();
  });

  it('编辑器不支持/请求抛错 → 返回 null(安全降级,不向上抛)', async () => {
    const { cx } = makeCx(async () => {
      throw new Error('method not found');
    });
    expect(await requestPermissionFromEditor(cx, 'sess-1', baseInput)).toBeNull();
  });

  it('请求参数携带 toolCall 与 options(协议形态正确)', async () => {
    let captured: unknown;
    const { cx } = makeCx(async (_method, params) => {
      captured = params;
      return { outcome: { outcome: 'selected', optionId: 'allow' } };
    });
    await requestPermissionFromEditor(cx, 'sess-1', baseInput);
    const p = captured as { sessionId: string; toolCall: { toolCallId: string; kind: string; title: string }; options: unknown[] };
    expect(p.sessionId).toBe('sess-1');
    expect(p.toolCall.toolCallId).toBe('dangerous-test-1');
    expect(p.toolCall.kind).toBe('execute');
    expect(p.toolCall.title).toContain('bash');
    expect(p.options).toHaveLength(2);
  });
});
