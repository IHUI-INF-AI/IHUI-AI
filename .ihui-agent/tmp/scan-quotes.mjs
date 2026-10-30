// 扫描:行内单引号奇偶不平衡 ⇒ 疑似席位写坏了的未闭合字符串
import fs from 'node:fs'

const list = fs
  .readFileSync('.ihui-agent/tmp/p10-files.txt', 'utf8')
  .split(/\r?\n/)
  .filter((x) => /\.tsx?$/.test(x))
const bad = []
for (const f of list) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  lines.forEach((l, i) => {
    const s = l.replace(/\/\/.*$/, '')
    const n = (s.match(/'/g) || []).length
    if (n % 2 === 1) bad.push(`${f}:${i + 1}  ${l.trim().slice(0, 120)}`)
  })
}
console.log('奇数引号行数:', bad.length)
for (const b of bad) console.log('  ' + b)
