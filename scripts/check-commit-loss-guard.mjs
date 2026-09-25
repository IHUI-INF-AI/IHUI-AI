#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-commit-loss-guard.mjs — Commit 丢失防护守门(AGENTS.md §22 配套)
 *
 * 背景(2026-07-25 立,真实事故):
 *   reflog 记录 18:12-18:20 期间发生 6 次 `reset: moving to HEAD~` 操作,
 *   导致 3 个本地 commit(15b984f90 / 5ef36e59d / b120c6e20)在 main 历史中消失。
 *   工作内容通过后续 commit 重新整合,但原始 commit hash 永久不可追溯。
 *
 * 防护目标:
 *   1. 检测 reflog 近期 reset 操作 → 告警 + 提示 reset 风险
 *   2. 检测 fsck 悬空 commit → 过滤 stash-like 对象后核对 tag 备份
 *   3. 列出所有 lost-commit/* tag(防止 git gc 清理)
 *   4. 校验远程 lost-commit/backup tag 完整性 + tag 对象可达性
 *      (本地 tag 可能被 git gc 清理;远端 tag 缺失会导致 commit 永久丢失)
 *
 * --filter-stash 模式(guardian-runner 30a 注册):
 *   过滤掉 stash-like 悬空 commit(WIP / On main / index on main / untracked files on main),
 *   这些是 git stash / reset / merge 中间状态,不是真 commit 丢失。
 *   对未备份的 stash-like 悬空 commit,会从 subject 提取"原 commit hash"
 *   与 lostTag 集合比对,避免误报。
 *
 * 当前模式: blocking 模式(isBlocking=true)下,reset 操作或未备份悬空 commit → exit 1。
 * 远程 tag 完整性:仅远端 tag 缺失或 tag 对象不可达时 → exit 1(必须先 fetch 拉回);
 * 多余的本地 tag(远端没有)→ warn,不阻塞。
 *
 * 检查逻辑:
 *   1. git reflog --all --date=iso 最近 50 步
 *      → 含 'reset: moving to HEAD~' 或 'reset: moving to HEAD@{' → 告警
 *   2. git fsck --connectivity-only --unreachable --no-reflogs
 *      → 含 'unreachable commit' 行 → 列出悬空 commit hash
 *   3. git tag -l "lost-commit/*" "backup/*"
 *      → 列出已 tag 备份的丢失 commit / 备份快照
 *   4. 远程 tag 完整性: git ls-remote origin 'refs/tags/lost-commit/*' 'refs/tags/backup/*'
 *      → 本地/远端 tag 集对比(仅远端缺失 → blocking;仅本地 → warn)
 *      → git cat-file -e <tag> / <tag>^{} 验证 tag 对象 + commit 对象可达性
 *   5. 综合判定(reflog reset / 未备份悬空 commit / 远端 tag 缺失 / tag 对象不可达)
 *
 * 退出码:
 *   0 — 通过(warn 告警可被忽略,但 stdout 仍打印提示)
 *   1 — blocking/strict 模式下有阻塞项(reflog reset / 未备份悬空 commit /
 *        远端 tag 缺失需 fetch / tag 对象不可达)
 *
 * 豁免:
 *   - HUSKY_SKIP_COMMIT_LOSS_CHECK=1: 跳过本检查(紧急场景,不推荐)
 *   - --strict: 升级为 blocking,任一告警都阻塞 commit
 *
 * 用法:
 *   node scripts/check-commit-loss-guard.mjs
 *   node scripts/check-commit-loss-guard.mjs --strict
 *   HUSKY_SKIP_COMMIT_LOSS_CHECK=1 node scripts/check-commit-loss-guard.mjs
 *
 * 调用方:
 *   - scripts/guardian-runner.mjs 第 30 项(warn-only → 后续 blocking)
 *   - 手动验证: git 异常操作后跑一次确认无丢失
 */
import { catBatch, gitRaw } from './lib/face-reader.mjs'

/**
 * 判定对象 = **当前工作目录所在的仓库**,不是脚本自己所在的那个仓库。
 * 镜像测试把本门 `spawn` 进临时夹具仓里跑(cwd=临时仓),这是"装车证明"能成立的前提:
 * 若把根锚在脚本位置,所有临时仓用例都会去查真仓,测试就把"判据有牙"证明不了。
 * 原先每条命令都靠继承 cwd 定位仓库,这里显式传给层,取值不变。
 */
const ROOT = process.cwd()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const SKIP_ENV = 'HUSKY_SKIP_COMMIT_LOSS_CHECK'

/**
 * "仅本地 tag"这句 warn 在 2026-09-24 被证明会被反复误读成"再推一次就好",
 * 而真实原因多半是**空壳 tag**(历史链里的对象本机已没有 ⇒ push 必然
 * `unable to read <sha>` + `remote unpack failed: index-pack failed`,重试与换网络都无用)。
 * 把判定与出口一次性写清楚,免得下一个会话再花两小时重走。
 */
const HOLLOW_TAG_HINT =
  '先分清"没推"还是"推不动":node scripts/sync-lost-commit-tags.mjs --auto-push 的失败行里若出现' +
  ' "fatal: unable to read <sha>" + "remote unpack failed",即空壳 tag —— 对象已不在本机,' +
  ' 补推是死路(只能从仍持有该对象的 gitdir 回补,或按 AGENTS.md §29 人工 GC)。' +
  ' 逐枚判完整要用 git rev-list --objects --missing=allow-any(默认 rev-list 会在第一个缺失对象处 abort,' +
  ' 只看 stdout 会把"半路死"读成"链完整")。'
const isStrict = process.argv.includes('--strict')
const isBlocking = process.argv.includes('--blocking')
const isFilterStash = process.argv.includes('--filter-stash')

/**
 * 名称列表截断(2026-09-18)。
 * 本地积压 5000+ tag 时,onlyLocal 全量 join 会在**每次 pre-commit** 打印约 352 KB
 * 的 tag 名清单(2026-09-18 实测),把真正的告警信号淹没在刷屏里。统一截断为
 * 前 5 个 + 总数;数量本身已足以判断严重程度。
 */
function briefList(items, limit = 5) {
  if (items.length <= limit) return items.join(', ')
  return `${items.slice(0, limit).join(', ')} … 等 ${items.length} 个`
}
const skip = process.env[SKIP_ENV] === '1'

