// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 判定面取材的共用底层(2026-09-25 立)。
 *
 * 为什么要有这一层:守门 70/77/83/91/94/98/100/101 全都收敛到同一口径 ——
 * 「全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱」。
 * 但实现此前一人一份(94 / 101 / 91 各写过一个 `makeFaceReader`),而**易错的部分恰好是同一批**:
 *
 *   1. git 二进制必须是**绝对路径**。GUI 宿主 / LocalSystem 服务账户的 PATH 与交互终端不通
 *      (AGENTS §5b"git 调用不得依赖环境")。实测三格里只有一格当初写对了,
 *      守门 80 只查 `timeout` 不查裸 `'git'`,所以这条**没有任何门会红** —— 只能靠单一实现兜住。
 *   2. `cat-file --batch` 的 `stdio[0]` 必须是 `pipe`。设成 `'ignore'` 会让 git 读到空输入,
 *      于是每个 rev 都"取不到"—— 一个环境问题伪装成业务结论(守门 101 真仓自验时踩过)。
 *   3. 逐文件派生 git 在真仓是上千次进程创建(§5b fork 风暴同型),所以必须**一次 batch 读完一批**,
 *      且 `read()` 遇到未预取的路径要**抛**而不是偷偷补一次派生 —— 否则退化被掩盖成正常。
 *   4. 仓库根比较要先穿 junction。本机 DevEnv 系改道(§26)使同一目录有两个字面写法,
 *      只比 `path.resolve` 会把正常仓判成"基准错位"。
 *   5. `maxBuffer` 必须给足:真仓语言包单文件已实测 1,080,001 字节,默认 1MB 会被截成"读不出/仓库坏了"。
 *
 * 本层**只提供原语**,不规定各门的对外 API(94 要 `{relPath,lang}`、101 要 `has/listDir`、
 * 91 要 `.tsx` 枚举)—— 强行统一对外形状会让三门的镜像测试一起改语义,那是重构事故不是收口。
 */

import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { resolveGitBin } from './gitdir.mjs'

export const FACES = ['staged', 'head', 'worktree']

export const FACE_LABEL = {
  staged: '索引 blob(git show :<path>)',
  head: 'HEAD blob(git show HEAD:<path>)',
  worktree: '工作树(磁盘)',
}

/** 各面的"为什么"。写进结论行,免得下一个人把某一面当成偷懒。 */
export const FACE_NOTE = {
  staged: '盘上随后改对不算修好:提交进去的仍是索引这一份',
  head: '不判滞后的共享工作树(与守门 70/77/83/98 同口径)',
  worktree: '人工排查逃生舱:盘上内容可能属于并行会话的半编辑态,不得作为提交门禁',
}

/** 判据取不到输入时抛它 —— 调用方折成 exit 2「无法判定」,既不冒红也绝不记绿。 */
export class Undetermined extends Error {}

const GIT = resolveGitBin() || 'git'
const GIT_TIMEOUT = 60000
const BATCH_TIMEOUT = 120000
/** 64MB:真仓单文件最大已实测 >1MB,默认 1MB 会把大 blob 截成"取不到" */
const GIT_MAX_BUFFER = 64 << 20
/**
 * 每块最多 2500 个规格 —— 这只是**条数**护栏(防止一批几千个小文件挤成一次巨大派生),
 * 真正防溢出的是下面的字节预算。依据是实测而不是估算:2026-09-25 按 500 条/块切分时第 4 块仍
 * `ENOBUFS` —— 那 500 个 blob 恰好都是大文件,合计超过默认 64MB。候选集里有什么,取材层预料不了,
 * 所以块大小必须由字节说话,条数只当上限。
 *
 * 2026-10-12 提速:500 → 2500(与字节预算同向放宽)。10296 个候选时旧值切出 21 块,
 * 每块一次子进程,Windows 上 git 启动 + 管道往返合计吃掉 ~8s;放宽后同一批切 3 块。
 * 防溢出语义**没有放松**:超预算的老路径(按字节切、单条巨型自成一块、ENOBUFS 抛错)原样保留。
 */
const CAT_BATCH_CHUNK = 2500

/**
 * 显式临时绕开代理(2026-10-26 立;`--no-proxy` 旗标的取值)。
 * 立因:AGENTS §0.8「文档不得写跑不通的出路」——当天给的出路是"手打 `git -c http.proxy= …`",
 * 而收敛器/推送守卫**不吃**这个参数,人照着敲只会再撞一次。这里给一条真跑得通的通道:
 * 调用方设 `process.env.IHUI_GIT_NO_PROXY='1'`(或由 `--no-proxy` 旗标置上)⇒ 本层所有
 * **网络动词**第一趟就带摘代理配置(仍然只碰网络动词、不改任何持久配置、不碰代理客户端)。
 * ⚠️ 这是**单次进程内的临时绕过**,不是"把代理关掉"的开关 —— 长期修法仍是恢复代理节点或由机主改配置。
 * (刻意**不**在此处引用 GIT_EGRESS_DIRECT_ARGS:那个常数在下面才定义,顶层引用会踩 TDZ。)
 */
export function isForceDirect() {
  return process.env.IHUI_GIT_NO_PROXY === '1'
}
/**
 * 单块累计字节预算:必须小于默认 64MB,留出一条巨型 blob 也装得下的余量。
 * 2026-10-12:16MB → 48MB。单块 maxBuffer 取 `max(64MB, 本块字节+1MB)`(见 catBatchRaw),
 * 48MB 块落进 64MB 缓冲,余量 = 16MB ≥ 表头开销(每条 ~50B × 2500 ≈ 1.25MB)。
 */
const BATCH_BLOCK_BYTES = 48 << 20
const HASH_RE = /^([0-9a-f]{40}) blob (\d+)$/

export function gitBinary() {
  return GIT
}

// ─── 代理腿退化 ⇒ 直连兜底(2026-10-26 立;判据唯一出口,消费点只有下面的 gitRaw) ───
/**
 * 立因(本机当次实测,不是推断):仓库级 `http.proxy=http://127.0.0.1:7897`(verge-mihomo 在听),
 * 成组对照 20 次 = 20 次 `Recv failure: Connection was aborted`,而**同一条 URL 摘掉代理直连回 200**
 * ⇒ 本地 19 枚提交积压推不出去、与远端双向分叉,`push-state.json` 只留下一句"退出码 128 且无
 * 可辨认特征"(§12f:失效的表现永远是安静)。
 *
 * 为什么收在这一层而不是 git-push-guard:全仓 git 派生都从 `gitRaw` 走(converge 的 `git()`、
 * guardian 自愈轮、post-commit 推送腿、各类尺子的取材面)。只修推送那一格,fetch 当天照样在死
 * (§0.6 单一真相源:两处各写一份判据必然漂移)。
 *
 * 三条边界(缺一条就退化成"多放一次跳门"那一型,§0.10):
 *  ① 只碰**网络动词** —— `cat-file` / `rev-parse` 这类本地失败绝不补第二趟派生,
 *     否则等于把"仓库本身坏了"洗成"第二次也失败"。
 *  ② 只在**传输形态**的错误上兜 —— 远端拒收/分支保护/竞态/钩子失败各有专档
 *     (判序在 `lib/push-attempt-triage.mjs`),这里绝不把服务器裁决换成"换个腿再试一次"。
 *  ③ **只多跑一次**,兜底仍失败就抛**第一次**的错误 —— 失效方向是多要一次定向说明(留痕),
 *     不是多放一次。特征串刻意不含 `[rejected]` 这类服务器侧用语。
 *
 * 零持久改动:不碰机主的 git 配置、不碰代理客户端,只在**这一趟派生**用 `-c http.proxy=` 覆盖
 * (argv 传空值合法;env 传空值在 Windows 会被吃掉 —— 当天实测)。
 */
export const GIT_EGRESS_NETWORK_VERBS = Object.freeze([
  'fetch',
  'pull',
  'push',
  'ls-remote',
  'clone',
  'fetch-pack',
  'archive',
])

/** 摘代理重跑时注入的配置串(与 gitRaw 前置的 safe.directory 并列,git 多 -c 累积)。 */
export const GIT_EGRESS_DIRECT_ARGS = Object.freeze(['-c', 'http.proxy=', '-c', 'https.proxy='])

/**
 * 传输形态特征串:逐条取自 git/curl 对"连不上/链路被切"的原话形态,含本机当天实测的
 * `Recv failure: Connection was aborted` 与 `unable to access`。**不含**服务器裁决用语。
 */
export const GIT_EGRESS_TRANSPORT_RE =
  /(recv failure|send failure|connection was aborted|could not connect|failed to connect|connection reset by peer|connection timed out|tls connect error|ssl connection|empty reply from server|proxy (?:auth|unreachable)|unable to access)/i

