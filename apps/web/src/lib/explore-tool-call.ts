// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 工具调用三分类纯函数(2026-09-30 立,吸收批次 74 W1 票 G-977965)。
 *
 * 机制(吸收自上游 shell 工具三分类判据,命名与协议按我方重写):
 *  - 命令多形态提取:string / `-lc` 数组取下一位 / 数组 join / `{cmd}` 记录;
 *    记录形态在 command|cmd|script|parsed_cmd 四个惯用键里采集,切段后 Set 去重;
 *  - shell 解包:`(/bin/)?(zsh|bash|sh) -lc` 与 `powershell|pwsh -command|-c` 剥壳,
 *    并剥成对包裹引号,否则判据只看得见壳看不见真实命令;
 *  - `&&`/`||`/`;` 分段后逐段判:任一段命中写黑名单/重定向即整体否决;
 *  - 决策序:写文件族 → 永非探查;读/搜索/探查族 → 即探查;shell 族 →
 *    先否决(写命令/重定向)再认定(只读白名单);白名单不锚定词首,
 *    因此 for/while 循环包裹的只读探查(批量 cat README、递归扫目录)同样命中;
 *  - execute = shell 族且非等待输入(提取不到任何命令 = 还没补命令)且非探查。
 */

export interface AgentToolCallShape {
  /** 工具种类词元(read / write / execute / bash / search / explore 等) */
  kind?: string | null
  /** 工具入参,形态不定:string / string[] / 记录 / 记录数组 */
  input?: unknown
}

export type AgentToolFamily =
  | 'file-read'
  | 'file-write'
  | 'search'
  | 'explore'
  | 'shell'
  | 'other'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 词元归一:大小写与空格/连字符差异不参与族判定 */
function normalizeFamilyToken(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? ''
}

/**
 * 按词元边界归族(下划线或结尾截断,避免 readme_wizard 这类普通名字误判)。
 * 只认通用动词词元,不绑任何产品工具名册;未知词元一律 other,由调用方自行兜底。
 */
export function resolveToolCallFamily(kind: string | null | undefined): AgentToolFamily {
  const token = normalizeFamilyToken(kind)
  if (token.length === 0) {
    return 'other'
  }
  if (/^(?:read|view|open|cat|head|tail|read_file)(?:_|$)/.test(token)) {
    return 'file-read'
  }
  if (/(?:^|_)(?:edit|patch|replace|multi_edit|multiedit|write|create|save|apply_patch)(?:_|$)/.test(token)) {
    return 'file-write'
  }
  if (/^(?:execute|run|exec|bash|shell|command|terminal|powershell|pwsh|cmd)(?:_|$)/.test(token)) {
    return 'shell'
  }
  if (/^(?:search|grep|find|fetch|web_search|web_fetch|query|lookup|glob|list|ls|dir|tree)(?:_|$)/.test(token)) {
    return 'search'
  }
  if (/^(?:explore|inspect)(?:_|$)/.test(token)) {
    return 'explore'
  }
  return 'other'
}

