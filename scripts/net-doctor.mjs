#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 网络体检仪(只读,永不改任何东西,也不重启任何服务)。
 *
 * 存在的理由:2026-10-02 一次真实排障里,「这台机上网卡」先后被误判成三种完全不同的病 ——
 * 系统代理开关、客户端分流规则、线路质量。而当时**没有任何一件仪器能一次回答**「现在流量走的是
 * 哪条线、那条线活不活、系统代理该开还是该关」,只能一条条手敲 reg / netstat / 读配置 / 打 curl,
 * 每一步都可能把"没量到"读成"没问题"。本工具把那五步收成一枚命令,并把三件事写进判据本身:
 *
 *   1. **三态绝不并桶** —— 每一项要么是量到的结论,要么点名说"这一格没量到∶原因"。
 *      把没判写成判过了,是本仓最高频的失效型(见 AGENTS §5e、守门 94/103/118 各记过一次)。
 *   2. **国内/国外分开给结论** —— 只看国内站会得出"关掉代理更快"的错误结论(本次真的错过一次):
 *      国内流量本来就被 GEOIP,CN,DIRECT 放行成直连,而走海外的流量在没有系统代理时是"干等 6~10 秒
 *      再失败"。所以必须两类站点各测一遍才配说"该开还是该关"。
 *   3. **线路质量看的是活的核,不是配置文件** —— 控制器只走命名管道(本机 HTTP 控制器是关的),
 *      且延迟数值住在 `extra[<url>].history` 里而不是顶层 `delay`(写成读顶层会把 29 条线
 *      全读成"失联",这就是把尺子错当成故障的那一型)。
 *
 * 定级:**刻意不在提交链上**,也不是守门 —— 它判的是这台机器此刻的网络运行时状态,提交者结构上
 * 满足不了;挂进 pre-commit 就是一台与任何提交都无关的恒红门,唯一结局是各会话被逼绕过钩子、
 * 连带链上全部检查对该提交作废(AGENTS §12e/§12f 同型)。因此它**没有**任何"紧急跳过"环境变量。
 * 文件名不以 check|scan|guard 开头,故守门 89 的接线对账结构上看不到它(与 c-disk-breakdown /
 * visible-window-probe 同一取向),它的不变量由自己那把尺子钉:`--self-test` 与镜像测试。
 *
 * 用法:
 *   node scripts/net-doctor.mjs                 # 人读报告
 *   node scripts/net-doctor.mjs --json          # 机读(stdout 只有可 JSON.parse 的一个对象)
 *   node scripts/net-doctor.mjs --quick         # 少抽样(2 次 × 3 站),赶时间用
 *   node scripts/net-doctor.mjs --samples=5     # 多抽样(直连侧抖动大时值得)
 *   node scripts/net-doctor.mjs --self-test     # 判据自身的成对正反例,零副作用
 *
 * 退出码:0 = 没有"需要动手"的红项;1 = 至少一条红项(会逐条说清动作);
 *         2 = 脚本自身异常,或关键维度全部没量到(此时**不得**被读成"一切正常")。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import dns from 'node:dns/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { redactChildOutput } from './lib/secret-shape-redact.mjs'
import {
  PROBE_URL,
  parseRegQuery,
  pickYaml,
  ruleFacts,
  classifyMembers,
  recentDelays,
  latestDelay,
  median,
  resolveTestGroup,
  buildAdvice,
  exitCodeFrom,
  resolvePowerShell,
  resolveConfigDir,
  pipeNameFromCommandLine,
  PS_FIND_CORE,
  jsonFromRaw,
  summarizeSamples,
  renderText,
} from './lib/net-doctor-judges.mjs'

export const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
export const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
const DOMESTIC_SITES = ['https://www.baidu.com', 'https://www.qq.com']
const OVERSEAS_SITES = ['https://www.google.com', 'https://www.microsoft.com', 'https://github.com']
function flag(name, dflt) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (hit) return hit.slice(name.length + 3)
  return process.argv.includes(`--${name}`) ? true : dflt
}

// ────────────────────────── 纯判据(全部可被镜像测试直接 import) ──────────────────────────

