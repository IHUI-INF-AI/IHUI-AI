#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-direct-backend-calls.mjs — 「端内绕过 @ihui/api-client 直连后端」守门(2026-09-24 立)。
 *
 * 规则出处(AGENTS.md §3 共享层优先 · api-client 条):
 *   「禁止在端内直接用 fetch/axios/Taro.request 调后端,必须走 @ihui/api-client;
 *     端内可保留 re-export wrapper + 平台 adapter。」
 *   此前 96+ 道守门里**没有任何一道**管这件事(`grep -rl "Taro.request" scripts/check-*.mjs` 命中 0),
 *   于是 apps/miniapp-taro/src/utils/crash-report.ts 用 Taro.request 直发 `${BASE_URL}/crash-reports`、
 *   apps/miniapp-taro/src/lib/sse.ts 用 enableChunked + H5 fetch 直发流式接口,长期无人拦截。
 *
 * ── 判据(全部是**结构特征**,不靠文件名白名单)────────────────────────────────
 *  1. 直接调用点:裸 `fetch(` / `axios(.get|.post|…)(` / `{Taro,wx,my,tt,swan,qq,ks,uni}.request(` /
 *     `new XMLHttpRequest(`(+ 同文件 `.open(method, url)` 的第二个实参)/ `navigator.sendBeacon(` /
 *     `http(s).request(`。`fetchApi(` / `fetchXxx(` 这类封装名不匹配(要求 fetch 紧跟左括号)。
 *  2. 「URL 是否指向本仓后端」= 对 URL 实参做**污点传播**,污点源只有两类:
 *     - **后端基址符号**:名字命中 BASE_URL / API_BASE_URL / API_URL / API_BASE / apiBase / apiUrl /
 *       apiConfig / baseUrl 等(见 BASE_SYM_RE),或环境变量 TARO_APP_API_BASE / NEXT_PUBLIC_API_* /
 *       VITE_API_* / IHUI_AI_PROXY_TARGET,或字面量里出现自家后端 host(localhost:880x / api.aizhs.top)。
 *     - **锚定的 `/api/` 路径字面量**:模板/字符串里带 `/api/` 段。**第三方正向域名排除**
 *       (`https://discord.com/api/v10/...` 里 host 是别人家 → 不算本仓后端)。
 *  3. 传播链(深度上限 5,带环保护):标识符 → 同文件赋值/构造参数/解构 → 仍不可解则
 *     **跨文件回溯调用方**(该标识符是某个导出函数的形参时,在所有从本文件 import 了它的源文件里
 *     找到调用点,按位置或对象属性把实参表达式拿去同规则复核)。
 *     → 这就是 sse.ts:211/279 被抓到的路径:它自己不含任何基址符号,但
 *       apps/miniapp-taro/src/api/index.ts:498 用 `url: BASE_URL + '/ai/chat/stream'` 调 `streamSSE`,
 *       污点从调用方灌进形参,端内直连的事实成立。
 *  4. **两类合法调用点的区分**(题目要求的结构特征):
 *     - **平台 adapter / transport**(§3 明确允许):三条同时成立才豁免 ——
 *       (a) URL 实参是**纯透传**(单个标识符,不与任何字面量/基址拼接);
 *       (b) 该文件从 `@ihui/api-client` import 了符号(它参与共享层契约);
 *       (c) 该文件的导出被**注册进 api-client**:某个 import 了 `setTransport`(且来自
 *           `@ihui/api-client`)的文件里出现 `setTransport(<本文件导出名>)`。
 *       实测正例:apps/miniapp-taro/src/utils/api-client-transport.ts:43 实现 Transport,
 *       由 apps/miniapp-taro/src/app.tsx:22 import setTransport + :38 setTransport(createTaroTransport())
 *       注入 → 豁免,而**不是**因为文件名含 transport。判据 (c) 同时排掉同名巧合
 *       (apps/web/src/components/mcp/mcp-manager.tsx:59 的 `setTransport` 是 React useState setter,
 *        不是从 @ihui/api-client import 的,不构成豁免证据)。
 *     - **服务端自有路由调用**(Next BFF,不算绕过后端):仅当 URL 是**同源相对** `/api/<seg>/…`
 *       且 `apps/web/app/api/<seg>/…/route.ts` 该文件真实存在(Next 自己处理该请求)时判为自有路由。
 *       实测 apps/web 全部 route handler 只有 10 个,`app/api/` 下仅 `desktop-feed` 一个 →
 *       web 端其余 `fetch('/api/xxx')` 都是靠 next.config.js `rewrites()`(`source:'/api/:path*'` →
 *       8802/8803)代理到后端,性质上就是端内直连后端,照常计入命中(存量进基线)。
 *  5. **扫描面**:apps/* 与 packages/* 全部 workspace 源码。排除的是「不可能违规的角色」而非文件名:
 *     - `apps/api`(它就是后端本体,package.json 不依赖 @ihui/api-client)/ `apps/ai-service`(Python);
 *     - `packages/api-client`(§3 指定的那条通道本身,它的 transport.ts/client.ts 必须裸 fetch);
 *     - 构建产物与厂商打包资源(复用 scripts/lib/exclude-dirs.mjs 的共享清单 + public/static/assets)、
 *       测试目录与 `*.test.*` / `*.spec.*` / `*.d.ts` / `*.min.*`、注释行。
 *
 * ── 基线语义:**清单基线**(取 check-adapter-wiring.mjs 那一档,不取 scan-hardcoded-zh.mjs 的每文件计数棘轮)
 *    理由:本门的违规单位是「一个具名的绕过调用点」,不是一行可数文本。
 *    若用每文件计数,作者在同一文件里**删掉一个旧绕过 + 新增一个新绕过**就计数中性蒙混过关,
 *    而绕过点对应的后端端点(要不要迁进 api-client)恰恰是 review 要看的东西;
 *    清单基线以 `相对路径::调用形式::URL 表达式指纹` 为 key,逐点祖父条款,
 *    改动既有绕过点的 URL 会换指纹 → 视作新增 → 必须重新 review,天然「只减不增」。
 *
 * 退出码:0 = 无新增绕过(含 WARN);1 = 出现基线外的新增直连;2 = 脚本自身异常/扫不到任何文件
 *        (空输入**绝不**判绿)。`--update-baseline` 只在「存量确实清完/迁移进 api-client」后人工跑。
 *
 * 用法:
 *   node scripts/check-direct-backend-calls.mjs                  # 全量扫描 + 基线对账
 *   node scripts/check-direct-backend-calls.mjs --staged          # 只判暂存文件(pre-commit;暂存集空则回退全量)
 *   node scripts/check-direct-backend-calls.mjs --list            # 打印全部命中(含基线内),定位存量用
 *   node scripts/check-direct-backend-calls.mjs --json <out.json> # 机器可读报告
 *   node scripts/check-direct-backend-calls.mjs --update-baseline # 用当前全量命注重写基线(收紧额度)
 *   node scripts/check-direct-backend-calls.mjs --self-test       # 判据内建自检(内存语料,不碰真实源码)
 *   node scripts/check-direct-backend-calls.mjs --root <dir>      # 指定扫描根(测试/审计缝,同 check-pwsh-version 口径)
 *   node scripts/check-direct-backend-calls.mjs --help
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_REL = 'scripts/direct-backend-calls-baseline.json'

/** 角色性排除的 workspace(不是「端」,不可能「绕过共享层」) */
const EXCLUDED_WORKSPACES = new Set(['apps/api', 'apps/ai-service', 'packages/api-client'])
/** 构建产物 / 厂商打包资源 / 测试目录(脚本特有,叠加在共享清单之上) */
const EXTRA_EXCLUDED_DIRS = new Set([
  'public', 'static', 'assets', 'resources', 'vendor', 'android', 'ios', 'webview',
  'wwwroot', 'playwright-report', '__tests__', '__mocks__', 'tests', 'test', 'e2e', 'fixtures',
])
const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const SKIP_FILE_RE = /(\.test\.|\.spec\.|\.d\.ts$|\.min\.(js|mjs|cjs|jsx)$|\.gen\.ts$)/

