#!/usr/bin/env node
/**
 * 阶段 4: 前端页面/路由 content-level 比对
 *
 * 比对 D:\历史项目存档\ 下 Vue 项目路由 vs 当前 IHUI-AI 仓库 apps/web/app Next.js App Router
 * 输出 4 类对照表 CSV:已迁移 / 部分迁移 / 缺失 / 新增(Next.js 独有)
 *
 * 用法:node scripts/audit-migration-frontend-routes.mjs
 * 输出:reports/migration-audit-frontend-routes-{timestamp}.csv
 *       reports/migration-audit-frontend-routes-summary.json
 */
import fs from 'node:fs'
import path from 'node:path'

// ─── 配置 ───────────────────────────────────────────────────────────
const LEGACY_ROOTS = [
  'D:\\历史项目存档\\ihui-ai-admin-frontend',
  'D:\\历史项目存档\\edu client',
  'D:\\历史项目存档\\code',
  'D:\\历史项目存档\\zhs_app-ZZ',
  'D:\\历史项目存档\\ljd-交接文件',
]

const NEW_APP_ROOT = 'g:\\IHUI-AI\\apps\\web\\app'
const REPORTS_DIR = 'g:\\IHUI-AI\\reports'

// 业务模块关键词清单(按优先级排序,用于业务模块匹配)
const BUSINESS_KEYWORDS = [
  'user', 'member', 'admin', 'role', 'order', 'course', 'article', 'post',
  'comment', 'tag', 'category', 'ai', 'chat', 'model', 'agent', 'market',
  'file', 'upload', 'message', 'notification', 'log', 'stat', 'dashboard',
  'login', 'register', 'profile', 'setting', 'auth', 'ask', 'circle',
  'resource', 'point', 'learn', 'exam', 'live', 'news', 'topic', 'lecture',
  'agreement', 'announcement', 'feedback', 'help', 'about', 'search',
  'wallet', 'withdraw', 'withdrawal', 'recharge', 'vip', 'subscription',
  'coupon', 'fans', 'follow', 'favorite', 'token', 'developer', 'plaza',
  'distribution', 'commission', 'income', 'share', 'carousel', 'advertise',
  'workwechat', 'dingtalk', 'unauthorized', 'forbidden', 'sso', 'oauth',
  'callback', 'video', 'audio', 'image', 'aigc', 'tool', 'workspace',
  'workflow', 'team', 'organization', 'dept', 'menu', 'dict', 'notice',
  'operlog', 'logininfor', 'config', 'system', 'monitor', 'job', 'online',
  'gen', 'square', 'demand', 'review', 'task', 'note', 'paper', 'answer',
  'question', 'certificate', 'template', 'report', 'channel', 'lecturer',
  'author', 'writer', 'business', 'company', 'enterprise', 'tenant',
  'private', 'letter', 'dynamic', 'comment', 'sensitive', 'hot', 'word',
  'bi', 'dashboard', 'visit', 'tracking', 'trend', 'activity', 'theme',
  'preset', 'font', 'dark', 'mode', 'export', 'usage', 'rule', 'rule-param',
  'margin', 'identity', 'proportion', 'developer-link', 'agent-task',
  'agent-rule', 'agent-category', 'agent-examine', 'agent-withdrawal',
  'agent-image', 'agent-context', 'agent-audio', 'video-log', 'auth-role',
  'auth-dept', 'auth-user-vip', 'auth-vip-level', 'auth-tokens',
  'auth-sms-temp', 'auth-info', 'auth-accounts', 'auth-find-info',
  'auth-veri-codes', 'user-center', 'zhs-user', 'zhs-agent', 'zhs-activity',
  'zhs-identity', 'zhs-product', 'api-platform', 'api-usage', 'api-groups',
  'api-logs', 'api-debug', 'ai-models', 'ai-gc', 'ai-world', 'ai-news',
  'ai-career', 'ai-generation', 'mcp', 'variables', 'about-us',
  'agreements', 'asks', 'articles', 'tags', 'topics', 'tools', 'teams',
  'workflows', 'activities', 'announcements', 'lecturers', 'agents',
  'subscriptions', 'students', 'papers', 'notes', 'offline-records',
  'my-resources', 'my-lessons', 'my-asks', 'my-articles', 'my-circles',
  'my-comments', 'wrong-book', 'addresses', 'coupons', 'points', 'history',
  'help', 'favorites', 'upgrade', 'refunds', 'invitations', 'benefits',
  'realname', 'orders', 'notifications', 'security', 'security-log',
  'profile', 'usage-rules', 'profile-setting', 'api-test', 'support',
  'bi-dashboard', 'token-value', 'ai-world-create', 'ai-world-edit',
  'ai-world-favorites', 'ai-world-history', 'ai-world-share', 'pdf-tools',
  'watermark', 'split', 'merge', 'convert', 'pdf', 'unauthorized',
  'forgot-password', 'register', 'login', 'callback', 'google-callback',
  'apple-callback', 'visit-tracking', 'visit-trend', 'user-stat',
  'video-logs', 'wallet-recharge', 'wallet-withdraw', 'wallet-records',
  'recharge-success', 'recharge-fail', 'withdraw-records',
]

