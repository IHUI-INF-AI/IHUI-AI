/**
 * Permission Mode 测试 — 5 种 mode 行为矩阵 + 规则叠加 + parsePermissionMode + resolveEffectiveConfig。
 *
 * 覆盖范围:
 *   - parsePermissionMode:5 种合法值 + 拒绝非法值
 *   - checkPermission 2 参数(向后兼容):allow/deny/ask 规则
 *   - checkPermission 4 参数(mode-aware):5 种 mode × 3 种 dangerLevel 行为矩阵
 *   - 规则优先级高于 mode:deny/allow/ask 规则叠加
 *   - mergePermissions:deny/ask 并集 + mode 覆盖
 *   - resolveEffectiveConfig:CLI flag > settings.permissionMode > 'default'
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  parsePermissionMode,
  checkPermission,
  mergePermissions,
  type PermissionMode,
  type PermissionRules,
} from '../src/tools/permissions.js';
import {
  getSettingsPath,
  saveSettingsTemplate,
  resolveEffectiveConfig,
} from '../src/commands/settings.js';

describe('parsePermissionMode', () => {
  it('解析 5 种合法值', () => {
    expect(parsePermissionMode('default')).toBe('default');
    expect(parsePermissionMode('acceptEdits')).toBe('acceptEdits');
    expect(parsePermissionMode('bypassPermissions')).toBe('bypassPermissions');
    expect(parsePermissionMode('plan')).toBe('plan');
    expect(parsePermissionMode('manual')).toBe('manual');
  });

  it('trim 空白后解析', () => {
    expect(parsePermissionMode('  plan  ')).toBe('plan');
    expect(parsePermissionMode('\tacceptEdits\n')).toBe('acceptEdits');
  });

  it('非法值返回 undefined', () => {
    expect(parsePermissionMode('invalid')).toBeUndefined();
    expect(parsePermissionMode('readonly')).toBeUndefined();
    expect(parsePermissionMode('')).toBeUndefined();
    expect(parsePermissionMode('PLAN')).toBeUndefined();
    expect(parsePermissionMode('auto')).toBeUndefined();
  });

  it('undefined / 非字符串返回 undefined', () => {
    expect(parsePermissionMode(undefined)).toBeUndefined();
  });
});

describe('checkPermission 2 参数(向后兼容,仅规则)', () => {
  it('无规则时允许所有工具', () => {
    expect(checkPermission('read_file').allowed).toBe(true);
    expect(checkPermission('delete_file', undefined).allowed).toBe(true);
  });

  it('deny 规则拒绝黑名单工具', () => {
    const rules: PermissionRules = { deny: ['delete_file'] };
    expect(checkPermission('delete_file', rules).allowed).toBe(false);
    expect(checkPermission('delete_file', rules).reason).toContain('黑名单');
    expect(checkPermission('read_file', rules).allowed).toBe(true);
  });

  it('allow 规则只允许白名单工具', () => {
    const rules: PermissionRules = { allow: ['read_file', 'grep'] };
    expect(checkPermission('read_file', rules).allowed).toBe(true);
    expect(checkPermission('grep', rules).allowed).toBe(true);
    expect(checkPermission('delete_file', rules).allowed).toBe(false);
    expect(checkPermission('delete_file', rules).reason).toContain('白名单');
  });

  it('ask 规则不影响 2 参数版本(返回 allowed=true)', () => {
    const rules: PermissionRules = { ask: ['write_file'] };
    const result = checkPermission('write_file', rules);
    expect(result.allowed).toBe(true);
  });
});

describe('checkPermission 4 参数(mode-aware 行为矩阵)', () => {
  const noRules: PermissionRules | undefined = undefined;

  describe('default 模式', () => {
    const mode: PermissionMode = 'default';
    it('read → allow', () => {
      expect(checkPermission('read_file', noRules, mode, 'read')).toBe('allow');
    });
    it('write → ask', () => {
      expect(checkPermission('write_file', noRules, mode, 'write')).toBe('ask');
    });
    it('dangerous → ask', () => {
      expect(checkPermission('delete_file', noRules, mode, 'dangerous')).toBe('ask');
    });
  });

  describe('acceptEdits 模式', () => {
    const mode: PermissionMode = 'acceptEdits';
    it('read → allow', () => {
      expect(checkPermission('read_file', noRules, mode, 'read')).toBe('allow');
    });
    it('write → allow', () => {
      expect(checkPermission('write_file', noRules, mode, 'write')).toBe('allow');
    });
    it('dangerous → ask', () => {
      expect(checkPermission('delete_file', noRules, mode, 'dangerous')).toBe('ask');
    });
  });

  describe('bypassPermissions 模式', () => {
    const mode: PermissionMode = 'bypassPermissions';
    it('read → allow', () => {
      expect(checkPermission('read_file', noRules, mode, 'read')).toBe('allow');
    });
    it('write → allow', () => {
      expect(checkPermission('write_file', noRules, mode, 'write')).toBe('allow');
    });
    it('dangerous → allow', () => {
      expect(checkPermission('delete_file', noRules, mode, 'dangerous')).toBe('allow');
    });
  });

  describe('plan 模式', () => {
    const mode: PermissionMode = 'plan';
    it('read → allow', () => {
      expect(checkPermission('read_file', noRules, mode, 'read')).toBe('allow');
    });
    it('write → deny', () => {
      expect(checkPermission('write_file', noRules, mode, 'write')).toBe('deny');
    });
    it('dangerous → deny', () => {
      expect(checkPermission('delete_file', noRules, mode, 'dangerous')).toBe('deny');
    });
  });

  describe('manual 模式', () => {
    const mode: PermissionMode = 'manual';
    it('read → ask', () => {
      expect(checkPermission('read_file', noRules, mode, 'read')).toBe('ask');
    });
    it('write → ask', () => {
      expect(checkPermission('write_file', noRules, mode, 'write')).toBe('ask');
    });
    it('dangerous → ask', () => {
      expect(checkPermission('delete_file', noRules, mode, 'dangerous')).toBe('ask');
    });
  });
});

describe('规则优先级高于 mode', () => {
  it('deny 规则在任何 mode 下都拒绝', () => {
    const rules: PermissionRules = { deny: ['delete_file'] };
    expect(checkPermission('delete_file', rules, 'bypassPermissions', 'dangerous')).toBe('deny');
    expect(checkPermission('delete_file', rules, 'default', 'read')).toBe('deny');
    expect(checkPermission('delete_file', rules, 'acceptEdits', 'write')).toBe('deny');
  });

  it('allow 规则在任何 mode 下都允许(包括 plan 模式的 write)', () => {
    const rules: PermissionRules = { allow: ['write_file'] };
    expect(checkPermission('write_file', rules, 'plan', 'write')).toBe('allow');
    expect(checkPermission('write_file', rules, 'manual', 'write')).toBe('allow');
  });

  it('ask 规则在任何 mode 下都询问(包括 bypassPermissions)', () => {
    const rules: PermissionRules = { ask: ['custom_tool'] };
    expect(checkPermission('custom_tool', rules, 'bypassPermissions', 'read')).toBe('ask');
    expect(checkPermission('custom_tool', rules, 'default', 'read')).toBe('ask');
  });

  it('白名单非空时,不在白名单的工具在任何 mode 下都拒绝', () => {
    const rules: PermissionRules = { allow: ['read_file'] };
    expect(checkPermission('write_file', rules, 'bypassPermissions', 'write')).toBe('deny');
    expect(checkPermission('write_file', rules, 'acceptEdits', 'write')).toBe('deny');
  });

  it('bypassPermissions + deny 规则仍然拒绝', () => {
    const rules: PermissionRules = { deny: ['dangerous_tool'] };
    expect(checkPermission('dangerous_tool', rules, 'bypassPermissions', 'dangerous')).toBe('deny');
  });
});

describe('mergePermissions', () => {
  it('deny 取并集', () => {
    const base: PermissionRules = { deny: ['tool_a'] };
    const override: PermissionRules = { deny: ['tool_b'] };
    const merged = mergePermissions(base, override)!;
    expect(merged.deny).toContain('tool_a');
    expect(merged.deny).toContain('tool_b');
  });

  it('ask 取并集', () => {
    const base: PermissionRules = { ask: ['tool_a'] };
    const override: PermissionRules = { ask: ['tool_b'] };
    const merged = mergePermissions(base, override)!;
    expect(merged.ask).toContain('tool_a');
    expect(merged.ask).toContain('tool_b');
  });

  it('mode 后者覆盖前者', () => {
    const base: PermissionRules = { mode: 'default' };
    const override: PermissionRules = { mode: 'plan' };
    const merged = mergePermissions(base, override)!;
    expect(merged.mode).toBe('plan');
  });

  it('两者都无规则返回 undefined', () => {
    expect(mergePermissions(undefined, undefined)).toBeUndefined();
  });

  it('仅 base 有规则时返回 base', () => {
    const base: PermissionRules = { deny: ['tool_a'] };
    expect(mergePermissions(base, undefined)).toBe(base);
  });
});

describe('resolveEffectiveConfig permissionMode 优先级', () => {
  let tmpDir: string;
  let originalUserProfile: string | undefined;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-permmode-'));
    // 保存原始值(不能用 process.env = originalEnv,会破坏 Node 的 process.env 代理,
    // 导致后续 process.env.X = Y 不再调用 SetEnvironmentVariable,os.homedir() 读到陈旧值)
    originalUserProfile = process.env.USERPROFILE;
    originalHome = process.env.HOME;
    process.env.USERPROFILE = tmpDir;
    process.env.HOME = tmpDir;
    process.env.IHUI_API_URL = '';
    process.env.IHUI_API_KEY = '';
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    // 逐个恢复(保持 process.env 代理对象完整)
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  });

  it('无 CLI flag 无 settings → 默认 default', () => {
    const cfg = resolveEffectiveConfig({});
    expect(cfg.permissionMode).toBe('default');
  });

  it('CLI flag > settings', () => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ permissionMode: 'plan' }));
    const cfg = resolveEffectiveConfig({ cliPermissionMode: 'manual' });
    expect(cfg.permissionMode).toBe('manual');
  });

  it('settings > 默认 default', () => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ permissionMode: 'acceptEdits' }));
    const cfg = resolveEffectiveConfig({});
    expect(cfg.permissionMode).toBe('acceptEdits');
  });

  it('非法 CLI flag 回退到 settings', () => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ permissionMode: 'plan' }));
    const cfg = resolveEffectiveConfig({ cliPermissionMode: 'invalid_mode' });
    expect(cfg.permissionMode).toBe('plan');
  });

  it('非法 CLI flag + 无 settings → default', () => {
    const cfg = resolveEffectiveConfig({ cliPermissionMode: 'invalid' });
    expect(cfg.permissionMode).toBe('default');
  });

  it('saveSettingsTemplate 包含 permissionMode: default', () => {
    saveSettingsTemplate(true);
    const p = getSettingsPath();
    const content = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    expect(content.permissionMode).toBe('default');
  });
});
