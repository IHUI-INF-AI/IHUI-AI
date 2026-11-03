// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权限租约(Permission Lease)回归。
 *
 * 与五条安全前提逐条对应:
 *  ① 默认档逐字不变(最重要)      ⇒ 第 1 组
 *  ② 到期后自动失效                ⇒ 第 2 组
 *  ③ 撤销立即失效                  ⇒ 第 3 组
 *  ④ 租约内免批 / 租约外仍需批      ⇒ 第 4 组
 *  ⑤ 高危操作不因租约放行(反向锁)  ⇒ 第 5 组
 *  ⑥ 审计痕迹可回读                ⇒ 第 6 组(vi.mock 截获 `auditLog`,不落家目录)
 * 两条变异对照:A 摘掉到期判定 ⇒ 第 2 组红;B 让租约覆盖高危 ⇒ 第 5 组红。
 * 时钟由 vi.useFakeTimers 钉住 —— 判据本体只有一份,测试不复制实现。
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
  advancePermissionLeaseTurn,
  grantPermissionLease,
  isPermissionLeaseLive,
  PermissionLeaseError,
  resetPermissionLeaseForTests,
  revokePermissionLease,
} from '../src/tools/permission-lease.js';
import { checkPermission, checkPermissionWithLease, checkRulesWithLease } from '../src/tools/permissions.js';

const MINUTE = 60_000;
const T0 = Date.parse('2026-09-26T12:00:00.000Z');

type GrantInput = Parameters<typeof grantPermissionLease>[0];

function grant(overrides: Partial<GrantInput> = {}) {
  return grantPermissionLease({
    scope: 'goal:O32-lease-demo',
    capabilities: ['write_file', 'edit_file'],
    grantor: 'cli-flag',
    ttlMs: 30 * MINUTE,
    expiresAfterTurns: 5,
    ...overrides,
  });
}

beforeEach(() => {
  auditCalls.length = 0;
  resetPermissionLeaseForTests();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('① 默认档逐字不变(未授予租约时判据完全等同改造前)', () => {
  it('activePermissionLease() 未授予时为 null', () => {
    expect(activePermissionLease()).toBeNull();
  });

  it('无租约时 checkPermission 2 参重载的四种结果一字不变', () => {
    expect(checkPermission('write_file', { allow: ['read_file'] })).toEqual({
      allowed: false,
      reason: '工具 write_file 不在 --tools 白名单中',
    });
    expect(checkPermission('write_file', { deny: ['write_file'] })).toEqual({
      allowed: false,
      reason: '工具 write_file 在 --disallowed-tools 黑名单中',
    });
    expect(checkPermission('write_file', { ask: ['write_file'] })).toEqual({ allowed: true });
    expect(checkPermission('write_file', undefined)).toEqual({ allowed: true });
  });

  it('无租约时带租约入口与不带租约入口给出同一结论、同一返回体(单一判据实现)', () => {
    for (const mode of ['default', 'acceptEdits', 'plan', 'manual', 'bypassPermissions'] as const) {
      expect(checkPermissionWithLease('write_file', { ask: ['write_file'] }, mode, 'write', null)).toBe(
        checkPermission('write_file', { ask: ['write_file'] }, mode, 'write'),
      );
    }
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', null)).toEqual(
      checkPermission('write_file', { ask: ['write_file'] }),
    );
    // 无租约时不得凭空多出字段(旧消费点只读 allowed)
    expect(Object.keys(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', null))).toEqual([
      'allowed',
    ]);
  });

  it('无租约时不产生任何租约审计行', () => {
    checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', null);
    expect(auditCalls.filter((c) => c.tool.startsWith('permission_lease'))).toHaveLength(0);
  });
});

describe('② 到期后自动失效(时长 / 轮次 / 次数三者取先到)', () => {
  it('缺到期字段一律判死 —— 无期限的放宽无法被构造出来', () => {
    expect(() => grant({ ttlMs: undefined })).toThrowError(PermissionLeaseError);
    expect(() => grant({ expiresAfterTurns: undefined, maxCalls: undefined })).toThrowError(
      /轮次或调用数上限/,
    );
    expect(() => grant({ ttlMs: 0 })).toThrowError(/晚于授予时刻/);
    expect(() => grant({ ttlMs: -MINUTE })).toThrowError(/晚于授予时刻/);
  });

  it('时间到期 ⇒ 放宽停止(变异对照 A:摘掉到期判定这条必红)', () => {
    const lease = grant({ ttlMs: MINUTE });
    expect(isPermissionLeaseLive(lease)).toBe(true);
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease)).toMatchObject({
      allowed: true,
      viaLease: true,
      requiresApproval: false,
    });
    vi.advanceTimersByTime(MINUTE + 1);
    expect(isPermissionLeaseLive(lease)).toBe(false);
    expect(
      checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease).requiresApproval,
    ).toBe(true);
  });

  it('轮次到期(比时长先到)⇒ 放宽停止', () => {
    const lease = grant({ ttlMs: 10 * MINUTE, expiresAfterTurns: 2 });
    expect(advancePermissionLeaseTurn('iteration-1')).toBe(true);
    expect(advancePermissionLeaseTurn('iteration-2')).toBe(false);
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease).requiresApproval).toBe(
      true,
    );
    expect(activePermissionLease()).toBeNull();
  });

  it('调用数上限 ⇒ 用满即失效(时长还没到也算到期)', () => {
    const lease = grant({ ttlMs: 10 * MINUTE, expiresAfterTurns: undefined, maxCalls: 1 });
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease).viaLease).toBe(true);
    expect(
      checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease).requiresApproval,
    ).toBe(true);
  });
});

