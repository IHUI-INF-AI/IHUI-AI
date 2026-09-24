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
 *           ∪ 对侧「相对共同基底自己动过、而本侧没动」的路径逐个取对侧版本;
 *             对侧删掉的路径**不随合并传播** —— 删除必须在合并之后显式做出,那才是守门 100 认得的合法形态
 *           ∪ 对侧与本侧「相对共同基底都动过」的非文档路径 ⇒ **真三方** `git merge-file`(base/ours/theirs
 *             三个 blob)。此前这一类是"整文件取对侧",会**静默吃掉本侧在该文件里的改动** —— 与它要防的
 *             事故同型,只是粒度从文件降到行。合并出冲突或遇二进制/非普通文件:判失败并**点名文件**,
 *             由人来判;绝不猜、绝不选边(这与"零丢失"同等重要)。
 *           ∪ 活文档(PROJECT_PLAN / AGENTS / README)按「每行重数 = max(ours, theirs)」union。
 *   落地前自证:丢本侧路径 = 0 ∧ 丢对侧路径 = 0 ∧ 三份文档未存活行 = 0 ∧ 两侧同改文件的**独有行不丢**
 *             (字符行 multiset 底线;真三方可能把两侧改动交织到不同位置,本断言只保证重数不减少、
 *              不判语义顺序 —— 局限如实说明,不假装更强);
 *   落地后再让**守门 100 本人的 A1** 复核这枚新合并(用它的判据验它的产物,而不是"看着对")。
 *   写盘一律临时索引 + commit-tree + **CAS** update-ref(HEAD 被他人推进则本轮作废重来),
 *   绝不 checkout、绝不碰共享工作区(§12d)。
 *
 * 用法:
 *   node scripts/union-converge.mjs                  # 只报告(零副作用)
 *   node scripts/union-converge.mjs --apply          # 落地合并(幂等)
 *   node scripts/union-converge.mjs --theirs <sha>   # 指定目标(默认 origin/<当前分支>)
 *   node scripts/union-converge.mjs --self-test      # 真临时仓取证(含"选边必判失败"反向对照)
 * 退出码:0 = 无需合并或已落地且复核干净;1 = 判据不过/两侧同改冲突需人工/CAS 失败;2 = 脚本自身异常。
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

/** 两侧相对基底的"动过的路径"清单(含仅改 mode —— 它同样会进 diff --name-only)。 */
function diffNames(a, b, cwd) {
  return git(['diff', '--name-only', a, b], cwd).split('\n').filter(Boolean)
}

/** 内容面判据不得走 `git()`(encoding utf8 + trim 会毁掉二进制与行尾),单开 buffer 通道。 */
function gitBuf(args, cwd = ROOT) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'buffer',
    windowsHide: true,
    timeout: GIT_TIMEOUT,
    maxBuffer: 512 * 1048576,
  })
}

function blobText(oid, cwd) {
  try {
    return gitBuf(['cat-file', 'blob', oid], cwd).toString('utf8')
  } catch {
    return ''
  }
}

/** 树里该路径的 mode(100644/100755/120000/160000);取不到返回 ''(交人工,不猜)。 */
function modeOf(rev, p, cwd) {
  try {
    return git(['ls-tree', rev, '--', p], cwd).match(/^(\d{6})\s/)?.[1] ?? ''
  } catch {
    return ''
  }
}

function writeBlob(content, p, cwd) {
  return execFileSync(
    GIT,
    ['-c', 'safe.directory=*', 'hash-object', '-w', '--path', p, '--stdin'],
    {
      cwd,
      input: content,
      encoding: 'utf8',
      windowsHide: true,
      timeout: GIT_TIMEOUT,
      maxBuffer: 512 * 1048576,
    },
  ).trim()
}

function emptyBlob(cwd) {
  try {
    return git(['hash-object', '-w', '--stdin'], cwd, '')
  } catch {
    return null
  }
}

/**
 * 真三方归并三个 blob。ok:false 的三种形态都由人来判,工具本身**绝不退回"取某一侧"**:
 *  conflict = merge-file 报的冲突区数(1..127,其 stdout 带标记,只作证据不入库)
 *  binary   = 二进制无法文本归并(merge-file 直接拒:`Cannot merge binary files`)
 *  error    = 其余非零退出/异常 ⇒ "无法判定",同样不得记为通过(硬约束 7)
 */
