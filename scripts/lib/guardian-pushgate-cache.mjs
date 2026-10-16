// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// push-gate 结果缓存(2026-10-16 自 guardian-executor.mjs 外置,[11e] 单文件 800 行上限的余量拉开)。
//
// 执行逻辑逐字搬入,仅把闭包引用(colors/pushGate/cliArgs/failed)改成参数传递;
// 语义不变量:命中早退在本函数内 process.exit(0)(与拆分前同位)、写入段含 mkdirSync
// 与「failed === 0 才写」守卫、TTL 10 分钟、指纹 = HEAD:apps/packages 树 hash + 脏文件内容 hash。

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const PUSHGATE_CACHE_TTL_MS = 10 * 60 * 1000
const pushGateCacheFile = resolve(process.cwd(), '.workbuddy/push-gate-cache.json')

function readPushGateCache() {
  try {
    return JSON.parse(readFileSync(pushGateCacheFile, 'utf8'))
  } catch {
    return null
  }
}

/** 计算门检查输入的内容指纹:HEAD 类型相关子树 + 工作区脏状态(含脏文件内容) */
export function computeGateFingerprint() {
  try {
    const trees = execFileSync('git', ['rev-parse', 'HEAD:apps', 'HEAD:packages'], {
      encoding: 'utf8',
      windowsHide: true,
      // 只读查询,可安全封顶:同日 check-port-registry 因无 timeout 挂住 80 分钟,
      // 把整条 pre-commit 拖成"看起来像卡死"。5 分钟远高于任何正常耗时,只截病态挂起。
      timeout: 300_000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    // -z:NUL 分隔,路径无转义歧义;rename 条目 "R  new\0old\0" 需跳过 old 段
    const statusRaw = execFileSync(
      'git',
      ['status', '--porcelain', '-z', '--', 'apps', 'packages'],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300_000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const h = createHash('sha1')
    h.update(trees)
    h.update(statusRaw)
    const tokens = statusRaw.split('\0').filter(Boolean)
    for (let i = 0; i < tokens.length && i < 400; i++) {
      const tok = tokens[i]
      if (tok.length <= 3 || tok[2] !== ' ') continue
      const xy = tok.slice(0, 2)
      try {
        h.update(readFileSync(resolve(process.cwd(), tok.slice(3))))
      } catch {
        /* 删除态/瞬时不可读文件跳过,不影响指纹整体有效性 */
      }
      if (xy.includes('R') || xy.includes('C')) i++ // 跳过 rename 的 old path 段
    }
    return h.digest('hex')
  } catch {
    return null
  }
}

/**
 * push-gate 模式的缓存命中早退(--no-cache 与 HUSKY_SKIP_PUSHGATE_CACHE=1 逃生舱保留)。
 * 命中 ⇒ 本函数内 process.exit(0)(拆分前同位语义);未命中 ⇒ 返回,继续跑批。
 */
export function pushGateCacheEarlyExit({ pushGate, cliArgs, C }) {
  if (pushGate && !cliArgs.includes('--no-cache') && process.env.HUSKY_SKIP_PUSHGATE_CACHE !== '1') {
    const cache = readPushGateCache()
    const fp = computeGateFingerprint()
    if (
      cache &&
      cache.passed === true &&
      cache.fp &&
      cache.fp === fp &&
      Date.now() - cache.ts < PUSHGATE_CACHE_TTL_MS
    ) {
      const ageMin = ((Date.now() - cache.ts) / 60000).toFixed(1)
      console.info(
        `${C.green}⚡ [push-gate] 命中缓存:类型相关内容指纹 ${String(fp).slice(0, 11)} 于 ${ageMin} 分钟前已通过全量门,跳过重复 typecheck${C.reset}`,
      )
      console.info(`${C.dim}   (内容一致复用结果;强制重跑:HUSKY_SKIP_PUSHGATE_CACHE=1)${C.reset}`)
      process.exit(0)
    }
  }
}

/** push-gate 全部通过 → 写缓存(内容指纹键控,同内容短窗口内重复 push 复用)。写失败不影响放行。 */
export function writePushGateCache({ C, failed, pushGate }) {
  if (pushGate && failed === 0) {
    try {
      mkdirSync(resolve(process.cwd(), '.workbuddy'), { recursive: true })
      writeFileSync(
        pushGateCacheFile,
        JSON.stringify({ fp: computeGateFingerprint(), passed: true, ts: Date.now() }),
      )
      console.info(
        `${C.dim}⚡ [push-gate] 结果已缓存(类型相关内容一致时 10 分钟内重复推送免重跑)${C.reset}`,
      )
    } catch {
      /* 缓存写失败不影响放行 */
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
