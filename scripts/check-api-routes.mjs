#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 前端 API 调用 vs 后端路由注册比对脚本。
 *
 * 防止前端调用后端未注册的端点（404 风险）。
 *
 * 用法: node scripts/check-api-routes.mjs
 *   无参数: 全量比对，发现问题 exit 1，无问题 exit 0
 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = process.cwd()
const WEB_DIR = join(ROOT, 'apps/web')
const API_ROUTES_DIR = join(ROOT, 'apps/api/src/routes')
const API_PLUGINS_DIR = join(ROOT, 'apps/api/src/plugins')
const AI_SERVICE_ROUTERS_DIR = join(ROOT, 'apps/ai-service/app/routers')
const SERVER_FILE = join(ROOT, 'apps/api/src/server.ts')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const EXCLUDE_DIRS = new Set(['.git', '.next', '.ihui-agent', '.turbo', '.worktrees', 'build', 'dist', 'node_modules', 'public'])

function collectFiles(dir, exts, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry) || isExcludedDirName(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, exts, result)
    } else if (exts.some((e) => entry.endsWith(e))) {
      // 跳过单元测试 mock 文件(*.test.ts/tsx/js),fetch mock 非真实 API 调用
      // 保留 e2e 测试(*.spec.ts/tsx),其 API 调用是真实端到端检查
      if (/\.test\.(ts|tsx|js)$/.test(entry)) continue
      // 跳过 Next.js 配置文件(rewrites 是服务器端路由规则,非前端 API 调用)
      if (entry === 'next.config.ts' || entry === 'next.config.js') continue
      result.push(full)
    }
  }
  return result
}

