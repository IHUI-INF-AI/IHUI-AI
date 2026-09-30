#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 合并复活已删文件对账(§22 配套 · 守门 100 的另一半)
 *
 * 立因(2026-09-30 本会话实测,不是假想):`apps/miniapp-taro/src/components/SectionHeader.tsx`
 * 被显式删除(实测零消费者、零深导入),落地**两次**,两次都被并集式合并整批写回来。
 * `scripts/union-converge.mjs` 的构造按设计是「本侧整棵树 ∪ 对侧自己动过的路径」,而
 * **对侧的删除不随合并传播**;反过来,"我们的删除"在对侧眼里就是"对侧还留着这个路径"。
 * 这一型既不算冲突,也不进 diff 报告。
 *
 * 为什么现有判据覆盖不到(逐条核过,不是"大概不重叠"):
 *  - 守门 100 判 A1:「P ∈ 某父树 ∧ P ∉ 共同基底 ⇒ P 必须 ∈ 结果」,防的是**吞新增**。我们的形态是
 *    「P ∈ 基底 ∧ P ∈ 对侧父 ∧ P ∉ 本侧父」—— P **在基底里**,A1 的前件结构上不成立。
 *  - 守门 99 判**暂存删除**的存续性(索引里已删而引用仍在);这一型发生在已入库的合并上,且引用早被删干净。
 *
 * **DR1**(票面判据,逐字实现):对一枚合并 M(父 p1=本侧/ours、p2=对侧/theirs)与共同基底
 * B(`git merge-base --all p1 p2`,多基底逐条参与判定并如实计数):
 *   P ∈ tree(B) ∧ P ∈ tree(p2) ∧ P ∉ tree(p1) ∧ P ∈ tree(M) ⇒ 本侧的删除被这枚合并复活 ⇒ 判红。
 *   「P ∈ tree(B) ∧ P ∉ tree(p1)」由 `git diff --diff-filter=D B..p1` 一次取回,不拉全量树。
 *
 * ⚠️ **取证更正(2026-09-30,写完当天用真仓阳性对照量出来的)**:DR1 **抓不到本票立项那一枚**。
 *  把该路径"加回主线"的真凶是 `fb395c9a05`(不是票面写的 `26537d0fca` —— 那一枚的**两个父都已经有它**,
 *  它只是把已复活的副本又递了一手):
 *      p1 `82d37627` 无该路径 / p2 `65b8ac19` 有 / 结果有 / **merge-base `f04590afb8` 无** ——
 *      而那枚 base 恰好就是删掉它的那笔提交(标题原文「端内那条零消费者的 SectionHeader 副本删掉」)。
 *  机理:删除→复活是**多轮**发生的,第一轮复活之后分叉点就推进到"已删"的那一侧,于是下一枚把它带回的
 *  合并,其**基底里已经没有它** ⇒ DR1 的「P ∈ tree(B)」结构上不成立,DR1 在立项那一型上是瞎的。
 *  这不是"判据太严、存量恰好为 0",而是"判据看不见它自己要防的那一种"(守门 77 B6 只认点号、门 102
 *  只列右向箭头 同族)。因此补 **DR2**,取证不依赖基底:
 *   **DR2** P ∉ tree(p1) ∧ P ∈ tree(pk) ∧ P ∈ tree(M) ∧ 「p1 可达范围内有一笔非合并提交删掉了 P」存在
 *  最后这件是关键 discriminator:对侧独有的新增拿不出删除出处 ⇒ 不判(那是守门 100 的地盘;自检有
 *  成对反例,真仓另一枚形态相同的 `9a6e4de011` 也正因查不到删除出处而被正确放过)。
 *  DR1 的判据**一字未改**;两条取证在同一路径上只计一次(DR1 优先,标 `DR1+DR2`)—— 两处各计一次
 *  等于两份基线互相顶掉,真值就读不出来了。报告里分别标 `[DR1]`/`[DR2]`,不得合账。
 *
 * 正当豁免只有两条,且**都必须带证据、都不是登记一次永久免检**:
 *   ① 那枚**删除提交的信息**里含显式短语 `intentional-delete:`(常量只有一份,住 `lib/deletion-intent.mjs`)
 *      —— 证据住在提交对象里,每次现读,所以它结构上不可能烂成一张免检表;
 *   ② P 在 `scripts/data/deletion-survival-allowlist.json` 里带 `path + reason + reviewBy` 且未过期
 *      —— 缺字段 / 过期 / 形状漂 一律判红(腐烂的登记表比没有表更糟,它会替人做出"这一格已被想过"的判断)。
 *
 * 未判定档(逐条点名 + 计数,`--strict` 下有未判定即 **exit 2 拒绝出具合格证**):
 *  取不到父(grafted/shallow)、`merge-base` 解析不出、树成员性问不到、路径含换行(无法作为 batch 规格)、
 *  DR2 候选超出取证上限。
 *  「窗口内确实无合并」与「解析失败」**不并桶**:前者默认档如实报 EMPTY WINDOW 并明写"本门未做出任何
 *  结论"(不记绿),`--strict` 才判死;后者任何一档都是 exit 2(取数失败绝不冒"没有复活"的绿)。
 *
 * 定级与窗口口径(AGENTS §12e/§12f 是本门的设计前提,不是事后补的说明):
 *  默认档审**尚未进入 origin/main 的合并** —— 已入库的历史事故(含真仓现读那两条)若每轮重判,就是一台
 *  与任何提交都无关的恒红门,唯一结局是各会话 `--no-verify`、连带链上全部守门作废。远端残值不可解析时
 *  退到「回看最近 400 枚 + 增量台账去重」(每枚合并只判一次)。`--limit N` 是人工取证档(会连历史一起报)。
 *
 * 取材口径:git 派生一律经 `scripts/lib/face-reader.mjs` 的 `gitRaw` / `catBatchOids`(绝对 git 路径、
 * `safe.directory`、`windowsHide: true`、数字 `timeout`、`maxBuffer`、显式 stdio 在层里只有一份实现
 * ⇒ 守门 52/80/118 各判的那一型在本门结构上不出现)。**台账正文走层的 `catBatch`**、运行态去重台账走
 * `readWorktreeFile`(它按设计只存在于磁盘:`.workbuddy/` 被 .gitignore 忽略,改判 HEAD 会让它永远为空
 * ⇒ 每轮重判已入库历史 ⇒ 恒红,与守门 100 同一课)。
 *
 * 已接线(2026-09-30 同枚):`scripts/guardian-runner.mjs` 第 **168** 项(blocking,skipEnv =
 *  `HUSKY_SKIP_MERGE_DELETION_RESURRECTION`),AGENTS.md「守门脚本速查」与 README 守门表同枚点名。
 *  头注在注册前刻意不自称已接线(守门 89 的 R1/R2 判的正是"声称已接线而权威点零命中";镜像测试
 *  T1 是一条方向锁:未注册时必须读到"尚未接线"),本段随接线翻转 —— 两种状态各由同一枚 T1 钉住。
 *
 * 用法:
 *   node scripts/check-merge-deletion-resurrection.mjs                # 提交链口径(未入 origin/main 的合并)
 *   node scripts/check-merge-deletion-resurrection.mjs --staged       # 索引面取台账(判据面对象是提交图)
 *   node scripts/check-merge-deletion-resurrection.mjs --worktree     # 仅人工逃生舱
 *   node scripts/check-merge-deletion-resurrection.mjs --rev <sha>    # 只审一枚合并
 *   node scripts/check-merge-deletion-resurrection.mjs --limit 40     # 人工回看最近 40 枚(含已入库历史)
 *   node scripts/check-merge-deletion-resurrection.mjs --all-new      # 增量台账:别人推来的合并也判一次
 *   node scripts/check-merge-deletion-resurrection.mjs --strict       # 问责档:有未判定即 exit 2
 *   node scripts/check-merge-deletion-resurrection.mjs --json         # 机器可读结论
 *   node scripts/check-merge-deletion-resurrection.mjs --self-test    # 真临时仓端到端取证
 * 退出码:0 = 无复活(或如实的空窗口/仅报数);1 = 判红;2 = **无法判定**。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatch, catBatchOids, gitRaw, readWorktreeFile, resolveRemoteHead, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { ALLOWLIST_FILE, entryDefect, hasIntentionalMarker, parseAllowlist, rotEntries } from './lib/deletion-intent.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 默认回看窗口(问的是**提交数**,不是合并数):与票面"最近 400 枚"同形。 */
