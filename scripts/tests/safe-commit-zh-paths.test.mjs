// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/safe-commit.mjs Step 3 / Step 5 对**中文名**路径的比对(票 D171)。
// 事故:git 默认按 core.quotePath 把非 ASCII 路径八进制转写并加引号(形如
// `"docs/.../reconcile-10/345/274/225....md"`),旧写法把 `git diff --cached --name-only`
// 的输出按换行 split 后与声明清单逐字比 ⇒ 5 个中文名文件被判「暂存区出现非预期文件
// ⇒ 中止提交」;Step 5 的 `git show --name-only` 同型,把干净提交误报成污染事故。
// 修法:取路径一律走 scripts/lib/git-paths.mjs 的 -z 出口(NUL 分帧、不经转写),
// 声明侧与 git 侧归一到同一路径身份后再比;**判据严格度不变**(意外照拒、缺失照拒)。
// 本文件不启动 safe-commit(它的 Step 0.5 写锁按仓库根自推导,临时仓里没有 git-lock),
// 与 safe-commit-deletion-retry.test.mjs 同一先例:在临时仓里把机制差两侧都证明一遍
// + 源码形状锁。git 写操作只发生在临时仓内(§26 夹具落点),绝不碰真仓索引与 refs。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitCommitPaths, gitStagedPaths } from '../lib/git-paths.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'safe-commit.mjs')
const GIT = resolveGitBin() || 'git'

// 中文目录 + 中文文件名 + 内含空格(与 G-801 事故同形;D171 的暂存面事故同型)
const ZH_PATH = 'docs/项目说明/8端一致性 认证矩阵.txt'
const OTHER = 'plain.txt'
// ② 用的"盘上不存在的中文名"
const ZH_MISSING = 'docs/项目说明/不存在 的中文文档.txt'

const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function scratchRepo(t) {
  const dir = mkScratch('safe-commit-zh-')
  t.after(() => {
    try {
      rmScratch(dir)
    } catch (e) {
      // 本环境的 safe-delete shim 对 >50 项的批量删要求确认(git 夹具的 .git 项数天然超限)。
      // 清理失败不得改写判据结论(scratch-dir 退出路径的同一纪律);残留交 §26 每日 Temp 体检兜。
      console.warn(`⚠ D171 夹具清理未执行 ${dir}:${e?.message ?? e}`)
    }
  })
  mkdirSync(join(dir, 'docs', '项目说明'), { recursive: true })
  runGit(dir, ['init', '-q'])
  runGit(dir, ['config', 'user.email', 'gates@ihui.test'])
  runGit(dir, ['config', 'user.name', 'gates-zh'])
  writeFileSync(join(dir, OTHER), 'v1\n')
  runGit(dir, ['add', '--', OTHER])
  runGit(dir, ['commit', '-q', '-m', 'base'])
  return dir
}

