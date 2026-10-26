// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权限双轴(79 号票)在 CLI 运行时的**唯一装配点**:settings / config profile / 本地五档
 * → 一对生效字段(sandboxMode × approvalPolicy),以及"工具 → 粗类别"的端内映射。
 *
 * 边界(与另外三族互不顶账,逐条对齐既有头注):
 * - 判定本体在 `@ihui/types` 的 permission-axis(evaluateAxisGate / GRANULAR_APPROVAL_TOOL_KIND /
 *   normalize*);本文件**不复制任何档位/布尔/映射**,只做取值装配与端内工具名映射(§0.6)。
 *   第二份档位清单会漂移,本仓为此翻车多次,所以这里连"三值/四值"的字面量都不出现。
 * - 本地五档 `SANDBOX_PROFILES`(config/sandbox-profile.ts)是**命令面/凭据面**的预设族,
 *   与双轴不是同一族;两族经 `SANDBOX_PROFILE_TO_AXIS` 这一张映射表衔接,不互相顶账。
 * - web/后端的**请求级**口径是"缺轴 = 未指定"(不补默认,见 apps/web/src/lib/permission-axes.ts
 *   与 ai-service permission_axis_gate 的头注);本文件是**本地进程的默认授权**,口径相反:
 *   缺配置必须落到默认档(G-212 票面:默认档必须真的限制写入面/命令面)。两处语义各自成立,
 *   由"请求级字段(wire) ≠ 本地默认(本文件)"这条边界隔开,不得互相引用对方的缺省语义。
 *
 * 失效方向(§0.10):任何认不出的取值都落到**更严**一侧并在 `warnings` 里点名 ——
 * 调用方必须把 warnings 打出来;拿不到就一直"多喊一次",绝不静默放宽。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  APPROVAL_POLICY_DEFAULT,
  SANDBOX_MODE_DEFAULT,
  evaluateAxisGate,
  normalizeApprovalPolicySpec,
  normalizeSandboxMode,
  resolveConfigProfileAxis,
  type ApprovalPolicySpec,
  type AxisGateResult,
  type AxisPair,
  type AxisToolKind,
  type SandboxModeId,
} from '@ihui/types';

import { DEFAULT_SANDBOX_PROFILE, isSandboxProfile, type SandboxProfile } from '../config/sandbox-profile.js';
import { isPathAllowedWithRealpath } from './index.js';

/**
 * 本地五档 → 契约轴(唯一映射表)。
 *
 * 为什么 `limited` 映射 `workspace-write` 而不是 `read-only`:机主 2026-10-22 拍板的默认档
 * 是 `limited`(白名单命令 + 凭据屏蔽),它在本仓的语义是"可以在工作区内干活",若映射成
 * read-only 会把默认 CLI 变成只能看不能改 —— 那是改拍板,不是收口。彻底只读由**显式**
 * `sandbox.profile='readonly'` 或显式 `sandboxMode='read-only'` 表达。
 * `trusted` 的写入面与 limited 同档(工作区),差别只在命令白名单(它更宽),那由
 * SANDBOX_PROFILES 的 overrides 表达,不由轴重复表达。
 */
export const SANDBOX_PROFILE_TO_AXIS: Readonly<Record<SandboxProfile, SandboxModeId>> = {
  readonly: 'read-only',
  limited: 'workspace-write',
  trusted: 'workspace-write',
  open: 'danger-full-access',
  full: 'danger-full-access',
};

/** 生效值来源(测试与审计读它区分"默认"与"用户显式")。 */
type AxisValueSource = 'explicit' | 'config-profile' | 'sandbox-profile' | 'contract-default';

export interface PermissionAxisSettingsInput {
  /** 显式沙箱轴(settings.sandboxMode);字符串,未知值 ⇒ read-only + warning。 */
  sandboxMode?: unknown;
  /** 显式审批轴(settings.approvalPolicy);字符串档位或 `{ granular: {...} }`。 */
  approvalPolicy?: unknown;
  /** 选中的 config profile 名(settings.profile,Codex `profile=NAME` 同义)。 */
  profile?: unknown;
  /** config profiles 表(settings.profiles,[profiles.NAME] 同义)。 */
  profiles?: unknown;
  /** 本地五档沙箱预设(settings.sandbox.profile);未给时由调用方决定是否填默认档。 */
  sandboxProfile?: unknown;
}

export interface ResolvedPermissionAxis {
  sandboxMode: SandboxModeId;
  approvalPolicy: ApprovalPolicySpec;
  sandboxModeSource: AxisValueSource;
  approvalPolicySource: AxisValueSource;
  /** 非空 = 有值被拒或被更严结算;调用方必须吼出来(空数组 = 全部按预期解析)。 */
  warnings: string[];
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
}