const DEFAULT_WINDOW = 400
/** 一次审计要问多棵树的成员性与逐路径的删除出处,层的默认 60s/64MB 会把大树读成"取不到"。 */
const GIT_TIMEOUT = 120000
const GIT_MAX_BUFFER = 256 * 1048576
/**
 * DR2 每枚合并的"删除出处"查证上限(每条候选一次派生)。分叉极大的配对能产出上千条
 * "对侧有而本侧没有"的路径,逐条查就是 §5b 记过的 fork 风暴;超上限一律**点名未判定**
 * (绝不静默当成"没有" —— 少扫不红,是一道假绿),出路是 `--rev <那枚合并>` 单独深挖。
 */
const DELETE_LOOKUP_CAP = 200

/**
 * 一切 git 派生只经取材层的 `gitRaw` —— 绝对路径 / safe.directory / quotepath / windowsHide /
 * 数字 timeout / maxBuffer / 显式 stdio 这七件事在层里只有一份实现(守门 52/80/118 各判一型)。
 * 本门读的是 commit / tree 对象与路径清单,不读 blob 正文;唯一真按路径读正文的是台账
 * (见 `readAllowlist`),它走层的 `catBatch` / `readWorktreeFile`。
 */
const git = (args, cwd = ROOT) => gitRaw(args, cwd, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })

/** 某提交有几个父。`rev-list --parents` 第一个 token 是提交**自己**,父从 index 1 起
 *  (取 slice(2) 会把第一父当自己 ⇒ 合并被误判成单父 ⇒ 整门恒绿;守门 100 自检第一轮就栽在这)。 */
export function parentsFromLine(line) {
  return String(line || '')
    .trim()
    .split(/\s+/)
    .slice(1)
    .filter(Boolean)
}

/**
 * 窗口内的合并提交(一次 `rev-list --parents` 拿全,不逐枚派生 —— N 次派生是 §5b 记过的 fork 风暴)。
 * @returns {{merges:Array<{sha:string,parents:string[]}>,enumeration:'ok'|'failed',error:string|null}}
 */
export function listMerges({ range = 'HEAD', window = DEFAULT_WINDOW, cwd = ROOT } = {}) {
  try {
    const out = git(['rev-list', '--parents', '-n', String(window), range], cwd)
    const merges = []
    for (const line of out.split(/\r?\n/)) {
      if (!line.trim()) continue
      const parents = parentsFromLine(line)
      if (parents.length >= 2) merges.push({ sha: line.trim().split(/\s+/)[0], parents })
    }
    return { merges, enumeration: 'ok', error: null }
  } catch (e) {
    return { merges: [], enumeration: 'failed', error: e?.message ?? String(e) }
  }
}

/** 一枚多父合并拆成(本侧,对侧)配对:第一父恒为本侧,其余每一父各成一档
 *  (八爪合并逐对判,绝不"只看第二父"而把其余侧的复活放过)。 */
export function pairsOf(merge) {
  const ours = merge.parents[0]
  return merge.parents.slice(1).map((theirs) => ({ ours, theirs }))
}

/** 共同基底:`merge-base --all`;解析不出 ⇒ null 交调用方落未判定(不猜、不冒绿)。 */
export function basesOf(ours, theirs, cwd = ROOT) {
  try {
    return git(['merge-base', '--all', ours, theirs], cwd).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  } catch {
    return null
  }
}

/** DR1 起点:本侧相对基底**删掉**的路径集合(一条 diff 同时给出「P ∈ tree(B)」与「P ∉ tree(ours)」)。 */
export function deletedOnOurs(base, ours, cwd = ROOT) {
  const out = git(['diff', '--diff-filter=D', '--name-only', '-z', `${base}..${ours}`], cwd)
  return out.split('\0').filter(Boolean)
}

/**
 * DR2 起点:「对侧有而本侧没有」的路径集合。它同时包含"对侧独有的新增",所以后面还必须过两道闸:
 * 结果树里有它 ∧ 本侧历史上真有一笔删除。少了第二道就是踩进守门 100 的地盘(自检有反例)。
 */
export function presentOnlyOnTheirs(ours, theirs, cwd = ROOT) {
  const out = git(['diff', '--diff-filter=A', '--name-only', '-z', `${ours}..${theirs}`], cwd)
  return out.split('\0').filter(Boolean)
}
/**
 * 一批路径在某个提交的树里**在不在**。用层的 `catBatchOids`(`cat-file --batch-check` 只回 oid、
 * 不回正文)⇒ 一次派生问完一批,而不是逐路径 `git cat-file -e`(N 次派生)。
 * @returns {{map:Map<string,boolean>,failed:boolean,skipped:number}}
 */
