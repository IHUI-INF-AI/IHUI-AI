#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// git-guardian.auditProdForeignWork 的镜像测试(§22c:直接 import 源实现,不抄第二份判据)。
// 钉七件事:
//   D1 staged ⇒ 持续门槛:首轮只报名不寄信,连满 30 分钟才到人(2026-10-21 改档;
//      改档前"首轮即到人"会把并行会话在飞的 `A ` 新文件读成事故并刷屏)。
//   D2 staged 清零 ⇒ 在飞段起点件即撤,下一批从头起算(不背着旧账到人)。
//   D3 foreign ⇒ 首轮即到人,身份 `prod-foreign;faces=…;tier=…`(§5e-1:不含 blob/时刻/计数)。
//   D4 unjudged / 不可解析 stdout ⇒ notifyEnvUndetermined 持续门槛,首轮绝不冒绿也绝不寄信。
//   D5 duplicate / 尺子没装车:前者不发信(挡 ff 归 auditDeployStall);后者首轮即到人。
//   E1 未判定**逐型点名**:日志与正文都取自尺子的 `undet[]`,旧三合一散文回潮即翻红;
//      标题保持稳定(它进身份去重面,明细只进正文)。
//   E2 "量出来的空"(surface=absent-surveyed)不发信、也不挂未判定牌。
//   E3 邮件正文里的仓根取当次现读值(注入假根 + 源码不得出现写死盘符)。
//   E4 归因取用的三档出口:undet → why → 显式点名"尺子没给归因",绝不回落散文冒判(§0.3)。
//   T1 装车证明:main() 的 `if (!CHECK_ONLY) auditProdForeignWork()` 落在健康分支内、
//      健康早退行之前(挂进 CHECK_ONLY 一侧等于永不执行,本文件踩过两次);startDaemon 双覆盖。
//   T2 摘线必红(方向性对照)+ T3 绝不进提交链(guardian-runner checks 里不得出现尺子)。
// 状态件全部走注入(scratch 目录),绝不碰真 .ihui-agent/state 台账;时间全注入,绝不等真 30 分钟。
// 跑法:node --test scripts/tests/git-guardian-prod-foreign.test.mjs
// =============================================================================
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { auditProdForeignWork, prodForeignAlertDetail, prodForeignUndetText } from '../git-guardian-prod-foreign.mjs'
// E3 用的现读仓根:直接 import 源实现同一枚绑定,不在测试里抄第二份推导(§22c)
import { WORKTREE } from '../git-guardian.mjs'

const GUARDIAN = new URL('../git-guardian.mjs', import.meta.url)
const RUNNER = new URL('../guardian-runner.mjs', import.meta.url)

const T0 = 1_800_000_000_000 // 固定假时钟起点(测试内绝不读真实时间)
const MIN = 60_000

/** 造一份尺子 --json 结论(缺省字段补零,与真尺子同形)。 */
function probeResult(over = {}) {
  const counts = { foreign: 0, duplicate: 0, staged: 0, untracked: 0, unjudged: 0, ...(over.counts || {}) }
  return {
    state: 'clean',
    prodRoot: 'D:/fake-prod',
    counts,
    foreign: [],
    staged: [],
    duplicates: [],
    unjudged: [],
    ...over,
    counts,
  }
}

/** 假执行体:收集 notify/logger 调用,状态件全落 scratch 目录。 */
function harness(scratch, over = {}) {
  const mails = []
  const logs = []
  const base = {
    notify: (name, detail, opts) => mails.push({ name, detail, opts }),
    run: () => ({ code: 0, stdout: JSON.stringify(probeResult()) }),
    logger: (m) => logs.push(m),
    now: T0,
    undetFile: join(scratch, 'undet.json'),
    firstFile: join(scratch, 'first.json'),
    stagedFirstFile: join(scratch, 'staged-first.json'),
    horizonMs: 30 * MIN,
    stagedHorizonMs: 30 * MIN,
  }
  const o = { ...base, ...over }
  return { mails, logs, opts: o, audit: (patch = {}) => auditProdForeignWork({ ...o, ...patch }) }
}

