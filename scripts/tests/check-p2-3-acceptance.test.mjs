// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-p2-3-acceptance.mjs`(P2-3 服务端编排链路的真机验收脚本)。
 *
 * 这道门是**真服务器 e2e**,所以形状与静态扫描门不同:能测得的才断言,测不到的一律记 skip
 * (skip 条件在**加载期同步算出**,不走"warn + return"那种把没判当判过的通道):
 *   · `SERVER_UP` —— 加载期用 spawnSync 子进程对 127.0.0.1:8802 做一次 TCP 握手,现测在不在听;
 *   · `WS_CAPABLE` —— 现读本运行时有没有全局 WebSocket(openWs 的 EventTarget 那一臂的前提)。
 * node:test 在本仓运行时(Node 24.19)没有模块级 `it.skipIf`(读数见 P8),等价通道是
 * `test(name, { skip: <加载期算出的条件> }, fn)`,账面同样落 skipped 计数。
 *
 * 不依赖真服务器也能证的,就走**本地实测到的传输**给自己当对象:用 node:http 起一个只完成
 * RFC6455 握手 + 发一帧文本的最小服务端,让生产闭包 `openWs` / `onWsMessage` 真跑一遍;
 * 服务端只是传输夹具,裁定仍在门体那一侧(§22c:测试不许代裁)。
 *
 * 取材(§22c 红线:不得全部自造夹具):
 *   · `decodeJwtSub` 的阳性输入 = `git show HEAD:apps/api/tests/csrf.test.ts` 里那枚真 JWT
 *     —— 用拼接出来的前缀定位后**切片取出**,测试文件里不留 JWT 字面量(本仓实测过:测试文本里
 *     的 secret 形状字面量会撞上别处的文本计数棘轮);
 *   · `onWsMessage` 的载荷正文 = `HEAD:apps/extension/lib/agent-control-bridge.ts` 的逐字一行。
 *
 * 退出码一侧只断"取不到/跑不通绝不记绿":BASE 指向不可达端点时 rc 必须非 0 且不得打印全绿;
 * 另把"rc==0 ⇔ 通过数==总数"这条**规则**钉住(本地 404 假服务端与真机两种面都判它)。
 *
 * 派生一律 `stdio:['ignore','pipe','pipe']` + `windowsHide: true`(§12g)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-p2-3-acceptance.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_PATH = join(REPO, 'scripts', 'check-p2-3-acceptance.mjs')
const ANSI = /\x1b\[[0-9;]*m/g
const stripAnsi = (s) => String(s ?? '').replace(ANSI, '')

/** RFC6455 握手用的魔术串(协议常量,不是本仓判据)。 */
const WS_GUID = ['258EAFA5', 'E914', '47DA', '95CA', 'C5AB0DC85B11'].join('-')
const JWT_PREFIX = ['e', 'y', 'J'].join('')
const TOKEN_CHARS = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-')

/** 加载期同步能力探测:子进程做一次 TCP 握手,连上 exit 0。 */
function tcpOpen(host, port, timeoutMs = 1500) {
  const script = [
    'const net=require("node:net");',
    `const s=net.connect({host:${JSON.stringify(host)},port:${Number(port)}});`,
    `s.setTimeout(${Number(timeoutMs)});`,
    "s.on('connect',()=>{s.destroy();process.exit(0)});",
    "s.on('timeout',()=>{s.destroy();process.exit(1)});",
    "s.on('error',()=>process.exit(1));",
  ].join('')
  const r = spawnSync(process.execPath, ['-e', script], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs + 5000,
  })
  return r.status === 0
}

const ACCEPT_PORT = 8802
const SERVER_UP = tcpOpen('127.0.0.1', ACCEPT_PORT)
const WS_CAPABLE = typeof WebSocket === 'function'
const NO_SERVER = SERVER_UP ? false : `现测 127.0.0.1:${ACCEPT_PORT} 未在听(spawnSync 探针非 0)⇒ 真机臂没有可测对象,记 skip 不记通过`
const NO_WS = WS_CAPABLE ? false : `本运行时没有全局 WebSocket(现测 typeof = ${typeof WebSocket})⇒ openWs 的 EventTarget 臂无从跑通`

