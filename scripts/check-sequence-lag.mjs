#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 整数主键序列落后对账(只读探测 + 可选只向前修复)。
 *
 * 立项因由(2026-09-27 实测):自媒体发布链路的 `publish_history` / `publish_notifications`
 * 序列落后表内 max(id) 9 / 14 名 ⇒ 调度器每次 INSERT 撞 `*_pkey` UniqueViolation,而写入方
 * 用 `except` 降成一条 warning ⇒ **发布审计静默丢失**(任务判 failed 而库里查不到任何历史行)。
 * 顺着这条扫全库,本机一次量到 8 张表同样落后(含 `publish_tasks`、`ai_model_config_models` 2228 vs 325)。
 * 成因侧证据:代码里**没有**显式写 PK id 的插入(逐表 grep 过),而 `zhs_knowledge_doc` 的序列
 * 还是全新状态(last=1、is_called=False)表内已有 7 行 ⇒ 指向应用外的导入/恢复,具体哪一次未证实在案。
 *
 * 判据:`next = last_value + (is_called ? 1 : 0)`,当 `next <= max(id)` 判落后。
 * 修复铁律:**只在落后时 setval 到 max(id),绝不回拨**(回拨等于自己制造新的撞键);
 * 空表(max=0)不算落后也不 setval。
 *
 * 定级 warn 而非 blocking:序列状态属**机器/库状态**,提交者结构上满足不了 ——
 * 挂 blocking 就是每台每次被逼 `--no-verify`、连带废掉全部守门(AGENTS §12e 同型)。
 * 问责一律走 `--strict`。
 *
 * 用法:
 *   node scripts/check-sequence-lag.mjs              # 只读探测(warn 语义,恒 exit 0 除非判死)
 *   node scripts/check-sequence-lag.mjs --strict     # 有落后即 exit 1(CI/巡检问责档)
 *   node scripts/check-sequence-lag.mjs --fix        # 只向前推,并逐张回读证明已领先
 *   node scripts/check-sequence-lag.mjs --json       # 机读
 *   node scripts/check-sequence-lag.mjs --self-test  # 纯函数判据自检(不连库)
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 刻意命名 repoRoot(小写):本文件仅有的两处磁盘读是 ①gitignored 的 apps/api/.env 取 DSN ②该 DSN 指向的库实时状态。
// 它审的本来就是**运行态**而非被版本控制的内容,无面可取(守门 118 的已登记空档:分不清读被审内容与读运行态,
// 而小写模块根写法落进 unknown 不判红 —— 这里照该口径命名并在头注写明理由,不是绕过判据)。
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 判据本体(纯函数,自检与镜像测试都打这里)。
 * @param {{table:string, column:string, sequence:string|null, maxId:bigint|number, lastValue:bigint|number, isCalled:boolean}} row
 */
export function decide(row) {
  const max = BigInt(row.maxId ?? 0)
  const last = BigInt(row.lastValue ?? 0)
  const next = last + (row.isCalled ? 1n : 0n)
  if (!row.sequence) {
    return { kind: 'undetermined', reason: '问不到序列(非 serial/identity 主键或权限不足)' }
  }
  if (max === 0n) {
    return { kind: 'empty', reason: '表内 0 行,不参与落后判定' }
  }
  if (next > max) {
    return { kind: 'ok', nextBefore: String(next), max: String(max) }
  }
  return {
    kind: 'lagging',
    nextBefore: String(next),
    max: String(max),
    behind: String(max - next + (row.isCalled ? 0n : 1n)),
    // 只向前:setval 到 max(id) 且 is_called=true ⇒ 下一个值 = max+1
    target: String(max),
  }
}

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
    fix: argv.includes('--fix'),
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
  }
}

