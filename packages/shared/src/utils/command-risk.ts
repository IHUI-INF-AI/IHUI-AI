// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * command-risk —— 命令风险的 AST 语义判定(2026-11-04 立)
 *
 * 与旧的 `dangerous-command-detector.ts`(逐条正则扫原文)的根本差别:
 * - 旧实现不知道"字符串里的 `rm -rf`"和"真的执行 rm"的区别,既误杀
 *   `git log --grep='rm -rf'`,又漏掉 `echo aGVsbG8= | base64 -d | bash`。
 * - 本模块先把命令行切成词法单元 → 还原管道 / `&&` / `;` / 子 shell / 命令替换的
 *   结构 → 只在"可执行位置"上判定,并给出命中节点的偏移与路径。
 *
 * 设计约束(与仓库纪律一致):
 * - 纯函数、零 IO、确定性:同输入恒同输出,不读环境变量、不访问网络。
 * - 不引入第三方 shell 解析库(避免 license 与供应链面),词法/语法由本文件自实现;
 *   覆盖 POSIX sh 的常用子集,不追求完整 grammar(heredoc 体、case/for 语句按普通词处理)。
 * - 判定必须给依据:`reasons[].code` 是稳定契约,新增语义只能新增 code,不得复用改写语义。
 * - 收敛方向:宁可 needs-approval 让人复核,不做"看起来像危险"就直接 blocked;
 *   blocked 只留给"执行即不可逆/已确认远程代码执行"的形态。
 */

/** 判定档位:blocked 直接拒绝;needs-approval 需人工确认;safe 放行 */
export type RiskLevel = 'safe' | 'needs-approval' | 'blocked'

/** 稳定的判定依据码(可被测试与调用方断言) */
export type RiskCode =
  | 'PARSE_UNBALANCED_QUOTE'
  | 'NESTING_TOO_DEEP'
  | 'DOWNLOAD_PIPE_EXEC'
  | 'DECODE_PIPE_EXEC'
  | 'DOWNLOAD_TO_INTERPRETER'
  | 'INTERPRETER_INLINE_CODE'
  | 'INLINE_STRING_COMMAND'
  | 'EVAL_USAGE'
  | 'SUDO_ESCALATION'
  | 'RM_RECURSIVE_FORCE'
  | 'RM_ROOT_OR_HOME'
  | 'RM_NO_PRESERVE_ROOT'
  | 'SENSITIVE_FILE_DELETE'
  | 'DD_WRITE_DEVICE'
  | 'MKFS_DISK'
  | 'REDIRECT_DEVICE'
  | 'PERSIST_WRITE'
  | 'PERSIST_SSH_KEY'
  | 'CHMOD_WORLD_WRITABLE'
  | 'CHOWN_OWNERSHIP'
  | 'SSH_REMOTE'
  | 'REMOTE_TRANSFER'
  | 'REVERSE_SHELL'
  | 'FORCE_PUSH_PROTECTED'

/** 段之间的连接方式(pipline / 逻辑运算 / 顺序执行 / 子 shell) */
export type SegmentConnector =
  'start' | 'pipe' | 'and' | 'or' | 'sequential' | 'background' | 'subshell'

/** 命中节点在原始命令串中的位置与结构化路径 */
export interface AstNodePosition {
  /** 左闭右开偏移(基于 analyzeCommandRisk 入参原始字符串) */
  start: number
  end: number
  /** 命中源码片段(截断 120 字符) */
  text: string
  /** 根到该节点的路径,如 `seg[2].arg[1]` / `seg[0].sub[0].seg[1]` */
  path: string
}

/** 单条判定依据 */
export interface RiskReason {
  code: RiskCode
  /** 人类可读说明(中文,含被判定对象) */
  message: string
  level: Exclude<RiskLevel, 'safe'>
  node: AstNodePosition
}

/** 每段的判定摘要 */
export interface SegmentReport {
  index: number
  connector: SegmentConnector
  raw: string
  level: RiskLevel
  reasons: RiskReason[]
  commands: { name: string; args: string[]; redirects: string[] }[]
  /** 子 shell / 命令替换展开出的嵌套段 */
  nested: SegmentReport[]
}

export interface RiskReport {
  level: RiskLevel
  reasons: RiskReason[]
  segments: SegmentReport[]
}

// ───────────────────────────── 词法 ──────────────────────────────

interface SubstitutionRef {
  kind: 'command-substitution' | 'backtick'
  /** `$(` 或反引号起点的绝对偏移 */
  start: number
  /** 右括号/反引号之后一位的绝对偏移 */
  end: number
  /** 脚本体首字符的绝对偏移 */
  bodyStart: number
  body: string
}

interface WordToken {
  kind: 'word'
  raw: string
  /** 去引号后的值(命令替换保留原样,便于二次解析) */
  value: string
  start: number
  end: number
  quoted: boolean
  substitutions: SubstitutionRef[]
}

interface OpToken {
  kind: 'op'
  op: string
  start: number
  end: number
}

interface RedirectToken {
  kind: 'redirect'
  op: string
  start: number
  end: number
}

type Token = WordToken | OpToken | RedirectToken

const MAX_AST_DEPTH = 6

const STOP_CHARS = new Set([' ', '\t', '\r', '\n', '|', '&', ';', '(', ')', '<', '>'])

function readCommandSubstitution(
  src: string,
  start: number,
): { end: number; bodyStart: number; body: string } | null {
  let depth = 1
  let i = start + 2
  let quote: "'" | '"' | null = null
  while (i < src.length) {
    const ch = src[i]!
    if (quote) {
      if (ch === '\\' && quote === '"') {
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      i += 1
      continue
    }
    if (ch === '(') depth += 1
    if (ch === ')') {
      depth -= 1
      if (depth === 0) {
        return { end: i + 1, bodyStart: start + 2, body: src.slice(start + 2, i) }
      }
    }
    i += 1
  }
  return null
}

function readBacktick(
  src: string,
  start: number,
): { end: number; bodyStart: number; body: string } | null {
  let i = start + 1
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2
      continue
    }
    if (src[i] === '`') {
      return { end: i + 1, bodyStart: start + 1, body: src.slice(start + 1, i) }
    }
    i += 1
  }
  return null
}

