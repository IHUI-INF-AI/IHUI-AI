#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 合并新增文件存续性对账(§22 配套)
 *
 * 立因(2026-09-24 实测):远端一枚"按 union 归并"的合并提交 `9a0f7610e9` 把
 * `packages/shared/src/chat/cloud-chat-ops.ts` 等 **35 个路径整批吞掉**,连带 72 个文件
 * 回退成旧基线(相对共同祖先 1fa946316 净 −12014 行),而它的提交信息写着
 * "仅 PROJECT_PLAN.md 一处冲突,双方每一行均存活"。它没撒谎于它检查的那一面 ——
 * 它检查的是**行**,而这起事故发生在**文件**上:一侧新增、另一侧从未有过该路径的文件,
 * 在"取某一侧整棵树"的合并里会**静默消失**,既不算冲突也不进 diff 报告。
 *
 * 判据三条(A1 合并吞新增 / A2 两父共有路径 / A3 引用位移丢提交),每条都结构上不可能误伤正常形态:
 *   **A1** 路径 P 满足「P ∈ 某父提交的树」∧「P ∉ 本次合并的共同基底 B」⇒ P 必须 ∈ M 的树。
 *   B 用 `git merge-base --all <parents>` 取,所以"P ∉ B"的定义就是**该侧独有的新增**;
 *   另一侧从未拥有过它,自然谈不上"那一侧删了它"。⇒ 合并结果里没有它 = 被合并吞掉。
 * 合法的删除不受影响:真要在合并里删掉对侧新增的文件,必须显式 `git rm`,而那会体现在
 * **父提交自身的树**里(P 同时不在所有父里 ⇒ 不触发 A1)。
 *
 * ── A2(2026-10-22 立,票 G-939 的判据缺口①:基底维)──────────────────────────
 *   **A2** 路径 P ∈ **每一个**父提交的树 ∧ P ∉ M 的树 ⇒ 判红。
 *   A1 的前件里有「P ∉ 基底」,于是"P 早就进了基底、两父都留着、结果树却丢"这一型结构上不成立;
 *   而真正的三路合并**不可能**丢掉两父都有的路径(两侧都没删它,合并只会保留) ⇒ A2 命中即
 *   "结果树不是这枚合并的合并产物"(`commit-tree` 拿旧基线/第三棵树当结果,并集落地与旁路重放造出的
 *   正是这一形态)。A2 不依赖基底,所以基底里有没有它都判。
 *
 * ── A3(2026-10-22 立,票 G-939 的判据缺口②:提交图连通维)──────────────────────
 *   A1/A2 都只读**合并提交自己**的父子关系。G-939 的现读现场里根本没有合并提交:分支引用被
 *   `update-ref`(reflog 消息 `g921c relay align`,不经任何钩子)从 `72b3a20c` 移到 `588a6342d8`,
 *   后者的祖先链从未包含 `12898ccd`/`72b3a20c` 两枚 ⇒ 两枚整批掉出祖先链,A1/A2 的被审对象
 *   都不存在。**A3** 改判"引用位移":取当前分支 reflog 的相邻位移 `from → to`,若 `from` 不是
 *   `to` 的祖先(正常前进与真合并天然满足,一律放过),则
 *     「`from` 线相对共同基底改过的路径」∩「tree(from) 有」∩「tree(to) 没有」= 被这次位移整批
 *     丢掉的路径 ⇒ 判红;`atRef`(默认 HEAD)已有 ⇒ 记 `repaired` 照常点名、不计红(与 A1 同口径)。
 *   位移两端都已进 origin/main ⇒ 历史,不重判(§12e 恒红门禁令);任一端从未入库 ⇒ 照判
 *   (本仓的分支尖端永远先于推送被这一维看到)。
 *
 * 取材:reflog 是"引用曾经指向哪里"的唯一可用证据(提交对象里不留前像),取不到就如实报
 * 「引用位移维未判定」,不拿"没有位移"冒充判过。
 *
 * ── A4(2026-10-23 立,票 G-939 的残段:A3 的**射程**维)──────────────────────
 *   A3 判得到这一型,但它挂在**提交链**上、只回看当前分支 reflog 最近 40 条位移;而旁路落地的
 *   `update-ref` **不跑钩子**(§5b),位移发生的那一刻没有门在跑。本仓多会话并发 + auto-commit
 *   的节奏下,40 条位移实测只覆盖约 53 分钟(2026-10-23 现读 main@{0} 03:28:26 ↔ main@{40} 02:35:27),
 *   原案那枚位移位于 main@{921} ⇒ 等下一次带钩子的提交时它早已滑出窗口。A4 把"回看多少条"换成
 *   "**游标之后**的每一枚位移都判恰好一次",挂在本就有人调的巡检档 `--all-new` 上(git-guardian),
 *   单轮上界 `MOVE_SWEEP_MAX` 对、超出从最旧一段先判并把欠的量点名留到下轮(方向永远是"欠着的下轮补判",
 *   绝不是"新的先判、旧的永久跳过")。游标缺失/被裁 ⇒ 退回窗口档并点名未覆盖范围(§0.3)。
 *   另补 `--move <from>..<to>` 人工取证档:此前**没有任何 CLI 出口**能把 A3 指向一次指定位移
 *   (`--rev`/`--limit` 明确排除位移维),票面要求的那次离线对账只能靠手工 import 判据 —— 那是 §0.8
 *   "文档不得写跑不通的出路"在这一格的具体形态。取证档**不吃**"两端都已入库 ⇒ 不重判"那条豁免
 *   (那是提交链的恒红防线,人工指名问一次时不适用),也**不去重**(要能反复回看同一枚),口径与 `--limit` 同形。
 *
 * ── A5(2026-10-24 立,票 G-939 的残段③:内容存续维)────────────────────────────
 *   A1/A2/A3 判的都是**路径成员性**(`tree` 里有没有 P)。G-939 现读现场 11 枚文件里只有 5 枚是
 *   新文件(被 A3 看见),另外 6 枚是**改已有文件** —— 位移把 blob 退回共同基底,路径却还在,
 *   于是 A3 当场判绿(`--move 72b3a20c50..588a6342d8` 修复前只报 5 条 repaired)。
 *   **A5** 改读 blob oid:位移两端 P 都在,`blob(from) ≠ blob(to)` 且 `blob(to) == blob(基底)`
 *   ⇒ 这条线的改动被这次位移静默回滚 ⇒ 判红;`blob(to)` 与两端都不同 = 别人继续演进过 ⇒ 放过
 *   (不归因给这次位移)。`atRef` 上 blob 已离开基底 ⇒ 记 `repaired`(与 A1/A3 同口径)。
 *   取材仍走层的 `catBatchOids`(`blobMapAt`),不新增第二套 git 封装。
 *
 * 用法:
 *   node scripts/check-merge-addition-loss.mjs                 # 提交链口径:未进入 origin/main 的合并 + 当前分支最近 40 次引用位移(A3)
 *   node scripts/check-merge-addition-loss.mjs --staged        # runner 统一下发的档(如实记录,判据读同一份提交图)
 *   node scripts/check-merge-addition-loss.mjs --rev <sha>     # 只审计一枚(供钩子精确点名)
 *   node scripts/check-merge-addition-loss.mjs --move <from>..<to>  # 只审计一次引用位移(A3/A4 的人工取证档;G-939 原案 = `--move 72b3a20c50..588a6342d8`)
 *   node scripts/check-merge-addition-loss.mjs --all-new       # 增量台账:别人推来的合并也会被判一次 + 位移游标档 A4(每枚新于游标的位移判恰好一次)
 *   node scripts/check-merge-addition-loss.mjs --limit 40      # 手工回看最近 40 枚(取证用,会连历史事故一起报)
 *   node scripts/check-merge-addition-loss.mjs --self-test     # 真临时仓端到端取证
 * 退出码:0 = 无吞并且无位移丢提交;1 = 有;2 = **无法判定**(git 取数失败 / 两面旗同用 / 脚本自身异常 —— 取数失败绝不静默放行,也绝不冒"无吞并"的绿)。
 *
 * 取材(2026-09-26 迁入共用层):所有 git 派生经 `scripts/lib/face-reader.mjs` 的 `gitRaw`,
 * 台账经该层的磁盘面读取入口 `readWorktreeFile`。本门**不读 blob 正文**(判据对象是 commit / tree
 * 对象,层的 `catBatch` 头解析只认 blob),所以它没有"索引面 vs HEAD 面"可切 —— 这一点由 `--self-test`
 * 第 ②③ 组构造面证明,而不是靠注释声称。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatchOids, gitRaw, readWorktreeFile, resolveRemoteHead, selectFace } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_LIMIT = 12
/**
 * A3(引用位移)回看多少条 reflog。位移**在发生后的下一次提交**就位于 reflog 顶部,
 * 所以窗口只需盖住"最近几次提交";窗口越大,历史重写越多,逐次位移的判据开销也越大。
 * ⚠️ 这句前提在共享工作树里**不成立**(旁路落地的 update-ref 不跑钩子 ⇒ 位移发生时没有门在跑),
 *    所以另有一把游标档 `sweepRefMoves`(A4)兜住"滑出窗口"的那一段;这里保留窗口只做提交链的快路径。
 */
export const REF_MOVE_WINDOW = 40
/**
 * A4(位移游标档)一次读多少条 reflog、一轮最多判多少对位移。
 * 读得宽(`MOVE_SCAN_LIMIT`)只花一次 `git reflog` 派生,目的是**让游标尽量落在窗口内**;
 * 判得窄(`MOVE_SWEEP_MAX`)是因为非快进的位移要付 `diff` + 批量树成员性(2026-10-23 实测:
 * 960 条位移整扫 = 170s,而守护侧的超时是 240s)⇒ 每轮只推进一步,欠着的点名留到下轮。
 */
export const MOVE_SCAN_LIMIT = 2000
export const MOVE_SWEEP_MAX = 120
/** 沿用迁移前的显式上界:一次审计要 ls-tree 多棵全量树,层的默认 60s/64MB 会把大树读成"取不到" */
const GIT_TIMEOUT = 120000
const GIT_MAX_BUFFER = 256 * 1048576