/** 污点源:后端基址符号名(出现在 URL 表达式里即认为该 URL 由后端基址拼出) */
const BASE_SYM_RE =
  /(?:^|[^\w$])(?:[A-Za-z_$][\w$]*_)?(?:BASE_URL|API_BASE_URL|API_URL|API_BASE|API_ORIGIN|apiBase|apiBaseUrl|apiUrl|apiPath|apiConfig|apiOrigin|backendUrl|API_HOST|apiHost)(?![\w$])|\bbaseURL\b|\bbaseUrl\b/
const ENV_BACKEND_RE =
  /TARO_APP_API_BASE|NEXT_PUBLIC_API(?:_[A-Z]+)*|VITE_API(?:_[A-Z]+)*|IHUI_AI_PROXY_TARGET|API_PROXY_TARGET/
/** 自家后端 host(docs/port-management.md:8802=api、8803=ai-service;**8801 是 web 自身**,
 *  写 880\d 会把 getPublicBaseUrl() 回退的 localhost:8801 也当后端 → playground 那类
 *  "同源 + /v1/... 打中继"的调用被误判,故只认 api/ai-service 两个端口) */
const OWN_HOST_RE = /localhost:880[23]|127\.0\.0\.1:880[23]|0\.0\.0\.0:880[23]|api\.aizhs\.top|api\.ihui\.ai/
/** 第三方正式 URL(host 非本仓)→ 排除,不让 discord 这类 IdP 端点被当成本仓后端 */
const ABS_THIRD_PARTY_RE = /['"`]https?:\/\/(?!localhost:880[23]|127\.0\.0\.1:880[23]|api\.aizhs\.top|api\.ihui\.ai)[^/'"`]+/
/** 锚定在本仓后端语义的 /api/ 路径段 */
const API_PATH_RE = /\/api\/[A-Za-z0-9_.$-]/
const URL_ARG_KEYS = new Set(['url', 'uri', 'href', 'endpoint'])

const CALL_PATTERNS = [
  { kind: 'fetch', re: /(?<![\w$])(?:globalThis\.|window\.|self\.)?fetch\s*\(/g, argMode: 'first-positional' },
  { kind: 'axios', re: /(?<![\w$])axios(?:\.\w+)?\s*\(/g, argMode: 'first-positional' },
  {
    kind: 'miniapp-request',
    re: /(?<![\w$.])(?:Taro|wx|my|tt|swan|qq|ks|uni|qa)\.request\s*\(/g,
    argMode: 'object-url',
  },
  {
    kind: 'sendBeacon',
    re: /(?<![\w$])navigator\.sendBeacon\s*\(/g,
    argMode: 'first-positional',
  },
  { kind: 'xhr', re: /(?<![\w$])new\s+XMLHttpRequest\s*\(/g, argMode: 'xhr-open' },
  { kind: 'node-http', re: /(?<![\w$])https?\.request\s*\(/g, argMode: 'auto' },
]

// ──────────────────────────────────────────────────────────────────────────────
// 语料
// ──────────────────────────────────────────────────────────────────────────────

function walk(absDir, root, out) {
  let entries
  try {
    entries = readdirSync(absDir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(absDir, e.name)
    const rel = relative(root, full).replace(/\\/g, '/')
    if (e.isDirectory()) {
      if (isExcludedDirName(e.name) || EXTRA_EXCLUDED_DIRS.has(e.name)) continue
      walk(full, root, out)
    } else if (SOURCE_EXTS.includes(extnameOf(e.name)) && !SKIP_FILE_RE.test(rel)) {
      out.push(rel)
    }
  }
  return out
}

function extnameOf(name) {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i)
}

/** 收集扫描语料:relPath -> 原始源码(注释剥离在 analyzeCorpus 里统一做,保证注入测试走同一条路) */
export function buildCorpus(root = DEFAULT_ROOT) {
  const files = []
  for (const top of ['apps', 'packages']) {
    const base = join(root, top)
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base)) {
      const dir = join(base, entry)
      if (!statSync(dir).isDirectory()) continue
      const relTop = `${top}/${entry}`
      if (EXCLUDED_WORKSPACES.has(relTop)) continue
      walk(dir, root, files)
    }
  }
  const corpus = new Map()
  for (const rel of files.sort()) {
    let src
    try {
      src = readFileSync(join(root, rel), 'utf8')
    } catch {
      continue
    }
    const lines = src.split('\n')
    if (lines.length < 8 && src.length > 4000) continue // minified 产物兜底(目录漏排时)
    corpus.set(rel, src)
  }
  return corpus
}

/**
 * 一次扫描同时产出:① 注释清零(保留换行 ⇒ 行号不变)的代码文本;② 字符串掩码。
 *
 * 字符串掩码为什么必需:`apps/web/src/components/api-docs/SdkExamples.tsx:194` 里的
 *   code: `const resp = await fetch("https://api.ihui.ai/v1/chat/completions", {...})`
 * 是**文档示例代码字符串**,不是调用点。只剥注释会把 SDK 样本判成违规(实测首版就误伤)。
 * 规则:调用点**锚点位置**落在字符串/模板内部 ⇒ 不是真调用。
 * 单/双引号要求同行闭合(JSX 正文里的英文撇号 `don't` 不得开启字符串);反引号允许多行。
 * 注释里的字符串/斜杠也不参与判定:注释整段先被清成空格。
 */
export function scanCode(src) {
  const chars = src.split('')
  const n = chars.length
  const mask = new Uint8Array(n)
  let i = 0
  let inBlock = false
  while (i < n) {
    const c = chars[i]
    const next = chars[i + 1]
    if (inBlock) {
      if (c === '*' && next === '/') {
        chars[i] = ' '
        chars[i + 1] = ' '
        i += 2
        inBlock = false
        continue
      }
      if (c !== '\n') chars[i] = ' '
      i += 1
      continue
    }
    if (c === '/' && next === '/') {
      while (i < n && chars[i] !== '\n') {
        chars[i] = ' '
        i += 1
      }
      continue
    }
    if (c === '/' && next === '*') {
      chars[i] = ' '
      chars[i + 1] = ' '
      i += 2
      inBlock = true
      continue
    }
    if (c === "'" || c === '"') {
      const end = closeQuoteOnLine(chars, i, c)
      if (end > 0) {
        for (let k = i + 1; k < end; k++) mask[k] = 1
        i = end + 1
      } else i += 1
      continue
    }
    if (c === '`') {
      const end = closeTemplate(chars, i)
      if (end > 0) {
        for (let k = i + 1; k < end; k++) mask[k] = 1
        i = end + 1
      } else i += 1
      continue
    }
    i += 1
  }
  return { code: chars.join(''), mask }
}

function closeQuoteOnLine(chars, start, quote) {
  for (let k = start + 1; k < chars.length; k++) {
    const c = chars[k]
    if (c === '\\') {
      k += 1
      continue
    }
    if (c === '\n') return -1
    if (c === quote) return k
  }
  return -1
}

/** 模板字面量的收尾反引号:`${ … }` 内部(含嵌套括号/对象字面量)不算结束 */
function closeTemplate(chars, start) {
  let depth = 0
  for (let k = start + 1; k < chars.length; k++) {
    const c = chars[k]
    if (c === '\\') {
      k += 1
      continue
    }
    if (c === '$' && chars[k + 1] === '{') {
      depth += 1
      k += 1
      continue
    }
    if (depth > 0) {
      if (c === '}') depth -= 1
      continue
    }
    if (c === '`') return k
  }
  return -1
}

/** 注释剥离(行号保持);带掩码版本直接调用 scanCode */
export function stripComments(src) {
  return scanCode(src).code
}

// ──────────────────────────────────────────────────────────────────────────────
// 调用点提取
// ──────────────────────────────────────────────────────────────────────────────

function lineOf(text, idx) {
  let n = 1
  for (let i = 0; i < idx; i++) if (text[i] === '\n') n++
  return n
}

/** 从 openIdx(左括号下标)读配平的整段,返回 [内部文本, 结束下标] */
function readBalanced(text, openIdx) {
  const pairs = { '(': ')', '{': '}', '[': ']' }
  const stack = []
  let inStr = null
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === inStr) inStr = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c
      continue
    }
    if (pairs[c]) stack.push(c)
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.length === 0) return [null, i]
      const open = stack.pop()
      if (pairs[open] !== c) return [null, i]
      if (stack.length === 0) return [text.slice(openIdx + 1, i), i]
    }
  }
  return [null, text.length]
}

