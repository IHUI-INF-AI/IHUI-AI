import fs from 'node:fs'
const filePath = 'packages/i18n/messages/web/zh-TW.json'
let text = fs.readFileSync(filePath, 'utf8')

// 直接修复两处已知问题
const replacements = [
  ['自動采集', '自動採集'],
]

for (const [from, to] of replacements) {
  if (text.includes(from)) {
    text = text.split(from).join(to)
    console.log(`修复: ${from} -> ${to}`)
  }
}

fs.writeFileSync(filePath, text, 'utf8')
console.log('Done')
