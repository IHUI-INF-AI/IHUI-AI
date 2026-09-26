// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批准随命令内容漂移而失效 + 可区分待审态(摘要维度)回归。
 *
 * 三条安全前提逐条对应:
 *  ① 默认档不变(未启用摘要维度 ⇒ 既有链路逐字同旧)  ⇒ 第 A 组
 *  ② 内容变了旧批准即失效,且落"曾批准、内容已变、待再审"单列态 ⇒ 第 B 组
 *  ③ 撤销删记录后必留再授权出口(该命令必然重新被征询、可再授予) ⇒ 第 C 组
 * 摘要比对是唯一判据落点(permission-lease 的 resolveLeaseRelaxationDetail);
 * 变异对照:把 drifted 判定改判恒 false ⇒ B2/B3/B6 必须红(见交付报告)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auditCalls: Array<{ tool: string; input: Record<string, unknown> }> = [];

vi.mock('../src/audit.js', () => ({
  auditLog: (entry: { tool: string; input: Record<string, unknown> }) => {
    auditCalls.push({ tool: entry.tool, input: entry.input });
  },
}));

import {
  activePermissionLease,
  grantPermissionLease,
  PermissionLeaseError,
  resetPermissionLeaseForTests,
  resolveLeaseRelaxation,
  resolveLeaseRelaxationDetail,
  revokePermissionLease,
  slotDigest,
  type PermissionLease,
} from '../src/tools/permission-lease.js';
import { checkPermissionWithLease, checkRulesWithLease } from '../src/tools/permissions.js';

const WS = 'workspace:test-digest';
const MINUTE = 60_000;
const DECL = 'echo approved-content';

/** 带摘要绑定的授予(唯一被钉住的能力是 write_file;run_command 不绑定,走旧语义)。 */
function grantDigestBound(): PermissionLease {
  return grantPermissionLease({
    scope: 'goal:digest-test',
    capabilities: ['write_file', 'run_command'],
    grantor: 'goal-mode',
    ttlMs: 10 * MINUTE,
    maxCalls: 10,
    workspaceId: WS,
    digestDeclarations: { write_file: [DECL] },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  auditCalls.length = 0;
});

afterEach(() => {
  resetPermissionLeaseForTests();
  vi.useRealTimers();
});

describe('A 组:默认档不变(摘要维度未启用)', () => {
  it('A1 未绑定摘要的租约:放宽结论逐字同旧,返回体不得出现 approvalState 新键', () => {
    const lease = grantPermissionLease({
      scope: 'goal:plain',
      capabilities: ['write_file'],
      grantor: 'cli-flag',
      ttlMs: 10 * MINUTE,
      maxCalls: 5,
    });
    const r = checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease);
    expect(r).toMatchObject({ allowed: true, requiresApproval: false, viaLease: true });
    expect(Object.keys(r)).not.toContain('approvalState');
    // 旧消费出口对未绑定租约仍逐字返回租约本体
    expect(resolveLeaseRelaxation(lease, 'write_file', 'write')).toBe(lease);
  });

  it('A2 未绑定槽位:传不传调用内容结论相同(内容只在绑定槽位参与判据)', () => {
    const lease = grantPermissionLease({
      scope: 'goal:plain2',
      capabilities: ['write_file'],
      grantor: 'cli-flag',
      ttlMs: 10 * MINUTE,
      maxCalls: 5,
    });
    const withContent = checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease, '任何内容');
    const without = checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease);
    expect(withContent).toEqual(without);
    expect(withContent.requiresApproval).toBe(false);
  });

  it('A3 无租约路径返回体形状与改造前逐字相同(keys 仅 allowed)', () => {
    expect(Object.keys(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', null))).toEqual([
      'allowed',
    ]);
  });
});

