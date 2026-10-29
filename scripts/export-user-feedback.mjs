// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 生产者是 CLI 器物,诊断必须打到 stdout */
/**
 * export-user-feedback — 三源里第三源(user-feedback)的**唯一数据面生产者**。
 *
 * 病理(本票要消的那一格):auto-triage 的 `readUserFeedback` 在 `userFeedback.jsonl` 非空时
 * 走**文件通道**(路径取 `scripts/data/auto-triage-config.json` 的 `userFeedback.jsonl`),
 * 而仓内没有这个文件的生产者 ⇒ 第三源运行期恒落「未判定」,不是判过。
 *
 * ⚠ 现读补充(不得凭记忆):2026-10-28 08:27 的 `6675dd0ce7` 给适配器补了**第二条通道**
 * (`feedbackRowsByQuery`:jsonlPath 为空时直连库读)。但配置那格**仍非空**,所以今天实际生效的
 * 还是文件通道 —— 直连通道在这份配置下是走不到的兜底。本器补的正是文件通道的上游,
 * 与直连通道并存不冲突;两者将来若要合并,合并点在适配器侧,不在本器里抢。
 * 也因此本器**不搬** `buildFeedbacksSql`:那张 SQL 是给聚类记录用的投影(无 id、时刻 `::text`
 * 落在 `+00` 形态,不符合 `incident-signal-contract` 的 `at` 必须带 `Z`/`±HH:MM` 的要求),
 * 本器的投影要点是 ISO-Z 时刻与 `|`→`%7C`(与 `buildApiLogsSql` 同一手)。上游把直连通道
 * 的时刻改成 ISO-Z 那天,这两条 SQL 应当合并成一条。
 *
 * 取数面(全部复用,零新造):
 *  - 库:真表 `feedbacks`(`packages/database/src/schema/comments.ts:71`),只读单语句 SELECT;
 *  - 客户端定位:`scripts/lib/psql-client-locate.mjs` 的 `locatePsqlClient`(全仓唯一一份);
 *  - DSN 解析:`scripts/check-learn-video-mount.mjs` 的 `resolveDsn`(--dsn → apps/api/.env 的
 *    DATABASE_URL → process.env,**三面皆空即未判定**,不回落"猜一个 localhost");
 *  - 连接守卫:`scripts/lib/db-probe-client.mjs` 的 `guardDbDsn`(非回环 / 8810 生产隧道口一律拒);
 *  - DSN 脱敏:`sanitizeDsn`,任何输出面都不落口令(§5d);
 *  - 配置读取:`scripts/auto-triage.mjs` 的 `loadConfig`(与消费方同一份形状锁,不造第二套解析)。
 *
 * 输出格式(与 `readUserFeedback` 逐字对齐,不看票面看实现):
 *  - JSONL,一行一对象,键 = `at`(ISO-8601 带 Z)|`type`|`status`|`title`|`content`|`id`;
 *  - 只导**未结**反馈(`status NOT IN ('resolved','closed')`)—— 适配器第一件事就是丢这两档,
 *    在 SQL 侧先滤掉,少往磁盘抄一份带用户正文的数据;
 *  - 不导 `contact`/`user_id`/`file_path`/`admin_reply`:适配器读不到它们,导出面按最小必要取。
 *
 * 三态纪律(§0.3,本器的核心):
 *  - `ok`(rc 0):查询成功。**0 行也是判过**(证明该库该表零条未结反馈),落空文件,不记未判定;
 *  - `undetermined`(rc 2):psql 缺席 / DSN 三面皆空 / 守卫拒绝 / 查询失败 / 表不存在
 *    ⇒ **不写导出件**,并把陈旧导出件清掉(派生件、本器自产、可重生成),让消费方落「未判定」,
 *    而不是继续吃上一轮的旧读数当成"无发现"。`--keep-stale` 可关掉这一手;
 *  - `shape`(rc 1):配置/参数形状坏(路径空、limit 非法)—— 不猜,直接判死。
 *
 * 接线现状(如实交代,不声称已接线):
 *  - 消费端已就位:auto-triage 按同一份配置的同一路径取数,本器落到那儿即闭环,**无需二次改配置**;
 *  - 触发端**尚未接线**:`scripts/git-guardian.mjs` 的 `dispatchAutoTriage` 与
 *    `scripts/auto-evolve.mjs` 的感知轮都在别的席位手里在飞,本器不写它们;
 *    故本文件**不声称**自己是 pre-commit / guardian / CI 门,只作独立 CLI 交付。
 *
 * 用法:
 *   node scripts/export-user-feedback.mjs                  # 导一次(默认上限 500 行)
 *   node scripts/export-user-feedback.mjs --limit 50 --json
 *   node scripts/export-user-feedback.mjs --dry-run        # 只打印将要落盘的行,不写盘
 *   node scripts/export-user-feedback.mjs --self-test      # 自检(零真库、零网络)
 * 退出码:0 判定完成(含 0 行)/ 1 形状坏 / 2 未判定。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadConfig, readUserFeedback } from './auto-triage.mjs'
import { assertReadOnlySql, psqlSpawn, resolveDsn } from './check-learn-video-mount.mjs'
import { guardDbDsn, sanitizeDsn } from './lib/db-probe-client.mjs'
import { locatePsqlClient, psqlLocateMissText } from './lib/psql-client-locate.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP_ENV = join(ROOT, 'apps', 'api', '.env')

export const EXPORT_LIMIT_DEFAULT = 500
export const EXPORT_LIMIT_MAX = 5000
/** 单字段预算:适配器只用人读原文做证据(evidence 截 120 字),正文不必整段搬。 */
export const FIELD_CAP = 2000

