#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件面零丢失收敛合并(守门 100 的**修复出口**)
 *
 * 为什么要有它:`git-sync-converge` 在 merge-tree 冲突时只能报"需人工介入",而人工接手时
 * 最容易犯的错是**选边**。2026-09-24 实测:远端一枚合并把对侧独有的 **35 个新增路径整批抹掉**、
 * 72 个文件回退成旧基线(相对共同祖先净 −12014 行),它的提交信息还写着"双方每一行均存活" ——
 * 因为它检查的是**行**,事故发生在**文件**上。本会话手工做了两次 union 收敛,把这套配方固化成工具:
 * **不存在"哪一侧优先",只存在"谁独有的谁拿走"**。
 *
 * 构造(可断言的集合运算,不是启发式):
 *   合并树 = 本侧整棵树
 *           ∪ 对侧「相对共同基底自己动过的路径」逐个取对侧版本;
 *             对侧删掉的路径**不随合并传播** —— 删除必须在合并之后显式做出,那才是守门 100 认得的合法形态
 *           ∪ 活文档(PROJECT_PLAN / AGENTS / README)按「每行重数 = max(ours, theirs)」union。
 *   落地前自证:丢本侧路径 = 0 ∧ 丢对侧路径 = 0 ∧ 三份文档未存活行 = 0;
 *   落地后再让**守门 100 本人的 A1** 复核这枚新合并(用它的判据验它的产物,而不是"看着对")。
 *   写盘一律临时索引 + commit-tree + **CAS** update-ref(HEAD 被他人推进则本轮作废重来),
 *   绝不 checkout、绝不碰共享工作区(§12d)。
 *
 * 用法:
 *   node scripts/union-converge.mjs                  # 只报告(零副作用)
 *   node scripts/union-converge.mjs --apply          # 落地合并(幂等)
 *   node scripts/union-converge.mjs --theirs <sha>   # 指定目标(默认 origin/<当前分支>)
 *   node scripts/union-converge.mjs --self-test      # 真临时仓取证(含"选边必判失败"反向对照)
 * 退出码:0 = 无需合并或已落地且复核干净;1 = 判据不过/需人工/CAS 失败;2 = 脚本自身异常。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { auditOne } from './check-merge-addition-loss.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = 'C:/Program Files/Git/cmd/git.exe'
/** 多会话共写的活文档:行级 union(其余文件按路径整体取某一侧) */
export const LIVE_DOCS = ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md']
const GIT_TIMEOUT = 300000

function git(args, cwd = ROOT, input) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    input,
    encoding: 'utf8',
    windowsHide: true, // §5b:漏此参数在守护/钩子派生下必弹控制台窗
    timeout: GIT_TIMEOUT,
    maxBuffer: 512 * 1048576,
  }).trim()
}

function show(rev, p, cwd) {
  try {
    return git(['show', `${rev}:${p}`], cwd)
  } catch {
    return ''
  }
}

function blobOf(rev, p, cwd) {
  try {
    return git(['rev-parse', `${rev}:${p}`], cwd)
  } catch {
    return null
  }
}

function listPaths(rev, cwd) {
  return git(['ls-tree', '-r', '--name-only', rev], cwd).split('\n').filter(Boolean)
}

const counter = (s) => {
  const m = new Map()
  for (const l of s.split('\n')) m.set(l, (m.get(l) || 0) + 1)
  return m
}

/** 行级 union:以本侧顺序为脊柱,把对侧多出来的重数补在末尾;任一侧的每一行重数都不得减少。 */
export function unionLines(oursText, theirsText) {
  const co = counter(oursText)
  const ct = counter(theirsText)
  const out = oursText.split('\n')
  const need = new Map()
  for (const [l, n] of ct) {
    const own = co.get(l) || 0
    if (n > own) need.set(l, n - own)
  }
  const extra = []
  for (const l of theirsText.split('\n')) {
    const k = need.get(l) || 0
    if (k > 0) {
      extra.push(l)
      need.set(l, k - 1)
    }
  }
  const res = out.concat(extra).join('\n')
  const cr = counter(res)
  for (const [l, n] of [...co, ...ct]) if ((cr.get(l) || 0) < n) throw new Error(`行 union 丢行:${l.slice(0, 60)}`)
  return res.endsWith('\n') ? res : res + '\n'
}

/** 构造合并树。临时索引走 §26 的夹具唯一落点 `mkScratch` ——
 *  硬编码 `cwd/.ihui-agent/tmp` 会在"对临时仓库做取证"时直接 ENOENT(自检第一轮即如此),
 *  而且把夹具写进仓库树内还会让 git 的 toplevel 向上逃逸。 */
