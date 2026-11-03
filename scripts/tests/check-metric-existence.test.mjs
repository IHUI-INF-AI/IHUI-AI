// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:指标存在性门(scripts/check-metric-existence.mjs)。
// 钉的是**三态不并桶**这条判据,不是"当前仓库此刻是否全绿":
//   打错一个字符 ⇒ typo 必红 / 真实且有样本 ⇒ 绿 / 名字在但窗口无序列 ⇒ stale 必红。
// 另加装车锁:脚本必须在 package.json 与 guardian-runner 注册段里真的挂着,
// 否则判据存在而永不调用 = 没有(本仓反复记过的同一条)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as T } from '../check-metric-existence.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-metric-existence.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const PKG = join(REPO, 'package.json')

const rule = (name, expr) =>
  `groups:\n  - name: t\n    rules:\n      - alert: ${name}\n        expr: ${expr}\n`

/**
 * 用真实解析器产出 refs,避免测试重抄一份 expr→metric 的解析规则(§22c)。
 * 走公共 collectRuleRefs + 临时 alerts 文件 —— 与生产路径同一份实现。
 */
function parseRefs(yaml) {
  const dir = mkScratch('metric-existence-parse')
  try {
    const f = join(dir, 'alerts-fixture.yml')
    writeFileSync(f, yaml)
    return T.collectRuleRefs(dir).files
  } finally {
    rmScratch(dir)
  }
}

const runCLI = (args, opts = {}) => {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      windowsHide: true,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 2, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

test('T1 打错一个字符 ⇒ 判 typo(必红)', () => {
  const refs = parseRefs(rule('TypoRule', 'rate(ihui_llm_requests_totl[5m]) > 0'))
  const r = T.classifyRules({
    refs,
    liveNames: new Set(['ihui_llm_requests_total']),
    freshNames: new Set(['ihui_llm_requests_total']),
  })
  assert.equal(r.violations.length, 1, `应恰有 1 处判红,实得 ${JSON.stringify(r.violations)}`)
  assert.equal(r.violations[0].category, 'typo')
  assert.equal(r.violations[0].metric, 'ihui_llm_requests_totl')
  assert.match(r.violations[0].reason, /编辑距离 1/)
})

test('T2 真实存在且有近期样本 ⇒ 必绿(正常路径不被误挡)', () => {
  const refs = parseRefs(rule('RealRule', 'sum(rate(ihui_llm_requests_total[5m])) > 0'))
  const r = T.classifyRules({
    refs,
    liveNames: new Set(['ihui_llm_requests_total']),
    freshNames: new Set(['ihui_llm_requests_total']),
  })
  assert.deepEqual(r.violations, [], `真实指标被判红 = 假红:${JSON.stringify(r.violations)}`)
})

test('T3 名字存在但窗口内无序列 ⇒ 判 stale(必红)', () => {
  const refs = parseRefs(rule('StaleRule', 'increase(some_stale_metric_total[1h]) > 0'))
  const r = T.classifyRules({
    refs,
    liveNames: new Set(['some_stale_metric_total']),
    freshNames: new Set(), // 名字在,但 24h 内一条序列都没有
  })
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].category, 'stale')
  assert.match(r.violations[0].reason, /api\/v1\/series/)
})

test('T4 名字完全陌生且无近似 ⇒ 判 never-produced,不得洗成 typo', () => {
  const refs = parseRefs(rule('GhostRule', 'rate(totally_unknown_metric_xyz[5m]) > 0'))
  const r = T.classifyRules({
    refs,
    liveNames: new Set(['ihui_llm_requests_total']),
    freshNames: new Set(['ihui_llm_requests_total']),
  })
  assert.equal(r.violations[0]?.category, 'never-produced')
})

test('T5 真实监控目录:alerts 文件必须解析出规则(0 条 = 尺子失效,不是"没有规则")', () => {
  // 仓库面按 HEAD blob 判(与生产默认面同一条路径),不再按磁盘读
  const { files, brokenAlertFiles } = T.collectRuleRefs('monitoring', { face: 'head' })
  assert.deepEqual(brokenAlertFiles, [], `alerts 文件解析失败:${brokenAlertFiles.join(',')}`)
  assert.ok(files.length >= 10, `规则条数 ${files.length} 明显少于监控目录的 alert 数`)
  assert.ok(files.every((r) => typeof r.kind === 'string' && typeof r.name === 'string'))
  assert.ok(files.every((r) => Array.isArray(r.metrics)), '每条规则都要带指标引用集合')
})

test('T6 --self-test 必须全绿', () => {
  const r = runCLI(['--self-test'])
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /自检 \d+\/\d+ 通过/)
  assert.doesNotMatch(r.out, /❌/, `自检出现 ❌:${r.out}`)
})

