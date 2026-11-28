// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SEP-2127 Server Card 测试。
 *
 * 钉四件事：
 *   1. v1 schema 的 required 四件套与 name/version 形状（拒绝范围版本）；
 *   2. remotes 的 transport / supportedProtocolVersions 选择；
 *   3. fetch 的大小上限、非 2xx、非 JSON 出口；
 *   4. 配置层：serverCardUrl 形状 + requireServerCard 的必填约束。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  MCP_SERVER_CARD_SCHEMA_URL,
  fetchMcpServerCard,
  isConcreteServerVersion,
  pickMcpServerCardRemote,
  validateMcpServerCard,
} from '../src/tools/mcp-server-card.js';
import { validateMcpConfig } from '../src/commands/mcp-config.js';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const baseCard = {
  $schema: MCP_SERVER_CARD_SCHEMA_URL,
  name: 'com.example/weather',
  version: '1.2.0',
  description: 'Weather tools for a person, not a language runtime.',
};

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('MCP Server Card v1 校验', () => {
  it('accept a minimal valid card and concrete versions', () => {
    const result = validateMcpServerCard(baseCard);
    expect(result.ok).toBe(true);
    expect(result.card).toMatchObject({ name: 'com.example/weather', version: '1.2.0' });
    expect(isConcreteServerVersion('2.1.0-alpha')).toBe(true);
    expect(isConcreteServerVersion('1.2.3+build.7')).toBe(true);
  });

  it('rejects wrong schema/name/description and range versions', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...baseCard, $schema: 'https://example.com/server-card.json' }, '$schema'],
      [{ ...baseCard, name: 'weather' }, 'name'],
      [{ ...baseCard, name: 'com.example/weather/extra' }, 'name'],
      [{ ...baseCard, description: 'x'.repeat(101) }, 'description'],
      [{ ...baseCard, version: '^1.2.3' }, 'version'],
      [{ ...baseCard, version: '>=1.2.3' }, 'version'],
      [{ ...baseCard, version: '1.x' }, 'version'],
      [{ ...baseCard, version: '1.*' }, 'version'],
    ];
    for (const [card, field] of cases) {
      const result = validateMcpServerCard(card);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toContain(field);
    }
  });

  it('validates remote URL/scheme and picks by transport + protocol version', () => {
    const card = {
      ...baseCard,
      remotes: [
        {
          type: 'streamable-http',
          url: 'https://mcp.example.com/mcp',
          supportedProtocolVersions: ['2026-07-28'],
        },
        {
          type: 'sse',
          url: 'https://mcp.example.com/sse',
          supportedProtocolVersions: ['2025-11-25'],
        },
      ],
    };
    const result = validateMcpServerCard(card);
    expect(result.ok).toBe(true);
    expect(
      pickMcpServerCardRemote(result.card!, {
        transport: 'http',
        protocolVersion: '2026-07-28',
      })?.url,
    ).toBe('https://mcp.example.com/mcp');
    expect(
      pickMcpServerCardRemote(result.card!, {
        transport: 'http',
        protocolVersion: '2025-11-25',
      }),
    ).toBeUndefined();
    expect(
      pickMcpServerCardRemote(result.card!, { transport: 'sse', protocolVersion: '2025-11-25' })?.url,
    ).toBe('https://mcp.example.com/sse');
    expect(pickMcpServerCardRemote(result.card!, { transport: 'stdio' })).toBeUndefined();
  });

  it('rejects remote with whitespace or bad scheme', () => {
    const result = validateMcpServerCard({
      ...baseCard,
      remotes: [
        { type: 'streamable-http', url: 'ftp://mcp.example.com/mcp' },
        { type: 'sse', url: 'https://mcp.example.com/a b' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('url');
  });
});

describe('Server Card fetch', () => {
  it('returns parsed card on 200 JSON', async () => {
    const result = await fetchMcpServerCard('https://mcp.example.com/server-card', {
      fetchImpl: vi.fn(async () => jsonResponse({ ...baseCard, remotes: [] })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(result.card?.name).toBe('com.example/weather');
    expect(result.url).toBe('https://mcp.example.com/server-card');
  });

  it('returns structured failure on non-2xx, invalid JSON and oversize body', async () => {
    const badStatus = await fetchMcpServerCard('https://mcp.example.com/server-card', {
      fetchImpl: vi.fn(async () => jsonResponse({ error: 'no' }, 404)) as unknown as typeof fetch,
    });
    expect(badStatus.ok).toBe(false);
    expect(badStatus.errors.join(' ')).toContain('404');

    const badJson = await fetchMcpServerCard('https://mcp.example.com/server-card', {
      fetchImpl: vi.fn(async () => new Response('not-json', { status: 200 })) as unknown as typeof fetch,
    });
    expect(badJson.ok).toBe(false);
    expect(badJson.errors.join(' ')).toContain('JSON');

    const big = await fetchMcpServerCard('https://mcp.example.com/server-card', {
      fetchImpl: vi.fn(async () => new Response('x'.repeat(1024), { status: 200 })) as unknown as typeof fetch,
      maxBytes: 128,
    });
    expect(big.ok).toBe(false);
    expect(big.errors.join(' ')).toContain('上限');
  });

  it('does not follow redirects', async () => {
    const result = await fetchMcpServerCard('https://mcp.example.com/server-card', {
      fetchImpl: vi.fn(async () => {
        throw new TypeError('unexpected redirect');
      }) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('redirect');
  });
});

describe('Server Card 配置校验', () => {
  it('accepts serverCardUrl and requireServerCard together', () => {
    const result = validateMcpConfig({
      servers: [
        {
          name: 'remote',
          transport: 'http',
          url: 'https://mcp.example.com/mcp',
          serverCardUrl: 'https://mcp.example.com/server-card',
          requireServerCard: true,
        },
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('rejects bad serverCardUrl and require without URL', () => {
    const result = validateMcpConfig({
      servers: [
        { name: 'a', transport: 'http', url: 'https://mcp.example.com/mcp', serverCardUrl: 'ftp://x' },
        { name: 'b', transport: 'http', url: 'https://mcp.example.com/mcp', requireServerCard: true },
      ],
    });
    expect(result.errors.join(' ')).toContain('serverCardUrl');
    expect(result.errors.join(' ')).toContain('requireServerCard');
  });
});
