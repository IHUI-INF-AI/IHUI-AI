/**
 * permissions.ts 核心逻辑测试 — 补充 permissions-mode.test.ts 未覆盖的边界场景。
 *
 * 覆盖范围:
 *   - parsePermissionMode:合法/非法/空值/类型守卫
 *   - parseToolList:逗号分隔解析 + 去重 + trim + 边界
 *   - checkPermission 2 参数(向后兼容):返回 PermissionCheckResult(allowed + reason)
 *   - checkPermission 4 参数(mode-aware):返回 PermissionDecision(allow/deny/ask)
 *   - decideWithMode 规则优先级:deny > allow > ask > 白名单兜底 > mode 矩阵
 *   - mergePermissions:allow 字段覆盖 + deny/ask 并集 + mode 覆盖 + 仅 override
 */
import { describe, it, expect } from 'vitest';
import {
  parsePermissionMode,
  parseToolList,
  checkPermission,
  mergePermissions,
  type PermissionMode,
  type PermissionRules,
  type PermissionDecision,
  type PermissionCheckResult,
} from '../src/tools/permissions.js';

describe('parsePermissionMode', () => {
  it('5 种合法值', () => {
    const modes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual'];
    for (const m of modes) {
      expect(parsePermissionMode(m)).toBe(m);
    }
  });

  it('trim 空白', () => {
    expect(parsePermissionMode('  plan  ')).toBe('plan');
    expect(parsePermissionMode('\tmanual\n')).toBe('manual');
  });

  it('非法值返回 undefined', () => {
    expect(parsePermissionMode('invalid')).toBeUndefined();
    expect(parsePermissionMode('readonly')).toBeUndefined();
    expect(parsePermissionMode('auto')).toBeUndefined();
    expect(parsePermissionMode('PLAN')).toBeUndefined();
  });

  it('空值与非字符串返回 undefined', () => {
    expect(parsePermissionMode('')).toBeUndefined();
    expect(parsePermissionMode(undefined)).toBeUndefined();
  });
});

describe('parseToolList', () => {
  it('逗号分隔解析 + trim', () => {
    expect(parseToolList('read_file, grep , glob')).toEqual(['read_file', 'grep', 'glob']);
  });

  it('去重', () => {
    expect(parseToolList('read_file,read_file,grep')).toEqual(['read_file', 'grep']);
  });

  it('空字符串返回 undefined', () => {
    expect(parseToolList('')).toBeUndefined();
  });

  it('undefined 返回 undefined', () => {
    expect(parseToolList(undefined)).toBeUndefined();
  });

  it('仅空白项返回 undefined', () => {
    expect(parseToolList('  ,  ,  ')).toBeUndefined();
  });

  it('单项无逗号', () => {
    expect(parseToolList('read_file')).toEqual(['read_file']);
  });
});

