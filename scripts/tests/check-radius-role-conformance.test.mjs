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
// 接线真值的唯一源: 头注该说哪一态由它决定, 不由一句会过期的台词决定(见 T2)。
const RUNNER = join(import.meta.dirname, '..', 'guardian-runner.mjs')
const LIB = join(import.meta.dirname, '..', 'lib', 'radius-roles.mjs')
const MASK_LIB = join(import.meta.dirname, '..', 'lib', 'code-mask.mjs')
const REPO = join(import.meta.dirname, '..', '..')
/** 形状锁一律比归一化空白后的文本:prettier 折行不得造出与正确性无关的假红。 */
const norm = (t) => String(t).replace(/s+/g, ' ')

const { __test__: T, main, emitBaseline, runAudit } = await import(pathToFileURL(SRC).href)

const git = (args, cwd) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args],
    {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
/**
 * 受控索引(GIT_INDEX_FILE)那一档 —— 回退判定的端到端**只能**拿它验:共享索引此刻有没有 .tsx
 * 由并发会话决定(拿它做断言 = 把仓库瞬时状态当尺子,门 103 的 T12 同课),而真提交链用的正是
 * `GIT_INDEX_FILE=<tmp> git read-tree …` 那条隔离通道(G-978044 现场即此型:非 UI 提交的私有
 * 索引里结构上没有射程内文件)。全程只写夹具仓自己的副本索引,共享 `.git/index` 与工作树不碰。
 */
const gitIdx = (args, cwd, idx) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    env: { ...process.env, GIT_INDEX_FILE: idx },
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
/** 把 HEAD 上**已存在**的 blob 登记进受控索引:`--cacheinfo` 只写索引条目,不写对象库、不写工作树。 */
const putInIndex = (cwd, idx, rel) =>
  gitIdx(
    ['update-index', '--add', '--cacheinfo', `100644,${git(['rev-parse', `HEAD:${rel}`], cwd).trim()},${rel}`],
    cwd,
    idx,
  )
/** 在受控索引面上跑一次门(main 内部走 execFileSync ⇒ 继承 process.env,换面只在这段里生效)。 */
async function captureOnIndex(argv, root, idx) {
  const prev = process.env.GIT_INDEX_FILE
  process.env.GIT_INDEX_FILE = idx
  try {
    return await capture(argv, root)
  } finally {
    if (prev === undefined) delete process.env.GIT_INDEX_FILE
    else process.env.GIT_INDEX_FILE = prev
  }
}
/** 真仓阳性对照按**出处**取 —— 账还完那天 HEAD 上就不再有这条违规,钉 HEAD 的对照会在清偿当天集体失效(票㉗ T18 同一条)。 */
const PROBE_REF = process.env.IHUI_RADIUS_PROBE_REF || 'acf1927e96'
const probeBlob = (rel) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', 'show', PROBE_REF + ':' + rel],
    {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
const headBlob = (rel) =>
  execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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

test('T2 门头注声称的接线态必须与注册表真值一致(两态都认,不许把真话判红)', () => {
  const src = readFileSync(SRC, 'utf8')
  const runner = readFileSync(RUNNER, 'utf8')
  const wired = runner.includes('check-radius-role-conformance.mjs')
  // 立意不变: 头注若声称"已接入"而注册表里没有 → 那是给后人一个跑不通的出路(AGENTS 禁令),必须拦。
  //
  // 2026-10-06 改判据的原因(与门 133 的 M3 同型): 原判据是**绝对字面量** ——
  // 硬要求头注含「刻意不自行接进提交链」, 且禁止任何「已接入/已注册进」字样。
  // 它当年正确(门确实没接线), 但接线后来**真的发生了**(实测 runner 里已注册
  // id:'150' / mode:'blocking' / skipEnv: HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE),
  // 于是它反过来**逼文档继续说谎**: 谁把头注如实改成"已接入" 谁就被判红。
  // 一条把真相判红的尺子, 教出来的就是谎报。
  //
  // ⚠️ 只认**现状陈述**,不认存档引文(变异实测): 裸匹配 `刻意不自行接进提交链` 会把
  // 「立项时那句「本门刻意不自行接进提交链…」连同建议值一并留在下方作存档」这类
  // **如实记录历史**读成现状 ⇒ `wired=false` 变异全绿 = 无牙。
  // 故只认『接线状态:』引导的那一行(容许括号里的时点注记)。
  if (wired) {
    assert.match(
      src,
      /^[/ \*]*接线状态\s*(?:\([^)]*\))?\s*[:：][^\n]*已接入/m,
      '注册表里本门已注册,但头注的『接线状态:』那一行仍说未接线 ⇒ 文档与提交链分叉(同型已修:门 133 的 M3)',
    )
  } else {
    assert.match(
      src,
      /^[/ \*]*接线状态\s*(?:\([^)]*\))?\s*[:：]\s*未接/m,
      '头注必须明说未接线(而不是留白让人猜)',
    )
    assert.doesNotMatch(src, /已接入 pre-commit|已注册进 guardian-runner|已挂进提交链/, '不得谎称已接')
  }
  // 接线条目要素两态都要齐(主会话接线时只能猜 ⇒ 要素必须写在头注里)
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
  // 清单与内容同面同轮:正文 + 具名档来源 + 档位表 + 台账必须进**同一次** catBatch。
  // 中间允许 `...tierFiles` —— 除法形态半径的被除数常常定义在 geometry.js / spec 里,那批文件
  // 一旦改成"另开一次读盘"就与正文不同面(表读盘 + 内容读 HEAD 会产出自洽却错位的尺子,门 83/101 同条)。
  assert.match(
    src,
    /\[\.\.\.files,[^\]]*RADIUS_TABLE_REL,[^\]]*BASELINE_REL,[^\]]*ADJUDICATIONS_REL\s*\]/,
    '档位表/台账/裁决账必须与正文同一次批量读(裁决账按磁盘读 ⇒ 别台机上已了结的裁决照旧免检)',
  )
  assert.match(
    src,
    /\[\.\.\.files,\s*\.\.\.tierFiles,/,
    '具名档来源必须与正文同面同轮取(另起一次读盘 = 半接线)',
  )
  assert.ok(
    !/readFileSync\([^)]*geometry\.js/.test(src) && !/SPEC_SRC_RE|readdirSync\(['"]packages/.test(src),
    '具名档不得按磁盘单独扫',
  )
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


/**
 * T22 C6 判红路径必须**真的存在**(行为证明,不是形状证明)。
 * 立因:票㉚ 第一版把胶囊写成"只进队列",而登记文本已经写了"判红"—— 账面与实现分叉时,
 * 只有行为用例能发现;而更早在同一批里,8 条用例因把箭头函数当断言传给 t() 而**从未求值**
 * (t 取的是布尔,!!fn 恒真),所以"全绿"里混着空断言。两条一起钉。
 */
test('T22 C6:短边达标的角色件胶囊必须进 violations 且不吃豁免;细于阈值的装饰条只进队列', async () => {
  const { auditFileText } = await import(pathToFileURL(SRC).href)
  const table = radiusLookup(readFileSync(join(REPO, 'packages/design-tokens/src/radius.js'), 'utf8'))
  const pill = 'const s = { card: { width: 40, height: 16, borderRadius: rnRadius.lg } }'
  const r1 = auditFileText('x/Pill.tsx', pill, table)
  assert.equal(r1.violations.filter((v) => v.reason === 'capsule').length, 1, '短边 16 的角色件胶囊必须判红')
  const r2 = auditFileText('x/Pill2.tsx', pill + ' // radius-role-exempt: 想免检', table)
  assert.equal(r2.violations.filter((v) => v.reason === 'capsule').length, 1, '豁免标记不得让胶囊消失')
  assert.ok(r2.exemptionIgnored >= 1, '被忽略的标记必须计出来,不能静默')
  const thin = 'const s = { card: { width: 60, height: 8, borderRadius: rnRadius.sm } }'
  const r3 = auditFileText('x/Thin.tsx', thin, table)
  assert.equal(r3.violations.filter((v) => v.reason === 'capsule').length, 0, '细于可点尺寸的装饰条不得判红(§4 保护装饰族)')
  assert.equal(r3.capsuleFindings.length, 1, '但它必须留在队列里,不得静默消失')
})

test('T23 自检 harness 不得接受"函数当断言"(空断言锁)', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /typeof cond === 'function'/, 'harness 必须拒绝未求值的断言(否则 ✅ 可能是空断言)')
  assert.ok(!/^\s+t\('[^']*', \(\) => \{$/m.test(src), '不得再有 t(name, () => {...}) 这种从不求值的用例形态')
})

/**
 * T24 豁免通道废除的两半(2026-09-29 O81 票㊵),与门 77 的 T-B8 是一对:
 *  ① 形状锁 —— 本门不得再引 `isRoleExemptAt` / `isRadiusExemptAt`,也不得自己抄一份识别式;
 *  ② 行为锁 —— 同一段代码带标记与不带标记,**判定四格必须逐字相同**,只有 `marked` 变。
 * 只留①会放过"判序里还藏着一条 continue"的写法(形状像没出口、行为上仍放行);
 * 只留②则半年后有人加回一行 `if (marked) continue` 而镜像全绿 —— 本仓"摘完又长回来"就是实测过的。
 */
test('T24 豁免出口不得回来:形状锁 + 带标记/不带标记结论逐格相同', async () => {
  const src = readFileSync(SRC, 'utf8')
  const lib = readFileSync(LIB, 'utf8')
  assert.ok(!/isRoleExemptAt|isRadiusExemptAt/.test(src), '本门还在引旧的"按标记放行"出口')
  assert.ok(!/isRoleExemptAt|isRadiusExemptAt/.test(lib), 'radius-roles 里还留着放行函数(通道已废除,不得留恒可用的出口)')
  assert.match(src, /from '\.\/lib\/radius-exempt-marker\.mjs'/, '报名用的识别式必须来自那一份 lib')
  assert.ok(!/const\s+RADIUS_EXEMPT_MARKER_RE\s*=/.test(src), '本门抄了第二份识别式')

  const { auditFileText } = await import(pathToFileURL(SRC).href)
  const table = radiusLookup(headBlob('packages/design-tokens/src/radius.js'))
  const code = 'const s = { card: { width: 40, height: 16, borderRadius: rnRadius.lg } }'
  const a = auditFileText('x/P.tsx', code, table)
  const b = auditFileText('x/P.tsx', `${code} // radius-role-exempt: 想免检`, table)
  const g = (r) => [r.usages, r.violations.length, r.compliant, r.undetermined.length, r.capsule, r.trueCircle]
  assert.deepEqual(g(b), g(a), '带标记的一侧结论与不带标记不同 ⇒ 标记仍在改变判定,通道没废除干净')
  assert.equal(a.marked, 0, '不带标记不该计 marked')
  assert.ok(b.marked >= 1, '带标记必须被数出来(报"没看见"与"看见了但无效"在账面上必须不同形)')
})

/**
 * T25/T26/T27 弱证据队列的裁决账(2026-09-29):一条**只能变长、不能变短**的队列等于没有判据 ——
 * 它既不会让任何人去处理,又替人做出"这一格已被看过"的判断(与守门 108 对豁免的"只出生不死亡"同条)。
 * 三条各锁一维:T25 接线(退出码必须尊重账问题)、T26 行为四型成对、T27 真仓台账不得是张死表。
 */
test('T25 裁决账必须改退出码:只打印不改红 = 账烂了也没人被打断', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /applyAdjudications\(/, 'main 未接裁决账 ⇒ 队列仍是只能变长的死账')
  assert.match(
    src,
    /if \(res\.adjudicationProblems\.length\) return 1/,
    '账问题必须参与退出码;只 console.log 不算接线',
  )
  assert.match(src, /ADJUDICATIONS_REL/, '台账必须按被审面取(与 baseline 同面同轮),不得读盘')
})

test('T26 四型行为成对:齐备则出队,无理由或过期则红且不出队,站点消失则腐烂红', async () => {
  const { applyAdjudications } = await import(pathToFileURL(SRC).href)
  const site = [
    { file: 'a/X.tsx', line: 10, form: 'rounded-md', role: 'card', expectedStep: 'lg', evidence: 'weak' },
  ]
  const item = {
    file: 'a/X.tsx',
    form: 'rounded-md',
    role: 'card',
    expectedStep: 'lg',
    reason: '带边框 + 自身内边距 + 纵向堆行',
    owner: 'X 持有人',
    reviewBy: '2099-01-01',
  }
  const ok = applyAdjudications(site, [item], '2026-09-29')
  assert.deepEqual([ok.pending.length, ok.adjudicated.length, ok.problems.length], [0, 1, 0])
  const noReason = applyAdjudications(site, [{ ...item, reason: '' }], '2026-09-29')
  assert.equal(noReason.problems.length, 1, '缺理由必须点名')
  assert.equal(noReason.pending.length, 1, '坏账不得把站点抹出队列 —— 否则写个空条目就免检')
  const expired = applyAdjudications(site, [{ ...item, reviewBy: '2020-01-01' }], '2026-09-29')
  assert.ok(expired.problems.some((p) => p.startsWith('AJ2')), '到期要红')
  assert.equal(expired.pending.length, 1, '到期后站点必须回到队列,不得继续免检')
  const gone = applyAdjudications([], [item], '2026-09-29')
  assert.ok(gone.problems.some((p) => p.startsWith('AJ3')), '站点消失而账还挂着 = 清单腐烂,必须红')
})

test('T27 真仓台账装车证明:必须可解析、字段齐备,且至少一条真匹配门在 HEAD 上量到的弱证据', async () => {
  const { parseAdjudications, runAudit } = await import(pathToFileURL(SRC).href)
  const items = parseAdjudications(headBlob('scripts/data/radius-role-adjudications.json'), 'ledger')
  if (items.length === 0) return // 队列已清空 ⇒ 台账应为空;空表不是谎,因为没有可腐烂的条目
  for (const it of items) {
    for (const k of ['file', 'form', 'role', 'expectedStep', 'reason', 'owner', 'reviewBy']) {
      assert.ok(String(it[k] ?? '').trim(), '台账条目缺字段 ' + k + ':' + it.file)
    }
    assert.match(it.reviewBy, /^\d{4}-\d{2}-\d{2}$/, '到期日形态不对:' + it.file)
  }
  const res = runAudit(REPO, 'head')
  const keys = new Set(
    res.weakFindings.map((f) => [f.file, f.form, f.role, f.expectedStep].join('|'))
  )
  const hits = items.filter((it) =>
    keys.has([it.file, it.form, it.role, it.expectedStep].join('|'))
  )
  assert.ok(hits.length >= 1, '台账与门量到的弱证据零交集 ⇒ 这是一张死表(条目要么早该删、要么键写歪了)')
})


/**
 * T28–T32 单参长度包裹器与盒形量算(2026-09-29 续票:把门 150 现读唯一那格「未判定」判成结论)。
 *
 * 现场:`apps/miniapp-taro/src/components/ModelList.tsx:271` 的勾选框把边长写成
 * `width: toUnit(MODEL_LIST_CHECK_BOX_PX)`,半径写成 `MODEL_LIST_CHECK_BOX_PX / 2` ——
 * 语义上是"正方盒 + 半径 = 半边长"的**几何真圆装饰件**(§4 的 C6 档,不再需要任何标记),
 * 但尺子量不到被函数包住的边长,于是它报成 `off-scale 10px` 的未判定。
 * **仓库里没有缺陷,缺的是尺子**,所以这一组用例锁的是"尺子怎么长回去、以及它不许顺手多判什么":
 *  - T28 真仓逐字成对(带系数 ⇒ 真圆 / 去掉系数 ⇒ 必须退回未判定,不得"按名字当恒等");
 *  - T29 两族写法各自成立(小程序 `rpx(p * 系数)` / RN `p => p`),未注册的名字一律不剥;
 *  - T30 包裹器不得把胶囊洗成圆(非正方盒 ⇒ 判红),与"量不到"成对;
 *  - T31 倍率诚实性(系数=3 ⇒ 折 30,不是 20);
 *  - T32 单份实现反向锁(折算算术只住 length-units;门 150 的两个取面必须走同一个建表出口)。
 */
const WRAPPER_SRC = [
  "import { cn, rnRadius, TARO_RPX_PER_PX } from '@ihui/design-tokens'",
  "import { rpx } from '@/utils/rpx'",
  'const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)',
  'const BOX_PX = 20',
].join('\n')

test('T28 真仓逐字成对:ModelList 的包裹边长配 `X / 2` ⇒ 判真圆;把系数抽掉 ⇒ 必须退回未判定', async () => {
  const { auditFileText, baseConstsOf } = await import(pathToFileURL(SRC).href)
  const table = radiusLookup(headBlob('packages/design-tokens/src/radius.js'))
  const rel = 'apps/miniapp-taro/src/components/ModelList.tsx'
  const src = headBlob(rel)
  // 与门自己的取数口径同形:系数与具名档都从**被审面**的那两份源里导出来,不在测试里抄数字。
  const tierSources = {
    'packages/design-tokens/src/geometry.js': headBlob('packages/design-tokens/src/geometry.js'),
    'packages/shared/src/ui/model-list-spec.ts': headBlob(
      'packages/shared/src/ui/model-list-spec.ts',
    ),
  }
  const withCoef = baseConstsOf(tierSources)
  assert.equal(withCoef.get('TARO_RPX_PER_PX'), '2', '系数没进表 ⇒ 下面那一臂的"通过"就是空的')
  const hitRow = (r) => r.undetermined.filter((u) => u.line === 271)

  const a = auditFileText(rel, src, table, withCoef)
  assert.equal(hitRow(a).length, 0, '带系数那一臂:271 行不得还停在未判定(尺子仍量不到)')
  assert.ok(a.trueCircle >= 1, '带系数那一臂:这一格必须落 C6 真圆(§4:该形状不再需要任何标记)')
  assert.equal(a.capsule, 0, '正方盒不得被判成胶囊')

  // 反臂:把系数从表里抽掉(等价于"这条 import 解不到")⇒ 结论必须**退回**未判定,
  // 而不是"按 toUnit 这个名字假定恒等"。名字不携带语义,这是本票唯一可能的失效方向。
  const noCoef = new Map([...withCoef].filter(([k]) => k !== 'TARO_RPX_PER_PX'))
  assert.ok(!noCoef.has('TARO_RPX_PER_PX'))
  const b = auditFileText(rel, src, table, noCoef)
  assert.equal(b.trueCircle, 0, '解不到系数却判出真圆 ⇒ 尺子在按名字猜,合格证作废')
  assert.equal(b.capsule, 0)
  assert.equal(hitRow(b).length, 1, '反臂必须回到"未判定"并逐条报名(不冒红也不记绿)')
})

test('T29 两族包裹写法都成立,未注册的名字一律不剥(成对)', async () => {
  const { constantMapOf, constExprPx, pxWrappersOf } = await import(
    pathToFileURL(join(import.meta.dirname, '..', 'lib', 'length-units.mjs')).href
  )
  const { dimsFromText } = await import(
    pathToFileURL(join(import.meta.dirname, '..', 'lib', 'box-geometry.mjs')).href
  )
  const merged = (extra) => new Map([...Object.entries(extra), ...constantMapOf(WRAPPER_SRC)])
  // ① 小程序族:rpx(p * 系数) —— 只有系数折回来等于 RPX_PER_PX 才是 px 保形
  assert.equal(constExprPx('toUnit(BOX_PX)', merged({ TARO_RPX_PER_PX: '2' })), 20)
  // ② RN 族:恒等(逐字取自 apps/mobile-rn/src/components/Menu.tsx:98),不需要系数
  const rn = ['const toUnit = (px: number) => px', 'const BOX_PX = 20'].join('\n')
  assert.equal(constExprPx('toUnit(BOX_PX)', constantMapOf(rn)), 20)
  // ③ 未注册的名字**不得**被剥:同名同形但不是长度包裹器 ⇒ 维持"量不到"(= 改动前结论)
  assert.equal(constExprPx('maybeWrap(BOX_PX)', merged({ TARO_RPX_PER_PX: '2' })), null)
  assert.equal(
    pxWrappersOf('const maybeWrap = (px: number) => px * 2').size,
    0,
    '乘完不返回长度的一律不注册',
  )
  assert.equal(
    pxWrappersOf('// const toUnit = (px: number) => px').size,
    0,
    '注释行不得注册(否则门给自己发合格证)',
  )
  // ④ 模板字面量式(`toRpx` 那一族)刻意不在射程内 —— 登记为边界,不得"顺手也认了"
  assert.equal(
    pxWrappersOf('const toRpx = (px: number): string => `${px * 2}rpx`').size,
    0,
    '模板字面量式属另一票(先清存量再收紧),本支必须判"不注册"',
  )
  // ⑤ 盒形侧同样只多这一口:注册了才量得到,没注册与改动前逐字同
  const win = 'width: toUnit(BOX_PX), height: toUnit(BOX_PX), borderRadius: BOX_PX / 2,'
  const ok = dimsFromText(win, merged({ TARO_RPX_PER_PX: '2' }))
  assert.ok(ok.w === 20 && ok.h === 20 && ok.shape === 'square', '包裹写法量得出 20×20 方盒')
  const bad = dimsFromText(win.replace(/toUnit/g, 'unknownWrap'), merged({ TARO_RPX_PER_PX: '2' }))
  assert.ok(bad.w === 0 && bad.h === 0, '未注册的名字不得被剥成数值(宁漏不误判)')
})

test('T30 包裹器不得把胶囊洗成圆:非正方盒必须判红,与"量不到"成对', async () => {
  const { auditFileText } = await import(pathToFileURL(SRC).href)
  const table = radiusLookup(headBlob('packages/design-tokens/src/radius.js'))
  const src = [
    WRAPPER_SRC,
    'export const s = {',
    '  card: {',
    '    width: toUnit(WIDE_PX),',
    '    height: toUnit(TALL_PX),',
    '    borderRadius: TALL_PX / 2,',
    '  },',
    '}',
  ].join('\n')
  const base = new Map([
    ['WIDE_PX', '40'],
    ['TALL_PX', '20'],
    ['TARO_RPX_PER_PX', '2'],
  ])
  const r = auditFileText('x/WrapperPill.tsx', src, table, base)
  assert.equal(r.trueCircle, 0, '40×20 的盒配 10 的半径不是圆')
  assert.equal(r.capsule, 1, '短边 20 ≥ 下限且半径=半边 ⇒ 必须落胶囊判红(项目不允许,且不吃豁免)')
  assert.equal(r.violations.filter((v) => v.reason === 'capsule').length, 1)
  // 反臂:同一个形状,把系数拿掉 ⇒ 退回改动前的"量不到/未判定",既不得判红也不得判绿
  const noCoef = new Map([...base].filter(([k]) => k !== 'TARO_RPX_PER_PX'))
  const r2 = auditFileText('x/WrapperPill.tsx', src, table, noCoef)
  assert.equal(r2.capsule, 0, '解不到系数却判红 = 拿猜出来的盒形当证据')
  assert.equal(r2.trueCircle, 0)
  assert.ok(r2.undetermined.length >= 1, '量不到必须留在"未判定/报名"那一格里,不得静默算通过')
})

test('T31 倍率诚实性:系数不是 rpx-per-px 时按倍率折算,绝不按名字假定恒等', async () => {
  const L = await import(
    pathToFileURL(join(import.meta.dirname, '..', 'lib', 'length-units.mjs')).href
  )
  assert.equal(L.RPX_PER_PX, 2, '尺子自己的 rpx↔px 口径(改了它就要重看折算)')
  const constsWith = (coef) =>
    new Map([['BOX_PX', '20'], ['TARO_RPX_PER_PX', coef], ...L.constantMapOf(WRAPPER_SRC)])
  // 有人把系数改成 3 ⇒ 落地是 `60rpx` = 30px,不是 20。按倍率折算,而不是"认名字"。
  assert.equal(L.constExprPx('toUnit(BOX_PX)', constsWith('3')), 30)
  assert.equal(L.constExprPx('toUnit(BOX_PX)', constsWith('2')), 20)
  // 系数写成解不到的东西 ⇒ 整体 null(不得退化成"当作 2"或"当作恒等")
  assert.equal(
    L.constExprPx('toUnit(BOX_PX)', new Map([['BOX_PX', '20'], ...L.constantMapOf(WRAPPER_SRC)])),
    null,
  )
})

test('T32 单份实现反向锁:折算算术只住 length-units,建表出口只有一个且两个取面同口径', () => {
  const geo = readFileSync(join(import.meta.dirname, '..', 'lib', 'box-geometry.mjs'), 'utf8')
  assert.ok(
    !/PX_WRAPPERS|pxWrappersOf|RPX_PER_PX/.test(geo),
    '盒形层自己解析包裹器或抄倍率 = 第二份真相(半径侧认得、盒形侧不认那一型)',
  )
  assert.match(
    geo,
    /constExprPx\(m\[2\], consts\)/,
    '新增那支必须把右值交回 constExprPx 那一份求值',
  )
  const gate = readFileSync(SRC, 'utf8')
  assert.match(gate, /unitCoefficientsOfSources/, '系数必须从被审面的 geometry.js 现读')
  assert.equal(
    (gate.match(/= baseConstsOf\(tierSources\)/g) || []).length,
    2,
    'HEAD 档与索引/工作树档必须同口径(只有一处喂系数 = 另一面看不见包裹器)',
  )
  assert.ok(
    !/TARO_RPX_PER_PX\s*=\s*2/.test(gate),
    '门里写死系数值 = 改了源头它还在按旧值判(空支票)',
  )
})

/**
 * T33 回退判定端到端(G-978044)。
 *
 * 修前实测:本门 `--staged` 在"索引面上枚举到 0 个在射程文件"时判 `无法判定 ⇒ exit 2`,而只改
 * 文档/语言包/后端的提交**结构上**不带 .tsx/.css ⇒ 每一枚无关提交都被它挡(取证件
 * `A2-pre-doc-only-staged.txt`,complete/RC=2)。恒挡的唯一出路是各会话走 `--no-verify`,连带
 * 废掉链上约 197 道对账(§12e)—— 所以这一格必须**照判**,而不是"跳过",也不是"无法判定"。
 *
 * 这一例走的是夹具仓 + 私有索引(受控面),不是共享索引:共享索引此刻 stage 了什么由并发会话决定。
 */
test('T33 暂存档无射程内文件 ⇒ 回退 HEAD 全量并喊出来(照判:超锚点仍红,HEAD 合规仍绿)', async () => {
  const dir = mkScratch('radius-role-retreat')
  try {
    const put = (rel, text) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
    const tableSrc = headBlob('packages/design-tokens/src/radius.js')
    git(['init', '-q', '-b', 'main'], dir)
    put('packages/design-tokens/src/radius.js', tableSrc)
    put('apps/web/src/a.tsx', 'const s = { card: { borderRadius: rnRadius.xl } }\nexport { s }\n')
    put('scripts/radius-role-conformance-baseline.json', JSON.stringify({ anchors: {} }))
    put('docs/notes.md', '一次只改文档的提交\n')
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'seed'], dir)

    const idx = join(dir, 'priv-retreat.idx')
    gitIdx(['read-tree', '--empty'], dir, idx)
    putInIndex(dir, idx, 'docs/notes.md')
    assert.deepEqual(
      gitIdx(['ls-files'], dir, idx).trim().split('\n'),
      ['docs/notes.md'],
      '受控索引里必须只有文档 —— 这正是非 UI 提交的结构形态',
    )

    const red = await captureOnIndex(['--staged'], dir, idx)
    assert.equal(red.code, 1, '回退=照判:HEAD 全量面自己超锚点就得报红,不得被读成"跳过"')
    assert.match(red.out, /本次无射程内文件，已回退 HEAD 全量/, '换面必须大声喊出来(静默换面与"没判"同形,§12f)')
    assert.match(red.out, /判定面 HEAD blob:扫 1 个在射程文件/, '喊完还得给出真的判定面与判定量,否则"回退"只是措辞')
    assert.doesNotMatch(red.out, /无法判定/, '无射程内文件不是"取不到",不得判成未判定挡掉无关提交')
    const j = JSON.parse((await captureOnIndex(['--staged', '--json'], dir, idx)).out)
    assert.equal(j.requestedFace, 'staged', '请求的面要留痕,否则没人看得出换了面')
    assert.equal(j.face, 'head')
    assert.ok(j.retreatReason, '机器读面上同样必须看得见这次回退')

    // 配对臂:台账套住 HEAD 自身存量后,回退判完就是 0 —— 回退不是"换面必红",判据一字未宽。
    put('scripts/radius-role-conformance-baseline.json', JSON.stringify({ anchors: { 'apps/web/src/a.tsx|card': 1 } }))
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'anchor'], dir)
    const clean = await captureOnIndex(['--staged'], dir, idx)
    assert.equal(clean.code, 0, 'HEAD 全量自身合规 ⇒ 回退判完给 0(锚点仍取该文件 HEAD 自身,没放宽判据)')
    assert.match(clean.out, /本次无射程内文件，已回退 HEAD 全量/, '绿的那一趟同样必须喊出来')
  } finally {
    rmScratch(dir)
  }
})