// ─── 工具函数 ───────────────────────────────────────────────────────

/**
 * 递归遍历目录,返回所有匹配的文件路径。
 * @param {string} dir 起始目录
 * @param {(file: string) => boolean} predicate 文件路径过滤函数
 * @param {Set<string>} [visited] 已访问目录(防止符号链接死循环)
 * @returns {string[]}
 */
function walkFiles(dir, predicate, visited = new Set()) {
  const results = []
  if (!fs.existsSync(dir)) return results
  const real = fs.realpathSync(dir)
  if (visited.has(real)) return results
  visited.add(real)

  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    // 跳过 node_modules / dist / .git / .next 等
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.next', 'build', '.cache'].includes(entry.name)) continue
      results.push(...walkFiles(full, predicate, visited))
    } else if (entry.isFile() && predicate(full)) {
      results.push(full)
    }
  }
  return results
}

/**
 * 路径归一化:
 *   - 去除 /admin 前缀
 *   - 参数风格统一 :id ([id] → :id, {id} → :id, :userId(\\d+) → :id)
 *   - 末尾斜杠统一(无末尾斜杠,根路径 "/" 除外)
 *   - 转小写比较
 */
function normalizePath(p) {
  if (!p) return ''
  let s = String(p).trim()
  // Vue Router 动态段: :userId(\\d+) → :userId
  s = s.replace(/:([A-Za-z_]\w*)\([^)]*\)/g, ':$1')
  // Next.js 动态段: [id] → :id, [...slug] → :slug
  s = s.replace(/\[\.\.\.([A-Za-z_]\w*)\]/g, ':$1*')
  s = s.replace(/\[([A-Za-z_]\w*)\]/g, ':$1')
  // 占位符 {id} → :id
  s = s.replace(/\{([A-Za-z_]\w*)\}/g, ':$1')
  // 去除 /admin 前缀(只去顶层)
  s = s.replace(/^\/admin\//, '/')
  s = s.replace(/^\/admin$/, '/')
  // 末尾斜杠(根除外)
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  // 双斜杠压缩
  s = s.replace(/\/{2,}/g, '/')
  return s
}

/**
 * 从路径中提取业务关键词集合。
 * 例:/admin/users → {admin, users};/learn/topic/:id → {learn, topic}
 */
function extractKeywords(p) {
  const normalized = normalizePath(p)
  // 去掉 :param 段
  const cleaned = normalized.replace(/:[A-Za-z_]\w*\*?/g, '')
  const segs = cleaned.split('/').filter(Boolean)
  const set = new Set()
  for (const seg of segs) {
    // 拆分连字符 / 下划线
    for (const part of seg.split(/[-_]/)) {
      if (part) set.add(part.toLowerCase())
    }
  }
  return set
}

/**
 * 提取路径主模块名(第一段非 admin 段)。
 */
function getModule(p) {
  const segs = normalizePath(p).split('/').filter(Boolean)
  // 跳过 admin / api / new 前缀
  for (const s of segs) {
    if (!['admin', 'api', 'new'].includes(s)) return s
  }
  return segs[0] || ''
}

// ─── Vue 路由扫描 ────────────────────────────────────────────────────

/**
 * 递归遍历路由配置对象数组,提取所有叶子路由。
 * 兼容 path 字符串与 component 字符串。
 * @returns {Array<{path: string, name: string, component: string, fullPath: string}>}
 */
