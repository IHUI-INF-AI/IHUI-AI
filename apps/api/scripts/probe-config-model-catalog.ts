// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 诊断脚本:用 Gemini 原生模型目录核对非文本模型的“存在性 + 可调用端点”,不生成图片/音频/视频,不消耗生成额度。
import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import postgres from 'postgres'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
import { getDecryptedApiKey } from '../src/services/llm-connectivity-test.js'

function arg(name: string): string | null {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

type CatalogModel = {
  id: string
  displayName?: string
  supportedGenerationMethods?: string[]
}

function classify(modelId: string): string {
  if (/(image|nano-banana)/i.test(modelId)) return 'image'
  if (/tts/i.test(modelId)) return 'tts'
  if (/lyria/i.test(modelId)) return 'music'
  if (/(live|transcribe|native-audio)/i.test(modelId)) return 'live_audio'
  if (/omni/i.test(modelId)) return 'omni'
  if (/(robotics|computer-use)/i.test(modelId)) return 'robotics_computer'
  return 'text'
}

function proxyDispatcher(): ProxyAgent | undefined {
  const proxyUrl = (process.env.LLM_PROXY_URL || process.env.SYNC_PROXY_URL || '').trim()
  if (!proxyUrl) return undefined
  try {
    return new ProxyAgent(proxyUrl)
  } catch {
    return undefined
  }
}

async function fetchCatalog(origin: string, key: string): Promise<CatalogModel[]> {
  const dispatcher = proxyDispatcher()
  const models: CatalogModel[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${origin}/v1beta/models`)
    url.searchParams.set('key', key)
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const resp = await undiciFetch(url, {
      dispatcher,
      signal: AbortSignal.timeout(20_000),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`catalog HTTP ${resp.status}: ${text.slice(0, 160)}`)
    }
    const body = (await resp.json()) as {
      models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>
      nextPageToken?: string
    }
    for (const m of body.models ?? []) {
      if (!m.name) continue
      models.push({
        id: m.name.replace(/^models\//, ''),
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods ?? [],
      })
    }
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return models
}

async function countTokens(origin: string, key: string, modelId: string): Promise<{ status: number; error?: string }> {
  const dispatcher = proxyDispatcher()
  const url = new URL(`${origin}/v1beta/models/${encodeURIComponent(modelId)}:countTokens`)
  url.searchParams.set('key', key)
  const resp = await undiciFetch(url, {
    method: 'POST',
    dispatcher,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
    signal: AbortSignal.timeout(10_000),
  })
  if (resp.ok) return { status: resp.status }
  const text = await resp.text().catch(() => '')
  return { status: resp.status, error: text.slice(0, 160) }
}

async function main() {
  const id = Number(arg('id') ?? 5)
  const out = arg('out')
  const only = arg('only') ?? 'nontext'
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未配置')
  const sql = postgres(databaseUrl, { max: 2, idle_timeout: 20 })
  try {
    const [config] = await sql`
      select id::int as id, name, provider_code as "providerCode",
             base_url as "baseUrl", api_key_enc as "apiKeyEnc"
      from ai_model_config where id = ${id} limit 1
    `
    if (!config) throw new Error(`配置 ${id} 不存在`)
    const apiKey = getDecryptedApiKey({ apiKeyEnc: (config.apiKeyEnc as string | null) ?? null })
    if (!apiKey) throw new Error('配置没有可解密的 API Key')
    const origin = new URL(String(config.baseUrl)).origin
    const rows = await sql<{ modelId: string; rowId: string }[]>`
      select model_id as "modelId", id::text as "rowId"
      from ai_model_config_models
      where config_id = ${id} and enabled and is_relay_public
      order by id
    `
    const targets = rows.filter((r) => (only === 'all' ? true : classify(r.modelId) !== 'text'))
    const catalog = await fetchCatalog(origin, apiKey)
    const catalogById = new Map(catalog.map((m) => [m.id, m]))

    const results: Record<string, unknown>[] = []
    let cursor = 0
    const worker = async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++]
        if (!target) break
        const meta = catalogById.get(target.modelId)
        const kind = classify(target.modelId)
        let countTokensStatus: number | null = null
        let countTokensError: string | null = null
        if (meta) {
          try {
            const r = await countTokens(origin, apiKey, target.modelId)
            countTokensStatus = r.status
            countTokensError = r.error ?? null
          } catch (e) {
            countTokensError = (e as Error).message
          }
        }
        const row = {
          configId: id,
          modelRowId: target.rowId,
          modelId: target.modelId,
          kind,
          catalogPresent: Boolean(meta),
          supportedGenerationMethods: meta?.supportedGenerationMethods ?? [],
          countTokensStatus,
          countTokensError,
          verdict: !meta
            ? 'catalog_missing'
            : countTokensStatus === 200
              ? 'endpoint_reachable'
              : countTokensStatus === 400
                ? 'catalog_only_method_unsupported'
                : 'endpoint_error',
        }
        results.push(row)
        console.log(JSON.stringify(row))
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker))
    const payload = {
      configId: id,
      generatedAt: new Date().toISOString(),
      catalogSize: catalog.length,
      totalPublic: rows.length,
      probed: results.length,
      summary: {
        catalogPresent: results.filter((r) => r.catalogPresent).length,
        catalogMissing: results.filter((r) => !r.catalogPresent).length,
        endpointReachable: results.filter((r) => r.verdict === 'endpoint_reachable').length,
        catalogOnly: results.filter((r) => r.verdict === 'catalog_only_method_unsupported').length,
        endpointError: results.filter((r) => r.verdict === 'endpoint_error').length,
      },
      results,
    }
    if (out) await writeFile(out, JSON.stringify(payload, null, 2), 'utf8')
    console.log(JSON.stringify({ summary: true, ...payload.summary, catalogSize: payload.catalogSize, probed: payload.probed }))
  } finally {
    await sql.end({ timeout: 5 })
  }
}

await main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
