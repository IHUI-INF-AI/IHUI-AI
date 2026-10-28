#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子的诊断输出就是它的交付物 */

/**
 * 只读对账尺子:同一 provider 是否被**两条写路径**登记进 ai_model_config(2026-10-26 立)。
 *
 * 立因(票面,不是推测):号池上游模型有两条互不知情的写路径 ——
 *   ① 登记器 `scripts/relay-upstream-models-sync.mjs`,权威输入 = `scripts/data/relay-upstream-models.jsonl`,
 *      写 ai_model_config + ai_model_config_models(description 带 `由 scripts/relay-upstream-models-sync.mjs`、
 *      metadata 带 `by` 出处);
 *   ② WorkBuddy 同步器 `apps/api/scripts/relay-workbuddy-models.ts`,权威输入 = 上游
 *      `/console/enterprises/personal/models`(账号池 token 现取),写 ai_model_config +
 *      ai_model_config_models + ai_relay_model_catalog(metadata 带 `workbuddy` 出处)。
 * 两条路径各自幂等,但**谁赢取决于最后跑谁**。本尺只回答"同 provider 是否被两侧登记",并点名归属;
 * **不改任何一条写路径**(票面选的是只读尺子这一支,不是把 workbuddy 并入登记表口径)。
 *
 * 两侧权威输入(离线档,默认):
 *   登记器侧 = 登记表 jsonl 的 providerCode 字段(逐行,行号即出处);
 *   workbuddy 侧 = 同步器源码里的 `const PROVIDER = '…'` 常量(行号即出处)。
 *   模型级清单在 workbuddy 侧**不在仓内**(运行时取上游 HTTP),故本尺只判 provider 级;
 *   这条边界如实写在输出里,不把"模型清单取不到"伪装成"没有模型"。
 *
 * 三态与退出码(AGENTS §0.3:"没判"绝不写成"判过"):
 *   0 = 无交集(两侧 provider 集合不相交,且输入/契约全可判);
 *   1 = 有交集(逐 provider 点名两侧归属,末行给机读结论);
 *   2 = 未判定(输入缺失 / 登记表坏行 / workbuddy 常量取不到 / 参数错 / --db 失败)。
 *   坏行**单列不连坐**:一条坏 JSON 只记它自己那行,其余行照常参与集合运算 —— 但整轮结论仍是
 *   未判定(坏行可能藏着一个 provider),故末行同时报 overlap 与 undetermined 两个数。
 *
 * `--db` 可选档(默认档绝不依赖数据库):读 `apps/api/.env` 的 DATABASE_URL,对**本机回环开发库**
 * 的 ai_model_config 做只读 SELECT(连接守卫复用 scripts/lib/db-probe-client.mjs 的 guardDbDsn,
 * 拒绝非回环与生产隧道口 8810),把库面 configs/models/baseUrl 变体数补进报告。
 * `--db` 任一环节失败 ⇒ 未判定(exit 2),绝不因为"库没读到"就记绿。输出只含 host:port/db,
 * 凭据段整段丢弃(AGENTS §5d)。
 *
 * 定级纪律:本器判**仓库输入 + 可选库面**,不接 pre-commit/提交链,也不接守护巡检轮;
 * 镜像测试用形状锁钉住 guardian-runner 与 .husky 面不得出现本文件名(挂错即 §12e 恒红门)。
 * 取材面纪律(守门 118):两侧仓库输入经 scripts/lib/face-reader.mjs 统一取材 ——
 * 默认判工作树(对账尺判两条写路径**当下**会读到的在飞输入,本器不是提交门禁,工作树是它的
 * 正档而非逃生舱),`--staged` 判索引 blob,两旗同给 ⇒ 未判定;显式 --registry/--workbuddy
 * 点名的是调用方指定的盘上副本。取不到一律落未判定,不折成"没有"。
 * 本器**不写台账**,因此不涉及台账行宽/hex 渲染;若日后要写台账,行内 hex 必须复用
 * scripts/lib/triage-doc-line.mjs 的 sanitizeHexRuns,不得另写一把尺子。
 *
 * 用法:
 *   node scripts/check-relay-model-dual-writers.mjs
 *   node scripts/check-relay-model-dual-writers.mjs --db
 *   node scripts/check-relay-model-dual-writers.mjs --staged
 *   node scripts/check-relay-model-dual-writers.mjs --self-test
 *   可选 --registry <path> / --workbuddy <path> / --env-file <path> / --dsn <url> / --worktree
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { requireFlagValue } from './lib/flag-value.mjs'
import { guardDbDsn } from './lib/db-probe-client.mjs'
import { openDevClient, readSnapshot } from './lib/relay-upstream-models-db.mjs'
import { dsnFace, resolveDsn } from './lib/relay-upstream-models-plan.mjs'
import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 两侧权威输入的**仓库相对路径**是取材面的基准(relay 面纪律,守门 118):默认判工作树(本器是
// 在飞对账尺,判两条写路径当下会读到的那份),--staged 判索引 blob;显式 --registry/--workbuddy
// 点名的是调用方指定的盘上副本(逃生舱,与 watermark inject 的显式 file 同语义)。
export const REGISTRY_REL = 'scripts/data/relay-upstream-models.jsonl'
export const WORKBUDDY_REL = 'apps/api/scripts/relay-workbuddy-models.ts'
export const REGISTRY_DEFAULT = join(ROOT, REGISTRY_REL)
export const WORKBUDDY_DEFAULT = join(ROOT, WORKBUDDY_REL)
export const ENV_FILE_DEFAULT = join(ROOT, 'apps/api/.env')
export const RESULT_PREFIX = 'DUAL-WRITERS-RESULT'

/**
 * 按面取一份仓库输入(经 scripts/lib/face-reader.mjs 的统一读取入口,守门 118 的 sanctioned 通路)。
 * 取不到 ⇒ { text: null, why } 交调用方落未判定,绝不折成"没有内容"。
 */