function walkVueRoutes(routes, parentPath = '', parentName = '', results = []) {
  if (!Array.isArray(routes)) return results
  for (const r of routes) {
    if (!r || typeof r !== 'object') continue
    const rawPath = typeof r.path === 'string' ? r.path : ''
    const name = r.name || (r.meta && r.meta.name) || parentName || ''
    const component = typeof r.component === 'string' ? r.component : ''

    // 拼接父子路径
    let combined
    if (!rawPath) {
      combined = parentPath
    } else if (rawPath.startsWith('/')) {
      combined = rawPath
    } else {
      combined = parentPath ? `${parentPath.replace(/\/$/, '')}/${rawPath}` : `/${rawPath}`
    }
    // 规范化双斜杠
    combined = combined.replace(/\/{2,}/g, '/')
    if (combined && !combined.startsWith('/')) combined = '/' + combined

    const hasChildren = Array.isArray(r.children) && r.children.length > 0
    const hasComponent = !!component || typeof r.component === 'function'

    // 如果是叶子节点(无 children 或 children 为空),且 path 不为空,记录
    if (!hasChildren && combined) {
      // 跳过 catch-all: /:pathMatch(.*)*
      if (combined.includes(':pathMatch(') || combined.includes(':pathMatch')) continue
      // 跳过纯 redirect 节点(无 component)
      if (r.redirect && !hasComponent) continue
      results.push({
        path: combined,
        name,
        component,
        fullPath: combined,
      })
    }

    // 递归处理子路由
    if (hasChildren) {
      walkVueRoutes(r.children, combined, name, results)
    }
  }
  return results
}

/**
 * 从 Vue router 文件源码解析路由配置。
 * 策略:
 *   - 提取 constantRoutes / dynamicRoutes / asyncRoutes / routes 数组
 *   - 用简化 JS 解析器逐对象提取 path / name / component / children
 *
 * 该函数采用正则 + 栈匹配的方式,避免引入完整 JS 解析器依赖。
 */
function parseVueRouterFile(file) {
  let src
  try {
    src = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }

  // 去除单行注释 // ... 与 /* ... */
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')

  const results = []

  // 找出所有 export const XXX = [ ... ] 和 const routes = [ ... ] 等
  // 简化处理:直接在文件中找 path: '...' 字段并构建树。
  // 由于路由文件结构相对固定,我们用 token 流法提取每个 route 对象。

  // 找到所有顶层 export / const 声明的数组
  // 这里用一个简化的对象扫描器:遇到 `{` 开始一个对象,匹配 `path:` / `name:` / `component:` / `children:` 字段。
  const tokens = tokenize(stripped)
  const routeObjects = extractRouteObjects(tokens)
  for (const obj of routeObjects) {
    walkVueRoutes([obj], '', '', results)
  }

  return results
}

/**
 * 极简 tokenizer:把源码切成 token,识别字符串、对象边界、字段名。
 * 仅供路由解析使用,非通用 JS 解析器。
 */
function tokenize(src) {
  const tokens = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '"' || c === "'" || c === '`') {
      // 字符串(忽略模板字符串内 ${...})
      const quote = c
      let j = i + 1
      let buf = ''
      while (j < n) {
        const cj = src[j]
        if (cj === '\\') {
          buf += src[j + 1] || ''
          j += 2
          continue
        }
        if (cj === quote) {
          j++
          break
        }
        buf += cj
        j++
      }
      tokens.push({ type: 'string', value: buf })
      i = j
      continue
    }
    if (c === '{') {
      tokens.push({ type: 'lbrace' })
      i++
      continue
    }
    if (c === '}') {
      tokens.push({ type: 'rbrace' })
      i++
      continue
    }
    if (c === '[') {
      tokens.push({ type: 'lbracket' })
      i++
      continue
    }
    if (c === ']') {
      tokens.push({ type: 'rbracket' })
      i++
      continue
    }
    if (c === ',') {
      tokens.push({ type: 'comma' })
      i++
      continue
    }
    if (c === ':') {
      tokens.push({ type: 'colon' })
      i++
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++
      tokens.push({ type: 'ident', value: src.slice(i, j) })
      i = j
      continue
    }
    if (/\s/.test(c)) {
      i++
      continue
    }
    // 其他字符(运算符等),合并成单个 token
    let j = i + 1
    while (j < n && !/[\s{}[\],:"'`A-Za-z_$]/.test(src[j])) j++
    tokens.push({ type: 'other', value: src.slice(i, j) })
    i = j
  }
  return tokens
}

/**
 * 从 token 流中提取所有路由对象(含 path 字段的对象)。
 * 返回树形结构:每个对象有 path/name/component/children 字段。
 */
