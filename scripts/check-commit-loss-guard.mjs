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
 *   2b. 未备份悬空 commit 的放行判据(2026-11-04 改):**逐路径 blob 覆盖** ——
 *       相对 parent 的每一条改动路径,其 blob 必须能在可达面(refs 面 / reflog 面)的
 *       **同一路径**上找到逐字同的 blob;新增路径不得用"同内容别处文件名"顶替;
 *       删除路径必须见到可达面里该路径的**最新一次改动就是删除、且删的是同一个 old blob**
 *       (不能只看 HEAD,也不能拿更早的删除记录为新的删除意图作证 —— 见 splitByPathCoverage
 *       头注的"删→重建→再删"搭便车案例)。少一条路径 ⇒ 判红。
 *       同秒并列(并列的两条可达改动状态不同,或都是删但 old blob 不同)⇒ "最新"不存在:
 *       实测 git log --all 的第一条会随 ref 名翻转(夹具反例),不能拿先到者冒充最新 ⇒
 *       **未判定 → exit 2**(不打印通过句、不写结论缓存);同秒且结论相同仍按先到者。
 *       原「整树逐字相等」判据只是本判据的特例,对并发夹带导致的"树不同但内容全在"永不命中。
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
 *      → **该档默认不发网络**(提交链不付 ls-remote 代价);显式发起(IHUI_COMMIT_LOSS_REMOTE=1)
 *        却失败/超时 = **未判定** → exit 2,不得计为通过(2026-11-04 改;原为"安全降级跳过")
 *   5. 综合判定(reflog reset / 未备份悬空 commit / 远端 tag 缺失 / tag 对象不可达 /
 *      显式发起的远程档未判定)
 *
 * 退出码:
 *   0 — 通过(warn 告警可被忽略,但 stdout 仍打印提示)
 *   1 — blocking/strict 模式下有阻塞项(reflog reset / 未备份悬空 commit /
 *        远端 tag 缺失需 fetch / tag 对象不可达)
 *   2 — **无法判定**:判据面取不到(典型:fsck 派生不出来 / 超时 / 仓不可达 /
 *        显式发起的 ls-remote 失败或超时)。
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
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  batchExecFileSync,
  catBatchOids,
  gitBinary,
  gitErrText,
  gitRaw,
  Undetermined,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

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

/** 自检入口旗标与脚本自身路径(自检必须**以子进程**再跑一遍本门才能拿到真实 exit 码)。 */
const SELF_TEST_FLAG = '--self-test'
const SELF_PATH = fileURLToPath(import.meta.url)

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

/**
 * L11052 / G-1080898(2026-10-14 拍板):超 30 天窗悬空对象存量水位基线。
 * 决策 = 不 GC(§29 禁自动批量删);本基线把拍板日的存量读数记为账面水位,
 * 此后超窗报数行再出现非零读数即「超基线」点名上报(只报数,不新增判红)。
 * 拍板日现读:超窗存量 0 枚(票面 9785 枚已被 lost-commit/* + backup/* tag 备份链清空)。
 */
const DANGLING_STOCK_BASELINE = Object.freeze({
  ticket: 'G-1080898',
  decided: '2026-10-14',
  policy: 'no-auto-gc',
  count: 0,
  oldest: '',
})

/**
 * L11052:基线对照纯函数。超基线 = 现读 > 基线 count。
 * 返回 'under' | 'over';基线语义只在超窗报数行出现时对照,不改 exit code。
 */
function baselineVerdict(currentCount) {
  return currentCount > DANGLING_STOCK_BASELINE.count ? 'over' : 'under'
}
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
// 2026-10-12 提速:原两族各发一次 ls-remote × 15s,本机网络下两趟**都正好撞满 15s 超时**
// (单趟实测 21~27s,7968 条 ref),于是每枚提交固定白烧 30s 且远程校验从不生效。
// 现改为一次 ls-remote 带两个 pattern,并加 `--refs` + `protocol.version=2` 两件套
// (peel 行 1004 条直接不传,等价证明见 remoteTagScan 内注释)。上限取 60s 而非 30s:
// 空载实测 19~21s,但门跑在并行提交链上,同参复现到过 29.9s —— 30s 会让校验间歇性降级
// (治的正是"从不生效"),60s 装得下负载下的真实往返;网络真挂时下限仍是安全降级跳过。
const REMOTE_TIMEOUT_MS = 60_000
/** 远端 tag 扫描成功结果的落盘缓存期(毫秒):期间重复提交直接复用,不再发网络请求 */
const REMOTE_SCAN_CACHE_TTL_OK_MS = 10 * 60_000
/** 扫描失败/超时同样落盘:网络挂掉时不再每 2 分钟重踩一次(2026-10-21:2min → 30min)。
 *  本机 GitHub 直连被墙,单次失败实测要付 ~295s(Windows 上 timeout 杀不干净孙进程);
 *  失败面 30 分钟复探一次足够 —— 远端 tag 缺失是"天级"变化,不是"分钟级"变化。 */
const REMOTE_SCAN_CACHE_TTL_FAIL_MS = 30 * 60_000
/**
 * 缓存文件路径(只放 git 不跟踪的 .git 内;夹具仓 cwd 不同 ⇒ 各仓各一份,互不串)。
 *
 * 刻意用 **cwd 相对**而不是 `join(ROOT, …)`:这份 JSON 是 `.git` 下的机器态缓存,
 * 不是被判定的仓库内容,取它不需要、也不该走"HEAD/索引 blob"取材面 —— 门 118
 * (check-gate-face-discipline)给的正是这条出路:"判的不是仓库内容 ⇒ 改成不读 ROOT 锚点"。
 * 本门 `ROOT = process.cwd()`(见上),所以两种写法运行时指向同一个文件,行为零差。
 */
/**
 * 真实 gitdir(2026-10-21 立)。本仓 `.git` 是 **gitfile**(内容 `gitdir: D:/IHUI-AI-git-repo`),
 * 不是目录 —— `join('.git','x.json')` 写盘必 ENOTDIR,而两处缓存都把这个异常吞了,于是
 * "缓存从没生效"被写成"缓存命中率低":实测 remote tag 扫描缓存自建立起一直静默失败,
 * 每枚提交都重发一次 ls-remote。这里按 gitfile 解析出真实目录。
 */
const realGitDir = () => {
  const dotGit = join(process.cwd(), '.git')
  try {
    if (statSync(dotGit).isDirectory()) return dotGit
    const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m)
    if (m && m[1]) return m[1].trim()
  } catch {
    /* 取不到 ⇒ 退回字面路径(与旧行为一致,不会因此改变判据) */
  }
  return dotGit
}
const remoteScanCachePath = () => join(realGitDir(), 'ihui-remote-tag-scan.json')
// 本地 git 命令(批量 subject 获取)限时,防单次调用异常挂起
const LOCAL_GIT_TIMEOUT_MS = 10_000

// ── 分段计时探针(2026-10-30)──────────────────────────────────────────────
// 立因:门 30a 反复"修完还是慢",前三次改动都没治到根 —— 因为没有一处能回答
// "这 9 分钟到底花在哪"。此前的诊断全靠手工插桩再撤销,插桩一撤就再也回不去。
// 这里把探针固化成常驻能力:`IHUI_LOSS_TIMING=1` 时每过一个阶段打一行 `[t+ <ms>] <标签>`,
// 关闭时零输出、零开销(只多一次布尔判断)。读数即归因,不再靠猜。
// 归一化口径:**时间戳是自进程启动起的毫秒数**,不是相邻两段的差值 —— 差值要人脑算,
// 而"哪一段最大"往往与直觉相反(实测 filterStashLike 曾占 84/380 秒却长期没人怀疑它)。
const TIMING_ON = process.env.IHUI_LOSS_TIMING === '1'
const TIMING_T0 = Date.now()
function mark(label) {
  if (!TIMING_ON) return
  console.log(`  [t+${String(Date.now() - TIMING_T0).padStart(6)}ms] ${label}`)
}
/** 旧 `runGit()`(spawnSync 通道)的默认上限;层默认 60s,这里显式保住原值,免得迁移改了失败时机 */
const SPAWN_DEFAULT_TIMEOUT_MS = 120_000

/**
 * 逐路径覆盖取材的 git 上限(2026-11-04)。
 * 本仓实测:21 条路径的 `git log --all --raw` 约 12s;reflog 面(`git log -g`)走查约 55s。
 * 上限取 180s 而不是 LOCAL_GIT_TIMEOUT_MS(10s):这是**全历史**走查,与"批量取 subject"不同量级;
 * 超时 ⇒ 调用方按"未覆盖"判红(fail-closed),绝不静默放行。
 */
const PATH_COVERAGE_TIMEOUT_MS = 180_000
/** 一次 argv 里放多少路径字符(Windows CreateProcess 上限约 32KB;留一半余量)。 */
const PATHSPEC_ARGV_BUDGET = 16_000
/**
 * 缓存判据面版本:判据本体变化 ⇒ 旧缓存件不可复用(否则修复后仍被旧红结论卡住 ≤30min)。
 * 2026-11-04 升到 2:D 类判据从"任意删除记录"收紧为"old blob 相同 且 是该路径最新状态",
 * 旧缓存件里的绿结论是按宽判据得出的,不得复用。
 * 同日再升到 3:同秒并列(取谁都会改变 D 判定)改判「未判定 → exit 2」,旧缓存里的绿结论
 * 可能是拿"git log 先到者"冒充"最新"得出的,同样不得复用。
 */
const COVERAGE_FACE_VERSION = 3
/**
 * `git diff-tree --raw -z` / `git log --raw -z` 的单条记录头:
 * `:<oldmode> <newmode> <oldsha> <newsha> <status>`,其后紧跟 NUL + 路径 + NUL。
 * status 只取首字符(A/M/D/T 等);未开 rename detection ⇒ 不会出现 R/C。
 */
const RAW_DIFF_ENTRY_RE = /^:(\d{6}) (\d{6}) ([0-9a-f]{40}) ([0-9a-f]{40}) ([A-Z][0-9]*)$/
/** `git log --raw` 里 commit 段的前缀(与 --format 唯一源头绑定)。 */
const RAW_COMMIT_MARKER = 'IHUI:'

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
/**
 * 「仅远端有、本地缺」的自愈节流(2026-10-30 立)。
 *
 * 这一档**不影响任何安全属性**:tag 在远端留着,对应 commit 就不可能被 gc;
 * 本地缺一份副本只是少一个冗余,没有任何门据此判红(onlyRemote 只进 warn 段)。
 * 但对 26k tag 的仓,`healMissingRemoteTags` 每轮补 400 个 = 8 次网络 fetch:
 * 2026-10-30 实测本门整体 9 分 23 秒,其中 8 分钟全花在这里,而且**永远追不上**
 * (别的机器 / CI 还在推新 tag,当轮本地缺 503 个,补 400 还剩 103)。
 *
 * 于是把「补副本」从每次提交的必经路径上摘下来:状态件记上次补拉时刻,
 * 冷却窗(默认 6h)内只报一行 warn,窗过或显式 `IHUI_TAG_HEAL_COOLDOWN_MS=0` 才真补。
 * 判定语义一字未改:onlyRemote 本来就不 blocking,这里只决定"要不要顺手补一份"。
 */
const HEAL_COOLDOWN_MS = Number(
  process.env.IHUI_TAG_HEAL_COOLDOWN_MS === undefined
    ? 6 * 3600_000
    : process.env.IHUI_TAG_HEAL_COOLDOWN_MS,
)
const HEAL_STATE_FILE = join(ROOT, '.ihui-agent/state/commit-loss-heal.json')

/** 冷却窗内 ⇒ true(跳过补拉)。状态件读不到按"从未补过"处理(fail-open:补一次无害)。 */
function healCoolingDown() {
  if (!Number.isFinite(HEAL_COOLDOWN_MS) || HEAL_COOLDOWN_MS <= 0) return false
  try {
    const st = JSON.parse(readFileSync(HEAL_STATE_FILE, 'utf8'))
    return Date.now() - (Number(st.lastHealAt) || 0) < HEAL_COOLDOWN_MS
  } catch {
    return false
  }
}

/** 补拉完成后落状态件;**只在真的 fetch 过之后写**,免得"没补"被记成"补过"。 */
function noteHealDone(fetchedCount) {
  try {
    mkdirSync(dirname(HEAL_STATE_FILE), { recursive: true })
    writeFileSync(
      HEAL_STATE_FILE,
      JSON.stringify({ lastHealAt: Date.now(), fetched: fetchedCount }) + '\n',
      'utf8',
    )
  } catch {
    /* 状态件写不进去只会让下一轮再补一次,不影响判定 */
  }
}

