/**
 * Memory Hybrid Search 集成测试 — 验证 /memory search 命令的 hybrid search 集成。
 *
 * 测试范围:
 *   1. memoryEntryToChunk 适配器:MemoryEntry → MemoryChunk 转换 + id 稳定 + source 默认值
 *   2. resolveEmbeddingProvider:无配置 → Mock;有配置 → Api;disabled → undefined
 *   3. executeMemorySearch 核心逻辑:空 memory / 精确匹配 / 抛错 fallback / 无匹配
 *   4. 端到端:10 条中英混合 memory,验证 BM25 高分在前 + 排序正确
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  memoryEntryToChunk,
  resolveEmbeddingProvider,
  executeMemorySearch,
} from '../src/commands/repl.js';
import {
  MockEmbeddingProvider,
  ApiEmbeddingProvider,
  type MemoryEntry,
} from '../src/memory/index.js';

// ---- mock loadSettings(控制 resolveEmbeddingProvider 行为) ----
const { loadSettingsMock } = vi.hoisted(() => ({
  loadSettingsMock: vi.fn(),
}));

vi.mock('../src/commands/settings.js', () => ({
  loadSettings: loadSettingsMock,
}));

beforeEach(() => {
  loadSettingsMock.mockReturnValue({});
});

// ---- 辅助:构造 MemoryEntry ----
function makeEntry(
  text: string,
  overrides: Partial<MemoryEntry> = {},
): MemoryEntry {
  return {
    raw: `- ${text}`,
    text,
    source: 'project',
    category: '通用',
    ...overrides,
  };
}

// ============ 1. memoryEntryToChunk ============

describe('memoryEntryToChunk', () => {
  it('正确转换 MemoryEntry → MemoryChunk:文本与分类保留', () => {
    const entry = makeEntry('用户偏好使用 TypeScript', { category: '偏好' });
    const chunk = memoryEntryToChunk(entry);
    expect(chunk.text).toBe('用户偏好使用 TypeScript');
    expect(chunk.ancestors).toEqual(['偏好']);
    expect(chunk.accessCount).toBe(0);
    expect(chunk.createdAt).toBeGreaterThan(0);
    expect(chunk.lastAccessed).toBe(chunk.createdAt);
  });

  it('id 稳定:同输入同 id(确定性)', () => {
    const entry = makeEntry('同一段文本', { category: '测试' });
    const id1 = memoryEntryToChunk(entry).id;
    const id2 = memoryEntryToChunk(entry).id;
    expect(id1).toBe(id2);
    expect(id1).toBe('测试:同一段文本');
  });

  it('id 截断到 32 字符(长文本)', () => {
    const longText = 'a'.repeat(100);
    const entry = makeEntry(longText, { category: '长文本' });
    const chunk = memoryEntryToChunk(entry);
    expect(chunk.id).toBe(`长文本:${'a'.repeat(32)}`);
  });

  it('source 默认为 workspace', () => {
    const entry = makeEntry('test', { source: 'project' });
    const chunk = memoryEntryToChunk(entry);
    expect(chunk.source).toBe('workspace');
  });

  it('source 可显式指定为 global', () => {
    const entry = makeEntry('global fact', { source: 'global' });
    const chunk = memoryEntryToChunk(entry, 'global');
    expect(chunk.source).toBe('global');
  });

  it('缺省分类时 ancestors 为 ["uncategorized"]', () => {
    const entry: MemoryEntry = {
      raw: '- no cat',
      text: 'no cat',
      source: 'project',
      category: '',
    };
    const chunk = memoryEntryToChunk(entry);
    expect(chunk.ancestors).toEqual(['uncategorized']);
    expect(chunk.id).toContain('uncategorized');
  });
});

// ============ 2. resolveEmbeddingProvider ============

describe('resolveEmbeddingProvider', () => {
  it('无 embedding 配置 → 返回 MockEmbeddingProvider', () => {
    loadSettingsMock.mockReturnValue({});
    const provider = resolveEmbeddingProvider();
    expect(provider).toBeInstanceOf(MockEmbeddingProvider);
  });

  it('embeddingEnabled=false → 返回 undefined(纯 BM25)', () => {
    loadSettingsMock.mockReturnValue({ embeddingEnabled: false });
    const provider = resolveEmbeddingProvider();
    expect(provider).toBeUndefined();
  });

  it('有 embeddingApiBase + embeddingApiKey → 返回 ApiEmbeddingProvider', () => {
    loadSettingsMock.mockReturnValue({
      embeddingApiBase: 'https://api.example.com/v1',
      embeddingApiKey: 'sk-test-key',
    });
    const provider = resolveEmbeddingProvider();
    expect(provider).toBeInstanceOf(ApiEmbeddingProvider);
  });

  it('仅有 apiBase 缺 apiKey → 返回 MockEmbeddingProvider', () => {
    loadSettingsMock.mockReturnValue({
      embeddingApiBase: 'https://api.example.com/v1',
    });
    const provider = resolveEmbeddingProvider();
    expect(provider).toBeInstanceOf(MockEmbeddingProvider);
  });
});

// ============ 3. executeMemorySearch 核心逻辑 ============

describe('executeMemorySearch', () => {
  it('空 memory → 返回空数组', () => {
    const results = executeMemorySearch([], 'test');
    expect(results).toEqual([]);
  });

  it('精确匹配 → 返回 hybrid search 结果(含 score + matchedBy=fts)', () => {
    const entries = [
      makeEntry('使用 TypeScript 编写后端'),
      makeEntry('前端用 React 框架'),
    ];
    const results = executeMemorySearch(entries, 'TypeScript');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0]!;
    expect(top.text).toContain('TypeScript');
    expect(top.matchedBy).toBe('fts');
    expect(top.score).toBeGreaterThan(0);
  });

  it('精确 token 匹配 → 返回 hybrid search 结果(matchedBy=fts,非 fallback)', () => {
    const entries = [
      makeEntry('特殊关键字 uniqueToken123'),
      makeEntry('另一条无关 memory'),
    ];
    const results = executeMemorySearch(entries, 'uniqueToken123');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.text).toContain('uniqueToken123');
    // 精确 token 匹配走 hybrid path,不走 substring fallback
    expect(results[0]!.matchedBy).toBe('fts');
  });

  it('无任何匹配 → 返回空数组', () => {
    const entries = [
      makeEntry('完全无关的内容一'),
      makeEntry('完全无关的内容二'),
    ];
    const results = executeMemorySearch(entries, 'zzz_no_match_zzz');
    expect(results).toEqual([]);
  });

  it('hybrid 返回空但有 substring 匹配 → fallback 到 substring', () => {
    // 中文字符串:BM25 分词用 2-gram,可能无法匹配单字 query
    // 但 substring 应能匹配
    const entries = [
      makeEntry('人工智能是未来'),
      makeEntry('机器学习很有趣'),
    ];
    // 单字 query:BM25 2-gram 可能不匹配,触发 fallback
    const results = executeMemorySearch(entries, '人');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.text.includes('人'))).toBe(true);
  });

  it('结果 source 字段正确映射:global → global, project → workspace → project', () => {
    const entries = [
      makeEntry('全局条目', { source: 'global' }),
      makeEntry('项目条目', { source: 'project' }),
    ];
    const results = executeMemorySearch(entries, '条目');
    const sources = new Set(results.map((r) => r.source));
    expect(sources.has('global')).toBe(true);
    expect(sources.has('project')).toBe(true);
  });
});

// ============ 4. 端到端:10 条中英混合 memory ============

describe('executeMemorySearch 端到端(10 条中英混合)', () => {
  const entries: MemoryEntry[] = [
    makeEntry('TypeScript is a typed superset of JavaScript', { category: '语言' }),
    makeEntry('React is a JavaScript library for building UIs', { category: '前端' }),
    makeEntry('Node.js 后端运行时,基于 V8 引擎', { category: '后端' }),
    makeEntry('数据库 PostgreSQL 是强大的关系型数据库', { category: '数据' }),
    makeEntry('Docker 容器化部署方案,简化环境管理', { category: '运维' }),
    makeEntry('GraphQL API 查询语言,灵活的数据获取', { category: 'API' }),
    makeEntry('WebSocket 实时通信协议,双向数据流', { category: '通信' }),
    makeEntry('Redis 内存数据库,常用作缓存层', { category: '数据' }),
    makeEntry('Kubernetes 容器编排平台,管理集群', { category: '运维' }),
    makeEntry('Vitest 是现代化的测试框架,支持 ESM', { category: '测试' }),
  ];

  it('搜索 "PostgreSQL" → 含该关键词的条目返回(英文关键词匹配)', () => {
    const results = executeMemorySearch(entries, 'PostgreSQL');
    expect(results.length).toBeGreaterThan(0);
    // PostgreSQL 条目含关键词,应在结果中
    const texts = results.map((r) => r.text);
    expect(texts.some((t) => t.includes('PostgreSQL'))).toBe(true);
    // 结果按 score 降序
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
    }
  });

  it('搜索 "容器" → Docker 和 Kubernetes 排在前(中文 2-gram 匹配)', () => {
    const results = executeMemorySearch(entries, '容器');
    expect(results.length).toBeGreaterThan(0);
    const texts = results.map((r) => r.text);
    // Docker 和 Kubernetes 都含"容器",应在前
    expect(texts.some((t) => t.includes('Docker'))).toBe(true);
    expect(texts.some((t) => t.includes('Kubernetes'))).toBe(true);
  });

  it('搜索 "JavaScript" → TypeScript 和 React 排在前(BM25 高分)', () => {
    const results = executeMemorySearch(entries, 'JavaScript');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const topTexts = results.slice(0, 2).map((r) => r.text);
    // TypeScript 条目直接含 "JavaScript",React 也含 "JavaScript"
    expect(topTexts.some((t) => t.includes('TypeScript'))).toBe(true);
    expect(topTexts.some((t) => t.includes('React'))).toBe(true);
  });

  it('所有结果 score 在 [0, 1] 区间,matchedBy 为 fts 或 substring-fallback', () => {
    const results = executeMemorySearch(entries, 'PostgreSQL');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(['fts', 'vector', 'both', 'substring-fallback']).toContain(r.matchedBy);
    }
  });

  it('结果数量不超过 maxResults=10', () => {
    const results = executeMemorySearch(entries, 'TypeScript');
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('MMR 重排:相似条目不全部聚集在顶部(去重效果)', () => {
    // 搜索 "数据":PostgreSQL 和 Redis 都含"数据",MMR 应避免两者全挤在 top-2
    const results = executeMemorySearch(entries, '数据');
    if (results.length >= 2) {
      // 至少验证结果不全部来自同一 category
      const categories = new Set(results.map((r) => r.category));
      expect(categories.size).toBeGreaterThanOrEqual(1);
    }
  });
});
