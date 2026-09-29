// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * atomic-write.mjs — 仓库工具层「文件原子替换写盘」的**唯一出口**(2026-09-29 立,台账 G-653)。
 *
 * 病灶(现读复核,不是假想):锁/所有权 meta 文件一直是裸 `writeFileSync(target, …)`。
 * 覆盖写一个已存在的文件是**两步**(`O_TRUNC` → 再写),而读者随时可能落在这两步之间:
 *   - `scripts/git-lock.mjs` 的 `check` / 心跳判活、计划任务 `git-guardian` 每 2 分钟一轮;
 *   - `scripts/deploy-lock.mjs` 的 `check` 与 `--self-test`(部署环每 30 分钟一轮);
 *   - `scripts/check-credential-health.mjs` 的告警去重状态与心跳件(下一轮 / 守护各自读回)。
 * 它们读到的是**半截 JSON**,而这一仓对"读不懂 meta / 读不到 meta"的既有处置是
 * 「absent / invalid ⇒ 锁龄超 stale 即归档抢占」—— 于是**一个活着的持锁者可以被读成"无 meta /
 * 已退出"并被抢走锁**(§5b / §12d 记过多次:判活判错 ⇒ 并发写坏 `.git`)。§5b 与部署锁那两节
 * 把失效方向钉死为"**少抢一把,不是多抢**",而半截文件恰好把方向翻成"多抢一把"。
 *
 * 为什么是**新建**这一份而不是复用已存在的那份(先 grep 再决定,别抄第二份):
 *   - 全仓唯一的原子写出口是 `apps/cli/src/util/atomic-write.ts`,而它是 **CLI 运行时代码**:
 *     `apps/cli/tsconfig.json:8` 写死 `"rootDir": "src"`,`apps/cli/package.json` 的 `files`
 *     只含 `dist` —— 该文件头注 `:8-14` 正是用这条理由拒绝住进 `scripts/lib/`。反方向同样不通:
 *     根 `scripts/*.mjs` 由裸 `node` 直接执行(钩子、计划任务、守护都是),引一个 `.ts` 要编译期
 *     或 tsx 运行时,而提交链里没有那样东西。
 *   - 架构契约表 `config/architecture-policy.yaml` 的 `repo-tooling`(`roots` 含 `scripts`、
 *     `managed: true`)其 `requires` **不含任何 `apps/*`** ⇒ 从工具层引端内实现是未声明依赖(D1),
 *     而那正是守门 103 判红的一格。
 *   - **语义也不同,不能照搬**:那一份带"读后写 stale 校验"(`captureWriteBaseline` /
 *     `WriteConflictError`),防的是两个编辑者互相覆盖;而锁 meta 的既有语义是**后写覆盖前写**
 *     (心跳续 `meta.ts` 就靠这个)。接那套校验等于改锁语义 —— 本票明令禁止。
 *   ⇒ 所以按层各一份、**工具层只此一份**;调用点一律引这里,由 `auditAtomicWriteSource` 钉住
 *   "不得再各写一遍 tmp+rename"。端内那一份归 `scripts/check-file-write-safety.mjs`(R2)守。
 *
 * 三条不许漂的写法:
 *   1. **同目录**临时文件 + `renameSync` 替换。跨目录 rename 可能 EXDEV(那就不再原子);
 *      临时名带 pid + 进程内序号 + 随机字节 ⇒ 并发写不撞同一个临时名,且用 `wx` 独占创建。
 *      ⚠️ **不 `mkdir` 目标的父目录**:调用方原本就靠"目录不在 ⇒ ENOENT 抛错"暴露
 *      "锁目录已被抢走/被删"这一格(见 `scripts/lib/lock-atomic-init.mjs` 对 pending 的注释)。
 *      顺手补一个 `{recursive:true}` 会把一次真故障洗成一次成功写入 —— 那是改语义,不是加固。
 *   2. **绝不跟随符号链接/重解析点**:最终路径分量本身是链接 ⇒ 抛 `SymlinkTargetError`,不穿透
 *      (实测裸 `writeFileSync` 会穿透链接把**真身**改掉、却报告写的是链接;§26 递归穿透事故同族)。
 *      目录级 junction 不在射程内 —— 那是 §26 刻意把工具态改道到 D 盘的机制,跟进才是正确语义。
 *   3. **失败路径不留临时文件、也不截目标**:Windows 上 rename 撞"目标已被别的句柄打开"给的是
 *      **EPERM**(不是 EEXIST;`scripts/check-file-write-safety.mjs:16` 记的同一条实测),同族还有
 *      EBUSY/EACCES,父目录被并发删走给 ENOENT ⇒ 带退避重试(总等待 ≈ 315ms)。重试用尽则清掉
 *      自己的临时文件并抛 `AtomicReplaceFailedError`,磁盘上**仍是完整旧内容** —— 本票判据正落在
 *      这一条:失败也必须让读者拿到一份完整旧值,而不是半截。清理失败如实带在 `cleanupError`,
 *      不静默(静默 = 下一个读锁目录的人看见一个无人认领的半成品)。
 */
