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
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts --check    # 只读对账(不联网/不写库):本 provider 的行归属谁
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts --apply    # 落库(幂等)
 *   pnpm exec tsx scripts/relay-workbuddy-models.ts --apply --remove   # 摘除本脚本建的配置
 *   可选:--uid <账号 uid> / --json
 *
 * 归属守卫(2026-10-30 立,票「上游模型登记器与 workbuddy 动态同步器并存无对账」):
 * ai_model_config 的 provider_code=workbuddy 行还有第二个生产入口 —— `scripts/relay-upstream-models-sync.mjs`
 * 按 scripts/data/relay-upstream-models.jsonl 登记(它的 provider 白名单 RELAY_PROVIDERS 本来就含 workbuddy)。
 * 本器旧版按 provider_code 取 id 最小的一行**无条件 update**(--remove 更是按 provider 全删),于是谁最后跑
 * 谁赢,且会把对方 description 里的出处标记洗掉 ⇒ 对方下一轮判"两条路径抢同一行"BREACH,两边锁死。
 * 现在:归属判据 = 本器自有的 description 前缀(CONFIG_DESCRIPTION,零复制对方判据),非本器的行/多行
 * 一律拒写拒删并点名(exit 1);对方侧的同 provider 检测由 `relay-upstream-models-sync.mjs --check` 的
 * OWNERSHIP/COEXIST 读数负责 —— 两侧各判各的归属,不各写一份对账判据。
 *
 * 退出码:0 成功 / 1 有批次错误或归属冲突(不许动) / 2 参数或环境未判定。
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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
/** 本器写的配置行 description(唯一生产者)。归属判据只认它:同 provider 的行不带这个前缀 ⇒ 别人写的。 */
const CONFIG_DESCRIPTION = 'WorkBuddy 桌面版账号池反代(内部试用,0 价)'

/**
 * 归属冲突(exit 1,不是"未判定"):同 provider 的 ai_model_config 行由另一条登记路径建立
 * (`scripts/relay-upstream-models-sync.mjs` 按 scripts/data/relay-upstream-models.jsonl 登记,
 * description 带它自己的出处标记),或同 provider 有多行 ⇒ 本器判不出该改/删哪行。
 * 本器的处置恒为"一条也不写":盲目挑 id 最小的那行 update 就是"谁最后跑谁赢",还会把对方的
 * 出处标记洗掉,使两条路径互相判对方 BREACH 而锁死。
 */
class OwnershipBreachError extends Error {
  readonly exitCode = 1
}

interface TxLike {
  unsafe: (q: string, p?: unknown[]) => Promise<unknown[]>
}

interface ConfigRowLike {
  id: string | number
  description?: string | null
  base_url?: string | null
}

/** 该配置行是不是本器写的(判据 = 本器自有的 description 前缀,零复制对方判据)。 */
function isOurConfigRow(row: { description?: string | null }): boolean {
  return String(row.description ?? '').startsWith(CONFIG_DESCRIPTION)
}

