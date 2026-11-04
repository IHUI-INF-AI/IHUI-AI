// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 规则级审批决策引擎(2026-11-04 立)
 *
 * 把审批从「人工静态策略」升级为**规则级决策 + 自动复核 + 授权记忆**。
 * 本模块是**纯函数**集合:不读磁盘、不查库、不依赖网络与时钟 —— `now` 由调用方注入,
 * 于是"过期 / 作用域 / 优先级 / 冲突"四类判定都能被单测穷尽。
 *
 * 三条硬纪律:
 *  1. 规则**声明式**:每条规则是数据(`{id, match, decision, priority}`),匹配语义由
 *     `matchRule` 一张谓词表统一解释,不允许在 evaluator 里散落 if-else;
 *  2. **deny 不可被降级**:自动复核只接受 `ask`,授权记忆只在 `ask` 上生效;
 *     任何把 `deny` 变 `allow` 的分支都不存在(反向例④即钉这一条);
 *  3. 兜底方向恒为**更严**:未知工具、未知路径、缺失应用名一律落到 `ask`。
 *
 * ── 命令风险:与另一路 AST 判定的对接位 ───────────────────────────────────
 * 命令风险规则的**权威输入**是另一路正在开发的「命令 AST 判定」。截至本文件落地时,
 * main 上尚无该实现(已 rg 确认无 tree-sitter / shell AST 判据;并行 worktree
 * `command-risk-1104` 亦无可读产物)。因此这里留出明确接口 `CommandRiskAnalyzer`,
 * 由消费方按依赖注入传入:
 *
 *     decideApproval(request, { commandRiskAnalyzer: astCommandAnalyzer })
 *
 * 该实现落地后,**只需替换注入的 analyzer**,规则集与判定签名不变。
 * 本文件自带的 `DEFAULT_COMMAND_RISK_ANALYZER` 是 token 兜底实现,不是 AST;
 * 其注释与导出名都如实标明 fallback,不允许被当成 AST 判定对外声称。
 */

// ===========================================================================
// 基础类型
// ===========================================================================

export type ApprovalDecision = 'allow' | 'ask' | 'deny'

/** 工具族:认不出的工具落 `unknown`(兜底只能更严)。 */
export type ApprovalToolFamily = 'read' | 'edit' | 'exec' | 'unknown'

export type CommandRiskLevel = 'low' | 'medium' | 'high'

/** 授权范围。`workspace` / `agent` 必须命中对应上下文才算数,`global` 无额外约束。 */
export type ApprovalGrantScope = 'workspace' | 'agent' | 'global'

/**
 * 一条持久化的授权记忆。
 *
 * 字段是任务书约定的最小集:**没有 `expiresAt` 的授权不成立**(不接受 null/永不过期),
 * `grantedBy` 为空视同无效 —— 授权必须来自显式的人类决策承载层。
 */
export interface ApprovalGrant {
  id: string
  /** 工具名:精确名,或命名空间前缀(如 `computer_use` 覆盖 `computer_use.mouse_click`),或 `*` */
  tool: string
  /** 匹配模式:glob(`*` 通配);对命令目标另有"前缀语义"(见 `grantMatchesTarget`) */
  matchPattern: string
  scope: ApprovalGrantScope
  /** scope='workspace' 时必填 */
  workspaceId?: string
  /** scope='agent' 时必填 */
  agentId?: string
  /** 过期时刻(epoch ms)。到期即失效,**判定侧**校验,不靠 UI 隐藏。 */
  expiresAt: number
  createdAt: number
  /** 授权人身份(非空才有效) */
  grantedBy: string
}

/** 自动复核的历史条目:只记录**真实发生过的人工结论**。 */
export interface ApprovalHistoryEntry {
  tool: string
  decision: 'allow' | 'deny'
  /** 当时命中的规则 id(自动复核必须"同规则"才可比,避免跨风险等级复用) */
  ruleId: string
  workspaceId: string | null
  agentId: string | null
  /** 命令前缀 / 应用名等"同一目标"的归一值 */
  scopeKey: string
  at: number
}

