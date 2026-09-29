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
import {
  Undetermined,
  catBatch,
  catBatchOids,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
// 遮罩判据只引这一份实现(守门 131/135 同族规矩:两处实现必漂移)。本门新加的"一跳常量解析"
// 要在**代码面**上找 `const X =` 声明与 import 绑定 —— 按原文找会把注释里的示例声明当真声明
// (守门 70 的 URL 假注释态同型),而 code-mask 等长遮罩保证行/列号不漂。
import { maskComments, maskCommentsAndStrings } from './lib/code-mask.mjs'

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
/**
 * ai-service 还有第二个 routers 面:`app/api/**`(memory.py / dag.py / v1/*)。
 * 2026-09-28 随 `apps/cli` 纳入时实测发现:cli 的 `POST /api/memory/procedural`、
 * `POST /api/memory/save`、`DELETE /api/memory/forget` 全部注册在
 * `apps/ai-service/app/api/memory.py`,而注册面只枚举 `app/routers/**` ⇒ 三条**已实现**
 * 的端点被判成死调用。挂载前缀不需要在这里额外解析:`/api` 本身就是 server.ts /
 * routes/index.ts 里的绝对 prefix,compositePrefixes 会把每条 localPath 拼上它,
 * 与 `app/routers/**` 走的是同一条既有推导(所以这不是第二份注册面实现,只是同一份的输入变宽)。
 */
const AI_SERVICE_API_DIR = 'apps/ai-service/app/api'
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
    // 与端内不同:这里的 fetchApi 基址由**宿主注入**,`/cozeZhsApi` 是改写前缀。
    //
    // ⚠️ 2026-09-29 就地更正(旧句"两者都按字面路径参与对账,拼不出来的退到未判定计数"**做不到的那一半**):
    // 逐条量过这三条现场字面量,今天各自落在哪一格,与镜像测试的阳性对照一一对应 ——
    //  ① `endpoints/token.ts` 的 `fetchApi<TokenBalance>('/api/user/token-balance')` ⇒ **看得见**:
    //     引号紧邻 `/api/` ⇒ 进调用集;未注册即点名(镜像 FG-1 钉住,反证:摘掉 api-client 面它必红)。
    //  ② `endpoints/user.ts` 的 `fetchApi<UserStatistics>('/api/statistics/user-center')` ⇒ **看得见**:
    //     同一文件里既有一条跨行 options 的已注册 POST、又有一条未注册 GET ⇒ 必须**逐条**判,
    //     不许"整文件一条红就完事"也不许把已注册那条连带判死(镜像 FG-2)。
    //  ③ `endpoints/agent.ts` 的 `fetchApi<AgentCategories>('/cozeZhsApi/cache/…')` ⇒ **看不见**:
    //     `pathRe` 要求引号紧邻 `/api/`,而这种字面量的前缀是 transport 的 `normalizeUrl` 才会补成
    //     `/api/` —— 归一档只被 CE① 读、主对账从不应用,所以它**一条都不进调用集**,既不判死也不落
    //     任何既有未判定桶(实测三个数一起报 0 = 静默绿)。这一格**结构上无法由静态门判**:
    //     真路径取决于运行期宿主注入的 base URL 与是否命中 rewrite,静态读不到(与票面"任一后端在册
    //     即算活"那条否证同源),把它判红就是存量恒红门(§12e),臆造路径就是造第二份真相。
    //     ⇒ 现由 `collectAliasLiteralBlindSites` 登记成「未判定(改写前缀字面量)」并**逐条报名**,
    //       输出无条件打印;读到这一面的人先看见"这几处没判",不得读成"已对账"。
  },
  {
    name: 'cli',
    dir: 'apps/cli',
    ratchet: true,
    // 2026-09-28 纳入(票面理由:一条门只管自己立项那一型 —— 前一轮扩到四端时 cli 就是留下的
    // 那一格)。HEAD 面实测 44 行「引号紧邻的 `/api/` 字面量」,而它的出口形态与 web 不同:
    // 自家 wrapper `apiRequest(baseUrl, '/api/x')` 把路径放在**第二个实参**,以及
    // `fetch(` + 模板串里 `${this.apiUrl}/api/x` 这类**前缀插值** —— 裸 pathRe 要求引号紧邻路径,
    // 后者结构上抽不出(判据失明的那一型,见文件内 CLI_* 提取式)。
  },
  {
    name: 'app-shared',
    dir: 'packages/app',
    ratchet: true,
    // 零成本防未来盲区(2026-09-28):HEAD 面实测 5 处 `/api/` **全部在注释里**(如
    // `MemoryScreen.tsx:119`「API(fetchApi /api/memory*)…由 wrapper 注入」),quote-adjacent
    // 字面量 0 条 ⇒ 当次存量为 0。纳不纳今天没有差别,而"因为现在没有就不纳"正是本票立项
    // 要防的判断 —— 这一端一旦开始直接写路径字面量,没有判据会喊。
    // 注意:`.test.` 过滤与 `isIgnoredSourceFile` 对它同样生效,注释里的字面量不计调用点。
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

/**
 * 「这段 `${...}` 插值是查询串构造器还是路径段?」—— 全脚本唯一实现(2026-09-28 抽出)。
 * 原先它内联在 extractFrontendCalls 里;CLI 形态提取也要判同一件事,而**两处算同一件事必漂移**
 * 是本仓记过最多次的失败型,所以判据只留这一份,两个消费方各调它。
 * 2026-09-17 加固的原判据一字未改:`?` 只在**非可选链**时才算查询串构造器
 * (`${editing?.id}` 是值,退化成丢 :param 会造成误报)。
 */
function looksLikeQueryStringBuilder(expr) {
  return (
    /\?(?!\.)/.test(expr) ||
    /(^|[^a-zA-Z0-9_])(qs|query|search|params|filter|filters|sort|pagination|listQs|pageQuery|searchParams|queryString|searchQuery)([^a-zA-Z0-9_]|$)/i.test(
      expr,
    )
  )
}

/** 模板字符串变量:查询串构建器直接去掉,其余替换为 :param;尾部 `?...` 整段丢弃 */
function normalizeCallPath(rawPath) {
  return rawPath
    .replace(/\$\{([^}]+)\}/g, (_match, expr) =>
      looksLikeQueryStringBuilder(expr) ? '' : ':param',
    )
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '')
}

/**
 * 同一入口的两种拼写候选:normalizeUrl 会把不以 `/api/` 开头的字面量补成 `/api/...`,
 * 所以调用点写的 `/admin/x` 与后端在册的 `/api/admin/x` 是**同一个入口**。刻意不把
 * "剥掉 /api" 也算一种候选 —— 那会让任何 `/api/x` 调用都凭空获得一个 `/x` 分身,
 * 等价判据就把"两处不同前缀"读成"处处都等价"(假阳的代价是各会话合法 --no-verify,§12e)。
 */
function aliasPathCandidates(p) {
  const out = [p]
  const bare = p.startsWith('/') ? p : `/${p}`
  if (
    bare.startsWith('/') &&
    !bare.startsWith('/api/') &&
    !bare.startsWith('/uploads/') &&
    !bare.startsWith('/ws/')
  )
    out.push(`/api${bare}`)
  return [...new Set(out)]
}

// ===== 通道等价对账(2026-09-29,G-466 换维后的新格子)=====
/**
 * **这一维判的是什么,以及既有判据为什么结构上看不见它**
 * 本门的比对是「前端字面路径 ↔ 后端注册路径」的等值对账(`backendPathSet` / `matchSegs`)。
 * 若满足下面三条,则**两侧各自都"已注册"**,等值对账两侧同时成立 ⇒ 门一路报绿,
 * 而实际上这两条字面路径在后端是同一个入口,其中一条本该有的通道校验被有意跳过了:
 *  ① 前端确有把前缀 A 归并进前缀 B 的改写(读 transport 的实现,不读注释);
 *  ② 后端确有按"客户端自报的通道头"判定的守卫,且该守卫对某个 HTTP 方法**有意放行**;
 *  ③ 面上存在一处真实调用点,同时落在 A 与 B 两种拼写上(等价因此是活的,不是纸面的)。
 *
 * **本票立项时逐条否证过票面给的现场**(三条都不成立 ⇒ 本维今天落「未判定」,不判红):
 *  - `normalizeUrl` 在 `packages/api-client/src/client.ts:404-416`,唯一改写档是
 *    `if (url.startsWith('/cozeZhsApi')) return url.replace(/^\/cozeZhsApi/, '/api')`(:408-410)
 *    —— **没有** `/admin/*`→`/console/*` 这一档,也没有任何注入通道头的语句;
 *  - `apps/api/src/plugins/admin-client-channel.ts` 在工作树 / 索引 / HEAD **三面均不存在**,
 *    `git log --all -- <该路径>` 零命中 ⇒ 它在仓库历史里从未存在过;
 *  - `X-Client-Channel` 字面量在 HEAD 的代码面零命中(全仓唯一出处是 PROJECT_PLAN.md 里
 *    描述它的那句票面本身)⇒ 后端没有任何守卫读通道头。
 * 所以本维**不是**去把那一处"敞口"清掉(它不在本仓),而是把"字面等值对账看不见等价改写"
 * 这一型装上判据:三条同时成立才判红,缺一律落未判定并**点名缺哪一条、为什么判不出**
 * (§守门速查"三态绝不并桶";不得把"没判"写成"判过了",也不得把"没看见"写成"没有")。
 *
 * **不得为消红去改后端放行或前端归一化** —— 那是产品/安全决策,不在本票射程。
 */
/** 通道等价的事实源①:transport 的 URL 归一实现(读它,不在门里抄第二份改写表) */
const CLIENT_TRANSPORT_FILE = 'packages/api-client/src/client.ts'
/** 通道等价的事实源②:通道守卫只可能住在这里(Fastify 插件 = 全局 preHandler 的落点) */
const CHANNEL_GUARD_GLOBS = [API_PLUGINS_DIR]
/** 通道等价的首锚台账(键集与判据**同判定面**;缺档 ⇒ 未判定,不冒红也不记绿) */
const CHANNEL_EQUIV_BASELINE_REL = 'scripts/data/channel-equiv-baseline.json'

/**
 * ① 读 transport 的归一实现,取出"前缀改写档"。
 * 判据只在**遮注释面**上算(`maskComments` 保留字符串、整段删行注释 ⇒ 不等长,所以索引
 * 一律在遮噪面上取、也在遮噪面上截 —— 写门时先用原文截体截到了别处,表现为"改写档 0 条"
 * 的安静失明)。函数体里要读的两样东西(守卫串与替换式)本来就在代码面上,遮噪无信息损失。
 * 锚在**定义**上而不是调用点:`normalizeUrlPublic` 与 `return normalizeUrl(url)` 都在定义之前,
 * 按"第一个 normalizeUrl(" 找会把起点落到别的函数里。
 */
function sliceNormalizeUrlBody(src) {
  if (typeof src !== 'string') return null
  const masked = maskComments(src)
  const def = masked.search(
    /\b(?:async\s+)?function\s+normalizeUrl\b|\b(?:const|let)\s+normalizeUrl\s*=/,
  )
  if (def === -1) return null
  const paramsOpen = masked.indexOf('(', def)
  const paramsClose = paramsOpen === -1 ? -1 : masked.indexOf(')', paramsOpen)
  const bodyOpen = paramsClose === -1 ? -1 : masked.indexOf('{', paramsClose)
  if (bodyOpen === -1) return null
  let depth = 0
  for (let i = bodyOpen; i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}') {
      depth--
      if (depth === 0) return masked.slice(bodyOpen + 1, i)
    }
  }
  return null
}

/**
 * 归一实现 → `{parsed, reason, rules:[{from,to,fromRe,head}], passthrough, ambiguous}`。
 * 三条设计前提(与本门其余判据同一条纪律):
 * 1. **守卫与替换式必须同形** —— `startsWith('/A')` 配的 replace 式就得是 `/^\/A/`;
 *    不同形 ⇒ 一条都不采用(那是"改写到别处"的新写法,判据猜不得),计入 `ambiguous` 如实报数。
 * 2. 取不到函数体 ⇒ `parsed:false` ⇒ 本维整条落未判定并点名,绝不静默算通过。
 * 3. `rules` 为空而函数体在位 = 真的没有改写档(档被撤了),这不是判据失效 ⇒ `parsed:true`。
 */
