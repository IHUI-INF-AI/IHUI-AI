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
// 全程只读工作树仓库、只写工作树之外。**唯一的删除动作**:备份自己的 `refs/heads/main`
// 若是一枚写坏的半截文件(内容不是合法 sha),它会让 fetch 直接 `fatal: bad object`,
// 此时先按 §5b 把现场字节归档到 gitArchiveDir()/broken-refs 并回读逐字节一致,才清除它
// —— 除此之外不删任何东西,尤其**绝不**清除"内容是合法 sha 而对象取不到"的 ref(那要补对象)。
//
// 2026-09-27 夜间实测到的一型(本文件为此改判据):恢复源的 refs/heads/main 是一枚
// 41 字节全 NUL 的文件,mtime 与守护日志最后一行「✅ 已增量追平 → ad1a47054」同一分钟
// (2026-09-26T04:57)⇒ 一次 fetch 写 ref 只写了一半。此后体检**报绿**了约 29 小时:
// 旧 `--check` 判据 `r.before !== null && …` 把"根本读不到"当成了"不算落后",
// 而守护 `refreshRecoverySource()` 见 exit 0 就 return,修复分支一次也没执行;
// 对象面因此停在 2026-09-25 23:05 的包,连当日本机 HEAD 都不在里面 —— 即"宿主再删一次
// .git 时唯一能落的本地恢复源"当时既旧、又没有分支指针。判不了的一律按落后处置。
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { gitArchiveDir, resolveBackupDir, resolveGitdir, resolveWorktree } from './lib/gitdir.mjs'

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

const HEX40 = /^[0-9a-f]{40}$/

/**
 * 备份 tip 的状态 —— **纯函数**,输入只有"git 问到的 sha"+"ref 文件在不在"+"文件内容"。
 *
 * 为什么要单独把这一维抽出来:2026-09-27 夜间实测,恢复源的 `refs/heads/main` 是一枚
 * **41 字节全 NUL** 的文件(它的 mtime 2026-09-26T04:57:31.569Z 与守护日志里最后一行
 * 「✅ 本地恢复源已增量追平 → ad1a47054」同一分钟 ⇒ 一次 fetch 写 ref 写到一半没落全)。
 * 那之后 `rev-parse main` 返回非零,而旧 `--check` 判据把"读不到"写成了"已追平"
 * (见 judgeCheck),守护每 2 分钟体检一次全部早退 ⇒ 恢复源静默停更,且 designated 修复器
 * 自己也进不去(`fatal: bad object refs/heads/main`)。
 *
 * 四种状态各自处置不同,**不许并桶**(尤其 'missing-object' 不得被当坏文件删掉 —— 删了就把
 * 一个"指向已丢对象的指针"和"一段没写成的字节"混成一谈,而前者要靠重新 fetch 补对象):
 *   ok             ref 可解析成 40 hex ⇒ 正常
 *   missing        文件不存在 ⇒ fetch 会新建,正常修复路径
 *   broken-ref     文件在但内容不是合法 sha(全 NUL / 空 / 半截)⇒ 必须先归档再清除,否则 fetch 被拒
 *   missing-object 内容是合法 sha 而 git 仍取不到 ⇒ 对象库受损,**不得删 ref**
 */
export function classifyBackupTip({ sha, refFileExists, refFileText }) {
  if (typeof sha === 'string' && HEX40.test(sha)) return 'ok'
  if (!refFileExists) return 'missing'
  // NUL 不是文本字符,必须**先剥掉**再判形状:全 NUL 的文件 trim 后仍是 41 个不可见字节,
  // 若按原样比 hex 会被归成"畸形内容"里的一支 —— 归对了,但报告里说不清它是哪种畸形。
  const line = String(refFileText ?? '')
    .replace(/\u0000/g, '')
    .trim()
  return HEX40.test(line) ? 'missing-object' : 'broken-ref'
}

/**
 * `--check` 的结论 —— 也是纯函数。**本次修复的正身在这里**:
 * 旧写法是 `stale = r.before !== null && !r.advanced && r.note === 'stale'`,
 * 第一个合取项等于说"备份 tip 读不到的时候不算落后"⇒ 恢复源彻底不可用时体检报绿 + exit 0,
 * 而守护 `refreshRecoverySource()` 见 exit 0 就 return,修复分支永不执行。
 * 判不了的一律按落后处置(宁可多刷一次,不可把"没判"写成"判过了")。
 */