export interface ApprovalRuleContext {
  /** 工作区身份(消费方传工作区路径或 id;null = 未知) */
  workspaceId: string | null
  agentId: string | null
  userId: string | null
  /** 注入时钟,保证纯函数可测 */
  now: number
  grants?: readonly ApprovalGrant[]
  history?: readonly ApprovalHistoryEntry[]
  /**
   * 既有权限档矩阵(`decideByPermissionMode`)的结论。引擎**只采纳 deny/ask**,
   * 不采纳 allow —— 档位是上限,引擎只能在其内收紧或按规则判定,不能反向放宽。
   */
  tier?: { verdict: ApprovalDecision; reason: string }
}

export interface ApprovalRequest {
  tool: string
  args: Record<string, unknown>
  context: ApprovalRuleContext
}

/** 由 `{tool,args}` + 上下文计算出的、规则可读的事实集。 */
export interface ApprovalFacts {
  tool: string
  toolFamily: ApprovalToolFamily
  /** 参数字段里出现的路径 + 命令里像路径的 token */
  paths: string[]
  /** 任一路径越出工作区(或工作区未知时的绝对路径) */
  outsideWorkspace: boolean
  /** 任一路径落在凭据面(`.ssh`/`.aws`/`.env`/`Login Data` 等) */
  credentialPath: boolean
  /** 任一路径落在系统面(`/etc`、`C:/Windows` 等) */
  systemPath: boolean
  /** 命令或参数带出网动作 */
  networkEgress: boolean
  /** 递归/通配删除类动作 */
  bulkDelete: boolean
  commandRisk: CommandRiskLevel | null
  /** 命令前缀(前两个 token),供自动复核与授权记忆比对 */
  commandPrefix: string | null
  /** computer-use 目标应用名 */
  appName: string | null
  appNamePresent: boolean
  /** 目标应用在凭据/密码类黑名单 */
  appBlocked: boolean
  /** 目标应用被上下文里的授权记忆覆盖(已校验 scope + expiresAt) */
  appWhitelisted: boolean
  tierVerdict: ApprovalDecision | null
}

/**
 * 规则匹配的**声明式**子句:所有给出字段必须**同时**成立(合取);
 * 未给出的字段不参与判定。新增规则族只扩展这里的字段,不新增 evaluator 分支。
 */
export interface RuleMatch {
  always?: true
  tool?: string | readonly string[]
  toolFamily?: ApprovalToolFamily
  outsideWorkspace?: boolean
  credentialPath?: boolean
  systemPath?: boolean
  networkEgress?: boolean
  bulkDelete?: boolean
  /** 命令风险"至少达到"该档 */
  commandRiskAtLeast?: 'medium' | 'high'
  /** 目标应用名是否存在 */
  appNamePresent?: boolean
  appBlocked?: boolean
  appWhitelisted?: boolean
  tierVerdict?: ApprovalDecision
}

export interface ApprovalRule {
  id: string
  /** 人类可读解释(命中后原样进 reason,审计可溯源) */
  reason: string
  match: RuleMatch
  decision: ApprovalDecision
  /**
   * 是否允许自动复核把本条 `ask` 放行。
   * 只有"同一主体 + 同一工作区 + 同一规则 + 同一目标"的历史人工允许才可复用。
   */
  autoReviewable?: boolean
  /** 数值越大越先判;同优先级按"deny > ask > allow"再按声明顺序 */
  priority: number
}

export interface ApprovalResult {
  decision: ApprovalDecision
  matchedRule: string
  reason: string
  /** 自动复核放行时的说明(原规则 id + 依据) */
  autoReview?: { ruleId: string; reason: string }
  /** 授权记忆命中时的说明(授权 id + 作用域/到期) */
  grant?: { id: string; reason: string }
}

// ===========================================================================
// 事实计算(纯字符串/参数推导,无 IO)
// ===========================================================================

const READ_TOOL_NAMES: ReadonlySet<string> = new Set([
  'read',
  'browse',
  'glob',
  'grep',
  'ls',
  'list',
  'search',
  'view',
  'tree',
  'stat',
  'read_file',
  'list_dir',
])

const EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
  'edit',
  'write',
  'patch',
  'create',
  'replace',
  'multi_edit',
  'notebook_edit',
  'write_file',
  'apply_patch',
])

const EXEC_TOOL_NAMES: ReadonlySet<string> = new Set([
  'run',
  'exec',
  'bash',
  'shell',
  'command',
  'delete',
  'remove',
  'move',
  'mkdir',
  'chmod',
  'git',
  'terminal_run',
  'terminal',
  'code_execute',
  'execute_command',
  'fs.run',
  'computer_use',
])

