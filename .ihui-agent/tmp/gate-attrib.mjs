// 门链归因器:三包 tsc 输出按"本票声明集"过滤,他席在飞文件的报错单独计数不归本票。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const mine = new Set(
  fs
    .readFileSync(fs.existsSync(`${ROOT}/.ihui-agent/tmp/p10-files.txt`) ? `${ROOT}/.ihui-agent/tmp/p10-files.txt` : `${ROOT}/.ihui-agent/tmp/none.txt`, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/')),
)
const shared = [
  'apps/mobile-rn/src/navigation/RootNavigator.tsx',
  'packages/app/src/index.ts',
  'packages/api-client/src/index.ts',
  'packages/api-client/src/endpoints/private-letters.ts',
]
for (const s of shared) mine.add(s)

const stdio = ['ignore', 'pipe', 'pipe']
const PKGS = ['@ihui/api-client', '@ihui/rn-app', '@ihui/mobile-rn']
let totalMine = 0
for (const pkg of PKGS) {
  let out = ''
  let code = 0
  try {
    out = execFileSync('pnpm', ['-F', pkg, 'exec', 'tsc', '--noEmit'], { cwd: ROOT, stdio, encoding: 'utf8' })
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`
    code = e.status ?? 1
  }
  const errs = (out.match(/^[^\s].*error TS\d*:.*$/gm) || []).map((l) => l.trim())
  const norm = (f) => f.replace(/^.*?(packages\/|apps\/)/, '$1').replace(/(\.tsx?|\.d\.ts):(\d+).*/, '$1:$2')
  const hitMine = errs.filter((l) => {
    const f = norm(l.split('(')[0])
    return [...mine].some((m) => f === m || f.endsWith(m))
  })
  totalMine += hitMine.length
  console.log(
    `${pkg.padEnd(18)} rc=${code} 总错=${errs.length} 本票=${hitMine.length} 他席在飞=${errs.length - hitMine.length}`,
  )
  for (const l of hitMine) console.log('   ⛔ ' + l.slice(0, 180))
}
console.log(totalMine === 0 ? '本票归因:三包零错 ⇒ 绿' : `本票归因:${totalMine} 条需修`)
process.exit(totalMine === 0 ? 0 : 1)