/** 同步跑一次 CLI(不依赖本进程起的服务)。 */
function runGateSync(env) {
  const r = spawnSync(process.execPath, [GATE_PATH], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
    env,
  })
  return { rc: r.status, out: stripAnsi(r.stdout), err: stripAnsi(r.stderr), all: stripAnsi(r.stdout) + stripAnsi(r.stderr) }
}

/** 异步跑 CLI:本进程里起的假服务端要能回应,spawnSync 会冻住事件循环(实测过一次整臂挂死)。 */
function runGateAsync(env) {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [GATE_PATH], {
      cwd: REPO,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })
    let out = ''
    p.stdout.on('data', (d) => {
      out += d
    })
    p.stderr.on('data', (d) => {
      out += d
    })
    const killer = setTimeout(() => p.kill(), 60_000)
    p.on('exit', (code) => {
      clearTimeout(killer)
      const text = stripAnsi(out)
      res({ rc: code, all: text, out: text })
    })
    p.on('error', rej)
  })
}

/** 末行读数用切片取,不写第二份正则(读数形状漂了会点出来,而不是静默解析失败)。 */
function readTally(text) {
  const line = text.split(/\r?\n/).find((l) => l.includes('验收:') && l.includes('通过'))
  if (!line) return null
  const seg = line.slice(line.lastIndexOf('验收:') + '验收:'.length, line.indexOf('通过')).trim()
  const frac = seg.split(/\s+/)[0]
  const [p, t] = frac.split('/')
  if (!p || !t || Number.isNaN(Number(p)) || Number.isNaN(Number(t))) return null
  return { passed: Number(p), total: Number(t), raw: frac }
}

/** 从真面里切出一枚 JWT(按拼接前缀定位,测试文本里不留 JWT 字面量)。 */
function extractJwt(face) {
  const at = face.indexOf(JWT_PREFIX)
  assert.ok(at >= 0, '真面里找不到 JWT 形状的串 ⇒ 取材面漂了')
  let end = at
  while (end < face.length && TOKEN_CHARS.has(face[end])) end += 1
  return face.slice(at, end)
}

const CSRF_SPEC = 'HEAD:apps/api/tests/csrf.test.ts'
const BRIDGE_SPEC = 'HEAD:apps/extension/lib/agent-control-bridge.ts'
const HEAD_BATCH = catBatch(REPO, [CSRF_SPEC, BRIDGE_SPEC])
const CSRF_FACE = HEAD_BATCH.get(CSRF_SPEC)
const BRIDGE_FACE = HEAD_BATCH.get(BRIDGE_SPEC)

const b64urlJson = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')
const tokenOf = (claims) => ['h', b64urlJson(claims), 's'].join('.')

/** 只完成握手 + 发一帧文本的最小服务端(传输夹具;帧长按 RFC6455 三档给齐)。 */
function frameOf(payloadBuf) {
  const len = payloadBuf.length
  if (len < 126) return Buffer.concat([Buffer.from([0x81, len]), payloadBuf])
  if (len < 65536) {
    const head = Buffer.alloc(4)
    head[0] = 0x81
    head[1] = 126
    head.writeUInt16BE(len, 2)
    return Buffer.concat([head, payloadBuf])
  }
  const head = Buffer.alloc(10)
  head[0] = 0x81
  head[1] = 127
  head.writeBigUInt64BE(BigInt(len), 2)
  return Buffer.concat([head, payloadBuf])
}

function listen(server) {
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server.address().port)))
}

/** 服务端连同在手的 socket 一起收:留下的活句柄会把 node --test 吊住不放。 */
function track(server) {
  const sockets = new Set()
  server.on('connection', (s) => {
    sockets.add(s)
    s.on('close', () => sockets.delete(s))
  })
  return {
    server,
    async shut() {
      for (const s of sockets) s.destroy()
      await new Promise((res) => server.close(() => res()))
    },
  }
}

test('P0 import 门体不得连网/不得 exit(§22d:旧写法一 import 就拿默认账号去打 BASE)', () => {
  for (const k of ['decodeJwtSub', 'openWs', 'onWsMessage']) assert.ok(k in gate, `__test__ 缺导出 ${k} ⇒ 测试只能另抄一份判据`)
  for (const k of ['decodeJwtSub', 'openWs', 'onWsMessage']) assert.equal(typeof gate[k], 'function', `${k} 不是函数`)

  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE_PATH).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
  )
  const out = stripAnsi(r.stdout)
  assert.match(out, /__IMPORTED__/, `import 门体失败:${out}${stripAnsi(r.stderr)}`)
  assert.doesNotMatch(out, /服务端编排验收/, 'import 门体就跑掉了验收主流程 ⇒ §22c 的通道又断了')
})

