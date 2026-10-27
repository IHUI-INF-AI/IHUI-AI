import { readFileSync, writeFileSync } from 'node:fs'

const PLAN = 'PROJECT_PLAN.md'
const text = readFileSync(PLAN, 'utf8')
const lines = text.split('\n')

const anchors = [
  '原编号 G-06;持有行题面「D16 Agent SDK 对外开放」',
  '原编号 G-18;持有行题面「G-100 把 file.aizhs.top 的 zone DNS 记录改指本机隧道」',
]

let n = 0
for (const a of anchors) {
  const matches = lines.filter((l) => l.includes(a))
  if (matches.length !== 1) {
    console.error(`ANCHOR NOT UNIQUE/FOUND (count=${matches.length}):`, a)
    process.exit(1)
  }
  const idx = lines.findIndex((l) => l.includes(a))
  lines.splice(idx, 1)
  n++
}
writeFileSync(PLAN, lines.join('\n'))
console.log('removed', n, 'lines from clean HEAD base')
