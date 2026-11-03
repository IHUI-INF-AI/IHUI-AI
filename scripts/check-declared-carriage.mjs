// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-declared-carriage.mjs — 「声明承载」与「真承载」差集棘轮(2026-11-03 立)。
 *
 * 立因(量出来的,不是推的):登记表声明 256 枚小程序页承载某共享屏,而按 **HEAD blob** 逐页读
 * 值 import 只量到 187 枚真承载 —— 其余 69 枚是端内手写镜像,页面正文只留
 * `// 对齐目标(RN 共享屏): packages/app/src/features/...` 这类**注释**,任何出口都没有 import。
 * 而既有口径全部按声明计数:
 *   · 守门 237 的 `mirroredSpecs` 判"在册 ⇒ 已镜像" ⇒ 驾驶舱报 mirrored=256(把 69 枚算成已对齐);
 *   · 造页器 `gen-miniapp-mirror.mjs:1252` 判"文件已存在且路由在册 ⇒ 不重复造页" ⇒ 这 69 枚
 *     永远不会被派生转成壳页;
 *   · `plan-hand-mirror-conversion` 的"可转=0"数的是另一族(手写页带端内私有能力)。
 * 三者叠起来的效果就是"功能对齐账面好看而实际不齐",且**新增一枚假声明也不会被任何人拦下**。
 * 本门只补那一格:把差集量成机读数,并按差值棘轮只拦"本次把假声明带进来"的那些(§12e:
 * 存量 69 未归零前升绝对零容忍 = 恒红门,唯一结局是逼人 --no-verify 连带废掉全部守门)。
 *
 * 判据(两维,互不并桶):
 *   D1 假声明(declaredNotCarrying) —— registry 里 miniapp 页存在、且该页 HEAD blob
 *      **不含** `@rn-shells/<屏名>` 的值 import(型边不算:import type 会过报,踩过一次)。
 *   D2 页面查无(declaredButPageMissing) —— registry 声明的 miniapp 页文件在 HEAD 面上不存在。
 * 档位:D1/D2 按**被审面的 registry 自身**做差值棘轮 —— 锚点 = 同一判据在被审面基线(HEAD 或索引父面)
 *      的条数;只拦"本次审面比基线多出"的那几枚,存量逐条报数不判红。
 *
 * 取材面纪律(§0.4):默认判 **HEAD blob**;`--staged` 判**索引 blob**;`--worktree` 仅人工逃生舱。
 * 清单与内容同面同轮;取不到 ⇒ exit 2 显式「未判定」并点名原因,不记绿也不冒红(§0.3)。
 * registry 枚举到 0 条 ⇒ 判死,不冒充"全部对齐"。
 *
 * 用法:node scripts/check-declared-carriage.mjs [--json|--gate|--staged|--worktree|--self-test]
 * 退出码:0 在闸内 · 1 差值维新增(有枚数被判红) · 2 未判定/用法错
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_REL = 'scripts/data/cross-end-screen-registry.json'
/** 承载形态唯一判据:值 import 一枚 `@rn-shells/<屏名>`(不是注释、不是 import type)。 */
const SHELL_IMPORT_RE =
  /(?:^|\n)\s*import\s+(?!type\s)[^;]*?from\s+['"]@rn-shells\/([A-Za-z0-9_]+)['"]/g

const git = (args, faceRoot = ROOT) =>
  execFileSync('git', args, {
    cwd: faceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 26,
    // §5b:本机任何派生进程都必须显式 windowsHide —— 漏这一行在守护/计划任务(无桌面会话)下
    // 必弹控制台窗,由 blocking 门 52 check-no-visible-spawn 判红(本枚就是被它抓出来的)。
    windowsHide: true,
  })

/** 被审面的 ref/旗形制:head=HEAD 树 / staged=索引(--cached) / worktree=磁盘(无 rev)。 */
const FACE_ARGS = {
  head: { rev: 'HEAD', grepExtra: [] },
  staged: { rev: null, grepExtra: ['--cached'] },
  worktree: { rev: null, grepExtra: [] },
}
const MP_SRC = 'apps/miniapp-taro/src'

/**
 * 判定(批量档:整面只起 3 次 git,不逐页起进程)。
 *
 * 为什么要重写第一版:第一版逐页 `git show`,实测整轮 21.5s —— 而"慢"本身就是逼人跳门的成因
 * (§12e:与提交内容无关的负担,唯一结局是 --no-verify 连带废掉全部守门)。本档把
 * 存在性与引用各压成一次 plumbing(`ls-tree` + `git grep`),同面同轮仍是同一把尺。
 *
 * 活性闸:declared>0 而 carried=0 ⇒ 判「未判定」而不是"69 枚假声明" ——
 * 一把读不到正例的尺没有资格出否定结论(本仓实测过两次把形状错读成"该端缺失")。
 */
export function judge(face) {
  const cfg = FACE_ARGS[face]
  if (!cfg) return { error: `未知判定面 ${face}` }
  let regText
  try {
    regText = git(['show', `${cfg.rev ? cfg.rev + ':' : ':'}${REGISTRY_REL}`])
  } catch {
    try {
      regText = readFileSync(join(ROOT, REGISTRY_REL), 'utf8')
      if (face !== 'worktree')
        return { error: `${face} 面取不到 ${REGISTRY_REL}(不回落磁盘面凑数,§0.4)` }
    } catch (e) {
      return { error: `${face} 面取不到 ${REGISTRY_REL}(${String(e).slice(0, 80)})` }
    }
  }
  const pairs = declaredPairs(regText)
  if (pairs === null) return { error: `${REGISTRY_REL} 不是合法 JSON(不回落另一个面)` }
  if (pairs.length === 0)
    return { error: `${face} 面 registry 声明枚举到 0 条 ⇒ 判死,不冒充"全部对齐"` }

  // ① 存在性:一次 ls-tree 拿整目录在册路径
  let present = new Set()
  try {
    const treeRef = cfg.rev ?? ''
    const args = ['ls-tree', '-r', '--name-only', ...(treeRef ? [treeRef] : []), '--', MP_SRC]
    present = new Set(
      git(args)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
  } catch (e) {
    return { error: `${face} 面 ls-tree 取不到(${String(e).slice(0, 80)})` }
  }

  // ② 引用:一次 git grep 拿整面 @rn-shells/ 的值 import
  const importsByPath = new Map()
  try {
    const args = [
      'grep',
      '-n',
      '--fixed-strings',
      '-e',
      '@rn-shells/',
      ...cfg.grepExtra,
      ...(cfg.rev ? [cfg.rev] : []),
      '--',
      MP_SRC,
    ]
    for (const line of git(args).split(/\r?\n/)) {
      if (!line.trim()) continue
      // 形态 <rev?>:<path>:<lineno>:<正文>;path 里可能含冒号目录,故按"第一个 :<数字>:"切
      const m = /^(?:HEAD:)?(.+?):(\d+):(.*)$/.exec(line)
      if (!m) continue
      const [, path, , body] = m
      // import type 不算(型边过报那一型);只有真的把壳当值 import 进来才算承载
      if (/^\s*import\s+type\s/.test(body)) continue
      const names = [...body.matchAll(/@rn-shells\/([A-Za-z0-9_]+)/g)].map((x) => x[1])
      if (!names.length) continue
      const set = importsByPath.get(path) || new Set()
      for (const n of names) set.add(n)
      importsByPath.set(path, set)
    }
  } catch (e) {
    // git grep 无命中时退 1 —— 那是"量到了零引用",与"尺子坏了"必须分开判
    if (!/exit status 1/.test(String(e?.message ?? e)))
      return { error: `${face} 面 git grep 取不到(${String(e).slice(0, 80)})` }
  }

  const out = classify(pairs, present, importsByPath)
  if (out.carried === 0)
    return {
      error:
        `${face} 面 declared=${pairs.length} 而真承载读到 0 ⇒ 阳性对照不成立,` +
        '本尺形状失效(不得据此判"全部未承载");请核对 @rn-shells 别名与 ls-tree/grep 射程',
    }
  return { ...out, face }
}

export function screenOf(pathLike) {
  return String(pathLike || '')
    .split('/')
    .pop()
    .replace(/\.tsx?$/, '')
}

/** 一页是否**真的**把那枚壳当值 import 进来。 */
export function pageCarriesShell(pageText, screenName) {
  if (typeof pageText !== 'string' || !screenName) return false
  for (const m of pageText.matchAll(SHELL_IMPORT_RE)) if (m[1] === screenName) return true
  return false
}

/** registry 文本 → 声明三元组清单(只收同时有 miniapp 与 shared/rn 的行)。 */
export function declaredPairs(registryText) {
  let parsed
  try {
    parsed = JSON.parse(registryText)
  } catch {
    return null
  }
  const entries = Array.isArray(parsed) ? parsed : parsed.entries || parsed.screens || []
  if (!entries.length) return []
  const out = []
  for (const e of entries) {
    if (!e || !e.miniapp) continue
    const sharedSrc = e.shared || e.rn
    if (!sharedSrc) continue
    out.push({ miniapp: String(e.miniapp), screen: screenOf(sharedSrc), shared: String(sharedSrc) })
  }
  return out
}

/**
 * 纯判定核(零 git、零磁盘 ⇒ 自检直接打):声明三元组 + 存在集 + 引用集 → 两桶 + 真承载计数。
 * 身份键 = `miniapp 路由 → 声明承载的屏名`,与行文本无关(改写注释/换行都不改变判定)。
 */
export function classify(pairs, present, importsByPath) {
  const falseDeclared = []
  const missingPage = []
  let carried = 0
  for (const p of pairs) {
    const rel = `${MP_SRC}/${p.miniapp}.tsx`
    if (!present.has(rel)) {
      missingPage.push(`${p.miniapp}→${p.screen}`)
      continue
    }
    if (importsByPath.get(rel)?.has(p.screen)) carried += 1
    else falseDeclared.push(`${p.miniapp}→${p.screen}`)
  }
  return { declared: pairs.length, carried, falseDeclared, missingPage }
}

/**
 * 差值棘轮:审面条数 vs 基线(HEAD)条数,逐**身份键**比集合 —— 只把"基线没有而审面新增"的枚数判红。
 * 基线取不到 ⇒ 未判定(不拿 0 冒充"基线干净",§0.3)。
 */
export function ratchet(current, baseline) {
  if (baseline.error) return { ok: false, state: 'unjudged', why: baseline.error }
  const bSet = new Set([...baseline.falseDeclared, ...baseline.missingPage])
  const grown = [...current.falseDeclared, ...current.missingPage].filter((k) => !bSet.has(k))
  return {
    ok: grown.length === 0,
    state: grown.length === 0 ? 'in-gate' : 'regressed',
    grown,
    shrunk: [...bSet].filter(
      (k) => ![...current.falseDeclared, ...current.missingPage].includes(k),
    ),
  }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const json = argv.includes('--json')
  const gate = argv.includes('--gate')
  const faces = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (faces.length > 1) {
    console.error('❌ --staged 与 --worktree 不得同给(两面同给当场 exit 2)')
    return 2
  }
  const face = faces.length ? faces[0].slice(2) : 'head'
  const cur = judge(face)
  if (cur.error) {
    console.error(`❌ 未判定:${cur.error}`)
    return 2
  }
  // 判 HEAD 时基线与审面同面 ⇒ 差值恒 0(本门只拦"索引里新带进来的"),这是有意的同面自证。
  const base = face === 'head' ? cur : judge('head')
  if (base.error) {
    console.error(`❌ 未判定:基线(HEAD 面)取不到 —— ${base.error}`)
    return 2
  }
  const r = ratchet(cur, base)

  const line =
    `DECLARED-CARRIAGE face=${face} declared=${cur.declared} carried=${cur.carried}` +
    ` 假声明=${cur.falseDeclared.length}(基线 ${base.error ? '?' : base.falseDeclared.length})` +
    ` 页面查无=${cur.missingPage.length}(基线 ${base.error ? '?' : base.missingPage.length})` +
    ` 新增=${r.grown?.length ?? '?'}` +
    ` state=${r.state ?? 'unjudged'}`
  if (json)
    console.log(
      JSON.stringify(
        { face, ...cur, baseline: base.error ? { error: base.error } : base, ratchet: r },
        null,
        2,
      ),
    )
  else {
    console.log(`📏 声明承载 vs 真承载(判定面=${face} blob;值 import 才算,注释与 import type 不算)`)
    console.log(line)
    if (r.state === 'regressed')
      for (const g of r.grown.slice(0, 12)) console.log(`  ✗ 新增假声明:${g}`)
    if (r.shrunk?.length)
      console.log(`  ⓘ 相对基线少了 ${r.shrunk.length} 枚(真转成壳页了 ⇒ 好方向,不判红)`)
    if (cur.falseDeclared.length)
      console.log(
        `  ⓘ 存量 ${cur.falseDeclared.length} 枚只报数:它们是端内手写镜像,出路在造页器转承载而非消红`,
      )
  }
  if (gate || argv.length === 0 || faces.length)
    return r.state === 'in-gate' ? 0 : r.state === 'unjudged' ? 2 : 1
  return r.state === 'in-gate' ? 0 : 1
}

/** 纯内存自检:正反对照都必须由同一把尺判出(否定结论不得靠"没命中"冒充)。 */
function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push({ name, cond })
  const shell =
    "import ThemeRoot from '@/components/ThemeRoot'\nimport { WalletScreen as WalletScreenShell } from '@rn-shells/WalletScreen'\nexport default function P() { return null }\n"
  const hand =
    "// 对齐目标(RN 共享屏): packages/app/src/features/wallet/WalletScreen.tsx\nimport ThemeRoot from '@/components/ThemeRoot'\nexport default function P() { return null }\n"
  const typedOnly =
    "import type { WalletScreen as T } from '@rn-shells/WalletScreen'\nexport default function P() { return null }\n"
  ok('① 值 import 判为真承载', pageCarriesShell(shell, 'WalletScreen') === true)
  ok('② 注释不算承载(反向对照,不得过报)', pageCarriesShell(hand, 'WalletScreen') === false)
  ok(
    '③ import type 不算承载(型边过报那一型)',
    pageCarriesShell(typedOnly, 'WalletScreen') === false,
  )
  const reg = JSON.stringify({
    entries: [
      {
        shared: 'packages/app/src/features/wallet/WalletScreen.tsx',
        rn: 'apps/mobile-rn/src/screens/WalletScreen.tsx',
        miniapp: 'pkg-shop/wallet/index',
      },
      {
        shared: 'packages/app/src/features/vip/VipScreen.tsx',
        rn: 'apps/mobile-rn/src/screens/VipScreen.tsx',
        miniapp: 'pages/member/index',
      },
      {
        shared: 'packages/app/src/features/gone/GoneScreen.tsx',
        rn: 'apps/mobile-rn/src/screens/GoneScreen.tsx',
        miniapp: 'pkg-x/gone/index',
      },
    ],
  })
  const pairs = declaredPairs(reg)
  const present = new Set([
    'apps/miniapp-taro/src/pkg-shop/wallet/index.tsx',
    'apps/miniapp-taro/src/pages/member/index.tsx',
  ])
  const imports = new Map([
    ['apps/miniapp-taro/src/pkg-shop/wallet/index.tsx', new Set(['WalletScreen'])],
  ])
  const j = classify(pairs, present, imports)
  ok(
    '④ 三行声明:真承载 1 / 假声明 1 / 页面查无 1',
    j.declared === 3 &&
      j.carried === 1 &&
      j.falseDeclared.length === 1 &&
      j.missingPage.length === 1,
  )
  ok('⑤ 身份键含屏名(串档不得混)', j.falseDeclared[0] === 'pages/member/index→VipScreen')
  const grown = ratchet(j, { declared: 3, carried: 2, falseDeclared: [], missingPage: [] })
  ok('⑥ 基线没有而审面有 ⇒ 判新增', grown.state === 'regressed' && grown.grown.length === 2)
  const same = ratchet(j, j)
  ok('⑦ 同面自证差值恒 0', same.state === 'in-gate' && same.grown.length === 0)
  const improved = ratchet(
    { declared: 3, carried: 2, falseDeclared: ['pages/member/index→VipScreen'], missingPage: [] },
    j,
  )
  ok('⑧ 存量减少记好方向不判红', improved.state === 'in-gate' && improved.shrunk.length === 1)
  ok(
    '⑨ 坏 JSON ⇒ declaredPairs 归 null(调用方按未判定收,不回落另一个面)',
    declaredPairs('{坏 json') === null,
  )
  ok(
    '⑩ 空 entries ⇒ 0 条(由 judge 判死,不冒充全对齐)',
    declaredPairs('{"entries":[]}').length === 0,
  )
  ok('⑪ 未知判定面 ⇒ 未判定', !!judge('--nope').error)
  // 阳性对照闸:一把读不出任何真承载的尺没有资格出否定结论(judge 里 carried=0 ⇒ error)
  ok(
    '⑫ 全表无引用时 classify 只报 0,判定权留给活性闸',
    classify(pairs, present, new Map()).carried === 0,
  )
  ok(
    '⑬ 批量档与逐页档同一把尺(逐页判据仍可用)',
    pageCarriesShell(shell, 'WalletScreen') && !pageCarriesShell(hand, 'WalletScreen'),
  )
  for (const c of checks) console.log(`${c.cond ? '✅' : '🔴'} ${c.name}`)
  const failed = checks.filter((c) => !c.cond).length
  console.log(`自检 ${checks.length - failed}/${checks.length}`)
  return failed ? 1 : 0
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main()
}

export const __test__ = {
  pageCarriesShell,
  declaredPairs,
  screenOf,
  classify,
  judge,
  ratchet,
  REGISTRY_REL,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
