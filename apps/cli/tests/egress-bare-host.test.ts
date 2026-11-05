// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z3 腿③:裸域名取词(scp `user@host:path`、`user@host`、`host:port`、`--targethost foo.internal`)。
 * 闸门 = syntax-table 的 network 效应(import `evaluateArgv`,零复算);裁决仍走唯一一把尺。
 */

import { describe, it, expect } from 'vitest';

import { bareHostOf, extractBareHostTargets } from '../src/sandbox/egress/bare-host.js';
import { adjudicateEgressTargets, extractEgressTargets } from '../src/sandbox/egress/dns-adjudicator.js';
import { EGRESS_ENV, type EgressPolicy, type EgressRule } from '../src/sandbox/egress/policy.js';
import { buildEgressEnvExit } from '../src/sandbox/egress/env-inject.js';

function policyOf(rows: readonly EgressRule[], over: Partial<EgressPolicy> = {}): EgressPolicy {
  return { rules: rows, defaultDecision: 'allow', addressProof: false, enforcement: 'advisory', source: 'test', ...over };
}
const denyRow = (domain: string, enforcement: EgressRule['enforcement'] = 'enforce'): EgressRule =>
  ({ id: `test:deny:${domain}`, domain, effect: 'deny', enforcement, why: 'test rule' });

describe('bare-host 语法 — 正反成对(取不出是 null,不是 allow)', () => {
  it('① 取得出的形态', () => {
    expect(bareHostOf('git@github.com:user/repo.git')).toBe('github.com');
    expect(bareHostOf('user@db.internal')).toBe('db.internal');
    expect(bareHostOf('redis.example.com:6379')).toBe('redis.example.com');
    expect(bareHostOf('Example.COM.')).toBe('example.com');
    expect(bareHostOf('api.internal.example.com/path/to/x')).toBe('api.internal.example.com');
  });

  it('①b 取不出的形态一律 null(不硬造目标)', () => {
    for (const bad of ['C:Users', '10:30', 'v1.2', 'a/b.c', '1.2.3.4', 'https://x.example/p', 'plain', '', 'host:', '999:999']) {
      expect(bareHostOf(bad)).toBeNull();
    }
  });
});

describe('bare-host 闸门 — network 效应才扩面(联动 syntax-table,不凭猜)', () => {
  it('② 网络类命令的裸主机取到;非网络段/未登记命令不取', () => {
    // curl 基线效应 = network(syntax-table:551)
    expect(extractBareHostTargets('curl db.internal/health').map((t) => t.raw)).toEqual(['db.internal']);
    // git clone 有 network 效应;scp 形态取 host 段
    expect(extractBareHostTargets('git clone git@github.com:org/repo.git').map((t) => t.raw)).toEqual(['github.com']);
    // 无网络效应的段:文件名看着像域名也不取
    expect(extractBareHostTargets('node app.local')).toEqual([]);
    expect(extractBareHostTargets('git checkout v1.2')).toEqual([]);
    // 未登记命令(nc)拿不到效应 ⇒ 不扩面(设计边界,写死在头注)
    expect(extractBareHostTargets('nc monitor.internal 22')).toEqual([]);
    // 变量化参数留给既有 dynamic 通道,不在这里造噪声
    expect(extractBareHostTargets('curl "$TARGET.example"')).toEqual([]);
  });

  it('②b 与既有取词通道以 host 会合去重(URL 形态不重复计)', () => {
    const urlTargets = extractEgressTargets('curl https://a.example.com/p').map((t) => t.raw);
    expect(urlTargets).toEqual(['a.example.com']);
    const both = adjudicateEgressTargets('curl https://a.example.com/p a.example.com', { policy: policyOf([denyRow('a.example.com')]) });
    expect(both).toHaveLength(1); // 同一 host 只记一枚
    expect(both[0]).toMatchObject({ decision: 'deny', reason: 'rule-deny' });
  });

  it('②c unjudged 独立成态:dynamic 参数不并进裸域名裁决(§0.3)', () => {
    const rows = adjudicateEgressTargets('curl https://${HOST}/p', { policy: policyOf([denyRow('any.example')]) });
    expect(rows.some((r) => r.reason === 'target-unexpandable' && r.decision === 'unjudged')).toBe(true);
    expect(rows.every((r) => r.decision !== 'allow')).toBe(true);
  });
});

describe('bare-host 消费锁 — 派生点(env-inject)真的在问这条腿', () => {
  it('③ 裸域名命中 enforce 档 deny ⇒ 出口 blocked,命令根本不该被拉起', () => {
    const exit = buildEgressEnvExit({
      commandLine: 'git clone git@blocked.internal:org/repo.git',
      cwd: process.cwd(),
      env: { [EGRESS_ENV.denyDomains]: 'blocked.internal', [EGRESS_ENV.ledger]: 'off' },
      append: () => null,
    });
    expect(exit.blocked).toBe(true);
    expect(exit.blockReason).toContain('blocked.internal');
  });

  it('③b 正向对照:不含裸域名的同形命令不误伤', () => {
    const exit = buildEgressEnvExit({
      commandLine: 'git checkout main',
      cwd: process.cwd(),
      env: { [EGRESS_ENV.denyDomains]: 'blocked.internal', [EGRESS_ENV.ledger]: 'off' },
      append: () => null,
    });
    expect(exit.blocked).toBe(false);
    expect(exit.verdicts).toHaveLength(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
