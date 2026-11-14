// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-075 回归:ENFORCE=1 + ADDRESS_PROOF=1 时,"判不了"(unjudged)必须进 blocked,
 * 不能退化成 warning 放行 —— 否则内网/恶意域名的拒绝可被 DNS 故障稳定绕过。
 * 四类 unjudged 全部经注入 resolver/tokenizer 复现:零真实 DNS、零 spawn。
 */

import { describe, it, expect, vi } from 'vitest';

import type { CommandLineTokenizer, DomainResolver } from '../src/sandbox/egress/dns-adjudicator.js';
import { createDnsSnapshotResolver } from '../src/sandbox/egress/dns-resolver-adapter.js';
import { buildEgressEnvExit, type EgressEnvExitInput } from '../src/sandbox/egress/env-inject.js';
import type { EgressPolicy, EgressRule } from '../src/sandbox/egress/policy.js';

const allowRow = (domain: string): EgressRule => ({
  id: `test:allow:${domain}`,
  domain,
  effect: 'allow',
  enforcement: 'enforce',
  why: 'F-075 fixture',
});

function policyOf(addressProof: boolean): EgressPolicy {
  return {
    rules: [allowRow('cold.example')],
    defaultDecision: 'allow',
    addressProof,
    enforcement: 'enforce',
    source: 'test',
  };
}

function inputOf(addressProof: boolean, resolver: DomainResolver): EgressEnvExitInput {
  return {
    commandLine: 'curl https://cold.example/x',
    cwd: process.cwd(),
    policy: policyOf(addressProof),
    env: {},
    resolver,
    append: () => null,
  };
}

const dynamicTokens: CommandLineTokenizer = () => [{ value: '$API_URL', expanded: true }];

describe('F-075 — ADDRESS_PROOF=1 + ENFORCE=1:unjudged 即 blocked', () => {
  it('① DNS 失败(resolver 返回 null)⇒ unjudged 进 blocked', () => {
    const exit = buildEgressEnvExit(inputOf(true, () => null));
    expect(exit.verdicts).toMatchObject([
      { target: 'cold.example', decision: 'unjudged', reason: 'dns-lookup-failed', enforcement: 'enforce' },
    ]);
    expect(exit.aggregate).toBe('unjudged');
    expect(exit.blocked).toBe(true);
    expect(exit.blockReason).toContain('cold.example');
    expect(exit.warnings.join('\n')).toContain('egress unjudged: cold.example');
  });

  it('② 解析器抛错 ⇒ unjudged 进 blocked', () => {
    const throwing: DomainResolver = () => {
      throw new Error('boom');
    };
    const exit = buildEgressEnvExit(inputOf(true, throwing));
    expect(exit.verdicts).toMatchObject([{ decision: 'unjudged', reason: 'dns-resolver-threw' }]);
    expect(exit.blocked).toBe(true);
  });

  it('③ 冷缓存(快照未预热)⇒ unjudged 进 blocked,预热不改本次裁决', () => {
    const lookup = vi.fn(async () => null);
    const cold = createDnsSnapshotResolver({ lookup, nowMs: () => 0 });
    const exit = buildEgressEnvExit(inputOf(true, cold));
    expect(exit.verdicts).toMatchObject([{ target: 'cold.example', decision: 'unjudged', reason: 'dns-lookup-failed' }]);
    expect(exit.blocked).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(1); // 只发射预热,本次仍按"判不了"结算
  });

  it('④ 变量化主机名(target-unexpandable)⇒ unjudged 进 blocked', () => {
    const exit = buildEgressEnvExit({
      ...inputOf(true, () => ['93.184.216.34']),
      commandLine: 'curl "$API_URL"',
      tokenize: dynamicTokens,
    });
    expect(exit.verdicts).toMatchObject([
      { target: '<dynamic-arg>', decision: 'unjudged', reason: 'target-unexpandable', enforcement: 'enforce' },
    ]);
    expect(exit.blocked).toBe(true);
  });

  it('⑤ ADDRESS_PROOF 未开:保持原有放行 + warning(不误伤)', () => {
    const off = buildEgressEnvExit(inputOf(false, () => null));
    expect(off.aggregate).toBe('allow');
    expect(off.blocked).toBe(false);

    const dynamic = buildEgressEnvExit({
      ...inputOf(false, () => null),
      commandLine: 'curl "$API_URL"',
      tokenize: dynamicTokens,
    });
    expect(dynamic.aggregate).toBe('unjudged');
    expect(dynamic.blocked).toBe(false); // 未要求地址证据时 unjudged 只出声不拦(既有语义)
    expect(dynamic.warnings.join('\n')).toContain('egress unjudged');
  });

  it('⑥ 正证:证据拿得到且为公网地址 ⇒ 照常放行(不误挡)', () => {
    const warm = buildEgressEnvExit(inputOf(true, () => ['93.184.216.34']));
    expect(warm.aggregate).toBe('allow');
    expect(warm.blocked).toBe(false);
  });
});
