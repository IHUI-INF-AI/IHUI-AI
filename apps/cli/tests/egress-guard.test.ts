// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子代理网络出站守卫(`src/subagents/egress-guard.ts`)行为测试 — 第 3 波覆盖面补测·簇 1。
 *
 * 钉住的行为契约(每条都是"改坏实现即翻红"的判据,不是 import 冒烟):
 *  1. `checkEgress` 模式分派:open 放行 / allowlist / blocklist / 未知模式 **FAIL-CLOSED**;
 *  2. URL 解析失败、非 http(s) 协议一律拒绝(不得回落"允许");
 *  3. localhost 段覆盖 IPv4 127/8 整段与 0.0.0.0,且受 `allowLocalhost` 支配;
 *  4. IP 字面量在 allowlist 模式默认拒绝 —— 即使该 IP 被写进 domains 也不放行;
 *  5. 通配符 `*.example.com` 只匹配子域、**不匹配裸域**;IP 不参与通配符匹配;
 *  6. `installEgressGuard` 的 fetch 腿:被拒请求以 reject 结束且**零副作用**(底层探针零调用),
 *     放行请求参数原样送达;uninstall 只撤自己设的针(不洗掉后装者)。
 *
 * 另附一条现状钉(见文末 ESM 面):`http`/`https` 命名空间在 ESM 下只读,该守卫的四路
 * http/https monkey-patch 在本仓运行形态下**静默失败**,而 `_installed` 仍被置真。
 * 这是被测面的既有缺陷,按"如实登记 + 改动必翻红"钉住,不在测试里掩盖也不在测试里修复。
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as http from 'node:http';
import type { NetworkEgressPolicy } from '@ihui/types';

import { checkEgress, installEgressGuard, isEgressGuardInstalled } from '../src/subagents/egress-guard.js';

const ALLOW: NetworkEgressPolicy = { mode: 'allowlist', domains: ['api.example.com'], allowLocalhost: false };

describe('checkEgress — 模式分派', () => {
  it('open 模式一律放行(含私网与任意协议),不再走后续判据', () => {
    const open: NetworkEgressPolicy = { mode: 'open' };
    expect(checkEgress(open, 'http://127.0.0.1/admin')).toEqual({ allowed: true, reason: 'open mode' });
    expect(checkEgress(open, 'file:///etc/passwd').allowed).toBe(true);
  });

  it('未知模式 FAIL-CLOSED:既不放行也不回落 allowlist', () => {
    const bogus = { mode: 'allow-all', domains: [] } as unknown as NetworkEgressPolicy;
    const got = checkEgress(bogus, 'http://api.example.com/ok');
    expect(got.allowed).toBe(false);
    expect(got.reason).toContain('unknown mode');
  });

  it('allowlist 命中域名放行,未命中拒绝', () => {
    expect(checkEgress(ALLOW, 'http://api.example.com/v1').allowed).toBe(true);
    expect(checkEgress(ALLOW, 'http://evil.example.org/v1').allowed).toBe(false);
  });

  it('blocklist 命中拒绝、未命中放行(与 allowlist 相反方向)', () => {
    const block: NetworkEgressPolicy = { mode: 'blocklist', domains: ['evil.com'] };
    expect(checkEgress(block, 'http://evil.com/x').allowed).toBe(false);
    expect(checkEgress(block, 'http://good.com/x').allowed).toBe(true);
  });

  it('domains 缺省(未给字段)时 allowlist 不放行任何域名', () => {
    expect(checkEgress({ mode: 'allowlist' }, 'http://api.example.com/').allowed).toBe(false);
  });
});

