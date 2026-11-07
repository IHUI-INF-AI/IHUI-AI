// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z3 腿②:真 DNS 解析适配器(node:dns/promises 异步预热 + TTL 同步快照)。
 * 离线纪律:整个文件 `vi.mock('node:dns/promises')` —— 单例真接的是 mock,零真联网。
 * 冷/失败 ⇒ null ⇒ unjudged 独立成态(§0.3),绝不折成 allow/deny。
 */

import { describe, it, expect, vi } from 'vitest';

const dnsMock = vi.hoisted(() => ({
  v4: null as readonly string[] | null,
  v6: null as readonly string[] | null,
  calls: 0,
}));
vi.mock('node:dns/promises', () => ({
  resolve4: async () => {
    dnsMock.calls += 1;
    if (dnsMock.v4 === null) throw new Error('ENOTFOUND');
    return [...dnsMock.v4];
  },
  resolve6: async () => {
    if (dnsMock.v6 === null) throw new Error('ENOTFOUND');
    return [...dnsMock.v6];
  },
}));

import { EGRESS_ENV, type EgressPolicy, type EgressRule } from '../src/sandbox/egress/policy.js';
import { adjudicateDomain } from '../src/sandbox/egress/dns-adjudicator.js';
import {
  createDnsSnapshotResolver,
  getEgressDnsSnapshotResolver,
  resetEgressDnsSnapshotResolverForTests,
  ttlMsFromEnv,
  DEFAULT_DNS_TTL_MS,
} from '../src/sandbox/egress/dns-resolver-adapter.js';
import { buildEgressEnvExit } from '../src/sandbox/egress/env-inject.js';

function policyOf(rows: readonly EgressRule[], over: Partial<EgressPolicy> = {}): EgressPolicy {
  return { rules: rows, defaultDecision: 'allow', addressProof: false, enforcement: 'advisory', source: 'test', ...over };
}
const flush = () => new Promise((r) => setTimeout(r, 10));

function deferred() {
  let resolve!: (addresses: readonly string[] | null) => void;
  const promise = new Promise<readonly string[] | null>((r) => (resolve = r));
  return { promise, resolve, lookups: [] as string[] };
}

describe('dns 快照适配器 — 冷/热/过期/失败四态', () => {
  it('① 冷命中 null 并异步补票;热命中给地址;过期回到冷', async () => {
    const d = deferred();
    let clock = 1_000;
    let fired = 0;
    const resolver = createDnsSnapshotResolver({
      lookup: (host) => {
        fired += 1;
        d.lookups.push(host);
        return d.promise;
      },
      ttlMs: 6_000, // clampTtl 下限 5s,夹具只能贴着下限走
      nowMs: () => clock,
    });
    expect(resolver('api.example')).toBeNull(); // 冷:null ⇒ 裁决层 unjudged,不是 allow
    expect(resolver('api.example')).toBeNull(); // pending 去重:同一 host 只问一次
    expect(fired).toBe(1);
    d.resolve(['93.184.216.34']);
    await flush();
    expect(resolver('api.example')).toEqual(['93.184.216.34']); // 热:快照同步可读
    expect(fired).toBe(1);
    clock += 6_001;
    expect(resolver('api.example')).toBeNull(); // 过期:回到冷并再问一次
    expect(fired).toBe(2);
  });

  it('② 解析失败缓存短条目:null 出口一致,不冒充"没有内网地址"', async () => {
    const clock = 0;
    let fired = 0;
    const resolver = createDnsSnapshotResolver({
      lookup: () => {
        fired += 1;
        return Promise.resolve(null);
      },
      ttlMs: 60_000,
      nowMs: () => clock,
    });
    expect(resolver('bad.example')).toBeNull();
    await flush();
    expect(resolver('bad.example')).toBeNull(); // 失败条目仍是 null,但没有重打
    expect(fired).toBe(1);
    expect(resolver.stats().coldMisses).toBe(1);
  });

  it('③ 接上唯一一把尺:内网地址 deny / 公网 allow,地址不落任何留痕', async () => {
    const policy = policyOf([{ id: 't:other', domain: 'other.example', effect: 'allow', enforcement: 'advisory', why: 'keep table non-empty (空表=policy-unavailable)' }], { addressProof: true });
    const internal = createDnsSnapshotResolver({ lookup: async () => ['10.0.0.8'], ttlMs: 60_000 });
    adjudicateDomain('intranet.example', { policy, resolver: internal });
    await flush();
    const j = adjudicateDomain('intranet.example', { policy, resolver: internal });
    expect(j).toMatchObject({ decision: 'deny', layer: 'dns', reason: 'resolved-internal-range' });
    const pub = createDnsSnapshotResolver({ lookup: async () => ['93.184.216.34'], ttlMs: 60_000 });
    adjudicateDomain('public.example', { policy, resolver: pub });
    await flush();
    const allowed = adjudicateDomain('public.example', { policy, resolver: pub });
    expect(allowed).toMatchObject({ decision: 'allow', reason: 'resolved-public' });
    expect(JSON.stringify(allowed)).not.toContain('93.184'); // 地址证据不进 judgement
  });

  it('④ TTL 取值认不出 ⇒ 默认档(不落更宽)', () => {
    expect(ttlMsFromEnv({ [EGRESS_ENV.dnsTtl]: 'abc' })).toBe(DEFAULT_DNS_TTL_MS);
    expect(ttlMsFromEnv({ [EGRESS_ENV.dnsTtl]: '-5' })).toBe(DEFAULT_DNS_TTL_MS);
    expect(ttlMsFromEnv({ [EGRESS_ENV.dnsTtl]: '60' })).toBe(60_000);
  });
});

describe('env-inject 默认接线锁 — addressProof 开且未注入 resolver 时真的用适配器(§0.9)', () => {
  it('⑤ 首轮冷 ⇒ unjudged 独立态 + 预热出声;次轮热判 allow(mock 计数不增即没重问)', async () => {
    resetEgressDnsSnapshotResolverForTests();
    dnsMock.calls = 0;
    dnsMock.v4 = ['93.184.216.34'];
    dnsMock.v6 = null;
    const input = {
      commandLine: 'curl https://proof.example/x',
      cwd: process.cwd(),
      env: { [EGRESS_ENV.dnsTtl]: '3600', [EGRESS_ENV.ledger]: 'off' },
      policy: policyOf([{ id: 't:other', domain: 'other.example', effect: 'allow', enforcement: 'advisory', why: 'keep table non-empty' }], { addressProof: true }),
      append: () => null,
    };
    const first = buildEgressEnvExit(input);
    expect(first.verdicts[0]).toMatchObject({ decision: 'unjudged', layer: 'dns' }); // 不折成 allow/deny(§0.3)
    expect(first.warnings.join('\n')).toContain('DNS snapshot cold');
    await flush();
    const second = buildEgressEnvExit(input);
    expect(second.verdicts[0]).toMatchObject({ decision: 'allow', reason: 'resolved-public' });
    expect(dnsMock.calls).toBe(1); // TTL 内没有第二次真解析
    // 关掉 addressProof ⇒ 默认适配器完全不接(零网络动作)
    resetEgressDnsSnapshotResolverForTests();
    const off = buildEgressEnvExit({ ...input, policy: policyOf([{ id: 't:other', domain: 'other.example', effect: 'allow', enforcement: 'advisory', why: 'keep table non-empty' }], { addressProof: false }) });
    expect(off.verdicts[0]).toMatchObject({ decision: 'allow', reason: 'default-allow' });
    expect(getEgressDnsSnapshotResolver()).toBeTruthy(); // 单例出口存在(供 relay/派生面共用)
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
