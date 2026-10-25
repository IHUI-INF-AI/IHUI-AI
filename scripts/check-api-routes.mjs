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
 *
 * ## 两条取材腿(2026-10-19 起)
 * - **主腿** `extractFrontendCalls`:`pathRe` 认「引号紧邻 `/api/`」的字面量(字符类刻意保留
 *   `$ { }`,改动那一行会被 `scripts/tests/check-api-routes-template-interp.test.mjs` T5 拦)。
 *   机制⑤(字符串谓词不算调用点)、`:param` 假影归「未判定(有传输口却抽不出路径)」桶、
 *   `shapeUnknown` 文件级判据(`calls.length === 0`)—— 本笔改动**一字未动**。
 * - **BP 腿** `extractBareTransportCalls`(2026-10-19 立):认「传输口 URL 实参位上引号紧邻、
 *   但不以 `/api/` 开头」的裸路径字面量(`fetchApi('/course-qa')` 这一族),按 transport
 *   `normalizeUrl` 现读的裸路径补前缀档归一成 `/api/…` 再对账。立因与判据纪律见该函数上方注释。
 *   - 基线件:`scripts/data/api-routes-bare-path-baseline.json`(`--update-bare-baseline` 生成);
 *     定级口径 = **差值棘轮、只拦新增**(HEAD 面现读存量 28 处 / 11 个文件,逐条分类写在基线
 *     `reason` 里);基线不在面里 ⇒ 该腿未判定、逐条列出、不判红(§12e 恒红门禁令)。
 *   - 三态:整仓面一个候选都没抽到 ⇒ 未判定 exit 2(取材失效);桶加总对不上候选 ⇒ 未判定 exit 2
 *     (坏的是尺子);transport 的归一档读不出 ⇒ 该腿一条不判并点名(不硬补前缀)。
 *   - BP 腿**不进** `allCalls`,不改 `前端 API 调用: N 处` 汇总行,也不进主基线 —— 它有自己那份
 *     锚点,这样"新腿看见的存量"不会被读成主腿的新增。
 */
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import {
  GENERIC_ARGS_SRC,
  expandNestedRegisterRoutes,
  expandTemplatedRoutes,
  findBraceBlockEnd,
  findMatchingBracket,
  normalizePath,
} from './lib/api-route-registration-expand.mjs'
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
// O87g(2026-10-22):后端注册面的**精确挂载图**提取式(Fastify 挂载图 + 工厂/模板/内联别名)。
// 立门因由与提取式覆盖宽度见该文件头注;本门只在 `server.ts` 在面时用它当判据,
// 不在面时退回旧的「前缀假设」拼接档(见 `buildCompositePrefixes` 调用点)。
import {
  extractApiRegistrations,
  VERBS as BACKEND_VERBS,
  combinePyPrefix,
  buildPyIncludeMaps,
  classifyRouteCoverage,
} from './lib/route-registration-extract.mjs'
// G-962c(2026-10-24):方法推导判据的单一真相源在 lib —— 门体只 import 这一份,
// 不得自带第二份实现(镜像测试 T10 接线锁:门内出现同名函数**定义**即红;§0.6)。
import { inferMethodAtLine } from './lib/api-route-method-infer.mjs'
import { runSelfTest } from './lib/api-routes-selftest.mjs'

/**
 * ROOT 由脚本自身位置推导(§15)。此前是 `process.cwd()` —— "扫哪棵树"由调用者站哪决定,
 * 且钩子/服务账户的 cwd 与交互终端不通(守门 70 的镜像测试 13/14 恒红、13c 的夹具失效同型)。
 * `--root <dir>` 保留为**测试通道**,且只在 `--worktree` 档有效:换根却仍按 HEAD/索引读
 * 就是双根分裂,产出自洽而基准错位的尺子 ⇒ 直接判死(参照守门 2e-dupns 的同一口径)。
 */
const HERE = dirname(fileURLToPath(import.meta.url))
// G-322(本站):`--root` 走本文件唯一的带值旗标出口 `dumpFlagValue`(它已同时认
// `--root <值>` 与 `--root=<值>`,并对"被下一枚旗标顶值 / 等号后为空"点名)。
// 但旧站点只取返回值:给了 `--root` 却没有有效值时它会**静默按默认根继续判**,
// 而那面正是调用方以为判过的东西 ⇒ 这里补一句"给了却没值 ⇒ 未判定",不猜根、不静默降级。
const rootRaw = dumpFlagValue('--root')
if (rootRaw === null && process.argv.some((a) => a === '--root' || a.startsWith('--root='))) {
  console.error('[API 路由比对] ❌ 给了 --root 却没拿到有效值 ⇒ 未判定(不得静默退回仓内默认根;原因见上一行)')
  process.exit(2)
}
const ARG_ROOT = rootRaw ? resolve(process.cwd(), rootRaw) : null
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
/**
 * Next.js rewrite 规则面(2026-10-04 新增判据的**唯一**取材点)。
 * 只读它、绝不改它(§"只改 scripts/")。为什么必须读它而不是在前门里抄两条前缀:
 * `continue` 的正当性完全取决于"web 端真有这条 rewrite 把该前缀转发到 ai-service",
 * 而那是 next.config.ts 的**事实**;抄成硬编码前缀 = 把事实抄成断言,规则被删时门仍装看不见
 * (2026-10-04 本票的原始病根:规则删了、门还绿、路径已真 404)。
 */
const NEXT_CONFIG_REL = 'apps/web/next.config.ts'
/** 三端首次纳入的死调用棘轮基线(锚点 = 该文件在基线里的存量数,新增才判红) */
const BASELINE_FILE_REL = 'scripts/api-routes-baseline.json'
/**
 * ===== 裸路径传输口腿(BP 腿)的棘轮基线(2026-10-19 立) =====
 * 本腿看得见的是「`fetchApi('/course-qa')` 这类**引号紧邻但不以 `/api/` 开头**的裸路径字面量」——
 * 它们在运行期由 transport 的 `normalizeUrl` 补成 `/api/…`,而原有的 `pathRe` 要求引号紧邻
 * `/api/`,所以这一族**一条都不进调用集**(立因见 `extractBareTransportCalls` 上方注释)。
 * 存量必须先量出来再定级(§12e):基线件在位 ⇒ 只拦新增、存量只报数;
 * 基线件不在面里 ⇒ 该腿本轮**未判定**(逐条列出、不判红也不记绿,与 `BASELINE_FILE_REL` 同一手法)。
 */
const BARE_LEG_BASELINE_REL = 'scripts/data/api-routes-bare-path-baseline.json'
/**
 * 「未判定(前缀假设命中)」两腿的裁决台账(票 G-962 续作 2026-10-22 立)。
 * 主腿按 method|path 全局去重 ⇒ 台账 leg=main 用 method|path;BP 腿按 method|path|file 去重
 * ⇒ 台账 leg=bare 用 method|path|file —— 与各自去重键同构,不另发明第三把尺子(§0.6)。
 * 缺档 ⇒ 两腿维持未判定(不判红也不下降,与 BP 基线缺档同一手法);
 * 三型判红:AJ1 条目形状不全 / AJ2 到期未复裁 / AJ3 台账条目在 head 整仓面找不到对应站点(清单腐烂)。
 */
const ASSUMPTION_ADJ_FILE_REL = 'scripts/data/api-routes-assumption-adjudications.json'

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
    //     `/api/` —— 归一档只被 CE① 读、主对账从不应用,所以它**一条都不进调用集**。
    //     **这一格结构上无法由静态门判死**:真路径取决于运行期宿主注入的 base URL 与是否命中
    //     rewrite,静态读不到(与票面"任一后端在册即算活"那条否证同源),把它判红就是存量恒红门
    //     (§12e),臆造路径就是造第二份真相。**取材扩展已实测否证**(抽进来死调用 0→4,
    //     4 条全是误报,误报率 100%,理由见 `collectAliasLiteralBlindSites` 上方注释)。
    //     ⇒ 2026-10-04 起由 `collectAliasLiteralBlindSites` 登记成「未判定(改写前缀字面量)」,
    //       **逐条带 `kind`(前缀常量声明/路径片段/真调用点)+ `adjudicable`(能不能判)+
    //       可判者的"归一后路径在册与否"**,输出无条件打印。
    //       即"没判"仍是"没判"(不判红,§12e),但**不再是无归属**:每一处都有判据和归属,
    //       读到这一面的人不会把它读成"已对账"。
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

/**
 * ===== 探针端(2026-10-04 新增):只报数档,默认**不进扫描面** =====
 *
 * 票面说"只扫 apps/web、其余零判据"——**现读已不成立**(FRONTEND_ENDS 早已 7 端,
 * 见上)。本轮实测真正**没有任何判据**、且面里确有真实(非注释)路径字面量的只有两处:
 *   · `packages/shared/src/auth/sso-core.ts` —— `SSO_ENDPOINTS` 对象里 4 条 `/api/auth/sso/*`,
 *     真由 `fetch(\`${apiBase}${SSO_ENDPOINTS.x}\`)` 发出(base 由宿主注入)。
 *   · `packages/sdk/src/agent-engine.ts:292` —— `const RPC_PATH = '/api/engine/rpc'`。
 * 其余含 `/api/` 的位置全在**注释**里(遮罩已判掉,见 use-agents/use-articles/use-login-form)。
 *
 * 为什么这一档**默认关**:票面要求"默认档读数一字不变"。新端一旦默认入面,输出会多出
 * 6 行统计、staged 档的"暂存区无前端文件"提前退出条件也会变窄 —— 那都是既有调用者看得见的
 * 变化。所以做成显式 opt-in:--probe-ends 才入面。
 *
 * 为什么这一档**永不判红**(与 `ratchet:true` 有本质区别,别混):
 * `ratchet:true` = 存量走基线锚点、**新增仍判红**;探针端 = 连新增也不判红,
 * 死调用只进统计桶。原因见 §12e:判据刚上就对新端判红 = 一台与任何提交都无关的恒红门,
 * 唯一结局是逼人 `--no-verify`、连带废掉全部守门。先把真实存量量出来,再谈起点定在哪。
 */
const PROBE_ENDS = [
  { name: 'shared-pkg', dir: 'packages/shared', probe: true },
  { name: 'sdk', dir: 'packages/sdk', probe: true },
  { name: 'auth-pkg', dir: 'packages/auth', probe: true },
  { name: 'types-pkg', dir: 'packages/types', probe: true },
  { name: 'mobile-cap', dir: 'apps/mobile-cap', probe: true },
]
/**
 * 刻意**不**纳入的目录,以及为什么(纳了就是噪声,不是判据):
 *  · `apps/desktop` —— `git ls-files` 实测 `.ts/.tsx/.js/.jsx` **0 个**(Tauri 壳 + `.mjs` 脚本,
 *    而 `.mjs` 不在 FRONTEND_EXTS)。入面只会在每次跑都恒报"枚举到 0 个受管源文件",
 *    那是一条永远红的假警报,不是判据。
 *  · `packages/database` / `ui-react` / `ui-native` / `browser-platform` / `dom-actions` /
 *    `context-compaction` / `design-tokens` —— 实测含 `/api/` 或 `/cozeZhsApi/` 字面量 **0 个**,
 *    也没有自建传输口(`fetch(`/`axios`)命中;它们经 `@ihui/api-client` 调后端,
 *    而那个包**已经在面里**(api-client)⇒ 同一批路径已在对账,再列一份是重复计数。
 */
const PROBE_MODE = process.argv.includes('--probe-ends')
const ACTIVE_ENDS = PROBE_MODE ? [...FRONTEND_ENDS, ...PROBE_ENDS] : FRONTEND_ENDS
const PROBE_END_NAMES = new Set(PROBE_ENDS.map((e) => e.name))

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
 *
 * ## 2026-10-04 加固:`params` 词条加否定前瞻(机制①,4 条误报)
 * 原判据把 `params` 与 `qs`/`query`/`search` 一视同仁 ⇒ `looksLikeQueryStringBuilder('params.id')`
 * 为真 ⇒ `` `/api/favorites/check/aiworld/${params.id}` `` 的**路径段被整段丢弃**,
 * 段数从 5 缩到 4,落进 3 段/4 段通配条目射程 ⇒ 误报。
 *
 * ### 判据依据(现跑实测,不是拍脑袋;量表脚本 `.DevEnv/Temp/apiroutes-ticket/census-params.mjs`
 * 与 `census-params-impact.mjs`,口径 = HEAD 面 8,906 个前端 ts/tsx/js/jsx)
 * 全仓模板串里含 `params` 的插值共 **181 条点访问形态** + **156 条非点访问形态**;
 * 但**判据真正起作用的只有** pathRe 命中且落在 `?` 之前的插值(尾部 `?.*` 已被
 * normalizeCallPath 整段丢弃,词条判不判都一样)—— 那上面:
 *  · **形态 B(`params.x` / `params?.[x]` / `params[k]`,取值=路径段):24 条,全部是 `${params.id}`**
 *    (分布:`/api/ai-world/`、`/api/refunds/`、`/api/asks/`、`/api/circles/` 等 Next.js 动态段)
 *    ⇒ 本仓 `params` 压倒多数是**路径段**,不是查询串;这 24 条现在全被整段丢弃。
 *  · **形态 A(独立 `params`,即 `?params=` 形态):0 条** —— 本仓**没有一条**这种用法。
 *  · 兜底核过:形态 A 那 25 条独立词条全是 `${qs}` / `${query}` / `${listQs}`
 *    (`/api/hooks${qs}`、`/api/context/mentions${qs}` 等),由 `qs`/`query` 词条继续命中,
 *    **不受本次改动影响**。
 * ### 为什么"最低限度否定前瞻"就够
 * 形态 A 影响面为 0 ⇒ 把 `params` 从"见词即查询串"改成"见词且**不**是属性/下标访问才算"
 * 不会误伤任何一条真查询串;而形态 B 24 条全部回到 `:param`(真实段形状)。
 * `searchParams` / `URLSearchParams` 词条**刻意不动** —— 它们的 `Params` 前面是字母,
 * 本就不靠 `params` 词条命中(词条边界要求非字母数字),改它会牵动 `URLSearchParams(...)`
 * 那类真查询串构造。
 */
