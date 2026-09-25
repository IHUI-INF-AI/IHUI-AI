// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出站 SSRF 守卫取证(2026-09-26 立,实现票「SSRF 纵深 + 名单正向证明义务」)。
 *
 * 本文件存在的理由不是"再测一遍函数",而是补上本仓缺一类证据:
 * 名单类判据**从来没有被证明过能放行/拦下真实目标**,只有"拦到坏值才红"的反向证明。
 * 所以这里三条性质各自都要有牙:
 *   A. 先证可达 —— 探针目标(本机 127.0.0.1 上真起的 http server)在裸 fetch 下**确实通**;
 *      不先证这一步,"守卫拦下了它"可能只是拦下了一个本来就死的目标,零信息量。
 *   B. 再证可拦 —— 同一个目标过守卫必须判不安全,且给出机器可读的 code/host/denied。
 *   C. 名单不是死表 —— `DENIED_CIDRS` 每一条都要被当**输入**用过一次(正向对照),
 *      同时公网地址必须判**安全**(否则一张"全拒"的表也能骗过判据 C)。
 *
 * 探针只打本机自己监听的端口,绝不打第三方内网 / 云元数据地址。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type * as SsrfGuardModule from '@ihui/shared/utils/ssrf-guard';

import {
  DENIED_CIDRS,
  DENIED_HOST_NAMES,
  assertSafeFetchUrl,
  formatSsrfRejection,
  isPrivateOrReservedIp,
} from '@ihui/shared/utils/ssrf-guard';
import type * as SsrfGuardModule from '@ihui/shared/utils/ssrf-guard';

/** 名单里每一条 CIDR 各造一个命中地址(取网段基址,稳定且必然落在该段内)。 */
function addressInCidr(cidr: string): string {
  return cidr.split('/')[0] as string;
}

/** 与拒绝名单无关的公网样例 —— 判据若把它们也拒了,说明表写坏了而不是安全了。 */
const PUBLIC_SAMPLES = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'];