/** 顶层逗号切分(配平内部不切) */
function splitTopLevel(inner) {
  const out = []
  let depth = 0
  let inStr = null
  let cur = ''
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (inStr) {
      cur += c
      if (c === '\\') {
        cur += inner[++i] ?? ''
      } else if (c === inStr) inStr = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c
      cur += c
      continue
    }
    if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth--
    if (c === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim() !== '') out.push(cur)
  return out.map((s) => s.trim())
}

/** 对象字面量文本里取 url/uri/href/endpoint 属性的值表达式 */
function objectUrlProp(objText) {
  if (objText == null) return null
  let body = objText.trim()
  if (body.startsWith('{') && body.endsWith('}')) body = body.slice(1, -1) // 外层花括号要让顶层逗号可见
  for (const entry of splitTopLevel(body)) {
    const m = /^(?:['"`]?([A-Za-z_$][\w$]*)['"`]?)\s*:\s*([\s\S]+)$/.exec(entry)
    if (m && URL_ARG_KEYS.has(m[1])) return m[2].trim()
    if (!m && URL_ARG_KEYS.has(entry)) return entry // 简写 `{ url, method }`
  }
  return null
}

/** 同一文件内为 XHR 找 `.open(method, url)` 的第二实参 */
function xhrOpenUrl(text, fromIdx) {
  const re = /\.open\s*\(/g
  re.lastIndex = fromIdx
  const m = re.exec(text)
  if (!m) return null
  const [inner] = readBalanced(text, m.index + m[0].length - 1)
  if (inner == null) return null
  const args = splitTopLevel(inner)
  return args[1] ?? null
}

export function findCallSites(text, mask) {
  const sites = []
  for (const pat of CALL_PATTERNS) {
    pat.re.lastIndex = 0
    let m
    while ((m = pat.re.exec(text))) {
      if (mask && mask[m.index] === 1) continue // 位于字符串/模板内:文档示例代码,不是调用点
      const openIdx = m.index + m[0].length - 1
      let expr = null
      if (pat.argMode === 'first-positional' || pat.argMode === 'auto') {
        const [inner] = readBalanced(text, openIdx)
        expr = inner == null ? null : (splitTopLevel(inner)[0] ?? null)
        if (pat.argMode === 'auto' && expr && expr.trim().startsWith('{')) {
          expr = objectUrlProp(expr)
        }
      } else if (pat.argMode === 'object-url') {
        const [inner] = readBalanced(text, openIdx)
        expr = inner == null ? null : objectUrlProp(inner)
      } else if (pat.argMode === 'xhr-open') {
        expr = xhrOpenUrl(text, openIdx)
      }
      if (expr == null) continue
      sites.push({
        kind: pat.kind,
        line: lineOf(text, m.index),
        idx: m.index,
        urlExpr: expr.replace(/\s+/g, ' ').trim(),
      })
    }
  }
  return sites
}

// ──────────────────────────────────────────────────────────────────────────────
// 污点判定
// ──────────────────────────────────────────────────────────────────────────────

/** Next 自有路由段集合(apps/web/app/api/<seg>/** /route.ts)—— 结构判据,不是文件名 */
function collectWebOwnRouteSegments(root) {
  const segs = new Set()
  const base = join(root, 'apps', 'web', 'app', 'api')
  const walkSeg = (dir, top) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walkSeg(join(dir, e.name), top || e.name)
      else if (top && /^route\.(ts|tsx|js)$/.test(e.name)) segs.add(top)
    }
  }
  if (existsSync(base)) walkSeg(base, '')
  return segs
}

function firstApiSegment(expr) {
  const m = /['"`]\/api\/([^/'"`?]+)/.exec(expr)
  return m ? m[1] : null
}

function purePassthrough(expr) {
  return /^[A-Za-z_$][\w$.]*$/.test(expr.trim())
}

function baseSymHit(expr) {
  if (ENV_BACKEND_RE.test(expr) || OWN_HOST_RE.test(expr)) return true
  if (ABS_THIRD_PARTY_RE.test(expr) && !BASE_SYM_RE.test(expr) && !API_PATH_RE.test(expr)) return false
  if (BASE_SYM_RE.test(expr)) {
    // baseUrl/baseURL 常是"任意 HTTP 客户端"的基址(discord/coze 等第三方),
    // 只有同一表达式里还有 /api/ 路径段或自家 host 才算本仓后端 —— 宁漏第三方不误伤本仓。
    if (/baseUrl|baseURL|apiPath/i.test(expr) && !API_PATH_RE.test(expr) && !OWN_HOST_RE.test(expr)) return false
    return true
  }
  return false
}

/** 表达式里出现的 /api/ 路径段是否命中 Next 自有路由(仅 apps/web 相对同源调用) */
function isWebOwnRoute(expr, file, webOwnSegs) {
  if (!file.startsWith('apps/web/')) return false
  if (/['"`]https?:\/\//.test(expr)) return false // 绝对 URL 不是同源相对路由
  const seg = firstApiSegment(expr)
  return seg != null && webOwnSegs.has(seg)
}

/** 表达式表面是否有后端路径/基址特征 */
function surfaceTaint(expr, file, webOwnSegs) {
  if (isWebOwnRoute(expr, file, webOwnSegs)) return { tainted: false, evidence: 'Next 自有路由(app/api 下存在 route handler)' }
  if (baseSymHit(expr)) return { tainted: true, evidence: 'URL 含后端基址符号/环境变量/自家 host' }
  if (API_PATH_RE.test(expr)) {
    if (ABS_THIRD_PARTY_RE.test(expr)) return { tainted: false, evidence: '/api/ 段属第三方域名(非本仓后端)' }
    return { tainted: true, evidence: 'URL 含本仓后端 /api/ 路径段' }
  }
  return { tainted: false, evidence: null }
}

// ---- 同文件符号定义解析 ----------------------------------------------------

function collectAssignments(text) {
  // name -> [{ expr, kind }]
  const map = new Map()
  const push = (name, expr, kind) => {
    if (!name) return
    if (!map.has(name)) map.set(name, [])
    map.get(name).push({ expr, kind })
  }
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]{0,120})?=\s*([^\n;]{0,400})/g
  for (const m of text.matchAll(re)) push(m[1], m[2], 'assign')
  const reAssign = /(?:this\.)?([A-Za-z_$][\w$]*)\s*=\s*([^\n;]{0,400})/g
  for (const m of text.matchAll(reAssign)) {
    if (/^(const|let|var)$/.test(m[1])) continue
    push(m[1], m[2], 'assign')
  }
  // 解构:const { url, headers: extraHeaders } = options
  const reDe = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*([A-Za-z_$][\w$.]*)/g
  for (const m of text.matchAll(reDe)) {
    const src = m[2]
    for (const part of m[1].split(',')) {
      const p = part.trim()
      if (!p) continue
      const kv = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/.exec(p)
      if (kv) push(kv[2], `${src}.${kv[1]}`, 'destructure')
      else if (/^[A-Za-z_$][\w$]*$/.test(p)) push(p, `${src}.${p}`, 'destructure')
    }
  }
  // 构造参数属性 / 形参默认值:constructor(private apiUrl: string) / fn(url = X)
  const reCtor = /constructor\s*\(([^)]*)\)/g
  for (const m of text.matchAll(reCtor)) {
    for (const p of splitTopLevel(m[1])) {
      const t = p.trim().replace(/^(?:private|public|protected|readonly)\s+/, '')
      const mm = /^([A-Za-z_$][\w$]*)\s*\??\s*(?::[^=]*)?(?:=\s*([\s\S]+))?$/.exec(t)
      if (mm) push(mm[1], (mm[2] ?? '').trim(), 'ctor-param')
    }
  }
  return map
}

/** 文件里 `import { a as b } from 'spec'` 的绑定表: localName -> { spec, importedName } */
function collectImports(text) {
  const out = []
  const re = /import\s+(?:type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g
  for (const m of text.matchAll(re)) {
    const clause = m[1].trim()
    const spec = m[2]
    const named = /\{([^}]*)\}/.exec(clause)
    if (named) {
      for (const raw of named[1].split(',')) {
        const t = raw.trim().replace(/^type\s+/, '')
        if (!t) continue
        const [orig, alias] = t.split(/\s+as\s+/).map((s) => s.trim())
        out.push({ local: alias || orig, imported: orig, spec })
      }
    }
    const def = /^(?!type|\*)([A-Za-z_$][\w$]*)$/.exec(clause)
    if (def) out.push({ local: def[1], imported: 'default', spec })
  }
  // require('./x') 形态(RN index.js 用)
  const reReq = /const\s*\{([^}]+)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const m of text.matchAll(reReq)) {
    for (const raw of m[1].split(',')) {
      const t = raw.trim()
      if (t) out.push({ local: t, imported: t, spec: m[2] })
    }
  }
  return out
}