describe('checkEgress — 输入退化形态', () => {
  it('无法解析的 URL 拒绝,并给出可归因的原因', () => {
    const got = checkEgress(ALLOW, 'not a url');
    expect(got.allowed).toBe(false);
    expect(got.reason).toBe('无法解析 URL');
  });

  it.each(['file:///etc/passwd', 'ftp://api.example.com/x', 'data:text/plain,hi', 'gopher://api.example.com/'])(
    '非 http(s) 协议一律拒绝(即便 host 命中白名单):%s',
    (url) => {
      const got = checkEgress({ mode: 'allowlist', domains: ['api.example.com'] }, url);
      expect(got.allowed).toBe(false);
      expect(got.reason).toContain('non-http protocol');
    },
  );

  it('协议写对但整体非法的 URL 归因为解析失败(不得当成"未命中白名单"放行)', () => {
    for (const url of ['http://', 'http://:8080/x', 'http://999.1.1.1/x']) {
      const got = checkEgress({ mode: 'blocklist', domains: [] }, url);
      expect(got.allowed).toBe(false);
      expect(got.reason).toBe('无法解析 URL');
    }
  });
});

describe('checkEgress — localhost 段', () => {
  it.each(['localhost', '127.0.0.1', '127.5.5.5', '127.255.255.254', '0.0.0.0'])('缺省允许本地回环:%s', (host) => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: [] };
    const got = checkEgress(policy, `http://${host}/x`);
    expect(got.allowed).toBe(true);
    expect(got.reason).toBe('localhost allowed');
  });

  it('allowLocalhost:false 时回环也被拒(不得因白名单为空而放行)', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: [], allowLocalhost: false };
    for (const host of ['localhost', '127.0.0.1', '127.9.9.9', '0.0.0.0']) {
      const got = checkEgress(policy, `http://${host}/x`);
      expect(got.allowed).toBe(false);
      expect(got.reason).toBe('localhost blocked by policy');
    }
  });

  it('localhost 判定大小写不敏感', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: [], allowLocalhost: false };
    expect(checkEgress(policy, 'http://LOCALHOST:8080/x').allowed).toBe(false);
  });

  /**
   * 实测钉住的现状(不是期望语义):URL 解析出的 IPv6 host **保留方括号**
   * (`new URL('http://[::1]/').hostname === '[::1]'`),所以 `isLocalhost` 里的
   * `::1` / `0:0:0:0:0:0:0:1` / `::ffff:127.0.0.1` 三条形支在 URL 通道上不可达,
   * IPv6 一律落到 IP 通道 —— `allowLocalhost: true` 对 IPv6 本地服务无效。
   * 方向是 fail-closed(不误放行),但文档语义与实现分叉。谁改动 bracket 处理,这里必翻红。
   */
  it('IPv6 字面量走 IP 通道,allowLocalhost 对其不生效(现状钉)', () => {
    const openLocal: NetworkEgressPolicy = { mode: 'allowlist', domains: [], allowLocalhost: true };
    for (const host of ['[::1]', '[::ffff:127.0.0.1]']) {
      const got = checkEgress(openLocal, `http://${host}/x`);
      expect(got.allowed).toBe(false);
      expect(got.reason).toContain('not in allowlist');
    }
    const block: NetworkEgressPolicy = { mode: 'blocklist', domains: [] };
    expect(checkEgress(block, 'http://[::1]:3000/x').allowed).toBe(true);
  });
});

describe('checkEgress — IP 字面量', () => {
  it('allowlist 模式 IP 默认拒绝,即便该 IP 被写进 domains', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: ['10.0.0.1'] };
    const got = checkEgress(policy, 'http://10.0.0.1/x');
    expect(got.allowed).toBe(false);
    expect(got.reason).toContain('not in allowlist');
  });

  it('blocklist 模式 IP 命中黑名单拒绝、未命中放行', () => {
    const block: NetworkEgressPolicy = { mode: 'blocklist', domains: ['8.8.8.8'] };
    expect(checkEgress(block, 'http://8.8.8.8/dns').allowed).toBe(false);
    expect(checkEgress(block, 'http://9.9.9.9/dns').allowed).toBe(true);
  });

  it('内网段 IP 不因"看起来是内网"而获得额外放行', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: ['api.example.com'] };
    for (const host of ['10.1.2.3', '192.168.0.7', '172.16.5.5']) {
      expect(checkEgress(policy, `http://${host}/x`).allowed).toBe(false);
    }
  });
});

