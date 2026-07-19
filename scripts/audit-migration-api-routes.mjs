#!/usr/bin/env node
/**
 * 阶段 2: API 端点 content-level 比对
 *
 * 比对 D:\历史项目存档\ 下 Java 微服务端点 vs 当前 IHUI-AI 仓库 apps/api/src/routes Fastify 路由
 * 输出 4 类对照表 CSV:已迁移 / 部分迁移 / 缺失 / 无需迁移
 *
 * 用法:node scripts/audit-migration-api-routes.mjs
 * 输出:reports/migration-audit-api-routes-{timestamp}.csv
 *       reports/migration-audit-api-routes-summary.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// ─── 配置 ───────────────────────────────────────────────────────────
const LEGACY_ROOTS = [
  'D:\\历史项目存档\\edu server',
  'D:\\历史项目存档\\code',
  'D:\\历史项目存档\\edu client',
  'D:\\历史项目存档\\ljd-交接文件',
]

const NEW_ROUTES_ROOT = 'g:\\IHUI-AI\\apps\\api\\src\\routes'

// 业务模块关键词清单(用于业务模块匹配,按优先级排序)
const BUSINESS_KEYWORDS = [
  'user', 'auth', 'order', 'pay', 'course', 'article', 'ai', 'chat', 'model',
  'agent', 'market', 'admin', 'file', 'upload', 'message', 'notification',
  'role', 'permission', 'category', 'tag', 'comment', 'stat', 'dashboard',
  'live', 'exam', 'learn', 'topic', 'ask', 'resource', 'point', 'member',
  'video', 'search', 'setting', 'system', 'menu', 'config', 'dept', 'post',
  'notice', 'dict', 'operlog', 'logininfor', 'news', 'contact', 'storage',
  'about', 'coze', 'mcp', 'developer', 'agreement', 'invoice', 'commission',
  'distribution', 'product', 'identity', 'activity', 'withdrawal', 'version',
  'feedback', 'site', 'remote', 'device', 'audit', 'fund', 'finance',
  'billing', 'wallet', 'plaza', 'rank', 'ranking', 'token', 'profile',
  'visit', 'workwechat', 'wechat', 'oauth', 'lecturer', 'statistics',
  'usercenter', 'remind', 'plan', 'material', 'class', 'schedule', 'tbox',
  'suno', 'sora', 'kling', 'gemini', 'ali', 'tencent', 'hunyuan', 'zhipu',
  'crew', 'workspace', 'team', 'organization', 'tenant', 'share', 'social',
  'group', 'community', 'circle', 'post', 'recommendation', 'mobile',
  'advertise', 'faq', 'carousel', 'announcement', 'app-version', 'checkin',
  'gamification', 'refund', 'callback', 'webhook', 'sdks', 'tools',
  'transcode', 'srs', 'drama', 'stock', 'trader', 'tbox', 'monitor',
  'telemetry', 'canary', 'i18n', 'gdpr', 'rbac', 'openclaw', 'clawdbot',
  'customer-service', 'n8n', 'outbound', 'packages', 'pricing', 'promotions',
  'push', 'report', 'rewarded-video-ad', 'service-catalog',
  'platform-templates', 'bi-dashboard', 'feature-center', 'agentic-service',
  'frontend-stub', 'education-platform', 'edu', 'knowledge-rag',
  'llm-models', 'chat-models', 'ai-vendors', 'ai-world', 'ai-feed',
  'ai-generation', 'ai-image-edit', 'ai-audio', 'ai-callback',
  'ai-chat-stream', 'ai-education', 'ai-user-model-chat', 'ai-video-compose',
  'ai-extended', 'auth-extended', 'auth-identity', 'auth-sso',
  'content-extended', 'payment-extended', 'payment-gateway', 'payment-recurring',
  'notification-extended', 'system-extended', 'remote-extended',
  'misc-extended', 'legacy-completion', 'migration-e2e', 'developer',
  'agent-extended', 'agent-runtime', 'agent-buy', 'agent-developer',
  'agent-withdrawal-detail', 'agreements', 'ask-extended', 'edu-extended',
  'edu-public', 'edu-stubs', 'live-extended', 'mcp-extended', 'p0-audit',
  'p30-supplement', 'fund', 'finance-extended', 'system', 'apps',
  'apps-platform', 'api-platform', 'exchange-rate', 'gray-release',
  'monitoring', 'sensitive-words', 'shop', 'zone', 'sys', 'missing-routes',
  'private-letters', 'error-dashboard', 'demand-square', 'faqq',
  'agreements', 'invoicestitles', 'member-permissions', 'member-users',
  'task-developer', 'user-agent-audio', 'user-agent-image', 'video-logs',
  'zhs-activity', 'zhs-agent', 'zhs-identity', 'zhs-user', 'zhs-course',
  'zhs-organization', 'system-login-logs', 'system-operation-logs',
  'identity-proportion', 'developer-link', 'auth-user-vip', 'auth-vip-level',
  'auth-tokens', 'auth-sms-temp', 'auth-role', 'auth-info', 'auth-accounts',
  'comment-logs', 'oss-files', 'stats', 'agreements', 'api-platform',
  'demand-audit', 'online-users', 'examine', 'menu', 'auth', 'user',
]

// ─── 工具函数 ───────────────────────────────────────────────────────

/**
 * 安全调用 rg,返回 stdout 字符串。无匹配时返回空字符串。
 * 使用 execFileSync 数组形式避免 shell 解析正则字符(|, $, 等)。
 */
