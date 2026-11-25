// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 单行 JSON 落 stdout,告警落 stderr */
/**
 * 审计策略哨兵 + 补齐器(第十八件,2026-11-26 立)。
 *
 * 为什么立:凌晨账号锁定事故取证时现读 `auditpol /get /category:*` ——
 * 60 条子类里 40 条 No Auditing、5 条只有 Success;Credential Validation(923F)、
 * Sensitive Privilege Use(9228)、Security System Extension(9211)、MPSSVC Rule-Level(9232)
 * 全盲。审计策略是取证链的地基:策略一关,下游哨兵读到的都是「空窗」,会判绿(§0.3 假绿)。
 *
 * 判据全在 lib/audit-policy.mjs(纯函数),本层只做三件事:
 *   ① 跑 auditpol 取 CSV(经 PowerShell + chcp 65001,规避 OEM 码页);
 *   ② 交纯函数判分(−>critical 缺失即 breach / standard 只记观察);
 *   ③ --apply 档:先把现状全文备份进 state/,再逐条 /set 补齐,然后**重读自证**。
 *
 * 刻意不写成提交链阻断门(与 check-account-lockout / check-scheduler-health 同口径):
 * 审计策略是本机运行时状态,存量可能长期缺项;设成阻断门只会逼人 --no-verify(§12e)。
 *
 * 退出码: 0 ok | 1 breach | 2 undetermined(策略取不到)
 * 用法:
 *   node scripts/security/check-audit-policy.mjs                 # 人读
 *   node scripts/security/check-audit-policy.mjs --json          # 单行 JSON
 *   node scripts/security/check-audit-policy.mjs --apply         # 补齐缺失项并自证
 *   node scripts/security/check-audit-policy.mjs --apply --include-standard
 *   node scripts/security/check-audit-policy.mjs --alert         # breach 时发信
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  AUDIT_POLICY_STATE,
  buildAuditSetCommands,
  judgeAuditPolicy,
  parseAuditPolicyCsv,
  remediationForAuditPolicy,
} from './lib/audit-policy.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const LEDGER = join(STATE_DIR, 'audit-policy.jsonl')
const NOTIFY = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')

/** 显式 stdio:门 193 要求派生进程写清三根管道。 */
function run(file, args, timeoutMs) {
  return String(
    execFileSync(file, args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) || '',
  )
}

/**
 * 取审计策略全文。
 * `auditpol` 走管道时按 OEM 码页(本机 936)写中文,所以先 chcp 65001;
 * 取不到 ⇒ fetchError ⇒ 下游判 undetermined,不冒绿。
 * 导出给 check-account-lockout.mjs 复用(空窗降档要问「审计策略是否真的在记」)——只此一份实现。
 */
export function readAuditPolicy() {
  if (process.platform !== 'win32') {
    return { csv: null, fetchError: `非 Windows 平台(${process.platform})无 auditpol` }
  }
  const script = ['chcp 65001 >$null', 'auditpol /get /category:* /r'].join('\n')
  try {
    const out = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 60_000)
    if (!out.trim()) return { csv: null, fetchError: 'auditpol 无输出(策略不可读或命令被挡)' }
    return { csv: out, fetchError: null }
  } catch (e) {
    return { csv: null, fetchError: `auditpol 调用失败: ${String(e?.message || e).split(/\r?\n/)[0]}` }
  }
}

/** 逐条 /set(经 PowerShell,与读同一码页面)。返回 { applied, failed:[{guid,error}] }。
 * 每个参数都必须包单引号:PowerShell 里 `{GUID}` 的花括号会被当 ScriptBlock 起始,
 * 不加引号整条命令语法错误(实测 --apply 全失败的唯一成因,2026-11-26)。 */
function applySet(commands) {
  const applied = []
  const failed = []
  for (const argv of commands) {
    const psLine = `auditpol ${argv.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(' ')}`
    try {
      const out = run(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', `chcp 65001 >$null\n${psLine}`],
        30_000,
      )
      if (/successfully|成功/i.test(out) || out.trim() === '') {
        applied.push(argv[1])
      } else {
        failed.push({ guid: argv[1], error: out.trim().split(/\r?\n/).pop() || '无回执' })
      }
    } catch (e) {
      failed.push({ guid: argv[1], error: String(e?.message || e).split(/\r?\n/)[0] })
    }
  }
  return { applied, failed }
}