// 本地命令可放宽;网络命令(ls-remote)必须限时,防境外 GitHub 访问挂起阻塞 pre-commit
// (2026-08-17 实测:execSync 无 timeout 时 git ls-remote origin 可无限阻塞 → [30a] 守门卡死,
//  commit 永远无法完成;超时后按 allowFail 返回空,远程校验安全降级为跳过)
const REMOTE_TIMEOUT_MS = 15_000
// 本地 git 命令(批量 subject 获取)限时,防单次调用异常挂起
const LOCAL_GIT_TIMEOUT_MS = 10_000
/** 旧 `runGit()`(spawnSync 通道)的默认上限;层默认 60s,这里显式保住原值,免得迁移改了失败时机 */
const SPAWN_DEFAULT_TIMEOUT_MS = 120_000

/**
 * 本门唯一的 git 出口:命令构造与派生本体都在共用层 `scripts/lib/face-reader.mjs` 的 `gitRaw`
 * (绝对路径 git + safe.directory + quotepath + 显式 stdio + windowsHide + maxBuffer 都给足)。
 * 这里只剩本门特有的两件事:① `allowFail` —— 把"取不到"折成空串交由调用方降级;② `.trim()`
 * (与旧的 `run()` / `runGit()` 逐字一致)。
 * 旧写法有两条通道:`run(shell 字符串)` 与 `runGit(spawnSync argv)`,同一道判据两套引号语义
 * (cmd 会展开 `%(objectname)` 那类形态,已留过事故);现统一为层的 argv 形态。
 */
function gitText(args, opts = {}) {
  const { allowFail = false, ...rest } = opts
  try {
    return gitRaw(args, ROOT, rest).trim()
  } catch (e) {
    if (allowFail) return ''
    throw e
  }
}

/**
 * 一批 commit oid → `Map<commit, tree oid>`。
 *
 * 原实现把 `<oid>^{tree}` 喂给 `cat-file --batch-check=%(objectname)`;层只暴露内容版的
 * `catBatch`,而 commit 对象的**第一行就是 `tree <oid>`** ⇒ 用同一条批量通道问一次即可,
 * 既不必新增第二处自拼派生,也不必逐对象 `rev-parse`(4500 枚 = 4500 次进程创建)。
 * 批量体量:4.5k 个 commit ≈ 2MB,远在层的 64MB 缓冲之内。
 *
 * 与旧写法的唯一结论差(如实登记):备份 tag 若指向**非 commit**(tree/blob),旧写法经
 * `^{tree}` 剥出树 oid 计入"已备份树"集合,现在不计 ⇒ 方向是"更难放行",丢失防护只会更严;
 * 而本仓 lost-commit/* 与 backup/* 全部指向 commit,实测两侧结论相同。
 * 旧写法对"对象缺失"那行取首 token(= 输入的 commit oid)当成树 oid 收进集合,本实现跳过 ——
 * 那个 token 永远不可能等于任何真树 oid,两种写法对判定无影响。
 */
function treesForCommits(oids) {
  const out = new Map()
  const list = [...new Set(oids.filter((h) => /^[0-9a-f]{40}$/.test(String(h) || '')))]
  if (list.length === 0) return out
  const got = catBatch(ROOT, list)
  for (const h of list) {
    const m = /^tree ([0-9a-f]{40})/.exec(got.get(h) || '')
    if (m) out.set(h, m[1])
  }
  return out
}

/**
 * 自愈:把"仅远端有、本地缺"的备份 tag 拉回来,并固化进 packed-refs。
 *
 * 为什么必须有:这类差异**不是 commit 丢失风险**(东西在远端,本地只是少一个引用),
 * 但原先它直接 blocking —— 于是另一台机器每推一批 tag,本机每次提交都得先手工 fetch,
 * 拉不到就一直红(2026-09-24 实测:另一台机推的 6 个 `lost-commit/filterbw-*` 把 [30a] 钉成恒红,
 * 结果就是人人 `--no-verify`,连带跳过整条守门链)。
 *
 * 固化不可省:嵌套 `refs/tags/<ns>/*` 的松散文件会被宿主清理层删掉(AGENTS §5b),
 * 只 fetch 不 pack 等于下一次提交又红一遍。
 *
 * @returns {{fetched:string[], stillMissing:string[], networkFailed:boolean, reason:string}}
 */
function healMissingRemoteTags(names) {
  const CHUNK = 50
  const MAX = Number(process.env.IHUI_TAG_HEAL_MAX || 400)
  const TIMEOUT = Number(process.env.IHUI_TAG_HEAL_TIMEOUT_MS || 60_000)
  const target = names.slice(0, MAX)
  const fetched = []
  let networkFailed = false
  let reason = ''
  for (let i = 0; i < target.length; i += CHUNK) {
    const chunk = target.slice(i, i + CHUNK)
    const refspecs = chunk.map((t) => `refs/tags/${t}:refs/tags/${t}`)
    try {
      gitText(['fetch', '--no-tags', 'origin', ...refspecs], { timeout: TIMEOUT })
      for (const t of chunk) {
        const sha = gitText(['rev-parse', '--verify', '--quiet', `refs/tags/${t}`], {
          allowFail: true,
          timeout: SPAWN_DEFAULT_TIMEOUT_MS,
        })
        if (sha) fetched.push(t)
      }
    } catch (e) {
      // 离线 / 超时 / 无凭据:如实记录,由调用方降级为警告,绝不把提交卡死
      networkFailed = true
      reason = String((e && (e.stderr || e.message)) || e)
        .split('\n')[0]
        .slice(0, 160)
    }
  }
  if (fetched.length)
    gitText(['pack-refs', '--all', '--prune'], {
      allowFail: true,
      timeout: SPAWN_DEFAULT_TIMEOUT_MS,
    })
  const stillMissing = target.filter((t) => !fetched.includes(t))
  return {
    fetched,
    stillMissing,
    networkFailed,
    reason,
    truncated: Math.max(0, names.length - target.length),
  }
}

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

