#!/usr/bin/env node
/**
 * 自动翻译备份回滚工具 (2026-06-26 新增)
 *
 * 用法:
 *   node scripts/rollback-auto-translate.mjs                          # 列出所有备份
 *   node scripts/rollback-auto-translate.mjs <backup-dir-name>         # 回滚指定备份
 *   node scripts/rollback-auto-translate.mjs --latest                  # 回滚最新备份
 *
 * 回滚操作: 从 backup-dir 下的文件复制回 src/locales/modules/{locale}/*.json
 * 安全: 回滚前会再次备份当前文件到 .pre-rollback-{ts}/
 */

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')
const REPORTS_DIR = path.join(ROOT, 'scripts', 'reports')

const args = process.argv.slice(2)
const useLatest = args.includes('--latest')
const targetName = args.find((a) => !a.startsWith('-'))

function listBackups() {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.log('❌ 备份目录不存在:', REPORTS_DIR)
    return []
  }
  return fs.readdirSync(REPORTS_DIR)
    .filter((n) => n.startsWith('auto-translate-backup-'))
    .sort()
    .reverse()
}

function findBackupDir(name) {
  const dir = path.join(REPORTS_DIR, name)
  if (!fs.existsSync(dir)) {
    console.log(`❌ 备份目录不存在: ${dir}`)
    return null
  }
  return dir
}

function rollback(backupDir) {
  const backupName = path.basename(backupDir)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const preRollbackDir = path.join(REPORTS_DIR, `pre-rollback-${ts}`)

  let countRestored = 0
  let countSkipped = 0
  const errors = []

  function walk(currentBackup, currentTarget) {
    if (!fs.existsSync(currentBackup)) return
    const stat = fs.statSync(currentBackup)
    if (stat.isFile()) {
      // 复制 backup -> target
      const rel = path.relative(backupDir, currentBackup)
      const targetFile = path.join(LOCALES_DIR, rel)
      if (!fs.existsSync(targetFile)) {
        console.log(`   ⚠️ 目标文件不存在, 跳过: ${rel}`)
        countSkipped++
        return
      }
      // 备份当前文件
      const preTargetFile = path.join(preRollbackDir, rel)
      fs.mkdirSync(path.dirname(preTargetFile), { recursive: true })
      fs.copyFileSync(targetFile, preTargetFile)

      // 恢复
      fs.copyFileSync(currentBackup, targetFile)
      countRestored++
      console.log(`   ✅ ${rel}`)
    } else if (stat.isDirectory()) {
      fs.mkdirSync(currentTarget, { recursive: true })
      for (const f of fs.readdirSync(currentBackup)) {
        walk(path.join(currentBackup, f), path.join(currentTarget, f))
      }
    }
  }

  console.log(`\n🔄 从 ${backupName} 回滚...`)
  console.log(`📦 回滚前快照: ${path.relative(ROOT, preRollbackDir)}`)
  walk(backupDir, LOCALES_DIR)

  console.log(`\n📊 回滚报告:`)
  console.log(`   恢复文件:     ${countRestored}`)
  console.log(`   跳过文件:     ${countSkipped}`)
  if (errors.length) {
    console.log(`   错误:         ${errors.length}`)
    errors.forEach((e) => console.log(`     ! ${e}`))
  }
  console.log(`\n✅ 回滚完成. 如需再次回滚, 用 ${path.relative(ROOT, preRollbackDir)}`)
}

console.log('🔧 自动翻译备份回滚工具')

const backups = listBackups()
if (backups.length === 0) {
  console.log('❌ 无可用备份')
  process.exit(1)
}

console.log(`\n📚 可用备份 (${backups.length}):`)
backups.slice(0, 10).forEach((b, i) => {
  console.log(`   ${i + 1}. ${b}`)
})
if (backups.length > 10) {
  console.log(`   ... 还有 ${backups.length - 10} 个`)
}

let target = null
if (useLatest) {
  target = findBackupDir(backups[0])
  if (!target) process.exit(1)
} else if (targetName) {
  target = findBackupDir(targetName)
  if (!target) process.exit(1)
} else {
  console.log('\n用法:')
  console.log('   node scripts/rollback-auto-translate.mjs --latest')
  console.log('   node scripts/rollback-auto-translate.mjs auto-translate-backup-2026-06-26T09-31-50')
  process.exit(0)
}

rollback(target)
