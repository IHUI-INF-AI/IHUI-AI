#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对账矩阵生成器:把四份竞品/我方 inventory 清单归一后按 16 类骨架并排,标出"竞品有而我方无"。
// 全程只读输入;判定不了的一律落 undetermined 并计数(不得把"没解析到"写成"没有")。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || path.dirname(fileURLToPath(import.meta.url))
const FILES = {
  ours: 'ours/chat-stream-inventory.md',
  qoder: 'qoder/chat-stream-inventory.md',
  codex: 'codex/chat-stream-inventory.md',
  trae: 'trae/chat-stream-inventory.md',
  opencode: 'opencode/chat-stream-inventory.md',
}
// 16 类骨架的识别词(每类多个别名,防止各代理措辞不同)
const CATS = [
  ['1 消息与内容块', /消息气泡|内容块|气泡|markdown|代码块|表格|图表|mermaid|latex|artifact/i],
  ['2 思考与推理', /思考|推理|reasoning|thinking/i],
  ['3 工具调用卡', /工具调用|工具卡|tool.?call/i],
  ['4 终端与命令', /终端|命令执行|terminal|shell/i],
  ['5 文件与diff', /diff|代码变更|文件变更|accept.?reject|保留.?撤销|view.?changes/i],
  ['6 计划与待办', /计划|待办|todo|plan|checklist/i],
  ['7 子代理与后台', /子代理|subagent|专家|expert|后台任务|agent.?team/i],
  ['8 审批与权限', /审批|权限|approval|permission|沙箱|sandbox/i],
  ['9 上下文与压缩', /上下文|压缩|compact|context/i],
  ['10 引用与来源', /引用|来源|mention|citation|@/i],
  ['11 队列转向中断', /队列|转向|steer|中断|停止|queue/i],
  ['12 错误降级重试', /错误|降级|重试|fallback|error/i],
  ['13 计量与成本', /计量|成本|token|积分|credit|usage|cost/i],
  ['14 会话管理分享导出', /会话管理|分享|导出|fork|重命名|置顶|归档/i],
  ['15 模型与档位', /模型|档位|tier|reasoning.?effort|倍率|参数/i],
  ['16 记忆规则技能', /记忆|规则|memory|rules?|技能|skill|wiki|知识库/i],
]

function load(rel) {
  const p = path.join(BASE, rel)
  if (!fs.existsSync(p)) return { missing: true, p }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  const items = []
  let section = ''
  for (const raw of lines) {
    const l = raw.trim()
    if (!l) continue
    const hm = l.match(/^#{1,4}\s+(.+)$/)
    if (hm) { section = hm[1].trim(); continue }
    if (/^[-*]\s+/.test(l)) items.push({ section, text: l.replace(/^[-*]\s+/, '') })
  }
  return { p, lines: lines.length, items }
}

function catOf(item) {
  const hay = `${item.section} ${item.text}`
  const hits = CATS.filter(([, re]) => re.test(hay)).map(([n]) => n)
  return hits
}

const sides = {}
const status = {}
for (const [k, rel] of Object.entries(FILES)) {
  const r = load(rel)
  if (r.missing) { status[k] = '文件不在位(未交付或仍在写)'; sides[k] = null; continue }
  sides[k] = r.items
  status[k] = `${r.items.length} 条 / ${r.lines} 行`
}

console.log('# 取证物到位情况')
for (const [k, s] of Object.entries(status)) console.log(`  ${k.padEnd(9)} ${s}`)

const present = Object.entries(sides).filter(([, v]) => v)
if (!present.find(([k]) => k === 'ours')) { console.log('\n# 我方清单缺失 ⇒ 无法生成对账矩阵(这是"判不出",不是"无差距")'); process.exit(0) }

const rows = []
for (const [catName] of CATS) {
  const cell = {}
  for (const [k, items] of present) {
    const inCat = items.filter((i) => catOf(i).includes(catName))
    cell[k] = inCat
  }
  rows.push({ catName, cell })
}

console.log('\n# 分桶计数(每类各侧条目数;0 表示该份清单里没搜到该类,不等于该产品没有此能力)')
console.log('类别'.padEnd(22), present.map(([k]) => k).join('\t'))
for (const { catName, cell } of rows) {
  console.log(catName.padEnd(20), present.map(([k]) => String(cell[k].length)).join('\t\t'))
}

// 我方完全没有任何条目落入的类(强信号:该维我方无对应物)
console.log('\n# 我方清单里零条目的类别(需人工确认是"无对应物"还是"清单未覆盖")')
for (const { catName, cell } of rows) if ((cell.ours || []).length === 0) console.log('  · ' + catName)

console.log('\n# 竞品有、我方零条目的类别(逐类展开竞品原文供人工判读)')
for (const { catName, cell } of rows) {
  const rivals = present.filter(([k]) => k !== 'ours').filter(([k]) => (cell[k] || []).length > 0)
  if ((cell.ours || []).length === 0 && rivals.length) {
    console.log(`\n## ${catName} —— 竞品侧命中: ${rivals.map(([k]) => `${k}(${cell[k].length})`).join(', ')}`)
    for (const [k] of rivals.slice(0, 3)) for (const it of cell[k].slice(0, 6)) console.log(`   [${k}] ${it.text.slice(0, 190)}`)
  }
}
console.log('\n# 注:本器只做归一与并排,不下"该不该做"的结论;类别归属按关键词粗判,一条可归多类。')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
