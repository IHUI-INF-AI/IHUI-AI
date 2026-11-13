// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 历史会话补搬(2026-11-12 立)。
 *
 *   node scripts/switch-workbuddy-with-chat.mjs --from <旧uid|current-prev> [--to <新uid|current>]
 *     [--dry-run] [--json]
 *
 * 与切号的关系:
 *   - **正常切号不必跑本入口** —— 对话随行已挂在
 *     apps/api/scripts/relay-login-local-verified.ts 的写回之后,切号成功即自动重绑
 *     (判据见 scripts/lib/workbuddy-chat-carry.mjs 文件头)。
 *   - 本入口补的是「已经切过、旧号会话还留在旧 uid 名下」这一档:
 *     ① 上线本功能之前切过的号;
 *     ② 当次 carry 失败(notes 里会点名 [carry-*]);
 *     ③ 客户端清理把某批会话软删后又想找回。
 *
 * 判据与写操作全在 lib(§0.6):本文件只做参数归一、当前号回读、派遣与回报。
 * 退出码:0 成功(或 dry-run 判可搬) / 1 业务失败 / 2 参数或环境未判定。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { CarryError, runCarry } from './lib/workbuddy-chat-carry.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const AUTH_INFO = path.join(
  process.env.LOCALAPPDATA || '',
  'CodeBuddyExtension',
  'Data',
  'Public',
  'auth',
  'workbuddy-desktop.info',
)

const USAGE =
  '用法: node scripts/switch-workbuddy-with-chat.mjs --from <旧uid> [--to <新uid>] [--dry-run] [--json]\n' +
  '  --from  旧登录号的 uid(会话现在挂在它名下)\n' +
  '  --to    目标 uid(缺省 = 读本机当前登录号)\n' +
  '  --dry-run 只读计划,不写库、不动快照\n' +
  '  --json  机读汇总走 stdout\n' +
  '说明:正常切号已自动携带对话,本入口只用于补搬历史(见文件头)。\n'

/** 读本机当前登录的 WorkBuddy 账号 uid(明文段,不碰任何 $wbEncrypted 信封) */
export function currentUid(authFile = AUTH_INFO) {
  try {
    const raw = JSON.parse(fs.readFileSync(authFile, 'utf8'))
    const uid = raw?.account?.uid
    return typeof uid === 'string' && uid.trim() ? uid.trim() : null
  } catch {
    return null
  }
}

export function parseArgs(argv) {
  const o = { from: null, to: null, dryRun: false, json: false, help: false, error: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--from' || a === '--to') {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) return { ...o, error: `${a} 需要后面的值` }
      if (a === '--from') o.from = v
      else o.to = v
      i += 1
    } else if (a === '--dry-run') o.dryRun = true
    else if (a === '--json') o.json = true
    else if (a === '--help' || a === '-h') o.help = true
    else return { ...o, error: `不认识的参数:${a}` }
  }
  if (!o.help && !o.from) return { ...o, error: '必须给 --from(旧号 uid;不猜)' }
  return o
}

export function main(argv, io = {}) {
  const log = io.log ?? ((t) => process.stdout.write(`${t}\n`))
  const logErr = io.logErr ?? ((t) => process.stderr.write(`${t}\n`))
  const o = parseArgs(argv)
  if (o.help) {
    log(USAGE)
    return 0
  }
  if (o.error) {
    logErr(`❌ ${o.error}\n${USAGE}`)
    return 2
  }
  const toUid = o.to ?? currentUid()
  if (!toUid) {
    logErr(
      '❌ 取不到目标 uid:本机没有可读的 WorkBuddy 登录态文件' +
        `(${AUTH_INFO})⇒ 请显式给 --to(不猜)`,
    )
    return 2
  }
  try {
    const r = runCarry({ fromUid: o.from, toUid, dryRun: o.dryRun })
    if (o.json) {
      log(JSON.stringify(r, null, 1))
    } else {
      log(`旧号 ${r.from}`)
      log(`新号 ${r.to}`)
      log(
        `会话 ${r.moved.sessions} / 空间 ${r.moved.spaces} / 定时任务 ${r.moved.automations}`,
      )
      if (r.snapshot && r.snapshot.changed !== false) {
        log(`侧边栏快照:并入 ${r.snapshot.merged ?? 0} 条`)
      }
      for (const n of r.notes ?? []) log(`  · ${n}`)
      if (r.dryRun) log('dry-run:未写任何文件')
      else log(`备份 ${r.backups.length} 份(lib 侧带 .pre-carry-<runId>.bak 后缀)`)
      log('CARRIED ok=1')
    }
    return 0
  } catch (e) {
    const code = e instanceof CarryError ? e.code : 'undetermined'
    logErr(`❌ 未搬运[${code}]:${e instanceof Error ? e.message : String(e)}`)
    return code === 'bad-from-uid' || code === 'bad-to-uid' || code === 'same-uid' ? 2 : 1
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main(process.argv.slice(2)))

export const __test__ = { parseArgs, currentUid, USAGE, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
