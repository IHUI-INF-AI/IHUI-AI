// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * agent-inbox 测试 — 跨重启持久投递行为(对标 Qoder agent_inbox_items)。
 *
 * 覆盖:
 *   - 入队 / 按成员读取基本流程
 *   - deliveryMode 三态(queued/started/steered)
 *   - 消费游标推进:重启后 pendingFor 不再返回已消费条目
 *   - markDelivered / markFailed 终态与错误码
 *   - recoveryBudget 三档(可重试 / 预算耗尽 / 负数非法)
 *   - compact 回收终态条目
 *   - listScopes 扫描
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  enqueue,
  loadInbox,
  pendingFor,
  markDelivered,
  markFailed,
  recoveryBudget,
  retryPlanFor,
  compact,
  listScopes,
  nextEventSeq,
  MAX_RECOVERY_ATTEMPTS,
} from '../src/acp/agent-inbox.js';

// 用临时目录替换 ~/.ihui/inbox,测试间隔离
let tmpDir: string;
let origEnv: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-inbox-test-'));
  origEnv = process.env.IHUI_CLI_INBOX_DIR;
  process.env.IHUI_CLI_INBOX_DIR = tmpDir;
});

afterEach(() => {
  if (origEnv !== undefined) {
    process.env.IHUI_CLI_INBOX_DIR = origEnv;
  } else {
    delete process.env.IHUI_CLI_INBOX_DIR;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SCOPE = 'test-scope';
const MEMBER_A = 'agent-a';
const MEMBER_B = 'agent-b';

describe('入队与基本读取', () => {
  it('入队一条投递 → status=pending,eventSeq 自增', () => {
    const { item } = enqueue({
      scope: SCOPE,
      id: 'msg-1',
      toMemberId: MEMBER_A,
      fromMemberId: MEMBER_B,
      content: 'hello',
    });

    expect(item.status).toBe('pending');
    expect(item.deliveryMode).toBe('queued'); // 默认 queued
    expect(item.eventSeq).toBe(1);
    expect(item.content).toBe('hello');
  });

  it('多条入队 → eventSeq 递增', () => {
    enqueue({ scope: SCOPE, id: 'm1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'a' });
    enqueue({ scope: SCOPE, id: 'm2', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'b' });
    const { item } = enqueue({ scope: SCOPE, id: 'm3', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'c' });

    expect(item.eventSeq).toBe(3);
  });

  it('空 inbox → loadInbox 返回空态', () => {
    const inbox = loadInbox('nonexistent');
    expect(inbox.items).toEqual([]);
    expect(inbox.cursors).toEqual({});
  });

  it('nextEventSeq 空文件 → 1', () => {
    expect(nextEventSeq('empty-scope')).toBe(1);
  });
});

describe('deliveryMode 三态', () => {
  it('queued 独立排队(默认)', () => {
    const { item } = enqueue({
      scope: SCOPE, id: 'q1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x',
    });
    expect(item.deliveryMode).toBe('queued');
  });

  it('started 并入活跃回合', () => {
    const { item } = enqueue({
      scope: SCOPE, id: 's1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x',
      deliveryMode: 'started',
    });
    expect(item.deliveryMode).toBe('started');
  });

  it('steered 插话', () => {
    const { item } = enqueue({
      scope: SCOPE, id: 'st1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x',
      deliveryMode: 'steered',
    });
    expect(item.deliveryMode).toBe('steered');
  });
});

describe('消费游标推进(重启不重放)', () => {
  it('markDelivered 推进游标 → pendingFor 不再返回该条', () => {
    enqueue({ scope: SCOPE, id: 'd1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x' });

    // 投递前可见
    let pending = pendingFor(SCOPE, MEMBER_A);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe('d1');

    // 送达后游标推进
    markDelivered(SCOPE, 'd1');

    // 重启(重新 loadInbox)后不再返回
    pending = pendingFor(SCOPE, MEMBER_A);
    expect(pending).toHaveLength(0);
  });

  it('游标只对目标成员可见(其他成员仍能看到自己的待投递)', () => {
    enqueue({ scope: SCOPE, id: 'x1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'to-A' });
    enqueue({ scope: SCOPE, id: 'x2', toMemberId: MEMBER_B, fromMemberId: MEMBER_A, content: 'to-B' });

    markDelivered(SCOPE, 'x1');

    expect(pendingFor(SCOPE, MEMBER_A)).toHaveLength(0); // A 已消费
    expect(pendingFor(SCOPE, MEMBER_B)).toHaveLength(1); // B 还未消费
  });

  it('多条按 eventSeq 升序返回', () => {
    enqueue({ scope: SCOPE, id: 'seq-3', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'third', eventSeq: 3 });
    enqueue({ scope: SCOPE, id: 'seq-1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'first', eventSeq: 1 });
    enqueue({ scope: SCOPE, id: 'seq-2', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'second', eventSeq: 2 });

    const pending = pendingFor(SCOPE, MEMBER_A);
    expect(pending.map((it) => it.eventSeq)).toEqual([1, 2, 3]);
  });

  it('乱序送达不越过更早的 pending(连续水位,不制造永久盲区)', () => {
    enqueue({ scope: SCOPE, id: 'o1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'first' });
    enqueue({ scope: SCOPE, id: 'o2', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'second' });

    // 后一条先送达(前一条投递失败/乱序):游标不能跳到 o2,否则 o1 永久不可见
    markDelivered(SCOPE, 'o2');

    const pending = pendingFor(SCOPE, MEMBER_A);
    expect(pending.map((it) => it.id)).toEqual(['o1']);

    // o1 补齐后再推进,游标才越过两条
    markDelivered(SCOPE, 'o1');
    expect(pendingFor(SCOPE, MEMBER_A)).toHaveLength(0);
    expect(loadInbox(SCOPE).cursors[MEMBER_A]).toBe(2);
  });
});

describe('markFailed 终态', () => {
  it('标记失败 → status=failed,带 errorCode,不再出现在 pendingFor', () => {
    enqueue({ scope: SCOPE, id: 'f1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x' });

    markFailed(SCOPE, 'f1', 'TRANSPORT_TIMEOUT');

    const inbox = loadInbox(SCOPE);
    const failed = inbox.items.find((it) => it.id === 'f1');
    expect(failed!.status).toBe('failed');
    expect(failed!.errorCode).toBe('TRANSPORT_TIMEOUT');
    expect(failed!.settledAt).toBeDefined();

    // 不再出现在 pending
    expect(pendingFor(SCOPE, MEMBER_A)).toHaveLength(0);
  });
});

describe('recoveryBudget 恢复预算', () => {
  it('attempts < MAX → 可重试', () => {
    const result = recoveryBudget(0);
    expect(result.retryable).toBe(true);
    expect(result.reason).toContain('剩余预算');
  });

  it('attempts >= MAX → 判持久失败', () => {
    const result = recoveryBudget(MAX_RECOVERY_ATTEMPTS);
    expect(result.retryable).toBe(false);
    expect(result.reason).toContain('恢复预算耗尽');
  });

  it('负数 attempts → 判持久失败', () => {
    const result = recoveryBudget(-1);
    expect(result.retryable).toBe(false);
    expect(result.reason).toContain('负数非法');
  });
});

describe('retryPlanFor 重投计划(budget + jitter 退避)', () => {
  it('预算内 → 重投,retryAt = now + 退避(delay ∈ [0,30000))', () => {
    const now = 1_000_000;
    const plan = retryPlanFor(0, now);
    expect(plan.retry).toBe(true);
    expect(plan.delayMs).toBeGreaterThanOrEqual(0);
    expect(plan.delayMs).toBeLessThan(30000); // full-jitter 上界不触及 cap
    expect(plan.retryAt).toBe(now + plan.delayMs);
    expect(plan.reason).toContain('重投');
  });

  it('预算耗尽 → 不重投,delay/retryAt 归零', () => {
    const plan = retryPlanFor(MAX_RECOVERY_ATTEMPTS, 1_000_000);
    expect(plan.retry).toBe(false);
    expect(plan.delayMs).toBe(0);
    expect(plan.retryAt).toBe(0);
    expect(plan.reason).toContain('耗尽');
  });

  it('退避随 attempts 单调封顶 —— jitter 后仍 ≤ cap', () => {
    for (let a = 0; a <= 20; a++) {
      const plan = retryPlanFor(a, 0);
      if (plan.retry) {
        expect(plan.delayMs).toBeLessThanOrEqual(30000);
      }
    }
  });
});

describe('compact 回收终态条目', () => {
  it('有终态条目 → 回收并返回条目数', () => {
    enqueue({ scope: SCOPE, id: 'c1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'done' });
    enqueue({ scope: SCOPE, id: 'c2', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'still pending' });

    markDelivered(SCOPE, 'c1');

    const reclaimed = compact(SCOPE);
    expect(reclaimed).toBe(1); // 只回收 delivered 的 c1

    const inbox = loadInbox(SCOPE);
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]!.id).toBe('c2'); // pending 保留
  });

  it('全部 pending → compact 返回 0,不动任何条目', () => {
    enqueue({ scope: SCOPE, id: 'p1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x' });

    const reclaimed = compact(SCOPE);
    expect(reclaimed).toBe(0);

    const inbox = loadInbox(SCOPE);
    expect(inbox.items).toHaveLength(1); // pending 不动
  });

  it('compact 回收终态条目后,新入队的序号越过保留游标(不被挡成永久不可见)', () => {
    enqueue({ scope: SCOPE, id: 'r1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'old' });
    markDelivered(SCOPE, 'r1');
    expect(compact(SCOPE)).toBe(1); // 条目被回收,游标仍为 1
    expect(loadInbox(SCOPE).cursors[MEMBER_A]).toBe(1);

    const second = enqueue({
      scope: SCOPE, id: 'r2', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'new',
    });
    expect(second.item.eventSeq).toBe(2); // 不是回退到 1
    expect(pendingFor(SCOPE, MEMBER_A).map((it) => it.id)).toEqual(['r2']);
  });
});

describe('listScopes 扫描', () => {
  it('无 inbox 文件 → 返回空数组', () => {
    expect(listScopes()).toEqual([]);
  });

  it('有多个 scope → 返回所有 scope 名', () => {
    enqueue({ scope: 'alpha', id: 'a1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x' });
    enqueue({ scope: 'beta', id: 'b1', toMemberId: MEMBER_A, fromMemberId: MEMBER_B, content: 'x' });

    const scopes = listScopes().sort();
    expect(scopes).toEqual(['alpha', 'beta']);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
