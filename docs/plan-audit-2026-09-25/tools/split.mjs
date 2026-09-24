import { readFileSync, writeFileSync } from 'node:fs'

const t = JSON.parse(readFileSync('.ihui-agent/tmp/plan-audit/tickets.json', 'utf8'))
const N = 8
const batches = Array.from({ length: N }, () => [])
t.forEach((x, i) => batches[i % N].push(x))
batches.forEach((b, i) => {
  const txt = b
    .map((x) => `【${x.id}】(台账 L${x.line})\n${x.text}\n`)
    .join('\n')
  writeFileSync(`.ihui-agent/tmp/plan-audit/batch-${i + 1}.md`, txt, 'utf8')
  console.log(`batch-${i + 1}.md  ${b.length} 票: ${b.map((x) => x.id).join(' ')}`)
})
