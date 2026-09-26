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
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

/**
 * ROOT 由脚本自身位置推导(§15)。此前是 `process.cwd()` —— "扫哪棵树"由调用者站哪决定,
 * 且钩子/服务账户的 cwd 与交互终端不通(守门 70 的镜像测试 13/14 恒红、13c 的夹具失效同型)。
 * `--root <dir>` 保留为**测试通道**,且只在 `--worktree` 档有效:换根却仍按 HEAD/索引读
 * 就是双根分裂,产出自洽而基准错位的尺子 ⇒ 直接判死(参照守门 2e-dupns 的同一口径)。
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const ARG_ROOT_IDX = process.argv.indexOf('--root')
const ARG_ROOT =
  ARG_ROOT_IDX !== -1 && process.argv[ARG_ROOT_IDX + 1]
    ? resolve(process.cwd(), process.argv[ARG_ROOT_IDX + 1])
    : null
const ROOT = ARG_ROOT || resolve(HERE, '..')
const GIT_BATCH_TIMEOUT = 120000

/** 后端注册面(比对基准,保持全量收集,不随前端 staged 范围收窄 —— §12d 既有设计) */
const API_ROUTES_DIR = 'apps/api/src/routes'
const API_PLUGINS_DIR = 'apps/api/src/plugins'
const AI_SERVICE_ROUTERS_DIR = 'apps/ai-service/app/routers'
const SERVER_FILE = 'apps/api/src/server.ts'
const AI_SERVICE_MAIN_FILE = 'apps/ai-service/app/main.py'
const IGNORE_FILE_REL = '.check-api-routes-ignore.json'
/** 三端首次纳入的死调用棘轮基线(锚点 = 该文件在基线里的存量数,新增才判红) */
const BASELINE_FILE_REL = 'scripts/api-routes-baseline.json'

/**
 * 四端前端调用面(2026-09-26 由单一 apps/web 扩出)。
 * `ratchet:false` = 零容忍(web 是既有口径,不得因本次扩面被放宽);
 * `ratchet:true`  = 首次纳入的三端,存量走棘轮只报数,新增才判红(§12e:与改动无关的
 * blocking 红只会逼人 `--no-verify`,连带废掉全部守门)。
 */
const FRONTEND_ENDS = [
  { name: 'web', dir: 'apps/web', ratchet: false },
  { name: 'mobile-rn', dir: 'apps/mobile-rn', ratchet: true },
  { name: 'miniapp-taro', dir: 'apps/miniapp-taro', ratchet: true },
  { name: 'extension', dir: 'apps/extension', ratchet: true },
  {
    name: 'api-client',
    dir: 'packages/api-client',
    ratchet: true,
    // 为什么必须把共享包本身纳进来(2026-09-26 实测):§3 规定端内不得裸 fetch,路径字面量的
    // **住处**就是这里 —— 只扫四个端等于把最该对账的一面留白。实测三条从写下起就没通过的
    // 调用(/api/user/token-balance、/api/statistics/user-center、/cozeZhsApi/cache/…)
    // 全部住在这个包里,而"扩面到三端"那次改动碰不到它们。
    // 与端内不同:这里的 fetchApi 基址由**宿主注入**,`/cozeZhsApi` 是改写前缀 —— 两者都
    // 按字面路径参与对账,拼不出来的退到「未判定」计数,绝不静默算通过。
  },
]
/** 容得下各端真实扩展名(RN/extension 有 .js/.jsx 形态) */
const FRONTEND_EXTS = ['.ts', '.tsx', '.js', '.jsx']

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const EXCLUDE_DIRS = new Set([
  '.git',
  '.next',
  '.ihui-agent',
  '.turbo',
  '.worktrees',
  '.output', // apps/extension 构建产物(仅存在于磁盘,面里本就没有;磁盘档必须同样跳过)
  'build',
  'dist',
  'node_modules',
  'public',
])

/** 磁盘档枚举(等价于旧的 collectFiles,但返回仓库相对 POSIX 路径,与 git 档同形) */
function collectFilesRel(relDir, exts, result = []) {
  const abs = join(ROOT, ...relDir.split('/'))
  if (!existsSync(abs)) return result
  for (const entry of readdirSync(abs)) {
    if (EXCLUDE_DIRS.has(entry) || isExcludedDirName(entry)) continue
    const full = join(abs, entry)
    const rel = `${relDir}/${entry}`
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFilesRel(rel, exts, result)
    } else if (exts.some((e) => entry.endsWith(e))) {
      result.push(rel)
    }
  }
  return result
}

// ===== 判定面取材层(2026-09-26 收口,与 70/77/83/98/101/118 同口径) =====
// 清单与内容**同面同轮**:面在 prefetch 时一次 `cat-file --batch` 读满,
// 未预取即 read 一律抛 Undetermined —— 静默补一次派生会把"退化"掩盖成"正常"。
let FACE = 'head'
const CONTENT = new Map()
let CONTENT_READY = false
/** 内容取不到的路径(不静默:结论行必须喊出来) */
const unreadable = new Set()


/** 面内的路径清单(git 档走 ls-tree/ls-files,磁盘档走递归) */
function listFace(relDir, exts) {
  if (FACE === 'worktree') {
    return collectFilesRel(relDir, exts).filter((rel) => !isIgnoredSourceFile(rel))
  }
  let out
  if (FACE === 'staged') {
    out = gitRaw(['ls-files', '--cached', '--', relDir], ROOT, { timeout: GIT_BATCH_TIMEOUT })
  } else {
    out = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', relDir], ROOT, {
      timeout: GIT_BATCH_TIMEOUT,
    })
  }
  const paths = String(out)
    .split(/\r?\n/)
    .map((l) => l.trim().replaceAll('\\', '/'))
    .filter((p) => p && exts.some((e) => p.endsWith(e)))
    .filter((p) => !isIgnoredSourceFile(p))
  // 单文件规格(server.ts / main.py)在 ls-tree 的 pathspec 下返回的是 blob 行,故同法可用
  return paths
}

