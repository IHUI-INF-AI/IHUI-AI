// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * stale-lock-claim.mjs — 悬挂锁「原子抢占」原语的唯一实现(2026-09-26 立)。
 *
 * 合并前它有两份:`scripts/git-lock.mjs` 与 `scripts/deploy-lock.mjs` 各写了一个
 * `claimStaleLock`(出处见 `git log --grep 锁抢占`,e0a222de0b1 的交付报告如实登记了
 * 这笔"两处算同一件事"的债)。本仓反复记过同一条教训:**两处实现必然漂移**,
 * 所以算法本体收进这里,调用方只注入各自的差异。
 *
 * 算法(一步都不能少,两份旧实现的公共骨架逐字保序):
 *   0. 入口先看锁目录在不在(只为不给已消失的锁建归档目录,**不是**安全凭据);
 *   1. `renameSync(dir, 归档出口/<name>.stale-<pid>-<ts>-<rand>)` 原子改名独占;
 *      ENOENT ⇒ 判"没抢到、锁已不见",其余错误 ⇒ 退到同父目录暂存(仍 rename-first);
 *      **任何失败都绝不回退去 rmSync 原路径**;
 *   2. 回读**改名后目录**的状态,与判死时那份比指纹(怎么比 = 注入 `readState`+`same`);
 *      不等 ⇒ 改到的是别人新建的活锁 ⇒ 原样放回、什么都没删;放不回就保留现场喊人工;
 *   3. 只有 2 通过才处置改名后的那一份:先写抢占现场说明(格式 = 注入 `writeNote`),
 *      再按落点策略处置(现场落在归档外怎么办 = 注入 `placeScene`)。
 *
 * 注入面(即两份旧实现的全部真实差异,语义一律按现状保留、未做统一):
 *   - `archiveRoot`  归档落点(git 侧 `gitArchiveDir()` / 部署侧 `sceneArchiveRoot()`,由调用方求默认值后传入)
 *   - `readState`/`same`  meta 指纹怎么算(git 侧三字段 / 部署侧四态+kind)
 *   - `writeNote`    现场说明的格式与文件名(git 侧 txt / 部署侧 json)
 *   - `placeScene`   现场落在归档外时的处置(git 侧搬进归档、搬不动就删 / 部署侧原地保留)
 *   - `suffix`       改名后缀覆写(测试夹具用,两侧同有)
 * 日志措辞/phase 名等呈现层差异**不在 lib 里**——核心只回结构化 `cause`,
 * 由各调用方的 wrapper 逐字渲染为旧文案,保证行为等价。
 *
 * 本 lib 无任何 console 输出、不派生子进程、不碰 git。
 */
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { basename, join } from 'node:path'

/** 锁目录里元数据文件的固定名(两侧旧实现逐字相同,收于一处) */
const META_FILE_NAME = 'meta.json'

/**
 * 抢占一次悬挂锁。返回**中性结构**,由调用方映射为自己的 phase/文案:
 *   { ok:false, cause:'dir-gone-early' }
 *   { ok:false, cause:'archive-rename-enoent', error }
 *   { ok:false, cause:'rename-failed', archiveErr, localErr }
 *   { ok:false, cause:'identity-mismatch', restored, stagedPath, nowState }
 *   { ok:true,  cause:'claimed', stagedPath, archived, noteResult }
 *
 * @param {string} dir 锁目录
 * @param {unknown} judged 判死时读到的状态(比对基准;git 侧是 meta|null,部署侧是四态)
 * @param {string} why 判死理由(交给 writeNote 落现场)
 * @param {{archiveRoot?:string|null, suffix?:string,
 *   readState:(dirPath:string)=>unknown, same:(a:unknown,b:unknown)=>boolean,
 *   writeNote:(stagedPath:string, ctx:{judged:unknown,rawMeta:string|null,why:string})=>unknown,
 *   placeScene:(ctx:{dir:string, stagedPath:string, archiveRoot:string|null})=>{archived:string|null}}} opts
 */
export function claimStaleLockCore(dir, judged, why, { archiveRoot = null, suffix, readState, same, writeNote, placeScene } = {}) {
  // 0. 已不见 ⇒ 未删除、未创建任何目录(它不是抢占的安全凭据 —— 凭据是①改名+②回读)
  if (!existsSync(dir)) {
    return { ok: false, cause: 'dir-gone-early', stagedPath: null, archived: null }
  }
  const tag = suffix ?? `.stale-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  let rawMeta = null
  try {
    rawMeta = readFileSync(join(dir, META_FILE_NAME), 'utf8')
  } catch {
    rawMeta = null
  }
  // 1. 原子改名:优先直接搬进归档出口(§15b 批准落点,不落工作区根/盘根)
  let stagedPath = null
  let archiveErr = null
  if (archiveRoot) {
    try {
      const target = join(archiveRoot, `${basename(dir)}${tag}`)
      mkdirSync(archiveRoot, { recursive: true })
      renameSync(dir, target)
      stagedPath = target
    } catch (e) {
      if (e?.code === 'ENOENT') {
        return { ok: false, cause: 'archive-rename-enoent', error: e, stagedPath: null, archived: null }
      }
      archiveErr = e
      stagedPath = null // 跨卷/权限等:退到同父目录暂存(仍是 rename-first)
    }
  }
  if (!stagedPath) {
    const local = `${dir}${tag}`
    try {
      renameSync(dir, local)
      stagedPath = local
    } catch (e) {
      return { ok: false, cause: 'rename-failed', archiveErr, localErr: e, stagedPath: null, archived: null }
    }
  }
  // 2. 身份回读:改到的必须就是我刚判死的那把
  const nowState = readState(stagedPath)
  if (!same(judged, nowState)) {
    let restored = false
    try {
      renameSync(stagedPath, dir)
      restored = true
    } catch {
      /* 放不回(原路径又被占了)⇒ 现场原地保留、绝不删,大声喊出来交人工 */
    }
    return { ok: false, cause: 'identity-mismatch', restored, stagedPath, nowState }
  }
  // 3. 先写现场说明,再处置改名后的那一份(且只有这一份)
  const noteResult = writeNote(stagedPath, { judged, rawMeta, why })
  const { archived } = placeScene({ dir, stagedPath, archiveRoot })
  return { ok: true, cause: 'claimed', stagedPath, archived, noteResult }
}

/**
 * 防复发判据(测试支撑出口,供 scripts/tests 的镜像/防回归测试调用,不在测试里另抄一份):
 * 两个调用方的源码面不得再出现第二份抢占实现 —— 每处顶层 `function claimStaleLock`
 * 必须是**委托**(体内调 `claimStaleLockCore(`)且**不得含改名核心**(`renameSync(`)。
 * 提取按"顶层函数声明止于行首 `}`"—— 本仓 prettier/eslint 形态下成立,
 * 解析不出函数体一律记为问题(判据失效不得表现为安静通过)。
 *
 * @param {string} src 被审脚本源码
 * @param {string} label 报错点名用的文件标签
 * @returns {string[]} 问题清单;空数组 = 合规
 */
export function auditClaimStaleLockSource(src, label) {
  const problems = []
  const declRe = /function\s+claimStaleLock\s*\(/g
  let m
  while ((m = declRe.exec(src)) !== null) {
    const bodyMatch = /^function\s+claimStaleLock[^\n]*\{([\s\S]*?)\n\}/.exec(src.slice(m.index))
    if (!bodyMatch) {
      problems.push(`${label}: 解析不出 function claimStaleLock 的函数体(判据失效不允许安静通过)`)
      continue
    }
    const body = bodyMatch[1]
    if (!body.includes('claimStaleLockCore(')) {
      problems.push(`${label}: function claimStaleLock 未委托 lib 的 claimStaleLockCore ⇒ 疑似第二份实现`)
    }
    if (/renameSync\s*\(/.test(body)) {
      problems.push(`${label}: function claimStaleLock 体内出现 renameSync ⇒ 抢占核心回到了调用方(唯一实现在 scripts/lib/stale-lock-claim.mjs)`)
    }
  }
  // 换了名字的副本也要抓到:改名核心的指纹动作是"把原锁路径 rename 走",
  // 委托 wrapper 结构上不需要它(它只把 dir 作为参数交给 lib)。
  if (/renameSync\s*\(\s*dir\s*,/.test(src)) {
    problems.push(`${label}: 出现 renameSync(dir, … ⇒ 对原锁路径的改名回到了调用方,抢占实现又长了第二份`)
  }
  return problems
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
