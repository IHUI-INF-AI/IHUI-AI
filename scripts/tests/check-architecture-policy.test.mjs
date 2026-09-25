// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:架构契约门(scripts/check-architecture-policy.mjs)
//
// 直接 import 源脚本的 __test__,禁止在测试里复制一份实现(§22c)。
// 本文件要钉的是**不变量**,不是某一条登记文本:
//   「凡策略表登记的模块,其 roots/layer/requires 必须能被判定成立」
//   「门必须真的装在 runner 上(blocking + skipEnv),否则判据存在而永不调用 = 没有」
//   「默认档不得让一次正常提交变红(恒红门的唯一结局是逼人 --no-verify,连带废掉全部守门)」
// 因此下面既有正向装车证明,也有**变异注入**对照:改坏 runner 文本后断言必须失效,
// 否则就是在测空气(本仓"装车证明要钉不变量而不是钉条目"的教训)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as gate } from '../check-architecture-policy.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-architecture-policy.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const POLICY = join(REPO, gate.POLICY_REL)
const SCRIPT_NAME = 'check-architecture-policy.mjs'
const unq = (s) => (typeof s === 'string' ? s.replace(/^['"]|['"]$/g, '') : s)
const runnerText = () => readFileSync(RUNNER, 'utf8')
const policyText = () => readFileSync(POLICY, 'utf8')
const runCLI = (args) => {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, timeout: 600000 })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 2, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

/**
 * 从本门结论行里取"当次实测的收口集合"。模块级唯一一份 —— T12 与 T12b 共用同一把尺子,
 * 不在第二个测试里重抄正则(§22c:两份真相必然漂移)。
 * ⚠️ 必须停在 `|` 之前:同一行后面的「扫描 N 文件 / 跨模块边」计数天然随档位不同,
 *    吞进来会让"表相同 ⇒ 结论同形"这一支恒红、又让"表不同 ⇒ 结论异形"那一支恒真。
 */
const managedOf = (t) => /managed:true ([^|\n]*)/.exec(t)?.[1]?.trim() ?? ''

/** 取 CLI 输出里「❌ 架构契约判红 N 处」清单的规则标签(结构位:每条 `path[:line] [TAG] msg`)。 */
function redTags(out) {
  const i = out.indexOf('❌ 架构契约判红')
  if (i < 0) return []
  return [...out.slice(i).matchAll(/^\s+\S+(?::\d+)? \[([A-Za-z]\d+)\]/gm)].map((m) => m[1])
}

/** 默认档禁止判红的两条新判据:E1 入口齐备性 / E2 契约工件齐备性。
 *  T6/T12/T14 的断言对象是**这一条设计**,不是"真仓此刻是否全绿"。
 *  为什么必须换掉旧写法:旧断言 `assert.equal(code, 0)` 把仓库瞬时状态当恒定前提 ——
 *  真仓 HEAD 此刻挂着与本片无关的 D1/D2 存量红(packages/i18n 的测试反向依赖 packages/shared),
 *  于是三支测试在完全合规的代码上恒红,而红点会把人推向 --no-verify、连带废掉全部守门(§12e 同型)。
 *  判据本身没有错,是尺子钉错了对象;E1/E2 的"默认只报数"由下面的成对断言守住,
 *  并由 --strict 侧的配对证明它不是永久豁免。 */
const NOT_RED_BY_DEFAULT = ['E1', 'E2']

function assertNoDeclaredReds(out, face) {
  const escalated = redTags(out).filter((t) => NOT_RED_BY_DEFAULT.includes(t))
  assert.deepEqual(escalated, [], `档[${face}] 把齐备性(E1/E2)判成了红 —— 未齐备存量默认只报数,问责走 --strict;即时判红就是恒红机器`)
}

test('T1 装车证明:本门确实装在 runner 上,且是 blocking + 有真实 skipEnv', () => {
  const hits = gate.registrationOf(runnerText(), SCRIPT_NAME)
  assert.equal(hits.length, 1, `注册块应恰好 1 个,实得 ${hits.length}`)
  const h = hits[0]
  assert.ok(h.id && /^\d+$/.test(unq(h.id)), `注册块必须有数字 id,实得 ${h.id}`)
  assert.equal(unq(h.mode), 'blocking', '本门必须是 blocking(warn 级等于没有)')
  assert.match(unq(h.skipEnv || ''), /^HUSKY_SKIP_[A-Z_]+$/, '紧急跳过环境变量必须真实声明(runner 只认注册块里的 skipEnv)')
  assert.equal(unq(h.script), SCRIPT_NAME, 'script 字段必须指回本门脚本')
  assert.ok(h.label && h.label.length > 4, 'label 必须存在(失败时是人与机器唯一的读数)')
})

test('T2 反查号不变量:本门的 id 在整份 runner 里只能出现一次(撞号即串 skipEnv 与失败归属)', () => {
  const text = runnerText()
  const id = unq(gate.registrationOf(text, SCRIPT_NAME)[0].id)
  const occurrences = text.split('\n').filter((l) => new RegExp(`^\\s*id: '${id}',$`).test(l)).length
  assert.equal(occurrences, 1, `id ${id} 在 runner 里出现 ${occurrences} 次`)
  // 反向对照:把本门的 id 再抄一处,同一把尺子必须立刻发现(证明本断言不是空转)
  const mutated = `${text}\n  {\n    id: '${id}',\n    script: 'some-other-gate.mjs',\n  },\n`
  const dup = mutated.split('\n').filter((l) => new RegExp(`^\\s*id: '${id}',$`).test(l)).length
  assert.ok(dup > 1, '变异对照:重复登记必须被同一判据抓出')
})

test('T3 紧急跳过环境变量全局唯一(两道门共用一个 skipEnv = 一次跳过废掉两道门)', () => {
  const envs = [...runnerText().matchAll(/^\s*skipEnv:\s*'([^']+)'/gm)].map((m) => m[1])
  const mine = unq(gate.registrationOf(runnerText(), SCRIPT_NAME)[0].skipEnv)
  assert.ok(envs.includes(mine))
  assert.equal(envs.filter((e) => e === mine).length, 1, `${mine} 被多道门共用`)
})

test('T4 变异注入:摘掉 mode: blocking 或整块注册,装车证明必须立刻失败', () => {
  const text = runnerText()
  const stripped = text.replace(new RegExp(`(script: '${SCRIPT_NAME}',[\\s\\S]{0,200}?)\\n\\s*mode: 'blocking',`), '$1')
  assert.notEqual(stripped, text, '变异没落到结构位上(等于没测)')
  assert.notEqual(unq(gate.registrationOf(stripped, SCRIPT_NAME)[0].mode || ''), 'blocking', '摘线后仍报 blocking = 判据失效')
  const removed = text.replace(new RegExp(`script: '${SCRIPT_NAME}',`), "script: 'other-gate.mjs',")
  assert.equal(gate.registrationOf(removed, SCRIPT_NAME).length, 0, '换掉 script 后必须认不出本门(不得靠 label 蒙)')
})

test('T5 策略表本身必须能被装载,且模块清单非空(扫到 0 条不得记为通过)', () => {
  const P = gate.loadPolicy(gate.parseYaml(policyText(), gate.POLICY_REL))
  assert.ok(P.modules.size >= 10, `模块数 ${P.modules.size} 明显少于仓库的 apps/packages 数`)
  for (const m of P.modules.values()) {
    assert.ok(m.roots.length >= 1, `${m.id} 没声明 roots`)
    assert.ok(m.rank !== null, `${m.id} 的 layer ${m.layer} 不在 layers 清单里`)
    for (const d of m.requires) assert.ok(P.modules.has(d), `${m.id} requires 未登记模块 ${d}`)
  }
  assert.ok([...P.modules.values()].some((m) => m.pkg), '至少要有一个可被 @ihui/* 引用的包')
})

test('T6 默认档不得因 E1/E2 判红(这道门不得成为恒红机器),且判红必须逐条点名', () => {
  // 成对判据一:默认档只报数。E1/E2 出现在判红清单里即红 —— 这一支与下面 --strict 那一支互证,
  // 单独任何一支都会退化成"恒绿"或"恒红"(本仓反复记过的同一条:判据必须有牙)。
  const full = runCLI([])
  assertNoDeclaredReds(full.out, '全量')
  const staged = runCLI(['--staged'])
  assertNoDeclaredReds(staged.out, '--staged')
  // 反"静默给退出码":非 0 却不点名任何一条判红 = 调用方无从修复,同样判失败
  if (full.code !== 0) assert.ok(redTags(full.out).length > 0, `全量档 exit ${full.code} 却拿不出判红清单:${full.out.slice(-400)}`)
  // 真仓此刻的存量红如实打印(只报数不定性、不拿它当断言对象):它归别的票,不该由本片消红,
  // 也不该由本片把它糊掉。
  console.log(`  ℹ️ 真仓默认档判红 ${redTags(full.out).length} 处(标签:${[...new Set(redTags(full.out))].join(',') || '无'})`)
  // 成对判据二:有未齐备存量时 --strict 必须真的升成 E2 问责,否则"默认只报数"就是永久豁免。
  // 条件挂在计数器上而不是挂在条目上 —— 全部补齐后这一支自然不再要求红(不会腐烂)。
  const absent = Number(/E2 未齐备模块 (\d+) 块/.exec(full.out)?.[1] ?? '0')
  if (absent > 0) {
    const strict = runCLI(['--strict'])
    assert.ok(redTags(strict.out).includes('E2'), `--strict 未把 ${absent} 块未齐备模块升成 E2 判红 ⇒ 齐备性问责形同虚设`)
    assert.equal(strict.code, 1, '--strict 判了 E2 红却仍 exit 0')
  }
})

test('T7 自检必须全绿(成对正反例是判据的唯一证人)', () => {
  const r = runCLI(['--self-test'])
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /全部 \d+ 例通过/)
  assert.doesNotMatch(r.out, /❌/, '自检里出现 ❌ 就说明某条判据已经和实现脱节')
})

test('T8 判据真有牙:同一份代码只在 managed 取向上不同 ⇒ 一侧判红、一侧只报数', () => {
  const code = new Map([['packages/i18n/tests/a.test.ts', "import { waiting } from '../../shared/src/chat/waiting-pool'\nexport const a = waiting"]])
  const flip = (re) => gate.loadPolicy(gate.parseYaml(policyText().replace(re[0], re[1]), 'trial'))
  const trialAll = flip([/^    managed: false$/gm, '    managed: true'])
  const on = gate.analyze(trialAll, code)
  assert.ok(on.violations.length >= 1, '把 i18n 的穿透导入喂给判据却一条都没报 ⇒ 判据没接上')
  assert.ok(on.red.length >= 1, 'managed:true 的模块违规必须进判红清单')
  /**
   * off 侧必须**自己构造**"该块为 false",不得拿真表现状当默认前提。
   * 上一版写的就是 `loadPolicy(parseYaml(policyText()))` 并注释成"managed:false",
   * 于是它把"packages/i18n 此刻还没收口"这个**瞬时仓库状态**当成了判据前提 ——
   * 2026-09-25 该块翻成 managed:true 的同一轮,本条立刻红(2 !== 0)。
   * 这是 T12 那条教训(判据的生命周期不得短于它所守的提交)在同一文件里的第二次复现,
   * 说明要修的是**写法习惯**:证明"只有 X 不同时结论不同",就得自己造出 X=false 那一侧。
   */
  const HOLD = 'packages/i18n'
  const onlyI18nOff = gate.loadPolicy(
    gate.parseYaml(
      policyText().replace(/(- id: 'packages\/i18n'(?:.|\n)*?\n    managed: )true/, '$1false'),
      'off-constructed',
    ),
  )
  assert.ok(
    [...onlyI18nOff.modules.values()].find((m) => m.id === HOLD) &&
      onlyI18nOff.modules.get(HOLD).managed === false,
    `构造失败:${HOLD} 没被置成 false ⇒ 下面的断言会退化成"测真表现状"`,
  )
  const off = gate.analyze(onlyI18nOff, code)
  assert.equal(off.red.length, 0, `同一份代码在 ${HOLD} 刻意置 managed:false 下必须只报数不判红(渐进收口的定义)`)
  assert.ok(off.violations.length >= 1, '只报数不等于不报:存量必须可见')
  // 成对自证一:真表与"全翻正"表的差,必须恰好等于真表里 managed:false 的那些块(即"按住的块"清单)
  const realP = gate.loadPolicy(gate.parseYaml(policyText(), 'real'))
  const heldOut = [...realP.modules.values()].filter((m) => !m.managed).map((m) => m.id).sort()
  const diff = [...trialAll.modules.values()].filter((m) => m.managed !== realP.modules.get(m.id).managed).map((m) => m.id).sort()
  assert.deepEqual(diff, heldOut, `全翻正表与真表的 managed 差应恰为"真表按住的块",实得 diff=${diff.join(',') || '(无)'} held=${heldOut.join(',') || '(无)'}`)
  // 成对自证二:构造面(off)与真表必须**恰好差 HOLD 一处**,否则"只差一个变量"的前提就没了
  const diffOff = [...onlyI18nOff.modules.values()].filter((m) => m.managed !== realP.modules.get(m.id).managed)
  assert.deepEqual(
    diffOff.map((m) => m.id),
    [HOLD],
    `构造面与真表必须恰好差 ${HOLD} 一处,实得 ${diffOff.map((m) => m.id).join(',') || '(无差 ⇒ 构造没生效,off 侧会退化成测真表现状)'}`,
  )
})

test('T11 渐进收口不得退回 0:真表里 managed:true ≥ 1(钉不变量,不钉具体条目)', () => {
  const P = gate.loadPolicy(gate.parseYaml(policyText(), 'real'))
  const managed = [...P.modules.values()].filter((m) => m.managed).map((m) => m.id)
  assert.ok(
    managed.length >= 1,
    '真表 managed:true 为 0 ⇒ 门 103 的 D1/D2/D3 三条判据没有对象可审,这道门只剩表格自检(C1/T1)。' +
      '收口一旦合法回退,请连同本条判据一起改并写明理由,别让它悄悄恒红或悄悄恒绿。',
  )
  // 反向对照:把全表 true 抹回 false,上面那条必须会红 ⇒ 证明它不是恒真断言
  const zero = policyText().replace(/^    managed: true$/gm, '    managed: false')
  const n0 = [...gate.loadPolicy(gate.parseYaml(zero, 'mutant')).modules.values()].filter((m) => m.managed).length
  assert.equal(n0, 0, '变异没能把 managed 清零 ⇒ 上面那条断言恒真,本文件在装样子')
})

test('T9 降级阶梯本身固定(三处皆无时判"无法判定",不得冒绿)', () => {
  assert.equal(gate.pickPolicySource([['HEAD', null], ['索引', 'x'], ['工作树', 'y']]).label, '索引')
  assert.equal(gate.pickPolicySource([['HEAD', 'h'], ['索引', 'x']]).label, 'HEAD')
  assert.equal(gate.pickPolicySource([['HEAD', ''], ['索引', null], ['工作树', ' w']]).label, '工作树')
  assert.equal(gate.pickPolicySource([['HEAD', null], ['索引', null], ['工作树', undefined]]), null)
})

test('T12 取材面按档定向:--staged 选索引表、全量选 HEAD 表(否则"改表那枚提交"脱离本门审查)', () => {
  // 这一条是 2026-09-25 实测缺陷的装车证明。当时的形态是两个面都 HEAD 优先,后果不是
  // "少读一份表",而是本门对**修改策略表自身的提交**全程盲视:往索引版 apps/cli.requires
  // 注入一条 `apps/api`(端应用 exported:false,T1 必判红),全量与 --staged 双双 exit 0。
  // 现场复现(不需临时仓,ROOT 由脚本自身位置推导、不可注入,故用"索引≠HEAD"的构造面):
  const faces = { HEAD: 'HEAD那份旧表', 索引: '索引里将要落地的新表', 工作树: '工作树副本' }
  const pickOn = (isStaged) => gate.pickPolicySource(gate.policyFaceOrder(isStaged).map((l) => [l, faces[l]]))
  assert.equal(pickOn(true).label, '索引', '--staged 没选索引表 ⇒ pre-commit 审的是 HEAD 旧表,改表不被审(即 09-25 的缺陷形态)')
  assert.equal(pickOn(false).label, 'HEAD', '全量档必须判 HEAD,与"全量判 HEAD blob"的仓库口径同向')
  // 夹具自证(反恒真):按**被废掉的旧顺序**组装候选,必然选到 HEAD。
  // 若这里选到的不是 HEAD,说明 faces 三档取值写错 ⇒ 上面两条断言根本区分不出顺序。
  const legacy = gate.pickPolicySource(['HEAD', '索引', '工作树'].map((l) => [l, faces[l]]))
  assert.equal(legacy.label, 'HEAD', '夹具失效:旧顺序都没选中 HEAD,则上面那两条"有牙"的证明不成立')
  // 真仓侧钉的是**这一条设计**:两档都不得把 E1/E2 判成红(见 assertNoDeclaredReds 的注释)。
  // 旧写法在这里钉的是"两档都必须 exit 0",那把仓库瞬时状态当恒定前提 —— 真仓 HEAD 挂着
  // 与本片无关的 D1/D2 存量红时它会恒红,而红点把人推向 --no-verify。
  // **同样刻意不钉"两档结论是否同形"** —— 上一版在这里写了
  // `索引表≠HEAD 表 ⇒ 两档收口集合必须异形 / 相同 ⇒ 必须同形` 的条件断言,两条前提都不成立:
  //   ① "表不同"涵盖改注释、改 requires、改阈值等绝大多数形态,它们**不改变** managed 集合,
  //      于是"异形"那一支会在完全正常的改表面误红(实测:本仓此刻正落此支,该断言判红);
  //   ② 而"同形"那一支在尺子为 /[^\\n]*/ 时恒红(见 managedOf 定义处注释)。
  // 一条在任何一种现实下都可能红的判据,结局只会是逼人 --no-verify(§12e 同型),已删。
  // 顺序本身的证明全部交给上面的 pickOn()/legacy 构造面 —— 它们可判定、可变异、不依赖仓库瞬时状态。
  const staged = runCLI(['--staged'])
  const full = runCLI([])
  assertNoDeclaredReds(staged.out, '--staged')
  assertNoDeclaredReds(full.out, '全量')
  assert.doesNotMatch(staged.out, /扫描 0 文件/, '--staged 档扫到 0 文件却继续给结论')
})

/**
 * T12b —— 给 T12 那把尺子配反例。
 * T12 的两个分支都只比 `managedOf` 的返回值,所以尺子一旦把"随行变化的计数"当成"收口集合",
 * 就会出现**两支同时失效**:else 支恒红(脏工作树里必然红)、differs 支恒真(永远抓不到读串面)。
 * 本条不依赖仓内任何状态,纯测尺子本身,是 T12 有意义的前提。
 */
test('T12b managedOf 尺子本身:计数不同不得算异形、集合不同必须算异形、取不到给空串', () => {
  // 这条尺子反例是**独立价值**,与被审对象无关:任何将来拿"两档 managed 集合"做比较的判据
  // 都必须先用它自证 —— 停在 `[^\n]*` 会把同行尾部"扫描 N 文件/跨模块边"一起吃进来,
  // 于是同一把尺子在两个口径下永远不等(既测不出真差异,也注定误红)。
  const a = '[arch-policy] 模块 24 个 | managed:true packages/api-client, packages/dom-actions | 扫描 9 文件 | 跨模块边 6 条'
  const b = '[arch-policy] 模块 24 个 | managed:true packages/api-client, packages/dom-actions | 扫描 8077 文件 | 跨模块边 52 条'
  const c = '[arch-policy] 模块 24 个 | managed:true packages/api-client | 扫描 8077 文件 | 跨模块边 52 条'
  assert.equal(managedOf(a), managedOf(b), '同集合不同计数必须视为同形(否则任何按集合比较的判据恒红)')
  assert.notEqual(managedOf(b), managedOf(c), '集合真的变了却判同形 ⇒ 该判据恒真(无牙)')
  assert.equal(managedOf('全绿但没打 managed 行'), '', '取不到时给空串,不得抛')
  // 反向对照:把尺子退回吞到行尾的旧写法,上面第一条必须红(证明"停在 | 前"在承重)
  const naive = (t) => /managed:true ([^\n]*)/.exec(t)?.[1]?.trim() ?? ''
  assert.notEqual(naive(a), naive(b), '尺子变异未生效 ⇒ 第一条断言恒真,本文件在装样子')
})

test('T10 解析器坏了必须大声失败,不得静默少读模块', () => {
  const good = gate.parseYaml(policyText(), 'p')
  assert.ok(good.modules.length >= 10)
  assert.throws(() => gate.parseYaml(policyText().replace('\n    roots:\n', '\n\t  roots:\n'), 'p'), /Tab|缩进/)
  assert.throws(() => gate.parseYaml(policyText().replace("      - 'packages/types'\n", "      - 'packages/types\n"), 'p'), /引号/)
  assert.throws(() => gate.loadPolicy(gate.parseYaml(policyText().replace(/^modules:$/m, 'modulesX:'), 'p')), /modules/)
})

// ── 缺陷 3(2026-09-25 补):逐块降回 managed:false 必须被机器发现 ──────────────────────
//
// 表头原文写的是"T11 只钉『≥1 块』不变量,所以这道回退**没有机器守卫**"。独立复核量到三种形态:
//   · 回退 23 块中任一块 ⇒ 全链无任何测试变红(敞口是真实的,不是猜的);
//   · 回退 `packages/i18n` ⇒ T8 会变红,但那是因为 T8 自己的构造正则从 `- id: 'packages/i18n'`
//     起锚、非贪婪爬到**下一块**的 `managed: true`,是巧合不是守卫(换一块就看不见);
//   · 全表清零 ⇒ T11 红(这条才是真守卫,但只覆盖"清零"一型)。
// 下面 T13 把"逐块降回"做成判据,且刻意**不钉死某一块必须为 true**:
// 合法回退(降回 false 的同时在 MANAGED_FALSE_LEDGER 登记理由)不红,未登记的降回一定红 ——
// 这正是 T11 当初"不钉具体条目"想保住的东西,二者不冲突。

/**
 * 「允许处于 managed:false 的块 → 理由」显式清单(唯一一份,可读、可核、可 diff)。
 * 理由不是装饰:登记一条豁免必须说清"为什么按住",否则清单就成了消红入口。
 */
const MANAGED_FALSE_LEDGER = {
  'packages/types':
    '带 EX-C2-1 存量债(packages/types/src/app.ts HEAD 实测 5258 行 > 契约上限 2000);表内 reason 原文:"按业务域拆成多入口前,不得把该模块翻 managed:true" ⇒ 拆完之前按住是**制度**,不是遗漏',
}

/** 表里 managed:false 的块(升序)。判据只此一份实现,不在第二个测试里重抄(§22c)。 */
function heldBackIds(text) {
  return [...gate.loadPolicy(gate.parseYaml(text, 'held')).modules.values()].filter((m) => !m.managed).map((m) => m.id).sort()
}

/** 把**某一个块**的 managed 翻成指定值;块内定位,禁止跨块命中(T8 那一型巧合正是跨块命中造的)。 */
function flipManaged(text, id, to) {
  const start = text.indexOf(`  - id: '${id}'\n`)
  if (start < 0) throw new Error(`策略表里没有块 ${id}`)
  const next = text.indexOf('\n  - id: ', start + 1)
  const end = next < 0 ? text.length : next
  const block = text.slice(start, end)
  const re = /^ {4}managed: (?:true|false)$/m
  if (!re.test(block)) throw new Error(`块 ${id} 内没有 managed 行 ⇒ 翻转夹具没作用到被测面`)
  const flipped = text.slice(0, start) + block.replace(re, `    managed: ${to}`) + text.slice(end)
  return flipped === text ? null : flipped
}

/** 判据本体:表里按住集合 vs 已登记理由清单,三类问题双向都必须是空。 */
function ledgerProblems(held, ledger) {
  return {
    unregistered: held.filter((id) => !(id in ledger)),
    stale: Object.keys(ledger).filter((id) => !held.includes(id)).sort(),
    noReason: Object.entries(ledger)
      .filter(([, r]) => typeof r !== 'string' || r.trim().length < 12)
      .map(([id]) => id)
      .sort(),
  }
}

test('T13 逐块降回 managed:false 必须被机器发现(补表头那句"没有机器守卫")', () => {
  const real = policyText()
  const P = gate.loadPolicy(gate.parseYaml(real, 'real'))
  const ids = [...P.modules.keys()]
  const held = heldBackIds(real)
  const managedIds = ids.filter((id) => P.modules.get(id).managed)

  // A 正断言(真表):未登记的降回 / 过期登记 / 无理由登记,三类都不得存在
  const p = ledgerProblems(held, MANAGED_FALSE_LEDGER)
  assert.deepEqual(p.unregistered, [], `有块被降回 false 却没人登记理由:${p.unregistered.join(',')} —— 回退消红正是表头禁止的那件事`)
  assert.deepEqual(p.stale, [], `登记清单里的块已不在按住集(清单腐烂):${p.stale.join(',')}`)
  assert.deepEqual(p.noReason, [], `每条豁免必须带 ≥12 字的理由:${p.noReason.join(',') || '(无)'}`)
  // B 夹具自证:清单里每个 id 必须真在表里存在(否则本条在守一个不存在之物)
  for (const id of Object.keys(MANAGED_FALSE_LEDGER)) assert.ok(P.modules.has(id), `豁免清单指向未登记的块 ${id}`)
  assert.ok(managedIds.length >= 1, '真表一个 managed:true 都没有 ⇒ T11 也会红,本条无从变异')

  // C 变异自证(逐块):**每一块**降回 false 而不登记,都必须被同一把尺子抓住
  const caught = []
  for (const id of managedIds) {
    const flipped = flipManaged(real, id, 'false')
    assert.ok(flipped, `翻转夹具对 ${id} 没生效 ⇒ 变异根本没作用到被测面`)
    const got = heldBackIds(flipped)
    assert.deepEqual(got, [...held, id].sort(), `翻转 ${id} 后按住集合不是"原集合+它" ⇒ 夹具跨块命中了(T8 那一型巧合)`)
    const probs = ledgerProblems(got, MANAGED_FALSE_LEDGER)
    assert.deepEqual(probs.unregistered, [id], `降回 ${id} 却没登记理由,判据必须点名它,实得 ${JSON.stringify(probs.unregistered)}`)
    caught.push(id)
  }
  assert.equal(caught.length, managedIds.length, '逐块变异没跑满 ⇒ 本条只测了第一块,其余块仍是敞口')

  // D 反向对照:合法回退(降回 + 同时登记理由)必须**不红** —— 不得把守卫做成"钉死某一块"
  const demo = managedIds[0]
  const legit = flipManaged(real, demo, 'false')
  const ledger2 = { ...MANAGED_FALSE_LEDGER, [demo]: '自检夹具:模拟"已登记理由的合法回退",理由须 ≥12 字才生效' }
  const p2 = ledgerProblems(heldBackIds(legit), ledger2)
  assert.deepEqual([p2.unregistered, p2.stale, p2.noReason], [[], [], []], `合法回退不该红,实得 ${JSON.stringify(p2)}`)

  // E 尺子自证:翻转只动一块(证明 C 的"逐块"不是靠整表重排蒙过去的)
  const once = heldBackIds(flipManaged(real, demo, 'false'))
  assert.equal(once.length, held.length + 1, '按住集合只该多一块')
  assert.equal(heldBackIds(real).length, held.length, '翻转不得改变真表读数')

  // F 与 T11 的分工:T11 只覆盖"清零",本条必须比它宽 —— 清零时两条都要红
  const zero = real.replace(/^ {4}managed: true$/gm, '    managed: false')
  assert.equal([...gate.loadPolicy(gate.parseYaml(zero, 'zero')).modules.values()].filter((m) => m.managed).length, 0, '清零变异没生效')
  assert.ok(ledgerProblems(heldBackIds(zero), MANAGED_FALSE_LEDGER).unregistered.length > 0, '全表清零时本条也必须抓得住')
})

test('T14 空暂存必须回退全量(缺陷 1):"扫描 0 文件却记绿"这一型不得存在', () => {
  // 判据本体用**纯函数 + 构造面**:仓库此刻有没有人暂存源文件是瞬时状态,
  // 拿它当前提会重演 T8 / T12 的教训(判据生命周期短于它所守的那枚提交)。
  const srcAll = ['apps/web/src/a.ts', 'packages/shared/src/b.ts']
  const narrow = gate.planStagedScope(srcAll, new Set(['packages/shared/src/b.ts']))
  assert.equal(narrow.mode, 'staged')
  assert.deepEqual(narrow.paths, ['packages/shared/src/b.ts'], '暂存面有源文件时必须只咬暂存集(窄口径不得被顺手放大)')
  const empty = gate.planStagedScope(srcAll, new Set())
  assert.equal(empty.mode, 'full', '暂存集为空 ⇒ 必须回退全量;判成 staged 就是"审 0 个文件却记绿"(守门 70 同型)')
  assert.equal(empty.paths.length, 0, '回退态不得把空集当结果交出去,否则 main 照跑 analyze')
  const onlyDocs = gate.planStagedScope(srcAll, new Set(['README.md']))
  assert.equal(onlyDocs.mode, 'full', '暂存的全是非源文件 ⇒ 同样算空,同样回退')
  // 变异自证:旧实现等价于"永远按暂存集收窄",同一把尺子必须量到它扫 0 个
  const legacy = (all, staged) => all.filter((p) => staged.has(p))
  assert.equal(legacy(srcAll, new Set()).length, 0, '夹具失效:旧形态都没产出 0 文件,上面那条断言就是恒真')
  // CLI 面:两种档都不得出现"扫描 0 文件",且都不得因 E1/E2 判红(尺子口径见 assertNoDeclaredReds)
  for (const args of [[], ['--staged']]) {
    const r = runCLI(args)
    assertNoDeclaredReds(r.out, args.join(' ') || '全量')
    assert.doesNotMatch(r.out, /扫描 0 文件/, `档[${args.join(' ') || '全量'}] 扫到 0 文件却打 ✅ ⇒ 依赖面(D1/D2/D3/D4/C2/C3)没审任何东西`)
  }
  // 若当次实测确实走了回退,口径行必须如实说明(不得静默换面)
  const s = runCLI(['--staged'])
  if (/暂存集为空/.test(s.out)) {
    assert.match(s.out, /回退全量/, '回退必须写在取材口径行里,不能只换个数字')
    assert.match(s.out, /守门 70 同型/, '回退理由必须可见,否则下一个人会以为是 bug')
  }
})

test('T15 取材面提示语必须按 oid 实测(缺陷 2):"读了索引"不得被报成"表没入库"', () => {
  // 纯函数面:四种形态成对
  assert.equal(gate.policyFaceNotice('HEAD', { HEAD: 'a', 索引: 'b' }), null, '全量档取 HEAD 不该有任何提示')
  assert.equal(gate.policyFaceNotice('索引', { HEAD: 'a', 索引: 'a' }), null, '索引==HEAD 还喊"尚未入库",就是 2026-09-25 的误报形态')
  assert.equal(gate.policyFaceNotice('索引', { HEAD: 'a', 索引: 'b' })?.level, 'info', '真不等才提示;--staged 读索引是正常行为 ⇒ 只许 info,不得升成警告')
  assert.equal(gate.policyFaceNotice('索引', { HEAD: null, 索引: 'b' })?.level, 'warn', '只有 HEAD 真的没有这张表才配 warn')
  assert.equal(gate.policyFaceNotice('工作树', { HEAD: null, 索引: null })?.level, 'warn', '退到工作树必须大声说')
  // 变异自证:旧写法"只要不是 HEAD 就喊未入库",在"索引==HEAD"这一格必然产出话
  const legacy = (label) => (label !== 'HEAD' ? { level: 'warn', msg: `${gate.POLICY_REL} 尚未入库` } : null)
  assert.ok(legacy('索引')?.msg.includes('尚未入库'), '夹具失效:旧写法都不产话,上面的"安静"断言就是恒真')
  assert.ok(gate.policyFaceNotice('索引', { HEAD: 'a', 索引: 'a' }) === null && legacy('索引') !== null, '新判据必须恰好在旧写法开口的那一格保持安静')
  // CLI 面:按当次实测 oid 分档 —— "尚未入库"只允许出现在 HEAD 真无此表时
  const oid = (spec) => {
    try {
      return gitRaw(['rev-parse', '--verify', '-q', spec], REPO, { timeout: 60000 }).trim() || null
    } catch {
      return null
    }
  }
  const head = oid(`HEAD:${gate.POLICY_REL}`)
  const index = oid(`:${gate.POLICY_REL}`)
  assert.ok(head || index, '夹具自证:两个面都取不到 oid ⇒ git 问法失效,下面的条件断言会恒真')
  const out = runCLI(['--staged']).out
  if (head && index && head === index) assert.doesNotMatch(out, /策略表取自|尚未入库/, `实测索引==HEAD(${head.slice(0, 8)})仍被提示 ⇒ 就是那条误报`)
  else if (head) assert.doesNotMatch(out, /尚未入库/, '表已入库(HEAD 有它),不得再说"尚未入库"')
  else assert.match(out, /尚未入库/, 'HEAD 真没有这张表时必须喊出来')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