function selfTest() {
  /** @type {Array<[string, (r:any)=>string, any, string]>} */
  const cases = [
    ['落后(实例形态)', decide, { sequence: 's', maxId: 23, lastValue: 5, isCalled: true }, 'lagging'],
    ['正常', decide, { sequence: 's', maxId: 23, lastValue: 23, isCalled: true }, 'ok'],
    ['is_called=false 且 max=1 仍算落后', decide, { sequence: 's', maxId: 1, lastValue: 1, isCalled: false }, 'lagging'],
    ['is_called=false 修到位后算正常', decide, { sequence: 's', maxId: 0, lastValue: 1, isCalled: false }, 'empty'],
    ['空表不判', decide, { sequence: 's', maxId: 0, lastValue: 7, isCalled: true }, 'empty'],
    ['取不到序列=未判定', decide, { sequence: null, maxId: 5, lastValue: 1, isCalled: false }, 'undetermined'],
  ]
  let fail = 0
  for (const [name, fn, input, want] of cases) {
    const got = fn(input).kind
    const ok = got === want
    if (!ok) fail++
    console.info(`${ok ? '✅' : '❌'} ${name}:期望 ${want} 实得 ${got}`)
  }
  // 反向锁:已领先时不得给出 setval 目标(等于禁止回拨)
  const ahead = decide({ sequence: 's', maxId: 5, lastValue: 99, isCalled: true })
  if (ahead.kind !== 'ok' || 'target' in ahead) {
    fail++
    console.info('❌ 反向锁:领先的一档不得产出 setval 目标(禁止回拨)')
  } else {
    console.info('✅ 反向锁:领先的一档不产出修复目标')
  }
  console.info(`\n自检 ${cases.length + 1} 条,失败 ${fail} 条`)
  return fail === 0 ? 0 : 1
}

