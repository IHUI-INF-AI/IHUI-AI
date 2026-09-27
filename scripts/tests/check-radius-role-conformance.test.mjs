// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:`scripts/check-radius-role-conformance.mjs`(圆角角色档一致性对账)。
//
// 与 `--self-test` 的分工:自检判**判据逻辑**(纯函数 + 构造面),本文件判**门的形与接线纪律**
// (取材面、遮罩只有一份、表不抄数字、台账单调性、退出码方向、以及"本票刻意没接提交链")。
//
// 一条来自 §22c 的硬要求:凡判据的对象是某个真实文件的"形态",至少一条用例的输入必须
// 逐字取自那个真实文件(这里 = 真仓 HEAD 的 DrawerComponent.tsx),不得全用自造夹具。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { radiusLookup } from '../lib/radius-tokens.mjs'
import { ROLE_STEMS } from '../lib/radius-roles.mjs'

const SRC = join(import.meta.dirname, '..', 'check-radius-role-conformance.mjs')
const LIB = join(import.meta.dirname, '..', 'lib', 'radius-roles.mjs')
const MASK_LIB = join(import.meta.dirname, '..', 'lib', 'code-mask.mjs')
const RUNNER = join(import.meta.dirname, '..', 'guardian-runner.mjs')
const REPO = join(import.meta.dirname, '..', '..')
const { __test__: T, main, emitBaseline, runAudit } = await import(pathToFileURL(SRC).href)

const git = (args, cwd) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args],
    { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000 },
  )
const headBlob = (rel) =>
  execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 60000,
  })
const TABLE = () => radiusLookup(headBlob('packages/design-tokens/src/radius.js'))
const capture = async (argv, root) => {
  const log = []
  const orig = console.log
  console.log = (...a) => log.push(a.join(' '))
  try {
    const code = await main(argv, root)
    return { code, out: log.join('\n') }
  } finally {
    console.log = orig
  }
}

test('T1 本票刻意不接提交链:runner 三面都不得出现本门(自我注册会互相覆盖注册块)', () => {
  const faces = [['工作树', readFileSync(RUNNER, 'utf8')], ['HEAD', headBlob('scripts/guardian-runner.mjs')]]
  try {
    faces.push(['索引', git(['show', ':scripts/guardian-runner.mjs'], REPO)])
  } catch {
    /* 索引里还没有这个路径(别人正 rm 它),那就不构成"已注册" */
  }
  for (const [face, src] of faces)
    assert.ok(
      !src.includes('check-radius-role-conformance.mjs'),
      `${face} 面的 runner 已含本门注册块 —— 任务书禁止实现票自我注册,须由主会话单写`,
    )
})

test('T2 门头注不得声称"已接入提交链",但必须把接线条目写全', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /刻意不自行接进提交链/, '头注必须明说未接线')
  assert.doesNotMatch(src, /已接入 pre-commit|已注册进 guardian-runner|已挂进提交链/, '不得谎称已接')
  for (const needle of ["mode: 'blocking'", 'HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE', 'stagedTriggers'])
    assert.ok(src.includes(needle), `头注缺接线条目要素:${needle} —— 主会话接线时只能猜`)
})

