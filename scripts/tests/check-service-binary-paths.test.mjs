// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Mirror test for scripts/check-service-binary-paths.mjs (§22c pattern).
// 判据一律从被测模块 import(§22c:测试里不得再抄一份实现);端到端用注入的假 deps,
// 本文件自身不派生 PowerShell / nssm,也不碰任何服务。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'check-service-binary-paths.mjs')
const rawSource = () => readFileSync(SRC, 'utf8')
const mod = await import(pathToFileURL(SRC).href)
const { __test__ } = mod
const {
  measured,
  unmeasured,
  decodeNssm,
  interpretNssmGet,
  extractPortsFromConfig,
  parseServiceList,
  compileFilter,
  judgeService,
  computeExitCode,
  buildEnumerationScript,
  main,
  renderText,
  ENUM_HEAD,
  ENUM_TAIL,
} = __test__

const u16 = (s) => Buffer.from(s, 'utf16le')
const okNssm = (text) => ({ code: 0, stdoutBuf: u16(text), stderrBuf: Buffer.alloc(0) })
const failNssm = (code = 1) => ({ code, stdoutBuf: Buffer.alloc(0), stderrBuf: u16('svc config read failed') })

/** 构造一台"全部取到且都好"的假机;每个键都可单独拆走,正反对由此成对。 */
function healthyDeps(over = {}) {
  const params = {
    Application: 'C:\\node\\node.exe',
    AppDirectory: 'C:\\app',
    AppParameters: 'dist\\index.mjs',
    AppEnvironmentExtra: 'PORT=8802',
    ...over.params,
  }
  return {
    platform: 'win32',
    host: () => 'TESTBOX',
    psEnumerate:
      over.psEnumerate ??
      (() => ({ code: 0, stdoutBuf: Buffer.from(`${ENUM_HEAD}\nSVC|IHUI-TEST|Running|Automatic\n${ENUM_TAIL}\n`, 'utf8'), stderrBuf: Buffer.alloc(0) })),
    resolveNssm: over.resolveNssm ?? (() => 'C:\\fake\\nssm.exe'),
    nssmGet:
      over.nssmGet ??
      ((p, svc, param) => {
        if (param in params) {
          const v = params[param]
          return v === '' ? { code: 0, stdoutBuf: u16('\r\n'), stderrBuf: Buffer.alloc(0) } : okNssm(v)
        }
        return failNssm()
      }),
    fileKind:
      over.fileKind ??
      ((p) => {
        if (over.kinds && p in over.kinds) return over.kinds[p]
        return 'file' // 默认一切"存在";目录按 file 判会被 AppDirectory 规则挑出,故默认表里显式给
      }),
    tcpProbe:
      over.tcpProbe ??
      (async (port) => ({ status: port === 8802 ? 'open' : 'closed' })),
  }
}
// AppDirectory 需要 dir:默认按已知路径给档;over.kinds 可逐路径覆盖(正反对照就拆这里)。
function deps(over = {}) {
  const kinds = { 'C:\\node\\node.exe': 'file', 'C:\\app': 'dir', ...(over.kinds || {}) }
  const rest = { ...over }
  delete rest.kinds
  return healthyDeps({ fileKind: (p) => kinds[p] ?? 'missing', ...rest })
}

const healthyRec = (over = {}) => ({
  name: 'X',
  state: measured('RUNNING'),
  application: measured('C:\\node\\node.exe'),
  appExists: measured('file'),
  appDirectory: measured('C:\\app'),
  appDirectoryExists: measured('dir'),
  ports: measured([8802]),
  probe: measured({ listening: true, ports: [8802] }),
  ...over,
})