function runWin(file, args, timeoutMs) {
  return execFileSync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    // stderr 必须接住而不是继承到终端:子程序的一句报错混进报告正文,会把"这格没量到"伪装成结论。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function readSystemProxy(timeoutMs) {
  try {
    return parseRegQuery(runWin('reg.exe', ['query', REG_KEY], timeoutMs))
  } catch {
    try {
      return parseRegQuery(runWin('reg', ['query', REG_KEY], timeoutMs))
    } catch (e2) {
      return {
        sawKey: false,
        enable: null,
        server: null,
        bypass: null,
        reason: redactChildOutput(String(e2.message || e2)),
      }
    }
  }
}

function readClient(timeoutMs, ps) {
  const out = { running: null, pid: null, pipe: null, reason: null }
  if (process.platform !== 'win32') {
    out.reason = '非 Windows'
    return out
  }
  if (!ps) {
    out.reason = '找不到可用的 PowerShell'
    return out
  }
  try {
    const text = runWin(ps, ['-NoProfile', '-Command', PS_FIND_CORE], timeoutMs)
    const line = String(text || '')
      .split(/\r?\n/)
      .find((l) => l.includes('|'))
    if (!line) {
      out.running = false
      out.reason = '进程表里没有 verge-mihomo'
      return out
    }
    const [pid, cmd] = line.split('|')
    out.running = true
    out.pid = Number(pid) || null
    out.pipe = pipeNameFromCommandLine(cmd)
    if (!out.pipe) out.reason = '进程在，但命令行里取不到命名管道名'
  } catch (e) {
    out.running = null
    out.reason = redactChildOutput(String(e.message || e))
  }
  return out
}

function controllerGet(pipeName, secret, reqPath, timeoutMs) {
  return new Promise((resolve) => {
    const chunks = []
    let sock
    try {
      sock = net.connect('\\\\.\\pipe\\' + pipeName)
    } catch (e) {
      resolve({ raw: null, err: redactChildOutput(String(e.message || e)) })
      return
    }
    const done = (err) =>
      resolve({ raw: chunks.length ? Buffer.concat(chunks).toString('utf8') : null, err })
    sock.setTimeout(timeoutMs, () => {
      sock.destroy()
      done('超时')
    })
    sock.on('connect', () => {
      sock.write(
        `GET ${reqPath} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer ${secret}\r\nConnection: close\r\n\r\n`,
      )
    })
    sock.on('data', (c) => chunks.push(c))
    sock.on('end', () => done(null))
    sock.on('error', (e) => done(redactChildOutput(String(e.message || e))))
  })
}

function curlOne(target, proxy, timeoutMs, curlBin) {
  const devNull = process.platform === 'win32' ? 'NUL' : '/dev/null'
  const args = [
    '-s',
    '-o',
    devNull,
    '-w',
    '%{http_code} %{time_total}',
    '--connect-timeout',
    String(Math.max(2, Math.round(timeoutMs / 3000))),
    '--max-time',
    String(Math.max(3, Math.round(timeoutMs / 1000))),
  ]
  if (proxy) args.push('-x', proxy)
  args.push(target)
  let code = '000'
  let sec = null
  try {
    const out = String(runWin(curlBin, args, timeoutMs + 2000) || '')
    const m = out.match(/(\d{3})\s+([0-9.]+)/)
    if (m) {
      code = m[1]
      sec = parseFloat(m[2])
    }
  } catch (e) {
    const out = e.stdout ? String(e.stdout) : ''
    const m = out.match(/(\d{3})\s+([0-9.]+)/)
    if (m) {
      code = m[1]
      sec = parseFloat(m[2])
    }
  }
  return {
    code,
    ms: typeof sec !== 'number' ? null : Math.round(sec * 1000),
    ok: /^[23]/.test(code),
  }
}

