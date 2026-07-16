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
const WEB_DIR = join(ROOT, 'apps/web')
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
      // 推断 method: 支持跨行(method: 'POST' 可能在 path 所在行的前后 3 行内)
      let method = 'GET'
      const contextLines = []
      for (let i = -3; i <= 4; i++) {
        contextLines.push(lines[idx + i] || '')
      }
      const context = contextLines.join('\n').toLowerCase()
      const methodMatch = context.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
      if (methodMatch) {
        method = methodMatch[1].toUpperCase()
      } else if (/\bpost\s*[<(]/.test(context)) {
        method = 'POST'
      } else if (/\bput\s*[<(]/.test(context)) {
        method = 'PUT'
      } else if (/\bpatch\s*[<(]/.test(context)) {
        method = 'PATCH'
      } else if (/\bdelete\s*[<(]/.test(context)) {
        method = 'DELETE'
      }
      // 如果路径是 fetchApi('/api/...', { method: 'POST' }) 中的第二个参数，
      // 但 method 在路径之后跨行，上述上下文已覆盖
      // 如果路径本身在对象字面量值中（如 { post: '/api/xxx' }），尝试从 key 推断
      if (method === 'GET') {
        const prev = (lines[idx - 1] || '').toLowerCase()
        const keyMatch = prev.match(/\b(post|put|patch|delete)\s*:\s*['"`]/)
        if (keyMatch) method = keyMatch[1].toUpperCase()
      }
      // 模板字符串变量替换为 :param
      const normalized = rawPath
        .replace(/\$\{[^}]+\}/g, ':param')
        .replace(/\?.*$/, '')
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

/** 提取 server.ts 中的 register 前缀映射 */
function extractRegisterPrefixes() {
  const calls = []
  if (!existsSync(SERVER_FILE)) return calls
  const src = readFileSync(SERVER_FILE, 'utf8')
  // 匹配 server.register(xxxRoutes, { prefix: '/api/admin' })
  const re = /server\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src)) !== null) {
    calls.push({ plugin: m[1], prefix: m[2] })
  }
  return calls
}

/** 提取后端路由文件中的 server.xxx('path', ...) 注册 */
function extractBackendRoutes() {
  const routes = []
  const prefixes = extractRegisterPrefixes()
  if (!existsSync(API_ROUTES_DIR)) return routes
  const files = collectFiles(API_ROUTES_DIR, ['.ts'])
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    // 匹配 server.get/post/put/patch/delete('path', ...)
    const re = /server\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g
    let m
    while ((m = re.exec(src)) !== null) {
      routes.push({
        method: m[1].toUpperCase(),
        localPath: m[2],
        file: relative(ROOT, file),
      })
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

const backendDumpIdx = process.argv.indexOf('--dump-backend')
if (backendDumpIdx !== -1 && process.argv[backendDumpIdx + 1]) {
  writeFileSync(
    process.argv[backendDumpIdx + 1],
    JSON.stringify(
      backendRoutes.map((r) => {
        const fullPaths = prefixes.map((p) => `${r.method} ${normalizePath(p.prefix, r.localPath)}`)
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
  // 对每个路由，尝试所有可能的 prefix 组合（简化：用最长匹配）
  // 实际上 prefix 是固定的，但脚本简化处理：直接用 localPath 在所有 prefix 下尝试
  for (const p of prefixes) {
    const full = normalizePath(p.prefix, r.localPath)
    backendPathSet.add(`${r.method} ${full}`)
  }
  // 也添加不带 prefix 的（plugin 内部可能没有 prefix）
  backendPathSet.add(`${r.method} ${r.localPath}`)
}

console.log(`${C.dim}[API 路由比对] 后端注册路由: ${backendRoutes.length} 条（含 ${prefixes.length} 个前缀）${C.reset}`)

// 提取前端调用
const frontendFiles = collectFiles(WEB_DIR, ['.ts', '.tsx'])
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
    if (bm === call.method && pathMatches(call.path, bp2)) {
      found = true
      break
    }
  }
  if (!found) {
    missing.push(call)
  }
}

if (missing.length === 0) {
  console.log(`${C.green}[API 路由比对] ✅ 通过，前端所有 API 调用均有后端路由对应${C.reset}`)
  process.exit(0)
}

const dumpIdx = process.argv.indexOf('--dump-missing')
if (dumpIdx !== -1 && process.argv[dumpIdx + 1]) {
  writeFileSync(process.argv[dumpIdx + 1], JSON.stringify(missing, null, 2), 'utf8')
}

console.log(`${C.red}[API 路由比对] ❌ 发现 ${missing.length} 处前端调用无后端路由（404 风险）:${C.reset}`)
for (const m of missing.slice(0, 50)) {
  console.log(`${C.red}  ${m.method} ${m.path}${C.reset}`)
  console.log(`${C.dim}    @ ${m.file}:${m.line}${C.reset}`)
}
if (missing.length > 50) {
  console.log(`${C.dim}  ... 还有 ${missing.length - 50} 处${C.reset}`)
}
console.log('')
console.log(`${C.yellow}修复方法:${C.reset}`)
console.log(`  1. 确认前端调用路径是否正确（检查 prefix 层级）`)
console.log(`  2. 确认 HTTP 方法是否匹配（GET/POST/PUT/PATCH/DELETE）`)
console.log(`  3. 如后端缺失，在 apps/api/src/routes/ 对应文件补建路由`)
console.log(`  4. 如前端错误，修正前端调用路径或方法`)
process.exit(WARN_ONLY ? 0 : 1)