import {
  chmodSync,
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { basename, dirname, join } from 'node:path'

/** rename 在这些错误码下**值得重试**(Windows 共享冲突族 + 父目录被并发删走);其余码一次即失败。 */
export const RETRYABLE_RENAME_CODES = Object.freeze(['EPERM', 'EBUSY', 'EACCES', 'ENOENT'])

/**
 * 退避表(毫秒),9 次尝试、总预算 ≈ 1.55s。
 *
 * ⚠️ 这个数是**量出来的**,不是抄端内那份的:第一版沿用 `apps/cli/src/util/atomic-write.ts`
 * 的 315ms 预算,而 `scripts/tests/deploy-lock.test.mjs` 的成对①在"读者持续持有目标"的压力下
 * **8 次退避全部 EPERM** ⇒ 抛 `AtomicReplaceFailedError`(实测原文:
 * `原子替换失败(已尝试 8 次):…meta.json ← EPERM`)。那一格失败按既有处置是"心跳没能续上 ts"——
 * 比半截 JSON 温和,但仍是要命的方向。
 * 压力面刻意用 200 KB 载荷把读者的持柄窗口放大(真实 meta.json 约 150 字节 ⇒ 微秒级,
 * 一次 10ms 退避就够);预算上限 1.55s 仍远小于 git 心跳间隔(5s)与 acquire 的 120s,
 * 不会把调用方挂住。
 */
export const RENAME_BACKOFF_MS = Object.freeze([10, 20, 40, 80, 150, 250, 400, 600])

/** 临时文件名形态:`.<目标名>.tmp-<pid>-<序号>-<随机>`(前导点 ⇒ 隐藏;固定中缀 ⇒ 可被巡检认出)。 */
export const TMP_INFIX = '.tmp-'

/** 目标本身是链接/重解析点 ⇒ 拒绝写入(绝不穿透改真身)。 */
export class SymlinkTargetError extends Error {
  constructor(absPath, target) {
    super(
      `拒绝写入符号链接:${absPath} 是指向 ${target} 的重解析点。` +
        '本出口刻意不跟随链接(穿透会把链接指向的真实文件改掉,却报告写的是链接)。' +
        '确实要改那份内容,请直接用它的真实路径。',
    )
    this.name = 'SymlinkTargetError'
    this.code = 'symlink_target'
    this.absPath = absPath
    this.target = target
  }
}

/** 临时文件已写出,但 rename 反复失败(句柄长期被占用等)—— 目标**未被改动**。 */
export class AtomicReplaceFailedError extends Error {
  constructor(absPath, attempts, cause, cleanupError) {
    const reason = `${cause?.code ?? cause?.name ?? '?'} ${cause?.message ?? cause ?? ''}`.trim()
    super(
      `原子替换失败(已尝试 ${attempts} 次):${absPath} ← ${reason}` +
        (cleanupError ? `;临时文件清理也失败:${cleanupError}` : ''),
    )
    this.name = 'AtomicReplaceFailedError'
    this.code = 'atomic_replace_failed'
    this.absPath = absPath
    this.attempts = attempts
    this.cause = cause
    this.cleanupError = cleanupError ?? null
  }
}

const nodeFs = {
  lstatSync,
  readlinkSync,
  statSync,
  chmodSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  renameSync,
  rmSync,
}

/**
 * 默认注入面(镜像测试**只覆盖那一个函数**来证某条失败分支,不得在测试里手抄一整份 fs 袋 ——
 * 抄的那份与真实袋漂开,失败分支断言就落在一个生产代码不走的对象上,§22c 同一条禁令)。
 */
export const NODE_FS = nodeFs

let tmpSeq = 0

/** 进程内递增序号 —— 同一毫秒同一进程走两次写入也不撞名(同 `lock-atomic-init.defaultNonce` 那一维)。 */
function nextSeq() {
  tmpSeq += 1
  return tmpSeq
}

/**
 * 同目录临时文件路径。**单独导出**是为了让镜像测试问**同一把尺子**它落在哪,
 * 而不是在测试里再拼一遍 `.meta.json.tmp-…`(拼错的那份断言永远绿 —— 与
 * `lock-atomic-init.mjs` 的 `pendingPathFor` 同一条理由)。
 */
export function tmpPathFor(
  targetPath,
  { pid = process.pid, seq = nextSeq(), rnd = randomBytes(4).toString('hex') } = {},
) {
  return join(dirname(targetPath), `.${basename(targetPath)}${TMP_INFIX}${pid}-${seq}-${rnd}`)
}

/** 同步退避:调用方(锁心跳 / 巡检)本就是同步落盘,不引入 async 以免签名扩散。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function errCode(e) {
  return typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : undefined
}

/** 清理只为"失败路径不留半成品";清理本身失败要如实带出去,不得吞掉(静默 = 下一个人看见孤儿)。 */
function removeQuietly(F, p) {
  try {
    F.rmSync(p, { force: true, maxRetries: 5, retryDelay: 50 })
    return null
  } catch (e) {
    return `${errCode(e) ?? ''} ${e?.message ?? e}`.trim()
  }
}

/**
 * 「最终路径分量本身是不是一个该拒绝的链接」—— 只看最后一段,不解析父目录
 * (目录级 junction 是 §26 的改道机制,跟进是正确语义;见头注判据 2)。
 */
function assertNotReparsePoint(F, absPath) {
  let st
  try {
    st = F.lstatSync(absPath)
  } catch (e) {
    if (errCode(e) === 'ENOENT') return null
    throw e
  }
  if (st.isSymbolicLink()) {
    let target = '(链接目标不可解析)'
    try {
      target = String(F.readlinkSync(absPath))
    } catch {
      /* 保留占位文案:量不到目标不改变"这是一条链接"这一判定 */
    }
    throw new SymlinkTargetError(absPath, target)
  }
  if (st.isDirectory()) {
    throw new Error(`写入目标是一个目录,不是文件:${absPath}(裸写在这一格给 EISDIR,本出口同样不静默)`)
  }
  return st
}

/**
 * rename 替换 + Windows 共享冲突族退避重试。
 * 成功返回**实际尝试次数**;用尽即抛 `AtomicReplaceFailedError`(带 cleanupError,不吞)。
 * ⚠️ 尝试次数是量出来的,不是退避表长度 —— 把"一次就没重试的非可重试码"报成"重试了 8 次",
 * 就是本仓反复登记的那一型"把没做成写成做过了"。
 */
function renameWithRetry(F, tmp, absPath, { backoff = RENAME_BACKOFF_MS, sleep = sleepSync } = {}) {
  let lastError = null
  let attempts = 0
  for (let i = 0; i <= backoff.length; i++) {
    attempts = i + 1
    try {
      F.renameSync(tmp, absPath)
      return attempts
    } catch (e) {
      lastError = e
      if (!RETRYABLE_RENAME_CODES.includes(errCode(e))) break
      if (i < backoff.length) sleep(backoff[i])
    }
  }
  const cleanupError = removeQuietly(F, tmp)
  throw new AtomicReplaceFailedError(absPath, attempts, lastError, cleanupError)
}

/** 全量写出(带短写循环)。返回落盘字节数。 */
function writeOutFull(F, fd, payload, encoding, wantBytes) {
  if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
    let offset = 0
    let guard = 0
    while (offset < payload.byteLength) {
      const n = F.writeSync(fd, payload, offset, payload.byteLength - offset, offset)
      // 返回 0 不是"稍后再说"—— 同步写不会背压,0 就是写不进去。必须有界退出,否则本函数死循环。
      if (!Number.isFinite(n) || n <= 0) {
        if (++guard > 8) throw new Error(`写入停滞:已写 ${offset}/${payload.byteLength} 字节,writeSync 连续返回 ${n}`)
        continue
      }
      offset += n
    }
    return offset
  }
  const n = F.writeSync(fd, payload, 0, encoding)
  if (n !== wantBytes) {
    throw new Error(`写入不完整:期望 ${wantBytes} 字节,实得 ${n} 字节`)
  }
  return n
}

/**
 * 原子写盘:① 拒绝链接目标;② 同目录临时文件 + 全量写出(短写即失败,不把半成品换上去)
 * + best-effort `fsync`;③ rename 替换,EPERM 族带退避重试;④ 任何失败都不留临时文件、不截目标。
 *
 * 载荷形态与 `writeFileSync(target, data, encoding)` 等价:string 走 `encoding`,
 * Buffer/Uint8Array 走原始字节(部署锁归档现场那一步复制的是**字节**,不是重新序列化的对象)。
 * 其它类型一律抛 `TypeError` —— 旧的 `writeFileSync` 对 `undefined` 也是抛错,
 * 这里不得把"没有内容可写"静默写成 `"null"` 那四个字节(那是把一次故障洗成一次成功)。
 *
 * @param {string} targetPath 目标文件
 * @param {string|Buffer|Uint8Array} data 要落的内容
 * @param {{encoding?:BufferEncoding, fs?:object, backoff?:number[],
 *   sleep?:(ms:number)=>void, tmpName?:string}} [opts]
 *   `fs` / `sleep` / `tmpName` 是注入面:镜像测试据此证真/证伪各条失败分支,
 *   不必真去造权限故障(与 `stale-lock-claim.mjs` / `lock-atomic-init.mjs` 同一套注入纪律)。
 * @returns {{bytes:number,renameAttempts:number}} 落盘回执(仅供取证,不参与任何判据)
 */
export function atomicWriteFileSync(targetPath, data, opts = {}) {
  if (typeof targetPath !== 'string' || targetPath === '') {
    throw new TypeError(`atomicWriteFileSync: 目标路径不可用(${JSON.stringify(targetPath)})`)
  }
  const isString = typeof data === 'string'
  if (!isString && !Buffer.isBuffer(data) && !(data instanceof Uint8Array)) {
    throw new TypeError(`atomicWriteFileSync: 载荷必须是 string/Buffer/Uint8Array,实得 ${typeof data}`)
  }
  const F = opts.fs ?? nodeFs
  const encoding = opts.encoding ?? 'utf8'
  const wantBytes = isString ? Buffer.byteLength(data, encoding) : data.byteLength

  // ① 链接判在**写之前**:一次穿透写就把别人机器的真身改了
  assertNotReparsePoint(F, targetPath)

  const tmp = opts.tmpName ?? tmpPathFor(targetPath)
  let fd = null
  let created = false
  try {
    // 'wx' = 独占创建:临时名已存在(撞名 / 上次崩溃残留)直接 EEXIST 抛出,
    // 绝不复用一个不受本进程控制的既有文件 —— 那正是"第二个人写进同一份半成品"的入口。
    fd = F.openSync(tmp, 'wx')
    created = true
    // 短写(实得 < 期望)在 writeOutFull 里就地抛错,不留第二处校验 —— 两处算同一件事必漂移
    writeOutFull(F, fd, data, encoding, wantBytes)
    try {
      F.fsyncSync(fd) // 数据先落盘再让 rename 生效 —— 否则"原子"只保并发、不保崩溃
    } catch {
      /* 某些文件系统不支持 fsync:退化为只依赖 rename 的原子性,不因此判失败 */
    }
    F.closeSync(fd)
    fd = null
  } catch (e) {
    if (fd !== null) {
      try {
        F.closeSync(fd)
      } catch {
        /* 关闭失败不得掩盖主错误 */
      }
    }
    // ⚠️ **只有本进程真建出来的那个临时文件才归本进程删**。openSync 自己失败(撞名 EEXIST)时
    // 那个路径属于别人 —— 顺手 rmSync 就是"清理别人的现场",与本仓"不删别人的锁"同一条禁令。
    if (created) {
      const cleanupError = removeQuietly(F, tmp)
      if (cleanupError) e.cleanupError = cleanupError
    }
    throw e
  }

  // POSIX 保住原文件权限位(rename 会把临时文件的 mode 带过去,可执行文件会被改坏);
  // Windows 的 stat.mode 不可靠,不参与(与端内那份出口同取舍)。
  if (process.platform !== 'win32') {
    try {
      F.chmodSync(tmp, F.statSync(targetPath).mode & 0o7777)
    } catch {
      /* 目标不存在或取不到权限位:按临时文件默认位落盘,不判失败 */
    }
  }

  // ③ 原子可见
  const renameAttempts = renameWithRetry(F, tmp, targetPath, { backoff: opts.backoff, sleep: opts.sleep })
  return { bytes: wantBytes, renameAttempts }
}

/**
 * 默认管的裸写形态 —— 都是"另一个进程会把它按 JSON 读回并据此判活/判归属"的那一类。
 * 刻意**不**管:
 *   - `appendFileSync`(记账 jsonl 是追加语义,整文件替换写法不适用,且追加本身不截读者在读的字节);
 *   - 一次性现场说明(`scene-note.txt` / `stale-claim-note.*`):写在**新建的**归档目录里,
 *     没有并发读者,也没有判据在它上面判活。
 */
export const DEFAULT_BARE_WRITE_SHAPES = Object.freeze([
  { name: 'writeFileSync(metaFile(…)', re: /writeFileSync\s*\(\s*metaFile\s*\(/g },
  { name: "writeFileSync(join(…, 'meta.json')", re: /writeFileSync\s*\(\s*join\([^)]*['"]meta\.json['"]/g },
  { name: 'writeFileSync(STATE…)', re: /writeFileSync\s*\(\s*STATE\b/g },
  { name: 'writeFileSync(UNDEL…)', re: /writeFileSync\s*\(\s*UNDEL\b/g },
  {
    name: 'writeFileSync(join(…, credential-health-last.json)',
    re: /writeFileSync\s*\(\s*join\([^)]*credential-health-last\.json/g,
  },
])

/**
 * 防复发判据(测试支撑出口,供镜像测试调用,**不得在测试里另抄一份判据**):
 * 被审源码的**代码面**里,那一族"会被别的进程按 JSON 读回"的文件不得再走裸 `writeFileSync`,
 * 也不得自己手拼一份 tmp+rename(两处算同一件事必漂移,是本仓记过最多次的失败型)。
 *
 * 三条检查各有独立的失效方向,任何一条漂了都会以"看起来一切正常"的形态存在:
 *   ① 必须真的调了本出口(只 import 不调用 = 半接线,守门 118 那一型);
 *   ② 不得出现名单里任一"裸写 meta/state"形态;
 *   ③ 不得在本文件内再拼一份"临时文件 + rename 替换"的实现。
 *
 * @param {string} src 被审源码(调用方应传**剥掉注释**后的代码面,与 stale-lock-claim 同纪律)
 * @param {string} label 点名用
 * @param {{bareWriteShapes?:Array<{name:string,re:RegExp}>}} [opts] 要管的裸写形态(默认上面那份名单)
 * @returns {string[]} 问题清单;空数组 = 合规
 */
export function auditAtomicWriteSource(src, label, { bareWriteShapes = DEFAULT_BARE_WRITE_SHAPES } = {}) {
  const problems = []
  if (!/atomicWriteFileSync\(/.test(src)) {
    problems.push(`${label}: 未调用 lib 的原子写出口 ⇒ 写盘回到了裸 writeFileSync 那一型`)
  }
  for (const { name, re } of bareWriteShapes) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
    for (const m of String(src).matchAll(new RegExp(re.source, flags))) {
      problems.push(`${label}: 出现 ${name}(实得片段:${JSON.stringify(m[0])})`)
    }
  }
  if (/openSync\(\s*tmp\b|renameSync\(\s*tmp\b/.test(src)) {
    problems.push(`${label}: 文件内出现手拼的"临时文件 + rename 替换"⇒ 第二份原子写实现长回来了`)
  }
  return problems
}

export const __test__ = {
  RETRYABLE_RENAME_CODES,
  RENAME_BACKOFF_MS,
  TMP_INFIX,
  DEFAULT_BARE_WRITE_SHAPES,
  // 默认注入面:镜像测试要证某一条失败分支时**只覆盖那一个函数**
  // (`{ ...AW.NODE_FS, renameSync: () => { throw e } }`),不得在测试里手抄一整份 fs 袋 ——
  // 抄的那份与真实袋漂开,失败分支断言就落在一个生产代码不走的对象上(§22c 同一条禁令)。
  NODE_FS,
  tmpPathFor,
  renameWithRetry,
  assertNotReparsePoint,
  writeOutFull,
  auditAtomicWriteSource,
  atomicWriteFileSync,
  SymlinkTargetError,
  AtomicReplaceFailedError,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
