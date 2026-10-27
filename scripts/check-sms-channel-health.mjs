#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-sms-channel-health.mjs — 短信发送通道健康「只读哨兵」(判机器状态,不进提交链)。
 *
 * 立因(2026-10-27 本机实测):阿里云短信因账户欠费(可用余额 -20.90)停机,11:41 的投递
 * 记录仍是 OUT_OF_SERVICE,直到 12:59 才恢复 —— 期间用户拿不到登录验证码,而**全仓没有
 * 任何一道门喊过**:判据只在发送侧被动判"发没发出去"(`apps/api/src/services/sms.ts`
 * judgeAliyunResponse 已经把欠费判成 sent:false 并落进 sms_delivery_logs.reason),
 * 但那张表只有 admin 报表在读,没有任何告警判据看过它。
 *
 * 本尺子只吃本地观测面(投递审计表),不碰任何云端接口、不需要任何新凭据 —— 欠费这件事
 * 在发送回包里已经落表了,再引一路云 API 只是多一个会缺权限的失败点。
 *
 * 三态判据(AGENTS §0.3:取不到输入必须显式「未判定」,既不记绿也不冒红):
 *   breach   ① 近 1 小时有发送尝试、**零成功**、且失败原因命中停机/云侧裁决族
 *              (OUT_OF_SERVICE / isv.* / BUSINESS_LIMIT / SIGN / TEMPLATE);
 *            ② 近 24 小时有发送尝试但**零成功**(通道整体不出量)。
 *   ok       近 24 小时有 accepted/delivered。
 *   unjudged 连不到库、驱动不可解析、查询失败,或窗口内**一条尝试都没有**
 *            (「没人发过」判不出通道好坏,不能写成健康)。
 *
 * 口径细节:
 *   - `suppressed`(营销关闭/重复/退订)**不是通道故障**,一律不计入尝试;把它算成失败
 *     就等于让一次重复点击把整条通道报红(恒红门的典型成因而非信号)。
 *   - 表字段:packages/database/src/schema/sms-delivery.ts(status/reason/created_at)。
 *
 * 用法:
 *   node scripts/check-sms-channel-health.mjs            # 人读
 *   node scripts/check-sms-channel-health.mjs --json     # 机器读(git-guardian 巡检轮)
 *   node scripts/check-sms-channel-health.mjs --self-test
 * 退出码:0 ok / 1 breach / 2 unjudged。
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 停机/云侧裁决族:命中才算"通道被云判死",不是普通参数错。 */
const BREACH_REASON = /OUT_OF_SERVICE|isv\.|BUSINESS_LIMIT|SIGN|TEMPLATE|busi/i

/** 计入"发送尝试"的状态;suppressed 是业务侧主动不发,不算通道健康信号。 */
const ATTEMPT_STATUSES = new Set(['accepted', 'failed', 'delivered', 'delivery_failed'])
const SUCCESS_STATUSES = new Set(['accepted', 'delivered'])

const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS

/**
 * 纯判据:给一批 24h 内的投递行,判三态。IO 一律在调用方(镜像测试直接喂构造数据)。
 * @param {{ rows: Array<{ status: string, reason?: string|null, createdAt: Date|string }>, now?: Date }} input
 * @returns {{ verdict: 'ok'|'breach'|'unjudged', detail: string, attempts: number, success: number, lastHourAttempts: number }}
 */