/**
 * settings / config profile / 本地档 → 生效双轴对(纯函数)。
 *
 * 优先级(显式 > 组合档 > 本地档 > 契约默认):
 *  1. `sandboxMode` / `approvalPolicy` 显式给出 ⇒ 只用它;认不出 ⇒ 更严一侧 + warning;
 *  2. `profile` 指向的 `[profiles.NAME]` 里给了该轴 ⇒ 用它(组合档落到**同一对字段**,
 *     不另立第三套语义);profile 不存在或该段解析失败 ⇒ warning + 继续往下;
 *  3. `sandboxProfile`(本地五档)⇒ 经 `SANDBOX_PROFILE_TO_AXIS` 映射;审批轴无本地档对应,
 *     直接跳契约默认;
 *  4. 都没给 ⇒ 契约默认(`SANDBOX_MODE_DEFAULT` = 最严的 read-only;
 *     `APPROVAL_POLICY_DEFAULT` = on-request)。这正是"不显式给档时走最严"那一条。
 */
export function resolveCliPermissionAxis(input: PermissionAxisSettingsInput): ResolvedPermissionAxis {
  const warnings: string[] = [];

  let profileAxis: Partial<AxisPair> | null = null;
  if (isPresent(input.profile)) {
    const name = typeof input.profile === 'string' ? input.profile.trim() : String(input.profile);
    const table = isPlainRecord(input.profiles) ? input.profiles : undefined;
    const raw = table?.[name];
    if (raw === undefined) {
      warnings.push(
        `[permission-axis] config profile "${name}" not found in profiles; falling back to explicit/local defaults`,
      );
    } else {
      profileAxis = resolveConfigProfileAxis(raw);
      if (profileAxis === null) {
        warnings.push(
          `[permission-axis] config profile "${name}" has an unknown sandbox_mode/approval_policy; profile ignored (never falls back to a wider axis)`,
        );
      }
    }
  }

  let sandboxMode: SandboxModeId;
  let sandboxModeSource: AxisValueSource;
  if (isPresent(input.sandboxMode)) {
    const normalized = normalizeSandboxMode(input.sandboxMode);
    if (normalized !== null) {
      sandboxMode = normalized;
      sandboxModeSource = 'explicit';
    } else {
      sandboxMode = 'read-only';
      sandboxModeSource = 'explicit';
      warnings.push(
        `[permission-axis] unknown sandboxMode=${JSON.stringify(input.sandboxMode)}; falling back to "${sandboxMode}" (strictest)`,
      );
    }
  } else if (profileAxis?.sandboxMode !== undefined) {
    sandboxMode = profileAxis.sandboxMode;
    sandboxModeSource = 'config-profile';
  } else if (isPresent(input.sandboxProfile)) {
    if (isSandboxProfile(input.sandboxProfile)) {
      sandboxMode = SANDBOX_PROFILE_TO_AXIS[input.sandboxProfile];
    } else {
      // 档位表另有喊话(config 层),这里只保证取值落到最严且本层可断言。
      sandboxMode = SANDBOX_MODE_DEFAULT;
    }
    sandboxModeSource = 'sandbox-profile';
  } else {
    sandboxMode = SANDBOX_MODE_DEFAULT;
    sandboxModeSource = 'contract-default';
  }

  let approvalPolicy: ApprovalPolicySpec;
  let approvalPolicySource: AxisValueSource;
  if (isPresent(input.approvalPolicy)) {
    const normalized = normalizeApprovalPolicySpec(input.approvalPolicy);
    if (normalized !== null) {
      approvalPolicy = normalized;
    } else {
      approvalPolicy = 'untrusted';
      warnings.push(
        `[permission-axis] unknown approvalPolicy=${JSON.stringify(input.approvalPolicy)}; falling back to "untrusted" (strictest)`,
      );
    }
    approvalPolicySource = 'explicit';
  } else if (profileAxis?.approvalPolicy !== undefined) {
    approvalPolicy = profileAxis.approvalPolicy;
    approvalPolicySource = 'config-profile';
  } else {
    approvalPolicy = APPROVAL_POLICY_DEFAULT;
    approvalPolicySource = 'contract-default';
  }

  return { sandboxMode, approvalPolicy, sandboxModeSource, approvalPolicySource, warnings };
}

/** settings 的最小结构面(只声明本模块读的键,避免把 commands/settings.ts 的类型拖成循环依赖)。 */
export interface CliAxisSettingsLike {
  sandboxMode?: unknown;
  approvalPolicy?: unknown;
  profile?: unknown;
  profiles?: unknown;
  sandbox?: { profile?: unknown } | undefined;
}