export function toolFamilyOf(tool: string): ApprovalToolFamily {
  const t = tool.trim().toLowerCase()
  if (READ_TOOL_NAMES.has(t)) return 'read'
  if (EDIT_TOOL_NAMES.has(t)) return 'edit'
  if (EXEC_TOOL_NAMES.has(t)) return 'exec'
  // computer_use.* 统一按 exec 族:它驱动的是操作系统级输入
  if (t.startsWith('computer_use.') || t.startsWith('computer.')) return 'exec'
  return 'unknown'
}

/** 参数字段与命令里的路径收集。字段名表是唯一来源,消费方不需要再抄一遍。 */
const PATH_ARG_FIELDS = [
  'path',
  'file',
  'filePath',
  'filepath',
  'target',
  'cwd',
  'dest',
  'dir',
] as const

const CREDENTIAL_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)\.kube(\/|$)/i,
  /(^|\/)\.docker(\/|$)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.pypirc$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)\.git-credentials$/i,
  /(^|\/)\.env(\.|$|\/)/i,
  /id_rsa(\.pub)?$/i,
  /id_ed25519(\.pub)?$/i,
  /(^|\/)credentials\.json$/i,
  /(^|\/)login ?data$/i,
  /(^|\/)cookies$/i,
]

const SYSTEM_PATH_PATTERNS: readonly RegExp[] = [
  /^\/etc(\/|$)/i,
  /^\/usr(\/|$)/i,
  /^\/bin(\/|$)/i,
  /^\/sbin(\/|$)/i,
  /^\/boot(\/|$)/i,
  /^\/proc(\/|$)/i,
  /^\/sys(\/|$)/i,
  /^[a-z]:\/windows(\/|$)/i,
  /^[a-z]:\/program files/i,
  /^[a-z]:\/programdata(\/|$)/i,
]

const NETWORK_COMMAND_RE =
  /\b(curl|wget|nc|ncat|netcat|ssh|scp|sftp|ftp|telnet|ping|Invoke-WebRequest|iwr)\b/i
const NETWORK_ARG_FIELDS = [
  'url',
  'uri',
  'host',
  'hostname',
  'endpoint',
  'remote',
  'address',
] as const

const BULK_DELETE_RES: readonly RegExp[] = [
  /rm\s+[-]*(rf|fr|r)\b/i,
  /\bdel\s+\/[fsq]/i,
  /rmdir\s+\/s/i,
  /Remove-Item[^\n]*-Recurse/i,
  /find[^\n]*-delete/i,
  /git\s+clean\s+-[a-z]*f[a-z]*d/i,
  /\bdrop\s+table\b/i,
  /\btruncate\s+table\b/i,
]

/** 凭据/密码类应用黑名单:这类应用里的输入动作永远不自动放行。 */
export const BLOCKED_APP_PATTERNS: readonly RegExp[] = [
  /1password/i,
  /keepass/i,
  /bitwarden/i,
  /lastpass/i,
  /\bkeeper\b/i,
  /dashlane/i,
  /密码/i,
  /凭据/i,
  /口令/i,
]

export interface CommandRiskFinding {
  level: CommandRiskLevel
  /** 判定依据(供审计与规则解释;AST 实现应回填具体语法节点说明) */
  evidence: string
  /** 命令前缀(前两个 token),供自动复核/授权记忆比较 */
  prefix: string
}

/**
 * 命令风险分析器的**接口依赖位**。
 * 另一路 AST 判定落地后,按同一签名注入即可替换本文件的 fallback 实现。
 * 约定:返回 null 表示"未识别为命令",由规则层按未知处理(只会更严)。
 */
export interface CommandRiskAnalyzer {
  analyze(command: string): CommandRiskFinding | null
}

function commandPrefixOf(command: string): string {
  return command.trim().split(/\s+/).slice(0, 2).join(' ')
}

/**
 * ⚠️ fallback:token/正则级粗判,**不是 AST 判定**。
 * 单独命名并加注释的原因:若把它当 AST 用,`git "status"`、变量拼接、heredoc
 * 一类形态会被误判 —— 这正是另一路 AST 判定要解决的问题。
 */
