// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/lib/pre-commit-hook.js` 被 require()/import() 时**不得执行任何流程**。
 *
 * 立因(2026-09-29 真实自伤):另一会话为读那张 `TOKEN_SYNC_TARGETS` 表而 import 本模块,于是整条
 * pre-commit 链在共享工作区上被真跑一遍 —— 第 0 步是 `git-lock.mjs clean`(它会删它判为 stale 的
 * `index.lock`),接着 lint-staged 对别人正暂存的 28 个文件跑 `prettier --write`/`eslint --fix`,
 * 并在"恢复未暂存改动"一步失败,把 7 个文件的未暂存内容留在 `lint-staged_unstaged.patch`。
 * `git status`、typecheck 与其余守门全都不响 —— 判据失效的表现永远是安静。
 *
 * 四条臂各自的用处:
 *  A 真 require 本模块 ⇒ stdout/stderr 必须全空、退出码必须 0(有守卫的直接行为证据)。
 *  B 形状锁 + 三个变异(纯字符串,**不执行本文件** —— 执行它本身就是本票要防的事)。
 *  C 机制证明(最小夹具双向)⇒ 证明 A 的"零输出"不是空转:`require` 不打印、直接执行必打印。
 *  D 装车证明:`.husky/pre-commit`(读 HEAD 面)仍把本文件当**脚本**直接执行 —— 摘线的话守卫再对也没人跑流程。
 */
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 找"第一次执行"必须在**代码面**上找(注释遮掉、字符串保留)。
// 不遮会这样红:守卫上方的说明文字里写了 `lint-staged` 与 `git-lock.mjs clean` 这两个词,
// 标记于是命中注释 ⇒ 报"守卫晚于第一次执行",而真实执行其实还在后面。
// ⚠️ 但遮罩面**不是等长的**(本机现测:守卫在原文面第 2142 字节、在遮罩面第 951 字节),
// 所以守卫与标记的下标必须都取自同一面 —— 一面一个下标去比大小,量到的是两张面的差,不是先后。
import { maskComments } from '../lib/code-mask.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const HOOK_REL = 'scripts/lib/pre-commit-hook.js'
const HOOK_ABS = path.join(ROOT, HOOK_REL).replace(/\\/g, '/')
const GUARD_HEAD = 'if (require.main !== module)'

