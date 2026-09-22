// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */

// 守门:拦截「上游**凭据/令牌类**响应体被 stringify 后塞进 4xx/5xx 错误 message」的外泄路径。
//
// 为什么需要(实测事实,非推测):
//   1) apps/api/src/plugins/response-sanitizer.ts:496
//      `if (reply.statusCode < 200 || reply.statusCode >= 300) return payload`
//      —— 非 2xx 响应**完全不经脱敏**,所以"拼进 error message"是脱敏体系的真实旁路。
//   2) 真实事故提交 7384c92ed0 之前:proxy-extended-media3.ts 把 Adobe IMS OAuth2 令牌端点
//      整个响应体 `JSON.stringify(tokenData).slice(0, 400)` 拼进 502 message 回传客户端,
//      而该体含 `access_token`。
//
// 判据刻意**窄**(宁漏不误报),命中需同一「错误构造表达式」内同时满足:
//   A. 处于 4xx/5xx 响应构造上下文(`reply.status(5xx)` / `error(5xx, …)` / `{ code: 500 }` …);且
//   B. 表达式里出现 `JSON.stringify(X)`;且
//   C. 凭据语义成立:X 的名字 / 其声明右侧 / X 是含凭据 key 的对象字面量
//      —— 或 message 字面量里直接出现 access_token / refresh_token / id_token。
// 变量名不含凭据语义的(`JSON.stringify(errData)` / `(genData)` / `(data)`)→ **不拦**,
// 只进「低置信候选」清单供人审(打印但不计入失败)。这类"上游错误体透传"全仓 35 处 / 13 文件,
// 透传的是生成/调用类上游错误体、不含我方凭据,属中低危,故本门不对其恒红。
//
// 用法:node scripts/check-credential-leak-in-message.mjs
//       [--staged|--quiet|--self-test|--update-baseline|--help]
// 退出码:0 通过 / 1 检出高危违规(或基线外新增)/ 2 脚本自身异常。
// 存量豁免:scripts/credential-leak-baseline.json(只减不增;将来一次性整改时可登记)。
//
// 豁免 key 形态(2026-09-23 定稿,不含行号):`<路径>::<kind>|<凭据证据>`,
//   凭据证据 = 命中凭据语义的 JSON.stringify 实参集合(排序去重)/ 经声明外泄的变量名
//   (`via:<名>`)/ message 里出现的令牌字面量(`literal:<名>`)。
//   之所以不带行号也不用窗口全文:调用点**上方**任何一行增删都是极常见的日常改动,
//   一旦 key 依赖绝对行号或整段窗口文本,已登记的豁免会**静默失效**且无线索可查。
//   行号仍出现在报错输出里(给人看),只是不进 key。
// 同一物理外泄点只计一次:一条语句常有 `.status(502)` 与 `error(502, …)` 两个 4xx/5xx
//   起点(跨行写法时各自成窗),窗口行区间相互重叠 → 合并为 1 处(`contexts` 记命中数);
//   行区间不相交的同签名写法(不同函数里的重复外泄)仍分别成条,不互相顶掉。

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = resolve(ROOT, 'scripts', 'credential-leak-baseline.json')
const SCAN_ROOTS = ['apps/', 'packages/']
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs'])
const SKIP_DIR =
  /[\\/](node_modules|dist|build|\.next|\.turbo|coverage|__tests__|tests?|e2e|bench)[\\/]/
const TEST_PATH = /(\.test\.|\.spec\.|[\\/](tests?|__tests__|e2e)[\\/])/
const MAX_WINDOW_LINES = 12

/** 凭据语义词表(token/secret/…/access_token),用于「名字或声明右侧」判定 */
export const CRED_SEMANTIC_RE =
  /(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|apikey|token|secret|credential|password|bearer)/i