test('D171 中文名判同值(①):-z 暂存清单与中文名声明逐字相等;旧式换行 split 必然比不中(事故原形)', (t) => {
  const dir = scratchRepo(t)
  writeFileSync(join(dir, ZH_PATH), '本票改动\n')
  writeFileSync(join(dir, OTHER), 'v2\n')
  runGit(dir, ['add', '-A', '--', ZH_PATH, OTHER])
  const declared = [OTHER, ZH_PATH]

  // 修后:lib 的 -z 出口按 NUL 分帧取真路径 ⇒ 与声明清单判同值
  const staged = gitStagedPaths({ root: dir })
  assert.deepEqual(
    [...new Set(staged)].sort(),
    [...new Set(declared)].sort(),
    `中文名必须与声明逐字相等,实得 ${JSON.stringify(staged)}`,
  )

  // 判据有牙的反证:旧式取值(git 默认 quotePath)在本夹具上必须比不中该路径
  const oldLines = runGit(dir, ['-c', 'core.quotePath=true', 'diff', '--cached', '--name-only', '--no-renames'])
    .split('\n')
    .filter(Boolean)
  assert.ok(
    !oldLines.includes(ZH_PATH),
    '旧式换行清单必须比不中中文名 ⇒ 夹具就是事故原形;若命中了,这条退化成修后臂的复读',
  )
  assert.ok(
    oldLines.some((l) => /^".*\\\d{3}/.test(l)),
    `默认档必须把中文名转写成引号+八进制形态,实得 ${JSON.stringify(oldLines)}`,
  )
})

test('D171 中文名仍红(②):声明一个盘上不存在的中文名 ⇒ 缺失判据(预期−暂存)非空,不得被忽略', (t) => {
  const dir = scratchRepo(t)
  writeFileSync(join(dir, OTHER), 'v2\n')
  runGit(dir, ['add', '--', OTHER])
  const declared = [OTHER, ZH_MISSING]
  assert.equal(existsSync(join(dir, ZH_MISSING)), false, '夹具自证:该中文名确实不在盘上')

  const staged = gitStagedPaths({ root: dir })
  // Step 3b 的判据原样复刻(与 safe-commit 内联判定同一算式):缺失 = 声明 − 暂存
  const stagedNorm = new Set(staged)
  const missing = declared.filter((f) => !stagedNorm.has(f))
  assert.deepEqual(
    missing,
    [ZH_MISSING],
    '不存在的中文名必须落在缺失集里 ⇒ 判红出口仍红(否则①只是把判据关掉)',
  )
  // 3a 同步反证:暂存集 ⊆ 声明集 ⇒ 意外集为空 —— "该绿的绿"与"该红的红"同时成立
  const declaredNorm = new Set(declared)
  const unexpected = staged.filter((f) => !declaredNorm.has(f))
  assert.deepEqual(unexpected, [], '暂存集内的真路径不得被误判成意外文件')
})

test('D171 中文名提交面(Step 5 同尺):gitCommitPaths 对含中文名的提交返回真路径,旧式 show 输出比不中', (t) => {
  const dir = scratchRepo(t)
  writeFileSync(join(dir, ZH_PATH), '本票提交内容\n')
  runGit(dir, ['add', '--', ZH_PATH])
  runGit(dir, ['commit', '-q', '-m', 'docs: 中文名提交'])
  const head = runGit(dir, ['rev-parse', 'HEAD']).trim()

  // 修后:diff-tree -z 对该提交取到的是真路径(Step 5 的 filesOfCommit 走同一出口)
  assert.deepEqual(
    gitCommitPaths({ root: dir, sha: head }),
    [ZH_PATH],
    '提交面清单必须取到中文名真路径',
  )
  // 判据有牙的反证:旧式 `git show --name-only` 输出按换行 split 必然比不中
  const oldLines = runGit(dir, ['-c', 'core.quotePath=true', 'show', '--name-only', '--pretty=format:', head])
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  assert.ok(!oldLines.includes(ZH_PATH), '旧式 show 输出必须比不中中文名(污染误报的事故原形)')
})

test('D171 形状锁:safe-commit 的路径取值必须走 lib/git-paths 的 -z 出口,换行 split 取路径的旧形态不得回归', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(
    src,
    /import \{ gitCommitPaths, gitStagedPaths, gitUntrackedPaths \} from '\.\/lib\/git-paths\.mjs'/,
    '三个 -z 出口必须真被 import',
  )
  assert.equal(
    (src.match(/gitStagedPaths\(\{ root: repoRoot \}\)/g) ?? []).length,
    3,
    'Step 3 / 归因面 / 重暂存校验三处都必须走 lib 出口',
  )
  assert.match(src, /gitUntrackedPaths\(\{ root: repoRoot \}\)/, '未跟踪清单也必须走 -z 出口')
  assert.match(src, /gitCommitPaths\(\{ root: repoRoot, sha \}\)/, 'Step 5 filesOfCommit 必须走 diff-tree -z 出口')
  // 旧形态不得回归:遮掉注释与字符串后,代码面不得再出现任何 --name-only 取路径调用
  const masked = maskCommentsAndStrings(src)
  assert.ok(!masked.includes('--name-only'), '换行 split 的 --name-only 旧形态不得回归(D171 的事故原形)')
  const lib = readFileSync(join(HERE, '..', 'lib', 'git-paths.mjs'), 'utf8')
  assert.ok(lib.includes("'-z'"), 'lib 出口必须用 -z NUL 分帧(quotePath 转写不得回来)')
})