/**
 * 前端调用文件的过滤(与原 collectFiles 内的规则逐条同形):
 * `*.test.*` 是 mock 调用不计;`*.spec.*` 是真实 e2e 保留;next.config.* 是 rewrite 规则不是调用点。
 */
function isIgnoredSourceFile(rel) {
  const base = rel.split('/').pop() || rel
  // 单元测试 mock(*.test.*)里的 fetch mock 不是真实调用点;e2e 的 *.spec.* 保留(既有口径)
  if (/\.test\.(ts|tsx|js|jsx|mjs|cjs)$/.test(base)) return true
  // Next.js 配置的 rewrites 是服务器端路由规则,不是前端 API 调用
  if (base === 'next.config.ts' || base === 'next.config.js') return true
  return false
}

/** 一次读满一批:内容一律经 face-reader 的 catBatch / readWorktreeFile */
function prefetch(rels) {
  const list = [...new Set(rels)]
  if (list.length === 0) {
    CONTENT_READY = true
    return
  }
  if (FACE === 'worktree') {
    for (const p of list) {
      const t = readWorktreeFile(ROOT, p)
      if (t === null) unreadable.add(p)
      CONTENT.set(p, t)
    }
  } else {
    const specs = list.map((p) => (FACE === 'staged' ? `:${p}` : `HEAD:${p}`))
    const got = catBatch(ROOT, specs, { timeout: GIT_BATCH_TIMEOUT, maxBuffer: 1 << 29 })
    list.forEach((p, i) => {
      const t = got.get(specs[i])
      if (t === null || t === undefined) {
        unreadable.add(p)
        CONTENT.set(p, null)
      } else CONTENT.set(p, t)
    })
  }
  CONTENT_READY = true
}

