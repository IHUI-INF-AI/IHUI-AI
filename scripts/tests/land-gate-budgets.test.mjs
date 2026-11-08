// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落地后置复跑「按臂预算」的镜像锁(2026-11-06 立)。
 *
 * 钉的是三件事,每件都有成对反例:
 *  ① 缺省预算**不许**因为某一道门慢就被整体抬高(那让 26 臂陪等);
 *  ② 登记的预算必须带实测出处(`measuredMs` + `note`),缺一项就剔该行 —— 下一人无从复核的数字不算证据;
 *  ③ 超时/被杀必须把"跑了多久 / 预算多少"打进读数,否则"偶发争用"与"恒定超预算"长得一模一样。
 * §22c:判据 import 源模块,本文件不复算。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseGateBudgets, resolveGateBudget } from '../lib/land-gate-rerun.mjs'
import { decideGateOutcome } from '../lib/gate-failure-kind.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LIB = join(ROOT, 'scripts/lib/land-gate-rerun.mjs')
const EXECUTOR = join(ROOT, 'scripts/lib/guardian-executor.mjs')
const LANDER = join(ROOT, 'scripts/object-space-land.mjs')
const TABLE = join(ROOT, 'scripts/data/land-gate-budgets.json')
const DEF = 300000

test('① 表解析:好条目生效,坏条目只剔该行,整表坏则不作数', () => {
  const ok = parseGateBudgets(
    JSON.stringify({
      gates: [
        { script: 'a.mjs', timeoutMs: 900000, measuredMs: 506000, note: '静默态实测' },
        { script: 'b.mjs', timeoutMs: 0, measuredMs: 1, note: 'x' },
        { script: 'c.mjs', timeoutMs: 5000 },
        { script: 'd.txt', timeoutMs: 5000, measuredMs: 1, note: 'x' },
      ],
    }),
  )
  assert.equal(ok.ok, true)
  assert.equal(ok.byScript.get('a.mjs'), 900000)
  assert.equal(ok.byScript.has('b.mjs'), false, 'timeoutMs 非正数必须剔行')
  assert.equal(ok.byScript.has('d.txt'), false, 'script 必须是带扩展名的文件名')
  assert.ok(
    ok.problems.some((p) => /measuredMs/.test(p)),
    '缺实测出处的条目不能算登记过:' + JSON.stringify(ok.problems),
  )
  assert.equal(parseGateBudgets('{坏').ok, false)
  assert.equal(parseGateBudgets(JSON.stringify({ gates: 'x' })).ok, false, 'gates 必须是数组')
  assert.equal(parseGateBudgets(null).ok, false)
})

test('② 解析序:env 全局抬 > 登记表 > 缺省;路径含反斜杠也要认出文件名', () => {
  // 登记表档直接吃真实仓的表(现读),env 档用内存覆盖 —— 不复制判据,只喂不同输入(§22c)
  const row30a = JSON.parse(readFileSync(TABLE, 'utf8')).gates.find(
    (g) => g.script === 'check-commit-loss-guard.mjs',
  ).timeoutMs
  assert.equal(
    resolveGateBudget('scripts/check-commit-loss-guard.mjs', { root: ROOT, env: {}, reload: true }),
    row30a,
    '登记表命中必须生效(门 30a 现读 176–255s,预算按表)',
  )
  assert.equal(
    resolveGateBudget('D:\\IHUI-AI\\scripts\\check-commit-loss-guard.mjs', {
      root: ROOT,
      env: {},
      reload: true,
    }),
    row30a,
    'Windows 反斜杠路径同样要认出末位文件名(写死 / 分隔在 Windows 上恒不命中)',
  )
  assert.equal(
    resolveGateBudget('scripts/check-tailwind-class-conflict.mjs', {
      root: ROOT,
      env: {},
      reload: true,
    }),
    DEF,
    '未被登记的臂必须走缺省 —— 为一臂抬高全局就是让 26 臂陪等',
  )
  assert.equal(
    resolveGateBudget('scripts/check-commit-loss-guard.mjs', {
      root: ROOT,
      env: { IHUI_LAND_GATE_TIMEOUT_MS: '1200000' },
      reload: true,
    }),
    1200000,
    'env 全局抬用于人工取证,优先级高于表',
  )
  assert.equal(
    resolveGateBudget('scripts/x.mjs', {
      root: ROOT,
      env: { IHUI_LAND_GATE_TIMEOUT_MS: '0' },
      reload: true,
    }),
    DEF,
    '坏 env 值(0)不得把预算变成 0 —— 那会把每一臂当场掐死',
  )
  assert.equal(
    resolveGateBudget('', { root: ROOT, env: {}, reload: true }),
    DEF,
    '取不出文件名 ⇒ 缺省,不猜',
  )
})

