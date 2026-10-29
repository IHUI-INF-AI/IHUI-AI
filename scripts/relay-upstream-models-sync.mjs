// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池上游 provider → ai_model_config(+ ai_model_config_models) 的**幂等登记器**(器物)。
 *
 * 立因:号池里有 healthy 号却零调用,根因不在转发层代码而在登记数据 —— 转发层选号前要做
 * 模型→平台反查(判据 `ai_model_config.enabled=true ∧ ai_model_config_models.model_id=请求模型`,
 * 见 apps/api/src/services/relay-account-forwarder.ts#resolvePoolProviders),查不到就 return null,
 * 账号池从未被问起。手工往库里插行不可重复、不可审计,故把"该登记什么"落成
 * scripts/data/relay-upstream-models.jsonl,由本器把它投影进库(幂等 upsert)。
 *
 * 用法:
 *   node scripts/relay-upstream-models-sync.mjs --check     # 只读对账,退出码即结论(可挂巡检)
 *   node scripts/relay-upstream-models-sync.mjs --dry-run   # 对账 + 逐行打印将要写什么(不落库)
 *   node scripts/relay-upstream-models-sync.mjs --apply     # 单事务落库:写前逐行打印,写后复算自证幂等
 *   可选 --registry <path> / --env-file <path> / --dsn <url>
 * --check 与 --dry-run 的分工:前者是**判定**(缺登记或漂移 ⇒ exit 1,机器据此报警);后者是 apply
 * 的前置预览(只有"判不出"才 exit 2,缺登记照旧 0 —— 它不是门,不给任何人扣红)。
 *
 * 三态:missing(缺登记)/ matched(已一致)/ drift(与登记表不符)。取不到输入 ⇒ **未判定 exit 2**,
 * 既不记绿也不冒红(AGENTS §0.3):登记表形状非法、provider 白名单单源解析失败、reviewBy 已到期、
 * DSN 取不到、非本机回环库、连不上库、同 (provider_code, base_url) 多行、alias 仅大小写撞索引。
 *
 * 归属判据(同键归属):键 = (provider_code, COALESCE(base_url,''))。同 provider 不同 base_url 是
 * 两行(库里 `uq_ai_model_config_global_provider_base` 正是这个键),按新增处理;同键行已存在但
 * description 不带本器出处标记(`号池上游登记 · 由 scripts/relay-upstream-models-sync.mjs`)⇒
 * **两条路径抢同一行**:既不复用也不改,打 BREACH 并点名,一条也不落库(exit 1)。
 * 试过"同键行存在 ⇒ 复用并 update"的那版被镜像断言③(只碰登记 provider:他人行不出动作)打红 ——
 * 那条断言防的正是登记器悄悄接管别人路径写的行,遇红改设计不改断言。
 *
 * 归属边界:本器只写 ai_model_config + ai_model_config_models 两张表。`ai_relay_model_catalog`
 * (对外别名 → 上游真名)是管理面/其它生产者的面,刻意不碰:qoder/trae 适配器在出网前自行剥掉
 * `provider/` 前缀(见 upstream-adapters/qoder-adapter.ts#upstreamModelName),缺 catalog 映射不影响
 * 账号池可达性 —— 这一点由 --check 的读数证明,不靠说法。
 *
 * 跨路径归属对账(2026-10-30 立,票「上游模型登记器与 workbuddy 动态同步器并存无对账」):
 * ai_model_config(+_models)有第二个生产入口 —— `apps/api/scripts/relay-workbuddy-models.ts` 把上游
 * 模型目录同步成 provider_code=workbuddy 的全局行。上面那条"同键 BREACH"只在**本器已声明该 provider**
 * 时才看得见对方(快照按登记表 provider 取),而 provider 白名单 RELAY_PROVIDERS 里本来就有 workbuddy:
 * 谁往登记表补一行,两条路径立刻抢同一 provider,后跑者把 description 里的出处标记洗掉 ⇒ 本器下一轮
 * 判 BREACH、对方继续改写,两边锁死。故本器 --check 增一维**跨路径对账**:从被点名脚本源码抽出
 * 它的 providerCode(不抄字面量,同 relayProviderCodes 对 RELAY_PROVIDERS 的做法),与登记表 / 库面
 * 三向比对 ⇒ double(两边都声明:结构上可双写)/ foreign(只归对方,本器不碰)/ absent(对方尚未落库)。
 * double 时 --check 与 --dry-run 报 COEXIST、--apply 拒绝落库(一条也不写),exit 1 交人工二选一。
 *
 * DSN 一律从 apps/api/.env 的 DATABASE_URL / DATABASE_APP_URL 读(顺序即优先级),输出面只含
 * host:port/db(凭据段整段丢弃,§5d)。只碰开发库:守卫 import scripts/lib/db-probe-client.mjs 的
 * guardDbDsn(非本机回环 / 生产 SSH 隧道口 8810 ⇒ 拒绝),本文件不写第二份判据。
 *
 * 判据分层:形状判定与三态计划在 scripts/lib/relay-upstream-models-plan.mjs,库面读写在
 * scripts/lib/relay-upstream-models-db.mjs;镜像测试 import 前者的 __test__,不复制判据(§22c)。
 *
 * 退出码:0 = 无缺口 / 落地并自证幂等成功;1 = 有缺登记或漂移(check)、有 BREACH(两条路径抢同一行)、
 * 有 COEXIST(两条路径抢同一 provider)、落地后复算仍要写(apply);2 = 未判定。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { guardDbDsn } from './lib/db-probe-client.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { openDevClient, readSnapshot, applyActions } from './lib/relay-upstream-models-db.mjs'
import {
  dsnFace,
  parseRegistry,
  planRegistration,
  relayProviderCodes,
  resolveDsn,
  describeAction,
  touchesOnlyRegistered,
} from './lib/relay-upstream-models-plan.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_DEFAULT = join(ROOT, 'scripts/data/relay-upstream-models.jsonl')
const ENV_FILE_DEFAULT = join(ROOT, 'apps/api/.env')
/** provider 白名单唯一真相源(号池支持的平台);读不到 ⇒ 未判定,绝不回落硬编码清单 */
const PROVIDER_SOURCE = join(ROOT, 'apps/api/src/services/relay-account-format.ts')

/**
 * 写同一批表的**其它路径**。providerCode 不抄字面量:运行时从被点名脚本源码抽
 * `const PROVIDER = '<code>'`(抽不到 ⇒ 未判定,§0.3),与 relayProviderCodes 对 RELAY_PROVIDERS 同源取法。
 * 新增第二个生产入口 ⇒ 在这里加一行,不改判据。
 */
const SECOND_WRITER_SOURCES = [
  {
    writer: 'apps/api/scripts/relay-workbuddy-models.ts',
    file: join(ROOT, 'apps/api/scripts/relay-workbuddy-models.ts'),
    tables: 'ai_model_config + ai_model_config_models + ai_relay_model_catalog',
  },
]

const miss = (why) => console.error(`❌ 未判定:${why}`)

/**
 * 从被点名脚本源码抽 providerCode(纯判据)。抄字面量必然漂移(改一处忘另一处),故按源文本解析。
 * 抽不到 ⇒ problems 点名交调用方落未判定,不猜成"没有第二条路径"。
 */
export function parseSecondWriters(sources) {
  const writers = []
  const problems = []
  for (const s of sources ?? []) {
    const m = /const\s+PROVIDER\s*=\s*'([^']+)'/.exec(String(s?.text ?? ''))
    if (!m) {
      problems.push(
        `${s?.writer ?? '(未点名)'}: 抽不到 \`const PROVIDER = '<provider>'\`(源文形状变了 ⇒ 无法判定它写哪家)`,
      )
      continue
    }
    writers.push({ writer: s.writer, providerCode: m[1], tables: s.tables })
  }
  return { writers, problems }
}