/**
 * 派生一律走取材层的 `gitRaw` —— 绝对 git 路径 / `safe.directory` / quotepath / windowsHide /
 * timeout / maxBuffer / **显式 stdio** 这六件事在层里只有一份实现(此前本门自己 `execFileSync`
 * 派生并硬编码 `C:/Program Files/Git/cmd/git.exe`,即门 118 判的"半接线":引了层却没用层取数)。
 *
 * ⚠️ 为什么这里**不可能**出现 `catBatch(`:本门读的全是 **commit / tree 对象**(路径集与父子关系),
 * 而层的 `catBatch` 走 `parseBatch`,其头解析正则 `/^([0-9a-f]{40}) blob (\d+)$/` 只认 blob,
 * tree / commit 一律回 `null`。所以"正文面"在本门结构上不存在 —— 唯一真按路径读正文的那一处是
 * 运行态台账(见 `readMarker`),它走层的磁盘面读取入口 `readWorktreeFile`。
 */
const git = (args, cwd = ROOT) => gitRaw(args, cwd, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })

/** 某提交树下的路径集合。
 *  缓存键**必须先剥到 tree oid**:按符号名('HEAD')缓存会让"ref 移动之后"读到移动前的树 ——
 *  本门自检第一轮就是这么把一次真事故判成绿的(夹具里 update-ref 之后仍报 lost=0)。 */
const treeCache = new Map()
export function treePaths(rev, cwd = ROOT) {
  const oid = git(['rev-parse', '--verify', `${rev}^{tree}`], cwd).trim()
  const key = `${cwd}::${oid}`
  if (!treeCache.has(key))
    treeCache.set(key, new Set(git(['ls-tree', '-r', '--name-only', oid, '-z'], cwd).split('\0').filter(Boolean)))
  return treeCache.get(key)
}

export function parentsOf(rev, cwd = ROOT) {
  // `rev-list --parents` 的第一个 token 是提交**自己**,父从 index 1 起 —— 取 slice(2) 会把
  //   第一父当成自己,合并提交被误判成"只有 1 个父"从而整门恒绿(本门自检第一轮就是这么暴露的)。
  const line = git(['rev-list', '--parents', '-n', '1', rev], cwd).trim()
  return line.split(/\s+/).slice(1)
}

/** 多父的共同基底(两两 merge-base 的公共祖先;git 自己给的 --all 结果就是"独立祖先"集) */
export function basesOf(parents, cwd = ROOT) {
  if (parents.length < 2) return []
  return git(['merge-base', '--all', ...parents], cwd).split('\n').map((s) => s.trim()).filter(Boolean)
}

/** 审计一枚提交:返回被吞掉的新增路径清单。
 *
 *  `atRef`(默认 HEAD)= "后手有没有已经补回"的对照面。2026-10-19 补这一格是实测逼出来的:
 *  枚 `f2f9086` 吞掉 7 个路径,15 分钟后另一会话用 `139209161bc` 补回其中 5 个,而本门**只比父子树**,
 *  于是过了一小时再判仍然报"丢失 7"——守护据此寄出的 CRITICAL 信,收件人照做去补的是一批
 *  早已在树里的文件(§5e-1「红了收信人能做什么」在这里失效了)。
 *  判序:父独有 ∧ 合并结果没有 ∧ **atRef 也没有** ⇒ 才算 lost;
 *  atRef 已有 ⇒ 记 `repaired`(照常点名、不参与退出码),这样"补回了什么"在账面上仍是可见的,
 *  不会因为加了豁免就把一次真吞并洗成无声。
 *  atRef 取不到 ⇒ 退回"算 lost"并点名,绝不拿"量不到"冒绿(§0.3)。 */
export function auditOne(rev, cwd = ROOT, atRef = 'HEAD') {
  const ps = parentsOf(rev, cwd)
  if (ps.length < 2) return { rev, merge: false, bases: [], lost: [], repaired: [], atRefUndetermined: '' }
  const bases = basesOf(ps, cwd)
  const mine = treePaths(rev, cwd)
  let alive = null
  let atRefUndetermined = ''
  try {
    alive = treePaths(atRef, cwd)
  } catch (e) {
    atRefUndetermined = `${atRef} 树取不到(${String(e.message).slice(0, 80)})⇒ 后手补回维不判,退回按合并结果判丢失`
  }
  const lost = []
  const repaired = []
  for (const p of ps) {
    const baseSets = bases.map((b) => treePaths(b, cwd))
    for (const path of treePaths(p, cwd)) {
      // 只问"这一侧独有的新增":任何共同基底里都没有 ⇒ 对侧无从"删除"它
      if (baseSets.some((s) => s.has(path))) continue
      if (!mine.has(path)) {
        if (alive && alive.has(path)) repaired.push({ path, addedBy: p, restoredAt: atRef })
        else lost.push({ path, addedBy: p })
      }
    }
  }
  // ── A2:两父都有的路径 ⇒ 结果树必须有(与基底无关;A1 的前件"P ∉ 基底"在这一型上恒假)──
  // 已由 A1 记过的路径不重复计:同一路径被两条判据各记一次,就是两份基线互相顶掉。
  const seen = new Set([...lost, ...repaired].map((x) => x.path))
  const [p0, ...rest] = ps
  for (const path of treePaths(p0, cwd)) {
    if (mine.has(path) || seen.has(path)) continue
    if (!rest.every((p) => treePaths(p, cwd).has(path))) continue
    seen.add(path)
    if (alive && alive.has(path)) repaired.push({ path, addedBy: p0, restoredAt: atRef, byAllParents: true })
    else lost.push({ path, addedBy: p0, byAllParents: true })
  }
  return { rev, merge: true, bases, lost, repaired, atRefUndetermined }
}

/** 从 startRef 往回找合并提交并逐枚审计 */
export function auditRecent(limit = DEFAULT_LIMIT, startRef = 'HEAD', cwd = ROOT) {
  const all = git(['rev-list', startRef], cwd).split('\n').filter(Boolean)
  const out = []
  for (const sha of all) {
    if (out.length >= limit) break
    if (parentsOf(sha, cwd).length < 2) continue
    out.push(auditOne(sha, cwd))
  }
  return out
}

/**
 * a 是否是 b 的祖先(含 a===b)。经取材层派生;git 以退出码 1 表达"不是",以 128 表达"对象取不到" ——
 * 两者都返回 false,而"取不到"由调用方先用 `commitExists` 挡掉(不拿"问不到"当"没有位移")。
 */
export function isAncestor(a, b, cwd = ROOT) {
  try {
    git(['merge-base', '--is-ancestor', a, b], cwd)
    return true
  } catch {
    return false
  }
}

/**
 * 一批路径在某个提交的树里**在不在** —— 与 `treePaths` 同语义,但按路径批问(`cat-file --batch-check`
 * 只回 oid,不回正文)。A3 每次位移只需问 diff 出来的十几条路径,而列一棵全量树在本仓实测要数秒
 * (树 10 万+ 条目),且位移维是每次提交都要跑的一维 ⇒ 取按路径批问这一档。
 */
