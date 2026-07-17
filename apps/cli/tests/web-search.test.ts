/**
 * web_search 工具测试 — DuckDuckGo HTML 解析 / URL 编码 / 错误处理 / 结果格式化。
 * parseDuckDuckGoResults 为模块私有函数,经 execute 公共入口 mock fetch 验证。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { web_search, WEB_SEARCH_TOOLS } from '../src/tools/web-search.js';

function makeResponse(html: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    text: () => Promise.resolve(html),
  } as unknown as Response;
}

function resultBlock(rawHref: string, title: string, snippet = ''): string {
  const snip = snippet
    ? `<a class="result__snippet" href="https://example.com">${snippet}</a>`
    : '';
  return `<a rel="nofollow" class="result__a" href="${rawHref}">${title}</a>${snip}`;
}

describe('WEB_SEARCH_TOOLS 注册', () => {
  it('数组含 web_search 工具,危险级别 read', () => {
    expect(WEB_SEARCH_TOOLS).toHaveLength(1);
    expect(WEB_SEARCH_TOOLS[0]!.name).toBe('web_search');
    expect(web_search.dangerLevel).toBe('read');
  });
});

describe('web_search', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let origHooksConfig: string | undefined;

  beforeEach(() => {
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-websearch.json');
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
  });

  describe('HTML 解析(parseDuckDuckGoResults)', () => {
    it('基本解析:3 个 result__a + snippet → 输出含 3 条标题/URL/摘要', async () => {
      const html = [
        resultBlock('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F1', 'Title 1', 'Snippet 1'),
        resultBlock('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F2', 'Title 2', 'Snippet 2'),
        resultBlock('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F3', 'Title 3', 'Snippet 3'),
      ].join('');
      fetchSpy.mockResolvedValueOnce(makeResponse(html));

      const r = await web_search.execute({ query: 'test' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('找到 3 条结果');
      expect(r.output).toContain('Title 1');
      expect(r.output).toContain('Title 2');
      expect(r.output).toContain('Title 3');
      expect(r.output).toContain('https://example.com/1');
      expect(r.output).toContain('https://example.com/2');
      expect(r.output).toContain('https://example.com/3');
      expect(r.output).toContain('Snippet 1');
      expect(r.output).toContain('Snippet 2');
      expect(r.output).toContain('Snippet 3');
    });

    it('uddg 参数还原:含 uddg=https%3A%2F%2Fexample.com%2Fpath → 还原为 https://example.com/path', async () => {
      const html = resultBlock(
        '//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpath&rut=abc',
        'T',
        'S',
      );
      fetchSpy.mockResolvedValueOnce(makeResponse(html));

      const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('https://example.com/path');
      expect(r.output).not.toContain('uddg=');
    });

    it('无 uddg 参数:href 直接是 https://example.com → 保留原 URL', async () => {
      const html = resultBlock('https://example.com/direct', 'T', 'S');
      fetchSpy.mockResolvedValueOnce(makeResponse(html));

      const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('https://example.com/direct');
    });

    it('max 限制:HTML 含 10 个结果 → 返回 5 个(MAX_RESULTS)', async () => {
      const blocks = Array.from({ length: 10 }, (_, i) =>
        resultBlock(
          `//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F${i}`,
          `Title ${i}`,
          `Snippet ${i}`,
        ),
      );
      fetchSpy.mockResolvedValueOnce(makeResponse(blocks.join('')));

      const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('找到 5 条结果');
      expect(r.output.match(/### \d+\./g)).toHaveLength(5);
    });

    it('空 HTML:无 result__a → 输出"无结果"', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse('<html><body>no results</body></html>'));

      const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('无结果');
    });

    it('摘要截断:snippet 超 300 字符 → 截断为 300 字符 + "..."', async () => {
      const longSnippet = 'A'.repeat(400);
      const html = resultBlock('https://example.com/s', 'T', longSnippet);
      fetchSpy.mockResolvedValueOnce(makeResponse(html));

      const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      const m = r.output.match(/摘要: (.+)/);
      expect(m).not.toBeNull();
      expect(m![1]).toBe('A'.repeat(300) + '...');
    });

    it('HTML 标签清理:title/snippet 含 <b>/<em> → 移除标签', async () => {
      const html = resultBlock('https://example.com/t', '<b>Bold</b> Title', 'foo <em>bar</em> baz');
      fetchSpy.mockResolvedValueOnce(makeResponse(html));

      const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('Bold Title');
      expect(r.output).not.toContain('<b>');
      expect(r.output).not.toContain('<em>');
      expect(r.output).toContain('foo bar baz');
    });
  });

  describe('execute 行为', () => {
    it('成功:mock fetch 返回 HTML → success=true 且 output 含 title/url/snippet', async () => {
      const html = resultBlock(
        '//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fok',
        'OK Title',
        'OK Snippet',
      );
      fetchSpy.mockResolvedValueOnce(makeResponse(html));

      const r = await web_search.execute({ query: 'ok' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('OK Title');
      expect(r.output).toContain('https://example.com/ok');
      expect(r.output).toContain('OK Snippet');
    });

    it('空结果:mock fetch 返回无结果 HTML → success=true 且 output 提示"无结果"', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse('<html></html>'));

      const r = await web_search.execute({ query: 'empty' }, { workspacePath: '.' });
      expect(r.success).toBe(true);
      expect(r.output).toContain('无结果');
    });

    it('fetch 失败:mock fetch reject → success=false 且含 error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'));

      const r = await web_search.execute({ query: 'fail' }, { workspacePath: '.' });
      expect(r.success).toBe(false);
      expect(r.error).toContain('network down');
    });

    it('缺 query 参数:返回 success=false 且 error 提示参数缺失', async () => {
      const r = await web_search.execute({}, { workspacePath: '.' });
      expect(r.success).toBe(false);
      expect(r.error).toContain('query');
    });

    it('query 自动 URL 编码:含中文/空格 → fetch URL 含编码后的 query', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse('<html></html>'));

      await web_search.execute({ query: '你好 world' }, { workspacePath: '.' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = String(fetchSpy.mock.calls[0]![0]);
      expect(calledUrl).toContain(encodeURIComponent('你好 world'));
      expect(calledUrl).not.toContain('你好 world');
    });
  });
});
