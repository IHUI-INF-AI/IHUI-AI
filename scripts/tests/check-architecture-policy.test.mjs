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

test('T6 真仓默认档必须是绿的(这道门不得成为恒红机器)', () => {
  const full = runCLI([])
  assert.equal(full.code, 0, `全量档 exit ${full.code}\n${full.out}`)
  assert.match(full.out, /架构契约门通过|managed:false 的存量违规以报数形式留痕/)
  const staged = runCLI(['--staged'])
  assert.equal(staged.code, 0, `--staged 档 exit ${staged.code}\n${staged.out}`)
})

test('T7 自检必须全绿(成对正反例是判据的唯一证人)', () => {
  const r = runCLI(['--self-test'])
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /全部 \d+ 例通过/)
  assert.doesNotMatch(r.out, /❌/, '自检里出现 ❌ 就说明某条判据已经和实现脱节')
})

test('T8 判据真有牙:同一份代码在 managed:true 下判红、managed:false 下只报数', () => {
  const code = new Map([['packages/i18n/tests/a.test.ts', "import { waiting } from '../../shared/src/chat/waiting-pool'\nexport const a = waiting"]])
  const trialAll = gate.loadPolicy(gate.parseYaml(policyText().replace(/^    managed: false$/gm, '    managed: true'), 'trial'))
  const on = gate.analyze(trialAll, code)
  assert.ok(on.violations.length >= 1, '把 i18n 的穿透导入喂给判据却一条都没报 ⇒ 判据没接上')
  assert.ok(on.red.length >= 1, 'managed:true 的模块违规必须进判红清单')
  const off = gate.analyze(gate.loadPolicy(gate.parseYaml(policyText(), 'off')), code)
  assert.equal(off.red.length, 0, '同一份代码在 managed:false 下必须只报数不判红(渐进收口的定义)')
  assert.ok(off.violations.length >= 1, '只报数不等于不报:存量必须可见')
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
  // 真仓侧只钉"两档都必须绿"。**刻意不钉"两档结论是否同形"** —— 上一版在这里写了
  // `索引表≠HEAD 表 ⇒ 两档收口集合必须异形 / 相同 ⇒ 必须同形` 的条件断言,两条前提都不成立:
  //   ① "表不同"涵盖改注释、改 requires、改阈值等绝大多数形态,它们**不改变** managed 集合,
  //      于是"异形"那一支会在完全正常的改表面误红(实测:本仓此刻正落此支,该断言判红);
  //   ② 而"同形"那一支在尺子为 /[^\\n]*/ 时恒红(见 managedOf 定义处注释)。
  // 一条在任何一种现实下都可能红的判据,结局只会是逼人 --no-verify(§12e 同型),已删。
  // 顺序本身的证明全部交给上面的 pickOn()/legacy 构造面 —— 它们可判定、可变异、不依赖仓库瞬时状态。
  const staged = runCLI(['--staged'])
  const full = runCLI([])
  assert.equal(staged.code, 0, `--staged 必须绿,实得:\n${staged.out.slice(-600)}`)
  assert.equal(full.code, 0, `全量档必须绿,实得:\n${full.out.slice(-600)}`)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
