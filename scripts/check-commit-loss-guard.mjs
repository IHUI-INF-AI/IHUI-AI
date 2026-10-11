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
 *   2026-10-11 起「未备份悬空 commit」这一档带**时间窗量纲**(默认 30 天,与 §29 写明的
 *   lost-commit 备份保留期同值):窗内才拦,超窗只报数并点名最老一枚,`--strict` 把超窗
 *   也计入(问责存量),`--window-days 0` 回到全量语义。reset 那一档**不受窗影响**。
 *   立因是当轮实测:本仓未备份悬空 9809 枚 ⇒ 这道门早已恒红,而恒红的实际后果是每次提交
 *   都被逼 HUSKY_SKIP_COMMIT_LOSS_CHECK=1,连它真正该拦的"刚丢的那一枚"也不再有人被拦住
 *   (AGENTS §12f)。判据本身没有放宽"什么算丢失",改的是"哪一档由提交链负责"。
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
 *   2 — **无法判定**:判据面取不到(典型:fsck 派生不出来 / 超时 / 仓不可达)。
 *       与 1 分开是本仓既有约定(§12e):1 = "判完了,判红",2 = "没判完"。
 *       绝不允许把"没判完"折成 0 —— 那正是本门 2026-10-03 之前恒绿的成因。
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
 *
 * 入口形态(AGENTS.md §22d):本文件**既可被当命令跑,也可被 import**。
 *   原先它在顶层无条件 `try { main() } catch (e) { onFatal(e) }`,于是任何 `import` 都会
 *   把整道门跑一遍(判据取不到时还会 exit 2)⇒ 镜像测试拿不到判定单元,只能各抄一份
 *   正则/分类逻辑 —— 那正是 §22c 禁的镜像模式(抄的那份会静默漂移,而漂移的表现是恒绿)。
 *   现由 `isDirectRun` 守卫执行,判定单元经 `export const __test__` 供测试取用。
 */
import { pathToFileURL } from 'node:url'
import {
  batchExecFileSync,
  catBatchOids,
  gitBinary,
  gitErrText,
  gitRaw,
  Undetermined,
} from './lib/face-reader.mjs'

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
 * 档位旗标的 argv 读取点(**唯一源头**;2026-10-11 起含 `--list-unbacked` 与
 * `--list-out-of-window`,共五项)。
 * 镜像测试原先各抄一份 `'--blocking' / '--filter-stash'` 字面量:档位名一旦改,测试传的
 * 就成了没人读的字符串,断言照样绿(§22c 的"镜像常量漂移")。故导出真常量,测试取用。
 */
const FLAGS = {
  strict: '--strict',
  blocking: '--blocking',
  filterStash: '--filter-stash',
  listUnbacked: '--list-unbacked',
  listOutOfWindow: '--list-out-of-window',
}

/**
 * 「判绿」两句文案的唯一源头。测试只能靠 stdout 区分"判完了、判绿"与"没判成",
 * 原先它把这两句各抄一份正则(文案一改就静默失配 ⇒ 判据失效的表现是安静)。
 * 这里只是把已有的两处字面量挪成常量,**输出内容逐字不变**。
 */
const GREEN_MARKERS = {
  noUnreachable: '未检测到悬空 commit',
  noRisk: '无 commit 丢失风险',
}

/** 悬空 commit / tag 明细行的 hash 展示宽度(测试不得再各写一个 12)。 */
const SHORT_HASH_LEN = 12

/**
 * fsck stdout 上悬空 commit 行的前缀(判据与夹具的**同一个**源头)。
 * 镜像测试原先在桩数据里手打 `'unreachable commit <hash>'` —— 前缀一改,桩就再也喂不进
 * 判据,而那格断言仍可能绿(它断的是"清单被取用",拿不到清单也判不出为什么)。
 */
const UNREACHABLE_COMMIT_PREFIX = 'unreachable commit'
const UNREACHABLE_COMMIT_LINE_RE = /^unreachable commit\s+/

/**
 * 「悬空 commit 该由谁在什么时候处理」的**时间窗量纲**(2026-10-11 立,G-1117436 同批)。
 *
 * 立因不是假想,是当轮实测:`node scripts/check-commit-loss-guard.mjs --blocking --filter-stash`
 * 在本仓读到 **9809 个未备份悬空 commit**(封件 `.ihui-agent/tmp/gate30a-before.md`,
 * `#EVIDENCE-RC=1`),即这道门早已是恒红门 —— 而恒红门的实际后果不是"每次都拦住丢失",
 * 是每一次提交都被逼 `HUSKY_SKIP_COMMIT_LOSS_CHECK=1`,于是**连它真正防的那一型(刚发生的
 * reset / 刚产生的无出处悬空)也不再有人被拦住**(AGENTS §12f,同仓一天三道同型)。
 *
 * 为什么"把判据改成只报数"不是答案:那等于承认 9809 枚都该保而永久不保,门变成装饰品。
 * 为什么"逐枚 tag 9809 枚"也不是答案:那要往 origin 原子推近万枚 tag,而 §29 早已写明
 * **悬空备份的保留期就是 30 天、超期由仓库维护者一次性人工 GC**(需要人审,不得脚本自动化)。
 * ⇒ 唯一与仓内既有政策同形的量纲:**「30 天窗内新产生、且无 tag 备份」才由提交链拦,
 * 超窗的部分逐条报数并点名最老一枚,问责走 `--strict`**。窗内这一档才是"本次该处理的丢失",
 * 超窗那一档是"该由人拍板 GC 的存量",把后者算在每个提交者头上,得到的只有跳门。
 *
 * 三条不许漂的写法:
 * ① 读不到某枚的 committer 时刻 ⇒ **保守算窗内**(照旧拦),并逐条点名 —— 缺读数永远不往绿折;
 * ② 整批日期都取不到(派生全失败)⇒ 全部按"未判定=窗内"拦,并大声报出派生失败;
 * ③ `--window-days 0`(或 `IHUI_COMMIT_LOSS_WINDOW_DAYS=0`)= **关掉窗维**,回到 2026-10-11
 *    之前的全量语义。它是变异自证的对照组,也是人工回看存量时的入口,不是应急跳门通道。
 */
const WINDOW_DAYS_DEFAULT = 30
const WINDOW_DAYS_ENV = 'IHUI_COMMIT_LOSS_WINDOW_DAYS'
/** 一次 `git log --no-walk` 传多少 oid:400 × 41 字符 ≈ 16.5 KB,稳在 Windows argv 上限内。 */
const DATE_WALK_BATCH = 400