export class ExportShapeError extends Error {}

/**
 * 只读单语句(过 `assertReadOnlySql` 的闸:SELECT 起手、无分号、无写/DDL 关键字)。
 * 为什么在 SQL 侧做三件事而不是全塞进程内:
 *  ① `regexp_replace` 折叠换行 —— `psql -At` 是行式输出,正文里一个换行就把一条反馈劈成两行;
 *  ② `|` 转 `%7C` —— `-At` 的字段分隔符就是 `|`(与 `buildApiLogsSql` 同一手,不另立编码);
 *  ③ `left(..., 2000)` —— 单行长度可预期,导出件不会因一条长正文膨胀。
 */
export function buildFeedbackExportSql(limit = EXPORT_LIMIT_DEFAULT) {
  const n = Number.isInteger(limit) && limit > 0 && limit <= EXPORT_LIMIT_MAX ? limit : EXPORT_LIMIT_DEFAULT
  return [
    'SELECT id,',
    'type,',
    'status,',
    "replace(regexp_replace(coalesce(title, ''), '[\\r\\n]+', ' ', 'g'), '|', '%7C'),",
    `left(replace(regexp_replace(coalesce(content, ''), '[\\r\\n]+', ' ', 'g'), '|', '%7C'), ${FIELD_CAP}),`,
    "to_char(created_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    'FROM feedbacks',
    "WHERE status NOT IN ('resolved', 'closed')",
    'ORDER BY created_at DESC',
    `LIMIT ${n}`,
  ].join(' ')
}

/**
 * `psql -At` 输出 → 导出行。
 * 末尾字段(时刻)取 `pop()`、中间字段按 `join('|')` 归并:即使某条正文漏了转义,也不会把
 * 后续字段整体错位读成别的列(错位比丢行更难查)。
 */
export function parseFeedbackRows(stdout) {
  const out = []
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    if (!line) continue
    const fields = line.split('|')
    if (fields.length < 6) continue
    const at = String(fields.pop() ?? '').trim()
    const id = fields.shift()
    const type = fields.shift()
    const status = fields.shift()
    const title = fields.shift()
    const content = fields.join('|')
    if (!id || !at) continue
    out.push({
      at,
      type: type || 'other',
      status: status || 'pending',
      title: title || '',
      content: content || '',
      id,
    })
  }
  return out
}

