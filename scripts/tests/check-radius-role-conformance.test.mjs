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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { radiusLookup } from '../lib/radius-tokens.mjs'
import { ROLE_STEMS, radiusFormsInLine, rolesOfName } from '../lib/radius-roles.mjs'

const SRC = join(import.meta.dirname, '..', 'check-radius-role-conformance.mjs')
const LIB = join(import.meta.dirname, '..', 'lib', 'radius-roles.mjs')
const MASK_LIB = join(import.meta.dirname, '..', 'lib', 'code-mask.mjs')
const RUNNER = join(import.meta.dirname, '..', 'guardian-runner.mjs')
const REPO = join(import.meta.dirname, '..', '..')
/** 形状锁一律比归一化空白后的文本:prettier 折行不得造出与正确性无关的假红。 */
const norm = (t) => String(t).replace(/s+/g, ' ')

const { __test__: T, main, emitBaseline, runAudit } = await import(pathToFileURL(SRC).href)

const git = (args, cwd) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args],
    { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000 },
  )
/** 真仓阳性对照按**出处**取 —— 账还完那天 HEAD 上就不再有这条违规,钉 HEAD 的对照会在清偿当天集体失效(票㉗ T18 同一条)。 */
const PROBE_REF = process.env.IHUI_RADIUS_PROBE_REF || 'acf1927e96'
const probeBlob = (rel) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', 'show', PROBE_REF + ':' + rel],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 60000 },
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

/**
 * T1 装车证明(2026-09-27 由"反向锁"改写而来)。
 * 原文断言的是**建票当时的状态**("本门刻意未接提交链"),它在我把门接进 `checks` 的那天
 * 就变成了"禁止合规" —— 与本仓记过的「waivers 必须等于 {}」那条同型。
 * 现在锁真正在乎的东西:门必须在**被 pre-commit 迭代的那个数组**里、blocking、带 skipEnv;
 * 只"在文件里出现过"不算(实测它曾被并进 pushGateChecks,全量批 180 道门里没有它)。
 */