/**
 * reflog 行 → "这是一次把 HEAD 往回退的 reset" 的判据(唯一源头)。
 * 命中形态:`reset: moving to HEAD~` / `reset: moving to HEAD@{1}`;
 * 不命中:`checkout: moving from …` / `commit: …` / `reset: moving to <具体 hash>`。
 */
const RESET_LINE_RE = /reset:\s*moving to HEAD[~@]/

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
const isStrict = process.argv.includes(FLAGS.strict)
const isBlocking = process.argv.includes(FLAGS.blocking)
const isFilterStash = process.argv.includes(FLAGS.filterStash)
const isListUnbacked = process.argv.includes(FLAGS.listUnbacked)
const isListOutOfWindow = process.argv.includes(FLAGS.listOutOfWindow)
/**
 * `--window-days <N>` 的取值(**只认紧跟的那一个 token**)。
 * 刻意不写成"扫到 flag 之后所有数字里挑一个":仓内已有判据因把别处的数字当自己的参数而误判
 * (守门 111 那条"参数改成可选标注后正则只认旧形态"同型)。取不到值就交给 resolveWindowDays
 * 回落默认,并由它把"给了旗但值无效"标成 invalid ⇒ 打印出来,不静默。
 */
const WINDOW_DAYS_FLAG = '--window-days'
const windowDaysFlagValue = (() => {
  const i = process.argv.indexOf(WINDOW_DAYS_FLAG)
  return i === -1 ? undefined : process.argv[i + 1]
})()

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
 *
 * ⚠️ `allowFail` 是**降级**开关,不是"判据的合法出口"。凡是"取不到就等于没有"的判据
 * (即取不到时会把结论往绿的方向折),不得使用它 —— 那是把"没判"写成"判过了"。
 * 需要区分"取不到"与"真的是空"的判据,走 `listUnreachableHashes` 的三态返回。
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
 * ⚠️ 为什么必须是层的 `catBatchOids`(`<oid>^{tree}` 规格出口)而**不能**用内容版 `catBatch`
 * (G-1018289② 门内静默失效的根因,2026-10-08 实证):`catBatch` 是 **blob-only 契约** ——
 * 其头解析正则 `HASH_RE` 只认 `<oid> blob <size>`,commit 对象的头是 `<oid> commit <size>`
 * 匹配不上 ⇒ 按层"非 blob 一律 null"的语义返回 null。用错出口时**没有任何报错**,
 * 表现就是"tree 全部取不到 ⇒ 白名单/树等价两段放行静默失效,恒红"。
 * `catBatchOids` 不做类型过滤(其注释明说专为 `<oid>^{tree}` 这类规格服务),missing 归 null,
 * 与旧写法 `cat-file --batch-check` 的对齐解析逐字同构。
 *
 * 批量体量:4.5k 个 commit ≈ 2MB 的规格清单,远在层的 64MB 缓冲之内;且不必逐对象
 * `rev-parse`(4500 枚 = 4500 次进程创建)。
 *
 * 结论口径(与最老写法对齐):`^{tree}` 对 commit / annotated tag / tree 一律剥出树 oid
 * 计入;对象缺失(`missing`)归 null 不入 map —— 那个键永远不可能等于任何真树 oid。
 */
