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
// 存活期表的唯一真相源住在守门 108:`isFamilyRegistered` / `FAMILY_LIFETIME_DAYS` 就是它判 E4 用的那把尺子。
// 本文件只问这两个出口,不复制天数表、也不在此手抄族名(§22c:不留第二份真相)。
import { __test__ as expiry } from '../check-exemption-expiry.mjs'

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
/**
 * 从注册表里取出「本门那一条注册项」的原文 —— 不是复制门 191 的判据(它判的是"测试有没有抄门体的
 * 形态清单",与注册形状无关),而是一条**装车证明**必需的取段。刻意按大括号配对取整条,不取
 * 「脚本名前后各 N 字符」的窗口:窗口会跨进邻门,于是"别人有 blocking"会被读成"我有"(本仓记过同型)。
 */
function runnerEntryOf(text, scriptName) {
  const key = `script: '${scriptName}'`
  const at = text.indexOf(key)
  if (at < 0) return null
  // ① 向左找未被闭合的 `{`(遇到 `}` 记一层深度,深度非零时的 `{` 只是别人的收尾)
  let depth = 0
  let open = -1
  for (let i = at - 1; i >= 0; i--) {
    const c = text[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) {
        open = i
        break
      }
      depth--
    }
  }
  if (open < 0) return null
  // ② 从 open 向右配平;跳过引号内内容(标签里带括号与路径,按裸字符数会提前闭合)
  let d2 = 0
  let quote = null
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      continue
    }
    if (c === '{') d2++
    else if (c === '}') {
      d2--
      if (d2 === 0) return text.slice(open, i + 1)
    }
  }
  return null
}

test('T1 装车证明 + 摘线方向锁:头注称"已入提交链"就必须真在 runner 里,且定级成套(摘线而声称不变 ⇒ 本断言必读红)', () => {
  assert.match(gateSrc, /接线现状\(2026-10-06 已入提交链\)/, '头注必须如实交代接线现状')
  assert.doesNotMatch(gateSrc, /尚未接线/, 'runner 已登记本门,头注里不得再留"尚未接线"(文档与实际分叉 = 守门 89 R1/R2 那一型)')
  const entry = runnerEntryOf(runnerSrc, 'check-test-judge-not-replicated.mjs')
  assert.ok(entry, 'runner 里没有本门的注册项 ⇒ 头注那句"已入提交链"是空头支票(谎称已接线比零命中的假绿门更坏)')
  // 取段必须是**本门那一条**,不是"脚本名附近一段文本":下面两条把窗口式取法当场否掉 ——
  // 条目里出现第二条 `script:` 或邻门的 script 名,说明括号配平失败了(或被人改回了窗口式)。
  assert.equal(
    (entry.match(/script:\s*'/g) || []).length,
    1,
    '取出的条目里有不止一条 script: ⇒ 取段跨进了邻门,别人的定级会被算成我的(本仓记过同型)',
  )
  assert.doesNotMatch(entry, /check-registry-worktree-superset/, '邻门(注册表工作树超集对账)的 script 名出现在本条目内 = 窗口式取段,别人有 blocking 会被读成我有')
  assert.match(entry, /mode:\s*'warn'/, "定级必须是 warn —— 真仓 HEAD 面现读命中不为 0,当场 blocking 就是与任何提交无关的恒红门(§12e)")
  assert.match(
    entry,
    /skipEnv:\s*'HUSKY_SKIP_TEST_JUDGE_REPLICATED'/,
    '应急跳过变量必须随条目成套,否则文档承诺的出路根本没人读(守门 172 那一型)',
  )
  assert.match(
    entry,
    /stagedTriggers:\s*\[[^\]]*'scripts\/check-'[^\]]*'scripts\/tests\/'[^\]]*\]/,
    '触发面必须同时含门体面与测试面 —— 只改测试文件的提交不唤起本门,等于判据存在而永不调用(守门 81 教训)',
  )
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

/**
 * T10 跨文件锁:门体声明的行内豁免族必须进守门 108 的 `FAMILY_LIFETIME_DAYS`(原型 = 门 157 镜像测试的
 * T10)。两侧都不在本文件手抄:族名现取自门体自己的 `EXEMPT_MARK`,登记与否/天数现取自 108 自己的
 * `isFamilyRegistered` / `FAMILY_LIFETIME_DAYS` —— 那对函数与那张表就是 108 判 E4 用的同一把尺子,
 * 在测试里再抄一份"什么算已登记"正是 §22c 要杀的第二份真相(也正因为判据是"问结构"而不是"读文本",
 * 本锁不必、也不该自己去拼 git/磁盘取被审内容 —— 取材面纪律在此格没有可站错的尺子)。
 * 不登记的实际代价不是"少一个到期日",而是走 90 天默认档,且第一处真被写出的行内豁免会被 108 的 E4
 * 判成"新引入的未登记豁免族" —— 一道门自己的合法出口被邻居钉红(radius-role / border-ink /
 * credential-presence 都记过同一课)。
 */
test('T10 跨文件锁:本门的行内豁免族必须进守门 108 的存活期表(30 天,待偿的收口债)', () => {
  const fam = String(gate.EXEMPT_MARK.source)
    .split(':')[0]
    .trim()
  assert.ok(fam.length >= 3 && fam.includes('-'), `门体里读不出豁免族名 ⇒ 本锁空转(锁必须问结构,不接受"看着像")`)
  assert.ok(
    expiry.isFamilyRegistered(fam),
    `${fam} 不在 FAMILY_LIFETIME_DAYS 里 ⇒ 它只出生不死亡,且第一处行内豁免会被守门 108 的 E4 判成"新引入的未登记族"`,
  )
  assert.equal(
    expiry.FAMILY_LIFETIME_DAYS[fam],
    30,
    `${fam} 豁免的是"测试里复制了源判据"这笔待偿的收口债(出路 = 判据从门体导出、测试改调生产入口),取 30 天;改档要去 108 表旁写理由,不得就地放宽`,
  )
  assert.notEqual(
    expiry.FAMILY_LIFETIME_DAYS[fam],
    expiry.DEFAULT_LIFETIME_DAYS,
    '靠默认值兜底不算登记 —— 那正是 E4 要判的形态',
  )
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
