#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * deploy-lock.mjs — 部署/构建流程全局串行化锁(2026-08-09 立,根治多 agent 并发部署)。
 *
 * 事故背景(8-09 实锤):09:48 另一自动化 Agent 与手动部署并行触发 build-next-prod.ps1,
 * 两个构建同时备份/清理/写入 apps/web/.next → 8801 短暂 502 + 监控报警,且产物存在损坏风险。
 * 根因:原 apps/web/scripts/check-lock.js 只有 dev-vs-build 互斥,没有 build-vs-build;
 * 且 build-next-prod.ps1 引用了不存在的 scripts/check-lock.js,锁从未真正生效。
 *
 * 本锁设计:
 *   - 锁 = 项目根 .deploy.lock 目录(mkdir 原子性,不依赖 cwd/平台)
 *   - 覆盖整个「构建+部署」单元:acquire 成功后持有,直到 release
 *   - build 模式:与其他 build、dev、deploy 全部互斥
 *   - dev 模式:与 build/deploy 互斥(dev+dev 放宽,与旧 check-lock 一致)
 *   - stale 清理:持有者进程已退出(锁龄不限)即视为悬挂锁,立即强制抢占
 *     (2026-08-27 收紧:原"锁龄>staleMs 才抢占"在强杀 dev 后立即重启时
 *     死循环轮询 600s,已改为持有者死即抢占,消除启动卡死窗口)
 *   - 超时:acquire 等待 timeoutMs(默认 600s)后抛错退出(不覆盖不打断进行中的部署)
 *
 * 锁的状态认识论(2026-09-26 立,第九轮 ZCode 吸收 A9-3):
 *   `readMeta()` 返回**穷尽四态**,因为"读不到"与"确实没有"是两件不同的事,
 *   把它们混成一态(null)会产出本仓最贵的一类故障——**判不出来就当没人持锁**:
 *     - `absent`     锁目录存在而 meta.json 不存在(acquire 的两步窗口 / 持有者崩于其间)
 *     - `ok`         元数据完好且 pid 可用 ⇒ 只有这一态能判"持有者死/活"
 *     - `invalid`    读到了内容但内容不可用(空文件 / 半个 JSON / 顶层不是对象 / 没有 pid)
 *     - `unreadable` 文件在而读不出内容(EISDIR / EACCES / 并发半写入被占用)
 *   旧实现把这四态全折叠成 `null` ⇒ acquire 的抢占分支要求 `meta &&`,于是
 *   "持有者早已死、但 meta.json 坏了"的锁**永不被抢占**,所有后续构建/部署死等
 *   600s 后抛错,而报错文案还写着"超 stale 时间会自动抢占"(该形态下是假的);
 *   release 一侧的两个 `meta &&` 守卫同时短路 ⇒ **坏锁 = 白拿**,直接删掉别人正在用的锁。
 *   现口径:
 *     1. 不可判定三态**绝不等价于"无人持锁"**,不得凭猜测删锁;
 *     2. 但也不得傻等到超时不给出路 —— 唯一出路是**锁龄超 stale 阈值**才抢占,
 *        且抢占前必须把现场**原样归档**(不得静默覆盖);
 *     3. 超时报错文案必须与实际判据一致,不同形态给不同出路;
 *     4. `check` 如实打印"无法判定 + 原因",禁止打印成空字段
 *        (读报告的人会把"读不出"当成"没进程持锁")。
 *
 * 用法(CLI):
 *   node scripts/deploy-lock.mjs acquire [--mode <build|dev>] [--timeout <ms>] [--stale <ms>] [--owner-pid <pid>]
 *   node scripts/deploy-lock.mjs release [--mode <build|dev>]
 *   node scripts/deploy-lock.mjs check            # 只读:exit 0=无锁 1=有锁(打印持锁信息)
 *   node scripts/deploy-lock.mjs --self-test      # 临时夹具内自检,绝不触碰真实 .deploy.lock
 *   通用选项:--lock-dir <path>(默认项目根 .deploy.lock;测试/夹具专用)
 *
 * 集成点:
 *   - scripts/build-next-prod.ps1:构建开始 acquire(build),结束 release
 *   - apps/web 的 dev 启动脚本:启动前 acquire(dev),退出 release
 */
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
  copyFileSync,
} from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const POLL_MS = 500
/**
 * "持有者名义存活"却把锁握过这个时长 ⇒ 只有一种解释:**pid 被复用了**。
 * 取 30 分钟:一次「构建 + 部署」单元实测约 4-10 分钟,30 分钟已是 3 倍余量;
 * 与 `scripts/git-lock.mjs` 的 1800s 硬上限同一条设计(AGENTS §12 ③)。
 * 换机/极端慢机构可用 `IHUI_DEPLOY_LOCK_HARD_CAP_MS` 放宽,但放宽到多大都该先看日志实测时长。
 */
const HARD_CAP_MS = (() => {
  const v = Number(process.env.IHUI_DEPLOY_LOCK_HARD_CAP_MS)
  return Number.isFinite(v) && v > 0 ? v : 1_800_000
})()

/** 锁目录(默认路径:项目根 .deploy.lock,不随 cwd 变化) */
function lockDir() {
  return join(repoRoot, '.deploy.lock')
}

function metaFile(dir) {
  return join(dir, 'meta.json')
}

/**
 * 把 meta.json 的**原始字节**归一为四态判据(纯函数,不碰文件系统,便于镜像测试直接喂夹具)。
 *
 * 为什么 `absent` 与 `invalid` 处置不同:
 *   - `absent`(文件确实不存在)是一个**确定的否定事实**——这个锁从来没写下过元数据。
 *     它仍不等于"无人持锁"(mkdir 与 writeMeta 之间有两步窗口,持有者可能是活的),
 *     所以 acquire 也**不会**凭它立刻删锁;但它的出路是"等 meta 出现或锁龄超 stale"。
 *   - `invalid`/`unreadable` 是一个**未知的判断**——内容在,而我们读不懂/读不到。
 *     此时锁很可能正被活人持有(写坏通常来自崩溃或并发半写),
 *     所以两者的共同底线是:**既不按"无人持锁"抢占,也不傻等到超时不给出路**;
 *     唯一自动出路是"锁龄超 stale 阈值 ⇒ 归档现场后抢占"。
 * 把三态混成"没有元数据"就是旧实现的全部病灶。
 *
 * @param {string|null|undefined} rawText 文件内容文本;传 null 表示"文件不存在"(absent)
 * @returns {{kind:'absent',reason:string}
 *          | {{kind:'ok'},meta:{mode:string,pid:number,ts:number}}
 *          | {kind:'invalid'|'unreadable',raw:string|null,reason:string}}
 */
