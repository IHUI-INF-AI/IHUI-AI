// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Server Card + Skills over MCP 的连接级联测。
 *
 * 用本地 HTTP server 走完整的 2026 无状态路径，钉住：
 *   1. 显式 serverCardUrl 在连接前拉取、校验，并允许 requireServerCard；
 *   2. server/discover 的 skills 扩展声明经 capabilities 传进 conn；
 *   3. 只有声明了扩展的连接才会长出 skill_list / skill_load 两枚工具。
 */
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MCP_SERVER_CARD_SCHEMA_URL } from '../src/tools/mcp-server-card.js';
import {
  connectMcpServer,
  disconnectMcpConnection,
  mcpSkillToolsForConnection,
} from '../src/tools/mcp-runtime.js';

let server: Server;
let baseUrl = '';

function card() {
  return {
    $schema: MCP_SERVER_CARD_SCHEMA_URL,
    name: 'com.example/demo',
    version: '1.0.0',
    description: 'Local integration fixture.',
    remotes: [
      {
        type: 'streamable-http',
        url: `${baseUrl}/mcp`,
        supportedProtocolVersions: ['2026-07-28'],
      },
    ],
  };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/server-card') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(card()));
      return;
    }
    if (req.url !== '/mcp' && !req.url?.startsWith('/mcp?')) {
      res.writeHead(404).end();
      return;
    }
    const plain = req.url?.includes('plain=1') === true;
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const msg = JSON.parse(raw) as { id: number; method: string };
      const result =
        msg.method === 'server/discover'
          ? {
              resultType: 'complete',
              supportedVersions: ['2026-07-28'],
              capabilities: plain
                ? { tools: {}, resources: {} }
                : {
                    tools: {},
                    resources: {},
                    extensions: { 'io.modelcontextprotocol/skills': { directoryRead: true } },
                  },
              _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'fixture', version: '1.0.0' } },
            }
          : msg.method === 'tools/list'
            ? { tools: [] }
            : msg.method === 'resources/list'
              ? { resources: [] }
              : msg.method === 'prompts/list'
                ? { prompts: [] }
                : {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe('Server Card + Skills connection', () => {
  it('fetches card, connects 2026, and exposes skill tools only after extension declaration', async () => {
    const conn = await connectMcpServer({
      name: 'demo',
      transport: 'http',
      url: `${baseUrl}/mcp`,
      protocolVersion: '2026-07-28',
      serverCardUrl: `${baseUrl}/server-card`,
      requireServerCard: true,
    });
    try {
      expect(conn.connected).toBe(true);
      expect(conn.serverCard?.name).toBe('com.example/demo');
      expect(conn.mcpSkillsCapability).toEqual({ directoryRead: true });
      expect(mcpSkillToolsForConnection(conn).map((t) => t.name)).toEqual([
        'mcp__demo__skill_list',
        'mcp__demo__skill_load',
      ]);
    } finally {
      disconnectMcpConnection(conn);
    }
  });

  it('does not expose skill tools when server declares no skills extension', async () => {
    const conn = await connectMcpServer({
      name: 'plain',
      transport: 'http',
      url: `${baseUrl}/mcp?plain=1`,
      protocolVersion: '2026-07-28',
    });
    try {
      expect(conn.mcpSkillsCapability).toBeUndefined();
      expect(mcpSkillToolsForConnection(conn)).toEqual([]);
    } finally {
      disconnectMcpConnection(conn);
    }
  });
});

