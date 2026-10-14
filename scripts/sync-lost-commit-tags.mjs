#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * sync-lost-commit-tags.mjs — Lost commit tag 自动同步脚本(AGENTS.md §22 配套)
 *
 * 背景(2026-07-26 立,真实事故):
 *   本地 lost-commit/* 和 backup/* tag 被 git gc 清理,但 git log 看不到这些 commit
 *   (因为已不在任何 branch ref 上),所以用户以为丢失了。
 *   实际上远端有,但本地 fetch 失败(因为 fetch 不知道要 fetch 这些 tag,
 *   默认 fetch 不包含 tag)。这暴露了一个机制缺陷:tag 备份必须主动 push + 主动 fetch。
 *
 * 2026-10-14 扩射程(旧版两个盲区,均为真实事故):
 *   盲区 A「只看两个命名空间」:旧版只认 lost-commit/* 与 backup/*,对 desktop-v* / nightly-* /
 *     assistant-v* / 发布类 tag 的本地/远端分歧完全失明。
 *   盲区 B「只比名字不比 SHA」:旧版 diffTagSets 纯名字集合比较 ⇒ 同名不同 SHA(发布类 tag 的
 *     本地新链 vs origin 旧链,实测 7443 枚)完全看不见,而那正是最危险的分歧形态。
 *   本版:一次 ls-remote 取全量 tag 名字+SHA,与本地 for-each-ref 全量比对;覆盖**全部命名空间**。
 *
 * 脚本职责(3 件事):
 *   1. 自动 push: commit 后把本地**未上 origin**的 tag 推到 origin,防止 gc 后无远端备份
 *   2. 手动 fetch: 一键从 origin 拉回全部 tag(以 origin 为权威校准本地),修复本地 tag 缺失/分歧
 *   3. 手动 check: 校验**全部命名空间**本地 + origin tag 一致性(名字 + SHA)+ tag 对象可达性
 *
 * 为什么需要(2026-07-26 事故复盘):
 *   - tag 是 commit 的"指向引用",git gc 默认 14 天清理无引用对象
 *   - 丢失 commit 唯一可访问方式 = tag → tag 必须 push 到远端 + 本地 fetch 必须知道要 fetch
 *   - 机制:fatal: refusing to fetch into current branch refs/tags/* 报错是 fetch 语法问题
 *     → 用 refspec `refs/tags/lost-commit/*:refs/tags/lost-commit/*` 显式映射
 *
 * CLI 模式(必须全部支持):
 *   --check       仅校验,不动 git 状态。比对**全部命名空间**本地 vs origin 的 tag 名字 + SHA,
 *                 并检查备份 tag 对象可达性。失败 exit 1,成功 exit 0。这是默认模式(无参数时)
 *   --fetch       从 origin 拉回全部 tag(以 origin 为权威校准本地)
 *   --auto-push   把本地**未上 origin**的 tag 推到 origin(用 --atomic 防止半失败)
 *   --dry-run     配合 --auto-push 用,只打印将要 push 的 tag 不实际 push
 *   --force       强制 push(覆盖远端),默认不允许
 *   --json        配合 --check 用,输出 JSON 格式结果(给 CI/上层调用方)
 *   --help        打印帮助并 exit 0
 *
 * 退出码:
 *   0 — 成功(全部命名空间 tag 本地+origin 名字与 SHA 一致 + 备份 tag 对象可达)
 *       含一种**如实上报的跳过**:未配置 origin **且**本地零枚 tag;
 *       "有 tag 却没有 origin" 不算跳过(那正是远端备份缺失的故障形态)
 *       含一种**告警但不失败**:非备份命名空间(如 nightly-* / desktop-v*)的 tag 仅远端 ——
 *       那只是"本地落后 origin",不构成备份缺口,故只报不判红(避免 CI 持续造 tag 导致恒红)
 *   1 — 失败(仅本地未推 / 同名 SHA 分歧 / 备份命名空间仅远端 / 备份 tag 对象不可达)
 *   2 — 异常(脚本执行错误,例如 git 命令找不到;或配了 origin 却取不到远端真值
 *       ⇒ 拒绝带着假结论继续)
 *
 * 豁免:
 *   HUSKY_SKIP_TAG_SYNC=1 — 跳过 --auto-push 模式(给 post-commit 钩子用,紧急场景)
 *
 * 用法:
 *   node scripts/sync-lost-commit-tags.mjs              # 默认 check
 *   node scripts/sync-lost-commit-tags.mjs --check      # 校验
 *   node scripts/sync-lost-commit-tags.mjs --check --json
 *   node scripts/sync-lost-commit-tags.mjs --fetch      # 拉回
 *   node scripts/sync-lost-commit-tags.mjs --auto-push  # 推送
 *   node scripts/sync-lost-commit-tags.mjs --auto-push --dry-run
 *   HUSKY_SKIP_TAG_SYNC=1 git commit ...                # 紧急跳过
 *
 * 调用方:
 *   - .husky/post-commit 第 5 段(commit 后自动 push tag)
 *   - 手动验证: git gc 后跑 --fetch 拉回 + --check 确认一致
 *   - 定时任务: 每周一检查 tag 完整性(见 docs/lost-commit-archive.md 防护机制)
 */
