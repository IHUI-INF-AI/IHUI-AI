// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 临时验证脚本(任务收尾即删):把 check-sse-dispatch-parity 的判据按「工作树」跑一遍,
// 证明 D19 代码 + 台账在同一枚提交落地后该门必 exit 0(提交前 HEAD 看不到本票代码,属门设计使然)。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../../..')
const gate = await import(pathToFileURL(resolve(ROOT, 'scripts/check-sse-dispatch-parity.mjs')).href)
const data = JSON.parse(readFileSync(resolve(ROOT, 'scripts/data/sse-dispatch-coverage.json'), 'utf8'))
// 帧清单:client.ts 本票未动,工作树 == HEAD,直接读盘
const source = readFileSync(resolve(ROOT, 'packages/api-client/src/client.ts'), 'utf8')
const known = gate.extractCallbackNames(source)
const callbacks = gate.resolveFrameCallbacks(source, data.toolCallbacks)

// 命中集合:git grep 不带修订 = 工作树(与门的 HEAD/index 口径同判据,只差修订)
const hit = {}
for (const ep of Object.keys(data.endpoints)) hit[ep] = new Set()
let raw = ''
try {
  raw = execFileSync('git', ['-c', 'safe.directory=*', 'grep', '-o', '-E', callbacks.join('|'), '--', ...Object.values(data.endpoints).flat()], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 120000,
  })
} catch (e) {
  if (e?.status !== 1) throw e
  raw = typeof e?.stdout === 'string' ? e.stdout : ''
}
for (const line of raw.split('\n')) {
  if (!line) continue
  const idx = line.lastIndexOf(':')
  if (idx === -1) continue
  const file = line.slice(0, idx)
  const name = line.slice(idx + 1)
  for (const [ep, dirs] of Object.entries(data.endpoints)) {
    if (dirs.some((d) => file.startsWith(`${d}/`))) { hit[ep].add(name); break }
  }
}
const result = gate.evaluateDispatchParity({ hit, callbacks, known, data })
for (const w of result.warnings) console.log(`WARN ${w}`)
for (const e of result.errors) console.log(`ERR  ${e}`)
console.log(`worktree-sim: ok=${result.ok}  hits=${Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, v.size]))}`)
process.exit(result.ok ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