function extractRouteObjects(tokens) {
  const objects = []
  let i = 0
  const n = tokens.length

  function parseObject() {
    // 期望当前 token 是 lbrace
    if (tokens[i] && tokens[i].type === 'lbrace') {
      i++
    } else {
      return null
    }
    const obj = { children: [] }
    let hasPath = false
    while (i < n && tokens[i].type !== 'rbrace') {
      if (tokens[i].type === 'ident' && tokens[i + 1] && tokens[i + 1].type === 'colon') {
        const key = tokens[i].value
        i += 2
        if (key === 'path') {
          if (tokens[i] && tokens[i].type === 'string') {
            obj.path = tokens[i].value
            hasPath = true
            i++
          } else {
            // 非字符串值,跳到下一个 comma / rbrace
            skipValue()
          }
        } else if (key === 'name') {
          if (tokens[i] && tokens[i].type === 'string') {
            obj.name = tokens[i].value
            i++
          } else if (tokens[i] && tokens[i].type === 'ident') {
            obj.name = tokens[i].value
            i++
          } else {
            skipValue()
          }
        } else if (key === 'component') {
          if (tokens[i] && tokens[i].type === 'string') {
            obj.component = tokens[i].value
            i++
          } else if (tokens[i] && tokens[i].type === 'ident') {
            obj.component = tokens[i].value
            i++
          } else {
            // () => import(...) 或函数表达式
            obj.component = '<inline>'
            skipValue()
          }
        } else if (key === 'children') {
          if (tokens[i] && tokens[i].type === 'lbracket') {
            i++
            const childObjs = []
            while (i < n && tokens[i].type !== 'rbracket') {
              if (tokens[i].type === 'lbrace') {
                const child = parseObject()
                if (child) childObjs.push(child)
              } else {
                i++
              }
            }
            if (tokens[i] && tokens[i].type === 'rbracket') i++
            obj.children = childObjs
          } else {
            skipValue()
          }
        } else if (key === 'redirect') {
          if (tokens[i] && tokens[i].type === 'string') {
            obj.redirect = tokens[i].value
            i++
          } else if (tokens[i] && tokens[i].type === 'ident') {
            obj.redirect = tokens[i].value
            i++
          } else if (tokens[i] && tokens[i].type === 'lbrace') {
            // redirect: { path: '...' }
            const r = parseObject()
            obj.redirect = r && r.path ? r.path : '<obj>'
          } else {
            skipValue()
          }
        } else {
          skipValue()
        }
        // 跳过 comma
        if (tokens[i] && tokens[i].type === 'comma') i++
      } else {
        i++
      }
    }
    if (tokens[i] && tokens[i].type === 'rbrace') i++
    return hasPath ? obj : null
  }

  function skipValue() {
    // 跳过单个值:字符串 / ident / 数字 / 对象 / 数组 / 函数
    if (!tokens[i]) return
    const t = tokens[i]
    if (t.type === 'string' || t.type === 'ident' || t.type === 'other') {
      i++
      return
    }
    if (t.type === 'lbrace') {
      let depth = 1
      i++
      while (i < n && depth > 0) {
        if (tokens[i].type === 'lbrace') depth++
        else if (tokens[i].type === 'rbrace') depth--
        i++
      }
      return
    }
    if (t.type === 'lbracket') {
      let depth = 1
      i++
      while (i < n && depth > 0) {
        if (tokens[i].type === 'lbracket') depth++
        else if (tokens[i].type === 'rbracket') depth--
        i++
      }
      return
    }
    // 其他(token 不可识别),前进一步防止死循环
    i++
  }

  while (i < n) {
    if (tokens[i].type === 'lbrace') {
      const start = i
      const obj = parseObject()
      if (obj && obj.path !== undefined) {
        objects.push(obj)
      } else {
        // 不是路由对象,继续(i 已经前进)
      }
    } else {
      i++
    }
  }
  return objects
}

/**
 * 扫描所有 Vue 项目路由文件,返回路由列表。
 */
