// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-067 回归:编辑器审批请求必须超时收口,且任何结局都清掉定时器。
 *
 * 失败形态(修前):只有 try/catch,SDK 侧 pending 只在收到响应或连接关闭时结算;
 * 编辑器不回 `session/request_permission` 时回合永久挂起,只能杀进程。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentContext } from '@agentclientprotocol/sdk';

import { PERMISSION_TIMEOUT_MS, requestPermissionFromEditor } from '../src/acp/server.js';

function makeCx(requestImpl: (method: string, params: unknown) => Promise<unknown>) {
  return {
    request: requestImpl,
    notify: async () => {},
  } as unknown as AgentContext;
}

const baseInput = {
  toolCallId: 'approval-timeout-1',
  kind: 'execute' as const,
  title: '危险操作审批:bash',
  options: [
    { optionId: 'allow', name: '允许本次执行', kind: 'allow_once' as const },
    { optionId: 'deny', name: '拒绝', kind: 'reject_once' as const },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('F-067 审批请求超时收口', () => {
  it('超时阈值导出为 60s', () => {
    expect(PERMISSION_TIMEOUT_MS).toBe(60_000);
  });

  it('编辑器不回复 → 到点返回 null(按取消/拒绝降级),且定时器已清理', async () => {
    vi.useFakeTimers();
    const cx = makeCx(() => new Promise(() => {}));

    const pending = requestPermissionFromEditor(cx, 'sess-1', baseInput);
    await vi.advanceTimersByTimeAsync(PERMISSION_TIMEOUT_MS);

    await expect(pending).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('及时回复 → 正常返回选中项,不等到超时,定时器已清理', async () => {
    vi.useFakeTimers();
    const cx = makeCx(async () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }));

    await expect(requestPermissionFromEditor(cx, 'sess-1', baseInput)).resolves.toBe('allow');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('请求失败(编辑器不支持)→ 返回 null,定时器已清理', async () => {
    vi.useFakeTimers();
    const cx = makeCx(async () => {
      throw new Error('method not found');
    });

    await expect(requestPermissionFromEditor(cx, 'sess-1', baseInput)).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('连接关闭导致 pending 拒绝 → 返回 null,定时器已清理', async () => {
    vi.useFakeTimers();
    let rejectRequest!: (error: Error) => void;
    const cx = makeCx(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );

    const pending = requestPermissionFromEditor(cx, 'sess-1', baseInput);
    rejectRequest(new Error('connection closed'));

    await expect(pending).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