/** 按 shell 逻辑分隔符切段:每段独立参与判据,一段写即整体否决 */
function splitCommandSegments(command: string): string[] {
  return command
    .split(/&&|\|\||;/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

/**
 * shell 解包:`(/bin/)?(zsh|bash|sh) -lc <cmd>` 与 `powershell|pwsh -command|-c <cmd>`
 * 只是把真实命令包了一层壳;剥壳后还要剥一层成对包裹引号才见得到真实分段与重定向。
 */
function unwrapShellWrapper(command: string): string {
  const trimmed = command.trim()
  const stripPairedQuotes = (value: string): string => {
    const normalized = value.trim()
    if (
      (normalized.startsWith('"') && normalized.endsWith('"') && normalized.length >= 2) ||
      (normalized.startsWith("'") && normalized.endsWith("'") && normalized.length >= 2)
    ) {
      return normalized.slice(1, -1).trim()
    }
    return normalized
  }

  const posixShellMatch = trimmed.match(/^(?:\/bin\/)?(?:zsh|bash|sh)\s+-lc\s+([\s\S]+)$/i)
  if (posixShellMatch?.[1]) {
    return stripPairedQuotes(posixShellMatch[1])
  }

  const powershellMatch = trimmed.match(
    /^(?:powershell(?:\.exe)?|pwsh(?:\.exe)?)\b[\s\S]*?\s-(?:command|c)\s+([\s\S]+)$/i,
  )
  if (powershellMatch?.[1]) {
    return stripPairedQuotes(powershellMatch[1])
  }

  return trimmed
}

/** 记录形态入参的四个惯用命令键 */
const COMMAND_FIELD_KEYS = ['command', 'cmd', 'script', 'parsed_cmd'] as const

/**
 * 多形态命令提取,返回切段去重后的命令段列表。
 * 提取不到任何命令段(空串/空壳 `bash -lc ""`)→ 空数组 = 该调用还在等待补命令。
 */
export function extractShellCommands(input: unknown): string[] {
  const candidates: string[] = []

  const collectFromValue = (value: unknown): void => {
    if (typeof value === 'string') {
      const command = value.trim()
      if (command.length > 0) {
        candidates.push(command)
      }
      return
    }

    if (!Array.isArray(value)) {
      return
    }

    if (value.every((item) => typeof item === 'string')) {
      const parts = value as string[]
      // `['bash', '-lc', 'rg foo']` 形态:真实命令在 -lc 的下一位,join 会掺进壳名
      const shellFlagIndex = parts.findIndex((part) => part === '-lc')
      if (shellFlagIndex >= 0 && typeof parts[shellFlagIndex + 1] === 'string') {
        const shellCommand = parts[shellFlagIndex + 1]!.trim()
        if (shellCommand.length > 0) {
          candidates.push(shellCommand)
          return
        }
      }
      const joined = parts.join(' ').trim()
      if (joined.length > 0) {
        candidates.push(joined)
      }
      return
    }

    // 记录数组形态:逐条取 cmd 字段
    for (const item of value) {
      if (!isPlainRecord(item)) {
        continue
      }
      const entryCommand = item.cmd
      if (typeof entryCommand === 'string' && entryCommand.trim().length > 0) {
        candidates.push(entryCommand.trim())
      }
    }
  }

  collectFromValue(input)
  if (isPlainRecord(input)) {
    for (const key of COMMAND_FIELD_KEYS) {
      collectFromValue(input[key])
    }
  }

  return Array.from(
    new Set(candidates.flatMap((candidate) => splitCommandSegments(unwrapShellWrapper(candidate)))),
  )
}

/**
 * 只读白名单:常见查看/搜索命令 + PowerShell 只读别名 + `git status|log|show|diff`。
 * 刻意不锚定词首——管道/循环/子命令里出现只读命令同样算探查,
 * 这同时覆盖了 for/while 循环包裹的只读探查(如 `for f in *.md; do cat $f; done`)。
 */
const READ_ONLY_COMMAND_RE =
  /\b(?:rg|grep|find|ls|cat|head|tail|wc|stat|pwd|which|readlink|tree|sed\s+-n|get-childitem|gci|dir|get-content|gc|type|select-string|sls|get-location|test-path|resolve-path)\b|^git\s+(?:status|log|show|diff)\b/i

/**
 * 写黑名单:原位改写(sed -i / perl -pi)、落盘(tee/out-file)、增删移动、权限,
 * 以及一切改 git 状态的子命令。命中任一即整体否决探查判定。
 */
const WRITE_COMMAND_RE =
  /\b(?:sed\s+-i|perl\s+-pi|tee|mv|cp|rm|mkdir|rmdir|touch|truncate|chmod|chown|remove-item|del|erase|set-content|add-content|clear-content|out-file|new-item|move-item|copy-item|rename-item|set-item)\b|^git\s+(?:add|commit|rm|mv|checkout|switch|restore|reset|clean|revert|cherry-pick|merge|rebase)\b/i

/**
 * 重定向即写:`>` / `>>` / `&>` 都会把输出落到盘上,视同写命令否决探查。
 * `[^\d<]` 守卫让 `2>` 这类 fd 重定向不计(只改输出流向不落新文件)。
 */
const REDIRECT_WRITE_RE = /(^|[^\d<])>>?\s*\S|&>\s*\S/i

/** shell 族且提取不到任何命令 = 调用还在等待补命令,不算执行也不算探查 */
export function isShellToolCallAwaitingCommand(call: AgentToolCallShape): boolean {
  return (
    resolveToolCallFamily(call.kind) === 'shell' && extractShellCommands(call.input).length === 0
  )
}

/** 探查判定:只读语义的工具调用(看代码/搜内容/探目录) */
export function isExploreToolCall(call: AgentToolCallShape): boolean {
  const family = resolveToolCallFamily(call.kind)

  // 写文件族永远不是探查,即使入参里带了命令形态的字段
  if (family === 'file-write') {
    return false
  }

  if (family === 'file-read' || family === 'search' || family === 'explore') {
    return true
  }

  if (family !== 'shell') {
    return false
  }

  const commands = extractShellCommands(call.input)
  if (commands.length === 0) {
    return false
  }

  // 决策序:先否决(任一段写命令/重定向),再认定(命中只读白名单)
  if (commands.some((command) => WRITE_COMMAND_RE.test(command))) {
    return false
  }
  if (commands.some((command) => REDIRECT_WRITE_RE.test(command))) {
    return false
  }
  return commands.some((command) => READ_ONLY_COMMAND_RE.test(command))
}

/**
 * 执行判定 = shell 族 且 非等待输入(无命令 = 还没补命令,不是执行) 且 非探查。
 * 其余族(读/写/搜索/探查/未知)一律不是 execute。
 */
export function isExecuteToolCall(call: AgentToolCallShape): boolean {
  return (
    resolveToolCallFamily(call.kind) === 'shell' &&
    !isShellToolCallAwaitingCommand(call) &&
    !isExploreToolCall(call)
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
