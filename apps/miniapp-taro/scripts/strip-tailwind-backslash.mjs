#!/usr/bin/env node
// postbuild 修复:Taro 4 + Tailwind 3 在小程序平台下生成的 CSS 类名包含
// 反斜杠转义(`.top-2\.5`、`.top-\[2rpx\]`、`\!visible`),微信 WXSS 编译器
// 不支持反斜杠转义,会报:
//   wxss 编译错误 ./app-origin.wxss(1:2234): unexpected `\` at pos 2234
// 此脚本在 Taro build 完成后扫描 dist/**/*.wxss,移除选择器内的反斜杠转义。
//
// 转换规则(CSS 标准的反斜杠转义,WXSS 不支持):
//   `\.X` → `.X`     (如 `top-2\.5` → `top-2.5`)
//   `\[X` → `[X`     (如 `top-\[2rpx\]` → `top-[2rpx]`)
//   `\]X` → `]X`
//   `\!X` → `!X`     (Tailwind important 语法 `\!visible` → `!visible`)
//   `\/X` → `/X`     (如 `1\/2` → `1/2`)
//
// 注意:反斜杠只出现在 Tailwind 转义类名里(我们的 src 用 `\[2rpx\]` 这种
// arbitrary value),去除后 WXSS 选择器可正常匹配,WXSS 接受裸 `.` `[` `]`
// 等字符作为类名的一部分(虽然 CSS 3 严格选择器语法不推荐,但 WXSS 子集 OK)。

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const TARGETS = [join(DIST, 'app-origin.wxss')]

function walkWxss(dir) {
  let results = []
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      const s = statSync(p)
      if (s.isDirectory()) results = results.concat(walkWxss(p))
      else if (p.endsWith('.wxss')) results.push(p)
    }
  } catch {}
  return results
}

TARGETS.push(...walkWxss(DIST))

// 反斜杠转义字符 → 字面字符(WXSS 接受)
const REPLACEMENTS = [
  [/\\([.\[\]!/:(),%#&*])/g, '$1'], // 上述 5 类
]

let totalReplaced = 0
let totalFiles = 0

for (const file of TARGETS) {
  const orig = readFileSync(file, 'utf-8')
  let newContent = orig
  for (const [pattern, replacement] of REPLACEMENTS) {
    newContent = newContent.replace(pattern, replacement)
  }
  if (newContent !== orig) {
    const diff = (orig.length - newContent.length) * -1
    const backslashCount = (orig.match(/\\[\.\[\]!/:(),%#&*]/g) || []).length
    writeFileSync(file, newContent, 'utf-8')
    console.log(`[strip-tailwind-backslash] ${file.replace(process.cwd() + '\\', '')}: ${backslashCount} escapes stripped`)
    totalReplaced += backslashCount
    totalFiles += 1
  }
}

console.log(`\n[strip-tailwind-backslash] ${totalFiles} files updated, ${totalReplaced} backslash escapes removed`)