function mergeThreeBlobs(baseOid, oursOid, theirsOid, cwd) {
  try {
    const buf = gitBuf(
      [
        'merge-file',
        '-p',
        '--object-id',
        '-L',
        'OURS',
        '-L',
        'BASE',
        '-L',
        'THEIRS',
        oursOid,
        baseOid,
        theirsOid,
      ],
      cwd,
    )
    return { ok: true, buf }
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : -1
    const err = Buffer.isBuffer(e?.stderr)
      ? e.stderr.toString('utf8')
      : String(e?.stderr ?? e?.message ?? '')
    // status 1..127 且 stdout 有内容才是 merge-file 自己报的冲突区;
    //   129 这类用法错误(无 stdout)必须落到 error,不得被叫成"冲突"误导人工。
    if (status > 0 && status < 255 && e?.stdout?.length)
      return {
        ok: false,
        kind: 'conflict',
        detail: `merge-file 冲突区 ${status} 处`,
        buf: Buffer.from(e.stdout),
      }
    if (/Cannot merge binary files/.test(err))
      return { ok: false, kind: 'binary', detail: '二进制文件无法文本三方归并' }
    return {
      ok: false,
      kind: 'error',
      detail: `merge-file 退出 ${status}:${err.trim().slice(0, 160)}`,
    }
  }
}

/**
 * 一侧相对基底**新增**的行(字符行 multiset),扣掉另一侧对同名基底行的显式删除后,
 * 必须在归并结果里保住。底线判据:只保证"重数不减少",不判顺序与语义交织
 * (真三方把两侧改动接到不同位置时顺序本就会变,那不是丢行)。
 */
export function lostAddedLines(baseText, sideText, otherText, mergedText) {
  const cb = counter(baseText)
  const cs = counter(sideText)
  const co = counter(otherText)
  const cm = counter(mergedText)
  const out = []
  for (const [l, n] of cs) {
    const added = n - (cb.get(l) || 0)
    if (added <= 0) continue
    const removedByOther = Math.max(0, (cb.get(l) || 0) - (co.get(l) || 0))
    if ((cm.get(l) || 0) < Math.max(0, added - removedByOther)) out.push(l)
  }
  return out
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
  for (const [l, n] of [...co, ...ct])
    if ((cr.get(l) || 0) < n) throw new Error(`行 union 丢行:${l.slice(0, 60)}`)
  return res.endsWith('\n') ? res : res + '\n'
}

/** 构造合并树。临时索引走 §26 的夹具唯一落点 `mkScratch` ——
 *  硬编码 `cwd/.ihui-agent/tmp` 会在"对临时仓库做取证"时直接 ENOENT(自检第一轮即如此),
 *  而且把夹具写进仓库树内还会让 git 的 toplevel 向上逃逸。
 *  返回 needHuman(冲突/二进制/取不到 mode ⇒ 交人工)与 violations(两侧同改的丢行断言),
 *  两者都在本函数里算:归并结果的内容此刻已在手上,不必再派生一次 git 去重读。 */
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

    // 2) 对侧「相对共同基底自己动过」的路径:仅对侧动过 ⇒ 取对侧版本;两侧同改 ⇒ 真三方归并。
    //    (活文档已在 1) 归并,两条路都不整体覆盖)
    const tookTheirs = []
    const mergedClean = []
    const skippedDeletes = []
    const needHuman = []
    const violations = []
    const touchedOurs = new Set(diffNames(base, ours, cwd))
    for (const p of diffNames(base, theirs, cwd)) {
      if (LIVE_DOCS.includes(p)) continue
      const theirsBlob = blobOf(theirs, p, cwd)
      if (theirsBlob === null) {
        skippedDeletes.push(p) // 对侧删除不随合并传播,否则本工具的产物会被守门 100 判红
        continue
      }
      const oursBlob = blobOf(ours, p, cwd)
      if (oursBlob === theirsBlob) continue
      // 本侧未动(或本侧已删 ⇒ 删除同样不传播,与"对侧删除"对称)⇒ 整文件取对侧,语义与改前逐字一致
      if (!touchedOurs.has(p) || oursBlob === null) {
        run(['update-index', '--add', '--cacheinfo', `100644,${theirsBlob},${p}`])
        tookTheirs.push(p)
        continue
      }
      // 两侧都动过:旧写法在这里"整文件取对侧",即静默丢掉本侧改动 —— 必须走真三方
      const mode = modeOf(ours, p, cwd)
      if (mode !== '100644' && mode !== '100755') {
        needHuman.push({
          path: p,
          kind: 'mode',
          detail: `非普通文件(mode=${mode || '未取到'}),不做文本三方归并`,
        })
        continue
      }
      const baseBlob = blobOf(base, p, cwd) ?? emptyBlob(cwd)
      if (baseBlob === null) {
        needHuman.push({
          path: p,
          kind: 'error',
          detail: '共同基底侧与空 blob 都取不到,无法三方归并',
        })
        continue
      }
      const m = mergeThreeBlobs(baseBlob, oursBlob, theirsBlob, cwd)
      if (!m.ok) {
        needHuman.push({ path: p, kind: m.kind, detail: m.detail })
        continue
      }
      const oid = writeBlob(m.buf, p, cwd)
      if (oid === oursBlob) continue // 归并结果与本侧一致 ⇒ 连 mode 一起保持本侧条目
      run(['update-index', '--add', '--cacheinfo', `${mode},${oid},${p}`])
      mergedClean.push(p)
      const [baseText, oursText, theirsText, mergedText] = [
        blobText(baseBlob, cwd),
        blobText(oursBlob, cwd),
        blobText(theirsBlob, cwd),
        m.buf.toString('utf8'),
      ]
      for (const l of lostAddedLines(baseText, oursText, theirsText, mergedText))
        violations.push(`${p} 两侧同改后本侧独有行丢失:${l.slice(0, 60)}`)
      for (const l of lostAddedLines(baseText, theirsText, oursText, mergedText))
        violations.push(`${p} 两侧同改后对侧独有行丢失:${l.slice(0, 60)}`)
    }
    return {
      tree: run(['write-tree']),
      tookTheirs,
      mergedClean,
      skippedDeletes,
      needHuman,
      violations,
    }
  } finally {
    rmScratch(scratch)
  }
}

