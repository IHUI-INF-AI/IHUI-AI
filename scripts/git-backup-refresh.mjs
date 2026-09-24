// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 本地 gitdir 恢复源的**增量刷新**器(AGENTS.md §5b 配套)。
//
// 成因(实测):git-guardian 的兜底恢复源 `resolveBackupDir()` 只被**读取**
// (`backupOk` / `cpSync(BACKUP → GITDIR)`),从来没有人**更新**它。
// 2026-09-24 04:40 实测:恢复源 HEAD 停在 `f481c39a0f7`(2026-09-23 20:13),
// 而本机 main 已经前进 **97 个提交** —— 一旦宿主再删一次 `.git`(§5b 已 15 次),
// 从该源恢复 = 把 97 个提交整体回滚;若其中有未推送的提交,就是 09-23 15:49
// "15 条未推送 commit 对象永久丢失"的同型事故重演。
//
// 做法:对备份 gitdir 做**增量 fetch**(不做整仓 857MB 重拷),
// 只同步 `refs/heads/*` 与 `refs/tags/*`,再落一份 `refs-manifest.json` 副本,
// 使"离线恢复"在恢复后立刻具备 §5b 的嵌套 ref 自愈能力。
// 全程只读工作树仓库、只写工作树之外,不做任何删除。
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { resolveBackupDir, resolveGitdir, resolveWorktree } from './lib/gitdir.mjs'

const GIT = process.env.IHUI_GIT_BIN || 'git'
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

const args = process.argv.slice(2)
const CHECK_ONLY = args.includes('--check')
const DRY_RUN = args.includes('--dry-run')
const SELF_TEST = args.includes('--self-test')
const QUIET = args.includes('--quiet')

const say = (...a) => {
  if (!QUIET) console.log(...a)
}

