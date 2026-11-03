// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// push-gate 结果缓存(2026-10-16 自 guardian-executor.mjs 外置,[11e] 单文件 800 行上限的余量拉开)。
//
// 执行逻辑逐字搬入,仅把闭包引用(colors/pushGate/cliArgs/failed)改成参数传递;
// 语义不变量:命中早退在本函数内 process.exit(0)(与拆分前同位)、写入段含 mkdirSync
// 与「failed === 0 才写」守卫、TTL 10 分钟、指纹 = HEAD:apps/packages 树 hash + 脏文件内容 hash。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

import { gitRaw } from './face-reader.mjs'

const PUSHGATE_CACHE_TTL_MS = 60 * 60 * 1000 // 2026-10-22 提速:指纹未变即复用,10→60 分钟(改代码才会变指纹)
const pushGateCacheFile = resolve(process.cwd(), '.ihui-agent/state/push-gate-cache.json')

function readPushGateCache() {
  try {
    return JSON.parse(readFileSync(pushGateCacheFile, 'utf8'))
  } catch {
    return null
  }
}

/** 门注册表规格串:门 id/脚本/参数任一变化 ⇒ 指纹变 ⇒ 旧缓存失效(新挂门的必经保护)。 */
function gateSpecsOf(checks) {
  return (checks ?? [])
    .map((c) => `${c.id}\u0000${c.script}\u0000${JSON.stringify(c.args ?? [])}`)
    .join('\n')
}

/**
 * 计算门检查输入的内容指纹:HEAD 类型相关子树 + 工作区脏状态(含脏文件内容)
 * + **HEAD 全树**(2026-11-03 补:门 47 push 档判的是 push scope ∩ HEAD 全树,
 *   `HEAD:apps/packages` 两棵子树覆盖不到 scripts/ 等路径;不并入全树会让"只改 scripts/ 的提交"
 *   复用到旧指纹而跳过水印门 —— 结构上等于没挂门)
 * + **push 门注册表规格**(门集合/参数变化必须使旧缓存失效;否则新挂的门会被老缓存放过去)。
 */
export function computeGateFingerprint({ gateSpecs } = {}) {
  try {
    // 派生统一走层(scripts/lib/face-reader.mjs):绝对 git + 显式 stdio/windowsHide + timeout。
    const trees = gitRaw(['rev-parse', 'HEAD:apps', 'HEAD:packages', 'HEAD^{tree}'], process.cwd(), {
      timeout: 300_000,
    }).trim()
    // -z:NUL 分隔,路径无转义歧义;rename 条目 "R  new\0old\0" 需跳过 old 段
    const statusRaw = gitRaw(['status', '--porcelain', '-z', '--', 'apps', 'packages'], process.cwd(), {
      timeout: 300_000,
    })
    const h = createHash('sha1')
    h.update(trees)
    h.update(statusRaw)
    h.update('\0push-gate-specs\0')
    h.update(gateSpecs ?? '')
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
export function pushGateCacheEarlyExit({ pushGate, cliArgs, C, checks }) {
  if (pushGate && !cliArgs.includes('--no-cache') && process.env.HUSKY_SKIP_PUSHGATE_CACHE !== '1') {
    const cache = readPushGateCache()
    const fp = computeGateFingerprint({ gateSpecs: gateSpecsOf(checks) })
    if (
      cache &&
      cache.passed === true &&
      cache.fp &&
      cache.fp === fp &&
      Date.now() - cache.ts < PUSHGATE_CACHE_TTL_MS
    ) {
      const ageMin = ((Date.now() - cache.ts) / 60000).toFixed(1)
      console.info(
        `${C.green}⚡ [push-gate] 命中缓存:内容+门集指纹 ${String(fp).slice(0, 11)} 于 ${ageMin} 分钟前已通过 push 门,跳过重复检查${C.reset}`,
      )
      console.info(`${C.dim}   (内容一致复用结果;强制重跑:HUSKY_SKIP_PUSHGATE_CACHE=1)${C.reset}`)
      process.exit(0)
    }
  }
}

/** push-gate 全部通过 → 写缓存(内容指纹键控,同内容短窗口内重复 push 复用)。写失败不影响放行。 */
export function writePushGateCache({ C, failed, pushGate, checks }) {
  if (pushGate && failed === 0) {
    try {
      mkdirSync(resolve(process.cwd(), '.ihui-agent', 'state'), { recursive: true })
      writeFileSync(
        pushGateCacheFile,
        JSON.stringify({
          fp: computeGateFingerprint({ gateSpecs: gateSpecsOf(checks) }),
          passed: true,
          ts: Date.now(),
        }),
      )
      console.info(
        `${C.dim}⚡ [push-gate] 结果已缓存(内容与门集一致时重复推送免重跑)${C.reset}`,
      )
    } catch {
      /* 缓存写失败不影响放行 */
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
