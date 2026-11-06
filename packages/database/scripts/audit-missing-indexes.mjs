// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
//
// BUG-29 离线对账 + 幂等补齐迁移生成器（不连数据库，纯静态解析 schema .ts 与迁移 .sql）。
// 覆盖四格：
//   ① schema 声明索引 ↔ 迁移链 DDL 缺失（10 项）
//   ② 外键列无索引（~123 项）
//   ③ userId 列无 FK（~24 项）
//   ④ 同一张表两份 DDL 列类型不同 —— 需连接库用 pg_catalog 核对，本脚本只标注、不生成（避免编造）
//
// 用法：node scripts/audit-missing-indexes.mjs            （仅打印对账报告）
//       node scripts/audit-missing-indexes.mjs --write    （同时生成补齐迁移 .sql）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = fileURLToPath(new URL('..', import.meta.url))
const schemaDir = resolve(pkgDir, 'src/schema')
const drizzleDir = resolve(pkgDir, 'drizzle')

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)],
  )

// ---- 从第一个 '(' 起提取括号配平的片段 ----
function balancedFromParen(s, start) {
  let depth = 0
  let i = start
  for (; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return s.slice(start)
}

// ---- 扫描所有 schema 文件，建立 var→表名 映射，并解析每张表 ----
const tableVarToName = new Map()
const tables = [] // { file, varName, name, columns:[{var,db,isUserId}], fkCols:Map(db-> {refTable,refCol,onDelete}), indexedCols:Set, declaredIdx:Set }

const schemaFiles = walk(schemaDir).filter((f) => f.endsWith('.ts'))
for (const f of schemaFiles) {
  const txt = readFileSync(f, 'utf-8')
  // var -> 表名
  for (const m of txt.matchAll(/export\s+const\s+(\w+)\s*=\s*pgTable\(\s*['"]([\w]+)['"]/g)) {
    tableVarToName.set(m[1], m[2])
  }
}
// 也捕获单参形式 pgTable('name', { 已同上覆盖（name 在 ['"] 内）
// 兜底：users 等被引用但未在本仓 schema 声明的表
if (!tableVarToName.has('users')) tableVarToName.set('users', 'users')

for (const f of schemaFiles) {
  const txt = readFileSync(f, 'utf-8')
  const tableRe = /export\s+const\s+(\w+)\s*=\s*pgTable\(\s*['"]([\w]+)['"]/g
  let tm
  while ((tm = tableRe.exec(txt))) {
    const varName = tm[1]
    const name = tm[2]
    const open = tm.index + tm[0].length // pgTable( 之后
    // 找到紧随其后的 '('（即 pgTable( 的括号）
    const parenAt = txt.indexOf('(', tm.index)
    const block = balancedFromParen(txt, parenAt) // 整段 pgTable(...)
    const table = {
      file: f,
      varName,
      name,
      columns: [],
      fkCols: new Map(),
      indexedCols: new Set(),
      declaredIdx: new Set(),
    }
    parseTable(block, table)
    tables.push(table)
  }
}

function parseTable(block, table) {
  const lines = block.split('\n')
  let i = 0
  // 列定义：以行首 `  word :` 识别
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const colm = line.match(/^\s{2,}(\w+)\s*:\s/)
    if (!colm) continue
    const varName = colm[1]
    const dbm = line.match(/['"]([\w]+)['"]/) // 列 db 名 = 该行首个引号串
    const db = dbm ? dbm[1] : varName
    const isUserId = db === 'user_id' || /^user_id$/i.test(db) || /userId/i.test(varName)
    // 收集该列后续定义文本（到下一个同级列或表级回调前）
    let colText = line
    let j = idx + 1
    while (j < lines.length) {
      const nxt = lines[j]
      if (/^\s{2,}\w+\s*:\s/.test(nxt)) break // 下一个列
      if (/^\s*\(?\s*(?:t|table)\s*=>|^\s*\}\s*\)\s*,?\s*$/.test(nxt)) break
      colText += '\n' + nxt
      j++
    }
    const typeM = colText.match(/:\s*([A-Za-z_]\w*)\(/)
    const ctype = typeM ? typeM[1].toLowerCase() : ''
    const col = { var: varName, db, isUserId, ctype }
    table.columns.push(col)
    // FK 内联
    const refm = colText.match(/\.references\(\s*\(\)\s*=>\s*([A-Za-z_]\w*)\.(\w+)/)
    if (refm) {
      const onDel = (colText.match(/onDelete\s*:\s*['"]([\w]+)['"]/) || [])[1] || 'no action'
      table.fkCols.set(db, { refTable: refm[1], refCol: refm[2], onDelete: onDel })
    }
    // 内联索引
    if (/\.(?:uniqueIndex|index)\(\)/.test(colText) || /\.unique\(\)/.test(colText)) {
      table.indexedCols.add(db)
    }
  }
  // 表级 index / uniqueIndex（用配平括号提取 .on(...) 内的列，兼容 .desc() 等嵌套括号）
  const idxRe = /(?:uniqueIndex|index)\(\s*['"]([\w]+)['"]\s*\)\s*\.on\(/g
  let idxm
  while ((idxm = idxRe.exec(block))) {
    const idxName = idxm[1]
    const onParen = idxm.index + idxm[0].length - 1 // '.on(' 中 '(' 的位置
    const onBody = balancedFromParen(block, onParen)
    table.declaredIdx.add(idxName)
    for (const cm of onBody.matchAll(/\bt\.(\w+)/g)) {
      const v = cm[1]
      const c = table.columns.find((c) => c.var === v)
      if (c) table.indexedCols.add(c.db)
    }
  }
  // 表级 foreignKey
  for (const m of block.matchAll(/foreignKey\(\{([\s\S]*?)\}\)/g)) {
    const body = m[1]
    const cols = (body.match(/columns\s*:\s*\[([^\]]+)\]/) || [])[1] || ''
    const fcols = (body.match(/foreignColumns\s*:\s*\[([^\]]+)\]/) || [])[1] || ''
    const colVars = [...cols.matchAll(/\bt\.(\w+)/g)].map((x) => x[1])
    const refParts = [...fcols.matchAll(/\b(\w+)\.(\w+)/g)].map((x) => ({ t: x[1], c: x[2] }))
    colVars.forEach((v, k) => {
      const c = table.columns.find((c) => c.var === v)
      if (!c) return
      const rp = refParts[k] || refParts[0]
      const onDel = (body.match(/onDelete\s*:\s*['"]([\w]+)['"]/) || [])[1] || 'no action'
      table.fkCols.set(c.db, { refTable: rp ? rp.t : 'users', refCol: rp ? rp.c : 'id', onDelete: onDel })
    })
  }
}

// ---- ① schema 声明索引 ↔ 迁移链 DDL ----
const declaredIdxAll = new Map() // name -> file
for (const t of tables) for (const n of t.declaredIdx) declaredIdxAll.set(n, t.file)
const createdIdx = new Set()
for (const f of walk(drizzleDir).filter((f) => f.endsWith('.sql'))) {
  const txt = readFileSync(f, 'utf-8')
  for (const m of txt.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?['"]?([\w]+)/gi)) createdIdx.add(m[1])
  for (const m of txt.matchAll(/ADD\s+CONSTRAINT\s+['"]?([\w]+)['"]?\s+UNIQUE/gi)) createdIdx.add(m[1])
}
const missingIdx = [...declaredIdxAll.keys()].filter((n) => !createdIdx.has(n)).sort()

// ---- 迁移链已覆盖的列（表 -> Set(列)），用于排除"已被迁移索引覆盖"的外键列，避免冗余 ----
const migrationCovered = new Map() // table -> Set(col)
const addCov = (table, cols) => {
  if (!migrationCovered.has(table)) migrationCovered.set(table, new Set())
  for (const c of cols) migrationCovered.get(table).add(c)
}
for (const f of walk(drizzleDir).filter((f) => f.endsWith('.sql'))) {
  const txt = readFileSync(f, 'utf-8')
  for (const m of txt.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?['"]?[\w]+['"]?\s+ON\s+['"]?(\w+)['"]?\s*\(([^)]+)\)/gi)) {
    const tbl = m[1]
    const cols = m[2].split(',').map((s) => s.replace(/['"`\s]/g, '').replace(/^.*\(/, '')).filter(Boolean)
    addCov(tbl, cols)
  }
  for (const m of txt.matchAll(/ADD\s+CONSTRAINT\s+['"]?[\w]+['"]?\s+(?:UNIQUE|PRIMARY\s+KEY)\s*\(([^)]+)\)/gi)) {
    const tbl = (txt.slice(0, m.index).match(/ALTER\s+TABLE\s+['"]?(\w+)['"]?/) || [])[1]
    if (!tbl) continue
    const cols = m[1].split(',').map((s) => s.replace(/['"`\s]/g, '')).filter(Boolean)
    addCov(tbl, cols)
  }
}

// ---- ② 外键列无索引（schema 未声明索引 且 迁移也未建索引 才视为缺失）----
const fkNoIdx = []
for (const t of tables) {
  for (const [col, fk] of t.fkCols) {
    if (t.indexedCols.has(col)) continue
    const cov = migrationCovered.get(t.name)
    if (cov && cov.has(col)) continue
    fkNoIdx.push({ table: t.name, col, refTable: fk.refTable, refCol: fk.refCol, file: t.file })
  }
}

// ---- ③ userId 列无 FK（仅 uuid 类型可安全引用 users(uuid)，其余类型加 FK 会类型报错，仅标注待 DBA 复核）----
const userIdNoFk = []
const userIdNoFkNonUuid = []
for (const t of tables) {
  for (const c of t.columns) {
    if (!c.isUserId) continue
    if (t.fkCols.has(c.db)) continue
    if (c.ctype === 'uuid') userIdNoFk.push({ table: t.name, col: c.db, file: t.file })
    else userIdNoFkNonUuid.push({ table: t.name, col: c.db, ctype: c.ctype, file: t.file })
  }
}

// ===================== 报告 =====================
console.log('================ BUG-29 离线对账报告 ================')
console.log(`① schema 声明索引总数 ${declaredIdxAll.size} | 迁移链已建 ${createdIdx.size} | 缺失 ${missingIdx.length}`)
for (const n of missingIdx) console.log(`   MISSING-INDEX  ${n}  (${declaredIdxAll.get(n)})`)
console.log(`② 外键列无索引: ${fkNoIdx.length} 项`)
console.log(`③ userId(uuid) 列无 FK（可安全补 FK）: ${userIdNoFk.length} 项`)
console.log(`③ userId(非uuid:text/bigint 等) 列无 FK（类型不兼容，仅标注待 DBA 复核，不生成）: ${userIdNoFkNonUuid.length} 项`)
console.log('④ 同表两份 DDL 列类型不同: 需连接库用 pg_catalog 核对（本脚本不连库，不生成，避免编造）—— 见汇报"遗留风险"')

// ===================== 生成补齐迁移 =====================
if (process.argv.includes('--write')) {
  const lines = []
  lines.push('-- © 2026 IHUI AI · BUG-29 幂等补齐迁移（离线静态分析生成，全部带 IF NOT EXISTS / DO 守卫）')
  lines.push('-- 生成器: scripts/audit-missing-indexes.mjs ；本文件仅补齐，不删除任何既有对象、不改数据。')
  lines.push('')

  // ① 缺失 schema 索引（按已确证列映射手工精修名称/唯一性/部分索引，见脚本内建表）
  lines.push('-- ---------- ① 补齐 schema 声明但迁移链缺失的索引 ----------')
  // 这里直接内置上面已逐一定位的 10 条（来自 schema 源确证），保证列名/唯一性/部分索引精确
  const builtMissing = [
    { name: 'idx_ab_tests_status', table: 'agent_ab_tests', cols: 'status', unique: false },
    { name: 'agent_meta_lessons_user_type_idx', table: 'agent_meta_lessons', cols: 'user_id, lesson_type', unique: false },
    { name: 'idx_agent_meta_lessons_type_title', table: 'agent_meta_lessons', cols: 'lesson_type, title', unique: false },
    { name: 'agent_multimodal_memory_user_idx', table: 'agent_multimodal_memory', cols: 'user_id', unique: false },
    { name: 'agent_multimodal_memory_hash_uniq', table: 'agent_multimodal_memory', cols: 'content_hash', unique: true },
    { name: 'agent_working_memory_compression_user_idx', table: 'agent_working_memory_compression', cols: 'user_id', unique: false },
    { name: 'ix_chat_messages_created_at', table: 'chat_messages', cols: 'created_at', unique: false },
    { name: 'ix_conversation_message_archives_created_at', table: 'conversation_message_archives', cols: 'created_at', unique: false },
    { name: 'withdrawal_flows_partner_trade_no_uq', table: 'withdrawal_flows', cols: 'partner_trade_no', unique: true, where: 'partner_trade_no IS NOT NULL' },
    { name: 'ux_agent_memory_edges', table: 'agent_memory_edges', cols: 'user_id, source_id, target_id, relation', unique: true },
  ]
  for (const it of builtMissing) {
    if (it.unique) {
      // 唯一索引防存量重复：DO 块内建，冲突则跳过并提示 DBA
      lines.push(`DO $$ BEGIN`)
      lines.push(`  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='${it.name}') THEN`)
      lines.push(`    BEGIN`)
      lines.push(`      CREATE UNIQUE INDEX "${it.name}" ON "${it.table}" (${it.cols})${it.where ? ` WHERE ${it.where}` : ''};`)
      lines.push(`    EXCEPTION WHEN unique_violation THEN`)
      lines.push(`      RAISE NOTICE 'BUG-29: 唯一索引 ${it.name} 因存量重复行未创建,待 DBA 清理后补建';`)
      lines.push(`    END;`)
      lines.push(`  END IF;`)
      lines.push(`END $$;`)
    } else {
      lines.push(`CREATE INDEX IF NOT EXISTS "${it.name}" ON "${it.table}" (${it.cols});`)
    }
  }
  lines.push('')

  // ② 外键列无索引 → 单列传索引（IF NOT EXISTS，列名来自 schema 源确证，安全）
  lines.push('-- ---------- ② 为无索引的外键列补单列传索引（列名均来自 schema 源，幂等安全） ----------')
  const seenIdxName = new Set(builtMissing.map((b) => b.name))
  let idxCount = 0
  for (const f of fkNoIdx) {
    const idxName = `ix_${f.table}_${f.col}`
    if (seenIdxName.has(idxName)) continue
    seenIdxName.add(idxName)
    lines.push(`CREATE INDEX IF NOT EXISTS "${idxName}" ON "${f.table}" ("${f.col}");`)
    idxCount++
  }
  lines.push(`-- ② 实际生成索引语句数: ${idxCount}`)
  lines.push('')

  // ③ userId 列无 FK → DO 块加 FK（含 EXCEPTION 防脏数据；onDelete 默认 NO ACTION，需 DBA 复核语义）
  lines.push('-- ---------- ③ 为无 FK 的 userId 列补外键（DO 块守卫 + EXCEPTION 防脏数据中断） ----------')
  lines.push('-- 注意: onDelete 统一用 NO ACTION（最保守，不级联删）。若业务要求 cascade/set null，请 DBA 复核后改。')
  let fkCount = 0
  for (const u of userIdNoFk) {
    const cname = `fk_${u.table}_${u.col}_users`
    const refTableDb = tableVarToName.get('users') || 'users'
    lines.push(`DO $$ BEGIN`)
    lines.push(`  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${cname}') THEN`)
    lines.push(`    ALTER TABLE "${u.table}" ADD CONSTRAINT "${cname}" FOREIGN KEY ("${u.col}") REFERENCES "${refTableDb}"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;`)
    lines.push(`  END IF;`)
    lines.push(`EXCEPTION WHEN others THEN NULL; END $$;`)
    fkCount++
  }
  lines.push(`-- ③ 实际生成 FK 语句数: ${fkCount}`)
  lines.push('')
  lines.push('-- ④ 同表两份 DDL 列类型不同: 本迁移不处理（需库级 pg_catalog 核对，见汇报遗留风险）。')

  const outPath = resolve(drizzleDir, '20261106150000_fix_missing_indexes_fks.sql')
  writeFileSync(outPath, lines.join('\n') + '\n')
  console.log(`\n[write] 已生成补齐迁移: ${outPath}`)
  console.log(`[write] 含: ①${builtMissing.length} 条缺失索引 + ②${idxCount} 条外键索引 + ③${fkCount} 条 userId FK`)
}