export const DEFAULT_COMMAND_RISK_ANALYZER: CommandRiskAnalyzer = {
  analyze(command: string): CommandRiskFinding | null {
    const cmd = command.trim()
    if (!cmd) return null
    const high: RegExp[] = [
      /\brm\s+[-]*(rf|fr)\s+\/(\s|$)/i,
      /\bmkfs(\.|\s)/i,
      /\bdd\s+if=/i,
      /\b(shutdown|reboot|halt|poweroff)\b/i,
      /\bformat\s+[a-z]:/i,
      /\bbcdedit\b/i,
      /\breg\s+delete\b/i,
      /\bnet\s+user\b/i,
      /curl[^\n|]*\|\s*(sh|bash)\b/i,
      /wget[^\n|]*\|\s*(sh|bash)\b/i,
      /\bInvoke-Expression\b/i,
      /\biwr[^\n|]*\|\s*iex\b/i,
      /\bpowershell\s+-enc\b/i,
      /\bsudo\s+/i,
    ]
    for (const re of high) {
      if (re.test(cmd))
        return { level: 'high', evidence: `high:${re.source}`, prefix: commandPrefixOf(cmd) }
    }
    const medium: RegExp[] = [
      /\brm\s+/,
      /\bmv\s+/,
      /\bchmod\b/i,
      /\bchown\b/i,
      /\bgit\s+push\b/i,
      /\bgit\s+reset\s+--hard\b/i,
      /\bnpm\s+publish\b/i,
      /\bdocker\s+rm\b/i,
      /\bkubectl\s+delete\b/i,
      /\bnpm\s+(i|install)\s+-g\b/i,
      /\bpip\s+install\b/i,
    ]
    for (const re of medium) {
      if (re.test(cmd))
        return { level: 'medium', evidence: `medium:${re.source}`, prefix: commandPrefixOf(cmd) }
    }
    return { level: 'low', evidence: 'no-risk-token', prefix: commandPrefixOf(cmd) }
  },
}

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/')
}

function isAbsolutePath(p: string): boolean {
  return /^([A-Za-z]:\/|\/|~\/)/.test(normalizeSlashes(p))
}

/**
 * 路径是否越出工作区。
 * - 相对路径只看 `..` 是否把深度压到负数(不臆测 cwd);
 * - 绝对路径按工作区前缀比较,工作区未知 ⇒ 一律视为越界(兜底更严);
 * - `~/` 一律视为越界(用户家目录不是工作区)。
 */
export function pathEscapesWorkspace(rawPath: string, workspaceId: string | null): boolean {
  const p = normalizeSlashes(rawPath.trim())
  if (!p) return false
  if (p.startsWith('~/')) return true
  if (!isAbsolutePath(p)) {
    let depth = 0
    for (const seg of p.split('/')) {
      if (seg === '' || seg === '.') continue
      if (seg === '..') {
        depth -= 1
        if (depth < 0) return true
      } else {
        depth += 1
      }
    }
    return false
  }
  if (!workspaceId) return true
  const root = normalizeSlashes(workspaceId.trim()).replace(/\/+$/, '')
  if (!root) return true
  const caseInsensitive = /^[A-Za-z]:\//.test(p) || /^[A-Za-z]:\//.test(root)
  const candidate = caseInsensitive ? p.toLowerCase() : p
  const workspace = caseInsensitive ? root.toLowerCase() : root
  return !(candidate === workspace || candidate.startsWith(`${workspace}/`))
}

