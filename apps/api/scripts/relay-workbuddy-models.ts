// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 账号池模型同步(2026-10-23 立)。
 *
 * 把上游 /console/enterprises/personal/models 的能力与上下文元数据,同步成项目的
 * ai_model_config + ai_model_config_models + ai_relay_model_catalog 三张表:
 * - 模型对外 id = `workbuddy/<上游 id>`(避开与现有渠道的同名撞车,别名映射回上游);
 * - 默认 **内部可见、0 价试用**(is_relay_public=false,价格 0);公开市场要另开标记;
 * - 上下文/输出上限/工具/视觉能力全部取上游元数据,不靠猜;
 * - text-to-image 模型(账号池仅 chat)自动排除。
 *
 * 用法(先进入 apps/api):
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts            # 干跑,只打印将变更什么
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts --apply    # 落库(幂等)
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts --apply --remove   # 摘除本脚本建的配置
 *   可选:--uid <账号 uid> / --json
 *
 * 退出码:0 成功 / 1 有批次错误 / 2 参数或环境未判定。
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// 带值旗标取值口径(G-322):紧邻 token 必须非空且不以 `-` 开头。本地副本与
// scripts/lib/flag-value.mjs 的 isFlagValueToken 逐字同源 —— apps/api→repo-tooling 被
// config/architecture-policy.yaml 禁止(D1/D2/D3),消依赖优先;语义变更须两处同改。
function isFlagValueToken(token: unknown): boolean {
  return typeof token === 'string' && token !== '' && !token.startsWith('-')
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(SCRIPT_DIR, '..', '.env') })

import type { WorkbuddyUpstreamModel } from '../src/services/relay-workbuddy-model-map.js'
import {
  WORKBUDDY_MODEL_PREFIX,
  buildWorkbuddyModelRows,
  type WorkbuddyPoolModelRow,
} from '../src/services/relay-workbuddy-model-map.js'

const { eq, and } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { dbClient, dbRead } = await import('../src/db/index.js')
const { decryptAccountCredentials } = await import('../src/services/relay-account-pool-service.js')
const { buildHealthHeaders, chatBaseUrl, parseLoginState } =
  await import('../src/services/upstream-adapters/workbuddy-protocol.js')

const PROVIDER = 'workbuddy'
const CONFIG_NAME = 'WorkBuddy 账号池(反代)'
const BASE_URL = chatBaseUrl('cn')

interface TxLike {
  unsafe: (q: string, p?: unknown[]) => Promise<unknown[]>
}

function parseArgs(argv: string[]): {
  apply: boolean
  remove: boolean
  json: boolean
  uid: string | null
} {
  let apply = false
  let remove = false
  let json = false
  let uid: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') apply = true
    else if (a === '--remove') remove = true
    else if (a === '--json') json = true
    else if (a === '--uid') {
      // G-322:值被紧邻旗标顶掉(`--uid --apply`)或结尾无值不得吞,点名 exit 2。
      const tok = argv[i + 1]
      if (!isFlagValueToken(tok)) {
        process.stderr.write(
          `--uid 需要一个账号 uid —— 紧邻的 token 实得:${tok === undefined ? '(其后没有任何参数)' : JSON.stringify(tok)}(不得吞掉相邻旗标)\n`,
        )
        process.exit(2)
      }
      uid = tok
      i++
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(
        '用法: tsx scripts/relay-workbuddy-models.ts [--apply] [--remove] [--uid <uid>] [--json]\n',
      )
      process.exit(0)
    } else {
      process.stderr.write(`未知参数: ${a}\n`)
      process.exit(2)
    }
  }
  return { apply, remove, json, uid }
}