function classifyMeta(rawText) {
  if (rawText === null || rawText === undefined) {
    return {
      kind: 'absent',
      reason: 'meta.json 不存在(锁从未写下元数据,或持有者崩于 mkdir 与写 meta 之间)',
    }
  }
  if (rawText.trim() === '') {
    return { kind: 'invalid', raw: rawText, reason: 'meta.json 是空文件(0 字节/全空白)' }
  }
  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch (e) {
    return { kind: 'invalid', raw: rawText, reason: `meta.json 不是合法 JSON:${e?.message ?? e}` }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'invalid', raw: rawText, reason: 'meta.json 顶层不是对象,拿不到 mode/pid/ts' }
  }
  const pid = Number(parsed.pid)
  if (!Number.isInteger(pid) || pid <= 0) {
    // pid 是唯一能判"持有者死/活"的东西;缺它 ⇒ 无法判定,不得当成"pid 不存在=进程不存在"
    return {
      kind: 'invalid',
      raw: rawText,
      reason: `meta.json 缺少可用 pid(实得 ${JSON.stringify(parsed.pid)}),无法判定持有者是否存活`,
    }
  }
  const ts = Number(parsed.ts)
  const ownerPid = Number(parsed.ownerPid)
  return {
    kind: 'ok',
    meta: {
      mode: typeof parsed.mode === 'string' ? parsed.mode : '',
      pid,
      // 真正持锁的**那个构建单元**的 pid(见 writeMeta 的说明);没有它就退回 pid。
      ownerPid: Number.isInteger(ownerPid) && ownerPid > 0 ? ownerPid : 0,
      // ts 缺失/非法不致命:活性判据靠 pid,锁龄可降级用目录 mtime(见 lockAgeMs)
      ts: Number.isFinite(ts) && ts > 0 ? ts : 0,
    },
  }
}

/**
 * 读取锁元数据 ⇒ 四态。
 * 注意 `unreadable` 与 `absent` 的分界:只有 ENOENT(文件确实没有)才算 absent;
 * EISDIR / EACCES / EBUSY 等一律是"读不到内容"= 无法判定,不是"没有内容"。
 */
function readMeta(dir) {
  let raw
  try {
    raw = readFileSync(metaFile(dir), 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return classifyMeta(null)
    return {
      kind: 'unreadable',
      raw: null,
      reason: `meta.json 读取失败:${e?.code ?? e?.message ?? e}`,
    }
  }
  return classifyMeta(raw)
}

/**
 * 写下持锁元数据。
 *
 * ⚠️ `pid` 记的**只是本次 CLI 调用自己**的 pid,而 CLI 打印"锁已获取"就退出了 ——
 * 所以单看 `pid` 判活是无效的:要么恒"已退出"(于是别人正在跑的构建被抢),
 * 要么 pid 被系统复用给别的过程(于是本工具永远等一个"活着"的幽灵;2026-09-25 实测
 * 部署环因此冻结 11h50m,每轮白等 600s)。`ownerPid` 才是这段锁的真正主人:
 * 由调用方(构建脚本自己的 `$PID`)经 `--owner-pid` 或 `IHUI_DEPLOY_LOCK_OWNER_PID` 传入。
 */
function writeMeta(dir, mode, opts = {}) {
  const ownerPid = Number(opts.ownerPid ?? process.env.IHUI_DEPLOY_LOCK_OWNER_PID) || 0
  writeFileSync(
    metaFile(dir),
    JSON.stringify({
      mode: mode ?? '',
      pid: process.pid,
      ownerPid,
      ts: Date.now(),
    }),
    'utf8',
  )
}

/** 判活应当问的那把 pid:有 owner 用 owner,没有就退回 CLI 自己(向后兼容旧 meta)。 */
function holderPid(meta) {
  const m = meta || {}
  return Number(m.ownerPid) > 0 ? Number(m.ownerPid) : Number(m.pid) || 0
}

/**
 * 删除锁目录 —— **只允许持有者自释时调用**。
 *
 * ⚠️ 抢占路径一律不得用它(2026-09-26 根治):见 `claimStaleLock()` 的注释。
 */
function removeLock(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* 忽略:仅用于持有者自释;抢占路径根本不该走到这里 */
  }
}

/** 同一把锁的指纹:判据比对用的四字段 + 判据本身的状态 kind */
function lockIdentity(state) {
  if (!state || state.kind !== 'ok' || !state.meta) return `!ok:${state?.kind ?? 'null'}`
  const m = state.meta
  return `ok|${m.mode}|${m.pid}|${m.ownerPid}|${m.ts}`
}

/**
 * 原子抢占:**先把锁目录改名搬走、只处置自己改到的那一份**(2026-09-26 根治运行期竞态)。
 *
 * 旧写法(`acquire` 的抢占分支与 `release` 的代为收口分支都是 `removeLock(dir)`)的故障形态:
 * 在"我判它已死"与"我删它"之间,别的进程可以已经删掉旧锁并 `mkdir` 拿到**新锁** ——
 * 我 `rmSync` 掉的就是别人的活锁 ⇒ 两次构建同时写 `.next`(8-09 那次的 502 + 监控报警正是这一型)。
 * 而 `removeLock` 那句"调用方必须回读 existsSync 复核"只判"删没删掉",
 * **不判"删的是不是我刚看过的那把"** —— 复核的是结果,不是身份。
 *
 * 三步:
 *   ① `renameSync(dir, 归档出口/.deploy.lock.stale-<pid>-<ts>)`(跨卷时退到同父目录暂存,
 *      退的是落点、不是"改名"这一步)。抛错 ⇒ **没抢到**,**绝不回退去 rmSync 原路径**。
 *   ② 回读改名后目录的 meta,与判死时那份指纹比对;不等 ⇒ 我改到的是别人新建的活锁
 *      ⇒ 原样放回、什么都没删(失效方向是"多等一轮",不是"多删一把")。
 *   ③ 只有②通过才处置改名后的那份:留在归档出口当现场,落不进归档才递归删除;
 *      删除失败也不回头碰原路径。
 *
 * @param {string} dir
 * @param {{kind:string,meta?:object,reason?:string}|null} judged 判死时的四态结论(②的比对基准)
 * @param {string} why 判死理由(进现场与日志)
 * @param {{suffix?:string, archiveRoot?:string}} [opts]
 * @returns {{ok:boolean, phase:string, code?:string, stagedPath:string|null, archived:string|null, log:string}}
 */
