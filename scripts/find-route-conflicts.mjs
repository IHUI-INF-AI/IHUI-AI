#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扫描后端路由文件，输出按 method+path 分组后的真实重复路由。
 *
 * ── 取材面（本门的"眼"，2026-10-04 修） ─────────────────────────────────
 * 修复前本脚本只读 `apps/api/src/server.ts` 一个文件，而**全仓业务路由的注册真身
 * 不在那个文件里**：
 *   · `server.ts` 里带 prefix 的**业务**路由只有 3 条（llmVerifyKey / downloads /
 *     crashReports），其余 60+ 个 `server.register` 全是 websocket / 限流 / 审计
 *     等**基础设施插件**（不带 prefix、不含 `server.get/post`）。
 *   · 真正的注册面是 `apps/api/src/routes/index.ts` 的 `registerRoutes(server)`：
 *     **391 条** `server.register(X, { prefix })`，`server.ts:25` 只是 import 它。
 * 探针实测（修复前）：`routeEntries=5`，集合恰为
 *   `crashReportsRoutes@/api`、`downloadsRoutes@/api/downloads`、`llmVerifyKeyRoutes@/api/llm`
 * ⇒ 那 6 处 `/history` 路由（`chat-models.ts` 4 条、`ai-user-model-chat.ts` 1 条、
 * `stock.ts` 1 条）**一条都没进面**。所以它当年那句"未发现重复路由"真实含义是
 * **"在扫过的 5 条里没发现"，不是"全仓没发现"** —— 判据成立但覆盖面是 5/4196 ≈ 0.1%。
 *
 * 现在取材面 = 两个**入口**文件（`ENTRY_FILES`），都扫、都出 prefix 表：
 *   ① `apps/api/src/server.ts`
 *   ② `apps/api/src/routes/index.ts`
 *
 * 修复后实测（本仓，2026-10-04）：入口 2 · register 578 条 · 路由文件 506 个 ·
 * 路由条目 **4196** 条 · 注册插件 435 个 · 最大下钻深度 3。
 * 对照：`routes/` 下（含子目录、排除 `__tests__`）含路由声明的 `.ts` 文件共 471 个 ——
 * 实扫 506 > 471，因为多出的 35 个是**只含 register 不含路由声明的 barrel**
 * （`other/index.ts`、`admin-sys/index.ts`、`_exports.ts` 等）。⇒ 路由文件层面已无缺口。
 * 那 6 条 `/history` 现已全部在面内（实测）：
 *   `POST /api/chat/history/create`、`POST /api/chat/history/query`、
 *   `PUT /api/chat/history/:chatId/mark`、`DELETE /api/chat/history/:chatId`、
 *   `GET /api/stock/history`、`GET /api/ai/history`
 *
 * ── barrel 递归下钻（为什么一层 importMap 查表不够） ────────────────────
 * `otherRoutes` 在 `routes/index.ts:1046` 注册（prefix `/api`），但它自己不含任何
 * `server.get`，只是一层 barrel：`routes/other/index.ts:55-81` 连续 27 个
 * `await server.register(historyRoutes)`（**无 prefix ⇒ 继承父 `/api`**）。
 * 而那 27 个符号又不是直接 import 的，是从 `./_exports.js` 引进来的 ——
 * `routes/other/_exports.ts` 本身就是**再导出 barrel**
 * （`export { historyRoutes } from './history-routes.js'`，27 行）。
 * 同型还有 `admin-sys.ts`（纯再导出，1 行 `export { adminSysRoutes } from './admin-sys/index.js'`）、
 * `admin-sys/index.ts`（15 个带 prefix 的子注册，如 `menuRoutes@/sys-menu`）。
 *
 * 所以下钻必须走**两跳**：注册面 → barrel → 再导出 barrel → 叶子路由文件。
 * **纯再导出 barrel 需要一条专门的转发分支**（`collectFromPluginFile` 的 `else`）：
 * 那类文件里既没有插件块、也没有一条 `server.register`，只有 `export { x } from`。
 * 不转发就在那里**静默断链**，而输出仍是"未发现重复路由" —— 断链与"真的没有"长得一样。
 * 转发后**必须 return**：转发分支与"块内下钻"分支互斥，串行会重复展开（见该处注释）。
 *
 * `importMap` 的工作方式：对每个文件解析出「本地符号名 → 绝对文件路径」的映射，
 * 规则三条，逐条都有实证支撑：
 *   ① `import { a, b } from './x.js'`  → a/b 都记（`routes/index.ts` 355 条 import 靠这条）；
 *   ② `import x from './y.js'`（**默认导入**）→ 记 x（`routes/index.ts:111`
 *      `import stockRoutes from './stock.js'`、`routes/user/index.ts` 的
 *      `import skillsRoutes from './skills-routes.js'` 都靠这条）。修复前的正则写的是
 *      `(?:(\w+)\s*,\s*)?` —— **默认名后强制跟逗号**，于是裸默认导入整类匹配不到
 *      （实测 `import stockRoutes from './stock.js'` → NO MATCH），`stockRoutes` 全程失明；
 *   ③ `export { a } from './x.js'`（**再导出**）→ 记 a（`other/_exports.ts`、
 *      `admin-sys.ts` 全靠这条）。
 *   非相对路径（`'fastify'` 等裸模块名）直接跳过 —— 那是 node_modules，不在取材面内。
 *
 * `resolveTsPath` 的相对基准是** importing 文件自己的目录**，不是 `API_SRC_DIR`。
 * 修复前它恒以 `API_SRC_DIR` 为基准，而 `server.ts` 恰好就在 `API_SRC_DIR` 根下，
 * 于是"看起来对"；一旦把 `routes/index.ts` 作为入口，同一条
 * `from './other/index.js'` 会被解析成 `apps/api/src/other/index.ts`（**不存在**）
 * ⇒ 递归第一步就断链。这是个**只在扩面之后才会显形**的潜伏缺陷。
 *
 * 插件块的**接收者名不写死 `server`**：`routes/admin-sys/*-routes.ts` 里 14 个文件写的是
 * `export const menuRoutes: FastifyPluginAsync = async (s) => {`，块内全是 `s.get(...)`。
 * 写死 `server` 会让这 14 个文件**整片**定位不到 ⇒ `admin-sys/index.ts` 那 15 个带 prefix
 * 的子注册连同其下所有路由集体失明。所以块正则抓形参名，路由正则按实测出的接收者集
 * 拼 alternation（`extractRoutesFromFile` 的 `receivers`）。
 *
 * ── 仍不覆盖的已知边界（如实列出，不得假装覆盖） ──────────────────────
 *   · **工厂式注册**：`routes/index.ts:1380` 的
 *     `server.register(createAgentRunRoutes({...}), { prefix: '/api/agent-runs' })`
 *     首参是调用表达式不是裸标识符，`extractRegisterCalls` 的 `\w+` 匹配不到。
 *   · **内联匿名子插件**：`server.register(async (sub) => {...}, { prefix })`
 *     （`admin-sys/alias-routes.ts` 3 处、`role-routes.ts` 1 处）。首参不是标识符，
 *     且其内部路由的接收者（`sub`）与前缀都需另算，当前不进面。
 *   · **动态路径**：`server.get(` 后面跟模板串/变量（`` `/x/${id}` ``）的一律不收 ——
 *     判据要求字面量路径，这是**有意**为之（判不准就不判）。
 *   这三类都不影响本门当前的结论（报数用途），但**会影响"全仓无冲突"这句话的强度**：
 *   准确表述是"在 4196 条字面量字面路由上无冲突"。
 *
 * ── 循环 import 怎么防（三道，缺一道就可能不收敛） ──────────────────────
 *  ① **路径栈** `state.stack`（含正在展开的文件）：barrel A 引 B、B 又引回 A 时，
 *     第二次进入 A 立即返回。这是唯一能真正断开"环"的那道 —— 单靠 visited 集
 *     会把**菱形**（D 同时被 B、C 引用）也当环砍掉，漏收 D 的路由。
 *  ② **展开去重集** `state.done`，键 = `文件|符号名|前缀`：挡菱形重复展开导致的
 *     指数膨胀。键里带上前缀是必须的 —— `educationPlatformRoutes` 被
 *     `routes/index.ts:941/942` 以**两个不同 prefix** 注册，砍掉第二条就等于
 *     凭空造出"没有 /api/admin/education-platform 面"的假象。
 *  ③ **深度上限** `MAX_BARREL_DEPTH`（32）：前两道是"按身份"拦，这道是"按距离"兜底，
 *     防的是"路径栈因符号名对不上而每层都算作新节点"这类绕开①的链。
 *     实测最深 3 层（`index.ts` → `admin-sys.ts` → `admin-sys/index.ts` → `menu-routes.ts`）。
 *
 * ── 取材面非空断言（防"再次静默扫零个文件"） ────────────────────────────
 * 报数口径在 `state` 上：`entryFilesRead` / `registerCalls` / `scannedFiles`。
 * 三者任一为 0 ⇒ 直接**报错退出非零**，绝不打印"未发现重复路由"。
 * 防的正是本会话另一票踩过的同型：`extname` 被 Windows 粘成 `".tsx\x"` ⇒
 * 枚举循环扫了**零个文件** ⇒ "零残留"用例全绿。是变异验证里"T5 红了、T1 没红"
 * 把这格暴露出来的 —— 一个从不失败的判据和一个扫不到东西的判据，在输出上长得一样。
 *
 * ── 冲突判据（冲突键 / 去重键 / "同 prefix + 同 localPath" 会不会被判冲突） ──
 *   · **冲突键** = `full` = `` `${method} ${normalizePath(prefix, localPath)}` ``
 *     （前缀与 localPath 拼接后的对外真实路径）
 *   · **去重键** = `` `${pluginName}:${prefix}:${localPath}` ``
 *   · 判定：`full` 相同 **且** 去重键集合 > 1 ⇒ 冲突。
 *   ⇒ **同 prefix + 同 localPath 一定被判为冲突**（前缀与 localPath 都相同 ⇒
 *     `full` 必然相同；两个不同插件名 ⇒ 去重键必然不同）。实测见 T1。
 *   ⇒ **同 localPath + 不同 prefix 一定不判冲突**（`full` 就不同，压根不进同一条桶）。
 *     这是最容易被"过度收紧"误伤的一档，用 T3 钉住。
 *   · 同一 (plugin, prefix) 被注册两次**不**算冲突（去重键相同 ⇒ 集合 size 为 1），
 *     这是有意为之：那不是路由冲突，只是重复挂载。
 *
 * ── 结论强度（"未发现重复路由"到底断言了什么） ─────────────────────────
 * 本仓修后实测：**0 条冲突**（4196 条字面量路由、435 个注册插件）。
 * 这 0 条**不是**"扩面后新暴露 0 条"，而是"扩面后新暴露 3 条、逐条裁决后 3 条全是误报"。
 * 那 3 条误报是**本门自己在扩面中途引入的真 bug**（转发后未 `return`，导致同文件里
 * 另一个插件被重复挂到错前缀上），已修掉并在源码里留了划痕注释 —— 不是"本来就干净"。
 * 裁决过程见 `scripts/tests/find-route-conflicts.test.mjs` 头注。
 *
 * 本门**只报数、不判红**（两种业务分支都 `process.exit(0)`；只有取材面为空才非零退出）。
 * 理由：判据仍有上述三类已知边界（工厂式注册 / 内联匿名子插件 / 动态路径），
 * 在这个精度上判红会逼人 `--no-verify`（AGENTS §12e）。接判红是**另一票**的事。
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/** `--root <dir>`：让测试能指向夹具仓；缺省用 cwd（真仓跑法不变）。 */
const ROOT = (() => {
  const i = process.argv.indexOf('--root')
  if (i !== -1 && process.argv[i + 1]) return resolve(process.argv[i + 1])
  return process.cwd()
})()
const API_SRC_DIR = join(ROOT, 'apps', 'api', 'src')

