#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 门 276 —— 换库必须换队列隔离(「换库不换 Redis/队列」事故的机器牙)
 *
 * ── 立因(2026-10-31,已实测确认)─────────────────────────────────────────────
 * `.ihui-agent/tmp/perf5` 的一次性 e2e 隔离栈把 `DATABASE_URL` 换成了隔离库 `ihui_e2e`,
 * 却**继承同一个 `REDIS_URL`**:
 *
 *     env: { ...process.env, DATABASE_URL: dsn, PORT: String(API_PORT), TURNSTILE_SECRET_KEY: '' }
 *
 * 于是它起的那个 BullMQ worker 从主库的 `relay-account-pool-queue` 抢走每 5 分钟的号池巡检
 * 作业,拿到缺列的隔离库上执行 —— `sweep` 从 2026-10-24 起连续 7 天全部失败,失败队列打满
 * 500 条,号池保活实际停摆。关键证据:**当时唯一消费主库那条队列的 worker,其实是隔离栈**。
 * 库换了、队列没换 ⇒ 隔离栈替主库跑作业,还跑在错的库上。这不是"忘了配 Redis",
 * 是"队列身份没有跟着库身份走"。
 *
 * ── 判据三条(本文件唯一实现)────────────────────────────────────────────────
 * ① 找 env 覆盖块:`env: { … }`(括号配对取全文)、`Object.assign(process.env, { … })`、
 *    `process.env.DATABASE_URL = …` 直赋值 —— 三形都算"派生进程的 env 覆盖块"。
 * ② 块内出现**换库证据**就算"换了库":`DATABASE_URL:` 对象键 / `process.env.DATABASE_URL =`
 *    / 对该变量的字符串替换拼接(`DATABASE_URL…replace(` / `.replace(…DATABASE_URL`)。
 * ③ 同一块(或块前后 30 行窗口)必须同时出现**隔离证据**之一:`REDIS_URL` /
 *    `RELAY_QUEUE_SUFFIX` / `QUEUE_PREFIX` / `BULLMQ_PREFIX`;没有 ⇒ 记 violation。
 *    隔离证据在**注释里不算数**(注释掉的 REDIS_URL 不会真的换掉队列)。
 *
 * ── 豁免三档(逐条打印 skip(reason),绝不静默吞)──────────────────────────────
 * ① 路径豁免:`apps/api/tests/` 下、`*.test.*`、`*.spec.*` —— 纯单测,不起 worker。
 * ② 标记豁免:同一块内含 `QUEUE_ISOLATION_EXEMPT` 注释标记(判据只认标记本身,
 *    "为什么可以免"由 code review 兜;写在标记旁边,别写在本文件里)。
 * ③ 只读豁免:块内同时出现 `READ_ONLY`(显式声明这条 env 只用于只读用途)。
 *
 * ── 边界(请勿把本门当运行时隔离证明)────────────────────────────────────────
 * 本门判不出运行时行为,只判**启动器形状**:它看不见 `spawn` 之后那个进程连到了哪台 Redis,
 * 也看不见队列名到底解析成了什么。真正的兜底是**队列名携带库身份**
 * ——`relay-account-pool-queue-<库名>`(见 docs/RELAY_QUEUE_DB_ISOLATION.md §1/§2;分隔符用
 * 连字符是因为 BullMQ 的 QueueBase 对队列名里的 `:` 直接抛,用冒号会让隔离栈启动即崩)。
 * 本门只是让"明显没打算隔离"的启动器在提交时就被点名,别指望它替代那层自动后缀。
 *
 * ── 用法(取材面纪律 = AGENTS §0.4:清单与内容同面同轮,取不到不回落另一个面)──────
 *   node scripts/check-relay-queue-db-isolation.mjs                   # 默认 = 全量档(HEAD blob)
 *   node scripts/check-relay-queue-db-isolation.mjs --staged          # 提交档:本次暂存文件(索引 blob)
 *   node scripts/check-relay-queue-db-isolation.mjs --all             # 全量档(与默认同一面,给 CI/人工显式写)
 *   node scripts/check-relay-queue-db-isolation.mjs --worktree        # 人工逃生舱:读磁盘(可能是并行会话半编辑态)
 *   node scripts/check-relay-queue-db-isolation.mjs --files a.mjs b.ts     # 人工点名(读磁盘)
 *   node scripts/check-relay-queue-db-isolation.mjs --self-test        # 内置正反用例,不碰真仓
 *   node scripts/check-relay-queue-db-isolation.mjs --root <目录> --all   # 镜像测试/取证通道:换仓根(值须是仓库根)
 *   node scripts/check-relay-queue-db-isolation.mjs --help
 *
 * 旗标纪律:`--staged` / `--all` / `--worktree` / `--files` **任意两枚同给 ⇒ exit 2**(两个面互斥,
 * 取哪一面都会让另一枚成为假绿);**未知旗 ⇒ exit 2 并点名** —— 静默吞旗会让操作者以为判的是工作树、
 * 实际判的是索引,这一型比判错更危险(§0.3:「没判」绝不允许写成「判过」)。
 *
 * 各档清单来源(与正文**同面同轮**,都取自 `scripts/lib/face-reader.mjs` 的出口):
 *   全量档 ⇒ 清单 `listFaceFiles(root,'head')`(= `git ls-tree -r --name-only HEAD`)∩ 启动器目录,正文 `HEAD:<path>`;
 *   提交档 ⇒ 清单 `git diff --cached --name-only`,正文索引 blob `:<path>`(盘上随后改对不算修好);
 *   逃生舱 ⇒ 清单磁盘遍历(看得见**未跟踪**的新启动器 —— 这正是它存在的理由),正文读盘。
 *   默认(不给面旗)走全量档:`scripts/guardian-executor` 只在这台门不带旗的**全量轮**里派生它
 *   (`--staged` 由 runner 在提交轮统一追加),此前默认落成索引档 ⇒ 全量轮永远只报「索引为空」,
 *   HEAD 面一格都没判过 —— 那是把「没判」当「判过」,同 §0.3。
 *
 * 退出码:0 无违规(含豁免 / NOT_APPLICABLE);1 有违规;2 未判定(取不到被审面 / git 不可用 /
 * 旗标用法错 / 本轮候选一个正文都没读到)。
 *
 * 扫描面排除:node_modules、.ihui-agent/tmp、docs/、*.md、pnpm-lock.yaml、二进制与非文本扩展名。
 * 不扫 docs/ 与 *.md 是有意的:文档里必然大段引用 `DATABASE_URL` 与 `REDIS_URL`,
 * 把它们纳入判据只会得到一台与提交无关的恒红门(AGENTS §12e)。
 * 含 NUL 的 blob 按**不可读**处理(不计 scanned、不冒充判过),与工作树档同一口径;
 * 若本轮候选**全部**不可读 ⇒ exit 2 未判定,不得回落成「violations: 0」的绿。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// git 与**正文**一律走面读取层(§0.4 清单与内容同面同轮 / §5b 绝对路径 git + §12g 显式 stdio):
