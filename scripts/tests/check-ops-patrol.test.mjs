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
// P7 用例需要:独立算一次摘要做"证据真伪"对照,以及把夹具 mtime 摆到指定时刻。
// 单独起 import 语句而不是改上面既有那行 —— 既有用例的字节面不许被我动了。
import { createHash } from 'node:crypto'
import { utimesSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const src = (p) => readFileSync(join(REPO, p), 'utf8')
const mod = await import(pathToFileURL(join(REPO, 'scripts', 'check-ops-patrol.mjs')).href)
const { scratchRoot } = await import(pathToFileURL(join(REPO, 'scripts', 'lib', 'scratch-dir.mjs')).href)
const { measureDir, ageVerdict, parseLastSync, patrol } = mod.__test__
const { parseAlertRules, metricRefsFromExpr, checkInertAlertRules } = mod.__test__
// P7(2026-09-29 补,机主裁决"副本没出机就喊")—— 一律 import 源文件的尺子,不在此重抄判定(§22c)。
const { checkBackupReplicaPresence, sha256File, P7_BOUNDARY_NOTE, LIMITS } = mod.__test__

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
  // 四桶并起来才是"本轮量过的全部行" —— 2026-09-29 加 `adjudicated` 这一档时必须同批改这里,
  // 否则被裁决降级的那一格会从 `all` 里消失,这条反向锁就把"已裁"读成"那行被搬走了"。
  const all = [...r.findings, ...r.undetermined, ...r.adjudicated, ...r.ok]
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

/**
 * ── 以下为 P7(2026-09-29 补,机主裁决:"副本没出机就喊")新增用例,只增不改上面 14 条 ──
 * 分工:尺子自己的 --self-test 用**注入桩**判三态与免泄漏;这里补桩测不到的两类:
 * ① 走**真实 sha256File**(不注入)的成对夹具,并用 node:crypto 独立算一遍摘要对照"证据里的哈希是真的";
 * ② 真实机器面:P7 是否真被 patrol 接上、阈值是否沿用同一个数、有没有越界去判"出机"或重复计 P5 的进程债。
 * 夹具一律落在 §26 规定的 scratch 根;断言**只锁形状与三态方向,不锁此刻的颜色**(机器态会变,
 * 锁颜色就造出恒红门 —— 与 T3 同一条理由)。
 */
const P7_NOW = Date.parse('2026-09-29T00:00:00Z')
const P7_HOUR = 3600000
const P7_DAY = 86400000
const p7mk = (base, dir, name, content, ageMs) => {
  const d = join(base, dir)
  mkdirSync(d, { recursive: true })
  const p = join(d, name)
  writeFileSync(p, content, 'utf8')
  const t = (P7_NOW - ageMs) / 1000
  utimesSync(p, t, t)
}
const p7tmp = () => {
  const root = scratchRoot()
  mkdirSync(root, { recursive: true })
  return mkdtempSync(join(root, 'p7mir-'))
}
const sha16 = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)
const p7row = (rows, id) => rows.find((r) => r.id === id) || {}
const p7reds = (rows) => rows.filter((r) => r.state === 'finding').length

test('T15 P7 必须真被 patrol 接上,且只接三条 + P5 的进程行还在原处(同债不双计)', async () => {
  const r = await patrol({})
  // 四桶并起来才是"本轮量过的全部行" —— 2026-09-29 加 `adjudicated` 这一档时必须同批改这里,
  // 否则被裁决降级的那一格会从 `all` 里消失,这条反向锁就把"已裁"读成"那行被搬走了"。
  const all = [...r.findings, ...r.undetermined, ...r.adjudicated, ...r.ok]
  const p7 = all.filter((x) => String(x.id).startsWith('P7·'))
  assert.deepEqual(
    p7.map((x) => x.id).sort(),
    ['P7·同哈希', 'P7·新鲜度对账', 'P7·覆盖对账'].sort(),
    `P7 应恰好三条,实测:${p7.map((x) => x.id).join(',') || '(一条都没有 ⇒ 判据没接进巡检)'}`,
  )
  for (const x of p7) {
    assert.ok(['ok', 'finding', 'undetermined'].includes(x.state), `${x.id} 状态 ${x.state} 不在三态内 ⇒ 并桶了`)
    assert.ok(String(x.detail).includes('能力边界'), `${x.id} 的 detail 没写能力边界(机主明令:边界要写进 detail)`)
    if (x.state === 'undetermined') assert.match(x.detail, /未判定/, `${x.id} 落未判定却没带原因`)
  }
  assert.equal(all.filter((x) => x.id === 'P5·网盘同步客户端').length, 1, 'P5「网盘同步客户端」行必须还在 —— 机主明令不搬、不在两处各计一次')
})