/**
 * 取材面**入口**文件。全仓 `server.register` 的顶层注册只发生在这两个文件里
 * （`server.ts` 起服务并挂基础设施 + 直接注册 3 条；`routes/index.ts` 是业务注册面）。
 * 修复前只有第 ① 个 —— 见文件头「取材面」段的量表。
 */
const ENTRY_FILES = [join(API_SRC_DIR, 'server.ts'), join(API_SRC_DIR, 'routes', 'index.ts')]

/**
 * barrel 下钻深度上限。`state.stack`（环）与 `state.done`（菱形）之外的兜底，
 * 按"距离"而不是"身份"拦，防的是符号名对不上导致每层都被算作新节点的链。
 */
const MAX_BARREL_DEPTH = 32

/**
 * 把一条 import/export 的模块说明符解析成**绝对文件路径**。
 *
 * @param {string} importPath 模块说明符，如 `'./other/index.js'`
 * @param {string} fromDir **importing 文件自己的目录**（绝对路径）
 * @returns {string|null} 命中的绝对路径；解析不到返回 `null`
 *
 * 相对基准必须是 `fromDir`：`.js` 后缀是 ESM 写法，磁盘上是 `.ts`（或 `dir/index.ts`），
 * 两条候选都试。**解析不到就返回 `null`，不返回猜测路径** —— 返回猜测路径会让
 * 后续 `readFileSync` 抛 ENOENT，把"这一条没解析出来"变成"整个脚本崩了"，
 * 那样就看不出到底哪一条断了。
 */