/** message 字面量里直接出现的令牌字段名(spec 指定的三个,严格 snake_case) */
export const CRED_LITERAL_RE = /\b(access_token|refresh_token|id_token)\b/
/** 同上带 `g` 标志的一份,用于把命中的令牌名**收全**(只用于生成稳定证据串,不改判据) */
const CRED_LITERAL_ALL_RE = new RegExp(CRED_LITERAL_RE.source, 'g')
/** 4xx/5xx 错误响应构造上下文 */
export const STATUS_CTX_RE = new RegExp(
  [
    String.raw`\.\s*status\s*\(\s*[45]\d{2}\s*\)`,
    String.raw`\berror\s*\(\s*[45]\d{2}\b`,
    String.raw`\b(?:statusCode|status|code)\s*[:=]+\s*[45]\d{2}\b`,
    String.raw`\bthrow\s+new\s+\w*Error\s*\(\s*[45]\d{2}\b`,
  ].join('|'),
  'g',
)
const IDENT_RE = /^[A-Za-z_$][\w$]*$/

/** 跳过字符串字面量(含模板插值),返回结束下标(引号之后)。 */
export function advanceQuoted(src, i) {
  const quote = src[i]
  let j = i + 1
  while (j < src.length) {
    const ch = src[j]
    if (ch === '\\') {
      j += 2
      continue
    }
    if (quote === '`' && ch === '$' && src[j + 1] === '{') {
      j = advanceTemplateExpr(src, j + 2)
      continue
    }
    if (ch === quote) return j + 1
    j++
  }
  return j
}

/** 从 `${` 之后扫到配对的 `}`(内部再识别字符串)。 */
export function advanceTemplateExpr(src, i) {
  let depth = 1
  let j = i
  while (j < src.length && depth > 0) {
    const ch = src[j]
    if (ch === '"' || ch === "'" || ch === '`') {
      j = advanceQuoted(src, j)
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    j++
  }
  return j
}

/** 括号(仅圆括号)净深度:跳过字符串与注释,避免 `${...()}` 干扰。 */
export function parenDepth(text) {
  let depth = 0
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '/' && next === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl + 1
      continue
    }
    if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2)
      i = close === -1 ? text.length : close + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      i = advanceQuoted(text, i)
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    i++
  }
  return depth
}

/** 顶层首个实参(逗号之前),用于取 JSON.stringify 的被序列化对象。 */
export function firstArgOf(inner) {
  let depth = 0
  let i = 0
  while (i < inner.length) {
    const ch = inner[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = advanceQuoted(inner, i)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) break
    i++
  }
  return inner.slice(0, i).trim()
}

/** 收集 text 内所有 `JSON.stringify(X)` 的 X 表达式文本。 */
export function findStringifyArgs(text) {
  const args = []
  const re = /JSON\s*\.\s*stringify\s*\(/g
  let m
  while ((m = re.exec(text))) {
    const inner = text.slice(m.index + m[0].length)
    let depth = 1
    let i = 0
    while (i < inner.length && depth > 0) {
      const ch = inner[i]
      if (ch === '"' || ch === "'" || ch === '`') {
        i = advanceQuoted(inner, i)
        continue
      }
      if (ch === '(') depth++
      else if (ch === ')') depth--
      i++
    }
    const callInner = inner.slice(0, Math.max(0, i - 1))
    const arg = firstArgOf(callInner)
    if (arg) args.push(arg)
  }
  return args
}

/** 文件内 `const|let|var NAME = RHS` 声明表(名字 → [{ rhs, line }]）。 */
export function collectDeclarations(src) {
  const map = new Map()
  const re = /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/gm
  let m
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length
    const list = map.get(m[1]) || []
    list.push({ rhs: m[2].trim(), line })
    map.set(m[1], list)
  }
  return map
}

/** 取 usageLine 之前最近一次同名声明的右侧文本(无则 null)。 */
export function resolveDeclaredRhs(decls, name, usageLine) {
  const list = decls.get(name)
  if (!list || !list.length) return null
  let best = null
  for (const d of list) {
    if (d.line <= usageLine && (!best || d.line >= best.line)) best = d
  }
  if (!best) best = list[0]
  return best.rhs
}