function readDsn() {
  const fromEnv = (process.env.DATABASE_URL || '').trim()
  if (fromEnv) return fromEnv
  const envPath = join(repoRoot, 'apps/api/.env')
  if (!existsSync(envPath)) return ''
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
  if (!line) return ''
  return line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.selfTest) return selfTest()

  const dsn = readDsn()
  if (!dsn) {
    console.info('❌ 无法判定:取不到 DATABASE_URL(env 或 apps/api/.env)—— 不记为通过')
    return 2
  }
  const require_ = createRequire(join(repoRoot, 'apps/api/index.js'))
  let postgres
  try {
    postgres = require_('postgres')
  } catch {
    console.info('❌ 无法判定:取不到 postgres 驱动(apps/api 依赖未装?)—— 不记为通过')
    return 2
  }
  const sql = postgres(dsn, { max: 1, prepare: false })
  // 静态 SQL 直写模板:本查询不含任何外部输入,故不参数化。
  // (刻意不用 sql.raw —— postgres.js 的 raw 挂在命名导出上,require 出来的实例上没有,
  //  写成 sql.raw 会当场 TypeError;这型"以为有 API"的错本仓记过不止一次。)
  // 序列过滤必须在 SQL 里做,不能留到 JS:一个表常有多个 int 列(如 owner_id),
  // 先按表去重再去查序列,会把"第一个 int 列没有序列"的表整张跳过 —— 落地首跑就是这样
  // 只扫到 108 张而权威计数是 228 张,报"无落后"等于判据失明(所以配套加了下面的覆盖面自证)。
  const rows = await sql`
    select c.relname as tbl, a.attname as col,
           pg_get_serial_sequence(quote_ident(n.nspname)||'.'||quote_ident(c.relname), a.attname) as seq
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
    join pg_type t on t.oid = a.atttypid
    where c.relkind = 'r' and n.nspname = 'public' and a.attisdropped = false
      and t.typname in ('int2','int4','int8','bigint','integer','smallint')
      and pg_get_serial_sequence(quote_ident(n.nspname)||'.'||quote_ident(c.relname), a.attname) is not null
    order by c.relname`
  // 权威候选集:同一张表可能有多个序列列(极少),按 (tbl,col) 计,再单独按表计用于对账
  const expectedTables = new Set(rows.map((r) => r.tbl))
  const seen = new Set()
  const lags = []
  const counts = { ok: 0, empty: 0, undetermined: 0, scanned: 0, unmeasured: 0 }
  for (const r of rows) {
    if (seen.has(r.tbl)) continue
    seen.add(r.tbl)
    if (!r.seq) {
      // 整数主键但没有序列:可能压根不是自增主键,不计入
      continue
    }
    let maxId = 0n
    let lastValue = 0n
    let isCalled = false
    try {
      const mx = await sql`select coalesce(max(${sql(r.col)}), 0)::bigint as m from ${sql(r.tbl)}`
      maxId = BigInt(mx[0].m)
      const lv = await sql`select last_value, is_called from ${sql(r.seq)}`
      lastValue = BigInt(lv[0].last_value)
      isCalled = Boolean(lv[0].is_called)
    } catch (e) {
      counts.undetermined++
      counts.unmeasured++
      if (!args.json) console.info(`⚠️ 未判定 ${r.tbl}:${String(e).slice(0, 90)}`)
      continue
    }
    counts.scanned++
    const d = decide({ table: r.tbl, column: r.col, sequence: r.seq, maxId, lastValue, isCalled })
    if (d.kind === 'empty') {
      counts.empty++
      continue
    }
    if (d.kind === 'undetermined') {
      counts.undetermined++
      continue
    }
    if (d.kind === 'ok') {
      counts.ok++
      continue
    }
    lags.push({ table: r.tbl, column: r.col, sequence: r.seq, ...d })
  }

  if (args.fix) {
    for (const l of lags) {
      await sql`select setval(${l.sequence}, ${BigInt(l.target)})`
      const after = await sql`select last_value, is_called from ${sql(l.sequence)}`
      const next = BigInt(after[0].last_value) + (after[0].is_called ? 1n : 0n)
      const ok = next > BigInt(l.max)
      console.info(`${ok ? '✅' : '❌'} ${l.table}:setval(${l.target}) ⇒ 下一个=${next} (max=${l.max})`)
      if (!ok) {
        await sql.end()
        console.info('❌ 修复后仍未领先,停止')
        return 1
      }
    }
    console.info(`已修 ${lags.length} 张`)
    await sql.end()
    return 0
  }

  // 覆盖面自证:枚举到的候选表必须逐张量过 —— 少了就说明枚举/去重把表整张跳过了,
  // 那"0 落后"就不是结论而是判据失明(落地首跑正是靠这条抓到 108/228 的漏面)。
  const missed = expectedTables.size - counts.scanned - counts.unmeasured
  const coverageBad = missed !== 0
  if (args.json) {
    console.info(
      JSON.stringify(
        { counts, expectedTables: expectedTables.size, coverageOk: !coverageBad, lagging: lags },
        null,
        2,
      ),
    )
  } else {
    console.info(
      `扫了 ${counts.scanned} 张有序列表(权威候选 ${expectedTables.size} 张):` +
        `正常 ${counts.ok} / 空表跳过 ${counts.empty} / 未判定 ${counts.undetermined}`,
    )
    if (coverageBad) {
      console.info(`❌ 覆盖面不闭合:少量 ${missed} 张 ⇒ 本报告不得当作"无落后"的结论`)
    }
    for (const l of lags) {
      console.info(`  落后 ${l.table}.${l.column}:下一个=${l.nextBefore} max=${l.max}(差 ${l.behind})序列=${l.sequence}`)
    }
    if (lags.length) {
      console.info(`\n修复(只向前,绝不回拨):node scripts/check-sequence-lag.mjs --fix`)
      console.info('这一型为什么危险:INSERT 撞 *_pkey 后,写入方多用 except 降成 warning,')
      console.info('表现成"任务判 failed 而库里查不到任何记录"—— 审计静默丢失,且与改动无关的门都不会红。')
    } else if (!coverageBad) {
      console.info('✅ 无落后序列')
    }
  }
  await sql.end()
  if (coverageBad && args.strict) return 2
  if (lags.length && args.strict) return 1
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ 脚本自身异常:${e?.message ?? e}`)
      process.exit(2)
    })
}

export const __test__ = { decide, parseArgs, selfTest }
