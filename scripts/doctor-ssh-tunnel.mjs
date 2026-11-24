#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSH 隧道体检仪(静态检查默认只读;`--fix` 才写盘)。
 *
 * 存在的理由:2026-10-27 一次真实事故 —— `~/.ssh/config` 在 01:40 被手工改写,
 * `ProxyCommand` 里的 Windows 路径写成**未加引号的单反斜杠**:
 *
 *     ProxyCommand C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -File D:\DevEnv\secrets\cf-ssh-proxy.ps1 %h
 *
 * OpenSSH 的 `ProxyCommand` 取值要过一遍 shell 式 argv 拆词,反斜杠是转义符 ⇒ 路径被吃成
 * `C:WindowsSystem32WindowsPowerShellv1.0powershell.exe`。ssh 只报 `exec: ... not found`,
 * 看上去像"生产机连不上",实际是**本机配置被吃掉反斜杠**。整整一轮会话被误判成"网络不通/没连过"。
 *
 * 三种写法实测(2026-10-27 本机 OpenSSH for Windows,正反例都跑过真命令):
 *   ① `C:\Windows\System32\cmd.exe`        未引号 单反斜杠 ⇒ 坏(反斜杠全丢)
 *   ② `C:/Windows/System32/cmd.exe`        正斜杠          ⇒ 好
 *   ③ `"C:\Windows\System32\cmd.exe"`      双引号包裹      ⇒ 好(引号内反斜杠不被吃掉)
 *   ④ `C:\\Windows\\System32\\cmd.exe`     双反斜杠        ⇒ 好
 *
 * 所以判据 = **「值里出现盘符路径 ⇒ 拆词后它必须还是盘符路径」**,不靠字符串长相猜。
 *
 * 为什么**不在提交链上**:它判的是这台机 `~/.ssh/config` 的运行时状态,提交者结构上满足不了;
 * 挂进 pre-commit 就是一台与任何提交都无关的恒红门,唯一结局是各会话被逼 `--no-verify`、
 * 连带链上全部检查对该提交作废(AGENTS §12e/§12f、§0.2)。它没有"紧急跳过"环境变量。
 * 它的不变量由自己那把尺子钉:`--self-test` 的四形态正反例 + `scripts/tests/doctor-ssh-tunnel.test.mjs`。
 *
 * 用法:
 *   node scripts/doctor-ssh-tunnel.mjs                  # 人读报告(只读)
 *   node scripts/doctor-ssh-tunnel.mjs --json           # 机读(stdout 只有一个可 JSON.parse 的对象)
 *   node scripts/doctor-ssh-tunnel.mjs --verify         # 额外真连一次,按 Host 判定
 *   node scripts/doctor-ssh-tunnel.mjs --fix            # 只把"被吃反斜杠"的行规范成正斜杠,先备份
 *   node scripts/doctor-ssh-tunnel.mjs --self-test      # 判据自身的成对正反例,零副作用
 *   node scripts/doctor-ssh-tunnel.mjs --config=<path>  # 换配置文件(测试用)
 *
 * 退出码:0 = 无红项;1 = 至少一条红项(逐条给动作);2 = 未判定(配置读不到,或 --verify 连 ssh 都起不来)。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const RED = 'red'
const YELLOW = 'yellow'

/** 把 `~` 展开成家目录,并把正反斜杠统一成正斜杠(仅判据内部用)。 */
function expandPath(p) {
  let s = String(p == null ? '' : p).trim()
  if (!s) return ''
  if (s === '~') return os.homedir()
  if (s.startsWith('~/') || s.startsWith('~\\')) s = path.join(os.homedir(), s.slice(2))
  return s.replace(/\\/g, '/')
}

/**
 * 模拟 OpenSSH 对 ProxyCommand 取值的拆词。
 *
 * 规则按 2026-10-27 实测反推(不是照 man 页猜):
 *   - 引号外:空白分 token;`\` 吃掉自身、保留下一个字符为字面量(**任意字符**)。
 *   - 双/单引号内:反斜杠按字面保留,只有同类引号收尾。
 * 返回 { argv, escapes } —— escapes 记录"哪个字符前面有反斜杠",供判据区分"有意的转义空格"
 * 和"被吃掉的路径分隔符"。
 */