export async function collect(opts = {}, deps = {}) {
  const timeoutMs = opts.timeoutMs
  const undetermined = []
  const note = (dim, reason) => undetermined.push({ dim, reason })

  const proxy = deps.readSystemProxy ? deps.readSystemProxy(timeoutMs) : readSystemProxy(timeoutMs)
  if (!proxy.sawKey) note('系统代理', proxy.reason || 'reg 无输出')

  const cfgDir = (deps.resolveConfigDir || resolveConfigDir)(process.env, fs)
  const ps = (deps.resolvePowerShell || resolvePowerShell)(fs)
  const client = deps.readClient ? deps.readClient(timeoutMs, ps) : readClient(timeoutMs, ps)
  if (!client.running) note('代理核', client.reason || '未运行')

  const cfg = {
    mixedPort: null,
    desiredSystemProxy: null,
    tunMode: null,
    secret: null,
    rules: null,
  }
  if (!cfgDir) {
    note('客户端配置', '目录不可达（可用 NET_DOCTOR_VERGE_DIR 指过去）')
  } else {
    try {
      const verge = fs.readFileSync(path.join(cfgDir, 'verge.yaml'), 'utf8')
      cfg.mixedPort = Number(pickYaml(verge, 'verge_mixed_port')) || null
      cfg.desiredSystemProxy = pickYaml(verge, 'enable_system_proxy') === 'true'
      cfg.tunMode = pickYaml(verge, 'enable_tun_mode') === 'true'
    } catch (e) {
      note('verge.yaml', redactChildOutput(String(e.message || e)))
    }
    try {
      const runtime = fs.readFileSync(path.join(cfgDir, 'clash-verge.yaml'), 'utf8')
      cfg.secret = pickYaml(runtime, 'secret')
      cfg.rules = ruleFacts(runtime)
    } catch (e) {
      note('clash-verge.yaml', redactChildOutput(String(e.message || e)))
    }
  }

  const groups = {
    readable: false,
    reason: null,
    alive: 0,
    measurable: 0,
    dead: [],
    untested: [],
    current: null,
    fastest: null,
  }
  if (!client.pipe) groups.reason = client.reason || '管道名未取到'
  else if (!cfg.secret) groups.reason = '配置里没有控制器密钥'
  else {
    const first = jsonFromRaw(
      (await (deps.controllerGet || controllerGet)(client.pipe, cfg.secret, '/proxies', timeoutMs))
        .raw,
    )
    const proxies = first && first.proxies
    if (!proxies) groups.reason = '控制器没返回 /proxies'
    else {
      const startName = (cfg.rules && cfg.rules.matchTarget) || null
      const target =
        startName && proxies[startName]
          ? startName
          : Object.keys(proxies).find(
              (k) =>
                proxies[k].now && (proxies[k].type === 'Selector' || proxies[k].type === 'URLTest'),
            )
      if (!target) groups.reason = '找不到出口策略分组'
      else {
        const g = resolveTestGroup(proxies, target)
        const { real } = classifyMembers(g.members)
        const measured = []
        for (const name of real) {
          const p = jsonFromRaw(
            (
              await (deps.controllerGet || controllerGet)(
                client.pipe,
                cfg.secret,
                `/proxies/${encodeURIComponent(name)}?url=${encodeURIComponent(PROBE_URL)}&timeout=${timeoutMs}`,
                timeoutMs + 4000,
              )
            ).raw,
          )
          const w = recentDelays(p, PROBE_URL, 5)
          // 用窗口中位数而不是最后一次读数比较两条线 —— 单点尖峰会把"谁最快"这个问题答反。
          if (w.length)
            measured.push({ name, delay: median(w), last: w[w.length - 1], window: w.length })
          else groups.untested.push(name)
        }
        groups.readable = true
        groups.groupName = target
        groups.via = g.hops.join(' → ')
        groups.measurable = real.length
        groups.alive = measured.length
        groups.dead = groups.untested
        groups.pseudoSkipped = classifyMembers(g.members).pseudo.length
        if (measured.length) {
          measured.sort((x, y) => x.delay - y.delay)
          groups.fastest = measured[0]
          groups.sorted = measured
          const nowName = resolveTestGroup(proxies, target).now
          groups.currentName = nowName
          groups.current = measured.find((m) => m.name === nowName) || null
        }
      }
    }
  }
  if (!groups.readable) note('线路延迟', groups.reason)

  // 站点抽样
  const curlBin = deps.curlBin || 'curl.exe'
  const proxyUrl = cfg.mixedPort ? `http://127.0.0.1:${cfg.mixedPort}` : null
  const sites = opts.quick
    ? DOMESTIC_SITES.slice(0, 1).concat(OVERSEAS_SITES.slice(0, 2))
    : DOMESTIC_SITES.concat(OVERSEAS_SITES)
  const samples = []
  let curlBroken = false
  for (const host of sites) {
    const row = { host, domestic: DOMESTIC_SITES.includes(host), direct: [], proxied: [] }
    for (let i = 0; i < opts.samples; i++) {
      if (curlBroken) break
      try {
        row.direct.push(curlOne(host, null, timeoutMs, curlBin))
      } catch (e) {
        curlBroken = true
        note('站点抽样', 'curl 不可用：' + redactChildOutput(String(e.message || e)))
        break
      }
      if (proxyUrl) row.proxied.push(curlOne(host, proxyUrl, timeoutMs, curlBin))
    }
    row.directSum = summarizeSamples(row.direct)
    row.proxiedSum = proxyUrl ? summarizeSamples(row.proxied) : null
    samples.push(row)
  }
  const dm = median(samples.filter((r) => r.domestic).map((r) => r.directSum.median))
  const dmp = median(
    samples.filter((r) => r.domestic && r.proxiedSum).map((r) => r.proxiedSum.median),
  )
  const overseas = samples.filter((r) => !r.domestic)
  const overseasDirectFail = overseas.reduce(
    (n, r) => n + (r.directSum ? r.directSum.failCount : 0),
    0,
  )
  const overseasProxiedOk = overseas.reduce(
    (n, r) => n + (r.proxiedSum ? r.proxiedSum.okCount : 0),
    0,
  )

  let dnsMs = null
  try {
    const t0 = Date.now()
    await dns.lookup('www.baidu.com')
    dnsMs = Date.now() - t0
  } catch (e) {
    note('DNS', redactChildOutput(String(e.message || e)))
  }

  let origin = null
  try {
    const git = (deps.gitBinary || (() => 'git'))()
    const out = runWin(
      git,
      ['-c', 'safe.directory=*', 'ls-remote', '--heads', 'origin', 'main'],
      timeoutMs * 3,
    )
    origin = /\trefs\/heads\/main/.test(String(out))
  } catch (e) {
    origin = null
    note('git 到 origin', redactChildOutput(String(e.message || e)))
  }

  let ports = { readable: false }
  try {
    const reg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'scripts', 'dev-port-registry.json'), 'utf8'),
    )
    const list = Object.entries(reg.services || {}).map(([k, v]) => ({ name: k, port: v.port }))
    const netstat = runWin('netstat.exe', ['-ano', '-p', 'tcp'], timeoutMs)
    const listening = new Set(
      String(netstat)
        .split(/\r?\n/)
        .filter((l) => /LISTENING/.test(l))
        .map((l) => {
          const m = l.match(/:(\d+)\s+/)
          return m ? Number(m[1]) : -1
        }),
    )
    ports = {
      readable: true,
      total: list.length,
      listening: list.filter((s) => listening.has(s.port)).length,
      down: list.filter((s) => !listening.has(s.port)).map((s) => `${s.name}:${s.port}`),
    }
  } catch (e) {
    note('服务端口', redactChildOutput(String(e.message || e)))
  }

  const signals = {
    proxy,
    client,
    rules: cfg.rules,
    groups,
    samplesRan: samples.some((r) => r.directSum && r.directSum.attempts > 0),
    domesticMedian: dm,
    domesticProxiedMedian: dmp,
    overseasDirectFail,
    overseasProxiedOk,
    dnsMs,
    origin,
    ports,
  }
  const advice = (deps.buildAdvice || buildAdvice)(signals)
  return {
    meta: {
      tool: 'net-doctor',
      at: new Date().toISOString(),
      platform: process.platform,
      configDir: cfgDir,
      mixedPort: cfg.mixedPort,
      tunMode: cfg.tunMode,
      desiredSystemProxy: cfg.desiredSystemProxy,
      proxy,
      client,
      rules: cfg.rules,
      groups,
      samples,
      dnsMs,
      origin,
      ports,
      advice,
      undetermined,
    },
    exitCode: exitCodeFrom(advice, undetermined.length),
  }
}