describe('③ 撤销立即失效', () => {
  it('revoke 之后同一时刻的判定即回到"仍需批准"', () => {
    const lease = grant();
    expect(lease.revokedAt).toBeNull();
    expect(revokePermissionLease('user typed /lease revoke')).toBe(true);
    expect(lease.revokedAt).not.toBeNull();
    expect(activePermissionLease()).toBeNull();
    expect(checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease).requiresApproval).toBe(
      true,
    );
    expect(isPermissionLeaseLive(lease)).toBe(false);
  });

  it('重复撤销 / 无租约撤销 ⇒ 返回 false 且不抛错(可安全重放)', () => {
    expect(revokePermissionLease('nothing to revoke')).toBe(false);
    grant();
    expect(revokePermissionLease('第一次')).toBe(true);
    expect(revokePermissionLease('第二次')).toBe(false);
  });
});

describe('④ 租约内免批、租约外仍需批', () => {
  it('能力清单内 ⇒ ask 被放宽;清单外工具 ⇒ 仍需逐次批准', () => {
    const lease = grant();
    expect(
      checkRulesWithLease('write_file', { ask: ['write_file', 'edit_file'] }, 'write', lease).viaLease,
    ).toBe(true);
    expect(
      checkRulesWithLease('delete_file', { ask: ['delete_file'] }, 'write', lease).requiresApproval,
    ).toBe(true);
  });

  it('mode 判定出的 ask 同样可放宽(default 档 + write)', () => {
    const lease = grant();
    expect(checkPermissionWithLease('write_file', undefined, 'default', 'write', lease)).toBe('allow');
    expect(checkPermissionWithLease('delete_file', undefined, 'default', 'write', lease)).toBe('ask');
  });

  it('deny 永远赢过租约 —— 放宽"要不要批准",不放宽"能不能做"', () => {
    const lease = grant();
    expect(checkRulesWithLease('write_file', { deny: ['write_file'] }, 'write', lease).allowed).toBe(false);
    expect(checkPermissionWithLease('write_file', { allow: ['read_file'] }, 'default', 'write', lease)).toBe(
      'deny',
    );
  });

  it('禁止通配 / 空清单 / 空作用域 / 叠加授予', () => {
    const lease = grant();
    expect(lease.auditRef).toMatch(/^lease-/);
    expect(() => grant({ capabilities: ['*'] })).toThrowError(/禁止通配/);
    expect(() => grant({ capabilities: ['ALL'] })).toThrowError(/禁止通配/);
    expect(() => grant({ capabilities: [] })).toThrowError(/不得为空/);
    expect(() => grant({ scope: '   ' })).toThrowError(/scope 不得为空/);
    expect(() => grant({ scope: 'goal:第二个目标' })).toThrowError(/生效中/);
  });
});

describe('⑤ 反向锁:高危操作不因租约放行', () => {
  it('dangerLevel=dangerous 一律不放宽,与能力清单是否包含它无关(变异对照 B)', () => {
    const lease = grant({ capabilities: ['run_command', 'write_file'] });
    expect(
      checkRulesWithLease('run_command', { ask: ['run_command'] }, 'dangerous', lease).requiresApproval,
    ).toBe(true);
    expect(checkPermissionWithLease('run_command', undefined, 'default', 'dangerous', lease)).toBe('ask');
    expect(checkPermissionWithLease('run_command', undefined, 'manual', 'dangerous', lease)).toBe('ask');
    expect(checkPermissionWithLease('run_command', undefined, 'acceptEdits', 'dangerous', lease)).toBe('ask');
  });

  it('plan 档(只读)不因租约变成可写 ⇒ 租约不跨越 mode 的 deny', () => {
    const lease = grant();
    expect(checkPermissionWithLease('write_file', undefined, 'plan', 'write', lease)).toBe('deny');
  });
});

describe('⑥ 审计痕迹可回读(落在既有出口 auditLog)', () => {
  it('授予 / 使用 / 轮次 / 撤销 四类记录都带同一 auditRef 与到期时刻', () => {
    const lease = grant();
    checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease);
    advancePermissionLeaseTurn('iteration-1');
    revokePermissionLease('目标结束');
    expect(auditCalls.map((c) => c.tool)).toEqual([
      'permission_lease_granted',
      'permission_lease_used',
      'permission_lease_turn',
      'permission_lease_revoked',
    ]);
    for (const c of auditCalls) expect(c.input.auditRef).toBe(lease.auditRef);
    expect(auditCalls[0].input).toMatchObject({
      scope: 'goal:O32-lease-demo',
      grantor: 'cli-flag',
      capabilities: ['write_file', 'edit_file'],
    });
    expect(Date.parse(String(auditCalls[0].input.expiresAt))).toBeGreaterThan(T0);
  });

  it('一次放宽记一条使用痕迹(实际用到哪一步可回读),未放宽不记', () => {
    const lease = grant();
    checkRulesWithLease('write_file', { ask: ['write_file'] }, 'write', lease);
    checkRulesWithLease('delete_file', { ask: ['delete_file'] }, 'write', lease);
    const used = auditCalls.filter((c) => c.tool === 'permission_lease_used');
    expect(used).toHaveLength(1);
    expect(used[0].input).toMatchObject({ capability: 'write_file', callsUsed: 1 });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