test('T1 装车证明:本门必须在 checks 数组内(不是 pushGateChecks),且 blocking + skipEnv 齐备', () => {
  const src = headBlob('scripts/guardian-runner.mjs')
  const arrText = (name) => {
    const at = src.indexOf('const ' + name + ' = [')
    assert.ok(at >= 0, 'runner 里找不到数组 ' + name)
    let depth = 0
    let i = src.indexOf('[', at)
    const from = i
    for (; i < src.length; i++) {
      if (src[i] === '[') depth++
      else if (src[i] === ']') {
        depth--
        if (depth === 0) break
      }
    }
    return src.slice(from + 1, i)
  }
  const inChecks = arrText('checks').includes('check-radius-role-conformance.mjs')
  const inPushOnly = arrText('pushGateChecks').includes('check-radius-role-conformance.mjs')
  assert.ok(inChecks, '本门不在 checks 区间内 ⇒ pre-commit 与全量审计永不调度它(grep 却查得到)')
  assert.ok(!inPushOnly, '本门不该同时挂在 pushGateChecks 上 ⇒ 两处注册会互相顶失败归属')
  const block = src.slice(src.indexOf('check-radius-role-conformance.mjs') - 400, src.indexOf('check-radius-role-conformance.mjs') + 400)
  assert.match(block, /mode: 'blocking'/, '定级不是 blocking')
  assert.match(block, /skipEnv: 'HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE'/, '缺应急跳过出口')
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

test('T6 真仓出处阳性对照:同一方向形态,写在代码里必命中、只写进注释必不命中', () => {
  const rel = 'apps/miniapp-taro/src/components/DrawerComponent.tsx'
  const src = probeBlob(rel)
  assert.ok(src.includes('rounded-t-xl'), `夹具前提变了:${rel} 已不含 rounded-t-xl —— 要重写本例,不是删掉`)
  const table = TABLE()
  const r = T.auditFileText(rel, src, table)
  const hit = [...r.violations, ...r.weakFindings].find((v) => v.form.includes('rounded-t-xl'))
  assert.ok(hit, '出处面的方向形态没被点名 ⇒ 判据对该形态失明(任务书第 7 条禁止复制的盲区)')
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

/**
 * T15/T16 角色表**值支**与"名字能否认领尺寸档"两条锁(2026-09-27 由一次自测翻红逼出来)。
 *
 * 立因:`objectEntries` 的解析注释早就写着"漏掉数字开头的档名 = 把 16px 这一整档从尺子上抹掉",
 * 但它只在**键**支补了 `\d[\w$]*`,**值**支仍旧只认"字母开头标识符"或"纯数字" ——
 * 于是 `hero: '2xl'` 整行不匹配、表里没有 role:hero,门 150 把三个 hero 站点报成
 * role-not-in-table(读起来像代码写错,其实是解析器丢项),而 hero 档永不可判。
 * 更值得记的是:门自己的第 17 条自检**把这个缺陷当规格断言**(`rnRadiusFor.hero → null`),
 * 修好解析器它才翻红 —— 一条把当前行为当规格的断言,会在缺陷被修的那天变成阻力。
 * 两条都按归一化空白后的文本判,不按字节形状(prettier 一折行就造出与正确性无关的假红)。
 */
test('T15 值支必须认数字开头档名(形状锁:窄写法不得回来)', () => {
  const src = norm(headBlob('scripts/lib/radius-tokens.mjs'))
  const digitLeadBranch = '\\d[\\w$]*'
  const n = src.split(digitLeadBranch).length - 1
  assert.ok(
    n >= 2,
    'objectEntries 里"数字开头档名"的分支只剩键支 ⇒ role:hero 静默消失,而账面只是少几个判定',
  )
  const narrowValueBranch = "([A-Za-z_$][\\w$]*|\\d+(?:\\.\\d+)?)"
  assert.ok(
    !src.includes(narrowValueBranch),
    '值支退回"字母开头标识符 + 纯数字"两态的旧写法不得回来(它匹配不到 2xl,等于 16px 这一档不可判)',
  )
})

test('T16 hero 这类纯尺寸档不得由名字认领,而 card 仍须由名字判(成对)', () => {
  assert.equal(ROLE_STEMS.hero?.nameCannotClaim, true, '标记被删 ⇒ 名字又开始替元素认领 16px,一条提示条会被顶成主视觉档')
  assert.ok(!rolesOfName('compactionBanner').includes('hero'), '提示条叫 banner 不是"特大主卡片"')
  assert.ok(!rolesOfName('heroSection').includes('hero'))
  assert.ok(rolesOfName('userCard').includes('card'), '把整条名字判据一起关掉不叫收窄,那叫失明')
})

test('T17 C4 的容器维必须真装在判据链上(摘线不得被读成已合规)', () => {
  const src = readFileSync(SRC, 'utf8')
  const scopeLib = join(import.meta.dirname, '..', 'lib', 'jsx-scope.mjs')
  assert.ok(
    /from\s*'[\./\w-]*jsx-scope\.mjs'/.test(src) && /scanJsx\(/.test(src),
    '门体不得再自带一份 JSX 解析,也不得 import 了却不调用(§22c:两处实现必漂移)',
  )
  assert.ok(
    /classifySurfaces\(/.test(src) && /from\s*'[\./\w-]*radius-roles\.mjs'/.test(src),
    '容器分类被摘线后,自称 card 的模态面会一路报绿 —— 那正是票⑳ 立项要防的那一格',
  )
  assert.ok(existsSync(scopeLib), 'jsx-scope 是唯一容器作用域出口,文件不在位 ⇒ 门结构上无法判')
  const rl = readFileSync(LIB, 'utf8')
  assert.ok(
    /export function classifySurfaces/.test(rl) && /MODAL_TAG_SUFFIXES/.test(rl),
    '分类实现不得从 lib 消失(消失了门会静默退化而不是喊红)',
  )
})

test('T18 出处对照必须钉清偿前的 ref,不得改回 HEAD(账还完那天阳性对照会一起消失)', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(
    /PROBE_REF\s*=/.test(src) && /IHUI_RADIUS_PROBE_REF/.test(src),
    '真仓阳性对照的取材 ref 必须是可覆盖的出处常量,不能硬写 HEAD',
  )
  assert.ok(
    !/catBatch\(repoRoot,\s*\[\s*`HEAD:\$\{SURF_PROBE\}`/.test(src),
    '把出处对照改回 HEAD 面 = 让自检在清偿当天集体失效(§22c 复读机型)',
  )
})

test('T16b 真仓 radius.js 逐角色可解,显式 rnRadiusFor.hero 必须读得出 16', () => {
  const table = TABLE()
  assert.ok(table, '档位表解析不得为空 / null(空表会被下游读成"没有差异")')
  assert.equal(table['role:hero'], 16)
  assert.equal(table['role:card'], 8)
  const forms = radiusFormsInLine('  borderRadius: rnRadiusFor.hero,', table)
  assert.ok(
    forms.some((f) => f.px === 16),
    '显式取用也读不出 16 ⇒ 这一档在尺子上仍然不存在,判红/合规都轮不到它',
  )
})
test('T19 C5 组件名档必须真装在判据链上(声明作用域归属被摘线时,门不得继续报"已合规")', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /declarationRanges\(/, '声明区间解析没被调用 ⇒ 内联小组件会重新被外层名字顶判')
  assert.match(src, /ownerOfLine\(/, '逐行归属没被调用 ⇒ 根容器判不出所属组件')
  assert.match(src, /componentUndetermined/, '判不出的根容器必须逐条报名,不得只留一个计数')
})

test('T20 词法器必须认 `return <X/>` 无括号形态,同时不得把比较式建成元素(成对)', async () => {
  const { scanJsx } = await import(pathToFileURL(join(import.meta.dirname, '..', 'lib', 'jsx-scope.mjs')).href)
  const { maskFaces } = await import(pathToFileURL(LIB).href)
  const mk = (code) => {
    const { kept, strings } = maskFaces(code)
    return scanJsx(kept, { strings })
  }
  const a = mk('function E(){\n  return <div className="b">x</div>\n}')
  assert.ok(a.elements.some((e) => e.base === 'div'), '「return <div/>」不被识别时整个文件的容器维静默失效(实测 99 个文件在这一型上是 corrupt)')
  assert.equal(a.corrupt, 0, '该形态不得计成闭合失配')
  const b = mk('const ok = a < b ? 1 : 2')
  assert.equal(b.elements.length, 0, '比较式被认成 JSX ⇒ 会凭空长出幽灵祖先,这比漏判更贵')
})

test('T21 类名取证不得越界采兄弟属性,也不得因此漏采同一属性的多段形态(成对)', async () => {
  const { classStringsInLine } = await import(pathToFileURL(LIB).href)
  const one = '<div className="rounded-xl border bg-card" data-testid="plan-review-panel">'
  assert.deepEqual(classStringsInLine(one, one), ['rounded-xl border bg-card'], '兄弟属性的值被当类名 ⇒ 造出一条根本不存在的类别证据')
  const two = '<div className={cn("rounded-xl bg-card", "px-3 py-2")}>'
  assert.equal(classStringsInLine(two, two).length, 2, '同一 class 属性的第二段漏采 ⇒ 门对该形态失明')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
