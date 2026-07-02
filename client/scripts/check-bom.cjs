/**
 * BOM 守门脚本 (CI / pre-commit)
 *
 * 作用: 扫描 src/locales/ 下所有 .json 文件, 拒绝含 BOM 的 JSON
 * 原因: zh-CN.json 历史上被反复同步叠加了双 BOM, 导致 JSON.parse 失败
 *
 * 用法:
 *   node scripts/check-bom.cjs                  # 严格模式 (有 BOM 即 fail)
 *   node scripts/check-bom.cjs --fix            # 自动去除 BOM
 *
 * 退出码:
 *   0 = 无 BOM (或 --fix 已修复)
 *   1 = 检测到 BOM (--strict 模式下 fail)
 */

const fs = require('fs')
const path = require('path')

const CLIENT_ROOT = path.join(__dirname, '..')
const LOCALES_DIR = path.join(CLIENT_ROOT, 'src', 'locales')

const fixMode = process.argv.includes('--fix')

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, files)
    else if (name.endsWith('.json')) files.push(p)
  }
  return files
}

function main() {
  const files = walk(LOCALES_DIR)
  const bomFiles = []

  for (const p of files) {
    const buf = fs.readFileSync(p)
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      bomFiles.push({ path: p, extraBOM: countExtraBOM(buf) })
    }
  }

  if (bomFiles.length === 0) {
    console.log(`✅ BOM 检查通过: ${files.length} 个 JSON 文件无 BOM`)
    return 0
  }

  if (fixMode) {
    for (const f of bomFiles) {
      let txt = fs.readFileSync(f.path, 'utf-8')
      while (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1)
      fs.writeFileSync(f.path, txt, 'utf-8')
      console.log(`  ✓ 已去除: ${path.relative(CLIENT_ROOT, f.path)} (${f.extraBOM} 个 BOM)`)
    }
    console.log(`✅ 已修复 ${bomFiles.length} 个文件`)
    return 0
  }

  console.log(`❌ 检测到 ${bomFiles.length} 个含 BOM 的 JSON 文件:`)
  for (const f of bomFiles) {
    console.log(`  - ${path.relative(CLIENT_ROOT, f.path)} (${f.extraBOM} 个 BOM)`)
  }
  console.log(`   修复方法: node scripts/check-bom.cjs --fix`)
  return 1
}

function countExtraBOM(buf) {
  let count = 0
  let i = 0
  while (i + 2 < buf.length && buf[i] === 0xef && buf[i + 1] === 0xbb && buf[i + 2] === 0xbf) {
    count++
    i += 3
  }
  return count
}

process.exit(main())