/** 单个 stringify 实参是否命中凭据语义(名字 / 声明右侧 / 对象字面量 key)。 */
export function classifyStringifyArg(arg, decls, usageLine) {
  const text = arg.replace(/\s+/g, ' ').trim()
  if (CRED_SEMANTIC_RE.test(text)) return true
  if (IDENT_RE.test(text)) {
    const rhs = resolveDeclaredRhs(decls, text, usageLine)
    if (rhs && CRED_SEMANTIC_RE.test(rhs)) return true
  }
  return false
}

/** 找到所有 4xx/5xx 上下文所在行(排除注释行)。 */
export function findStatusContexts(lines) {
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    STATUS_CTX_RE.lastIndex = 0
    if (STATUS_CTX_RE.test(lines[i])) hits.push(i)
  }
  return hits
}

/** 从上下文行起向后取「同一错误构造表达式」窗口,直到圆括号配平或语句结束。 */
export function extractWindow(lines, startIndex) {
  const limit = Math.min(lines.length, startIndex + MAX_WINDOW_LINES)
  let text = ''
  for (let i = startIndex; i < limit; i++) {
    text += (i > startIndex ? '\n' : '') + lines[i]
    if (parenDepth(text) > 0) continue
    const closedHere = /\)\s*[,;]?\s*$/.test(text.replace(/\s+$/, ''))
    // 链式调用换行(`reply.status(500)` 换行 `.send(…)`)→ 继续向后收
    const next = lines[i + 1] ? lines[i + 1].replace(/^\s+/, '') : ''
    const chainContinues = next.startsWith('.') || next.startsWith('?.')
    if (closedHere && !chainContinues) return { text, endIndex: i }
  }
  return { text, endIndex: limit - 1 }
}

const norm = (s) => s.replace(/\s+/g, ' ').trim()

/** 归一化 + 去重 + 排序:让证据串与语句内的书写顺序无关(稳定 key 的前提)。 */
function uniqueSorted(items) {
  return [...new Set(items.map(norm).filter(Boolean))].sort()
}

/** 两个窗口行区间是否重叠(同一物理外泄点常有 status + error 两个起点)。 */
function rangesOverlap(a, b) {
  return a[0] <= b[1] && b[0] <= a[1]
}

/**
 * 扫描单个源文件。
 * @param {string} src 文件内容
 * @param {string} file 仓库相对路径
 * @param {Set<string>} [exempt] 基线 key 集合(形态 `<路径>::<kind>|<证据>`,不含行号)
 * @returns {{ violations: Array<object>, candidates: Array<object> }}
 */
