// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-090 回归:压缩缓存键必须包含模型标识。
 *
 * 缺陷原状:key = `sessionId|djb2(文本)`,模型与缓存版本均未入键 ⇒ 会话中途切换模型
 * (`--model` / config)后,88% 真压缩会命中原模型生成的摘要,把别家模型的摘要注入
 * 新模型上下文(串味 / 格式不符,且无告警)。
 *
 * 这里钉两件事:
 * 1. 不同模型不串用缓存(写/预生成都算);
 * 2. 同模型同输入仍然命中(修复不得把缓存打成永不命中)。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __clearCompactionCacheForTests,
  getCachedCompactionSummary,
  getCompactionCacheKey,
  primeCompactionSummary,
  writeCompactionSummaryCache,
} from '../src/compaction-cache.js';
import type { ChatMessage } from '../src/context.js';

function buildMessages(count: number): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: 'system prompt' }];
  for (let i = 0; i < count; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i} ${'x'.repeat(600)}`,
    });
  }
  return messages;
}

const MODEL_A = 'gpt-4o-mini';
const MODEL_B = 'claude-sonnet-4';

describe('F-090 压缩缓存键含模型', () => {
  beforeEach(() => {
    __clearCompactionCacheForTests();
  });

  it('不同模型不串用缓存:模型 A 回写的摘要,模型 B 查不到', () => {
    const messages = buildMessages(12);
    writeCompactionSummaryCache('sess-1', messages, '模型 A 的摘要', MODEL_A);

    expect(getCachedCompactionSummary('sess-1', messages, MODEL_A)).toBe('模型 A 的摘要');
    expect(getCachedCompactionSummary('sess-1', messages, MODEL_B)).toBeNull();
  });

  it('预生成摘要只对生成它的模型可见', async () => {
    const messages = buildMessages(12);
    await new Promise<void>((resolve) => {
      primeCompactionSummary('sess-1', messages, async () => {
        resolve();
        return '模型 A 预生成的摘要';
      }, MODEL_A);
    });

    expect(getCachedCompactionSummary('sess-1', messages, MODEL_A)).toBe('模型 A 预生成的摘要');
    expect(getCachedCompactionSummary('sess-1', messages, MODEL_B)).toBeNull();
  });

  it('同模型同输入仍命中(回写与预生成两条路径)', async () => {
    const messages = buildMessages(12);
    writeCompactionSummaryCache('sess-1', messages, '回写摘要', MODEL_A);
    expect(getCachedCompactionSummary('sess-1', messages, MODEL_A)).toBe('回写摘要');

    const other = buildMessages(12);
    await new Promise<void>((resolve) => {
      primeCompactionSummary('sess-2', other, async () => {
        resolve();
        return '预生成摘要';
      }, MODEL_B);
    });
    expect(getCachedCompactionSummary('sess-2', other, MODEL_B)).toBe('预生成摘要');
  });

  it('缓存键含版本与模型,且内容哈希为 128 位十六进制', () => {
    const messages = buildMessages(12);
    const keyA = getCompactionCacheKey(messages, 'sess-1', MODEL_A);
    const keyB = getCompactionCacheKey(messages, 'sess-1', MODEL_B);
    const keyA2 = getCompactionCacheKey(messages, 'sess-1', MODEL_A);

    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe(keyA2);
    expect(keyA).toContain(MODEL_A);
    // 旧格式 `sessionId|djb2` 不含模型 ⇒ 修复后必须不再出现
    expect(keyA.startsWith('sess-1|')).toBe(false);
    const hash = keyA.split('|').pop() ?? '';
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
