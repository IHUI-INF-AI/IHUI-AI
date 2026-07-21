#!/usr/bin/env node
/**
 * 前端 API 调用 vs 后端路由注册比对脚本。
 *
 * 防止前端调用后端未注册的端点（404 风险）。
 *
 * 用法: node scripts/check-api-routes.mjs
 *   无参数: 全量比对，发现问题 exit 1，无问题 exit 0
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
// 扫描范围:web + mobile-rn + miniapp-taro + extension + desktop(全端 API 调用 vs 后端路由一致性)
const FRONTEND_DIRS = [
  join(ROOT, 'apps/web'),
  join(ROOT, 'apps/mobile-rn'),
  join(ROOT, 'apps/miniapp-taro'),
  join(ROOT, 'apps/extension'),
  join(ROOT, 'apps/desktop'),
]
const API_ROUTES_DIR = join(ROOT, 'apps/api/src/routes')
const SERVER_FILE = join(ROOT, 'apps/api/src/server.ts')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const EXCLUDE_DIRS = new Set(['.next', 'node_modules', '.git', 'messages', 'public'])

function collectFiles(dir, exts, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, exts, result)
    } else if (exts.some((e) => entry.endsWith(e))) {
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
  const pathRe = /['"`](\/api\/(?:admin\/)?[a-zA-Z0-9/_\-${}:.]+)['"`]/g
  lines.forEach((line, idx) => {
    let m
    pathRe.lastIndex = 0
    while ((m = pathRe.exec(line)) !== null) {
      const rawPath = m[1]
      // 跳过非 API 路径（如 /api/health 这种纯字面量但被误捕）
      if (!rawPath.startsWith('/api/')) continue
      // /api/llm/* 走 Next.js rewrite 到 ai-service (port 8000)，不在 API 路由检查范围
      if (rawPath.startsWith('/api/llm/')) continue
      // 推断 method: 优先 path 同行 → 向后第一个 method → 向前最近 method → 动态值用 ANY
      let method = 'GET'
      const sameLine = (lines[idx] || '').toLowerCase()
      const sameLineMatch = sameLine.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
      if (sameLineMatch) {
        method = sameLineMatch[1].toUpperCase()
      } else {
        // 向后搜索 path 之后的第一个 method（同一 options 对象内，后 4 行）
        let resolved = null
        for (let i = 1; i <= 4; i++) {
          const afterLine = (lines[idx + i] || '').toLowerCase()
          const afterMatch = afterLine.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
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
            const funcStartRe =
              /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|function\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/
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
      // 模板字符串变量：查询字符串构建器直接去掉，其余替换为 :param
      const normalized = rawPath
        .replace(/\$\{([^}]+)\}/g, (_match, expr) => {
          const isQueryStringBuilder =
            expr.includes('?') ||
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
  }
  // 展开为完整路径（localPath + prefix）
  // 注意：这是简化匹配，实际 Fastify 会合并 prefix
  return { routes, prefixes }
}

/** 将路径归一化为可比较的形式：/api/admin/users/:param */
function normalizePath(prefix, localPath) {
  if (localPath === '/' || localPath === '') return prefix
  const sep = prefix.endsWith('/') ? '' : '/'
  return `${prefix}${localPath.startsWith('/') ? localPath : sep + localPath}`
}

/** 比对两个路径是否匹配（支持 :param 通配） */
function pathMatches(frontendPath, backendPath) {
  // 都去掉尾部斜杠
  const f = frontendPath.replace(/\/$/, '')
  const b = backendPath.replace(/\/$/, '')
  const fParts = f.split('/')
  const bParts = b.split('/')
  if (fParts.length !== bParts.length) return false
  for (let i = 0; i < fParts.length; i++) {
    if (bParts[i].startsWith(':')) continue // 后端 :param 匹配任意
    if (fParts[i] !== bParts[i]) return false
  }
  return true
}

// ===== 主流程 =====
const WARN_ONLY = process.argv.includes('--warn-only')

console.log(`${C.cyan}[API 路由比对] 开始检查... (mode: ${WARN_ONLY ? 'warn-only' : 'strict'})${C.reset}`)

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

// 提取前端调用(扫描 web + mobile-rn + miniapp-taro + extension + desktop)
const frontendFiles = []
for (const dir of FRONTEND_DIRS) {
  frontendFiles.push(...collectFiles(dir, ['.ts', '.tsx']))
}
const allCalls = []
for (const file of frontendFiles) {
  const src = readFileSync(file, 'utf8')
  allCalls.push(...extractFrontendCalls(src, file))
}

console.log(`${C.dim}[API 路由比对] 前端 API 调用: ${allCalls.length} 处(扫描 ${FRONTEND_DIRS.length} 个端)${C.reset}`)

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