function claimStaleLock(dir, judged, why, { suffix, archiveRoot = sceneArchiveRoot() } = {}) {
  // 提前一次"锁目录在不在"**只为不去建归档目录**(不为已消失的锁造空现场)。
  // 它不是抢占的安全凭据 —— 安全凭据始终是①原子改名 + ②身份回读。
  if (!existsSync(dir)) {
    return {
      ok: false,
      phase: 'rename',
      code: 'ENOENT',
      stagedPath: null,
      archived: null,
      log: `[deploy-lock] 抢占放弃:锁目录 ${dir} 此刻已不存在 ⇒ 未删除、未创建任何目录`,
    }
  }
  const tag = suffix ?? `.stale-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const me = lockIdentity(judged)
  let rawMeta = null
  try {
    rawMeta = readFileSync(metaFile(dir), 'utf8')
  } catch {
    rawMeta = null
  }
  // ① 原子改名
  let stagedPath = null
  try {
    mkdirSync(archiveRoot, { recursive: true })
    const target = join(archiveRoot, `${basename(dir)}${tag}`)
    renameSync(dir, target)
    stagedPath = target
  } catch (e) {
    const code = e?.code ?? 'unknown'
    if (code === 'ENOENT') {
      return {
        ok: false,
        phase: 'rename',
        code,
        stagedPath: null,
        archived: null,
        log: `[deploy-lock] 抢占放弃:锁目录 ${dir} 此刻已不存在 ⇒ 未删除任何目录,继续等待`,
      }
    }
    // 跨卷 / 归档根不可写 ⇒ 退到同父目录暂存(仍是 rename-first,绝不回退成 rmSync)
    try {
      const local = `${dir}${tag}`
      renameSync(dir, local)
      stagedPath = local
    } catch (e2) {
      return {
        ok: false,
        phase: 'rename',
        code: e2?.code ?? code,
        stagedPath: null,
        archived: null,
        log: `[deploy-lock] 抢占未成功(改名 ${e2?.code ?? e2?.message})⇒ 原路径 ${dir} 未被触碰,继续等待`,
      }
    }
  }
  // ② 身份回读:改到的必须就是我刚判死的那把
  const now = readMeta(stagedPath)
  if (lockIdentity(now) !== me) {
    let restored = false
    try {
      renameSync(stagedPath, dir)
      restored = true
    } catch {
      /* 放不回 ⇒ 现场原地保留并大声喊,仍不删 */
    }
    return {
      ok: false,
      phase: 'identity-drift',
      restored,
      stagedPath: restored ? null : stagedPath,
      archived: null,
      log:
        `[deploy-lock] 抢占放弃:${dir} 在改名瞬间已被替换(判死时 ${me},改到的是 ${lockIdentity(now)})` +
        ` ⇒ ${restored ? '已原样放回,未删除任何锁' : `⚠️ 放回失败,现场保留在 ${stagedPath}(未删除,请人工处置)`}`,
    }
  }
  // ③ 现场留档 + 只处置改名后的那一份
  const archived = stagedPath
  const note = {
    takenAt: new Date().toISOString(),
    stolenByPid: process.pid,
    lockPath: dir,
    judged: judged?.kind === 'ok' ? judged.meta : null,
    judgedKind: judged?.kind ?? 'null',
    reason: why,
    rawMeta,
  }
  try {
    writeFileSync(join(stagedPath, 'stale-claim-note.json'), JSON.stringify(note, null, 2), 'utf8')
  } catch (e) {
    console.error(
      `[deploy-lock] ❌ 抢占现场说明写入失败(${e?.code ?? e?.message})——原始 meta 逐字如下,不得静默:\n${rawMeta ?? '(不可得)'}`,
    )
  }
  return {
    ok: true,
    phase: 'claimed',
    stagedPath,
    archived,
    log: `[deploy-lock] 已抢占悬挂锁:被抢的持有者 = ${summarise(judged)};判死理由:${why};现场=${archived}`,
  }
}

/** meta 的一行式身份描述(日志用) */
function summarise(state) {
  const m = state?.kind === 'ok' ? state.meta : null
  if (!m) return `无有效元数据(${state?.kind ?? 'null'})`
  return `mode=${m.mode} cliPid=${m.pid} ownerPid=${m.ownerPid || '(未声明)'} ts=${m.ts ? new Date(m.ts).toISOString() : '(无)'}`
}


/**
 * 进程是否存活(跨平台)。
 * 2026-09-26 修一处方向性误判:`process.kill(pid, 0)` 抛 **EPERM** 的含义是
 * "进程存在但不归本用户管",旧实现一律 catch ⇒ 判死 ⇒ **抢占别人正在用的锁**。
 * 服务账户/其他用户的构建进程正落在这一格里。
 */
function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return !!e && e.code === 'EPERM'
  }
}

/**
 * 锁龄(ms)与它的测量来源。
 * `meta.ts` 是首选(持锁者自己写的时间);元数据不可判定时只能降级用**锁目录 mtime**——
 * 这是**降级信号**:它不如 pid 可靠(任何一次写入目录的动作都会刷新它,包括别人的
 * 归档/取证读取以外的写入),所以它**只用于**"不可判定态的 stale 兜底",
 * 绝不反过来用于"判定持有者已死"。
 */
function lockAgeMs(dir, state, now = Date.now()) {
  if (state.kind === 'ok' && state.meta.ts > 0) {
    return { ageMs: Math.max(0, now - state.meta.ts), source: 'meta.ts' }
  }
  try {
    return {
      ageMs: Math.max(0, now - statSync(dir).mtimeMs),
      source: '锁目录 mtime(降级信号,不如 pid 可靠)',
    }
  } catch {
    return { ageMs: 0, source: '不可测(锁目录 stat 失败)' }
  }
}

/** 现场归档根目录:只走本仓既有落点(§15b 批准的临时/归档面),禁止硬编码盘符(§5b/§15b 前例)。 */
function sceneArchiveRoot() {
  const override = process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR
  if (override) return resolve(override)
  return join(repoRoot, '.ihui-agent', 'tmp', 'deploy-lock-scene')
}

/**
 * 抢占/代为收口前把锁现场**原样归档**(A9-3「抢占保现场」)。
 * 归档的是**字节**不是重新序列化的对象——坏锁的价值恰恰在于"它到底长什么样"。
 * @param {{kind:string,reason?:string,ageMs?:number,ageSource?:string}} state 四态判据(附锁龄,供现场说明)
 * @returns {string|null} 归档目录;null = 归档失败(调用方须把原始内容逐字打到 stderr,绝不静默覆盖)
 */
function archiveScene(dir, state, why) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = join(
    sceneArchiveRoot(),
    `${stamp}-by-pid${process.pid}-${Math.random().toString(36).slice(2, 6)}`,
  )
  let rawBuf = null
  try {
    rawBuf = readFileSync(metaFile(dir))
  } catch {
    rawBuf = null
  }
  try {
    mkdirSync(target, { recursive: true })
    if (rawBuf !== null) writeFileSync(join(target, 'meta.json'), rawBuf)
    else
      writeFileSync(join(target, 'meta.json.unavailable.txt'), `读取失败:${state.reason}\n`, 'utf8')
    // 锁目录里除 meta 之外的任何文件一并原样复制(禁止整棵 rm -rf 前不留档)
    for (const name of readdirSync(dir)) {
      if (name === 'meta.json') continue
      try {
        copyFileSync(join(dir, name), join(target, name))
      } catch {
        /* 单个附属文件复制失败不阻断(主现场已落) */
      }
    }
    writeFileSync(
      join(target, 'scene-note.txt'),
      [
        `归档时间: ${new Date().toISOString()}`,
        `执行进程: pid=${process.pid} 命令=${process.argv.slice(1).join(' ') || '(in-process)'}`,
        `锁目录: ${dir}`,
        `元数据态: ${state.kind}${state.reason ? `(${state.reason})` : ''}`,
        `锁龄: ${state.ageMs ?? '未知'}ms 来源=${state.ageSource ?? '未知'}`,
        `抢占理由: ${why}`,
      ].join('\n'),
      'utf8',
    )
    console.log(`[deploy-lock] 抢占前现场已原样归档: ${target}`)
    return target
  } catch (e) {
    console.error(
      `[deploy-lock] ❌ 归档现场失败(${e?.code ?? e?.message}) —— 不得静默覆盖,meta.json 原始内容逐字如下:`,
    )
    console.error(rawBuf === null ? '(原始内容不可得)' : rawBuf.toString('utf8'))
    return null
  }
}

/**
 * 一次「这锁能不能拿」的勘验(纯判据,不删不改 —— 便于二次确认时复用同一条判据)。
 * 返回 action:
 *   - `coexist` dev+dev 放宽(旧 check-lock 语义)
 *   - `steal`   可抢占(调用方仍须二次确认 + 归档现场)
 *   - `wait`    继续等
 */
function decideSteal({ dir, mode, staleMs, hardCapMs = HARD_CAP_MS, now = Date.now() }) {
  const state = readMeta(dir)
  const age = lockAgeMs(dir, state, now)
  const info = { state, ageMs: age.ageMs, ageSource: age.source }

  if (state.kind === 'ok') {
    const pid = holderPid(state.meta)
    const alive = isProcessAlive(pid)
    const who =
      Number(state.meta.ownerPid) > 0
        ? `owner pid=${state.meta.ownerPid}(CLI pid=${state.meta.pid})`
        : `pid=${state.meta.pid}(无 owner,退回 CLI pid)`
    if (mode === 'dev' && state.meta.mode === 'dev' && alive) {
      return {
        action: 'coexist',
        holderAlive: alive,
        ...info,
        why: `dev+dev 共存(持有者 ${who} 存活)`,
      }
    }
    if (!alive) {
      // 2026-08-27 立的判据,一字不许改回:持有者已退出 ⇒ **不限锁龄**立即抢占。
      return {
        action: 'steal',
        immediate: true,
        holderAlive: alive,
        ...info,
        why: `持有者 ${who} 已退出(锁龄 ${age.ageMs}ms 来源 ${age.source},按 2026-08-27 判据不限锁龄)`,
      }
    }
    /**
     * "持有者活着" 与 "锁龄超过硬上限" 同时成立 ⇒ 这个 pid 已经不属于持锁的那个过程了
     * (**pid 复用**),没有第二种解释:一次构建+部署单元不会把锁握到几十分钟以上。
     * 这一格就是 2026-09-25 冻结部署环 11h50m 的那一格 —— 旧代码在这里无条件 `wait`,
     * 而"活着"是量出来的、锁龄也是量出来的,两者矛盾时却谁都不肯认账。
     * 与 `scripts/git-lock.mjs` 的 1800s 硬上限是同一条设计(AGENTS §12 心跳机制③)。
     */
    if (age.ageMs > hardCapMs) {
      return {
        action: 'steal',
        immediate: false,
        holderAlive: alive,
        ...info,
        why:
          `持有者 ${who} 名义存活,但锁龄 ${age.ageMs}ms 已超硬上限 ${hardCapMs}ms ⇒ 这是被复用的 pid,` +
          `不是持锁过程本身(一次构建+部署不可能握锁这么久)⇒ 归档现场后抢占`,
      }
    }
    return {
      action: 'wait',
      holderAlive: alive,
      ...info,
      why: `持有者 ${who} 仍在运行(锁龄 ${age.ageMs}ms / 硬上限 ${hardCapMs}ms)`,
    }
  }

  // —— 不可判定三态:绝不等价于"无人持锁"(A9-3),也不许傻等到超时不给出路
  if (age.ageMs > staleMs) {
    return {
      action: 'steal',
      immediate: false,
      holderAlive: null,
      ...info,
      why: `元数据不可判定(${state.kind}:${state.reason})且锁龄 ${age.ageMs}ms 已超 stale 阈值 ${staleMs}ms —— 这是唯一自动出路`,
    }
  }
  return {
    action: 'wait',
    holderAlive: null,
    ...info,
    why: `元数据不可判定(${state.kind}:${state.reason})⇒ 不凭猜测删锁;锁龄 ${age.ageMs}ms 未超 stale=${staleMs}ms`,
  }
}

/** 超时报错:文案必须与该形态的**实际判据**一致(旧文案在这里撒过谎) */
function lockTimeoutMessage({ timeoutMs, decision, staleMs, dir, mkdirErr }) {
  const { state, ageMs, ageSource, holderAlive } = decision
  const holderInfo =
    state.kind === 'ok'
      ? `mode=${state.meta.mode} pid=${state.meta.pid} ${state.meta.ts ? `于 ${new Date(state.meta.ts).toLocaleTimeString()}` : '(无 ts)'}${holderAlive ? '(运行中)' : '(已退出)'}`
      : `无法判定(${state.kind}${state.reason ? `:${state.reason}` : ''})`
  let route
  if (state.kind === 'ok') {
    route = holderAlive
      ? '持有进程仍在运行,本工具不会打断它;它退出后锁会被立即抢占并归档现场'
      : `持有者已退出即可抢占(锁龄 ${ageMs}ms 来源 ${ageSource})——仍未抢到说明删锁目录失败,请查权限/占用`
  } else {
    route = `元数据不可判定,本工具不会凭猜测删锁;唯一自动出路是锁龄超 stale=${staleMs}ms 后归档并抢占(当前 ${ageMs}ms,来源 ${ageSource})`
  }
  const mkdirNote =
    mkdirErr && mkdirErr.code !== 'EEXIST' ? `(另:创建锁目录返回 ${mkdirErr.code})` : ''
  return (
    `[deploy-lock] 等待部署锁超时(${timeoutMs}ms)。当前持锁: ${holderInfo}。${route}。${mkdirNote} ` +
    `紧急可人工确认持锁者后删除 ${dir}`
  )
}

/**
 * 获取锁。返回 true 表示获取成功。
 * 规则:
 *   - dev+dev:放宽(多个 dev 可共存,与旧 check-lock 一致)
 *   - build 与其他任何模式:严格互斥
 *   - 元数据完好且持有者进程已退出:**立即抢占(不限锁龄,2026-08-27 判据)**
 *   - 元数据不可判定(absent/invalid/unreadable):只在锁龄超 stale 后抢占,且抢占前归档现场
 *   - 超时未获锁:抛错(不打断进行中的部署),文案按形态给真实出路
 */
async function acquire({
  mode = 'build',
  timeoutMs = 600_000,
  staleMs = 600_000,
  hardCapMs = HARD_CAP_MS,
  ownerPid,
  dir = lockDir(),
} = {}) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let mkdirErr = null
    try {
      mkdirSync(dir, { recursive: false })
      writeMeta(dir, mode, { ownerPid })
      const owner = Number(ownerPid) > 0 ? `owner pid=${ownerPid}` : 'owner 未声明(退回 CLI pid 判活)'
      console.log(`[deploy-lock] ${mode} 锁已获取 (cli pid=${process.pid};${owner})`)
      return true
    } catch (e) {
      // 只有"目录已存在"(EEXIST)才是"别人持锁"。mkdir 成功而 writeMeta 失败(ENOSPC/权限)
      // 必须当场报错:旧实现把两步全裹在同一个 catch 里,写不进 meta 时会退化成
      // "死等一把自己刚建的锁",600s 后抛错还把责任推给"残留锁"。
      if (e && e.code && e.code !== 'EEXIST') {
        // 刻意**不**在这里删锁:非 EEXIST(如 EACCES)证明不了"这个目录是我刚建的",
        // 而证明不了的删除就可能是在删别人的锁(本票红线)。留下的空锁目录会被后续
        // acquire 按 absent 态走"超 stale ⇒ 归档 ⇒ 抢占"这条自愈路,不需要未证明的破坏动作。
        throw new Error(
          `[deploy-lock] 创建/写入锁 ${dir} 失败(${e.code}:${e?.message ?? e})。` +
            '因无法证明该目录为本次所建,本工具不代删;请查磁盘空间/权限后重试。',
        )
      }
      mkdirErr = e
    }
    // 锁已存在:判断是否可共存 / 是否可抢占
    const decision = decideSteal({ dir, mode, staleMs, hardCapMs })
    if (decision.action === 'coexist') {
      console.log(`[deploy-lock] dev+dev 共存,继续 (持有者 ${decision.why})`)
      return true
    }
    if (decision.action === 'steal') {
      // 二次确认:判据必须仍然成立(这一轮与上一轮之间持有者可能已换人/已复活)
      const again = decideSteal({ dir, mode, staleMs, hardCapMs })
      if (again.action !== 'steal') {
        console.warn(`[deploy-lock] 抢占判据在二次确认时不再成立(${again.why}),继续等待`)
      } else {
        console.warn(`[deploy-lock] 检测到可抢占锁:${again.why}`)
        const archived = archiveScene(
          dir,
          { ...again.state, ageMs: again.ageMs, ageSource: again.ageSource },
          again.why,
        )
        if (archived === null) {
          // 归档失败时**不**删锁:现场不得静默覆盖(原始内容已逐字打到 stderr,不丢判据)。
          // 例外:immediate(持有者已死)那一型若因归档失败而卡住,会把 2026-08-27 修的启动死循环
          // 换回来 —— 故仅在该型继续删锁(现场已在 stderr 留痕),不可判定型仍保守等待。
          if (!again.immediate) {
            await new Promise((r) => setTimeout(r, POLL_MS))
            if (Date.now() > deadline)
              throw new Error(
                lockTimeoutMessage({ timeoutMs, decision: again, staleMs, dir, mkdirErr }),
              )
            continue
          }
          console.warn(
            '[deploy-lock] ⚠️ 归档失败但持有者已退出,按 2026-08-27 判据继续抢占(现场已逐字打印到 stderr)',
          )
        }
        // 抢占动作:**原子改名,只处置自己改到的那一份**(见 claimStaleLock)。
        // 旧写法是 `removeLock(dir)`:在"我判它已死"与"我删它"之间,别人可以已删掉旧锁并
        // mkdir 拿到新锁 ⇒ 删掉的是别人的活锁 ⇒ 两次构建同时写 .next(8-09 的 502 那一型)。
        // 上面 `archiveScene` 的 existsSync 回读只判"删没删掉",不判"删的是不是刚看过的那把"。
        const claim = claimStaleLock(dir, again.state, again.why)
        console.log(claim.log)
        if (!claim.ok) {
          // 没抢到(锁已不见 / 改名瞬间被替换 / 改到了别人的活锁)⇒ 什么都没删,继续轮询。
          // 仍受 deadline 约束:不能因为"这轮没成功"就无限等下去。
          await new Promise((r) => setTimeout(r, POLL_MS))
          if (Date.now() > deadline)
            throw new Error(lockTimeoutMessage({ timeoutMs, decision: again, staleMs, dir, mkdirErr }))
          continue
        }
        // 2026-08-14 那道的替代版:抢占成功后原路径若又出现目录,那是**新持有者**的锁,
        // 该等就等(绝不再删);旧实现在这里抛错,是把"别人动作快"误报成"我删不掉"。
        if (existsSync(dir)) {
          console.warn(
            `[deploy-lock] 抢占成功后 ${dir} 已被重建 ⇒ 那是新持有者的锁,按正常等待处理(本工具不删它)`,
          )
        }
        continue

      }
    }
    if (Date.now() > deadline) {
      throw new Error(lockTimeoutMessage({ timeoutMs, decision, staleMs, dir, mkdirErr }))
    }
    // 轮询等待
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

/**
 * 释放锁(CLI 场景 acquire/release 是不同进程,按 mode 匹配释放;持有者同 mode 时即视为可释放)。
 * A9-3 收紧:**元数据不可判定时拒绝释放**——旧实现在此处两个 `meta &&` 守卫全短路,
 * 于是"坏锁 = 白拿",一次 release 就能删掉别人正在用的锁。
 */
function release({ mode, dir = lockDir() } = {}) {
  if (!existsSync(dir)) return { released: false, why: '无锁目录' }
  const state = readMeta(dir)
  if (state.kind !== 'ok') {
    console.error(
      `[deploy-lock] ❌ 拒绝释放:锁元数据无法判定(${state.kind}:${state.reason})。` +
        `此刻删锁可能删掉别人正在用的锁。请人工确认持锁者后删除 ${dir};` +
        '自动出路是 acquire 侧「锁龄超 stale 后归档抢占」。',
    )
    return { released: false, why: `无法判定:${state.kind}` }
  }
  // 若调用方指定 mode,要求锁的 mode 一致才释放(避免误删他人不同类型的锁)
  if (mode && state.meta.mode !== mode)
    return { released: false, why: `mode 不匹配(锁=${state.meta.mode} 调用=${mode})` }
  const self = state.meta.pid === process.pid || Number(state.meta.ownerPid) === process.pid
  const holder = holderPid(state.meta)
  if (!self && isProcessAlive(holder)) {
    // 锁持有进程还活着且不是自己 → 不释放(尊重持有者)
    const age = lockAgeMs(dir, state)
    if (age.ageMs > HARD_CAP_MS) {
      // 2026-09-25 实测就卡在这一格:pid 被复用 ⇒ "活着"是假的,而 release 不敢删,
      // acquire 那边旧判据又会无限 wait ⇒ 部署环冻结 11h50m。这里**仍然不删**(删锁是
      // 持有者的动作),但必须把真实出路说清楚:acquire 侧现在会按硬上限归档并抢占。
      console.warn(
        `[deploy-lock] 名义持有者 pid=${holder} 存活,但锁龄 ${age.ageMs}ms 已超硬上限 ${HARD_CAP_MS}ms` +
          ` ⇒ 该 pid 极可能已被复用。本命令不代删别人的锁;` +
          `自动出路是下一次 \`deploy-lock.mjs acquire\`(它会先归档现场再抢占)。`,
      )
      return { released: false, why: 'pid 疑似被复用(超硬上限),交 acquire 归档抢占' }
    }
    console.warn(`[deploy-lock] 锁由 pid=${holder} 持有且仍在运行,拒绝释放`)
    return { released: false, why: '他人持锁且存活' }
  }
  if (!self) {
    // 非持有者代为收口 = 破坏性动作:先留现场,再二次确认持有者确实已退出
    if (isProcessAlive(holderPid(state.meta))) {
      console.warn(`[deploy-lock] 二次确认:pid=${state.meta.pid} 已恢复存活,拒绝释放`)
      return { released: false, why: '二次确认持有者存活' }
    }
    const age = lockAgeMs(dir, state)
    archiveScene(
      dir,
      { ...state, ageMs: age.ageMs, ageSource: age.source },
      `代为释放非本进程持有的悬挂锁(pid=${state.meta.pid})`,
    )
    // 代为收口在语义上就是**抢占** ⇒ 必须原子改名、只处置自己改到的那一份(见 claimStaleLock)。
    // 旧写法直接 removeLock(dir):二次确认与删除之间别人可已新建锁,那一下删的是别人的活锁。
    const claim = claimStaleLock(
      dir,
      state,
      `代为收口非本进程持有的悬挂锁(cliPid=${state.meta.pid} ownerPid=${state.meta.ownerPid || '(未声明)'})`,
    )
    console.log(claim.log)
    return claim.ok
      ? { released: true, why: '悬挂锁代为收口(原子改名,现场已留档)' }
      : { released: false, why: `抢占未成功:${claim.phase}${claim.ok ? '' : `(${claim.code ?? claim.stagedPath ?? '身份已变'})`}` }
  }
  // 走到这里 = self(本进程就是持有者,内容凭据已验明这把是我的)⇒ 按原语义直接删
  removeLock(dir)
  console.log(`[deploy-lock] 锁已释放 (pid=${process.pid})`)
  return { released: true, why: self ? '持有者自释' : '悬挂锁代为收口' }
}

