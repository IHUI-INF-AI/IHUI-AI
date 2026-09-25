// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-miniapp-tokens.mjs — 从 packages/design-tokens/src/styles/tokens.css 自动同步 token 到 miniapp-taro。
 *
 * 2026-09-25 收口:本文件导出 `MINIAPP_SKIP_PREFIXES` + `isManagedForMiniapp` ——
 * **「该写什么」与「该判什么」是同一个谓词**,守门 `scripts/check-miniapp-tokens-sync.mjs` 直接 import 它,
 * 不得再抄第二份筛选逻辑(形状与 `scripts/sync-rn-global-css.mjs` 的 RN_SKIP_PREFIXES / isManagedForRn 一致)。
 * 判据此前只遍历副本已有键 ⇒ 源头多出的整批档它看不见;补上「判缺档」后又把**本生成器按政策刻意不搬**的
 * 非色档与渐变档算成债务(实测 255 红点里 88 条属此类)。两边共用一份表,才不会一边判红、一边说不是我写的。
 *
 * 同日从 `apps/miniapp-taro/scripts/sync-design-tokens.mjs` **搬到这里**(不是复制,旧路径已删)。
 * 理由只有一个,而且是被架构门逼出来的:门 36 与本文件必须共用一份取源实现,而**取源实现住在
 * `scripts/lib/design-token-blocks.mjs`(repo-tooling 层)**。守门 103 的 D1/D2/D3 三条判据同时拦死了
 * 另外两种摆位 —— 端内脚本按相对路径向上摸工具层(product 40 → tooling 90 是反向依赖,且 tooling
 * 声明 `exported:false`),把实现下沉进 contract 包则让根工具层按路径穿透包实现细节(D3),而工具层
 * **按包名解析不到 workspace 链接**:实测给根 package.json 加 `@ihui/design-tokens` 后 pnpm 写出的
 * 根链接 target 是 `..\..\IHUI-AI\packages\design-tokens`(断在 `D:/IHUI-AI/IHUI-AI`),
 * 门 78 当场判「悬空 1」blocking ⇒ 这条路由其在 Windows 上不可用(已实测并回退)。
 * 摆在工具层这一侧,四个端的同名机制(RN global.css / rn-tokens / extension 注入层 / ALPHA_USAGE)
 * 就全部住在一处,互相 import 不跨模块 ⇒ **零穿透、零豁免、零新依赖**。
 * 端内的 `pnpm --filter @ihui/miniapp-taro sync-tokens` 仍在(package.json 只改了指向),
 * 提交链 `TOKEN_SYNC_TARGETS` 那一行的 cmd 因此不必动。
 *
 * ⚠️ 文件名改了,**生成物里的横幅字符串与 `[sync-design-tokens]` 日志前缀刻意没改**:
 * 那三处横幅(`app.css` 的两行注释 + `style.ts` 的 AUTO-GENERATED 行)已经写进已入库的受管文件,
 * 改模板 = 下一次 `--check` 判它漂移并重写这几行,为一处注释去动跨端受管文件不值得;
 * 日志前缀同理(只影响人眼,不影响任何判据 —— 全仓无按 `[sync-design-tokens]` 匹配的断言,已 grep)。
 * 要收这笔账,应当与"下一次真的要重写 app.css 受管块"同笔入账,而不是单独发一枚只改注释的提交。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectVars, maskComments } from './lib/design-token-blocks.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..')
const ROOT = resolve(REPO_ROOT, 'apps/miniapp-taro')

export const TOKENS_SOURCE_REL = 'packages/design-tokens/src/styles/tokens.css'
export const BASE_CSS_REL = 'packages/design-tokens/src/styles/base.css'
export const APP_CSS_REL = 'apps/miniapp-taro/src/app.css'
export const STYLE_TS_REL = 'apps/miniapp-taro/src/constants/style.ts'
const TOKENS_SOURCE = resolve(REPO_ROOT, TOKENS_SOURCE_REL)
// 落点一律由上面的 REL 常量派生 —— 再写一遍字面量就是第二份真相(守门 36 与本文件共用同一组 REL)
const BASE_CSS_SOURCE = resolve(REPO_ROOT, BASE_CSS_REL)
const APP_CSS_TARGET = resolve(REPO_ROOT, APP_CSS_REL)
const STYLE_TS_TARGET = resolve(REPO_ROOT, STYLE_TS_REL)
// COLORS 字段 → tokens.css 变量名映射表
// style.ts 的 COLORS 常量从 tokens.css 自动生成,消除手动复制漂移
const COLORS_MAPPING = {
  primary: '--color-primary',
  primaryForeground: '--color-primary-foreground',
  secondary: '--color-secondary',
  secondaryForeground: '--color-secondary-foreground',
  accent: '--color-accent',
  accentForeground: '--color-accent-foreground',
  success: '--color-success',
  successForeground: '--color-success-foreground',
  warning: '--color-warning',
  warningForeground: '--color-warning-foreground',
  // 2026-09-06:danger 从 destructive 改指新语义 token --color-danger(收敛小程序端红色家族)
  danger: '--color-danger',
  dangerForeground: '--color-danger-foreground',
  info: '--color-info',
  infoForeground: '--color-info-foreground',
  textPrimary: '--color-foreground',
  textSecondary: '--color-muted-foreground',
  textTertiary: '--color-muted-foreground',
  bgPrimary: '--color-background',
  bgSecondary: '--color-card',
  bgTertiary: '--color-muted',
  border: '--color-border',
  divider: '--color-border',
}

const args = process.argv.slice(2)
// §22d:本模块同时是 CLI 与被 import 的判据库(守门 36 import 谓词)。
// 顶层一切"读 argv 就办事"的分支都必须先确认是自己被直接执行 ——
// 否则 `node scripts/check-miniapp-tokens-sync.mjs --help` 会先打印本脚本的帮助并 exit 0。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const isCheck = isDirectRun && args.includes('--check')
const isSelfTest = isDirectRun && args.includes('--self-test')
const isHelp = isDirectRun && args.includes('--help')

if (isHelp) {
  console.info(`sync-miniapp-tokens.mjs — 同步 design-tokens 到 miniapp-taro app.css + style.ts

用法(路径按仓库根;端内 pnpm 入口同名,只是指向本文件):
  node scripts/sync-miniapp-tokens.mjs              原位写回 app.css + style.ts
  node scripts/sync-miniapp-tokens.mjs --check       仅校验,不写回
  node scripts/sync-miniapp-tokens.mjs --self-test   判据自检(全用内存夹具,不碰真仓文件)
  node scripts/sync-miniapp-tokens.mjs --help        帮助
  pnpm --filter @ihui/miniapp-taro sync-tokens       同上写回(提交链走这条)

源: ${TOKENS_SOURCE.replace(ROOT, '.')}
目标:
  - ${APP_CSS_TARGET.replace(ROOT, '.')}
  - ${STYLE_TS_TARGET.replace(ROOT, '.')}
`)
  process.exit(0)
}
/**
 * 「该写什么」的唯一一张表 —— 生成器不搬的 tokens.css 档位前缀。
 *
 * 2026-09-25 立:守门 `scripts/check-miniapp-tokens-sync.mjs` **import 本表与下面的谓词**来判缺档,
 * 不再自己写第二份筛选逻辑。原因有两条,都是本仓反复记过的:
 * 1. 判据与生成器不同形 ⇒ 门把「生成器按政策刻意不搬」的档算成本仓债务(实测一次收紧报 255 红点,
 *    其中 88 条属此类:非色档 + 多行渐变档)。
 * 2. 两处各写一遍取值/筛选逻辑,其中一遍必然腐烂。
 *
 * 表里两类条目各有独立理由,**不得**为了让门变绿而往里加档(那是放宽判据):
 * - **web 端独有**:小程序没有对应界面 —— `--color-sidebar`(侧边栏 6 档)、`--color-shell-panel`(IDE 面板)。
 *   实测 `grep -r "color-sidebar\|color-shell-panel" apps/miniapp-taro/src` = 0 命中 ⇒ 端内零用量。
 * - **跨行声明**:`--color-gradient-*`(6 档)。本生成器按**行**解析声明,多行 `linear-gradient(` 截断后
 *   会产出非法 CSS(见 `extractStandaloneRootBlock` 的 `!l.endsWith(';')` 护栏),所以按政策不搬。
 *   实测 `grep -r "color-gradient-" apps/miniapp-taro/src` = 0 命中 ⇒ 端内零用量,不搬不影响渲染。
 *   ⚠️ 新增**跨行** `--color-*` 档必须同笔进本表并写明理由,否则守门 36 判缺档而生成器写不出来 = 恒红。
 * - **非色档**:小程序用 Tailwind v3,不认 v4 的 `@theme` 字体/动画/断点/层级语法糖,
 *   且这些档在 app.css 里另有落点(圆角档位由守门 77 单独对账)。它们不参与 `isManagedForMiniapp`
 *   (谓词只认 `--color-` 族),但仍由本表决定生成器**不写**,所以留在表里 —— 一张表管两件事,
 *   而不是两张表。
 */
