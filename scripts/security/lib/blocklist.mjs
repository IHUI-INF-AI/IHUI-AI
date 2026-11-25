// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 黑名单持久化与 Windows 防火墙执行层(2026-11-24 立)。
 *
 * 为什么规则按「每 IP 一条」而不是一条规则塞逗号列表:
 *   · netsh 单条规则 remoteip 有长度上限,塞多了会静默截断;
 *   · 解封/续期要按 IP 精确操作,列表形态只能整条重建 —— 重建窗口内所有封禁同时失效;
 *   · 规则名带 IP 可让人在 wf.msc 里一眼看出封了谁。
 * Windows 防火墙语义:block 规则优先于 allow 规则(同一流量),所以不必删掉
 * IHUI-ALLOW-WWW-8801 —— 对 8801 的放行保留,攻击 IP 由 deny 规则压制。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { networkInterfaces } from 'node:os'
import { expiredEntries } from './threat-policy.mjs'

export const RULE_PREFIX = 'IHUI-DENY-ATK-'

/** 规则名:只保留数字/字母,便于 netsh 与中文宿主共存(规则名不含中文)。 */
export function ruleNameFor(ip) {
  return RULE_PREFIX + String(ip ?? '').replace(/[^0-9a-zA-Z]/g, '-')
}

/** 默认状态文件放在项目 .ihui-agent/state 下(与其它运维留痕同面)。 */
export function defaultStatePath(root) {
  return join(root, '.ihui-agent', 'state', 'attack-blocklist.json')
}

export function loadState(statePath) {
  if (!existsSync(statePath)) {
    return { version: 1, updatedAt: null, allowlist: [], entries: {} }
  }
  const raw = JSON.parse(readFileSync(statePath, 'utf8'))
  return {
    version: raw.version ?? 1,
    updatedAt: raw.updatedAt ?? null,
    allowlist: Array.isArray(raw.allowlist) ? raw.allowlist : [],
    entries: raw.entries && typeof raw.entries === 'object' ? raw.entries : {},
  }
}

