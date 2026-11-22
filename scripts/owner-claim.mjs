#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接器 / MCP 商店「无主记录」只读巡检器 + 认领命令生成器(2026-09-29 机主拍板:把两件
 * "只有换台机器才能做"的运维活,变成一条命令 + 一页可照着做的步骤)。
 *
 * 它**只读**:不写任何文件、不改任何数据、不派生任何子进程、不连任何端口。写盘动作只由人
 * 在**部署机**上复制它打印的那一行去执行(那条命令自带 dry-run 档与自动备份)。
 *
 * 为什么需要它(现读事实,动手前不必再发现一遍):
 *   - `connector_store` 的读侧自 G-371 起按 `(owner_user_id, key)` 收窄,**无主记录对所有人
 *     不可见**(fail-closed)。收紧之前装进来的记录因此「原主永远看不见自己的连接器」,而账面
 *     什么都没红。出口是人工认领回填器 `apps/ai-service/scripts/backfill_connector_owner.py`,
 *     但在它之前提「有几条、是哪几条、该给谁」只能靠登机器手翻 JSON。
 *   - `mcp_store` 的无主记录是**反方向**的风险:安装记录今天全站可见,而 `can_mutate` 对
 *     `owner == ""` 维持改动前行为(任何已登录主体可 enable/disable/uninstall)。所以「无主」
 *     在两张表上是两件事(一件是"找不回",一件是"敞口"),本工具分开报,**绝不合并成一个数**。
 *
 * 三条不可漂的口径(缺一条就会得出错误结论):
 *   1. **三态分开**:① 没有这个文件 ② 文件读不到或形态不认识 ③ 读到 N 条。第二态绝不写成
 *      「0 条无主」—— 把"看不见"写成"确信没有"是本仓最高频的失效型。对照实测:回填器自己把
 *      「文件不存在」降成「记录 0 条 + exit 0」(2026-09-29 现跑),所以那一层**判不出**这三态,
 *      必须在这一层判。
 *   2. **本机读数 ≠ 全局结论**:两台 checkout 各有一份 `data/*.json`,本机这份推不出部署机那份。
 *      每次运行都无条件喊这一句,并打印主机名 + 绝对路径 + 文件 mtime,让操作人自己核对
 *      「我站对机器了吗」,而不是由工具替他断言。
 *   3. **凭据面一个字节都不出**:记录里的 `app_secret` / `env` / `extra` 不参与渲染,逐条只报
 *      `name` 与 `key`。该不变量由 `--self-test` 往夹具里塞哨兵值反证(报告全文不得含哨兵串)。
 *
 * 一条实测出来的坑(它直接决定认领行的生成条件):回填器 `plan_backfill` 按 key 建索引、只看
 * **最后一条**同 key 记录判「要不要落」,而写盘时 `apply_plan` 会 stamp **所有** key 相同的记录
 * —— 于是「同一 key 一条已属主 + 一条无主」时,`--claim <key>=x --apply` 会连带把已属主那条改掉,
 * 而 dry-run 打的是「改写已有属主 0 条」(2026-09-29 在临时副本上实测:owner=7 的那条被改成 42)。
 * 所以本工具对**重复 key** 的无主记录**拒绝生成认领行**,只点名让人先人工拆开。
 *
 * 用法:node scripts/owner-claim.mjs [--json] [--self-test]
 * 退出码:0 = 已判定(含「有 N 条待认领」—— 它是巡检不是验收,有待办不算失败);
 *         2 = 至少一本账未判定(文件读不到 / JSON 不可解析 / 顶层不是列表 / 属主键名解析不到)。
 *
 * 它**不是**守门,也没有接任何提交链或 CI:文件名不以 `check|scan|guard` 开头 ⇒ 守门 89 的候选集
 * 结构上看不见它;它的不变量由自己的 `--self-test`(临时目录造三态现场)与 §22c 镜像测试
 * `scripts/tests/owner-claim.test.mjs` 钉住。运维步骤见 `docs/CONNECTOR_OWNER_CLAIM_RUNBOOK.md`。
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const argv = process.argv.slice(2)
const AS_JSON = argv.includes('--json')
const SELF_TEST = argv.includes('--self-test')

