// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 切号前后"对话随行"对账入口 —— 判 Qoder CN / MiniMax Code 登录后本地会话清单是否连续。
 *
 *   node scripts/check-switch-continuity.mjs snapshot [qoder|minimax|--all] [--json]
 *   node scripts/check-switch-continuity.mjs compare --before <前快照.json> --after <后快照.json>
 *   node scripts/check-switch-continuity.mjs --help
 *
 * 用法(每端):切号前跑一次 snapshot 存文件 → 切号并登录新号 → 再 snapshot → compare 出结论。
 * 立因与"为什么不是迁移而是对账"见 scripts/lib/switch-continuity-check.mjs 头注(取证实证:
 * 两端本地正库按工作区/设备组织、不含账号字段)。只读判机器状态 ⇒ 不进提交链(§12e)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as C from './lib/switch-continuity-check.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const STATE_DIR = path.join(HERE, '.ihui-agent', 'state', 'switch-continuity')

const USAGE =
  '用法:\n' +
  '  node scripts/check-switch-continuity.mjs snapshot qoder|minimax|all [--json]  # 切号前各跑一次\n' +
  '  node scripts/check-switch-continuity.mjs compare --before <a.json> --after <b.json>\n' +
  '快照默认落 .ihui-agent/state/switch-continuity/(gitignored);compare 只吃两份 JSON。\n'

function parse(argv) {
  const o = { mode: null, apps: [], before: '', after: '', json: false, help: false, error: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === 'snapshot' || a === 'compare') {
      if (o.mode) o.error = `模式互斥:${o.mode} 与 ${a}`
      o.mode = a
    } else if (a === 'qoder' || a === 'minimax') o.apps.push(a)
    else if (a === 'all') o.apps.push('qoder', 'minimax')
    else if (a === '--before') o.before = argv[++i] || ''
    else if (a === '--after') o.after = argv[++i] || ''
    else if (a === '--json') o.json = true
    else if (a === '--help' || a === '-h') o.help = true
    else o.error = `未知参数: ${a}`
  }
  if (!o.help && !o.error) {
    if (o.mode === 'snapshot' && !o.apps.length) o.error = 'snapshot 需要指定 qoder|minimax|all'
    if (o.mode === 'compare' && (!o.before || !o.after)) o.error = 'compare 需要 --before 与 --after'
    if (!o.mode) o.error = '缺少模式:snapshot | compare'
  }
  if (o.mode === 'snapshot' && (!o.apps.length || o.apps.some((x) => !Object.keys(C.APPS).includes(x)))) {
    if (!o.error) o.error = `应用名不认识(可用:${Object.keys(C.APPS).join('/')})`
  }
  return o
}

function main(argv) {
  const o = parse(argv)
  if (o.help) {
    process.stdout.write(USAGE)
    return 0
  }
  if (o.error) {
    process.stderr.write(`❌ ${o.error}\n${USAGE}`)
    return 2
  }
  if (o.mode === 'snapshot') {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const out = []
    for (const app of o.apps) {
      const snap = C.snapshotApp(app)
      const file = path.join(STATE_DIR, `${app}.${snap.state}.${stamp}.json`)
      if (snap.state === 'ok') {
        fs.writeFileSync(file, JSON.stringify(snap, null, 1), 'utf8')
        console.log(
          `✅ ${snap.label}: 会话 ${snap.sessions.count} 场(清单钉 ${snap.sessions.digest}) 消息行 ${snap.messageRows?.count ?? '-'} 快照=${path.relative(HERE, file)}`,
        )
        if (!snap.walMerged) console.log('  ⚠️ WAL 未能 checkpoint(退只读主库,在途帧未含)')
      } else {
        console.log(`❌ ${app}: 未判定 —— ${snap.why}`)
      }
      out.push({ app, ...snap, file: snap.state === 'ok' ? file : undefined })
    }
    if (o.json) process.stdout.write(JSON.stringify(out) + '\n')
    return out.every((x) => x.state === 'ok') ? 0 : out.some((x) => x.state === 'ok') ? 1 : 2
  }
  // compare
  const before = JSON.parse(fs.readFileSync(o.before, 'utf8'))
  const after = JSON.parse(fs.readFileSync(o.after, 'utf8'))
  if (before.app !== after.app) {
    process.stderr.write(`❌ 两份快照不是同一应用(${before.app} vs ${after.app})\n`)
    return 2
  }
  const v = C.compareSnapshots(before, after)
  process.stdout.write(JSON.stringify(v, null, 1) + '\n')
  if (!o.json) {
    process.stderr.write(`\n结论: ${v.verdict} —— ${v.note || v.why || ''}\n`)
  }
  return v.verdict === 'continuity-ok' ? 0 : v.verdict === 'continuity-broken' ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  let code = 2
  try {
    code = main(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    code = 2
  }
  process.exit(code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
