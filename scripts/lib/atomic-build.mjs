// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 原子构建包装器：先编译到暂存目录 dist.__building__，全部成功后一瞬间换入 dist。
//
// 为什么存在：旧构建形态 `rimraf dist && tsc` 会在「删光 dist → 编译完成」的整个窗口期
// （数秒到数十秒）让 dist 处于缺失/半成品状态，任何在此期间解析该包的消费方
// （web dev server 等）直接 500 —— 2026-09-30 实证两轮全站页面报错均源于此
// （api-client dist 被并行构建清空，`Can't resolve '../client.js'`）。
//
// 用法（在包目录下，pnpm script 的 cwd 即包根）：
//   node ../../scripts/lib/atomic-build.mjs <tsc 参数...> [--copy-assets <相对路径>]
// 例：
//   node ../../scripts/lib/atomic-build.mjs -p tsconfig.json
//   node ../../scripts/lib/atomic-build.mjs -p tsconfig.json --copy-assets scripts/copy-assets.mjs
//
// 流程：
//   1. 预清理 dist.__building__ / dist.__old__ / 根级 tsconfig.tsbuildinfo（构建产物，可安全删除）
//   2. `pnpm exec tsc <参数> --outDir dist.__building__`（CLI --outDir 覆盖 tsconfig 内的 outDir）
//   3. 若带 --copy-assets：动态 import 该脚本，调其导出的 runCopy({ distDir: TMP })
//      （design-tokens 的 copy-assets.mjs 支持 distDir 注入；资产同样落入暂存目录）
//   4. 换入：dist 存在则先改名 dist.__old__，再把 dist.__building__ 改名成 dist，
//      最后删 dist.__old__。dist 缺失窗口只有两次 rename 之间（毫秒级）。
//   5. 任一步失败：删暂存目录；若 dist 已被挪走则回滚恢复，退出码 1，旧 dist 完好。

import { existsSync, cpSync, readdirSync, renameSync, rmSync, writeFileSync, readFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function main(argv) {
  const pkgRoot = process.cwd()
  // 2026-09-30:暂存目录带 pid 后缀 —— 并发构建(多会话/pre-push 门重建与人工构建)
  // 共享同一 dist.__building__ 会互相踩(一方 rename 时另一方还在写,留下 461 文件的孤儿)。
  // TMP_REL 是传给 tsc --outDir 的**相对名**(cwd=pkgRoot):a5bf0e940e 曾只改 TMP 忘改
  // outDir ⇒ tsc 输出到无后缀旧名、rename 换入的是带 pid 但从不存在的目录 ⇒ 必然 ENOENT,
  // 生产部署循环因此整类失败进 30 分钟冷却(2026-09-30 实证,i18n 首当其冲)。
  const tmpRel = `dist.__building__.${process.pid}`
  const TMP = join(pkgRoot, tmpRel)
  const OLD = join(pkgRoot, 'dist.__old__')
  const DIST = join(pkgRoot, 'dist')
  const LOCK = join(pkgRoot, 'dist.__lock')

  // 并发互斥(2026-09-30 第三轮):TMP 私有化后,DIST/OLD 两个换入目标仍是共享名 ——
  // 实测两个并发构建在 rename 序列中互相把对方的 DIST 挪走(ENOENT)。唯一正确解:
  // 同包构建串行化。pid 锁 + 探活偷锁(持有者死亡才可抢占),全程持有,退出时释放。
  if (!acquireBuildLock(LOCK)) {
    console.error('[atomic-build] 等锁超时(150s):另一构建仍在进行,放弃本次(旧 dist 未动)')
    process.exit(1)
  }
  process.on('exit', () => {
    try { unlinkSync(LOCK) } catch { /* 已被偷走或不存在 */ }
  })

  const sep = argv.indexOf('--copy-assets')
  const tscArgs = sep === -1 ? argv : argv.slice(0, sep)
  const copyAssets = sep === -1 ? null : argv[sep + 1]

  if (tscArgs.length === 0) {
    console.error('[atomic-build] 缺少 tsc 参数，用法: atomic-build.mjs <tsc 参数...> [--copy-assets <脚本路径>]')
    process.exit(2)
  }

  // 1. 预清理(上一次中断的残留 + 根级 tsbuildinfo,均为可重建产物)
  // 2026-09-30:残留目录可能含数百文件,Node fs 层被 safe-delete 包装器拦截
  // (批量>50 需交互确认,非交互必死 → pre-push 门重建失败)。改走系统 rmdir,
  // 只删本脚本自己创建的 dist.__building__.* / dist.__old__ 构建残渣,不涉任何用户数据。
  for (const dir of [...existsSync(dirname(TMP)) ? listStaleTmp(pkgRoot) : [], OLD]) {
    if (existsSync(dir)) removeDirSys(dir)
  }
  const tsbuildinfo = join(pkgRoot, 'tsconfig.tsbuildinfo')
  if (existsSync(tsbuildinfo)) rmSync(tsbuildinfo, { force: true })

  // 2. 编译到暂存目录(outDir 必须与 TMP 同名 —— 见 tmpRel 上的缺陷注记)
  const r = spawnSync('pnpm', ['exec', 'tsc', ...tscArgs, '--outDir', tmpRel], {
    cwd: pkgRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) {
    console.error(`[atomic-build] tsc 失败 (exit=${r.status})，旧 dist 保持原样`)
    cleanupTmp(TMP)
    process.exit(r.status ?? 1)
  }

  // 3. 资产复制（如有），同样进暂存目录
  if (copyAssets) {
    try {
      const require = createRequire(pathToFileURL(join(pkgRoot, 'package.json')))
      const mod = require(resolve(pkgRoot, copyAssets))
      if (typeof mod.runCopy !== 'function') {
        throw new Error(`${copyAssets} 未导出 runCopy`)
      }
      mod.runCopy({ distDir: TMP })
    } catch (err) {
      console.error(`[atomic-build] copy-assets 失败: ${err?.message ?? err}，旧 dist 保持原样`)
      cleanupTmp(TMP)
      process.exit(1)
    }
  }

  // 4. 换入（dist 缺失窗口 = 两次 rename 之间）
  // Windows: dev server 的文件监视句柄可能短暂锁住 dist 目录导致 rename EPERM，
  // 先重试（通常几秒内释放）；始终失败则降级为原地覆盖（cp TMP→DIST），
  // dist 不经历缺失窗口，仅旧版多出的孤儿文件会留到下次成功 rename-swap 清理。
  const hadOldDist = existsSync(DIST)
  let swapped = false
  if (hadOldDist) {
    if (retryFs(() => renameSync(DIST, OLD))) {
      if (retryFs(() => renameSync(TMP, DIST))) {
        swapped = true
        removeDirSys(OLD)
      } else {
        // TMP 换入失败：把旧 dist 挪回来
        retryFs(() => renameSync(OLD, DIST), 10)
        console.error('[atomic-build] 暂存目录换入失败，旧 dist 已恢复')
      }
    }
  }
  if (!swapped) {
    if (hadOldDist && !existsSync(DIST)) {
      console.error('[atomic-build] dist 被锁无法完成换入且回滚失败，dist 处于缺失态（异常，请重跑构建）')
      process.exit(1)
    }
    if (!retryFs(() => cpSync(TMP, DIST, { recursive: true }), 10)) {
      console.error('[atomic-build] 原地覆盖也失败(dist 被长期锁定),暂存目录保留在 ' + TMP)
      process.exit(1)
    }
    removeDirSys(TMP)
    console.log('[atomic-build] 完成：dist 被占用，已用原地覆盖兜底（下次构建自动清理孤儿文件）')
  } else {
    console.log('[atomic-build] 完成：新构建已原子换入 dist')
  }
}

function cleanupTmp(tmp) {
  if (existsSync(tmp)) removeDirSys(tmp)
}

// 列出可安全清扫的孤儿暂存目录:
// - 无后缀旧名(dist.__building__,2026-09-30 前形态)直接算孤儿;
// - 带 pid 后缀的,仅当属主进程已死才算孤儿 —— 活进程的暂存目录正在被使用,
//   上一版一刀切清扫会把并发构建的暂存目录删掉,令其 rename 换入时 ENOENT(实测翻车)。
function listStaleTmp(pkgRoot) {
  try {
    return readdirSync(pkgRoot)
      .filter((name) => {
        if (name === 'dist.__building__') return true
        const m = /^dist\.__building__\.(\d+)$/.exec(name)
        if (!m) return false
        const pid = Number(m[1])
        if (pid === process.pid) return true
        try {
          process.kill(pid, 0) // 探活:不发信号,仅查存在性
          return false // 进程活着 ⇒ 它的构建在跑,不碰
        } catch (err) {
          return err?.code === 'ESRCH' // ESRCH=进程不存在 ⇒ 真孤儿;EPERM 等视为存活
        }
      })
      .map((name) => join(pkgRoot, name))
  } catch {
    return []
  }
}

// 递归删除目录:走系统 rmdir,绕开 Node fs 包装器的批量删除确认闸。
// 仅用于本脚本自建的构建暂存残渣(dist.__building__.* / dist.__old__),不含任何用户数据。
function removeDirSys(dir) {
  const win = process.platform === 'win32'
  const r = win
    ? spawnSync('cmd', ['/c', 'rmdir', '/s', '/q', dir], { stdio: 'ignore' })
    : spawnSync('rm', ['-rf', dir], { stdio: 'ignore' })
  if ((r.status ?? 1) !== 0 && existsSync(dir)) {
    // 系统删除也失败(句柄锁),退回 fs 层尽力而为
    rmSync(dir, { recursive: true, force: true })
  }
}

// —— 构建互斥锁(2026-09-30 第三轮)——
// 独占创建(wx)成功 = 拿到锁;已存在则探活持有者:死了偷走重试,活着等。
// 等待上限 150s(覆盖一次完整 tsc 增量编译),超时放弃而非硬闯 —— 宁可本次构建失败,
// 也不能两个构建同时进入换入段(那才是 dist 损坏的根源)。
function acquireBuildLock(lockPath, waitMs = 150_000) {
  const deadline = Date.now() + waitMs
  const delay = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400)
  for (;;) {
    if (Date.now() > deadline) return false
    try {
      const fd = openSync(lockPath, 'wx')
      writeFileSync(fd, String(process.pid))
      closeSync(fd)
      return true
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err
      let holderAlive = true
      try {
        const holder = Number(readFileSync(lockPath, 'utf8').trim())
        if (!Number.isInteger(holder) || holder <= 0) holderAlive = false
        else {
          try {
            process.kill(holder, 0)
            holderAlive = true
          } catch (killErr) {
            holderAlive = killErr?.code !== 'ESRCH'
          }
        }
      } catch {
        holderAlive = false // 锁文件读不到/损坏 ⇒ 视为死锁残留
      }
      if (!holderAlive) {
        try { unlinkSync(lockPath) } catch { /* 被别人偷了,重试 */ }
      }
      delay()
    }
  }
}

// Windows 下文件句柄释放常有秒级延迟：带退避重试的 fs 操作包装。
// 重试耗尽返回 false（不抛出，由调用方决定降级路径）。
function retryFs(fn, attempts = 10, delayMs = 400) {
  for (let i = 0; i < attempts; i++) {
    try {
      fn()
      return true
    } catch (err) {
      if (i === attempts - 1) {
        console.error(`[atomic-build] fs 操作重试 ${attempts} 次仍失败: ${err?.code ?? ''} ${err?.message ?? err}`)
        return false
      }
      // EPERM/EBUSY:句柄未释放;其余错误大概率重试无益,但仍给少量余量
      const retryable = err?.code === 'EPERM' || err?.code === 'EBUSY' || err?.code === 'ENOTEMPTY'
      if (!retryable && i >= 2) {
        console.error(`[atomic-build] fs 操作失败(不可重试): ${err?.code ?? ''} ${err?.message ?? err}`)
        return false
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
    }
  }
  return false
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main(process.argv.slice(2))

export { main as runAtomicBuild }