/**
 * 跨路径归属对账(纯判据,零 IO)。输入:登记表 provider / 库面全局行汇总 / 第二条路径声明。
 *  - double  登记表声明 p ∧ 另一路径也声明 p ⇒ 两条路径抢同一 provider(结构上可双写,exit 1 交人工)
 *  - foreign 只有另一路径声明 p ⇒ 归属他人,本器不碰(信息行,不判红)
 *  - absent  另一路径声明 p ∧ 库里 0 行 ⇒ 该路径尚未落库(信息行)
 * 只判"已点名的 provider",不做全库巡检:库里其它 provider 不属本票射程,列出来只会淹掉要点名的两条。
 */
export function crossPathOwnership({ registryCodes, dbProviders, writers }) {
  const reg = new Set((registryCodes ?? []).map(String))
  const rows = new Map(
    (dbProviders ?? []).map((r) => [String(r?.providerCode ?? ''), Number(r?.rows ?? 0)]),
  )
  const byProvider = new Map()
  for (const w of writers ?? []) {
    if (!byProvider.has(w.providerCode)) byProvider.set(w.providerCode, [])
    byProvider.get(w.providerCode).push(w)
  }
  const findings = []
  for (const [providerCode, ws] of byProvider) {
    const dbRows = rows.get(providerCode) ?? 0
    const owners = ws.map((w) => `${w.writer}(${w.tables})`)
    if (reg.has(providerCode)) {
      findings.push({
        providerCode,
        kind: 'double',
        dbRows,
        owners: ['scripts/relay-upstream-models-sync.mjs(登记表)', ...owners],
      })
      continue
    }
    findings.push({ providerCode, kind: dbRows > 0 ? 'foreign' : 'absent', dbRows, owners })
  }
  findings.sort((a, b) => a.providerCode.localeCompare(b.providerCode))
  return { findings, double: findings.filter((f) => f.kind === 'double') }
}

