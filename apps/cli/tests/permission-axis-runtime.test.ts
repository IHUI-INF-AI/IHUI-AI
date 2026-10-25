// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 79 号票(权限双轴 runtime)+ G-212(沙箱默认严档)收尾用例。
 *
 * 判据全部取自**源模块导出**(§22c):档位/默认/映射从 @ihui/types 与
 * config/sandbox-profile.ts 现取,测试里不重述任何"三值/四值/五布尔"清单;
 * 唯一手写的是"行为规格"(某档某类别该 allow / ask / deny),那是票面要求本身。
 *
 * 覆盖:
 *  - sandbox_mode 三值各正控(该拒必拒、该放必放,且 deny 带可执行出路);
 *  - approval_policy 四值各一例;
 *  - granular 五布尔各一例(缺省 false = 自动拒绝,管辖同类多键取更严);
 *  - 默认态:纯 resolver 什么都不给 ⇒ 契约最严 read-only;生产装配(settings 无键)⇒
 *    默认档派生的严档侧且绝非 danger-full-access;
 *  - 未知值 fail-closed(更严 + warning 点名);
 *  - config profiles:命名组合档落到同一对字段;未知名/坏值不落最宽;
 *  - 默认档下越权写被拒且报错带出路(工作区外)、危险命令被拒且报错带出路(白名单外);
 *  - 影子式:ctx 未装配 permissionAxis ⇒ 写入面零行为变更。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  APPROVAL_POLICIES,
  APPROVAL_POLICY_DEFAULT,
  GRANULAR_APPROVAL_KEYS,
  GRANULAR_APPROVAL_TOOL_KIND,
  SANDBOX_MODES,
  SANDBOX_MODE_DEFAULT,
  evaluateAxisGate,
  type AxisToolKind,
} from '@ihui/types';

import { DEFAULT_SANDBOX_PROFILE, SANDBOX_PROFILE_IDS } from '../src/config/sandbox-profile.js';
import {
  SANDBOX_PROFILE_TO_AXIS,
  axisToolKindOf,
  authorizeWritePath,
  evaluateToolAxis,
  resolveCliPermissionAxis,
  resolveCliPermissionAxisFromSettings,
} from '../src/sandbox/permission-axis-runtime.js';
import { evaluateCommandAllowlist, resolveSandboxOptions, runSandboxed } from '../src/sandbox/index.js';
import {
  checkPathWritePermission,
  disableToolHub,
  enableToolHub,
  executeToolCall,
  registerTools,
  type ToolContext,
} from '../src/tools/index.js';
import { BUILTIN_TOOLS } from '../src/tools/builtins.js';
import { createFileEditTools } from '../src/tools/file-edit.js';
import { SKILL_INVOCATION_TOOL_NAME } from '../src/skills/index.js';

let ws = '';
const outsidePathFor = (root: string): string => path.join(path.dirname(root), `${path.basename(root)}-outside.txt`);

beforeAll(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-axis-'));
  // write_file 家族是**闭包 ctx** 的工具(路径解析用创建时的 workspacePath),
  // 必须在 ws 就绪后注册;否则阳性对照会写去仓库根而不是夹具目录。
  registerTools([...BUILTIN_TOOLS, ...createFileEditTools({ workspacePath: ws })]);
});

