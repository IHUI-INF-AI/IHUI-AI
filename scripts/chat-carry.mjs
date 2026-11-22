// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全平台「切号对话随行」CLI(2026-11-22 立,机主令:所有号池平台都要有这能力)。
 *
 *   node scripts/chat-carry.mjs --audit [--json]
 *   node scripts/chat-carry.mjs --provider <平台> [--from <旧uid>] [--to <新uid>] [--dry-run] [--json]
 *   node scripts/chat-carry.mjs --provider workbuddy --capture [--json]
 *   node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> [--to <新uid>] --revive-history [--apply]
 *   node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-window <分钟> [--apply]
 *
 * 语义:
 *   --audit          全平台只读巡检:找到库没有、多少会话、是否带账号维度(ok/unlocated/scoped)
 *   --provider       单平台执行随行;rebind 平台真重绑,local 平台现场只读核验,cloud 平台给回放指引
 *   --capture        只读抓"此刻可见会话 id"(切号前调用;workbuddy 专用)
 *   --revive-history 把旧号名下软删的本地会话全量复活(默认 dry-run,须配 --apply 才写)
 *
 * 退出码:0 成功/可搬 / 1 业务失败(账号维度需适配、重绑失败)/ 2 参数或环境未判定。
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const { forceUtf8Stdio } = await import(pathToFileURL(path.join(HERE, 'lib', 'force-utf8-stdio.mjs')).href)
forceUtf8Stdio()

const registry = await import(pathToFileURL(path.join(HERE, 'lib', 'chat-carry', 'index.mjs')).href)
const wbCarry = await import(pathToFileURL(path.join(HERE, 'lib', 'workbuddy-chat-carry.mjs')).href)

const USAGE = `用法:
  node scripts/chat-carry.mjs --audit [--json]
  node scripts/chat-carry.mjs --provider <平台> [--from <旧uid>] [--to <新uid>] [--dry-run] [--json]
  node scripts/chat-carry.mjs --provider workbuddy --capture [--json]
  node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> [--to <新uid>] --revive-history [--apply]
  node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-window <分钟> [--apply]

平台: ${registry.POOL_PROVIDERS.join(' / ')}
说明: rebind 平台真重绑(带备份、失败整组回滚);local 平台现场只读核验(查不出账号维度即报错);
      cloud(豆包)走 doubao-carry 的 --export/--replay 回放迁移。
`

export function parseArgs(argv) {
  const o = { audit: false, provider: '', from: '', to: '', dryRun: false, json: false, capture: false, reviveHistory: false, apply: false, help: false, error: '', reviveWindow: 0 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--audit') o.audit = true
    else if (a === '--json') o.json = true
    else if (a === '--dry-run') o.dryRun = true
    else if (a === '--capture') o.capture = true
    else if (a === '--revive-history') o.reviveHistory = true
    else if (a === '--apply') o.apply = true
    else if (a === '--help' || a === '-h') o.help = true
    else if (a === '--provider') o.provider = String(argv[++i] ?? '').trim()
    else if (a === '--from') o.from = String(argv[++i] ?? '').trim()
    else if (a === '--to') o.to = String(argv[++i] ?? '').trim()
    else if (a === '--revive-window') {
      const n = Number(argv[++i])
      if (!Number.isFinite(n) || n <= 0) return { ...o, error: '--revive-window 需要正数(分钟)' }
      o.reviveWindow = n
    } else return { ...o, error: `不认识的参数:${a}` }
  }
  if (o.help) return o
  if (!o.audit && !o.provider) return { ...o, error: '必须给 --audit 或 --provider' }
  if (o.provider && !registry.POOL_PROVIDERS.includes(o.provider)) {
    return { ...o, error: `不认识的平台:${o.provider}(支持:${registry.POOL_PROVIDERS.join(' / ')})` }
  }
  if ((o.reviveHistory || o.reviveWindow > 0) && o.provider !== 'workbuddy') {
    return { ...o, error: '--revive-history / --revive-window 只适用于 workbuddy(其余平台本地库不带账号维度,无需复活)' }
  }
  if (o.reviveHistory && !o.from) return { ...o, error: '--revive-history 必须给 --from <旧uid>' }
  if (o.reviveWindow > 0 && !o.from) return { ...o, error: '--revive-window 必须给 --from <旧uid>(切号前的号,用于定位迁移源)' }
  return o
}