test('T7 端到端离线:打错一个字符的规则文件 ⇒ exit 1;真实指标 ⇒ exit 0', () => {
  const dir = mkScratch('metric-existence-e2e')
  try {
    const badDir = join(dir, 'bad')
    const goodDir = join(dir, 'good')
    mkdirSync(badDir, { recursive: true })
    mkdirSync(goodDir, { recursive: true })
    writeFileSync(
      join(badDir, 'alerts-bad.yml'),
      rule('BadRule', 'rate(ihui_llm_requests_totl[5m]) > 0'),
    )
    const red = runCLI(['--offline', '--rules-dir', badDir])
    assert.equal(red.code, 1, `打错一个字符必须 exit 1;实际 ${red.code}\n${red.out}`)
    assert.match(red.out, /ihui_llm_requests_totl/)
    assert.match(red.out, /打错|从未产生样本/)

    writeFileSync(
      join(goodDir, 'alerts-good.yml'),
      rule('GoodRule', 'rate(ihui_llm_requests_total[5m]) > 0'),
    )
    const green = runCLI(['--offline', '--rules-dir', goodDir])
    assert.equal(green.code, 0, `真实指标不得被判红;实际 ${green.code}\n${green.out}`)
    assert.match(green.out, /✅/)
  } finally {
    rmScratch(dir)
  }
})

test('T8 装车锁:package.json 与 runner 注册段必须真的挂着本门(warn + 监控路径触发)', () => {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  assert.equal(
    pkg.scripts['check:metric-existence'],
    'node scripts/check-metric-existence.mjs',
    'package.json 缺 check:metric-existence 入口',
  )
  const runner = readFileSync(RUNNER, 'utf8')
  const at = runner.indexOf("id: '282',")
  assert.ok(at >= 0, 'guardian-runner 未注册 check-metric-existence.mjs(id 282)')
  const block = runner.slice(at, at + 1200)
  assert.match(block, /script: 'check-metric-existence\.mjs'/, 'id 282 未指向本门脚本')
  assert.match(block, /mode: 'warn'/, '本门依赖本机 Prometheus,只能 warn;升 blocking 会让机器态拖垮所有提交')
  assert.match(
    block,
    /stagedTriggers: \['monitoring\/', 'scripts\/data\/metric-existence-exemptions\.json'\]/,
    '必须在暂存区触及 monitoring/ 或例外台账时执行(台账改动也要过门)',
  )
  assert.match(block, /skipEnv: 'HUSKY_SKIP_METRIC_EXISTENCE'/, '必须有应急跳过环境变量')
})

test('T9 新鲜窗口解析:24h/1d/6h 各一例,认不出回落 24h', () => {
  assert.equal(T.windowToSeconds('24h'), 86400)
  assert.equal(T.windowToSeconds('1d'), 86400)
  assert.equal(T.windowToSeconds('6h'), 21600)
  assert.equal(T.windowToSeconds('bogus'), 86400)
})

test('T10 例外台账:双验通过才放行;发射点改名/采集掉线/到期/空挂 任一必红', () => {
  const refs = parseRefs(rule('EventRule', 'increase(event_only_total[15m]) > 0'))
  const entry = {
    metric: 'event_only_total',
    ruleFile: refs[0].file,
    ruleName: 'EventRule',
    job: 'j',
    emitter: 'em.ts',
    until: '2999-01-01',
  }
  const checksOf = (text, up) =>
    T.evaluateExemptions([entry], { readFile: () => text, scrapeUp: new Map([['j', up]]) })
  const classify = (checks) =>
    T.classifyRules({
      refs,
      liveNames: new Set(['ihui_llm_requests_total']),
      freshNames: new Set(),
      exemptions: [entry],
      exemptionChecks: checks,
    })

  const ok = classify(checksOf("Counter('event_only_total')", true))
  assert.equal(ok.violations.length, 0, '发射点+采集双验通过必须放行')
  assert.equal(ok.exempted.length, 1)

  const renamed = classify(checksOf("Counter('renamed_total')", true))
  assert.equal(renamed.violations.length, 1, '发射点改名后旧例外必须失效(不许盖住真缺陷)')
  assert.match(renamed.violations[0].reason, /例外失效/)

  const down = classify(checksOf("Counter('event_only_total')", false))
  assert.equal(down.violations.length, 1, '采集掉线不得被当成合法空闲')

  const expired = T.evaluateExemptions([{ ...entry, until: '2000-01-01' }], {
    readFile: () => "Counter('event_only_total')",
    scrapeUp: new Map([['j', true]]),
  })
  assert.equal(classify(expired).violations.length, 1, '到期例外必须判红')

  const dangling = T.findDanglingExemptions(
    [entry],
    [{ file: 'other.yml', kind: 'alert', name: 'OtherRule', expr: 'x', metrics: ['x_total'] }],
  )
  assert.equal(dangling.length, 1, '规则不再引用该指标时,台账条目必须报空挂')
  assert.equal(dangling[0].category, 'dangling-exemption')
})

test('T11 真台账:可解析,且每条发射点仍含该指标名(防台账腐烂)', () => {
  // 台账是待提交文件:测试按**工作树**面读(生产默认面是 HEAD,提交后两者一致)
  const { entries, error } = T.readExemptions({ face: 'worktree' })
  assert.equal(error, null)
  assert.ok(entries.length >= 2, `真台账条目 ${entries.length} 条,少于本次登记的两条`)
  const checks = T.evaluateExemptions(entries, {
    readFile: (rel) => T.readFace('worktree', rel),
    scrapeUp: null,
  })
  for (const [key, c] of checks) {
    assert.equal(c.ok, true, `${c.entry?.metric || key} 台账硬验失败:${c.why}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