function collectPaths(args: Record<string, unknown>, command: string | null): string[] {
  const found: string[] = []
  for (const field of PATH_ARG_FIELDS) {
    const v = args[field]
    if (typeof v === 'string' && v.trim()) found.push(v.trim())
    if (Array.isArray(v)) {
      for (const item of v) if (typeof item === 'string' && item.trim()) found.push(item.trim())
    }
  }
  if (command) {
    for (const token of command.split(/\s+/)) {
      const t = token.replace(/^['"]|['"]$/g, '')
      if (t && (isAbsolutePath(t) || t.startsWith('..'))) found.push(t)
    }
  }
  return found
}

function stringArg(args: Record<string, unknown>, field: string): string | null {
  const v = args[field]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function computeFacts(
  request: ApprovalRequest,
  commandRiskAnalyzer: CommandRiskAnalyzer = DEFAULT_COMMAND_RISK_ANALYZER,
): ApprovalFacts {
  const tool = request.tool.trim()
  const args = request.args ?? {}
  const command =
    stringArg(args, 'command') ??
    stringArg(args, 'cmd') ??
    stringArg(args, 'script') ??
    stringArg(args, 'shell')
  const paths = collectPaths(args, command)
  const normalizedPaths = paths.map(normalizeSlashes)

  const risk = command ? commandRiskAnalyzer.analyze(command) : null
  const appName =
    stringArg(args, 'appName') ??
    stringArg(args, 'app') ??
    stringArg(args, 'targetApp') ??
    stringArg(args, 'application')
  const lowerTool = tool.toLowerCase()
  const isComputerTool = lowerTool.startsWith('computer_use') || lowerTool.startsWith('computer.')
  const grants = request.context.grants ?? []

  const appWhitelisted =
    isComputerTool && appName !== null ? hasAppGrant(grants, request, appName) : false
  const appBlocked = appName !== null && BLOCKED_APP_PATTERNS.some((re) => re.test(appName))

  const networkArgHit = NETWORK_ARG_FIELDS.some((f) => {
    const v = args[f]
    return typeof v === 'string' && v.trim().length > 0
  })

  return {
    tool,
    toolFamily: toolFamilyOf(tool),
    paths,
    outsideWorkspace: normalizedPaths.some((p) =>
      pathEscapesWorkspace(p, request.context.workspaceId),
    ),
    credentialPath: normalizedPaths.some((p) => CREDENTIAL_PATH_PATTERNS.some((re) => re.test(p))),
    systemPath: normalizedPaths.some((p) => SYSTEM_PATH_PATTERNS.some((re) => re.test(p))),
    networkEgress: networkArgHit || (command !== null && NETWORK_COMMAND_RE.test(command)),
    bulkDelete:
      (command !== null && BULK_DELETE_RES.some((re) => re.test(command))) ||
      (typeof args.recursive === 'boolean' &&
        args.recursive &&
        toolFamilyOf(tool) === 'exec' &&
        /delete|remove/i.test(tool)),
    commandRisk: risk?.level ?? null,
    commandPrefix: risk?.prefix ?? (command ? commandPrefixOf(command) : null),
    appName,
    appNamePresent: appName !== null,
    appBlocked,
    appWhitelisted,
    tierVerdict: request.context.tier?.verdict ?? null,
  }
}

// ===========================================================================
// 规则集(声明式、可排序、可解释)
// ===========================================================================

/**
 * 默认工具规则集。优先级设计原则:
 *   ① deny 族(85+)永远压过 ask/allow;
 *   ② 档位 ask(82)只压 allow 族(30/40),不压任何 deny —— 档位是上限而非放宽理由;
 *   ③ allow 族只认"只读且未越界",以及"授权记忆已覆盖";
 *   ④ 兜底 ask(20)保证任何未知形态都落到人工。
 */
export const APPROVAL_RULES: readonly ApprovalRule[] = [
  {
    id: 'deny.tier-ceiling',
    reason: '权限档位硬拒绝(如 plan 档只读)',
    match: { tierVerdict: 'deny' },
    decision: 'deny',
    priority: 100,
  },
  {
    id: 'deny.credential-read',
    reason: '读取凭据面路径(SSH/AWS/环境变量/浏览器登录库等)',
    match: { credentialPath: true, toolFamily: 'read' },
    decision: 'deny',
    priority: 99,
  },
  {
    id: 'deny.bulk-delete',
    reason: '递归/通配删除类动作',
    match: { bulkDelete: true },
    decision: 'deny',
    priority: 95,
  },
  {
    id: 'deny.command-high-risk',
    reason: '命令风险判定为高',
    match: { commandRiskAtLeast: 'high' },
    decision: 'deny',
    priority: 90,
  },
  {
    id: 'deny.system-path',
    reason: '写入/执行落在系统目录(/etc、C:/Windows 等)',
    match: { systemPath: true },
    decision: 'deny',
    priority: 88,
  },
  {
    id: 'ask.tier-ceiling',
    reason: '权限档位要求人工确认',
    match: { tierVerdict: 'ask' },
    decision: 'ask',
    priority: 82,
  },
  {
    id: 'ask.credential-edit',
    reason: '改动凭据面路径(可读不可静默写)',
    match: { credentialPath: true, toolFamily: 'edit' },
    decision: 'ask',
    priority: 80,
  },
  {
    id: 'ask.path-outside-workspace',
    reason: '路径越出工作区',
    match: { outsideWorkspace: true },
    decision: 'ask',
    priority: 70,
  },
  {
    id: 'ask.network-egress',
    reason: '动作会发起网络出口',
    match: { networkEgress: true },
    decision: 'ask',
    priority: 60,
    autoReviewable: true,
  },
  {
    id: 'ask.command-medium-risk',
    reason: '命令风险判定为中',
    match: { commandRiskAtLeast: 'medium' },
    decision: 'ask',
    priority: 55,
    autoReviewable: true,
  },
  {
    id: 'ask.unknown-tool',
    reason: '工具族未知,按最严转人工',
    match: { toolFamily: 'unknown' },
    decision: 'ask',
    priority: 50,
  },
  {
    id: 'ask.exec-tool',
    reason: '执行类工具需人工确认',
    match: { toolFamily: 'exec' },
    decision: 'ask',
    priority: 45,
    autoReviewable: true,
  },
  {
    id: 'allow.read-only',
    reason: '只读工具且未触及敏感/越界路径',
    match: { toolFamily: 'read' },
    decision: 'allow',
    priority: 30,
  },
  {
    id: 'ask.fallback',
    reason: '无规则明确放行,兜底转人工',
    match: { always: true },
    decision: 'ask',
    priority: 20,
  },
]

const DECISION_RANK: Readonly<Record<ApprovalDecision, number>> = { deny: 3, ask: 2, allow: 1 }

/** 排序:优先级降序 → 同优先级 deny>ask>allow → 保留声明顺序(稳定)。 */
export function sortRules(rules: readonly ApprovalRule[]): ApprovalRule[] {
  return [...rules]
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => {
      if (b.rule.priority !== a.rule.priority) return b.rule.priority - a.rule.priority
      const byDecision = DECISION_RANK[b.rule.decision] - DECISION_RANK[a.rule.decision]
      if (byDecision !== 0) return byDecision
      return a.index - b.index
    })
    .map((x) => x.rule)
}

function matchRule(match: RuleMatch, facts: ApprovalFacts): boolean {
  if (match.always) return true
  const checks: boolean[] = []
  if (match.tool !== undefined) {
    const wanted = Array.isArray(match.tool) ? match.tool : [match.tool]
    checks.push(wanted.some((t) => toolMatchesPattern(String(t), facts.tool)))
  }
  if (match.toolFamily !== undefined) checks.push(facts.toolFamily === match.toolFamily)
  if (match.outsideWorkspace !== undefined)
    checks.push(facts.outsideWorkspace === match.outsideWorkspace)
  if (match.credentialPath !== undefined) checks.push(facts.credentialPath === match.credentialPath)
  if (match.systemPath !== undefined) checks.push(facts.systemPath === match.systemPath)
  if (match.networkEgress !== undefined) checks.push(facts.networkEgress === match.networkEgress)
  if (match.bulkDelete !== undefined) checks.push(facts.bulkDelete === match.bulkDelete)
  if (match.commandRiskAtLeast !== undefined) {
    const rank: Record<CommandRiskLevel, number> = { low: 0, medium: 1, high: 2 }
    checks.push(
      facts.commandRisk !== null && rank[facts.commandRisk] >= rank[match.commandRiskAtLeast],
    )
  }
  if (match.appNamePresent !== undefined) checks.push(facts.appNamePresent === match.appNamePresent)
  if (match.appBlocked !== undefined) checks.push(facts.appBlocked === match.appBlocked)
  if (match.appWhitelisted !== undefined) checks.push(facts.appWhitelisted === match.appWhitelisted)
  if (match.tierVerdict !== undefined) checks.push(facts.tierVerdict === match.tierVerdict)
  return checks.length > 0 && checks.every(Boolean)
}

// ===========================================================================
// 授权记忆
// ===========================================================================

/** 工具名匹配:精确 / 命名空间前缀(`computer_use` ⊃ `computer_use.mouse_click`) / `*`。 */
export function toolMatchesPattern(pattern: string, tool: string): boolean {
  const p = pattern.trim()
  if (!p) return false
  if (p === '*') return true
  const t = tool.trim()
  return t === p || t.startsWith(`${p}.`)
}

/** `matchPattern` 的 glob 语义:只支持 `*`(任意长度通配),其余字符字面量。 */
export function globMatches(pattern: string, value: string): boolean {
  const p = pattern.trim()
  if (!p) return false
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i').test(value)
}

function grantActiveAt(grant: ApprovalGrant, now: number): boolean {
  if (!grant.grantedBy || !grant.grantedBy.trim()) return false
  if (!Number.isFinite(grant.expiresAt)) return false
  return grant.expiresAt > now
}

function grantScopeMatches(grant: ApprovalGrant, context: ApprovalRuleContext): boolean {
  switch (grant.scope) {
    case 'global':
      return true
    case 'workspace':
      return context.workspaceId !== null && grant.workspaceId === context.workspaceId
    case 'agent':
      return context.agentId !== null && grant.agentId === context.agentId
    default:
      return false
  }
}

/** 授权目标比对:应用名 / 命令(前缀) / 路径 / 工具名,任一命中即算覆盖同一目标。 */
export function grantMatchesTarget(
  grant: ApprovalGrant,
  facts: ApprovalFacts,
  command: string | null,
): boolean {
  const pattern = grant.matchPattern.trim()
  if (!pattern) return false
  const candidates: string[] = []
  if (facts.appName) candidates.push(facts.appName)
  if (facts.commandPrefix) candidates.push(facts.commandPrefix)
  if (command) candidates.push(command)
  candidates.push(...facts.paths)
  candidates.push(facts.tool)
  if (candidates.some((c) => globMatches(pattern, c))) return true
  // 命令前缀语义:无通配符的 pattern 视为前缀(`git status` 覆盖 `git status --short`)
  if (command && !pattern.includes('*') && command.trim().startsWith(pattern)) return true
  return false
}

function hasAppGrant(
  grants: readonly ApprovalGrant[],
  request: ApprovalRequest,
  appName: string,
): boolean {
  return grants.some(
    (g) =>
      grantActiveAt(g, request.context.now) &&
      grantScopeMatches(g, request.context) &&
      toolMatchesPattern(g.tool, request.tool) &&
      globMatches(g.matchPattern, appName),
  )
}

export function findMatchingGrant(
  request: ApprovalRequest,
  facts: ApprovalFacts,
): ApprovalGrant | null {
  const grants = request.context.grants ?? []
  const command =
    stringArg(request.args, 'command') ??
    stringArg(request.args, 'cmd') ??
    stringArg(request.args, 'script') ??
    null
  for (const grant of grants) {
    if (!grantActiveAt(grant, request.context.now)) continue
    if (!grantScopeMatches(grant, request.context)) continue
    if (!toolMatchesPattern(grant.tool, request.tool)) continue
    if (!grantMatchesTarget(grant, facts, command)) continue
    return grant
  }
  return null
}

/** 撤销:返回新数组(纯函数,不改入参)。 */
export function revokeGrant(grants: readonly ApprovalGrant[], grantId: string): ApprovalGrant[] {
  return grants.filter((g) => g.id !== grantId)
}

/** 过期清理:到期行不参与判定,也不应继续占据存储。 */
export function pruneExpiredGrants(grants: readonly ApprovalGrant[], now: number): ApprovalGrant[] {
  return grants.filter((g) => grantActiveAt(g, now))
}

// ===========================================================================
// 判定
// ===========================================================================

export interface EvaluateOptions {
  rules?: readonly ApprovalRule[]
  commandRiskAnalyzer?: CommandRiskAnalyzer
  /** 允许调用方预先算好的事实(computer-use 模块会补 app 事实) */
  facts?: ApprovalFacts
  /** 会话内近因历史;缺省时读 `context.history` */
  history?: readonly ApprovalHistoryEntry[]
}

/** 只做规则判定,不含授权记忆与自动复核 —— 便于"反向例①"单独验证规则本身。 */
export function evaluateRules(
  request: ApprovalRequest,
  options: EvaluateOptions = {},
): ApprovalResult {
  const rules = sortRules(options.rules ?? APPROVAL_RULES)
  const facts =
    options.facts ??
    computeFacts(request, options.commandRiskAnalyzer ?? DEFAULT_COMMAND_RISK_ANALYZER)
  for (const rule of rules) {
    if (matchRule(rule.match, facts)) {
      return {
        decision: rule.decision,
        matchedRule: rule.id,
        reason: rule.reason,
      }
    }
  }
  // 规则集为空/全部不匹配时的兜底:更严,绝不 allow
  return { decision: 'ask', matchedRule: 'ask.fallback', reason: '无任何规则命中,兜底转人工' }
}

/**
 * 自动复核:只接受 `ask`,只对标记 `autoReviewable` 的规则生效。
 *
 * 放行条件(全部满足):
 *  - 基础结论是 ask(deny 一律原样返回,不存在降级出口);
 *  - 同一主体(`agentId ?? userId`,两者都没有则不放行);
 *  - 同一工作区(必须非空且相等);
 *  - 同一工具 + 同一规则 id(保证风险等级未被改变);
 *  - 同一目标(`scopeKey`:命令前缀/应用名);
 *  - 历史中存在**人工允许**记录,且在 `windowMs` 窗口内。
 */
export function applyAutoReview(
  base: ApprovalResult,
  request: ApprovalRequest,
  options: {
    rules?: readonly ApprovalRule[]
    history?: readonly ApprovalHistoryEntry[]
    windowMs?: number
    minRepeats?: number
    commandRiskAnalyzer?: CommandRiskAnalyzer
  } = {},
): ApprovalResult {
  // 反向例④的结构性保证:deny 不可能从这里变成 allow。
  if (base.decision !== 'ask') return base

  const rules = options.rules ?? APPROVAL_RULES
  const rule = rules.find((r) => r.id === base.matchedRule)
  if (!rule || !rule.autoReviewable) return base

  const context = request.context
  const principal = context.agentId ?? context.userId
  if (!principal) return base
  if (!context.workspaceId) return base

  const facts = computeFacts(request, options.commandRiskAnalyzer ?? DEFAULT_COMMAND_RISK_ANALYZER)
  const scopeKey = facts.commandPrefix ?? facts.appName ?? facts.tool
  const windowMs = options.windowMs ?? 10 * 60 * 1000
  const minRepeats = options.minRepeats ?? 1

  const history = options.history ?? context.history ?? []
  const matched = history.filter(
    (h) =>
      h.decision === 'allow' &&
      h.tool === request.tool &&
      h.ruleId === base.matchedRule &&
      h.workspaceId === context.workspaceId &&
      h.scopeKey === scopeKey &&
      (h.agentId ?? principal) === principal &&
      context.now - h.at <= windowMs,
  )
  if (matched.length < minRepeats) return base

  return {
    ...base,
    decision: 'allow',
    reason: `${base.reason};自动复核放行(同主体/同工作区/同规则/同目标的既往人工允许 ${matched.length} 次)`,
    autoReview: {
      ruleId: base.matchedRule,
      reason: `auto-review:${base.matchedRule}@${scopeKey}`,
    },
  }
}

/**
 * 完整判定:规则 → (仅 ask)授权记忆 → (仅 ask)自动复核。
 * 顺序刻意如此:授权记忆是**持久**的人类决定,优先于会话内自动复核;
 * 两者都只作用于 ask,deny 全程不可被触碰。
 */
export function decideApproval(
  request: ApprovalRequest,
  options: EvaluateOptions & { windowMs?: number; minRepeats?: number } = {},
): ApprovalResult {
  const base = evaluateRules(request, options)
  if (base.decision !== 'ask') return base

  const facts =
    options.facts ??
    computeFacts(request, options.commandRiskAnalyzer ?? DEFAULT_COMMAND_RISK_ANALYZER)
  const grant = findMatchingGrant(request, facts)
  if (grant) {
    return {
      ...base,
      decision: 'allow',
      reason: `${base.reason};授权记忆命中(${grant.id},scope=${grant.scope},expiresAt=${grant.expiresAt})`,
      grant: { id: grant.id, reason: `grant:${grant.id}` },
    }
  }

  return applyAutoReview(base, request, {
    rules: options.rules,
    history: options.history ?? request.context.history,
    windowMs: options.windowMs,
    minRepeats: options.minRepeats,
    commandRiskAnalyzer: options.commandRiskAnalyzer,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