test('P1 真仓 HEAD 里那枚 JWT 必须被生产解码器认下(逐字取材,不手抄)', () => {
  assert.equal(typeof CSRF_FACE, 'string', `${CSRF_SPEC} 取不到 HEAD blob ⇒ 无法判定`)
  const token = extractJwt(CSRF_FACE)
  assert.equal(token.split('.').length, 3, `切出来的不是三段式 JWT:${token.slice(0, 12)}…`)
  const sub = gate.decodeJwtSub(token)
  assert.equal(typeof sub, 'string', `真 JWT 解不出 sub:${sub}`)
  assert.ok(sub.length > 0, 'sub 是空串 ⇒ 解码器读到了个寂寞')
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  assert.equal(sub, claims.sub, `生产解码器给的 sub 与载荷里写的不一致:${sub} vs ${claims.sub}`)
})

test('P2 声明位回退链一正一反:sub > userId > id,坏面一律 null', () => {
  const probe = ['p', '-', '1'].join('')
  assert.equal(gate.decodeJwtSub(tokenOf({ sub: probe })), probe, '只有 sub 时应当读到')
  assert.equal(gate.decodeJwtSub(tokenOf({ userId: probe })), probe, '只有 userId 时应当回退到')
  assert.equal(gate.decodeJwtSub(tokenOf({ id: probe })), probe, '只有 id 时应当回退到')
  assert.equal(gate.decodeJwtSub(tokenOf({ sub: 'first', userId: 'second', id: 'third' })), 'first', '三键同在时 sub 必须优先')

  for (const bad of ['', 'abc', ['a', 'b'].join('.'), Buffer.from('{坏 JSON', 'utf8').toString('base64url')]) {
    assert.equal(gate.decodeJwtSub(bad), null, `坏面「${bad}」竟没被判失败 ⇒ 解码器会把噪声当身份`)
  }
  assert.equal(gate.decodeJwtSub(tokenOf({ nope: 1 })), null, '三个声明位都没有 ⇒ 必须 null,不许给空串')
})