afterAll(() => {
  try {
    fs.rmSync(ws, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    /* best-effort:Windows 句柄释放慢,残留由系统 TEMP 收割 */
  }
});

/** 某类别当前由哪些 granular 键管辖(从源映射推,不手抄)。 */
const managedKeysOf = (kind: AxisToolKind) =>
  GRANULAR_APPROVAL_KEYS.filter((k) => GRANULAR_APPROVAL_TOOL_KIND[k] === kind);

describe('sandbox_mode 三值:正控(该拒必拒/该放必放)', () => {
  it('read-only:读放行,写与命令一律拒绝,且拒绝串带出路', () => {
    const read = evaluateAxisGate({ sandboxMode: 'read-only', approvalPolicy: 'on-request', toolKind: 'read' });
    expect(read.decision).toBe('allow');

    for (const kind of ['write', 'command'] as const) {
      const denied = evaluateAxisGate({ sandboxMode: 'read-only', approvalPolicy: 'on-request', toolKind: kind });
      expect(denied.decision, `read-only 必须拒绝 ${kind}`).toBe('deny');
      expect(denied.reason).toContain('read-only');
      expect(denied.hint, '拒绝必须给可执行出路').toContain('workspace-write');
    }
  });

  it('workspace-write:写与命令都被放行到审批面(路径/白名单另判)', () => {
    expect(
      evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request', toolKind: 'write' }).decision,
    ).toBe('allow');
    // 命令在 on-request 下进询问(不是被沙箱面拒),两轴独立。
    expect(
      evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request', toolKind: 'command' }).decision,
    ).toBe('ask');
  });

  it('danger-full-access:命令在 never 下放行;沙箱面解除但审批面仍独立生效', () => {
    expect(
      evaluateAxisGate({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', toolKind: 'command' }).decision,
    ).toBe('allow');
    expect(
      evaluateAxisGate({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', toolKind: 'command' }).decision,
      '最宽沙箱也不得吞掉审批面(on-request 下命令仍须确认)',
    ).toBe('ask');
  });
});

describe('approval_policy 四值:逐档一例(读写放行/询问/拒绝)', () => {
  it(`untrusted(成员集第 1 项,共 ${APPROVAL_POLICIES.length} 项):只有读免问`, () => {
    expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'untrusted', toolKind: 'read' }).decision).toBe('allow');
    expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'untrusted', toolKind: 'write' }).decision).toBe('ask');
    expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'untrusted', toolKind: 'command' }).decision).toBe('ask');
  });

  it('on-failure(旧拼写按成员收):无"失败后升级"通道 ⇒ 取更严的 ask,不读成免问', () => {
    expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'on-failure', toolKind: 'read' }).decision).toBe('allow');
    expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'on-failure', toolKind: 'write' }).decision).toBe('ask');
  });

  it('on-request(默认):写免问、命令询问', () => {
    expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request', toolKind: 'write' }).decision).toBe('allow');
    expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request', toolKind: 'command' }).decision).toBe('ask');
  });

  it('never:两轴都放行(结构性禁止在更外层,不由本轴压过)', () => {
    for (const kind of ['read', 'write', 'command'] as const) {
      expect(evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: 'never', toolKind: kind }).decision).toBe('allow');
    }
  });
});

describe('granular 五布尔:逐键一例(false = 自动拒绝而非询问)', () => {
  for (const key of GRANULAR_APPROVAL_KEYS) {
    const kind = GRANULAR_APPROVAL_TOOL_KIND[key];

    it(`granular.${key}=false ⇒ ${kind} 自动拒绝,出路点名该开关`, () => {
      const result = evaluateAxisGate({
        sandboxMode: 'workspace-write',
        approvalPolicy: { granular: { [key]: false } },
        toolKind: kind,
      });
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain(key);
      expect(result.hint, '拒绝必须告诉用户改哪个开关').toContain(key);
    });

    it(`granular.${key}=true(管辖键全开)⇒ ${kind} 进入询问,绝不免问`, () => {
      const granular = Object.fromEntries(managedKeysOf(kind).map((k) => [k, true]));
      const result = evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: { granular }, toolKind: kind });
      expect(result.decision).toBe('ask');
    });
  }

  it('同类别多键取更严:只开一个管辖键仍拒绝', () => {
    const writeKeys = managedKeysOf('write');
    expect(writeKeys.length, '写入类至少有一个管辖键(映射表漂了这里先红)').toBeGreaterThan(0);
    if (writeKeys.length < 2) return;
    const granular = Object.fromEntries(writeKeys.map((k, i) => [k, i === 0]));
    const result = evaluateAxisGate({ sandboxMode: 'workspace-write', approvalPolicy: { granular }, toolKind: 'write' });
    expect(result.decision).toBe('deny');
  });
});

