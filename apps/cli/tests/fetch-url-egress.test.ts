// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fetch_url 字面出口守卫(fetch-url-egress)测试 — 票 G-937973。
 *
 * 机制验收点:
 *  - 仅字面 IP 阻断:URL host 是 IP 字面量才判,域名一律不预解析、不放行字面阻断;
 *  - NAT64/DNS64 well-known 前缀(64:ff9b::/96)还原内嵌 IPv4 再判公网;
 *  - IPv6 special-use(::1、fc00::/7、fe80::/10、64:ff9b:1::/48、100::/64、2001:2::/48...)显式排除;
 *  - 198.18.0.0/15 基准测试段阻断;
 *  - 错误文案不泄漏解析/还原出的内网 IP;
 *  - x-proxy-error: blocked-by-allowlist 代理头识别;
 *  - 正常放行路径(example.com 域名)不回归。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as SsrfGuardModule from '@ihui/shared/utils/ssrf-guard';

import {
  assertFetchLiteralEgress,
  EGRESS_BLOCKED_ERROR_TYPE,
  EgressBlockedError,
  formatEgressBlockedMessage,
  isEgressBlockedError,
  isProxyAllowlistBlock,
  proxyAllowlistBlockedMessage,
} from '../src/tools/fetch-url-egress.js';

function expectBlocked(raw: string): void {
  expect(() => assertFetchLiteralEgress(new URL(raw))).toThrow(EgressBlockedError);
}

function expectAllowed(raw: string): void {
  expect(() => assertFetchLiteralEgress(new URL(raw))).not.toThrow();
}

describe('字面出口守卫 — 仅字面 IP 判定(无 DNS preflight)', () => {
  it('普通域名不触发字面阻断(正常放行路径不回归)', () => {
    expectAllowed('http://example.com/');
    expectAllowed('https://www.example.com/a?b=c');
    expectAllowed('https://anything.company.internal/'); // 名字类目标归 SSRF 域,不在这里预解析
    expectAllowed('https://example.com./'); // 尾点域名
  });

  it('localhost 与 *.localhost 在主机名层阻断', () => {
    expectBlocked('http://localhost/');
    expectBlocked('http://LOCALHOST/');
    expectBlocked('http://foo.localhost/');
    expectBlocked('http://api.foo.localhost/');
  });

  it('IPv4 私网/回环/链路本地/CGNAT/基准/组播/保留段全部 EgressBlocked', () => {
    expectBlocked('http://127.0.0.1/');
    expectBlocked('http://10.0.0.1/');
    expectBlocked('http://172.16.0.1/');
    expectBlocked('http://192.168.1.1/');
    expectBlocked('http://169.254.169.254/'); // 云元数据
    expectBlocked('http://100.64.0.1/'); // CGNAT
    expectBlocked('http://0.1.2.3/'); // "this network" 段
    expectBlocked('http://198.18.0.1/'); // 基准测试段下半
    expectBlocked('http://198.19.0.1/'); // 基准测试段上半(198.18.0.0/15)
    expectBlocked('http://224.0.0.1/'); // 组播
    expectBlocked('http://240.0.0.1/'); // 保留
    expectBlocked('http://255.255.255.255/'); // 受限广播
  });

  it('IPv6 special-use 显式排除:回环/ULA/链路本地/组播/未指定', () => {
    expectBlocked('http://[::1]/');
    expectBlocked('http://[::]/'); // unspecified
    expectBlocked('http://[fc00::1]/'); // ULA
    expectBlocked('http://[fd12::1]/'); // ULA(fd00::/8)
    expectBlocked('http://[fe80::1]/'); // 链路本地
    expectBlocked('http://[ff02::1]/'); // 组播
  });

  it('NAT64/DNS64 well-known 前缀(64:ff9b::/96)还原内嵌 IPv4 再判', () => {
    // 内嵌 127.0.0.1 / 169.254.169.254 → 还原后按 IPv4 政策判非公网
    expectBlocked('http://[64:ff9b::7f00:1]/');
    expectBlocked('http://[64:ff9b::a9fe:a9fe]/');
    // 内嵌公网 8.8.8.8 → 还原后放行(不能按前缀名整段拒)
    expectAllowed('http://[64:ff9b::808:808]/');
  });

  it('IPv4-mapped IPv6(::ffff:0:0/96)折回 IPv4 判', () => {
    expectBlocked('http://[::ffff:127.0.0.1]/');
    expectAllowed('http://[::ffff:8.8.8.8]/');
  });

  it('local-use DNS64(64:ff9b:1::/48)整段排除(RFC 8215,无公网目的)', () => {
    expectBlocked('http://[64:ff9b:1::1]/');
    expectBlocked('http://[64:ff9b:1::7f00:1]/');
  });

  it('其余 IPv6 special-use 段排除:benchmark/ORCHID/ORCHIDv2/Teredo/6to4/discard/文档段', () => {
    expectBlocked('http://[2001:2::1]/'); // benchmarking
    expectBlocked('http://[2001:10::1]/'); // ORCHID
    expectBlocked('http://[2001:20::1]/'); // ORCHIDv2
    expectBlocked('http://[2001::1]/'); // Teredo
    expectBlocked('http://[2002:7f00:1::]/'); // 6to4(嵌 127.0.0.1)
    expectBlocked('http://[100::1]/'); // discard-only
    expectBlocked('http://[2001:db8::1]/'); // 文档段
  });

  it('公网 IPv4/IPv6 字面量放行', () => {
    expectAllowed('http://8.8.8.8/');
    expectAllowed('http://1.1.1.1/');
    expectAllowed('http://[2606:4700::1111]/');
    expectAllowed('http://[2001:4860:4860::8888]/');
  });

  it('错误为 EgressBlockedError 且文案不回显地址', () => {
    try {
      assertFetchLiteralEgress(new URL('http://[64:ff9b::7f00:1]/'));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(isEgressBlockedError(err)).toBe(true);
      expect((err as EgressBlockedError).code).toBe('EgressBlocked');
      const msg = (err as Error).message;
      expect(msg).toContain('EgressBlocked');
      expect(msg).not.toContain('127.0.0.1'); // 还原出的内嵌 IPv4 不得出现
      expect(msg).not.toContain('7f00:1');
    }
  });
});