const RESOLVE_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js']

/** 解析 import specifier 到语料内 relPath;包名/外部模块/文件不存在都返回 null
 *  (必须做**存在性**校验:'@/lib/sse' 光靠后缀猜测会返回无扩展名路径,与语料 key 对不上,
 *   跨文件污点回溯就永远找不到调用方 —— 实测漏判整条 sse.ts 链) */
export function resolveSpecifier(spec, fromFile, exists = () => false) {
  let absLike = null
  if (spec.startsWith('@/')) absLike = `apps/${fromFile.split('/')[1]}/src/${spec.slice(2)}`
  else if (spec.startsWith('~/')) absLike = `apps/${fromFile.split('/')[1]}/src/${spec.slice(2)}`
  else if (spec.startsWith('./') || spec.startsWith('../')) {
    const base = dirname(fromFile)
    absLike = join(base, spec).replace(/\\/g, '/')
  } else return null
  for (const e of RESOLVE_EXTS) {
    const cand = normalizeRel(absLike + e)
    if ((cand.startsWith('apps/') || cand.startsWith('packages/')) && exists(cand)) return cand
  }
  return null
}

function normalizeRel(p) {
  const parts = p.split('/')
  const stack = []
  for (const s of parts) {
    if (s === '.' || s === '') continue
    if (s === '..') stack.pop()
    else stack.push(s)
  }
  return stack.join('/')
}

/**
 * 注册进 @ihui/api-client 的 transport 适配器(§3 允许的平台 adapter)。
 * 返回 Map<文件 relPath, Set<被注册的导出名>> —— 判据要求 setTransport 必须来自 @ihui/api-client
 * 的 import,从而把 mcp-manager.tsx 那种同名 React setter 排除掉。
 */
export function collectRegisteredTransports(corpus) {
  const registered = new Map()
  for (const [file, text] of corpus) {
    const imports = collectImports(text)
    const hasSetTransport = imports.some(
      (i) => i.local === 'setTransport' && i.spec === '@ihui/api-client',
    )
    if (!hasSetTransport) continue
    for (const m of text.matchAll(/setTransport\s*\(/g)) {
      const openIdx = m.index + m[0].length - 1
      const [inner] = readBalanced(text, openIdx)
      if (inner == null) continue
      for (const idMatch of inner.matchAll(/([A-Za-z_$][\w$]*)\s*(?:\(\))?/g)) {
        const name = idMatch[1]
        const binding = imports.find((i) => i.local === name)
        if (!binding) continue
        const target = resolveSpecifier(binding.spec, file, (p) => corpus.has(p))
        if (!target) continue
        if (!registered.has(target)) registered.set(target, new Set())
        registered.get(target).add(binding.imported)
      }
    }
  }
  return registered
}

// ---- 跨文件调用方回溯 -------------------------------------------------------

/** 找到调用点所属的最近前置「导出函数/常量」声明 */
function enclosingExported(text, callIdx) {
  const re =
    /export\s+(?:async\s+)?(?:default\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+(?:async\s+)?function\s*\*([A-Za-z_$][\w$]*)|export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]{0,160})?=/g
  let best = null
  for (const m of text.matchAll(re)) {
    if (m.index >= callIdx) break
    best = { name: m[1] || m[2] || m[3], idx: m.index }
  }
  return best
}