export function judgeCheck({ srcHead, before, tipState }) {
  if (srcHead && before === srcHead) return { stale: false, reason: '' }
  if (!srcHead) return { stale: true, reason: '源 HEAD 取不到 ⇒ 无从对账,按落后处置' }
  if (tipState === 'broken-ref')
    return {
      stale: true,
      reason: '备份 refs/heads/main 内容不可读(半截写入)⇒ 该源现在撑不起一次恢复',
    }
  if (tipState === 'missing-object')
    return { stale: true, reason: '备份 refs/heads/main 指向的对象取不到 ⇒ 对象库落后或受损' }
  if (tipState === 'missing') return { stale: true, reason: '备份里没有 refs/heads/main' }
  return {
    stale: true,
    reason: `备份 main=${before ? before.slice(0, 9) : '(无)'} ≠ 源 HEAD=${srcHead.slice(0, 9)}`,
  }
}

/**
 * 把坏 tip ref 文件**先归档、回读逐字节一致、才删除**(§5b:每步破坏性覆盖前先归档现场)。
 * 任一步不符即中止并返回错误,不留"删了但没归档"的中间态。
 * 刻意只接 'broken-ref' 那一格:内容是合法 sha 时**绝不删**(那是要补对象,不是要清文件)。
 */
export function quarantineBrokenTipRef({ refPath, archiveDir, label, stamp }) {
  const res = { did: false, dest: null, bytes: 0, error: null }
  try {
    if (!existsSync(refPath)) {
      res.error = 'ref 文件不存在 ⇒ 无需归档'
      return res
    }
    const raw = readFileSync(refPath)
    const line = raw
      .toString('latin1')
      .replace(/\u0000/g, '')
      .trim()
    if (HEX40.test(line)) {
      res.error = '内容是合法 sha ⇒ 属"对象取不到"型,禁止清除(删了指针就再也找不回该补哪个对象)'
      return res
    }
    const ts = (stamp || new Date().toISOString()).replace(/[:.]/g, '-')
    const destDir = join(archiveDir, 'broken-refs')
    mkdirSync(destDir, { recursive: true })
    // 归档名里带上"哪个 gitdir 的哪一枚 ref"—— 只留时间戳的话,两处恢复源同时坏过就分不开。
    const dest = join(
      destDir,
      `${(label || 'gitdir').replace(/[^\w.-]/g, '_')}__refs-heads-main.nul-${ts}`,
    )
    copyFileSync(refPath, dest)
    const back = readFileSync(dest)
    if (back.length !== raw.length || !back.equals(raw)) {
      res.error = `归档回读不一致(源 ${raw.length}B / 归档 ${back.length}B)⇒ 不删原件`
      return res
    }
    unlinkSync(refPath)
    res.did = true
    res.dest = dest
    res.bytes = raw.length
    if (existsSync(refPath)) res.error = 'unlink 后文件仍在'
    return res
  } catch (e) {
    res.error = String(e?.message ?? e)
    return res
  }
}

/**
 * @param {{worktree?:string, backup?:string, forceSource?:string, archiveDir?:string}} [opts] 测试注入用
 *   archiveDir 必须可注入:坏 ref 的现场归档默认落 §15b 唯一备份目录(gitArchiveDir),
 *   自测若用默认值就会往真归档里写垃圾。
 */