export function scanSource(src, file, exempt = new Set()) {
  const lines = src.split('\n')
  const decls = collectDeclarations(src)
  const violations = []
  const candidates = []
  /** key → { recs, ranges }:已报告的同一签名(用于把重叠窗口合并为 1 处) */
  const clusters = new Map()
  for (const start of findStatusContexts(lines)) {
    const { text, endIndex } = extractWindow(lines, start)
    const usageLine = start + 1
    const hasDirectStringify = /JSON\s*\.\s*stringify\s*\(/.test(text)
    const args = hasDirectStringify ? findStringifyArgs(text) : []
    // A. 被序列化的实参本身具备凭据语义(名字 / 声明右侧 / 对象字面量 key)
    const credArgs = uniqueSorted(args.filter((a) => classifyStringifyArg(a, decls, usageLine)))
    // B. 经一层声明间接外泄:`const detail = JSON.stringify(tokenData)…` + 下游 error(502, `…${detail}`)
    const viaDecl = []
    if (!credArgs.length) {
      for (const id of new Set(text.match(/[A-Za-z_$][\w$]*/g) || [])) {
        const rhs = resolveDeclaredRhs(decls, id, usageLine)
        if (!rhs || !/JSON\s*\.\s*stringify\s*\(/.test(rhs)) continue
        if (findStringifyArgs(rhs).some((a) => classifyStringifyArg(a, decls, usageLine)))
          viaDecl.push(`via:${id}`)
      }
    }
    viaDecl.sort()
    // C. message 字面量里直接出现令牌字段名
    const literals = hasDirectStringify
      ? uniqueSorted(text.match(CRED_LITERAL_ALL_RE) || []).map((l) => `literal:${l}`)
      : []
    const evidence = credArgs.length ? credArgs : viaDecl.length ? viaDecl : literals
    if (!evidence.length) {
      for (const arg of args) {
        // 同一文件内同一被序列化变量只记一次(同一条语句常有 status + error 两个上下文命中)
        const k = `${file}::${norm(arg)}`
        if (candidates.some((c) => c.key === k)) continue
        candidates.push({ key: k, file, line: usageLine, arg: norm(arg).slice(0, 60) })
      }
      continue
    }
    const kind = credArgs.length
      ? 'stringify-cred-arg'
      : viaDecl.length
        ? 'stringify-cred-via-declaration'
        : 'token-literal-in-message'
    /** 稳定 key 后缀:只有 kind + 凭据证据,不含行号、不含整段窗口文本 */
    const snippet = `${kind}|${evidence.join(',')}`
    const key = `${file}::${snippet}`
    if (exempt.has(key)) continue
    const rec = {
      file,
      line: usageLine,
      kind,
      evidence: evidence.join(','),
      snippet,
      key,
      /** 给人看的窗口原文摘录(不进 key) */
      excerpt: norm(text).slice(0, 160),
      /** 该物理点被几个 4xx/5xx 起点命中(跨行写法通常 2 个) */
      contexts: 1,
      lines: [usageLine],
    }
    violations.push(rec)
    const cluster = clusters.get(key) || { recs: [], ranges: [] }
    clusters.set(key, cluster)
    cluster.recs.push(rec)
    cluster.ranges.push([start, endIndex])
    const merged = cluster.ranges.slice(0, -1).findIndex((r) => rangesOverlap(r, [start, endIndex]))
    if (merged >= 0) {
      // 同一物理外泄点的第二个起点 → 撤销刚追加的那条,并入前一条(计数只 +1)
      violations.pop()
      cluster.recs.pop()
      cluster.ranges[merged] = [
        Math.min(cluster.ranges[merged][0], start),
        Math.max(cluster.ranges[merged][1], endIndex),
      ]
      const prev = cluster.recs[merged]
      prev.contexts += 1
      if (!prev.lines.includes(usageLine)) prev.lines.push(usageLine)
    }
  }
  return { violations, candidates }
}

/** 命中项按「生产代码 / 测试代码」分桶:测试代码里的凭据字面量属 mock,降为 warn 不计入失败。 */
export function partitionByTestPath(items) {
  const prod = []
  const test = []
  for (const it of items) (TEST_PATH.test(it.file) ? test : prod).push(it)
  return { prod, test }
}

function gitLines(args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 待扫文件:--staged 走暂存区,否则走 git ls-files;统一限定源码扩展名与扫描根。 */
export function listCandidatesToScan(staged) {
  const files = staged
    ? gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    : gitLines(['ls-files'])
  return files.filter(
    (f) =>
      SCAN_ROOTS.some((r) => f.startsWith(r)) &&
      SOURCE_EXT.has(extname(f).toLowerCase()) &&
      !SKIP_DIR.test(f) &&
      !f.endsWith('.d.ts'),
  )
}

/** 读基线(缺文件/坏 JSON 一律按空基线处理,但由调用方给出提示)。 */
export function readBaselineRaw() {
  if (!existsSync(BASELINE_PATH)) return { ok: true, exempt: [] }
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    const list = Array.isArray(parsed && parsed.exempt) ? parsed.exempt : []
    const keys = list
      .filter((e) => typeof e === 'string')
      .map((e) => e.trim())
      .filter(Boolean)
    return { ok: true, exempt: keys }
  } catch {
    return { ok: false, exempt: [] }
  }
}

export function writeBaseline(keys) {
  const payload = {
    _comment:
      '存量豁免清单:key = "<repo相对路径>::<kind>|<凭据证据>"(证据=凭据类 stringify 实参 / via:<声明名> / literal:<令牌名>,已排序去重)。**刻意不含行号**,故调用点上方增删行不会让豁免失效。只减不增;新增条目须说明理由。',
    exempt: [...new Set(keys)].sort(),
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8')
}

/** 内置判据样例(want: 'violation' | 'candidate' | 'none'),--self-test 与镜像测试共用同一份。 */
export const SELFTEST_CASES = [
  {
    name: '502 + JSON.stringify(tokenData) → 违规',
    src: 'return reply.status(502).send(error(502, `IMS 令牌失败: ${JSON.stringify(tokenData).slice(0, 400)}`))',
    want: 'violation',
  },
  {
    name: '变量名无凭据语义(errData)→ 仅候选',
    src: 'return reply.status(502).send(error(502, `调用失败: ${JSON.stringify(errData).slice(0, 400)}`))',
    want: 'candidate',
  },
  {
    name: '同名无关 token 变量不参与判定(只看被序列化实参)→ 仅候选',
    src: "const tokenResp = await fetch(url)\nreturn reply.status(502).send(error(502, 'x' + JSON.stringify(body)))",
    want: 'candidate',
  },
  {
    name: '对象字面量含 access_token → 违规',
    src: "return reply.status(500).send(error(500, 'e:' + JSON.stringify({ access_token: t })))",
    want: 'violation',
  },
  {
    name: 'message 字面量出现 refresh_token → 违规',
    src: "throw new ApiError(502, 'refresh_token rejected ' + JSON.stringify(payload))",
    want: 'violation',
  },
  {
    name: '跨行拼接(status 在上一行,stringify 在下一行)→ 违规',
    src: 'return reply.status(502).send(\n  error(502, `失败: ${resp.status} ${JSON.stringify(clientSecretPayload).slice(0, 400)}`),\n)',
    want: 'violation',
  },
  {
    name: '非凭据变量跨行 → 仅候选',
    src: 'return reply.status(502).send(\n  error(502, `失败: ${JSON.stringify(genData).slice(0, 400)}`),\n)',
    want: 'candidate',
  },
  {
    name: '经声明间接外泄(const detail = JSON.stringify(authToken))→ 违规',
    src: 'const detail = JSON.stringify(authToken).slice(0, 200)\nreturn reply.status(502).send(error(502, `失败 ${detail}`))',
    want: 'violation',
  },
  {
    name: '2xx 上下文 → 不判(无 4xx/5xx 语义)',
    src: 'return reply.status(200).send(success(200, JSON.stringify(tokenData)))',
    want: 'none',
  },
  {
    name: '注释行 → 忽略',
    src: '// return reply.status(502).send(error(502, JSON.stringify(tokenData)))\nconst a = 1',
    want: 'none',
  },
  {
    name: '401 + bearer 变量 → 违规',
    src: "return reply.status(401).send(error(401, 'bad ' + JSON.stringify(bearerResponse)))",
    want: 'violation',
  },
]

/** 对单条样例求解类别(violation / candidate / none),供 --self-test 与镜像测试复用。 */
export function evalCase(src) {
  const r = scanSource(src, 'selftest.ts')
  return r.violations.length ? 'violation' : r.candidates.length ? 'candidate' : 'none'
}

function selfTest() {
  // 下面每条 src 是故意构造的判据样例(带 cred 语义应被抓住,不带的只做候选/放过)。
  let bad = 0
  for (const c of SELFTEST_CASES) {
    const got = evalCase(c.src)
    const ok = got === c.want
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${c.name}(期望 ${c.want},实得 ${got})`)
  }
  const n = SELFTEST_CASES.length
  console.log(bad === 0 ? `\nself-test 全通过(${n} 例)` : `\nself-test 失败 ${bad}/${n} 例`)
  return bad === 0
}

function printHelp() {
  console.log(
    [
      '用法: node scripts/check-credential-leak-in-message.mjs [选项]',
      '',
      '拦截「上游凭据/令牌类响应体被 JSON.stringify 后塞进 4xx/5xx 错误 message」的外泄路径。',
      '(非 2xx 响应不经 response-sanitizer 脱敏,拼进 message 即绕过脱敏。)',
      '',
      '选项:',
      '  --staged            仅扫描暂存区文件(pre-commit 模式)',
      '  --quiet             只输出结论,不打印低置信候选清单',
      '  --update-baseline   把当前高危违规写入基线(存量豁免,只减不增)',
      '  --self-test         跑内置判据自检',
      '  --help              显示本帮助',
      '',
      '退出码: 0 通过 / 1 检出违规 / 2 脚本自身异常',
    ].join('\n'),
  )
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    printHelp()
    return 0
  }
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1
  const staged = argv.includes('--staged')
  const quiet = argv.includes('--quiet')
  const baseline = readBaselineRaw()
  if (!baseline.ok) {
    console.error(
      '❌ 基线文件 scripts/credential-leak-baseline.json 解析失败(须为 { exempt: string[] })',
    )
    return 2
  }
  const exempt = new Set(baseline.exempt)
  const files = listCandidatesToScan(staged)
  const violations = []
  const candidates = []
  for (const f of files) {
    const abs = resolve(ROOT, f)
    if (!existsSync(abs)) continue
    const found = scanSource(readFileSync(abs, 'utf8'), f, exempt)
    violations.push(...found.violations)
    candidates.push(...found.candidates)
  }
  const mode = staged ? '--staged' : '全量'
  const { prod, test } = partitionByTestPath(violations)
  if (prod.length) {
    console.log(
      `❌ [check-credential-leak-in-message ${mode}] ${prod.length} 处凭据体外泄进错误 message:`,
    )
    for (const v of prod.slice(0, 40)) {
      console.log(
        `   ${v.file}:${v.line} [${v.kind}] 证据 ${v.evidence}` +
          (v.contexts > 1 ? `(同一物理点 ${v.contexts} 个 4xx/5xx 起点,已合并)` : ''),
      )
      console.log(`     ${v.excerpt}`)
    }
    if (prod.length > 40) console.log(`   ... 其余 ${prod.length - 40} 处`)
    console.log(
      '   修复:message 只留厂商/状态码/白名单错误字段,上游响应体不得整体 stringify 回传。',
    )
  } else {
    console.log(
      `✅ [check-credential-leak-in-message ${mode}] 扫描 ${files.length} 文件,凭据外泄高危 0 处`,
    )
  }
  if (test.length) {
    console.log(`⚠️  测试代码 ${test.length} 处命中(warn-only:mock 凭据非真实外泄路径)`)
  }
  if (!quiet && candidates.length) {
    console.log(
      `ℹ️  低置信候选 ${candidates.length} 处(上游错误体透传,变量名不含凭据语义 → 不计入失败,仅供人审):`,
    )
    for (const c of candidates.slice(0, 40))
      console.log(`   ${c.file}:${c.line}  JSON.stringify(${c.arg})`)
    if (candidates.length > 40) console.log(`   ... 其余 ${candidates.length - 40} 处`)
  }
  if (argv.includes('--update-baseline')) {
    writeBaseline(prod.map((v) => v.key))
    console.log(`✅ 基线已写入 ${prod.length} 条(只减不增,新增违规仍会被拦)`)
    return 0
  }
  return prod.length ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  Promise.resolve(main())
    .then((code) => process.exit(code ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  scanSource,
  findStatusContexts,
  extractWindow,
  findStringifyArgs,
  firstArgOf,
  parenDepth,
  advanceQuoted,
  advanceTemplateExpr,
  collectDeclarations,
  resolveDeclaredRhs,
  classifyStringifyArg,
  evalCase,
  SELFTEST_CASES,
  listCandidatesToScan,
  partitionByTestPath,
  readBaselineRaw,
  main,
  CRED_SEMANTIC_RE,
  CRED_LITERAL_RE,
  STATUS_CTX_RE,
  BASELINE_PATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