export function splitProxyCommand(raw) {
  const argv = []
  const escapes = []
  let cur = ''
  let inQuote = ''
  let i = 0
  const s = String(raw == null ? '' : raw)
  while (i < s.length) {
    const ch = s[i]
    if (inQuote) {
      if (ch === inQuote) { inQuote = ''; i += 1; continue }
      cur += ch
      i += 1
      continue
    }
    if (ch === '"' || ch === "'") { inQuote = ch; i += 1; continue }
    if (ch === ' ' || ch === '\t') {
      if (cur) { argv.push(cur); cur = '' }
      i += 1
      continue
    }
    if (ch === '\\') {
      const next = s[i + 1]
      if (next == null) { cur += ch; i += 1; continue }
      escapes.push(next)
      cur += next
      i += 2
      continue
    }
    cur += ch
    i += 1
  }
  if (cur) argv.push(cur)
  return { argv, escapes }
}

const DRIVE_PATH = /^[A-Za-z]:[\\/]/

/**
 * 审计一条 ProxyCommand 取值。
 * 返回 { safe, reason, code, fixed } —— fixed 是建议的规范形态(仅在 unsafe 时给)。
 */
export function auditProxyCommand(raw) {
  const value = String(raw == null ? '' : raw)
  const { argv } = splitProxyCommand(value)

  // 值里(引号内外都算)是否声称自己带盘符路径
  const claimed = /(^|[\s"'])[A-Za-z]:[\\/]/.test(value)
  if (!claimed) {
    // 没有盘符路径就没有"被吃反斜杠"这一类风险;剩下的是通用可执行名,交给运行时判定
    return { safe: true, code: 'no-drive-path', reason: '无盘符路径，不属转义风险类' }
  }
  const survived = argv.some((t) => DRIVE_PATH.test(t))
  if (survived) {
    return { safe: true, code: 'ok', reason: '盘符路径拆词后仍完整' }
  }
  // 未加引号的单反斜杠:拆词把分隔符吃没了
  const fixed = normalizeToForwardSlashes(value)
  return {
    safe: false,
    code: 'escape-eaten',
    reason: '盘符路径的反斜杠被 OpenSSH 转义吃掉（未加引号的单反斜杠）',
    fixed,
  }
}

/**
 * 把引号外的单反斜杠换成正斜杠。
 * 引号内的段原样保留(引号内反斜杠本来就安全,改成斜杠反而多一次无谓改动)。
 * 已被 `\\` 双写的路径也统一落成正斜杠 —— 全仓只留一种规范形态,少一种写法就少一条腐烂路径。
 */
export function normalizeToForwardSlashes(raw) {
  const s = String(raw == null ? '' : raw)
  let out = ''
  let inQuote = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (inQuote) {
      if (ch === inQuote) { inQuote = ''; out += ch; i += 1; continue }
      out += ch
      i += 1
      continue
    }
    if (ch === '"' || ch === "'") { inQuote = ch; out += ch; i += 1; continue }
    if (ch === '\\') { out += '/'; i += 1; continue }
    out += ch
    i += 1
  }
  return out
}

/**
 * 解析 ssh_config 文本成 Host 块。保留每行的原始行号与原文,供 --fix 就地替换。
 * 返回 { hosts: [{ patterns, blocks:[{key,value,line,raw}] , startLine }], lines }
 */
export function parseSshConfig(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/)
  const hosts = []
  let cur = null
  lines.forEach((raw, idx) => {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const m = trimmed.match(/^([A-Za-z][A-Za-z0-9]*)\s+(.*)$/)
    if (!m) return
    const key = m[1].toLowerCase()
    // 值里允许行内 `#` 注释 —— OpenSSH 只在行首当注释,这里照它的口径:不剥行内注释
    const value = m[2].trim()
    if (key === 'host') {
      cur = { patterns: value.split(/\s+/).filter(Boolean), entries: [], startLine: idx + 1 }
      hosts.push(cur)
      return
    }
    if (!cur) {
      cur = { patterns: ['*'], entries: [], startLine: idx + 1, implicit: true }
      hosts.push(cur)
    }
    cur.entries.push({ key, value, line: idx + 1, raw })
  })
  return { hosts, lines }
}