/**
 * "网络形状"的统一判据(2026-10-26 第二次实测补):
 *  - 快速失败:回显是传输形态 ∧ 退出码 128;
 *  - **挂死到超时**:`status` 为 null / code=ETIMEDOUT 且**没有任何回显**(当天实测 `--no-proxy`
 *    第一趟 200s 零输出被 timeout 杀掉)—— 这一型过去既不换腿也不留痕,把失效做成了安静(§12f)。
 * 只认这两型;服务器裁决(403/GH006/`[rejected]`)与"仓库坏了"(`not a git repository`)仍落 false。
 */
export function isTransportEgress({ errText = '', status = null, timedOut = false } = {}) {
  if (timedOut) return true
  if (status !== 128) return false
  return GIT_EGRESS_TRANSPORT_RE.test(errText)
}

/**
 * 纯判据(零 IO,便于镜像测试逐格钉):这一趟该不该**换腿**重跑。
 * 两个方向共用同一把尺子(缺对称格就是"只兜一个方向"的偏判):
 *  - 第一趟走的是代理 ⇒ 失败时换**直连**(`useDirectArgs: true`,即摘代理);
 *  - 第一趟走的是直连(`--no-proxy`,或调用方自己带了摘代理参数)⇒ 失败时换回**代理腿**
 *    (`useDirectArgs: false`) —— 2026-10-26 实测:显式绕过后若只剩代理腿能用,不兜这一格
 *    就把"我明明有腿"判成"无法判定远端位置",收敛器整轮白跑。
 * @param {{verb?:string, errText?:string, status?:number|null, proxyUrl?:string,
 *          alreadyDirect?:boolean, usedDirect?:boolean, timedOut?:boolean, attempt?:number}}
 * @returns {{apply:boolean, why:string, useDirectArgs:boolean}}
 */
export function egressFallbackPlan({
  verb = '',
  errText = '',
  status = null,
  proxyUrl = '',
  alreadyDirect = false,
  usedDirect = false,
  timedOut = false,
  attempt = 0,
} = {}) {
  if (!GIT_EGRESS_NETWORK_VERBS.includes(verb)) {
    return {
      apply: false,
      why: `动词 ${verb || '(空)'} 不碰网络 ⇒ 不补第二趟`,
      useDirectArgs: false,
    }
  }
  if (attempt > 0) {
    return {
      apply: false,
      why: '兜底只多跑一次 ⇒ 第二次仍失败就如实上报,不得连环换腿',
      useDirectArgs: usedDirect,
    }
  }
  const proxy = String(proxyUrl ?? '').trim()
  // 网络形状只有一个口径(见 isTransportEgress):快速失败(128+传输回显)与挂死到超时同罪。
  const networkShaped = isTransportEgress({ errText, status, timedOut })
  // ── 方向 A:失败的那一趟走的是直连 ⇒ 唯一可换的腿是代理 ──
  if (usedDirect || alreadyDirect) {
    if (!networkShaped) {
      return {
        apply: false,
        why: `退出码 ${String(status)} 且回显既非传输形态也非挂死 ⇒ 交既有分档处理`,
        useDirectArgs: true,
      }
    }
    if (!proxy) {
      return {
        apply: false,
        why: '直连这趟已失败,而仓内没配 http.proxy ⇒ 没有另一条腿可换,失败就是失败',
        useDirectArgs: true,
      }
    }
    return {
      apply: true,
      why: `直连腿不通(第一趟已走直连),而仓内配了代理 ${proxy} ⇒ 换回代理腿重跑一次`,
      useDirectArgs: false,
    }
  }

  // ── 方向 B:失败的那一趟走的是代理 ⇒ 唯一可换的腿是直连 ──
  if (!proxy) {
    return {
      apply: false,
      why: '没配 http.proxy ⇒ 不存在"退化腿"可摘,失败就是失败',
      useDirectArgs: false,
    }
  }
  if (!networkShaped) {
    return {
      apply: false,
      why: `退出码 ${String(status)} 且回显既非传输形态也非挂死 ⇒ 交既有分档(拒收/策略/竞态/钩子)处理`,
      useDirectArgs: false,
    }
  }
  return {
    apply: true,
    why: `配了代理 ${proxy} 且回显是网络失败形态 ⇒ 摘代理直连重跑一次`,
    useDirectArgs: true,
  }
}

