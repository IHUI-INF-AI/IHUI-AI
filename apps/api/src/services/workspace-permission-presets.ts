// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区权限预置模板(2026-11-28 从 workspace-permissions 路由抽出)。
 *
 * 抽出的直接原因：自动默认工作区也要用同一份模板初始化，不能复制第二份规则集；
 * 一旦复制，后续加规则必然两边漂移，后台任务又会重新掉进“写根文件要等 60s 审计”。
 *
 * 安全边界：
 * - `acceptEdits` 只自动放行文件写/改 + 模板内的读/命令，不自动执行任意 shell；
 * - 判定侧 `PermissionManager.checkWorkspace` 先扫 deny 再扫 allow，所以 `.env*`、
 *   `*.key`、`*.pem`、`credentials*` 的拒绝不会被 `**` 写放行压过；
 * - 只有**服务端自动创建的默认工作区**会做 `default → accept-edits` 初始化；
 *   用户自选目录仍按用户显式设置，不在这里静默改档。
 */
import { normalizePermissionMode, permissionModeWire } from '@ihui/types/permission-mode'
import {
  createRulesBulk,
  getPermission,
  listRules,
  upsertPermission,
} from '../db/workspace-permission-queries.js'

export interface RuleTemplate {
  ruleType: 'path' | 'command' | 'tool'
  pattern: string
  operation?: string
  decision: 'allow' | 'deny'
}

/** 预置安全模板：读/写源码目录 + 根文件兜底写改 + 敏感文件 deny + 常用命令。 */
export const SAFE_TEMPLATES: RuleTemplate[] = [
  // 路径放行:开发常读写的源码目录
  { ruleType: 'path', pattern: 'src/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'src/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'src/**', operation: 'edit', decision: 'allow' },
  { ruleType: 'path', pattern: 'apps/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'apps/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'packages/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'packages/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'docs/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'tests/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'tests/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'scripts/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'scripts/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: '**/桌面/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '**/桌面/**', operation: 'write', decision: 'allow' },
  // 路径放行:配置文件
  { ruleType: 'path', pattern: '*.json', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '*.md', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '*.ts', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '*.tsx', operation: 'read', decision: 'allow' },
  // 路径拒绝:敏感文件
  { ruleType: 'path', pattern: '.env*', operation: 'read', decision: 'deny' },
  { ruleType: 'path', pattern: '.env*', operation: 'write', decision: 'deny' },
  { ruleType: 'path', pattern: '.env*', operation: 'edit', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.key', operation: 'read', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.key', operation: 'write', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.key', operation: 'edit', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.pem', operation: 'read', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.pem', operation: 'write', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.pem', operation: 'edit', decision: 'deny' },
  { ruleType: 'path', pattern: '**/credentials*', operation: 'read', decision: 'deny' },
  { ruleType: 'path', pattern: '**/credentials*', operation: 'write', decision: 'deny' },
  { ruleType: 'path', pattern: '**/credentials*', operation: 'edit', decision: 'deny' },
  { ruleType: 'path', pattern: '.git/**', operation: 'write', decision: 'deny' },
  { ruleType: 'path', pattern: '.git/**', operation: 'edit', decision: 'deny' },
  // 路径兜底放行:accept-edits 要能编辑工作区里的任意工作文件(如 out.txt/README)。
  // 旧模板只放行 src/apps/packages 等子目录,后台任务一写根文件就掉进 60s 人工审计。
  // 这两条不是绕过上面的 deny:判定侧先扫 deny,敏感文件仍会被拒绝。
  { ruleType: 'path', pattern: '**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: '**', operation: 'edit', decision: 'allow' },
  // 命令放行:常用开发命令
  { ruleType: 'command', pattern: 'pnpm', operation: 'run', decision: 'allow' },
  { ruleType: 'command', pattern: 'git status', operation: 'run', decision: 'allow' },
  { ruleType: 'command', pattern: 'git diff', operation: 'run', decision: 'allow' },
  // 命令拒绝:高危命令
  { ruleType: 'command', pattern: 'rm -rf', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'git push --force', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'git reset --hard', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'DROP TABLE', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'DELETE FROM', operation: 'run', decision: 'deny' },
]

function ruleKey(rule: {
  ruleType: string
  pattern: string
  operation?: string | null
  decision: string
}) {
  return `${rule.ruleType}\u0000${rule.pattern}\u0000${rule.operation ?? ''}\u0000${rule.decision}`
}

/** 只补缺失的模板规则，不清用户自定义规则。重复调用幂等。 */
export async function mergeSafeTemplateRules(
  userId: string,
  workspacePath: string,
): Promise<number> {
  const existing = await listRules(userId, workspacePath)
  const keys = new Set(existing.map(ruleKey))
  const missing = SAFE_TEMPLATES.filter((rule) => !keys.has(ruleKey(rule)))
  if (missing.length > 0) {
    await createRulesBulk(
      userId,
      workspacePath,
      missing.map((rule) => ({ ...rule, builtin: true })),
    )
  }
  return missing.length
}

export interface EnsureDefaultWorkspacePermissionResult {
  mode: string
  changed: boolean
  addedRules: number
}

/**
 * 自动默认工作区的权限初始化/迁移。
 *
 * 只处理服务端自己创建的那个默认目录：
 *   - 没权限记录 → accept-edits + 全量模板；
 *   - 已有 `default`（历史自动创建）→ 升到 accept-edits + 补模板，避免后台任务每次写文件
 *     都等 60s 人工审计；
 *   - 已有 accept-edits → 只补缺失模板（升级后新增的根文件写规则能落到老用户）；
 *   - `plan` / `bypass-permissions` → 尊重用户显式选择，不改档、不补规则。
 */
export async function ensureDefaultWorkspacePermission(input: {
  userId: string
  workspacePath: string
  name: string
}): Promise<EnsureDefaultWorkspacePermissionResult> {
  const existing = await getPermission(input.userId, input.workspacePath)
  const current = existing ? (permissionModeWire(existing.mode) ?? existing.mode) : null

  if (!existing) {
    await upsertPermission({
      userId: input.userId,
      workspacePath: input.workspacePath,
      name: input.name,
      mode: normalizePermissionMode('acceptEdits') ?? 'acceptEdits',
    })
    const addedRules = await mergeSafeTemplateRules(input.userId, input.workspacePath)
    return { mode: 'accept-edits', changed: true, addedRules }
  }

  if (current === 'default') {
    await upsertPermission({
      userId: input.userId,
      workspacePath: input.workspacePath,
      name: existing.name || input.name,
      techStack: existing.techStack ?? undefined,
      mode: normalizePermissionMode('acceptEdits') ?? 'acceptEdits',
    })
    const addedRules = await mergeSafeTemplateRules(input.userId, input.workspacePath)
    return { mode: 'accept-edits', changed: true, addedRules }
  }

  if (current === 'accept-edits') {
    const addedRules = await mergeSafeTemplateRules(input.userId, input.workspacePath)
    return { mode: 'accept-edits', changed: addedRules > 0, addedRules }
  }

  return { mode: current ?? existing.mode, changed: false, addedRules: 0 }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