import { execSync, execFileSync } from 'node:child_process'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const SKIP_ENV = 'HUSKY_SKIP_TAG_SYNC'
const skip = process.env[SKIP_ENV] === '1'
const args = new Set(process.argv.slice(2))
// 未知参数必须响:旧实现是 `isCheck = !has('--fetch') && !has('--auto-push')`,
// 于是任何拼错/缩写的开关(例如按文档"tag:sync:push"直觉写的 --push)都会**静默落到默认 --check**,
// 打印一句校验抬头就退出 0 —— 调用者读到的是"跑完了",实际一个 tag 都没推。
// 2026-09-25 实测踩中过一次(backup/wip-* 存档 tag 靠 --push 没上远端,显式 push 才落地)。
const KNOWN_FLAGS = new Set([
  '--help',
  '-h',
  '--check',
  '--fetch',
  '--auto-push',
  '--push',
  '--dry-run',
  '--force',
  '--json',
])
const unknownFlags = [...args].filter((a) => !KNOWN_FLAGS.has(a))
if (unknownFlags.length > 0) {
  console.error(
    `❌ 未知参数:${unknownFlags.join(' ')}\n` +
      `   本脚本只认 --check / --fetch / --auto-push(推送)/ --dry-run / --force / --json。\n` +
      `   不接受缩写或同义词,是为了让拼错**当场失败**,而不是掉进默认分支假装执行。`,
  )
  process.exit(2)
}
const isHelp = args.has('--help') || args.has('-h')
const isFetch = args.has('--fetch')
// --push 是 --auto-push 的显式别名(文档里既写 `tag:sync:push` 又写 `--auto-push`,两种叫法都得能用)
const isAutoPush = args.has('--auto-push') || args.has('--push')
const isCheck = args.has('--check') || (!isFetch && !isAutoPush)
const isDryRun = args.has('--dry-run')
const isForce = args.has('--force')
const isJson = args.has('--json')
// 2026-09-17 根治:--auto-push 只推"远端缺失"的 tag(增量),不再每次全量推 5000 个。
//   旧行为: 每次 commit 后同步 `git push --atomic`(全部 tag) → 10+ 分钟阻塞 post-commit,
//   表现 = "推送早已完成但终端一直挂着等"。新行为: ls-remote 比对 → 只推缺失项(通常 0~3 个),
//   0 缺失时秒级退出;并加限流标记 + 超时,任何情况都不得长时间阻塞。
const PUSH_CHUNK_SIZE = Number(process.env.IHUI_TAG_PUSH_CHUNK || 20)
const PUSH_TIMEOUT_MS = Number(process.env.IHUI_TAG_PUSH_TIMEOUT_MS || 300_000)
// 2026-09-17 实测: 单个 tag 推送需连带上传其历史对象, 20 个 tag ≈ 10 分钟(网络瓶颈)。
// 因此 auto 模式(钩子内调用)设积压上限: 超过则只记录不推, 交人工/后台慢速收敛,
// 保证 commit 路径永远不受 tag 同步拖累。
const AUTO_PUSH_MAX_BACKLOG = Number(process.env.IHUI_TAG_AUTO_MAX || 50)
// 限流:同一间隔内(默认 60s)重复调用直接跳过,避免连续 commit 反复 ls-remote
const THROTTLE_MS = Number(process.env.IHUI_TAG_SYNC_THROTTLE_MS || 60_000)

// 备份命名空间(§22 管辖对象):这两个命名空间的"仅远端"意味着本地备份 tag 丢失 ⇒ 判失败;
// 其余命名空间(desktop-v*/nightly-*/assistant-v*/发布类…)的"仅远端"只是本地落后 origin,只告警。
const BACKUP_NAMESPACES = ['lost-commit/', 'backup/']
function isBackupNamespace(tag) {
  return BACKUP_NAMESPACES.some((p) => tag.startsWith(p))
}

// 逐条清单的打印上限。本仓受管备份 tag 已 6981 枚,逐条打印会把 `--check` 刷成两万行,
// 结果是没人看这段输出 ⇒ 判据失效方向变成"安静"(AGENTS §12f)。汇总数字在第 5 节全量给出,
// 这里只保证"小夹具逐条可见"(回归测试断言的正是小夹具里的 tag 名)。
const LIST_CAP = Number(process.env.IHUI_TAG_LIST_CAP || 20)

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // 返回值被消费(.trim() 后 return)⇒ stdout 仍须 pipe,只把 stdin 切掉
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      ...opts,
    }).trim()
  } catch (e) {
    if (opts.allowFail) return ''
    throw e
  }
}

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

function printHelp() {
  console.log(
    `${C.cyan}${C.bold}sync-lost-commit-tags.mjs${C.reset} — Lost commit tag 同步(AGENTS.md §22)`,
  )
  console.log('')
  console.log('用法:')
  console.log('  node scripts/sync-lost-commit-tags.mjs [mode] [flags]')
  console.log('')
  console.log('模式:')
  console.log('  --check       校验**全命名空间** tag 本地+远端一致性(名字 + SHA)(默认)')
  console.log('  --fetch       从 origin 拉回全部 tag(以 origin 为权威校准本地)')
  console.log('  --auto-push   把本地未上 origin 的 tag 推到 origin(post-commit 钩子调用)')
  console.log('')
  console.log('标志:')
  console.log('  --dry-run     配合 --auto-push 用,只打印不实际 push')
  console.log('  --force       强制 push(覆盖远端),默认不允许')
  console.log('  --json        配合 --check 用,输出 JSON 格式')
  console.log('  --help        打印本帮助')
  console.log('')
  console.log('环境变量:')
  console.log(`  ${SKIP_ENV}=1            跳过 --auto-push 模式(紧急场景)`)
  console.log('  IHUI_TAG_LIST_CAP=N      逐条清单与判定行的名字上限(默认 20;计数与 JSON 恒为全量)')
  console.log('  IHUI_TAG_AUTO_MAX=N      --auto-push 待推积压上限(默认 50,超限只记录不推)')
  console.log('  IHUI_TAG_PUSH_CHUNK=N    --auto-push 分块大小(默认 20)')
  console.log('  IHUI_TAG_ONLY=a,b        --auto-push 精确投递清单(空壳 tag 连累整块时用)')
  console.log('  IHUI_TAG_REMOTE=<远端名>  测试接缝:指定被读的远端(默认 origin)')
  console.log('')
  console.log('退出码:')
  console.log('  0  成功')
  console.log('  1  失败(不一致/不可达)')
  console.log('  2  异常(git 命令找不到等)')
}