test('D1 staged 首轮只报名不寄信;连满 30 分钟才到人(身份 prod-staged;faces=…;tier=…)', () => {
  const s = mkScratch('gpf-d1-')
  try {
    const dirty = probeResult({
      state: 'dirty',
      counts: { staged: 2 },
      staged: [
        { path: 'b.ts', blob: 'bbbbbbbbbbbb' },
        { path: 'a.ts', blob: 'aaaaaaaaaaaa' },
      ],
    })
    const h = harness(s, { run: () => ({ code: 0, stdout: JSON.stringify(dirty) }) })
    const r1 = h.audit({ now: T0 })
    assert.equal(r1.state, 'dirty')
    assert.equal(h.mails.length, 0, '首轮绝不寄信(在飞工作不是事故)')
    assert.ok(h.logs.some((l) => l.includes('只报名不寄信')), '首轮必须有报名行')
    assert.ok(existsSync(h.opts.stagedFirstFile), '起点件已落册')
    const r2 = h.audit({ now: T0 + 31 * MIN })
    assert.equal(r2.state, 'dirty')
    assert.equal(h.mails.length, 1, '连满 30 分钟 ⇒ 到人')
    const m = h.mails[0]
    assert.equal(m.opts.severity, 'critical')
    assert.equal(m.opts.dedupKey, 'prod-staged;faces=a.ts+b.ts;tier=lt6h', 'faces 排序拼接;身份不含 blob/计数')
    assert.match(m.detail, /门槛 30 分钟/)
    assert.match(m.detail, /已连到 31 分钟/)
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

test('D2 staged 清零撤起点:下一批在飞工作重新起算,不背着旧账秒到人', () => {
  const s = mkScratch('gpf-d2-')
  try {
    const dirty = probeResult({ state: 'dirty', counts: { staged: 1 }, staged: [{ path: 'old.ts', blob: 'o'.repeat(12) }] })
    const clean = probeResult({ state: 'clean' })
    const h = harness(s, { run: () => ({ code: 0, stdout: JSON.stringify(dirty) }) })
    h.audit({ now: T0 })
    assert.ok(existsSync(h.opts.stagedFirstFile))
    h.audit({ now: T0 + 10 * MIN, run: () => ({ code: 0, stdout: JSON.stringify(clean) }) })
    assert.ok(!existsSync(h.opts.stagedFirstFile), '清零 ⇒ 起点件即撤')
    // 旧批消失 20 分钟后新批出现:必须按新起点起算(此刻已"连到" 30 分钟也不许寄)
    const h2 = harness(s, { run: () => ({ code: 0, stdout: JSON.stringify(dirty) }), now: T0 })
    h2.audit({ now: T0 + 35 * MIN, run: () => ({ code: 0, stdout: JSON.stringify(probeResult({ state: 'dirty', counts: { staged: 1 }, staged: [{ path: 'new.ts', blob: 'n'.repeat(12) }] })) }) })
    assert.equal(h2.mails.length, 0, '新批背着旧账 ⇒ 判据被摘松')
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

test('D3 foreign 首轮即到人("正在丢失的边缘"),身份 prod-foreign;faces=…;tier=…', () => {
  const s = mkScratch('gpf-d3-')
  try {
    const dirty = probeResult({
      state: 'dirty',
      counts: { foreign: 1 },
      foreign: [{ path: 'services/model_catalog.py', blob: 'f'.repeat(12), lineDiff: { added: 29, deleted: 0 } }],
    })
    const h = harness(s, { run: () => ({ code: 0, stdout: JSON.stringify(dirty) }) })
    h.audit({ now: T0 })
    assert.equal(h.mails.length, 1)
    assert.equal(h.mails[0].opts.dedupKey, 'prod-foreign;faces=services/model_catalog.py;tier=lt6h')
    assert.match(h.mails[0].detail, /\[外来\] services\/model_catalog\.py blob=f{12} 行数差 \+29\/-0/)
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

test('D4 unjudged 首轮不寄信;连满 30 分钟按"这一格瞎了"到人;不可解析 stdout 同路', () => {
  const s = mkScratch('gpf-d4-')
  try {
    const h = harness(s, { run: () => ({ code: 2, stdout: JSON.stringify(probeResult({ state: 'unjudged', why: 'nssm 取不到' })) }) })
    h.audit({ now: T0 })
    assert.equal(h.mails.length, 0, '单轮抢不到不是结构性故障')
    // notifyEnvUndetermined 读真实时钟 ⇒ 起点件预写成 31 分钟前
    writeFileSync(h.opts.undetFile, JSON.stringify({ firstMs: Date.now() - 31 * MIN }), 'utf8')
    h.audit({ now: T0 + 31 * MIN })
    assert.equal(h.mails.length, 1, '连满 30 分钟 ⇒ 到人')
    assert.match(h.mails[0].opts.dedupKey, /^prod-foreign-undet;name=/)
    const h2 = harness(s, { run: () => ({ code: 1, stdout: 'not-json-at-all' }), undetFile: join(s, 'undet2.json') })
    h2.audit({ now: T0 })
    assert.equal(h2.mails.length, 0)
    assert.ok(h2.logs.length >= 0)
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

test('D5 duplicate 只写日志不发信;尺子没装车首轮即到人', () => {
  const s = mkScratch('gpf-d5-')
  try {
    const dup = probeResult({ state: 'duplicate', counts: { duplicate: 3 }, duplicates: [{ path: 'a.txt', blob: 'a'.repeat(12) }] })
    const h = harness(s, { run: () => ({ code: 0, stdout: JSON.stringify(dup) }) })
    h.audit({ now: T0 })
    assert.equal(h.mails.length, 0, 'duplicate 无丢失风险,本格不发信(挡 ff 归 auditDeployStall)')
    assert.ok(h.logs.some((l) => l.includes('本格不发信')))
    const h2 = harness(s, { run: () => ({ missing: true, code: 2, stdout: '' }) })
    h2.audit({ now: T0 })
    assert.equal(h2.mails.length, 1, '判据被摘线必须能被发现:尺子不在位 ⇒ 首轮到人')
    assert.equal(h2.mails[0].opts.dedupKey, 'prod-foreign;not-installed')
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

test('D6 untracked 洪水不改变发信语义:计数再大也不进任何告警面', () => {
  const s = mkScratch('gpf-d6-')
  try {
    const flood = probeResult({ state: 'clean', counts: { untracked: 23547 } })
    const h = harness(s, { run: () => ({ code: 0, stdout: JSON.stringify(flood) }) })
    h.audit({ now: T0 })
    h.audit({ now: T0 + 31 * MIN })
    assert.equal(h.mails.length, 0, 'untracked 只计数;若它把结论拖成告警,尺子就废了')
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

// —— 装车与摘线(T1/T2/T3,与 check-env-drift.test.mjs 同一把尺子)——
test('T1 挂点真接线:main() 在 !CHECK_ONLY 分支、健康早退之前;startDaemon 双覆盖', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const gateIdx = src.indexOf('if (coreOk && before.refsOk)')
  const hookIdx = src.indexOf('if (!CHECK_ONLY) auditProdForeignWork()')
  const earlyReturnIdx = src.indexOf('✅ .git 健康', hookIdx)
  assert.ok(gateIdx >= 0 && hookIdx >= 0, '找不到健康分支边界或调用点')
  assert.ok(hookIdx > gateIdx, '挂点在健康分支之外 ⇒ 该轮根本走不到')
  assert.ok(earlyReturnIdx > hookIdx, '挂点在健康轮次早退之后 ⇒ 永不执行(本文件踩过两次的那一型)')
  const daemonIdx = src.indexOf('auditProdForeignWork()', src.indexOf('function startDaemon'))
  assert.ok(daemonIdx > 0 && daemonIdx !== hookIdx, '常驻模式没挂这一层(双执行体覆盖不齐)')
})

test('T2 摘线必红:删掉挂点行后,T1 的判据必须找不到它(方向性对照)', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const stripped = src.replace('if (!CHECK_ONLY) auditProdForeignWork()', '/* 摘线 */')
  assert.notEqual(stripped, src, '夹具失效:没找到要摘的那一行')
  assert.ok(!stripped.includes('if (!CHECK_ONLY) auditProdForeignWork()'))
})

test('T3 尺子绝不进提交链:guardian-runner 的 checks 数组不得出现它(判机器状态,§12e)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const start = runner.indexOf('const checks = [')
  const end = runner.indexOf('// === push 门检查集')
  assert.ok(start >= 0 && end > start, '找不到 checks 数组边界')
  assert.ok(!runner.slice(start, end).includes('check-prod-checkout-foreign-work'), '接进提交链 = 干净检出/CI 上恒红 blocking(§12e 同型)')
})

test('告警正文形状:计数行 + 人工出路(归人,器物不代删代提交)', () => {
  const parsed = probeResult({ state: 'dirty', counts: { staged: 1, foreign: 1 }, staged: [{ path: 'n.ts', blob: 'n'.repeat(12) }], foreign: [{ path: 'f.ts', blob: 'f'.repeat(12), lineDiff: { added: 3, deleted: 1 } }] })
  const d = prodForeignAlertDetail(parsed, '已暂存新文件')
  assert.match(d, /计数:foreign=1 duplicate=0 staged=1 unjudged=0/)
  assert.match(d, /\[已暂存·远端没有\] n\.ts blob=nnnnnnnnnnnn/)
  assert.match(d, /\[外来\] f\.ts blob=ffffffffffff 行数差 \+3\/-1/)
  assert.match(d, /人工出路/)
  assert.match(d, /绝不代删代提交/)
})

// —— 2026-10-24 归因两格(E1..E4):尺子侧把根因拆成逐型 undet[] 后,派发侧不得再复述旧散文 ——
test('E1 未判定逐型点名:日志与正文都取自尺子 undet[];旧三合一散文回潮即翻红;标题不含抖动明细', () => {
  const s = mkScratch('gpf-e1-')
  try {
    const undet = ['svc-enum-empty', 'root-unusable:D:/DevEnv/ihui-prod', 'dir-survey-refused(仓库根本身在夹具内)']
    const und = probeResult({ state: 'unjudged', prodRoot: null, surface: 'none', undet, why: undet.join('; ') })
    const h = harness(s, { run: () => ({ code: 2, stdout: JSON.stringify(und) }) })
    const r1 = h.audit({ now: T0 })
    assert.equal(r1.state, 'undetermined')
    assert.equal(h.mails.length, 0, '单轮未判定仍走持续门槛,不许首轮冒红')
    const q = h.logs.find((l) => l.startsWith('❓'))
    assert.ok(q, '未判定必须留点名行')
    for (const code of undet) assert.ok(q.includes(code), `日志必须逐型点名 ${code};实测:${q}`)
    assert.ok(q.includes('surface=none'), 'surface 维度也要落进日志(区分"量出来的空")')
    assert.ok(!h.logs.some((l) => l.includes('nssm 取不到实跑路径')), '旧三合一散文回潮 = 把后手指引到已不存在的载体形态')
    assert.ok(!h.logs.some((l) => l.includes('签出不可读 / git 失败')), '同上')
    // notifyEnvUndetermined 读真实时钟 ⇒ 起点件预写成 31 分钟前
    writeFileSync(h.opts.undetFile, JSON.stringify({ firstMs: Date.now() - 31 * MIN }), 'utf8')
    h.audit({ now: T0 + 31 * MIN })
    assert.equal(h.mails.length, 1, '连满 30 分钟 ⇒ "这一格瞎了"到人')
    const m = h.mails[0]
    assert.match(m.detail, /\[归因 undet\]/)
    assert.match(m.detail, /\[判定面 surface\] none/)
    for (const code of undet) assert.ok(m.detail.includes(code), `正文必须逐型点名 ${code}`)
    assert.ok(!m.name.includes('D:/') && !m.name.includes('svc-enum-empty'), '标题进身份去重面(dedupKey=…;name=<标题>)⇒ 明细只进正文(门 224 / §5e-3)')
    assert.match(m.opts.dedupKey, /^prod-foreign-undet;name=/)
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

test('E2 量出来的空(surface=absent-surveyed)既不发信也不挂未判定牌', () => {
  const s = mkScratch('gpf-e2-')
  try {
    const absent = probeResult({
      state: 'clean',
      prodRoot: null,
      surface: 'absent-surveyed',
      undet: [],
      why: '判定面为空(实测:服务枚举 214 枚 ∧ IHUI 服务 3 枚 ∧ 自树让路 ∧ 约定目录 null)',
    })
    const h = harness(s, { run: () => ({ code: 0, stdout: JSON.stringify(absent) }) })
    h.audit({ now: T0 })
    h.audit({ now: T0 + 31 * MIN })
    assert.equal(h.mails.length, 0, 'clean 任何一轮都不许发信')
    assert.ok(!h.logs.some((l) => l.startsWith('❓')), '量出来的空不是未判定,不许挂未判定牌')
    assert.ok(!existsSync(h.opts.undetFile), '未判定起点件不该被写:写了它,30 分钟后会把"没有独立签出"误报成"这一格瞎了"')
  } finally {
    rmScratch(s, { bestEffort: true })
  }
})

test('E3 邮件正文的仓根取当次现读值:源码不得写死盘符(AGENTS 前言七类机器事实 / §15 / 守门 70)', () => {
  const src = readFileSync(new URL('../git-guardian-prod-foreign.mjs', import.meta.url), 'utf8')
  assert.ok(!src.includes('D:/IHUI-AI'), '源码里不得再出现写死的本仓根盘符(本机实测根不是它)')
  assert.ok(!/独立于本仓\s*[A-Za-z]:[\\/]/.test(src), '正文里的仓根必须是变量插值,不是字面量盘符')
  assert.ok(!src.includes('D:\\DevEnv\\ihui-prod') || src.includes('2026-10-24 归因补记'), '那枚盘符只准出现在标明"立项当日现场"的叙述里,不得当判据取值用')
  const parsed = probeResult({ state: 'dirty', counts: { foreign: 1 }, foreign: [{ path: 'x.py', blob: 'x'.repeat(12) }] })
  const injected = prodForeignAlertDetail(parsed, '外来改动', { repoRoot: 'Z:/Injected/Repo' })
  assert.ok(injected.includes('独立于本仓 Z:/Injected/Repo'), '注入档必须真的落到正文里(否则"可注入"是假的)')
  const real = prodForeignAlertDetail(parsed, '外来改动')
  assert.ok(WORKTREE && WORKTREE.length > 0, 'WORKTREE 现读为空 ⇒ 默认档无从可验')
  assert.ok(real.includes(`独立于本仓 ${WORKTREE}`), `默认档必须落在 WORKTREE 这把现读尺子上;实测正文没有它`)
})

test('E4 归因取用的三档出口:undet → why → 显式点名"尺子没给归因",绝不回落散文冒判(§0.3)', () => {
  assert.equal(prodForeignUndetText({ undet: ['reg-not-located', ' ls-files-fail(exit 1) '] }), 'reg-not-located | ls-files-fail(exit 1)', '空段剔除 + 去空白,逐型拼出')
  assert.equal(prodForeignUndetText({ undet: [], why: 'override-root-unusable:E:/nope' }), 'override-root-unusable:E:/nope', 'undet 空 ⇒ 退到尺子当次实测的 why')
  const none = prodForeignUndetText({ undet: [] })
  assert.ok(none.includes('尺子未给出归因码'), '两样皆无 ⇒ 点名"尺子没给归因"这一事实本身')
  assert.ok(!none.includes('nssm 取不到实跑路径') && !none.includes('签出不可读'), '失效方向必须是"多要一次定向说明",绝不能是复述旧散文冒判')
  assert.ok(prodForeignUndetText(null).includes('尺子未给出归因码'), 'null/undefined 输入不许抛,也不许冒判')
  // 未判定的信**必须**带归因行:undet 空集合 + state=unjudged 也要点名,不许发一封"未判定但没说为什么"
  const d = prodForeignAlertDetail(probeResult({ state: 'unjudged', prodRoot: null, undet: [], why: '' }), '未判定')
  assert.match(d, /\[归因 undet\].*尺子未给出归因码/)
})
