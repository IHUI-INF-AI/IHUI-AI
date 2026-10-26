// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 账号池模型同步(2026-10-23 立;2026-10-26 登记字段单源化)。
 *
 * 把上游 /console/enterprises/personal/models 的能力与上下文元数据,同步成项目的
 * ai_model_config + ai_model_config_models + ai_relay_model_catalog 三张表:
 * - **登记字段单源**(config_name/base_url/api_format/enabled/is_relay_public)=
 *   `scripts/data/relay-upstream-models.jsonl` 的 workbuddy 行(经 parseWorkbuddyRegistration),
 *   与号池登记器 scripts/relay-upstream-models-sync.mjs 吃同一行 ⇒ 谁后跑不再决定结果;
 *   登记表取不到/非法/无本 provider 行 ⇒ 未判定 exit 2,不回落硬编码档位
 *   (现读 dev 库无 workbuddy 配置行、登记表亦无该行 ⇒ 本脚本此刻按设计拒写,先登记再用;
 *    动态侧自有的 models/aliases 仍由本脚本写,登记器只写配置行);
 * - 模型对外 id = `workbuddy/<上游 id>`(避开与现有渠道的同名撞车,别名映射回上游);
 * - 上下文/输出上限/工具/视觉能力全部取上游元数据,不靠猜;
 * - text-to-image 模型(账号池仅 chat)自动排除。
 *
 * 用法(先进入 apps/api):
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts            # 干跑,只打印将变更什么
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts --apply    # 落库(幂等)
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts --apply --remove   # 摘除本脚本建的配置
 *   可选:--uid <账号 uid> / --registry <登记表路径> / --json
 *
 * 退出码:0 成功 / 1 有批次错误 / 2 参数或档位未判定。
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
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
  WORKBUDDY_PROVIDER_CODE,
  buildWorkbuddyModelRows,
  buildConfigMatchStatement,
  buildConfigSyncStatements,
  buildModelSyncStatements,
  parseWorkbuddyRegistration,
  type WorkbuddyPoolModelRow,
  type WorkbuddyRegistrationContract,
} from '../src/services/relay-workbuddy-model-map.js'

const { eq, and } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { dbClient, dbRead } = await import('../src/db/index.js')
const { decryptAccountCredentials } = await import('../src/services/relay-account-pool-service.js')
const { buildHealthHeaders, parseLoginState } =
  await import('../src/services/upstream-adapters/workbuddy-protocol.js')

const PROVIDER = WORKBUDDY_PROVIDER_CODE
/** 登记表默认路径(单源);仓库布局推导,禁 cwd(§15) */
const REGISTRY_DEFAULT = path.resolve(
  SCRIPT_DIR,
  '..',
  '..',
  '..',
  'scripts',
  'data',
  'relay-upstream-models.jsonl',
)
/** 动态同步器自有的展示列(登记器 insert-only,不冲突) */
const CONFIG_DISPLAY = {
  description: 'WorkBuddy 桌面版账号池反代(内部试用,0 价)',
  providerGroup: PROVIDER,
  groupLabel: 'WorkBuddy 账号池',
}

interface TxLike {
  unsafe: (q: string, p?: unknown[]) => Promise<unknown[]>
}

function parseArgs(argv: string[]): {
  apply: boolean
  remove: boolean
  json: boolean
  uid: string | null
  registry: string
} {
  let apply = false
  let remove = false
  let json = false
  let uid: string | null = null
  let registry = REGISTRY_DEFAULT
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') apply = true
    else if (a === '--remove') remove = true
    else if (a === '--json') json = true
    else if (a === '--registry') {
      const tok = argv[i + 1]
      if (!isFlagValueToken(tok)) {
        process.stderr.write(
          `--registry 需要登记表路径 —— 紧邻的 token 实得:${tok === undefined ? '(其后没有任何参数)' : JSON.stringify(tok)}(不得吞掉相邻旗标)\n`,
        )
        process.exit(2)
      }
      registry = tok
      i++
    } else if (a === '--uid') {
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
        '用法: tsx scripts/relay-workbuddy-models.ts [--apply] [--remove] [--uid <uid>] [--registry <path>] [--json]\n',
      )
      process.exit(0)
    } else {
      process.stderr.write(`未知参数: ${a}\n`)
      process.exit(2)
    }
  }
  return { apply, remove, json, uid, registry }
}

async function fetchUpstreamModels(
  uid: string | null,
  baseUrl: string,
): Promise<WorkbuddyUpstreamModel[]> {
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
  const res = await fetch(`${baseUrl}/console/enterprises/personal/models`, {
    headers: buildHealthHeaders({ realm: 'cn', accessToken: login.accessToken }),
  })
  if (!res.ok) throw new Error(`上游模型目录 HTTP ${res.status}`)
  const json = (await res.json()) as { code?: number; data?: { models?: WorkbuddyUpstreamModel[] } }
  if (json.code !== 0 || !Array.isArray(json.data?.models)) throw new Error('上游模型目录信封非法')
  return json.data.models
}

async function upsertConfig(tx: TxLike, contract: WorkbuddyRegistrationContract): Promise<number> {
  const match = buildConfigMatchStatement(contract)
  const existing = (await tx.unsafe(match.sql, match.params)) as Array<{ id: string | number }>
  const existingId = existing[0] ? Number(existing[0].id) : null
  const stmt = buildConfigSyncStatements(contract, CONFIG_DISPLAY, existingId)
  const written = (await tx.unsafe(stmt.sql, stmt.params)) as Array<{ id: string | number }>
  const id = written[0]?.id ?? existingId
  if (id === null || id === undefined) throw new Error('配置行写入后未取到 id')
  return Number(id)
}

async function upsertModel(
  tx: TxLike,
  contract: WorkbuddyRegistrationContract,
  configId: number,
  row: WorkbuddyPoolModelRow,
): Promise<'inserted' | 'updated'> {
  const existing = (await tx.unsafe(
    `select id from ai_model_config_models where config_id=$1 and model_id=$2 limit 1`,
    [configId, row.modelId],
  )) as Array<{ id: string | number }>
  const existingId = existing[0] ? Number(existing[0].id) : null
  const stmt = buildModelSyncStatements(contract, configId, row, existingId)
  await tx.unsafe(stmt.sql, stmt.params)
  return existingId === null ? 'inserted' : 'updated'
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

  let registryText: string
  try {
    registryText = readFileSync(opts.registry, 'utf8')
  } catch (e) {
    process.stderr.write(
      `登记表取不到:${opts.registry}(${e instanceof Error ? e.message : String(e)})—— 出路:按 scripts/relay-upstream-models-sync.mjs 的口径先登记 ${PROVIDER} 档位,或用 --registry 指向已有登记表\n`,
    )
    return 2
  }
  const registration = parseWorkbuddyRegistration(registryText)
  if (!registration.ok) {
    process.stderr.write(`未判定:${registration.why}\n`)
    return 2
  }
  const contract = registration.contract
  const models = await fetchUpstreamModels(opts.uid, contract.baseUrl)
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
    const configId = await upsertConfig(tx as unknown as TxLike, contract)
    let inserted = 0
    let updated = 0
    for (const row of rows) {
      const r = await upsertModel(tx as unknown as TxLike, contract, configId, row)
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