function runRg(pattern, searchPath, glob, extraArgs = []) {
  const args = [
    '--line-number',
    '--no-heading',
    '--with-filename',
    '--color', 'never',
  ]
  if (glob) args.push('-g', glob)
  args.push(...extraArgs)
  args.push('--', pattern, searchPath)
  try {
    return execFileSync('rg', args, {
      encoding: 'utf8',
      maxBuffer: 200 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    // rg exit code 1 = no matches,正常
    if (e.status === 1) return ''
    // 其他错误抛出
    const stderr = e.stderr ? e.stderr.toString() : ''
    throw new Error(`rg failed in ${searchPath}: ${e.message}\nstderr: ${stderr}`)
  }
}

/**
 * 解析 rg 输出为 {file, line, content} 数组。
 */
function parseRgOutput(output) {
  const results = []
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue
    // 格式:file:line:content  (Windows 路径含 :,但 rg 用第一个 : 分隔)
    // Windows 绝对路径以盘符开头如 D:\,rg 输出格式为 D:\path:line:content
    const match = line.match(/^([^:]+:[^:]+):(\d+):(.*)$/)
    if (match) {
      results.push({ file: match[1], line: parseInt(match[2], 10), content: match[3] })
    } else {
      // fallback: file:line:content
      const idx1 = line.indexOf(':')
      const idx2 = line.indexOf(':', idx1 + 1)
      const idx3 = line.indexOf(':', idx2 + 1)
      if (idx3 > 0) {
        results.push({
          file: line.slice(0, idx2),
          line: parseInt(line.slice(idx2 + 1, idx3), 10),
          content: line.slice(idx3 + 1),
        })
      }
    }
  }
  return results
}

/**
 * 从 Java 注解内容提取路径。
 * 支持:@GetMapping("/path") / @GetMapping(value = "/path") / @GetMapping(value = {"/a", "/b"})
 * 不带参数返回空数组(表示使用类级前缀)。
 */
function extractJavaPaths(annotationContent) {
  // 提取双引号包裹的路径
  const paths = []
  const pathRegex = /"([^"]*)"/g
  let m
  while ((m = pathRegex.exec(annotationContent)) !== null) {
    paths.push(m[1])
  }
  return paths
}

/**
 * 提取 Java 端点。
 * 策略:
 *   1. 用 rg 拿到所有 @RestController 文件路径
 *   2. 对每个文件读取内容,解析:
 *      - 类级 @RequestMapping("/prefix") 作为 prefix
 *      - 方法级 @GetMapping/@PostMapping/... 作为端点
 *      - 完整路径 = prefix + method path
 */