describe('字面出口守卫 — fetch_url 接线', () => {
  let origHooksConfig: string | undefined;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-fetch-egress.json');
  });

  afterEach(() => {
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadFetchUrlWithSsrfPassesthrough() {
    vi.doMock('@ihui/shared/utils/ssrf-guard', async (importOriginal) => {
      const actual = await importOriginal<typeof SsrfGuardModule>();
      return {
        ...actual,
        assertSafeFetchUrl: async (rawUrl: string) => ({ safe: true, host: new URL(rawUrl).hostname }),
      };
    });
    const mod = await import('../src/tools/fetch-url.js');
    return mod.fetch_url;
  }

  function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
    fetchMock = vi.fn(async (url: unknown, init: unknown) => handler(String(url), init as RequestInit));
    vi.stubGlobal('fetch', fetchMock);
  }

  it('http://127.1/ 被 EgressBlocked 阻断,文案不泄漏还原后的 127.0.0.1,且未发起 fetch', async () => {
    stubFetch(() => new Response('should-not-be-reached'));
    const fetch_url = await loadFetchUrlWithSsrfPassesthrough();
    const r = await fetch_url.execute({ url: 'http://127.1/' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.errorType).toBe(EGRESS_BLOCKED_ERROR_TYPE);
    expect(r.error).toContain('EgressBlocked');
    expect(r.error).not.toContain('127.0.0.1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('http://[::1]/ 与 http://[64:ff9b::7f00:1]/ 与 http://198.18.0.1/ 均 EgressBlocked', async () => {
    stubFetch(() => new Response('nope'));
    const fetch_url = await loadFetchUrlWithSsrfPassesthrough();
    for (const url of ['http://[::1]/', 'http://[64:ff9b::7f00:1]/', 'http://198.18.0.1/']) {
      const r = await fetch_url.execute({ url }, { workspacePath: '.' });
      expect(r.errorType).toBe(EGRESS_BLOCKED_ERROR_TYPE);
      expect(r.success).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('example.com 域名不被字面阻断,正常走到 fetch(SSRF 桩放行 + fetch 桩 200)', async () => {
    stubFetch(() => new Response('hello from example', { status: 200, headers: { 'content-type': 'text/plain' } }));
    const fetch_url = await loadFetchUrlWithSsrfPassesthrough();
    const r = await fetch_url.execute({ url: 'http://example.com/x' }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.output).toContain('hello from example');
  });

  it('公网站点 302 到字面内网 IP:第二跳被字面守卫拦截', async () => {
    stubFetch(() => new Response(null, { status: 302, headers: { location: 'http://10.0.0.5/flag' } }));
    const fetch_url = await loadFetchUrlWithSsrfPassesthrough();
    const r = await fetch_url.execute({ url: 'http://example.com/redirect' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.errorType).toBe(EGRESS_BLOCKED_ERROR_TYPE);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 第二跳在 fetch 前被拦
    expect(r.error).not.toContain('10.0.0.5');
  });

  it('x-proxy-error: blocked-by-allowlist 响应头 → EgressBlocked,文案只含 domain 不含 IP', async () => {
    stubFetch(
      () =>
        new Response('proxy block page', {
          status: 200,
          headers: { 'x-proxy-error': 'blocked-by-allowlist', 'content-type': 'text/plain' },
        }),
    );
    const fetch_url = await loadFetchUrlWithSsrfPassesthrough();
    const r = await fetch_url.execute({ url: 'http://example.com/blocked' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.errorType).toBe(EGRESS_BLOCKED_ERROR_TYPE);
    expect(r.error).toContain('EGRESS_BLOCKED');
    expect(r.error).toContain('example.com');
  });

  it('底层错误含 "resolved to" 时文案泛化,不泄漏解析出的内网 IP', async () => {
    // 直接单测泛化函数(机制点同 upstream formatEgressBlockedMessage)
    const scrubbed = formatEgressBlockedMessage(
      'fetch failed: gateway resolved to 10.1.2.3',
      'example.com',
    );
    expect(scrubbed).not.toContain('10.1.2.3');
    expect(scrubbed).toContain('example.com');
    expect(formatEgressBlockedMessage('timeout while connecting', 'example.com')).toBe(
      'timeout while connecting',
    );
  });

  it('isProxyAllowlistBlock 只认精确头值', () => {
    const h = (v: string | null) => new Headers(v === null ? {} : { 'x-proxy-error': v });
    expect(isProxyAllowlistBlock(h('blocked-by-allowlist'))).toBe(true);
    expect(isProxyAllowlistBlock(h('other'))).toBe(false);
    expect(isProxyAllowlistBlock(h(null))).toBe(false);
  });

  it('proxyAllowlistBlockedMessage 输出 JSON 且只含 domain', () => {
    const msg = proxyAllowlistBlockedMessage('example.com');
    const parsed = JSON.parse(msg) as { error_type: string; domain: string; message: string };
    expect(parsed.error_type).toBe('EGRESS_BLOCKED');
    expect(parsed.domain).toBe('example.com');
    expect(msg).not.toContain('10.');
    expect(msg).not.toContain('127.');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
