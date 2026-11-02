#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Apache-2.0 须保留本声明与 NOTICE。

/**
 * P5 云同步自愈器(无头通道版)。
 *
 * 契约(同 heal-baidu-sync 的「尽力 + 不伪造成功」):
 *  - 未启用无头通道 ⇒ {skipped:true},由调用方回退到 GUI 拉起(healBaiduSync)。
 *  - 已启用 ⇒ 若 syncHealth 健康则 alreadyHealthy;否则节流后触发一次 runSync,**立即返回
 *    attempted,绝不自报 verified**(sync 是否真留得住由下一轮 syncHealth 独立判定)。
 *  - AList 不可达时先尝试 net start AList(服务态拉起),再触发 sync。
 *  - 30 分钟节流防拉起风暴(同 heal-baidu-sync)。
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadConfig, syncHealth, runSync, checkAlistReachable } from './rclone-baidu-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKTREE = join(__dirname, '..', '..')

function safeNetStart(svc) {
  try {
    execFileSync('net.exe', ['start', svc], { windowsHide: true, timeout: 20000, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * 自愈主入口(异步,守护 main 里 await 调用)。
 * @returns {{ok:boolean, skipped?:boolean, alreadyHealthy?:boolean, attempted?:boolean, verified?:null, ran:boolean, throttled?:boolean, why?:string}}
 */
export async function healCloudSync(opts = {}) {
  const cfg = opts.config || loadConfig(opts.env)
  const logger = opts.logger || (() => {})
  const now = opts.now ?? Date.now()

  if (!cfg.enabled) {
    return { ok: false, skipped: true, why: '无头通道未启用,回退 GUI 自愈' }
  }

  const h = await syncHealth({ config: cfg })
  if (h.healthy) {
    return { ok: true, alreadyHealthy: true, ran: true }
  }

  // 节流:未到窗口不重试
  const tickFile = opts.tickFile || join(WORKTREE, '.ihui-agent', 'state', 'cloud-sync-heal-tick.json')
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(lastTick) && now - lastTick < cfg.healIntervalMs) {
    return { ok: false, ran: false, throttled: true, why: '未到节流窗口' }
  }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
  } catch {
    /* 刻度写不掉不影响动作 */
  }

  // AList 不可达 ⇒ 先尝试拉起 AList 服务(更干净的服务态拉起)
  const alistOk = opts.checkAlistReachable
    ? await opts.checkAlistReachable(cfg.alistUrl)
    : await checkAlistReachable(cfg.alistUrl)
  if (!alistOk) {
    const up = opts.execNet
      ? opts.execNet('net.exe', ['start', cfg.alistService])
      : safeNetStart(cfg.alistService)
    logger(`☁️ 无头同步自愈:尝试启动 AList 服务(${cfg.alistService})=${up}`)
  }

  const r = await runSync({
    config: cfg,
    logger,
    dryRun: opts.dryRun,
    runner: opts.runner,
    checkRcloneAvailable: opts.checkRcloneAvailable,
    checkAlistReachable: opts.checkAlistReachable,
    timeout: opts.timeout,
  })
  // 绝不自报 verified:sync 是否真留得住,由下一轮 syncHealth 独立判定
  return { ok: r.ok, attempted: true, verified: null, ran: true, why: r.ok ? null : r.why }
}

// CLI 自测入口:`node scripts/cloud-sync/heal-cloud-sync.mjs [--json]`
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const json = process.argv.includes('--json')
  healCloudSync({ logger: json ? () => {} : console.error }).then((r) => {
    if (json) console.log(JSON.stringify(r, null, 1))
    else console.log(r.ok ? `✅ ${r.alreadyHealthy ? '已健康' : '已尝试同步'}` : `⚠️ 未修好:${r.why}`)
    process.exit(r.ok || r.skipped ? 0 : 1)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
