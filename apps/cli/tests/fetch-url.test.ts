/**
 * fetch_url 工具测试 — URL 校验 / HTML 清洗 / 错误处理 / 截断
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { FETCH_TOOLS, fetch_url } from '../src/tools/fetch-url.js';

describe('FETCH_TOOLS 注册', () => {
  it('注册 1 个 fetch_url 工具,危险级别 read', () => {
    expect(FETCH_TOOLS).toHaveLength(1);
    expect(FETCH_TOOLS[0]!.name).toBe('fetch_url');
    expect(fetch_url.dangerLevel).toBe('read');
  });
});

describe('fetch_url 参数校验(无网络)', () => {
  let origHooksConfig: string | undefined;

  beforeEach(() => {
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-fetch.json');
  });

  afterEach(() => {
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
  });

  it('缺少 url 参数返回错误', async () => {
    const r = await fetch_url.execute({}, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('url');
  });

  it('非 http/https 协议被拒绝(ftp/file)', async () => {
    const r1 = await fetch_url.execute({ url: 'ftp://example.com' }, { workspacePath: '.' });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain('http/https');
    const r2 = await fetch_url.execute({ url: 'file:///etc/passwd' }, { workspacePath: '.' });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('http/https');
  });
});

describe('fetch_url 本地 HTTP 服务', () => {
  let server: http.Server;
  let baseUrl: string;
  let origHooksConfig: string | undefined;
  let routes: Record<string, { status?: number; body: string; contentType: string }>;

  beforeEach(async () => {
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-fetch.json');
    routes = {};
    server = http.createServer((req, res) => {
      const route = routes[req.url ?? '/'];
      if (!route) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(route.status ?? 200, { 'content-type': route.contentType });
      res.end(route.body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(() => {
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    server.close();
  });

  it('HTML 内容被清洗(去 script/style/nav/header/footer,保留正文)', async () => {
    routes['/html'] = {
      contentType: 'text/html',
      body: '<html><head><script>alert(1)</script><style>x{}</style></head><body><nav>菜单</nav><header>头</header><p>正文内容</p><footer>底</footer></body></html>',
    };
    const r = await fetch_url.execute({ url: `${baseUrl}/html` }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toContain('正文内容');
    expect(r.output).not.toContain('alert(1)');
    expect(r.output).not.toContain('菜单');
    expect(r.output).not.toContain('x{}');
    expect(r.output).not.toContain('头');
  });

  it('text/plain 内容原样返回(不做 HTML 清洗)', async () => {
    routes['/txt'] = {
      contentType: 'text/plain',
      body: 'plain text line1\nline2',
    };
    const r = await fetch_url.execute({ url: `${baseUrl}/txt` }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toContain('plain text line1');
    expect(r.output).toContain('line2');
  });

  it('HTTP 404 返回 success=false 且 error 含状态码', async () => {
    const r = await fetch_url.execute({ url: `${baseUrl}/no-such-route` }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('404');
  });

  it('超过 10K 字符的输出被截断(含 truncated 标记)', async () => {
    routes['/big'] = { contentType: 'text/plain', body: 'A'.repeat(20_000) };
    const r = await fetch_url.execute({ url: `${baseUrl}/big` }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toContain('truncated');
    expect(r.output.length).toBeLessThan(20_000);
  });

  it('输出头部包含状态码与最终 URL', async () => {
    routes['/ok'] = { contentType: 'text/plain', body: 'hi' };
    const r = await fetch_url.execute({ url: `${baseUrl}/ok` }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/^\[200\]/);
    expect(r.output).toContain(baseUrl);
  });
});