function readRedirect(src: string, start: number): { op: string; end: number } | null {
  const ch = src[start]
  if (ch !== '>' && ch !== '<' && !(ch === '&' && src[start + 1] === '>')) return null
  if (ch === '&') {
    const three = src.startsWith('&>>', start) ? 3 : 2
    return { op: src.slice(start, start + three), end: start + three }
  }
  const two = src.slice(start, start + 2)
  if (['>>', '<<', '<<<', '>&', '<&', '>|'].includes(two)) {
    const three = src.startsWith('<<<', start) ? 3 : 2
    return { op: src.slice(start, start + three), end: start + three }
  }
  return { op: ch, end: start + 1 }
}

/**
 * 词法扫描:引号内的运算符不切分,这是"字符串里的 rm -rf 不算命令"的结构性保证。
 */
function lex(src: string, base: number): { tokens: Token[]; unbalancedAt: number[] } {
  const tokens: Token[] = []
  const unbalancedAt: number[] = []
  let i = 0
  const atTokenStart = (): boolean => {
    const prev = tokens[tokens.length - 1]
    if (!prev) return true
    return prev.kind === 'op' || prev.kind === 'redirect'
  }

  while (i < src.length) {
    const ch = src[i]!
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1
      continue
    }
    if (ch === '\n') {
      tokens.push({ kind: 'op', op: '\n', start: base + i, end: base + i + 1 })
      i += 1
      continue
    }
    if (ch === '#' && atTokenStart()) {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }

    // 逻辑运算符
    const two = src.slice(i, i + 2)
    const opLen: Record<string, number> = {
      '&&': 2,
      '||': 2,
      '|&': 2,
      '|': 1,
      ';': 1,
      '&': 1,
      '(': 1,
      ')': 1,
    }
    if (opLen[two] !== undefined && (two === '&&' || two === '||' || two === '|&')) {
      tokens.push({ kind: 'op', op: two, start: base + i, end: base + i + 2 })
      i += 2
      continue
    }
    if (opLen[ch] !== undefined) {
      tokens.push({ kind: 'op', op: ch, start: base + i, end: base + i + 1 })
      i += 1
      continue
    }

    // 重定向(可带 fd 数字前缀)
    let redirectAt = i
    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < src.length && /[0-9]/.test(src[j]!)) j += 1
      if (src[j] === '>' || src[j] === '<') redirectAt = j
      else redirectAt = -1
    }
    const redirect =
      redirectAt >= 0 && (redirectAt !== i || ch === '>' || ch === '<')
        ? readRedirect(src, redirectAt)
        : null
    if (redirect && redirectAt >= 0) {
      tokens.push({
        kind: 'redirect',
        op: src.slice(i, redirect.end),
        start: base + i,
        end: base + redirect.end,
      })
      i = redirect.end
      continue
    }

    // 普通词
    const start = i
    let value = ''
    let raw = ''
    let quoted = false
    const substitutions: SubstitutionRef[] = []

    while (i < src.length) {
      const c = src[i]!
      if (STOP_CHARS.has(c)) break

      if (c === "'") {
        quoted = true
        const close = src.indexOf("'", i + 1)
        if (close < 0) {
          unbalancedAt.push(base + i)
          value += src.slice(i + 1)
          raw += src.slice(i)
          i = src.length
          break
        }
        value += src.slice(i + 1, close)
        raw += src.slice(i, close + 1)
        i = close + 1
        continue
      }

      if (c === '"') {
        quoted = true
        const quoteStart = i
        i += 1
        let closed = false
        while (i < src.length) {
          const d = src[i]!
          if (d === '\\' && i + 1 < src.length) {
            const next = src[i + 1]!
            if (next === '"' || next === '\\' || next === '$' || next === '`') value += next
            else value += `\\${next}`
            i += 2
            continue
          }
          if (d === '"') {
            i += 1
            closed = true
            break
          }
          if (d === '$' && src[i + 1] === '(') {
            const sub = readCommandSubstitution(src, i)
            if (!sub) {
              unbalancedAt.push(base + i)
              i = src.length
              break
            }
            substitutions.push({
              kind: 'command-substitution',
              start: base + i,
              end: base + sub.end,
              bodyStart: base + sub.bodyStart,
              body: sub.body,
            })
            value += src.slice(i, sub.end)
            i = sub.end
            continue
          }
          if (d === '`') {
            const sub = readBacktick(src, i)
            if (!sub) {
              unbalancedAt.push(base + i)
              i = src.length
              break
            }
            substitutions.push({
              kind: 'backtick',
              start: base + i,
              end: base + sub.end,
              bodyStart: base + sub.bodyStart,
              body: sub.body,
            })
            value += src.slice(i, sub.end)
            i = sub.end
            continue
          }
          value += d
          i += 1
        }
        if (!closed) unbalancedAt.push(base + quoteStart)
        raw += src.slice(quoteStart, i)
        continue
      }

      if (c === '\\') {
        if (i + 1 < src.length) {
          value += src[i + 1]
          raw += src.slice(i, i + 2)
          i += 2
        } else {
          unbalancedAt.push(base + i)
          i += 1
        }
        continue
      }

      if (c === '$' && src[i + 1] === '(') {
        const sub = readCommandSubstitution(src, i)
        if (!sub) {
          unbalancedAt.push(base + i)
          value += src.slice(i)
          raw += src.slice(i)
          i = src.length
          break
        }
        substitutions.push({
          kind: 'command-substitution',
          start: base + i,
          end: base + sub.end,
          bodyStart: base + sub.bodyStart,
          body: sub.body,
        })
        value += src.slice(i, sub.end)
        raw += src.slice(i, sub.end)
        i = sub.end
        continue
      }

      if (c === '`') {
        const sub = readBacktick(src, i)
        if (!sub) {
          unbalancedAt.push(base + i)
          value += src.slice(i)
          raw += src.slice(i)
          i = src.length
          break
        }
        substitutions.push({
          kind: 'backtick',
          start: base + i,
          end: base + sub.end,
          bodyStart: base + sub.bodyStart,
          body: sub.body,
        })
        value += src.slice(i, sub.end)
        raw += src.slice(i, sub.end)
        i = sub.end
        continue
      }

      value += c
      raw += c
      i += 1
    }

    if (i === start) {
      // 理论上不可达;防御性推进,避免死循环
      i += 1
      continue
    }
    tokens.push({
      kind: 'word',
      raw,
      value,
      start: base + start,
      end: base + i,
      quoted,
      substitutions,
    })
  }

  return { tokens, unbalancedAt }
}

