// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 切流前置闸(`--gate-cmd`)的"有牙"用例 —— 每一条都必须是"摘掉闸就挂"。
 *
 * 钉的回归面(2026-11-01,票「灰度观察窗排在换流之后」):
 *   改前:编排器健康通过即原子切流,观察窗只能在整轮部署之后跑 ⇒ 灰度期 stable 已是新色,
 *         升档依据退化成"新 vs 新";
 *   改后:目标色健康之后、**任何**切流/停旧色动作之前跑一条判定命令,非 0 或超时一律不切流。
 *
 * 三条必须成立(都用真实进程跑,不靠读日志字符串冒充结论):
 *   ① 闸 rc=0        ⇒ 真的走到切流(状态文件 active 变绿 + rc=0);
 *   ② 闸 rc≠0        ⇒ 未切流、状态文件逐字节未改、退出码=9,且闸的 stdout/stderr 原文进日志;
 *   ③ 闸超时         ⇒ 同样未切流、退出码=10(未判定不是通过,§0.3);
 *   ④ 不传 --gate-cmd ⇒ 行为与旧版一致(回归锁:状态照切、rc=0、日志里不出现闸)。
 *
 * 服务控制面用假 nssm:把 IHUI_NSSM 指到 node 自身,并把 `status` / `start` / `stop` 三个
 * 无扩展名 JS 文件放进编排器的工作目录 —— `node status <svc>` 就是 `require('./status')`。
 * 这样 waitService 立即拿到终态,不用真服务、也不 sleep 几十秒;全部是 real spawnSync
 * + 显式 stdio(§12g 的 EBUSY 族坑:不许继承父句柄)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const ORCH = path.join(ROOT, 'deploy', 'win', 'ihui-api-bluegreen.mjs')

const EXIT_GATE_BLOCK = 9
const EXIT_GATE_TIMEOUT = 10

/** 假 nssm 的三个动词:状态落一个文件里,start/stop 改它,status 读它。 */
const FAKE_STATUS = `const fs = require('fs')
try { process.stdout.write(String(fs.readFileSync('svc-state', 'utf8')).trim() + '\\n') }
catch { process.stdout.write('SERVICE_STOPPED\\n') }
`
const FAKE_START = `require('fs').writeFileSync('svc-state', 'SERVICE_RUNNING')
`
const FAKE_STOP = `require('fs').writeFileSync('svc-state', 'SERVICE_STOPPED')
`

/** 被闸调起的判定脚本:三种形态各给一枚可核验的标记串。 */
const GATE_MJS = `const mode = process.argv[2]
if (mode === 'ok') {
  console.log('GATE-MARK-OK')
  process.exit(0)
}
if (mode === 'bad') {
  console.log('GATE-MARK-STDOUT')
  console.error('GATE-MARK-STDERR')
  process.exit(3)
}
if (mode === 'slow') {
  setTimeout(() => process.exit(0), 3000)
} else {
  process.exit(2)
}
`

/** 每个用例一份隔离沙箱:状态文件/运行记录/日志/假服务控制面全在里面。 */
function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-gate-'))
  fs.writeFileSync(path.join(dir, 'status'), FAKE_STATUS, 'utf8')
  fs.writeFileSync(path.join(dir, 'start'), FAKE_START, 'utf8')
  fs.writeFileSync(path.join(dir, 'stop'), FAKE_STOP, 'utf8')
  fs.writeFileSync(path.join(dir, 'gate.mjs'), GATE_MJS, 'utf8')
  const statePath = path.join(dir, 'web-bluegreen.json')
  fs.writeFileSync(
    statePath,
    JSON.stringify({ active: 'blue', blue: 8851, green: 8852 }, null, 2),
    'utf8',
  )
  return {
    dir,
    statePath,
    logPath: path.join(dir, 'bg.log'),
    gateMjs: path.join(dir, 'gate.mjs'),
    stateRaw: () => fs.readFileSync(statePath, 'utf8'),
    active: () => JSON.parse(fs.readFileSync(statePath, 'utf8')).active,
    log: () =>
      fs.existsSync(path.join(dir, 'bg.log'))
        ? fs.readFileSync(path.join(dir, 'bg.log'), 'utf8')
        : '',
    // Windows 下子进程刚被 kill 时 cwd/句柄可能还锁着目录(EBUSY 族,§12g):
    // 带重试地删,仍删不掉也不算用例失败 —— 残留只落在系统临时目录。
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
      } catch {
        /* 临时目录残留不影响结论 */
      }
    },
  }
}

/**
 * 候选端口上真起一个"web 首页",让编排器的健康门禁真跑一次探测。
 *
 * 必须另起进程而不是在本进程里 listen:下面跑编排器用的是 spawnSync(同步阻塞),
 * 会把这一个事件循环整个卡住 —— 若服务在本进程,健康探测必然"无应答",
 * 用例就会把"编排器没接上"和"夹具自己卡死"混成一团。服务住在子进程 ⇒ 两边都是真进程。
 */
const SRV_MJS = `import http from 'node:http'
const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end('<!DOCTYPE html><html><body>candidate</body></html>')
})
srv.listen(Number(process.argv[2]), '127.0.0.1', () => process.stdout.write('UP\\n'))
`

