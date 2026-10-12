// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// IHUI-AI 公网 WebSocket 端到端冒烟测试
// -----------------------------------------------------------------------------
// 验证生产环境「登录 → 公网 WS 对话 → 收到模型 delta」全链路：
//   1. 通过公网 REST 登录(默认 aizhs.top)获取 accessToken
//   2. 浏览器同源页面(aizhs.top)发起跨域 WS 到 api.aizhs.top
//   3. 发送 capability.start,断言收到 capability.delta + capability.done
//
// 设计要点(对应 2026-09-04 修复):
//   - WS 必须指向 api.aizhs.top 子域(主域 aizhs.top 对 /v1/... 的 WS 升级不通)
//   - 跨域 Origin(https://aizhs.top)必须在 api 的 CORS_ORIGIN 白名单内,否则 403
//
// 运行(无需 npm 安装依赖,使用 Node 22 全局 WebSocket):
//   node deploy/prod-bundle/scripts/smoke-public-ws.mjs
// 或指定参数:
//   SMOKE_WEB_HOST=aizhs.top SMOKE_WS_HOST=api.aizhs.top \
//   SMOKE_ACCOUNT=admin SMOKE_PASSWORD=admin123 \
//   node deploy/prod-bundle/scripts/smoke-public-ws.mjs
// 退出码:0=通过, 非0=失败。CI/定时任务可据此判定。
// =============================================================================

const WEB_HOST = process.env.SMOKE_WEB_HOST || 'aizhs.top'
const WS_HOST = process.env.SMOKE_WS_HOST || 'api.aizhs.top'
const ACCOUNT = process.env.SMOKE_ACCOUNT || 'admin'
const PASSWORD = process.env.SMOKE_PASSWORD || 'admin123'
const PROMPT = process.env.SMOKE_PROMPT || 'say hi in one word'
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || '35000')

const LOGIN_URL = `https://${WEB_HOST}/api/auth/login`
const WS_URL = `wss://${WS_HOST}/v1/ai/capabilities/ws/stream`
const ORIGIN = `https://${WEB_HOST}` // 模拟浏览器同源页面发起的跨域 WS

function parseMessages(raw) {
  const out = []
  const text = raw.toString()
  try {
    const j = JSON.parse(text.trim())
    return Array.isArray(j) ? j : [j]
  } catch {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try { out.push(JSON.parse(t)) } catch {}
  }
  return out
}

function fail(msg) {
  console.error(`\n[SMOKE] FAIL: ${msg}`)
  process.exit(1)
}

async function main() {
  console.log(`[SMOKE] web=${WEB_HOST} ws=${WS_HOST} origin=${ORIGIN}`)

  // 1) 登录
  let token
  try {
    const resp = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: ACCOUNT, password: PASSWORD }),
    })
    const json = await resp.json()
    if (json?.code !== 0 || !json?.data?.accessToken) {
      fail(`login 失败: HTTP ${resp.status} ${JSON.stringify(json).slice(0, 200)}`)
    }
    token = json.data.accessToken
    console.log(`[SMOKE] login OK (token_len=${token.length})`)
  } catch (e) {
    fail(`login 请求异常: ${e.message}`)
  }

  // 2) WS 对话
  const url = `${WS_URL}?token=${encodeURIComponent(token)}`
  const ws = new WebSocket(url, { origin: ORIGIN })
  const seen = []
  let gotDelta = false
  let done = false

  const timer = setTimeout(() => {
    console.error(`[SMOKE] TIMEOUT after ${TIMEOUT_MS}ms. events=${JSON.stringify(seen)}`)
    try { ws.close() } catch {}
    process.exit(2)
  }, TIMEOUT_MS)

  ws.addEventListener('open', () => {
    console.log(`[SMOKE] WS OPEN ${url.slice(0, 64)}...`)
    ws.send(JSON.stringify({ type: 'capability.start', prompt: PROMPT }))
  })

  ws.addEventListener('message', (ev) => {
    for (const m of parseMessages(ev.data)) {
      const evName = m?.event ?? m?.type ?? '?'
      seen.push(evName)
      if (evName === 'capability.delta' || evName === 'delta') {
        gotDelta = true
        const c = m?.content ?? m?.data?.content ?? m?.raw ?? ''
        process.stdout.write(`[SMOKE] DELTA: ${typeof c === 'string' ? c : JSON.stringify(c)}\n`)
      } else if (evName === 'capability.done' || evName === 'done') {
        done = true
        clearTimeout(timer)
        console.log(`[SMOKE] DONE. events=${JSON.stringify(seen.slice(0, 12))}`)
        try { ws.close() } catch {}
        if (gotDelta) {
          console.log('\n[SMOKE] PASS ✅ 公网 WS 全链路正常')
          process.exit(0)
        }
        fail('收到 done 但未收到任何 delta')
      } else if (evName === 'error') {
        fail(`WS error 事件: ${JSON.stringify(m).slice(0, 300)}`)
      }
    }
  })

  ws.addEventListener('error', (e) => {
    clearTimeout(timer)
    fail(`WS error: ${e.message || 'unknown'}`)
  })

  ws.addEventListener('close', (e) => {
    clearTimeout(timer)
    if (!done) {
      console.error(`[SMOKE] WS 提前关闭 code=${e.code} gotDelta=${gotDelta} seen=${JSON.stringify(seen)}`)
      process.exit(gotDelta ? 0 : 3)
    }
  })
}

main().catch((e) => fail(`FATAL: ${e.stack || e.message}`))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
