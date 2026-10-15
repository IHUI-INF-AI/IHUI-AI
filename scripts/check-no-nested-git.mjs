#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * © 2026 智汇AI · 守门 208 —— 工作区嵌套 git 仓零容忍(blocking)
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 立门因由(2026-10-14 幻影仓事故,机主令「彻底根治杜绝再发生」):
 *
 *   scripts/tests/check-watermark-syntax.test.mjs 曾把 52 个 `git init` 演练仓
 *   建在仓库内 `.ihui-agent/tmp/wm-syntax/` 且无任何清理钩子,中断即永久残留。
 *   Trae/VSCode 的源代码管理面板把这些嵌套仓当独立仓库扫描,工作树与 index 漂移
 *   后聚合出「暂存的更改 10000+(全 D)」的幻影计数 —— 机主一度以为有上万未提交
 *   更改,而主仓 git 命令行面自始至终干净。全量清理见同日清理批。
 *
 * 本门的立场:
 *   - 仓库工作树内出现**任何**嵌套 .git(目录或 gitfile 形态)一律红,不设豁免
 *     清单 —— 现状存量 0,棘轮从 0 开始,只减不增。
 *   - 两处属"判据射程之外"而非豁免:仓库根本体自己的 .git;扫根直属子目录里的
 *     `.worktrees`(AGENTS §12d 规定的 worktree 落点,linked worktree 天然带 .git
 *     gitfile —— 把它判红就是 §12e 禁止的恒红门:有人照规矩开 worktree,此后所有
 *     无关提交都被拦)。同名目录出现在更深位置照旧命中。
 *   - node_modules/.pnpm 子树整枝剪除(第三方包结构,非本仓产物)。
 *   - symlink / reparse point 不穿透(pnpm 结构防循环,同 scratch-dir §防嵌套)。
 *   - 枚举有界(深度/条目预算),超限按「未判完」处理 → 红:没判完不能出合格证。
 *
 * 处置指引(命中时打印):
 *   1) 演练/测试夹具仓 → 若内容无留存价值,直接删目录或摘 .git(文件保留);
 *      若是测试基建,夹具落点必须改走 scripts/lib/scratch-dir.mjs 的 mkScratch()
 *      (工作区外 + 进程退出自动回收,见 §26 scratch 唯一出口)。
 *   2) 确属需要仓库内嵌套仓的合法场景 → 不许静默豁免,须在本文件加显式白名单
 *      常量 + 注释说明因由 + §22c 镜像测试对账,评审后入库。
 *
 * §22d 合规:isDirectRun 守卫 + __test__ 纯函数导出(镜像测试走 __test__)。
 * ══════════════════════════════════════════════════════════════════════════
 *
 * provenance: 7ab6f29e01c4b3d58a2f1e9c04d76b35a8e2c9f1d4b7a6e3c8f5d2b1a9e4c7f0
 */
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_LABEL = '[check-no-nested-git]'
/** 具名豁免台账(§0.7「验过才免、会到期」的落地形态)。缺文件/坏 JSON ⇒ 不放行任何豁免。 */
const EXEMPTION_FILE = join(REPO_ROOT, 'scripts', 'data', 'no-nested-git-exemptions.json')

/** 仓库根 .git 本体(本仓挂载,gitfile)按精确路径豁免 —— 其余任何 .git 命中即红。 */
export function isRepoRootGit(absPath, repoRoot = REPO_ROOT) {
  return resolve(absPath) === resolve(join(repoRoot, '.git'))
}

/** 剪枝目录名:第三方依赖子树与构建产物,非本仓产物,不扫。 */
const PRUNED_DIRS = new Set(['node_modules', '.pnpm', '.venv', 'venv', '__pycache__'])

/**
 * 合法落点(仅扫根的直属子目录):AGENTS §12d 规定并行会话 worktree 一律检出在仓库内
 * `.worktrees/wt-<任务名>`,而 linked worktree 天然带 `.git` gitfile —— 那是规定动作,
 * 不是幻影仓。放宽只到这一格、只在顶层:同名目录出现在更深位置照旧命中。
 * 不这么做的后果是 §12e 禁止的恒红门:有人照规矩开一个 worktree,此后所有无关提交都被拦。
 */