/** 归属读数逐条打印(一行一个 provider,kind + 行数 + 归属方)。 */
function printOwnership(ownership) {
  for (const f of ownership.findings)
    console.log(
      `OWNERSHIP provider=${f.providerCode} kind=${f.kind} rows=${f.dbRows} owner=${f.owners.join(' + ')}`,
    )
}

/**
 * 库面全局行按 provider 汇总(只读;owner_uuid IS NULL 与 readSnapshot 同口径)。
 * 别名必须带双引号:postgres-js 会把未加引号的返回列名整体小写。
 */
export async function readProviderRows(sql) {
  return await sql`select provider_code as "providerCode", count(*)::int as "rows"
     from ai_model_config where owner_uuid is null group by 1 order by 1`
}

/** COEXIST = 两条路径声明同一 provider:一条也不落库,点名归属与出路(exit 1,不吃未判定)。 */
function reportCoexist(double) {
  console.error(
    `❌ COEXIST ${double.length} 条(同一 provider 被两条路径登记 ⇒ 谁最后跑谁赢 / 一条也不落库)`,
  )
  for (const f of double)
    console.error(
      `  provider=${f.providerCode} 库内全局行=${f.dbRows} 归属=${f.owners.join(' + ')};出路:二者取一(登记表删该 provider 或停用该写路径)—— 本器不代裁`,
    )
}

function printPlan(plan) {
  for (const r of plan.rows)
    console.log(
      `  provider=${r.providerCode} alias=${r.alias ?? '(配置行)'} state=${r.state} ${r.why}`,
    )
}

function summarize(plan) {
  console.log(
    `SUMMARY missing=${plan.count.missing} drift=${plan.count.drift} matched=${plan.count.matched} breaches=${plan.breaches.length} writes=${plan.actions.length}`,
  )
}

/** 登记表非法 / 库面形状冲突 ⇒ 把每条原因点名交出去(不合并成一句"参数错误")。 */
function reportProblems(kind, problems) {
  miss(`${kind} ${problems.length} 条(一条也不落库)`)
  for (const p of problems) console.error(`  ${p}`)
}

/** BREACH = 判得出的"不许动"(同键行是别的路径写的):不落库、不吃未判定,exit 1 交人工。 */
function reportBreaches(breaches) {
  console.error(`❌ BREACH ${breaches.length} 条(两条路径抢同一行 / 一条也不落库)`)
  for (const b of breaches) console.error(`  ${b}`)
}