/** 从 ProxyCommand 取值里找出 `-File <目标>` / `-f <目标>` 的可执行目标。 */
function fileArgsOf(argv) {
  const out = []
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if ((t === '-File' || t === '-file' || t === '-f') && argv[i + 1]) out.push(argv[i + 1])
    if (/^-(File|file|f)=/.test(t)) out.push(t.slice(t.indexOf('=') + 1))
  }
  return out
}

/** 从一个 .ps1/.sh 脚本正文里抽出单/双引号包裹的绝对路径,当"前置件"清单。 */
export function absolutePathsInScript(body) {
  const found = new Set()
  const re = /['"]([A-Za-z]:[\\/][^'"]*|[A-Za-z]:\\[^'"]*)['"]/g
  let m
  while ((m = re.exec(String(body == null ? '' : body))) !== null) {
    const p = m[1].replace(/[\\/]+$/, '')
    if (p.length > 2) found.add(p)
  }
  return [...found]
}

function fileExists(p) {
  try { return fs.existsSync(p) } catch { return false }
}

/**
 * 主审计。纯函数式:只读传入的配置文本与磁盘上的引用件,不写任何东西。
 * opts: { configPath, platform, checkReferents }
 */
export function auditConfig(text, opts = {}) {
  const platform = opts.platform || process.platform
  const checkReferents = opts.checkReferents !== false
  const { hosts } = parseSshConfig(text)
  const findings = []
  const fixedLines = new Map()

  for (const h of hosts) {
    const label = h.patterns.join(' ')
    for (const e of h.entries) {
      if (e.key === 'proxycommand') {
        const a = auditProxyCommand(e.value)
        if (!a.safe) {
          findings.push({
            level: RED, code: a.code, host: label, line: e.line, raw: e.raw,
            reason: a.reason, action: '把该行路径改成正斜杠(或给整个路径加双引号)；--fix 可直接改',
            fixed: a.fixed,
          })
          fixedLines.set(e.line, a.fixed)
        }
        if (!/%h|%n|%p/.test(e.value)) {
          findings.push({
            level: YELLOW, code: 'no-host-placeholder', host: label, line: e.line, raw: e.raw,
            reason: 'ProxyCommand 未引用 %h/%n/%p，多条隧道会共用同一个目标',
            action: '确认这是有意为之；若靠环境变量取目标则忽略',
          })
        }
        if (checkReferents && platform === 'win32') {
          const { argv } = splitProxyCommand(a.safe ? e.value : a.fixed)
          const targets = []
          if (argv[0] && /^[A-Za-z]:[\\/]|^\\\\/.test(argv[0])) targets.push(argv[0])
          targets.push(...fileArgsOf(argv))
          for (const t of targets) {
            const p = expandPath(t)
            if (!fileExists(p)) {
              findings.push({
                level: RED, code: 'missing-referent', host: label, line: e.line, raw: e.raw,
                reason: `引用的文件不存在: ${p}`,
                action: '补装/改路径；路径本身对但文件没了，说明前置件被挪走',
              })
              continue
            }
            // 脚本里的"前置件"也逐个问一遍 —— 事故里 token 文件与 cloudflared 都可能被挪
            if (/\.(ps1|sh|cmd|bat)$/i.test(p)) {
              let body = ''
              try { body = fs.readFileSync(p, 'utf8') } catch { body = '' }
              if (!body) {
                findings.push({
                  level: RED, code: 'unreadable-script', host: label, line: e.line, raw: e.raw,
                  reason: `引用的脚本读不到: ${p}`,
                  action: '确认权限；判不了前置件是否齐备，按"未判定"处理',
                })
                continue
              }
              for (const dep of absolutePathsInScript(body)) {
                if (!fileExists(expandPath(dep))) {
                  findings.push({
                    level: RED, code: 'missing-prerequisite', host: label, line: e.line, raw: e.raw,
                    reason: `${path.basename(p)} 依赖的文件不存在: ${dep}`,
                    action: '补齐该前置件（令牌文件/可执行文件）',
                  })
                }
              }
            }
          }
        }
      }
      if (e.key === 'identityfile') {
        const p = expandPath(e.value)
        if (checkReferents && !/[*?]/.test(p) && !fileExists(p)) {
          findings.push({
            level: RED, code: 'missing-identity', host: label, line: e.line, raw: e.raw,
            reason: `IdentityFile 不存在: ${p}`,
            action: '把这台机的公钥私钥补回，或改 IdentityFile 指向现存的私钥',
          })
        }
      }
    }
  }

  if (/\r\n/.test(String(text))) {
    findings.push({
      level: YELLOW, code: 'crlf', host: '-', line: 0, raw: '',
      reason: '配置文件是 CRLF 行尾（OpenSSH 能读，但手工 diff 时容易误伤）',
      action: '可忽略',
    })
  }

  const tunnelHosts = hosts.filter((h) => h.entries.some((e) => e.key === 'proxycommand'))
  const red = findings.filter((f) => f.level === RED)
  return {
    findings,
    fixedLines: [...fixedLines.entries()].map(([line, value]) => ({ line, value })),
    stats: { hosts: hosts.length, tunnelHosts: tunnelHosts.length, red: red.length, yellow: findings.length - red.length },
    tunnelHostPatterns: tunnelHosts.flatMap((h) => h.patterns).filter((p) => !/[*?!]/.test(p)),
  }
}