export const MINIAPP_SKIP_PREFIXES = [
  '--font-',
  '--animate-',
  '--breakpoint-',
  '--text-vcenter-offset',
  '--color-sidebar',
  '--color-shell-panel',
  '--color-gradient-',
  '--z-',
  '--global-box-shadow',
  '--shadow-premium',
]

/** 本表是否覆盖该档(生成器不写它 ⇒ 守门也不得判它缺)。 */
export function isSkippedForMiniapp(name) {
  return MINIAPP_SKIP_PREFIXES.some((p) => name.startsWith(p))
}

/**
 * 守门 36 与生成本文件的 :root/.dark 块**共用**的受管谓词:
 * 只有 `--color-*` 族、且不在跳过表里,才既「该写」又「该判」。
 * 形状与 RN 侧 `isManagedForRn` 一致(`--color-` 前缀 ∧ 非跳过表),不另发明第二套概念。
 */
export function isManagedForMiniapp(name) {
  return name.startsWith('--color-') && !isSkippedForMiniapp(name)
}

/**
 * 「源头该有哪些受管档」的派生出口 —— 守门 36 走这一条,不得自己抄选择器或谓词。
 * 形状与 RN 侧 `deriveRnDecls` 一致:选择器面 + 谓词都在生成器这一侧。
 *
 * ⚠️ 写回面与判定面的分工(如实登记,别让下一个人重新猜):
 * 本出口只回答「源头有哪些档归本端管」。真正**写** app.css 的那条路是「6 处受管块逐块原位写回」
 * (`mergeAppCss` / `mergeDeclsInPlace`:同名行就地换值、缺档补到本区块尾、端内自有档与解释性注释
 * 留在原位),但它**取源**仍是按行解析(`extractThemeBlock` 只取首个 @theme 块、`extractDarkBlock`
 * 只取首个 `.dark` 块、逐行 `!l.endsWith(';')` 剔除跨行声明)。
 * 两侧之差由 `scripts/tests/check-miniapp-tokens-sync.test.mjs` 的「真仓受管集一致」断言守住:
 * 源头若新增了写回面拿不到的档(例:只在第二个 `.dark` 块里出现的 `--color-*`),那条测试会红,
 * 而守门 36 也会红 —— 那时必须扩写回面的取源,不得往跳过表里塞条目来消红。
 */
export function deriveMiniappManaged(tokensCss, kind) {
  const selectors = kind === 'dark' ? ['.dark'] : ['@theme', ':root']
  return [...collectVars(tokensCss, selectors).values()].filter((d) => isManagedForMiniapp(d.name))
}

/**
 * v4 色档注册区(`@theme { … }`)的标记注释前缀 —— app.css 的**第 6 处** token 受管区。
 * 定位机制与现有 5 区**完全同一套路**:按标记注释定位,不靠「第几个块数」;
 * 已在位走 `mergeDeclsInPlace` 原位写回,不在位才整块插入(AGENTS §4「原位写回,禁止整块替换」)。
 * 导出是给守门 36 与镜像测试共用的同一个标识 —— 三处各写一遍字面量就是第三份真相。
 */
export const THEME_REGION_MARK = '/* ===== v4 色档注册(自动同步自'

/**
 * `@theme` 区应有的档 = `deriveMiniappManaged(light)` **剔除 `-rgb` 三元组**。
 *
 * 两条都是实测逼出的,不是洁癖:
 * 1. 档位集合必须由 `deriveMiniappManaged` 那**同一个谓词**派生(见本文件头注第 1 条)——
 *    注册区若自己筛一遍,「该写的」与「该判的」就从不同形那一刻起分叉。
 * 2. `--color-*-rgb` **绝对不能进 `@theme`**:v4 把任何 `--color-*` 都当成一个颜色档,
 *    进了就长出 `.bg-muted-rgb{background-color:var(--color-muted-rgb)}` 这种脏档。
 *    那批三元组归下面 `:root` 的 alpha 区管(守门 93 R6 要求每档必备),不参与注册。
 *
 * 为什么这一档非要有:v4 只认 `@theme` 里的 `--color-*`,而副本历史上把色值全写在普通
 * `:root/.dark` 上 ⇒ 项目色档(`bg-*`/`text-*`/`border-*` 整族)在真构建产物里 0 条规则,
 * 而命名布局档(`.flex`/`.p-3`)有 —— 症状精确到"只有色档没落地"(见 PROJECT_PLAN O62附⑧补)。
 */
export function deriveThemeRegistryDecls(tokensCss) {
  return deriveMiniappManaged(tokensCss, 'light').filter((d) => !isAlphaRgbTriple(d.name))
}

/**
 * 从 tokens.css 提取 @theme 块内的变量声明。
 * @theme 块格式:@theme { ... --color-xxx: hsl(...); ... }
 * 返回:["--color-xxx: hsl(...);", ...]
 */
function extractThemeBlock(content) {
  const themeMatch = content.match(/@theme\s*\{([\s\S]*?)\}/)
  if (!themeMatch) return []
  return themeMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('--') && l.includes(':'))
}

/**
 * 从 tokens.css 提取 .dark 块内的变量声明。
 * 返回:["--color-xxx: hsl(...);", ...]
 */
function extractDarkBlock(content) {
  const darkMatch = content.match(/\.dark\s*\{([\s\S]*?)\}/)
  if (!darkMatch) return []
  return darkMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('--') && l.includes(':'))
}

/**
 * 从 tokens.css 提取透明度色板(--color-black-* / --color-white-*)。
 * 这两组定义在 tokens.css 独立的非 @theme :root 块(非 .dark、非 @theme),extractThemeBlock
 * 不会提取到它们,导致 miniapp-taro 端 var(--color-black-*) / var(--color-white-*) 运行时未定义
 * → 遮罩/阴影透明。2026-09-06 立:改为显式收集,同步进 app.css。
 * 返回:["--color-white-2: rgba(...);", "--color-black-6: rgba(...);", ...](按出现顺序)
 */
function extractOpacityPalette(content) {
  const rootRe = /:root\s*\{([^{}]*)\}/g
  const lines = []
  let m
  while ((m = rootRe.exec(content)) !== null) {
    for (const raw of m[1].split('\n')) {
      const l = raw.trim()
      if ((l.startsWith('--color-white-') || l.startsWith('--color-black-')) && l.includes(':')) {
        lines.push(l)
      }
    }
  }
  return lines.filter((l, i) => lines.indexOf(l) === i)
}

/**
 * alpha 通道三元组的变量名与声明形态(--color-X-rgb: r, g, b;)。
 * 定义提前到 extractStandaloneRootBlock 之前是因为它在里面被用到,
 * 而 const 不提升会让「先声明后使用」的读者误判顺序。
 */
const ALPHA_RGB_NAME_RE = /^--color-[\w-]+-rgb$/
const ALPHA_RGB_DECL_RE = /^--color-[\w-]+-rgb:\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3};$/

/**
 * 「这一档是不是 alpha 三元组」的**唯一**实现(在受管族内等价于名字以 `-rgb` 结尾)。
 * 生成器剔它(`deriveThemeRegistryDecls`)与守门 36 判它(`rgbInTheme`)都走这一条 ——
 * 一条写在正则里、另一条写 `endsWith('-rgb')`,就是两份真相(§4「取源只能有一份实现」)。
 */
export function isAlphaRgbTriple(name) {
  return ALPHA_RGB_NAME_RE.test(name)
}

/**
 * 从 tokens.css 提取「独立 :root 块」中的业务品牌变量(--color-miniapp-green* 等。
 * 这些变量定义在非 @theme、非 .dark 的 :root 块,extractThemeBlock / extractDarkBlock
 * 不会提取到,导致小程序端 var(--color-miniapp-green) 运行时未定义 → 微信按钮底色丢失。
 * 过滤:剔除已在 @theme/.dark 中的变量与透明度色板(--color-white / --color-black 系列),
 * 并用 filterTokens 剔除 web 独有变量。返回:["--color-x: val;", ...](按出现顺序)。
 */