export function presentIn(rev, paths, cwd = ROOT) {
  const usable = paths.filter((p) => p && !p.includes('\n'))
  const map = new Map()
  if (usable.length === 0) return { map, failed: false, skipped: paths.length - usable.length }
  let oids
  try {
    oids = catBatchOids(cwd, usable.map((p) => `${rev}:${p}`), { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  } catch {
    return { map, failed: true, skipped: paths.length - usable.length }
  }
  for (const p of usable) {
    const oid = oids.get(`${rev}:${p}`)
    map.set(p, oid !== null && oid !== undefined)
  }
  return { map, failed: false, skipped: paths.length - usable.length }
}

/**
 * 一批路径在某个提交树里的 **blob oid**(A5 的内容面;`null` = 该路径不在树里)。
 * 与 `presentIn` 同源同派生(都走层的 `catBatchOids`),只把"在不在"换成"是哪一版内容" ——
 * A5 要判"路径还在、内容却退回共同基底",成员性那一面结构上看不见这一型。
 */
export function blobMapAt(rev, paths, cwd = ROOT) {
  const usable = paths.filter((p) => p && !p.includes('\n'))
  const map = new Map()
  if (usable.length === 0) return { map, failed: false, skipped: paths.length - usable.length }
  try {
    const oids = catBatchOids(cwd, usable.map((p) => `${rev}:${p}`), { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
    for (const p of usable) map.set(p, oids.get(`${rev}:${p}`) ?? null)
    return { map, failed: false, skipped: paths.length - usable.length }
  } catch {
    return { map, failed: true, skipped: paths.length - usable.length }
  }
}

/**
 * 当前分支 reflog 的相邻位移(`from → to`,新→旧配对)。**取不到就 ok:false 并点名**:
 * 分离头 / reflog 被裁 ⇒ 这一维不判,绝不拿"没有位移"冒充判过(§0.3)。
 * 用分支 reflog 而不是 HEAD reflog:后者混入 `checkout:` 换分支,而换分支天然"新头不是旧头后代",
 * 那会把每一次切分支都读成位移(A3 会被噪声淹掉)。
 */
export function reflogEntries(cwd = ROOT, limit = REF_MOVE_WINDOW) {
  let ref = ''
  try {
    ref = git(['symbolic-ref', '--short', '-q', 'HEAD'], cwd).trim()
  } catch {
    ref = ''
  }
  if (!ref) return { ok: false, ref: '', entries: [], why: 'HEAD 不是分支引用(分离头)⇒ 引用位移维未判定' }
  let out = ''
  try {
    out = git(['reflog', 'show', '--format=%H%x09%gs', ref, '-n', String(limit + 1)], cwd)
  } catch (e) {
    return { ok: false, ref, entries: [], why: `reflog 取不到(${String(e?.message ?? e).split('\n')[0].slice(0, 80)})⇒ 引用位移维未判定` }
  }
  const entries = out
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const i = l.indexOf('\t')
      return { sha: (i < 0 ? l : l.slice(0, i)).trim(), msg: i < 0 ? '' : l.slice(i + 1).trim() }
    })
  return { ok: true, ref, entries, why: '' }
}

/** 相邻两条 reflog 配成位移(新→旧):`from = entries[i+1]`、`to = entries[i]`。窗口档(`refMoves`)与
 *  游标档(`sweepRefMoves`)共用这一份配对实现 —— 两档只差"取哪一段",配对不许有两份(§22c)。
 *  `withIndex` 把 `to` 那条的**条目下标**一起带出来:游标档要靠它算"下一轮的游标落在哪一条",
 *  而配对数未必等于下标(相邻两条同 sha 会被滤掉)—— 用 `pairs.length` 反推下标就会错位。 */
export function pairMoves(entries, withIndex = false) {
  const moves = []
  for (let i = 0; i + 1 < entries.length; i++) {
    const to = entries[i]
    const from = entries[i + 1]
    if (!from.sha || !to.sha || from.sha === to.sha) continue
    moves.push(withIndex ? { from: from.sha, to: to.sha, msg: to.msg, toIndex: i } : { from: from.sha, to: to.sha, msg: to.msg })
  }
  return moves
}

export function refMoves(cwd = ROOT, limit = REF_MOVE_WINDOW) {
  const e = reflogEntries(cwd, limit)
  if (!e.ok) return { ok: false, ref: e.ref, moves: [], why: e.why }
  return { ok: true, ref: e.ref, moves: pairMoves(e.entries), why: '' }
}

/**
 * 审计**一次引用位移** `from → to`(A3 的核心;`atRef` 与 A1 同义 = "后手有没有补回"的对照面)。
 * 正常前进/真合并:from 是 to 的祖先 ⇒ 直接放过(零额外派生)。
 * 否则:以共同基底为界取"from 线改过的路径":
 *   · A3(路径面):tree(from) 有而 tree(to) 没有 ⇒ 被这次位移整批丢掉;
 *   · A5(内容面,2026-10-24):路径**两端都有**,但 blob(to) 恰好退回 blob(基底) ⇒ 这条线的改动被
 *     静默回滚。原案 11 枚文件里 6 枚是改已有文件,路径面看见"还在"就放过 ⇒ 当场判绿。
 * 位移两端取不到 / 无共同基底 / 树取数问不到 ⇒ 逐条落 `atRefUndetermined`,不冒绿。
 */
export function auditRefMove(from, to, cwd = ROOT, atRef = 'HEAD') {
  const row = { rev: to, kind: 'ref-move', merge: false, from, droppedCommits: 0, bases: [], lost: [], repaired: [], atRefUndetermined: '' }
  if (!commitExists(from, cwd) || !commitExists(to, cwd)) {
    row.atRefUndetermined = `位移两端在本仓取不到(${String(from).slice(0, 11)} → ${String(to).slice(0, 11)})⇒ 未判定`
    return row
  }
  if (isAncestor(from, to, cwd)) return row
  const bases = basesOf([from, to], cwd)
  if (bases.length === 0) {
    row.atRefUndetermined = `${from.slice(0, 11)} → ${to.slice(0, 11)} 没有共同基底 ⇒ 未判定`
    return row
  }
  row.bases = bases
  let changed = []
  try {
    row.droppedCommits = Number(git(['rev-list', '--count', from, '--not', to], cwd).trim())
    changed = git(['diff', '--name-only', '-z', `${bases[0]}..${from}`], cwd).split('\0').filter(Boolean)
  } catch (e) {
    row.atRefUndetermined = `${from.slice(0, 11)} → ${to.slice(0, 11)} 的位移清单取不到(${String(e?.message ?? e).split('\n')[0].slice(0, 60)})⇒ 未判定`
    return row
  }
  const inFrom = blobMapAt(from, changed, cwd)
  const inTo = blobMapAt(to, changed, cwd)
  const inBase = blobMapAt(bases[0], changed, cwd)
  if (inFrom.failed || inTo.failed || inBase.failed) {
    row.atRefUndetermined = `${from.slice(0, 11)} → ${to.slice(0, 11)} 的树内容问不到(${changed.length} 条)⇒ 未判定`
    return row
  }
  let alive = null
  const atView = blobMapAt(atRef, changed, cwd)
  if (atView.failed) row.atRefUndetermined = `${atRef} 树取不到 ⇒ 后手补回维不判,退回按位移结果判丢失`
  else alive = atView
  for (const p of changed) {
    const f = inFrom.map.get(p) ?? null
    if (!f) continue // 该线本身是删除(或从未引入)⇒ 不归这一维判
    const t = inTo.map.get(p) ?? null
    if (!t) {
      // A3:路径被整批丢出祖先链
      if (alive && alive.map.get(p)) row.repaired.push({ path: p, addedBy: from, restoredAt: atRef })
      else row.lost.push({ path: p, addedBy: from })
      continue
    }
    if (t === f) continue // 内容原样存活
    const b = inBase.map.get(p) ?? null
    // A5:该线改过、结果里路径还在,而 blob **恰好退回基底** ⇒ 这次位移把内容静默回滚了。
    // 结果与两端都不同 ⇒ 别人在该路径上继续演进过,不能归因给这次位移 ⇒ 放过(不制造误伤)。
    if (!b || t !== b) continue
    if (alive && alive.map.get(p) && alive.map.get(p) !== b)
      row.repaired.push({ path: p, addedBy: from, restoredAt: atRef, contentReverted: true })
    else row.lost.push({ path: p, addedBy: from, contentReverted: true })
  }
  return row
}

/**
 * 一次取一批提交的父(不遍历祖先,输入序返回)。`rev-list --no-walk` 对"对象不在本仓"的 sha 会整条失败,
 * 所以失败一律交调用方退回逐枚 `commitExists` —— 这里不吞异常,也不把"取不到"读成"没有父"。
 */
export function parentsBatch(shas, cwd = ROOT) {
  const uniq = [...new Set(shas.filter(Boolean))]
  if (uniq.length === 0) return new Map()
  const out = git(['rev-list', '--no-walk=unsorted', '--parents', ...uniq], cwd)
  const map = new Map()
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [sha, ...ps] = line.trim().split(/\s+/)
    map.set(sha, ps)
  }
  return map
}

/**
 * A3 的提交链口径:把 reflog 位移逐次送进 `auditRefMove`,**只返回"有话说"的行**(丢失 / 已补回 / 未判定)。
 * 位移两端都已进 origin/main ⇒ 历史,不重判(§12e:已入库的事故不得把后来每次提交钉红);
 * 任一端从未入库 ⇒ 照判 —— 本仓的分支尖端先于推送被这一维看到,这才是它值钱的那一格。
 *
 * 开销:常规提交的相邻两条 reflog 是直接的父子关系(一次批量 `rev-list --no-walk` 就能证明),
 * 只有"不是直接父"的位移才需要 `merge-base --is-ancestor` 逐对确认 —— 这道门每次提交都要跑,
 * 逐对派生在本仓实测要 ~2s(120 次进程),批量后压到 ~0.2s。
 */
export function auditRefMoves(cwd = ROOT, opts = {}) {
  const mv = opts.moves ? { ok: true, ref: opts.ref ?? '', moves: opts.moves, why: '' } : refMoves(cwd, opts.limit ?? REF_MOVE_WINDOW)
  if (!mv.ok) return { ok: false, ref: mv.ref, rows: [], judged: 0, skipped: 0, missing: 0, why: mv.why }
  let remote = opts.remote === undefined ? remoteHeadSha(cwd) : opts.remote
  if (remote && !commitExists(remote, cwd)) remote = ''
  let parents = null
  try {
    parents = parentsBatch(mv.moves.flatMap((m) => [m.from, m.to]), cwd)
  } catch {
    parents = null // 批量取父失败 ⇒ 退回逐枚 commitExists(不拿"取不到"当"没有位移")
  }
  const rows = []
  let judged = 0
  let skipped = 0
  let missing = 0
  for (const m of mv.moves) {
    // 存在性:批量面里查得到就是存在(根提交的父是空数组,同样查得到)
    const exists = parents ? parents.has(m.from) && parents.has(m.to) : commitExists(m.from, cwd) && commitExists(m.to, cwd)
    if (!exists) {
      missing += 1 // 对象不在了 ⇒ 这条位移问不到,不记绿也不冒红(由调用方点名)
      continue
    }
    // 快进:from 是 to 的直接父 ⇒ 必然是祖先(常规提交/常规合并都落这一支,零额外派生)
    const directParent = Boolean(parents && (parents.get(m.to) || []).includes(m.from))
    if (directParent || isAncestor(m.from, m.to, cwd)) {
      skipped += 1
      continue
    }
    if (remote && isAncestor(m.from, remote, cwd) && isAncestor(m.to, remote, cwd)) {
      skipped += 1
      continue
    }
    const r = auditRefMove(m.from, m.to, cwd, opts.atRef ?? 'HEAD')
    judged += 1
    if (r.lost.length || r.repaired.length || r.atRefUndetermined) rows.push({ ...r, msg: m.msg })
  }
  return { ok: true, ref: mv.ref, rows, judged, skipped, missing, why: '' }
}

/**
 * 位移游标档(A4,2026-10-23 立,G-939 残段):把 A3 的射程从"最近 40 条 reflog"改成"上次判到哪儿"。
 *
 * 立因(全部现读,不是推测):
 *  ① A3 默认档只看当前分支 reflog 最近 `REF_MOVE_WINDOW`(40)条位移,而本仓多会话并发 + auto-commit
 *    的节奏下 40 条实测只覆盖约 53 分钟(main@{0}=03:28:26 ↔ main@{40}=02:35:27,2026-10-23 现读);
 *  ② G-939 现场那枚位移(`72b3a20c → 588a6342`,reflog 消息 `g921c relay align`)正是旁路落地
 *    `update-ref` 写进去的 —— 旁路落地**不跑钩子**(§5b),所以位移发生的那一刻根本没有门在跑;
 *    等下一次带钩子的提交时,它已经(或很快就会)滑出那 40 条窗口 ⇒ 这一型可以无声过去。
 * 游标 = 上一轮读到的 reflog 顶部那枚 sha;每枚**严格新于游标**的位移恰好判一次(reflog 只追加,
 * 按 sha 定位不会错位)。单轮最多判 `MOVE_SWEEP_MAX` 对,超出即从**最旧**一段先判、游标只推到已判处
 * (方向必须是"欠着的下轮补判",绝不能"新的先判、旧的永久跳过")。
 * 游标缺失 / 已被 reflog 裁掉 ⇒ 退回最近 40 条并**点名**未覆盖范围(§0.3,不拿"没有位移"冒充判过)。
 * 台账跟磁盘面、与合并台账同一条纪律(见 `readMarker` 头注:state/ 被 gitignore,结构上不在任何检出面里)。
 */
export function moveMarkerPath(root = ROOT) {
  return join(root, '.ihui-agent', 'state', 'merge-addition-loss-refmoves.json')
}

/** 读游标;解不开 / 不是字符串 ⇒ 空串(= 首轮,由调用方按"退回窗口档"点名,不静默)。 */
export function readMoveCursor(p) {
  const j = readMarker(p)
  return typeof j.cursor === 'string' ? j.cursor : ''
}

/** `--move <from>..<to>` 的取值解析(纯函数,构造面可证)。 */
export function parseMoveSpec(value) {
  const s = String(value ?? '').trim()
  const i = s.indexOf('..')
  if (i <= 0 || i + 2 >= s.length) return { error: `--move 需要 <from>..<to> 两枚提交规格,实得:${JSON.stringify(s)}` }
  return { from: s.slice(0, i).trim(), to: s.slice(i + 2).trim() }
}

/**
 * 游标定位:entries 是新→旧序,同一枚 sha 可能在 reflog 里出现多次(`reset: moving to HEAD~1` 之后
 * 又走回来)。取**最靠后(最旧)**那次出现:下一轮的射程因此是"已判集合的超集",宁可重判几条,
 * 绝不能取最新那次而出现"中间那段没人判过"的缺口 —— 与本文件 `pendingMerges` 兜底同一方向
 * ("宁可多判一轮",漏判才是这一型真正的失效方向)。
 */
export function locateMoveCursor(entries, sha) {
  if (!sha) return -1
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i].sha === sha) return i
  return -1
}