/**
 * T34 「回退判定」与「空扫判死」是两件事,各由各自的用例命中 —— 把它们并成一格,要么每次无关
 * 提交被挡(修前),要么判据失明伪装成通过(把空扫改成静默绿)。
 */
test('T34 两维各归各:有射程内文件而内容取不到 ⇒ 仍 exit 2 且不换面;回退后仍枚举到 0 ⇒ 仍判死', async () => {
  // —— 臂 A:索引面上**有**射程内文件,但它的内容读不到 ⇒ 未判定(这一格是"失明不得当通过"那把闸)
  const dir = mkScratch('radius-role-unreadable')
  try {
    const put = (rel, text) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
    git(['init', '-q', '-b', 'main'], dir)
    put('packages/design-tokens/src/radius.js', headBlob('packages/design-tokens/src/radius.js'))
    put('apps/web/src/a.tsx', 'const s = { card: { borderRadius: rnRadius.xl } }\n')
    put('scripts/radius-role-conformance-baseline.json', JSON.stringify({ anchors: {} }))
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'seed'], dir)
    const idx = join(dir, 'priv-ghost.idx')
    gitIdx(['read-tree', '--empty'], dir, idx)
    putInIndex(dir, idx, 'packages/design-tokens/src/radius.js')
    putInIndex(dir, idx, 'scripts/radius-role-conformance-baseline.json')
    // 一个在射程内、内容取不到的条目(索引登记了 40 位 OID,而对象库里没有那个对象)
    gitIdx(
      ['update-index', '--add', '--cacheinfo', '100644,0000000000000000000000000000000000000001,apps/web/src/ghost.tsx'],
      dir,
      idx,
    )
    const a = await captureOnIndex(['--staged'], dir, idx)
    assert.equal(a.code, 2, '有射程内文件而内容取不到 ⇒ 仍必须是"无法判定"(exit 2),既不冒红也不记绿')
    assert.match(a.out, /无法判定/)
    assert.match(a.out, /ghost\.tsx/, '取不到哪一个必须点名')
    assert.doesNotMatch(a.out, /已回退 HEAD 全量/, '有射程内文件时回退 = 把本次改动放过去')
  } finally {
    rmScratch(dir)
  }

  // —— 臂 B:回退之后**仍然**枚举到 0 个在射程文件 ⇒ 判死。回退不得吃掉这一维。
  const dir2 = mkScratch('radius-role-retreat-empty')
  try {
    const put = (rel, text) => {
      const abs = join(dir2, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
    git(['init', '-q', '-b', 'main'], dir2)
    put('packages/design-tokens/src/radius.js', headBlob('packages/design-tokens/src/radius.js'))
    put('docs/notes.md', 'HEAD 上就没有 UI 源码的仓\n')
    git(['add', '-A'], dir2)
    git(['commit', '-q', '-m', 'seed'], dir2)
    const idx2 = join(dir2, 'priv-empty.idx')
    gitIdx(['read-tree', '--empty'], dir2, idx2)
    putInIndex(dir2, idx2, 'docs/notes.md')
    const b = await captureOnIndex(['--staged'], dir2, idx2)
    assert.equal(b.code, 2, '回退后仍空扫 ⇒ 判死("什么都没扫到"永远不得写成"通过")')
    assert.match(b.out, /无法判定/, '这一格报的是未判定,不是 ✅')
    assert.doesNotMatch(b.out, /未发现|✅/, '空扫不得被回退通道洗成合格证')
  } finally {
    rmScratch(dir2)
  }
})

