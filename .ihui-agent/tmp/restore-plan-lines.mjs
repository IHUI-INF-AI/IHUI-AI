// 门 71 报失的 3 条登记行:从 HEAD(本侧合并前)逐字取回,按内容锚点插回索引面副本。
// 不用行号(一次 append 就挪位),用"前一条在面上仍存在"定位。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const stdio = ['ignore', 'pipe', 'pipe']
const show = (rev) => execFileSync('git', ['show', rev], { cwd: 'D:/IHUI-AI-wt/gap-screens', stdio, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

const MARKS = ['D01 对话内 Agent 选择器', 'H01 冷启动抢跑全仓盘点余量', 'G-08 **合并落地闸']

const headLines = show('HEAD:PROJECT_PLAN.md').split(/\r?\n/)
const curPath = 'D:/IHUI-AI-wt/gap-screens/PROJECT_PLAN.md'
const cur = fs.readFileSync(curPath, 'utf8').split(/\r?\n/)

const targets = []
for (const m of MARKS) {
  const idx = headLines.findIndex((l) => l.includes(m))
  if (idx < 0) {
    console.error(`HEAD 面找不到标记: ${m} ⇒ 未判定,不落盘`)
    process.exit(2)
  }
  if (cur.some((l) => l.includes(m))) {
    console.log(`已在面上,跳过: ${m}`)
    continue
  }
  targets.push({ mark: m, line: headLines[idx], at: idx })
}
if (!targets.length) {
  console.log('零条需回补')
  process.exit(0)
}

// 从末条往前插,避免下标漂移
for (const t of targets.sort((a, b) => b.at - a.at)) {
  let anchor = null
  for (let i = t.at - 1; i >= 0; i--) {
    const j = cur.findIndex((l) => l === headLines[i])
    if (j >= 0) {
      anchor = j
      break
    }
  }
  if (anchor === null) {
    console.log(`⚠️ ${t.mark} 无逐字前像锚点 ⇒ 追加到文末(不回捞不等于丢行)`)
    cur.push(t.line)
  } else {
    cur.splice(anchor + 1, 0, t.line)
    console.log(`✓ ${t.mark} 回补至第 ${anchor + 2} 行(锚=前一条逐字存在)`)
  }
}

fs.writeFileSync(curPath, cur.join('\n'))
const after = fs.readFileSync(curPath, 'utf8')
const missing = MARKS.filter((m) => !after.includes(m))
console.log('回补后仍缺:', missing.length ? missing.join(' | ') : '无')
process.exit(missing.length ? 2 : 0)