/** 该 root 生效中的 http.proxy(每进程缓存一次;读不到 ⇒ 空串 ⇒ 不兜,绝不猜)。 */
const egressProxyCache = new Map()
export function proxyConfiguredFor(root) {
  if (egressProxyCache.has(root)) return egressProxyCache.get(root)
  let value = ''
  try {
    value = String(
      batchExecFileSync(
        GIT,
        ['-c', 'safe.directory=*', '-C', root, 'config', '--get', 'http.proxy'],
        {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 10000,
          maxBuffer: 1 << 20,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      ),
    ).trim()
  } catch {
    value = ''
  }
  egressProxyCache.set(root, value)
  return value
}

/** 留痕存活期(天)。超窗按行首 ISO 时刻裁;裁掉的条数写回同一本账,**不往 stdout/stderr 打** ——
 *  本层被全仓几百把尺子共用,守门按 stdout/stderr 做逐字基线比对,漏一行就是把诊断混进判定里。 */
export const EGRESS_LEDGER_KEEP_DAYS = 30

/**
 * 退化留痕的存活期(§0.7「豁免会到期」同一纪律,日志也一样:只增不减的账本迟早没人看)。
 * 30 天足够覆盖一次"代理腿抖动 ↔ 直连兜底"的归因窗口;超窗行按 ISO 前缀裁掉。
 * 刻意**只裁带合法 ISO 时刻的行**:解析不出时刻 ⇒ 保留(失效方向是多留,不是静默删证据)。
 * @param {string} text 整份日志文本
 * @param {{nowMs?:number, keepDays?:number}} [opts]
 * @returns {{text:string, kept:number, dropped:number}}
 */
export function pruneEgressLedger(text, { nowMs = Date.now(), keepDays = EGRESS_LEDGER_KEEP_DAYS } = {}) {
  const cutoff = nowMs - keepDays * 86400_000
  const lines = String(text ?? '').split('\n')
  const kept = []
  let dropped = 0
  for (const line of lines) {
    if (!line) continue
    // ⚠️ 时刻取「行首到第一个制表符」这一段:写成 slice(0, slice(0,i)) 会把字符串当长度传进去
    //    ⇒ 恒 NaN ⇒ 老化形同虚设(镜像测试 ⑤ 正是钉这一格的,别顺手"优化"回去)
    const tab = line.indexOf('\t')
    const stamp = tab > 0 ? line.slice(0, tab) : line.slice(0, 24)
    const ts = Date.parse(stamp)
    if (Number.isFinite(ts) && ts < cutoff) {
      dropped += 1
      continue
    }
    kept.push(line)
  }
  return { text: kept.length ? `${kept.join('\n')}\n` : '', kept: kept.length, dropped }
}

/** 退化留痕:兜住了也要看得见(写不动不影响判定,只回 null)。 */
function noteEgressDegradation({ root, verb, plan, ok }) {
  try {
    const file = path.join(root, '.ihui-agent', 'state', 'git-egress-degradation.log')
    mkdirSync(path.dirname(file), { recursive: true })
    appendFileSync(
      file,
      `${new Date().toISOString()}\tverb=${verb}\tfallback=${ok ? 'recovered' : 'both-failed'}\t依据=${plan?.why ?? '(无)'}\n`,
      'utf8',
    )
    // 超窗老化:每次写入顺手裁,不做第二次调度器(本文件的教训:关键自愈别挂到会自己消失的东西上)。
    // 被裁条数必须报名 —— 静默丢行等于"账本看起来一直完整"。
    const raw = readFileSync(file, 'utf8')
    const pruned = pruneEgressLedger(raw)
    if (pruned.dropped > 0) {
      // 被裁条数**写进账本自己**(不 print):本层被全仓几百把尺子共用,任何一行 stdout/stderr
      // 都会混进守门的逐字基线比对(§12f:失效的表现永远是安静 —— 但治它不能靠制造噪声)。
      // marker 行本身带合法 ISO 时刻 ⇒ 30 天后照样老化,账本不会长歪。
      writeFileSync(
        file,
        `${pruned.text}${new Date().toISOString()}\tcad=prune\tdropped=${pruned.dropped}\tkept=${pruned.kept}\tkeepDays=${EGRESS_LEDGER_KEEP_DAYS}\n`,
        'utf8',
      )
    }
    return file
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 并发档一过性取材失败的**串行退避重试**(2026-10-27 立,守门 84/107/117/243 同批次红的
// 清偿)。立因(现读 `gates-progress.log` 实证,不是推断):同一道门在同一批里 pass 与 fail
// 交替出现且耗时跨两个数量级(84:509ms pass ↔ 228285ms fail;117:108692ms pass ↔
// 142553ms fail;243:72179ms pass ↔ 259137ms fail;107 亦在 16:28:18 与 84/117 同刻整排 fail)
// ⇒ 形状是"并发抢不到派生/IO 资源"的一过性失败,而单跑复验全绿。门体把这种失败读成违规
// 判红,按 §12e/§12f 那正是会逼人 `--no-verify` 的形状。
//
// 三条边界(与既有 egress 换腿同一条纪律,缺一条就退化成"多放一次跳门"):
//  ① **只重试只读动词**(下表)。写动词(add/commit/checkout/reset/update-index/…)绝不重跑 ——
//     重跑一次写操作等于把"可能已落了一半"的状态再写一遍。
//  ② **不碰网络动词**:那一族已有 `egressFallbackPlan` 的换腿通道,再加重试就是两条兜底叠床架屋。
//  ③ **只认一过性形态**:超时被杀(ETIMEDOUT)、派生面 EBUSY、以及"无退出码+无信号+无回显"
//     (并发下 git 连启动都没启动完那一型)。git 自己给的结论(如 status 128 + `fatal:`)照旧
//     一次就抛 —— 那是真失败,重试只是把同一个错多付一次。
//  ④ **只多跑两次**,仍失败就抛**第一次**的错误(失效方向是如实报第一次失败,不是"再多放一次")。
// ─────────────────────────────────────────────────────────────────────────────
export const GIT_RETRY_READ_VERBS = Object.freeze([
  'log',
  'show',
  'cat-file',
  'ls-tree',
  'ls-files',
  'rev-parse',
  'diff',
  'hash-object',
  'for-each-ref',
  'show-ref',
  'grep',
  'merge-base',
  'status',
])
export const GIT_RETRY_MAX_ATTEMPTS = 2
/** 退避:150ms → 450ms(串行退避,不并发重跑 —— 并发重跑只会把抢资源那一型再撞一次) */
export const GIT_RETRY_BACKOFF_MS = Object.freeze([150, 450])

/** 同步退避(取材面全是 sync 派生,不能用 await)。写不动/不支持则立即返回,不因此改判定。 */
export function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  } catch {
    /* 退避失败不阻断重试语义 */
  }
}

/**
 * 纯判据(零 IO,便于镜像测试逐格钉):这一趟失败该不该**串行退避重跑**。
 * @param {{verb?:string, code?:string|null, status?:number|null, signal?:string|null,
 *          stderrText?:string, attempt?:number, maxAttempts?:number}} p
 * @returns {{apply:boolean, why:string, delayMs:number}}
 */
export function gitRetryPlan({
  verb = '',
  code = null,
  status = null,
  signal = null,
  stderrText = '',
  attempt = 0,
  maxAttempts = GIT_RETRY_MAX_ATTEMPTS,
} = {}) {
  if (!GIT_RETRY_READ_VERBS.includes(verb))
    return {
      apply: false,
      why: `动词 ${verb || '(空)'} 不在只读重试表 ⇒ 不重跑(写动词/网络动词绝不多跑一次)`,
      delayMs: 0,
    }
  if (attempt >= maxAttempts)
    return { apply: false, why: `已重试 ${attempt}/${maxAttempts} 次仍失败 ⇒ 如实上报`, delayMs: 0 }
  const timedOut = code === 'ETIMEDOUT' || /ETIMEDOUT/i.test(String(code ?? ''))
  const spawnBusy = code === 'EBUSY'
  // 无退出码 + 无信号 + 无回显 = 派生面连 git 都没跑完(并发下 `git log` 无输出那一型)。
  const noVerdict = status === null && signal === null && String(stderrText ?? '').trim() === ''
  if (!timedOut && !spawnBusy && !noVerdict)
    return {
      apply: false,
      why: `退出码 ${String(status)} 且 git 有回显 ⇒ 这是 git 的结论/真失败,不是一过性`,
      delayMs: 0,
    }
  const shape = timedOut ? '超时被杀' : spawnBusy ? '派生面 EBUSY' : '无退出码无回显'
  return {
    apply: true,
    why: `${shape} ⇒ 串行退避重跑(第 ${attempt + 1}/${maxAttempts} 次)`,
    delayMs: GIT_RETRY_BACKOFF_MS[Math.min(attempt, GIT_RETRY_BACKOFF_MS.length - 1)],
  }
}

/**
 * 统一 git 派生:绝对路径 + safe.directory + quotepath(中文路径)+ windowsHide + 数字 timeout
 * + **显式 stdio**。
 *
 * ⚠️ stdio 必须显式接管:`execFileSync` 默认把子进程 stderr **直接透到父进程 stderr**
 * (实测:空仓里 `rev-parse --verify HEAD` 漏出 32 字节 `fatal: Needed a single revision`)。
 * 守门靠 stdout/stderr 做逐字基线比对与归因取证,漏一行就把"取数失败"混进判定输出里 ——
 * 而错误文本本来已在 `e.stderr` 内、由 gitErrText 收进 Undetermined 消息,不需要它再漏一遍。
 *
 * 外层只负责**一过性失败的串行退避重试**(判据与边界见 `gitRetryPlan`);单趟派生的全部
 * 语义(stdio 两态、egress 换腿、Undetermined 抛出)仍住在 `gitRawOnce`,逐字未改。
 */
export function gitRaw(args, root, opts = {}) {
  const maxAttempts = opts.retryMax ?? GIT_RETRY_MAX_ATTEMPTS
  let first = null
  let retryNote = ''
  for (let attempt = 0; ; attempt++) {
    try {
      return gitRawOnce(args, root, opts)
    } catch (e) {
      if (attempt === 0) first = e
      const errStatus = typeof e?.status === 'number' ? e.status : null
      const errSignal = e?.signal ?? null
      const plan = gitRetryPlan({
        verb: String(args[0] ?? ''),
        code: e?.code ?? null,
        status: errStatus,
        signal: errSignal,
        stderrText: e?.stderr === undefined || e?.stderr === null ? '' : String(e.stderr),
        attempt,
        maxAttempts,
      })
      if (!plan.apply) {
        // 重试过但没救回来 ⇒ 把"试过几次、为什么不算数"并进第一次错误的话里(§0.3 未判定
        // 必须点名原因:只报一句 `git log 失败` 看不出这是重试两趟后的结论)。只增诊断,
        // 不改判定 —— 仍抛**第一次**的错误,失效方向是如实报第一次失败,不是"再多放一次"。
        if (retryNote && first && !first.retryNote) {
          first.retryNote = retryNote
          first.message = `${first.message}(已${retryNote}仍失败)`
        }
        throw first ?? e
      }
      retryNote = plan.why
      sleepSync(plan.delayMs)
    }
  }
}

/** `gitRaw` 的单趟实现(原 `gitRaw` 函数体逐字搬入,判定语义一字未改)。 */
function gitRawOnce(args, root, opts = {}) {
  // stdio[0] 分两态:不带 input 时 'ignore'(继承会挂),带 input 时**必须** 'pipe' ——
  // 这正是 `cat-file --batch` / `hash-object --stdin-paths` 那一族的老陷阱:stdio[0] 设成
  // 'ignore' 时喂进去的清单被丢弃,而 git 不报错,只是"每个对象都取不到"。
  // 两态都写死,不给调用方留"顺手删掉 stdio"的空间。
  const stdio = opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  // 显式绕过(调用方 `--no-proxy` / `IHUI_GIT_NO_PROXY=1`)时**第一趟就直连**:
  // 代理腿已确认死的情况下,再让它先烧一次 21s 超时纯属浪费(guardian 巡检轮当天实测每轮都付这笔)。
  const forceDirect = Boolean(opts.forceDirect) || isForceDirect()
  const runOnce = (extraArgs) =>
    batchExecFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...extraArgs, '-C', root, ...args],
      {
        cwd: root,
        encoding: opts.binary ? 'buffer' : 'utf8',
        windowsHide: true,
        timeout: opts.timeout ?? GIT_TIMEOUT,
        maxBuffer: opts.maxBuffer ?? GIT_MAX_BUFFER,
        stdio,
        ...(opts.input === undefined ? {} : { input: opts.input }),
      },
    )
  try {
    return runOnce(forceDirect ? GIT_EGRESS_DIRECT_ARGS : [])
  } catch (e) {
    /**
     * ENOENT 有两种成因,Node 的文本只点名**二进制**("spawnSync <git.exe> ENOENT"),
     * 而另一一种是 `cwd` / `-C` 指向的目录不存在 —— 实测把 `runAudit(repoRoot, face)` 的参数序
     * 写反就得到同一句,于是排查方向被整个带去"IDE 自带 git 被升级烂掉了"。两种都点名,
     * 只改可诊断性,不改判定(仍然抛 Undetermined,不会因此少判一次)。
     */
    // ── 网络腿退化 ⇒ 换腿重跑一次(判据与三条边界见 egressFallbackPlan 的头注) ──
    // 第一趟走的是直连(forceDirect / 调用方自带摘代理)⇒ 这趟要换回代理腿;反之换直连。
    // timedOut:挂死到超时没有退出码也没有回显,必须同样算"网络形状"(2026-10-26 实测 200s 零输出)。
    const egressErrText = gitErrText(e)
    const egressStatus = typeof e?.status === 'number' ? e.status : null
    const timedOut =
      e?.code === 'ETIMEDOUT' || /ETIMEDOUT/i.test(String(e?.message ?? '')) || !egressErrText
    const firstTriedDirect = forceDirect || args.includes('http.proxy=')
    const plan = egressFallbackPlan({
      verb: String(args[0] ?? ''),
      errText: egressErrText,
      status: egressStatus,
      timedOut,
      proxyUrl: proxyConfiguredFor(root),
      alreadyDirect: firstTriedDirect,
      usedDirect: firstTriedDirect,
      attempt: opts.egressAttempt ?? 0,
    })
    if (plan.apply) {
      try {
        const out = runOnce(plan.useDirectArgs ? GIT_EGRESS_DIRECT_ARGS : [])
        const log = noteEgressDegradation({ root, verb: String(args[0] ?? ''), plan, ok: true })
        if (log) e.egressNote = log
        return out
      } catch {
        // 两条腿都不通 ⇒ 落到下面,回吐**第一次**的 git 原话(失效方向是如实报第一次失败,
        // 不是"再多放一次");留痕照写,让"两条腿都断"这件事看得见。
        noteEgressDegradation({ root, verb: String(args[0] ?? ''), plan, ok: false })
      }
    } else if (
      GIT_EGRESS_NETWORK_VERBS.includes(String(args[0] ?? '')) &&
      isTransportEgress({ errText: egressErrText, status: egressStatus, timedOut })
    ) {
      // 网络形状成立但没有另一条腿可换(没配代理 / 显式绕过 / 已换过一次)⇒ 也必须留痕,不得静默。
      // ⚠️ 必须先过动词表:本地动词(`for-each-ref` 等)失败时 stderr 也可能撞出"connection reset"字样
      //    (当天实测把 `fallback=both-failed 依据=动词不碰网络` 记进了账本) —— 那是在账上造脏行。
      noteEgressDegradation({ root, verb: String(args[0] ?? ''), plan, ok: false })
    }
    const hint = e?.code === 'ENOENT' ? `(git 二进制或该 root 不可达:root=${root})` : ''
    const err = new Undetermined(`git ${args[0]} 失败: ${gitErrText(e)}${hint}`)
    // **退出码必须带上来**:`git grep` 无命中、`git diff --quiet` 无差异这类是 git 的正常非零结论,
    // 调用方要能区分"git 说没有"与"git 没跑成"。只给一句错误文本会逼调用方去 parse 自己的异常消息
    // (把结论建立在字符串上),而 e.status 是 Node 直接给的机器事实。
    if (typeof e?.status === 'number') err.status = e.status
    // 兜底为什么没生效,原样带在异常上:问责时不用重新猜(只增诊断,不改任何判定)。
    err.egressPlan = plan
    throw err
  }
}