function readUrlAliasRules(clientSrc) {
  const out = { parsed: false, reason: '', rules: [], passthrough: [], ambiguous: 0 }
  if (clientSrc === null || clientSrc === undefined) {
    out.reason = `${CLIENT_TRANSPORT_FILE} 在判定面上取不到内容`
    return out
  }
  const body = sliceNormalizeUrlBody(clientSrc)
  if (body === null) {
    out.reason = `${CLIENT_TRANSPORT_FILE} 的 normalizeUrl 函数体配平不到(写法变了,不猜)`
    return out
  }
  let m
  // 替换式里的斜杠按 JS 正则字面量写的是 `\/`,所以捕获用惰性 `.+?` 截到"下一个未转义 `/` + 逗号",
  // 再统一去转义后与守卫比对(字符类 `\\.?[^/]` 那版对 `\\/cozeZhsApi` **一条都匹配不上** ——
  // 判据静默为空比判错更危险,所以留这一句反例记录)
  const ruleRe =
    /url\.startsWith\(\s*['"`]([^'"`]+)['"`][\s\S]{0,60}?url\.replace\(\s*\/\^(.+?)\/\s*,\s*['"`]([^'"`]*)['"`]/g
  while ((m = ruleRe.exec(body)) !== null) {
    const guard = m[1]
    const pattern = m[2].replace(/\\([^a-zA-Z0-9])/g, '$1')
    const to = m[3]
    if (!guard.startsWith('/') || pattern !== guard || !to.startsWith('/')) {
      out.ambiguous++
      continue
    }
    out.rules.push({ from: guard, to })
  }
  // 原样透传档(`/api/`、`/uploads/` 这类不 rewritten 的前缀):只用于把"两侧同值"说清,不参与判红
  const passRe =
    /url\.startsWith\(\s*['"`]([^'"`]+)['"`]\s*\)((?:\s*\|\|\s*url\.startsWith\(\s*['"`][^'"`]+['"`]\s*\))*)\s*\)\s*return\s+url\b/g
  while ((m = passRe.exec(body)) !== null) {
    out.passthrough.push(m[1])
    for (const extra of (m[2] || '').matchAll(/['"`]([^'"`]+)['"`]/g)) out.passthrough.push(extra[1])
  }
  out.passthrough = [...new Set(out.passthrough)]
  out.parsed = true
  if (out.rules.length === 0 && out.ambiguous > 0) {
    out.reason = `读到 ${out.ambiguous} 对守卫与替换式不同形的改写形态,一条都不采用`
  }
  return out
}

/**
 * 从 `if (...)` 条件右括号之后取**该语句自己的分支体**。
 * `{` 起 ⇒ 括号配平取整块(配平不到返回 null,不猜);否则取到行尾或 `;`(单语句形态)。
 * 这一格必须精确:早退与拒绝常写成相邻两行,按"读后 N 行"会把 `return` 与下一档的 4xx 同时
 * 读进同一个分支体 ⇒ 放行档被读成拒绝档 ⇒ 本维在自己立项那一型上失明(整段变 partial)。
 */
function sliceBranch(masked, fromIdx) {
  const rest = masked.slice(fromIdx)
  const ws = /^\s*/.exec(rest)
  const start = fromIdx + (ws ? ws[0].length : 0)
  if (start >= masked.length) return ''
  if (masked[start] !== '{') {
    const tail = masked.slice(start)
    const cut = tail.search(/[\n;]/)
    return cut === -1 ? tail : tail.slice(0, cut)
  }
  let depth = 0
  for (let i = start; i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}') {
      depth--
      if (depth === 0) return masked.slice(start + 1, i)
    }
  }
  return null
}

/**
 * ② 在后端通道守卫面上读"按客户端自报通道头判定、且对某方法有意放行"的实现。
 * 全部在**遮注释面**上判(注释里的 `X-Client-Channel` 不得给实现背书 —— 守门 70/131 同型)。
 * 一条守卫要同时给得出三样:
 *  ②-a 读了一个名字含 `channel` 的请求头(通道身份来自**客户端自报**,不是令牌主体);
 *  ②-b 面上确有拒绝分支(throw / 4xx / forbidden)⇒ 它真在校验,而不是只把通道头记进日志;
 *  ②-c 该拒绝之前有一档**按方法**的早退:`m === 'GET'` + return/next ⇒ 放行那一档方法;
 *       或 `m !== 'GET'` + 拒绝 ⇒ 除 GET 外都校验 ⇒ 放行集是通配 `*`。
 * 三样不齐 ⇒ 该文件进 `partial` 并**点名缺哪一格**:既不据此判红,也不因为"像个守卫"就把本维
 * 记成已成立(§守门速查"三态绝不并桶")。
 * 分支体必须用 `sliceBranch` 精确取,**不得**顺手多读几行 —— `if (m === 'GET') return` 之后紧跟的
 * 就是拒绝分支,连着读会把"有意放行"读成"既放行又拒绝",本维就在自己立项那一型上失明。
 */
function readChannelGuards(entries) {
  const guards = []
  const partial = []
  let scanned = 0
  for (const { file, src } of entries) {
    if (src === null || src === undefined) continue
    scanned++
    const masked = maskComments(src)
    const headerRe = /headers\s*(?:\[[^\]]*\])?\s*[\[.]\s*['"`]([\w-]*channel[\w-]*)['"`]\s*\]?/i
    const headerMatch = headerRe.exec(masked)
    if (!headerMatch) continue // 面上这个文件根本不读通道头 ⇒ 不是候选,不计 partial
    const headerLine = masked.slice(0, headerMatch.index).split('\n').length
    // 通道头必须被"判定"用过(同一文件里有拒绝分支),否则那只是个埋点/日志字段
    const enforces = /\bthrow\s+new\b|reply\.code\(\s*4|sendStatus\(\s*4|forbidden|denied/i.test(
      masked,
    )
    if (!enforces) {
      partial.push({
        file,
        line: headerLine,
        missing: '②-b 读到通道头但面上没有拒绝分支(那只是埋点/日志字段,不是校验)',
      })
      continue
    }
    const exempt = new Set()
    let wildcard = false
    let ambiguous = 0
    const methodRe = /if\s*\(([^)]*\.method[^)]*?)\)/gi
    let mm
    while ((mm = methodRe.exec(masked)) !== null) {
      const branch = sliceBranch(masked, mm.index + mm[0].length)
      const cmp = mm[1].match(/\.method\s*(===?|!==)\s*['"]([A-Za-z]+)['"]/)
      if (branch === null || !cmp) {
        ambiguous++
        continue
      }
      const negated = cmp[1] === '!=='
      const methodName = cmp[2].toUpperCase()
      const releases = /\breturn\b|\bnext\s*\(/.test(branch)
      const denies = /throw\s+new|reply\.code\(\s*4|sendStatus\(\s*4/i.test(branch)
      if (!negated && releases && !denies) exempt.add(methodName)
      else if (negated && denies && !releases) wildcard = true
      else ambiguous++
    }
    if (exempt.size === 0 && !wildcard) {
      partial.push({
        file,
        line: headerLine,
        missing: `②-c 守卫对所有方法都执行,没有有意放行的那一档${
          ambiguous > 0 ? `(另有 ${ambiguous} 处形态判不出,一条都不采用)` : ''
        }`,
      })
      continue
    }
    guards.push({
      file,
      line: headerLine,
      header: headerMatch[1],
      exemptMethods: wildcard ? ['*'] : [...exempt].sort(),
    })
  }
  return { guards, partial, scanned }
}

/**
 * 别名前缀字面量的**唯一**识别式(2026-09-29 票面 :85 补)。
 * 三处消费者(③ 的站点判据、③ 的"看得见但判不了"档、③' 的整条不可见档)必须共用这一份 ——
 * 本仓反复实录"同一条判据在两处各抄一遍必然漂移"(守门 131/135 的 code-mask 同一条规矩),
 * 而这里漂移的后果是三处对"什么算一处改写前缀调用"给出不同答案,账面却都自称判过。
 */
function aliasLiteralRe(rule) {
  return new RegExp(`['"\`]${rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^'"\`]*)?['"\`]`)
}

/**
 * ③ 面上是否存在一处真实调用点,**两种拼写各自都在册**(等价是活的,不是纸面的)。
 * 逐前端文件在**遮注释面**上找紧邻引号的 `${from}` 字面量(注释里的示例调用不得算站点 ——
 * 守门 70/131 同型:判据失效的表现永远是安静,而门给自己发合格证是最坏的一种),
 * 再经 `backendHasRoute`(与主对账共用同一份索引与判据,不另写一台匹配器)问两侧是否都在册:
 * 两侧都在册 ⇒ 等值对账一处都不报,而通道校验只在其中一条拼写上有效 ⇒ 这一格无人看守。
 * 方法取**唯一**实现 `inferMethodAtLine`(两处各写一遍必然漂移)。
 */
function findLiveAliasSites({ frontendFiles, alias, guards, hasRoute }) {
  const hits = []
  const seen = new Set()
  if (alias.rules.length === 0 || guards.length === 0) return hits
  for (const { file, src } of frontendFiles) {
    if (src === null || src === undefined) continue
    // transport 自己不是调用方:它体内的 `startsWith('/admin')` 是**改写规则**,把它当站点
    // 会让门把事实源读成消费者(自指型假阳;守门 131"判据看遮罩面"同一族)
    if (file === CLIENT_TRANSPORT_FILE) continue
    const maskedLines = maskComments(src).split('\n')
    const rawLines = src.split('\n')
    for (const rule of alias.rules) {
      const litRe = aliasLiteralRe(rule)
      maskedLines.forEach((line, idx) => {
        if (!litRe.test(line)) return
        const raw = (line.match(litRe)?.[0] || '').slice(1, -1) || rule.from
        const rewritten = rule.to + raw.slice(rule.from.length)
        const method = inferMethodAtLine(rawLines, idx)
        const rawLive = aliasPathCandidates(normalizeCallPath(raw)).some((c) =>
          hasRoute(method, c),
        )
        const rewrittenLive = aliasPathCandidates(normalizeCallPath(rewritten)).some((c) =>
          hasRoute(method, c),
        )
        if (!rawLive || !rewrittenLive) return // 单侧在册 = 既有等值对账已经看得见,不属本维
        for (const g of guards) {
          if (g.exemptMethods.length > 0 && !g.exemptMethods.includes(method)) continue
          if (method === 'ANY') continue // 动态方法读不出 ⇒ 不猜(交给未判定档点名)
          const key = `${file}:${idx + 1}:${raw}`
          if (seen.has(key)) continue
          seen.add(key)
          hits.push({
            file,
            line: idx + 1,
            method,
            raw,
            rewritten,
            guard: `${g.file}:${g.line}`,
            exempt: g.exemptMethods.join('/'),
          })
        }
      })
    }
  }
  return hits
}

/**
 * ③ 的另一半:`guards` 与改写档都在册,但一处站点都落不进射程时,**为什么落不进**必须报名。
 * 只看 `method === 'ANY'` 与"单侧在册"两档 —— 这两档是本维真正"看得见但判不了"的形态,
 * 与"这一族没人写"是两件事(把没判写成判过了,与本仓最高频失效型同源)。
 */
function collectAliasSiteUndetermined({ frontendFiles, alias, hasRoute }) {
  const out = []
  if (alias.rules.length === 0) return out
  for (const { file, src } of frontendFiles) {
    if (src === null || src === undefined) continue
    const maskedLines = maskComments(src).split('\n')
    const rawLines = src.split('\n')
    for (const rule of alias.rules) {
      const litRe = aliasLiteralRe(rule)
      maskedLines.forEach((line, idx) => {
        if (!litRe.test(line)) return
        const raw = (line.match(litRe)?.[0] || '').slice(1, -1) || rule.from
        const method = inferMethodAtLine(rawLines, idx)
        if (method === 'ANY') {
          out.push({ file, line: idx + 1, raw, reason: '方法是动态值,放行是否适用判不出' })
          return
        }
        const rawLive = aliasPathCandidates(normalizeCallPath(raw)).some((c) => hasRoute(method, c))
        const rewritten = rule.to + raw.slice(rule.from.length)
        const rewrittenLive = aliasPathCandidates(normalizeCallPath(rewritten)).some((c) =>
          hasRoute(method, c),
        )
        if (rawLive !== rewrittenLive) {
          out.push({
            file,
            line: idx + 1,
            raw,
            reason: `只有单侧在册(${rawLive ? '改写前' : '改写后'}),等价不成立;另一侧由既有死调用判据管`,
          })
        }
      })
    }
  }
  return out
}

/**
 * ③' 改写前缀字面量的**整条不可见**档(2026-09-29,票面 :85 三条现场里的第三条,登记为已知盲区)。
 * 主对账的抽取器 `pathRe` 要求**引号紧邻 `/api/`**,所以 `'/cozeZhsApi/cache/…'` 这类
 * "transport 会把它改写成 `/api/…`、字面量自己却没有 `/api/` 前缀"的调用点
 * **一条都不进调用集** —— 既不判死、也不落任何既有未判定桶,账面表现成"这一族已经对过账"的
 * 静默绿(实测:临时根里放 `fetchApi<AgentCategories>('/cozeZhsApi/cache/agent-category-dict/categories')`
 * 且两种拼写都不在册 ⇒ exit 0、api-client 死调用 0 处、未判定 0 处,三个数一起撒谎)。
 * 本档**不判红**:真仓 HEAD 面这类站点是存量,当场 blocking 就是一台与任何提交都无关的恒红门,
 * 唯一结局是逼人 `--no-verify`、连带废掉全部守门(§12e 同型)。它只做一件事 —— **报名**,
 * 让读到这一面的人先看见"这几处静态对账看不见",再谈裁决(不得把"没判"写成"判过了")。
 * 前缀事实源仍是 transport 现读的改写档(门内不得有第二张前缀表:T-CE-7 的同一条禁令);
 * 识别式与 ③ 共用 `aliasLiteralRe`,判在**遮注释面**(注释里逐字引用 JSX/字面量的说明不算站点)。
 */
function collectAliasLiteralBlindSites({ frontendFiles, alias }) {
  const out = []
  if (!alias || !alias.parsed || alias.rules.length === 0) return out
  for (const { file, src } of frontendFiles) {
    if (src === null || src === undefined) continue
    // transport 自己不是调用方:它体内的 `startsWith('/cozeZhsApi')` 是**改写规则定义**,
    // 把它当站点会让门把事实源读成消费者(与 findLiveAliasSites 同一条自指型假阳防护)
    if (file === CLIENT_TRANSPORT_FILE) continue
    const maskedLines = maskComments(src).split('\n')
    for (const rule of alias.rules) {
      const litRe = aliasLiteralRe(rule)
      maskedLines.forEach((line, idx) => {
        if (!litRe.test(line)) return
        const raw = (line.match(litRe)?.[0] || '').slice(1, -1) || rule.from
        out.push({
          file,
          line: idx + 1,
          raw,
          rewritten: rule.to + raw.slice(rule.from.length),
        })
      })
    }
  }
  return out
}


/**
 * 为什么必须有这一段:裸 `pathRe` 要求**引号紧邻 `/api/`**,而 HEAD 面实测 apps/cli 的出口形态是
 *   ① `` fetch(`${this.apiUrl}/api/registry/items?${qs}`) `` —— base 由插值提供(21 处),
 *   ② `` apiRequest(baseUrl, '/list', {…}) `` —— 路径住在**第二个实参**,真路径要拼上
 *      `createApiRequest(API_PREFIX, …)` 绑定的那个 `/api/...` 常量(约 10 个命令文件),
 *   ③ `` memorySend('POST', '/api/memory/save', body) `` —— method 是**位置实参**,而既有 method
 *      推断只认 `method: 'X'` 形态,于是三处 POST/DELETE 被当成 GET ⇒ 假死调用。
 * 三种形态在 web 端不存在(§3 规定端内走 api-client),所以这段是**端形态差异**的补丁,
 * 不是把判据放宽:解析不出来的一律落「未判定」并点名,绝不静默算通过,也绝不臆造路径。
 */
const CLI_END_NAME = 'cli'

/** 从 at 处(`` $ `` 紧跟 `` { ``)走到配对的 ``} ``;跳过引号内内容。-1 = 不配平,不猜 */
function skipTemplateGroup(text, at) {
  let depth = 0
  for (let i = at; i < text.length; i++) {
    const ch = text[i]
    if (ch === "'" || ch === '"') {
      const q = ch
      for (i += 1; i < text.length; i++) {
        if (text[i] === '\\') i++
        else if (text[i] === q) break
      }
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 字面量结束引号下标;模板串里的 `${...}` 整组跳过(嵌套引号不算结束)。-1 = 未闭合 */
function findLiteralEnd(text, openIdx) {
  const q = text[openIdx]
  for (let i = openIdx + 1; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\') {
      i++
      continue
    }
    if (q === '`' && ch === '$' && text[i + 1] === '{') {
      const end = skipTemplateGroup(text, i + 1)
      if (end === -1) return -1
      i = end
      continue
    }
    if (ch === q) return i
  }
  return -1
}

/** 合法路径字符 / 明确的终止符之外的字符 ⇒ 形态不认识 ⇒ null(不猜) */
const CLI_PATH_CHAR_RE = /[A-Za-z0-9/_.:\-]/
const CLI_PATH_STOP_CHARS = new Set(['`', "'", '"', ',', ')', ';', ' ', '\t', '\r', ']', '}'])

/**
 * 把一个字符串字面量**内容**(已剥外层引号)读成路径:
 *  - 前缀插值形态 `${base}/api/x` ⇒ 从 `/api/` 起算(②③之外的第 ① 型);
 *  - `/list?${qs}` / `/projects/${id}` ⇒ 逐段读,`${}` 按共享谓词退化为 '' 或 `:param`,`?` 之后整段丢;
 * 返回 `{ path, relative }`:relative=true 表示不以 `/api/` 起头(需拼文件级前缀)。
 * 解析不出 ⇒ null。
 */
function cliPathFromLiteralContent(content) {
  let s = content
  if (s.startsWith('${')) {
    const end = skipTemplateGroup(s, 1)
    if (end === -1) return null
    s = s.slice(end + 1)
    if (!s.startsWith('/api/')) return null // 前缀插值后面不是 /api/ ⇒ 拼不出,交人工
  }
  if (!s.startsWith('/')) return null
  let path = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '?') break // 查询串尾巴对路由比对无意义
    if (ch === '$' && s[i + 1] === '{') {
      const end = skipTemplateGroup(s, i + 1)
      if (end === -1) return null
      const expr = s.slice(i + 2, end)
      path += looksLikeQueryStringBuilder(expr) ? '' : ':param'
      i = end
      continue
    }
    if (CLI_PATH_CHAR_RE.test(ch)) {
      path += ch
      continue
    }
    if (CLI_PATH_STOP_CHARS.has(ch)) break
    return null
  }
  path = path.replace(/\/+$/, '')
  if (!path.startsWith('/') || path === '/') return null
  return { path, relative: !path.startsWith('/api/') }
}

/**
 * 文件级 `const NAME = createApiRequest(PREFIX_NAME, ms)` 绑定:
 * 只有当该文件里 PREFIX_NAME 恰好解析到**一个**以 `/api/` 起头的常量时才成立;
 * 多个候选 / 解析不到 ⇒ 返回 null(宁可不判,也不替文件挑一个前缀)。
 */
function resolveCliRequestFactory(src) {
  const callNames = new Set() // `const apiRequest = createApiRequest(API_PREFIX, ms)` 左边的可调用名
  const prefixNames = new Set() // 同一行的第二个实参 = 前缀常量名
  const factoryRe =
    /(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*createApiRequest\(\s*([A-Za-z0-9_$]+)\s*[,)]/g
  let m
  while ((m = factoryRe.exec(src)) !== null) {
    callNames.add(m[1])
    prefixNames.add(m[2])
  }
  if (callNames.size === 0) return null
  const consts = new Map() // 前缀常量名 -> { value, line }
  const constRe = /(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(['"])((?:[^'"\\]|\\.)*?)\2/g
  while ((m = constRe.exec(src)) !== null) {
    if (!prefixNames.has(m[1])) continue
    consts.set(m[1], { value: m[3], line: src.slice(0, m.index).split('\n').length })
  }
  const prefixes = new Set()
  const fragmentLines = new Set()
  for (const { value, line } of consts.values()) {
    if (!value.startsWith('/api/')) continue // 传 '' 的文件用完整 path,无需拼接
    prefixes.add(value.replace(/\/+$/, ''))
    fragmentLines.add(line)
  }
  // 0 个 ⇒ 该文件的前缀不是 /api/(完整 path 形态);>1 个 ⇒ 文件里有两张候选表,不猜。
  if (prefixes.size !== 1) return null
  return { callNames: [...callNames], prefix: [...prefixes][0], fragmentLines }
}

/** 位置实参形态的 method:`xxx('POST', '/api/x')` 或跨行 `xxx(\n  'POST',\n  '/api/x',` */
function cliPositionalMethod(lines, idx) {
  const cur = lines[idx] || ''
  const sameLine = /(['"`])(get|post|put|patch|delete)\1\s*,\s*['"`]\/api\//i.exec(cur)
  if (sameLine) return sameLine[2].toUpperCase()
  for (let i = idx - 1; i >= Math.max(0, idx - 2); i--) {
    // 上一行以 `'POST',` 收尾 = 正处在一个实参列表中间(强信号,不会撞到普通语句)
    const m = /(['"`])(get|post|put|patch|delete)\1\s*,\s*$/i.exec((lines[i] || '').trimEnd())
    if (m) return m[2].toUpperCase()
  }
  return null
}

// ===== CLI 变量路径的「一跳常量解析」(2026-09-27 判据扩面票) =====
/**
 * 背景:上一段把 `apiRequest(baseUrl, <变量>)` 整族记为「未判定」(HEAD 面实测 12 处)。
 * 逐条读原文后这些变量分两类(分类见交付报告):
 *   A. **同文件一条 const/let 声明**,初始化式是「单个字符串/模板字面量」或「三元 cond ? lit : lit」
 *      (两个分支各是一条字面量 ⇒ 该调用点运行时打的就是这两条路径之一,逐条对账不是猜);
 *   B. **跨文件 import 的导出常量**(同一被审面上的目标文件里 `export const X = <字面量>`)。
 * 判据红线:回溯不到 / 跨多跳(初始化式是函数调用)/ 运行时拼接 / 形态歧义 ⇒ **继续留在未判定
 * 桶并点名原因**。未判定可以不掉,但不许被伪装成"判过了",也不许造合成路径。
 * 取材纪律:跨文件回溯读的是**同一判定面**(prefetch 扩展批,见主流程),不落磁盘、不散派生 git。
 * 声明定位一律用 code-mask 的等长遮罩面(注释里的示例 `const path = '/ghost'` 不得被当真声明)。
 */
const CLI_VAR_DECL_WINDOW_LINES = 12
const CLI_VAR_INIT_MAX_CHARS = 400

function regexEscapeIdent(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 工厂调用正则的唯一构造点(提取器与预扫描共用,两处各写一份必然漂移) */
function cliFactoryCallRe(name) {
  return new RegExp(`\\b${name}\\(\\s*([^,()]*?)\\s*,\\s*`, 'g')
}

/** 第二实参起点处的「裸变量名 token」判定:唯一实现,提取器与预扫描共用 */
function cliVarArgToken(src, argStart) {
  const tok = src.slice(argStart, argStart + 60).split(/[,),]/)[0]
  return /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(tok) ? tok : null
}

/** 列出该文件里工厂调用第二实参为裸标识符(含成员访问)的 token —— 预扫描找 import 目标用 */
function cliVarArgNames(src, factory) {
  const names = []
  if (!factory) return names
  for (const name of factory.callNames) {
    const callRe = cliFactoryCallRe(name)
    let c
    while ((c = callRe.exec(src)) !== null) {
      const argStart = c.index + c[0].length
      const ch = src[argStart]
      if (ch === "'" || ch === '"' || ch === '`') continue // 字面量分支不占 import 名额
      const tok = cliVarArgToken(src, argStart)
      if (tok) names.push(tok)
    }
  }
  return names
}

/** 助手函数体的配平上限(超过即判不出,不做无界扫描)。 */
const CLI_HELPER_BODY_MAX = 4000

/**
 * 具名助手的函数体(大括号配平);配不平、超上限或本文件没有该声明 ⇒ null(不猜)。
 * 名字里的 `$` 要转义,否则会被当成正则元字符。
 */
function cliHelperBody(src, name) {
  const safe = name.replace(/\$/g, '\\$')
  const dm = new RegExp(`function\\s+${safe}\\s*\\(`).exec(src)
  if (!dm) return null
  const open = src.indexOf('{', dm.index + dm[0].length)
  if (open < 0) return null
  let depth = 0
  for (let j = open; j < src.length && j - open <= CLI_HELPER_BODY_MAX; j++) {
    const c = src[j]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return src.slice(open + 1, j)
    }
  }
  return null
}

/**
 * 初始化式是不是"只会产出查询串的助手调用"。三条同时成立才算:
 *  ① 形态是 `name(…)`,且**同文件**有该函数声明(import 进来的属二跳,刻意不追);
 *  ② 函数体里每条 return 都带字面量,且这些字面量要么为空、要么以 `?` 开头;
 *  ③ 至少一条以 `?` 开头(全是空串证不出形状)。
 * 任一条判不出 ⇒ null ⇒ 交回未判定。**为什么不按函数名认**(`buildQueryString` 一律当查询串):
 * 本仓同名助手有三份各自定义(chat-subcommands / memory / mcp-market),返回值形状不由名字保证 ——
 * 名字类判据必然漏掉名字最无辜的那一处,而按形状判可以同时放过三者并拦住"名字对、形状不对"。
 */
function cliQueryOnlyCallToShape(src, expr) {
  const m = /^([A-Za-z_$][\w$]*)\s*\(/.exec(expr)
  if (!m) return null
  const body = cliHelperBody(src, m[1])
  if (body === null) return null
  const returns = [...body.matchAll(/\breturn\b([^;\n]*)/g)].map((x) => x[1])
  if (!returns.length) return null
  let sawQuestion = false
  for (const r of returns) {
    const lits = [...r.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map((x) => x[1] ?? x[2] ?? x[3])
    if (!lits.length) return null
    for (const lit of lits) {
      if (lit === '') continue
      if (lit.startsWith('?')) {
        sawQuestion = true
        continue
      }
      return null
    }
  }
  return sawQuestion ? { queryOnly: true } : null
}

/**
 * 从 `=` 下标起读初始化式,只在**字面量外**收集分隔文本;返回形态分类:
 *  - 'literal'  : 恰好 1 条字面量且两侧无其他代码 ⇒ 单值;
 *  - 'ternary'  : 恰好 2 条字面量且外部文本形如 `cond ? : `(cond 里没有第二个 `?`/`:`);
 *  - 'none'     : 没有字面量(函数调用 / 数字 / 成员引用 ⇒ 判不出,交回未判定);
 *  - 'query-only':没有字面量,但初始化式是**同文件**助手的调用,而该助手每条 return 的字面量
 *                 要么空、要么以 `?` 开头 ⇒ 整条 URL 的路由部分就是工厂前缀(判据见
 *                 `cliQueryOnlyCallToShape`,按形状判而非按函数名判);
 *  - 'unknown'  : 拼接、嵌套三元、引号未配平等一切其他形态。
 * 不猜:配平不了(findLiteralEnd = -1)一律 unknown。
 */
function classifyCliVarInit(src, eqIdx, stopIdx) {
  let i = eqIdx + 1
  const segs = []
  const lits = []
  let cur = ''
  let guard = 0
  while (i < stopIdx && guard++ < CLI_VAR_INIT_MAX_CHARS) {
    const ch = src[i]
    if (ch === ';') break
    if (ch === "'" || ch === '"' || ch === '`') {
      const close = findLiteralEnd(src, i)
      if (close === -1 || close >= stopIdx) return { kind: 'unknown' }
      segs.push(cur)
      cur = ''
      lits.push(src.slice(i + 1, close))
      i = close + 1
      continue
    }
    cur += ch
    i++
  }
  segs.push(cur)
  if (lits.length === 0) {
    // 初始化式里没有字面量 ⇒ 先试"查询串助手"这一档(实测 cli 三处 `const qs = buildQueryString(query)`
    // 就是这一型:函数只可能返回 `?k=v` 或空串,所以整条 URL 的路由部分**恰好等于工厂前缀**)。
    // 这一档必须按助手返回值里的字面量形状判,不按函数名判 —— 名字相同而返回值不同的两份
    // buildQueryString 在本仓同时存在(chat-subcommands / mcp-market / memory 各自定义)。
    const expr = src.slice(eqIdx + 1, stopIdx).split(';')[0].trim()
    return cliQueryOnlyCallToShape(src, expr) ? { kind: 'query-only' } : { kind: 'none' }
  }
  if (lits.length === 1 && segs[0].trim() === '' && segs[1].trim() === '') {
    return { kind: 'literal', contents: lits }
  }
  if (lits.length === 2) {
    const s0 = segs[0].trim()
    const s1 = segs[1].trim()
    const s2 = (segs[2] || '').trim()
    if (
      s0.endsWith('?') &&
      !s0.slice(0, -1).includes('?') &&
      !s0.includes(':') &&
      s1 === ':' &&
      s2 === ''
    ) {
      return { kind: 'ternary', contents: lits }
    }
  }
  return { kind: 'unknown' }
}

/** 初始化式形态 → 完整候选路径集合(相对路径拼工厂前缀;任一分支解析不出 ⇒ 整条不判) */
function cliInitToPaths(shape, factory) {
  if (shape.kind === 'query-only') {
    // 助手只产 `?k=v` / 空串 ⇒ URL 的路由部分恰好就是工厂前缀本身。
    // 没有前缀可拼(该文件用完整路径调用)⇒ 证不出,交回未判定而不是猜一条根路径。
    if (!factory) return { reason: '查询串档而本文件无工厂前缀可拼' }
    const full = factory.prefix.replace(/\/+$/, '')
    if (!full) return { reason: '工厂前缀为空串,查询串档无法定路径' }
    return { paths: [full] }
  }
  if (shape.kind === 'none') {
    return { reason: '初始化式不是字面量(函数调用/二跳/运行时值)' }
  }
  if (shape.kind === 'unknown') {
    return { reason: '初始化式形态不认识(拼接/嵌套三元/引号不配平)' }
  }
  const out = []
  for (const content of shape.contents) {
    const parsed = cliPathFromLiteralContent(content)
    if (!parsed) return { reason: '字面量不是可识别的路径形状' }
    if (parsed.relative && !factory) return { reason: '相对路径而本文件无工厂前缀可拼' }
    out.push(parsed.relative ? `${factory.prefix}${parsed.path}` : parsed.path)
  }
  return { paths: [...new Set(out)].map((p) => p.replace(/\/+$/, '')) }
}

/**
 * 在**遮罩行**上向前找该变量的唯一声明:
 *  - 窗口 ≤ CLI_VAR_DECL_WINDOW_LINES 行(同函数体内声明紧邻使用;超窗不猜);
 *  - 声明行本身含 `function`/`=>` ⇒ 那是形参默认值不是常量,拒;
 *  - 声明与调用之间出现重赋值或函数边界 ⇒ 值不再由初始化式决定,拒。
 */
function findCliVarDeclLine(maskedLines, varName, callLineIdx) {
  const esc = regexEscapeIdent(varName)
  const declRe = new RegExp(`^[ \\t]*(?:const|let|var)\\s+${esc}\\s*=(?!=)`)
  const reassignRe = new RegExp(`^[ \\t]*${esc}\\s*(?:\\+=|-=|\\*=|\\/=|%=|\\|=|&=|\\?\\?=|=[^=>])`)
  const boundaryRe = /\bfunction\b|=>/
  const from = Math.max(0, callLineIdx - CLI_VAR_DECL_WINDOW_LINES)
  for (let i = callLineIdx - 1; i >= from; i--) {
    const ml = maskedLines[i] || ''
    if (declRe.test(ml)) {
      if (boundaryRe.test(ml)) return { kind: 'boundary' }
      for (let k = i + 1; k < callLineIdx; k++) {
        const l = maskedLines[k] || ''
        if (reassignRe.test(l)) return { kind: 'reassigned' }
        if (boundaryRe.test(l)) return { kind: 'boundary' }
      }
      return { kind: 'decl', line: i }
    }
    if (reassignRe.test(ml)) return { kind: 'reassigned' }
    if (boundaryRe.test(ml)) return { kind: 'boundary' }
  }
  return { kind: 'notfound' }
}

/** `import { A, B as C } from '<spec>'` 的本地名 → {spec, imported};名单来自遮罩面,串取自原文同位 */
function cliImportBindings(src, masked) {
  const out = new Map()
  // 判序注意:遮罩会把**整条说明符串(含引号)**抹成空格 —— 若正则尾上 `\s+`(或 `\s*`+引号),
  // 贪婪空白会一路吞到下一个真字符(分号),定位就错位、说明符整条丢失(第一版即在夹具上栽在这里,
  // 表现为"有 import 却永远走不到一跳")。所以锚点只写到 `from` 本身,说明符从**原文同位**再读。
  const re = /\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from/g
  let m
  while ((m = re.exec(masked)) !== null) {
    let fromPos = m.index + m[0].length
    while (fromPos < src.length && /\s/.test(src[fromPos])) fromPos++
    const q = src[fromPos]
    if (q !== "'" && q !== '"' && q !== '`') continue
    const close = findLiteralEnd(src, fromPos)
    if (close === -1) continue
    const spec = src.slice(fromPos + 1, close)
    for (const rawName of m[1].split(',')) {
      let n = rawName.trim()
      if (!n) continue
      n = n.replace(/^type\s+/, '').trim()
      const asParts = n.split(/\s+as\s+/)
      const local = (asParts.length > 1 ? asParts[1] : asParts[0]).trim()
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(local) && !out.has(local)) {
        out.set(local, { spec, imported: (asParts[0] || '').trim() })
      }
    }
  }
  return out
}

/** 相对 import 说明符 → 仓内候选路径(有序;`.js`↔`.ts` 是本仓 ESM 写法,多解时由调用方按存在性裁) */
function cliImportCandidates(fileRel, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return []
  const dir = fileRel.includes('/') ? fileRel.slice(0, fileRel.lastIndexOf('/')) : ''
  const parts = dir ? dir.split('/') : []
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  const base = parts.join('/')
  if (!base) return []
  const out = []
  if (base.endsWith('.js')) out.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`, base)
  else out.push(`${base}.ts`, `${base}.tsx`, base, `${base}/index.ts`)
  return out
}

/** 目标文件里的 `export const NAME = <字面量>`;唯一命中才算,多条同名导出按歧义拒 */
function cliExportedConstPath(targetSrc, exportedName) {
  const masked = maskCommentsAndStrings(targetSrc)
  const esc = regexEscapeIdent(exportedName)
  const re = new RegExp(`^[ \\t]*export\\s+(?:const|let|var)\\s+${esc}\\s*=(?!=)`, 'gm')
  const hits = []
  let m
  while ((m = re.exec(masked)) !== null) hits.push(m)
  if (hits.length === 0) {
    return { reason: '目标文件没有该名字的 `export const <字面量>`(可能是再导出/函数/类型)' }
  }
  if (hits.length > 1) return { reason: '目标文件里该导出名出现多次(歧义,不猜)' }
  const eqIdx = hits[0].index + hits[0][0].length - 1
  const stop = Math.min(targetSrc.length, eqIdx + CLI_VAR_INIT_MAX_CHARS)
  return classifyCliVarInit(targetSrc, eqIdx, stop)
}

/**
 * 一跳解析总出口。返回 `{ paths }`(全部分支都解析成功)或 `{ reason }`(交回未判定桶点名)。
 * `importInfo` = 预扫描算好的 {target(面内存在的目标路径|null), src(已 prefetch 的内容|null), imported}。
 */
function resolveCliVarPathOneHop({ src, maskedLines, lineStart, callLineIdx, varName, factory, importInfo }) {
  if (varName.includes('.')) {
    return { reason: '成员访问形态,不是可回溯的单一常量' }
  }
  const decl = findCliVarDeclLine(maskedLines, varName, callLineIdx)
  if (decl.kind === 'decl') {
    const maskedLine = maskedLines[decl.line] || ''
    const nameRe = new RegExp(`^[ \\t]*(?:const|let|var)\\s+${regexEscapeIdent(varName)}\\s*(=)`)
    const mm = nameRe.exec(maskedLine)
    if (!mm) return { reason: '声明行定位失败(遮罩与原文错位?)' }
    const eqIdx = lineStart[decl.line] + mm.index + mm[0].length - 1
    const stopIdx = Math.min(
      src.length,
      lineStart[decl.line] + CLI_VAR_INIT_MAX_CHARS * 4,
      lineStart[callLineIdx] ?? src.length,
    )
    const shape = classifyCliVarInit(src, eqIdx, stopIdx)
    const r = cliInitToPaths(shape, factory)
    if (r.paths) return r
    // 本地声明存在但解析不出 ⇒ 不回退到 import(同名 import 会被局部声明遮蔽,回退就是猜)
    return r
  }
  // 重赋值 ⇒ 局部变量存在但值不由初始化式决定;同名 import 已被它遮蔽,同样不许回退
  if (decl.kind === 'reassigned') {
    return { reason: '声明与调用之间存在重赋值,值不由初始化式决定' }
  }
  // 'boundary' / 'notfound' ⇒ 本地一跳不成立,但 import 绑定是模块作用域的,仍可一跳
  if (!importInfo) {
    return {
      reason:
        decl.kind === 'boundary'
          ? '窗口内跨函数边界(形参默认值不算常量),且无 import 绑定'
          : '一跳范围内没有常量声明(形参/运行时值/多跳)',
    }
  }
  if (importInfo.why) return { reason: importInfo.why }
  if (!importInfo.target) {
    return { reason: 'import 目标在本面解析不到唯一文件(多解或路径不在面里)' }
  }
  if (importInfo.src === null || importInfo.src === undefined) {
    return { reason: `import 目标取不到内容(${importInfo.target})` }
  }
  const shape = cliExportedConstPath(importInfo.src, importInfo.imported)
  return cliInitToPaths(shape, factory)
}

/** 行首偏移表(一次构建,一跳解析全程复用) */
function buildLineStartOffsets(src) {
  const offs = [0]
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') offs.push(i + 1)
  return offs
}

/**
 * CLI 三条形态的产出:`{ calls, unresolved }`。
 * `unresolved` = 调用点确实存在、路径一跳也回溯不出 ⇒ **未判定**(逐条点名 + 点名原因,不记通过)。
 * `importInfoByName`(2026-09-27 一跳解析):主流程预扫描算好的 Map(varName → {target, src, imported}),
 * 目标内容已在**同一判定面**的 prefetch 扩展批里读满;此处只消费,不再取材。
 */
function extractCliShapeCalls(src, file, factory, importInfoByName) {
  const calls = []
  const unresolved = []
  // 变量站点的总数与"解析出路径的条数"必须分别数:只报"未判定 0 处"分不清
  // "全解析出来了"与"这一族一条都没有"(空扫与真干净同形,是本仓最高频的假绿)。
  let varSites = 0
  let varPaths = 0
  const lines = src.split('\n')
  /** 遮罩面/行首偏移按文件惰性算一次:只有出现变量实参才需要(全量档不必为 0 站点付费) */
  let maskedView = null
  const getMaskedView = () => {
    if (!maskedView) {
      const masked = maskCommentsAndStrings(src)
      maskedView = { maskedLines: masked.split('\n'), lineStart: buildLineStartOffsets(src) }
    }
    return maskedView
  }
  // ① `${base}/api/x` —— 与通用 pathRe 天然不相交(那边要求引号紧邻 /api/)
  const tplRe = /(['"`])\$\{/g
  let m
  while ((m = tplRe.exec(src)) !== null) {
    const openIdx = m.index
    const close = findLiteralEnd(src, openIdx)
    if (close === -1) continue
    const content = src.slice(openIdx + 1, close)
    const parsed = cliPathFromLiteralContent(content)
    if (!parsed || parsed.relative) continue
    const line = src.slice(0, openIdx).split('\n').length
    // **有证据才认 method**:开引号前是 `(` 或 `,` ⇒ 该字面量是某个调用的实参,既有推断链
    // (同行 / 后 4 行 / 前 3 行)对它有效;否则它只是 `const url = \`…\`` 这类赋值,
    // 真正的请求在别处发 —— 此时默认 GET 会把"后端只有 POST"的真实路由判成死调用
    // (实测 voice/index.ts 的 `/api/voice/stt`)。判"不知道"用 ANY,
    // 它在本门的比对里等价于"任一拍即算注册",不制造假阳也不放过"整条路径没人注册"。
    const before = src.slice(Math.max(0, openIdx - 40), openIdx).trimEnd()
    const isCallArgument = before.endsWith('(') || before.endsWith(',')
    const method =
      cliPositionalMethod(lines, line - 1) ||
      (isCallArgument ? inferMethodAtLine(lines, line - 1) : 'ANY')
    calls.push({
      method,
      path: parsed.path,
      file,
      line,
      shape: 'cli-template-prefix',
    })
  }
  // ② `apiRequest(baseUrl, '/rel')` —— 拼文件级前缀;第三个实参里的 method 仍走既有推断
  if (factory) {
    for (const name of factory.callNames) {
      const callRe = cliFactoryCallRe(name)
      let c
      while ((c = callRe.exec(src)) !== null) {
        const argStart = c.index + c[0].length
        const ch = src[argStart]
        const line = src.slice(0, c.index).split('\n').length
        if (ch === "'" || ch === '"' || ch === '`') {
          const close = findLiteralEnd(src, argStart)
          if (close === -1) continue
          const content = src.slice(argStart + 1, close)
          const parsed = cliPathFromLiteralContent(content)
          if (!parsed) continue
          const full = parsed.relative ? `${factory.prefix}${parsed.path}` : parsed.path
          calls.push({
            method: cliPositionalMethod(lines, line - 1) || inferMethodAtLine(lines, line - 1),
            path: full.replace(/\/+$/, ''),
            file,
            line,
            shape: 'cli-prefixed-arg',
          })
          continue
        }
        // 第二个实参是变量 ⇒ 先做「一跳常量解析」;解析不出才点名(带原因)
        const tok = cliVarArgToken(src, argStart)
        if (tok) {
          const { maskedLines, lineStart } = getMaskedView()
          const r = resolveCliVarPathOneHop({
            src,
            maskedLines,
            lineStart,
            callLineIdx: line - 1,
            varName: tok,
            factory,
            importInfo: importInfoByName ? importInfoByName.get(tok) : undefined,
          })
          if (r.paths) {
            varSites++
            varPaths += r.paths.length
            const method = cliPositionalMethod(lines, line - 1) || inferMethodAtLine(lines, line - 1)
            for (const p of r.paths) {
              calls.push({ method, path: p, file, line, shape: 'cli-var-path-1hop' })
            }
          } else {
            varSites++
            unresolved.push({
              file,
              line,
              site: `${name}(${c[1]}, <变量路径>)`,
              reason: r.reason,
            })
          }
        }
      }
    }
  }
  return { calls, unresolved, varSites, varPaths }
}


/**
 * method 推断的**唯一**实现(2026-09-28 由 extractFrontendCalls 整体搬出,判据一字未改)。
 * 搬的理由:CLI 形态提取也要算同一件事,而"两处算同一件事必漂移"是本仓记过最多次的失败型。
 * 优先级:显式注释 `// method: POST` > 同行 method: > 向后第一个 method(遇调用收尾行即停)
 * > 向前最近 method > 同文件 wrapper 作用域 > 上下文启发式 > GET。
 * CLI 的位置实参形态由调用方先问 cliPositionalMethod(),命中才不走这里。
 */
function inferMethodAtLine(lines, idx) {
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
      const annotMatch = (lines[idx] || '').match(annotRe) || (lines[idx - 1] || '').match(annotRe)
      if (annotMatch) {
        method = annotMatch[1].toUpperCase()
      }
      return method
}

/**
 * 提取前端 API 调用路径，返回 [{ method, path, file, line }]
 * `opts.cli` = 该文件所属端已解析出的 createApiRequest 工厂绑定(仅 `apps/cli` 传),
 * 用于把"路径住在第二个实参"的形态拼回完整路径,并**不再把前缀常量声明行当调用点**
 * (它只是片段);其余端 opts 省略 ⇒ 行为与本笔改动前逐字相同。
 */
function extractFrontendCalls(src, file, opts) {
  const cli = opts && opts.cli ? opts.cli : null
  const cliShapes = Boolean(opts && opts.cliShapes)
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
      // 前缀常量声明行**不是调用点**:cli 端 `const API_PREFIX = '/api/chat'` 会被 pathRe 命中,
      // 而真路径要由 createApiRequest 工厂在第二个实参处拼出来(见 extractCliShapeCalls)。
      // 把片段当调用 = 凭空造一条谁都没发过的请求(实测 capabilities.ts 的 4 条真调用之上
      // 会多出一条 `/api/v1/ai/capabilities`)。只对 cli 端生效,其余端行为一字不变。
      if (cli && cli.fragmentLines.has(idx + 1)) continue
      // 下面两条 skip 的前提是「Next.js rewrite 把该前缀转发到 ai-service」——那是 **web 端**的
      // 部署形态。apps/cli 是直连后端进程(resolveBaseUrl 默认 http://localhost:8802),
      // 同一条字面量在 cli 侧就是一次真实调用,跳过 = 判据对整族隐身(实测 models.ts:242)。
      // /api/llm/* 走 Next.js rewrite 到 ai-service (port 8000)，不在 API 路由检查范围
      if (!cliShapes && rawPath.startsWith('/api/llm/')) continue
      // /api/voice/* 走 Next.js rewrite 到 ai-service 8803(2026-08-31 新增),
      // 与 /api/llm/ 同类——ai-service 路由由 router 扫描覆盖,此处纯字面量(如
      // voice-input.tsx STT_ENDPOINT 常量)会误报 GET /api/voice/stt
      if (!cliShapes && rawPath.startsWith('/api/voice/')) continue
      // method 推断与路径归一化都走文件级唯一出口(通用面与 CLI 形态面共用同一份实现)
      // cli 端额外允许两种"没有字面量 method:"的形态:
      //  ① **位置实参 method**:`memorySend('POST', '/api/memory/save', body)` —— 上一行以
      //     `'POST',` 收尾即认,普通语句撞不上;不补这条,三处 POST/DELETE 会被当 GET,
      //     把后端真实册的路由判成死调用(实测 tools/memory.ts:295/322/362)。
      //  ② **纯路径常量声明行**:`export const FOO_PATH = '/api/x'` —— 它是片段不是调用点,
      //     真调用在别处(`client.post(FOO_PATH, …)`),在那里静态读不到 method。
      //     这类刻意用 ANY(= 任一拍即算注册),而不是猜一个 GET。
      const isPathConstDecl =
        cliShapes &&
        /^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*['"`]\/api\/[^'"`]+['"`];?\s*$/.test(
          line,
        )
      const positional = cliShapes ? cliPositionalMethod(lines, idx) : null
      const method = positional || (isPathConstDecl ? 'ANY' : inferMethodAtLine(lines, idx))
      const normalized = normalizeCallPath(rawPath)
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
  // / sub (admin-sys/role-routes.ts:99 的嵌套 authUser 子路由)—— 2026-09-28 补:漏 `sub` 让
  //   嵌套子路由整型看不见,后端真实册的路由被判死(假阳性;方向:把正确实现钉红)。
  // 2026-09-28 再补 `(?:<[^<>()]*>)?`:**带泛型参数的注册** `server.post<{ Params: { source: X } }>(
  //   '/registry/webhook/:source', …)` 原本整型看不见(registry-sync.ts:374)—— 泛型夹在动词与
  //   `(` 之间,旧式要求两者紧邻。漏识别 = 前端真调用被报死调用(cli 的 registry-webhook 即此例)。
  const methodRe =
    /\b(?:server|s|sub|child|scope|authed|instance|app|fastify)\.(get|post|put|patch|delete)(?:<[^<>()]*>)?\(\s*['"`]([^'"`]*)['"`]/g
  // registerCrud(VAR, 'basePath', ...) 工厂: 展开为 GET list/GET :id/POST/PUT :id/DELETE :id/DELETE(batch) 共 6 条
  // (2026-09-28 根修:上一版漏了 GET `${basePath}/:id` —— 工厂在 admin/_shared.ts:276 真注册了
  //  getById,漏展开让三枚 GET :id 前端调用被假判死调用(台账豁免文件里 admin/courses 那条
  //  就是这一型的自首记录)。补上后该型不再复发, courses 豁免条目随之撤销——留着它=替
  //  已经不存在的分析器缺陷继续背书。)
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
      routes.push({ method: 'GET', localPath: `${basePath}/:id`, file: rel })
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
  // FastAPI 路由(ai-service):从 apps/ai-service/app/routers/*.py **与 app/api/**.py** 提取
  // 模式1: router = APIRouter(prefix="/api/...") → 记录 prefix
  // 模式2: @router.(get|post|...)("/path") → 记录 method + localPath
  // 完整路径 = prefix + localPath（main.py include_router 时统一挂载 /api 或 /api/v1 等）
  const routerFiles = [
    ...listFace(AI_SERVICE_ROUTERS_DIR, ['.py']),
    ...listFace(AI_SERVICE_API_DIR, ['.py']),
  ]
  if (routerFiles.length > 0) {
    // 1. 先从 main.py 提取 include_router(router.router, prefix="...") 映射
    const includePrefixMap = new Map() // router变量名 -> prefix
    /**
     * 1b. 同一份 include 面还有第二种写法:`from app.api.memory import router as memory_router`
     *     + `app.include_router(memory_router, prefix="/api")` —— 变量名不等于模块名,旧写法
     *     按"变量名 == 文件名"查,对这一族**整型失明**(实测 ai-service 的 app/api/memory.py
     *     九个端点全无挂载上下文,前端三条真调用被当死调用)。现按"点分模块路径"建映射,
     *     与被扫文件的路径同形 ⇒ 两个目录共用一条判据,不各写一份。
     */
    const modulePrefixMap = new Map() // 'app.api.memory' -> '/api'
    const mainSrc = readSource(AI_SERVICE_MAIN_FILE)
    if (mainSrc !== null && mainSrc !== undefined) {
      const includeRe =
        /app\.include_router\(\s*(\w+)\.router\s*,\s*prefix\s*=\s*['"`]([^'"`]+)['"`]/g
      let im
      while ((im = includeRe.exec(mainSrc)) !== null) {
        includePrefixMap.set(im[1], im[2])
      }
      const aliasToModule = new Map()
      const importRe = /from\s+(app[\w.]*)\s+import\s+(?:\w+\s*,\s*)?router\s+as\s+([A-Za-z0-9_]+)/g
      let ir
      while ((ir = importRe.exec(mainSrc)) !== null) aliasToModule.set(ir[2], ir[1])
      const bareRe =
        /app\.include_router\(\s*([A-Za-z0-9_]+)\s*(?:,\s*prefix\s*=\s*['"`]([^'"`]+)['"`])?/g
      let br
      while ((br = bareRe.exec(mainSrc)) !== null) {
        const mod = aliasToModule.get(br[1])
        if (!mod || !br[2]) continue
        modulePrefixMap.set(mod, br[2])
      }
    }
    for (const rel of routerFiles) {
      const src = readSource(rel)
      if (src === null || src === undefined) continue
      const fileName = rel.split('/').pop().replace(/\.py$/, '')
      const moduleKey = rel.replace(/^apps\/ai-service\//, '').replace(/\.py$/, '').replaceAll('/', '.')
      // 提取 router 的 prefix（文件内 APIRouter(prefix=...)）
      const prefixRe = /APIRouter\(\s*prefix\s*=\s*['"`]([^'"`]+)['"`]/g
      const routerPrefixes = []
      let pm
      while ((pm = prefixRe.exec(src)) !== null) {
        routerPrefixes.push(pm[1])
      }
      // 如果文件内无 prefix，尝试从 main.py include_router 映射获取(两种写法都查)
      if (routerPrefixes.length === 0) {
        const mounted = modulePrefixMap.get(moduleKey) ?? includePrefixMap.get(fileName)
        if (mounted) routerPrefixes.push(mounted)
      }
      // 如果仍无 prefix，使用空字符串
      const prefixes2 = routerPrefixes.length > 0 ? routerPrefixes : ['']
      // 提取 @router.xxx("/path") 注册
      const fastApiMethodRe =
        /@router\.(get|post|put|patch|delete|options)\(\s*['"`]([^'"`]+)['"`]/g
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
    eq('棘轮:超出基线额度 ⇒ exit 1 且点名新增', [1, true], [r.status, /新增/.test(r.out)])
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
      [r.status, /未判定/.test(r.out), /apps\/mobile-rn\/src\/dead\.ts/.test(r.out)],
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

  // ===== CLI 端形态提取(2026-09-28 随 apps/cli 纳入)=====
  // 空基线 = "该端存量为 0",所以夹具里任何被判红的 cli 调用都会 exit 1(棘轮有牙)。
  const EMPTY_BASELINE = JSON.stringify({ version: 1, perFileCount: {} })
  const cliFixture = (files) =>
    makeSelfTestRoot({
      [BASELINE_FILE_REL]: EMPTY_BASELINE,
      'apps/api/src/routes/none.ts': "server.get('/api/nothing', async () => ({}))\n",
      ...files,
    })
  // 16. `createApiRequest(API_PREFIX,…)` + `apiRequest(baseUrl,'/ghost')`:
  //     路径住在**第二个实参**,裸 pathRe 只会看见那行前缀常量 ⇒ 不补提取式就等于没扩面。
  const cliComposeRoot = cliFixture({
    'apps/cli/src/commands/probe.ts': [
      "const API_PREFIX = '/api/probe';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      "const r = await apiRequest(baseUrl, '/ghost', { method: 'POST' });",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliComposeRoot)
    eq(
      'CLI 前缀拼接:apiRequest(baseUrl, \'/ghost\') 必须被拼成 /api/probe/ghost 并判红',
      [1, true],
      [r.status, /POST \/api\/probe\/ghost/.test(r.out)],
    )
  } finally {
    rmScratch(cliComposeRoot)
  }
  // 17. 正例对照(证明拼接是对的,不是"造出路径就判红"):后端真注册 /api/probe/list ⇒ 不得报
  const cliComposeOkRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/probe.ts': "server.post('/api/probe/list', async () => ({}))\n",
    'apps/cli/src/commands/probe.ts': [
      "const API_PREFIX = '/api/probe';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      "const r = await apiRequest(baseUrl, '/list', { method: 'POST' });",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliComposeOkRoot)
    eq('CLI 前缀拼接的正例:已注册的 /api/probe/list 不得判红', [0, true], [
      r.status,
      /通过/.test(r.out),
    ])
  } finally {
    rmScratch(cliComposeOkRoot)
  }
  // 18. `${base}/api/x` 模板前缀插值:引号不紧邻路径 ⇒ 旧判据整型隐身(实测 21 处)
  const cliTplRoot = cliFixture({
    'apps/cli/src/lib/tpl.ts':
      "const res = await fetch(`${cfg.apiUrl}/api/tpl/ghost`, { method: 'POST' })\n",
  })
  try {
    const r = runGateIn(cliTplRoot)
    eq(
      'CLI 模板前缀插值必须被抽出并判红',
      [1, true],
      [r.status, /POST \/api\/tpl\/ghost/.test(r.out)],
    )
  } finally {
    rmScratch(cliTplRoot)
  }
  // 19. 位置实参 method:`memorySend('POST', path)` —— 不认它就把真存在的 POST 端点报成 GET 缺失
  const cliPosMethodRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/pos.ts': "server.post('/api/pos/save', async () => ({}))\n",
    'apps/cli/src/tools/pos.ts': [
      'async function call(body) {',
      '  const r = await memorySend(',
      "    'POST',",
      "    '/api/pos/save',",
      '    body,',
      '  );',
      '  return r',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliPosMethodRoot)
    eq('位置实参 method:后端只有 POST 时不得把该调用报成 GET', 0, r.status)
  } finally {
    rmScratch(cliPosMethodRoot)
  }
  // 19b. 同一条判据的反向:实参写 'DELETE' 而后端只有 POST ⇒ 必须点名 DELETE 并判红
  const cliPosMethodBadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/pos.ts': "server.post('/api/pos/save', async () => ({}))\n",
    'apps/cli/src/tools/pos.ts': [
      "const r = await memorySend('DELETE', '/api/pos/save', body)",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliPosMethodBadRoot)
    eq(
      '位置实参 method 反向:DELETE 调用不得被算成已注册',
      [1, true],
      [r.status, /DELETE \/api\/pos\/save/.test(r.out)],
    )
  } finally {
    rmScratch(cliPosMethodBadRoot)
  }
  // 20. 变量路径(`apiRequest(baseUrl, qs, …)`)⇒ **未判定**并点名,既不判红也不记通过
  const cliVarPathRoot = cliFixture({
    'apps/cli/src/commands/var.ts': [
      "const API_PREFIX = '/api/vartest';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'const qs = buildQs()',
      "const r = await apiRequest(baseUrl, qs, { apiKey })",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarPathRoot)
    eq(
      '变量路径 ⇒ 未判定 + 点名(不得静默算通过)',
      [0, true, true],
      [
        r.status,
        /未判定\(CLI 变量路径调用点\)/.test(r.out),
        /apps\/cli\/src\/commands\/var\.ts:4/.test(r.out),
      ],
    )
  } finally {
    rmScratch(cliVarPathRoot)
  }

  // ===== CLI 变量路径「一跳常量解析」(2026-09-27 判据扩面票;正反成对) =====
  // 21. 正例:同文件三元两条分支都注册 ⇒ 不得再落未判定、不得判红
  //     (夹具逐字取自 HEAD 面 context.ts 的 listContext/clearContext 形态)
  const cliTernaryOkRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/ter.ts': [
      "server.get('/api/tertest/list', async () => ({}))",
      "server.get('/api/tertest/session/:sessionId', async () => ({}))",
      '',
    ].join('\n'),
    'apps/cli/src/commands/ter.ts': [
      "const API_PREFIX = '/api/tertest';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function listT(baseUrl, session, apiKey) {',
      '  const path = session',
      '    ? `/session/${encodeURIComponent(session)}`',
      '    : `/list?pageSize=${LIST_PAGE_SIZE}`;',
      '  const resp = await apiRequest(baseUrl, path, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliTernaryOkRoot)
    /**
     * 第三条判据必须按**计数 ≥1** 判,不能按"这一行出不出现"判 —— 本条断言从写下起就恒红:
     * `6a5a53658` 在同一次提交里既写了它,又给门加了「0 也要出声」那两档输出行(区分"全部解析
     * 成功"与"一条都没枚举到",防空扫型假绿),于是门**总是**打印
     * `ℹ️ 未判定(CLI 变量路径调用点)0 处 —— …`,而这条断言要求它不出现。
     * 账面表现:HEAD 面 `--self-test` 与镜像的「--self-test 端到端 exit 0」一起红,与本票无关的
     * 每一次提交都被这台门自身钉住(§12f:恒红 ⇒ 各会话合法 --no-verify ⇒ 链上全部守门作废)。
     * 两档 0 形态的行文都以 `0 处` 开头,`[1-9]` 天然不匹配;真未判定那一档是
     * `未判定(CLI 变量路径调用点)<n> 处`,n≥1 ⇒ 匹配。**反向对照**由下一条(22)与 case 24/26 提供:
     * 那几条只注册一条分支 / 解析不到,必须仍然判出"1 处" —— 所以这一改不会把门改成恒绿。
     */
    eq(
      '三元两分支(都注册)⇒ 判红 0 且不再落未判定',
      [0, true, false],
      [r.status, /通过/.test(r.out), /未判定\(CLI 变量路径调用点\)[1-9]/.test(r.out)],
    )
  } finally {
    rmScratch(cliTernaryOkRoot)
  }
  // 22. 反例:三元只注册一条分支 ⇒ 另一条必须被点名判红(证明**每条分支都进对账**,不是挑一条)
  const cliTernaryBadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/ter.ts': "server.get('/api/tertest/list', async () => ({}))\n",
    'apps/cli/src/commands/ter.ts': [
      "const API_PREFIX = '/api/tertest';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function listT(baseUrl, session, apiKey) {',
      '  const path = session',
      '    ? `/session/${encodeURIComponent(session)}`',
      '    : `/list?pageSize=${LIST_PAGE_SIZE}`;',
      '  const resp = await apiRequest(baseUrl, path, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliTernaryBadRoot)
    eq(
      '三元未注册分支必须逐条判红并点名(GET /api/tertest/session/:param)',
      [1, true],
      [r.status, /GET \/api\/tertest\/session\/:param/.test(r.out)],
    )
  } finally {
    rmScratch(cliTernaryBadRoot)
  }
  // 23. 单行 const 模板 + 第三个实参 method:'POST' ⇒ 拼前缀、认 POST、判红点名
  const cliVarDeadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/none.ts': "server.get('/api/nothing', async () => ({}))\n",
    'apps/cli/src/commands/deadv.ts': [
      "const API_PREFIX = '/api/deadvar';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function go(baseUrl, x) {',
      '  const path = `/thing/${encodeURIComponent(x)}`;',
      "  const resp = await apiRequest(baseUrl, path, { method: 'POST' });",
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarDeadRoot)
    eq(
      '单值 const 模板解析后必须带真 method 参与对账(POST /api/deadvar/thing/:param)',
      [1, true],
      [r.status, /POST \/api\/deadvar\/thing\/:param/.test(r.out)],
    )
  } finally {
    rmScratch(cliVarDeadRoot)
  }
  // 23b. 反向锁:声明与调用之间出现重赋值 ⇒ 不许按初始化式判(回到未判定 + 点名原因)
  const cliVarReassignRoot = cliFixture({
    'apps/cli/src/commands/reas.ts': [
      "const API_PREFIX = '/api/reas';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'const path = `/one`;',
      'path = other();',
      'const r = await apiRequest(baseUrl, path, { apiKey })',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarReassignRoot)
    eq(
      '声明后被重赋值的变量必须留在未判定(初始化式不再决定调用值)',
      [0, true, true],
      [r.status, /未判定\(CLI 变量路径调用点\)/.test(r.out), /重赋值/.test(r.out)],
    )
  } finally {
    rmScratch(cliVarReassignRoot)
  }
  // 23c. 形参不归因:函数签名的形参名与别处的 const 同名,不许把别人的常量算到这一站
  const cliVarParamRoot = cliFixture({
    'apps/cli/src/commands/prm.ts': [
      "const API_PREFIX = '/api/prm';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      "async function outer() { const path = '/inner-const-not-mine'; }",
      'async function inner(baseUrl, path) {',
      '  const resp = await apiRequest(baseUrl, path, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarParamRoot)
    eq(
      '形参 path 的调用点 ⇒ 未判定(跨函数边界不猜),且不得拼出 /api/prm/inner-const-not-mine',
      [0, true, false],
      [
        r.status,
        /未判定\(CLI 变量路径调用点\)/.test(r.out),
        /prm\/inner-const-not-mine/.test(r.out),
      ],
    )
  } finally {
    rmScratch(cliVarParamRoot)
  }
  // 24. import 一跳:目标文件 export const = 绝对路径字面量 ⇒ 拼进对账(正反成对)
  const impFiles = {
    'apps/cli/src/lib/impv.ts': "export const STATUS_PATH = '/api/impv/status';\n",
    'apps/cli/src/commands/imp.ts': [
      "import { STATUS_PATH } from '../lib/impv.js';",
      "const API_PREFIX = '/api/impv';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'async function go(baseUrl, apiKey) {',
      '  const resp = await apiRequest(baseUrl, STATUS_PATH, { apiKey });',
      '  return resp',
      '}',
      '',
    ].join('\n'),
  }
  const cliImportOkRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/impv.ts': "server.get('/api/impv/status', async () => ({}))\n",
    ...impFiles,
  })
  try {
    const r = runGateIn(cliImportOkRoot)
    eq(
      'import 一跳解析 + 已注册 ⇒ exit 0 且该站不落未判定',
      [0, false],
      [r.status, /imp\.ts:5/.test(r.out) && /未判定\(CLI 变量路径调用点\)/.test(r.out)],
    )
  } finally {
    rmScratch(cliImportOkRoot)
  }
  const cliImportBadRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/none.ts': "server.get('/api/nothing', async () => ({}))\n",
    ...impFiles,
  })
  try {
    const r = runGateIn(cliImportBadRoot)
    eq(
      'import 一跳解析 + 未注册 ⇒ 必须判红点名(证明 import 面真的进了对账)',
      [1, true],
      [r.status, /GET \/api\/impv\/status @ apps\/cli\/src\/commands\/imp\.ts:5/.test(r.out)],
    )
  } finally {
    rmScratch(cliImportBadRoot)
  }
  // 25. import 目标不在面上(路径写歪)⇒ 仍是未判定并点名原因,不得静默也不得造路径
  const cliImportMissRoot = cliFixture({
    'apps/cli/src/commands/impmiss.ts': [
      "import { GONE_PATH } from '../lib/nope.js';",
      "const API_PREFIX = '/api/impmiss';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      'const r = await apiRequest(baseUrl, GONE_PATH, { apiKey })',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliImportMissRoot)
    eq(
      'import 目标解析不到 ⇒ 未判定 + 点名(import 目标),不判红不记通过',
      [0, true, true],
      [
        r.status,
        /未判定\(CLI 变量路径调用点\)1 处/.test(r.out),
        /import 目标/.test(r.out),
      ],
    )
  } finally {
    rmScratch(cliImportMissRoot)
  }
  // 26. 注释里的示例声明不得被当真声明(端到端证明一跳解析确实工作**在遮罩面**上):
  //     块注释里放一条**行首即 `const qs = '/api/...'`** 的示例 —— 若解析器按原文扫,它会命中这条
  //     "声明"并把站点判掉;遮罩生效时该行整行变空白,站点必须仍落未判定。
  //     (注释行本身会被通用 pathRe 当 ANY 字面量,所以后端注册该路径,保证退出码只由这一格决定)
  const cliVarCommentRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    'apps/api/src/routes/cmt.ts': "server.get('/api/cmt/from-comment', async () => ({}))\n",
    'apps/cli/src/commands/cmt.ts': [
      "const API_PREFIX = '/api/cmt';",
      'const apiRequest = createApiRequest(API_PREFIX, 1000);',
      '/*',
      "const qs = '/api/cmt/from-comment';",
      '*/',
      'const r = await apiRequest(baseUrl, qs, { apiKey })',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(cliVarCommentRoot)
    eq(
      '块注释形态的 const 不得被一跳解析命中(该站仍是未判定 1 处)',
      [0, true],
      [r.status, /未判定\(CLI 变量路径调用点\)1 处/.test(r.out)],
    )
  } finally {
    rmScratch(cliVarCommentRoot)
  }
  // ===== 通道等价(CE)族(2026-09-29,G-466 换维;正反成对)=====
  /**
   * 夹具逐字照 HEAD 面 `packages/api-client/src/client.ts:404-416` 的 normalizeUrl 形态写,
   * 只把改写档换成票面那一型(`/admin`→`/console`),守卫形态照 Fastify preHandler 真写法。
   * 门读的是**这些文件的内容**,不是自带的第二张表(反向锁见镜像 T-CE-1)。
   */
  const CE_TRANSPORT = [
    'export async function fetchApi<T>(url: string): Promise<T> {',
    '  const normalizedUrl = normalizeUrl(url)',
    '  return normalizedUrl as T',
    '}',
    'function normalizeUrl(url: string): string {',
    '  if (/^https?:\\/\\//i.test(url)) return url',
    '  const normalized = (() => {',
    "    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url",
    "    if (url.startsWith('/admin')) {",
    "      return url.replace(/^\\/admin/, '/console')",
    '    }',
    "    if (url.startsWith('/')) return `/api${url}`",
    '    return `/api/${url}`',
    '  })()',
    '  return normalized',
    '}',
    '',
  ].join('\n')
  const CE_GUARD_EXEMPT = [
    'export async function clientChannelGuard(server) {',
    "  server.addHook('preHandler', async (req, reply) => {",
    "    const channel = req.headers['x-client-channel']",
    "    const enforce = process.env.CHANNEL_ENFORCE === '1'",
    '    if (!enforce) return',
    "    if (req.method === 'GET') return",
    "    if (channel !== 'admin') {",
    "      return reply.code(403).send({ message: 'forbidden channel' })",
    '    }',
    '  })',
    '}',
    '',
  ].join('\n')
  /** 同一个守卫,但**没有**按方法放行的那一档 ⇒ ② 不成立 ⇒ 该维必须落未判定而不是判红 */
  const CE_GUARD_NO_EXEMPT = [
    'export async function clientChannelGuard(server) {',
    "  server.addHook('preHandler', async (req, reply) => {",
    "    const channel = req.headers['x-client-channel']",
    "    if (channel !== 'admin') {",
    "      return reply.code(403).send({ message: 'forbidden channel' })",
    '    }',
    '  })',
    '}',
    '',
  ].join('\n')
  const CE_ROUTES = [
    // 这条 2 段路由是给**夹具自己**的:transport 夹具里的 `return \`/api${url}\`` 会被既有的
    // 字面量提取式收成一处 `GET /api/:param` 调用(真仓里它命中成百条 2 段路由所以不报),
    // 临时根里若没有一条 2 段路由,夹具自己就会先冒一枚与 CE 维无关的死调用红。
    "server.get('/api/nothing', async () => ({}))",
    "server.get('/api/admin/secret', async () => ({}))",
    "server.get('/api/console/secret', async () => ({}))",
    '',
  ].join('\n')
  const CE_SITE = "export const load = () => fetchApi('/admin/secret')\n"
  const CE_EMPTY_LEDGER = JSON.stringify({ version: 1, declared: [] })
  const ceRoot = (files) =>
    makeSelfTestRoot({
      [BASELINE_FILE_REL]: EMPTY_BASELINE,
      [CHANNEL_EQUIV_BASELINE_REL]: CE_EMPTY_LEDGER,
      [CLIENT_TRANSPORT_FILE]: CE_TRANSPORT,
      'apps/api/src/plugins/ce-guard.ts': CE_GUARD_EXEMPT,
      'apps/api/src/routes/ce.ts': CE_ROUTES,
      'apps/mobile-rn/src/screens/Ce.tsx': CE_SITE,
      ...files,
    })
  // 27. 阳性对照(本票立项那一型):三条件齐备 ⇒ 判红并点名"两种拼写等价"
  const ceLiveRoot = ceRoot({})
  try {
    const r = runGateIn(ceLiveRoot)
    eq(
      '通道等价:改写档+放行档+两侧都在册的站点 ⇒ exit 1 且点名等价对',
      [1, true],
      [r.status, /\/admin\/secret ≡ \/console\/secret/.test(r.out)],
    )
  } finally {
    rmScratch(ceLiveRoot)
  }
  // 28. 反向对照一:守卫对所有方法都执行(没有有意放行)⇒ ②不成立,不得判红
  const ceNoExemptRoot = ceRoot({ 'apps/api/src/plugins/ce-guard.ts': CE_GUARD_NO_EXEMPT })
  try {
    const r = runGateIn(ceNoExemptRoot)
    eq(
      '通道等价:缺② ⇒ 未判定并点名,不判红也不记通过',
      [0, true, false],
      [
        r.status,
        /未判定\(通道等价 CE\):②/.test(r.out),
        /\/admin\/secret ≡ \/console\/secret/.test(r.out),
      ],
    )
  } finally {
    rmScratch(ceNoExemptRoot)
  }
  // 29. 反向对照二(本就合法的一档):台账逐条写明理由 ⇒ 判绿,并且要说清是"已交代"
  const ceDeclaredRoot = ceRoot({
    [CHANNEL_EQUIV_BASELINE_REL]: JSON.stringify({
      version: 1,
      declared: [
        {
          file: 'apps/mobile-rn/src/screens/Ce.tsx',
          path: '/admin/secret',
          reason: '只读公开路由:该入口返回的字段与 /console 侧完全同集合,无租户数据',
        },
      ],
    }),
  })
  try {
    const r = runGateIn(ceDeclaredRoot)
    eq(
      '通道等价:站点已在台账逐条写明理由 ⇒ exit 0 且报"已交代"',
      [0, true],
      [r.status, /已在 .*declared|已交代|逐条写明理由/.test(r.out)],
    )
  } finally {
    rmScratch(ceDeclaredRoot)
  }
  // 30. 反向对照三:只有单侧在册 = 等价不成立(那是既有死调用判据的地盘),本维不得冒红
  const ceOneSideRoot = ceRoot({
    'apps/api/src/routes/ce.ts': [
      "server.get('/api/nothing', async () => ({}))",
      "server.get('/api/admin/secret', async () => ({}))",
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(ceOneSideRoot)
    eq(
      '通道等价:单侧在册 ⇒ 未判定③并点名"只有单侧在册",不判红',
      [0, true, true],
      [
        r.status,
        /未判定\(通道等价 CE\):③/.test(r.out),
        /只有单侧在册/.test(r.out),
      ],
    )
  } finally {
    rmScratch(ceOneSideRoot)
  }
  // 31. 遮噪证明:通道头与放行档**只写在注释里** ⇒ ②不成立(注释不得给实现发合格证)
  const ceCommentRoot = ceRoot({
    'apps/api/src/plugins/ce-guard.ts': [
      '/**',
      " * 设计稿(未实现):const channel = req.headers['x-client-channel']",
      " * 曾计划 if (req.method === 'GET') return,现按全方法校验",
      ' */',
      'export async function clientChannelGuard(server) {}',
      '',
    ].join('\n'),
  })
  try {
    const r = runGateIn(ceCommentRoot)
    eq(
      '通道等价:注释里的通道头/放行档不得被当实现 ⇒ 未判定,不判红',
      [0, true, false],
      [
        r.status,
        /未判定\(通道等价 CE\)/.test(r.out),
        /\/admin\/secret ≡ \/console\/secret/.test(r.out),
      ],
    )
  } finally {
    rmScratch(ceCommentRoot)
  }
  // 32. 事实源①取不到 ⇒ 整维未判定并点名"取不到内容",不得静默也不得冒红
  const ceNoTransportRoot = makeSelfTestRoot({
    [BASELINE_FILE_REL]: EMPTY_BASELINE,
    [CHANNEL_EQUIV_BASELINE_REL]: CE_EMPTY_LEDGER,
    'apps/api/src/plugins/ce-guard.ts': CE_GUARD_EXEMPT,
    'apps/api/src/routes/ce.ts': CE_ROUTES,
    'apps/mobile-rn/src/screens/Ce.tsx': CE_SITE,
  })
  try {
    const r = runGateIn(ceNoTransportRoot)
    eq(
      '通道等价:transport 取不到 ⇒ 未判定①点名"取不到内容",不判红不记通过',
      [0, true, true],
      [r.status, /未判定\(通道等价 CE\):①/.test(r.out), /取不到内容/.test(r.out)],
    )
  } finally {
    rmScratch(ceNoTransportRoot)
  }
  return { failures, assertions }
}

if (process.argv.includes('--self-test')) {
  const { failures: selfFailures, assertions } = runSelfTest()
  if (selfFailures.length === 0) {
    console.log(`${C.green}[API 路由比对] --self-test 通过(${assertions} 例判据断言)${C.reset}`)
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
    console.log(
      `${C.red}[API 路由比对] ⚠️ 无法判定(不是"没有违规",是"取不到判定面"):${C.reset} ${e.message}`,
    )
    process.exit(2)
  }
  throw e
})

const WARN_ONLY = process.argv.includes('--warn-only')
const UPDATE_BASELINE = process.argv.includes('--update-baseline')
// 1510 行的提示语早就指向 --dump-missing,但该旗从未实现(2026-09-28 现读:全文件只有
// 提示语这一处提到它)⇒ 提示是个死指针,"逐条见 X"而 X 不存在 = 把人往不存在的出口引。
// 现把它装上:逐条打印**所有**面上量到的死调用(web 零容忍 + 棘轮存量/新增/无锚点),
// 判据/退出码/豁免一字不动 —— 这是清账工具的取数口,不是第二台尺子。
const DUMP_MISSING = process.argv.includes('--dump-missing')

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
  // 通道等价维的三份输入:①归一实现、通道守卫面(整目录已在下一行)、首锚台账。
  // 必须与其余内容**同面同轮**读满 —— 分开取会产出自洽而基准错位的尺子(守门 101/116 同型)。
  CLIENT_TRANSPORT_FILE,
  CHANNEL_EQUIV_BASELINE_REL,
  ...listFace(API_ROUTES_DIR, ['.ts']),
  ...listFace(API_PLUGINS_DIR, ['.ts']),
  ...listFace(AI_SERVICE_ROUTERS_DIR, ['.py']),
  ...listFace(AI_SERVICE_API_DIR, ['.py']),
])
prefetch([...frontendRels, ...baseInputs])

/**
 * ===== CLI 变量路径 import 一跳的目标扩展预读(2026-09-27 判据扩面票) =====
 * 「一跳」的目标文件必须与其余内容**同判定面**:这里用一次 `cat-file --batch-check` 问候选
 * 存在性(head/staged 档)或 existsSync(工作树人工档),只把**面上存在**的那份加入第二个
 * prefetch 批。说清一个措辞:文件头"一次 cat-file --batch 读满"的不变量是**同面** —— 这次
 * 扩展批仍是同一 FACE 的显式批量读(规格与首批同法构造),不是"现场补一次散派生"那种被禁止
 * 的形态(那才会把退化伪装成正常)。为什么必须预扫描后再读:哪些 import 要拉是**内容决定**的,
 * 只有先读完 CLI 文件本身才知道。
 * 结果 `cliImportInfo: Map(fileRel -> Map(varName -> {target, src, imported} | null))`
 * 由主循环原样喂给 extractCliShapeCalls —— 解析判据只有 extractCliShapeCalls 一处消费方。
 */
const cliImportInfo = new Map()
{
  const pending = [] // { map, varName, candidates[] }
  for (const rel of frontendRels) {
    if (endByFile.get(rel) !== CLI_END_NAME) continue
    const src = readSource(rel)
    if (src === null || src === undefined) continue
    const factory = resolveCliRequestFactory(src)
    if (!factory) continue
    const names = [...new Set(cliVarArgNames(src, factory))]
    if (names.length === 0) continue
    const bindings = cliImportBindings(src, maskCommentsAndStrings(src))
    const map = new Map()
    cliImportInfo.set(rel, map)
    for (const n of names) {
      const b = bindings.get(n)
      if (!b) {
        map.set(n, null) // 没有 import 绑定:本地一跳由解析器自己判,这里无需预读
        continue
      }
      const cands = cliImportCandidates(rel, b.spec)
      if (cands.length === 0) {
        map.set(n, {
          target: null,
          src: null,
          imported: b.imported,
          spec: b.spec,
          why: 'import 说明符非相对路径(跨包/别名刻意不在一跳射程)',
        })
        continue
      }
      pending.push({ map, varName: n, candidates: cands, imported: b.imported, spec: b.spec })
    }
  }
  if (pending.length > 0) {
    const specs = []
    for (const p of pending) {
      for (const cand of p.candidates) {
        specs.push({ key: `${p.varName}::${cand}`, path: cand })
      }
    }
    const existing = new Map() // key -> 是否有面内容
    if (FACE === 'worktree') {
      for (const s of specs) {
        existing.set(
          s.key,
          existsSync(join(ROOT, ...s.path.split('/'))) &&
            statSync(join(ROOT, ...s.path.split('/'))).isFile(),
        )
      }
    } else {
      const oids = catBatchOids(
        ROOT,
        specs.map((s) => (FACE === 'staged' ? `:${s.path}` : `HEAD:${s.path}`)),
        { timeout: GIT_BATCH_TIMEOUT },
      )
      specs.forEach((s) => {
        const spec = FACE === 'staged' ? `:${s.path}` : `HEAD:${s.path}`
        existing.set(s.key, Boolean(oids.get(spec)))
      })
    }
    const toFetch = new Set()
    for (const p of pending) {
      const hits = p.candidates.filter((c) => existing.get(`${p.varName}::${c}`))
      if (hits.length === 1) {
        p.map.set(p.varName, { target: hits[0], src: null, imported: p.imported, spec: p.spec })
        toFetch.add(hits[0])
      } else if (hits.length > 1) {
        // 同名多解(.ts 与 .js 并存等)—— 挑一个就是猜,交回未判定点名
        p.map.set(p.varName, {
          target: null,
          src: null,
          imported: p.imported,
          spec: p.spec,
          why: 'import 目标在面上多解(候选同名不止一个),不猜',
        })
      } else {
        p.map.set(p.varName, {
          target: null,
          src: null,
          imported: p.imported,
          spec: p.spec,
          why: 'import 目标文件不在本面(路径写歪或文件搬家)',
        })
      }
    }
    if (toFetch.size > 0) {
      prefetch([...toFetch])
      for (const [, map] of cliImportInfo) {
        for (const info of map.values()) {
          if (info && info.target && info.src === null) info.src = readSource(info.target)
        }
      }
    }
  }
}

const { routes: backendRoutes, prefixes } = extractBackendRoutes()
const compositePrefixes = buildCompositePrefixes(prefixes)

/**
 * 带值旗标的取值(2026-09-28 修 `--dump-* --staged` 这一型;口径照抄枚 `380431ffc`,不另发明):
 * **紧邻的下一个 token 必须存在且不以 `-` 开头**才算该旗标的值,否则视为"没带值"。
 * `scripts/guardian-runner.mjs` 会给每道门追加 `--staged`,而旧写法是**无条件**的
 * `process.argv[idx + 1]`,于是 `--dump-missing --staged` 把 `--staged` 当输出路径,
 * 在当前工作目录写出一个名叫 `--staged` 的文件(违反 AGENTS §28 根目录整洁;
 * `check-root-dir-clean --staged` 看不见未跟踪产物,不会自己现形),同时 stdout 结论照打
 * ⇒ 调用方以为没写盘。无效值(token 存在但以 `-` 开头)**不得静默按未给值处理**:
 * 点名一行到 stderr。判据、棘轮、`--staged` 降级语义、退出码、文件档字节形态一字未动。
 * 两处 `--dump-*` 站点共用这一份实现,不得各写一遍(两处算同一件事必漂移)。
 */
function dumpFlagValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i === -1) return null
  const v = process.argv[i + 1]
  if (typeof v === 'string' && v !== '') {
    if (!v.startsWith('-')) return v
    console.error(`[API 路由比对] 忽略无效的 ${flag} 值: ${v}`)
  }
  return null
}

const backendDumpPath = dumpFlagValue('--dump-backend')
if (backendDumpPath) {
  writeFileSync(
    backendDumpPath,
    JSON.stringify(
      backendRoutes.map((r) => {
        const fullPaths = compositePrefixes.map(
          (p) => `${r.method} ${normalizePath(p, r.localPath)}`,
        )
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
/** CLI 端"调用点确实在、路径住在变量里"的站点 ⇒ 未判定,逐条点名(不记通过、也不判红) */
const cliUnresolved = []
/** 变量站点总数 / 一跳解析出的路径条数(报告行要区分"全解析出来"与"一条都没有")。 */
let cliVarSites = 0
let cliVarPaths = 0
for (const rel of frontendRels) {
  const end = endByFile.get(rel)
  const isCli = end === CLI_END_NAME
  const st = endStats.get(end)
  st.files++
  const src = readSource(rel)
  if (src === null || src === undefined) {
    st.unreadable++
    unreadCode.push(rel)
    continue
  }
  const cliFactory = isCli ? resolveCliRequestFactory(src) : null
  const calls = extractFrontendCalls(src, rel, isCli ? { cli: cliFactory, cliShapes: true } : undefined)
  if (isCli) {
    // ① 型(`${base}/api/x`)不需要工厂绑定就能判,所以**不绑在 cliFactory 上** ——
    //    第一版把整段挂在 `if (cliFactory)` 里,结果 registry-client.ts 等 11 个文件
    //    一处没抽(扩了面却仍失明,正是本票要防的那一型)。
    const extra = extractCliShapeCalls(src, rel, cliFactory, cliImportInfo.get(rel))
    calls.push(...extra.calls)
    cliUnresolved.push(...extra.unresolved)
    cliVarSites += extra.varSites
    cliVarPaths += extra.varPaths
  }
  st.calls += calls.length
  if (calls.length === 0 && TRANSPORT_RE.test(src)) st.shapeUnknown++
  allCalls.push(...calls)
}

console.log(`${C.dim}[API 路由比对] 前端 API 调用: ${allCalls.length} 处${C.reset}`)
if (frontendRels.length > 0) {
  /**
   * "某端本轮一个调用点都没抽出来"必须与"该端已判过"分开说 —— `packages/app` 就是这一格:
   * HEAD 面 224 个受管文件、`/api/` 字面量 5 处**全在注释里** ⇒ 0 调用点。账面 exit 0 而结论行
   * 什么都不说,读报告的人就会把"没有红"当成"这一端对齐过了"(本仓最高频失效型:判据失效的
   * 表现永远是安静)。刻意**不改退出码**:这些端在多数提交里本就没有调用点,为此判红就是一台
   * 与改动无关的恒红门,唯一结局是逼人 `--no-verify`(§12e 同型)⇒ 只在结论行喊。
   */
  const silentEnds = FRONTEND_ENDS.filter((e) => endStats.get(e.name).calls === 0)
  if (silentEnds.length > 0) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 本轮 0 个调用点的端:${silentEnds
        .map((e) => `${e.name}(文件 ${endStats.get(e.name).files})`)
        .join(' / ')} —— 无判据不等于已判过${C.reset}`,
    )
  }
}
const faceEmptyEnds = FRONTEND_ENDS.filter((e) => endStats.get(e.name).files === 0)
if (faceEmptyEnds.length > 0) {
  // 面里**一个受管源文件都没枚举到** ≠ 这一端干净:要么是目录搬走了,要么是枚举失效。
  // 判红会把"与本次提交无关的目录形态"算到提交者头上(恒红门,§12e),所以走 exit 0 + 大声点名,
  // 但结论行必须带上这条 —— 否则 `app-shared:文件 0 / 调用 0` 读起来就像"已判过且没问题"。
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定:${faceEmptyEnds.map((e) => e.name).join(' / ')} 在 ${FACE} 面枚举到 0 个受管源文件(枚举失效或目录搬家,本轮对这一格没有判据)${C.reset}`,
  )
}
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
 * 「这条路径在这个 method 下在册吗」—— 与主对账循环**共用一份索引与判据**的唯一查询出口
 * (通道等价维要问的就是同一件事,另写一遍必然与主循环漂移;主循环本身一字未动)。
 */
function backendHasRoute(method, callPath) {
  const f = callPath.replace(/\/$/, '')
  const fParts = f.split('/')
  if (exactKeys.has(`${method} ${f}`)) return true
  const byMethodMap = segBuckets.get(fParts.length)
  if (byMethodMap) {
    const buckets =
      method === 'ANY' ? [...byMethodMap.values()] : [byMethodMap.get(method)].filter(Boolean)
    for (const arr of buckets) {
      for (const bParts of arr) if (matchSegs(fParts, bParts)) return true
    }
  }
  for (const e of starEntries) {
    const methodOk = method === 'ANY' || e.method === method
    if (methodOk && matchStar(fParts, e.parts)) return true
  }
  return false
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
  {
    prefix: '/api/admin-saas/',
    evidence:
      "apps/api/src/routes/admin-saas-proxy.ts:88 `server.route({method:[GET/POST/PATCH/PUT/DELETE/HEAD/OPTIONS],url:'/*'})` 通配代理(透传 admin-api,注册面结构上看不见具体子路径)",
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

const dumpMissingPath = dumpFlagValue('--dump-missing')
if (dumpMissingPath) {
  writeFileSync(dumpMissingPath, JSON.stringify(missing, null, 2), 'utf8')
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
    if (p.method && p.method !== 'ANY' && call.method !== 'ANY' && p.method !== call.method)
      return false
    const pattern = p.pathPattern
    if (pattern.startsWith('^') || pattern.endsWith('$') || pattern.includes('\\')) {
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
 * ===== 通道等价对账的执行段(三条件同时成立才判红;缺一落未判定并点名)=====
 * 三条件各自的事实源都在**同一个判定面**上、同一次 prefetch 里读满(不得一面读盘一面读 git)。
 */
let channelVerdict = null
{
  const alias = readUrlAliasRules(readSource(CLIENT_TRANSPORT_FILE))
  const guardEntries = []
  for (const dir of CHANNEL_GUARD_GLOBS) {
    for (const rel of listFace(dir, ['.ts'])) guardEntries.push({ file: rel, src: readSource(rel) })
  }
  const { guards, partial, scanned } = readChannelGuards(guardEntries)
  const frontendFiles = frontendRels.map((rel) => ({ file: rel, src: readSource(rel) }))
  /**
   * ③' 整条不可见档**无条件采集**(与三条件齐不齐无关):这类字面量不进调用集,
   * 所以它既不受通道守卫在不在册的影响,也不受首锚台账的影响 —— 把它挂在 `missingConditions.length===0`
   * 分支里,等于"守卫没装 ⇒ 这一族的不可见性也不报名",而报名恰恰是它唯一的价值。
   * 同面同轮:复用上面已经 prefetch 满的 `frontendFiles` 与 `alias`,不另开一次取材。
   */
  const aliasLiteralBlind = collectAliasLiteralBlindSites({ frontendFiles, alias })
  /**
   * 首锚台账:缺档 ⇒ 该维**未判定**(不判红也不记绿,同本门 `BASELINE_FILE_REL` 缺档的手法)。
   * 键集与判据同面:`declared[]` 里每条必须带 file + path + reason,坏 JSON 不冒充空清单。
   */
  const ledgerSrc = readSource(CHANNEL_EQUIV_BASELINE_REL)
  let declared = null
  let ledgerNote = ''
  if (ledgerSrc === null || ledgerSrc === undefined) {
    ledgerNote = `${CHANNEL_EQUIV_BASELINE_REL} 不在 ${FACE} 面上 ⇒ 无首锚,本轮该维不判红`
  } else {
    try {
      const parsedLedger = JSON.parse(ledgerSrc)
      declared = Array.isArray(parsedLedger.declared) ? parsedLedger.declared : null
      if (!declared) ledgerNote = `${CHANNEL_EQUIV_BASELINE_REL} 缺 declared 数组 ⇒ 无首锚`
    } catch (e) {
      ledgerNote = `${CHANNEL_EQUIV_BASELINE_REL} 不是合法 JSON(${e.message})—— 坏台账不冒充空清单`
    }
  }
  const missingConditions = []
  if (!alias.parsed) missingConditions.push(`①归一实现读不出(${alias.reason})`)
  else if (alias.rules.length === 0)
    missingConditions.push(
      `①归一实现里没有"前缀 A→前缀 B"的改写档(改写档 0 条${alias.ambiguous ? ` / 判不出的改写形态 ${alias.ambiguous} 对` : ''})`,
    )
  if (guards.length === 0)
    missingConditions.push(
      `②通道守卫不在册(扫了 ${scanned} 个 ${API_PLUGINS_DIR} 文件,读到通道头的候选 ${partial.length} 个${
        partial.length > 0
          ? `:${partial.map((p) => `${p.file}:${p.line} 缺 ${p.missing}`).join(' / ')}`
          : ',即全仓没有任何文件按客户端自报的通道头做判定'
      })`,
    )
  if (ledgerNote) missingConditions.push(`首锚台账缺档 ⇒ 无锚点不判红(${ledgerNote})`)

  let sites = []
  let siteUndetermined = []
  let declaredHits = []
  if (missingConditions.length === 0) {
    sites = findLiveAliasSites({
      frontendFiles,
      alias,
      guards,
      hasRoute: backendHasRoute,
    })
    siteUndetermined = collectAliasSiteUndetermined({ frontendFiles, alias, hasRoute: backendHasRoute })
    // ③ 落不到调用点 = "这一族没人走" ⇒ 未判定(不得读成"已判过且没问题")
    if (sites.length === 0)
      missingConditions.push(
        `③面上没有一处调用点同时落在两种拼写(等价是纸面的;看得见但判不了的 ${siteUndetermined.length} 处见下)`,
      )
    else {
      declaredHits = sites.filter((s) =>
        (declared || []).some(
          (d) => d && d.file === s.file && d.path === s.raw && String(d.reason || '').trim(),
        ),
      )
      sites = sites.filter((s) => !declaredHits.includes(s))
      if (sites.length === 0)
        console.log(
          `${C.dim}[API 路由比对] ℹ️ 通道等价:${declaredHits.length} 处已在 ${CHANNEL_EQUIV_BASELINE_REL} 里逐条写明理由 ⇒ 本轮不判红(是"已交代",不是"没判")${C.reset}`,
        )
    }
  }
  channelVerdict = {
    alias,
    guards,
    partial,
    scanned,
    sites,
    siteUndetermined,
    declaredHits,
    aliasLiteralBlind,
    missingConditions,
    undetermined: missingConditions.length > 0,
  }
}

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
      '2026-09-26 把守门 8 的前端调用面从 apps/web 扩到 mobile-rn / miniapp-taro / extension,再扩到 packages/api-client。' +
      'api-client 这批不是本次改动引入的调用:那 15 个文件最近的提交 ca93dd962e 只改了 import 的 .js 扩展名,' +
      '逐文件新增 /api/ 字面量 0 条(实测),所以它们是从写下起就没人对账过的存量。' +
      '2026-09-28 再扩两端:apps/cli(首次纳入即补三条形态提取式,实测调用点 35 → 76)与 packages/app' +
      '(受管文件 224 个、/api/ 字面量全在注释里 ⇒ 存量为 0,进表是为"以后有人直接写路径"那天已有判据)。',
    ends: [...RATCHET_ENDS].sort(),
    face: FACE,
    perFileCount: Object.fromEntries(
      [...countsByFile.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    ),
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
  else if (n > 0) ratchetStock.push({ file, count: n, allowed, calls })
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
/**
 * CLI 端特有的一格:调用点**确实在**(工厂第二实参),但路径住在变量里 —— 变量可能由
 * `new URLSearchParams()` 之类拼出,静态判据结构上读不出真路径。这类站点既不能记通过
 * (等于把"没看清"写成"没问题"),也不能判红(那是把别人的正确实现钉成缺陷),
 * 所以照本门「不透明挂载未判定」同一条口径:**逐条点名 + 不计入失败**。
 */
if (cliUnresolved.length > 0) {
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定(CLI 变量路径调用点)${cliUnresolved.length} 处 —— 调用在、路径拼不出(一跳常量解析已尽力),本轮既不判红也不记通过:${C.reset}`,
  )
  for (const u of cliUnresolved.slice(0, 25)) {
    console.log(
      `${C.dim}    ${u.site} @ ${u.file}:${u.line}${u.reason ? ` —— ${u.reason}` : ''}${C.reset}`,
    )
  }
  if (cliUnresolved.length > 25) {
    console.log(`${C.dim}    ... 还有 ${cliUnresolved.length - 25} 处${C.reset}`)
  }
} else {
  // 0 也要出声,并且要说清是"哪一种 0":只报"未判定 0 处"会把"这一族一条都没枚举到"
  // 洗成"全部解析成功"(本仓反复记过的空扫型假绿)。
  console.log(
    cliVarSites === 0
      ? `${C.dim}[API 路由比对] ℹ️ 未判定(CLI 变量路径调用点)0 处,且**变量站点也是 0** —— 本面没看到任何变量形态调用点,这不是"全部解析成功"${C.reset}`
      : `${C.dim}[API 路由比对] ℹ️ 未判定(CLI 变量路径调用点)0 处 —— 变量站点 ${cliVarSites} 条全部由一跳解析给出 ${cliVarPaths} 条路径${C.reset}`,
  )
}
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
    console.log(
      `${C.dim}    ... 还有 ${ratchetStock.length - 20} 个文件(逐条见 --dump-missing)${C.reset}`,
    )
  }
}
if (staleLedger.length > 0) {
  console.log(
    `${C.yellow}  (登记)基线里有 ${staleLedger.length} 个文件已不再命中(清单该收紧了):${C.reset} ${staleLedger.slice(0, 5).join(', ')}`,
  )
}

if (DUMP_MISSING) {
  const dump = []
  for (const v of webViolations)
    dump.push(`${v.method} ${v.path} @ ${v.file}:${v.line} [web 零容忍]`)
  for (const s of [...ratchetStock, ...ratchetNew, ...ratchetNoAnchor])
    for (const c of s.calls || [])
      dump.push(
        `${c.method} ${c.path} @ ${c.file}:${c.line} [棘轮${s.allowed !== undefined ? `存量/允许 ${s.count}/${s.allowed}` : '无锚点'}]`,
      )
  console.log(`[API 路由比对] --dump-missing 逐条死调用(${dump.length} 处):`)
  for (const d of dump) console.log(`    ${d}`)
}

/**
 * ===== 通道等价维的读数(每轮必打,三态不并桶)=====
 * 这一维今天在本仓的结论是「未判定」—— 但**未判定必须点名缺哪一条**,否则读报告的人会把它
 * 读成"这一格已对齐"(本仓最高频失效型)。反过来,三条件齐备而一处不漏,才是真的"已判过且干净"。
 */
{
  const v = channelVerdict
  const aliasText = v.alias.parsed
    ? v.alias.rules.length > 0
      ? v.alias.rules.map((r) => `${r.from}→${r.to}`).join(' / ')
      : '(无改写档)'
    : `(读不出:${v.alias.reason})`
  console.log(
    `${C.dim}[API 路由比对] 通道等价(CE)① 归一改写档(读自 ${FACE} 面 ${CLIENT_TRANSPORT_FILE}::normalizeUrl):${aliasText}${v.alias.ambiguous > 0 ? ` | 判不出的改写形态 ${v.alias.ambiguous} 对(一条都不采用)` : ''}${C.reset}`,
  )
  console.log(
    `${C.dim}[API 路由比对] 通道等价(CE)② 通道守卫:扫了 ${v.scanned} 个 ${API_PLUGINS_DIR} 文件,在册 ${v.guards.length} 个${
      v.guards.length > 0
        ? `(${v.guards.map((g) => `${g.file}:${g.line} 头 ${g.header} 放行 ${g.exemptMethods.join('/')}`).join(' / ')})`
        : ''
    }${v.partial.length > 0 ? `;读到通道头但要素不齐 ${v.partial.length} 个` : ''}${C.reset}`,
  )
  if (v.undetermined) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 未判定(通道等价 CE):${v.missingConditions.join(';')} ⇒ 这一格本轮没有判据,既不判红也不记通过${C.reset}`,
    )
    for (const u of v.siteUndetermined.slice(0, 10)) {
      console.log(
        `${C.dim}    ${u.file}:${u.line} ${u.raw} —— ${u.reason}${C.reset}`,
      )
    }
  } else if (v.sites.length > 0) {
    console.log(
      `${C.red}[API 路由比对] ❌ 通道等价旁路 ${v.sites.length} 处:同一入口的两种拼写都在册,而通道守卫对该方法有意放行 ⇒ 等值对账两侧同时成立,本门原有的判据看不见这一型:${C.reset}`,
    )
    for (const s of v.sites.slice(0, 20)) {
      console.log(
        `${C.red}  ${s.method} ${s.raw} ≡ ${s.rewritten}${C.reset}\n${C.dim}    @ ${s.file}:${s.line};放行依据:${s.guard}(对 ${s.exempt} 跳过通道校验)${C.reset}`,
      )
    }
    if (v.sites.length > 20)
      console.log(`${C.dim}    ... 还有 ${v.sites.length - 20} 处${C.reset}`)
    console.log(
      `${C.dim}  出路只有两条:① 让该入口只保留一种拼写(删掉等价的那一侧注册),或 ② 在 ${CHANNEL_EQUIV_BASELINE_REL} 的 declared[] 里逐条写 file+path+reason 交代"这一处为什么可以走等价"。禁止为变绿去放宽判据或改后端放行(那是安全决策,不属本门)。${C.reset}`,
    )
  } else {
    console.log(
      `${C.green}[API 路由比对] ✅ 通道等价(CE)已判过:改写档与通道守卫都在册,而等价拼写上一处未交代的调用点都没有${v.declaredHits.length > 0 ? `(另有 ${v.declaredHits.length} 处已在台账里逐条写明理由,是"已交代"不是"没判")` : ''}${C.reset}`,
    )
  }
  /**
   * ③' 改写前缀字面量的不可见性 —— **无条件打印**(三态不并桶)。
   * 挂在"有站点才喊"的分支里就等于没有:这一族的错恰恰是"一处都不进调用集",
   * 于是所有既有分支都走成安静(守门 70/76/81 同型)。0 也要说清是哪一种 0 ——
   * 「面上确实没有这类字面量」与「改写档本身读不出所以扫不了」是两件事。
   */
  if (v.aliasLiteralBlind.length > 0) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 未判定(改写前缀字面量,静态对账整条看不见)${v.aliasLiteralBlind.length} 处 —— pathRe 只认引号紧邻 \`/api/\` 的字面量,这些调用点**一条都不进调用集**,既不判死也不落任何既有未判定桶;本轮不判红(存量当场判红就是恒红门,§12e),但这一格**没有判据**,不得读成"已对账":${C.reset}`,
    )
    for (const b of v.aliasLiteralBlind.slice(0, 25)) {
      console.log(
        `${C.dim}    ${b.file}:${b.line} ${b.raw} →归一后 ${b.rewritten}(两种拼写都未经本门对账)${C.reset}`,
      )
    }
    if (v.aliasLiteralBlind.length > 25)
      console.log(`${C.dim}    ... 还有 ${v.aliasLiteralBlind.length - 25} 处${C.reset}`)
  } else {
    console.log(
      v.alias.parsed && v.alias.rules.length > 0
        ? `${C.dim}[API 路由比对] 未判定(改写前缀字面量,静态对账整条看不见)0 处 —— 面上没有以现读改写档前缀开头的字面量(这一族的射程是空的,不是"已对账干净")${C.reset}`
        : `${C.dim}[API 路由比对] 未判定(改写前缀字面量,静态对账整条看不见)未判定 —— 改写档本身读不出或 0 条,前缀集合无从推导(空清单与判不出不得混计)${C.reset}`,
    )
  }
}

if (webViolations.length === 0 && ratchetNew.length === 0 && channelVerdict.sites.length === 0) {
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