/** 取导出函数的形参表: name -> {index} ; 解构 -> local -> {prop, viaDestructure:true} */
function paramMapOf(text, declIdx) {
  const openIdx = text.indexOf('(', declIdx)
  if (openIdx < 0) return { positional: new Map(), props: new Set() }
  const [inner] = readBalanced(text, openIdx)
  const positional = new Map()
  const props = new Set()
  if (inner == null) return { positional, props }
  const params = splitTopLevel(inner)
  params.forEach((p, i) => {
    const trimmed = p.trim()
    const de = /^\{([^}]*)\}/.exec(trimmed)
    if (de) {
      for (const part of de[1].split(',')) {
        const t = part.trim()
        if (!t) continue
        const kv = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/.exec(t)
        props.add(kv ? kv[2] : t.replace(/\?.*$/, '').split(/[:=]/)[0].trim())
        positional.set(t.replace(/[?]?:[\s\S]*$/, '').trim(), { index: i, destructured: true })
      }
      const objParamName = /^[A-Za-z_$][\w$]*(?=\s*[:=])/.exec(trimmed)
      if (objParamName) positional.set(objParamName[1], { index: i, objectParam: true })
      return
    }
    const named = /^([A-Za-z_$][\w$]*)/.exec(trimmed)
    if (named) positional.set(named[1], { index: i })
    const rest = trimmed.match(/\.\.\.([A-Za-z_$][\w$]*)/)
    if (rest) positional.set(rest[1], { index: i })
  })
  return { positional, props }
}

/** 在所有 import 了 `name`(来自 file)的语料文件里找 `name(...)` 调用点,返回实参文本 + 宿主文件 */
function findCallerArgs(corpus, file, name, webOwnSegs, cache) {
  const ck = `${file}::${name}`
  if (cache?.has(ck)) return cache.get(ck)
  const hits = []
  for (const [other, text] of corpus) {
    if (other === file) continue
    const imports = collectImports(text)
    let localName = null
    for (const i of imports) {
      if (i.imported !== name && !(i.imported === 'default' && i.local === name)) continue
      const target = resolveSpecifier(i.spec, other, (p) => corpus.has(p))
      if (target === file) localName = i.local
    }
    if (!localName) continue
    const re = new RegExp(`(?<![\\w$.])${localName.replace(/\$/g, '\\$')}\\s*\\(`, 'g')
    for (const m of text.matchAll(re)) {
      const openIdx = m.index + m[0].length - 1
      const [inner] = readBalanced(text, openIdx)
      if (inner == null) continue
      hits.push({ args: splitTopLevel(inner), file: other })
    }
  }
  if (cache) cache.set(ck, hits)
  return hits
}

/**
 * URL 表达式污点判定(带深度与环保护)。
 * @returns {{ tainted: boolean, evidence: string }}
 */
function taintOf(expr, file, ctx, depth = 0, seen = new Set()) {
  const clean = (evidence) => ({ tainted: false, evidence })
  if (!expr || depth > 5) return clean(null)
  const key = `${file}::${expr}`
  if (seen.has(key)) return clean(null)
  seen.add(key)

  const text = ctx.corpus.get(file)
  if (text == null) return clean(null)

  const surface = surfaceTaint(expr, file, ctx.webOwnSegs)
  if (surface.tainted || surface.evidence) return surface

  const trimmed = expr.trim()
  const ident = /^this\.([A-Za-z_$][\w$]*)$/.exec(trimmed) ? trimmed.slice(5) : trimmed
  if (!/^[A-Za-z_$][\w$]*$/.test(ident)) {
    // 拼接式但只含字面量与函数调用: 逐项拆出调用/标识符复核
    const parts = []
    for (const m of trimmed.matchAll(/([A-Za-z_$][\w$.]*)\s*\(/g)) parts.push(m[1].split('.').pop())
    for (const m of trimmed.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?![\w$(])/g)) parts.push(m[1])
    for (const p of parts) {
      const r = taintOf(p, file, ctx, depth + 1, seen)
      if (r.tainted) return { tainted: true, evidence: `${p} → ${r.evidence}` }
    }
    return clean(null)
  }

  const assigns = ctx.assignments(file)
  const defs = assigns.get(ident)
  if (defs && defs.length) {
    for (const d of defs) {
      if (!d.expr) continue
      const r = taintOf(d.expr, file, ctx, depth + 1, seen)
      if (r.tainted) return { tainted: true, evidence: `${ident} = ${d.expr.slice(0, 60)} → ${r.evidence}` }
    }
  }
  // 同文件内定义的函数: 复核其 return 表达式(getBridgeBaseUrl() → `${_apiBaseUrl}/api/...`)
  const fnText = functionBodyOf(text, ident)
  if (fnText) {
    for (const m of fnText.matchAll(/return\s+([\s\S]{0,300}?)(?:\n\s{0,6}\}|$)/g)) {
      const r = taintOf(m[1].trim(), file, ctx, depth + 1, seen)
      if (r.tainted) return { tainted: true, evidence: `${ident}() 返回 ${m[1].trim().slice(0, 50)} → ${r.evidence}` }
    }
  }
  // import 进来的符号: 跨包/跨端跟随到定义文件复核(apiUrl / getApiBase 等)
  for (const imp of collectImports(text)) {
    if (imp.local !== ident) continue
    const target = resolveSpecifier(imp.spec, file, (p) => ctx.corpus.has(p))
    if (!target || !ctx.corpus.has(target)) return clean('符号来自外部包,无源可追')
    const r = taintOfDefinitionOf(target, imp.imported, ctx, depth + 1, seen)
    if (r.tainted) return { tainted: true, evidence: `import {${imp.imported}} from '${imp.spec}' → ${r.evidence}` }
  }
  // 形参且文件内无可解定义 → 跨文件回溯调用方
  const enclosing = enclosingExported(text, firstUsageIndex(text, ident))
  if (enclosing) {
    const { positional } = paramMapOf(text, enclosing.idx)
    const info = positional.get(ident)
    const callerHits = findCallerArgs(ctx.corpus, file, enclosing.name, ctx.webOwnSegs, ctx.callerCache)
    for (const hit of callerHits) {
      let argExpr = null
      if (info && info.destructured) {
        for (const a of hit.args) {
          const v = objectUrlPropKeyed(a, ident)
          if (v) argExpr = v
        }
      } else if (info) {
        argExpr = hit.args[info.index] ?? null
        if (!argExpr && info.objectParam) {
          for (const a of hit.args) {
            const v = objectUrlPropKeyed(a, ident)
            if (v) argExpr = v
          }
        }
      } else {
        argExpr = objectUrlPropKeyed(hit.args[0] ?? '', ident)
      }
      if (!argExpr) continue
      const r = taintOf(argExpr, hit.file, ctx, depth + 1, seen)
      if (r.tainted)
        return {
          tainted: true,
          evidence: `调用方 ${hit.file} 传入 ${argExpr.slice(0, 50)} → ${r.evidence}`,
        }
    }
    if (callerHits.length) return clean(`形参 ${ident}(调用方实参无后端特征)`)
  }
  return clean(`标识符 ${ident} 无端内构造点(URL 由外部注入)`)
}

