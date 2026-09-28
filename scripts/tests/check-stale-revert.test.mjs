// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 84「反回退对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 本轮新增的判据是**性能护栏的例外**:普通文件超 300 个时整门跳过,但"乘数级"路径
 * (runner / 各道门自身 / 钩子 / package.json / 工作流 / 门的测试)必须照判 ——
 * 因为它们被写回旧版时**不会**表现为"少了一个功能",而是让一批守门静默失效。
 * 立因是 2026-09-24 同日两次实测:`guardian-runner.mjs` 的工作树副本落后 HEAD 61 行
 * (别人刚落地的守门 78 五维升级),任何人一次 `git add` 就替全队摘门,而当时全链无人报。
 *
 * 2026-09-25 第二轮加的是**合并场域的四对照 + 一把反向回归锁**:本门原先对
 * merge/cherry-pick/revert 上下文整轮豁免,而"两父在某路径上一致"时合并根本不会产出
 * 外来内容 —— 那句豁免正好是第四十二批登记的盲区。收窄成 R1m 后,必须由测试钉住
 * ①该红的红、②正当解冲突的绿、③`exempt ? [] : analyze(` 这种整轮放行写法不许回来。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { __test__ as G } from '../check-stale-revert.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

/** 夹具里的写入必须先建父目录 —— 直接 writeFileSync 到 `scripts/x.mjs` 会 ENOENT
 *  (本测试第一次跑就是这样红三条,不是判据错,是夹具缺一步)。 */
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function repo() {
  const dir = mkScratch('stale-revert-it-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 300000 }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  return { dir, run }
}

/** 造 n 个普通脏文件(用来把暂存集顶过 MAX_FILES) */
function pad(dir, run, n, content) {
  for (let i = 0; i < n; i++) put(dir, `junk-${i}.txt`, content)
  run('add', '-A')
}

/** v1 → v2 → 把 v1 重新放回暂存区 = 典型"旧基线回写" */
function stageAncestorContent(dir, run, rel, v1, v2) {
  put(dir, rel, v1)
  run('add', '-A')
  run('commit', '-qm', `${rel} v1`)
  put(dir, rel, v2)
  run('add', '-A')
  run('commit', '-qm', `${rel} v2`)
  put(dir, rel, v1) // 写回旧版
  run('add', '--', rel)
}

test('乘数级路径的识别:门的注册表 / 门自身 / 钩子 / 清单 / 工作流,普通源码不算', () => {
  const yes = [
    'scripts/guardian-runner.mjs',
    'scripts/check-stale-revert.mjs',
    'scripts/lib/gitdir.mjs',
    'scripts/tests/check-stale-revert.test.mjs',
    '.husky/pre-commit',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
  ]
  for (const p of yes) assert.ok(G.isMultiplierPath(p), `${p} 必须算乘数级`)
  for (const p of ['apps/web/src/app/page.tsx', 'packages/shared/src/chat/index.ts', 'README.md', 'docs/x.md'])
    assert.ok(!G.isMultiplierPath(p), `${p} 不该被当乘数级(会把护栏撑爆)`)
  assert.ok(G.isMultiplierPath('scripts\\guardian-runner.mjs'), 'Windows 反斜杠形态必须同样认得')
})

test('端到端:暂存集顶过上限时,乘数级回写仍必须判红(护栏不得把尺子一起改短)', () => {
  const { dir, run } = repo()
  try {
    stageAncestorContent(dir, run, 'scripts/guardian-runner.mjs', 'id: 1\n', 'id: 2\nid: 3\n')
    pad(dir, run, G.MAX_FILES + 20, 'junk\n')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 1, `超限场景下乘数级回写必须拦,实际 exit ${r.code} / ${r.lines.slice(-3).join(' | ')}`)
    assert.ok(
      r.lines.some((l) => l.includes('scripts/guardian-runner.mjs')),
      `必须点名是哪个文件:${r.lines.join('\n').slice(0, 300)}`,
    )
    assert.ok(r.lines.some((l) => l.includes('乘数级')), '结论行必须说清为什么这一类不吃护栏')
  } finally {
    rmScratch(dir)
  }
})

test('反向对照:真新编辑(既不等于 HEAD 也不等于任何祖先版本)不得判红', () => {
  const { dir, run } = repo()
  try {
    put(dir, 'scripts/guardian-runner.mjs', 'id: 1\n')
    run('add', '-A')
    run('commit', '-qm', 'v1')
    put(dir, 'scripts/guardian-runner.mjs', 'id: 1\n// 本次真正新增的一行\n')
    run('add', '-A')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 0, `正常改动被拦 = 这道门会逼人绕过钩子:${r.lines.join('\n').slice(0, 240)}`)
  } finally {
    rmScratch(dir)
  }
})

test('未超限时语义与改前一致:普通文件的回写照样判红', () => {
  const { dir, run } = repo()
  try {
    stageAncestorContent(dir, run, 'apps/web/src/a.ts', 'export const a = 1\n', 'export const a = 2\nexport const b = 3\n')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 1, '未超限时普通文件的旧基线回写必须照拦')
    assert.ok(r.lines.some((l) => l.includes('apps/web/src/a.ts')))
  } finally {
    rmScratch(dir)
  }
})

/**
 * 合并上下文夹具:main 上 docs/x.md = v2,另造一枚 theirs 分支 = theirs-9,
 * 然后把 **v1(祖先版本)** 放回暂存区 —— 这就是"合并期把旧基线写进索引"的现场。
 * 返回 {dir, run, writeHead, ours, theirs}。
 */
function mergeFixture() {
  const { dir, run } = repo()
  const write = (rel, text) => (put(dir, rel, text), run('add', '-A'))
  write('docs/x.md', 'v1\n')
  run('commit', '-qm', 'v1')
  write('docs/x.md', 'v2\n')
  run('commit', '-qm', 'v2')
  run('checkout', '-qb', 'theirs')
  write('docs/x.md', 'theirs-9\n')
  run('commit', '-qm', 'theirs')
  const theirs = run('rev-parse', 'HEAD')
  run('checkout', '-q', 'main')
  const ours = run('rev-parse', 'HEAD')
  write('docs/x.md', 'v1\n') // 旧基线回写进索引
  const gitDir = join(dir, run('rev-parse', '--git-dir'))
  return {
    dir,
    run,
    ours,
    theirs,
    inMerge: (sha) => writeFileSync(join(gitDir, 'MERGE_HEAD'), `${sha}\n`, 'utf8'),
    outOfMerge: () => rmSync(join(gitDir, 'MERGE_HEAD'), { force: true }),
  }
}

test('合并上下文不得再整轮豁免:两父一致而索引等于历史版本 ⇒ 判红并点名', () => {
  const f = mergeFixture()
  try {
    assert.ok(G.mergeHeadSha(f.dir) === null, '未写 MERGE_HEAD 时不该有 mergeHead')
    f.inMerge(f.ours) // theirs 就是 ours ⇒ 该路径两父逐字节一致
    assert.equal(G.inRevertContext(f.dir), true)
    const r = G.audit(f.dir, { staged: true })
    assert.equal(r.code, 1, '旧口径在这里整轮放行,正是第四十二批登记的盲区;收窄后必须判红')
    assert.ok(
      r.lines.some((l) => l.includes('docs/x.md')),
      `应点名被回写的路径,实际:${r.lines.join(' | ').slice(0, 200)}`,
    )
  } finally {
    f.outOfMerge()
    rmScratch(f.dir)
  }
})

test('反向对照(两型都必须放过):两父本就不同 / 两父一致但索引是新写内容', () => {
  const a = mergeFixture()
  try {
    a.inMerge(a.theirs) // docs/x.md: ours=v2 而 theirs=theirs-9 ⇒ 合并有权产出任一
    assert.equal(G.audit(a.dir, { staged: true }).code, 0, '两父不同 ⇒ 不可能是外来旧基线')
  } finally {
    a.outOfMerge()
    rmScratch(a.dir)
  }
  const b = mergeFixture()
  try {
    b.inMerge(b.ours)
    put(b.dir, 'docs/x.md', 'hand-resolved-fresh\n') // 人工解冲突写进的新内容
    b.run('add', '--', 'docs/x.md')
    assert.equal(
      G.audit(b.dir, { staged: true }).code,
      0,
      '新内容不等于任何历史版本 ⇒ 正当解冲突,绝不可拦',
    )
  } finally {
    b.outOfMerge()
    rmScratch(b.dir)
  }
})

test('回归锁:整轮豁免的那句写法不得回来(收窄是判据,不是临时关闭)', () => {
  const src = readFileSync(new URL('../check-stale-revert.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(
    src,
    /exempt\s*\?\s*\[\]\s*:\s*analyze\(/,
    '又变回"merge/cherry-pick/revert 整轮跳过 R1"了 ⇒ 合并期的外来旧基线将无人看守',
  )
  assert.match(src, /analyzeMerge\(/, 'audit 必须真的调用 R1m,否则函数成了摆设')
  assert.equal(typeof G.analyzeMerge, 'function')
})

/* ─────────────────────────────────────────────────────────────────────────────
 * R1r(复活行)—— 2026-09-28 补的那一格。
 *
 * 立论实测:R1 的前提"暂存内容 == 某个祖先版本"对「滞后副本 ⊕ 本次新增」的混合体**永假**,
 * 所以把 PROJECT_PLAN.md 的工作树副本只放进私有 GIT_INDEX_FILE、按 --staged 喂本门,旧版 RC=0
 * 并打印"✅ 反回退守门通过"。下面这组用例的存在理由就是:同一夹具必须由 R1r 判红并点名复活行,
 * 而**去掉那些复活行后必须 RC=0**(两臂同色 = 判据无牙)。
 *
 * 三条不可漂的写法各自有锁:
 *  ① 差值棘轮(存量只报数,不得当场判红 —— 恒红门 = 各会话 --no-verify = 全部守门作废);
 *  ② 三态不并桶(未判定/未覆盖必须点名,且结论行不得写成光秃秃的"通过");
 *  ③ 单一实现 + 索引面取材(判据住 lib;内容走 face-reader 的 catBatch,不得散写 git show/读盘)。
 * ───────────────────────────────────────────────────────────────────────────── */

/** 一次提交一枚文件,返回该枚的 sha(夹具历史要能点名)。 */
function commitFile(dir, run, rel, text, msg) {
  put(dir, rel, text)
  run('add', '--', rel)
  run('commit', '-qm', msg)
  return run('rev-parse', 'HEAD').trim()
}

/**
 * 事故原形(与 object-space-land 的 locale 夹具同源):A 有 5 行长文案,B 合法删掉它们并加了
 * 一行 cancel。把这些行搬回 + 再加一行真新键 ⇒ 暂存内容 = `A ⊕ 新行`,不等于任何祖先。
 */
const QUIT_LINES = [
  '  "quitChecking": "正在检查更新",',
  '  "quitDownloading": "正在下载更新",',
  '  "quitQuitting": "正在退出",',
  '  "quitRestarting": "正在重启",',
  '  "quitSkip": "跳过更新",',
]
const LOCALE_A = ['{', '  "checkUpdate": "检查更新",', ...QUIT_LINES, '  "settings": "设置"', '}', ''].join('\n')
const LOCALE_B = ['{', '  "checkUpdate": "检查更新",', '  "cancel": "取消",', '  "settings": "设置"', '}', ''].join('\n')
const NEW_KEY_LINE = '  "formChannelUnavailable": "该表单暂不可用",'

function localeRepoCtx() {
  const { dir, run } = repo()
  commitFile(dir, run, 'locale.json', LOCALE_A, 'A: 含 5 行 quit* 文案')
  const ancestor = run('rev-parse', 'HEAD').trim().slice(0, 9)
  commitFile(dir, run, 'locale.json', LOCALE_B, 'B: 合法删掉 quit*,加了 cancel')
  return { dir, run, ancestor9: ancestor }
}

function localeRepo(t) {
  const ctx = localeRepoCtx()
  t.after(() => rmScratch(ctx.dir))
  return ctx
}

test('R1r 阳性对照(本票存在的全部理由):祖先副本 ⊕ 真新行 ⇒ R1 看不见、R1r 判红并点名复活行', (t) => {
  const { dir, run, ancestor9 } = localeRepo(t)
  const hybrid = LOCALE_A.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`)
  put(dir, 'locale.json', hybrid)
  run('add', '--', 'locale.json')
  // 先证明这一格确实是 R1 的盲区(不是"两道判据都红,说不清是谁拦的")
  assert.deepEqual(G.analyze(dir, ['locale.json']), [], '夹具不对:混合体本就不该被整 blob 判据命中')
  const r = G.audit(dir, { staged: true })
  const out = r.lines.join('\n')
  assert.equal(r.code, 1, `R1r 必须拦下混合体回写,实得 ${r.code}:${out.slice(0, 400)}`)
  assert.match(out, /R1r/, '结论必须点名是 R1r 这一支,免得读成 R1 的既有判据')
  assert.match(out, /locale\.json/)
  assert.match(out, /复活 5 行/)
  assert.ok(out.includes(ancestor9), `必须点名复活内容出自哪枚祖先,实得 ${out.slice(0, 400)}`)
  assert.match(out, /↺ 复活: .*quitChecking/, '必须点名到**复活行本身**,不能只报一个数')
  assert.ok(!/↺ 复活: .*formChannelUnavailable/.test(out), '真新键不得被算成复活行(③ 不成立的那一类)')
})

test('R1r 反向对照(证明不是恒红):只加真新行、不搬旧行 ⇒ RC=0 且结论行不带"未判定"杂质', (t) => {
  const { dir, run } = localeRepo(t)
  put(dir, 'locale.json', LOCALE_B.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`))
  run('add', '--', 'locale.json')
  const r = G.audit(dir, { staged: true })
  assert.equal(r.code, 0, `正当编辑被拦 = 这道门会逼人绕过钩子:${r.lines.join('\n').slice(0, 400)}`)
  assert.ok(r.lines.some((l) => l.startsWith('✅')), '通过必须给结论行')
  assert.ok(!r.lines.some((l) => l.startsWith('✅') && l.includes('未判定')), '本夹具是全部判定的,结论行不得凭空挂未判定')
})

test('R1r 差值棘轮:复活量不超过该文件 HEAD 侧自身存量 ⇒ **只报数不判红**(存量不是本次带进来的)', (t) => {
  // A 有 L1/L2/L3 三行长文案;B 全删;C 把 L1 合法搬回来 ⇒ HEAD 那一步**自身**就复活了 1 行(锚点=1)。
  // 暂存 = C ⊕ L2 ⊕ 一行真新键 ⇒ 复活 1 行 ≤ 存量 1 ⇒ 只报数;而它是混合体 ⇒ R1 结构上看不见。
  const L1 = '  "alpha_long_key": "值甲一",'
  const L2 = '  "bravo_long_key": "值乙一",'
  const L3 = '  "charlie_long_key": "值丙一",'
  const NEW = '  "delta_new_key": "本次真新增的一行",'
  const { dir, run } = repo()
  commitFile(dir, run, 'pack.txt', `{\n${L1}\n${L2}\n${L3}\n}\n`, 'A: 三行长文案')
  commitFile(dir, run, 'pack.txt', '{\n}\n', 'B: 删掉三行')
  commitFile(dir, run, 'pack.txt', `{\n${L1}\n}\n`, 'C: 按业务要求把甲搬回来(⇒ HEAD 侧存量 1)')
  t.after(() => rmScratch(dir))
  put(dir, 'pack.txt', `{\n${L1}\n${L2}\n${NEW}\n}\n`) // HEAD ⊕ 把乙也搬回来 ⊕ 一行真新键
  run('add', '--', 'pack.txt')
  assert.equal(G.analyze(dir, ['pack.txt']).length, 0, '夹具不对:这一份必须不等于任何祖先(R1 才谈得上看不见)')
  const r = G.audit(dir, { staged: true })
  const out = r.lines.join('\n')
  assert.equal(r.code, 0, `复活量未超过存量却判红 = 恒红门(§12f):${out.slice(0, 400)}`)
  assert.match(out, /R1r 只报数/)
  assert.match(out, /复活 1 行\(HEAD 侧存量 1 行\)/)
  assert.match(out, /其中 1 处复活只报数\(存量\)/, '结论行必须带着这个只报数的数,不得读成"全部判过且干净"')
  // 再把同一把尺子的红臂钉住:多搬一行(乙+丙)就超过存量 ⇒ 必须红 —— 否则"只报数"那一支
  // 与"判据根本没跑"在账面上长得一模一样。
  put(dir, 'pack.txt', `{\n${L1}\n${L2}\n${L3}\n${NEW}\n}\n`)
  run('add', '--', 'pack.txt')
  const r2 = G.audit(dir, { staged: true })
  assert.equal(r2.code, 1, `复活 2 行 > 存量 1 行时必须红,实得:${r2.lines.join('\n').slice(0, 300)}`)
  assert.match(r2.lines.join('\n'), /复活 2 行\(HEAD 侧自身存量 1 行\)/)
})


test('R1r 未判定必须点名、且不得被写成通过(预算耗尽型)', () => {
  const { dir, run } = localeRepoCtx()
  try {
    put(dir, 'locale.json', LOCALE_A.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`))
    run('add', '--', 'locale.json')
    // ① 单路径读取预算压到 1B ⇒ 该路径必须落未判定(而不是被静默跳过 = 把没判写成判过了)
    const rr = G.analyzeResurrect(dir, ['locale.json'], { pathBudgetBytes: 1 })
    assert.equal(rr.undetermined.length, 1, JSON.stringify(rr))
    assert.match(rr.undetermined[0].reason, /预算 1B 不足以读最近一枚祖先正文/)
    assert.deepEqual([rr.red.length, rr.stock.length], [0, 0], '未判定不得同时被计成任何一色结论')
    // ② 结论行的措辞由 verdictLine 统一:有未判定就必须带出来,不得给光秃秃的"通过"
    const line = G.verdictLine(1, rr)
    assert.match(line, /其中 1 处未判定/)
    assert.doesNotMatch(line, /通过\(判定 1 个文件,无历史版本回写\)$/, '光秃秃的"通过"就是把没判写成判过了')
    // ③ 整轮预算压到 0 ⇒ 同样必须点名,绝不因"没读"而少一桶
    const zero = G.analyzeResurrect(dir, ['locale.json'], { runBudgetBytes: 0 })
    assert.equal(zero.undetermined.length, 1, JSON.stringify(zero))
    assert.match(zero.undetermined[0].reason, /总读取预算/)
    // ④ 新增文件(HEAD 侧没有这一路径)按定义无从判"复活" ⇒ **不判红但必须报名**为未覆盖,
    //    不得只累一个计数器就过去(那与"把没判写成判过了"是同一条禁令的较轻版本)。
    //    刻意只喂 brand-new.txt 一条:同一批里 locale.json 还带着臂①的混合体,混喂会让"不得判红"
    //    这条断言去判别人的账(第一版就是这样红的 —— 红得对,是夹具不对)。
    put(dir, 'brand-new.txt', '  "brand_new_long_key": "全新文件的一行",\n')
    run('add', '--', 'brand-new.txt')
    const nn = G.analyzeResurrect(dir, ['brand-new.txt'])
    assert.equal(nn.red.length, 0, `新增文件不得被判红,实得 ${JSON.stringify(nn.red)}`)
    assert.ok(
      nn.uncovered.some((u) => u.path === 'brand-new.txt' && /HEAD 侧没有该路径/.test(u.reason)),
      `新增文件必须逐条报名为未覆盖,实得 ${JSON.stringify(nn.uncovered)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('R1r 只判索引面:同一份混合体,索引面判红、工作树面只报不判(盘上副本属机器状态)', () => {
  const { dir, run } = localeRepoCtx()
  try {
    const hybrid = LOCALE_A.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`)
    put(dir, 'locale.json', hybrid) // **只**脏工作树,索引仍等于 HEAD
    const full = G.audit(dir, { staged: false })
    assert.equal(full.code, 0, `全量档因机器状态判红 = 每台每次必红:${full.lines.join('\n').slice(0, 300)}`)
    assert.match(full.lines.join('\n'), /只判索引面/)
    run('add', '--', 'locale.json') // 同一份内容进了索引 ⇒ 必须判红
    assert.equal(G.audit(dir, { staged: true }).code, 1, '索引面那一臂必须红,否则本条只是"两处都不判"')
  } finally {
    rmScratch(dir)
  }
})

test('R1r 在合并上下文走与 R1m 同一条窄判据:两父一致照判,两父不同让路', () => {
  const { dir, run, ancestor9 } = localeRepoCtx()
  const gitDir = join(dir, run('rev-parse', '--git-dir'))
  const hybrid = LOCALE_A.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`)
  try {
    // 臂 A:theirs 分支只动别的文件 ⇒ 该路径上两父逐字节一致 ⇒ 合并对它无事可做 ⇒ 照判
    run('checkout', '-qb', 'theirs-a')
    commitFile(dir, run, 'other.txt', 'x\n', 'theirs-a 动别的文件')
    run('checkout', '-q', 'main')
    put(dir, 'locale.json', hybrid)
    run('add', '--', 'locale.json')
    writeFileSync(join(gitDir, 'MERGE_HEAD'), `${run('rev-parse', 'theirs-a')}\n`, 'utf8')
    const a = G.audit(dir, { staged: true })
    assert.equal(a.code, 1, `两父一致时合并期混合体回写必须照判:${a.lines.join('\n').slice(0, 300)}`)
    assert.match(a.lines.join('\n'), /R1r/)
    assert.ok(
      a.lines.join('\n').includes(ancestor9),
      `仍要点名祖先 ${ancestor9},实得:${a.lines.join('\n').slice(0, 400)}`,
    )
    rmSync(join(gitDir, 'MERGE_HEAD'), { force: true })
    // 臂 B:theirs 在该路径上本就与 ours 不同 ⇒ 合并有权产出任一/融合结果 ⇒ 让路
    run('checkout', '-qb', 'theirs-b', 'theirs-a')
    put(dir, 'locale.json', LOCALE_A)
    run('add', '--', 'locale.json')
    run('commit', '-qm', 'theirs-b 把 locale.json 改成 A 形态')
    const b = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'main')
    put(dir, 'locale.json', hybrid)
    run('add', '--', 'locale.json')
    writeFileSync(join(gitDir, 'MERGE_HEAD'), `${b}\n`, 'utf8')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 0, `两父不同却判红 = 把正当合并钉成恒红:${r.lines.join('\n').slice(0, 300)}`)
    rmSync(join(gitDir, 'MERGE_HEAD'), { force: true })
  } finally {
    rmScratch(dir)
  }
})


test('形状锁:R1r 的判据只能引 lib 那一份,门内不得出现第二份计行/散写取内容', () => {
  const url = new URL('../check-stale-revert.mjs', import.meta.url)
  const src = readFileSync(url, 'utf8')
  // 判"实现"必须看**遮掉注释与字符串之后**的代码面 —— 本门的头注里就写着 `git show`、
  // "第 84 项"这类叙述,拿原文面判会把解释自己的散文判成违规(守门 70/131 同型)。
  const code = maskCommentsAndStrings(src)
  assert.match(
    src,
    /import\s*\{[^}]*\bresurrectAnalysis\b[^}]*\}\s*from\s*['"]\.\/lib\/stale-content-analysis\.mjs['"]/,
    'R1r 必须与落地器共用 lib 那一份判据(两处各写一遍必漂移)',
  )
  assert.match(code, /resurrectAnalysis\s*\(/, 'import 了却没调用 = 判据仍是自写的(假接线)')
  for (const secondImpl of [/function\s+linesOf\b/, /function\s+tallyLines\b/, /function\s+resurrectAnalysis\b/, /replace\(\/\\r\$\//])
    assert.ok(!secondImpl.test(code), `门内出现第二份行级实现:${secondImpl}`)
  assert.doesNotMatch(code, /\bexecSync\s*\(/, '不得再散写 execSync 取被审内容(守门 118/80)')
  assert.doesNotMatch(code, /readFileSync\s*\(\s*join\(/, '不得按磁盘读被审内容(共享工作树滞后即换结论)')
  assert.match(code, /catBatch\s*\(/, '正文一律走 face-reader 的批量读取口(索引面同面同轮)')
  // lib 自己必须是那唯一一份
  const libSrc = readFileSync(new URL('../lib/stale-content-analysis.mjs', import.meta.url), 'utf8')
  assert.equal((libSrc.match(/replace\(\/\\r\$\//g) ?? []).length, 1, 'lib 里也只允许一处剥尾 \\r')
})

/**
 * 探针索引端到端 —— **票面要求的那格取证的可重跑版本**。
 *
 * 立论实测(2026-09-28):把一份"祖先 ⊕ 新增"的混合体**只**放进私有 `GIT_INDEX_FILE` 指的临时索引
 * (工作树仍是 HEAD 形态、主索引一步未动),按 `--staged` 喂旧版这道门 ⇒ RC=0 且打印
 * "✅ 反回退守门通过"。所以这条用例同时钉三件事:
 *  ① 判据看的是**索引面**(不是磁盘)—— 工作树自始至终是干净的 HEAD 形态,红只能来自索引;
 *  ② 混合体必须 exit 1 并点名复活行(阳性对照);
 *  ③ 把那些复活行去掉、只留真新行 ⇒ 同一套夹具必须 exit 0(反向对照,证明不是恒红)。
 * 夹具全程在 mkScratch 临时仓里,绝不影响真仓的主索引/工作树。
 */
test('探针索引端到端:混合体只进私有 GIT_INDEX_FILE ⇒ --staged 判红;去掉复活行 ⇒ RC=0;工作树从未被动', () => {
  const { dir, run, ancestor9 } = localeRepoCtx()
  const gitDir = join(dir, run('rev-parse', '--git-dir'))
  const probe = join(gitDir, 'probe-index')
  const hybrid = LOCALE_A.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`)
  const honest = LOCALE_B.replace('  "settings"', `${NEW_KEY_LINE}\n  "settings"`)
  const wtBefore = readFileSync(join(dir, 'locale.json'), 'utf8')
  // 主索引那一问必须**剥掉** GIT_INDEX_FILE —— 否则它读的就是探针索引本身,"主索引没动"会被
  // 读成"动了"(我第一版就是这样:env 是进程级的,run() 继承了我自己刚设的那一枚)。
  const mainEnv = () => {
    const e = { ...process.env }
    delete e.GIT_INDEX_FILE
    return e
  }
  const gitMain = (args) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, env: mainEnv(), timeout: 300000 }).trim()
  const mainIdxBefore = gitMain(['ls-files', '-s', '--', 'locale.json'])
  const gitWith = (args, opts = {}) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_INDEX_FILE: probe }, ...opts })

  const stageIntoProbe = (text) => {
    if (existsSync(probe)) rmSync(probe, { force: true })
    gitWith(['read-tree', 'HEAD'])
    const oid = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'hash-object', '-w', '--stdin'], {
      input: text,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
    }).trim()
    gitWith(['update-index', '--add', '--cacheinfo', `100644,${oid},locale.json`])
    return oid
  }

  const prevEnv = process.env.GIT_INDEX_FILE
  try {
    // 臂 A:祖先 ⊕ 真新行
    const badOid = stageIntoProbe(hybrid)
    process.env.GIT_INDEX_FILE = probe
    const a = G.audit(dir, { staged: true })
    const outA = a.lines.join('\n')
    assert.equal(a.code, 1, `混合体在索引面必须判红,实得 ${a.code}:${outA.slice(0, 400)}`)
    assert.ok(outA.includes(badOid.slice(0, 9)) || /locale\.json/.test(outA), '必须点名到那个路径')
    assert.match(outA, /↺ 复活: .*quitChecking/)
    assert.ok(outA.includes(ancestor9), `要点名复活来源祖先 ${ancestor9}`)
    assert.equal(readFileSync(join(dir, 'locale.json'), 'utf8'), wtBefore, '工作树必须逐字未动(判的是索引,不是磁盘)')
    assert.equal(gitMain(['ls-files', '-s', '--', 'locale.json']), mainIdxBefore, '主索引必须一步没动')
    // 同一份索引内容喂 R1:必须**空** —— 这就是旧版沉默、本票要补的那一洞(阳性对照的红确实来自 R1r)
    assert.deepEqual(G.analyze(dir, ['locale.json']), [], 'R1 对混合体永不到账,否则说不清是谁拦的')

    // 臂 B:同一把尺子、同一套夹具,只把复活行去掉 ⇒ 必须绿(否则本判据就是恒红门)
    stageIntoProbe(honest)
    const b = G.audit(dir, { staged: true })
    assert.equal(b.code, 0, `只加真新行却判红 = 恒红门:${b.lines.join('\n').slice(0, 400)}`)
    assert.match(b.lines.join('\n'), /✅/)
  } finally {
    if (prevEnv === undefined) delete process.env.GIT_INDEX_FILE
    else process.env.GIT_INDEX_FILE = prevEnv
    rmSync(probe, { force: true })
    rmScratch(dir)
  }
})



// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * R1r 键变换的第二格(2026-09-28 由本门自撞抓到,补在这里而不是只写在注释里)。
 * 现象:提交链的 lint-staged 会对 staged 文件跑 `prettier --write`,而本仓有一批文件在 HEAD 里就
 * 不合规 ⇒ 第一次碰它的提交必然带上整片重排;重排后的 `        windowsHide: true,`(8 格)逐字等于
 * 某个祖先的形态、却不等于 HEAD 的 6 格形态 ⇒ **纯格式化被读成"复活了一行旧内容"**,整枚提交被拒,
 * 归因还把红定责到本次文件。后果与尾逗号那一格一模一样:人开始挂 LAND_ALLOW_STALE,连真回退一起放行。
 * 这两条断言是一对的:只留前一条,判据可以退化成"什么都不算复活"而照样绿。
 */
test('R1r 键变换:纯缩进重排不得计复活,而真回退一行必须照旧点名(成对)', async () => {
  const { resurrectAnalysis } = await import('../lib/stale-content-analysis.mjs')
  const head = ['function f() {', '      windowsHide: true, // 提交链派生控制台程序时不得弹窗', '  return 1', '}'].join('\n')
  const ancestor = [
    'function f() {',
    '        windowsHide: true, // 提交链派生控制台程序时不得弹窗',
    '  return 1',
    '}',
  ].join('\n')
  const reformatted = [
    'function f() {',
    '        windowsHide: true, // 提交链派生控制台程序时不得弹窗',
    '  return 1',
    '  // 本次真的新增了一行说明',
  ].join('\n')
  const a = resurrectAnalysis({ baseText: head, newText: reformatted, ancestors: [{ commit: 'a1b2c3d', text: ancestor }] })
  assert.equal(a.status, 'judged', `纯重排应当可判,实得 ${a.status}/${a.reason}`)
  assert.equal(a.count, 0, `纯缩进重排不得算复活,实得 ${a.count}:${JSON.stringify(a.sample).slice(0, 120)}`)
  // 同一把尺子必须仍咬得住真回退:HEAD 侧那行的**内容**在落地面整个消失,换成祖先版本
  const rolledBack = [
    'function f() {',
    '      windowsHide: false, // 祖先里那版把弹窗开关写回默认,正是要拦的形态',
    '  return 1',
  ].join('\n')
  const b = resurrectAnalysis({ baseText: head, newText: rolledBack, ancestors: [{ commit: 'd4e5f6a', text: rolledBack }] })
  assert.ok(b.status === 'judged' && b.count > 0, `真回退必须被点名(放宽键不许把牙一起磨掉),实得 ${b.status}/${b.count}`)
})
