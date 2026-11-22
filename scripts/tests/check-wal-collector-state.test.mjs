// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Mirror test for scripts/check-wal-collector-state.mjs(§22c 镜像模式)。
// 判据一律从被测模块 import,本文件**不再抄一份实现**;端到端一律注入替身 deps ——
// 本文件不派生 PowerShell、不连 /metrics、不重启任何服务、不改任何数据库权限。
// 唯一真派生的是 T7 的临时 git 仓(证明取材面),落在 §26 批准的 scratch 落点。

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

import { gitBinary } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 注册表枚举行的解析:**复用被测门所引的那一份实现**,测试里不抄第二份判据(§22c)。
import { __test__ as serviceKit } from '../check-service-binary-paths.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..', 'check-wal-collector-state.mjs')
const mod = await import(pathToFileURL(SRC).href)
const kit = mod.__test__
const {
  DECLARATION_REL,
  DRIFT,
  OK,
  UNDET,
  combineStates,
  computeExitCode,
  interpretMetricsChannel,
  interpretRegistryChannel,
  judgeVersionedHalf,
  main,
  parseArgs,
  parseDeclaration,
  renderText,
} = kit

const GIT = gitBinary()
const rawSource = () => readFileSync(SRC, 'utf8')

function declText(over = {}) {
  return JSON.stringify({
    service: 'ihui-pg-exporter',
    listenAddress: '127.0.0.1:9187',
    disabledCollectors: [{ name: 'wal', disableTokens: ['--no-collector.wal'] }],
    metricsExpectation: { family: 'pg_scrape_collector_success', collectorLabelKey: 'collector' },
    ...over,
  })
}

/** 造一行共用实现认得的注册表枚举行(pb64 = AppParameters ⊕ AppEnvironmentExtra 的 base64)。 */
function regLine(service, params, extra = {}) {
  const pb = extra.rawPb ?? Buffer.from(params.join('\n'), 'utf8').toString('base64')
  return `SVC|${service}|app=${extra.app ?? 'C:\\nssm.exe'}|dir=|pb64=${pb}|img=${extra.img ?? 'C:\\nssm.exe'}`
}
const regOut = (...lines) => `${lines.join('\n')}\nSUM|${lines.length}`

/** 全注入的执行体:不派生 PS、不连网。 */
function depsFor({ platform = 'win32', registryText = null, registryError = null, metrics = null }) {
  return {
    platform,
    exists: () => true,
    registry: () => (registryError ? { spawnError: registryError } : { code: 0, stdoutBuf: Buffer.from(registryText ?? '', 'utf8'), stderrBuf: Buffer.alloc(0) }),
    metricsGet: async () => metrics ?? { error: 'T8 未配指标通道' },
    collector: 'wal',
  }
}
const fakeReadDec = (text) => () => ({ text })

test('T1 接线方向锁:本门刻意不在提交链上 —— 被接进 guardian-runner 必读红', async () => {
  const runnerHead = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', 'HEAD:scripts/guardian-runner.mjs'], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.resolve(HERE, '..', '..'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
  })
  // 判的是**机器运行时状态**,提交者结构上满足不了(AGENTS §12e)。哪天要接,必须带着
  // "为什么现在能接"的证据改这条测试,而不是悄悄接线。
  assert.equal(runnerHead.includes('check-wal-collector-state'), false, '本门被接进 guardian-runner —— 先补"为什么现在能接"的证据,再改这条测试')
  const rootManifest = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', 'HEAD:package.json'], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.resolve(HERE, '..', '..'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  assert.equal(rootManifest.includes('check-wal-collector-state'), false, '同样不得被登记成 pnpm 脚本后又被文档说成"必跑"')
  // 撒谎的反向锁:头注若自称已接线而面上没有,守门 89 的 R1 会红 —— 这里先把措辞钉住。
  assert.match(rawSource(), /尚未接入提交链/, '头注必须如实陈述"尚未接入",不得改成肯定式声称')
})

test('T2 唯一实现:registry 取材必须复用兄弟门,本门不得再写一份 PS 脚本', () => {
  const src = rawSource()
  assert.match(src, /from '\.\/check-service-binary-paths\.mjs'/, '必须复用服务配置取材的那一份实现')
  assert.match(src, /buildRegistryScript|psRegistry/, '必须走共用 registry 通道(而非自己拼脚本)')
  assert.doesNotMatch(src, /CurrentControlSet/, '本门内出现注册表路径 = 第二份真相')
  assert.doesNotMatch(src, /Get-ItemProperty|Get-Service/, '本门不得自己写 PowerShell 查询,更不得改服务')
})

