// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产一致性哨兵(2026-11-25 立)。
 *
 * 回答一个问题:**跑在 Windows 服务里的那份 router,现在是不是 HEAD 里那份?**
 * 2026-11-24 的静默回滚证明这个问题没人问就一定会出 —— 服务状态是 RUNNING,
 * 内容却是旧版,四面自证只在"人恰好去跑"的那一刻才看得见。
 *
 * 用法:
 *   node scripts/security/check-prod-parity.mjs               # 人读
 *   node scripts/security/check-prod-parity.mjs --json        # 机器读(挂 tick 用这个)
 *   node scripts/security/check-prod-parity.mjs --probe       # 附带四面自证(会打真实请求)
 *   node scripts/security/check-prod-parity.mjs --alert       # drift 时经邮件通道告警
 *
 * 退出码:0=ok / 1=drift / 2=undetermined(取不到输入,**不是通过**)。
 * 只读:本脚本绝不写生产目录、不重启服务 —— 修复走 sync-prod-parity.mjs --apply。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { PROD_PARITY_FILES, PARITY_STATE, judgeParity, classifyDrift, remediationFor } from './lib/prod-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const PROD_ROOT = process.env.IHUI_PROD_ROOT ? resolve(process.env.IHUI_PROD_ROOT) : 'D:\\DevEnv\\ihui-prod'

function git(args, opts = {}) {
  // §5b:派生 git 必须显式接管 stdio(不写时本机实测 0/30 成功并抛 EBUSY);门 [193] 按此判。
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 22,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim()
}

/** HEAD blob 的 sha;取不到返回 null(不抛 —— 抛了就把"未判定"变成"崩溃")。 */
export function headBlobSha(relPath) {
  try {
    return git(['rev-parse', `HEAD:${relPath}`]) || null
  } catch {
    return null
  }
}

/** 生产副本的 sha;文件不存在返回 null。`--no-filters` 防止 eol 规则把磁盘内容改写后再算。 */
export function prodBlobSha(absPath) {
  if (!existsSync(absPath)) return null
  try {
    return git(['hash-object', '--no-filters', absPath]) || null
  } catch {
    return null
  }
}

export function collectRows(prodRoot = PROD_ROOT) {
  return PROD_PARITY_FILES.map((rel) => ({
    path: rel,
    head: headBlobSha(rel),
    prod: prodBlobSha(join(prodRoot, rel.replaceAll('/', '\\'))),
  }))
}

function runProbe() {
  const script = join(HERE, 'verify-notice.mjs')
  if (!existsSync(script)) return { state: 'undetermined', code: 2, tail: 'verify-notice.mjs 不存在' }
  const r = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  const tail = String(r.stdout ?? '').trim().split(/\r?\n/).slice(-1).join(' | ')
  const code = r.status ?? 2
  return { state: code === 0 ? 'ok' : code === 1 ? 'drift' : 'undetermined', code, tail }
}

/**
 * 告警:经唯一邮件出口(§5e:禁止自拼 SMTP)。
 * `--alert-id` 用稳定身份(类别),不拼件数/时刻 —— 拼了等于每轮换一次身份,去重结构上永不命中。
 */
function sendAlert(verdict) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const script = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
  if (!existsSync(tsx) || !existsSync(script)) return { ok: false, reason: 'tsx 或通知脚本不在位(未判定)' }

  const { missing, differing } = classifyDrift(verdict.drift)
  const lines = [
    `生产副本与 HEAD 不一致:${verdict.reason}`,
    '',
    ...(missing.length ? [`生产缺失(${missing.length}):`, ...missing.map((p) => `  - ${p}`), ''] : []),
    ...(differing.length ? [`内容不同(${differing.length}):`, ...differing.map((p) => `  - ${p}`), ''] : []),
    remediationFor(verdict.state, verdict.drift),
  ]
  const msgPath = join(ROOT, '.ihui-agent', 'tmp', 'prod-parity-alert.txt')
  mkdirSync(dirname(msgPath), { recursive: true })
  writeFileSync(msgPath, `${lines.join('\n')}\n`, 'utf8')

  const r = spawnSync(
    process.execPath,
    [
      tsx,
      script,
      '--title', '生产副本与 HEAD 不一致 — production',
      '--severity', 'warning',
      '--source', 'ihui/prod-parity-sentinel',
      '--environment', 'production',
      '--message-file', msgPath,
      '--alert-id', 'prod-parity-drift',
      '--dedupe-hours', '4',
      '--strict',
    ],
    { cwd: ROOT, encoding: 'utf8', timeout: 120_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 },
  )
  return { ok: r.status === 0, reason: r.status === 0 ? '' : String(r.stderr ?? r.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | ') }
}

async function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const withProbe = argv.includes('--probe')
  const withAlert = argv.includes('--alert')

  if (!existsSync(PROD_ROOT)) {
    const payload = { state: PARITY_STATE.UNDETERMINED, reason: `生产根不存在: ${PROD_ROOT}`, rows: [], drift: [] }
    if (asJson) console.log(JSON.stringify(payload))
    else console.log(`⚠️ [prod-parity] 未判定: ${payload.reason}`)
    process.exitCode = 2
    return
  }

  const verdict = judgeParity(collectRows())
  const probe = withProbe ? runProbe() : null
  const alert = withAlert && verdict.state === PARITY_STATE.DRIFT ? sendAlert(verdict) : null

  let code = verdict.state === PARITY_STATE.OK ? 0 : verdict.state === PARITY_STATE.DRIFT ? 1 : 2
  // 内容一致但服务死了,不算"生产就绪":探针判红/未判定都抬档(只抬不放)。
  if (probe && probe.state !== 'ok' && code === 0) code = probe.state === 'drift' ? 1 : 2

  if (asJson) {
    console.log(
      JSON.stringify({
        state: verdict.state,
        reason: verdict.reason,
        rows: verdict.rows,
        drift: verdict.drift,
        probe,
        alert,
        remediation: remediationFor(verdict.state, verdict.drift),
      }),
    )
  } else {
    const icon = { [PARITY_STATE.OK]: '✅', [PARITY_STATE.DRIFT]: '❌', [PARITY_STATE.UNDETERMINED]: '⚠️' }[verdict.state]
    console.log(`${icon} [prod-parity] ${verdict.state} · ${verdict.reason} · 生产根=${PROD_ROOT}`)
    for (const r of verdict.rows) {
      const tag = !r.prod ? '缺失' : r.head === r.prod ? '一致' : '不同'
      console.log(`   ${tag === '一致' ? '·' : '✗'} ${r.path}  HEAD=${(r.head ?? '?').slice(0, 8)} PROD=${(r.prod ?? '-').slice(0, 8)} ${tag}`)
    }
    if (probe) console.log(`   四面自证: ${probe.state} (rc=${probe.code}) ${probe.tail}`)
    if (alert) console.log(`   邮件告警: ${alert.ok ? '已投递' : `未投递(${alert.reason})`}`)
    const todo = remediationFor(verdict.state, verdict.drift)
    if (todo) console.log(`   下一步: ${todo}`)
  }
  process.exitCode = code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((err) => {
    console.log(JSON.stringify({ state: PARITY_STATE.UNDETERMINED, reason: String(err?.message ?? err) }))
    process.exitCode = 2
  })
}

export const __test__ = { judgeParity, classifyDrift, remediationFor, headBlobSha, prodBlobSha, collectRows, PROD_PARITY_FILES, PARITY_STATE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