test('T1 §22d:import 本模块不得触发任何派生;守卫与 main 在位', async () => {
  const src = rawSource()
  assert.ok(src.includes('pathToFileURL(process.argv[1]).href'), '§22d 守卫比较式不见了 ⇒ import 就可能派生 PowerShell')
  assert.ok(/if \(isDirectRun\) \{[\s\S]{0,120}main\(\)/.test(src), '守卫块里没有 main() ⇒ 命令行档是空的')
  const t0 = Date.now()
  await import(pathToFileURL(SRC).href + '?again=1')
  assert.ok(Date.now() - t0 < 800, 'import 变慢 ⇒ 顶层又在派生')
})

test('T2 形状锁(判据④):脚本只读 —— 不得出现任何会改服务状态的命令,正反两向都钉', () => {
  const src = rawSource()
  for (const verb of ['set', 'start', 'stop', 'restart', 'pause', 'resume', 'config', 'delete', 'remove', 'install', 'uninstall']) {
    assert.ok(!new RegExp(`["']${verb}["']`).test(src), `出现被引号包裹的 nssm/sc 写动词 '${verb}' ⇒ 本工具不再只读`)
  }
  assert.ok(!/(Start|Stop|Restart|Suspend|Set|Remove|New)-Service/.test(src), '出现会改服务态的 PowerShell cmdlet ⇒ 只读承诺被打破')
  assert.ok(!/\bsc(?:\.exe)?\s+(config|start|stop|delete)/.test(src), '出现 sc 写命令 ⇒ 只读承诺被打破')
  // 阳性对照:扫描器必须"看得见"合法的只读动词,否则上面全是永真式。
  assert.ok(src.includes(`['get',`), "nssm 唯一动词 'get' 不在源码里 ⇒ 要么枚举方式变了要么形状锁指错面")
  assert.ok(src.includes('windowsHide: true'), '派生漏 windowsHide(§5b 弹窗事故)')
  assert.ok(!src.includes('shell: true'), '派生不得带 shell(引号吞噬与注入面)')
})

test('T3 UTF-16 解码与"值为空 vs 取不到"分岔(真机实测形态)', () => {
  const dec = decodeNssm(u16('D:\\IHUI-AI\\apps\\web'))
  assert.equal(dec.encoding, 'utf16le')
  assert.equal(dec.text, 'D:\\IHUI-AI\\apps\\web')
  const empty = interpretNssmGet({ code: 0, stdoutBuf: u16('\r\n'), stderrBuf: Buffer.alloc(0) })
  assert.equal(empty.kind, 'measured')
  assert.equal(empty.value, null)
  const missing = interpretNssmGet({ code: 3, stdoutBuf: Buffer.alloc(0), stderrBuf: u16('no such service') })
  assert.equal(missing.kind, 'unmeasured')
  assert.match(missing.reason, /退出码 3/)
  const timeout = interpretNssmGet({ spawnError: 'ETIMEDOUT' })
  assert.equal(timeout.kind, 'unmeasured')
  assert.match(timeout.reason, /超时/)
  const enoent = interpretNssmGet({ spawnError: 'ENOENT' })
  assert.equal(enoent.kind, 'unmeasured')
  assert.match(enoent.reason, /不在位/)
})

test('T4 枚举三态:量到行 / 确实是 0 / 无哨兵=未判定;过滤器大小写不敏感', () => {
  const withRows = parseServiceList(`${ENUM_HEAD}\nSVC|IHUI-A|Running|Automatic\njunk-line\n${ENUM_TAIL}`)
  assert.equal(withRows.kind, 'measured')
  assert.equal(withRows.value.rows.length, 1)
  assert.equal(withRows.value.malformed, 1, '形态不符行必须计数,不得静默吞掉')
  const zero = parseServiceList(`${ENUM_HEAD}\n${ENUM_TAIL}`)
  assert.equal(zero.kind, 'measured')
  assert.equal(zero.value.rows.length, 0, '"确实是 0"是量到的结论')
  const silent = parseServiceList('')
  assert.equal(silent.kind, 'unmeasured', '静默空输出(§5b 那型)绝不得读成"0 个服务"')
  assert.ok(compileFilter('ihui-*')('IHUI-RSSHUB'))
  assert.ok(!compileFilter('IHUI-*')('WSearch'))
})

test('T5 判据①:路径不存在 ⇒ 判红且点名该路径', () => {
  const r = judgeService(healthyRec({ appExists: measured('missing') }))
  assert.equal(r.level, 'issue')
  assert.ok(r.problems.some((p) => p.includes('C:\\node\\node.exe')), '必须点名烂掉的路径本身,报告才可复制去修')
})

test('T6 判据②反向对照:三判据全好 ⇒ 不得判红(缺这条就是恒红门)', () => {
  const r = judgeService(healthyRec())
  assert.equal(r.level, 'ok')
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.blind, [])
})

