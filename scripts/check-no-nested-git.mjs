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
 *   - 仓库工作树内出现**任何**嵌套 .git(目录或 gitfile 形态)一律红;豁免只有一条出口:
 *     具名台账 `scripts/data/no-nested-git-exemptions.json`(§0.7「验过才免、会到期」)—— 逐字等值的
 *     容器目录 + owner + why + YYYY-MM-DD 到期日三要素齐备才放行,门逐条打印放行现场;
 *     **条目失去命中 ⇒ 按清单腐烂判红**,此时正确处置是随现场把条目摘掉(2026-10-18 实测:三条登记
 *     的目录都已消失,门因此 blocking 红并拦住所有人的提交链,摘册后复跑 RC=0)。
 *     现状存量 0,棘轮从 0 开始,只减不增。
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
 *   2) 确属需要仓库内嵌套仓的合法场景 → 不许静默豁免,也不许往本文件加常量
 *      (白名单只有一处真相:具名台账 `scripts/data/no-nested-git-exemptions.json`,带 owner/why/
 *      到期日;到期或失去命中都自动翻红)。
 *
 * §22d 合规:isDirectRun 守卫 + __test__ 纯函数导出(镜像测试走 __test__)。
 *
 * ── 判定面现状(2026-10-27 登记,刀二**未装车**)────────────────────────────
 *   本门**尚无 §0.4 的三面档**:全量档与 `--staged` 读的是同一个工作树磁盘面
 *   (扫描走 readdirSync、两本台账走 readFileSync)。`--staged` 由 guardian-runner
 *   统一追加,本门收下但**不改变判定面**;两面旗同给(`--staged --worktree`)判死
 *   (exit 2 未判定),这是本枚先把"静默吞旗标"改成"如实声明"的那一半。
 *   为什么面档不接(实测,取证 .ihui-agent/tmp/nested-gate-face-chair/face-sim.mjs):
 *     · 嵌套 .git 是**未跟踪的磁盘现场**(本机三处现场全被 .gitignore 覆盖:
 *       .trae-cn/ = :38、.ihui-agent/* = :182、outputs/* = :546),HEAD/索引树里没有
 *       任何可命中形态(gitlink 现读 0 枚)⇒ 严格按被审面枚举命中 = 本门对 2026-10-14
 *       那一型彻底失明(削判据,禁止)。
 *     · 只把两本台账换成被审面,则 HEAD 面台账现读 2 条 `.trae-cn/tmp/*-fork`,其容器
 *       在任何被审面上结构上不可能存在 ⇒「清单腐烂判红」那一支变成**恒真**红 ⇒
 *       存量未归零就 blocking = §12e 禁止的恒红门(接上去拦的是所有人的提交)。
 *   ⇒ 正解次序:先按刀一把"载体误用"点名并给出改登行式载体的出口,等 HEAD 面那两条
 *     恒红条目经一次带说明的提交摘干净(存量归零),再由主席接面档(方案见交付报告)。
 *
 * ── 刀一:JSON 具名台账的「载体误用」档(2026-10-27 立;只解释红,不消红)──────
 *   `flagCarrierMisuse` 在装载台账时现读:某条 rel 若被 .gitignore 规则覆盖,它就永远
 *   不可能出现在 HEAD blob / 索引 blob / CI 干净检出面上。而 JSON 具名台账的语义是
 *   §0.7「已登记的豁免若被审面不再命中 ⇒ 清单腐烂**判红**」—— 对这种条目该支恒真,
 *   于是"条目在册"本身就是一把恒红门(实测:入库枚 173381c761 自称消 CI 全量档红,
 *   效果相反 —— 本地转绿、CI 转红)。对照第二把载体(行式 `no-nested-git-sites.jsonl`):
 *   同一型"只存在于机主本机"的现场在那里只打 ⚠ 不清红。**红还是 ⚠ 纯由载体决定,
 *   不由现场决定** ⇒ 这一档的职责是把选错载体这件事点名,并给出出口(改登行式载体)。
 *   三条锁(镜像测试逐条钉住):① 不改任何归属桶 —— 命中该放的照样放、该红的照样红;
 *   ② 不降级「清单腐烂」那一支的红(只在原句**后面**追加病因与出路);
 *   ③ `git check-ignore` 问不出结论 ⇒ 该档本轮「未判定」并点名,既不据此加红也不据此降级。
 *
 * ══════════════════════════════════════════════════════════════════════════
 *
 * provenance: 7ab6f29e01c4b3d58a2f1e9c04d76b35a8e2c9f1d4b7a6e3c8f5d2b1a9e4c7f0
 */
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'
import { gitRaw } from './lib/face-reader.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_LABEL = '[check-no-nested-git]'
/** 具名豁免台账(§0.7「验过才免、会到期」的落地形态)。缺文件/坏 JSON ⇒ 不放行任何豁免。 */
const EXEMPTION_FILE = join(REPO_ROOT, 'scripts', 'data', 'no-nested-git-exemptions.json')
/** 第二把载体:每处现场一行的**意图**登记(不记存续,存续由本门现算)。 */
const SITES_FILE = join(REPO_ROOT, 'scripts', 'data', 'no-nested-git-sites.jsonl')

/** 仓库根 .git 本体(本仓挂载,gitfile)按精确路径豁免 —— 其余任何 .git 命中即红。 */
export function isRepoRootGit(absPath, repoRoot = REPO_ROOT) {
  return resolve(absPath) === resolve(join(repoRoot, '.git'))
}

/** 路径串归一(反斜杠→正斜杠、去掉尾斜杠),供 gitdir 双向比对用。 */
function normPath(p) {
  return resolve(p).replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * 这个 `.git` 是不是**扫描根所在仓的已注册 linked worktree**?(`git worktree add` 的正常产物)
 *
 * 四条全中才认,认不了就回落成命中(§0.3:核验不成立不放行,不猜):
 *  ① `.git` 是**文件**(gitfile)—— 目录形态是独立仓/`git init` 夹具,正是 2026-10-14 事故的形;
 *  ② 其 `gitdir:` 目标落在 `<扫描根>/.git/worktrees/<单段名>` 里(扫描根自己的 `.git` 必须是目录,
 *     否则无从判定主仓 admin 面,直接不认);
 *  ③ 该 admin 目录**当前存在**(worktree 已被 `remove`/`prune` 而 gitfile 留在盘上 = 悬空残留,照旧红);
 *  ④ admin 侧 `gitdir` 文件回指**同一个容器 `.git` 路径**(双向登记才算真挂载,防手工伪造 gitfile)。
 *
 * 认下来 ≠ 不再往里扫:worktree 容器目录的其余子树照常遍历,所以在隔离检出里再长出一棵夹具仓
 * 仍然被本门抓到 —— 这一条由镜像测试 L4 钉住,不是措辞。
 */
export function sameRepoLinkedWorktree(gitfilePath, root = REPO_ROOT) {
  let self
  try {
    self = lstatSync(gitfilePath)
  } catch {
    return null
  }
  if (!self.isFile()) return null

  const rootGit = join(root, '.git')
  let rootGitIsDir = false
  try {
    rootGitIsDir = statSync(rootGit).isDirectory()
  } catch {
    rootGitIsDir = false
  }
  if (!rootGitIsDir) return null

  // git 在两处写的形态不同:容器侧 `.git` 文件是 `gitdir: <路径>`,而 admin 侧
  // `.git/worktrees/<name>/gitdir` 是**裸路径无前缀**。两种都吃,不吃就不认(回落成命中)。
  const readGitdir = (p) => {
    try {
      const raw = readFileSync(p, 'utf8').trim()
      const m = /^(?:gitdir:\s*)?(.+?)\s*$/im.exec(raw)
      if (!m) return null
      return normPath(isAbsolute(m[1]) ? m[1] : resolve(dirname(p), m[1]))
    } catch {
      return null
    }
  }

  const target = readGitdir(gitfilePath)
  if (!target) return null
  const adminRoot = normPath(join(rootGit, 'worktrees'))
  if (!target.startsWith(`${adminRoot}/`)) return null
  const name = target.slice(adminRoot.length + 1)
  if (!name || name.includes('/')) return null

  const back = readGitdir(join(target, 'gitdir'))
  if (!back || back !== normPath(gitfilePath)) return null
  return { name, target }
}

/** 剪枝目录名:第三方依赖子树与构建产物,非本仓产物,不扫。 */
const PRUNED_DIRS = new Set(['node_modules', '.pnpm', '.venv', 'venv', '__pycache__'])

/**
 * 合法落点(仅扫根的直属子目录):AGENTS §12d 规定并行会话 worktree 一律检出在仓库内
 * `.worktrees/wt-<任务名>`,而 linked worktree 天然带 `.git` gitfile —— 那是规定动作,
 * 不是幻影仓。放宽只到这一格、只在顶层:同名目录出现在更深位置照旧命中。
 * 不这么做的后果是 §12e 禁止的恒红门:有人照规矩开一个 worktree,此后所有无关提交都被拦。
 */
const SANCTIONED_LANDINGS = new Set(['.worktrees', '.DevEnv'])

/** 目录串归一(斜杠方向 / 前导 ./ / 尾斜杠),豁免按**逐字等值**比对,不做前缀、不做同名。 */
function normRel(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 条目形态是否可用 —— 两把载体与 `splitByExemption` 共用的**唯一**一处判据(§0.6 单一真相源)。
 * 缺 owner / 缺 why / 到期日不是 YYYY-MM-DD ⇒ 整条作废(§0.7「无原因不放行」)。
 */
export function entryUsable(e) {
  return (
    !!e &&
    typeof e.rel === 'string' &&
    normRel(e.rel) !== '' &&
    typeof e.owner === 'string' &&
    e.owner.trim() !== '' &&
    typeof e.why === 'string' &&
    e.why.trim() !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(e.expires ?? ''))
  )
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
    const okShape = entryUsable(e)
    if (okShape) entries.push({ ...e, rel: normRel(e.rel) })
    else bad.push(String(e?.rel ?? '(无 rel)'))
  }
  return { entries, error: '', bad }
}

/**
 * 第二把载体 `scripts/data/no-nested-git-sites.jsonl` —— **每处现场一行**的意图登记。
 *
 * 为什么要有第二把(O508 定案前置①,2026-10-20 落地):JSON 台账是**整文件覆盖**的数据面,
 * 六天内同一组路径已六轮「登记 → 现场消失 → 清单腐烂判红 → 摘册」,而按台账第一条出路重登记
 * 又被门 84 的**行级复活**判据拒(entries 从 0 变 2 ⇒「复活 3 行 ← 祖先 9f40b2aad」,复活的
 * 是 `  "entries": [` / `    {` 这类结构行,措辞写得再新也躲不开)。两扇门因此互相咬死,
 * 唯一结局是逼人 `--no-verify`(§12e 明令禁止)。
 *
 * 这把只记**意图与归属**(这条路径是有意的长期现场、归谁、何时到期),**不记存续** —— 存续由本门
 * 在判的那一刻现算(命中才谈得上放行)。于是它不需要任何会话去"随现场销账",翻转的燃料就没了。
 * 行式还是 git 可增量合并的形态:两会话登记两处不同现场,改的是两行,不互相整本覆盖。
 *
 * 判定力不减的三条锁:① 未命中的行**一条也放不了行**(放行只对当刻真实命中生效);② 到期即不免并
 * 点名;③ 坏行/缺字段整条作废并逐条点名。与旧 JSON 台账的唯一差别是:本把的"失去命中"打 ⚠ 不清
 * 红 —— 那是卫生提醒,不是判据,而把它当判据正是恒红门的成因。
 */
export function loadNamedSites(file = SITES_FILE) {
  if (!existsSync(file)) return { entries: [], error: `现场登记件不存在:${file}`, bad: [] }
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const entries = []
  const bad = []
  for (const [i, line] of lines.entries()) {
    let e
    try {
      e = JSON.parse(line)
    } catch (err) {
      bad.push(`第 ${i + 1} 行 JSON 坏(${err.message})`)
      continue
    }
    const okShape = entryUsable(e)
    if (okShape) entries.push({ ...e, rel: normRel(e.rel) })
    else bad.push(`第 ${i + 1} 行缺 owner/why 或到期日不是 YYYY-MM-DD(rel=${String(e?.rel ?? '(无)')})`)
  }
  return { entries, error: '', bad }
}

/**
 * 按台账把 hits 分成「仍判红 / 具名放行」两堆,并另算**腐烂**(§0.7:已登记的豁免在审面不再命中 ⇒ 清单腐烂判红)。
export function splitByExemption(hits, entries, today = isoToday()) {
  const reported = []
  const exempted = []
  const matched = new Set()
  for (const h of hits) {
    const segs = String(h.rel).split(/[\\/]/).filter(Boolean)
    const container = segs.slice(0, -1).join('/')
    // 形态校验下沉到这里,两把载体共用同一个点:纯函数自己不设防的话,"谁调用谁校验"就成了
    // 口头约定 —— 调用方漏一步,空 owner/空 why 就能换到一次放行。
    const e = entries.find((x) => x && x.rel === container && entryUsable(x))
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
 * @param {number} [opts.entryBudget=1000000] readdir 条目总预算(防超大树拖垮 pre-commit;
 *                                           定档出处:2026-10-14 实测 ~64k 条目→钉 200k;
 *                                           2026-10-20 现读同一口径 **207,268 条目 / 全树 walk 1,274ms**
 *                                           ⇒ 200k 已被真实树顶穿,本机每次判都恒 `truncated`=恒红(§12e)。
 *                                           抬到 1M 是**只增不减覆盖面**的加强档:扫得完才谈得上出合格证。
 *                                           深度/预算两档都不影响命中口径本身。)
 * @returns {{hits: {path:string, rel:string, isDir:boolean}[], scanned:number,
 *            truncated:boolean, unreadable:string[], skippedReparse:number}}
 */
export function scanForNestedGit(root, opts = {}) {
  const maxDepth = opts.maxDepth ?? 10
  const entryBudget = opts.entryBudget ?? 1_000_000
  const hits = []
  const linkedWorktrees = []
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
        // 本仓**已注册的 linked worktree**(§12d 规定的并行隔离面)与"工作树里长出一棵别人的仓"
        // 不是同一种东西:前者是同一仓的另一个检出,后者才是 2026-10-14 幻影计数事故的成因。
        // 只按正向核验分流(gitfile + 指回本仓 admin 目录 + admin 侧 gitdir 回指同一容器),
        // 目录形态(.git 是目录 = 独立仓/`git init` 夹具)与悬空 gitfile 一律照旧命中。
        const lw = isDir ? null : sameRepoLinkedWorktree(abs, root)
        if (lw) {
          linkedWorktrees.push({ path: abs, rel: relative(root, abs), name: lw.name })
        } else {
          hits.push({ path: abs, rel: relative(root, abs), isDir })
        }
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
  return { hits, linkedWorktrees, scanned, truncated, unreadable, skippedReparse }
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
  const sites = opts.sites ?? []
  const checkStale = opts.checkStale === true
  const today = opts.today ?? isoToday()
  // 两把载体各跑一遍:先旧 JSON(保留它原有的「腐烂判红」语义,一字不改),剩下没被免掉的
  // 命中再交给行式意图登记。放行永远只作用在**当刻真实命中的那一条**上。
  const jsonPass = splitByExemption(scan.hits, entries, today)
  const sitePass = sites.length
    ? splitByExemption(jsonPass.reported, sites, today)
    : { reported: jsonPass.reported, exempted: [], stale: [] }
  const reasons = sitePass.reported.map(
    (h) =>
      `${h.isDir ? '嵌套 .git 目录' : '嵌套 .git(gitfile)'}: ${h.path}` +
      (h.exemptWhy ? ` —— ${h.exemptWhy}` : '')
  )
  if (checkStale) {
    for (const s of jsonPass.stale) {
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
    exempted: [
      ...jsonPass.exempted.map((x) => ({ ...x, via: 'JSON 台账' })),
      ...sitePass.exempted.map((x) => ({ ...x, via: '行式现场登记' })),
    ],
    stale: jsonPass.stale,
    staleSites: sitePass.stale,
    linked: scan.linkedWorktrees ?? [],
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
  // G-322(守门 208,blocking):旧写法 `ri !== -1 && argv[ri+1]` 在被旗标顶值时把 "--staged" 当扫描根
  // (扫一个不存在的目录 ⇒ "无嵌套仓"报绿),裸 `--root` 更是**静默按默认根**继续判 —— 调用方以为换了根。
  // 现在:给了旗标就要有值,否则未判定(判据单源 = lib/flag-value.mjs,§22c)。
  const rootFlag = requireFlagValue(argv, '--root', { noun: '目录参数' })
  if (rootFlag.error) {
    console.error(`❌ ${rootFlag.error}`)
    return 2
  }
  if (rootFlag.value) root = resolve(rootFlag.value)

  const scan = scanForNestedGit(root)
  const ledger = loadNamedExemptions()
  const sites = loadNamedSites()
  const verdict = evaluateResult(scan, {
    entries: ledger.entries,
    sites: sites.entries,
    checkStale: resolve(root) === REPO_ROOT,
  })
  if (ledger.error && scan.hits.length > 0) {
    verdict.reasons.push(
      `具名豁免台账不可用(${ledger.error})⇒ 本轮零放行:上面的命中一条也不许被当作"已豁免"`
    )
    verdict.ok = false
  }
  if (sites.error && scan.hits.length > 0) {
    verdict.reasons.push(`现场登记件不可用(${sites.error})⇒ 该载体本轮零放行(命中一条也不免,严档)`)
    verdict.ok = false
  }
  if (ledger.bad && ledger.bad.length > 0) {
    verdict.reasons.push(
      `具名豁免条目形态不合格 ${ledger.bad.length} 条(缺 owner/why 或到期日不是 YYYY-MM-DD)⇒ 整条作废:${ledger.bad.join(', ')}`
    )
    verdict.ok = false
  }
  if (sites.bad && sites.bad.length > 0) {
    verdict.reasons.push(
      `现场登记件形态不合格 ${sites.bad.length} 行 ⇒ 整行作废(缺 owner/why/到期日或 JSON 坏):${sites.bad.join('; ')}`
    )
    verdict.ok = false
  }
  // 行式载体"失去命中"只提醒不清红:它记的是意图,存续由本门现算;把它当红判据正是六轮翻转的燃料。
  for (const s of verdict.staleSites) {
    console.warn(
      `${GATE_LABEL} ⚠ 现场登记件里的「${s.rel}」本次审面已无命中 ⇒ 该行的豁免本轮自然不生效(未命中=免不了任何东西),不判红;归属 ${s.owner} 若已撤离,请随批摘掉该行。`
    )
  }

  const linkedLine = verdict.linked.length
    ? `本仓 linked worktree ${verdict.linked.length} 处不计为嵌套(逐条见下)`
    : ''
  if (verdict.ok) {
    if (scan.hits.length === 0) {
      console.info(
        `${GATE_LABEL} ✅ 工作树内无嵌套 git 仓(扫描 ${scan.scanned} 条目,` +
          `symlink 跳过 ${scan.skippedReparse},unreadable ${scan.unreadable.length}${linkedLine ? `, ${linkedLine}` : ''})`
      )
    } else {
      console.info(
        `${GATE_LABEL} ✅ 命中 ${scan.hits.length} 处已全部被具名登记放行(载体逐条标注;审面逐条现读,非缓存${linkedLine ? `;${linkedLine}` : ''})`
      )
    }
    for (const x of verdict.exempted) {
      console.info(
        `   🪪 具名豁免(载体:${x.via}):${x.entry.rel} —— 归属 ${x.entry.owner};因由 ${x.entry.why};到期 ${x.entry.expires}(过期即判红)`
      )
    }
    for (const w of verdict.linked) {
      console.info(`   🔗 本仓 linked worktree:${w.rel} —— gitfile 与 admin 面双向核验通过,不计嵌套仓`)
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
        `     - ${x.entry.rel}(载体:${x.via}) —— 归属 ${x.entry.owner};因由 ${x.entry.why};到期 ${x.entry.expires}`
      )
    }
  }
  if (verdict.linked.length) {
    console.error(`  ℹ 另有 ${verdict.linked.length} 处是本仓 linked worktree(已按双向核验分流,不计为嵌套;仍逐条列出):`)
    for (const w of verdict.linked) console.error(`     - ${w.rel}`)
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
  sameRepoLinkedWorktree,
  loadNamedExemptions,
  loadNamedSites,
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