const SANCTIONED_LANDINGS = new Set(['.worktrees'])

/** 目录串归一(斜杠方向 / 前导 ./ / 尾斜杠),豁免按**逐字等值**比对,不做前缀、不做同名。 */
function normRel(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 读具名豁免台账。返回 `{entries, error}`:
 *  文件缺/坏 JSON ⇒ `error` 非空且 `entries=[]` —— **不放行任何豁免**(取不到输入绝不冒绿,§0.3),
 *  形态不合格的条目(缺 owner / 缺 why / 到期日不是 YYYY-MM-DD)整条作废并单独点名。
 */
export function loadNamedExemptions(file = EXEMPTION_FILE) {
  if (!existsSync(file)) return { entries: [], error: `台账文件不存在:${file}` }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    return { entries: [], error: `台账坏 JSON(${e.message})` }
  }
  const list = Array.isArray(parsed?.entries) ? parsed.entries : null
  if (!list) return { entries: [], error: '台账缺 entries 数组' }
  const bad = []
  const entries = []
  for (const e of list) {
    const okShape =
      e && typeof e.rel === 'string' && normRel(e.rel) !== '' && typeof e.owner === 'string' &&
      e.owner.trim() !== '' && typeof e.why === 'string' && e.why.trim() !== '' &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(e.expires ?? ''))
    if (okShape) entries.push({ ...e, rel: normRel(e.rel) })
    else bad.push(String(e?.rel ?? '(无 rel)'))
  }
  return { entries, error: '', bad }
}

/**
 * 按台账把 hits 分成「仍判红 / 具名放行」两堆,并另算**腐烂**(§0.7:已登记的豁免在审面不再命中 ⇒ 清单腐烂判红)。
 * 判据要点(都是为了让这条出口不能被滥用):
 *  · 只有**容器目录 rel 与台账条目逐字等值**才免;更深位置、同名别处、前缀相似一律照旧红;
 *  · 到期(ISO 字典序比较)⇒ 不免,并点名"需重新 ack";
 *  · 台账读不到 ⇒ 传入 entries=[] 即可,效果是零放行(严档)。
 */
export function splitByExemption(hits, entries, today = isoToday()) {
  const reported = []
  const exempted = []
  const matched = new Set()
  for (const h of hits) {
    const segs = String(h.rel).split(/[\\/]/).filter(Boolean)
    const container = segs.slice(0, -1).join('/')
    const e = entries.find((x) => x.rel === container)
    if (!e) {
      reported.push(h)
      continue
    }
    if (e.expires < today) {
      reported.push({ ...h, exemptWhy: `具名豁免已到期(${e.expires})⇒ 需重新 ack` })
      continue
    }
    matched.add(e.rel)
    exempted.push({ ...h, entry: e })
  }
  const stale = entries.filter((e) => !matched.has(e.rel))
  return { reported, exempted, stale }
}

/**
 * 有界枚举仓库树,收集一切名为 `.git` 的 entry(目录或 gitfile)。
 * 纯函数(除 fs 读取),镜像测试直接以 __test__.scanForNestedGit 调用。
 *
 * @param {string} root       扫描根(生产=REPO_ROOT;测试=夹具目录)
 * @param {object} [opts]
 * @param {number} [opts.maxDepth=10]       目录深度上限
 * @param {number} [opts.entryBudget=200000] readdir 条目总预算(防超大树拖垮 pre-commit;
 *                                           2026-10-14 实测现树 ~64k 条目,3 倍余量)
 * @returns {{hits: {path:string, rel:string, isDir:boolean}[], scanned:number,
 *            truncated:boolean, unreadable:string[], skippedReparse:number}}
 */
