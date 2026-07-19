#!/usr/bin/env node
/**
 * 阶段 1:文件清单级迁移审计
 *
 * 目标:比对 D:\历史项目存档\ 下 6 个子项目 vs 当前 IHUI-AI 仓库 apps/+packages/,
 * 输出"已迁移/部分迁移/缺失/无需迁移"4 类对照表 CSV
 *
 * 用法:node scripts/audit-migration-file-list.mjs
 * 输出:reports/migration-audit-{timestamp}.csv
 *       reports/migration-audit-skipped.csv
 *       reports/migration-audit-summary.json
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// ─── 配置 ───────────────────────────────────────────────────────────
const LEGACY_ROOTS = [
  { name: 'ihui-ai-admin-frontend', path: 'D:\\历史项目存档\\ihui-ai-admin-frontend' },
  { name: 'zhs_app-ZZ', path: 'D:\\历史项目存档\\zhs_app-ZZ' },
  { name: 'ljd-交接文件', path: 'D:\\历史项目存档\\ljd-交接文件' },
  { name: 'edu-server', path: 'D:\\历史项目存档\\edu server' },
  { name: 'edu-client', path: 'D:\\历史项目存档\\edu client' },
  { name: 'code', path: 'D:\\历史项目存档\\code' },
]

const NEW_ROOTS = [
  'g:\\IHUI-AI\\apps',
  'g:\\IHUI-AI\\packages',
]

// 跳过的目录(依赖/构建/缓存)
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.turbo', 'target', '.cache', '.vscode', '.idea', 'coverage',
  '.pytest_cache', '.mypy_cache', '.ruff_cache', 'venv', '.venv',
  'env', '.env', '__snapshots__', 'e2e/fixtures',
])

// 需要审计的文件扩展名(代码+配置+i18n+样式)
const AUDIT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py',
  '.vue',
  '.java',
  '.json', '.jsonc',
  '.css', '.scss', '.less', '.sass',
  '.html', '.htm',
  '.yaml', '.yml',
  '.sql',
  '.md', // 文档也要比对
])

// 无需迁移的扩展名(资源/二进制/媒体)
const NO_MIGRATE_EXTENSIONS = new Set([
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.ogg', '.webm', '.avi', '.mov',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.lock', '.log',
])

// 大文件阈值(100MB):超过不计算 MD5
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024

// ─── 工具函数 ───────────────────────────────────────────────────────
function shouldSkipDir(dirName) {
  return SKIP_DIRS.has(dirName)
}

function getFileExt(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ext
}

function isAuditable(filePath) {
  const ext = getFileExt(filePath)
  return AUDIT_EXTENSIONS.has(ext)
}

function isNoMigrate(filePath) {
  const ext = getFileExt(filePath)
  return NO_MIGRATE_EXTENSIONS.has(ext)
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size
  } catch {
    return -1
  }
}

function computeMD5(filePath) {
  try {
    const buf = fs.readFileSync(filePath)
    return crypto.createHash('md5').update(buf).digest('hex')
  } catch {
    return ''
  }
}

function walkDir(rootPath, legacyName, results, skipped) {
  if (!fs.existsSync(rootPath)) {
    skipped.push({ path: rootPath, reason: '目录不存在', legacy: legacyName })
    return
  }
  let entries
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true })
  } catch (e) {
    skipped.push({ path: rootPath, reason: `无法读取: ${e.message}`, legacy: legacyName })
    return
  }
  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue
      walkDir(fullPath, legacyName, results, skipped)
    } else if (entry.isFile()) {
      if (!isAuditable(fullPath)) {
        // 非审计扩展名跳过(不记录到 skipped,只是不审计)
        continue
      }
      const size = getFileSize(fullPath)
      const md5 = size > LARGE_FILE_THRESHOLD ? '' : computeMD5(fullPath)
      results.push({
        legacy: legacyName,
        path: fullPath,
        relPath: path.relative(rootPath.replace(legacyName, ''), fullPath),
        basename: path.basename(fullPath),
        ext: getFileExt(fullPath),
        size,
        md5,
      })
    }
  }
}

function walkNewRepo(rootPath, results, skipped) {
  if (!fs.existsSync(rootPath)) {
    skipped.push({ path: rootPath, reason: '目录不存在', legacy: 'IHUI-AI' })
    return
  }
  const entries = fs.readdirSync(rootPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue
      walkNewRepo(fullPath, results, skipped)
    } else if (entry.isFile()) {
      if (!isAuditable(fullPath)) continue
      const size = getFileSize(fullPath)
      const md5 = size > LARGE_FILE_THRESHOLD ? '' : computeMD5(fullPath)
      results.push({
        legacy: 'IHUI-AI',
        path: fullPath,
        relPath: path.relative('g:\\IHUI-AI', fullPath),
        basename: path.basename(fullPath),
        ext: getFileExt(fullPath),
        size,
        md5,
      })
    }
  }
}

// ─── 匹配策略 ───────────────────────────────────────────────────────
// 改进策略(第 2 轮):按 stem(去扩展名)匹配,适配语言迁移场景
//
// 已迁移: stem + MD5 相同(内容完全一致,如 i18n JSON)
// 已迁移(重写): stem 相同 + 大小相近(±50%)(可能是同功能但重写,如 Vue→React)
// 部分迁移: stem 相同但大小差异大(可能是部分功能合并)
// 缺失: stem 在新仓库无任何匹配
// 无需迁移: 扩展名在 NO_MIGRATE 清单(资源文件)
//
// 特殊处理:
// - Java 文件(UserController.java):提取 stem "UserController",尝试匹配 "user-controller" 等 kebab-case 形式
// - Vue 文件(UserList.vue):提取 stem "UserList",匹配新仓库 .tsx/.ts 同 stem 文件
// - i18n 文件(zh-CN.json 等):单独做 key 级比对(见 auditI18nKeys)

function normalizeStem(stem) {
  // CamelCase → kebab-case
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function matchFile(legacyFile, newFilesByStem, newFilesByNormalizedStem) {
  const stem = path.basename(legacyFile.basename, path.extname(legacyFile.basename))
  const normalizedStem = normalizeStem(stem)

  // 1. 精确 stem 匹配(去扩展名)
  const candidates = newFilesByStem.get(stem) || []

  // 2. 归一化 stem 匹配(CamelCase ↔ kebab-case)
  const normalizedCandidates = newFilesByNormalizedStem.get(normalizedStem) || []

  const allCandidates = [...candidates, ...normalizedCandidates.filter(c => !candidates.includes(c))]

  if (allCandidates.length === 0) {
    return { status: '缺失', newPath: '', reason: `stem 无匹配 (${stem} / ${normalizedStem})` }
  }

  // 检查 MD5 完全匹配
  if (legacyFile.md5) {
    for (const c of allCandidates) {
      if (c.md5 && c.md5 === legacyFile.md5) {
        return { status: '已迁移', newPath: c.path, reason: `MD5 完全匹配 (stem: ${stem})` }
      }
    }
  }

  // 检查大小相近(±50%)
  for (const c of allCandidates) {
    if (legacyFile.size > 0 && c.size > 0) {
      const ratio = c.size / legacyFile.size
      if (ratio >= 0.5 && ratio <= 2.0) {
        return { status: '已迁移(重写)', newPath: c.path, reason: `stem+大小相近(${ratio.toFixed(2)}x: ${stem})` }
      }
    }
  }

  // stem 匹配但大小差异大
  const newPaths = allCandidates.slice(0, 3).map(c => c.path).join(' | ')
  return { status: '部分迁移', newPath: newPaths, reason: `stem 匹配但大小差异大(${allCandidates.length} 个候选: ${stem})` }
}

// ─── 主流程 ─────────────────────────────────────────────────────────
function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportsDir = path.resolve('reports')
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

  console.log('=== 阶段 1:文件清单级迁移审计 ===\n')

  // 1. 扫描 D 盘历史项目
  console.log('扫描 D 盘历史项目...')
  const legacyFiles = []
  const skipped = []
  for (const root of LEGACY_ROOTS) {
    console.log(`  [${root.name}] ${root.path}`)
    const before = legacyFiles.length
    walkDir(root.path, root.name, legacyFiles, skipped)
    console.log(`    → ${legacyFiles.length - before} 个审计文件`)
  }
  console.log(`D 盘总计: ${legacyFiles.length} 个审计文件\n`)

  // 2. 扫描当前仓库
  console.log('扫描当前 IHUI-AI 仓库...')
  const newFiles = []
  for (const root of NEW_ROOTS) {
    console.log(`  ${root}`)
    walkNewRepo(root, newFiles, skipped)
  }
  console.log(`当前仓库总计: ${newFiles.length} 个审计文件\n`)

  // 3. 构建 stem 索引(精确 stem + 归一化 stem)
  const newFilesByStem = new Map()
  const newFilesByNormalizedStem = new Map()
  for (const f of newFiles) {
    const stem = path.basename(f.basename, path.extname(f.basename))
    const normalizedStem = normalizeStem(stem)
    if (!newFilesByStem.has(stem)) newFilesByStem.set(stem, [])
    newFilesByStem.get(stem).push(f)
    if (!newFilesByNormalizedStem.has(normalizedStem)) newFilesByNormalizedStem.set(normalizedStem, [])
    newFilesByNormalizedStem.get(normalizedStem).push(f)
  }

  // 4. 匹配
  console.log('执行 stem 匹配(适配语言迁移场景)...')
  const auditResults = []
  for (const lf of legacyFiles) {
    const match = matchFile(lf, newFilesByStem, newFilesByNormalizedStem)
    auditResults.push({
      legacy: lf.legacy,
      legacyPath: lf.path,
      legacySize: lf.size,
      legacyMD5: lf.md5,
      status: match.status,
      newPath: match.newPath,
      reason: match.reason,
    })
  }

  // 5. 分类统计
  const stats = {
    已迁移: 0,
    '已迁移(重写)': 0,
    部分迁移: 0,
    缺失: 0,
  }
  for (const r of auditResults) {
    if (stats[r.status] !== undefined) stats[r.status]++
  }

  console.log('\n=== 匹配结果统计 ===')
  console.log(`已迁移(MD5完全一致): ${stats['已迁移']}`)
  console.log(`已迁移(重写): ${stats['已迁移(重写)']}`)
  console.log(`部分迁移: ${stats['部分迁移']}`)
  console.log(`缺失: ${stats['缺失']}`)
  console.log(`总计: ${auditResults.length}`)

  // 6. 输出 CSV
  const csvPath = path.join(reportsDir, `migration-audit-${timestamp}.csv`)
  const csvLines = ['legacy,legacyPath,legacySize,legacyMD5,status,newPath,reason']
  for (const r of auditResults) {
    const escape = (s) => `"${String(s).replace(/"/g, '""')}"`
    csvLines.push([
      r.legacy, r.legacyPath, r.legacySize, r.legacyMD5,
      r.status, r.newPath, r.reason
    ].map(escape).join(','))
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')
  console.log(`\n审计 CSV: ${csvPath}`)

  // 7. 输出 skipped CSV
  const skippedPath = path.join(reportsDir, `migration-audit-skipped.csv`)
  const skippedLines = ['path,reason,legacy']
  for (const s of skipped) {
    const escape = (str) => `"${String(str).replace(/"/g, '""')}"`
    skippedLines.push([s.path, s.reason, s.legacy].map(escape).join(','))
  }
  fs.writeFileSync(skippedPath, skippedLines.join('\n'), 'utf8')
  console.log(`跳过 CSV: ${skippedPath}`)

  // 8. 输出 summary JSON
  const summaryPath = path.join(reportsDir, `migration-audit-summary.json`)
  const summary = {
    timestamp,
    legacyRoots: LEGACY_ROOTS.map(r => r.path),
    newRoots: NEW_ROOTS,
    legacyFilesTotal: legacyFiles.length,
    newFilesTotal: newFiles.length,
    stats,
    skippedCount: skipped.length,
    gDriveExists: fs.existsSync('G:\\code\\edu'),
    dDriveRoots: LEGACY_ROOTS.map(r => ({
      name: r.name,
      exists: fs.existsSync(r.path),
    })),
  }
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`摘要 JSON: ${summaryPath}`)

  // 9. G 盘 vs D 盘关系说明
  console.log('\n=== G 盘 vs D 盘关系 ===')
  if (summary.gDriveExists) {
    console.log('G:\\code\\edu 存在(原项目位置)')
    console.log('D:\\历史项目存档 可能是 G:\\code\\edu 的备份/快照')
  } else {
    console.log('G:\\code\\edu 不存在(原项目已迁移/删除)')
    console.log('D:\\历史项目存档 是唯一的历史项目副本')
  }
  console.log(`D 盘 6 个子项目存在性:`)
  for (const r of summary.dDriveRoots) {
    console.log(`  ${r.name}: ${r.exists ? '存在' : '不存在'}`)
  }

  // 10. 退出码
  if (auditResults.length === 0) {
    console.error('\n❌ 审计失败:无任何文件被审计')
    process.exit(1)
  }
  console.log('\n✅ 审计完成')
  process.exit(0)
}

main()