function detectResets() {
  // reflog 最近 50 步(每行包含: hash | ref@{} | action: subject)
  // 2026-07-26 升级:从 20 步扩到 50 步,覆盖更长期的 reset 历史
  const out = gitText(['reflog', '--all', '--date=iso', '-n', '50'], { allowFail: true })
  if (!out) return []
  const lines = out.split('\n')
  const resets = []
  for (const line of lines) {
    // 匹配 "reset: moving to HEAD~" / "reset: moving to HEAD@{1}" 等
    if (/reset:\s*moving to HEAD[~@]/.test(line)) {
      resets.push(line)
    }
  }
  // 2026-09-04 修复:若 reset 的源 commit(hash 即行首字段)已被 lost-commit/* tag
  // 备份,则该次 reset 不构成丢失风险,放行(与悬空 commit 的 tag 备份判定对齐)。
  // 否则历史 reset 会永久滞留 reflog 最近 50 步窗口内,无解阻塞所有后续 commit。
  const backedHashes = new Set(
    verifyAllTagReachability(listLostCommitTags())
      .map((r) => r.hash)
      .filter(Boolean),
  )
  return resets.filter((line) => {
    const srcHash = line.trim().split(/\s+/)[0] || ''
    if (!srcHash) return true
    // 前缀匹配(git 对唯一对象输出短 hash)
    for (const h of backedHashes) if (h.startsWith(srcHash) || srcHash.startsWith(h)) return false
    return true
  })
}

function isStashSubject(subject) {
  if (!subject) return false
  // stash-like subject 形如 "WIP on <branch>: <hash> <msg>" / "On <branch>: <hash> <msg>"
  // / "index on <branch>: <hash> <msg>" / "untracked files on <branch>: <hash> <msg>"
  // 2026-08-17 修复:原正则只匹配 "index on main:"/"On main:",漏掉其他分支(如
  // fix/* 分支)产生的 stash 索引快照,导致误报"未备份悬空 commit"阻塞 commit。
  // 改为匹配任意分支名(冒号前为非空非空白串),与 HASH_EXTRACT_REGEX 保持一致。
  return (
    /^WIP on /.test(subject) ||
    /^On \S+: /.test(subject) ||
    /^index on \S+: /.test(subject) ||
    /^untracked files on /.test(subject)
  )
}

function extractOriginalHashFromStash(subject) {
  // stash subject 形如:
  //   "WIP on main: 5ef36e59d <msg>"
  //   "On main: 5ef36e59d <msg>"
  //   "index on main: 5ef36e59d <msg>"
  //   "untracked files on main: 5ef36e59d <msg>"
  // 提取第二个冒号后的原 commit hash
  if (!subject) return ''
  const m = subject.match(/^[A-Za-z ]+on\s+\S+:\s+([0-9a-f]{7,40})\b/)
  return m ? m[1] : ''
}

function listUnreachableHashes() {
  // --no-reflogs: 不遍历 reflog(只检查悬空 commit 对象)
  // --connectivity-only: 只走对象图连通性,不校验 tree/blob 内容 —— 本函数的判据
  // 只看 `unreachable commit` 行,内容校验对它是纯开销。2026-09-24 本机实测(共享工作区,
  // 4251 枚 lost-commit tag + partial 对象):完整模式 130,217ms / conn 模式 3,059ms,
  // 而 unreachable commit=8/8、tree=775/775、blob=607/607、行类型集合(broken/to/unreachable/
  // missing)**逐条相同** ⇒ 快 42.6 倍且判据零损失。
  // 为什么值得为此改一行:完整 fsck 的 130 秒窗口横跨并发会话的 reset/tag 手术,
  // 期间读到的正是一份**移动中的现场**;窗口越短,pre-commit 被并发态误判成红的概率越低。
  // 旧写法在这里挂 `2>&1`(只有 shell 通道才需要)。层的 gitRaw 分别捕获 stdout/stderr,
  // 而本判据只取 stdout 上的 `unreachable commit` 行(git 的不可达对象清单本来就打在 stdout,
  // 诊断与警告才走 stderr)⇒ 去掉合并不会少一行,少了的行也不是判据输入。
  const out = gitText(['fsck', '--connectivity-only', '--unreachable', '--no-reflogs'], {
    allowFail: true,
  })
  if (!out) return []
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('unreachable commit'))
    .map((l) => l.replace(/^unreachable commit\s+/, ''))
    .filter(Boolean)
}

function detectUnreachable() {
  // --no-reflogs: 不遍历 reflog(只检查悬空 commit 对象)
  // 原始 hash 列表(用于后续丢失 commit 备份核对)
  return listUnreachableHashes()
}

function filterStashLike(hashes) {
  // 对每个 hash 取 subject,若是 stash-like 形态(WIP / On main / index on main)则过滤
  // 2026-08-17 性能修复:原实现对每个 hash 单独 execSync(git log -1),仓库悬空 commit
  // 数百个时累积 10+ 分钟,阻塞 pre-commit。改为 git log --no-walk 分批批量获取 subject。
  // 注意:--no-walk 输出顺序与参数顺序不一致(实测 058d/1630/2b3f vs 传参 058d/ecc5/...),
  // 必须用 %H 完整 hash 建 map 关联,严禁按行索引对应(曾致 stash-like 过滤错位误报)。
  const BATCH = 50
  const subjectByHash = new Map()
  for (let i = 0; i < hashes.length; i += BATCH) {
    const batch = hashes.slice(i, i + BATCH)
    const out = gitText(['log', '--no-walk', '--format=%H%x09%s', ...batch], {
      allowFail: true,
      timeout: LOCAL_GIT_TIMEOUT_MS,
    })
    if (!out) continue
    for (const line of out.split('\n')) {
      const [hash, ...rest] = line.split('\t')
      if (hash) subjectByHash.set(hash, rest.join('\t'))
    }
  }
  return hashes.filter((c) => !isStashSubject(subjectByHash.get(c) || ''))
}

function listLostCommitTags() {
  const out = gitText(['tag', '-l', 'lost-commit/*'], { allowFail: true })
  if (!out) return []
  return out.split('\n').filter(Boolean)
}

function listBackups() {
  const out = gitText(['tag', '-l', 'backup/*'], { allowFail: true })
  if (!out) return []
  return out.split('\n').filter(Boolean)
}