describe('B 组:摘要漂移失效与可区分待审态', () => {
  it('B1 内容与授予声明一致 ⇒ 照常放宽(viaLease)', () => {
    const lease = grantDigestBound();
    const r = checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease, DECL);
    expect(r).toMatchObject({ allowed: true, requiresApproval: false, viaLease: true });
    expect(auditCalls.some((c) => c.tool === 'permission_lease_content_drift')).toBe(false);
  });

  it('B2 同一规则下参数被改动 ⇒ 不再沿用旧批准,且落 content-drifted 单列态(不压回从未批准)', () => {
    const lease = grantDigestBound();
    const r = checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease, 'echo MUTATED-payload');
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(true);
    expect(r.viaLease).toBe(false);
    expect(r.approvalState).toBe('content-drifted');
    expect(r.reason).toBeTruthy();
  });

  it('B3 绑定槽位但调用内容缺席(旧 5 参入口)⇒ fail-closed 不放宽;旧出口同结论', () => {
    const lease = grantDigestBound();
    expect(checkPermissionWithLease('write_file', { ask: ['write_file'] }, 'default', 'write', lease)).toBe('ask');
    expect(resolveLeaseRelaxation(lease, 'write_file', 'write')).toBe(null);
    expect(resolveLeaseRelaxationDetail(lease, 'write_file', 'write', null)?.contentDrifted).toBe(true);
  });

  it('B4 摘要治理按槽位:同一租约里未绑定的能力仍按工具名放宽', () => {
    const lease = grantDigestBound();
    const r = checkRulesWithLease('run_command', { ask: ['run_command'] }, 'write', lease, 'rm -rf /tmp/whatever');
    expect(r).toMatchObject({ requiresApproval: false, viaLease: true });
  });

  it('B5 dangerous 一律不因租约放宽 —— 即使内容与声明逐字相同(既有护栏不回退)', () => {
    const lease = grantDigestBound();
    expect(
      checkRulesWithLease('write_file', { ask: ['write_file'] }, 'dangerous', lease, DECL).requiresApproval,
    ).toBe(true);
    expect(resolveLeaseRelaxationDetail(lease, 'write_file', 'dangerous', DECL)).toBe(null);
  });

  it('B6 漂移事件在既有审计出口可回读(不另立第二份真相)', () => {
    const lease = grantDigestBound();
    checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease, 'echo tampered');
    const drift = auditCalls.find((c) => c.tool === 'permission_lease_content_drift');
    expect(drift).toBeDefined();
    expect(drift?.input?.capability).toBe('write_file');
    expect(drift?.input?.scope).toBe('goal:digest-test');
  });

  it('B7 slotDigest 是最普通稳定哈希(sha256 hex 64 位),工作区身份参与摘要', () => {
    expect(slotDigest(WS, DECL)).toMatch(/^[0-9a-f]{64}$/);
    expect(slotDigest(WS, DECL)).toBe(slotDigest(WS, DECL));
    expect(slotDigest('other/workspace', DECL)).not.toBe(slotDigest(WS, DECL));
    expect(slotDigest(WS, DECL + 'x')).not.toBe(slotDigest(WS, DECL));
  });

  it('B8 授予期判死:绑定清单外能力 / 空声明 / 缺工作区身份 ⇒ PermissionLeaseError', () => {
    const base = {
      scope: 'goal:bad',
      capabilities: ['write_file'],
      grantor: 'cli-flag' as const,
      ttlMs: 10 * MINUTE,
      maxCalls: 1,
    };
    expect(() =>
      grantPermissionLease({ ...base, workspaceId: WS, digestDeclarations: { nope: ['x'] } }),
    ).toThrow(PermissionLeaseError);
    expect(() =>
      grantPermissionLease({ ...base, workspaceId: WS, digestDeclarations: { write_file: [] } }),
    ).toThrow(PermissionLeaseError);
    expect(() => grantPermissionLease({ ...base, digestDeclarations: { write_file: ['x'] } })).toThrow(
      PermissionLeaseError,
    );
    expect(activePermissionLease()).toBe(null);
  });
});

describe('C 组:撤销后必留再授权出口(回归钉住,非新增运行时功能)', () => {
  it('C1 撤销 ⇒ 旧租约对象不再放宽且区别于漂移态;同 scope 可再授予,新租约照常生效', () => {
    const lease = grantDigestBound();
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease, DECL).requiresApproval).toBe(
      false,
    );
    expect(revokePermissionLease('manual-revoke')).toBe(true);
    expect(activePermissionLease()).toBe(null);
    // 撤销后的旧对象:回到常规征询(requiresApproval),但**不是** content-drifted —— 两种态可区分
    const after = checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease, DECL);
    expect(after.requiresApproval).toBe(true);
    expect(after.approvalState).toBeUndefined();
    // 再授权出口开着:同 scope 可重新授予并生效(内容仍按摘要受治)
    const again = grantDigestBound();
    expect(again.auditRef).not.toBe(lease.auditRef);
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', again, 'echo brand-new-content').requiresApproval).toBe(
      true,
    );
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', again, DECL).requiresApproval).toBe(
      false,
    );
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