/** 提取前端 API 调用路径，返回 [{ method, path, file, line }] */
function extractFrontendCalls(src, file) {
  const calls = []
  const lines = src.split('\n')
  // 匹配 fetchApi(`/api/...`) 或 fetch(`/api/...`) 或 xxxApi(`/api/admin/...`)
  // 捕获 method（从上下文推断）和路径
  // 2026-09-17 加固:字符类补 `?&=%,+~#@!;` —— 原正则不含 `?`,导致「单行字面量内联查询串」的
  // 调用(形如 `/api/memory/graph?query=${encodeURIComponent(q)}`)整条无法匹配、静默跳过,
  // 形成守门结构盲区(实测漏检 288 条路径;其中 `/api/memory/graph` 后端从未实现 → 记忆图谱面板
  // 线上恒 404 却一路绿灯)。刻意**不含 `*` 与括号**,避免把 next.config.ts 的 rewrite 源
  // ('/api/:path*')与函数调用文本误当成调用点。
  const pathRe = /['"`](\/api\/(?:admin\/)?[a-zA-Z0-9/_\-${}:.?&=%,+~#@!;]+)['"`]/g
  lines.forEach((line, idx) => {
    let m
    pathRe.lastIndex = 0
    while ((m = pathRe.exec(line)) !== null) {
      const rawPath = m[1]
      // 跳过非 API 路径（如 /api/health 这种纯字面量但被误捕）
      if (!rawPath.startsWith('/api/')) continue
      // /api/llm/* 走 Next.js rewrite 到 ai-service (port 8000)，不在 API 路由检查范围
      if (rawPath.startsWith('/api/llm/')) continue
      // /api/voice/* 走 Next.js rewrite 到 ai-service 8803(2026-08-31 新增),
      // 与 /api/llm/ 同类——ai-service 路由由 router 扫描覆盖,此处纯字面量(如
      // voice-input.tsx STT_ENDPOINT 常量)会误报 GET /api/voice/stt
      if (rawPath.startsWith('/api/voice/')) continue
      // 推断 method: 优先 path 同行 → 向后第一个 method → 向前最近 method → 动态值用 ANY
      let method = 'GET'
      const sameLine = (lines[idx] || '').toLowerCase()
      const sameLineMatch = sameLine.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
      if (sameLineMatch) {
        method = sameLineMatch[1].toUpperCase()
      } else {
        // 向后搜索 path 之后的第一个 method（同一 options 对象内，后 4 行）
        // 2026-09-17 加固:遇到「调用收尾行」(仅由 ) ] } > , ; 与空白组成)即停止扫描。
        // 原实现盲扫固定 4 行 → 会跨出当前调用、抓到**下一个不相关调用**的 method:
        //   queryFn: () => api<CirclesData>(`/api/circles/mine?page=${page}`),  ← path(应 GET)
        //   })                                                                   ← 收尾,应在此停止
        //   const delMut = useMutation({
        //     mutationFn: (id) => api(`/api/circles/${id}/leave`, { method: 'POST' }), ← 曾被误抓
        // 注:判据刻意**只用「整行纯闭合」**而非「行内出现右括号」——后者会被
        // `reason.trim()` / `JSON.stringify(x)` 之类实参里的括号误触发,反而漏掉真正的 method。
        let resolved = null
        for (let i = 1; i <= 4; i++) {
          const afterLine = lines[idx + i] || ''
          if (/^\s*[)\]}>;,]*\s*$/.test(afterLine)) break
          const afterMatch = afterLine
            .toLowerCase()
            .match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
          if (afterMatch) {
            resolved = afterMatch[1].toUpperCase()
            break
          }
        }
        if (!resolved) {
          // 向前搜索 path 之前的最近 method（前 3 行，取行号最大的 = 离 path 最近）
          for (let i = -1; i >= -3; i--) {
            const beforeLine = (lines[idx + i] || '').toLowerCase()
            const beforeMatch = beforeLine.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
            if (beforeMatch) {
              resolved = beforeMatch[1].toUpperCase()
              break
            }
          }
        }
        if (!resolved) {
          // 作用域搜索:向前找最近的函数定义开头,在函数体内找 method
          // 场景:const run = async (op, endpoint, body) => { ... method: 'POST' ... }
          //       调用处 run('generate', '/api/self-media/koubo/generate', ...) 在另一行
          // 限制 1:必须匹配 => 或 function 关键字,避免误匹配 const xxx = useMutation({ 等非函数
          // 限制 2:只对"间接调用"(非 fetchApi 直接调用)适用,避免 React 组件内多 method 误判
          const directFetchRe = /fetchApi\s*(<[^>]*>)?\s*\(\s*['"`]\/api\//i
          const isDirectFetch = directFetchRe.test(lines[idx] || '')
          if (!isDirectFetch) {
            // 2026-09-17 加固:两处加 `(?:<[^<>()]*>\s*)?` 泛型参数支持。
            // 原正则不认 `async function api<T>(url, options)` —— 这是本仓最常见的
            // 「同文件 wrapper」写法(my-circles/page.tsx:41、meal/page.tsx:85、use-task-receiver.ts:92
            // 的 apiData 等)。识别失败会让作用域搜索**越过 wrapper 继续向前**,抓到更早某个
            // 函数的 `method: 'POST'`(如 join/leave 之类的写操作),把 wrapper 的 GET 调用误判成 POST。
            const funcStartRe =
              /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:<[^<>()]*>\s*)?\([^)]*\)\s*=>|function\s+\w+\s*(?:<[^<>()]*>\s*)?\(|(?:const|let|var)\s+\w+\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/
            let funcStartLine = -1
            for (let i = idx - 1; i >= 0; i--) {
              if (funcStartRe.test(lines[i] || '')) {
                funcStartLine = i
                break
              }
            }
            if (funcStartLine >= 0) {
              for (let i = funcStartLine; i <= idx; i++) {
                const fl = (lines[i] || '').toLowerCase()
                const fm = fl.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
                if (fm) {
                  resolved = fm[1].toUpperCase()
                  break
                }
              }
            }
          }
        }
        if (resolved) {
          method = resolved
        } else {
          // 前后均无字面量 method：检查动态 method（三元等）→ ANY；否则启发式
          const contextLines = []
          for (let i = -3; i <= 4; i++) {
            contextLines.push(lines[idx + i] || '')
          }
          const context = contextLines.join('\n').toLowerCase()
          if (/method\s*:\s*[^'"`\s]/.test(context)) {
            method = 'ANY'
          } else if (/\bpost\s*[<(]/.test(context)) {
            method = 'POST'
          } else if (/\bput\s*[<(]/.test(context)) {
            method = 'PUT'
          } else if (/\bpatch\s*[<(]/.test(context)) {
            method = 'PATCH'
          } else if (/\bdelete\s*[<(]/.test(context)) {
            method = 'DELETE'
          }
          if (method === 'GET') {
            const prev = (lines[idx - 1] || '').toLowerCase()
            const keyMatch = prev.match(/\b(post|put|patch|delete)\s*:\s*['"`]/)
            if (keyMatch) method = keyMatch[1].toUpperCase()
          }
        }
      }
      // 最高优先级:显式注释标注 `// method: POST`(同行或前一行),覆盖上述全部推断
      // 场景:跨文件 wrapper(useProcessApi)、多行函数签名(const run = async (\n...) =>)、
      //       同文件 wrapper 链(srsPost → explainConcept)等自动推断失效时
      const annotRe = /\/\/\s*method\s*:\s*(get|post|put|patch|delete)\b/i
      const annotMatch =
        (lines[idx] || '').match(annotRe) || (lines[idx - 1] || '').match(annotRe)
      if (annotMatch) {
        method = annotMatch[1].toUpperCase()
      }
      // 模板字符串变量：查询字符串构建器直接去掉，其余替换为 :param
      const normalized = rawPath
        .replace(/\$\{([^}]+)\}/g, (_match, expr) => {
          // 2026-09-17 加固:`?` 只在**非可选链**时才算查询字符串构建器。
          // 原实现用 expr.includes('?') → `${editing?.id}` 这类可选链被误判为查询串、
          // 整个插值被清空,路径退化为 `/api/admin/exam/questions`(丢掉 :param),
          // 再与后端 `/admin/exam/questions/:id` 比对必然报缺失(误报)。
          // 判据:`?` 之后紧跟 `.` 是可选链(值),否则是三元/查询串(应清空)。
          const isQueryStringBuilder =
            /\?(?!\.)/.test(expr) ||
            /(^|[^a-zA-Z0-9_])(qs|query|search|params|filter|filters|sort|pagination|listQs|pageQuery|searchParams|queryString|searchQuery)([^a-zA-Z0-9_]|$)/i.test(
              expr,
            )
          return isQueryStringBuilder ? '' : ':param'
        })
        .replace(/\?.*$/, '')
        .replace(/\/+$/, '')
      calls.push({
        method,
        path: normalized,
        file: relative(ROOT, file),
        line: idx + 1,
      })
    }
  })
  return calls
}

/** 提取所有 prefix 注册（server.ts 顶层 + 子路由文件内 scoped） */
function extractRegisterPrefixes() {
  const calls = []
  const re = /\{\s*prefix:\s*['"`]([^'"`]+)['"`]/g
  // 1. server.ts 顶层 prefix（如 /api/admin, /api/teams）
  if (existsSync(SERVER_FILE)) {
    const src = readFileSync(SERVER_FILE, 'utf8')
    let m
    while ((m = re.exec(src)) !== null) {
      calls.push({ prefix: m[1], isAbsolute: m[1].startsWith('/api') })
    }
  }
  // 2. 子路由文件内 scoped prefix（如 /dict/type, /dept, /role）
  if (existsSync(API_ROUTES_DIR)) {
    for (const file of collectFiles(API_ROUTES_DIR, ['.ts'])) {
      const src = readFileSync(file, 'utf8')
      re.lastIndex = 0
      let m
      while ((m = re.exec(src)) !== null) {
        calls.push({ prefix: m[1], isAbsolute: m[1].startsWith('/api') })
      }
    }
  }
  return calls
}

/** 构建组合 prefix 集合：absolute + (absolute × relative) 两层拼接。
 *  Fastify 的 scoped prefix 是分层的（/api/admin + /dict/type → /api/admin/dict/type），
 *  脚本无法知道层级关系，所以对 /api/admin（admin 路由根）做两层拼接覆盖大多数场景。 */
function buildCompositePrefixes(prefixes) {
  const absolute = [...new Set(prefixes.filter((p) => p.isAbsolute).map((p) => p.prefix))]
  const relative = [...new Set(prefixes.filter((p) => !p.isAbsolute).map((p) => p.prefix))]
  const composite = [...absolute]
  // /api/admin 是 admin 路由根，几乎所有 relative scoped prefix 都在它下面
  const adminRoots = absolute.filter((p) => p === '/api/admin' || p === '/api')
  for (const root of adminRoots) {
    for (const rel of relative) {
      composite.push(normalizePath(root, rel))
    }
  }
  return composite
}

// ===== 模板串注册展开(2026-09-22 加固,判据缺陷修复)=====
// 根因:methodRe 把反引号内的**原始文本**当路径 —— `server.post(`/${vendor}/images`)` 收到的
// localPath 是字面量 "/${vendor}/images",插值从未展开,于是真实注册的
// POST /api/ai/zhipu/images 永远匹配不上,前端调用被误判 404(假阳性红门)。
// 本段**只做展开,不放宽任何既有判据**(解析不出即跳过 = 保持原行为):
//   1. 展开区间限定在 `for (const ITEM of 同文件对象数组常量)` 循环体内;
//   2. 插值只认 `const VAR = ITEM.列名` 绑定,取值来自矩阵每一行的该列(必须是非空字符串);
//   3. 与厂商能力矩阵求交:注册被 `if (ITEM.flag) {`(单一成员条件)包裹时,只保留该行
//      flag === true 的厂商;被其他 if / else / switch 包裹时判据不可靠 → 整条跳过,不臆造路由;
//   4. 循环体外的模板串只展开 `${以 / 开头的字符串常量}`(如 `const PREFIX = '/n8n'`);
//   5. 形参插值(registerCrud 的 `${basePath}`)、跨文件导入的矩阵、复杂表达式插值一律不展开。
const GATE_UNKNOWN = '<unresolved-gate>'

/** 跳过引号/模板串字面量,返回结尾引号的下标 */
function skipQuotedLiteral(text, i) {
  const q = text[i]
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++
    else if (text[j] === q) return j
  }
  return text.length - 1
}

/** 跳过注释(行注释/块注释),返回注释结束处的下标 */
function skipCommentLiteral(text, i) {
  if (text[i + 1] === '/') {
    const nl = text.indexOf('\n', i)
    return nl === -1 ? text.length : nl
  }
  const end = text.indexOf('*/', i + 2)
  return end === -1 ? text.length : end + 1
}

/** 从 openIdx 处的开括号找到配对闭括号下标(跳过字符串与注释);-1 = 未配平 */
function findMatchingBracket(text, openIdx, openChar, closeChar) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipCommentLiteral(text, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuotedLiteral(text, i)
      continue
    }
    if (ch === openChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 收集同文件内 `const NAME = [ { col: 'v', flag: true }, ... ]` 形态的对象数组(能力矩阵) */
function extractMatrixArrays(text) {
  const matrices = new Map()
  const declRe = /const\s+([A-Za-z0-9_$]+)\s*=\s*\[/g
  let m
  while ((m = declRe.exec(text)) !== null) {
    const closeIdx = findMatchingBracket(text, m.index + m[0].length - 1, '[', ']')
    if (closeIdx === -1) continue
    const body = text.slice(m.index + m[0].length, closeIdx)
    const rowRe = /\{([^{}]*)\}/g
    const rows = []
    let r
    while ((r = rowRe.exec(body)) !== null) {
      const pairRe = /([A-Za-z0-9_$]+)\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|(true|false))/g
      const row = {}
      let p
      while ((p = pairRe.exec(r[1])) !== null) {
        const strVal = p[2] ?? p[3] ?? p[4]
        row[p[1]] = strVal === undefined ? p[5] === 'true' : strVal
      }
      if (Object.keys(row).length > 0) rows.push(row)
    }
    if (rows.length > 0) matrices.set(m[1], rows)
  }
  return matrices
}

/** 收集同文件内 `const NAME = '/xxx'` 形态的路径前缀字符串常量 */
function extractPathConsts(text) {
  const consts = new Map()
  const re = /const\s+([A-Za-z0-9_$]+)\s*=\s*'([^']*)'/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[2].startsWith('/')) consts.set(m[1], m[2])
  }
  return consts
}

/** 找出迭代"同文件矩阵数组"的 for-of 循环体区间 + `const VAR = ITEM.列名` 绑定 */
function findMatrixLoops(text, matrices) {
  const loops = []
  const re =
    /for\s*\(\s*(?:const|let|var)\s+([A-Za-z0-9_$]+)\s+of\s+(?:[A-Za-z0-9_$]+\.)?([A-Za-z0-9_$]+)\s*\)\s*\{/g
  let m
  while ((m = re.exec(text)) !== null) {
    const rows = matrices.get(m[2])
    if (!rows) continue
    const bodyStart = m.index + m[0].length - 1
    const bodyEnd = findMatchingBracket(text, bodyStart, '{', '}')
    if (bodyEnd === -1) continue
    const bindRe = new RegExp(
      `const\\s+([A-Za-z0-9_$]+)\\s*=\\s*${m[1]}\\.([A-Za-z0-9_$]+)\\b`,
      'g',
    )
    const bindings = new Map()
    let b
    while ((b = bindRe.exec(text.slice(bodyStart, bodyEnd))) !== null) {
      bindings.set(b[1], b[2])
    }
    loops.push({ itemVar: m[1], rows, bindings, bodyStart, bodyEnd })
    re.lastIndex = bodyEnd
  }
  return loops
}

/** 扫描 [from, at) 得到 at 处所有未闭合 `{` 的行首文本(外层 → 内层) */
function openBracePrefixes(text, from, at) {
  const stack = []
  for (let i = from; i < at; i++) {
    const ch = text[i]
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipCommentLiteral(text, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuotedLiteral(text, i)
      continue
    }
    if (ch === '{') {
      stack.push(text.slice(text.lastIndexOf('\n', i) + 1, i).trim())
    } else if (ch === '}') {
      stack.pop()
    }
  }
  return stack
}

/**
 * 注册点的条件包裹判定(用于与能力矩阵求交)。
 * @returns {string[]|string} 门控列名数组(空 = 无 if 包裹,对所有行注册);GATE_UNKNOWN = 不可判定
 */
function resolveGateKeys(text, loop, at) {
  const gates = []
  for (const prefix of openBracePrefixes(text, loop.bodyStart, at)) {
    if (/\belse\b|\bswitch\b/.test(prefix)) return GATE_UNKNOWN
    const m = prefix.match(/^if\s*\((.*)\)\s*$/)
    if (!m) continue
    const key = m[1].trim().match(new RegExp(`^${loop.itemVar}\\.([A-Za-z0-9_$]+)$`))
    if (!key) return GATE_UNKNOWN
    gates.push(key[1])
  }
  return gates
}

/** 展开单个源文件里"模板串注册"的真实路由(无法确定形态一律不产出) */
function expandTemplatedRoutes(src, rel) {
  const matrices = extractMatrixArrays(src)
  const pathConsts = extractPathConsts(src)
  if (matrices.size === 0 && pathConsts.size === 0) return []
  const loops = findMatrixLoops(src, matrices)
  const tmplRe =
    /\b(?:server|s|child|scope|authed|instance|app|fastify)\.(get|post|put|patch|delete)\(\s*`([^`]*)`/g
  const out = []
  let m
  while ((m = tmplRe.exec(src)) !== null) {
    const method = m[1].toUpperCase()
    const tpl = m[2]
    if (!tpl.includes('${')) continue // 纯字面量模板串:既有 methodRe 已覆盖
    const vars = [...new Set([...tpl.matchAll(/\$\{([A-Za-z0-9_$]+)\}/g)].map((v) => v[1]))]
    if (vars.length === 0) continue // 复杂表达式插值(${a.b} / 三元)不展开
    const loop = loops.find((l) => m.index > l.bodyStart && m.index < l.bodyEnd)
    if (loop) {
      if (!vars.every((v) => loop.bindings.has(v))) continue
      const gates = resolveGateKeys(src, loop, m.index)
      if (gates === GATE_UNKNOWN) continue
      for (const row of loop.rows) {
        if (gates.some((g) => row[g] !== true)) continue // 能力矩阵求交
        let ok = true
        const localPath = tpl.replace(/\$\{([A-Za-z0-9_$]+)\}/g, (_s, v) => {
          const col = row[loop.bindings.get(v)]
          if (typeof col !== 'string' || col === '') {
            ok = false
            return ''
          }
          return col
        })
        if (ok) out.push({ method, localPath, file: rel })
      }
      continue
    }
    if (!vars.every((v) => pathConsts.has(v))) continue
    out.push({
      method,
      localPath: tpl.replace(/\$\{([A-Za-z0-9_$]+)\}/g, (_s, v) => pathConsts.get(v)),
      file: rel,
    })
  }
  return out
}

/** 提取后端路由文件中的 server.xxx('path', ...) 注册 */
function extractBackendRoutes() {
  const routes = []
  const prefixes = extractRegisterPrefixes()
  if (!existsSync(API_ROUTES_DIR)) return routes
  const files = collectFiles(API_ROUTES_DIR, ['.ts'])
  // 已知 scoped instance 变量名: server.register(async (VAR) => {...})
  // 项目实际使用: server / s (admin-sys) / child (exam) / scope (live) / authed (member) / fastify (zhs-course 等)
  const methodRe =
    /\b(?:server|s|child|scope|authed|instance|app|fastify)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g
  // registerCrud(VAR, 'basePath', ...) 工厂: 展开为 GET/POST/PUT/:id/DELETE/:id/DELETE(batch) 共 5 条
  const crudRe = /registerCrud\(\s*\w+\s*,\s*['"`]([^'"`]+)['"`]/g
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    let m
    methodRe.lastIndex = 0
    while ((m = methodRe.exec(src)) !== null) {
      routes.push({
        method: m[1].toUpperCase(),
        localPath: m[2],
        file: relative(ROOT, file),
      })
    }
    crudRe.lastIndex = 0
    while ((m = crudRe.exec(src)) !== null) {
      const basePath = m[1]
      const rel = relative(ROOT, file)
      routes.push({ method: 'GET', localPath: basePath, file: rel })
      routes.push({ method: 'POST', localPath: basePath, file: rel })
      routes.push({ method: 'PUT', localPath: `${basePath}/:id`, file: rel })
      routes.push({ method: 'DELETE', localPath: `${basePath}/:id`, file: rel })
      routes.push({ method: 'DELETE', localPath: basePath, file: rel })
    }
    // 2026-09-22 加固:展开"模板串 + for-of 厂商矩阵"注册(既有 methodRe 只能收原始文本)
    routes.push(...expandTemplatedRoutes(src, relative(ROOT, file)))
  }
  // plugins 目录中带完整 /api/ 前缀的动态注册
  // (如 token-balance-service.ts:267 注册 /api/admin/token-balance/metrics,
  //  ai-cost.ts:467 注册 /api/admin/ai/cost/budgets;相对路径无 prefix 上下文,跳过)
  if (existsSync(API_PLUGINS_DIR)) {
    const pluginFiles = collectFiles(API_PLUGINS_DIR, ['.ts'])
    for (const file of pluginFiles) {
      const src = readFileSync(file, 'utf8')
      methodRe.lastIndex = 0
      let m
      while ((m = methodRe.exec(src)) !== null) {
        if (m[2].startsWith('/api/')) {
          routes.push({
            method: m[1].toUpperCase(),
            localPath: m[2],
            file: relative(ROOT, file),
          })
        }
      }
    }
  }
  // FastAPI 路由(ai-service):从 apps/ai-service/app/routers/*.py 提取
  // 模式1: router = APIRouter(prefix="/api/...") → 记录 prefix
  // 模式2: @router.(get|post|...)("/path") → 记录 method + localPath
  // 完整路径 = prefix + localPath（main.py include_router 时统一挂载 /api 或 /api/v1 等）
  if (existsSync(AI_SERVICE_ROUTERS_DIR)) {
    const routerFiles = collectFiles(AI_SERVICE_ROUTERS_DIR, ['.py'])
    // 1. 先从 main.py 提取 include_router(router.router, prefix="...") 映射
    const aiServiceMain = join(ROOT, 'apps/ai-service/app/main.py')
    const includePrefixMap = new Map() // router变量名 -> prefix
    if (existsSync(aiServiceMain)) {
      const mainSrc = readFileSync(aiServiceMain, 'utf8')
      const includeRe = /app\.include_router\(\s*(\w+)\.router\s*,\s*prefix\s*=\s*['"`]([^'"`]+)['"`]/g
      let im
      while ((im = includeRe.exec(mainSrc)) !== null) {
        includePrefixMap.set(im[1], im[2])
      }
    }
    for (const file of routerFiles) {
      const src = readFileSync(file, 'utf8')
      const rel = relative(ROOT, file)
      const fileName = relative(AI_SERVICE_ROUTERS_DIR, file).replace(/\.py$/, '')
      // 提取 router 的 prefix（文件内 APIRouter(prefix=...)）
      const prefixRe = /APIRouter\(\s*prefix\s*=\s*['"`]([^'"`]+)['"`]/g
      const routerPrefixes = []
      let pm
      while ((pm = prefixRe.exec(src)) !== null) {
        routerPrefixes.push(pm[1])
      }
      // 如果文件内无 prefix，尝试从 main.py include_router 映射获取
      if (routerPrefixes.length === 0 && includePrefixMap.has(fileName)) {
        routerPrefixes.push(includePrefixMap.get(fileName))
      }
      // 如果仍无 prefix，使用空字符串
      const prefixes = routerPrefixes.length > 0 ? routerPrefixes : ['']
      // 提取 @router.xxx("/path") 注册
      const fastApiMethodRe = /@router\.(get|post|put|patch|delete|options)\(\s*['"`]([^'"`]+)['"`]/g
      let fm
      while ((fm = fastApiMethodRe.exec(src)) !== null) {
        const method = fm[1].toUpperCase()
        const localPath = fm[2]
        for (const p of prefixes) {
          const fullPath = normalizePath(p, localPath)
          routes.push({ method, localPath: fullPath, file: rel })
        }
      }
    }
  }
  // 展开为完整路径（localPath + prefix）
  // 注意：这是简化匹配，实际 Fastify 会合并 prefix
  return { routes, prefixes }
}

/** 将路径归一化为可比较的形式：/api/admin/users/:param */
function normalizePath(prefix, localPath) {
  if (!prefix) return localPath
  if (localPath === '/' || localPath === '') return prefix
  // 去掉尾部/头部多余斜杠，避免双斜杠
  const cleanPrefix = prefix.replace(/\/+$/, '')
  const cleanLocal = localPath.replace(/^\//, '')
  if (cleanLocal === '') return cleanPrefix
  return `${cleanPrefix}/${cleanLocal}`
}

/** 比对两个路径是否匹配（支持 :param 通配 + Fastify * catch-all） */
function pathMatches(frontendPath, backendPath) {
  // 都去掉尾部斜杠
  const f = frontendPath.replace(/\/$/, '')
  const b = backendPath.replace(/\/$/, '')
  const fParts = f.split('/')
  const bParts = b.split('/')
  // Fastify 通配符 * 匹配 1+ 剩余段（catch-all,如 /documents/* 匹配 /documents/a/b/c）
  const starIdx = bParts.indexOf('*')
  if (starIdx !== -1) {
    // * 之前的部分必须逐段匹配（:param 通配任意值）
    if (fParts.length < starIdx + 1) return false
    for (let i = 0; i < starIdx; i++) {
      if (bParts[i].startsWith(':')) continue
      if (fParts[i].startsWith(':')) continue // 前端 :param 通配
      if (fParts[i] !== bParts[i]) return false
    }
    return true
  }
  // 标准匹配：段数一致 + :param 通配任意值
  if (fParts.length !== bParts.length) return false
  for (let i = 0; i < fParts.length; i++) {
    if (bParts[i].startsWith(':')) continue // 后端 :param 匹配任意
    if (fParts[i].startsWith(':')) continue // 前端 :param 通配
    if (fParts[i] !== bParts[i]) return false
  }
  return true
}

// 2026-08-31 改动:staged-scope 支持。改动原因:本脚本原先全量扫描工作区 apps/web 下所有
// 前端文件提取 API 调用点再比对后端路由,多会话并行开发时工作区充满其他会话的未完成文件,
// 导致提交被无关文件阻塞(真实案例:104 处"前端调用无后端路由"全部位于非暂存文件)。
// 规则:
//   - 暂存区非空(git diff --cached --name-only 非空)→ staged-scope:前端 API 调用点只收集
//     位于暂存文件列表内的前端文件,调用点所在文件不在暂存区则跳过不计入失败;
//     后端路由注册收集保持全量,保证比对基准完整。
//   - 暂存区没有前端文件但有其他文件 → 输出"暂存区无前端文件变更,跳过前端调用比对"并以 0 退出。
//   - 暂存区为空(无提交进行中、手动单独跑脚本)或 git 不可用 → 保持原有全量扫描行为不变。
function getStagedFiles() {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'diff', '--cached', '--name-only'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
    // git 输出为仓库根相对路径(POSIX 斜杠);Windows 下 relative() 产生反斜杠,统一为 /
    return out
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    return null // 非 git 环境/命令失败 → 回退全量扫描(与旧行为一致)
  }
}

// ===== 主流程 =====

// --self-test:判据有效性自查(2026-09-22 模板串展开配套)。
// 铁律:结果必须反映在**真实退出码**上(失败 exit 1),不允许"打印 FAIL 却 exit 0"。
const SELF_MATRIX_FIXTURE = [
  'const VENDOR_MATRIX = [',
  "  { vendor: 'zhipu', chat: true, embeddings: true, images: true },",
  "  { vendor: 'deepseek', chat: true, embeddings: false, images: false },",
  ']',
  'export async function vendorRoutes(server) {',
  '  for (const cap of VENDOR_MATRIX) {',
  '    const vendor = cap.vendor',
  '    server.get(`/${vendor}/models`, async () => ({}))',
  '    if (cap.chat) {',
  '      server.post(`/${vendor}/chat`, async () => ({}))',
  '    }',
  '    if (cap.images) {',
  '      server.post(`/${vendor}/images`, async () => ({}))',
  '    }',
  '    if (canUse(vendor)) {',
  '      server.post(`/${vendor}/secret`, async () => ({}))',
  '    }',
  '  }',
  '}',
].join('\n')

/** 建临时 monorepo 根(供 --self-test 端到端跑真实退出码) */
function makeSelfTestRoot(files) {
  const dir = mkScratch('ihui-api-routes-self-')
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, ...rel.split('/'))
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return dir
}

/** 以临时根为 cwd 跑本脚本自身,返回 { status, out(去 ANSI) } */
function runGateIn(cwd) {
  const r = spawnSync(process.execPath, [process.argv[1]], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return { status: r.status, out: (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '') }
}

/** 端到端夹具:后端只有"模板串 + 矩阵"注册,前端调用路径由参数决定 */
function selfTestRoot(calledPath) {
  return makeSelfTestRoot({
    'apps/api/src/server.ts': "server.register(aiVendorRoutes, { prefix: '/api/ai' })\n",
    'apps/api/src/routes/ai-vendors.ts': SELF_MATRIX_FIXTURE,
    'apps/web/call.ts': `fetchApi('${calledPath}', { method: 'POST' })\n`,
  })
}

/** --self-test 主体:返回失败清单(空 = 全部通过) */
function runSelfTest() {
  const failures = []
  const eq = (name, expected, actual) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(
        `${name}\n    期望 ${JSON.stringify(expected)}\n    实际 ${JSON.stringify(actual)}`,
      )
    }
  }
  const got = expandTemplatedRoutes(SELF_MATRIX_FIXTURE, 'fixture.ts').map(
    (r) => `${r.method} ${r.localPath}`,
  )
  // 1. 无 if 包裹的模板串 → 对矩阵所有行注册
  eq(
    '未门控模板串对全部厂商行展开',
    ['GET /zhipu/models', 'GET /deepseek/models'].sort(),
    got.filter((p) => p.endsWith('/models')).sort(),
  )
  // 2. 能力矩阵求交:images 只在 true 的行注册(deepseek images:false 不得出现)
  eq(
    'if (cap.images) 与矩阵求交,只展开真实支持生图的厂商',
    ['POST /zhipu/images'],
    got.filter((p) => p.endsWith('/images')),
  )
  // 3. 门控条件命中多行时按行展开
  eq(
    'if (cap.chat) 对 chat:true 的两行都展开',
    ['POST /deepseek/chat', 'POST /zhipu/chat'].sort(),
    got.filter((p) => p.endsWith('/chat')).sort(),
  )
  // 4. 判据不可靠的条件包裹(非 ITEM.列 的 if)→ 整条跳过,绝不臆造
  eq(
    '非矩阵成员条件的 if 包裹一律不展开',
    [],
    got.filter((p) => p.endsWith('/secret')),
  )
  // 5. 文件级字符串常量前缀可展开
  eq(
    '循环外 ${PREFIX} 字符串常量前缀展开',
    ['POST /n8n/workflows'],
    expandTemplatedRoutes(
      "const PREFIX = '/n8n'\nasync function r(server) {\n  server.post(`${PREFIX}/workflows`, async () => ({}))\n}",
      'n8n.ts',
    ).map((x) => `${x.method} ${x.localPath}`),
  )
  // 6. 形参插值(registerCrud 的 basePath)解析不出 → 不臆造(既有 ignore 条目语义不变)
  eq(
    '形参插值不展开(不臆造路由)',
    [],
    expandTemplatedRoutes(
      'export function registerCrud(server, basePath) {\n  server.get(`${basePath}/:id`, async () => ({}))\n}',
      'shared.ts',
    ),
  )
  // 7. 端到端:展开后的真实注册路由 → 前端调用不再假阳性(exit 0)
  const okRoot = selfTestRoot('/api/ai/zhipu/images')
  try {
    const r = runGateIn(okRoot)
    eq(
      '端到端:矩阵展开后 POST /api/ai/zhipu/images 判定为已注册(exit 0)',
      [0, true],
      [r.status, /通过/.test(r.out)],
    )
  } finally {
    rmScratch(okRoot)
  }
  // 8. 反向哨兵 A:后端确实不存在的探针路由必须仍报违规 exit 1(门没被改瞎)
  const probeRoot = selfTestRoot('/api/__probe_no_such_route__')
  try {
    const r = runGateIn(probeRoot)
    eq(
      '端到端反向哨兵:真缺失路由 /api/__probe_no_such_route__ 仍 exit 1 且点名',
      [1, true, true],
      [r.status, /__probe_no_such_route__/.test(r.out), /发现 1 处前端调用无后端路由/.test(r.out)],
    )
  } finally {
    rmScratch(probeRoot)
  }
  // 9. 反向哨兵 B:矩阵中 images:false 的厂商端点必须仍报违规(证明是"求交"而非"全展开")
  const gateRoot = selfTestRoot('/api/ai/deepseek/images')
  try {
    const r = runGateIn(gateRoot)
    eq(
      '端到端反向哨兵:矩阵 flag=false 的端点仍 exit 1',
      [1, true],
      [r.status, /POST \/api\/ai\/deepseek\/images/.test(r.out)],
    )
  } finally {
    rmScratch(gateRoot)
  }
  return failures
}

if (process.argv.includes('--self-test')) {
  const selfFailures = runSelfTest()
  if (selfFailures.length === 0) {
    console.log(`${C.green}[API 路由比对] --self-test 通过(9 例判据断言)${C.reset}`)
    process.exit(0)
  }
  console.log(`${C.red}[API 路由比对] --self-test 失败 ${selfFailures.length} 例:${C.reset}`)
  for (const f of selfFailures) console.log(`${C.red}  ✗ ${f}${C.reset}`)
  process.exit(1)
}

const WARN_ONLY = process.argv.includes('--warn-only')

// 2026-08-31:staged-scope 判定(改动原因见 getStagedFiles 上方注释)
const stagedFiles = getStagedFiles()
const stagedScope = stagedFiles !== null && stagedFiles.length > 0
const stagedSet = stagedScope ? new Set(stagedFiles) : null

console.log(
  `${C.cyan}[API 路由比对] 开始检查... (mode: ${WARN_ONLY ? 'warn-only' : 'strict'}${stagedScope ? ', staged 范围' : ''})${C.reset}`,
)

const { routes: backendRoutes, prefixes } = extractBackendRoutes()
const compositePrefixes = buildCompositePrefixes(prefixes)

const backendDumpIdx = process.argv.indexOf('--dump-backend')
if (backendDumpIdx !== -1 && process.argv[backendDumpIdx + 1]) {
  writeFileSync(
    process.argv[backendDumpIdx + 1],
    JSON.stringify(
      backendRoutes.map((r) => {
        const fullPaths = compositePrefixes.map((p) => `${r.method} ${normalizePath(p, r.localPath)}`)
        return { ...r, fullPaths }
      }),
      null,
      2,
    ),
    'utf8',
  )
}

// 构建后端完整路径集合
const backendPathSet = new Set()
for (const r of backendRoutes) {
  // 对每个路由，尝试所有可能的 prefix 组合（含两层拼接的 composite prefix）
  for (const p of compositePrefixes) {
    const full = normalizePath(p, r.localPath)
    backendPathSet.add(`${r.method} ${full}`)
  }
  // 也添加不带 prefix 的（plugin 内部可能没有 prefix）
  backendPathSet.add(`${r.method} ${r.localPath}`)
}

console.log(
  `${C.dim}[API 路由比对] 后端注册路由: ${backendRoutes.length} 条（含 ${compositePrefixes.length} 个组合前缀）${C.reset}`,
)

// 提取前端调用
// 2026-08-31:staged-scope 时仅收集位于暂存文件列表内的前端文件(改动原因见 getStagedFiles 上方注释);
// 非暂存文件的调用点跳过不计入失败;后端路由注册收集(extractBackendRoutes)保持全量不变。
const frontendFilesAll = collectFiles(WEB_DIR, ['.ts', '.tsx'])
let frontendFiles = frontendFilesAll
if (stagedScope) {
  frontendFiles = frontendFilesAll.filter((f) => stagedSet.has(relative(ROOT, f).replaceAll('\\', '/')))
  if (frontendFiles.length === 0) {
    console.log(
      `${C.yellow}[API 路由比对] (staged 范围) 暂存区无前端文件变更,跳过前端调用比对${C.reset}`,
    )
    process.exit(0)
  }
  console.log(
    `${C.dim}[API 路由比对] (staged 范围) 前端文件 ${frontendFiles.length}/${frontendFilesAll.length} 个位于暂存区,非暂存文件的调用点跳过不计入失败${C.reset}`,
  )
}
const allCalls = []
for (const file of frontendFiles) {
  const src = readFileSync(file, 'utf8')
  allCalls.push(...extractFrontendCalls(src, file))
}

console.log(`${C.dim}[API 路由比对] 前端 API 调用: ${allCalls.length} 处${C.reset}`)

// 比对
const missing = []
const seen = new Set()
for (const call of allCalls) {
  const key = `${call.method} ${call.path}`
  if (seen.has(key)) continue
  seen.add(key)
  // 检查是否在后端注册
  let found = false
  for (const bp of backendPathSet) {
    const [bm, bp2] = bp.split(' ')
    // ANY = method 为动态三元等无法确定，任意 method 匹配即算注册
    const methodOk = call.method === 'ANY' || bm === call.method
    if (methodOk && pathMatches(call.path, bp2)) {
      found = true
      break
    }
  }
  if (!found) {
    missing.push(call)
  }
}

const dumpIdx = process.argv.indexOf('--dump-missing')
if (dumpIdx !== -1 && process.argv[dumpIdx + 1]) {
  writeFileSync(process.argv[dumpIdx + 1], JSON.stringify(missing, null, 2), 'utf8')
}

// 读取 ignore 配置(.check-api-routes-ignore.json)
// 格式:{ "version": 1, "ignorePatterns": [{ "method": "GET", "pathPattern": "...", "reason": "..." }] }
// pathPattern:支持字符串包含匹配,也支持 ^...$ 正则
// method:"ANY" 或具体方法;省略 method = 任意 method 都豁免
const IGNORE_FILE = join(ROOT, '.check-api-routes-ignore.json')
let ignorePatterns = []
if (existsSync(IGNORE_FILE)) {
  try {
    const cfg = JSON.parse(readFileSync(IGNORE_FILE, 'utf8'))
    ignorePatterns = Array.isArray(cfg.ignorePatterns) ? cfg.ignorePatterns : []
  } catch (e) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️  .check-api-routes-ignore.json 解析失败,忽略配置文件:${C.reset} ${e.message}`,
    )
  }
}

function matchesIgnore(call) {
  return ignorePatterns.some((p) => {
    if (!p || !p.pathPattern) return false
    if (p.method && p.method !== 'ANY' && call.method !== 'ANY' && p.method !== call.method) return false
    const pattern = p.pathPattern
    if (pattern.startsWith('^') || pattern.endsWith('$') ||pattern.includes('\\')) {
      try {
        return new RegExp(pattern).test(call.path)
      } catch {
        return call.path.includes(pattern)
      }
    }
    return call.path.includes(pattern)
  })
}

const ignored = missing.filter(matchesIgnore)
const realMissing = missing.filter((c) => !matchesIgnore(c))

if (ignored.length > 0) {
  console.log(
    `${C.yellow}[API 路由比对] ℹ️  ${ignored.length} 处调用被 .check-api-routes-ignore.json 豁免(后端待实装/已知占位)${C.reset}`,
  )
  for (const ig of ignored.slice(0, 20)) {
    console.log(`${C.dim}  ${ig.method} ${ig.path} @ ${ig.file}:${ig.line}${C.reset}`)
  }
}

if (realMissing.length === 0) {
  console.log(`${C.green}[API 路由比对] ✅ 通过，前端所有 API 调用均有后端路由对应${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}[API 路由比对] ❌ 发现 ${realMissing.length} 处前端调用无后端路由（404 风险）:${C.reset}`)
for (const m of realMissing.slice(0, 50)) {
  console.log(`${C.red}  ${m.method} ${m.path}${C.reset}`)
  console.log(`${C.dim}    @ ${m.file}:${m.line}${C.reset}`)
}
if (realMissing.length > 50) {
  console.log(`${C.dim}  ... 还有 ${realMissing.length - 50} 处${C.reset}`)
}
console.log('')
console.log(`${C.yellow}修复方法:${C.reset}`)
console.log(`  1. 确认前端调用路径是否正确（检查 prefix 层级）`)
console.log(`  2. 确认 HTTP 方法是否匹配（GET/POST/PUT/PATCH/DELETE）`)
console.log(`  3. 如后端缺失，在 apps/api/src/routes/ 对应文件补建路由`)
console.log(`  4. 如前端错误，修正前端调用路径或方法`)
process.exit(WARN_ONLY ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