export function scanForNestedGit(root, opts = {}) {
  const maxDepth = opts.maxDepth ?? 10
  const entryBudget = opts.entryBudget ?? 200000
  const hits = []
  const unreadable = []
  let scanned = 0
  let truncated = false
  let skippedReparse = 0

  const walk = (dir, depth) => {
    if (truncated || depth > maxDepth) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      unreadable.push(dir)
      return
    }
    for (const e of entries) {
      scanned++
      if (scanned > entryBudget) {
        truncated = true
        return
      }
      const abs = join(dir, e.name)
      // entry 命中:.git 目录或 .git gitfile。仓库根本体已在扫描范围外(从子树起扫),
      // 但夹具测试可能把 root 本身的 .git 传进来 —— 统一按精确路径豁免。
      if (e.name === '.git' && !isRepoRootGit(abs, root)) {
        let isDir = false
        try {
          isDir = statSync(abs).isDirectory()
        } catch {
          isDir = false
        }
        hits.push({ path: abs, rel: relative(root, abs), isDir })
        continue // .git 内部不扫(无论命中哪型)
      }
      if (e.isDirectory() || e.isSymbolicLink()) {
        if (e.isDirectory() && PRUNED_DIRS.has(e.name)) continue
        if (e.isDirectory() && depth === 1 && SANCTIONED_LANDINGS.has(e.name)) continue
        // Windows 陷阱:junction 在 scandir dirent 报 directory、lstat 才报 symlink ——
        // 必须按 lstat 统一判别,否则 junction 被当真目录穿透(还可能循环引用拖死扫描)。
        let st
        try {
          st = lstatSync(abs)
        } catch {
          unreadable.push(abs)
          continue
        }
        if (st.isSymbolicLink()) {
          skippedReparse++
          continue
        }
        if (st.isDirectory()) walk(abs, depth + 1)
      }
      // 文件(非 .git)无需处理;.git gitfile 已在上方命中
    }
  }

  walk(root, 1)
  return { hits, scanned, truncated, unreadable, skippedReparse }
}

/**
 * 判决纯函数:hits 非空 或 truncated(未判完) ⇒ 红。
 * unreadable 单条不红(权限噪音),但如实透出供人复核。
 *
 * `opts.entries` 给出具名豁免台账条目时,按 `splitByExemption` 把命中分成两堆:
 * 只有**逐字等值容器目录 + 形态合格 + 未到期**那几条被放行,放行结果一并回传给调用方大声打印
 * (§0.7 不许静默豁免)。不传 entries ⇒ 行为与加装豁免之前**逐字相同**(既有调用方/测试不受影响)。
 * `opts.checkStale` 只在扫的是仓库根本体时为真:那才有资格判「台账里的条目已无命中 ⇒ 清单腐烂」。
 */
export function evaluateResult(scan, opts = {}) {
  const entries = opts.entries ?? []
  const checkStale = opts.checkStale === true
  const split = splitByExemption(scan.hits, entries, opts.today ?? isoToday())
  const reasons = split.reported.map(
    (h) =>
      `${h.isDir ? '嵌套 .git 目录' : '嵌套 .git(gitfile)'}: ${h.path}` +
      (h.exemptWhy ? ` —— ${h.exemptWhy}` : '')
  )
  if (checkStale) {
    for (const s of split.stale) {
      reasons.push(
        `具名豁免腐烂:台账里的「${s.rel}」本次审面已无命中 ⇒ 清单腐烂判红(§0.7:豁免必须随现场一起销,不许留在册上等人猜它还在不在)`
      )
    }
  }
  if (scan.truncated) {
    reasons.push(
      '扫描超预算未判完(truncated) —— 没判完不能出合格证:用 --root 指到更小子树分段复跑,定位到命中段即为真凶'
    )
  }
  return {
    ok: reasons.length === 0,
    reasons,
    exempted: split.exempted,
    stale: split.stale,
  }
}