test('T7 判据③:量不到 ⇒ 未判定而非通过;各单维坏值与"只有部分维好"成对', () => {
  const noNssm = judgeService(healthyRec({ application: unmeasured('nssm 不在位'), appExists: unmeasured('无内容可判'), ports: unmeasured('配置读不到'), probe: unmeasured('配置读不到') }))
  assert.equal(noNssm.level, 'unattested', 'STATE 好 + 其余量不到 ⇒ 不得冒"健康"也不得冒"有问题"')
  assert.ok(noNssm.blind.some((b) => /不在位/.test(b)))
  const noPortDeclared = judgeService(healthyRec({ ports: measured([]), probe: unmeasured('服务配置里没有端口声明') }))
  assert.equal(noPortDeclared.level, 'unattested', '"配置里没声明端口"这一维必须记未判定,不得推测成没问题')
  const silent = judgeService(healthyRec({ probe: measured({ listening: false, ports: [8802] }) }))
  assert.equal(silent.level, 'issue')
  const stopped = judgeService(healthyRec({ state: measured('STOPPED') }))
  assert.equal(stopped.level, 'issue', '只看路径会把"停着"读成健康 —— STATE 一维单独也要有牙')
  const emptyApp = judgeService(healthyRec({ application: measured(null) }))
  assert.equal(emptyApp.level, 'issue', '"值为空"是量到的坏值,与"取不到"不同态')
})

test('T8 端到端(假 deps):坏路径 exit 1 并点名;健康 exit 0;--json 可 parse', async () => {
  const broken = await main({ argv: [], deps: deps({ kinds: { 'C:\\node\\node.exe': 'missing' } }) })
  assert.equal(broken.exitCode, 1)
  assert.match(broken.text, /C:\\node\\node.exe/)
  assert.equal(broken.text.includes('❌'), true)
  const good = await main({ argv: ['--json'], deps: deps() })
  assert.equal(good.exitCode, 0)
  const parsed = JSON.parse(good.json)
  assert.equal(parsed.services.length, 1)
  assert.equal(parsed.services[0].level, 'ok')
  assert.equal(parsed.totals.exitCode, 0)
  const rendered = renderText(good.json !== null ? parsed : {})
  assert.ok(rendered.includes('全维健康 1'), '人读面要把"这条是量出来的健康"说出来')
})

test('T9 端到端:nssm 整维取不到 ⇒ 未判定(不得 exit 0 装作扫过);枚举派生失败同样不记通过', async () => {
  const noNssm = await main({ argv: [], deps: deps({ resolveNssm: () => null }) })
  assert.equal(noNssm.exitCode, 2, '没有任何服务量出完整结论 ⇒ 未判定,不记为通过')
  assert.match(noNssm.text, /未判定/)
  assert.ok(!noNssm.text.includes('全维健康 1'))
  const psDead = await main({ argv: [], deps: deps({ psEnumerate: () => ({ spawnError: 'ENOENT' }) }) })
  assert.equal(psDead.exitCode, 2)
  assert.match(psDead.text, /派生失败/)
  const win = await main({ argv: [], deps: { ...deps(), platform: 'linux' } })
  assert.equal(win.exitCode, 2)
  assert.match(win.text, /非 win32/)
})

test('T10 退出码聚合与枚举脚本形态(纯函数)', () => {
  const mk = (level) => ({ level, rec: { state: measured('RUNNING'), application: measured('x'), ports: measured([1]), probe: measured({ listening: true, ports: [1] }) } })
  assert.equal(computeExitCode([mk('issue')], measured({ rows: [] })), 1)
  assert.equal(computeExitCode([mk('unattested')], measured({ rows: [] })), 2, '什么都没量到不得出合格证')
  assert.equal(computeExitCode([mk('ok'), mk('unattested')], measured({ rows: [] })), 0)
  assert.equal(computeExitCode([], unmeasured('枚举没跑到')), 2)
  const ps = buildEnumerationScript()
  assert.ok(ps.includes(ENUM_HEAD) && ps.includes(ENUM_TAIL), '首尾哨兵必须都在枚举脚本里')
  assert.ok(ps.includes('Get-Service') && !/Stop-Service/.test(ps))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
