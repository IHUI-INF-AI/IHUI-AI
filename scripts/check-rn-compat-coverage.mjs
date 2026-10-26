// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-rn-compat-coverage.mjs —— 小程序端 RN 兼容层「覆盖面」对账门(2026-10-26 立)。
 *
 * 它守的是这一型事故:兼容层是为"共享屏 / RN 壳不加改动地在小程序渲染"而造的。消费面
 * 只要新增一个 `import { X } from 'react-native'`(或换图标、新路由名),而兼容层/生成物
 * 没有那一枚名字 ⇒ **babel 构建照样过**(类型位被擦除、具名导入在 CJS 互操作里读 undefined),
 * 页面运行期才炸(白屏 / undefined is not a function)。也就是"门绿而链路断"(§0.9 造好没装车=没有
 * 的对偶:装好了没覆盖=一样没有)。本门把覆盖面变成提交链上可判的三维:
 *
 *   C1 标识符覆盖 —— packages/app/src 与 apps/mobile-rn/src 从 'react-native' 具名取用的全集,
 *       必须全部是 src/rn-compat 的具名出口(类型名也算:缺了 tsc 就报 no exported member)。
 *   C2 图标覆盖   —— 消费面从 'lucide-react-native' 具名取用的全集,必须全在 icons-generated.tsx;
 *       判据 import scripts/gen-rn-compat.mjs 的 __test__(§0.6,不复制第二把尺)。
 *   C3 路由映射真值 —— rn-compat/route-map.generated.ts 里每个目标路径必须真在 app.config 的
 *       页面清单里(分包 root + page 拼接);指向不存在的页 = 声明链断了,跳过去必失败。
 *
 * 档位:C1/C2/C3 是**绝对零容忍**(不是差值棘轮)—— 兼容层的缺口没有"存量合理"这一说,
 * 补上即可(出口加一行 / 跑一次生成器),所以立起来当天就能是绿的;一旦红就是真断链。
 * 取不到被审面 ⇒ exit 2「未判定」(§0.3),不记绿也不冒红。
 *
 * 用法:
 *   node scripts/check-rn-compat-coverage.mjs            # 全量档(HEAD blob)
 *   node scripts/check-rn-compat-coverage.mjs --staged   # 索引 blob
 *   node scripts/check-rn-compat-coverage.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { shellRefsOf, shellTargetRel, mismatchedShellBinding } from './lib/rn-shell-refs.mjs'
// 路由解析复用造页器那一份(parseMiniappRoutes)—— 本门 C3 与 C8 判的都是"在册路由",
// 自己再写一条正则就是第二份真相,而路由清单两头一漂,C3/C8 会各自读出不同的"在册"集合(§0.6)。
import { parseMiniappRoutes } from './gen-miniapp-mirror.mjs'
// C9 判的是"壳承载的编译期契约"与面上引用是否逐字同步 ⇒ 判据取生成器那一份(§0.6,同一条算式不许两处各写)。
import { __test__ as shellTypes } from './gen-rn-shell-types.mjs'
// 可达键与词包解码同一份实现(生成器补键时 import 的是同一条算式,§0.6)
import {
  carriedKeysFromRepo,
  decodePackB64,
  extractLocaleB64,
  extractStringConst,
  flattenKeys,
} from './lib/rn-carried-keys.mjs'
import { __test__ as gen } from './gen-rn-compat.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const COMPAT_DIR = 'apps/miniapp-taro/src/rn-compat'
const CONSUMERS = ['packages/app/src', 'apps/mobile-rn/src']
/** 兼容层的出口文件集(新增文件必须在此登记,否则它导出的名字会被判成"没在册") */
const COMPAT_FILES = ['index.ts', 'primitives.tsx', 'apis.ts', 'style.ts', 'navigation.tsx', 'theme.tsx', 'storage.ts', 'platform.tsx', 'i18n.ts']
const ICONS_REL = `${COMPAT_DIR}/icons-generated.tsx`
const ROUTE_REL = `${COMPAT_DIR}/route-map.generated.ts`
const MP_CONFIG_REL = 'apps/miniapp-taro/src/app.config.ts'
const MP_SRC = 'apps/miniapp-taro/src'
/** 一条在册路由可能指向的页文件后缀(C8 逐条探存在性用;顺序即 Taro 的解析候选)。 */
const PAGE_EXTS = ['.tsx', '.ts', '.jsx', '.js']
/** 端内生成的词包(解包核对可达键用;zh-CN 内联档 + 4 语 CDN 载荷档) */
const ZH_PACK_REL = 'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts'
const REMOTE_PACK_REL = 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts'
/** 标记载体:与 cov.MARK_RE 同形(顶行 `// 镜像 packages/app/...`) */
const MIRROR_MARK_RE = /^\/\/ ?镜像 (packages\/app\/src\/\S+)/m
/** 真复用的两种形态:直接渲染共享屏,或承载 RN 壳 */
const REUSE_IMPORT_RE = /from '@(?:ihui\/rn-app|rn-shells)[^']*'/

/** 判定面选择一律走取材层(§0.4):两面同给当场判死 */
function faceFlags(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' }).face
}