function looksLikeQueryStringBuilder(expr) {
  return (
    /\?(?!\.)/.test(expr) ||
    /(^|[^a-zA-Z0-9_])(qs|query|search|params(?!\s*(?:\?\.|\.|\[))|filter|filters|sort|pagination|listQs|pageQuery|searchParams|queryString|searchQuery)([^a-zA-Z0-9_]|$)/i.test(
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
 * 「这段字面量是模板串插值,还是源码里真写着的字面量?」—— `:param` 假影的唯一判据
 * (2026-10-04 抽出,`matchSegs` 上方注释「收口次序 ① 取材侧修准 `:param` 假影」那一格)。
 *
 * ## 为什么需要它(pathRe 的字符类含 `$ { }` ⇒ 模板串插值被整段吃进路径)
 * `pathRe` 刻意含 `?&=%,+~#@!;`(2026-09-17 加固,为了让单行内联查询串整条匹配),
 * 字符类里的 `\$ { }` 是同一批加进来的。后果:`` `/api/subagents/all${suffix}` ``
 * 被抽成整串 `/api/subagents/all${suffix}`,经 normalizeCallPath 落成
 * `/api/subagents/all:param` —— 而运行期真实 URL 是 `/api/subagents/all`(suffix 是查询串)
 * 或 `/api/subagents/all?status=x`。**`:param` 那个段谁都没发过**,于是凭空一条死调用。
 *
 * ## 判据(严格照抄 normalizeCallPath 的执行次序,不是"结果串长这样")
 * 步骤1 `${expr}` → 查询串构造器 ? '' : ':param';步骤2 丢 `?.*`。
 * 于是 `${user?.id}` 里的 `?` 在步骤1 就被整段替换掉了,不会误落进步骤2。
 * 判「`?` 之前的路径部分里,有没有**字面量与 `:param` 粘连在同一段**」——
 * 那就是`:param` 假影:`all:param` / `ai-tutor:param` 都不是任何人会写的段。
 *
 * ## 三种形态必须分清(判据收窄过头的两种死法都在这里)
 *  ① 整段插值 `/api/activities/${slug}` ⇒ 段内除插值无字面量 ⇒ `:param` 就是**真实段形状**
 *     (后端 `/api/activities/:slug` 对得上)⇒ **真调用,必须留在调用集**。
 *  ② 粘连 + 查询串构造器 `/api/hooks${qs}` ⇒ qs 被整段删 ⇒ `/api/hooks` **就是真实 URL**
 *     ⇒ **真调用,必须留在调用集**。
 *  ③ 粘连 + 非查询串构造器 `/api/subagents/all${suffix}`、`/api/ai-tutor${path}`
 *     ⇒ 假影 ⇒ 不进调用集(归 shapeUnknown 桶,见 extractFrontendCalls)。
 *
 * ## 为什么不做"收窄 pathRe 字符类"(方案 a,已实测否证)
 * pathRe 要求**收尾引号紧邻**路径。把 `$ { }` 从字符类去掉,整条字面量就**匹配不上**
 * (实测 `/api/subagents/all${suffix}` 连 `/api/subagents/all` 都抽不出)⇒ 1158 条
 * 真实插值调用(形态 ①②)会一起消失,那是 2774 个调用点里的大半 ⇒ 判据整体失明。
 * 且形态 ①② 的归一结果本来就是对的,收窄正则**没有任何收益**。故取本方案(标记 +
 * 归入既有的「未判定(有传输口却抽不出路径)」桶),判定归属与既有的"抽不出路径"同口径。
 *
 * ## 面实测(2026-10-04,HEAD 面 = 工作树面,`scripts/_tmp-census-interp.mjs` 量得)
 * 复用 pathRe 原文扫 12 个前端面 5,404 行候选:命中 1,162 条含插值的路径,
 * 其中形态 ③(假影)**2 条**、形态 ①②(真实调用)1,158 条、另有 2 条无插值但含 `:`/`$`/`{`
 * 的真字面量(收窄正则的影响面,本方案**不触碰**)。逐条依据见交付报告。
 */
function isTemplateInterpolationPhantom(rawPath) {
  if (!rawPath.includes('${')) return false
  // 与 normalizeCallPath 同序:先落 :param,再看 `?` 之前的路径部分
  const marked = rawPath.replace(/\$\{([^}]+)\}/g, (_match, expr) =>
    looksLikeQueryStringBuilder(expr) ? '' : ':param',
  )
  const pathPart = marked.split('?')[0]
  return pathPart
    .split('/')
    .some((seg) => seg.includes(':param') && seg.replace(':param', '').length > 0)
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
  const out = {
    parsed: false,
    reason: '',
    rules: [],
    passthrough: [],
    ambiguous: 0,
    // 裸路径补前缀档(2026-10-19 为 BP 腿新增):normalizeUrl 里
    // `if (url.startsWith('/')) return \`/api${url}\`` 那一条。读得出 ⇒ 字符串前缀;
    // 读不出/多解 ⇒ null ⇒ **BP 腿整条未判定**(腿不得自己发明归一)。
    barePrefix: null,
    barePrefixCandidates: 0,
  }
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
  // ===== 裸路径补前缀档(BP 腿的归一事实源,2026-10-19) =====
  // 两种写法都读(模板串形态 `/api${url}` 与拼接形态 `'/api' + url`),取到的前缀必须**唯一**
  // 才采用;0 条 ⇒ barePrefix=null(BP 腿整条未判定);>1 个不同值 ⇒ 同样不采用(计入
  // barePrefixCandidates 如实报名)。判序与上面改写档同一条纪律:守卫与替换式不同形就不猜。
  {
    const bare = new Set()
    // `if (url.startsWith('/')) return \`/api${url}\`` —— `startsWith('/'))` 之后那个 `)` 属于 `if (`
    // 自己,所以守卫的右括号要允许连吃若干枚(实测少写这一档 ⇒ 裸路径档读成 0 条、整条腿未判定)。
    const tplRe =
      /url\.startsWith\(\s*['"`]\/['"`]\s*(?:\)\s*)+return\s*(['"`])([^'"`$]*)\$\{\s*url\s*\}/g
    const catRe =
      /url\.startsWith\(\s*['"`]\/['"`]\s*(?:\)\s*)+return\s*(['"`])([^'"`]*)['"`]\s*\+\s*url\s*(?=\))/g
    for (const re of [tplRe, catRe]) {
      let bm
      while ((bm = re.exec(body)) !== null) {
        const p = bm[2]
        if (p.startsWith('/')) bare.add(p)
      }
    }
    out.barePrefixCandidates = bare.size
    if (bare.size === 1) out.barePrefix = [...bare][0]
  }
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
 *
 * ## 2026-10-04 本票:把这一格从"没有判据"改成"逐条有判据"(措辞随之重写)
 *
 * ### 先前的错在哪(不是"判红",是**连桶都没进**)
 * 本档原先只把 8 处**列出来**,既不说它们各自属哪一型、也不说能不能判 ——
 * 于是这一格在读数里"看得见名字、看不见归属",与既有的 `shapeUnknown` 桶并列却无人负责。
 *
 * ### 取材扩展:**实测否证**(量表见下,不是推理)
 * 试过把这类字面量也抽进调用集(`/cozeZhsApi` → `/api` 归一后参与对账)。**死调用从 0 变 4**,
 * 逐条裁决结果是 **4 条全是误报(误报率 100%)**:
 *   · WS 四条(`use-ai-websocket.ts:15-18`)—— 后端 `ws-ai.ts:805-808` 用**裸 `/cozeZhsApi` 前缀**
 *     注册(`server.get(path,…)` 的 `path` 是**变量实参**,后端取材同样抽不出),而前端
 *     `buildWsUrl`(`apps/web/src/lib/ws-url.ts:51-63`)**原样拼接、不过 normalizeUrl**
 *     ⇒ 归一成 `/api/ws/*` 就是凭空造一条谁都没发过的请求。**改写档对 WS 不成立。**
 *   · `HomeScreen.tsx:569/577` —— 真调用点,但 `/api/agents/collect` 后端**确实没有**
 *     (`agentsRoutes` 挂 `prefix:'/api'` + `server.post('/collect')` ⇒ 真路径是 `/api/collect`)。
 *     这两条是**真错**,但**归因不同**(见下"为什么不修"),且当存量判红就是恒红门(§12e)。
 *   · `agent.ts:97` —— 真调用点,`/api/cache/agent-category-dict/categories` 后端也没有
 *     (真实端点是 `agent-categories-cache.ts` 的 `/api/agent-categories/cache*`)。**真错**。
 * ⇒ 误报率 100% ⇒ **不扩展取材**(守门 skill §3b:形态可疑 ≠ 形态异常,先找反例;
 *   找到反例就说明该形态是常态,扩展必误杀)。**只让这一格有归属。**
 *
 * ### 本票实际交付:逐条分类 + 报名(不新增任何判红路径)
 * 每一处站点现在带三个字段,读者一眼能分清"这一处到底是什么":
 *   · `kind` —— `prefixConstant`(整条就是前缀常量声明,**不是调用点**)/
 *                `pathFragment`(路径字面量但**本行无传输口**,真调用在别处)/
 *                `callSite`(本行有传输口,**是真调用点**)
 *   · `adjudicable` —— 该形态**能不能**静态判(见下三条判据)
 *   · `reason` —— 逐条依据
 *
 * 三类的可判性(这是本票新增的判据,不是措辞):
 *   ① `prefixConstant`(`backend-paths.ts:10 const COZE = '/cozeZhsApi'`)
 *      **不可判** —— 它是**前缀事实源的声明**,不是一次请求。归一后 `/api` 不是一条路径。
 *      真正的调用点是它下游那 43 处 `` `${COZE}/…` `` 插值,而插值形态进不了 `pathRe`
 *      (与 `:param` 假影同族);那个文件另有 35 条可抽取的 `/api/` 字面量 ⇒ `calls.length>0`
 *      ⇒ **它也进不了 `shapeUnknown` 桶**(该桶判据是 `calls.length===0`)。
 *      **这就是本格"无归属"的机械原因**,也是为什么不能简单并桶。
 *   ② `pathFragment`(`use-ai-websocket.ts:15-18` 的 `PROVIDER_PATHS` 四条)
 *      **不可判**,且**改写不成立** —— 消费方 `buildWsUrl` 原样拼 WS origin,不过 `normalizeUrl`;
 *      后端也用裸 `/cozeZhsApi` 注册。归一后的 `/api/ws/*` 是谁都没发过的路径。
 *   ③ `callSite`(`HomeScreen.tsx:569/577`、`agent.ts:97`)
 *      **可判** —— 真调用点,归一后路径即运行期真实 URL。本门**不判红**(存量当场 blocking
 *      = 恒红门,§12e),但把"归一后路径 + 在册与否"**逐条算出来报名**,让这三处的
 *      真实状态(其中 3 条后端确实没有)不再读成"已对账"。
 *
 * 前缀事实源仍是 transport 现读的改写档(门内不得有第二张前缀表:T-CE-7 的同一条禁令);
 * 识别式与 ③ 共用 `aliasLiteralRe`,判在**遮注释面**(注释里逐字引用 JSX/字面量的说明不算站点)。
 */
function collectAliasLiteralBlindSites({ frontendFiles, alias, hasRoute }) {
  const out = []
  if (!alias || !alias.parsed || alias.rules.length === 0) return out
  for (const { file, src } of frontendFiles) {
    if (src === null || src === undefined) continue
    // transport 自己不是调用方:它体内的 `startsWith('/cozeZhsApi')` 是**改写规则定义**,
    // 把它当站点会让门把事实源读成消费者(与 findLiveAliasSites 同一条自指型假阳防护)
    if (file === CLIENT_TRANSPORT_FILE) continue
    const maskedLines = maskComments(src).split('\n')
    const rawLines = src.split('\n')
    for (const rule of alias.rules) {
      const litRe = aliasLiteralRe(rule)
      maskedLines.forEach((line, idx) => {
        if (!litRe.test(line)) return
        const raw = (line.match(litRe)?.[0] || '').slice(1, -1) || rule.from
        const cls = classifyAliasLiteralSite(line, raw, rule)
        const entry = {
          file,
          line: idx + 1,
          raw,
          rewritten: rule.to + raw.slice(rule.from.length),
          ...cls,
        }
        // 只有**可判**型才问在册与否 —— 对不可判型问它就是拿一个"谁都没发过的路径"去查注册面,
        // 查出来"不在册"会被读成"缺后端路由",而事实是那一族根本不经过改写(见 classify 的 ②)。
        if (cls.adjudicable && typeof hasRoute === 'function') {
          const method = inferMethodAtLine(rawLines, idx)
          entry.method = method
          entry.registered = aliasPathCandidates(normalizeCallPath(entry.rewritten)).some((c) =>
            hasRoute(method, c),
          )
        }
        out.push(entry)
      })
    }
  }
  return out
}

/**
 * 站点分类(2026-10-04):把"这一处到底是什么"变成机器可读的三个字段。
 * 刻意**只分类、不裁决生死** —— 判红与否是调用方的事,这里只回答"能不能静态判"。
 *
 * ## `kind` 的三型(判据:整行形态 + 同行有无传输口,判在**遮注释面**)
 * ① `prefixConstant` —— 整行就是"前缀 = '<from>'"的常量声明。
 *    识别式:`const|let|var NAME = '<from>'` 且后面**没有** `/` 续段(没有续段 ⇒ 它是前缀本身,
 *    不是一条以它开头的路径)。**它不是调用点**:归一后是 `/api` 这样的前缀,不是一条路径。
 * ② `pathFragment` —— 有续段(是条路径),但**本行无传输口** ⇒ 片段/表项,真调用在别处。
 * ③ `callSite` —— 本行有传输口(`LINE_TRANSPORT_RE`,与机制⑤共用同一份实现)⇒ **真调用点**,
 *    归一后路径即运行期真实 URL。
 *
 * ## `adjudicable` 的判据(为什么 WS 表项那一类"改写不成立")
 * 归一(改写前缀)**只对经 `normalizeUrl` 的调用成立**。三型里只有 ③ 一定是那种调用;
 * ② 要看消费方 —— WS 出口(`buildWsUrl`)原样拼 origin、**不过 normalizeUrl**,
 *    后端也用裸前缀注册,所以那一类归一后的路径是**谁都没发过的**,判它等于造假影。
 * 这里对 ② 一律记 `adjudicable:false` 并把"消费方未经改写"写进 reason(有据可查:
 * `apps/web/src/lib/ws-url.ts:51-63` 与 `apps/api/src/plugins/ws-ai.ts:805-808`)。
 *
 * ## 为什么不judge ① 和 ② 能不能进 `shapeUnknown` 桶
 * `shapeUnknown` 的判据是**文件级** `calls.length === 0`(见 extractFrontendCalls 调用方),
 * 而 `backend-paths.ts` 另有 35 条可抽取的 `/api/` 字面量 ⇒ `calls.length>0` ⇒ 天然进不了那个桶。
 * 这就是"并桶"这条路走不通的机械原因(不是取舍偏好),也是本票保留独立命名档的原因。
 */
function classifyAliasLiteralSite(maskedLine, raw, rule) {
  const rest = raw.slice(rule.from.length)
  if (rest === '') {
    return {
      kind: 'prefixConstant',
      adjudicable: false,
      reason:
        '这一行是**前缀常量声明本身**,不是一次请求(归一后只是前缀,不是路径);' +
        '它下游的 `${前缀}/…` 插值形态进不了 pathRe,那些调用点本门结构上看不见',
    }
  }
  if (!LINE_TRANSPORT_RE.test(maskedLine)) {
    return {
      kind: 'pathFragment',
      adjudicable: false,
      reason:
        '本行无传输口 ⇒ 是路径片段/表项,真调用在别处;且 WS 出口原样拼接不过 normalizeUrl' +
        '(buildWsUrl apps/web/src/lib/ws-url.ts:51-63,后端 ws-ai.ts:805-808 亦用裸前缀注册)' +
        '⇒ 归一后的路径谁都没发过,不可判',
    }
  }
  return {
    kind: 'callSite',
    adjudicable: true,
    reason: '本行有传输口 ⇒ 真调用点,归一后路径即运行期真实 URL(可判;本轮只报名不判红,§12e)',
  }
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
 * 提取前端 API 调用路径，返回 [{ method, path, file, line }]
 * `opts.cli` = 该文件所属端已解析出的 createApiRequest 工厂绑定(仅 `apps/cli` 传),
 * 用于把"路径住在第二个实参"的形态拼回完整路径,并**不再把前缀常量声明行当调用点**
 * (它只是片段);其余端 opts 省略 ⇒ 行为与本笔改动前逐字相同。
 */
/**
 * 「这一行上有没有传输口」——**文件级唯一实现**,两处消费者共用(守门 70/131 同型:
 * 同一条判据在两处各抄一遍必然漂移,而这里漂移的后果是"片段"与"调用点"给出不同答案)。
 *
 * ① `extractFrontendCalls` 的机制⑤(子串匹配不是调用点)判的是**遮罩行**;
 * ② `classifyAliasLiteralSite` 判"改写前缀字面量是调用点还是片段"用的是同一个式子。
 * 泛型传输口(`fetchApi<T>(`)必须单独认 —— 本仓绝大多数真调用走本地 wrapper,
 * 少了泛型分支会把它们整族读成片段。
 */
const LINE_TRANSPORT_RE =
  /\bfetchApi(?:<[^<>]*>)?\s*\(|\bfetch(?:<[^<>]*>)?\s*\(|Taro\.request|\bwx\.request|\bmy\.request|\btt\.request|XMLHttpRequest|axios\.|\brequest(?:<[^<>]*>)?\s*\(/

/**
 * ============================================================================
 * next rewrites 转发面:从 `apps/web/next.config.ts` **真读**出来的判据
 * ============================================================================
 *
 * ## 为什么必须读,不能在前门抄前缀(本票的原始病根)
 * 改前这里有两行 `continue`,注释写着"走 Next.js rewrite 到 ai-service":
 *   `if (!cliShapes && rawPath.startsWith('/api/llm/')) continue`
 *   `if (!cliShapes && rawPath.startsWith('/api/voice/')) continue`
 * 那是**人工断言**,不是判据。断言与事实脱钩的后果是"规则删了门还装看不见":
 * 哪天有人从 next.config.ts 删掉 `/api/llm/:path*` 那条 rewrite,这两行**照样跳过**
 * ⇒ 门继续绿,而 `/api/llm/*` 在生产已真的 404(8802 无该路由 ⇒ 落到 8802 兜底后 404)。
 * 判据与被它断言的那个文件之间必须有一条**读取边**,否则删规则这件事永远不触发本门。
 *
 * ## 分面在**取值处**做,不在匹配处做(本票硬要求)
 * `next.config.ts` 里两类 destination 常量都往 `/api/*` 上落:
 *   · `IHUI_AI_PROXY_TARGET`(默认 8803,ai-service)= **别的进程**,本门静态面看不见它,
 *     所以这类前缀的调用点**不进对账**(与既���「不透明挂载未判定」同口径:不判死、只报)。
 *   · `IHUI_API_PROXY_TARGET`(默认 8802,apps/api 自己)= **就是本门的对账对象**。
 *     ⚠️ 8802 面里有一条 `source: '/api/:path*'` 兜底(现读 `next.config.ts:712`),
 *     它覆盖**全仓每一个 `/api/*`**。若把它当成"已验面",本门主面就被自己豁免掉了 ——
 *     全仓任意 `/api/whatever` 都不会再进对账,那不是修好,是把门打瞎。
 * 所以 `parseNextRewriteForwardFaces` 一进函数就**按 destination 的目标常量把每条规则
 * 归面**(ai / api / other),`forwardedPrefixes` 只装 ai 面。匹配函数**只面对已分面的集合**,
 * 它自己不知道也不需要知道 destination —— 分面责任全在取值处(守门 8 同型:
 * 同一条判据在两处各抄一遍必然漂移)。
 */

/** next.config.ts 里两条 destination 目标常量的**字面**判别式(取值处专用) */
const REWRITE_TARGET_AI = 'IHUI_AI_PROXY_TARGET' // ai-service 进程(非 apps/api)
const REWRITE_TARGET_API = 'IHUI_API_PROXY_TARGET' // apps/api 进程(= 本门对账对象)

/**
 * 一条 next `source` 模式 → 段序列。`/api/llm/:path*` ⇒ `['api','llm',':path*']`。
 * 前导 `/` 产生的空段被切掉(切的是**首段**那个空,不是尾段 —— 尾段空有语义,见下)。
 */
function rewriteSourceSegments(source) {
  const segs = String(source).split('/')
  if (segs.length > 0 && segs[0] === '') segs.shift()
  // 末尾斜杠:Next.js 的 source 写不写都能匹配同一条路径,归一掉免得两形态各判一次
  while (segs.length > 0 && segs[segs.length - 1] === '') segs.pop()
  return segs
}

/**
 * 一条 `source` 模式能否命中一条调用路径 —— **双向语义**:
 *   形态         命中                          不命中
 *   `:path*`     `/api/llm` `/api/llm/x` `/api/llm/x/y`   `/api/llmx` `/api/voice/x` `/api`
 *   `:path+`     `/api/llm/x` `/api/llm/x/y`               `/api/llm`(零段不合 +)
 *   `:path?`     `/api/llm` `/api/llm/x`                   `/api/llm/x/y`
 *   `:param`     `/api/llm/x`(恰好一段)                    `/api/llm` `/api/llm/x/y`
 *   精确字面段   `/api/llm/chat`                           `/api/llm/chat/x` `/api/llmx`
 *
 * ⚠️ **前缀必须按整段比,不能 `startsWith`**:`:path*` 的语义是"吃掉 0..N 个**完整**段",
 * 而 `'/api/llmx'.startsWith('/api/llm')` 为真 —— 那是把 `llmx` 读成 `llm` + 后缀,
 * 会把 `/api/llmxxx` 整族误判成已转发。`:path*` 收在**末段**时(本仓 39/53 条都是这种)
 * "前缀 + 任意尾部"等价于按段前缀比,所以实现上按段处理天然正确。
 *
 * 返回命中的那条 `source`(便于报告点名是哪条规则给了豁免),不命中返回 null。
 */
function matchRewriteSource(source, callPath) {
  const s = rewriteSourceSegments(source)
  const p = rewriteSourceSegments(callPath)
  // Next.js 的 source 不含捕获组语法(实测本仓 53 条 ai 面 + 4 条 api 面:
  // 参数形态只有 `:path*`(39)与 `:param`(7),零条带内联正则/自定义 pattern)。
  // 见到未知形态(段内含 `(` 或 `:` 之外的花括号)⇒ **不猜**,返回 null。
  //   后果方向是"不豁免 ⇒ 路径进对账 ⇒ 至多误报,绝不漏报";与 parseNextRewriteForwardFaces
  //   的 unknownSource 计数一起报告,不会静默。
  const norm = []
  for (const seg of s) {
    if (seg === '') return null
    if (seg.startsWith(':')) {
      const m = seg.match(/^:([A-Za-z0-9_]+)([*+?]?)$/)
      if (!m) return null
      norm.push({ param: m[1], mod: m[2] || '' })
    } else {
      if (/[(){}]/.test(seg)) return null
      norm.push({ lit: seg })
    }
  }
  // 逐段回溯(段数极小,无性能顾虑):`i` 走模式,`j` 走路径
  //
  // ⚠️ `take` 的上界是**剩余段数** `p.length - j`,不是 `j`(2026-10-04 首版写错成 `j`,
  // 被 A/B 逐条对照当场抓住:`/api/llm/fim/metrics/summary` 是 5 段、`j` 到 llm 时只有 2,
  // 上界被压成 2 ⇒ `:path*` 最多吃 2 段 ⇒ 4 段真调用点漏豁免、调用集 2753 → 2754)。
  // 这类"上界写错 ⇒ 少豁免 ⇒ 多对账"的方向是安全的(至多误报),但仍必须钉死。
  const walk = (i, j) => {
    if (i === norm.length) return j === p.length
    const item = norm[i]
    if ('lit' in item) return j < p.length && p[j] === item.lit && walk(i + 1, j + 1)
    // 参数段:`*` 吃 0..N,`+` 吃 1..N,`?` 吃 0..1,裸 `:p` 吃恰好 1
    const avail = p.length - j
    let lo
    let hi
    if (item.mod === '') {
      lo = 1
      hi = 1
    } else if (item.mod === '?') {
      lo = 0
      hi = Math.min(1, avail)
    } else if (item.mod === '+') {
      lo = 1
      hi = avail
    } else {
      lo = 0
      hi = avail
    }
    for (let take = lo; take <= hi; take++) {
      if (walk(i + 1, j + take)) return true
    }
    return false
  }
  return walk(0, 0) ? String(source) : null
}

/**
 * 从 `apps/web/next.config.ts` 文本解析出「由 next rewrites 转发到**非 apps/api** 目标」
 * 的 source 前缀集合。**分面在取值处完成**(见本节顶部「分面在取值处做」)。
 *
 * 返回 `{ read, forwardedPrefixes, selfFacePrefixes, otherRules, unknownSource }`:
 *  · `forwardedPrefixes`   ai 面(IHUI_AI_PROXY_TARGET)—— 唯一可用来豁免的集合
 *  · `selfFacePrefixes`    api 面(IHUI_API_PROXY_TARGET)—— **只登记,永不豁免**(见顶部 ⚠️)
 *  · `otherRules`          destination 既非两个常量(如字面 `http://localhost:80/...`)——
 *                          无法归属任一面 ⇒ 不豁免,并在报告里点名
 *  · `unknownSource`       source 形态判据认不出的条数(不猜 ⇒ 不豁免)
 *  · `read=false`          文件取不到(见 `nextRewriteExemption` 的降级口径)
 *
 * 判据必须只认**字面**的 `source: '...'` / `destination:` 对象字面量形态:next.config.ts 里
 * 唯一的另一种 `source` 在 `headers()`(`source: '/(.*)'`),它没有 `destination`,
 * 配对不上自然落空 —— 这就是为什么这里按"source 行 + 其后 4 行内找 destination"配对,
 * 而不是全文扫 destination。
 */
function parseNextRewriteForwardFaces(src) {
  const out = {
    read: false,
    forwardedPrefixes: [],
    selfFacePrefixes: [],
    otherRules: [],
    unknownSource: 0,
    /** ai 面里**改前缀**的规则对(source 路径 ≠ destination 路径),供派生面消费 */
    pathMaps: [],
  }
  if (src === null || src === undefined) return out
  out.read = true
  const lines = String(src).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*source:\s*'([^']*)'\s*,?\s*$/)
    if (!m) continue
    const source = m[1]
    // 配对 destination:本仓形态是紧邻下一行;容 4 行是为 `destination` 折行的写法留余地。
    // 撞上 `}` 提前收口 ⇒ 这是非 rewrite 规则(headers 里的 source),不算。
    let dest = null
    for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
      const d = lines[j].match(/destination:\s*(.+?),?\s*$/)
      if (d) {
        dest = d[1]
        break
      }
      if (/^\s*\},?\s*$/.test(lines[j])) break
    }
    if (dest === null) continue
    if (dest.includes(REWRITE_TARGET_API)) {
      // apps/api 自己 = 本门对账对象。这条**只登记不豁免**;`/api/:path*` 兜底就在这里。
      out.selfFacePrefixes.push(source)
    } else if (dest.includes(REWRITE_TARGET_AI)) {
      // 未知形态计数放在这里而不是匹配处:分面已定,剩下的只是"这条 source 认不认得"
      if (rewriteSourceSegments(source).some((seg) => seg === '')) out.unknownSource++
      out.forwardedPrefixes.push(source)
      // 摘出 destination 的路径部分(template 的 `${IHUI_AI_PROXY_TARGET}` 前缀丢掉)。
      // 只有**字面 /api/ 开头**的才算;认不出形态 ⇒ 不派生(保守方向)。
      const dp = dest.match(/\/api\/[^`'"\s]*/)
      if (dp) out.pathMaps.push({ source, destPath: dp[0] })
    } else {
      out.otherRules.push({ source, destination: dest })
    }
  }
  return out
}

/**
 * 「边缘改写派生面」(G-962 收尾,2026-10-22):next rewrites 里**改前缀**的规则
 * (`/api/lsp/:path* → ai-service /api/v1/lsp/:path*` 等,owner 拍板的反代白名单)
 * 让"看着前缀错位"的前端调用在生产真实可达。本门旧判据只拿 rewrite 做**豁免**
 * (REWRITE_EXEMPTION_CLAIMS 两条),没拿它做**派生** ⇒ py 前缀拼接修好后,
 * lsp 4 条 + self-healing 1 条从「前缀假设未判定」浮成假红(实测:它们不是死调用,
 * 生产经 next rewrite 打到 ai-service /api/v1/*)。
 * 判据:对每条 (source,destPath) 且前缀不同者,把注册面里以 destPath 为段前缀的
 * 条目映射成 source 前缀的外部路径。**窄口径**:source/dest 的公共前缀段必须全是
 * 字面段(参数段对齐不做,保守不派生);`:path*` 尾 ⇒ 任意后缀;`:x` 裸参数尾 ⇒ 单段。
 * 派生条目逐条报名(报数必须报名,票面③),via='edge-rewrite'。
 * @returns {Array<{method:string,path:string,file:string,rule:string}>}
 */
function deriveEdgeRewriteEntries(backendEntries, pathMaps) {
  const derived = []
  for (const { source, destPath } of pathMaps) {
    const sSegs = rewriteSourceSegments(source)
    const dSegs = rewriteSourceSegments(destPath)
    if (sSegs.length === 0 || dSegs.length === 0) continue
    if (sSegs.join('/') === dSegs.join('/')) continue // 同前缀透明转发:注册面已是终形,不派生
    // 定尾长:两侧都到 :path* 为止的"固定段"数;超过部分不做(保守)
    const sWild = sSegs[sSegs.length - 1] === ':path*' ? 1 : 0
    const dWild = dSegs[dSegs.length - 1] === ':path*' ? 1 : 0
    const sFixed = sSegs.slice(0, sSegs.length - sWild)
    const dFixed = dSegs.slice(0, dSegs.length - dWild)
    // 通配对齐纪律:source 与 dest 的 `:path*` 尾必须**同有或同无**。
    // 同有 ⇒ 前缀映射(改前缀规则的段数差正是改写本身,不做长度相等约束);
    // 一有一无 ⇒ 形态不对齐,保守不派生;同无 ⇒ 精确一对一。
    if (sWild !== dWild) continue
    if (dFixed.some((seg) => seg.startsWith(':'))) continue // 目标含参数段 ⇒ 对齐不可判,不派生
    const prefixFrom = '/' + dFixed.join('/')
    const prefixTo = '/' + sFixed.join('/')
    const singleSegment = sWild === 0 && dWild === 0
    for (const e of backendEntries) {
      const p = e.path
      if (singleSegment) {
        if (p === prefixFrom) derived.push({ method: e.method, path: prefixTo, file: e.file, rule: `${source} → ${destPath}` })
        continue
      }
      if (p === prefixFrom || p.startsWith(prefixFrom + '/')) {
        derived.push({
          method: e.method,
          path: prefixTo + p.slice(prefixFrom.length),
          file: e.file,
          rule: `${source} → ${destPath}`,
        })
      }
    }
  }
  return derived
}

/**
 * 判据的**策略面**:本门声明"愿意为这两条前缀放弃对账"。
 * 它是政策(改前就写死在那两行 `continue` 里,本票不动它),不是事实 —— 事实由
 * `parseNextRewriteForwardFaces` 从 next.config.ts 读出,并由 `corroborateExemptionPrefixes`
 * 逐条给出"这条策略今天还成立吗"的裁定。
 *
 * 为什么策略面**不**改成"ai 面 53 条全豁免"(实测否证,数据见 `rewriteExemption` 处注释):
 * 那会让 101 条真调用点退出对账、2 条「不透明挂载未判定」消失,而死调用仍是 0 ——
 * 那一格从"判过且为 0"变成"看不见",是净失明。
 */
const REWRITE_EXEMPTION_CLAIMS = ['/api/llm/:path*', '/api/voice/:path*']

/**
 * 把一条 source 编译成段模式数组;形态认不出返回 null(不猜)。
 * `['api','llm',':path*']` ⇒ `[{lit:'api'},{lit:'llm'},{param:'*'}]`
 */
function compileRewriteSource(source) {
  const out = []
  for (const seg of rewriteSourceSegments(source)) {
    if (seg.startsWith(':')) {
      const m = seg.match(/^:([A-Za-z0-9_]+)([*+?]?)$/)
      if (!m) return null
      out.push({ param: m[2] || '' })
    } else {
      if (!/^[A-Za-z0-9_.~-]+$/.test(seg)) return null
      out.push({ lit: seg })
    }
  }
  return out
}

/**
 * 策略前缀 P 今天是否仍被 ai 面某条 source S 覆盖 —— 即"S 转发的那片路径包含 P 那片"。
 *
 * ## 判法:段模式的双游标包含判定(不是探针近似)
 * 探针法(拿一两条样本路径去试)在这里**两个方向都会漂**,实测两个反例:
 *  ① **收紧方向**:claim `/api/llm/:path*` 的探针 `/api/llm/chat` 与 `/api/llm/chat/x`,
 *     精确路径 `/api/llm/chat` 两条都命中 ⇒ 探针法把"精确更窄"判成覆盖
 *     ⇒ 免掉本该对账的路径。
 *  ② **放宽方向**(更危险):同样那两条探针,`/api/llm/:path?` 也全都命中
 *     ⇒ 探针法把"只覆盖一段"判成覆盖 `:path*` ⇒ 多段路径被豁免 ⇒ 门装看不见。
 * 两个方向都会漂,所以改成在**段**这一层做语言包含(L(P) ⊆ L(S))。
 *
 * 包含判定:两个游标 i(P)/ j(S)同步走。段语言宽度表(`*` = Σ*,`+` = Σ+,`?` = Σ∪{ε},
 * 裸 = Σ,字面 = 单个固定值):
 *   · S 该位是**无界**位(`*` / `+`)⇒ 它能吃任意值的任意段数。
 *     若它已是 S 的**末段** ⇒ P 剩下的全部(字面段与参数段都算)都被它吃掉 ⇒ 覆盖成立;
 *     若它**后面还有段**(如 `/api/:p*` 后面再跟一个字面段)⇒ 交错咬合不做判定,
 *     落"不覆盖"(保守方向)。
 *   · P 该位是**无界**位(`*` / `+`)⇒ S 该位必须**也是无界**位。
 *     `:p?` 与裸 `:p` 都**不算** —— 这一格就是上面探针法②翻车的那一格。
 *   · P 是字面段 ⇒ S 该位是同值字面,或任意形态的参数段(参数取任意值)。
 *   · P 是有界参数段(裸 `:p` / `:p?`)⇒ S 该位必须是参数段;
 *     S 是字面段则**不覆盖**(固定值盖不住"任意一段")。
 * P 走完 ⇒ 覆盖(S 可以更宽);S 走完而 P 仍有剩余 ⇒ 不覆盖。
 * 任一侧形态认不出 ⇒ **不覆盖**。方向恒为"不豁免 ⇒ 进对账 ⇒ 至多误报,绝不漏报"。
 */
function rewriteSourceCoversClaim(faceSource, claim) {
  const P = compileRewriteSource(claim)
  const S = compileRewriteSource(faceSource)
  if (P === null || S === null) return false
  const isUnbounded = (seg) => 'param' in seg && (seg.param === '*' || seg.param === '+')
  let i = 0
  for (let j = 0; j < S.length; j++) {
    if (i === P.length) return true // P 走完 ⇒ S 剩余部分不影响包含关系
    const p = P[i]
    const s = S[j]
    if (isUnbounded(s)) {
      // 末位无界 ⇒ 一口吃掉 P 剩下的全部;非末位无界 ⇒ 交错咬合不判定(保守判不覆盖)
      if (j === S.length - 1) return true
      return false
    }
    if ('param' in p && (p.param === '*' || p.param === '+')) {
      // P 无界而 S 该位有界 ⇒ 覆盖不了(这一格是探针法②翻车处)
      return false
    }
    if ('lit' in p) {
      if ('lit' in s) {
        if (s.lit !== p.lit) return false
      }
      // s 是有界参数段 ⇒ 任意值可匹配该字面段,算满足
    } else if ('lit' in s) {
      return false // P 要"任意一段"而 S 是固定字面 ⇒ 盖不住
    }
    i++ // s 吃恰好一段
  }
  return i === P.length
}

/**
 * 逐条裁定策略面:策略前缀在 ai 面里**有**覆盖面才留,没有就丢掉。
 * 丢掉 ⇒ 该前缀的路径重新进对账 —— 这正是本票要的收益(规则被删 ⇒ skip 自动失效)。
 * 返回 `{ kept, dropped }`,`dropped` 带理由供报告点名。
 */
function corroborateExemptionPrefixes(claims, forwardedPrefixes) {
  const kept = []
  const dropped = []
  for (const claim of claims) {
    const hit = forwardedPrefixes.find((s) => rewriteSourceCoversClaim(s, claim))
    if (hit !== undefined) kept.push(claim)
    else dropped.push({ claim, reason: 'next.config.ts 的 ai-service 转发面里已无覆盖该前缀的规则' })
  }
  return { kept, dropped }
}

/**
 * 读 next.config.ts 并算出「本门对账面里哪些 `/api/*` 前缀由 next rewrites 转发到非 apps/api 目标」。
 *
 * ## T5 这一格最易出事:文件读不到时的口径
 * 三种可能口径里,**"静默当成没有转发面"与"静默当成全部已验"都排除**:
 *  · 静默当成没有转发面 ⇒ 全部路径突然进对账 ⇒ 存量恒红(§12e:与本票无关的红只会逼人 `--no-verify`)
 *  · 静默当成全部已验 ⇒ 门回到"规则删了也不响"的老病根
 * 采用的第三种:**退回本票改前的字面前缀集(与改前逐字同形),并显式报告降级**。
 * 降级既不是"没判"(它继续按改前的口径判)也不是"已判干净"(报告里点名说明用的是兜底集),
 * 而是既有「不透明挂载未判定」桶同款的第三态:**显式未判定**。
 * 报告行无条件打印(读到与否都打),因为"这一格今天读到了还是没读到"本身就是要被看见的事实。
 *
 * 为什么不直接 exit 2:next.config.ts 缺失/取不到属于"判定面不完整",而 exit 2 在本脚本里
 * 专指**取材层**(git blob)失败;把单份配置文件的缺失升级成 exit 2 会让任何还没建出
 * `apps/web/next.config.ts` 的夹具与 `--probe-ends` 冒烟一律 exit 2(实测 `--self-test`
 * 13 例端到端夹具里只有 3 例带 next.config.ts,其余 10 例会当场全灭)。
 */
function nextRewriteExemption() {
  const fallback = {
    degraded: true,
    reason: null,
    forwarded: REWRITE_EXEMPTION_CLAIMS.slice(),
    corroborated: REWRITE_EXEMPTION_CLAIMS.slice(),
    dropped: [],
    selfFace: [],
    otherRules: [],
    unknownSource: 0,
    // 降级档 = 不派生(保守方向:看不见改写面 ⇒ 派生面为空,绝不凭空造绿)
    pathMaps: [],
  }
  let src = null
  try {
    src = readSource(NEXT_CONFIG_REL)
  } catch {
    // 未经 prefetch 就取材(顺序写错)—— 与 Undetermined 同口径,不静默
    return { ...fallback, reason: `${NEXT_CONFIG_REL} 未经 prefetch 就取材(取材顺序错了)` }
  }
  if (src === null || src === undefined) {
    return { ...fallback, reason: `${NEXT_CONFIG_REL} 在本判定面上取不到内容` }
  }
  const faces = parseNextRewriteForwardFaces(src)
  // 读到了但一条都解析不出 ⇒ 同样是"判不出",走同一个降级出口(不是"没有转发面")
  if (faces.forwardedPrefixes.length === 0 && faces.selfFacePrefixes.length === 0) {
    return {
      ...fallback,
      reason: `${NEXT_CONFIG_REL} 读到了但解析不出任何 source/destination 规则对(形态变了?)`,
    }
  }
  const { kept, dropped } = corroborateExemptionPrefixes(
    REWRITE_EXEMPTION_CLAIMS,
    faces.forwardedPrefixes,
  )
  return {
    degraded: false,
    reason: null,
    forwarded: faces.forwardedPrefixes,
    corroborated: kept,
    dropped,
    selfFace: faces.selfFacePrefixes,
    otherRules: faces.otherRules,
    unknownSource: faces.unknownSource,
    pathMaps: faces.pathMaps,
  }
}

/**
 * 这条 rawPath 是否落在「已裁定的 next rewrites 转发豁免面」内。
 * 判据集合是 `corroborated`(策略面 ∩ ai 覆盖面),**不是** `forwarded`(ai 面全 53 条)——
 * 后者会把 101 条真调用点赶出对账面,理由与实测见 `rewriteExemption` 处注释。
 */
function isNextRewriteForwardedPath(rawPath, exemption) {
  for (const claim of exemption.corroborated) {
    if (matchRewriteSource(claim, rawPath) !== null) return true
  }
  return false
}

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
  //
  // 2026-10-04 现状说明(改这一行之前先读):
  //  · 字符类里的 `\$ { }` 是上面那次加固**一并进来的**,后果是模板串插值被整段吃进路径
  //    (`` `/api/subagents/all${suffix}` `` 抽出 `/api/subagents/all${suffix}`),
  //    经 normalizeCallPath 落成 `.../all:param` —— 那是**谁都没发过的段**,即 `:param` 假影。
  //  · **刻意保留这三个字符、不收窄**:pathRe 要求收尾引号紧邻,删掉它们会让整条字面量
  //    匹配不上,实测连带抽不出 **1,158 条真实插值调用**(判据整体失明),且对假影零收益。
  //    改法是**下游标记**:见 isTemplateInterpolationPhantom(与本函数同在 extractFrontendCalls
  //    附近调用),把「粘连插值 + 非查询串构造器」归入「未判定(有传输口却抽不出路径)」桶。
  //  · 改这一行会被 `scripts/tests/check-api-routes-template-interp.test.mjs` T5 拦下。
  const pathRe = /['"`](\/api\/(?:admin\/)?[a-zA-Z0-9/_\-${}:.?&=%,+~#@!;]+)['"`]/g
  // 2026-10-04 机制⑤:`/api/` 字面量作为**字符串谓词的实参**出现 ⇒ 子串匹配,不是调用点。
  // 现场(e2e 白名单/拦截器,它们只是在"看有没有调某个前缀",从不发请求):
  //   `apps/web/e2e/responsive.spec.ts:43`  `!e.includes('/api/a2a/')`
  //   `apps/web/e2e/publish-scan-login.spec.ts:41` `u.includes('/api/publish/scan-login')`
  // 同一行里出现**任何传输口**(`fetch(` / `fetchApi(` / `request(`,泛型 `fetchApi<T>(` 也算)
  // ⇒ 那是真调用,不许剔。
  //
  // ## 为什么判据是"字符串谓词 + 同行无传输口",而不是票面提的"该行不含传输口"
  // 量表实测(改前调用集 2,771 条 / HEAD 面,`census-transport.mjs`):只用"无传输口"当判据,
  // 会把 **2,623 条**判成非调用点 —— 本仓绝大多数真调用走**本地 wrapper**
  // (`api<T>(...)` / `apiData<T>(...)`,那一行确实没有 `fetch(`),例如
  // `packages/api-client/src/endpoints/admin-content.ts:52`
  // `return fetchApi<DeleteResult>(`/api/admin/ai-gc/${id}`, …)`(连泛型传输口都需单独认)。
  // 那不叫修误报,叫把门打瞎。收窄到"字面量是字符串谓词的实参"后落 **19 条,全在 web 端 e2e**,
  // 逐条回源码核过,无一条是真请求 ⇒ 与票面点名的 2 条同族。
  //
  // ## 必须用遮罩后的行判定
  // 直接看原文会栽在两处:① 注释里写 `// 见 fetch('/api/x')` 的行;② 字符串里嵌 `'/api/a2a/'` 字样。
  // `maskComments` 保留字符串、整段删行注释、块注释等长换空白 ⇒ 行号/列位不漂,可安全按行取。
  const maskedLines = maskComments(src).split('\n')
  // G-962 机制⑥补刀:e2e 源码锁断言 `expect(s).toContain("'/api/…'")` 同型 —— 谓词名单
  // 缺 toContain、且实参是「双引号包单引号」的两层引号,旧式 `['"`]\/api\/` 贴不住。
  const STRING_PREDICATE_RE =
    /\.\s*(?:includes|startsWith|endsWith|contains|toContain|match|replace|split|indexOf|search)\s*\(\s*['"`]{1,2}\/api\//
  lines.forEach((line, idx) => {
    const maskedLine = maskedLines[idx] ?? ''
    let m
    pathRe.lastIndex = 0
    // G-962 机制⑥:扫描面必须是**遮罩行**。旧式跑原文 ⇒ 注释里的 `fetchApi('/api/x')`
    // 照样进调用集(use-auth.ts:64「原实现裸调」说明、feedback-survey-card.tsx:16 端点
    // 说明、mobile-rn config.ts:32 JSDoc 实证)。maskComments 等长换空白,列位不漂。
    while ((m = pathRe.exec(maskedLine)) !== null) {
      const rawPath = m[1]
      // 跳过非 API 路径（如 /api/health 这种纯字面量但被误捕）
      if (!rawPath.startsWith('/api/')) continue
      // 子串匹配不是调用点(机制⑤):遮罩行上是字符串谓词实参、且整行没有任何传输口。
      // 归入既有的「未判定(有传输口却抽不出路径)」桶同口径由调用方按 calls.length===0 处理 ——
      // 这里刻意**只是不进调用集**,不改任何桶的归属逻辑(判据归属与"抽不出路径"同口径)。
      if (STRING_PREDICATE_RE.test(maskedLine) && !LINE_TRANSPORT_RE.test(maskedLine)) continue
      // 前缀常量声明行**不是调用点**:cli 端 `const API_PREFIX = '/api/chat'` 会被 pathRe 命中,
      // 而真路径要由 createApiRequest 工厂在第二个实参处拼出来(见 extractCliShapeCalls)。
      // 把片段当调用 = 凭空造一条谁都没发过的请求(实测 capabilities.ts 的 4 条真调用之上
      // 会多出一条 `/api/v1/ai/capabilities`)。只对 cli 端生效,其余端行为一字不变。
      if (cli && cli.fragmentLines.has(idx + 1)) continue
      // ── next rewrites 转发面豁免(2026-10-04:判据从 next.config.ts **真读**出来)──
      //
      // 改前这里是两行硬编码 `rawPath.startsWith('/api/llm/')` / `('/api/voice/')`,外加一句
      // 关于"这些前缀会被转发到 ai-service"的人工断言(原话留档在 parseNextRewriteForwardFaces
      // 顶部的变更说明里)。断言不是判据:把 `/api/llm/:path*` 那条 rewrite 从 next.config.ts
      // 删掉,那两行**照样跳过** ⇒ 门继续装看不见,而生产已真 404。
      //
      // 现在的判据:`isNextRewriteForwardedPath` 逐条问「这条 rawPath 是否落在**从
      // apps/web/next.config.ts 读出的** ai-service(非 apps/api)转发面内」。
      // 面本身由 `parseNextRewriteForwardFaces` 在**取值处**按 destination 目标常量分面,
      // 8802(apps/api 自己,含 `/api/:path*` 兜底)那面**永不参与豁免**(详见该函数顶部 ⚠️)。
      // ⇒ 规则被删时 skip 自动失效、路径重新进对账,这正是本票要的收益。
      //
      // `!cliShapes` 保留原口径:apps/cli 直连后端进程(8802),next rewrites 是 **web 端**的
      // 部署形态,web 的转发规则替不了 cli 的实际去向(实测 models.ts:242)。
      if (!cliShapes && isNextRewriteForwardedPath(rawPath, rewriteExemption)) continue
      // `:param` 假影(2026-10-04):字面量里粘着模板串插值,且插值**不是**查询串构造器
      // ⇒ 归一后会造出 `all:param` / `ai-tutor:param` 这种**谁都没发过的段**
      // (运行期真实 URL 是 `/api/subagents/all` 或 `/api/ai-tutor/explain`)。
      // 这样的字面量**抽不出真路径**,归入既有的「未判定(有传输口却抽不出路径)」桶
      // (由调用方按 `calls.length === 0 && TRANSPORT_RE` 记 shapeUnknown),不进调用集 ——
      // 判据归属与"抽不出路径"同口径,措辞现成;判据本体见 isTemplateInterpolationPhantom。
      // ⚠️ 刻意**不**收窄 pathRe 字符类(已实测否证,理由见该函数注释)。
      if (isTemplateInterpolationPhantom(rawPath)) continue
      // method 推断与路径归一化都走文件级唯一出口(通用面与 CLI 形态面共用同一份实现)
      // cli 端额外允许两种"没有字面量 method:"的形态:
      //  ① **位置实参 method**:`memorySend('POST', '/api/memory/save', body)` —— 上一行以
      //     `'POST',` 收尾即认,普通语句撞不上;不补这条,三处 POST/DELETE 会被当 GET,
      //     把后端真实册的路由判成死调用(实测 tools/memory.ts:295/322/362)。
      //  ② **纯路径常量声明行**:`export const FOO_PATH = '/api/x'` —— 它是片段不是调用点,
      //     真调用在别处(`client.post(FOO_PATH, …)`),在那里静态读不到 method。
      //     这类刻意用 ANY(= 任一拍即算注册),而不是猜一个 GET。
      // 2026-10-04 加固(机制③):覆盖面从 cli 端**放开到全部端** —— 原判据被 `cliShapes &&`
      //   限死在 cli 端,而"片段不是调用点"这件事**与端无关**:web 端
      //   `apps/web/src/lib/api-registry.ts:20` 的 `const BASE = '/api/registry'` 就是同型,
      //   被 inferMethodAtLine 猜成 GET `/api/registry`(3 段)⇒ 落进 3 段通配射程内/外随面而变,
      //   是误报来源之一。判据本体(那行正则)**一字未改**,只去掉 `cliShapes &&`
      //   ⇒ cli 端行为逐字不变(纯增益、零新增假阳)。
      const isPathConstDecl =
        /^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*['"`]\/api\/[^'"`]+['"`];?\s*$/.test(
          maskedLine,
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

/* ============================================================================
 * ===== BP 腿:裸路径传输口调用点(2026-10-19 立)=====
 *
 * ## 立因(现读,不是推测)
 * 主腿的 `pathRe` 硬性要求**引号紧邻 `/api/`**。而 transport 的 `normalizeUrl`
 * (`packages/api-client/src/client.ts`,本门按面读它)会把**不带前缀的裸路径**补成 `/api/…`:
 *   `if (url.startsWith('/')) return \`/api${url}\``
 * 于是 `fetchApi('/course-qa')`、`fetchApi('/checkin', {method:'POST'})` 这一族真调用点
 * **一条都不进调用集**:既不判死、也不落任何既有未判定桶(2026-10-19 实测:全量档报
 * `✅ 通过(新增 0 处死调用)`,而同面 mobile-rn 有 74 条、api-client 有 125 条这种字面量)。
 *
 * ## 判据纪律(为什么不是"把 pathRe 放宽")
 * 1. **只认传输口调用的 URL 实参位**:引号必须紧跟在传输口的 `(` 之后(泛型 `<…>` 与换行算在内),
 *    或对象形态里 `url:` 之后。`WITHDRAWAL_BASE + '/create'` 这种**拼接尾巴**上的字面量
 *    实测就在 `fetchApi(` 后面隔着一个变量 ⇒ 不认(认了就是凭空 `GET /api/create`)。
 *    传输口集合不另发明,取本门既有唯一实现 `LINE_TRANSPORT_RE` 的 `.source`(§0.6:两处算
 *    同一件事必漂移;与 `TRANSPORT_RE_G` 同一手法)。
 * 2. **归一不抄第二份**:路径解析复用 `cliPathFromLiteralContent`(它逐段读、`${}` 按共享谓词
 *    退化、读不出返回 null 不猜),`/xxx → /api/xxx` 复用 `aliasPathCandidates`,
 *    并**按面读 transport 现读的 `normalizeUrl` 裸路径档**(`alias.barePrefix`)做同形核验:
 *    两边对不上 ⇒ 该条落「未判定(归一口与事实源不同形)」,一条都不硬判。
 * 3. **改写档那一族不归本腿**:`/cozeZhsApi/…` 命中 normalizeUrl 的**前缀替换**档,归一后是
 *    `/api/…` 而不是 `/api/cozeZhsApi/…`,把它按裸路径腿抽进来就是 2026-09-29 实测否证的
 *    100% 误报(见 `collectAliasLiteralBlindSites` 上方)。本腿把它单列一桶报名,判权仍在 CE/③'。
 * 4. 透传档(`/api/`、`/uploads/`、`/ws/…`)与 `:param` 假影同样单列成桶,**不静默丢**。
 * 5. 转发豁免(`isNextRewriteForwardedPath`)、不透明挂载(`OPAQUE_MOUNT_PREFIXES`)、
 *    ignore 豁免,全部走主腿既有出口,不另写一份。
 *
 * ## 三态纪律(本腿自己的那一格)
 * `classifyBareLegVerdict` 是本腿的**唯一**三态判序(自检直接打它,不在测试里复制判据):
 *  - 整仓面一个候选都没抽到 ⇒ `blind`(取材失效,判死不记绿);
 *  - 事实源读不出归一档而候选非 0 ⇒ `unadjudged`(未判定);
 *  - 桶加总对不上候选总数 ⇒ `inconsistent`(坏的是尺子,不许把 0 当结论);
 *  - 其余 ⇒ `ok`(这一格真判过)。
 */

/** 传输口定位式的 `g` 档:由既有唯一实现 `LINE_TRANSPORT_RE` 派生,不手抄第二份正则 */
const BARE_TRANSPORT_RE_G = new RegExp(LINE_TRANSPORT_RE.source, `${LINE_TRANSPORT_RE.flags}g`)
/** 对象形态的 url 属性式(`Taro.request({ url: '/x' })`):HEAD 面现读 0 条,装上只为"以后有人这么写"那天已有判据 */
const BARE_URL_PROP_RE = /\burl\s*:\s*(['"`])/
/** 从传输口记号走到它的 `(`:允许 `axios.get(` 这类"点后接方法名"的形态,但不许跨过任何别的内容 */
const BARE_PAREN_BRIDGE_RE = /^[.\sA-Za-z0-9_$]{0,24}\(/

function isQuoteChar(ch) {
  return ch === "'" || ch === '"' || ch === '`'
}

/**
 * 裸路径字面量 → `{ bucket, path, raw }`。
 * `bucket==='api'` 才是可判的调用点(`path` 已是归一后的 `/api/…`);其余桶一律**不进对账**,
 * 由调用方按桶报名。判序写死在这里,消费方只有一条(免得"抽进来又忘了挡"再产一次假影)。
 */
function classifyBareLiteral(content, alias, rewriteExemption) {
  const raw = content
  if (!content.startsWith('/') || content.startsWith('//')) {
    return { bucket: 'notBarePath', raw }
  }
  if (alias === null || alias === undefined || !alias.parsed) {
    return { bucket: 'factSourceUnread', raw }
  }
  // ① 已经是 `/api/` 起头 ⇒ 主腿的射程,本腿不重复收(防一条调用两个桶各判一次)
  if (alias.passthrough.some((p) => p.startsWith('/api/') && content.startsWith(p))) {
    return { bucket: 'alreadyApi', raw }
  }
  // ② 其余透传档:normalizeUrl 原样返回,补前缀就是造一条谁都没发过的路径
  if (alias.passthrough.some((p) => !p.startsWith('/api/') && content.startsWith(p))) {
    return { bucket: 'passthrough', raw }
  }
  // ③ 前缀替换改写档(`/cozeZhsApi` 那一族):归一结果不是"补前缀",本腿判它必假阳
  if (alias.rules.some((r) => content.startsWith(r.from))) {
    return { bucket: 'aliasRewriteFamily', raw }
  }
  // ④ `:param` 假影(与主腿同一个判据实现)
  if (isTemplateInterpolationPhantom(content)) return { bucket: 'interpPhantom', raw }
  const parsed = cliPathFromLiteralContent(content)
  if (parsed === null) return { bucket: 'literalUnparsed', raw }
  if (!parsed.relative) return { bucket: 'alreadyApi', raw }
  const path = parsed.path
  if (alias.barePrefix === null || alias.barePrefix === undefined) {
    return { bucket: 'barePrefixUnread', raw, path }
  }
  const expected = `${alias.barePrefix}${path}`
  // 同形核验:既有归一口必须给出同一个值;给不出就说明两边对"裸路径怎么补"的理解已经漂开
  if (!aliasPathCandidates(path).includes(expected)) {
    return { bucket: 'normalizationMismatch', raw, path, expected }
  }
  // ⑤ web 端 next rewrites 把该前缀转给 ai-service 进程 ⇒ 本门静态面看不见它,与主腿同口径
  if (isNextRewriteForwardedPath(expected, rewriteExemption)) {
    return { bucket: 'rewriteForwarded', raw, path: expected }
  }
  return { bucket: 'api', raw, path: expected }
}

/**
 * 本腿抽取:返回 `{ calls, census }`。
 * `census` 是**桶计数**(每桶一个数,加总必须等于 candidates),`calls` 是 `api` 桶的调用点。
 * 一律判在 `maskComments` 面(注释里的 `// fetchApi('/x')` 不算站点);行注释整段删除而**换行保留**
 * ⇒ 按遮噪面的换行数算行号与原文同形(该行为见 `scripts/lib/code-mask.mjs`)。
 */
function extractBareTransportCalls(src, file, alias, rewriteExemption) {
  const masked = maskComments(src)
  const rawLines = src.split('\n')
  const calls = []
  const census = new Map()
  const bump = (b) => census.set(b, (census.get(b) || 0) + 1)
  const push = (verdict, lineIdx) => {
    bump(verdict.bucket)
    if (verdict.bucket === 'api') {
      calls.push({
        // method 推断走文件级唯一出口(与主腿、CLI 形态面同一份实现)
        method: inferMethodAtLine(rawLines, lineIdx),
        path: verdict.path,
        raw: verdict.raw,
        file,
        line: lineIdx + 1,
      })
    }
  }
  let m
  BARE_TRANSPORT_RE_G.lastIndex = 0
  while ((m = BARE_TRANSPORT_RE_G.exec(masked)) !== null) {
    const token = m[0]
    let i = m.index + token.length
    if (!token.trimEnd().endsWith('(')) {
      const bridge = BARE_PAREN_BRIDGE_RE.exec(masked.slice(i))
      if (bridge === null) continue
      i += bridge[0].length
    }
    while (i < masked.length && /\s/.test(masked[i])) i++
    const lineIdx = masked.slice(0, m.index).split('\n').length - 1
    let quoteIdx = -1
    if (isQuoteChar(masked[i])) {
      quoteIdx = i
    } else if (masked[i] === '{') {
      // 对象形态:在**这一个** `{}` 体内找 `url:`(配平不到就整条放弃,不做无界扫描)
      const close = findMatchingBracket(masked, i, '{', '}')
      if (close === -1) continue
      const inner = masked.slice(i + 1, close)
      const pm = BARE_URL_PROP_RE.exec(inner)
      if (pm === null) continue
      quoteIdx = i + pm.index + pm[0].length - 1
      if (!isQuoteChar(masked[quoteIdx])) continue
    } else continue
    const end = findLiteralEnd(masked, quoteIdx)
    if (end === -1) {
      bump('literalUnclosed')
      continue
    }
    const content = masked.slice(quoteIdx + 1, end)
    push(classifyBareLiteral(content, alias, rewriteExemption), lineIdx)
  }
  return { calls, census }
}

/**
 * 三态判序(本腿唯一实现;`--self-test` 与主流程共用同一条判据,不在测试里复制)。
 * @param {object} p
 * @param {number} p.scannedFiles 本腿扫过的受管前端文件数
 * @param {number} p.candidates   抽到的候选总数(= 所有桶加总)
 * @param {Map<string,number>} p.census 桶计数
 * @param {boolean} p.repoWide    是否整仓面(head,或 staged 且暂存区确有前端文件)
 */
function classifyBareLegVerdict({ scannedFiles, candidates, census, repoWide }) {
  const sum = [...census.values()].reduce((a, b) => a + b, 0)
  if (sum !== candidates) {
    return { state: 'inconsistent', detail: `桶加总 ${sum} ≠ 候选 ${candidates}` }
  }
  const adjudicated = census.get('api') || 0
  const unread =
    (census.get('factSourceUnread') || 0) +
    (census.get('barePrefixUnread') || 0) +
    (census.get('normalizationMismatch') || 0)
  if (repoWide && scannedFiles > 0 && candidates === 0) {
    return { state: 'blind', detail: `整仓面扫了 ${scannedFiles} 个受管文件,一条裸路径都没抽到` }
  }
  if (candidates > 0 && adjudicated === 0 && unread > 0) {
    return {
      state: 'unadjudged',
      detail: `${unread} 条读不出归一档(事实源读不到裸路径补前缀档,或与既有归一口不同形)`,
    }
  }
  return { state: 'ok', detail: '', adjudicated, unread }
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
  // 2026-10-19 再补(嵌套泛型):`server.post<{ Params: z.infer<typeof X> }>(…)` 的泛型里
  //   还套了一层 `<…>`,旧式 `(?:<[^<>()]*>)?` 的字符类一见到内层 `<` 就失配 ⇒ 那条路由
  //   **在册却看不见** ⇒ RN/小程序对它的真调用被报成死调用(仓里 2 处,points-mall-user /
  //   points-tasks)。泛型组改为单一真相源 GENERIC_ARGS_SRC(见其头注的覆盖边界)。
  const methodRe = new RegExp(
    `\\b(?:server|s|sub|child|scope|authed|instance|app|fastify)\\.(get|post|put|patch|delete)${GENERIC_ARGS_SRC}\\(\\s*['"\`]([^'"\`]*)['"\`]`,
    'g',
  )
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
    // 2026-10-04 加固(机制④):嵌套 `X.register(async (VAR) => {…}, { prefix })` 的 prefix 参与拼接
    routes.push(...expandNestedRegisterRoutes(src, rel))
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
    /**
     * include 挂载面判据**收敛到 lib 一份实现**(`buildPyIncludeMaps`,守门 8 与提取式
     * 两处算同一件事必漂移)。本段旧实现有三重结构性失明,实测把 G-962 的真挂载链
     * 判成"高置信真死候选":
     *   ① 只读 main.py —— cost-ledger/model-pricing/longterm-memory 三族的 include 行写在
     *      二级聚合器 killer_extras.py(main.py 以 `killer_extras.register(app)` 调用);
     *   ② 「二选一」—— 文件有自有 APIRouter(prefix=Q) 就无视 include 前缀 P,而 FastAPI
     *      真路径是 P+Q(connectors.py 自有 /connectors + include /api ⇒ /api/connectors/*);
     *   ③ 别名失明 —— `from app.routers import prompts as prompts_router` 的 include 键是
     *      'prompts_router',按 fileName 'prompts' 查不到 ⇒ prompts 族整族丢 /api。
     * 别名四形态/相对导入/注释遮噪的解析与防双 /api 拼接规则见 lib 头注,此处不重述。
     */
    const pyFace = new Map()
    const mainSrc = readSource(AI_SERVICE_MAIN_FILE)
    if (mainSrc !== null && mainSrc !== undefined) pyFace.set(AI_SERVICE_MAIN_FILE, mainSrc)
    const srcCache = new Map()
    for (const rel of routerFiles) {
      const s = readSource(rel)
      if (s === null || s === undefined) continue
      srcCache.set(rel, s)
      pyFace.set(rel, s)
    }
    const { byModule, byFile } = buildPyIncludeMaps(pyFace)
    for (const rel of routerFiles) {
      const src = srcCache.get(rel)
      if (src === undefined) continue
      const fileName = rel.split('/').pop().replace(/\.py$/, '')
      const moduleKey = rel.replace(/^apps\/ai-service\//, '').replace(/\.py$/, '').replaceAll('/', '.')
      // 提取 router 的 prefix（文件内 APIRouter(prefix=...)）—— 保持 raw 扫描(注释里的
      // 假前缀形态是既有基线的一部分,本票只补拼接腿,不动这一档,免得 py 面行为变更混进裁决)
      const prefixRe = /APIRouter\(\s*prefix\s*=\s*['"`]([^'"`]+)['"`]/g
      const routerPrefixes = []
      let pm
      while ((pm = prefixRe.exec(src)) !== null) {
        routerPrefixes.push(pm[1])
      }
      const mounted = byModule.get(moduleKey) ?? byFile.get(fileName)
      const prefixes2 = routerPrefixes.length
        ? mounted
          ? [...new Set(routerPrefixes.map((q) => combinePyPrefix(mounted, q)))]
          : routerPrefixes
        : mounted
          ? [mounted]
          : ['']
      // 提取 @router.xxx("/path") 注册
      // 2026-10-04 加固(机制②):路径组改 `([^'"`]+)?` —— 原式要求 ≥1 字符,
      // 于是全仓 7 处 `@router.get("")`(model_pricing_api / cloud_runs / connectors / ai_skills /
      // timeline / checkpoint_rewind / context_compaction)**整条抽不出**,
      // 而它们经 normalizePath(prefix, '') 会得到 prefix 本身 ⇒ **端点在册却报"不在册"**。
      // 空值直接交给已有的 normalizePath(它已有 `localPath === ''` → 返回 prefix 的分支,一字未改)。
      const fastApiMethodRe =
        /@router\.(get|post|put|patch|delete|options)\(\s*['"`]([^'"`]+)?['"`]/g
      let fm
      while ((fm = fastApiMethodRe.exec(src)) !== null) {
        const method = fm[1].toUpperCase()
        // 路径组改成可空后,`@router.get("")` 拿到的是 undefined —— 归一成 '' ,
        // 交给 normalizePath 已有的 `localPath === ''` → 返回 prefix 那条分支。
        const localPath = fm[2] === undefined ? '' : fm[2]
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

if (process.argv.includes('--self-test')) {
  const { failures: selfFailures, assertions } = runSelfTest({
    HERE,
    BASELINE_FILE_REL,
    CHANNEL_EQUIV_BASELINE_REL,
    CLIENT_TRANSPORT_FILE,
    BARE_LEG_BASELINE_REL,
    readUrlAliasRules,
    classifyBareLiteral,
    classifyBareLegVerdict,
  })
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
for (const end of ACTIVE_ENDS) {
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
  // BP 腿的棘轮锚点必须与其余内容同面同轮读满(缺档 ⇒ 该腿未判定,不判红也不记绿)
  BARE_LEG_BASELINE_REL,
  // 前缀假设未判定两腿的裁决台账(G-962 续作):同样必须同面同轮读满(缺档 ⇒ 维持未判定,不判红也不下降)
  ASSUMPTION_ADJ_FILE_REL,
  // next rewrites 转发面的判据输入:必须与其余内容**同面同轮**读满(理由同 CLIENT_TRANSPORT_FILE)。
  // 不进 listFace ⇒ 不受 isIgnoredSourceFile 那条"next.config.* 是 rewrite 规则不是调用点"影响
  // (那条只该挡它在**前端调用面**里被当调用点,与此处作为**判据输入**是两件事)。
  NEXT_CONFIG_REL,
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
 * next rewrites 转发面(2026-10-04):在**取材完成后**算一次,`extractFrontendCalls` 每条路径来问。
 * 放在 prefetch 之后是硬要求 —— `readSource` 对"未经 prefetch 就取材"抛 Undetermined,
 * 提前算就是拿异常当流程控制。
 *
 * ⚠️ 为什么**不是**"把 ai 面 53 条前缀全当豁免面":
 * 量表实测(`--warn-only` + `--dump-missing` 逐条对照,HEAD 面 2,753 → 2,656 调用):
 * 全量豁免会把 api-client 端 700 → 663、web 端 1,908 → 1,848,合计 **97 条真调用点退出对账面**,
 * 且**死调用仍为 0** ⇒ 那一格从"判过且为 0"变成"看不见",是净失明而非修好。
 * 同时 `/api/mcp/export/*` 那 2 条「不透明挂载未判定」会随之消失(它们落在 `/api/mcp/:path*` 内),
 * 连"本门看不见但已点名"这层兜底都没了。
 * ⇒ 豁免面**只取改前那两条**(llm / voice),判据换成"该前缀在 next.config 的 ai 转发面内"。
 * 这样默认档**逐字节不变**(两条规则现读都在 ai 面内),而任一条被删时 skip 自动失效。
 */
const rewriteExemption = nextRewriteExemption()

/**
 * transport 的 URL 归一事实源(2026-10-19:提到 BP 腿之前算一次)。
 * 原先它只在下面「通道等价(CE)」块里算,而 BP 腿也要问同一件事(裸路径怎么补前缀、
 * 哪些前缀原样透传、哪些走改写档)—— 同一份输入算两遍就是两个时刻两张嘴,
 * 所以下面 CE 块改为复用这一份(判据本体仍是 `readUrlAliasRules` 唯一实现)。
 */
const urlAliasRules = readUrlAliasRules(readSource(CLIENT_TRANSPORT_FILE))

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

/* ============================================================================
 * ===== O87g(2026-10-22):后端注册面判据 = 精确挂载图;笛卡尔 composite 降为「无入口」兜底档 =====
 * 票面点名的假绿成因:`buildCompositePrefixes` 把**任一 localPath × 任一绝对前缀**笛卡尔拼接,
 * `routes/ranking.ts` 挂在 `/api/ranking` 下的 `server.get('/courses')` 会组合出结构上不存在的
 * `/api/courses` —— 前端真打它是 404,门却报「新增 0 处死调用」。
 * 票面先决「先扩提取式」已由 `scripts/lib/route-registration-extract.mjs` 完成(工厂注册按实参
 * 解析、模板矩阵、内联别名、同文件多插件按各自前缀归因),本段把判据换成它的挂载图产出。
 * 档位纪律:
 *  · **精确档**:`SERVER_FILE` 在面 ⇒ 挂载图是唯一注册面来源(FastAPI 面除外,见下)。
 *  · **兜底档**:`SERVER_FILE` 不在面(夹具/半截搬家)⇒ 挂载图无起点,退回旧 composite 并**大声点名**
 *    —— 退回是有假绿的,所以结论必须喊出来,绝不静默(§12e 反向:也不拿它冒充精确档)。
 *  · FastAPI 面**保留旧提取式**取条目:它的 prefix+localPath 拼接本就是精确的(不是笛卡尔),
 *    且空路径 `@router.get("")` 与别名 include_router 两型判据被兄弟镜像 S1/② 源码锁钉在旧侧,
 *    库的 py 面比旧侧窄 ⇒ py 条目从旧提取式来,两档同此一条(不各写一份)。
 * ========================================================================== */
const backendTsFiles = new Map()
for (const rel of new Set([
  SERVER_FILE,
  ...listFace(API_ROUTES_DIR, ['.ts']),
  ...listFace(API_PLUGINS_DIR, ['.ts']),
])) {
  if (!rel.endsWith('.ts') || rel.endsWith('.d.ts')) continue
  const src = readSource(rel)
  if (typeof src === 'string') backendTsFiles.set(rel, src)
}
// 精确档的**先决**不只是"server.ts 在面",而是"面上有可走的挂载起点":
// 兄弟夹具(枚 alias-literal-adjudication T3)会铺一份只为喂旧前缀采集器的假 server.ts
// (`void register({ prefix })`,一条 `X.register(` 边都没有)—— 那种面上挂载图必然空转,
// 判据该如实退回兜底档并点名,而不是拿"图走不到"冒充精确档把在册读数吞成未判定。
const GRAPH_AVAILABLE =
  backendTsFiles.has(SERVER_FILE) && /\.register\s*\(/.test(backendTsFiles.get(SERVER_FILE))
const regGraph = GRAPH_AVAILABLE
  ? extractApiRegistrations(backendTsFiles, { entryTs: SERVER_FILE })
  : null
/** FastAPI 条目(旧提取式,localPath 已是完整路径);两档共用 */
const pyBackendRoutes = backendRoutes.filter((r) => r.file.endsWith('.py'))
const compositePrefixes = buildCompositePrefixes(prefixes)

/**
 * 「边缘改写派生面」接线(G-962 收尾,2026-10-22):next.config.ts 里**改前缀**的
 * ai 面 rewrite(lsp / self-healing / knowledge-graph 三条,owner 拍板反代白名单)
 * 让"前缀错位"的前端调用在生产真实可达。py 前缀拼接修好后这批调用从「前缀假设
 * 未判定」浮进精确对账 ⇒ 假红 5 条(lsp×4 + self-healing×1)—— 实测它们经 rewrite
 * 打到 ai-service /api/v1/*,不是死调用。判据本体见 `deriveEdgeRewriteEntries`。
 * 派生源 = 精确档两腿合并(TS 挂载图 + FastAPI 旧提取式);兜底档不接(形状与
 * 换票前逐字节相同的老纪律)。降级档 pathMaps=[] ⇒ 派生面为空,保守不造绿。
 */
const edgeRewriteDerived = GRAPH_AVAILABLE
  ? deriveEdgeRewriteEntries(
      [
        ...regGraph.entries.flatMap((e) => {
          if (e.file.endsWith('.py')) return []
          if (e.method === 'ANY') {
            return BACKEND_VERBS.map((v) => ({
              method: String(v).toUpperCase(),
              path: e.path,
              file: e.file,
            }))
          }
          return [{ method: e.method, path: e.path, file: e.file }]
        }),
        ...pyBackendRoutes.map((r) => ({ method: r.method, path: r.localPath, file: r.file })),
      ],
      rewriteExemption.pathMaps,
    )
  : []

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
  // 2026-10-04 修:原先只认 `--flag value` 分离式,`--flag=value` 等号形式**静默失效**
  // —— indexOf(flag) 返回 -1 ⇒ 返回 null、不落盘、不报错。排障时用等号写法会以为
  // "这个旗标没输出东西",实际是旗标没被识别,而门对此**一声不响**。
  // 现在两种写法都认;等号形式优先(它无歧义,不会误吃下一个 argv)。
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg === flag) {
      const v = process.argv[i + 1]
      if (typeof v === 'string' && v !== '') {
        if (!v.startsWith('-')) return v
        console.error(`[API 路由比对] 忽略无效的 ${flag} 值: ${v}`)
      } else if (flag === '--dump-backend' || flag === '--root') {
        // 漏值/空串两支:上面只点名了"以 - 开头"那一支(枚 636c28f58),这两支原先一声不响。
        // `--dump-missing` 另有布尔 stdout 档(裸形态是合法用法,不点名,免得对合法用法报警);
        // `--dump-backend` 没有那一档 —— 不给有效路径就静默不落盘,正是本族的静默型,必须点名。
        // `--root`(G-322 本站补)同理:漏值/空串都落到调用点的"未判定"档,那一行要能指出现得的
        // 到底是"没打值"还是"打了空串",否则三态在报错文案里被抹成一态(§22c 三态分开)。
        const need = flag === '--root' ? '必须给一个目录' : '必须给文件路径,不落盘'
        console.error(
          v === ''
            ? `[API 路由比对] 忽略无效的 ${flag} 值: ""(空串,该旗标${need})`
            : `[API 路由比对] 忽略无效的 ${flag} 值: (其后没有任何参数,该旗标${need})`,
        )
      }
      return null
    }
    if (arg.startsWith(flag + '=')) {
      const v = arg.slice(flag.length + 1)
      if (v !== '') return v
      console.error(`[API 路由比对] 忽略无效的 ${flag} 值(等号写法后为空)`)
      return null
    }
  }
  return null
}

const backendDumpPath = dumpFlagValue('--dump-backend')
if (backendDumpPath) {
  writeFileSync(
    backendDumpPath,
    JSON.stringify(
      GRAPH_AVAILABLE
        ? [
            ...regGraph.entries,
            ...pyBackendRoutes.map((r) => ({
              method: r.method,
              path: r.localPath,
              file: r.file,
              line: 0,
              via: 'py',
            })),
            ...edgeRewriteDerived.map((d) => ({ ...d, line: 0, via: 'edge-rewrite' })),
          ]
        : backendRoutes.map((r) => {
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

/**
 * 「前缀假设」面(旧笛卡尔拼接,单一构造点):
 *  · 兜底档(server.ts 不在面)拿它**当绿档** —— 形状与换票前逐字节相同;
 *  · 精确档只拿它做**降级判据**:挂载图走不到、但笛卡尔拼得出的调用,落
 *    「未判定(前缀假设命中)」逐条报名 —— 图未追到的真挂载链(re-export barrel
 *    等,库暂不跟)与 O87g 点名的 /api/courses 型假路径在这一格里**结构上不可分辨**,
 *    所以既不冒红(§12e)也**绝不记绿**(票面核心)。命中它 ≠ 在册。
 */
const assumptionPathSet = new Set()
for (const r of backendRoutes) {
  // 对每个路由，尝试所有可能的 prefix 组合（含两层拼接的 composite prefix）
  for (const p of compositePrefixes) {
    const full = normalizePath(p, r.localPath)
    assumptionPathSet.add(`${r.method} ${full}`)
  }
  // 也添加不带 prefix 的（plugin 内部可能没有 prefix）
  assumptionPathSet.add(`${r.method} ${r.localPath}`)
}
const backendPathSet = new Set()
if (GRAPH_AVAILABLE) {
  for (const e of regGraph.entries) {
    if (e.file.endsWith('.py')) continue // py 条目从旧提取式来(判据窄度不同,见接线块头注)
    if (e.method === 'ANY') {
      for (const v of BACKEND_VERBS) backendPathSet.add(`${v.toUpperCase()} ${e.path}`)
      continue
    }
    backendPathSet.add(`${e.method} ${e.path}`)
  }
  for (const r of pyBackendRoutes) backendPathSet.add(`${r.method} ${r.localPath}`)
  for (const d of edgeRewriteDerived) backendPathSet.add(`${d.method} ${d.path}`)
} else {
  for (const e of assumptionPathSet) backendPathSet.add(e)
}

/** `--dump-undetermined` 的落盘点在主对账之后(要等「前缀假设命中」桶成形才写,见报名块) */
const undeterminedDumpPath = dumpFlagValue('--dump-undetermined')
if (GRAPH_AVAILABLE) {
  console.log(
    `${C.dim}[API 路由比对] 后端注册路由: 精确挂载图 ${backendPathSet.size} 条（图 ${regGraph.entries.length} + FastAPI ${pyBackendRoutes.length} + 边缘改写派生 ${edgeRewriteDerived.length};TS ${regGraph.stats.tsFilesAnalyzed} 文件 / 工厂 ${regGraph.stats.factories} 个 / 走到节点 ${regGraph.stats.touchedNodes} 个）${C.reset}`,
  )
  /**
   * 报数必须报名(票面③):图产出里的三格盲区逐条点名,默认档各截前 20 条,
   * 全量走 `--dump-undetermined`。这些格子**不判红也不记绿** —— 判据看不见 ≠ 没有。
   */
  const GRAPH_SITE_PRINT_CAP = 20
  const graphBlindRows = (label, rows) => {
    if (!rows.length) return
    for (const r of rows.slice(0, GRAPH_SITE_PRINT_CAP)) {
      console.log(
        `${C.yellow}  · ${label}: ${r.file ?? '-'}:${r.line ?? 0} [${r.kind ?? 'opaque'}] ${r.detail ?? r.evidence ?? ''}${C.reset}`,
      )
    }
    if (rows.length > GRAPH_SITE_PRINT_CAP) {
      console.log(
        `${C.yellow}  · ${label}:其余 ${rows.length - GRAPH_SITE_PRINT_CAP} 条见 --dump-undetermined${C.reset}`,
      )
    }
  }
  graphBlindRows('后端未判定', regGraph.undetermined)
  graphBlindRows(
    '后端图未走到(按本文件自身前缀兜底产出)',
    regGraph.unreached.map((u) => ({ file: u, line: 0, kind: 'unreached', detail: '' })),
  )
  graphBlindRows(
    '不透明挂载前缀(其下调用落「未判定」出口,不判红)',
    regGraph.opaque.map((o) => ({ file: o.prefix, line: 0, kind: 'opaque', detail: o.evidence })),
  )
  // 派生面**逐条报名**(票面③"报数必须报名"):每条派生绿都带改写规则原文与源文件,
  // 全量另见 --dump-backend(via='edge-rewrite')。
  if (edgeRewriteDerived.length) {
    for (const d of edgeRewriteDerived.slice(0, GRAPH_SITE_PRINT_CAP)) {
      console.log(
        `${C.dim}  · 边缘改写派生: ${d.method} ${d.path} ⇐ ${d.rule} @ ${d.file}${C.reset}`,
      )
    }
    if (edgeRewriteDerived.length > GRAPH_SITE_PRINT_CAP) {
      console.log(
        `${C.dim}  · 边缘改写派生:其余 ${edgeRewriteDerived.length - GRAPH_SITE_PRINT_CAP} 条见 --dump-backend via=edge-rewrite${C.reset}`,
      )
    }
  }
} else {
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 兜底档:${backendTsFiles.has(SERVER_FILE) ? `${SERVER_FILE} 在面但没有一条 \`X.register(\` 挂载边` : `${SERVER_FILE} 不在 ${FACE} 面`} ⇒ 挂载图无起点,本轮后端注册面退回旧「前缀假设」笛卡尔拼接(${backendRoutes.length} 条 × ${compositePrefixes.length} 个组合前缀)—— 这一档能拼出结构上不存在的 /api/courses 型假路径(票 O87g 点名的假绿成因),「死调用 0 处」在本档**不得读成对账通过**${C.reset}`,
  )
}

// 提取前端调用
// 2026-08-31:staged-scope 时仅收集位于暂存文件列表内的前端文件(改动原因见 getStagedFiles 上方注释);
// 非暂存文件的调用点跳过不计入失败;后端路由注册收集(extractBackendRoutes)保持全量不变。
// 判序注(2026-09-26):收窄已提到 prefetch **之前**(否则预提交要为最终丢掉的 4,461 个 blob 买单)。
const allCalls = []
/** 每端读数:扫了几个文件、抽出几处调用、几处取不到内容、几处"有传输口却抽不出路径"(未判定) */
const endStats = new Map(
  ACTIVE_ENDS.map((e) => [e.name, { files: 0, calls: 0, unreadable: 0, shapeUnknown: 0 }]),
)
/**
 * 各端调用出口形态不同(RN/小程序经 @ihui/api-client、Taro 可能 Taro.request、扩展走 fetch),
 * 而 pathRe 只认 `/api/` 字面量。文件里有这些传输口却一个路径都没抽出来 ⇒ **不能算判过**:
 * 计入「未判定」并打印条数(判据失效的表现永远是安静 —— 守门 70/76/81 同族)。
 *
 * ===== 2026-10-22(P1 扩面票产生路径①的修复):不再手抄第二张载波式 =====
 * 旧版这里是**手抄字面量**,且与 `LINE_TRANSPORT_RE` 已在形态上漂移:那边认泛型传输口
 * `fetchApi<Gen>(`(票面点名的 `directFetchRe` 认 `<[^>]*>?` 同一族),这边不认 ⇒
 * 「同一文件在两个判据里形态不同」。后果不是少几条死调用,而是**整档静默**:
 * 唯一载波是泛型形态、路径又抽不出的文件,`calls.length===0 && TRANSPORT_RE.test(src)`
 * 两支都假 ⇒ 连「未判定(有传输口却抽不出路径)」都不进,盲区点名也点不到它 ——
 * 这正是票面①那条产生路径("扩面只是账面变大")的现存形态。HEAD 面实测 34 个文件落在这格
 * (packages/api-client 13 / apps/web 17 / 其余 4;探针件 `.ihui-agent/tmp/b8-p1-transport-probe.mjs`)。
 * 现由既有唯一实现 `LINE_TRANSPORT_RE.source` **派生**(与 `BARE_TRANSPORT_RE_G`、
 * `TRANSPORT_RE_G` 同一手法,§0.6:两处算同一件事必漂移),只追加 import 支 ——
 * 消费侧文件把调用交给共享传输口,`from '@ihui/api-client'` 本身就是载波证据,
 * 而 LINE_TRANSPORT_RE 没有这一支(它判的是遮罩行,import 行由点名侧贴 `import型` 标签)。
 * 本档只报数与报名,不进判红/基线/退出码 ⇒ 载波集合变宽是**纯可见性收益**,
 * 既有计数口径(`calls.length===0 && TRANSPORT_RE.test(src)`)一字未动。
 */
const TRANSPORT_RE = new RegExp(
  `${LINE_TRANSPORT_RE.source}|from\\s+['"]@ihui\\/api-client['"]`,
)
/**
 * ===== 盲区点名(P1 扩面票的收尾,2026-10-05)=====
 * 上面那段 `st.shapeUnknown++` 只给**数字**。票面铁律:"报数必须报名 —— 否则读者不知道哪一行是
 * 盲区"。全量档现读 504 个文件落进这一格(web 206 / mobile-rn 180 / miniapp-taro 47 /
 * extension 45 / cli 20 / api-client 6),而"这 504 个是谁、长什么样"在改动前**一个字都没有**
 * ⇒ 扩面扩到的端只量到"没红",量不到"看不见的是哪一型"。这一段就是把名字补上。
 *
 * 三条纪律:
 *  ① **不开第二份判据**:点名用的是 `TRANSPORT_RE` 自己(下面那个 `/g` 副本由 `.source`+`.flags`
 *     派生,不是手抄的第二个正则 —— 手抄一份就是本仓反复教的"两处实现必漂移")。因此
 *     "被点名的文件集合"与"被计数的文件集合"结构上同一,不会出现"计了 180 只报得出 150"。
 *     计数口径(`calls.length===0 && TRANSPORT_RE.test(src)`)一字未改。
 *  ② **只报名,不判红,不进基线,不动退出码**:这一格说的是"判据看不见",不是"这里有问题"。
 *  ③ 默认档每端只印前 `SHAPE_SITE_PRINT_PER_END` 个文件(全量档跑在 pre-commit 链里,刷屏等于
 *     逼人 `--no-verify`),其余走 `--dump-missing`(与既有"逐条见 --dump-missing"同一手法)。
 *
 * `--dump-missing <file>` 写出的 JSON **形状不变**(仍是死调用数组)—— 那是既有调用者的契约;
 * 盲区逐条只进 stdout 那一份列表。
 */
const TRANSPORT_RE_G = new RegExp(TRANSPORT_RE.source, TRANSPORT_RE.flags + 'g')
/** 单个盲区文件最多点几条(一屏里不让一个 60 处 `fetch(` 的文件占满) */
const SHAPE_SITE_CAP = 3
/** 默认档每端打印的盲区文件数 */
const SHAPE_SITE_PRINT_PER_END = 8
/** 盲区站点:`{end, file, carriers:[传输口形态], sites:[{line,text,note}], crossLineOnly, callLike}` */
const shapeUnknownSites = []
/**
 * 从**同一个** TRANSPORT_RE 里取出这个文件的传输口形态与行位置。
 * 跨行形态(`fetchApi\n(` —— `\s*` 能吞换行)在整文件上命中、在单行上取不到 ⇒
 * `crossLineOnly:true`,仍登记文件名(否则数字对不上,就是"把没点名说成没有")。
 *
 * `note` 只是**给登出来的那一行贴事实标签**,不改任何计数口径:
 *  · `import型` —— 命中的是 `import … from '@ihui/api-client'` 一类语句 ⇒ 这文件把调用交给
 *    共享传输口,路径住在 `packages/api-client`(该包**已在面内**,实测 700 处调用点)。
 *  · `注释态` —— 原文里有传输口字样、`maskComments` 之后就没了 ⇒ 它压根不是调用点。
 *    (计数读的是原文,所以这一型今天**仍算在 504 里** —— 我不改这个口径,一改就是在放宽判据;
 *     但把它标出来,读报告的人才知道"180 个盲区文件"里有多少其实是一个 `// Taro.request 说明`。)
 *  · 两者都不是 ⇒ `callLike`:真的发了调用而路径静态读不出(`fetch(\`${BASE}/api/x\`)`、
 *    `fetchApi(BASE + '/x')`、路径住在变量里)。**这一型才是"看不见的那一型"**。
 */
function collectShapeUnknownSites(rel, end, src) {
  const carriers = new Set()
  const sites = []
  const lines = src.split('\n')
  const maskedLines = maskComments(src).split('\n')
  let callLike = false
  for (let i = 0; i < lines.length; i++) {
    let hits = null
    try {
      hits = [...lines[i].matchAll(TRANSPORT_RE_G)]
    } catch {
      hits = []
    }
    if (hits.length === 0) continue
    for (const h of hits) carriers.add(h[0].replace(/\s+/g, ' ').trim())
    if (sites.length >= SHAPE_SITE_CAP) continue
    const maskedHits = (() => {
      try {
        return [...(maskedLines[i] ?? '').matchAll(TRANSPORT_RE_G)].length
      } catch {
        return 0
      }
    })()
    // 命中本身是不是"import 形态":TRANSPORT_RE 的最后一个分支就是 `from '@ihui/api-client'`,
    // 所以命中串以 `from` 开头 ⇒ 这一行是 import/export 语句(多行 import 的**续行**也以 `from`
    // 起头,按行首猜 `^\s*(import|export)` 会漏掉它 —— 直接从命中串判,不再发明第三条规则)。
    const importOnly = hits.every((h) => /^\s*from\b/.test(h[0]))
    let note = ''
    if (maskedHits === 0) note = '注释态(遮罩后该行无传输口,非代码)'
    else if (importOnly) note = 'import/export 语句(路径住在被引模块内)'
    else note = '传输口在代码里、路径抽不出(形态见原文)'
    if (maskedHits > 0 && !importOnly) callLike = true
    // 注释态站点不引原文(G-962 机制⑥镜像锁:注释里的路径不得出现在任何报名里 ——
    // 报名 = file:line + 形态 + 标签,证据文字不是点名的必要条件;引原文会把
    // `fetchApi('/api/ghost/…')` 型说明注释的路径 echo 进报告,读报告的人无从
    // 区分"这是盲区标签"还是"这是被点名的调用"。计数口径一字未动,只改打印面。)
    sites.push({
      line: i + 1,
      text: maskedHits === 0 ? '〔注释行,原文不引(防路径进报名)〕' : lines[i].trim().slice(0, 110),
      note,
    })
  }
  return {
    end,
    file: rel,
    carriers: [...carriers].sort(),
    sites,
    crossLineOnly: carriers.size === 0,
    callLike,
  }
}
/** 取不到内容的**前端代码文件**(与"配置面缺失"分开报,免得一句"取不到 1 个文件"混着两件事) */
const unreadCode = []
/** CLI 端"调用点确实在、路径住在变量里"的站点 ⇒ 未判定,逐条点名(不记通过、也不判红) */
const cliUnresolved = []
/** 变量站点总数 / 一跳解析出的路径条数(报告行要区分"全解析出来"与"一条都没有")。 */
let cliVarSites = 0
let cliVarPaths = 0
/** ===== BP 腿(裸路径传输口调用)的累计器,2026-10-19 立;判据见 extractBareTransportCalls ===== */
const bareCalls = []
/** 全仓桶计数(逐端各桶之和必须等于它 —— 桶加总对不上就是尺子坏了,见 classifyBareLegVerdict) */
const bareCensus = new Map()
/** 逐端桶计数:`end -> {files, candidates, byBucket:Map}` —— 交付报告要的"逐端分布" */
const bareEndCensus = new Map()
for (const e of ACTIVE_ENDS) bareEndCensus.set(e.name, { files: 0, candidates: 0, byBucket: new Map() })
/** 本腿扫过的受管前端文件数(取不到内容的不算,那一格已由 unreadCode 点名) */
let bareScannedFiles = 0
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
  if (calls.length === 0 && TRANSPORT_RE.test(src)) {
    st.shapeUnknown++
    shapeUnknownSites.push(collectShapeUnknownSites(rel, end, src))
  }
  allCalls.push(...calls)
  // ===== BP 腿:同一份 src、同一个判定面,抽"传输口 URL 实参位上的裸路径字面量" =====
  // 不进 allCalls(那会撞主腿的既有基线口径与 `前端 API 调用: N 处` 汇总行),
  // 由下面「裸路径腿(BP)」段单独对账、单独棘轮、单独三态点名。
  bareScannedFiles++
  {
    const be = bareEndCensus.get(end)
    be.files++
    const bare = extractBareTransportCalls(src, rel, urlAliasRules, rewriteExemption)
    bareCalls.push(...bare.calls)
    for (const [k, v] of bare.census) {
      bareCensus.set(k, (bareCensus.get(k) || 0) + v)
      be.byBucket.set(k, (be.byBucket.get(k) || 0) + v)
      be.candidates += v
    }
  }
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
  const silentEnds = ACTIVE_ENDS.filter((e) => endStats.get(e.name).calls === 0)
  if (silentEnds.length > 0) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 本轮 0 个调用点的端:${silentEnds
        .map((e) => `${e.name}(文件 ${endStats.get(e.name).files})`)
        .join(' / ')} —— 无判据不等于已判过${C.reset}`,
    )
  }
}
const faceEmptyEnds = ACTIVE_ENDS.filter((e) => endStats.get(e.name).files === 0)
if (faceEmptyEnds.length > 0) {
  // 面里**一个受管源文件都没枚举到** ≠ 这一端干净:要么是目录搬走了,要么是枚举失效。
  // 判红会把"与本次提交无关的目录形态"算到提交者头上(恒红门,§12e),所以走 exit 0 + 大声点名,
  // 但结论行必须带上这条 —— 否则 `app-shared:文件 0 / 调用 0` 读起来就像"已判过且没问题"。
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定:${faceEmptyEnds.map((e) => e.name).join(' / ')} 在 ${FACE} 面枚举到 0 个受管源文件(枚举失效或目录搬家,本轮对这一格没有判据)${C.reset}`,
  )
}
for (const e of ACTIVE_ENDS) {
  const s = endStats.get(e.name)
  console.log(
    `${C.dim}  · ${e.name}:文件 ${s.files} / 调用 ${s.calls} / 取不到内容 ${s.unreadable} / 未判定(有传输口却抽不出路径)${s.shapeUnknown}${e.probe ? '(探针档·只报数·永不判红)' : e.ratchet ? '(存量走棘轮)' : '(零容忍)'}${C.reset}`,
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
function buildRouteIndex(pathSet) {
  const exactKeys = new Set()
  const segBuckets = new Map() // segCount -> Map(method -> parts[])
  const starEntries = [] // { method, parts }
  for (const bp of pathSet) {
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
  return { exactKeys, segBuckets, starEntries }
}
const { exactKeys, segBuckets, starEntries } = buildRouteIndex(backendPathSet)
/** 精确档专用:「前缀假设」面的同型索引(兜底档它已是绿档本身,不需要第二份) */
const assumptionIndex = GRAPH_AVAILABLE ? buildRouteIndex(assumptionPathSet) : null
/**
 * 原 pathMatches 非通配分支逐行搬移(段数校验保留,防分桶外误用)
 *
 * ## 已知假绿(2026-10-04 定位并实证,**刻意不修**,理由见下)
 *
 * 形态:`:param` 段被双向 `continue` 跳过之后,「段数相等」成了唯一约束
 * ⇒ 一条**纯通配**注册会吞掉任意同段数路径。
 *
 * 实证链(每一步都留了痕,下一个人不必重查):
 *  1. 向`packages/api-client/src/endpoints/agent.ts` 注入 `fetchApi('/api/zzz-not-here')`
 *     ⇒ 本门报 `api-client:死调用 0 处 = 存量 0 + 新增 0`。**明显不存在的路径不报。**
 *  2. 排除了取材面:本函数的取材正则(`pathRe`,见上)单独复算**能**匹配该形态。
 *  3. 排除了豁免:棘轮基线 `scripts/api-routes-baseline.json` 与
 *     `.check-api-routes-ignore.json` **均不含**该路径。
 *  4. 排除了 catch-all:`matchStar` 的 `['*']` 形态(零比较、见下)只出现在**自测夹具**里,
 *     不在真实注册面;真实 catch-all 都带至少一个字面量前缀段,匹配行为正常。
 *  5. ~~定位到元凶:真实注册 `GET /api/admin/content/:type/:id` 被拼成 `/api/:type/:id`,
 *     `admin/content` 段丢失~~ —— **该结论经二次实测不成立,别沿着它走。**
 *
 * ## ⚠️ 更正(2026-10-04 二次定位):真元凶是「3 段全参条目」,不是"前缀丢段"
 *
 *  · 该路由的挂载前缀是 `/api/admin/content`(`apps/api/src/routes/index.ts:861`),
 *    它**在** 166 个组合前缀里 ⇒ `GET /api/admin/content/:type/:id` **本来就在注册面中**,
 *    带 `admin` + `content` 两个字面量锚段,**不是纯通配**;
 *  · `/api/:type/:id` 不是"丢失"的产物,而是构建注册面时那行
 *    `backendPathSet.add(\`${r.method} ${r.localPath}\`)` 把**裸 localPath**
 *    (`/:type/:id`,3 段)单独收进面导致的 —— 那是**多拼**,不是少拼。
 *
 * ### 段数算术(这一格的真判据)
 * 路径按 `path.split('/')` 切,首段是空串,所以:
 *   探针 `/api/zzz-not-here`            → **3 段**
 *   裸条目 `/:type/:id`                 → **3 段** ⇒ **命中**(吞掉探针的就是它)
 *   带锚 `/api/admin/content/:type/:id` → **6 段** ⇒ **不命中**
 *
 * 面规模实测:`5383 条注册 × 166 个组合前缀 = 893,578` → 去重 **824,790** ——
 * 注册面 99.99% 是笛卡尔积产物。其中 3 段纯通配条目约 10 个
 * (来自 24 个"localPath 本身是 `/:x`"的路由文件),外加 3 条裸全参条目
 * (`GET|PATCH|DELETE /:type/:id` @ `apps/api/src/routes/admin/content/crud.ts`)。
 *
 * ## 收口代价已实测量化(为什么仍然不动)
 *
 * 收口假绿**必然是减量** —— 探针之所以假绿正是因为这些条目在面里,删掉即"在册 → 不在册",
 * 与"只增不减"的硬约束冲突。三方案实测:
 *   S1 删裸全参条目      → 面 824,756,探针**仍不可见**,新增死调用 0
 *   S2 删笛卡尔积纯通配  → 面 824,759,探针**仍不可见**,新增死调用 5
 *   S1+S2(最小可用)     → 面 824,725,探针**可见**,新增死调用 **27**
 *   理想全解析(563 文件) → 面 10,006,探针**仍不可见**,新增死调用 **1,197**
 * 关键:**S1 或 S2 单独都修不好**(各自还剩另一半在吞),必须同时做。
 * 那 27 条逐条抽查:**真错与取材假影混杂** ——
 * `GET /api/model-pricing`、`GET /api/security-audit` 后端确实不存在(真错,约 10 条);
 * `/api/ai-tutor:param`、`/api/subagents/all:param` 是取材正则把模板串 `${path}`/`${suffix}`
 * 误抽成字面 `:param` 造成的**假影**(约 17 条)。
 * ⇒ 直接落红会误伤。理想收口更糟:代价最大而收益为零(探针仍不可见)。
 *
 * **为什么不在匹配侧收紧**:量表(7 端逐端算)显示收紧后各端新增死调用 **+294 条**,
 * 而抽样里大量是**真实接口** —— `/api/plans`(`billing.ts:25` 的 `'/plans'` +
 * `index.ts:536` 的 `prefix:'/api'`)、`/api/data` 等。
 * "纯通配"是本仓 prefix 拼接的**常态**,按形态收紧 ⇒ 恒红门 ⇒ 逼人 `--no-verify`
 * 连带废掉全部守门(AGENTS §12e)。
 *
 * ## ✅ ① 取材侧修准 `:param` 假影 —— **本票已完成(2026-10-04)**
 *
 * 判据落在 `isTemplateInterpolationPhantom`(与 `normalizeCallPath` 同序:`${}` 先替换、
 * `?.*` 后丢弃),在 `extractFrontendCalls` 里把「粘连插值 + 插值非查询串构造器」这一形态
 * 标记为「抽不出真路径」,归入既有的「未判定(有传输口却抽不出路径)」桶,**不进调用集**。
 * `pathRe` 字符类**一个字符都没动**(收窄它会连带抽不出 1,158 条真实插值调用,已实测否证;
 * 否证理由与形态三分法都写在 `isTemplateInterpolationPhantom` 的注释里)。
 *
 * 本票实测结论(HEAD 面 = 工作树面,两面读数逐行相同):
 *  · 全量调用集 **2,774 → 2,772**,逐条对账**只少那 2 条假影、零新增**:
 *    `POST /api/ai-tutor:param @ apps/web/src/api/edu-api.ts:113`、
 *    `GET /api/subagents/all:param @ packages/api-client/src/endpoints/subagents.ts:186`。
 *  · 假影现场**恰是 2 处**(不是量表估的 17 —— 那个数含被 3 段通配吞掉的其他族),
 *    判据逐条回源码那一行核过,见交付报告。
 *  · 各端死调用读数**未上升**(HEAD/worktree 两面 dump-missing 均 2 → 2)。
 *  · 镜像测试 `scripts/tests/check-api-routes-template-interp.test.mjs`(T1–T5)已钉住,
 *    变异验证:退回修复 ⇒ T1/T5 翻红;改成"收窄正则"或"按文件整份跳过" ⇒ T2/T4/T5 翻红。
 *
 * **剩什么(本门这一格仍未收口)**:① 已修完,但它**只是为 ② 让路**——
 * S1+S2 未做,那约 10 条**真错**(`/api/model-pricing`、`/api/security-audit` 等)仍被
 * 3 段纯通配条目吞着,"死调用 0 处"这个读数**仍然不能读成"对账通过"**;
 * 覆盖缺口提示与 `scripts/tests/check-api-routes-wildcard-gap.test.mjs`(G1–G6)继续钉住
 * "缺口必须报、不得记绿"。下一步仍是 **② S1+S2 减量 → ③ 逐条裁决那批真错
 * → ④ 才谈判红起点**。
 *
 * ## O87g(2026-10-22)判据分档:上面这副笛卡尔面降为「无入口」兜底档
 *  · `server.ts` 在面 ⇒ 后端注册面 = `scripts/lib/route-registration-extract.mjs` 的**精确挂载图**
 *    (前缀沿 `register` 的边逐层累加,`/api/courses` 那一型假路径在图里**拼不出来**——
 *    阳性对照见 `scripts/tests/check-api-routes.test.mjs` P 组)。匹配器(`matchSegs/matchStar`)
 *    一字未动;三档索引构造收口成一份 `buildRouteIndex`(主面与「前缀假设」面同型,不抄第二遍)。
 *  · 精确档的**三态判序**:图命中 ⇒ 绿;图走不到但在不透明前缀下 ⇒ 未判定(不透明挂载);
 *    图走不到、旧笛卡尔「前缀假设」拼得出 ⇒ 未判定(前缀假设命中,逐条报名 + 进
 *    `--dump-undetermined`)—— 库暂不跟 re-export barrel,图未追到的**真挂载链**与 O87g 点名的
 *    **假路径**在这一格结构上不可分辨,所以既不冒红(§12e)也**绝不记绿**(票面核心);
 *    两头都不命中 ⇒ 死调用判红。兜底档里前缀假设**就是**绿档,不存在降级。
 *  · `server.ts` 不在面 ⇒ 挂载图无起点,退回本节旧笛卡尔档(本段所述假绿**仍在**),
 *    结论行大声点名,不冒充精确档。
 */
/**
 * 原 pathMatches 非通配分支逐行搬移(段数校验保留,防分桶外误用)。
 *
 * 2026-10-23 起本函数只是 `classifyRouteCoverage` 的布尔投影(单一真相源,§0.6)——
 * 「命中」与「哪一档命中」必须由同一份判据给出,否则主腿按档分流、其他腿按布尔判在册,
 * 两条口径迟早漂移(本仓记过最多的一型)。语义逐条不变:`!== null` ⇔ 原 matchSegs 为真。
 *
 * ## 已知假绿 —— 参数段吞并(2026-10-23 修,见 `backendCoverage`)
 *
 * 旧 `matchSegs` 对 `:param` 段两侧都 `continue` ⇒ 「段数相等」是唯一约束,一条参数路由会吞掉
 * 任意同段数的具体路径:`GET /api/asks/my` 被 `GET /api/asks/:id` 记成「已在册」,而后者
 * 只证明"某个 ID 路由存在",不证明 `/asks/my` 这条静态路由存在。主腿现由 `backendCoverage`
 * 分档处理(param 档落「未判定」桶,不记绿);本函数保留布尔语义供前缀假设/通道等价两腿复用。
 */
function matchSegs(fParts, bParts) {
  return classifyRouteCoverage(fParts, bParts) !== null
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
 * 「这条路径在这个 method 下被后端覆盖到了哪一档」—— 主腿、BP 腿、通道等价腿共用的唯一查询出口:
 *   literal —— 字面静态注册(或前端动态段对后端参数段,同一路由形状)⇒ 真在册;
 *   param   —— 只被 `:param` 段吞下(前端具体字面段被后端参数段覆盖)⇒ **不得记成在册**;
 *   wild    —— 只被 `*` catch-all 接住(本票不动的一族,见下方覆盖缺口提示);
 *   none    —— 一条都不命中。
 * 判序与旧 `backendHasRoute` 逐条同构(exact → 段桶 → star),唯一差别是段桶命中时再多给一档;
 * `literal/param/wild` 的并集与旧布尔 true 逐个调用相同(等价性由 `classifyRouteCoverage` 保证)。
 */
function backendCoverage(method, callPath) {
  const f = callPath.replace(/\/$/, '')
  const fParts = f.split('/')
  if (exactKeys.has(`${method} ${f}`)) return 'literal'
  let sawParam = false
  const byMethodMap = segBuckets.get(fParts.length)
  if (byMethodMap) {
    const buckets =
      method === 'ANY' ? [...byMethodMap.values()] : [byMethodMap.get(method)].filter(Boolean)
    for (const arr of buckets) {
      for (const bParts of arr) {
        const kind = classifyRouteCoverage(fParts, bParts)
        if (kind === 'literal') return 'literal'
        if (kind === 'param') sawParam = true
      }
    }
  }
  if (sawParam) return 'param'
  for (const e of starEntries) {
    const methodOk = method === 'ANY' || e.method === method
    if (methodOk && matchStar(fParts, e.parts)) return 'wild'
  }
  return 'none'
}
/**
 * 「这条路径在这个 method 下在册吗」—— 与主对账循环**共用一份索引与判据**的唯一查询出口
 * (通道等价维要问的就是同一件事,另写一遍必然与主循环漂移)。
 * 2026-10-23:布尔口径**保持原语义**(param 档也算"有注册"),因为 BP/通道等价腿问的不是
 * "这条具体静态路径是否存在";`param` 档的「未判定」只在主腿(前端调用对账)生效。
 */
function backendHasRoute(method, callPath) {
  return backendCoverage(method, callPath) !== 'none'
}
/**
 * 「这条路径只在『前缀假设』面里命中吗」—— 精确档降级判据专用(O87g)。
 * 匹配器与主判据同一份(matchSegs/matchStar),只是索引换成笛卡尔面;
 * 兜底档恒 false(那一档笛卡尔面**就是**绿档,不存在降级)。
 */
function assumptionHasRoute(method, callPath) {
  if (!assumptionIndex) return false
  const f = callPath.replace(/\/$/, '')
  const fParts = f.split('/')
  if (assumptionIndex.exactKeys.has(`${method} ${f}`)) return true
  const byMethodMap = assumptionIndex.segBuckets.get(fParts.length)
  if (byMethodMap) {
    const buckets =
      method === 'ANY' ? [...byMethodMap.values()] : [byMethodMap.get(method)].filter(Boolean)
    for (const arr of buckets) {
      for (const bParts of arr) if (matchSegs(fParts, bParts)) return true
    }
  }
  for (const e of assumptionIndex.starEntries) {
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
/**
 * 精确档下再并入挂载图自己报出的不透明前缀(票面②「必须保留不透明前缀的未判定出口」):
 * `register(符号, { prefix })` 解不到目标(第三方插件/动态符号)时,该前缀下的调用
 * 落「未判定」而非 missing —— 既不冒红也不记绿。库给的前缀无尾斜杠,补 `/` 做段边界,
 * 免得 `/api/foo` 把 `/api-foobar` 也吞进射程。
 */
const EFFECTIVE_OPAQUE = [
  ...OPAQUE_MOUNT_PREFIXES,
  ...(regGraph
    ? regGraph.opaque.map((o) => ({
        prefix: o.prefix.endsWith('/') ? o.prefix : `${o.prefix}/`,
        evidence: o.evidence,
      }))
    : []),
]
const opaqueUndetermined = []
/** 精确档:图走不到、但「前缀假设」笛卡尔面拼得出的调用 —— 不记绿也不判红,逐条报名 */
const assumptionUndetermined = []
/**
 * 「未判定(参数段覆盖)」桶(2026-10-23 立,收参数段假命中盲区):
 * 前端调用路径是**具体字面**、后端只有 `:param` 路由能在同段数上接住它 —— 典型
 * `GET /api/asks/my` ↔ `GET /api/asks/:id`。旧判据把这种命中记成「已在册」,于是一条
 * 从未注册的具体路径(真死调用)在账面是绿的。本桶**不记绿也不判红**(§12e:存量当场判红
 * 就是恒红门),但必须逐条点名 + 计入结论行,不许读成"已对账"。
 * 方向纪律(fail-closed):宁可把"参数路由恰好接住"的活路径列进未判定,也不许把死调用读活。
 */
const paramCovered = []
const missing = []
const seen = new Set()
for (const call of allCalls) {
  const key = `${call.method} ${call.path}`
  if (seen.has(key)) continue
  seen.add(key)
  // 检查是否在后端注册(静态字面优先:只被 :param 覆盖不算在册,见 backendCoverage)
  const f = call.path.replace(/\/$/, '')
  const coverage = backendCoverage(call.method, call.path)
  if (coverage === 'param') {
    paramCovered.push(call)
    continue
  }
  const found = coverage === 'literal' || coverage === 'wild'
  if (!found) {
    const op = EFFECTIVE_OPAQUE.find((o) => f.startsWith(o.prefix))
    if (op) {
      // 判不出 ≠ 没有:与守门 127「不透明前缀下的未判定」同一口径,单独计数并点名,
      // 既不冒红(把别人的正确实现钉成死调用),也绝不静默成"看起来全绿"。
      opaqueUndetermined.push({ ...call, evidence: op.evidence })
      continue
    }
    if (assumptionHasRoute(call.method, call.path)) {
      // 命中旧笛卡尔面 ≠ 在册:可能是图未追到的真挂载链,也可能是 O87g 点名的假路径。
      // 两型在静态判据里不可分辨 ⇒ 既不冒红也不记绿,落未判定并逐条报名(票面③)。
      assumptionUndetermined.push(call)
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

/* ============================================================================
 * ===== 裸路径传输口腿(BP)的对账段(2026-10-19 立)=====
 * 抽取与归一判据见 `extractBareTransportCalls` / `classifyBareLiteral`(唯一实现,本段只消费)。
 * 在册与否问的是**主对账同一份索引与判据**(`backendHasRoute`),不另写匹配器;
 * 不透明挂载、ignore 豁免、转发面豁免也全部复用主腿既有出口(§0.6)。
 * 本腿**不进 allCalls / 不进主基线 / 不改 `前端 API 调用: N 处` 汇总行** —— 它有自己那份
 * 棘轮锚点 `BARE_LEG_BASELINE_REL`,这样"新腿看见的存量"不会把主腿的既有基线读成新增(§12e)。
 * ========================================================================== */
const bareCandidatesTotal = [...bareCensus.values()].reduce((a, b) => a + b, 0)
/** 逐端候选/可判数(交付报告要的分布) */
const bareEndRows = []
for (const e of ACTIVE_ENDS) {
  const be = bareEndCensus.get(e.name)
  if (!be) continue
  bareEndRows.push({
    end: e.name,
    files: be.files,
    candidates: be.candidates,
    adjudicated: be.byBucket.get('api') || 0,
    byBucket: be.byBucket,
  })
}
/**
 * 三态判序走唯一实现。`repoWide` 只在**整仓面(head)**为真:staged 档扫的是暂存子集,
 * "子集里恰好没有裸路径"是常态,据此判死就是一台与改动无关的门(§12e);
 * `--worktree` 是夹具/人工档,同理不参与"整仓一条也没抽到"这一判。
 */
const bareLegVerdict = classifyBareLegVerdict({
  scannedFiles: bareScannedFiles,
  candidates: bareCandidatesTotal,
  census: bareCensus,
  repoWide: FACE === 'head',
})

/** 逐文件去重(主腿按 method+path 全局去重;本腿要按文件棘轮,键必须带 file) */
const bareSeen = new Set()
const bareUnique = []
for (const c of bareCalls) {
  const k = `${c.method} ${c.path} @ ${c.file}`
  if (bareSeen.has(k)) continue
  bareSeen.add(k)
  bareUnique.push(c)
}
const bareRegistered = []
const bareMissing = []
const bareIgnored = []
const bareOpaque = []
/**
 * BP 腿「未判定(参数段覆盖)」：裸路径(`fetchApi('/asks/my')` 这类,运行期由 normalizeUrl 补 `/api`)
 * 同样会被同段数的 `:param` 路由接住 —— 与主腿**同一判据同一档**(§0.6,不另发明)。
 * 实证:`packages/api-client/src/endpoints/community.ts` 的 `/asks/my`、`/asks/my/answers` 只是
 * `fetchApi()` 的裸路径实参,后端只有 `/asks/:id`、`/asks/:id/answers`,旧口径下两条都被记成
 * 「已在册」;真死调用因此在本门结构上不可见。
 */
const bareParam = []
/** BP 腿与主腿同一降级判据(§0.6 不另发明):图走不到但前缀假设拼得出 ⇒ 未判定,不判红 */
const bareAssumption = []
for (const c of bareUnique) {
  const coverage = backendCoverage(c.method, c.path)
  if (coverage === 'literal' || coverage === 'wild') {
    bareRegistered.push(c)
    continue
  }
  if (coverage === 'param') {
    bareParam.push(c)
    continue
  }
  const f = c.path.replace(/\/$/, '')
  const op = EFFECTIVE_OPAQUE.find((o) => f.startsWith(o.prefix))
  if (op) {
    bareOpaque.push({ ...c, evidence: op.evidence })
    continue
  }
  if (assumptionHasRoute(c.method, c.path)) {
    bareAssumption.push(c)
    continue
  }
  if (matchesIgnore(c)) {
    bareIgnored.push(c)
    continue
  }
  bareMissing.push(c)
}

/* ============================================================================
 * ===== 「未判定(前缀假设命中)」两腿的裁决台账(票 G-962 续作 2026-10-22 立)=====
 * 桶是"两型静态不可分辨"的暂存格,不是结论;台账把它变成"逐条裁决 + 证据 + 归属 + 到期"。
 * 已裁条目退出未判定桶(计数按台账下降),但**禁消音** —— 必须在「已裁决(台账)」块逐条点名
 * (与不透明挂载桶"判不出就点名"同一条禁令)。
 * 台账经 `readSource` 按判定面读:缺档 ⇒ 本轮两腿维持未判定(不判红、不下降,与 BP 基线缺档
 * 同一手法);解析失败 ⇒ 同样降级为"台账读不出" —— 坏台账不得静默把桶清空,那比没台账更危险。
 * 三型判红(仿守门 150 AJ 模板,`check-radius-role-conformance.mjs::applyAdjudications`):
 *  AJ1 条目形状不全(leg/method/path/verdict/reason/owner/reviewBy 缺一不可;bare 腿另需 file)⇒ 红;
 *  AJ2 reviewBy 已过 ⇒ 红,该站点退回未判定桶(过期裁决不得继续替站点免检);
 *  AJ3 台账条目在本轮桶面找不到对应键 ⇒ 清单腐烂红(站点已删/已改对 ⇒ 必须了结该条)。
 *    AJ3 只在 head 整仓面对账:staged 面只扫暂存文件、桶天然是子集,拿全量台账去比会恒冒假红
 *    (§12e,与 BP 腿 `repoWide` 同一挡法);worktree 是夹具/人工档,同理记未判定、不冒红不记绿。
 * ========================================================================== */
const assumptionAdjLedger = {
  adjudicatedMain: [],
  adjudicatedBare: [],
  problems: [],
  unjudgedAj3: 0,
  degraded: null,
}
if (GRAPH_AVAILABLE) {
  const adjSrc = readSource(ASSUMPTION_ADJ_FILE_REL)
  let ledgerItems = null
  if (adjSrc === null || adjSrc === undefined) {
    assumptionAdjLedger.degraded = `${FACE} 面里没有 ${ASSUMPTION_ADJ_FILE_REL} —— 前缀假设未判定两腿本轮不应用任何裁决(如实说明,不是"全部未裁")`
  } else {
    try {
      const j = JSON.parse(adjSrc)
      if (!j || !Array.isArray(j.items)) throw new Error('缺 items 数组')
      ledgerItems = j.items
    } catch (e) {
      assumptionAdjLedger.degraded = `${ASSUMPTION_ADJ_FILE_REL} 解析失败:${e.message} —— 坏台账不得静默当空台账用,两腿本轮维持未判定`
    }
  }
  if (ledgerItems) {
    const today = new Date().toISOString().slice(0, 10)
    const mainBucketKeys = new Set(assumptionUndetermined.map((c) => `${c.method}|${c.path}`))
    const bareBucketKeys = new Set(bareAssumption.map((c) => `${c.method}|${c.path}|${c.file}`))
    const validMain = new Map()
    const validBare = new Map()
    for (const it of ledgerItems) {
      const where = `${it?.leg ?? '(缺leg)'} ${it?.method ?? '?'} ${it?.path ?? '(缺path)'}`
      if (
        !it ||
        typeof it !== 'object' ||
        (it.leg !== 'main' && it.leg !== 'bare') ||
        typeof it.method !== 'string' ||
        typeof it.path !== 'string'
      ) {
        assumptionAdjLedger.problems.push(`AJ1 条目形状不全(leg ∈ {main,bare} / method / path 缺一不可):${where}`)
        continue
      }
      if (it.leg === 'bare' && typeof it.file !== 'string') {
        assumptionAdjLedger.problems.push(`AJ1 bare 腿条目缺 file(键 = method|path|file):${where}`)
        continue
      }
      if (!['alive', 'dead', 'human-review'].includes(it.verdict)) {
        assumptionAdjLedger.problems.push(`AJ1 verdict 不是 alive/dead/human-review:${where}`)
        continue
      }
      if (typeof it.reason !== 'string' || it.reason.trim() === '') {
        assumptionAdjLedger.problems.push(`AJ1 裁决无理由:${where}`)
        continue
      }
      if (typeof it.owner !== 'string' || it.owner.trim() === '') {
        assumptionAdjLedger.problems.push(`AJ1 裁决无归属(谁负责复裁):${where}`)
        continue
      }
      if (typeof it.reviewBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(it.reviewBy)) {
        assumptionAdjLedger.problems.push(`AJ1 到期日缺失或形态不对(要 YYYY-MM-DD):${where}`)
        continue
      }
      const key = it.leg === 'main' ? `${it.method}|${it.path}` : `${it.method}|${it.path}|${it.file}`
      const bucketKeys = it.leg === 'main' ? mainBucketKeys : bareBucketKeys
      if (!bucketKeys.has(key)) {
        if (FACE === 'head') {
          assumptionAdjLedger.problems.push(
            `AJ3 清单腐烂:台账条目在 head 整仓面的前缀假设桶里找不到对应站点 ⇒ 要么站点已删/已改对,要么桶判据变了,必须把这条了结:${key}`,
          )
        } else {
          assumptionAdjLedger.unjudgedAj3++
        }
        continue
      }
      if (it.reviewBy < today) {
        assumptionAdjLedger.problems.push(
          `AJ2 裁决到期未复裁(reviewBy=${it.reviewBy} < ${today}),该站点退回未判定桶:${key}`,
        )
        continue
      }
      ;(it.leg === 'main' ? validMain : validBare).set(key, it)
    }
    const keptMain = []
    for (const c of assumptionUndetermined) {
      const it = validMain.get(`${c.method}|${c.path}`)
      if (it) assumptionAdjLedger.adjudicatedMain.push({ ...c, verdict: it.verdict, owner: it.owner, reviewBy: it.reviewBy })
      else keptMain.push(c)
    }
    assumptionUndetermined.length = 0
    assumptionUndetermined.push(...keptMain)
    const keptBare = []
    for (const c of bareAssumption) {
      const it = validBare.get(`${c.method}|${c.path}|${c.file}`)
      if (it) assumptionAdjLedger.adjudicatedBare.push({ ...c, verdict: it.verdict, owner: it.owner, reviewBy: it.reviewBy })
      else keptBare.push(c)
    }
    bareAssumption.length = 0
    bareAssumption.push(...keptBare)
  }
}

const UPDATE_BARE_BASELINE = process.argv.includes('--update-bare-baseline')
const bareCountsByFile = new Map()
for (const c of bareMissing) {
  bareCountsByFile.set(c.file, (bareCountsByFile.get(c.file) || 0) + 1)
}

if (UPDATE_BARE_BASELINE) {
  const payload = {
    version: 1,
    anchor: '该文件在基线里的"裸路径传输口死调用"存量数(只减不增;新增即判红,存量只报数)',
    leg: 'BP 腿:传输口 URL 实参位上引号紧邻、不以 /api/ 开头的裸路径字面量,按 normalizeUrl 现读档归一成 /api/…（判据见 scripts/check-api-routes.mjs::extractBareTransportCalls）',
    reason:
      '存量于 2026-10-19 现读得到:此前这一族调用点结构上进不了守门 8 的调用集(pathRe 要求引号紧邻 /api/),所以"存量"不是谁写坏了,是没人对过账。' +
      '本轮已把能在本层收口的全部收掉(裸路径死调用 28 → 15,逐文件见 perFileCount),余下 15 条逐条分类(全量档 HEAD 面读数):' +
      '① `apps/web/src/hooks/use-terminal-session.ts` 11 条 = 终端会话能力,两个后端都没有对应 REST(' +
      '会话源在 Redis,`apps/api/src/routes/terminal.ts:13-14`;ws 通道 `/ws/terminal/:sessionId` 是独立分档,不覆盖任何一条 REST)⇒ 属**新增能力,须人定档**;' +
      '② `apps/mobile-rn/src/screens/CircleIndexScreen.tsx` 1 条 `/circles/topics/hot` = 无源(已注册的邻居 `GET /api/circles/topic/list` ' +
      '返的是 circle_dynamic 行,无 name/count 字段,而本屏渲染的正是 topic.name + topic.count;`GET /api/topics` 是课程专题域,另一套资源);' +
      '③ `apps/mobile-rn/src/screens/TopicDetailScreen.tsx` 1 条 `/circles/topic/:id/follow` = 无表无源(TARGET_TYPES 不含 topic;' +
      'schema 里零 topic follower 列);' +
      '④ `packages/api-client/src/endpoints/community.ts` 2 条(`/asks/my/count`、`/asks/my/answers/count`)= 端点不在册、表存在 ⇒ 同属需人定档。' +
      '本基线只把"本轮不判红"这一件事钉住,不等于裁决其为合法调用(§12e:首次纳入的存量当场 blocking 就是恒红门)。',
    face: FACE,
    perFileCount: Object.fromEntries(
      [...bareCountsByFile.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    ),
  }
  const outAbs = join(ROOT, ...BARE_LEG_BASELINE_REL.split('/'))
  writeFileSync(outAbs, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(
    `${C.green}[API 路由比对] BP 腿基线已按当前 ${FACE} 面重写:${Object.keys(payload.perFileCount).length} 个文件 / ${[...bareCountsByFile.values()].reduce((a, b) => a + b, 0)} 处存量 → ${BARE_LEG_BASELINE_REL}${C.reset}`,
  )
  process.exit(0)
}

const bareBaselineSrc = readSource(BARE_LEG_BASELINE_REL)
let bareBaselineCounts = {}
let bareBaselineAvailable = false
let bareBaselineNote = ''
if (bareBaselineSrc === null || bareBaselineSrc === undefined) {
  bareBaselineNote = `${FACE} 面里没有 ${BARE_LEG_BASELINE_REL}`
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定:${bareBaselineNote} ⇒ BP 腿本轮没有棘轮锚点(裸路径死调用逐条列出,只报数不判红)。出路:把基线文件与门的改动同笔提交${C.reset}`,
  )
} else {
  try {
    const parsedBare = JSON.parse(bareBaselineSrc)
    bareBaselineCounts =
      parsedBare && parsedBare.perFileCount && typeof parsedBare.perFileCount === 'object'
        ? parsedBare.perFileCount
        : {}
    if (!parsedBare || !parsedBare.perFileCount) {
      bareBaselineNote = `${BARE_LEG_BASELINE_REL} 缺 perFileCount 字段`
      console.log(
        `${C.yellow}[API 路由比对] ⚠️ 未判定:${bareBaselineNote},本轮按空锚点处理(不静默当没有存量)${C.reset}`,
      )
    } else bareBaselineAvailable = true
  } catch (e) {
    bareBaselineNote = `${BARE_LEG_BASELINE_REL} 不是合法 JSON(${e.message})`
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 未判定:${bareBaselineNote} —— 坏基线不冒充空清单,本轮按无锚点处理${C.reset}`,
    )
  }
}

const bareStock = []
const bareNew = []
const bareNoAnchor = []
for (const [file, n] of bareCountsByFile) {
  const calls = bareMissing.filter((c) => c.file === file)
  if (!bareBaselineAvailable) {
    bareNoAnchor.push({ file, count: n, calls })
    continue
  }
  const allowed = Number(bareBaselineCounts[file]) || 0
  if (n > allowed) bareNew.push({ file, count: n, allowed, calls })
  else if (n > 0) bareStock.push({ file, count: n, allowed, calls })
}
const bareStaleLedger = Object.keys(bareBaselineCounts).filter((f) => !bareCountsByFile.has(f))

/**
 * ===== 通道等价对账的执行段(三条件同时成立才判红;缺一落未判定并点名)=====
 * 三条件各自的事实源都在**同一个判定面**上、同一次 prefetch 里读满(不得一面读盘一面读 git)。
 */
let channelVerdict = null
{
  // 归一事实源复用上面算好的那一份(BP 腿与 CE 判的是同一个事实,不许各读一次)
  const alias = urlAliasRules
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
  const aliasLiteralBlind = collectAliasLiteralBlindSites({
    frontendFiles,
    alias,
    hasRoute: backendHasRoute,
  })
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

/**
 * 判红集合。**探针端必须在这里被显式排除**(`PROBE_END_NAMES`)——
 * 探针端既不在 `RATCHET_ENDS` 里,若只靠上面那行 `!RATCHET_ENDS.has(end)` 兜底,
 * 它们会**掉进 webViolations 兜底桶**(零容忍那档)⇒ 探针档立刻变成 blocking,
 * 正是本档要防的那件事(§12e 恒红门)。所以单列一条判据,不依赖"名单里没有"这种隐式兜底。
 */
const webViolations = realMissing.filter((c) => {
  const end = endByFile.get(c.file)
  if (end && PROBE_END_NAMES.has(end)) return false
  return !end || !RATCHET_ENDS.has(end)
})
/** 探针端死调用:只进这个统计桶,不进 webViolations / ratchetNew / countsByFile(基线也不写它) */
const probeMissing = PROBE_MODE ? realMissing.filter((c) => PROBE_END_NAMES.has(endByFile.get(c.file))) : []
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

/**
 * 探针档统计(2026-10-04):逐端报"扫了多少调用点 / 其中多少条疑似调了不存在的接口",
 * 并**逐条列名**。这一段只写 stdout,**不进 webViolations / ratchetNew / 基线 / 退出码**
 * —— 判据、豁免、退出码一字不动(§12e:先把存量量出来,再谈起点定在哪)。
 * 人工裁决要靠这份名单,只给个数字没法判"是真问题还是形态没认出来"。
 */
if (PROBE_MODE) {
  console.log(
    `${C.cyan}[API 路由比对] 探针档(--probe-ends,只报数·永不判红):以下 ${PROBE_ENDS.length} 端本轮不参与任何判红${C.reset}`,
  )
  for (const e of PROBE_ENDS) {
    const st = endStats.get(e.name)
    const dead = probeMissing.filter((c) => endByFile.get(c.file) === e.name)
    const ignoredN = ignored.filter(
      (c) => endByFile.get(c.file) === e.name,
    ).length
    console.log(
      `${C.dim}  · ${e.name}:文件 ${st.files} / 调用点 ${st.calls} / 疑似不存在 ${dead.length} / 已豁免 ${ignoredN} / 未判定(有传输口却抽不出路径)${st.shapeUnknown}${C.reset}`,
    )
    for (const c of dead.slice(0, 20)) {
      console.log(`${C.yellow}      ⚠︎ ${c.method} ${c.path} @ ${c.file}:${c.line}${C.reset}`)
    }
    if (dead.length > 20) console.log(`${C.dim}      ... 还有 ${dead.length - 20} 条${C.reset}`)
  }
  const probeTotal = probeMissing.length
  console.log(
    probeTotal === 0
      ? `${C.green}[API 路由比对] 探针档合计:${probeTotal} 条疑似不存在(5 端存量 0 ⇒ 这几端目前可原样接进正式面)${C.reset}`
      : `${C.yellow}[API 路由比对] 探针档合计:${probeTotal} 条疑似不存在 —— **本档不判红**;请逐条人工裁决(真问题 / 形态未识别=误报)后再决定起点,不要直接 --no-verify 绕过${C.reset}`,
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
 * 数字之后必须**报名**(P1 扩面票的"报数必须报名 —— 否则读者不知道哪一行是盲区"):
 * 改动前这一格只有 `504 个文件` 一个总数 + 每端一个计数,没有一处名字 ⇒ 读到"死调用 0"的人
 * 无法判断这 0 是"都对账过了"还是"504 个文件根本没看清"。下面按端给
 * ①该端盲区文件数 ②传输口形态 tally(同一份 TRANSPORT_RE 的命中 token,不是第二份判据)
 * ③逐条 `文件:行 原文`。
 *
 * 这一档**永不判红、不进棘轮、不进基线、不改退出码**:它说的是"判据看不见",不是"这里有问题"。
 * 顺带把"为什么不把新端升成 blocking"的依据写在这里(2026-10-05 现读,全量档 HEAD 面):
 * 扩面后的 5 端死调用**存量已清到 0**(见上面 per-end 死调用行)——单看这一格像是可以升档了;
 * **但同一批端里仍有 298 个文件在本门看不见**(mobile-rn 180 / miniapp-taro 47 / extension 45 /
 * cli 20 / api-client 6),其中"传输口在代码里而路径抽不出"的嫌疑文件 **34 个**
 * (15 / 6 / 2 / 8 / 3),其余 264 个只是 `import … from '@ihui/api-client'` 语句或注释里的
 * 传输口字样(路径住在**已在面内**的共享包里,不是盲区嫌疑)。那 34 个的真实形态是
 * `fetchApi('/checkin')` 这类"基址由宿主注入、字面量不以 `/api/` 开头"、`fetch(\`${BASE}/api/x\`)`
 * 前缀插值、`fetchApi(cfg.url)` 路径住在变量里 —— 静态读不出真路径。
 * 看不见就是看不见:据此判红就是把别人的正确实现钉成缺陷(恒红门,§12e),臆造路径就是造第二份
 * 真相。blocking 起点只能等这一格被逐条裁决(或取材侧补上拼接/归一解析)之后再定,那是另一个决定。
 */
{
  const byEnd = new Map()
  for (const s of shapeUnknownSites) {
    if (!byEnd.has(s.end)) byEnd.set(s.end, [])
    byEnd.get(s.end).push(s)
  }
  for (const e of ACTIVE_ENDS) {
    const list = byEnd.get(e.name)
    if (!list || list.length === 0) continue
    const tally = new Map()
    let crossLine = 0
    for (const s of list) {
      if (s.crossLineOnly) crossLine++
      for (const c of s.carriers) tally.set(c, (tally.get(c) || 0) + 1)
    }
    const tallyText =
      tally.size > 0
        ? [...tally.entries()]
            .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
            .map(([k, v]) => `${k}×${v}`)
            .join(' / ')
        : '(单行无命中)'
    // 真正"看不见有没有死调用"的那一档:有调用点、路径却抽不出。import 型与注释型不算嫌疑
    // (前者的路径住在已在面内的共享包里,后者压根不是代码)—— 但两者仍留在计数里,口径不动。
    const suspects = list.filter((s) => s.callLike)
    console.log(
      `${C.yellow}    ${e.name}:盲区文件 ${list.length} 个 —— 其中"传输口在代码里而路径抽不出"${suspects.length} 个文件、import 语句/注释态 ${list.length - suspects.length} 个${crossLine > 0 ? `、跨行传输口 ${crossLine} 个` : ''} | 传输口形态 ${tallyText}${C.reset}`,
    )
    const ordered = [...suspects, ...list.filter((s) => !s.callLike)]
    for (const s of ordered.slice(0, SHAPE_SITE_PRINT_PER_END)) {
      if (s.sites.length === 0) {
        console.log(`${C.dim}      ${s.file} —— 传输口跨行,无单行站点可登${C.reset}`)
        continue
      }
      for (const site of s.sites) {
        console.log(`${C.dim}      ${s.file}:${site.line} ${site.text} —— ${site.note}${C.reset}`)
      }
    }
    if (ordered.length > SHAPE_SITE_PRINT_PER_END) {
      console.log(
        `${C.dim}      ... 还有 ${ordered.length - SHAPE_SITE_PRINT_PER_END} 个文件(逐条见 --dump-missing)${C.reset}`,
      )
    }
  }
}
/**
 * 纯通配注册造成的覆盖缺口(2026-10-04 定位,证据链见 `matchSegs` 上方注释)。
 *
 * **这一格无条件打印,不看本轮死调用是不是 0。** 理由:本门目前实测死调用恒为 0,
 * 而"死调用 0"里有一部分是**真通过**、有一部分是**被纯通配注册吞掉的看不见**——
 * 两者在输出里同形。不点破这一格,读数 0 就被读成"全对账过了",那是把"没判"写成"判过了"。
 *
 * 措辞纪律:不报"门坏了/有洞",只报**事实**——哪些形态当前不可判、原因、影响面。
 * 修法在取材侧(拼接保住中间段),不在匹配侧;匹配侧收紧会误杀真实接口(量表 +294)。
 */
console.log(
  `${C.yellow}[API 路由比对] ℹ️ 覆盖缺口:含 \`:param\` 段的注册(尤其 prefix 拼接后落成 \`/api/:x\` 这类纯通配)` +
    `会吞掉同段数的任意路径 ⇒ 某些"不存在"的调用本门结构上看不见。` +
    `故本门"死调用 0 处"只代表"在可判面内为 0",不代表全量对账通过。` +
    `证据与修法方向见 matchSegs 上方注释(2026-10-04)${C.reset}`,
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
 * 「未判定(参数段覆盖)」—— 2026-10-23 立,无条件打印(0 也要出声)。
 *
 * 为什么 0 也要出声:这一格是"读成已在册"的高危形态,它的**失效方向是安静**——把判据改回
 * 布尔命中时,桶会恒为 0 而输出与"全部是字面静态注册"一模一样。所以 0 必须自证口径:
 * 说清是"一条都没枚举到"还是"对账过、没有这种形态"。
 *
 * 为什么只报数不判红:改判会让存量一次性从"在册"落到这一桶(实测 HEAD 面存量见结论行),
 * 当场判红就是一台与任何提交都无关的恒红门(§12e);升 blocking 的前置是存量归零,
 * 在那之前只许"逐条点名 + 计数 + 不记绿"。
 */
if (paramCovered.length > 0) {
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定(参数段覆盖)${paramCovered.length} 处:前端具体字面路径只在同段数上被后端 \`:param\` 路由接住,不证明该静态路径存在 —— 不记在册也不判红,逐条报名:${C.reset}`,
  )
  for (const c of paramCovered.slice(0, 20)) {
    console.log(`${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}${C.reset}`)
  }
  if (paramCovered.length > 20) {
    console.log(
      `${C.dim}    ... 其余 ${paramCovered.length - 20} 条见 --dump-undetermined 的 paramSegmentCovered${C.reset}`,
    )
  }
} else {
  console.log(
    `${C.dim}[API 路由比对] ℹ️ 未判定(参数段覆盖)0 处 —— 对账了 ${seen.size} 条去重调用,没有"具体字面路径只被 \`:param\` 接住"的站点(不是"这一格没扫")${C.reset}`,
  )
}
if (GRAPH_AVAILABLE && assumptionUndetermined.length > 0) {
  console.log(
    `${C.yellow}[API 路由比对] ⚠️ 未判定(前缀假设命中)${assumptionUndetermined.length} 处调用:挂载图走不到,但旧笛卡尔「前缀假设」拼得出 —— 可能是图未追到的真挂载链(re-export barrel 等),也可能是票 O87g 点名的 /api/courses 型假路径;两型静态不可分辨 ⇒ 不记绿也不判红,逐条报名:${C.reset}`,
  )
  for (const c of assumptionUndetermined.slice(0, 20)) {
    console.log(`${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}${C.reset}`)
  }
  if (assumptionUndetermined.length > 20) {
    console.log(
      `${C.dim}    ... 其余 ${assumptionUndetermined.length - 20} 条见 --dump-undetermined${C.reset}`,
    )
  }
}
if (GRAPH_AVAILABLE && assumptionAdjLedger.degraded) {
  console.log(`${C.yellow}[API 路由比对] ⚠️ ${assumptionAdjLedger.degraded}${C.reset}`)
}
if (GRAPH_AVAILABLE && assumptionAdjLedger.unjudgedAj3 > 0) {
  console.log(
    `${C.dim}[API 路由比对] ℹ️ 台账 AJ3(清单腐烂对账)本轮未判定 ${assumptionAdjLedger.unjudgedAj3} 条 —— ${FACE} 面桶是子集/夹具档,不冒红也不记绿;head 整仓面会逐条对账${C.reset}`,
  )
}
if (GRAPH_AVAILABLE && assumptionAdjLedger.adjudicatedMain.length > 0) {
  console.log(
    `${C.dim}[API 路由比对] ℹ️ 已裁决(前缀假设台账,主腿)${assumptionAdjLedger.adjudicatedMain.length} 处 —— 已退出未判定桶,禁消音逐条点名(裁决与证据见 ${ASSUMPTION_ADJ_FILE_REL}):${C.reset}`,
  )
  for (const c of assumptionAdjLedger.adjudicatedMain) {
    console.log(
      `${C.dim}    [${c.verdict}] ${c.method} ${c.path} @ ${c.file}:${c.line} —— 复裁:${c.owner} / ${c.reviewBy}${C.reset}`,
    )
  }
}
if (undeterminedDumpPath) {
  // 参数段覆盖桶与挂载图无关(兜底档同样要能落盘):两档都写,只把图相关字段按档给 null。
  writeFileSync(
    undeterminedDumpPath,
    JSON.stringify(
      GRAPH_AVAILABLE
        ? {
            undetermined: regGraph.undetermined,
            unreached: regGraph.unreached,
            opaque: regGraph.opaque,
            assumptionUndetermined,
            bareAssumptionUndetermined: bareAssumption,
            assumptionAdjudicated: assumptionAdjLedger.adjudicatedMain,
            bareAssumptionAdjudicated: assumptionAdjLedger.adjudicatedBare,
            assumptionAdjudicationProblems: assumptionAdjLedger.problems,
            paramSegmentCovered: paramCovered,
            bareParamSegmentCovered: bareParam,
            stats: regGraph.stats,
          }
        : {
            paramSegmentCovered: paramCovered,
            bareParamSegmentCovered: bareParam,
            note: '兜底档(挂载图无起点):本文件只含主腿未判定桶,其余字段不适用',
          },
      null,
      2,
    ),
    'utf8',
  )
}

/**
 * next rewrites 转发面这一格的判据来源(2026-10-04)。
 *
 * ## 口径:降级 / 有失效前缀 / 有认不出的形态 ⇒ 无条件报;**读到了且一切如常 ⇒ 一声不吭**
 * 这一格与本脚本里其他"未判定"桶同口径(守门 127 / 本脚本 OPAQUE_MOUNT_PREFIXES):
 * **判不出就点名,不判死也不静默**。特别地,读不到时**既不当成"没有转发面"(会让全部路径
 * 突然进对账、存量恒红,§12e)也不当成"全部已验"(那是本票要拔掉的病根)**,
 * 而是退回改前的字面前缀集并把降级本身打在脸上。
 *
 * ### 为什么"读到了且一切如常"时不打印(这是逐字节不变的必要条件)
 * 默认档下一旦多印一行,`--warn-only` / `--dump-missing` 的输出就与改前不再逐字相同 ——
 * 而本票明确要求默认档逐字节不变。**报数不改变任何判定**,所以把"如常"这一档留白是
 * 零信息损失;真有东西要说(降级 / 策略前缀失效 / 形态认不出)时才是非打印不可,那一档
 * 恰恰是本票的收益所在(规则被删 ⇒ 立刻响)。
 *
 * ## 为什么 8802 面要在"有东西要说"的那一档里带上条数
 * 那一面含 `source: '/api/:path*'` 兜底(现读 apps/web/next.config.ts:712),覆盖全仓每一个
 * `/api/*`。它**永不参与豁免**(取值处已按目标常量分面挡掉),但把它报出来是刻意的:
 * 下一个人若想把"凡是 rewrite 里有的前缀"当豁免面,这一行就是那个决定的即时反证。
 */
{
  const ex = rewriteExemption
  if (ex.degraded) {
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 未判定(next rewrites 转发面):${ex.reason} ⇒ 本轮退回改前的字面前缀集 ${ex.corroborated.length} 条(${ex.corroborated.join('、')});这一格是**兜底**,不是"已读出转发面"${C.reset}`,
    )
  } else if (ex.dropped.length > 0 || ex.unknownSource > 0 || ex.selfFace.length === 0) {
    // 三个触发条件都是"判据现状与人的默认假设不一致",必须让人看见:
    //  ① dropped   —— 有策略前缀在 next.config 的 ai 面里已无覆盖(规则被删/改窄)
    //  ② unknownSource —— 有 source 形态判据认不出,那几条不豁免(可能误报)
    //  ③ selfFace 为空 —— 那 4 条 apps/api 兜底规则不在了,读数的人会误以为"没有 /api/:path* 兜底"
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ next rewrites 转发面(读自 ${NEXT_CONFIG_REL})有需要裁决的一格:ai-service(非 apps/api)面 ${ex.forwarded.length} 条,本门策略面 ${REWRITE_EXEMPTION_CLAIMS.length} 条经覆盖裁定后剩 ${ex.corroborated.length} 条;apps/api 自己那面 ${ex.selfFace.length} 条**永不豁免**${ex.selfFace.length === 0 ? '(⚠️ 连 /api/:path* 兜底都不在了,若本仓仍有依赖该兜底的路径,它们已全部直接进对账)' : '(含 /api/:path* 兜底,拿它当已验面会让全仓 /api/* 免死调用)'}${ex.dropped.length > 0 ? `;**已失效的策略前缀 ${ex.dropped.length} 条:${ex.dropped.map((d) => `${d.claim}(${d.reason})`).join('、')} ⇒ 其下路径已重新进对账**` : ''}${ex.otherRules.length > 0 ? `;destination 非两个目标常量的规则 ${ex.otherRules.length} 条不豁免` : ''}${ex.unknownSource > 0 ? `;source 形态认不出的 ${ex.unknownSource} 条不豁免` : ''}${C.reset}`,
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

/* ===== BP 腿读数(每轮必打;三态不并桶;存量登记在结论之前)===== */
console.log(
  `${C.cyan}[API 路由比对] 裸路径传输口腿(BP):扫 ${bareScannedFiles} 个受管前端文件,候选 ${bareCandidatesTotal} 条 —— 归一事实源(读自 ${FACE} 面 ${CLIENT_TRANSPORT_FILE}::normalizeUrl)${urlAliasRules.parsed ? (urlAliasRules.barePrefix ? `裸路径补前缀档 = \`${urlAliasRules.barePrefix}\`` : `未读到裸路径补前缀档(裸路径一条不判)`) : `读不出(${urlAliasRules.reason})`}${C.reset}`,
)
for (const r of bareEndRows) {
  const buckets = [...r.byBucket.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}×${v}`)
    .join(' / ')
  console.log(
    `${C.dim}  · BP/${r.end}:文件 ${r.files} / 候选 ${r.candidates} / 可判 ${r.adjudicated}${buckets ? ` | 桶 ${buckets}` : ''}${C.reset}`,
  )
}
/**
 * 三态里最响的那一档:`blind` / `inconsistent` / `unadjudged` 说的都是"这一格本轮没有判据",
 * 按 §0.3 显式未判定(不记绿),并点名是哪一型。
 * 退出码分两档,与判定面绑定(不放宽判据,只把**测试通道**隔出去):
 *  - `inconsistent`(桶加总对不上)⇒ **任何面都 exit 2**:这是腿自己的算术坏了;
 *  - 其余两档 ⇒ 在 `head`/`staged` 这两个真判定面 exit 2;`--worktree` 是夹具/人工档,
 *    小树里"没有裸路径"或"没放 transport"都是常态,据此 exit 2 会把夹具读成事故
 *    (实测:装第一版时 5 条既有自测用例被这一档改写成 exit 2)。那一档照样**大声打印**,
 *    只是不把测试通道的读数冒充成对整个仓的裁决。
 */
if (bareLegVerdict.state !== 'ok') {
  console.log(
    `${C.red}[API 路由比对] ⚠️ 未判定(BP 腿取材判序=${bareLegVerdict.state}):${bareLegVerdict.detail} ⇒ 这一格本轮没有判据,不得读成"裸路径已对账"(判据失效的表现永远是安静)${C.reset}`,
  )
  if (bareLegVerdict.state === 'inconsistent' || FACE !== 'worktree') process.exit(2)
}
console.log(
  `${C.dim}  · BP 桶明细:可判 ${bareCensus.get('api') || 0} / 已在册 ${bareRegistered.length} / 死调用 ${bareMissing.length}(无锚点 ${bareNoAnchor.reduce((a, s) => a + s.count, 0)} + 存量 ${bareStock.reduce((a, s) => a + s.count, 0)} + 新增 ${bareNew.reduce((a, s) => a + (s.count - s.allowed), 0)}) / 已豁免 ${bareIgnored.length} / 不透明挂载 ${bareOpaque.length} / 前缀假设未判定 ${bareAssumption.length} / 参数段覆盖未判定 ${bareParam.length}${C.reset}`,
)
console.log(
  `${C.dim}  · BP 不判的桶(逐桶报名,不静默丢):已是 /api/(主腿射程)${bareCensus.get('alreadyApi') || 0} / 透传档原样返回 ${bareCensus.get('passthrough') || 0} / 改写档那一族(判权在 CE 与③')${bareCensus.get('aliasRewriteFamily') || 0} / \`:param\` 假影 ${bareCensus.get('interpPhantom') || 0} / 字面量读不出 ${bareCensus.get('literalUnparsed') || 0} / 字面量未闭合 ${bareCensus.get('literalUnclosed') || 0} / 转发面豁免 ${bareCensus.get('rewriteForwarded') || 0} / 事实源读不出 ${bareCensus.get('factSourceUnread') || 0} / 归一未读到 ${bareCensus.get('barePrefixUnread') || 0} / 两口径不同形 ${bareCensus.get('normalizationMismatch') || 0}${C.reset}`,
)
if (bareNoAnchor.length > 0) {
  console.log(
    `${C.yellow}  (未判定)BP 腿裸路径死调用 ${bareNoAnchor.reduce((a, s) => a + s.count, 0)} 处逐条列出 —— 无锚点可比,本轮不计红也不计绿:${C.reset}`,
  )
  for (const s of bareNoAnchor.slice(0, 40)) {
    for (const c of s.calls) {
      console.log(
        `${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}(字面量原文 ${c.raw})${C.reset}`,
      )
    }
  }
  if (bareNoAnchor.length > 40)
    console.log(`${C.dim}    ... 还有 ${bareNoAnchor.length - 40} 个文件(逐条见 --dump-missing)${C.reset}`)
}
if (bareStock.length > 0) {
  console.log(
    `${C.yellow}  (登记)BP 腿棘轮内存量裸路径死调用 ${bareStock.reduce((a, s) => a + s.count, 0)} 处 / ${bareStock.length} 个文件,本轮不判红;清理后跑 --update-bare-baseline 下调额度${C.reset}`,
  )
  for (const s of bareStock.slice(0, 20)) {
    console.log(`${C.dim}    ${s.file}:存量 ${s.count} 处(基线允许 ${s.allowed})${C.reset}`)
  }
}
if (bareStaleLedger.length > 0) {
  console.log(
    `${C.yellow}  (登记)BP 基线里有 ${bareStaleLedger.length} 个文件已不再命中(清单该收紧了):${C.reset} ${bareStaleLedger.slice(0, 5).join(', ')}`,
  )
}
if (bareParam.length > 0) {
  console.log(
    `${C.yellow}  (未判定)BP 腿 ${bareParam.length} 处裸路径只在同段数上被后端 \`:param\` 路由接住,不判红也不计通过(逐条报名;不记在册):${C.reset}`,
  )
  for (const c of bareParam.slice(0, 20)) {
    console.log(
      `${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}(字面量原文 ${c.raw})${C.reset}`,
    )
  }
  if (bareParam.length > 20) {
    console.log(
      `${C.dim}    ... 其余 ${bareParam.length - 20} 条见 --dump-undetermined 的 bareParamSegmentCovered`,
    )
  }
}
if (bareOpaque.length > 0) {
  console.log(
    `${C.yellow}  (未判定)BP 腿 ${bareOpaque.length} 处落在不透明挂载前缀下,不判红也不计通过:${C.reset}`,
  )
  for (const c of bareOpaque.slice(0, 10)) {
    console.log(
      `${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line} —— 依据:${c.evidence}${C.reset}`,
    )
  }
}
if (GRAPH_AVAILABLE && bareAssumption.length > 0) {
  console.log(
    `${C.yellow}  (未判定)BP 腿 ${bareAssumption.length} 处只命中「前缀假设」面(图走不到,笛卡尔拼得出),不判红也不计通过:${C.reset}`,
  )
  for (const c of bareAssumption.slice(0, 10)) {
    console.log(`${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}${C.reset}`)
  }
  if (bareAssumption.length > 10) {
    console.log(
      `${C.dim}    ... 其余 ${bareAssumption.length - 10} 处见 --dump-undetermined${C.reset}`,
    )
  }
}
if (GRAPH_AVAILABLE && assumptionAdjLedger.adjudicatedBare.length > 0) {
  console.log(
    `${C.dim}  已裁决(前缀假设台账,BP 腿)${assumptionAdjLedger.adjudicatedBare.length} 处 —— 已退出未判定桶,禁消音逐条点名:${C.reset}`,
  )
  for (const c of assumptionAdjLedger.adjudicatedBare) {
    console.log(
      `${C.dim}    [${c.verdict}] ${c.method} ${c.path} @ ${c.file}:${c.line} —— 复裁:${c.owner} / ${c.reviewBy}${C.reset}`,
    )
  }
}
if (bareIgnored.length > 0) {
  console.log(
    `${C.yellow}  (登记)BP 腿 ${bareIgnored.length} 处被 ${IGNORE_FILE_REL} 豁免(与主腿共用同一份豁免表)${C.reset}`,
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
  // BP 腿(裸路径)逐条:只进这份 stdout 清单,不进 `--dump-missing <file>` 落盘数组
  // (那个 JSON 的形状是既有调用者的契约,只装主腿死调用 —— 改动前它就长这样)。
  for (const s of [...bareStock, ...bareNew, ...bareNoAnchor])
    for (const c of s.calls || [])
      dump.push(
        `${c.method} ${c.path} @ ${c.file}:${c.line} [BP 裸路径腿${s.allowed !== undefined ? ` 字面量 ${c.raw} / 存量-允许 ${s.count}/${s.allowed}` : ` 字面量 ${c.raw} / 无锚点`}]`,
      )
  // 盲区逐条也走这一份清单(上面 per-end 打印只给前 SHAPE_SITE_PRINT_PER_END 个文件)。
  // 落盘的 JSON(`--dump-missing <file>`)仍是纯死调用数组 —— 那是既有调用者的契约,不加字段。
  for (const s of shapeUnknownSites) {
    if (s.sites.length === 0) {
      dump.push(`${s.file} [未判定形态:${s.end}] 传输口跨行,无单行站点`)
      continue
    }
    for (const site of s.sites)
      dump.push(`${s.file}:${site.line} [未判定形态:${s.end}] ${site.text} —— ${site.note}`)
  }
  console.log(`[API 路由比对] --dump-missing 逐条死调用/盲区站点(${dump.length} 处):`)
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
   *
   * 2026-10-04:措辞按现状重写。原先写"这些调用点一条都不进调用集,既不判死也不落任何既有
   * 未判定桶,但这一格没有判据" —— 后半句**已失效**:本票给每一处加了 `kind`/`adjudicable`
   * (见 classifyAliasLiteralSite),这一格现在**逐条有判据**,且可判的那几处把"归一后路径
   * 在册与否"一并算出来报名。仍不判红(§12e:存量当场 blocking = 恒红门)。
   * 取材扩展已实测否证(误报率 100%,见该函数注释),所以"一条都不进调用集"这句**仍然成立**。
   */
  if (v.aliasLiteralBlind.length > 0) {
    const adjudicable = v.aliasLiteralBlind.filter((b) => b.adjudicable)
    const blind = v.aliasLiteralBlind.length - adjudicable.length
    const unregistered = adjudicable.filter((b) => b.registered === false)
    console.log(
      `${C.yellow}[API 路由比对] ⚠️ 未判定(改写前缀字面量,静态对账整条看不见)${v.aliasLiteralBlind.length} 处 —— ` +
        `pathRe 只认引号紧邻 \`/api/\` 的字面量,这些站点**一条都不进调用集**(取材扩展已实测否证:` +
        `把它们抽进来死调用 0→4,而那 4 条**全是误报**,误报率 100%,故不扩面)。` +
        `本轮不判红(存量当场判红就是恒红门,§12e)。**这一格现已逐条有判据**:` +
        `可判 ${adjudicable.length} 处 / 不可判 ${blind} 处(前缀常量声明与 WS 片段表项 —— ` +
        `改写对它们不成立,归一后的路径谁都没发过);可判的 ${adjudicable.length} 处里` +
        `后端在册 ${adjudicable.length - unregistered.length} 处 / 不在册 ${unregistered.length} 处:${C.reset}`,
    )
    for (const b of v.aliasLiteralBlind.slice(0, 25)) {
      // 逐条把"哪一型 + 能不能判 + 判的依据"摊开 —— 不许只给路径不给归属
      const kindLabel =
        b.kind === 'prefixConstant'
          ? '前缀常量声明·非调用点'
          : b.kind === 'pathFragment'
            ? '路径片段/表项·改写不成立'
            : '真调用点·可判'
      const verdict = b.adjudicable
        ? b.registered
          ? '后端在册'
          : '后端**不在册**'
        : '不可判'
      console.log(
        `${C.dim}    ${b.file}:${b.line} ${b.raw} →归一后 ${b.rewritten} 〔${kindLabel} · ${verdict}〕${C.reset}`,
      )
    }
    if (v.aliasLiteralBlind.length > 25)
      console.log(`${C.dim}    ... 还有 ${v.aliasLiteralBlind.length - 25} 处${C.reset}`)
    if (unregistered.length > 0) {
      console.log(
        `${C.dim}    上面标「后端**不在册**」的 ${unregistered.length} 处是真调用点且归一后路径确实没有后端路由` +
          `(404 风险)—— 本轮按 §12e 不判红,登记在此等人裁决,不得读成"已对账":${C.reset}`,
      )
    }
  } else {
    console.log(
      v.alias.parsed && v.alias.rules.length > 0
        ? `${C.dim}[API 路由比对] 未判定(改写前缀字面量,静态对账整条看不见)0 处 —— 面上没有以现读改写档前缀开头的字面量(这一族的射程是空的,不是"已对账干净")${C.reset}`
        : `${C.dim}[API 路由比对] 未判定(改写前缀字面量,静态对账整条看不见)未判定 —— 改写档本身读不出或 0 条,前缀集合无从推导(空清单与判不出不得混计)${C.reset}`,
    )
  }
}

if (
  webViolations.length === 0 &&
  ratchetNew.length === 0 &&
  bareNew.length === 0 &&
  assumptionAdjLedger.problems.length === 0 &&
  channelVerdict.sites.length === 0
) {
  console.log(
    `${C.green}[API 路由比对] ✅ 通过(新增 0 处死调用;三端存量 ${ratchetStock.reduce((a, s) => a + s.count, 0)} 处按棘轮只报数;BP 腿裸路径存量 ${bareStock.reduce((a, s) => a + s.count, 0)} 处同样只报数;参数段覆盖 ${paramCovered.length}+${bareParam.length} 处未判定、不记在册(主腿+BP 腿))${C.reset}`,
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

if (bareNew.length > 0) {
  console.log(
    `${C.red}[API 路由比对] ❌ BP 腿(裸路径传输口调用)**新增**死调用 ${bareNew.reduce((a, s) => a + (s.count - s.allowed), 0)} 处,涉及 ${bareNew.length} 个文件:${C.reset}`,
  )
  for (const v of bareNew) {
    console.log(
      `${C.red}  ${v.file}:本次 ${v.count} 处 / BP 基线允许 ${v.allowed} 处 ⇒ 新增 ${v.count - v.allowed} 处${C.reset}`,
    )
    for (const c of v.calls.slice(0, 10)) {
      console.log(
        `${C.dim}    ${c.method} ${c.path} @ ${c.file}:${c.line}(字面量原文 ${c.raw} →归一 ${c.path})${C.reset}`,
      )
    }
  }
}

if (assumptionAdjLedger.problems.length > 0) {
  console.log(
    `${C.red}[API 路由比对] ❌ 前缀假设裁决台账(${ASSUMPTION_ADJ_FILE_REL})有 ${assumptionAdjLedger.problems.length} 处问题(AJ1 形状不全 / AJ2 到期未复裁 / AJ3 清单腐烂):${C.reset}`,
  )
  for (const p of assumptionAdjLedger.problems.slice(0, 50)) {
    console.log(`${C.red}  ${p}${C.reset}`)
  }
  if (assumptionAdjLedger.problems.length > 50) {
    console.log(
      `${C.dim}  ... 其余 ${assumptionAdjLedger.problems.length - 50} 条见 --dump-undetermined 的 assumptionAdjudicationProblems${C.reset}`,
    )
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
console.log(`  6. 标了「BP 腿(裸路径传输口调用)」的行:前端写的是 \`fetchApi('/x')\` 这类裸路径,`)
console.log(`     运行期由 normalizeUrl 补成 /api/x —— 改法同样是"补后端 or 删调用",`)
console.log(`     **禁止**用 --update-bare-baseline 把新增写进 BP 基线消红(它只用于清理后下调存量)`)
process.exit(WARN_ONLY ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