export function sweepRefMoves(cwd = ROOT, opts = {}) {
  const p = opts.markerPath ?? moveMarkerPath(cwd)
  const scanLimit = opts.scanLimit ?? MOVE_SCAN_LIMIT
  const cap = opts.maxPairs ?? MOVE_SWEEP_MAX
  const e = reflogEntries(cwd, scanLimit)
  if (!e.ok) return { ok: false, ref: e.ref, rows: [], judged: 0, skipped: 0, missing: 0, newPairs: 0, pending: 0, degraded: '', cursor: '', why: e.why }
  const cursor = opts.cursor === undefined ? readMoveCursor(p) : opts.cursor
  let c = locateMoveCursor(e.entries, cursor)
  let degraded = ''
  if (c < 0) {
    degraded = cursor
      ? `位移游标 ${cursor.slice(0, 11)} 不在本次回看的 ${e.entries.length} 条 reflog 里(已被裁?)⇒ 退回最近 ${REF_MOVE_WINDOW} 次位移,更早的未覆盖`
      : `位移台账尚无游标(首轮)⇒ 只回看最近 ${REF_MOVE_WINDOW} 次位移(不把 ${e.entries.length} 条历史整批重判,§12e 恒红门禁令)`
    c = Math.min(REF_MOVE_WINDOW, Math.max(0, e.entries.length - 1))
  }
  // 位移 k 对应 (from=entries[k+1], to=entries[k]);严格新于游标的就是 k < c
  const all = pairMoves(e.entries, true).filter((m) => m.toIndex < c)
  const batch = all.length > cap ? all.slice(all.length - cap) : all // 超上界时从**最旧**一段先判
  const pending = all.length - batch.length
  const remote = opts.remote === undefined ? remoteHeadSha(cwd) : opts.remote
  const audit = auditRefMoves(cwd, { moves: batch, ref: e.ref, remote, atRef: opts.atRef ?? 'HEAD' })
  /**
   * 游标推进的唯一正解:`all`/`batch` 都是**新→旧**序,`batch[0].toIndex` 才是"本轮判到的最新那条",
   * `batch[last].toIndex` 是最旧那条 —— 拿后者当新游标会把已判过的再判一遍(2026-10-23 首跑现读
   * 就是这么暴露的:连跑两轮 newPairs 43 → 42、同一段位移被重判)。
   * 正解:本轮判了 toIndex ∈ [minTo, …] ⇒ 下一轮必须恰好判 toIndex < minTo ⇒ 新游标 = 下标 minTo 那条
   * 的 sha;未截断时 minTo=0 ⇒ 游标=reflog 顶部 ⇒ 下一轮只剩真正的新位移。
   * 这里必须用 `toIndex` 而不是 `all.length` 反推:相邻两条同 sha 的位移会被 `pairMoves` 滤掉,
   * 配对数与条目下标未必相等,按下标算才不错位。
   */
  const minTo = batch.length ? batch[0].toIndex : 0
  const nextCursor = e.entries[minTo]?.sha ?? ''
  if (nextCursor && nextCursor !== cursor) {
    try {
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, JSON.stringify({ cursor: nextCursor, at: new Date().toISOString(), swept: batch.length, pending }), 'utf8')
    } catch {
      /* 台账写不进只影响下轮重复审计,不得影响本轮判定(与合并台账同一条纪律) */
    }
  }
  return { ...audit, newPairs: batch.length, pending, swept: batch.length, degraded, cursor: nextCursor, why: '' }
}

/** 提交链上的口径:**只审"尚未进入 origin/main 的合并"**。
 *  历史里那枚已入库的事故(`9a0f7610e9`)不该把后来每一次提交都钉红 —— 一道按规矩写就红的门
 *  只会逼人 `--no-verify`,连带废掉其余全部守门。要回看历史用 `--limit N` 手工取证,
 *  要连别人推来的合并也覆盖用 `--all-new`(增量台账,由守护巡检调)。 */
/** 该 sha 在本仓对象库里能不能解析成提交(多机同仓 / 被 GC / 残值来自别台 ⇒ 常不可)。 */
function commitExists(sha, cwd = ROOT) {
  if (!sha) return false
  try {
    git(['cat-file', '-e', `${sha}^{commit}`], cwd)
    return true
  } catch {
    return false
  }
}

/**
 * 区间左端怎么选 —— 纯函数,好让三种情形都能被构造面证明(联网才能走到的 pendingMerges 本身不可单测)。
 *   `remote` 为空         ⇒ 'HEAD'(全量回看,保守)
 *   `remote` 可解析       ⇒ `${remote}..HEAD`
 *   `remote` **不可解析** ⇒ null ⇒ 调用方退到"有界 + 台账去重",绝不允许把 fatal 当结论
 */
export function chooseRange({ remote, exists }) {
  if (!remote) return 'HEAD'
  if (!exists) return null
  return `${remote}..HEAD`
}

/**
 * 当次远端真值(`sha` 优先、`stale` 残值兜底;取不到 ⇒ 空串)。
 * 只作"落点是否已入库"的对照面用,不拿它落槌 —— 拿残值落槌会把"未收敛"当成"已推送"(静默漏推)。
 * 抽成单出口是为了让 `pendingMerges` 与 A3 共用**同一次**联网解析(两次 ls-remote 在断网机器上
 * 各要付一次超时,本仓实测这一档最贵)。
 */
export function remoteHeadSha(cwd = ROOT) {
  try {
    const r = resolveRemoteHead('main', { root: cwd })
    return r.sha || r.stale || ''
  } catch {
    return ''
  }
}

export function pendingMerges(cwd = ROOT, remoteOverride) {
  // 区间左端优先用**当次服务器真值**:残值偏新 ⇒ 漏判别人推来的合并,偏旧 ⇒ 把已审过的重判一遍。
  // 但这一处的兜底方向与收敛器**相反**:收敛器拿残值落槌会把"未收敛"当成"已推送"(静默漏推),
  // 而本门的 `range` 一旦退化成 `'HEAD'` 就是**整条历史**重判 ⇒ 一道恒红门(只会逼人跳门,连带
  // 废掉其余守门)。所以连不上服务器时按 `stale` 残值取一个**保守下界**,宁可多判一轮。
  const remote = remoteOverride === undefined ? remoteHeadSha(cwd) : remoteOverride
  const range = chooseRange({ remote, exists: commitExists(remote, cwd) })
  if (range === null) {
    // 拿到了 sha,但它**不在本仓对象库里** —— 多机同仓时别台推来的头会被本地 GC 掉,或 `stale`
    // 残值本身就是另一台的历史。此时 `rev-list <sha>..HEAD` 直接 `fatal: Invalid revision range`,
    // 整门以 exit 2 崩掉,而批量器把非零计成"blocking 违规" ⇒ 一道与任何改动无关、也没人能修的
    // 恒红(实测 G-175:起点 90ce75ad2f5 在本仓不可解析)。出路不是跳过不判,而是退到
    // "回看最近 N 枚 + 增量台账去重":老提交不会反复红,新合进来的照样被判到一次。
    console.log(
      `  ⚠️ 远端残值 ${remote.slice(0, 11)} 在本仓不可解析(多机同仓/已被 GC)⇒ 不拿它当区间左端,` +
        `改按 HEAD 回看最近 ${DEFAULT_LIMIT} 枚并用增量台账去重(不静默跳过)`,
    )
    return auditUnseen(DEFAULT_LIMIT, cwd)
  }
  return auditRecent(Infinity, range, cwd)
}

/** 增量台账:记录"已经判过的合并 → 丢失数",别人推来的合并也会被判到一次,
 *  老提交不会反复红。返回本轮**新判**的结果。 */