function scanVueRoutes() {
  const allRoutes = []
  const seenKeys = new Set()

  // 1. 扫描 router 配置文件
  //    注:不能只 walk `<root>/src`,因为某些项目嵌套在 `<root>/<sub>/<sub>/src/`
  //    所以 walk 整个 root,predicate 用正则匹配 src/router 路径。
  for (const root of LEGACY_ROOTS) {
    if (!fs.existsSync(root)) continue
    const routerFiles = walkFiles(
      root,
      (f) => /[/\\]src[/\\]router[/\\][^/\\]+\.(js|ts)$/.test(f) && !f.endsWith('guard.js') && !f.endsWith('goto.js'),
    )
    for (const file of routerFiles) {
      const routes = parseVueRouterFile(file)
      for (const r of routes) {
        const key = `${file}::${r.path}`
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        allRoutes.push({
          ...r,
          sourceFile: file,
          sourceProject: detectProjectName(file, root),
          type: 'vue-router',
        })
      }
    }
  }

  // 2. 扫描 pages.json (uni-app)
  for (const root of LEGACY_ROOTS) {
    if (!fs.existsSync(root)) continue
    const pagesJsonFiles = walkFiles(root, (f) => f.endsWith('pages.json'))
    for (const file of pagesJsonFiles) {
      let json
      try {
        const content = fs.readFileSync(file, 'utf8')
        // pages.json 可能含注释,简易去除
        const clean = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
        json = JSON.parse(clean)
      } catch {
        continue
      }
      const collectFromPages = (pages, pkgRoot = '') => {
        if (!Array.isArray(pages)) return
        for (const p of pages) {
          if (!p || typeof p.path !== 'string') continue
          let fullPath = p.path
          if (pkgRoot) fullPath = `${pkgRoot}/${p.path}`
          // uni-app 路径: pages/login-app/login → /login-app/login
          let asPath = '/' + fullPath.replace(/^\/+/, '')
          allRoutes.push({
            path: asPath,
            name: '',
            component: fullPath,
            fullPath: asPath,
            sourceFile: file,
            sourceProject: detectProjectName(file, root),
            type: 'uniapp-pages-json',
          })
        }
      }
      collectFromPages(json.pages)
      if (Array.isArray(json.subPackages)) {
        for (const sub of json.subPackages) {
          collectFromPages(sub.pages, sub.root)
        }
      }
    }
  }

  return allRoutes
}

function detectProjectName(file, root) {
  let rel = file
  if (file.startsWith(root)) {
    rel = file.slice(root.length).replace(/^[\\\/]/, '')
  }
  // 取前 2 段作为项目标识
  const segs = rel.split(/[\\\/]/)
  return segs.slice(0, 2).join('/')
}

// ─── Next.js 路由扫描 ────────────────────────────────────────────────

/**
 * 扫描 Next.js App Router 文件系统路由。
 * 规则:
 *   - app/page.tsx → /
 *   - app/users/page.tsx → /users
 *   - app/users/[id]/page.tsx → /users/:id
 *   - app/(dashboard)/users/page.tsx → /users(路由组不进入路径)
 *   - app/(dashboard)/page.tsx → /(根)
 *   - app/users/[...slug]/page.tsx → /users/:slug*
 */
function scanNextRoutes() {
  const routes = []
  if (!fs.existsSync(NEW_APP_ROOT)) return routes

  const pageFiles = walkFiles(
    NEW_APP_ROOT,
    (f) => /[/\\]page\.(tsx|ts|jsx|js)$/.test(f),
  )

  for (const file of pageFiles) {
    let rel = file.slice(NEW_APP_ROOT.length).replace(/^[\\\/]/, '')
    // 去掉末尾 page.tsx
    rel = rel.replace(/[/\\]page\.(tsx|ts|jsx|js)$/, '')
    // 处理 Windows 反斜杠
    rel = rel.replace(/\\/g, '/')

    // 拆段,过滤路由组 (xxx)
    const segs = rel ? rel.split('/').filter(Boolean) : []
    const pathSegs = []
    for (const seg of segs) {
      if (/^\([^)]+\)$/.test(seg)) continue // 路由组
      if (seg.startsWith('@')) continue // parallel route
      pathSegs.push(seg)
    }

    let asPath
    if (pathSegs.length === 0) {
      asPath = '/'
    } else {
      asPath = '/' + pathSegs.join('/')
    }

    routes.push({
      path: asPath,
      normalizedPath: normalizePath(asPath),
      file,
      type: 'next-app-router',
    })
  }

  return routes
}

// ─── 匹配引擎 ───────────────────────────────────────────────────────

/**
 * 匹配策略,返回 matchType:
 *   - 'exact' 精确路径匹配
 *   - 'prefix' 路径前缀匹配
 *   - 'keyword' 业务模块关键词匹配
 *   - null 无匹配
 */