function extractStandaloneRootBlock(content, themeMap, darkMap) {
  const rootRe = /:root\s*\{([^{}]*)\}/g
  const lines = []
  let m
  while ((m = rootRe.exec(content)) !== null) {
    for (const raw of m[1].split('\n')) {
      const l = raw.trim()
      const name = l.split(':')[0].trim()
      // 仅收集「单行完整声明的受管业务品牌色」:
      //  - 谓词 = 守门 36 的同一个 isManagedForMiniapp(web 独有档 / 跨行渐变档在此一次性排除)
      //  - 行尾以 ; 结束(剔除以 linear-gradient( 开头的多行渐变,避免截断产生非法 CSS)
      //  - 跳过透明度色板与已存在于 @theme/.dark 语义色块的变量,避免重复
      if (!isManagedForMiniapp(name)) continue
      if (!l.endsWith(';')) continue
      if (name.startsWith('--color-white-') || name.startsWith('--color-black-')) continue
      // alpha 通道三元组由 extractAlphaChannelBlock 单独收(挂进语义 :root),此处跳过避免重复声明
      if (ALPHA_RGB_NAME_RE.test(name)) continue
      if (themeMap.has(name) || darkMap.has(name)) continue
      lines.push(l)
    }
  }
  return filterTokens(lines.filter((l, i) => lines.indexOf(l) === i))
}

/**
 * Tailwind v3 端的 alpha 通道三元组(--color-X-rgb,2026-09-25 立)。
 *
 * 它为什么必须单独收:这一组**亮值**定义在 tokens.css 的独立 :root 块、**暗值**定义在 .dark 块。
 * 而上面的 extractStandaloneRootBlock 有条去重规则「凡 .dark 里有同名就不从独立 :root 收」——
 * 这条规则对业务品牌色是对的(那些变量本来就不该出现两次),对本组是**致命的**:7 条亮值里
 * 有 6 条存在暗色覆盖,于是 app.css 只落了 1 条,小程序端 `rgba(var(--color-primary-rgb), .1)`
 * 在亮色主题下取到未定义变量 → 整条背景静默失效(实测,2026-09-25 首次同步即暴露)。
 * 所以本组绕开那条去重,单独收集并直接挂进语义 :root —— 保证「先亮后 .dark」的级联顺序。
 *
 * 命名规则与唯一生产方一致:packages/design-tokens/src/tailwind-alpha-plugin.js 的
 * ALPHA_CHANNEL_SUFFIX('-rgb')+ ALPHA_USAGE 登记表;值必须是三段 0-255 的十进制通道。
 */
function extractAlphaChannelBlock(content) {
  const rootRe = /:root\s*\{([^{}]*)\}/g
  const lines = []
  let m
  while ((m = rootRe.exec(content)) !== null) {
    for (const raw of m[1].split('\n')) {
      const l = raw.trim()
      if (ALPHA_RGB_DECL_RE.test(l)) lines.push(l)
    }
  }
  return lines.filter((l, i) => lines.indexOf(l) === i)
}

// 2026-09-25:此处原有的 buildBusinessBrandBlock / stripExistingBusinessBrandBlock /
// buildOpacityBlock / stripExistingOpacityBlock / formatBlock 五个函数已删除 —— 它们是
// 「把 :root/.dark 整块重铸、再靠 strip* 正则拆掉色板块重插」那条路的零件。写回改成
// `mergeAppCss` 的**按区原位写回**后,这条路整体不再走(留着的下一个危害就是有人在受管块里
// 加端内自有档,下一次同步静默删掉)。§3 做减法:死代码不留。

/**
 * 提取需要同步的语义色变量(只同步 miniapp-taro 需要的,过滤掉 web 独有的)。
 *
 * 2026-09-25:**本函数不再自带清单**,改读文件上方的 `MINIAPP_SKIP_PREFIXES`(与守门 36 共用的那一张)。
 * 此前它把九条前缀抄在函数体里,而守门那一侧另写一份判据 —— 两边从不同形的那一刻起,
 * 门报的"缺档"就有一部分是生成器按政策永远不写的东西(收紧后实测 255 红点里 88 条即此)。
 *
 * 历史保留的语义(2026-08-06 一次移除 --color-brand-/--color-vip-/--color-rank- 三个前缀):
 * tokens.css @theme 块已定义业务品牌色(--color-vip-gold-start/end、--color-rank-gold/silver/bronze、
 * --color-brand-accent、--color-brand-50..900、--color-brand),此前被跳过导致小程序端无法 var() 引用,
 * 只能硬编码 hex。现全部同步到 app.css,页面可引用 var(--color-rank-*) / var(--color-vip-*) / var(--color-brand*)。
 * --color-white-/--color-black- 同理不进表(它们由 extractOpacityPalette 单独收,见 app.css 的色板块)。
 */
function filterTokens(lines) {
  return lines.filter((l) => !isSkippedForMiniapp(l.split(':')[0].trim()))
}
/**
 * 把变量声明数组解析为 Map<varName, value>。
 * 例:["--color-primary: hsl(0 0% 0%);"] → Map { "--color-primary" => "hsl(0 0% 0%)" }
 */
function buildVarMap(lines) {
  const map = new Map()
  for (const line of lines) {
    const m = line.match(/^(--[\w-]+):\s*(.+?);?$/)
    if (m) {
      map.set(m[1], m[2].trim())
    }
  }
  return map
}

// ─────────────────────────────────────────────────────────────────────────
// 原位写回(2026-09-25,AGENTS §4「端内 CSS/色值副本一律是派生态」第①条)
//
// 旧写法每跑一次就把 `:root` / `.dark` **整块重铸**,再靠两个 `stripExisting*Block`
// 正则把色板块拆掉重插、靠 `/(\n+)(?=\.dark \{\n)/` 归一空行。那意味着:
//   - 谁在受管块里加一条端内自有档(RN 那 13 个 `--rn-*` 就是先例),下次同步静默删掉;
//   - 谁写的解释性注释,同步一次就没一段。
// 现改为**按区原位写回**:同名就地换值、值已等价连字节都不改(⇒ 幂等)、
// 非受管声明与注释**逐字留在原位**、源头有而本区缺才补到本区尾部。
// app.css 的 6 处 token 受管块(5 个变量区 + 1 个 `@theme` 注册区)各自独立处理,不合并成一块。
// ─────────────────────────────────────────────────────────────────────────

/** 取不到输入 / 结构判不出 ⇒ 抛它。调用方折成 exit 2「无法判定」,既不冒红也绝不记绿。 */
export class Undetermined extends Error {}

/**
 * 顶层块的花括号范围。先 `maskComments` 再配平 —— 注释里出现的 `{`/`}` 不得参与计数。
 * (app.css 的 `:root` / `.dark` 内不再嵌套规则块,故按配平走即可。)
 */