export function main(argv, io = {}) {
  const log = io.log ?? ((t) => process.stdout.write(`${t}\n`))
  const logErr = io.logErr ?? ((t) => process.stderr.write(`${t}\n`))
  const o = parseArgs(argv)
  if (o.error) {
    logErr(`❌ ${o.error}`)
    return 2
  }
  if (o.help || argv.length === 0) {
    log(USAGE)
    return argv.length === 0 ? 2 : 0
  }

  if (o.audit) {
    const rows = registry.auditProviders()
    if (o.json) {
      log(JSON.stringify({ asOf: new Date().toISOString(), rows }, null, 2))
    } else {
      log(`全平台对话能力巡检 ${new Date().toISOString()}`)
      for (const r of rows) {
        const cnt = r.sessions === null ? '?' : String(r.sessions)
        const vis = r.visible === null ? '?' : String(r.visible)
        log(
          `  ${r.provider.padEnd(10)} ${r.kind.padEnd(6)} ${r.ok ? '✓' : '✗'} ` +
            `${r.located ? '库=' + cnt + ' 可见=' + vis : '未定位'}` +
            `${r.accountScoped ? ' 账号维度=有' : ''}  ${r.store}`,
        )
        for (const n of r.notes.slice(0, 2)) log(`      · ${n}`)
      }
      const bad = rows.filter((r) => !r.ok)
      if (bad.length) log(`\n需要处理: ${bad.map((r) => r.provider).join(', ')}(原因见上;不是"探不到就当没事")`)
    }
    return 0
  }

  if (o.capture) {
    if (o.provider !== 'workbuddy') {
      logErr('❌ --capture 只适用于 workbuddy(其余平台本地库无账号维度,切号不丢会话)')
      return 2
    }
    const c = wbCarry.capturePreSwitchVisibleIds()
    if (o.json) log(JSON.stringify(c, null, 2))
    else log(`当前号=${c.uid ?? '(读不到)'} 可见会话=${c.ids.length} 条${c.why ? ` 未判定:${c.why}` : ''}`)
    return c.uid ? 0 : 2
  }

  if (o.reviveHistory || o.reviveWindow > 0) {
    const to = o.to || wbCarry.currentUid() || ''
    if (!to) {
      logErr('❌ 目标 uid 读不到(客户端未登录?);用 --to 显式给')
      return 2
    }
    const r = wbCarry.runCarry({
      fromUid: o.from,
      toUid: to,
      dryRun: !o.apply,
      reviveHistory: o.reviveHistory,
      reviveWindowMs: o.reviveWindow * 60_000,
    })
    if (o.json) log(JSON.stringify(r, null, 2))
    else {
      log(
        `历史复活${o.apply ? '' : '(dry-run)'} 旧号 ${r.from.slice(0, 8)} → ${r.to.slice(0, 8)}:` +
          `会话 ${r.moved.sessions} / 复活 ${r.moved.revived}`,
      )
      for (const n of r.notes ?? []) log(`  · ${n}`)
      if (!o.apply) log('  未写库;确认后加 --apply 执行')
    }
    return 0
  }

  const r = registry.switchCarry({
    provider: o.provider,
    fromUid: o.from,
    toUid: o.to || (o.provider === 'workbuddy' ? String(wbCarry.currentUid() ?? '') : ''),
    dryRun: o.dryRun,
  })
  if (o.json) {
    log(JSON.stringify(r, null, 2))
  } else {
    log(`对话随行 ${r.provider} [${r.kind}:${r.action}] ${r.ok ? '✓' : '✗'}${r.code ? ' code=' + r.code : ''}`)
    if (r.moved) log(`  会话 ${r.moved.sessions} / 空间 ${r.moved.spaces} / 定时任务 ${r.moved.automations} / 复活 ${r.moved.revived}`)
    for (const n of r.notes ?? []) log(`  · ${n}`)
  }
  return r.ok ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