/**
 * 一次 `cat-file --batch-check` 问一批对象的存在性(只回 sha/type/size,不回内容)。
 * 与 `catBatch` 同族的陷阱,所以在同一处收口:rev 清单靠 `stdio[0]='pipe'` 喂进去、
 * maxBuffer 给足、windowsHide、数字 timeout。
 * @returns {{missing:Set<string>, total:number}} 读不到的行一律不计 missing(宁漏不误伤推送)
 */
export function catBatchCheck(root, oids) {
  const list = [...new Set(oids)].filter((s) => /^[0-9a-f]{7,40}$/i.test(s))
  if (list.length === 0) return { missing: new Set(), total: 0 }
  let out
  try {
    out = batchExecFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch-check'], {
      input: Buffer.from(list.join('\n') + '\n', 'utf8'),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: GIT_MAX_BUFFER,
      timeout: BATCH_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Undetermined(
      `git cat-file --batch-check 失败(${list.length} 个对象): ${gitErrText(e)}`,
    )
  }
  const missing = new Set()
  for (const line of String(out).split(/\r?\n/)) {
    if (!/\bmissing\b/.test(line)) continue
    const head = line.split(' ')[0]
    if (head) missing.add(head)
  }
  return { missing, total: list.length }
}

/**
 * 一次 `cat-file --batch-check` 把一批**任意对象规格**解成 oid(不是内容)。
 * 与 `catBatchCheck` 的分工:那个只答"哪些不存在"(给推送前的存活预检用),本出口答
 * "`<rev>:<path>` / `<oid>^{tree}` 各是什么 oid"(比较 blob sha 的判据要用,如守门 84)。
 * 所以本出口**不做** hex-only 过滤 —— 那会把 `<oid>^{tree}` 这类合法规格整型丢掉。
 *
 * 输出与输入**按行对齐**,所以直接按索引回填;`missing` 与空行都归 null(交调用方判"取不到")。
 * @returns {Map<string, string|null>}
 */
export function catBatchOids(root, specs, opts = {}) {
  const map = new Map()
  const list = [...specs]
  if (list.length === 0) return map
  let out
  try {
    out = batchExecFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch-check'], {
      cwd: root,
      input: Buffer.from(list.join('\n') + '\n', 'utf8'),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: opts.maxBuffer ?? GIT_MAX_BUFFER,
      timeout: opts.timeout ?? BATCH_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Undetermined(
      `git cat-file --batch-check 失败(${list.length} 个规格),${root} 的判定面无法取材: ${gitErrText(e)}`,
    )
  }
  const lines = String(out).split('\n')
  list.forEach((spec, i) => {
    const line = (lines[i] || '').trim()
    // `--batch-check` 对**不存在**的规格回的是 `<原规格> missing`(整行只写 missing 的是裸 oid 形态),
    // 所以两种都要归 null。只判 `=== 'missing'` 会把规格原文当成 oid 返回 —— 那是一个
    // "看起来有值、永远不相等"的第三种状态,守门 84 的旧实现正好一直处在这一状态(它比较的是
    // sha,取到规格串与取到 null 结果相同,故实测无行为差;新出口按正确的判序写)。
    if (!line || line === 'missing' || /\smissing$/.test(line)) {
      map.set(spec, null)
      return
    }
    map.set(spec, line.split(' ')[0])
  })
  return map
}

/**
 * 一次 `cat-file --batch-check=%(objectname) %(objecttype)` 问一批对象的**类型**。
 * 与 `catBatchCheck`(只答哪些不存在)和 `catBatchOids`(只答 oid)的分工:本出口答
 * "这个 sha 是 commit 还是 blob/tree"。审计类判据要区分「绑到一枚提交」与「绑到一个别的对象」,
 * 用标准 `--batch-check` 只能拿到"存在",会把 blob 误当成提交。
 *
 * 为什么必须在层里(2026-10-26):型 C 尺子把任何 `['cat-file', '--batch…']` 自拼都记成债,
 * 而每自拼一次就要重写 stdio[0]=pipe / maxBuffer / 头解析 —— 这三处本仓都真踩过(见文件头)。
 *
 * 输出与输入按行对齐;missing 行与空行归 null。key 统一小写(调用方用小写 sha 取值)。
 * @returns {Map<string, string|null>}
 */