export function buildUnion(base, ours, theirs, cwd = ROOT) {
  const scratch = mkScratch('union-idx')
  const idx = join(scratch, 'index')
  try {
    const env = { ...process.env, GIT_INDEX_FILE: idx }
    const run = (args) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
        cwd,
        env,
        windowsHide: true,
        timeout: GIT_TIMEOUT,
        encoding: 'utf8',
        maxBuffer: 512 * 1048576,
      }).trim()
    run(['read-tree', ours])

    // 1) 活文档:行 multiset union(两侧每一行都必须存活)
    for (const p of LIVE_DOCS) {
      const a = show(ours, p, cwd)
      const b = show(theirs, p, cwd)
      if (a === b) continue
      const oid = git(['hash-object', '-w', '--path', p, '--stdin'], cwd, unionLines(a, b))
      run(['update-index', '--add', '--cacheinfo', `100644,${oid},${p}`])
    }

    // 2) 对侧「相对共同基底自己动过」的路径 ⇒ 取对侧版本(活文档已在 1) 归并,不整体覆盖)
    const tookTheirs = []
    const skippedDeletes = []
    for (const p of git(['diff', '--name-only', base, theirs], cwd).split('\n').filter(Boolean)) {
      if (LIVE_DOCS.includes(p)) continue
      const blob = blobOf(theirs, p, cwd)
      if (blob === null) {
        skippedDeletes.push(p) // 对侧删除不随合并传播,否则本工具的产物会被守门 100 判红
        continue
      }
      if (blobOf(ours, p, cwd) === blob) continue
      run(['update-index', '--add', '--cacheinfo', `100644,${blob},${p}`])
      tookTheirs.push(p)
    }
    return { tree: run(['write-tree']), tookTheirs, skippedDeletes }
  } finally {
    rmScratch(scratch)
  }
}

/** 零丢失自证(路径面 + 活文档行面)。返回违规清单,空 = 可落地。 */
export function verifyUnion(ours, theirs, tree, cwd = ROOT) {
  const M = new Set(listPaths(tree, cwd))
  const bad = []
  for (const p of listPaths(ours, cwd)) if (!M.has(p)) bad.push(`合并树丢了本侧路径 ${p}`)
  for (const p of listPaths(theirs, cwd)) if (!M.has(p)) bad.push(`合并树丢了对侧路径 ${p}`)
  for (const p of LIVE_DOCS) {
    const a = counter(show(ours, p, cwd))
    const b = counter(show(theirs, p, cwd))
    const m = counter(show(tree, p, cwd))
    for (const [l, n] of [...a, ...b]) if ((m.get(l) || 0) < n) bad.push(`${p} 未存活行:${l.slice(0, 50)}`)
  }
  return bad
}

/** 找一对需要合并的输入;skip 非空表示无事可做。 */
export function resolveTargets(theirsArg, cwd = ROOT) {
  const head = git(['rev-parse', 'HEAD'], cwd)
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  let theirs = theirsArg
  if (!theirs) {
    try {
      theirs = git(['rev-parse', `origin/${branch}`], cwd)
    } catch {
      return { head, theirs: '', skip: `取不到 origin/${branch}` }
    }
  }
  if (theirs === head) return { head, theirs, skip: '已同步' }
  if (isAncestor(theirs, head, cwd)) return { head, theirs, skip: '目标已被本地包含' }
  if (isAncestor(head, theirs, cwd)) return { head, theirs, skip: '本地纯落后 ⇒ 走 ff/converge,不用 union' }
  return { head, theirs, skip: null }
}

function isAncestor(a, b, cwd) {
  return (
    spawnSync(GIT, ['-c', 'safe.directory=*', 'merge-base', '--is-ancestor', a, b], {
      cwd,
      windowsHide: true,
      timeout: 120000,
      encoding: 'utf8',
    }).status === 0
  )
}

export function plan(ours, theirs, cwd = ROOT) {
  const base = git(['merge-base', ours, theirs], cwd)
  const built = buildUnion(base, ours, theirs, cwd)
  return { base, ...built, bad: verifyUnion(ours, theirs, built.tree, cwd) }
}

