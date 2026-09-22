// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Permission Rules — 工具白名单/黑名单控制 + 5 种 permission mode。
 *
 * 灵感来源:Claude Code 的 --permission-mode + 参考行业 Agent 框架的 Permission Rules。
 * 简化策略(做减法):
 *   - 5 种 mode:default / acceptEdits / bypassPermissions / plan / manual
 *   - allow/deny/ask 三态规则列表,规则优先级高于 mode
 *   - checkPermission 函数重载:2 参数(向后兼容,仅规则)/ 4 参数(mode-aware)
 *
 * CLI 用法:
 *   ihui --permission-mode plan "..."           # plan 模式:只读,禁止写/危险
 *   ihui --permission-mode acceptEdits "..."    # 自动允许写操作
 *   ihui --tools read_file,grep,glob "..."       # 白名单(规则,优先级高于 mode)
 *   ihui --disallowed-tools delete_file "..."    # 黑名单(规则)
 */

// 走子路径而非包根:packages/types 内部是无扩展名相对导入,node 运行时解析不了包根
// (实测 import('@ihui/types') → ERR_MODULE_NOT_FOUND './user'),而本文件所在包
// 需要**运行时值**导入。permission-mode.ts 零依赖,可被 node 直接加载(已实测)。
import { normalizePermissionMode, type PermissionModeId } from '@ihui/types/permission-mode'

/** 5 种权限模式:取值以 @ihui/types 的唯一真源为准(G-161 前本文件自抄了一份字面量联合)。 */
export type PermissionMode = PermissionModeId

/** 三态权限决策 */
export type PermissionDecision = 'allow' | 'deny' | 'ask'

/**
 * 解析字符串为 PermissionMode,非法值返回 undefined。
 *
 * 归一化交注册表:除 5 个规范档外,历史/kebab 拼写(auto / accept-edits /
 * bypass-permissions / read-only / plan-only / accept-all)也认 —— 此前本函数
 * 精确匹配 camelCase,用户照 web 界面或文档写 `accept-edits` 会被判非法,
 * 然后**静默**回落到 settings 里的 default(CLI 端"发了≠生效"的同一类事故)。
 */
export function parsePermissionMode(s: string | undefined): PermissionMode | undefined {
  if (!s || typeof s !== 'string') return undefined
  return normalizePermissionMode(s) ?? undefined
}

export interface PermissionRules {
  /** 白名单:非空时只允许这些工具(其余全部拒绝) */
  allow?: string[];
  /** 黑名单:无论 allow 是否设置,这些工具始终被拒绝 */
  deny?: string[];
  /** 询问列表:这些工具需要用户确认(优先级低于 allow/deny) */
  ask?: string[];
  /** 权限模式(对齐 Claude Code --permission-mode) */
  mode?: PermissionMode;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/** 解析逗号分隔字符串为工具名数组(去重 + trim) */
export function parseToolList(raw: string | undefined): string[] | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? Array.from(new Set(list)) : undefined;
}

/**
 * 仅规则匹配(向后兼容,2 参数 checkPermission 使用)。
 * 返回 allowed/reason,不走 mode 矩阵。
 */
function matchRulesOnly(toolName: string, rules?: PermissionRules): PermissionDecision {
  if (!rules) return 'allow';
  if (rules.deny?.includes(toolName)) return 'deny';
  if (rules.ask?.includes(toolName)) return 'ask';
  if (rules.allow && rules.allow.length > 0 && !rules.allow.includes(toolName)) return 'deny';
  return 'allow';
}

/**
 * 发往服务端的权限档类型 == 规范档本身(G-161 归一,2026-09-22)。
 *
 * 此前这里是第 6 套词表 `default|plan|auto`,并把
 * `acceptEdits`/`bypassPermissions` **都折叠成 `auto`** —— 那是"静默降档"陷阱:
 * 用户选的"全档免批"到服务端变成"只读免批"。第 67 项收口后服务端直接收规范档,
 * 折叠层已无必要(且有害),故改为恒等。函数保留是为了让"cli 档 ≠ 线上档"
 * 这类差异再次出现时,单测会先红。
 */
export type BackendPermissionMode = PermissionModeId

export function mapCliModeToBackendMode(mode: PermissionMode): BackendPermissionMode {
  return mode
}

/**
 * mode-aware 决策(4 参数 checkPermission 使用)。
 * 优先级链:deny 规则 → allow 规则 → ask 规则 → 白名单兜底 → switch mode。
 */
function decideWithMode(
  toolName: string,
  rules: PermissionRules | undefined,
  mode: PermissionMode,
  dangerLevel: 'read' | 'write' | 'dangerous',
): PermissionDecision {
  // 1. 规则优先级高于 mode:deny > allow > ask
  if (rules?.deny?.includes(toolName)) return 'deny';
  if (rules?.allow?.includes(toolName)) return 'allow';
  if (rules?.ask?.includes(toolName)) return 'ask';
  // 白名单非空但工具不在白名单 → deny(规则优先)
  if (rules?.allow && rules.allow.length > 0 && !rules.allow.includes(toolName)) return 'deny';

  // 2. 无规则匹配,按 mode 矩阵决策
  switch (mode) {
    case 'bypassPermissions':
      return 'allow';
    case 'default':
      return dangerLevel === 'read' ? 'allow' : 'ask';
    case 'acceptEdits':
      return dangerLevel === 'dangerous' ? 'ask' : 'allow';
    case 'plan':
      return dangerLevel === 'read' ? 'allow' : 'deny';
    case 'manual':
      return 'ask';
  }
}

export function checkPermission(toolName: string, rules?: PermissionRules): PermissionCheckResult;
export function checkPermission(
  toolName: string,
  rules: PermissionRules | undefined,
  mode: PermissionMode,
  dangerLevel: 'read' | 'write' | 'dangerous',
): PermissionDecision;
export function checkPermission(
  toolName: string,
  rules?: PermissionRules,
  mode?: PermissionMode,
  dangerLevel?: 'read' | 'write' | 'dangerous',
): PermissionCheckResult | PermissionDecision {
  // 4 参数重载:mode-aware 决策
  if (mode !== undefined && dangerLevel !== undefined) {
    return decideWithMode(toolName, rules, mode, dangerLevel);
  }
  // 2 参数重载:仅规则匹配(向后兼容)
  const decision = matchRulesOnly(toolName, rules);
  if (decision === 'deny') {
    return {
      allowed: false,
      reason: rules?.deny?.includes(toolName)
        ? `工具 ${toolName} 在 --disallowed-tools 黑名单中`
        : `工具 ${toolName} 不在 --tools 白名单中`,
    };
  }
  return { allowed: true };
}

/** 合并 PermissionRules(后者覆盖前者,deny/ask 取并集,mode 后者覆盖) */
export function mergePermissions(
  base?: PermissionRules,
  override?: PermissionRules,
): PermissionRules | undefined {
  if (!base && !override) return undefined;
  if (!base) return override;
  if (!override) return base;
  const allow = override.allow ?? base.allow;
  const denySet = new Set([...(base.deny ?? []), ...(override.deny ?? [])]);
  const askSet = new Set([...(base.ask ?? []), ...(override.ask ?? [])]);
  return {
    allow: allow ? Array.from(allow) : undefined,
    deny: Array.from(denySet),
    ask: Array.from(askSet),
    mode: override.mode ?? base.mode,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
