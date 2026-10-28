// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `--permission-lease` 授予路径回归(操作员显式启用权限租约)。
 *
 * 这一票要钉死的不是租约机制本身(那是 `permission-lease.test.ts` 的 6 组),
 * 而是**可达性**:机制建好了却零生产调用点,即本仓的「造好没装车」。
 * 所以四条硬要求各对应一组用例:
 *  ① 未给 flag ⇒ 恒无租约,判定实现与改前逐字等价(第 1 组)
 *  ② 给了 flag ⇒ 租约在位、capabilities 与入参一致、grantor==='cli-flag'(第 2 组)
 *  ③ 到期/轮次用尽 ⇒ 不再放宽(第 3 组)
 *  ④ 结构锁:源码面必须真有非测试调用点(第 6 组)—— 本票交付后被摘线即红
 * 另加封顶与失败关闭两组(第 4/5 组):ttl/轮次都有硬上限,通配与空清单不得静默降级。
 *
 * `auditLog` 由 vi.mock 截获 ⇒ 既断言"授予与撤销各一条审计",又不往 ~/.ihui 落盘。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  isPermissionLeaseLive,
  resetPermissionLeaseForTests,
  resolveLeaseRelaxation,
} from '../src/tools/permission-lease.js';
import {
  grantLeaseFromFlag,
  parseLeaseTools,
  PERMISSION_LEASE_DEFAULT_TTL_MINUTES,
  PERMISSION_LEASE_DEFAULT_TURNS,
  PERMISSION_LEASE_MAX_TOOLS,
  PERMISSION_LEASE_MAX_TTL_MINUTES,
  PERMISSION_LEASE_MAX_TURNS,
  PERMISSION_LEASE_MIN_TTL_MINUTES,
  PERMISSION_LEASE_MIN_TURNS,
  releaseLeaseAfterRun,
  resolveLeaseTtlMinutes,
  resolveLeaseTurns,
} from '../src/utils/permission-lease-flag.js';

const MINUTE = 60_000;
/** 时钟钉住:到期判据不得依赖测试跑在哪一刻。 */
const T0 = Date.UTC(2026, 8, 26, 12, 0, 0);

beforeEach(() => {
  auditCalls.length = 0;
  resetPermissionLeaseForTests();
});

afterEach(() => {
  resetPermissionLeaseForTests();
});

