// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 临时工具:用**私有 index** 构造提交,绕开共享暂存区。
// 问题背景:本仓是多 agent 并行工作区,共享暂存区被别的会话反复污染
// (实测本轮从 3 个被冲到 8 个、32 个,甚至 178 个)。手动重清不可靠且不是解法:
// `git reset -q HEAD` 在本机清不干净,逐个 restore --staged 又会被对方在窗口期写回。
// 正解 = 私有 index:`GIT_INDEX_FILE` 指向我们自己造的那份,git commit / pre-commit hook /
// lint-staged 三者**都**沿用它(lint-staged 的 activeIndexFile 读 process.env.GIT_INDEX_FILE,
// 见 node_modules/lint-staged/lib/gitWorkflow.js:376),于是全程不碰共享暂存区。
//
// 为什么本机必须这么做(三条,都是实测):
//   ① 共享暂存区是**别人的资产**,清它 = 改别人的工作面(本会话已因此多次被"污染后重清"拖住);
//   ② `git reset -q HEAD` 在本机不可靠(清完仍剩 31 个);逐个 `git restore --staged` 才清得掉,
//      但存在窗口期,对方一写就前功尽弃;
//   ③ 私有 index 全程零接触共享面 ⇒ 无论对方怎么写暂存区,都不影响本提交。
//
// 用法:node .ihui-agent/tmp/commit-with-private-index.mjs <msgFile> <file...>
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const GITDIR = 'D:/IHUI-AI-git-repo'
const REPO = 'D:/IHUI-AI'

function git(args, env = process.env) {
  return execFileSync('git', args, {
    cwd: REPO,
    encoding: 'utf8',
    // 本宿主派生 git 必须显式接管 stdio(不写则 spawnSync git EBUSY,30/30 实测)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 3_000_000,
    maxBuffer: 1 << 28,
    env,
  }).trim()
}

function gitTry(args, env = process.env) {
  try {
    return { ok: git(args, env) }
  } catch (e) {
    return { err: ((e?.stderr ?? e?.message ?? String(e)) + '').trim() }
  }
}

const [msgFile, ...files] = process.argv.slice(2)
if (!msgFile || !files.length) {
  console.error('用法:node commit-with-private-index.mjs <msgFile> <file...>')
  process.exit(2)
}

const privIndex = join(GITDIR, `tmp-privindex-${process.pid}-${Date.now()}`)

// 清掉可能残留的上一次私有 index(只碰自己命名空间里的 tmp-privindex-*,不碰共享面)
for (const stale of ['tmp-privindex-prev']) {
  const p = join(GITDIR, stale)
  if (existsSync(p)) rmSync(p, { force: true })
}

const env = { ...process.env, GIT_INDEX_FILE: privIndex }

try {
  // ① 私有 index 从 HEAD 造 ⇒ 起点就是"什么都没改",不继承共享暂存区的任何东西
  const r0 = gitTry(['read-tree', 'HEAD'], env)
  if (r0.err) {
    console.error(`❌ 私有 index 初始化失败:${r0.err.split('\n')[0]}`)
    process.exit(1)
  }

  // ② 只加自己声明的文件(逐个 add,不用 pathspec 提交,故不受 128 pathspec 那个坑)
  const added = []
  const failed = []
  for (const f of files) {
    const r = gitTry(['add', '-A', '--', f], env)
    if (r.err) failed.push(`${f} :: ${r.err.split('\n')[0]}`)
    else added.push(f)
  }
  if (failed.length) {
    console.error(`❌ 有 ${failed.length} 个文件未能加入私有 index:`)
    for (const x of failed) console.error('   ' + x)
    process.exit(1)
  }

  // ③ 校验私有 index 逐字等于声明面(本仓铁律:提交面必须自己验过,不能想当然)
  const staged = git(['-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--no-renames'], env)
    .split('\n')
    .filter(Boolean)
    .sort()
  const want = files.slice().sort()
  if (staged.join('|') !== want.join('|')) {
    console.error('❌ 私有 index 内容与声明面不一致,拒绝提交(宁可不出手也不投错面)')
    console.error('   实际:' + JSON.stringify(staged))
    console.error('   声明:' + JSON.stringify(want))
    process.exit(1)
  }
  console.log(`✅ 私有 index 就绪(${staged.length} 个):${staged.join(', ')}`)

  // ④ 读共享暂存区当前面,仅用于事后报告"我们全程没碰过它"
  const before = gitTry(['-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--no-renames'])
  const beforeN = before.ok ? before.ok.split('\n').filter(Boolean).length : 0

  // ⑤ 提交(不带 pathspec:pathspec 会另设 GIT_INDEX_FILE 指向临时 index,
  //    与我们这份私有 index 打架,且删除类路径必然 128)
  let out = ''
  let code = 0
  try {
    out = git(['commit', '-F', msgFile], env)
    code = 0
  } catch (e) {
    out = ((e?.stdout ?? '') + (e?.stderr ?? '')).toString()
    code = e?.status ?? 1
  }

  const after = gitTry(['-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--no-renames'])
  const afterN = after.ok ? after.ok.split('\n').filter(Boolean).length : 0

  console.log(`\n=== 提交结果:exit ${code} ===`)
  console.log(
    out
      .split('\n')
      .filter((l) => l.trim())
      .slice(-12)
      .join('\n'),
  )
  console.log(`\n共享暂存区:提交前 ${beforeN} 个 → 提交后 ${afterN} 个(我们全程未接触,数字变化来自对方会话)`)
  console.log(`新 HEAD: ${git(['rev-parse', '--short', 'HEAD'])}`)
  process.exit(code)
} finally {
  // 私有 index 是我们自己的临时物,清掉;共享面一概不动
  if (existsSync(privIndex)) rmSync(privIndex, { force: true })
  writeFileSync('.ihui-agent/tmp/last-private-index.txt', privIndex, 'utf8')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
