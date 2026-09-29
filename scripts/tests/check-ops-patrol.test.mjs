// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-ops-patrol.mjs` 的装车与定级方向锁。
 * 判据一律 import 源文件导出的 `__test__`,**不在这里重抄一份** —— 抄了就是在复读实现。
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const src = (p) => readFileSync(join(REPO, p), 'utf8')
const mod = await import(pathToFileURL(join(REPO, 'scripts', 'check-ops-patrol.mjs')).href)
const { scratchRoot } = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'scratch-dir.mjs')).href)
const { measureDir, ageVerdict, parseLastSync, patrol } = mod.__test__
const { parseAlertRules, metricRefsFromExpr, checkInertAlertRules } = mod.__test__

const REAL_W32TM_LINE = '上次成功同步时间: 2026/9/28 19:52:42'

test('T1 装车:派发点必须真住在守护的两个执行体里(不跑它等于没有调度器)', () => {
  const g = src('scripts/git-guardian.mjs')
  assert.match(g, /export function auditOpsPatrol\(/, '派发函数缺失')
  const calls = [...g.matchAll(/auditOpsPatrol\(\)/g)].length
  assert.equal(calls, 2, `调用点应为 2 处(健康轮 + daemon tick),实测 ${calls} —— 少一处就是某个执行体永不巡检`)
})

test('T2 摘线不得被读成已装车(构造面反向对照,T1 的牙)', () => {
  const g = src('scripts/git-guardian.mjs')
  const onlyOnce = g.replace(/if \(!CHECK_ONLY\) auditOpsPatrol\(\)/, '')
  const calls = [...onlyOnce.matchAll(/auditOpsPatrol\(\)/g)].length
  assert.equal(calls, 1, '摘掉一处调用后必须只剩 1 —— 剩 2 说明 T1 数的是别处文本,不是挂点')
})

test('T3 定级方向锁:本门绝不被接进提交链(判机器状态 ⇒ 恒红 ⇒ 每台每次 --no-verify)', () => {
  for (const f of ['scripts/guardian-runner.mjs', 'scripts/lib/pre-commit-hook.js', '.husky/pre-commit', '.husky/post-commit']) {
    assert.doesNotMatch(src(f), /check-ops-patrol/, `${f} 里出现了本门 ⇒ 定级被改成了提交链档,需先给出"为什么现在能接"的证据`)
  }
})

test('T4 两执行体必须共用同一个节流戳(否则双执行体翻倍发信)', () => {
  const g = src('scripts/git-guardian.mjs')
  const tick = g.match(/const OPS_PATROL_TICK = [^\n]+/)
  assert.ok(tick, '节流戳常量不见了')
  assert.match(tick[0], /ops-patrol-tick/, `节流戳文件名异常:${tick[0]}`)
  assert.equal([...g.matchAll(/OPS_PATROL_TICK\b/g)].length, 2, '常量应"定义一次 + 用作默认值一次";多了说明有第二份戳')
})

test('T5 真实 w32tm 输出必须能解出时刻(夹具逐字取自本机,不得照实现编)', () => {
  const at = parseLastSync(REAL_W32TM_LINE)
  assert.equal(at, Date.parse('2026-09-28T19:52:42'), '斜杠日期 + 中文标签这一族必须命中')
  assert.equal(parseLastSync('Last Successful Sync Time:2026/9/29 3:37:00 AM'), Date.parse('2026-09-29T03:37:00'), '英文标签同样必须命中(换系统语言不该让这一维失明)')
  assert.equal(parseLastSync('上次成功同步时间: 未知'), null, '有标签但日期认不出 ⇒ 未判定,不是猜一个')
})

test('T6 三态不并桶:量不到不得被写成通过,也不得写成红', () => {
  assert.equal(ageVerdict(NaN, 10), 'undetermined')
  assert.equal(ageVerdict(0, 10), 'ok')
  assert.equal(ageVerdict(11 * 60_000, 10), 'finding')
})

test('T7 盒形量算必须既能读到、又不穿重解析点(只测一边等于没测)', () => {
  const inRepo = measureDir(join(REPO, 'scripts/lib'))
  assert.ok(inRepo && inRepo.entries > 0 && !inRepo.truncated, '真实目录量不到 ⇒ 这一维在伪装成"没问题"')
})

test('T8 巡检整体可跑且返回三档计数(端到端,零写盘:不带 --apply)', async () => {
  const r = await patrol({})
  assert.ok(r.counts, '没有 counts 就是结论没成形')
  assert.equal(typeof r.rc, 'number')
  assert.ok(
    r.findings.every((x) => x.state === 'finding') && r.undetermined.every((x) => x.state === 'undetermined'),
    '分档必须按最终状态算 —— 推入时定档会把"修复失败"的条目留在绿档',
  )
})

/**
 * ── 以下为 P6(2026-09-29 补判据)新增用例 ──
 * 分工:尺子自己的 --self-test 用**构造面**判四态与死亡机制(不连 Prometheus);
 * 这里只测构造面测不到的两类 —— ① 真实规则文件/真实台账的对账,② P6 是否真被装车。
 */
test('T9 真实台账对账:锚点必须真在规则文件里、四件套齐、reviewBy 成形且**未到期**', () => {
  const ledger = JSON.parse(src('scripts/data/inert-alert-rules.json'))
  assert.ok(Array.isArray(ledger.rules), '台账必须是 { rules: [...] } —— 读成别的形状等于这张表不存在')
  const ruleNames = new Set(parseAlertRules(src('monitoring/prometheus/alerts.yml')).map((r) => r.name))
  assert.ok(ruleNames.size >= 20, `规则文件只解析到 ${ruleNames.size} 条 ⇒ 解析器失效,拿它对账就是"账面全绿"`)
  for (const e of ledger.rules) {
    for (const f of ['anchor', 'reason', 'owner', 'reviewBy']) {
      assert.ok(typeof e[f] === 'string' && e[f].trim(), `条目 ${e.anchor || '(无 anchor)'} 缺 ${f} ⇒ 字段不齐在尺子里本就判红,测试不得先放行`)
    }
    assert.match(e.reviewBy, /^\d{4}-\d{2}-\d{2}$/, `${e.anchor}: reviewBy=${e.reviewBy} 不是日期形态 ⇒ 等于没有死亡机制`)
    assert.ok(ruleNames.has(e.anchor), `台账腐烂:${e.anchor} 在 alerts.yml 里已找不到同名规则 ⇒ 改名/删规则必须同时清账`)
    assert.ok(Date.parse(`${e.reviewBy}T23:59:59Z`) >= Date.now(), `${e.anchor}: 裁决已到期(${e.reviewBy})⇒ 站点回到队列。要么带着新证据续展,要么把表达式改到真在采的指标上并撤条目`)
    assert.match(e.reason, /(curl|grep|node) /, `${e.anchor}: reason 里没有可执行的取证命令 ⇒ "应该没问题"型登记,不成立`)
  }
})

test('T10 真实规则版式面:每条规则都要取出指标名,取出的不得是函数名/标签名/范围选择器', () => {
  const rules = parseAlertRules(src('monitoring/prometheus/alerts.yml'))
  assert.ok(rules.length >= 20, `只解析到 ${rules.length} 条 ⇒ 真实版式(单行 + 块标量)没被认全`)
  const NOT_METRIC = new Set([
    'sum',
    'rate',
    'irate',
    'increase',
    'count',
    'count_values',
    'avg',
    'min',
    'max',
    'stddev',
    'vector',
    'histogram_quantile',
    'label_replace',
    'label_join',
    'abs',
    'absent',
    'ceil',
    'floor',
    'round',
    'clamp_min',
    'clamp_max',
    'idelta',
    'deriv',
    'predict_linear',
    'sort',
    'topk',
    'bottomk',
    'by',
    'without',
    'on',
    'ignoring',
    'group_left',
    'group_right',
    'and',
    'or',
    'unless',
    'bool',
    'offset',
  ])
  for (const r of rules) {
    assert.ok(String(r.expr || '').trim(), `${r.name} 取不到 expr ⇒ 块标量(expr: |)那一族没被认`)
    const refs = metricRefsFromExpr(r.expr)
    assert.ok(refs.length >= 1, `${r.name} 提不出候选指标名(会落未判定,这里要求真实文件必须判得动)`)
    for (const n of refs) assert.ok(!NOT_METRIC.has(n), `${r.name} 的候选里混进了非指标名:${n}`)
  }
  assert.equal(metricRefsFromExpr('(sum(rate(ihui_llm_tokens_total{job="ai-service"}[15m])) or on() vector(0)) > 100000').join(), 'ihui_llm_tokens_total')
  assert.equal(metricRefsFromExpr('increase(alertmanager_notifications_failed_total{integration="webhook"}[30m]) > 0').join(), 'alertmanager_notifications_failed_total')
  assert.equal(metricRefsFromExpr('up{job="api"} == 0').join(), 'up')
})

test('T11 机器态取不到 ⇒ 整条 P6 未判定且一条红都不产(判红就造出恒红门,与 T3 同一条理由)', async () => {
  const r = await checkInertAlertRules({ alertsFile: join(REPO, 'monitoring/prometheus/alerts.yml'), probe: async () => ({ err: '模拟:Prometheus 没起' }) })
  assert.equal(r.counts.red, 0, '接口不可达时产红 ⇒ Prometheus 一停整门恒红')
  assert.equal(r.rows.length, 1, `应只有一行汇总,实测 ${r.rows.length} 行`)
  assert.equal(r.rows[0].id, 'P6')
  assert.equal(r.rows[0].state, 'undetermined', '取不到不得写成 finding,也不得写成 ok')
})

test('T12 台账取不到 ⇒ 站点按零条目判红(fail-closed)且必须再补一行"台账未判定"(fail-loud)', async () => {
  const root = scratchRoot()
  mkdirSync(root, { recursive: true })
  const base = mkdtempSync(join(root, 'p6t-'))
  try {
    const alertsFile = join(base, 'alerts.yml')
    writeFileSync(alertsFile, ['groups:', '  - name: t', '    rules:', '      - alert: GhostRule', '        expr: ghost_metric_total > 0'].join('\n'), 'utf8')
    const r = await checkInertAlertRules({
      alertsFile,
      ledgerFile: join(base, '__no_such_ledger__.json'),
      now: Date.parse('2026-09-29T00:00:00Z'),
      probe: async () => ({ names: new Set(['up']) }),
    })
    assert.equal(r.counts.red, 1, '没有台账 ⇒ 站点必须回队列,不得"表读不到就当没人登记过所以没事"')
    assert.ok(r.rows.some((x) => x.id === 'P6·GhostRule' && x.state === 'finding'), '判红必须点名到规则')
    assert.ok(r.rows.some((x) => x.id === 'P6·台账' && x.state === 'undetermined'), '台账读不到这件事本身必须单独占一行,否则读者以为"没人登记"')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T13 P6 必须真被 patrol 接上(判据写出来而没装车 = 本仓最高频失效型)', async () => {
  const r = await patrol({})
  const all = [...r.findings, ...r.undetermined, ...r.ok]
  assert.ok(all.some((x) => x.id === 'P6'), 'patrol 没产出 P6 汇总行 ⇒ 判据没接进巡检')
  const sum = all.find((x) => x.id === 'P6')
  assert.match(sum.detail, /^规则 \d+ 条:在采/, `汇总行没报数:${sum.detail}`)
})

test('T14 P6 的遮噪必须引唯一实现(第二份注释/字符串状态机迟早漂移,而漂移是安静的)', () => {
  const s = src('scripts/check-ops-patrol.mjs')
  assert.match(s, /from '\.\/lib\/code-mask\.mjs'/, '没有引用 scripts/lib/code-mask.mjs')
  assert.doesNotMatch(s, /function maskComments[A-Za-z]*\s*\(/, '本文件里出现了第二份遮蔽实现')
  assert.doesNotMatch(s, /const maskCommentsAndStrings\s*=/, '本文件里重新定义了遮蔽函数')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