function scanJavaEndpoints() {
  const endpoints = []
  const controllerFiles = new Set()

  // Step 1: 找所有 @RestController 文件
  for (const root of LEGACY_ROOTS) {
    if (!fs.existsSync(root)) continue
    const output = runRg('@RestController', root, '*.java')
    for (const entry of parseRgOutput(output)) {
      controllerFiles.add(entry.file)
    }
  }

  // Step 2: 也加上带 @RequestMapping 但不带 @RestController 的(可能是 @Controller)
  for (const root of LEGACY_ROOTS) {
    if (!fs.existsSync(root)) continue
    const output = runRg('@Controller\\b', root, '*.java')
    for (const entry of parseRgOutput(output)) {
      // 只添加非 @RestController 的(避免重复)
      const content = fs.readFileSync(entry.file, 'utf8')
      if (!content.includes('@RestController')) {
        controllerFiles.add(entry.file)
      }
    }
  }

  console.log(`  找到 ${controllerFiles.size} 个 Java controller 文件(含重复拷贝)`)

  // Step 3: 对每个 controller 文件,解析端点
  // 用相对路径去重:D:\历史项目存档\code\xxx 与 D:\历史项目存档\ljd-交接文件\xxx 视为相同
  const seenByRelPath = new Map() // relPath → { file, endpoints }

  for (const file of controllerFiles) {
    let content
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }

    // 提取相对路径(去除 LEGACY_ROOTS 前缀)
    let relPath = file
    for (const root of LEGACY_ROOTS) {
      if (file.startsWith(root)) {
        relPath = file.slice(root.length).replace(/^[\\\/]/, '')
        break
      }
    }

    // 提取类名(在 @RestController / @Controller 之后的 public class XxxController)
    const classMatch = content.match(/(?:@RestController|@Controller)[\s\S]{0,500}?public\s+class\s+(\w+)/)
    const className = classMatch ? classMatch[1] : path.basename(file, '.java')

    // 提取类级 @RequestMapping(出现在 public class 之前)
    // 模式:@RequestMapping("/prefix") 或 @RequestMapping(value = "/prefix")
    let classPrefix = ''
    if (classMatch) {
      // 在 @RestController 之后到 public class 之间找 @RequestMapping
      const beforeClass = content.slice(0, content.indexOf(`class ${className}`))
      const classReqMatch = beforeClass.match(/@RequestMapping\s*\(([^)]*)\)/)
      if (classReqMatch) {
        const paths = extractJavaPaths(classReqMatch[1])
        if (paths.length > 0) classPrefix = paths[0]
      }
    }

    // 提取方法级端点
    const methodEndpoints = []
    const annotationRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(([^)]*)\)/g
    let am
    while ((am = annotationRegex.exec(content)) !== null) {
      const annotationType = am[1]
      const args = am[2]
      const lineNum = content.slice(0, am.index).split('\n').length

      // 跳过类级 @RequestMapping(在 public class 之前的)
      if (annotationType === 'RequestMapping' && classMatch) {
        const beforeClass = content.slice(0, content.indexOf(`class ${className}`))
        if (am.index < beforeClass.length) continue
      }

      // 推断 HTTP 方法
      let httpMethod
      if (annotationType === 'RequestMapping') {
        // 方法级 @RequestMapping 默认 GET,或通过 method= 指定
        const methodMatch = args.match(/method\s*=\s*(?:RequestMethod\.)?(\w+)/)
        httpMethod = methodMatch ? methodMatch[1].toUpperCase() : 'ANY'
      } else {
        httpMethod = annotationType.replace('Mapping', '').toUpperCase()
      }

      // 提取路径
      let paths = extractJavaPaths(args)
      if (paths.length === 0) {
        // 无路径参数,使用空(完整路径 = 类前缀)
        paths = ['']
      }

      for (const p of paths) {
        const fullPath = joinPaths(classPrefix, p)
        methodEndpoints.push({
          httpMethod,
          path: fullPath,
          rawPath: p,
          classPrefix,
          line: lineNum,
        })
      }
    }

    // 去重:同一 relPath 的文件视为相同(取第一个出现的)
    if (seenByRelPath.has(relPath)) {
      continue
    }
    seenByRelPath.set(relPath, { file, className, endpoints: methodEndpoints })

    for (const ep of methodEndpoints) {
      endpoints.push({
        file,
        relPath,
        className,
        httpMethod: ep.httpMethod,
        path: ep.path,
        classPrefix: ep.classPrefix,
        rawPath: ep.rawPath,
        line: ep.line,
      })
    }
  }

  return { endpoints, uniqueControllers: seenByRelPath.size }
}