describe('默认态:不显式给档 ⇒ 最严一侧,绝不落最宽', () => {
  it('纯 resolver 什么都不给 ⇒ 契约默认(read-only 最严 + on-request)', () => {
    const axis = resolveCliPermissionAxis({});
    expect(axis.sandboxMode).toBe(SANDBOX_MODE_DEFAULT);
    expect(axis.sandboxMode).toBe('read-only');
    expect(axis.approvalPolicy).toBe(APPROVAL_POLICY_DEFAULT);
    expect(axis.sandboxModeSource).toBe('contract-default');
    expect(axis.approvalPolicySource).toBe('contract-default');
  });

  it('生产装配(settings 无任何沙箱键)⇒ 机主拍板的默认档派生,绝非 danger-full-access', () => {
    const axis = resolveCliPermissionAxisFromSettings({});
    expect(axis.sandboxMode).toBe(SANDBOX_PROFILE_TO_AXIS[DEFAULT_SANDBOX_PROFILE]);
    expect(axis.sandboxMode).not.toBe('danger-full-access');
    expect(axis.sandboxModeSource).toBe('sandbox-profile');
    expect(axis.warnings).toEqual([]);
  });

  it('本地五档 → 契约轴映射:键集与档位表逐字等值、值域落在 SANDBOX_MODES 内', () => {
    expect(Object.keys(SANDBOX_PROFILE_TO_AXIS).sort()).toEqual([...SANDBOX_PROFILE_IDS].sort());
    for (const id of SANDBOX_PROFILE_IDS) {
      expect(SANDBOX_MODES).toContain(SANDBOX_PROFILE_TO_AXIS[id]);
    }
    // 反向:最严档必须映射最严轴;最宽档必须映射最宽轴(两侧族序不漂)
    expect(SANDBOX_PROFILE_TO_AXIS.readonly).toBe('read-only');
    expect(SANDBOX_PROFILE_TO_AXIS.full).toBe('danger-full-access');
  });
});

describe('fail-closed:未知取值一律更严 + 显式点名', () => {
  it('未知 sandboxMode ⇒ read-only(最严)+ warning', () => {
    const axis = resolveCliPermissionAxis({ sandboxMode: 'totally-open' });
    expect(axis.sandboxMode).toBe('read-only');
    expect(axis.warnings.join('\n')).toContain('unknown sandboxMode');
  });

  it('未知 approvalPolicy(字符串/坏 granular 对象)⇒ untrusted(最严)+ warning', () => {
    const a = resolveCliPermissionAxis({ approvalPolicy: 'sometimes' });
    expect(a.approvalPolicy).toBe('untrusted');
    expect(a.warnings.join('\n')).toContain('unknown approvalPolicy');

    const b = resolveCliPermissionAxis({ approvalPolicy: { granular: { not_a_key: true } } });
    expect(b.approvalPolicy).toBe('untrusted');
    expect(b.warnings.join('\n')).toContain('unknown approvalPolicy');
  });
});

describe('config profiles:命名组合档落到同一对字段(不是第三套语义)', () => {
  it('profile 里的 sandbox_mode/approval_policy 直接生效,来源标记为 config-profile', () => {
    const axis = resolveCliPermissionAxis({
      profile: 'tight',
      profiles: { tight: { sandbox_mode: 'read-only', approval_policy: 'never' } },
    });
    expect(axis.sandboxMode).toBe('read-only');
    expect(axis.approvalPolicy).toBe('never');
    expect(axis.sandboxModeSource).toBe('config-profile');
    expect(axis.approvalPolicySource).toBe('config-profile');
    // 同一对字段 ⇒ 同一判定入口照样生效(不是 profile 专属的第二套判定)
    expect(evaluateToolAxis(axis, { name: 'write_file', dangerLevel: 'write' }).decision).toBe('deny');
  });

  it('profile 里的 granular 对象形态同样生效', () => {
    const axis = resolveCliPermissionAxis({
      profile: 'g',
      profiles: { g: { sandbox_mode: 'workspace-write', approval_policy: { granular: { sandbox_approval: false } } } },
    });
    expect(evaluateToolAxis(axis, { name: 'run_command', dangerLevel: 'dangerous' }).decision).toBe('deny');
  });

  it('显式轴优先于 profile(显式 > 组合档)', () => {
    const axis = resolveCliPermissionAxis({
      sandboxMode: 'workspace-write',
      profile: 'tight',
      profiles: { tight: { sandbox_mode: 'read-only' } },
    });
    expect(axis.sandboxMode).toBe('workspace-write');
    expect(axis.sandboxModeSource).toBe('explicit');
  });

  it('profile 名不存在 / profile 内坏值 ⇒ warning + 不落最宽(继续用更严的 fallback)', () => {
    const missing = resolveCliPermissionAxis({ profile: 'nope', profiles: {} });
    expect(missing.sandboxMode).toBe(SANDBOX_MODE_DEFAULT);
    expect(missing.warnings.join('\n')).toContain('not found');

    const broken = resolveCliPermissionAxis({
      profile: 'bad',
      profiles: { bad: { sandbox_mode: 'yolo-mode' } },
      sandboxProfile: 'limited',
    });
    expect(broken.sandboxMode).toBe(SANDBOX_PROFILE_TO_AXIS.limited);
    expect(broken.warnings.join('\n')).toContain('profile ignored');
  });
});