/** 只读检查:exit 0=无锁,1=有锁(不可判定态必须如实喊出"无法判定",禁止打印成空字段) */
function check({ dir = lockDir(), log = (...a) => console.log(...a) } = {}) {
  if (!existsSync(dir)) return 0
  const state = readMeta(dir)
  const age = lockAgeMs(dir, state)
  if (state.kind === 'ok') {
    const alive = isProcessAlive(holderPid(state.meta))
    log(
      `locked: mode=${state.meta.mode} pid=${state.meta.pid}${Number(state.meta.ownerPid) > 0 ? ` ownerPid=${state.meta.ownerPid}` : ''} 判活对象=${holderPid(state.meta)} alive=${alive} ts=${state.meta.ts ? new Date(state.meta.ts).toISOString() : '(无)'} age=${age.ageMs}ms 锁龄来源=${age.source}` +
        (alive && age.ageMs > HARD_CAP_MS
          ? ` ⇒ ⚠️ 名义存活而锁龄超硬上限 ${HARD_CAP_MS}ms:该 pid 极可能已被复用,acquire 侧会归档并抢占`
          : ''),
    )
    return 1
  }
  log(
    `locked: 无法判定(${state.kind})——原因:${state.reason}。` +
      `锁龄 ${age.ageMs}ms(来源:${age.source})。` +
      `注意:这不是"没有进程持锁",也不是"持锁进程已退出";` +
      'acquire 侧只会等锁龄超 stale 阈值后归档并抢占,不会凭猜测删锁。',
  )
  return 1
}

