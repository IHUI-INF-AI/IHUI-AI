// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `union-converge` 落地闸「折叠台账」镜像测试(§22c:直接 import 源模块,不在测试里复制判据)
 *
 * 修的是哪一咬(在册票 G-32「归并侧那半格仍未收口」,2026-10-16 本机复现并定性):
 *   `buildUnion` 对 PROJECT_PLAN.md 开 `dedupeTasks` 折叠同题行,折叠发生在 `unionLines`
 *   自身守恒断言**之后**;而 `verifyUnion` 重算期望表时不传折叠信息 ⇒ 落地闸对着一个
 *   "产物面根本不存在的重数"判红。本机 `CHECK ONLY` 现读:关折叠 flagged=0 / 开折叠 flagged=289,
 *   289 条逐条量到产物面的存活形态,**真丢失 0** ⇒ 289 处全是误拒收,收敛链被自己的自证卡死。
 *
 * 本文件的分工(只做 A1 那一色不算证明):
 *   A 合法折叠:接台账 ⇒ 绿;**摘掉台账(= 修改前的调用形态)⇒ 必须红**。
 *   B 真丢一行:接了台账照旧红(牙没被磨掉)。
 *   C 伪造台账替真吞并背书 ⇒ 红(去向行与它不是同一件事)。
 *   D 串档台账(点一条期望表从不欠的行)⇒ 记「未判定」并**折进落地闸**,不记通过。
 *   E 漂移锁:foldDedupe(未折叠产物) 与 unionLines({dedupeTasks:true}) 必须逐字等值。
 *   F 源码级锁:折叠只有一个调用点;验证侧不得长出第二份折叠策略。
 *   G 旧调用方形态(六参 / 空台账)必须与改动前逐字同形 ⇒ 放松只长在"确有折叠声明"的那些格上。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { maskComments } from '../lib/code-mask.mjs'
import { __test__ as U } from '../union-converge.mjs'

const GIT = resolveGitBin() || 'git'
const HERE = dirname(fileURLToPath(import.meta.url))
const srcMasked = () => maskComments(readFileSync(join(HERE, '..', 'union-converge.mjs'), 'utf8'))

/**
 * 夹具行:两行**同一件事**(同一枚标题指纹)、票号不同,其中一行带独有注记。
 * `extractTaskFingerprint` 会去掉票号/日期/〔注记〕/标点并取粗体标题,所以这两行必然同组。
 */
const TITLE = '**落地闸对着折叠前的重数判红而真丢失一处都没有**'
const ROW_OURS = `- [ ] G-900201 ${TITLE}`
const ROW_THEIRS = `- [ ] G-900202 ${TITLE}〔取证:2026-10-16 本机复现误拒收 289 处〕`
/** 第三件**不同**的事:折叠不碰它,它被丢掉就必须判红。 */
const ROW_UNIQUE = '- [ ] G-900203 **这台收敛器的牙住在去向举证里不在台账数量里**〔独立议题勿折叠〕'

function gitIn(dir, args, env) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd: dir,
    env,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
    maxBuffer: 64 * 1048576,
  }).trim()
}

function scratchRepo() {
  const dir = mkScratch('union-fold-')
  const run = (...a) => gitIn(dir, a)
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# 台账\nbase-line\n', 'utf8')
  writeFileSync(join(dir, 'keep.ts'), 'k\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'init')
  return { dir, run }
}

/** 在 base 之上落一枚侧提交(台账 + 一个只属于本侧的文件,保证两侧改动面不重叠)。 */
function commitSide(run, dir, planText, message, sideFile) {
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), planText, 'utf8')
  writeFileSync(join(dir, sideFile), `${message}\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', message)
  return run('rev-parse', 'HEAD')
}

/**
 * 把一枚已构造好的合并树里的 PROJECT_PLAN.md 换成另一份内容,再写回**临时索引**。
 * 刻意不新建仓、不碰共享工作区(§12d/§15c):read-tree 现有树 → hash-object → update-index → write-tree。
 */
function treeWithPlan(dir, tree, text) {
  const scratch = mkScratch('union-fold-tree-')
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index') }
    const file = join(scratch, 'PROJECT_PLAN.md')
    writeFileSync(file, text, 'utf8')
    gitIn(dir, ['read-tree', tree], env)
    const oid = gitIn(dir, ['hash-object', '-w', file], env)
    gitIn(dir, ['update-index', '--add', '--cacheinfo', `100644,${oid},PROJECT_PLAN.md`], env)
    return gitIn(dir, ['write-tree'], env)
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
}

const shortRows = (list) => list.filter((s) => String(s).includes('未存活行'))
const undeterminedRows = (list) => list.filter((s) => String(s).includes('未判定'))

/** A/B/C/D 共用的三面:两侧各登记同一件事的一份副本。 */
function forkSameEvent(run, dir, extraOurs = '', extraTheirs = '') {
  const base = run('rev-parse', 'HEAD')
  const ours = commitSide(
    run,
    dir,
    `# 台账\nbase-line\n${ROW_OURS}${extraOurs}\n`,
    'ours: 同题行甲',
    'ours.ts',
  )
  run('update-ref', 'refs/heads/main', base)
  const theirs = commitSide(
    run,
    dir,
    `# 台账\nbase-line\n${ROW_THEIRS}${extraTheirs}\n`,
    'theirs: 同题行乙',
    'theirs.ts',
  )
  run('update-ref', 'refs/heads/main', ours)
  return { base, ours, theirs }
}