test('T3 取材面形状锁:内容必须走 face-reader 的 catBatch,枚举必须走 git 清单', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '没引取材层')
  assert.match(src, /catBatch\(repoRoot,/, '引了层却不用它读内容 = 半接线(门 118 提交档判红那一型)')
  assert.ok(!/process\.cwd\(\)/.test(src), '不得用 cwd 定根(守门 70 的镜像测试 13/14 恒红那一型)')
  assert.ok(!/readFileSync\(\s*join\(\s*(ROOT|repoRoot)/.test(src), '不得用仓库根拼磁盘路径读被审内容')
  assert.ok(!/gitRaw\(\[['\s,]*'show'/.test(src), '不得散写 git show 取内容')
  assert.ok(!/readdirSync\(|statSync\(/.test(src), '枚举不得按磁盘扫(归档锚点那一型:面里没有的路径不构成结论)')
  assert.match(src, /ls-tree', '-r', '--name-only', 'HEAD'/, '全量档枚举面必须是 HEAD 树')
  assert.match(src, /face === 'staged' \? \['ls-files'\]/, '索引面枚举只能走 ls-files(ls-tree 不认 --cached)')
  // 清单与内容同面同轮:表 + 台账 + 正文必须进同一次 catBatch
  assert.match(src, /\[\.\.\.files, RADIUS_TABLE_REL, BASELINE_REL\]/, '档位表/台账必须与正文同一次批量读')
})

test('T4 遮罩实现只能有一份,且判据面与锚点面两面齐备', () => {
  const src = readFileSync(SRC, 'utf8')
  const lib = readFileSync(LIB, 'utf8')
  assert.match(readFileSync(MASK_LIB, 'utf8'), /export function maskCommentsAndStrings\b/)
  for (const [name, text] of [
    ['门体', src],
    ['判据 lib', lib],
  ]) {
    assert.match(text, /code-mask\.mjs/, `${name} 没引共用遮罩`)
    assert.ok(!/function maskCommentsAndStrings\s*\(/.test(text), `${name} 里抄了第二份遮罩实现`)
  }
  assert.match(lib, /maskCommentsAndStrings\(/, 'lib 不得脱离共享遮罩')
  assert.match(lib, /return \{ code, kept/)
  assert.match(src, /codeLines\[i\]/, '类别锚点取自 code 面 —— 否则注释里的假 className 会造出候选')
})

test('T5 档位表/角色表不得被抄进门里(表一改,抄数的门就对空气打分)', () => {
  const src = readFileSync(SRC, 'utf8') + '\n' + readFileSync(LIB, 'utf8')
  for (const lit of ['xs: 2', 'sm: 4', 'md: 6', 'lg: 8', 'xl: 12', '2xl: 16'])
    assert.ok(!src.includes(lit), `出现档位字面量 ${lit} —— 只能经 radiusLookup 从被审面取`)
  assert.match(src, /radiusLookup\(/, '档位表必须经共享解析器取')
  assert.match(src, /RADIUS_TABLE_REL/, '表路径要按被审面取(与正文同面同轮)')
})

test('T6 真仓 HEAD 阳性对照:同一方向形态,写在代码里必命中、只写进注释必不命中', () => {
  const rel = 'apps/miniapp-taro/src/components/DrawerComponent.tsx'
  const src = headBlob(rel)
  assert.ok(src.includes('rounded-t-xl'), `夹具前提变了:${rel} 已不含 rounded-t-xl —— 要重写本例,不是删掉`)
  const table = TABLE()
  const r = T.auditFileText(rel, src, table)
  const hit = [...r.violations, ...r.weakFindings].find((v) => v.form.includes('rounded-t-xl'))
  assert.ok(hit, '真仓 HEAD 的方向形态没被点名 ⇒ 判据对该形态失明(任务书第 7 条禁止复制的盲区)')
  assert.equal(hit.role, 'card')
  assert.equal(hit.actualStep, 'xl')
  assert.equal(hit.expectedStep, 'lg')
  const asComment = src
    .split('\n')
    .map((l) => (l.includes('rounded-t-xl') ? `// ${l.trim()}` : l))
    .join('\n')
  const again = T.auditFileText(rel, asComment, table)
  assert.equal(
    [...again.violations, ...again.weakFindings].filter((v) => v.form.includes('rounded-t-xl')).length,
    0,
    '注释里的同一形态被算成取用 ⇒ 遮罩关掉的是判据,不是误报',
  )
})

test('T7 证据强弱不得混判:颜色类名只点名不判红,作者给的名字必须判红', () => {
  const table = TABLE()
  const weak = T.auditFileText('a.tsx', '<View className="bg-card rounded-t-xl" />', table)
  assert.equal(weak.violations.length, 0, '只有颜色实用类时不得判红(它是色档,不是容器身份)')
  assert.equal(weak.weakFindings.length, 1)
  assert.equal(weak.weakFindings[0].evidence, 'weak')
  // 组件标签(control)与颜色类名(card)共现 —— 强证据必须赢,否则"按颜色名去改按钮圆角"的假阳就回来了
  const strong = T.auditFileText('a.tsx', 'const s = <Button className="bg-card rounded-xl" />', table)
  assert.equal(strong.violations.length, 1, '作者给了真名字(组件标签)却不判红 = 门瞎了')
  assert.equal(strong.violations[0].role, 'control', '强弱共存时按强证据判,不得按颜色类名判成 card')
  assert.equal(strong.weakFindings.length, 0, '强证据在场时不得把同一处再记一份弱证据')
})

test('T8 棘轮四个方向各有用例(锚点粒度到「文件×角色」,防换写法净零逃逸)', () => {
  const one = { 'a.tsx|card': 2 }
  assert.deepEqual(T.applyRatchet(one, one), [], '相等 ⇒ 绿')
  assert.equal(T.applyRatchet({ 'a.tsx|card': 3 }, one).length, 1, '上升 ⇒ 红')
  assert.deepEqual(T.applyRatchet({ 'a.tsx|card': 1 }, one), [], '下降 ⇒ 绿')
  assert.equal(T.applyRatchet(one, {}).length, 1, '无锚 ⇒ 红(新增即拦,不留清单外空档)')
  assert.equal(T.applyRatchet({ 'a.tsx|control': 1 }, one).length, 1, '把 card 的账写成 control 的账必须被拦住')
})

test('T9 台账单调性:上升/消失/新键带账必拒、首笔入锚除外、坏 JSON 算无法判定', () => {
  assert.equal(T.anchorRegression({ 'a|card': 1 }, { 'a|card': 2 }).length, 1)
  assert.equal(T.anchorRegression({ 'a|card': 1 }, {}).length, 1)
  assert.deepEqual(T.anchorRegression({ 'a|card': 1 }, { 'a|card': 1 }), [])
  assert.deepEqual(T.anchorRegression({}, { 'a|card': 9 }), [], '第一次入锚不受"只降"限制')
  assert.equal(
    T.anchorRegression({ 'a|card': 1 }, { 'a|card': 1, 'b|chip': 2 }).length,
    1,
    '新键带违规必须被拒 —— 否则 --emit-baseline 就是每台判红机的自我豁免按钮',
  )
  assert.throws(() => T.parseBaseline('{"nope":1}', 'x'), (e) => e.constructor.name === 'Undetermined')
  assert.throws(() => T.parseBaseline('not json at all', 'x'), (e) => e.constructor.name === 'Undetermined')
})

test('T10 两面旗同给 ⇒ 无法判定;缺省档必须是 HEAD 而不是磁盘', () => {
  assert.throws(() => T.faceFromArgv(['--staged', '--worktree']), (e) => e.constructor.name === 'Undetermined')
  assert.equal(T.faceFromArgv([]), 'head')
  assert.equal(T.faceFromArgv(['--staged']), 'staged')
})

test('T11 临时仓端到端:无台账不得冒绿 ⇒ 入锚后存量不判红 ⇒ 新增一族即红 ⇒ 清完可下调', async () => {
  const dir = mkScratch('radius-role-gate')
  try {
    const put = (rel, text) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
    git(['init', '-q', '-b', 'main'], dir)
    put('packages/design-tokens/src/radius.js', headBlob('packages/design-tokens/src/radius.js'))
    put('apps/web/src/a.tsx', 'const s = { card: { borderRadius: rnRadius.xl } }\nexport { s }\n')
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'seed'], dir)

    const first = await capture([], dir)
    assert.equal(first.code, 1, '台账缺席 ⇒ 按零锚点判红:不得把"还没有台账"读成通过')
    const res = runAudit(dir, 'head')
    const ledger = emitBaseline(res.violations, res.baseline)
    assert.equal(ledger.anchors['apps/web/src/a.tsx|card'], 1, '入锚必须把本次读数写进去')
    put(T.BASELINE_REL, JSON.stringify(ledger))
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'ledger'], dir)
    assert.equal((await capture([], dir)).code, 0, '入锚后同一存量不得再判红(否则立门即恒红)')

    put(
      'apps/web/src/a.tsx',
      'const s = {\n  card: { borderRadius: rnRadius.xl },\n  chip: { borderRadius: rnRadius.lg },\n}\n',
    )
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'regress'], dir)
    assert.equal((await capture([], dir)).code, 1, '同文件新增一族(chip)必须被拦住')
    assert.match((await capture([], dir)).out, /a\.tsx\|chip/, '红必须点名是哪一族')
    assert.equal(
      (await capture(['--emit-baseline'], dir)).code,
      1,
      '把刚判红的族重跑进台账 = 每台判红机自带豁免按钮,必须拒',
    )

    put(
      'apps/web/src/a.tsx',
      'const s = {\n  card: { borderRadius: rnRadius.lg },\n  chip: { borderRadius: rnRadius.md },\n}\n',
    )
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'clean'], dir)
    const cleared = await capture(['--emit-baseline'], dir)
    assert.equal(cleared.code, 0, '清偿后重锚必须允许(锚点只下降)')
    assert.deepEqual(
      JSON.parse(cleared.out).anchors,
      { 'apps/web/src/a.tsx|card': 0 },
      '已入锚的族清完要降到 0 而不是消失 —— 删键与"台账被并发旧基线整文件回写"在账面上无法区分',
    )

    // chip 从未进台账(一出现就被拦住,且不允许被重锚)⇒ 缺键必须按零锚点算,不得读成"清单外免判"
    put(
      'apps/web/src/a.tsx',
      'const s = {\n  card: { borderRadius: rnRadius.lg },\n  chip: { borderRadius: rnRadius.xl },\n}\n',
    )
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'chip-again'], dir)
    const again = await capture([], dir)
    assert.equal(again.code, 1, '台账里没有的族 ⇒ 新增即拦')
    assert.match(again.out, /a\.tsx\|chip/, '缺键不等于免判,再犯仍要点名')
  } finally {
    rmScratch(dir)
  }
})

test('T12 --json 的 stdout 只准出现 JSON(尾随说明行会砸碎机器读法)', async () => {
  const dir = mkScratch('radius-role-json')
  try {
    const put = (rel, text) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
    git(['init', '-q', '-b', 'main'], dir)
    put('packages/design-tokens/src/radius.js', headBlob('packages/design-tokens/src/radius.js'))
    put(
      'apps/web/src/b.tsx',
      'const s = {\n  card: { borderRadius: rnRadius.xl },\n}\nconst v = <View className="bg-card rounded-t-xl" />\n',
    )
    put(T.BASELINE_REL, JSON.stringify({ anchors: {} }))
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'seed'], dir)
    const { code, out } = await capture(['--json'], dir)
    const j = JSON.parse(out)
    assert.equal(code, 1, '强证据(card 样式键)的那一族必须判红')
    assert.equal(j.violations.length, 1, '只该有一处强证据违规 —— 多出来就是弱证据混进了判红面')
    assert.equal(j.weakFindings.length, 1, '颜色类名那一处应落在弱证据栏,不得混进判红')
    assert.ok(Array.isArray(j.violations) && Array.isArray(j.undetermined))
    assert.ok(Array.isArray(j.weakFindings), '弱证据那一格必须能被机器读到')
    assert.equal(typeof j.compliant, 'number')
    assert.equal(typeof j.unclassifiedCount, 'number', '"不在射程"必须是独立的数,不得并进通过或未判定')
  } finally {
    rmScratch(dir)
  }
})