/**
 * 自检:全部在临时夹具里跑(scripts/lib/scratch-dir.mjs),
 * **绝不允许**触碰真实仓库根的 .deploy.lock(那是并发会话正在用的锁)。
 * 归档面也用 IHUI_DEPLOY_LOCK_ARCHIVE_DIR 指进夹具,避免测试往仓库写现场。
 */
async function runSelfTest() {
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const base = mkScratch('deploy-lock-selftest-')
  process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = join(base, 'scene')
  const results = []
  let seq = 0
  const freshDir = () => {
    const d = join(base, `lock-${++seq}`)
    mkdirSync(d, { recursive: true })
    return d
  }
  const putMeta = (dir, text) => {
    writeFileSync(metaFile(dir), text, 'utf8')
    return text
  }
  const findDeadPid = () => {
    for (let p = 999_000; p < 1_200_000; p += 11) if (!isProcessAlive(p)) return p
    throw new Error('夹具需要一个确定已死的 pid,但未找到')
  }
  const DEAD_PID = findDeadPid()
  const t = (name, cond, detail = '') => {
    results.push({ name, ok: !!cond, detail })
    console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` — ${detail || '断言不成立'}`}`)
  }
  const elapsed = async (fn) => {
    const s = Date.now()
    const r = await fn()
    return { ms: Date.now() - s, r }
  }

  try {
    // —— 1) 四态勘验(纯判据)
    t('S01 absent:meta.json 不存在 ⇒ absent', classifyMeta(null).kind === 'absent')
    t(
      'S02 ok:完好元数据 ⇒ ok',
      classifyMeta(JSON.stringify({ mode: 'build', pid: 4321, ts: 1_700_000_000_000 })).kind ===
        'ok',
    )
    t('S03 invalid:空文件 ⇒ invalid(不得当成 absent)', classifyMeta('').kind === 'invalid')
    t('S04 invalid:全空白 ⇒ invalid', classifyMeta('   \n').kind === 'invalid')
    t('S05 invalid:半个 JSON ⇒ invalid', classifyMeta('{"mode":"build","pid":').kind === 'invalid')
    t('S06 invalid:顶层是数组 ⇒ invalid', classifyMeta('[1,2]').kind === 'invalid')
    t(
      'S07 invalid:缺 pid ⇒ invalid(无法判定持有者)',
      classifyMeta('{"mode":"build"}').kind === 'invalid',
    )
    t(
      'S08 invalid:pid 非法(0/字符串) ⇒ invalid',
      classifyMeta('{"pid":"abc"}').kind === 'invalid' &&
        classifyMeta('{"pid":0}').kind === 'invalid',
    )
    t(
      'S09 ok:缺 ts 仍算 ok(活性靠 pid,锁龄可降级)',
      classifyMeta('{"mode":"dev","pid":99}').kind === 'ok',
    )
    t(
      'S10 absent 与 invalid 必须是不同态(处置动作不同)',
      classifyMeta(null).kind !== classifyMeta('x').kind,
    )

    // —— 2) unreadable 与 absent 的分界:meta.json 位置放一个目录
    const unDir = freshDir()
    mkdirSync(metaFile(unDir), { recursive: true })
    t(
      'S11 unreadable:meta.json 是目录 ⇒ unreadable(不是 absent)',
      readMeta(unDir).kind === 'unreadable',
    )
    // S11b 是"把 invalid/unreadable 在 readMeta 层折叠成 absent"这一变异**唯一能看见**的地方:
    // classifyMeta 仍分得清,而 check 的 else 分支对三态都喊"无法判定" —— 只有态名会露馅。
    const collapseDir = freshDir()
    putMeta(collapseDir, '{"mode":"build","pid":')
    t(
      'S11b readMeta 层也不得把 invalid 折叠成 absent(变异对照的落点)',
      readMeta(collapseDir).kind === 'invalid',
    )
    const collapse2 = freshDir()
    putMeta(collapse2, '')
    t('S11c 空文件在 readMeta 层仍是 invalid(不是 absent)', readMeta(collapse2).kind === 'invalid')

    // —— 3) 无锁 ⇒ 直接获取
    const d3 = join(base, 'no-lock')
    const r3 = await elapsed(() => acquire({ mode: 'build', timeoutMs: 3000, dir: d3 }))
    t('S12 absent(连锁目录都没有)⇒ acquire 秒成功', r3.r === true && r3.ms < 2000, `ms=${r3.ms}`)
    t('S13 获取后 meta.json 记录了自己 pid', readMeta(d3).meta?.pid === process.pid)

    // —— 4) 完好 + 持有者存活 ⇒ 等待并超时,且**绝不覆盖别人的锁**
    const d4 = freshDir()
    const raw4 = putMeta(d4, JSON.stringify({ mode: 'build', pid: process.pid, ts: Date.now() }))
    let err4 = null
    const r4 = await elapsed(async () => {
      try {
        await acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir: d4 })
        return 'no-throw'
      } catch (e) {
        err4 = e
        return 'threw'
      }
    })
    t(
      'S14 活持有者 ⇒ 不抢占(等待后超时)',
      r4.r === 'threw' && r4.ms >= 900,
      `r=${r4.r} ms=${r4.ms}`,
    )
    t('S15 活持有者 ⇒ 锁的字节一字未变', readFileSync(metaFile(d4), 'utf8') === raw4)
    t(
      'S16 超时文案不得出现"会自动抢占"的假承诺',
      !/会自动抢占/.test(err4?.message ?? ''),
      err4?.message,
    )

    // —— 5) 回归对照:强杀 dev 树后立即重启(持有者已退出 + 锁龄 1s ⇒ 必须秒抢占)
    const d5 = freshDir()
    putMeta(d5, JSON.stringify({ mode: 'dev', pid: DEAD_PID, ts: Date.now() - 1000 }))
    const r5 = await elapsed(() =>
      acquire({ mode: 'dev', timeoutMs: 600_000, staleMs: 600_000, dir: d5 }),
    )
    t(
      'S17 持有者已退出 + 锁龄 1s + stale=600s ⇒ 秒抢占(2026-08-27 行为保住)',
      r5.r === true && r5.ms < 4000,
      `ms=${r5.ms}`,
    )
    t(
      'S18 秒抢占前已归档现场',
      existsSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR) &&
        readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).length >= 1,
    )

    // —— 6/7) invalid:半截 JSON ⇒ 不得立即抢占;超 stale 才归档抢占
    for (const [tag, bad] of [
      ['JSON6', '{"mode":"build","pid":'],
      ['EMPTY', ''],
      ['NOPID', JSON.stringify({ mode: 'build', ts: 1 })],
    ]) {
      const dirA = freshDir()
      putMeta(dirA, bad)
      const ageA = lockAgeMs(dirA, readMeta(dirA)).ageMs
      let errA = null
      await acquire({ mode: 'build', timeoutMs: 900, staleMs: ageA + 600_000, dir: dirA }).catch(
        (e) => (errA = e),
      )
      t(`S19-${tag} 不可判定 + 未超 stale ⇒ 不抢占(超时)`, !!errA && existsSync(metaFile(dirA)))
      t(
        `S20-${tag} 超时文案如实写"无法判定"、点名真实出路、且不得谎称"文件不存在"`,
        /无法判定/.test(errA?.message ?? '') &&
          /stale/.test(errA?.message ?? '') &&
          !/不存在/.test(errA?.message ?? ''),
        errA?.message,
      )

      const dirB = freshDir()
      const rawB = putMeta(dirB, bad)
      const ageB = lockAgeMs(dirB, readMeta(dirB)).ageMs
      const rB = await acquire({
        mode: 'build',
        timeoutMs: 5000,
        staleMs: Math.max(-1, ageB - 1),
        dir: dirB,
      })
      t(`S21-${tag} 不可判定 + 已超 stale ⇒ 归档后抢占成功`, rB === true)
      const archived = readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).some((n) => {
        const f = join(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR, n, 'meta.json')
        try {
          return readFileSync(f, 'utf8') === rawB
        } catch {
          return false
        }
      })
      t(`S22-${tag} 现场按**原字节**归档(坏内容原样留档)`, archived)
    }

    // —— 8) unreadable 与 invalid 同样不得白拿
    const d8 = freshDir()
    mkdirSync(metaFile(d8), { recursive: true })
    let err8 = null
    await acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir: d8 }).catch(
      (e) => (err8 = e),
    )
    t(
      'S23 unreadable ⇒ 不立即抢占且文案给真实出路',
      !!err8 && /无法判定/.test(err8.message),
      err8?.message,
    )

    // —— 9) 目录在而 meta 从未写下(absent 态):不得当成"无人持锁"秒删
    const d9 = freshDir()
    let err9 = null
    await acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir: d9 }).catch(
      (e) => (err9 = e),
    )
    t(
      'S24 空锁目录(absent)未超 stale ⇒ 不等价于"无人持锁",不删别人正在创建的锁',
      !!err9 && existsSync(d9),
    )

    // —— 10) check 三态如实输出
    const lineOf = (dir) => {
      let out = ''
      check({ dir, log: (s) => (out += s) })
      return out
    }
    t('S25 check:无锁 ⇒ exit 0', check({ dir: join(base, 'nothing'), log: () => {} }) === 0)
    t('S26 check:ok+存活 ⇒ exit 1 且打印 pid/alive', lineOf(d4).includes('alive=true'))
    const badChk = freshDir()
    putMeta(badChk, '{"mode":"build","pid":')
    const chk = lineOf(badChk)
    t(
      'S27 check:invalid ⇒ 输出含"无法判定"与原因**且点名态名**',
      chk.includes('无法判定') && chk.includes('invalid') && chk.includes('JSON'),
      chk,
    )
    t(
      'S28 check:invalid ⇒ 禁止打印成空字段形态(旧版 "mode= pid= ts=")',
      !/mode=\s+pid=\s+alive=/.test(chk) && !/ts=\s*$/.test(chk),
      chk,
    )
    t('S29 check:unreadable ⇒ 同样喊"无法判定"', lineOf(d8).includes('无法判定'))

    // —— 30) release 不得"坏锁白拿"
    const d10 = freshDir()
    putMeta(d10, 'not json at all')
    const rel10 = release({ mode: 'build', dir: d10 })
    t(
      'S30 release:元数据不可判定 ⇒ 拒绝释放,锁目录仍在',
      rel10.released === false && existsSync(d10),
    )
    const rel11 = release({ mode: 'build', dir: d3 })
    t('S31 release:持有者是自己 ⇒ 释放成功', rel11.released === true && !existsSync(d3))
    const d12 = freshDir()
    putMeta(d12, JSON.stringify({ mode: 'build', pid: DEAD_PID, ts: Date.now() }))
    const rel12 = release({ mode: 'build', dir: d12 })
    t('S32 release:悬挂锁(持有者已死)可代为收口', rel12.released === true && !existsSync(d12))

    // —— 33) dev+dev 共存语义不得回归
    const d13 = freshDir()
    putMeta(d13, JSON.stringify({ mode: 'dev', pid: process.pid, ts: Date.now() }))
    const r13 = await acquire({ mode: 'dev', timeoutMs: 900, dir: d13 })
    t('S33 dev+dev 共存仍然放行', r13 === true)
    // —— 34) 创建锁本身失败(非 EEXIST)必须当场报错,不得退化成"死等一把自己建不出来的锁"
    let err34 = null
    await acquire({
      mode: 'build',
      timeoutMs: 1500,
      dir: join(base, 'no-such-parent', 'lock'),
    }).catch((e) => (err34 = e))
    t(
      'S34 mkdir 非 EEXIST 失败 ⇒ 立刻报错并点名错误码(不进死等)',
      !!err34 && /创建\/写入锁/.test(err34.message) && /ENOENT/.test(err34.message),
      err34?.message ?? '未抛错',
    )

    // —— 35) pid 复用:名义存活 + 锁龄超硬上限 ⇒ 不得无限 wait(2026-09-25 部署环冻结 11h50m 那一格)
    const d35 = freshDir()
    putMeta(
      d35,
      JSON.stringify({ mode: 'build', pid: process.pid, ts: Date.now() - HARD_CAP_MS - 10_000 }),
    )
    const dec35 = decideSteal({ dir: d35, mode: 'build', staleMs: 600_000, hardCapMs: HARD_CAP_MS })
    t(
      'S35 持有者是自己 CLI pid 且"存活",但锁龄超硬上限 ⇒ steal(pid 复用兜底)而不是 wait',
      dec35.action === 'steal' && /硬上限/.test(dec35.why),
      `${dec35.action} / ${dec35.why}`,
    )
    // —— 36) 同一把锁在硬上限**之内**不得被抢(否则就是把活人的构建打断)
    const d36 = freshDir()
    putMeta(d36, JSON.stringify({ mode: 'build', pid: process.pid, ts: Date.now() - 60_000 }))
    const dec36 = decideSteal({ dir: d36, mode: 'build', staleMs: 600_000, hardCapMs: HARD_CAP_MS })
    t('S36 锁龄在上限内且持有者存活 ⇒ wait(硬上限不得变成新的秒抢判据)', dec36.action === 'wait', dec36.why)
    // —— 37) ownerPid 才是判活对象:CLI pid 已退而 owner 仍活 ⇒ 不得抢占
    const d37 = freshDir()
    putMeta(
      d37,
      JSON.stringify({ mode: 'build', pid: DEAD_PID, ownerPid: process.pid, ts: Date.now() }),
    )
    const dec37 = decideSteal({ dir: d37, mode: 'build', staleMs: 600_000, hardCapMs: HARD_CAP_MS })
    t(
      'S37 有 ownerPid 时按 owner 判活:CLI pid 死了而 owner 活着 ⇒ wait',
      dec37.action === 'wait' && /owner pid/.test(dec37.why),
      `${dec37.action} / ${dec37.why}`,
    )
    // —— 38) writeMeta 必须把 owner 落进 meta.json(否则判活退化成 CLI 自己那把死 pid)
    const d38 = freshDir()
    mkdirSync(d38, { recursive: true })
    writeMeta(d38, 'build', { ownerPid: 4242 })
    const m38 = JSON.parse(readFileSync(metaFile(d38), 'utf8'))
    t('S38 writeMeta 记录 ownerPid', m38.ownerPid === 4242 && Number(m38.pid) === process.pid, JSON.stringify(m38))
    t('S39 holderPid:有 owner 用 owner,没有退回 CLI pid', holderPid({ pid: 7, ownerPid: 4242 }) === 4242 && holderPid({ pid: 7, ownerPid: 0 }) === 7)
  } finally {
    rmScratch(base)
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `自检 ${results.length} 条:pass ${results.length - failed.length} / fail ${failed.length}`,
  )
  for (const f of failed) console.log(`  ❌ ${f.name} — ${f.detail}`)
  return failed.length === 0 ? 0 : 1
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  const getOpt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const dir = getOpt('--lock-dir') ? resolve(getOpt('--lock-dir')) : undefined

  try {
    if (cmd === '--self-test' || args.includes('--self-test')) {
      try {
        process.exit(await runSelfTest())
      } catch (e) {
        // 自检脚本自身异常 ≠ 判据失败:按 §22d/§22b 约定用 exit 2 显式"无法判定"
        console.error(`❌ 自检脚本异常(非判据失败):${e?.message ?? e}\n${e?.stack ?? ''}`)
        process.exit(2)
      }
    } else if (cmd === 'acquire') {
      await acquire({
        mode: getOpt('--mode') ?? 'build',
        timeoutMs: Number(getOpt('--timeout') ?? 600_000),
        staleMs: Number(getOpt('--stale') ?? 600_000),
        // 调用方(构建脚本)自己的 pid 才是这段锁的主人;CLI 自己会立刻退出。
        ownerPid: getOpt('--owner-pid') ? Number(getOpt('--owner-pid')) : undefined,
        ...(dir ? { dir } : {}),
      })
    } else if (cmd === 'release') {
      release({ mode: getOpt('--mode') ?? 'build', ...(dir ? { dir } : {}) })
    } else if (cmd === 'check') {
      process.exit(check(dir ? { dir } : {}))
    } else {
      console.error(
        '用法: deploy-lock.mjs acquire|release|check [--mode <build|dev>] [--timeout <ms>] [--stale <ms>] [--lock-dir <path>]\n' +
          '      deploy-lock.mjs --self-test',
      )
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
}

// §22d:双形态入口守护 —— 被测试 import 时绝不触发 CLI 副作用
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// §22c:暴露给镜像测试,禁止在测试里复制第二份判据实现
export const __test__ = {
  lockDir,
  metaFile,
  classifyMeta,
  readMeta,
  writeMeta,
  isProcessAlive,
  holderPid,
  HARD_CAP_MS,
  lockAgeMs,
  decideSteal,
  acquire,
  release,
  check,
  sceneArchiveRoot,
  claimStaleLock,
  lockIdentity,
  repoRoot,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
