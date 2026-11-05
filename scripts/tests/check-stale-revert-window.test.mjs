// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 84 的「祖先窗口深度」镜像测试(G-806,§22c:直接 import 源模块,不复制实现)。
 *
 * 票面的量算前提(HEAD 现测 2026-09-29):`ANCESTOR_WINDOW = 40` 对 `PROJECT_PLAN.md`
 * (动过的提交 2,744 枚)只有 ≈1 小时 47 分的时间深度 ⇒ 一次陈旧回写若发生在 40 枚之前,
 * R1 逐字节比不中、R1r 的祖先正文也在窗口外,而**输出与"真新编辑"完全同形**(安静地通过)。
 *
 * 两维处置各有成对用例,缺一边判据就无牙:
 *  ① 热档(三本活文档)走深窗口 ANCESTOR_WINDOW_HOT —— W1:回写点深度 > 旧窗口、≤ 深窗口
 *     ⇒ 必须**判红**(旧实现看不见这一格);
 *  ② 窗口确证用尽而未命中:2026-10-25 起 R1 升级为深档(窗口用尽回落全历史)⇒ 窗外回写可
 *     取证并照判红 —— W2:浅窗口外、全历史内的普通路径回写必须判红并点名,且不得再喊
 *     「窗口不足」;同一深路径上的真新编辑必须 code 0,而 R1r(读祖先正文、仍保持窗口)的
 *     「未覆盖/窗口用尽」报名与结论行尾注照旧在场(未覆盖 ≠ 通过);W3:浅历史路径的
 *     真新编辑必须**连点名都没有**(证明点名吃证据,不是恒喊);
 *  W4:窗口用尽判据的边界恰是 "> window" —— 恰好 window 枚历史时**不得**喊"不足",
 *     且窗口内可命中 ⇒ 判红(哨兵取 window+1 枚的 off-by-one 锁);
 *  W5:源码形状反向锁(禁止把窗口数字改小 / 删掉"未判定"分支 / 回退到无哨兵的裸 max-count);
 *  W6:`ancestorCommits` 的外部契约(仍是数组 —— object-space-land / check-baseline-freshness
 *     两个消费者按数组用,形状漂了它们不会自己喊)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { __test__ as G } from '../check-stale-revert.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function repo() {
  const dir = mkScratch('stale-revert-win-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false')
  return { dir, run }
}

/**
 * 把 rel 逐版提交 k 次(v1..vk,每次整文件替换成单行 `v<i>`),返回第一枚(v1)的 sha9。
 * 深度刻意做成 `G.ANCESTOR_WINDOW + 3`(现读常量,不写死 43):
 *  - 对普通窗口(40)⇒ v1 在窗口外,旧实现/浅窗口**结构上不可能命中**;
 *  - 对深窗口(> 该深度,由 W5 的形状锁保证 ANCESTOR_WINDOW_HOT 更大)⇒ v1 在窗口内。
 */
function buildDepthHistory(ctx, rel, depth) {
  const { dir, run } = ctx
  put(dir, rel, 'v1\n')
  run('add', '-A')
  run('commit', '-qm', `${rel} v1`)
  const first = run('rev-parse', 'HEAD').slice(0, 9)
  for (let i = 2; i <= depth; i++) {
    put(dir, rel, `v${i}\n`)
    run('commit', '-qam', `${rel} v${i}`)
  }
  return first
}

const DEPTH = () => G.ANCESTOR_WINDOW + 3 // 43(现值 40 时);窗口数字若被上调,夹具深度跟着走

test('W1 ① 的阳性对照:热档回写到旧窗口之外、深窗口之内 ⇒ R1 必须判红并点名(旧实现在这里静默通过)', () => {
  assert.ok(G.ANCESTOR_WINDOW_HOT > G.ANCESTOR_WINDOW + 3, '夹具前提:深窗口必须容得下 DEPTH 枚历史')
  const { dir, run } = repo()
  try {
    const d = DEPTH()
    const first9 = buildDepthHistory({ dir, run }, 'PROJECT_PLAN.md', d)
    // 深度必须**确凿**超出普通窗口:否则 W1 什么都没证明(量出来,不是假设)。
    assert.ok(
      G.ancestorCommits(dir, 'PROJECT_PLAN.md').length === d && d > G.ANCESTOR_WINDOW,
      `夹具不对:动过 PROJECT_PLAN.md 的提交 ${d} 枚,须 > ANCESTOR_WINDOW=${G.ANCESTOR_WINDOW}`,
    )
    assert.equal(G.windowFor('PROJECT_PLAN.md'), G.ANCESTOR_WINDOW_HOT, '热档必须走深窗口')
    put(dir, 'PROJECT_PLAN.md', 'v1\n')
    run('add', '--', 'PROJECT_PLAN.md')
    const loss = []
    const v = G.analyze(dir, ['PROJECT_PLAN.md'], { windowLoss: loss })
    assert.equal(v.length, 1, `深窗口内逐字节命中 ⇒ 判红,实得 ${JSON.stringify(v)}`)
    assert.equal(v[0].path, 'PROJECT_PLAN.md')
    assert.equal(v[0].commit, first9, '必须点名回到的正是最老那枚(v1)')
    assert.deepEqual(loss, [], '深窗口真把它判出来了 ⇒ 不得再喊"窗口不足" —— ② 不许替 ① 兜底冒充')
    const r = G.audit(dir, { staged: true })
    assert.equal(
      r.code,
      1,
      `热档陈旧回写必须拦,实得 exit ${r.code}:${r.lines.join(' | ').slice(0, 300)}`,
    )
    assert.ok(r.lines.some((l) => l.includes('PROJECT_PLAN.md') && l.includes(first9)))
    assert.ok(
      !r.lines.some((l) => l.includes('[R1 未判定]')),
      '已命中即已判,不得再挂"窗口不足"的虚账',
    )
  } finally {
    rmScratch(dir)
  }
})

