#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deploy/win/api-listener-freshness.ps1 的镜像测试(2026-10-28 立)。
 *
 * 为什么要有它:当天一次部署把生产签出 ff 到新提交、`/api/health` 回 200,而监听 8843 的
 * 仍是旧进程(服务重启起来的新子进程因端口被占而退出)—— 健康探针证明不了"新代码在答",
 * 账面却写着成功(§12f:判据失效的表现永远是安静)。这把尺子把"实听者身份"变成可读结论。
 *
 * 判据纪律(与 §22c 同口径):三态各自都要能被独立判下来,且**同一测量随锚点翻向**必须成立
 * ——否则"一律判 fresh"和"一律判 stale"都能拿全绿。夹具不开生产端口、不碰真服务:
 * 自己 listen 一个临时端口,让 netstat 量到本测试进程,再拿两种 -Since 各判一次。
 *
 * 跑法:node --test deploy/tests/api-listener-freshness.test.mjs
 * 非 Windows ⇒ 整档 skip(这把尺子判的就是 Windows 进程表与 netstat 形态)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.resolve(HERE, '..', 'win', 'api-listener-freshness.ps1')
const IS_WIN = process.platform === 'win32'

function ps(args) {
  // 5.1 就够(这把尺子 #requires -Version 5.1);按映像名交给 PATH 解析,
  // 与脚本内部对 netstat 的处理同法(服务身份与交互账户的 PATH 互不相通时也不失明)。
  // 用 spawnSync 而不是 execFileSync:state=stale 的**契约就是 exit 3**(给调用侧当红灯用),
  // execFileSync 会先把它抛成异常,那等于把"判陈旧"这条结论读丢。
  const spawned = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 60_000 },
  )
  const out = String(spawned.stdout ?? '')
  if (spawned.error) throw spawned.error
  const line = out.split(/\r?\n/).find((l) => l.includes('FRESHNESS|'))
  if (!line) throw new Error(`没有 FRESHNESS 契约行(rc=${spawned.status} out=${out} err=${spawned.stderr})`)
  const fields = Object.fromEntries(
    line
      .split('|')
      .slice(1)
      .map((kv) => {
        const i = kv.indexOf('=')
        return [kv.slice(0, i), kv.slice(i + 1)]
      }),
  )
  fields.__rc = spawned.status
  return fields
}

/** 自己占一个临时监听端口,返回端口号(测量对象是本进程 ⇒ 与机器上跑着什么无关) */
async function listenEphemeral() {
  const srv = net.createServer()
  await new Promise((resolve, reject) => {
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', resolve)
  })
  return { port: srv.address().port, close: () => new Promise((r) => srv.close(r)) }
}

const skip = IS_WIN ? false : '这把尺子判的是 Windows 进程表 + netstat 形态'

test('F1 新鲜:监听者起于锚点之后 ⇒ state=fresh', { skip }, async () => {
  const { port, close } = await listenEphemeral()
  try {
    const since = new Date(Date.now() - 3600_000).toISOString()
    const r = ps(['-Ports', String(port), '-SinceIso', since])
    assert.equal(r.state, 'fresh', `本进程刚 listen,必须判新鲜,实得 ${JSON.stringify(r)}`)
    assert.equal(r.port, String(port), '必须量的是我这个端口')
    assert.equal(r.reason, 'ok')
    assert.equal(r.__rc, 0, 'fresh 的退出码必须是 0(调用侧按它放行)')
  } finally {
    await close()
  }
})

test('F2 反向对照:同一测量把锚点推到未来 ⇒ 必须翻成 stale(不是一律 fresh 拿绿)', { skip }, async () => {
  const { port, close } = await listenEphemeral()
  try {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const r = ps(['-Ports', String(port), '-SinceIso', future])
    assert.equal(r.state, 'stale', `锚点在监听者之后必须判陈旧,实得 ${JSON.stringify(r)}`)
    assert.equal(r.__rc, 3, 'stale 的退出码必须是 3(调用侧按它报红灯,而不是只写一行日志)')
  } finally {
    await close()
  }
})

test('F3 无人监听 ⇒ undetermined/no-listener(绝不读成"没问题",也不读成指控)', { skip }, async () => {
  const { port, close } = await listenEphemeral()
  await close() // 先关掉:此刻该端口应当无人监听
  const r = ps(['-Ports', String(port), '-SinceIso', new Date(0).toISOString()])
  assert.equal(r.state, 'undetermined', JSON.stringify(r))
  assert.equal(r.reason, 'no-listener', JSON.stringify(r))
})