test('T13 档位表解析不出来 ⇒ 无法判定,不得当成"零违规"(空扫不是通过)', async () => {
  const dir = mkScratch('radius-role-blind')
  try {
    const put = (rel, text) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
    git(['init', '-q', '-b', 'main'], dir)
    put('packages/design-tokens/src/radius.js', 'export const NOTHING = {}\n')
    put('apps/web/src/c.tsx', 'const s = {\n  card: { borderRadius: rnRadius.xl },\n}\n')
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'seed'], dir)
    const { code, out } = await capture([], dir)
    assert.equal(code, 2, '表读不出来必须是"无法判定"(exit 2),既不能冒红也不能记绿')
    assert.match(out, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

test('T14 共享解析读不到的角色不得被当成"已合规"——本门必须把这一格喊出来', () => {
  const table = TABLE()
  const problems = T.roleTableProblems(table)
  const missing = Object.keys(ROLE_STEMS).filter((r) => table[`role:${r}`] === undefined)
  for (const r of missing)
    assert.ok(problems.includes(r), `角色 ${r} 有识别词元、表里却无档位,而本门没点名 ⇒ 对该族失明`)
  // 反向对照:表齐时不得凭空报问题(否则是一台恒红门的"腐烂告警")
  const full = { ...table, 'role:hero': 16 }
  assert.deepEqual(T.roleTableProblems(full), [], '表里该有的角色都有时还报警 ⇒ 告警本身成了噪声')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
