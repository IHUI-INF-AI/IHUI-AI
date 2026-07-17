/**
 * Permission Rules — 工具白名单/黑名单控制 + 5 种 permission mode。
 *
 * 灵感来源:Claude Code 的 --permission-mode + cli 的 Permission Rules。
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