// 清单用层的枚举出口 listFaceFiles(全量档)与 gitRaw(提交档取 `diff --cached --name-only`,
// 它不产 blob 正文,属枚举类调用),内容用层的读取入口 catBatch / readWorktreeFile —— 只引层不用它
// 读内容,在门 118 那档就是「半接线」:看起来换了面,判定面其实没换。
import {
  FACE_LABEL,
  FACE_NOTE,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  listFaceFiles,
  readWorktreeFile,
} from './lib/face-reader.mjs'
// `--root` 的取值走全仓唯一出口(9 份逐字副本静默降级 38 处的教训,见 lib/flag-value.mjs 头注)
import { requireFlagValue } from './lib/flag-value.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ─── 扫描面 ──────────────────────────────────────────────────────────────────

/** `--all` 的启动器目录(相对仓库根)。`apps/* /scripts` 由运行时枚举追加。 */
const ALL_SCAN_DIRS = [
  'scripts',
  '.github/workflows',
  'apps/api/scripts',
  'apps/api/tests',
  'apps/api/src/workers',
  'apps/api/src/services',
  'apps/web/e2e',
]

/** 路径里出现任一分段的文件一律不看。 */
const SKIP_DIR_PARTS = ['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.ihui-agent/tmp']

/** 目录前缀豁免:docs/ 是叙事面,不是启动器面。 */
const SKIP_PREFIXES = ['docs/']

/** 体积 / 名字豁免。 */
const SKIP_BASENAMES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'])

/** 认作文本的扩展名(白名单:只有会派生进程的语言值得看)。 */
const TEXT_EXT = new Set([
  '.mjs', '.js', '.cjs', '.ts', '.tsx', '.mts', '.cts',
  '.yml', '.yaml', '.json', '.sh', '.bash', '.ps1', '.psm1', '.py',
])

/**
 * 单个候选的体积上限。
 * 2026-10-31 由 512KB 抬到 4MB:现读 `scripts/git-guardian.mjs` 的 HEAD blob = 563,558 字节,
 * 旧上限把**本仓最大的启动器承载体**整枚跳掉却只报一个计数 —— 那是"多放一次跳门"(§0.10)。
 * 上限本身仍要留:真二进制/巨型生成物不该进字符扫描器(判据是 O(n) 状态机)。
 */
const MAX_BYTES = 4 * 1024 * 1024

// ─── 判据常量 ────────────────────────────────────────────────────────────────