export function judgeSmsChannelHealth({ rows, now = new Date() }) {
  const nowMs = now.getTime()
  const norm = (rows ?? [])
    .map((r) => ({
      status: String(r.status ?? ''),
      reason: typeof r.reason === 'string' ? r.reason : '',
      at: new Date(r.createdAt).getTime(),
    }))
    .filter((r) => Number.isFinite(r.at) && nowMs - r.at <= DAY_MS && r.at <= nowMs + 60_000)

  const attempts = norm.filter((r) => ATTEMPT_STATUSES.has(r.status))
  const success = attempts.filter((r) => SUCCESS_STATUSES.has(r.status))
  const lastHour = attempts.filter((r) => nowMs - r.at <= HOUR_MS)
  const base = { attempts: attempts.length, success: success.length, lastHourAttempts: lastHour.length }

  if (attempts.length === 0) {
    return {
      verdict: 'unjudged',
      detail: `近 24h 没有任何发送尝试(${norm.length} 行均为 suppressed/未知态)⇒ 判不出通道好坏`,
      ...base,
    }
  }
  if (success.length > 0) {
    return {
      verdict: 'ok',
      detail: `近 24h 尝试 ${attempts.length} 次,成功 ${success.length} 次`,
      ...base,
    }
  }
  // 到这里 = 24h 内零成功
  const breachInLastHour = lastHour.filter((r) => BREACH_REASON.test(r.reason))
  if (breachInLastHour.length > 0) {
    return {
      verdict: 'breach',
      detail:
        `近 1h 内 ${lastHour.length} 次尝试全部失败,其中 ${breachInLastHour.length} 次命中停机/云侧裁决族` +
        `(示例 reason=${breachInLastHour[0].reason || '(空)'})`,
      ...base,
    }
  }
  return {
    verdict: 'breach',
    detail: `近 24h 尝试 ${attempts.length} 次、零成功(通道整体不出量)`,
    ...base,
  }
}

/**
 * 解析 postgres 驱动:根 node_modules 里同名目录是 pnpm 隔离式链接的残留,真包在 apps/api 下
 * ⇒ 必须显式从那儿 resolve(与 scripts/check-analytics-page-coverage.mjs 同一取材口径)。
 */
async function loadPostgres() {
  try {
    const req = createRequire(join(ROOT, 'apps/api/package.json'))
    const mod = await import(pathToFileURL(req.resolve('postgres')).href)
    return mod.default ?? mod
  } catch {
    try {
      const mod = await import('postgres')
      return mod.default ?? mod
    } catch {
      return null
    }
  }
}

/**
 * 取 DSN:process.env 优先;缺失时回落读 `apps/api/.env` 的同名键 ——
 * 这是 git-guardian 自己的既有口径(见其 ALERT_EMAIL_TO 那段:守护进程没有业务 env,
 * 但需要的那一两个键可以从工作树的 .env 只读取)。只读,绝不写回;取值不打印。
 */
