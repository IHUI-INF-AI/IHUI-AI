// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 消息身份一致性 + 稳定指纹 + 日志上限。
 *
 * 钉五件事:
 *   ① 同一 messageId 跨角色 ⇒ 抛错(否则客户端把两种内容拼进一条消息);
 *   ② 不同会话的同名 messageId 合法(各自命名空间);
 *   ③ 缺 messageId 默认宽松(展示帧合法),严格模式下报错;
 *   ④ canonicalJson 键排序稳定(同内容不同构造顺序得到同一串);
 *   ⑤ 日志超限抛结构化错误,不静默截断。
 */
import { describe, expect, it } from 'vitest';

import {
  JOURNAL_LIMITS,
  MessageIdentityError,
  MessageIdentityTracker,
  JournalOverflowError,
  assertFrameWithinLimit,
  assertTotalWithinLimit,
  canonicalJson,
  frameBytes,
  messageIdentityOf,
  normalizeUpdateType,
  totalBytes,
  type RawUpdateFrame,
} from '../src/acp/message-identity.js';

const frame = (sessionId: string, sessionUpdate: string, messageId?: string): RawUpdateFrame => ({
  sessionId,
  update: { sessionUpdate, ...(messageId === undefined ? {} : { messageId }) },
});

describe('normalizeUpdateType', () => {
  it('chunk 型归一成角色', () => {
    expect(normalizeUpdateType('agent_message_chunk')).toBe('agent_message');
    expect(normalizeUpdateType('agent_thought_chunk')).toBe('agent_thought');
    expect(normalizeUpdateType('user_message_chunk')).toBe('user_message');
  });

  it('已是角色名则原样返回', () => {
    expect(normalizeUpdateType('agent_message')).toBe('agent_message');
  });

  it('非消息类更新不参与身份判定', () => {
    expect(normalizeUpdateType('tool_call_update')).toBeUndefined();
    expect(normalizeUpdateType('plan')).toBeUndefined();
    expect(normalizeUpdateType(undefined)).toBeUndefined();
  });
});

describe('messageIdentityOf', () => {
  it('有 messageId 的 chunk ⇒ 返回身份', () => {
    const id = messageIdentityOf(frame('s1', 'agent_message_chunk', 'm1'));
    expect(id).toEqual({ sessionId: 's1', messageId: 'm1', updateType: 'agent_message' });
  });

  it('缺 messageId 默认宽松返回 undefined(展示帧合法)', () => {
    expect(messageIdentityOf(frame('s1', 'agent_message_chunk'))).toBeUndefined();
  });

  it('缺 messageId 且严格模式 ⇒ 抛错', () => {
    expect(() =>
      messageIdentityOf(frame('s1', 'agent_message_chunk'), { requireMessageId: true }),
    ).toThrow(MessageIdentityError);
  });

  it('非消息类帧一律 undefined(不参与判定)', () => {
    expect(messageIdentityOf(frame('s1', 'tool_call_update', 'm1'))).toBeUndefined();
  });
});

describe('MessageIdentityTracker', () => {
  it('同 id 同角色 ⇒ 多次通过', () => {
    const t = new MessageIdentityTracker();
    for (let i = 0; i < 3; i++) {
      t.assertAndRecord({ sessionId: 's1', messageId: 'm1', updateType: 'agent_message' });
    }
    expect(t.size).toBe(1);
  });

  it('同 id 跨角色 ⇒ 抛错并点名两档', () => {
    const t = new MessageIdentityTracker();
    t.assertAndRecord({ sessionId: 's1', messageId: 'm1', updateType: 'agent_message' });
    expect(() =>
      t.assertAndRecord({ sessionId: 's1', messageId: 'm1', updateType: 'user_message' }),
    ).toThrow(/跨类型.*agent_message.*user_message/);
  });

  it('不同会话同名 id 合法(各自命名空间)', () => {
    const t = new MessageIdentityTracker();
    t.assertAndRecord({ sessionId: 's1', messageId: 'm1', updateType: 'agent_message' });
    expect(() =>
      t.assertAndRecord({ sessionId: 's2', messageId: 'm1', updateType: 'user_message' }),
    ).not.toThrow();
    expect(t.size).toBe(2);
  });

  it('agent_message 与 agent_thought 视为不同角色 ⇒ 冲突(thought 混进正文是错的)', () => {
    const t = new MessageIdentityTracker();
    t.assertAndRecord({ sessionId: 's1', messageId: 'm1', updateType: 'agent_message' });
    expect(() =>
      t.assertAndRecord({ sessionId: 's1', messageId: 'm1', updateType: 'agent_thought' }),
    ).toThrow(MessageIdentityError);
  })

  it('roleOf / clear 可用', () => {
    const t = new MessageIdentityTracker();
    t.assertAndRecord({ sessionId: 's1', messageId: 'm1', updateType: 'agent_message' });
    expect(t.roleOf('s1', 'm1')).toBe('agent_message');
    expect(t.roleOf('s1', 'nope')).toBeUndefined();
    t.clear();
    expect(t.size).toBe(0);
  });
});

describe('canonicalJson', () => {
  it('键顺序不同但内容相同 ⇒ 同一串', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('undefined 值被剔除(不是写成 null)', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('数组保持原序(顺序是语义)', () => {
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it('数组里的 undefined 写成 null(保持长度)', () => {
    expect(canonicalJson([1, undefined, 3])).toBe('[1,null,3]');
  });

  it('嵌套结构稳定', () => {
    const a = { z: { y: 1, x: 2 }, a: [{ n: 1, m: 2 }] };
    const b = { a: [{ m: 2, n: 1 }], z: { x: 2, y: 1 } };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe('日志上限', () => {
  it('四档常量与对标实现同口径', () => {
    expect(JOURNAL_LIMITS.maxFrameBytes).toBe(4096);
    expect(JOURNAL_LIMITS.maxTotalBytes).toBe(8 * 1024 * 1024);
    expect(JOURNAL_LIMITS.maxAttachmentFrames).toBe(2048);
    expect(JOURNAL_LIMITS.maxAttachmentBytes).toBe(128 * 1024 * 1024);
  });

  it('frameBytes 按 UTF-8 计(中文占 3 字节)', () => {
    expect(frameBytes({ t: '中' })).toBeGreaterThan(frameBytes({ t: 'a' }));
  });

  it('单帧超限 ⇒ 抛结构化错误,不静默截断', () => {
    const big = { text: 'x'.repeat(JOURNAL_LIMITS.maxFrameBytes) };
    expect(() => assertFrameWithinLimit(big)).toThrow(JournalOverflowError);
  });

  it('单帧未超限 ⇒ 通过', () => {
    expect(() => assertFrameWithinLimit({ t: 'ok' })).not.toThrow();
  });

  it('总量超限 ⇒ 抛错', () => {
    const frames = Array.from({ length: 3000 }, () => ({ text: 'x'.repeat(4000) }));
    expect(totalBytes(frames)).toBeGreaterThan(JOURNAL_LIMITS.maxTotalBytes);
    expect(() => assertTotalWithinLimit(frames)).toThrow(JournalOverflowError);
  });

  it('空日志总量为 0', () => {
    expect(totalBytes([])).toBe(0);
    expect(() => assertTotalWithinLimit([])).not.toThrow();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
