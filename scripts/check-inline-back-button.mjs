#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 统一返回键防私接守门(2026-09-09 立,统一返回键收敛任务的根治配套)
// 规则:web 端 router.back() / history.back() 是统一返回键的专属行为,
//       只允许出现在 GlobalTopBar.tsx(顶栏唯一渲染点)。
//       页面需要返回键 = 声明而非实现:useTopBarBack(config) / <BackButton fallbackHref />,
//       二级及以上子页面由 TopBarBackAutoRegister 自动声明,零代码。
//       页面私写 router.back() 会导致返回行为绕过顶栏统一返回键(动画/降级/优先级全部失效)。
// 豁免:apps/web/src/components/layout/GlobalTopBar.tsx(统一返回键本体);
//       注释行(* / //)自动跳过,避免文档性提及误报。
// 用法:node scripts/check-inline-back-button.mjs            (全量扫描)
//       node scripts/check-inline-back-button.mjs --staged   (仅扫描 staged 文件)
// 紧急跳过:HUSKY_SKIP_INLINE_BACK_GUARD=1 git commit ...
import { readFileSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const TARGET_DIR = 'apps/web/src'
// 统一返回键唯一实现点(顶栏)
const ALLOWLIST = ['apps/web/src/components/layout/GlobalTopBar.tsx']
const BANNED = [/router\.back\(/, /history\.back\(/]

function listFiles(dir, out = []) {
  for (const name of readdirSafe(path.join(ROOT, dir))) {
    const full = path.join(ROOT, dir, name)
    const st = statSync(full)
    if (st.isDirectory()) listFiles(path.join(dir, name), out)
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(path.join(dir, name))
  }
  return out
}

function readdirSafe(p) {
  try {
    return execSync(`node -e "console.log(require('fs').readdirSync(process.argv[1]).join('\\n'))" "${p}"`, {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

function isCommentLine(line) {
  const t = line.trimStart()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

function scanStaged() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8', cwd: ROOT })
  return out.split('\n').filter((f) => f.startsWith(TARGET_DIR) && /\.(ts|tsx|mjs|js)$/.test(f))
}

const staged = process.argv.includes('--staged')
const files = staged ? scanStaged() : listFiles(TARGET_DIR)
const violations = []

for (const rel of files) {
  if (ALLOWLIST.includes(rel.replace(/\\/g, '/'))) continue
  let content
  try {
    content = readFileSync(path.join(ROOT, rel), 'utf8')
  } catch {
    continue
  }
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    if (isCommentLine(line)) return
    if (BANNED.some((re) => re.test(line))) {
      violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`)
    }
  })
}

if (violations.length > 0) {
  console.error('❌ 统一返回键守门:发现页面私接 router.back()/history.back()(绕过顶栏统一返回键)')
  for (const v of violations) console.error(`   ${v}`)
  console.error('')
  console.error('   修复方式(声明而非实现):')
  console.error('   - 二级及以上子页面:零代码,TopBarBackAutoRegister 已自动声明')
  console.error('   - 页内视图级返回(详情→列表):useTopBarBack(selected ? { onBack: () => setX(null) } : null)')
  console.error('   - 指定降级路由:<BackButton fallbackHref="/parent" />')
  process.exit(1)
}

console.log(`✅ 统一返回键守门通过(${files.length} 个文件,0 处私接 back)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
