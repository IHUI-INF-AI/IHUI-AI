// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-112 回归:`web_search` 只校验首跳且响应体无上限。
 *
 * 缺陷原状:只对首跳 `searchUrl` 调一次 `assertSafeFetchUrl`,随后 `redirect:'follow'`;
 * `await res.text()` 无字节闸 ⇒ 公网对端一条 302 即可把请求带进内网,超大 HTML 先全量进内存。
 *
 * 判据(必须同时成立,否则只证明"拒了"或只证明"改过"):
 *   ① 重定向目标真被 SSRF 守卫重新裁决过(探针记到第二跳 URL),且该跳**没有**被真发出;
 *   ② 超大响应体是明确失败(response_too_large),读取字节数有界(不是无限读入后截断)。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as SsrfGuardModule from '@ihui/shared/utils/ssrf-guard';

/** 被守卫裁决过的 URL 序列(vi.mock 工厂提升 ⇒ 状态先于模块图存在) */
const probe = vi.hoisted(() => ({ judged: [] as string[] }));

// 搜索端点本身是公网常量域名,测试环境不联网 ⇒ 仅该主机桩成放行;
// 其余目标(重定向跳)一律走真实判据 —— IP 字面量与协议白名单不需要 DNS。
vi.mock('@ihui/shared/utils/ssrf-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof SsrfGuardModule>();
  return {
    ...actual,
    assertSafeFetchUrl: async (rawUrl: string) => {
      probe.judged.push(rawUrl);
      if (new URL(rawUrl).hostname === 'html.duckduckgo.com') {
        return { safe: true, host: 'html.duckduckgo.com' };
      }
      return actual.assertSafeFetchUrl(rawUrl);
    },
  };
});

import { web_search, MAX_SEARCH_RESPONSE_BYTES } from '../src/tools/web-search.js';

describe('F-112 web_search 逐跳重定向校验 + 响应体上限', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let origHooksConfig: string | undefined;

  beforeEach(() => {
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-websearch-f112.json');
    probe.judged = [];
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
  });

  it('302 指向内网 IP:第二跳被重新裁决并拒绝,内网目标一次都没被请求', async () => {
    const internal = 'http://169.254.169.254/latest/meta-data/';
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: internal } }),
    );

    const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('ssrf_denied');
    expect(r.error).toContain('169.254.169.254');
    // 守卫真的对第二跳跑过(不是只校验首跳)
    expect(probe.judged.some((u) => u === internal)).toBe(true);
    // 而且只在首跳上发过请求,内网目标没有发出
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('html.duckduckgo.com');
  });

  it('302 指向非 http(s)(file://):按协议白名单拒绝', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'file:///etc/passwd' } }),
    );

    const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('ssrf_denied');
    expect(r.error).toContain('protocol-denied');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('自指重定向:超过跳数上限后中止,不会无限跟跳', async () => {
    fetchSpy.mockImplementation(
      async () => new Response(null, { status: 302, headers: { location: '/loop' } }),
    );

    const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('redirect_limit');
    expect(r.error).toContain('重定向超过');
  });

  it('超大响应体(无限流):判失败且读取字节有界,不无限读入', async () => {
    const chunkBytes = 256 * 1024;
    const chunk = new Uint8Array(chunkBytes).fill(0x61);
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(stream, { status: 200, headers: { 'content-type': 'text/html' } }),
    );

    const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('response_too_large');
    expect(r.error).toContain('MiB');
    // 上限 + 少量预读余量即停;若"无上限"则这条无限流会一直读下去
    expect(pulled).toBeGreaterThan(0);
    expect(pulled).toBeLessThanOrEqual(MAX_SEARCH_RESPONSE_BYTES + chunkBytes * 4);
  });

  it('Content-Length 声明超限:不下载即失败,且报错说明来源是声明值', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('<html></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
          'content-length': String(MAX_SEARCH_RESPONSE_BYTES + 1),
        },
      }),
    );

    const r = await web_search.execute({ query: 'q' }, { workspacePath: '.' });

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('response_too_large');
    expect(r.error).toContain('Content-Length 声明');
  });

  it('正常小响应体(流式 body)仍能解析出结果,新闸不误伤', async () => {
    const html = [
      '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fok">OK Title</a>',
      '<a class="result__snippet" href="https://example.com">OK Snippet</a>',
    ].join('');
    fetchSpy.mockResolvedValueOnce(
      new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
    );

    const r = await web_search.execute({ query: 'ok' }, { workspacePath: '.' });

    expect(r.success).toBe(true);
    expect(r.output).toContain('OK Title');
    expect(r.output).toContain('https://example.com/ok');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