async function fetchUpstreamModels(uid: string | null): Promise<WorkbuddyUpstreamModel[]> {
  let rows
  if (uid) {
    rows = await dbRead
      .select()
      .from(aiRelayAccountPool)
      .where(and(eq(aiRelayAccountPool.providerCode, PROVIDER), eq(aiRelayAccountPool.uid, uid)))
      .limit(1)
  } else {
    rows = await dbRead
      .select()
      .from(aiRelayAccountPool)
      .where(
        and(eq(aiRelayAccountPool.providerCode, PROVIDER), eq(aiRelayAccountPool.isEnabled, true)),
      )
      .orderBy(aiRelayAccountPool.priority)
      .limit(1)
  }
  const row = rows[0]
  if (!row) throw new Error(`没有可用的 ${PROVIDER} 账号(uid=${uid ?? '任意'})`)
  const credentials = decryptAccountCredentials(row)
  const login = parseLoginState(credentials)
  if (!login.accessToken) throw new Error('账号没有 accessToken')
  const res = await fetch(`${BASE_URL}/console/enterprises/personal/models`, {
    headers: buildHealthHeaders({ realm: 'cn', accessToken: login.accessToken }),
  })
  if (!res.ok) throw new Error(`上游模型目录 HTTP ${res.status}`)
  const json = (await res.json()) as { code?: number; data?: { models?: WorkbuddyUpstreamModel[] } }
  if (json.code !== 0 || !Array.isArray(json.data?.models)) throw new Error('上游模型目录信封非法')
  return json.data.models
}

async function upsertConfig(tx: TxLike): Promise<number> {
  const existing = (await tx.unsafe(
    `select id from ai_model_config where provider_code=$1 order by id limit 1`,
    [PROVIDER],
  )) as Array<{ id: string | number }>
  if (existing[0]) {
    await tx.unsafe(
      `update ai_model_config set name=$1, base_url=$2, api_format='openai_chat', enabled=true,
         description=$3, provider_group=$4, group_label=$5, updated_at=now() where id=$6`,
      [
        CONFIG_NAME,
        BASE_URL,
        'WorkBuddy 桌面版账号池反代(内部试用,0 价)',
        PROVIDER,
        'WorkBuddy 账号池',
        existing[0].id,
      ],
    )
    return Number(existing[0].id)
  }
  const inserted = (await tx.unsafe(
    `insert into ai_model_config (name, provider_code, base_url, api_format, enabled, description, provider_group, group_label, is_builtin)
     values ($1,$2,$3,'openai_chat',true,$4,$5,$6,false) returning id`,
    [
      CONFIG_NAME,
      PROVIDER,
      BASE_URL,
      'WorkBuddy 桌面版账号池反代(内部试用,0 价)',
      PROVIDER,
      'WorkBuddy 账号池',
    ],
  )) as Array<{ id: string | number }>
  return Number(inserted[0]?.id)
}

async function upsertModel(
  tx: TxLike,
  configId: number,
  row: WorkbuddyPoolModelRow,
): Promise<'inserted' | 'updated'> {
  const existing = (await tx.unsafe(
    `select id from ai_model_config_models where config_id=$1 and model_id=$2 limit 1`,
    [configId, row.modelId],
  )) as Array<{ id: string | number }>
  const metadata = JSON.stringify(row.metadata)
  if (existing[0]) {
    await tx.unsafe(
      `update ai_model_config_models set display_name=$1, context_length=$2, max_output_tokens=$3,
         input_price_per_1k=0, output_price_per_1k=0, enabled=true, is_relay_public=false,
         supports_tool_call=$4, supports_vision=$5, supports_streaming=true, tags=$6::text[],
         vendor=$7, description=$8, sort_order=$9, metadata=$10::jsonb, updated_at=now() where id=$11`,
      [
        row.displayName,
        row.contextLength,
        row.maxOutputTokens,
        row.supportsToolCall,
        row.supportsVision,
        row.tags,
        row.vendor,
        row.description,
        row.sortOrder,
        metadata,
        existing[0].id,
      ],
    )
    return 'updated'
  }
  await tx.unsafe(
    `insert into ai_model_config_models
       (config_id, model_id, display_name, context_length, max_output_tokens, input_price_per_1k, output_price_per_1k,
        enabled, is_relay_public, supports_tool_call, supports_vision, supports_streaming, tags, vendor, description, sort_order, metadata)
     values ($1,$2,$3,$4,$5,0,0,true,false,$6,$7,true,$8::text[],$9,$10,$11,$12::jsonb)`,
    [
      configId,
      row.modelId,
      row.displayName,
      row.contextLength,
      row.maxOutputTokens,
      row.supportsToolCall,
      row.supportsVision,
      row.tags,
      row.vendor,
      row.description,
      row.sortOrder,
      metadata,
    ],
  )
  return 'inserted'
}