export function topLevelRanges(css, selector) {
  const masked = maskComments(css)
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|\\n)\\s*${esc}\\s*\\{`, 'g')
  const out = []
  let m
  while ((m = re.exec(masked)) !== null) {
    const open = masked.indexOf('{', m.index)
    let i = open + 1
    let depth = 1
    while (i < masked.length && depth > 0) {
      if (masked[i] === '{') depth++
      else if (masked[i] === '}') depth--
      i++
    }
    out.push({ open, bodyStart: open + 1, bodyEnd: i - 1, end: i })
    re.lastIndex = i
  }
  return out
}

/** 定位受管区的标记注释。缺失或重复一律「无法判定」—— 猜个位置去改写,比不写危险得多。 */
function markerRange(css, marker, label) {
  const start = css.indexOf(marker)
  if (start < 0) throw new Undetermined(`app.css 中找不到受管区标记「${label}」`)
  if (css.indexOf(marker, start + 1) >= 0) throw new Undetermined(`app.css 中受管区标记「${label}」重复`)
  const close = css.indexOf('*/', start)
  if (close < 0) throw new Undetermined(`受管区标记「${label}」的注释没有闭合`)
  return { start, end: close + 2 }
}

/**
 * 把受管声明写进一段 CSS 文本(该受管区的原文),返回改写后的同一段。
 *
 * 为什么用 maskComments + 按 `;` 边界扫,而不是逐行正则:
 *   - 逐行正则**看不见跨行声明**,于是每次同步都把已在的档判成「本区尚缺」再补一遍
 *     (RN 侧实测:6 个 `linear-gradient(` 档导致幂等破功、块越写越长);
 *   - 而注释里会出现 `--color-x: 说明文字` 这种散文行,不遮就会被当声明改写。
 *   遮罩与原文**等长**,所以命中下标可以直接切原文 —— 等价时原字节整体保留(含缩进与跨行排版)。
 */
export function mergeDeclsInPlace(text, decls, label = '') {
  const seen = new Set()
  const masked = maskComments(text)
  let out = ''
  let last = 0
  for (const m of masked.matchAll(/--[\w-]+\s*:\s*[^;]+;/g)) {
    const raw = text.slice(m.index, m.index + m[0].length)
    const parts = /^(--[\w-]+)\s*:\s*([\s\S]*);$/m.exec(raw)
    if (!parts) throw new Undetermined(`受管区「${label}」里有条声明解析不出来:${JSON.stringify(raw.slice(0, 60))}`)
    const name = parts[1]
    const value = parts[2].replace(/\s+/g, ' ').trim()
    out += text.slice(last, m.index)
    const expect = decls.get(name)
    if (expect === undefined) {
      // 不归本区管(端内自有档 / 别区的档):原字节留下,不删、不改、不判红
      out += raw
    } else {
      seen.add(name)
      out += value === expect ? raw : `${name}: ${expect};`
    }
    last = m.index + m[0].length
  }
  out += text.slice(last)

  const added = [...decls].filter(([name]) => !seen.has(name))
  if (added.length) {
    const body = out.replace(/\s+$/, '')
    out =
      `${body}\n\n` +
      `  /* 以下 ${added.length} 档为 tokens.css 中存在而本区尚缺,由 sync-design-tokens.mjs 自动补入(勿手改) */\n` +
      `${added.map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n`
  }
  return out
}

/**
 * 算出 app.css 的 5 个 token 受管区在文件里的字节区间(按 start 升序)。
 * 区间断点用**标记注释**定位,不靠「第几个 `:root` 块」这种位置计数 ——
 * 谁在 app.css 里再加一个 `:root` 块都不会把档写进错的区。
 */
export function planAppCssRegions(css, maps) {
  const roots = topLevelRanges(css, ':root')
  const darks = topLevelRanges(css, '.dark')
  const themes = topLevelRanges(css, '@theme')
  if (roots.length === 0) throw new Undetermined('app.css 中没有 :root 块')
  if (darks.length === 0) throw new Undetermined('app.css 中没有 .dark 块')
  const hostOf = (idx) => roots.find((b) => idx > b.open && idx < b.bodyEnd)
  const blockAfter = (idx) => roots.find((b) => b.open > idx)
  const plan = []
  const push = (label, start, end, map) => {
    if (map.size === 0) return // 源头这一组为空 ⇒ 本区无事可做(也不得去猜位置)
    if (!(end > start)) throw new Undetermined(`受管区「${label}」的区间是空的(start=${start} end=${end})`)
    plan.push({ label, start, end, map })
  }

  if (maps.semantic.size) {
    const sem = markerRange(css, '/* ===== 语义色(自动同步自', '语义色')
    const host = hostOf(sem.start)
    if (!host) throw new Undetermined('语义色受管区不在任何 :root 块内')
    // 同一个 :root 里还挂着 alpha 三元组区 —— 两区各管各的键名,按标记切界,互不改写
    const alphaAt = css.indexOf('/* ===== Tailwind v3 alpha', sem.end)
    const semEnd = alphaAt >= 0 && alphaAt < host.bodyEnd ? alphaAt : host.bodyEnd
    push('语义色', sem.end, semEnd, maps.semantic)
    if (maps.alpha.size) {
      if (alphaAt < 0 || alphaAt >= host.bodyEnd)
        throw new Undetermined('alpha 三元组区缺标记注释,但源头有该组的档')
      const a = markerRange(css, '/* ===== Tailwind v3 alpha', 'alpha 三元组')
      push('alpha 三元组', a.end, host.bodyEnd, maps.alpha)
    }
  }
  // 第 6 区:v4 色档注册块。块体由 topLevelRanges 定位(它先 maskComments 再配平,
  // 所以散文注释里出现的字符串 @theme 不会被当块 —— TH3 有专门一条自检钉这个)。
  if (maps.theme && maps.theme.size) {
    const t = markerRange(css, THEME_REGION_MARK, 'v4 色档注册')
    const block = themes.find((b) => b.open > t.end)
    if (!block)
      throw new Undetermined('受管区「v4 色档注册」的标记注释在位,但它后面没有 @theme 块(区被摘走了)')
    push('v4 色档注册', block.bodyStart, block.bodyEnd, maps.theme)
  }
  for (const [label, marker, key] of [
    ['透明度色板', '/* ===== 透明度色板(自动同步自', 'opacity'],
    ['业务品牌色', '/* ===== 业务品牌色(自动同步自', 'brand'],
  ]) {
    const map = maps[key]
    if (!map || map.size === 0) continue
    const m = markerRange(css, marker, label)
    const block = blockAfter(m.start)
    if (!block) throw new Undetermined(`受管区「${label}」后面找不到对应的 :root 块`)
    push(label, block.bodyStart, block.bodyEnd, map)
  }
  push('.dark', darks[0].bodyStart, darks[0].bodyEnd, maps.dark)
  return plan.sort((a, b) => a.start - b.start)
}

const BASE_OPEN = '/* ===== 共享基础样式(自动同步自'
const BASE_CLOSE = '/* ===== 共享基础样式结束'
const BASE_IMPORT_RE = /@import\s+['"][^'"]*packages\/design-tokens\/src\/styles\/base\.css['"];\s*/

/**
 * base.css 段原位写回:只换两段标记注释之间的内容,标记本身与块外一行不碰。
 * 这一段是**逐字拷贝**(base.css 自带 §5c 零宽横幅,原样搬,不剥不改)。
 * 首次迁移(app.css 里还是跨包 `@import`)时整块插入 —— 背景:微信 IDE 以 dist 为根
 * 解析不到 `../../../packages/...` → [WXSS 文件编译错误]。
 */
export function mergeAppCssBase(css, baseCss) {
  const body = `\n${baseCss.trim()}\n`
  const open = css.indexOf(BASE_OPEN)
  if (open >= 0) {
    if (css.indexOf(BASE_OPEN, open + 1) >= 0) throw new Undetermined('base.css 受管段起始标记重复')
    const contentStart = css.indexOf('*/', open) + 2
    const close = css.indexOf(BASE_CLOSE, contentStart)
    if (close < 0) throw new Undetermined('base.css 受管段缺少结束标记')
    if (css.indexOf(BASE_CLOSE, close + 1) >= 0) throw new Undetermined('base.css 受管段结束标记重复')
    return css.slice(contentStart, close) === body ? css : css.slice(0, contentStart) + body + css.slice(close)
  }
  if (BASE_IMPORT_RE.test(css)) {
    return css.replace(
      BASE_IMPORT_RE,
      '/* ===== 共享基础样式(自动同步自 packages/design-tokens/src/styles/base.css,勿手动编辑;' +
        `变更后运行 sync-design-tokens.mjs)===== */${body}/* ===== 共享基础样式结束(自动生成,勿手动编辑)===== */\n`
    )
  }
  throw new Undetermined('app.css 中既无 base.css 受管段、也无它的 @import —— 无法判定该往哪儿写')
}

/**
 * `@theme` 注册区的整块形态(首次落地用;已在位之后由 mergeDeclsInPlace 原位写回,不再走这里)。
 * 块内那条说明注释是**故意**留在体内的:它解释 `-rgb` 为什么不进来,而下一次运行按标记定位到
 * 同一个区、maskComments 认得它是注释 ⇒ 逐字留在原位(与端内自有档同一条待遇)。
 */
export function renderThemeRegion(decls) {
  const body = [...decls].map(([name, value]) => `  ${name}: ${value};`).join('\n')
  return [
    `${THEME_REGION_MARK} tokens.css,勿手动编辑;变更后运行 sync-design-tokens.mjs)===== */`,
    '@theme {',
    '  /* 只注册 v4 认得的**色档**:--color-*-rgb 那批三元组不得进来 —— v4 把任何 --color-*',
    '     都当成一个颜色档,进来就会长出 .bg-muted-rgb 这类脏档;它们由下面 :root 的 alpha 区管。 */',
    body,
    '}',
  ].join('\n')
}

/**
 * 首次落地的插入锚点(按优先级取第一条命中的)。依据,不得在别处再猜一遍:
 * `@theme` 是 **v4 引擎的输入指令**,与 `@source` / `@import 'tailwindcss/utilities.css'` /
 * `@tailwind base|components` 同属一簇 —— 所以它住在指令簇末尾、排在第一处消费
 * `var(--color-*)` 的规则之前,读代码时"引擎输入"与"端内副本"才分得开。
 * 排在 `:root` 副本之前**不会**让深色档失效:v4 把 `@theme` 的档写进 `@layer theme`,
 * 而本文件后面的 `:root` / `.dark` 是**未分层**声明,层外优先级高于层内 ⇒ 运行期取值仍以副本为准,
 * `@theme` 只负责"这一档存在、能长出 utility"。这也正是不能用 `@theme inline` 的原因
 * (inline 把亮档值直接烘进每条 utility,`.dark` 再也压不住 ⇒ 深色模式整族失效);
 * 也不用 `@theme reference`(它给每条规则加一份亮档 fallback,字节更贵)。只用普通 `@theme`。
 * 四条锚一条都不命中 ⇒ 抛「无法判定」:猜个位置去插,比不插危险得多(与 markerRange 同一条规矩)。
 */
const THEME_ANCHORS = [
  /^@source\s/m,
  /^@import\s*['"]tailwindcss\/utilities\.css['"]/m,
  /^@tailwind\s+components\s*;/m,
  /^@tailwind\s+base\s*;/m,
]

export function insertThemeRegion(css, decls) {
  for (const re of THEME_ANCHORS) {
    const m = re.exec(css)
    if (!m) continue
    const lineEnd = css.indexOf('\n', m.index)
    if (lineEnd < 0) continue // 锚点是文件末行(没有换行符)⇒ 换下一条,不在这里拼半截
    return `${css.slice(0, lineEnd)}\n${renderThemeRegion(decls)}\n${css.slice(lineEnd)}`
  }
  throw new Undetermined(
    'app.css 里没有 Tailwind 指令簇(@source / @import utilities / @tailwind base|components)⇒ 无法判定 @theme 区该插在哪'
  )
}

/**
 * `@theme` 区不在位时整块插入,已在位时**什么都不做** —— 原位写回是 planAppCssRegions +
 * mergeDeclsInPlace 那条路的事(与另外 5 区同一条分工)。
 * 源头该组为空也什么都不做:没有档就没有落点,不得为"看着完整"去猜一个位置。
 * 标记重复不在这里判:交给 markerRange(它与另外 5 区共用同一个「重复即无法判定」出口)。
 */
export function ensureThemeRegion(css, decls) {
  if (!decls || decls.size === 0) return css
  if (css.indexOf(THEME_REGION_MARK) >= 0) return css
  return insertThemeRegion(css, decls)
}

/**
 * 从 tokens.css 算出 app.css 6 个 token 受管区应有的档集合。
 * main() 与镜像测试**共用这一条**:测试若自己再拼一遍 6 个 map,拼错的那一份就会以
 * "夹具跑不通"的形态被下游读成"判据通过"(§22c 同型)。
 */
export function buildAppCssMaps(tokensContent) {
  const themeRaw = extractThemeBlock(tokensContent)
  const darkRaw = extractDarkBlock(tokensContent)
  const themeMap = buildVarMap(themeRaw)
  const darkMap = buildVarMap(darkRaw)
  return {
    semantic: buildVarMap(filterTokens(themeRaw)),
    alpha: buildVarMap(extractAlphaChannelBlock(tokensContent)),
    opacity: buildVarMap(extractOpacityPalette(tokensContent)),
    brand: buildVarMap(extractStandaloneRootBlock(tokensContent, themeMap, darkMap)),
    dark: buildVarMap(filterTokens(darkRaw)),
    theme: new Map(deriveThemeRegistryDecls(tokensContent).map((d) => [d.name, d.value])),
    // 供 style.ts 的 COLORS 用(未过滤的 @theme/.dark 原图,与 maps.theme 无关,勿混用)
    themeMap,
    darkMap,
  }
}

/**
 * app.css 的 7 处受管块逐块原位写回(base.css 段 + 5 个 token 区 + 1 个 `@theme` 注册区)。
 * 先做 base 段(它在文件头部,会整体推移后面的下标),再做 `@theme` 区的首次整块插入
 * (同样推移下标),**最后才在最新文本上**重算 6 个 token 区 —— 不在区间变化后继续沿用旧下标
 * (那是越界改写的来源)。
 */
export function mergeAppCss(css, maps, baseCss) {
  const withBase = mergeAppCssBase(css, baseCss)
  const withTheme = ensureThemeRegion(withBase, maps.theme)
  const plan = planAppCssRegions(withTheme, maps)
  let out = ''
  let last = 0
  for (const r of plan) {
    out += withTheme.slice(last, r.start) + mergeDeclsInPlace(withTheme.slice(r.start, r.end), r.map, r.label)
    last = r.end
  }
  return out + withTheme.slice(last)
}

const COLORS_HEAD = 'export const COLORS = {'
const COLORS_TAIL = '} as const'
/**
 * 一条字段行。刻意**不含前导缩进、含结尾逗号**:
 * 写回时缩进由匹配点之前的原文切片带过(与 `mergeDeclsInPlace` 同一条规矩),
 * 而逗号必须在匹配内 —— 留在外面的话,改写会把原逗号顶成 `,,`(实测踩过)。
 * `[ \t]*` 而非 `\s*`:后者在无逗号时会吃掉换行,把下一条的缩进并进本条。
 */
const COLORS_FIELD_RE = /(\w+)\s*:\s*\{\s*light:\s*'[^']*'\s*,\s*dark:\s*'[^']*'\s*\}[ \t]*,?/g
const renderColorRow = (r) => `${r.field}: { light: '${r.light}', dark: '${r.dark}' },`

/**
 * 只写 style.ts 的 `COLORS` 块,块外一个字节都不碰。
 *
 * 旧写法用模板**重铸整个文件**,而磁盘那份开头有 §5c 的零宽溯源横幅、模板里没有 ⇒
 * 每次生成都把横幅删掉,而 `--check` 因此天天报「style.ts 与 tokens.css 不同步」
 * (实测:首处差异就是横幅第 1 行,而 22 个字段的色值本就逐字节相同)。
 * 非受管字段(端内自加的)原样留下,缺的字段补到块尾。
 */
export function mergeStyleColors(ts, fieldRows) {
  const head = ts.indexOf(COLORS_HEAD)
  if (head < 0) throw new Undetermined('style.ts 中找不到 export const COLORS')
  const bodyStart = head + COLORS_HEAD.length
  const tail = ts.indexOf(COLORS_TAIL, bodyStart)
  if (tail < 0) throw new Undetermined('style.ts 的 COLORS 块找不到 } as const')
  const body = ts.slice(bodyStart, tail)
  const want = new Map(fieldRows.map((r) => [r.field, renderColorRow(r)]))

  const seen = new Set()
  const masked = maskComments(body)
  let out = ''
  let last = 0
  for (const m of masked.matchAll(COLORS_FIELD_RE)) {
    const raw = body.slice(m.index, m.index + m[0].length)
    const field = m[1]
    out += body.slice(last, m.index)
    const expect = want.get(field)
    // 不归 COLORS_MAPPING 管的字段 = 端内自有,原字节留下
    out += expect === undefined ? raw : raw === expect ? raw : expect
    seen.add(field)
    last = m.index + m[0].length
  }
  out += body.slice(last)

  const added = fieldRows.filter((r) => !seen.has(r.field))
  if (added.length) {
    const blockText = out.replace(/\s+$/, '')
    out =
      `${blockText}\n` +
      `  /* 以下 ${added.length} 字段为 COLORS_MAPPING 中声明而本块尚缺,由 sync-design-tokens.mjs 自动补入(勿手改) */\n` +
      `${added.map((r) => `  ${r.field}: { light: '${r.light}', dark: '${r.dark}' },`).join('\n')}\n`
  }
  return ts.slice(0, bodyStart) + out + ts.slice(tail)
}

/**
 * style.ts 的 COLORS 应有的字段值。
 * 从 themeMap 取 light 值,darkMap 取 dark 值,变量缺失时降级为 light 值。
 */
export function buildColorRows(themeMap, darkMap) {
  const rows = []
  for (const [field, varName] of Object.entries(COLORS_MAPPING)) {
    const light = themeMap.get(varName)
    if (!light) {
      console.error(`[sync-design-tokens] COLORS_MAPPING 中 ${field} 引用的变量 ${varName} 在 @theme 块中未找到`)
      process.exit(1)
    }
    const dark = darkMap.get(varName) || light
    rows.push({ field, light, dark })
  }
  return rows
}

// 2026-09-25:generateColors / generateStyleTs 已删除 —— 后者用模板重铸**整个 style.ts**,
// 而磁盘那份开头带 §5c 的零宽溯源横幅、模板里没有,于是每次生成都把横幅删掉,`--check` 天天报
// 「style.ts 与 tokens.css 不同步」(实测首处差异就是横幅第 1 行,而 22 个色值本就逐字节相同)。
// 现写回走 mergeStyleColors:只动 COLORS 块,块外(含横幅与 SPACING 等静态常量)一个字节都不碰。

function main() {
  if (!existsSync(TOKENS_SOURCE)) {
    console.error(`[sync-design-tokens] 源文件不存在: ${TOKENS_SOURCE}`)
    process.exit(1)
  }
  if (!existsSync(APP_CSS_TARGET)) {
    console.error(`[sync-design-tokens] 目标文件不存在: ${APP_CSS_TARGET}`)
    process.exit(1)
  }
  if (!existsSync(STYLE_TS_TARGET)) {
    console.error(`[sync-design-tokens] 目标文件不存在: ${STYLE_TS_TARGET}`)
    process.exit(1)
  }

  const tokensContent = readFileSync(TOKENS_SOURCE, 'utf8')
  const appCssContent = readFileSync(APP_CSS_TARGET, 'utf8')
  const styleTsContent = readFileSync(STYLE_TS_TARGET, 'utf8')

  // 六区 + style.ts 两张图的**唯一**取源出口(与镜像测试共用,别处不得再拼一遍 6 个 map)
  const maps = buildAppCssMaps(tokensContent)

  if (maps.themeMap.size === 0) {
    console.error('[sync-design-tokens] 未从 @theme 块提取到任何变量,请检查 tokens.css 格式')
    process.exit(1)
  }
  if (maps.darkMap.size === 0) {
    console.error('[sync-design-tokens] 未从 .dark 块提取到任何变量,请检查 tokens.css 格式')
    process.exit(1)
  }

  // base.css 是第 7 处受管块(整段逐字拷贝)。背景:app.css 首行的跨包 @import 在 Taro 编译时
  // 不被内联,产物 dist/app-origin.wxss 残留相对路径,微信 IDE 以 dist 为根解析失败
  // → [WXSS 文件编译错误] path ... not found from ./app-origin.wxss。
  const baseCssContent = readFileSync(BASE_CSS_SOURCE, 'utf8')

  // 7 处受管块**逐块原位写回**(旧写法整块重铸 ⇒ 端内自有档与解释性注释被静默抹掉,见文件头第 1 条)
  const newAppCss = mergeAppCss(appCssContent, maps, baseCssContent)
  // style.ts 只写 COLORS 块。旧写法用模板重铸**整个文件**,而磁盘那份开头带 §5c 的零宽溯源横幅、
  // 模板里没有 ⇒ 每次生成都删掉横幅,`--check` 因此天天报「style.ts 与 tokens.css 不同步」
  // (实测首处差异就是横幅第 1 行,22 个色值本就逐字节相同)。
  const newStyleTs = mergeStyleColors(styleTsContent, buildColorRows(maps.themeMap, maps.darkMap))
  if (isCheck) {
    let drift = false
    if (newAppCss !== appCssContent) {
      console.error('[sync-design-tokens] ❌ app.css 与 tokens.css 不同步')
      drift = true
    }
    if (newStyleTs !== styleTsContent) {
      console.error('[sync-design-tokens] ❌ style.ts 与 tokens.css 不同步')
      drift = true
    }
    if (drift) {
      // 这条提示此前写的是 `node scripts/sync-design-tokens.mjs` —— 根 scripts/ 下没有同名文件,
      // 照它跑必 "MODULE_NOT_FOUND"(AGENTS §4 专门记过这一条)。给真跑得通的入口。
      console.error('[sync-design-tokens] 请运行: pnpm --filter @ihui/miniapp-taro sync-tokens')
      process.exit(1)
    }
    console.info('[sync-design-tokens] ✅ app.css + style.ts 与 tokens.css 同步,无漂移')
    process.exit(0)
  }

  // 无任何变化 ⇒ 不改一个字节、也不碰 mtime(幂等的可观测形式;提交链里的
  // `git diff --quiet -- <file>` 也据此跳过多余的 git add)。
  const counts = `${maps.semantic.size} 语义 + ${maps.alpha.size} alpha 三元组 + ${maps.opacity.size} 透明度 + ${maps.brand.size} 品牌 + ${maps.dark.size} 暗档 + ${maps.theme.size} v4 色档注册`
  if (newAppCss === appCssContent && newStyleTs === styleTsContent) {
    console.info(`[sync-design-tokens] ✅ app.css + style.ts 与 tokens.css 一致(${counts},原位写回零改动)`)
    return
  }
  // 首次落地是"整块插入",之后才是"原位写回" —— 两者必须在日志里分得开,否则人会把
  // 第一次的大段新增读成"整块替换又回来了"(AGENTS §4 明令禁止的那一种)。
  const themeLanded = !appCssContent.includes(THEME_REGION_MARK) && newAppCss.includes(THEME_REGION_MARK)
  if (newAppCss !== appCssContent) writeFileSync(APP_CSS_TARGET, newAppCss, 'utf8')
  if (newStyleTs !== styleTsContent) writeFileSync(STYLE_TS_TARGET, newStyleTs, 'utf8')
  console.info(
    `[sync-design-tokens] ✅ 已原位写回${newAppCss !== appCssContent ? ' app.css' : ''}${newStyleTs !== styleTsContent ? `${newAppCss !== appCssContent ? ' + ' : ''}style.ts` : ''}(同名就地换值、缺档补到本区尾、端内自有档与注释逐字留在原位)${themeLanded ? ` — 其中 v4 色档注册区为**首次整块插入**,共 ${maps.theme.size} 档` : ''}`
  )
}

/**
 * 判据自检:全部用内存夹具,不碰真仓文件。每条都是**成对**的 ——
 * 只证「该写的会写」不证「不该写的绝不写」,就会把守门钉成恒红(实测:收紧判缺档的第一版就是这样,
 * 255 红点里 88 条是政策内不搬的档);反过来只证不写、不证会写,门就又退回"看不见缺档"的无牙形态。
 */
function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)

  const lines = [
    '--color-primary: hsl(0 0% 0%);',
    '--color-sidebar: #fff;',
    '--color-shell-panel: #111;',
    '--color-gradient-card-left: linear-gradient(',
    '--font-sans: Inter;',
    '--animate-ripple: ripple 1s;',
    '--breakpoint-sm: 640px;',
    '--text-vcenter-offset: 0.3px;',
    '--z-max: 10003;',
    '--global-box-shadow: 0 0 0 1px;',
    '--shadow-premium: 0 2px 8px;',
    '--radius-lg: 0.5rem;',
    '--chart-1: #3b82f6;',
  ]
  const kept = filterTokens(lines).map((l) => l.split(':')[0].trim())

  ok('G1 受管色档必须写(阳性:门判缺它才有出口)', kept.includes('--color-primary'))
  const mustNotWrite = [
    '--color-sidebar',
    '--color-shell-panel',
    '--color-gradient-card-left',
    '--font-sans',
    '--animate-ripple',
    '--breakpoint-sm',
    '--text-vcenter-offset',
    '--z-max',
    '--global-box-shadow',
    '--shadow-premium',
  ]
  const leaked = mustNotWrite.filter((n) => kept.includes(n))
  ok(
    'G2 跳过表内的档一个都不写(反向:否则守门按缺档判红就是判据错)',
    leaked.length === 0,
    leaked.join(',')
  )
  ok(
    'G3 表里每一条都真的判为「不写」(防有人把条目写成匹配不上的前缀)',
    MINIAPP_SKIP_PREFIXES.every((p) => !isManagedForMiniapp(`${p}probe`))
  )
  ok(
    'G4 非色档不在受管族(门不判)也不在跳过表(生成器照搬)⇒ 一张表两职责,不得把表当受管集',
    !isManagedForMiniapp('--radius-lg') &&
      !isSkippedForMiniapp('--radius-lg') &&
      kept.includes('--radius-lg')
  )

  const standalone = `:root {
  --color-miniapp-green: linear-gradient(135deg, #07c160, #06ad56);
  --color-gradient-card-left: linear-gradient(
    112deg,
    rgba(205, 208, 255, 0.7) 0%
  );
  --color-brand-accent: #4A7A96;
  --color-white-2: rgba(255, 255, 255, 0.02);
  --color-primary-rgb: 0, 0, 0;
  --app-bg: #fff;
}
.dark { --color-brand-accent: #8fb8cc; }`
  const darkMap = new Map([['--color-brand-accent', '#8fb8cc']])
  const business = extractStandaloneRootBlock(standalone, new Map(), darkMap)
  const businessNames = business.map((l) => l.split(':')[0].trim())
  ok(
    'G5 单行业务品牌色必须搬(2026-09-06 微信按钮底色那次的回归锁)',
    businessNames.includes('--color-miniapp-green')
  )
  ok(
    'G6 跨行渐变既不搬、也不能被截断成半截声明(产出非法 CSS)',
    !businessNames.includes('--color-gradient-card-left') &&
      !business.some((l) => l.includes('linear-gradient(') && !l.trim().endsWith(';'))
  )
  ok('G7 已在 .dark/@theme 出现的档不重复收', !businessNames.includes('--color-brand-accent'))
  ok(
    'G8 透明度色板与 alpha 三元组由各自通道收,standalone 不重复',
    !businessNames.includes('--color-white-2') && !businessNames.includes('--color-primary-rgb')
  )
  ok('G9 非色档不进独立 :root 业务色块', !businessNames.includes('--app-bg'))

  // 判定面(守门 36 走这一条):必须与写回面同谓词、同选择器
  const faces = `@theme {
  /* 注释里的 --color-fake: 散文不是声明 */
  --color-a: white;
  --color-sidebar: #eee;
  --font-sans: Inter;
}
:root {
  --color-late-rgb: 1, 2, 3;
}
.dark {
  --color-a: black;
  --color-shell-panel: #222;
}`
  const lightNames = deriveMiniappManaged(faces, 'light').map((d) => d.name)
  const darkNames = deriveMiniappManaged(faces, 'dark').map((d) => d.name)
  ok(
    'G10 判定面收后续 :root 块(alpha 三元组;RN 生成器旧版就漏过这一族)',
    lightNames.includes('--color-late-rgb')
  )
  ok(
    'G11 判定面把注释当数据的情况为零(阳性对照:--color-fake 不得进受管集)',
    !lightNames.includes('--color-fake')
  )
  ok(
    'G12 判定面与写回面同表:sidebar/shell/非色档两侧都不进(门不得判它们缺)',
    !lightNames.includes('--color-sidebar') &&
      !lightNames.includes('--font-sans') &&
      !darkNames.includes('--color-shell-panel') &&
      darkNames.length === 1
  )

  const src = readFileSync(__filename, 'utf8')
  // 只扫那两个**消费方函数体**:自检夹具自己也得写一遍档名做正反对照,
  // 按全文计数会把"G13 表只有一份"判成红 —— 那是尺子失效,不是有人抄了第二份表。
  const bodyOf = (name) => {
    const at = src.indexOf(`function ${name}(`)
    if (at < 0) return ''
    const open = src.indexOf('{', at)
    let depth = 0
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
    }
    return ''
  }
  const consumers = `${bodyOf('filterTokens')}\n${bodyOf('extractStandaloneRootBlock')}`
  ok(
    'G13 表只有一份:两个消费方的函数体里不得再出现前缀字面量(必须走谓词/表)',
    !/startsWith\('--color-'\)/.test(consumers) &&
      !/--color-(sidebar|shell-panel|gradient)/.test(consumers) &&
      consumers.includes('isManagedForMiniapp') &&
      consumers.includes('isSkippedForMiniapp')
  )

  // ── 原位写回(W 组):整块替换的两种必炸形态 —— 抹端内自有档、抹注释 ──
  const wTokens = `@theme {
  /* 说明里也写着 --color-bait: 这是散文不是声明; */
  --color-bg: white;
  --color-primary: black;
}
:root {
  --color-primary-rgb: 0, 0, 0;
  --color-white-2: rgba(255, 255, 255, 0.02);
  --color-miniapp-green: #07c160;
}
.dark {
  --color-bg: #101010;
  --color-primary: white;
}`
  // 六个区的应有档一律走 buildAppCssMaps —— 自检若自己再拼一遍 map,拼错的那一份就是
  // "夹具跑不通"被读成"判据通过"(§22c 同型),而这里正是 §22c 要防的第二份真相。
  const wMaps = buildAppCssMaps(wTokens)
  const wBase = 'html, body, page {\n  margin: 0;\n}'
  // 夹具刻意混入:端内自有档(假 --rn-* / --miniapp-*)、解释性注释、跨行渐变声明、错值。
  // 那两行 @tailwind/@source 是**指令簇锚点**:`@theme` 注册区首次落地要有落点(见 THEME_ANCHORS),
  // 夹具没有它就会以"无法判定"红 —— 而那与本轮要证的写回语义无关。
  const wCss = `/* ===== 共享基础样式(自动同步自 packages/design-tokens/src/styles/base.css,勿手动编辑;变更后运行 sync-design-tokens.mjs)===== */
OLD BASE BODY
/* ===== 共享基础样式结束(自动生成,勿手动编辑)===== */
@tailwind base;
@source "./**/*.{ts,tsx}";

:root {
  /* ===== 语义色(自动同步自 tokens.css @theme 块,勿手动编辑)===== */
  --color-bg: WRONG;
  /* 端内自有:进度环轨道色,不来自 tokens.css */
  --miniapp-local-track: #eeeeee;
  --rn-like-endpoint: #123456;
  --color-primary: black;
  /* ===== Tailwind v3 alpha 通道三元组(自动同步自 tokens.css,勿手动编辑;
     给 bg/text/border-*-/<透明度> 用)===== */
  --color-primary-rgb: WRONG, WRONG, WRONG;
}
/* ===== 透明度色板(自动同步自 tokens.css 独立 :root 块,勿手动编辑)===== */
:root {
  --color-white-2: rgba(255, 255, 255, 0.02);
}
/* ===== 业务品牌色(自动同步自 tokens.css 独立 :root 块,勿手动编辑)===== */
:root {
  --color-miniapp-green: WRONG;
  --color-miniapp-badge: linear-gradient(
    135deg,
    #07c160,
    #06ad56
  );
}
.dark {
  --color-bg: #101010;
  --color-primary: white;
  --miniapp-local-dark-track: #333333;
}`
  const w1 = mergeAppCss(wCss, wMaps, wBase)
  ok('W1 同名行就地换值(正例:该写的会写)', w1.includes('--color-bg: white;') && !w1.includes('WRONG;'))
  ok(
    'W2 端内自有档逐字留在原位(反例:整块替换必然抹掉它 —— RN 的 13 个 --rn-* 即先例)',
    w1.includes('--miniapp-local-track: #eeeeee;') &&
      w1.includes('--rn-like-endpoint: #123456;') &&
      w1.includes('--miniapp-local-dark-track: #333333;')
  )
  ok(
    'W3 解释性注释留在原位,且端内自有档只出现一次(不被"补入"复制第二份)',
    w1.includes('端内自有:进度环轨道色,不来自 tokens.css') &&
      (w1.match(/--miniapp-local-track:/g) || []).length === 1 &&
      (w1.match(/--rn-like-endpoint:/g) || []).length === 1
  )
  ok(
    'W4 跨行声明不得被判成"本区尚缺"再补一遍(实测:渐变档导致幂等破功、块越写越长)',
    !/自动补入/.test(w1) && w1.includes('    #06ad56') && (w1.match(/--color-miniapp-badge:/g) || []).length === 1
  )
  ok('W5 base.css 段原位写回,块外一字符不动', w1.includes('html, body, page {') && w1.includes('/* ===== 共享基础样式结束') && !w1.includes('OLD BASE BODY'))
  ok('W6 六处受管块仍各是各的:透明度区与品牌区没被合并', (w1.match(/:root \{/g) || []).length === 3 && w1.includes('--color-white-2: rgba(255, 255, 255, 0.02);'))
  ok(
    'W7 等值不误伤:未漂移的区不得改一个字符',
    mergeDeclsInPlace(
      '\n  --color-white-2: rgba(255, 255, 255, 0.02);\n',
      new Map([['--color-white-2', 'rgba(255, 255, 255, 0.02)']]),
      'x'
    ) === '\n  --color-white-2: rgba(255, 255, 255, 0.02);\n'
  )
  ok('W8 幂等:第二次写回必须与第一次逐字节相同', mergeAppCss(w1, wMaps, wBase) === w1)
  // 源头新增一档 ⇒ 补到它所属区的尾部,且第二次运行零改动
  const wMaps2 = { ...wMaps, brand: new Map([...wMaps.brand, ['--color-late-brand', '#123456']]) }
  const w2 = mergeAppCss(wCss, wMaps2, wBase)
  ok('W9 源头新增档必须补进所属区并点名来源(缺档有出口,门不会恒红)', w2.includes('--color-late-brand: #123456;') && /自动补入/.test(w2))
  ok('W10 补档只进品牌区,不污染语义区', (w2.match(/自动补入/g) || []).length === 1 && mergeAppCss(w2, wMaps2, wBase) === w2)

  // style.ts 原位写回
  const wRows = [
    { field: 'primary', light: 'black', dark: 'white' },
    { field: 'bgPrimary', light: 'white', dark: '#101010' },
  ]
  const wTs = `// © 2026 IHUI AI · 溯源横幅(零宽载荷)
/** 头部说明 */
export const COLORS = {
  primary: { light: 'black', dark: 'white' },
  localOnly: { light: '#eee', dark: '#333' },
} as const
export const SPACING = { xs: 4 } as const
`
  const t1 = mergeStyleColors(wTs, wRows)
  ok('T1 只写受管字段:横幅与块外常量逐字保留', t1.includes('// © 2026 IHUI AI · 溯源横幅') && t1.includes('export const SPACING'))
  ok('T2 端内自有字段不删不改', t1.includes('localOnly: { light:') && !/,,/.test(t1))
  ok('T3 缺字段补到块尾', t1.includes("bgPrimary: { light: 'white', dark: '#101010' }"))
  ok('T4 幂等 + 不得产出双逗号', mergeStyleColors(t1, wRows) === t1 && !/,,/.test(t1))
  const t2 = mergeStyleColors(t1.replace("light: 'white'", "light: 'WRONG'"), wRows)
  ok('T5 字段值漂移必须被改回(阳性对照)', t2 === t1 && !t2.includes('WRONG'))

  // ── TH 组:v4 色档注册区(第 6 处 token 受管区)。同样成对 ——
  // 只证"会插"不证"绝不重复插",第二次运行就会把整份档名清单再写一遍;
  // 反过来只证"不重复插",注册区就会缺档而守门看不见(§4「只比副本已有键的门等于没有」)。
  const thBody = (css) => {
    const b = topLevelRanges(css, '@theme')[0]
    return b ? css.slice(b.bodyStart, b.bodyEnd) : ''
  }
  const th1 = mergeAppCss(wCss, wMaps, wBase)
  ok('TH1 首次落地:无注册区 ⇒ 整块插入,带标记注释与 @theme 块', !wCss.includes(THEME_REGION_MARK) && th1.includes(THEME_REGION_MARK) && th1.includes('@theme {'))
  ok(
    'TH1b 幂等(要求的 (a)):插入后立刻再跑一次必须逐字节相同,且块恰好一个、没有"自动补入"注释',
    mergeAppCss(th1, wMaps, wBase) === th1 &&
      topLevelRanges(th1, '@theme').length === 1 &&
      !/自动补入/.test(th1)
  )
  ok(
    'TH2 插入位置有依据(指令簇末尾、第一处消费 var(--color-*) 之前):不得插到 :root 之后',
    th1.indexOf('@theme {') > th1.indexOf('@source "') && th1.indexOf('@theme {') < th1.indexOf(':root {')
  )

  // (b) 注释里写着 @theme 而下面才有真块:必须写进真块,注释逐字原位保留。
  // 夹具先把真块里的一档改坏,再把带 @theme 字样的散文注释整段拼在文件头 ——
  // 若判据把注释当块,坏值就永远改不回来(且还会多长出一块)。
  const th3Src = th1.replace('  --color-bg: white;', '  --color-bg: WRONG;')
  const th3 = mergeAppCss(
    `/* 散文注释:历史上这里写着 @theme {\n   --color-decoy: 这不是声明;\n   } 但它也不是块。 */\n` + th3Src,
    wMaps,
    wBase
  )
  const th3BlockOpen = topLevelRanges(th3, '@theme')[0]
  ok(
    'TH3 注释里的字符串 @theme 不得被当块(要求的 (b)):写进真块、散文逐字留着、块数仍为 1',
    thBody(th3).includes('--color-bg: white;') &&
      th3.includes('--color-decoy: 这不是声明;') &&
      // "散文在真块之前"要拿真块的 open 当下标 —— 按文本 indexOf('@theme {') 会先命中
      // 注释里那个假的,把这条断言变成永远为假的死尺子(写这条夹具时实测踩过)。
      th3.indexOf('--color-decoy') < th3BlockOpen.open &&
      topLevelRanges(th3, '@theme').length === 1
  )

  // (c) -rgb 三元组绝不进注册区(进了就长出 .bg-muted-rgb 这类脏档),但仍必须在 alpha 区。
  ok(
    'TH4 -rgb 档不进 @theme 而仍在 alpha 区(要求的 (c),含"它本该受管"的阳性对照)',
    !/-rgb\s*:/.test(thBody(th1)) &&
      th1.includes('--color-primary-rgb: 0, 0, 0;') &&
      deriveMiniappManaged(wTokens, 'light').some((d) => d.name === '--color-primary-rgb') &&
      wMaps.theme.size === deriveMiniappManaged(wTokens, 'light').length - 1
  )

  // (d) 源头新增一档 ⇒ 注册区被补入,而各区的原有行不受影响(区与区互不串写)。
  const wTokensLate = wTokens.replace(
    '  --color-primary: black;\n',
    '  --color-primary: black;\n  --color-late-theme: #654321;\n'
  )
  const th5 = mergeAppCss(th1, buildAppCssMaps(wTokensLate), wBase)
  const rootBefore = collectVars(th1, [':root'])
  const rootAfter = collectVars(th5, [':root'])
  ok(
    'TH5 源头新增档必须补进注册区并点名来源(要求的 (d) 前半:缺档有出口,门不会恒红)',
    thBody(th5).includes('--color-late-theme: #654321;') && /自动补入/.test(thBody(th5))
  )
  ok(
    'TH5b 补档不得串写别的区(要求的 (d) 后半)::root 原有档逐条等值、只多该档自己那一条,第二次运行仍幂等',
    [...rootBefore.entries()].every(([n, d]) => rootAfter.get(n)?.value === d.value) &&
      rootAfter.size === rootBefore.size + 1 &&
      (th5.match(/--color-late-theme:/g) || []).length === 2 &&
      mergeAppCss(th5, buildAppCssMaps(wTokensLate), wBase) === th5
  )

  // 两种"判不出落点"必须大声失败,不得静默当成"无需同步"。
  let thNoAnchor = false
  try {
    insertThemeRegion('/* 没有任何 Tailwind 指令簇 */', wMaps.theme)
  } catch (e) {
    thNoAnchor = e instanceof Undetermined
  }
  ok('TH6 找不到指令簇锚点 ⇒ 抛「无法判定」(不得猜一个位置去插)', thNoAnchor)
  let thNoBlock = false
  try {
    mergeAppCss(th1.replace(/@theme\s*\{[\s\S]*?\n\}/, ''), wMaps, wBase)
  } catch (e) {
    thNoBlock = e instanceof Undetermined
  }
  ok('TH6b 标记注释在位而 @theme 块被摘走 ⇒ 抛「无法判定」(不得把档写进别处)', thNoBlock)
  let thDup = false
  try {
    mergeAppCss(`${THEME_REGION_MARK} 又一份)===== */\n@theme {\n  --color-bg: white;\n}\n` + th1, wMaps, wBase)
  } catch (e) {
    thDup = e instanceof Undetermined
  }
  ok('TH6c 注册区标记重复 ⇒ 抛「无法判定」(与另外 5 区共用同一个 markerRange 出口)', thDup)
  ok(
    'TH7 源头注册集为空 ⇒ 一个字节都不动(没有档就没有落点);已在位时 ensure 阶段不重写',
    ensureThemeRegion(wCss, new Map()) === wCss && ensureThemeRegion(th1, wMaps.theme) === th1
  )

  let undetermined = 0
  for (const fn of [
    () => mergeAppCss('/* 一个受管块都没有 */', wMaps, wBase),
    () => mergeAppCss(wCss.replace('/* ===== 业务品牌色', '/* ===== 品牌'), wMaps, wBase),
    () => mergeStyleColors('export const X = {}', wRows),
  ]) {
    try {
      fn()
    } catch (e) {
      if (e instanceof Undetermined) undetermined++
    }
  }
  ok('T6 目标结构缺失/标记被改名必须抛「无法判定」(不得静默当成无需同步)', undetermined === 3, `实得 ${undetermined}/3`)

  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `self-test 失败 ${failed} 条` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

// §22d:CLI 直接执行才跑主流程;守门 36 与测试 import 本模块时不得有写盘副作用。
// (此前顶层裸调 main() —— 门一 import 谓词就会顺手"同步"一次 app.css + style.ts。)
// isDirectRun 在文件顶部与 argv 一起判定(isHelp/--check 分支也要它),这里只做分发。
if (isDirectRun) {
  try {
    if (isSelfTest) selfTest()
    else main()
  } catch (error) {
    console.error('[sync-design-tokens] 执行失败:', error?.message ?? error)
    process.exit(2)
  }
}

export const __test__ = {
  MINIAPP_SKIP_PREFIXES,
  isSkippedForMiniapp,
  isManagedForMiniapp,
  deriveMiniappManaged,
  deriveThemeRegistryDecls,
  isAlphaRgbTriple,
  THEME_REGION_MARK,
  filterTokens,
  extractStandaloneRootBlock,
  extractThemeBlock,
  extractDarkBlock,
  extractOpacityPalette,
  extractAlphaChannelBlock,
  buildVarMap,
  buildAppCssMaps,
  buildColorRows,
  // 原位写回的那一侧(§22c:镜像测试直接 import,不得复制判据)
  mergeDeclsInPlace,
  mergeAppCss,
  mergeAppCssBase,
  mergeStyleColors,
  planAppCssRegions,
  topLevelRanges,
  // v4 色档注册区(第 6 区)的首次落地机制
  ensureThemeRegion,
  insertThemeRegion,
  renderThemeRegion,
  Undetermined,
  TOKENS_SOURCE_REL,
  BASE_CSS_REL,
  APP_CSS_REL,
  STYLE_TS_REL,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