/** 零丢失自证(路径面 + 活文档行面)。返回违规清单,空 = 可落地。
 *  两侧同改的"独有行不丢"断言在 buildUnion 里(结果内容当场在手),由 plan 合并进同一道闸。 */
export function verifyUnion(ours, theirs, tree, cwd = ROOT) {
  const M = new Set(listPaths(tree, cwd))
  const bad = []
  for (const p of listPaths(ours, cwd)) if (!M.has(p)) bad.push(`合并树丢了本侧路径 ${p}`)
  for (const p of listPaths(theirs, cwd)) if (!M.has(p)) bad.push(`合并树丢了对侧路径 ${p}`)
  for (const p of LIVE_DOCS) {
    const a = counter(show(ours, p, cwd))
    const b = counter(show(theirs, p, cwd))
    const m = counter(show(tree, p, cwd))
    for (const [l, n] of [...a, ...b])
      if ((m.get(l) || 0) < n) bad.push(`${p} 未存活行:${l.slice(0, 50)}`)
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
  if (isAncestor(head, theirs, cwd))
    return { head, theirs, skip: '本地纯落后 ⇒ 走 ff/converge,不用 union' }
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
  // needHuman 同时进 bad:任何只看 bad 的调用方(含 git-sync-converge 之外的使用者)都不可能
  //   把一枚含冲突文件的树落地。冲突详情仍单独留清单,报告要点名到"是哪个文件"。
  const blocked = built.needHuman.map((h) => `${h.path} 需人工判(${h.kind}):${h.detail}`)
  return {
    base,
    ...built,
    bad: [...built.violations, ...blocked, ...verifyUnion(ours, theirs, built.tree, cwd)],
  }
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
    ok(
      '对侧的删除不随合并传播(合并之后显式删才算)',
      paths.has('keep.ts'),
      'keep.ts 被顺手删了 ⇒ 与"取某一侧"无区别',
    )
    ok('对侧删除项如实报数', p.skippedDeletes.includes('keep.ts'), JSON.stringify(p.skippedDeletes))
    const doc = show(p.tree, 'PROJECT_PLAN.md', dir)
    ok(
      '台账两侧登记行都必须存活',
      doc.includes('ours-line') && doc.includes('theirs-line'),
      doc.replace(/\n/g, '|'),
    )

    const sha = run('commit-tree', p.tree, '-p', ours, '-p', theirs, '-m', 'union merge')
    ok(
      '用守门 100 的 A1 复核本工具产物 ⇒ 0 丢失',
      auditOne(sha, dir).lost.length === 0,
      JSON.stringify(auditOne(sha, dir).lost),
    )

    // 反向对照:选边(取对侧整棵树)必须被同一套断言判失败
    const oneSide = git(['rev-parse', `${theirs}^{tree}`], dir)
    const bad = verifyUnion(ours, theirs, oneSide, dir)
    ok(
      '选边式合并必须判失败',
      bad.some((b) => b.includes('mine.ts')),
      bad.slice(0, 2).join(' / '),
    )

    // —— 两侧同改:第二个夹具,以免扰动上面那组的既有断言 ——
    const d2 = mkScratch('ihui-union-3w-')
    const r2 = (...a) => git(a, d2)
    try {
      r2('init', '-q', '-b', 'main')
      r2('config', 'user.email', 't@t')
      r2('config', 'user.name', 't')
      r2('config', 'core.autocrlf', 'false') // 结果按字节断言,行尾必须确定(本机实测 autocrlf=true)
      writeFileSync(join(d2, 'clean.ts'), 'l1\nl2\nl3\nl4\nl5\n', 'utf8')
      writeFileSync(join(d2, 'clash.ts'), 'x1\nx2\nx3\n', 'utf8')
      writeFileSync(join(d2, 'only-theirs.ts'), 'ot-base\n', 'utf8')
      writeFileSync(join(d2, 'both.bin'), Buffer.from('a\u0000b\u0000c\n'))
      writeFileSync(join(d2, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
      r2('add', '-A')
      r2('commit', '-qm', 'init')

      writeFileSync(join(d2, 'clean.ts'), 'L1\nl2\nl3\nl4\nl5\n', 'utf8')
      writeFileSync(join(d2, 'clash.ts'), 'x1\nOURS\nx3\n', 'utf8')
      writeFileSync(join(d2, 'both.bin'), Buffer.from('A\u0000b\u0000c\n'))
      writeFileSync(join(d2, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
      r2('add', '-A')
      r2('commit', '-qm', 'ours')
      const o2 = r2('rev-parse', 'HEAD')

      r2('checkout', '-q', 'HEAD~1')
      writeFileSync(join(d2, 'clean.ts'), 'l1\nl2\nl3\nTHEIRS\nl5\n', 'utf8')
      writeFileSync(join(d2, 'clash.ts'), 'x1\nTHEIRS\nx3\n', 'utf8')
      writeFileSync(join(d2, 'only-theirs.ts'), 'ot-theirs\n', 'utf8')
      writeFileSync(join(d2, 'both.bin'), Buffer.from('a\u0000B\u0000c\n'))
      writeFileSync(join(d2, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-line\n', 'utf8')
      r2('add', '-A')
      r2('commit', '-qm', 'theirs')
      const t2 = r2('rev-parse', 'HEAD')
      r2('update-ref', 'refs/heads/main', o2)

      const q = plan(o2, t2, d2)
      ok(
        '两侧同改不同区域 ⇒ 走真三方并入 mergedClean',
        q.mergedClean.includes('clean.ts') && !q.tookTheirs.includes('clean.ts'),
        JSON.stringify([q.mergedClean, q.tookTheirs]),
      )
      const clean = show(q.tree, 'clean.ts', d2)
      ok(
        '干净三方:两侧新增行都必须在结果里',
        clean === 'L1\nl2\nl3\nTHEIRS\nl5',
        clean.replace(/\n/g, '|'),
      )
      const clash = q.needHuman.find((h) => h.path === 'clash.ts')
      ok(
        '两侧同改同一行 ⇒ 判需人工并点名该文件(不选边)',
        clash?.kind === 'conflict',
        JSON.stringify(q.needHuman),
      )
      ok(
        '冲突必须同时进落地闸 bad',
        q.bad.some((b) => b.includes('clash.ts')),
        q.bad.slice(0, 3).join(' / '),
      )
      ok(
        '冲突文件的树内容仍是本侧版本(未被悄悄换成对侧)',
        show(q.tree, 'clash.ts', d2) === 'x1\nOURS\nx3',
        show(q.tree, 'clash.ts', d2),
      )
      ok(
        '二进制两侧同改 ⇒ 无法文本三方,交人工',
        q.needHuman.find((h) => h.path === 'both.bin')?.kind === 'binary',
        JSON.stringify(q.needHuman),
      )
      ok(
        '仅对侧动过 ⇒ 与改前逐字一致(整文件取对侧)',
        q.tookTheirs.includes('only-theirs.ts') &&
          blobOf(q.tree, 'only-theirs.ts', d2) === blobOf(t2, 'only-theirs.ts', d2),
        JSON.stringify(q.tookTheirs),
      )
      ok(
        '活文档仍走行级 union(不经三方)',
        show(q.tree, 'PROJECT_PLAN.md', d2).includes('theirs-line'),
      )
      ok('无丢行违规(干净三方那一个文件)', q.violations.length === 0, JSON.stringify(q.violations))
    } finally {
      rmScratch(d2)
    }

    // 丢行判据本身的语义边界(纯函数,不需仓库)
    ok(
      '丢行判据:另一侧显式删掉的基底同名行不计为丢失',
      lostAddedLines('d\nd\n', 'd\nd\nd\n', 'd\n', 'd\nd\n').length === 0,
    )
    ok(
      '丢行判据:本侧新增行被吃掉必须点名',
      lostAddedLines('b\n', 'b\nx\n', 'b\n', 'b\n').join() === 'x',
    )
    ok(
      '丢行判据:重数下降也算丢失',
      lostAddedLines('a\n', 'a\nn\nn\n', 'a\n', 'a\nn\n').join() === 'n',
    )
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
    `[union-converge] ${apply ? 'APPLY' : 'CHECK ONLY'} base=${p.base.slice(0, 11)} ours=${t.head.slice(0, 11)} theirs=${t.theirs.slice(0, 11)} / 取对侧 ${p.tookTheirs.length} 路径 / 两侧同改三方归并 ${p.mergedClean.length} / 需人工 ${p.needHuman.length} / 对侧删除不传播 ${p.skippedDeletes.length} / 活文档行 union`,
  )
  for (const d of p.skippedDeletes)
    console.log(`  · 对侧删除不随合并生效:${d}(确要删请在合并之后显式 git rm)`)
  if (p.mergedClean.length)
    console.log(
      `  · 两侧同改的 ${p.mergedClean.length} 个文件已走真三方归并(判据底线 = 各侧独有行重数不减少;\n` +
        '    不判顺序与语义交织 —— 真三方把两侧改动接到不同位置时顺序本就会变,这属局限而非已验证正确)',
    )
  for (const h of p.needHuman)
    console.log(`  ❌ ${h.path} —— ${h.kind}:${h.detail}(本工具不猜、不选边,请人工判这一个文件)`)
  if (p.bad.length) {
    console.log(`❌ 落地闸不过 ${p.bad.length} 处:`)
    for (const b of p.bad.slice(0, 15)) console.log(`   ${b}`)
    process.exit(1)
  }
  if (!apply) {
    console.log('  未落地(加 --apply 才建合并提交;本工具从不 checkout、不碰共享工作区)')
    process.exit(0)
  }
  const msg = `Merge ${t.theirs} into ${t.head} —— 文件面零丢失 union(本侧整棵树 ∪ 对侧自身改动 ∪ 两侧同改三方归并 ∪ 活文档行 union)`
  const sha = git(['commit-tree', p.tree, '-p', t.head, '-p', t.theirs, '-m', msg])
  const cas = spawnSync(
    GIT,
    ['-c', 'safe.directory=*', 'update-ref', 'refs/heads/main', sha, t.head],
    {
      cwd: ROOT,
      windowsHide: true,
      timeout: 120000,
      encoding: 'utf8',
    },
  )
  if (cas.status !== 0) {
    // CAS 失败留下的这枚悬空提交**本工具自己兜掉**:守门 30a 会因为"未备份悬空 commit"
    // 拦下此后每一次提交(今天实测连吃数轮 --no-verify,而一次绕过 = 约 130 道门作废)。
    // 与其把噪声留给下一个人,就地按 §22 的规矩打 tag —— tag 只是加引用,不改任何历史。
    const tagName = `lost-commit/wip-${sha.slice(0, 10)}`
    let tagged = false
    try {
      git(['tag', tagName, sha, '-m', 'union-converge CAS 失败的悬空合并提交(§22 备份)'])
      tagged = true
    } catch {
      /* tag 失败不得掩盖原始故障,下面如实说明 */
    }
    console.log(
      `❌ CAS 失败(HEAD 被他人推进)⇒ 本轮作废,重跑即可;产物 ${sha.slice(0, 11)} ${tagged ? `已按 §22 备份为 ${tagName}(随后由 tag-sync 推远端)` : `是悬空提交且 tag 失败 ⇒ 手工:git tag ${tagName} ${sha}`} —— 不这么做,守门 30a 会替我们记住这笔`,
    )
    process.exit(1)
  }
  const lost = auditOne(sha)
  console.log(
    `✅ 合并落地 ${sha.slice(0, 12)}${lost.lost.length ? ` —— ⚠️ A1 复核仍报 ${lost.lost.length} 处` : ',A1 复核 0 丢失'}`,
  )
  process.exit(lost.lost.length ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  buildUnion,
  unionLines,
  verifyUnion,
  resolveTargets,
  plan,
  listPaths,
  show,
  blobOf,
  diffNames,
  lostAddedLines,
  mergeThreeBlobs,
  LIVE_DOCS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
