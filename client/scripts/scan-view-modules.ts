/**
 * 一次性脚本: 扫描 src/views/ 下所有 .vue 文件, 提取每个文件 t() 调用的 i18n 模块名
 * 输出: 每行 "Filename.vue: module1, module2, ..."
 * 用于人工判断哪个 route 需要加 beforeEnter: loadModule
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const VIEWS_DIR = path.join(ROOT, 'src', 'views')

function walk(dir: string, cb: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      walk(p, cb)
    } else if (e.name.endsWith('.vue')) {
      cb(p)
    }
  }
}

function extractModules(file: string): string[] {
  const content = fs.readFileSync(file, 'utf-8')
  const re = /\b(?:t|tSafe|\$t)\(\s*(['"])([a-zA-Z][a-zA-Z0-9_-]*)\b/g
  const modules = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    modules.add(m[2])
  }
  return Array.from(modules).sort()
}

const results: Array<{ file: string; modules: string[] }> = []
walk(VIEWS_DIR, (file) => {
  const modules = extractModules(file)
  if (modules.length > 0) {
    results.push({ file: path.relative(ROOT, file), modules })
  }
})

// 按模块数从多到少排序
results.sort((a, b) => b.modules.length - a.modules.length)
for (const r of results) {
  console.log(`${r.file.padEnd(50)} ${r.modules.join(', ')}`)
}
