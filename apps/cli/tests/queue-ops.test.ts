// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D38 队列语义完整交互 — cli 端消费共享判定层的定向测试(H18 跨端消费矩阵)。
 *
 * 覆盖三类:
 *   1. 许可门:reorder/edit/undo/interruptAndRun/setMode 经 queueInteractionPerms +
 *      interactionAllowed 的 (action, reason) 组合矩阵(流式锁重排、空队拒撤回、
 *      setMode 恒可切)。
 *   2. 纯函数编排:PromptQueue.reorderPending / editPendingText 的 W27 不变式
 *      (引用集恒等、createdAt 元数据不动、越界/空文本 no-op)。
 *   3. 模式与打断计划:cliResolveFollowUpMode 值域闭合;cliInterruptRunPlan
 *      stopFirst/thenRun 派发(队首由调用方传入,函数不触碰队列)。
 */
import { describe, expect, it } from 'vitest';

import { PromptQueue } from '../src/prompt-queue.js';
import {
  cliInterruptRunPlan,
  cliQueueInteractionAllowed,
  cliQueuePerms,
  cliResolveFollowUpMode,
} from '../src/commands/queue-ops.js';

describe('D38 cli 许可门(共享层 queueInteractionPerms + interactionAllowed)', () => {
  it('流式中锁定重排,队列非空可撤回', () => {
    const perms = cliQueuePerms({ hasQueuedMessages: true, streaming: true });
    expect(perms.canReorder).toBe(false);
    expect(perms.canUndo).toBe(true);
    expect(perms.reasonKey).toBe('reason.turnRunning');
    const v = cliQueueInteractionAllowed('reorder', { hasQueuedMessages: true, streaming: true });
    expect(v.allowed).toBe(false);
    expect(v.deniedKey).toBe('denied.reorder');
  });

  it('空队列时 undo/edit 被拒;interruptAndRun 只受 Runtime 插话能力门(cli 恒支持 ⇒ allowed)', () => {
    for (const kind of ['undo', 'edit'] as const) {
      const v = cliQueueInteractionAllowed(kind, {
        hasQueuedMessages: false,
        streaming: false,
      });
      expect(v.allowed).toBe(false);
    }
    // D69 canInterject 只取决于 Runtime 能力协商,与队列存在性无关(input-notices.ts)
    const iv = cliQueueInteractionAllowed('interruptAndRun', {
      hasQueuedMessages: false,
      streaming: false,
    });
    expect(iv.allowed).toBe(true);
  });

  it('setMode 恒可切(用户偏好不经能力门)', () => {
    const v = cliQueueInteractionAllowed('setMode', {
      hasQueuedMessages: false,
      streaming: true,
    });
    expect(v.allowed).toBe(true);
    expect(v.deniedKey).toBeNull();
  });
});

describe('D38 PromptQueue 编排(W27 不变式)', () => {
  function makeQueue(count: number): PromptQueue {
    const q = new PromptQueue();
    for (let i = 0; i < count; i += 1) q.enqueue(`p${i}`);
    return q;
  }

  it('reorderPending:重排后引用集/长度恒等,元数据不动', () => {
    const q = makeQueue(3);
    const before = q.snapshot().filter((it) => it.status === 'pending');
    expect(q.reorderPending(0, 2)).toBe(true);
    const after = q.snapshot().filter((it) => it.status === 'pending');
    expect(after).toHaveLength(before.length);
    expect(new Set(after)).toEqual(new Set(before)); // 同一批对象引用
    expect(after.map((it) => it.id)).toEqual([before[1]!.id, before[2]!.id, before[0]!.id]);
    // 时间戳字段逐项等于自身原值(引用集恒等已保证对象未被替换)
    expect(after.every((it) => it.enqueuedAt === before.find((b) => b.id === it.id)!.enqueuedAt)).toBe(true);
  });

  it('reorderPending:越界/同位/空队列 no-op 返回 false 且不改引用', () => {
    const q = makeQueue(2);
    const snap = q.snapshot();
    expect(q.reorderPending(0, 5)).toBe(false);
    expect(q.reorderPending(1, 1)).toBe(false);
    expect(q.snapshot()).toEqual(snap);
    const empty = new PromptQueue();
    expect(empty.reorderPending(0, 1)).toBe(false);
  });

  it('editPendingText:只改文本,enqueuedAt/id/status 不动;空文本/未知 id no-op', () => {
    const q = makeQueue(2);
    const first = q.snapshot()[0]!;
    const createdAt = first.enqueuedAt;
    expect(q.editPendingText(first.id, '  new text  ')).toBe(true);
    const edited = q.snapshot().find((it) => it.id === first.id)!;
    expect(edited.prompt).toBe('new text'); // applyQueueEdit 判据:trim 后非空才接受,存 trim 值
    expect(edited.enqueuedAt).toBe(createdAt);
    expect(edited.status).toBe('pending');
    expect(q.editPendingText(first.id, '   ')).toBe(false); // trim 后空 → no-op
    expect(q.editPendingText('no-such-id', 'x')).toBe(false);
  });
});

describe('D38 模式与打断计划', () => {
  it('cliResolveFollowUpMode 值域闭合:steer/queue 通过,其余 ok=false', () => {
    expect(cliResolveFollowUpMode('steer')).toEqual({
      ok: true,
      resolution: { mode: 'steer', degraded: false, degradedKey: null },
    });
    expect(cliResolveFollowUpMode('queue').ok).toBe(true);
    expect(cliResolveFollowUpMode('followUp').ok).toBe(false);
  });

  it('cliInterruptRunPlan:流式+有队首 → stopFirst 且 thenRun=队首;空队 thenRun=null(计划层不猜队首)', () => {
    const running = cliInterruptRunPlan({ hasQueuedMessages: true, streaming: true }, 'q1');
    expect(running).toEqual({ allowed: true, deniedKey: null, stopFirst: true, thenRun: 'q1' });
    const idle = cliInterruptRunPlan({ hasQueuedMessages: true, streaming: false }, 'q1');
    expect(idle.stopFirst).toBe(false);
    const empty = cliInterruptRunPlan({ hasQueuedMessages: false, streaming: false }, null);
    expect(empty.allowed).toBe(true);
    expect(empty.stopFirst).toBe(false);
    expect(empty.thenRun).toBeNull();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