/**
 * 生产装配入口(agent 启动时调一次)。
 *
 * 与纯 resolver 的唯一差别:把"settings 里没有 sandbox.profile"解析成
 * `DEFAULT_SANDBOX_PROFILE`(G-212:缺配置 ⇒ 默认档,**不是**"无限制");纯 resolver 保持
 * "什么都不给 ⇒ 契约最严 read-only"的单元语义。两条语义各自可测、衔接只在这一行。
 */
export function resolveCliPermissionAxisFromSettings(
  settings: CliAxisSettingsLike | undefined,
): ResolvedPermissionAxis {
  return resolveCliPermissionAxis({
    sandboxMode: settings?.sandboxMode,
    approvalPolicy: settings?.approvalPolicy,
    profile: settings?.profile,
    profiles: settings?.profiles,
    sandboxProfile: settings?.sandbox?.profile ?? DEFAULT_SANDBOX_PROFILE,
  });
}

/** 端内工具名 → 轴类别(唯一映射;未列出的按 dangerLevel 归类)。 */
const AXIS_TOOL_KIND_BY_NAME: Readonly<Record<string, AxisToolKind>> = {
  // run_command 家族:dangerLevel 已是 dangerous,列在这里是为了让"命令类"不受 dangerLevel
  // 缺省变化影响(有工具曾把 dangerLevel 省掉,按缺省读成只读是登记过的失效型)。
  run_command: 'command',
  kill_command: 'command',
  // skill 工具名唯一源在 skills/index.ts 的 SKILL_INVOCATION_TOOL_NAME;此处按字面量登记,
  // 由测试用该常量做对照断言(名字改了测试先红,不会静默漏判)。
  Skill: 'skill',
};

/**
 * 工具 → 轴类别。
 * - 显式名表优先(命令/skill 这类"名字比 dangerLevel 更可信"的);
 * - MCP 工具(两轴名 `mcp__<server>__<tool>`)归 mcp;
 * - 其余按 dangerLevel:write ⇒ write、dangerous ⇒ command(未知危险工具按最严的非写类)、
 *   缺省 ⇒ read(与 tool-contract 的"缺省按只读"同一口径,不在这里翻缺省)。
 */
export function axisToolKindOf(tool: { name: string; dangerLevel?: 'read' | 'write' | 'dangerous' }): AxisToolKind {
  const byName = AXIS_TOOL_KIND_BY_NAME[tool.name];
  if (byName !== undefined) return byName;
  if (tool.name.startsWith('mcp__')) return 'mcp';
  if (tool.dangerLevel === 'dangerous') return 'command';
  if (tool.dangerLevel === 'write') return 'write';
  return 'read';
}

/** 纯判定:工具 × 已解析轴 → 三态裁决(端内不另写判据,直接问契约层)。 */
export function evaluateToolAxis(
  axis: ResolvedPermissionAxis,
  tool: { name: string; dangerLevel?: 'read' | 'write' | 'dangerous' },
): AxisGateResult {
  return evaluateAxisGate({
    sandboxMode: axis.sandboxMode,
    approvalPolicy: axis.approvalPolicy,
    toolKind: axisToolKindOf(tool),
  });
}

export interface WritePathDecision {
  allowed: boolean;
  /** 拒绝时的机器可读原因(ASCII)。 */
  reason?: string;
  /** 拒绝时的下一步出路(可执行的一条)。 */
  hint?: string;
}

/**
 * 写入面判定(沙箱轴那一半;审批那一半由 evaluateToolAxis 判)。
 *
 * - `read-only` ⇒ 一律拒绝(连工作区内也不给写);
 * - `workspace-write` ⇒ 只允许工作区与 `allowedPaths` 内(复用 sandbox/index.ts 的 realpath
 *   实现,symlink 逃逸防护与命令面同一把尺,不写第二份);
 * - `danger-full-access` ⇒ 放行(仍受 folderTrust 的结构性限制,那不在本函数射程)。
 */
export function authorizeWritePath(
  axis: ResolvedPermissionAxis,
  workspacePath: string,
  filePath: string,
  allowedPaths: readonly string[] = [],
): WritePathDecision {
  if (axis.sandboxMode === 'read-only') {
    return {
      allowed: false,
      reason: 'sandbox_mode=read-only blocks write',
      hint: 'set sandboxMode=workspace-write in the user-level settings.json (or sandbox.profile=trusted) to allow writes',
    };
  }
  if (axis.sandboxMode === 'danger-full-access') return { allowed: true };
  const cwd = path.resolve(workspacePath);
  const ok = isPathAllowedWithRealpath(filePath, cwd, [...allowedPaths], fs.realpathSync);
  if (ok) return { allowed: true };
  return {
    allowed: false,
    reason: `sandbox_mode=workspace-write: path outside workspace: ${filePath}`,
    hint: 'write inside the workspace, or add the directory to sandbox.allowedPaths in the user-level settings.json',
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
