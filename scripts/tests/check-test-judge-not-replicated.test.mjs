// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1058642 的镜像测试(AGENTS §22c):判据本体只有一份 —— 一律经门体导出的 `__test__` 裁定,
 * 本文件**不重写**归一化、切分、角色判定,也不摆一张自己的形态清单(那正是本门要拦的形状)。
 * 本文件里出现的正则只有两类用途:①形状锁(钉门体源码怎么写的,`assert.match(gateSrc, …)`)
 * ②夹具的字符串内容(喂给 gate.audit 的输入数据)。两者都不是"复制被审判据"。
 *
 * 关键取证不靠本文件的颜色,而靠**对象库现取的历史 blob**:
 *   `d10fbebd14^:scripts/tests/clamp-percent-single-source.test.mjs` 那份"测试自带三形态"的反例
 *   (§22c 那笔收口之前的形态)必须被本门判成命中;同一对拿 HEAD 面自比必须不判红。
 *   钉出处不钉 HEAD:数字会随仓腐烂,出处不会。
 *
 * 面的例外(如实交代):本门与本测试在写入时**尚未提交**,所以"自审三查"(T1~T3/S1/S2)读的是
 *   **工作树面**(`readWorktreeFile`,判定面的逃生舱);而阳性对照与 runner 方向锁读的都是 HEAD/对象库,
 *   那两侧才是可复核的证据面。接线之后由主会话把本文件这三个读取点改回 HEAD 面并同笔复核。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { catBatch, readWorktreeFile } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-test-judge-not-replicated.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const GATE_PATH = 'scripts/check-test-judge-not-replicated.mjs'
const SELF_TEST_PATH = 'scripts/tests/check-test-judge-not-replicated.test.mjs'
const RUNNER_PATH = 'scripts/guardian-runner.mjs'

/** 对象库/HEAD 面现取正文:引共用层,不在本文件散写 git 读内容(守门 118 同口径)。 */
function blobAt(spec) {
  const got = catBatch(ROOT, [spec], { timeout: 60_000 })
  const text = got.get(spec)
  assert.equal(typeof text, 'string', `取不到 ${spec} —— 判据无从跑,不许当成"没有违规"`)
  return text
}
function worktreeText(rel) {
  const text = readWorktreeFile(ROOT, rel)
  assert.equal(typeof text, 'string', `工作树取不到 ${rel}`)
  return text
}

const gateSrc = worktreeText(GATE_PATH)
const selfSrc = worktreeText(SELF_TEST_PATH)
const runnerSrc = blobAt(`HEAD:${RUNNER_PATH}`)

// ─── T1~T3 方向锁:头注自述与事实同向 ────────────────────────────────────────
test('T1 头注自述尚未接线,且 runner 里确实没有这一枚(接线时本断言必须翻向)', () => {
  assert.match(gateSrc, /尚未接线/, '头注必须如实交代未接线(谎称已接线 = 零命中的假绿门,守门 89 那一型)')
  assert.equal(/check-test-judge-not-replicated/.test(runnerSrc), false, 'runner 已登记本门 ⇒ 接线这一笔发生了,须同笔把本断言改成"已登记"并复核定级')
})