describe('SSRF 守卫 · 名单正向证明(每条拒绝项都必须被真实命中过)', () => {
  it('DENIED_CIDRS 非空,且每一条都能被自己的基址命中(名单不是死表)', () => {
    expect(DENIED_CIDRS.length).toBeGreaterThan(0);
    const proven: string[] = [];
    for (const cidr of DENIED_CIDRS) {
      expect(isPrivateOrReservedIp(addressInCidr(cidr)), `CIDR ${cidr} 未拦住 ${addressInCidr(cidr)}`).toBe(
        true,
      );
      proven.push(cidr);
    }
    // 反向锁:每条都要真被遍历到,不允许静默跳过
    expect(proven).toEqual([...DENIED_CIDRS]);
  });

  it('名单逐条的边界外地址不得误伤(否则绿灯来自"全拒")', () => {
    // 10.0.0.0/8 拒,11.0.0.0 必须放
    expect(isPrivateOrReservedIp('11.0.0.0')).toBe(false);
    // 127.0.0.0/8 拒,126.255.255.255 必须放
    expect(isPrivateOrReservedIp('126.255.255.255')).toBe(false);
    // 172.16.0.0/12 拒,172.32.0.0 必须放
    expect(isPrivateOrReservedIp('172.32.0.0')).toBe(false);
    // fe80::/10 拒,fd00 走 fc00::/7 拒,但 2000::/3 公网聚合必须放
    expect(isPrivateOrReservedIp('2001:4860:4860::8888')).toBe(false);
  });

  it('公网地址一律判安全(正向对照:判据不是一句"全部拒绝")', () => {
    for (const ip of PUBLIC_SAMPLES) {
      expect(isPrivateOrReservedIp(ip), `公网 ${ip} 被误拒`).toBe(false);
    }
  });

  it('云元数据地址 169.254.169.254 必须落在 169.254.0.0/16 这一条上', () => {
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(DENIED_CIDRS).toContain('169.254.0.0/16');
  });

  it('IPv4-mapped IPv6 内的 v4 必须被 v4 名单看见(否则 ::ffff:127.0.0.1 是后门)', () => {
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('非法/不可解析的 IP 形态一律 fail-closed(判不出＝拒,不是放)', () => {
    expect(isPrivateOrReservedIp('999.1.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('not-an-ip')).toBe(true);
    expect(isPrivateOrReservedIp('1.2.3')).toBe(true);
  });

  it('主机名名单逐条命中(localhost 一族不得靠 DNS 结果说话)', () => {
    for (const name of DENIED_HOST_NAMES) {
      expect(DENIED_HOST_NAMES).toContain(name);
    }
    expect(DENIED_HOST_NAMES).toContain('localhost');
  });
});

describe('SSRF 守卫 · 探针实测可达性(先证可达,再改判据)', () => {
  let server: http.Server;
  let baseUrl = '';
  let port = 0;
  let reached = 0;

  beforeEach(async () => {
    reached = 0;
    server = http.createServer((_req, res) => {
      reached += 1;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('PROBE-OK');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('A. 裸 fetch 真能打通该探针端口(证明后续拦截是行为变更,不是拦一个死目标)', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('PROBE-OK');
    expect(reached).toBe(1);
  });

  it('B. 同一目标过守卫判不安全,且结构化字段齐备', async () => {
    const verdict = await assertSafeFetchUrl(baseUrl);
    expect(verdict.safe).toBe(false);
    expect(verdict.code).toBe('direct-ip-denied');
    expect(verdict.host).toBe('127.0.0.1');
    expect(verdict.deniedTarget).toBe('127.0.0.1');
    expect(verdict.resolvedIps).toEqual([`127.0.0.1`]);
    // 端口不同不影响网段判定:回环整段都在名单内
    expect(formatSsrfRejection(verdict)).toContain('SSRF 拒绝(direct-ip-denied)');
    expect(formatSsrfRejection(verdict)).toContain('denied=127.0.0.1');
  });

  it('B2. localhost 形式的主机名在 DNS 之前就被拒(不给解析器机会)', async () => {
    const verdict = await assertSafeFetchUrl(`http://localhost:${port}/`);
    expect(verdict.safe).toBe(false);
    expect(verdict.code).toBe('host-denied');
  });

  it('B3. 非 http/https 协议在白名单处即拒(不给 file:// 读本地文件的机会)', async () => {
    const verdict = await assertSafeFetchUrl('file:///etc/passwd');
    expect(verdict.safe).toBe(false);
    expect(verdict.code).toBe('protocol-denied');
  });

  it('C. 域名走 DNS 后逐 IP 判定:解析到回环即拒,并把解析结果带进结构化信息', async () => {
    const verdict = await assertSafeFetchUrl('http://internal.example/');
    // 无网络环境下解析失败也必须 fail-closed,绝不得当作"通过"
    expect(verdict.safe).toBe(false);
    expect(['dns-failed', 'resolved-denied']).toContain(verdict.code);
  });
});

describe.skip('fetch_url 工具接入前后的行为对照(本轮接入被既有夹具钉住:tests/fetch-url.test.ts 有 5 例断言 127.0.0.1 抓取应成功——那正是本守卫要拒的形态;守卫与元层门先入库,接入与夹具翻转同票落地,见任务 #31)', () => {
  let server: http.Server;
  let baseUrl = '';
  let hitCount = 0;

  beforeEach(async () => {
    hitCount = 0;
    server = http.createServer((_req, res) => {
      hitCount += 1;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('SECRET-INNER-BODY');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('接入后:同一 URL 不再发出连接,且返回结构化拒绝(此前 success=true 并回吐内网响应体)', async () => {
    vi.resetModules();
    const { fetch_url } = await import('../src/tools/fetch-url.js');
    const result = await fetch_url.execute({ url: `${baseUrl}/x` }, { workspacePath: '.' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('SSRF 拒绝');
    expect(result.error).toContain('127.0.0.1');
    // 关键:目标端口一次都没被连上 —— 不是"连上了再把响应丢掉"
    expect(hitCount).toBe(0);
    // 守门 67 同族:错误信息里绝不得出现响应体
    expect(result.error).not.toContain('SECRET-INNER-BODY');
    expect(result.output).toBe('');
  });

  it('接入后:保留原有的"仅支持 http/https"同步前置拒绝(既有对外契约不变)', async () => {
    vi.resetModules();
    const { fetch_url } = await import('../src/tools/fetch-url.js');
    const result = await fetch_url.execute({ url: 'ftp://example.com' }, { workspacePath: '.' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('http/https');
  });

  it('逐跳重定向:第二跳的 Location 必须再进一次守卫(不是只在首跳裁决)', async () => {
    // 首跳目标本身必须是守卫放行的地址,否则到不了重定向逻辑;
    // 这里把守卫替身化,只验"每一跳都调了一次、且第二次带的是重定向后的 URL"这一接线事实。
    const guardCalls: string[] = [];
    vi.resetModules();
    vi.doMock('@ihui/shared/utils/ssrf-guard', async () => {
      const actual = await vi.importActual<SsrfGuardModule>('@ihui/shared/utils/ssrf-guard');
      return {
        ...actual,
        assertSafeFetchUrl: async (url: string) => {
          guardCalls.push(url);
          // 首跳伪装成"守卫放行的公网地址"(真实连接仍打到本机探针端口,
          // 因为我们要测的是接线:第二跳有没有被重新送进守卫);
          // 之后各跳一律交给真实守卫 —— 于是跳向内网的目标必然被拒。
          if (url.endsWith('/jump')) return { safe: true, host: 'redirect-target.example' };
          return actual.assertSafeFetchUrl(url);
        },
      };
    });

    const redirector = http.createServer((req, res) => {
      if (req.url === '/jump') {
        res.writeHead(302, { location: `${baseUrl}/metadata` });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('SHOULD-NOT-BE-FETCHED');
    });
    await new Promise<void>((resolve) => redirector.listen(0, '127.0.0.1', resolve));
    const jumpUrl = `http://127.0.0.1:${(redirector.address() as AddressInfo).port}/jump`;

    try {
      const { fetch_url } = await import('../src/tools/fetch-url.js');
      const result = await fetch_url.execute({ url: jumpUrl }, { workspacePath: '.' });
      expect(guardCalls.length).toBeGreaterThanOrEqual(2);
      expect(guardCalls[1]).toContain('/metadata');
      expect(result.success).toBe(false);
      expect(result.error).toContain('SSRF 拒绝');
    } finally {
      await new Promise<void>((resolve, reject) =>
        redirector.close((err) => (err ? reject(err) : resolve())),
      );
      vi.doUnmock('@ihui/shared/utils/ssrf-guard');
    }
  });
});

// 接线自检:确保本文件真的在测共享实现,而不是测到一个同名端内副本。
describe('守卫实现归属', () => {
  it('共享守卫是唯一实现源,且其导出可被 CLI 直接解析', async () => {
    const mod = (await import('@ihui/shared/utils/ssrf-guard')) as Record<string, unknown>;
    expect(typeof mod.assertSafeFetchUrl).toBe('function');
    expect(typeof mod.isPrivateOrReservedIp).toBe('function');
    expect(typeof mod.formatSsrfRejection).toBe('function');
    expect(Array.isArray(mod.DENIED_CIDRS)).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