/** 目标符号在另一文件里的"定义即值":赋值 / 函数 return / 同名的对象属性初始化 */
function taintOfDefinitionOf(target, name, ctx, depth, seen) {
  const text = ctx.corpus.get(target)
  if (text == null) return { tainted: false, evidence: null }
  const assigns = ctx.assignments(target)
  const defs = assigns.get(name)
  if (defs) {
    for (const d of defs) {
      if (!d.expr) continue
      const r = taintOf(d.expr, target, ctx, depth + 1, seen)
      if (r.tainted) return { tainted: true, evidence: `${name} = ${d.expr.slice(0, 50)} → ${r.evidence}` }
    }
  }
  const fn = functionBodyOf(text, name)
  if (fn) {
    for (const m of fn.matchAll(/return\s+([\s\S]{0,300}?)(?:\n\s{0,6}\}|$)/g)) {
      const r = taintOf(m[1].trim(), target, ctx, depth + 1, seen)
      if (r.tainted) return { tainted: true, evidence: `${name}() 返回 ${m[1].trim().slice(0, 50)} → ${r.evidence}` }
    }
  }
  return { tainted: false, evidence: null }
}

function objectUrlPropKeyed(objText, key) {
  if (!objText || !objText.trim().startsWith('{')) return null
  for (const entry of splitTopLevel(objText.slice(1, -1))) {
    const m = /^(?:['"`]?([A-Za-z_$][\w$]*)['"`]?)\s*:\s*([\s\S]+)$/.exec(entry)
    if (m && m[1] === key) return m[2].trim()
    if (!m && entry === key) return entry
  }
  return null
}

function functionBodyOf(text, name) {
  const re = new RegExp(
    `(?:function\\s+${name}\\b|${name}\\s*(?:=|:)\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>?)`,
  )
  const m = re.exec(text)
  if (!m) return null
  const brace = text.indexOf('{', m.index)
  if (brace < 0) return null
  const [inner] = readBalanced(text.slice(brace), 0)
  return inner ?? text.slice(brace, brace + 600)
}

function firstUsageIndex(text, ident) {
  const re = new RegExp(`[.\\s(=,]${ident.replace(/\$/g, '\\$')}\\b`)
  const m = re.exec(text)
  return m ? m.index : text.length
}

// ──────────────────────────────────────────────────────────────────────────────
// 主流程
// ──────────────────────────────────────────────────────────────────────────────

export function analyzeCorpus(corpus, root = DEFAULT_ROOT) {
  // 注释一律先剥(保留换行 ⇒ 行号不变),同时得到字符串掩码:
  // 注释里的 `// fetch(`${BASE_URL}/x`)` 与文档示例模板里的 fetch 都不是调用点。
  const stripped = new Map()
  const masks = new Map()
  for (const [file, raw] of corpus) {
    const { code, mask } = scanCode(raw)
    stripped.set(file, code)
    masks.set(file, mask)
  }
  const ctx = {
    corpus: stripped,
    webOwnSegs: collectWebOwnRouteSegments(root),
    callerCache: new Map(),
    _assignCache: new Map(),
    assignments(file) {
      if (!this._assignCache.has(file)) this._assignCache.set(file, collectAssignments(stripped.get(file) ?? ''))
      return this._assignCache.get(file)
    },
  }
  const transports = collectRegisteredTransports(stripped)
  const hits = []
  const exempt = []
  for (const [file, text] of stripped) {
    for (const site of findCallSites(text, masks.get(file))) {
      const t = taintOf(site.urlExpr, file, ctx)
      if (!t.tainted) {
        const isTransportFile = transports.has(file)
        if (isTransportFile && purePassthrough(site.urlExpr)) {
          exempt.push({
            file,
            line: site.line,
            kind: site.kind,
            urlExpr: site.urlExpr,
            reason: `平台 adapter:导出经 setTransport(@ihui/api-client) 注册,URL 由共享层注入(${t.evidence ?? '透传'})`,
          })
        }
        continue
      }
      // 命中后端污点,但确属注册 transport 的纯透传 → 仍豁免(§3 允许的平台 adapter)
      if (transports.has(file) && purePassthrough(site.urlExpr)) {
        exempt.push({
          file,
          line: site.line,
          kind: site.kind,
          urlExpr: site.urlExpr,
          reason: `平台 adapter:导出经 setTransport(@ihui/api-client) 注册(URL 纯透传)`,
        })
        continue
      }
      hits.push({
        file,
        line: site.line,
        kind: site.kind,
        urlExpr: site.urlExpr,
        evidence: t.evidence,
        key: baselineKey(file, site.kind, site.urlExpr),
      })
    }
  }
  hits.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1))
  exempt.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1))
  return { hits, exempt, transports }
}

export function baselineKey(file, kind, urlExpr) {
  const sig = (urlExpr || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return `${file}::${kind}::${sig}`
}

function readBaseline(root) {
  const p = join(root, BASELINE_REL)
  if (!existsSync(p)) return { keys: [], missing: true }
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'))
    return { keys: Array.isArray(parsed.bypasses) ? parsed.bypasses : [], missing: false }
  } catch (e) {
    throw new Error(`基线文件解析失败 ${BASELINE_REL}: ${e.message}`)
  }
}

