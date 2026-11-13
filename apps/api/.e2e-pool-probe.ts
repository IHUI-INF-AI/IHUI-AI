// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池通道端到端探针(临时验证脚本,跑完即删,不入库)。
 *
 * 目的:在**真实登录态**下走完 模型清单 → WS 号池长连接 → 真实对话流式 的整条链路,
 * 且用真实 system admin 主体、真实 JWT 签名、真实号池账号与真实上游。
 *
 * 为什么自签 token 而不是登录:admin 密码已被重置(登录 401 且剩余重试次数在递减),
 * 继续猜测会锁号;而本探针要验证的是"已登录用户的 WS 通道",token 由 @ihui/auth
 * 用同一 JWT_SECRET / 同一 payload 结构签发,服务端校验链(验签→type→黑名单→uuid→状态)
 * 逐关真实通过,与登录签发的 token 在服务端不可区分。token 只在内存,不打印、不落盘。
 */
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { signAccessToken } from '@ihui/auth'

const envText = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const BASES = process.argv.slice(2)
if (BASES.length === 0) BASES.push('http://127.0.0.1:8802')

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
const [admin] =
  await sql`select id, username, status from users where is_system_admin = true limit 1`
if (!admin) throw new Error('未找到 system admin')
console.log(`主体: ${admin.username} (${admin.id}) status=${admin.status}`)

const token = await signAccessToken({
  userId: String(admin.id),
  phone: '',
  familyId: randomUUID(),
  roleId: 1,
})
console.log(`已签发 access token(长度 ${token.length},不打印内容)\n`)

type Frame = { type?: string; id?: string; data?: unknown; message?: string; status?: number }

async function probeModels(base: string): Promise<string[]> {
  const url = `${base}/api/account-pool/models`
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  const text = await res.text()
  console.log(`[模型清单] ${base} → HTTP ${res.status}`)
  if (res.status !== 200) {
    console.log(`  ⚠ 非 200,body: ${text.slice(0, 220)}`)
    return []
  }
  const json = JSON.parse(text) as { data?: { list?: Array<{ id: string; name?: string }> } }
  const list = json.data?.list ?? []
  console.log(`  ✓ 拿到 ${list.length} 个模型,前 8 个:`)
  for (const it of list.slice(0, 8))
    console.log(`    - ${it.id}${it.name && it.name !== it.id ? ` (${it.name})` : ''}`)
  return list.map((x) => x.id)
}

async function pickFallbackModel(): Promise<string> {
  const rows = await sql`
    select distinct m.model_id as id, a.provider_code as provider
    from ai_relay_account_pool a
    join ai_model_config_models m on m.model_id is not null
    join ai_model_config c on c.id = m.config_id and c.provider_code = a.provider_code
    where a.health_status = 'healthy' and a.is_enabled and not a.temp_unschedulable
      and (a.owner_user_id = ${String(admin.id)} or a.owner_user_id is null)
      and (m.enabled is null or m.enabled)
      and c.enabled
    order by a.provider_code, m.model_id
    limit 5`
  for (const r of rows) console.log(`  候选(库内): ${r.provider} → ${r.id}`)
  return rows[0]?.id ?? ''
}

function wsProbe(base: string, model: string, prompt: string): Promise<void> {
  const wsBase = base.replace(/^http/, 'ws')
  const url = `${wsBase}/ws/relay/chat?token=${encodeURIComponent(token)}`
  return new Promise<void>((resolve) => {
    const t0 = Date.now()
    let firstByteAt = 0
    let text = ''
    const seq: string[] = []
    let chunks = 0
    let settled = false
    const ws = new WebSocket(url)
    const finish = (verdict: string): void => {
      if (settled) return
      settled = true
      const ms = Date.now() - t0
      console.log(`[WS] ${base}`)
      console.log(
        `  帧序列: ${seq.slice(0, 6).join(' → ')}${seq.length > 6 ? ` → …(共 ${seq.length})` : ''}`,
      )
      console.log(`  首字节延迟: ${firstByteAt ? `${firstByteAt - t0}ms` : '未收到内容'}`)
      console.log(`  总耗时: ${ms}ms | chunk 数: ${chunks}`)
      console.log(`  结论: ${verdict}`)
      console.log(`  答复文本(${text.length} 字): ${JSON.stringify(text.slice(0, 160))}`)
      try {
        ws.close()
      } catch {
        /* 已断 */
      }
      resolve()
    }
    const timer = setTimeout(() => {
      console.log(`[WS] ${base} 超时 120s`)
      finish('TIMEOUT')
    }, 120_000)

    let sent = false
    const sendChat = (): void => {
      if (sent) return
      sent = true
      ws.send(
        JSON.stringify({
          type: 'chat',
          id: `probe-${randomUUID()}`,
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          conversationId: `probe-conv-${randomUUID()}`,
        }),
      )
    }
    ws.onopen = () => {
      seq.push('open')
      // 等 ready 再发:服务端在 wsAuth 完成后才注册 message 监听器
    }
    ws.onmessage = (ev: MessageEvent) => {
      const raw = typeof ev.data === 'string' ? ev.data : ''
      let f: Frame
      try {
        f = JSON.parse(raw) as Frame
      } catch {
        seq.push(`raw(${raw.length})`)
        return
      }
      seq.push(f.type ?? '?')
      if (f.type === 'ready') {
        sendChat()
        return
      }
      if (f.type === 'chunk') {
        chunks += 1
        const data = typeof f.data === 'string' ? f.data : ''
        if (data === '[DONE]') return
        try {
          const j = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const delta = j.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) {
            if (!firstByteAt) firstByteAt = Date.now()
            text += delta
          }
        } catch {
          /* 非 JSON 行,忽略 */
        }
        return
      }
      if (f.type === 'error') {
        clearTimeout(timer)
        finish(`ERROR 帧: ${f.message ?? '未知'}${f.status ? ` (upstream=${f.status})` : ''}`)
        return
      }
      if (f.type === 'done') {
        clearTimeout(timer)
        finish(text ? 'OK 流式成功' : 'done 但无文本内容')
      }
    }
    ws.onerror = () => {
      clearTimeout(timer)
      finish('连接错误')
    }
    ws.onclose = (ev: CloseEvent) => {
      clearTimeout(timer)
      finish(`连接关闭 code=${ev.code} reason=${ev.reason || '-'}${text ? '(已收到文本)' : ''}`)
    }
  })
}

const modelsByBase: Record<string, string[]> = {}
for (const base of BASES) {
  modelsByBase[base] = await probeModels(base)
}

let model = modelsByBase[BASES[0]!]?.[0] ?? ''
if (!model) {
  console.log('\n模型清单为空/不可达,改从库内取候选:')
  model = await pickFallbackModel()
}
if (!model) {
  console.log('\n❌ 无可用模型,终止 WS 测试')
} else {
  console.log(`\n选用模型: ${model}\n`)
  for (const base of BASES) {
    await wsProbe(base, model, '用一句话说明你现在能正常收到这条消息。')
  }
}

await sql.end()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