function appendLedger(row) {
  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify(row)}\n`, 'utf8')
}

function sendAlert(result, remediation) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const body = [
    `审计策略哨兵: ${result.state}`,
    '',
    result.reason,
    '',
    '缺失项(前 8):',
    ...result.missing.slice(0, 8).map((m) => `  [${m.level}] ${m.name} — ${m.why} (现在:${m.setting} / 缺 ${m.missingSide})`),
    '',
    '下一步:',
    ...remediation.map((s) => `  ${s}`),
  ].join('\n')
  try {
    const out = execFileSync(
      process.execPath,
      [
        tsx,
        NOTIFY,
        '--subject',
        `[IHUI 审计策略] ${result.state} — 关键缺失 ${result.critical.length} 条`,
        '--message',
        body,
        '--alert-id',
        `audit-policy-${result.state}`,
        '--dedupe-hours',
        '6',
      ],
      {
        cwd: join(ROOT, 'apps', 'api'),
        encoding: 'utf8',
        timeout: 120_000,
        windowsHide: true,
        maxBuffer: 8 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    console.error(`   --alert:已投递 ${String(out).trim().split(/\r?\n/).slice(-1)[0] || ''}`)
  } catch (e) {
    console.error(`   --alert:投递失败 ${String(e?.message || e).split(/\r?\n/)[0]}`)
  }
}

function judge(csv, includeStandard, fetchError = null) {
  const rows = csv === null ? null : parseAuditPolicyCsv(csv)
  return judgeAuditPolicy({
    rows,
    fetchError: csv === null ? fetchError || 'auditpol 取不到' : null,
    includeStandard,
  })
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json')
  const alert = argv.includes('--alert')
  const apply = argv.includes('--apply')
  const includeStandard = argv.includes('--include-standard')

  const first = readAuditPolicy()
  let result = judge(first.csv, includeStandard, first.fetchError)
  let appliedInfo = null

  if (apply && result.state === AUDIT_POLICY_STATE.BREACH) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = join(STATE_DIR, `audit-policy-before-${stamp}.csv`)
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(backup, first.csv ?? '', 'utf8')
    const targets = includeStandard ? result.missing : result.critical
    const setResult = applySet(buildAuditSetCommands(targets))
    /* 重读自证:补齐后必须重判,不允许用「命令回执成功」冒充生效。 */
    const second = readAuditPolicy()
    result = judge(second.csv, includeStandard, second.fetchError)
    appliedInfo = { backup, applied: setResult.applied.length, failed: setResult.failed, rejudged: true }
  }

  const remediation = remediationForAuditPolicy(result)

  appendLedger({
    at: new Date().toISOString(),
    state: result.state,
    checkedCount: result.checkedCount,
    bothCount: result.bothCount,
    criticalMissing: result.critical.map((m) => m.name),
    standardMissing: result.standard.map((m) => m.name),
    applied: appliedInfo,
    reason: result.reason,
  })

  if (json) {
    console.log(
      JSON.stringify({
        state: result.state,
        reason: result.reason,
        checkedCount: result.checkedCount,
        bothCount: result.bothCount,
        missing: result.missing,
        critical: result.critical,
        standard: result.standard,
        observations: result.observations,
        applied: appliedInfo,
        remediation,
      }),
    )
  } else {
    const mark = result.state === 'ok' ? '✓' : result.state === 'breach' ? '✗' : '?'
    console.log(`${mark} ${result.state} — ${result.reason}`)
    console.log(`   关键子类 ${result.bothCount}/${result.checkedCount} 已双开`)
    for (const m of result.missing.slice(0, 12)) {
      console.log(`   [${m.level}] ${m.name} — 缺${m.missingSide}(现在:${m.setting})→ ${m.why}`)
    }
    if (result.missing.length > 12) console.log(`   … 其余 ${result.missing.length - 12} 条见 --json`)
    for (const o of result.observations) console.log(`   · ${o}`)
    if (appliedInfo) {
      console.log(`   已补齐 ${appliedInfo.applied} 条(改前备份 ${appliedInfo.backup})`)
      if (appliedInfo.failed.length) {
        console.log(`   补齐失败 ${appliedInfo.failed.length} 条:${appliedInfo.failed.map((f) => f.guid).join(' ')}`)
      }
    }
    for (const s of remediation) console.log(`   → ${s}`)
  }

  if (alert && result.state !== AUDIT_POLICY_STATE.OK) sendAlert(result, remediation)
  if (alert) return 0
  if (result.state === AUDIT_POLICY_STATE.OK) return 0
  if (result.state === AUDIT_POLICY_STATE.BREACH) return 1
  return 2
}

const IS_MAIN = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-audit-policy.mjs')
if (IS_MAIN) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
