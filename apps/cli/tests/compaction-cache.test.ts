// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * compaction-cache 单元测试 — CLI 端 70% 预压缩摘要缓存。
 * 覆盖:命中/失效/prime 异常吞掉/FIFO 淘汰/cachedSummary 跳过 sampler/磁盘持久化与跨会话恢复。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  primeCompactionSummary,
  getCachedCompactionSummary,
  writeCompactionSummaryCache,
  getCompactionCacheKey,
  __clearCompactionCacheForTests,
} from '../src/compaction-cache.js';
import { compressContextV2, type CompactionSampler } from '../src/compaction-v2.js';
import type { ChatMessage } from '../src/context.js';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DISK_CACHE_FILE = join(homedir(), '.ihui', 'compaction-cache.json');

function buildMessages(count: number, chars = 600): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: 'system prompt' }];
  for (let i = 0; i < count; i++) {
    messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i} ${'x'.repeat(chars)}` });
  }
  return messages;
}

describe('compaction-cache(70% 预压缩缓存)', () => {
  beforeEach(() => {
    __clearCompactionCacheForTests();
    // 清理磁盘缓存文件,确保测试隔离
    if (existsSync(DISK_CACHE_FILE)) {
      try { unlinkSync(DISK_CACHE_FILE); } catch { /* ignore */ }
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // 清理磁盘缓存文件
    if (existsSync(DISK_CACHE_FILE)) {
      try { unlinkSync(DISK_CACHE_FILE); } catch { /* ignore */ }
    }
  });

  it('prime 后同消息查询命中同一摘要', async () => {
    const messages = buildMessages(12);
    await new Promise<void>((resolve) => {
      primeCompactionSummary('sess-1', messages, async () => {
        resolve('预生成的语义摘要内容');
        return '预生成的语义摘要内容';
      });
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(getCachedCompactionSummary('sess-1', messages)).toBe('预生成的语义摘要内容');
  });

  it('消息变化后 hash 失效返回 null', async () => {
    const messages = buildMessages(12);
    primeCompactionSummary('sess-1', messages, async () => '摘要 A');
    await new Promise((r) => setTimeout(r, 10));
    expect(getCachedCompactionSummary('sess-1', messages)).toBe('摘要 A');
    const changed = buildMessages(12);
    changed[3] = { role: 'user', content: '被修改的消息 ' + 'y'.repeat(600) };
    expect(getCachedCompactionSummary('sess-1', changed)).toBeNull();
  });

  it('prime 阶段 LLM 失败不抛异常且缓存不写入', async () => {
    const messages = buildMessages(12);
    primeCompactionSummary('sess-1', messages, async () => {
      throw new Error('LLM 超时');
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(getCachedCompactionSummary('sess-1', messages)).toBeNull();
  });

  it('容量 200:FIFO 淘汰最早条目', async () => {
    for (let i = 0; i < 201; i++) {
      const messages = buildMessages(12, 600);
      // 每条消息内容不同 → hash 不同 → key 不同
      const keyed = messages.map((m, idx) =>
        idx === 0 ? m : { ...m, content: `${m.content} #${i}` },
      );
      writeCompactionSummaryCache(`sess-${i}`, keyed, `摘要 ${i}`);
    }
    // sess-0 是最早写入 → 被淘汰;sess-200 最新 → 命中
    const first = buildMessages(12, 600).map((m, idx) =>
      idx === 0 ? m : { ...m, content: `${m.content} #0` },
    );
    const last = buildMessages(12, 600).map((m, idx) =>
      idx === 0 ? m : { ...m, content: `${m.content} #200` },
    );
    expect(getCachedCompactionSummary('sess-0', first)).toBeNull();
    expect(getCachedCompactionSummary('sess-200', last)).toBe('摘要 200');
  });

  it('compressContextV2 传 cachedSummary 时跳过 sampler LLM 调用', async () => {
    const sampler: CompactionSampler = {
      sampleCompaction: vi.fn(async () => ({ response: '不应被调用的实时摘要' })),
    };
    const messages = buildMessages(12, 3000);
    const result = await compressContextV2(messages, {
      contextLimit: 4000,
      cachedSummary: 'x'.repeat(600) + ': 来自缓存的结构化摘要,包含用户请求与关键决策与进度' + 'x'.repeat(400),
      sampler,
    });
    expect(sampler.sampleCompaction).not.toHaveBeenCalled();
    expect(result.compressed).toBe(true);
    const summaryMsg = result.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    );
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg!.content).toContain('来自缓存的结构化摘要');
  });

  it('writeCache 后磁盘文件存在且内容正确', async () => {
    const messages = buildMessages(12);
    const key = getCompactionCacheKey(messages, 'sess-disk');
    writeCompactionSummaryCache('sess-disk', messages, '磁盘持久化测试摘要');
    // 等待异步写盘完成
    await new Promise((r) => setTimeout(r, 50));
    expect(existsSync(DISK_CACHE_FILE)).toBe(true);
    const raw = readFileSync(DISK_CACHE_FILE, 'utf-8');
    const data = JSON.parse(raw) as Record<string, string>;
    expect(data[key]).toBe('磁盘持久化测试摘要');
  });

  it('进程重启后磁盘缓存恢复(跨会话命中)', async () => {
    const messages = buildMessages(12);
    const key = getCompactionCacheKey(messages, 'sess-reload');
    writeCompactionSummaryCache('sess-reload', messages, '跨会话恢复摘要');
    await new Promise((r) => setTimeout(r, 50));
    // 模拟进程重启:清空内存缓存,重新加载磁盘
    __clearCompactionCacheForTests();
    // 重新导入模块触发 loadCacheFromDisk
    vi.resetModules();
    const { getCachedCompactionSummary: getAfterReload } = await import('../src/compaction-cache.js');
    expect(getAfterReload('sess-reload', messages)).toBe('跨会话恢复摘要');
  });
});
