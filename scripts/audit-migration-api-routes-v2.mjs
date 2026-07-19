#!/usr/bin/env node
/**
 * 阶段 2 v2: API 端点 content-level 比对(带路由前缀映射规则)
 *
 * 基于 v1 (audit-migration-api-routes.mjs) 扩展:
 *   1. 加载 reports/api-prefix-mapping-rules.json
 *   2. 对每个 Java 端点路径,先应用 prefix_strip / prefix_rewrite 规则处理 Java 微服务前缀
 *   3. 再用 module_rewrite 规则处理业务模块名(单数→复数 / snake_case→kebab-case / 业务重命名)
 *   4. 用转换后的路径重新做 3 级匹配(精确 > 前缀 > 业务模块)
 *   5. 输出 4 类对照表:已迁移 / 部分迁移 / 真实缺失 / 无需迁移
 *
 * 用法:node scripts/audit-migration-api-routes-v2.mjs
 * 输出:reports/migration-audit-api-routes-v2-{timestamp}.csv
 *       reports/migration-audit-api-routes-v2-summary.json
 *       reports/api-prefix-mapping-rules.json (回写每条规则的 hits 字段)
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
const RULES_PATH = 'g:\\IHUI-AI\\reports\\api-prefix-mapping-rules.json'

// v1 真实缺失基线(用于 v1 vs v2 对比)
const V1_REAL_MISSING = 806
const V1_TOTAL_MISSING = 970

// 业务模块关键词清单(沿用 v1)
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

function runRg(pattern, searchPath, glob, extraArgs = []) {
  const args = ['--line-number', '--no-heading', '--with-filename', '--color', 'never']
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
    if (e.status === 1) return ''
    const stderr = e.stderr ? e.stderr.toString() : ''
    throw new Error(`rg failed in ${searchPath}: ${e.message}\nstderr: ${stderr}`)
  }
}

function parseRgOutput(output) {
  const results = []
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue
    const match = line.match(/^([^:]+:[^:]+):(\d+):(.*)$/)
    if (match) {
      results.push({ file: match[1], line: parseInt(match[2], 10), content: match[3] })
    } else {
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

function extractJavaPaths(annotationContent) {
  const paths = []
  const pathRegex = /"([^"]*)"/g
  let m
  while ((m = pathRegex.exec(annotationContent)) !== null) {
    paths.push(m[1])
  }
  return paths
}

function joinPaths(prefix, suffix) {
  if (!suffix) return prefix || ''
  if (!prefix) return suffix
  return prefix.replace(/\/+$/, '') + '/' + suffix.replace(/^\/+/, '')
}

// ─── Java 端点扫描(沿用 v1 逻辑)─────────────────────────────────

function scanJavaEndpoints() {
  const endpoints = []
  const controllerFiles = new Set()

  for (const root of LEGACY_ROOTS) {
    if (!fs.existsSync(root)) continue
    const output = runRg('@RestController', root, '*.java')
    for (const entry of parseRgOutput(output)) {
      controllerFiles.add(entry.file)
    }
  }

  for (const root of LEGACY_ROOTS) {
    if (!fs.existsSync(root)) continue
    const output = runRg('@Controller\\b', root, '*.java')
    for (const entry of parseRgOutput(output)) {
      const content = fs.readFileSync(entry.file, 'utf8')
      if (!content.includes('@RestController')) {
        controllerFiles.add(entry.file)
      }
    }
  }

  console.log(`  找到 ${controllerFiles.size} 个 Java controller 文件(含重复拷贝)`)

  const seenByRelPath = new Map()

  for (const file of controllerFiles) {
    let content
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }

    let relPath = file
    for (const root of LEGACY_ROOTS) {
      if (file.startsWith(root)) {
        relPath = file.slice(root.length).replace(/^[\\\/]/, '')
        break
      }
    }

    const classMatch = content.match(/(?:@RestController|@Controller)[\s\S]{0,500}?public\s+class\s+(\w+)/)
    const className = classMatch ? classMatch[1] : path.basename(file, '.java')

    let classPrefix = ''
    if (classMatch) {
      const beforeClass = content.slice(0, content.indexOf(`class ${className}`))
      const classReqMatch = beforeClass.match(/@RequestMapping\s*\(([^)]*)\)/)
      if (classReqMatch) {
        const paths = extractJavaPaths(classReqMatch[1])
        if (paths.length > 0) classPrefix = paths[0]
      }
    }

    const methodEndpoints = []
    const annotationRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(([^)]*)\)/g
    let am
    while ((am = annotationRegex.exec(content)) !== null) {
      const annotationType = am[1]
      const args = am[2]
      const lineNum = content.slice(0, am.index).split('\n').length

      if (annotationType === 'RequestMapping' && classMatch) {
        const beforeClass = content.slice(0, content.indexOf(`class ${className}`))
        if (am.index < beforeClass.length) continue
      }

      let httpMethod
      if (annotationType === 'RequestMapping') {
        const methodMatch = args.match(/method\s*=\s*(?:RequestMethod\.)?(\w+)/)
        httpMethod = methodMatch ? methodMatch[1].toUpperCase() : 'ANY'
      } else {
        httpMethod = annotationType.replace('Mapping', '').toUpperCase()
      }

      let paths = extractJavaPaths(args)
      if (paths.length === 0) {
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

// ─── Fastify 路由扫描(沿用 v1 逻辑)─────────────────────────────

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
    const methodMatch = content.match(/\.(\w+)\s*\(\s*['"`]/)
    if (!methodMatch) continue
    const httpMethod = methodMatch[1].toUpperCase()

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

// ─── 路径归一化(沿用 v1)─────────────────────────────────────────

function normalizePath(p) {
  if (!p) return ''
  let s = p.trim()
  s = s.replace(/^\/api\/v\d+\//i, '/')
  s = s.replace(/^\/api\//i, '/')
  s = s.replace(/^\/v\d+\//i, '/')
  s = s.replace(/\{(\w+)\}/g, ':$1')
  s = s.replace(/\/+$/, '')
  if (s === '') s = '/'
  return s.toLowerCase()
}

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

// ─── v2 新增:规则加载与应用 ─────────────────────────────────────

function loadRules() {
  if (!fs.existsSync(RULES_PATH)) {
    throw new Error(`规则文件不存在: ${RULES_PATH}`)
  }
  const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))
  console.log(`  加载路由前缀映射规则: ${rules.prefixRules.length} 条 prefixRules, ${rules.moduleRules.length} 条 moduleRules, ${rules.skipModules.length} 条 skipModules`)
  return rules
}

/**
 * 应用 prefix 规则:剥离或重写 Java 前缀。
 * @param {string} javaPath - Java 完整路径,如 /auth-api/member/page
 * @param {Array} prefixRules - 前缀规则数组
 * @returns {{ path: string, appliedRule: object|null }}
 */