export async function runMain(argv, env = process.env, deps = {}) {
  const {
    openDevClient: openDb = openDevClient,
    readSnapshot: read = readSnapshot,
    readProviders: readProviders = readProviderRows,
    applyActions: apply = applyActions,
  } = deps
  const mode = argv.includes('--apply')
    ? 'apply'
    : argv.includes('--dry-run')
      ? 'dry-run'
      : argv.includes('--check')
        ? 'check'
        : null
  if (!mode) {
    console.error(
      '用法: node scripts/relay-upstream-models-sync.mjs --check | --dry-run | --apply [--registry <path>] [--env-file <path>] [--dsn <url>]',
    )
    return 2
  }
  const reg = requireFlagValue(argv, '--registry', {
    noun: ' 登记表路径',
    fallback: REGISTRY_DEFAULT,
  })
  const envf = requireFlagValue(argv, '--env-file', {
    noun: ' .env 路径',
    fallback: ENV_FILE_DEFAULT,
  })
  if (reg.error || envf.error) {
    miss(reg.error ?? envf.error)
    return 2
  }
  let registryText, providerText, envText
  try {
    registryText = readFileSync(reg.value, 'utf8')
    providerText = readFileSync(PROVIDER_SOURCE, 'utf8')
    envText = readFileSync(envf.value, 'utf8')
  } catch (e) {
    miss(`登记表 / provider 白名单单源 / .env 取不到 —— ${e.message}`)
    return 2
  }
  const parsed = parseRegistry(registryText, relayProviderCodes(providerText))
  if (parsed.problems.length) {
    reportProblems('登记表非法', parsed.problems)
    return 2
  }
  // 第二条写路径的 providerCode 从它自己的源码抽:取不到 ⇒ 未判定(不把"判不出"写成"没有第二条路径")
  const writerTexts = []
  for (const s of SECOND_WRITER_SOURCES) {
    try {
      writerTexts.push({ ...s, text: readFileSync(s.file, 'utf8') })
    } catch (e) {
      miss(`第二条写路径源码取不到(${s.writer})—— ${e.message}`)
      return 2
    }
  }
  const second = parseSecondWriters(writerTexts)
  if (second.problems.length) {
    reportProblems('第二条写路径形状变了', second.problems)
    return 2
  }
  const dsn = resolveDsn(argv, envText, env)
  if (dsn.error) {
    miss(dsn.error)
    return 2
  }
  const guarded = guardDbDsn(dsn.dsn)
  if (!guarded.ok) {
    miss(`拒绝连库:${guarded.why} · DSN面=${dsnFace(dsn.dsn) ?? '(不可解析)'}`)
    return 2
  }
  const opened = await openDb(dsn.dsn)
  if (!opened.ok) {
    miss(opened.why)
    return 2
  }
  const codes = [...new Set(parsed.entries.map((e) => e.providerCode))]
  const face = dsnFace(dsn.dsn)
  console.log(
    `[relay-upstream-models] mode=${mode} registry=${reg.value.replace(ROOT + '/', '')} entries=${parsed.entries.length} DSN面=${face}`,
  )
  const sql = opened.postgres(dsn.dsn, { max: 2, prepare: false, connect_timeout: 8 })
  try {
    // 跨路径对账先跑:它判的是"两条路径能不能写同一 provider",在缺登记/漂移之前就该点名
    const ownership = crossPathOwnership({
      registryCodes: codes,
      dbProviders: await readProviders(sql),
      writers: second.writers,
    })
    printOwnership(ownership)
    if (ownership.double.length) {
      reportCoexist(ownership.double)
      // --check 是判定、--apply 必须拒落(允许双写就是把"谁最后跑谁赢"写进制度);
      // --dry-run 只是预览,照它既有分工只点名不改退出码(顺手把将要写什么也打完)。
      if (mode === 'check' || mode === 'apply') return 1
    }
    const plan0 = planRegistration(parsed.entries, await read(sql, codes))
    if (plan0.problems.length) {
      reportProblems('库面形状冲突', plan0.problems)
      return 2
    }
    if (plan0.breaches.length) {
      reportBreaches(plan0.breaches)
      summarize(plan0)
      return 1
    }
    if (!touchesOnlyRegistered(plan0.actions, codes)) {
      miss('计划里出现非登记 provider 的写动作(自证不过,拒绝执行)')
      return 2
    }
    printPlan(plan0)
    summarize(plan0)
    if (mode === 'dry-run') {
      console.log('DRY-RUN 将要写入的每一行(不落库):')
      for (const a of plan0.actions) console.log(`  ${describeAction(a)}`)
      return 0
    }
    if (mode === 'check') return plan0.count.missing + plan0.count.drift === 0 ? 0 : 1
    if (!plan0.actions.length) {
      console.log('APPLY 无需写入(已一致 ⇒ 幂等重复执行零落地)')
      return 0
    }
    console.log('将要写入的每一行:')
    for (const a of plan0.actions) console.log(`  ${describeAction(a)}`)
    for (const w of await apply(sql, plan0.actions)) console.log(`  已写 ${w}`)
    const plan1 = planRegistration(parsed.entries, await read(sql, codes))
    console.log(
      `IDEMPOTENT-CHECK recheck_missing=${plan1.count.missing} recheck_drift=${plan1.count.drift} recheck_actions=${plan1.actions.length}`,
    )
    if (plan1.actions.length) {
      miss('落地后复算仍有写动作')
      return 1
    }
    printPlan(plan1)
    return 0
  } catch (e) {
    miss(`库查询/写入失败 —— ${String(e?.message ?? e).slice(0, 300)} · DSN面=${face}`)
    return 2
  } finally {
    try {
      await sql?.end({ timeout: 3 })
    } catch {
      /* 收尾失败不改变已出的结论 */
    }
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  runMain(process.argv.slice(2))
    .then((rc) => process.exit(rc))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}`)
      process.exit(2)
    })
}

export const __test__ = {
  runMain,
  parseSecondWriters,
  crossPathOwnership,
  readProviderRows,
  SECOND_WRITER_SOURCES,
  REGISTRY_DEFAULT,
  PROVIDER_SOURCE,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
