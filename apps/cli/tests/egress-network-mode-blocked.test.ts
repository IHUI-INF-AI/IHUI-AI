// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * R11 独立实现:外部实现 `SandboxNetworkMode.BLOCKED` 离线沙箱短路。
 *
 * Codex 语义 = WFP 栈级 BLOCK:任何规则匹配 / DNS 解析**之前**直接判 unreachable,
 * 连 DNS 都不发。本仓把它落在 `judgeEgressTarget` 顶部(规则表匹配前)。
 * 钉住四点:blocked 短路、缺省=allowlist 零回归、未知取值落更严=blocked、
 * unrestricted 不放 SSRF 名单。
 */

import { describe, it, expect } from 'vitest';

import { judgeEgressTarget } from '../src/sandbox/egress/policy.js';
import { buildEgressEnvExit } from '../src/sandbox/egress/env-inject.js';
import { resolveEgressPolicy } from '../src/sandbox/egress/policy-source.js';
import type { EgressPolicy, EgressRule } from '../src/sandbox/egress/policy.js';

const allowRow = (domain: string): EgressRule => ({
  id: `test:allow:${domain}`,
  domain,
  effect: 'allow',
  enforcement: 'enforce',
  why: 'R11 fixture',
});

function policyOf(networkMode: EgressPolicy['networkMode']): EgressPolicy {
  return {
    rules: [allowRow('cold.example')],
    defaultDecision: 'allow',
    addressProof: false,
    enforcement: 'enforce',
    networkMode,
    source: 'test',
  };
}

describe('Codex SandboxNetworkMode 复现:TS egress BLOCKED 短路', () => {
  it('blocked:在规则表匹配之前短路 —— 即使目标已被 allow 行点名也 deny', () => {
    // cold.example 有显式 allow 行;BLOCKED 模式下它也到不了(DNS 都不发)
    const j = judgeEgressTarget('cold.example', policyOf('blocked'));
    expect(j.decision).toBe('deny');
    expect(j.reason).toBe('sandbox-network-blocked');
    expect(j.ruleId).toBe('builtin:network-mode-blocked');
    expect(j.layer).toBe('network-mode');
  });

  it('blocked:对内网 IP 字面量同样短路(连 isPrivateOrReservedIp 判定都不需要)', () => {
    const j = judgeEgressTarget('169.254.169.254', policyOf('blocked'));
    expect(j.decision).toBe('deny');
    expect(j.reason).toBe('sandbox-network-blocked');
  });

  it('缺省(无 networkMode)= allowlist:不改既有在线裁决行为,allow 行生效', () => {
    const withoutField = { ...policyOf('allowlist') } as Partial<EgressPolicy>;
    delete withoutField.networkMode;
    const j = judgeEgressTarget('cold.example', withoutField as EgressPolicy);
    expect(j.decision).toBe('allow');
    expect(j.reason).toBe('rule-allow');
  });

  it('unrestricted:公网默认档放行,但内置 SSRF 名单仍 deny', () => {
    const pub = judgeEgressTarget('cold.example', policyOf('unrestricted'));
    expect(pub.decision).toBe('allow');
    // unrestricted 不等于 danger-full-access:内置 SSRF 拒绝名单(.local 族)恒在场
    // 用真实内置策略(含 .local/.internal 拒绝行)而非仅 fixture 行来判。
    const { policy } = resolveEgressPolicy({ IHUI_EGRESS_NETWORK_MODE: 'unrestricted' });
    const local = judgeEgressTarget('metadata.local', policy);
    expect(local.decision).toBe('deny');
  });

  it('resolveEgressPolicy:未知取值落更严一侧 = blocked + warning', () => {
    const { policy, warnings } = resolveEgressPolicy({ IHUI_EGRESS_NETWORK_MODE: 'yolo' });
    expect(policy.networkMode).toBe('blocked');
    expect(warnings.some((w) => w.includes('IHUI_EGRESS_NETWORK_MODE'))).toBe(true);
  });

  it('resolveEgressPolicy:缺省 = allowlist(零回归),合法取值原样通过', () => {
    const unset = resolveEgressPolicy({});
    expect(unset.policy.networkMode).toBe('allowlist');
    expect(unset.warnings).toEqual([]);
    const blocked = resolveEgressPolicy({ IHUI_EGRESS_NETWORK_MODE: 'blocked' });
    expect(blocked.policy.networkMode).toBe('blocked');
    const unrestricted = resolveEgressPolicy({ IHUI_EGRESS_NETWORK_MODE: 'unrestricted' });
    expect(unrestricted.policy.networkMode).toBe('unrestricted');
  });

  it('端到端:buildEgressEnvExit 在 blocked 下把出网命令判 deny(零 DNS)', () => {
    const exit = buildEgressEnvExit({
      commandLine: 'curl https://cold.example/x',
      cwd: process.cwd(),
      policy: policyOf('blocked'),
      env: {},
      append: () => null,
    });
    expect(exit.blocked).toBe(true);
    // blockReason 是"egress_denied: <target>"形态;裁决码走 env.IHUI_EGRESS_DECISION
    expect(exit.blockReason ?? '').toContain('egress_denied');
    expect(exit.env.IHUI_EGRESS_DECISION).toBe('deny');
    // BLOCKED 短路发生在 DNS 解析之前:resolver 未注入也不产生 unjudged(would-be)分支
    expect(exit.verdicts.every((v) => v.reason === 'sandbox-network-blocked')).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