function applyPrefixRules(javaPath, prefixRules) {
  if (!javaPath) return { path: javaPath, appliedRule: null }
  for (const rule of prefixRules) {
    const prefix = rule.javaPrefix
    // 路径必须以 /prefix 开头(后跟 / 或字符串结尾)
    const re = new RegExp(`^${prefix.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}(\\/|$)`)
    if (re.test(javaPath)) {
      if (rule.strategy === 'prefix_strip') {
        // 剥离前缀,保留剩余路径
        const rest = javaPath.slice(prefix.length).replace(/^\/+/, '')
        const newPath = rest ? '/' + rest : '/'
        return { path: newPath, appliedRule: rule }
      }
      if (rule.strategy === 'prefix_rewrite') {
        const rest = javaPath.slice(prefix.length).replace(/^\/+/, '')
        const newPath = rest ? `${rule.ihuiPrefix}/${rest}` : rule.ihuiPrefix
        return { path: newPath, appliedRule: rule }
      }
    }
  }
  return { path: javaPath, appliedRule: null }
}

/**
 * 应用 module 规则:替换路径第 1 段业务模块名。
 * @param {string} p - 已应用 prefix 规则的路径
 * @param {Array} moduleRules - 模块规则数组
 * @returns {{ path: string, appliedRule: object|null }}
 */
function applyModuleRules(p, moduleRules) {
  if (!p) return { path: p, appliedRule: null }
  const segs = p.split('/').filter(Boolean)
  if (segs.length === 0) return { path: p, appliedRule: null }
  const firstSeg = segs[0]
  for (const rule of moduleRules) {
    if (rule.javaModule === firstSeg) {
      segs[0] = rule.ihuiModule
      const newPath = '/' + segs.join('/')
      return { path: newPath, appliedRule: rule }
    }
  }
  return { path: p, appliedRule: null }
}