/** 导出件正文:一行一对象;0 行 ⇒ 空串(空文件也是"判过"的证据,不是缺件)。 */
export function renderExport(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return ''
  return `${list.map((r) => JSON.stringify(r)).join('\n')}\n`
}

/** 落盘路径:显式 `--jsonl` 优先,否则取分诊配置的 `userFeedback.jsonl`;皆空 ⇒ 形状坏。 */
export function resolveExportPath(cfg, override) {
  const raw = String(override ?? '').trim() || String(cfg?.userFeedback?.jsonl ?? '').trim()
  if (!raw) {
    throw new ExportShapeError('导出件路径为空(--jsonl 与 auto-triage-config.json 的 userFeedback.jsonl 皆空)')
  }
  return isAbsolute(raw) ? raw : resolve(ROOT, raw)
}

/** 原子写:先写同目录临时件再 rename,免得消费方读到半截 JSONL。 */
export function writeExportFile(path, rows, { dryRun = false } = {}) {
  const body = renderExport(rows)
  if (dryRun) return { written: false, dryRun: true, bytes: Buffer.byteLength(body, 'utf8') }
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, path)
  return { written: true, dryRun: false, bytes: Buffer.byteLength(body, 'utf8') }
}

/**
 * 取数(注入面齐全:locate / spawn / readFile / argvDsn 皆可替身,自查与测试都不碰真库)。
 * 任一面取不到 ⇒ `undetermined` + 点名理由,绝不回落成 0 行。
 */
export function collectFeedback({
  limit = EXPORT_LIMIT_DEFAULT,
  readFile = (p) => readFileSync(p, 'utf8'),
  locate = locatePsqlClient,
  spawn = psqlSpawn,
  argvDsn = '',
  processEnv = process.env,
} = {}) {
  const located = locate() ?? {}
  if (!located.psql) {
    return { status: 'undetermined', why: psqlLocateMissText(located.tried ?? []) }
  }
  let envText = ''
  try {
    envText = readFile(APP_ENV)
  } catch {
    envText = ''
  }
  const dsnRes = resolveDsn({ argvDsn, envText, processEnv })
  if (!dsnRes.ok) return { status: 'undetermined', why: dsnRes.why }
  const guarded = guardDbDsn(dsnRes.dsn)
  if (!guarded.ok) return { status: 'undetermined', why: guarded.why }

  const sql = buildFeedbackExportSql(limit)
  let r
  try {
    r = spawn(located.psql, guarded.dsn, sql)
  } catch (e) {
    return { status: 'undetermined', why: `feedbacks 只读查询不可发:${e?.message ?? e}`, target: sanitizeDsn(guarded.dsn) }
  }
  if (r?.status !== 0) {
    // psql 的 stderr 已被上游 `redactChildOutput` 脱敏(命中凭据关键词的整行只留键名),
    // 所以诊断里**必须**同时带机器可读的退出码,否则"脱敏过度"会把理由吃成不可处置的一句。
    const detail = String(r?.stderr || r?.lost || `exit ${r?.status}`).trim().slice(0, 200)
    return { status: 'undetermined', why: `feedbacks 只读查询失败(psql exit ${r?.status ?? 'null'}):${detail}`, target: sanitizeDsn(guarded.dsn) }
  }
  return {
    status: 'ok',
    rows: parseFeedbackRows(r.stdout),
    target: sanitizeDsn(guarded.dsn),
    dsnSource: dsnRes.source,
    sql,
  }
}

/** 陈旧导出件的处置:未判定时清掉(派生件,可重生成),否则消费方会拿旧读数当好读数。 */
export function quarantineStale(path, { keepStale = false } = {}) {
  if (keepStale) return { removed: false, why: '--keep-stale:保留陈旧导出件' }
  if (!existsSync(path)) return { removed: false, why: '无陈旧导出件' }
  let size = 0
  try {
    size = statSync(path).size
  } catch {
    size = -1
  }
  try {
    rmSync(path, { force: true })
    return { removed: true, why: `已清除陈旧导出件(${size} 字节;消费方须落未判定,不得沿用旧读数)` }
  } catch (e) {
    return { removed: false, why: `陈旧导出件清除失败:${e?.message ?? e}` }
  }
}

