// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui tui` —— 全屏终端界面的命令入口(以及 chat/REPL 入口的 IHUI_TUI=1 分支)。
 *
 * 默认档:**旧精简行模式(legacy)**。全屏必须显式开启(`ihui tui`,或 IHUI_TUI=1)。
 * 为什么不是默认接管:见 `../tui/fullscreen/capability.js` 的 `DEFAULT_MODE_NOTE` ——
 * 换默认渲染会改变所有现存交互式调用方(ACP / 桌面 pty / e2e / 管道)的可见行为,
 * 而本票交付的是"最小可用全屏界面",不是"替换默认交互"。
 *
 * 回退开关:`IHUI_TUI=0`。判不出来(拿不到尺寸 / 不是 TTY / TERM 不保证支持)时一律
 * 回落行模式并**说明原因**,绝不"试试看"地把 ANSI chrome 灌进管道或日志。
 *
 * 界面文案档:本文件的启动/退出交代与 TUI 内的 chrome 一律 ASCII 英文。
 * 这不是偏好而是判据:AGENTS §4 与守门 70 对 `apps/cli/src` 的硬编码中文是
 * "新增即拦"(新文件的额度恒为 0),要中文得走 §19 的五语言同批流程 ——
 * 那是独立一票,不在本票范围内(已写进交付报告的未尽事项)。
 */

import { type Command, type OptionValues } from 'commander'
import { resolveEffectiveConfig } from './settings.js'
import { AgentCore, type AgentCoreOptions, type AgentEventHandler, type SendMessageResult } from '../server/agent-core.js'
import { withFullScreen, type TerminalIo } from '../tui/fullscreen/terminal.js'
import { runFullScreenSession, type ConversationHost } from '../tui/fullscreen/app.js'
import { decideFullscreenCapability, parseForced, probeTerminal, type CapabilityVerdict } from '../tui/fullscreen/capability.js'

/**
 * `AgentCore` 在本票里被用到的那一小片面。
 * 刻意写成结构接口而不是直接收 `AgentCore`:单测要能注入一个假 core 来断言
 * "cancel() 真的把 signal 打断了",而真造一个 AgentCore 会去读配置并联网。
 * (不用 `as never` 糊过去 —— 那等于让类型系统在这条断言上闭眼。)
 */
export interface CoreLike {
  sendMessage(
    text: string,
    onEvent: AgentEventHandler,
    opts?: { sessionId?: string; signal?: AbortSignal },
  ): Promise<SendMessageResult>
  cancel(sessionId: string): void
}

/** 把 AgentCore 收成本票的宿主接口:只暴露"发一句 / 取消 / 释放"。 */
export function createLocalHost(core: CoreLike, initialSessionId?: string): ConversationHost {
  let sessionId = initialSessionId
  let active: AbortController | null = null
  return {
    async send(text, onEvent: AgentEventHandler, signal: AbortSignal) {
      // 两个 abort 源:TUI 交下来的 signal 与宿主自己的 cancel()。
      // 用中继而不是把 signal 直接递给 core —— cancel() 要能独立打断一次已经发出的请求。
      const ctrl = new AbortController()
      const relay = (): void => ctrl.abort()
      if (signal.aborted) ctrl.abort()
      else signal.addEventListener('abort', relay, { once: true })
      active = ctrl
      try {
        const result = await core.sendMessage(text, onEvent, { sessionId, signal: ctrl.signal })
        sessionId = result.sessionId
      } finally {
        signal.removeEventListener('abort', relay)
        active = null
      }
    },
    cancel() {
      active?.abort()
      if (sessionId) core.cancel(sessionId)
    },
    async dispose() {
      /* AgentCore 自己落盘会话(createSession / saveSession),这里没有需要释放的句柄 */
    },
  }
}

export interface FullScreenRunRequest {
  /** 已解析好的有效配置(与 REPL 走同一个出口 `resolveEffectiveConfig`,不在这里重算) */
  apiUrl: string
  apiKey?: string
  model: string
  workspacePath: string
  maxIterations: number
  permissionMode?: AgentCoreOptions['permissionMode']
  enableMcp?: boolean
  allowDangerous?: boolean
  sessionId?: string
  /**
   * 入口自检:本次请求里**全屏宿主还接不住**的能力(逐条点名,不说"暂不支持"这种空话)。
   * 为什么必须有这一格:`--tools` / `--disallowed-tools` 与 `--plan` 是安全相关的入参,
   * 而 AgentCore 的构造面不收它们(只有 runToolLoop 收)。若 IHUI_TUI=1 就把这些请求
   * 接过来,等于"用户点了限制、我们悄悄不限制" —— 那是 fail-open,不是少个功能。
   */
  declined?: string[]
  /** 注入便于测试;默认取 process.stdin / process.stdout */
  io?: TerminalIo
  /** 注入便于测试;默认现读环境后由能力判定给出 */
  verdict?: CapabilityVerdict
}

/** 被点名的能力若存在,给出"交回行模式"的理由;undefined 表示全屏接得住这一单。 */
export function declineReasonFor(req: FullScreenRunRequest): string | undefined {
  return req.declined && req.declined.length > 0
    ? `fullscreen host does not honour: ${req.declined.join(', ')} (line mode does)`
    : undefined
}

export interface FullScreenRunOutcome {
  ran: boolean
  /** 未跑时的原因(必须报给用户,不得静默回落) */
  reason?: string
  /** 退出原因(ran=true 时) */
  note?: string
}