test('W2 深档对照:浅窗口外的普通路径回写 ⇒ 深档取证后必须判红(旧期望「无从取证」已被 2026-10-25 深档升级推翻)', () => {
  const { dir, run } = repo()
  try {
    const d = DEPTH()
    const first9 = buildDepthHistory({ dir, run }, 'notes/data.txt', d)
    // 夹具前提必须**量**出来:浅窗口确凿用尽(40 枚取满 + truncated)。否则下面证明的就不是深档
    // 救回的那一格,而是"本来就在窗口里"(W4 那种边界)。旧 W2 的错在于只量了"深度 > 窗口",
    // 没量 analyze 走的是深档 —— 2026-10-25 起 analyze 的祖先取材带 deep:true(窗口用尽回落全历史),
    // 所以"窗外无从取证"这个前提已经不成立。
    const shallow = G.ancestorWindow(dir, 'notes/data.txt')
    assert.equal(G.windowFor('notes/data.txt'), G.ANCESTOR_WINDOW, '普通路径必须走浅窗口')
    assert.equal(shallow.shas.length, G.ANCESTOR_WINDOW)
    assert.equal(shallow.truncated, true, '夹具前提:该路径动过的提交必须深于浅窗口')
    // 深档在窗口用尽时回落全历史 —— v1 因此可被取证(这不是放宽,是把"没判"变成"判过")。
    const deep = G.ancestorWindow(dir, 'notes/data.txt', { deep: true })
    assert.equal(deep.truncated, false, '全历史取得 ⇒ 已不是"窗口不足"')
    assert.equal(deep.shas.length, d)
    assert.equal(deep.shas[d - 1].slice(0, 9), first9, '全历史必须把最老那枚(v1)也取到')

    put(dir, 'notes/data.txt', 'v1\n')
    run('add', '--', 'notes/data.txt')
    const loss = []
    const v = G.analyze(dir, ['notes/data.txt'], { windowLoss: loss })
    assert.equal(v.length, 1, `深档已取证 ⇒ 必须判红,实得 ${JSON.stringify(v)}`)
    assert.equal(v[0].path, 'notes/data.txt')
    assert.equal(v[0].commit, first9, '必须点名回到的正是最老那枚(v1)')
    assert.deepEqual(loss, [], '深档真把它判出来了 ⇒ 不得再喊"窗口不足"(② 不许替 ① 兜底冒充)')
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 1, `浅窗口外的陈旧回写在深档下必须拦,实得 exit ${r.code}:${out.slice(0, 300)}`)
    assert.ok(r.lines.some((l) => l.includes('notes/data.txt') && l.includes(first9)))
    assert.doesNotMatch(out, /\[R1 未判定\]/, '深档已判 ⇒ 不得再挂"窗口不足"的虚账')
    // 第二臂:同一深路径上的**真新编辑** —— 命中与否只看字节,不看"路径深度像不像事故"。
    // R1 深档也判不出命中 ⇒ 不红;但 R1r(读祖先正文、仍保持浅窗口)必须把"窗口用尽"如实报名,
    // 结论行尾注同样带着它 —— 诚实面从 R1 的 windowLoss 转到了 R1r 这一侧(未覆盖 ≠ 通过)。
    put(dir, 'notes/data.txt', 'brand-new-content-line-never-committed\n')
    run('add', '--', 'notes/data.txt')
    const r2 = G.audit(dir, { staged: true })
    const out2 = r2.lines.join('\n')
    assert.equal(r2.code, 0, '真新编辑即使在深路径上也不得判红')
    assert.doesNotMatch(out2, /\[R1 未判定\]/, '深档可判 ⇒ R1 不再出"未判定"')
    assert.match(out2, /\[R1r 未覆盖\]/, 'R1r 仍走浅窗口:窗口用尽必须逐条报名,不得静默')
    assert.ok(
      out2.includes(`祖先窗口(${G.ANCESTOR_WINDOW} 枚)已用尽`),
      'R1r 的点名必须写清窗口枚数与该路径更早版本未取',
    )
    assert.ok(
      r2.lines.some((l) => l.startsWith('✅') && l.includes('未覆盖')),
      `通过结论必须带"未覆盖"尾注,不得给光秃秃的"通过":${out2.slice(-260)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('W3 成对的反向对照:浅历史路径的真新编辑 ⇒ 绿,且连"未判定/窗口不足"都不许出现(点名吃证据)', () => {
  const { dir, run } = repo()
  try {
    buildDepthHistory({ dir, run }, 'edits.txt', 3)
    put(dir, 'edits.txt', 'brand-new-line-xx-not-in-any-ancestor\n')
    run('add', '--', 'edits.txt')
    const loss = []
    assert.deepEqual(G.analyze(dir, ['edits.txt'], { windowLoss: loss }), [])
    assert.deepEqual(loss, [], '历史未超窗口 ⇒ 这不是"窗口不足",不得喊')
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 0, `正当编辑被拦 = 逼人绕过钩子(§12e):${out.slice(0, 300)}`)
    assert.doesNotMatch(out, /\[R1 未判定\]/)
    assert.ok(
      r.lines.some((l) => l.startsWith('✅') && !l.includes('未判定') && !l.includes('未覆盖')),
      `浅历史全窗判定的通过结论必须干净,实得:${out.slice(-260)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('W4 边界锁(哨兵 off-by-one):动过的提交恰好 = 窗口枚数 ⇒ truncated 必为 false,窗口内可命中 ⇒ 判红而不是"不足"', () => {
  const { dir, run } = repo()
  try {
    const first9 = buildDepthHistory({ dir, run }, 'boundary.txt', G.ANCESTOR_WINDOW)
    const aw = G.ancestorWindow(dir, 'boundary.txt')
    assert.equal(aw.shas.length, G.ANCESTOR_WINDOW)
    assert.equal(
      aw.truncated,
      false,
      '恰好取满 window 枚(探针 window+1 没拿满)⇒ 历史就到这里,"未判定"是谎',
    )
    put(dir, 'boundary.txt', 'v1\n')
    run('add', '--', 'boundary.txt')
    const loss = []
    const v = G.analyze(dir, ['boundary.txt'], { windowLoss: loss })
    assert.equal(v.length, 1, `最老一版恰在窗口内 ⇒ 必须判红,实得 ${JSON.stringify(v)}`)
    assert.equal(v[0].commit, first9)
    assert.deepEqual(loss, [], '能判就已判,② 不得兜底')
  } finally {
    rmScratch(dir)
  }
})

test('W5 源码形状反向锁:窗口不得改小、探针哨兵不得拆、"未判定"分支与结论尾注不得删、ancestorCommits 仍是投影', () => {
  // 值锁:改小 ANCESTOR_WINDOW 或把深窗口调回 ≤ 浅窗口,这一条先红(行为分支由 W1–W4 的构造面证)。
  assert.ok(G.ANCESTOR_WINDOW >= 40, `ANCESTOR_WINDOW 不得低于 40(现读 ${G.ANCESTOR_WINDOW})`)
  assert.ok(
    G.ANCESTOR_WINDOW_HOT > G.ANCESTOR_WINDOW,
    `深窗口必须严于浅窗口(现读 HOT=${G.ANCESTOR_WINDOW_HOT} vs ${G.ANCESTOR_WINDOW})`,
  )
  for (const hot of ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md'])
    assert.equal(
      G.windowFor(hot),
      G.ANCESTOR_WINDOW_HOT,
      `${hot} 必须走深窗口(名单正向证明,输入取自名单本身)`,
    )
  for (const cold of ['apps/web/src/a.tsx', 'scripts/check-stale-revert.mjs', 'docs/x.md'])
    assert.equal(
      G.windowFor(cold),
      G.ANCESTOR_WINDOW,
      `${cold} 必须保持浅窗口(深窗口对普通路径是白付钱)`,
    )

  const src = readFileSync(new URL('../check-stale-revert.mjs', import.meta.url), 'utf8')
  const code = maskCommentsAndStrings(src)
  // ② 的两条文字出口在**原文面**锁(字符串在遮罩面被抹,判据说明性文字不构成证据)。
  assert.match(
    src,
    /\[R1 未判定\]/,
    'audit 的 ❓ 点名块不得被删 —— 删掉它就回到"窗口外回写静默通过"',
  )
  assert.match(
    src,
    /窗口不足未判定\(R1\)/,
    '结论行尾注不得被删 —— 尾注是"没判"与"判过"在账面上的唯一区别',
  )
  assert.match(src, /深于窗口/, 'R1r 侧的窗口用尽报名措辞不得被删')
  // 形状锁在**原文面**判 max-count:模板串 `` `--max-count=${window + 1}` `` 在遮罩面会被抹白
  // (它是字符串),拿遮罩面判会把锁做成恒假;代码调用形状的锁仍走遮罩面(防注释假接线)。
  assert.match(
    src,
    /--max-count=\$\{window \+ 1\}/,
    '取探针必须问 window+1 枚 —— 拿满才算"窗外还有";裸 window 枚时"用尽"与"浅历史"同形,② 就瞎了',
  )
  assert.doesNotMatch(src, /--max-count=\$\{ANCESTOR_WINDOW\}/, '旧的无哨兵裸窗口取法不得回来')
  assert.match(
    code,
    /const truncated = shas\.length > window/,
    '用尽判据必须按"探针拿满"算(改成 >= 会把恰好等于窗口的浅历史误报成"不足",见 W4)',
  )
  assert.equal(
    (code.match(/windowLoss\.push\(/g) ?? []).length,
    2,
    'analyze 与 analyzeMerge 两条通道都必须真 push(少一条 = 该通道回到静默)',
  )
  // 2026-10-21:枚 9085a780baf(G-926)给 analyze / analyzeMerge / verdictLine 各加了
  // `watermarkPass` 一路 —— 三处形状锁仍停在旧形(红的就是这三条)。锁仍是**形状锁**
  // (钉"必须把收集口传进去"),只把新增的那一路按现役调用形状补上,不放松。
  assert.match(
    code,
    /analyze\(\s*repoRoot,\s*judged,\s*\{\s*source:\s*src,\s*windowLoss,\s*watermarkPass\s*\}/,
    'audit 必须把收集口传给 analyze',
  )
  assert.match(
    code,
    /analyzeMerge\(\s*repoRoot,\s*judged,\s*mergeHead,\s*\{\s*source:\s*src,\s*windowLoss,\s*watermarkPass,?\s*\}/,
    '合并分支同样要传(两父一致那一格也在射程)',
  )
  // 2026-11-01(P86):verdictLine 又多了 R1s 的四桶一路(`ms`),形状锁仍按**现役调用形状**补上,
  // 不放松:多出来的那一维正是"结论行必须带着未判定/存量尾注"的新落点,锁在它上面才有意义。
  assert.match(
    code,
    /verdictLine\(\s*modified\.length,\s*rr,\s*windowLoss\.length,\s*watermarkPass\.length,\s*staged \? 0 : violations\.length,\s*ms,?\s*\)/,
    '尾注数字必须现算现传,不得写 0(且 R1s 的桶必须一并传入)',
  )
  assert.match(
    code,
    /else if \(exhausted\)/,
    'R1r 的"整窗读满但窗口用尽"那一支不得删(否则小祖先正文的深回写照旧隐身)',
  )
  assert.match(
    code,
    /winMap\.set\(p, ancestorWindow\(repoRoot, p\)\)/,
    'R1r 必须走同一个带探针的窗口出口(两处数字必漂移)',
  )
  assert.match(
    code,
    /export function ancestorCommits\([^)]*\)\s*\{\s*return ancestorWindow\(repoRoot, path\)\.shas\s*\}/,
    'ancestorCommits 只能是 ancestorWindow 的投影 —— 窗口有第二份实现必漂移(本仓记过最多次)',
  )
})

test('W6 外部契约锁:ancestorCommits 仍返回数组(与投影等长),heal/baseline-freshness/object-space-land 的形状不因 G-806 漂', () => {
  const { dir, run } = repo()
  try {
    const d = DEPTH()
    buildDepthHistory({ dir, run }, 'PROJECT_PLAN.md', d)
    const list = G.ancestorCommits(dir, 'PROJECT_PLAN.md')
    assert.ok(
      Array.isArray(list),
      '返回形状是契约(对象化会砸掉两个消费者的按数组用法,而它们不会自己喊)',
    )
    assert.equal(list.length, d)
    assert.deepEqual(list, G.ancestorWindow(dir, 'PROJECT_PLAN.md').shas, '投影必须与源同值同序')
    // 深窗口把整段历史收进来了 ⇒ 不再是 truncated;若未来有人把 HOT 调小过头,这里会变。
    assert.equal(
      G.ancestorWindow(dir, 'PROJECT_PLAN.md').truncated,
      false,
      '夹具深度必须容得进深窗口,否则 W1 的前提塌了',
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
