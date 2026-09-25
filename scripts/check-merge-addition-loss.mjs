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
 *   node scripts/check-merge-addition-loss.mjs --rev <sha>     # 只审计一枚(供钩子精确点名)
 *   node scripts/check-merge-addition-loss.mjs --all-new       # 增量台账:别人推来的合并也会被判一次
 *   node scripts/check-merge-addition-loss.mjs --limit 40      # 手工回看最近 40 枚(取证用,会连历史事故一起报)
 *   node scripts/check-merge-addition-loss.mjs --self-test     # 真临时仓端到端取证
 * 退出码:0 = 无吞并;1 = 有;2 = 脚本自身异常(git 解析失败绝不静默放行)。
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveRemoteHead } from './lib/face-reader.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_LIMIT = 12

const git = (args, cwd = ROOT) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 256 * 1048576,
  })

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

/** 审计一枚提交:返回被吞掉的新增路径清单 */
export function auditOne(rev, cwd = ROOT) {
  const ps = parentsOf(rev, cwd)
  if (ps.length < 2) return { rev, merge: false, bases: [], lost: [] }
  const bases = basesOf(ps, cwd)
  const mine = treePaths(rev, cwd)
  const lost = []
  for (const p of ps) {
    const baseSets = bases.map((b) => treePaths(b, cwd))
    for (const path of treePaths(p, cwd)) {
      // 只问"这一侧独有的新增":任何共同基底里都没有 ⇒ 对侧无从"删除"它
      if (baseSets.some((s) => s.has(path))) continue
      if (!mine.has(path)) lost.push({ path, addedBy: p })
    }
  }
  return { rev, merge: true, bases, lost }
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
  return join(root, '.workbuddy', 'merge-addition-loss-audited.json')
}
export function readMarker(p) {
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'))
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
  const dir = mkdtempSync(join(tmpdir(), 'ihui-merge-loss-'))
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
  } finally {
    treeCache.clear()
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(fails.length ? `\n❌ ${fails.length} 例失败` : '\n合并新增存续性自检通过')
  process.exit(fails.length ? 1 : 0)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const revIdx = argv.indexOf('--rev')
  const limitIdx = argv.indexOf('--limit')
  const rows =
    revIdx >= 0
      ? [auditOne(argv[revIdx + 1])]
      : limitIdx >= 0
        ? auditRecent(Number(argv[limitIdx + 1]))
        : argv.includes('--all-new')
          ? auditUnseen()
          : pendingMerges()
  const scope =
    revIdx >= 0 ? `单枚 ${argv[revIdx + 1]}` : limitIdx >= 0 ? `回看 ${argv[limitIdx + 1]} 枚` : argv.includes('--all-new') ? '增量台账新判' : '未入 origin/main 的合并'
  const bad = rows.filter((r) => r.lost.length)
  const nLost = bad.reduce((s, r) => s + r.lost.length, 0)
  console.log(`[merge-addition-loss] 口径=${scope} / 审计合并 ${rows.length} 枚 / 吞并 ${bad.length} 枚 / 丢失新增路径 ${nLost}`)
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
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { treePaths, parentsOf, basesOf, auditOne, auditRecent, pendingMerges, auditUnseen, readMarker, markerPath, chooseRange, commitExists }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
