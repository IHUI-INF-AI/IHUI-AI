// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 诊断脚本:对某个配置的全部公开文本模型逐个发最小对话,只读不写库。
import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import postgres from 'postgres'
import { testLlmConnectivity } from '../src/services/llm-connectivity-test.js'

function arg(name: string): string | null {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

// 这些 ID 不是文本模型,不能用 chat/completions 判活;它们是否可用由上游 /models 目录保证。
const NON_TEXT = /(image|tts|audio|live|lyria|transcribe|video|robotics|computer-use|omni|nano-banana)/i

async function main() {
  const id = Number(arg('id') ?? 5)
  const out = arg('out')
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未配置')
  const sql = postgres(databaseUrl, { max: 2, idle_timeout: 20 })
  try {
    const [config] = await sql`
      select id::int as id, name, provider_code as "providerCode",
             base_url as "baseUrl", api_format as "apiFormat",
             api_key_enc as "apiKeyEnc"
      from ai_model_config where id = ${id} limit 1
    `
    if (!config) throw new Error(`配置 ${id} 不存在`)
    const models = await sql<{ modelId: string; rowId: string }[]>`
      select model_id as "modelId", id::text as "rowId"
      from ai_model_config_models
      where config_id = ${id} and enabled and is_relay_public
      order by model_id
    `
    const textModels = models.filter((m) => !NON_TEXT.test(m.modelId))
    const results: Record<string, unknown>[] = []
    let cursor = 0
    const worker = async () => {
      while (cursor < textModels.length) {
        const item = textModels[cursor++]
        if (!item) break
        const r = await testLlmConnectivity({
          baseUrl: String(config.baseUrl),
          apiKeyEnc: (config.apiKeyEnc as string | null) ?? null,
          providerCode: String(config.providerCode),
          apiFormat: (config.apiFormat as string | null) ?? null,
          modelId: item.modelId,
        })
        const row = { configId: id, modelRowId: item.rowId, modelId: item.modelId, ...r }
        results.push(row)
        console.log(JSON.stringify(row))
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
    const payload = {
      configId: id,
      generatedAt: new Date().toISOString(),
      totalPublic: models.length,
      textPublic: textModels.length,
      nonTextSkipped: models.length - textModels.length,
      success: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status !== 'success').length,
      results,
    }
    if (out) await writeFile(out, JSON.stringify(payload, null, 2), 'utf8')
    console.log(JSON.stringify({ summary: true, totalPublic: payload.totalPublic, textPublic: payload.textPublic, nonTextSkipped: payload.nonTextSkipped, success: payload.success, failed: payload.failed }))
  } finally {
    await sql.end({ timeout: 5 })
  }
}

await main()
