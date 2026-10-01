// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/heal-worktree-tracked-index-lock-g794.test.mjs
/**
 * G-794 / G-742 的镜像取证(§22c)。
 *
 * 与 `--self-test` 的分工:self-test 判**行为**(锁三态、窗外点名、四判据);本文件钉
 * self-test 结构上看不见的三件事 ——
 *   ① **反向锁**(题面点名要求):`refreshStaleIndex` 不得把 `gitRaw` 的锁抛错原样冒到 `main()`,
 *      且写索引这条路只许有一个出口函数(把让路逻辑抄第二份必然与判据漂开);
 *   ② **CLI 契约**:真锁在场时 `--align-drift` 的退出码必须是 0 且 stdout 点名"本层跳过
 *      (锁被持有)",stderr 不得出现栈(题面的验收原话)—— 这条只能端到端跑,函数级断言
 *      证明不了 `main().catch → exit 2` 那一段;
 *   ③ **真仓现读**:`probeIndexLock` 跑在 G:\IHUI-AI 本仓上(输入逐字取自真实仓库,§22c 要求),
 *      且全程只读 —— 跑完跑后 `git status --porcelain` 必须逐字等值。
 * 判据本体不在此重抄(§22c:测试复制判据 = 两套真相);① 按源码形状断言,②③ 按行为断言。
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ } from '../heal-worktree-tracked.mjs'

const {
  writeIndexCacheInfos,
  probeIndexLock,
  classifyLockFailure,
  lockSkipAdvice,
  blobInAncestry,
} = __test__
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS = join(REPO, 'scripts')
const HEALER = join(SCRIPTS, 'heal-worktree-tracked.mjs')

/** 本仓真实 gitdir 可能是工作区外的指针形态(§5b)⇒ 锁路径必须问 git,不得拼。 */
const realGit = (args, opts = {}) => gitRaw(args, REPO, { timeout: 60000, ...opts })

/** 复制被测脚本 + 其相对 import 闭包到演练仓(与 heal-worktree-tracked.test.mjs 同法;
 *  按名字列闭包必然随每一次 lib 演进再漂一遍 ⇒ 走递归解析,并留反向哨兵)。 */