export function readRepoInput({ face, rel, explicit }) {
  if (explicit) {
    try {
      return { text: readFileSync(explicit, 'utf8') }
    } catch (e) {
      return { text: null, why: String(e?.code ?? e?.message ?? e) }
    }
  }
  try {
    if (face === 'worktree') return { text: readWorktreeFile(ROOT, rel) }
    const spec = `${face === 'staged' ? '' : 'HEAD'}:${rel}`
    const got = catBatch(ROOT, [spec])
    return { text: got.get(spec) ?? null }
  } catch (e) {
    return { text: null, why: `面=${face} 取不到 ${rel}:${String(e?.message ?? e).slice(0, 200)}` }
  }
}

const miss = (why) => console.error(`❌ 未判定:${why}`)

/**
 * 登记表 → provider 集合(纯判据)。只取 providerCode 这一格:登记器的完整契约校验属于
 * 写路径自己(relay-upstream-models-plan.mjs),本尺不复制第二份校验器,只回答"谁被登记了"。
 * 坏行逐条进 problems(带行号),**不影响**其它行的解析。
 */
export function parseRegistryProviders(text) {
  const providers = new Map()
  const problems = []
  let nonEmpty = 0
  String(text ?? '')
    .split('\n')
    .forEach((raw, i) => {
      const line = raw.replace(/\r$/, '')
      if (!line.trim()) return
      nonEmpty += 1
      let o
      try {
        o = JSON.parse(line)
      } catch (e) {
        problems.push({ lineNo: i + 1, why: `不是合法 JSON(${e?.message ?? e})` })
        return
      }
      const code = typeof o?.providerCode === 'string' ? o.providerCode.trim() : ''
      if (!code) {
        problems.push({ lineNo: i + 1, why: '缺 providerCode(必须是非空字符串)' })
        return
      }
      const models = Array.isArray(o?.models) ? o.models.length : 0
      const prev = providers.get(code)
      if (prev) {
        prev.lineNos.push(i + 1)
        prev.models += models
        return
      }
      providers.set(code, {
        providerCode: code,
        lineNos: [i + 1],
        models,
        configName: typeof o?.configName === 'string' ? o.configName : '',
        baseUrl: typeof o?.baseUrl === 'string' ? o.baseUrl : '',
      })
    })
  if (nonEmpty === 0) problems.push({ lineNo: 0, why: '登记表为空(枚举到 0 个登记意图,判死不记绿)' })
  return { providers: [...providers.values()], problems }
}