/** CLI 主体:返回进程退出码。 */
export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info('用法: node scripts/check-no-nested-git.mjs [--root <目录>]')
    console.info('守门 208(blocking): 仓库工作树内出现任何嵌套 .git(目录/gitfile)即红。')
    console.info('  --root <目录>  扫描根(默认仓库根;测试/演练可显式指定)')
    return 0
  }
  let root = REPO_ROOT
  const ri = argv.indexOf('--root')
  if (ri !== -1 && argv[ri + 1]) root = resolve(argv[ri + 1])

  const scan = scanForNestedGit(root)
  const ledger = loadNamedExemptions()
  const verdict = evaluateResult(scan, {
    entries: ledger.entries,
    checkStale: resolve(root) === REPO_ROOT,
  })
  if (ledger.error && scan.hits.length > 0) {
    verdict.reasons.push(
      `具名豁免台账不可用(${ledger.error})⇒ 本轮零放行:上面的命中一条也不许被当作"已豁免"`
    )
    verdict.ok = false
  }
  if (ledger.bad && ledger.bad.length > 0) {
    verdict.reasons.push(
      `具名豁免条目形态不合格 ${ledger.bad.length} 条(缺 owner/why 或到期日不是 YYYY-MM-DD)⇒ 整条作废:${ledger.bad.join(', ')}`
    )
    verdict.ok = false
  }

  if (verdict.ok) {
    console.info(
      `${GATE_LABEL} ✅ 工作树内嵌套 git 仓 = 0(扫描 ${scan.scanned} 条目,` +
        `symlink 跳过 ${scan.skippedReparse},unreadable ${scan.unreadable.length}` +
        `${verdict.exempted.length ? `,具名放行 ${verdict.exempted.length} 处(逐条见下)` : ''})`
    )
    for (const x of verdict.exempted) {
      console.info(
        `   🪪 具名豁免:${x.entry.rel} —— 归属 ${x.entry.owner};因由 ${x.entry.why};到期 ${x.entry.expires}(过期即判红)`
      )
    }
    if (ledger.error) {
      console.warn(`${GATE_LABEL} ⚠ 具名豁免台账不可用(${ledger.error});本轮无命中故不影响结论,但下次有命中时将零放行`)
    }
    return 0
  }

  console.error(`${GATE_LABEL} ❌ 工作树内出现嵌套 git 仓 —— 守门 208 红(blocking):`)
  for (const r of verdict.reasons) console.error(`  - ${r}`)
  if (verdict.exempted.length) {
    console.error(`  ℹ 另有 ${verdict.exempted.length} 处已被具名豁免放行(仍逐条列出,不静默):`)
    for (const x of verdict.exempted) {
      console.error(
        `     - ${x.entry.rel} —— 归属 ${x.entry.owner};因由 ${x.entry.why};到期 ${x.entry.expires}`
      )
    }
  }
  if (scan.unreadable.length) {
    console.error(`  (unreadable ${scan.unreadable.length} 处,未穿透复核: ${scan.unreadable.slice(0, 5).join(', ')}${scan.unreadable.length > 5 ? ' …' : ''})`)
  }
  console.error('  处置: 演练/夹具仓 → 删目录或摘 .git;测试基建 → 落点改 scripts/lib/scratch-dir.mjs mkScratch()。')
  console.error(
    `  确属长期合法的在飞现场 → 走具名台账 scripts/data/no-nested-git-exemptions.json(必须带 owner + why + YYYY-MM-DD 到期日;逐字等值容器目录才免,到期自动翻红,条目失去命中按清单腐烂判红)。`
  )
  console.error('  因由: 嵌套仓被 IDE 源代码管理当独立仓库扫描,聚合出「暂存更改 10000+ 全 D」幻影计数(2026-10-14 事故)。')
  return 1
}

/** §22d 镜像测试入口:判据纯函数统一从 __test__ 取用。 */
export const __test__ = {
  scanForNestedGit,
  evaluateResult,
  isRepoRootGit,
  loadNamedExemptions,
  splitByExemption,
  normRel,
}

/** §22d 直接运行守卫:被 import(镜像测试/编排器)时不自跑。 */
const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((err) => {
    console.error(`${GATE_LABEL} 异常:`, err)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