describe('checkEgress — 通配符与 glob', () => {
  it('`*.example.com` 匹配子域(含多级),不匹配裸域', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: ['*.example.com'] };
    expect(checkEgress(policy, 'http://sub.example.com/x').allowed).toBe(true);
    expect(checkEgress(policy, 'http://a.b.example.com/x').allowed).toBe(true);
    const bare = checkEgress(policy, 'http://example.com/x');
    expect(bare.allowed).toBe(false);
    expect(bare.reason).toContain('not in allowlist');
  });

  it('黑名单里的通配符同样放过裸域(两向对称,不被"顺手放宽")', () => {
    const block: NetworkEgressPolicy = { mode: 'blocklist', domains: ['*.evil.com'] };
    expect(checkEgress(block, 'http://x.evil.com/').allowed).toBe(false);
    expect(checkEgress(block, 'http://evil.com/').allowed).toBe(true);
  });

  it('IP 不参与通配符匹配(`*.8.8.8` 拦不住 8.8.8.8)', () => {
    const block: NetworkEgressPolicy = { mode: 'blocklist', domains: ['*.8.8.8'] };
    expect(checkEgress(block, 'http://8.8.8.8/').allowed).toBe(true);
  });

  it('裸域条目匹配自身,且大小写不敏感', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: ['api.example.com'] };
    expect(checkEgress(policy, 'http://API.Example.COM/x').allowed).toBe(true);
  });

  it('glob 的 `?` 占位符按 fnmatch 语义单字符生效', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: ['api.examp?e.com'] };
    expect(checkEgress(policy, 'http://api.example.com/x').allowed).toBe(true);
    expect(checkEgress(policy, 'http://api.exammple.com/x').allowed).toBe(false);
  });

  it('后缀伪装(`api.example.com.attacker.net`)不得命中白名单', () => {
    const policy: NetworkEgressPolicy = { mode: 'allowlist', domains: ['api.example.com'] };
    expect(checkEgress(policy, 'http://api.example.com.attacker.net/x').allowed).toBe(false);
  });
});

