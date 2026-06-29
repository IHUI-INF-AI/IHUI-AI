import { execSync } from 'node:child_process'

// 用 JSON format 解析（eslint 9 已移除 compact formatter）
let out = ''
try {
  out = execSync('npx eslint . --format json', {
    cwd: 'g:\\IHUI-AI\\client\\miniapp',
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 50 * 1024 * 1024,
  })
} catch (err) {
  // eslint 有 warnings 时 exit code 1，但 stdout 仍是有效 JSON
  out = err.stdout || err.stderr || ''
}

const data = JSON.parse(out || '[]')
const rules = {}
let total = 0
for (const file of data) {
  for (const msg of file.messages) {
    if (msg.severity === 1) {
      const ruleId = msg.ruleId || '(unknown)'
      rules[ruleId] = (rules[ruleId] || 0) + 1
      total++
    }
  }
}
console.log('total warnings:', total)
for (const [r, c] of Object.entries(rules).sort((a, b) => b[1] - a[1])) {
  console.log(c, r)
}