function resolveTsPath(importPath, fromDir) {
  if (!importPath.startsWith('.')) return null
  const base = importPath.replace(/\.js$/, '')
  const candidates = [`${base}.ts`, `${base}/index.ts`]
  for (const c of candidates) {
    const full = resolve(fromDir, c)
    if (existsSync(full)) return full
  }
  return null
}

/**
 * 单个文件的「本地符号名 → 定义它的文件绝对路径」表。
 *
 * 覆盖三种写法（缺任何一整类都会丢整片路由，见文件头「importMap 怎么工作」）：
 *   ① `import { a, b } from './x.js'`
 *   ② `import a from './x.js'`（默认导入；`import a, { b } from` 也覆盖）
 *   ③ `export { a } from './x.js'`（再导出 barrel）
 * 外加 `type` 前缀与 `as` 别名的剥离 —— 两者都只影响符号名，不影响文件归属。
 * 裸模块名（`'fastify'`）不解析：那是 node_modules，不在取材面内。
 *
 * @param {string} file 绝对路径
 * @returns {Map<string,string>} 符号名 → 文件绝对路径
 */
function extractImportMap(file) {
  const src = readFileSync(file, 'utf8')
  const map = new Map()

  const record = (namedList, target) => {
    for (const raw of namedList.split(',')) {
      // `a as b` 的本地名是 b；`type Foo` 是纯类型导入，不参与运行时注册。
      const cleaned = raw.trim().replace(/^type\s+/, '')
      if (!cleaned) continue
      const asParts = cleaned.split(/\s+as\s+/)
      const local = (asParts[1] ?? asParts[0]).trim()
      if (local) map.set(local, target)
    }
  }

  // ① / ②：import [默认名][, { 命名列表 }] from '...'
  //    `([^}]*)` 允许命名列表跨行（`routes/index.ts` 的多行 import 靠这条）。
  //    三段的匹配关系（实测过，`(?:(\w+)\s*,\s*)?` 那种写法会漏掉**裸默认导入**）：
  //      `import { a } from`      → 命名段命中、默认段空
  //      `import a, { b } from`   → 默认段 + 命名段都命中
  //      `import a from`          → **默认段单独命中**（`routes/index.ts:111`
  //                                 `import stockRoutes from './stock.js'` 就是这一类；
  //                                 若强制默认名后必须跟逗号，这一整类静默解析不到）
  const importRe =
    /import\s+(?:type\s+)?(?:(\w+)\s*(?:,\s*(?:\{([^}]*)\}\s*)?)?|\{([^}]*)\}\s*)from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = importRe.exec(src)) !== null) {
    const namedList = m[2] ?? m[3]
    const target = resolveTsPath(m[4], dirname(file))
    if (!target) continue
    if (m[1]) map.set(m[1], target)
    if (namedList) record(namedList, target)
  }

  // ③：export { a, b } from '...'（再导出 barrel：`other/_exports.ts`、`admin-sys.ts`）
  const exportRe = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  while ((m = exportRe.exec(src)) !== null) {
    const target = resolveTsPath(m[2], dirname(file))
    if (!target) continue
    record(m[1], target)
  }

  return map
}