describe('installEgressGuard — fetch 腿拦截生命周期', () => {
  let originalFetch: typeof globalThis.fetch;
  let probeCalls: string[];
  let probe: typeof globalThis.fetch;
  let uninstall: (() => void) | null;
  let warn: MockInstance;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    probeCalls = [];
    probe = ((input: string | URL | Request) => {
      probeCalls.push(typeof input === 'string' ? input : String(input));
      return Promise.resolve(new Response('ok'));
    }) as unknown as typeof globalThis.fetch;
    globalThis.fetch = probe;
    uninstall = null;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (uninstall) uninstall();
    globalThis.fetch = originalFetch;
    expect(isEgressGuardInstalled()).toBe(false);
    warn.mockRestore();
  });

  it('open 模式返回 no-op:不改写 fetch、不置已安装标记,调用 undo 也不抛', () => {
    const undo = installEgressGuard({ mode: 'open' });
    expect(globalThis.fetch).toBe(probe);
    expect(isEgressGuardInstalled()).toBe(false);
    expect(() => undo()).not.toThrow();
  });

  it('allowlist:白名单外请求 reject 且底层探针零调用(被拦即无副作用)', async () => {
    uninstall = installEgressGuard(ALLOW);
    expect(isEgressGuardInstalled()).toBe(true);
    await expect(globalThis.fetch('http://evil.example/x')).rejects.toThrow(/\[egress-guard\] 出站被拒绝/);
    expect(probeCalls).toEqual([]);
  });

  it('allowlist:白名单内请求透传,入参原样送达底层', async () => {
    uninstall = installEgressGuard(ALLOW);
    await expect(globalThis.fetch('http://api.example.com/v1')).resolves.toBeInstanceOf(Response);
    expect(probeCalls).toEqual(['http://api.example.com/v1']);
  });

  it('决策与 fetch 腿同源:allowLocalhost:false 时本地地址同样被拒', async () => {
    uninstall = installEgressGuard({ mode: 'allowlist', domains: [], allowLocalhost: false });
    await expect(globalThis.fetch('http://localhost:3000/api')).rejects.toThrow(/localhost blocked by policy/);
    expect(probeCalls).toEqual([]);
  });

  it('URL 对象入参也能归因(不得因非字符串入参而绕过检查)', async () => {
    uninstall = installEgressGuard(ALLOW);
    await expect(globalThis.fetch(new URL('http://evil.example/x'))).rejects.toThrow(/evil\.example/);
    expect(probeCalls).toEqual([]);
  });

  /**
   * 现状钉:uninstall 复位的是 `fetch.bind(globalThis)` 的**克隆**,不是安装前那个函数本体。
   * 后果:每装卸一轮就多一层 bind(身份不复原),但委托链仍通达底层、拦截仍生效。
   * 本用例把"委托不破 + 二次装卸仍能拦"钉住;若有人改成"必须复原本体",
   * 下面 `not.toBe(probe)` 会翻红并逼其表态(方向:多要一次说明,不是静默换语义)。
   */
  it('uninstall 后委托链仍通达底层,二次装卸仍能拦截(fetch 身份不复原)', async () => {
    const undo = installEgressGuard(ALLOW);
    expect(globalThis.fetch).not.toBe(probe);
    undo();
    expect(globalThis.fetch).not.toBe(probe);
    expect(isEgressGuardInstalled()).toBe(false);
    await expect(globalThis.fetch('http://api.example.com/after')).resolves.toBeInstanceOf(Response);
    expect(probeCalls).toEqual(['http://api.example.com/after']);

    const again = installEgressGuard(ALLOW);
    await expect(globalThis.fetch('http://evil.example/')).rejects.toThrow(/出站被拒绝/);
    expect(probeCalls).toHaveLength(1);
    again();
    await expect(globalThis.fetch('http://api.example.com/two')).resolves.toBeInstanceOf(Response);
    expect(probeCalls).toEqual(['http://api.example.com/after', 'http://api.example.com/two']);
  });

  it('卸载只撤自己的针:后装者的 patch 不被洗掉', () => {
    uninstall = installEgressGuard(ALLOW);
    const someoneElse = (() => Promise.resolve(new Response('foreign'))) as unknown as typeof globalThis.fetch;
    globalThis.fetch = someoneElse;
    uninstall();
    expect(globalThis.fetch).toBe(someoneElse);
  });
});

/**
 * ESM 面现状钉:`import * as http from 'http'` 的命名空间属性只读(实测
 * `Cannot assign to read only property 'request'`),所以 installEgressGuard 的四路
 * http/https patch 全部落进各自 try/catch ⇒ 只 console.warn,不生效;
 * 而 `_installed` 仍被置真 ⇒ "已安装"标记与"实际拦截面"分叉。
 *
 * 本组用例把分叉钉成可复跑证据(改动 patch 面或标记语义都会翻红),
 * 不主动断言"应该拦得住"——那属实现侧,已写进交付报告。
 */
describe('installEgressGuard — http/https 腿在 ESM 面静默失效(现状钉)', () => {
  let originalFetch: typeof globalThis.fetch;
  let warn: MockInstance;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response('ok'))) as unknown as typeof globalThis.fetch;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    warn.mockRestore();
  });

  it('四路 http/https patch 失败逐条留痕,且 http.request 本体未被改写', () => {
    const before = http.request;
    const undo = installEgressGuard({ mode: 'allowlist', domains: ['api.example.com'] });
    const msgs = warn.mock.calls.map((c) => String(c[0]));
    for (const needle of [
      'patch http.request failed',
      'patch http.get failed',
      'patch https.request failed',
      'patch https.get failed',
    ]) {
      expect(msgs.some((m) => m.includes(needle))).toBe(true);
    }
    expect(http.request).toBe(before);
    undo();
    expect(isEgressGuardInstalled()).toBe(false);
  });

  it('patch 失败仍把"已安装"置真 —— 标记与实效分叉正是本缺陷的可观测面', () => {
    const undo = installEgressGuard({ mode: 'allowlist', domains: ['api.example.com'] });
    expect(isEgressGuardInstalled()).toBe(true);
    undo();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
