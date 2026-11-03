#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Apache-2.0 须保留本声明与 NOTICE。

/**
 * 百度网盘无头同步通道(rclone + AList WebDAV)。
 *
 * 背景与边界(接「都要全自动自修复」+ P5 云同步自愈):
 *  - 原 P5 依赖 GUI 客户端 BaiduNetdisk.exe。实测守护(会话 0 服务身份)能拉起它,但无头会话
 *    立即退出,无法长期运行 ⇒ 云同步腿这一步恒不成立、反复报警。
 *  - rclone 原生**不支持**百度网盘(官方后端列表无 Baidu)。可行路径是 AList 中转:AList 把百度
 *    网盘暴露为 WebDAV,rclone 以 `type = webdav` 接入,无人值守跑 `rclone sync`。
 *  - 凭证只需在 AList 内做一次百度授权(人机一次,refresh token 由 AList 持久化);rclone 侧只配
 *    WebDAV 账号密码。其余(定时 sync、健康检测、自愈触发)全自动化。
 *  - 本模块只负责"执行一次 sync + 记录状态 + 健康判定 + 对外统一入口",**绝不自报成功**:
 *    同步是否真留得住由下一轮 syncHealth 独立判定(与 heal-baidu-sync 同一「不伪造成功」契约)。
 *
 * 健康判定真源:`.ihui-agent/state/cloud-sync-status.json` 的 lastSuccessTs;超过 intervalMs
 * 无成功 sync 即不健康。守护据此把 P5 判红/绿,自愈据此决定是否再触发一次 sync。
 */

import { execFile, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKTREE = join(__dirname, '..', '..')

export const DEFAULT_CONFIG = {
  enabled: false,
  localDirs: [],
  remote: 'baidu',
  remotePath: '/IHUI-AI-outbound',
  alistUrl: 'http://127.0.0.1:5244/dav',
  alistService: 'AList',
  rcloneBin: 'rclone',
  intervalMs: 6 * 3600 * 1000,
  healIntervalMs: 30 * 60 * 1000,
  bwlimit: '5M',
  transfers: 4,
  checkers: 8,
  stateFile: join(WORKTREE, '.ihui-agent', 'state', 'cloud-sync-status.json'),
}

export function loadConfig(env = process.env) {
  const enabled = String(env?.IHUI_CLOUD_SYNC_ENABLED ?? '').trim() === '1'
  const localDirs = String(env?.IHUI_CLOUD_SYNC_LOCAL_DIRS ?? '')
    .split(';').map((s) => s.trim()).filter(Boolean)
  return {
    ...DEFAULT_CONFIG,
    enabled,
    localDirs,
    remote: String(env?.IHUI_CLOUD_SYNC_REMOTE ?? DEFAULT_CONFIG.remote),
    remotePath: String(env?.IHUI_CLOUD_SYNC_REMOTE_PATH ?? DEFAULT_CONFIG.remotePath),
    alistUrl: String(env?.IHUI_CLOUD_SYNC_ALIST_URL ?? DEFAULT_CONFIG.alistUrl),
    alistService: String(env?.IHUI_CLOUD_SYNC_ALIST_SERVICE ?? DEFAULT_CONFIG.alistService),
    rcloneBin: String(env?.IHUI_CLOUD_SYNC_RCLONE_BIN ?? DEFAULT_CONFIG.rcloneBin),
    intervalMs: Number(env?.IHUI_CLOUD_SYNC_INTERVAL_MS ?? DEFAULT_CONFIG.intervalMs),
    healIntervalMs: Number(env?.IHUI_CLOUD_SYNC_HEAL_INTERVAL_MS ?? DEFAULT_CONFIG.healIntervalMs),
    bwlimit: String(env?.IHUI_CLOUD_SYNC_BWLIMIT ?? DEFAULT_CONFIG.bwlimit),
    transfers: Number(env?.IHUI_CLOUD_SYNC_TRANSFERS ?? DEFAULT_CONFIG.transfers),
    checkers: Number(env?.IHUI_CLOUD_SYNC_CHECKERS ?? DEFAULT_CONFIG.checkers),
    stateFile: String(env?.IHUI_CLOUD_SYNC_STATE_FILE ?? DEFAULT_CONFIG.stateFile),
  }
}

export function checkRcloneAvailable(bin = DEFAULT_CONFIG.rcloneBin) {
  try {
    execFileSync(bin, ['--version'], { windowsHide: true, timeout: 10000, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export async function checkAlistReachable(url = DEFAULT_CONFIG.alistUrl) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal })
    clearTimeout(timer)
    return res.status < 500
  } catch {
    return false
  }
}

export function readSyncStatus(stateFile = DEFAULT_CONFIG.stateFile) {
  try {
    return JSON.parse(String(readFileSync(stateFile, 'utf8') || '{}'))
  } catch {
    return {}
  }
}

function writeSyncStatus(stateFile, data) {
  try {
    mkdirSync(dirname(stateFile), { recursive: true })
    writeFileSync(stateFile, JSON.stringify(data, null, 2), 'utf8')
  } catch {
    /* 状态件写不掉不致命 */
  }
}

function runRclone(bin, args, timeout = 1800000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { windowsHide: true, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      (err) => (err ? reject(err) : resolve()))
  })
}