function matchRoute(vueRoute, nextRoute) {
  const vp = normalizePath(vueRoute.path)
  const np = nextRoute.normalizedPath
  if (!vp || !np) return null

  // 1. 精确匹配
  if (vp === np) return 'exact'

  // 2. 前缀匹配(其中一方是另一方的祖先)
  //   /learn → /learn/topic 视为前缀匹配
  //   /member → /member/list 视为前缀匹配
  const vSegs = vp.split('/').filter(Boolean)
  const nSegs = np.split('/').filter(Boolean)
  const minLen = Math.min(vSegs.length, nSegs.length)
  // 检查前 minLen 段是否全部相等(参数段视为相等)
  let allEqual = true
  for (let i = 0; i < minLen; i++) {
    if (vSegs[i] === nSegs[i]) continue
    if (vSegs[i].startsWith(':') && nSegs[i].startsWith(':')) continue
    allEqual = false
    break
  }
  if (allEqual && minLen > 0) {
    // 必须至少共享一段
    return 'prefix'
  }

  // 3. 关键词匹配:主模块相同且至少有一个非参数段共享
  const vKw = extractKeywords(vueRoute.path)
  const nKw = extractKeywords(nextRoute.path)
  let sharedNonParam = 0
  for (const k of vKw) {
    if (nKw.has(k) && !k.startsWith(':')) sharedNonParam++
  }
  if (sharedNonParam >= 1 && getModule(vueRoute.path) === getModule(nextRoute.path)) {
    return 'keyword'
  }
  // 主模块相同也视为关键词匹配
  if (getModule(vueRoute.path) && getModule(vueRoute.path) === getModule(nextRoute.path)) {
    return 'keyword'
  }

  return null
}

// ─── CSV 输出 ───────────────────────────────────────────────────────

function csvEscape(s) {
  if (s == null) return ''
  const str = String(s)
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
}

// ─── 主流程 ─────────────────────────────────────────────────────────