function selfTest() {
  const dir = mkScratch('ihui-union-')
  const run = (...a) => git(a, dir)
  const cases = []
  const ok = (n, c, note = '') => cases.push({ n, c, note })
  try {
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
    writeFileSync(join(dir, 'keep.ts'), 'k\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'init')

    // 本侧:新增一个模块 + 登记一行
    writeFileSync(join(dir, 'mine.ts'), 'export const m = 1\n', 'utf8')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')

    // 对侧:从 init 分叉,另加一个模块、另一行,并删掉一个 init 就有的文件
    run('checkout', '-q', 'HEAD~1')
    run('branch', '-D', 'main')
    writeFileSync(join(dir, 'theirs.ts'), 'export const t = 1\n', 'utf8')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-line\n', 'utf8')
    run('rm', '-q', 'keep.ts')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)

    const p = plan(ours, theirs, dir)
    ok('零丢失自证必须通过', p.bad.length === 0, p.bad.slice(0, 3).join(' / '))
    const paths = new Set(listPaths(p.tree, dir))
    ok('本侧独有新增不得丢', paths.has('mine.ts'))
    ok('对侧独有新增照收', paths.has('theirs.ts'))
    ok('对侧的删除不随合并传播(合并之后显式删才算)', paths.has('keep.ts'), 'keep.ts 被顺手删了 ⇒ 与"取某一侧"无区别')
    ok('对侧删除项如实报数', p.skippedDeletes.includes('keep.ts'), JSON.stringify(p.skippedDeletes))
    const doc = show(p.tree, 'PROJECT_PLAN.md', dir)
    ok('台账两侧登记行都必须存活', doc.includes('ours-line') && doc.includes('theirs-line'), doc.replace(/\n/g, '|'))

    const sha = run('commit-tree', p.tree, '-p', ours, '-p', theirs, '-m', 'union merge')
    ok('用守门 100 的 A1 复核本工具产物 ⇒ 0 丢失', auditOne(sha, dir).lost.length === 0, JSON.stringify(auditOne(sha, dir).lost))

    // 反向对照:选边(取对侧整棵树)必须被同一套断言判失败
    const oneSide = git(['rev-parse', `${theirs}^{tree}`], dir)
    const bad = verifyUnion(ours, theirs, oneSide, dir)
    ok('选边式合并必须判失败', bad.some((b) => b.includes('mine.ts')), bad.slice(0, 2).join(' / '))
  } finally {
    rmScratch(dir)
  }
  for (const c of cases) console.log(`${c.c ? '✅' : '❌'} ${c.n}${c.c ? '' : ` —— ${c.note}`}`)
  const fail = cases.filter((c) => !c.c).length
  console.log(fail ? `\n❌ ${fail} 例失败` : `全部 ${cases.length} 例通过`)
  process.exit(fail ? 1 : 0)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const apply = argv.includes('--apply')
  const ti = argv.indexOf('--theirs')
  const t = resolveTargets(ti >= 0 ? argv[ti + 1] : '')
  if (t.skip) {
    console.log(`[union-converge] ${t.skip} ⇒ 无需合并`)
    process.exit(0)
  }
  const p = plan(t.head, t.theirs)
  console.log(
    `[union-converge] ${apply ? 'APPLY' : 'CHECK ONLY'} base=${p.base.slice(0, 11)} ours=${t.head.slice(0, 11)} theirs=${t.theirs.slice(0, 11)} / 取对侧 ${p.tookTheirs.length} 路径 / 对侧删除不传播 ${p.skippedDeletes.length} / 活文档行 union`,
  )
  for (const d of p.skippedDeletes) console.log(`  · 对侧删除不随合并生效:${d}(确要删请在合并之后显式 git rm)`)
  if (p.bad.length) {
    console.log(`❌ 零丢失自证不过 ${p.bad.length} 处:`)
    for (const b of p.bad.slice(0, 15)) console.log(`   ${b}`)
    process.exit(1)
  }
  if (!apply) {
    console.log('  未落地(加 --apply 才建合并提交;本工具从不 checkout、不碰共享工作区)')
    process.exit(0)
  }
  const msg = `Merge ${t.theirs} into ${t.head} —— 文件面零丢失 union(本侧整棵树 ∪ 对侧自身改动 ∪ 活文档行 union)`
  const sha = git(['commit-tree', p.tree, '-p', t.head, '-p', t.theirs, '-m', msg])
  const cas = spawnSync(GIT, ['-c', 'safe.directory=*', 'update-ref', 'refs/heads/main', sha, t.head], {
    cwd: ROOT,
    windowsHide: true,
    timeout: 120000,
    encoding: 'utf8',
  })
  if (cas.status !== 0) {
    console.log(`❌ CAS 失败(HEAD 被他人推进)⇒ 本轮作废,重跑即可;产物 ${sha.slice(0, 11)} 是悬空提交,守门 30a 会要求先 tag`)
    process.exit(1)
  }
  const lost = auditOne(sha)
  console.log(`✅ 合并落地 ${sha.slice(0, 12)}${lost.lost.length ? ` —— ⚠️ A1 复核仍报 ${lost.lost.length} 处` : ',A1 复核 0 丢失'}`)
  process.exit(lost.lost.length ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { buildUnion, unionLines, verifyUnion, resolveTargets, plan, listPaths, show, LIVE_DOCS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
