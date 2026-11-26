// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包归档 → Claude Code 会话 staging CLI(配合豆包「数据导入与同步」扫描入口)。
 *
 * 用法:
 *   node scripts/doubao-claude-stage.mjs                              # 帮助
 *   node scripts/doubao-claude-stage.mjs --archive <归档目录> [--home <家目录>]
 *       [--limit n] [--test-token <tok>] [--title-prefix 前缀]          # 干跑:列计划
 *   node scripts/doubao-claude-stage.mjs --archive <归档目录> --apply   # 落盘(先写 undo 清单)
 *   node scripts/doubao-claude-stage.mjs --undo <manifest> [--apply]   # 按清单回收
 *
 * 之后在豆包:设置 → 数据导入与同步 → Claude Code → 重新检查 → 勾选 → 导入。
 * 导入会上传并占新号资源;完成后可 --undo 清掉 staged 文件。
 * 退出码:0 成/干跑 1 失败 2 用法错。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { buildClaudeSessionRecords, stageClaudeProjects, unstageClaude } from './lib/doubao-claude-stage.mjs'

const USAGE = `豆包归档 → Claude Code staging(干跑默认;--apply 才写盘)
  node scripts/doubao-claude-stage.mjs --archive <dir> [--home <dir>] [--limit n] [--test-token <t>] [--apply]
  node scripts/doubao-claude-stage.mjs --undo <manifest> [--apply]
`

function take(argv, flag) {
  const i = argv.indexOf(flag)
  if (i < 0) return { present: false }
  const v = argv[i + 1]
  if (typeof v !== 'string' || v === '' || v.startsWith('-')) return { present: true, error: `${flag} 需要非空值` }
  return { present: true, value: v }
}

function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE)
    return 0
  }
  const apply = argv.includes('--apply')
  const undo = take(argv, '--undo')
  if (undo.error) { console.error(`用法错:${undo.error}`); return 2 }
  if (undo.present) {
    const r = unstageClaude({ manifestFile: undo.value, apply })
    if (!r.ok) { console.error(`❌ ${r.note}`); return 1 }
    console.info(`✅ ${r.note}`)
    return 0
  }
  const archive = take(argv, '--archive')
  const home = take(argv, '--home')
  const limit = take(argv, '--limit')
  const token = take(argv, '--test-token')
  for (const [, r] of [[archive], [home], [limit], [token]]) {
    if (r?.error) { console.error(`用法错:${r.error}`); return 2 }
  }
  if (!archive.present) { console.error('用法错:必须给 --archive <归档目录>'); return 2 }
  if (token.present && limit.present) { console.error('提示:--test-token 会注入到首条消息,生产迁移请去掉') }

  const indexFile = path.join(archive.value, 'index.json')
  let index
  try {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'))
  } catch (e) {
    console.error(`❌ 读归档失败:${e instanceof Error ? e.message : e}`)
    return 1
  }
  const entries = Array.isArray(index.conversations) ? index.conversations : []
  if (entries.length === 0) { console.error('❌ 归档里 0 个会话'); return 1 }

  const sessions = []
  for (const entry of entries) {
    if (!entry?.file) { console.error(`跳过 ${entry?.conversationId}(无文件)`); continue }
    let body
    try {
      body = JSON.parse(fs.readFileSync(path.join(archive.value, entry.file), 'utf8'))
    } catch (e) {
      console.error(`跳过 ${entry.conversationId}:读文件失败(${e instanceof Error ? e.message : e})`)
      continue
    }
    const built = buildClaudeSessionRecords(body, {
      limit: limit.value ? Number(limit.value) : 0,
      testToken: token.value,
      title: `豆包归档 ${entry.conversationId}`,
    })
    if (built.kept < 2) { console.error(`跳过 ${entry.conversationId}:有效消息不足(${built.kept})`); continue }
    sessions.push({
      sessionId: built.sessionId, cwd: built.cwd, title: `豆包归档 ${entry.conversationId}`,
      records: built.records,
      origin: { archive: archive.value, conversationId: entry.conversationId, kept: built.kept },
    })
    console.info(`  会话 ${entry.conversationId}: kept=${built.kept} dropped=${built.dropped} (user=${built.stats.users} assistant=${built.stats.assistants}) session=${built.sessionId}`)
  }
  if (sessions.length === 0) { console.error('❌ 无可用会话'); return 1 }
  const homeDir = home.value || os.homedir()
  const res = stageClaudeProjects({ homeDir, sessions, apply })
  if (!res.ok) {
    console.error(`❌ ${res.code}${res.conflict ? `:${res.conflict}` : ''}`)
    return 1
  }
  console.info(`${res.code === 'dry-run' ? 'ℹ️' : '✅'} ${res.note}`)
  for (const f of res.files) console.info(`   ${f}`)
  if (res.code === 'dry-run') console.info('确认无误后加 --apply;之后回滚用 --undo ' + res.manifest)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? e.message : e}\n${e.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { take, USAGE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
