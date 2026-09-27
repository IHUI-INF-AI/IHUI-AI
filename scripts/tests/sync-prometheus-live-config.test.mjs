// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { __test__ } from '../sync-prometheus-live-config.mjs'

const { deriveLiveConfig, findLiveDir, CONFIG_SRC, RULES_IN_REPO } = __test__

test('T1 只替换 rule_files 那一处,其余逐字保留', () => {
  const src = "global:\n  scrape_interval: 15s\nrule_files:\n  - 'alerts.yml'\nscrape_configs:\n  - job_name: 'api'\n    static_configs:\n      - targets: ['localhost:8802']\n"
  const out = deriveLiveConfig(src, 'D:\\Repo\\monitoring\\prometheus\\alerts.yml')
  assert.ok(out.includes("  - 'D:\\Repo\\monitoring\\prometheus\\alerts.yml'"), '规则路径必须被写成仓库绝对路径')
  assert.ok(!out.includes("'alerts.yml'\nscrape"), '旧的相对路径不得残留')
  for (const keep of ['global:', 'scrape_interval: 15s', "job_name: 'api'", "targets: ['localhost:8802']"]) {
    assert.ok(out.includes(keep), `应原样保留:${keep}`)
  }
})

test('T2 找不到 rule_files 段 ⇒ 拒绝产出(而不是给出一份无规则的配置)', () => {
  assert.throws(
    () => deriveLiveConfig("global:\n  scrape_interval: 15s\nscrape_configs: []\n", 'D:\\x\\alerts.yml'),
    /rule_files/,
  )
})

test('T3 多条列表项必须收敛成一条,且后面的顶层键不被吃掉', () => {
  const src = "rule_files:\n  - 'a.yml'\n  - 'b.yml'\nalerting:\n  alertmanagers:\n    - static_configs:\n        - targets: ['x:9093']\n"
  const out = deriveLiveConfig(src, 'D:\\r\\alerts.yml')
  const listed = out.split('\n').filter((l) => /^\s*- /.test(l) && l.includes('yml'))
  assert.equal(listed.length, 1, '规则列表只应剩一条')
  assert.ok(out.includes('alerting:'), 'rule_files 之后的顶层键不得被当列表项吞掉')
  assert.ok(out.includes("'x:9093'"), 'alertmanager 目标必须还在')
})

test('T4 幂等:对同一份源连派两次结果逐字相同', () => {
  const src = readFileSync(CONFIG_SRC, 'utf8')
  assert.equal(deriveLiveConfig(src, RULES_IN_REPO), deriveLiveConfig(src, RULES_IN_REPO))
})

// §22c 的硬要求:判据对象是真实文件形态时,至少一条用例的输入必须逐字取自那个真实文件。
// 否则夹具复刻的是实现形状,测试只会替缺陷背书。
test('T5 真仓 prometheus.yml 派生后:job 清单一条不少,规则指向仓库那份', () => {
  const src = readFileSync(CONFIG_SRC, 'utf8')
  const out = deriveLiveConfig(src, RULES_IN_REPO)
  const jobsOf = (t) => [...t.matchAll(/job_name:\s*'?([A-Za-z0-9_-]+)'?/g)].map((m) => m[1])
  const before = new Set(jobsOf(src))
  const after = new Set(jobsOf(out))
  assert.ok(before.size >= 10, `真实配置应有 ≥10 个 job,现读 ${before.size}`)
  for (const j of ['alertmanager', 'alertbridge', 'loki', 'promtail', 'grafana']) {
    assert.ok(after.has(j), `部署机副本必须带上 ${j} —— 缺它则依赖该 job 的 Down 告警恒不成立`)
  }
  assert.deepEqual([...after].sort(), [...before].sort(), '派生不得增删 job')
})

test('T6 运行副本目录不在位时如实报不可达(而不是猜一个路径去写)', () => {
  assert.equal(findLiveDir('D:\\no-such-dir-ihui-prometheus-test'), null)
})

// 本仓真实事故的回归:派生器"只搬不看",把仓库里一行占位符口令烘进了线上抓取配置,
// 结果 exporter 恒 401、主机磁盘/内存告警长期哑,而账面全绿。
test('T7 配置里有占位符凭据 ⇒ 拒绝派生(而不是把占位符送进生产)', () => {
  const bad =
    "rule_files:\n  - 'alerts.yml'\nscrape_configs:\n  - job_name: 'windows'\n    basic_auth:\n      username: prometheus\n      password: __REPLACE_WITH_DEPLOY_SECRET__\n"
  assert.throws(() => deriveLiveConfig(bad, 'D:\\r\\alerts.yml'), /占位符/)
  // 正确写法必须放过 —— 否则本判据会变成一台谁都过不去的恒红门
  const good = bad.replace('password: __REPLACE_WITH_DEPLOY_SECRET__', "password_file: 'D:/DevEnv/secrets/x.txt'")
  assert.ok(deriveLiveConfig(good, 'D:\\r\\alerts.yml').includes('password_file'))
})

test('T8 真仓配置今天必须过占位符守卫(它曾因占位符进过生产)', () => {
  assert.doesNotThrow(() => deriveLiveConfig(readFileSync(CONFIG_SRC, 'utf8'), RULES_IN_REPO))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