export function catBatchTypes(root, oids) {
  const list = [...new Set(oids)]
  const map = new Map()
  if (list.length === 0) return map
  let out
  try {
    out = batchExecFileSync(
      GIT,
      [
        '-c',
        'safe.directory=*',
        '-C',
        root,
        'cat-file',
        '--batch-check=%(objectname) %(objecttype)',
      ],
      {
        cwd: root,
        input: Buffer.from(list.join('\n') + '\n', 'utf8'),
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: GIT_MAX_BUFFER,
        timeout: BATCH_TIMEOUT,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
  } catch (e) {
    throw new Undetermined(
      `git cat-file --batch-check 失败(${list.length} 个对象): ${gitErrText(e)}`,
    )
  }
  const lines = String(out).split('\n')
  list.forEach((spec, i) => {
    const line = (lines[i] || '').trim()
    if (!line || line === 'missing' || /\smissing$/.test(line)) {
      map.set(spec.toLowerCase(), null)
      return
    }
    const [sha, type] = line.split(/\s+/)
    map.set((sha || spec).toLowerCase(), type || null)
  })
  return map
}

export function gitErrText(e) {
  const raw = e?.stderr ?? e?.stdout ?? e?.message ?? String(e)
  const text = String(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')).trim()
  const first = text.split(/\r?\n/)[0]
  if (first) return first
  // 空正文 ≠「git 没说话」。超时(SIGTERM)、资源耗尽(ENOMEM/ENOBUFS)时原因住在
  // signal/code/errno 上,而 stderr 是**空字符串**(不是 nullish,`??` 不会回退)——
  // 旧写法把这一类一律折成「(git 无输出)」,2026-10-28 实测它在守护日志里堆了 145 条,
  // 把「派生 git 慢到超时」这条可整改的真因洗成了噪声。
  // 只在**没有正常退出码**时补元信息:status 有值说明 git 正常退出,那句话确实是"没输出",
  // 而 `check-staged-deletions` / `check-glyph-arrow-icon` 的零命中断言逐字依赖它。
  if (typeof e?.status === 'number') return '(git 无输出)'
  const meta = [
    e?.signal && `signal=${e.signal}`,
    e?.code && `code=${e.code}`,
    e?.errno && `errno=${e.errno}`,
    e?.message && `message=${String(e.message).split('\n')[0].slice(0, 160)}`,
  ]
    .filter(Boolean)
    .join(' ')
  return meta ? `(git 无输出;${meta})` : '(git 无输出)'
}

/**
 * EBUSY 病窗兜底(2026-10-01 立):把 `input` 写进临时文件,子进程 stdio[0] 直接指向该文件的
 * **fd**。fd 不是管道,病窗(只杀 Node 建 stdin 管道,与父 stdin 形态无关)实测不发病;病窗内
 * "stdin 管道假成功产空输出"的事故形态也一并绕开 —— 内容躺在文件里,git 读到的必然是全文。
 * 先例:`scripts/lib/agent-event-coverage.mjs` 的 `catBatchViaTempStdinFile`(矩阵 6/6 验证)。
 * 返回 spawnSync 的原始结果;**不抛** —— 由 `batchExecFileSync` 翻译成 execFileSync 的错误形状。
 */
export function spawnViaTempStdinFile(file, args, opts) {
  const tmpDir = path.join(opts.cwd ?? '.', '.ihui-agent', 'tmp')
  mkdirSync(tmpDir, { recursive: true })
  const tmp = path.join(
    tmpDir,
    `face-reader-stdin-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  )
  let fd = -1
  try {
    // input 缺省(不带 stdin 的派生)写空文件:fd 指向空文件与 stdio[0]='ignore' 语义等价
    //(命令不读 stdin 就无所谓),换来的是**无 input 的派生在 EBUSY 病窗同样有兜底** ——
    // 否则 writeFileSync(tmp, undefined) 会抛 TypeError,把"兜底"变成第二个故障点(2026-10-02 补)。
    writeFileSync(tmp, opts.input ?? Buffer.alloc(0))
    fd = openSync(tmp, 'r')
    const { input: _dropped, stdio: _stdio, ...rest } = opts
    return spawnSync(file, args, { ...rest, stdio: [fd, 'pipe', 'pipe'] })
  } finally {
    if (fd >= 0) {
      try { closeSync(fd) } catch {}
    }
    try { unlinkSync(tmp) } catch {}
  }
}

/**
 * batch 出口的统一派生包装:**主路径仍是带 input 的 execFileSync(stdio[0]='pipe')**,
 * 形态锁判据(`scripts/tests/face-reader.test.mjs` 的 stdio[0]=pipe / input: Buffer.from( /
 * timeout / maxBuffer floor 四项)照旧在调用点逐字可见;唯一的行为变化是 —— 派生层报 **EBUSY**
 * 时,换 `spawnViaTempStdinFile` 的临时文件 fd 通道重试一次。判断条件只认 `e.code === 'EBUSY'`:
 * ENOENT(git 二进制/根不可达)、ENOBUFS(maxBuffer 命中)等其它派生故障**原样抛**,绝不把
 * 真故障吞成一次"重试过了"。
 */
export function batchExecFileSync(file, args, opts = {}) {
  // 只读派生不抢 index.lock(2026-10-13 立):git status/diff 默认会"顺手"刷新索引 stat
  // 缓存 ⇒ 需抢 index.lock。大量并行 agent 高频轮询时与彼此的 add/commit 撞锁,而提交钩子
  // (lint-staged + 守门批查,全程 ~140s)持锁窗口长 ⇒ 反复把提交打断重来(2026-10-13 实证:
  // 同一批 40 次 status,带 GIT_OPTIONAL_LOCKS=0 时锁命中 10/200 采样,不带则 101/200)。
  // 该开关只关"可选锁",add/commit/checkout 的必需锁不受影响 ⇒ 写路径语义不变;调用方仍可
  // 用 opts.env 显式覆盖(极少数确需 stat 刷新的场景)。放在收口层 = 一处改动覆盖全仓守门脚本。
  const opts2 = {
    ...opts,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...(opts.env ?? {}) },
  }
  try {
    return execFileSync(file, args, opts2)
  } catch (e) {
    if (e?.code !== 'EBUSY') throw e
    const r = spawnViaTempStdinFile(file, args, opts2)
    if (r.error) {
      const err = new Error(`${r.error.message} (EBUSY 兜底通道重试仍失败)`)
      err.code = r.error.code
      err.cause = r.error
      throw err
    }
    if (r.status !== 0) {
      const err = new Error(`Command failed: ${args.join(' ')}\n${String(r.stderr ?? '')}`)
      err.status = r.status
      err.signal = r.signal
      err.stdout = r.stdout
      err.stderr = r.stderr
      err.output = [r.stdout, r.stderr]
      throw err
    }
    return r.stdout
  }
}

/**
 * `cat-file --batch-check` 的**三态**头解析(纯函数,与派生分开 —— `ambiguous` 与"行序错位"两支
 * 在真仓里造不出来,只能构造证明)。
 *
 * 与 `parseBatchCheckSizes` / `catBatchOids` 的分工:那两个答"多大 / 是哪枚 oid",本出口答
 * "git 认不认得这枚规格、认成了谁",所以它必须分得出**三态**而不是两态:
 *  - `resolvable` —— git 回显了全量 oid,且它以输入为前缀(缩写被展开);
 *  - `unresolvable` —— git 明说 missing,且**同时回显输入原样**(否则是行序错位);
 *  - `undetermined` —— `ambiguous`(缩写撞号,git 自己认不出指哪个对象)、前缀对不上、行数为 0。
 * 后两态里 `undetermined` **绝不并进 `unresolvable`**:把"没判"写成"判过了"是本仓最高频的失效型,
 * 而 `--batch-check` 恰好是唯一会老实告诉你"我分不清"的探测形态。
 * 行数与输入不等 ⇒ 抛 `Undetermined`(输出被截断 ≠ 对象不存在)。
 *
 * ⚠️ 解析成功那一支的判序是 **"回显的 40 hex 必须以输入为前缀"**，不是反过来的那一句。
 * 本仓曾把这条写反(把"回显以输入开头"当成失败回显)，结果是**全仓所有短 sha 都落未判定**，
 * 而账面读起来像"探测不可靠" —— 判据自己的假阴不会报错,只会让每一维都变成"没判"。
 *
 * 为什么这要把尺子住在层里而不是住在门里:守门 118 记过「管子共用不等于面共用」—— 借 `gitRaw`
 * 派生却自己重写头解析,仍是半接线;本仓 `--batch-check` 的解析此前已有三份,第四份必然漂开。
 * @returns {Map<string,'resolvable'|'unresolvable'|'undetermined'>}
 */
export function parseBatchCheckStates(stdout, specs) {
  const map = new Map()
  const lines = String(stdout)
    .split(/\r?\n/)
    .filter((l) => l !== '')
  if (lines.length !== specs.length) {
    throw new Undetermined(
      `cat-file --batch-check 输出 ${lines.length} 行 ≠ 输入 ${specs.length} 条 ⇒ 无法判定(不是"都不存在")`,
    )
  }
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]
    const line = lines[i]
    if (/(?:^|\s)ambiguous(?:\s|$)/.test(line)) {
      map.set(spec, 'undetermined')
    } else if (/(?:^|\s)missing(?:\s|$)/.test(line)) {
      map.set(spec, line.startsWith(spec) ? 'unresolvable' : 'undetermined')
    } else {
      const m = /^([0-9a-f]{40})[ \t]/.exec(line)
      map.set(spec, m && m[1].startsWith(spec) ? 'resolvable' : 'undetermined')
    }
  }
  return map
}

/**
 * 层内 `cat-file --batch-check` 的**唯一**派生出口(供 `catBatchStates` / `catBatchEcho` 共用)。
 *
 * 为什么不用 `gitRaw`:本层的形态锁要求**每个 batch 调用点自己看得见** stdio[0]=pipe /
 * `input: Buffer.from(` / 数字 timeout / maxBuffer 四项 —— 它防的正是"靠别处保证了"这种推理
 * (`gitRaw` 的 stdio 是按 `opts.input` 有无分两态算出来的,调用点上看不见,而 stdio[0]='ignore'
 * 喂进清单时 git **不报错**,只是每个对象都"取不到")。委派少四行,换来的是判据对整型出口失明,
 * 这笔账不划算;所以这里与三个同族出口(`catBatchCheck` / `catBatchOids` / `catBatchSizes`)同形。
 * 错误消息仍与 `gitRaw` 逐字同形(`git cat-file 失败: ` 前缀 + ENOENT 那一档补 root),
 * 因为调用方的报告把这句话原样打进"探测失败"一行,换出口不得换措辞。
 *
 * ⚠️ 四个属性必须**写成显式形态**而不是 `timeout,` 这类简写 —— 本层的形态锁按字面读它们,
 * 简写不会让锁变绿而是让锁看不见下限(实测第一次就红在这一条)。
 */
function runBatchCheck(root, input, opts = {}) {
  try {
    return batchExecFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, 'cat-file', '--batch-check'],
      {
        cwd: root,
        input: Buffer.from(input, 'utf8'),
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: opts.maxBuffer ?? GIT_MAX_BUFFER,
        timeout: opts.timeout ?? BATCH_TIMEOUT,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
  } catch (e) {
    const hint = e?.code === 'ENOENT' ? `(git 二进制或该 root 不可达:root=${root})` : ''
    const err = new Undetermined(`git cat-file 失败: ${gitErrText(e)}${hint}`)
    if (typeof e?.status === 'number') err.status = e.status
    throw err
  }
}

/**
 * 一次(分批)`cat-file --batch-check` 问完一批规格的三态存在性 —— 只问"在不在 / 认不认得",不取正文。
 * 去重与切块都在这里:输出按行对齐,一批过大时一次挂起会换成整门失明,所以宁可分块多次问。
 * 派生走层内那一个出口(`runBatchCheck`),三态解析走 `parseBatchCheckStates`。
 */
export function catBatchStates(root, specs, opts = {}) {
  const list = [...new Set(specs)]
  const status = new Map()
  const chunkSize = opts.chunkSize && opts.chunkSize > 0 ? opts.chunkSize : 400
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize)
    const out = runBatchCheck(root, chunk.join('\n') + '\n', { timeout: opts.timeout })
    for (const [k, v] of parseBatchCheckStates(out, chunk)) status.set(k, v)
  }
  return status
}

/**
 * 单枚规格的 **git 原话首行**,只为报告可读,不改判据 —— 所以它**不抛**:取不到就回一句带原因的文本。
 * 失败文本与调用方自己 catch `runBatchCheck` 的异常时逐字同形(换出口不得换措辞)。
 */
export function catBatchEcho(root, spec, opts = {}) {
  try {
    const out = runBatchCheck(root, spec + '\n', { timeout: opts.timeout ?? 20_000 })
    return String(out).split(/\r?\n/)[0] || '(空)'
  } catch (e) {
    return `(探测失败:${e?.message ?? e})`
  }
}

/**
 * 把 `execFileSync` 抛出的**派生层故障**翻成可诊断的一句话(纯函数,与真实 git 分开,所以每一支都能构造)。
 *
 * 为什么必须有这一层:2026-09-25 实测,守门 99 对"以删除为主的提交"一路报 `无法取材: (git 无输出)`,
 * 现场像是 git 坏了。真因是**一次批量读 11,182 个索引 blob 超过默认 64MB**,`execFileSync` 抛
 * `ERR_CHILD_PROCESS_STDOUT_MAXBUFFER` 而 stderr 为空 —— 旧写法把 e.stderr 折成 `(git 无输出)`,
 * 于是"我自己的缓冲区太小"被表达成"git 什么都没写"。一个把自己病因说反的层,会把每个调用方
 * 都带去查错的方向(与 §5d "读不到文件被下游报成凭据失效"同族)。
 */
export function spawnCauseText(e, maxBuffer, chunkLabel) {
  const code = e?.code
  const raw = String(e?.message ?? '')
  // Node 把"子进程输出超过 maxBuffer"报成 `ENOBUFS`(并且顺手 SIGTERM 掉子进程),
  // 而**超时**报成 `ETIMEDOUT`。两者都带 signal,所以必须先按 code 分流:
  // 把缓冲区溢出误标成"派生超时",会让人去加 timeout 参数,而真实缺口在块大小上。
  if (code === 'ENOBUFS' || code === 'ERR_CHILD_PROCESS_STDOUT_MAXBUFFER' || /maxBuffer/i.test(raw))
    return (
      `单块输出超过 maxBuffer(${maxBuffer}B)——不是 git 没输出,是本层缓冲区不足(${chunkLabel});` +
      `调 opts.maxBytes / opts.maxBuffer`
    )
  if (code === 'ETIMEDOUT') return `git 派生超时(${chunkLabel},code=${code})`
  return gitErrText(e)
}

/**
 * 按**字节**装箱(纯函数,构造面即可证明,不依赖真仓大小)。
 *
 * 为什么不能只按条数分块:2026-09-25 实测 500 条/块仍会 `ENOBUFS` —— 块里挤进几个大文件就破 64MB。
 * 判据覆盖面不该由"这一批里恰好有多少大文件"决定,所以规格数与累计字节**两个上限都要守**;
 * 单条自身就超过 maxBytes 时单独成块(绝不丢弃 —— 丢了就是一道静默少扫的假绿)。
 */
export function packByBytes(specs, sizeOf, opts = {}) {
  const maxBytes = opts.maxBytes ?? BATCH_BLOCK_BYTES
  const maxCount = opts.maxCount ?? CAT_BATCH_CHUNK
  if (!Number.isFinite(maxBytes) || maxBytes < 1) throw new Undetermined(`maxBytes 必须是 ≥1 的整数,实得 ${String(opts.maxBytes)}`)
  if (!Number.isFinite(maxCount) || maxCount < 1) throw new Undetermined(`maxCount 必须是 ≥1 的整数,实得 ${String(opts.maxCount)}`)
  const blocks = []
  let cur = []
  let curBytes = 0
  for (const spec of specs) {
    const size = Math.max(0, Number(sizeOf(spec)) || 0)
    if (cur.length && (cur.length >= maxCount || curBytes + size > maxBytes)) {
      blocks.push(cur)
      cur = []
      curBytes = 0
    }
    cur.push(spec)
    curBytes += size
    if (cur.length >= maxCount || curBytes >= maxBytes) {
      blocks.push(cur)
      cur = []
      curBytes = 0
    }
  }
  if (cur.length) blocks.push(cur)
  return blocks
}

/**
 * `cat-file --batch` 的头解析(纯函数,与派生分开,这样"截断"那条分支能被构造出来测)。
 * 抽出来之前它埋在 `catBatch` 里,而截断需要"git 少写字节但不报错"这种真实管道事故才能触发 ——
 * 于是这条分支从来没有被证明过有牙。判据分支不可构造 = 判据未被验证。
 * @returns {Map<string,string|null>}
 */
export function parseBatch(out, revs) {
  const map = parseBatchBuffers(out, revs)
  for (const [k, v] of map) {
    if (v !== null) map.set(k, v.toString('utf8'))
  }
  return map
}

/**
 * parseBatch 的**字节保真**核心(G-467,2026-10-01 落地):返回 `Map<rev, Buffer|null>`,
 * 绝不 `toString('utf8')` —— `E4 B8 3F 41` 这类字节经 utf8 解码会变成 `\uFFFD?A`,
 * 偏移、字节值、"第 3 字节是 0x3F"全部销毁。"判字节/判哈希"的门(如 UTF-8 完整性)
 * 只能用本出口或 `catBatchBinary`,走 utf8 出口等于把门做瞎。
 * 判据分支与 `parseBatch` 逐字同构:截断先填满剩余 null 再抛,绝不静默少扫。
 * @returns {Map<string,Buffer|null>}
 */
export function parseBatchBuffers(out, revs) {
  const map = new Map()
  let pos = 0
  for (let i = 0; i < revs.length; i++) {
    const rev = revs[i]
    const nl = out.indexOf(0x0a, pos)
    if (nl < 0) {
      // **输出被截断 ≠ 对象不存在**。git 对每一条输入都会写一条头,所以在读完 revs 之前
      // 拿不到下一行,只可能是管道断了(maxBuffer 命中 / Windows 侧写失败)。
      // 旧写法 `set(rev,null) + break` 有两个后果:① 当前这条被当成"取不到";② **后面的 rev 根本没进 Map**,
      // 于是调用方 `.get()` 拿到 `undefined`,凡是"取不到就 continue"的判据都从此**静默少扫** ——
      // 少扫不红,是一道假绿。守门 93 早就在自己那份实现里修过这件事(注释还在),
      // 而收口成一层之后,这个正确行为必须由层统一提供,否则每道门各修一遍、各漏一遍。
      for (let k = i; k < revs.length; k++) map.set(revs[k], null)
      throw new Undetermined(
        `cat-file --batch 输出在第 ${i}/${revs.length} 个对象处截断 ⇒ 无法判定(不是"没有违规",是"没看完")`,
      )
    }
    const header = out.subarray(pos, nl).toString('utf8')
    pos = nl + 1
    const m = HASH_RE.exec(header)
    if (!m) {
      map.set(rev, null) // "<rev>:<path> missing" / "fatal: ... is unmerged"
      continue
    }
    const size = Number(m[2])
    map.set(rev, out.subarray(pos, pos + size))
    pos += size + 1
  }
  return map
}

/**
 * `cat-file --batch-check` 的头解析(纯函数,与派生分开 —— "某条 missing"这一支只能构造证明)。
 * 行格式 `<oid> blob <size>`;missing / unmerged / 目录树都归 null。
 */
export function parseBatchCheckSizes(out, specs) {
  const map = new Map()
  const lines = String(out).split('\n')
  ;[...specs].forEach((spec, i) => {
    const m = /^\S+ blob (\d+)$/.exec((lines[i] || '').trim())
    map.set(spec, m ? Number(m[1]) : null)
  })
  return map
}

/** 先问一遍大小(输出只有几十字节/条),这样后面的读**按字节装箱**而不是按条数瞎切。 */
export function catBatchSizes(root, specs, opts = {}) {
  const list = [...specs]
  if (list.length === 0) return new Map()
  let out
  try {
    out = batchExecFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch-check'], {
      cwd: root,
      input: Buffer.from(list.join('\n') + '\n', 'utf8'),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: opts.maxBuffer ?? GIT_MAX_BUFFER,
      timeout: opts.timeout ?? BATCH_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Undetermined(
      `git cat-file --batch-check 失败(${list.length} 个规格),${root} 的判定面无法取材: ${spawnCauseText(e, opts.maxBuffer ?? GIT_MAX_BUFFER, '取大小')}`,
    )
  }
  return parseBatchCheckSizes(out, list)
}

/**
 * 一次读完一批对象,返回 `Map<rev, text|null>`;missing / unmerged / 非 blob 一律 null,
 * 由调用方判"取不到"(本层不代替业务结论)。
 *
 * **调用方的候选集大小从来不是本层能预料的**,所以这里按字节装箱:先用 `--batch-check`
 * 问一遍大小(输出每条约几十字节),再按 `min(opts.maxBytes, 16MB)` + 条数上限切块,
 * 每块给子进程的 maxBuffer 取 `max(调用方给的, 本块字节数 + 1MB)`。
 * 因此 ① 单条巨型 blob 仍能读出(不会被"默认值"判成取不到),② 一批几千个大文件也不会
 * 再让整门 `无法判定`。2026-09-25 立:此前不分块时,守门 99 对"以删除为主的提交"一路报
 * `(git 无输出)`,真因是 11,182 个候选 blob 超过默认 64MB,而层把 `ENOBUFS` 折成了那句话。
 * 超限/超时一律**抛**(见 `spawnCauseText`),绝不静默降级成"每个 rev 都取不到" ——
 * 那会被下游读成"没有违规",是一道假绿。
 */
export function catBatch(root, revs, opts = {}) {
  const raw = catBatchRaw(root, revs, opts)
  for (const [k, v] of raw) {
    if (v !== null) raw.set(k, v.toString('utf8'))
  }
  return raw
}

/**
 * **二进制安全的批量读取出口**(G-467,2026-10-01 落地):与 `catBatch` 同档同轮同装箱
 * (字节装箱 / maxBuffer floor / 超限抛),唯一区别是返回 `Map<rev, Buffer|null>` ——
 * 不做任何字符解码。任何"判字节/判哈希"的门(如 check-api-client-utf8 的 UTF-8 完整性)
 * 必须走它:走 `catBatch` 等于把门做瞎(`E4 B8 3F 41` → `\uFFFD?A`),不走层会被守门 118
 * 判 half-wired —— 本出口就是那一档的 sanctioned 通路。
 * @returns {Map<string,Buffer|null>}
 */
export function catBatchBinary(root, revs, opts = {}) {
  return catBatchRaw(root, revs, opts)
}

/** `catBatch` / `catBatchBinary` 共用的派生与装箱实现;返回字节面,解码交给出口。 */
function catBatchRaw(root, revs, opts = {}) {
  const list = [...revs]
  if (list.length === 0) return new Map()
  const maxBuffer = opts.maxBuffer ?? GIT_MAX_BUFFER
  // 单块预算取 min(默认块上限, 调用方给的缓冲区) —— 调用方把 maxBuffer 调大只该让它
  // **更敢读**,不该反过来把块撑大到一个 blob 就能顶爆的量。
  const maxBytes = opts.maxBytes ?? Math.min(BATCH_BLOCK_BYTES, maxBuffer)
  const sizes = list.length > 1 ? catBatchSizes(root, list, opts) : new Map()
  const bytesOf = (s) => sizes.get(s) ?? 0
  const blocks = packByBytes(list, bytesOf, {
    maxBytes,
    maxCount: opts.chunkSize ?? CAT_BATCH_CHUNK,
  })
  const out = new Map()
  let seen = 0
  for (let c = 0; c < blocks.length; c++) {
    const part = blocks[c]
    // 给子进程的实际缓冲区 = max(调用方的, 本块字节数 + 1MB 余量):单条巨型 blob 因此
    // 仍能读出来,而不是被"默认值"判成取不到。
    const budget = Math.max(maxBuffer, part.reduce((a, s) => a + bytesOf(s), 0) + (1 << 20))
    let raw
    try {
      raw = batchExecFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch'], {
        cwd: root,
        input: Buffer.from(part.join('\n') + '\n', 'utf8'),
        windowsHide: true,
        maxBuffer: budget,
        timeout: opts.timeout ?? BATCH_TIMEOUT,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (e) {
      throw new Undetermined(
        `git cat-file --batch 失败,${root} 的判定面无法取材(第 ${c + 1}/${blocks.length} 块,${part.length} 个规格): ${spawnCauseText(e, budget, `块 ${c + 1}/${blocks.length}`)}`,
      )
    }
    for (const [k, v] of parseBatchBuffersWithOffset(raw, part, seen)) out.set(k, v)
    seen += part.length
  }
  return out
}

/** 复用纯解析器 `parseBatchBuffers`(字节保真),只把"第几块"补进截断消息,便于定位是哪一段没读完。 */
function parseBatchBuffersWithOffset(out, revs, offset) {
  try {
    return parseBatchBuffers(out, revs)
  } catch (e) {
    if (e instanceof Undetermined)
      throw new Undetermined(`${e.message}(规格起点 ${offset},块长 ${revs.length})`)
    throw e
  }
}

/**
 * 同一个目录吗 —— 先各自 realpath 穿过 junction / 符号链接,再按平台大小写敏感性比。
 * §26 的改道机制使 `D:\DevEnv\...` 与 junction 旧路径指向同一实体,只比字面路径会误判。
 */
export function sameDir(a, b) {
  const norm = (p) => {
    let real = p
    try {
      real = realpathSync(p)
    } catch {
      /* 目标不存在时退回原路径,让调用方去点名它 */
    }
    const resolved = path.resolve(real)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return norm(a) === norm(b)
}

/**
 * 判定面的相对基准必须是仓库根。root 若是仓库**子目录**,`ls-tree` 的路径与 `join(root, rel)`
 * 就会错位 —— 那正好产出门最不该产出的东西:看起来自洽、实则混面的绿。故判死,不静默容忍。
 */
export function assertRepoRoot(root, label) {
  const top = gitRaw(['rev-parse', '--show-toplevel'], root).trim()
  if (top && !sameDir(top, root)) {
    throw new Undetermined(`${label} 的 ROOT(${root})不是仓库根(${top}),两基准会错位`)
  }
  return top
}

/**
 * 从 argv 选面。三门共用这一条,免得某道门悄悄少一个面。
 * 两个面旗同给 = 自相矛盾,返回 error 让调用方判死(取哪一面都会让另一面成为假绿)。
 * @returns {{face:string, error:string|null}}
 */
export function selectFace({ staged, worktree, def = 'head' }) {
  if (staged && worktree) {
    return { face: null, error: '--staged 与 --worktree 不得同用(两个判定面互斥)' }
  }
  if (staged) return { face: 'staged', error: null }
  if (worktree) return { face: 'worktree', error: null }
  return { face: def, error: null }
}

/**
 * 磁盘面读单文件。目录里不存在 → null(由调用方决定"少扫一个"算不算红);
 * 读失败**原样抛** —— 一个编码/权限错误不得伪装成"该文件不存在"的业务结论。
 */
export function readWorktreeFile(root, rel) {
  const abs = path.join(root, rel)
  if (!existsSync(abs)) return null
  let text
  try {
    text = readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Undetermined(`${FACE_LABEL.worktree} 取不到 ${rel}: ${e.message}`)
  }
  return text.includes('\u0000') ? null : text
}

/**
 * 按判定面枚举**全部跟踪文件**(2026-10-23 立,G-880)。
 *
 * 为什么这一格必须住在层里:§0.4 要求"清单与内容同面同轮",而 `catBatch` 只能按
 * `<rev>:<path>` 取正文 —— **路径清单从哪来,决定这一轮判的是哪个面**。此前每道门各写一份
 * (`check-auth-refresh-singleton` / `check-button-height` / `check-image-source-domains` /
 * `check-spawn-output-channel` / `check-privacy-*` … 现读十余份),于是同一件事有十余种写法,
 * 其中若干份还在 `worktree` 档复用 `--cached` 的清单却不说明。收成一份之后:
 *
 *   - `head`     ⇒ `git ls-tree -r --name-only -z HEAD`(HEAD 树 = 提交面)
 *   - `staged`   ⇒ `git ls-files --cached -z`(索引面 = pre-commit 面)
 *   - `worktree` ⇒ `git ls-files -z`(跟踪路径,正文读盘 = 人工逃生舱)
 *
 * 未跟踪文件在**任何**一档都不进清单:`head`/`staged` 本来就没有它们;`worktree` 档若改用
 * 磁盘递归当清单,又会把 `.gitignore` 掉的构建产物卷进来 —— 那正是各门自己 walk 的老毛病
 * (minified chunk 里的 emoji / `refreshAccessToken` 都被误判过)。要看未跟踪文件,请显式
 * `git ls-files --others --exclude-standard`,不要在这里偷偷加面。
 *
 * ⚠️ `-z`:路径含空格/中文时不被打断,也不经 `core.quotepath` 转义(层里虽已关 quotepath,
 * 但 NUL 分帧才是唯一不依赖转义规则的取法)。取不到被审面 ⇒ `gitRaw` 抛 `Undetermined`,
 * 由调用方折成 exit 2「未判定」—— 绝不回落另一个面、也绝不返回空数组冒充"没有文件"。
 *
 * @param {string} root 仓库根
 * @param {'head'|'staged'|'worktree'} face 判定面
 * @param {{paths?:string[], timeout?:number}} [opts] `paths` = 限定子树(相对仓库根,git pathspec)
 * @returns {string[]} 相对仓库根的路径(正斜杠),按被审面的序;空数组由调用方判"枚举到 0"
 */
export function listFaceFiles(root, face, opts = {}) {
  if (!FACES.includes(face)) {
    throw new Undetermined(`未知判定面 ${String(face)}(只认 ${FACES.join(' / ')})`)
  }
  const pathspec = Array.isArray(opts.paths) && opts.paths.length ? ['--', ...opts.paths] : []
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', '-z', 'HEAD', ...pathspec]
      : face === 'staged'
        ? ['ls-files', '--cached', '-z', ...pathspec]
        : ['ls-files', '-z', ...pathspec]
  const out = gitRaw(args, root, { timeout: opts.timeout ?? 120000 })
  return String(out)
    .split('\u0000')
    .filter((p) => p.length > 0)
}

/**
 * 「远端分支现在在哪」的唯一取法 —— 凡是拿远端位置做**决策**(已收敛 / 已被包含 / 分叉 /
 * 合并输入新鲜度 / 推送后回读)的地方都必须用它,不要再各写一份。
 *
 * 为什么不能 `rev-parse origin/<branch>`:AGENTS §5b 实测,本机宿主清理层会删掉 depth≥2 的
 * remote-tracking 引用(松散文件被删后 `packed-refs` 里的**旧值**照样被读回来),那一刻它是
 * "上一次同步时"的答案。用它落槌有两种都不报错的错向:残值==本地 ⇒ 报"已收敛"而根本不推
 * (提交堆在本地还被当成完成);残值落后 ⇒ 去合一个早已不存在的分叉。git-push-guard 与
 * check-push-sync 在 2026-09-12 就因这两类真实事故改成 ls-remote 优先,本出口把那一次的口径
 * 收进来给全仓共用。
 *
 * 三档依次退让,并如实报用的是哪一档:
 *  ① `ls-remote` 直问服务器(唯一当次真值)
 *  ② 本轮 fetch 成功 ⇒ `FETCH_HEAD`
 *  ③ 只剩跟踪 ref(可能残值)⇒ **不参与落槌**,只随"无法判定"报出供诊断
 *
 * @param run 可注入的 git 执行器(镜像测试要**构造**三态;测网络通断不叫取证,叫赌运气)
 * @returns {{sha:string|null,source:string|null,stale?:string,reason?:string}}
 */
export function resolveRemoteHead(branch, { root, fetchedNow = false, run } = {}) {
  const exec = run || ((args) => gitRaw(args, root, { timeout: 45_000 }))
  const SHA = /^[0-9a-f]{40,64}$/
  const clean = (v) => String(v ?? '').trim()
  let netReason = null
  try {
    const first = clean(exec(['ls-remote', 'origin', `refs/heads/${branch}`])).split('\t')[0]
    if (SHA.test(first)) return { sha: first, source: 'ls-remote(当次服务器真值)' }
    netReason = first
      ? `ls-remote 输出解不出 sha:${first.slice(0, 40)}`
      : 'ls-remote 无该分支输出(远端可能没有此分支)'
  } catch (e) {
    netReason = `ls-remote 不可达:${String((e && e.message) || e).slice(0, 70)}`
  }
  if (fetchedNow) {
    try {
      const fh = clean(exec(['rev-parse', 'FETCH_HEAD']))
      if (SHA.test(fh)) return { sha: fh, source: 'FETCH_HEAD(本轮 fetch)' }
    } catch {
      /* FETCH_HEAD 不存在 ⇒ 继续降级 */
    }
  }
  let stale = null
  try {
    const t = clean(exec(['rev-parse', `refs/remotes/origin/${branch}`]))
    if (SHA.test(t)) stale = t
  } catch {
    /* ref 已被清理(§5b 正常态),不是错误 */
  }
  const tail = stale
    ? `;仅有跟踪 ref 残值 ${stale.slice(0, 11)} —— 不足以判定收敛,不拿它落槌`
    : ';跟踪 ref 也取不到'
  return { sha: null, source: null, stale, reason: `${netReason}${tail}` }
}
/**
 * 裸 git 派生的计数尺子。⚠️ 必须同时覆盖两个维度,少一个都会让棘轮"看起来在收口、实际没量到":
 *  · 入口:`execFileSync` / `execSync` / `spawnSync` / `spawn` 四种(`git-push-guard` 用的就是 spawnSync);
 *  · 形态:数组式 `execFileSync('git', […])` **和** shell 串式 `execSync('git status --porcelain')`
 *    —— 后者 `git` 后面跟的是空格而不是引号,只匹配 `['"]git['"]` 会把它整类漏掉(实测本仓有大量这种写法)。
 * 判据要覆盖自己想拦的那一种形态,否则分母骗人。
 */
export const BARE_GIT_RE = /(execFileSync|execSync|spawnSync|spawn)\(\s*['"]git(?:\.exe)?(?=['"\s])/g
export const bareGitCountOf = (text) => (text.match(BARE_GIT_RE) || []).length



/**
 * 只抹注释(整行行注释与成对斜杠星…星斜杠包围的块注释),**不抹字符串** ——
 * 型 A 要找的派生调用里 `'git'` 本身就是字符串字面量,抹字符串等于把靶子涂掉。
 *
 * 为什么必须有这一步(2026-09-25 实测):`scripts/lib/import-graph.mjs` 明明已经 `import catBatch`
 * 走本层,却被型 C 记成"自拼 batch 的门" —— 命中的是它第 164 行**JSDoc 注释**里那句
 * "一次 cat-file --batch"。一条把注释当代码的尺子会把"已经收口"判成"又长了一枚债",
 * 而这类误报的最终出路是有人去削判据或跳门。与守门 80 的 `markHidden` 同一取向。
 *
 * (本头注刻意不写出块注释的两个闭合字符 —— 写出来就是把本注释自己提前关掉,已踩过一次。)
 */
export function hideComments(src) {
  const out = []
  let inBlock = false
  for (const line of src.split(/\r?\n/)) {
    let res = ''
    let i = 0
    let quote = null // 当前所在字符串的引号(' " `);字符串里的 // 与 /* 都不是注释
    while (i < line.length) {
      const ch = line[i]
      if (inBlock) {
        if (line.startsWith('*/', i)) {
          i += 2
          inBlock = false
        } else i += 1
        continue
      }
      if (quote) {
        res += ch
        if (ch === '\\') {
          res += line[i + 1] ?? ''
          i += 2
          continue
        }
        if (ch === quote) quote = null
        i += 1
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch
        res += ch
        i += 1
        continue
      }
      if (line.startsWith('//', i)) {
        // 行注释:整段抹平(URL 的 `://` 落在字符串里,已由上面的 quote 分支保住)
        i = line.length
        continue
      }
      if (line.startsWith('/*', i)) {
        const end = line.indexOf('*/', i + 2)
        if (end < 0) {
          inBlock = true
          i = line.length
        } else i = end + 2
        continue
      }
      res += ch
      i += 1
    }
    // 抹掉的部分补回等量空格以外的字符会导致行内列号漂移,但三条判据都不依赖列号 ⇒ 直接截断即可;
    // 唯一必须保住的是**换行**,否则 `$`/multiline 类锚点会跨行误配。
    out.push(res)
  }
  return out.join('\n')
}

/**
 * §22c:暴露给镜像测试的核心判据(`scripts/tests/git-egress-fallback.test.mjs` 直接 import 这一份,
 * **不得**在测试里再抄一份动词表/正则/判序 —— 两处算同一件事必漂移)。
 * 命名导出与此处指向**同一批函数对象**,不是副本。
 */
export const __test__ = {
  egressFallbackPlan,
  GIT_EGRESS_NETWORK_VERBS,
  GIT_EGRESS_DIRECT_ARGS,
  GIT_EGRESS_TRANSPORT_RE,
  proxyConfiguredFor,
  isForceDirect,
  isTransportEgress,
  pruneEgressLedger,
  EGRESS_LEDGER_KEEP_DAYS,
  noteEgressDegradation,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
