// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1018289 ③ 的镜像测试:`scripts/git-push-converge.mjs` 的仓根与 git 二进制不得跟着调用方走。
 *
 * 判据对象是"这一把从别的目录跑,报的还是不是本仓"。两条腿:
 *  - **行为腿(T1/T2)**:把 cwd 换成一个**独立的临时 git 仓**去跑真脚本(空 remotes ⇒ 零网络),
 *    输出里的 `本地 HEAD:` 必须是**本仓** HEAD;换到别的仓时必须**不**变成那仓的 sha。
 *    这是唯一能证明"钉住了"的形态 —— 形状锁只能证明写法,证不了写法真起作用。
 *  - **形状腿(T3/T4)**:源码面必须真的给两处派生都传了 `cwd`,且 git 走 `resolveGitBin()`
 *    而不是裸 `'git'`(AGENTS §5b)。反向锁 T4 钉"不得再出现 `process.cwd()` 拼 push-state"。
 * 例数一律以命令末行为准,文档不钉数字。
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { maskComments } from '../lib/code-mask.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GIT = resolveGitBin() || 'git'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const TOOL = join(REPO, 'scripts', 'git-push-converge.mjs')

/** 取某一棵树的 HEAD:走 git 自己的结论,不在测试里重算 sha。 */
function headOf(dir) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', 'rev-parse', 'HEAD'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 30_000,
  }).trim()
}

function mkTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-converge-cwd-'))
  const run = (args) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 60_000,
    })
  run(['init', '-q', '.'])
  run(['config', 'user.email', 'probe@example.invalid'])
  run(['config', 'user.name', 'probe'])
  writeFileSync(join(dir, 'a.txt'), 'probe\n', 'utf8')
  run(['add', 'a.txt'])
  run(['commit', '-q', '-m', 'probe'])
  return dir
}

/** 跑真工具:空 remotes ⇒ 不进任何网络/推送分支,只走本地取数与打印。 */
function runToolFrom(cwd) {
  return execFileSync(process.execPath, [TOOL, '--remotes='], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
}

let tempDir = null
test('T1 从别的目录跑,报的仍是本仓 HEAD(行为腿:证明 ROOT 真起作用)', () => {
  const want = headOf(REPO)
  assert.match(want, /^[0-9a-f]{40}$/, '本仓 HEAD 取不到 ⇒ 判据没条件下结论')
  const out = runToolFrom(REPO)
  const got = out.match(/本地 HEAD:\s*([0-9a-f]{11,40})/)?.[1]
  assert.ok(got, `输出里没有"本地 HEAD:"这一行:\n${out.slice(0, 400)}`)
  assert.equal(want.startsWith(got), true, `在仓内跑都对不上:工具报 ${got},权威值 ${want}`)
})

test('T2 把 cwd 换成另一个 git 仓,结论不得跟着变成那仓的 HEAD', () => {
  tempDir = mkTempRepo()
  const foreign = headOf(tempDir)
  assert.match(foreign, /^[0-9a-f]{40}$/)
  const out = runToolFrom(tempDir)
  const got = out.match(/本地 HEAD:\s*([0-9a-f]{11,40})/)?.[1]
  assert.ok(got, `输出里没有"本地 HEAD:"这一行:\n${out.slice(0, 400)}`)
  assert.notEqual(foreign.startsWith(got), true, '工具把**调用方那一棵树**的 HEAD 报成了结论 ⇒ cwd 依赖没修掉')
  assert.equal(headOf(REPO).startsWith(got), true, `钉根后应当恒报本仓 HEAD,实测 ${got}`)
})

/**
 * 形状锁一律判**代码面**(只遮注释、保留字符串)。
 * 立因(本仓记过多次的那一型):本文件上面那段"为什么钉根"的说明里逐字引用了旧写法
 * `process.cwd()` 与裸 `'git'` —— 拿原文判形状锁,门就会把**解释自己的散文**判成违规
 * (守门 131 的注释态假阳、门 70 的 URL 假注释态同型)。
 * 遮罩实现只引 `scripts/lib/code-mask.mjs` 那一份,不在测试里再抄一份状态机。
 */
function codeFace() {
  return maskComments(readFileSync(TOOL, 'utf8'))
}

test('T3 两处派生都必须显式传 cwd,且 git 走唯一出口而不是裸 PATH 名', () => {
  const src = codeFace()
  const cwdHits = src.match(/cwd:\s*ROOT/g) || []
  assert.ok(cwdHits.length >= 2, `git()/gitWithOutput() 应有至少两处 cwd: ROOT,现读 ${cwdHits.length} 处`)
  assert.match(src, /from '\.\/lib\/gitdir\.mjs'/, '未引用唯一出口 scripts/lib/gitdir.mjs')
  assert.match(src, /resolveGitBin\(\)/, 'git 二进制未经 resolveGitBin()(AGENTS §5b:脚本不得依赖环境取 git)')
  assert.doesNotMatch(src, /execFileSync\(\s*'git'/, '仍有按裸 `git`(PATH)派生的调用')
})

test('T4 push-state 不得再由 process.cwd() 拼出来(反向锁:回潮即红)', () => {
  const src = codeFace()
  assert.doesNotMatch(src, /process\.cwd\(\)/, '代码面重新出现 process.cwd() ⇒ 那一处读数会跟着调用方终端走')
  assert.match(src, /resolve\(\s*ROOT\s*,\s*'\.workbuddy\/push-state\.json'\s*\)/, 'push-state 必须钉在 ROOT 上读')
})

test('T5 遮罩必须真起作用:同一句旧写法只出现在注释里时不得判红,写进代码里必须判红(成对)', () => {
  // 正例:把旧写法放进注释 → 代码面干净 → T4 型判据必须放过
  assert.equal(/process\.cwd\(\)/.test(codeFace()), false, '注释里的散文引用被读成了违规(遮罩没生效)')
  assert.match(readFileSync(TOOL, 'utf8'), /process\.cwd\(\)/, '夹具前提被破坏:原文里已没有那处散文引用,这条成对对照就没有牙了')
  // 反例(构造面):同一形态出现在代码位上必须命中
  const poisoned = codeFace().replace(
    /const ROOT = resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\), '\.\.'\)/,
    "const ROOT = process.cwd()",
  )
  assert.notEqual(poisoned, codeFace(), '构造变异的锚点没命中 ⇒ 这条反例是空跑')
  assert.match(poisoned, /process\.cwd\(\)/, '把 ROOT 换成 cwd 后必须能被判出 ⇒ 否则 T4 是恒绿断言')
})

test('T6 guard 自愈分支的相对脚本路径,靠 cwd:ROOT 才成立(证明这一处不是顺手加参数)', () => {
  const src = codeFace()
  assert.match(src, /'scripts\/git-push-guard\.mjs'/, 'healViaGuard 仍应经本仓相对路径调 guard(它成立的前提就是 gitWithOutput 传了 cwd)')
  assert.match(src, /function\s+gitWithOutput[\s\S]{0,400}cwd:\s*ROOT/, 'gitWithOutput 没有把 cwd 传下去 ⇒ 相对路径会指向调用方那一棵树')
})

test.after(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
