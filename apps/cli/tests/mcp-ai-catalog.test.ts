// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI Catalog（SEP-2127 discovery）的离线测试。
 *
 * 钉住三件事：
 *   1. 目录条目只认 `application/mcp-server-card+json`，url/data 恰好一个；
 *   2. 域名输入归一成 `/.well-known/ai-catalog.json`，并带正确 Accept；
 *   3. 发现只返回候选，不替调用方连接；单条坏卡不拖垮整批。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  AI_CATALOG_MEDIA_TYPE,
  discoverMcpServerCards,
  fetchMcpAiCatalog,
  MCP_SERVER_CARD_MEDIA_TYPE,
  MCP_SERVER_CARD_SCHEMA_URL,
  parseMcpAiCatalog,
  resolveAiCatalogUrl,
} from '../src/tools/mcp-server-card.js';

function card(name = 'com.example/weather') {
  return {
    $schema: MCP_SERVER_CARD_SCHEMA_URL,
    name,
    version: '1.0.0',
    description: 'Weather server.',
    remotes: [
      {
        type: 'streamable-http',
        url: 'https://mcp.example.com/mcp',
        supportedProtocolVersions: ['2026-07-28'],
      },
    ],
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AI Catalog 解析', () => {
  it('域名归一为 well-known 目录，已是完整 URL 则保留路径', () => {
    expect(resolveAiCatalogUrl('example.com')).toBe(
      'https://example.com/.well-known/ai-catalog.json',
    );
    expect(resolveAiCatalogUrl('https://example.com/')).toBe(
      'https://example.com/.well-known/ai-catalog.json',
    );
    expect(resolveAiCatalogUrl('https://example.com/custom/catalog.json')).toBe(
      'https://example.com/custom/catalog.json',
    );
  });

  it('只挑 Server Card 条目，url 与 data 必须恰好一个', () => {
    const result = parseMcpAiCatalog({
      specVersion: '1.0',
      entries: [
        { identifier: 'urn:air:example.com:mcp:weather', type: MCP_SERVER_CARD_MEDIA_TYPE, url: 'https://example.com/card' },
        { identifier: 'urn:air:example.com:mcp:inline', type: MCP_SERVER_CARD_MEDIA_TYPE, data: card() },
        { identifier: 'urn:air:example.com:other', type: 'application/json', data: {} },
        { identifier: 'urn:air:example.com:bad', type: MCP_SERVER_CARD_MEDIA_TYPE, url: 'https://example.com/card', data: card() },
      ],
    });
    expect(result.cardEntries).toHaveLength(2);
    expect(result.cardEntries?.map((e) => e.identifier)).toEqual([
      'urn:air:example.com:mcp:weather',
      'urn:air:example.com:mcp:inline',
    ]);
    expect(result.errors.join(' ')).toContain('恰好有 url 或 data');
  });

  it('顶层不是对象 / entries 不是数组时明确失败', () => {
    expect(parseMcpAiCatalog(null).ok).toBe(false);
    expect(parseMcpAiCatalog({ specVersion: '1.0', entries: {} }).errors.join(' ')).toContain(
      'entries 必须是数组',
    );
  });
});

describe('AI Catalog 发现', () => {
  it('fetch 带 ai-catalog Accept，并解析 200 响应', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        specVersion: '1.0',
        entries: [{ identifier: 'urn:air:example.com:mcp:weather', type: MCP_SERVER_CARD_MEDIA_TYPE, data: card() }],
      }),
    ) as unknown as typeof fetch;
    const result = await fetchMcpAiCatalog('https://example.com', { fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://example.com/.well-known/ai-catalog.json');
    expect(result.cardEntries).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/.well-known/ai-catalog.json',
      expect.objectContaining({
        headers: { Accept: `${AI_CATALOG_MEDIA_TYPE}, application/json` },
      }),
    );
  });

  it('逐条取卡；坏卡只记该条失败，不影响其他卡', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/catalog.json')) {
        return jsonResponse({
          specVersion: '1.0',
          entries: [
            { identifier: 'urn:air:example.com:mcp:inline', type: MCP_SERVER_CARD_MEDIA_TYPE, data: card() },
            { identifier: 'urn:air:example.com:mcp:remote', type: MCP_SERVER_CARD_MEDIA_TYPE, url: 'https://example.com/card' },
            { identifier: 'urn:air:example.com:mcp:broken', type: MCP_SERVER_CARD_MEDIA_TYPE, data: { name: 'bad' } },
          ],
        });
      }
      return jsonResponse(card());
    }) as unknown as typeof fetch;
    const result = await discoverMcpServerCards('https://example.com/catalog.json', { fetchImpl });
    expect(result.catalogOk).toBe(true);
    expect(result.cards).toHaveLength(3);
    expect(result.cards.filter((c) => c.ok)).toHaveLength(2);
    expect(result.cards[2]?.errors.length).toBeGreaterThan(0);
  });

  it('目录失败时不返回任何卡，且 errors 原样带出', async () => {
    const result = await discoverMcpServerCards('https://example.com', {
      fetchImpl: vi.fn(async () => jsonResponse({ error: 'no' }, 404)) as unknown as typeof fetch,
    });
    expect(result.catalogOk).toBe(false);
    expect(result.cards).toEqual([]);
    expect(result.errors.join(' ')).toContain('404');
  });
});
