// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产副本修复器(2026-11-25 立) —— check-prod-parity 判 drift 时的唯一出口。
 *
 * 存在的理由(§5e-1):判据挂到人通道前必须回答"红了收信人能做什么"。
 * 只报"漂移了"而不给一键修复,等于把运维动作推回给人;这里把
 * **备份 → 覆盖 → 重启 → 复验** 串成一条命令,并且每一步都留痕。
 *
 * 用法:
 *   node scripts/security/sync-prod-parity.mjs           # 只打印计划(默认 dry-run)
 *   node scripts/security/sync-prod-parity.mjs --apply   # 真的执行
 *
 * 纪律:
 *   · 覆盖前必先备份 `<file>.bak-<yyyyMMdd-HHmmss>` —— 覆盖是**不可逆**动作,备份是它的前置;
 *   · 只从 `git show HEAD:<path>` 取内容,不从工作树取 —— 工作树可能有未提交的半成品;
 *   · 两个 router 共用同一份脚本,必须一起重启(只重启一个会留下旧版进程继续服务);
 *   · 重启后必须复验,复验不过就 exit 1 并直说"服务起来了但内容仍不对"。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { PARITY_STATE, judgeParity } from './lib/prod-parity.mjs'
import { collectRows } from './check-prod-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const PROD_ROOT = process.env.IHUI_PROD_ROOT ? resolve(process.env.IHUI_PROD_ROOT) : 'D:\\DevEnv\\ihui-prod'
const SERVICES = ['IHUI-WEB-ROUTER', 'IHUI-API-ROUTER']
const LEDGER = join(ROOT, '.ihui-agent', 'state', 'prod-parity-sync.jsonl')

function headContent(rel) {
  // §5b:派生 git 必须显式接管 stdio(门 [193] 按此判)。
  return execFileSync('git', ['show', `HEAD:${rel}`], {
    cwd: ROOT,
    maxBuffer: 1 << 22,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function restartServices() {
  const cmd = [
    `Stop-Service -Name ${SERVICES.map((s) => `'${s}'`).join(',')} -Force`,
    'Start-Sleep -Seconds 3',
    `Start-Service -Name ${SERVICES.map((s) => `'${s}'`).join(',')}`,
  ].join('; ')
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const tail = String(r.stderr ?? r.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | ')
  return { ok: r.status === 0, tail }
}

function ledger(rec) {
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不改变结果 */
  }
}

function main() {
  const apply = process.argv.includes('--apply')
  // 演练/无服务场景用:只做备份+覆盖+复验,不碰 Windows 服务。
  const noRestart = process.argv.includes('--no-restart')
  if (!existsSync(PROD_ROOT)) {
    console.log(`⚠️ [sync-prod-parity] 未判定:生产根不存在 ${PROD_ROOT}`)
    return 2
  }

  const before = judgeParity(collectRows(PROD_ROOT))
  if (before.state === PARITY_STATE.OK) {
    console.log(`✅ [sync-prod-parity] 无需修复 · ${before.reason}`)
    return 0
  }
  if (before.state === PARITY_STATE.UNDETERMINED) {
    console.log(`⚠️ [sync-prod-parity] 未判定,拒绝动手 · ${before.reason}`)
    console.log('   先修清单/补提交,再跑本命令 —— 基准都没有时覆盖生产等于盲写。')
    return 2
  }

  console.log(`🔧 [sync-prod-parity] 待修 ${before.drift.length} 件${apply ? '' : ' (dry-run,加 --apply 才执行)'}`)
  for (const r of before.drift) {
    const abs = join(PROD_ROOT, r.path.replaceAll('/', '\\'))
    console.log(`   ${r.prod ? '内容不同' : '缺失'} ${r.path} → ${abs}`)
  }

  if (!apply) {
    console.log(`\n   执行: node scripts/security/sync-prod-parity.mjs --apply`)
    return 1
  }

  const ts = stamp()
  const done = []
  for (const r of before.drift) {
    const abs = join(PROD_ROOT, r.path.replaceAll('/', '\\'))
    if (existsSync(abs)) {
      const bak = `${abs}.bak-${ts}`
      writeFileSync(bak, readFileSync(abs))
      done.push({ path: r.path, backup: bak })
    } else {
      mkdirSync(dirname(abs), { recursive: true })
      done.push({ path: r.path, backup: null })
    }
    writeFileSync(abs, headContent(r.path))
  }

  const restart = noRestart ? { ok: true, tail: '--no-restart(跳过)' } : restartServices()
  const after = judgeParity(collectRows(PROD_ROOT))
  const ok = restart.ok && after.state === PARITY_STATE.OK

  ledger({
    ts: new Date().toISOString(),
    prodRoot: PROD_ROOT,
    repaired: done,
    restartOk: restart.ok,
    restartTail: restart.tail,
    afterState: after.state,
    afterReason: after.reason,
  })

  console.log(`\n   ${restart.ok ? '✅' : '❌'} 重启: ${restart.tail || 'ok'}`)
  console.log(`   ${after.state === PARITY_STATE.OK ? '✅' : '❌'} 复验: ${after.state} · ${after.reason}`)
  if (!ok) {
    console.log('   服务起来了但内容仍不对 —— 不要报绿。查 .ihui-agent/state/prod-parity-sync.jsonl 的最后一枚。')
  }
  return ok ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()

export const __test__ = { main, PROD_ROOT, SERVICES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