function main() {
  console.log('=== 阶段 4: 前端页面/路由 content-level 比对 ===\n')

  // Step 1: 扫描 Vue 路由
  console.log('[1/4] 扫描 D 盘 Vue 路由配置...')
  const vueRoutes = scanVueRoutes()
  console.log(`  找到 ${vueRoutes.length} 条 Vue 路由`)

  // Step 2: 扫描 Next.js 路由
  console.log('[2/4] 扫描当前仓库 Next.js App Router...')
  const nextRoutes = scanNextRoutes()
  console.log(`  找到 ${nextRoutes.length} 条 Next.js 路由`)

  // Step 3: 比对
  console.log('[3/4] 执行 content-level 比对...')
  const migrated = [] // 已迁移(exact)
  const partial = [] // 部分迁移(prefix / keyword)
  const missing = [] // Vue 有,Next.js 无
  const newOnly = [] // Next.js 有,Vue 无

  // Vue → Next.js 匹配
  const matchedNextIdx = new Set()
  for (const v of vueRoutes) {
    let bestMatch = null
    let bestType = null
    for (let i = 0; i < nextRoutes.length; i++) {
      if (matchedNextIdx.has(i)) continue
      const m = matchRoute(v, nextRoutes[i])
      if (!m) continue
      if (m === 'exact') {
        bestMatch = i
        bestType = 'exact'
        break
      }
      if (m === 'prefix' && bestType !== 'exact') {
        bestMatch = i
        bestType = 'prefix'
      } else if (m === 'keyword' && !bestType) {
        bestMatch = i
        bestType = 'keyword'
      }
    }

    if (bestMatch === null) {
      missing.push({
        vue_path: v.path,
        vue_normalized: normalizePath(v.path),
        vue_name: v.name || '',
        vue_component: v.component || '',
        vue_source: v.sourceFile || '',
        vue_project: v.sourceProject || '',
        vue_type: v.type,
        match_type: 'none',
        next_path: '',
        next_file: '',
        analysis: analyzeMissing(v),
      })
    } else {
      matchedNextIdx.add(bestMatch)
      const next = nextRoutes[bestMatch]
      if (bestType === 'exact') {
        migrated.push({
          vue_path: v.path,
          vue_normalized: normalizePath(v.path),
          vue_name: v.name || '',
          vue_component: v.component || '',
          vue_source: v.sourceFile || '',
          vue_project: v.sourceProject || '',
          vue_type: v.type,
          match_type: bestType,
          next_path: next.path,
          next_normalized: next.normalizedPath,
          next_file: next.file,
        })
      } else {
        partial.push({
          vue_path: v.path,
          vue_normalized: normalizePath(v.path),
          vue_name: v.name || '',
          vue_component: v.component || '',
          vue_source: v.sourceFile || '',
          vue_project: v.sourceProject || '',
          vue_type: v.type,
          match_type: bestType,
          next_path: next.path,
          next_normalized: next.normalizedPath,
          next_file: next.file,
        })
      }
    }
  }

  // Next.js 独有
  for (let i = 0; i < nextRoutes.length; i++) {
    if (matchedNextIdx.has(i)) continue
    const n = nextRoutes[i]
    newOnly.push({
      next_path: n.path,
      next_normalized: n.normalizedPath,
      next_file: n.file,
      analysis: analyzeNewOnly(n, vueRoutes),
    })
  }

  // Step 4: 输出
  console.log('[4/4] 输出 CSV 与 summary.json...')
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const csvPath = path.join(REPORTS_DIR, `migration-audit-frontend-routes-${ts}.csv`)
  const summaryPath = path.join(REPORTS_DIR, 'migration-audit-frontend-routes-summary.json')

  // 4 类合并 CSV(带 category 列),方便统一查阅
  const headers = [
    'category', 'vue_path', 'vue_normalized', 'vue_name', 'vue_component',
    'vue_source', 'vue_project', 'vue_type', 'match_type',
    'next_path', 'next_normalized', 'next_file', 'analysis',
  ]
  const rows = []
  for (const r of migrated) {
    rows.push({ category: '已迁移', ...r, analysis: '' })
  }
  for (const r of partial) {
    rows.push({ category: '部分迁移', ...r, analysis: '' })
  }
  for (const r of missing) {
    rows.push({
      category: '缺失',
      vue_path: r.vue_path,
      vue_normalized: r.vue_normalized,
      vue_name: r.vue_name,
      vue_component: r.vue_component,
      vue_source: r.vue_source,
      vue_project: r.vue_project,
      vue_type: r.vue_type,
      match_type: r.match_type,
      next_path: '',
      next_normalized: '',
      next_file: '',
      analysis: r.analysis,
    })
  }
  for (const r of newOnly) {
    rows.push({
      category: 'Next.js独有',
      vue_path: '',
      vue_normalized: '',
      vue_name: '',
      vue_component: '',
      vue_source: '',
      vue_project: '',
      vue_type: '',
      match_type: '',
      next_path: r.next_path,
      next_normalized: r.next_normalized,
      next_file: r.next_file,
      analysis: r.analysis,
    })
  }
  writeCsv(csvPath, headers, rows)

  // 关键页面检查
  const keyPages = ['login', 'dashboard', 'index', 'user', 'member', 'admin', 'role', 'order', 'article', 'course', 'ai']
  const keyPageStatus = []
  for (const key of keyPages) {
    const hasVue = vueRoutes.some((r) => normalizePath(r.path).includes(`/${key}`) || normalizePath(r.path) === `/${key}`)
    const hasNext = nextRoutes.some((r) => r.normalizedPath.includes(`/${key}`) || r.normalizedPath === `/${key}`)
    keyPageStatus.push({
      keyword: key,
      hasVueRoute: hasVue,
      hasNextRoute: hasNext,
      status: hasVue && hasNext ? 'both' : hasVue ? 'vue_only' : hasNext ? 'next_only' : 'neither',
    })
  }

  // 缺失分析
  const missingLanguageMigration = missing.filter((r) =>
    r.analysis && r.analysis.includes('语言迁移')
  ).length
  const missingReal = missing.length - missingLanguageMigration

  const summary = {
    timestamp: ts,
    phase: '阶段 4: 前端页面/路由 content-level 比对',
    legacyRoots: LEGACY_ROOTS,
    newAppRoot: NEW_APP_ROOT,
    vueRoutesTotal: vueRoutes.length,
    nextRoutesTotal: nextRoutes.length,
    stats: {
      已迁移: migrated.length,
      部分迁移: partial.length,
      缺失: missing.length,
      'Next.js独有': newOnly.length,
    },
    percentages: {
      已迁移: vueRoutes.length > 0 ? `${((migrated.length / vueRoutes.length) * 100).toFixed(1)}%` : '0%',
      部分迁移: vueRoutes.length > 0 ? `${((partial.length / vueRoutes.length) * 100).toFixed(1)}%` : '0%',
      缺失: vueRoutes.length > 0 ? `${((missing.length / vueRoutes.length) * 100).toFixed(1)}%(相对 Vue 路由)` : '0%',
      'Next.js独有': nextRoutes.length > 0 ? `${((newOnly.length / nextRoutes.length) * 100).toFixed(1)}%(相对 Next.js 路由)` : '0%',
    },
    missingAnalysis: {
      totalMissing: missing.length,
      languageMigrationExpected: missingLanguageMigration,
      realMissing: missingReal,
      realMissingExamples: missing
        .filter((r) => !r.analysis.includes('语言迁移'))
        .slice(0, 10)
        .map((r) => ({
          path: r.vue_path,
          module: getModule(r.vue_path),
          name: r.vue_name,
          component: r.vue_component,
          sourceProject: r.vue_project,
          sourceFile: r.vue_source,
        })),
    },
    keyPagesCheck: keyPageStatus,
    nextPhaseRecommendation: missingReal > 0
      ? '需要阶段 5:对真实缺失前端页面做业务影响评估(是否需要补齐页面/组件)'
      : '所有 Vue 路由均已迁移或属于语言迁移预期差异',
    csvFile: csvPath,
  }

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')

  console.log(`\n=== 比对完成 ===`)
  console.log(`Vue 路由总数: ${vueRoutes.length}`)
  console.log(`Next.js 路由总数: ${nextRoutes.length}`)
  console.log(`已迁移: ${migrated.length}`)
  console.log(`部分迁移: ${partial.length}`)
  console.log(`缺失: ${missing.length}(语言迁移预期 ${missingLanguageMigration}, 真实缺失 ${missingReal})`)
  console.log(`Next.js 独有: ${newOnly.length}`)
  console.log(`\nCSV: ${csvPath}`)
  console.log(`Summary: ${summaryPath}`)

  // 关键页面状态
  console.log(`\n关键页面检查:`)
  for (const k of keyPageStatus) {
    console.log(`  ${k.keyword}: vue=${k.hasVueRoute} next=${k.hasNextRoute} → ${k.status}`)
  }
}