/** 仓库根由**本文件自身位置**推导。硬编码盘符在另一台机上会解析到不存在的路径(AGENTS §15/§26)。 */
const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..')
const SERVICE_DIR = join(REPO_ROOT, 'apps', 'ai-service')
/** 属主键名的**唯一定义处** —— 跨语言,JS 侧 import 不到,所以现读源码而不是抄第二份字面量。 */
const OWNER_KEY_SOURCE = join(SERVICE_DIR, 'app', 'services', 'connector_store.py')
/** 认领行的公共前缀(相对仓库根写的,`cd apps/ai-service` 之后整行可直接粘)。 */
const CLAIM_BASE =
  'cd apps/ai-service && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe ' +
  'scripts/backfill_connector_owner.py'

const LEDGERS = [
  {
    id: 'connector',
    title: '账 ① 连接器配置(connector_store)',
    file: join(SERVICE_DIR, 'data', 'connector_store.json'),
    /** 回填器缺省就读这一份 ⇒ 认领行不带 --store。 */
    storeFlag: null,
    ownerlessMeans:
      'fail-closed:这条记录对**所有人**(含原主)都读不到 ⇒ 不认领就是「原主看不见自己的连接器」',
  },
  {
    id: 'mcp',
    title: '账 ② MCP 商店安装记录(mcp_store)',
    file: join(SERVICE_DIR, 'data', 'mcp_store.json'),
    storeFlag: '--store data/mcp_store.json',
    ownerlessMeans:
      '回退档(不是「读不到」):记录全站可见,而 can_mutate 对 owner=="" 放行任何已登录主体 ' +
      'enable/disable/uninstall ⇒ 不认领就是敞口;收紧本身属人拍,不由本工具代裁',
  },
]

/** 属主键名:从 connector_store.py 现读 `OWNER_FIELD = "..."`,不在 JS 侧抄第二份。 */
export function parseOwnerField(pyText) {
  const m = /\bOWNER_FIELD\s*=\s*["']([^"'\n]+)["']/.exec(String(pyText ?? ''))
  return m ? m[1] : null
}

function describeShape(value) {
  if (Array.isArray(value)) return '列表'
  if (value === null) return 'null'
  if (typeof value === 'object')
    return `对象(键:${Object.keys(value).slice(0, 5).join(',') || '空'})`
  return typeof value
}

/** 三态判定的唯一入口:missing / undetermined / ok —— 后两态永远不并桶。 */
export function classifyBlob(rawText) {
  const text = String(rawText)
  if (text.charCodeAt(0) === 0xfeff) {
    return {
      state: 'undetermined',
      reason: '文件带 BOM,JSON 解析层不认(这不等于没有记录)。先按 UTF-8 无 BOM 另存再重跑',
    }
  }
  let data
  try {
    data = JSON.parse(text)
  } catch (err) {
    return { state: 'undetermined', reason: `JSON 不可解析:${err.message}` }
  }
  if (!Array.isArray(data)) {
    return { state: 'undetermined', reason: `顶层不是列表,收到的是${describeShape(data)}` }
  }
  return { state: 'ok', records: data }
}

/** 只读地取一份 store。任何 IO 异常 ⇒ undetermined(带原因),**绝不**降成「0 条」。 */
export function inspectStoreFile(absPath) {
  const base = { path: absPath }
  if (!existsSync(absPath)) return { ...base, state: 'missing' }
  let st = null
  try {
    st = statSync(absPath)
  } catch (err) {
    return { ...base, state: 'undetermined', reason: `量不到文件属性:${err.code || err.message}` }
  }
  if (!st.isFile()) return { ...base, state: 'undetermined', reason: '该路径不是普通文件' }
  let text
  try {
    text = readFileSync(absPath, 'utf8')
  } catch (err) {
    return { ...base, state: 'undetermined', reason: `读不到内容:${err.code || err.message}` }
  }
  const verdict = classifyBlob(text)
  const meta = { bytes: st.size, mtime: st.mtime.toISOString() }
  if (verdict.state !== 'ok') return { ...base, ...meta, ...verdict }
  return { ...base, ...meta, state: 'ok', records: verdict.records }
}