export function selfTest() {
  const cases = []
  const t = (name, cond) => cases.push({ name, pass: cond === true, got: cond })
  t('parseRegQuery 认 0x1 为开', parseRegQuery('ProxyEnable REG_DWORD 0x1').enable === true)
  t('parseRegQuery 认 0x0 为关', parseRegQuery('ProxyEnable REG_DWORD 0x0').enable === false)
  t(
    'parseRegQuery 无键时不得冒充"关"',
    parseRegQuery('').enable === null && parseRegQuery('').sawKey === false,
  )
  t(
    'parseRegQuery 取到 ProxyServer',
    parseRegQuery('ProxyServer REG_SZ 127.0.0.1:7897').server === '127.0.0.1:7897',
  )
  const okRules = 'mode: rule\nrules:\n  - GEOIP,CN,DIRECT\n  - MATCH,happyCat\n'
  t(
    'ruleFacts 认出 rule + 国内直连 + 兜底',
    (() => {
      const r = ruleFacts(okRules)
      return r.mode === 'rule' && r.cnDirect === true && r.matchTarget === 'happyCat'
    })(),
  )
  t(
    'ruleFacts 全局模式必须被识别为异常',
    ruleFacts('mode: global\n  - MATCH,happyCat\n').mode === 'global',
  )
  t(
    'ruleFacts 缺 GEOIP,CN 时 cnDirect 为假',
    ruleFacts('mode: rule\n  - MATCH,happyCat\n').cnDirect === false,
  )
  t(
    'classifyMembers 剔除账户信息条目与内建策略',
    (() => {
      const c = classifyMembers(['香港HK1', '剩余流量：132GB', 'DIRECT', '日本JP2'])
      return c.real.length === 2 && c.pseudo.length === 1
    })(),
  )
  t('latestDelay 读顶层 delay（旧形态）', latestDelay({ delay: 158 }) === 158)
  t(
    'latestDelay 读 extra.history 末条（现形态）',
    latestDelay({ extra: { [PROBE_URL]: { history: [{ delay: 471 }, { delay: 160 }] } } }) === 160,
  )
  t(
    'latestDelay 无量值时返回 null 而不是 0',
    latestDelay({ extra: {} }) === null && latestDelay(null) === null,
  )
  t(
    '单次尖峰不得决定"谁最快" —— 窗口取中位数',
    (() => {
      const spike = recentDelays({
        extra: { [PROBE_URL]: { history: [{ delay: 100 }, { delay: 105 }, { delay: 900 }] } },
      })
      return spike.length === 3 && median(spike) === 105
    })(),
  )
  t(
    'recentDelays 窗口上限生效',
    recentDelays(
      {
        extra: {
          [PROBE_URL]: { history: Array.from({ length: 9 }, (_, i) => ({ delay: i + 1 })) },
        },
      },
      PROBE_URL,
      3,
    ).length === 3,
  )
  t(
    '给不出读数的线路不得被断言成"不通"',
    buildAdvice({
      proxy: { sawKey: true, enable: true },
      rules: { mode: 'rule', cnDirect: true },
      groups: {
        readable: true,
        alive: 3,
        measurable: 5,
        dead: ['HK1'],
        current: { name: 'A', delay: 100, window: 3 },
        fastest: { name: 'A', delay: 100, window: 3 },
      },
    }).some((x) => x.text.includes('从未被测过')),
  )
  const proxies = {
    happyCat: { type: 'Selector', now: '自动选择', all: ['自动选择', 'DIRECT'] },
    自动选择: { type: 'URLTest', now: 'JP', all: ['JP', 'SG', '剩余流量：1G'] },
  }
  t(
    'resolveTestGroup 从 Selector 下沉到 URLTest',
    (() => {
      const g = resolveTestGroup(proxies, 'happyCat')
      return g.name === '自动选择' && g.now === 'JP' && g.members.length === 3
    })(),
  )
  t('resolveTestGroup 组名不存在时给原因', resolveTestGroup(proxies, 'nope').reason !== null)
  t('median 偶数取中', median([100, 200, 300, 400]) === 250 && median([]) === null)
  t(
    'summarizeSamples 把失败单独计',
    (() => {
      const s = summarizeSamples([
        { ok: true, ms: 100 },
        { ok: false, ms: null },
      ])
      return s.median === 100 && s.failCount === 1
    })(),
  )
  t(
    'pipeNameFromCommandLine 取到管道名',
    pipeNameFromCommandLine('x -ext-ctl-pipe \\\\.\\pipe\\verge-mihomo-sidecar-release-abc123') ===
      'verge-mihomo-sidecar-release-abc123',
  )
  t('pipeNameFromCommandLine 无管道时 null', pipeNameFromCommandLine('x -d some') === null)
  t(
    'resolvePowerShell 优先 7 且构造面可测',
    resolvePowerShell({ existsSync: (p) => p.includes('pwsh') }) ===
      'C:/Program Files/PowerShell/7/pwsh.exe',
  )
  t('resolvePowerShell 两者皆无给 null', resolvePowerShell({ existsSync: () => false }) === null)
  t(
    'resolveConfigDir 只认带 clash-verge.yaml 的目录',
    resolveConfigDir(
      { APPDATA: '/x' },
      { existsSync: (p) => p.endsWith('clash-verge.yaml') && p.includes('clash-verge-rev') },
    ) === path.join('/x', 'io.github.clash-verge-rev.clash-verge-rev'),
  )
  t('resolveConfigDir 无 APPDATA 给 null', resolveConfigDir({}, fs) === null)
  t(
    'jsonFromRaw 解出正文而不被头部花括号骗',
    jsonFromRaw('HTTP/1.1 200 OK\r\n\r\n{"a":1}')?.a === 1,
  )
  t('jsonFromRaw 坏 JSON 给 null', jsonFromRaw('HTTP/1.1 200 OK\r\n\r\n{nope') === null)

  // 结论器的四组构造面：摘掉任何一条判据，必有对应用例翻红
  const offButOverseasDead = buildAdvice({
    proxy: { sawKey: true, enable: false, server: '127.0.0.1:7897' },
    rules: { mode: 'rule', cnDirect: true },
    groups: { readable: true, alive: 3, measurable: 5, dead: ['HK1'] },
    overseasDirectFail: 2,
    dnsMs: 50,
    origin: true,
  })
  t(
    '系统代理关着 ⇒ 判红并给动作',
    offButOverseasDead.some((x) => x.level === 'bad' && x.text.includes('系统代理当前是关的')),
  )
  const onAndCorrect = buildAdvice({
    proxy: { sawKey: true, enable: true, server: '127.0.0.1:7897' },
    rules: { mode: 'rule', cnDirect: true, matchTarget: 'A' },
    groups: {
      readable: true,
      alive: 4,
      measurable: 4,
      dead: [],
      current: { name: 'SG', delay: 90 },
      fastest: { name: 'SG', delay: 90 },
    },
    domesticMedian: 120,
    domesticProxiedMedian: 130,
    overseasDirectFail: 0,
    overseasProxiedOk: 3,
    dnsMs: 40,
    origin: true,
  })
  t(
    '一切正常时不得有红项',
    onAndCorrect.every((x) => x.level !== 'bad'),
  )
  const globalMode = buildAdvice({
    proxy: { sawKey: true, enable: true },
    rules: { mode: 'global', cnDirect: false },
  })
  t(
    '全局模式必须判红（国内也被拖着走节点）',
    globalMode.some((x) => x.level === 'bad' && x.text.includes('global')),
  )
  const notPickedFastest = buildAdvice({
    proxy: { sawKey: true, enable: true },
    rules: { mode: 'rule', cnDirect: true },
    groups: {
      readable: true,
      alive: 5,
      measurable: 9,
      dead: ['HK1', 'HK2'],
      current: { name: 'JP', delay: 161 },
      fastest: { name: 'SG', delay: 90 },
    },
  })
  t(
    '自动选线不是最快 ⇒ 报出差值',
    notPickedFastest.some((x) => x.text.includes('差 71ms')),
  )
  t(
    '未判定的线路不得被读成"都活着"',
    buildAdvice({
      proxy: { sawKey: true, enable: true },
      groups: { readable: false, reason: '控制器不可达' },
    }).some((x) => x.text.includes('没有读数不等于线路都活着')),
  )
  t(
    '线路全失联 ⇒ 判红',
    buildAdvice({
      groups: { readable: true, alive: 0, measurable: 9, dead: ['A'] },
      rules: { mode: 'rule', cnDirect: true },
      proxy: { sawKey: true, enable: true },
    }).some((x) => x.level === 'bad'),
  )
  t(
    'git 不可达 ⇒ 判红',
    buildAdvice({ proxy: { sawKey: true, enable: true }, origin: false }).some(
      (x) => x.level === 'bad' && x.text.includes('origin'),
    ),
  )
  t('exitCode：有红项为 1', exitCodeFrom([{ level: 'bad', text: 'x' }], 0) === 1)
  t('exitCode：全 note/ok 为 0', exitCodeFrom([{ level: 'ok', text: 'x' }], 2) === 0)
  t(
    'exitCode：关键维度全没量到 ⇒ 2（拒绝出合格证）',
    exitCodeFrom([{ level: 'note', text: 'x' }], 6) === 2,
  )

  // ── 真跑一次之后补进来的三条：每一条都对应一次"报告看起来正常而某一格根本没量到"的实测缺陷 ──
  t(
    'PS 找进程那句只能用插值，不得出现 -Filter 值后面接 +',
    /ProcessId=\$\(\$p\.Id\)/.test(PS_FIND_CORE) && !/-Filter\s+"[^"]*"\s*\+/.test(PS_FIND_CORE),
  )
  t(
    '一次请求都没发出 ⇒ 必须明说"站点抽样：未判定"',
    buildAdvice({
      proxy: { sawKey: true, enable: true },
      samplesRan: false,
      overseasDirectFail: 0,
      overseasProxiedOk: 0,
    }).some((x) => x.text.includes('站点抽样：未判定')),
  )
  t(
    '发了请求而全失败，与"未尝试"在数据层就不同形',
    (() => {
      const s = summarizeSamples([
        { ok: false, ms: null },
        { ok: false, ms: null },
      ])
      return s.attempts === 2 && s.median === null && s.failCount === 2
    })(),
  )
  t(
    'renderText 把全失败显示成"全部失败(2)"而不是"未尝试"',
    renderText({
      at: 'x',
      platform: 'win32',
      advice: [],
      undetermined: [],
      samples: [
        {
          host: 'https://a',
          domestic: true,
          directSum: { attempts: 2, median: null, failCount: 2, okCount: 0 },
          proxiedSum: null,
        },
      ],
    }).includes('全部失败(2)'),
  )
  t(
    'renderText 把没发出请求显示成"未尝试"（与上一条必须不同形）',
    renderText({
      at: 'x',
      platform: 'win32',
      advice: [],
      undetermined: [],
      samples: [
        {
          host: 'https://a',
          domestic: true,
          directSum: { attempts: 0, median: null, failCount: 0, okCount: 0 },
          proxiedSum: null,
        },
      ],
    }).includes('未尝试'),
  )

  let pass = 0
  for (const c of cases) {
    if (c.pass) pass++
    console.info(`${c.pass ? '✅' : '❌ 实得:' + JSON.stringify(c.got)} ${c.name}`)
  }
  console.info(`${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

async function main() {
  if (flag('self-test')) return { exitCode: selfTest(), meta: null }
  const opts = {
    json: flag('json') === true,
    quick: flag('quick') === true,
    samples: Math.max(1, Math.min(9, Number(flag('samples', '3')) || 3)),
    timeoutMs: Math.max(1000, Number(flag('timeout-ms', '9000')) || 9000),
  }
  if (opts.quick) opts.samples = Math.min(2, opts.samples)
  const { meta, exitCode } = await collect(opts)
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ...meta, exitCode }, null, 2) + '\n')
  } else {
    process.stdout.write(renderText(meta) + '\n')
  }
  return { exitCode, meta: opts.json ? null : meta }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then(
    (r) => process.exit(r.exitCode),
    (e) => {
      console.error('脚本自身异常：' + String(e && e.message ? e.message : e))
      process.exit(2)
    },
  )
}

export const __test__ = {
  parseRegQuery,
  pickYaml,
  ruleFacts,
  classifyMembers,
  latestDelay,
  recentDelays,
  median,
  resolveTestGroup,
  buildAdvice,
  exitCodeFrom,
  summarizeSamples,
  pipeNameFromCommandLine,
  resolvePowerShell,
  resolveConfigDir,
  jsonFromRaw,
  PS_FIND_CORE,
  renderText,
  selfTest,
  PROBE_URL,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