function healMissingRemoteTags(names) {
  // 批宽 50 → 20、单批超时 60s → 180s(2026-10-30 实测校准):
  // 每批 50 个 refspec 的 fetch 在 ssh://ssh.github.com:443 上会整批超时 ⇒ fetched=0 ⇒
  // 旧代码不写状态件 ⇒ 冷却窗永不生效 ⇒ 每轮再付一次完整超时(实测把本门拖到 9 分钟)。
  // 单 tag fetch 实测 <60s 成功,所以不是"拉不动",是**一批塞太多**。
  const CHUNK = 20
  const MAX = Number(process.env.IHUI_TAG_HEAL_MAX || 400)
  const TIMEOUT = Number(process.env.IHUI_TAG_HEAL_TIMEOUT_MS || 180_000)
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
 * reflog 行的 ref 名(`HEAD@{}` / `refs/heads/main@{}` / `worktrees/x/HEAD@{}` → 前者)。
 * 用来把 reset 行与"同 ref 更旧一条"配对 —— 后者才是被 reset 丢掉的那枚。
 */
function reflogRefOf(line) {
  const m = String(line || '')
    .trim()
    .match(/^\S+\s+(\S+?)@\{/)
  return m ? m[1] : ''
}

/**
 * 2026-09-04 修复:若 reset 丢掉的 commit 已被 lost-commit/* tag 备份,则放行。
 * 2026-10-21 更正:此前只看行首 hash(= **reset 之后**的 HEAD),而被丢的那一枚在 reflog 里
 * 根本不在这一行 —— 实测把"丢了 A、A 已 tag"判成未备份(恒红,§12e),同时可能把"丢了 A、
 * 只有 reset 后的 HEAD 恰好被 tag"误放过。现在两枚都看:
 *   ① beforeHashOf(line) = 同 ref 更旧一条 reflog 的 hash(真正被丢的那枚);
 *   ② 行首 hash(保留旧行为,不把既有已放行样本翻红)。
 * 任一被备份 ⇒ 放行;两枚都取不到 ⇒ 保守判"未备份"。
 * 前缀匹配是双向的(git 可能输出短 hash,tag 名里可能带短 hash)。
 */
function dropBackedResets(resets, backedHashes, beforeHashOf = () => '') {
  return resets.filter((line) => {
    const candidates = [beforeHashOf(line), reflogLineSourceHash(line)].filter(Boolean)
    if (candidates.length === 0) return true
    for (const srcHash of candidates) {
      for (const h of backedHashes) if (h.startsWith(srcHash) || srcHash.startsWith(h)) return false
    }
    return true
  })
}

// ── 结论缓存(2026-10-21 立,只为把提交链从 2~5 分钟压到秒级)──────────────────────
// 本门判的全是**仓库状态**(reset 历史 / 悬空 commit / tag 备份完整性),不是本次提交内容;
// 而本仓现读悬空 commit 18,448 枚、lost-commit tag 24,404 枚,全量复核实测 2~5 分钟,
// 期间 CPU 仅 1s —— 时间全花在逐枚 git 派生上,占提交链 40% 以上。
// 这些集合只由 reset / stash / gc 驱动,分钟级不动 ⇒ 按 (HEAD 未变 + TTL 30min) 复用结论。
// 命中即秒回,并**打印复用了几分钟前的结论**,不把"复用"写成"刚判过"。
// 失效方向:TTL 内新增的悬空 commit 本门看不见 —— 由 IHUI-GIT-GUARD 巡检与 post-commit 的
// lost-commit tag 同步兜底;要当场重算:IHUI_COMMIT_LOSS_NO_CACHE=1。
const LOSS_CACHE_TTL_MS = 30 * 60_000
const lossCachePath = () => join(realGitDir(), 'ihui-commit-loss-cache.json')
function currentHeadSha() {
  return gitText(['rev-parse', 'HEAD'], { allowFail: true })
}
/**
 * 缓存的**判定输入面** —— 只有这一组取值逐字相同的旧结论才可以复用。
 *
 * 立因(2026-10-30,由端到端用例 #42/#43 逼出来):原缓存只按 (isBlocking + TTL) 复用,
 * 完全不看本轮用的是哪个**判据档**。于是同一面墙下:
 *   - `--window-days 0`(全量档,safe-gc 的破坏性前置就靠它)拿到的却是默认 30 天窗的**绿结论**;
 *   - `--strict`(问责存量档)同样被默认档的绿结论顶掉;
 *   - `--list-unbacked` / `--list-out-of-window` 更是直接 `process.exit`,连名单都打不出来。
 * 这不是"缓存不准",是**同一道门在不同判据下给同一个答案** —— 判据被缓存吃掉了。
 * 判据档是命令行给定的确定输入,不是仓库状态,所以它必须进键;名单出口本来就不是结论,
 * 一律现算(见 readLossCache 的 isList* 早退)。
 */
// 判据档在 `main()` 里才解析出来(winDim 依赖 flag/env 合并),而缓存读写发生在 module 级
// 函数里 ⇒ 用一次显式登记把"本轮判据面"递进去。未登记时返回 null ⇒ 任何缓存都不复用
// (宁算一遍),这是唯一安全的缺省方向。
/**
 * 备份 tag 集合的指纹(缓存新鲜度的**唯一**状态输入)。
 *
 * 为什么必须是集合指纹而不是条数:条数会撞(add 一枚 + del 一枚 = 条数不变)。虽然本仓
 * 这种巧合概率极低,但缓存失效方向错了就是"把处置过的读成没处置"或反之 —— 前者卡死提交,
 * 后者放走真丢的东西。指纹取 64 位足够:它只需要区分"两轮之间有没有动过",不做安全用途。
 * 排序后 join 再哈希:git 的输出顺序不保证稳定(松散 ref 与 packed-refs 混排)。
 */
function backupTagFingerprint(lostTags, backups) {
  const joined = [...lostTags, ...backups].sort().join('\n')
  return createHash('sha256').update(joined).digest('hex').slice(0, 16)
}

let LOSS_CACHE_FACE = null
function setLossCacheFace(face) {
  LOSS_CACHE_FACE = face
}
function lossCacheFace() {
  return LOSS_CACHE_FACE
}

function readLossCache() {
  // 只在 blocking 档(提交链)复用;手动查询档(--list-* / --fetch)一律现算,避免给人旧数。
  if (!isBlocking || process.env.IHUI_COMMIT_LOSS_NO_CACHE === '1') return null
  // 名单出口的产物是**名单**,不是结论:缓存里没有名单,命中即等于把名单吞掉。
  if (isListUnbacked || isListOutOfWindow) return null
  // 显式要看远程时,缓存里的结论只覆盖本地面(那次的远端档可能压根没跑/没判成)
  // ⇒ 必须现算,不得拿旧结论替远程档作证(2026-11-04)。
  if (process.env.IHUI_COMMIT_LOSS_REMOTE === '1') return null
  try {
    const j = JSON.parse(readFileSync(lossCachePath(), 'utf8'))
    if (!j || typeof j.ts !== 'number' || typeof j.blocking !== 'boolean') return null
    // 刻意**不**把 HEAD 纳入 key(2026-10-21):提交本身不改变悬空集合,而每枚提交都推进 HEAD
    // ⇒ 拿 HEAD 当 key 等于"缓存永不命中"(第一版就是这么写的,实测首跑 231s 后第二次仍全量)。
    // 悬空集合只由 reset / stash / gc 驱动,用 TTL 控新鲜度即可。
    if (Date.now() - j.ts > LOSS_CACHE_TTL_MS) return null
    // 判定档变了 ⇒ 旧结论不可复用。缺失 face 的旧版缓存件同样不可复用(宁算一遍)。
    const face = lossCacheFace()
    if (!face) return null
    if (!j.face || j.face.windowDays !== face.windowDays) return null
    if (j.face.strict !== face.strict) return null
    if (j.face.filterStash !== face.filterStash) return null
    if (j.face.tagFingerprint !== face.tagFingerprint) return null
    // 判据本体版本:改造后旧缓存件里的"红/绿"都是旧判据的结论,不得顶掉本轮重算。
    if (j.face.coverageVersion !== face.coverageVersion) return null
    return j
  } catch {
    /* 无缓存/损坏/过期 ⇒ 正常全量算,读失败绝不影响判据 */
  }
  return null
}
function writeLossCache(obj) {
  if (!isBlocking || process.env.IHUI_COMMIT_LOSS_NO_CACHE === '1') return
  try {
    writeFileSync(lossCachePath(), JSON.stringify({ ...obj, face: lossCacheFace() }))
  } catch {
    /* 写不进去只是下次重算,不影响本次判定 */
  }
}

function detectResets(reachability) {
  // reflog 最近 50 步(每行包含: hash | ref@{} | action: subject)
  // 2026-07-26 升级:从 20 步扩到 50 步,覆盖更长期的 reset 历史
  // ⚠️ 2026-10-21 收面:`--all -n 50` 不是"总共 50 条",而是**每个 ref 各 50 条** ——
  // 本仓有 24,404 枚 lost-commit/backup tag,于是这条命令要读几万条 reflog(实测单独跑
  // 14.3s 且还没读全;门内不 head 直接读完,是 30a 单轮 295s 的主要份额)。
  // reset 是"当前分支被回退"的操作,HEAD reflog 完整覆盖它;其他分支的 reset 属**仓库状态**,
  // 按 §12e 不该 blocking 本次提交。真要全 ref 审视,走手动 `--strict` 或 git-guardian 巡检。
  const out = gitText(['reflog', '--date=iso', '-n', '50'], { allowFail: true })
  if (!out) return []
  const lines = out.split('\n')
  const resets = []
  for (const line of lines) {
    // 匹配 "reset: moving to HEAD~" / "reset: moving to HEAD@{1}" 等
    if (isResetReflogLine(line)) {
      resets.push(line)
    }
  }
  // 2026-10-30:原来这里自己又跑了一遍 `verifyAllTagReachability(listLostCommitTags())` ——
  // 与 main 里那次完全同一份输入、同一份结果,纯粹是把 26k tag 扫两遍。改由调用方把已经
  // 算好的那份递进来(见 detectResets 签名)。判据一字未改:backedHashes 仍取每枚 tag 的
  // (peeled || obj),仍只用于"被 reset 丢掉的那枚是否已备份"这一问。
  const backedHashes = new Set(reachability.map((r) => r.hash).filter(Boolean))
  // 被 reset 丢掉的那枚 = 同 ref 更旧一条 reflog 的行首 hash(列表是新→旧)。
  const beforeByLine = new Map()
  for (let i = 0; i < lines.length; i++) {
    if (!isResetReflogLine(lines[i])) continue
    const ref = reflogRefOf(lines[i])
    const older = lines.slice(i + 1).find((l) => reflogRefOf(l) === ref)
    if (older) beforeByLine.set(lines[i], reflogLineSourceHash(older))
  }
  return dropBackedResets(resets, backedHashes, (line) => beforeByLine.get(line) || '')
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
 * 「树 \t 题」键集 → **可达树集**(纯函数,派生自同一份 `git log --all` 读数,不二次派生 git)。
 *
 * 用途:门 30a 的同内容残留分档(2026-11-03 补细)。键集里每行形如 `<40位树>\t<题>`,
 * 树 hash 长度固定,取 `\t` 前那段即树。取不到索引时由调用方传空集 ⇒ 该档不生效(fail-safe 朝红)。
 */
function reachableTreeSet(keys) {
  const trees = new Set()
  for (const k of keys ?? []) {
    const t = k.indexOf('\t')
    if (t > 0) trees.add(k.slice(0, t))
  }
  return trees
}

/**
 * 同内容残留三档(纯函数,2026-11-03 立;门 30a 判据补细的唯一实现)。
 *
 * 立因:2026-11-03 实测门 30a 报「悬空 commit 未备份」时,存量 8 枚里 0 枚是真丢失 ——
 * 7 枚已被 `lost-commit/auto-*` 打签(见 `backup-unreachable-commits.mjs`),剩 1 枚
 * (`31bfb9a335c2`,rn-tiers 落档被 amend 换下来的旧对象)的 **tree 与 HEAD 逐字同**
 * (`a8b7049e4005`),只是当时**题也恰好同**,才被 ③(树+题)放行。题被 rebase/amend 改过一字,
 * 同一枚"内容一字节没丢"的对象就会判红 —— 这是判据侧的一格假阳,不是真风险。
 * 故把「放行」拆成两档并**各自点名**:
 *   ① `sameContent`  树+题同时与可达历史逐字同(原 ③,判据不变);
 *   ② `treeEquivalent` 树与可达提交逐字同、题不同 ⇒ 内容整体已入库,仅提交身份/题未入库;
 *      gc 吃掉它不丢任何**文件内容**(丢的是一句 commit message,属元数据,不属工作)。
 *
 * 两档都不 blocking,但都**不静默**(调用方必须逐档报数点名);`remaining` 才是待处置。
 * 索引取不到(reachableKeys 为空 / treeByCommit 无该项)⇒ 一律落 `remaining`(朝红 fail-safe)。
 */
function splitReachableSameContent({
  candidates = [],
  treeByCommit = new Map(),
  subjectByHash = new Map(),
  reachableKeys = new Set(),
  reachableTrees = new Set(),
} = {}) {
  const sameContent = []
  const treeEquivalent = []
  const remaining = []
  for (const c of candidates) {
    const tree = treeByCommit.get(c)
    const subject = subjectByHash.get(c)
    if (tree && subject && reachableKeys.has(`${tree}\t${subject}`)) {
      sameContent.push(c)
      continue
    }
    // 树等价只认"树确实在可达提交里":tree 映射取不到 ⇒ 不得按等价放行
    if (tree && reachableTrees.has(tree)) {
      treeEquivalent.push(c)
      continue
    }
    remaining.push(c)
  }
  return { sameContent, treeEquivalent, remaining }
}

/**
 * raw diff 输出解析(**纯函数**,2026-11-04;逐路径覆盖判据的唯一解析出口)。
 *
 * 两处调用共享同一份字节形态:
 *   ① `git diff-tree --no-commit-id -r -z --raw --root --no-renames <commit>`(单提交相对 parent);
 *   ② `git log … --raw -z --no-renames --root --format=IHUI:%H:%ct -- <paths>`(可达面历史);
 * 用 `withCommit` 区分:② 的 commit 段以 `IHUI:` 开头,形如 `IHUI:<40hex>:<committer-unix>`,
 * `-z` 让每条记录被 NUL 切成 `[commit]\0\0:<meta> <status>\0<path>\0…`。空段(分隔残留)跳过。
 *
 * 每条记录保留 **old sha**(`oldBlob`):D 类判据要证明"删的确实是同一内容"—— 只凭
 * "该路径在某个可达提交里不存在"会被"删→重建→再删"里的旧删除记录搭便车(详见
 * splitByPathCoverage 头注)。old sha 全零(A / root)折成空串。
 *
 * 解析失败必须**抛**:调用方以此把该面判成"取不到"→ 朝红,绝不能把半截输出读成"没有改动"。
 */
function parseRawDiffZ(stdout, { withCommit = false } = {}) {
  const tokens = String(stdout ?? '').split('\0')
  const entries = []
  let commit = ''
  let ct = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].replace(/\r?\n/g, '')
    if (!token) continue
    if (withCommit && token.startsWith(RAW_COMMIT_MARKER)) {
      const body = token.slice(RAW_COMMIT_MARKER.length).trim()
      const parts = body.split(':')
      if (parts.length !== 2 || !/^[0-9a-f]{40}$/.test(parts[0]) || !/^\d+$/.test(parts[1]))
        throw new Error(`raw 日志的 commit 段非法:${token.slice(0, 60)}`)
      commit = parts[0]
      ct = Number(parts[1])
      continue
    }
    if (!token.startsWith(':')) continue
    const m = RAW_DIFF_ENTRY_RE.exec(token)
    if (!m) throw new Error(`raw diff 头无法解析:${token.slice(0, 80)}`)
    const path = tokens[i + 1]
    if (path === undefined) throw new Error('raw diff 缺路径段(输出被截断?)')
    if (withCommit && path.startsWith(RAW_COMMIT_MARKER))
      throw new Error('raw diff 路径段错位(commit 段丢失)')
    i += 1
    entries.push({
      commit,
      ct,
      status: m[5][0],
      blob: m[4],
      oldBlob: /^0+$/.test(m[3]) ? '' : m[3],
      path,
    })
  }
  return entries
}

/**
 * 逐路径覆盖分档(**纯函数**,2026-11-04;门 30a 放行判据的唯一实现)。
 *
 * 判据(取代原「整树逐字相等」):对悬空提交相对其 parent 的**每一个改动路径**——
 *   - A/M/T(路径存在):该提交在该路径上的 blob 必须能在**某个可达提交**(refs 面或 reflog 面)
 *     的**同一路径**上找到逐字同的 blob。少一条路径 ⇒ 不放行。
 *   - D(路径被删除):**两条同时成立**才放行 ——
 *     ① 可达面里该路径的**最新一次改动**是一条删除记录(不是"存在"的 A/M/T);
 *     ② 该删除记录的 **old blob 与本次 D 记录的 old blob 逐字相同**。
 *     不再只看"某个可达提交里该路径不存在"(2026-11-04 收紧,缘由见下)。
 *     也不是只看 "HEAD 没有":HEAD 可能被别的会话复活,所以取的是整条可达面历史。
 * 刻意**不做路径级豁免**:任何 `startsWith`/扩展名白名单都会把"未覆盖"读成"已覆盖"。
 *
 * 为什么 D 不能只要求"某个可达提交里该路径不存在"(2026-11-04 收紧):
 *   旧判据下,可达面只要有**任意一条**该路径的删除记录,本次删除就被"作证"。具体假阴性:
 *   T1 删 P(留下删除记录) → T2 重建 P → 悬空枚 T3 又删 P。此时 T1 的旧记录会给 T3 的新
 *   删除意图作证,而 T3 删掉的那份内容**可能从未在可达面出现过**(它来自 T2 重建后的版本),
 *   等于放行了一处真实删除损失。收紧后两条都必须成立,各自挡住一半:
 *   - 只查 old blob 不够:T2 可能重建出**同内容**的 P,T3 删它时 old blob 与 T1 的旧记录相同,
 *     但"该路径已被 T2 重新落地、删除这件事可达面还没做过"⇒ 删除仍是新决定,须判红;
 *   - 只查"最新是删除"也不够:T3 删的可能是 T2 重建出的**另一份内容**(old blob 不同),
 *     那版内容从未进过可达面 ⇒ 删它同样是新决定,须判红。
 *   两条一起,才等价于"这次删除在可达历史里已经原样发生过,且之后没有任何改动把它撤销或改写"。
 *   判法上没有引入路径白名单,也不是"一律判红"(合法删除仍能凭最新那条同内容删除记录放行)。
 *
 * 为什么不是"整树相等":并发提交夹带会让悬空提交的树与任何可达提交都不同,即便它的每条路径
 * 内容都已在可达面(2026-11-04 实测 4 枚悬空全部如此形态)—— 整树判据对它们永不命中。
 *
 * 证据逐条保留(路径 / blob / 覆盖它的可达提交 / 面来源),用于判绿时的点名与复核。
 * `entriesByCommit` 取不到(null)或改动面为空(merge/空提交)⇒ 一律落 uncovered(朝红)。
 */
function splitByPathCoverage({
  candidates = [],
  entriesByCommit = new Map(),
  coverage = new Map(),
  // 每路径**最新一次可达改动** `{commit, surface, status, oldBlob, blob, ct}`(由 derive 派生)。
  // D 类判据只认这一条:它必须是删除、且 old blob 与本次相同(见头注"搭便车"段)。
  latestByPath = new Map(),
  problemsByCommit = new Map(),
  surfaceError = '',
  // 同秒并列、取谁都会改变 D 判定的路径(derive 派生;见 absorbRawCoverage 头注)。
  // 命中这些路径的 D 改动**既不能判绿也不能判红**:判绿要靠"最新是删",而"最新"不存在。
  ambiguousPaths = new Set(),
} = {}) {
  const covered = []
  const uncovered = []
  const undetermined = []
  for (const c of candidates) {
    const entries = entriesByCommit.get(c)
    if (!entries) {
      uncovered.push({
        hash: c,
        missing: [],
        reason: problemsByCommit.get(c) || surfaceError || '逐路径覆盖面取不到',
      })
      continue
    }
    if (entries.length === 0) {
      uncovered.push({
        hash: c,
        missing: [],
        reason: '无改动路径(merge / 空提交),逐路径面无法证明覆盖',
      })
      continue
    }
    const evidence = []
    const missing = []
    const ambiguous = []
    for (const e of entries) {
      if (e.status === 'D') {
        // 同秒并列且取谁都会改变 D 判定 ⇒ "最新状态"不存在,这条删除的判定悬空。
        // 不往 missing 里塞(它不是"已判红"):整枚若没有别的真缺口 ⇒ 落 undetermined → exit 2。
        if (ambiguousPaths.has(e.path)) {
          ambiguous.push(e.path)
          continue
        }
        // 收紧后的 D 判据:只认该路径**最新那次可达改动**,且它必须删的是同一个 old blob。
        // 早于最新改动的删除记录一律不作证 —— 这正是"删→重建→再删"里旧记录搭便车的口子。
        const latest = latestByPath.get(e.path)
        let reason = ''
        if (!latest) {
          reason = surfaceError
            ? `删除意图未在可达面生效(${surfaceError})`
            : '删除意图未在可达面生效(该路径在可达面无任何改动记录)'
        } else if (latest.status !== 'D') {
          reason =
            `该路径在可达面的最新状态仍是"存在"(blob=${String(latest.blob || '').slice(0, SHORT_HASH_LEN)})` +
            ' —— 更早的删除记录不能为新删除作证'
        } else if (latest.oldBlob !== e.oldBlob) {
          reason =
            `可达面最新删除记录删的是另一份内容(old blob=${String(latest.oldBlob || '').slice(0, SHORT_HASH_LEN)}` +
            ` ≠ ${String(e.oldBlob || '').slice(0, SHORT_HASH_LEN)}) —— 旧删除不能为新删除作证`
        }
        if (reason) {
          missing.push({ path: e.path, status: 'D', blob: e.oldBlob || '', reason })
        } else {
          // 证据里的 blob 写的是"被删掉的那份内容"(= 本次的 old blob),判绿时一眼可见
          // "同一条内容在可达面也删过一次",而不是只看到"这路径有删除记录"。
          evidence.push({
            path: e.path,
            status: 'D',
            blob: e.oldBlob || '',
            commit: latest.commit,
            surface: latest.surface,
          })
        }
        continue
      }
      const hit = coverage.get(`${e.path}\0${e.blob}`)
      if (hit) {
        evidence.push({
          path: e.path,
          status: e.status,
          blob: e.blob,
          commit: hit.commit,
          surface: hit.surface,
        })
      } else {
        // 新增路径(A)的判红措辞必须点明"须同路径同 blob":仅凭"别处有同内容"不算覆盖,
        // 否则一次重命名就会被读成"内容已在"而放行(2026-11-04 判据要求②)。
        const base =
          e.status === 'A'
            ? '新增路径未被任何可达提交覆盖(须同路径同 blob)'
            : '同路径同 blob 未找到覆盖'
        missing.push({
          path: e.path,
          status: e.status,
          blob: e.blob,
          reason: surfaceError ? `${base}(${surfaceError})` : base,
        })
      }
    }
    // 证据与缺口一并向判红档返回:判红输出要能同时看到"这条已覆盖 / 这条没覆盖",
    // 否则读的人无法分辨"整枚都没覆盖"与"只差一条路径"。
    if (missing.length > 0) uncovered.push({ hash: c, missing, evidence })
    else if (ambiguous.length > 0)
      undetermined.push({
        hash: c,
        paths: ambiguous,
        reason:
          '同秒并列、且并列的两条可达改动状态不同(取谁都会改变"最新是否删除"),' +
          '"最新状态"不存在 ⇒ 该删除意图无法判定(不打印通过句、不写结论缓存)',
        evidence,
      })
    else covered.push({ hash: c, evidence })
  }
  return { covered, uncovered, undetermined }
}

/** 把路径按 argv 预算切块(`:(literal)` 前缀也计入),避免 Windows 32KB 命令行上限。 */
function chunkPathspecs(paths) {
  const chunks = []
  let cur = []
  let used = 0
  for (const p of paths) {
    const spec = `:(literal)${p}`
    if (cur.length > 0 && used + spec.length + 1 > PATHSPEC_ARGV_BUDGET) {
      chunks.push(cur)
      cur = []
      used = 0
    }
    cur.push(spec)
    used += spec.length + 1
  }
  if (cur.length > 0) chunks.push(cur)
  return chunks
}

/**
 * 单条 raw diff 记录 → 覆盖证据表 / 每路径最新可达改动表。
 * 候选自身(以及所有悬空 commit)必须排除,否则自证循环。
 *
 * `coverage`:A/M/T 的 `${path}\0${blob}` → {commit, surface}(任一同路径同 blob 命中即可)。
 * `latestByPath`:该路径**最新一次可达改动** → {commit, surface, status, oldBlob, blob, ct}。
 *   排序口径:
 *   - **同一面内**:git log 自身按提交时间倒序输出,同一路径的第一条即最新改动 ⇒ 先到者赢。
 *     这样同一秒内连续两次改动(测试与高频提交都常见)也能正确排序,不会把"时间戳并列"
 *     误判成"无法判定";后到的旧改动不得覆盖先到的新改动(防时钟回拨把旧的读成最新)。
 *
 *     **例外(2026-11-04 实测补):同秒并列且"取谁都会改变 D 判定"时,先到者不可信**。
 *     实测夹具(两条分支同秒改同一路径,一条 D 一条 M):只改 ref 名,`git log --all --raw`
 *     的第一条就从 M 翻成 D —— 顺序由 ref 名而非拓扑决定(反例与读数见镜像用例
 *     「同秒并列……」)。此时"最新状态"不存在确定答案,记进 `ambiguousPaths`,由判定层
 *     落「未判定 → exit 2」,绝不拿先到者冒充最新。同秒且结论相同(两枚 A/M,或两枚删
 *     同一 old blob 的 D)仍按先到者:取谁都不改变判定。
 *   - **跨面**(ref → reflog):只有 reflog 面的记录**严格更新**(ct 更大)才替换;ct 相同同样
 *     记为并列歧义(同一提交在两面重复不会触发:状态与 old blob 都一样才算同形)。
 */
function absorbRawCoverage(
  entries,
  surface,
  coverage,
  latestByPath,
  excludedCommits,
  ambiguousPaths,
) {
  // 同秒并列 + (至少一枚是 D) + (状态不同 / 两枚 D 的 old blob 不同) ⇒ 取谁都会改变判定
  const isAmbiguous = (a, b) =>
    a.ct === b.ct &&
    (a.status === 'D' || b.status === 'D') &&
    (a.status !== b.status || (a.status === 'D' && a.oldBlob !== b.oldBlob))
  const remember = (e) => {
    const rec = {
      commit: e.commit,
      surface,
      status: e.status,
      oldBlob: e.oldBlob || '',
      blob: e.blob,
      ct: e.ct,
    }
    const prev = latestByPath.get(e.path)
    if (!prev) {
      latestByPath.set(e.path, rec)
      return
    }
    if (prev.surface === surface) {
      if (isAmbiguous(prev, rec)) ambiguousPaths.add(e.path)
      return
    }
    if (isAmbiguous(prev, rec)) ambiguousPaths.add(e.path)
    if (e.ct > prev.ct) latestByPath.set(e.path, rec)
  }
  for (const e of entries) {
    if (!e.commit || excludedCommits.has(e.commit)) continue
    if (e.status !== 'D') {
      const key = `${e.path}\0${e.blob}`
      if (!coverage.has(key)) coverage.set(key, { commit: e.commit, surface })
    }
    remember(e)
  }
}

/**
 * 逐路径覆盖取材(2026-11-04)。返回**纯数据**,判定在 `splitByPathCoverage`。
 *
 * 面拆分:
 *   - ref 面 = `git log --all --raw`,但**排除隔离/备份 ref**(`refs/tags/lost-commit/*`、
 *     `refs/tags/backup/*`)。立因:这些 tag 是悬空对象的隔离备份,不是交付面;若把
 *     "另一会话刚重生成、仅被 auto-tag 兜住、尚未落地"的提交算作覆盖,就会把真缺口读成
 *     "已另有会话去修"而放行(2026-11-04 实测 b96a9dc2 正是这一格:其 4 条路径仅被
 *     `lost-commit/auto-108dc87` 覆盖)。这是**收紧**而非放宽:交付面越窄,能放行的越少。
 *   - reflog 面 = `git log -g --all --raw`(仅对 ref 面未覆盖的路径补查),同样按排除集过滤。
 * ref 面已覆盖的键不再进 reflog 面:两者对"同路径同 blob"的判定逻辑相同,补查只为防漏;
 * 覆盖证据里的 surface 字段如实记录是哪个面命中的。
 *
 * `excludedCommits` 必须是**全部悬空 commit**(fsck --no-reflogs 的原始集合,含被 filter-stash
 * 过滤掉的):悬空提交会出现在 HEAD reflog 里,若把它自己算作覆盖面,任何悬空提交都会自证通过。
 *
 * 取不到(ref 面失败 / reflog 面失败)一律返回 `surfaceError`,由判定层朝红;绝不把空读数读成
 * "没有可覆盖的内容"。
 */
function derivePathCoverage(candidates, { excludedCommits = new Set() } = {}) {
  const entriesByCommit = new Map()
  const problemsByCommit = new Map()
  const presentPaths = new Set()
  const deletedPaths = new Set()
  // 同秒并列、取谁都会改变 D 判定的路径(见 absorbRawCoverage 头注)。判定层据此落 exit 2。
  const ambiguousPaths = new Set()
  const firstLine = (e) =>
    String((e && (e.stderr || e.message)) || e)
      .split('\n')[0]
      .slice(0, 160)

  for (const c of candidates) {
    try {
      const raw = gitText(
        ['diff-tree', '--no-commit-id', '-r', '-z', '--raw', '--root', '--no-renames', c],
        { timeout: SPAWN_DEFAULT_TIMEOUT_MS },
      )
      const entries = parseRawDiffZ(raw)
      entriesByCommit.set(c, entries)
      for (const e of entries) {
        if (e.status === 'D') deletedPaths.add(e.path)
        else presentPaths.add(e.path)
      }
    } catch (e) {
      entriesByCommit.set(c, null)
      problemsByCommit.set(c, `diff-tree 取不到:${firstLine(e)}`)
    }
  }

  const coverage = new Map()
  const latestByPath = new Map()
  const queryPaths = [...new Set([...presentPaths, ...deletedPaths])].sort()
  if (queryPaths.length === 0)
    return { entriesByCommit, coverage, latestByPath, problemsByCommit, surfaceError: '', ambiguousPaths }

  const walk = (baseArgs, paths) => {
    const out = []
    for (const chunk of chunkPathspecs(paths)) {
      const stdout = gitText(
        // %ct 是 commit 的 committer 时刻,只用于**跨面**比较新旧(同面内按 git log 自身顺序)。
        [...baseArgs, `--format=${RAW_COMMIT_MARKER}%H:%ct`, '--', ...chunk],
        { timeout: PATH_COVERAGE_TIMEOUT_MS },
      )
      out.push(...parseRawDiffZ(stdout, { withCommit: true }))
    }
    return out
  }

  try {
    const refEntries = walk(
      [
        'log',
        // 顺序敏感:`--exclude` 必须写在 `--all` 之前才作用于它。
        '--exclude=refs/tags/lost-commit/*',
        '--exclude=refs/tags/backup/*',
        '--all',
        '--raw',
        '--no-abbrev',
        '-z',
        '--no-renames',
        '--root',
      ],
      queryPaths,
    )
    absorbRawCoverage(refEntries, 'ref', coverage, latestByPath, excludedCommits, ambiguousPaths)
  } catch (e) {
    return {
      entriesByCommit,
      coverage: new Map(),
      latestByPath: new Map(),
      problemsByCommit,
      surfaceError: `ref 面取不到:${firstLine(e)}`,
      ambiguousPaths,
    }
  }

  // 仅对 ref 面没覆盖到的路径补查 reflog 面(含"删除意图"未在 ref 面生效的路径)
  const leftoverPresent = new Set()
  const leftoverDeleted = new Set()
  for (const entries of entriesByCommit.values()) {
    if (!entries) continue
    for (const e of entries) {
      if (e.status === 'D') {
        // 按收紧后的判据判"这条删除是否已被 ref 面作证":必须最新且 old blob 相同。
        const latest = latestByPath.get(e.path)
        const proven = latest && latest.status === 'D' && latest.oldBlob === (e.oldBlob || '')
        if (!proven) leftoverDeleted.add(e.path)
      } else if (!coverage.has(`${e.path}\0${e.blob}`)) {
        leftoverPresent.add(e.path)
      }
    }
  }
  const reflogPaths = [...new Set([...leftoverPresent, ...leftoverDeleted])].sort()
  if (reflogPaths.length > 0) {
    try {
      const reflogEntries = walk(
        ['log', '-g', '--all', '--raw', '--no-abbrev', '-z', '--no-renames', '--root'],
        reflogPaths,
      )
      absorbRawCoverage(reflogEntries, 'reflog', coverage, latestByPath, excludedCommits, ambiguousPaths)
    } catch (e) {
      return {
        entriesByCommit,
        coverage,
        latestByPath,
        problemsByCommit,
        surfaceError: `reflog 面取不到(剩余路径按未覆盖判):${firstLine(e)}`,
        ambiguousPaths,
      }
    }
  }
  return { entriesByCommit, coverage, latestByPath, problemsByCommit, surfaceError: '', ambiguousPaths }
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
    // 显式数字 timeout:不让 fsck 无界挂起把 pre-commit 钉死。
    // 2026-10-30 实测校准(60s → 240s):本机对象库 9.5GB / 181 个 pack,`--connectivity-only`
    // 全库遍历 midx 前 92s、midx 后 59s —— 原值 60s 正好卡在噪声带宽里,于是这道门长期
    // rc=2「fsck 判定面取不到」,而 rc=2 不报警,跑久了被当成绿的(§0.3)。
    // 阈值必须与实测规模匹配,不是越短越安全:短到永远超时 = 这道门从未真正判过。
    // 取 4× 实测值留出并发负载余量;真超了仍照旧 rc=2 并点名原因,不折成通过。
    timeout: 240_000,
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

/**
 * 批量取 commit subject(全门唯一的 subject 派生出口)。
 *
 * 2026-10-30 三次提速后的定论:**Windows 上每次 spawn 一个 git 进程约 2 秒**,
 * 所以"批量"的正解是"把 N 次派生压成 1 次",而不是继续调批宽。本仓实测同输出同条数:
 *   - 批宽 400 ⇒ 44 次派生 = 84 秒
 *   - `git log --no-walk --stdin` 一次读 17,436 枚 = **0.403 秒**
 * 差 208 倍的是进程启动,不是 git 的计算;`--stdin` 同时绕开 Windows 32KB 命令行上限,
 * 于是"按 argv 宽度算批"这件事本身也不再需要。
 *
 * `--no-walk` 输出顺序与传参**不一致**(实测 058d/1630/2b3f vs 传参 058d/ecc5/…),
 * 必须按 `%H` 完整 hash 建映射,严禁按行索引对应(曾致 stash-like 过滤错位误报)。
 *
 * 失效方向:整条命令失败(含"某个 rev 不被接受")时回退分批,把损失限制在一批 ——
 * 必须是"少判一批",绝不可是"整轮读成没有悬空"。
 */
function subjectsForHashes(hashes) {
  const map = new Map()
  if (hashes.length === 0) return map
  const out = gitText(['log', '--no-walk', '--format=%H%x09%s', '--stdin'], {
    allowFail: true,
    timeout: LOCAL_GIT_TIMEOUT_MS,
    input: hashes.join('\n') + '\n',
  })
  if (out) {
    for (const line of out.split('\n')) {
      const [hash, ...rest] = line.split('\t')
      if (hash) map.set(hash, rest.join('\t'))
    }
    return map
  }
  for (let i = 0; i < hashes.length; i += DATE_WALK_BATCH) {
    const batch = hashes.slice(i, i + DATE_WALK_BATCH)
    const part = gitText(['log', '--no-walk', '--format=%H%x09%s', ...batch], {
      allowFail: true,
      timeout: LOCAL_GIT_TIMEOUT_MS,
    })
    if (!part) continue
    for (const line of part.split('\n')) {
      const [hash, ...rest] = line.split('\t')
      if (hash) map.set(hash, rest.join('\t'))
    }
  }
  return map
}

function filterStashLike(hashes) {
  // 对每个 hash 取 subject,若是 stash-like 形态(WIP / On main / index on main)则过滤。
  // 2026-08-17 性能修复:原实现逐条 `git log -1`,数百枚悬空就累积 10+ 分钟阻塞 pre-commit。
  // 2026-10-30 定论:批量的正解是 `--stdin` 一次派生,不是调批宽(见 subjectsForHashes 头注)。
  // 取不到 subject 的 hash 原样留下(退化成"不过滤"),这是朝红的方向 —— 不静默读成"没有悬空"。
  if (hashes.length === 0) return hashes
  const subjectByHash = subjectsForHashes(hashes)
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
  if (list.length === 0) return { map, failedBatches: 0, batches: 0 }
  // 同 subjectsForHashes:一次 `--stdin` 取代 N 次派生(Windows 上每次 spawn ≈ 2 秒)。
  // `batches` 的语义随之变化:原来的"批"只为绕 Windows 32KB argv 上限而存在,`--stdin`
  // 已不需要它,所以成功路径恒 `batches=1`。`failedBatches` 的语义**一字未改** ——
  // 仍是"这一次没量到",调用方照样走 `wholeWalkFailed` 保守全拦(不朝绿折)。
  batches = 1
  const out = gitText(['log', '--no-walk', '--format=%H%x09%ct', '--stdin'], {
    allowFail: true,
    timeout: LOCAL_GIT_TIMEOUT_MS,
    input: list.join('\n') + '\n',
  })
  if (!out) {
    // 整条失败(含"某个 rev 不被接受"⇒ 整条命令非零,不是逐条跳过)⇒ 回退分批,
    // 把损失限制在一批。失效方向必须是"少判一批",绝不可是"整轮读成没有时刻"。
    failedBatches = 0
    batches = 0
    for (let i = 0; i < list.length; i += DATE_WALK_BATCH) {
      const batch = list.slice(i, i + DATE_WALK_BATCH)
      batches++
      const part = gitText(['log', '--no-walk', '--format=%H%x09%ct', ...batch], {
        allowFail: true,
        timeout: LOCAL_GIT_TIMEOUT_MS,
      })
      if (!part) {
        failedBatches++
        continue
      }
      for (const [hash, ts] of parseCommitterDateLines(part)) map.set(hash, ts)
    }
    return { map, failedBatches, batches }
  }
  for (const [hash, ts] of parseCommitterDateLines(out)) map.set(hash, ts)
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

/**
 * 远端两族 tag 的一次扫描(2026-10-12 提速):原来 lost-commit/* 与 backup/* 各发一次
 * ls-remote,串行两趟在本机网络上固定烧 30s 且双双撞 15s 超时 ⇒ 校验每次都降级。
 * 现在:① 一次调用带两个 pattern(一趟往返同时取回两族);② 结果落盘缓存(成功 10 分钟 /
 * 失败 2 分钟),期间重复提交零网络;③ 任一失败仍按旧契约折成 null ⇒ 调用方 remoteCheckSkipped
 * 的判定口径**一字未改**(两族同源同趟,失败即两族同 null,与"旧两趟都超时"的结果相同)。
 */
function remoteTagScan() {
  if (remoteTagScanMemo) return remoteTagScanMemo
  // 提交链默认**不发网络**(2026-10-21 立)。判据性质:远端 tag 完整性是**仓库状态**,不是本次
  // 提交引入的内容 —— 按 AGENTS §12e(与本次提交无关的判据不得挂成提交门),它不该 blocking
  // 每一枚提交。代价实测:本机 GitHub 直连被墙,`git ls-remote` 单轮阻塞 **295s**(占提交链
  // 总耗时 38%,而 CPU 仅 1s = 纯等待);`execFileSync` 的 `timeout: 60s` 在 Windows 只杀得到
  // 直接子进程 git.exe,孙进程 git-remote-https 仍持有 stdout 管道 ⇒ 父进程等 EOF 继续阻塞。
  // 这里按"未判定"降级 —— 下方 `remoteCheckSkipped` 已把 null 当跳过,不冒红也不记绿;
  // 远程校准走手动 `node scripts/check-commit-loss-guard.mjs --fetch` 与 git-guardian 后台巡检。
  // 显式要看远程:IHUI_COMMIT_LOSS_REMOTE=1(会重新付出那 ~60s,慎用)。
  // 用环境变量而非 argv 判断:本门在提交链里由 guardian-runner 以 `--filter-stash --staged`
  // 调用,而手动档/巡检档的参数形态各不相同;判据面是"要不要发网络",与环境变量一一对应最稳。
  if (process.env.IHUI_COMMIT_LOSS_REMOTE !== '1') {
    // 「默认不发网络」是本门的设计边界(提交链上每枚提交都付 60s 不可接受),不是"取不到"。
    // 必须与下面「发起过但失败」分开:后者是 UNDETERMINED(§0.3),前者维持既有绿语义。
    remoteTagScanMemo = { lost: null, backup: null, attempted: false, failed: false, reason: '' }
    return remoteTagScanMemo
  }
  const cachePath = remoteScanCachePath()
  try {
    const j = JSON.parse(readFileSync(cachePath, 'utf8'))
    if (j && typeof j.ts === 'number') {
      const age = Date.now() - j.ts
      const ttl = j.ok ? REMOTE_SCAN_CACHE_TTL_OK_MS : REMOTE_SCAN_CACHE_TTL_FAIL_MS
      if (age >= 0 && age <= ttl) {
        remoteTagScanMemo = j.ok
          ? {
              lost: Array.isArray(j.lost) ? j.lost : [],
              backup: Array.isArray(j.backup) ? j.backup : [],
              attempted: true,
              failed: false,
              reason: '',
            }
          : {
              lost: null,
              backup: null,
              attempted: true,
              failed: true,
              reason: String(j.reason || '命中失败缓存(上次 ls-remote 未取到)'),
            }
        return remoteTagScanMemo
      }
    }
  } catch {
    /* 无缓存/缓存损坏/过期 ⇒ 正常发网络,读缓存失败绝不影响判据 */
  }
  let parsed = null
  let failureReason = ''
  try {
    // `--refs` + `protocol.version=2` 是本机实测的提速两件套(2026-10-12):这仓远端两族
    // tag 有 7968 行,其中 1004 行是 annotated tag 的 `^{}` peel 行 —— 它们只被下面的
    // parseRemoteTagOutput 过滤掉,是纯传输浪费。`--refs` 让服务端直接不发 peel 行
    // (6964 行);协议 v2 省掉 v0/v1 的多余往返。等价证明:.ihui-agent/tmp/cmp-lsremote.mjs
    // 拿同一解析器比对两趟输出,集合 6964 = 6964、双向差集 0。单趟实测 19~21s。
    // `-c` 必须在子命令前(gitRaw 是在本 args 之前补 safe.directory/quotepath 的,不冲突)。
    const out = gitText(
      [
        // 网络型调用必须让 **git 自己** 放弃(2026-10-21 立):`timeout: REMOTE_TIMEOUT_MS`
        // 在 Windows 上只杀得到直接子进程 git.exe,孙进程 git-remote-https 仍持有 stdout
        // 管道 ⇒ 父进程读不到 EOF、继续阻塞。实测本门单轮 295s(占提交链总耗时 38%),而
        // 手动 `git fsck` 只要 6.2s ⇒ 慢的全部在这里。20 秒低于 1KB/s 由 git 自己断开,
        // 不再等 TCP 自己死;超时后仍走下方 allowFail 的安全降级(远程校验跳过)。
        '-c',
        'http.lowSpeedLimit=1000',
        '-c',
        'http.lowSpeedTime=20',
        '-c',
        'protocol.version=2',
        'ls-remote',
        '--refs',
        'origin',
        'refs/tags/lost-commit/[^ ]*',
        'refs/tags/backup/[^ ]*',
      ],
      {
        timeout: REMOTE_TIMEOUT_MS,
      },
    )
    const all = parseRemoteTagOutput(out)
    parsed = {
      lost: all.filter((n) => n.startsWith('lost-commit/')),
      backup: all.filter((n) => n.startsWith('backup/')),
    }
  } catch (e) {
    // 发起过但没取到(失败/超时/离线)= 未判定,不是"远程没问题"。原因随缓存一起落盘,
    // 保证 2 分钟失效窗内的下一次调用仍能说出"为什么没判成",而不是只看到一个 null。
    parsed = null
    failureReason = gitErrText(e) || 'ls-remote 失败/超时'
  }
  try {
    writeFileSync(
      cachePath,
      JSON.stringify(
        parsed
          ? { ts: Date.now(), ok: true, ...parsed }
          : { ts: Date.now(), ok: false, lost: null, backup: null, reason: failureReason },
      ),
      'utf8',
    )
  } catch {
    /* 缓存写不进去只是下次还得再跑一趟,不影响本次判定 */
  }
  remoteTagScanMemo = parsed
    ? { ...parsed, attempted: true, failed: false, reason: '' }
    : { lost: null, backup: null, attempted: true, failed: true, reason: failureReason }
  return remoteTagScanMemo
}
/** 进程内记忆:同一次提交里两族只问一趟,不因调用点分开而重复发网络 */
let remoteTagScanMemo = null

const TAG_REF_PREFIX = 'refs/tags/'

/**
 * `for-each-ref --format=%(refname)%09%(objectname)%09%(*objectname)` 的输出
 * → Map<shortName,{obj,peeled}>(**纯函数**:tag 可达性读取的第一段,不派生 git)。
 *
 * ⚠️ 必须取**全名** `%(refname)` 再在这里剥 `refs/tags/`,绝不能直接用 `%(refname:short)`:
 * 实测(2026-10-30,本仓 26,285 枚 tag)同一条命令
 *   - `--format=%(refname)`        = **100 ms**
 *   - `--format=%(refname:short)`  = **42,235 ms**(422 倍)
 * `:short` 要为每枚 ref 算"最短无歧义名",等于拿它去和全体 ref 比对 ⇒ 26k 枚就是 O(n²) 的
 * 消歧。这不是 git 慢,是我们在向 git 索要一件本可以在本地零成本完成的事。
 * 去掉前缀是确定的(命名空间就写死在参数里),没有歧义可消。
 */
function parseForEachRefTagInfo(out) {
  // shortName → { obj, peeled }
  const infoByTag = new Map()
  for (const line of String(out || '').split('\n')) {
    const [fullName, obj, peeled] = line.split('\t')
    if (!fullName) continue
    const shortName = fullName.startsWith(TAG_REF_PREFIX)
      ? fullName.slice(TAG_REF_PREFIX.length)
      : fullName
    infoByTag.set(shortName, { obj: obj || '', peeled: peeled || '' })
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
      '--format=%(refname)%09%(objectname)%09%(*objectname)',
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

// ── --self-test(2026-11-04 立)──────────────────────────────────────────────
/**
 * 自检的夹具派生出口(夹具仓内的 git 一律经这里,**显式 stdio** —— §12g)。
 *
 * 为什么要 `GIT_CONFIG_NOSYSTEM` + `GIT_CONFIG_GLOBAL` 指到夹具内的空文件:
 * 本机 global config 可带 `core.hooksPath` / 提交签名等设置,夹具提交若被它们接管,
 * "真跑 main()" 读到的就不是夹具自己造的历史。空文件在夹具内且不被跟踪,fsck 不受影响。
 */
const FIXTURE_GIT_TIMEOUT_MS = 30_000
function fixtureGit(dir, args) {
  const r = spawnSync(gitBinary() || 'git', ['-c', 'safe.directory=*', ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: FIXTURE_GIT_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(dir, '.ihui-empty-gitconfig'),
    },
  })
  if (r.error) throw new Error(`夹具 git ${args.join(' ')} 派生失败:${r.error.message}`)
  if (r.status !== 0)
    throw new Error(
      `夹具 git ${args.join(' ')} 失败(status=${r.status}):${String(r.stderr || r.stdout || '')
        .trim()
        .slice(0, 200)}`,
    )
  return String(r.stdout || '').trim()
}

/**
 * 以**子进程**真跑本门,拿真实 exit 码(而不是在自检进程里调 main()):
 * main() 的档位旗标在模块加载期就从 argv 读定,同进程调用会把 `--self-test` 当成"没有 --blocking",
 * 于是 reset/悬空这两档都只会 warn 再 exit 0 —— 自检就变成了"证明它能跑"而不是"证明它有牙"。
 * 子进程 cwd=夹具仓 ⇒ 门的 `ROOT = process.cwd()` 自然落在夹具上,与镜像测试同一取材口径。
 * 环境显式钉死三件:关缓存(避免复用脏结论)、关窗维(全量语义,最近造的悬空必拦)、关远程
 * (夹具无 origin,不许任何自检去发网络)。`HUSKY_SKIP_COMMIT_LOSS_CHECK` 必须删掉 ——
 * 留着它等于自检求一个"被跳过"的 0。
 */
function runGateIn(dir, flags) {
  const env = {
    ...process.env,
    IHUI_COMMIT_LOSS_NO_CACHE: '1',
    IHUI_COMMIT_LOSS_WINDOW_DAYS: '0',
    IHUI_COMMIT_LOSS_REMOTE: '0',
  }
  delete env[SKIP_ENV]
  const r = spawnSync(process.execPath, [SELF_PATH, ...flags], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })
  return {
    status: r.error ? null : r.status,
    error: r.error,
    out: `${r.stdout || ''}${r.stderr || ''}`,
  }
}

/** 失败诊断只留尾部:门的输出带 ANSI 与整段明细,截尾才看得见"结论那几行"。 */
const tailOf = (s, n = 260) =>
  String(s || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .trim()
    .slice(-n)

/**
 * `--self-test`:§22 三类判据 + 未判定臂的**端到端**对照。
 *
 * 不碰真仓:每个用例在 `mkScratch`(§26 唯一落点)里 `git init` 一个临时仓,所有 git 动作
 * (`reset --hard` / `stash drop` / 打 tag)只发生在那个仓里,判据本体一行未改。
 * 用例成对:
 *   ① 正常演进 ⇒ 0(证明门不是恒红);
 *   ② `reset --hard` 丢掉 commit 且无备份 tag ⇒ 1 且点名(证明门不是恒绿);
 *   ③ 同样的 reset 但有 `lost-commit/*` 备份 ⇒ 0(这门存在的理由:允许回退,不许无备份回退);
 *   ④ `stash drop` 丢掉含 commit 的 stash ⇒ 1 且点名(未过滤档);同现场加 `--filter-stash`
 *      ⇒ 0(证明过滤臂既拦得住、也不误拦);
 *   ⑤ 非 git 目录 ⇒ 2 且不记绿(§0.3:"没判完"不得读成"判过了")。
 *
 * ⚠️ ④ 为什么"未过滤档"才红:`--filter-stash` 是提交链档位,它按设计把 WIP/index/untracked
 * 这类 stash 快照判成"不是丢失"。所以"stash drop 能被看见"这件事必须在无该旗标的档位上证明,
 * 同时保留带旗标的正例 —— 两格一起才同时证明"判据有牙"与"过滤不误拦"。
 */
function runSelfTest() {
  console.log(
    `${C.cyan}${C.bold}🧪 check-commit-loss-guard --self-test(§22 判据端到端对照)${C.reset}`,
  )
  const cases = []
  // 登记式:先真跑子进程,再把**已求值的布尔**记进来 —— 断言值不依赖 report 时刻的现场,
  // 夹具清理与结账顺序因此无关(也就不必为了"求值点"把清理塞进 finally 里结账)。
  const t = (name, pass, got = '') => cases.push({ name, pass: Boolean(pass), got: String(got) })
  const dirs = []
  const newRepo = () => {
    const dir = mkScratch('commit-loss-selftest-')
    dirs.push(dir)
    writeFileSync(join(dir, '.ihui-empty-gitconfig'), '', 'utf8')
    fixtureGit(dir, ['init', '-q', '-b', 'main'])
    fixtureGit(dir, ['config', 'user.email', 'gate-fixture@ihui.local'])
    fixtureGit(dir, ['config', 'user.name', 'gate-fixture'])
    fixtureGit(dir, ['config', 'commit.gpgsign', 'false'])
    return dir
  }
  const commitTwice = (dir) => {
    writeFileSync(join(dir, 'a.txt'), 'v1\n', 'utf8')
    fixtureGit(dir, ['add', 'a.txt'])
    fixtureGit(dir, ['commit', '-q', '-m', 'c1'])
    writeFileSync(join(dir, 'a.txt'), 'v2\n', 'utf8')
    fixtureGit(dir, ['commit', '-q', '-am', 'c2'])
    return fixtureGit(dir, ['rev-parse', 'HEAD'])
  }
  try {
    // ① 正例:正常演进,没有丢失 commit
    {
      const dir = newRepo()
      const head = commitTwice(dir)
      const g = runGateIn(dir, [FLAGS.blocking, FLAGS.filterStash])
      t(
        '① 正例·正常演进无丢失 ⇒ exit 0',
        g.status === 0,
        `status=${g.status}; HEAD=${head.slice(0, SHORT_HASH_LEN)}; tail=${tailOf(g.out)}`,
      )
      t(
        '② 正例·且输出真判绿(不是"没判成"的 0)',
        g.out.includes(GREEN_MARKERS.noRisk),
        `tail=${tailOf(g.out)}`,
      )
    }

    // ③④⑤ 反例:reset --hard 丢掉已有 commit,且无备份 tag
    {
      const dir = newRepo()
      const lost = commitTwice(dir)
      fixtureGit(dir, ['reset', '--hard', 'HEAD~1'])
      const g = runGateIn(dir, [FLAGS.blocking, FLAGS.filterStash])
      t(
        '③ 反例·reset --hard 丢 commit 且无备份 tag ⇒ exit 1',
        g.status === 1,
        `status=${g.status}; tail=${tailOf(g.out)}`,
      )
      t(
        '④ 反例·逐条点名被丢的那枚 commit',
        g.out.includes(lost.slice(0, SHORT_HASH_LEN)),
        `期望点名 ${lost.slice(0, SHORT_HASH_LEN)}; tail=${tailOf(g.out)}`,
      )
      t(
        '⑤ 反例·reflog reset 判据同时生效',
        g.out.includes('次 reset 操作') && g.out.includes('reset: moving to'),
        `tail=${tailOf(g.out)}`,
      )
    }

    // ⑥⑦ 正例:同样的 reset,但被丢的那枚有 lost-commit/* 备份 ⇒ 门必须放行
    {
      const dir = newRepo()
      const kept = commitTwice(dir)
      fixtureGit(dir, ['tag', 'lost-commit/self-test-backup', kept])
      fixtureGit(dir, ['reset', '--hard', 'HEAD~1'])
      const g = runGateIn(dir, [FLAGS.blocking, FLAGS.filterStash])
      t(
        '⑥ 正例·reset 有 lost-commit/* 备份 ⇒ exit 0(允许回退)',
        g.status === 0,
        `status=${g.status}; tail=${tailOf(g.out)}`,
      )
      t(
        '⑦ 正例·且门真的认了这枚备份(输出点名 tag,不是"跳过判据")',
        g.out.includes('lost-commit/self-test-backup'),
        `tail=${tailOf(g.out)}`,
      )
    }

    // ⑧⑨⑩⑪ 反例+正例:stash drop 丢掉含 commit 的 stash
    {
      const dir = newRepo()
      writeFileSync(join(dir, 'a.txt'), 'v1\n', 'utf8')
      fixtureGit(dir, ['add', 'a.txt'])
      fixtureGit(dir, ['commit', '-q', '-m', 'c1'])
      writeFileSync(join(dir, 'a.txt'), 'v2\n', 'utf8')
      fixtureGit(dir, ['stash', 'push', '-q', '-m', 'self-test stash'])
      const stash = fixtureGit(dir, ['rev-parse', 'refs/stash'])
      fixtureGit(dir, ['stash', 'drop', '-q'])
      // 未过滤档:stash 快照就是"未备份悬空 commit",必须判红并点名
      const gRaw = runGateIn(dir, [FLAGS.blocking])
      t(
        '⑧ 反例·stash drop 丢掉 stash commit ⇒ exit 1(未过滤档)',
        gRaw.status === 1,
        `status=${gRaw.status}; tail=${tailOf(gRaw.out)}`,
      )
      t(
        '⑨ 反例·点名被丢的 stash commit',
        gRaw.out.includes(stash.slice(0, SHORT_HASH_LEN)),
        `期望点名 ${stash.slice(0, SHORT_HASH_LEN)}; tail=${tailOf(gRaw.out)}`,
      )
      // 同现场加提交链旗标:stash-like 按设计不算丢失 ⇒ 必须放过(否则就是误拦)
      const gFiltered = runGateIn(dir, [FLAGS.blocking, FLAGS.filterStash])
      t(
        '⑩ 正例·同现场加 --filter-stash ⇒ exit 0(不把 stash 当丢失)',
        gFiltered.status === 0,
        `status=${gFiltered.status}; tail=${tailOf(gFiltered.out)}`,
      )
      t(
        '⑪ 正例·且过滤确实发生(输出报出过滤数)',
        gFiltered.out.includes('已过滤'),
        `tail=${tailOf(gFiltered.out)}`,
      )
    }

    // ⑫⑬ 未判定臂:非 git 目录(取不到 git 面)⇒ 2,且不得记绿
    {
      const dir = mkScratch('commit-loss-selftest-nongit-')
      dirs.push(dir)
      const g = runGateIn(dir, [FLAGS.blocking, FLAGS.filterStash])
      t(
        '⑫ 未判定臂·非 git 目录 ⇒ exit 2',
        g.status === 2,
        `status=${g.status}; tail=${tailOf(g.out)}`,
      )
      t(
        '⑬ 未判定臂·不记绿(既无"无风险"也无"未检测到悬空"且明说"无法判定")',
        !g.out.includes(GREEN_MARKERS.noRisk) &&
          !g.out.includes(GREEN_MARKERS.noUnreachable) &&
          g.out.includes('无法判定'),
        `tail=${tailOf(g.out)}`,
      )
    }
  } finally {
    for (const d of dirs) {
      try {
        rmScratch(d, { bestEffort: true })
      } catch (e) {
        console.warn(`⚠ 自检夹具清理失败:${d} —— ${String(e?.message ?? e).slice(0, 120)}`)
      }
    }
  }
  // 用例登记的是**已求值的布尔**(每个 t 调用之前子进程已真跑完),所以这里结账与清理顺序无关。
  const pass = cases.filter((c) => c.pass).length
  const fail = cases.length - pass
  for (const c of cases)
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— 实得:${c.got}`}`)
  console.log(
    fail === 0
      ? `${C.green}--self-test:${pass}/${cases.length} 通过${C.reset}`
      : `${C.red}--self-test:${pass}/${cases.length} 通过(${fail} 例失败)${C.reset}`,
  )
  return fail ? 1 : 0
}

/**
 * 判定主体。§22d 后它是 **async**(入口守卫要拿它的 promise 接 `.then/.catch`);
 * 函数体内没有任何 await ⇒ 求值时序与旧的同步版逐字相同,每条出口仍自己 `process.exit(N)`
 * (0 = 通过/降级通过,1 = blocking 判红,skip 档 = 0),`onFatal` 仍负责异常侧的 exit 2。
 */
async function main() {
  // --self-test 分派放在 skip 档**之前**:SKIP_ENV 是"紧急跳门"通道,它不得把自检也跳成 0 ——
  // 那会在最需要证明门有牙的环境里得到一份空自检。
  if (process.argv.includes(SELF_TEST_FLAG)) return runSelfTest()
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
  // 备份 tag 清单在缓存检查**之前**取:它既是判据的一部分,也是缓存新鲜度的指纹来源。
  // 成本实测 listLostCommitTags 150ms + listBackups 127ms(26k tag 的仓),与缓存要省的
  // 数十秒不在一个量级;而它换来的是"tag 一动缓存即失效"这条硬保证。
  // 立因(2026-10-30,端到端 #42 逼出来):原注释写"悬空集合只由 reset / stash / gc 驱动",
  // 漏了**打 tag 备份本身** —— 照 §22 给一枚悬空 commit 打上 lost-commit/* 之后,它就不再是
  // "未备份悬空",判定必须翻绿,而按 TTL 复用的旧结论会把它按旧账继续拦 30 分钟。
  // 也就是说:缓存会把"已经处置过"读成"还没处置",让人无论怎么备份都提交不上去。
  const lostTags = listLostCommitTags()
  mark(`listLostCommitTags(${lostTags.length})`)
  const backups = listBackups()
  mark(`listBackups(${backups.length})`)
  // 登记本轮判据面(缓存键的另一半,见 lossCacheFace 头注)
  setLossCacheFace({
    windowDays: winDim.days,
    winSource: winDim.source,
    strict: isStrict ? 1 : 0,
    filterStash: isFilterStash ? 1 : 0,
    tagFingerprint: backupTagFingerprint(lostTags, backups),
    coverageVersion: COVERAGE_FACE_VERSION,
  })
  console.log(
    `  ${C.dim}悬空 commit 量纲:${C.reset}` +
      (winDim.days > 0
        ? `${C.cyan}${winDim.days}${C.reset} ${C.dim}天内才拦(来源=${winDim.source};` +
          `超窗存量只报数 —— §29 人工 GC 范围)${C.reset}`
        : `${C.cyan}窗维已关闭${C.reset} ${C.dim}(全量语义:任何未备份悬空都拦)${C.reset}`),
  )

  // 缓存命中即秒回(2026-10-21):只在 blocking 档生效,且必须打印"复用了几分钟前的结论"。
  const cachedLoss = readLossCache()
  if (cachedLoss) {
    const ageMin = Math.round((Date.now() - cachedLoss.ts) / 60000)
    console.log(
      `  ${C.dim}复用 ${ageMin} 分钟前的结论(HEAD 未变;强制重算:IHUI_COMMIT_LOSS_NO_CACHE=1)${C.reset}`,
    )
    console.log(
      `  ${cachedLoss.blocking ? `${C.red}❌ ${cachedLoss.summary}` : `${C.green}✅ ${cachedLoss.summary}`}${C.reset}`,
    )
    process.exit(cachedLoss.blocking ? 1 : 0)
  }

  // 26k tag 的可达性表全程只算这一次:detectResets 的"reset 丢掉的那枚是否已备份"与后面
  // §4 综合判定用的是同一张表。换掉 `%(refname:short)` 后这一趟实测 39s → 1.1s(见
  // parseForEachRefTagInfo 头注),但"只算一次"仍然要保住——它现在是唯一一份。
  const reachability = verifyAllTagReachability([...lostTags, ...backups])
  mark(`verifyAllTagReachability(${reachability.length})`)
  const resets = detectResets(reachability)
  mark('detectResets')
  const rawUnreachable = detectUnreachable()
  mark(`detectUnreachable(${rawUnreachable.length})`)
  // --filter-stash: 过滤掉 stash-like 对象(WIP / On main / index on main)
  const unreachable = isFilterStash ? filterStashLike(rawUnreachable) : rawUnreachable
  mark(`filterStashLike(${unreachable.length})`)
  const stashCount = isFilterStash ? rawUnreachable.length - unreachable.length : 0
  // 2026-07-26 升级:远程 tag 完整性校验
  // 2026-09-06 修复:null=ls-remote 失败/超时 → 降级跳过远程 diff(不产生误导性差异)
  const remoteScan = remoteTagScan()
  const remoteLostTags = remoteScan.lost
  mark('remoteTagScan')
  const remoteBackups = remoteScan.backup
  const remoteCheckSkipped = remoteLostTags === null || remoteBackups === null
  // 「显式发起但没取到」= UNDETERMINED(§0.3:不得折成通过);「默认不发网络」= 设计边界,
  // 维持既有绿语义。两者都让 remoteCheckSkipped 为真,但只有前者需要 exit 2。
  const remoteUndetermined = remoteCheckSkipped && remoteScan.attempted && remoteScan.failed
  const lostTagDiff = remoteCheckSkipped
    ? { onlyLocal: [], onlyRemote: [], both: [] }
    : compareTagSets(lostTags, remoteLostTags)
  const backupTagDiff = remoteCheckSkipped
    ? { onlyLocal: [], onlyRemote: [], both: [] }
    : compareTagSets(backups, remoteBackups)

  // 「仅远端有、本地缺」→ 冷却窗外才 fetch 回来固化,拉不动降级为警告(见 healMissingRemoteTags 注释)。
  // 冷却窗内跳过不改变任何判定:onlyRemote 本就只进 warn 段,补副本纯属冗余强化(见 HEAL_COOLDOWN_MS 头注)。
  let remoteHeal = { attempted: false, fetched: [], stillMissing: [], degraded: false, reason: '' }
  {
    const missing = [...lostTagDiff.onlyRemote, ...backupTagDiff.onlyRemote]
    if (missing.length && !remoteCheckSkipped) {
      if (healCoolingDown()) {
        remoteHeal = {
          attempted: false,
          coolingDown: true,
          fetched: [],
          stillMissing: missing,
          degraded: false,
          reason: `冷却窗内跳过补拉(窗宽 ${Math.round(HEAL_COOLDOWN_MS / 60000)} 分钟;远端留存即安全)`,
        }
      } else {
        const r = healMissingRemoteTags(missing)
        remoteHeal = {
          attempted: true,
          fetched: r.fetched,
          stillMissing: r.stillMissing,
          degraded: r.networkFailed,
          reason: r.reason,
        }
        // 只要**真的尝试过**就落状态件:失败也必须退避。
        // 反例(2026-10-30 实测踩到):原先只有 `fetched.length > 0` 才写状态 ⇒ 网络不通 /
        // 全部拉失败时状态件不落 ⇒ 冷却窗永不生效 ⇒ 每轮重放再付一次完整网络超时(实测 8 分钟)。
        // "补拉失败"本身不是判红项(onlyRemote 只进 warn),但让失败变成无限重试就是纯损耗。
        noteHealDone(r.fetched.length)
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
  }

  mark(`heal(attempted=${remoteHeal.attempted},cooling=${!!remoteHeal.coolingDown},fetched=${remoteHeal.fetched.length})`)

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
    // 2026-10-30:原为逐枚 `git log -1`(10 枚 = 10 次派生 ≈ 8 秒,纯为了打印十行题)。
    // 走 subjectsForHashes 一次派生。**只影响展示**:判据用的是 unreachable 全集,与这十行无关。
    const headSubjects = subjectsForHashes(unreachable.slice(0, 10))
    for (const c of unreachable.slice(0, 10)) {
      const short = c.slice(0, SHORT_HASH_LEN)
      const subject = headSubjects.get(c) || ''
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
    // 时 20+ 分钟)。
    // 2026-10-30 修掉一处"从没生效过"的死代码:旧写法把 26,285 个 tag 名逐个作 argv 传给
    // `for-each-ref`(实测 1,229,358 字节),在 Windows 上必然 `ENAMETOOLONG`(CreateProcess
    // 上限 32,767)⇒ allowFail 折成 '' ⇒ tagToHash 为空 ⇒ 明细行的 hash **恒显 "?"**,
    // 而 follow 的批量取 subject 也就一枚都没取到。旧注释把它当成"等价重构刻意不修",
    // 其实是这条展示链从未工作过 —— 修法不是加大限制,而是根本不要再派生:
    // main 里已经为综合判定算好了 `reachability`(tag → peeled||obj),直接用它。
    // 注意 `reachability` 只覆盖 `lostTags ∪ backups`,而本段正是按 `lostTags` 打印,口径一致。
    const tagToHash = new Map()
    for (const r of reachability) if (r.hash) tagToHash.set(r.tag, r.hash)
    const detailedTags = lostTags.slice(0, 10)
    const uniqueHashes = [...new Set(detailedTags.map((t) => tagToHash.get(t)).filter(Boolean))]
    const subjByHash = subjectsForHashes(uniqueHashes)
    // 2026-09-18:逐条明细上限 —— 本地 5000+ tag 时全量打印会刷屏(实测 352 KB/次提交)
    const DETAIL_LIMIT = 10
    for (const tag of detailedTags) {
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
  if (remoteUndetermined) {
    console.log(
      `    ${C.red}❌ UNDETERMINED(未判定):ls-remote 失败/超时(${remoteScan.reason || '原因未取到'})—— 远程 tag 完整性本次没判成,不得计为绿${C.reset}`,
    )
  } else if (remoteCheckSkipped) {
    console.log(
      `    ${C.dim}(本门默认不发网络:远程 tag 完整性按设计跳过,不纳入本次判定;显式检查用 IHUI_COMMIT_LOSS_REMOTE=1)${C.reset}`,
    )
  } else {
    console.log(
      `  ${C.dim}远端 lost-commit/*: ${remoteLostTags.length} 个 | 远端 backup/*: ${remoteBackups.length} 个${C.reset}`,
    )
  }

  // 5.1 lost-commit 差异
  console.log(`\n  ${C.bold}lost-commit/* 差异:${C.reset}`)
  if (remoteUndetermined) {
    console.log(`    ${C.dim}(远程校验未判定:ls-remote 未取到,见上方)${C.reset}`)
  } else if (remoteCheckSkipped) {
    console.log(`    ${C.dim}(远程校验未纳入本次判定,见上方)${C.reset}`)
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
  if (remoteUndetermined) {
    console.log(`    ${C.dim}(远程校验未判定:ls-remote 未取到,见上方)${C.reset}`)
  } else if (remoteCheckSkipped) {
    console.log(`    ${C.dim}(远程校验未纳入本次判定,见上方)${C.reset}`)
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
  if (reachability.length === 0) {
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

  mark('sections-1-3-printed')

  // ── 4. 综合判定 ──
  console.log(header('4. 综合判定'))

  let blocking = false
  const issues = []
  // 逐路径覆盖的「未判定」档必须活到最外层出口:它决定 exit 2,且优先级高于判红档。
  // (下面的放行分档在 `if (unreachable.length > 0)` 块内,块内 const 到不了 2832 的出口。)
  let undeterminedCoverage = new Map()

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
    mark('backedTrees')
    // 性能:批量取 subject(同 filterStashLike 的 --no-walk 分批法),
    // 再对仍未放行者一次批量取 tree,避免逐 commit 派生.
    // ③ 同内容副本白名单(G-1018289②,2026-10-08)也在这条链里:经过 ①② 仍未放行的悬空
    // commit 中,有一型是"并发会话 amend/rebase 重写后滞留的旧对象" —— 它的树与题在
    // **可达历史**里有一份逐字同的活体,gc 吃掉它不丢任何内容。旧判据把这一型也算
    // "未备份悬空"压到本次提交头上,是台账 G-1018289② 登记的那格恒红温床。判据 =
    // `git log --all` 的 (树,题) 键集两元同时相等;索引取不到(log 派生失败/空读数)
    // ⇒ 白名单整体失效,维持 blocking(fail-safe 朝红,绝不朝绿)。
    // 白名单放行**不静默**:逐条点名打在 stdout(见下方 whitelistedSameContent 打印)。
    const {
      unbacked,
      whitelistedSameContent,
      treeEquivalentResidual,
      pathCovered,
      pathCoverageGaps,
      pathCoverageUndetermined,
      subjectByHash,
    } = (() => {
      const candidates = unreachable.filter((c) => !backedUp.has(c))
      // ① subject 内嵌原 hash 匹配(stash-like 指向已备份 base)
      // 2026-10-30:原为 BATCH=50 的 argv 分批 ⇒ 本仓 15,947 枚候选 = 220 次派生 ≈ **109 秒**,
      // 是 filterStashLike 治好后暴露出来的最大单段。改走同一出口 subjectsForHashes 一次派生。
      mark(`unbacked-candidates(${candidates.length})`)
      const subjectByHash = subjectsForHashes(candidates)
      const survivors = []
      for (const c of candidates) {
        const subject = subjectByHash.get(c) || ''
        const origHash = extractOriginalHashFromStash(subject)
        if (origHash && backedUp.has(origHash)) continue
        survivors.push(c)
      }
      const whitelistedSameContent = []
      const treeEquivalentResidual = []
      const pathCovered = []
      const pathCoverageGaps = new Map()
      const pathCoverageUndetermined = new Map()
      if (survivors.length === 0)
        return {
          unbacked: survivors,
          whitelistedSameContent,
          treeEquivalentResidual,
          pathCovered,
          pathCoverageGaps,
          pathCoverageUndetermined,
          subjectByHash,
        }
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
          // ③ 的两种同内容残留(树+题逐字同 / 仅树逐字同)由纯函数分档,见
          // splitReachableSameContent 头注:后者同样"内容整体已入库",不得判红。
          const split = splitReachableSameContent({
            candidates: rest,
            treeByCommit,
            subjectByHash,
            reachableKeys,
            reachableTrees: reachableTreeSet(reachableKeys),
          })
          rest = split.remaining
          whitelistedSameContent.push(...split.sameContent)
          treeEquivalentResidual.push(...split.treeEquivalent)
        }
        // ④ 逐路径覆盖放行(2026-11-04):取代原「整树逐字相等」判据。
        // 并发提交夹带让悬空提交的树与任何可达提交都不同,但它的每条改动路径的 blob 可能都已在
        // 可达面同路径上 ⇒ 内容没丢。判定与取材分离:derive 只派生数据,split 做纯判定。
        // 排除集必须是**全部悬空 commit**(含被 filter-stash 滤掉的):它们会出现在 HEAD reflog,
        // 若算作覆盖面,任何悬空提交都能自证通过。
        if (rest.length > 0) {
          mark(`path-coverage(${rest.length})`)
          const derived = derivePathCoverage(rest, {
            excludedCommits: new Set(rawUnreachable),
          })
          const splitPaths = splitByPathCoverage({
            candidates: rest,
            entriesByCommit: derived.entriesByCommit,
            coverage: derived.coverage,
            latestByPath: derived.latestByPath,
            problemsByCommit: derived.problemsByCommit,
            surfaceError: derived.surfaceError,
            ambiguousPaths: derived.ambiguousPaths,
          })
          pathCovered.push(...splitPaths.covered)
          // 未判定(=同秒并列导致"最新状态"不存在)的**既不进放行也不进判红**:
          // 它们留在外面单独成档,由主链落 exit 2(没判完 ≠ 判红,也绝不许折成绿)。
          for (const u of splitPaths.undetermined) pathCoverageUndetermined.set(u.hash, u)
          for (const u of splitPaths.uncovered) pathCoverageGaps.set(u.hash, u)
          rest = splitPaths.uncovered.map((u) => u.hash)
          mark(`path-coverage-done(covered=${pathCovered.length},undetermined=${pathCoverageUndetermined.size})`)
        }
      }
      return {
        unbacked: rest,
        whitelistedSameContent,
        treeEquivalentResidual,
        pathCovered,
        pathCoverageGaps,
        pathCoverageUndetermined,
        subjectByHash,
      }
    })()
    undeterminedCoverage = pathCoverageUndetermined
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
    // 等价残留(树与可达提交逐字同、题不同):内容整体已入库,只有提交身份/题未入库。
    // 与上面 ③ 一视同仁**不判红**,但必须点名报数 —— 静默放行会让"确实有对象滞留"这件事
    // 从账面上消失(与 30c 静默放行同一型教训)。
    if (treeEquivalentResidual.length > 0) {
      console.log(
        `  ${C.dim}↳ 等价残留 ${treeEquivalentResidual.length} 个(树与可达提交逐字同、题不同:内容未丢,仅提交身份未入库,非丢失风险):${C.reset}`,
      )
      for (const c of treeEquivalentResidual.slice(0, 10)) {
        const subj = subjectByHash.get(c) || ''
        console.log(
          `  ${C.dim}   ↳ 等价:${C.cyan}${c.slice(0, SHORT_HASH_LEN)}${C.reset} ${C.dim}${subj.slice(0, 80)}${C.reset}`,
        )
      }
    }
    // 逐路径覆盖放行(2026-11-04):与"等价残留"同样不阻塞,但证据必须逐条可见 ——
    // 判绿时也要能回答"哪条路径由哪个可达提交覆盖",否则下一次判红无从复核。
    if (pathCovered.length > 0) {
      console.log(
        `  ${C.dim}↳ 逐路径覆盖放行 ${pathCovered.length} 个(相对 parent 的每条改动路径,其 blob 均能在可达面同路径找到逐字同副本:内容未丢,仅提交身份未入库):${C.reset}`,
      )
      for (const { hash, evidence } of pathCovered.slice(0, 10)) {
        const subj = subjectByHash.get(hash) || ''
        console.log(
          `  ${C.dim}   ↳ 放行:${C.cyan}${hash.slice(0, SHORT_HASH_LEN)}${C.reset} ${C.dim}${subj.slice(0, 80)}${C.reset}`,
        )
        for (const e of evidence) {
          const blobPart = e.blob ? ` blob=${e.blob.slice(0, SHORT_HASH_LEN)}` : ''
          const coverPart = e.commit
            ? ` ← ${e.commit.slice(0, SHORT_HASH_LEN)} (${e.surface})`
            : ' ← ?'
          console.log(`  ${C.dim}        ${e.status} ${e.path}${blobPart}${coverPart}${C.reset}`)
        }
      }
    }
    if (unreachable.length > 0) {
      // 分档出处一览(2026-11-03 判据补细;2026-11-04 增"逐路径覆盖"档):
      // 已备份 / 同内容副本 / 等价残留 / 逐路径覆盖 / 待处置。
      // 逐档报数是为了让"门绿了"仍能读出存量里有几枚对象滞留、各是什么出处。
      const backedOut =
        unreachable.length -
        whitelistedSameContent.length -
        treeEquivalentResidual.length -
        pathCovered.length -
        unbacked.length -
        // 未判定档必须先扣掉:否则它会以余项形态被算进"已备份"(那是把它读成有出处 =
        // 往绿折),而它真实的语义是"没判完"。
        undeterminedCoverage.size
      // 只有真的出现逐路径覆盖档才加这一桶:老仓的存量账(0 枚)保持原有行形状,
      // 免得下游按行解析的消费者(以及镜像测试)因为多一个 0 而读不到。
      const coverageBucket = pathCovered.length > 0 ? ` / 逐路径覆盖 ${pathCovered.length}` : ''
      const undeterminedBucket =
        undeterminedCoverage.size > 0 ? ` / 未判定 ${undeterminedCoverage.size}` : ''
      console.log(
        `  ${C.dim}↳ 悬空分档:已备份 ${backedOut} / 同内容副本 ${whitelistedSameContent.length}` +
          ` / 等价残留 ${treeEquivalentResidual.length}${coverageBucket}` +
          `${undeterminedBucket} / 待处置 ${unbacked.length}${C.reset}`,
      )
    }
    if (unbacked.length > 0) {
      // ── 时间窗量纲(2026-10-11 立,缘由与三条不许漂的写法见 WINDOW_DAYS_* 头注)──
      // 只问"窗内新产生的、且无出处的悬空"要谁负责;超窗那部分是 §29 写明的人工 GC 存量,
      // 逐枚算在每个提交者头上,得到的从来不是备份,是全员跳门(§12f)。
      const walked = committerUnixFor(unbacked)
      mark('window-begin')
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
        // L11052(2026-10-14 拍板 no-auto-gc):存量水位基线对照——超基线只黄色报数,不判红、不删对象。
        const verdict = baselineVerdict(win.outOfWeek.length)
        const verdictText =
          verdict === 'over'
            ? `${C.yellow}超基线(+${win.outOfWeek.length - DANGLING_STOCK_BASELINE.count} 枚)${C.reset}`
            : `${C.dim}未超基线${C.reset}`
        console.log(
          `  ${C.dim}↳ §29 存量基线对照(G-1080898,${DANGLING_STOCK_BASELINE.decided} 拍板 ${DANGLING_STOCK_BASELINE.policy}):` +
            `基线 ${DANGLING_STOCK_BASELINE.count} 枚/最老 (${DANGLING_STOCK_BASELINE.oldest || '无'}) ⇒ 本次现读 ${win.outOfWeek.length} 枚,${verdictText}${C.reset}`,
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
          // 2026-11-04 判据要求:判红必须点名"哪条路径的哪个 blob 没找到覆盖",并给出可直接
          // 执行的复核命令。逐枚全量打印(不受上面 10 枚上限约束),否则被截断的那几枚无从处置。
          for (const c of win.blocking) {
            const gap = pathCoverageGaps.get(c)
            if (!gap) continue
            if (gap.reason)
              console.log(`  ${C.yellow}   逐路径复核未判:${gap.reason}${C.reset}`)
            // 先列该枚已覆盖的路径(如有):判红读数要能一眼分清"整枚都没覆盖"与"只差几条"。
            for (const e of gap.evidence || []) {
              const blobPart = e.blob ? ` blob=${e.blob.slice(0, SHORT_HASH_LEN)}` : ''
              const coverPart = e.commit ? ` ← ${e.commit.slice(0, SHORT_HASH_LEN)} (${e.surface})` : ''
              console.log(
                `  ${C.dim}   ↳ 已覆盖:${e.status} ${e.path}${blobPart}${coverPart}${C.reset}`,
              )
            }
            for (const m of gap.missing || []) {
              const blobPart = m.blob ? ` blob=${m.blob.slice(0, SHORT_HASH_LEN)}` : ''
              console.log(
                `  ${C.yellow}   ↳ 未覆盖:${m.status} ${m.path}${blobPart} — ${m.reason}${C.reset}`,
              )
              console.log(
                `  ${C.dim}      复核:git log --all --raw --no-renames -- "${m.path}"${C.reset}`,
              )
            }
          }
        }
        blocking = true
      } else if (win.outOfWeek.length > 0) {
        // 窗维把整批都判成超窗 ⇒ 不是"没风险",是"这一档不由提交链拦"。必须留一行可见结论,
        // 否则下一个会话读到的就是"门绿了",而近万枚存量在账面上蒸发。
        issues.push(
          `${win.outOfWeek.length} 个未 tag 备份的悬空 commit 全部超出 ${winDim.days} 天窗` +
            `(§29 人工 GC 存量,默认档只报数;问责 --strict / 全量 --window-days 0)`,
        )
      } else if (unreachable.length > 0 && undeterminedCoverage.size === 0) {
        // 全部有出处时的措辞按档分流:纯 tag 备份那档保留原句(dangling-commit-autotag
        // 认档吃这句);含等价残留时点名,避免把"内容已入库、只是提交身份没入库"
        // 读成"tag 备份了"。分档明细另有一行恒打印(见上方「悬空分档」)。
        issues.push(
          treeEquivalentResidual.length === 0 && pathCovered.length === 0
            ? `${unreachable.length} 个悬空 commit 已全部 tag 备份(防止 git gc 清理)`
            : `${unreachable.length} 个悬空 commit 已全部有出处(已备份 / 同内容副本 / 等价残留 ${treeEquivalentResidual.length}` +
              ` / 逐路径覆盖 ${pathCovered.length});等价残留与逐路径覆盖的内容均未丢,仅提交身份未入库`,
        )
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
      `${lostTagDiff.onlyRemote.length} 个 lost-commit tag 仅远端(本地缺失)${remoteHeal.coolingDown ? '—— 冷却窗内未补拉(远端留存即安全,不影响判定)' : remoteHeal.degraded ? '—— fetch 未成功,已降级为警告' : ',需 fetch'}`,
    )
    if (!remoteHeal.degraded) blocking = true
  }
  if (backupTagDiff.onlyRemote.length > 0) {
    issues.push(
      `${backupTagDiff.onlyRemote.length} 个 backup tag 仅远端(本地缺失)${remoteHeal.coolingDown ? '—— 冷却窗内未补拉(远端留存即安全,不影响判定)' : remoteHeal.degraded ? '—— fetch 未成功,已降级为警告' : ',需 fetch'}`,
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

  if (remoteUndetermined) {
    // 显式发起却没取到 ⇒ 未判定(§0.3)。故意**不写结论缓存**:缓存只存"红/绿"两态,
    // 没有"没判成"这一态;写进去等于下一轮把它读成绿。
    issues.push(
      `远程 tag 完整性未判定(ls-remote 失败/超时:${remoteScan.reason || '原因未取到'})—— 未判定不计绿`,
    )
  }

  // 未判定项存在时**绝不打印通过句**:issues 为空不代表"判完了"(§0.3 未判定≠通过)。
  if (issues.length === 0 && undeterminedCoverage.size === 0) {
    console.log(`  ${C.green}✅ ${GREEN_MARKERS.noRisk}${C.reset}`)
    process.exit(0)
  }

  for (const i of issues) {
    console.log(`  ${C.yellow}⚠  ${i}${C.reset}`)
  }

  // 未判定档(2026-11-04 立):逐路径覆盖遇到"同秒并列、取谁都会改变 D 判定"的路径。
  // 实测 `git log --all --raw` 的第一条会随 ref 名改变(夹具反例见镜像用例),所以"先到者"
  // 不是拓扑结论。这一档**既不打印通过句、也不写结论缓存**,并且优先于判红档落 exit 2:
  // 有未判定项时,整道门就是"没判完"(§12e),不能因为恰好还有别的判红项就把它读成已判红。
  if (undeterminedCoverage.size > 0) {
    console.log(
      `\n${C.red}${C.bold}❌ UNDETERMINED: 同秒并列的删除判定不可判定(` +
        `${undeterminedCoverage.size} 个悬空 commit)${C.reset}`,
    )
    for (const [h, u] of [...undeterminedCoverage].slice(0, 10)) {
      console.log(
        `   ${C.yellow}↳ 未判定:${C.cyan}${h.slice(0, SHORT_HASH_LEN)}${C.reset}` +
          ` 路径=${u.paths.join(', ')}${C.reset}`,
      )
      console.log(`     ${C.dim}${u.reason}${C.reset}`)
    }
    console.log(
      `   ${C.dim}这不是判红,也不是放行:"最新状态"因同秒并列不存在。` +
        `人工核对这两条同一路径的改动(或把它们各自 tag 备份)后重跑;本轮不写结论缓存${C.reset}`,
    )
    process.exit(2)
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
    writeLossCache({ ts: Date.now(), head: currentHeadSha(), blocking: true, summary: issues.join('; ') })
    process.exit(1)
  }

  // 判完但有确定判红项(ex. 仅本地 tag)时走原有 warn 档;唯独"显式发起却取不到"的远端档
  // 必须 exit 2 —— 那一档没有结论,不能顺着 warn 档滑到 0(§0.3 未判定≠通过)。
  if (remoteUndetermined) {
    console.log(
      `\n${C.red}${C.bold}❌ UNDETERMINED: 远程 tag 完整性未判定,本次结论不得记绿${C.reset}`,
    )
    console.log(`   ls-remote 未取到:${remoteScan.reason || '失败/超时'}`)
    console.log(
      `   ${C.dim}网络恢复后重跑:node scripts/check-commit-loss-guard.mjs(或 IHUI_COMMIT_LOSS_REMOTE=1 显式复核)${C.reset}`,
    )
    process.exit(2)
  }

  console.log(`\n${C.yellow}💡 建议:${C.reset}`)
  console.log(`   - 备份悬空 commit:${C.cyan}git tag lost-commit/<name> <hash>${C.reset}`)
  console.log(`   - 查看丢失历史:${C.cyan}git tag -l "lost-commit/*" && git show <tag>${C.reset}`)
  console.log(`   - 详细规则见 AGENTS.md §22`)
  writeLossCache({
    ts: Date.now(),
    head: currentHeadSha(),
    blocking: false,
    summary: `无 reset;悬空 commit ${unreachable.length} 枚均在窗外或已备份;tag 完整`,
  })
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
  reflogRefOf,
  dropBackedResets,
  // 悬空 commit 分类
  UNREACHABLE_COMMIT_PREFIX,
  UNREACHABLE_COMMIT_LINE_RE,
  parseUnreachableCommitLines,
  parseTreeSubjectIndex,
  // 同内容残留分档(2026-11-03):树+题逐字同 / 仅树逐字同 / 待处置
  reachableTreeSet,
  splitReachableSameContent,
  // 逐路径覆盖(2026-11-04):取代「整树相等」放行判据的解析与判定
  parseRawDiffZ,
  splitByPathCoverage,
  derivePathCoverage,
  // 时间窗量纲(2026-10-11):判据、取值、派生出口三者都必须可被测试直接消费,
  // 免得镜像那边再抄一份"cutoff = now - days*86400"的算术 —— 抄的那份不与源同步。
  WINDOW_DAYS_DEFAULT,
  WINDOW_DAYS_ENV,
  WINDOW_DAYS_FLAG,
  // L11052 存量水位基线(2026-10-14 拍板 no-auto-gc)
  DANGLING_STOCK_BASELINE,
  baselineVerdict,
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