/**
 * 面读取一律经统一取材层(§0.4 + 守门 118:门脚本不得自己派生 git 取 blob 正文):
 *  - 枚举哪些文件在消费这两个包 ⇒ git grep(只列名字,不取正文);
 *  - 正文 ⇒ face-reader 的 catBatch(全量档 HEAD / --staged 索引)或 readWorktreeFile(人工逃生舱)。
 * 取不到面 ⇒ 调用方落「未判定」,不回落另一个面。
 */
function makeReader(face) {
  const listFiles = (paths) => {
    // 只做**枚举**(哪些文件 import 了这两个包),正文一律走下面的 readMany() —— 枚举用 git grep,
    // 取正文用取材层:两者混在同一把尺里,就会出现"清单一个面、内容另一个面"的悬空判据(§0.4)。
    const args = ['grep', '-l', '-E', "from '(react-native|lucide-react-native)'"]
    if (face === 'staged') args.push('--cached')
    else if (face !== 'worktree') args.push('HEAD')
    args.push('--', ...paths)
    const out = execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => (face === 'head' ? l.replace(/^HEAD:/, '') : l))
  }
  /**
   * 批量取正文:一次 catBatch 取完整批。
   * 为什么必须批量而不是逐枚 read():消费面现读 467 个文件,逐枚起 git 进程实测把这道门
   * 拖到 2 分钟以上(超时)⇒ 门一慢就没人跑,等于没装车;而 §0.4 要求"清单与内容同面同轮",
   * 同轮正是靠一次批取完成的。取不到的路径落 null,由调用方判「未判定」。
   */
  const readMany = (rels) => {
    const uniq = [...new Set(rels)]
    if (face === 'worktree') {
      const map = new Map()
      for (const rel of uniq) map.set(rel, readWorktreeFile(ROOT, rel))
      return map
    }
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = uniq.map((r) => `${prefix}${r}`)
    const got = catBatch(ROOT, specs)
    const map = new Map()
    for (const rel of uniq) map.set(rel, got.get(`${prefix}${rel}`) ?? null)
    return map
  }
  return { face, label: face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树磁盘(人工逃生舱)' : 'HEAD blob', listFiles, readMany }
}

/** cov 那把尺要的面上,与本门的 face 逐字同一档 */
function faceOf(reader) {
  return reader.face
}

function namedImportsFrom(text, moduleName) {
  const names = new Set()
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${moduleName}(?:/[a-z-]+)?'`, 'g')
  let m
  while ((m = re.exec(text || ''))) {
    for (const raw of m[1].split(',')) {
      const t = raw
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim()
      if (t) names.add(t)
    }
  }
  return names
}

/** 兼容层具名出口集(含 `export const|function|class|let|var`、`export {A, B}`、`export type X`、`export type {A}`) */
/** 一枚文件自身的具名出口集(不含它 `export *` 带进来的东西)。 */
function ownExports(src) {
  const out = new Set()
  if (!src) return out
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:const|function|class|let|var)\s+([A-Za-z0-9_]+)/g)) out.add(m[1])
  for (const m of src.matchAll(/export\s+type\s+([A-Za-z0-9_]+)/g)) out.add(m[1])
  for (const m of src.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}(?:\s*from)?/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        .trim()
      if (name) out.add(name)
    }
  }
  return out
}

/**
 * 桶口的**有效**出口集(不是各文件名字的并集)。
 * ESM 语义:`export *` 撞上同名 ⇒ 歧义名两侧都不出口(webpack 的 "conflicting star exports" 就是这个)。
 * 并集读法会把 `Image`/`Keyboard` 这类"名字在册、实际上拿到 undefined"读成兼容层已覆盖 ⇒ C1 结构性失明。
 * 只有桶文件自己的**显式**重导出能把歧义名压回来,故 explicit 优先。
 */