// ───────────────────────────── 语法 ──────────────────────────────

interface InternalSegment {
  connector: SegmentConnector
  start: number
  end: number
  raw: string
  words: WordToken[]
  redirects: { token: RedirectToken; target?: WordToken }[]
  nested: InternalSegment[]
}

function connectorOf(op: string): SegmentConnector {
  if (op === '|' || op === '|&') return 'pipe'
  if (op === '&&') return 'and'
  if (op === '||') return 'or'
  if (op === '&') return 'background'
  return 'sequential'
}

function parseTokens(tokens: Token[], text: string, base: number): InternalSegment[] {
  const segments: InternalSegment[] = []
  let words: WordToken[] = []
  let redirects: { token: RedirectToken; target?: WordToken }[] = []
  let nested: InternalSegment[] = []
  let start = -1
  let end = -1
  let connector: SegmentConnector = 'start'
  let awaitingRedirect: { token: RedirectToken; target?: WordToken } | null = null

  const touch = (tok: Token): void => {
    if (start < 0) start = tok.start
    end = tok.end
  }

  const flush = (): void => {
    if (words.length === 0 && redirects.length === 0 && nested.length === 0) {
      start = -1
      end = -1
      return
    }
    segments.push({
      connector,
      start: start < 0 ? 0 : start,
      end: end < 0 ? 0 : end,
      raw: start >= 0 && end > start ? text.slice(start - base, end - base) : '',
      words,
      redirects,
      nested,
    })
    words = []
    redirects = []
    nested = []
    start = -1
    end = -1
  }

  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]!
    if (tok.kind === 'op') {
      if (tok.op === '(') {
        flush()
        const close = findMatchingParen(tokens, i)
        const innerTokens = tokens.slice(i + 1, close)
        const inner = parseTokens(innerTokens, text, base)
        const openStart = tok.start
        const openEnd = close < tokens.length ? tokens[close]!.end : tok.end
        segments.push({
          connector: 'subshell',
          start: openStart,
          end: openEnd,
          raw: text.slice(openStart - base, openEnd - base),
          words: [],
          redirects: [],
          nested: inner,
        })
        connector = 'sequential'
        i = close + 1
        continue
      }
      if (tok.op === ')') {
        i += 1
        continue
      }
      flush()
      connector = connectorOf(tok.op)
      i += 1
      continue
    }
    if (tok.kind === 'redirect') {
      touch(tok)
      const entry: { token: RedirectToken; target?: WordToken } = { token: tok }
      redirects.push(entry)
      awaitingRedirect = entry
      i += 1
      continue
    }
    touch(tok)
    words.push(tok)
    if (awaitingRedirect) {
      awaitingRedirect.target = tok
      awaitingRedirect = null
    }
    i += 1
  }
  flush()
  return segments
}

function findMatchingParen(tokens: Token[], openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < tokens.length; i += 1) {
    const tok = tokens[i]!
    if (tok.kind !== 'op') continue
    if (tok.op === '(') depth += 1
    if (tok.op === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return tokens.length
}

// ───────────────────────────── 分析 ──────────────────────────────

interface Ctx {
  source: string
  reasons: RiskReason[]
}

interface ParsedResult {
  segments: SegmentReport[]
  firstExec: string | null
}

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'ash', 'fish'])
const INTERPRETERS = new Set([
  'python',
  'python3',
  'node',
  'nodejs',
  'bun',
  'deno',
  'perl',
  'ruby',
  'php',
  'lua',
])
const REMOTE_FETCHERS = new Set(['curl', 'wget', 'aria2c', 'fetch', 'http', 'https'])
const WRAPPERS = new Set([
  'sudo',
  'doas',
  'pkexec',
  'env',
  'command',
  'builtin',
  'exec',
  'nohup',
  'nice',
  'ionice',
  'chrt',
  'stdbuf',
  'time',
  'timeout',
  'setsid',
  'watch',
  'xargs',
])

const OPTION_TAKES_VALUE = new Set([
  '-n',
  '-u',
  '-g',
  '-p',
  '-o',
  '-e',
  '-i',
  '-f',
  '-j',
  '-l',
  '--user',
  '--group',
  '--delay',
  '--exec',
])

const SENSITIVE_MARKERS = [
  '.env',
  '.git',
  '.pem',
  '.key',
  'credentials',
  'secret',
  'token',
  'id_rsa',
]
const DEVICE_PATH_RE = /^\/dev\/(sd|hd|vd|nvme|mmcblk|md|loop|disk\/by-|mapper\/)/i
const SHELL_RC_RE =
  /^(?:~|~\/|\/root\/)(?:\.bashrc|\.bash_profile|\.bash_login|\.zshrc|\.zprofile|\.profile|\.config\/fish\/config\.fish)$/
const SYSTEM_PERSIST_RE =
  /^\/etc\/(?:profile|bash\.bashrc|zshrc|rc\.local|crontab|cron\.d\/|cron\/|systemd\/|init\.d\/|sudoers|passwd|shadow|ssh\/sshd_config)/
const AUTH_KEYS_RE = /^(?:~|\/root)\/\.ssh\/authorized_keys$/