function freePort() {
  return new Promise((resolve, reject) => {
    const s = http.createServer()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

async function startCandidate(sandbox) {
  const file = path.join(sandbox.dir, 'srv.mjs')
  fs.writeFileSync(file, SRV_MJS, 'utf8')
  const port = await freePort()
  const child = spawn(process.execPath, [file, String(port)], {
    cwd: sandbox.dir,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:显式 stdio
    windowsHide: true,
  })
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 500 }, (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
    if (ok) return { child, port }
    await new Promise((r) => setTimeout(r, 100))
  }
  child.kill()
  throw new Error(`夹具:候选服务未在 10s 内起来(port=${port})`)
}

/** 用真进程跑编排器;IHUI_NSSM 指向 node 自身 + cwd 里的假动词文件。 */
function runOrchestrator(sandbox, port, extraArgs) {
  const argv = [
    ORCH,
    '--target',
    'green',
    '--svc-blue',
    'IHUI-WEB-BLUE',
    '--svc-green',
    'IHUI-WEB-GREEN',
    '--port-blue',
    '18851',
    '--port-green',
    String(port),
    '--health-path',
    '/',
    '--health-match',
    '<!DOCTYPE html',
    '--health-timeout',
    '8',
    '--drain',
    '0',
    '--state-file',
    sandbox.statePath,
    '--log-file',
    sandbox.logPath,
    ...extraArgs,
  ]
  const r = spawnSync(process.execPath, argv, {
    cwd: sandbox.dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:显式 stdio,不继承句柄
    env: { ...process.env, IHUI_NSSM: process.execPath },
  })
  return { rc: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, signal: r.signal }
}

test('闸 rc=0 ⇒ 真的走到切流(状态文件 active 变绿、rc=0)', async () => {
  const box = makeSandbox()
  const { child, port } = await startCandidate(box)
  try {
    const r = runOrchestrator(box, port, [
      '--gate-cmd',
      `"${process.execPath}" "${box.gateMjs}" ok`,
      '--gate-timeout',
      '30',
    ])
    assert.equal(r.rc, 0, `编排器应 rc=0,实得 ${r.rc};out=${r.out}`)
    assert.equal(box.active(), 'green', '闸 rc=0 却没切流')
    assert.match(box.log(), /\[gate\] stdout\| GATE-MARK-OK/, '闸的 stdout 未原样进日志')
    assert.match(box.log(), /切流前置闸通过/, '日志缺"闸通过"这一格')
  } finally {
    child.kill()
    await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)))
    box.cleanup()
  }
})

test('闸 rc≠0 ⇒ 未切流、状态文件逐字节未改、退出码=9、闸输出原样进日志', async () => {
  const box = makeSandbox()
  const { child, port } = await startCandidate(box)
  try {
    const before = box.stateRaw()
    const r = runOrchestrator(box, port, [
      '--gate-cmd',
      `"${process.execPath}" "${box.gateMjs}" bad`,
      '--gate-timeout',
      '30',
    ])
    assert.equal(r.rc, EXIT_GATE_BLOCK, `闸判红应 rc=9,实得 ${r.rc};out=${r.out}`)
    assert.equal(box.stateRaw(), before, '闸判红后状态文件被改了(契约:状态文件不改)')
    assert.equal(box.active(), 'blue', '闸判红后活跃色被切走了')
    const log = box.log()
    assert.match(log, /\[gate\] stdout\| GATE-MARK-STDOUT/, '闸 stdout 未进日志')
    assert.match(log, /\[gate\] stderr\| GATE-MARK-STDERR/, '闸 stderr 未进日志')
    assert.doesNotMatch(log, /状态已切换/, '闸判红却出现了切流行')
  } finally {
    child.kill()
    await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)))
    box.cleanup()
  }
})

test('闸超时 ⇒ 按未判定处理,同样不切流,退出码=10', async () => {
  const box = makeSandbox()
  const { child, port } = await startCandidate(box)
  try {
    const before = box.stateRaw()
    const started = Date.now()
    const r = runOrchestrator(box, port, [
      '--gate-cmd',
      `"${process.execPath}" "${box.gateMjs}" slow`,
      '--gate-timeout',
      '1',
    ])
    const elapsed = Date.now() - started
    assert.equal(r.rc, EXIT_GATE_TIMEOUT, `闸超时应 rc=10,实得 ${r.rc};out=${r.out}`)
    assert.equal(box.stateRaw(), before, '闸超时后状态文件被改了(契约:超时=未判定,不切流)')
    assert.match(box.log(), /切流前置闸超时/, '日志未把超时记成未判定')
    assert.ok(elapsed < 20000, `超时上界没生效,耗时 ${elapsed}ms`)
  } finally {
    child.kill()
    await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)))
    box.cleanup()
  }
})

test('回归锁:不传 --gate-cmd ⇒ 行为与旧版一致(状态照切、rc=0、日志无闸)', async () => {
  const box = makeSandbox()
  const { child, port } = await startCandidate(box)
  try {
    const r = runOrchestrator(box, port, [])
    assert.equal(r.rc, 0, `不带闸应 rc=0,实得 ${r.rc};out=${r.out}`)
    assert.equal(box.active(), 'green', '不带闸时切流行为被改动了')
    assert.doesNotMatch(box.log(), /\[gate\]|切流前置闸/, '不带 --gate-cmd 却出现了闸的痕迹')
  } finally {
    child.kill()
    await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)))
    box.cleanup()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
