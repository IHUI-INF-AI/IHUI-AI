#!/usr/bin/env node
/**
 * 删除 5 个孤键命名空间：hardcoded / data / text / title / return
 * 来源：旧 Java 项目硬编码字符串扫描器产物，Java→TS 迁移时原样保留
 * 验证：项目代码（apps/、packages/）0 处 t() 引用这些命名空间
 * 作用域：apps/web/messages/{zh-CN,en,zh-TW,ja,ko}.json（5 语言同步）
 */
import fs from 'node:fs'
import path from 'node:path'

const ORPHAN_NS = ['hardcoded', 'data', 'text', 'title', 'return']
const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko']
const DIR = path.resolve('apps/web/messages')

let totalRemoved = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.json`)
  const raw = fs.readFileSync(file, 'utf8')
  const obj = JSON.parse(raw)
  const before = Object.keys(obj).length
  const removed = {}
  for (const ns of ORPHAN_NS) {
    if (obj[ns]) {
      removed[ns] = Object.keys(obj[ns]).length
      delete obj[ns]
    }
  }
  const after = Object.keys(obj).length
  // 2-space indent，保持与现有文件风格一致
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8')
  const removedCount = before - after
  totalRemoved += removedCount
  console.log(`[${loc}] removed ${removedCount} namespaces: ${JSON.stringify(removed)}`)
}

console.log(`\nTotal: removed ${ORPHAN_NS.length} namespaces × ${LOCALES.length} locales = ${totalRemoved} namespace entries`)
