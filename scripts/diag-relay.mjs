// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 网关连通性自测 CLI(2026-11-17 立)。
 *
 * 立因:对标 qoder2api-hub 的 `_diag_gateway.py --chat` / `_verify_models.py` ——
 * 一台机器上「网关到底通不通、模型清单对不对」应该能一条命令问清楚,而不是翻日志。
 *
 * 用法:
 *   node scripts/diag-relay.mjs --models              列出 /v1/models(条数 + 前几条 id)
 *   node scripts/diag-relay.mjs --chat [--model=xxx]  打一次流式 chat,报首字节延迟
 *
 * 环境变量(都可被命令行覆盖):
 *   IHUI_GATEWAY_BASE  网关基址,默认 http://127.0.0.1:3001
 *   IHUI_GATEWAY_KEY   API Key;缺失时尝试读 .env 的 IHUI_DIAG_KEY
 *
 * 纪律(与仓内所有诊断器一致):
 * - **不伪造结论**:连不上就 exit 2 并说清「未判定」,不打印"OK";
 * - **不打印密钥**:只回显前 6 后 4;
 * - 只读:不发写请求、不改任何状态。
 */

const DEFAULT_BASE = 'http://127.0.0.1:3001'
const TIMEOUT_MS = Number(process.env.IHUI_DIAG_TIMEOUT_MS ?? 30_000)

function parseArgs(argv) {
  const out = { models: false, chat: false, model: null, base: null, key: null }
  for (const arg of argv.slice(2)) {
    if (arg === '--models') out.models = true
    else if (arg === '--chat') out.chat = true
    else if (arg.startsWith('--model=')) out.model = arg.slice('--model='.length)
    else if (arg.startsWith('--base=')) out.base = arg.slice('--base='.length)
    else if (arg.startsWith('--key=')) out.key = arg.slice('--key='.length)
  }
  return out
}

function maskKey(key) {
  if (!key) return '(未提供)'
  if (key.length <= 10) return `${key.slice(0, 2)}***`
  return `${key.slice(0, 6)}***${key.slice(-4)}`
}

function usage() {
  console.error('用法: node scripts/diag-relay.mjs --models | --chat [--model=<id>] [--base=<url>] [--key=<key>]')
  console.error('缺少模式参数 ⇒ 未判定(exit 2)。')
  process.exit(2)
}

async function diagModels({ base, key }) {
  const url = `${base}/v1/models`
  const started = Date.now()
  let resp
  try {
    resp = await fetch(url, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    console.error(`[未判定] GET /v1/models 连不上: ${e?.message ?? e}`)
    process.exit(2)
  }
  const elapsed = Date.now() - started
  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    console.error(`[未判定] GET /v1/models HTTP ${resp.status}: ${body?.message ?? body?.error ?? ''}`)
    process.exit(2)
  }
  const data = Array.isArray(body?.data) ? body.data : []
  const unavailable = data.filter((m) => m?.available === false).length
  console.log(`GET /v1/models  HTTP ${resp.status}  ${elapsed}ms  X-Model-Source=${resp.headers.get('x-model-source') ?? '-'}`)
  console.log(`条目 ${data.length} 条,其中标记 available:false 的 ${unavailable} 条`)
  for (const m of data.slice(0, 8)) {
    const tag = m?.available === false ? ` [不可用:${m?.x_disabled_category ?? '-'}]` : ''
    console.log(`  - ${m?.id ?? '(无 id)'}${tag}`)
  }
  if (data.length === 0) {
    console.error('[注意] 清单为 0 条:可能确实没上架任何模型,也可能是 DB 路径未命中 —— 本条不作"通"的结论。')
  }
  return data.length > 0 ? 0 : 2
}

async function diagChat({ base, key, model }) {
  const url = `${base}/v1/chat/completions`
  const body = {
    model: model ?? 'auto',
    messages: [{ role: 'user', content: 'ping' }],
    stream: true,
    max_tokens: 8,
  }
  const started = Date.now()
  let resp
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    console.error(`[未判定] POST /v1/chat/completions 连不上: ${e?.message ?? e}`)
    process.exit(2)
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    console.error(`[未判定] POST /v1/chat/completions HTTP ${resp.status}: ${text.slice(0, 300)}`)
    process.exit(2)
  }
  // 流式:量首字节与首帧内容,不把整条流打屏
  const reader = resp.body?.getReader()
  if (!reader) {
    console.error('[未判定] 响应无 body,无法判定流式行为')
    process.exit(2)
  }
  let firstByteAt = null
  let firstContent = null
  let frames = 0
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (firstByteAt === null) firstByteAt = Date.now()
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.trim().startsWith('data:')) continue
        const payload = line.trim().slice(5).trim()
        if (payload === '[DONE]') continue
        frames += 1
        if (firstContent === null) {
          try {
            const json = JSON.parse(payload)
            const content = json?.choices?.[0]?.delta?.content
            if (typeof content === 'string' && content) firstContent = content
          } catch {
            // 非 JSON 帧(如注释`)不当作内容
          }
        }
      }
      if (frames >= 40) {
        void reader.cancel().catch(() => {})
        break
      }
    }
  } catch (e) {
    console.error(`[未判定] 读流中断: ${e?.message ?? e}`)
    process.exit(2)
  } finally {
    reader.releaseLock?.()
  }
  const ttft = firstByteAt === null ? null : firstByteAt - started
  const total = Date.now() - started
  console.log(`POST /v1/chat/completions  HTTP ${resp.status}  model=${body.model}`)
  console.log(`首字节 ${ttft === null ? '未取到' : `${ttft}ms`}  (总 ${total}ms,读到 ${frames} 帧)`)
  console.log(`首段内容: ${firstContent === null ? '(空)' : JSON.stringify(firstContent.slice(0, 60))}`)
  if (firstByteAt === null) {
    console.error('[未判定] 一个字节都没读到 ⇒ 不能判"通"。')
    process.exit(2)
  }
  return 0
}

const args = parseArgs(process.argv)
if (!args.models && !args.chat) usage()

const base = (args.base ?? process.env.IHUI_GATEWAY_BASE ?? DEFAULT_BASE).replace(/\/+$/, '')
const key = args.key ?? process.env.IHUI_GATEWAY_KEY ?? process.env.IHUI_DIAG_KEY ?? null
console.log(`目标 ${base}  key=${maskKey(key)}`)
const code = args.chat ? await diagChat({ base, key, model: args.model }) : await diagModels({ base, key })
process.exit(code)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