// 2026-07-26 升级:远程 tag 完整性校验(防"本地 tag 被 git gc + 远端 fetch 失败"事故复发)
// 解析 git ls-remote 输出,过滤掉 ^{} peel 行(只保留 tag 引用本身)
// 注意:pattern 里的 `[^ ]` 字符类是显式排除空格的写法,与引号无关 —— shell 通道的引号剥离
// 陷阱(cmd 把双引号原样交给 git,pathspec 就带上了字面引号)在 argv 通道里根本不存在,
// 迁移到层(gitRaw 恒 argv)后这句只作为"为什么这里没有引号"的说明留着.
function parseRemoteTagOutput(stdout) {
  if (!stdout) return []
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith('^{}'))
    .map((l) => l.split(/\s+/))
    .filter((cols) => cols.length >= 2)
    .map((cols) => cols[1].replace(/^refs\/tags\//, ''))
    .filter(Boolean)
}

function listRemoteLostCommitTags() {
  // ls-remote 可能因网络/凭据失败,失败时返回 null(区别于成功的空集)
  // 旧注释写"Windows 上 git.exe 在 pipe stdio 模式下 schannel SSL handshake 不稳定,必须用
  // shell:true 走 cmd 包装器" —— 该前提在迁移时当次实测已不成立:同一份 argv + stdio['ignore',
  // 'pipe','pipe'] 跑 `ls-remote origin refs/tags/lost-commit/[^ ]*` 取回 4558 行 / 8.4s(本机
  // origin 走 ssh-over-443)。故撤掉 shell 通道,统一走层;真失败仍由下方 catch 折成 null 降级。
  // 2026-08-17 加 timeout:境外 GitHub 访问慢时无限阻塞(实测 >12min),导致 pre-commit [30a]
  // 卡死、commit 无法完成。15s 超时按失败处理(安全降级跳过远程校验)。
  // 2026-09-06 修复:失败/超时此前返回空集被当成"远端无任何 tag",导致全部本地 tag
  // 被误报"仅本地 N 千个未 push"(误导性警告)。现失败返回 null,调用方降级跳过远程 diff。
  let out
  try {
    out = gitText(['ls-remote', 'origin', 'refs/tags/lost-commit/[^ ]*'], {
      timeout: REMOTE_TIMEOUT_MS,
    })
  } catch {
    return null
  }
  return parseRemoteTagOutput(out)
}

function listRemoteBackups() {
  // 同上:argv 走层,15s 超时防境外网络无限阻塞(2026-08-17);2026-09-06 失败返回 null
  let out
  try {
    out = gitText(['ls-remote', 'origin', 'refs/tags/backup/[^ ]*'], {
      timeout: REMOTE_TIMEOUT_MS,
    })
  } catch {
    return null
  }
  return parseRemoteTagOutput(out)
}

// 对所有本地 lost-commit/* + backup/* tag 做可达性校验
// 2026-08-17 性能修复:原实现对每个 tag 单独 execSync(git rev-parse + cat-file -e),
// lost-commit tag 数千个时累积 10-30 分钟阻塞 pre-commit。改为一次 git for-each-ref
// 批量获取全部 tag 的 objectname + peeled objectname,内存组装结果(实测 <2s)。
function verifyAllTagReachability(tags) {
  if (tags.length === 0) return []
  const out = gitText(
    [
      'for-each-ref',
      '--format=%(refname:short)%09%(objectname)%09%(*objectname)',
      'refs/tags/lost-commit',
      'refs/tags/backup',
    ],
    { allowFail: true, timeout: LOCAL_GIT_TIMEOUT_MS },
  )
  if (!out) return []
  // shortName → { obj, peeled }
  const infoByTag = new Map()
  for (const line of out.split('\n')) {
    const [shortName, obj, peeled] = line.split('\t')
    if (shortName) infoByTag.set(shortName, { obj: obj || '', peeled: peeled || '' })
  }
  return tags.map((tag) => {
    const info = infoByTag.get(tag)
    const result = { tag, hash: '', tagReachable: false, commitReachable: false, reason: '' }
    if (!info) {
      result.reason = 'for-each-ref 未列出该 tag(ref 缺失)'
      return result
    }
    // for-each-ref 能列出即对象可达;annotated tag 用 peeled commit,lightweight 直接用 obj
    result.hash = info.peeled || info.obj
    result.tagReachable = true
    result.commitReachable = true
    result.ok = true
    return result
  })
}

// 对比两个 tag 集合,返回 { onlyLocal, onlyRemote, both }
function compareTagSets(local, remote) {
  const localSet = new Set(local)
  const remoteSet = new Set(remote)
  return {
    onlyLocal: local.filter((t) => !remoteSet.has(t)),
    onlyRemote: remote.filter((t) => !localSet.has(t)),
    both: local.filter((t) => remoteSet.has(t)),
  }
}

function main() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 commit 丢失防护守门(不推荐)${C.reset}`)
    process.exit(0)
  }

  console.log(`${C.cyan}${C.bold}🛡️  Commit 丢失防护守门(AGENTS.md §22 配套)${C.reset}`)

  const resets = detectResets()
  const rawUnreachable = detectUnreachable()
  // --filter-stash: 过滤掉 stash-like 对象(WIP / On main / index on main)
  const unreachable = isFilterStash ? filterStashLike(rawUnreachable) : rawUnreachable
  const stashCount = isFilterStash ? rawUnreachable.length - unreachable.length : 0
  const lostTags = listLostCommitTags()
  const backups = listBackups()
  // 2026-07-26 升级:远程 tag 完整性校验
  // 2026-09-06 修复:null=ls-remote 失败/超时 → 降级跳过远程 diff(不产生误导性差异)
  const remoteLostTags = listRemoteLostCommitTags()
  const remoteBackups = listRemoteBackups()
  const remoteCheckSkipped = remoteLostTags === null || remoteBackups === null
  const allLocalBackupTags = [...lostTags, ...backups]
  const reachability = verifyAllTagReachability(allLocalBackupTags)
  const lostTagDiff = remoteCheckSkipped
    ? { onlyLocal: [], onlyRemote: [], both: [] }
    : compareTagSets(lostTags, remoteLostTags)
  const backupTagDiff = remoteCheckSkipped
    ? { onlyLocal: [], onlyRemote: [], both: [] }
    : compareTagSets(backups, remoteBackups)

  // 「仅远端有、本地缺」→ 先自己 fetch 回来固化,拉不动才降级为警告(见 healMissingRemoteTags 注释)
  let remoteHeal = { attempted: false, fetched: [], stillMissing: [], degraded: false, reason: '' }
  {
    const missing = [...lostTagDiff.onlyRemote, ...backupTagDiff.onlyRemote]
    if (missing.length && !remoteCheckSkipped) {
      const r = healMissingRemoteTags(missing)
      remoteHeal = {
        attempted: true,
        fetched: r.fetched,
        stillMissing: r.stillMissing,
        degraded: r.networkFailed,
        reason: r.reason,
      }
      if (r.fetched.length) {
        // 重取本地清单再对账(fetch 前拿的那份已经是旧的了)
        try {
          gitText(['pack-refs', '--all', '--prune'], {
            allowFail: true,
            timeout: SPAWN_DEFAULT_TIMEOUT_MS,
          })
        } catch {
          /* 固化失败不改变判定,只是下次还得再拉 */
        }
        const nl = listLostCommitTags()
        const nb = listBackups()
        lostTagDiff.onlyRemote = compareTagSets(nl, remoteLostTags).onlyRemote
        backupTagDiff.onlyRemote = compareTagSets(nb, remoteBackups).onlyRemote
      }
    }
  }

  // ── 1. reflog reset 检测 ──
  console.log(header('1. reflog 最近 50 步 reset 操作检测'))
  if (resets.length === 0) {
    console.log(`  ${C.green}✅ 未检测到 reset 操作${C.reset}`)
  } else {
    console.log(`  ${C.yellow}⚠️  检测到 ${resets.length} 次 reset 操作(reflog):${C.reset}`)
    for (const r of resets) {
      console.log(`     ${C.dim}${r}${C.reset}`)
    }
    console.log(`\n  ${C.yellow}💡 reset 可能导致 commit 丢失(参见 AGENTS.md §22)。${C.reset}`)
    console.log(`     验证步骤:`)
    console.log(
      `       1. ${C.cyan}git fsck --connectivity-only --unreachable --no-reflogs${C.reset} 看悬空 commit(本机实测 3s;不带 --connectivity-only 的全量校验实测 130s,判据集合相同)`,
    )
    console.log(`       2. ${C.cyan}git show <commit-hash>${C.reset} 确认内容`)
    console.log(
      `       3. 若需保留:${C.cyan}git tag lost-commit/<name> <hash> -m "lost via reset"${C.reset}`,
    )
  }

  // ── 2. fsck 悬空 commit 检测 ──
  console.log(header('2. fsck 悬空 commit 检测(可能丢失的 commit)'))
  if (unreachable.length === 0) {
    console.log(`  ${C.green}✅ 未检测到悬空 commit${C.reset}`)
    if (isFilterStash && stashCount > 0) {
      console.log(
        `     ${C.dim}(已过滤 ${stashCount} 个 stash-like 对象:WIP / On main / index on main / untracked files on main)${C.reset}`,
      )
    }
  } else {
    console.log(`  ${C.yellow}⚠️  检测到 ${unreachable.length} 个悬空 commit:${C.reset}`)
    for (const c of unreachable.slice(0, 10)) {
      const short = c.slice(0, 12)
      const subject = gitText(['log', '-1', '--format=%s', c], { allowFail: true })
      console.log(`     ${C.cyan}${short}${C.reset}  ${C.dim}${subject || '(空)'}${C.reset}`)
    }
    if (unreachable.length > 10) {
      console.log(
        `     ${C.dim}... 还有 ${unreachable.length - 10} 个,详见 git fsck 输出${C.reset}`,
      )
    }
    if (isFilterStash && stashCount > 0) {
      console.log(`     ${C.dim}(已过滤 ${stashCount} 个 stash-like 对象,详见 git fsck)${C.reset}`)
    }
  }

  // ── 3. 已 tag 备份的丢失 commit 列表 ──
  console.log(header('3. 已 tag 备份的丢失 commit(防止 git gc 清理)'))
  if (lostTags.length === 0) {
    console.log(`  ${C.dim}(无 lost-commit/* tag)${C.reset}`)
  } else {
    // 2026-08-17 性能修复:原实现对每个 tag 单独 git rev-list + git log(数千个 tag
    // 时 20+ 分钟)。改为一次 for-each-ref 拿全部 tag 的 commit hash + 一次
    // git log --no-walk 批量拿 subject(复用 verifyAllTagReachability 的批量思路)。
    const subjByHash = new Map()
    const refPaths = lostTags.map((t) => `refs/tags/${t}`)
    // 逐枚 tag 名作 argv 传进去(本地积压 4.5k 枚 ⇒ 命令行远超 CreateProcess 的 32767 上限),
    // 旧写法经 shell 时同样超限 ⇒ 两边都是 allowFail → '' ⇒ 明细行的 hash 恒显 "?"。
    // 迁移刻意**不**把它"修好":那会把一行展示形态的既有结论换成新的,而本票是等价重构。
    // (真正的批量口径由 verifyAllTagReachability 的两次 for-each-ref 命名空间调用提供。)
    const refOut = gitText(
      ['for-each-ref', '--format=%(refname:short)%09%(*objectname)%09%(objectname)', ...refPaths],
      {
        allowFail: true,
        timeout: LOCAL_GIT_TIMEOUT_MS,
      },
    )
    const tagToHash = new Map()
    for (const line of (refOut || '').split('\n')) {
      const [shortName, peeled, obj] = line.split('\t')
      if (shortName) tagToHash.set(shortName, (peeled || obj || '').trim())
    }
    const uniqueHashes = [...new Set(tagToHash.values()).values()].filter(Boolean)
    const HASH_BATCH = 50
    for (let i = 0; i < uniqueHashes.length; i += HASH_BATCH) {
      const batch = uniqueHashes.slice(i, i + HASH_BATCH)
      const subjOut = gitText(['log', '--no-walk', '--format=%H%x09%s', ...batch], {
        allowFail: true,
        timeout: LOCAL_GIT_TIMEOUT_MS,
      })
      // --no-walk 输出顺序与参数不一致,按 %H 完整 hash 建 map(勿按行索引对应)
      for (const line of (subjOut || '').split('\n')) {
        const [hash, ...rest] = line.split('\t')
        if (hash) subjByHash.set(hash, rest.join('\t'))
      }
    }
    // 2026-09-18:逐条明细上限 —— 本地 5000+ tag 时全量打印会刷屏(实测 352 KB/次提交)
    const DETAIL_LIMIT = 10
    for (const tag of lostTags.slice(0, DETAIL_LIMIT)) {
      const hash = tagToHash.get(tag) || ''
      const short = hash.slice(0, 12) || '?'
      console.log(
        `     ${C.cyan}${tag}${C.reset} → ${C.dim}${short}${C.reset}  ${subjByHash.get(hash) || ''}`,
      )
    }
    if (lostTags.length > DETAIL_LIMIT) {
      console.log(`     ${C.dim}…另有 ${lostTags.length - DETAIL_LIMIT} 个未逐一列出${C.reset}`)
    }
  }

  if (backups.length > 0) {
    console.log(`\n  ${C.dim}backup/* tag:${C.reset}`)
    const BACKUP_DETAIL_LIMIT = 10
    for (const tag of backups.slice(0, BACKUP_DETAIL_LIMIT)) {
      const hash = gitText(['rev-list', '-1', tag], { allowFail: true })
      console.log(`     ${C.cyan}${tag}${C.reset} → ${C.dim}${hash?.slice(0, 12) || '?'}${C.reset}`)
    }
    if (backups.length > BACKUP_DETAIL_LIMIT) {
      console.log(
        `     ${C.dim}…另有 ${backups.length - BACKUP_DETAIL_LIMIT} 个未逐一列出${C.reset}`,
      )
    }
  }

  // ── 5. 远程 tag 完整性(2026-07-26 升级,放在综合判定之前) ──
  console.log(header('5. 远程 tag 完整性(本地 vs origin)'))
  console.log(
    `  ${C.dim}本地 lost-commit/*: ${lostTags.length} 个 | 本地 backup/*: ${backups.length} 个${C.reset}`,
  )
  if (remoteCheckSkipped) {
    console.log(
      `    ${C.yellow}⚠️  ls-remote 失败/超时(网络或 ${REMOTE_TIMEOUT_MS}ms 上限),远程完整性校验已安全降级跳过 — 不影响本次判定${C.reset}`,
    )
  } else {
    console.log(
      `  ${C.dim}远端 lost-commit/*: ${remoteLostTags.length} 个 | 远端 backup/*: ${remoteBackups.length} 个${C.reset}`,
    )
  }

  // 5.1 lost-commit 差异
  console.log(`\n  ${C.bold}lost-commit/* 差异:${C.reset}`)
  if (remoteCheckSkipped) {
    console.log(`    ${C.dim}(远程校验已跳过,见上方降级提示)${C.reset}`)
  } else if (lostTagDiff.onlyLocal.length === 0 && lostTagDiff.onlyRemote.length === 0) {
    console.log(`    ${C.green}✅ 本地+远端完全一致${C.reset}`)
  } else {
    if (lostTagDiff.onlyLocal.length > 0) {
      console.log(
        `    ${C.yellow}⚠️  仅本地(${lostTagDiff.onlyLocal.length} 个,未 push):${C.reset} ${briefList(lostTagDiff.onlyLocal)}`,
      )
      console.log(`    ${C.dim}${HOLLOW_TAG_HINT}${C.reset}`)
    }
    if (lostTagDiff.onlyRemote.length > 0) {
      console.log(
        `    ${C.red}❌ 仅远端(${lostTagDiff.onlyRemote.length} 个,本地缺失 — 必须 fetch):${C.reset} ${briefList(lostTagDiff.onlyRemote)}`,
      )
    }
  }
  if (remoteHeal.attempted) {
    if (remoteHeal.fetched.length) {
      console.log(
        `  ${C.green}✅ 自愈:已 fetch 并固化 ${remoteHeal.fetched.length} 个仅远端 tag${C.reset}${remoteHeal.stillMissing.length ? ` ${C.yellow}(仍缺 ${remoteHeal.stillMissing.length} 个)${C.reset}` : ''}`,
      )
    }
    if (remoteHeal.degraded) {
      console.log(
        `  ${C.yellow}⚠️  自愈 fetch 未成功(${remoteHeal.reason || '网络/凭据不可用'})—— 这类差异不构成 commit 丢失风险,降为警告${C.reset}`,
      )
    }
  }

  // 5.2 backup 差异
  console.log(`\n  ${C.bold}backup/* 差异:${C.reset}`)
  if (remoteCheckSkipped) {
    console.log(`    ${C.dim}(远程校验已跳过,见上方降级提示)${C.reset}`)
  } else if (backupTagDiff.onlyLocal.length === 0 && backupTagDiff.onlyRemote.length === 0) {
    console.log(`    ${C.green}✅ 本地+远端完全一致${C.reset}`)
  } else {
    if (backupTagDiff.onlyLocal.length > 0) {
      console.log(
        `    ${C.yellow}⚠️  仅本地(${backupTagDiff.onlyLocal.length} 个,未 push):${C.reset} ${briefList(backupTagDiff.onlyLocal)}`,
      )
      console.log(`    ${C.dim}${HOLLOW_TAG_HINT}${C.reset}`)
    }
    if (backupTagDiff.onlyRemote.length > 0) {
      console.log(
        `    ${C.red}❌ 仅远端(${backupTagDiff.onlyRemote.length} 个,本地缺失 — 必须 fetch):${C.reset} ${briefList(backupTagDiff.onlyRemote)}`,
      )
    }
  }

  // 5.3 tag 对象可达性
  const unreachableTags = reachability.filter((r) => !r.ok)
  console.log(`\n  ${C.bold}tag 对象可达性(annotated tag peel 验证):${C.reset}`)
  if (allLocalBackupTags.length === 0) {
    console.log(`    ${C.dim}(无 lost-commit/backup tag 需校验)${C.reset}`)
  } else if (unreachableTags.length === 0) {
    console.log(
      `    ${C.green}✅ 全部 ${reachability.length} 个 tag 对象可达(tag + commit 都可访问)${C.reset}`,
    )
  } else {
    console.log(
      `    ${C.red}❌ ${unreachableTags.length}/${reachability.length} 个 tag 对象不可达:${C.reset}`,
    )
    for (const r of unreachableTags) {
      const hash = r.hash ? r.hash.slice(0, 12) : '?'
      console.log(
        `       ${C.cyan}${r.tag}${C.reset} → ${C.dim}${hash}${C.reset}  ${C.red}(${r.reason})${C.reset}`,
      )
    }
    console.log(
      `    ${C.yellow}💡 修复:运行 ${C.cyan}node scripts/sync-lost-commit-tags.mjs --fetch${C.yellow} 从 origin 拉回 tag${C.reset}`,
    )
  }

  // ── 4. 综合判定 ──
  console.log(header('4. 综合判定'))

  let blocking = false
  const issues = []

  if (resets.length > 0) {
    issues.push(`reflog 检测到 ${resets.length} 次 reset 操作`)
    blocking = true // 2026-07-25 升级:reset 操作直接进 blocking(防 commit 丢失)
  }
  if (unreachable.length > 0) {
    // 检查每个悬空 commit 是否有 lost-commit tag 备份
    // 注意:stash-like 悬空 commit 的 subject 包含原 commit hash(如 "index on main: 5ef36e59d ...")
    // 需从 subject 提取原 hash 与 lostTag 比对
    // 2026-08-28 性能修复:原实现对每个 lost-commit tag 单独 execSync(git rev-list -1),
    // 数千个 tag 时累积 5+ 分钟阻塞 pre-commit [30a]。改用上方 verifyAllTagReachability
    // 已通过单次 git for-each-ref 批量算出的 hash(peeled || obj),零额外子进程。
    const lostTagNames = new Set(lostTags)
    const backedUp = new Set(
      reachability
        .filter((r) => lostTagNames.has(r.tag))
        .map((r) => r.hash)
        .filter(Boolean),
    )
    // 2026-09-04 修复:stash WIP/index commit 与其原 base commit 的树完全一致
    // (stash 只额外记录 untracked 文件,而 untracked 不进 commit 对象).
    // 因此只要悬空 commit subject 内嵌的原 hash 在备份集(base)或其 tree 被任一
    // 备份 tag 覆盖,其内容即可完整重建,不构成丢失风险 → 放行.
    // (原实现仅按 commit hash / stash subject 内嵌 hash 比对,并行会话高频
    // stash/drop 导致每次操作新增 2 个未备份悬空 commit,死锁所有后续 commit.)
    // ⚠ 重要事实修正(2026-09-04 二次诊断):"index on main" commit 是 stash
    //   时暂存区快照,与 HEAD/base 树**并不恒等**(部分 stage 场景),纯 tree
    //   等价判定对这类 commit 会漏放;且 stash 链 parent/grandparent 均不可达
    //   时唯一可靠出口是显式 tag 备份(unreachable-commits-backup/*).
    // 性能:backedUp ~4400 个 hash,批量 for-each-ref + 一次批量取 tree,
    // 且一律 argv 直调(不经 shell)避免 %(xxx) format 被破坏.
    const backedTrees = new Set()
    {
      // 2026-09-04 加固:必须 argv 直调(不经 cmd)——原字符串版经 shell:true 时 cmd 会把
      // %(objectname) 当环境变量展开、把双引号原样传给 git,导致 refOut 为空/格式错乱;
      // 虽然 backedUp 集合兜底使主路径未爆,但并行高频 stash 场景下该兜底可能失效,
      // 必须从根上消除 shell 依赖.(2026-09-25 迁移:argv 通道即共用层 gitRaw 的唯一通道。)
      let refOut = ''
      try {
        refOut = gitText(
          [
            'for-each-ref',
            'refs/tags/lost-commit',
            'refs/tags/backup',
            '--format=%(objectname)%09%(*objectname)',
          ],
          { timeout: SPAWN_DEFAULT_TIMEOUT_MS },
        )
      } catch {
        refOut = ''
      }
      const hashes = new Set(backedUp)
      for (const line of refOut.split('\n')) {
        const cols = line.trim().split('\t')
        // annotated tag: 两列都有 → 第 2 列 peeled commit;
        // lightweight: 仅第 1 列(第 2 列为空串)→ 即 commit 本身.
        // 注意:必须用 || 而非 ??——peeled 空串在轻量 tag 下是常态.
        const commitHash = cols[1] || cols[0]
        if (/^[0-9a-f]{40}$/.test(commitHash || '')) hashes.add(commitHash)
      }
      try {
        // 旧写法把 `<oid>^{tree}` 喂 `cat-file --batch-check=%(objectname)`;层没有那条批量
        // 通道,改由层的 catBatch 读 commit 内容首行的 `tree <oid>`(仍是一次批量派生)。
        for (const tree of treesForCommits([...hashes]).values()) backedTrees.add(tree)
      } catch {
        /* 批量失败时安全降级:backedTrees 为空,退回 hash/subject 判定 */
      }
    }
    // 性能:批量取 subject(同 filterStashLike 的 --no-walk 分批法),
    // 再对仍未放行者一次批量取 tree,避免逐 commit 派生.
    const unbacked = (() => {
      const candidates = unreachable.filter((c) => !backedUp.has(c))
      // ① subject 内嵌原 hash 匹配(stash-like 指向已备份 base)
      const BATCH = 50
      const subjectByHash = new Map()
      for (let i = 0; i < candidates.length; i += BATCH) {
        const batch = candidates.slice(i, i + BATCH)
        const out = gitText(['log', '--no-walk', '--format=%H%x09%s', ...batch], {
          allowFail: true,
          timeout: LOCAL_GIT_TIMEOUT_MS,
        })
        if (!out) continue
        for (const line of out.split('\n')) {
          const [hash, ...rest] = line.split('\t')
          if (hash) subjectByHash.set(hash, rest.join('\t'))
        }
      }
      const survivors = []
      for (const c of candidates) {
        const subject = subjectByHash.get(c) || ''
        const origHash = extractOriginalHashFromStash(subject)
        if (origHash && backedUp.has(origHash)) continue
        survivors.push(c)
      }
      if (survivors.length === 0) return survivors
      // ② tree 等价放行(stash WIP/index commit 树与 base 恒等)
      const treeByCommit = new Map()
      try {
        // 旧写法:把 `<oid>^{tree}` 喂 `cat-file --batch-check`(argv 直调,消除 shell 对
        // %(objectname) 的破坏)。层没有那条批量通道 ⇒ 改由层的 catBatch 读 commit 内容首行
        // 的 `tree <oid>`,按 commit oid 关联(旧写法按**位置**关联,--batch-check 保序才成立;
        // 键控版本不依赖保序,更稳)。批量失败时安全降级:无 tree 映射,退回 hash/subject 判定。
        for (const [commit, tree] of treesForCommits(survivors)) treeByCommit.set(commit, tree)
      } catch {
        /* 批量失败时安全降级:无 tree 映射,退回 hash/subject 判定 */
      }
      return survivors.filter((c) => {
        const tree = treeByCommit.get(c)
        return !(tree && backedTrees.has(tree))
      })
    })()
    if (unbacked.length > 0) {
      issues.push(
        `${unbacked.length} 个悬空 commit 未 tag 备份(运行 git tag lost-commit/<name> <hash> 备份)`,
      )
      // 2026-09-04 修复:打印具体未备份 hash(原仅报数量,无法定位处置;
      // 并行 agent 高频 fsck 会持续产生新悬空对象,需可见才能针对性 tag 备份)
      for (const c of unbacked.slice(0, 10)) {
        const subj = gitText(['log', '-1', '--format=%s', c], { allowFail: true }) || ''
        console.log(
          `  ${C.yellow}   ↳ 未备份:${C.cyan}${c.slice(0, 12)}${C.reset} ${C.dim}${subj.slice(0, 80)}${C.reset}`,
        )
      }
      if (unbacked.length > 10)
        console.log(`  ${C.dim}   ↳ …另有 ${unbacked.length - 10} 个未显示${C.reset}`)
      blocking = true
    } else {
      issues.push(`${unreachable.length} 个悬空 commit 已全部 tag 备份(防止 git gc 清理)`)
    }
  }

  // 2026-07-26 升级:远程 tag 完整性加入综合判定
  // 2026-09-24 改版:仅远端缺失先由本门自己 fetch 固化(见 healMissingRemoteTags);
  //   拉回来了 → 不再出现在差异里,自然不红;
  //   拉不动(离线/无凭据/超时)→ 降为警告。理由:东西在**远端**,本地少一个引用不是 commit 丢失风险,
  //   而恒红的唯一结局是人人 --no-verify,把真正防丢的那几条(reset/悬空/不可达)一起关掉。
  // tag 对象不可达 → 仍是 blocking(那是"备份指向的对象快被 gc 吃掉",是真丢)。
  if (lostTagDiff.onlyRemote.length > 0) {
    issues.push(
      `${lostTagDiff.onlyRemote.length} 个 lost-commit tag 仅远端(本地缺失)${remoteHeal.degraded ? '—— fetch 未成功,已降级为警告' : ',需 fetch'}`,
    )
    if (!remoteHeal.degraded) blocking = true
  }
  if (backupTagDiff.onlyRemote.length > 0) {
    issues.push(
      `${backupTagDiff.onlyRemote.length} 个 backup tag 仅远端(本地缺失)${remoteHeal.degraded ? '—— fetch 未成功,已降级为警告' : ',需 fetch'}`,
    )
    if (!remoteHeal.degraded) blocking = true
  }
  if (unreachableTags.length > 0) {
    issues.push(
      `${unreachableTags.length} 个 tag 对象不可达(commit 即将被 git gc 清理,需 fetch 拉回)`,
    )
    blocking = true
  }
  if (lostTagDiff.onlyLocal.length > 0) {
    issues.push(
      `${lostTagDiff.onlyLocal.length} 个 lost-commit tag 仅本地(未 push,本地 git gc 后会丢失):${briefList(lostTagDiff.onlyLocal)}`,
    )
    // 仅本地不阻塞,只 warn
  }
  if (backupTagDiff.onlyLocal.length > 0) {
    issues.push(
      `${backupTagDiff.onlyLocal.length} 个 backup tag 仅本地(未 push):${briefList(backupTagDiff.onlyLocal)}`,
    )
    // 仅本地不阻塞,只 warn
  }

  if (issues.length === 0) {
    console.log(`  ${C.green}✅ 无 commit 丢失风险${C.reset}`)
    process.exit(0)
  }

  for (const i of issues) {
    console.log(`  ${C.yellow}⚠  ${i}${C.reset}`)
  }

  // 2026-07-25 升级:isBlocking 模式(guardian-runner 30a 注册)直接 exit 1
  if (blocking && (isStrict || isBlocking)) {
    console.log(
      `\n${C.red}${C.bold}❌ commit 丢失风险,阻塞 commit${C.reset} (请先处理:备份 / 确认 reset 安全)`,
    )
    // 2026-09-12 补:本机宿主会清理 gitdir 下 depth>=2 的嵌套 ref 目录
    // (refs/remotes/<remote>/、refs/tags/<ns>/) → 表现为"仅远端/仅本地"抖动,
    // 并非真的丢 commit。离线重建命令见下(无需联网)。
    console.log(
      `   ${C.cyan}若上表是"仅远端 tag / origin 变 [gone]"(宿主清理嵌套 ref 的典型征状):${C.reset}`,
    )
    console.log(
      `     node scripts/git-refs-heal.mjs                  # 离线重建 + 固化进 packed-refs`,
    )
    console.log(
      `     node scripts/git-refs-heal.mjs --refresh-remote # 联网从 origin 校准后再固化(需 http_proxy)`,
    )
    console.log(`     (机制说明见 AGENTS.md §5b「嵌套 ref 存续」)`)
    console.log(
      `   1. 若 reset 是有意的,先备份:${C.cyan}git tag lost-commit/<name> <hash>${C.reset}`,
    )
    console.log(
      `   2. 紧急跳过(不推荐):${C.cyan}HUSKY_SKIP_COMMIT_LOSS_CHECK=1 git commit ...${C.reset}`,
    )
    process.exit(1)
  }

  console.log(`\n${C.yellow}💡 建议:${C.reset}`)
  console.log(`   - 备份悬空 commit:${C.cyan}git tag lost-commit/<name> <hash>${C.reset}`)
  console.log(`   - 查看丢失历史:${C.cyan}git tag -l "lost-commit/*" && git show <tag>${C.reset}`)
  console.log(`   - 详细规则见 AGENTS.md §22`)
  process.exit(0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