function stagedFiles(root) {
  try {
    return new Set(
      execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMRD'], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

const argv = process.argv.slice(2)

export function main({ root = DEFAULT_ROOT, argv: localArgv = argv, corpus: injectedCorpus } = {}) {
  const flags = new Set(localArgv)
  if (flags.has('--help') || flags.has('-h')) {
    console.log(
      [
        '用法: node scripts/check-direct-backend-calls.mjs [--staged|--list|--quiet|--update-baseline|--json <out>|--self-test|--root <dir>|--help]',
        '',
        '判据:端内(apps/* 与 packages/*,排除 apps/api / apps/ai-service / packages/api-client)出现',
        '      裸 fetch/axios/Taro.request/XMLHttpRequest/sendBeacon/http.request,且 URL 经污点分析指向',
        '      本仓后端(后端基址符号 / 环境变量 / 自家 host / 锚定 /api/ 路径段),即为绕过 @ihui/api-client。',
        '豁免:① 平台 adapter —— 文件从 @ihui/api-client import 符号,且其导出被 setTransport 注册,URL 纯透传;',
        '      ② Next 自有路由 —— apps/web 同源相对 /api/<seg>/… 且 app/api/<seg>/**/route.ts 真实存在。',
        '退出码:0=通过 1=基线外新增绕过 2=脚本异常(含扫不到文件)',
      ].join('\n'),
    )
    return 0
  }

  let corpus
  if (injectedCorpus) corpus = injectedCorpus
  else {
    corpus = buildCorpus(root)
  }  // 空输入绝不判绿:列不到文件属于"扫描器没跑起来",必须显式失败
  if (corpus.size === 0) {
    console.error('[check-direct-backend-calls] ❌ 扫描语料为空(apps/* 与 packages/* 一个源文件都没列到),拒绝判绿')
    return 2
  }

  const STAGED = flags.has('--staged')
  let effective = corpus
  if (STAGED) {
    const set = stagedFiles(root)
    if (set.size > 0) {
      const scoped = new Map()
      for (const [f, text] of corpus) {
        // 暂存集只收窄"哪些文件的命中要报告",但判据仍需全语料(跨文件污点回溯)
        if (set.has(f)) scoped.set(f, text)
      }
      if (scoped.size === 0) {
        console.log(`[check-direct-backend-calls] 暂存区无 in-scope 源码文件,跳过(全语料 ${corpus.size} 文件已解析)`)
        return 0
      }
      const full = analyzeCorpus(corpus, root)
      const reportable = full.hits.filter((h) => set.has(h.file))
      effective = corpus
      return report({ ...full, hits: reportable }, { root, scopedTo: set.size, scanned: corpus.size, quiet: flags.has('--quiet') || flags.has('-q'), list: flags.has('--list') })
    }
    console.log('[check-direct-backend-calls] --staged 但暂存集为空 → 回退全量口径(防空暂存恒绿)')
  }

  const result = analyzeCorpus(effective, root)
  return report(result, {
    root,
    scanned: effective.size,
    quiet: flags.has('--quiet') || flags.has('-q'),
    list: flags.has('--list'),
    updateBaseline: flags.has('--update-baseline'),
    jsonOut: localArgv[localArgv.indexOf('--json') + 1] ?? null,
  })
}

function report(result, opts) {
  const { hits, exempt } = result
  const baseline = readBaseline(opts.root)
  // **按次数**配对,不是按 key 集合:同一文件里两处形态完全相同的绕过(实测
  // apps/cli/src/commands/login.ts:75 与 :158 都是 fetch(url) + 同一个 url 定义)
  // 只有一条 key,若按集合判,删掉其中一处门不会有任何反应。
  const allowed = new Map()
  for (const k of baseline.keys) allowed.set(k, (allowed.get(k) ?? 0) + 1)
  const seen = new Map()
  const added = []
  for (const h of hits) {
    seen.set(h.key, (seen.get(h.key) ?? 0) + 1)
    if (seen.get(h.key) > (allowed.get(h.key) ?? 0)) added.push(h)
  }
  const addedSet = new Set(added)
  const stale = [...allowed].filter(([k, n]) => (seen.get(k) ?? 0) < n).map(([k]) => k)

  if (opts.updateBaseline) {
    const payload = {
      generatedAt: new Date().toISOString(),
      note: 'AGENTS.md §3「端内必须走 @ihui/api-client」存量绕过清单。key = 相对路径::调用形式::URL 表达式指纹(前 80 字符,空白折叠)。只减不增:迁移进 api-client 后跑 --update-baseline 收紧。',
      bypasses: [...hits.map((h) => h.key)].sort(),
    }
    writeFileSync(join(opts.root, BASELINE_REL), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`✅ 基线已重写:${payload.bypasses.length} 处存量绕过 → ${BASELINE_REL}`)
    return 0
  }

  if (opts.jsonOut) {
    writeFileSync(
      resolve(opts.root, opts.jsonOut),
      JSON.stringify({ scannedFiles: opts.scanned, total: hits.length, inBaseline: hits.length - added.length, added: added.length, exempt: exempt.length, hits, exemptList: exempt }, null, 2),
      'utf8',
    )
  }

  if (opts.list || !opts.quiet) {
    for (const h of hits) {
      const mark = addedSet.has(h) ? '🆕 基线外' : allowed.has(h.key) ? '☑ 基线内' : '?'
      if (opts.list) console.log(`  ${mark} ${h.file}:${h.line} <${h.kind}> ${h.urlExpr.slice(0, 90)}\n         依据: ${h.evidence}`)
    }
    for (const e of exempt) {
      if (opts.list) console.log(`  🚫 豁免 ${e.file}:${e.line} <${e.kind}> ${e.urlExpr} → ${e.reason}`)
    }
  }

  console.log(
    `[check-direct-backend-calls] 扫了 ${opts.scanned ?? hits.length} 个源文件 | 后端直连命中 ${hits.length} 处(基线内 ${hits.length - added.length} / 新增 ${added.length})| adapter 豁免 ${exempt.length} 处` +
      (opts.scopedTo ? ` | 本轮为 --staged 口径:只报告暂存集(${opts.scopedTo} 个文件)内的命中,污点回溯仍用全语料` : '') +
      (baseline.missing ? ' | ⚠️ 基线文件缺失,按零额度处理' : ''),
  )

  if (added.length) {
    console.error(`\n❌ 基线外新增「端内绕过 @ihui/api-client 直连后端」${added.length} 处:`)
    for (const h of added.slice(0, 12)) {
      console.error(`   - ${h.file}:${h.line}  <${h.kind}> ${h.urlExpr.slice(0, 100)}`)
      console.error(`     污点依据: ${h.evidence}`)
    }
    if (added.length > 12) console.error(`   …另有 ${added.length - 12} 处`)
    console.error(
      [
        '',
        '💡 正解(AGENTS.md §3 共享层优先,不是把门调绿):',
        '   1) 端点在 @ihui/api-client 里已有 → 改成 import 现成端点函数(fetchApi / xxxApi);',
        '   2) 端点还没有(如 crash-reports 这类) → 把端点补进 packages/api-client/src/endpoints/**,',
        '      端内只 import 调用;确认 api-client 覆盖该端点后跑 node --filter @ihui/api-client build;',
        '   3) 平台能力缺口(enableChunked / upload onProgress 这类 api-client 没有的 transport) →',
        '      补进 api-client 的 transport 层,或通过 setTransport 注册的 adapter 承接;',
        '      adapter 只要 (a) 从 @ihui/api-client import 契约 (b) 被 setTransport 注册 (c) URL 纯透传,',
        '      本门自动豁免,无需申请白名单。',
        '   4) 确属其他(第三方域名/Next 自有路由)→ 用 node scripts/check-direct-backend-calls.mjs --list 核对',
        '      判据依据行,并在 PR 说明;`node scripts/check-direct-backend-calls.mjs --update-baseline` 只允许',
        '      在"存量被清/迁移进 api-client"后运行,禁止为放行新绕过而加重基线。',
        '   紧急跳过:HUSKY_SKIP_DIRECT_BACKEND_CALLS=1 git commit …(会留痕,需在下个 PR 清理)',
        '',
      ].join('\n'),
    )
    return 1
  }
  if (stale.length && !opts.scopedTo) {
    console.warn(`⚠️  基线中 ${stale.length} 条已不存在(绕过点已被迁移/删除),建议:`)
    for (const k of stale.slice(0, 8)) console.warn(`   - ${k}`)
    console.warn('   node scripts/check-direct-backend-calls.mjs --update-baseline  # 收紧基线')
  }
  if (baseline.missing && hits.length === 0) {
    console.warn('⚠️  基线缺失且零命中:确认这是"存量已清零"的真实状态,而不是扫描范围出错。')
  }
  console.log('[PASS] 无新增端内直连后端(存量基线内放行,只减不增)')
  return 0
}

// ──────────────────────────────────────────────────────────────────────────────
// 内建自检:内存语料,不碰真实源码
// ──────────────────────────────────────────────────────────────────────────────

const FIXTURES = {
  // ① 注入样本:端内新增 Taro.request + BASE_URL → 必须命中
  injection: {
    'apps/miniapp-taro/src/utils/api-config.ts': `export const BASE_URL = 'http://localhost:8802/api'\n`,
    'apps/miniapp-taro/src/pages/foo/index.tsx':
      "import Taro from '@tarojs/taro'\nimport { BASE_URL } from '@/utils/api-config'\nexport function send() {\n  return Taro.request({ url: `${BASE_URL}/new-endpoint`, method: 'POST' })\n}\n",
  },
  // ② 合规 transport:必须判为不违规(§3 平台 adapter)
  transport: {
    'apps/miniapp-taro/src/utils/api-client-transport.ts':
      "import Taro from '@tarojs/taro'\nimport type { Transport, TransportResponse } from '@ihui/api-client'\nexport function createTaroTransport(): Transport {\n  return (url, init) => {\n    return new Promise((resolve) => {\n      Taro.request({ url, method: 'GET', success: (res) => resolve(res) })\n    })\n  }\n}\n",
    'apps/miniapp-taro/src/app.tsx':
      "import { setTransport } from '@ihui/api-client'\nimport { createTaroTransport } from '@/utils/api-client-transport'\nsetTransport(createTaroTransport())\n",
  },
  // ③ 跨文件形参污点(sse 形态):必须命中
  paramFlow: {
    'apps/x-app/src/lib/sse.ts':
      "export async function streamSSE(options) {\n  const { url } = options\n  const r = await fetch(url, { method: 'POST' })\n  return r\n}\n",
    'apps/x-app/src/api/index.ts':
      "import { streamSSE } from '@/lib/sse'\nexport const BASE_URL = 'http://localhost:8802/api'\nexport async function chatStream() {\n  await streamSSE({ url: BASE_URL + '/ai/chat/stream', body: {} })\n}\n",
  },
  // ④ 第三方域名 /api/ 段:不得判违规(discord IdP 形态)
  thirdParty: {
    'packages/auth/src/providers/discord.ts':
      "export class Discord { constructor(tokenUrl = 'https://discord.com/api/v10/oauth2/token') {} async run() { return fetch(this.tokenUrl, { method: 'POST' }) } }\n",
  },
  // ⑥ 同名 React setter 不构成 transport 豁免证据
  fakeTransport: {
    'apps/web/src/components/mcp/mcp-manager.tsx':
      "const [transport, setTransport] = React.useState('sse')\nsetTransport('sse')\nexport function probe(u) { return fetch(u, { method: 'GET' }) }\n",
  },
  // ⑦ 文档示例代码字符串里的 fetch:锚点在模板内部 ⇒ 不是调用点(SdkExamples 真实误伤回归)
  docSample: {
    'apps/web/src/components/api-docs/SdkExamples.tsx':
      "export const EXAMPLES = [\n  { title: 'fetch', code: `const resp = await fetch(\"https://api.ihui.ai/v1/chat/completions\", { method: 'POST' })` },\n]\nexport function real(u) { return fetch(u) }\n",
  },
}

export function __selfTest() {
  const results = []
  const run = (files) => analyzeCorpus(new Map(Object.entries(files)), DEFAULT_ROOT)
  const assert = (label, cond, extra = '') => results.push({ label, ok: !!cond, extra })

  const inj = run(FIXTURES.injection)
  assert(
    '注入「端内 Taro.request({url: `${BASE_URL}/new-endpoint`})」必须判违规',
    inj.hits.some((h) => h.file.endsWith('pages/foo/index.tsx') && h.kind === 'miniapp-request'),
    JSON.stringify(inj.hits.map((h) => `${h.file}:${h.line}:${h.evidence}`)),
  )

  const tp = run(FIXTURES.transport)
  assert(
    '合规 Transport(从 @ihui/api-client import + 被 setTransport 注册 + URL 纯透传)不得判违规',
    tp.hits.length === 0 && tp.exempt.length >= 1,
    `hits=${JSON.stringify(tp.hits.map((h) => h.file))} exempt=${tp.exempt.length}`,
  )

  const pf = run(FIXTURES.paramFlow)
  assert(
    '形参透传但调用方传 BASE_URL 拼接值(sse.ts 形态)必须判违规',
    pf.hits.some((h) => h.file.endsWith('lib/sse.ts')),
    JSON.stringify(pf.hits.map((h) => `${h.file}:${h.line}:${h.evidence}`)),
  )

  const third = run(FIXTURES.thirdParty)
  assert(
    '第三方 IdP 的 https://discord.com/api/v10/... 不得判为本仓后端',
    third.hits.length === 0,
    JSON.stringify(third.hits.map((h) => `${h.file}:${h.line}:${h.urlExpr}`)),
  )

  // 同名 React setTransport 不得成为豁免证据:mcp-manager 里的 fetch(u) 无污点 → 既不是命中也不算豁免
  const fake = run(FIXTURES.fakeTransport)
  assert(
    '同名 React useState setTransport 不构成 adapter 豁免证据',
    fake.exempt.length === 0,
    `exempt=${JSON.stringify(fake.exempt.map((e) => e.file))}`,
  )

  // 文档示例代码字符串里的 fetch 必须被字符串掩码排除,但同文件的真实 fetch(u) 仍要能分析
  const doc = run(FIXTURES.docSample)
  assert(
    '模板字符串里的 SDK 示例 fetch(https://api.ihui.ai/...) 不得判为调用点',
    doc.hits.length === 0 && doc.hits.every((h) => h.line !== 2),
    JSON.stringify(doc.hits.map((h) => `${h.file}:${h.line}:${h.urlExpr}`)),
  )

  // 判据函数级:基线 key 稳定性(空白折叠 + 指纹截断)
  const k1 = baselineKey('apps/web/src/x.ts', 'fetch', 'fetch(  `/api/a`   )')
  const k2 = baselineKey('apps/web/src/x.ts', 'fetch', 'fetch( `/api/a` )')
  assert('同一调用点两次解析得到同一基线指纹(空白归一)', k1 === k2, `${k1} vs ${k2}`)

  // 注释里的绕过不得命中(注释剥离)
  const commented = run({
    'apps/x-app/src/a.ts':
      "import { BASE_URL } from '@/cfg'\n// fetch(`${BASE_URL}/ghost`)\nexport const x = 1\n/* fetch('/api/ghost2') */\n",
    'apps/x-app/src/cfg.ts': "export const BASE_URL = '/api'\n",
  })
  assert('注释里的 fetch(BASE_URL) 不得判命中', commented.hits.length === 0, JSON.stringify(commented.hits.map((h) => `${h.file}:${h.line}`)))

  const bad = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.label}${r.ok ? '' : `\n     ${r.extra}`}`)
  return bad.length === 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (argv.includes('--self-test')) {
    process.exit(__selfTest() ? 0 : 1)
  }
  try {
    const rootIdx = argv.indexOf('--root')
    const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : DEFAULT_ROOT
    if (!existsSync(root)) {
      console.error(`[check-direct-backend-calls] ❌ --root 不存在: ${root}`)
      process.exit(2)
    }
    process.exit(main({ root }) ?? 0)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

// AGENTS.md §22c:暴露核心判据给镜像测试直接 import(禁止复制判据)
export const __test__ = {
  scanCode,
  stripComments,
  findCallSites,
  collectAssignments,
  collectImports,
  resolveSpecifier,
  collectRegisteredTransports,
  surfaceTaint,
  baselineKey,
  analyzeCorpus,
  fixtures: FIXTURES,
  selfTest: __selfTest,
  excludedWorkspaces: () => [...EXCLUDED_WORKSPACES],
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