/**
 * 一次完整导出。返回 { rc, status, path, rows, lines } —— CLI 只管打印与 process.exitCode。
 * rc 口径:0 判定完成(含 0 行)/ 1 形状坏 / 2 未判定。
 */
export function runExport({
  argv = [],
  dryRun = false,
  readFile = (p) => readFileSync(p, 'utf8'),
  locate = locatePsqlClient,
  spawn = psqlSpawn,
  processEnv = process.env,
  write = writeExportFile,
  loadCfg = loadConfig,
} = {}) {
  const limitFlag = requireFlagValue(argv, '--limit', { noun: '正整数' })
  if (limitFlag.error) throw new ExportShapeError(limitFlag.error)
  const limit = limitFlag.present ? Number(limitFlag.value) : EXPORT_LIMIT_DEFAULT
  if (!Number.isInteger(limit) || limit <= 0 || limit > EXPORT_LIMIT_MAX) {
    throw new ExportShapeError(`--limit 必须是 1..${EXPORT_LIMIT_MAX} 的整数(实得 ${limitFlag.value})`)
  }
  const jsonlFlag = requireFlagValue(argv, '--jsonl', { noun: '导出件路径' })
  if (jsonlFlag.error) throw new ExportShapeError(jsonlFlag.error)
  const dsnFlag = requireFlagValue(argv, '--dsn', { noun: 'DSN' })
  if (dsnFlag.error) throw new ExportShapeError(dsnFlag.error)

  const path = resolveExportPath(loadCfg(), jsonlFlag.value)
  const isDry = dryRun || argv.includes('--dry-run')
  const got = collectFeedback({ limit, readFile, locate, spawn, argvDsn: dsnFlag.value ?? '', processEnv })

  const lines = [`取数面:${got.target ? `psql → ${got.target}` : 'psql 未定位到连接面'}`]
  if (got.status !== 'ok') {
    const stale = quarantineStale(path, { keepStale: argv.includes('--keep-stale') })
    lines.push(`❌ 未判定(rc 2):${got.why}`)
    lines.push('   ⇒ 不写导出件;消费方(auto-triage readUserFeedback)本轮必须落「未判定」,不得当成「无发现」')
    lines.push(`   陈旧件处置:${stale.why}`)
    return { rc: 2, status: 'undetermined', why: got.why, path, rows: [], lines }
  }

  const rows = got.rows ?? []
  const w = write(path, rows, { dryRun: isDry })
  lines.push(`判定:ok —— 未结反馈 ${rows.length} 条${w.dryRun ? '(dry-run,未落盘)' : `,已落盘 ${w.bytes} 字节`}`)
  if (rows.length === 0) {
    lines.push('   0 条是**判过**(查询成功证明该库该表零条未结反馈),不是未判定;空文件同样是判过的留痕')
    lines.push('   ⚠ 本器只连回环库(guardDbDsn 拒 8810 生产隧道):0 行只证明**本库**为空,不等于产品面无反馈')
  }
  lines.push(`   落盘路径:${path}`)
  lines.push('   消费面:scripts/auto-triage.mjs 的 readUserFeedback(同一份分诊配置的同一路径,无需二次接线)')
  return { rc: 0, status: 'ok', path, rows, bytes: w.bytes, dryRun: w.dryRun, lines }
}