describe('① 默认档:未给 flag 恒为无租约(判定实现逐字不变)', () => {
  it('flag 缺省/空串 ⇒ kind=none,构造器一次都不被触及', () => {
    for (const raw of [undefined, null, '', '   ']) {
      const outcome = grantLeaseFromFlag({ toolsRaw: raw, target: 'sess-x', nowMs: T0 });
      expect(outcome.kind).toBe('none');
    }
    expect(activePermissionLease()).toBeNull();
    expect(auditCalls.filter((c) => c.tool === 'permission_lease_granted')).toHaveLength(0);
  });

  it('无租约时消费出口返回 null(与改造前同一结论)', () => {
    expect(activePermissionLease()).toBeNull();
    expect(resolveLeaseRelaxation(activePermissionLease(), 'write_file', 'write', T0)).toBeNull();
    expect(isPermissionLeaseLive).toBeTypeOf('function');
  });

  it('index.ts 只在 kind==="granted" 时才撤销 ⇒ 未给 flag 时收尾路径也不触碰租约状态', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
    expect(src).toContain('grantLeaseFromFlag(');
    expect(src).toContain('releaseLeaseAfterRun(');
    // 撤销必须被 grant 结果门住(无条件撤销会把别人的租约也撤掉)
    expect(src).toMatch(/if \(leaseOutcome\.kind === 'granted'\) \{\s*\n\s*releaseLeaseAfterRun\(/);
  });
});

describe('② 给 flag ⇒ 租约在位且字段与入参一致', () => {
  it('清单去空白/去重后逐字等于 capabilities,grantor 恒为 cli-flag', () => {
    const outcome = grantLeaseFromFlag({
      toolsRaw: ' write_file , git_commit ,write_file',
      target: 'sess-1',
      nowMs: T0,
    });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(outcome.lease.capabilities).toEqual(['write_file', 'git_commit']);
    expect(outcome.lease.grantor).toBe('cli-flag');
    expect(outcome.lease.scope).toBe('cli-agent:sess-1');
    expect(outcome.ttlMinutes).toBe(PERMISSION_LEASE_DEFAULT_TTL_MINUTES);
    expect(outcome.turns).toBe(PERMISSION_LEASE_DEFAULT_TURNS);
    expect(outcome.lease.expiresAfterTurns).toBe(PERMISSION_LEASE_DEFAULT_TURNS);
    expect(Date.parse(outcome.lease.expiresAt) - T0).toBe(PERMISSION_LEASE_DEFAULT_TTL_MINUTES * MINUTE);
    // 未启用摘要维度 ⇒ 默认档不存在 slotDigests(不得凭空造出第二个真相)
    expect(outcome.lease.slotDigests).toBeUndefined();
    expect(activePermissionLease()).toBe(outcome.lease);
  });

  it('授予与撤销各落一条审计,且都带同一条 auditRef', () => {
    const outcome = grantLeaseFromFlag({ toolsRaw: 'write_file', target: 'sess-2', nowMs: T0 });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(releaseLeaseAfterRun('测试收尾')).toBe(true);
    const granted = auditCalls.find((c) => c.tool === 'permission_lease_granted');
    const revoked = auditCalls.find((c) => c.tool === 'permission_lease_revoked');
    expect(granted?.input.auditRef).toBe(outcome.lease.auditRef);
    expect(revoked?.input.auditRef).toBe(outcome.lease.auditRef);
    expect(granted?.input.grantor).toBe('cli-flag');
    expect(activePermissionLease()).toBeNull();
    // 撤销可安全重放(不抛)
    expect(releaseLeaseAfterRun('再来一次')).toBe(false);
  });

  it('target 为空时用 pid 兜底,scope 绝不留空(构造器判死空 scope)', () => {
    const outcome = grantLeaseFromFlag({ toolsRaw: 'grep', target: '  ', nowMs: T0 });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(outcome.lease.scope).toBe(`cli-agent:pid-${process.pid}`);
  });
});

describe('③ 到期 / 轮次用尽 ⇒ 不再放宽', () => {
  it('时长到期:先活后死,消费出口转 null', () => {
    const outcome = grantLeaseFromFlag({ toolsRaw: 'write_file', ttlRaw: '5', target: 's', nowMs: T0 });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(isPermissionLeaseLive(outcome.lease, T0 + 4 * MINUTE)).toBe(true);
    expect(resolveLeaseRelaxation(outcome.lease, 'write_file', 'write', T0 + 4 * MINUTE)).toBe(outcome.lease);
    expect(isPermissionLeaseLive(outcome.lease, T0 + 6 * MINUTE)).toBe(false);
    expect(resolveLeaseRelaxation(outcome.lease, 'write_file', 'write', T0 + 6 * MINUTE)).toBeNull();
  });

  it('轮次默认 1:推进一轮即失效,且当前租约被清空', () => {
    const outcome = grantLeaseFromFlag({ toolsRaw: 'write_file', target: 's', nowMs: T0 });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(advancePermissionLeaseTurn('第 1 轮结束', T0 + MINUTE)).toBe(false);
    expect(activePermissionLease()).toBeNull();
    expect(resolveLeaseRelaxation(outcome.lease, 'write_file', 'write', T0 + MINUTE)).toBeNull();
  });

  it('--permission-lease-turns 3:放宽持续到第 3 轮', () => {
    const outcome = grantLeaseFromFlag({ toolsRaw: 'write_file', turnsRaw: '3', ttlRaw: '60', target: 's', nowMs: T0 });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(advancePermissionLeaseTurn('r1', T0 + MINUTE)).toBe(true);
    expect(advancePermissionLeaseTurn('r2', T0 + 2 * MINUTE)).toBe(true);
    expect(advancePermissionLeaseTurn('r3', T0 + 3 * MINUTE)).toBe(false);
    expect(activePermissionLease()).toBeNull();
  });
});

describe('④ 时长与轮次都有硬封顶', () => {
  it('超界往回收,非法值回落默认(解析出口内含 Math.min/Math.max)', () => {
    expect(resolveLeaseTtlMinutes('99999')).toBe(PERMISSION_LEASE_MAX_TTL_MINUTES);
    expect(resolveLeaseTtlMinutes('0')).toBe(PERMISSION_LEASE_MIN_TTL_MINUTES);
    expect(resolveLeaseTtlMinutes('abc')).toBe(PERMISSION_LEASE_DEFAULT_TTL_MINUTES);
    expect(resolveLeaseTtlMinutes(undefined)).toBe(PERMISSION_LEASE_DEFAULT_TTL_MINUTES);
    expect(resolveLeaseTurns('99999')).toBe(PERMISSION_LEASE_MAX_TURNS);
    expect(resolveLeaseTurns('-4')).toBe(PERMISSION_LEASE_MIN_TURNS);
    expect(resolveLeaseTurns('')).toBe(PERMISSION_LEASE_DEFAULT_TURNS);
  });

  it('授予结果里回传的是封顶后的生效值(命令层据此打印,不得把 99999 说成 10)', () => {
    const outcome = grantLeaseFromFlag({
      toolsRaw: 'write_file',
      ttlRaw: '99999',
      turnsRaw: '99999',
      target: 's',
      nowMs: T0,
    });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(outcome.ttlMinutes).toBe(PERMISSION_LEASE_MAX_TTL_MINUTES);
    expect(outcome.turns).toBe(PERMISSION_LEASE_MAX_TURNS);
    expect(Date.parse(outcome.lease.expiresAt) - T0).toBe(PERMISSION_LEASE_MAX_TTL_MINUTES * MINUTE);
  });
});

describe('⑤ 失败关闭:构造器判死的形态不得被静默降级', () => {
  it('通配 * ⇒ invalid,且不留下任何租约', () => {
    const outcome = grantLeaseFromFlag({ toolsRaw: '*', target: 's', nowMs: T0 });
    expect(outcome.kind).toBe('invalid');
    expect(activePermissionLease()).toBeNull();
    expect(auditCalls.filter((c) => c.tool === 'permission_lease_granted')).toHaveLength(0);
  });

  it('flag 给了但清单为空 ⇒ invalid(不是"当没给")', () => {
    const outcome = grantLeaseFromFlag({ toolsRaw: ' , ', target: 's', nowMs: T0 });
    expect(outcome.kind).toBe('invalid');
    expect(activePermissionLease()).toBeNull();
  });

  it('超过工具数上限 ⇒ invalid 并点名实收数量', () => {
    const many = Array.from({ length: PERMISSION_LEASE_MAX_TOOLS + 1 }, (_, i) => `tool_${i}`).join(',');
    const outcome = grantLeaseFromFlag({ toolsRaw: many, target: 's', nowMs: T0 });
    expect(outcome.kind).toBe('invalid');
    if (outcome.kind !== 'invalid') return;
    expect(outcome.reason).toContain(String(PERMISSION_LEASE_MAX_TOOLS));
  });

  it('叠租约(已有一份在生效)⇒ invalid:放宽作用域不得被悄悄扩大', () => {
    expect(grantLeaseFromFlag({ toolsRaw: 'write_file', target: 'a', nowMs: T0 }).kind).toBe('granted');
    const second = grantLeaseFromFlag({ toolsRaw: 'grep', target: 'b', nowMs: T0 + 1000 });
    expect(second.kind).toBe('invalid');
    expect(activePermissionLease()?.scope).toBe('cli-agent:a');
  });

  it('parseLeaseTools 只做形状处理,通配留给构造器判死(不重复实现一份黑名单)', () => {
    expect(parseLeaseTools('a,b ,a').tools).toEqual(['a', 'b']);
    expect(parseLeaseTools(undefined).tools).toEqual([]);
    expect(parseLeaseTools('').tools).toEqual([]);
    expect(parseLeaseTools(' , ').error).toContain('empty');
  });
});

describe('⑥ 结构锁:grantPermissionLease( 在源码面必须有非测试调用点', () => {
  const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));

  function collectTs(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...collectTs(full));
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  /** 剥掉注释:本仓最高频失效型就是"注释里提了一句 ⇒ 看起来有、其实没装车"。 */
  function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  }

  it('调用点 ≥ 1,且不在定义文件里(定义行本身不算)', () => {
    const files = collectTs(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const callSites = files
      .map((f) => ({ f, text: stripComments(readFileSync(f, 'utf8')) }))
      .filter(({ f, text }) => {
        if (!text.includes('grantPermissionLease(')) return false;
        // 排除 `export function grantPermissionLease(` 这一行(声明不是调用)
        const calls = text.split('\n').filter(
          (line) => line.includes('grantPermissionLease(') && !/export\s+function\s+grantPermissionLease\s*\(/.test(line),
        );
        if (calls.length === 0) return false;
        // 唯一构造出口自己内部不算调用点(它不调用自身)
        return !f.endsWith('/tools/permission-lease.ts');
      });
    expect(callSites.length).toBeGreaterThanOrEqual(1);
    expect(callSites.some((c) => c.f.endsWith('/utils/permission-lease-flag.ts'))).toBe(true);
    expect(callSites.some((c) => /test|spec/.test(c.f))).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