/** 纯函数:按属主键名把一份记录列表分成四堆,并顺手量出重复 key。 */
export function classifyRecords(records, ownerField) {
  const out = {
    total: records.length,
    owned: [],
    ownerlessClaimable: [],
    ownerlessUnclaimable: [],
    nonObjectDropped: 0,
    duplicateKeys: [],
  }
  const keyCount = new Map()
  records.forEach((rec, i) => {
    if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) {
      // 回填器 load_store 里那句 isinstance(rec, dict) 会把这类条目**静默丢掉**,所以这里必须报名。
      out.nonObjectDropped += 1
      out.ownerlessUnclaimable.push({ label: `第 ${i + 1} 条(不是对象 ⇒ 回填器会静默丢弃)` })
      return
    }
    const key = typeof rec.key === 'string' ? rec.key.trim() : ''
    const name = typeof rec.name === 'string' ? rec.name.trim() : ''
    const raw = rec[ownerField]
    const owner = raw === undefined || raw === null ? '' : String(raw).trim()
    if (key) keyCount.set(key, (keyCount.get(key) || 0) + 1)
    const row = { key, name, label: name || key || `第 ${i + 1} 条(无 name 无 key)` }
    if (owner) {
      out.owned.push({ ...row, owner })
      return
    }
    if (key) out.ownerlessClaimable.push(row)
    else out.ownerlessUnclaimable.push(row)
  })
  out.duplicateKeys = [...keyCount.entries()]
    .filter(([, n]) => n > 1)
    .map(([key, count]) => ({ key, count }))
  return out
}

/** 能被安全粘进 shell 的 key:含引号/反引号/`$()` 一律不出行,改走 --claims JSON 台账。 */
export function isShellSafeKey(key) {
  return /^[A-Za-z0-9_.:@/+~-]+$/.test(String(key ?? ''))
}

/**
 * 生成**可复制执行**的那一行。返回 null = 本工具拒绝生成(调用方必须把它渲染成点名文字,
 * 不得为了「每行都有出口」去猜一条可能改写别人记录的命令)。
 */
export function buildClaimLine({ storeFlag, key, duplicated }) {
  if (!key || duplicated || !isShellSafeKey(key)) return null
  const parts = [CLAIM_BASE]
  if (storeFlag) parts.push(storeFlag)
  parts.push(`--claim "${key}=<user_id>" --apply`)
  return parts.join(' ')
}

function renderLedger(ledger, inspected, ownerField) {
  const lines = []
  lines.push(`\n── ${ledger.title} ──`)
  lines.push(`   路径 ${inspected.path}`)
  if (inspected.state === 'missing') {
    lines.push('   ⚠️ **没有这个文件**。两种可能:这份 checkout 从没装过这类记录(真的零存量),')
    lines.push('      或者你站错了机器/目录 —— 请核对上面的主机名与这条绝对路径。')
    lines.push('      本工具不因此判红,但也**没有**替你确认「部署机上同样没有」。')
    lines.push('      (对照:回填器对缺文件直接打「记录 0 条 + exit 0」,分不出这两种情形。)')
    return lines
  }
  if (inspected.state === 'undetermined') {
    lines.push(`   ❌ **未判定**:${inspected.reason}`)
    lines.push(
      '      ⇒ 这一态**不等于**「没有记录」,也**不等于**「没问题」。先修可读性再重跑本命令;',
    )
    lines.push('      在它变绿之前,任何「无主计数为 0」的结论都不成立。')
    return lines
  }
  const c = classifyRecords(inspected.records, ownerField)
  const dup = new Set(c.duplicateKeys.map((d) => d.key))
  lines.push(
    `   读到 ${c.total} 条(${inspected.bytes} B,mtime ${inspected.mtime}):` +
      ` 已属主 ${c.owned.length} / **无主待认领 ${c.ownerlessClaimable.length}**` +
      ` / 无 key 拿不到认领把手 ${c.ownerlessUnclaimable.length} / 非对象条目 ${c.nonObjectDropped}`,
  )
  if (c.duplicateKeys.length) {
    lines.push(
      `   ⚠️ 同一 key 出现多条:${c.duplicateKeys.map((d) => `${d.key}×${d.count}`).join('、')}` +
        ' ⇒ 实测认领行会连带改写同 key 的**已属主**记录,故这些条**不出认领行**,先人工拆开',
    )
  }
  if (!c.ownerlessClaimable.length && !c.ownerlessUnclaimable.length) {
    lines.push('   ✅ 无主 0 条 —— 这一本账复验通过(复验判据就是这个计数归零)。')
    return lines
  }
  lines.push(`   无主记录的语义:${ledger.ownerlessMeans}`)
  lines.push('   逐条(只报 name 与 key;app_secret / env / extra 一律不进输出):')
  let n = 0
  for (const row of c.ownerlessClaimable) {
    n += 1
    lines.push(`     ${n}. key=\`${row.key}\`  name=\`${row.name || '(无名)'}\``)
    const line = buildClaimLine({
      storeFlag: ledger.storeFlag,
      key: row.key,
      duplicated: dup.has(row.key),
    })
    if (line) {
      lines.push('        认领(会写盘;原文件先自动备份成 .pre-backfill-*):')
      lines.push(`          ${line}`)
      lines.push(
        '        ⚠️ 先**不带 `--apply`** 跑一次看报告(把行尾那段去掉即可),确认无误再执行上面那行。',
      )
      lines.push('        ⚠️ 两行里的 `<user_id>` 都要换成真人的 user_id —— 不点名就没有出口。')
    } else if (dup.has(row.key)) {
      lines.push(
        '        (本条**不给**可复制命令:该 key 在这份文件里不止一条,见上面的重复 key 警告。)',
      )
    } else {
      lines.push('        (本条**不给**可复制命令:key 含 shell 敏感字符,粘进去会被截断或展开。)')
      lines.push(`        改走 JSON 台账:--claims <file.json>,内容 {"${row.key}": "<user_id>"}`)
    }
  }
  for (const row of c.ownerlessUnclaimable) {
    n += 1
    lines.push(`     ${n}. ${row.label}`)
    lines.push(
      '        ⇒ 回填器按 key 索引,这一条它既看不见也落不了。出路只有两条:人工补上一个 key 后',
    )
    lines.push(
      '          再走上面的认领,或按 AGENTS §7 删除安全逐条定性。**不得**为让它消失而整片删文件。',
    )
  }
  return lines
}

