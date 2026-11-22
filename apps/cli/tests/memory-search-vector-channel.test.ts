// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-089 回归测试:`/memory search` 必须合并向量通道,而不是静默退化为纯关键词。
 *
 * 覆盖:
 *   1. 无关键词重合、仅向量命中的 memory 也能被检索到(matchedBy=vector)
 *   2. 关键词 + 向量双命中 → matchedBy=both,与关键词结果融合
 *   3. 无 provider(无向量能力)→ 与纯关键词路径结果完全一致(行为不变)
 *   4. provider 抛错 → 退回纯关键词,检索不中断
 */
import { describe, it, expect } from 'vitest';
import {
  executeMemorySearch,
  executeMemorySearchAsync,
} from '../src/commands/repl.js';
import type { EmbeddingProvider, MemoryEntry } from '../src/memory/index.js';
import { MockEmbeddingProvider } from '../src/memory/index.js';

function makeEntry(text: string, overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    raw: `- ${text}`,
    text,
    source: 'project',
    category: '通用',
    ...overrides,
  };
}

/** 2 维桩 provider:按文本映射向量,便于构造"仅向量命中"/"双通道命中"场景。 */
function stubProvider(resolve: (text: string) => number[]): EmbeddingProvider {
  return {
    embedBatch: async (texts) => texts.map(resolve),
    modelName: () => 'stub-2d',
    dimensions: () => 2,
  };
}

describe('F-089 executeMemorySearchAsync 向量通道', () => {
  it('仅向量命中的 memory 能被检索到(向量通道不再被丢弃)', async () => {
    const entries = [
      makeEntry('alpha keyword memory'),
      makeEntry('完全无关的语义条目'),
    ];
    const provider = stubProvider((text) =>
      text === 'alpha' || text === '完全无关的语义条目' ? [1, 0] : [-1, 0],
    );

    const results = await executeMemorySearchAsync(entries, 'alpha', provider);
    const semantic = results.find((r) => r.text === '完全无关的语义条目');
    expect(semantic).toBeDefined();
    expect(semantic!.matchedBy).toBe('vector');
    expect(semantic!.score).toBeGreaterThan(0);

    // 对照:同步关键词路径(缺陷原状)检索不到该条目
    const keywordOnly = executeMemorySearch(entries, 'alpha');
    expect(keywordOnly.map((r) => r.text)).not.toContain('完全无关的语义条目');
  });

  it('关键词 + 向量双命中 → matchedBy=both,并与关键词结果融合', async () => {
    const entries = [
      makeEntry('alpha alpha keyword memory'),
      makeEntry('alpha 语义相关条目'),
      makeEntry('完全无关条目 gamma'),
    ];
    const provider = stubProvider((text) =>
      text === 'alpha' || text === 'alpha 语义相关条目' ? [1, 0] : [-1, 0],
    );

    const results = await executeMemorySearchAsync(entries, 'alpha', provider);
    const both = results.find((r) => r.text === 'alpha 语义相关条目');
    const ftsOnly = results.find((r) => r.text === 'alpha alpha keyword memory');
    expect(both).toBeDefined();
    expect(ftsOnly).toBeDefined();
    expect(both!.matchedBy).toBe('both');
    expect(ftsOnly!.matchedBy).toBe('fts');
  });

  it('无 provider → 与纯关键词路径结果完全一致(行为不变)', async () => {
    const entries = [
      makeEntry('TypeScript 后端'),
      makeEntry('React 前端'),
      makeEntry('人工智能是未来'),
    ];

    const asyncResults = await executeMemorySearchAsync(entries, 'TypeScript');
    const syncResults = executeMemorySearch(entries, 'TypeScript');
    expect(asyncResults).toEqual(syncResults);
    expect(asyncResults[0]!.text).toContain('TypeScript');
    expect(
      asyncResults.some((r) => r.matchedBy === 'vector' || r.matchedBy === 'both'),
    ).toBe(false);
  });

  it('仅 Mock provider(零配置兜底)→ 仍保持纯关键词行为', async () => {
    const entries = [
      makeEntry('TypeScript 后端'),
      makeEntry('无关条目'),
    ];

    const withMock = await executeMemorySearchAsync(
      entries,
      'TypeScript',
      new MockEmbeddingProvider(),
    );
    expect(withMock).toEqual(executeMemorySearch(entries, 'TypeScript'));
    expect(withMock.some((r) => r.matchedBy === 'vector')).toBe(false);
  });

  it('provider 抛错 → 退回纯关键词,检索不中断', async () => {
    const entries = [makeEntry('TypeScript 后端'), makeEntry('React 前端')];
    const provider: EmbeddingProvider = {
      embedBatch: async () => {
        throw new Error('embedding down');
      },
      modelName: () => 'boom',
      dimensions: () => 2,
    };

    const results = await executeMemorySearchAsync(entries, 'TypeScript', provider);
    expect(results.length).toBe(1);
    expect(results[0]!.text).toContain('TypeScript');
    expect(results[0]!.matchedBy).toBe('fts');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