/** 单行化描述前 N 字:点名用,不把整段散文灌进 stderr。 */
function descFace(desc: string | null | undefined, max = 60): string {
  const one = String(desc ?? '').replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max)}…` : one || '(空)'
}

function parseArgs(argv: string[]): {
  apply: boolean
  remove: boolean
  check: boolean
  json: boolean
  uid: string | null
} {
  let apply = false
  let remove = false
  let check = false
  let json = false
  let uid: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') apply = true
    else if (a === '--remove') remove = true
    else if (a === '--check') check = true
    else if (a === '--json') json = true
    else if (a === '--uid') uid = argv[++i] ?? null
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        '用法: tsx scripts/relay-workbuddy-models.ts [--check] [--apply] [--remove] [--uid <uid>] [--json]\n' +
          '  --check  只读对账(不联网、不写库):本 provider 的 ai_model_config 行归属谁\n',
      )
      process.exit(0)
    } else {
      process.stderr.write(`未知参数: ${a}\n`)
      process.exit(2)
    }
  }
  return { apply, remove, check, json, uid }
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

/**
 * 本器只认自己建的配置行(归属守卫):
 *  - 同 provider 有多行 ⇒ 判不出该改哪行(对方可能按 base_url 登记了多行)⇒ 拒写;
 *  - 首行 description 不带本器前缀 ⇒ 是另一条登记路径写的 ⇒ 拒写(改它 = 把对方出处标记洗掉)。
 * 两档都是"一条也不写",交人工二选一;静默接管的结局是两条路径互相判 BREACH 而锁死。
 */
async function readConfigRows(tx: TxLike): Promise<ConfigRowLike[]> {
  return (await tx.unsafe(
    `select id, description, base_url from ai_model_config where provider_code=$1 order by id`,
    [PROVIDER],
  )) as ConfigRowLike[]
}

function assertOwnership(rows: ConfigRowLike[], action: 'update' | 'remove'): void {
  const foreign = rows.filter((r) => !isOurConfigRow(r))
  if (foreign.length) {
    throw new OwnershipBreachError(
      `provider=${PROVIDER} 有 ${foreign.length}/${rows.length} 行不属本器(description 不以「${CONFIG_DESCRIPTION}」开头)` +
        `,拒绝 ${action}:` +
        foreign.map((r) => ` id=${r.id} base_url=${r.base_url ?? '(null)'} desc=${descFace(r.description)}`).join(' ·') +
        ';归属另一条登记路径(scripts/relay-upstream-models-sync.mjs)—— 二者取一后再跑',
    )
  }
  if (rows.length > 1 && action === 'update') {
    throw new OwnershipBreachError(
      `provider=${PROVIDER} 有 ${rows.length} 行全局配置(${rows.map((r) => `id=${r.id}`).join(',')})` +
        ',本器判不出该改哪一行(同 provider 多 base_url 由登记表那边按端点分行),拒绝 update',
    )
  }
}

async function upsertConfig(tx: TxLike): Promise<number> {
  const existing = await readConfigRows(tx)
  assertOwnership(existing, 'update')
  if (existing[0]) {
    await tx.unsafe(
      `update ai_model_config set name=$1, base_url=$2, api_format='openai_chat', enabled=true,
         description=$3, provider_group=$4, group_label=$5, updated_at=now() where id=$6`,
      [CONFIG_NAME, BASE_URL, CONFIG_DESCRIPTION, PROVIDER, 'WorkBuddy 账号池', existing[0].id],
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
      CONFIG_DESCRIPTION,
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

/**
 * 只读对账尺子(不联网、不写库):本 provider 的全局配置行归属谁。
 * 0 = 全归本器(或尚无行);1 = 有 foreign 行(两条路径抢同一 provider,交人工);
 * 2 = 未判定(库读不到)—— 绝不把"没判"写成"干净"。
 */
async function checkOwnership(): Promise<number> {
  const rows = (await dbClient.unsafe(
    `select id, description, base_url from ai_model_config where provider_code=$1 order by id`,
    [PROVIDER],
  )) as unknown as ConfigRowLike[]
  const foreign = rows.filter((r) => !isOurConfigRow(r))
  process.stdout.write(
    `WORKBUDDY-CHECK provider=${PROVIDER} configs=${rows.length} own=${rows.length - foreign.length} foreign=${foreign.length}\n`,
  )
  for (const r of foreign)
    process.stdout.write(
      `  FOREIGN id=${r.id} base_url=${r.base_url ?? '(null)'} desc=${descFace(r.description)}\n`,
    )
  if (foreign.length)
    process.stdout.write(
      '  ⇒ 归属另一条登记路径(scripts/relay-upstream-models-sync.mjs):本器 --apply 会拒写、--remove 不会删它们;二者取一后再跑\n',
    )
  return foreign.length ? 1 : 0
}

/**
 * 摘除只删本器建的行:旧版按 provider 全删,会把另一条登记路径的 workbuddy 行一起删掉
 * (就是"谁最后跑谁赢"的写侧另一半)。有 foreign 行 ⇒ 整批拒绝并点名,一条也不删。
 */
async function removeAll(): Promise<{ configs: number; models: number; aliases: number }> {
  return dbClient.begin(async (tx) => {
    assertOwnership(await readConfigRows(tx as unknown as TxLike), 'remove')
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
  if (opts.check) return checkOwnership()
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
    // 归属冲突是"判得出的拒绝"(exit 1,交人工二选一);其余仍按未判定 exit 2
    process.exit(e instanceof OwnershipBreachError ? e.exitCode : 2)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