export function renderReport(report) {
  const L = []
  L.push('📋 无主记录认领巡检(只读:不写任何文件、不改任何数据)')
  L.push(`   主机 ${report.host} | 仓库根 ${report.repoRoot}`)
  if (!report.ownerField) {
    L.push(`   ❌ 属主键名解析不到:${report.ownerFieldSource} 里没有 OWNER_FIELD = "…" 这一行`)
    L.push('      ⇒ 两本账全部**未判定**(判不出「有没有属主」不等于「没有属主」)。')
    return L
  }
  L.push(`   属主键名 \`${report.ownerField}\`(现读自 ${report.ownerFieldSource})`)
  L.push('   ⚠️ 这台机读到的只是**这台机**这份 checkout 里的两份 data/*.json。部署机是另一份')
  L.push('      checkout,它的读数只有在那台机上跑同一条命令才拿得到 —— 本机 0 条**不是**全局结论。')
  L.push('      本工具**不猜**「这台机是不是部署机」(那是机器状态,要看服务与端口);')
  L.push('      核对方法见 RUNBOOK 第 0 步。')
  for (const item of report.ledgers) {
    for (const line of renderLedger(item.ledger, item.inspected, report.ownerField)) L.push(line)
  }
  let ownerless = 0
  for (const item of report.ledgers) {
    if (item.inspected.state === 'ok') {
      ownerless += classifyRecords(item.inspected.records, report.ownerField).ownerlessClaimable
        .length
    }
  }
  L.push('\n── 下一步 ──')
  L.push(
    '  1. 运维步骤全文:docs/CONNECTOR_OWNER_CLAIM_RUNBOOK.md(含两端真机重测判据与装依赖的坑)。',
  )
  L.push('  2. 认领完在**同一台机**重跑本命令复验:两本账的「无主待认领」计数都应为 0。')
  L.push(
    `  3. 本次待认领合计 ${ownerless} 条(账 ① + 账 ②;两本账语义不同,合计只是工作量不是风险数)。`,
  )
  return L
}

/** 取属主键名:读 Python 侧那份定义;读不到 ⇒ null(调用方据此把两本账判为未判定)。 */
function readOwnerField() {
  try {
    return {
      field: parseOwnerField(readFileSync(OWNER_KEY_SOURCE, 'utf8')),
      source: OWNER_KEY_SOURCE,
    }
  } catch (err) {
    return { field: null, source: `${OWNER_KEY_SOURCE}(读不到:${err.code || err.message})` }
  }
}