function readSource(rel) {
  if (!CONTENT_READY) throw new Undetermined(`取材层未初始化就被读取(${rel}) —— 判据写错了顺序`)
  if (!CONTENT.has(rel)) throw new Undetermined(`${rel} 未经 prefetch 就取材(禁止现场补派生)`)
  return CONTENT.get(rel)
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
        // file 由调用方传入**仓库相对 POSIX 路径**(面内枚举即此形),不再 relative(ROOT, …) ——
        // 那会把相对路径按 cwd 解析,Windows 下产出与基线键不同形的路径。
        file,
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
  const serverSrc = readSource(SERVER_FILE)
  if (serverSrc !== null && serverSrc !== undefined) {
    let m
    re.lastIndex = 0
    while ((m = re.exec(serverSrc)) !== null) {
      calls.push({ prefix: m[1], isAbsolute: m[1].startsWith('/api') })
    }
  }
  // 2. 子路由文件内 scoped prefix（如 /dict/type, /dept, /role）
  for (const rel of listFace(API_ROUTES_DIR, ['.ts'])) {
    const src = readSource(rel)
    if (src === null || src === undefined) continue
    re.lastIndex = 0
    let m
    while ((m = re.exec(src)) !== null) {
      calls.push({ prefix: m[1], isAbsolute: m[1].startsWith('/api') })
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
  const files = listFace(API_ROUTES_DIR, ['.ts'])
  if (files.length === 0) return { routes: [], prefixes }
  // 已知 scoped instance 变量名: server.register(async (VAR) => {...})
  // 项目实际使用: server / s (admin-sys) / child (exam) / scope (live) / authed (member) / fastify (zhs-course 等)
  const methodRe =
    /\b(?:server|s|child|scope|authed|instance|app|fastify)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g
  // registerCrud(VAR, 'basePath', ...) 工厂: 展开为 GET/POST/PUT/:id/DELETE/:id/DELETE(batch) 共 5 条
  const crudRe = /registerCrud\(\s*\w+\s*,\s*['"`]([^'"`]+)['"`]/g
  for (const rel of files) {
    const src = readSource(rel)
    if (src === null || src === undefined) continue
    let m
    methodRe.lastIndex = 0
    while ((m = methodRe.exec(src)) !== null) {
      routes.push({
        method: m[1].toUpperCase(),
        localPath: m[2],
        file: rel,
      })
    }
    crudRe.lastIndex = 0
    while ((m = crudRe.exec(src)) !== null) {
      const basePath = m[1]
      routes.push({ method: 'GET', localPath: basePath, file: rel })
      routes.push({ method: 'POST', localPath: basePath, file: rel })
      routes.push({ method: 'PUT', localPath: `${basePath}/:id`, file: rel })
      routes.push({ method: 'DELETE', localPath: `${basePath}/:id`, file: rel })
      routes.push({ method: 'DELETE', localPath: basePath, file: rel })
    }
    // 2026-09-22 加固:展开"模板串 + for-of 厂商矩阵"注册(既有 methodRe 只能收原始文本)
    routes.push(...expandTemplatedRoutes(src, rel))
  }
  // plugins 目录中带完整 /api/ 前缀的动态注册
  // (如 token-balance-service.ts:267 注册 /api/admin/token-balance/metrics,
  //  ai-cost.ts:467 注册 /api/admin/ai/cost/budgets;相对路径无 prefix 上下文,跳过)
  for (const rel of listFace(API_PLUGINS_DIR, ['.ts'])) {
    const src = readSource(rel)
    if (src === null || src === undefined) continue
    methodRe.lastIndex = 0
    let m
    while ((m = methodRe.exec(src)) !== null) {
      if (m[2].startsWith('/api/')) {
        routes.push({
          method: m[1].toUpperCase(),
          localPath: m[2],
          file: rel,
        })
      }
    }
  }
  // FastAPI 路由(ai-service):从 apps/ai-service/app/routers/*.py 提取
  // 模式1: router = APIRouter(prefix="/api/...") → 记录 prefix
  // 模式2: @router.(get|post|...)("/path") → 记录 method + localPath
  // 完整路径 = prefix + localPath（main.py include_router 时统一挂载 /api 或 /api/v1 等）
  const routerFiles = listFace(AI_SERVICE_ROUTERS_DIR, ['.py'])
  if (routerFiles.length > 0) {
    // 1. 先从 main.py 提取 include_router(router.router, prefix="...") 映射
    const includePrefixMap = new Map() // router变量名 -> prefix
    const mainSrc = readSource(AI_SERVICE_MAIN_FILE)
    if (mainSrc !== null && mainSrc !== undefined) {
      const includeRe = /app\.include_router\(\s*(\w+)\.router\s*,\s*prefix\s*=\s*['"`]([^'"`]+)['"`]/g
      let im
      while ((im = includeRe.exec(mainSrc)) !== null) {
        includePrefixMap.set(im[1], im[2])
      }
    }
    for (const rel of routerFiles) {
      const src = readSource(rel)
      if (src === null || src === undefined) continue
      const fileName = rel.slice(AI_SERVICE_ROUTERS_DIR.length + 1).replace(/\.py$/, '')
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
      const prefixes2 = routerPrefixes.length > 0 ? routerPrefixes : ['']
      // 提取 @router.xxx("/path") 注册
      const fastApiMethodRe = /@router\.(get|post|put|patch|delete|options)\(\s*['"`]([^'"`]+)['"`]/g
      let fm
      while ((fm = fastApiMethodRe.exec(src)) !== null) {
        const method = fm[1].toUpperCase()
        const localPath = fm[2]
        for (const p of prefixes2) {
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

// (2026-09-25 原 pathMatches 单函数已拆入比对段的 matchSegs / matchStar 两分支,判据逐行不变)

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
    const out = gitRaw(['diff', '--cached', '--name-only'], ROOT, { timeout: GIT_BATCH_TIMEOUT })
    // git 输出为仓库根相对路径(POSIX 斜杠);Windows 下 relative() 产生反斜杠,统一为 /
    return String(out)
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    return null // 非 git 环境/命令失败 → 由调用方按面判"无法判定",绝不静默当全量
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

/**
 * 跑本脚本自身一次,返回 { status, out(去 ANSI) }。
 * 夹具经**显式 `--root` + `--worktree`** 通道进入(2026-09-26):ROOT 由脚本自身位置推导后,
 * "只靠 cwd 定位夹具"的调用形态结构上失效 —— 13 例里 11 例其实在审真仓、账面全绿而结论与夹具无关
 * (守门 70 / 13c 同型事故)。`--worktree` 是夹具唯一合法档:临时根不是 git 仓,按 HEAD 读必然全空。
 */
function runGateIn(cwd, extraArgs = []) {
  const r = spawnSync(
    process.execPath,
    [process.argv[1], '--worktree', '--root', cwd, ...extraArgs],
    {
      cwd: HERE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
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

/** --self-test 主体:返回 {failures, assertions}(空 failures = 全部通过;断言数由计数器得出,不写死) */
function runSelfTest() {
  const failures = []
  let assertions = 0
  const eq = (name, expected, actual) => {
    assertions++
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

  // ===== 三端棘轮(2026-09-26 扩面):存量只报数、新增判红、缺锚点判"无法判定" =====
  const rnDeadCall = "fetchApi('/api/rn/legacy-thing', { method: 'POST' })\n"
  const rnFixture = (baselineContent) => {
    const files = {
      'apps/api/src/routes/x.ts': `server.get('/api/nothing', async () => ({}))\n`,
      'apps/mobile-rn/src/dead.ts': rnDeadCall,
    }
    if (baselineContent !== undefined) files[BASELINE_FILE_REL] = baselineContent
    return makeSelfTestRoot(files)
  }
  const baseAt = (n) =>
    JSON.stringify({ version: 1, perFileCount: { 'apps/mobile-rn/src/dead.ts': n } })
  // 10. 存量 = 基线额度 ⇒ exit 0,但必须**报出**存量读数(绝不静默成"看起来全绿")
  const ratchetRoot = rnFixture(baseAt(1))
  try {
    const r = runGateIn(ratchetRoot)
    eq(
      '棘轮:mobile-rn 存量 1 处等于基线额度 ⇒ exit 0 且如实报存量',
      [0, true, true],
      [r.status, /存量/.test(r.out), /apps\/mobile-rn/.test(r.out)],
    )
  } finally {
    rmScratch(ratchetRoot)
  }
  // 11. 同一文件比基线多一处 ⇒ 判红并点名"新增"(拦的正是"这次把死调用加回来")
  const overRoot = rnFixture(baseAt(0))
  try {
    const r = runGateIn(overRoot)
    eq(
      '棘轮:超出基线额度 ⇒ exit 1 且点名新增',
      [1, true],
      [r.status, /新增/.test(r.out)],
    )
  } finally {
    rmScratch(overRoot)
  }
  // 12. 有存量而锚点不在面里 ⇒ **未判定**:逐条列出、不判红也不记绿(exit 0 + 大声点名)。
  //     当场判红/exit 2 会把与本次改动无关的提交钉住 —— 门脚本从磁盘执行,别人一提交就撞上
  //     "我这枚没带基线",唯一结局是 --no-verify 连带废掉全部守门(§12e;手法照守门 110/105)。
  const noBaseRoot = rnFixture(undefined)
  try {
    const r = runGateIn(noBaseRoot)
    eq(
      '缺基线而有死调用 ⇒ exit 0 且如实喊"未判定"并逐条列出',
      [0, true, true],
      [
        r.status,
        /未判定/.test(r.out),
        /apps\/mobile-rn\/src\/dead\.ts/.test(r.out),
      ],
    )
  } finally {
    rmScratch(noBaseRoot)
  }
  // 13. web 零容忍不因本次扩面被放宽:基线只兜三端,不兜 web
  const webRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: baseAt(1),
    'apps/web/dead.ts': "fetchApi('/api/web/legacy-thing', { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(webRoot)
    eq('web 仍是零容忍(棘轮不覆盖 web)', 1, r.status)
  } finally {
    rmScratch(webRoot)
  }
  // 14. 不透明挂载前缀下的调用 ⇒ 计「未判定」而非死调用:exit 0 且必须点名依据
  //     (真实动因:`AI_SERVICE_EDGE_ROUTES` 两条 `/api/mcp/export/*` 由 `mount_to_app` 挂载,
  //      静态注册面看不见 —— 判红就是把别人的正确实现钉成缺陷)
  const opaqueRoot = makeSelfTestRoot({
    'apps/web/opaque.ts':
      "fetchApi('/api/mcp/export/streamable', { method: 'POST' })\nfetchApi('/api/mcp/export/sse')\n",
  })
  try {
    const r = runGateIn(opaqueRoot)
    eq(
      '不透明挂载前缀 ⇒ 未判定(不判红)且点名',
      [0, true, true],
      [r.status, /不透明挂载/.test(r.out), /\/api\/mcp\/export\/streamable/.test(r.out)],
    )
  } finally {
    rmScratch(opaqueRoot)
  }
  // 15. 反向锁:台账不是无条件放行 —— 同前缀家族**外**的一条仍必须判红
  const opaqueNeighborRoot = makeSelfTestRoot({
    'apps/web/opaque.ts': "fetchApi('/api/mcp/export-x/streamable', { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(opaqueNeighborRoot)
    eq('台账外的近邻路径必须照判死调用(不得连片放行)', 1, r.status)
  } finally {
    rmScratch(opaqueNeighborRoot)
  }
  return { failures, assertions }
}

if (process.argv.includes('--self-test')) {
  const { failures: selfFailures, assertions } = runSelfTest()
  if (selfFailures.length === 0) {
    console.log(
      `${C.green}[API 路由比对] --self-test 通过(${assertions} 例判据断言)${C.reset}`,
    )
    process.exit(0)
  }
  console.log(`${C.red}[API 路由比对] --self-test 失败 ${selfFailures.length} 例:${C.reset}`)
  for (const f of selfFailures) console.log(`${C.red}  ✗ ${f}${C.reset}`)
  process.exit(1)
}

/**
 * 取材层失败的退出码必须**是 2,而不是 1**(2026-09-26)。
 * 本脚本主流程是模块顶层代码,`catBatch` / `gitRaw` 抛出的 `Undetermined` 若没人接,Node 会以
 * **exit 1** 崩在这里 —— 那是守门 94 被记过的那一型("以 uncaught 异常 exit 1 冒充判据失败"):
 * 调用方读到的是"检出了死调用",而真实结论是"没看完"。这里只把 Undetermined 折成 exit 2 并点名原因,
 * 其他异常一律原样抛(绝不借这道兜底吞掉真 bug)。
 */
process.on('uncaughtException', (e) => {
  if (e instanceof Undetermined) {
    console.log(`${C.red}[API 路由比对] ⚠️ 无法判定(不是"没有违规",是"取不到判定面"):${C.reset} ${e.message}`)
    process.exit(2)
  }
  throw e
})

const WARN_ONLY = process.argv.includes('--warn-only')
const UPDATE_BASELINE = process.argv.includes('--update-baseline')

/**
 * 判定面(2026-09-26 收口):默认 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作
 * 人工/夹具逃生舱;两面旗同给 ⇒ exit 2。任一面取不到 ⇒ **exit 2「无法判定」,绝不回落另一个面**
 * (回落就是把"没判"写成"判过了",守门 36/124 记过同型)。
 * `--root` 只在 `--worktree` 档有效(它是测试通道,不是第二个判定面)。
 */
const faceSel = selectFace({
  staged: process.argv.includes('--staged'),
  worktree: process.argv.includes('--worktree'),
})
if (faceSel.error) {
  console.log(`${C.red}[API 路由比对] 无法判定:${faceSel.error}${C.reset}`)
  process.exit(2)
}
FACE = faceSel.face
if (ARG_ROOT && FACE !== 'worktree') {
  console.log(
    `${C.red}[API 路由比对] 无法判定:--root 是测试通道,只在 --worktree 档有效(换根仍按 ${FACE} 读 = 双根分裂)${C.reset}`,
  )
  process.exit(2)
}

// 2026-08-31:staged-scope 判定(改动原因见 getStagedFiles 上方注释)
let stagedFiles = null
if (FACE === 'staged') {
  stagedFiles = getStagedFiles()
  if (stagedFiles === null) {
    console.log(`${C.red}[API 路由比对] 无法判定:索引面问不到(git diff --cached 不可用)${C.reset}`)
    process.exit(2)
  }
}
const stagedScope = stagedFiles !== null && stagedFiles.length > 0
if (FACE === 'staged' && !stagedScope) {
  // 暂存集为空(无提交进行中/手动单跑)⇒ 退回 HEAD 全量面,而不是"空暂存恒绿"(守门 70 教训)
  console.log(
    `${C.yellow}[API 路由比对] 索引面无任何已暂存路径 ⇒ 退回全量 HEAD 面判定(不记绿为"无改动")${C.reset}`,
  )
  FACE = 'head'
}
const stagedSet = stagedScope ? new Set(stagedFiles) : null

console.log(
  `${C.cyan}[API 路由比对] 开始检查... (mode: ${WARN_ONLY ? 'warn-only' : 'strict'}, 面: ${FACE}${FACE === 'head' ? '=HEAD blob' : FACE === 'staged' ? '=索引 blob' : '=工作树(人工档,不作提交门禁)'})${C.reset}`,
)

/** 前端调用面(四端)+ 后端基准面的路径清单,一次枚举、一次 prefetch ⇒ 清单与内容同面同轮 */
const frontendRelsAll = []
const endByFile = new Map()
for (const end of FRONTEND_ENDS) {
  for (const rel of listFace(end.dir, FRONTEND_EXTS)) {
    endByFile.set(rel, end.name)
    frontendRelsAll.push(rel)
  }
}

/**
 * staged 收窄必须在 prefetch **之前**(2026-09-26):先读满四端 4,461 个 blob 再丢掉,
 * 等于给每一次 pre-commit 白加十几秒 —— 慢的提交链就是 --no-verify 的成因(§12e 同族)。
 * 语义与既有设计一致:暂存区无前端文件 ⇒ 跳过前端比对;后端注册面保持全量。
 */
let frontendRels = frontendRelsAll
if (stagedScope) {
  frontendRels = frontendRelsAll.filter((rel) => stagedSet.has(rel))
  if (frontendRels.length === 0) {
    console.log(
      `${C.yellow}[API 路由比对] (staged 范围) 暂存区无前端文件变更,跳过前端调用比对${C.reset}`,
    )
    process.exit(0)
  }
  console.log(
    `${C.dim}[API 路由比对] (staged 范围) 前端文件 ${frontendRels.length}/${frontendRelsAll.length} 个位于暂存区,非暂存文件的调用点跳过不计入失败${C.reset}`,
  )
}

const baseInputs = new Set([
  SERVER_FILE,
  AI_SERVICE_MAIN_FILE,
  IGNORE_FILE_REL,
  BASELINE_FILE_REL,
  ...listFace(API_ROUTES_DIR, ['.ts']),
  ...listFace(API_PLUGINS_DIR, ['.ts']),
  ...listFace(AI_SERVICE_ROUTERS_DIR, ['.py']),
])
prefetch([...frontendRels, ...baseInputs])

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
// 判序注(2026-09-26):收窄已提到 prefetch **之前**(否则预提交要为最终丢掉的 4,461 个 blob 买单)。
const allCalls = []
/** 每端读数:扫了几个文件、抽出几处调用、几处取不到内容、几处"有传输口却抽不出路径"(未判定) */
const endStats = new Map(
  FRONTEND_ENDS.map((e) => [e.name, { files: 0, calls: 0, unreadable: 0, shapeUnknown: 0 }]),
)
/**
 * 各端调用出口形态不同(RN/小程序经 @ihui/api-client、Taro 可能 Taro.request、扩展走 fetch),
 * 而 pathRe 只认 `/api/` 字面量。文件里有这些传输口却一个路径都没抽出来 ⇒ **不能算判过**:
 * 计入「未判定」并打印条数(判据失效的表现永远是安静 —— 守门 70/76/81 同族)。
 */
const TRANSPORT_RE =
  /fetchApi\s*\(|Taro\.request|\bwx\.request|\bmy\.request|\btt\.request|XMLHttpRequest|axios\.|\bfetch\s*\(|from\s+['"]@ihui\/api-client['"]/
/** 取不到内容的**前端代码文件**(与"配置面缺失"分开报,免得一句"取不到 1 个文件"混着两件事) */
const unreadCode = []
for (const rel of frontendRels) {
  const st = endStats.get(endByFile.get(rel))
  st.files++
  const src = readSource(rel)
  if (src === null || src === undefined) {
    st.unreadable++
    unreadCode.push(rel)
    continue
  }
  const calls = extractFrontendCalls(src, rel)
  st.calls += calls.length
  if (calls.length === 0 && TRANSPORT_RE.test(src)) st.shapeUnknown++
  allCalls.push(...calls)
}

console.log(`${C.dim}[API 路由比对] 前端 API 调用: ${allCalls.length} 处${C.reset}`)
for (const e of FRONTEND_ENDS) {
  const s = endStats.get(e.name)
  console.log(
    `${C.dim}  · ${e.name}:文件 ${s.files} / 调用 ${s.calls} / 取不到内容 ${s.unreadable} / 未判定(有传输口却抽不出路径)${s.shapeUnknown}${e.ratchet ? '(存量走棘轮)' : '(零容忍)'}${C.reset}`,
  )
}

// 比对
// 2026-09-25 性能修复(判据语义零改动):原实现对每个 unique call 线性遍历整个 backendPathSet
// (实测 753,708 条 = 5109 路由 × 160 组合前缀去重后),1,584 个 unique call ≈ 12 亿次
// split+pathMatches,全量单跑 >200 秒不出结论(链内因 staged 范围收窄才跑得完)。
// 现按 pathMatches 的两条分支把集合预切成三张索引,matched 结果逐条同判据:
//   exactKeys   — 「method + 去尾斜杠后全等」精确命中(等值字符串 pathMatches 恒为真的快速通道);
//   segBuckets  — 不含 '*' 段的条目按 段数→method 分桶(非通配分支要求段数相等);
//   starEntries — 含 '*' 段的条目(catch-all),量小,按原通配分支逐条判。
// ANY(动态 method)调用遍历该段数下所有 method 桶 + 全部 star 条目,与原「任意 method 匹配即算」一致。
// 刻意复刻原 `bp.split(' ')` 解构语义:后端条目字符串若含第二个空格,path 部分同样被截断。
const exactKeys = new Set()
const segBuckets = new Map() // segCount -> Map(method -> parts[])
const starEntries = [] // { method, parts }
for (const bp of backendPathSet) {
  const [bm, bp2] = bp.split(' ')
  const b = bp2.replace(/\/$/, '')
  const parts = b.split('/')
  if (parts.indexOf('*') !== -1) {
    starEntries.push({ method: bm, parts })
    continue
  }
  exactKeys.add(`${bm} ${b}`)
  let byMethod = segBuckets.get(parts.length)
  if (!byMethod) {
    byMethod = new Map()
    segBuckets.set(parts.length, byMethod)
  }
  let arr = byMethod.get(bm)
  if (!arr) {
    arr = []
    byMethod.set(bm, arr)
  }
  arr.push(parts)
}
/** 原 pathMatches 非通配分支逐行搬移(段数校验保留,防分桶外误用) */
function matchSegs(fParts, bParts) {
  if (fParts.length !== bParts.length) return false
  for (let i = 0; i < fParts.length; i++) {
    if (bParts[i].startsWith(':')) continue // 后端 :param 匹配任意
    if (fParts[i].startsWith(':')) continue // 前端 :param 通配
    if (fParts[i] !== bParts[i]) return false
  }
  return true
}
/** 原 pathMatches '*' catch-all 分支逐行搬移 */
function matchStar(fParts, bParts) {
  const starIdx = bParts.indexOf('*')
  if (starIdx === -1) return false
  if (fParts.length < starIdx + 1) return false
  for (let i = 0; i < starIdx; i++) {
    if (bParts[i].startsWith(':')) continue
    if (fParts[i].startsWith(':')) continue // 前端 :param 通配
    if (fParts[i] !== bParts[i]) return false
  }
  return true
}
/**
 * 不透明挂载前缀 —— ai-service 的 MCP 导出面用 `mount_to_app(app)` 挂载,不是装饰器注册
 * (实测 `apps/ai-service/app/main.py:921-924` + `app/services/mcp_export.py:1050` 自行裁前缀),
 * 本门的静态注册面**结构上看不见**这些路径。与守门 127「不透明前缀下的未判定」同一口径:
 * 判不出就点名并计「未判定」,既不判红(否则把别人的正确实现钉成死调用),也绝不静默放过。
 */
const OPAQUE_MOUNT_PREFIXES = [
  {
    prefix: '/api/mcp/export/',
    evidence: 'apps/ai-service/app/main.py:924 `mcp_export.mount_to_app(app)`(非装饰器挂载)',
  },
]
const opaqueUndetermined = []
const missing = []
const seen = new Set()
for (const call of allCalls) {
  const key = `${call.method} ${call.path}`
  if (seen.has(key)) continue
  seen.add(key)
  // 检查是否在后端注册
  const f = call.path.replace(/\/$/, '')
  const fParts = f.split('/')
  // ANY 的 method 字面量不会进 exactKeys(后端条目 method 无 ANY),精确通道对 ANY 天然不命中
  let found = exactKeys.has(`${call.method} ${f}`)
  if (!found) {
    const byMethodMap = segBuckets.get(fParts.length)
    if (byMethodMap) {
      const buckets =
        call.method === 'ANY'
          ? [...byMethodMap.values()]
          : [byMethodMap.get(call.method)].filter(Boolean)
      for (const arr of buckets) {
        for (const bParts of arr) {
          if (matchSegs(fParts, bParts)) {
            found = true
            break
          }
        }
        if (found) break
      }
    }
  }
  if (!found) {
    for (const e of starEntries) {
      // ANY = method 为动态三元等无法确定，任意 method 匹配即算注册
      const methodOk = call.method === 'ANY' || e.method === call.method
      if (methodOk && matchStar(fParts, e.parts)) {
        found = true
        break
      }
    }
  }
  if (!found) {
    const op = OPAQUE_MOUNT_PREFIXES.find((o) => f.startsWith(o.prefix))
    if (op) {
      // 判不出 ≠ 没有:与守门 127「不透明前缀下的未判定」同一口径,单独计数并点名,
      // 既不冒红(把别人的正确实现钉成死调用),也绝不静默成"看起来全绿"。
      opaqueUndetermined.push({ ...call, evidence: op.evidence })
      continue
    }
    missing.push(call)
  }
}

const dumpIdx = process.argv.indexOf('--dump-missing')
if (dumpIdx !== -1 && process.argv[dumpIdx + 1]) {
  writeFileSync(process.argv[dumpIdx + 1], JSON.stringify(missing, null, 2), 'utf8')
}

// 读取 ignore 配置(**按判定面取,不读磁盘**)
// 格式:{ "version": 1, "ignorePatterns": [{ "method": "GET", "pathPattern": "...", "reason": "..." }] }
// pathPattern:支持字符串包含匹配,也支持 ^...$ 正则
// method:"ANY" 或具体方法;省略 method = 任意 method 都豁免
const ignoreSrc = readSource(IGNORE_FILE_REL)
let ignorePatterns = []
if (ignoreSrc === null || ignoreSrc === undefined) {
  console.log(
    `${C.yellow}[API 路由比对] ${FACE} 面里没有 ${IGNORE_FILE_REL} —— 本轮不应用任何豁免(如实说明,不是"配置为空")${C.reset}`,
  )
} else {
  try {
    const cfg = JSON.parse(ignoreSrc)
    ignorePatterns = Array.isArray(cfg.ignorePatterns) ? cfg.ignorePatterns : []
  } catch (e) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️  ${IGNORE_FILE_REL} 解析失败,忽略配置文件:${C.reset} ${e.message}`,
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

/**
 * ===== 棘轮分流(2026-09-26)=====
 * web 是既有口径 ⇒ **零容忍**(不得因本次扩面被放宽);首次纳入的三端走棘轮,
 * 锚点 = 基线里该文件的存量数(与守门 77/83/98/99 的"HEAD 自身违规数"同一条设计)。
 * 为什么必须棘轮:三端首次纳入必然冒出一批既有死调用,当场判红就是一台与任何提交都无关的
 * 恒红门,唯一结局是逼人 `--no-verify`、连带废掉全部守门(§12e 实测同型)。
 */
const RATCHET_ENDS = new Set(FRONTEND_ENDS.filter((e) => e.ratchet).map((e) => e.name))
const countsByFile = new Map()
for (const c of realMissing) {
  const end = endByFile.get(c.file)
  if (!end || !RATCHET_ENDS.has(end)) continue
  countsByFile.set(c.file, (countsByFile.get(c.file) || 0) + 1)
}

if (UPDATE_BASELINE) {
  const payload = {
    version: 1,
    anchor: '该文件在基线里的死调用存量数(只减不增;新增即判红,存量只报数)',
    reason:
      '2026-09-26 把守门 8 的前端调用面从 apps/web 扩到 mobile-rn / miniapp-taro / extension,再扩到 packages/api-client,首次纳入的存量。' +
      'api-client 这批不是本次改动引入的调用:那 15 个文件最近的提交 ca93dd962e 只改了 import 的 .js 扩展名,' +
      '逐文件新增 /api/ 字面量 0 条(实测),所以它们是从写下起就没人对账过的存量。',
    ends: [...RATCHET_ENDS].sort(),
    face: FACE,
    perFileCount: Object.fromEntries([...countsByFile.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))),
  }
  const outAbs = join(ROOT, ...BASELINE_FILE_REL.split('/'))
  writeFileSync(outAbs, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(
    `${C.green}[API 路由比对] 基线已按当前 ${FACE} 面重写:${Object.keys(payload.perFileCount).length} 个文件 / ${[...countsByFile.values()].reduce((a, b) => a + b, 0)} 处存量 → ${BASELINE_FILE_REL}${C.reset}`,
  )
  process.exit(0)
}

const baselineSrc = readSource(BASELINE_FILE_REL)
let baselineCounts = {}
let baselineAvailable = false
if (baselineSrc === null || baselineSrc === undefined) {
  // 锚点文件不在面里 ⇒ 三端**本轮未判定**(不判红也不记绿,守门 110/105 的同一手法):
  // 当场判红 / exit 2 都会把与改动无关的提交钉住 —— 门脚本从磁盘执行,别的会话一提交就撞上
  // "我这枚提交没带基线" ⇒ 唯一结局是逼人 --no-verify,连带废掉全部守门(§12e 实测同型)。
  // 出路写在输出里:让基线与门同笔提交(本票交付即含该文件)。
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定:${FACE} 面里没有 ${BASELINE_FILE_REL} ⇒ 三端本轮没有棘轮锚点(死调用逐条列出,只报数不判红)。出路:把基线文件与门的改动同笔提交${C.reset}`,
  )
} else {
  try {
    const parsed = JSON.parse(baselineSrc)
    baselineCounts =
      parsed && parsed.perFileCount && typeof parsed.perFileCount === 'object'
        ? parsed.perFileCount
        : {}
    if (!parsed || !parsed.perFileCount) {
      console.log(
        `${C.yellow}[API 路由比对] ⚠️ 未判定:${BASELINE_FILE_REL} 缺 perFileCount 字段,本轮按空锚点处理(不静默当没有存量)${C.reset}`,
      )
    } else baselineAvailable = true
  } catch (e) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 未判定:${BASELINE_FILE_REL} 不是合法 JSON(${e.message})—— 坏基线不冒充空清单,本轮按无锚点处理${C.reset}`,
    )
  }
}

const webViolations = realMissing.filter((c) => {
  const end = endByFile.get(c.file)
  return !end || !RATCHET_ENDS.has(end)
})
const ratchetStock = []
const ratchetNew = []
const ratchetNoAnchor = []
for (const [file, n] of countsByFile) {
  const calls = realMissing.filter((c) => c.file === file)
  if (!baselineAvailable) {
    ratchetNoAnchor.push({ file, count: n, calls })
    continue
  }
  const allowed = Number(baselineCounts[file]) || 0
  if (n > allowed) ratchetNew.push({ file, count: n, allowed, calls })
  else if (n > 0) ratchetStock.push({ file, count: n, allowed })
}
const staleLedger = Object.keys(baselineCounts).filter((f) => !countsByFile.has(f))

if (ignored.length > 0) {
  console.log(
    `${C.yellow}[API 路由比对] ℹ️  ${ignored.length} 处调用被 ${IGNORE_FILE_REL} 豁免(后端待实装/已知占位)${C.reset}`,
  )
  for (const ig of ignored.slice(0, 20)) {
    console.log(`${C.dim}  ${ig.method} ${ig.path} @ ${ig.file}:${ig.line}${C.reset}`)
  }
}

/** 每端存量/新增一行,让人一眼看到"三端到底量到了什么" */
for (const e of FRONTEND_ENDS.filter((x) => x.ratchet)) {
  const stock = ratchetStock.filter((s) => endByFile.get(s.file) === e.name)
  const fresh = ratchetNew.filter((s) => endByFile.get(s.file) === e.name)
  const totalStock = stock.reduce((a, s) => a + s.count, 0)
  console.log(
    `${C.dim}  · ${e.name}:死调用 ${totalStock + fresh.reduce((a, s) => a + s.count, 0)} 处 = 存量(基线内,只报数)${totalStock} + 新增(判红)${fresh.reduce((a, s) => a + s.count, 0)};基线已失效的登记行 ${staleLedger.filter((f) => endByFile.get(f) === e.name).length}${C.reset}`,
  )
}

const undeterminedList = unreadCode
if (undeterminedList.length > 0) {
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ ${FACE} 面取不到内容 ${undeterminedList.length} 个文件(这些文件**没被判过**,不计入"通过"):${C.reset}`,
  )
  for (const p of undeterminedList.slice(0, 10)) console.log(`${C.dim}    ${p}${C.reset}`)
}
/**
 * 这两条"未判定"必须**无条件**打印 —— 原先它们嵌在 `unreadCode.length > 0` 里,
 * 而取不到内容=0 恰是正常轮次的常态,于是"有传输口却抽不出路径"的计数永远不响
 * (判据失效的表现永远是安静,守门 70/76/81 同型)。
 */
const shapeUnknownTotal = [...endStats.values()].reduce((a, s) => a + s.shapeUnknown, 0)
console.log(
  `${C.yellow}[API 路由比对] ⚠️ 未判定调用形态 ${shapeUnknownTotal} 个文件(有传输口却抽不出 /api/ 路径,判据看不见 ≠ 没有死调用)${C.reset}`,
)
if (opaqueUndetermined.length > 0) {
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定(不透明挂载)${opaqueUndetermined.length} 处调用落在本门看不见的挂载前缀下,不判红也不计通过:${C.reset}`,
  )
  for (const c of opaqueUndetermined) {
    console.log(
      `${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line} —— 依据:${c.evidence}${C.reset}`,
    )
  }
}

/**
 * 存量登记必须打在**判定结论之前**、且在 exit 0 那条路径上照样打 —— 否则"通过"就成了
 * 一句把已知死调用洗白的绿灯(§12e / 守门 70 同型:判据失效的表现永远是安静)。
 */
if (ratchetNoAnchor.length > 0) {
  console.log(
    `${C.yellow}  (未判定)三端死调用 ${ratchetNoAnchor.reduce((a, s) => a + s.count, 0)} 处逐条列出 —— 无锚点可比,本轮不计红也不计绿:${C.reset}`,
  )
  for (const s of ratchetNoAnchor) {
    for (const c of s.calls) {
      console.log(`${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}${C.reset}`)
    }
  }
}

if (ratchetStock.length > 0) {
  console.log(
    `${C.yellow}  (登记)棘轮内存量死调用 ${ratchetStock.reduce((a, s) => a + s.count, 0)} 处 / ${ratchetStock.length} 个文件,本轮不判红;清理后请跑 --update-baseline 下调额度${C.reset}`,
  )
  for (const s of ratchetStock.slice(0, 20)) {
    console.log(`${C.dim}    ${s.file}:存量 ${s.count} 处(基线允许 ${s.allowed})${C.reset}`)
  }
  if (ratchetStock.length > 20) {
    console.log(`${C.dim}    ... 还有 ${ratchetStock.length - 20} 个文件(逐条见 --dump-missing)${C.reset}`)
  }
}
if (staleLedger.length > 0) {
  console.log(
    `${C.yellow}  (登记)基线里有 ${staleLedger.length} 个文件已不再命中(清单该收紧了):${C.reset} ${staleLedger.slice(0, 5).join(', ')}`,
  )
}

if (webViolations.length === 0 && ratchetNew.length === 0) {
  console.log(
    `${C.green}[API 路由比对] ✅ 通过(新增 0 处死调用;三端存量 ${ratchetStock.reduce((a, s) => a + s.count, 0)} 处按棘轮只报数)${C.reset}`,
  )
  process.exit(0)
}

if (webViolations.length > 0) {
  console.log(
    `${C.red}[API 路由比对] ❌ 发现 ${webViolations.length} 处前端调用无后端路由（404 风险）:${C.reset}`,
  )
  for (const m of webViolations.slice(0, 50)) {
    console.log(`${C.red}  ${m.method} ${m.path}${C.reset}`)
    console.log(`${C.dim}    @ ${m.file}:${m.line}${C.reset}`)
  }
  if (webViolations.length > 50) {
    console.log(`${C.dim}  ... 还有 ${webViolations.length - 50} 处${C.reset}`)
  }
}

if (ratchetNew.length > 0) {
  console.log(
    `${C.red}[API 路由比对] ❌ 三端**新增**死调用(超出基线额度)${ratchetNew.reduce((a, s) => a + (s.count - s.allowed), 0)} 处,涉及 ${ratchetNew.length} 个文件:${C.reset}`,
  )
  for (const v of ratchetNew) {
    console.log(
      `${C.red}  ${v.file}:本次 ${v.count} 处 / 基线允许 ${v.allowed} 处 ⇒ 新增 ${v.count - v.allowed} 处${C.reset}`,
    )
    for (const c of v.calls.slice(0, 10)) {
      console.log(`${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}${C.reset}`)
    }
  }
}

console.log('')
console.log(`${C.yellow}修复方法:${C.reset}`)
console.log(`  1. 确认前端调用路径是否正确（检查 prefix 层级）`)
console.log(`  2. 确认 HTTP 方法是否匹配（GET/POST/PUT/PATCH/DELETE）`)
console.log(`  3. 如后端缺失，在 apps/api/src/routes/ 对应文件补建路由`)
console.log(`  4. 如前端错误，修正前端调用路径或方法`)
console.log(`  5. 确属"后端从未注册且该调用就是死的"(如 RN 侧 /api/study/videos):`)
console.log(`     要么补后端路由,要么删掉死调用 —— **禁止**用 --update-baseline 把新增写进基线消红`)
process.exit(WARN_ONLY ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
