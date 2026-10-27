import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'

const PLAN = 'PROJECT_PLAN.md'
const LEDGER = '.ihui-agent/state/plan-row-drop.jsonl'

const text = readFileSync(PLAN, 'utf8')
const lines = text.split('\n') // pure LF confirmed

const anchors = [
  '原编号 G-06;持有行题面「D16 Agent SDK 对外开放」',
  '原编号 G-18;持有行题面「G-100 把 file.aizhs.top 的 zone DNS 记录改指本机隧道」',
]

const removed = []
for (const a of anchors) {
  const idx = lines.findIndex((l) => l.includes(a))
  if (idx < 0) {
    console.error('ANCHOR NOT FOUND:', a)
    process.exit(1)
  }
  if (lines.filter((l) => l.includes(a)).length !== 1) {
    console.error('ANCHOR NOT UNIQUE:', a)
    process.exit(1)
  }
  removed.push(lines[idx])
  lines.splice(idx, 1)
}

writeFileSync(PLAN, lines.join('\n'))

const at = new Date().toISOString()
const seat = 'machine-owner-auth-2026-10-27'
for (const rowBefore of removed) {
  const entry = {
    at,
    seat,
    file: 'PROJECT_PLAN.md',
    rowBefore,
    kind: 'stale-closed-sweep',
    reason:
      '机主2026-10-27授权删除重复登记副本行:内容已并入承载行(D16 Agent SDK 对外开放 / G-100 file.aizhs.top),本行系留作旧面存档的副本行,正式摘除',
  }
  appendFileSync(LEDGER, JSON.stringify(entry) + '\n', 'utf8')
}

console.log('REMOVED', removed.length, 'lines; appended', removed.length, 'ledger entries')
for (const r of removed) console.log('  -', r.slice(0, 80))