/**
 * 本地**全部** tag → 解析后的 commit sha(annotated 取 peel 后的 commit;lightweight 取指向对象)。
 * 一次 for-each-ref 取全(7468 枚也只需一个进程;逐枚 rev-parse 会慢到不可用)。
 * 用 `%09`(制表符)分隔,避免 tag 名里可能含空格导致串列错位。
 */
function listLocalTagMap() {
  const map = new Map()
  try {
    const out = execFileSync(
      'git',
      ['for-each-ref', '--format=%(refname:short)%09%(objectname)%09%(*objectname)', 'refs/tags'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
      },
    )
    for (const line of out.split('\n')) {
      if (!line) continue
      const [name, obj, peeled] = line.split('\t')
      if (!name) continue
      map.set(name, peeled || obj)
    }
  } catch {
    /* 无 tag / 非 git 仓 ⇒ 空表(与"干净仓库如实跳过"的语义一致) */
  }
  return map
}

/** origin 是否**配置了**(不是"配了但连不上"):无该 remote 时 get-url 非零退出 ⇒ ''。 */
function hasOriginRemote() {
  return run('git remote get-url origin', { allowFail: true }).length > 0
}

/**
 * 「没配 origin」与「配了却读不到真值」是两件事,不能共用一个 exit 2(2026-09-24 修)。
 * 原实现把两者混在一起 ⇒ 一个刚 `git init`、一枚 tag 都没有的干净仓库(各道门的镜像测试
 * 就是在这种仓库里跑的)也被判成脚本异常 exit 2,而这工具自己的用例写的是 exit 0。
 *
 * 但**不许反过来放水**:只要本地还有**任何** tag,没有 origin 就等于"远端备份这条线压根不存在",
 * 那是真故障 —— 照旧交回 requireRemoteTagMap 走 fail-loud,因为上面那段注释记着的事故
 * (失败被吞成空集 ⇒ 全判"待推" ⇒ 撞阈值后整条静默失效)正是"把没有真值当成没有风险"造成的。
 * 只有"无 origin ∧ 本地零枚 tag"才允许如实跳过。
 *
 * @param {Map<string,string>} localMap 本地全量 tag 表(名字 → peeled commit sha)
 * @returns {boolean} true 表示已按跳过处理(调用方应立即返回)
 */
function skipIfNoOriginAndNoTags(localMap) {
  if (hasOriginRemote()) return false
  if (localMap.size > 0) return false
  const reason =
    '未配置 origin remote,且本地无任何 tag 待备份 ⇒ 没有远端可比,也没有任何东西处于未备份状态'
  if (isJson) {
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          skipped: reason,
          local: { lostCommit: [], backup: [] },
          remote: null,
          diff: null,
          reachability: [],
          allTags: {
            localCount: 0,
            remoteCount: null,
            onlyLocal: [],
            onlyRemote: [],
            shaMismatch: [],
          },
          summary: { total: 0, reachable: 0, unreachable: 0 },
        },
        null,
        2,
      ),
    )
    process.exit(0)
  }
  console.log(`${C.yellow}⏭  ${reason} ⇒ 跳过远端一致性判定${C.reset}`)
  console.log(header('完整性判定'))
  console.log(`  ${C.green}✅ 无可比对象(如实跳过,不等于"已核验一致")${C.reset}`)
  process.exit(0)
  return true
}

/**
 * 一次 ls-remote 取**全部** tag 的「名字 → peel 后 commit sha」真值。
 * - annotated tag 在 ls-remote 里输出两行(`refs/tags/x` 与 `refs/tags/x^{}`),后者才是 peel 后的
 *   commit ⇒ 以 `^{}` 行为准,才能与本地 for-each-ref 的 `%(*objectname)` 同口径比 SHA。
 * - pattern 为 null 时取全量;失败返回 null(调用方据此 fail-closed)。
 */
function lsRemoteTagMap(pattern = null) {
  // IHUI_TAG_REMOTE 是**测试接缝**:注入一个不存在的远端名即可验证"取不到远端真值"这条
  // fail-closed 分支(实测用 GIT_CONFIG_* 覆盖 remote.origin.url 不生效,故留这个开关)。
  const remote = process.env.IHUI_TAG_REMOTE || 'origin'
  const argv = ['-c', 'safe.directory=*', 'ls-remote', '--tags', remote]
  if (pattern) argv.push(pattern)
  try {
    const out = execFileSync('git', argv, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 64 * 1024 * 1024,
    })
    const map = new Map()
    for (const line of out.split('\n')) {
      if (!line) continue
      const [sha, ref] = line.split('\t')
      if (!ref) continue
      const raw = ref.replace(/^refs\/tags\//, '')
      if (raw.endsWith('^{}')) map.set(raw.slice(0, -3), sha) // peel 行优先(覆盖先到的浅行)
      else if (!map.has(raw)) map.set(raw, sha)
    }
    return map
  } catch (e) {
    console.error(
      `${C.red}❌ git ls-remote ${pattern ?? '<全部 tag>'} 失败,拿不到远端 tag 真值:${e?.message ?? e}${C.reset}`,
    )
    return null
  }
}