/** 把 audit 结果落到磁盘:先备份,再逐行替换,最后复检(复检不过就回退)。 */
export function applyFixes(configPath, text, fixedLines) {
  if (!fixedLines.length) return { applied: 0, backup: null, message: '无需修改' }
  const lines = String(text).split(/\r?\n/)
  for (const { line, value } of fixedLines) {
    const idx = line - 1
    const m = String(lines[idx]).match(/^(\s*)([A-Za-z][A-Za-z0-9]*)(\s+)(.*)$/)
    if (!m) throw new Error(`第 ${line} 行无法定位键名，拒绝改写`)
    lines[idx] = `${m[1]}${m[2]}${m[3]}${value}`
  }
  const next = lines.join('\n')
  const recheck = auditConfig(next, { checkReferents: false })
  if (recheck.findings.some((f) => f.code === 'escape-eaten')) {
    throw new Error('改写后复检仍有被吃反斜杠的行，整批不落（不改盘）')
  }
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const backup = `${configPath}.bak-ihui-${stamp}`
  fs.copyFileSync(configPath, backup)
  fs.writeFileSync(configPath, next, 'utf8')
  return { applied: fixedLines.length, backup, message: '已规范为正斜杠' }
}

/** --verify:真连一次。返回 { host, ok, detail }[]。 */
function verifyHost(host, timeoutSec) {
  try {
    const out = execFileSync(
      'ssh',
      ['-o', 'BatchMode=yes', '-o', `ConnectTimeout=${timeoutSec}`, host, 'echo IHUI-SSH-OK'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: (timeoutSec + 10) * 1000 },
    )
    if (/IHUI-SSH-OK/.test(out)) return { host, ok: true, detail: out.trim().split(/\r?\n/).pop() }
    return { host, ok: false, detail: `输出无标记: ${out.trim().slice(0, 160)}` }
  } catch (err) {
    const detail = [err && err.stderr, err && err.message].filter(Boolean).join(' ').trim()
    return { host, ok: false, detail: detail.slice(0, 400) || '未知失败' }
  }
}

