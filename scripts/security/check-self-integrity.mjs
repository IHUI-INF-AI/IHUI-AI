// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 安全面自完整性哨兵:仓库工作树盘上 vs HEAD。
//
// 判据全在 scripts/security/lib/self-integrity.mjs(纯函数),这里只做三件:
//   ① 把 HEAD 清单与盘上 sha 读出来;② 调判据;③ 该报就报(唯一邮件出口)。
//
// 清单不写死:由 `git ls-tree -r HEAD` 动态枚举受管面 —— 新增一个 lib 自动纳管,
// 免得像 prod-parity 那样"清单少写一件就漏一格"。过滤规则在判据层的 coversPath。
//
// 用法:
//   node scripts/security/check-self-integrity.mjs            # 人读
//   node scripts/security/check-self-integrity.mjs --json     # 机读(单行,派发器取末行解析)
//   node scripts/security/check-self-integrity.mjs --alert    # 非 ok 时走邮件
//   node scripts/security/check-self-integrity.mjs --paths     # 只列受管面路径(自检清单用)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { coversPath, judgeSelfIntegrity, remediationForSelf, SELF_INTEGRITY_SCOPE } from './lib/self-integrity.mjs'

const ROOT = 'D:/IHUI-AI'
const LEDGER = `${ROOT}/.ihui-agent/state/self-integrity.jsonl`

const asJson = process.argv.includes('--json')
const wantAlert = process.argv.includes('--alert')
const listPaths = process.argv.includes('--paths')

/**
 * 派生 git 必须显式 stdio(门 193:本机不写 stdio 实测 0/30 成功并抛 EBUSY)。
 * 返回 { ok, out, err }。
 */
function git(args, timeoutMs = 60000) {
  const r = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  })
  if (r.error) return { ok: false, out: '', err: r.error.message }
  if (r.status !== 0) return { ok: false, out: r.stdout ?? '', err: String(r.stderr ?? `git exit ${r.status}`).trim() }
  return { ok: true, out: String(r.stdout ?? ''), err: '' }
}

/** HEAD 里的受管面清单(动态)。取不到 ⇒ null(未判定不猜)。 */
function headPaths() {
  const args = ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SELF_INTEGRITY_SCOPE]
  const r = git(args, 120000)
  if (!r.ok) return null
  return r.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).filter(coversPath)
}

/** 每件的 { head, disk }。任一取不到都落 null,由判据层决定算不算未判定。 */
function collectRows(paths) {
  const rows = []
  for (const p of paths) {
    const headR = git(['rev-parse', `HEAD:${p}`], 30000)
    const head = headR.ok ? headR.out.trim() : null
    // 门 193 同款注意:hash-object 对不存在的文件返回空串而非报错(§KEY_FACTS 15),
    // 所以先判存在性,再算 hash。
    const diskPath = join(ROOT, p)
    const exists = existsSync(diskPath)
    let disk = null
    if (exists) {
      const diskR = git(['hash-object', '--no-filters', p], 30000)
      disk = diskR.ok && diskR.out.trim() ? diskR.out.trim() : null
    }
    rows.push({ path: p, head, disk })
  }
  return rows
}

/** 唯一邮件出口(§5e,禁止自拼 SMTP)。 */
function sendSelfMail(j) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const script = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
  if (!existsSync(tsx) || !existsSync(script)) return { ok: false, reason: 'tsx 或通知脚本不在位(未判定)' }

  const msgPath = join(ROOT, '.ihui-agent', 'tmp', 'self-integrity-mail.txt')
  mkdirSync(dirname(msgPath), { recursive: true })
  const body = [
    `安全面自完整性 ${j.state} — ${j.reason}`,
    '',
    `受管件数 = ${j.total ?? 0}`,
    `漂移件数 = ${(j.drift ?? []).length}`,
    '',
    '漂移清单:',
    ...(j.drift ?? []).map((d) => `  · ${d.path}  (${d.disk ? '内容不同' : '盘上缺失'})`),
    '',
    `处置:${remediationForSelf(j.state, j.drift ?? [])}`,
    '',
    '口径:受管面 = scripts/security/** + deploy/win/** 的 .mjs,基准 = HEAD blob。',
    '稳态下应全等;不一致既可能是本人正在改,也可能是有人绕过 git 动了防线自身。',
  ].join('\n')
  writeFileSync(msgPath, `${body}\n`, 'utf8')

  const res = spawnSync(
    process.execPath,
    [
      tsx, script,
      '--title', `安全面自完整性 ${j.state} — ${j.reason}`,
      '--severity', j.state === 'drift' ? 'critical' : 'warning',
      '--source', 'ihui/self-integrity',
      '--environment', 'production',
      '--message-file', msgPath,
      '--strict',
      '--alert-id', `self-integrity-${j.state}`,
      '--dedupe-hours', '6',
    ],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 },
  )
  return {
    ok: res.status === 0,
    reason: res.status === 0 ? '' : String(res.stderr ?? res.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | '),
  }
}

const paths = headPaths()
if (!paths) {
  const record = { at: new Date().toISOString(), state: 'undetermined', reason: 'HEAD 清单取不到(git ls-tree 失败)' }
  if (asJson) console.log(JSON.stringify(record))
  else console.error(`? ${record.state} · ${record.reason}`)
  process.exit(2)
}

if (listPaths) {
  console.log(JSON.stringify({ count: paths.length, paths }))
  process.exit(0)
}

const rows = collectRows(paths)
const j = judgeSelfIntegrity(rows)
const record = {
  at: new Date().toISOString(),
  state: j.state,
  reason: j.reason,
  total: j.total,
  drifted: (j.drift ?? []).map((d) => d.path),
  missing: (j.drift ?? []).filter((d) => !d.disk).map((d) => d.path),
}

mkdirSync(dirname(LEDGER), { recursive: true })
appendFileSync(LEDGER, `${JSON.stringify(record)}\n`, 'utf8')

if (asJson) {
  console.log(JSON.stringify(record))
} else {
  const icon = j.state === 'ok' ? '✅' : j.state === 'drift' ? '⛔' : '?'
  console.error(`${icon} ${j.state} · ${j.reason}`)
  for (const d of (j.drift ?? []).slice(0, 12)) {
    console.error(`   ${d.disk ? '~' : '✘'} ${d.path}`)
  }
  if ((j.drift ?? []).length > 12) console.error(`   …共 ${j.drift.length} 件`)
}

if (wantAlert && j.state !== 'ok') {
  const mail = sendSelfMail(j)
  record.alerted = mail.ok
  record.mailReason = mail.ok ? null : mail.reason
  appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), alert: j.state, ok: mail.ok, reason: mail.reason ?? null })}\n`, 'utf8')
  // 走 stderr:stdout 在 --json 档只许留一行 JSON —— 派发器取末行解析,
  // 混一行人读文案进去就会把它打成 undetermined(ban-parity 实测过这一坑)。
  console.error(`   --alert:${mail.ok ? '已投递' : `投递失败(${mail.reason})`}`)
}

process.exit(j.state === 'drift' ? 1 : j.state === 'undetermined' ? 2 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
