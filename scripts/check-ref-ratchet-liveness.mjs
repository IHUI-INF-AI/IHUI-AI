#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「棘轮装死」独立检查 —— 挂 `.husky/pre-push`（理由见 pre-push 里的注释）。
 *
 * 为什么是这里：钩子自身异常的策略是 **放行**（main 是唯一集成总线，不能因钩子坏掉锁死），
 * 但"放行可以，装死不行"。判据必须放在**钩子之外** —— 钩子自述"我健康"不算证据。
 * pre-push 是 main 出本机的必经卡口，又不新增常驻进程/计划任务，因此是最直接的落点。
 *
 * 判据（不改钩子的放行逻辑，只在这里报红）：
 *  1. 有 seed 锚点、却没有心跳  ⇒ 红（棘轮从没真跑过，或状态被清掉了）。
 *  2. 心跳超过 STALE_MS，且 main / origin-main 的 tip 已经不是心跳里记的 new  ⇒ 红
 *     （引用在推进，钩子却没跑 = 装死）。
 *  3. 最近 STALE_MS 内的 hook-error 条目数 > 0 ⇒ 红（钩子报过异常，必须有人看）。
 *  4. 没有锚点 ⇒ 不红（棘轮尚未启用/尚未 seed，不是故障）。
 *
 * 输出直接给"哪条判据、看到了什么"，不做汇总美化 —— 报红时要一眼能定位。
 * 退出码：0 健康；1 报红；2 无法判定（读不到状态目录）。无法判定同样阻断 push，
 * 因为"检查自己坏了"与"棘轮坏了"在运维上必须一样显眼。
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  anchorPath,
  git,
  heartbeatPath,
  hookErrorPath,
  safeJson,
  stateDir,
} from './lib/ref-ratchet-state.mjs'

const STALE_MS = Number(process.env.IHUI_REF_RATCHET_STALE_MS ?? 24 * 3600_000)
const MAIN_REFS = ['refs/heads/main', process.env.IHUI_REF_RATCHET_ORIGIN_REF ?? 'refs/remotes/origin/main']

function root() {
  const i = process.argv.indexOf('--root')
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]
  return String(git(process.cwd(), ['rev-parse', '--show-toplevel'], { allowFail: true }) ?? process.cwd()).trim()
}

function tipOf(repo, ref) {
  const out = git(repo, ['rev-parse', '--verify', '--quiet', ref], { allowFail: true })
  const sha = String(out ?? '').trim()
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null
}

function main() {
  const repo = root()
  let dir
  try {
    dir = stateDir(repo)
  } catch (e) {
    console.error(`[ref-ratchet-liveness] 无法定位状态目录：${String(e?.message ?? e).split('\n')[0]}`)
    return 2
  }
  const anchor = existsSync(anchorPath(dir)) ? safeJson(anchorPath(dir)) : null
  if (!anchor) {
    console.log('[ref-ratchet-liveness] 未启用（无 seed 锚点）⇒ 不判红')
    return 0
  }

  const violations = []

  const hb = existsSync(heartbeatPath(dir)) ? safeJson(heartbeatPath(dir)) : null
  if (!hb) {
    violations.push('有 seed 锚点但没有心跳 ⇒ 棘轮从未真正执行过')
  } else {
    const ts = Date.parse(hb.ts ?? '')
    const age = Number.isFinite(ts) ? Date.now() - ts : Infinity
    if (age > STALE_MS) {
      const tips = MAIN_REFS.map((ref) => ({ ref, sha: tipOf(repo, ref) })).filter((x) => x.sha)
      const moved = tips.filter((t) => t.sha !== hb.new)
      if (moved.length) {
        const detail = moved.map((t) => `${t.ref}=${t.sha.slice(0, 12)}`).join(', ')
        violations.push(
          `心跳过期 ${Math.round(age / 3600_000)}h（阈值 ${Math.round(STALE_MS / 3600_000)}h），` +
            `且引用已推进（心跳 new=${String(hb.new ?? '?').slice(0, 12)}，${detail}）⇒ 钩子装死`,
        )
      }
    }
  }

  const errFile = hookErrorPath(dir)
  if (existsSync(errFile)) {
    const recent = readFileSync(errFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter((row) => {
        if (!row) return true // 坏行也说明有人在写这个文件，算"需要人看"
        const ts = Date.parse(row.ts ?? '')
        return !Number.isFinite(ts) || Date.now() - ts <= STALE_MS
      })
    if (recent.length) {
      const first = recent[0]
      violations.push(
        `最近 ${Math.round(STALE_MS / 3600_000)}h 内有 ${recent.length} 条 hook-error` +
          (first ? `（kind=${first.kind}：${String(first.message ?? '').slice(0, 120)}）` : ''),
      )
    }
  }

  if (!violations.length) {
    console.log(`[ref-ratchet-liveness] OK heartbeat=${hb?.ts ?? '-'} new=${String(hb?.new ?? '-').slice(0, 12)}`)
    return 0
  }
  console.error('[ref-ratchet-liveness] 棘轮装死检查报红：')
  for (const v of violations) console.error(`  · ${v}`)
  console.error(`  状态目录：${join(dir)}（--verify / --status 可点名人看的入口）`)
  return 1
}

process.exitCode = main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