function executableOf(word: WordToken | undefined): string | null {
  if (!word) return null
  if (word.substitutions.length > 0) return null
  let name = word.value.trim()
  if (!name) return null
  name = name.replace(/\\/g, '/').split('/').pop() ?? ''
  name = name.toLowerCase()
  if (name.endsWith('.exe')) name = name.slice(0, -4)
  return name || null
}

function isOptionLike(value: string): boolean {
  return value.startsWith('-') && value !== '-'
}

function stripQuotes(value: string): string {
  const v = value.trim()
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1)
  }
  return v
}

function expandHome(value: string): string {
  const v = stripQuotes(value)
  return v.replace(/^\$\{?HOME\}?/, '~')
}

function isRootTarget(target: string): boolean {
  const norm = expandHome(target).replace(/\/+$/, '') || '/'
  return norm === '/' || norm === '/*' || norm === '~' || norm === '~/*'
}

function clip(text: string, limit = 120): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function nodeOf(start: number, end: number, path: string, source: string): AstNodePosition {
  return { start, end, text: clip(source.slice(start, end)), path }
}

function addReason(
  list: RiskReason[],
  ctx: Ctx,
  code: RiskCode,
  level: Exclude<RiskLevel, 'safe'>,
  message: string,
  node: AstNodePosition,
): void {
  if (list.some((r) => r.code === code && r.node.start === node.start && r.node.end === node.end)) {
    return
  }
  const reason: RiskReason = { code, message, level, node }
  list.push(reason)
  ctx.reasons.push(reason)
}

function levelRank(level: RiskLevel): number {
  return level === 'blocked' ? 2 : level === 'needs-approval' ? 1 : 0
}

function maxLevel(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>(
    (acc, cur) => (levelRank(cur) > levelRank(acc) ? cur : acc),
    'safe',
  )
}

function unwrap(words: WordToken[]): { words: WordToken[]; sudoWords: WordToken[] } {
  let rest = words
  const sudoWords: WordToken[] = []
  for (let guard = 0; guard < 6; guard += 1) {
    const name = executableOf(rest[0])
    if (!name || !WRAPPERS.has(name)) break
    const head = rest[0]!
    rest = rest.slice(1)
    if (name === 'sudo' || name === 'doas' || name === 'pkexec') {
      sudoWords.push(head)
      while (rest.length > 0 && isOptionLike(rest[0]!.value)) {
        const opt = rest[0]!.value
        rest = OPTION_TAKES_VALUE.has(opt) && rest.length > 1 ? rest.slice(2) : rest.slice(1)
      }
      continue
    }
    if (name === 'env') {
      while (
        rest.length > 0 &&
        (isOptionLike(rest[0]!.value) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0]!.value))
      ) {
        rest = rest.slice(1)
      }
      continue
    }
    if (name === 'timeout') {
      while (rest.length > 0 && isOptionLike(rest[0]!.value)) rest = rest.slice(1)
      if (rest.length > 0) rest = rest.slice(1)
      continue
    }
    while (rest.length > 0 && isOptionLike(rest[0]!.value)) {
      const opt = rest[0]!.value
      rest = OPTION_TAKES_VALUE.has(opt) && rest.length > 1 ? rest.slice(2) : rest.slice(1)
    }
  }
  return { words: rest, sudoWords }
}

function contentBaseOf(word: WordToken): number {
  const first = word.raw[0]
  if ((first === '"' || first === "'") && word.raw.length >= 2 && word.raw.endsWith(first)) {
    return word.start + 1
  }
  return word.start
}

interface StringLiteral {
  content: string
  node: AstNodePosition
}

function extractStringLiterals(
  text: string,
  base: number,
  path: string,
  source: string,
): StringLiteral[] {
  const out: StringLiteral[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      const start = i
      i += 1
      let content = ''
      while (i < text.length) {
        if (text[i] === '\\' && i + 1 < text.length) {
          content += text[i + 1]
          i += 2
          continue
        }
        if (text[i] === quote) {
          i += 1
          break
        }
        content += text[i]
        i += 1
      }
      out.push({
        content,
        node: nodeOf(base + start + 1, base + i - 1, `${path}.literal[${out.length}]`, source),
      })
    } else {
      i += 1
    }
  }
  return out
}

function analyzeRedirect(
  entry: { token: RedirectToken; target?: WordToken },
  path: string,
  ctx: Ctx,
  list: RiskReason[],
): void {
  if (!entry.token.op.includes('>')) return
  const rawTarget = entry.target?.value ?? ''
  if (!rawTarget) return
  const target = stripQuotes(rawTarget)
  const node = entry.target
    ? nodeOf(entry.target.start, entry.target.end, path, ctx.source)
    : nodeOf(entry.token.start, entry.token.end, path, ctx.source)

  if (DEVICE_PATH_RE.test(target)) {
    addReason(list, ctx, 'REDIRECT_DEVICE', 'blocked', `写入裸设备 ${target}, 会破坏磁盘数据`, node)
    return
  }
  if (AUTH_KEYS_RE.test(expandHome(target))) {
    addReason(
      list,
      ctx,
      'PERSIST_SSH_KEY',
      'blocked',
      `写入 SSH 授权公钥 ${target}, 构成持久化后门`,
      node,
    )
    return
  }
  if (SYSTEM_PERSIST_RE.test(target) || SHELL_RC_RE.test(expandHome(target))) {
    addReason(
      list,
      ctx,
      'PERSIST_WRITE',
      'needs-approval',
      `写入系统/登录持久化路径 ${target}, 会影响后续每次登录或启动`,
      node,
    )
  }
}