/**
 * 拼接 Java 路径前缀 + 方法路径。
 * @RequestMapping("/api") + @GetMapping("/foo") → /api/foo
 */
function joinPaths(prefix, suffix) {
  if (!suffix) return prefix || ''
  if (!prefix) return suffix
  return prefix.replace(/\/+$/, '') + '/' + suffix.replace(/^\/+/, '')
}

/**
 * 扫描 Fastify 路由。
 * 模式:server.(get|post|put|delete|patch)("/path", ...) 或 fastify.(...)
 */
function scanFastifyRoutes() {
  const routes = []
  if (!fs.existsSync(NEW_ROUTES_ROOT)) {
    console.log(`  路由目录不存在: ${NEW_ROUTES_ROOT}`)
    return routes
  }

  const output = runRg(
    '\\.(get|post|put|delete|patch)\\s*\\(\\s*[\'"`]',
    NEW_ROUTES_ROOT,
    '*.ts'
  )

  for (const entry of parseRgOutput(output)) {
    const { file, line, content } = entry
    // 提取 HTTP 方法
    const methodMatch = content.match(/\.(\w+)\s*\(\s*['"`]/)
    if (!methodMatch) continue
    const httpMethod = methodMatch[1].toUpperCase()

    // 提取路径(支持 'path' / `path` / "path",处理转义)
    const pathMatch = content.match(/\.\w+\s*\(\s*(['"`])([^'"`]*)\1/)
    if (!pathMatch) continue
    const routePath = pathMatch[2]

    routes.push({
      file,
      relPath: path.relative(NEW_ROUTES_ROOT, file).replace(/\\/g, '/'),
      httpMethod,
      path: routePath,
      line,
    })
  }

  return routes
}

// ─── 路径归一化 ─────────────────────────────────────────────────────

/**
 * 归一化路径用于匹配。
 *   - 去除 /api/v1, /api, /v1 前缀
 *   - {id} → :id
 *   - 末尾斜杠去掉
 *   - 大小写不敏感(返回小写)
 */
function normalizePath(p) {
  if (!p) return ''
  let s = p.trim()
  // 去除前缀
  s = s.replace(/^\/api\/v\d+\//i, '/')
  s = s.replace(/^\/api\//i, '/')
  s = s.replace(/^\/v\d+\//i, '/')
  // {id} → :id
  s = s.replace(/\{(\w+)\}/g, ':$1')
  // 末尾斜杠
  s = s.replace(/\/+$/, '')
  if (s === '') s = '/'
  return s.toLowerCase()
}

/**
 * 提取路径的第一段(用于业务模块匹配)。
 *   /users/:id → users
 *   /admin/menu → admin/menu (取前 2 段)
 */
function getPathModule(p) {
  const norm = normalizePath(p)
  const segments = norm.split('/').filter(Boolean)
  if (segments.length === 0) return ''
  return segments[0]
}

function getPathSegments(p) {
  const norm = normalizePath(p)
  return norm.split('/').filter(Boolean)
}

// ─── 匹配策略 ───────────────────────────────────────────────────────

/**
 * 匹配 Java 端点与 Fastify 路由。
 * 优先级:精确匹配 > 路径前缀匹配 > 业务模块关键词匹配
 *
 * 返回:
 *   - { status: '已迁移', matchedRoutes: [...], reason: '...' }
 *   - { status: '部分迁移', matchedRoutes: [...], reason: '...' }
 *   - { status: '缺失', matchedRoutes: [], reason: '...' }
 */
function matchEndpoint(javaEndpoint, fastifyRoutes) {
  const normJavaPath = normalizePath(javaEndpoint.path)
  const javaMethod = javaEndpoint.httpMethod

  // 1. 精确匹配:method + 路径完全一致
  const exactMatches = fastifyRoutes.filter(r => {
    if (javaMethod === 'ANY') return normalizePath(r.path) === normJavaPath
    return r.httpMethod === javaMethod && normalizePath(r.path) === normJavaPath
  })
  if (exactMatches.length > 0) {
    return {
      status: '已迁移',
      matchedRoutes: exactMatches,
      reason: `精确匹配: ${javaMethod} ${normJavaPath}`,
    }
  }

  // 2. 路径前缀匹配:Java 路径以 Fastify 路径开头,或反之(忽略 HTTP 方法)
  const prefixMatches = fastifyRoutes.filter(r => {
    const normRoute = normalizePath(r.path)
    if (normRoute === '/' || normJavaPath === '/') return false
    // 至少 2 段重合
    const javaSegs = getPathSegments(javaEndpoint.path)
    const routeSegs = getPathSegments(r.path)
    if (javaSegs.length === 0 || routeSegs.length === 0) return false
    // 第 1 段必须相同
    if (javaSegs[0] !== routeSegs[0]) return false
    // 路径互相包含
    return normRoute.startsWith(normJavaPath + '/') ||
           normJavaPath.startsWith(normRoute + '/') ||
           (javaSegs.length >= 2 && routeSegs.length >= 2 && javaSegs[1] === routeSegs[1])
  })
  if (prefixMatches.length > 0) {
    return {
      status: '部分迁移',
      matchedRoutes: prefixMatches.slice(0, 3),
      reason: `路径前缀匹配: ${normJavaPath} → ${prefixMatches.length} 个候选`,
    }
  }

  // 3. 业务模块关键词匹配
  const javaModule = getPathModule(javaEndpoint.path)
  if (javaModule && BUSINESS_KEYWORDS.includes(javaModule)) {
    // 检查是否有 Fastify 路由也使用相同模块
    const keywordMatches = fastifyRoutes.filter(r => {
      const routeModule = getPathModule(r.path)
      return routeModule === javaModule
    })
    if (keywordMatches.length > 0) {
      return {
        status: '部分迁移',
        matchedRoutes: keywordMatches.slice(0, 3),
        reason: `业务模块匹配: ${javaModule}`,
      }
    }
  }

  // 4. 缺失
  return {
    status: '缺失',
    matchedRoutes: [],
    reason: `无匹配: ${javaMethod} ${normJavaPath}`,
  }
}

/**
 * 判断 Fastify 路由是否在 Java 端点中有对应(用于"无需迁移"分类)
 */
function findMatchingJavaEndpoint(route, javaEndpoints) {
  const normRoute = normalizePath(route.path)
  // 精确
  let m = javaEndpoints.find(e => {
    if (e.httpMethod === 'ANY') return normalizePath(e.path) === normRoute
    return e.httpMethod === route.httpMethod && normalizePath(e.path) === normRoute
  })
  if (m) return { match: m, type: 'exact' }

  // 前缀
  m = javaEndpoints.find(e => {
    const normJava = normalizePath(e.path)
    if (normJava === '/' || normRoute === '/') return false
    return normRoute.startsWith(normJava + '/') ||
           normJava.startsWith(normRoute + '/')
  })
  if (m) return { match: m, type: 'prefix' }

  // 模块
  const routeModule = getPathModule(route.path)
  if (routeModule && BUSINESS_KEYWORDS.includes(routeModule)) {
    m = javaEndpoints.find(e => getPathModule(e.path) === routeModule)
    if (m) return { match: m, type: 'module' }
  }
  return null
}

// ─── 主流程 ─────────────────────────────────────────────────────────
function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportsDir = path.resolve('reports')
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

  console.log('=== 阶段 2:API 端点 content-level 比对 ===\n')

  // 1. 扫描 D 盘 Java 端点
  console.log('扫描 D 盘 Java 端点...')
  const { endpoints: javaEndpoints, uniqueControllers } = scanJavaEndpoints()
  console.log(`  Java 端点总数: ${javaEndpoints.length}`)
  console.log(`  唯一 controller 文件数(去重): ${uniqueControllers}\n`)

  // 2. 扫描当前仓库 Fastify 路由
  console.log('扫描当前仓库 Fastify 路由...')
  const fastifyRoutes = scanFastifyRoutes()
  console.log(`  Fastify 路由总数: ${fastifyRoutes.length}\n`)

  // 3. 端点去重(Java:相同 method + normalized path 视为重复)
  const javaUnique = new Map()
  for (const ep of javaEndpoints) {
    const key = `${ep.httpMethod}||${normalizePath(ep.path)}`
    if (!javaUnique.has(key)) javaUnique.set(key, ep)
  }
  const javaEndpointsUnique = Array.from(javaUnique.values())
  console.log(`  Java 端点去重后: ${javaEndpointsUnique.length}`)

  // Fastify 路由去重
  const fastifyUnique = new Map()
  for (const r of fastifyRoutes) {
    const key = `${r.httpMethod}||${normalizePath(r.path)}||${r.relPath}`
    if (!fastifyUnique.has(key)) fastifyUnique.set(key, r)
  }
  const fastifyRoutesUnique = Array.from(fastifyUnique.values())
  console.log(`  Fastify 路由去重后: ${fastifyRoutesUnique.length}\n`)

  // 4. 匹配
  console.log('执行匹配(精确 > 前缀 > 业务模块)...')
  const auditResults = []
  const stats = {
    已迁移: 0,
    部分迁移: 0,
    缺失: 0,
    无需迁移: 0,
  }

  // 4a. Java → Fastify 匹配
  for (const ep of javaEndpointsUnique) {
    const match = matchEndpoint(ep, fastifyRoutesUnique)
    auditResults.push({
      source: 'java',
      httpMethod: ep.httpMethod,
      path: ep.path,
      normalizedPath: normalizePath(ep.path),
      legacyFile: ep.relPath,
      legacyClass: ep.className,
      status: match.status,
      matchedRoutes: match.matchedRoutes.map(r =>
        `${r.httpMethod} ${r.path} (${r.relPath}:${r.line})`
      ).join(' | '),
      reason: match.reason,
    })
    stats[match.status] = (stats[match.status] || 0) + 1
  }

  // 4b. Fastify 中无对应 Java 的端点 → 无需迁移(当前仓库新增)
  for (const r of fastifyRoutesUnique) {
    const matched = findMatchingJavaEndpoint(r, javaEndpointsUnique)
    if (!matched) {
      auditResults.push({
        source: 'fastify',
        httpMethod: r.httpMethod,
        path: r.path,
        normalizedPath: normalizePath(r.path),
        legacyFile: '',
        legacyClass: '',
        status: '无需迁移',
        matchedRoutes: `${r.httpMethod} ${r.path} (${r.relPath}:${r.line})`,
        reason: '当前仓库新增端点(无 Java 对应)',
      })
      stats['无需迁移']++
    }
  }

  // 5. 统计输出
  console.log('\n=== 匹配结果统计 ===')
  console.log(`已迁移: ${stats['已迁移']}`)
  console.log(`部分迁移: ${stats['部分迁移']}`)
  console.log(`缺失: ${stats['缺失']}`)
  console.log(`无需迁移(新增): ${stats['无需迁移']}`)
  console.log(`总计: ${auditResults.length}`)

  // 6. 缺失端点分类分析(语言迁移 vs 真实缺失)
  const missingResults = auditResults.filter(r => r.status === '缺失')
  const missingAnalysis = analyzeMissingEndpoints(missingResults)
  console.log('\n=== 缺失端点分析 ===')
  console.log(`缺失总数: ${missingResults.length}`)
  console.log(`  语言迁移预期(有同模块的 Fastify 路由): ${missingAnalysis.languageMigration}`)
  console.log(`  真实缺失(无任何同模块路由): ${missingAnalysis.realMissing}`)
  console.log(`  无路径端点(@RequestMapping 无参): ${missingAnalysis.noPath}`)

  // 7. 输出 CSV
  const csvPath = path.join(reportsDir, `migration-audit-api-routes-${timestamp}.csv`)
  const csvLines = [
    'source,httpMethod,path,normalizedPath,legacyFile,legacyClass,status,matchedRoutes,reason',
  ]
  for (const r of auditResults) {
    const escape = s => `"${String(s).replace(/"/g, '""')}"`
    csvLines.push([
      r.source, r.httpMethod, r.path, r.normalizedPath,
      r.legacyFile, r.legacyClass, r.status, r.matchedRoutes, r.reason,
    ].map(escape).join(','))
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')
  console.log(`\n审计 CSV: ${csvPath}`)

  // 8. 输出 summary JSON
  const summaryPath = path.join(reportsDir, `migration-audit-api-routes-summary.json`)
  const totalJava = javaEndpointsUnique.length
  const totalFastify = fastifyRoutesUnique.length
  const migratedPct = totalJava > 0
    ? ((stats['已迁移'] / totalJava) * 100).toFixed(1)
    : '0.0'
  const partialPct = totalJava > 0
    ? ((stats['部分迁移'] / totalJava) * 100).toFixed(1)
    : '0.0'
  const missingPct = totalJava > 0
    ? ((stats['缺失'] / totalJava) * 100).toFixed(1)
    : '0.0'
  const noNeedPct = totalFastify > 0
    ? ((stats['无需迁移'] / totalFastify) * 100).toFixed(1)
    : '0.0'

  const summary = {
    timestamp,
    phase: '阶段 2: API 端点 content-level 比对',
    legacyRoots: LEGACY_ROOTS,
    newRoutesRoot: NEW_ROUTES_ROOT,
    javaEndpointsTotal: javaEndpoints.length,
    javaEndpointsUnique: totalJava,
    javaUniqueControllers: uniqueControllers,
    fastifyRoutesTotal: fastifyRoutes.length,
    fastifyRoutesUnique: totalFastify,
    stats: {
      已迁移: stats['已迁移'],
      部分迁移: stats['部分迁移'],
      缺失: stats['缺失'],
      无需迁移: stats['无需迁移'],
    },
    percentages: {
      已迁移: `${migratedPct}%`,
      部分迁移: `${partialPct}%`,
      缺失: `${missingPct}%(相对 Java 端点)`,
      无需迁移: `${noNeedPct}%(相对 Fastify 路由)`,
    },
    missingAnalysis: {
      totalMissing: missingResults.length,
      languageMigrationExpected: missingAnalysis.languageMigration,
      realMissing: missingAnalysis.realMissing,
      noPath: missingAnalysis.noPath,
      realMissingExamples: missingAnalysis.realMissingExamples,
    },
    nextPhaseRecommendation: missingAnalysis.realMissing > 0
      ? '需要阶段 3:对真实缺失端点做业务影响评估(是否需要补齐)'
      : '语言迁移完成度高,可考虑阶段 3 数据库表/i18n key 比对',
  }
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`摘要 JSON: ${summaryPath}`)

  // 9. 退出码
  if (javaEndpoints.length === 0 && fastifyRoutes.length === 0) {
    console.error('\n❌ 审计失败:无任何端点被审计')
    process.exit(1)
  }
  console.log('\n✅ 审计完成')
  process.exit(0)
}

/**
 * 分析缺失端点:区分语言迁移预期 vs 真实缺失。
 * 语言迁移预期 = Java 端点的业务模块在当前仓库有路由(只是路径/方法不同)
 * 真实缺失 = Java 端点的业务模块在当前仓库完全没有任何路由
 */
function analyzeMissingEndpoints(missingResults) {
  let languageMigration = 0
  let realMissing = 0
  let noPath = 0
  const realMissingExamples = []

  // 收集所有缺失端点的业务模块
  const missingModules = new Map() // module → count
  for (const r of missingResults) {
    if (!r.path || r.path === '') {
      noPath++
      continue
    }
    const mod = getPathModule(r.path)
    if (!mod) {
      noPath++
      continue
    }
    missingModules.set(mod, (missingModules.get(mod) || 0) + 1)
  }

  // 加载所有 Fastify 路由的模块清单
  // 重新扫描比较稳妥,但主流程已扫过,这里通过文件读 CSV 也行;为简化,重新扫
  const fastifyModules = new Set()
  const fastifyRoutes = scanFastifyRoutes()
  for (const r of fastifyRoutes) {
    const m = getPathModule(r.path)
    if (m) fastifyModules.add(m)
  }

  // 对每个缺失端点判断:其模块在 Fastify 中是否有对应路由
  for (const r of missingResults) {
    if (!r.path || r.path === '') {
      continue // 已计入 noPath
    }
    const mod = getPathModule(r.path)
    if (fastifyModules.has(mod) || BUSINESS_KEYWORDS.includes(mod)) {
      languageMigration++
    } else {
      realMissing++
      if (realMissingExamples.length < 10) {
        realMissingExamples.push({
          httpMethod: r.httpMethod,
          path: r.path,
          module: mod,
          legacyClass: r.legacyClass,
          legacyFile: r.legacyFile,
        })
      }
    }
  }

  return { languageMigration, realMissing, noPath, realMissingExamples }
}

main()
