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
  const all = [...r.findings, ...r.undetermined, ...r.ok]
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