/** 原子写:先写同目录 tmp 再 rename,避免守护进程读到半截 JSON。 */
export function saveState(statePath, state) {
  mkdirSync(dirname(statePath), { recursive: true })
  const tmp = `${statePath}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  renameSync(tmp, statePath)
}

function runNetsh(args) {
  return execFileSync('netsh', ['advfirewall', 'firewall', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    windowsHide: true,
  })
}

/** 当前进程是否具备改防火墙的权限。取不到即 false,由调用方落「未判定」。 */
export function isElevated() {
  try {
    execFileSync('net', ['session'], { stdio: 'ignore', timeout: 10_000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

export function ruleExists(ip) {
  try {
    runNetsh(['show', 'rule', `name=${ruleNameFor(ip)}`])
    return true
  } catch {
    return false
  }
}

/** 幂等建规则:先删同名再建,保证 IP/动作与状态一致。 */
export function addBlockRule(ip) {
  try {
    runNetsh(['delete', 'rule', `name=${ruleNameFor(ip)}`])
  } catch {
    /* 不存在属正常 */
  }
  runNetsh([
    'add',
    'rule',
    `name=${ruleNameFor(ip)}`,
    'dir=in',
    'action=block',
    `remoteip=${ip}`,
    'profile=any',
    'enable=yes',
  ])
}

export function removeBlockRule(ip) {
  try {
    runNetsh(['delete', 'rule', `name=${ruleNameFor(ip)}`])
    return true
  } catch {
    return false
  }
}

/**
 * 本机基础设施地址:网卡上的每一个地址 + `IHUI_INFRA_IPS` 追加项。
 * 为什么要这一道:生产 8801 是**直连公网**的,若哪天前面套了 CDN/反代,
 * `remoteAddress` 就会变成入口 IP —— 把入口 IP 封掉等于全站下线。
 * 白名单 CIDR 只盖住回环与内网,盖不住"本机自己就是出口"这一种。
 */
export function infraIps(env = process.env) {
  const out = new Set()
  try {
    const ifaces = networkInterfaces()
    for (const list of Object.values(ifaces ?? {})) {
      for (const i of list ?? []) {
        if (i?.address) out.add(String(i.address).replace(/^::ffff:/, ''))
      }
    }
  } catch {
    /* 取不到网卡时退化为只认 env(不误封,宁少封) */
  }
  for (const ip of String(env.IHUI_INFRA_IPS ?? '').split(/[,\s]+/)) {
    if (ip) out.add(ip)
  }
  return out
}

/**
 * 执行封禁决策并回写状态。
 * dryRun=true 时只更新决策输出,不碰防火墙、不写 state(默认口径)。
 */
export function applyDecisions(decisions, state, { dryRun = true, now = Date.now(), protect } = {}) {
  const applied = []
  const failed = []
  const held = []
  const guard = protect ?? infraIps()
  const next = {
    ...state,
    version: state.version ?? 1,
    updatedAt: new Date(now).toISOString(),
    entries: { ...state.entries },
  }

  for (const d of decisions) {
    if (d.action !== 'ban' && d.action !== 'refresh') continue
    if (d.action === 'ban' && guard.has(String(d.ip ?? '').trim())) {
      held.push({ ip: d.ip, reason: 'infra-ip' })
      continue
    }
    const prev = next.entries[d.ip] ?? {}
    const entry = {
      ip: d.ip,
      firstSeen: prev.firstSeen ?? new Date(now).toISOString(),
      lastSeen: new Date(now).toISOString(),
      hits: d.hits,
      score: d.score,
      detections: d.detections ?? prev.detections ?? [],
      kinds: d.kinds ?? prev.kinds ?? {},
      bannedAt: d.action === 'ban' ? new Date(now).toISOString() : (prev.bannedAt ?? null),
      expiresAt: d.action === 'ban' ? d.expiresAt : (prev.expiresAt ?? null),
      rebanCount: d.action === 'ban' ? d.rebanCount : (prev.rebanCount ?? 0),
      ruleName: ruleNameFor(d.ip),
      applied: prev.applied ?? false,
    }
    if (d.action === 'ban' && !dryRun) {
      try {
        addBlockRule(d.ip)
        entry.applied = true
      } catch (err) {
        entry.applied = false
        failed.push({ ip: d.ip, error: String(err?.message ?? err) })
      }
    }
    next.entries[d.ip] = entry
    applied.push({ ip: d.ip, action: d.action, applied: entry.applied, expiresAt: entry.expiresAt })
  }

  if (!dryRun) {
    const persisted = { ...next }
    delete persisted.path
    saveState(state.path, persisted)
  }
  return { state: next, applied, failed, held }
}

/** 解封所有到期条目,返回被解封 IP 列表。 */
export function pruneExpired(state, { dryRun = true, now = Date.now() } = {}) {
  const expired = expiredEntries(state.entries, now)
  const removed = []
  for (const e of expired) {
    if (!dryRun) removeBlockRule(e.ip)
    removed.push(e.ip)
  }
  if (!dryRun && removed.length) {
    const entries = { ...state.entries }
    for (const ip of removed) delete entries[ip]
    const persisted = { ...state, entries, updatedAt: new Date(now).toISOString() }
    delete persisted.path
    saveState(state.path, persisted)
  }
  return { removed, entries: state.entries }
}

/** 人工解封单个 IP。 */
export function unban(state, ip, { dryRun = true, now = Date.now() } = {}) {
  const entries = { ...state.entries }
  const existed = Boolean(entries[ip])
  if (!dryRun) removeBlockRule(ip)
  delete entries[ip]
  if (!dryRun) {
    const persisted = { ...state, entries, updatedAt: new Date(now).toISOString() }
    delete persisted.path
    saveState(state.path, persisted)
  }
  return { existed, entries }
}

export const __test__ = { ruleNameFor, defaultStatePath, loadState, saveState, applyDecisions, pruneExpired, unban }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