/**
 * T35 回退判读只有一份(G-978044 的修法约束):必须 import 门 135 那份导出的纯函数,
 * 本门里不得出现第二个 `shouldRetreatToHead` —— "两处算同一件事必漂移"是本仓记过最多次的失败型,
 * 而这里的漂移症状是**某一扇门悄悄不再回退**,每一次非 UI 提交又被挡回去。
 */
test('T35 回退判据必须是门 135 那一份 import,不得复制第二份;135 的出口被摘线时本门等于没有判据', async () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(
    src,
    /import \{ shouldRetreatToHead \} from '\.\/check-api-failure-throw\.mjs'/,
    '回退判定没引共用出口 —— 本门就是第二份真相',
  )
  assert.doesNotMatch(src, /function shouldRetreatToHead/, '本门里又写了一份 shouldRetreatToHead(两处必漂移)')
  assert.match(src, /retreatReason/, '回退必须留可读证据行,不得静默换面')
  const g135 = await import(pathToFileURL(join(REPO, 'scripts', 'check-api-failure-throw.mjs')).href)
  assert.equal(typeof g135.shouldRetreatToHead, 'function', '没 export 的出口等于不存在(门 135 T6 同课)')
  assert.equal(g135.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 0 }), true)
  assert.equal(g135.shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 1 }), false)
  assert.equal(T.retreatFacePlan({ face: 'head', hasOnlyFiles: false, inScopeCount: 0 }).effFace, 'head')
  assert.equal(T.retreatFacePlan({ face: 'head', hasOnlyFiles: false, inScopeCount: 0 }).retreatReason, null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
