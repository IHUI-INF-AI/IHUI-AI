#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-rebuild-local.mjs — git 本地仓库一键重建(2026-08-06 立,杜绝损坏的影响)。
 *
 * 事故背景(8-06 / 8-05 / 7-26):本地 .git 元数据损坏时,修复繁琐且易错。
 * 本脚本把「从远端重建本地 .git」全流程自动化:
 *   1. 健康检查(git cat-file 校验 HEAD commit/tree)
 *   2. 损坏 → 归档 gitdir,HEAD 与 objects 对上原件才允许往下删
 *   3. 从 origin clone --no-checkout 到 §26 唯一夹具落点(DevEnv/Temp/ihui-scratch 下,
 *    与真 gitdir 同盘、在仓库树外;注:不要在盘根目录 clone,Windows 会失败)
 *   4. 用健康 .git 替换损坏 .git
 *   5. git reset 重建 index —— 工作区文件完全不动,禁止 checkout -- .
 *   6. 输出后续操作指引(git status 查看差异 → 重新 add/commit 未推送改动)
 *
 * ⚠️ 布局约束(2026-09-12 起):本仓库为 separate-git-dir 布局,工作区 .git 仅是指向
 *    工作区外真 gitdir 的指针文件。**重建必须保住「.git 是 1 行指针、真 gitdir 在工作区外」
 *    这一形态**,绝不可把克隆出的 .git 目录直接覆盖到指针文件上。
 *
 * 用法:
 *   node scripts/git-rebuild-local.mjs           # 检查 + 自动重建(仅当损坏)
 *   node scripts/git-rebuild-local.mjs --check   # 只检查健康度,不重建
 *   node scripts/git-rebuild-local.mjs --force   # 忽略健康检查,强制重建
 *
 * 前提:远端 origin 健康(本脚本依赖远端恢复;工作区文件始终保留,不会丢失)。
 */
import { execSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gitdirArchivePath } from './lib/gitdir.mjs'
// §26:临时夹具唯一落点。旧写法把 544MB 的重建克隆落 `os.tmpdir()`,而活进程的 TEMP
// 可能仍钉在 C 盘(§26 实测:盘根 `C:\c` 就是这样套出 515MB 的 origin 克隆)。
// scratch 根与真 gitdir 同盘、在仓库树外,且带 IHUI_SCRATCH_DIR 逃生舱。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/**
 * 外部 gitdir 的真值由仓库根推导,不得硬编码盘符:
 * 同一份仓在 `G:/IHUI-AI` 与 `D:/IHUI-AI` 都存活过(§5b 记录过一次整仓迁盘),
 * 写死 `D:/IHUI-AI-git-repo` 会让 G: 上的检出重建到错误位置。
 */
function externalGitDir(root) {
  return join(root, '..', `${basename(root)}-git-repo`)
}

