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
 * 判据只有一条,且结构上不可能误伤正常合并:
 *   **A1** 路径 P 满足「P ∈ 某父提交的树」∧「P ∉ 本次合并的共同基底 B」⇒ P 必须 ∈ M 的树。
 *   B 用 `git merge-base --all <parents>` 取,所以"P ∉ B"的定义就是**该侧独有的新增**;
 *   另一侧从未拥有过它,自然谈不上"那一侧删了它"。⇒ 合并结果里没有它 = 被合并吞掉。
 * 合法的删除不受影响:真要在合并里删掉对侧新增的文件,必须显式 `git rm`,而那会体现在
 * **父提交自身的树**里(P 同时不在所有父里 ⇒ 不触发 A1)。
 *
 * 用法:
 *   node scripts/check-merge-addition-loss.mjs                 # 提交链口径:未进入 origin/main 的合并
 *   node scripts/check-merge-addition-loss.mjs --staged        # runner 统一下发的档(如实记录,判据读同一份提交图)
 *   node scripts/check-merge-addition-loss.mjs --rev <sha>     # 只审计一枚(供钩子精确点名)
 *   node scripts/check-merge-addition-loss.mjs --all-new       # 增量台账:别人推来的合并也会被判一次
 *   node scripts/check-merge-addition-loss.mjs --limit 40      # 手工回看最近 40 枚(取证用,会连历史事故一起报)
 *   node scripts/check-merge-addition-loss.mjs --self-test     # 真临时仓端到端取证
 * 退出码:0 = 无吞并;1 = 有;2 = **无法判定**(git 取数失败 / 两面旗同用 / 脚本自身异常 —— 取数失败绝不静默放行,也绝不冒"无吞并"的绿)。
 *
 * 取材(2026-09-26 迁入共用层):所有 git 派生经 `scripts/lib/face-reader.mjs` 的 `gitRaw`,
 * 台账经该层的磁盘面读取入口 `readWorktreeFile`。本门**不读 blob 正文**(判据对象是 commit / tree
 * 对象,层的 `catBatch` 头解析只认 blob),所以它没有"索引面 vs HEAD 面"可切 —— 这一点由 `--self-test`
 * 第 ②③ 组构造面证明,而不是靠注释声称。
 */
import { writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, gitRaw, readWorktreeFile, resolveRemoteHead, selectFace } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_LIMIT = 12
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

export function pendingMerges(cwd = ROOT) {
  // 区间左端优先用**当次服务器真值**:残值偏新 ⇒ 漏判别人推来的合并,偏旧 ⇒ 把已审过的重判一遍。
  // 但这一处的兜底方向与收敛器**相反**:收敛器拿残值落槌会把"未收敛"当成"已推送"(静默漏推),
  // 而本门的 `range` 一旦退化成 `'HEAD'` 就是**整条历史**重判 ⇒ 一道恒红门(只会逼人跳门,连带
  // 废掉其余守门)。所以连不上服务器时按 `stale` 残值取一个**保守下界**,宁可多判一轮。
  let remote = ''
  try {
    const r = resolveRemoteHead('main', { root: cwd })
    remote = r.sha || r.stale || ''
  } catch {
    remote = ''
  }
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
const KNOWN_FLAGS = new Set(['--self-test', '--staged', '--worktree', '--all-new', '--rev', '--limit'])
const VALUE_FLAGS = new Set(['--rev', '--limit'])
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
  const rows = revFlag.present
    ? [auditOne(revFlag.value)]
    : limitFlag.present
      ? auditRecent(Number(limitFlag.value))
      : argv.includes('--all-new')
        ? auditUnseen()
        : pendingMerges()
  const scope = revFlag.present ? `单枚 ${revFlag.value}` : limitFlag.present ? `回看 ${limitFlag.value} 枚` : argv.includes('--all-new') ? '增量台账新判' : '未入 origin/main 的合并'
  const bad = rows.filter((r) => r.lost.length)
  const nLost = bad.reduce((s, r) => s + r.lost.length, 0)
  const nRepaired = rows.reduce((s, r) => s + ((r.repaired || []).length), 0)
  console.log(
    `[merge-addition-loss] 口径=${scope} / 面=${face}(判据读提交图) / 审计合并 ${rows.length} 枚 / 吞并 ${bad.length} 枚 / 丢失新增路径 ${nLost} / 已被后手补回 ${nRepaired}(照常点名,不计丢失)`,
  )
  for (const r of rows) for (const l of r.repaired || []) console.log(`  ↻ ${l.path}  —— ${r.rev.slice(0, 11)} 曾吞掉,后手已在 ${l.restoredAt} 面补回`)
  for (const r of rows) if (r.atRefUndetermined) console.log(`  ⚠️ ${r.rev.slice(0, 11)}: ${r.atRefUndetermined}`)
  for (const r of bad)
    for (const l of r.lost)
      console.log(`  ❌ ${l.path}  —— 由 ${l.addedBy.slice(0, 11)} 引入,合并提交 ${r.rev.slice(0, 11)} 的树里没有`)
  if (nLost)
    console.log(
      '\n  合并不得吞掉任一父提交的"独有新增"。修法:在合并结果里把该路径补回(`git checkout <引入它的提交> -- <路径>`),\n' +
        '  或改用真正的三路合并;确要删除,请在合并之后单独 `git rm` 并写明理由(那样所有父提交都不含它,本判据放过)。',
    )
  process.exit(nLost ? 1 : 0)
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

export const __test__ = { treePaths, parentsOf, basesOf, auditOne, auditRecent, pendingMerges, auditUnseen, readMarker, markerPath, chooseRange, commitExists, faceFromArgv, unknownFlags }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