function treesForCommits(oids) {
  const out = new Map()
  const list = [...new Set(oids.filter((h) => /^[0-9a-f]{40}$/.test(String(h) || '')))]
  if (list.length === 0) return out
  const got = catBatchOids(
    ROOT,
    list.map((h) => `${h}^{tree}`),
  )
  for (const h of list) {
    const tree = got.get(`${h}^{tree}`)
    if (tree) out.set(h, tree)
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

/** reflog 单行是否为"往回退的 reset"(判据见 RESET_LINE_RE)。 */
function isResetReflogLine(line) {
  return RESET_LINE_RE.test(line)
}

/**
 * reflog 行的**行首字段** = 该次操作后该 ref 指向的对象 hash
 * (git 对唯一对象输出短 hash,所以只能按前缀比,不能等值比)。
 */
function reflogLineSourceHash(line) {
  return (
    String(line || '')
      .trim()
      .split(/\s+/)[0] || ''
  )
}

/**
 * 2026-09-04 修复:若 reset 的源 commit(hash 即行首字段)已被 lost-commit/* tag
 * 备份,则该次 reset 不构成丢失风险,放行(与悬空 commit 的 tag 备份判定对齐)。
 * 否则历史 reset 会永久滞留 reflog 最近 50 步窗口内,无解阻塞所有后续 commit。
 * 前缀匹配是双向的(git 可能输出短 hash,tag 名里可能带短 hash)。
 */
function dropBackedResets(resets, backedHashes) {
  return resets.filter((line) => {
    const srcHash = reflogLineSourceHash(line)
    if (!srcHash) return true
    // 前缀匹配(git 对唯一对象输出短 hash)
    for (const h of backedHashes) if (h.startsWith(srcHash) || srcHash.startsWith(h)) return false
    return true
  })
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
    if (isResetReflogLine(line)) {
      resets.push(line)
    }
  }
  const backedHashes = new Set(
    verifyAllTagReachability(listLostCommitTags())
      .map((r) => r.hash)
      .filter(Boolean),
  )
  return dropBackedResets(resets, backedHashes)
}

function isStashSubject(subject) {
  if (!subject) return false
  // stash-like subject 形如 "WIP on <branch>: <hash> <msg>" / "On <branch>: <hash> <msg>"
  // / "index on <branch>: <hash> <msg>" / "untracked files on <branch>: <hash> <msg>"
  // 2026-08-17 修复:原正则只匹配 "index on main:"/"On main:",漏掉其他分支(如
  // fix/* 分支)产生的 stash 索引快照,导致误报"未备份悬空 commit"阻塞 commit。
  // 改为匹配任意分支名(冒号前为非空非空白串),与下方 `extractOriginalHashFromStash`
  // 的提取正则保持一致(两处同改,否则会出现"认得出是 stash 却取不出原 hash"的新格)。
  // 2026-10-03 补:`<branch>` 不能用 `\S+` —— **detached HEAD 下 git 写的是
  // `index on (no branch): <hash> <msg>`,分支名含空格** ⇒ `\S+: ` 失配 ⇒ stash 索引快照
  // 漏进 unbacked,把它的单亲提交顶成"未备份"持续阻塞 commit(实测枚 88baec2bff:
  // 单亲 7174e48a1205、零文件、正是 stash 三元组里的 index commit)。
  // 判据改为「冒号前允许含空格但不得为空」:`On \S.*?: ` / `index on \S.*?: `。
  // 收紧方向说明:非贪婪 `\S.*?` 只吃到**第一个**冒号,所以 "On feature/x: abc msg"
  // 仍匹配;而 "On some words: abc" 这类非 stash subject 仍会因缺 ` abc <hex>` 后缀
  // 在 `extractOriginalHashFromStash` 那侧被拒 —— 两道判据互补,不是单靠这一条。
  return (
    /^WIP on /.test(subject) ||
    /^On \S.*?: /.test(subject) ||
    /^index on \S.*?: /.test(subject) ||
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
  //
  // 2026-10-03:`\S+` 与 `isStashSubject` 同步放宽为 `\S.*?` —— detached HEAD 下分支名是
  // `(no branch)`(含空格),旧式在**识别**侧失配就算了,若只改识别侧不改这里,就会留下
  // "认得出是 stash、却取不出原 hash"的新格:那条提交在备份核对里仍进 unbacked。
  // 两处必须同改(判据同源,别只改一半)。
  if (!subject) return ''
  const m = subject.match(/^[A-Za-z ]+on\s+\S.*?:\s+([0-9a-f]{7,40})\b/)
  return m ? m[1] : ''
}

/**
 * fsck stdout → 悬空 commit hash 列表(**纯函数**,不派生 git)。
 *
 * 只认 `unreachable commit` 行(`unreachable tree|blob`、`broken link …` 都不是本门判据);
 * 空数组是合法读数 —— "取不到"由 `listUnreachableHashes` 抛 `Undetermined` 表达,不在这里。
 * 导出给镜像测试:测试原先自己抄一份同样的行解析来构造期望,源一改那份就漂移成恒绿。
 */
function parseUnreachableCommitLines(stdout) {
  return String(stdout ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith(UNREACHABLE_COMMIT_PREFIX))
    .map((l) => l.replace(UNREACHABLE_COMMIT_LINE_RE, ''))
    .filter(Boolean)
}

/**
 * `git log --all --format=%T%x09%s` 的 stdout → 「树 hash \t subject」键集(**纯函数**,不派生 git)。
 *
 * 这是同内容副本白名单(G-1018289②,2026-10-08 立)的取材出口:并发会话 amend/rebase
 * 重写后,被换下来的旧 commit 以「悬空」形态滞留对象库,而它的**内容**(树 hash 与题)在
 * 可达历史里有一份逐字同的活体 —— 这类对象被 gc 吃掉不丢任何内容,把它算作"本次提交
 * 引入的丢失风险"正是台账 G-1018289② 登记的那格:"没有任何判据区分『本次引入的悬空』
 * 与『并发重写留下的同内容副本』"。判据刻意取**树+题两元同时相等**(而非仅树相等):
 * 只比树会把"同内容但不同语义"的空提交/样板提交全部放行,只比题又会被 rebase 改题绕过。
 *
 * 取不到/解析失败由调用方表达(null ⇒ 白名单整体失效,fail-safe 朝红),这里只管纯解析:
 * 每行第一段是树 hash,其后至第二个 \t 之间保留(题里再含 \t 时按原样并入 subject),
 * 缺 \t 的行(空输出首尾、异常行)跳过。
 */
function parseTreeSubjectIndex(stdout) {
  const keys = new Set()
  for (const line of String(stdout ?? '').split('\n')) {
    const t1 = line.indexOf('\t')
    if (t1 <= 0) continue
    const t2 = line.indexOf('\t', t1 + 1)
    const tree = line.slice(0, t1)
    const subject = t2 === -1 ? line.slice(t1 + 1) : line.slice(t2 + 1)
    if (!tree || !subject) continue
    keys.add(`${tree}\t${subject}`)
  }
  return keys
}

/**
 * 一批 commit oid → `[{hash, unixSeconds}]`(**纯函数**,不派生 git)。
 *
 * 输入是 `git log --no-walk --format=%H%x09%ct` 的 stdout。两件事必须记住:
 * ① `--no-walk` **不保证与传参同序**(实测,见 `filterStashLike` 里那条老注),所以只能按
 *    `%H` 建映射,严禁按行索引对应 —— 那是曾经把 stash 过滤错位的同一个坑;
 * ② 时刻读不出来(空值、非数字、被 `%ct` 打成 `-`)⇒ **跳过该行**,由调用方把"没有读数"
 *    当成保守方向(算窗内)处理。这里不猜、也不默认成 0(0 = 1970 年 = 必然超窗 = 往绿折)。
 */
function parseCommitterDateLines(stdout) {
  const out = []
  for (const line of String(stdout ?? '').split('\n')) {
    const t = line.indexOf('\t')
    if (t <= 0) continue
    const hash = line.slice(0, t).trim()
    const raw = line.slice(t + 1).trim()
    if (!hash) continue
    const ts = Number(raw)
    if (!Number.isFinite(ts) || ts <= 0) continue
    out.push([hash, ts])
  }
  return out
}

/**
 * 窗维取几天(**纯函数**):`--window-days` > 环境变量 > 默认 30。
 * 非法值(非数字、负数、非整数)⇒ 回落到默认并**由调用方报名**,绝不静默变成"关掉窗维"
 * (那会让一次打错的 argv 变成整道门的量纲变更)。`0` 是合法值,含义见 WINDOW_DAYS_* 注释③。
 */
function resolveWindowDays({ flagValue, envValue, fallback = WINDOW_DAYS_DEFAULT } = {}) {
  const pick = (v) => {
    if (v === undefined || v === null || v === '') return null
    const n = Number(String(v).trim())
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
    return n
  }
  const fromFlag = pick(flagValue)
  if (fromFlag !== null) return { days: fromFlag, source: 'flag', invalid: false }
  const fromEnv = pick(envValue)
  if (fromEnv !== null) return { days: fromEnv, source: 'env', invalid: false }
  const touched =
    (flagValue !== undefined && flagValue !== '') || (envValue !== undefined && envValue !== '')
  return { days: fallback, source: 'default', invalid: touched }
}

/**
 * 未备份悬空 commit → **窗内(拦)/ 超窗(报数)** 两档(纯函数,本门新增判据的唯一实现)。
 *
 * 输入全部由调用方从 git 取好后喂进来,所以这一层的四种情形都能用构造面证明,不必依赖
 * 仓库此刻的悬空存量(那正是守门 103 T12 那一课:证明取材面类的行为只能用纯函数+构造面)。
 *
 * @param {object} p
 * @param {string[]} p.unbacked        经过 ①②③ 三道既有放行后仍未备份的悬空 commit
 * @param {Map<string,number>} p.committerUnixByHash  批量取到的 committer 时刻
 * @param {number} p.nowUnix           本次判定的"现在"(注入而非读时钟,便于夹具)
 * @param {number} p.windowDays        窗宽;`<=0` ⇒ 关掉窗维(全量语义)
 * @param {number} [p.strict]          问责档:超窗也算拦
 * @param {number} [p.failedBatches]   取日期的批次失败条数(整批失败 ⇒ 保守全拦)
 */
function splitUnbackedByWindow({
  unbacked = [],
  committerUnixByHash = new Map(),
  nowUnix = 0,
  windowDays = WINDOW_DAYS_DEFAULT,
  strict = false,
  failedBatches = 0,
} = {}) {
  const ids = [...unbacked]
  // 窗维关掉 ⇒ 逐字回到 2026-10-11 之前的语义(全算拦)。放在最前,是为了让"整批取不到日期"
  // 那一支不会把它悄悄改回部分放行。
  if (!(windowDays > 0)) {
    return { blocking: ids, outOfWeek: [], undated: [], cutoff: null, windowDays, strict }
  }
  const cutoff = nowUnix - windowDays * 86_400
  // 整批派生失败(一个时刻都没读到,而确有候选、且确有批次报错)⇒ 保守:全部算窗内。
  // 只在此三者同时成立时触发;单枚读不到走下面的 undated 分支,不影响其余。
  if (ids.length > 0 && committerUnixByHash.size === 0 && failedBatches > 0) {
    return {
      blocking: ids,
      outOfWeek: [],
      undated: ids,
      wholeWalkFailed: true,
      cutoff,
      windowDays,
      strict,
    }
  }
  const blocking = []
  const undated = []
  const outOfWeek = []
  for (const c of ids) {
    const ts = committerUnixByHash.get(c)
    if (typeof ts !== 'number' || !Number.isFinite(ts)) {
      undated.push(c)
      blocking.push(c) // 保守方向:读不到就当还在窗内,绝不因"没量到"而放行
      continue
    }
    if (ts >= cutoff) blocking.push(c)
    else outOfWeek.push({ hash: c, unix: ts })
  }
  outOfWeek.sort((a, b) => a.unix - b.unix)
  if (strict) for (const o of outOfWeek) blocking.push(o.hash)
  return { blocking, outOfWeek, undated, cutoff, windowDays, strict }
}

/**
 * fsck 读数 —— **本门唯一一处不走 `gitText` 的判据**,因为它必须区分
 * 「取不到」与「取到了但是零」,而 `allowFail` 只能表达后者。
 *
 * ## 假绿事故(2026-10-03 实测取证,真值 788 枚 unreachable commit 却恒绿)
 *   本仓 `git fsck --connectivity-only --unreachable --no-reflogs` 的**真实退出码是 2**
 *   (不是 0)。而 `gitRaw` 对任何非 0 都抛 `Undetermined`,`allowFail` 再把它折成 `''`,
 *   `if (!out) return []` 于是把 788 读成 0 —— 三次连跑全 RC=0「✅ 未检测到悬空 commit」。
 *   代价 410 KB / 7035 行 stdout 里有 788 枚 `unreachable commit`,判据却只看 `=== ''`。
 *
 * ## fsck 退出码语义(2026-10-03 bash 直跑实测,判据的根据)
 *   | 场景                                   | RC   | stdout                    | 含义 |
 *   |----------------------------------------|------|---------------------------|------|
 *   | 干净仓 / 只有悬空对象(无损坏)           | 0    | 悬空清单(**可为空**)       | 正常读数 |
 *   | 本仓(40 条 `broken link`,partial 对象)  | 2    | 悬空清单 + broken link 行 | **正常读数** |
 *   | 非仓库目录                             | 128  | 空,stderr `fatal: …`      | 取不到 |
 *   ⇒ **RC≠0 不等于"取不到"**:悬空对象本身不产生非 0(夹具实测),非 0 来自 fsck 顺带报出的
 *     其它问题(`broken link`),而那份 unreachable 清单此时**是完整可信的**。
 *     把 RC 非 0 一律当失败,会把本仓永久钉红(那 40 条 broken link 与本门判据无关);
 *     这正是本函数存在的理由:RC 单独不作判据,只认「stdout 读没读到」。
 *
 * ## 为什么用 `batchExecFileSync` 而不是 `gitRaw`(两者的关键差别)
 *   `gitRaw` 的 catch 用 `gitErrText` **新造**一个 `Undetermined`,只带 message 与 `status`,
 *   原异常的 `stdout` 被丢弃(实测:同一个 fsck,走 `gitRaw` 后 `e.stdout === undefined`)——
 *   也就是说经它手就永远拿不回 RC≠0 时 stdout 里那份清单,只能红或绿二选一。
 *   `batchExecFileSync` 是同层导出、同样带 EBUSY 兜底重试,但把原异常原样抛出,
 *   `e.stdout` 与 `e.status` 都在(实测 410082 字节 / 788 行齐在)。这是本门能同时做到
 *   「不把 RC≠0 当失败」与「取不到就 fail-closed」的唯一出口。
 *
 * @returns {string[]} unreachable commit 哈希(**空数组是合法读数**:fsck 跑完并报告零悬空)
 * @throws  {Undetermined} 判据面取不到 —— 调用方必须 fail-closed,不得折成空数组
 */
function listUnreachableHashes() {
  // --no-reflogs: 不遍历 reflog(只检查悬空 commit 对象)
  // --connectivity-only: 只走对象图连通性,不校验 tree/blob 内容 —— 本函数的判据
  // 只看 `unreachable commit` 行,内容校验对它是纯开销。2026-09-24 本机实测(共享工作区,
  // 4251 枚 lost-commit tag + partial 对象):完整模式 130,217ms / conn 模式 3,059ms,
  // 而 unreachable commit=8/8、tree=775/775、blob=607/607、行类型集合(broken/to/unreachable/
  // missing)**逐条相同** ⇒ 快 42.6 倍且判据零损失。
  // 为什么值得为此改一行:完整 fsck 的 130 秒窗口横跨并发会话的 reset/tag 手术,
  // 期间读到的正是一份**移动中的现场**;窗口越短,pre-commit 被并发态误判成红的概率越低。
  // 旧写法在这里挂 `2>&1`(只有 shell 通道才需要)。这里分别捕获 stdout/stderr,
  // 而本判据只取 stdout 上的 `unreachable commit` 行(git 的不可达对象清单本来就打在 stdout,
  // 诊断与警告才走 stderr)⇒ 去掉合并不会少一行,少了的行也不是判据输入。
  const ARGS = ['fsck', '--connectivity-only', '--unreachable', '--no-reflogs']
  // 与 gitRaw 同形的派生选项,逐字对齐(绝对路径 git 由 gitBinary() 给足):
  // safe.directory=* 是本仓共享工作区的硬需求,quotepath=false 防中文路径被转义。
  const argv = ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', ROOT, ...ARGS]
  const opts = {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    // 显式数字 timeout:不让 fsck 无界挂起把 pre-commit 钉死(与旧 gitRaw 默认同值)。
    timeout: 60_000,
    maxBuffer: 64 << 20,
    // stdio[0]='ignore':本环境 pipe-stdin spawn git 确定性 EBUSY(见 lib/gitdir.mjs 同款注),
    // 而 fsck 不读 stdin ⇒ ignore 无副作用,换来的是躲开那扇病窗。
    stdio: ['ignore', 'pipe', 'pipe'],
  }
  let stdout = null
  try {
    stdout = String(batchExecFileSync(gitBinary() || 'git', argv, opts) ?? '')
  } catch (e) {
    /**
     * 读数成立的**充分必要条件**:git 真的跑完了(有数字 status,排除 EBUSY/ENOENT/超时/信号),
     * 且 stdout 非空,且 stderr 没有 `fatal:`。
     * - 无 status ⇒ 派生层没跑成(EBUSY 兜底也失败 / ENOENT / 超时 / 被信号杀)⇒ 取不到。
     * - `fatal:` ⇒ git 自己拒绝执行(典型:不是仓库)⇒ 取不到。这条独立于 status:
     *   非仓库是 RC=128 + 空 stdout,不写它就会掉进下面的 status 判据里。
     * - status 有值但 stdout 空 ⇒ 拿到了退出码却没拿到清单,仍属取不到。
     */
    const ranOk = typeof e?.status === 'number'
    const out = typeof e?.stdout === 'string' ? e.stdout : ''
    const fatal = /(?:^|\n)fatal:/m.test(String(e?.stderr ?? ''))
    if (!ranOk || !out || fatal) {
      throw new Undetermined(
        `fsck 判定面取不到(${ROOT}):${gitErrText(e)}` +
          (ranOk ? ` [status=${e.status}]` : ' [派生层未取得退出码]') +
          (fatal ? ' [git fatal]' : '') +
          ' —— 不可判定,不得读成"零悬空"',
      )
    }
    stdout = out
  }
  return parseUnreachableCommitLines(stdout)
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

/**
 * 批量取 committer 时刻(窗维的唯一派生出口)。
 *
 * 为什么按批而不是逐枚:`git log --no-walk` 每次派生在本机实测约 100–300 ms,而窗维要问的
 * 候选在本仓可达近万枚 —— 逐枚就是上面那条 2026-08-17 事故重演一遍。分批是同一套修法的复用,
 * 批次宽度由 `DATE_WALK_BATCH` 给(400 × 41 字符稳在 Windows argv 上限内)。
 * 同一条老注对这里同样成立:**`--no-walk` 不保证与传参同序**,所以只能按 `%H` 建映射。
 *
 * 为什么这里允许 `allowFail`:它把"取不到"折成空串,而调用方**不是**把空读成"没有悬空",
 * 是读成"这一批没量到"⇒ 计入 `failedBatches` ⇒ 整批都失败时由 `splitUnbackedByWindow` 的
 * `wholeWalkFailed` 支保守全拦。`gitText` 头注那条禁令禁的是"取不到就等于没有"的判据,不是这一型。
 *
 * @returns {{map: Map<string, number>, failedBatches: number, batches: number}}
 */
function committerUnixFor(oids) {
  const map = new Map()
  let failedBatches = 0
  let batches = 0
  const list = [...oids]
  for (let i = 0; i < list.length; i += DATE_WALK_BATCH) {
    const batch = list.slice(i, i + DATE_WALK_BATCH)
    batches++
    const out = gitText(['log', '--no-walk', '--format=%H%x09%ct', ...batch], {
      allowFail: true,
      timeout: LOCAL_GIT_TIMEOUT_MS,
    })
    if (!out) {
      failedBatches++
      continue
    }
    for (const [hash, ts] of parseCommitterDateLines(out)) map.set(hash, ts)
  }
  return { map, failedBatches, batches }
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

/**
 * `for-each-ref --format=%(refname:short)%09%(objectname)%09%(*objectname)` 的输出
 * → Map<shortName,{obj,peeled}>(**纯函数**:tag 可达性读取的第一段,不派生 git)。
 */
function parseForEachRefTagInfo(out) {
  // shortName → { obj, peeled }
  const infoByTag = new Map()
  for (const line of String(out || '').split('\n')) {
    const [shortName, obj, peeled] = line.split('\t')
    if (shortName) infoByTag.set(shortName, { obj: obj || '', peeled: peeled || '' })
  }
  return infoByTag
}

/**
 * 本地 tag 清单 + 上面那份 ref 信息 → 逐枚可达性结论(**纯函数**:tag 可达性读取的第二段)。
 * for-each-ref 能列出即对象可达;annotated tag 用 peeled commit,lightweight 直接用 obj。
 * 列不出来 = `ref 缺失`(那是 blocking 的一侧,不得读成"没有这枚 tag")。
 */
function buildTagReachability(tags, infoByTag) {
  return tags.map((tag) => {
    const info = infoByTag.get(tag)
    const result = { tag, hash: '', tagReachable: false, commitReachable: false, reason: '' }
    if (!info) {
      result.reason = 'for-each-ref 未列出该 tag(ref 缺失)'
      return result
    }
    result.hash = info.peeled || info.obj
    result.tagReachable = true
    result.commitReachable = true
    result.ok = true
    return result
  })
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
  return buildTagReachability(tags, parseForEachRefTagInfo(out))
}

/**
 * `for-each-ref refs/tags/lost-commit refs/tags/backup --format=%(objectname)%09%(*objectname)`
 * 的行 → 备份集合所覆盖的 commit hash 集(**纯函数**)。
 * annotated tag: 两列都有 → 第 2 列 peeled commit;
 * lightweight: 仅第 1 列(第 2 列为空串)→ 即 commit 本身.
 * 注意:必须用 || 而非 ??——peeled 空串在轻量 tag 下是常态.
 * seeds 传"已由 reachability 算出的 hash 集"(2026-08-28 性能修复:复用批量结果,零额外子进程)。
 */
function collectBackupCommitHashes(refOut, seeds = []) {
  const hashes = new Set(seeds)
  for (const line of String(refOut || '').split('\n')) {
    const cols = line.trim().split('\t')
    const commitHash = cols[1] || cols[0]
    if (/^[0-9a-f]{40}$/.test(commitHash || '')) hashes.add(commitHash)
  }
  return hashes
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

/**
 * 判定主体。§22d 后它是 **async**(入口守卫要拿它的 promise 接 `.then/.catch`);
 * 函数体内没有任何 await ⇒ 求值时序与旧的同步版逐字相同,每条出口仍自己 `process.exit(N)`
 * (0 = 通过/降级通过,1 = blocking 判红,skip 档 = 0),`onFatal` 仍负责异常侧的 exit 2。
 */
async function main() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 commit 丢失防护守门(不推荐)${C.reset}`)
    process.exit(0)
  }

  console.log(`${C.cyan}${C.bold}🛡️  Commit 丢失防护守门(AGENTS.md §22 配套)${C.reset}`)

  // 窗维在**入口处**解析一次:main 里两处打印(告警行与建议行)必须报同一个天数,
  // 各算一遍就会在有人只改一处时出现"拦的是 7 天、说的是 30 天"这种自相矛盾的读数。
  const winDim = resolveWindowDays({
    flagValue: windowDaysFlagValue,
    envValue: process.env[WINDOW_DAYS_ENV],
  })
  console.log(
    `  ${C.dim}悬空 commit 量纲:${C.reset}` +
      (winDim.days > 0
        ? `${C.cyan}${winDim.days}${C.reset} ${C.dim}天内才拦(来源=${winDim.source};` +
          `超窗存量只报数 —— §29 人工 GC 范围)${C.reset}`
        : `${C.cyan}窗维已关闭${C.reset} ${C.dim}(全量语义:任何未备份悬空都拦)${C.reset}`),
  )

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
    console.log(`  ${C.green}✅ ${GREEN_MARKERS.noUnreachable}${C.reset}`)
    if (isFilterStash && stashCount > 0) {
      console.log(
        `     ${C.dim}(已过滤 ${stashCount} 个 stash-like 对象:WIP / On main / index on main / untracked files on main)${C.reset}`,
      )
    }
  } else {
    console.log(`  ${C.yellow}⚠️  检测到 ${unreachable.length} 个悬空 commit:${C.reset}`)
    for (const c of unreachable.slice(0, 10)) {
      const short = c.slice(0, SHORT_HASH_LEN)
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
      const short = hash.slice(0, SHORT_HASH_LEN) || '?'
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
      console.log(
        `     ${C.cyan}${tag}${C.reset} → ${C.dim}${hash?.slice(0, SHORT_HASH_LEN) || '?'}${C.reset}`,
      )
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
      const hashes = collectBackupCommitHashes(refOut, backedUp)
      try {
        // 旧写法把 `<oid>^{tree}` 喂 `cat-file --batch-check=%(objectname)`;改由层的
        // catBatchOids 规格出口同答(`treesForCommits` 内,仍是一次批量派生)。
        for (const tree of treesForCommits([...hashes]).values()) backedTrees.add(tree)
      } catch {
        /* 批量失败时安全降级:backedTrees 为空,退回 hash/subject 判定 */
      }
    }
    // 性能:批量取 subject(同 filterStashLike 的 --no-walk 分批法),
    // 再对仍未放行者一次批量取 tree,避免逐 commit 派生.
    // ③ 同内容副本白名单(G-1018289②,2026-10-08)也在这条链里:经过 ①② 仍未放行的悬空
    // commit 中,有一型是"并发会话 amend/rebase 重写后滞留的旧对象" —— 它的树与题在
    // **可达历史**里有一份逐字同的活体,gc 吃掉它不丢任何内容。旧判据把这一型也算
    // "未备份悬空"压到本次提交头上,是台账 G-1018289② 登记的那格恒红温床。判据 =
    // `git log --all` 的 (树,题) 键集两元同时相等;索引取不到(log 派生失败/空读数)
    // ⇒ 白名单整体失效,维持 blocking(fail-safe 朝红,绝不朝绿)。
    // 白名单放行**不静默**:逐条点名打在 stdout(见下方 whitelistedSameContent 打印)。
    const { unbacked, whitelistedSameContent, subjectByHash } = (() => {
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
      const whitelistedSameContent = []
      if (survivors.length === 0)
        return { unbacked: survivors, whitelistedSameContent, subjectByHash }
      // ② tree 等价放行(stash WIP/index commit 树与 base 恒等)
      const treeByCommit = new Map()
      try {
        // 旧写法:把 `<oid>^{tree}` 喂 `cat-file --batch-check`(argv 直调,消除 shell 对
        // %(objectname) 的破坏)。现由层的 catBatchOids 规格出口同答(键控解析不依赖保序,
        // 见 treesForCommits 注释里的 blob-only 教训)。批量失败时安全降级:无 tree 映射,
        // 退回 hash/subject 判定。
        for (const [commit, tree] of treesForCommits(survivors)) treeByCommit.set(commit, tree)
      } catch {
        /* 批量失败时安全降级:无 tree 映射,退回 hash/subject 判定 */
      }
      let rest = survivors.filter((c) => {
        const tree = treeByCommit.get(c)
        return !(tree && backedTrees.has(tree))
      })
      if (rest.length > 0) {
        let reachableKeys = null
        try {
          const logOut = gitText(['log', '--all', '--format=%T%x09%s'], {
            allowFail: true,
            timeout: LOCAL_GIT_TIMEOUT_MS,
          })
          // 空读数与失败同判:索引缺位时白名单不生效(fail-safe 朝红)。
          reachableKeys = logOut ? parseTreeSubjectIndex(logOut) : null
        } catch {
          reachableKeys = null
        }
        if (reachableKeys && reachableKeys.size > 0) {
          rest = rest.filter((c) => {
            const tree = treeByCommit.get(c)
            const subject = subjectByHash.get(c)
            if (tree && subject && reachableKeys.has(`${tree}\t${subject}`)) {
              whitelistedSameContent.push(c)
              return false
            }
            return true
          })
        }
      }
      return { unbacked: rest, whitelistedSameContent, subjectByHash }
    })()
    if (whitelistedSameContent.length > 0) {
      console.log(
        `  ${C.dim}↳ 同内容副本放行 ${whitelistedSameContent.length} 个(树+题与可达历史逐字同:并发重写留下的旧对象,非丢失风险):${C.reset}`,
      )
      for (const c of whitelistedSameContent.slice(0, 10)) {
        const subj = subjectByHash.get(c) || ''
        console.log(
          `  ${C.dim}   ↳ 放行:${C.cyan}${c.slice(0, SHORT_HASH_LEN)}${C.reset} ${C.dim}${subj.slice(0, 80)}${C.reset}`,
        )
      }
    }
    if (unbacked.length > 0) {
      // ── 时间窗量纲(2026-10-11 立,缘由与三条不许漂的写法见 WINDOW_DAYS_* 头注)──
      // 只问"窗内新产生的、且无出处的悬空"要谁负责;超窗那部分是 §29 写明的人工 GC 存量,
      // 逐枚算在每个提交者头上,得到的从来不是备份,是全员跳门(§12f)。
      const walked = committerUnixFor(unbacked)
      const win = splitUnbackedByWindow({
        unbacked,
        committerUnixByHash: walked.map,
        failedBatches: walked.failedBatches,
        nowUnix: Math.floor(Date.now() / 1000),
        windowDays: winDim.days,
        strict: isStrict,
      })
      if (winDim.invalid)
        console.log(
          `  ${C.yellow}⚠️  ${WINDOW_DAYS_FLAG} / ${WINDOW_DAYS_ENV} 的值无法解析` +
            `(flag=${JSON.stringify(windowDaysFlagValue)} env=${JSON.stringify(
              process.env[WINDOW_DAYS_ENV],
            )})⇒ 回落默认 ${WINDOW_DAYS_DEFAULT} 天${C.reset}`,
        )
      if (win.wholeWalkFailed)
        console.log(
          `  ${C.yellow}⚠️  committer 时刻整批判不到(${walked.failedBatches}/${walked.batches} 批失败)` +
            ` ⇒ 窗维未生效,按保守方向**全部照拦**;这是"没量到",不是"没风险"${C.reset}`,
        )
      if (win.undated.length > 0 && !win.wholeWalkFailed) {
        console.log(
          `  ${C.yellow}⚠️  ${win.undated.length} 枚取不到 committer 时刻 ⇒ 保守算窗内(照拦)${C.reset}`,
        )
        for (const c of win.undated.slice(0, 5))
          console.log(`  ${C.dim}   ↳ 无时刻:${C.cyan}${c.slice(0, SHORT_HASH_LEN)}${C.reset}`)
      }
      if (win.outOfWeek.length > 0 && !isStrict) {
        const oldest = win.outOfWeek[0]
        console.log(
          `  ${C.dim}↳ 超出 ${winDim.days} 天窗、只报数不拦:${win.outOfWeek.length} 枚` +
            `(最老一枚 ${new Date(oldest.unix * 1000).toISOString().slice(0, 10)} ` +
            `${oldest.hash.slice(0, SHORT_HASH_LEN)})—— 按 AGENTS.md §29 属人工 GC 存量;` +
            `问责跑 --strict,全量档跑 --window-days 0${C.reset}`,
        )
      }
      if (win.blocking.length > 0) {
        issues.push(
          `${win.blocking.length} 个悬空 commit 未 tag 备份(运行 git tag lost-commit/<name> <hash> 备份)` +
            (winDim.days > 0 && !isStrict ? ` [${winDim.days} 天窗内]` : ' [全量档]'),
        )
        // 2026-09-04 修复:打印具体未备份 hash(原仅报数量,无法定位处置;
        // 并行 agent 高频 fsck 会持续产生新悬空对象,需可见才能针对性 tag 备份)
        // `--list-unbacked`:把**本次要拦的那一批**全量、机器可读地打出来(每行一枚完整 oid)。
        // 加它的理由是处置动作需要清单:默认只点 10 枚时,想照 §22 逐枚 tag 的人只能改脚本
        // 或重写一遍判据链(而重写的那份必然与源漂开 —— §22c 同一条理由)。
        if (isListUnbacked) {
          console.log(
            `  ${C.cyan}--list-unbacked:${win.blocking.length} 枚(完整 oid,可直接喂 git tag)${C.reset}`,
          )
          for (const c of win.blocking) console.log(c)
        } else {
          for (const c of win.blocking.slice(0, 10)) {
            const subj = gitText(['log', '-1', '--format=%s', c], { allowFail: true }) || ''
            console.log(
              `  ${C.yellow}   ↳ 未备份:${C.cyan}${c.slice(0, SHORT_HASH_LEN)}${C.reset} ${C.dim}${subj.slice(0, 80)}${C.reset}`,
            )
          }
          if (win.blocking.length > 10)
            console.log(`  ${C.dim}   ↳ …另有 ${win.blocking.length - 10} 个未显示${C.reset}`)
        }
        blocking = true
      } else if (win.outOfWeek.length > 0) {
        // 窗维把整批都判成超窗 ⇒ 不是"没风险",是"这一档不由提交链拦"。必须留一行可见结论,
        // 否则下一个会话读到的就是"门绿了",而近万枚存量在账面上蒸发。
        issues.push(
          `${win.outOfWeek.length} 个未 tag 备份的悬空 commit 全部超出 ${winDim.days} 天窗` +
            `(§29 人工 GC 存量,默认档只报数;问责 --strict / 全量 --window-days 0)`,
        )
      } else if (unreachable.length > 0) {
        issues.push(`${unreachable.length} 个悬空 commit 已全部 tag 备份(防止 git gc 清理)`)
      }
      // `--list-out-of-window`:超窗那一批的机器可读名单(每行一枚完整 oid,与 --list-unbacked 同形,
      // 所以调用方一份解析器就够)。加它的理由不是补功能,而是补一个**结构空档**:超窗存量按设计
      // 不由提交链拦 ⇒ 门只打印"9785 枚 + 最老一枚",谁想照 §29 做人工 GC 就只能自己重算窗口,
      // 而重算的那份必然与本门漂开(§22c 同一条理由)。名单不得只存在于人读行里。
      // 刻意放在 if/else 链**之外**:窗内有债时超窗名单同样要能取到,否则两个桶互相遮蔽。
      if (isListOutOfWindow) {
        console.log(
          `  ${C.cyan}--list-out-of-window:${win.outOfWeek.length} 枚(完整 oid,§29 人工 GC 候选)${C.reset}`,
        )
        for (const o of win.outOfWeek) console.log(o.hash)
      }
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
    console.log(`  ${C.green}✅ ${GREEN_MARKERS.noRisk}${C.reset}`)
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

/**
 * 致命分支的**唯一**出口。原先这里写的是 `main().catch(…)`,而 `main()` 是**同步**函数
 * (返回 undefined,不是 promise)—— `main()` 在求值过程中就把异常抛了出来,`.catch` 那个属性
 * 访问压根没机会执行 ⇒ 这道兜底是**死代码**,任何"取材失败"都会以 Node 默认的未捕获异常
 * 形态落地(exit 1 + 裸栈)。实测 2026-10-03:fsck 取不到时门报 exit 1 而非约定的 2。
 * 同步函数只能用 try/catch 接。
 * 2026-10-07 §22d:`main()` 改为 async 后 `.catch` 才真的能接住 ⇒ 入口守卫用它接本函数,
 * 兜底行为**逐字不变**(Undetermined → exit 2,其它异常 → 打栈 + exit 2);本函数的
 * 判定与输出没动一行 —— 它仍是致命分支的唯一出口。
 */
function onFatal(e) {
  /**
   * `Undetermined` = **没判完**,不是"判完判红"。这两种都必须 exit 2 而不是 1(§12e):
   * 1 会被调用方读成"本门检出了违规",而真实结论是"没看到";混同二者等于把不可判定
   * 伪装成已生效的守卫。理由与 `check-api-routes.mjs` 的 uncaughtException 兜底同源。
   *
   * 本门必须接住它:否则 `listUnreachableHashes` 抛出的 `Undetermined` 会冒到最底,
   * 打印成「❌ 脚本执行异常」—— 那行文案只说"脚本炸了",不说"守门没判成",
   * 下一个会话会照着"脚本 bug"去查,而不是照着"取不到"去查。
   * 且默认(非 blocking)模式下**根本不会红**,一次判据失效就静悄悄放行 = 本票要治的病。
   */
  if (e instanceof Undetermined) {
    console.error(`${C.red}❌ 无法判定(不是"没有丢失风险",是"没判成")${C.reset}`)
    console.error(`   ${e.message}`)
    console.error(
      `   ${C.dim}这不允许记绿:不可判定 ≠ 通过。恢复 git 后重跑,或用 HUSKY_SKIP_COMMIT_LOSS_CHECK=1 紧急跳过(不推荐)${C.reset}`,
    )
    process.exit(2)
  }
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
}

/**
 * §22d 入口守卫。
 * 比较用 `pathToFileURL(process.argv[1]).href`,**不能**做字符串等号:Windows 下 argv[1]
 * 可能是反斜杠绝对路径,也可能是 runner 传的相对路径(`scripts/<x>.mjs`),
 * 而 pathToFileURL 会按 process.cwd() 归一成 `file:///G:/…` 形态 —— 与 import.meta.url 同形。
 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      // main() 的每条出口都自己 process.exit(0/1),正常不会走到这里;
      // 保留数值出口,是为了判据将来改成 return code 时不必再动入口守卫(§22d 同族写法)。
      // 真走到这里时 code=undefined ⇒ process.exit(undefined) 沿用当前 exitCode(0),
      // 与旧写法"同步跑到文件末尾自然退出"同值,不是新增语义。
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      // 与原先那条 `try { main() } catch (e) { onFatal(e) }` **逐字同一**的兜底:
      // Undetermined ⇒ exit 2「无法判定」(不得折成 1);其它异常 ⇒ 打栈 + exit 2。
      onFatal(e)
    })
}

/**
 * §22c 唯一出口:把本门的**判定单元**导出给镜像测试,免得测试各抄一份正则/分类逻辑
 * (抄的那份不与源同步,漂移后测试仍绿 —— 而"判据失效的表现永远是安静")。
 * 刻意放在入口守卫**之后**,且只导纯函数与常量:任何 git 派生都不在这里发生。
 * 那条"空壳 tag"提示常量没进这个清单:守门 30a 的配对用例(见
 * scripts/tests/check-commit-loss-guard-hint.test.mjs)断的是**源文件里那个标识符的出现次数**
 * 必须等于两处 warn(漏一处就等于没说),在这里多引用一处就会把那条用例改红 —— 而它红了
 * 读起来像"配对缺口",不是"导出面加了个键"。
 */
export const __test__ = {
  // 豁免 / 档位名常量
  SKIP_ENV,
  FLAGS,
  REMOTE_TIMEOUT_MS,
  LOCAL_GIT_TIMEOUT_MS,
  SPAWN_DEFAULT_TIMEOUT_MS,
  // 输出侧唯一文案与展示宽度(stdout 判读用,不得由测试另抄一份)
  GREEN_MARKERS,
  SHORT_HASH_LEN,
  // reflog 行解析
  RESET_LINE_RE,
  isResetReflogLine,
  reflogLineSourceHash,
  dropBackedResets,
  // 悬空 commit 分类
  UNREACHABLE_COMMIT_PREFIX,
  UNREACHABLE_COMMIT_LINE_RE,
  parseUnreachableCommitLines,
  parseTreeSubjectIndex,
  // 时间窗量纲(2026-10-11):判据、取值、派生出口三者都必须可被测试直接消费,
  // 免得镜像那边再抄一份"cutoff = now - days*86400"的算术 —— 抄的那份不与源同步。
  WINDOW_DAYS_DEFAULT,
  WINDOW_DAYS_ENV,
  WINDOW_DAYS_FLAG,
  DATE_WALK_BATCH,
  parseCommitterDateLines,
  resolveWindowDays,
  splitUnbackedByWindow,
  isStashSubject,
  extractOriginalHashFromStash,
  // tag 可达性 / 集合比对读取
  parseRemoteTagOutput,
  parseForEachRefTagInfo,
  buildTagReachability,
  collectBackupCommitHashes,
  compareTagSets,
  // 展示层的截断规则("仅本地 N 个"那两句 warn 的形态)
  briefList,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