/**
 * 缺失路由分析:语言迁移 vs 真实缺失
 * 语言迁移预期:Vue 项目独有的页面,如 account/security(work-we-chat, ding-talk, redirect 等)
 * 真实缺失:Vue 业务页面在 Next.js 中找不到对应
 */
function analyzeMissing(vueRoute) {
  const p = normalizePath(vueRoute.path)
  const module = getModule(p)

  // uni-app 移动端独占(预期不会迁移到 web)
  if (vueRoute.type === 'uniapp-pages-json') {
    // 检查是否在 web 上有等价(如登录/注册/设置)
    if (['login', 'register', 'settings', 'vip', 'agreement'].some((k) => p.includes(k))) {
      return '语言迁移(uni-app→web,部分功能在 web 已有等价路由)'
    }
    return '语言迁移(uni-app 移动端独占页面,不在 web 迁移范围)'
  }

  // Vue Router 中的 work-we-chat / ding-talk / unauthorized / 404 / 401 等错误页/SSO 回调
  if (['/work-we-chat', '/ding-talk', '/unauthorized', '/404', '/401', '/redirect'].some((k) => p === k || p.startsWith(k + '/'))) {
    return '语言迁移(SSO/错误页/重定向,Next.js 中通过其他机制实现)'
  }

  // account 模块(账号中心)在 Next.js 通常合并到 user-center / settings
  if (module === 'account') {
    return '语言迁移(账号中心已合并到 user-center / settings)'
  }

  // 真实缺失
  return '真实缺失(Vue 业务页面在 Next.js 中未找到对应)'
}

/**
 * Next.js 独有路由分析
 */
function analyzeNewOnly(nextRoute, vueRoutes) {
  const p = nextRoute.normalizedPath
  const module = getModule(p)

  // 检查是否在 Vue 中有类似模块
  const hasVueModule = vueRoutes.some((r) => getModule(r.path) === module)
  if (hasVueModule) {
    return 'Next.js 新增(同模块下的新页面)'
  }

  // 一些 Next.js 特有的模块
  if (['sso', 'forbidden', 'api-test', 'bi-dashboard', 'mcp-projects', 'ai-career', 'ai-news', 'ai-world', 'token-value', 'workflows', 'teams', 'subscriptions', 'topics', 'tags'].some((k) => p.includes(k))) {
    return 'Next.js 新增(新业务模块,Vue 中无对应)'
  }

  return 'Next.js 新增页面'
}

main()