function analyzeSegments(
  segments: InternalSegment[],
  pathBase: string,
  ctx: Ctx,
  depth: number,
): ParsedResult {
  if (depth > MAX_AST_DEPTH) {
    const anchor = segments[0]
    if (anchor) {
      addReason(
        ctx.reasons,
        ctx,
        'NESTING_TOO_DEEP',
        'needs-approval',
        '嵌套层数超过静态判定上限, 无法完成语义判定',
        nodeOf(anchor.start, anchor.end, pathBase, ctx.source),
      )
    }
    return { segments: [], firstExec: null }
  }

  const reports: SegmentReport[] = []
  const firstExec = executableOf(unwrap(segments[0]?.words ?? []).words[0])

  for (let index = 0; index < segments.length; index += 1) {
    const seg = segments[index]!
    const path = `${pathBase}seg[${index}]`
    const report: SegmentReport = {
      index,
      connector: seg.connector,
      raw: clip(seg.raw, 240),
      level: 'safe',
      reasons: [],
      commands: [],
      nested: [],
    }
    reports.push(report)

    const effective = unwrap(seg.words).words
    if (effective.length > 0) {
      report.commands.push({
        name: executableOf(effective[0]) ?? '',
        args: effective.slice(1).map((w) => w.value),
        redirects: seg.redirects.map((r) => `${r.token.op}${r.target?.value ?? ''}`),
      })
    }

    for (const [redirectIndex, redirect] of seg.redirects.entries()) {
      analyzeRedirect(redirect, `${path}.redirect[${redirectIndex}]`, ctx, report.reasons)
    }

    analyzeCommandWords(seg.words, `${path}.arg`, ctx, report, depth)
    if (seg.nested.length > 0) {
      const nestedResult = analyzeSegments(seg.nested, `${path}.subshell.`, ctx, depth + 1)
      report.nested.push(...nestedResult.segments)
    }
    report.level = maxLevel(report.reasons.map((r) => r.level))
  }

  // 管道链语义:下载/解码结果直接交给解释器执行
  let i = 0
  while (i < segments.length) {
    let j = i
    while (j + 1 < segments.length && segments[j + 1]!.connector === 'pipe') j += 1
    if (j > i) {
      const chain = segments.slice(i, j + 1)
      for (let k = 1; k < chain.length; k += 1) {
        const stage = chain[k]!
        const stageNode = stage.words[0]
          ? nodeOf(
              stage.words[0].start,
              stage.words[0].end,
              `${pathBase}seg[${i + k}].arg[0]`,
              ctx.source,
            )
          : nodeOf(stage.start, stage.end, `${pathBase}seg[${i + k}]`, ctx.source)
        const stageExec = executableOf(unwrap(stage.words).words[0])
        if (!stageExec || !isExecutionStage(stageExec)) continue
        const upstream = chain.slice(0, k)
        const downloadStage = upstream.find((s) => stageIsDownloadOrFetched(s))
        if (downloadStage) {
          addReason(
            reportFor(reports, i + k),
            ctx,
            'DOWNLOAD_PIPE_EXEC',
            'blocked',
            `管道把远程下载内容直接交给 ${stageExec} 执行(上游 ${execNameOf(downloadStage)})`,
            stageNode,
          )
        }
        const decodeStage = upstream.find((s) => stageIsDecode(s))
        if (decodeStage) {
          addReason(
            reportFor(reports, i + k),
            ctx,
            'DECODE_PIPE_EXEC',
            'blocked',
            `管道把解码后的载荷直接交给 ${stageExec} 执行(上游 ${execNameOf(decodeStage)})`,
            stageNode,
          )
        }
        const listener = upstream.find((s) => stageIsReverseListener(s))
        if (listener) {
          addReason(
            reportFor(reports, i + k),
            ctx,
            'REVERSE_SHELL',
            'blocked',
            `网络监听端把收到的数据交给 ${stageExec} 执行, 构成反弹 shell`,
            stageNode,
          )
        }
      }
    }
    i = j + 1
  }

  // 非管道链:先下载落盘、随后立刻执行同一文件
  for (let k = 0; k < segments.length; k += 1) {
    const seg = segments[k]!
    if (seg.connector === 'pipe' || !stageIsDownload(seg)) continue
    const targets = downloadedTargets(seg)
    for (let m = k + 1; m < segments.length; m += 1) {
      const later = segments[m]!
      if (later.connector === 'pipe') continue
      const laterExec = executableOf(unwrap(later.words).words[0])
      if (!laterExec || !isExecutionStage(laterExec)) continue
      const scriptArgs = unwrap(later.words)
        .words.slice(1)
        .map((w) => stripQuotes(w.value))
        .filter((v) => !isOptionLike(v))
      const hit = scriptArgs.find(
        (arg) => targets.has(arg) || targets.has(arg.split('/').pop() ?? ''),
      )
      if (hit) {
        const word = later.words[0]!
        addReason(
          reportFor(reports, m),
          ctx,
          'DOWNLOAD_PIPE_EXEC',
          'blocked',
          `同一命令链中先下载 ${hit} 再交给 ${laterExec} 执行`,
          nodeOf(word.start, word.end, `${pathBase}seg[${m}].arg[0]`, ctx.source),
        )
      }
    }
  }

  for (const report of reports) {
    report.level = maxLevel(report.reasons.map((r) => r.level))
  }
  return { segments: reports, firstExec }
}

function reportFor(reports: SegmentReport[], index: number): RiskReason[] {
  return reports[index]?.reasons ?? []
}

function execNameOf(seg: InternalSegment): string {
  return executableOf(unwrap(seg.words).words[0]) ?? '未知命令'
}

function isExecutionStage(name: string): boolean {
  return SHELLS.has(name) || INTERPRETERS.has(name)
}

function stageIsDownload(seg: InternalSegment): boolean {
  const name = executableOf(unwrap(seg.words).words[0])
  return name !== null && REMOTE_FETCHERS.has(name)
}

function stageIsDownloadOrFetched(seg: InternalSegment): boolean {
  if (stageIsDownload(seg)) return true
  const first = unwrap(seg.words).words[0]
  if (!first) return false
  return first.substitutions.some((sub) => {
    const body = sub.body.trim()
    const nestedName = executableOf(
      lex(body, 0).tokens.find((t): t is WordToken => t.kind === 'word'),
    )
    return nestedName !== null && REMOTE_FETCHERS.has(nestedName)
  })
}

