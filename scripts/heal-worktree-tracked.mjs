// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/heal-worktree-tracked.mjs
/**
 * 工作区"已跟踪文件存续性"自愈(2026-09-23 立)。
 *
 * 成因:本机宿主清理层会**成批删除工作区里的目录**(实测同日三轮:137 个 → 27 个 → 1 个,
 * 命中 `tests/`、`__tests__/` 整目录、`installer-assets` 下 `assets-NNN` 的 bmp 资源、4 个在役守门脚本)。
 * `.git`/嵌套 ref 早有 `git-guardian` 分层自愈,但**工作区文件存续性无人管** ——
 * 缺失只体现为 `git status` 一片 ` D`,下一次提交就会把它们从版本树里删掉(等价静默回滚)。
 *
 * 判据(三条同时成立才恢复,任一不成立一律不碰):
 *   ① 工作区缺该文件(`git status` 的 ` D`);
 *   ② 索引里的 blob == HEAD 里的 blob —— 说明**没人对它做过任何暂存**(含 `git rm` 暂存删除),
 *      所以它是被外部清掉的,不是他人在制改动;
 *   ③ HEAD 中该路径确实存在。
 * 因此本脚本恢复的内容全部按定义零独有数据,不会覆盖任何人的未提交工作。
 *
 * 用法:
 *   node scripts/heal-worktree-tracked.mjs              # 检出即恢复
 *   node scripts/heal-worktree-tracked.mjs --dry-run    # 只报告不写盘
 *   node scripts/heal-worktree-tracked.mjs --self-test  # 独立临时仓端到端演练
 *   node scripts/heal-worktree-tracked.mjs --json       # 供 git-guardian 巡检读取
 * 紧急跳过:IHUI_SKIP_WORKTREE_HEAL=1
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const GIT = process.env.IHUI_GIT_BIN || 'git'
export const SKIP_ENV = 'IHUI_SKIP_WORKTREE_HEAL'

function makeGit(repoRoot) {
  return (args, opts = {}) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1 << 28,
      ...opts,
    })
}

/** 工作区缺失但索引与 HEAD 完全一致的已跟踪文件 = 被外部删除 */
export function findOrphanedDeletions(repoRoot) {
  const g = makeGit(repoRoot)
  const st = execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', repoRoot, 'status', '--porcelain', '-z'], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 28,
  })
  const safe = []
  const held = []
  for (const rec of st.split('\0')) {
    if (!rec) continue
    const xy = rec.slice(0, 2)
    const path = rec.slice(3).trim()
    if (xy !== ' D' || !path) continue
    let indexBlob = ''
    try {
      indexBlob = (g(['ls-files', '-s', '--', path]).split('\t')[0] || '').split(' ')[1] || ''
    } catch {
      indexBlob = ''
    }
    let headBlob = ''
    try {
      headBlob = g(['rev-parse', `HEAD:${path}`]).trim()
    } catch {
      headBlob = ''
    }
    if (indexBlob && indexBlob === headBlob && !existsSync(resolve(repoRoot, path))) safe.push(path)
    else if (!indexBlob) held.push(path) // 索引里也没有:他人已暂存删除,不碰
  }
  return { safe, held }
}

export function heal(repoRoot, { dryRun = false } = {}) {
  const { safe, held } = findOrphanedDeletions(repoRoot)
  if (!safe.length) return { restored: 0, held: held.length, paths: [] }
  if (dryRun) return { restored: 0, held: held.length, paths: safe, dryRun: true }
  const g = makeGit(repoRoot)
  for (let i = 0; i < safe.length; i += 40) {
    g(['restore', '--source=HEAD', '--worktree', '--', ...safe.slice(i, i + 40)])
  }
  return { restored: safe.length, held: held.length, paths: safe }
}

/** 独立临时仓演练:①外部删除必被识别并恢复 ②他人 `git rm --cached` 的删除绝不碰 */
function selfTestRun() {
  const tmp = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.ihui-agent', 'tmp', 'wt-heal-drill-'))
  const g = makeGit(tmp)
  const out = []
  const check = (n, ok) => out.push({ n, ok })
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    writeFileSync(join(tmp, 'keep.ts'), 'v1\n')
    writeFileSync(join(tmp, 'sub-dir.ts'), 'v1\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'A'])

    // ① 模拟宿主清理:只删工作区,索引不动
    rmSync(join(tmp, 'keep.ts'), { force: true })
    const f1 = findOrphanedDeletions(tmp)
    check('① 外部删除被识别为可恢复', f1.safe.includes('keep.ts') && !f1.held.includes('keep.ts'))
    const h1 = heal(tmp)
    check('② 恢复后文件回到工作区', h1.restored === 1 && existsSync(join(tmp, 'keep.ts')))

    // ③ 他人有意删除:同时暂存删除 ⇒ 不得恢复
    g(['rm', '-q', '--cached', 'sub-dir.ts'])
    rmSync(join(tmp, 'sub-dir.ts'), { force: true })
    const f2 = findOrphanedDeletions(tmp)
    check('③ 他人暂存的删除不被插手', !f2.safe.includes('sub-dir.ts'))
    heal(tmp)
    check('④ 恢复动作后该文件仍为删除态', !existsSync(join(tmp, 'sub-dir.ts')))

    // ⑤ 干净工作区 ⇒ 无事发生
    g(['commit', '-qm', 'B'])
    const h2 = heal(tmp)
    check('⑤ 无缺失时零动作', h2.restored === 0)

    let fail = 0
    for (const r of out) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.n}`)
      if (!r.ok) fail++
    }
    console.log(fail ? `self-test FAILED ${fail}/${out.length}` : `✅ check heal-worktree-tracked self-test 全部通过(${out.length} 例)`)
    return fail ? 1 : 0
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTestRun()
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  if (process.env[SKIP_ENV]) return 0
  const res = heal(repoRoot, { dryRun: argv.includes('--dry-run') })
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res))
    return 0
  }
  if (!res.restored && !res.paths.length && !res.held) {
    console.log('✅ 工作区已跟踪文件存续正常')
    return 0
  }
  console.log(
    `${res.dryRun ? '[dry-run] 可恢复' : '已恢复'} ${res.restored || res.paths.length} 个被外部删除的跟踪文件` +
      (res.held ? `;另有 ${res.held} 个他人已暂存的删除(不碰)` : ''),
  )
  for (const p of res.paths.slice(0, 20)) console.log('   - ' + p)
  return 0
}

export const healTrackedFiles = heal

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { findOrphanedDeletions, heal, SKIP_ENV }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
