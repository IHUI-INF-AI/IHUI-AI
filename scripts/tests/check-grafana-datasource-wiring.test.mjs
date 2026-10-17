// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 222 的镜像测试(AGENTS §22c):判据一律 import 生产实现,禁止在这里复制第二份。
// 分工:自检(--self-test)证 uid 提取的基本形状;本档证「门接在生产判据上、摘掉某条判据就翻红」。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as GATE } from '../check-grafana-datasource-wiring.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_PATH = resolve(ROOT, 'scripts/check-grafana-datasource-wiring.mjs')

test('D1 uid 提取:显式 uid 与「无 uid 回落 name」两种形状都要对', () => {
  const uids = GATE.collectProvisionedUids(
    ['apiVersion: 1', 'datasources:', '  - name: Prometheus', '    uid: Prometheus', '  - name: Loki', ''].join('\n')
  )
  assert.ok(uids.has('Prometheus'), '显式 uid 必须取到')
  assert.ok(uids.has('Loki'), '未显式声明 uid 时必须回落到 name(派生器补 uid 也是这个规则)')
})

test('D2 块切分:嵌套的 tags 子项不得被当成独立数据源', () => {
  // Jaeger 那段带 `tags: - name: 'service'` 的嵌套列表,首版按 ^\s*-\s+name: 切会多出一个名为 service 的源。
  const uids = GATE.collectProvisionedUids(
    [
      'datasources:',
      '  - name: Jaeger',
      '    url: http://jaeger:16686',
      '    jsonData:',
      '      tracesToMetrics:',
      '        tags:',
      "          - name: 'service'",
      "            value: 'service.name'",
      '',
    ].join('\n')
  )
  assert.equal(uids.size, 1, '嵌套 name 不得被认成数据源')
  assert.ok(uids.has('Jaeger'))
})

test('D3 判据 A:引用了未声明的 uid 必须被抓出来(摘掉这条判据 = 死面板无人拦)', () => {
  const refs = GATE.collectPanelRefs(() => [
    { file: 'x.json', json: { panels: [{ title: '坏面板', type: 'timeseries', datasource: { uid: 'NotProvisioned' } }] } },
  ])
  const found = refs.filter((r) => r.uid === 'NotProvisioned')
  assert.equal(found.length, 1, '面板级 datasource.uid 必须被采集到')
  assert.equal(found[0].title, '坏面板')
})

test('D4 采集面:折叠 row 内的子面板与模板变量都要纳入对账', () => {
  const refs = GATE.collectPanelRefs(() => [
    {
      file: 'y.json',
      json: {
        panels: [
          { type: 'row', panels: [{ title: '折叠里的面板', datasource: { uid: 'Loki' } }] },
          { title: '普通面板', datasource: { uid: 'Loki' } },
        ],
        templating: { list: [{ name: 'job', datasource: { uid: 'Loki' } }] },
      },
    },
  ])
  assert.equal(refs.length, 3, '折叠子面板 + 普通面板 + 模板变量 = 3 处引用')
  assert.ok(refs.some((r) => r.title === '折叠里的面板'), 'collapsed row 里的子面板不得漏掉')
  assert.ok(refs.some((r) => r.type === 'templating'), '模板变量的数据源也要对账(下钻靠它)')
})