function downloadedTargets(seg: InternalSegment): Set<string> {
  const out = new Set<string>()
  const words = unwrap(seg.words).words
  for (let i = 1; i < words.length; i += 1) {
    const value = stripQuotes(words[i]!.value)
    if (value === '-o' || value === '--output' || value === '-O' || value === '--output-document') {
      const next = words[i + 1]
      if (next) out.add(stripQuotes(next.value))
    }
    if (value.startsWith('--output=')) out.add(value.slice('--output='.length))
  }
  for (const redirect of seg.redirects) {
    if (redirect.token.op.includes('>') && redirect.target) {
      out.add(stripQuotes(redirect.target.value))
    }
  }
  return out
}

function stageIsDecode(seg: InternalSegment): boolean {
  const name = executableOf(unwrap(seg.words).words[0])
  if (!name) return false
  const args = unwrap(seg.words)
    .words.slice(1)
    .map((w) => w.value)
  if (name === 'base64')
    return args.some(
      (a) => a === '-d' || a === '--decode' || (/^-.*d/.test(a) && !a.startsWith('--')),
    )
  if (name === 'xxd') return args.some((a) => a === '-r' || a === '--revert')
  if (name === 'openssl') {
    return args.includes('base64') && args.some((a) => a === '-d' || a === '-decode')
  }
  if (name === 'uudecode' || name === 'gunzip') return true
  return false
}

function stageIsReverseListener(seg: InternalSegment): boolean {
  const name = executableOf(unwrap(seg.words).words[0])
  if (!name) return false
  const args = unwrap(seg.words)
    .words.slice(1)
    .map((w) => w.value)
  if (['nc', 'ncat', 'netcat'].includes(name)) {
    return args.some(
      (a) => a === '-l' || a === '--listen' || a === '-e' || a === '--exec' || a === '-c',
    )
  }
  if (name === 'socat') {
    return args.some((a) => /^exec:|^system:/i.test(a))
  }
  return false
}