test('A 双向变异:合法折叠 —— 接台账绿 / 摘掉台账(修改前形态)红', () => {
  const { dir, run } = scratchRepo()
  try {
    const { base, ours, theirs } = forkSameEvent(run, dir)
    const p = U.plan(ours, theirs, dir)
    assert.equal(p.needHuman.length, 0, `夹具自证:不该有人工裁决,实测 ${JSON.stringify(p.needHuman)}`)
    const ledger = p.foldLedgers.get('PROJECT_PLAN.md')
    assert.ok(ledger, '折叠台账必须由本轮 buildUnion 同轮带出(带不出 = 又回到"自证侧不知道折叠发生过")')
    assert.ok(
      ledger.pairs.length >= 1,
      `夹具自证:本轮必须真折出至少一条去向,pairs=${ledger.pairs.length}`,
    )
    assert.ok(
      ledger.pairs.every((x) => x.kept !== null && x.kept !== undefined),
      `夹具自证:每条被折行都该问得出去向,实测 ${JSON.stringify(ledger.pairs.map((x) => x.kept))}`,
    )
    // A1 正向:接台账 ⇒ 落地闸一处不红
    const withLedger = U.verifyUnion(ours, theirs, p.tree, dir, base, null, p.foldLedgers)
    assert.equal(
      withLedger.length,
      0,
      `A1) 合法折叠接了台账必须绿,实测 ${JSON.stringify([...withLedger].map((s) => String(s).slice(0, 90)))}`,
    )
    // 端到端也必须绿:落地闸的产物走 plan() 那条路同样不许喊"未存活行"
    assert.equal(
      shortRows(p.bad).length,
      0,
      `A1) plan() 的落地闸不得再报未存活行,实测 ${JSON.stringify(shortRows(p.bad).map((s) => String(s).slice(0, 90)))}`,
    )
    // 少带必须被点名(不得静默折进"0 丢失")
    assert.ok(
      (p.folded || []).length >= 1,
      `A1) 折叠销掉的份数必须随报告走,实测 folded=${JSON.stringify(p.folded)}`,
    )
    assert.ok(
      U.formatFoldReport(p.folded).some((l) => l.includes('同题折叠少带')),
      'A1) 报告必须有报数那一行(报数必须报名)',
    )
    // A2 变异:同一枚产物**摘掉台账**(修改前的调用形态)⇒ 必须红,而且红的是被折掉的那两行
    const noLedger = U.verifyUnion(ours, theirs, p.tree, dir, base)
    assert.ok(
      shortRows(noLedger).length >= 1,
      `A2) 摘掉台账必须翻红(这条红就是本机 289 处误拒收的形状),实测 ${JSON.stringify([...noLedger].map(String))}`,
    )
    assert.match(String(noLedger[0]), /PROJECT_PLAN\.md 未存活行:/, `A2) 红句措辞,实测 ${noLedger[0]}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('B 真丢一行(不属于任何合法折叠去向):接了台账照旧判红 —— 牙没被磨掉', () => {
  const { dir, run } = scratchRepo()
  try {
    const base = run('rev-parse', 'HEAD')
    // 两侧都带独立议题行(折叠不碰它),同题行照旧各一份
    const ours = commitSide(
      run,
      dir,
      `# 台账\nbase-line\n${ROW_OURS}\n${ROW_UNIQUE}\n`,
      'ours: 同题行 + 独立议题',
      'ours.ts',
    )
    run('update-ref', 'refs/heads/main', base)
    const theirs = commitSide(
      run,
      dir,
      `# 台账\nbase-line\n${ROW_THEIRS}\n${ROW_UNIQUE}\n`,
      'theirs: 同题行乙 + 独立议题',
      'theirs.ts',
    )
    run('update-ref', 'refs/heads/main', ours)
    const p = U.plan(ours, theirs, dir)
    const a = U.show(ours, 'PROJECT_PLAN.md', dir)
    const b = U.show(theirs, 'PROJECT_PLAN.md', dir)
    const bt = U.show(base, 'PROJECT_PLAN.md', dir)
    // 诚实台账 = 从折叠前的那一份产物重跑同一次折叠(与 buildUnion 同一实现同一参数)
    const honest = U.foldDedupe(U.unionLines(a, b, bt, null, { dedupeTasks: false }))
    const good = U.verifyUnion(ours, theirs, p.tree, dir, base, null, new Map([['PROJECT_PLAN.md', honest.ledger]]))
    assert.equal(good.length, 0, `B 正向对照必须绿,实测 ${JSON.stringify([...good].map(String))}`)
    // 现在拿掉一条**与折叠无关**的行(独立议题那一行整行消失)
    const stolen = treeWithPlan(dir, p.tree, honest.text.replace(`${ROW_UNIQUE}\n`, ''))
    assert.notEqual(
      U.show(stolen, 'PROJECT_PLAN.md', dir),
      U.show(p.tree, 'PROJECT_PLAN.md', dir),
      '夹具自证:这一行必须真能从产物面里被拿走',
    )
    const bad = U.verifyUnion(ours, theirs, stolen, dir, base, null, new Map([['PROJECT_PLAN.md', honest.ledger]]))
    assert.ok(
      shortRows(bad).some((s) => String(s).includes('G-900203')),
      `B) 真丢失的独立议题行必须被"未存活行"点名(折叠台账解释不了它),实测 ${JSON.stringify([...bad].map(String))}`,
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('C 伪造台账替真吞并背书 ⇒ 判红:去向行与它不是同一件事', () => {
  const { dir, run } = scratchRepo()
  try {
    const base = run('rev-parse', 'HEAD')
    const ours = commitSide(
      run,
      dir,
      `# 台账\nbase-line\n${ROW_OURS}\n${ROW_UNIQUE}\n`,
      'ours',
      'ours.ts',
    )
    run('update-ref', 'refs/heads/main', base)
    const theirs = commitSide(
      run,
      dir,
      `# 台账\nbase-line\n${ROW_OURS}\n${ROW_UNIQUE}\n- [ ] G-900204 **对侧独有的一条活账,被吞掉必须判红**〔不得被台账洗白〕\n`,
      'theirs',
      'theirs.ts',
    )
    run('update-ref', 'refs/heads/main', ours)
    const p = U.plan(ours, theirs, dir)
    const landed = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    const ROW_THEIRS_ONLY = landed.split('\n').find((l) => l.includes('G-900204'))
    assert.ok(ROW_THEIRS_ONLY, '夹具自证:对侧独有行必须先在产物面里')
    // 拿走它必须**真的**拿走(按行滤,不靠 replace 撞行尾 —— 行尾有没有 \n 由 show 的 trim 决定)
    const stolenText = landed
      .split('\n')
      .filter((l) => l !== ROW_THEIRS_ONLY)
      .join('\n')
    const stolen = treeWithPlan(dir, p.tree, stolenText)
    assert.ok(
      !U.show(stolen, 'PROJECT_PLAN.md', dir).includes('G-900204'),
      '夹具自证:产物面必须已经没有这一行(否则本臂什么都没偷到)',
    )
    // 伪造一本"它被折进了另一件事"的台账:kept 在场,但指纹与主键都对不上
    const forged = new Map([
      [
        'PROJECT_PLAN.md',
        {
          foldedAway: new Map([[ROW_THEIRS_ONLY, 1]]),
          foldedIn: new Map(),
          pairs: [{ dropped: ROW_THEIRS_ONLY, droppedCopies: 1, kept: ROW_OURS, keptCopies: 1 }],
        },
      ],
    ])
    const bad = U.verifyUnion(ours, theirs, stolen, dir, base, null, forged)
    assert.ok(
      shortRows(bad).some((s) => String(s).includes('G-900204')),
      `C) 伪造去向不得洗白真吞并,实测 ${JSON.stringify([...bad].map(String))}`,
    )
    assert.ok(
      [...bad].some((s) => String(s).includes('不是同一件事')),
      `C) 红句必须说清为什么不算折叠(去向身份不成立),实测 ${JSON.stringify([...bad].map(String))}`,
    )
    // 正向对照:同一本伪造台账 + **没被偷**的产物 ⇒ 不红(证明红来自缺行,不来自台账形状)
    const clean = U.verifyUnion(ours, theirs, p.tree, dir, base, null, new Map())
    assert.equal(clean.length, 0, `C 正向对照必须绿,实测 ${JSON.stringify([...clean].map(String))}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('D 串档台账(点一条期望表从不欠的行)⇒ 未判定并折进落地闸,不记通过', () => {
  const { dir, run } = scratchRepo()
  try {
    const { base, ours, theirs } = forkSameEvent(run, dir)
    const p = U.plan(ours, theirs, dir)
    const honest = p.foldLedgers.get('PROJECT_PLAN.md')
    const GHOST = '- [ ] G-900999 **这一行三面都没有,台账凭什么说折掉了它**〔串档夹具〕'
    const stale = new Map([
      [
        'PROJECT_PLAN.md',
        {
          foldedAway: new Map(honest.foldedAway).set(GHOST, 1),
          foldedIn: honest.foldedIn,
          pairs: [...honest.pairs, { dropped: GHOST, droppedCopies: 1, kept: ROW_OURS, keptCopies: 0 }],
        },
      ],
    ])
    const bad = U.verifyUnion(ours, theirs, p.tree, dir, base, null, stale)
    assert.ok(
      undeterminedRows(bad).some((s) => String(s).includes('G-900999')),
      `D) 串档台账必须被记「未判定」并点名,实测 ${JSON.stringify([...bad].map(String))}`,
    )
    assert.ok(bad.length > 0, 'D) 「未判定」必须进落地闸(不记通过 = 不许落地),否则这条通道等于放行')
    // 正向对照:同一枚产物 + 诚实台账 ⇒ 一处不红
    const clean = U.verifyUnion(ours, theirs, p.tree, dir, base, null, p.foldLedgers)
    assert.equal(clean.length, 0, `D 正向对照必须绿,实测 ${JSON.stringify([...clean].map(String))}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('E 漂移锁:foldDedupe(未折叠产物) 必须逐字等于 unionLines({dedupeTasks:true})', () => {
  const { dir, run } = scratchRepo()
  try {
    const { base, ours, theirs } = forkSameEvent(run, dir, `\n${ROW_UNIQUE}`, '')
    const a = U.show(ours, 'PROJECT_PLAN.md', dir)
    const b = U.show(theirs, 'PROJECT_PLAN.md', dir)
    const bt = U.show(base, 'PROJECT_PLAN.md', dir)
    const viaUnionLines = U.unionLines(a, b, bt, null, { dedupeTasks: true })
    const viaCore = U.foldDedupe(U.unionLines(a, b, bt, null, { dedupeTasks: false })).text
    assert.equal(
      viaCore,
      viaUnionLines,
      '两条路必须落同一份字节:折叠实现只有一个调用点,归并面与自证面才没有第二把尺子',
    )
    const ledger = U.foldDedupe(U.unionLines(a, b, bt, null, { dedupeTasks: false })).ledger
    const faces = `${a}\n${b}\n${bt}\n`
    for (const [l, n] of ledger.foldedAway) {
      assert.ok(faces.includes(l), `E) 台账报折的行必须能在三面里找到(不得凭空造一条):${l.slice(0, 40)}`)
      assert.ok(Number.isInteger(n) && n >= 1, `E) 折掉的份数必须是 ≥1 的整数,实测 ${n}`)
    }
    // 折叠是幂等的:对产物再跑一次不许再少一行(否则自证侧永远追不上产物面)
    const twice = U.foldDedupe(viaUnionLines)
    assert.equal(twice.text, viaUnionLines, 'E) 折叠对已折叠产物必须幂等(台账才会与产物同轮)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('F 源码级锁:折叠只有一个调用点,验证侧不得长出第二份折叠策略', () => {
  const src = srcMasked()
  const calls = (src.match(/dedupeByFingerprint\(/g) || []).length
  assert.equal(
    calls,
    1,
    `dedupeByFingerprint 在本器必须只有一个调用点(foldDedupe),实测 ${calls} 处 —— 两处各跑一遍必漂移`,
  )
  assert.match(src, /import \{ dedupeByFingerprint/, '折叠实现必须来自 lib/dedupe-ledger(唯一真相源)')
  assert.match(
    src,
    /from '\.\/check-plan-task-duplicates\.mjs'/,
    '去向举证必须复用门 194/203 那把指纹尺子,不得在本器另写"什么叫同一件事"',
  )
  const verify = topLevelBody(src, 'export function verifyUnion(')
  // 验证侧只许**问**折叠做了什么,不许重做折叠:择优选保留行 / 注记并入 这两件事只许住在 lib
  for (const forbidden of ['pickBest(', 'noteSegments(', 'uniqueNotes(', 'dedupeByFingerprint('])
    assert.ok(
      !verify.includes(forbidden),
      `verifyUnion 体内不得出现 ${forbidden} —— 那是第二份折叠策略(§22c)`,
    )
  assert.match(verify, /attestFoldPair\(/, '少带必须逐处举证;没有举证通道 = 例外静默生效')
  assert.match(verify, /bad\.push\(\.\.\.foldUndetermined\)/, '「未判定」必须折进落地闸,不许只报数')
  assert.match(verify, /bad\.pointerCaps\s*=/, '副本指针少带的既有通道不得被这次改写连带摘掉')
  assert.match(src, /formatFoldReport\(/, '报告必须经这一份出口排版(两处各印一遍必漂移)')
  assert.match(src, /同题折叠少带 \$\{foldCopies\} 份/, '合并提交信息必须带折叠份数')
  // 形状锁的活性自证:把"只调举证却不把未判定折进落地闸"那一版写进代码位,锁必须认不出它
  // (锁若对反证串也命中 ⇒ 它是空跑,拿它当证明就是把绿字当验证)
  const lazy = 'export function verifyUnion(){ attestFoldPair(x) }'
  assert.doesNotMatch(
    lazy,
    /bad\.push\(\.\.\.foldUndetermined\)/,
    '反证串必须落在锁的射程外,否则上面那条锁是恒绿断言',
  )
  assert.match(lazy, /attestFoldPair\(/, '反证串必须仍能命中举证通道那半(证明两半是两条不同的锁)')
})

test('G 旧调用方形态逐字同形:六参与空台账必须给出同一份裁决,放松只长在 PROJECT_PLAN.md', () => {
  const { dir, run } = scratchRepo()
  try {
    const { base, ours, theirs } = forkSameEvent(run, dir)
    const p = U.plan(ours, theirs, dir)
    const old = U.verifyUnion(ours, theirs, p.tree, dir, base)
    const empty = U.verifyUnion(ours, theirs, p.tree, dir, base, null, new Map())
    assert.deepEqual(
      [...old].map(String),
      [...empty].map(String),
      '没有折叠声明 ⇒ 期望表一条都不放松(放松只长在"确有台账声明"的那些格上)',
    )
    // 反证必须成立:本轮**确实**有合法折叠 ⇒ 不接台账红、接台账绿(这两组不许同空)
    assert.ok(shortRows(old).length >= 1, `G) 六参形态必须仍红(它就是修改前的形态),实测 ${JSON.stringify([...old].map(String))}`)
    assert.equal(shortRows(p.bad).length, 0, 'G) plan() 接了台账必须不红')
    // 放松只许长在开折叠的那一份档上:另两份结构上拿不到台账
    assert.equal(p.foldLedgers.has('AGENTS.md'), false, 'AGENTS.md 不得进折叠台账(它没开 dedupeTasks)')
    assert.equal(p.foldLedgers.has('README.md'), false, 'README.md 不得进折叠台账(它没开 dedupeTasks)')
    assert.deepEqual([...p.foldLedgers.keys()], ['PROJECT_PLAN.md'], '台账的键集只能是本器唯一决定开折叠的那一份档')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

/** 大括号配对取出顶层函数体(与 union-converge.test.mjs 同一手法:否则"函数在文件里"会被读成"判据在函数里")。 */
function topLevelBody(src, header) {
  const at = src.indexOf(header)
  assert.notEqual(at, -1, `源文件里找不到 ${header}`)
  let depth = 0
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') {
      depth--
      if (depth === 0) return src.slice(src.indexOf('{', at), j + 1)
    }
  }
  return assert.fail(`${header} 的括号没配平`)
}
