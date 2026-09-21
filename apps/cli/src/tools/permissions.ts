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

/** 5 种权限模式(对齐 Claude Code) */
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'manual';

/** 三态权限决策 */
export type PermissionDecision = 'allow' | 'deny' | 'ask';

const VALID_MODES: ReadonlySet<string> = new Set([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
  'manual',
]);

/** 解析字符串为 PermissionMode,非法值返回 undefined */
export function parsePermissionMode(s: string | undefined): PermissionMode | undefined {
  if (!s || typeof s !== 'string') return undefined;
  const trimmed = s.trim();
  if (VALID_MODES.has(trimmed)) return trimmed as PermissionMode;
  return undefined;
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

/** 后端 AgentLoopV2 权限模式词表(default/plan/auto,agent_loop_v2.py permission_mode) */
export type BackendPermissionMode = 'default' | 'plan' | 'auto';

/**
 * D3 权限模式对齐(2026-09-18):CLI 5 模式 → 后端 3 模式显式映射,单一事实源。
 *
 * 语义表(与 agent_loop_v2.py `_execute_single` 审批链对齐):
 * - default   → default:后端只读免审批,写/危险审批(CLI 本地矩阵同语义)
 * - acceptEdits → auto:后端 auto=只读免审批+高危仍审,是最接近"编辑放行"的档;
 *                CLI 本地 acceptEdits 更宽(write 也放行),接入后端通道时以此映射并知悉差异
 * - bypassPermissions → auto:后端无全免档,CLI 侧由审批门 bypass 特判(agent.ts plan 审批)
 *                补齐全免语义;后端通道按 auto 处理
 * - plan      → plan:1:1 直映
 * - manual    → default:CLI 本地 ask-everything 由 decideWithMode 保证;后端无对应档,退化为
 *                default(只读免审批)——接入后端时危险操作仍会经审批链,不产生放行风险
 */
export function mapCliModeToBackendMode(mode: PermissionMode): BackendPermissionMode {
  switch (mode) {
    case 'bypassPermissions':
    case 'acceptEdits':
      return 'auto';
    case 'plan':
      return 'plan';
    case 'default':
    case 'manual':
      return 'default';
  }
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