test('T2 取材面与遮噪的单一实现都写在门体里(引层 + 不散写 git 读正文 + 不再造分词器)', () => {
  assert.match(gateSrc, /from '\.\/lib\/face-reader\.mjs'/, '必须引共用取材层(散写 git 读内容 = 半接线)')
  assert.match(gateSrc, /from '\.\/lib\/code-mask\.mjs'/, '遮噪必须只引 code-mask 那一份')
  assert.match(gateSrc, /catBatch\(root, specs, \{ timeout: 120_000 \}\)/)
  assert.doesNotMatch(gateSrc, /function (maskComments|maskCommentsAndStrings|scanSpans|blankSpans)\b/, '门内不得再写一台遮噪分词器')
  assert.doesNotMatch(gateSrc, /execFileSync\([^)]*cat-file/, '门内不得绕层自起 cat-file')
  assert.match(gateSrc, /if \(picked\.error\) \{\s*\n\s*console\.error\(`❌ \$\{picked\.error\}`\)\s*\n\s*return 2/, '双旗矛盾必须判死')
})

test('T3 定级前言:默认档只报数点名,升 blocking 的前置写真仓 HEAD 面现读 0', () => {
  assert.match(gateSrc, /升 blocking 的前置[\s\S]{0,60}真仓 HEAD 面现读命中 = 0/)
  assert.match(gateSrc, /默认档\(全量\)= 只报数并逐条点名/)
})

// ─── T4~T7 判据形状与出口的形状(全部经门的生产入口裁定) ────────────────────
test('T4 判据导出生效:裁定入口都在门侧,常量值也只有一个来源', () => {
  for (const k of ['audit', 'extractUnits', 'declarationSpans', 'splitAlternatives', 'normalizePattern', 'fragMatch', 'unitRole', 'matcherSites', 'gateIndex', 'candidatesFor', 'isCriterionName']) {
    assert.equal(typeof gate[k], 'function', `gate.${k} 必须存在`)
  }
  assert.equal(gate.MIN_FRAG_LEN, 16, '噪声下限')
  assert.equal(gate.STRONG_FRAG_LEN, 24, '无引用关系时的强同形门槛')
})

const G = 'scripts/check-demo-judge.mjs'
const T = 'scripts/tests/check-demo-judge.test.mjs'
const FORM = String.raw`Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\b`
const DRIFT = String.raw`Math\.min\(\s*100\s*,\s*Math\.max\(\s*0\s*,`
const demoGate = `const PATTERNS = [\n  { why: '内联钳位', re: /${FORM}/ },\n]\nexport const __test__ = {\n  PATTERNS,\n}\n`

test('T5 P1 放过通道:经导出口裁定的合规形状 ⇒ 不红且被点名', () => {
  const ok = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst bad = lines.filter((l) => gate.PATTERNS.some(({ re }) => re.test(l)))\n`
  const res = gate.audit({ [G]: demoGate, [T]: ok })
  assert.equal(res.counts.hits, 0, JSON.stringify(res.items))
  assert.ok(res.items.some((i) => i.state === 'pass' && i.why.includes('P1')))
  // 反向:同样 import 了门,却把材料又写一遍 ⇒ 必须红
  const bad = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst PATTERNS = [/${DRIFT}/]\nPATTERNS.forEach((re) => re.test(line))\nvoid gate\n`
  assert.ok(gate.audit({ [G]: demoGate, [T]: bad }).counts.hits >= 1, 'import 门又重述材料必须命中(通道不能被拿来当挡箭牌)')
})

test('T6 P2 形状锁通道:钉源码写法放行,没有取正文通路则不放行', () => {
  const lock = `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nconst gateSrc = readFileSync('x', 'utf8')\nassert.match(gateSrc, /${FORM}/)\n`
  const r1 = gate.audit({ [G]: demoGate, [T]: lock })
  assert.equal(r1.counts.hits, 0, JSON.stringify(r1.items))
  assert.ok(r1.items.some((i) => i.state === 'pass' && i.why.startsWith('P2')))
  const r2 = gate.audit({ [G]: demoGate, [T]: lock.replace(/import \{ readFileSync \} from 'node:fs'\n/, '').replace(/readFileSync\('x', 'utf8'\)/, "'x'") })
  assert.ok(r2.counts.hits >= 1 || r2.items.every((i) => i.state !== 'pass' || !i.why.startsWith('P2')), '没有取正文的通路就宣称形状锁 ⇒ 不得放过')
})

test('T7 P3 行内出口:原因必填,只救本行', () => {
  assert.equal(gate.EXEMPT_MARK.test('// judge-replica-exempt: 门体尚未导出这一形态'), true)
  assert.equal(gate.EXEMPT_MARK.test('// judge-replica-exempt:'), false, '光有标记没原因不算出口')
  assert.equal(gate.EXEMPT_MARK.test('// 也许将来会有 judge-replica-exempt 这种标记'), false, '散文里提到标记 ≠ 行使标记')
  const head = `import { __test__ as gate } from '../check-demo-judge.mjs'\n`
  const body = (tail) => `${head}const PATTERNS = [/${DRIFT}/] // judge-replica-exempt${tail}\nPATTERNS.forEach((re) => re.test(line))\nvoid gate\n`
  const withReason = gate.audit({ [G]: demoGate, [T]: body(': 先钉住,下一笔改调 gate.PATTERNS') })
  assert.equal(withReason.counts.hits, 0, JSON.stringify(withReason.items))
  assert.ok(withReason.items.some((i) => i.state === 'pass' && i.why.startsWith('P3')), '出口行使过就要点名,静默放行等于没有出口')
  const noReason = gate.audit({ [G]: demoGate, [T]: body(':') })
  assert.ok(noReason.counts.hits >= 1, '缺原因的"豁免"必须照样红')
  const otherLine = gate.audit({ [G]: demoGate, [T]: `${head}const PATTERNS = [/${DRIFT}/]\nPATTERNS.forEach((re) => re.test(line)) // judge-replica-exempt: 写在另一行,救不到清单那一行\nvoid gate\n` })
  assert.ok(otherLine.counts.hits >= 1, '出口只救本行:标记写在别的行上不得放行')
})

test('T8 枚举到 0 候选 ⇒ 判死(Undetermined),不记绿', () => {
  assert.throws(() => gate.audit({ [G]: demoGate }), (e) => /空扫不记绿/.test(e.message), '没有镜像测试可扫不叫通过')
  assert.throws(() => gate.audit({ [T]: 'const PATTERNS = [/x/]' }), (e) => /空扫不记绿|索引为空/.test(e.message))
})

test('T9 三态不并桶:命中+放过+未判定 = 清单长度,且扫描数非 0', () => {
  const res = gate.audit(POSITIVE.pair())
  const c = res.counts
  assert.equal(c.hits + c.passes + c.undetermined, res.items.length, '并桶就是把未判读成已判')
  assert.ok(c.testsScanned >= 1 && c.gatesIndexed >= 1 && c.formCount >= 1, `读数缺失:${JSON.stringify(c)}`)
})

// ─── 阳性对照:历史 blob 现取必命中,同 SHA 自比必不命中 ──────────────────────
const HIST_SPEC = 'd10fbebd14^:scripts/tests/clamp-percent-single-source.test.mjs'
const CLAMP_TEST = 'scripts/tests/clamp-percent-single-source.test.mjs'
const CLAMP_GATE = 'scripts/check-percent-clamp-single-source.mjs'

const POSITIVE = {
  /** d10fbebd14 之前:形态清单写在**测试**里(三形态合成一条大正则),门体另有自己的一张 PATTERNS */
  pair() {
    return { [CLAMP_GATE]: blobAt(`HEAD:${CLAMP_GATE}`), [CLAMP_TEST]: blobAt(HIST_SPEC) }
  },
}

test('PC1 阳性对照(钉出处不钉 HEAD):d10fbebd14^ 那份自带三形态的测试必须被同一判据点名', () => {
  assert.match(blobAt(HIST_SPEC), /INLINE_CLAMP_RE/, '历史 blob 取错了对象:这份才是"测试自带判据"那一版')
  const res = gate.audit(POSITIVE.pair())
  const hits = res.items.filter((i) => i.state === 'hit' && i.test === CLAMP_TEST && i.gate === CLAMP_GATE)
  assert.ok(hits.length >= 1, `历史反例必须命中,现读命中总数 = ${res.counts.hits}`)
  assert.ok(hits.every((i) => i.shape === 'F1'), `必须按 F1(材料同形)命中,实得:${hits.map((i) => i.shape).join(',')}`)
})

test('PC2 同 SHA 自比:收口之后(HEAD 面)这一对不得再被判红,而且要以 P1 的形式被点名放过', () => {
  const res = gate.audit({ [CLAMP_GATE]: blobAt(`HEAD:${CLAMP_GATE}`), [CLAMP_TEST]: blobAt(`HEAD:${CLAMP_TEST}`) })
  const hits = res.items.filter((i) => i.state === 'hit' && i.test === CLAMP_TEST)
  assert.equal(hits.length, 0, `合规形状被判红(假阳):${hits.map((h) => h.why).join(' / ')}`)
  assert.ok(res.items.some((i) => i.state === 'pass' && i.test === CLAMP_TEST && i.why.includes('P1')), '§22c 合规形状必须被记成"经导出口裁定",而不是静默扫过')
})

test('PC3 整面切换:门体也取同一历史面时照样命中(清单与内容同面同轮)', () => {
  const res = gate.audit({ [CLAMP_GATE]: blobAt(`d10fbebd14^:${CLAMP_GATE}`), [CLAMP_TEST]: blobAt(HIST_SPEC) })
  assert.ok(res.items.some((i) => i.state === 'hit' && i.test === CLAMP_TEST))
})

// ─── 对外行为:退出码语义 ────────────────────────────────────────────────────
test('R1 --staged 与 --worktree 同给 ⇒ 退出码 2(两面互斥,取哪一面都是假绿)', () => {
  const r = spawnGate(['--staged', '--worktree'])
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /不得同用/)
})