/**
 * 取远端全量 tag 真值,**取不到就拒绝继续**(exit 2)。
 * 为什么必须拒绝:此前失败会被 `allowFail` 吞成空串 ⇒ 空集被当成"远端一个 tag 都没有"
 * ⇒ 4283 枚本地 tag 全判成"待推",再撞上积压阈值就"跳过不推" —— 远端备份这条防线
 * 静默失效(实测同一段代码 --dry-run 报 10、真跑报 4253 两个互相矛盾的结论)。
 * 判"缺失"必须有真值;拿不到真值时宁可 exit 2 让人来看,绝不带着假结论往下走。
 */
function requireRemoteTagMap(label) {
  const map = lsRemoteTagMap()
  if (map === null) {
    console.error(
      `${C.red}❌ [${label}] 远端 tag 真值不可得 ⇒ 不做任何增量判定/推送(宁可停,绝不把全部本地 tag 判成"缺失")${C.reset}`,
    )
    process.exit(2)
  }
  return map
}

function diffTagSets(local, remote) {
  const localSet = new Set(local)
  const remoteSet = new Set(remote)
  const onlyLocal = local.filter((t) => !remoteSet.has(t))
  const onlyRemote = remote.filter((t) => !localSet.has(t))
  const both = local.filter((t) => remoteSet.has(t))
  return { onlyLocal, onlyRemote, both }
}

/**
 * 全命名空间 tag 比对(**名字 + SHA**)。
 * 这是旧版盲区 B 的解药:旧 diffTagSets 只比名字,同名不同 SHA(发布类 tag 的本地新链 vs
 * origin 旧链)完全看不见。这里同时给出名字差异与 SHA 分歧,并把"仅远端"按命名空间分流:
 *  - onlyRemoteBackup  备份命名空间(lost-commit/backup)的仅远端 ⇒ 本地备份缺失,判失败
 *  - onlyRemoteOther   其余命名空间(desktop-v* / nightly-* / assistant-v*…)的仅远端 ⇒ 本地落后
 *                      origin,只告警(避免 CI 持续造 tag 导致守门恒红)
 */
function diffTagMaps(localMap, remoteMap) {
  const onlyLocal = []
  const shaMismatch = []
  for (const [name, sha] of localMap) {
    if (!remoteMap.has(name)) onlyLocal.push(name)
    else if (remoteMap.get(name) !== sha)
      shaMismatch.push({ tag: name, local: sha, remote: remoteMap.get(name) })
  }
  const onlyRemote = []
  for (const name of remoteMap.keys()) {
    if (!localMap.has(name)) onlyRemote.push(name)
  }
  onlyLocal.sort()
  onlyRemote.sort()
  shaMismatch.sort((a, b) => a.tag.localeCompare(b.tag))
  const onlyRemoteBackup = onlyRemote.filter(isBackupNamespace)
  const onlyRemoteOther = onlyRemote.filter((t) => !isBackupNamespace(t))
  return { onlyLocal, onlyRemote, shaMismatch, onlyRemoteBackup, onlyRemoteOther }
}

/**
 * 备份 tag 的对象可达性 —— **单次** `git cat-file --batch-check` 判全部。
 *
 * 为什么不逐枚 `rev-parse` + `cat-file -e`(旧写法):每枚 tag 起两个进程,本仓受管备份 tag
 * 已 6981 枚 ⇒ 约 1.4 万次 spawn,`--check` 因此被拖成后台任务(实测记录
 * `.ihui-agent/archive/worktree-lag-orphans-2026-10-02.md` 第 851 行)。判据跑不动 = 判据不存在
 * (AGENTS.md §0.9),射程扩到全命名空间后更不可能让每次复跑刷两万行。
 *
 * 顺带修掉旧写法的一处**失效方向**:git 压根没跑起来时被 `allowFail` 吞成空串,而空串在旧判据里
 * 等于"可达"⇒ 记绿。现在进程失败 ⇒ 全体判不可达并点名原因(宁可响,绝不假绿,§0.3)。
 *
 * sha 直接取 `listLocalTagMap()` 已 peel 过的目标(annotated ⇒ commit,lightweight ⇒ 指向对象),
 * 与旧 `getTagCommitHash` 同口径,但不再为每枚 tag 单独起进程。
 *
 * @param {string[]} tagNames 待判 tag 名(受管备份命名空间)
 * @param {Map<string,string>} localMap 本地全量 tag 表(名字 → peel 后 sha)
 * @returns {Array<{tag:string,ok:boolean,hash:string,reason:string}>}
 */
function reachabilityBatch(tagNames, localMap) {
  const items = tagNames.map((tag) => ({ tag, hash: localMap.get(tag) || '' }))
  const shas = [...new Set(items.map((i) => i.hash).filter(Boolean))]
  // null = "这一轮没判成"(进程失败或没跑),与 Set(判成了,里面是缺的对象)严格区分
  let missing = null
  if (shas.length > 0) {
    try {
      const out = execFileSync('git', ['cat-file', '--batch-check'], {
        encoding: 'utf8',
        // §12g:带 input 的派生必须连 stdin 一起交出来(['ignore',...] 会当场 EBUSY)
        input: `${shas.join('\n')}\n`,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 64 * 1024 * 1024,
      })
      // 每个输入回一行:"<oid> <type> <size>" 或 "<oid> missing"
      missing = new Set(
        out
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.endsWith(' missing'))
          .map((l) => l.split(' ')[0]),
      )
    } catch (e) {
      console.error(
        `${C.red}❌ 可达性判据跑不动(git cat-file --batch-check 失败):${e?.message ?? e} ⇒ 全体判不可达(取不到输入就不记绿)${C.reset}`,
      )
      missing = null
    }
  }
  return items.map(({ tag, hash }) => {
    if (!hash) return { tag, ok: false, hash: '', reason: 'tag 解析失败' }
    if (missing === null) return { tag, ok: false, hash, reason: '可达性判定未执行' }
    if (missing.has(hash)) return { tag, ok: false, hash, reason: '对象不可达' }
    return { tag, ok: true, hash, reason: '' }
  })
}