test('D5 门体在真跑它的那一刻必须能跑完(曾出现自检全绿而门体入口根本没进)', () => {
  // 上一版把 isDirect 写成 file://${argv[1]},Windows 上少一个斜杠 ⇒ 恒 false ⇒ 门一次不跑。
  const out = execFileSync(process.execPath, [GATE_PATH, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(out, /self-test 通过/, '--self-test 必须真有输出(入口接线反证)')
})

test('D6 按树分组:deploy 树 provisioning 无 Loki 时,deploy 面板引 Loki 必须 dangling', () => {
  // 扩面立起来防的正是这个:合并成一个大池会让 monitoring 的 Loki 配置给 deploy 树
  // 的面板背书,而部署环根本没配 Loki —— 假放行,死配置过关。
  const deployProv = GATE.collectProvisionedUids(
    ['apiVersion: 1', 'datasources:', '  - name: Prometheus', '  - name: Jaeger', ''].join('\n')
  )
  const refs = GATE.collectPanelRefs(() => [
    { file: 'agent-runtime.json', json: { panels: [{ title: '日志面板', datasource: { uid: 'Loki' } }] } },
  ])
  const { dangling, unused } = GATE.auditTree(deployProv, refs)
  assert.equal(dangling.length, 1, '本树没配的数据源,面板引了就必须 dangling')
  assert.equal(dangling[0].uid, 'Loki')
  assert.ok(unused.includes('Jaeger'), '声明了没人用的要进 unused(判据 B 只报数)')
})

test('D7 门体全量面真跑:worktree 面必须 exit 0 且三棵树都过判据 A', () => {
  const out = execFileSync(process.execPath, [GATE_PATH, '--worktree'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(out, /树 monitoring/, 'monitoring 树必须出现在对账输出里')
  assert.match(out, /树 deploy\/observability/, 'deploy/observability 树必须出现在对账输出里(扩面反证)')
  assert.match(out, /树 deploy\/saas/, 'deploy/saas 树必须出现在对账输出里(2026-10-18 第三次扩面反证)')
  assert.doesNotMatch(out, /判据 A.*不存在|❌ 判据 A/, '工作树当前状态三棵树都不得有悬空 uid')
})

// ── 2026-10-18 失明案:覆盖面清单本身必须是对账对象 ──────────────────────────
// 前 7 例证明"树内的坏 uid 会被抓",但抓不到"清单静默漏掉一整棵树" ——
// deploy/saas 带着 10 处 Grafana 样例 uid PBFA97CFB590B2093(全仓任何 provisioning
// 都没有这个 uid)在 CI 视野外活了很久,正是因为 D1–D6 全都只判"清单里的树"。
// D8/D9 把"每棵 grafana/dashboards 树都要在 DASHBOARD_TREES 里登记"钉成判据。

test('D8 覆盖锁:仓内每一棵有面板的 grafana/dashboards 树都必须登记进 DASHBOARD_TREES', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\0')
    .filter(Boolean)
  const dirs = new Set(
    tracked.filter((p) => /(^|\/)grafana\/dashboards\/.*\.json$/.test(p)).map((p) => p.replace(/\/[^/]+$/, ''))
  )
  assert.ok(dirs.size >= 3, `正面前提:仓里至少应有 3 棵面板树(现读 ${dirs.size} 棵 ⇒ 取材可能失效)`)
  const covered = new Set(GATE.DASHBOARD_TREES.map((t) => t.dashboards))
  for (const d of dirs) {
    assert.ok(covered.has(d), `树 ${d} 有面板但未登记进 DASHBOARD_TREES ⇒ 该树悬空 uid 对 CI 失明`)
  }
  assert.ok(covered.has('deploy/saas/grafana/dashboards'), 'deploy/saas 必须在覆盖面内(2026-10-18 失明案本体)')
})

test('D9 新树真被扫:坏 uid 夹具走 saas 树同一判据链必须判 dangling(摘掉判据即翻红)', () => {
  const tree = GATE.DASHBOARD_TREES.find((t) => t.dashboards === 'deploy/saas/grafana/dashboards')
  assert.ok(tree, 'saas 树条目必须存在')
  const provText = readFileSync(resolve(ROOT, tree.provisioning), 'utf8')
  const provisioned = GATE.collectProvisionedUids(provText)
  assert.ok(provisioned.has('Prometheus'), 'saas provisioning 必须显式声明 Prometheus uid')
  assert.ok(!provisioned.has('PBFA97CFB590B2093'), '样例数据源 uid 不得出现在本仓 provisioning(夹具前提)')
  // 阳性对照:坏 uid 夹具喂给 saas 树的 provisioning,必须被同一判据链抓出
  const badRefs = GATE.collectPanelRefs(() => [
    { file: 'evil.json', json: { panels: [{ title: '坏板', type: 'timeseries', datasource: { type: 'prometheus', uid: 'PBFA97CFB590B2093' } }] } },
  ])
  assert.equal(GATE.auditTree(provisioned, badRefs).dangling.length, 1, '新树上的坏 uid 必须判红')
  // 反向对照:saas 树现行大屏(修好后)走同一链必须零 dangling
  const realRefs = GATE.collectPanelRefs(() =>
    readdirSync(resolve(ROOT, tree.dashboards))
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ file: f, json: JSON.parse(readFileSync(resolve(ROOT, tree.dashboards, f), 'utf8')) }))
  )
  assert.ok(realRefs.length >= 10, 'saas 树面板引用应现读 ≥10 处(取材失效反证)')
  assert.equal(GATE.auditTree(provisioned, realRefs).dangling.length, 0, '修复后的 saas 大屏不得再有悬空 uid')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