function collect() {
  const { field, source } = readOwnerField()
  const ledgers = LEDGERS.map((ledger) => ({ ledger, inspected: inspectStoreFile(ledger.file) }))
  const undetermined = !field || ledgers.some((x) => x.inspected.state === 'undetermined')
  return {
    tool: 'owner-claim',
    readOnly: true,
    host: hostname(),
    repoRoot: REPO_ROOT,
    ownerField: field,
    ownerFieldSource: source,
    verdict: undetermined ? 'undetermined' : 'judged',
    ledgers,
  }
}

function toJson(report) {
  return {
    ...report,
    ledgers: report.ledgers.map(({ ledger, inspected }) => {
      const c =
        inspected.state === 'ok' ? classifyRecords(inspected.records, report.ownerField) : null
      const dup = c ? new Set(c.duplicateKeys.map((d) => d.key)) : new Set()
      return {
        id: ledger.id,
        path: inspected.path,
        state: inspected.state,
        reason: inspected.reason ?? null,
        bytes: inspected.bytes ?? null,
        mtime: inspected.mtime ?? null,
        total: c?.total ?? null,
        owned: c?.owned.length ?? null,
        ownerlessClaimable: c
          ? c.ownerlessClaimable.map((r) => ({ key: r.key, name: r.name }))
          : null,
        ownerlessWithoutKey: c ? c.ownerlessUnclaimable.map((r) => r.label) : null,
        nonObjectDropped: c?.nonObjectDropped ?? null,
        duplicateKeys: c ? c.duplicateKeys : null,
        claimLines: c
          ? c.ownerlessClaimable.map((r) => ({
              key: r.key,
              line: buildClaimLine({
                storeFlag: ledger.storeFlag,
                key: r.key,
                duplicated: dup.has(r.key),
              }),
            }))
          : null,
      }
    }),
  }
}