test('F4 锚点取不到 ⇒ undetermined(空 ⇒ bad-since;乱码带 Z ⇒ bad-since)', { skip }, async () => {
  const { port, close } = await listenEphemeral()
  try {
    for (const bad of ['', '彻底不是日期Z']) {
      const r = ps(['-Ports', String(port), '-SinceIso', bad])
      assert.equal(r.state, 'undetermined', `since="${bad}" 必须未判定,实得 ${JSON.stringify(r)}`)
      assert.equal(r.reason, 'bad-since', JSON.stringify(r))
    }
  } finally {
    await close()
  }
})

// F4b 锚点不带时区标记 ⇒ 按本地时区解,UTC+8 机器上静默差 8 小时(当天实测:该判 stale 的
// 量成了 fresh)。这类"输入形态不对但看着像"的必须拒绝判定,而不是猜一个时区。
test('F4b 锚点缺时区标记 ⇒ undetermined/since-no-timezone(不许静默按本地时区解)', { skip }, async () => {
  const { port, close } = await listenEphemeral()
  try {
    const bare = new Date().toISOString().replace('Z', '').slice(0, 19)
    const r = ps(['-Ports', String(port), '-SinceIso', bare])
    assert.equal(r.state, 'undetermined', JSON.stringify(r))
    assert.equal(r.reason, 'since-no-timezone', JSON.stringify(r))
    // 反向对照:同一条时刻补上 Z 就必须给出结论(不是又一轮"未判定"糊过去)
    const ok = ps(['-Ports', String(port), '-SinceIso', bare + 'Z'])
    assert.notEqual(ok.reason, 'since-no-timezone', JSON.stringify(ok))
    assert.ok(['fresh', 'stale'].includes(ok.state), `带 Z 必须判得出来,实得 ${JSON.stringify(ok)}`)
  } finally {
    await close()
  }
})

test('F5 契约形态:单行 FRESHNESS| 且判定只用 ASCII(中文措辞变了不许把尺子判瞎)', { skip }, async () => {
  const { port, close } = await listenEphemeral()
  try {
    const r = ps(['-Ports', String(port), '-SinceIso', new Date(Date.now() - 60_000).toISOString()])
    for (const k of ['state', 'port', 'pids', 'reason']) assert.ok(k in r, `契约缺字段 ${k}`)
    assert.ok(['fresh', 'stale', 'undetermined'].includes(r.state), `state 必须在三态枚举里,实得 ${r.state}`)
  } finally {
    await close()
  }
})

// F6 钉死当天那个命令行绑定坑:`-Ports "a,b"` 经 argv 传给 [int[]] 形参时,.NET 会把
// "50416,50417" 按千分位折成单个 5041650417 ⇒ 两色谁都量不到,尺子整把瞎判 no-listener。
// 现在参数是字符串 + 自解析,所以"真端口 + 假端口"这一串必须照样量到真端口。
test('F6 多端口串:逗号串不得被折成一个数(旧 [int[]] 形参就是这样整把瞎掉)', { skip }, async () => {
  const { port, close } = await listenEphemeral()
  try {
    const r = ps(['-Ports', `${port},65530`, '-SinceIso', new Date(Date.now() - 60_000).toISOString()])
    assert.equal(r.state, 'fresh', `串里含真端口就必须量到,实得 ${JSON.stringify(r)}`)
    assert.notEqual(r.reason, 'no-listener', '把多端口折成一个数 ⇒ 恰好落在这条假 no-listener 上')
  } finally {
    await close()
  }
})

test('F7 端口清单全不可解析 ⇒ undetermined/bad-ports(不拿"没给对输入"冒充结论)', { skip }, () => {
  const r = ps(['-Ports', 'abc', '-SinceIso', new Date().toISOString()])
  assert.equal(r.state, 'undetermined', JSON.stringify(r))
  assert.equal(r.reason, 'bad-ports', JSON.stringify(r))
})

// 形状锁(2026-10-28 立的成因):PowerShell 变量名大小写不敏感,局部清单若起名 `$ports`
// 就会把参数 `$Ports` 覆盖成空列表 ⇒ 整把尺子静默判 no-listener(当天真实踩过,
// F1/F2/F6 三条一起抓住;只留 F3/F5 的话它是"绿的")。改名回 `$ports` 必须当场红。
test('F8 形状锁:脚本里不得出现与参数 $Ports 同名(仅大小写不同)的局部变量', { skip }, () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const locals = [...src.matchAll(/^\s*(?:\$([A-Za-z_][\w]*)|[string|int|switch][^\n]*\$([A-Za-z_][\w]*)\s*=)/gm)].map(
    (m) => (m[1] || m[2] || '').toLowerCase(),
  )
  assert.ok(!locals.includes('ports'), '出现 $ports 局部变量 = 与参数 $Ports 撞名(大小写不敏感)⇒ 参数被覆盖,尺子整把瞎')
  assert.match(src, /\$wantPorts/, '端口清单必须用不与参数撞名的变量')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