function analyzeCommandWords(
  words: WordToken[],
  pathBase: string,
  ctx: Ctx,
  report: SegmentReport,
  depth: number,
): void {
  const { words: effective, sudoWords } = unwrap(words)
  for (const [index, word] of sudoWords.entries()) {
    addReason(
      report.reasons,
      ctx,
      'SUDO_ESCALATION',
      'needs-approval',
      '通过 sudo/doas/pkexec 提权执行后续命令',
      nodeOf(word.start, word.end, `${pathBase}.sudo[${index}]`, ctx.source),
    )
  }

  // 命令替换:内部脚本按同一套语义递归判定(命令位替换等同于"执行替换结果")
  for (let index = 0; index < effective.length; index += 1) {
    const word = effective[index]!
    for (const [subIndex, sub] of word.substitutions.entries()) {
      const path = `${pathBase}[${index}].sub[${subIndex}]`
      const nested = analyzeParsedScript(sub.body, sub.bodyStart, path, ctx, depth + 1)
      report.nested.push(...nested.segments)
      if (index === 0 && nested.firstExec && REMOTE_FETCHERS.has(nested.firstExec)) {
        addReason(
          report.reasons,
          ctx,
          'DOWNLOAD_TO_INTERPRETER',
          'blocked',
          `命令替换处于命令位, 会把 ${nested.firstExec} 下载到的内容当作命令执行`,
          nodeOf(sub.start, sub.end, path, ctx.source),
        )
      }
    }
  }

  const name = executableOf(effective[0])
  if (!name) return
  const args = effective.slice(1).map((w) => w.value)
  const nameWord = effective[0]!

  if (SHELLS.has(name)) {
    const script = inlineScriptArg(args)
    if (script) {
      const word = effective[script.index + 1]
      if (word) {
        const nested = analyzeParsedScript(
          script.value,
          contentBaseOf(word),
          `${pathBase}.script`,
          ctx,
          depth + 1,
        )
        report.nested.push(...nested.segments)
        if (nested.firstExec && REMOTE_FETCHERS.has(nested.firstExec)) {
          addReason(
            report.reasons,
            ctx,
            'DOWNLOAD_TO_INTERPRETER',
            'blocked',
            `shell -c 的脚本位置是下载命令替换, 会执行远程内容`,
            nodeOf(word.start, word.end, `${pathBase}.script`, ctx.source),
          )
        }
      }
    }
    return
  }

  if (name === 'eval') {
    addReason(
      report.reasons,
      ctx,
      'EVAL_USAGE',
      'needs-approval',
      'eval 会把参数字符串当代码执行, 静态判定无法保证安全',
      nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
    )
    const firstWord = effective[1]
    if (firstWord) {
      const script = effective
        .slice(1)
        .map((w) => w.value)
        .join(' ')
      const nested = analyzeParsedScript(
        script,
        contentBaseOf(firstWord),
        `${pathBase}.eval`,
        ctx,
        depth + 1,
      )
      report.nested.push(...nested.segments)
    }
    return
  }

  const inline = interpreterInlineScript(name, args)
  if (inline !== null) {
    const word = effective[inline.index + 1]
    if (word) {
      addReason(
        report.reasons,
        ctx,
        'INTERPRETER_INLINE_CODE',
        'needs-approval',
        `${name} 以 -e/-c 内联执行任意代码`,
        nodeOf(word.start, word.end, `${pathBase}.inline`, ctx.source),
      )
      const literals = extractStringLiterals(
        inline.value,
        contentBaseOf(word),
        `${pathBase}.inline`,
        ctx.source,
      )
      for (const literal of literals) {
        const nested = analyzeParsedScript(
          literal.content,
          literal.node.start,
          literal.node.path,
          ctx,
          depth + 1,
        )
        report.nested.push(...nested.segments)
        const nestedLevel = maxLevel(nested.reasonsLevels())
        if (nestedLevel !== 'safe') {
          addReason(
            report.reasons,
            ctx,
            'INLINE_STRING_COMMAND',
            nestedLevel,
            `内联代码的字符串字面量包含可执行的危险命令: ${clip(literal.content, 60)}`,
            literal.node,
          )
        }
      }
    }
    return
  }

  if (name === 'rm') {
    analyzeRm(args, effective, `${pathBase}.arg`, ctx, report)
    return
  }
  if (name === 'dd') {
    const target = args.find((a) => a.startsWith('of='))?.slice(3) ?? ''
    if (target && DEVICE_PATH_RE.test(target) && target !== '/dev/null') {
      addReason(
        report.reasons,
        ctx,
        'DD_WRITE_DEVICE',
        'blocked',
        `dd 直接写入裸设备 ${target}`,
        nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
      )
    }
    return
  }
  if (/^mkfs(\.|$)/.test(name) || name === 'mke2fs' || name === 'wipefs') {
    const device = args.find((a) => DEVICE_PATH_RE.test(a))
    addReason(
      report.reasons,
      ctx,
      'MKFS_DISK',
      device ? 'blocked' : 'needs-approval',
      device ? `格式化裸设备 ${device}, 会清空其全部分区` : `${name} 会重建文件系统`,
      nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
    )
    return
  }
  if (name === 'chmod') {
    const nonFlags = args.filter((a) => !isOptionLike(a))
    const mode = nonFlags[0] ?? ''
    const targets = nonFlags.slice(1)
    if (['777', '0777', 'a+rwx', 'ugo+rwx', '7777', '07777'].includes(mode)) {
      const onRoot = targets.some((t) => isRootTarget(t))
      addReason(
        report.reasons,
        ctx,
        'CHMOD_WORLD_WRITABLE',
        onRoot ? 'blocked' : 'needs-approval',
        `把 ${targets.join(' ') || '目标'} 权限设为 777(所有用户可写)`,
        nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
      )
    }
    return
  }
  if (name === 'chown' || name === 'chgrp') {
    addReason(
      report.reasons,
      ctx,
      'CHOWN_OWNERSHIP',
      'needs-approval',
      `${name} 变更文件属主/属组, 可能造成提权或服务不可用`,
      nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
    )
    return
  }
  if (name === 'ssh') {
    const positional = positionalArgs(
      args,
      new Set(['-p', '-i', '-o', '-l', '-F', '-J', '-L', '-R', '-D', '-W', '-c', '-m', '-b', '-e']),
    )
    if (positional.length > 0) {
      addReason(
        report.reasons,
        ctx,
        'SSH_REMOTE',
        'needs-approval',
        `通过 SSH 在远程主机 ${positional[0]} 上执行`,
        nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
      )
    }
    return
  }
  if (name === 'scp' || name === 'sftp' || name === 'rsync') {
    if (args.some((a) => /^(?:[^:@/\s]+@)?[^:/\s]+:/.test(a) && !/^[A-Za-z]:\\/.test(a))) {
      addReason(
        report.reasons,
        ctx,
        'REMOTE_TRANSFER',
        'needs-approval',
        `${name} 与远程主机传输文件, 可能造成数据外传`,
        nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
      )
    }
    return
  }
  if (name === 'nc' || name === 'ncat' || name === 'netcat' || name === 'socat') {
    const execLike = args.some(
      (a) =>
        a === '-e' ||
        a === '--exec' ||
        a === '-c' ||
        a === '--sh-exec' ||
        /^exec:|^system:/i.test(a),
    )
    if (execLike) {
      addReason(
        report.reasons,
        ctx,
        'REVERSE_SHELL',
        'blocked',
        `${name} 把网络连接绑定到本地命令解释器, 构成反弹 shell`,
        nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
      )
    }
    return
  }
  if (name === 'crontab') {
    const positional = args.filter((a) => !isOptionLike(a))
    const hasRemove = args.includes('-r')
    if (hasRemove) {
      addReason(
        report.reasons,
        ctx,
        'PERSIST_WRITE',
        'needs-approval',
        'crontab -r 删除当前用户的全部计划任务',
        nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
      )
    } else if (positional.length > 0) {
      addReason(
        report.reasons,
        ctx,
        'PERSIST_WRITE',
        'needs-approval',
        `安装 crontab 文件 ${positional[0]}, 形成持久化定时任务`,
        nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
      )
    }
    return
  }
  if (name === 'tee') {
    for (const target of args.filter((a) => !isOptionLike(a))) {
      if (AUTH_KEYS_RE.test(expandHome(target))) {
        addReason(
          report.reasons,
          ctx,
          'PERSIST_SSH_KEY',
          'blocked',
          `通过 tee 写入 SSH 授权公钥 ${target}`,
          nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
        )
      } else if (SYSTEM_PERSIST_RE.test(target) || SHELL_RC_RE.test(expandHome(target))) {
        addReason(
          report.reasons,
          ctx,
          'PERSIST_WRITE',
          'needs-approval',
          `通过 tee 写入持久化路径 ${target}`,
          nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
        )
      }
    }
    return
  }
  if (name === 'git') {
    const pushIndex = args.indexOf('push')
    if (pushIndex >= 0) {
      const pushArgs = args.slice(pushIndex + 1)
      const force = pushArgs.some(
        (a) => a === '--force' || a === '-f' || a.startsWith('--force-with-lease'),
      )
      const protectedTarget = pushArgs.some(
        (a) => a === 'main' || a === 'master' || /^[^/]+:main$/.test(a),
      )
      if (force && protectedTarget) {
        addReason(
          report.reasons,
          ctx,
          'FORCE_PUSH_PROTECTED',
          'needs-approval',
          '强制推送会覆盖 main/master 的远端历史',
          nodeOf(nameWord.start, nameWord.end, `${pathBase}.arg[0]`, ctx.source),
        )
      }
    }
  }
}

function nestedLevelsOf(nested: ParsedResult): RiskLevel[] {
  return nested.segments.map((s) => s.level)
}