/** ② 换库证据:块内命中任一即视为「这个 env 把 DATABASE_URL 改掉了」。 */
const REWRITE_RES = [
  // 对象键形:`DATABASE_URL: dsn` / `'DATABASE_URL': dsn`
  /(?:^|[\s,{])['"]?DATABASE_URL['"]?\s*:(?!:)/m,
  // 直赋值形:`process.env.DATABASE_URL = dsn` / `process.env['DATABASE_URL'] = dsn`
  /process\.env\s*(?:\.\s*DATABASE_URL|\[\s*['"]DATABASE_URL['"]\s*\])\s*=(?!=)/,
  // 字符串替换/拼接形:`DATABASE_URL.replace(...)` / `x.replace(..., DATABASE_URL)`
  /DATABASE_URL[^;\n]{0,120}?\.replace\s*\(/,
  /\.replace\s*\([^;]{0,160}DATABASE_URL/,
]

/** ③ 隔离证据:任一出现即认为「队列身份跟着换了」。 */
const ISOLATION_RE = /\b(?:REDIS_URL|RELAY_QUEUE_SUFFIX|QUEUE_PREFIX|BULLMQ_PREFIX)\b/

/** ② 标记豁免 / ③ 只读豁免。 */
const EXEMPT_MARKER = 'QUEUE_ISOLATION_EXEMPT'
const READ_ONLY_RE = /\bREAD_ONLY\b/

/** 函数体内窗口:块前后各 30 行。 */
const WINDOW_LINES = 30

// ─── 纯函数:括号配对 ─────────────────────────────────────────────────────────

/**
 * 正则字面量的判定启发式:上一个有意义的字符是这些时,`/` 是正则开头而不是除号。
 * 为什么需要它(2026-10-31 实测踩过):`/['"]DATABASE_URL['"]/` 这类正则里的引号会把
 * "字符串态"整个带偏 —— 之后每一行都被当成字符串,注释抹不掉、块也找不对,
 * 于是本门扫自己时在头注那行报了一条假违规。字符扫描必须自己认出正则,否则判据不可信。
 */
const REGEX_PREV_CHARS = new Set('([{,;:=!&|?+-*%~^<>'.split(''))

/** 从 `start`(指向正则开头的 `/`)跳到字面量末尾(含 flags);认不出就原地返回。 */
function skipRegexLiteral(str, start) {
  let inClass = false
  for (let i = start + 1; i < str.length; i += 1) {
    const c = str[i]
    if (c === '\n') return start
    if (c === '\\') {
      i += 1
      continue
    }
    if (inClass) {
      if (c === ']') inClass = false
      continue
    }
    if (c === '[') {
      inClass = true
      continue
    }
    if (c === '/') {
      let j = i + 1
      while (j < str.length && /[a-z]/i.test(str[j])) j += 1
      return j - 1
    }
  }
  return start
}

/**
 * 从 `str[startIndex]`(必须是 `{`)起做括号配对,返回含首尾花括号的整段文本;配不平返回 null。
 *
 * 为什么要自己扫而不用 AST:本门要能在**任意**启动器上跑(含 .yml / .ps1 / .py / 半成品
 * .mjs),解析器会把"语法还不合法的那份"整片丢成零命中 —— 那正是漏报的形状。纯字符扫描
 * 的代价是必须自己处理字符串与注释,这五类坑全在下面的状态机里:
 *   ① 嵌套对象 `{ a: { b: 1 } }`;
 *   ② 字符串里含 `}`(如 `'{'` / `"db}"`);
 *   ③ 模板串 `` `x${y}` `` —— `${` 展开的是表达式,里面的花括号要照常计数;
 *   ④ `//`、`/* *\/` 注释里的花括号不算数;
 *   ⑤ 正则字面量 `/['"]/` 里的引号不是字符串开头(否则状态机整片带偏)。
 * 偏移量语义:返回值与入参同一坐标系,调用方可直接 `indexOf`/切片定位行号。
 */
export function extractBalanced(str, startIndex) {
  if (typeof str !== 'string' || startIndex < 0 || startIndex >= str.length) return null
  if (str[startIndex] !== '{') return null
  let depth = 0
  // 每进一层 `${` 记下当时的 depth,闭合时据此切回模板态
  const interpDepths = []
  let mode = 'code' // code | line | block | single | double | template
  let lastSig = ''
  for (let i = startIndex; i < str.length; i += 1) {
    const c = str[i]
    const n = str[i + 1]
    if (mode === 'line') {
      if (c === '\n') mode = 'code'
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code'
        i += 1
      }
      continue
    }
    if (mode === 'single' || mode === 'double') {
      const quote = mode === 'single' ? "'" : '"'
      if (c === '\\') {
        i += 1
        continue
      }
      if (c === quote) mode = 'code'
      continue
    }
    if (mode === 'template') {
      if (c === '\\') {
        i += 1
        continue
      }
      if (c === '`') {
        mode = 'code'
        continue
      }
      if (c === '$' && n === '{') {
        interpDepths.push(depth)
        depth += 1
        i += 1
        mode = 'code'
      }
      continue
    }
    // code
    const prevSig = lastSig
    if (c.trim() !== '') lastSig = c
    if (c === '/' && n === '/') {
      mode = 'line'
      i += 1
      continue
    }
    if (c === '/' && n === '*') {
      mode = 'block'
      i += 1
      continue
    }
    if (c === '/' && (prevSig === '' || REGEX_PREV_CHARS.has(prevSig))) {
      const end = skipRegexLiteral(str, i)
      if (end > i) {
        lastSig = '/'
        i = end
        continue
      }
    }
    if (c === "'") {
      mode = 'single'
      continue
    }
    if (c === '"') {
      mode = 'double'
      continue
    }
    if (c === '`') {
      mode = 'template'
      continue
    }
    if (c === '{') {
      depth += 1
      continue
    }
    if (c === '}') {
      depth -= 1
      if (depth === 0) return str.slice(startIndex, i + 1)
      if (interpDepths.length > 0 && depth === interpDepths[interpDepths.length - 1]) {
        interpDepths.pop()
        mode = 'template'
      }
      continue
    }
  }
  return null
}

/**
 * 把注释替换成等长空格(保留换行),偏移量与行号因此**一字不差**。
 * 用途:隔离证据与换库证据都只认代码里的出现 —— `// 记得换 REDIS_URL` 这种注释
 * 若也算证据,本门就成了"写一行注释即绿"的橡皮章。同名标记豁免(EXEMPT_MARKER)与
 * READ_ONLY 反过来**只能在注释里**,那两处刻意读原文,不走本函数。
 */
function stripComments(text) {
  const out = text.split('')
  let mode = 'code'
  let lastSig = ''
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    const n = text[i + 1]
    if (mode === 'line') {
      if (c === '\n') mode = 'code'
      else out[i] = ' '
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        out[i] = ' '
        out[i + 1] = ' '
        mode = 'code'
        i += 1
        continue
      }
      if (c !== '\n') out[i] = ' '
      continue
    }
    if (mode === 'single' || mode === 'double') {
      const quote = mode === 'single' ? "'" : '"'
      if (c === '\\') {
        i += 1
        continue
      }
      if (c === quote) mode = 'code'
      continue
    }
    if (mode === 'template') {
      if (c === '\\') {
        i += 1
        continue
      }
      if (c === '`') mode = 'code'
      continue
    }
    const prevSig = lastSig
    if (c.trim() !== '') lastSig = c
    if (c === '/' && n === '/') {
      out[i] = ' '
      out[i + 1] = ' '
      mode = 'line'
      i += 1
      continue
    }
    if (c === '/' && n === '*') {
      out[i] = ' '
      out[i + 1] = ' '
      mode = 'block'
      i += 1
      continue
    }
    if (c === '/' && (prevSig === '' || REGEX_PREV_CHARS.has(prevSig))) {
      const end = skipRegexLiteral(text, i)
      if (end > i) {
        lastSig = '/'
        i = end
        continue
      }
    }
    if (c === "'") mode = 'single'
    else if (c === '"') mode = 'double'
    else if (c === '`') mode = 'template'
  }
  return out.join('')
}

/** 1-based 行号。 */
function lineAt(src, index) {
  let line = 1
  for (let i = 0; i < index && i < src.length; i += 1) if (src[i] === '\n') line += 1
  return line
}

/** 取 `env: {` / `Object.assign(process.env, {` / `process.env.DATABASE_URL =` 三类块。 */
function findEnvBlocks(src) {
  const blocks = []
  const pushObjectBlock = (matchIndex, braceAt) => {
    const text = extractBalanced(src, braceAt)
    if (text === null) return null
    const start = matchIndex
    const end = braceAt + text.length
    const block = {
      start,
      end,
      text,
      line: lineAt(src, start),
      endLine: lineAt(src, end),
    }
    blocks.push(block)
    return end
  }

  const reEnv = /\benv\s*:\s*\{/g
  let m
  while ((m = reEnv.exec(src)) !== null) {
    const braceAt = m.index + m[0].length - 1
    const end = pushObjectBlock(m.index, braceAt)
    if (end !== null) reEnv.lastIndex = Math.max(reEnv.lastIndex, end)
  }

  const reAssign = /Object\.assign\s*\(\s*process\.env\s*,\s*\{/g
  while ((m = reAssign.exec(src)) !== null) {
    const braceAt = m.index + m[0].length - 1
    const end = pushObjectBlock(m.index, braceAt)
    if (end !== null) reAssign.lastIndex = Math.max(reAssign.lastIndex, end)
  }

  const reDirect = /process\.env\s*(?:\.\s*DATABASE_URL|\[\s*['"]DATABASE_URL['"]\s*\])\s*=(?!=)/g
  while ((m = reDirect.exec(src)) !== null) {
    const semi = src.indexOf('\n', m.index)
    const end = semi === -1 ? src.length : semi
    // 直赋值块取其所在整行(对象形取整个花括号体),语义都是「这一处 env 覆盖」
    blocks.push({
      start: m.index,
      end,
      text: src.slice(m.index, end),
      line: lineAt(src, m.index),
      endLine: lineAt(src, end),
    })
  }

  return blocks.sort((a, b) => a.start - b.start)
}

/** 路径级豁免(第①档):返回原因字符串或 null。 */
export function pathExemptReason(file) {
  const p = String(file).replace(/\\/g, '/')
  if (/(^|\/)apps\/api\/tests\//.test(p)) return '路径在 apps/api/tests/ 下(纯单测,不起 worker)'
  if (/\.test\.[^/]+$/.test(p)) return '文件名是 *.test.*(纯单测,不起 worker)'
  if (/\.spec\.[^/]+$/.test(p)) return '文件名是 *.spec.*(纯单测,不起 worker)'
  return null
}

/**
 * 判一段源码。返回 `{ rewritten, violations, skips }`:
 *  - `rewritten`:命中「换库证据」的块数(0 ⇒ 无对象,即 NOT_APPLICABLE)
 *  - `violations`:换库了但没隔离,且不属任何豁免
 *  - `skips`:被豁免的块(逐条带人话原因,绝不静默吞)
 *
 * 顺序有意为之:先判路径豁免(整文件不扫),再判块内标记/只读豁免,**最后**才判违规 ——
 * 否则"带豁免标记但确实没隔离"会被记成红,而豁免的语义就是"这一处人工认过了"。
 */
export function scanSource(src, options = {}) {
  const file = options.file ?? '<inline>'
  const result = { file, rewritten: 0, violations: [], skips: [] }
  if (typeof src !== 'string' || src.length === 0) return result

  // 先把注释抹成等长空格**再找块**:否则头注里贴着教学用的 `env: { … }` 会被当启动器,
  // 本门就会把自己(以及所有"文档式"文件)判红 —— 自指噪音,不是真违规(见 report 里的边界)。
  // 偏移量不变,所以块文本仍能从原文切回来:标记豁免与 READ_ONLY 只活在注释里,必须读原文。
  const codeSrc = stripComments(src)
  const lines = codeSrc.split('\n')

  const fileExempt = pathExemptReason(file)
  if (fileExempt !== null) {
    // 即便整文件豁免,也要如实报一句(不许静默吞):只有真出现换库块才报,否则噪音
    const hasRewrite = findEnvBlocks(codeSrc).some((b) => REWRITE_RES.some((re) => re.test(b.text)))
    if (hasRewrite) result.skips.push({ file, line: 0, reason: fileExempt })
    return result
  }

  for (const block of findEnvBlocks(codeSrc)) {
    // block.text 来自 codeSrc(注释已抹),block.raw 来自原文(标记/只读仍可见)
    const codeOnly = block.text
    const hit = REWRITE_RES.map((re) => re.exec(codeOnly)).find((x) => x !== null)
    if (!hit) continue
    result.rewritten += 1
    const line = block.line + (codeOnly.slice(0, hit.index).match(/\n/g)?.length ?? 0)
    const raw = src.slice(block.start, block.end)

    // 第①档已在上面处理;这里剩 ②标记 / ③只读
    if (raw.includes(EXEMPT_MARKER)) {
      result.skips.push({ file, line, reason: `块内标了 ${EXEMPT_MARKER}(理由须写在标记旁,靠 code review)` })
      continue
    }
    if (READ_ONLY_RE.test(raw)) {
      result.skips.push({ file, line, reason: '块内声明 READ_ONLY(只读用途,不派生会抢作业的 worker)' })
      continue
    }

    // 隔离证据:同一块,或块前后 WINDOW_LINES 行的函数体窗口(codeSrc 已无注释,直接切)
    if (ISOLATION_RE.test(codeOnly)) continue
    const from = Math.max(0, block.line - 1 - WINDOW_LINES)
    const to = Math.min(lines.length, block.endLine + WINDOW_LINES)
    if (ISOLATION_RE.test(lines.slice(from, to).join('\n'))) continue

    result.violations.push({
      file,
      line,
      reason: '这段 env 覆盖把 DATABASE_URL 换成了别的库,却没有同时换 Redis 或队列命名空间 ⇒ 该进程起的 BullMQ worker 会去消费主库同名的 relay-account-pool-queue,在隔离库上执行主库的作业(2026-10-24 号池巡检停摆 7 天就是这个形状)',
      fix: '同一块里补 REDIS_URL(推荐:换 db index 或另起实例),或补 RELAY_QUEUE_SUFFIX=<库名后缀>;确属只读用途则在块内写 READ_ONLY',
    })
  }
  return result
}

// ─── 取材面(§0.4:清单与内容同面同轮;取不到不回落另一个面)────────────────────

/** 四枚「面旗」:同给 = 两个判定面互斥 ⇒ exit 2,不猜哪一枚才是认真的。 */
const FACE_FLAGS = ['--staged', '--all', '--worktree', '--files']

/** 本门认识的全部旗标;不在这张表里的 `-x` / `--x` 一律按「未知旗」exit 2 点名。 */
const KNOWN_FLAGS = new Set(['--help', '-h', '--self-test', '--root', ...FACE_FLAGS])

/** 面旗 → 判定面。**不给面旗 = 全量档**(runner 的全量轮正是「不带 --staged」那一档)。 */
const FACE_BY_FLAG = { '--staged': 'staged', '--all': 'head', '--worktree': 'worktree' }

/**
 * 纯函数:argv → 判定面与候选清单来源。**任何用法错都进 `errors`,由调用方 exit 2 逐条点名**,
 * 绝不静默降级成"某一枚旗看起来更像"(旧实现把未知旗落进 else = 索引档,操作者以为判的是工作树,
 * 实际判的是索引 —— 抬头还照打 `--staged`,这一型没有牙)。
 */
export function parseArgv(argv) {
  const out = { errors: [], mode: 'run', face: 'head', faceFlag: '--all(默认)', files: [], root: null }
  const unknown = [...new Set(argv.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a)))]
  const given = FACE_FLAGS.filter((f) => argv.includes(f))
  if (unknown.length > 0) {
    out.errors.push(
      `未知旗标:${unknown.join(' / ')} —— 本门只认 ${[...KNOWN_FLAGS].join(' / ')},` +
        '静默吞旗等于让你以为判的是一个面、实际判的是另一个',
    )
  }
  if (given.length > 1) {
    out.errors.push(
      `面旗同给:${given.join(' + ')} —— 清单与内容只能取同一个面(AGENTS §0.4);` +
        '取哪一面都会让另一面成为假绿,请一次只给一枚',
    )
  }
  if (argv.includes('--help') || argv.includes('-h')) out.mode = 'help'
  if (argv.includes('--self-test')) out.mode = 'self-test'
  if (out.mode === 'self-test' && given.length > 0) {
    out.errors.push(`--self-test 与面旗 ${given.join(' + ')} 同用 —— 自检构造的是内存样例,没有面可判`)
  }
  const rootFlag = requireFlagValue(argv, '--root', { noun: '目录参数' })
  if (rootFlag.error) out.errors.push(rootFlag.error)
  else if (rootFlag.value) out.root = path.resolve(rootFlag.value)

  if (given.length === 1) {
    const flag = given[0]
    if (flag === '--files') {
      out.face = 'files'
      out.faceFlag = '--files'
      const idx = argv.indexOf('--files')
      out.files = argv
        .slice(idx + 1)
        .filter((a) => !a.startsWith('-'))
        .map((p) => String(p).replace(/\\/g, '/'))
      if (out.files.length === 0) out.errors.push('--files 后面没有给路径(一个候选都没有 ⇒ 未判定)')
    } else {
      out.face = FACE_BY_FLAG[flag]
      out.faceFlag = flag
    }
  }
  return out
}

/** 纯函数:某枚路径属不属于本门的启动器目录(与旧的静态清单 + 「apps/某一端/scripts」运行时枚举同形)。 */
export function inScanScope(rel) {
  const p = String(rel).replace(/\\/g, '/')
  if (ALL_SCAN_DIRS.some((dir) => p === dir || p.startsWith(`${dir}/`))) return true
  // 旧实现用 fs.readdirSync('apps') 追加 `apps/<name>/scripts`;HEAD 面不能读磁盘来"知道有哪些端",
  // 所以同一件事改由路径形状判定(逐字等价:枚举出来的目录就是 apps/<某一端>/scripts)。
  return /^apps\/[^/]+\/scripts\//.test(p)
}

/** 纯函数:判定面 → `cat-file` 规格形状(工作树档不走它,直接读盘)。 */
export function faceSpecOf(face, rel) {
  if (face === 'head') return `HEAD:${rel}`
  if (face === 'staged') return `:${rel}`
  throw new Undetermined(`faceSpecOf 不接受判定面 ${String(face)}(worktree/files 走磁盘读取入口)`)
}

/**
 * 纯函数:把一层交回来的正文折成「可用正文」或 null(= 不可读)。
 * 三档都要拦:① 层说取不到(null/undefined);② 体积超上限;③ **含 NUL**(二进制)。
 * 第③档以前只有工作树档靠 `readWorktreeFile` 天然挡住,HEAD/索引档的 `catBatch` 不筛 ——
 * 于是同一份二进制在三个面上"两个面被当成正文扫、一个面被当成不可读",面一致性就是假绿。
 */
export function normalizeBlobText(text) {
  if (text === null || text === undefined) return null
  if (text.includes('\u0000')) return null
  if (Buffer.byteLength(text) > MAX_BYTES) return null
  return text
}

function git(args, root) {
  try {
    return { ok: true, out: gitRaw(args, root) }
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) }
  }
}

/** 路径是否属扫描面(扩展名 / 排除目录 / 排除前缀)。 */
function isCandidate(relPath) {
  const p = String(relPath).replace(/\\/g, '/')
  if (SKIP_PREFIXES.some((pre) => p.startsWith(pre))) return false
  if (SKIP_DIR_PARTS.some((part) => p.split('/').includes(part) || p.includes(`${part}/`))) return false
  const base = p.split('/').pop() ?? ''
  if (SKIP_BASENAMES.has(base)) return false
  if (base.endsWith('.md') || base.endsWith('.mdx') || base.endsWith('.map')) return false
  if (base.startsWith('.env')) return false
  const ext = path.extname(base).toLowerCase()
  return TEXT_EXT.has(ext)
}

function walk(dirAbs, acc, root) {
  let entries
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of entries) {
    const abs = path.join(dirAbs, ent.name)
    const rel = path.relative(root, abs).replace(/\\/g, '/')
    if (ent.isDirectory()) {
      if (SKIP_DIR_PARTS.some((part) => ent.name === part || rel.includes(part))) continue
      walk(abs, acc, root)
    } else if (ent.isFile()) {
      if (isCandidate(rel)) acc.push(rel)
    }
  }
}

/** 逃生舱的清单:磁盘里的启动器目录(含未跟踪的新文件 —— 人工排查要的正是这一格)。 */
function collectAllFromDisk(root) {
  const dirs = [...ALL_SCAN_DIRS]
  try {
    for (const app of fs.readdirSync(path.join(root, 'apps'), { withFileTypes: true })) {
      if (!app.isDirectory()) continue
      dirs.push(`apps/${app.name}/scripts`)
    }
  } catch {
    /* apps/ 不在就只扫静态清单 */
  }
  const files = []
  for (const dir of [...new Set(dirs)]) walk(path.join(root, dir), files, root)
  return [...new Set(files)].sort()
}

/**
 * 全量档的清单:**HEAD 面枚举跟踪文件**(层的 listFaceFiles),不在这里读磁盘。
 * 一次全仓 `ls-tree` 再按目录形状筛,而不是把目录当 pathspec 传下去:「apps/某一端/scripts」这一族
 * 是运行时才知道有哪些端,而"运行时枚举"若靠 `fs.readdirSync('apps')` 就把磁盘面偷偷混进了
 * HEAD 档的清单(§0.4 清单与内容同面)。
 */
export function collectHeadFace(root) {
  return listFaceFiles(root, 'head')
    .filter((rel) => inScanScope(rel) && isCandidate(rel))
    .sort()
}

/** `--staged`:本次暂存的变更文件(清单 = 索引 vs HEAD 的差异,内容读**索引 blob**)。 */
function collectStaged(root) {
  const r = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)
  if (!r.ok) return { err: `git 不可用:${r.err}` }
  const all = r.out.split('\n').map((s) => s.trim()).filter(Boolean)
  // 索引里一条暂存都没有 ⇒ 确实取不到被审面(exit 2);
  // 有暂存但都不是可审文本(如只改 .md)⇒ 是本门无对象,走 NOT_APPLICABLE(exit 0),不是故障。
  if (all.length === 0) return { err: '索引为空:没有本次暂存文件' }
  return { files: all.filter(isCandidate) }
}

/**
 * 一次把整批候选按**被审面**读回正文(批量,不逐文件派生 git)。
 * 层的 `catBatch` 读不到某个对象回 null;派生本身失败(截断/缓冲区/仓库坏了)**抛**
 * `Undetermined` ⇒ 由调用方折成 exit 2「未判定」,**绝不回落另一个面**。
 */
export function readFaceContents(root, face, files) {
  const map = new Map()
  if (face === 'worktree' || face === 'files') {
    for (const rel of files) {
      // 层的 readWorktreeFile:不存在 ⇒ null;含 NUL ⇒ null;读失败(权限/编码)⇒ 抛 Undetermined,
      // 不把它伪装成"这个文件不存在"(§0.3)
      map.set(rel, normalizeBlobText(readWorktreeFile(root, rel)))
    }
    return map
  }
  const specs = files.map((rel) => faceSpecOf(face, rel))
  const got = catBatch(root, specs)
  for (let i = 0; i < files.length; i += 1) map.set(files[i], normalizeBlobText(got.get(specs[i])))
  return map
}

/** 清单+内容一次取齐(同一面、同一轮)。取不到面 ⇒ 返回 `{err}`;层抛 ⇒ 由调用方折 exit 2。 */
function gatherFace(root, face, explicitFiles) {
  let files
  if (face === 'files') files = explicitFiles
  else if (face === 'head') files = collectHeadFace(root)
  else if (face === 'staged') {
    const got = collectStaged(root)
    if (got.err) return { err: got.err }
    files = got.files
  } else files = collectAllFromDisk(root)
  return { files, contents: readFaceContents(root, face, files) }
}

// ─── 自检(构造面,不碰真仓)────────────────────────────────────────────────────

function selfTest() {
  const cases = []
  const t = (name, fn) => {
    let ok = false
    let label = name
    try {
      ok = fn() === true
    } catch (e) {
      label = `${name}(求值抛错:${e instanceof Error ? e.message.slice(0, 100) : 'unknown'})`
    }
    cases.push([label, ok])
  }
  const scan = (src, file = 'scripts/fixture.mjs') => scanSource(src, { file })

  // 自指锁(与 check-board-name-legacy 同款):样例里的 `env: {` / `process.env.` 一律**拼接生成**。
  // 本文件正文若出现连续字面量,本门扫自己就会红一片 —— 那是自指噪音,不是真违规;
  // 而"排除自身文件"又是更坏的做法(等于给自己开天窗)。拼接只挡自指,不挡判据。
  const ENV_OPEN = 'env' + ': {'
  const PE = 'process' + '.env'
  const ASSIGN_OPEN = 'Object' + '.assign(' + PE + ', {'

  // —— 正例:只换库,不换队列 ——
  const bad = `const api = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT,
  ${ENV_OPEN} ...process.env, DATABASE_URL: dsn, PORT: '8809' },
  stdio: 'ignore',
})
`
  t('① 只换 DATABASE_URL 不换 Redis ⇒ 1 条 violation', () => {
    const r = scan(bad)
    return r.rewritten === 1 && r.violations.length === 1 && r.skips.length === 0
  })

  // —— 反例:同时换 Redis ——
  t('② 同块同时换 REDIS_URL ⇒ 0 条 violation', () => {
    const r = scan(bad.replace("DATABASE_URL: dsn", "DATABASE_URL: dsn, REDIS_URL: redisDsn"))
    return r.rewritten === 1 && r.violations.length === 0
  })

  t('③ 同块设 RELAY_QUEUE_SUFFIX ⇒ 0 条 violation', () => {
    const r = scan(bad.replace("DATABASE_URL: dsn", "DATABASE_URL: dsn, RELAY_QUEUE_SUFFIX: 'e2e'"))
    return r.violations.length === 0
  })

  t('④ 块后 30 行窗口内的 REDIS_URL 也算隔离(函数体窗口)', () => {
    const src = `${bad}\nspawn(cmd, { ${ENV_OPEN} ...process.env, REDIS_URL: redisDsn } })\n`
    const r = scan(src)
    return r.violations.length === 0
  })

  t('⑤ 窗口外的 REDIS_URL 不算隔离(距离是有意的)', () => {
    const far = `${bad}${'\n'.repeat(60)}const REDIS_URL = 'redis://127.0.0.1:6379/9'\n`
    const r = scan(far)
    return r.violations.length === 1
  })

  t('⑥ 注释里的 REDIS_URL 不算隔离证据', () => {
    const src = `spawn(cmd, {\n  // 记得换 REDIS_URL\n  ${ENV_OPEN} DATABASE_URL: dsn },\n})\n`
    const r = scan(src)
    return r.violations.length === 1
  })

  // —— 直赋值形 ——
  t('⑦ process.env.DATABASE_URL = … 直赋值形 ⇒ 命中', () => {
    const src = `function boot(dsn) {\n  ${PE}.DATABASE_URL = dsn\n  return startWorker()\n}\n`
    const r = scan(src)
    return r.rewritten === 1 && r.violations.length === 1
  })

  t('⑧ Object.assign(process.env, { DATABASE_URL }) ⇒ 命中', () => {
    const src = `const childEnv = ${ASSIGN_OPEN} DATABASE_URL: dsn, PORT: '8809' })\n`
    const r = scan(src)
    return r.rewritten === 1 && r.violations.length === 1
  })

  t('⑨ 字符串替换形(DATABASE_URL.replace 换库)⇒ 命中', () => {
    const src = `${PE}.DATABASE_URL = ${PE}.DATABASE_URL.replace(/\\/ihui$/, '/ihui_e2e')\n`
    const r = scan(src)
    return r.rewritten >= 1 && r.violations.length >= 1
  })

  // —— 三档豁免 ——
  t('⑩ 块内 READ_ONLY ⇒ 豁免 1 条(记 skip,不记 violation)', () => {
    const src = `const r = execSync(cmd, { ${ENV_OPEN} ...process.env, DATABASE_URL: dsn /* READ_ONLY */ } })\n`
    const r = scan(src)
    return r.violations.length === 0 && r.skips.length === 1 && /READ_ONLY/.test(r.skips[0].reason)
  })

  t('⑪ 块内 QUEUE_ISOLATION_EXEMPT 标记 ⇒ 豁免 1 条', () => {
    const src = `const r = execSync(cmd, {\n  ${ENV_OPEN}\n    ...process.env,\n    DATABASE_URL: dsn, // QUEUE_ISOLATION_EXEMPT: 该进程不加载 relay worker\n  },\n})\n`
    const r = scan(src)
    return r.violations.length === 0 && r.skips.length === 1 && r.skips[0].reason.includes('QUEUE_ISOLATION_EXEMPT')
  })

  t('⑫ 测试路径豁免(apps/api/tests/ 与 *.test.* 各 1 条)', () => {
    const a = scan(bad, 'apps/api/tests/e2e/stack.ts')
    const b = scan(bad, 'scripts/tests/fixture.test.mjs')
    return (
      a.violations.length === 0 && a.skips.length === 1 && b.violations.length === 0 && b.skips.length === 1
    )
  })

  // —— NOT_APPLICABLE ——
  t('⑬ 没有 env 块的文件 ⇒ rewritten=0(NOT_APPLICABLE)', () => {
    const r = scan(`const dsn = process.env.DATABASE_URL\nconsole.log(dsn)\n`)
    return r.rewritten === 0 && r.violations.length === 0 && r.skips.length === 0
  })

  // —— extractBalanced ——
  t('⑭ extractBalanced:嵌套对象配平', () => {
    const src = `env: { a: { b: { c: 1 } }, d: 2 }, tail`
    const at = src.indexOf('{')
    return extractBalanced(src, at) === '{ a: { b: { c: 1 } }, d: 2 }'
  })

  t('⑮ extractBalanced:字符串里含 } 不提前收口', () => {
    const src = `{ k: '}', j: "a}b", m: 1 } rest`
    return extractBalanced(src, 0) === "{ k: '}', j: \"a}b\", m: 1 }"
  })

  t('⑯ extractBalanced:模板串(含 ${} 插值)', () => {
    const src = '{ k: `x${y.z}` , m: `a}b` } tail'
    return extractBalanced(src, 0) === '{ k: `x${y.z}` , m: `a}b` }'
  })

  t('⑰ extractBalanced:配不平返回 null(不猜)', () => {
    return extractBalanced('{ a: 1', 0) === null && extractBalanced('no brace', 0) === null
  })

  // —— 取材面纪律(2026-10-31 补:旗标不得静默吞 / 含 NUL 不得当绿 / 全量档不得读磁盘)——
  t('⑱ 未知旗标 ⇒ 点名进 errors(旧实现把它静默落进索引档)', () => {
    const p = parseArgv(['--nope'])
    return p.errors.length === 1 && p.errors[0].includes('--nope')
  })

  t('⑲ 面旗两枚同给 ⇒ 两枚都点名(取哪一面都会让另一面成假绿)', () => {
    const p = parseArgv(['--all', '--worktree'])
    return p.errors.some((e) => e.includes('--all') && e.includes('--worktree'))
  })

  t('⑳ 不给面旗 = 全量档 head(runner 的全量轮正是不带旗那一档)', () => {
    const p = parseArgv([])
    return p.errors.length === 0 && p.face === 'head' && p.faceFlag.startsWith('--all')
  })

  t('㉑ --worktree / --staged / --files 各落各的面,--files 收路径且转正斜杠', () => {
    const w = parseArgv(['--worktree'])
    const s = parseArgv(['--staged'])
    const f = parseArgv(['--files', 'a.mjs', 'b\\c.ts'])
    return (
      w.face === 'worktree' &&
      s.face === 'staged' &&
      f.face === 'files' &&
      f.files.join(',') === 'a.mjs,b/c.ts'
    )
  })

  t('㉒ --files 不给路径 ⇒ 未判定点名(不当成"没有候选 = 干净")', () => {
    const p = parseArgv(['--files'])
    return p.errors.some((e) => e.includes('--files 后面没有给路径'))
  })

  t('㉓ --root 给了旗标不给值 ⇒ 未判定(不得静默回落默认根)', () => {
    const p = parseArgv(['--all', '--root'])
    return p.errors.length === 1 && /--root 需要一个目录参数/.test(p.errors[0])
  })

  t('㉔ --self-test 与面旗同给 ⇒ 未判定(自检不碰真仓,没有面可判)', () => {
    const p = parseArgv(['--self-test', '--staged'])
    return p.mode === 'self-test' && p.errors.length === 1 && /--self-test 与面旗/.test(p.errors[0])
  })

  t('㉕ 含 NUL 的正文 ⇒ 不可读(null),不得被当成扫过的绿', () => {
    const nulBody = `${ENV_OPEN} DATABASE_URL: dsn\u0000 }`
    const big = 'x'.repeat(MAX_BYTES + 1)
    return (
      normalizeBlobText(nulBody) === null &&
      normalizeBlobText(null) === null &&
      normalizeBlobText(undefined) === null &&
      normalizeBlobText(big) === null &&
      normalizeBlobText('ok\n') === 'ok\n'
    )
  })

  t('㉖ faceSpecOf:head ⇒ HEAD:<path>、staged ⇒ :<path>;磁盘档拒答(不猜面)', () => {
    let threw = false
    try {
      faceSpecOf('worktree', 'x.mjs')
    } catch {
      threw = true
    }
    return (
      faceSpecOf('head', 'a/b.mjs') === 'HEAD:a/b.mjs' &&
      faceSpecOf('staged', 'a/b.mjs') === ':a/b.mjs' &&
      threw
    )
  })

  t('㉗ inScanScope:启动器目录算;docs / 非清单目录 / 名字撞前缀的都不算', () => {
    return (
      inScanScope('scripts/x.mjs') === true &&
      inScanScope('apps/desktop/scripts/y.mjs') === true &&
      inScanScope('.github/workflows/ci.yml') === true &&
      inScanScope('docs/x.md') === false &&
      inScanScope('packages/shared/src/y.ts') === false &&
      inScanScope('scriptsfoo/x.mjs') === false
    )
  })

  t('㉘ 全量档清单非空/已排序/全在启动器目录内(HEAD≠磁盘那一格交给镜像测试用夹具自证)', () => {
    const head = collectHeadFace(ROOT)
    const sortedOk = head.every((p, i) => i === 0 || head[i - 1] <= p)
    return (
      head.length > 0 && sortedOk && head.every((p) => inScanScope(p) === true && !p.startsWith('docs/'))
    )
  })

  let fail = 0
  for (const [name, ok] of cases) {
    if (!ok) fail += 1
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`\nself-test: ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`门 276 —— 换库必须换队列隔离

用法(取材面纪律 = AGENTS §0.4:清单与内容同面同轮,取不到不回落另一个面):
  node scripts/check-relay-queue-db-isolation.mjs                      默认 = 全量档(HEAD blob)
  node scripts/check-relay-queue-db-isolation.mjs --staged             提交档:本次暂存文件(索引 blob)
  node scripts/check-relay-queue-db-isolation.mjs --all                全量档(与默认同一面;清单 = HEAD 树)
  node scripts/check-relay-queue-db-isolation.mjs --worktree           人工逃生舱:读磁盘(可能是并行会话半编辑态)
  node scripts/check-relay-queue-db-isolation.mjs --files <path...>    人工点名(读磁盘)
  node scripts/check-relay-queue-db-isolation.mjs --self-test          内置正反用例,不碰真仓
  node scripts/check-relay-queue-db-isolation.mjs --root <目录> --all   取证通道:换仓根(值必须是仓库根)
  node scripts/check-relay-queue-db-isolation.mjs --help

旗标纪律(不给旗不算错,给了错旗绝不静默):
  · --staged / --all / --worktree / --files 任意两枚同给 ⇒ exit 2(两个判定面互斥)
  · 未知旗标 ⇒ exit 2 并点名(静默吞旗 = 你以为判的是工作树,实际判的是索引)
  · --self-test 与面旗同给 ⇒ exit 2(自检构造的是内存样例,没有面可判)
  · --root 给了旗标不给值 ⇒ exit 2(不得静默回落默认根)

判据三条:
  ① 找 env 覆盖块:env: { … } / Object.assign(process.env, { … }) / process.env.DATABASE_URL = …
  ② 块内出现 DATABASE_URL 的改写证据 ⇒ 视为「换了库」
  ③ 同一块(或块前后 ${WINDOW_LINES} 行窗口)必须同时出现 REDIS_URL /
     RELAY_QUEUE_SUFFIX / QUEUE_PREFIX / BULLMQ_PREFIX 之一,否则记 violation

豁免三档(逐条打印 skip(reason),不静默吞):
  ① 路径:apps/api/tests/ 下、*.test.*、*.spec.*(纯单测,不起 worker)
  ② 标记:块内 ${EXEMPT_MARKER} 注释(理由写在标记旁,靠 code review)
  ③ 只读:块内出现 READ_ONLY(显式声明只读用途)

边界:本门只判启动器形状,判不出运行时连的是哪台 Redis、队列名解析成了什么;
真正兜底是队列名携带库身份 relay-account-pool-queue-<库名>(分隔符必须是连字符:BullMQ 禁队列名含冒号;docs/RELAY_QUEUE_DB_ISOLATION.md)。

退出码:0 无违规(含豁免 / NOT_APPLICABLE);1 有违规;2 未判定(取不到被审面 / 旗标用法错 /
本轮候选一个正文都没读到)。含 NUL 或超过 ${MAX_BYTES / 1024 / 1024}MB 的候选按不可读处理:
不计入判定,也不冒充判过。`)
}

function main(argv) {
  const parsed = parseArgv(argv)
  if (parsed.mode === 'help') {
    printHelp()
    return 0
  }
  if (parsed.errors.length > 0) {
    console.error('门 276 · 未判定(这是用法错,不是"没有违规"):')
    for (const e of parsed.errors) console.error(`   · ${e}`)
    console.error('   出路:一次只给一枚面旗;要看全部门认的旗标就跑 --help。')
    return 2
  }
  if (parsed.mode === 'self-test') return selfTest()

  const root = parsed.root ?? ROOT
  if (parsed.root) {
    // --root 是给镜像测试/人工取证的换仓通道。根不是仓库根就必须停手:基准错位产出的正是
    // "看起来自洽、实则混面"的绿(见 face-reader 的 assertRepoRoot 头注)。
    try {
      assertRepoRoot(root, '--root')
    } catch (e) {
      console.error(`⚠️ 未判定:--root ${root} 不可用(${String((e && e.message) || e).split('\n')[0]})`)
      return 2
    }
  }

  let gathered
  try {
    gathered = gatherFace(root, parsed.face, parsed.files)
  } catch (e) {
    const msg = String((e && e.message) || e).split('\n')[0]
    console.error(`⚠️ 未判定:${parsed.faceFlag} 的判定面取不到(${msg})—— 不回落另一个面,也不记绿`)
    return 2
  }
  if (gathered.err) {
    console.error(`⚠️ 取不到被审面:${gathered.err}`)
    return 2
  }

  const { files, contents } = gathered
  if (files.length === 0) {
    console.error(`⚠️ 取不到被审面:${parsed.faceFlag} 在这一面没枚举到任何候选文件(枚举到 0 ≠ 无违规)`)
    return 2
  }

  const violations = []
  const skips = []
  const unreadableNames = []
  let scanned = 0
  let rewritten = 0
  let unreadable = 0

  for (const rel of files) {
    const src = contents.get(rel)
    if (src === null || src === undefined) {
      unreadable += 1
      unreadableNames.push(rel)
      continue
    }
    scanned += 1
    const r = scanSource(src, { file: rel })
    rewritten += r.rewritten
    violations.push(...r.violations)
    skips.push(...r.skips)
  }

  // 抬头如实打印本轮判的是哪个面(旧实现把 --worktree 与未知旗静默落进索引档,抬头照打 --staged)
  const labelFace = parsed.face === 'files' ? 'worktree' : parsed.face
  console.log(`换库未换队列隔离门(276) · 扫描面 ${parsed.faceFlag} · 正文取自 ${FACE_LABEL[labelFace]}`)
  console.log(`面依据:${FACE_NOTE[labelFace]}`)
  console.log(
    `候选=${files.length} scanned=${scanned} rewritten=${rewritten}` +
      (unreadable > 0 ? ` unreadable=${unreadable}(NUL/超大/取不到,未计入判定)` : ''),
  )
  if (unreadable > 0) {
    const shown = unreadableNames.slice(0, 10).join(', ')
    console.log(`⚠ 未取到正文(不等于无违规):${shown}${unreadable > 10 ? ` …(共 ${unreadable} 个)` : ''}`)
  }
  if (scanned === 0) {
    console.error('⚠️ 未判定:本轮候选一个正文都没读到 —— 不得把"没读到"报成 violations: 0 的绿')
    return 2
  }

  for (const s of skips) {
    console.log(`skip(${s.file}${s.line > 0 ? `:${s.line}` : ''}) ${s.reason}`)
  }

  if (rewritten === 0) {
    console.log('NOT_APPLICABLE:被审面里没有出现 DATABASE_URL 的 env 改写,本门无对象')
    console.log('violations: 0')
    return 0
  }

  for (const v of violations) {
    console.log(`❌ ${v.file}:${v.line}`)
    console.log(`   原因:${v.reason}`)
    console.log(`   修法:${v.fix}`)
  }
  console.log(`violations: ${violations.length}`)
  return violations.length > 0 ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  extractBalanced,
  stripComments,
  scanSource,
  pathExemptReason,
  findEnvBlocks,
  parseArgv,
  normalizeBlobText,
  faceSpecOf,
  inScanScope,
  collectHeadFace,
  readFaceContents,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
