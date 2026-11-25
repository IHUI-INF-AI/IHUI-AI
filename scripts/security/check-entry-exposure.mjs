#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 stdout 输出审计结论 */
/**
 * 入口暴露面审计(2026-11-24 立)。
 *
 * 回答一个问题:除了 8801 这一个「必须对外开放」的回源口,还有没有别的门在公网敞着?
 * 判据不是「端口在监听」—— 内网服务监听 0.0.0.0 是正常的;判据是
 * 「公网可达 ∧ 没有 block 规则压制」,两者同时成立才叫暴露。
 *
 * 用法:
 *   node scripts/security/check-entry-exposure.mjs            # 只审计
 *   node scripts/security/check-entry-exposure.mjs --ensure   # 幂等补齐缺失的放行/黑名单规则
 *   node scripts/security/check-entry-exposure.mjs --json
 * 退出码: 0 全绿 | 1 有 fail/warn | 2 未判定(取不到 netstat/防火墙/日志)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultStatePath, loadState, addBlockRule, isElevated } from './lib/blocklist.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

/** 除 8801 外任何在 WAN 监听的端口都必须被 block 规则覆盖。 */
export const WAN_FORBIDDEN_PORTS = [
  '22', '135', '137', '138', '139', '445', '3306', '3389', '5432', '5985', '5986', '6379',
  '8802', '8803', '8804', '8805', '8810', '8811', '8815', '8842', '8843', '8851', '8852',
  '9093', '9096', '9097', '9121', '9182', '9187', '9464', '12000',
]
export const REQUIRED_ALLOW = 'IHUI-ALLOW-WWW-8801'
export const WAN_DENY_RULES = ['IHUI-DENY-WAN-SERVICES', 'IHUI-DENY-WAN-WINRPC', 'IHUI-DENY-WAN-RDP', 'IHUI-DENY-WAN-SSH22']

/** 解析 netstat -ano 的 TCP 行。只认 LISTENING。 */
export function parseNetstat(text) {
  const out = []
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.trim().match(/^TCP\s+([^\s]+):(\d+)\s+[^\s]+:(\d+|\*)\s+(LISTENING)\s+(\d+)/i)
    if (!m) continue
    out.push({ host: m[1], port: m[2], pid: Number(m[5]), state: 'LISTENING' })
  }
  return out
}

export function isWanHost(host) {
  return host === '0.0.0.0' || host === '::' || host === '[::]'
}

/** 纯判定:listeners + 防火墙探针 + router 自述 + 黑名单 ⇒ findings。 */
export function auditExposure({ listeners, fw, routerStart, blocklist }) {
  const findings = []
  const push = (id, level, detail, action = '') => findings.push({ id, level, detail, action })

  const wan8801 = listeners.filter((l) => l.port === '8801' && isWanHost(l.host))
  if (wan8801.length) push('entry-8801', 'ok', `8801 在 0.0.0.0 监听(PID ${wan8801[0].pid})，EdgeOne 回源直连必需`)
  else push('entry-8801', 'fail', '8801 未在 0.0.0.0 监听,公网入口会 522', '检查 ihui-api-router / nssm 服务状态')

  const allow = fw[REQUIRED_ALLOW]
  if (!allow?.exists) push('fw-allow-8801', 'fail', `缺防火墙规则 ${REQUIRED_ALLOW}`, '--ensure 可幂等补齐')
  else if (allow.enabled === false) push('fw-allow-8801', 'fail', `${REQUIRED_ALLOW} 被禁用`, 'netsh 启用该规则')
  else if (!allow.remoteAny) push('fw-allow-8801', 'fail', `${REQUIRED_ALLOW} 来源被收窄为「${allow.remote}」，EdgeOne 回源会 522、登录页会挂`, '--ensure 改回 Any')
  else push('fw-allow-8801', 'ok', `${REQUIRED_ALLOW} 已生效（不限来源，EdgeOne 回源必需；风险由 WAF + edge guard 兜）`)

  for (const r of WAN_DENY_RULES) {
    if (!fw[r]?.exists) push(`fw-deny-${r}`, 'warn', `缺 WAN 封锁规则 ${r}`, '跑 deploy/win/ihui-firewall-hardening.ps1')
  }
  if (WAN_DENY_RULES.every((r) => fw[r]?.exists)) push('fw-deny-set', 'ok', 'WAN 封锁规则齐备')

  const exposed = listeners.filter((l) => isWanHost(l.host) && l.port !== '8801' && WAN_FORBIDDEN_PORTS.includes(l.port))
  for (const l of exposed) {
    const covered = WAN_DENY_RULES.some((r) => fw[r]?.exists)
    push(`port-${l.port}`, covered ? 'note' : 'fail', `端口 ${l.port} 监听 ${l.host}(PID ${l.pid})${covered ? ',已由 WAN block 规则压制' : ',且无 block 规则覆盖'}`, covered ? '' : '补 WAN block 规则或改绑 127.0.0.1')
  }

  if (!routerStart) push('edge-guard', 'unjudged', '路由日志取不到 router start 自述,无法判定 edge guard 档位')
  else {
    const eg = String(routerStart.edgeGuard ?? '')
    if (eg.includes('缺')) push('edge-guard', 'fail', `edge guard 形同关闭:${eg}`, '在 nssm 环境变量配 IHUI_EDGE_SECRET')
    else if (eg.startsWith('enforce')) push('edge-guard', 'ok', `edge guard = ${eg}`)
    else push('edge-guard', 'warn', `edge guard = ${eg || 'off'}`, '确认 EdgeOne 规则引擎已注入回源头后切 enforce')
    const rl = String(routerStart.rateLimit ?? 'off')
    if (rl === 'off') push('rate-limit', 'warn', '入口限流未启用', 'review IHUI_BG_RATE_LIMIT 配置')
    else push('rate-limit', 'ok', `限流 ${rl}`)
  }

  for (const e of blocklist) {
    if (!e.applied) continue
    const probe = fw[e.ruleName]
    if (!probe?.exists) push(`block-drift-${e.ip}`, 'warn', `黑名单条目 ${e.ip} 声称已封但规则缺失`, '--ensure 重建,或 --prune 清理')
  }
  return findings
}