const gitFace = (spec) =>
  execFileSync('git', ['-c', 'safe.directory=*', 'cat-file', 'blob', spec], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 32 << 20,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 文件里最早出现的那一次真执行(守卫必须排在它之前才算数)。 */
const FIRST_EXECUTION_MARKERS = [
  "execSync('node scripts/git-lock.mjs clean'",
  'const INITIAL_STAGED_SNAPSHOT = takeStagingSnapshot()',
  'auditStagingFiles()',
  'npx lint-staged',
]

/** 取守卫整块:从 `if (require.main !== module)` 到与之配平的换行 `}`。 */
function guardRange(src) {
  const start = src.indexOf(GUARD_HEAD)
  if (start < 0) return null
  // 块内允许 `module.exports = {}` 这种带花括号的语句,所以按"换行 + 顶格 } "收尾,而不是按第一个 } 收尾
  const end = src.indexOf('\n}', start)
  if (end < 0) return { start, end: -1 }
  return { start, end: end + 2 }
}

/**
 * 形状判据(只吃源码文本)。返回缺失项清单,空数组 = 合规。
 */
function guardProblem(src) {
  const miss = []
  // 守卫与执行标记**必须在同一张遮罩面上取字节序**(maskComments 会压缩长度,原文面与遮罩面的
  // 下标不可混用 —— 混用会造出自洽却错位的判据:实测守卫在原文面是 2142、遮罩面是 951)。
  const code = maskComments(src)
  const r = guardRange(code)
  if (!r) {
    miss.push('找不到"被 require 即返回"的守卫(条件必须认 require.main !== module)')
    return miss
  }
  if (r.end < 0) {
    miss.push('守卫块没有配平的顶格收尾(判据无法确定它管到哪一行)')
    return miss
  }
  const block = code.slice(r.start, r.end)
  if (!block.includes('module.exports')) miss.push('守卫块没有给导入方留 module.exports(被 require 会拿到 undefined)')
  if (!/\breturn\b/.test(block)) miss.push('守卫块没有 return(require 时会继续往下跑)')
  const firstExec = Math.min(
    ...FIRST_EXECUTION_MARKERS.map((m) => {
      const i = code.indexOf(m)
      return i < 0 ? Infinity : i
    }),
  )
  if (!Number.isFinite(firstExec)) {
    miss.push('源码里找不到任何一条已知执行标记 ⇒ 本形状锁对这一版失效,先修判据再谈通过')
    return miss
  }
  if (r.start > firstExec) miss.push(`守卫出现在第一次执行(第 ${firstExec} 字节)之后 ⇒ require 时流程已经跑起来了`)
  return miss
}

test('A 真 require 本模块:必须零输出、退出码 0', () => {
  // cwd 刻意放在 scratch —— 万一守卫被去掉,流程也只作用在一个空目录,碰不到真仓与共享索引。
  const dir = mkScratch('hook-import-arm-a')
  try {
    let out = ''
    let err = ''
    let code = 0
    try {
      out = execFileSync(process.execPath, ['-e', `require(${JSON.stringify(HOOK_ABS)})`], {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      code = e.status ?? -1
      out = e.stdout ?? ''
      err = e.stderr ?? ''
    }
    assert.equal(code, 0, `被 require 时不得改退出码(实得 ${code};stderr 前 300: ${String(err).slice(0, 300)})`)
    assert.equal(String(out).trim(), '', `被 require 时不得有 stdout(实得前 300: ${String(out).slice(0, 300)})`)
    assert.equal(String(err).trim(), '', `被 require 时不得有 stderr(实得前 300: ${String(err).slice(0, 300)})`)
  } finally {
    rmScratch(dir)
  }
})

test('B 形状锁:守卫要在位、要在第一次执行之前、条件必须认 require.main(三个变异各自翻红)', () => {
  const src = readFileSync(HOOK_ABS, 'utf8')
  assert.deepEqual(guardProblem(src), [], `当前面上的守卫不完整:${JSON.stringify(guardProblem(src))}`)

  const r = guardRange(src)
  assert.ok(r && r.end > 0, '取不到守卫块,变异臂无从构造')

  // 变异 1:整块删掉 ⇒ 必须报"找不到守卫"
  const noGuard = src.slice(0, r.start) + src.slice(r.end)
  assert.match(guardProblem(noGuard).join('|'), /找不到/, '删掉守卫必须翻红(否则本锁恒真)')

  // 变异 2:守卫挪到第一次执行之后 ⇒ 必须报"出现在…之后"
  const marker = "execSync('node scripts/git-lock.mjs clean'"
  const block = src.slice(r.start, r.end)
  const without = noGuard.replace(marker, `${marker}  // x`)
  const lateMoved = without.replace('  // x', `\n${block}`)
  assert.match(guardProblem(lateMoved).join('|'), /之后|找不到/, '守卫晚于第一次执行必须翻红')

  // 变异 3:条件写死成 true(那样生产路径也被砍掉)⇒ 必须报"找不到守卫"
  const alwaysReturn = src.replace(GUARD_HEAD, 'if (true)')
  assert.match(guardProblem(alwaysReturn).join('|'), /找不到/, '守卫不得被换成无条件 return(那等于把钩子整条摘线)')
})

test('C 机制证明:同一份"守卫 + 打印"夹具,require 不打印而直接执行必打印', () => {
  const dir = mkScratch('hook-import-arm-c')
  const probe = path.join(dir, 'probe.cjs')
  writeFileSync(
    probe,
    'if (require.main !== module) {\n  module.exports = {}\n  return\n}\nconsole.log(\'FLOW-RAN\')\n',
    'utf8',
  )
  const p = probe.replace(/\\/g, '/')
  try {
    const viaRequire = execFileSync(process.execPath, ['-e', `require(${JSON.stringify(p)})`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(!viaRequire.includes('FLOW-RAN'), '被 require 时最小夹具不得执行流程(否则 A 的"零输出"没有意义)')
    const viaRun = execFileSync(process.execPath, [p], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.match(viaRun, /FLOW-RAN/, '直接执行时最小夹具必须执行流程(否则"零输出"是空转而非守卫生效)')
  } finally {
    rmScratch(dir)
  }
})

test('D 装车证明:.husky/pre-commit 必须仍把本文件当脚本直接执行', () => {
  let husky = ''
  try {
    husky = gitFace('HEAD:.husky/pre-commit')
  } catch {
    assert.fail('读不到 HEAD 面的 .husky/pre-commit ⇒ 本臂无法判定,不得记为通过')
  }
  assert.match(husky, /pre-commit-hook\.js/, '钩子入口不再指向本文件 ⇒ 整条 pre-commit 逻辑无人调度')
  // 守卫只在"被导入"时生效;入口必须以 node 把它当脚本跑(经 wscript 包装是为了不弹窗,不是改成被 import)
  assert.match(husky, /node/, '入口必须以 node 直接执行本文件,否则 require.main 判据会把生产路径一起砍掉')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