function localImportClosure(entryRel, seen = new Set()) {
  if (seen.has(entryRel)) return seen
  seen.add(entryRel)
  let text = ''
  try {
    text = readFileSync(join(SCRIPTS, entryRel), 'utf8')
  } catch {
    return seen
  }
  for (const m of text.matchAll(/^\s*import\b[^'"]*from\s*'(\.[^']+)'/gm)) {
    const next = normalize(join(dirname(entryRel), m[1])).replace(/\\/g, '/')
    localImportClosure(next, seen)
  }
  return seen
}

function copyCliInto(dir) {
  const closure = localImportClosure('heal-worktree-tracked.mjs')
  for (const rel of closure) {
    const dst = join(dir, 'scripts', rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(join(SCRIPTS, rel), dst)
  }
  assert.ok(closure.has('lib/face-reader.mjs'), '闭包没含 lib/face-reader.mjs')
  // G-742 起祖先窗口取自守门 84 ⇒ 闭包必须也把它 import 的层带上,否则 CLI 在演练仓 ERR_MODULE_NOT_FOUND
  assert.ok(
    closure.has('check-stale-revert.mjs'),
    '闭包没含 check-stale-revert.mjs —— 窗口同源断了',
  )
  assert.ok(
    closure.has('lib/stale-content-analysis.mjs'),
    '闭包没含 lib/stale-content-analysis.mjs —— 84 的依赖链断了',
  )
  return join(dir, 'scripts', 'heal-worktree-tracked.mjs')
}

const runCli = (scriptPath, args, cwd) =>
  spawnSync(process.execPath, [scriptPath, ...args], { cwd, encoding: 'utf8', windowsHide: true })

/**
 * 造"落后索引 + 真 index.lock"现场(与 self-test ㉚ 同形,但走**独立小仓**:
 * 累积的索引状态会让祖先判据互踩 —— self-test ⑭⑮ 记过的同一课)。
 */
function makeStaleIndexDrill(prefix = 'wt-g794-mirror-') {
  const dir = mkScratch(prefix)
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  g(['init', '-q', '--initial-branch=main'])
  g(['config', 'user.email', 't@t'])
  g(['config', 'user.name', 't'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'r.ts'), 'v1\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'R1 v1'])
  writeFileSync(join(dir, 'r.ts'), 'v2\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'R2(HEAD) v2'])
  const v1oid = g(['rev-parse', 'HEAD~1:r.ts']).trim()
  const headOid = g(['rev-parse', 'HEAD:r.ts']).trim()
  // 索引停在祖先 v1、工作区==HEAD ⇒ refreshStaleIndex 判据①②③齐备,正要走那条写循环
  g(['update-index', '--cacheinfo', `100644,${v1oid},r.ts`])
  return { dir, g, v1oid, headOid }
}
const holdLock = (dir) => writeFileSync(join(dir, '.git', 'index.lock'), '')
const dropLock = (dir) => rmSync(join(dir, '.git', 'index.lock'), { force: true })

/* ---------------------------- ① 反向锁(题面点名) ---------------------------- */

test('T1 反向锁:写索引只有一条出口,refreshStaleIndex 体内不得再裸奔 update-index(不得原样冒到 main)', () => {
  const src = readFileSync(HEALER, 'utf8')
  // 取 refreshStaleIndex 的函数体(大括号配平,不用正则猜行)
  const bodyOf = (name) => {
    const start = src.indexOf(`function ${name}(`)
    assert.ok(start >= 0, `源文件里找不到 ${name}()`)
    let i = src.indexOf('(', start)
    let depth = 0
    for (; i < src.length; i++) {
      if (src[i] === '(') depth++
      else if (src[i] === ')' && --depth === 0) break
    }
    const open = src.indexOf('{', i)
    depth = 0
    for (let k = open; k < src.length; k++) {
      if (src[k] === '{') depth++
      else if (src[k] === '}' && --depth === 0) return src.slice(open, k + 1)
    }
    assert.fail(`${name}() 花括号未配平`)
  }
  assert.ok(
    !/update-index/.test(bodyOf('refreshStaleIndex')),
    'refreshStaleIndex 体内又出现裸 update-index ⇒ 撞锁会原样抛穿 main()(G-794 回归)',
  )
  assert.ok(
    /update-index/.test(bodyOf('writeIndexCacheInfos')),
    '写索引的唯一出口必须是 writeIndexCacheInfos',
  )
  assert.ok(
    /classifyLockFailure\(/.test(bodyOf('writeIndexCacheInfos')),
    '写索引出口必须做锁归因(否则"让路"与"真故障"同形)',
  )
  assert.ok(
    /not-lock/.test(bodyOf('writeIndexCacheInfos')) &&
      /throw e/.test(bodyOf('writeIndexCacheInfos')),
    '非锁故障必须原样上抛 —— 把它伪装成让路就是造一台会喊错话的尺子',
  )
  // 装车:alignDrifts 必须把 lockSkip 并进点名清单,main() 必须打印它
  assert.ok(
    /refreshed\.lockSkip/.test(bodyOf('alignDrifts')),
    'alignDrifts 没消费 refreshed.lockSkip',
  )
  const mainBody = bodyOf('main')
  assert.ok(/printSkipsAndLoss\(/.test(mainBody), 'main() 未打印"本层跳过" ⇒ 让路又变回安静')
})

test('T2 三态不并桶:锁文本 × 四种锁状态给四种结论,非锁文本一律 not-lock', () => {
  const LOCKMSG = "fatal: Unable to create 'X:/repo/.git/index.lock': File exists."
  const mk = (state) => ({
    state,
    lockPath: 'X:/repo/.git/index.lock',
    ageMs: 1,
    sizeBytes: 0,
    reason: state,
  })
  const cases = [
    ['held-live', 'held'],
    ['dangling-suspected', 'dangling'],
    ['absent', 'cleared'],
    ['undetermined', 'undetermined'],
  ]
  // 逐条断言而不是深比较一个 map:四态各自必须落到自己的 kind(并桶了就会在这里红)
  for (const [probeState, want] of cases)
    assert.equal(
      classifyLockFailure(LOCKMSG, mk(probeState)).kind,
      want,
      `${probeState} 必须归到 ${want}(三态不并桶)`,
    )
  assert.equal(
    classifyLockFailure('fatal: bad object deadbeefdeadbeef', mk('held-live')).kind,
    'not-lock',
    '非锁故障不得被归成让路',
  )
  // 措辞各有不同处置:疑似悬挂那句必须点出"每一轮都会跳过",held 那句不得教人删锁
  assert.match(lockSkipAdvice('dangling'), /每一轮都会跳过/)
  assert.doesNotMatch(lockSkipAdvice('held'), /rm\b.*index\.lock|删除.*index\.lock/)
})

/* ---------------------------- ③ 真仓现读(只读) ---------------------------- */

test('T3 真仓现读:探针锁路径与 git 自己说的一致,且全程零副作用(工作树逐字未动)', () => {
  const before = gitRaw(['status', '--porcelain'], REPO, { timeout: 120000, maxBuffer: 1 << 26 })
  const asked = realGit(['rev-parse', '--git-path', 'index.lock']).trim()
  const p = probeIndexLock(REPO)
  assert.ok(
    ['absent', 'held-live', 'dangling-suspected', 'undetermined'].includes(p.state),
    `探针必须落四态之一,实得 ${p.state}`,
  )
  const norm = (s) => s.replace(/\\/g, '/').toLowerCase()
  if (p.state !== 'undetermined') {
    // git 给的可能是相对路径(`.git/index.lock`)也可能是绝对路径(本仓 gitdir 在工作区外的指针形态),
    // 探针必须与**同一个答案**同源 —— 自己拼 `<root>/.git/index.lock` 在这一型上是假阴性(把有锁读成没锁)。
    const expected =
      /^[A-Za-z]:[\\/]/.test(asked) || asked.startsWith('/') ? asked : resolve(REPO, asked)
    assert.equal(
      norm(p.lockPath),
      norm(expected),
      `探针路径与 git 给的不同源(git=${asked} 探针=${p.lockPath})`,
    )
    assert.equal(
      existsSync(p.lockPath),
      p.state !== 'absent',
      '状态与盘上事实必须一致:absent ⇔ 文件不存在',
    )
  } else {
    assert.ok(p.reason, 'undetermined 必须带原因(不得折成"无锁")')
  }
  const after = gitRaw(['status', '--porcelain'], REPO, { timeout: 120000, maxBuffer: 1 << 26 })
  assert.equal(after, before, '本票任何判据都不得改动真仓工作树/索引')
})

/* ---------------------------- ② CLI 契约(端到端) ---------------------------- */

test('T4 CLI 契约:真锁在场时 --align-drift 退出码 0、stdout 点名"本层跳过(锁被持有)"、无栈', () => {
  const { dir, g, v1oid, headOid } = makeStaleIndexDrill()
  try {
    const cli = copyCliInto(dir)
    holdLock(dir)
    const r = runCli(cli, ['--align-drift'], dir)
    assert.equal(
      r.status,
      0,
      `锁被他人持有时必须 exit 0(旧行为 exit 2 ⇒ 三层连带不执行),实得 ${r.status};stderr=${String(r.stderr).slice(0, 400)}`,
    )
    assert.match(r.stdout, /本层跳过\(锁被持有\)/, '报告必须点名这一格是"因锁让路",不是"无事发生"')
    assert.doesNotMatch(
      String(r.stderr),
      /Unable to create|at refreshStaleIndex|at main/,
      'stderr 不得再出现抛穿的栈',
    )
    // 让路 = 一条都没写成
    assert.equal(
      g(['ls-files', '-s', '--', 'r.ts']).split(/\s+/)[1],
      v1oid,
      '锁在位时索引必须原样不动(不得做一半)',
    )
    // 反向对照:锁一撤,同一现场立刻补上 —— "跳过"不得变成永久托辞
    dropLock(dir)
    const r2 = runCli(cli, ['--align-drift'], dir)
    assert.equal(r2.status, 0, `锁释放后仍须 exit 0;stderr=${String(r2.stderr).slice(0, 300)}`)
    assert.equal(
      g(['ls-files', '-s', '--', 'r.ts']).split(/\s+/)[1],
      headOid,
      `锁释放后必须真刷新(stdout=${String(r2.stdout).slice(0, 300)})`,
    )
    assert.doesNotMatch(r2.stdout, /本层跳过\(锁被持有\)/, '锁没了还报"因锁跳过"= 措辞与事实分叉')
  } finally {
    dropLock(dir)
    rmScratch(dir)
  }
})

test('T5 CLI 契约:--check(零副作用档)带锁既不抛也不写(题面:该异常在 --check 口径根本不该出现)', () => {
  const { dir, g, v1oid } = makeStaleIndexDrill('wt-g794-check-')
  try {
    const cli = copyCliInto(dir)
    holdLock(dir)
    const r = runCli(cli, ['--check'], dir)
    assert.equal(
      r.status,
      0,
      `--check 带锁必须 exit 0(不抛穿),实得 ${r.status};stderr=${String(r.stderr).slice(0, 300)}`,
    )
    assert.doesNotMatch(
      String(r.stderr),
      /Unable to create|at refreshStaleIndex|at main/,
      '--check 档出现锁抛错 = 零副作用承诺作废',
    )
    assert.doesNotMatch(
      r.stdout,
      /本层跳过\(锁被持有\)/,
      'dryRun 结构上进不到写循环,不该报"因锁跳过"',
    )
    assert.equal(g(['ls-files', '-s', '--', 'r.ts']).split(/\s+/)[1], v1oid, '--check 档不得动索引')
  } finally {
    dropLock(dir)
    rmScratch(dir)
  }
})

test('T6 预探在位即"一条都不试":锁在场时 update-index 派生次数必须为 0(不拿派生去撞锁)', () => {
  const { dir, v1oid, headOid } = makeStaleIndexDrill('wt-g794-count-')
  try {
    holdLock(dir)
    let writes = 0
    const counting = (args, opts = {}) => {
      if (args[0] === 'update-index') writes++
      return gitRaw(args, dir, { timeout: 0, maxBuffer: 1 << 28, ...opts })
    }
    const res = writeIndexCacheInfos(counting, dir, [
      ['r.ts', headOid],
      ['r.ts', headOid],
    ])
    assert.equal(writes, 0, '锁在位时预探必须直接整批延后,一次 update-index 都不派生')
    assert.equal(res.done.length, 0)
    assert.equal(res.deferred.length, 2, '延后必须逐条点名(不得只给一个数)')
    assert.equal(res.lockSkip.kind, 'held')
    assert.equal(gitRaw(['ls-files', '-s', '--', 'r.ts'], dir).split(/\s+/)[1], v1oid)
  } finally {
    dropLock(dir)
    rmScratch(dir)
  }
})

test('T7 非锁故障必须原样上抛(写索引出口不得把别的故障说成让路)', () => {
  const { dir, headOid } = makeStaleIndexDrill('wt-g794-notlock-')
  try {
    const boom = (args, opts = {}) => {
      if (args[0] === 'update-index') throw new Error('fatal: bad object 0123456789abcdef')
      return gitRaw(args, dir, { timeout: 0, maxBuffer: 1 << 28, ...opts })
    }
    assert.throws(
      () => writeIndexCacheInfos(boom, dir, [['r.ts', headOid]]),
      /bad object/,
      '非锁故障被吞成"让路"= 把真故障写成没事(G-794 的反方向)',
    )
  } finally {
    rmScratch(dir)
  }
})

/* ---------------------------- G-742:窗口只有一份 ---------------------------- */

test('T8 G-742:blobInAncestry 四态各归各位,"取不到"绝不折成"不是祖先"', () => {
  const { dir, g, v1oid, headOid } = makeStaleIndexDrill('wt-g742-window-')
  try {
    assert.equal(
      blobInAncestry(dir, 'r.ts', v1oid).verdict,
      'proven',
      '窗内祖先必须 proven(否则刷新整条失灵)',
    )
    assert.equal(blobInAncestry(dir, 'r.ts', headOid).verdict, 'proven', 'HEAD 自身也在历史里')
    // 该路径历史只有 2 枚 ⇒ 窗口未用尽而没命中 ⇒ 'absent'(真新内容,不必点名)
    const novel = g(['hash-object', '-w', '--stdin'], { input: '从未有过的一行\n' }).trim()
    const a = blobInAncestry(dir, 'r.ts', novel)
    assert.equal(a.verdict, 'absent', `浅历史未命中必须是 absent,实得 ${JSON.stringify(a)}`)
    // blob 取不到 ⇒ undetermined(不是 absent)—— 把"没量到"写成"没有"就是原缺陷
    assert.equal(blobInAncestry(dir, 'r.ts', '').verdict, 'undetermined')
    // 仓库都读不到时也必须 undetermined(不是抛穿、不是 absent)
    assert.equal(blobInAncestry(join(dir, 'no-such-repo'), 'r.ts', v1oid).verdict, 'undetermined')
    // 窗口取自 84 那一份实现:同一函数不得再自带第二个上限
    const src = readFileSync(HEALER, 'utf8')
    assert.match(src, /ancestorWindow\(/)
    assert.match(src, /windowFor\(/)
  } finally {
    rmScratch(dir)
  }
})

test('T9 形状锁:未判定必须有出口措辞,不得只留一个计数(报数不指路=没人能清偿这一格)', () => {
  const src = readFileSync(HEALER, 'utf8')
  assert.match(src, /find-object/, '未判定档必须给出"问全深度"的人工出口')
  assert.match(src, /无界遍历/, '必须写明为什么本层不跑无界遍历(否则下一个人会"顺手补上")')
  assert.match(src, /不等于"全部判过且干净"/, '"无需对齐"这句必须自带它没判到的部分')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