/** 8801 必须对全网放行：源站是家宽公网 IP，回源方是腾讯 EdgeOne 边缘节点，
 *  出口 IP 不固定且无官方段可白名单。
 *  2026-11-24 实测教训：把来源收窄成回环+内网，EdgeOne 回源立即 522、登录页挂掉。
 *  所以这一条**不是漏洞,是可用性前提**;风险补偿靠 WAF(enforce) + edge guard(enforce) 两道。
 *  注意判据方向是「必须 Any」—— 收窄了要判红并改回去,反了就是第二次事故。 */
export const REQUIRED_ALLOW_MUST_BE_ANY = true

function netshShow(name) {
  try {
    const text = execFileSync('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${name}`], {
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const enabled = /Enabled:\s*(Yes|是)/i.test(text) || /已启用:\s*(是|Yes)/i.test(text)
    // netsh 在无控制台(计划任务/管道)下输出中文标签，有控制台时输出英文 —— 两套都得认,
    // 否则后台自愈读不到来源字段会误判。
    const remote = (/(?:RemoteIP|远程 ?IP)[:：]\s*(.+)/i.exec(text)?.[1] ?? '').trim()
    const remoteAny = /^(any|任何)$/i.test(remote) || remote === ''
    return { exists: true, enabled, remote, remoteAny, raw: text }
  } catch {
    return { exists: false, enabled: false, remote: '', remoteAny: false, raw: '' }
  }
}

function ensureAllow8801(exists) {
  // 已存在就**用 set 原地改回 Any**(原子替换),不 delete：删除会有窗口连回源也断。
  if (exists) {
    execFileSync('netsh', ['advfirewall', 'firewall', 'set', 'rule', `name=${REQUIRED_ALLOW}`, 'new', 'remoteip=Any'], { stdio: 'ignore', windowsHide: true })
    return
  }
  execFileSync('netsh', [
    'advfirewall', 'firewall', 'add', 'rule', `name=${REQUIRED_ALLOW}`,
    'dir=in', 'action=allow', 'protocol=TCP', 'localport=8801', 'profile=any',
  ], { stdio: 'ignore', windowsHide: true })
}

function readRouterStart(logPath) {
  if (!existsSync(logPath)) return null
  let last = null
  for (const line of readFileSync(logPath, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('{')) continue
    try {
      const o = JSON.parse(line)
      if (o.msg === 'router started' || o.msg === 'router start') last = o
    } catch {
      /* 跳过坏行 */
    }
  }
  return last
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const ensure = argv.includes('--ensure')
  const statePath = process.env.IHUI_ATTACK_STATE || defaultStatePath(ROOT)
  const logPath = process.env.IHUI_ROUTER_LOG || 'D:\\DevEnv\\logs\\svc-web-router.log'

  let netstatText
  try {
    netstatText = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 60_000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (err) {
    console.error(`未判定: netstat 取不到 ${err?.message ?? err}`)
    process.exit(2)
  }

  const listeners = parseNetstat(netstatText)
  const state = { ...loadState(statePath), path: statePath }
  const blocklist = Object.values(state.entries)
  const fwNames = [REQUIRED_ALLOW, ...WAN_DENY_RULES, ...blocklist.filter((e) => e.applied).map((e) => e.ruleName)]
  const fw = {}
  for (const name of fwNames) fw[name] = netshShow(name)
  const routerStart = readRouterStart(logPath)

  let findings = auditExposure({ listeners, fw, routerStart, blocklist })

  if (ensure) {
    if (!isElevated()) {
      console.error('未判定: --ensure 需要管理员权限')
      process.exit(2)
    }
    if (!fw[REQUIRED_ALLOW]?.exists || !fw[REQUIRED_ALLOW]?.remoteAny) {
      ensureAllow8801(Boolean(fw[REQUIRED_ALLOW]?.exists))
      console.log(`已补齐 ${REQUIRED_ALLOW}（不限来源，EdgeOne 回源必需）`)
    }
    const drifted = blocklist.filter((e) => e.applied && !fw[e.ruleName]?.exists)
    for (const e of drifted) {
      try {
        addBlockRule(e.ip)
        console.log(`已重建封禁规则 ${e.ip}`)
      } catch (err) {
        console.error(`重建失败 ${e.ip}: ${err?.message ?? err}`)
      }
    }
    const fw2 = {}
    for (const name of fwNames) fw2[name] = netshShow(name)
    findings = auditExposure({ listeners, fw: fw2, routerStart, blocklist })
  }

  const bad = findings.filter((f) => f.level === 'fail' || f.level === 'warn')
  if (json) console.log(JSON.stringify({ ok: bad.length === 0, findings }, null, 2))
  else {
    const icon = { ok: '✓', warn: '!', fail: '✗', unjudged: '?', note: '·' }
    for (const f of findings) console.log(`${icon[f.level] ?? '·'} [${f.id}] ${f.detail}${f.action ? ` → ${f.action}` : ''}`)
    console.log(`结论: ${bad.length === 0 ? '全绿' : `${bad.length} 项待处理`}`)
  }
  if (findings.some((f) => f.level === 'unjudged')) return 2
  return bad.length === 0 ? 0 : 1
}

// 只有作为入口脚本被执行时才跑 main;被 node:test import 时不得触发审计与 exit。
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (IS_MAIN) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