export function markerPath(root) {
  return join(root, '.ihui-agent', 'state', 'merge-addition-loss-audited.json')
}
/**
 * 台账取磁盘面 —— 但取法只有层的一份实现(`readWorktreeFile`)，不再自己 `readFileSync`。
 *
 * 为什么这一处**必须**跟磁盘、不能跟 HEAD/索引：`.ihui-agent/state/` 被 `.gitignore` 忽略
 * （实测 `git check-ignore -v` 命中 `.gitignore:364`），它结构上永不出现在任何检出面里，
 * 而它的价值恰恰是"上一轮写过、这一轮就别重判"。改成读 HEAD 会让台账永远为空 ⇒ 每轮把
 * 已入库的历史事故重判一遍 ⇒ 一台恒红门（只会逼人 `--no-verify`，连带废掉全部守门）。
 * 三面内容不一致时取哪一面由**语义**决定，不得照抄"索引优先"的模板。
 *
 * 读不到 / 解不开 ⇒ 退回空表（= 本轮全部重判，保守方向）；巡检链上抛错等于整轮不判。
 */
export function readMarker(p) {
  try {
    const text = readWorktreeFile(dirname(p), basename(p))
    if (text === null) return {}
    const j = JSON.parse(text)
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}
export function auditUnseen(limit = 400, cwd = ROOT, p = markerPath(cwd)) {
  const seen = readMarker(p)
  const all = git(['rev-list', '-n', String(limit), 'HEAD'], cwd).split('\n').filter(Boolean)
  const fresh = []
  for (const sha of all) {
    // 必须用 hasOwn 而不是真值判断:记为 0(干净)是最常见的结论,`if (seen[sha])` 会把
    //   每一枚"干净的合并"每轮重判一遍(自检第 8 例就是这么抓到的)。
    if (Object.hasOwn(seen, sha)) continue
    if (parentsOf(sha, cwd).length < 2) {
      seen[sha] = 0 // 非合并也记账,免得每轮重扫
      continue
    }
    const r = auditOne(sha, cwd)
    seen[sha] = r.lost.length
    fresh.push(r)
  }
  try {
    writeFileSync(p, JSON.stringify(seen), 'utf8')
  } catch {
    /* 台账写不进去只影响下轮重复审计,不得影响判定 */
  }
  return fresh
}

function selfTest() {
  // 落点 = scripts/lib/scratch-dir.mjs 的 mkScratch(AGENTS §26 临时夹具唯一落点):
  // 本夹具要模拟"非 git 目录",落在仓库树内会让 git rev-parse 向上逃逸到真仓;
  // 而 os.tmpdir() 在活进程里可能仍钉在 C 盘,不得用作夹具根。
  const dir = mkScratch('ihui-merge-loss-')
  const run = (...a) => git(a, dir)
  const fails = []
  const ok = (name, cond, note = '') => {
    console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` —— ${note}`}`)
    if (!cond) fails.push(name)
  }
  try {
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    writeFileSync(join(dir, 'base.txt'), 'shared\n', 'utf8')
    run('add', 'base.txt')
    run('commit', '-qm', 'init')

    // A 侧:另一个人新增了一个模块并入库
    run('checkout', '-qb', 'a')
    writeFileSync(join(dir, 'feature.ts'), 'export const x = 1\n', 'utf8')
    run('add', 'feature.ts')
    run('commit', '-qm', 'feat: 新增 feature.ts')
    run('checkout', '-q', 'main')

    // B 侧:碰另一个文件(与 A 无冲突)
    writeFileSync(join(dir, 'other.txt'), 'b side\n', 'utf8')
    run('add', 'other.txt')
    run('commit', '-qm', 'chore: B 侧改动')

    // 正常三路合并 ⇒ 必须放过
    run('merge', '-q', '--no-edit', 'a')
    const good = auditOne('HEAD', dir)
    ok('正常合并(对侧新增被保住)⇒ 判绿', good.lost.length === 0 && good.merge, JSON.stringify(good.lost))

    // 造一次事故:整棵树按"合并前的 B"回写(等价于取某一侧 tree),feature.ts 消失
    const bSide = run('rev-parse', 'HEAD^1^').trim() // B 侧合并前的提交
    const tree = run('rev-parse', `${bSide}^{tree}`).trim()
    const head = run('rev-parse', 'HEAD').trim()
    const bad = run('commit-tree', tree, '-p', head, '-p', bSide, '-m', 'merge 事故复现').trim()
    run('update-ref', 'HEAD', bad)
    // `commit-tree` + `update-ref` 只动引用,**不动索引** ⇒ 索引仍停在事故前的那棵树,
    // 而本门的"后手补回"维读的是 HEAD 树(2026-10-19 加的对照面)。不先把索引对齐到新的 HEAD,
    // 下面那枚普通提交会顺手把 `feature.ts` 带回树里 ⇒ 夹具自己造出"已被后手补回"的假现场,
    // 于是"提交链必须抓到事故"两例读成 0。真实历史里没有这种索引/引用劈叉的中间态,所以
    // 这里改的是**夹具的保真度**,不是判据(判据一个字没动)。
    run('reset', '-q', '--mixed', 'HEAD')
    const hit = auditOne('HEAD', dir)
    ok(
      '合并吞掉对侧新增文件 ⇒ 必须判红并点名',
      hit.lost.some((l) => l.path === 'feature.ts'),
      JSON.stringify(hit),
    )
    // 反向对照:同一条判据不得把"两侧都没有的路径"算成丢失
    ok('吞掉清单只含真消失的路径(不含仍存活的 base.txt)', !hit.lost.some((l) => l.path === 'base.txt'))
    // 反向对照:判据只看"合并",普通提交一律不参与(合法删除的正解是合并之后单独一步显式操作)
    writeFileSync(join(dir, 'base.txt'), 'shared\nlater edit\n', 'utf8')
    run('add', 'base.txt')
    run('commit', '-qm', 'chore: 普通提交')
    const after = auditOne('HEAD', dir)
    ok('普通提交(非合并)不参与该判据', after.merge === false, JSON.stringify(after))

    // 未知旗标必须喊响:本门没有 --json,旧写法把它静默吃掉 ⇒ "文字出了、退出码没出"那一型
    ok(
      '未知旗标 ⇒ 未判定名单(--json 这类不得被静默忽略)',
      unknownFlags(['--json']).join() === '--json' &&
        unknownFlags(['--rev', 'abc', '--staged', '--all-new']).length === 0 &&
        unknownFlags(['--limit', '5']).length === 0 &&
        unknownFlags(['--nope', '--json']).join() === '--nope,--json',
      JSON.stringify([unknownFlags(['--json']), unknownFlags(['--rev', 'abc', '--staged']), unknownFlags(['--nope', '--json'])]),
    )

    // 提交链口径必须"抓得住未推的、放得下已推的":
    //   抓住 = 阳性对照(否则这道门形同虚设);放下 = 别人早已入库的历史事故不得把后来每次提交钉红
    const badSha = run('rev-parse', 'HEAD~1').trim() // 上面那枚普通提交的父 = 事故合并
    const pendBefore = pendingMerges(dir)
    ok(
      'origin/main 之前 ⇒ 事故合并必须被提交链口径抓到',
      pendBefore.some((r) => r.rev === badSha && r.lost.length > 0),
      JSON.stringify(pendBefore.map((r) => [r.rev.slice(0, 8), r.lost.length])),
    )
    run('update-ref', 'refs/remotes/origin/main', badSha)
    const pendAfter = pendingMerges(dir)
    ok(
      '同一枚合并进入 origin/main 后 ⇒ 不再拦后来的提交(历史事故不该恒红)',
      !pendAfter.some((r) => r.rev === badSha),
      JSON.stringify(pendAfter.map((r) => [r.rev.slice(0, 8), r.lost.length])),
    )

    // 增量台账:同一枚合并只判一次(别人推来的也能被判到)
    const marker = join(dir, 'marker.json')
    const firstRound = auditUnseen(400, dir, marker)
    ok(
      '--all-new 首轮必须把事故判出来',
      firstRound.some((r) => r.rev === badSha && r.lost.length > 0),
      JSON.stringify(firstRound.map((r) => [r.rev.slice(0, 8), r.lost.length])),
    )
    const secondRound = auditUnseen(400, dir, marker)
    ok('台账已记过的合并不得每轮重复判红', secondRound.every((r) => r.lost.length === 0) && secondRound.length === 0, JSON.stringify(secondRound.map((r) => [r.rev.slice(0, 8), r.lost.length])))
    ok('坏台账文件退回空表而非抛(巡检链上抛错等于整轮不判)', JSON.stringify(readMarker(join(dir, 'nope.json'))) === '{}')

    // ── 取材面纪律构造面证明(2026-09-26 迁入 lib/face-reader.mjs 时补，三条一起读) ──
    // ① 两面旗同给 = 自相矛盾 ⇒ 判死，绝不挑一面做出"看起来判过了"的绿。
    const both = faceFromArgv(['--staged', '--worktree'])
    ok('两面旗同给 ⇒ 判死(不得挑一面的绿)', both.face === null && Boolean(both.error), JSON.stringify(both))
    // ② `--staged` 必须被如实认下(迁移前它整枚被静默忽略，账面读起来像"已按档判")。
    ok('单面旗如实取档 ⇒ --staged 不再被静默忽略(无旗仍默认 head)', faceFromArgv(['--staged']).face === 'staged' && faceFromArgv([]).face === 'head' && faceFromArgv(['--staged']).error === null)
    // ③ 台账的三面分歧现场：磁盘 / 索引 / HEAD 内容**各不相同** ⇒ 判据必须跟磁盘(运行态)。
    //    方向与"索引优先"的模板**相反**，这是有意的：`.ihui-agent/state/` 被 .gitignore 忽略，
    //    台账结构上不在任何检出面里，而它的价值就是"上一轮写过、这一轮别重判"。
    //    反向对照同时钉住"哪天有人把它改成按 HEAD/索引取，本条立刻红"。
    writeFileSync(join(dir, 'marker3.json'), '{"face":"head-side"}\n', 'utf8')
    run('add', 'marker3.json')
    run('commit', '-qm', 'ledger 入库一版')
    writeFileSync(join(dir, 'marker3.json'), '{"face":"index-side"}\n', 'utf8')
    run('add', 'marker3.json')
    writeFileSync(join(dir, 'marker3.json'), '{"face":"disk-live"}\n', 'utf8')
    const three = readMarker(join(dir, 'marker3.json'))
    ok(
      '台账三面内容各异 ⇒ 必须跟磁盘面(运行态)，不得跟 HEAD/索引',
      three.face === 'disk-live',
      `实得 ${JSON.stringify(three)}(head/index 那份被取用即红)`,
    )

    // ── 后手补回豁免(2026-10-19 立;立项现场是现读的:枚 f2f9086 吞掉 7 个路径,15 分钟后
    //    另一会话用 139209161bc 补回其中 5 个,而本门**只比父子树**⇒ 一小时后再判仍报"丢失 7",
    //    守护据此寄出 CRITICAL 信,收件人照做去补的是一批早已在树里的文件(§5e-1 在这里失效)。
    //    放在最末尾是刻意的:前面每一例都要求"feature.ts 仍处于被吞状态"才成立。────────────
    writeFileSync(join(dir, 'feature.ts'), 'export const feat = 1\n', 'utf8')
    run('add', 'feature.ts')
    run('commit', '-qm', 'fix: 把被合并吞掉的 feature.ts 补回')
    const healed = auditOne(bad, dir)
    ok(
      '后手已补回 ⇒ 该路径不再算丢失而进 repaired,**其余未补的照旧判丢失**(部分补回不得洗成整体清白)',
      healed.repaired.some((x) => x.path === 'feature.ts') &&
        !healed.lost.some((x) => x.path === 'feature.ts') &&
        healed.lost.some((x) => x.path === 'other.txt'),
      JSON.stringify({ lost: healed.lost, repaired: healed.repaired }),
    )
    // 阳性对照:对照面换成"合并自己"(feature.ts 在那一面上确实没有)⇒ 同一枚必须重新判丢失。
    // 摘掉新分支(压根不查 atRef)不会让这例翻绿;把 atRef 当摆设也不会让它翻绿。
    const stillLost = auditOne(bad, dir, bad)
    ok(
      '对照面换成合并自身 ⇒ 同一枚必须重新判丢失(证明豁免真读了 atRef)',
      stillLost.lost.some((x) => x.path === 'feature.ts') && stillLost.repaired.length === 0,
      JSON.stringify({ lost: stillLost.lost, repaired: stillLost.repaired }),
    )
    // 对照面取不到 ⇒ 退回判丢失并点名,绝不拿"量不到"冒绿(§0.3)
    const noOracle = auditOne(bad, dir, 'refs/tags/不存在-的-对照')
    ok(
      'atRef 取不到 ⇒ 退回按丢失判 + 报名,不记绿',
      noOracle.lost.some((x) => x.path === 'feature.ts') && Boolean(noOracle.atRefUndetermined),
      JSON.stringify({ lost: noOracle.lost.map((x) => x.path), why: noOracle.atRefUndetermined }),
    )

    // ── A2(2026-10-22,G-939 判据缺口①:基底维)──────────────────────────────
    // 两父都有 P、且 P 早在基底里 ⇒ A1 的前件"P ∉ 基底"恒假;真正的三路合并不可能丢掉它,
    // 所以"结果树里没有"= 结果树不是这枚合并的合并产物。
    writeFileSync(join(dir, 'shared-both.txt'), 'both sides keep it\n', 'utf8')
    run('add', 'shared-both.txt')
    run('commit', '-qm', 'feat: 两父都将拥有 shared-both.txt')
    const pA = run('rev-parse', 'HEAD').trim()
    // 第二父:树同 pA、多走一枚提交(保证 merge-base 就是 pA ⇒ 基底里有 shared-both.txt)
    const pB = run('commit-tree', `${pA}^{tree}`, '-p', pA, '-m', 'feat: 第二父(同树)').trim()
    // 结果树取"pA 的父"那棵(没有 shared-both.txt)—— commit-tree 拿旧基线当结果的形态
    const pAParent = run('rev-parse', `${pA}^`).trim()
    const staleTree = run('rev-parse', `${pAParent}^{tree}`).trim()
    const a2Merge = run('commit-tree', staleTree, '-p', pA, '-p', pB, '-m', 'A2 事故:结果树取旧基线').trim()
    const a2 = auditOne(a2Merge, dir, a2Merge)
    ok(
      'A2:两父都有的路径在结果树里缺席 ⇒ 必须判红(A1 因"P ∈ 基底"结构上看不见这一型)',
      a2.lost.some((x) => x.path === 'shared-both.txt' && x.byAllParents === true),
      JSON.stringify(a2.lost),
    )
    ok(
      'A2 反向对照:正常三路合并的两父共有路径不得被算成丢失(A2 不得把正常形态判红)',
      good.lost.length === 0 && good.repaired.length === 0,
      JSON.stringify({ lost: good.lost, repaired: good.repaired }),
    )

    // ── A3(2026-10-22,G-939 判据缺口②:提交图连通维)────────────────────────
    // 现场没有合并提交可判:分支引用被 update-ref 侧移,整条线掉出祖先链。
    writeFileSync(join(dir, 'dropped.ts'), 'export const dropped = 1\n', 'utf8')
    run('add', 'dropped.ts')
    run('commit', '-qm', 'feat: 只存在于将被丢掉的那条线上')
    const keepTip = run('rev-parse', 'HEAD').trim()
    const dropTo = run('rev-parse', 'HEAD~1').trim()
    run('update-ref', '-m', 'relay align(复现 commit-tree+CAS 旁路落地)', 'HEAD', dropTo)
    const moves = refMoves(dir)
    ok(
      'A3:分支 reflog 的相邻侧移必须被读出来(from 不是 to 的祖先)',
      moves.ok && moves.moves.some((m) => m.from === keepTip && m.to === dropTo),
      JSON.stringify(moves.moves.slice(0, 3)),
    )
    const dropRow = auditRefMove(keepTip, dropTo, dir, dropTo)
    ok(
      'A3:被侧移丢出祖先链的路径必须判红并点名(A1/A2 在这一型上没有合并提交可审)',
      dropRow.lost.some((x) => x.path === 'dropped.ts') && dropRow.droppedCommits >= 1,
      JSON.stringify({ lost: dropRow.lost, dropped: dropRow.droppedCommits }),
    )
    ok(
      'A3 反向对照:正常前进(from 是 to 的祖先)一律放过(不许把每次提交都读成位移)',
      auditRefMove(dropTo, keepTip, dir, keepTip).lost.length === 0 && auditRefMove(dropTo, keepTip, dir, keepTip).droppedCommits === 0,
    )
    const liveCatch = auditRefMoves(dir)
    ok(
      'A3 提交链口径:未被推送的侧移在 reflog 顶部 ⇒ 下一次提交时必须抓到(这是它值钱的那一格)',
      liveCatch.ok && liveCatch.rows.some((r) => r.from === keepTip && r.rev === dropTo && r.lost.some((x) => x.path === 'dropped.ts')),
      JSON.stringify(liveCatch.rows.map((r) => [r.from.slice(0, 7), r.rev.slice(0, 7), r.lost.length])),
    )
    writeFileSync(join(dir, 'dropped.ts'), 'export const dropped = 1\n', 'utf8')
    run('add', 'dropped.ts')
    run('commit', '-qm', 'fix: 把被侧移丢掉的 dropped.ts 补回')
    const relanded = auditRefMove(keepTip, dropTo, dir, 'HEAD')
    ok(
      'A3:后手补回 ⇒ 该路径进 repaired 不再算丢失(与 A1 同口径,不得洗成无声)',
      relanded.repaired.some((x) => x.path === 'dropped.ts') && !relanded.lost.some((x) => x.path === 'dropped.ts'),
      JSON.stringify({ lost: relanded.lost, repaired: relanded.repaired }),
    )
    // 两端都已入库 ⇒ 历史,不重判(§12e)。origin/main 指向 keepTip(它同时含两端)。
    run('update-ref', 'refs/remotes/origin/main', keepTip)
    const scoped = auditRefMoves(dir)
    ok(
      'A3 口径:位移两端都已进 origin/main ⇒ 不重判(历史事故不得把后来每次提交钉红)',
      !scoped.rows.some((r) => r.from === keepTip && r.rev === dropTo),
      JSON.stringify(scoped.rows.map((r) => [r.from.slice(0, 7), r.rev.slice(0, 7)])),
    )
    run('checkout', '-q', '--detach', 'HEAD')
    const detached = refMoves(dir)
    ok(
      'A3:分离头 ⇒ 该维如实报未判定(不拿"没有位移"冒充判过)',
      detached.ok === false && Boolean(detached.why),
      JSON.stringify(detached),
    )
    run('checkout', '-q', 'main')

    // ── A4(2026-10-23,G-939 残段:位移维的射程)────────────────────────────
    // 侧移由旁路落地的 update-ref 写进 reflog,而旁路**不跑钩子** ⇒ 位移发生时没有门在跑;
    // 本仓 40 条位移实测只覆盖约 53 分钟 ⇒ 滑出窗口后窗口档永远读不到它。游标档必须读到。
    // 真实时序是"巡检先跑过一轮(游标落在当时顶部)⇒ 之后才发生侧移 ⇒ 侧移滑出窗口",
    // 所以夹具必须先把游标定下来再造事故:首轮无游标时游标档只承诺窗口(它拿不到"上次判到哪儿")。
    const agedMarker = join(dir, 'aged.json')
    const seed = sweepRefMoves(dir, { markerPath: agedMarker, remote: '' })
    ok(
      'A4 首轮无游标 ⇒ 必须点名"退回窗口",不得静默当"没有位移"(§0.3)',
      Boolean(seed.degraded) && Boolean(seed.cursor),
      JSON.stringify({ degraded: seed.degraded.slice(0, 24), cursor: seed.cursor.slice(0, 8) }),
    )
    writeFileSync(join(dir, 'aged-out.ts'), 'export const aged = 1\n', 'utf8')
    run('add', 'aged-out.ts')
    run('commit', '-qm', 'feat: 只存在于将被丢掉的那条线上')
    const agedKeep = run('rev-parse', 'HEAD').trim()
    const agedTo = run('rev-parse', 'HEAD~1').trim()
    run('update-ref', '-m', 'relay align(旁路落地不跑钩子)', 'HEAD', agedTo)
    run('reset', '-q', '--mixed', 'HEAD') // 引用与索引必须对齐,否则下一枚普通提交把 aged-out.ts 顺手带回树里 = 夹具自造"已补回"
    for (let i = 0; i < 60; i++) {
      writeFileSync(join(dir, `w${i}.txt`), `${i}\n`, 'utf8')
      run('add', `w${i}.txt`)
      run('commit', '-qm', `chore: 普通提交 ${i}`)
    }
    const agedWin = pairMoves(reflogEntries(dir).entries)
    ok(
      'A4 前提:60 枚普通提交后,这次侧移确实滑出了窗口档的 40 条(否则这一臂证不了射程)',
      !agedWin.some((m) => m.from === agedKeep && m.to === agedTo) && agedWin.length > 0,
      JSON.stringify({ win: agedWin.length, has: agedWin.some((m) => m.from === agedKeep) }),
    )
    const agedSweep = sweepRefMoves(dir, { markerPath: agedMarker, remote: '' })
    const agedRow = agedSweep.rows.find((r) => r.from === agedKeep && r.rev === agedTo)
    ok(
      'A4:滑出窗口的侧移必须被游标档判到并点名路径(窗口档在这一例上永远读不到它)',
      Boolean(agedRow) && agedRow.lost.some((x) => x.path === 'aged-out.ts') && agedRow.droppedCommits >= 1,
      JSON.stringify({ rows: agedSweep.rows.length, swept: agedSweep.swept, pending: agedSweep.pending }),
    )
    ok(
      'A4 幂等:游标推到已判处 ⇒ 同一段位移不得重判(每 30 分钟一轮的巡检重复报警就是噪声)',
      sweepRefMoves(dir, { markerPath: agedMarker, remote: '' }).newPairs === 0,
    )
    const cappedA = sweepRefMoves(dir, { markerPath: join(dir, 'cap.json'), remote: '', cursor: '', maxPairs: 5, scanLimit: 2000 })
    const cappedB = sweepRefMoves(dir, { markerPath: join(dir, 'cap.json'), remote: '' })
    ok(
      'A4 截断:超上界必须点名 pending,且下一轮恰好补上欠的量(不重不漏)',
      cappedA.swept === 5 && cappedA.pending > 0 && cappedB.newPairs === cappedA.pending && cappedB.pending === 0,
      JSON.stringify({ a: [cappedA.swept, cappedA.pending], b: [cappedB.newPairs, cappedB.pending] }),
    )
    ok(
      'A4 反向对照:只走快进的仓整条游标扫描必须 0 行(不许把每次提交读成位移)',
      (() => {
        const d2 = mkScratch('ihui-merge-loss-ff-')
        try {
          const y = (...a) => git(a, d2).trim()
          y('init', '-q', '-b', 'main')
          y('config', 'user.email', 't@t')
          y('config', 'user.name', 't')
          writeFileSync(join(d2, 'a.txt'), 'a\n', 'utf8')
          y('add', 'a.txt')
          y('commit', '-qm', 'init')
          for (let i = 0; i < 6; i++) {
            writeFileSync(join(d2, `n${i}.txt`), `${i}\n`, 'utf8')
            y('add', `n${i}.txt`)
            y('commit', '-qm', `chore ${i}`)
          }
          const s = sweepRefMoves(d2, { markerPath: join(d2, 'm.json'), remote: '' })
          return s.ok && s.rows.length === 0 && s.judged === 0 && s.newPairs > 0
        } finally {
          rmScratch(d2)
        }
      })(),
    )
    ok(
      'A4 取证档:--move 必须被 unknownFlags 认得(带值不吃值),而单边/空段取值必须报错',
      unknownFlags(['--move', 'a..b']).length === 0 &&
        parseMoveSpec('只有单边').error !== undefined &&
        parseMoveSpec('from..').error !== undefined &&
        parseMoveSpec('..to').error !== undefined &&
        parseMoveSpec('a..b').from === 'a' &&
        parseMoveSpec('a..b').to === 'b',
      JSON.stringify([unknownFlags(['--move', 'a..b']), parseMoveSpec('x')]),
    )
    ok(
      'A4 游标定位:同一枚 sha 在 reflog 里重复出现时必须取**最旧**那次(方向永远是宁可重判,不可漏判)',
      locateMoveCursor([{ sha: 'X' }, { sha: 'Y' }, { sha: 'X' }, { sha: 'Z' }], 'X') === 2 && locateMoveCursor([{ sha: 'X' }], '缺') === -1,
      JSON.stringify(locateMoveCursor([{ sha: 'X' }, { sha: 'Y' }, { sha: 'X' }], 'X')),
    )

    // ── A5(2026-10-24,G-939 判据缺口③:内容存续维)──────────────────────────
    // 侧移丢掉的那条线改的是**已存在的文件**(不是新增路径)⇒ A3 的路径成员性当面判绿
    // (原案 11 枚里 6 枚正是这一形态,`--move` 修复前只报 5 条 repaired)。
    writeFileSync(join(dir, 'content-a.txt'), 'v0\n', 'utf8')
    run('add', 'content-a.txt')
    run('commit', '-qm', 'A5 基底:content-a.txt')
    const cBase = run('rev-parse', 'HEAD').trim()
    writeFileSync(join(dir, 'content-a.txt'), 'v1 by dropped line\n', 'utf8')
    run('add', 'content-a.txt')
    run('commit', '-qm', 'A5 feat: 改已有文件内容')
    const cFrom = run('rev-parse', 'HEAD').trim()
    run('update-ref', '-m', 'A5 relay align(旁路落地)', 'HEAD', cBase)
    const a5 = auditRefMove(cFrom, cBase, dir, cBase)
    ok(
      'A5:路径还在、内容却退回共同基底 ⇒ 必须判红并点名(路径成员性维在该形态上结构失明)',
      a5.lost.some((x) => x.path === 'content-a.txt' && x.contentReverted === true) && a5.repaired.length === 0 && a5.droppedCommits >= 1,
      JSON.stringify({ lost: a5.lost, repaired: a5.repaired, dropped: a5.droppedCommits }),
    )
    ok('A5 反向对照:正常前进(from 是 to 的祖先)一律放过', auditRefMove(cBase, cFrom, dir, cFrom).lost.length === 0)
    // update-ref 不动索引/工作树 ⇒ 先把夹具对齐,免得下一枚提交把 content-a 的 v1 顺手带进"基底"
    run('reset', '-q', '--hard', cBase)
    // 内容被另一侧演进过(与基底、该线都不同)⇒ 不能归因给这次位移,必须放过(§12e 不误伤)
    writeFileSync(join(dir, 'content-b.txt'), 'b0\n', 'utf8')
    run('add', 'content-b.txt')
    run('commit', '-qm', 'A5 基底:content-b.txt')
    const bBase = run('rev-parse', 'HEAD').trim()
    writeFileSync(join(dir, 'content-b.txt'), 'from side\n', 'utf8')
    run('add', 'content-b.txt')
    run('commit', '-qm', 'A5 改 content-b')
    const bFrom = run('rev-parse', 'HEAD').trim()
    run('reset', '-q', '--hard', bBase)
    writeFileSync(join(dir, 'content-b.txt'), 'to side evolved\n', 'utf8')
    run('add', 'content-b.txt')
    run('commit', '-qm', 'A5 另一侧也改 content-b')
    const bTo = run('rev-parse', 'HEAD').trim()
    ok(
      'A5 反向对照:结果内容与基底/该线都不同 ⇒ 别人演进过,不得归因给位移',
      auditRefMove(bFrom, bTo, dir, bTo).lost.length === 0,
      JSON.stringify(auditRefMove(bFrom, bTo, dir, bTo).lost),
    )
    // 后手重落(blob 离开基底)⇒ repaired,与 A1/A3 同口径
    writeFileSync(join(dir, 'content-a.txt'), 'v1 re-landed by hand\n', 'utf8')
    run('add', 'content-a.txt')
    run('commit', '-qm', 'A5 fix: 重落 content-a.txt')
    const healedA = auditRefMove(cFrom, cBase, dir, 'HEAD')
    ok(
      'A5:后手重落 ⇒ 进 repaired 不再判红(内容已离开基底,不重复喊人补)',
      healedA.repaired.some((x) => x.path === 'content-a.txt' && x.contentReverted === true) && !healedA.lost.some((x) => x.path === 'content-a.txt'),
      JSON.stringify({ lost: healedA.lost, repaired: healedA.repaired }),
    )
  } finally {
    treeCache.clear()
    rmScratch(dir)
  }
  console.log(fails.length ? `\n❌ ${fails.length} 例失败` : '\n合并新增存续性自检通过')
  process.exit(fails.length ? 1 : 0)
}

/**
 * 判定面旗标的选择 —— 纯函数，构造面可证（`main` 要跑真 git，不可单测）。
 *
 * 如实登记：本门的判据面对象是**提交图**（commit / tree 对象），它与"取哪一档"无关 ——
 * 三档拿到的都是同一份 `rev-list` 历史。这里接 `selectFace` 只办两件必要的事：
 *  ① `--staged` 不再被**静默忽略**（此前 runner 下发它等于什么都没发生，而账面读起来像"已按档判"）；
 *  ② 两面旗同给 = 自相矛盾 ⇒ 判死 exit 2，绝不挑一面的绿（口径与 113/118 同形）。
 */
export function faceFromArgv(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
}

/**
 * 未知旗标 ⇒ 未判定(§0.3「取不到输入不得冒充判过」)。
 * 立因:本门**没有** `--json` 档,而旧写法把未知旗标静默吃掉 —— `--gate --json` 那型"文字出了、
 * 退出码没出"的同族事故在本仓已经量到过实价(一台 HEAD=1 而 HEAD --json=0)。
 * 与其让人猜"它到底认不认这个旗标",不如当场喊响:它认不得。
 * 纯函数,好让构造面直接证明(含"带值旗标不把值误当旗标"这一条反向对照)。
 */
const KNOWN_FLAGS = new Set(['--self-test', '--staged', '--worktree', '--all-new', '--rev', '--limit', '--move'])
const VALUE_FLAGS = new Set(['--rev', '--limit', '--move'])
export function unknownFlags(argv) {
  const unknown = []
  for (let i = 0; i < argv.length; i++) {
    const tok = String(argv[i])
    if (!tok.startsWith('--')) continue
    if (KNOWN_FLAGS.has(tok)) {
      if (VALUE_FLAGS.has(tok)) i += 1 // 该旗标的取值位跳过,免得把 `--rev abc` 的 abc 读成旗标
      continue
    }
    unknown.push(tok)
  }
  return unknown
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const unk = unknownFlags(argv)
  if (unk.length) {
    console.error(`❌ 未判定:本门不认识旗标 ${unk.join(' ')} —— 认不得它 ≠ 判过了(可用:${[...KNOWN_FLAGS].join(' ')})`)
    process.exit(2)
  }
  const { face, error } = faceFromArgv(argv)
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    process.exit(2)
  }
  assertRepoRoot(ROOT, '本门')
  // G-322:--rev / --limit 给旗标不给值一律 exit 2 点名 —— 旧写法漏值时把 undefined 当提交规格
  // 直取(空结论照出)、--limit 缺值得 NaN 使"回看 N 枚"窗口被吞成"审计全部"。
  const revFlag = requireFlagValue(argv, '--rev', { noun: '提交规格' })
  if (revFlag.error) {
    console.error(`❌ ${revFlag.error}`)
    process.exit(2)
  }
  const limitFlag = requireFlagValue(argv, '--limit', { noun: '正整数' })
  if (limitFlag.error) {
    console.error(`❌ ${limitFlag.error}`)
    process.exit(2)
  }
  if (limitFlag.present && (!/^\d+$/.test(limitFlag.value) || Number(limitFlag.value) <= 0)) {
    console.error(`❌ --limit 必须是正整数,实得:${JSON.stringify(limitFlag.value)}`)
    process.exit(2)
  }
  const moveFlag = requireFlagValue(argv, '--move', { noun: '<from>..<to>' })
  if (moveFlag.error) {
    console.error(`❌ ${moveFlag.error}`)
    process.exit(2)
  }
  // 两枚"单枚档"旗标同给 = 自相矛盾 ⇒ 判死,不挑一面的结论(与 faceFromArgv 同一条纪律)
  if (moveFlag.present && revFlag.present) {
    console.error(`❌ 无法判定:--move 与 --rev 都是单枚取证档,同给等于问两件事(实得 ${moveFlag.value} / ${revFlag.value})`)
    process.exit(2)
  }
  let rows
  let hardUndetermined = ''
  let moveAudit = { ok: true, ref: '', rows: [], judged: 0, skipped: 0, missing: 0, why: '' }
  if (revFlag.present) rows = [auditOne(revFlag.value)]
  else if (moveFlag.present) {
    const spec = parseMoveSpec(moveFlag.value)
    if (spec.error) {
      console.error(`❌ ${spec.error}`)
      process.exit(2)
    }
    moveAudit = { ok: true, ref: '', rows: [auditRefMove(spec.from, spec.to, ROOT, 'HEAD')], judged: 1, skipped: 0, missing: 0, why: '' }
    rows = [] // 单枚位移档不参与合并口径(没有合并提交可审),但账面仍要能报"审计合并 0 枚"
    // 指名问一次 ⇒ 问不到就是问不到,不得以"没丢"结绿(§0.3)。其余档沿用旧口径(未判定行照常点名)。
    if (moveAudit.rows[0].atRefUndetermined) hardUndetermined = moveAudit.rows[0].atRefUndetermined
  } else if (limitFlag.present) rows = auditRecent(Number(limitFlag.value))
  else if (argv.includes('--all-new')) {
    rows = auditUnseen()
    // A4(2026-10-23,G-939 残段):巡检档**必须**带位移游标 —— 旁路落地的 update-ref 不跑钩子,
    // 提交链那道窗口档(最近 40 条 ≈ 本仓 53 分钟)会在位移发生之后才第一次有机会跑。
    moveAudit = sweepRefMoves(ROOT)
  } else {
    // 远端位置只解析一次,合并口径与 A3(引用位移)共用 —— 断网时两次 ls-remote 各付一次超时。
    const remote = remoteHeadSha()
    rows = pendingMerges(ROOT, remote)
    // A3 只在提交链默认档跑:--rev / --move / --limit 是人工取证档(审的是指定的那一枚/那一次位移);
    // --all-new 现在也跑位移维,但跑的是**游标档**(A4),与这里的窗口档是两个口径,不混。
    moveAudit = auditRefMoves(ROOT, { remote })
  }
  const moveRows = moveAudit.rows || []
  const scope = revFlag.present
    ? `单枚 ${revFlag.value}`
    : moveFlag.present
      ? `单枚位移 ${moveFlag.value}`
      : limitFlag.present
        ? `回看 ${limitFlag.value} 枚`
        : argv.includes('--all-new')
          ? '增量台账新判(合并 + 位移游标 A4)'
          : '未入 origin/main 的合并'
  const bad = rows.filter((r) => r.lost.length)
  const badMoves = moveRows.filter((r) => r.lost.length)
  const nLost = bad.reduce((s, r) => s + r.lost.length, 0) + badMoves.reduce((s, r) => s + r.lost.length, 0)
  const nRepaired =
    rows.reduce((s, r) => s + ((r.repaired || []).length), 0) + moveRows.reduce((s, r) => s + ((r.repaired || []).length), 0)
  console.log(
    `[merge-addition-loss] 口径=${scope} / 面=${face}(判据读提交图) / 审计合并 ${rows.length} 枚 / 吞并 ${bad.length} 枚 / 丢失路径或回退内容 ${nLost} / 已被后手补回 ${nRepaired}(照常点名,不计丢失) / 引用位移 ${moveAudit.judged} 次(判红 ${badMoves.length})${
      moveAudit.swept === undefined ? '' : ` / 位移游标扫描 ${moveAudit.swept} 对(游标 ${String(moveAudit.cursor || '').slice(0, 11)})`
    } / RESULT lost=${nLost} merges=${rows.length} moved=${badMoves.length}`,
  )
  for (const r of [...rows, ...moveRows]) for (const l of r.repaired || []) console.log(`  ↻ ${l.path}  —— ${r.rev.slice(0, 11)} 曾吞掉,后手已在 ${l.restoredAt} 面补回`)
  for (const r of [...rows, ...moveRows]) if (r.atRefUndetermined) console.log(`  ⚠️ ${r.rev.slice(0, 11)}: ${r.atRefUndetermined}`)
  if (!moveAudit.ok) console.log(`  ⚠️ 引用位移维未判定:${moveAudit.why}(不记绿,也不冒红)`)
  if (moveAudit.missing) console.log(`  ⚠️ 引用位移维有 ${moveAudit.missing} 次位移的对象已不在本仓(问不到,不记绿也不冒红)`)
  if (moveAudit.degraded) console.log(`  ⚠️ 位移游标档退化:${moveAudit.degraded}`)
  if (moveAudit.pending) console.log(`  ⚠️ 位移游标档本轮判 ${moveAudit.swept} 对,仍有 ${moveAudit.pending} 对新位移未判 ⇒ 下一轮从最旧那段继续(不静默丢弃)`)
  for (const r of bad)
    for (const l of r.lost)
      console.log(`  ❌ ${l.path}  —— 由 ${l.addedBy.slice(0, 11)} 引入,合并提交 ${r.rev.slice(0, 11)} 的树里没有`)
  for (const r of badMoves)
    for (const l of r.lost)
      console.log(
        l.contentReverted
          ? `  ❌ ${l.path}  —— 由 ${l.addedBy.slice(0, 11)} 改动的**内容**在引用位移 ${r.from.slice(0, 11)} → ${r.rev.slice(0, 11)} 里静默退回共同基底(路径还在、blob 回到位移前的值;${r.droppedCommits} 枚提交被丢;reflog 消息「${String(r.msg || '空').slice(0, 40)}」)`
          : `  ❌ ${l.path}  —— 由 ${l.addedBy.slice(0, 11)} 引入,引用位移 ${r.from.slice(0, 11)} → ${r.rev.slice(0, 11)} 把该线整批丢出祖先链(${r.droppedCommits} 枚提交;reflog 消息「${String(r.msg || '空').slice(0, 40)}」)`,
      )
  if (nLost)
    console.log(
      '\n  合并不得吞掉任一父提交的"独有新增",引用位移也不得把已入库的提交整批丢出祖先链,更不得把改过的内容静默退回基底。修法:\n' +
        '  ① 合并吞新增:在合并结果里把该路径补回(`git checkout <引入它的提交> -- <路径>`),或改用真正的三路合并;\n' +
        '  ② 引用位移丢提交:把被丢的提参加回当前分支(`git merge <那枚>` 或 `cherry-pick`),先 `git tag lost-commit/<sha>` 保全原件;\n' +
        '  确要删除,请在合并之后单独 `git rm` 并写明理由(那时所有父提交都不含它,本判据放过)。',
    )
  if (hardUndetermined && !nLost) console.error(`❌ 未判定(exit 2):${hardUndetermined}`)
  process.exit(nLost ? 1 : hardUndetermined ? 2 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    // git 取数失败一律是**无法判定**（exit 2），不得冒烟成"没有吞并"（exit 0）的假绿。
    const msg = e instanceof Undetermined ? e.message : (e?.message ?? e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    process.exit(2)
  })
}

export const __test__ = {
  treePaths,
  parentsOf,
  basesOf,
  auditOne,
  auditRecent,
  pendingMerges,
  auditUnseen,
  readMarker,
  markerPath,
  chooseRange,
  commitExists,
  faceFromArgv,
  unknownFlags,
  // A2/A3(2026-10-22,G-939):镜像测试只能用门的实现,不得另写一份判据
  isAncestor,
  presentIn,
  blobMapAt,
  refMoves,
  auditRefMove,
  auditRefMoves,
  remoteHeadSha,
  REF_MOVE_WINDOW,
  // A4(2026-10-23,G-939 残段:位移维的射程)
  reflogEntries,
  pairMoves,
  locateMoveCursor,
  sweepRefMoves,
  moveMarkerPath,
  readMoveCursor,
  parseMoveSpec,
  MOVE_SCAN_LIMIT,
  MOVE_SWEEP_MAX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