function analyzeRm(
  args: string[],
  words: WordToken[],
  pathBase: string,
  ctx: Ctx,
  report: SegmentReport,
): void {
  const flags = args.filter((a) => isOptionLike(a))
  const targets = args.filter((a) => !isOptionLike(a))
  const recursive = flags.some((f) => f === '--recursive' || isShortFlagCluster(f, 'rR'))
  const force = flags.some((f) => f === '--force' || isShortFlagCluster(f, 'f'))
  const noPreserve = flags.some((f) => f === '--no-preserve-root')
  const nameWord = words[0] ?? words.find((w) => executableOf(w) === 'rm')
  const node = nameWord
    ? nodeOf(nameWord.start, nameWord.end, `${pathBase}[0]`, ctx.source)
    : nodeOf(0, 0, pathBase, ctx.source)

  if (noPreserve) {
    addReason(
      report.reasons,
      ctx,
      'RM_NO_PRESERVE_ROOT',
      'blocked',
      'rm 携带 --no-preserve-root, 显式绕过根目录删除保护',
      node,
    )
  }
  if (targets.some((t) => isRootTarget(t))) {
    addReason(
      report.reasons,
      ctx,
      'RM_ROOT_OR_HOME',
      'blocked',
      `rm 目标包含根目录或家目录: ${targets.filter((t) => isRootTarget(t)).join(' ')}`,
      node,
    )
  } else if (recursive || force) {
    addReason(
      report.reasons,
      ctx,
      'RM_RECURSIVE_FORCE',
      'needs-approval',
      `递归/强制删除 ${targets.join(' ') || '(未指定目标)'}`,
      node,
    )
  }
  const sensitive = targets.filter((t) =>
    SENSITIVE_MARKERS.some((marker) => t.split('/').some((part) => part.includes(marker))),
  )
  if (sensitive.length > 0) {
    addReason(
      report.reasons,
      ctx,
      'SENSITIVE_FILE_DELETE',
      'needs-approval',
      `删除敏感文件 ${sensitive.join(' ')}(可能含凭据或版本库)`,
      node,
    )
  }
}

function isShortFlagCluster(flag: string, chars: string): boolean {
  if (flag.startsWith('--')) return false
  return flag
    .slice(1)
    .split('')
    .some((ch) => chars.includes(ch))
}

function positionalArgs(args: string[], optionTakesValue: Set<string>): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!
    if (arg === '--') {
      out.push(...args.slice(i + 1))
      break
    }
    if (optionTakesValue.has(arg)) {
      i += 1
      continue
    }
    if (isOptionLike(arg)) continue
    out.push(arg)
  }
  return out
}

function inlineScriptArg(args: string[]): { index: number; value: string } | null {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!
    if (arg === '--') break
    if (arg === '-c' || arg === '--command' || (/^-[A-Za-z]+$/.test(arg) && arg.includes('c'))) {
      const value = args[i + 1]
      if (value !== undefined) return { index: i, value }
    }
  }
  return null
}

function interpreterInlineScript(
  name: string,
  args: string[],
): { index: number; value: string } | null {
  const isPython = name === 'python' || name === 'python3' || /^python3\.\d+$/.test(name)
  const isNode = name === 'node' || name === 'nodejs' || name === 'bun'
  if (isPython) {
    const index = args.indexOf('-c')
    if (index >= 0 && args[index + 1] !== undefined) return { index, value: args[index + 1]! }
    return null
  }
  if (isNode) {
    const index = args.findIndex(
      (a) => a === '-e' || a === '--eval' || a === '-p' || a === '--print',
    )
    if (index >= 0 && args[index + 1] !== undefined) return { index, value: args[index + 1]! }
    return null
  }
  if (name === 'perl' || name === 'ruby' || name === 'php' || name === 'lua') {
    const flags = name === 'php' ? ['-r'] : name === 'lua' ? ['-e'] : ['-e', '-E']
    const index = args.findIndex((a) => flags.includes(a))
    if (index >= 0 && args[index + 1] !== undefined) return { index, value: args[index + 1]! }
  }
  if (name === 'deno' && args[0] === 'eval' && args[1] !== undefined) {
    return { index: 0, value: args[1]! }
  }
  return null
}

function analyzeParsedScript(
  text: string,
  base: number,
  pathBase: string,
  ctx: Ctx,
  depth: number,
): ParsedResult & { reasonsLevels: () => RiskLevel[] } {
  const { tokens, unbalancedAt } = lex(text, base)
  if (unbalancedAt.length > 0) {
    const at = unbalancedAt[0]!
    addReason(
      ctx.reasons,
      ctx,
      'PARSE_UNBALANCED_QUOTE',
      'needs-approval',
      '引号/命令替换未闭合, 无法完成语义判定',
      nodeOf(at, Math.min(at + 1, ctx.source.length), pathBase, ctx.source),
    )
  }
  const segments = parseTokens(tokens, text, base)
  const result = analyzeSegments(segments, `${pathBase}.`, ctx, depth)
  return {
    ...result,
    reasonsLevels: () => nestedLevelsOf(result),
  }
}

/**
 * 命令风险的唯一入口(纯函数)。
 *
 * @param command 用户在"完全访问"模式下即将发给终端/Agent 的单条命令或命令串
 * @returns 档位 + 依据列表 + 分段判定
 */
export function analyzeCommandRisk(command: string): RiskReport {
  if (!command || !command.trim()) return { level: 'safe', reasons: [], segments: [] }
  const ctx: Ctx = { source: command, reasons: [] }
  const result = analyzeParsedScript(command, 0, '', ctx, 0)
  const deduped: RiskReason[] = []
  for (const reason of ctx.reasons) {
    if (
      !deduped.some(
        (r) =>
          r.code === reason.code &&
          r.node.start === reason.node.start &&
          r.node.end === reason.node.end,
      )
    ) {
      deduped.push(reason)
    }
  }
  deduped.sort((a, b) => {
    const byLevel = levelRank(b.level) - levelRank(a.level)
    return byLevel !== 0 ? byLevel : a.node.start - b.node.start
  })
  return {
    level: maxLevel(deduped.map((r) => r.level)),
    reasons: deduped,
    segments: result.segments,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