test('R2 --self-test 的真实退出码 0(全过才叫过)', () => {
  const r = spawnGate(['--self-test'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /--self-test 结果:(\d+)\/\1 通过/)
})

test('R3 全量档(HEAD 面)退出码 0 且末行读数三态分列', () => {
  const r = spawnGate([])
  assert.equal(r.status, 0, r.stderr)
  const m = /三态读数\(不并桶\):命中 = (\d+) · 放过 = (\d+).*· 未判定 = (\d+)/.exec(r.stdout)
  assert.ok(m, `末行读数缺失:${r.stdout.slice(-300)}`)
  assert.ok(Number(m[1]) + Number(m[2]) + Number(m[3]) > 0, '三态全 0 = 尺子没扫到东西,不是干净')
  assert.match(r.stdout, /判定面 = head/)
})

test('R4 --strict 在有命中的面上不出具合格证(退出码 1 或 2,绝不是 0)', () => {
  const r = spawnGate(['--strict'])
  assert.ok(r.status === 1 || r.status === 2, `--strict 期望非 0,实得 ${r.status}:${r.stdout.slice(-200)}`)
})

// ─── 尺子先照自己 ───────────────────────────────────────────────────────────
test('S1 本测试与门体之间零复制:改名绕开 SELF_EXEMPT 后跑真实判定', () => {
  const res = gate.audit({ 'scripts/check-pair-under-test.mjs': gateSrc, 'scripts/tests/pair-under-test.test.mjs': selfSrc })
  const hits = res.items.filter((i) => i.state === 'hit')
  assert.deepEqual(hits.map((i) => `${i.test}:${i.testLine} ${i.why}`), [], '镜像测试复制了门体判据 ⇒ §22c 的反向锁失守')
  assert.ok(res.counts.testsScanned === 1 && res.counts.gatesIndexed === 1, '这一对必须真被扫到,不然零命中只是没扫')
})

test('S2 SELF_EXEMPT 的代价如实可见:只喂本门这一对 ⇒ 空面判死而不是"通过"', () => {
  assert.ok(gate.isSelfExempt(GATE_PATH) && gate.isSelfExempt(SELF_TEST_PATH))
  assert.throws(() => gate.audit({ [GATE_PATH]: gateSrc, [SELF_TEST_PATH]: selfSrc }), (e) => /空扫不记绿/.test(e.message), '自排必须表现为"扫无可扫"的判死,绝不是一条安静的通过')
})

function spawnGate(args) {
  try {
    const stdout = execFileSync(process.execPath, [resolve(ROOT, GATE_PATH), ...args], {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    })
    return { status: 0, stdout, stderr: '' }
  } catch (e) {
    return { status: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') + String(e.message || '') }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