export function refreshBackup(opts = {}) {
  const worktree = opts.worktree || resolveWorktree()
  const srcGit = opts.forceSource || resolveGitdir(worktree)
  const backup = opts.backup || resolveBackupDir(worktree)
  const archiveDir = opts.archiveDir || gitArchiveDir(worktree)

  const res = {
    worktree,
    srcGit,
    backup,
    before: null,
    after: null,
    advanced: false,
    error: null,
    manifest: false,
    srcHead: null,
    tipState: null,
    quarantine: null,
  }
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
  res.srcHead = srcHead // 报告与判据必须读同一枚源 HEAD,不得各问一次(否则打印与结论可错位)
  const brk =
    gitSha(backup, ['rev-parse', '--verify', 'main'], true) ||
    gitSha(backup, ['rev-parse', '--verify', 'HEAD'], true)
  res.before = brk
  // "读不到"分四种情形,必须分开 —— 旧实现只有一句话"读不到就算追平",见 judgeCheck 的头注。
  const tipRefPath = join(backup, 'refs', 'heads', 'main')
  let tipText = null
  let tipExists = false
  try {
    tipExists = existsSync(tipRefPath)
    if (tipExists) tipText = readFileSync(tipRefPath).toString('latin1')
  } catch {
    tipExists = false
  }
  res.tipState = classifyBackupTip({ sha: brk, refFileExists: tipExists, refFileText: tipText })
  if (brk === srcHead) {
    res.manifest = syncManifest(worktree, backup)
    return res // 已最新,零写入
  }

  if (CHECK_ONLY || DRY_RUN) {
    res.note = CHECK_ONLY ? 'stale' : 'dry-run'
    return res
  }

  // 坏 ref 文件本身会让 fetch 直接 `fatal: bad object refs/heads/main` ⇒ designated 修复器进不去。
  // 先按 §5b 归档现场再清除,fetch 随后把它新建回来。
  if (res.tipState === 'broken-ref') {
    const q = quarantineBrokenTipRef({ refPath: tipRefPath, archiveDir, label: basename(backup) })
    res.quarantine = q
    if (!q.did && q.error) {
      res.error = `坏 ref 归档失败 ⇒ 不强行 fetch(避免把"删不掉又写不进"变成静默停更):${q.error}`
      return res
    }
    say(`⚠️ 备份 refs/heads/main 内容不可读(半截写入)⇒ 已归档并清除,现场:${q.dest}`)
  }

  // 源用**绝对路径**引用(不依赖网络凭据,也不信本地 origin 的取值 —— §5b:origin/main 是易失 ref)
  // --update-head-ok:备份 gitdir 是 `.git` 的**完整副本(非裸)**,HEAD 指向 main,
  //   默认 git 会以 "refusing to fetch into branch 'refs/heads/main' checked out" 硬拒 ——
  //   真仓首跑就是这么失败的,而临时裸仓自测测不到这一形态,故自测补第 7 例覆盖非裸副本。
  const refspecs = ['+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*']
  const fetchArgs = [
    '-c',
    'safe.directory=*',
    '--git-dir',
    backup,
    'fetch',
    '--force',
    '--no-tags',
    '--update-head-ok',
    srcGit,
    ...refspecs,
  ]
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
      execFileSync(
        GIT,
        ['-C', backup, '-c', 'safe.directory=*', 'symbolic-ref', 'HEAD', 'refs/heads/main'],
        {
          encoding: 'utf8',
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    } catch {
      /* 非致命:main 已在,恢复时显式 checkout 即可 */
    }
  }
  res.after = got
  res.advanced = true
  // 备份非裸 ⇒ 自带旧 index。只推进 HEAD 而不动 index,恢复后 HEAD/index/工作树三件套错位
  // (恢复期 git status 会满天"已修改")。read-tree 只重写 $GIT_DIR/index,不触碰任何工作树。
  try {
    execFileSync(
      GIT,
      ['-c', 'safe.directory=*', '--git-dir', backup, 'read-tree', '--reset', 'HEAD'],
      {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
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
    writeFileSync(
      join(backup, 'refs-manifest.json'),
      JSON.stringify({ generatedBy: 'git-backup-refresh.mjs', refs }, null, 2),
    )
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
  const run = (a, cwd) =>
    execFileSync(GIT, ['-C', cwd, '-c', 'safe.directory=*', ...a], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
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
    expect(
      '1 源未推进时判"已最新"(不写入)',
      !r.advanced && !r.error && r.before === v1,
      JSON.stringify({ before: r.before?.slice(0, 9), want: v1.slice(0, 9) }),
    )

    // 正例:源新增 2 个提交 + 1 个 tag → 刷新后追平
    writeFileSync(join(src, 'a.txt'), 'v2\n')
    run(['add', 'a.txt'], src)
    run(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v2'], src)
    run(['tag', 'nightly-selftest', 'HEAD'], src)
    const v2 = run(['rev-parse', 'HEAD'], src)
    r = refreshBackup({ worktree: src, backup: bk, forceSource: join(src, '.git') })
    expect(
      '2 刷新后备份 HEAD 追平源',
      r.after === v2 && !r.error,
      `after=${r.after?.slice(0, 9)} want=${v2.slice(0, 9)} err=${r.error || '-'}`,
    )
    expect(
      '3 tag 一并同步',
      gitSha(bk, ['rev-parse', '--verify', 'refs/tags/nightly-selftest'], true) ===
        run(['rev-parse', 'refs/tags/nightly-selftest'], src),
    )
    expect('4 refs-manifest.json 落地', existsSync(join(bk, 'refs-manifest.json')))

    // --check 口径:未推进时必须判 no-op(零写入)
    r = refreshBackup({ worktree: src, backup: bk, forceSource: join(src, '.git') })
    expect('5 追平后 --check 语义(未推进即 no-op)', !r.advanced && r.before === v2)

    // 判据有效性:备份被"删掉"时不得静默成功
    r = refreshBackup({
      worktree: src,
      backup: join(dir, 'nope.git'),
      forceSource: join(src, '.git'),
    })
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
    expect(
      '7 非裸副本形态也追平(cpSync 型备份)',
      r.after === v3 && !r.error,
      `after=${r.after?.slice(0, 9)} want=${v3.slice(0, 9)} err=${r.error || '-'}`,
    )
    expect('8 备份 index 随 HEAD 重建(不触碰工作树)', r.indexAligned === true, r.indexNote || '')
    expect(
      '9 非裸副本 HEAD 可读回且等于源 tip(gitSha 口径,gitOut 带尾换行不等)',
      gitSha(bk2, ['rev-parse', '--verify', 'HEAD'], true) === v3,
    )

    // ── 10–13:2026-09-27 夜间实测到的那一型(恢复源 tip 被一次半截 fetch 写成 41 字节全 NUL)──
    // 旧判据在这一格打印"✅ 已追平"并 exit 0,守护见 0 即 return ⇒ 恢复源静默停更 2 天。

    // 10 纯函数四态各归各的(missing-object 不得被并入 broken-ref —— 删掉指针就再也查不到该补哪个对象)
    expect(
      '10 classifyBackupTip 四态成立:ok / missing / broken-ref(NUL·空·半截) / missing-object',
      classifyBackupTip({
        sha: 'f'.repeat(40),
        refFileExists: true,
        refFileText: `${'f'.repeat(40)}\n`,
      }) === 'ok' &&
        classifyBackupTip({ sha: null, refFileExists: false, refFileText: null }) === 'missing' &&
        classifyBackupTip({ sha: null, refFileExists: true, refFileText: '\0'.repeat(41) }) ===
          'broken-ref' &&
        classifyBackupTip({ sha: null, refFileExists: true, refFileText: '' }) === 'broken-ref' &&
        classifyBackupTip({ sha: null, refFileExists: true, refFileText: 'a'.repeat(17) }) ===
          'broken-ref' &&
        classifyBackupTip({
          sha: null,
          refFileExists: true,
          refFileText: `${'b'.repeat(40)}\n`,
        }) === 'missing-object',
    )

    // 11 成对:读不到 ⇒ 必须"需刷新";等值 ⇒ 必须"追平"(反向对照防把判据改成恒 1)
    expect(
      '11 judgeCheck:坏/缺/落后一律需刷新,等值才追平,源 HEAD 取不到也不记绿',
      judgeCheck({ srcHead: 'c'.repeat(40), before: null, tipState: 'broken-ref' }).stale ===
        true &&
        judgeCheck({ srcHead: 'c'.repeat(40), before: null, tipState: 'missing' }).stale === true &&
        judgeCheck({ srcHead: 'c'.repeat(40), before: 'd'.repeat(40), tipState: 'ok' }).stale ===
          true &&
        judgeCheck({ srcHead: null, before: null, tipState: 'missing' }).stale === true &&
        judgeCheck({ srcHead: 'c'.repeat(40), before: 'c'.repeat(40), tipState: 'ok' }).stale ===
          false,
    )

    // 12 必要性对照:把 41 字节全 NUL 直接写进备份的 refs/heads/main,裸 fetch **必须**失败。
    //    没有这一条,第 13 例只证明"归档这段代码会跑",不证明"不归档就修不动"。
    const bk3 = join(dir, 'bk3.git')
    run(['clone', '--bare', '-q', src, bk3], dir)
    const tipPath = join(bk3, 'refs', 'heads', 'main')
    writeFileSync(tipPath, Buffer.alloc(41, 0))
    const naked = gitOut(
      bk3,
      [
        'fetch',
        '--force',
        '--no-tags',
        '--update-head-ok',
        join(src, '.git'),
        '+refs/heads/*:refs/heads/*',
      ],
      true,
    )
    expect('12 阳性对照:NUL 坏 ref 之下裸 fetch 必失败(证明归档不是装饰)', naked === null)

    // 13 端到端:同一形态交给 refreshBackup —— 它必须自己归档、清除、再把 main 追平
    writeFileSync(join(src, 'a.txt'), 'v4\n')
    run(['add', 'a.txt'], src)
    run(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v4'], src)
    const v4 = run(['rev-parse', 'HEAD'], src)
    const arch = join(dir, 'archive')
    r = refreshBackup({
      worktree: src,
      backup: bk3,
      forceSource: join(src, '.git'),
      archiveDir: arch,
    })
    expect(
      '13 坏 ref 由修复路径自行归档(现场字节可回读)并追平 fetch',
      !r.error &&
        r.after === v4 &&
        r.tipState === 'broken-ref' &&
        r.quarantine?.did === true &&
        existsSync(r.quarantine.dest || '') &&
        readFileSync(r.quarantine.dest).equals(Buffer.alloc(41, 0)) &&
        gitSha(bk3, ['rev-parse', '--verify', 'main'], true) === v4,
      `err=${r.error || '-'} after=${r.after?.slice(0, 9)} want=${v4.slice(0, 9)} tip=${r.tipState} q=${JSON.stringify(r.quarantine)}`,
    )

    // 14 反向护栏:内容是合法 sha 而对象取不到 ⇒ **不得**清除 ref(那是补对象,不是清文件)
    const bk4 = join(dir, 'bk4.git')
    run(['clone', '--bare', '-q', src, bk4], dir)
    writeFileSync(join(bk4, 'refs', 'heads', 'main'), `${'9'.repeat(40)}\n`)
    const q14 = quarantineBrokenTipRef({
      refPath: join(bk4, 'refs', 'heads', 'main'),
      archiveDir: join(dir, 'arch14'),
      label: 'bk4.git',
    })
    expect(
      '14 合法 sha 而对象取不到时拒绝清除 ref',
      q14.did === false &&
        existsSync(join(bk4, 'refs', 'heads', 'main')) &&
        /禁止清除/.test(q14.error || ''),
      JSON.stringify(q14),
    )
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
    // 旧判据:`r.before !== null && !r.advanced && r.note === 'stale'` —— 第一个合取项把
    // "备份 tip 根本读不到"洗成了"已追平 + exit 0",而守护见 exit 0 就 return。
    // 现在把结论交给 judgeCheck(纯函数,自测第 10–12 例直接喂构造面)。
    const { stale, reason } = judgeCheck({
      srcHead: r.srcHead,
      before: r.before,
      tipState: r.tipState,
    })
    console.log(
      `[git-backup-refresh] 恢复源=${r.backup} 备份=${short(r.before)}[${r.tipState}] 源=${short(r.srcHead)} ` +
        (stale ? `⚠️ 需刷新 —— ${reason}` : '✅ 已追平'),
    )
    return stale ? 1 : 0
  }
  say(
    r.advanced
      ? `✅ 本地恢复源已增量追平: ${short(r.before)} → ${short(r.after)} (manifest: ${r.manifest || '失败'})`
      : `✅ 本地恢复源已是最新态(${short(r.before)}[${r.tipState}]),未做任何写入`,
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

export const __test__ = {
  refreshBackup,
  syncManifest,
  gitOut,
  gitSha,
  classifyBackupTip,
  judgeCheck,
  quarantineBrokenTipRef,
  repoName: () => basename(REPO),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