/**
 * 判定行的名字清单有界输出:**计数恒为全量**,只截名字。
 * 为什么必须统一:同一屏里"同名 SHA 分歧"那一行本来只给 20 个,而"仅本地/仅远端/不可达"
 * 三行不截 ⇒ 积压一上来就是单行几 KB;而"刷屏 ⇒ 没人读"正是 AGENTS §12f 点名的失效方向。
 * JSON 数组(`allTags.*` / `reachability`)不受本函数影响,机器读者永远拿全量。
 */
function nameList(items, cap = LIST_CAP) {
  if (items.length <= cap) return items.join(', ')
  return `${items.slice(0, cap).join(', ')} …(+${items.length - cap})`
}

function checkMode() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 tag 同步(不推荐)${C.reset}`)
  }

  if (!isJson) {
    console.log(`${C.cyan}${C.bold}🏷️  tag 一致性校验(全命名空间,AGENTS.md §22 配套)${C.reset}`)
  }

  const localMap = listLocalTagMap()
  // 无 origin ∧ 本地零枚 ⇒ 如实跳过(与"配了 origin 却读不到真值"分开处理,见 skipIfNoOriginAndNoTags)
  skipIfNoOriginAndNoTags(localMap)

  // 受管备份命名空间的本地视图(JSON 契约沿用旧字段名 lostCommit/backup)
  const localLost = [...localMap.keys()].filter((t) => t.startsWith('lost-commit/')).sort()
  const localBackup = [...localMap.keys()].filter((t) => t.startsWith('backup/')).sort()

  const remoteMap = requireRemoteTagMap('check')
  const remoteLost = [...remoteMap.keys()].filter((t) => t.startsWith('lost-commit/')).sort()
  const remoteBackup = [...remoteMap.keys()].filter((t) => t.startsWith('backup/')).sort()

  const lostDiff = diffTagSets(localLost, remoteLost)
  const backupDiff = diffTagSets(localBackup, remoteBackup)

  // 全命名空间比对(名字 + SHA):旧版盲区 A/B 的解药
  const fullDiff = diffTagMaps(localMap, remoteMap)

  // 可达性检查(仅受管备份命名空间,保持旧契约范围)
  const allLocalTags = [...localLost, ...localBackup]
  const reachability = reachabilityBatch(allLocalTags, localMap)
  const unreachable = reachability.filter((r) => !r.ok)
  // 打印段一律复用这一份结果 —— 旧写法在打印循环里又逐枚重算,把 spawn 量翻了三倍
  const reachByTag = new Map(reachability.map((r) => [r.tag, r]))

  // ── 双轨判定:issues 判失败(exit 1),warnings 仅告警(exit 0)──
  const issues = []
  const warnings = []
  if (fullDiff.onlyLocal.length > 0)
    issues.push(`${fullDiff.onlyLocal.length} 个 tag 仅本地(未 push):${nameList(fullDiff.onlyLocal)}`)
  if (fullDiff.shaMismatch.length > 0)
    issues.push(
      `${fullDiff.shaMismatch.length} 个 tag 同名但 SHA 分歧(本地新链 vs origin 旧链):${nameList(
        fullDiff.shaMismatch.map((m) => m.tag),
      )}`,
    )
  if (fullDiff.onlyRemoteBackup.length > 0)
    issues.push(
      `${fullDiff.onlyRemoteBackup.length} 个备份命名空间 tag 仅远端(本地备份缺失):${nameList(
        fullDiff.onlyRemoteBackup,
      )}`,
    )
  if (unreachable.length > 0)
    issues.push(
      `${unreachable.length} 个备份 tag 对象不可达:${nameList(unreachable.map((r) => r.tag))}`,
    )
  if (fullDiff.onlyRemoteOther.length > 0)
    warnings.push(
      `${fullDiff.onlyRemoteOther.length} 个非备份命名空间 tag 仅远端(本地落后 origin,仅告警):${nameList(fullDiff.onlyRemoteOther)}`,
    )

  const hasIssue = issues.length > 0

  if (isJson) {
    const result = {
      status: hasIssue ? 'fail' : 'ok',
      local: { lostCommit: localLost, backup: localBackup },
      remote: { lostCommit: remoteLost, backup: remoteBackup },
      diff: { lostCommit: lostDiff, backup: backupDiff },
      reachability,
      allTags: {
        localCount: localMap.size,
        remoteCount: remoteMap.size,
        onlyLocal: fullDiff.onlyLocal,
        onlyRemote: fullDiff.onlyRemote,
        shaMismatch: fullDiff.shaMismatch,
        onlyRemoteBackup: fullDiff.onlyRemoteBackup,
        onlyRemoteOther: fullDiff.onlyRemoteOther,
      },
      warnings,
      summary: {
        total: allLocalTags.length,
        reachable: reachability.filter((r) => r.ok).length,
        unreachable: unreachable.length,
      },
    }
    console.log(JSON.stringify(result, null, 2))
    process.exit(hasIssue ? 1 : 0)
  }

  // ── 1. 本地 lost-commit tag ──
  console.log(header('1. 本地 lost-commit/* tag'))
  if (localLost.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    for (const tag of localLost.slice(0, LIST_CAP)) {
      const r = reachByTag.get(tag)
      const icon = r.ok ? C.green + '✅' : C.red + '❌'
      console.log(
        `  ${icon} ${C.cyan}${tag}${C.reset} → ${C.dim}${r.hash.slice(0, 12) || '?'}${C.reset}${r.ok ? '' : `  (${r.reason})`}${C.reset}`,
      )
    }
    if (localLost.length > LIST_CAP) {
      console.log(`  ${C.dim}…另有 ${localLost.length - LIST_CAP} 枚(全量比对见第 5 节)${C.reset}`)
    }
  }

  // ── 2. 本地 backup tag ──
  console.log(header('2. 本地 backup/* tag'))
  if (localBackup.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    for (const tag of localBackup.slice(0, LIST_CAP)) {
      const r = reachByTag.get(tag)
      const icon = r.ok ? C.green + '✅' : C.red + '❌'
      console.log(
        `  ${icon} ${C.cyan}${tag}${C.reset} → ${C.dim}${r.hash.slice(0, 12) || '?'}${C.reset}${r.ok ? '' : `  (${r.reason})`}${C.reset}`,
      )
    }
    if (localBackup.length > LIST_CAP) {
      console.log(
        `  ${C.dim}…另有 ${localBackup.length - LIST_CAP} 枚(全量比对见第 5 节)${C.reset}`,
      )
    }
  }

  // ── 3. 远端 lost-commit tag ──
  console.log(header('3. 远端 lost-commit/* tag(origin)'))
  if (remoteLost.length === 0) {
    console.log(`  ${C.yellow}⚠️  远端无 lost-commit tag(本地 tag 未 push 风险)${C.reset}`)
  } else {
    const localLostSet = new Set(localLost)
    for (const tag of remoteLost.slice(0, LIST_CAP)) {
      const localMark = localLostSet.has(tag)
        ? C.green + '✓本地'
        : C.yellow + '⚠ 仅远端(本地缺失)'
      console.log(`  ${C.cyan}${tag}${C.reset}  ${localMark}${C.reset}`)
    }
    if (remoteLost.length > LIST_CAP) {
      console.log(
        `  ${C.dim}…另有 ${remoteLost.length - LIST_CAP} 枚(仅远端计数见第 5 节)${C.reset}`,
      )
    }
  }

  // ── 4. 远端 backup tag ──
  console.log(header('4. 远端 backup/* tag(origin)'))
  if (remoteBackup.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    const localBackupSet = new Set(localBackup)
    for (const tag of remoteBackup.slice(0, LIST_CAP)) {
      const localMark = localBackupSet.has(tag)
        ? C.green + '✓本地'
        : C.yellow + '⚠ 仅远端(本地缺失)'
      console.log(`  ${C.cyan}${tag}${C.reset}  ${localMark}${C.reset}`)
    }
    if (remoteBackup.length > LIST_CAP) {
      console.log(
        `  ${C.dim}…另有 ${remoteBackup.length - LIST_CAP} 枚(仅远端计数见第 5 节)${C.reset}`,
      )
    }
  }

  // ── 5. 全命名空间比对(名字 + SHA)──
  console.log(header('5. 全命名空间比对(本地 vs origin,名字 + SHA)'))
  console.log(
    `  ${C.dim}本地 ${localMap.size} 枚 | origin ${remoteMap.size} 枚 | 仅本地 ${fullDiff.onlyLocal.length} | 仅远端 ${fullDiff.onlyRemote.length} | SHA 分歧 ${fullDiff.shaMismatch.length}${C.reset}`,
  )
  if (fullDiff.onlyLocal.length > 0) {
    console.log(
      `  ${C.yellow}⚠ 仅本地(未 push):${C.reset} ${nameList(fullDiff.onlyLocal)}`,
    )
  }
  if (fullDiff.shaMismatch.length > 0) {
    console.log(
      `  ${C.red}❌ 同名 SHA 分歧:${C.reset} ${nameList(fullDiff.shaMismatch.map((m) => m.tag))}`,
    )
  }
  if (fullDiff.onlyRemoteBackup.length > 0) {
    console.log(
      `  ${C.red}❌ 备份命名空间仅远端(本地缺失):${C.reset} ${nameList(fullDiff.onlyRemoteBackup)}`,
    )
  }
  if (fullDiff.onlyRemoteOther.length > 0) {
    console.log(
      `  ${C.yellow}⚠ 非备份命名空间仅远端(本地落后,仅告警):${C.reset} ${nameList(fullDiff.onlyRemoteOther)}`,
    )
  }

  // ── 6. 完整性判定 ──
  console.log(header('6. 完整性判定'))
  if (!hasIssue) {
    console.log(
      `  ${C.green}✅ 全部命名空间 tag 本地+origin 名字与 SHA 一致,备份 tag 对象全部可达${C.reset}`,
    )
    console.log(
      `  ${C.dim}  本地: ${localMap.size} 枚 | origin: ${remoteMap.size} 枚 | 受管备份 tag 可达: ${reachability.filter((r) => r.ok).length}/${reachability.length}${C.reset}`,
    )
    for (const w of warnings) console.log(`  ${C.yellow}⚠  ${w}${C.reset}`)
    process.exit(0)
  }

  for (const i of issues) {
    console.log(`  ${C.red}✗  ${i}${C.reset}`)
  }
  for (const w of warnings) {
    console.log(`  ${C.yellow}⚠  ${w}${C.reset}`)
  }
  console.log(`\n${C.red}${C.bold}❌ tag 一致性校验失败${C.reset}`)
  console.log(`  修复方法:${C.cyan}node scripts/sync-lost-commit-tags.mjs --fetch${C.reset}`)
  process.exit(1)
}

function fetchMode() {
  if (skip) {
    console.log(
      `${C.yellow}⚠ ${SKIP_ENV}=1 — 但 --fetch 模式不受 SKIP 影响(手动恢复必须执行)${C.reset}`,
    )
  }
  console.log(`${C.cyan}${C.bold}📥 从 origin 拉回全部 tag(以 origin 为权威校准本地)${C.reset}`)

  const cmd = 'git fetch origin "+refs/tags/*:refs/tags/*"'
  console.log(`  ${C.dim}$ ${cmd}${C.reset}`)
  try {
    const stdout = run(cmd)
    if (stdout) console.log(stdout)
    console.log(`\n${C.green}✅ fetch 完成,正在校验一致性...${C.reset}`)
    // fetch 后自动 check
    if (isCheck) args.delete('--check') // 防止递归
    checkMode()
  } catch (e) {
    console.error(`${C.red}❌ fetch 失败:${C.reset}`, e?.message ?? e)
    process.exit(1)
  }
}

function autoPushMode() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 auto-push(不推荐)${C.reset}`)
    process.exit(0)
  }

  // ── 限流:间隔内重复调用直接跳过(避免连续 commit 反复 ls-remote)──
  // 注意: linked worktree 下 .git 是文件,须经 git rev-parse --git-dir 解析真实目录
  const gitDir = run('git rev-parse --git-dir', { allowFail: true }) || '.git'
  const marker = `${gitDir}/ihui-last-tag-sync`
  const now = Date.now()
  if (!isForce) {
    try {
      const last = Number(run(`cat ${marker}`, { allowFail: true }) || 0)
      if (last && now - last < THROTTLE_MS) {
        console.log(
          `${C.dim}🏷️  tag 同步限流中(距上次 ${Math.round((now - last) / 1000)}s < ${Math.round(THROTTLE_MS / 1000)}s),跳过${C.reset}`,
        )
        process.exit(0)
      }
    } catch {
      /* 标记缺失/损坏 → 继续执行 */
    }
  }

  const localMap = listLocalTagMap()
  const allLocal = [...localMap.keys()].sort()

  if (allLocal.length === 0) {
    console.log(`${C.dim}🏷️  本地无任何 tag,跳过 push${C.reset}`)
    process.exit(0)
  }

  // ── 增量:只推远端缺失的 tag(2026-09-17 根治全量推 10+ 分钟阻塞)──
  // 远端真值取不到 ⇒ 直接 exit 2:**绝不**把"拿不到清单"当成"远端什么都没有",
  // 那会让 4283 枚本地 tag 全判成待推、再撞积压阈值静默跳过(远端备份形同虚设)。
  const remoteAll = new Set(requireRemoteTagMap('auto-push').keys())
  let missing = allLocal.filter((t) => !remoteAll.has(t))
  // 2026-09-24 加 IHUI_TAG_ONLY:剩余缺失项里大多数是**空壳 tag**(对象已不在本机),
  // 逐枚推 = 每枚都要跑一遍推送门再被远端拒收(实测 109 枚要约 3 小时),而可推的只有个位数。
  // 允许调用方给一份精确清单(逗号分隔的短名),只推这些 —— 前提是清单由完整性判据产出:
  //   git rev-list --objects <commit> 退出码为 0 且 stderr 无 "fatal: missing"。
  const only = (process.env.IHUI_TAG_ONLY || '')
    .split(',')
    .map((s) => s.trim().replace(/^refs\/tags\//, ''))
    .filter(Boolean)
  if (only.length) {
    const set = new Set(missing)
    const notMissing = only.filter((t) => !set.has(t))
    if (notMissing.length)
      console.log(
        `${C.yellow}⚠️  IHUI_TAG_ONLY 里 ${notMissing.length} 个不在"仅本地"集合(已远端或不存在),忽略:${C.reset} ${notMissing.slice(0, 3).join(', ')}`,
      )
    missing = missing.filter((t) => only.includes(t))
    console.log(`${C.cyan}按 IHUI_TAG_ONLY 精确投递:${missing.length} 个${C.reset}`)
  }

  if (missing.length === 0) {
    run(`printf %s ${now} > ${marker}`, { allowFail: true })
    console.log(
      `${C.green}✅ 全部 ${allLocal.length} 个 tag 远端已存在,无需 push(增量同步,秒级完成)${C.reset}`,
    )
    process.exit(0)
  }

  console.log(
    `${C.cyan}${C.bold}📤 增量推送 ${missing.length}/${allLocal.length} 个 tag 到 origin${isDryRun ? ' (dry-run)' : ''}${C.reset}`,
  )

  // ── 积压闸门(2026-09-17):超阈值只记录不推 ──
  // 实测单 tag 推送需连带上传历史对象(20 个 ≈ 10 分钟),大积压推送在网络上不可行,
  // 且会拖死 commit 路径。auto 模式直接跳过并留待办;人工补推用 --force 绕过此闸门。
  if (!isForce && missing.length > AUTO_PUSH_MAX_BACKLOG) {
    console.log(
      `${C.yellow}⚠️  待推积压 ${missing.length} 个 > 阈值 ${AUTO_PUSH_MAX_BACKLOG}(单 tag 推送需上传历史对象, 速度约 30s/个)${C.reset}`,
    )
    console.log(`${C.dim}   已跳过(不阻塞 commit)。需要远端备份时后台慢速补推:${C.reset}`)
    console.log(
      `${C.dim}   IHUI_TAG_PUSH_CHUNK=20 node scripts/sync-lost-commit-tags.mjs --auto-push --force${C.reset}`,
    )
    console.log(
      `${C.dim}   注: 本地 tag 已足以防 git gc 修剪(标签即引用, gc 不会删可达对象); 远端备份仅防本机丢失。${C.reset}`,
    )
    // 写限流标记: 积压未变时后续 commit 直接跳过 ls-remote(再省 10s+)
    run(`printf %s ${Date.now()} > ${marker}`, { allowFail: true })
    process.exit(0)
  }
  if (missing.length <= 20) {
    for (const tag of missing) console.log(`     ${C.cyan}${tag}${C.reset}`)
  } else {
    for (const tag of missing.slice(0, 10)) console.log(`     ${C.cyan}${tag}${C.reset}`)
    console.log(`     ${C.dim}…另有 ${missing.length - 10} 个${C.reset}`)
  }

  if (isDryRun) {
    console.log(`
${C.green}✅ dry-run 完成(未实际 push)${C.reset}`)
    process.exit(0)
  }

  // 分块 push + 硬超时:任何单块绝不长时间挂起
  let pushed = 0
  let skippedFailures = 0
  const CONTINUE_ON_FAIL = process.env.IHUI_TAG_PUSH_CONTINUE_ON_FAIL === '1'
  const chunks = []
  for (let i = 0; i < missing.length; i += PUSH_CHUNK_SIZE) {
    chunks.push(missing.slice(i, i + PUSH_CHUNK_SIZE))
  }

  for (const [idx, chunk] of chunks.entries()) {
    const refspecs = chunk.map((t) => `refs/tags/${t}`).join(' ')
    const forceFlag = isForce ? '--force ' : ''
    const cmd = `git push ${forceFlag}--atomic origin ${refspecs}`
    console.log(
      `  ${C.dim}[${idx + 1}/${chunks.length}] $ git push --atomic origin <${chunk.length} tags>${forceFlag ? ' (--force)' : ''}${C.reset}`,
    )
    try {
      run(cmd, { timeout: PUSH_TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] })
      pushed += chunk.length
    } catch (e) {
      // 单块失败不阻断:标记未更新,下次提交会重试该块
      // 2026-09-24 修可观测性:原先只打 e.message(恒为 "Command failed: git push …"),git 给出的
      // 真正原因整段躺在 e.stderr 里 —— 217 枚积压 tag 补推失败多天,输出里一个原因字都没有。
      // 2026-10-11 补另一半:**git push 的逐引用结果("! [remote rejected] …"/"error: failed to
      // push some refs")走的是 stdout**(hook 的提示才在 stderr)。原先只看 e.stderr,于是
      // 屏幕上留下的是钩子那串"全量 typecheck 验证…"的**无关**通知,读起来像"push 门把这次拦了",
      // 而真实原因(例如远端拒绝某个引用)一个字都没露 —— 与 §12f"失效方向是安静"同型:
      // 这不是"报了原因但原因没用",是"报了一份会误导人的原因"。两流并取,stdout 在前。
      // 两流**各取尾部并标注来源**:合并成一串再 slice(-12) 会让后拼的那一流把前一流挤出去
      // (第一版就是这么写的,结果屏幕上仍是钩子那串无关通知,git 的拒绝行一个字没露 ⇒ 修了个
      //  观察性缺陷却产出第二个"会误导人的原因",比原状更糟)。
      const tailOf = (s, n = 6) =>
        String(s ?? '')
          .split(String.fromCharCode(10))
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(-n)
          .join(' | ')
      const outTail = tailOf(e?.stdout)
      const errTail = tailOf(e?.stderr)
      const firstLine = (
        [outTail && `stdout: ${outTail}`, errTail && `stderr: ${errTail}`]
          .filter(Boolean)
          .join(' || ') || String(e?.message ?? e)
      )
        .toString()
        .slice(0, 2400)
      console.error(
        `${C.yellow}⚠️  第 ${idx + 1} 块 push 失败(${chunk.length} 个),下轮重试:${C.reset} ${firstLine}`,
      )
      // 2026-09-24:块是**原子**推送,而"空壳 tag"(历史链里有对象已不存在)是永久失败、重试无意义。
      // 首败即 break 会让排在它后面的可推 tag 永远推不上去 ⇒ 人工/后台可用
      // IHUI_TAG_PUSH_CONTINUE_ON_FAIL=1 逐项越过;钩内(post-commit)仍保持首败即停,不拖慢 commit。
      if (!CONTINUE_ON_FAIL) break
      skippedFailures += chunk.length
    }
  }

  if (skippedFailures) {
    console.log(
      `\n${C.yellow}⚠️  本轮因失败跳过 ${skippedFailures} 个 tag${
        CONTINUE_ON_FAIL ? '(已逐项越过)' : '(首败即停,未再试后续块)'
      }:${C.reset}\n   若原因里是 "fatal: unable to read <sha>" + "remote unpack failed",那是**空壳 tag**` +
        `(历史链里的对象本机已没有)⇒ 重试与换网络都没用,只能按 §29 人工 GC 或从有该对象的仓回补。`,
    )
  }

  if (pushed > 0) {
    run(`printf %s ${Date.now()} > ${marker}`, { allowFail: true })
    console.log(`
${C.green}✅ tag 增量 push 完成:${pushed} 个已同步(本地+远端一致)${C.reset}`)
    process.exit(0)
  }

  console.log(`
${C.yellow}⚠️  无 tag 成功推送(已由限流/超时保护,不阻断 commit)${C.reset}`)
  process.exit(0)
}

function main() {
  if (isHelp) {
    printHelp()
    process.exit(0)
  }

  if (isFetch) {
    fetchMode()
    return
  }

  if (isAutoPush) {
    autoPushMode()
    return
  }

  // 默认 check 模式
  checkMode()
}

import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// main() 是同步函数(§22d:同步入口不得写成 main().catch(...) —— 那条链会当场 TypeError)
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
    console.error(e?.stack ?? '(no stack)')
    process.exit(2)
  }
}

export const __test__ = {
  hasOriginRemote,
  isBackupNamespace,
  diffTagSets,
  diffTagMaps,
  reachabilityBatch,
  listLocalTagMap,
  lsRemoteTagMap,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
