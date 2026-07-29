/**
 * 危险命令检测器(2026-07-25 立,深度对标 OpenAI Codex CLI safety guard)
 *
 * 触发场景:
 * - 用户在 bypass-permissions(完全访问)模式下发送 prompt
 * - prompt 包含 shell 命令,AI 会在工作区终端直接执行
 * - 部分命令是不可逆/高破坏性的(rm -rf /、mkfs、dd 等),需要在发送前拦截
 *
 * 设计原则:
 * - 纯函数,无副作用(无 React 依赖、无 I/O),可被单元测试 / message-input 任意场景复用
 * - 大小写不敏感(命令大小写在 Unix 系统下等价)
 * - 匹配策略:逐 pattern 跑正则,只要有 critical 或 high 命中即 hasDangerous=true
 * - 暴露 DANGEROUS_PATTERNS 供自验脚本引用,避免硬编码 2 处
 *
 * 不在本文件做的事:
 * - 不实际解析 shell AST(过度工程,正则足够覆盖 95% 场景)
 * - 不拦截 default / accept-edits 模式(由 message-input 调用方控制)
 * - 不持久化检测结果(无状态)
 */

export type DangerousSeverity = 'critical' | 'high' | 'medium'

export interface DangerousCommandMatch {
  /** i18n key 的 pattern 标识符(用于查表翻译),如 "rmRrfRoot" */
  pattern: string
  /** 风险原因(给用户看的纯英文,供 i18n 文本用占位符 {reason} 渲染) */
  reason: string
  /** 严重等级:critical=必须拦截 / high=必须拦截 / medium=仅警告 */
  severity: DangerousSeverity
}

export interface DetectionResult {
  matches: DangerousCommandMatch[]
  /** 是否有 critical 或 high 匹配(用于 message-input 决定"弹确认 toast"还是"普通警告") */
  hasDangerous: boolean
}

interface DangerousPattern {
  /** 唯一标识符,作为 DangerousCommandMatch.pattern */
  id: string
  /** 风险原因文本(英文,供占位符 / 自验脚本) */
  reason: string
  severity: DangerousSeverity
  /** 检测正则(已 case-insensitive,无前后空格锚定) */
  regex: RegExp
}

/**
 * 危险命令模式库(2026-07-25 立)
 *
 * 排序:critical → high → medium,先匹配高严重级别,
 * 这样 hasDangerous 早期 break 性能更好(实际 12 条数据量无所谓,可读性优先)。
 *
 * 写入原因:
 * - 1.6 MB 大小的 i18n 文件 + 6 个文件,每加一个模式都要改 5 个 json,本表就是唯一真相源
 * - 2. message-input 调用时,DANGEROUS_PATTERNS 是 list 而不是逐条 if,
 *   后续加新模式只要 push 一条,不用动调用方
 */
export const DANGEROUS_PATTERNS: readonly DangerousPattern[] = [
  // === critical:不可逆 + 整盘/整系统级破坏 ===
  {
    id: 'rmRrfRoot',
    reason: 'Recursively deletes root or home directory, cannot be recovered',
    severity: 'critical',
    regex: /\brm\s+(-\w*r\w*f\w*\s+)+(\/\s*|\/\*|~\s*|~\/\*)/i,
  },
  {
    id: 'ddToDisk',
    reason: 'Writes raw data directly to a disk device, will destroy the filesystem',
    severity: 'critical',
    regex: /\bdd\s+.*\bof=\/dev\/(sd\w+|nvme\w+|hd\w+|vd\w+)/i,
  },
  {
    id: 'mkfsDisk',
    reason: 'Formats a disk device and erases all partitions',
    severity: 'critical',
    regex: /\bmkfs(\.\w+)?\s+\/dev\/(sd\w+|nvme\w+|hd\w+|vd\w+)/i,
  },
  {
    id: 'redirectToDevice',
    reason: 'Redirects output to a raw disk device, will corrupt the filesystem',
    severity: 'critical',
    regex: />\s*\/dev\/(sd\w+|nvme\w+|hd\w+|vd\w+)\b/i,
  },
  {
    id: 'chmodRoot',
    reason: 'Sets world-writable permissions on root or system directories',
    severity: 'critical',
    regex: /\bchmod\s+(-\w*R\w*\s+)*777\s+\//i,
  },
  // === high:提权 / 任意代码执行 / fork bomb ===
  {
    id: 'sudoAny',
    reason: 'Runs a command as root via sudo',
    severity: 'high',
    regex: /\bsudo\s+/i,
  },
  {
    id: 'curlPipeSh',
    reason: 'Downloads a remote script and immediately executes it',
    severity: 'high',
    regex: /\b(curl|wget)\s+.*\|\s*(sh|bash|zsh|sudo\s+sh|sudo\s+bash)\b/i,
  },
  {
    id: 'forkBomb',
    reason: 'Classic Unix fork bomb that exhausts system processes',
    severity: 'high',
    regex: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
  },
  {
    id: 'mvRootToNull',
    reason: 'Moves all files under root into /dev/null, effectively wiping the system',
    severity: 'high',
    regex: /\bmv\s+(\/\*|(\/(\s|\S)+?))\s+\/dev\/null\b/i,
  },
  // === medium:删除关键文件 / 强推主分支 ===
  {
    id: 'rmEnv',
    reason: 'Deletes .env files, which often contain secrets and credentials',
    severity: 'medium',
    regex: /\brm\s+(-\w*r\w*f\w*\s+)*[^\s]*\.env\b/i,
  },
  {
    id: 'rmGit',
    reason: 'Deletes the .git directory, destroying version history',
    severity: 'medium',
    regex: /\brm\s+(-\w*r\w*f\w*\s+)*[^\s]*\.git\b/i,
  },
  {
    id: 'forcePushMain',
    reason: 'Force-pushes to main/master, may overwrite remote history',
    severity: 'medium',
    regex: /\bgit\s+push\s+(-\w*f\w*\s+|--force\w*\s+).*\b(main|master)\b/i,
  },
] as const

/**
 * 检测输入文本中的危险命令(2026-07-25 立)
 *
 * @param input - 用户在 textarea 中输入的原始文本
 * @returns DetectionResult
 *   - matches: 所有命中的危险命令
 *   - hasDangerous: 是否有 critical 或 high(用于 message-input 决定阻断 / 警告)
 *
 * 实现说明:
 * - 大小写不敏感(命令在 Unix 系统下等价)
 * - 不做 AST 解析(正则覆盖 95% 场景,过度工程会让代码不可维护)
 * - 检测到 critical/high 仍返回所有 matches(包含 medium),便于 toast 一次性列出所有风险
 */
export function detectDangerousCommands(input: string): DetectionResult {
  if (!input) {
    return { matches: [], hasDangerous: false }
  }
  const matches: DangerousCommandMatch[] = []
  for (const pat of DANGEROUS_PATTERNS) {
    if (pat.regex.test(input)) {
      matches.push({
        pattern: pat.id,
        reason: pat.reason,
        severity: pat.severity,
      })
    }
  }
  const hasDangerous = matches.some((m) => m.severity === 'critical' || m.severity === 'high')
  return { matches, hasDangerous }
}
