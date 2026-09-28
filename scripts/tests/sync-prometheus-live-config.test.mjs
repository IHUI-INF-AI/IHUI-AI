// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
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

// ──────────── 落点解析(2026-09-28:自取盘符 → 共用出口 devEnvRoot(),§15b 唯一外置根) ────────────
// 旧写法自己从 ROOT 切出盘符首字符再拼 `<盘>:\DevEnv\monitor\prometheus`,与 `gitdir.mjs` /
// `seal-c-root-stray.mjs` 是同一件事的第三份实现;它头注还称"与 gitArchiveDir()/devEnvRoot()
// 同一套推导",而 gitdir 那侧自 `971690247` 起已是盘根锚定 + 夹具闸,那句话名不副实。
// 现接共用出口。oracle 刻意**不 import 被测出口**(§22c:不得拿实现给自己发合格证),
// 改按 `parse(仓根).root` 独立算一遍,并把"改前那个式子"与它在当前布局下同值一起判。
const REPO_FROM_TEST = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DRIVE_ANCHORED = join(parse(REPO_FROM_TEST).root, 'DevEnv')
const OLD_DRIVE_LETTER_FORM = join(`${REPO_FROM_TEST.slice(0, 1).toUpperCase()}:\\`, 'DevEnv')

test('T9 真值不变:共用出口落点与"改前自取盘符式"逐字同值', () => {
  assert.equal(
    OLD_DRIVE_LETTER_FORM,
    DRIVE_ANCHORED,
    'oracle 前提:仓在 <盘>:/<仓名> 布局下,取盘符首字符与盘根锚定同值 —— 不成立则本用例不构成"真值不变"证明',
  )
  assert.deepEqual(__test__.CANDIDATE_LIVE_DIRS, [join(DRIVE_ANCHORED, 'monitor', 'prometheus')])
})

test('T10 共用出口真被 consult:IHUI_DEVENV_ROOT 改写候选落点(摘掉接线即红)', () => {
  const dir = mkScratch('prom-devenv-root')
  const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'sync-prometheus-live-config.mjs')
  const r = spawnSync(process.execPath, [script, '--check'], {
    env: { ...process.env, IHUI_DEVENV_ROOT: dir },
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  try {
    assert.equal(r.status, 2, `注入根下找不到运行副本必须判"未判定"exit 2,实得 status=${r.status} stderr=${String(r.stderr).slice(0, 200)}`)
    const want = join(resolve(dir), 'monitor', 'prometheus')
    assert.ok(
      String(r.stderr).includes(want),
      `报告的"试过:"必须点名注入后的落点(点名旧推导 = 共用出口没被 consult),实得 stderr=${String(r.stderr).slice(0, 400)}`,
    )
    assert.equal(existsSync(join(dir, 'monitor')), false, '只问一次路径就在候选落点上长出目录 = 解析带写副作用')
  } finally {
    rmScratch(dir)
  }
})

test('T11 反向锁:不得再自取盘符,必须真的 import 共用出口', () => {
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'sync-prometheus-live-config.mjs'), 'utf8')
  assert.equal(/slice\(0, *1\)/.test(src), false, '自取盘符首字符那一份实现不得回来(否则同一件事又有两个答案)')
  assert.equal(/function\s+devEnvRoot\s*\(/.test(src), false, '本文件不得再声明私有 devEnvRoot —— 落点只许有一个出口')
  assert.match(src, /import \{ devEnvRoot \} from '\.\/seal-c-root-stray\.mjs'/, '必须真的 import 共用出口(§22c 装车证明)')
  // 边界如实登记:共用出口不接收工作树参数(锚在它自己的模块位置),所以"两层深夹具 ⇒ 落点跟着
  // 夹具走"这一维**未被本票关闭**;要关它得在 seal-c-root-stray 侧照 `971690247` 对 gitdir 做的事
  // 改盘根锚定 + 夹具闸,或改用 gitdir 的 gitArchiveRootFor(语义是 <盘>/DevEnv/backups/git,不符)。
  const sealSrc = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'seal-c-root-stray.mjs'), 'utf8')
  assert.match(sealSrc, /export function devEnvRoot\(\)/, '共用出口签名已变(开始接收参数?)⇒ 上面那段边界登记需重新判定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