/**
 * 执行一次同步。返回 {ok, exitCode, synced, results, lastSuccessTs, why}。
 * 不会抛:任何失败都落到 ok:false + why。dryRun 时只校验链路不真传。
 * 可用 opts.runner 注入(测试 mock);opts.checkRcloneAvailable / checkAlistReachable 同理。
 */
export async function runSync(opts = {}) {
  const cfg = opts.config || loadConfig(opts.env)
  const logger = opts.logger || (() => {})
  const rclone = opts.rcloneBin || cfg.rcloneBin
  const now = Date.now()
  if (!cfg.enabled) return { ok: false, skipped: true, why: '无头通道未启用' }
  if (!cfg.localDirs.length) return { ok: false, why: '未配置本地源目录(IHUI_CLOUD_SYNC_LOCAL_DIRS)' }

  const rcloneOk = opts.checkRcloneAvailable
    ? opts.checkRcloneAvailable(rclone)
    : checkRcloneAvailable(rclone)
  if (!rcloneOk) {
    writeSyncStatus(cfg.stateFile, { ...readSyncStatus(cfg.stateFile), rcloneAvailable: false, lastAttemptTs: now })
    return { ok: false, why: 'rclone 不可用(未安装/不在 PATH)', rcloneAvailable: false }
  }
  const alistOk = opts.checkAlistReachable
    ? await opts.checkAlistReachable(cfg.alistUrl)
    : await checkAlistReachable(cfg.alistUrl)
  if (!alistOk) {
    writeSyncStatus(cfg.stateFile, { ...readSyncStatus(cfg.stateFile), alistReachable: false, lastAttemptTs: now })
    return { ok: false, why: `AList WebDAV 不可达(${cfg.alistUrl})`, alistReachable: false }
  }

  const remoteTarget = `${cfg.remote}:${cfg.remotePath}`
  const logFile = join(dirname(cfg.stateFile), 'rclone-sync.log')
  const results = []
  let anyFail = false
  for (const local of cfg.localDirs) {
    if (!existsSync(local)) {
      results.push({ local, skipped: true, why: '本地目录不存在' })
      continue
    }
    const args = [
      'sync', local, remoteTarget,
      '--log-file', logFile,
      '--bwlimit', cfg.bwlimit,
      '--transfers', String(cfg.transfers),
      '--checkers', String(cfg.checkers),
      '--stats', '30s',
    ]
    if (opts.dryRun) args.push('--dry-run')
    const runner = opts.runner || ((a) => runRclone(rclone, a, opts.timeout || 1800000))
    try {
      await runner(args)
      results.push({ local, ok: true })
    } catch (e) {
      anyFail = true
      results.push({ local, ok: false, why: e?.message || String(e) })
    }
  }
  const success = !anyFail && results.length > 0 && results.every((r) => r.ok)
  const prev = readSyncStatus(cfg.stateFile)
  const status = {
    ...prev,
    rcloneAvailable: true,
    alistReachable: true,
    lastAttemptTs: now,
    lastSuccessTs: success ? now : prev.lastSuccessTs || null,
    lastExit: success ? 0 : 1,
    lastError: success ? null : (results.find((r) => !r.ok)?.why || '部分目录同步失败'),
  }
  writeSyncStatus(cfg.stateFile, status)
  logger(`☁️ 无头同步:${success ? '成功' : '失败(' + status.lastError + ')'}`)
  return { ok: success, exitCode: success ? 0 : 1, synced: success, results, lastSuccessTs: status.lastSuccessTs }
}

export async function syncHealth(opts = {}) {
  const cfg = opts.config || loadConfig(opts.env)
  const st = readSyncStatus(cfg.stateFile)
  const now = Date.now()
  const last = st.lastSuccessTs || 0
  const staleMs = last ? now - last : Infinity
  const healthy = !!last && staleMs <= cfg.intervalMs
  return {
    healthy,
    lastSuccessTs: last || null,
    staleMs,
    staleHours: last ? Math.round((staleMs / 3600000) * 10) / 10 : null,
    reason: healthy
      ? null
      : (!last ? '从未成功 sync' : `最近成功 sync 已 ${Math.round(staleMs / 3600000)}h 前,超阈值 ${Math.round(cfg.intervalMs / 3600000)}h`),
    rcloneAvailable: st.rcloneAvailable ?? null,
    alistReachable: st.alistReachable ?? null,
  }
}

/**
 * 对外统一入口。返回与 baiduSyncRunning 同构的 {running, why, via, mode}:
 *  - 未启用无头通道 ⇒ {running:null, mode:'gui'},交由 P5 dispatch 回退 baiduSyncRunning()。
 *  - 已启用 ⇒ running = 最近一次 sync 是否健康(无头通道视角),mode='headless'。
 */
export async function cloudSyncHealthy(opts = {}) {
  const cfg = opts.config || loadConfig(opts.env)
  if (!cfg.enabled) {
    return { running: null, mode: 'gui', why: '无头通道未启用(IHUI_CLOUD_SYNC_ENABLED≠1),回退 GUI 判据', via: 'cloud-sync-disabled' }
  }
  const h = await syncHealth({ config: cfg })
  return {
    running: h.healthy,
    mode: 'headless',
    lastSuccessTs: h.lastSuccessTs,
    staleHours: h.staleHours,
    why: h.healthy ? null : h.reason,
    via: 'headless-rclone',
    rcloneAvailable: h.rcloneAvailable,
    alistReachable: h.alistReachable,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