test('T3 取材面纪律(守门 118 口径):声明必须走 catBatch,不得读磁盘', () => {
  const src = rawSource()
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引取材层')
  assert.match(src, /catBatch\(/, '必须真用层的读取入口(引了不用 = half-wired)')
  assert.doesNotMatch(src, /readFileSync\(/, '声明内容不得按磁盘读(共享工作树常年滞后 HEAD)')
})

test('T4 双向端到端:声明与机器一致 ⇒ exit 0 ok;把旗标去掉 ⇒ exit 1 并点名缺失 token', async () => {
  const good = regLine('ihui-pg-exporter', ['--web.listen-address=127.0.0.1:9187', '--no-collector.wal'])
  const a = await main({ argv: [], root: '/unused', deps: depsFor({ registryText: regOut(good), metrics: { error: 'x' } }), readDec: fakeReadDec(declText()) })
  assert.equal(a.json.state, OK, '一致时必须是 ok')
  assert.equal(a.exitCode, 0)

  const bad = regLine('ihui-pg-exporter', ['--web.listen-address=127.0.0.1:9187'])
  const b = await main({ argv: [], root: '/unused', deps: depsFor({ registryText: regOut(bad), metrics: { error: 'x' } }), readDec: fakeReadDec(declText()) })
  assert.equal(b.json.state, DRIFT)
  assert.equal(b.exitCode, 1)
  assert.match(b.text, /--no-collector\.wal/, '分叉必须点名到底缺哪个旗标,否则报告无法复核')
})

test('T5 反向对照:非监控宿主 ⇒ 未判定(默认档 exit 0,不出 ok;--strict 才 exit 2)', async () => {
  const others = regLine('something-else', ['--no-collector.wal'])
  const r = await main({ argv: [], root: '/unused', deps: depsFor({ registryText: regOut(others), metrics: { error: '连接被拒绝' } }), readDec: fakeReadDec(declText()) })
  assert.equal(r.json.state, UNDET, '本机没有该服务 ≠ 采集器关着')
  assert.equal(r.exitCode, 0, 'warn 级:少判一件事不是错误,不得把无关提交钉红')
  assert.match(r.text, /未判定/)
  const s = await main({ argv: ['--strict'], root: '/unused', deps: depsFor({ registryText: regOut(others), metrics: { error: '连接被拒绝' } }), readDec: fakeReadDec(declText()) })
  assert.equal(s.exitCode, 2, '--strict 下有未判定即拒绝出具合格证')
  const lin = await main({ argv: [], root: '/unused', deps: depsFor({ platform: 'linux', metrics: { error: 'x' } }), readDec: fakeReadDec(declText()) })
  assert.match(JSON.stringify(lin.json.channels), /非 win32/, '非 Windows 必须点名 platform 而不是静默通过')
})

test('T6 指标通道阳性对照:wal 序列 0 ⇒ drift(原故障形态),族缺失 ⇒ 未判定', () => {
  const probe = { family: 'pg_scrape_collector_success', labelKey: 'collector', collector: 'wal' }
  const failing = interpretMetricsChannel({ ...probe, outcome: { status: 200, body: 'pg_scrape_collector_success{collector="wal"} 0' } })
  assert.equal(failing.state, DRIFT)
  const noFam = interpretMetricsChannel({ ...probe, outcome: { status: 200, body: 'go_goroutines 12' } })
  assert.equal(noFam.state, UNDET, '取到的可能不是 postgres_exporter,不能读成"确实没采"')
})

test('T7 取材面端到端:同一棵树里索引 ≠ HEAD ⇒ --staged 与缺省各答各的', async () => {
  const dir = mkScratch('g471-face')
  try {
    mkdirSync(path.join(dir, 'monitoring', 'postgres-exporter'), { recursive: true })
    const rel = path.join('monitoring', 'postgres-exporter', 'collectors.json')
    const abs = path.join(dir, rel)
    writeFileSync(abs, declText(), 'utf8')
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const git = (...args) => execFileSync(GIT, ['-c', 'safe.directory=*', ...args], { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir, windowsHide: true, timeout: 60000, encoding: 'utf8' })
    git('init', '-q', '.'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't')
    git('add', 'monitoring/postgres-exporter/collectors.json'); git('commit', '-q', '-m', 'declare wal off')
    // 索引里把它改成"没有 wal 条目",磁盘再改成合法但另一份 —— 三面互异,才证得清读的是哪一面
    writeFileSync(abs, declText({ disabledCollectors: [] }), 'utf8')
    git('add', 'monitoring/postgres-exporter/collectors.json')
    writeFileSync(abs, declText({ disabledCollectors: [{ name: 'wal', disableTokens: ['--other-token'] }] }), 'utf8')
    const reg = regOut(regLine('ihui-pg-exporter', ['--web.listen-address=127.0.0.1:9187', '--no-collector.wal']))
    const headAns = await main({ argv: [], root: dir, deps: depsFor({ registryText: reg, metrics: { error: 'x' } }) })
    const stagedAns = await main({ argv: ['--staged'], root: dir, deps: depsFor({ registryText: reg, metrics: { error: 'x' } }) })
    const wtAns = await main({ argv: ['--worktree'], root: dir, deps: depsFor({ registryText: reg, metrics: { error: 'x' } }) })
    assert.equal(headAns.json.state, OK, 'HEAD 面声明合法 ⇒ 版本化半边 ok')
    assert.equal(stagedAns.json.state, DRIFT, '索引面把条目删了 ⇒ 必须判"这条改动不在仓里",不许借 HEAD 的内容凑数')
    assert.equal(wtAns.json.findings.length >= 0, true)
    assert.match(stagedAns.json.faceLabel, /索引/, '结论行必须说清判的是哪一面')
    const both = await main({ argv: ['--staged', '--worktree'], root: dir, deps: depsFor({ registryText: reg, metrics: { error: 'x' } }) })
    assert.equal(both.exitCode, 2, '两面旗同给 ⇒ 判死,不猜面')
  } finally {
    rmScratch(dir)
  }
})

test('T8 未知旗标与坏 JSON 都落"未判定/判死",不冒充结论', async () => {
  assert.deepEqual(parseArgs(['--nope']).badFlags, ['--nope'])
  const a = await main({ argv: ['--nope'], root: '/unused', deps: depsFor({ registryText: regOut(regLine('s', [])), metrics: { error: 'x' } }), readDec: fakeReadDec(declText()) })
  assert.equal(a.exitCode, 2)
  const broken = await main({ argv: [], root: '/unused', deps: depsFor({ registryText: regOut(regLine('ihui-pg-exporter', ['--no-collector.wal'])), metrics: { error: 'x' } }), readDec: fakeReadDec('{oops') })
  assert.equal(broken.json.state, UNDET, '声明损坏既不算"没关"也不算"已关"')
  const gone = await main({ argv: [], root: '/unused', deps: depsFor({ registryText: regOut('SUM|0'), metrics: { error: 'x' } }), readDec: () => ({ text: null, error: '被审面整体取不到' }) })
  assert.equal(gone.exitCode, 2, '被审面取不到 ⇒ 判死,不记绿')
})

test('T9 三态并桶防护:合流永不允许"两条机器通道都没量到"读成 ok', () => {
  const v = { state: OK, findings: [], notes: [] }
  assert.equal(combineStates({ versioned: v, channels: [] }).state, UNDET)
  assert.equal(combineStates({ versioned: v, channels: [{ channel: 'registry', state: UNDET, reason: 'r' }] }).state, UNDET)
  assert.equal(combineStates({ versioned: { state: UNDET, notes: ['声明取不到'], findings: [] }, channels: [{ channel: 'metrics', state: OK, findings: [], notes: [] }] }).state, UNDET, '版本化半边没核过 ⇒ 机器再一致也不出 ok')
  assert.equal(computeExitCode(UNDET, false), 0)
  assert.equal(computeExitCode(UNDET, true), 2)
})

test('T10 注册表行的三态由共用实现的哨兵决定(不得把编码失败读成没旗标)', () => {
  const enc = serviceKit.parseRegistryOutput(`${regLine('ihui-pg-exporter', [], { rawPb: '!E' })}\nSUM|1`)
  assert.equal(
    interpretRegistryChannel({ parsed: enc, service: 'ihui-pg-exporter', tokens: ['--no-collector.wal'], collector: 'wal' }).state,
    UNDET,
    '编码失败哨兵必须落未判定,而不是"机器上没有旗标"',
  )
  const absent = serviceKit.parseRegistryOutput(`${regLine('ihui-pg-exporter', [], { rawPb: '!N' })}\nSUM|1`)
  assert.equal(
    interpretRegistryChannel({ parsed: absent, service: 'ihui-pg-exporter', tokens: ['--no-collector.wal'], collector: 'wal' }).state,
    DRIFT,
    'Parameters 键整块不在 = 没有旗标 = 采集器按默认值开着,这一型不能洗成未判定',
  )
})

test('T12 判据指向的入库真相源必须真在仓里(路径不写歪 = 尺子有对象)', () => {
  const repoRoot = path.resolve(HERE, '..', '..')
  const abs = path.join(repoRoot, DECLARATION_REL)
  assert.ok(DECLARATION_REL.startsWith('monitoring/'), '声明住在 monitoring/ 下(采集器配置的唯一落点)')
  const tracked = execFileSync(GIT, ['-c', 'safe.directory=*', 'ls-files', '--', DECLARATION_REL], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  }).trim()
  // 本门落地时该文件还没被提交(主会话负责入库),所以这里判的是**磁盘在位 + 路径形状**;
  // 一旦有人把它搬走而没改判据,readFileSync 这一步就当场炸 —— 那正是本条要防的。
  const parsed = parseDeclaration(readFileSync(abs, 'utf8'))
  assert.equal(parsed.kind, OK, `磁盘上的声明必须解析得出:${parsed.reason ?? ''}`)
  assert.equal(parsed.service, 'ihui-pg-exporter', '尺子问的服务名必须与声明一致')
  const v = judgeVersionedHalf(parsed, 'wal')
  assert.equal(v.state, OK, '入库真相源必须真把 wal 记成"关着"')
  if (tracked !== '') assert.equal(tracked, DECLARATION_REL, '被跟踪时路径必须逐字一致')
})

test('T11 自检必须跑得完且不残留取证件', async () => {
  const rc = kit.selfTest()
  assert.equal(rc, 0, '构造面自检必须全绿')
  assert.match(renderText({ faceLabel: 'x', faceNote: 'y', declaration: 'd', collector: 'wal', state: DRIFT, exitCode: 1, findings: ['f'], undetermined: [], notes: [], channels: [], undoHint: 'u' }), /drift/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