describe('默认档的运行时强制:越权写 / 危险命令被拒且报错带出路', () => {
  it('默认档下工作区内写放行(不是把正常路径一起砸了)', () => {
    const axis = resolveCliPermissionAxisFromSettings({});
    const inside = path.join(ws, 'inside.txt');
    expect(authorizeWritePath(axis, ws, inside).allowed).toBe(true);
    expect(checkPathWritePermission(inside, { workspacePath: ws, permissionAxis: axis }).allowed).toBe(true);
  });

  it('默认档下工作区外写被拒,报错点名 workspace-write 与 allowedPaths 两条出路', () => {
    const axis = resolveCliPermissionAxisFromSettings({});
    const outside = outsidePathFor(ws);
    const decision = authorizeWritePath(axis, ws, outside);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('outside workspace');
    expect(decision.hint).toContain('sandbox.allowedPaths');

    const perm = checkPathWritePermission(outside, { workspacePath: ws, permissionAxis: axis });
    expect(perm.allowed).toBe(false);
    expect(perm.reason, '写入拒绝必须带下一步出路').toContain('allowedPaths');
  });

  it('read-only 档连工作区内写也拒(显式只读),出路是升档', () => {
    const axis = resolveCliPermissionAxis({ sandboxMode: 'read-only' });
    const perm = checkPathWritePermission(path.join(ws, 'x.txt'), { workspacePath: ws, permissionAxis: axis });
    expect(perm.allowed).toBe(false);
    expect(perm.reason).toContain('workspace-write');
  });

  it('默认档下白名单外命令被拒(阻断在 spawn 之前),报错带登记出路', () => {
    const opts = resolveSandboxOptions(undefined, {});
    expect(evaluateCommandAllowlist('curl https://evil.example', opts.commandAllowlist)).toMatch(/^command_not_allowed:/);
    // 阳性对照:白名单内的命令照旧放行(策略不是"默认档什么都别跑")
    expect(evaluateCommandAllowlist('git status', opts.commandAllowlist)).toBeNull();

    const blocked = runSandboxed('curl https://evil.example', {
      cwd: ws,
      commandAllowlist: opts.commandAllowlist,
      blockedEnvVars: opts.blockedEnvVars,
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.exitCode).toBeNull();
    expect(blocked.stderr).toContain('sandbox.commandAllowlist');
  });

  it('影子式:ctx 未装配 permissionAxis ⇒ 写入面零行为变更(放行)', () => {
    const outside = outsidePathFor(ws);
    expect(checkPathWritePermission(outside, { workspacePath: ws }).allowed).toBe(true);
  });
});

describe('工具 → 轴类别映射(端内唯一映射)', () => {
  it('命令/技能/MCP/写/读 五类各一例', () => {
    expect(axisToolKindOf({ name: 'run_command', dangerLevel: 'dangerous' })).toBe('command');
    expect(axisToolKindOf({ name: 'kill_command', dangerLevel: 'dangerous' })).toBe('command');
    expect(axisToolKindOf({ name: SKILL_INVOCATION_TOOL_NAME })).toBe('skill');
    expect(axisToolKindOf({ name: 'mcp__srv__tool', dangerLevel: 'dangerous' })).toBe('mcp');
    expect(axisToolKindOf({ name: 'write_file', dangerLevel: 'write' })).toBe('write');
    expect(axisToolKindOf({ name: 'read_file', dangerLevel: 'read' })).toBe('read');
    // 未声明 dangerLevel 的工具按"缺省只读"归类(不在本层翻缺省)
    expect(axisToolKindOf({ name: 'mystery_tool' })).toBe('read');
  });

  it('命令类不受 dangerLevel 缺省变化影响(名字表优先)', () => {
    expect(axisToolKindOf({ name: 'run_command' })).toBe('command');
  });
});

describe('接线锁:executeToolCall 真的按双轴拒(不是只有纯函数在跑)', () => {
  it('写类工具在 read-only 轴下被执行器拒绝', async () => {
    const ctx: ToolContext = {
      workspacePath: ws,
      permissionAxis: resolveCliPermissionAxis({ sandboxMode: 'read-only' }),
    };
    const result = await executeToolCall({ name: 'write_file', arguments: { path: 'x.txt', content: 'y' } }, ctx);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('permission_denied');
    expect(result.error).toContain('read-only');
    // 副作用没发生(§认证不等于授权同款纪律:越权用例必须断言副作用未发生)
    expect(fs.existsSync(path.join(ws, 'x.txt'))).toBe(false);
  });

  it('命令类工具按 granular.sandbox_approval=false 被执行器拒绝', async () => {
    const ctx: ToolContext = {
      workspacePath: ws,
      permissionAxis: resolveCliPermissionAxis({
        sandboxMode: 'workspace-write',
        approvalPolicy: { granular: { sandbox_approval: false } },
      }),
    };
    const result = await executeToolCall(
      { name: 'run_command', arguments: { command: 'git status' } },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('granular.sandbox_approval');
  });

  it('ask 分支:非交互会话没有确认渠道 ⇒ 拒绝且带出路(不把"没人可问"读成默许)', async () => {
    const ctx: ToolContext = {
      workspacePath: ws,
      permissionAxis: resolveCliPermissionAxis({ sandboxMode: 'workspace-write', approvalPolicy: 'untrusted' }),
    };
    const result = await executeToolCall({ name: 'write_file', arguments: { path: 'z.txt', content: 'q' } }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('approval_policy=untrusted');
    expect(result.error).toContain('settings.json');
    expect(fs.existsSync(path.join(ws, 'z.txt'))).toBe(false);
  });

  it('阳性对照:同一工具在 never + workspace-write 下真的执行', async () => {
    const ctx: ToolContext = {
      workspacePath: ws,
      permissionAxis: resolveCliPermissionAxis({ sandboxMode: 'workspace-write', approvalPolicy: 'never' }),
    };
    const result = await executeToolCall({ name: 'write_file', arguments: { path: 'ok.txt', content: 'hello' } }, ctx);
    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(ws, 'ok.txt'), 'utf8')).toBe('hello');
  });

  it('hub 分支同判据:启用 toolHub 不能绕过双轴后门', async () => {
    const ctx: ToolContext = {
      workspacePath: ws,
      permissionAxis: resolveCliPermissionAxis({ sandboxMode: 'read-only' }),
    };
    enableToolHub();
    try {
      const result = await executeToolCall(
        { name: 'write_file', arguments: { path: 'hub-x.txt', content: 'nope' } },
        ctx,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
      expect(fs.existsSync(path.join(ws, 'hub-x.txt'))).toBe(false);
    } finally {
      disableToolHub();
    }
  });
});

describe('投影:profile 选择经 settings 结构面装配', () => {
  it('settings.profile + settings.profiles 生效,并保留 warning 面', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const axis = resolveCliPermissionAxisFromSettings({
        profile: 'safe',
        profiles: { safe: { approval_policy: 'never' } },
        sandbox: { profile: 'readonly' },
      });
      expect(axis.approvalPolicy).toBe('never');
      expect(axis.approvalPolicySource).toBe('config-profile');
      expect(axis.sandboxMode).toBe('read-only');
      expect(axis.sandboxModeSource).toBe('sandbox-profile');
    } finally {
      warn.mockRestore();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
