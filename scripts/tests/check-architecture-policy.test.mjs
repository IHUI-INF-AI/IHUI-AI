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

test('T9 策略表取材阶梯 HEAD→索引→工作树 固定,且三处皆无时判"无法判定"', () => {
  assert.equal(gate.pickPolicySource([['HEAD', null], ['索引', 'x'], ['工作树', 'y']]).label, '索引')
  assert.equal(gate.pickPolicySource([['HEAD', 'h'], ['索引', 'x']]).label, 'HEAD')
  assert.equal(gate.pickPolicySource([['HEAD', ''], ['索引', null], ['工作树', ' w']]).label, '工作树')
  assert.equal(gate.pickPolicySource([['HEAD', null], ['索引', null], ['工作树', undefined]]), null)
})

test('T10 解析器坏了必须大声失败,不得静默少读模块', () => {
  const good = gate.parseYaml(policyText(), 'p')
  assert.ok(good.modules.length >= 10)
  assert.throws(() => gate.parseYaml(policyText().replace('\n    roots:\n', '\n\t  roots:\n'), 'p'), /Tab|缩进/)
  assert.throws(() => gate.parseYaml(policyText().replace("      - 'packages/types'\n", "      - 'packages/types\n"), 'p'), /引号/)
  assert.throws(() => gate.loadPolicy(gate.parseYaml(policyText().replace(/^modules:$/m, 'modulesX:'), 'p')), /modules/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