async function upsertAlias(tx: TxLike, row: WorkbuddyPoolModelRow): Promise<void> {
  await tx.unsafe(
    `insert into ai_relay_model_catalog (provider_code, upstream_model, display_name, alias, enabled)
     values ($1,$2,$3,$4,true)
     on conflict (provider_code, alias) do update set upstream_model=excluded.upstream_model,
       display_name=excluded.display_name, enabled=true, updated_at=now()`,
    [PROVIDER, row.upstreamModel, row.displayName, row.modelId],
  )
}

async function removeAll(): Promise<{ configs: number; models: number; aliases: number }> {
  return dbClient.begin(async (tx) => {
    const aliases = await tx.unsafe(
      `delete from ai_relay_model_catalog where provider_code=$1 and alias like $2 returning id`,
      [PROVIDER, `${WORKBUDDY_MODEL_PREFIX}%`],
    )
    const models = await tx.unsafe(
      `delete from ai_model_config_models where model_id like $1 and config_id in
         (select id from ai_model_config where provider_code=$2) returning id`,
      [`${WORKBUDDY_MODEL_PREFIX}%`, PROVIDER],
    )
    const configs = await tx.unsafe(
      `delete from ai_model_config where provider_code=$1 returning id`,
      [PROVIDER],
    )
    return { configs: configs.length, models: models.length, aliases: aliases.length }
  })
}

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.remove) {
    if (!opts.apply) {
      process.stdout.write('干跑:--remove 需要同时给 --apply 才会真删\n')
      return 0
    }
    const removed = await removeAll()
    process.stdout.write(`已摘除 ${JSON.stringify(removed)}\n`)
    return 0
  }

  const models = await fetchUpstreamModels(opts.uid)
  const rows = buildWorkbuddyModelRows(models)
  const excluded = models
    .filter((m) => !rows.some((r) => r.upstreamModel === m.id))
    .map((m) => m.id)
  const summary = {
    upstream: models.length,
    willSync: rows.length,
    excluded,
    prefix: WORKBUDDY_MODEL_PREFIX,
    sample: rows.slice(0, 5).map((r) => ({
      id: r.modelId,
      context: r.contextLength,
      maxOut: r.maxOutputTokens,
      tool: r.supportsToolCall,
      vision: r.supportsVision,
    })),
    apply: opts.apply,
  }
  if (!opts.apply) {
    process.stdout.write(
      `${opts.json ? JSON.stringify(summary, null, 2) : JSON.stringify(summary)}\n`,
    )
    process.stdout.write('干跑完成;加 --apply 才会写库\n')
    return 0
  }

  const result = await dbClient.begin(async (tx) => {
    const configId = await upsertConfig(tx as unknown as TxLike)
    let inserted = 0
    let updated = 0
    for (const row of rows) {
      const r = await upsertModel(tx as unknown as TxLike, configId, row)
      if (r === 'inserted') inserted++
      else updated++
      await upsertAlias(tx as unknown as TxLike, row)
    }
    const ids = rows.map((r) => r.modelId)
    const staleModels = (await tx.unsafe(
      `delete from ai_model_config_models where config_id=$1 and model_id like $2 and not (model_id = any($3::varchar[])) returning id`,
      [configId, `${WORKBUDDY_MODEL_PREFIX}%`, ids],
    )) as unknown[]
    const staleAliases = (await tx.unsafe(
      `delete from ai_relay_model_catalog where provider_code=$1 and alias like $2 and not (alias = any($3::varchar[])) returning id`,
      [PROVIDER, `${WORKBUDDY_MODEL_PREFIX}%`, ids],
    )) as unknown[]
    return {
      configId,
      inserted,
      updated,
      staleModels: staleModels.length,
      staleAliases: staleAliases.length,
    }
  })
  const out = { ...summary, ...result }
  process.stdout.write(`${opts.json ? JSON.stringify(out, null, 2) : JSON.stringify(out)}\n`)
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(2)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