/**
 * 判断模块是否在 skip 列表中。
 */
function isSkipModule(p, skipModules) {
  if (!p) return false
  const segs = p.split('/').filter(Boolean)
  if (segs.length === 0) return false
  const firstSeg = segs[0]
  return skipModules.some(r => r.javaModule === firstSeg)
}

// ─── 匹配策略(沿用 v1,但用转换后的路径)───────────────────────

function matchEndpoint(javaEndpoint, fastifyRoutes, mappedPath) {
  const normJavaPath = normalizePath(mappedPath)
  const javaMethod = javaEndpoint.httpMethod

  // 1. 精确匹配
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

  // 2. 路径前缀匹配
  const prefixMatches = fastifyRoutes.filter(r => {
    const normRoute = normalizePath(r.path)
    if (normRoute === '/' || normJavaPath === '/') return false
    const javaSegs = getPathSegments(mappedPath)
    const routeSegs = getPathSegments(r.path)
    if (javaSegs.length === 0 || routeSegs.length === 0) return false
    if (javaSegs[0] !== routeSegs[0]) return false
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
  const javaModule = getPathModule(mappedPath)
  if (javaModule && BUSINESS_KEYWORDS.includes(javaModule)) {
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

function findMatchingJavaEndpoint(route, javaEndpoints, mappedPaths) {
  const normRoute = normalizePath(route.path)
  // 用 mappedPath 做匹配
  let m = javaEndpoints.find((e, i) => {
    if (e.httpMethod === 'ANY') return normalizePath(mappedPaths[i]) === normRoute
    return e.httpMethod === route.httpMethod && normalizePath(mappedPaths[i]) === normRoute
  })
  if (m) return { match: m, type: 'exact' }

  m = javaEndpoints.find((e, i) => {
    const normJava = normalizePath(mappedPaths[i])
    if (normJava === '/' || normRoute === '/') return false
    return normRoute.startsWith(normJava + '/') ||
           normJava.startsWith(normRoute + '/')
  })
  if (m) return { match: m, type: 'prefix' }

  const routeModule = getPathModule(route.path)
  if (routeModule && BUSINESS_KEYWORDS.includes(routeModule)) {
    m = javaEndpoints.find((e, i) => getPathModule(mappedPaths[i]) === routeModule)
    if (m) return { match: m, type: 'module' }
  }
  return null
}

// ─── 主流程 ─────────────────────────────────────────────────────────
function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportsDir = path.resolve('reports')
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

  console.log('=== 阶段 2 v2:API 端点 content-level 比对(带路由前缀映射规则)===\n')

  // 0. 加载规则
  console.log('加载路由前缀映射规则...')
  const rules = loadRules()

  // 规则命中计数器
  const ruleHits = {
    prefix: new Map(), // rule object → count
    module: new Map(),
    skip: new Map(),
  }

  // 1. 扫描 Java 端点
  console.log('\n扫描 D 盘 Java 端点...')
  const { endpoints: javaEndpoints, uniqueControllers } = scanJavaEndpoints()
  console.log(`  Java 端点总数: ${javaEndpoints.length}`)
  console.log(`  唯一 controller 文件数(去重): ${uniqueControllers}`)

  // 2. 扫描 Fastify 路由
  console.log('\n扫描当前仓库 Fastify 路由...')
  const fastifyRoutes = scanFastifyRoutes()
  console.log(`  Fastify 路由总数: ${fastifyRoutes.length}`)

  // 3. 端点去重
  const javaUnique = new Map()
  for (const ep of javaEndpoints) {
    const key = `${ep.httpMethod}||${normalizePath(ep.path)}`
    if (!javaUnique.has(key)) javaUnique.set(key, ep)
  }
  const javaEndpointsUnique = Array.from(javaUnique.values())
  console.log(`  Java 端点去重后: ${javaEndpointsUnique.length}`)

  const fastifyUnique = new Map()
  for (const r of fastifyRoutes) {
    const key = `${r.httpMethod}||${normalizePath(r.path)}||${r.relPath}`
    if (!fastifyUnique.has(key)) fastifyUnique.set(key, r)
  }
  const fastifyRoutesUnique = Array.from(fastifyUnique.values())
  console.log(`  Fastify 路由去重后: ${fastifyRoutesUnique.length}`)

  // 4. 应用规则:对每个 Java 端点生成 mappedPath
  console.log('\n应用路由前缀映射规则...')
  const mappedPaths = [] // 与 javaEndpointsUnique 同序
  const appliedRules = [] // [{prefix, module, skipped}]
  let prefixAppliedCount = 0
  let moduleAppliedCount = 0
  let skippedCount = 0

  for (const ep of javaEndpointsUnique) {
    // Step 1: 应用 prefix 规则
    const { path: afterPrefix, appliedRule: prefixRule } = applyPrefixRules(ep.path, rules.prefixRules)
    if (prefixRule) {
      prefixAppliedCount++
      ruleHits.prefix.set(prefixRule, (ruleHits.prefix.get(prefixRule) || 0) + 1)
    }

    // Step 2: 检查是否在 skip 列表
    if (isSkipModule(afterPrefix, rules.skipModules)) {
      skippedCount++
      const skipRule = rules.skipModules.find(r => {
        const segs = afterPrefix.split('/').filter(Boolean)
        return segs.length > 0 && segs[0] === r.javaModule
      })
      if (skipRule) ruleHits.skip.set(skipRule, (ruleHits.skip.get(skipRule) || 0) + 1)
      mappedPaths.push(afterPrefix)
      appliedRules.push({ prefix: prefixRule, module: null, skipped: skipRule || true })
      continue
    }

    // Step 3: 应用 module 规则
    const { path: afterModule, appliedRule: moduleRule } = applyModuleRules(afterPrefix, rules.moduleRules)
    if (moduleRule) {
      moduleAppliedCount++
      ruleHits.module.set(moduleRule, (ruleHits.module.get(moduleRule) || 0) + 1)
    }

    mappedPaths.push(afterModule)
    appliedRules.push({ prefix: prefixRule, module: moduleRule, skipped: null })
  }

  console.log(`  prefix 规则命中: ${prefixAppliedCount} 个端点`)
  console.log(`  module 规则命中: ${moduleAppliedCount} 个端点`)
  console.log(`  skip 模块跳过: ${skippedCount} 个端点`)

  // 5. 匹配
  console.log('\n执行匹配(精确 > 前缀 > 业务模块)...')
  const auditResults = []
  const stats = {
    已迁移: 0,
    部分迁移: 0,
    缺失: 0,
    无需迁移: 0,
    已跳过: 0,
  }

  for (let i = 0; i < javaEndpointsUnique.length; i++) {
    const ep = javaEndpointsUnique[i]
    const mappedPath = mappedPaths[i]
    const applied = appliedRules[i]

    // 如果被 skip,直接计入"已跳过"分类
    if (applied.skipped) {
      auditResults.push({
        source: 'java',
        httpMethod: ep.httpMethod,
        path: ep.path,
        mappedPath,
        normalizedPath: normalizePath(ep.path),
        legacyFile: ep.relPath,
        legacyClass: ep.className,
        status: '已跳过',
        appliedRule: applied.skipped ? (applied.skipped.javaModule || 'skip') : '',
        matchedRoutes: '',
        reason: applied.skipped.reason || 'skip_module',
      })
      stats['已跳过']++
      continue
    }

    const match = matchEndpoint(ep, fastifyRoutesUnique, mappedPath)
    const appliedRuleDesc = [
      applied.prefix ? `prefix:${applied.prefix.javaPrefix}→${applied.prefix.ihuiPrefix || '(strip)'}` : '',
      applied.module ? `module:${applied.module.javaModule}→${applied.module.ihuiModule}` : '',
    ].filter(Boolean).join('; ')

    auditResults.push({
      source: 'java',
      httpMethod: ep.httpMethod,
      path: ep.path,
      mappedPath,
      normalizedPath: normalizePath(mappedPath),
      legacyFile: ep.relPath,
      legacyClass: ep.className,
      status: match.status,
      appliedRule: appliedRuleDesc,
      matchedRoutes: match.matchedRoutes.map(r =>
        `${r.httpMethod} ${r.path} (${r.relPath}:${r.line})`
      ).join(' | '),
      reason: match.reason,
    })
    stats[match.status] = (stats[match.status] || 0) + 1
  }

  // 5b. Fastify 中无对应 Java 的端点 → 无需迁移
  for (const r of fastifyRoutesUnique) {
    const matched = findMatchingJavaEndpoint(r, javaEndpointsUnique, mappedPaths)
    if (!matched) {
      auditResults.push({
        source: 'fastify',
        httpMethod: r.httpMethod,
        path: r.path,
        mappedPath: r.path,
        normalizedPath: normalizePath(r.path),
        legacyFile: '',
        legacyClass: '',
        status: '无需迁移',
        appliedRule: '',
        matchedRoutes: `${r.httpMethod} ${r.path} (${r.relPath}:${r.line})`,
        reason: '当前仓库新增端点(无 Java 对应)',
      })
      stats['无需迁移']++
    }
  }

  // 6. 统计输出
  console.log('\n=== 匹配结果统计 ===')
  console.log(`已迁移: ${stats['已迁移']}`)
  console.log(`部分迁移: ${stats['部分迁移']}`)
  console.log(`缺失: ${stats['缺失']}`)
  console.log(`已跳过(skip 模块): ${stats['已跳过']}`)
  console.log(`无需迁移(新增): ${stats['无需迁移']}`)
  console.log(`总计: ${auditResults.length}`)

  // 7. 缺失端点分类分析(区分真实缺失 vs 语言迁移预期)
  const missingResults = auditResults.filter(r => r.status === '缺失')
  const missingAnalysis = analyzeMissingEndpoints(missingResults, fastifyRoutesUnique)
  console.log('\n=== 缺失端点分析 ===')
  console.log(`缺失总数: ${missingResults.length}`)
  console.log(`  语言迁移预期(有同模块的 Fastify 路由): ${missingAnalysis.languageMigration}`)
  console.log(`  真实缺失(无任何同模块路由): ${missingAnalysis.realMissing}`)
  console.log(`  无路径端点: ${missingAnalysis.noPath}`)

  // 8. 输出 CSV
  const csvPath = path.join(reportsDir, `migration-audit-api-routes-v2-${timestamp}.csv`)
  const csvLines = [
    'source,httpMethod,path,mappedPath,normalizedPath,legacyFile,legacyClass,status,appliedRule,matchedRoutes,reason',
  ]
  for (const r of auditResults) {
    const escape = s => `"${String(s).replace(/"/g, '""')}"`
    csvLines.push([
      r.source, r.httpMethod, r.path, r.mappedPath, r.normalizedPath,
      r.legacyFile, r.legacyClass, r.status, r.appliedRule, r.matchedRoutes, r.reason,
    ].map(escape).join(','))
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')
  console.log(`\n审计 CSV: ${csvPath}`)

  // 9. 输出 summary JSON
  const summaryPath = path.join(reportsDir, `migration-audit-api-routes-v2-summary.json`)
  const totalJava = javaEndpointsUnique.length
  const totalFastify = fastifyRoutesUnique.length

  const v2RealMissing = missingAnalysis.realMissing
  const compressionRate = V1_REAL_MISSING > 0
    ? ((V1_REAL_MISSING - v2RealMissing) / V1_REAL_MISSING * 100).toFixed(1)
    : '0.0'

  // 规则命中明细(用于回写 rules.json + summary)
  const prefixRuleHits = rules.prefixRules.map(r => ({
    javaPrefix: r.javaPrefix,
    ihuiPrefix: r.ihuiPrefix,
    strategy: r.strategy,
    hits: ruleHits.prefix.get(r) || 0,
    reason: r.reason,
  }))
  const moduleRuleHits = rules.moduleRules.map(r => ({
    javaModule: r.javaModule,
    ihuiModule: r.ihuiModule,
    hits: ruleHits.module.get(r) || 0,
    reason: r.reason,
  }))
  const skipRuleHits = rules.skipModules.map(r => ({
    javaModule: r.javaModule,
    hits: ruleHits.skip.get(r) || 0,
    reason: r.reason,
  }))

  const summary = {
    timestamp,
    phase: '阶段 2 v2: API 端点 content-level 比对(带路由前缀映射规则)',
    legacyRoots: LEGACY_ROOTS,
    newRoutesRoot: NEW_ROUTES_ROOT,
    rulesPath: RULES_PATH,
    javaEndpointsTotal: javaEndpoints.length,
    javaEndpointsUnique: totalJava,
    javaUniqueControllers: uniqueControllers,
    fastifyRoutesTotal: fastifyRoutes.length,
    fastifyRoutesUnique: totalFastify,
    ruleApplicationStats: {
      prefixRuleHits: prefixAppliedCount,
      moduleRuleHits: moduleAppliedCount,
      skipModuleHits: skippedCount,
    },
    stats: {
      已迁移: stats['已迁移'],
      部分迁移: stats['部分迁移'],
      缺失: stats['缺失'],
      已跳过: stats['已跳过'],
      无需迁移: stats['无需迁移'],
    },
    missingAnalysis: {
      totalMissing: missingResults.length,
      languageMigrationExpected: missingAnalysis.languageMigration,
      realMissing: missingAnalysis.realMissing,
      noPath: missingAnalysis.noPath,
      realMissingExamples: missingAnalysis.realMissingExamples,
    },
    v1VsV2Comparison: {
      v1TotalMissing: V1_TOTAL_MISSING,
      v1RealMissing: V1_REAL_MISSING,
      v2TotalMissing: missingResults.length,
      v2RealMissing: v2RealMissing,
      realMissingReduction: V1_REAL_MISSING - v2RealMissing,
      compressionRate: `${compressionRate}%`,
      targetMet: v2RealMissing < 200,
    },
    ruleEffectiveness: {
      prefixRules: prefixRuleHits,
      moduleRules: moduleRuleHits,
      skipModules: skipRuleHits,
    },
    nextPhaseRecommendation: v2RealMissing > 0 && v2RealMissing <= 200
      ? `v2 真实缺失 ${v2RealMissing} 个已落入 100-200 阈值,可进入阶段 3:对真实缺失端点做业务影响评估`
      : v2RealMissing > 200
        ? `v2 真实缺失 ${v2RealMissing} 个仍超 200 阈值,需补充更多 module 规则或人工评估`
        : '所有缺失端点已通过规则化匹配,可考虑阶段 3 数据库表/i18n key 比对',
  }
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`摘要 JSON: ${summaryPath}`)

  // 10. 回写规则命中数到 rules.json
  rules.prefixRules = rules.prefixRules.map(r => ({
    ...r,
    hits: ruleHits.prefix.get(r) || 0,
  }))
  rules.moduleRules = rules.moduleRules.map(r => ({
    ...r,
    hits: ruleHits.module.get(r) || 0,
  }))
  rules.skipModules = rules.skipModules.map(r => ({
    ...r,
    hits: ruleHits.skip.get(r) || 0,
  }))
  rules.lastRunAt = timestamp
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2), 'utf8')
  console.log(`规则命中已回写: ${RULES_PATH}`)

  // 11. 退出码
  if (javaEndpoints.length === 0 && fastifyRoutes.length === 0) {
    console.error('\n❌ 审计失败:无任何端点被审计')
    process.exit(1)
  }
  console.log('\n✅ 审计完成')
  console.log(`\n=== v1 vs v2 对比 ===`)
  console.log(`v1 真实缺失: ${V1_REAL_MISSING}`)
  console.log(`v2 真实缺失: ${v2RealMissing}`)
  console.log(`压缩率: ${compressionRate}%`)
  console.log(`目标 < 200: ${v2RealMissing < 200 ? '✅ 达成' : '❌ 未达成'}`)
  process.exit(0)
}

/**
 * 分析缺失端点(沿用 v1 逻辑,但使用 mappedPath)
 */
function analyzeMissingEndpoints(missingResults, fastifyRoutesUnique) {
  let languageMigration = 0
  let realMissing = 0
  let noPath = 0
  const realMissingExamples = []

  const fastifyModules = new Set()
  for (const r of fastifyRoutesUnique) {
    const m = getPathModule(r.path)
    if (m) fastifyModules.add(m)
  }

  for (const r of missingResults) {
    // v2 用 mappedPath 做 module 判断
    const checkPath = r.mappedPath || r.path
    if (!checkPath || checkPath === '') {
      noPath++
      continue
    }
    const mod = getPathModule(checkPath)
    if (!mod) {
      noPath++
      continue
    }
    if (fastifyModules.has(mod) || BUSINESS_KEYWORDS.includes(mod)) {
      languageMigration++
    } else {
      realMissing++
      if (realMissingExamples.length < 30) {
        realMissingExamples.push({
          httpMethod: r.httpMethod,
          originalPath: r.path,
          mappedPath: r.mappedPath,
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
