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

test('T3 多条规则文件必须逐条映射成绝对路径(旧写法收敛成一条 = 第二份规则静默不装载),且后面的顶层键不被吃掉', () => {
  // 立因(2026-10-17 实测):仓库里加了 alerts-ai.yml 之后,老派生逻辑把 rule_files 整段
  // 替换成单条 alerts.yml 绝对路径 ⇒ 运行副本里第二条是**相对路径**,Prometheus 在
  // D:\DevEnv\monitor\prometheus\ 下找不到它 ⇒ AI 告警组一条都不装载,而 POST /-/reload
  // 仍返回 200、账面"热加载成功"。判据"只应剩一条"把这个缺陷钉成了规矩,现予更正:
  // 列表长度必须与仓库同源,顺序保留,块内缩进注释保留。
  const src = "rule_files:\n  - 'a.yml'\n  # 组说明(块内注释必须留着)\n  - 'b.yml'\nalerting:\n  alertmanagers:\n    - static_configs:\n        - targets: ['x:9093']\n"
  const out = deriveLiveConfig(src, 'D:\\r\\alerts.yml')
  const listed = out.split('\n').filter((l) => /^\s*- /.test(l) && l.includes('yml'))
  assert.equal(listed.length, 2, '规则列表条数必须与仓库同源(第二条被吃掉 = 该组静默不装载)')
  assert.ok(listed[0].includes('D:\\r\\a.yml'), `第一条须为仓库绝对路径,实得:${listed[0]}`)
  assert.ok(listed[1].includes('D:\\r\\b.yml'), `第二条须为仓库绝对路径,实得:${listed[1]}`)
  assert.ok(out.includes('组说明'), '块内缩进注释必须逐字保留(它记的是这条规则为什么存在)')
  assert.ok(!/^\s*-\s+'b\.mls?'/m.test(out), '不得残留相对路径的第二条')
  assert.ok(out.includes('alerting:'), 'rule_files 之后的顶层键不得被当列表项吞掉')
  assert.ok(out.includes("'x:9093'"), 'alertmanager 目标必须还在')
})

test('T4 幂等:对同一份源连派两次结果逐字相同', () => {
  const src = readFileSync(CONFIG_SRC, 'utf8')
  assert.equal(deriveLiveConfig(src, RULES_IN_REPO), deriveLiveConfig(src, RULES_IN_REPO))
})

/**
 * T5 派生不得增删 job,且**规则里精确引用的每个 job 都必须在抓取面内**。
 *
 * 为什么把硬名单换成"从规则里推":原名单写死 `['alertmanager','alertbridge','loki','promtail','grafana']`,
 * 里面 `grafana` 那一格的前提**已经腐烂**。2026-10-21 三面现读证伪:
 *   ① 仓源与运行副本都**没有** `job_name: grafana`(各 grep = 0);
 *   ② 8816 `curl` = 000 拒连,`sc query IHUI-GRAFANA` 报"指定的服务未安装"(大屏 2026-10-18 退役,
 *      唯一入口改为项目页);
 *   ③ alerts*.yml 里没有任何一条规则引用 grafana ⇒ 它声称的"依赖该 job 的 Down 告警"不存在。
 * 更坏的走向是照名单去补 job:抓一个不存在的端点会让 `up{job="grafana"}` 恒 0,将来谁补一条 Down
 * 规则就秒变"永远响的告警"(本仓配置自己的注释就点过这个坑)。名单会腐烂,而"规则引用了什么"不会。
 *
 * 豁免也不是随手写的:唯一来源是 alerts.yml 顶部那行 `LOG_SOURCE_ANCHOR`(它登记了哪些 job 值是
 * 日志源锚点而非抓取目标,`monitorlogs` 即属此类 —— 它被精确引用却按设计不被抓取)。
 * 从**那行本身**读,不在这份测试里再抄一份清单(§0.6);对不上时红的是登记面。
 */