/**
 * 抽一个文件里所有 `server.register(<符号名>, { prefix? })` 调用。
 *
 * 只认**裸标识符**作首参：形如 `server.register(createX({...}), { prefix })` 的
 * 工厂式注册（`routes/index.ts:1380` 的 agent-runs 面就是这种）匹配不到，
 * 属**已知取材边界**，不假装覆盖 —— 见文件头量表里的"仍不覆盖"一栏。
 *
 * @param {string} file 绝对路径
 * @returns {Array<{name:string,prefix:string,line:number}>} `line` 是 0 基行号
 */
function extractRegisterCalls(file) {
  const src = readFileSync(file, 'utf8')
  const lineStarts = computeLineStarts(src)
  const re = /server\.register\(\s*(\w+)\s*(?:,\s*\{\s*prefix:\s*['"`]([^'"`]+)['"`]\s*,?\s*\})?\s*,?\s*\)/g
  const out = []
  let m
  while ((m = re.exec(src)) !== null) {
    out.push({ name: m[1], prefix: m[2] ?? '', line: lineIndexAt(lineStarts, m.index) })
  }
  return out
}

/** 每个 0 基行号的首字符在源串中的偏移，供 offset→行号 二分。 */
function computeLineStarts(src) {
  const starts = [0]
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '\n') starts.push(i + 1)
  }
  return starts
}

function lineIndexAt(lineStarts, offset) {
  let lo = 0
  let hi = lineStarts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (lineStarts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return lo
}

/**
 * 切出「插件块」：按 `export const name[: Type] = async (<接收者>) => {` 定位，
 * 用大括号配对找到块尾。路由归属与 barrel 下钻都靠块区间 —— 一个文件里多个
 * `export`（public/admin 并存、`admin-sys/index.ts` 那样）时，必须靠区间才不会串味。
 *
 * 同时收集该文件里出现过的**全部接收者名**（`receivers`）：路由声明正则要用它
 * 拼接收者 alternation，否则 `s.get(...)` 这类写法（`admin-sys/` 下 14 个文件）
 * 一条都收不到。
 *
 * @param {string} src 文件内容
 * @returns {{plugins:Array<{name:string,receiver:string,startLine:number,endLine:number}>,
 *            receivers:Set<string>}}
 */
function extractPluginsFromFile(src) {
  const lines = src.split('\n')
  const plugins = []
  const receivers = new Set()

  // 插件块定位。**接收者名不写死 `server`**：形参实参名叫 `server` / `s` / `app`
  // 都算（`(?:async\s+)?\(\s*(\w+)` 抓形参名，见下方 `RECEIVER_NAMES`）。
  // 写死 `server` 会让 `routes/admin-sys/*-routes.ts` 那 14 个文件
  // （`export const menuRoutes: FastifyPluginAsync = async (s) => {`，块内全是 `s.get(...)`）
  // 整片定位不到 —— 那样 `admin-sys/index.ts` 那 15 个带 prefix 的子注册
  // （`menuRoutes@/sys-menu` 等）连同它们下面所有路由**集体失明**，
  // 而脚本仍会报"未发现重复路由"。
  const exportRe = /export\s+(?:const|function)\s+(\w+)\s*[:=][^(]*\(\s*(\w+)/
  const defaultRe = /export\s+default\s+(\w+)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const exportMatch = exportRe.exec(line)
    if (exportMatch) {
      const startLine = i
      const block = blockRange(lines, i)
      if (block) {
        plugins.push({ name: exportMatch[1], receiver: exportMatch[2], startLine, endLine: block })
        receivers.add(exportMatch[2])
      }
    }

    const defaultMatch = defaultRe.exec(line)
    if (defaultMatch) {
      // default export 的块在变量定义处，不在 export 语句处。
      const varName = defaultMatch[1]
      const varRe = new RegExp(`(?:const|let|var|function)\\s+${varName}\\s*[:=]`)
      for (let j = 0; j < lines.length; j++) {
        if (!varRe.test(lines[j])) continue
        const block = blockRange(lines, j)
        if (block) {
          const recv = /[(]\s*(\w+)/.exec(lines[j].slice(lines[j].indexOf('=') + 1))
          plugins.push({
            name: `default:${varName}`,
            receiver: recv ? recv[1] : 'server',
            startLine: j,
            endLine: block,
          })
          if (recv) receivers.add(recv[1])
        }
        break
      }
    }
  }

  return { plugins, receivers }
}

/** 从 `startLine` 起的首个 `{` 出发做括号配对，返回其闭合所在行号。 */
function blockRange(lines, startLine) {
  let braceStart = lines[startLine].indexOf('{')
  let scan = startLine
  while (braceStart === -1 && scan < lines.length - 1) {
    scan++
    braceStart = lines[scan].indexOf('{')
  }
  if (braceStart === -1) return null
  return findClosingBrace(lines, scan, braceStart)
}

function findClosingBrace(lines, startLine, startCol) {
  let depth = 0
  let inString = null
  let escaped = false
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]
    const begin = i === startLine ? startCol : 0
    for (let j = begin; j < line.length; j++) {
      const ch = line[j]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (ch === '\\') {
          escaped = true
        } else if (ch === inString) {
          inString = null
        }
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch
        continue
      }
      if (ch === '/' && j + 1 < line.length) {
        const next = line[j + 1]
        if (next === '/') break // 行注释，跳过本行剩余
        if (next === '*') {
          // 块注释，简单跳过到 */
          let found = false
          for (let k = j + 2; k < line.length - 1; k++) {
            if (lines[i][k] === '*' && lines[i][k + 1] === '/') {
              j = k + 1
              found = true
              break
            }
          }
          if (!found) {
            // 跨行块注释，继续扫描下一行
            let done = false
            for (let k = i + 1; k < lines.length && !done; k++) {
              for (let l = 0; l < lines[k].length - 1; l++) {
                if (lines[k][l] === '*' && lines[k][l + 1] === '/') {
                  i = k
                  j = l + 1
                  done = true
                  break
                }
              }
            }
          }
          continue
        }
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return i
      }
    }
  }
  return lines.length - 1
}

/**
 * 抽一个文件里所有 `<接收者>.<method>('<path>'` 声明，并归属到所在插件块。
 *
 * 接收者 alternation 由 {@link extractPluginsFromFile} 实测出的 `receivers` 拼出
 * （至少含 `server`；`admin-sys/*-routes.ts` 那批是 `s`）。写死 `server\.` 的后果：
 * 那 14 个文件的路由**一条都收不到**，而输出仍是"未发现重复路由"。
 *
 * @param {string} src 文件内容
 * @param {Array} plugins 插件块区间
 * @param {Set<string>} receivers 该文件出现过的接收者名
 */
function extractRoutesFromFile(src, plugins, receivers) {
  const lineStarts = computeLineStarts(src)
  const routes = []
  const names = [...receivers].filter(Boolean).map(escapeRegExp)
  // 收不到任何接收者名时回落到 `server`，保证正则恒合法（不会拼出空 alternation）。
  const recv = names.length > 0 ? names.join('|') : 'server'
  const re = new RegExp(`(?:${recv})\\.(get|post|put|patch|delete)\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'g')
  let m
  while ((m = re.exec(src)) !== null) {
    const lineIdx = lineIndexAt(lineStarts, m.index)
    const plugin = plugins.find((p) => lineIdx >= p.startLine && lineIdx <= p.endLine)
    routes.push({
      method: m[1].toUpperCase(),
      localPath: m[2],
      pluginName: plugin ? plugin.name : '<unknown>',
    })
  }
  return routes
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 前缀拼接：父前缀 + 本层 register 的 prefix。
 * 本层无 prefix（barrel 里的裸 `server.register(x)`）⇒ **继承父前缀**，
 * 这正是 `other/index.ts` 那 27 条的挂法。
 */
function joinPrefix(parent, own) {
  if (!own) return parent
  if (!parent) return own
  return parent.endsWith('/') ? parent + own.slice(1) : parent + own
}

function normalizePath(prefix, localPath) {
  if (localPath === '/' || localPath === '') return prefix || '/'
  const sep = prefix.endsWith('/') ? '' : '/'
  const lp = localPath.startsWith('/') ? localPath : sep + localPath
  return `${prefix}${lp}`
}

/**
 * 报数用的取材面账本。三个计数器是**非空断言**的唯一依据：
 * 任一为 0 都说明取材面本身出了问题（而不是"路由真没冲突"）。
 */
function newState() {
  return {
    entryFilesRead: 0,
    registerCalls: 0,
    forwarded: 0, // 纯再导出 barrel 转发次数
    scannedFiles: new Set(),
    routeEntries: [],
    stack: new Set(), // ① 环检测：当前展开路径上的文件
    done: new Set(), //  ② 展开去重：`文件|符号名|前缀`
    maxDepth: 0,
  }
}

/**
 * 入口文件扫描：把该文件里**所有** `server.register` 逐条下钻。
 * 入口文件自身不是插件（没有外层 `export const x = async (server)` 包住注册），
 * 所以不做块过滤 —— 这是它与 {@link collectFromPluginFile} 的唯一区别。
 */
function collectFromEntryFile(file, state) {
  if (!existsSync(file)) return
  state.entryFilesRead++
  const importMap = extractImportMap(file)
  for (const reg of extractRegisterCalls(file)) {
    state.registerCalls++
    const target = importMap.get(reg.name)
    if (!target) continue // 基础设施插件（ws/限流/审计）或工厂式注册，不在路由面内
    collectFromPluginFile(target, reg.name, reg.prefix, state, 1)
  }
}

/**
 * 叶子/中间路由文件扫描。两件事同时做：
 *   ① 收该插件块里**直接声明**的 `server.get/post/...`（barrel 这档为空）；
 *   ② 收该插件块里**再注册**的子插件并递归（barrel 就在这一步被吃掉）。
 *
 * 匹配不到同名块时**只当 barrel 继续下钻、不收直接路由**（宁可漏，不可多收）：
 * 多收会凭空造出"两个插件抢同一路径"的假冲突。
 *
 * @param {string} file 目标文件绝对路径
 * @param {string} pluginName 在该文件里被注册的符号名
 * @param {string} prefix 累积到本层的对外前缀
 * @param {object} state 账本
 * @param {number} depth 当前递归深度
 */
function collectFromPluginFile(file, pluginName, prefix, state, depth) {
  if (depth > MAX_BARREL_DEPTH) return // ③ 深度兜底
  if (state.stack.has(file)) return //  ① 环：同一文件已在当前展开路径上
  const doneKey = `${file}|${pluginName}|${prefix}`
  if (state.done.has(doneKey)) return //  ② 菱形：同一 (文件,符号,前缀) 不重复展开
  if (!existsSync(file)) return

  state.done.add(doneKey)
  state.stack.add(file)
  if (depth > state.maxDepth) state.maxDepth = depth
  try {
    state.scannedFiles.add(file)
    const src = readFileSync(file, 'utf8')
    const { plugins, receivers } = extractPluginsFromFile(src)
    const block = pickPluginBlock(plugins, pluginName)
    const importMap = extractImportMap(file)

    if (block) {
      const routes = extractRoutesFromFile(src, plugins, receivers)
      for (const r of routes) {
        if (r.pluginName !== block.name) continue
        state.routeEntries.push({
          pluginName,
          prefix,
          method: r.method,
          localPath: r.localPath,
          full: `${r.method} ${normalizePath(prefix, r.localPath)}`,
        })
      }
    } else {
      // **纯再导出 barrel 转发**（本门取材面能走通的关键一步）。
      // 这类文件里既没有 `export const x = async (server)` 块、也没有一条
      // `server.register`，只有 `export { x } from './y.js'`：
      //   · `routes/other/_exports.ts`  —— 27 行纯再导出，`other/index.ts` 的符号全从它来
      //   · `routes/admin-sys.ts`       —— 1 行 `export { adminSysRoutes } from './admin-sys/index.js'`
      // 不转发就会在这里**静默断链**：`other/` 下 27 个插件与 `admin-sys/` 下 15 个
      // 子注册（`menuRoutes@/sys-menu` 等）一条都进不了面，而脚本仍然报
      // "未发现重复路由" —— 断链与"真的没有"在输出上完全一样。
      // 转发时 prefix **不变**（转发不是一次挂载，是同一个符号换个文件定义）。
      const forwarded = importMap.get(pluginName)
      if (forwarded && resolve(forwarded) !== resolve(file)) {
        state.forwarded++
        collectFromPluginFile(forwarded, pluginName, prefix, state, depth + 1)
      }
      // 转发后**必须 return**，不能继续走下面的 barrel 下钻。
      // 反例（2026-10-04 实测真踩）：`proxy-extended.ts` 里 `extendedVendorRoutes`
      // 在前、`adminAiVendorRoutes` 在后，两块同文件。注册面写的是
      //   `ai-vendors.ts:42  server.register(extendedVendorRoutes)`（继承父 `/api/ai`）
      //   `index.ts:710     server.register(adminAiVendorRoutes, {prefix:'/api/admin/ai'})`
      // 解析 `adminAiVendorRoutes` 时先转发到 `proxy-extached.ts`（对），但若不 return，
      // 紧接着的 barrel 下钻会**不带块过滤**地把该文件里全部 register 重新展开一遍 ——
      // 于是 `extendedVendorRoutes` 被额外挂到 `/api/admin/ai` 上，凭空造出
      // 3 条"GET /api/admin/ai/{vendors,tasks,usage}"假冲突（实测已复现并修掉）。
      // 判据层教训：转发分支与"块内下钻"分支**互斥**，不能串行。
      return
    }

    // barrel 下钻：只看**本插件块内**的 register，避免把同文件里别的插件的注册算进来。
    for (const reg of extractRegisterCalls(file)) {
      if (block && (reg.line < block.startLine || reg.line > block.endLine)) continue
      state.registerCalls++
      const target = importMap.get(reg.name)
      if (!target) continue
      collectFromPluginFile(target, reg.name, joinPrefix(prefix, reg.prefix), state, depth + 1)
    }
  } finally {
    state.stack.delete(file) // ① 退栈：菱形不是环，必须能重入
  }
}

/**
 * 选出该文件里对应 `pluginName` 的插件块。
 * 命中顺序：同名 → `default:`（`import x from './y.js'` 而 y 里是 default export）。
 * 都不中返回 `null`（调用方据此只作 barrel 下钻，不收直接路由）。
 */
function pickPluginBlock(plugins, pluginName) {
  const exact = plugins.find((p) => p.name === pluginName)
  if (exact) return exact
  return plugins.find((p) => p.name.startsWith('default:')) ?? null
}

// ── 主流程 ──────────────────────────────────────────────────────────────

const state = newState()
for (const entry of ENTRY_FILES) collectFromEntryFile(entry, state)

// 取材面非空断言。**先判取材面、再谈冲突** —— 顺序反了就会出现
// "扫了零个文件 ⇒ 未发现重复路由 ⇒ exit 0"，把失效的判据报成通过。
if (state.entryFilesRead === 0 || state.registerCalls === 0 || state.scannedFiles.size === 0) {
  console.error(
    `取材面为空:入口文件读到 ${state.entryFilesRead} 个、register 抽到 ${state.registerCalls} 条、` +
      `路由文件扫到 ${state.scannedFiles.size} 个。`,
  )
  console.error(
    `入口清单: ${ENTRY_FILES.map((f) => relative(ROOT, f)).join(', ')}`,
  )
  console.error(
    '这不是"全仓无重复路由",是取材面失效(路径/后缀/入口漂移)。已中止,不得据此下结论。',
  )
  process.exit(1)
}
const routeEntries = state.routeEntries

const counts = new Map()
for (const entry of routeEntries) {
  if (!counts.has(entry.full)) counts.set(entry.full, [])
  counts.get(entry.full).push({
    pluginName: entry.pluginName,
    prefix: entry.prefix,
    localPath: entry.localPath,
  })
}

const duplicates = []
for (const [full, sources] of counts) {
  if (sources.length > 1) {
    // 去重展示：同一 (plugin, prefix, localPath) 重复挂载不算冲突。
    const keySet = new Set(sources.map((s) => `${s.pluginName}:${s.prefix}:${s.localPath}`))
    if (keySet.size > 1) duplicates.push({ full, sources })
  }
}

// 报数行：让"扫了多少"与"报了多少"同屏可读。取材面从 5 条扩到 4196 条后，
// 这两行是复核量表的第一手凭据 —— 也让"扫零个文件"这件事**可见**（两行都是 0）。
console.log(
  `取材面:入口 ${state.entryFilesRead} 个 · register ${state.registerCalls} 条 · ` +
    `路由文件 ${state.scannedFiles.size} 个 · 路由条目 ${routeEntries.length} 条 · ` +
    `最大下钻深度 ${state.maxDepth} · 再导出转发 ${state.forwarded} 次`,
)
console.log(`注册插件(去重): ${new Set(routeEntries.map((e) => e.pluginName)).size} 个`)
console.log('')

if (duplicates.length === 0) {
  // 措辞必须点破覆盖面：这不是"全仓无冲突"，是"在**已进面的**字面量路由上无冲突"。
  // 文件头列了三类已知边界（工厂式注册 / 内联匿名子插件 / 动态路径），
  // 读者只看到"未发现重复路由"会把 4196 条的结论误读成全仓。
  console.log('未发现重复路由（在已进面的字面量路由上；覆盖面见脚本头「已知边界」段）')
  process.exit(0)
}

console.log(`发现 ${duplicates.length} 条重复路由：\n`)
for (const d of duplicates) {
  console.log(d.full)
  for (const s of d.sources) {
    console.log(`  - ${s.pluginName} @ ${s.prefix || '/'} (${s.localPath})`)
  }
}
// 本门刻意**不因存在重复路由而 exit 非零**：本仓当前这 0 条，且已知的三类边界
// 精度不足以支撑判红。exit 0 不等于"通过"，只等于"本门只负责报数"。
// 判红起点由另一票决定（先把已知边界那三类补齐，再谈恒红门）。
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