function effectiveExports(contents) {
  const barrelRel = `${COMPAT_DIR}/index.ts`
  const barrel = contents.get(barrelRel) ?? ''
  // 桶里的 `export * from './primitives'` 是**无扩展名**写法 ⇒ 解析到清单里的真实键,
  // 不解析就永远取不到正文,歧义维会在真仓上结构性失明(实测第一版就是这么漏的)。
  const resolveStar = (spec) => {
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
      const key = `${COMPAT_DIR}/${spec}${ext}`
      if (contents.get(key) !== null && contents.get(key) !== undefined) return key
    }
    return null
  }
  const starTargets = [...barrel.matchAll(/export\s*\*\s*from\s*['"]\.\/([A-Za-z0-9_.-]+?)['"]/g)]
    .map((m) => resolveStar(m[1]))
    .filter(Boolean)
  const perSource = starTargets.map((key) => [key, ownExports(contents.get(key))])
  const explicit = ownExports(barrel)
  const count = new Map()
  for (const [, names] of perSource) for (const n of names) count.set(n, (count.get(n) ?? 0) + 1)
  const all = new Set(explicit)
  for (const [, names] of perSource) for (const n of names) if (count.get(n) === 1 || explicit.has(n)) all.add(n)
  const conflicts = [...count.entries()].filter(([n, c]) => c > 1 && !explicit.has(n)).map(([n]) => n).sort()
  return { all, conflicts, starTargets }
}

function compatExports(contents) {
  return effectiveExports(contents).all
}

/**
 * C5 判据本体住在 scripts/lib/rn-shell-refs.mjs(与跨端覆盖尺共用同一份,§0.6);
 * 这里只 import,不再写第二份正则 —— 两份实现早晚一边认一边不认。
 */
/** C7 夹具:桶 + 两个来源的出口集;explicit=true 时桶写了显式重导出压歧义。 */
function c7Fixture(explicit) {
  const STAR = ["export * from './primitives'", "export * from './icons-generated'", ''].join('\n')
  const STAR_EXPLICIT = ["export * from './primitives'", "export * from './icons-generated'", "export { Image } from './primitives'", ''].join('\n')
  const PRIM = ['export const Image = 1', 'export const View = 2', ''].join('\n')
  const ICONS = ['export const Image = 3', 'export const Star = 4', ''].join('\n')
  return {
    [`${COMPAT_DIR}/index.ts`]: explicit ? STAR_EXPLICIT : STAR,
    [`${COMPAT_DIR}/primitives.tsx`]: PRIM,
    [`${COMPAT_DIR}/icons-generated.tsx`]: ICONS,
  }
}
export function judge(reader) {
  const findings = { c1: [], c2: [], c3: [], c4: [], c5: [], c6: [], c7: [], c8: [], c9: [], c10: [] }
  let files
  try {
    files = reader.listFiles(CONSUMERS)
  } catch (error) {
    return { state: 'undetermined', reason: `消费面枚举失败:${String(error?.message ?? error).slice(0, 120)}`, findings }
  }
  if (files.length === 0) return { state: 'undetermined', reason: '消费面枚举到 0 个文件(判据面异常,不记绿)', findings }

  let declaredRoutes = []
  let c10Measured = null
  try {
    declaredRoutes = cov
      .collectMiniapp(faceOf(reader))
      .map((r) => (typeof r === 'string' ? r : r.route))
      .filter(Boolean)
  } catch {
    declaredRoutes = []
  }

  // 一次批取全部需要的正文(消费面 + 兼容层 + 生成物 + 分包清单 + 页文件)—— 同面同轮(§0.4)
  // C8 要按"路由 ↔ 页"逐条探存在性,而后者的路径由前者决定 ⇒ 先从同一 reader 取 config 解路由,
  // 再把候选页并进主批。分两批是为了顺序,面的档位没有变(仍是同一个 reader、同一个 face)。
  let pageRoutes = []
  try {
    const cfgPre = reader.readMany([MP_CONFIG_REL]).get(MP_CONFIG_REL)
    if (cfgPre !== null && cfgPre !== undefined) pageRoutes = parseMiniappRoutes(cfgPre).routes
  } catch {
    pageRoutes = [] // 取不到 ⇒ 主批里仍会因 config 缺失落到「未判定」,这里不抢先定论
  }
  let contents
  try {
    contents = reader.readMany([
      ...files,
      ...COMPAT_FILES.map((f) => `${COMPAT_DIR}/${f}`),
      ICONS_REL,
      ROUTE_REL,
      MP_CONFIG_REL,
      ...declaredRoutes.map((r) => `${MP_SRC}/${r}.tsx`),
      // C8 的候选后缀一次批齐(同面同轮):一条路由可能落在 .tsx/.ts/.jsx/.js 任一种
      ...pageRoutes.flatMap((r) => PAGE_EXTS.map((e) => `${MP_SRC}/${r}${e}`)),
      shellTypes.OUT_REL,
      ZH_PACK_REL,
      REMOTE_PACK_REL,
    ])
  } catch (error) {
    return { state: 'undetermined', reason: `取材失败:${String(error?.message ?? error).slice(0, 120)}`, findings }
  }
  const rnText = new Map(files.map((f) => [f, contents.get(f)]))
  if ([...rnText.values()].some((v) => v === null || v === undefined)) {
    return { state: 'undetermined', reason: '消费面有文件取不到正文(面错位,不回落另一面)', findings }
  }

  // C1 react-native 具名取用 ↔ 兼容层出口
  const rnNames = new Set()
  for (const text of rnText.values()) for (const n of namedImportsFrom(text, 'react-native')) rnNames.add(n)
  const eff = effectiveExports(contents)
  const exported = eff.all
  findings.c1 = [...rnNames].filter((n) => !exported.has(n)).sort()

  // C2 lucide 取用 ↔ 生成物。两档分别判:
  //   运行时图标名(生成器必须产出组件)—— 名字全集 import 生成器那一份实现(§0.6);
  //   类型档(如 LucideIcon)—— 只要在本文件里有具名导出即在册,它不该进组件集也不该算残名。
  // 门与生成器必须量到同一个集,否则一边绿一边红 = 又回到两把尺子各读各的。
  const faceFiles = [...rnText.entries()].map(([path, text]) => ({ path, text }))
  const runtimeIcons = new Set(gen.collectIconNames(faceFiles))
  const typeIcons = new Set()
  for (const text of rnText.values()) {
    for (const m of (text || '').matchAll(/import\s+type\s*\{([^}]*)\}\s*from\s*'lucide-react-native'/g)) {
      for (const raw of m[1].split(',')) {
        const t = raw.trim().split(/\s+as\s+/)[0].trim()
        if (t && !t.startsWith('type ')) typeIcons.add(t)
      }
    }
  }
  const iconsSrc = contents.get(ICONS_REL)
  if (iconsSrc === null) return { state: 'undetermined', reason: 'icons-generated.tsx 取不到(生成物未落地?)', findings }
  const valueExports = new Set([...iconsSrc.matchAll(/^export const ([A-Za-z0-9]+) =/gm)].map((m) => m[1]))
  const typeExports = new Set([...iconsSrc.matchAll(/^export type ([A-Za-z0-9]+) =/gm)].map((m) => m[1]))
  findings.c2 = [...runtimeIcons].filter((n) => !valueExports.has(n)).sort()
  for (const n of typeIcons) if (!typeExports.has(n) && !valueExports.has(n)) findings.c2.push(n)
  findings.c2.sort()
  // 反向:组件表里没人用的名字只报数(它由生成器按现算全集产出,残名说明生成器与被审面不同轮)
  const staleIcons = [...valueExports].filter((n) => !runtimeIcons.has(n)).sort()
  const lucideTotal = runtimeIcons.size + typeIcons.size

  // C3 路由映射目标必须真在 app.config 页面清单里
  const routeSrc = contents.get(ROUTE_REL)
  const cfgSrc = contents.get(MP_CONFIG_REL)
  if (routeSrc === null || cfgSrc === null) {
    return { state: 'undetermined', reason: '路由映射或 app.config 取不到,无法判 C3', findings }
  }
  const declared = new Set()
  for (const m of cfgSrc.matchAll(/root:\s*'([^']+)'[\s\S]*?pages:\s*\[([^\]]*)\]/g)) {
    for (const p of m[2].matchAll(/'([^']+)'/g)) declared.add(`/${m[1]}/${p[1]}`)
  }
  for (const m of cfgSrc.matchAll(/pages:\s*\[([\s\S]*?)\]/g)) {
    for (const p of m[1].matchAll(/'([^']+)'/g)) declared.add(`/${p[1]}`)
  }
  // 形态容忍两种写法:生成器原样(键带引号)与 prettier 归一后(键不带引号)——
  // lint-staged 会在提交前重排生成物,尺子按单一写法匹配就会读出 0 条并冒"没有缺口"的绿(假绿)。
  const routeEntries = [...routeSrc.matchAll(/^\s*(?:["']([A-Za-z0-9]+)["']|([A-Za-z0-9]+)):\s*["']([^"']+)["']/gm)].map(
    (m) => [m[1] ?? m[2], m[3]],
  )
  if (routeEntries.length === 0) {
    return { state: 'undetermined', reason: 'route-map.generated.ts 读到 0 条映射(表被改写或生成器没跑) ⇒ 这一维没看,不得记绿', findings }
  }
  findings.c3 = routeEntries.filter(([, path]) => !declared.has(path)).map(([name, path]) => `${name} → ${path}`)

  // C4 结构复用维:声明镜像 ≠ 复用。HEAD 面现读 38 枚页顶写着 `// 镜像 packages/app/...`,
  // 而真实 import @ihui/rn-app / @rn-shells 的页 = 0 枚 ⇒ "镜像"只是声明不是复用
  // (AGENTS §4 禁止"两端各写一份靠对账追平";与 check-miniapp-mirror-fidelity 头注同一事实)。
  // 档位 = 以 HEAD 自身违例集为锚点的差值棘轮:存量只报数,本次带进来的新违例才拦(§12e)。
  let staleReuse = []
  const pageRels = declaredRoutes.map((r) => `${MP_SRC}/${r}.tsx`)
  if (pageRels.length > 0) {
    const violating = []
    for (const rel of pageRels) {
      const text = contents.get(rel)
      if (!text || !MIRROR_MARK_RE.test(text)) continue
      if (!REUSE_IMPORT_RE.test(text)) violating.push(rel)
    }
    const headReader = makeReader('head')
    let headContents
    try {
      headContents = headReader.readMany(pageRels)
    } catch (error) {
      return { state: 'undetermined', reason: `C4:HEAD 面存量锚点取不到(${String(error?.message ?? error).slice(0, 90)})⇒ 不判倒退也不记绿`, findings }
    }
    const headViolating = new Set(
      pageRels.filter((rel) => {
        const t = headContents.get(rel)
        return t && MIRROR_MARK_RE.test(t) && !REUSE_IMPORT_RE.test(t)
      }),
    )
    findings.c4 = violating.filter((rel) => !headViolating.has(rel)).sort()
    staleReuse = violating.filter((rel) => headViolating.has(rel)).sort()
  }

  // C5 壳承载真值维:页里 `@rn-shells/<X>` 指过去的那个 RN 壳文件必须真存在。
  // 立因是实测到的 dangling 页:造页器 form=shell 曾把"有 RN 屏 import 了这张共享屏"当成
  // "同名 RN 壳存在"(console-table / switch-prefs 两枚),weapp 构建当场编不过
  // (Taro 解析到 `…ConsoleTableScreen.vue doesn't exist`),而 C1..C4 四维都看不住这一格。
  const shellTargets = new Map()
  for (const rel of pageRels) {
    const text = contents.get(rel)
    if (!text) continue
    for (const x of shellRefsOf(text)) {
      if (!shellTargets.has(rel)) shellTargets.set(rel, new Set())
      shellTargets.get(rel).add(x)
    }
  }
  const shellFiles = [...new Set([...shellTargets.values()].flatMap((s) => [...s].map(shellTargetRel)))].sort()
  if (shellFiles.length > 0) {
    let got
    try {
      got = reader.readMany(shellFiles)
    } catch (error) {
      return { state: 'undetermined', reason: `C5:壳目标取不到(${String(error?.message ?? error).slice(0, 90)})⇒ 不判`, findings }
    }
    for (const [rel, set] of shellTargets) {
      for (const x of set) {
        const target = shellTargetRel(x)
        if (got.get(target) === null || got.get(target) === undefined) findings.c5.push(`${rel} → ${target}(被审面上不存在 ⇒ 该页编不过)`)
      }
    }
  }

  // C6 取用形态维:C5 只管"壳在不在",这一维管"页面按哪种形态引它、壳真有那么出口吗"。
  // 立因是构建里那批 `export 'default' ... was not found in '@rn-shells/X'` 警告:webpack 不拦,
  // 页面渲染出来是 undefined —— 声明复用、壳也在,唯独取法错了,前五维全都看不住。
  const shellTexts = new Map()
  {
    const rels = [...new Set([...shellTargets.values()].flatMap((s) => [...s].map(shellTargetRel)))]
    if (rels.length > 0) {
      const g = reader.readMany(rels)
      for (const r of rels) shellTexts.set(r, g.get(r) ?? null)
    }
  }
  for (const rel of shellTargets.keys()) {
    const bad = mismatchedShellBinding(contents.get(rel) ?? '', (t) => shellTexts.get(t))
    if (bad) findings.c6.push(`${rel} → ${bad}`)
  }
  // C7 桶歧义维:两条 `export *` 撞同名而桶没写显式重导出 ⇒ 该名字谁都拿不到(ESM 歧义语义)。
  // 这一维不判就等于把 `<Image>` 这类基础组件在小程序端的存在性交给"运气"。
  findings.c7 = eff.conflicts.map(
    (n) => `${COMPAT_DIR}/index.ts:「${n}」被多条 export * 同名带出且无显式重导出 ⇒ 消费面按名取用拿到 undefined`,
  )

  // C8 路由↔页配对维:app.config 在册的每一条路由,页文件必须真在被审面上。
  // 立因是实测到的一枚悬空路由(d1dc35c331ae 只插了路由行,页文件从未进过任何提交):
  // `pkg-user/activity-detail/index` 在 HEAD 的 app.config 在册,而 git 全树没有这个页 ⇒ 真机/Taro 侧
  // 拿到一个解析不到的入口。C1..C7 全部只看"页里写了什么",看不见"路由指向的页根本不在面上"这一型。
  // 反向那一格(页在而路由不在)不判红:射程外的历史页存量口径未定,判了就是恒红门(§12e)。
  if (pageRoutes.length === 0) {
    findings.c8.push(`${MP_CONFIG_REL}:在册路由枚举到 0 条 ⇒ 这一维没看,不得记绿(判据面异常或路由解析坏)`)
  } else {
    findings.c8 = pageRoutes
      .filter((r) => !PAGE_EXTS.some((e) => contents.get(`${MP_SRC}/${r}${e}`) !== null && contents.get(`${MP_SRC}/${r}${e}`) !== undefined))
      .map((r) => `app.config 在册 /${r} ⇒ ${MP_SRC}/${r}{${PAGE_EXTS.join(',')}} 在被审面上一个都不存在`)
  }

  // C9 编译期契约维:小程序端那两个只在 webpack 别名里成立的说明符(@rn-shells/* 与 @ihui/rn-app/*)
  // 必须有一份与面上引用逐字同步的 declare 声明件。立因:tsconfig 的 paths 把别名指到仓库根之外,
  // 实测 6 枚壳承载页长期 TS2307(在 tsc 眼里等于 any)而构建照过 —— 账面绿、类型面无契约,
  // 正是造页器 C6 取用形态判据在编译期丢掉的那一半兜底。
  {
    const declSrc = contents.get(shellTypes.OUT_REL)
    if (declSrc === null || declSrc === undefined) {
      findings.c9.push(`${shellTypes.OUT_REL}:被审面上没有这份派生件 ⇒ 壳承载页在 tsc 里等于 any(跑 node scripts/gen-rn-shell-types.mjs --write)`)
    } else {
      const pageTexts = pageRoutes.map((r) => PAGE_EXTS.map((e) => contents.get(`${MP_SRC}/${r}${e}`)).find((t) => t !== null && t !== undefined) ?? '')
      const targets = [...new Set(shellTypes.specsOfPages(pageTexts).map((s) => shellTypes.targetOfSpecifier(s)).filter(Boolean))]
      let tmap
      try {
        tmap = reader.readMany(targets)
      } catch (error) {
        return { state: 'undetermined', reason: `C9:契约真相源取不到(${String(error?.message ?? error).slice(0, 90)})⇒ 不判`, findings }
      }
      const plan = shellTypes.planDeclarations({ pageTexts, readTarget: (rel) => tmap.get(rel) ?? null })
      for (const u of plan.undetermined) findings.c9.push(`契约无从生成:${u}`)
      if (plan.undetermined.length === 0 && shellTypes.applyBlock(declSrc, plan.next) !== declSrc) {
        findings.c9.push(
          `${shellTypes.OUT_REL}:与面上 ${plan.modules.length} 个说明符不同步 ⇒ 跑 node scripts/gen-rn-shell-types.mjs --write`,
        )
      }
    }
  }

  // C10 功能轴维:承载页可达的 t() 键必须能在**端内生成的词包**里解出来(解 b64 复核 —— 源文件里有不算,
  // 交付物里没有就没有)。立因(2026-10-26 现读):承载页闭包用到的键里有一批只住在
  // `packages/i18n/messages/mobile-rn/*`,端内包取不到 ⇒ 页面上是原始键名(HEAD 面现读 26 条,如
  // `common.gotIt`);此前它们"有字"靠的是把 RN 词包整包内联进每一页(每页 +1.36 MB),那是用体积换文字。
  // 档位 = **差值棘轮**(锚点 = HEAD 面自己的缺键集):那批 RN 词包尚未入库,绝对零容忍就是恒红门(§12e);
  // 只拦"本次把承载页带进来却没补键"这一型。锚点取不到 ⇒ 未判定,不猜也不记绿。
  let c10Stock = 0
  {
    const carrierCount = pageRoutes.filter((r) => {
      const rel = PAGE_EXTS.map((e) => `${MP_SRC}/${r}${e}`).find((x) => contents.get(x) !== null && contents.get(x) !== undefined)
      return rel !== null && rel !== undefined && /@rn-shells\/|@ihui\/rn-app\//.test(String(contents.get(rel)))
    }).length
    if (carrierCount > 0) {
      const carriedMissingOn = (rd) => {
        const zh = rd.readMany([ZH_PACK_REL]).get(ZH_PACK_REL) ?? null
        const remote = rd.readMany([REMOTE_PACK_REL]).get(REMOTE_PACK_REL) ?? null
        if (zh === null || zh === undefined || remote === null || remote === undefined) return { undetermined: `端内词包取不到(${[zh, remote].filter((v) => v === null || v === undefined).length} 份)` }
        let carried
        try {
          carried = carriedKeysFromRepo({
            readBatch: (rels) => rd.readMany(rels),
            listFiles: () => pageRoutes.flatMap((r) => PAGE_EXTS.map((e) => `${MP_SRC}/${r}${e}`)),
          })
        } catch (error) {
          return { undetermined: `闭包取面失败:${String(error?.message ?? error).slice(0, 80)}` }
        }
        const packs = {}
        try {
          packs['zh-CN'] = flattenKeys(decodePackB64(extractStringConst(zh, 'ZH_CN_PACK_B64'), ROOT))
          const enB64 = extractLocaleB64(remote, 'en')
          if (enB64) packs.en = flattenKeys(decodePackB64(enB64, ROOT))
        } catch (error) {
          return { undetermined: `词包解不开:${String(error?.message ?? error).slice(0, 80)}` }
        }
        if (Object.keys(packs).length === 0) return { undetermined: '一件词包都解不开' }
        const miss = new Set()
        for (const [loc, have] of Object.entries(packs)) for (const k of carried.keys) if (!have.has(k)) miss.add(`${loc}::${k}`)
        return { miss, measured: { carriers: carried.carriers.length, files: carried.files.length, keys: carried.keys.size, packs: Object.keys(packs).join(',') } }
      }
      const here = carriedMissingOn(reader)
      if (here.undetermined) {
        findings.c10.push(`承载页 ${carrierCount} 枚,但${here.undetermined} ⇒ 无从判可达键是否补齐,不记绿也不冒红`)
      } else {
        const anchor = carriedMissingOn(makeReader('head'))
        if (anchor.undetermined) {
          return { state: 'undetermined', reason: `C10:HEAD 面锚点${anchor.undetermined} ⇒ 差值棘轮不判,也不记绿`, findings }
        }
        c10Stock = anchor.miss.size
        c10Measured = here.measured
        for (const k of [...here.miss].sort()) {
          if (anchor.miss.has(k)) continue
          const [loc, key] = k.split('::')
          findings.c10.push(`${loc} 包里没有可达键 ${key}(承载页 ${carrierCount} 枚;出路:node scripts/gen-i18n-compressed.mjs)`)
        }
      }
    }
  }
  return {
    state:
      findings.c1.length +
        findings.c2.length +
        findings.c3.length +
        findings.c4.length +
        findings.c5.length +
        findings.c6.length +
        findings.c7.length +
        findings.c8.length +
        findings.c9.length +
        findings.c10.length >
        0
        ? 'red'
        : 'ok',   findings,
    staleIcons,
    staleReuse,
    measured: { rnNames: rnNames.size, exported: exported.size, lucide: lucideTotal, routes: routeEntries.length, shells: shellTargets.size, files: files.length, declared: declaredRoutes.length, pageRoutes: pageRoutes.length, c10: c10Measured, c10Stock },
  }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const cases = selfTestCases()
    let pass = 0
    for (const c of cases) {
      const got = c.got()
      const ok = got === c.want
      console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
      if (ok) pass++
    }
    console.log(pass === cases.length ? `自检 ${pass}/${cases.length} 通过` : `❌ 自检 ${pass}/${cases.length} —— 有例不过`)
    process.exit(pass === cases.length ? 0 : 1)
  }
  const mode = faceFlags(argv)
  const reader = makeReader(mode)
  const r = judge(reader)
  console.log(`rn-compat 覆盖面对账(判定面:${reader.label})`)
  if (r.state === 'undetermined') {
    console.log(`⚠️ 未判定:${r.reason} —— 不记绿也不冒红(§0.3)`)
    process.exit(2)
  }
  const m = r.measured
  console.log(
    `  C1 标识符:消费面取用 ${m.rnNames} 个 / 兼容层出口 ${m.exported} 个 / 缺口 ${r.findings.c1.length}`,
  )
  console.log(`  C2 图标:消费面 ${m.lucide} 个 / 生成物在册 ${m.lucide - r.findings.c2.length} 个 / 缺口 ${r.findings.c2.length} / 生成物残名 ${r.staleIcons.length}(只报数)`)
  console.log(`  C3 路由:映射 ${m.routes} 条 / 指向不在册页 ${r.findings.c3.length} 条`)
  console.log(
    `  C4 结构复用:声明镜像的页 ${m.declared ?? 0} 枚 / 真复用(共享屏或壳)= 本票后应逐轮上涨 / 存量未复用 ${r.staleReuse?.length ?? 0} 枚(只报数) / 本次新违例 ${r.findings.c4.length} 条`,
  )
  console.log(`  C5 壳承载真值:@rn-shells 引用 ${m.shells ?? 0} 条 / 指向不存在的 RN 壳 ${r.findings.c5.length} 条`)
  console.log(`  C6 取用形态:与壳的真导出对不上的页 ${r.findings.c6.length} 条 / C7 桶歧义名 ${r.findings.c7.length} 个`)
  console.log(`  C8 路由↔页配对:在册路由 ${m.pageRoutes ?? 0} 条 / 页文件不在被审面上的 ${r.findings.c8.length} 条`)
  console.log(`  C9 编译期契约:declare 声明件与面上引用不同步 ${r.findings.c9.length} 条`)
  const m10 = m.c10
  console.log(
    `  C10 功能轴词包:${m10 ? `承载页 ${m10.carriers} 枚 / 闭包文件 ${m10.files} 枚 / 可达键 ${m10.keys} 个 / 已核包 ${m10.packs}` : '无承载页(不适用)'} / 本次新增缺键 ${r.findings.c10.length} 条 / HEAD 存量 ${m.c10Stock ?? 0} 条(只报数)`,
  )
  for (const [label, list] of [
    ['C1', r.findings.c1],
    ['C2', r.findings.c2],
    ['C3', r.findings.c3],
    ['C4', r.findings.c4],
    ['C5', r.findings.c5],
    ['C6', r.findings.c6],
    ['C7', r.findings.c7],
    ['C8', r.findings.c8],
    ['C9', r.findings.c9],
    ['C10', r.findings.c10],
  ]) {
    if (list.length > 0) console.log(`❌ ${label} 缺口逐条:${list.join('  ')}`)
  }
  if (r.state === 'red') {
    console.log(
      '出路:C1 在 src/rn-compat 补出口(值或类型位都要补);C2 跑 `node scripts/gen-rn-compat.mjs --write`;C3 同上(路由映射由生成器按现读事实重建);C4 把该页改成承载共享屏/壳(或按造页器的拒则摘页);C5 摘掉指向不存在壳的页(连同 app.config 路由与 registry 行一起摘),或先补出同名 RN 壳;C8 二选一 —— 把这条路由从 app.config 摘掉,或按造页器产出该页(页与路由必须同批落,只落一头就是本维判的形态);C9 跑 `node scripts/gen-rn-shell-types.mjs --write` 重生成 declare 声明件(别手改那份派生件)。禁止为消红放宽判据。',
    )
    process.exit(1)
  }
  console.log('✅ 覆盖对账通过(各维条数见上行;维度条数不在文案里数,数一次过期一次 —— 以代码为准)')
  process.exit(0)
}

/** 自检:用纯判据函数证明"摘掉即翻红"(§22c 同形;夹具不落盘) */
function selfTestCases() {
  // C9 的反控需要一份"与面上引用同步"的 declare 件:这枚登录页没有壳引用 ⇒ 空覆盖面也是一份合法派生件。
  const emptyDecl = shellTypes.planDeclarations({ pageTexts: [], readTarget: () => null }).next
  const base = {
    'packages/app/src/Control.tsx': `import { View, StyleSheet } from 'react-native'\nimport { Heart } from 'lucide-react-native'\n`,
    // 桶必须写成"真桶"形态(星号 + 显式):新语义按桶的有效出口判,并集读法下这份夹具曾经是假的
    [`${COMPAT_DIR}/index.ts`]: `export * from './primitives'\nexport * from './icons-generated'\nexport const StyleSheet = {}\nexport type ViewStyle = unknown\n`,
    [`${COMPAT_DIR}/primitives.tsx`]: `export const View = () => null\nexport const Text = () => null\n`,
    [`${COMPAT_DIR}/icons-generated.tsx`]: `export const Heart = null\n`,
    [`${COMPAT_DIR}/route-map.generated.ts`]: `export const RN_ROUTE_MAP = {\n  'Login': '/pkg-user/login/index',\n}\n`,
    'apps/miniapp-taro/src/app.config.ts': `subPackages: [{ root: 'pkg-user', pages: ['login/index'] }]\n`,
    // C8 的对照面:路由在册的这条必须真有页,否则"覆盖齐 ⇒ ok"这一例判的就不是覆盖齐。
    'apps/miniapp-taro/src/pkg-user/login/index.tsx': `export default function Login() {\n  return null\n}\n`,
    [shellTypes.OUT_REL]: emptyDecl,
  }
  const reader = (overrides) => {
    const face = { ...base, ...overrides }
    return {
      label: '夹具',
      listFiles: () => ['packages/app/src/Control.tsx'],
      readMany: (rels) => new Map(rels.map((r) => [r, face[r] ?? null])),
    }
  }
  return [
    { name: '覆盖齐 ⇒ ok', want: 'ok', got: () => judge(reader({})).state },
    {
      name: 'C1 摘掉 StyleSheet 出口 ⇒ 点名 1 枚',
      want: 1,
      got: () =>
        judge(
          // 只摘 StyleSheet 那一行。新语义下"整条桶只剩一行类型"会把所有星号出口一起抹掉,
          // 那测的就不是 StyleSheet 这一格(两种失效各留各的例)。
          reader({
            [`${COMPAT_DIR}/index.ts`]: String(base[`${COMPAT_DIR}/index.ts`] ?? '')
              .split('\n')
              .filter((l) => !/StyleSheet/.test(l))
              .join('\n'),
          }),
        ).findings.c1.length,
    },
    {
      name: 'C1 并集读法的盲区:桶只剩一行类型时,星号出口一律不在册(摘掉 style 那行的旧读法会顶绿)',
      want: true,
      got: () =>
        judge(reader({ [`${COMPAT_DIR}/index.ts`]: 'export type ViewStyle = unknown\n' })).findings.c1.length > 1,
    },
    {
      name: 'C2 生成物换成别的图标 ⇒ 点名 1 枚',
      want: 1,
      got: () =>
        judge(reader({ [`${COMPAT_DIR}/icons-generated.tsx`]: `export const Star = null\n` })).findings.c2.length,
    },
    {
      name: 'C3 映射指向不在册页 ⇒ 点名 1 条',
      want: 1,
      got: () =>
        judge(
          reader({
            [`${COMPAT_DIR}/route-map.generated.ts`]: `export const RN_ROUTE_MAP = {\n  'Ghost': '/pkg-user/ghost/index',\n}\n`,
          }),
        ).findings.c3.length,
    },
    {
      name: 'C7 桶歧义名:两条 export * 同名且无显式重导出 ⇒ 点名(并集读法会把它当成已覆盖)',
      want: 1,
      got: () => judge(reader(c7Fixture(false))).findings.c7.length,
    },
    {
      name: 'C7 反向对照:桶写了显式重导出压歧义 ⇒ 不判(否则消红无路可走)',
      want: 0,
      got: () => judge(reader(c7Fixture(true))).findings.c7.length,
    },
    {
      name: 'C8 路由在册而页不在面 ⇒ 点名(实测悬空路由型:只插了路由行,页从未进提交)',
      want: 1,
      got: () =>
        judge(reader({ 'apps/miniapp-taro/src/pkg-user/login/index.tsx': null })).findings.c8.filter((x) =>
          x.includes('pkg-user/login/index'),
        ).length,
    },
    {
      name: 'C8 反向对照:页与路由同批在面 ⇒ 不判',
      want: 0,
      got: () => judge(reader({})).findings.c8.length,
    },
    {
      name: 'C8 路由枚举到 0 条 ⇒ 点名不记绿(解析坏掉不能读成"没有缺口")',
      want: 1,
      got: () =>
        judge(reader({ 'apps/miniapp-taro/src/app.config.ts': `subPackages: []\n` })).findings.c8.filter((x) =>
          x.includes('枚举到 0 条'),
        ).length,
    },
    {
      name: 'C9 契约落后:页面新引 @rn-shells/* 而声明件没这一格 ⇒ 点名',
      want: 1,
      got: () =>
        judge(
          reader({
            'apps/miniapp-taro/src/pkg-user/login/index.tsx': `import S from '@rn-shells/LoginScreen'\nexport default function Login() {\n  return null\n}\n`,
            'apps/mobile-rn/src/screens/LoginScreen.tsx': 'export const LoginScreen = () => null\n',
          }),
        ).findings.c9.filter((x) => x.includes('不同步')).length,
    },
    {
      name: 'C9 反向对照:声明件与面上引用逐字同步 ⇒ 不判',
      want: 0,
      got: () => judge(reader({})).findings.c9.length,
    },
    {
      name: 'C9 派生件整份不在面 ⇒ 点名(不得读成"没有壳引用所以没事")',
      want: 1,
      got: () => judge(reader({ [shellTypes.OUT_REL]: null })).findings.c9.filter((x) => x.includes('没有这份派生件')).length,
    },
    {
      name: '生成物不在面 ⇒ 未判定(不记绿)',
      want: 'undetermined',
      got: () =>
        judge({
          label: '夹具',
          listFiles: () => ['packages/app/src/Control.tsx'],
          readMany: (rels) => new Map(rels.map((r) => [r, r === ICONS_REL ? null : (base[r] ?? null)])),
        }).state,
    },
    {
      name: '消费面枚举 0 文件 ⇒ 未判定(不记绿)',
      want: 'undetermined',
      got: () => judge({ label: '夹具', listFiles: () => [], readMany: (rels) => new Map(rels.map((r) => [r, base[r] ?? null])) }).state,
    },
  ]
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  main()
}

export const __test__ = { judge, namedImportsFrom, compatExports, effectiveExports, ownExports, makeReader, faceFlags }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