test('③ 表不在位 ⇒ 全按缺省并出声,绝不读成"预算无限"', () => {
  const r = resolveGateBudget('scripts/check-commit-loss-guard.mjs', {
    root: join(ROOT, '.ihui-agent/tmp/gate-budget-nope'),
    env: {},
    reload: true,
  })
  assert.equal(r, DEF, '仓里没有这本表时行为必须与改前逐字相同')
})

test('④ 覆盖面自证:真实表里每一行都带实测出处,且没有一行低于其 measuredMs', () => {
  const j = JSON.parse(readFileSync(TABLE, 'utf8'))
  assert.ok(Array.isArray(j.gates) && j.gates.length > 0, '表必须至少登记一行(否则这本表是空形)')
  for (const g of j.gates) {
    assert.ok(Number.isFinite(g.measuredMs) && g.measuredMs > 0, g.script + ' 缺 measuredMs')
    assert.ok(
      typeof g.note === 'string' && g.note.length >= 10,
      g.script + ' 的 note 必须能独立读懂',
    )
    assert.ok(
      g.timeoutMs >= g.measuredMs,
      `${g.script}:预算 ${g.timeoutMs} 不得低于实测 ${g.measuredMs}(那是当场掐死)`,
    )
    assert.ok(
      g.timeoutMs <= g.measuredMs * 3,
      `${g.script}:预算超过实测 3 倍 ⇒ 应为"让它更快"而不是"多等"`,
    )
  }
})