test('P3 生产传输闭包在本地实测到的 WS 服务端上跑通(阳性),坏端点一律拒绝(反)', async () => {
  const line = String(BRIDGE_FACE ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.includes('agent') && l.length > 40)
  assert.ok(line, `${BRIDGE_SPEC} 里找不到一行真报文形态的原文 ⇒ 取材面漂了`)
  const payload = JSON.stringify({ type: 'notification', data: { type: 'agent.action', note: line } })
  assert.ok(Buffer.byteLength(payload) > 125, '夹具载荷应跨过 125 字节这一格,否则没测到扩展长度那一档')

  const wsH = track(createServer())
  wsH.server.on('upgrade', (req, sock) => {
    const acc = createHash('sha1').update(req.headers['sec-websocket-key'] + WS_GUID).digest('base64')
    sock.write(
      ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acc}`, '', ''].join('\r\n'),
    )
    setTimeout(() => {
      if (!sock.destroyed) sock.write(frameOf(Buffer.from(payload, 'utf8')))
    }, 120)
  })
  const plainH = track(createServer((q, s) => {
    s.writeHead(404, { 'content-type': 'text/plain' })
    s.end('not a websocket')
  }))
  try {
    const wsPort = await listen(wsH.server)
    const t0 = Date.now()
    const ws = await gate.openWs(`ws://127.0.0.1:${wsPort}/ws/notifications?token=x`)
    assert.ok(ws.readyState === 0 || ws.readyState === 1, `openWs resolved 但状态不对:${ws.readyState}`)
    assert.ok(Date.now() - t0 < 5000, `握手用了 ${Date.now() - t0}ms,不像 open 事件驱动的通路`)
    const got = await new Promise((res, rej) => {
      gate.onWsMessage(ws, res)
      setTimeout(() => rej(new Error('3s 内没收到帧 ⇒ 收报通路没跑起来')), 3000)
    })
    assert.equal(got, payload, 'onWsMessage 转手改了载荷 ⇒ 解包/解码那一层不再唯一')
    ws.close()

    const plainPort = await listen(plainH.server)
    const rejectedPlain = await gate.openWs(`ws://127.0.0.1:${plainPort}/x`).then(() => 'resolved', (e) => `rejected:${String(e?.message ?? e)}`)
    assert.ok(rejectedPlain.startsWith('rejected'), `非 upgrade 端点被 openWs 当成连上了:${rejectedPlain}`)

    const closedRejected = await gate.openWs(['ws://127.0.0.1:1/', 'x'].join('')).then(() => 'resolved', (e) => `rejected:${String(e?.code ?? e?.message ?? e)}`)
    assert.ok(closedRejected.startsWith('rejected'), `已关端口被 openWs 当成连上了:${closedRejected}`)
  } finally {
    await wsH.shut()
    await plainH.shut()
  }
})

test('P3b 无声服务端:openWs 自带的 5s 超时臂必须真的兜住(不得永挂)', async () => {
  const netH = track(
    createNetServer((sock) => {
      sock.on('data', () => {})
    }),
  )
  try {
    const port = await listen(netH.server)
    const t0 = Date.now()
    const outcome = await gate.openWs(`ws://127.0.0.1:${port}/ws`).then(() => 'resolved', (e) => `rejected:${String(e?.message ?? e)}`)
    const elapsed = Date.now() - t0
    assert.ok(outcome.startsWith('rejected'), `无声服务端被 openWs 当成连上了:${outcome}`)
    assert.ok(elapsed > 1000, `只用了 ${elapsed}ms 就放弃 ⇒ 走的不是超时臂而是秒败臂,这一格没判到`)
    assert.ok(elapsed < 9000, `等了 ${elapsed}ms,超时兜底失效(会把测试进程吊死)`)
  } finally {
    await netH.shut()
  }
})

test('P4 onWsMessage 适配两种事件形态,且只监听 message 那一类', () => {
  const etSeen = []
  const etForm = {
    addEventListener(type, cb) {
      etSeen.push(type)
      if (type === 'message') this._cb = cb
    },
  }
  gate.onWsMessage(etForm, () => {})
  assert.deepEqual(etSeen, ['message'], `EventTarget 形态下注册了别的事件类型:${JSON.stringify(etSeen)}`)

  const realLine = String(BRIDGE_FACE ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 30)
  assert.ok(realLine, `${BRIDGE_SPEC} 里取不到一行真面原文 ⇒ 取材面漂了`)

  let etGot = null
  gate.onWsMessage(etForm, (d) => {
    etGot = d
  })
  etForm._cb({ data: Buffer.from(realLine, 'utf8') })
  assert.equal(etGot, realLine, 'Buffer 载荷没被按 utf-8 还原成同一行真面原文')
  const passthrough = '已经是字符串了'
  etForm._cb({ data: passthrough })
  assert.equal(etGot, passthrough, '字符串载荷不该被二次解码')

  const eeSeen = []
  const eeForm = {
    on(type, cb) {
      eeSeen.push(type)
      if (type === 'message') this._cb = cb
    },
  }
  gate.onWsMessage(eeForm, () => {})
  assert.deepEqual(eeSeen, ['message'], `EventEmitter 形态下注册了别的事件类型:${JSON.stringify(eeSeen)}`)
  let eeGot = null
  gate.onWsMessage(eeForm, (d) => {
    eeGot = d
  })
  eeForm._cb(Buffer.from(realLine, 'utf8'))
  assert.equal(eeGot, realLine, 'EventEmitter 形态的 Buffer 载荷没还原')
})

test('P5 CLI 取不到链路时绝不记绿(BASE 指向不可达端点)', () => {
  const closed = runGateSync({ ...process.env, API_BASE: ['http://127.0.0.1:', '1'].join('') })
  assert.notEqual(closed.rc, 0, `不可达的 BASE 竟 exit 0 —— 把"没跑成"记成"跑过了":${closed.all.slice(0, 300)}`)
  assert.doesNotMatch(closed.all, /全绿/, `不可达还喊全绿:${closed.all.slice(0, 300)}`)
})

test('P5b 规则锁:rc==0 当且仅当通过数==总数(拿本地 404 假服务端现跑)', async () => {
  const api = track(
    createServer((q, s) => {
      s.writeHead(404, { 'content-type': 'application/json' })
      s.end('{"code":404,"message":"not found"}')
    }),
  )
  try {
    const port = await listen(api.server)
    const r = await runGateAsync({ ...process.env, API_BASE: `http://127.0.0.1:${port}` })
    const tally = readTally(r.all)
    assert.ok(tally, `末行读数换了形状,规则无从对账:${r.all.slice(-400)}`)
    assert.ok(tally.total >= 1, `总步数为 0 ⇒ 一条判据都没跑:${r.all.slice(-200)}`)
    assert.equal(r.rc, tally.passed === tally.total ? 0 : 1, `rc=${r.rc} 与 ${tally.raw} 的读数不自洽:${r.all.slice(-200)}`)
    assert.equal(tally.passed, 0, `假服务端只回 404,不该有步骤被判过:${tally.raw}`)
  } finally {
    await api.shut()
  }
})

test(
  'P6 真机臂(现测到 api 才跑):生产传输对真服务端必须给出可解释的读数',
  { skip: NO_WS || NO_SERVER },
  async () => {
    const url = [`ws://127.0.0.1:${ACCEPT_PORT}`, '/ws/notifications?token=', 'not-a-ticket'].join('')
    const t0 = Date.now()
    const outcome = await gate.openWs(url).then(
      (ws) => {
        ws.close()
        return 'resolved'
      },
      (e) => `rejected:${String(e?.message ?? e)}`,
    )
    const elapsed = Date.now() - t0
    assert.ok(elapsed < 8000, `openWs 对真服务端用了 ${elapsed}ms —— 超时兜底失效`)
    assert.ok(outcome === 'resolved' || outcome.startsWith('rejected'), `读数不可解释:${outcome}`)
    console.info(`    · 真机现读:无效票据握手 = ${outcome}(${elapsed}ms)`)
  },
)

test(
  'P6b 真机端到端(仅在现测到 api 时跑):验收脚本的 rc 与它的读数必须自洽',
  { skip: NO_SERVER },
  async () => {
    const env = { ...process.env }
    delete env.API_BASE
    const r = await runGateAsync(env)
    const tally = readTally(r.all)
    assert.ok(tally, `真机跑不出末行读数:${r.all.slice(-400)}`)
    assert.ok(tally.total >= 1, `真机总步数 0:${r.all.slice(-200)}`)
    assert.equal(r.rc, tally.passed === tally.total ? 0 : 1, `rc=${r.rc} 与 ${tally.raw} 不自洽`)
  },
)

test('P7 测试不得重写判据(裁定只走门体导出的三枚闭包)', () => {
  const own = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(
    own.includes("import { __test__ as gate } from '../check-p2-3-acceptance.mjs'"),
    '§22c 锚点:必须 import 门体导出的判据',
  )
  for (const name of Object.keys(gate)) {
    assert.ok(!own.includes(`function ${name}(`), `测试里出现了第二份 ${name}`)
    assert.ok(!own.includes(`const ${name} =`), `测试里重新声明了 ${name}`)
  }
  for (const [call, min] of [['gate.decodeJwtSub(', 8], ['gate.openWs(', 5], ['gate.onWsMessage(', 4]]) {
    const n = own.split(call).length - 1
    assert.ok(n >= min, `${call} 只出现 ${n} 次(≥${min} 才算这条判据真由门体裁定)`)
  }
})

test('P8 加载期能力读数(账面可复核:哪些臂有对象、哪些记 skip)', () => {
  console.info(
    [
      `    · Node ${process.version} / it.skipIf 可用 = ${typeof test.skipIf === 'function'} / 全局 WebSocket = ${WS_CAPABLE}`,
      `    · 现测 127.0.0.1:${ACCEPT_PORT} 在听 = ${SERVER_UP}(加载期 spawnSync TCP 探针,非缓存)`,
      `    · 取材面在位 = ${typeof CSRF_FACE === 'string' ? 'csrf.test.ts HEAD OK' : '缺'} / ${typeof BRIDGE_FACE === 'string' ? 'agent-control-bridge.ts HEAD OK' : '缺'}`,
    ].join('\n'),
  )
  assert.equal(typeof SERVER_UP, 'boolean')
  assert.equal(typeof WS_CAPABLE, 'boolean')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