function main() {
  if (SELF_TEST) return selfTest()
  const report = collect()
  if (AS_JSON) console.info(JSON.stringify(toJson(report), null, 2))
  else for (const line of renderReport(report)) console.info(line)
  if (report.verdict === 'undetermined') {
    console.info('\n结论:未判定 ⇒ exit 2(这不是「没有问题」,是「这一层没看见」)。')
    return 2
  }
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 自检区:只有 --self-test 会走到这里。**全文件唯一的写盘调用都必须在下面这条线之后**,
// 且只经 selfTest() 到达 —— 镜像测试 scripts/tests/owner-claim.test.mjs 用源码位置锁住这一条
// (§22c 反向锁)。夹具落 mkScratch(AGENTS §26:临时物唯一落点),跑完即删,仓库零副作用。
// ─────────────────────────────────────────────────────────────────────────────────────
function selfTest() {
  const results = []
  const ok = (name, fn) => {
    try {
      fn()
      results.push(`  ✅ ${name}`)
    } catch (err) {
      results.push(`  ❌ ${name} —— ${String(err.message).split('\n')[0]}`)
    }
  }
  const SECRET = 'SENTINEL-APP-SECRET-NEVER-PRINT'
  const ENVV = 'SENTINEL-ENV-TOKEN-NEVER-PRINT'
  const EXTRAV = 'SENTINEL-EXTRA-BLOB-NEVER-PRINT'
  const ledgerOf = (id) => LEDGERS.find((l) => l.id === id)
  const rowOf = (id, inspected) => ({ ledger: ledgerOf(id), inspected })
  const fakeReport = (ledgers) => ({
    host: hostname(),
    repoRoot: REPO_ROOT,
    ownerField: 'owner_user_id',
    ownerFieldSource: 'connector_store.py',
    verdict: 'judged',
    ledgers,
  })
  const okRow = (id, records, name) => ({
    state: 'ok',
    path: name,
    bytes: JSON.stringify(records).length,
    mtime: '1970-01-01T00:00:00.000Z',
    records,
  })

  const rich = [
    { key: 'yuque:docs', name: '语雀文档库', app_secret: SECRET, extra: { repo: EXTRAV } },
    { key: 'feishu:kb', name: '飞书知识库', owner_user_id: '7' },
    { key: 'wecom:dup', name: '重复键甲', owner_user_id: '' },
    { key: 'wecom:dup', name: '重复键乙(已有主)', owner_user_id: '9' },
    { name: '无 key 的记录', env: { TOKEN: ENVV } },
    '不是对象的一条',
  ]

  const dir = mkScratch('owner-claim-')
  try {
    const abs = (n) => join(dir, n)
    const put = (n, text) => writeFileSync(abs(n), text, 'utf8')

    ok('S1 OWNER_FIELD 双/单引号两形态都解析得到;没有该常量 ⇒ null', () => {
      assert.equal(parseOwnerField('OWNER_FIELD = "owner_user_id"'), 'owner_user_id')
      assert.equal(parseOwnerField("OWNER_FIELD = 'x'"), 'x')
      assert.equal(parseOwnerField('没有这个常量'), null)
      assert.equal(parseOwnerField(''), null)
    })

    ok('S2 缺文件 = missing(不是「没有记录」),输出不得出现「无主 0 条」', () => {
      const r = inspectStoreFile(abs('definitely-not-here.json'))
      assert.equal(r.state, 'missing')
      const t = renderReport(fakeReport([rowOf('connector', r)])).join('\n')
      assert.match(t, /没有这个文件/)
      assert.doesNotMatch(t, /无主 0 条/)
      assert.doesNotMatch(t, /✅/)
    })

    ok('S3 半截 JSON = undetermined,且不得被读成「没有记录」', () => {
      put('broken.json', '[{"key":"a:b",')
      const r = inspectStoreFile(abs('broken.json'))
      assert.equal(r.state, 'undetermined')
      assert.match(r.reason, /JSON 不可解析/)
      const t = renderReport(fakeReport([rowOf('connector', r)])).join('\n')
      assert.match(t, /未判定/)
      assert.doesNotMatch(t, /无主 0 条/)
    })

    ok('S4 顶层不是列表 = undetermined(并报名收到的形态)', () => {
      put('obj.json', '{"key":"x"}')
      const r = inspectStoreFile(abs('obj.json'))
      assert.equal(r.state, 'undetermined')
      assert.match(r.reason, /顶层不是列表/)
      assert.match(r.reason, /对象/)
    })

    ok('S4b 带 BOM = undetermined(而不是「0 条」)', () => {
      put('bom.json', `\ufeff[]`)
      const r = inspectStoreFile(abs('bom.json'))
      assert.equal(r.state, 'undetermined')
      assert.match(r.reason, /BOM/)
    })

    ok('S5 四堆分流正确(可认领 2 / 已属主 2 / 无把手 2 / 非对象 1)', () => {
      const c = classifyRecords(rich, 'owner_user_id')
      assert.equal(c.ownerlessClaimable.length, 2)
      assert.equal(c.owned.length, 2)
      assert.equal(c.ownerlessUnclaimable.length, 2)
      assert.equal(c.nonObjectDropped, 1)
    })

    ok('S6 空串属主按「无主」算(与 can_mutate 的 "" 回退档同形)', () => {
      const c = classifyRecords(rich, 'owner_user_id')
      assert.ok(c.ownerlessClaimable.some((r) => r.key === 'wecom:dup'))
    })

    ok('S7 重复 key 被量出并点名(认领行的生成条件之一)', () => {
      assert.deepEqual(classifyRecords(rich, 'owner_user_id').duplicateKeys, [
        { key: 'wecom:dup', count: 2 },
      ])
    })

    ok('S8 账① 认领行 = 可复制的那一行(不带 --store,那是回填器缺省路径)', () => {
      assert.equal(
        buildClaimLine({ storeFlag: null, key: 'yuque:docs', duplicated: false }),
        'cd apps/ai-service && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe ' +
          'scripts/backfill_connector_owner.py --claim "yuque:docs=<user_id>" --apply',
      )
    })

    ok('S9 账② 必须带 --store,否则会把商店记录当连接器写错文件', () => {
      const line = buildClaimLine({
        storeFlag: ledgerOf('mcp').storeFlag,
        key: 'filesystem',
        duplicated: false,
      })
      assert.match(line, /--store data\/mcp_store\.json/)
    })

    ok('S10 重复 key ⇒ 拒绝出行(null),而不是「照发但补句警告」', () => {
      assert.equal(buildClaimLine({ storeFlag: null, key: 'a:b', duplicated: true }), null)
    })

    ok('S11 含 shell 敏感字符的 key ⇒ 不出行并指向 --claims', () => {
      assert.equal(isShellSafeKey('a`b'), false)
      assert.equal(isShellSafeKey('a$(x)'), false)
      assert.equal(isShellSafeKey('a"b'), false)
      assert.equal(isShellSafeKey('yuque:docs_1.2/@x~-'), true)
      assert.equal(buildClaimLine({ storeFlag: null, key: 'a b"c', duplicated: false }), null)
      const t = renderReport(
        fakeReport([
          rowOf('connector', okRow('connector', [{ key: 'a b"c', name: '怪 key' }], 'x.json')),
        ]),
      ).join('\n')
      assert.match(t, /--claims/)
    })

    ok(
      'S12 报告全文不含 app_secret / env / extra 的值(哨兵反证;名字必须在,否则本条是空断言)',
      () => {
        const t = renderReport(
          fakeReport([
            rowOf('connector', okRow('connector', rich, 'x.json')),
            rowOf('mcp', okRow('mcp', rich, 'y.json')),
          ]),
        ).join('\n')
        for (const s of [SECRET, ENVV, EXTRAV]) assert.ok(!t.includes(s), `泄漏哨兵 ${s}`)
        assert.match(t, /语雀文档库/)
        assert.match(t, /yuque:docs/)
      },
    )

    ok('S13 无条件打印「本机读数不是全局结论」+ 主机名 + mtime + RUNBOOK 指针', () => {
      put('rich.json', JSON.stringify(rich))
      const t = renderReport(
        fakeReport([rowOf('connector', inspectStoreFile(abs('rich.json')))]),
      ).join('\n')
      assert.ok(t.includes('这台机'))
      assert.ok(t.includes('部署机'))
      assert.ok(t.includes(`主机 ${hostname()}`))
      assert.match(t, /mtime/)
      assert.match(t, /CONNECTOR_OWNER_CLAIM_RUNBOOK/)
    })

    ok('S14 巡检是纯读:夹具字节在两次 inspect 前后逐字不变', () => {
      const p = abs('rich.json')
      const before = readFileSync(p)
      inspectStoreFile(p)
      inspectStoreFile(p)
      assert.ok(before.equals(readFileSync(p)))
    })

    ok('S15 ownerField=null ⇒ 报告喊未判定,不报任何计数', () => {
      const t = renderReport({
        host: 'h',
        repoRoot: 'r',
        ownerField: null,
        ownerFieldSource: OWNER_KEY_SOURCE,
        ledgers: [],
      }).join('\n')
      assert.match(t, /未判定/)
      assert.doesNotMatch(t, /无主 0 条/)
    })

    ok('S16 无 key 的无主记录:点名 + 说清「回填器落不了它」,而不是静默不计', () => {
      const t = renderReport(
        fakeReport([
          rowOf('connector', okRow('connector', [{ name: '只有名字没有键' }], 'z.json')),
        ]),
      ).join('\n')
      assert.match(t, /既看不见也落不了/)
      assert.match(t, /只有名字没有键/)
    })

    ok('S17 --json 形态可被 JSON.parse,且三态字段在(不靠人读文本)', () => {
      const json = JSON.stringify(
        toJson({
          ...fakeReport([]),
          readOnly: true,
          ledgers: [rowOf('connector', { path: 'p', state: 'missing' })],
        }),
      )
      const back = JSON.parse(json)
      assert.equal(back.readOnly, true)
      assert.equal(back.verdict, 'judged')
      assert.equal(back.ledgers[0].state, 'missing')
      assert.equal(back.ledgers[0].total, null)
      assert.equal(back.ledgers[0].ownerlessClaimable, null)
    })
  } finally {
    rmScratch(dir)
  }

  const failed = results.filter((r) => r.includes('❌')).length
  for (const r of results) console.info(r)
  console.info(`owner-claim --self-test:pass ${results.length - failed} / fail ${failed}`)
  return failed === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (err) {
    console.error(`❌ owner-claim 自身异常 ⇒ exit 2(不冒认通过):${err?.stack || err}`)
    process.exit(2)
  }
}

export const __test__ = {
  parseOwnerField,
  classifyBlob,
  inspectStoreFile,
  classifyRecords,
  isShellSafeKey,
  buildClaimLine,
  renderReport,
  LEDGERS,
  CLAIM_BASE,
  REPO_ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