export function membership(rev, paths, cwd = ROOT) {
  const usable = paths.filter((p) => !p.includes('\n'))
  const specs = usable.map((p) => `${rev}:${p}`)
  const map = new Map()
  if (specs.length === 0) return { map, failed: false, skipped: paths.length - usable.length }
  let oids
  try {
    oids = catBatchOids(cwd, specs, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  } catch {
    return { map, failed: true, skipped: paths.length - usable.length }
  }
  for (const p of usable) {
    const oid = oids.get(`${rev}:${p}`)
    // 严格比较(仓规 eqeqeq):层的约定是"missing / unmerged / 非 blob ⇒ null",undefined 只可能
    // 来自规格没进 Map ⇒ 两者都算"问不到",不得用宽松比较把两态并成一态再当成"不在"。
    map.set(p, oid !== null && oid !== undefined)
  }
  return { map, failed: false, skipped: paths.length - usable.length }
}

/** 找出"是哪个**非合并**提交删掉了它"(先取 sha,再单独取其 %B)。刻意分两趟派生:候选极少,
 *  而把正文塞进同一条 format 需要 NUL 之类的分隔符 —— 分隔符与 %B 里的内容一旦冲突,读回来的
 *  就是半截 sha,表现为"找不到删除出处"(一个取证缺陷伪装成业务结论,本仓 §5d 同族)。 */
export function deleteCommitOf(path, ours, cwd = ROOT) {
  try {
    const out = git(['log', '-1', '--no-merges', '--diff-filter=D', '--format=%H', ours, '--', path], cwd)
    const sha = out.trim().split(/\r?\n/)[0] || null
    if (!sha) return { sha: null, body: '' }
    let body = ''
    try {
      body = git(['log', '-1', '--format=%B', sha], cwd)
    } catch {
      return { sha, body: '', failed: true }
    }
    return { sha, body }
  } catch {
    return { sha: null, body: '', failed: true }
  }
}

/** 组装一条候选:带上出处(哪一枚合并/两侧/基底)、命中它的取证规则,以及"是哪笔提交删的"。 */
function makeCandidate(path, merge, ours, theirs, base, rule, cwd) {
  const del = deleteCommitOf(path, ours, cwd)
  return { path, merge, ours, theirs, base, rule, deleteSha: del.sha, deleteBody: del.body, deleteLookupFailed: Boolean(del.failed) }
}

/**
 * 审计一枚合并:返回 DR1/DR2 命中的候选与未判定清单。
 * 未判定绝不并进候选、候选绝不静默少一条 —— "少扫"不红,是一道假绿(取材层 parseBatch 同一条禁令)。
 */
export function auditMerge(sha, parents, cwd = ROOT) {
  const undetermined = []
  // 候选按 `合并|路径` 去重:同一条债被两条取证各命中一次时只计一次(DR1 优先 —— 它带着基底这件
  // 更强的证据)。两处各计一次就是两份基线互相顶掉,真值再也读不出来。
  const candByKey = new Map()
  const pushCandidate = (c) => {
    const k = `${c.merge}|${c.path}`
    if (!candByKey.has(k)) candByKey.set(k, c)
    else if (candByKey.get(k).rule !== c.rule) candByKey.get(k).rule = `${candByKey.get(k).rule}+${c.rule}`
  }
  if (!parents || parents.length < 2) {
    return { rev: sha, merge: false, pairs: 0, candidates: [], undetermined: [`${String(sha).slice(0, 11)} 取不到两个父(grafted/shallow?)⇒ 未判定`] }
  }
  for (const { ours, theirs } of pairsOf({ sha, parents })) {
    const bases = basesOf(ours, theirs, cwd)
    if (!bases || bases.length === 0) {
      undetermined.push(`${sha.slice(0, 11)} 的 merge-base(${ours.slice(0, 8)}/${theirs.slice(0, 8)})解析不出 ⇒ 未判定`)
      continue
    }
    // ── DR1(票面判据,逐字实现)──
    for (const base of bases) {
      let dels
      try {
        dels = deletedOnOurs(base, ours, cwd)
      } catch (e) {
        undetermined.push(`${sha.slice(0, 11)} 相对基底 ${base.slice(0, 8)} 的删除清单取不到:${String(e?.message ?? e).split('\n')[0]}`)
        continue
      }
      if (dels.length === 0) continue
      const inTheirs = membership(theirs, dels, cwd)
      const inResult = membership(sha, dels, cwd)
      if (inTheirs.failed || inResult.failed) {
        undetermined.push(`${sha.slice(0, 11)} 的树成员性问不到(${dels.length} 条候选)⇒ 未判定`)
        continue
      }
      if (inTheirs.skipped > 0) undetermined.push(`${sha.slice(0, 11)} 有 ${inTheirs.skipped} 条路径含换行,无法作为 batch 规格 ⇒ 未判定`)
      for (const p of dels) {
        // P ∈ tree(theirs) ∧ P ∈ tree(M) —— 另两件前件已由 dels 给出(∈ 基底 ∧ ∉ 本侧)。
        if (inTheirs.map.get(p) === true && inResult.map.get(p) === true) pushCandidate(makeCandidate(p, sha, ours, theirs, base, 'DR1', cwd))
      }
    }
    // ── DR2(真仓取证逼出来的第二条取证路径;它**不是**对 DR1 的放宽,而是同一缺陷换一处取证)──
    // 见文件头"取证更正":本仓的删除/复活是多轮的,第一轮复活之后分叉点就推进到"已删"那一侧,
    // 于是下一枚把它带回的合并,其基底里已经没有它 ⇒ DR1 在**本票立项那一枚**上是瞎的。
    try {
      const addedOnly = presentOnlyOnTheirs(ours, theirs, cwd)
      if (addedOnly.length > 0) {
        const inResult = membership(sha, addedOnly, cwd)
        if (inResult.failed) {
          undetermined.push(`${sha.slice(0, 11)} 的 DR2 结果树成员性问不到(${addedOnly.length} 条)⇒ 未判定`)
        } else {
          const live = addedOnly.filter((p) => inResult.map.get(p) === true)
          const capped = live.slice(0, DELETE_LOOKUP_CAP)
          if (live.length > capped.length)
            undetermined.push(`${sha.slice(0, 11)} DR2 候选 ${live.length} 条超出取证上限 ${DELETE_LOOKUP_CAP} ⇒ 其余 ${live.length - capped.length} 条未判定(不是"没有")`)
          for (const p of capped) {
            const c = makeCandidate(p, sha, ours, theirs, bases[0], 'DR2', cwd)
            // 查不到删除出处 ⇒ 它只是"对侧独有的新增",属守门 100 的地盘,本门不判(也不记绿)。
            if (c.deleteSha) pushCandidate(c)
          }
        }
      }
    } catch (e) {
      undetermined.push(`${sha.slice(0, 11)} 的 DR2 取证失败:${String(e?.message ?? e).split('\n')[0]}`)
    }
  }
  return { rev: sha, merge: true, pairs: pairsOf({ sha, parents }).length, candidates: [...candByKey.values()], undetermined }
}

/**
 * 单条候选的定性(纯函数,构造面可证)。
 * 判序刻意是 **台账 → 找不到删除出处 → 短语 → 红**:
 *  - 台账按**路径**生效,不依赖"删除出处查得到查不到",所以它排第一;
 *  - 查不到删除出处时**不能**判红(那等于把"没看清"写成"有问题"),也不能判绿;
 *  - 短语只在删除提交的信息里逐字读到才算,不做模糊匹配(放宽即失效)。
 */
export function classifyCandidate(c, { allowByPath, today }) {
  const entry = allowByPath.get(c.path) ?? null
  if (entry) {
    const defect = entryDefect(entry, today)
    if (defect) return { kind: 'red', code: 'allowlist-defect', why: `台账条目有问题(${defect}),不得用它遮复活` }
    return { kind: 'waived-allowlist', why: `台账已裁该路径(复核日 ${entry.reviewBy})` }
  }
  if (!c.deleteSha) {
    const why = c.deleteLookupFailed
      ? '删除出处查询失败(git 未答)⇒ 无法确认是否被裁决过'
      : '本侧可达范围内找不到删掉它的非合并提交 ⇒ 无法确认是否被裁决过'
    return { kind: 'undetermined', why }
  }
  if (hasIntentionalMarker(c.deleteBody)) return { kind: 'waived-marker', why: '删除提交带 intentional-delete:' }
  return { kind: 'red', code: 'resurrected', why: '本侧显式删除被这枚合并带回结果树' }
}
/**
 * 汇总(纯函数):分桶 + 台账的**全表**检查。
 * 腐烂(条目已不在复活面)默认档只报名字,`--strict` 才判红:豁免条目天然对应"会被推走的合并",
 * 一枚复活被裁之后进入 origin/main 就永久退出提交链窗口,当场判红等于给之后**每一次**无关提交
 * 发一道红(AGENTS §12e/§12f:恒红门的唯一结局是逼人 `--no-verify`,连带废掉链上全部守门)。
 * 这不是"放松":同一条目的**过期/缺字段**在两个档都判红,所以它不可能变成永久免检。
 */
export function decide({ mergeRows, allowEntries, today, strict = false, enumeration = 'ok', mergesAudited = 0 }) {
  const allowByPath = new Map()
  for (const e of allowEntries || []) if (e.path) allowByPath.set(e.path, e)
  const reds = []
  const waivedMarker = []
  const waivedAllow = []
  const undetermined = []
  const consulted = new Set()
  for (const row of mergeRows || []) {
    undetermined.push(...(row.undetermined || []))
    for (const c of row.candidates || []) {
      if (allowByPath.has(c.path)) consulted.add(c.path)
      const v = classifyCandidate(c, { allowByPath, today })
      if (v.kind === 'red') reds.push({ ...c, ...v })
      else if (v.kind === 'waived-marker') waivedMarker.push(c)
      else if (v.kind === 'waived-allowlist') waivedAllow.push(c)
      else undetermined.push(`${c.path} @ ${c.merge.slice(0, 11)} —— ${v.why}`)
    }
  }
  // 台账的全表检查只看"没被任何候选用到"的条目 —— 命中候选的条目由 classifyCandidate 判红,那里带着
  // merge/ours/theirs 的上下文,说得出是哪一枚合并踩的;两处各计一次就是"同一笔债报两遍"。
  // 未被命中的条目照样必须判红:一张坏表不该等有人踩它才喊。两条变异对照各测各的(删掉这一段 ⇒
  // "未命中的过期条目"那条自检翻绿;删掉候选侧那一段 ⇒"④台账过期"翻绿)。
  for (const e of allowEntries || []) {
    if (e.path && consulted.has(e.path)) continue
    const defect = entryDefect(e, today)
    if (defect) reds.push({ kind: 'red', code: 'allowlist-defect', path: e.path ?? '(无 path 字段)', merge: '-', ours: '-', theirs: '-', why: `台账条目缺陷(未被任何候选引用):${defect}` })
  }
  const rot = rotEntries((allowEntries || []).filter((e) => e.path), reds.concat(waivedMarker, waivedAllow).map((c) => c.path))
  if (strict) for (const e of rot) reds.push({ kind: 'red', code: 'allowlist-rot', path: e.path, merge: '-', ours: '-', theirs: '-', why: `台账腐烂:${e.path} 已不在复活面` })
  const emptyWindow = enumeration === 'ok' && mergesAudited === 0
  let exit = 0
  if (reds.length) exit = 1
  else if (enumeration === 'failed') exit = 2
  else if (strict && (undetermined.length > 0 || emptyWindow)) exit = 2
  return { reds, waivedMarker, waivedAllow, undetermined, rot, emptyWindow, exit }
}

/**
 * 增量去重台账(与守门 100 同一设计):记录"已判过的合并 → 红数",别人推来的合并也会被判到一次,
 * 老提交不会反复红。**取磁盘面** —— `.workbuddy/` 被 .gitignore 忽略,它结构上永不出现在任何检出面里,
 * 而它的价值恰是"上一轮写过、这一轮别重判";改判 HEAD/索引 ⇒ 台账永远为空 ⇒ 每轮重判已入库历史
 * ⇒ 一台恒红门(与守门 100 的 `readMarker` 同一课:三面分歧时取哪一面由**语义**决定)。
 */
export function markerPath(root) {
  return join(root, '.workbuddy', 'merge-deletion-resurrection-audited.json')
}
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

/** 该 sha 在本仓对象库里能不能解析成提交(多机同仓 / 被 GC / 残值来自别台 ⇒ 常不可)。 */
export function commitExists(sha, cwd = ROOT) {
  if (!sha) return false
  try {
    git(['cat-file', '-e', `${sha}^{commit}`], cwd)
    return true
  } catch {
    return false
  }
}

/**
 * 区间左端(纯函数,三态都能构造证明;联网才能走到的分支不可单测):
 *  `remote` 为空 ⇒ 'HEAD'(有界回看 + 台账去重) / 可解析 ⇒ `${remote}..HEAD` / 不可解析 ⇒ null ⇒ 有界回看。
 *  残值一旦退化成"整条历史",本门就把已入库事故天天重判 ⇒ 恒红门;所以退路是"有界 + 去重",
 *  既不拿 fatal 当结论,也不干脆不判。
 */
export function chooseRange({ remote, exists }) {
  if (!remote) return 'HEAD'
  if (!exists) return null
  return `${remote}..HEAD`
}

/** 默认档口径:优先"未进 origin/main 的合并"。 */
export function pendingScope(cwd = ROOT) {
  let remote = ''
  try {
    const r = resolveRemoteHead('main', { root: cwd })
    remote = r.sha || r.stale || ''
  } catch {
    remote = ''
  }
  const range = chooseRange({ remote, exists: commitExists(remote, cwd) })
  if (range === null) return { range: 'HEAD', bounded: true, note: `远端残值 ${String(remote).slice(0, 11)} 在本仓不可解析 ⇒ 回看最近 ${DEFAULT_WINDOW} 枚并按台账去重` }
  if (range === 'HEAD') return { range: 'HEAD', bounded: true, note: `取不到远端位置 ⇒ 回看最近 ${DEFAULT_WINDOW} 枚并按台账去重` }
  return { range, bounded: false, note: `未进入 ${remote.slice(0, 11)} 的合并` }
}

/**
 * 台账取**被审面**(默认 HEAD blob / `--staged` 索引 blob / `--worktree` 磁盘),取法只有层的
 * `catBatch` / `readWorktreeFile` 两份出口 —— 不在本门里读文件(守门 118 判红)。
 * 文件在该面不存在 ⇒ 按"零条目"判并大声报出(absent);坏 JSON ⇒ 交调用方判"无法判定"(broken)。
 * 两者不得混:前者是"这张表还没人签过",后者是"表在但读不出",处置动作完全不同。
 */
export function readAllowlist(root, face) {
  if (face === 'worktree') return parseAllowlist(readWorktreeFile(root, ALLOWLIST_FILE))
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const spec = `${pre}${ALLOWLIST_FILE}`
  try {
    const m = catBatch(root, [spec], { maxBuffer: 1 << 27, timeout: GIT_TIMEOUT })
    return parseAllowlist(m.get(spec) ?? null)
  } catch (e) {
    return { absent: false, broken: `台账取不到:${String(e?.message ?? e).split('\n')[0]}`, entries: [] }
  }
}

/**
 * 一趟审计(root/face 可注入 ⇒ 自检能在真临时仓里跑,不必赌本机 HEAD 的历史形态)。
 * 如实登记:本门判据面对象是**提交图**,`--staged` 改的是台账取面而不是提交图 —— 结论行会印出这一点,
 * 不得让"面=staged"被读成"整条判据都换了面"(把没判写成判过了,是本仓最高频失效型)。
 */
export function runAudit(cwd = ROOT, face = 'head', opts = {}) {
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const scope = opts.scope || pendingScope(cwd)
  const listed = listMerges({ range: scope.range, window: opts.limit ?? DEFAULT_WINDOW, cwd })
  if (listed.enumeration === 'failed')
    return { scope, face, enumeration: 'failed', rows: [], merged: 0, skippedByLedger: 0, allow: null, today, reds: [], waivedMarker: [], waivedAllow: [], undetermined: [`窗口枚举失败:${listed.error}`], rot: [], emptyWindow: false, exit: 2 }
  const marker = opts.marker ?? markerPath(cwd)
  const seen = opts.dedupe ? readMarker(marker) : null
  const rows = []
  const nextSeen = seen ? { ...seen } : null
  let skippedByLedger = 0
  for (const m of listed.merges) {
    // 必须 hasOwn 而不是真值判断:记为 0(干净)是最常见结论,`if (seen[sha])` 会把每一枚干净的
    //   合并每轮重判一遍(守门 100 的自检就是这么抓到自己这条假账的)。
    if (nextSeen && Object.hasOwn(nextSeen, m.sha)) {
      skippedByLedger++
      continue
    }
    const r = auditMerge(m.sha, m.parents, cwd)
    rows.push(r)
    if (nextSeen) {
      const d = decide({ mergeRows: [r], allowEntries: [], today, strict: false, enumeration: 'ok', mergesAudited: 1 })
      nextSeen[m.sha] = d.reds.length
    }
  }
  if (nextSeen) {
    try {
      writeFileSync(marker, JSON.stringify(nextSeen), 'utf8')
    } catch {
      /* 台账写不进去只影响下轮重复审计,不得影响判定 */
    }
  }
  const allow = readAllowlist(cwd, face)
  if (allow.broken)
    return { scope, face, enumeration: 'failed', rows, merged: listed.merges.length, skippedByLedger, allow, today, reds: [], waivedMarker: [], waivedAllow: [], undetermined: [`台账不可判读:${allow.broken}`], rot: [], emptyWindow: false, exit: 2 }
  const merged = listed.merges.length
  const d = decide({
    mergeRows: rows,
    allowEntries: allow.entries,
    today,
    strict: Boolean(opts.strict),
    enumeration: 'ok',
    // emptyWindow 问的是"**窗口里有没有合并可判**",不是"本轮新判了几枚" —— 用 rows.length 会把
    // "台账已把全部合并判过一遍"误报成"窗口是空的",而那句报告是给人读的证据,报错了就是假结论。
    mergesAudited: merged,
  })
  return { scope, face, enumeration: 'ok', rows, merged, skippedByLedger, allow, today, ...d }
}

/** 面旗(纯函数,构造面可证)。接 selectFace 只办两件必要的事:① `--staged` 不被静默忽略
 *  (它改台账取面);② 两面旗同给 = 自相矛盾 ⇒ 判死,绝不挑一面做出"看起来判过了"的绿。 */
export function faceFromArgv(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
}

/**
 * 自检登记出口 —— **唯一**允许写"这条算不算过"的地方。
 * `cond` 必须是**已求值的布尔**;传函数一律记红并写明原因(§22c 实录:`t(name, () => …)` 里
 * `!!fn` 恒真 ⇒ 断言从写下起从未求值,账面绿而量到的只是"这个函数对象存在";更糟的是断言体
 * 用到的 helper 若在声明之前,真求值会当场抛 —— "没跑过"与"跑不通"叠在一起而账面只有勾)。
 * 这条分支由镜像测试用构造输入直接证明(`__test__.makeAssert`),不靠注释声称。
 */
export function makeAssert(sink = console.log) {
  const state = { pass: 0, fails: [] }
  const ok = (name, cond, note = '') => {
    if (typeof cond === 'function') {
      state.fails.push(name)
      sink(`❌ ${name} —— cond 是函数 ⇒ 断言从未求值(§22c:应写成 (() => {...})())`)
      return
    }
    if (cond === true) {
      state.pass++
      sink(`✅ ${name}`)
      return
    }
    state.fails.push(name)
    sink(`❌ ${name}${note ? ` —— ${note}` : ` —— 实得 ${JSON.stringify(cond)}`}`)
  }
  return { ok, state }
}
function selfTest() {
  // 夹具落点 = scripts/lib/scratch-dir.mjs 的 mkScratch(AGENTS §26 临时夹具唯一落点):本夹具要
  // 模拟"非 git 目录",落在仓库树内会让 rev-parse 向上逃逸到真仓;os.tmpdir() 在活进程里可能仍
  // 钉在 C 盘,不得用作夹具根。
  const dir = mkScratch('ihui-merge-del-res-')
  let goodDir = null
  let dr2Dir = null
  const TODAY = '2026-10-01'
  const SCOPE = { range: 'HEAD', bounded: false, note: '自检窗口' }
  const run = (...a) => git(a, dir)
  const { ok, state } = makeAssert()
  try {
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    writeFileSync(join(dir, 'keep.txt'), 'shared\n', 'utf8')
    writeFileSync(join(dir, 'SectionHeader.tsx'), 'export default function H(){return null}\n', 'utf8')
    run('add', 'keep.txt', 'SectionHeader.tsx')
    run('commit', '-qm', 'init: 基底里有 SectionHeader.tsx')

    // 对侧从基底分叉,只动另一个文件(它"还留着" SectionHeader.tsx ⇒ 对侧眼里没人删过它)
    run('checkout', '-qb', 'theirs')
    writeFileSync(join(dir, 'theirs-only.txt'), 'side note\n', 'utf8')
    run('add', 'theirs-only.txt')
    run('commit', '-qm', 'feat: 对侧改了另一个文件')
    run('checkout', '-q', 'main')

    const removeHeader = (msg) => {
      run('rm', '-q', 'SectionHeader.tsx')
      run('commit', '-qm', msg)
    }
    removeHeader('refactor: 移除零消费者的 SectionHeader')

    // 造一次并集合并:结果树 = 对侧整棵树(等价"逐个取对侧版本"⇒ 被删的路径回来)
    const theirs = run('rev-parse', 'theirs').trim()
    const ours1 = run('rev-parse', 'HEAD').trim()
    const theirsTree = run('rev-parse', `${theirs}^{tree}`).trim()
    const badMerge = run('commit-tree', theirsTree, '-p', ours1, '-p', theirs, '-m', 'merge(union): 归并').trim()
    run('update-ref', 'HEAD', badMerge)

    // ── ① 真复活 ⇒ 必红,并点名路径 / 合并 / 本侧 / 对侧 / 那枚删除提交 ──
    const a1 = runAudit(dir, 'head', { scope: SCOPE, today: TODAY })
    const hit = a1.reds.find((r) => r.path === 'SectionHeader.tsx')
    ok('①真复活必红并点名路径', Boolean(hit), `实得 ${JSON.stringify(a1.reds.map((r) => r.path))}`)
    const delSha = run('log', '-1', '--no-merges', '--diff-filter=D', '--format=%H', ours1, '--', 'SectionHeader.tsx').trim()
    ok('①点名到"是哪个非合并提交删掉了它"', Boolean(hit) && hit.deleteSha === delSha, `期望 ${delSha} 实得 ${hit && hit.deleteSha}`)
    ok('①结论行给全 merge/ours/theirs 三枚', Boolean(hit && hit.ours === ours1 && hit.theirs === theirs && hit.merge === badMerge), JSON.stringify(hit && [hit.ours.slice(0, 7), hit.theirs.slice(0, 7), hit.merge.slice(0, 7)]))
    ok('①默认档退出码 = 1(判红)', a1.exit === 1, String(a1.exit))
    ok('①该面没有台账 ⇒ absent 如实报出(不是"表坏了")', a1.allow.absent === true, JSON.stringify(a1.allow))
    // 阳性/反向对照:对侧独有的新增(theirs-only.txt)本侧从未有过、也没有删除出处 ⇒ 不得被判红。
    // 摘掉 DR2 的"删除出处"闸,这一条当场翻红(变异对照 G 实测)⇒ 它是本门不越界到守门 100 地盘的证明。
    ok('①对侧独有新增不在候选里(判据不越界到守门 100 的地盘)', !a1.rows.some((r) => (r.candidates || []).some((c) => c.path === 'theirs-only.txt')), JSON.stringify(a1.rows.map((r) => (r.candidates || []).map((c) => c.path))))

    // ── ② 同形态而删除提交带短语 ⇒ 只报数不判红(但必须出现在 waived 桶里) ──
    // 先把索引与工作树对齐到 HEAD(夹具专用:`read-tree --reset` + `checkout-index`,不碰任何共享仓)。
    // 不这么做,"回补"那一枚提交会**顺带把对侧的 theirs-only.txt 一起删掉**(它交的是滞后索引,
    // 正是 §12d 记过的真实形态)—— 于是同一枚合并各判两条,短语只盖得住带短语的那一条。
    run('read-tree', '--reset', 'HEAD')
    run('checkout-index', '-a', '-f')
    removeHeader('refactor: 再删一次\n\nintentional-delete: 实测零消费者、零深导入,与 adapters 版非同契约')
    const ours2 = run('rev-parse', 'HEAD').trim()
    const badMerge2 = run('commit-tree', theirsTree, '-p', ours2, '-p', theirs, '-m', 'merge(union) 第二枚').trim()
    run('update-ref', 'HEAD', badMerge2)
    const a2 = runAudit(dir, 'head', { scope: SCOPE, today: TODAY })
    ok('②删除提交带 intentional-delete: ⇒ 该枚不判红', !a2.reds.some((r) => r.code === 'resurrected' && r.merge === badMerge2), JSON.stringify(a2.reds.map((r) => [r.merge.slice(0, 7), r.code])))
    ok('②但必须当"被豁免掉的候选"报出来(报数不静默)', a2.waivedMarker.some((c) => c.path === 'SectionHeader.tsx' && c.merge === badMerge2), JSON.stringify(a2.waivedMarker.map((c) => c.merge.slice(0, 7))))
    ok('②上一枚(无短语)仍判红 —— 一条短语不替整条历史背书', a2.reds.some((r) => r.merge === badMerge), JSON.stringify(a2.reds.map((r) => r.merge.slice(0, 7))))
    // 计数唯一性:同一路径被 DR1 与 DR2 同时命中 ⇒ 只计一次并标 DR1+DR2。
    const c1 = a1.rows.flatMap((r) => r.candidates || []).filter((c) => c.path === 'SectionHeader.tsx')
    ok('DR1 与 DR2 同时命中同一路径 ⇒ 只计一次并标 DR1+DR2', c1.length === 1 && c1[0].rule === 'DR1+DR2', JSON.stringify(c1.map((c) => c.rule)))

    // ── ⑦ 已入库历史不重判(窗口语义)。刻意放在台账出现之前,否则抓到的是 allowlist 缺陷 ──
    const pendBefore = runAudit(dir, 'head', { today: TODAY })
    ok('⑦未推的合并 ⇒ 提交链口径必须抓到', pendBefore.reds.some((r) => r.path === 'SectionHeader.tsx' && r.code === 'resurrected'), JSON.stringify(pendBefore.reds.map((r) => r.code)))
    run('update-ref', 'refs/remotes/origin/main', badMerge2)
    const pendAfter = runAudit(dir, 'head', { today: TODAY })
    ok('⑦同一枚合并进入 origin/main 后 ⇒ 不再拦后来的提交(历史事故不该恒红)', !pendAfter.reds.some((r) => r.code === 'resurrected'), JSON.stringify(pendAfter.reds.map((r) => [r.path, r.code])))

    // 增量台账(--all-new 那一档):每枚合并只判一次
    const mk = join(dir, 'marker.json')
    const first = runAudit(dir, 'head', { scope: SCOPE, dedupe: true, marker: mk, today: TODAY })
    const second = runAudit(dir, 'head', { scope: SCOPE, dedupe: true, marker: mk, today: TODAY })
    ok('台账首轮实判到两枚合并', first.rows.length === 2, JSON.stringify(first.rows.map((r) => r.rev.slice(0, 7))))
    ok('台账已记过的合并不得每轮重扫', second.rows.length === 0 && second.skippedByLedger === 2, JSON.stringify([second.rows.length, second.skippedByLedger]))
    ok('坏台账文件退回空表而非抛(巡检链上抛错等于整轮不判)', JSON.stringify(readMarker(join(dir, 'nope.json'))) === '{}')

    // ── ③④ 台账端到端走**被审面**(把 JSON 提交进夹具仓的 ALLOWLIST_FILE 路径),这才证明
    //     "台账从被审的 HEAD 取",而不是按磁盘凑一份(守门 118 判的那一型)。 ──
    const commitLedger = (entries) => {
      mkdirSync(join(dir, 'scripts', 'data'), { recursive: true })
      writeFileSync(join(dir, ...ALLOWLIST_FILE.split('/')), JSON.stringify({ entries }, null, 2), 'utf8')
      run('add', '-f', ALLOWLIST_FILE)
      run('commit', '-qm', 'chore: 夹具登记豁免台账')
    }
    commitLedger([{ path: 'SectionHeader.tsx', reason: '夹具:该枚合并确需保留旧路径,已逐条读过两侧内容', reviewBy: '2099-01-01' }])
    const a3 = runAudit(dir, 'head', { scope: SCOPE, today: TODAY })
    ok('③带未过期台账 ⇒ 只报数不判红', !a3.reds.some((r) => r.path === 'SectionHeader.tsx' && r.code === 'resurrected'), JSON.stringify(a3.reds.map((r) => [r.path, r.code])))
    ok('③台账命中必须计入 waived 桶(不得静默消失)', a3.waivedAllow.some((c) => c.path === 'SectionHeader.tsx'), JSON.stringify(a3.waivedAllow.map((c) => c.path)))
    commitLedger([{ path: 'SectionHeader.tsx', reason: '夹具:这一条的复核日已经过期,必须续期或删除条目', reviewBy: '2020-01-01' }])
    const a4 = runAudit(dir, 'head', { scope: SCOPE, today: TODAY })
    ok('④台账过期 ⇒ 必红(红的理由是"过期",不是"字段不齐")', a4.reds.some((r) => r.code === 'allowlist-defect' && r.path === 'SectionHeader.tsx' && r.why.includes('过期')), JSON.stringify(a4.reds.map((r) => [r.code, r.why])))
    const candN = a4.rows.reduce((n, r) => n + (r.candidates || []).filter((c) => c.path === 'SectionHeader.tsx').length, 0)
    ok('④同一枚过期台账按候选各计一次,不得被两处循环重复计数', candN >= 2 && a4.reds.filter((r) => r.code === 'allowlist-defect' && r.path === 'SectionHeader.tsx').length === candN, JSON.stringify([candN, a4.reds.filter((r) => r.code === 'allowlist-defect').length]))
    commitLedger([{ path: 'SectionHeader.tsx', reviewBy: '2099-01-01' }])
    const a4b = runAudit(dir, 'head', { scope: SCOPE, today: TODAY })
    ok('台账缺 reason ⇒ 判红而非静默当空表(不得为过门放宽)', a4b.reds.some((r) => r.code === 'allowlist-defect'), JSON.stringify(a4b.reds.map((r) => r.code)))

    // ── ⑤ 正常三路合并(删除随本侧传播)⇒ 必绿;判据不得把正当形态算成复活 ──
    goodDir = mkScratch('ihui-merge-del-good-')
    const g = (...a) => git(a, goodDir)
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    writeFileSync(join(goodDir, 'a.txt'), '1\n', 'utf8')
    writeFileSync(join(goodDir, 'gone.ts'), 'x\n', 'utf8')
    g('add', 'a.txt', 'gone.ts')
    g('commit', '-qm', 'init')
    g('checkout', '-qb', 'side')
    writeFileSync(join(goodDir, 'b.txt'), '2\n', 'utf8')
    g('add', 'b.txt')
    g('commit', '-qm', 'feat: 侧分支')
    g('checkout', '-q', 'main')
    g('rm', '-q', 'gone.ts')
    g('commit', '-qm', 'refactor: 正常删掉它')
    g('merge', '-q', '--no-edit', 'side')
    const goodMerge = g('rev-parse', 'HEAD').trim()
    const g1 = runAudit(goodDir, 'head', { scope: SCOPE, today: TODAY })
    ok('⑤正常三路合并(删除传播到结果树)⇒ 判绿', g1.exit === 0 && g1.reds.length === 0, JSON.stringify(g1.reds))
    ok('⑤同一条判据不得把仍存活的 a.txt 算成候选', !g1.reds.some((r) => r.path === 'a.txt'))
    ok('⑤正常合并的窗口里确有合并(否则 ⑤ 什么都没测到)', g1.merged >= 1, String(g1.merged))

    // ── ⑥ 枚举到 0 个合并 ⇒ 与"解析失败"分桶,且不得记绿成合格证 ──
    writeFileSync(join(goodDir, 'c.txt'), '3\n', 'utf8')
    g('add', 'c.txt')
    g('commit', '-qm', 'chore: 线性提交,窗口内无合并')
    const lin = runAudit(goodDir, 'head', { scope: { range: `${goodMerge}..HEAD`, bounded: false, note: '无合并窗口' }, today: TODAY })
    const enumFailed = listMerges({ range: 'no-such-ref-xyz', cwd: goodDir })
    ok('⑥窗口内确实无合并 ⇒ 如实报 EMPTY WINDOW(不是"没有复活")', lin.merged === 0 && lin.emptyWindow === true, JSON.stringify([lin.merged, lin.emptyWindow]))
    const linStrict = decide({ mergeRows: lin.rows, allowEntries: lin.allow.entries, today: TODAY, strict: true, enumeration: 'ok', mergesAudited: lin.merged })
    ok('⑥无合并时默认档不判红,--strict 判死不记绿', lin.exit === 0 && linStrict.exit === 2, JSON.stringify([lin.exit, linStrict.exit]))
    ok('⑥区间解析失败 ⇒ enumeration=failed(与"确实无合并"不并桶)', enumFailed.enumeration === 'failed' && Boolean(enumFailed.error), JSON.stringify(enumFailed))
    ok('⑥解析失败任何一档都 exit 2', decide({ mergeRows: [], allowEntries: [], today: TODAY, strict: false, enumeration: 'failed', mergesAudited: 0 }).exit === 2)

    // ── ⑧⑨ DR2:真仓取证形态的复现(base 已被自己的删除推进过 ⇒ DR1 前件失效)。
    //     夹具逐字照 2026-09-30 实测的 `fb395c9a05` 那枚:base 就是那笔删除本身。 ──
    dr2Dir = mkScratch('ihui-merge-del-dr2-')
    const y = (...a) => git(a, dr2Dir)
    y('init', '-q', '-b', 'main')
    y('config', 'user.email', 't@t')
    y('config', 'user.name', 't')
    writeFileSync(join(dr2Dir, 'base.txt'), '1\n', 'utf8')
    writeFileSync(join(dr2Dir, 'Temp.tsx'), 'old copy\n', 'utf8')
    y('add', 'base.txt', 'Temp.tsx')
    y('commit', '-qm', 'init: 两边都曾有 Temp.tsx')
    y('rm', '-q', 'Temp.tsx')
    y('commit', '-qm', 'refactor: 删掉 Temp.tsx(这一笔后来就成了合并基底)')
    const dCommit = y('rev-parse', 'HEAD').trim()
    y('checkout', '-qb', 'theirs2')
    // 对侧"还带着旧副本"(真仓里就是被上一轮 union 合并递回来的那份),同时新增一个本侧从未有过的文件
    writeFileSync(join(dr2Dir, 'Temp.tsx'), 'old copy\n', 'utf8')
    writeFileSync(join(dr2Dir, 'brand-new.ts'), 'genuinely new\n', 'utf8')
    y('add', 'Temp.tsx', 'brand-new.ts')
    y('commit', '-qm', 'feat: 对侧带着旧副本 + 新增一个文件')
    const theirs2 = y('rev-parse', 'HEAD').trim()
    const theirs2Tree = y('rev-parse', `${theirs2}^{tree}`).trim()
    y('checkout', '-q', 'main')
    writeFileSync(join(dr2Dir, 'base.txt'), '2\n', 'utf8')
    y('add', 'base.txt')
    y('commit', '-qm', 'chore: 本侧继续走')
    const oursY = y('rev-parse', 'HEAD').trim()
    ok('⑧夹具确实复现了"基底=那笔删除"(DR1 前件在此形态下必然失效)', y('merge-base', '--all', oursY, theirs2).trim() === dCommit, `base=${y('merge-base', '--all', oursY, theirs2).trim()} 删除=${dCommit}`)
    const dr2Merge = y('commit-tree', theirs2Tree, '-p', oursY, '-p', theirs2, '-m', 'merge(union) 把旧副本带回').trim()
    y('update-ref', 'HEAD', dr2Merge)
    const a8 = runAudit(dr2Dir, 'head', { scope: SCOPE, today: TODAY })
    const hit8 = a8.reds.find((r) => r.path === 'Temp.tsx')
    ok('⑧真仓形态的复活必红(DR2)并点名那笔删除', Boolean(hit8) && String(hit8.rule).includes('DR2') && hit8.deleteSha === dCommit, JSON.stringify(a8.reds.map((r) => [r.path, r.rule, r.deleteSha && r.deleteSha.slice(0, 7)])))
    ok('⑨同一次合并里"对侧独有的新增"不得被判红(那是守门 100 的地盘)', !a8.reds.some((r) => r.path === 'brand-new.ts'), JSON.stringify(a8.reds.map((r) => r.path)))
    ok('⑨反向对照不是判据失明:brand-new.ts 确实在结果树里(它只是没有删除出处)', membership(dr2Merge, ['brand-new.ts'], dr2Dir).map.get('brand-new.ts') === true)

    // ── 构造面:腐烂只在 --strict 判红;而过期/缺字段在**两个档**都判红 ──
    const ghost = [{ path: 'ghost.ts', reason: '夹具:一条已经不在本次复活面上的条目,应当被了结', reviewBy: '2099-01-01' }]
    const rotStrict = decide({ mergeRows: [], allowEntries: ghost, today: TODAY, strict: true, enumeration: 'ok', mergesAudited: 3 })
    const rotLoose = decide({ mergeRows: [], allowEntries: ghost, today: TODAY, strict: false, enumeration: 'ok', mergesAudited: 3 })
    ok('--strict 下台账腐烂判红', rotStrict.reds.some((r) => r.code === 'allowlist-rot') && rotStrict.rot.length === 1, JSON.stringify(rotStrict.reds.map((r) => r.code)))
    ok('默认档腐烂不判红但必须报名字(不静默)', rotLoose.exit === 0 && rotLoose.reds.length === 0 && rotLoose.rot.length === 1, JSON.stringify([rotLoose.exit, rotLoose.reds.length, rotLoose.rot.length]))
    const deadEntry = [{ path: 'ghost2.ts', reason: '夹具:一条不在复活面上、且复核日已过期的条目', reviewBy: '2020-01-01' }]
    const dgLoose = decide({ mergeRows: [], allowEntries: deadEntry, today: TODAY, strict: false, enumeration: 'ok', mergesAudited: 3 })
    const dgStrict = decide({ mergeRows: [], allowEntries: deadEntry, today: TODAY, strict: true, enumeration: 'ok', mergesAudited: 3 })
    ok('台账全表检查有牙:未命中的过期条目在**两个档**都判红(过期不得只在问责档喊)', dgLoose.reds.some((r) => r.code === 'allowlist-defect') && dgStrict.reds.some((r) => r.code === 'allowlist-defect'), JSON.stringify([dgLoose.reds.map((r) => r.code), dgStrict.reds.map((r) => r.code)]))

    // ── 判序与边界的反向对照 ──
    const noDel = { path: 'x.ts', merge: 'a'.repeat(40), ours: 'b'.repeat(40), theirs: 'c'.repeat(40), deleteSha: null, deleteBody: '', deleteLookupFailed: true }
    ok('查不到删除出处 ⇒ 未判定(不冒红也不记绿)', classifyCandidate(noDel, { allowByPath: new Map(), today: TODAY }).kind === 'undetermined')
    const goodEntry = { path: 'x.ts', reason: '夹具:一条足够长的理由文本,用来证明台账的判序', reviewBy: '2099-01-01' }
    ok('查不到删除出处而台账有效 ⇒ 台账先生效(判序不许反)', classifyCandidate(noDel, { allowByPath: new Map([['x.ts', goodEntry]]), today: TODAY }).kind === 'waived-allowlist')
    ok('三个父 ⇒ 两个配对(八爪不得只看第二父)', pairsOf({ sha: 'm', parents: ['p1', 'p2', 'p3'] }).length === 2)
    ok('只写 intentional-delete(无冒号)不算裁决', hasIntentionalMarker('refactor: intentional-delete 了它') === false && hasIntentionalMarker('intentional-delete: x') === true)
    ok('区间左端三态:空 / 可解析 / 不可解析各落一档', chooseRange({ remote: '', exists: false }) === 'HEAD' && chooseRange({ remote: 'f'.repeat(40), exists: true }) === `${'f'.repeat(40)}..HEAD` && chooseRange({ remote: 'f'.repeat(40), exists: false }) === null)
    ok('两面旗同给 ⇒ 判死(不得挑一面的绿)', faceFromArgv(['--staged', '--worktree']).face === null && Boolean(faceFromArgv(['--staged', '--worktree']).error))
    ok('单面旗如实取档(无旗仍默认 head)', faceFromArgv(['--staged']).face === 'staged' && faceFromArgv([]).face === 'head')
    ok('父解析:slice 起点错就把合并读成单父(守门 100 那一课)', parentsFromLine(`${'a'.repeat(40)} ${'b'.repeat(40)} ${'c'.repeat(40)}`).length === 2 && parentsFromLine('a'.repeat(40)).length === 0)
    ok('自检 harness:传函数必须记红(§22c 恒绿断言)', (() => {
      const probe = makeAssert(() => {})
      probe.ok('一条恒真式', () => true)
      return probe.state.fails.length === 1 && probe.state.pass === 0
    })())
  } finally {
    rmScratch(dir)
    if (goodDir) rmScratch(goodDir)
    if (dr2Dir) rmScratch(dr2Dir)
  }
  console.log(state.fails.length ? `\n❌ ${state.fails.length} 例失败(通过 ${state.pass})` : `\n合并复活自检通过:${state.pass} 例`)
  process.exit(state.fails.length ? 1 : 0)
}
function report(res, { json }) {
  const scope = (res.scope && res.scope.note) || (res.scope && res.scope.range) || '默认'
  const judged = res.rows.length
  const nDR1 = res.reds.filter((r) => r.code === 'resurrected' && String(r.rule).startsWith('DR1')).length
  const nDR2 = res.reds.filter((r) => r.code === 'resurrected' && String(r.rule).includes('DR2')).length
  const nLedger = res.reds.filter((r) => r.code === 'allowlist-defect' || r.code === 'allowlist-rot').length
  const line =
    `[merge-deletion-resurrection] 口径=${scope} / 面=${res.face}(判据读提交图,面只改台账取面) / ` +
    `窗口内合并 ${res.merged}${res.skippedByLedger ? `(台账已判过 ${res.skippedByLedger},本轮实判 ${judged})` : ` / 实判 ${judged}`} / ` +
    `复活判红 ${res.reds.length}(DR1 ${nDR1} / DR2 ${nDR2} / 台账缺陷 ${nLedger}) / ` +
    `短语豁免 ${res.waivedMarker.length} / 台账豁免 ${res.waivedAllow.length} / 未判定 ${res.undetermined.length}`
  if (json) {
    console.log(
      JSON.stringify(
        {
          scope,
          face: res.face,
          merged: res.merged,
          judged,
          rows: res.rows,
          reds: res.reds,
          waivedMarker: res.waivedMarker.map((c) => ({ path: c.path, merge: c.merge, rule: c.rule })),
          waivedAllow: res.waivedAllow.map((c) => ({ path: c.path, merge: c.merge, rule: c.rule })),
          undetermined: res.undetermined,
          rot: res.rot.map((e) => e.path),
          allowlistAbsent: Boolean(res.allow && res.allow.absent),
          emptyWindow: res.emptyWindow,
          enumeration: res.enumeration,
          counts: { DR1: nDR1, DR2: nDR2, ledger: nLedger },
          exit: res.exit,
        },
        null,
        2,
      ),
    )
    return
  }
  console.log(line)
  if (res.allow && res.allow.absent) console.log(`  ℹ️ ${ALLOWLIST_FILE} 在该面不存在 ⇒ 按"零条目"判(不是"表坏了")`)
  for (const r of res.reds)
    console.log(
      `  ❌ ${r.path} [${r.rule || r.code}] —— 合并 ${String(r.merge).slice(0, 11)} 把本侧(${String(r.ours).slice(0, 11)})的删除复活成对侧(${String(r.theirs).slice(0, 11)})那份` +
        `${r.deleteSha ? `;删它的是 ${r.deleteSha.slice(0, 11)}` : ''}${r.code !== 'resurrected' ? ` ${r.why}` : ''}`,
    )
  for (const c of res.waivedMarker) console.log(`  ⚪ ${c.path} @ ${c.merge.slice(0, 11)} —— 只报数:删除提交 ${String(c.deleteSha).slice(0, 11)} 带 intentional-delete:`)
  for (const c of res.waivedAllow) console.log(`  ⚪ ${c.path} @ ${c.merge.slice(0, 11)} —— 只报数:台账已裁该路径`)
  for (const e of res.rot) console.log(`  ⚠️ 台账腐烂:${e.path} 已不在本次复活面(默认档只报名;问责跑 --strict)`)
  for (const u of res.undetermined) console.log(`  ❔ 未判定:${u}`)
  if (res.emptyWindow) console.log('  ⚠️ 窗口内没有任何合并提交 ⇒ 本门**未对"复活"做出任何结论**(不记绿;--strict 判死)')
  if (res.reds.length)
    console.log(
      '\n  合并不得把本侧显式删除的路径带回结果树。正解二选一:' +
        '\n  ① 在这枚合并之后**显式再删一次**,并把理由写进那枚删除提交(`intentional-delete: …`)—— 它成为"被裁决过的删除",此后只报数;' +
        `\n  ② 若这枚合并本就应当保留它(例如对侧已改了它),在 ${ALLOWLIST_FILE} 逐条登记 path+reason+reviewBy(必须逐条读过两侧内容)。`,
    )
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = faceFromArgv(argv)
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    process.exit(2)
  }
  assertRepoRoot(ROOT, '本门')
  const strict = argv.includes('--strict')
  const today = new Date().toISOString().slice(0, 10)
  const revIdx = argv.indexOf('--rev')
  const limitIdx = argv.indexOf('--limit')
  let res
  if (revIdx >= 0) {
    const sha = argv[revIdx + 1]
    if (!sha) {
      console.error('❌ 无法判定:--rev 需要一个提交规格')
      process.exit(2)
    }
    const parents = parentsFromLine(git(['rev-list', '--parents', '-n', '1', sha], ROOT))
    const one = auditMerge(sha, parents, ROOT)
    const allow = readAllowlist(ROOT, face)
    const d = allow.broken
      ? { reds: [], waivedMarker: [], waivedAllow: [], undetermined: [`台账不可判读:${allow.broken}`], rot: [], emptyWindow: false, exit: 2 }
      : decide({ mergeRows: [one], allowEntries: allow.entries, today, strict, enumeration: 'ok', mergesAudited: parents.length >= 2 ? 1 : 0 })
    res = { scope: { note: `单枚 ${sha}` }, face, allow, merged: parents.length >= 2 ? 1 : 0, skippedByLedger: 0, rows: [one], today, enumeration: 'ok', ...d }
  } else {
    res = runAudit(ROOT, face, {
      limit: limitIdx >= 0 ? Number(argv[limitIdx + 1]) : DEFAULT_WINDOW,
      strict,
      // `--limit` 是人工取证档 ⇒ **不**走去重(要能反复回看同一批历史);默认档与 --all-new 按台账去重,
      // 免得已入库的复活把之后每一次提交都钉红(§12e/§12f)。
      dedupe: limitIdx < 0,
      scope: limitIdx >= 0 ? { range: 'HEAD', bounded: false, note: `人工回看最近 ${argv[limitIdx + 1]} 枚(含已入库历史)` } : undefined,
    })
  }
  report(res, { json: argv.includes('--json') })
  process.exit(res.exit ?? 1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    // git 取数失败一律是**无法判定**(exit 2),不得冒烟成"没有复活"(exit 0)的假绿。
    const msg = e instanceof Undetermined ? e.message : (e?.message ?? e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    process.exit(2)
  })
}

export const __test__ = {
  parentsFromLine,
  listMerges,
  pairsOf,
  basesOf,
  deletedOnOurs,
  presentOnlyOnTheirs,
  membership,
  deleteCommitOf,
  auditMerge,
  classifyCandidate,
  decide,
  runAudit,
  readAllowlist,
  readMarker,
  markerPath,
  commitExists,
  chooseRange,
  pendingScope,
  faceFromArgv,
  makeAssert,
  DELETE_LOOKUP_CAP,
}
// 判据常量与台账 schema 的同源出口在 scripts/lib/deletion-intent.mjs(测试 import 它,不得再抄一份)。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