const jobSetOf = (t) => new Set([...t.matchAll(/job_name:\s*'?([A-Za-z0-9_-]+)'?/g)].map((m) => m[1]))
const ruleFilesOf = (src) => {
  // 从 `rule_files:` 抓到**下一个顶层键**为止(块内允许夹注释行 —— 派生器自己也保留它们),
  // 再取块内所有列表项。原先按"连续条目行"匹配会被那条注释截断,只读到一份规则文件。
  const start = src.split(/\r?\n/).findIndex((l) => /^rule_files:\s*$/.test(l))
  if (start < 0) return []
  const lines = src.split(/\r?\n/).slice(start + 1)
  const end = lines.findIndex((l) => /^[^\s#-]/.test(l))
  const block = (end < 0 ? lines : lines.slice(0, end)).join('\n')
  return [...block.matchAll(/^\s*-\s+'([^']+)'/gm)].map((m) => m[1])
}
/** 纯判据:规则精确引用的 job 必须可抓;锚点行登记的例外放行。返回缺的口清单。 */
function missingScrapedJobs({ configText, rulesTexts, anchorRule }) {
  const jobs = jobSetOf(configText)
  const exact = new Set()
  for (const t of rulesTexts) for (const m of t.matchAll(/job="([A-Za-z0-9_-]+)"/g)) exact.add(m[1])
  const exempt = new Set(anchorRule ? [...anchorRule[1].matchAll(/job=~?"([^"]+)"/g)].flatMap((x) => x[1].split('|')) : [])
  return [...exact].filter((j) => !jobs.has(j) && !exempt.has(j)).sort()
}

test('T5 真仓形态:派生不增删 job,且规则精确引用的 job 全部可抓(锚点例外读它自己的登记行)', () => {
  const src = readFileSync(CONFIG_SRC, 'utf8')
  const out = deriveLiveConfig(src, RULES_IN_REPO)
  const before = jobSetOf(src)
  const after = jobSetOf(out)
  assert.ok(before.size >= 10, `真实配置应有 ≥10 个 job,现读 ${before.size}`)
  assert.deepEqual([...after].sort(), [...before].sort(), '派生不得增删 job')

  const rulesDir = dirname(RULES_IN_REPO)
  const rulesTexts = ruleFilesOf(src).map((rel) => readFileSync(join(rulesDir, ...rel.split('/')), 'utf8'))
  assert.ok(rulesTexts.length >= 2, `rule_files 应 ≥2 份(alerts 与 alerts-ai),现读 ${rulesTexts.length} ⇒ 抽取式失灵,本条什么都没测`)
  const anchor = rulesTexts.join('\n').match(/^#\s*LOG_SOURCE_ANCHOR:(.*)$/m)
  assert.ok(anchor, 'alerts.yml 顶部那行 LOG_SOURCE_ANCHOR 不在位 ⇒ 例外清单失去了唯一来源,不许猜')
  assert.deepEqual(
    missingScrapedJobs({ configText: src, rulesTexts, anchorRule: anchor }),
    [],
    '有规则精确引用了抓取面里不存在的 job(该规则恒不成立 = 该响永远不响),或缺了登记',
  )

  // 阳性对照:换成"引用一个不存在的 job"的规则必须判出缺口 —— 否则上面那条深绿是恒真式。
  const poisoned = missingScrapedJobs({
    configText: src,
    rulesTexts: ['expr: up{job="no-such-ihui-job"} == 0'],
    anchorRule: anchor,
  })
  assert.deepEqual(poisoned, ['no-such-ihui-job'], '抽取式对真缺口不敏感 ⇒ 本测试替缺陷背书')
  // 反证之二:锚点行登记的值必须被放行(否则 monitorlogs 那一格天天红,变恒红门)。
  assert.deepEqual(
    missingScrapedJobs({ configText: src, rulesTexts: ['expr: up{job="monitorlogs"} == 0'], anchorRule: anchor }),
    [],
    '锚点登记的例外没被放行 ⇒ 下一个改动会撞上一道与本票无关的恒红',
  )
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
  // 启动免疫还账(2026-10-22):改前式子对盘符首字符做 toUpperCase(),盘根锚定则原样保留启动拼写
  // (`node d:\…` 起 ⇒ 'd:\DevEnv',`node D:\…` 起 ⇒ 'D:\DevEnv')——两式断言的是**同一盘根**,
  // 不是同一大小写;Windows 盘符不分大小写,按首字符归一后逐字比,启动拼写不再能造出假红。
  const upperDrive = (p) => p.charAt(0).toUpperCase() + p.slice(1)
  assert.equal(
    upperDrive(OLD_DRIVE_LETTER_FORM),
    upperDrive(DRIVE_ANCHORED),
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
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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
  // 边界重判(2026-10-21,签名哨兵变红后的还账):哨兵红是因为 `7ec2b804aa2`(G-345 第④格)把
  // 共用出口改成 `devEnvRoot(repoRoot = REPO)` —— 它开始接收工作树参数了。旧登记写"要关'两层深
  // 夹具 ⇒ 落点跟着夹具走'这一维,需要 改盘根锚定 + 夹具闸",而那次提交恰好把这两个条件都补齐了:
  //   ① 盘根锚定:推导问 `path.parse(repoRoot).root` 要根(对任何深度都稳定,不再向上数两级);
  //   ② 夹具闸:`countScratchSegments(repoRoot) > 0` 当场抛错(落点绝不静默跟着夹具走)。
  // 所以那一维**已关闭**,不再是未决登记。本票调用方仍无参调用(`devEnvRoot()`),落点锚在 seal
  // 自己的模块位置,与改前逐字同值。哨兵现在钉的是**这段登记所依赖的条件**而不是签名本身 ——
  // 任一条件被摘(夹具闸删了/锚定退回数两级/调用方开始传参)都会红,不让登记再次腐烂成注释化石。
  const sealSrc = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'seal-c-root-stray.mjs'), 'utf8')
  assert.match(sealSrc, /export function devEnvRoot\(repoRoot = REPO\)/, '共用出口签名又变了 ⇒ 上面那段边界登记需重新判定')
  assert.match(sealSrc, /countScratchSegments\(repoRoot\) > 0/, '夹具闸被摘 ⇒ "落点跟着夹具走"那一维重新打开,登记需重新判定')
  assert.match(sealSrc, /parse\(repoRoot\)\.root/, '盘根锚定退回"向上数两级" ⇒ 深层工作树会把 DevEnv 推进别人目录,登记需重新判定')
  assert.match(src, /devEnvRoot\(\)/, '调用方开始传工作树参数 ⇒ 落点锚定随调用方走,本段"锚在 seal 模块位置"的登记失效,需重新判定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
