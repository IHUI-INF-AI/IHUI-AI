// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 历史清理(2026-11-22 立,机主令:不需要历史记录,别留着占地方)。
 *
 * 默认 **dry-run**:只统计,不动任何文件;`--apply` 才执行。
 *
 * 清理口径(与客户端自己的可见口径对齐):
 *   1) 所有账号(不限当前 uid)中 `transport='local' AND deleted_at IS NOT NULL` 的会话行
 *      —— 这些在客户端列表里本来就看不见,只是正文文件还留在 projects/**;
 *   2) 这些行的正文 `projects/**\/<session-id>.jsonl` 移到回收目录(保留目录结构);
 *   3) 没有任何会话行对应的无主正文(整库扫描后剩下的 jsonl)一起移到回收目录;
 *   4) 当前可见会话(deleted_at IS NULL)一行不动、正文不动;cloud 行不动。
 *
 * 可逆性:正文全部"搬走"而不是删除;库文件先整库备份。回收目录默认
 * `~/.workbuddy/.ihui-trash/<runId>/`,里面带 manifest.json(每条被清行的 id/uid/title/deleted_at)。
 * 确认不再需要时,手动删整个回收目录即可。
 *
 * 用法:
 *   node scripts/workbuddy-prune-history.mjs                 # 干跑,出清单与体积
 *   node scripts/workbuddy-prune-history.mjs --apply         # 执行(备份+搬正文+删库行)
 *   node scripts/workbuddy-prune-history.mjs --apply --no-orphans   # 无主正文不动
 *   node scripts/workbuddy-prune-history.mjs --json
 *
 * 退出码:0 完成/干跑成功;2 环境未判定(库不存在/备份失败)。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const { forceUtf8Stdio } = await import(pathToFileURL(path.join(HERE, 'lib', 'force-utf8-stdio.mjs')).href)
forceUtf8Stdio()

const mb = (n) => `${(n / 1048576).toFixed(1)}MB`

/** 递归收集 projects 下的 jsonl */
function walkJsonl(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkJsonl(p, out)
    else if (e.name.endsWith('.jsonl')) out.push(p)
  }
  return out
}

/** 同盘 rename;失败退化为 copy+unlink(回收目录也在 ~/.workbuddy 下,正常不会跨盘) */
function moveFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  try {
    fs.renameSync(src, dst)
  } catch {
    fs.copyFileSync(src, dst)
    fs.unlinkSync(src)
  }
}