/** 命令入口用:把已解析配置交给全屏宿主,返回"是否真跑了 + 原因"。 */
export async function runFullScreenIfCapable(req: FullScreenRunRequest): Promise<FullScreenRunOutcome> {
  const io: TerminalIo = req.io ?? { stdin: process.stdin, stdout: process.stdout }
  // 先判"接不接得住",再判"终端画不画得了":安全相关的限制接不住时必须交回行模式,
  // 不能让一次能力探测的绿灯盖过"用户的 --tools 被丢了"这件事。
  const declined = declineReasonFor(req)
  if (declined) return { ran: false, reason: declined }
  const probed = probeTerminal()
  const verdict = req.verdict ?? decideFullscreenCapability(probed.env, probed.tty)
  if (verdict.kind !== 'supported') return { ran: false, reason: verdict.reason }

  const coreOpts: AgentCoreOptions = {
    workspacePath: req.workspacePath,
    model: req.model,
    apiUrl: req.apiUrl,
    apiKey: req.apiKey,
    maxIterations: req.maxIterations,
    permissionMode: req.permissionMode,
    enableMcp: req.enableMcp,
    allowDangerous: req.allowDangerous,
  }
  const core = new AgentCore(coreOpts)
  let initialHistory: readonly { role: string; content: string }[] | undefined
  if (req.sessionId) {
    const resumed = await core.resumeSession(req.sessionId)
    if (resumed) initialHistory = resumed.history.map((m) => ({ role: m.role, content: m.content }))
  }
  const note = await withFullScreen(io, (term) =>
    runFullScreenSession({
      term,
      host: createLocalHost(core, req.sessionId),
      header: {
        model: req.model,
        workspace: baseName(req.workspacePath),
        session: req.sessionId ? req.sessionId.slice(-6) : '',
        permissionMode: req.permissionMode ?? 'default',
      },
      size: verdict.size,
      color: verdict.color,
      initialHistory,
    }),
  )
  return { ran: true, note }
}

/** 工作区显示名:只取最后一段,不在顶栏暴露整条绝对路径(共享工作区常有他人路径)。 */
function baseName(p: string): string {
  const parts = p.split(/[\\/]+/).filter((s) => s !== '')
  return parts[parts.length - 1] ?? p
}

/** 退出后要说的那句话 —— 打在 alt-screen 之外,用户退出时不该看到一片空白。 */
export function formatExitNotice(outcome: FullScreenRunOutcome): string {
  if (!outcome.ran) {
    return `fullscreen not started: ${outcome.reason ?? 'unknown'} — still in line mode (run \`ihui tui\` in a real terminal, or set IHUI_TUI=1)`
  }
  return `left fullscreen (${outcome.note ?? 'quit'}); terminal state restored`
}

/**
 * chat / REPL 入口的全屏分支:`IHUI_TUI=1` 时接管,否则交回 startREPL。
 * 返回 false 表示"没跑全屏",调用方继续走行模式 —— 回落原因必须打印,不得静默换人。
 */
export async function tryFullScreenFromEnv(req: FullScreenRunRequest, say: (line: string) => void = (l) => console.log(l)): Promise<boolean> {
  if (parseForced(process.env.IHUI_TUI) !== 'on') return false
  const outcome = await runFullScreenIfCapable(req)
  if (!outcome.ran) say(formatExitNotice(outcome))
  return outcome.ran
}

/** 把 commander 的 OptionValues 收成宿主请求:配置解析与 REPL 走同一个出口。 */
export function toFullScreenRequest(opts: OptionValues): FullScreenRunRequest {
  const cfg = resolveEffectiveConfig({
    cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
    cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
    cliModel: typeof opts.model === 'string' ? opts.model : undefined,
    cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
    cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
    cliMcp: opts.mcp === true ? true : undefined,
    cliPermissionMode: typeof opts.permissionMode === 'string' ? opts.permissionMode : undefined,
  })
  return {
    apiUrl: cfg.apiUrl,
    apiKey: cfg.apiKey,
    model: cfg.model,
    workspacePath: typeof opts.workspace === 'string' ? opts.workspace : process.cwd(),
    maxIterations: cfg.maxIterations,
    permissionMode: cfg.permissionMode,
    enableMcp: cfg.enableMcp,
    allowDangerous: cfg.allowDangerous,
    sessionId: typeof opts.session === 'string' ? opts.session : undefined,
  }
}

export function registerTuiCommand(program: Command): void {
  program
    .command('tui')
    .description('Fullscreen terminal UI (alt-screen): input / streaming transcript / tools & status / key hints')
    // 选项说明一律 ASCII 英文:新文件没有硬编码中文额度(守门 70 按文件比 HEAD 存量,
    // 新文件的额度恒为 0),要中文得走 §19 五语言同批流程 —— 已列为未尽事项。
    .option('-w, --workspace <path>', 'Workspace path', process.cwd())
    .option('-m, --model <model>', 'Model id')
    .option('--api-url <url>', 'Backend API url')
    .option('--api-key <key>', 'API key')
    .option('--max-iterations <n>', 'Max iterations per turn')
    .option('--permission-mode <mode>', 'default|acceptEdits|bypassPermissions|plan|manual')
    .option('--mcp', 'Load MCP tools')
    .option('--allow-dangerous', 'Allow dangerous tools')
    .option('--session <id>', 'Resume a session (history projected read-only)')
    .action(async (opts: OptionValues) => {
      // 子命令本身 = 显式请求全屏,但能力判定仍然要过:环境不满足时如实说"没跑",
      // 而不是进去之后画一屏乱码。
      const outcome = await runFullScreenIfCapable(toFullScreenRequest(opts))
      console.log(formatExitNotice(outcome))
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