/** workbuddy 同步器源码 → provider 身份(纯判据)。取不到常量 ⇒ 契约坏,调用方落未判定。 */
export function parseWorkbuddyProvider(text) {
  const lines = String(text ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*const\s+PROVIDER\s*=\s*(['"])([^'"]+)\1\s*;?\s*$/.exec(lines[i].replace(/\r$/, ''))
    if (m) return { ok: true, providerCode: m[2], lineNo: i + 1 }
  }
  return {
    ok: false,
    why: '同步器源码里找不到 `const PROVIDER = \'…\'` 常量(文件不对或契约已变)',
  }
}

/** 三态收口:未判定优先(2),其次交集(1),最后无交集(0)。末行格式固定,供机器读。 */
export function finalize(result) {
  const overlap = Array.isArray(result.overlap) ? result.overlap : []
  const undetermined = Array.isArray(result.undetermined) ? result.undetermined : []
  const exitCode = undetermined.length ? 2 : overlap.length ? 1 : 0
  return {
    ...result,
    overlap,
    undetermined,
    exitCode,
    resultLine: `${RESULT_PREFIX} overlap=${overlap.length} undetermined=${undetermined.length}`,
  }
}

/**
 * 两侧输入的集合判据(纯函数,零 IO)。`registryText` / `workbuddyText` 为 null 表示读不到;
 * 空串会由解析器自己判"空表/契约坏",两条路都落未判定。
 */
export function judgeDualWriters({
  registryText,
  workbuddyText,
  registryLabel = REGISTRY_DEFAULT,
  workbuddyLabel = WORKBUDDY_DEFAULT,
}) {
  const undetermined = []
  let registry = { providers: [], problems: [] }
  if (registryText === null || registryText === undefined) {
    undetermined.push(`登记表读不到(${registryLabel})`)
  } else {
    registry = parseRegistryProviders(registryText)
    for (const p of registry.problems) {
      undetermined.push(`登记表第 ${p.lineNo} 行:${p.why}`)
    }
  }
  let workbuddy = { ok: false, providerCode: null, lineNo: 0, why: '' }
  if (workbuddyText === null || workbuddyText === undefined) {
    undetermined.push(`workbuddy 同步器源码读不到(${workbuddyLabel})`)
  } else {
    workbuddy = parseWorkbuddyProvider(workbuddyText)
    if (!workbuddy.ok) undetermined.push(`workbuddy 侧契约坏:${workbuddy.why}(${workbuddyLabel})`)
  }
  const overlap = []
  if (workbuddy.ok) {
    for (const p of registry.providers) {
      if (p.providerCode !== workbuddy.providerCode) continue
      overlap.push({
        providerCode: p.providerCode,
        registry: p,
        workbuddy: { providerCode: workbuddy.providerCode, lineNo: workbuddy.lineNo },
      })
    }
  }
  return finalize({
    registryLabel,
    workbuddyLabel,
    registry,
    workbuddy,
    overlap,
    undetermined,
  })
}

function describeRegistrySide(r) {
  const name = r.configName ? ` · configName=${r.configName}` : ''
  return `第 ${r.lineNos.join(',')} 行(models=${r.models}${name})`
}

/** 报告渲染(纯函数):末行恒为机读结论,便于 grep / 机器判读。 */
export function renderReport(r) {
  const out = []
  out.push(
    `[relay-model-dual-writers] mode=${r.db ? 'offline+db' : 'offline'} registry=${r.registryLabel} workbuddy=${r.workbuddyLabel}`,
  )
  for (const p of r.registry.providers) {
    if (r.overlap.some((o) => o.providerCode === p.providerCode)) continue
    out.push(`= provider=${p.providerCode} 仅登记器侧(登记表 ${describeRegistrySide(p)})`)
  }
  if (r.workbuddy.ok && !r.overlap.some((o) => o.providerCode === r.workbuddy.providerCode)) {
    out.push(
      `= provider=${r.workbuddy.providerCode} 仅 workbuddy 侧(同步器第 ${r.workbuddy.lineNo} 行 PROVIDER 常量 · 模型级出处=上游 HTTP,仓内无快照)`,
    )
  }
  for (const o of r.overlap) {
    out.push(`✗ provider=${o.providerCode} 双路径登记 —— 两条写路径都会写 ai_model_config + ai_model_config_models`)
    out.push(`   登记器侧:${r.registryLabel} ${describeRegistrySide(o.registry)}`)
    out.push(
      `   workbuddy 侧:${r.workbuddyLabel} 第 ${o.workbuddy.lineNo} 行 \`const PROVIDER = '${o.providerCode}'\`(模型清单运行时取上游,仓内无快照)`,
    )
  }
  if (r.db) {
    out.push(`--db 面:${r.db.face} 只读 SELECT 成功(${r.db.rows.length} 个 provider 命中)`)
    for (const row of r.db.rows) {
      out.push(
        `   provider=${row.providerCode} configs=${row.configs} models=${row.models} baseUrlVariants=${row.baseUrlVariants}`,
      )
    }
  }
  for (const u of r.undetermined) out.push(`? 未判定:${u}`)
  out.push(
    r.exitCode === 0
      ? '✓ 无交集:登记器侧与 workbuddy 侧的 provider 集合不相交'
      : r.exitCode === 1
        ? '✗ 有交集:同 provider 被两条路径登记,归属已逐条点名'
        : '? 未判定:输入/契约/参数有缺口 —— 不记绿也不冒红',
  )
  out.push(r.resultLine)
  return out.join('\n')
}

/**
 * --db 档(纯 IO + 只读 SELECT)。任何一步失败都返回 {ok:false} 交调用方落未判定;
 * 绝不把"没读到库"折成"库里没有"。
 */
export async function probeDb({ argv, env, envFile, codes }) {
  let envText = ''
  try {
    envText = readFileSync(envFile, 'utf8')
  } catch (e) {
    envText = ''
    if (envFile !== ENV_FILE_DEFAULT) {
      return { ok: false, why: `--db 未判定:.env 读不到(${envFile}):${e?.code ?? e?.message ?? e}` }
    }
  }
  const dsn = resolveDsn(argv, envText, env)
  if (dsn.error) return { ok: false, why: `--db 未判定:${dsn.error}` }
  const guarded = guardDbDsn(dsn.dsn)
  if (!guarded.ok) return { ok: false, why: `--db 未判定:拒绝连库 —— ${guarded.why}` }
  const face = dsnFace(dsn.dsn) ?? '(不可解析)'
  const opened = await openDevClient(dsn.dsn)
  if (!opened.ok) return { ok: false, why: `--db 未判定:${opened.why}` }
  const sql = opened.postgres(dsn.dsn, { max: 1, prepare: false, connect_timeout: 8 })
  try {
    const snap = await readSnapshot(sql, codes)
    const rows = new Map(
      codes.map((code) => [code, { providerCode: code, configs: 0, models: 0, baseUrls: new Set() }]),
    )
    const providerByConfig = new Map()
    for (const c of snap.configs ?? []) {
      const code = String(c.providerCode)
      const row = rows.get(code) ?? {
        providerCode: code,
        configs: 0,
        models: 0,
        baseUrls: new Set(),
      }
      row.configs += 1
      if (c.baseUrl) row.baseUrls.add(String(c.baseUrl))
      providerByConfig.set(String(c.id), code)
      rows.set(code, row)
    }
    for (const m of snap.models ?? []) {
      const code = providerByConfig.get(String(m.configId))
      if (!code) continue
      const row = rows.get(code)
      if (row) row.models += 1
    }
    return {
      ok: true,
      face,
      rows: [...rows.values()]
        .map((r) => ({
          providerCode: r.providerCode,
          configs: r.configs,
          models: r.models,
          baseUrlVariants: r.baseUrls.size,
        }))
        .sort((a, b) => a.providerCode.localeCompare(b.providerCode)),
    }
  } catch (e) {
    return {
      ok: false,
      why: `--db 未判定:库查询失败 —— ${String(e?.message ?? e).slice(0, 300)} · DSN面=${face}`,
    }
  } finally {
    try {
      await sql?.end({ timeout: 3 })
    } catch {
      /* 收尾失败不改变已出的结论 */
    }
  }
}

const KNOWN_FLAGS = new Set([
  '--db',
  '--self-test',
  '--registry',
  '--workbuddy',
  '--env-file',
  '--dsn',
  '--staged',
  '--worktree',
])

function emitUsageError(why) {
  miss(why)
  console.error(
    '用法: node scripts/check-relay-model-dual-writers.mjs [--db] [--staged|--worktree] [--registry <path>] [--workbuddy <path>] [--env-file <path>] [--dsn <url>] [--self-test]',
  )
  console.log(`${RESULT_PREFIX} overlap=0 undetermined=1`)
  return 2
}

export async function runMain(argv, env = process.env) {
  if (argv.includes('--self-test')) return runSelfTest()
  const unknown = argv.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a))
  if (unknown.length) return emitUsageError(`未知选项 ${unknown.join(' ')}`)

  const faceSel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'worktree',
  })
  if (faceSel.error) return emitUsageError(faceSel.error)
  const face = faceSel.face

  const reg = requireFlagValue(argv, '--registry', { noun: ' 登记表路径' })
  const wb = requireFlagValue(argv, '--workbuddy', { noun: ' workbuddy 同步器源码路径' })
  const envf = requireFlagValue(argv, '--env-file', { noun: ' .env 路径', fallback: ENV_FILE_DEFAULT })
  const badFlag = reg.error ?? wb.error ?? envf.error
  if (badFlag) return emitUsageError(badFlag)

  const regRead = readRepoInput({ face, rel: REGISTRY_REL, explicit: reg.value })
  const wbRead = readRepoInput({ face, rel: WORKBUDDY_REL, explicit: wb.value })
  if (regRead.why) console.error(`  (登记表读取失败:${regRead.why})`)
  if (wbRead.why) console.error(`  (workbuddy 同步器读取失败:${wbRead.why})`)
  const asLabel = (p, rel) =>
    p ? p.replaceAll('\\', '/').replace(`${ROOT.replaceAll('\\', '/')}/`, '') : `${rel}@${face}`

  let result = judgeDualWriters({
    registryText: regRead.text,
    workbuddyText: wbRead.text,
    registryLabel: asLabel(reg.value, REGISTRY_REL),
    workbuddyLabel: asLabel(wb.value, WORKBUDDY_REL),
  })

  if (argv.includes('--db')) {
    const codes = [
      ...new Set([
        ...result.registry.providers.map((p) => p.providerCode),
        ...(result.workbuddy.ok ? [result.workbuddy.providerCode] : []),
      ]),
    ]
    if (codes.length === 0) {
      result = finalize({
        ...result,
        undetermined: [...result.undetermined, '--db 未判定:两侧 provider 集合都为空,没有可查的 provider'],
      })
    } else {
      const db = await probeDb({ argv, env, envFile: envf.value, codes })
      result = db.ok
        ? finalize({ ...result, db: { face: db.face, rows: db.rows } })
        : finalize({ ...result, undetermined: [...result.undetermined, db.why] })
    }
  }

  console.log(renderReport(result))
  return result.exitCode
}

