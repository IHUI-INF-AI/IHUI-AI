/**
 * Permission Rules — 工具白名单/黑名单控制。
 *
 * 灵感来源:cli 的 `Permission Rules`(允许/拒绝特定工具)。
 * 简化策略(做减法):
 *   - 仅支持 allow/deny 两个列表(覆盖 cli 的 ask/deny 简化为 deny)
 *   - 在 executeToolCall 入口拦截,所有调用路径统一过滤(包括 subagent)
 *   - 白名单优先:如果 allow 非空,只允许列表内工具;deny 始终生效
 *
 * CLI 用法:
 *   ihui --tools read_file,grep,glob "..."
 *   ihui --disallowed-tools delete_file,git_commit "..."
 */

export interface PermissionRules {
  /** 白名单:非空时只允许这些工具(其余全部拒绝) */
  allow?: string[];
  /** 黑名单:无论 allow 是否设置,这些工具始终被拒绝 */
  deny?: string[];
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

/** 检查工具是否被允许执行 */
export function checkPermission(toolName: string, rules?: PermissionRules): PermissionCheckResult {
  if (!rules) return { allowed: true };
  if (rules.deny?.includes(toolName)) {
    return { allowed: false, reason: `工具 ${toolName} 在 --disallowed-tools 黑名单中` };
  }
  if (rules.allow && rules.allow.length > 0 && !rules.allow.includes(toolName)) {
    return { allowed: false, reason: `工具 ${toolName} 不在 --tools 白名单中` };
  }
  return { allowed: true };
}

/** 合并 PermissionRules(后者覆盖前者,deny 取并集) */
export function mergePermissions(
  base?: PermissionRules,
  override?: PermissionRules,
): PermissionRules | undefined {
  if (!base && !override) return undefined;
  if (!base) return override;
  if (!override) return base;
  const allow = override.allow ?? base.allow;
  const denySet = new Set([...(base.deny ?? []), ...(override.deny ?? [])]);
  return {
    allow: allow ? Array.from(allow) : undefined,
    deny: Array.from(denySet),
  };
}