test('T16 P7 成对夹具①:副本齐且同哈希 ⇒ 三行全绿;保留期外那份未复制不算缺项', async () => {
  const base = p7tmp()
  try {
    p7mk(base, 'src', 'a.dump', 'AAA-1', 2 * P7_HOUR)
    p7mk(base, 'src', 'b.dump', 'BBB-2', 3 * P7_HOUR)
    p7mk(base, 'src', 'old.dump', 'OLD-OLD', 8 * P7_DAY) // 超出 7 天保留期:副本没有它不该算缺项
    p7mk(base, 'rep', 'a.dump', 'AAA-1', 2 * P7_HOUR)
    p7mk(base, 'rep', 'b.dump', 'BBB-2', 3 * P7_HOUR)
    const rows = await checkBackupReplicaPresence({ now: P7_NOW, sourceDir: join(base, 'src'), replicaDir: join(base, 'rep') })
    assert.equal(rows.length, 3, `条数应为 3,实测 ${rows.length}`)
    assert.equal(p7reds(rows), 0, '副本齐且同哈希还判红 ⇒ 尺子在造恒红门')
    assert.ok(rows.every((x) => x.state === 'ok'), rows.map((x) => `${x.id}=${x.state}`).join(' '))
    // 配对取"同名且都在"里源侧 mtime 最新的一对(a.dump 比 b.dump 新)
    assert.ok(p7row(rows, 'P7·同哈希').detail.includes('对 a.dump'), p7row(rows, 'P7·同哈希').detail)
    assert.ok(
      p7row(rows, 'P7·同哈希').detail.includes(sha16('AAA-1')),
      'detail 里的哈希前缀必须与独立算出的真摘要一致 —— 否则"同哈希"是自说自话',
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T17 P7 成对夹具②(牙):副本少一份 ⇒ 必红且逐名点名,不牵连在位那份', async () => {
  const base = p7tmp()
  try {
    p7mk(base, 'src', 'a.dump', 'AAA-1', 2 * P7_HOUR)
    p7mk(base, 'src', 'b.dump', 'BBB-2', 3 * P7_HOUR)
    p7mk(base, 'rep', 'a.dump', 'AAA-1', 2 * P7_HOUR)
    const rows = await checkBackupReplicaPresence({ now: P7_NOW, sourceDir: join(base, 'src'), replicaDir: join(base, 'rep') })
    assert.equal(p7reds(rows), 1, `缺一份必须回一条红,实测 ${p7reds(rows)}`)
    const cov = p7row(rows, 'P7·覆盖对账')
    assert.equal(cov.state, 'finding')
    assert.ok(cov.detail.includes('b.dump') && !cov.detail.includes('a.dump'), `缺项要逐名点名且不牵连在位那份:${cov.detail}`)
    assert.equal(p7row(rows, 'P7·新鲜度对账').state, 'ok', '缺份那一红不该顺手把另两维染红(各维独立三态)')
    assert.equal(p7row(rows, 'P7·同哈希').state, 'ok', '同上')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T18 P7 成对夹具③:两侧目录读不到 / 副本根解析不到 ⇒ 三行全未判定、零红("没读到"两头都不许写)', async () => {
  const base = p7tmp()
  try {
    const absent = await checkBackupReplicaPresence({ now: P7_NOW, sourceDir: join(base, 'nope-src'), replicaDir: join(base, 'nope-rep') })
    assert.equal(absent.length, 3)
    assert.equal(p7reds(absent), 0, '读不到却产红 ⇒ 把"没读到"写成了"出事"')
    assert.ok(absent.every((x) => x.state === 'undetermined'), absent.map((x) => `${x.id}=${x.state}`).join(' '))
    p7mk(base, 'src', 'a.dump', 'AAA-1', 2 * P7_HOUR)
    const noReplicaRoot = await checkBackupReplicaPresence({ now: P7_NOW, sourceDir: join(base, 'src'), replicaDir: null })
    assert.equal(p7reds(noReplicaRoot), 0)
    assert.ok(noReplicaRoot.every((x) => x.state === 'undetermined'))
    assert.match(p7row(noReplicaRoot, 'P7·覆盖对账').detail, /IHUI_OFFSITE_BACKUP_DIR/, '未判定必须给出路(怎么让它判得动)')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T19 P7 成对夹具④:同名而内容不同 ⇒ 同哈希必红,且任何一行都不含文件内容', async () => {
  const base = p7tmp()
  try {
    p7mk(base, 'src', 'a.dump', 'TOPSECRET-SRC-DO-NOT-PRINT', 1 * P7_HOUR)
    p7mk(base, 'rep', 'a.dump', 'TOPSECRET-REP-DO-NOT-PRINT', 1 * P7_HOUR)
    const rows = await checkBackupReplicaPresence({ now: P7_NOW, sourceDir: join(base, 'src'), replicaDir: join(base, 'rep') })
    assert.equal(p7reds(rows), 1, `内容不同必须回一条红,实测 ${p7reds(rows)}`)
    const h = p7row(rows, 'P7·同哈希')
    assert.equal(h.state, 'finding')
    assert.ok(h.detail.includes(sha16('TOPSECRET-SRC-DO-NOT-PRINT')) && h.detail.includes(sha16('TOPSECRET-REP-DO-NOT-PRINT')), `两侧摘要都要报:${h.detail}`)
    const joined = rows.map((x) => x.detail).join('\n')
    assert.ok(!joined.includes('DO-NOT-PRINT'), 'detail 里出现了文件内容 ⇒ 越界(只许哈希与字节数)')
    assert.match(joined, / B vs .*sha256:|B vs/, '字节数必须在场')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T20 P7 新鲜度沿用同一个 LIMITS.pgDumpMaxAgeHours(成对喂:差一点未超阈绿 / 超阈红)', async () => {
  const H = LIMITS.pgDumpMaxAgeHours
  const base = p7tmp()
  try {
    p7mk(base, 'fresh-ok', 'f.dump', 'FRESH', (H - 1) * P7_HOUR)
    p7mk(base, 'fresh-src', 'f.dump', 'FRESH', (H - 1) * P7_HOUR)
    const ok = await checkBackupReplicaPresence({ now: P7_NOW, sourceDir: join(base, 'fresh-src'), replicaDir: join(base, 'fresh-ok') })
    assert.equal(p7row(ok, 'P7·新鲜度对账').state, 'ok')
    assert.ok(p7row(ok, 'P7·新鲜度对账').detail.includes(`阈 ${H}h`), `阈值必须显式报出并等于 pgDumpMaxAgeHours=${H}`)
    p7mk(base, 'stale-rep', 'f.dump', 'STALE', (H + 1) * P7_HOUR)
    p7mk(base, 'stale-src', 'f.dump', 'STALE', (H + 1) * P7_HOUR)
    const stale = await checkBackupReplicaPresence({ now: P7_NOW, sourceDir: join(base, 'stale-src'), replicaDir: join(base, 'stale-rep') })
    assert.equal(p7reds(stale), 1, '超阈必须回红')
    assert.equal(p7row(stale, 'P7·新鲜度对账').state, 'finding')
    assert.match(p7row(stale, 'P7·新鲜度对账').detail, new RegExp(`阈 ${H}h`), '红行也要报同一个阈值,不许另造第二个数')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T21 sha256File 的死亡机制:必须流式(禁整读 114MB)、字节如实、读不到必 reject', async () => {
  const body = sha256File.toString()
  assert.match(body, /createReadStream/, '不是流式读 ⇒ 会把整份 dump 读进内存')
  assert.doesNotMatch(body, /readFileSync/, '流式函数里出现 readFileSync')
  const base = p7tmp()
  try {
    const buf = Buffer.alloc(70000, 7)
    writeFileSync(join(base, 'x.dump'), buf)
    const got = await sha256File(join(base, 'x.dump'))
    assert.equal(got.hash, createHash('sha256').update(buf).digest('hex'), '摘要与 node:crypto 独立算的不一致')
    assert.equal(got.bytes, buf.length, '字节数如实')
    await assert.rejects(() => sha256File(join(base, '__no_such__.dump')), '读不到必须 reject(返回 null 会被调用方误判成"比对通过")')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T22 P7 不越界:不接管进程维、不假装能验"出机";机主那句边界同时写在注释与 detail', () => {
  const s = src('scripts/check-ops-patrol.mjs')
  assert.doesNotMatch(
    checkBackupReplicaPresence.toString(),
    /tasklist|BaiduNetbox|baiduSyncRunning/,
    'P7 里出现进程探测 ⇒ 同一条债在两个判据各计一次(机主明令禁止)',
  )
  assert.doesNotMatch(checkBackupReplicaPresence.toString(), /spawn|execSync/, 'P7 不得启动/重启任何同步客户端')
  const occ = [...s.matchAll(/不证明它已离开这台机器/g)].length
  assert.ok(occ >= 2, `能力边界原话只出现 ${occ} 次 ⇒ 头注与 detail(常量)必须各有一处`)
  assert.match(s, /真正的出机依赖第三方同步客户端在跑/)
  assert.ok(P7_BOUNDARY_NOTE.includes('两者同在 D: 卷') && P7_BOUNDARY_NOTE.includes('P7 不重复计账'))
})

// ─────────────────────────────────────────────────────────────────────────────
// P0 裁决台账(2026-09-29 立)。机主对「异地那条腿」的裁决是**只加尺子、不替他启动第三方
// 同步客户端**,所以那一格的红是"已知、已裁、只有他能解除"的状态 —— 让它每 4h 寄一封到人邮件
// 本身就是缺陷(「一直在报警」);而把它永久静音又违反另一条铁律「抑制必须有终态」。
// 下面每一例都成对:既证它会降级,也证它**会把降级收回去**。只留前一臂 = 一条静音键。
// ─────────────────────────────────────────────────────────────────────────────
const { loadAdjudications, applyAdjudications } = mod.__test__
const LEDGER = join(REPO, 'scripts/data/ops-patrol-adjudications.json')
const ADJ_ANCHOR = 'P5·网盘同步客户端'
const entryWith = (over = {}) => ({ anchor: ADJ_ANCHOR, reason: '机主裁决:不代为启动第三方客户端', owner: '机主', reviewBy: '2099-01-01', ...over })
const findingRows = () => [{ id: ADJ_ANCHOR, state: 'finding', detail: '进程不在 ⇒ 出机这一腿此刻不成立' }]

test('T23 成对①:未到期 ⇒ 不进取红计数、行仍打印且带到期日;缺字段/到期 ⇒ 站点照旧红', () => {
  const now = Date.UTC(2026, 8, 29)
  const live = applyAdjudications({ rows: findingRows(), entries: [entryWith({ reviewBy: '2026-10-29' })], now })
  assert.equal(live.rows[0].state, 'adjudicated', '未到期且四件套齐 ⇒ 必须降级')
  assert.match(live.rows[0].detail, /到期 2026-10-29/, '理由里必须看得见**哪一天**收回去(不可见的终态等于没有终态)')
  assert.match(live.rows[0].detail, /进程不在/, '降级不得删掉原判据文本 —— 只改计数方向,不改判据')
  const expired = applyAdjudications({ rows: findingRows(), entries: [entryWith({ reviewBy: '2026-09-01' })], now })
  assert.equal(expired.rows[0].state, 'finding', '到期即回红(不需要任何人记得改代码)')
  assert.match(expired.rows[0].detail, /已到期/)
  for (const key of ['reason', 'owner', 'reviewBy']) {
    const bad = applyAdjudications({ rows: findingRows(), entries: [entryWith({ [key]: '' })], now })
    assert.equal(bad.rows[0].state, 'finding', `缺 ${key} 就生效 ⇒ 登记坏掉变成了免检`)
    assert.match(bad.rows[0].detail, /不完整/, `缺 ${key} 时必须报名而不是静默忽略`)
  }
})

test('T24 成对②:台账坏 JSON 一律照旧红 + 一条未判定;文件不在位是"没有裁决"而不是故障', () => {
  const root = scratchRoot()
  mkdirSync(root, { recursive: true })
  const base = mkdtempSync(join(root, 'ops-ledger-'))
  const now = Date.UTC(2026, 8, 29)
  try {
    const broken = join(base, 'broken.json')
    writeFileSync(broken, '{ "entries": [ {', 'utf8')
    const l = loadAdjudications(broken)
    assert.ok(l.readError, '坏 JSON 必须落 readError(静默当空台账 = 把"没读到"写成"没有待裁项")')
    const a = applyAdjudications({ rows: findingRows(), entries: l.entries, readError: l.readError, now })
    assert.equal(a.rows[0].state, 'finding', '台账坏掉时站点照旧红')
    assert.equal(a.ledgerFindings[0].state, 'undetermined', '台账自身读不出 ⇒ 是"未判定",不是"已判过"')
    const absent = loadAdjudications(join(base, 'nope.json'))
    assert.equal(absent.entries.length, 0)
    assert.equal(absent.readError, null, '文件不在位 ≠ 故障:那是"零条裁决",站点照常红')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('T25 台账腐烂只报名不判红:登记的 anchor 在本轮根本没有这一行', () => {
  const now = Date.UTC(2026, 8, 29)
  const r = applyAdjudications({ rows: [{ id: 'P3·时钟', state: 'ok', detail: '绿' }], entries: [entryWith()], now })
  assert.equal(r.rotten.length, 1, 'anchor 找不到 ⇒ 必须点名"台账腐烂"')
  assert.match(r.rotten[0].why, /腐烂/)
  assert.equal(r.ledgerFindings.length, 0, '腐烂**不判红** —— 一台与任何现场都无关的恒红,唯一出路是各会话绕门(§12e)')
  assert.equal(r.rows[0].state, 'ok', '不得把别的档位顺手改掉')
})

test('T26 装车锁:降级真接在 patrol 里,且摘掉台账后那一格必须回到红档(承重证明)', async () => {
  const src = readFileSync(join(REPO, 'scripts/check-ops-patrol.mjs'), 'utf8')
  const body = src.slice(src.indexOf('export async function patrol'), src.indexOf('export function loadAdjudications'))
  assert.match(body, /applyAdjudications\(/, 'patrol 没调降级 ⇒ 台账成了没人读的装饰')
  assert.match(body, /loadAdjudications\(/, 'patrol 没读台账 ⇒ 同上')
  /**
   * 断言锚在**那一格的身份**上,不是"红读数变多"—— 这台机上两轮巡检之间部署环/备份心跳本来就会漂,
   * 用计数差当证据会在别人正常收尾时误红(把夹具的抖动读成判据失效)。
   */
  const withLedger = await patrol({})
  const without = await patrol({ ledgerFile: join(dirname(LEDGER), '__definitely-absent__.json') })
  if (withLedger.adjudicated.some((x) => x.id === ADJ_ANCHOR)) {
    assert.ok(without.findings.some((x) => x.id === ADJ_ANCHOR), '台账在位时被裁走、换成零条目台账必须回到红档 —— 回不来就说明降级没接到这条判据上')
    assert.ok(!withLedger.findings.some((x) => x.id === ADJ_ANCHOR), '同一格不得同时在红档与已裁档(双计)')
  } else {
    const raw = without.findings.some((x) => x.id === ADJ_ANCHOR)
    assert.ok(raw === withLedger.findings.some((x) => x.id === ADJ_ANCHOR), '本轮这格没被裁,两臂结论就必须一致(不一致 ⇒ 降级通道在别处动了读数)')
  }
  assert.equal(without.counts.rotten, 0, '零条目台账不该产出腐烂报名(腐烂 = 登记了却找不到行)')
})

test('T27 真仓端到端:四桶互斥不并档,计数与数组闭合', async () => {
  const r = await patrol({})
  const ids = (arr) => new Set(arr.map((x) => x.id))
  const inFindings = ids(r.findings).has(ADJ_ANCHOR)
  const inAdjudicated = ids(r.adjudicated).has(ADJ_ANCHOR)
  assert.ok(!inFindings || !inAdjudicated, '同一格同时进红档与已裁档 ⇒ 一条债被计了两次(计数与发信方向都会错)')
  if (inAdjudicated) {
    const row = r.adjudicated.find((x) => x.id === ADJ_ANCHOR)
    assert.match(row.detail, /原判据:/, '已裁行必须把原判据文本带着走,否则读报告的人不知道被压的是什么')
    assert.match(row.detail, /到期 \d{4}-\d{2}-\d{2}/)
  }
  assert.equal(
    r.counts.findings + r.counts.adjudicated + r.counts.ok + r.counts.undetermined,
    r.findings.length + r.adjudicated.length + r.ok.length + r.undetermined.length,
    '计数与数组长度不闭合 ⇒ 有行落进了第五个看不见的桶',
  )
  assert.equal(
    [...r.findings, ...r.adjudicated, ...r.ok, ...r.undetermined].length,
    r.findings.length + r.adjudicated.length + r.ok.length + r.undetermined.length,
    '四桶之间有行重复 ⇒ 分桶不是划分',
  )
})

test('P5b 构建失败归因:三态不并桶,undetermined 不得冒充 landed/in-flight(镜像 import 源实现)', () => {
  const { attribBuildFailures } = mod
  const seg = "src/components/chat/x.tsx(26,8): error TS6133: 'StreamAlertKind' is declared but its value is never read."
  const landed = attribBuildFailures(seg, { readHeadLine: (p, n) => (n === 26 ? '  type StreamAlertKind,' : ''), isDirty: () => false })
  assert.match(landed, /已入库/)
  assert.match(landed, /不会自愈/)
  // 同一输入只把"脏"翻过来 ⇒ 红来自在飞副本;两臂只差一个注入 ⇒ 这就是归因有牙的证明
  const inFlight = attribBuildFailures(seg, { readHeadLine: () => 'return null', isDirty: () => true })
  assert.match(inFlight, /疑似在飞/)
  assert.doesNotMatch(inFlight, /不会自愈/)
  // 反假绿:解析不出文件定位时,结论必须是"无法确认",绝不能落进前两态
  const none = attribBuildFailures('Failed to type check.(没有文件定位)')
  assert.match(none, /无法确认/)
  assert.match(none, /解析不出/)
  assert.doesNotMatch(none, /不会自愈/)
  assert.doesNotMatch(none, /疑似在飞/)
})

// ── 2026-10-01 补:备份产出的「归属」与失败通报的「下游可见性」 ────────────────
const { heartbeatRows, checkUndeliveredAlertMarkers } = mod.__test__
const cadence = await import(pathToFileURL(join(REPO, 'scripts', 'pg-backup-cadence-audit.mjs')).href)

test('复用锁:P5 的库清单与命名式只准有一份实现(抄第二份 = 把"最新文件"读成"我们链产的")', () => {
  const patrolSrc = src(join('scripts', 'check-ops-patrol.mjs'))
  assert.match(patrolSrc, /from '\.\/pg-backup-cadence-audit\.mjs'/, '巡检不再引节拍审计 ⇒ 那份清单解析成了第二处实现')
  assert.match(patrolSrc, /resolveDatabases/, '清单解析必须调共用出口')
  assert.match(patrolSrc, /dumpNameReFor/, '本链命名式必须调共用出口,不得在巡检里再写一遍 ihui_dev_\\d')
  assert.match(patrolSrc, /classifyFileName\(/, '「这名字算不算我们链产的」必须交给那一份分类器判,不得在巡检里重答一遍')
  // 反向锁:巡检自己重新解析 $backupDatabases = 第二处实现(两处必漂移是本仓最贵的失效型)。
  // 用整串字面量比,不用正则 —— 拿正则去找别人的正则,只会造出一台"看不清就当没有"的尺子。
  assert.ok(!patrolSrc.includes('$backupDatabases\\s*=\\s*@'), '巡检里出现了第二份 $backupDatabases 解析式')
  // 复用要两侧都在,少一侧就是"管子断了而账面照绿"
  for (const k of ['resolveDatabases', 'dumpNameReFor']) {
    assert.equal(typeof cadence[k], 'function', `节拍审计不再导出 ${k}(巡检的复用会退化成缺件)`)
  }
  assert.ok(Array.isArray(cadence.EXEC_CANDIDATES) && cadence.EXEC_CANDIDATES.length === 2, '候选序(先执行体后入库源)不在位 ⇒ 复用读不到清单')
})

test('P8 未送达标记:四态不并桶 + 结论串逐字稳定 + 正文不外传(镜像 import 源实现)', () => {
  const base = mkdtempSync(join(scratchRoot(), 'ops-p8-mirror-'))
  try {
    const repo = join(base, 'repo')
    const wb = join(repo, '.workbuddy')
    mkdirSync(wb, { recursive: true })
    const marker = join(wb, 'pg-backup-alert-UNDELIVERED.json')
    const at = '2026-10-01 09:08:29 +08:00'
    const long = '泄' * 5000
    writeFileSync(marker, JSON.stringify({ producer: 'deploy/win/ihui-pg-backup.ps1', alertId: 'pg-backup-failure', title: '数据库备份失败', reason: long, at }), 'utf8')
    const red = checkUndeliveredAlertMarkers({ repoRoot: repo })
    assert.equal(red.state, 'finding', '有标记却没判红')
    assert.match(red.detail, /pg-backup-failure/)
    assert.ok(red.detail.includes(at), '红档未点名未送达时刻')
    assert.ok(red.detail.length < 800, `结论串 ${red.detail.length} 字 ⇒ 长正文被整段带进告警(标记里只该留原因,不该带正文)`)
    assert.equal(checkUndeliveredAlertMarkers({ repoRoot: repo }).detail, red.detail, '两次结论不同形 ⇒ 每轮都会生成一封新信')
    rmSync(marker, { force: true })
    const green = checkUndeliveredAlertMarkers({ repoRoot: repo })
    assert.equal(green.state, 'ok')
    assert.match(green.detail, /不证明邮件通道可用/, '空档被写成"通道可用"= 把没判写成判过了')
    writeFileSync(marker, '{坏 JSON', 'utf8')
    assert.match(checkUndeliveredAlertMarkers({ repoRoot: repo }).state, /^undetermined$/, '坏标记被当成"没有标记"')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('P5 备份产出:逐库出头,一库齐备不得替另一库作证(注入清单造现场)', () => {
  const base = mkdtempSync(join(scratchRoot(), 'ops-p5-mirror-'))
  try {
    const pg = join(base, 'backups', 'pg')
    mkdirSync(pg, { recursive: true })
    const now = Date.now()
    const touch = (name, ageHours) => {
      const p = join(pg, name)
      writeFileSync(p, 'x', 'utf8')
      const ts = new Date(now - ageHours * 3600 * 1000)
      utimesSync(p, ts, ts)
    }
    touch('ihui_dev_20261001_150000.dump', 0.3) // 本链新鲜
    touch('ihui-dev-20261001-151000.dump', 0.1) // 旁族最新
    // keycloak 一格本链产物都没有 ⇒ 必须点名它,而不是被"另一库新鲜"洗绿
    const rows = heartbeatRows({ now, devEnv: base, databases: ['ihui_dev', 'keycloak'] })
    const row = rows.find((r) => r.label.startsWith('数据库备份产出'))
    assert.ok(row, '没有产出备份那一行')
    assert.equal(row.state, 'finding', `缺账库被新鲜库顶掉了:${row.state}`)
    assert.match(row.label, /keycloak/, '出头的必须是缺账那一库')
    // 只锁"这句话点明了缺的是本链产物"这一语义,不锁整句措辞(锁措辞会让下一次改文案变成假红)
    assert.match(row.detail, /本链产物/)
    // 反向对照:两库都有且都新鲜 ⇒ 判绿(新判据不是"逢旁族即红"的恒红尺子)
    touch('keycloak_20261001_150000.dump', 0.2)
    const ok2 = heartbeatRows({ now, devEnv: base, databases: ['ihui_dev', 'keycloak'] }).find((r) => r.label.startsWith('数据库备份产出'))
    assert.equal(ok2.state, 'ok', `两库新鲜仍判红 ⇒ 变成一台恒红尺子:${ok2.detail}`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * P9 邮件通道活性 / P10 未送达欠账(2026-10-01 补)。
 * 同样一律 import 源文件的尺子(§22c):镜像里重写"什么算未判定",就等于没在测它。
 * ───────────────────────────────────────────────────────────────────────────── */
const { parseProbeOutput, mailProbeDue, mailProbeRow, loadDebtAcks, ackCoversDebt, debtAnchor, checkUndeliveredAlertDebt } = mod.__test__

// 逐字取自 2026-10-01 本机真跑 `--probe` 的输出(§22c:判据的对象是"某个真实文件的形态"时,
// 输入必须取自那个文件 —— 自造夹具只会复读实现自己的形状)。
const REAL_PROBE_OUT = [
  '[probe] smtp=ok 握手与认证通过(smtp.qq.com:587)',
  '[probe] resend=undetermined 该通道没有零投递的核验出口 —— 要确证需 --probe-deliver 真发一封',
  '[probe] 结论:至少一条通道确证可用;零投递,未占用收件人',
].join('\n')

test('TP1 P9 结论解析:真形态必须被看见,垃圾输入不得被读成结论', () => {
  const got = parseProbeOutput(REAL_PROBE_OUT)
  assert.ok(got, '真派发器的输出解不出来 ⇒ 整维失明')
  assert.equal(got.channels.smtp.verdict, 'ok')
  assert.equal(got.channels.resend.verdict, 'undetermined')
  // 恒 0 / 恒真是同一枚硬币的两面:解不出必须返回 null,绝不能给一个空结论
  assert.equal(parseProbeOutput('node: internal error'), null)
  assert.equal(parseProbeOutput(''), null)
  assert.equal(parseProbeOutput('[probe] smtp=ok x'), null, '只有通道行没有结论行 ⇒ 不得当作已判')
})

test('TP2 P9 三态不并桶:可用绿 / 失败红 / 一条没确证未判定,且措辞不含逐轮变动的量', () => {
  const at = Date.parse('2026-10-01T12:00:00.000Z')
  const row = (rc, smtp) => mailProbeRow({ rc, channels: { smtp, resend: { verdict: 'undetermined', why: 'x' } } }, { atMs: at })
  assert.equal(row(0, { verdict: 'ok', why: 'ok' }).state, 'ok')
  assert.equal(row(1, { verdict: 'fail', why: '535' }).state, 'finding')
  const und = row(2, { verdict: 'unconfigured', why: '缺 SMTP_HOST' })
  assert.equal(und.state, 'undetermined', '一条都没确证却被并成通过或失败')
  assert.match(und.detail, /不得读成/)
  for (const r of [row(0, { verdict: 'ok', why: 'ok' }), row(1, { verdict: 'fail', why: '535' }), und])
    assert.doesNotMatch(r.detail, /距今|已挂\s*\d+\s*分钟/, `发信指纹吃 detail,含逐轮变动的量 = 每轮一封新信:${r.detail}`)
})

test('TP3 P9 节流单位:24 小时不是 24 分钟,tick 取不到一律视为该重探', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z')
  const H = 3600_000
  assert.equal(mailProbeDue(now + 24 * H - 1, now), false, '差 1ms 到班次就重探 ⇒ 间隔被读小了')
  assert.equal(mailProbeDue(now + 24 * H, now), true, '满 24h 仍不重探 ⇒ 节流变成了永久静音')
  assert.equal(mailProbeDue(now, NaN), true, '取不到 tick 必须"该跑了",否则首次/被清理后永不探')
})

test('TP4 P9/P10 必须真住在 patrol 的装配里,而 P10 的裁决台账必须被喂进判据', () => {
  const s = src('scripts/check-ops-patrol.mjs')
  const body = s.slice(s.indexOf('export async function patrol'), s.indexOf('export function loadAdjudications'))
  assert.match(body, /await checkMailChannelLiveness\(/, 'P9 写了没接线 = 没有这台尺子')
  assert.match(body, /checkUndeliveredAlertDebt\(/, 'P10 写了没接线 = 没有这台尺子')
  assert.match(body, /loadDebtAcks\(\)/, '裁决台账没人读 ⇒ 这条队列没有死亡机制,会一路红到有人删判据')
  assert.match(body, /acks: debtAcks\.entries/, '读了台账却不喂给判据 ⇒ "已裁"在账面上永远不生效')
  // 构造面反向对照:上面那条正则必须真会因摘线而不匹配(否则它是个恒真断言)
  const unwired = body.replace('acks: debtAcks.entries })', '})')
  assert.doesNotMatch(unwired, /acks: debtAcks\.entries/, '这条锁自己无牙:摘掉喂线它仍然匹配')
})

test('TP5 P10 逐条裁决:免掉必须当场对上一次真投递,缺字段/到期/指纹或时刻不符都不放行', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z')
  const FP = 'a'.repeat(40)
  const TS = now - 6 * 3600_000
  const good = {
    alert: '备份失败',
    fp: FP,
    atTs: new Date(TS).toISOString(),
    reason: '机主已确认无需补发',
    owner: '机主',
    reviewBy: '2099-01-01',
  }
  assert.equal(ackCoversDebt({ ack: good, name: '备份失败', fp: FP, ts: TS, now }), true)
  assert.equal(ackCoversDebt({ ack: { ...good, fp: 'b'.repeat(40) }, name: '备份失败', fp: FP, ts: TS, now }), false, '指纹不同 = 另一个故障,一条裁决不得替它背书')
  // 时刻档:同名同指纹的**另一笔**未送达必须是新账。少了它,一次裁决就变成一个告警名的永久静音,
  // 而"同一件故障复发"时 detail 只有绝对时刻 ⇒ 指纹常常就是同一个,单靠 fp 分不开两次。
  assert.equal(ackCoversDebt({ ack: { ...good, atTs: new Date(TS - 86_400_000).toISOString() }, name: '备份失败', fp: FP, ts: TS, now }), false, '时刻不符仍免账 = 复发无声')
  assert.equal(ackCoversDebt({ ack: { ...good, atTs: undefined }, name: '备份失败', fp: FP, ts: TS, now }), false, '不带 atTs 的裁决生效 = 五件套退化成四件套')
  assert.equal(ackCoversDebt({ ack: { ...good, atTs: '不是日期' }, name: '备份失败', fp: FP, ts: TS, now }), false, 'atTs 写坏了必须不放行,而不是被 Date.parse 静默当成 NaN 比较通过')
  assert.equal(ackCoversDebt({ ack: { ...good, reason: '  ' }, name: '备份失败', fp: FP, ts: TS, now }), false, '缺字段仍生效')
  assert.equal(ackCoversDebt({ ack: { ...good, reviewBy: '2020-01-01' }, name: '备份失败', fp: FP, ts: TS, now }), false, '已到期的裁决仍在免账 = 抑制没有终态')
  assert.equal(ackCoversDebt({ ack: { ...good, reviewBy: '不是日期' }, name: '备份失败', fp: FP, ts: TS, now }), false, 'reviewBy 写坏了等于永久静音')
  // 键只有一份实现:台账侧的 ms 数与裁决侧的 ISO 串必须归一到同一个键
  // (两侧各拼一遍必然漂开,而漂开的表现是"失效裁决"那一档静默不报名)。
  assert.equal(debtAnchor('备份失败', FP, TS), debtAnchor(' 备份失败 ', FP, new Date(TS).toISOString()), 'ms 与 ISO 必须归一(否则裁决永远对不上台账)')
  assert.notEqual(debtAnchor('备份失败', FP, TS), debtAnchor('备份失败', FP, TS + 1), '时刻没进键 = 一次裁决替所有复发背书')
})

test('TP6 P10 三态与出口:挂账红 / 逐条裁过绿且报名 / 台账坏 JSON 未判定 / 空台账不读成零欠账', () => {
  const base = mkdtempSync(join(scratchRoot(), 'ops-p10-mirror-'))
  try {
    const now = Date.parse('2026-10-01T12:00:00.000Z')
    const repo = join(base, 'repo')
    const wb = join(repo, '.workbuddy')
    mkdirSync(wb, { recursive: true })
    const st = join(wb, 'git-guardian-notify-state.json')
    const FP = 'a'.repeat(40)
    writeFileSync(st, JSON.stringify({ 备份失败: { fp: FP, ts: now - 6 * 3600_000, delivered: false } }), 'utf8')
    const red = checkUndeliveredAlertDebt({ repoRoot: repo, now })
    assert.equal(red.state, 'finding')
    assert.match(red.detail, /从未到人/)
    const acked = checkUndeliveredAlertDebt({
      repoRoot: repo,
      now,
      acks: [
        {
          alert: '备份失败',
          fp: FP,
          atTs: new Date(now - 6 * 3600_000).toISOString(),
          reason: '机主已确认无需补发',
          owner: '机主',
          reviewBy: '2099-01-01',
        },
      ],
    })
    assert.equal(acked.state, 'ok', acked.detail)
    // 反向臂:台账同一笔,裁决指向**另一笔**的时刻 ⇒ 必须照旧红(端到端证"时刻进键"真的生效,
    // 而不只是纯函数那一层)
    const wrongOccurrence = checkUndeliveredAlertDebt({
      repoRoot: repo,
      now,
      acks: [
        {
          alert: '备份失败',
          fp: FP,
          atTs: new Date(now - 90 * 24 * 3600_000).toISOString(),
          reason: '裁的是另一笔',
          owner: '机主',
          reviewBy: '2099-01-01',
        },
      ],
    })
    assert.equal(wrongOccurrence.state, 'finding', '另一笔时刻的裁决免掉了这一笔 ⇒ 键里的时刻没起作用')
    // 免掉 ≠ 通过:必须留下"被谁免的、几条"的痕迹,否则下一次读报告的人会以为通道正常
    assert.match(acked.detail, /已逐条裁过 1 条/)
    writeFileSync(st, '{坏', 'utf8')
    const broken = checkUndeliveredAlertDebt({ repoRoot: repo, now })
    assert.equal(broken.state, 'undetermined', '台账坏了却报"无欠账" = 把没判写成判过了')
    assert.match(broken.detail, /git-guardian-notify-state\.json/)
    rmSync(st)
    const empty = checkUndeliveredAlertDebt({ repoRoot: repo, now })
    assert.equal(empty.state, 'ok')
    assert.match(empty.detail, /不是"欠账为零"/, '没有台账这一维必须说清它不等于零欠账')
    assert.equal(loadDebtAcks(join(base, 'no-such.json')).readError, null, '文件不在位应是"零裁决"而非错误')
    writeFileSync(join(base, 'bad.json'), '{', 'utf8')
    assert.match(String(loadDebtAcks(join(base, 'bad.json')).readError), /解析失败|Cannot|JSON/, '坏台账必须带回原因')

/**
 * P11(2026-10-02 补):promtool 规则单测 —— 判据写完没人跑 = 造好没装车。
 * 与 P1/P2 同族:promtool 是本机工具,取不到一律未判定、绝不判红(机器态)。
 */
test('TP7 P11 promtool:必须真住在 patrol 装配里,且 promtool/用例取不到不得判红', () => {
  const body = src('scripts/check-ops-patrol.mjs')
  const inPatrol = body.slice(
    body.indexOf('export async function patrol'),
    body.indexOf('export function loadAdjudications'),
  )
  assert.match(inPatrol, /checkPromtoolRules\(/, 'P11 写了没接线 = 没有这台尺子')
  const { checkPromtoolRules } = mod.__test__
  const noTool = checkPromtoolRules({
    devEnv: join(REPO, '__no_dev_env__'),
    repoRoot: join(REPO, '__no_repo__'),
    promtool: null,
  })
  assert.equal(noTool.state, 'undetermined', `promtool/用例目录取不到时必须未判定,实得 ${noTool.state}:${noTool.detail}`)
  assert.notEqual(noTool.state, 'finding', '机器态缺失不得判红')
})
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