/** 自检:九条判据,零真库、零网络、零对盘上既有导出件的改动。 */
export function selfTest() {
  const { t, report } = makeRegistrar()
  const scratch = mkScratch('export-user-feedback')
  const dsnEnv = 'DATABASE_URL=postgresql://u:p@localhost:5432/ihui\n'
  const fakeLocate = () => ({ psql: 'psql-stub', tried: ['stub'] })
  const fakeSpawn = (stdout) => () => ({ status: 0, stdout, stderr: '', lost: '' })
  const readEnv = () => dsnEnv
  let res

  try {
    // ① SQL 形状:过只读闸;写语句/多语句必须被同一把尺真抛(不抛 ⇒ 这道锁是纸的)
    t('① SQL 是单语句只读(LIMIT 生效)', () => {
      const sql = buildFeedbackExportSql(10)
      assertReadOnlySql(sql)
      let threwOnWrite = false
      try {
        assertReadOnlySql(`${sql} DELETE FROM feedbacks`)
      } catch {
        threwOnWrite = true
      }
      return threwOnWrite && /^SELECT\b/.test(sql) && !sql.includes(';') && /LIMIT 10$/.test(sql) && sql.includes("status NOT IN ('resolved', 'closed')")
    })
    t('①b LIMIT 越界回落默认值,不拼进 SQL', () => {
      const bad = buildFeedbackExportSql(0)
      return /LIMIT 500$/.test(bad) && /LIMIT 500$/.test(buildFeedbackExportSql(999999))
    })

    // ② 解析:CRLF / 换行归一 / 坏行丢弃 / 多余分隔符归并
    t('② 解析 CRLF 与多余分隔符', () => {
      const stdout = 'id1|bug|pending|标题|正文|2026-10-28T01:02:03.004Z\r\nbad-line\r\nid2|feature|reviewing|t|a|b|2026-10-27T00:00:00.000Z\r\n'
      const rows = parseFeedbackRows(stdout)
      return rows.length === 2 && rows[0].id === 'id1' && rows[1].content === 'a|b' && rows[1].at === '2026-10-27T00:00:00.000Z'
    })

    // ③ 渲染:JSONL,0 行 ⇒ 空串
    t('③ 0 行渲染成空串(空文件=判过,不是缺件)', () => renderExport([]) === '' && renderExport([{ at: 'x' }]).endsWith('\n'))

    // ④ 与消费方兼容:导出的行必须能被 auto-triage.readUserFeedback 真吃进去
    t('④ 导出件被 readUserFeedback 读成 ok/记录', () => {
      const p = join(scratch, 'compat.jsonl')
      writeFileSync(p, renderExport([
        { at: '2026-10-28T01:00:00.000Z', type: 'bug', status: 'pending', title: '导出失败', content: '报表打不开', id: 'a' },
        { at: '2026-10-28T02:00:00.000Z', type: 'bug', status: 'resolved', title: '已修', content: 'x', id: 'b' },
      ]), 'utf8')
      const read = readUserFeedback({ jsonlPath: p })
      return read.status === 'ok' && read.records.length === 1 && read.records[0].label.startsWith('bug:导出失败')
    })

    // ⑤ 0 行 ⇒ ok(rc 0),不是未判定
    t('⑤ 查询成功 0 行 ⇒ rc 0(判过)', () => {
      const p = join(scratch, 'zero.jsonl')
      const r = runExport({ argv: ['--jsonl', p], readFile: readEnv, locate: fakeLocate, spawn: fakeSpawn(''), processEnv: {} })
      return r.rc === 0 && r.rows.length === 0 && existsSync(p) && readFileSync(p, 'utf8') === ''
    })

    // ⑥ 查询失败 ⇒ rc 2,且不写件、清掉陈旧件(旧读数不得冒充本轮读数)
    t('⑥ 查询失败 ⇒ rc 2 + 清陈旧件 + 不写空件', () => {
      const p = join(scratch, 'stale.jsonl')
      writeFileSync(p, '{"at":"2026-10-27T00:00:00.000Z","type":"bug","status":"pending","title":"旧","content":"旧","id":"old"}\n', 'utf8')
      const r = runExport({
        argv: ['--jsonl', p], readFile: readEnv, locate: fakeLocate,
        spawn: () => ({ status: 1, stdout: '', stderr: 'relation "feedbacks" does not exist', lost: '' }),
        processEnv: {},
      })
      return r.rc === 2 && r.status === 'undetermined' && !existsSync(p) && r.lines.some((l) => /未判定/.test(l))
    })

    // ⑦ psql 缺席 ⇒ 未判定并点名(不把"定位失败"读成"没有反馈")
    t('⑦ psql 缺席 ⇒ 未判定且点名', () => {
      const p = join(scratch, 'nopsql.jsonl')
      const r = runExport({ argv: ['--jsonl', p], readFile: readEnv, locate: () => ({ psql: '', tried: ['stub'] }), spawn: fakeSpawn(''), processEnv: {} })
      return r.rc === 2 && /psql/.test(r.why)
    })

    // ⑧ 生产口/非回环 DSN ⇒ 守卫拒绝(取证不得连生产库)
    t('⑧ 8810 / 非回环 DSN ⇒ 守卫拒绝', () => {
      const p = join(scratch, 'guard.jsonl')
      const r8810 = runExport({ argv: ['--jsonl', p, '--dsn', 'postgresql://u:p@localhost:8810/ihui'], readFile: readEnv, locate: fakeLocate, spawn: fakeSpawn(''), processEnv: {} })
      const rRemote = runExport({ argv: ['--jsonl', p, '--dsn', 'postgresql://u:p@10.0.0.9:5432/ihui'], readFile: readEnv, locate: fakeLocate, spawn: fakeSpawn(''), processEnv: {} })
      return r8810.rc === 2 && /8810/.test(r8810.why) && rRemote.rc === 2 && /回环/.test(rRemote.why)
    })

    // ⑨ 路径与 dry-run:配置缺省路径可解析;dry-run 不落盘
    t('⑨ 路径来自同一份分诊配置 / dry-run 不落盘', () => {
      const cfg = loadConfig()
      const configured = resolveExportPath(cfg, '')
      const p = join(scratch, 'dry.jsonl')
      const r = runExport({ argv: ['--jsonl', p, '--dry-run'], readFile: readEnv, locate: fakeLocate, spawn: fakeSpawn('id1|bug|pending|t|c|2026-10-28T01:00:00.000Z\n'), processEnv: {} })
      return configured.endsWith(join('.ihui-agent', 'state', 'user-feedback-export.jsonl')) && r.rc === 0 && r.rows.length === 1 && !existsSync(p)
    })
    // thunk 只在 report() 的消费循环里求值,故结账必须发生在 rmScratch **之前**
    // (先 cleanup 再 report 拿到的是空目录上的读数、账面记绿 —— selftest-registrant 头注那条坑)。
    res = report()
  } finally {
    rmScratch(scratch)
  }

  console.log('export-user-feedback 自检')
  for (const c of res.cases) console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— ${c.got}`}`)
  console.log(`  结果:${res.pass} 通过 / ${res.fail} 失败`)
  return res.fail === 0 ? 0 : 1
}

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法:node scripts/export-user-feedback.mjs [--limit N] [--jsonl PATH] [--dsn DSN] [--dry-run] [--json] [--keep-stale] [--self-test]')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  let out
  try {
    out = runExport({ argv, dryRun: argv.includes('--dry-run') })
  } catch (e) {
    if (e instanceof ExportShapeError) {
      console.error(`❌ 形状坏(rc 1):${e.message}`)
      return 1
    }
    throw e
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ rc: out.rc, status: out.status, path: out.path, count: out.rows.length, why: out.why ?? '', bytes: out.bytes ?? 0 }, null, 2))
  } else {
    console.log('user-feedback 导出件生产者')
    for (const l of out.lines) console.log(l)
  }
  return out.rc
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((rc) => {
      process.exitCode = rc
    })
    .catch((e) => {
      console.error(`❌ 未判定(rc 2):${e?.message ?? e}`)
      process.exitCode = 2
    })
}

export const __test__ = {
  EXPORT_LIMIT_DEFAULT,
  EXPORT_LIMIT_MAX,
  FIELD_CAP,
  ExportShapeError,
  buildFeedbackExportSql,
  parseFeedbackRows,
  renderExport,
  resolveExportPath,
  writeExportFile,
  collectFeedback,
  quarantineStale,
  runExport,
  selfTest,
}