test('⑤ 形状锁:三处调用点都必须走按臂解析,读数必须带耗时', () => {
  const src = readFileSync(LIB, 'utf8')
  assert.match(src, /timeout: budget,/, 'spawnGate 的 timeout 必须用解析出来的按臂预算')
  assert.match(src, /t\.timeoutMs \?\? resolveGateBudget\(t\.script/)
  assert.match(src, /timeoutMs: resolveGateBudget\(b\.scriptPath/)
  assert.match(src, /resolveGateBudget\(markerGate/)
  assert.match(src, /rc: 'killed', out, elapsedMs, budgetMs: budget/, '被杀那一支也必须带耗时')
  assert.match(src, /whyExtra/, '未判定读数要带"实测多久撞多少预算"')
  assert.doesNotMatch(
    src,
    /timeoutMs: GATE_TIMEOUT_MS/,
    '并发批计划层不得再交全局缺省(那正是按臂登记这一格要替掉的位置)',
  )
  const lander = readFileSync(LANDER, 'utf8')
  assert.ok(lander.length > 1000, '落地器在场(形状锁读的是真文件)')
})

test('⑥ 执行器接线锁(DG-01):看门狗必须按门查同一张登记表,30a 不得再被 300s 掐死', () => {
  const src = readFileSync(EXECUTOR, 'utf8')
  assert.match(
    src,
    /resolveGateBudget\(check\.script, \{ env: \{\} \}\)/,
    '执行器必须按门查登记表(且不吃落地器专用 env,避免两套旋钮互相串味)',
  )
  assert.ok(
    (src.match(/gateTimeoutFor\(check\)/g) ?? []).length >= 2,
    '并行与串行两档都必须走 gateTimeoutFor(check),不能只修一档',
  )
  assert.doesNotMatch(
    src,
    /const gateTimeoutMs = Number\(process\.env\.GUARDIAN_GATE_TIMEOUT_MS \?\? 300_000\)/,
    '旧的全局 300s 常量必须已撤掉,否则 30a 仍会在全量腿被恒杀',
  )
  // 行为面:30a 现读预算必须严格大于旧缺省,否则"引入即拦"这条没落地。
  assert.ok(
    resolveGateBudget('scripts/check-commit-loss-guard.mjs', {
      root: ROOT,
      env: {},
      reload: true,
    }) > DEF,
    '门 30a 的预算必须 > 300s(实测 176–255s,仍高于缺省)',
  )
})

test('⑦ 缺省只写一处(DG-06):表 defaultTimeoutMs 必须被解析并生效;看门狗不得自带第二个 300s', () => {
  const parsed = parseGateBudgets(JSON.stringify({ defaultTimeoutMs: 420000, gates: [] }))
  assert.equal(parsed.ok, true)
  assert.equal(parsed.defaultMs, 420000, 'defaultTimeoutMs 未解析 ⇒ 缺省仍是散落的字面量')

  const dir = mkdtempSync(join(tmpdir(), 'ihui-gate-budget-'))
  mkdirSync(join(dir, 'scripts/data'), { recursive: true })
  writeFileSync(
    join(dir, 'scripts/data/land-gate-budgets.json'),
    JSON.stringify({ defaultTimeoutMs: 420000, gates: [] }),
  )
  assert.equal(
    resolveGateBudget('scripts/x.mjs', { root: dir, env: {}, reload: true }),
    420000,
    '未被登记的臂必须取表里的 defaultTimeoutMs(而不是代码里另写的 300s)',
  )
  assert.equal(
    resolveGateBudget('scripts/x.mjs', {
      root: dir,
      env: { IHUI_LAND_GATE_TIMEOUT_MS_DEFAULT: '180000' },
      reload: true,
    }),
    180000,
    'env 缺省覆盖仍优先于表(排障语义不变)',
  )
  const bad = parseGateBudgets(JSON.stringify({ defaultTimeoutMs: 0, gates: [] }))
  assert.equal(bad.defaultMs, null, '非法 defaultTimeoutMs 不得生效')
  assert.ok(
    bad.problems.some((p) => /defaultTimeoutMs/.test(p)),
    '非法 defaultTimeoutMs 必须出声:' + JSON.stringify(bad.problems),
  )

  const exec = readFileSync(EXECUTOR, 'utf8')
  assert.doesNotMatch(
    exec,
    /GATE_TIMEOUT_DEFAULT_MS\s*=\s*300_000/,
    '执行器不得再自带第二枚 300s 字面量(与表 defaultTimeoutMs 各写一个数)',
  )
  assert.match(
    exec,
    /return resolveGateBudget\(check\.script, \{ env: \{\} \}\)/,
    '看门狗必须只从登记表取预算',
  )
})

test('⑧ 30a 按 2026-11-08 复测收敛预算,超时仍非通过', () => {
  const j = JSON.parse(readFileSync(TABLE, 'utf8'))
  const row = j.gates.find((g) => g.script === 'check-commit-loss-guard.mjs')
  assert.ok(row, '门 30a 必须仍在登记表里')
  assert.ok(
    row.measuredMs <= 255000,
    'measuredMs 必须按 2026-11-08 复测(176–255s)更新,旧 506s 已失效',
  )
  assert.ok(row.timeoutMs >= row.measuredMs * 2, '预算至少留 2 倍余量')
  assert.equal(
    resolveGateBudget('scripts/check-commit-loss-guard.mjs', {
      root: ROOT,
      env: {},
      reload: true,
    }),
    row.timeoutMs,
    '看门狗取到的 30a 预算必须与登记表逐字一致(同一处来源)',
  )
  const exec = readFileSync(EXECUTOR, 'utf8')
  assert.match(
    exec,
    /code:\s*e\?\.code\s*\?\?\s*null/,
    '超时归因必须把 ETIMEDOUT 交给 decideGateOutcome',
  )
  const out = decideGateOutcome({ status: null, signal: null, code: 'ETIMEDOUT', stderr: '' })
  assert.equal(
    out.kind,
    'crash',
    'ETIMEDOUT 按既有分流归 crash(门进程被杀),后果是整批非零;绝不是 pass。' +
      '§0.3 的 undetermined 只属门自己 exit 2 的自述,不可把超时洗成"未判定=不绿"以外的任何绿。',
  )
  assert.notEqual(out.kind, 'pass', '超时绝不许洗成通过')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
