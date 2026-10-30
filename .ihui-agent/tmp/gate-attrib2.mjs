// 门链归因器 v2:直接喂 node 跑各包 tsc(绕开 pnpm .CMD 垫片),
// 并按 §0.3 把"rc≠0 却解析不到任何错误行"判成未判定,不再冒充绿。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const TSC = path.join(ROOT, 'node_modules/typescript/bin/tsc')
const ERR_RE = /^(?<file>[^\s(]+)\((?<line>\d+),\d+\): error TS\d+: (?<msg>.*)$/

// 阳性对照:判据必须先能吃下真错,否则"0 条"什么都不是
const probe = ERR_RE.exec('src/features/x/Foo.tsx(279,60): error TS2339: Property ' + "'bg'" + ' does not exist')
if (!probe) {
  console.error('❌ 解析器阳性对照失败(吃不下真错) ⇒ 本轮读数一律不作数')
  process.exit(2)
}
console.log('解析器阳性对照 OK:', probe.groups.file, probe.groups.line)

const listFile = path.join(ROOT, '.ihui-agent/tmp/p10-files.txt')
const mine = new Set(
  fs
    .readFileSync(listFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/')),
)
for (const s of [
  'apps/mobile-rn/src/navigation/RootNavigator.tsx',
  'packages/app/src/index.ts',
  'packages/api-client/src/index.ts',
  'packages/api-client/src/endpoints/private-letters.ts',
])
  mine.add(s)

const PKGS = [
  ['api-client', 'packages/api-client'],
  ['rn-app', 'packages/app'],
  ['mobile-rn', 'apps/mobile-rn'],
]
// tsc 的 cwd 是各包目录,所以它报的路径是"相对该包"(跨包时带 ../../)。
// 不归一化就比对不了:上一版用 endsWith 松比,把 q1 在飞的 KBArticleSearchScreen 误判成本票。
const toRepo = (pkgDir, file) => {
  const joined = path.posix.normalize(path.posix.join(pkgDir, file.replace(/\\/g, '/')))
  return joined.startsWith('../') ? file.replace(/\\/g, '/').replace(/^(\.\.\/)+/, '') : joined
}
let mineErr = 0
let undetermined = 0
const stdio = ['ignore', 'pipe', 'pipe']
for (const [name, dir] of PKGS) {
  let out = ''
  let code = 0
  try {
    out = execFileSync(process.execPath, [TSC, '--noEmit'], { cwd: path.join(ROOT, dir), stdio, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`
    code = typeof e.status === 'number' ? e.status : -1
  }
  const lines = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => ERR_RE.test(l))
  if (code !== 0 && lines.length === 0) {
    undetermined++
    console.log(`${name.padEnd(11)} rc=${code} 错误行 0 条 ⇒ 未判定(tsc 未真跑起来或输出形态变了),不记绿`)
    const first = out.split(/\r?\n/).filter(Boolean)[0] || '(空输出)'
    console.log(`   原始首行: ${String(first).slice(0, 200)}`)
    continue
  }
  const hit = lines.filter((l) => mine.has(toRepo(dir, ERR_RE.exec(l).groups.file)))
  const other = lines.filter((l) => !mine.has(toRepo(dir, ERR_RE.exec(l).groups.file)))
  mineErr += hit.length
  console.log(`${name.padEnd(11)} rc=${code} 总错=${lines.length} 本票=${hit.length} 他席在飞=${other.length}`)
  for (const l of hit) console.log('   ⛔ ' + toRepo(dir, ERR_RE.exec(l).groups.file) + ' :: ' + l.slice(0, 160))
}
if (undetermined) {
  console.log(`有 ${undetermined} 包未判定 ⇒ 整体 exit 2`)
  process.exit(2)
}
console.log(mineErr === 0 ? '本票归因:三包 tsc 零错 ⇒ 绿' : `本票归因:${mineErr} 条需修`)
process.exit(mineErr === 0 ? 0 : 1)