function resolveDatabaseUrl() {
  const fromEnv = String(process.env.DATABASE_URL || '').trim()
  if (fromEnv) return { url: fromEnv, from: 'env' }
  try {
    for (const line of readFileSync(join(ROOT, 'apps/api/.env'), 'utf8').split(/\r?\n/)) {
      const m = /^DATABASE_URL\s*=\s*(.+)$/.exec(line.trim())
      if (m) return { url: m[1].replace(/^["']|["']$/g, '').trim(), from: 'apps/api/.env' }
    }
  } catch {
    // 读不到就交给调用方判「未判定」
  }
  return { url: '', from: null }
}

/** 观测面:近 24h 投递行。取不到 ⇒ null(交调用方判「未判定」,不回落成空集)。 */
async function fetchRows() {
  const { url, from } = resolveDatabaseUrl()
  if (!url) return { rows: null, why: 'DATABASE_URL 取不到(process.env 与 apps/api/.env 两处都没有)' }
  const postgres = await loadPostgres()
  if (!postgres) {
    return { rows: null, why: `postgres 驱动不可解析(根与 apps/api 两处都取不到;DSN 来源=${from})` }
  }
  let sql
  try {
    sql = postgres(url, { max: 1, connect_timeout: 5 })
    const rows = await sql`
      select status, reason, created_at
      from sms_delivery_logs
      where created_at >= now() - interval '24 hours'
      order by created_at desc
      limit 5000
    `
    return { rows: rows.map((r) => ({ status: r.status, reason: r.reason, createdAt: r.created_at })) }
  } catch (e) {
    return { rows: null, why: `查询失败:${e instanceof Error ? e.message : String(e)}` }
  } finally {
    if (sql) await sql.end({ timeout: 5 }).catch(() => {})
  }
}

function selfTest() {
  const now = new Date('2026-10-27T05:00:00Z')
  const at = (minAgo) => new Date(now.getTime() - minAgo * 60_000)
  const cases = [
    {
      name: '停机族:1h 内全失败且命中 OUT_OF_SERVICE ⇒ breach',
      rows: [
        { status: 'failed', reason: 'isv.OUT_OF_SERVICE', createdAt: at(10) },
        { status: 'failed', reason: 'isv.OUT_OF_SERVICE', createdAt: at(20) },
      ],
      want: 'breach',
    },
    {
      name: '24h 零成功但失败原因与通道无关(参数错)⇒ 仍 breach(整体不出量)',
      rows: [{ status: 'failed', reason: 'MOBILE_NOT_LEGAL', createdAt: at(180) }],
      want: 'breach',
    },
    {
      name: '有成功 ⇒ ok(哪怕同时有失败)',
      rows: [
        { status: 'failed', reason: 'isv.OUT_OF_SERVICE', createdAt: at(30) },
        { status: 'accepted', reason: null, createdAt: at(25) },
      ],
      want: 'ok',
    },
    {
      name: '只有 suppressed ⇒ unjudged(业务主动不发不是通道故障)',
      rows: [
        { status: 'suppressed', reason: 'duplicate', createdAt: at(5) },
        { status: 'suppressed', reason: 'marketing_disabled', createdAt: at(6) },
      ],
      want: 'unjudged',
    },
    {
      name: '窗口内一条都没有 ⇒ unjudged(没人发过不等于通道健康)',
      rows: [],
      want: 'unjudged',
    },
    {
      name: '超 24h 的行不参与判定 ⇒ unjudged',
      rows: [{ status: 'failed', reason: 'isv.OUT_OF_SERVICE', createdAt: at(24 * 60 + 5) }],
      want: 'unjudged',
    },
    {
      name: 'delivered 也算成功(回执态)',
      rows: [{ status: 'delivered', reason: null, createdAt: at(40) }],
      want: 'ok',
    },
    {
      name: '1h 内有失败但 24h 内另有成功 ⇒ ok(不要把单次抖动报成通道死亡)',
      rows: [
        { status: 'failed', reason: 'isv.BUSINESS_LIMIT_CONTROL', createdAt: at(3) },
        { status: 'accepted', reason: null, createdAt: at(600) },
      ],
      want: 'ok',
    },
  ]
  let failed = 0
  for (const c of cases) {
    const r = judgeSmsChannelHealth({ rows: c.rows, now })
    const ok = r.verdict === c.want
    if (!ok) failed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} —— want=${c.want} got=${r.verdict}(${r.detail})`)
  }
  console.log(`\nself-test: pass ${cases.length - failed} / fail ${failed} (共 ${cases.length} 例)`)
  return failed === 0
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1
  const json = argv.includes('--json')
  const { rows, why } = await fetchRows()
  const result = rows === null
    ? { verdict: 'unjudged', detail: why ?? '观测面取不到', attempts: 0, success: 0, lastHourAttempts: 0 }
    : judgeSmsChannelHealth({ rows })
  if (json) {
    process.stdout.write(`${JSON.stringify({ ...result, at: new Date().toISOString() })}\n`)
  } else {
    const icon = result.verdict === 'ok' ? '✅' : result.verdict === 'breach' ? '❌' : '⚠️'
    console.log(`${icon} 短信通道 ${result.verdict}:${result.detail}`)
    console.log(`   近 24h 尝试=${result.attempts} 成功=${result.success};近 1h 尝试=${result.lastHourAttempts}`)
    if (result.verdict === 'breach') {
      console.log('   出路:去阿里云费用中心充值 / 购买短信套餐包,然后确认 sender 恢复;这是唯一能让尺子转绿的整改动作')
    }
  }
  return result.verdict === 'ok' ? 0 : result.verdict === 'breach' ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ check-sms-channel-health 自身异常:${e?.message ?? e}`)
      process.exitCode = 2
    })
}

export const __test__ = { judgeSmsChannelHealth, BREACH_REASON, ATTEMPT_STATUSES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
