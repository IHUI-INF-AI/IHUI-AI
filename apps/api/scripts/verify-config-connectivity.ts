// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 诊断脚本:用生产同一个 testLlmConnectivity 入口验证配置连通,会读取 LLM_PROXY_URL/SYNC_PROXY_URL。
import 'dotenv/config'
import postgres from 'postgres'
import { testLlmConnectivity } from '../src/services/llm-connectivity-test.js'

function arg(name: string): string | null {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

async function main() {
  const id = Number(arg('id'))
  const modelArg = arg('model')
  if (!Number.isInteger(id)) throw new Error('需要 --id')
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未配置')
  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 20 })
  try {
    const [row] = await sql`
      select id::int as id, name, provider_code as "providerCode",
             base_url as "baseUrl", api_format as "apiFormat",
             api_key_enc as "apiKeyEnc"
      from ai_model_config where id = ${id} limit 1
    `
    if (!row) throw new Error(`配置 ${id} 不存在`)
    const result = await testLlmConnectivity({
      baseUrl: String(row.baseUrl),
      apiKeyEnc: (row.apiKeyEnc as string | null) ?? null,
      providerCode: String(row.providerCode),
      apiFormat: (row.apiFormat as string | null) ?? null,
      modelId: modelArg,
    })
    console.log(JSON.stringify({ id, name: row.name, model: modelArg, ...result }))
  } finally {
    await sql.end({ timeout: 5 })
  }
}

await main()