function selfTest() {
  const cases = [
    { name: '① 未引号单反斜杠(事故形态)', raw: 'C:\\Windows\\System32\\cmd.exe /c echo', safe: false },
    { name: '② 正斜杠', raw: 'C:/Windows/System32/cmd.exe /c echo', safe: true },
    { name: '③ 双引号包裹', raw: '"C:\\Windows\\System32\\cmd.exe" /c echo', safe: true },
    { name: '④ 双反斜杠', raw: 'C:\\\\Windows\\\\System32\\\\cmd.exe /c echo', safe: true },
    { name: '⑤ 无盘符路径', raw: 'cloudflared access ssh --hostname %h', safe: true },
  ]
  let bad = 0
  const rows = cases.map((c) => {
    const a = auditProxyCommand(c.raw)
    const ok = a.safe === c.safe
    if (!ok) bad += 1
    return { ...c, got: a.safe, code: a.code, pass: ok, fixed: a.fixed }
  })
  // 规范化自身必须幂等
  const once = normalizeToForwardSlashes(cases[0].raw)
  const twice = normalizeToForwardSlashes(once)
  const idem = once === twice
  if (!idem) bad += 1
  return { bad, rows, idempotent: idem, once }
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const doFix = argv.includes('--fix')
  const doVerify = argv.includes('--verify')
  const doSelfTest = argv.includes('--self-test')
  const cfgArg = argv.find((a) => a.startsWith('--config='))
  const configPath = cfgArg ? cfgArg.slice('--config='.length) : path.join(os.homedir(), '.ssh', 'config')

  if (doSelfTest) {
    const r = selfTest()
    if (json) {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`)
    } else {
      console.log('== SSH 体检仪判据自检 ==')
      for (const row of r.rows) console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${row.name}  safe=${row.got} code=${row.code}`)
      console.log(`${r.idempotent ? 'PASS' : 'FAIL'}  规范化幂等  例: ${r.once}`)
    }
    process.exit(r.bad === 0 ? 0 : 1)
  }

  if (!fileExists(configPath)) {
    const payload = { ok: false, undetermined: true, reason: `配置文件不存在: ${configPath}`, configPath }
    if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    else console.error(`[未判定] ${payload.reason}`)
    process.exit(2)
  }

  const text = fs.readFileSync(configPath, 'utf8')
  const audit = auditConfig(text, { checkReferents: true })

  let fixResult = null
  if (doFix) {
    try {
      fixResult = applyFixes(configPath, text, audit.fixedLines)
    } catch (err) {
      fixResult = { applied: 0, error: err instanceof Error ? err.message : String(err), backup: null }
    }
  }

  let verify = null
  if (doVerify && !doFix) {
    const targets = audit.tunnelHostPatterns
    if (!targets.length) {
      verify = { ran: false, reason: '没有可验证的隧道 Host（全部是通配模式）', results: [] }
    } else {
      verify = { ran: true, results: targets.map((h) => verifyHost(h, 20)) }
    }
  }

  const post = doFix && fixResult && fixResult.applied > 0 ? auditConfig(fs.readFileSync(configPath, 'utf8'), { checkReferents: true }) : audit
  const reds = post.findings.filter((f) => f.level === RED)
  const verifyFailed = verify && verify.ran ? verify.results.filter((r) => !r.ok) : []
  const ok = reds.length === 0 && verifyFailed.length === 0

  const payload = {
    ok,
    configPath,
    stats: post.stats,
    findings: post.findings,
    fix: fixResult,
    verify,
    undetermined: false,
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  } else {
    console.log(`== SSH 隧道体检 ==  ${configPath}`)
    console.log(`Host ${post.stats.hosts} 个 / 带 ProxyCommand ${post.stats.tunnelHosts} 个`)
    if (post.findings.length === 0) console.log('  (无发现)')
    for (const f of post.findings) {
      const tag = f.level === RED ? '红' : '黄'
      console.log(`  [${tag}] L${f.line} ${f.host}: ${f.reason}`)
      console.log(`       动作: ${f.action}`)
      if (f.raw) console.log(`       原文: ${f.raw}`)
      if (f.fixed) console.log(`       规范: ${f.fixed}`)
    }
    if (fixResult) {
      if (fixResult.error) console.log(`  [修复失败] ${fixResult.error}`)
      else if (fixResult.applied) console.log(`  [已修复] ${fixResult.applied} 行 -> 正斜杠；备份 ${fixResult.backup}`)
      else console.log(`  [未改动] ${fixResult.message}`)
    }
    if (verify) {
      if (!verify.ran) console.log(`  [跳过验证] ${verify.reason}`)
      else for (const r of verify.results) console.log(`  [${r.ok ? '通' : '断'}] ${r.host}  ${r.detail}`)
    }
    console.log(ok ? '结论: 绿' : '结论: 有红项，按上面动作逐条处置')
  }

  process.exit(ok ? 0 : 1)
}

export const __test__ = {
  splitProxyCommand,
  auditProxyCommand,
  normalizeToForwardSlashes,
  parseSshConfig,
  absolutePathsInScript,
  auditConfig,
  selfTest,
}

const isMain = (() => {
  try {
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : ''
    return entry && entry === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  } catch { return false }
})()

if (isMain) {
  main().catch((err) => {
    console.error(`[脚本异常] ${err instanceof Error ? err.stack : String(err)}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
