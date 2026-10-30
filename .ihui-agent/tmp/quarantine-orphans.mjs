// 把 22 个在飞席位被掐断留下的孤儿件移入隔离区(不删,保留原路径映射,便于日后接手)。
// 立因:未跟踪件仍会被 packages/app / apps/mobile-rn 的整包 tsc 编进去,
//       实测一枚截断文件(skills-market-detail)让全量 typecheck 判红,挡住本枚落地的真实信号。
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const HOLD = path.join(ROOT, '.ihui-agent/tmp/wave3-quarantine')
const stdio = ['ignore', 'pipe', 'pipe']

const out = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, stdio, encoding: 'utf8' })
const files = out.split(/\r?\n/).filter(Boolean).filter((p) => !p.startsWith('.ihui-agent/'))
console.log('待隔离孤儿件:', files.length)
fs.mkdirSync(HOLD, { recursive: true })

const map = []
for (const p of files) {
  const src = path.join(ROOT, p)
  const dst = path.join(HOLD, p)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.renameSync(src, dst)
  map.push({ from: p, to: path.relative(ROOT, dst).replace(/\\/g, '/'), bytes: fs.statSync(dst).size })
}
// 空目录收掉(席位建的目录壳)
for (const d of ['packages/app/src/features/knowledge-base', 'packages/app/src/features/knowledge-card']) {
  const abs = path.join(ROOT, d)
  if (fs.existsSync(abs) && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs)
}
fs.writeFileSync(
  path.join(ROOT, '.ihui-agent/tmp/wave3-quarantine.json'),
  JSON.stringify({ at: new Date().toISOString(), reason: '席位撞 150 轮/配额上限,产物未验证且会污染整包 tsc', files: map }, null, 2),
)
console.log('已隔离', map.length, '件 ⇒', path.relative(ROOT, HOLD).replace(/\\/g, '/'))
console.log('登记面复量:未跟踪非 .ihui-agent 件 =', execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, stdio, encoding: 'utf8' }).split(/\r?\n/).filter((x) => x && !x.startsWith('.ihui-agent/')).length)
