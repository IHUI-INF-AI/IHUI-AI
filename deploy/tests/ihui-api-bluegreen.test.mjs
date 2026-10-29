// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:判据一律 import 源脚本 __test__(§22c),本文件不复制任何探测实现。
//
// 立因(2026-10-29 现读的生产故障):deploy/win/ihui-api-bluegreen.mjs 的健康探测读满 4096 字节
// 就 req.destroy() 掐流,之后 res 的 'end' 永不触发 ⇒ Promise 永悬 ⇒ 没有待办句柄时 Node 静默
// exit 0、rc=0、无 ERROR 行、状态文件不动。web 首页 HTML 必超 4096 ⇒ 自 03:03 起每一轮 web 换流
// 都在这里蒸发,而全部健康门禁报绿;api 族因 /api/health 是小 JSON 才侥幸正常。
// 本文件的每一条都必须是"摘掉修复就挂",不是"跑一下看看"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'

// 源脚本在模块顶层 parseArgs(process.argv.slice(2)) 且有 isDirectRun 守卫:
// 测试里必须先把 argv 收成"零参数 + argv[1] 不是本模块",否则 import 就会触发真实切换。
const SAVED_ARGV = process.argv.slice()
process.argv = [SAVED_ARGV[0], 'ihui-api-bluegreen.import-guard.mjs']
const mod = await import('../win/ihui-api-bluegreen.mjs')
process.argv = SAVED_ARGV
const { makeProbe } = mod.__test__

const WATCHDOG_MS = 1200
const probe = (opts) => makeProbe({ watchdogMs: WATCHDOG_MS, timeoutMs: 600, ...opts })

/** 起一个受控的源站:按脚本回响应,端口由内核分配 */
async function startServer(script) {
  const srv = http.createServer((req, res) => script(req, res))
  srv.listen(0, '127.0.0.1')
  await once(srv, 'listening')
  return { port: srv.address().port, close: () => new Promise((r) => srv.close(r)) }
}

test('P1 分块流式首页(真实 Next SSR 形态)必须判健康 —— 旧实现读满 4096 掐流后永悬、进程静默 exit 0', async () => {
  const s = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    // 一次性 res.end(9KB) 是量不出这一型的(实测旧实现也能过):真实 SSR 分块吐字节,
    // 掐流之后 'end' 永不触发 ⇒ 必须按分块形态造夹具
    res.write('<!DOCTYPE html><html><head>' + 'a'.repeat(2000) + '</head><body>')
    const timer = setInterval(() => res.write('x'.repeat(2000)), 60)
    setTimeout(() => {
      clearInterval(timer)
      res.write('</body></html>')
      res.end()
    }, 700)
  })
  try {
    assert.equal(await probe({ healthPath: '/', healthMatch: '<!DOCTYPE html' })(s.port), true)
  } finally {
    await s.close()
  }
})

test('P2 大响应但不含匹配串 ⇒ 判不健康(不能因为"读到了很多字节"就放行)', async () => {
  const s = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<html>' + 'y'.repeat(9000) + '</html>')
  })
  try {
    assert.equal(await probe({ healthPath: '/', healthMatch: '<!DOCTYPE html' })(s.port), false)
  } finally {
    await s.close()
  }
})

test('P3 api 族小 JSON 不回归(/api/health 含 status:ok)', async () => {
  const s = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"status":"ok","uptime":12}')
  })
  try {
    assert.equal(await probe({})(s.port), true)
  } finally {
    await s.close()
  }
})

test('P4 404 ⇒ false(路径写错不得算健康)', async () => {
  const s = await startServer((req, res) => {
    res.writeHead(404)
    res.end('<!DOCTYPE html> not here')
  })
  try {
    assert.equal(await probe({ healthPath: '/', healthMatch: '<!DOCTYPE html' })(s.port), false)
  } finally {
    await s.close()
  }
})

test('P5 端口没人听 ⇒ false 且不抛(旧形态靠 error 兜,新形态也必须兜住)', async () => {
  const taken = await startServer((req, res) => res.end('{"status":"ok"}'))
  const deadPort = taken.port
  await taken.close()
  assert.equal(await probe({ healthMatch: '' })(deadPort), false)
})

test('P6 形状锁:服务端只发 header 然后永远不发正文 ⇒ 必须在看门狗内给结论', async () => {
  const held = new Set()
  const s = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.write('<!DOCTYPE html>')
    held.add(res) // 故意不 end:没有 'end',也没有 error
  })
  try {
    const t0 = Date.now()
    const verdict = await probe({ healthPath: '/', healthMatch: '<!DOCTYPE html' })(s.port)
    assert.equal(verdict, false, '挂死的响应必须判不健康,而不是把调用方拖进永久等待')
    assert.ok(Date.now() - t0 < 8000, `看门狗必须在 ${WATCHDOG_MS}ms 量级收尾,实测 ${Date.now() - t0}ms`)
  } finally {
    for (const res of held) res.destroy()
    await s.close()
  }
})

test('P7 服务端发完部分正文后把 socket 掐掉 ⇒ 必须 settle 且判不健康', async () => {
  const s = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.write('<!DOCTYPE html>' + 'z'.repeat(2000))
    setTimeout(() => res.destroy(), 60)
  })
  try {
    assert.equal(await probe({ healthPath: '/', healthMatch: '<!DOCTYPE html' })(s.port), false)
  } finally {
    await s.close()
  }
})

test('P8 反向锁:不传 healthMatch 时只要求 200(旧契约不得被悄悄改掉)', async () => {
  const s = await startServer((req, res) => {
    res.writeHead(200)
    res.end('anything')
  })
  try {
    assert.equal(await probe({ healthPath: '/', healthMatch: '' })(s.port), true)
  } finally {
    await s.close()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