// ── --self-test:有交集 / 无交集 / 输入缺失 / 坏行单列不连坐 / 真仓输入 ──
// 夹具唯一落点 = scripts/lib/scratch-dir.mjs 的 mkScratch(§15b),不落仓库树。
// 全部用例走生产判据(parse*/judge*/finalize/render),不复制期望值。
function runSelfTest() {
  const { t: ok, report } = makeRegistrar()
  const dir = mkScratch('relay-model-dual-writers-selftest')
  try {
    const wbSrc = (providerCode, indent = '') =>
      [
        '// fixture: workbuddy 同步器形状',
        'const PROVIDER = ' + `'${providerCode}'`,
        'const CONFIG_NAME = "WorkBuddy 账号池(反代)"',
      ]
        .map((l) => indent + l)
        .join('\n')

    const withOverlap = judgeDualWriters({
      registryText: [
        JSON.stringify({ providerCode: 'qoder', models: [{ alias: 'qoder/a' }] }),
        JSON.stringify({ providerCode: 'workbuddy', models: [{ alias: 'workbuddy/x' }, { alias: 'workbuddy/y' }] }),
      ].join('\n'),
      workbuddyText: wbSrc('workbuddy'),
    })
    ok(
      '有交集 ⇒ exit 1,且点名两侧归属与行号',
      withOverlap.exitCode === 1 &&
        withOverlap.overlap.length === 1 &&
        withOverlap.overlap[0].providerCode === 'workbuddy' &&
        withOverlap.overlap[0].registry.lineNos[0] === 2 &&
        withOverlap.overlap[0].workbuddy.lineNo === 2,
      JSON.stringify(withOverlap.overlap),
    )
    ok(
      '有交集末行格式固定 overlap=1 undetermined=0',
      withOverlap.resultLine === 'DUAL-WRITERS-RESULT overlap=1 undetermined=0',
      withOverlap.resultLine,
    )

    const noOverlap = judgeDualWriters({
      registryText: [
        JSON.stringify({ providerCode: 'qoder', models: [{ alias: 'qoder/a' }] }),
        JSON.stringify({ providerCode: 'trae', models: [{ alias: 't' }] }),
      ].join('\n'),
      workbuddyText: wbSrc('workbuddy'),
    })
    ok(
      '无交集 ⇒ exit 0 且两侧 provider 都被列出',
      noOverlap.exitCode === 0 &&
        noOverlap.overlap.length === 0 &&
        noOverlap.registry.providers.length === 2 &&
        noOverlap.undetermined.length === 0,
      noOverlap.resultLine,
    )
    ok(
      '无交集末行 overlap=0 undetermined=0',
      noOverlap.resultLine === 'DUAL-WRITERS-RESULT overlap=0 undetermined=0',
      noOverlap.resultLine,
    )
    ok(
      '报告末行恒为机读结论',
      renderReport(withOverlap).split('\n').at(-1) === withOverlap.resultLine &&
        renderReport(noOverlap).split('\n').at(-1) === noOverlap.resultLine,
    )

    const missingRegistry = judgeDualWriters({ registryText: null, workbuddyText: wbSrc('workbuddy') })
    ok(
      '输入缺失(登记表)⇒ exit 2 且显式写未判定,不记绿',
      missingRegistry.exitCode === 2 &&
        missingRegistry.overlap.length === 0 &&
        missingRegistry.undetermined.some((u) => u.includes('登记表读不到')),
      missingRegistry.resultLine,
    )
    const missingWorkbuddy = judgeDualWriters({ registryText: '{"providerCode":"qoder"}', workbuddyText: null })
    ok(
      '输入缺失(workbuddy 源码)⇒ exit 2',
      missingWorkbuddy.exitCode === 2 &&
        missingWorkbuddy.undetermined.some((u) => u.includes('workbuddy 同步器源码读不到')),
      missingWorkbuddy.resultLine,
    )

    const badLine = judgeDualWriters({
      registryText: [
        JSON.stringify({ providerCode: 'workbuddy', models: [{ alias: 'workbuddy/x' }] }),
        '{ 这不是合法 JSON',
      ].join('\n'),
      workbuddyText: wbSrc('workbuddy'),
    })
    ok(
      '坏行单列不连坐:坏行只记自己,好行照常算出交集',
      badLine.overlap.length === 1 &&
        badLine.overlap[0].providerCode === 'workbuddy' &&
        badLine.undetermined.length === 1 &&
        badLine.undetermined[0].includes('第 2 行') &&
        badLine.exitCode === 2,
      badLine.resultLine,
    )
    ok(
      '坏行时末行同时报 overlap 与 undetermined',
      badLine.resultLine === 'DUAL-WRITERS-RESULT overlap=1 undetermined=1',
      badLine.resultLine,
    )

    const emptyRegistry = judgeDualWriters({ registryText: '\n \n', workbuddyText: wbSrc('workbuddy') })
    ok(
      '登记表空 ⇒ exit 2(枚举到 0 个判死不记绿)',
      emptyRegistry.exitCode === 2 && emptyRegistry.undetermined.some((u) => u.includes('登记表为空')),
      emptyRegistry.resultLine,
    )

    const badWorkbuddy = judgeDualWriters({
      registryText: '{"providerCode":"qoder"}',
      workbuddyText: 'export const SOMETHING = 1',
    })
    ok(
      'workbuddy 契约坏(无 PROVIDER 常量)⇒ exit 2,且不把半张集合当结论',
      badWorkbuddy.exitCode === 2 &&
        badWorkbuddy.workbuddy.ok === false &&
        badWorkbuddy.undetermined.some((u) => u.includes('workbuddy 侧契约坏')),
      badWorkbuddy.resultLine,
    )

    const triple = [
      finalize({ overlap: [], undetermined: [] }).exitCode,
      finalize({ overlap: [{ providerCode: 'x' }], undetermined: [] }).exitCode,
      finalize({ overlap: [{ providerCode: 'x' }], undetermined: ['坏'] }).exitCode,
    ]
    ok('三态优先级:无交集 0 / 有交集 1 / 任一未判定压过一切 2', triple.join(',') === '0,1,2', triple.join(','))

    // 临时夹具唯一落点 = scratch 根(§15b);写盘走顶层导入的 writeFileSync,不在 ESM 里 require。
    const w = (name, text) => writeFileSync(join(dir, name), text)
    w('fixtures.jsonl', JSON.stringify({ providerCode: 'workbuddy', models: [] }))
    w('workbuddy.ts', wbSrc('workbuddy'))
    const cliOverlap = judgeDualWriters({
      registryText: readFileSync(join(dir, 'fixtures.jsonl'), 'utf8'),
      workbuddyText: readFileSync(join(dir, 'workbuddy.ts'), 'utf8'),
    })
    ok(
      '临时夹具经磁盘往返后判据不变(读到的字节与内存串同结论)',
      cliOverlap.exitCode === 1 && cliOverlap.overlap.length === 1,
      cliOverlap.resultLine,
    )

    let real
    try {
      const regRead = readRepoInput({ face: 'worktree', rel: REGISTRY_REL })
      const wbRead = readRepoInput({ face: 'worktree', rel: WORKBUDDY_REL })
      real = judgeDualWriters({ registryText: regRead.text, workbuddyText: wbRead.text })
    } catch (e) {
      real = { error: String(e?.message ?? e) }
    }
    ok(
      '真仓输入可判:登记表枚举到 ≥1 个 provider,workbuddy PROVIDER 常量可解析',
      !real.error &&
        real.registry.providers.length >= 1 &&
        real.workbuddy.ok === true &&
        typeof real.workbuddy.providerCode === 'string' &&
        real.workbuddy.providerCode.length > 0,
      real.error ?? real.resultLine,
    )
    ok(
      '真仓输入报告末行是机读结论',
      !real.error && renderReport(real).split('\n').at(-1) === real.resultLine,
      real.error ?? real.resultLine,
    )
  } finally {
    rmScratch(dir)
  }
  const r = report()
  for (const c of r.cases) console.log(`${c.pass ? '✓' : '✗'} ${c.name}`)
  console.log(`自检 ${r.pass}/${r.cases.length} 通过`)
  return r.fail ? 1 : 0
}

export const __test__ = {
  ROOT,
  REGISTRY_REL,
  WORKBUDDY_REL,
  REGISTRY_DEFAULT,
  WORKBUDDY_DEFAULT,
  ENV_FILE_DEFAULT,
  RESULT_PREFIX,
  readRepoInput,
  parseRegistryProviders,
  parseWorkbuddyProvider,
  judgeDualWriters,
  finalize,
  renderReport,
  runMain,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  runMain(process.argv.slice(2))
    .then((rc) => process.exit(rc))
    .catch((e) => {
      miss(e?.message ?? e)
      console.log(`${RESULT_PREFIX} overlap=0 undetermined=1`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