function run(cmd, allowFail = false) {
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    // 返回值被消费(.trim() 后 return)⇒ stdout 仍须 pipe,只把 stdin 切掉
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

const CHECK_ONLY = process.argv.includes('--check')
const FORCE = process.argv.includes('--force')

/** 远端 URL:优先 git config,回退已知地址 */
function remoteUrl(repoRoot) {
  const url = run(`git -C ${repoRoot} config --get remote.origin.url`, true)
  if (url && url.includes('github.com')) return url
  // 回退:从 package.json repository 字段读取
  try {
    const pkg = JSON.parse(run(`cat ${repoRoot}/package.json`))
    const repo = pkg.repository?.url ?? pkg.repository
    if (typeof repo === 'string' && repo.includes('github.com')) return repo
    if (repo && typeof repo === 'object' && typeof repo.url === 'string') return repo.url
  } catch {
    /* 忽略 */
  }
  return 'https://github.com/IHUI-INF-AI/IHUI-AI.git'
}

/**
 * DBG-85: `git-lock.mjs check` 经 run(allowFail) 的结果。
 * exit 0 = 无锁,stdout 可能是空串;exit 1 = 有锁,run 返回 null。
 * null 必须拒绝继续。空串不是有锁。
 * @param {string|null} checkResult
 */
function lockHeldBlocksRebuild(checkResult) {
  return checkResult === null
}

/**
 * cat-file -e 成功时 run() 得到字符串(通常是空串);失败得到 null。
 * 布尔值不算成功 —— 旧写法 `!== null || true` 会把失败折成 true。
 * @param {unknown} value
 */
function probeSucceeded(value) {
  return typeof value === 'string'
}

/**
 * DBG-86: 健康判据。HEAD 文本为空,或任一对象探针不是成功字符串,都是不健康。
 * @param {string|null} head
 * @param {unknown} commitProbe
 * @param {unknown} treeProbe
 */
function judgeRepoHealthy(head, commitProbe, treeProbe) {
  if (typeof head !== 'string' || head.trim() === '') return false
  return probeSucceeded(commitProbe) && probeSucceeded(treeProbe)
}

/**
 * DBG-87: 归档至少要能搬回去(目录 + 非空 HEAD + objects 目录)。
 * 不要求对象健康 —— 损坏现场本身就是要留下来的东西。
 * @param {{exists?:boolean,isDirectory?:boolean,headText?:string|null,hasObjects?:boolean}|null} probe
 * @returns {{ok:true}|{ok:false,reason:string}}
 */
function judgeArchiveRestorable(probe) {
  if (!probe || typeof probe !== 'object') return { ok: false, reason: '归档探针缺失' }
  if (probe.exists !== true) return { ok: false, reason: '归档不存在' }
  if (probe.isDirectory !== true) return { ok: false, reason: '归档不是目录' }
  if (typeof probe.headText !== 'string' || probe.headText.trim() === '') {
    return { ok: false, reason: '归档缺 HEAD 或 HEAD 为空' }
  }
  if (probe.hasObjects !== true) return { ok: false, reason: '归档缺 objects' }
  return { ok: true }
}

/**
 * 删原 gitdir 之前的完整性:在可恢复之上,HEAD 必须与原件逐字一致。
 * @param {{exists?:boolean,isDirectory?:boolean,headText?:string|null,sourceHeadText?:string|null,hasObjects?:boolean}|null} probe
 * @returns {{ok:true}|{ok:false,reason:string}}
 */
function judgeArchiveComplete(probe) {
  const base = judgeArchiveRestorable(probe)
  if (!base.ok) return base
  if (typeof probe.sourceHeadText !== 'string' || probe.sourceHeadText.trim() === '') {
    return { ok: false, reason: '原 gitdir 的 HEAD 读不到,无法对账归档' }
  }
  if (probe.headText !== probe.sourceHeadText) {
    return { ok: false, reason: '归档 HEAD 与原 gitdir 不一致' }
  }
  return { ok: true }
}

/** 归档判据不是 ok 时,绝不允许删原 gitdir。 */
function mayRemoveOriginalGitdir(archiveVerdict) {
  return archiveVerdict?.ok === true
}

/**
 * DBG-87: clone 没有留下 HEAD 时怎么收场。
 * 原件已删且归档完整 ⇒ restore;原件还在 ⇒ abort-keep;删了但归档不完整 ⇒ unrecoverable。
 * @param {{cloneHasHead?:boolean,originalRemoved?:boolean,archiveComplete?:boolean}} [state]
 * @returns {'proceed'|'restore'|'abort-keep'|'unrecoverable'}
 */
function cloneFailureAction({ cloneHasHead, originalRemoved, archiveComplete } = {}) {
  if (cloneHasHead === true) return 'proceed'
  if (originalRemoved === true && archiveComplete === true) return 'restore'
  if (originalRemoved === true) return 'unrecoverable'
  return 'abort-keep'
}

/**
 * DBG-50: 重建 index 只用 mixed reset,不动工作区。
 * `checkout -- .` / `reset --hard` 会丢掉并发会话未提交改动。
 */
function indexRebuildPlan() {
  return { command: 'reset', touchesWorktree: false }
}

/** @param {unknown} command */
function commandDiscardsWorktree(command) {
  const text = String(command ?? '')
  if (/checkout\s+--\s+\./.test(text)) return true
  if (/reset\s+--hard\b/.test(text)) return true
  if (/\brestore\b/.test(text) && /(^|\s)\.(?:\s|$)/.test(text)) return true
  return false
}

/**
 * 读 gitdir 的结构探针。读失败按「不存在」返回,调用方不得把读失败当成完整。
 * @param {string} dir
 * @param {string|null|undefined} [sourceHeadText]
 */
function readGitdirProbe(dir, sourceHeadText = undefined) {
  const probe = {
    exists: false,
    isDirectory: false,
    headText: null,
    sourceHeadText,
    hasObjects: false,
  }
  try {
    if (!existsSync(dir)) return probe
    probe.exists = true
    const st = statSync(dir)
    probe.isDirectory = st.isDirectory()
    if (!probe.isDirectory) return probe
    const headPath = join(dir, 'HEAD')
    if (existsSync(headPath) && statSync(headPath).isFile()) {
      probe.headText = readFileSync(headPath, 'utf8')
    }
    const objectsPath = join(dir, 'objects')
    probe.hasObjects = existsSync(objectsPath) && statSync(objectsPath).isDirectory()
  } catch {
    return probe
  }
  return probe
}

/**
 * 把已通过可恢复判据的归档拷回 targetGitDir,并再验一次落点。
 * 拷贝失败或落点对不上都抛错,调用方不得把它印成「已恢复」。
 * @param {string} archiveDir
 * @param {string} targetGitDir
 */
function restoreGitdirFromArchive(archiveDir, targetGitDir) {
  const verdict = judgeArchiveRestorable(readGitdirProbe(archiveDir))
  if (!verdict.ok) throw new Error(`归档无法用于恢复: ${verdict.reason}`)
  cpSync(archiveDir, targetGitDir, { recursive: true, force: true })
  const restored = judgeArchiveRestorable(readGitdirProbe(targetGitDir))
  if (!restored.ok) throw new Error(`恢复后校验失败: ${restored.reason}`)
}

/**
 * 健康检查:HEAD commit/tree 对象可读 + refs 有效。
 * 注意本机已知坑:git fetch 写 refs/remotes/* 会静默不落盘,因此**不要**把
 * 「fetch 后的 ahead/behind 判断」当作健康/同步的唯一判据;需要比对远端时
 * 用 `git ls-remote` 直接查远端引用更可靠。
 */
function isHealthy(repoRoot) {
  const head = run(`git -C ${repoRoot} rev-parse HEAD`, true)
  if (!head) return false
  // 2026-11-05 治理债④:原 `!== null || true` 使本行恒真 ⇒ 对象缺失也报「健康」(§0.3)。
  // `git cat-file -e` 成功时不打字,run(…, true) 返回 '';失败返回 null —— 只认这两态。
  // 布尔 true 不是成功:那是 `|| true` 折出来的值,不得再判成健康。
  // 另:revspec 必须加双引号。本机 execSync 经 cmd.exe,裸 `^{commit}` 的 `^` 会被当脱字符吃掉
  // ⇒ git 收到 `abc{commit}` 恒失败 ⇒ 摘掉恒真式后判据会反过来变成「恒假」。
  const commitProbe = run(`git -C ${repoRoot} cat-file -e "${head}^{commit}"`, true)
  const treeProbe = run(`git -C ${repoRoot} cat-file -e "${head}^{tree}"`, true)
  return judgeRepoHealthy(head, commitProbe, treeProbe)
}

/**
 * 重建后逐条写回完整远端与仓库配置(修复旧逻辑会丢 core.sshCommand、core.hooksPath 等的问题)。
 * 2026-10-23:gitee/gitcode 两条镜像远端写回已删除 —— 弃用仓不得由重建脚本复活。
 */
function restoreConfig(repoRoot) {
  const cfg = [
    // 远端(唯一权威源;镜像仓已弃用,见上)
    ['remote.origin.url', 'ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git'],
    // 部署用 SSH 私钥与钩子
    [
      'core.sshCommand',
      'ssh -i C:/Users/Administrator/.ssh/id_ed25519_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20',
    ],
    ['core.hooksPath', '.husky'],
    // 禁用自动 gc(历史损坏主因)
    ['gc.auto', '0'],
    ['gc.autodetach', 'false'],
    ['maintenance.auto', 'false'],
    // 分支跟踪
    ['branch.main.remote', 'origin'],
    ['branch.main.merge', 'refs/heads/main'],
    // 提交身份
    ['user.name', '智汇AGI社区'],
    ['user.email', 'ok502319984@gmail.com'],
  ]
  for (const [k, v] of cfg) {
    run(`git -C ${repoRoot} config ${k} ${JSON.stringify(v)}`, true)
  }
}

function main() {
  const repoRoot = run('git rev-parse --show-toplevel', true)
  if (!repoRoot) {
    console.error('❌ 不在 git 仓库中')
    process.exit(1)
  }
  console.log(`🔍 仓库: ${repoRoot}`)

  if (!FORCE && isHealthy(repoRoot)) {
    console.log('✅ 仓库健康,无需重建(--check 或直接退出)')
    return
  }
  if (CHECK_ONLY) {
    console.log(
      '⚠️  仓库健康检查未通过(或 --force)。重建需执行: node scripts/git-rebuild-local.mjs',
    )
    process.exit(1)
  }

  // 2026-09-10 立:重建全程持有 git 写锁(根治多会话并发重建互相摧毁 .git 的事故链:
  // 会话 A 重建期间会话 B 的 git 命令撞上 .git 缺失 → B 也触发重建/清理 → 互删)。
  // 同一 unitId 可重入;锁被他人持有时快速失败,严禁绕过。
  //
  // 2026-11-07(DBG-85,判据语义写反 ⇒ 这条注释此前是空头承诺):
  // `run(cmd, allowFail=true)` 成功返回 trim 后的 stdout(**可能是空串**)、失败返回 null;
  // 而 `git-lock.mjs check` 的契约是 exit 0 = 无锁、exit 1 = 有锁。
  // 原写法 `!== null` 只在"无锁"时为真 ⇒ **锁被别人持有时反而跳过整个取锁块、直接往下重建**,
  // 正是它要防的那场事故。现改为:check 判 null(有锁)即 fail-fast,取到锁才继续。
  const lockUnit = 'git-rebuild-local'
  const lockScript = join(repoRoot, 'scripts', 'git-lock.mjs')
  if (lockHeldBlocksRebuild(run(`node "${lockScript}" check`, true))) {
    console.error('❌ git 写锁被其他会话/进程持有:此时重建会互相删除对方的 .git')
    console.error('   请等待其完成后再试;严禁绕过锁强行重建')
    process.exit(1)
  }
  // 到这里 = check 退出 0 = 无锁,可安全获取
  if (run(`node "${lockScript}" acquire --unit ${lockUnit} --timeout 5000`, true) === null) {
    console.error('❌ 获取 git 写锁失败:另一会话/进程正在进行 git 写操作')
    console.error('   请等待其完成后再试;严禁绕过锁强行重建(会互相删除对方的 .git)')
    process.exit(1)
  }
  process.on('exit', () => {
    run(`node "${lockScript}" release --unit ${lockUnit}`, true)
  })

  const url = remoteUrl(repoRoot)

  // ── separate-git-dir 布局探测(2026-09-12 起) ────────────────────────────
  // 优先读工作区 .git:若是文件且首行形如 `gitdir: <路径>`,则用该路径作为真
  // gitdir(兼容将来路径变化,不硬编码);若是目录才用旧逻辑的 <repo>/.git。
  const dotGit = join(repoRoot, '.git')
  let targetGitDir = dotGit
  let isSeparate = false
  if (existsSync(dotGit)) {
    const st = statSync(dotGit)
    if (st.isFile()) {
      const firstLine = readFileSync(dotGit, 'utf8').split('\n')[0].trim()
      const m = firstLine.match(/^gitdir:\s*(.+)$/)
      if (m) {
        const cand = m[1].trim()
        // 指针本身可能被上一轮重建写成自指(`gitdir: <repo>/.git`),或指向一个已被
        // 宿主清空的空壳目录。照它走会让 clone 落回工作区内的 .git(正是 §5b 要防的
        // "把实体拉回工作区→被 safe-delete 整体删掉"),并再次产出同一个坏指针。
        const selfRef = join(repoRoot, '.git').toLowerCase() === join(cand).toLowerCase()
        const looksLikeGitDir =
          existsSync(join(cand, 'HEAD')) || existsSync(join(cand, 'objects'))
        if (!selfRef && looksLikeGitDir) {
          targetGitDir = cand
          isSeparate = true
        } else {
          console.error(`⚠️  .git 指针不可信(自指=${selfRef} 像 gitdir=${looksLikeGitDir}): ${cand}`)
          console.error(`   回退外部 gitdir 布局,不再照指针走`)
          targetGitDir = externalGitDir(repoRoot)
          isSeparate = true
        }
      }
    } else if (st.isDirectory()) {
      targetGitDir = dotGit // 旧布局:真 gitdir 就是工作区内的 .git 目录
    }
  } else {
    // 无 .git:默认采用外部 gitdir 布局,兼容将来路径变化
    targetGitDir = externalGitDir(repoRoot)
    isSeparate = true
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  // 归档落 §15b 唯一备份目录(与 git-guardian 同一出口,单一真相源);
  // 旧写法 `${targetGitDir}.broken-<ts>` 每次重建都必然在盘根长出一个兄弟目录(实测累计 1.94GB)。
  const archiveDir =
    gitdirArchivePath(`${basename(targetGitDir)}.broken-${ts}`) || `${targetGitDir}.broken-${ts}`
  const cloneDir = mkScratch('ihui-git-rebuild-')

  console.log('🔧 检测到仓库异常,开始从远端重建...')
  console.log(`   远端: ${url}`)
  console.log(`   真 gitdir: ${targetGitDir}${isSeparate ? ' (separate-git-dir)' : ''}`)

  // 0. 破坏性覆盖前先归档并校验完整。对不上就停,绝不先删 .git。
  let originalRemoved = false
  let archiveComplete = false
  if (existsSync(targetGitDir)) {
    console.log(`   ⓪ 归档现有 gitdir → ${archiveDir}`)
    const sourceProbe = readGitdirProbe(targetGitDir)
    try {
      execSync(`cp -r "${targetGitDir}" "${archiveDir}"`, { stdio: 'ignore', windowsHide: true })
    } catch (e) {
      console.error(`❌ 归档现有 gitdir 失败: ${String(e.message ?? e)}`)
      console.error('   放弃破坏性重建,仓库保持原状。请排查磁盘/权限后重试。')
      rmScratch(cloneDir, { bestEffort: true })
      process.exit(1)
    }
    const archiveVerdict = judgeArchiveComplete(readGitdirProbe(archiveDir, sourceProbe.headText))
    if (!mayRemoveOriginalGitdir(archiveVerdict)) {
      console.error(`❌ 归档不完整(${archiveVerdict.reason}),拒绝删除 gitdir`)
      console.error(`   原 gitdir 保持不动: ${targetGitDir}`)
      console.error(`   未通过校验的归档: ${archiveDir}`)
      rmScratch(cloneDir, { bestEffort: true })
      process.exit(1)
    }
    rmSync(targetGitDir, { recursive: true, force: true })
    originalRemoved = true
    archiveComplete = true
  }

  // 1. 从远端 clone(不 checkout,仅获取 .git)
  console.log(`   ① 从远端 clone(--no-checkout)到 ${cloneDir}`)
  mkdirSync(cloneDir, { recursive: true })
  const cloneCmd = `git clone --no-checkout "${url}" "${cloneDir}"`
  const cloneOut = run(cloneCmd, true)
  const cloneHasHead = existsSync(join(cloneDir, '.git', 'HEAD'))
  const failureAction = cloneFailureAction({ cloneHasHead, originalRemoved, archiveComplete })
  if (failureAction !== 'proceed') {
    console.error(`❌ clone 失败: ${cloneOut ?? '未知错误'}`)
    if (failureAction === 'restore') {
      try {
        restoreGitdirFromArchive(archiveDir, targetGitDir)
        console.error(`   已按归档恢复 gitdir → ${targetGitDir}`)
        console.error('   远端可能不可达。仓库指针已回到归档副本,请检查网络后重试。')
      } catch (e) {
        console.error(`❌ 按归档恢复失败: ${String(e?.message ?? e)}`)
        console.error(`   原 gitdir 仍缺。请手动把 ${archiveDir} 搬回 ${targetGitDir}`)
      }
    } else if (failureAction === 'unrecoverable') {
      console.error('   原 gitdir 已删除且归档不可用,无法自动恢复。')
      console.error(`   归档位置: ${archiveDir}`)
    } else {
      console.error('   原 gitdir 未被删除,仓库保持原状。')
    }
    rmScratch(cloneDir, { bestEffort: true })
    process.exit(1)
  }

  // 2. 把克隆出的 .git 落到真 gitdir;工作区 .git 指针形态保持不变
  console.log('   ② 落盘到真 gitdir(工作区 .git 指针不变)')
  execSync(`mv "${join(cloneDir, '.git')}" "${targetGitDir}"`, { stdio: 'ignore', windowsHide: true })
  if (isSeparate) {
    // 确保工作区 .git 仍是指针文件(指向外部 gitdir),而非 544MB 目录
    writeFileSync(dotGit, `gitdir: ${targetGitDir}\n`)
  }

  // 3. 重建 index(工作区不动),恢复分支跟踪
  console.log('   ③ 重建 index(git reset) — 工作区文件不动')
  const indexPlan = indexRebuildPlan()
  if (indexPlan.touchesWorktree || commandDiscardsWorktree(indexPlan.command)) {
    console.error('❌ 拒绝执行会丢弃未提交工作区的 index 重建命令')
    process.exit(1)
  }
  run(`git -C ${repoRoot} ${indexPlan.command}`, true)
  const branch = run(`git -C ${repoRoot} symbolic-ref --short HEAD`, true)
  if (!branch) {
    // clone 默认分支可能是别的,切回 main 并跟踪。
    // 这里只建分支;不得改成 checkout -- . ,那会无差别丢掉并发会话的未提交改动。
    run(`git -C ${repoRoot} checkout -b main origin/main`, true)
  }

  // 4. 恢复完整远端与仓库配置
  console.log('   ④ 恢复完整远端与仓库配置')
  restoreConfig(repoRoot)

  // 5. 清理 clone 临时目录(§26 唯一落点:rmScratch 自带 EPERM 重试与嵌套 scratch 根守卫)
  console.log('   ⑤ 清理临时目录')
  rmScratch(cloneDir)

  console.log('')
  console.log('✅ 重建完成。工作区文件完好,未推送改动需重新提交:')
  console.log('   git status          # 查看差异(你的改动会显示为 modified/untracked)')
  console.log('   git diff            # 确认改动内容')
  console.log('   git add <文件> && git commit  # 重新提交(建议用 scripts/safe-commit.mjs)')
  console.log(`   损坏备份: ${archiveDir}(确认无误后可删除)`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// AGENTS §22d 双形态入口守卫:只有 CLI 直跑才执行,被 import 时**绝不**触发重建流程
// (本脚本的默认档会动 .git / 覆盖 gitdir,被 import 就跑等于在测试进程里做仓库手术)。
// main 是**同步**函数 ⇒ 用 try/catch 形态而非 .catch(规格 §2 第 2 条)。
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

// 判据单元 = 本文件已有的三个决策函数(路径推导 / 健康检查 / 远端回退),只引用不写实现。
export const __test__ = {
  externalGitDir,
  isHealthy,
  remoteUrl,
  lockHeldBlocksRebuild,
  judgeRepoHealthy,
  judgeArchiveRestorable,
  judgeArchiveComplete,
  mayRemoveOriginalGitdir,
  cloneFailureAction,
  indexRebuildPlan,
  commandDiscardsWorktree,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