describe('checkPermission 2 参数(返回 PermissionCheckResult)', () => {
  it('无规则时 allowed=true', () => {
    const result = checkPermission('read_file');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('无规则(undefined)时 allowed=true', () => {
    const result = checkPermission('delete_file', undefined);
    expect(result.allowed).toBe(true);
  });

  it('deny 规则:allowed=false + reason 含黑名单', () => {
    const rules: PermissionRules = { deny: ['delete_file'] };
    const result = checkPermission('delete_file', rules);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('黑名单');
  });

  it('allow 规则:不在白名单 allowed=false + reason 含白名单', () => {
    const rules: PermissionRules = { allow: ['read_file'] };
    const result = checkPermission('delete_file', rules);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('白名单');
  });

  it('allow 规则:在白名单 allowed=true', () => {
    const rules: PermissionRules = { allow: ['read_file', 'grep'] };
    expect(checkPermission('read_file', rules).allowed).toBe(true);
    expect(checkPermission('grep', rules).allowed).toBe(true);
  });

  it('ask 规则在 2 参数版本不影响 allowed(返回 true)', () => {
    const rules: PermissionRules = { ask: ['write_file'] };
    const result = checkPermission('write_file', rules);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('deny + allow 同时存在:deny 优先', () => {
    const rules: PermissionRules = { allow: ['read_file'], deny: ['read_file'] };
    expect(checkPermission('read_file', rules).allowed).toBe(false);
  });
});

describe('checkPermission 4 参数(返回 PermissionDecision)', () => {
  const noRules: PermissionRules | undefined = undefined;

  it('default: read=allow, write=ask, dangerous=ask', () => {
    expect(checkPermission('r', noRules, 'default', 'read')).toBe('allow');
    expect(checkPermission('w', noRules, 'default', 'write')).toBe('ask');
    expect(checkPermission('d', noRules, 'default', 'dangerous')).toBe('ask');
  });

  it('acceptEdits: read=allow, write=allow, dangerous=ask', () => {
    expect(checkPermission('r', noRules, 'acceptEdits', 'read')).toBe('allow');
    expect(checkPermission('w', noRules, 'acceptEdits', 'write')).toBe('allow');
    expect(checkPermission('d', noRules, 'acceptEdits', 'dangerous')).toBe('ask');
  });

  it('bypassPermissions: 全部 allow', () => {
    expect(checkPermission('r', noRules, 'bypassPermissions', 'read')).toBe('allow');
    expect(checkPermission('w', noRules, 'bypassPermissions', 'write')).toBe('allow');
    expect(checkPermission('d', noRules, 'bypassPermissions', 'dangerous')).toBe('allow');
  });

  it('plan: read=allow, write=deny, dangerous=deny', () => {
    expect(checkPermission('r', noRules, 'plan', 'read')).toBe('allow');
    expect(checkPermission('w', noRules, 'plan', 'write')).toBe('deny');
    expect(checkPermission('d', noRules, 'plan', 'dangerous')).toBe('deny');
  });

  it('manual: 全部 ask', () => {
    expect(checkPermission('r', noRules, 'manual', 'read')).toBe('ask');
    expect(checkPermission('w', noRules, 'manual', 'write')).toBe('ask');
    expect(checkPermission('d', noRules, 'manual', 'dangerous')).toBe('ask');
  });
});

describe('decideWithMode 规则优先级(高于 mode)', () => {
  it('deny 规则在任何 mode 下都 deny', () => {
    const rules: PermissionRules = { deny: ['dangerous_tool'] };
    const modes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual'];
    for (const mode of modes) {
      expect(checkPermission('dangerous_tool', rules, mode, 'dangerous')).toBe('deny');
    }
  });

  it('allow 规则在任何 mode 下都 allow(包括 plan+write)', () => {
    const rules: PermissionRules = { allow: ['write_file'] };
    expect(checkPermission('write_file', rules, 'plan', 'write')).toBe('allow');
    expect(checkPermission('write_file', rules, 'manual', 'write')).toBe('allow');
  });

  it('ask 规则在任何 mode 下都 ask(包括 bypassPermissions)', () => {
    const rules: PermissionRules = { ask: ['custom_tool'] };
    expect(checkPermission('custom_tool', rules, 'bypassPermissions', 'read')).toBe('ask');
  });

  it('白名单非空 + 工具不在白名单 → deny(即使 bypassPermissions)', () => {
    const rules: PermissionRules = { allow: ['read_file'] };
    expect(checkPermission('write_file', rules, 'bypassPermissions', 'write')).toBe('deny');
  });
});

describe('mergePermissions', () => {
  it('deny 取并集', () => {
    const merged = mergePermissions({ deny: ['a'] }, { deny: ['b'] })!;
    expect(merged.deny).toEqual(expect.arrayContaining(['a', 'b']));
    expect(merged.deny).toHaveLength(2);
  });

  it('ask 取并集', () => {
    const merged = mergePermissions({ ask: ['x'] }, { ask: ['y'] })!;
    expect(merged.ask).toEqual(expect.arrayContaining(['x', 'y']));
    expect(merged.ask).toHaveLength(2);
  });

  it('mode 后者覆盖前者', () => {
    expect(mergePermissions({ mode: 'default' }, { mode: 'plan' })!.mode).toBe('plan');
    expect(mergePermissions({ mode: 'plan' }, { mode: 'manual' })!.mode).toBe('manual');
  });

  it('allow 后者覆盖前者(非并集)', () => {
    const merged = mergePermissions({ allow: ['a', 'b'] }, { allow: ['c'] })!;
    expect(merged.allow).toEqual(['c']);
  });

  it('override.allow 为 undefined 时回退到 base.allow', () => {
    const merged = mergePermissions({ allow: ['a'] }, { deny: ['b'] })!;
    expect(merged.allow).toEqual(['a']);
    expect(merged.deny).toEqual(['b']);
  });

  it('仅 override 有规则时返回 override', () => {
    const override: PermissionRules = { deny: ['x'] };
    expect(mergePermissions(undefined, override)).toBe(override);
  });

  it('仅 base 有规则时返回 base', () => {
    const base: PermissionRules = { deny: ['x'] };
    expect(mergePermissions(base, undefined)).toBe(base);
  });

  it('两者都 undefined 返回 undefined', () => {
    expect(mergePermissions(undefined, undefined)).toBeUndefined();
  });

  it('deny 去重(两方有相同项)', () => {
    const merged = mergePermissions({ deny: ['a', 'b'] }, { deny: ['a', 'c'] })!;
    expect(merged.deny).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(merged.deny).toHaveLength(3);
  });
});

describe('checkPermission 重载返回类型验证', () => {
  it('2 参数版本返回 PermissionCheckResult(含 allowed 字段)', () => {
    const result: PermissionCheckResult = checkPermission('read_file');
    expect(typeof result.allowed).toBe('boolean');
    expect(result.allowed).toBe(true);
  });

  it('4 参数版本返回 PermissionDecision(allow/deny/ask 字符串)', () => {
    const decision: PermissionDecision = checkPermission('r', undefined, 'default', 'read');
    expect(['allow', 'deny', 'ask']).toContain(decision);
    expect(decision).toBe('allow');
  });
});