/** 取内容:不得 .trim()(§5b 教训:尾部换行被吃掉会让判据假失败) */
function gitOut(gitDir, gargs, allowFail = false) {
  try {
    return execFileSync(GIT, ['-C', gitDir, '-c', 'safe.directory=*', ...gargs], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** 取 sha 类输出:必须 .trim()(与 gitOut 分开,勿合并) */
function gitSha(gitDir, gargs, allowFail = false) {
  const out = gitOut(gitDir, gargs, allowFail)
  return out === null ? null : out.trim()
}

/**
 * @param {{worktree?:string, backup?:string, forceSource?:string}} [opts] 测试注入用
 */
export function refreshBackup(opts = {}) {
  const worktree = opts.worktree || resolveWorktree()
  const srcGit = opts.forceSource || resolveGitdir(worktree)
  const backup = opts.backup || resolveBackupDir(worktree)

  const res = { worktree, srcGit, backup, before: null, after: null, advanced: false, error: null, manifest: false }
  if (!backup) {
    res.error = 'resolveBackupDir() 返回 null —— 本机没有可用的本地恢复源,先按 §5b 建一份再挂本器'
    return res
  }
  if (!existsSync(join(backup, 'HEAD'))) {
    res.error = `备份 gitdir 不存在或缺 HEAD: ${backup}`
    return res
  }

  const srcHead = gitSha(srcGit, ['rev-parse', 'HEAD'])
  if (!srcHead) {
    res.error = `源仓 HEAD 取不到(源 = ${srcGit})`
    return res
  }
  const brk = gitSha(backup, ['rev-parse', '--verify', 'main'], true) || gitSha(backup, ['rev-parse', '--verify', 'HEAD'], true)
  res.before = brk
  if (brk === srcHead) {
    res.manifest = syncManifest(worktree, backup)
    return res // 已最新,零写入
  }

  if (CHECK_ONLY || DRY_RUN) {
    res.note = CHECK_ONLY ? 'stale' : 'dry-run'
    return res
  }

  // 源用**绝对路径**引用(不依赖网络凭据,也不信本地 origin 的取值 —— §5b:origin/main 是易失 ref)
  // --update-head-ok:备份 gitdir 是 `.git` 的**完整副本(非裸)**,HEAD 指向 main,
  //   默认 git 会以 "refusing to fetch into branch 'refs/heads/main' checked out" 硬拒 ——
  //   真仓首跑就是这么失败的,而临时裸仓自测测不到这一形态,故自测补第 7 例覆盖非裸副本。
  const refspecs = ['+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*']
  const fetchArgs = ['-c', 'safe.directory=*', '--git-dir', backup, 'fetch', '--force', '--no-tags', '--update-head-ok', srcGit, ...refspecs]
  try {
    execFileSync(GIT, fetchArgs, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    res.error = `增量 fetch 失败: ${String(e.stderr || e.message).split('\n')[0]}`
    return res
  }

  const got = gitSha(backup, ['rev-parse', '--verify', 'main'], true)
  if (got !== srcHead) {
    res.error = `回读不一致:备份 main=${got || '(无)'} 源 HEAD=${srcHead}`
    return res
  }
  // 备份是裸 gitdir:HEAD 必须指到分支,否则 §5b 的 cpSync 恢复会带一个悬空 HEAD
  const headRef = gitOut(backup, ['symbolic-ref', 'HEAD'], true)
  if (!headRef || headRef.trim() !== 'refs/heads/main') {
    try {
      execFileSync(GIT, ['-C', backup, '-c', 'safe.directory=*', 'symbolic-ref', 'HEAD', 'refs/heads/main'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      /* 非致命:main 已在,恢复时显式 checkout 即可 */
    }
  }
  res.after = got
  res.advanced = true
  // 备份非裸 ⇒ 自带旧 index。只推进 HEAD 而不动 index,恢复后 HEAD/index/工作树三件套错位
  // (恢复期 git status 会满天"已修改")。read-tree 只重写 $GIT_DIR/index,不触碰任何工作树。
  try {
    execFileSync(GIT, ['-c', 'safe.directory=*', '--git-dir', backup, 'read-tree', '--reset', 'HEAD'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    res.indexAligned = true
  } catch (e) {
    res.indexAligned = false
    res.indexNote = String(e.stderr || e.message).split('\n')[0]
  }
  res.manifest = syncManifest(worktree, backup)
  return res
}

/**
 * 把 §5b 的嵌套 ref 期望值清单复制进备份 gitdir(顶层文件,清理层够不到)。
 * 源缺失时按"备份里现存的全部 refs"生成一份,保证离线恢复后仍能对照。
 */
function syncManifest(worktree, backup) {
  try {
    const srcManifest = join(resolveGitdir(worktree), 'refs-manifest.json')
    if (existsSync(srcManifest)) {
      copyFileSync(srcManifest, join(backup, 'refs-manifest.json'))
      return 'copied'
    }
    const listed = gitOut(backup, ['for-each-ref', '--format=%(refname) %(objectname)'], true) || ''
    const refs = {}
    for (const line of listed.split('\n')) {
      const i = line.lastIndexOf(' ')
      if (i <= 0) continue
      refs[line.slice(0, i)] = line.slice(i + 1)
    }
    writeFileSync(join(backup, 'refs-manifest.json'), JSON.stringify({ generatedBy: 'git-backup-refresh.mjs', refs }, null, 2))
    return 'synthesized'
  } catch {
    return false
  }
}

/**
 * 取证用:临时造两个仓(源 + 裸备份),推进源提交后跑一次刷新,
 * 断言备份 HEAD 追平且 refs/tags 同步 —— 反向对照:不刷新时必须判红。
 */
async function selfTest() {
  const dir = mkScratch('ihui-bkp-')
  const src = join(dir, 'src-wt')
  const bk = join(dir, 'bk.git')
  mkdirSync(src, { recursive: true })
  const run = (a, cwd) => execFileSync(GIT, ['-C', cwd, '-c', 'safe.directory=*', ...a], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    run(['init', '-q', '-b', 'main'], src)
    writeFileSync(join(src, 'a.txt'), 'v1\n')
    run(['add', 'a.txt'], src)
    run(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v1'], src)
    const v1 = run(['rev-parse', 'HEAD'], src)
    run(['clone', '--bare', '-q', src, bk], dir)

    let pass = true
    const expect = (name, ok, extra = '') => {
      console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' :: ' + extra : ''}`)
      if (!ok) pass = false
    }

    // 反例:源未推进 → before == after,advanced=false
    let r = refreshBackup({ worktree: src, backup: bk, forceSource: join(src, '.git') })
    expect('1 源未推进时判"已最新"(不写入)', !r.advanced && !r.error && r.before === v1, JSON.stringify({ before: r.before?.slice(0, 9), want: v1.slice(0, 9) }))

    // 正例:源新增 2 个提交 + 1 个 tag → 刷新后追平
    writeFileSync(join(src, 'a.txt'), 'v2\n')
    run(['add', 'a.txt'], src)
    run(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v2'], src)
    run(['tag', 'nightly-selftest', 'HEAD'], src)
    const v2 = run(['rev-parse', 'HEAD'], src)
    r = refreshBackup({ worktree: src, backup: bk, forceSource: join(src, '.git') })
    expect('2 刷新后备份 HEAD 追平源', r.after === v2 && !r.error, `after=${r.after?.slice(0, 9)} want=${v2.slice(0, 9)} err=${r.error || '-'}`)
    expect('3 tag 一并同步', gitSha(bk, ['rev-parse', '--verify', 'refs/tags/nightly-selftest'], true) === run(['rev-parse', 'refs/tags/nightly-selftest'], src))
    expect('4 refs-manifest.json 落地', existsSync(join(bk, 'refs-manifest.json')))

    // --check 口径:未推进时必须判 no-op(零写入)
    r = refreshBackup({ worktree: src, backup: bk, forceSource: join(src, '.git') })
    expect('5 追平后 --check 语义(未推进即 no-op)', !r.advanced && r.before === v2)

    // 判据有效性:备份被"删掉"时不得静默成功
    r = refreshBackup({ worktree: src, backup: join(dir, 'nope.git'), forceSource: join(src, '.git') })
    expect('6 备份缺失时报错而非静默通过', !!r.error, r.error || '')

    // 7/8 真仓形态:备份是 `.git` 的完整**非裸**副本(guardian 用 cpSync 产出)——
    // 这一形态下 git 默认拒绝 fetch 进已检出分支,真仓首跑即失败,裸仓自测测不到。
    const bk2 = join(dir, 'bk2.git')
    cpSync(join(src, '.git'), bk2, { recursive: true })
    writeFileSync(join(src, 'a.txt'), 'v3\n')
    run(['add', 'a.txt'], src)
    run(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v3'], src)
    const v3 = run(['rev-parse', 'HEAD'], src)
    r = refreshBackup({ worktree: src, backup: bk2, forceSource: join(src, '.git') })
    expect('7 非裸副本形态也追平(cpSync 型备份)', r.after === v3 && !r.error, `after=${r.after?.slice(0, 9)} want=${v3.slice(0, 9)} err=${r.error || '-'}`)
    expect('8 备份 index 随 HEAD 重建(不触碰工作树)', r.indexAligned === true, r.indexNote || '')
    expect('9 非裸副本 HEAD 可读回且等于源 tip(gitSha 口径,gitOut 带尾换行不等)', gitSha(bk2, ['rev-parse', '--verify', 'HEAD'], true) === v3)
    return pass ? 0 : 1
  } finally {
    rmScratch(dir)
  }
}

async function main() {
  if (SELF_TEST) return selfTest()
  const r = refreshBackup()
  const short = (s) => (s ? String(s).slice(0, 9) : '(无)')
  if (r.error) {
    console.error(`❌ git-backup-refresh: ${r.error}`)
    return 1
  }
  if (CHECK_ONLY) {
    const stale = r.before !== null && !r.advanced && r.note === 'stale'
    console.log(
      `[git-backup-refresh] 恢复源=${r.backup} 备份=${short(r.before)} 源=${short(gitSha(r.srcGit, ['rev-parse', 'HEAD']))} ` +
        (stale ? '⚠️ 落后(需刷新)' : '✅ 已追平'),
    )
    return stale ? 1 : 0
  }
  say(
    r.advanced
      ? `✅ 本地恢复源已增量追平: ${short(r.before)} → ${short(r.after)} (manifest: ${r.manifest || '失败'})`
      : `✅ 本地恢复源已是最新态(${short(r.before)}),未做任何写入`,
  )
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      // 必须传播返回码:漏掉时 --check 判"落后"也 exit 0,CI/巡检拿不到红点
      if (typeof code === 'number' && code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ git-backup-refresh 自身异常: ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2) // 2 = 脚本异常(§22d 约定),与业务失败 1 区分
    })
}

export const __test__ = { refreshBackup, syncManifest, gitOut, gitSha, repoName: () => basename(REPO) }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