export function pruneWorkbuddyHistory({ apply = false, home = path.join(os.homedir(), '.workbuddy'), includeOrphans = true, runId = new Date().toISOString().replace(/[:.]/g, '-') } = {}) {
  const dbPath = path.join(home, 'workbuddy.db')
  if (!fs.existsSync(dbPath)) return { ok: false, code: 'no-db', notes: [`没有会话库:${dbPath}`] }
  const projects = path.join(home, 'projects')
  const trashDir = path.join(home, '.ihui-trash', runId)
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync(dbPath)
  const notes = []
  let backup = ''
  try {
    const all = db.prepare(`SELECT id,user_id,transport,deleted_at,title,space_id FROM sessions`).all()
    const idSet = new Set(all.map((r) => String(r.id)))
    const targets = all.filter((r) => String(r.transport) === 'local' && r.deleted_at !== null)
    const targetIds = new Set(targets.map((r) => String(r.id)))
    const keepVisible = all.filter((r) => r.deleted_at === null).length

    const files = walkJsonl(projects)
    const targetFiles = []
    const orphanFiles = []
    for (const f of files) {
      const id = path.basename(f, '.jsonl')
      if (targetIds.has(id)) targetFiles.push(f)
      else if (!idSet.has(id)) orphanFiles.push(f)
    }
    const sum = (arr) => arr.reduce((a, f) => a + fs.statSync(f).size, 0)
    const targetBytes = sum(targetFiles)
    const orphanBytes = sum(orphanFiles)
    const freed = targetBytes + (includeOrphans ? orphanBytes : 0)

    const plan = {
      ok: true,
      dryRun: !apply,
      home,
      rows: {
        all: all.length,
        delete: targets.length,
        keepVisible,
        otherAccountsDelete: targets.filter((r) => r.user_id !== (targets[0]?.user_id ?? '')).length,
      },
      bodies: {
        targetFiles: targetFiles.length,
        targetBytes,
        orphanFiles: orphanFiles.length,
        orphanBytes,
        includeOrphans,
        freedBytes: freed,
      },
      trashDir,
      backup,
      notes,
    }
    if (!apply) {
      notes.push('dry-run:未写库、未搬正文;确认后加 --apply')
      return plan
    }

    // 库备份先落盘:整库 + WAL/SHM(有则备)
    const bak = `${dbPath}.pre-prune-${runId}.bak`
    fs.copyFileSync(dbPath, bak)
    backup = bak
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(`${dbPath}${ext}`)) fs.copyFileSync(`${dbPath}${ext}`, `${bak}${ext}`)
    }

    // 正文搬到回收目录(保留相对 projects 的层级),并写 manifest
    const manifest = []
    for (const f of [...targetFiles, ...(includeOrphans ? orphanFiles : [])]) {
      const rel = path.relative(projects, f)
      moveFile(f, path.join(trashDir, 'projects', rel))
      manifest.push({ file: rel, reason: targetIds.has(path.basename(f, '.jsonl')) ? 'soft-deleted-session' : 'orphan' })
    }
    const rowsMeta = targets.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      title: r.title,
      deleted_at: r.deleted_at,
      space_id: r.space_id,
    }))
    fs.mkdirSync(trashDir, { recursive: true })
    fs.writeFileSync(path.join(trashDir, 'manifest.json'), JSON.stringify({ runId, at: new Date().toISOString(), rows: rowsMeta, files: manifest }, null, 2), 'utf8')

    // 再删库行(事务);只删核对过的同一批 id,不用宽 WHERE 免得口径漂移
    let deleted = 0
    db.exec('BEGIN IMMEDIATE')
    try {
      const del = db.prepare(`DELETE FROM sessions WHERE id = ? AND transport = 'local' AND deleted_at IS NOT NULL`)
      for (const r of rowsMeta) deleted += Number(del.run(r.id).changes) || 0
      db.exec('COMMIT')
    } catch (e) {
      try {
        db.exec('ROLLBACK')
      } catch {
        /* 已回滚 */
      }
      return { ...plan, ok: false, code: 'tx-failed', notes: [`删行失败(已回滚,正文已搬走可原样搬回):${e instanceof Error ? e.message : String(e)}`] }
    }

    notes.push(`已备份会话库:${bak}`)
    notes.push(`已清会话行 ${deleted} 条;正文移入回收目录:${trashDir}`)
    notes.push(`预计释放 ${mb(freed)}(回收目录保留原文件,确认无用后手动删掉即可)`)
    return { ...plan, dryRun: false, deleted, backup: bak, notes }
  } finally {
    try {
      db.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

function parseArgs(argv) {
  const o = { apply: false, json: false, orphans: true, help: false }
  for (const a of argv) {
    if (a === '--apply') o.apply = true
    else if (a === '--json') o.json = true
    else if (a === '--no-orphans') o.orphans = false
    else if (a === '--help' || a === '-h') o.help = true
    else return { ...o, error: `不认识的参数:${a}` }
  }
  return o
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const o = parseArgs(process.argv.slice(2))
  if (o.error) {
    process.stderr.write(`❌ ${o.error}\n`)
    process.exit(2)
  }
  if (o.help) {
    process.stdout.write(
      '用法: node scripts/workbuddy-prune-history.mjs [--apply] [--no-orphans] [--json]\n' +
        '  默认 dry-run;--apply 才备份+搬正文+删软删会话行。当前可见会话与 cloud 行不动。\n',
    )
    process.exit(0)
  }
  const r = pruneWorkbuddyHistory({ apply: o.apply, includeOrphans: o.orphans })
  if (o.json) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`)
  else {
    process.stdout.write(`${r.dryRun ? 'WorkBuddy 历史清理(dry-run)' : 'WorkBuddy 历史清理(已执行)'}\n`)
    process.stdout.write(`  会话行: 总 ${r.rows?.all} / 将删 ${r.rows?.delete} / 保留可见 ${r.rows?.keepVisible}\n`)
    process.stdout.write(
      `  正文: 软删会话 ${r.bodies?.targetFiles} 个(${mb(r.bodies?.targetBytes ?? 0)})` +
        ` / 无主 ${r.bodies?.orphanFiles} 个(${mb(r.bodies?.orphanBytes ?? 0)})` +
        ` ⇒ 预计释放 ${mb(r.bodies?.freedBytes ?? 0)}\n`,
    )
    for (const n of r.notes ?? []) process.stdout.write(`  · ${n}\n`)
    if (r.dryRun) process.stdout.write('  未改动;确认后加 --apply\n')
  }
  process.exit(r.ok ? 0 : 2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
