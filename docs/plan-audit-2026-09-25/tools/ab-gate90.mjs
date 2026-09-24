// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, existsSync, rmSync } from 'node:fs'

const P = 'scripts/data/sse-dispatch-coverage.json'
const SAVE = '.ihui-agent/tmp/plan-audit/ledger-mine.json'
const g = (...a) => execFileSync('git', ['-c', 'safe.directory=*', ...a], { encoding: 'utf8', maxBuffer: 64e6, windowsHide: true })
const mine = readFileSync(P, 'utf8')
copyFileSync(P, SAVE)

function measure(tag) {
  let out = ''
  let code = 0
  try {
    execFileSync(process.execPath, ['--test', 'scripts/tests/check-sse-dispatch-parity.test.mjs'], { encoding: 'utf8', windowsHide: true, maxBuffer: 64e6, timeout: 600000 })
  } catch (e) {
    code = e.status ?? -1
    out = ((e.stdout || '') + (e.stderr || '')).toString()
  }
  const fails = [...out.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1])
  const pass = /ℹ pass (\d+)/.exec(out)?.[1] ?? '?'
  const fail = /ℹ fail (\d+)/.exec(out)?.[1] ?? '?'
  console.log(`${tag}: exit=${code} pass=${pass} fail=${fail}`)
  fails.forEach((f) => console.log('   ✖ ' + f))
  return { code, fails: fails.sort() }
}

// A: 台账回到 HEAD 原样(未做任何修正)
g('checkout', 'HEAD', '--', P)
const a = measure('A 台账=HEAD 原样')
// B: 施加我的修正(删掉与代码相反的 onUsage 声明 + 随之孤儿的理由分组)
execFileSync(process.execPath, ['-e', `require('fs').writeFileSync('${P}', require('fs').readFileSync('${SAVE}','utf8'))`], { windowsHide: true })
const b = measure('B 台账=修正后')

const onlyMine = b.fails.filter((f) => !a.fails.includes(f))
const fixedByMe = a.fails.filter((f) => !b.fails.includes(f))
console.log(`\n结论: A 失败 ${a.fails.length} 项 / B 失败 ${b.fails.length} 项`)
console.log('  我的修正消掉的:', fixedByMe.length ? fixedByMe.join(' ; ') : '(无)')
console.log('  我的修正新增的:', onlyMine.length ? onlyMine.join(' ; ') : '(无 — 修正未引入新红)')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
