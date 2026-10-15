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
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { __test__ as G } from '../check-stale-revert.mjs'
import { resurrectKey, resurrectAnalysis } from '../lib/stale-content-analysis.mjs'
// §22c:白名单与标记集**只在 lib 里有一份**,本测试一律从源头 import,禁止在这里重抄键名清单。
import {
  RESURRECT_PROVENANCE_KEYS,
  RESURRECT_PROVENANCE_LINE_RE,
  GENERATED_SELF_EVIDENCE_RES,
  generatedProvenanceResurrectKey,
  isGeneratedSelfDescribing,
  isResurrectProvenanceLine,
} from '../lib/stale-content-analysis.mjs'
import { __test__ as PIN_LIB } from '../lib/generated-input-pin.mjs'

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
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 300000 }).trim()
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

test('乘数级路径的识别:门的注册表 / 门自身 / 钩子 / 清单 / 工作流 / 三本活文档,普通源码不算', () => {
  const yes = [
    'scripts/guardian-runner.mjs',
    'scripts/check-stale-revert.mjs',
    'scripts/lib/gitdir.mjs',
    'scripts/tests/check-stale-revert.test.mjs',
    '.husky/pre-commit',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
    // 三本活文档(2026-09-29 收进射程;正向证明按门 120 的规矩必须"输入取自名单本身")
    'PROJECT_PLAN.md',
    'AGENTS.md',
    'README.md',
  ]
  for (const p of yes) assert.ok(G.isMultiplierPath(p), `${p} 必须算乘数级`)
  for (const p of ['apps/web/src/app/page.tsx', 'packages/shared/src/chat/index.ts', 'docs/x.md'])
    assert.ok(!G.isMultiplierPath(p), `${p} 不该被当乘数级`)
  assert.ok(G.isMultiplierPath('scripts\\guardian-runner.mjs'), 'Windows 反斜杠形态必须同样认得')
  assert.ok(G.isMultiplierPath('PROJECT_PLAN.md'.replace(/\//g, '/')), '台账形态必须认得(名本身即仓库根相对路径)')
})

/**
 * 反向对照(这条才是本次扩容的意义所在):护栏**只**收普通文件,乘数级恒照判。
 * 旧口径把 `README.md` 当普通文件 ⇒ 一次 ≥301 个普通文件的暂存集会同时躲过 R1 与 R1r,
 * 台账被整本写回旧版时**退出码 0、不点名**。这里用同一把尺子跑两个臂:
 *  A 臂 = 311 个普通文件 + 一份"等于祖先版本"的台账 ⇒ 必须仍点名 PROJECT_PLAN.md;
 *  B 臂 = 只暂存那份台账 ⇒ 同样点名(证明 A 臂不是因为"文件少才判得到")。
 */
test('护栏短路时三本活文档仍被点名(旧口径下这一格无人看守)', () => {
  const { dir, run } = repo()
  try {
    stageAncestorContent(dir, run, 'PROJECT_PLAN.md', '- [ ] D9 旧形态\n', '- [x] ✅(2026-01-01) D9 新形态\n')
    pad(dir, run, G.MAX_FILES + 20, 'junk\n')
    const r = G.audit(dir, { staged: true })
    assert.equal(
      r.code,
      1,
      `台账被写回旧版时,一次 ≥${G.MAX_FILES + 1} 个普通文件的暂存集**不得**把它洗成绿(实际 exit ${r.code})`,
    )
    assert.ok(
      r.lines.some((l) => l.includes('PROJECT_PLAN.md')),
      `必须点名 PROJECT_PLAN.md,实际结论行:${r.lines.slice(-4).join(' | ')}`,
    )
  } finally {
    rmScratch(dir)
  }
})

/**
 * 祖先窗口 lazify 的**错位**自证(本次改动的真实风险不在"少判",而在"多判"):
 * 新写法把 specs 拆成两批取,配对靠 `pre += 2` 手工推进 —— 一旦错位,`cur` 会读到
 * 别的文件的 oid,于是"与 HEAD 一致"的文件被判成回写(假红),或反之(假绿)。
 * 这里放三份:一份等于 HEAD、一份等于祖先、一份是真新内容 ⇒ 只许中间那份被点名。
 */
test('lazify 之后不得错位:等于 HEAD 的文件必须一个都不点名,等于祖先的那份必须点名', () => {
  const { dir, run } = repo()
  try {
    const v1 = 'export const a = 1\n'
    const v2 = 'export const a = 2\nexport const b = 3\n'
    // 三份**同一批**建 v1 → v2 → HEAD,避免逐份建时 `add -A` 把别份的在途形态烘进提交(第一版
    // 就是踩了这个:第二份的"回写"被顺手 commit 成了 HEAD,于是"等于 HEAD"的断言对着旧内容判)。
    for (const f of ['a', 'b', 'c']) put(dir, `scripts/check-${f}.mjs`, v1)
    run('add', '-A')
    run('commit', '-qm', 'v1')
    for (const f of ['a', 'b', 'c']) put(dir, `scripts/check-${f}.mjs`, v2)
    run('add', '-A')
    run('commit', '-qm', 'v2')
    // a 留 HEAD 形态;b 写回 v1(真回写);c 写成既不等于 HEAD 也不等于任何祖先的新内容
    put(dir, 'scripts/check-b.mjs', v1)
    put(dir, 'scripts/check-c.mjs', 'export const a = 99\nexport const z = 1\n')
    run('add', '--', 'scripts/check-b.mjs', 'scripts/check-c.mjs')
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 1, `b 的回写必须拦(实际 exit ${r.code})`)
    assert.ok(r.lines.some((l) => l.includes('scripts/check-b.mjs')), `必须点名 b:${r.lines.slice(-4).join(' | ')}`)
    assert.ok(!r.lines.some((l) => l.includes('scripts/check-a.mjs')), 'a 与 HEAD 逐字相同,不得被点名')
    assert.ok(!r.lines.some((l) => l.includes('scripts/check-c.mjs')), 'c 是真新内容,不得被点名')
  } finally {
    rmScratch(dir)
  }
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

test('输入指纹注释行:同一输入的不同 hash 不算「复活旧内容」(门 84 R1r,2026-10-03)', () => {
  // 这一族全部走**纯函数**(不建真仓、不 spawn git):本机 spawnSync git 恒 EBUSY,
  // 端到端那几例在本地判不出,而这里要钉的判据本身就是纯的(resurrectKey / resurrectAnalysis)。
  const OLD = '1'.repeat(64)
  const NEW = '2'.repeat(64)
  const oldLine = '// input: packages/i18n/messages/shared/en.json ' + OLD
  const newLine = '// input: packages/i18n/messages/shared/en.json ' + NEW

  // ① 不同 hash 归一为同一行
  assert.equal(resurrectKey(oldLine), resurrectKey(newLine), '同一输入的不同 hash 必须归一')
  // ② 归一后输入路径仍在(信息不丢)
  assert.ok(resurrectKey(newLine).includes('packages/i18n/messages/shared/en.json'), '归一须保留输入路径')
  // ③ 不同输入路径不得归一(否则两个文件的指纹被混成一行 = 真的放宽了牙)
  assert.notEqual(
    resurrectKey('// input: a/en.json ' + OLD),
    resurrectKey('// input: b/ja.json ' + OLD),
    '不同输入路径不得归一',
  )
  // ④ 内容行不受影响(不带 // input: 前缀 ⇒ 原样)
  assert.ok(resurrectKey('  "agreement": { "staticContent1": "x", },').includes('agreement'), '内容行不受影响')
  // ⑤ 端到端:只改指纹 hash ⇒ 不判复活
  const base = ['// input: x.json ' + OLD, '"k": "v"'].join('\n')
  const r = resurrectAnalysis({
    baseText: base,
    newText: ['// input: x.json ' + NEW, '"k": "v"'].join('\n'),
    ancestors: [{ commit: 'deadbee', text: base }],
  })
  assert.equal(r.count, 0, `只改指纹 hash 不得判复活(实测 ${r.count})`)
  // ⑥ 牙仍在:真把旧内容搬回来照样判红
  const rolled = ['// input: x.json ' + OLD, '"k": "v"', '"staleKey": "old"'].join('\n')
  const r2 = resurrectAnalysis({ baseText: base, newText: rolled, ancestors: [{ commit: 'deadbee', text: rolled }] })
  assert.ok(r2.count > 0, `搬回旧内容必须仍判红(实测 ${r2.count})`)
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

/**
 * G-587(2026-10-13):R1r 的内容性档 —— 结构符/样板行(`if: failure()` / `fi` / `exit 0` / `}`)
 * 只报数不判红。立因:2026-09-28 落地 CI 失败自述步骤(4f61a35f6)时实测假阳,祖先 fbe0e3f65
 * 是架构迁移前的旧 workflow,里面一批 `- name: 阻断提示 / if: failure()` 随迁移整块消失,
 * 之后任何人在 ci.yml 加失败分支步骤都会撞上同一行。成对断言缺一不可:
 * 只留样板不红,判据可以退化成"所有 ci.yml 行都不算证据";只留真阳性红,样板假阳照旧。
 */
test('R1r 内容性档:样板行进样板档只报数,真阳性与引号形态行照旧计数(成对)', async () => {
  const { resurrectAnalysis, RESURRECT_BOILER_LINE_RE } = await import('../lib/stale-content-analysis.mjs')
  // ① 样板形态正判:if: failure() 命中样板档;fi/exit 0/} 是骨架(无字母或过短)也归档
  assert.ok(RESURRECT_BOILER_LINE_RE.test('  if: failure()'), 'if: failure() 必须命中样板形态')
  assert.ok(RESURRECT_BOILER_LINE_RE.test('uses: actions/checkout@v4'), 'uses 指令行必须命中')
  assert.ok(!RESURRECT_BOILER_LINE_RE.test('"staleKey": "old"'), '引号键值是真内容形态,不得进样板档')
  assert.ok(!RESURRECT_BOILER_LINE_RE.test('severity: { level: warn }'), '值带花括号不进样板档')
  // ② 4f61a35f6 形态重放(纯函数面):HEAD 没有 if: failure(),祖先旧 workflow 写过,
  //    本次在 ci.yml 加一个失败分支步骤 ⇒ 样板行不得计入 count,但必须进 boilerplate 报数
  const head = [
    'jobs:',
    '  build:',
    '    steps:',
    '      - run: pnpm test',
  ].join('\n')
  const ancestorWorkflow = [
    'jobs:',
    '  build:',
    '    steps:',
    '      - name: 阻断提示',
    '        if: failure()',
    '        run: exit 1',
    '      - uses: actions/checkout@v3',
    '        with: persist-credentials: false',
  ].join('\n')
  const added = [head, '      - name: 阻断提示', '        if: failure()', '        run: exit 1', '      - uses: actions/checkout@v3'].join('\n')
  const r = resurrectAnalysis({
    baseText: head,
    newText: added,
    ancestors: [{ commit: 'fbe0e3f65', text: ancestorWorkflow }],
  })
  assert.equal(r.status, 'judged')
  assert.equal(r.count, 0, `4f61a35f6 形态重放必须 exit 0 等价(count=0),实得 ${r.count}:${JSON.stringify(r.sample)}`)
  assert.equal(r.boilerplateCount, 4, `样板行必须单独成档报数,实得 ${r.boilerplateCount}:${JSON.stringify(r.boilerplate)}`)
  // ③ 牙仍在:≥门槛长度的真内容行(祖先写过、HEAD 已删)必须照旧判红
  const realLine = '      - run: pnpm --filter @ihui/rn-app typecheck && pnpm stale-revert drill'
  const r2 = resurrectAnalysis({
    baseText: head,
    newText: `${head}\n${realLine}`,
    ancestors: [{ commit: 'deadbee1', text: `${head}\n${realLine}` }],
  })
  assert.ok(r2.count > 0, `长真内容行必须仍判红,实得 ${r2.count}`)
})

test('G-587 镜像钉:样板形态清单只此一份实现,门体必须从 lib import 而非自写', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const libSrc = readFileSync(join(ROOT, 'scripts/lib/stale-content-analysis.mjs'), 'utf8')
  const gateSrc = readFileSync(join(ROOT, 'scripts/check-stale-revert.mjs'), 'utf8')
  const landSrc = readFileSync(join(ROOT, 'scripts/object-space-land.mjs'), 'utf8')
  assert.ok(libSrc.includes('RESURRECT_BOILER_LINE_RE'), 'lib 必须导出样板形态常量')
  assert.equal(
    (libSrc.match(/RESURRECT_BOILER_LINE_RE = \//g) ?? []).length,
    1,
    '样板形态正则的定义在 lib 里必须只有一处',
  )
  for (const [name, src] of [['check-stale-revert', gateSrc], ['object-space-land', landSrc]]) {
    assert.ok(!src.includes('RESURRECT_BOILER_LINE_RE = '), `${name} 不得内联第二份样板形态实现`)
    assert.ok(!/new RegExp\('[^']*\[\^\\s"'\{\}\[\]\\\]\]/.test(src), `${name} 不得用 new RegExp 复制样板形态正则`)
  }
  assert.match(gateSrc, /from '\.\/lib\/stale-content-analysis\.mjs'/, '门体必须 import lib 的判据')
})

/**
 * ── 生成物「同源溯源/计数行」档(2026-10-14 补档)──────────────────────────────
 *
 * 立因(现读复跑):门 105 `check-miniapp-generated.mjs` 判 `ui-routes.generated.ts` 的
 * `inputsSha256` 钉落后 ⇒ 要求按官方生成器重生成;重生成写出的 `// scanned: 345 source files(…)`
 * 行 HEAD 面无(HEAD 现为 344)、祖先面记过(实测 e751a97b01/2b1863d4e2/b892b5362b/ba0123ff6b)
 * ⇒ 被 R1r 读成"复活了旧内容" ⇒ 红。即"按 105 修"必然撞 84,两条 blocking 门互锁。
 * 2026-10-03 那一版只补了 `// input:` 的 hash 旋转一格,其余同源行是盲区;本档把它们补齐,
 * 而补齐的**安全前提**就是下面这几条成对对照 —— 缺任一条,这一档就是"把牙磨掉"而不是"补档"。
 */
const GEN_MARK = '// GENERATED FILE — DO NOT EDIT. 由 gen-fixture.mjs 生成(pnpm gen:fixture)'
const PIN_OPEN = '// IHUI-GEN-PIN-BEGIN'
const PIN_CLOSE = '// IHUI-GEN-PIN-END'
const H64 = (c) => String(c).repeat(64)
const pinBlock = ({ sha, commit, scanned, at, inputHash }) =>
  [
    GEN_MARK,
    PIN_OPEN,
    `// generator: gen-fixture.mjs`,
    `// sourceCommit: ${commit}`,
    `// inputsSha256: ${sha}`,
    `// input: src/pages/a.tsx ${inputHash}`,
    `// scanned: ${scanned} source files(参数探测依据)`,
    `// skipped: pagesWithoutOwnConfig=1(标题回落)`,
    `// generatedAt: ${at}`,
    PIN_CLOSE,
  ].join('\n')
const PIN_OLD = { sha: H64('1'), commit: H64('a'), scanned: 3, at: '2026-10-01T00:00:00.000Z', inputHash: H64('1') }
const PIN_NEW = { sha: H64('2'), commit: H64('b'), scanned: 2, at: '2026-10-02T00:00:00.000Z', inputHash: H64('2') }
const CONTENT_OLD = "export const ROUTE_MAP = { a: '/pkg/a/index', b: '/pkg/b/index' }\n"
const CONTENT_HEAD = "export const ROUTE_MAP = { a: '/pkg/a/index' }\nexport const ROUTE_FLAGS = { newPageProbe: true }\n"
const V1 = `${pinBlock(PIN_OLD)}\n${CONTENT_OLD}`
const V2 = `${pinBlock(PIN_NEW)}\n${CONTENT_HEAD}`
// 重生成的落地面:自述行全部退回旧值,内容行保持 HEAD 形态并追加一行真新内容(混合体)
const REGEN = `${pinBlock(PIN_OLD)}\n${CONTENT_HEAD}export const ROUTE_NOTE = '重生成后又改了源'\n`
// 真回滚的落地面:自述行保持 HEAD 形态,内容行把 HEAD 已删的 `/pkg/b/index` 写回来
const REVERT = `${pinBlock(PIN_NEW)}\n${CONTENT_OLD}${CONTENT_HEAD}`
/** 摘掉自证标记(横幅 + 钉起止行)⇒ 同一批行落到"文件不自证为生成物"那一格 */
const unmark = (t) =>
  t
    .split('\n')
    .filter((l) => l !== GEN_MARK && l !== PIN_OPEN && l !== PIN_CLOSE)
    .join('\n')
const ANCS = [
  { commit: 'a1b2c3d01', text: V1 },
  { commit: 'a1b2c3d02', text: V2 },
]
const ANCS_STRICT = [
  { commit: 'a1b2c3d01', text: unmark(V1) },
  { commit: 'a1b2c3d02', text: unmark(V2) },
]

test('生成物溯源行档 · 反向锁:重生成只改自述行 ⇒ 不判复活(门 84↔105 互锁已解)', () => {
  assert.equal(isGeneratedSelfDescribing(V2), true, '夹具必须自证为生成物,否则这条只是恒绿的空断言')
  const r = resurrectAnalysis({ baseText: V2, newText: REGEN, ancestors: ANCS })
  assert.equal(r.status, 'judged', `应当可判,实得 ${r.status}/${r.reason}`)
  assert.equal(r.generatedProvenance, true, '必须走到生成物档')
  assert.equal(r.count, 0, `只有溯源/计数行变化不得算复活,实得 ${r.count}:${JSON.stringify(r.sample)}`)
  assert.ok(r.provenanceValueDrift > 0, `放宽量必须可见(旧尺下这些行是复活候选),实得 ${r.provenanceValueDrift}`)
})

test('生成物溯源行档 · 阳性对照一:生成物内真回滚内容行 ⇒ 照旧判红(牙没被磨掉)', () => {
  const r = resurrectAnalysis({ baseText: V2, newText: REVERT, ancestors: ANCS })
  assert.equal(r.status, 'judged')
  assert.equal(r.generatedProvenance, true, '同一枚生成物,档确实生效着')
  assert.ok(r.count > 0, `HEAD 已删的路由条目被写回必须点名,实得 ${r.count}`)
  assert.ok(
    r.sample.some((l) => l.includes('/pkg/b/index')),
    `样本必须点名被搬回的内容行,实得 ${JSON.stringify(r.sample)}`,
  )
})

test('生成物溯源行档 · 阳性对照二:同一批溯源行写在未自证的文件里 ⇒ 条件②缺一不放宽', () => {
  assert.equal(isGeneratedSelfDescribing(unmark(V2)), false, '摘掉标记后必须不再自证为生成物')
  const strict = resurrectAnalysis({ baseText: unmark(V2), newText: unmark(REGEN), ancestors: ANCS_STRICT })
  assert.equal(strict.status, 'judged')
  assert.equal(strict.generatedProvenance, false, '非生成物不得走放宽档')
  assert.ok(strict.count > 0, `条件②缺失时连自述行也照旧判复活,实得 ${strict.count}`)
  // 同一套内容、只差条件②:两臂读数必须不同,否则"自证"这一维是装饰
  const relaxed = resurrectAnalysis({ baseText: V2, newText: REGEN, ancestors: ANCS })
  assert.ok(
    relaxed.count === 0 && strict.count > relaxed.count,
    `放宽档必须真的只吸收自述行(严格臂 ${strict.count} vs 自证臂 ${relaxed.count})`,
  )
})

test('生成物溯源行档 · 白名单是清单不是"整行注释一律放过"', () => {
  assert.ok(RESURRECT_PROVENANCE_KEYS.length >= 5, '白名单必须逐条点名(现读自钉格式与生成器 extraLines)')
  for (const key of RESURRECT_PROVENANCE_KEYS) {
    // `input:` 那一格的值位是"路径 + hash":路径是真信息(不得归一),被归一的只有 hash;
    // 其余同源行的整个值都是自述内容,变化不得算复活。
    const [a, b] =
      key === 'input'
        ? [`// ${key}: src/pages/a.tsx ${H64('1')}`, `// ${key}: src/pages/a.tsx ${H64('2')}`]
        : [`// ${key}: ZZZZZZZZ-value-one`, `// ${key}: YYYYYYYYY-value-two`]
    assert.ok(isResurrectProvenanceLine(a), `${key} 必须在自述行形态里`)
    assert.ok(isResurrectProvenanceLine(b), `${key} 的另一种取值也必须在自述行形态里`)
    assert.equal(
      generatedProvenanceResurrectKey(a),
      generatedProvenanceResurrectKey(b),
      `${key}: 的值变化不得算复活(这正是门 105 要求重生成时必然发生的事)`,
    )
    // 归一后键名仍在(信息不丢),否则"任何行都归一成空串"也能骗过上一条
    assert.ok(generatedProvenanceResurrectKey(a).includes(`${key}`), `${key} 归一后必须留下键名`)
  }
  // 不在白名单里的键必须照旧判:`<hashA>` vs `<hashB>` 两个键
  const foreign = 'outputHashes'
  assert.ok(!RESURRECT_PROVENANCE_KEYS.includes(foreign), '反面对照键不得被登记进白名单')
  assert.notEqual(
    generatedProvenanceResurrectKey(`// ${foreign}: AAAA`),
    generatedProvenanceResurrectKey(`// ${foreign}: BBBB`),
    '白名单外的注释行必须保持原样参与判据(不许"整行注释一律放过")',
  )
  // 非注释行、导出对象、JSX 一律原样
  for (const content of [CONTENT_OLD.trim(), `export const X = { y: 'z' }`, `  <Text style={[styles.hit]}>`]) {
    assert.equal(generatedProvenanceResurrectKey(content), resurrectKey(content), `内容行不得被归一:${content}`)
  }
  // input: 那一格额外锁:键值折掉,但**输入路径必须保留**(不同输入不得归一)
  assert.notEqual(
    generatedProvenanceResurrectKey(`// input: a/en.json ${H64('1')}`),
    generatedProvenanceResurrectKey(`// input: b/ja.json ${H64('1')}`),
    '不同输入路径不得归一',
  )
  assert.ok(
    generatedProvenanceResurrectKey(`// input: a/en.json ${H64('2')}`).includes('a/en.json'),
    '归一须保留输入路径',
  )
})

test('生成物溯源行档 · 钉格式漂移锁:renderPin 写出的每一行都必须被这一档覆盖', () => {
  // 用**生成物自述钉的唯一实现**渲染两块钉(值全不同 + 各带 extraLines 计数行),
  // 逐行要求"同位置的两行归一后同键";若将来往钉里加新字段而不进白名单,这里就红。
  const inputs = [{ rel: 'src/pages/a.tsx', text: 'a' }]
  const render = (v, scanned) =>
    PIN_LIB.renderPin({
      generator: 'gen-fixture.mjs',
      sourceCommit: H64(v),
      inputs,
      generatedAt: `2026-10-0${v}T00:00:00.000Z`,
      extraLines: [`scanned: ${scanned} source files(参数探测依据)`, `skipped: pagesWithoutOwnConfig=${v}`],
    })
  const A = render('1', 300)
  const B = render('2', 299)
  assert.equal(A.length, B.length, '两次渲染行数必须同形,否则夹具不成立')
  for (let i = 0; i < A.length; i++) {
    if (A[i] === B[i]) continue // 结构行(BEGIN/END/generator)本就逐字相同
    assert.ok(isResurrectProvenanceLine(A[i]), `钉里的自述行未被白名单覆盖:${A[i]}`)
    assert.equal(
      generatedProvenanceResurrectKey(A[i]),
      generatedProvenanceResurrectKey(B[i]),
      `同源行的值差异必须归一,否则门 105 要求的重生成会撞门 84:${A[i]} vs ${B[i]}`,
    )
  }
  // 不同输入路径的两枚钉不得被归一(生成器换输入清单是真变化)
  const other = PIN_LIB.renderPin({ generator: 'g', sourceCommit: H64('1'), inputs: [{ rel: 'src/pages/b.tsx', text: 'b' }], generatedAt: 'x' })
  const inputLineOf = (lines) => {
    const hit = lines.find((l) => l.startsWith('// input: '))
    assert.ok(hit, `钉块里必须有 input: 行,实得 ${JSON.stringify(lines.slice(0, 6))}`)
    return hit
  }
  assert.notEqual(
    generatedProvenanceResurrectKey(inputLineOf(A)),
    generatedProvenanceResurrectKey(inputLineOf(other)),
    '输入路径不同必须可辨',
  )
})

test('生成物溯源行档 · 自证标记现读对账:真产物必须自证,提到标记的手写脚本不得自证', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const gitAt = (args) => execFileSync(GIT, ['-c', 'safe.directory=*', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, timeout: 300000 })
  const named = gitAt(['ls-files']).split(/\r?\n/).filter((p) => /(\.generated\.|\.gen\.)/.test(p))
  assert.ok(named.length >= 5, `HEAD 面应有生成物命名族,实得 ${named.length}`)
  for (const p of named) {
    assert.ok(isGeneratedSelfDescribing(gitAt(['show', `HEAD:${p}`])), `${p} 是生成物却没有自证标记 ⇒ 标记清单与现实脱节`)
  }
  // 反面对照:这些手写脚本/生成器**散文里也写着这些标记词**,但标记不在注释行行首 ⇒ 不得自证。
  // (放宽到"整篇包含"就把它们洗成生成物了 —— 那才是这条档真正的失守形态。)
  for (const p of [
    'scripts/lib/generated-input-pin.mjs',
    'scripts/check-miniapp-generated.mjs',
    'scripts/check-declared-shortcuts.mjs',
    'scripts/union-converge.mjs',
    'apps/miniapp-taro/scripts/generate-ui-routes.mjs',
    'scripts/lib/stale-content-analysis.mjs',
    'scripts/check-stale-revert.mjs',
  ]) {
    assert.ok(!isGeneratedSelfDescribing(gitAt(['show', `HEAD:${p}`])), `${p} 只是提到了标记,不得自证为生成物`)
  }
})

test('生成物溯源行档 · 形状锁:白名单/标记集只此一份实现', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const libSrc = readFileSync(join(ROOT, 'scripts/lib/stale-content-analysis.mjs'), 'utf8')
  assert.equal((libSrc.match(/RESURRECT_PROVENANCE_KEYS = /g) ?? []).length, 1, '白名单定义在 lib 里必须只有一处')
  assert.equal((libSrc.match(/GENERATED_SELF_EVIDENCE_RES = /g) ?? []).length, 1, '自证标记集定义在 lib 里必须只有一处')
  assert.equal((libSrc.match(/RESURRECT_PROVENANCE_LINE_RE = /g) ?? []).length, 1, '溯源行形态定义在 lib 里必须只有一处')
  for (const rel of ['scripts/check-stale-revert.mjs', 'scripts/object-space-land.mjs', 'scripts/safe-commit.mjs']) {
    const src = readFileSync(join(ROOT, rel), 'utf8')
    for (const name of ['RESURRECT_PROVENANCE_KEYS =', 'GENERATED_SELF_EVIDENCE_RES =', 'generatedProvenanceResurrectKey(']) {
      if (name.endsWith('(')) assert.ok(!new RegExp(`function\\s+${name.slice(0, -1)}`).test(src), `${rel} 不得内联第二份 ${name}`)
      else assert.ok(!src.includes(name), `${rel} 不得内联第二份 ${name}`)
    }
  }
  // 本测试文件也不得有第二份清单:出现的键名必须全部来自 import 的那一份
  const self = readFileSync(join(ROOT, 'scripts/tests/check-stale-revert.test.mjs'), 'utf8')
  const literalList = /^\s*(?:const|let)\s+\w*(?:KEYS|keys)\w*\s*=\s*\[/m
  assert.ok(!literalList.test(self.replace(/RESURRECT_PROVENANCE_KEYS/g, '')), '测试里不得另立一份键名清单(§22c)')
  // lib 必须是纯判据层:不许在这里读 git / 读盘
  assert.ok(!/execFileSync|readFileSync|from 'node:fs'|from 'node:child_process'/.test(libSrc), 'lib 层不得取材(取材面住在 face-reader)')
  // 形态必须要求 `//` 注释引导:裸 `键: 值`(YAML/代码)与真代码行都不算自述行
  assert.ok(isResurrectProvenanceLine('// scanned: 3 source files'), '// 注释引导必须命中形态')
  assert.ok(!isResurrectProvenanceLine('scanned: 3 source files'), '非 // 注释引导的行不得算自述行')
  assert.ok(!isResurrectProvenanceLine('export const scanned = 3'), '真代码行不得算自述行')
  assert.ok(RESURRECT_PROVENANCE_LINE_RE.test(`// inputsSha256: ${H64('1')}`), '形态正则必须认钉里的聚合哈希行')
  assert.ok(!RESURRECT_PROVENANCE_LINE_RE.test('const inputsSha256 = 1'), '形态正则不得认代码行')
  assert.ok(GENERATED_SELF_EVIDENCE_RES.length >= 2, '自证标记至少覆盖横幅与钉起始行两族')
})
