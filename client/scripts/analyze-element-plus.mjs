import { readdirSync, statSync, readFileSync } from 'fs'
import { join, extname } from 'path'

const SRC = join(process.cwd(), 'src')
const EXT = new Set(['.vue', '.ts', '.tsx', '.js'])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      walk(p, files)
    } else if (EXT.has(extname(name))) {
      files.push(p)
    }
  }
  return files
}

const files = walk(SRC)

// 1. 手动 import from 'element-plus' 的文件
const manualImport = []
for (const f of files) {
  const txt = readFileSync(f, 'utf8')
  if (/from\s+['"]element-plus['"]/.test(txt)) {
    const matches = txt.match(/El[A-Z][A-Za-z0-9]+/g) || []
    manualImport.push({ file: f.replace(SRC, 'src'), components: [...new Set(matches)] })
  }
}

// 2. 模板中使用 el-xxx 但未在 import 中显式 import 的文件
const templateUse = []
for (const f of files) {
  if (!f.endsWith('.vue')) continue
  const txt = readFileSync(f, 'utf8')
  const template = txt.match(/<template>([\s\S]*?)<\/template>/)?.[1] || ''
  const tags = [...new Set(template.match(/<el-[a-z-]+/g) || [])].map(t => t.slice(1))
  if (tags.length === 0) continue
  // 检查 import 中是否有这些
  const hasManualImport = /from\s+['"]element-plus['"]/.test(txt)
  if (!hasManualImport) {
    templateUse.push({ file: f.replace(SRC, 'src'), tags: tags.length })
  }
}

console.log(`📊 Element Plus 使用情况扫描结果\n`)
console.log(`📦 手动 import 'element-plus' 的文件：${manualImport.length}`)
console.log(`   (这些组件会被 unplugin-vue-components 之外的代码引用)\n`)

// 统计手动 import 的组件种类
const manualCompCount = {}
for (const { components } of manualImport) {
  for (const c of components) {
    manualCompCount[c] = (manualCompCount[c] || 0) + 1
  }
}
console.log('   Top 手动 import 组件:')
const sorted = Object.entries(manualCompCount).sort((a, b) => b[1] - a[1]).slice(0, 20)
for (const [c, n] of sorted) {
  console.log(`     ${c.padEnd(20)} × ${n}`)
}

console.log(`\n🎨 仅模板使用 el-xxx 的文件：${templateUse.length}`)
console.log(`   (这些靠 unplugin-vue-components 自动按需引入)`)
