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

import { existsSync, cpSync, renameSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function main(argv) {
  const pkgRoot = process.cwd()
  const TMP = join(pkgRoot, 'dist.__building__')
  const OLD = join(pkgRoot, 'dist.__old__')
  const DIST = join(pkgRoot, 'dist')

  const sep = argv.indexOf('--copy-assets')
  const tscArgs = sep === -1 ? argv : argv.slice(0, sep)
  const copyAssets = sep === -1 ? null : argv[sep + 1]

  if (tscArgs.length === 0) {
    console.error('[atomic-build] 缺少 tsc 参数，用法: atomic-build.mjs <tsc 参数...> [--copy-assets <脚本路径>]')
    process.exit(2)
  }

  // 1. 预清理（上一次中断的残留 + 根级 tsbuildinfo，均为可重建产物）
  for (const dir of [TMP, OLD]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
  const tsbuildinfo = join(pkgRoot, 'tsconfig.tsbuildinfo')
  if (existsSync(tsbuildinfo)) rmSync(tsbuildinfo, { force: true })

  // 2. 编译到暂存目录
  const r = spawnSync('pnpm', ['exec', 'tsc', ...tscArgs, '--outDir', 'dist.__building__'], {
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
        retryFs(() => rmSync(OLD, { recursive: true, force: true }), 3)
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
      console.error('[atomic-build] 原地覆盖也失败（dist 被长期锁定），暂存目录保留在 dist.__building__')
      process.exit(1)
    }
    retryFs(() => rmSync(TMP, { recursive: true, force: true }), 3)
    console.log('[atomic-build] 完成：dist 被占用，已用原地覆盖兜底（下次构建自动清理孤儿文件）')
  } else {
    console.log('[atomic-build] 完成：新构建已原子换入 dist')
  }
}

function cleanupTmp(tmp) {
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })
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
