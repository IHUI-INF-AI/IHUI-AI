// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest';
import { SessionSearchIndex } from '../src/acp/session-search.js';
import type { Session } from '../src/commands/session.js';
import type { ChatMessage } from '@ihui/types';

// 固定会话数据(不读真实 ~/.ihui,避免环境依赖)
function session(id: string, msgs: ChatMessage[], createdAt = '2026-01-01T00:00:00Z'): Session {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    workspacePath: '/tmp/ws',
    modelId: 'test-model',
    history: msgs,
  };
}

describe('SessionSearchIndex — 对齐统一规范', () => {
  const sessions: Session[] = [
    session('s1', [
      { id: 'm1', role: 'user', content: '怎么用 exponential backoff 重试', createdAt: 100 },
      { id: 'm2', role: 'assistant', content: '使用 Backoff  指数 退避 策略', createdAt: 200 },
    ]),
    session('s2', [
      { id: 'm3', role: 'user', content: 'jitter 打散 惊群', createdAt: 300 },
    ]),
  ];

  it('单 token 命中:大小写不敏感 + 空白压平', () => {
    const idx = new SessionSearchIndex(sessions);
    const hits = idx.search('backoff');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((h) => h.messageId === 'm1')).toBe(true);
  });

  it('大小写不敏感:大写 query 命中小写 content', () => {
    const idx = new SessionSearchIndex(sessions);
    // m1 content 是小写 'backoff';query 用大写 'BACKOFF' 仍应命中
    const hits = idx.search('BACKOFF');
    expect(hits.some((h) => h.messageId === 'm1')).toBe(true);
  });

  it('大小写不敏感:小写 query 命中首字母大写 content', () => {
    // content 'Backoff' 首字母大写;小写 query 'backoff' 应命中
    const s = session('sc', [
      { id: 'cm', role: 'user', content: 'Use Backoff here', createdAt: 1 },
    ]);
    const idx = new SessionSearchIndex([s]);
    const hits = idx.search('backoff');
    expect(hits.some((h) => h.messageId === 'cm')).toBe(true);
  });

  it('多词 AND:两词都命中的消息才返回', () => {
    const idx = new SessionSearchIndex(sessions);
    // m2 含 exponential? 否。含 backoff/重试? m1 有。多词 AND 测: 'exponential backoff' 只 m1
    const andHits = idx.search('exponential backoff');
    expect(andHits.every((h) => h.messageId === 'm1')).toBe(true);
    // 单 'jitter' 只 m3
    const jitterHits = idx.search('jitter');
    expect(jitterHits.length).toBe(1);
    expect(jitterHits[0].messageId).toBe('m3');
  });

  it('多词 AND 排除只命中一词的消息', () => {
    const idx = new SessionSearchIndex(sessions);
    // 'jitter backoff':无一条同时含 → 空
    expect(idx.search('jitter backoff')).toHaveLength(0);
  });

  it('空 query / 纯符号 query 返回空,不抛错', () => {
    const idx = new SessionSearchIndex(sessions);
    expect(idx.search('')).toHaveLength(0);
    expect(idx.search('!!!')).toHaveLength(0);
  });

  it('snippet 含命中词,matchRanges 定位命中', () => {
    const idx = new SessionSearchIndex(sessions);
    const hits = idx.search('backoff');
    const m1 = hits.find((h) => h.messageId === 'm1');
    expect(m1).toBeDefined();
    expect(m1!.snippet.toLowerCase()).toContain('backoff');
    expect(m1!.matchRanges.length).toBeGreaterThanOrEqual(1);
  });

  it('limit 截断生效', () => {
    const many: Session[] = Array.from({ length: 10 }, (_, i) =>
      session(`s${i}`, [{ id: `m${i}`, role: 'user', content: 'backoff 重试', createdAt: i }]),
    );
    const idx = new SessionSearchIndex(many);
    expect(idx.search('backoff', { limit: 3 })).toHaveLength(3);
  });

  it('空历史/空内容消息不进索引,不抛错', () => {
    const s = session('empty', [
      { id: 'e1', role: 'user', content: '' },
      { id: 'e2', role: 'assistant', content: '有内容 backoff' },
    ]);
    const idx = new SessionSearchIndex([s]);
    expect(idx.size).toBe(1); // 只 e2
  });

  it('索引大小正确反映非空消息数', () => {
    const idx = new SessionSearchIndex(sessions);
    expect(idx.size).toBe(3); // m1,m2,m3
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
